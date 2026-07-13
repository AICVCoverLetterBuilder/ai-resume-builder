export type ArabicCoverLetterPdfStage =
  | 'entered'
  | 'content_validated'
  | 'container_created'
  | 'container_attached'
  | 'container_measured'
  | 'fonts_ready'
  | 'html2canvas_started'
  | 'html2canvas_completed'
  | 'canvas_measured'
  | 'jspdf_created'
  | 'page_slice_added'
  | 'blob_created'
  | 'blob_validated'
  | 'save_started'
  | 'save_completed'
  | 'cleanup_completed';

export type ArabicCoverLetterPdfDiagnostic = {
  stage: ArabicCoverLetterPdfStage;
  at: number;
  detail?: string;
};

let diagnostics: ArabicCoverLetterPdfDiagnostic[] = [];

export function resetArabicCoverLetterPdfDiagnostics(): void {
  diagnostics = [];
}

export function recordArabicCoverLetterPdfStage(
  stage: ArabicCoverLetterPdfStage,
  detail?: string,
): void {
  diagnostics.push({ stage, at: Date.now(), detail });
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    console.info('[cl-arabic-pdf]', stage, detail ?? '');
  }
}

export function getArabicCoverLetterPdfDiagnostics(): ArabicCoverLetterPdfDiagnostic[] {
  return [...diagnostics];
}

export class CoverLetterArabicPdfExportError extends Error {
  readonly stage: ArabicCoverLetterPdfStage;
  readonly causeError?: Error;

  constructor(stage: ArabicCoverLetterPdfStage, message: string, cause?: unknown) {
    super(message);
    this.name = 'CoverLetterArabicPdfExportError';
    this.stage = stage;
    if (cause instanceof Error) this.causeError = cause;
  }
}
