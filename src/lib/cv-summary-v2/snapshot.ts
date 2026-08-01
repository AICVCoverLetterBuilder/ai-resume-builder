import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
} from '@/lib/cv-experience-duration';
import { SUMMARY_V2_REVISION } from './flag';
import type { SummaryV2EntryOwned, SummaryV2Snapshot } from './types';
import { buildEntryOwnedFactsFromLiveDescription, hashSummaryV2Text } from './facts';
import {
  resolveSourceLocaleForText,
  SUMMARY_V2_SUPPORTED_LOCALES,
} from './locale-authority';

/**
 * Live description only — never canonicalDescription / generatedDescription /
 * originalUserDescription. Deleted fields and stale caches contribute zero.
 */
export function liveExperienceDescription(exp: WorkExperience): string {
  return (exp.description || '').trim();
}

export function captureSummaryV2Snapshot(options: {
  cv: CVData;
  locale: Locale;
  gender?: string;
  referenceDateIso: string;
}): SummaryV2Snapshot {
  const { cv, locale, referenceDateIso } = options;
  const gender = options.gender || cv.personal?.gender || '';
  const experiences = [...(cv.experience || [])];
  const durationSnapshot = buildExperienceDurationSnapshot(experiences, referenceDateIso);
  const duration = durationSnapshot.total;
  const durationPhrase = duration.hasValidDates
    ? formatApproximateDurationPhrase(duration, locale)
    : '';

  const entries: SummaryV2EntryOwned[] = experiences.map((exp) => {
    const live = liveExperienceDescription(exp);
    const isPresent = Boolean(exp.isPresent);
    const declaredRaw = exp.generatedLocale
      || exp.positionSourceLocale
      || cv.contentLocale
      || null;
    const declaredLocale = SUMMARY_V2_SUPPORTED_LOCALES.includes(declaredRaw as Locale)
      ? declaredRaw as Locale
      : null;
    const entryLocale = resolveSourceLocaleForText({
      text: [live, exp.position || ''].join('\n'),
      declaredLocale,
      fallbackLocale: locale,
    }).sourceLocale;
    return {
      entryId: String(exp.id || ''),
      role: (exp.position || '').trim(),
      employer: (exp.company || '').trim(),
      startDate: (exp.startDate || '').trim(),
      endDate: (exp.endDate || '').trim(),
      isPresent,
      employmentState: isPresent ? 'present' : 'completed',
      sourceLocale: entryLocale,
      descriptionHash: hashSummaryV2Text(live),
      facts: buildEntryOwnedFactsFromLiveDescription({
        entryId: String(exp.id || ''),
        liveDescription: live,
        sourceLocale: entryLocale,
      }),
    };
  });

  return {
    revision: SUMMARY_V2_REVISION,
    capturedAtIso: new Date().toISOString(),
    referenceDateIso,
    locale,
    gender,
    styleHintSummary: (cv.summary || '').trim(),
    entries,
    totalDurationMonths: duration.hasValidDates ? duration.totalMonths : 0,
    durationApproxYears: duration.hasValidDates && duration.unit === 'years'
      ? duration.approxYears
      : null,
    durationPhrase,
  };
}
