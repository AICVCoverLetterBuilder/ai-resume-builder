import {
  recordArabicCoverLetterPdfStage,
  updateArabicCoverLetterPdfMetrics,
} from './cover-letter-arabic-pdf-diagnostics';
import { computeCoverLetterPdfParagraphs, formatCoverLetterDate } from './cover-letter-pdf';
import { CV_PDF_A4_HEIGHT_MM, CV_PDF_A4_WIDTH_MM } from './export';

export const A4_WIDTH_PX = Math.round((CV_PDF_A4_WIDTH_MM * 96) / 25.4);
export const A4_MIN_HEIGHT_PX = Math.round((CV_PDF_A4_HEIGHT_MM * 96) / 25.4);
/** Font family registered only inside the clean capture iframe. */
export const ARABIC_CAPTURE_FONT = 'NotoSansArabicCapture';
export const ARABIC_BODY_FONT = `'${ARABIC_CAPTURE_FONT}','NotoSansArabic','Noto Sans Arabic',sans-serif`;
export const MIN_NON_WHITE_RATIO = 0.0015;
export const EXPORT_ROOT_ATTR = 'data-cl-arabic-export-root';
export const EXPORT_ROOT_ID = 'cl-arabic-pdf-export-root';
export const SAFE_STYLE_ID = 'cl-arabic-pdf-capture-style';
export const IFRAME_ATTR = 'data-cl-arabic-pdf-iframe';
export const PREVIEW_ATTR = 'data-cl-arabic-preview';
export const UNSAFE_CSS_COLOR_RE = /oklch\s*\(|lab\s*\(|lch\s*\(|color-mix\s*\(/i;

const COLOR_PROPS = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'column-rule-color',
  'caret-color',
  'fill',
  'stroke',
  'box-shadow',
  'text-shadow',
] as const;

export type UnsafeColorScanResult = {
  passed: boolean;
  offender?: string;
};

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

export type ArabicIframeCaptureContext = {
  iframe: HTMLIFrameElement;
  iframeDocument: Document;
  root: HTMLDivElement;
  fontAbsoluteUrl: string;
};

export function resolveArabicFontAbsoluteUrl(): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/fonts/NotoSansArabic-Regular.ttf`;
}

export function buildIframeSafeCss(fontAbsoluteUrl: string): string {
  return `
@font-face {
  font-family: '${ARABIC_CAPTURE_FONT}';
  font-style: normal;
  font-weight: 400;
  src: url('${fontAbsoluteUrl}') format('truetype');
}
html, body {
  margin: 0;
  padding: 0;
  width: ${A4_WIDTH_PX}px;
  min-height: ${A4_MIN_HEIGHT_PX}px;
  box-sizing: border-box;
  background: #ffffff;
  color: #111111;
  color-scheme: light;
  opacity: 1;
  visibility: visible;
  display: block;
  transform: none;
  filter: none;
  backdrop-filter: none;
  box-shadow: none;
  text-shadow: none;
  direction: rtl;
  text-align: right;
  overflow: visible;
  font-family: '${ARABIC_CAPTURE_FONT}', sans-serif;
  font-size: 11pt;
  font-weight: 400;
  line-height: 1.6;
}
#${EXPORT_ROOT_ID} {
  margin: 0;
  padding: 56px 60px;
  width: ${A4_WIDTH_PX}px;
  min-height: ${A4_MIN_HEIGHT_PX}px;
  box-sizing: border-box;
  background: #ffffff;
  color: #111111;
  opacity: 1;
  visibility: visible;
  display: block;
  transform: none;
  filter: none;
  box-shadow: none;
  text-shadow: none;
  direction: rtl;
  text-align: right;
  overflow: visible;
  font-family: '${ARABIC_CAPTURE_FONT}', sans-serif;
  font-size: 11pt;
  font-weight: 400;
  line-height: 1.6;
}
#${EXPORT_ROOT_ID} p,
#${EXPORT_ROOT_ID} div {
  margin: 0 0 10px 0;
  padding: 0;
  color: #111111;
  background: transparent;
  font-weight: 400;
  text-align: right;
  direction: rtl;
}
#${EXPORT_ROOT_ID} [data-cl-date="true"] {
  margin: 0 0 20px 0;
  color: #4B5563;
}
`.trim();
}

export function inlineStylesAreCaptureSafe(styleText: string): boolean {
  if (!styleText) return true;
  return !UNSAFE_CSS_COLOR_RE.test(styleText);
}

export function scanDocumentForUnsafeColorFunctions(doc: Document): UnsafeColorScanResult {
  const styleEls = Array.from(doc.querySelectorAll('style'));
  for (const styleEl of styleEls) {
    const text = styleEl.textContent ?? '';
    if (UNSAFE_CSS_COLOR_RE.test(text)) {
      const match = text.match(UNSAFE_CSS_COLOR_RE);
      return {
        passed: false,
        offender: `style#${styleEl.id || 'anonymous'}: ${match?.[0] ?? 'unsafe'}`,
      };
    }
  }

  const withStyle = Array.from(doc.querySelectorAll('[style]')) as HTMLElement[];
  for (const el of withStyle) {
    const styleAttr = el.getAttribute('style') ?? '';
    if (UNSAFE_CSS_COLOR_RE.test(styleAttr)) {
      const match = styleAttr.match(UNSAFE_CSS_COLOR_RE);
      return {
        passed: false,
        offender: `${el.tagName.toLowerCase()}[style]: ${match?.[0] ?? 'unsafe'}`,
      };
    }
  }

  const nodes: Element[] = [doc.documentElement, doc.body].filter(Boolean) as Element[];
  const root = doc.getElementById(EXPORT_ROOT_ID);
  if (root) {
    nodes.push(root);
    nodes.push(...Array.from(root.querySelectorAll('*')));
  }

  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    let cs: CSSStyleDeclaration;
    try {
      cs = node.ownerDocument.defaultView?.getComputedStyle(node) ?? getComputedStyle(node);
    } catch {
      continue;
    }
    for (const prop of COLOR_PROPS) {
      const value = cs.getPropertyValue(prop) || (cs as unknown as Record<string, string>)[prop] || '';
      if (value && UNSAFE_CSS_COLOR_RE.test(value)) {
        return {
          passed: false,
          offender: `${node.tagName.toLowerCase()}#${node.id || ''} ${prop}=${value}`,
        };
      }
    }
  }

  return { passed: true };
}

