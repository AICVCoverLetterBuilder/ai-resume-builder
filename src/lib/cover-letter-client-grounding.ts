/**
 * Client-side fail-closed grounding for cover-letter responses.
 * Never treats missing/legacy grounding metadata as validated.
 */
import type { Locale } from './i18n/translations';
import type { CoverLetterFactSet } from './cover-letter-facts';
import {
  normalizeCoverLetterGroundingStatus,
  isTrustedCoverLetterGroundingStatus,
  type CoverLetterGroundingStatus,
} from './cover-letter-flow';
import {
  buildDeterministicSparseCoverLetter,
  validateCoverLetterGrounding,
  type GroundingViolation,
} from './cover-letter-grounding';
import { assembleCoverLetterContent } from './cover-letter-generation';
import { normalizeCoverLetterBody } from './cover-letter-header';
import { COVER_LETTER_GROUNDING_BACKEND_REVISION } from './cover-letter-grounding-diagnostics';

export type ClientGroundingActivation = {
  content: string;
  groundingStatus: CoverLetterGroundingStatus;
  serverGroundingStatus: CoverLetterGroundingStatus;
  clientFallbackUsed: boolean;
  validatorStarted: boolean;
  validatorCompleted: boolean;
  violations: GroundingViolation[];
  schemaMismatch: boolean;
  accepted: boolean;
};

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

function buildLocalSparseFallback(options: {
  locale: Locale;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  factSet: CoverLetterFactSet;
}): string {
  const letter = buildDeterministicSparseCoverLetter(options.locale, {
    candidateName: options.candidateName,
    jobTitle: options.jobTitle,
    companyName: options.companyName,
    factSet: options.factSet,
    dateLine: localizedDateLine(options.locale),
  });
  return normalizeCoverLetterBody(assembleCoverLetterContent(letter), options.candidateName);
}

/**
 * Decide what (if anything) may become active cover-letter content.
 *
 * Rules:
 * - Always run client-side validation on server text.
 * - Missing/unknown/invalid/failed server grounding never auto-activates
 *   unvalidated server text (no `?? "validated"` / `?? "passed"` bypass).
 * - Client validation failure → local deterministic sparse fallback (when possible).
 * - Client + trusted server → activate server text.
 * - Client pass with missing server metadata → activate only after client pass
 *   (client-attested `passed`), never by coercing missing → passed blindly.
 */
export function activateCoverLetterContentWithClientGrounding(options: {
  serverContent: string;
  serverGroundingRaw: unknown;
  backendRevision: unknown;
  locale: Locale;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  factSet: CoverLetterFactSet;
}): ClientGroundingActivation {
  const serverGroundingStatus = normalizeCoverLetterGroundingStatus(options.serverGroundingRaw);
  const schemaMismatch =
    typeof options.backendRevision !== 'string' ||
    options.backendRevision !== COVER_LETTER_GROUNDING_BACKEND_REVISION;

  const validatorStarted = true;
  const grounding = validateCoverLetterGrounding(options.serverContent, options.factSet);
  const validatorCompleted = true;

  if (grounding.valid && isTrustedCoverLetterGroundingStatus(serverGroundingStatus)) {
    return {
      content: normalizeCoverLetterBody(options.serverContent, options.candidateName),
      groundingStatus: serverGroundingStatus,
      serverGroundingStatus,
      clientFallbackUsed: false,
      validatorStarted,
      validatorCompleted,
      violations: [],
      schemaMismatch,
      accepted: true,
    };
  }

  // Client-attested pass when server omitted grounding (legacy) but text is clean.
  if (
    grounding.valid &&
    (serverGroundingStatus === 'missing' || serverGroundingStatus === 'unknown')
  ) {
    return {
      content: normalizeCoverLetterBody(options.serverContent, options.candidateName),
      groundingStatus: 'passed',
      serverGroundingStatus,
      clientFallbackUsed: false,
      validatorStarted,
      validatorCompleted,
      violations: [],
      schemaMismatch,
      accepted: true,
    };
  }

  // Invented / untrusted content — never activate as-is; use local sparse fallback.
  const fallback = buildLocalSparseFallback({
    locale: options.locale,
    candidateName: options.candidateName,
    jobTitle: options.jobTitle,
    companyName: options.companyName,
    factSet: options.factSet,
  });
  const fallbackGrounding = validateCoverLetterGrounding(fallback, options.factSet);

  if (fallbackGrounding.valid) {
    return {
      content: fallback,
      groundingStatus: 'fallback',
      serverGroundingStatus,
      clientFallbackUsed: true,
      validatorStarted,
      validatorCompleted,
      violations: grounding.violations,
      schemaMismatch,
      accepted: true,
    };
  }

  return {
    content: '',
    groundingStatus: grounding.valid ? serverGroundingStatus : 'invalid',
    serverGroundingStatus,
    clientFallbackUsed: false,
    validatorStarted,
    validatorCompleted,
    violations: grounding.violations.length > 0 ? grounding.violations : fallbackGrounding.violations,
    schemaMismatch,
    accepted: false,
  };
}
