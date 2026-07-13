/**
 * Arabic cover-letter PDF via html2canvas inside a clean same-origin iframe.
 * Avoids parent-document Tailwind/oklch CSS that breaks Android WebView html2canvas.
 */
import { Capacitor } from '@capacitor/core';
import { CV_PDF_A4_HEIGHT_MM, CV_PDF_A4_WIDTH_MM } from './export';
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
  A4_MIN_HEIGHT_PX,
  IFRAME_ATTR,
  MIN_NON_WHITE_RATIO,
  analyzeCanvasPixels,
  assertTargetBelongsToIframe,
  buildPaddedPngSlice,
  createArabicCaptureIframe,
  createExportOverlay,
  isUnsupportedColorFunctionError,
  loadArabicFontsInIframe,
  runUnsafeColorScanOrThrow,
  sanitizeClonedIframeDocument,
  validateCaptureRootLayout,
  waitForIframeStableLayout,
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
  assertTargetBelongsToIframe,
  buildIframeSafeCss,
  buildIsolatedArabicExportRoot,
  createArabicCaptureIframe,
  forceCloneCaptureStyles,
  inlineStylesAreCaptureSafe,
  isUnsupportedColorFunctionError,
  resolveArabicFontAbsoluteUrl,
  runUnsafeColorScanOrThrow,
  sanitizeClonedIframeDocument,
  scanDocumentForUnsafeColorFunctions,
  tryResolvePreviewRoot,
  validateCaptureRootLayout,
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
  recordArabicCoverLetterPdfStage('canvas_validation_completed', `ratio=${analysis.ratio.toFixed(5)}`);
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
  recordArabicCoverLetterPdfStage('png_created', `len=${dataUrl.length}`);
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
  recordArabicCoverLetterPdfStage('pdf_created', `size=${blob.size}`);
}

function describeTargetStyles(element: HTMLElement): string {
  const view = element.ownerDocument.defaultView;
  const cs = view ? view.getComputedStyle(element) : getComputedStyle(element);
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
): Record<string, unknown> {
  return {
    scale,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    foreignObjectRendering: false,
    scrollX: 0,
    scrollY: 0,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    onclone: (clonedDoc: Document) => {
      try {
        sanitizeClonedIframeDocument(clonedDoc);
      } catch (err) {
        recordArabicCoverLetterPdfStage(
          'html2canvas_onclone_validation',
          err instanceof Error ? err.message : String(err),
        );
        throw err;
      }
      recordArabicCoverLetterPdfStage('html2canvas_onclone_validation', 'passed');
    },
  };
}

