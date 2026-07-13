export type ArabicCoverLetterPdfStage =
  | 'export_entered'
  | 'source_content_validated'
  | 'export_root_created'
  | 'export_root_attached'
  | 'export_root_styles_applied'
  | 'font_loading_started'
  | 'font_loading_completed'
  | 'font_check_result'
  | 'first_layout_measurement'
  | 'second_layout_measurement'
  | 'layout_stable'
  | 'html2canvas_started'
  | 'html2canvas_completed'
  | 'canvas_measured'
  | 'canvas_pixel_validation_completed'
  | 'image_encoding_started'
  | 'image_encoding_completed'
  | 'jspdf_created'
  | 'page_slice_started'
  | 'page_slice_completed'
  | 'pdf_blob_created'
  | 'pdf_blob_validated'
  | 'platform_save_started'
  | 'platform_save_completed'
  | 'cleanup_started'
  | 'cleanup_completed';

export type ArabicCoverLetterPdfMetrics = {
  captureStrategy?: 'preview' | 'opaque_export_root';
  rootOffsetWidth?: number;
  rootOffsetHeight?: number;
  rootScrollWidth?: number;
  rootScrollHeight?: number;
  rootBoundingRect?: string;
  rootOpacity?: string;
  canvasWidth?: number;
  canvasHeight?: number;
  nonWhiteSampledPixels?: number;
  nonWhitePixelCount?: number;
  nonWhitePixelRatio?: number;
  imageDataUrlLength?: number;
  imageMime?: string;
  pdfBlobSize?: number;
  pdfBlobMime?: string;
  pdfSignatureValid?: boolean;
  expectedPageCount?: number;
  generatedPageCount?: number;
  fontCheckPassed?: boolean;
  platformSaveResult?: string;
};

export type ArabicCoverLetterPdfDiagnostic = {
  stage: ArabicCoverLetterPdfStage;
  at: number;
  detail?: string;
};

export type ArabicCoverLetterPdfErrorRecord = {
  name: string;
  message: string;
  stage: ArabicCoverLetterPdfStage;
  code?: string;
  stack?: string;
};

const STORAGE_KEY = 'cl-arabic-pdf-diagnostics-v2';

let diagnostics: ArabicCoverLetterPdfDiagnostic[] = [];
let metrics: ArabicCoverLetterPdfMetrics = {};
let lastError: ArabicCoverLetterPdfErrorRecord | null = null;
let traceStartedAt: number | null = null;

export function beginArabicCoverLetterPdfExportTrace(): void {
  diagnostics = [];
  metrics = {};
  lastError = null;
  traceStartedAt = Date.now();
  persistArabicCoverLetterPdfDiagnostics();
}

export function resetArabicCoverLetterPdfDiagnostics(): void {
  beginArabicCoverLetterPdfExportTrace();
}

export function recordArabicCoverLetterPdfStage(
  stage: ArabicCoverLetterPdfStage,
  detail?: string,
): void {
  diagnostics.push({ stage, at: Date.now(), detail });
  persistArabicCoverLetterPdfDiagnostics();
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.info('[cl-arabic-pdf]', stage, detail ?? '');
  }
}

export function updateArabicCoverLetterPdfMetrics(
  patch: Partial<ArabicCoverLetterPdfMetrics>,
): void {
  metrics = { ...metrics, ...patch };
  persistArabicCoverLetterPdfDiagnostics();
}

export function recordArabicCoverLetterPdfError(
  stage: ArabicCoverLetterPdfStage,
  err: unknown,
  code?: string,
): void {
  const error = err instanceof Error ? err : new Error(String(err));
  lastError = {
    name: error.name,
    message: error.message,
    stage,
    code,
    stack: error.stack,
  };
  persistArabicCoverLetterPdfDiagnostics();
}

export function getArabicCoverLetterPdfDiagnostics(): ArabicCoverLetterPdfDiagnostic[] {
  return [...diagnostics];
}

export function getArabicCoverLetterPdfMetrics(): ArabicCoverLetterPdfMetrics {
  return { ...metrics };
}

export function getLastArabicCoverLetterPdfError(): ArabicCoverLetterPdfErrorRecord | null {
  return lastError ? { ...lastError } : null;
}

