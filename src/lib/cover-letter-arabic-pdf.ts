/**
 * Arabic cover-letter PDF via html2canvas (preview-first, fully opaque capture).
 */
import { Capacitor } from '@capacitor/core';
import { ensureNotoFontsForHtmlCapture } from './export';
import {
  CoverLetterArabicPdfExportError,
  getArabicCoverLetterPdfDiagnostics,
  recordArabicCoverLetterPdfStage,
  updateArabicCoverLetterPdfMetrics,
  type ArabicCoverLetterPdfStage,
} from './cover-letter-arabic-pdf-diagnostics';
import {
  ARABIC_BODY_FONT,
  EXPORT_ROOT_ATTR,
  MIN_NON_WHITE_RATIO,
  analyzeCanvasPixels,
  applyOpaqueCaptureStyles,
  buildOpaqueExportRoot,
  buildPaddedPngSlice,
  clonePreviewToExportRoot,
  createExportOverlay,
  forceCloneCaptureStyles,
  tryResolvePreviewRoot,
  waitForStableLayout,
} from './cover-letter-arabic-pdf-capture';
import { CV_PDF_A4_HEIGHT_MM, CV_PDF_A4_WIDTH_MM } from './export';

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
  type ArabicCoverLetterPdfStage,
} from './cover-letter-arabic-pdf-diagnostics';

export {
  applyOpaqueCaptureStyles,
  analyzeCanvasPixels,
  forceCloneCaptureStyles,
  tryResolvePreviewRoot,
} from './cover-letter-arabic-pdf-capture';

const CONTINUATION_TOP_PAD_PX = 28;
const CONTINUATION_BOTTOM_PAD_PX = 12;

function resolveCaptureScale(): number {
  if (typeof window === 'undefined') return 2;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' ? 1.5 : 2;
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
  let mount: HTMLDivElement | null = null;
  let overlay: HTMLDivElement | null = null;
  let captureRoot: HTMLElement | null = null;

  try {
    const [{ default: html2canvasMod }, jspdfMod] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const html2canvasFn = (
      (html2canvasMod as { default?: typeof import('html2canvas').default }).default ?? html2canvasMod
    ) as typeof import('html2canvas').default;
    const jsPDF = (jspdfMod.jsPDF ?? jspdfMod.default) as typeof import('jspdf').jsPDF;
    if (typeof html2canvasFn !== 'function') fail('export_entered', 'html2canvas unavailable');

    const preview = tryResolvePreviewRoot();
    const built = preview ? clonePreviewToExportRoot(preview) : buildOpaqueExportRoot(candidateName, content, locale);
    mount = built.mount;
    captureRoot = built.root;
    updateArabicCoverLetterPdfMetrics({ captureStrategy: preview ? 'preview' : 'opaque_export_root' });
    recordArabicCoverLetterPdfStage('export_root_created', preview ? 'preview' : 'opaque_export_root');

    overlay = createExportOverlay();
    document.body.appendChild(mount);
    recordArabicCoverLetterPdfStage('export_root_attached');

    removeFonts = await ensureArabicFontsReady();
    const { width: captureWidth, height: captureHeight } = await waitForStableLayout(captureRoot);
    recordArabicCoverLetterPdfStage('export_root_styles_applied', `opacity=1 ${captureWidth}x${captureHeight}`);
    if (captureWidth <= 0 || captureHeight <= 0) {
      fail('layout_stable', `Zero dimensions (${captureWidth}×${captureHeight})`, undefined, 'zero_dimensions');
    }

    const scale = resolveCaptureScale();
    const rootSelector = `[${EXPORT_ROOT_ATTR}="true"]`;
    recordArabicCoverLetterPdfStage('html2canvas_started', `scale=${scale}`);
    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvasFn(captureRoot, {
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
        onclone: (doc) => forceCloneCaptureStyles(doc, rootSelector),
      });
    } catch (captureErr) {
      fail('html2canvas_completed', 'html2canvas capture failed', captureErr, 'html2canvas_error');
    }

    recordArabicCoverLetterPdfStage('html2canvas_completed', `${canvas.width}×${canvas.height}`);
    recordArabicCoverLetterPdfStage('canvas_measured', `${canvas.width}×${canvas.height}`);
    validateCanvasHasContent(canvas);

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
    await validatePdfBlob(blob, generatedPageCount);
    return blob;
  } catch (err) {
    if (err instanceof CoverLetterArabicPdfExportError) throw err;
    const stage = getArabicCoverLetterPdfDiagnostics().at(-1)?.stage ?? 'pdf_blob_created';
    throw fail(stage, err instanceof Error ? err.message : 'Arabic PDF export failed', err);
  } finally {
    recordArabicCoverLetterPdfStage('cleanup_started');
    overlay?.remove();
    mount?.remove();
    removeFonts?.();
    recordArabicCoverLetterPdfStage('cleanup_completed');
  }
}
