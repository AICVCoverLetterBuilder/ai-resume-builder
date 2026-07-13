/**
 * Arabic cover-letter PDF export via browser HTML rendering + html2canvas.
 *
 * @react-pdf/renderer cannot reliably shape Arabic in this project (glyph overlap,
 * broken bidi for mixed Latin/Arabic). Chromium/WebView renders the same RTL HTML
 * preview correctly, so Arabic PDFs are captured from an isolated A4 container.
 */
import {
  CV_PDF_A4_HEIGHT_MM,
  CV_PDF_A4_WIDTH_MM,
  buildPaddedPdfSlice,
} from './export';
import { computeCoverLetterPdfParagraphs, formatCoverLetterDate } from './cover-letter-pdf';

const A4_WIDTH_PX = Math.round((CV_PDF_A4_WIDTH_MM * 96) / 25.4);
const A4_MIN_HEIGHT_PX = Math.round((CV_PDF_A4_HEIGHT_MM * 96) / 25.4);
const CAPTURE_SCALE = 2;
const CONTINUATION_TOP_PAD_PX = 28;
const CONTINUATION_BOTTOM_PAD_PX = 12;

function injectArabicFontFace(): void {
  const id = 'cl-arabic-pdf-font-face';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @font-face {
      font-family: 'Noto Sans Arabic';
      src: url('/fonts/NotoSansArabic-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Noto Sans Arabic';
      src: url('/fonts/NotoSansArabic-Bold.ttf') format('truetype');
      font-weight: 700;
      font-style: normal;
    }
  `;
  document.head.appendChild(style);
}

async function waitForArabicFonts(): Promise<void> {
  injectArabicFontFace();
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load('400 11pt "Noto Sans Arabic"'),
      document.fonts.load('700 11pt "Noto Sans Arabic"'),
    ]).catch(() => undefined);
    await document.fonts.ready;
  }
}

function buildArabicCaptureElement(candidateName: string, content: string, locale: string): HTMLDivElement {
  const paragraphs = computeCoverLetterPdfParagraphs(content, candidateName);
  const dateStr = formatCoverLetterDate(locale);

  const root = document.createElement('div');
  root.setAttribute('data-cl-arabic-pdf', 'true');
  root.style.cssText = [
    `width:${A4_WIDTH_PX}px`,
    `min-height:${A4_MIN_HEIGHT_PX}px`,
    'box-sizing:border-box',
    'padding:56px 60px',
    'background:#ffffff',
    'color:#1F2937',
    'font-family:"Noto Sans Arabic",NotoSansArabic,sans-serif',
    'font-size:11pt',
    'line-height:1.6',
    'direction:rtl',
    'text-align:right',
    'unicode-bidi:plaintext',
    'letter-spacing:normal',
    'word-spacing:normal',
    'position:fixed',
    'left:-10000px',
    'top:0',
    'z-index:-1',
  ].join(';');

  const dateEl = document.createElement('div');
  dateEl.style.cssText = 'margin-bottom:20px;color:#4B5563;font-size:11pt;text-align:right;direction:rtl;';
  dateEl.textContent = dateStr;
  root.appendChild(dateEl);

  for (const para of paragraphs) {
    const p = document.createElement('p');
    p.style.cssText = 'margin:0 0 10px 0;text-align:right;direction:rtl;unicode-bidi:plaintext;letter-spacing:normal;';
    p.textContent = para;
    root.appendChild(p);
  }

  document.body.appendChild(root);
  return root;
}

export async function buildArabicCoverLetterPdfBlob(
  candidateName: string,
  content: string,
  locale = 'ar',
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Arabic cover letter PDF capture requires a browser environment');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  await waitForArabicFonts();
  const element = buildArabicCaptureElement(candidateName, content, locale);

  try {
    // Allow layout + webfont shaping to settle.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const canvas = await html2canvas(element, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: A4_WIDTH_PX,
      windowWidth: A4_WIDTH_PX,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error('Arabic cover letter PDF capture produced an empty canvas');
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const canvasWidthPx = canvas.width;
    const canvasHeightPx = canvas.height;
    const pageHeightPx = Math.round((CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM) * (canvasWidthPx / CAPTURE_SCALE));
    const scaledPageHeightPx = pageHeightPx * CAPTURE_SCALE;

    if (canvasHeightPx <= scaledPageHeightPx + 4) {
      const img = canvas.toDataURL('image/jpeg', 0.95);
      const heightMm = (canvasHeightPx / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
      pdf.addImage(img, 'JPEG', 0, 0, CV_PDF_A4_WIDTH_MM, Math.min(heightMm, CV_PDF_A4_HEIGHT_MM));
    } else {
      let offsetY = 0;
      let pageIndex = 0;
      while (offsetY < canvasHeightPx) {
        const remaining = canvasHeightPx - offsetY;
        const sliceHeight = Math.min(scaledPageHeightPx, remaining);
        const topPad = pageIndex === 0 ? 0 : CONTINUATION_TOP_PAD_PX * CAPTURE_SCALE;
        const bottomPad = offsetY + sliceHeight < canvasHeightPx ? CONTINUATION_BOTTOM_PAD_PX * CAPTURE_SCALE : 0;
        const padded = buildPaddedPdfSlice(canvas, offsetY, sliceHeight, canvasWidthPx, topPad, bottomPad);
        const sliceHeightMm = (padded.paddedHeightPx / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(
          padded.dataUrl,
          'JPEG',
          0,
          0,
          CV_PDF_A4_WIDTH_MM,
          Math.min(sliceHeightMm, CV_PDF_A4_HEIGHT_MM),
        );
        offsetY += sliceHeight;
        pageIndex += 1;
      }
    }

    return pdf.output('blob');
  } finally {
    element.remove();
  }
}