export function getLastCompletedArabicPdfStage(): ArabicCoverLetterPdfStage | null {
  return diagnostics.at(-1)?.stage ?? null;
}

function persistArabicCoverLetterPdfDiagnostics(): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = {
      at: traceStartedAt ?? Date.now(),
      diagnostics,
      metrics,
      lastError,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPersistedArabicCoverLetterPdfDiagnostics(): {
  diagnostics: ArabicCoverLetterPdfDiagnostic[];
  metrics: ArabicCoverLetterPdfMetrics;
  lastError: ArabicCoverLetterPdfErrorRecord | null;
  at: number;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      at?: number;
      diagnostics?: ArabicCoverLetterPdfDiagnostic[];
      metrics?: ArabicCoverLetterPdfMetrics;
      lastError?: ArabicCoverLetterPdfErrorRecord | null;
    };
    return {
      at: parsed.at ?? Date.now(),
      diagnostics: parsed.diagnostics ?? [],
      metrics: parsed.metrics ?? {},
      lastError: parsed.lastError ?? null,
    };
  } catch {
    return null;
  }
}

export function formatArabicCoverLetterPdfDiagnosticReport(): string {
  const lastStage = getLastCompletedArabicPdfStage();
  const m = getArabicCoverLetterPdfMetrics();
  const err = getLastArabicCoverLetterPdfError();
  const lines = [
    'Cover Letter Arabic PDF Diagnostics',
    `timestamp: ${new Date().toISOString()}`,
    `lastCompletedStage: ${lastStage ?? 'none'}`,
    `captureStrategy: ${m.captureStrategy ?? 'unknown'}`,
    `errorName: ${err?.name ?? 'none'}`,
    `errorMessage: ${err?.message ?? 'none'}`,
    `errorStage: ${err?.stage ?? 'none'}`,
    `errorCode: ${err?.code ?? 'none'}`,
    `rootDimensions: ${m.rootOffsetWidth ?? 0}x${m.rootOffsetHeight ?? 0} (scroll ${m.rootScrollWidth ?? 0}x${m.rootScrollHeight ?? 0})`,
    `rootBoundingRect: ${m.rootBoundingRect ?? 'n/a'}`,
    `rootOpacity: ${m.rootOpacity ?? 'n/a'}`,
    `canvasDimensions: ${m.canvasWidth ?? 0}x${m.canvasHeight ?? 0}`,
    `nonWhiteRatio: ${m.nonWhitePixelRatio ?? 0} (${m.nonWhitePixelCount ?? 0}/${m.nonWhiteSampledPixels ?? 0})`,
    `imageMime: ${m.imageMime ?? 'n/a'}`,
    `imageDataUrlLength: ${m.imageDataUrlLength ?? 0}`,
    `pdfBlobSize: ${m.pdfBlobSize ?? 0}`,
    `pdfBlobMime: ${m.pdfBlobMime ?? 'n/a'}`,
    `pdfSignatureValid: ${m.pdfSignatureValid ?? false}`,
    `pageCount: ${m.generatedPageCount ?? 0}/${m.expectedPageCount ?? 0}`,
    `fontCheckPassed: ${m.fontCheckPassed ?? false}`,
    `platformSaveResult: ${m.platformSaveResult ?? 'n/a'}`,
    'stages:',
    ...diagnostics.map((d) => `- ${d.stage}${d.detail ? `: ${d.detail}` : ''}`),
  ];
  return lines.join('\n');
}

export async function copyArabicCoverLetterPdfDiagnosticsToClipboard(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(formatArabicCoverLetterPdfDiagnosticReport());
    return true;
  } catch {
    return false;
  }
}

export class CoverLetterArabicPdfExportError extends Error {
  readonly stage: ArabicCoverLetterPdfStage;
  readonly code?: string;
  readonly causeError?: Error;

  constructor(stage: ArabicCoverLetterPdfStage, message: string, cause?: unknown, code?: string) {
    super(message);
    this.name = 'CoverLetterArabicPdfExportError';
    this.stage = stage;
    this.code = code;
    if (cause instanceof Error) this.causeError = cause;
    recordArabicCoverLetterPdfError(stage, this, code);
  }
}
