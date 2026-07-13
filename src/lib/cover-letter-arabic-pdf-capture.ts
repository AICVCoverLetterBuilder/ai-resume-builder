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
export const EXPORT_ROOT_ID = 'cl-arabic-pdf-export-root';
export const PREVIEW_ATTR = 'data-cl-arabic-preview';
export const UNSAFE_CSS_COLOR_RE = /oklch\(|lab\(|lch\(|color-mix\(|var\(--/i;

const A4_PADDING = '56px 60px';

export type CaptureLayoutSnapshot = {
  width: number;
  height: number;
  rect: DOMRect;
  transform: string;
  opacity: string;
  visibility: string;
  display: string;
  overflow: string;
  position: string;
  left: string;
  top: string;
  direction: string;
};

export function applyOpaqueCaptureStyles(el: HTMLElement, width: number, height: number): void {
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.margin = '0';
  el.style.opacity = '1';
  el.style.visibility = 'visible';
  el.style.display = 'block';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.minHeight = `${height}px`;
  el.style.maxWidth = 'none';
  el.style.maxHeight = 'none';
  el.style.overflow = 'visible';
  el.style.transform = 'none';
  el.style.translate = 'none';
  el.style.scale = 'none';
  el.style.rotate = 'none';
  el.style.clipPath = 'none';
  el.style.clip = 'auto';
  el.style.filter = 'none';
  el.style.backdropFilter = 'none';
  el.style.boxShadow = 'none';
  el.style.background = '#ffffff';
  el.style.backgroundColor = '#ffffff';
  el.style.zIndex = '2147483645';
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
    node.style.translate = 'none';
    node.style.scale = 'none';
    node.style.clipPath = 'none';
    node.style.clip = 'auto';
    node.style.filter = 'none';
    node.style.backdropFilter = 'none';
    if (node === cloneRoot) {
      node.style.position = 'fixed';
      node.style.top = '0';
      node.style.left = '0';
      node.style.background = '#ffffff';
      node.style.backgroundColor = '#ffffff';
    }
    node = node.parentElement;
  }
  sanitizeCloneSubtree(cloneRoot);
}

function sanitizeCloneSubtree(root: HTMLElement): void {
  const walk = (el: HTMLElement) => {
    const styleText = el.getAttribute('style') ?? '';
    if (UNSAFE_CSS_COLOR_RE.test(styleText)) {
      el.style.color = '#111111';
      el.style.backgroundColor = el === root ? '#ffffff' : 'transparent';
      el.style.borderColor = '#111111';
    }
    el.style.filter = 'none';
    el.style.backdropFilter = 'none';
    el.style.boxShadow = 'none';
    el.style.transform = 'none';
    for (const child of Array.from(el.children)) {
      if (child instanceof HTMLElement) walk(child);
    }
  };
  walk(root);
}

export function collectCaptureLayout(element: HTMLElement): CaptureLayoutSnapshot {
  void element.offsetHeight;
  const rect = element.getBoundingClientRect();
  const cs = getComputedStyle(element);
  return {
    width: Math.round(Math.max(element.scrollWidth, element.offsetWidth, rect.width)),
    height: Math.round(Math.max(element.scrollHeight, element.offsetHeight, rect.height)),
    rect,
    transform: cs.transform || 'none',
    opacity: cs.opacity || '1',
    visibility: cs.visibility || 'visible',
    display: cs.display || 'block',
    overflow: cs.overflow || 'visible',
    position: cs.position || 'static',
    left: cs.left || '0px',
    top: cs.top || '0px',
    direction: cs.direction || 'rtl',
  };
}

export function recordRootMetrics(
  element: HTMLElement,
  elementId = EXPORT_ROOT_ID,
): { width: number; height: number } {
  const snapshot = collectCaptureLayout(element);
  updateArabicCoverLetterPdfMetrics({
    measuredElementId: elementId,
    rootOffsetWidth: element.offsetWidth,
    rootOffsetHeight: element.offsetHeight,
    rootScrollWidth: element.scrollWidth,
    rootScrollHeight: element.scrollHeight,
    rootBoundingRect: `${Math.round(snapshot.rect.width)}x${Math.round(snapshot.rect.height)}@${Math.round(snapshot.rect.x)},${Math.round(snapshot.rect.y)}`,
    rootOpacity: snapshot.opacity,
    rootTransform: snapshot.transform,
    rootPosition: snapshot.position,
    rootLeft: snapshot.left,
    rootTop: snapshot.top,
    rootVisibility: snapshot.visibility,
    rootDisplay: snapshot.display,
    rootOverflow: snapshot.overflow,
    rootDirection: snapshot.direction,
  });
  return { width: snapshot.width, height: snapshot.height };
}

export function validateCaptureRootLayout(
  element: HTMLElement,
  expectedWidth: number,
  expectedHeight: number,
): CaptureLayoutSnapshot {
  const snapshot = collectCaptureLayout(element);
  recordRootMetrics(element);
  updateArabicCoverLetterPdfMetrics({
    finalCaptureWidth: expectedWidth,
    finalCaptureHeight: expectedHeight,
  });

  if (snapshot.rect.x < 0 || snapshot.rect.y < 0) {
    throw new Error(
      `Export root has negative bounding rect (${Math.round(snapshot.rect.x)},${Math.round(snapshot.rect.y)})`,
    );
  }
  const transform = snapshot.transform || 'none';
  if (transform !== 'none' && transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
    throw new Error(`Export root transform must be none (got ${transform})`);
  }
  if (snapshot.opacity !== '1') {
    throw new Error(`Export root opacity must be 1 (got ${snapshot.opacity})`);
  }
  if (snapshot.visibility !== 'visible') {
    throw new Error(`Export root visibility must be visible (got ${snapshot.visibility})`);
  }
  if (snapshot.display === 'none') {
    throw new Error('Export root display must not be none');
  }
  // jsdom often reports 0 offset sizes; skip strict size match when layout is incomplete.
  const hasRealLayout = element.offsetWidth > 0 || element.offsetHeight > 0;
  if (hasRealLayout) {
    if (Math.abs(element.offsetWidth - expectedWidth) > 2 && Math.abs(snapshot.width - expectedWidth) > 2) {
      throw new Error(
        `Export root width mismatch (measured ${snapshot.width}/${element.offsetWidth}, expected ${expectedWidth})`,
      );
    }
    if (Math.abs(element.offsetHeight - expectedHeight) > 2 && Math.abs(snapshot.height - expectedHeight) > 2) {
      throw new Error(
        `Export root height mismatch (measured ${element.offsetHeight}/${snapshot.height}, expected ${expectedHeight})`,
      );
    }
  }
  return snapshot;
}

export async function waitForStableLayout(element: HTMLElement): Promise<{ width: number; height: number }> {
  applyOpaqueCaptureStyles(element, A4_WIDTH_PX, A4_MIN_HEIGHT_PX);
  element.style.height = 'auto';
  element.style.minHeight = `${A4_MIN_HEIGHT_PX}px`;
  void element.offsetHeight;

  recordArabicCoverLetterPdfStage('first_layout_measurement');
  const scrollHeight = Math.max(element.scrollHeight, A4_MIN_HEIGHT_PX);
  const firstWidth = A4_WIDTH_PX;
  const firstHeight = scrollHeight;
  applyOpaqueCaptureStyles(element, firstWidth, firstHeight);
  recordRootMetrics(element);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  recordArabicCoverLetterPdfStage('second_layout_measurement');
  const secondScroll = Math.max(element.scrollHeight, A4_MIN_HEIGHT_PX);
  const secondWidth = A4_WIDTH_PX;
  const secondHeight = secondScroll;
  applyOpaqueCaptureStyles(element, secondWidth, secondHeight);
  void element.offsetHeight;
  recordRootMetrics(element);

  if (Math.abs(firstHeight - secondHeight) > 2) {
    await new Promise((r) => setTimeout(r, 50));
    const thirdHeight = Math.max(element.scrollHeight, A4_MIN_HEIGHT_PX);
    applyOpaqueCaptureStyles(element, A4_WIDTH_PX, thirdHeight);
    void element.offsetHeight;
    recordRootMetrics(element);
    recordArabicCoverLetterPdfStage('layout_stable', `${A4_WIDTH_PX}x${thirdHeight}`);
    updateArabicCoverLetterPdfMetrics({
      finalCaptureWidth: A4_WIDTH_PX,
      finalCaptureHeight: thirdHeight,
    });
    return { width: A4_WIDTH_PX, height: thirdHeight };
  }

  recordArabicCoverLetterPdfStage('layout_stable', `${secondWidth}x${secondHeight}`);
  updateArabicCoverLetterPdfMetrics({
    finalCaptureWidth: secondWidth,
    finalCaptureHeight: secondHeight,
  });
  return { width: secondWidth, height: secondHeight };
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

export type IsolatedExportOptions = {
  simplified?: boolean;
};

function appendTextParagraph(root: HTMLElement, text: string, simplified: boolean): void {
  const p = document.createElement('p');
  p.setAttribute('dir', 'rtl');
  if (simplified) {
    p.style.cssText =
      'margin:0 0 12px 0;padding:0;color:#111111;font-weight:400;text-align:right;direction:rtl;';
  } else {
    p.style.cssText =
      'margin:0 0 10px 0;padding:0;color:#111111;font-weight:400;text-align:right;direction:rtl;unicode-bidi:plaintext;';
  }
  p.textContent = text;
  root.appendChild(p);
}

/**
 * Minimal isolated Arabic export document — no Tailwind/app classes, no preview clone.
 * Appended directly to document.body with position:fixed at 0,0.
 */
export function buildIsolatedArabicExportRoot(
  candidateName: string,
  content: string,
  locale: string,
  options: IsolatedExportOptions = {},
): { root: HTMLDivElement } {
  const simplified = Boolean(options.simplified);
  const paragraphs = computeCoverLetterPdfParagraphs(content, candidateName);
  const dateStr = formatCoverLetterDate(locale);

  const root = document.createElement('div');
  root.id = EXPORT_ROOT_ID;
  root.setAttribute(EXPORT_ROOT_ATTR, 'true');
  root.setAttribute('dir', 'rtl');
  root.setAttribute('data-cl-arabic-isolated', simplified ? 'simplified' : 'primary');

  if (simplified) {
    root.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      `width:${A4_WIDTH_PX}px`,
      `min-height:${A4_MIN_HEIGHT_PX}px`,
      'height:auto',
      'margin:0',
      `padding:${A4_PADDING}`,
      'box-sizing:border-box',
      'transform:none',
      'opacity:1',
      'visibility:visible',
      'display:block',
      'overflow:visible',
      'z-index:2147483645',
      'pointer-events:none',
      'background:#ffffff',
      'color:#111111',
      `font-family:${ARABIC_BODY_FONT}`,
      'font-size:11pt',
      'font-weight:400',
      'line-height:1.6',
      'direction:rtl',
      'text-align:right',
    ].join(';');
  } else {
    root.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      `width:${A4_WIDTH_PX}px`,
      `min-height:${A4_MIN_HEIGHT_PX}px`,
      'height:auto',
      'margin:0',
      `padding:${A4_PADDING}`,
      'box-sizing:border-box',
      'transform:none',
      'translate:none',
      'scale:none',
      'opacity:1',
      'visibility:visible',
      'display:block',
      'overflow:visible',
      'z-index:2147483645',
      'pointer-events:none',
      'background:#ffffff',
      'color:#111111',
      `font-family:${ARABIC_BODY_FONT}`,
      'font-size:11pt',
      'font-weight:400',
      'line-height:1.6',
      'direction:rtl',
      'text-align:right',
      'unicode-bidi:plaintext',
    ].join(';');
  }

  const dateEl = document.createElement('div');
  dateEl.setAttribute('dir', 'rtl');
  dateEl.style.cssText = simplified
    ? 'margin:0 0 20px 0;padding:0;color:#111111;font-size:11pt;font-weight:400;text-align:right;direction:rtl;'
    : 'margin:0 0 20px 0;padding:0;color:#4B5563;font-size:11pt;font-weight:400;text-align:right;direction:rtl;unicode-bidi:plaintext;';
  dateEl.textContent = dateStr;
  root.appendChild(dateEl);

  for (const para of paragraphs) {
    appendTextParagraph(root, para, simplified);
  }

  return { root };
}

/** @deprecated Prefer buildIsolatedArabicExportRoot — kept for callers expecting mount wrapper. */
export function buildOpaqueExportRoot(
  candidateName: string,
  content: string,
  locale: string,
): { mount: HTMLDivElement; root: HTMLDivElement } {
  const { root } = buildIsolatedArabicExportRoot(candidateName, content, locale);
  const mount = document.createElement('div');
  mount.setAttribute('data-cl-arabic-pdf-mount', 'true');
  mount.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483645;';
  mount.appendChild(root);
  return { mount, root };
}

export function inlineStylesAreCaptureSafe(styleText: string): boolean {
  if (!styleText) return true;
  return !UNSAFE_CSS_COLOR_RE.test(styleText);
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
