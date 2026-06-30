import type { SaveFileResult } from './native-save';

export type ExportFileFormat = 'pdf' | 'docx';

export type CvExportSuccessTranslations = {
  cvSavedSuccessfully: string;
  downloadStarted: string;
  savedToDownloadsFolder: string;
  pdfSavedSuccessfully: string;
  docxSavedSuccessfully: string;
};

export type CvExportSuccessToast = {
  title: string;
  description: string;
};

export function isVerifiedAndroidSaveResult(result: SaveFileResult): boolean {
  return result.platform === 'android' &&
    result.result === 'saved' &&
    typeof result.bytesWritten === 'number' &&
    typeof result.verifiedSize === 'number' &&
    typeof result.sourceBytes === 'number' &&
    result.bytesWritten > 0 &&
    result.verifiedSize > 0 &&
    result.sourceBytes > 0 &&
    result.bytesWritten === result.sourceBytes &&
    result.verifiedSize === result.sourceBytes;
}

export function getCvExportSuccessToast(
  result: SaveFileResult,
  format: ExportFileFormat,
  fallbackFileName: string,
  t: CvExportSuccessTranslations,
): CvExportSuccessToast | null {
  if (result.result !== 'saved') return null;

  const fileName = result.fileName || fallbackFileName;

  if (result.platform === 'android') {
    if (!isVerifiedAndroidSaveResult(result)) return null;

    const lines = [
      format === 'pdf' ? t.pdfSavedSuccessfully : t.docxSavedSuccessfully,
      fileName,
    ];
    if (result.destination) {
      lines.push(`${t.savedToDownloadsFolder}: ${result.destination}`);
    }
    return {
      title: t.cvSavedSuccessfully,
      description: lines.join('\n'),
    };
  }

  if (result.platform === 'web') {
    return {
      title: t.downloadStarted,
      description: fileName,
    };
  }

  return {
    title: t.cvSavedSuccessfully,
    description: [
      format === 'pdf' ? t.pdfSavedSuccessfully : t.docxSavedSuccessfully,
      fileName,
    ].join('\n'),
  };
}