export function recordIframeDocumentMetrics(iframeDocument: Document, root: HTMLElement): void {
  const styleCount = iframeDocument.querySelectorAll('style').length;
  const linkCount = iframeDocument.querySelectorAll('link[rel="stylesheet"]').length;
  const classCount = Array.from(iframeDocument.querySelectorAll('[class]')).filter(
    (el) => (el.getAttribute('class') ?? '').trim().length > 0,
  ).length;
  const owner: 'iframe' | 'main' =
    typeof window !== 'undefined' && root.ownerDocument === window.document ? 'main' : 'iframe';
  updateArabicCoverLetterPdfMetrics({
    targetOwnerDocument: owner,
    iframeStyleElementCount: styleCount,
    iframeStylesheetLinkCount: linkCount,
    iframeClassAttributeCount: classCount,
    measuredElementId: root.id || EXPORT_ROOT_ID,
  });
}

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
  el.style.filter = 'none';
  el.style.boxShadow = 'none';
  el.style.background = '#ffffff';
  el.style.backgroundColor = '#ffffff';
  el.style.color = '#111111';
  el.style.zIndex = '1';
  el.style.pointerEvents = 'none';
  el.style.boxSizing = 'border-box';
}

export function sanitizeClonedIframeDocument(clonedDocument: Document): void {
  clonedDocument.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
  clonedDocument.querySelectorAll('style').forEach((el) => {
    if (el.id !== SAFE_STYLE_ID) el.remove();
  });
  clonedDocument.querySelectorAll('[class]').forEach((el) => el.removeAttribute('class'));

  const forceSafe = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.display = 'block';
    el.style.transform = 'none';
    el.style.filter = 'none';
    el.style.boxShadow = 'none';
    el.style.textShadow = 'none';
    el.style.background = '#ffffff';
    el.style.backgroundColor = '#ffffff';
    el.style.color = '#111111';
  };

  forceSafe(clonedDocument.documentElement);
  forceSafe(clonedDocument.body);
  const root = clonedDocument.getElementById(EXPORT_ROOT_ID);
  forceSafe(root);
  if (root) {
    root.querySelectorAll('*').forEach((child) => {
      if (child instanceof HTMLElement) {
        child.style.color = child.getAttribute('data-cl-date') === 'true' ? '#4B5563' : '#111111';
        child.style.background = 'transparent';
        child.style.backgroundColor = 'transparent';
        child.style.transform = 'none';
        child.style.filter = 'none';
        child.style.boxShadow = 'none';
        child.removeAttribute('class');
      }
    });
  }

  const scan = scanDocumentForUnsafeColorFunctions(clonedDocument);
  if (!scan.passed) {
    const err = new Error(`unsafe_cloned_css: ${scan.offender ?? 'unknown'}`);
    (err as Error & { code?: string }).code = 'unsafe_cloned_css';
    throw err;
  }
}

