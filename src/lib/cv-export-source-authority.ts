import type { CVData, TemplateId } from './types';

export const CV_EXPORT_SOURCE_AUTHORITY_REVISION =
  'cv-export-source-authority-410-v1' as const;

/**
 * Capture the authoritative editor CV for PDF/DOCX export.
 *
 * cvRef.current owns visible CV content. A possibly stale React render must
 * never be merged over it. Only the currently selected template may override
 * the captured snapshot.
 */
export function resolveCvExportSourceAuthority(
  liveCv: CVData,
  selectedTemplateId: TemplateId,
): CVData {
  return {
    ...liveCv,
    templateId: selectedTemplateId,
  };
}
