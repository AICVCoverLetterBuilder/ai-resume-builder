/**
 * Shared fail-closed summary activation for Stronger AI / Generate Summary / export.
 * Delegates to the authoritative `finalizeCvAiFieldForApply` gate.
 */
import type { CVData, CvSummaryOrigin } from './types';
import type { Locale } from './i18n/translations';
import type { ExperienceDurationSnapshot } from './cv-experience-duration';
import { finalizeCvAiFieldForApply } from './cv-ai-finalize-apply';
import { resolveOccupationalTitleForSummary } from './cv-role-title';
import type { DurationIntegrationContext } from './cv-content-quality';
import { resolveExperienceGroundingDescription } from './cv-experience-provenance';

export function buildDurationContextFromCv(cv: CVData, locale: Locale): DurationIntegrationContext {
  const primaryExp = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const gender = cv.personal?.gender || '';
  const dutiesText = (cv.experience || [])
    .map((e) => resolveExperienceGroundingDescription(e))
    .join('\n');
  return {
    role: resolveOccupationalTitleForSummary({
      profileJobTitle: cv.personal?.jobTitle,
      currentExperienceTitle: primaryExp?.position,
      locale,
      gender,
      dutiesText,
    }),
    company: primaryExp?.company || '',
    startDate: primaryExp?.startDate || '',
    gender,
  };
}

/**
 * AI summary → authoritative finalization gate → grounded deterministic fallback.
 * On failure preserves current summary and blocks activation.
 */
export function finalizeClientAiSummary(
  rawSummary: string,
  cv: CVData,
  locale: Locale,
  durationSnapshot: ExperienceDurationSnapshot,
): { summary: string; origin: CvSummaryOrigin; blocked: boolean } {
  const result = finalizeCvAiFieldForApply({
    action: 'summary_generate',
    field: 'summary',
    requestedLocale: locale,
    gender: cv.personal?.gender || '',
    cv,
    candidate: rawSummary,
    durationSnapshot,
  });
  return {
    summary: result.blocked ? (cv.summary || '') : result.text,
    origin: (result.origin as CvSummaryOrigin) || cv.summaryOrigin || 'user',
    blocked: result.blocked,
  };
}
