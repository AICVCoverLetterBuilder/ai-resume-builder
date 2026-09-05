import type { Locale } from './i18n/translations';
import { hashExperienceSourceLocaleText } from './cv-experience-source-locale';
import type { CVData } from './types';

/** Current Summary locale evidence is intentionally independent of UI locale. */
export type SummarySourceLocaleResolution =
  | 'bound_current_text'
  | 'legacy_provenance_fallback'
  | 'global_default_fallback'
  | 'unresolved';

export type ResolvedSummarySourceLocale = {
  locale: Locale | null;
  resolution: SummarySourceLocaleResolution;
};

const SUMMARY_SOURCE_LOCALES: readonly Locale[] = [
  'sr', 'en', 'hi', 'ar', 'ja', 'de', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru',
] as const;

const SUMMARY_SOURCE_LOCALE_ALIASES: Readonly<Record<string, Locale>> = {
  sr: 'sr', 'sr-latn-rs': 'sr', 'sr-cyrl-rs': 'sr',
  en: 'en', 'en-us': 'en', en_gb: 'en',
  hi: 'hi', 'hi-in': 'hi',
  ar: 'ar', 'ar-sa': 'ar',
  ja: 'ja', 'ja-jp': 'ja',
  de: 'de', 'de-de': 'de',
  fr: 'fr', 'fr-fr': 'fr',
  es: 'es', 'es-es': 'es', 'es-mx': 'es',
  it: 'it', 'it-it': 'it',
  hr: 'hr', 'hr-hr': 'hr',
  'pt-br': 'pt-BR', pt_br: 'pt-BR',
  ru: 'ru', 'ru-ru': 'ru',
};

/** Strict Summary-only locale authority. Generic base-locale fallback is forbidden here. */
export function canonicalizeSummarySourceLocale(value: unknown): Locale | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  const canonical = SUMMARY_SOURCE_LOCALE_ALIASES[key];
  return canonical && SUMMARY_SOURCE_LOCALES.includes(canonical) ? canonical : null;
}

/** Pure atomic-boundary locale equality; callers still own persistence/rollback. */
export function summaryBindingLocalesMatch(requested: unknown, committed: unknown): boolean {
  const requestedLocale = canonicalizeSummarySourceLocale(requested);
  const committedLocale = canonicalizeSummarySourceLocale(committed);
  return requestedLocale !== null && requestedLocale === committedLocale;
}

/**
 * Pure candidate truth predicate for the page's existing atomic transaction.
 * It performs no persistence or usage side effect; the caller remains the
 * single commit/rollback owner.
 */
export function summaryV3CandidateBindingMatches(input: {
  requestedLocale: unknown;
  committedSourceLocale: unknown;
  committedGeneratedLocale: unknown;
  committedSummaryOrigin: unknown;
  committedSummary: string;
  committedSummaryHash: string;
  intendedCandidateHash: string;
  committedSummarySourceLocaleTextHash: unknown;
  committedCvHash: string;
  intendedCvHash: string;
  committedContentLocale: unknown;
  intendedContentLocale: unknown;
}): boolean {
  const requestedLocale = canonicalizeSummarySourceLocale(input.requestedLocale);
  const committedSourceLocale = canonicalizeSummarySourceLocale(input.committedSourceLocale);
  const committedGeneratedLocale = canonicalizeSummarySourceLocale(input.committedGeneratedLocale);
  return requestedLocale !== null
    && committedSourceLocale === requestedLocale
    && committedGeneratedLocale === requestedLocale
    && input.committedSummaryOrigin === 'ai_generated'
    && input.committedSummaryHash === input.intendedCandidateHash
    && input.committedSummarySourceLocaleTextHash === hashSummarySourceLocaleText(input.committedSummary)
    && input.committedCvHash === input.intendedCvHash
    && String(input.committedContentLocale || '') === String(input.intendedContentLocale || '');
}

/**
 * Summary uses the same normalized text hash primitive as the accepted
 * Experience current-text binding. Keeping one primitive prevents a Summary
 * and Experience surface from acquiring incompatible binding identities.
 */
export function hashSummarySourceLocaleText(text: string): string {
  return hashExperienceSourceLocaleText(text);
}

function aiProvenanceMatchesGlobalLocale(cv: CVData, generated: Locale, global: Locale): boolean {
  return cv.summaryOrigin !== 'user' && generated === global;
}

/**
 * Resolve the locale of the exact visible Summary surface.
 *
 * A valid current-text binding is the only field-level authority. Legacy AI
 * metadata is accepted only for the existing same-locale shape where the
 * generated and global locales agree; otherwise the resolver fails back to
 * document/default evidence and never consults UI locale.
 */
export function resolveSummarySourceLocale(cv: CVData): ResolvedSummarySourceLocale {
  const visibleSummary = String(cv.summary || '');
  const boundLocale = canonicalizeSummarySourceLocale(cv.summarySourceLocale);
  const boundHash = String(cv.summarySourceLocaleTextHash || '').trim();
  if (visibleSummary.trim() && boundLocale && boundHash && boundHash === hashSummarySourceLocaleText(visibleSummary)) {
    return { locale: boundLocale, resolution: 'bound_current_text' };
  }

  const generatedLocale = canonicalizeSummarySourceLocale(cv.summaryGeneratedLocale);
  const globalLocale = canonicalizeSummarySourceLocale(cv.contentLocale);
  if (generatedLocale && globalLocale && aiProvenanceMatchesGlobalLocale(cv, generatedLocale, globalLocale)) {
    return { locale: generatedLocale, resolution: 'legacy_provenance_fallback' };
  }

  const fallback = globalLocale || canonicalizeSummarySourceLocale(cv.canonicalSnapshot?.canonicalLocale);
  if (fallback) return { locale: fallback, resolution: 'global_default_fallback' };
  return { locale: null, resolution: 'unresolved' };
}
