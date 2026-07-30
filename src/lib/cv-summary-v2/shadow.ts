import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { setSummaryV2EnabledForTests } from './flag';
import { runSummaryV2 } from './pipeline';

export type SummaryV2ShadowComparison = {
  locale: Locale;
  v2Text: string;
  legacyText: string;
  v2Ok: boolean;
  v2Reason: string | null;
  textsEqual: boolean;
  v2RequiredCurrent: number;
  v2CoveredCurrent: number;
  v2RequiredPrior: number;
  v2CoveredPrior: number;
};

/**
 * Shadow comparison only — does not mutate production flag state permanently.
 * Temporarily enables V2, builds both candidates, restores prior flag override.
 */
export function compareSummaryV2AgainstLegacy(options: {
  cv: CVData;
  locale: Locale;
  gender?: string;
  referenceDateIso: string;
  candidate?: string;
}): SummaryV2ShadowComparison {
  const prev = process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
  setSummaryV2EnabledForTests(true);
  let v2;
  try {
    v2 = runSummaryV2({
      cv: options.cv,
      locale: options.locale,
      gender: options.gender,
      referenceDateIso: options.referenceDateIso,
      candidate: options.candidate,
    });
  } finally {
    setSummaryV2EnabledForTests(null);
    if (prev === undefined) delete process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
    else process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 = prev;
  }

  const durationSnapshot = buildExperienceDurationSnapshot(
    options.cv.experience || [],
    options.referenceDateIso,
  );
  const factSet = buildCvCanonicalFactSet(options.cv);
  const legacyText = deterministicLocalizedSummaryFromCanonical(
    factSet,
    options.locale,
    options.gender || options.cv.personal?.gender || '',
    durationSnapshot.total,
  ) || '';

  return {
    locale: options.locale,
    v2Text: v2.text,
    legacyText,
    v2Ok: !v2.blocked && v2.countedAsSuccess,
    v2Reason: v2.reason || v2.validation.reason,
    textsEqual: v2.text.trim() === legacyText.trim(),
    v2RequiredCurrent: v2.validation.requiredCurrentFactCount,
    v2CoveredCurrent: v2.validation.coveredCurrentFactCount,
    v2RequiredPrior: v2.validation.requiredPriorFactCount,
    v2CoveredPrior: v2.validation.coveredPriorFactCount,
  };
}
