import {
  hashExperienceSourceLocaleText,
  resolveExperienceSourceLocale,
} from '../cv-experience-source-locale';
import {
  hashSummarySourceLocaleText,
  resolveSummarySourceLocale,
} from '../cv-summary-source-locale';
import type { Locale } from '../i18n/translations';
import type { CVData, WorkExperience } from '../types';
import { immutableCopy } from './immutability';

/** Exact product vocabulary for an explicit future M6 target selection. */
export const CONTENT_LOCALIZE_M6_TARGET_LOCALES = [
  'sr', 'en', 'hi', 'ar', 'ja', 'de', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru',
] as const;

export type ContentLocalizeM6TargetLocale = (typeof CONTENT_LOCALIZE_M6_TARGET_LOCALES)[number];
export type ContentLocalizeM6TargetKind = 'summary' | 'experience_description';

export type ContentLocalizeM6NotApplicableReason = 'unconfirmed' | 'empty_source';
export type ContentLocalizeM6FailureReason =
  | 'source_locale_unresolved'
  | 'target_locale_unsupported'
  | 'target_matches_source'
  | 'experience_entry_missing';

export type ContentLocalizeM6Input = Readonly<{
  operationId: string;
  requestId: string;
  kind: ContentLocalizeM6TargetKind;
  targetLocale: string;
  confirmed: boolean;
  cv: CVData;
  experienceEntryId?: string;
}>;

type ContentLocalizeM6SnapshotCommon = Readonly<{
  operationId: string;
  requestId: string;
  sourceLocale: Locale;
  targetLocale: ContentLocalizeM6TargetLocale;
  sourceText: string;
  sourceTextHash: string;
}>;

export type ContentLocalizeM6SummarySnapshot = ContentLocalizeM6SnapshotCommon & Readonly<{
  kind: 'summary';
}>;

export type ContentLocalizeM6ExperienceSnapshot = ContentLocalizeM6SnapshotCommon & Readonly<{
  kind: 'experience_description';
  experienceEntryId: string;
}>;

export type ContentLocalizeM6Snapshot =
  | ContentLocalizeM6SummarySnapshot
  | ContentLocalizeM6ExperienceSnapshot;

export type ContentLocalizeM6Result =
  | Readonly<{ status: 'not_applicable'; reason: ContentLocalizeM6NotApplicableReason }>
  | Readonly<{ status: 'handled_failure'; reason: ContentLocalizeM6FailureReason }>
  | Readonly<{ status: 'request_ready'; snapshot: ContentLocalizeM6Snapshot }>;

export function isContentLocalizeM6TargetLocale(value: string): value is ContentLocalizeM6TargetLocale {
  return CONTENT_LOCALIZE_M6_TARGET_LOCALES.includes(value as ContentLocalizeM6TargetLocale);
}

function notApplicable(reason: ContentLocalizeM6NotApplicableReason): ContentLocalizeM6Result {
  return immutableCopy({ status: 'not_applicable', reason }) as ContentLocalizeM6Result;
}

function handledFailure(reason: ContentLocalizeM6FailureReason): ContentLocalizeM6Result {
  return immutableCopy({ status: 'handled_failure', reason }) as ContentLocalizeM6Result;
}

function requestReady(snapshot: ContentLocalizeM6Snapshot): ContentLocalizeM6Result {
  return immutableCopy({ status: 'request_ready', snapshot }) as ContentLocalizeM6Result;
}

function validatedTarget(
  sourceLocale: Locale,
  targetLocale: string,
): ContentLocalizeM6TargetLocale | ContentLocalizeM6Result {
  if (!isContentLocalizeM6TargetLocale(targetLocale)) {
    return handledFailure('target_locale_unsupported');
  }
  if (sourceLocale === targetLocale) return handledFailure('target_matches_source');
  return targetLocale;
}

function isFailure(
  value: ContentLocalizeM6TargetLocale | ContentLocalizeM6Result,
): value is ContentLocalizeM6Result {
  return typeof value !== 'string';
}

function summaryOperation(input: ContentLocalizeM6Input): ContentLocalizeM6Result {
  const sourceText = String(input.cv.summary || '');
  if (!sourceText.trim()) return notApplicable('empty_source');

  // M6.2 owns Summary authority. This foundation never consults contentLocale directly.
  const resolved = resolveSummarySourceLocale(input.cv);
  if (!resolved.locale) return handledFailure('source_locale_unresolved');

  const target = validatedTarget(resolved.locale, input.targetLocale);
  if (isFailure(target)) return target;

  const snapshot = immutableCopy({
    operationId: input.operationId,
    requestId: input.requestId,
    kind: 'summary' as const,
    sourceLocale: resolved.locale,
    targetLocale: target,
    sourceText,
    sourceTextHash: hashSummarySourceLocaleText(sourceText),
  }) as ContentLocalizeM6SummarySnapshot;
  return requestReady(snapshot);
}

function exactExperienceDescriptionAuthority(
  exp: WorkExperience,
  cv: CVData,
): Readonly<{ locale: Locale; text: string; hash: string }> | null {
  const text = String(exp.description || '');
  const hash = hashExperienceSourceLocaleText(text);

  // M6.3 must never ask the existing owner to inspect unbound text. Its
  // resolver intentionally retains detector/recovery behavior for legacy
  // callers, so establish the exact persisted binding before entering it.
  if (
    typeof exp.descriptionSourceLocale !== 'string'
    || !exp.descriptionSourceLocale.trim()
    || exp.descriptionSourceLocaleTextHash !== hash
  ) return null;

  const resolved = resolveExperienceSourceLocale(exp, cv.canonicalSnapshot);

  // The existing owner may retain legacy/deterministic recovery behavior for
  // other architectures. M6.3 is narrower: a future translation request is
  // authorized only by an exact, persisted descriptionSourceLocale binding.
  if (
    resolved.resolution !== 'description_source_locale'
    || !resolved.locale
    || exp.descriptionSourceLocaleTextHash !== hash
  ) return null;

  return immutableCopy({ locale: resolved.locale, text, hash });
}

function experienceOperation(input: ContentLocalizeM6Input): ContentLocalizeM6Result {
  const experienceEntryId = String(input.experienceEntryId || '');
  const exp = input.cv.experience.find((entry) => entry.id === experienceEntryId);
  if (!exp) return handledFailure('experience_entry_missing');

  const sourceText = String(exp.description || '');
  if (!sourceText.trim()) return notApplicable('empty_source');

  const authority = exactExperienceDescriptionAuthority(exp, input.cv);
  if (!authority) return handledFailure('source_locale_unresolved');

  const target = validatedTarget(authority.locale, input.targetLocale);
  if (isFailure(target)) return target;

  const snapshot = immutableCopy({
    operationId: input.operationId,
    requestId: input.requestId,
    kind: 'experience_description' as const,
    experienceEntryId: exp.id,
    sourceLocale: authority.locale,
    targetLocale: target,
    sourceText: authority.text,
    sourceTextHash: authority.hash,
  }) as ContentLocalizeM6ExperienceSnapshot;
  return requestReady(snapshot);
}

/**
 * Creates an immutable authorization snapshot for a future provider-capable
 * M6 translation operation. It is pure: no provider, API, persistence, usage,
 * state, UI, or candidate/application behavior belongs in this foundation.
 */
export function createContentLocalizeM6Operation(input: ContentLocalizeM6Input): ContentLocalizeM6Result {
  if (!input.confirmed) return notApplicable('unconfirmed');
  return input.kind === 'summary' ? summaryOperation(input) : experienceOperation(input);
}
