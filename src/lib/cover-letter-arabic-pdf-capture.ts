import {
  recordArabicCoverLetterPdfStage,
  updateArabicCoverLetterPdfMetrics,
} from './cover-letter-arabic-pdf-diagnostics';
import { computeCoverLetterPdfParagraphs, formatCoverLetterDate } from './cover-letter-pdf';
import { CV_PDF_A4_HEIGHT_MM, CV_PDF_A4_WIDTH_MM } from './export';

export const A4_WIDTH_PX = Math.round((CV_PDF_A4_WIDTH_MM * 96) / 25.4);
export const A4_MIN_HEIGHT_PX = Math.round((CV_PDF_A4_HEIGHT_MM * 96) / 25.4);
export const ARABIC_BODY_FONT = "'NotoSansArabic','Noto Sans Arabic',sans-serif";
export const MIN_NON_WHITE_RATIO = 0.0015;
export const EXPORT_ROOT_ATTR = 'data-cl-arabic-export-root';
export const PREVIEW_ATTR = 'data-cl-arabic-preview';

export function applyOpaqueCaptureStyles(el: HTMLElement, width: number, height: number): void {
  el.style.opacity = '1';
  el.style.visibility = 'visible';
  el.style.display = 'block';
  el.style.position = 'absolute';
  el.style.top = '0';
  el.style.left = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.minHeight = `${height}px`;
  el.style.maxWidth = 'none';
  el.style.maxHeight = 'none';
  el.style.overflow = 'visible';
  el.style.transform = 'none';
  el.style.clipPath = 'none';
  el.style.clip = 'auto';
  el.style.background = '#ffffff';
  el.style.backgroundColor = '#ffffff';
  el.style.zIndex = '1';
  el.style.pointerEvents = 'none';
  el.style.boxSizing = 'border-box';
}

export function forceCloneCaptureStyles(clonedDocument: Document, rootSelector: string): void {
  const cloneRoot = clonedDocument.querySelector(rootSelector) as HTMLElement | null;
  if (!cloneRoot) return;
  let node: HTMLElement | null = cloneRoot;
  while (node) {
    node.style.opacity = '1';
    node.style.visibility = 'visible';
    node.style.display = node === cloneRoot ? 'block' : node.style.display || 'block';
    node.style.transform = 'none';
    node.style.clipPath = 'none';
    node.style.clip = 'auto';
    node.style.filter = 'none';
    if (node === cloneRoot) {
      node.style.background = '#ffffff';
      node.style.backgroundColor = '#ffffff';
    }
    node = node.parentElement;
  }
}

export function measureRoot(element: HTMLElement): { width: number; height: number; rect: DOMRect } {
  void element.offsetHeight;
  const rect = element.getBoundingClientRect();
  const width = Math.max(element.scrollWidth, element.offsetWidth, rect.width, A4_WIDTH_PX);
  const height = Math.max(element.scrollHeight, element.offsetHeight, rect.height, A4_MIN_HEIGHT_PX);
  return { width, height, rect };
}

export function recordRootMetrics(element: HTMLElement): { width: number; height: number } {
  const { width, height, rect } = measureRoot(element);
  updateArabicCoverLetterPdfMetrics({
    rootOffsetWidth: element.offsetWidth,
    rootOffsetHeight: element.offsetHeight,
    rootScrollWidth: element.scrollWidth,
    rootScrollHeight: element.scrollHeight,
    rootBoundingRect: `${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.left)},${Math.round(rect.top)}`,
    rootOpacity: getComputedStyle(element).opacity,
  });
  return { width, height };
}

export async function waitForStableLayout(element: HTMLElement): Promise<{ width: number; height: number }> {
  recordArabicCoverLetterPdfStage('first_layout_measurement');
  const first = recordRootMetrics(element);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  recordArabicCoverLetterPdfStage('second_layout_measurement');
  const second = recordRootMetrics(element);
  applyOpaqueCaptureStyles(element, second.width, second.height);
  void element.offsetHeight;
  if (Math.abs(first.width - second.width) > 2 || Math.abs(first.height - second.height) > 2) {
    await new Promise((r) => setTimeout(r, 50));
    const third = recordRootMetrics(element);
    applyOpaqueCaptureStyles(element, third.width, third.height);
    recordArabicCoverLetterPdfStage('layout_stable', `${third.width}x${third.height}`);
    return third;
  }
  recordArabicCoverLetterPdfStage('layout_stable', `${second.width}x${second.height}`);
  return second;
}

export function analyzeCanvasPixels(canvas: HTMLCanvasElement): {
  nonWhiteCount: number;
  sampled: number;
  ratio: number;
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { nonWhiteCount: 0, sampled: 0, ratio: 0 };
  const sampleStep = Math.max(4, Math.floor(canvas.width / 80));
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let nonWhiteCount = 0;
  let sampled = 0;
  for (let y = 0; y < canvas.height; y += sampleStep) {
    for (let x = 0; x < canvas.width; x += sampleStep) {
      const i = (y * canvas.width + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 8) continue;
      sampled += 1;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r < 248 || g < 248 || b < 248) nonWhiteCount += 1;
    }
  }
  return { nonWhiteCount, sampled, ratio: sampled > 0 ? nonWhiteCount / sampled : 0 };
}

