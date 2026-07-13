import type { Locale } from './i18n/translations';
import { contentMatchesRequestedLocale } from './cover-letter-generation';

export type CoverLetterGenerationPhase = 'idle' | 'loading' | 'success' | 'error';

/** Trusted grounding outcomes that may become active content. */
export type CoverLetterGroundingStatus =
  | 'unknown'
  | 'passed'
  | 'repaired'
  | 'fallback'
  | 'failed'
  | 'invalid'
  | 'missing';

export const COVER_LETTER_TRUSTED_GROUNDING_STATUSES: ReadonlyArray<CoverLetterGroundingStatus> = [
  'passed',
  'repaired',
  'fallback',
];

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

export function isTrustedCoverLetterGroundingStatus(
  status: CoverLetterGroundingStatus | string | null | undefined,
): status is 'passed' | 'repaired' | 'fallback' {
  return status === 'passed' || status === 'repaired' || status === 'fallback';
}

/**
 * Normalize raw API grounding metadata. Missing/unknown/malformed values must NOT
 * become trusted — they become `missing` or `invalid`.
 */
export function normalizeCoverLetterGroundingStatus(
  raw: unknown,
): CoverLetterGroundingStatus {
  if (raw == null || raw === '') return 'missing';
  if (typeof raw !== 'string') return 'invalid';
  const value = raw.trim().toLowerCase();
  if (value === 'passed' || value === 'validated') return 'passed';
  if (value === 'repaired') return 'repaired';
  if (value === 'fallback') return 'fallback';
  if (value === 'failed' || value === 'invalid') return value as CoverLetterGroundingStatus;
  if (value === 'unknown' || value === 'missing') return value as CoverLetterGroundingStatus;
  return 'invalid';
}

/**
 * Preview/download may show content only when language matches and grounding is trusted.
 * `unknown` / `missing` / `failed` / `invalid` are fail-closed.
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
  if (!isTrustedCoverLetterGroundingStatus(groundingStatus)) return false;
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