/** @deprecated Prefer sanitizeClonedIframeDocument — kept for unit tests. */
export function forceCloneCaptureStyles(clonedDocument: Document, _rootSelector: string): void {
  void _rootSelector;
  sanitizeClonedIframeDocument(clonedDocument);
}

export function collectCaptureLayout(element: HTMLElement): CaptureLayoutSnapshot {
  void element.offsetHeight;
  const rect = element.getBoundingClientRect();
  const view = element.ownerDocument.defaultView;
  const cs = view ? view.getComputedStyle(element) : getComputedStyle(element);
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

export function assertTargetBelongsToIframe(element: HTMLElement, iframeDocument: Document): void {
  if (element.ownerDocument !== iframeDocument) {
    throw new Error('Export root must belong to the clean iframe document, not the main application document');
  }
  if (typeof window !== 'undefined' && element.ownerDocument === window.document) {
    throw new Error('Export root ownerDocument must not be the main application document');
  }
  updateArabicCoverLetterPdfMetrics({ targetOwnerDocument: 'iframe' });
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

function waitIframeFrames(iframeWindow: Window | null, count = 2): Promise<void> {
  return new Promise((resolve) => {
    if (!iframeWindow?.requestAnimationFrame) {
      resolve();
      return;
    }
    let remaining = count;
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else iframeWindow.requestAnimationFrame(tick);
    };
    iframeWindow.requestAnimationFrame(tick);
  });
}

export async function waitForIframeStableLayout(
  root: HTMLElement,
  iframeWindow: Window | null,
): Promise<{ width: number; height: number }> {
  root.style.width = `${A4_WIDTH_PX}px`;
  root.style.height = 'auto';
  root.style.minHeight = `${A4_MIN_HEIGHT_PX}px`;
  void root.offsetHeight;

  recordArabicCoverLetterPdfStage('first_layout_measurement');
  const firstHeight = Math.max(root.scrollHeight, A4_MIN_HEIGHT_PX);
  root.style.height = `${firstHeight}px`;
  root.style.minHeight = `${firstHeight}px`;
  recordRootMetrics(root);
  await waitIframeFrames(iframeWindow, 2);

  recordArabicCoverLetterPdfStage('second_layout_measurement');
  const secondHeight = Math.max(root.scrollHeight, A4_MIN_HEIGHT_PX);
  root.style.height = `${secondHeight}px`;
  root.style.minHeight = `${secondHeight}px`;
  void root.offsetHeight;
  recordRootMetrics(root);

  const finalHeight = secondHeight;
  recordArabicCoverLetterPdfStage('iframe_layout_stable', `${A4_WIDTH_PX}x${finalHeight}`);
  recordArabicCoverLetterPdfStage('layout_stable', `${A4_WIDTH_PX}x${finalHeight}`);
  updateArabicCoverLetterPdfMetrics({
    finalCaptureWidth: A4_WIDTH_PX,
    finalCaptureHeight: finalHeight,
  });
  return { width: A4_WIDTH_PX, height: finalHeight };
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

function populateExportRoot(
  doc: Document,
  root: HTMLDivElement,
  candidateName: string,
  content: string,
  locale: string,
): void {
  const paragraphs = computeCoverLetterPdfParagraphs(content, candidateName);
  const dateStr = formatCoverLetterDate(locale);

  const dateEl = doc.createElement('div');
  dateEl.setAttribute('dir', 'rtl');
  dateEl.setAttribute('data-cl-date', 'true');
  dateEl.textContent = dateStr;
  root.appendChild(dateEl);

  for (const para of paragraphs) {
    const p = doc.createElement('p');
    p.setAttribute('dir', 'rtl');
    p.textContent = para;
    root.appendChild(p);
  }
}

/**
 * Minimal isolated export root built in an arbitrary document (iframe preferred).
 * No Tailwind/app classes on root; .cl-date is iframe-local only.
 */
export function buildIsolatedArabicExportRoot(
  candidateName: string,
  content: string,
  locale: string,
  options: { simplified?: boolean; ownerDocument?: Document } = {},
): { root: HTMLDivElement } {
  const doc = options.ownerDocument ?? document;
  const root = doc.createElement('div');
  root.id = EXPORT_ROOT_ID;
  root.setAttribute(EXPORT_ROOT_ATTR, 'true');
  root.setAttribute('dir', 'rtl');
  root.setAttribute('data-cl-arabic-isolated', options.simplified ? 'simplified' : 'primary');
  populateExportRoot(doc, root, candidateName, content, locale);
  return { root };
}

async function awaitIframeReady(iframe: HTMLIFrameElement): Promise<Document> {
  await new Promise<void>((resolve) => {
    if (iframe.contentDocument?.readyState === 'complete') {
      resolve();
      return;
    }
    iframe.addEventListener('load', () => resolve(), { once: true });
    // about:blank can already be interactive
    setTimeout(() => resolve(), 0);
  });
  const doc = iframe.contentDocument;
  if (!doc) throw new Error('iframe.contentDocument unavailable');
  return doc;
}

export async function createArabicCaptureIframe(
  candidateName: string,
  content: string,
  locale: string,
): Promise<ArabicIframeCaptureContext> {
  const fontAbsoluteUrl = resolveArabicFontAbsoluteUrl();
  const iframe = document.createElement('iframe');
  iframe.setAttribute(IFRAME_ATTR, 'true');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Arabic cover letter PDF capture');
  iframe.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    `width:${A4_WIDTH_PX}px`,
    `height:${A4_MIN_HEIGHT_PX}px`,
    'border:0',
    'opacity:1',
    'visibility:visible',
    'background:#ffffff',
    'z-index:2147483645',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(iframe);
  recordArabicCoverLetterPdfStage('iframe_created', `${A4_WIDTH_PX}x${A4_MIN_HEIGHT_PX}`);

  const iframeDocument = await awaitIframeReady(iframe);
  const safeCss = buildIframeSafeCss(fontAbsoluteUrl);
  iframeDocument.open();
  iframeDocument.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8"/>
<meta name="color-scheme" content="light"/>
<title>Arabic CL PDF Capture</title>
<style id="${SAFE_STYLE_ID}">${safeCss}</style>
</head>
<body></body>
</html>`);
  iframeDocument.close();
  recordArabicCoverLetterPdfStage('iframe_document_written');

  const { root } = buildIsolatedArabicExportRoot(candidateName, content, locale, {
    ownerDocument: iframeDocument,
  });
  iframeDocument.body.appendChild(root);
  recordIframeDocumentMetrics(iframeDocument, root);
  updateArabicCoverLetterPdfMetrics({ iframeFontAbsoluteUrl: fontAbsoluteUrl });

  return { iframe, iframeDocument, root, fontAbsoluteUrl };
}

export async function loadArabicFontsInIframe(
  iframeDocument: Document,
  iframeWindow: Window | null,
  fontAbsoluteUrl: string,
): Promise<void> {
  recordArabicCoverLetterPdfStage('iframe_font_loading_started', fontAbsoluteUrl);
  recordArabicCoverLetterPdfStage('font_loading_started', fontAbsoluteUrl);
  const fonts = iframeDocument.fonts;
  if (fonts?.load) {
    try {
      await fonts.load(`400 11pt ${ARABIC_CAPTURE_FONT}`);
      await fonts.ready;
    } catch {
      // non-fatal; scan/check records result
    }
  }
  const fontCheckPassed = fonts?.check ? fonts.check(`400 11pt ${ARABIC_CAPTURE_FONT}`) : true;
  updateArabicCoverLetterPdfMetrics({
    iframeFontCheckPassed: fontCheckPassed,
    fontCheckPassed,
    iframeFontAbsoluteUrl: fontAbsoluteUrl,
  });
  recordArabicCoverLetterPdfStage('font_check_result', fontCheckPassed ? 'passed' : 'failed');
  recordArabicCoverLetterPdfStage('iframe_font_loading_completed', fontCheckPassed ? 'passed' : 'failed');
  recordArabicCoverLetterPdfStage('font_loading_completed', fontCheckPassed ? 'passed' : 'failed');
  await waitIframeFrames(iframeWindow, 2);
}

export function runUnsafeColorScanOrThrow(doc: Document): void {
  const scan = scanDocumentForUnsafeColorFunctions(doc);
  updateArabicCoverLetterPdfMetrics({
    unsafeColorFunctionScanResult: scan.passed ? 'passed' : `failed:${scan.offender ?? 'unknown'}`,
    unsafeColorOffender: scan.offender,
  });
  recordArabicCoverLetterPdfStage(
    'unsafe_css_scan_completed',
    scan.passed ? 'passed' : scan.offender ?? 'failed',
  );
  if (!scan.passed) {
    const err = new Error(`Unsafe color function in capture document: ${scan.offender ?? 'unknown'}`);
    (err as Error & { code?: string }).code = 'unsafe_css';
    throw err;
  }
}

export function isUnsupportedColorFunctionError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /unsupported color function|oklch|lab\(|lch\(|color-mix/i.test(message);
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
