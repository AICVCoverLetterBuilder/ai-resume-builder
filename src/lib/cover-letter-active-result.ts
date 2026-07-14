/**
 * Stable cover-letter active result — separate lifetime from in-flight request state.
 * Download/preview eligibility must use this, not AbortController / toast / activeRequest.
 */
import type { Locale } from './i18n/translations';
import { contentMatchesRequestedLocale } from './cover-letter-generation';
import {
  normalizeCoverLetterGender,
  type CoverLetterGender,
} from './cover-letter-gender';
import {
  isTrustedCoverLetterGroundingStatus,
  type CoverLetterGenerationPhase,
  type CoverLetterGroundingStatus,
} from './cover-letter-flow';

export type CoverLetterResultSource = 'passed' | 'repaired' | 'fallback';

export type CoverLetterActiveResult = {
  content: string;
  locale: Locale;
  gender: CoverLetterGender;
  groundingStatus: CoverLetterResultSource;
  source: CoverLetterResultSource;
  requestId: string;
  activatedAt: number;
};

export type CoverLetterStateSnapshot = {
  requestId: string | null;
  activeRequestPresent: boolean;
  activeRequestLocale: Locale | null;
  activeRequestGender: CoverLetterGender | null;
  generationPhase: CoverLetterGenerationPhase;
  isGenerating: boolean;
  contentLength: number;
  contentLocale: Locale | null;
  groundingStatus: CoverLetterGroundingStatus | null;
  resultSource: CoverLetterResultSource | null;
  downloadsAllowed: boolean;
  copyAllowed: boolean;
  selectedLocale: Locale | null;
  selectedGenderNormalized: CoverLetterGender | null;
  lastActivationTimestamp: number | null;
};

export type CoverLetterStateTransition = {
  timestamp: number;
  actionName: string;
  stateBefore: CoverLetterStateSnapshot;
  stateAfter: CoverLetterStateSnapshot;
};

const MAX_TRANSITIONS = 48;
const transitions: CoverLetterStateTransition[] = [];

export function clearCoverLetterStateTransitions(): void {
  transitions.length = 0;
}

export function getCoverLetterStateTransitions(): ReadonlyArray<CoverLetterStateTransition> {
  return transitions;
}

export function recordCoverLetterStateTransition(
  actionName: string,
  stateBefore: CoverLetterStateSnapshot,
  stateAfter: CoverLetterStateSnapshot,
): CoverLetterStateTransition {
  const entry: CoverLetterStateTransition = {
    timestamp: Date.now(),
    actionName,
    stateBefore,
    stateAfter,
  };
  transitions.push(entry);
  while (transitions.length > MAX_TRANSITIONS) transitions.shift();
  return entry;
}

/**
 * Detect content language. Prefer the UI/selection locale when it matches so
 * Latin names in Japanese/Hindi letters are not mis-classified as English.
 */
export function detectCoverLetterContentLocale(
  content: string,
  preferredLocale?: Locale | null,
): Locale | null {
  if (preferredLocale && contentMatchesRequestedLocale(content, preferredLocale)) {
    return preferredLocale;
  }
  // Script-priority order: never put en before ja/hi/ar/ru.
  const order: Locale[] = [
    'ar',
    'hi',
    'ja',
    'ru',
    'en',
    'de',
    'es',
    'fr',
    'it',
    'sr',
    'hr',
    'pt-BR',
  ];
  return order.find((locale) => contentMatchesRequestedLocale(content, locale)) ?? null;
}

export function toTrustedActiveGroundingStatus(
  status: CoverLetterGroundingStatus | string | null | undefined,
): CoverLetterResultSource | null {
  if (status === 'passed' || status === 'repaired' || status === 'fallback') return status;
  return null;
}

export function createCoverLetterActiveResult(options: {
  content: string;
  locale: Locale;
  gender: CoverLetterGender | string;
  groundingStatus: CoverLetterGroundingStatus | string;
  requestId: string;
  source?: CoverLetterResultSource;
  activatedAt?: number;
}): CoverLetterActiveResult | null {
  const trusted = toTrustedActiveGroundingStatus(options.groundingStatus);
  if (!trusted) return null;
  const content = options.content.trim();
  if (!content) return null;
  if (!contentMatchesRequestedLocale(content, options.locale)) return null;
  return {
    content: options.content,
    locale: options.locale,
    gender: normalizeCoverLetterGender(options.gender),
    groundingStatus: trusted,
    source: options.source ?? trusted,
    requestId: options.requestId,
    activatedAt: options.activatedAt ?? Date.now(),
  };
}

/**
 * Eligibility for preview/copy/PDF/DOCX based on the stable active result.
 * Request cleanup / toast dismissal / generationPhase idle must not invalidate.
 * Only `loading` optionally hides downloads during an in-flight regeneration.
 */
export function isActiveCoverLetterResultEligible(
  result: CoverLetterActiveResult | null,
  selectedLocale: Locale,
  selectedGender: CoverLetterGender | string,
  phase: CoverLetterGenerationPhase,
): boolean {
  if (!result) return false;
  if (phase === 'loading') return false;
  if (!result.content.trim()) return false;
  if (result.locale !== selectedLocale) return false;
  if (result.gender !== normalizeCoverLetterGender(selectedGender)) return false;
  if (!isTrustedCoverLetterGroundingStatus(result.groundingStatus)) return false;
  return contentMatchesRequestedLocale(result.content, selectedLocale);
}

export function snapshotCoverLetterState(partial: Partial<CoverLetterStateSnapshot> & {
  selectedLocale: Locale | null;
}): CoverLetterStateSnapshot {
  return {
    requestId: partial.requestId ?? null,
    activeRequestPresent: partial.activeRequestPresent ?? false,
    activeRequestLocale: partial.activeRequestLocale ?? null,
    activeRequestGender: partial.activeRequestGender ?? null,
    generationPhase: partial.generationPhase ?? 'idle',
    isGenerating: partial.isGenerating ?? false,
    contentLength: partial.contentLength ?? 0,
    contentLocale: partial.contentLocale ?? null,
    groundingStatus: partial.groundingStatus ?? null,
    resultSource: partial.resultSource ?? null,
    downloadsAllowed: partial.downloadsAllowed ?? false,
    copyAllowed: partial.copyAllowed ?? false,
    selectedLocale: partial.selectedLocale,
    selectedGenderNormalized: partial.selectedGenderNormalized ?? null,
    lastActivationTimestamp: partial.lastActivationTimestamp ?? null,
  };
}
