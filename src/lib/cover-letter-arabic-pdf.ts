/**
 * Arabic cover-letter PDF via html2canvas (isolated opaque root; no Android preview clone).
 */
import { Capacitor } from '@capacitor/core';
import { ensureNotoFontsForHtmlCapture, CV_PDF_A4_HEIGHT_MM, CV_PDF_A4_WIDTH_MM } from './export';
import {
  CoverLetterArabicPdfExportError,
  getArabicCoverLetterPdfDiagnostics,
  getArabicCoverLetterPdfMetrics,
  recordArabicCoverLetterPdfStage,
  recordHtml2CanvasCause,
  updateArabicCoverLetterPdfMetrics,
  type ArabicCoverLetterPdfStage,
} from './cover-letter-arabic-pdf-diagnostics';
import {
  ARABIC_BODY_FONT,
  EXPORT_ROOT_ATTR,
  EXPORT_ROOT_ID,
  MIN_NON_WHITE_RATIO,
  analyzeCanvasPixels,
  buildIsolatedArabicExportRoot,
  buildPaddedPngSlice,
  createExportOverlay,
  forceCloneCaptureStyles,
  tryResolvePreviewRoot,
  validateCaptureRootLayout,
  waitForStableLayout,
} from './cover-letter-arabic-pdf-capture';

export {
  CoverLetterArabicPdfExportError,
  beginArabicCoverLetterPdfExportTrace,
  copyArabicCoverLetterPdfDiagnosticsToClipboard,
  formatArabicCoverLetterPdfDiagnosticReport,
  getArabicCoverLetterPdfDiagnostics,
  getArabicCoverLetterPdfMetrics,
  getLastArabicCoverLetterPdfError,
  getLastCompletedArabicPdfStage,
  loadPersistedArabicCoverLetterPdfDiagnostics,
  resetArabicCoverLetterPdfDiagnostics,
  recordHtml2CanvasCause,
  type ArabicCoverLetterPdfStage,
} from './cover-letter-arabic-pdf-diagnostics';

export {
  applyOpaqueCaptureStyles,
  analyzeCanvasPixels,
  buildIsolatedArabicExportRoot,
  forceCloneCaptureStyles,
  tryResolvePreviewRoot,
  validateCaptureRootLayout,
  inlineStylesAreCaptureSafe,
} from './cover-letter-arabic-pdf-capture';

const CONTINUATION_TOP_PAD_PX = 28;
const CONTINUATION_BOTTOM_PAD_PX = 12;

