export type CvExportExtension = 'pdf' | 'docx';

const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export function makeCvExportBaseName(fullName?: string | null): string {
  const cleanedName = (fullName ?? '')
    .replace(INVALID_FILENAME_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleanedName ? `${cleanedName} - CV` : 'My CV';
}

export function makeCvExportFileName(
  fullName: string | undefined | null,
  extension: CvExportExtension,
): string {
  return `${makeCvExportBaseName(fullName)}.${extension}`;
}
