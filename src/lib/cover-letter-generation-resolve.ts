/**
 * Resolve cover-letter API responses into activated content or typed errors.
 * Fail-closed for invalid text, but not fail-dead when a locale+gender fallback exists.
 */
import type { Locale } from './i18n/translations';
import type { CoverLetterFactSet } from './cover-letter-facts';
import {
  normalizeCoverLetterGender,
  type CoverLetterGender,
} from './cover-letter-gender';
import {
  shouldApplyCoverLetterGenerationResult,
  isTrustedCoverLetterGroundingStatus,
  normalizeCoverLetterGroundingStatus,
  type ActiveCoverLetterRequest,
  type CoverLetterGroundingStatus,
} from './cover-letter-flow';
import {
  activateCoverLetterContentWithClientGrounding,
} from './cover-letter-client-grounding';
import {
  buildDeterministicSparseCoverLetter,
  validateCoverLetterGrounding,
} from './cover-letter-grounding';
import {
  assembleCoverLetterContent,
  contentMatchesRequestedLocale,
  sanitizeCoverLetterContent,
} from './cover-letter-generation';
import { normalizeCoverLetterBody } from './cover-letter-header';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from './cover-letter-grounding-diagnostics';

export type CoverLetterGenErrorCode =
  | 'stale_response'
  | 'request_gender_mismatch'
  | 'locale_validation_failed'
  | 'grounding_validation_failed'
  | 'repair_failed'
  | 'fallback_failed'
  | 'malformed_response'
  | 'api_unavailable';

export type CoverLetterToastKind =
  | 'none'
  | 'success'
  | 'api_unavailable'
  | 'grounding_failed'
  | 'wrong_language'
  | 'auth'
  | 'paywall';

export type CoverLetterGenerationDiagnostics = {
  requestId: string;
  selectedLocale: Locale;
  requestLocale: Locale;
  selectedGenderRaw: string;
  selectedGenderNormalized: CoverLetterGender;
  activeRequestGender: CoverLetterGender | null;
  responseReceived: boolean;
  httpStatus: number | null;
  responseKeys: string[];
  responseContentLocale: unknown;
  responseGroundingStatus: unknown;
  responseBackendRevision: unknown;
  serverRepairAttempted: boolean;
  serverFallbackUsed: boolean;
  clientGroundingValid: boolean | null;
  contentMatchesRequestedLocale: boolean | null;
  localRepairAttempted: boolean;
  localFallbackAttempted: boolean;
  localFallbackValidationValid: boolean | null;
  finalActivationDecision: 'success' | 'recovered' | 'rejected' | 'stale';
  rejectedReason: CoverLetterGenErrorCode | null;
  thrownErrorName: string | null;
  thrownErrorMessage: string | null;
  toastCategory: CoverLetterToastKind;
  schemaMismatch: boolean;
};

export type CoverLetterResolveResult = {
  outcome: 'success' | 'recovered' | 'rejected' | 'stale';
  content: string;
  groundingStatus: CoverLetterGroundingStatus;
  errorCode: CoverLetterGenErrorCode | null;
  toastKind: CoverLetterToastKind;
  diagnostics: CoverLetterGenerationDiagnostics;
  clientFallbackUsed: boolean;
};

let lastDiagnostics: CoverLetterGenerationDiagnostics | null = null;

export function getLastCoverLetterGenerationDiagnostics(): CoverLetterGenerationDiagnostics | null {
  return lastDiagnostics;
}

export function formatCoverLetterGenerationDiagnosticsForCopy(): string {
  if (!lastDiagnostics) return 'No cover-letter generation diagnostics recorded yet.';
  return JSON.stringify(lastDiagnostics, null, 2);
}

