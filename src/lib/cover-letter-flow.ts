import type { Locale } from './i18n/translations';
import { contentMatchesRequestedLocale } from './cover-letter-generation';

export type CoverLetterGenerationPhase = 'idle' | 'loading' | 'success' | 'error';
export type CoverLetterGroundingStatus = 'unknown' | 'passed' | 'repaired' | 'fallback' | 'failed';

export type ActiveCoverLetterRequest = {
  requestId: string;
  locale: Locale;
};

export function createCoverLetterRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** True when this response belongs to the newest in-flight generation for the same locale. */
export function shouldApplyCoverLetterGenerationResult(
  active: ActiveCoverLetterRequest | null,
  responseRequestId: string,
  requestedLocale: Locale,
): boolean {
  if (!active) return false;
  return active.requestId === responseRequestId && active.locale === requestedLocale;
}

/**
 * Preview/download may show persisted content only when it was generated (or manually
 * edited) for the currently selected content language and is not mid-generation.
 */
export function isCoverLetterContentCurrent(
  content: string,
  contentLocale: Locale | null,
  selectedLocale: Locale,
  phase: CoverLetterGenerationPhase,
  groundingStatus: CoverLetterGroundingStatus = 'unknown',
): boolean {
  if (phase === 'loading') return false;
  if (!content.trim()) return false;
  if (!contentLocale || contentLocale !== selectedLocale) return false;
  if (groundingStatus === 'failed') return false;
  return contentMatchesRequestedLocale(content, selectedLocale);
}

export function isCoverLetterDownloadAllowed(
  content: string,
  contentLocale: Locale | null,
  selectedLocale: Locale,
  phase: CoverLetterGenerationPhase,
  groundingStatus: CoverLetterGroundingStatus = 'unknown',
): boolean {
  return isCoverLetterContentCurrent(content, contentLocale, selectedLocale, phase, groundingStatus);
}
