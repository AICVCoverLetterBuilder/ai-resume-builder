/**
 * Arabic cover-letter PDF export via browser HTML rendering + html2canvas.
 *
 * @react-pdf/renderer cannot reliably shape Arabic in this project. Chromium/WebView
 * renders RTL HTML correctly; this path captures an attached, measurable A4 container.
 */
import { Capacitor } from '@capacitor/core';
import {
  CV_PDF_A4_HEIGHT_MM,
  CV_PDF_A4_WIDTH_MM,
  buildPaddedPdfSlice,
  ensureNotoFontsForHtmlCapture,
} from './export';
import { computeCoverLetterPdfParagraphs, formatCoverLetterDate } from './cover-letter-pdf';
import {
  CoverLetterArabicPdfExportError,
  getArabicCoverLetterPdfDiagnostics,
  recordArabicCoverLetterPdfStage,
  resetArabicCoverLetterPdfDiagnostics,
  type ArabicCoverLetterPdfStage,
} from './cover-letter-arabic-pdf-diagnostics';

export {
  CoverLetterArabicPdfExportError,
  getArabicCoverLetterPdfDiagnostics,
  resetArabicCoverLetterPdfDiagnostics,
  type ArabicCoverLetterPdfStage,
};

const A4_WIDTH_PX = Math.round((CV_PDF_A4_WIDTH_MM * 96) / 25.4);
const A4_MIN_HEIGHT_PX = Math.round((CV_PDF_A4_HEIGHT_MM * 96) / 25.4);

function resolveCaptureScale(): number {
  if (typeof window === 'undefined') return 2;
  const isAndroidWebView =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  // Android WebView memory is tight — avoid oversized canvases while keeping text sharp.
  return isAndroidWebView ? 1.5 : 2;
}

function fail(stage: ArabicCoverLetterPdfStage, message: string, cause?: unknown): never {
  const err = new CoverLetterArabicPdfExportError(stage, message, cause);
  if (process.env.NODE_ENV !== 'production') {
    console.error('[cl-arabic-pdf] failed at', stage, message, cause);
    if (err.causeError?.stack) console.error(err.causeError.stack);
  }
  throw err;
}

function measureElement(element: HTMLElement): { width: number; height: number } {
  void element.offsetHeight;
  void element.getBoundingClientRect();
  const width = Math.max(element.scrollWidth, element.offsetWidth, A4_WIDTH_PX);
  const height = Math.max(element.scrollHeight, element.offsetHeight, A4_MIN_HEIGHT_PX);
  return { width, height };
}

type ArabicCaptureNodes = {
  wrapper: HTMLDivElement;
  root: HTMLDivElement;
};

function buildArabicCaptureNodes(
  candidateName: string,
  content: string,
  locale: string,
): ArabicCaptureNodes {
  const paragraphs = computeCoverLetterPdfParagraphs(content, candidateName);
  const dateStr = formatCoverLetterDate(locale);

  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-cl-arabic-pdf-wrapper', 'true');
  wrapper.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'width:100vw',
    'height:100vh',
    'overflow:hidden',
    'pointer-events:none',
    'z-index:2147483646',
    'opacity:0.01',
    'background:transparent',
    'visibility:visible',
    'display:block',
  ].join(';');

  const root = document.createElement('div');
  root.setAttribute('data-cl-arabic-pdf', 'true');
  root.setAttribute('dir', 'rtl');
  root.style.cssText = [
    `width:${A4_WIDTH_PX}px`,
    `min-height:${A4_MIN_HEIGHT_PX}px`,
    'box-sizing:border-box',
    'padding:56px 60px',
    'background:#ffffff',
    'color:#1F2937',
    "font-family:'NotoSansArabic','Noto Sans Arabic',sans-serif",
    'font-size:11pt',
    'line-height:1.6',
    'direction:rtl',
    'text-align:right',
    'unicode-bidi:plaintext',
    'letter-spacing:normal',
    'word-spacing:normal',
    'position:absolute',
    'top:0',
    'left:0',
    'visibility:visible',
    'display:block',
    'overflow:visible',
  ].join(';');

  const dateEl = document.createElement('div');
  dateEl.setAttribute('dir', 'rtl');
  dateEl.style.cssText =
    'margin-bottom:20px;color:#4B5563;font-size:11pt;text-align:right;direction:rtl;unicode-bidi:plaintext;';
  dateEl.textContent = dateStr;
  root.appendChild(dateEl);

  for (const para of paragraphs) {
    const p = document.createElement('p');
    p.setAttribute('dir', 'rtl');
    p.style.cssText =
      'margin:0 0 10px 0;text-align:right;direction:rtl;unicode-bidi:plaintext;letter-spacing:normal;';
    p.textContent = para;
    root.appendChild(p);
  }

  wrapper.appendChild(root);
  return { wrapper, root };
}

function validatePdfBlob(blob: Blob): void {
  if (!blob || blob.size < 512) {
    fail('blob_validated', `PDF blob too small (${blob?.size ?? 0} bytes)`);
  }
  if (blob.type && blob.type !== 'application/pdf') {
    fail('blob_validated', `PDF blob has unexpected MIME type: ${blob.type}`);
  }
}