function localizedDateLine(locale: Locale): string {
  try {
    return new Date().toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return new Date().toLocaleDateString('en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
}

function buildValidatedLocalFallback(options: {
  locale: Locale;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  factSet: CoverLetterFactSet;
  gender: CoverLetterGender;
}): { content: string; valid: boolean } {
  const letter = buildDeterministicSparseCoverLetter(options.locale, {
    candidateName: options.candidateName,
    jobTitle: options.jobTitle,
    companyName: options.companyName,
    factSet: options.factSet,
    dateLine: localizedDateLine(options.locale),
    gender: options.gender,
  });
  const content = normalizeCoverLetterBody(
    assembleCoverLetterContent(letter),
    options.candidateName,
  );
  const grounding = validateCoverLetterGrounding(content, options.factSet);
  const localeOk = contentMatchesRequestedLocale(content, options.locale);
  return { content, valid: grounding.valid && localeOk && content.trim().length > 0 };
}

function finish(
  result: CoverLetterResolveResult,
): CoverLetterResolveResult {
  lastDiagnostics = result.diagnostics;
  return result;
}

export function resolveCoverLetterGenerationResult(options: {
  active: ActiveCoverLetterRequest | null;
  requestId: string;
  requestedLocale: Locale;
  selectedLocale: Locale;
  selectedGenderRaw: string;
  requestedGenderNormalized: CoverLetterGender;
  apiError?: { message?: string; status?: number; name?: string } | null;
  serverContent?: string | null;
  serverGroundingRaw?: unknown;
  backendRevision?: unknown;
  repairAttempted?: unknown;
  fallbackUsed?: unknown;
  httpStatus?: number | null;
  responseKeys?: string[];
  responseContentLocale?: unknown;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  factSet: CoverLetterFactSet;
}): CoverLetterResolveResult {
  const selectedGenderNormalized = normalizeCoverLetterGender(options.selectedGenderRaw);
  const requestedGender = normalizeCoverLetterGender(options.requestedGenderNormalized);
  const activeGender = options.active?.gender ?? null;

  const baseDiag: CoverLetterGenerationDiagnostics = {
    requestId: options.requestId,
    selectedLocale: options.selectedLocale,
    requestLocale: options.requestedLocale,
    selectedGenderRaw: options.selectedGenderRaw,
    selectedGenderNormalized,
    activeRequestGender: activeGender,
    responseReceived: options.apiError == null && options.serverContent != null,
    httpStatus: options.httpStatus ?? (options.apiError?.status ?? null),
    responseKeys: options.responseKeys ?? [],
    responseContentLocale: options.responseContentLocale ?? null,
    responseGroundingStatus: options.serverGroundingRaw ?? null,
    responseBackendRevision: options.backendRevision ?? null,
    serverRepairAttempted: Boolean(options.repairAttempted),
    serverFallbackUsed: Boolean(options.fallbackUsed),
    clientGroundingValid: null,
    contentMatchesRequestedLocale: null,
    localRepairAttempted: false,
    localFallbackAttempted: false,
    localFallbackValidationValid: null,
    finalActivationDecision: 'rejected',
    rejectedReason: null,
    thrownErrorName: options.apiError?.name ?? null,
    thrownErrorMessage: options.apiError?.message ?? null,
    toastCategory: 'none',
    schemaMismatch:
      typeof options.backendRevision === 'string'
        ? options.backendRevision !== COVER_LETTER_GROUNDING_BACKEND_REVISION
        : options.backendRevision != null,
  };

  // Stale / gender correlation — request snapshot is source of truth
  if (
    !shouldApplyCoverLetterGenerationResult(
      options.active,
      options.requestId,
      options.requestedLocale,
      requestedGender,
    )
  ) {
    const genderMismatch =
      options.active != null &&
      options.active.requestId === options.requestId &&
      options.active.locale === options.requestedLocale &&
      options.active.gender !== requestedGender;
    const code: CoverLetterGenErrorCode = genderMismatch
      ? 'request_gender_mismatch'
      : 'stale_response';
    return finish({
      outcome: 'stale',
      content: '',
      groundingStatus: 'unknown',
      errorCode: code,
      toastKind: 'none',
      clientFallbackUsed: false,
      diagnostics: {
        ...baseDiag,
        finalActivationDecision: 'stale',
        rejectedReason: code,
        toastCategory: 'none',
      },
    });
  }

  const tryFallback = (reason: CoverLetterGenErrorCode): CoverLetterResolveResult => {
    baseDiag.localFallbackAttempted = true;
    const fallback = buildValidatedLocalFallback({
      locale: options.requestedLocale,
      candidateName: options.candidateName,
      jobTitle: options.jobTitle,
      companyName: options.companyName,
      factSet: options.factSet,
      gender: requestedGender,
    });
    baseDiag.localFallbackValidationValid = fallback.valid;
    if (fallback.valid) {
      return finish({
        outcome: 'recovered',
        content: fallback.content,
        groundingStatus: 'fallback',
        errorCode: null,
        toastKind: 'none',
        clientFallbackUsed: true,
        diagnostics: {
          ...baseDiag,
          finalActivationDecision: 'recovered',
          rejectedReason: null,
          toastCategory: 'none',
          contentMatchesRequestedLocale: true,
        },
      });
    }
    const toastKind: CoverLetterToastKind =
      reason === 'api_unavailable' || reason === 'malformed_response'
        ? 'api_unavailable'
        : reason === 'locale_validation_failed'
          ? 'wrong_language'
          : 'grounding_failed';
    return finish({
      outcome: 'rejected',
      content: '',
      groundingStatus: 'failed',
      errorCode: 'fallback_failed',
      toastKind,
      clientFallbackUsed: false,
      diagnostics: {
        ...baseDiag,
        finalActivationDecision: 'rejected',
        rejectedReason: 'fallback_failed',
        toastCategory: toastKind,
      },
    });
  };

  // API / network failure — recover via deterministic fallback when possible
  if (options.apiError) {
    if (options.apiError.name === 'AbortError') {
      return finish({
        outcome: 'stale',
        content: '',
        groundingStatus: 'unknown',
        errorCode: 'stale_response',
        toastKind: 'none',
        clientFallbackUsed: false,
        diagnostics: {
          ...baseDiag,
          finalActivationDecision: 'stale',
          rejectedReason: 'stale_response',
          toastCategory: 'none',
        },
      });
    }
    if (options.apiError.status === 403) {
      return finish({
        outcome: 'rejected',
        content: '',
        groundingStatus: 'failed',
        errorCode: 'api_unavailable',
        toastKind: 'auth',
        clientFallbackUsed: false,
        diagnostics: {
          ...baseDiag,
          finalActivationDecision: 'rejected',
          rejectedReason: 'api_unavailable',
          toastCategory: 'auth',
        },
      });
    }
    return tryFallback('api_unavailable');
  }

  const rawContent = options.serverContent;
  if (typeof rawContent !== 'string') {
    return tryFallback('malformed_response');
  }

  const sanitized = sanitizeCoverLetterContent(rawContent);
  if (!sanitized.trim()) {
    return tryFallback('malformed_response');
  }

  const localeOk = contentMatchesRequestedLocale(sanitized, options.requestedLocale);
  baseDiag.contentMatchesRequestedLocale = localeOk;

  if (!localeOk) {
    // Never activate wrong-language draft; recover with known-locale fallback.
    return tryFallback('locale_validation_failed');
  }

  const activation = activateCoverLetterContentWithClientGrounding({
    serverContent: sanitized,
    serverGroundingRaw: options.serverGroundingRaw,
    backendRevision: options.backendRevision,
    locale: options.requestedLocale,
    candidateName: options.candidateName,
    jobTitle: options.jobTitle,
    companyName: options.companyName,
    factSet: options.factSet,
    gender: requestedGender,
  });

  baseDiag.clientGroundingValid = activation.accepted && !activation.clientFallbackUsed
    ? true
    : activation.violations.length === 0;
  baseDiag.localFallbackAttempted = activation.clientFallbackUsed;
  baseDiag.localFallbackValidationValid = activation.clientFallbackUsed
    ? activation.accepted
    : null;
  baseDiag.schemaMismatch = activation.schemaMismatch || baseDiag.schemaMismatch;
  baseDiag.localRepairAttempted = Boolean(options.repairAttempted);

  if (activation.accepted && activation.content.trim() && isTrustedCoverLetterGroundingStatus(activation.groundingStatus)) {
    // Fallback content must also match locale (deterministic templates should).
    if (!contentMatchesRequestedLocale(activation.content, options.requestedLocale)) {
      return tryFallback('locale_validation_failed');
    }
    const recovered = activation.clientFallbackUsed;
    return finish({
      outcome: recovered ? 'recovered' : 'success',
      content: activation.content,
      groundingStatus: activation.groundingStatus,
      errorCode: null,
      toastKind: 'none',
      clientFallbackUsed: activation.clientFallbackUsed,
      diagnostics: {
        ...baseDiag,
        contentMatchesRequestedLocale: true,
        finalActivationDecision: recovered ? 'recovered' : 'success',
        rejectedReason: null,
        toastCategory: 'none',
      },
    });
  }

  // Activation rejected — one more explicit fallback attempt
  return tryFallback(
    activation.violations.length > 0 ? 'grounding_validation_failed' : 'fallback_failed',
  );
}