export function isAndroidArabicPdfCapture(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

function resolveCaptureScale(simplified: boolean): number {
  if (simplified) return 1;
  return isAndroidArabicPdfCapture() ? 1.5 : 2;
}

function fail(stage: ArabicCoverLetterPdfStage, message: string, cause?: unknown, code?: string): never {
  throw new CoverLetterArabicPdfExportError(stage, message, cause, code);
}

async function ensureArabicFontsReady(): Promise<() => void> {
  recordArabicCoverLetterPdfStage('font_loading_started');
  const cleanup = await ensureNotoFontsForHtmlCapture();
  if (document.fonts?.load) {
    await Promise.all([
      document.fonts.load(`400 11pt ${ARABIC_BODY_FONT}`),
      document.fonts.load(`700 11pt ${ARABIC_BODY_FONT}`),
    ]).catch(() => undefined);
    await document.fonts.ready;
  }
  const fontCheckPassed = document.fonts?.check
    ? document.fonts.check(`400 11pt ${ARABIC_BODY_FONT}`)
    : true;
  updateArabicCoverLetterPdfMetrics({ fontCheckPassed });
  recordArabicCoverLetterPdfStage('font_check_result', fontCheckPassed ? 'passed' : 'failed');
  recordArabicCoverLetterPdfStage('font_loading_completed');
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return cleanup;
}

function validateCanvasHasContent(canvas: HTMLCanvasElement): void {
  if (!canvas.width || !canvas.height) {
    fail('canvas_measured', `html2canvas produced an empty canvas (${canvas.width}×${canvas.height})`, undefined, 'empty_canvas');
  }
  const analysis = analyzeCanvasPixels(canvas);
  updateArabicCoverLetterPdfMetrics({
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    nonWhiteSampledPixels: analysis.sampled,
    nonWhitePixelCount: analysis.nonWhiteCount,
    nonWhitePixelRatio: analysis.ratio,
  });
  recordArabicCoverLetterPdfStage('canvas_pixel_validation_completed', `ratio=${analysis.ratio.toFixed(5)}`);
  if (analysis.ratio < MIN_NON_WHITE_RATIO) {
    fail(
      'canvas_pixel_validation_completed',
      `Canvas is effectively blank (${analysis.nonWhiteCount}/${analysis.sampled} non-white pixels)`,
      undefined,
      'blank_canvas',
    );
  }
}

function encodeCanvasToPng(canvas: HTMLCanvasElement): string {
  recordArabicCoverLetterPdfStage('image_encoding_started', 'image/png');
  const dataUrl = canvas.toDataURL('image/png');
  if (!dataUrl?.startsWith('data:image/png') || dataUrl.length < 128) {
    fail('image_encoding_completed', 'PNG data URL missing or invalid', undefined, 'invalid_image');
  }
  updateArabicCoverLetterPdfMetrics({ imageMime: 'image/png', imageDataUrlLength: dataUrl.length });
  recordArabicCoverLetterPdfStage('image_encoding_completed', `len=${dataUrl.length}`);
  return dataUrl;
}

async function validatePdfBlob(blob: Blob, expectedPageCount: number): Promise<void> {
  if (!blob?.size) fail('pdf_blob_validated', 'PDF blob is empty', undefined, 'empty_pdf');
  const mime = blob.type || 'application/pdf';
  const header = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const pdfSignatureValid = String.fromCharCode(...header).startsWith('%PDF');
  updateArabicCoverLetterPdfMetrics({
    pdfBlobSize: blob.size,
    pdfBlobMime: mime,
    pdfSignatureValid,
    generatedPageCount: expectedPageCount,
  });
  if (mime !== 'application/pdf') fail('pdf_blob_validated', `Unexpected PDF MIME: ${mime}`, undefined, 'invalid_pdf_mime');
  if (!pdfSignatureValid) fail('pdf_blob_validated', 'Invalid PDF signature', undefined, 'invalid_pdf_signature');
  recordArabicCoverLetterPdfStage('pdf_blob_validated', `size=${blob.size}`);
}

function describeTargetStyles(element: HTMLElement): string {
  const cs = getComputedStyle(element);
  return [
    `position=${cs.position}`,
    `left=${cs.left}`,
    `top=${cs.top}`,
    `transform=${cs.transform}`,
    `opacity=${cs.opacity}`,
    `visibility=${cs.visibility}`,
    `display=${cs.display}`,
    `overflow=${cs.overflow}`,
    `direction=${cs.direction}`,
  ].join(';');
}

type Html2CanvasFn = (
  element: HTMLElement,
  options?: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;

function buildHtml2CanvasOptions(
  captureWidth: number,
  captureHeight: number,
  scale: number,
  androidSafe: boolean,
): Record<string, unknown> {
  const rootSelector = `[${EXPORT_ROOT_ATTR}="true"]`;
  return {
    scale,
    useCORS: true,
    allowTaint: !androidSafe,
    backgroundColor: '#ffffff',
    logging: false,
    foreignObjectRendering: false,
    scrollX: 0,
    scrollY: 0,
    width: captureWidth,
    height: captureHeight,
    windowWidth: Math.max(captureWidth, typeof window !== 'undefined' ? window.innerWidth : captureWidth),
    windowHeight: Math.max(captureHeight, typeof window !== 'undefined' ? window.innerHeight : captureHeight),
    onclone: (doc: Document) => forceCloneCaptureStyles(doc, rootSelector),
  };
}

async function runHtml2CanvasCapture(
  html2canvasFn: Html2CanvasFn,
  captureRoot: HTMLElement,
  captureWidth: number,
  captureHeight: number,
  scale: number,
  androidSafe: boolean,
  isRetry: boolean,
): Promise<HTMLCanvasElement> {
  const options = buildHtml2CanvasOptions(captureWidth, captureHeight, scale, androidSafe);
  updateArabicCoverLetterPdfMetrics({
    html2canvasOptionsSummary: `scale=${scale};w=${captureWidth};h=${captureHeight};allowTaint=${options.allowTaint};foreignObjectRendering=false;x/y=omitted`,
  });
  recordArabicCoverLetterPdfStage(
    isRetry ? 'html2canvas_retry_started' : 'html2canvas_started',
    `scale=${scale} ${captureWidth}x${captureHeight}`,
  );
  try {
    return await html2canvasFn(captureRoot, options);
  } catch (captureErr) {
    const rect = captureRoot.getBoundingClientRect();
    recordHtml2CanvasCause(captureErr, {
      isRetry,
      targetRect: `${Math.round(rect.width)}x${Math.round(rect.height)}@${Math.round(rect.x)},${Math.round(rect.y)}`,
      targetStyles: describeTargetStyles(captureRoot),
    });
    // Re-throw the original cause so callers can retry without recording a wrapper lastError yet.
    throw captureErr;
  }
}

function wrapHtml2CanvasFailure(err: unknown): never {
  const causeMessage = err instanceof Error ? err.message : String(err);
  fail(
    'html2canvas_completed',
    `html2canvas capture failed: ${causeMessage}`,
    err,
    'html2canvas_error',
  );
}

function canvasToPdfBlob(
  canvas: HTMLCanvasElement,
  scale: number,
  jsPDF: typeof import('jspdf').jsPDF,
): Blob {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  recordArabicCoverLetterPdfStage('jspdf_created');

  const canvasWidthPx = canvas.width;
  const canvasHeightPx = canvas.height;
  const pageHeightPx = Math.round((CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM) * (canvasWidthPx / scale));
  const scaledPageHeightPx = pageHeightPx * scale;
  const expectedPageCount = canvasHeightPx <= scaledPageHeightPx + 4 ? 1 : Math.ceil(canvasHeightPx / scaledPageHeightPx);
  updateArabicCoverLetterPdfMetrics({ expectedPageCount });

  let generatedPageCount = 0;
  if (canvasHeightPx <= scaledPageHeightPx + 4) {
    recordArabicCoverLetterPdfStage('page_slice_started', 'single');
    const img = encodeCanvasToPng(canvas);
    const heightMm = (canvasHeightPx / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
    pdf.addImage(img, 'PNG', 0, 0, CV_PDF_A4_WIDTH_MM, Math.min(heightMm, CV_PDF_A4_HEIGHT_MM));
    generatedPageCount = 1;
    recordArabicCoverLetterPdfStage('page_slice_completed', 'page=0');
  } else {
    let offsetY = 0;
    let pageIndex = 0;
    while (offsetY < canvasHeightPx) {
      recordArabicCoverLetterPdfStage('page_slice_started', `page=${pageIndex}`);
      const sliceHeight = Math.min(scaledPageHeightPx, canvasHeightPx - offsetY);
      const topPad = pageIndex === 0 ? 0 : CONTINUATION_TOP_PAD_PX * scale;
      const bottomPad = offsetY + sliceHeight < canvasHeightPx ? CONTINUATION_BOTTOM_PAD_PX * scale : 0;
      const padded = buildPaddedPngSlice(canvas, offsetY, sliceHeight, canvasWidthPx, topPad, bottomPad);
      if (!padded.dataUrl || padded.dataUrl.length < 128) {
        fail('page_slice_completed', `Empty PNG slice page ${pageIndex}`, undefined, 'invalid_image');
      }
      const sliceHeightMm = (padded.paddedHeightPx / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(padded.dataUrl, 'PNG', 0, 0, CV_PDF_A4_WIDTH_MM, Math.min(sliceHeightMm, CV_PDF_A4_HEIGHT_MM));
      generatedPageCount += 1;
      recordArabicCoverLetterPdfStage('page_slice_completed', `page=${pageIndex}`);
      offsetY += sliceHeight;
      pageIndex += 1;
    }
  }

  updateArabicCoverLetterPdfMetrics({ generatedPageCount });
  const blob = pdf.output('blob') as Blob;
  recordArabicCoverLetterPdfStage('pdf_blob_created', `size=${blob.size}`);
  return blob;
}

/**
 * Android never clones #cl-preview. Isolated root is the only strategy.
 */
export function resolveArabicPdfCaptureStrategy(_previewAvailable: boolean): 'isolated-primary' {
  void _previewAvailable;
  return 'isolated-primary';
}

export async function buildArabicCoverLetterPdfBlob(
  candidateName: string,
  content: string,
  locale = 'ar',
): Promise<Blob> {
  recordArabicCoverLetterPdfStage('export_entered');
  if (typeof document === 'undefined') fail('export_entered', 'Browser environment required');
  const probe = content?.trim();
  if (!probe) fail('source_content_validated', 'Empty content');
  recordArabicCoverLetterPdfStage('source_content_validated', `${probe.length} chars`);

  let removeFonts: (() => void) | null = null;
  let captureRoot: HTMLElement | null = null;
  let overlay: HTMLDivElement | null = null;
  const android = isAndroidArabicPdfCapture();
  let usedScale = resolveCaptureScale(false);

  try {
    const [{ default: html2canvasMod }, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const html2canvasFn = (
      (html2canvasMod as { default?: typeof import('html2canvas').default }).default ?? html2canvasMod
    ) as Html2CanvasFn;
    const jsPDF = (jspdfMod.jsPDF ?? jspdfMod.default) as typeof import('jspdf').jsPDF;
    if (typeof html2canvasFn !== 'function') fail('export_entered', 'html2canvas unavailable');

    const strategy = resolveArabicPdfCaptureStrategy(Boolean(tryResolvePreviewRoot()));
    updateArabicCoverLetterPdfMetrics({ captureStrategy: strategy });
    const built = buildIsolatedArabicExportRoot(candidateName, content, locale, { simplified: false });
    captureRoot = built.root;
    recordArabicCoverLetterPdfStage('export_root_created', strategy);

    overlay = createExportOverlay();
    document.body.appendChild(captureRoot);
    recordArabicCoverLetterPdfStage('export_root_attached', EXPORT_ROOT_ID);

    removeFonts = await ensureArabicFontsReady();
    const { width: captureWidth, height: captureHeight } = await waitForStableLayout(captureRoot);
    try {
      validateCaptureRootLayout(captureRoot, captureWidth, captureHeight);
    } catch (layoutErr) {
      recordArabicCoverLetterPdfStage(
        'layout_validation_failed',
        layoutErr instanceof Error ? layoutErr.message : String(layoutErr),
      );
      fail(
        'layout_validation_failed',
        layoutErr instanceof Error ? layoutErr.message : 'Layout validation failed',
        layoutErr,
        'invalid_layout',
      );
    }
    recordArabicCoverLetterPdfStage('export_root_styles_applied', `opacity=1 ${captureWidth}x${captureHeight}@0,0`);

    usedScale = resolveCaptureScale(false);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await runHtml2CanvasCapture(
        html2canvasFn,
        captureRoot,
        captureWidth,
        captureHeight,
        usedScale,
        android,
        false,
      );
    } catch (_primaryErr) {
      // One controlled simplified retry after recording the original html2canvas cause.
      void _primaryErr;
      recordArabicCoverLetterPdfStage('html2canvas_retry_started', 'isolated-simplified-retry');
      captureRoot.remove();
      const retryBuilt = buildIsolatedArabicExportRoot(candidateName, content, locale, { simplified: true });
      captureRoot = retryBuilt.root;
      document.body.appendChild(captureRoot);
      updateArabicCoverLetterPdfMetrics({ captureStrategy: 'isolated-simplified-retry' });
      const retryLayout = await waitForStableLayout(captureRoot);
      try {
        validateCaptureRootLayout(captureRoot, retryLayout.width, retryLayout.height);
      } catch (layoutErr) {
        recordArabicCoverLetterPdfStage(
          'layout_validation_failed',
          layoutErr instanceof Error ? layoutErr.message : String(layoutErr),
        );
        fail(
          'layout_validation_failed',
          layoutErr instanceof Error ? layoutErr.message : 'Retry layout validation failed',
          layoutErr,
          'invalid_layout',
        );
      }
      usedScale = resolveCaptureScale(true);
      try {
        canvas = await runHtml2CanvasCapture(
          html2canvasFn,
          captureRoot,
          retryLayout.width,
          retryLayout.height,
          usedScale,
          android,
          true,
        );
      } catch (retryErr) {
        wrapHtml2CanvasFailure(retryErr);
      }
    }

    recordArabicCoverLetterPdfStage('html2canvas_completed', `${canvas.width}×${canvas.height}`);
    recordArabicCoverLetterPdfStage('canvas_measured', `${canvas.width}×${canvas.height}`);
    validateCanvasHasContent(canvas);

    const blob = canvasToPdfBlob(canvas, usedScale, jsPDF);
    await validatePdfBlob(blob, getArabicCoverLetterPdfMetrics().generatedPageCount ?? 1);
    return blob;
  } catch (err) {
    if (err instanceof CoverLetterArabicPdfExportError) throw err;
    const stage = getArabicCoverLetterPdfDiagnostics().at(-1)?.stage ?? 'pdf_blob_created';
    throw fail(stage, err instanceof Error ? err.message : 'Arabic PDF export failed', err);
  } finally {
    recordArabicCoverLetterPdfStage('cleanup_started');
    overlay?.remove();
    captureRoot?.remove();
    document.getElementById(EXPORT_ROOT_ID)?.remove();
    document.querySelectorAll('[data-cl-arabic-pdf-overlay]').forEach((el) => el.remove());
    removeFonts?.();
    recordArabicCoverLetterPdfStage('cleanup_completed');
  }
}
