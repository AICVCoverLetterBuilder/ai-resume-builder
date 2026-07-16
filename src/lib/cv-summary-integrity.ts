/**
 * Shared fail-closed summary activation for Stronger AI / Generate Summary / export.
 */
import type { CVData, CvSummaryOrigin } from './types';
import type { Locale } from './i18n/translations';
import { buildCvCanonicalFactSet } from './cv-canonical-facts';
import {
  resolveSummaryWithDurationPolicy,
  stripUnsupportedSummaryFluff,
  type DurationIntegrationContext,
} from './cv-content-quality';
import { deterministicLocalizedSummaryFromCanonical } from './cv-localized-fallback';
import { resolveOccupationalTitleForSummary } from './cv-role-title';
import {
  validateLocalizedSummary,
  validateSummaryCompleteness,
} from './cv-semantic-fidelity';
import type { ExperienceDurationSnapshot } from './cv-experience-duration';

export function buildDurationContextFromCv(cv: CVData, locale: Locale): DurationIntegrationContext {
  const primaryExp = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const gender = cv.personal?.gender || '';
  return {
    role: resolveOccupationalTitleForSummary({
      profileJobTitle: cv.personal?.jobTitle,
      currentExperienceTitle: primaryExp?.position,
      locale,
      gender,
    }),
    company: primaryExp?.company || '',
    startDate: primaryExp?.startDate || '',
    gender,
  };
}

function summaryPassesIntegrity(
  summary: string,
  cv: CVData,
  locale: Locale,
  durationSnapshot: ExperienceDurationSnapshot,
): boolean {
  const factSet = buildCvCanonicalFactSet(cv);
  const gender = cv.personal?.gender || '';
  if (!validateSummaryCompleteness(summary, { locale }).valid) return false;
  return validateLocalizedSummary(summary, factSet, {
    locale,
    gender,
    expectedDuration: durationSnapshot.total,
    stage: 'client-activation',
  }).valid;
}

/**
 * AI summary → duration policy → full semantic validation → grounded deterministic fallback.
 * On failure preserves current summary and blocks activation.
 */
export function finalizeClientAiSummary(
  rawSummary: string,
  cv: CVData,
  locale: Locale,
  durationSnapshot: ExperienceDurationSnapshot,
): { summary: string; origin: CvSummaryOrigin; blocked: boolean } {
  const context = buildDurationContextFromCv(cv, locale);
  const gender = cv.personal?.gender || '';
  const factSet = buildCvCanonicalFactSet(cv);

  let summary = stripUnsupportedSummaryFluff((rawSummary || '').trim(), locale);
  const durationResolved = resolveSummaryWithDurationPolicy(summary, durationSnapshot.total, locale, {
    forceDurationPhrase: true,
    requireDurationClaim: true,
    context,
  });
  summary = durationResolved.summary;

  let origin: CvSummaryOrigin = 'ai_generated';
  if (durationResolved.status === 'repaired') origin = 'ai_repaired';
  if (durationResolved.status === 'fallback') origin = 'deterministic_fallback';

  if (summaryPassesIntegrity(summary, cv, locale, durationSnapshot)) {
    return { summary, origin, blocked: false };
  }

  const grounded = deterministicLocalizedSummaryFromCanonical(
    factSet,
    locale,
    gender,
    durationSnapshot.total,
  );
  if (grounded) {
    const groundedResolved = resolveSummaryWithDurationPolicy(grounded, durationSnapshot.total, locale, {
      forceDurationPhrase: true,
      requireDurationClaim: true,
      context,
    });
    if (summaryPassesIntegrity(groundedResolved.summary, cv, locale, durationSnapshot)) {
      return {
        summary: groundedResolved.summary,
        origin: 'deterministic_fallback',
        blocked: false,
      };
    }
  }

  return {
    summary: cv.summary || '',
    origin: cv.summaryOrigin || 'user',
    blocked: true,
  };
}