export function createExportOverlay(): HTMLDivElement {
  const overlay = document.createElement('div');
  overlay.setAttribute('data-cl-arabic-pdf-overlay', 'true');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:#ffffff;opacity:1;pointer-events:none;';
  document.body.appendChild(overlay);
  return overlay;
}

export function tryResolvePreviewRoot(): HTMLElement | null {
  const preview = document.getElementById('cl-preview');
  if (!preview || preview.getAttribute(PREVIEW_ATTR) !== 'true') return null;
  if (!preview.textContent?.trim()) return null;
  if (preview.getBoundingClientRect().width <= 0 || preview.getBoundingClientRect().height <= 0) return null;
  return preview;
}

export function buildOpaqueExportRoot(
  candidateName: string,
  content: string,
  locale: string,
): { mount: HTMLDivElement; root: HTMLDivElement } {
  const paragraphs = computeCoverLetterPdfParagraphs(content, candidateName);
  const dateStr = formatCoverLetterDate(locale);
  const mount = document.createElement('div');
  mount.setAttribute('data-cl-arabic-pdf-mount', 'true');
  mount.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:visible;pointer-events:none;z-index:2147483646;opacity:1;visibility:visible;display:block;background:transparent;';
  const root = document.createElement('div');
  root.setAttribute(EXPORT_ROOT_ATTR, 'true');
  root.setAttribute('dir', 'rtl');
  root.style.cssText = `width:${A4_WIDTH_PX}px;min-height:${A4_MIN_HEIGHT_PX}px;box-sizing:border-box;padding:56px 60px;background:#ffffff;color:#1F2937;font-family:${ARABIC_BODY_FONT};font-size:11pt;line-height:1.6;direction:rtl;text-align:right;unicode-bidi:plaintext;opacity:1;visibility:visible;display:block;`;
  const dateEl = document.createElement('div');
  dateEl.setAttribute('dir', 'rtl');
  dateEl.style.cssText = 'margin-bottom:20px;color:#4B5563;font-size:11pt;text-align:right;direction:rtl;unicode-bidi:plaintext;opacity:1;';
  dateEl.textContent = dateStr;
  root.appendChild(dateEl);
  for (const para of paragraphs) {
    const p = document.createElement('p');
    p.setAttribute('dir', 'rtl');
    p.style.cssText = 'margin:0 0 10px 0;text-align:right;direction:rtl;unicode-bidi:plaintext;opacity:1;';
    p.textContent = para;
    root.appendChild(p);
  }
  mount.appendChild(root);
  return { mount, root };
}

export function clonePreviewToExportRoot(preview: HTMLElement): { mount: HTMLDivElement; root: HTMLDivElement } {
  const mount = document.createElement('div');
  mount.setAttribute('data-cl-arabic-pdf-mount', 'true');
  mount.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:visible;pointer-events:none;z-index:2147483646;opacity:1;visibility:visible;display:block;background:transparent;';
  const root = document.createElement('div');
  root.setAttribute(EXPORT_ROOT_ATTR, 'true');
  root.setAttribute('dir', 'rtl');
  root.setAttribute(PREVIEW_ATTR, 'true');
  root.innerHTML = preview.innerHTML;
  const computed = getComputedStyle(preview);
  root.style.cssText = `width:${Math.max(preview.scrollWidth, A4_WIDTH_PX)}px;box-sizing:border-box;padding:56px 60px;background:#ffffff;color:#1F2937;font-family:${computed.fontFamily || ARABIC_BODY_FONT};font-size:${computed.fontSize || '11pt'};line-height:${computed.lineHeight || '1.6'};direction:rtl;text-align:right;unicode-bidi:plaintext;white-space:pre-line;opacity:1;visibility:visible;display:block;border:none;box-shadow:none;`;
  mount.appendChild(root);
  return { mount, root };
}

export function buildPaddedPngSlice(
  pdfCanvas: HTMLCanvasElement,
  offsetY: number,
  sliceHeight: number,
  canvasWidthPx: number,
  topInsetCanvasPx: number,
  bottomInsetCanvasPx: number,
): { dataUrl: string; paddedHeightPx: number } {
  const safeTop = Math.max(0, Math.round(topInsetCanvasPx));
  const safeBottom = Math.max(0, Math.round(bottomInsetCanvasPx));
  const paddedHeightPx = sliceHeight + safeTop + safeBottom;
  const sliceCanvas = document.createElement('canvas');
  sliceCanvas.width = canvasWidthPx;
  sliceCanvas.height = paddedHeightPx;
  const ctx = sliceCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidthPx, paddedHeightPx);
    ctx.drawImage(pdfCanvas, 0, offsetY, canvasWidthPx, sliceHeight, 0, safeTop, canvasWidthPx, sliceHeight);
    if (safeTop > 0) ctx.fillRect(0, 0, canvasWidthPx, safeTop);
  }
  return { dataUrl: sliceCanvas.toDataURL('image/png'), paddedHeightPx };
}