export async function buildArabicCoverLetterPdfBlob(
  candidateName: string,
  content: string,
  locale = 'ar',
): Promise<Blob> {
  resetArabicCoverLetterPdfDiagnostics();
  recordArabicCoverLetterPdfStage('entered');

  if (typeof document === 'undefined') {
    fail('entered', 'Arabic cover letter PDF capture requires a browser environment');
  }

  const probe = content?.trim();
  if (!probe) {
    fail('content_validated', 'Arabic cover letter PDF export received empty content');
  }
  recordArabicCoverLetterPdfStage('content_validated', `${probe.length} chars`);

  let removeFonts: (() => void) | null = null;
  let nodes: ArabicCaptureNodes | null = null;

  try {
    const [{ default: html2canvasMod }, jspdfMod] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const html2canvasFn = (
      (html2canvasMod as { default?: typeof import('html2canvas').default }).default ?? html2canvasMod
    ) as typeof import('html2canvas').default;
    const jsPDF = (jspdfMod.jsPDF ?? jspdfMod.default) as typeof import('jspdf').jsPDF;

    if (typeof html2canvasFn !== 'function') {
      fail('entered', 'html2canvas is not available');
    }

    nodes = buildArabicCaptureNodes(candidateName, content, locale);
    recordArabicCoverLetterPdfStage('container_created', `width=${A4_WIDTH_PX}`);

    document.body.appendChild(nodes.wrapper);
    recordArabicCoverLetterPdfStage('container_attached');

    void nodes.root.offsetHeight;
    const { width: captureWidth, height: captureHeight } = measureElement(nodes.root);
    nodes.root.style.width = `${captureWidth}px`;
    nodes.root.style.height = `${captureHeight}px`;
    void nodes.root.offsetHeight;

    if (captureWidth <= 0 || captureHeight <= 0) {
      fail(
        'container_measured',
        `Capture container has zero dimensions (${captureWidth}×${captureHeight})`,
      );
    }
    recordArabicCoverLetterPdfStage(
      'container_measured',
      `${captureWidth}×${captureHeight}`,
    );

    removeFonts = await ensureNotoFontsForHtmlCapture();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    recordArabicCoverLetterPdfStage('fonts_ready');

    const scale = resolveCaptureScale();
    recordArabicCoverLetterPdfStage('html2canvas_started', `scale=${scale}`);

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvasFn(nodes.root, {
        scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
      });
    } catch (captureErr) {
      fail('html2canvas_completed', 'html2canvas capture failed', captureErr);
    }

    recordArabicCoverLetterPdfStage(
      'html2canvas_completed',
      `${canvas.width}×${canvas.height}`,
    );

    if (!canvas.width || !canvas.height) {
      fail(
        'canvas_measured',
        `html2canvas produced an empty canvas (${canvas.width}×${canvas.height})`,
      );
    }
    recordArabicCoverLetterPdfStage('canvas_measured', `${canvas.width}×${canvas.height}`);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    recordArabicCoverLetterPdfStage('jspdf_created');

    const canvasWidthPx = canvas.width;
    const canvasHeightPx = canvas.height;
    const pageHeightPx = Math.round(
      (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM) * (canvasWidthPx / scale),
    );
    const scaledPageHeightPx = pageHeightPx * scale;

    if (canvasHeightPx <= scaledPageHeightPx + 4) {
      const img = canvas.toDataURL('image/jpeg', 0.92);
      if (!img || img.length < 32) {
        fail('page_slice_added', 'JPEG image data is empty after single-page capture');
      }
      const heightMm = (canvasHeightPx / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
      pdf.addImage(img, 'JPEG', 0, 0, CV_PDF_A4_WIDTH_MM, Math.min(heightMm, CV_PDF_A4_HEIGHT_MM));
      recordArabicCoverLetterPdfStage('page_slice_added', 'single-page');
    } else {
      let offsetY = 0;
      let pageIndex = 0;
      const CONTINUATION_TOP_PAD_PX = 28;
      const CONTINUATION_BOTTOM_PAD_PX = 12;
      while (offsetY < canvasHeightPx) {
        const remaining = canvasHeightPx - offsetY;
        const sliceHeight = Math.min(scaledPageHeightPx, remaining);
        const topPad = pageIndex === 0 ? 0 : CONTINUATION_TOP_PAD_PX * scale;
        const bottomPad =
          offsetY + sliceHeight < canvasHeightPx ? CONTINUATION_BOTTOM_PAD_PX * scale : 0;
        const padded = buildPaddedPdfSlice(
          canvas,
          offsetY,
          sliceHeight,
          canvasWidthPx,
          topPad,
          bottomPad,
        );
        if (!padded.dataUrl || padded.dataUrl.length < 32) {
          fail('page_slice_added', `Empty slice image at page ${pageIndex}`);
        }
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
        recordArabicCoverLetterPdfStage('page_slice_added', `page=${pageIndex}`);
        offsetY += sliceHeight;
        pageIndex += 1;
      }
    }

    const blob = pdf.output('blob') as Blob;
    recordArabicCoverLetterPdfStage('blob_created', `size=${blob.size}`);

    validatePdfBlob(blob);
    recordArabicCoverLetterPdfStage('blob_validated', `type=${blob.type || 'application/pdf'}`);

    return blob;
  } catch (err) {
    if (err instanceof CoverLetterArabicPdfExportError) throw err;
    const stage =
      getArabicCoverLetterPdfDiagnostics().at(-1)?.stage ?? 'blob_created';
    throw fail(stage, err instanceof Error ? err.message : 'Arabic PDF export failed', err);
  } finally {
    if (nodes?.wrapper.parentNode) {
      nodes.wrapper.remove();
    }
    removeFonts?.();
    recordArabicCoverLetterPdfStage('cleanup_completed');
  }
}
