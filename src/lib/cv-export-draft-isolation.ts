import type { CVData, WorkExperience } from './types';

export const CV_EXPORT_DRAFT_ISOLATION_REVISION =
  'cv-export-draft-isolation-405-v1' as const;

const visibleExperienceSignature = (exp: WorkExperience) => ({
  id: exp.id,
  company: exp.company,
  position: exp.position,
  positionProvenance: exp.positionProvenance,
  positionUserEdited: exp.positionUserEdited,
  positionSourceLocale: exp.positionSourceLocale,
  positionSourceKey: exp.positionSourceKey,
  startDate: exp.startDate,
  endDate: exp.endDate,
  isPresent: exp.isPresent,
  description: exp.description,
  descriptionOrigin: exp.descriptionOrigin,
  generatedDescription: exp.generatedDescription,
  generatedLocale: exp.generatedLocale,
  descriptionSourceLocale: exp.descriptionSourceLocale,
  descriptionSourceLocaleTextHash: exp.descriptionSourceLocaleTextHash,
});

const visibleCvSignature = (cv: CVData) => ({
  personal: cv.personal,
  summary: cv.summary,
  canonicalSummary: cv.canonicalSummary,
  summaryOrigin: cv.summaryOrigin,
  summaryGeneratedLocale: cv.summaryGeneratedLocale,
  summaryGenerationContextKey: cv.summaryGenerationContextKey,
  contentLocale: cv.contentLocale,
  experience: (cv.experience || []).map(visibleExperienceSignature),
});

/** Persist hidden grounding/cache state while preserving the exact editor draft. */
export function buildPersistableCvAfterExportPreparation(
  sourceCv: CVData,
  preparedCv: CVData,
): CVData {
  const preparedExperience = new Map(
    (preparedCv.experience || []).map((exp) => [exp.id, exp]),
  );

  return {
    ...sourceCv,
    runtimeMigrationVersion:
      preparedCv.runtimeMigrationVersion ?? sourceCv.runtimeMigrationVersion,
    experienceLocalizedSurfaces:
      preparedCv.experienceLocalizedSurfaces ?? sourceCv.experienceLocalizedSurfaces,
    exportLocalizedTitleSurfaces:
      preparedCv.exportLocalizedTitleSurfaces ?? sourceCv.exportLocalizedTitleSurfaces,
    experience: (sourceCv.experience || []).map((sourceExp) => {
      const preparedExp = preparedExperience.get(sourceExp.id);
      if (!preparedExp) return sourceExp;
      return {
        ...sourceExp,
        originalUserDescription:
          preparedExp.originalUserDescription ?? sourceExp.originalUserDescription,
        canonicalDescription:
          preparedExp.canonicalDescription ?? sourceExp.canonicalDescription,
        groundingRecoverySource:
          preparedExp.groundingRecoverySource ?? sourceExp.groundingRecoverySource,
        recoveredSemanticDuties:
          preparedExp.recoveredSemanticDuties ?? sourceExp.recoveredSemanticDuties,
      };
    }),
  };
}

export function exportDraftVisibleContentPreserved(
  sourceCv: CVData,
  persistedCv: CVData,
): boolean {
  return JSON.stringify(visibleCvSignature(sourceCv))
    === JSON.stringify(visibleCvSignature(persistedCv));
}