async function runHtml2CanvasCapture(
  html2canvasFn: Html2CanvasFn,
  captureRoot: HTMLElement,
  captureWidth: number,
  captureHeight: number,
  scale: number,
  isRetry: boolean,
): Promise<HTMLCanvasElement> {
  const options = buildHtml2CanvasOptions(captureWidth, captureHeight, scale);
  updateArabicCoverLetterPdfMetrics({
    html2canvasOptionsSummary: `scale=${scale};w=${captureWidth};h=${captureHeight};allowTaint=false;foreignObjectRendering=false;window=${captureWidth}x${captureHeight};x/y=omitted`,
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
    if (
      captureErr instanceof Error &&
      ((captureErr as Error & { code?: string }).code === 'unsafe_cloned_css' ||
        /unsafe_cloned_css/.test(captureErr.message))
    ) {
      fail('html2canvas_onclone_validation', captureErr.message, captureErr, 'unsafe_cloned_css');
    }
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

/** Android (and all platforms) use a clean iframe document — never the parent app DOM. */
export function resolveArabicPdfCaptureStrategy(): 'isolated-iframe-primary' {
  return 'isolated-iframe-primary';
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

  let overlay: HTMLDivElement | null = null;
  let iframe: HTMLIFrameElement | null = null;
  let usedScale = resolveCaptureScale(false);

  try {
    const [{ default: html2canvasMod }, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const html2canvasFn = (
      (html2canvasMod as { default?: typeof import('html2canvas').default }).default ?? html2canvasMod
    ) as Html2CanvasFn;
    const jsPDF = (jspdfMod.jsPDF ?? jspdfMod.default) as typeof import('jspdf').jsPDF;
    if (typeof html2canvasFn !== 'function') fail('export_entered', 'html2canvas unavailable');

    const strategy = resolveArabicPdfCaptureStrategy();
    updateArabicCoverLetterPdfMetrics({ captureStrategy: strategy });
    recordArabicCoverLetterPdfStage('export_root_created', strategy);

    overlay = createExportOverlay();
    const ctx = await createArabicCaptureIframe(candidateName, content, locale);
    iframe = ctx.iframe;
    const { iframeDocument, root: captureRoot, fontAbsoluteUrl } = ctx;
    recordArabicCoverLetterPdfStage('export_root_attached', `iframe:${captureRoot.id}`);

    try {
      assertTargetBelongsToIframe(captureRoot, iframeDocument);
    } catch (ownerErr) {
      fail(
        'layout_validation_failed',
        ownerErr instanceof Error ? ownerErr.message : 'Target not in iframe document',
        ownerErr,
        'invalid_owner_document',
      );
    }

    await loadArabicFontsInIframe(iframeDocument, iframe.contentWindow, fontAbsoluteUrl);

    iframe.style.height = `${A4_MIN_HEIGHT_PX}px`;
    const { width: captureWidth, height: captureHeight } = await waitForIframeStableLayout(
      captureRoot,
      iframe.contentWindow,
    );
    iframe.style.height = `${captureHeight}px`;

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
    recordArabicCoverLetterPdfStage(
      'export_root_styles_applied',
      `iframe opacity=1 ${captureWidth}x${captureHeight}@0,0`,
    );

    try {
      runUnsafeColorScanOrThrow(iframeDocument);
    } catch (scanErr) {
      fail(
        'unsafe_css_scan_completed',
        scanErr instanceof Error ? scanErr.message : 'Unsafe CSS scan failed',
        scanErr,
        'unsafe_css',
      );
    }

    usedScale = resolveCaptureScale(false);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await runHtml2CanvasCapture(
        html2canvasFn,
        captureRoot,
        captureWidth,
        captureHeight,
        usedScale,
        false,
      );
    } catch (primaryErr) {
      if (primaryErr instanceof CoverLetterArabicPdfExportError) throw primaryErr;
      // Never retry unsupported CSS parser errors — the iframe document must change first.
      if (isUnsupportedColorFunctionError(primaryErr)) {
        wrapHtml2CanvasFailure(primaryErr);
      }
      // Optional scale-1 retry inside the same clean iframe only for non-CSS failures.
      usedScale = resolveCaptureScale(true);
      updateArabicCoverLetterPdfMetrics({ captureStrategy: 'isolated-iframe-scale-retry' });
      recordArabicCoverLetterPdfStage('html2canvas_retry_started', 'isolated-iframe-scale-retry');
      try {
        canvas = await runHtml2CanvasCapture(
          html2canvasFn,
          captureRoot,
          captureWidth,
          captureHeight,
          usedScale,
          true,
        );
      } catch (retryErr) {
        if (retryErr instanceof CoverLetterArabicPdfExportError) throw retryErr;
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
    recordArabicCoverLetterPdfStage('iframe_cleanup_started');
    recordArabicCoverLetterPdfStage('cleanup_started');
    overlay?.remove();
    iframe?.remove();
    document.querySelectorAll(`[${IFRAME_ATTR}]`).forEach((el) => el.remove());
    document.querySelectorAll('[data-cl-arabic-pdf-overlay]').forEach((el) => el.remove());
    recordArabicCoverLetterPdfStage('iframe_cleanup_completed');
    recordArabicCoverLetterPdfStage('cleanup_completed');
  }
}
