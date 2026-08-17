import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { buildFactSetFromExperienceDescription } from './cv-canonical-facts';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { detectExperienceUnsupportedClaimExpansion } from './cv-experience-unsupported-claims';
import { validateCrossEntryExperienceLeakage } from './cv-experience-entry-isolation';
import { localesEquivalent } from './cv-content-locale';
import { resolveExperienceSourceLocale } from './cv-experience-source-locale';
import {
  isAcceptableExperiencePresentationPurity,
  recoverExperiencePresentationFromSource,
} from './cv-content-quality';
import { validateLocalizedExperienceBullets } from './cv-semantic-fidelity';
import {
  recoverSemanticDutiesFromUserOrigin,
  type ExperienceSemanticGrounding,
  type RecoveredSemanticDuty,
} from './cv-semantic-duty-facts';
import type { Locale } from './i18n/translations';
import type { CVData, WorkExperience } from './types';

export const EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA = 1 as const;
export const EXPERIENCE_LOCALIZED_SURFACE_SCHEMA =
  'experience-localized-surface-399-v1' as const;
export const EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION =
  'experience-localization-independent-validator-399-v2' as const;
export const EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE = 6;
export const EXPERIENCE_LOCALIZATION_INVARIANT_PASSTHROUGH_REVISION =
  'experience-localization-invariant-passthrough-402-v1' as const;
export const EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS = 5_000;
export const EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_UTF8_BYTES = 15_000;
export const EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS =
  EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS;

export type ExperienceLocalizationProvenance = 'provider' | 'provider_repair';

export type ExperienceLocalizedSurfaceBinding = {
  cvId: string;
  experienceId: string;
  experienceLineageHash: string;
  sourceClauseIndex: number;
  sourceClauseHash: string;
  semanticFactId: string;
  sourceLocale: Locale;
  targetLocale: Locale;
  canonicalLineageHash: string;
};

export type PersistedExperienceLocalizedSurface = ExperienceLocalizedSurfaceBinding & {
  surfaceSchema: typeof EXPERIENCE_LOCALIZED_SURFACE_SCHEMA;
  bindingKey: string;
  localizedText: string;
  localizedTextHash: string;
  localizationProvenance: ExperienceLocalizationProvenance;
  validatorDecision: 'passed';
  validatorVersion: typeof EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION;
  validationProvenance: 'independent_provider_verification';
  validatedCandidateHash: string;
  validatedAt: string;
  createdAt: string;
};

export type ExperienceLocalizedSurfaceStore = {
  schemaVersion: typeof EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA;
  surfaces: Record<string, PersistedExperienceLocalizedSurface>;
};

/**
 * One display-only Experience projection shared by preview and export.
 * It deliberately keeps the current textarea and immutable grounding apart:
 * the former is presentation authority when target-valid; the latter is used
 * only to locate a persisted, independently validated target projection.
 */
export type ExperiencePresentationAuthority =
  | 'current_visible'
  | 'validated_target_projection'
  | 'same_entry_semantic_recovery'
  | 'unresolved';

export type ExperiencePresentationRecord = {
  owningEntryHash: string;
  currentVisibleDescriptionHash: string;
  immutableFactSetHash: string;
  sourceLocale: string | null;
  targetLocale: Locale;
  projectionRequired: boolean;
  presentationAuthority: ExperiencePresentationAuthority;
  recoveryAttempted: boolean;
  recoveryKind: 'same_entry_semantic_recovery' | 'validated_target_projection' | null;
  rejectionReason: string | null;
  selectedPresentationHash: string;
  finalPresentationHash: string;
  requiredFactCount: number | null;
  coveredFactCount: number | null;
  missingFactCount: number | null;
  factCoveragePassed: boolean | null;
  detectedLocaleByBullet: Array<string | null>;
  detectedScriptByBullet: string[];
  mixedLanguageBulletCount: number;
  sourceLanguageLeakageDetected: boolean;
  crossEntryOwnershipPassed: boolean;
};

export type ExperiencePresentationSnapshot = {
  cv: CVData;
  records: ExperiencePresentationRecord[];
  ok: boolean;
};

function evaluatePresentationFactCoverage(
  exp: WorkExperience,
  description: string,
  locale: Locale,
): { required: number | null; covered: number | null; missing: number | null; passed: boolean | null } {
  const source = String(exp.originalUserDescription || exp.canonicalDescription || '').trim();
  if (!source || !description.trim()) {
    return { required: null, covered: null, missing: null, passed: null };
  }
  const factSet = buildFactSetFromExperienceDescription(source, {
    company: exp.company,
    position: exp.position,
    startDate: exp.startDate,
    endDate: exp.endDate,
    isPresent: exp.isPresent,
  });
  const required = factSet.facts.filter((fact) => fact.type === 'experience_bullet').length;
  const result = validateLocalizedExperienceBullets(description, factSet, {
    locale,
    experienceIndex: 0,
    isPresent: exp.isPresent,
    stage: 'presentation_snapshot',
  });
  if (result.valid) {
    return { required, covered: required, missing: 0, passed: true };
  }
  // Do not manufacture partial coverage from a failed presentation check.
  // The validator either establishes complete entry-owned coverage or leaves
  // coverage unevaluated for this diagnostic snapshot.
  return { required, covered: null, missing: null, passed: false };
}

export type ExperienceLocalizationRequestRecord = ExperienceLocalizedSurfaceBinding & {
  requestIdentity: string;
  sourceText: string;
};

export type ExperienceLocalizationSemanticValidation = {
  validatorVersion: typeof EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION;
  predicatePreserved: boolean;
  objectPreserved: boolean;
  workDomainPreserved: boolean;
  scopePreserved: boolean;
  negationPreserved: boolean;
  tensePreserved: boolean;
  unsupportedFactsIntroduced: boolean;
};

export type ExperienceLocalizationMismatchCategory =
  | 'none'
  | 'predicate_mismatch'
  | 'object_mismatch'
  | 'work_domain_mismatch'
  | 'source_responsibility_removed'
  | 'scope_mismatch'
  | 'negation_mismatch'
  | 'tense_mismatch'
  | 'unsupported_responsibility_added'
  | 'cross_entry_fact'
  | 'cross_occupation_substitution'
  | 'ambiguous';

export type ExperienceLocalizationIndependentVerificationRecord =
  ExperienceLocalizedSurfaceBinding & {
    requestIdentity: string;
    candidateSurfaceHash: string;
    decision: 'passed' | 'rejected';
    mismatchCategory: ExperienceLocalizationMismatchCategory;
    predicatePreserved: boolean;
    objectPreserved: boolean;
    workDomainPreserved: boolean;
    sourceResponsibilityPreserved: boolean;
    scopePreserved: boolean;
    negationPreserved: boolean;
    tensePreserved: boolean;
    unsupportedFactsIntroduced: boolean;
    crossEntryFactIntroduced: boolean;
    crossOccupationSubstitution: boolean;
  };

export type ExperienceLocalizationIndependentVerificationResponse = {
  snapshotId: string;
  targetLocale: string;
  validatorVersion: typeof EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION;
  records: ExperienceLocalizationIndependentVerificationRecord[];
  /** Actual bounded verifier attempts (1 primary, optionally 1 retry). */
  verifierAttemptCount?: number;
};

export type ExperienceLocalizationProviderRecord = ExperienceLocalizedSurfaceBinding & {
  requestIdentity: string;
  localizedText: string;
  /** Translator-authored compatibility hint. Never used to authorize acceptance. */
  semanticValidation: ExperienceLocalizationSemanticValidation;
};

export type ExperienceLocalizationProviderResponse = {
  snapshotId: string;
  targetLocale: string;
  records: ExperienceLocalizationProviderRecord[];
  provenance?: ExperienceLocalizationProvenance;
  /** Actual bounded server-provider attempts (1 primary, optionally 1 retry). */
  providerAttemptCount?: number;
  independentVerification: ExperienceLocalizationIndependentVerificationResponse;
};

export type ExperienceLocalizationRequest = {
  task: 'localize_cv_experience_surfaces';
  snapshotId: string;
  targetLocale: Locale;
  records: ExperienceLocalizationRequestRecord[];
};

export type ExperienceLocalizationAdapter = (
  request: ExperienceLocalizationRequest,
  context?: { batchIndex: number; batchCount: number },
) => Promise<ExperienceLocalizationProviderResponse>;

export type ExperienceLocalizationDiagnostics = {
  exportSnapshotId: string;
  experienceEntryCount: number;
  sourceClauseCount: number;
  sourceLocaleByEntry: Record<string, string>;
  sourceLocaleResolutionByEntry: Record<string, string>;
  targetLocale: Locale;
  surfaceHitCount: number;
  missingSurfaceCount: number;
  providerRequestCount: number;
  providerRepairCount: number;
  independentVerifierRequestCount: number;
  returnedRecordCount: number;
  validatedRecordCount: number;
  independentlyValidatedRecordCount: number;
  independentlyRejectedRecordCount: number;
  independentValidatorVersion: typeof EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION;
  semanticMismatchCategory?: ExperienceLocalizationMismatchCategory;
  identityMismatch: boolean;
  candidateHashMismatch: boolean;
  persistedSurfaceCount: number;
  cacheReuseCount: number;
  staleResponseRejected: boolean;
  translationResponded?: boolean;
  translationParserPassed?: boolean;
  compactTranslatorIdsValidated?: boolean;
  fullIdentitiesReconstructed?: boolean;
  candidateHashesComputed?: boolean;
  verifierDispatched?: boolean;
  verifierResponded?: boolean;
  verifierParserReached?: boolean;
  verifiedRecordCount?: number;
  routeRemainingAtVerifierDispatchMs?: number;
  invariantPassthroughCount?: number;
  providerTranslatableRecordCount?: number;
  invariantPassthroughRevision?: typeof EXPERIENCE_LOCALIZATION_INVARIANT_PASSTHROUGH_REVISION;
  titleLocalizationRevision?: string;
  titleTargetLocale?: Locale;
  titleFieldCount?: number;
  titleUniqueSourceCount?: number;
  titleSameLocaleCount?: number;
  titleDeterministicCount?: number;
  titleCacheReuseCount?: number;
  titleProviderRequestCount?: number;
  titleProviderRepairCount?: number;
  titleLocalizedFieldCount?: number;
  titleSummaryMentionReplacementCount?: number;
  titleSourceLocaleByField?: Record<string, Locale>;
  titleProjectionPassed?: boolean;
  employerIdentityPassed?: boolean;
  titlePostProjectionValidationPassed?: boolean;
  titlePostProjectionFailureReason?: string;
  titleFailureReason?: string;
  exportDraftIsolationRevision?: string;
  exportDraftVisibleContentPreserved?: boolean;
  titleTransportFailureReason?: string;
  titleTransportFailureStage?: string;
  titleTransportHttpStatus?: number | null;
  titleTransportApplicationCode?: string | null;
  titleTransportProviderStatus?: number | string | null;
  titleTransportDeadlineOwner?: string | null;
  titleTransportTranslatorAttemptCount?: number | null;
  titleTransportVerifierAttemptCount?: number | null;
  titleTransportRetryAfterSec?: number | null;
  titleTransportRepairContextPresent?: boolean;
  titleTransportRecovered?: boolean;
  failureStage?: string;
  failureReason?: string;
};

export type ExperienceLocalizationSnapshot = {
  ok: boolean;
  reason?: string;
  snapshotId: string;
  targetLocale: Locale;
  records: ExperienceLocalizationRequestRecord[];
  missingRecords: ExperienceLocalizationRequestRecord[];
  cachedSurfaces: PersistedExperienceLocalizedSurface[];
  diagnostics: ExperienceLocalizationDiagnostics;
};

export type PrepareExperienceLocalizedSurfacesResult =
  | {
    ok: true;
    cv: CVData;
    snapshot: ExperienceLocalizationSnapshot;
    diagnostics: ExperienceLocalizationDiagnostics;
  }
  | {
    ok: false;
    cv: CVData;
    reason: string;
    stage: string;
    snapshot: ExperienceLocalizationSnapshot;
    diagnostics: ExperienceLocalizationDiagnostics;
  };

export function canonicalizeExperienceLocalizationText(text: string): string {
  return String(text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

const INVARIANT_EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/iu;
const INVARIANT_URL_RE = /^(?:https?:\/\/|www\.)\S+$/iu;
const INVARIANT_PHONE_RE = /^\+?\d[\d\s().-]{6,}\d$/u;
const INVARIANT_MACHINE_TOKEN_RE = /^[\p{Lu}\p{N}._:/+#-]+$/u;

/**
 * Machine-readable / non-linguistic units must remain exact across locales.
 * Real prose still requires provider translation and normal locale validation.
 */
export function isExperienceLocalizationInvariantUnit(text: string): boolean {
  const canonical = canonicalizeExperienceLocalizationText(text);
  if (!canonical) return false;
  if (
    INVARIANT_EMAIL_RE.test(canonical)
    || INVARIANT_URL_RE.test(canonical)
    || INVARIANT_PHONE_RE.test(canonical)
  ) {
    return true;
  }
  const tokens = canonical
    .split(/\s+/u)
    .map((token) => token.replace(/^[([{"'“”]+|[)\]}"'“”,.;!?…]+$/gu, ''))
    .filter(Boolean);
  if (tokens.length === 0) return false;
  const allMachineTokens = tokens.every((token) => INVARIANT_MACHINE_TOKEN_RE.test(token));
  const hasIdentifierEvidence = tokens.some((token) => /[\p{N}_:/+#-]/u.test(token));
  return allMachineTokens && hasIdentifierEvidence;
}

export function measureExperienceLocalizationText(text: string) {
  const canonicalText = canonicalizeExperienceLocalizationText(text);
  return { canonicalText, canonicalChars: canonicalText.length, utf8Bytes: new TextEncoder().encode(canonicalText).length };
}

export function experienceDescriptionLocalizationLimitViolation(text: string) {
  const clauses = splitExperienceBullets(text || '');
  for (let sourceClauseIndex = 0; sourceClauseIndex < clauses.length; sourceClauseIndex += 1) {
    const canonicalChars = measureExperienceLocalizationText(clauses[sourceClauseIndex] || '').canonicalChars;
    if (canonicalChars > EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS) {
      return { sourceClauseIndex, canonicalChars, maxCanonicalChars: EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS };
    }
  }
  return null;
}

export function hashExperienceLocalizedSurfaceValue(text: string): string {
  const normalized = canonicalizeExperienceLocalizationText(text);
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}_l${normalized.length}`;
}

function stableMaterial(parts: Array<string | number | boolean>): string {
  return parts.map((part) => String(part)).join('\u001f');
}

function experienceLineageHash(exp: WorkExperience): string {
  return hashExperienceLocalizedSurfaceValue(stableMaterial([
    exp.id,
    canonicalizeExperienceLocalizationText(exp.position || ''),
    canonicalizeExperienceLocalizationText(exp.company || ''),
    exp.startDate || '',
    exp.endDate || '',
    Boolean(exp.isPresent),
  ]));
}

function canonicalLineageHash(
  cv: CVData,
  exp: WorkExperience,
  grounding: ExperienceSemanticGrounding,
): string {
  const snapshot = cv.canonicalSnapshot;
  if (!snapshot || snapshot.canonicalState !== 'valid') return 'none';
  const matches = snapshot.canonicalExperiences.filter((entry) => entry.experienceId === exp.id);
  if (matches.length !== 1) return 'none';
  const bullets = [...matches[0].bullets].sort((a, b) => a.order - b.order);
  if (
    bullets.length !== grounding.duties.length
    || bullets.some((bullet, index) => (
      bullet.order !== index
      || hashExperienceLocalizedSurfaceValue(bullet.sourceText)
        !== grounding.duties[index]?.sourceClauseHash
      || bullet.factId !== grounding.duties[index]?.sourceFactId
    ))
  ) return 'none';
  return hashExperienceLocalizedSurfaceValue(stableMaterial([
    snapshot.canonicalSourceHash,
    snapshot.canonicalRevision,
    snapshot.canonicalLocale,
    exp.id,
  ]));
}

export function buildExperienceLocalizedSurfaceBindingKey(
  binding: ExperienceLocalizedSurfaceBinding,
): string {
  return `exp_surface_${hashExperienceLocalizedSurfaceValue(stableMaterial([
    EXPERIENCE_LOCALIZED_SURFACE_SCHEMA,
    binding.cvId,
    binding.experienceId,
    binding.experienceLineageHash,
    binding.sourceClauseIndex,
    binding.sourceClauseHash,
    binding.semanticFactId,
    binding.sourceLocale,
    binding.targetLocale,
    binding.canonicalLineageHash,
  ]))}`;
}

function sourceLocaleForGrounding(grounding: ExperienceSemanticGrounding): {
  locale: Locale | null;
  resolution: string;
} {
  const locales = [...new Set(grounding.duties.map((duty) => duty.sourceLocale || 'unknown'))];
  const resolutions = [
    ...new Set(grounding.duties.map((duty) => duty.sourceLocaleResolution || 'ambiguous')),
  ];
  if (locales.length !== 1 || resolutions.length !== 1 || locales[0] === 'unknown') {
    return { locale: null, resolution: 'ambiguous' };
  }
  return { locale: locales[0] as Locale, resolution: resolutions[0] };
}

function recordForDuty(options: {
  cv: CVData;
  exp: WorkExperience;
  grounding: ExperienceSemanticGrounding;
  duty: RecoveredSemanticDuty;
  sourceLocale: Locale;
  targetLocale: Locale;
}): ExperienceLocalizationRequestRecord {
  const sourceText = canonicalizeExperienceLocalizationText(options.duty.sourceClause || '');
  const binding: ExperienceLocalizedSurfaceBinding = {
    cvId: options.cv.id || 'missing-cv-id',
    experienceId: options.exp.id,
    experienceLineageHash: experienceLineageHash(options.exp),
    sourceClauseIndex: options.duty.sourceClauseIndex ?? 0,
    sourceClauseHash: options.duty.sourceClauseHash || hashExperienceLocalizedSurfaceValue(sourceText),
    semanticFactId: options.duty.sourceFactId || options.duty.key,
    sourceLocale: options.sourceLocale,
    targetLocale: options.targetLocale,
    canonicalLineageHash: canonicalLineageHash(options.cv, options.exp, options.grounding),
  };
  return {
    ...binding,
    requestIdentity: buildExperienceLocalizedSurfaceBindingKey(binding),
    sourceText,
  };
}

function bindingFieldsMatch(
  expected: ExperienceLocalizedSurfaceBinding,
  actual: ExperienceLocalizedSurfaceBinding,
): boolean {
  return expected.cvId === actual.cvId
    && expected.experienceId === actual.experienceId
    && expected.experienceLineageHash === actual.experienceLineageHash
    && expected.sourceClauseIndex === actual.sourceClauseIndex
    && expected.sourceClauseHash === actual.sourceClauseHash
    && expected.semanticFactId === actual.semanticFactId
    && expected.sourceLocale === actual.sourceLocale
    && expected.targetLocale === actual.targetLocale
    && expected.canonicalLineageHash === actual.canonicalLineageHash;
}

function storedSurfaceMatches(
  cv: CVData,
  expected: ExperienceLocalizationRequestRecord,
  surface: PersistedExperienceLocalizedSurface | undefined,
): surface is PersistedExperienceLocalizedSurface {
  if (!surface || !bindingFieldsMatch(expected, surface)) return false;
  if (
    surface.surfaceSchema !== EXPERIENCE_LOCALIZED_SURFACE_SCHEMA
    || surface.validatorVersion !== EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION
    || surface.validatorDecision !== 'passed'
    || surface.validationProvenance !== 'independent_provider_verification'
    || surface.bindingKey !== expected.requestIdentity
    || surface.localizedTextHash !== hashExperienceLocalizedSurfaceValue(surface.localizedText)
    || surface.validatedCandidateHash !== surface.localizedTextHash
    || !surface.validatedAt
    || !surface.localizedText.trim()
  ) return false;
  const purity = validateAiUnitLocalePurity(surface.localizedText, expected.targetLocale, {
    kind: 'experience_bullet',
    requireUnits: true,
  });
  if (!purity.ok) return false;
  const unsupported = detectExperienceUnsupportedClaimExpansion(
    expected.sourceText,
    surface.localizedText,
  );
  if (unsupported.count > 0) return false;
  return validateCrossEntryExperienceLeakage({
    cv,
    targetExperienceId: expected.experienceId,
    candidate: surface.localizedText,
  }).ok;
}

function emptyStore(): ExperienceLocalizedSurfaceStore {
  return { schemaVersion: EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA, surfaces: {} };
}

function usableStore(cv: CVData): ExperienceLocalizedSurfaceStore {
  const store = cv.experienceLocalizedSurfaces;
  return store?.schemaVersion === EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA
    && store.surfaces
    && typeof store.surfaces === 'object'
    ? store
    : emptyStore();
}

export function buildExperienceLocalizationSnapshot(
  cv: CVData,
  targetLocale: Locale,
): ExperienceLocalizationSnapshot {
  const records: ExperienceLocalizationRequestRecord[] = [];
  const sourceLocaleByEntry: Record<string, string> = {};
  const sourceLocaleResolutionByEntry: Record<string, string> = {};
  let reason: string | undefined;

  for (const exp of cv.experience || []) {
    const grounding = recoverSemanticDutiesFromUserOrigin(exp, cv.canonicalSnapshot);
    if (grounding.source !== 'user_origin_recovered' || grounding.duties.length === 0) continue;
    const source = sourceLocaleForGrounding(grounding);
    const entryDiagKey = hashExperienceLocalizedSurfaceValue(exp.id);
    sourceLocaleByEntry[entryDiagKey] = source.locale || 'unknown';
    sourceLocaleResolutionByEntry[entryDiagKey] = source.resolution;
    if (!source.locale) {
      reason = 'experience_localization_source_locale_ambiguous';
      continue;
    }
    const resolvedSourceLocale = source.locale;
    const resolvedSourceResolution = source.resolution;
    sourceLocaleByEntry[entryDiagKey] = resolvedSourceLocale;
    sourceLocaleResolutionByEntry[entryDiagKey] = resolvedSourceResolution;
    for (const duty of grounding.duties) {
      const metrics = measureExperienceLocalizationText(duty.sourceClause || '');
      if (source.locale !== targetLocale && metrics.canonicalChars > EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS) {
        reason ||= 'experience_localization_source_text_too_long';
        continue;
      }
      records.push(recordForDuty({
        cv, exp, grounding, duty, sourceLocale: resolvedSourceLocale, targetLocale,
      }));
    }
  }

  const snapshotId = hashExperienceLocalizedSurfaceValue(stableMaterial([
    EXPERIENCE_LOCALIZED_SURFACE_SCHEMA,
    cv.id || 'missing-cv-id',
    targetLocale,
    cv.canonicalSnapshot?.canonicalSourceHash || 'no-canonical-snapshot',
    cv.canonicalSnapshot?.canonicalRevision || 0,
    cv.canonicalSnapshot?.canonicalState || 'none',
    ...records.flatMap((record) => [record.requestIdentity, record.sourceClauseHash]),
  ]));
  const store = usableStore(cv);
  const cachedSurfaces: PersistedExperienceLocalizedSurface[] = [];
  const missingRecords: ExperienceLocalizationRequestRecord[] = [];
  let invariantPassthroughCount = 0;
  let providerTranslatableRecordCount = 0;
  for (const record of records) {
    if (record.sourceLocale === targetLocale) continue;
    if (isExperienceLocalizationInvariantUnit(record.sourceText)) {
      invariantPassthroughCount += 1;
      continue;
    }
    providerTranslatableRecordCount += 1;
    const candidate = store.surfaces[record.requestIdentity];
    if (storedSurfaceMatches(cv, record, candidate)) cachedSurfaces.push(candidate);
    else missingRecords.push(record);
  }
  const diagnostics: ExperienceLocalizationDiagnostics = {
    exportSnapshotId: snapshotId,
    experienceEntryCount: (cv.experience || []).length,
    sourceClauseCount: records.length,
    sourceLocaleByEntry,
    sourceLocaleResolutionByEntry,
    targetLocale,
    surfaceHitCount: cachedSurfaces.length,
    missingSurfaceCount: missingRecords.length,
    providerRequestCount: 0,
    providerRepairCount: 0,
    independentVerifierRequestCount: 0,
    returnedRecordCount: 0,
    validatedRecordCount: 0,
    independentlyValidatedRecordCount: 0,
    independentlyRejectedRecordCount: 0,
    independentValidatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
    identityMismatch: false,
    candidateHashMismatch: false,
    persistedSurfaceCount: 0,
    cacheReuseCount: cachedSurfaces.length,
    staleResponseRejected: false,
    invariantPassthroughCount,
    providerTranslatableRecordCount,
    invariantPassthroughRevision: EXPERIENCE_LOCALIZATION_INVARIANT_PASSTHROUGH_REVISION,
    ...(reason ? { failureStage: 'resolve_source_locale', failureReason: reason } : {}),
  };
  return {
    ok: !reason,
    reason,
    snapshotId,
    targetLocale,
    records,
    missingRecords,
    cachedSurfaces,
    diagnostics,
  };
}

export type ExperienceLocalizationResourceFailureReason =
  | 'experience_localization_source_text_too_long'
  | 'experience_localization_batch_payload_too_large';

export function validateExperienceLocalizationPhysicalBatch(records: ExperienceLocalizationRequestRecord[]) {
  if (records.length > EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE) {
    return { ok: false as const, reason: 'experience_localization_batch_payload_too_large' as const };
  }
  let canonicalChars = 0;
  let utf8Bytes = 0;
  for (const record of records) {
    const metrics = measureExperienceLocalizationText(record.sourceText);
    if (metrics.canonicalChars > EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS) {
      return { ok: false as const, reason: 'experience_localization_source_text_too_long' as const };
    }
    canonicalChars += metrics.canonicalChars;
    utf8Bytes += metrics.utf8Bytes;
  }
  if (canonicalChars > EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS
    || utf8Bytes > EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_UTF8_BYTES) {
    return { ok: false as const, reason: 'experience_localization_batch_payload_too_large' as const };
  }
  return { ok: true as const, canonicalChars, utf8Bytes };
}

export function partitionExperienceLocalizationRecords(records: ExperienceLocalizationRequestRecord[]) {
  const batches: ExperienceLocalizationRequestRecord[][] = [];
  let current: ExperienceLocalizationRequestRecord[] = [];
  let currentChars = 0;
  let currentBytes = 0;
  for (const record of records) {
    const metrics = measureExperienceLocalizationText(record.sourceText);
    if (metrics.canonicalChars > EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS) {
      return { ok: false as const, reason: 'experience_localization_source_text_too_long' as const };
    }
    if (metrics.utf8Bytes > EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_UTF8_BYTES) {
      return { ok: false as const, reason: 'experience_localization_batch_payload_too_large' as const };
    }
    const wouldExceed = current.length >= EXPERIENCE_LOCALIZATION_PROVIDER_BATCH_SIZE
      || currentChars + metrics.canonicalChars > EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS
      || currentBytes + metrics.utf8Bytes > EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_UTF8_BYTES;
    if (wouldExceed && current.length) {
      batches.push(current); current = []; currentChars = 0; currentBytes = 0;
    }
    current.push({ ...record, sourceText: metrics.canonicalText });
    currentChars += metrics.canonicalChars;
    currentBytes += metrics.utf8Bytes;
  }
  if (current.length) batches.push(current);
  return { ok: true as const, batches };
}

function independentDecisionPassed(
  decision: ExperienceLocalizationIndependentVerificationRecord,
): boolean {
  return decision.decision === 'passed'
    && decision.mismatchCategory === 'none'
    && decision.predicatePreserved === true
    && decision.objectPreserved === true
    && decision.workDomainPreserved === true
    && decision.sourceResponsibilityPreserved === true
    && decision.scopePreserved === true
    && decision.negationPreserved === true
    && decision.tensePreserved === true
    && decision.unsupportedFactsIntroduced === false
    && decision.crossEntryFactIntroduced === false
    && decision.crossOccupationSubstitution === false;
}

export function validateExperienceLocalizationIndependentVerification(options: {
  request: ExperienceLocalizationRequest;
  candidates: ExperienceLocalizationProviderRecord[];
  verification: ExperienceLocalizationIndependentVerificationResponse;
}):
  | { ok: true; recordsByIdentity: Map<string, ExperienceLocalizationIndependentVerificationRecord> }
  | { ok: false; reason: string; mismatchCategory?: ExperienceLocalizationMismatchCategory } {
  const expected = new Map(options.request.records.map((record) => [record.requestIdentity, record]));
  const candidates = new Map(options.candidates.map((record) => [record.requestIdentity, record]));
  const verification = options.verification;
  const actual = Array.isArray(verification?.records) ? verification.records : [];
  const actualIds = actual.map((record) => String(record?.requestIdentity || ''));
  if (verification?.snapshotId !== options.request.snapshotId) {
    return { ok: false, reason: 'experience_localization_verifier_snapshot_identity_mismatch' };
  }
  if (verification?.targetLocale !== options.request.targetLocale) {
    return { ok: false, reason: 'experience_localization_verifier_wrong_target_locale' };
  }
  if (verification?.validatorVersion !== EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION) {
    return { ok: false, reason: 'experience_localization_verifier_version_mismatch' };
  }
  if (actual.length !== expected.size || candidates.size !== expected.size) {
    return { ok: false, reason: 'experience_localization_verifier_record_count_mismatch' };
  }
  if (new Set(actualIds).size !== actualIds.length) {
    return { ok: false, reason: 'experience_localization_verifier_duplicate_record' };
  }
  if (actualIds.some((identity) => !expected.has(identity) || !candidates.has(identity))) {
    return { ok: false, reason: 'experience_localization_verifier_unknown_record' };
  }
  const recordsByIdentity = new Map<string, ExperienceLocalizationIndependentVerificationRecord>();
  for (const record of actual) {
    const source = expected.get(record.requestIdentity);
    const candidate = candidates.get(record.requestIdentity);
    if (!source || !candidate) {
      return { ok: false, reason: 'experience_localization_verifier_unknown_record' };
    }
    if (!bindingFieldsMatch(source, record)) {
      return { ok: false, reason: 'experience_localization_verifier_identity_mismatch' };
    }
    const candidateHash = hashExperienceLocalizedSurfaceValue(candidate.localizedText);
    if (record.candidateSurfaceHash !== candidateHash) {
      return { ok: false, reason: 'experience_localization_verifier_candidate_hash_mismatch' };
    }
    if (!independentDecisionPassed(record)) {
      return {
        ok: false,
        reason: 'experience_localization_independent_semantic_validation_failed',
        mismatchCategory: record.mismatchCategory,
      };
    }
    recordsByIdentity.set(record.requestIdentity, record);
  }
  return { ok: true, recordsByIdentity };
}

function validateProviderBatch(options: {
  cv: CVData;
  request: ExperienceLocalizationRequest;
  response: ExperienceLocalizationProviderResponse;
}):
  | { ok: true; surfaces: PersistedExperienceLocalizedSurface[] }
  | { ok: false; reason: string; mismatchCategory?: ExperienceLocalizationMismatchCategory } {
  const expected = new Map(options.request.records.map((record) => [record.requestIdentity, record]));
  const actual = Array.isArray(options.response?.records) ? options.response.records : [];
  const actualIds = actual.map((record) => String(record?.requestIdentity || ''));
  if (options.response?.snapshotId !== options.request.snapshotId) {
    return { ok: false, reason: 'experience_localization_snapshot_identity_mismatch' };
  }
  if (options.response?.targetLocale !== options.request.targetLocale) {
    return { ok: false, reason: 'experience_localization_wrong_target_locale' };
  }
  if (actual.length !== expected.size) {
    return { ok: false, reason: 'experience_localization_record_count_mismatch' };
  }
  if (new Set(actualIds).size !== actualIds.length) {
    return { ok: false, reason: 'experience_localization_duplicate_record' };
  }
  if (actualIds.some((identity) => !expected.has(identity))) {
    return { ok: false, reason: 'experience_localization_unknown_record' };
  }

  const independent = validateExperienceLocalizationIndependentVerification({
    request: options.request,
    candidates: actual,
    verification: options.response.independentVerification,
  });
  if (!independent.ok) return independent;

  const now = new Date().toISOString();
  const provenance = options.response.provenance === 'provider_repair'
    ? 'provider_repair'
    : 'provider';
  const surfaces: PersistedExperienceLocalizedSurface[] = [];
  for (const record of actual) {
    const source = expected.get(record.requestIdentity);
    if (!source) return { ok: false, reason: 'experience_localization_unknown_record' };
    if (!bindingFieldsMatch(source, record)) {
      return { ok: false, reason: 'experience_localization_binding_identity_mismatch' };
    }
    const localizedText = canonicalizeExperienceLocalizationText(record.localizedText);
    if (!localizedText) return { ok: false, reason: 'experience_localization_empty_surface' };
    const purity = validateAiUnitLocalePurity(localizedText, source.targetLocale, {
      kind: 'experience_bullet', requireUnits: true,
    });
    if (!purity.ok) {
      return { ok: false, reason: purity.reason === 'wrong_script'
        ? 'experience_localization_wrong_script'
        : 'experience_localization_wrong_language' };
    }
    const unsupported = detectExperienceUnsupportedClaimExpansion(source.sourceText, localizedText);
    if (unsupported.count > 0) {
      return { ok: false, reason: 'experience_localization_unsupported_fact' };
    }
    if (!validateCrossEntryExperienceLeakage({
      cv: options.cv,
      targetExperienceId: source.experienceId,
      candidate: localizedText,
    }).ok) {
      return { ok: false, reason: 'experience_localization_cross_entry_fact' };
    }
    surfaces.push({
      ...source,
      surfaceSchema: EXPERIENCE_LOCALIZED_SURFACE_SCHEMA,
      bindingKey: source.requestIdentity,
      localizedText,
      localizedTextHash: hashExperienceLocalizedSurfaceValue(localizedText),
      localizationProvenance: provenance,
      validatorDecision: 'passed',
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      validationProvenance: 'independent_provider_verification',
      validatedCandidateHash: hashExperienceLocalizedSurfaceValue(localizedText),
      validatedAt: now,
      createdAt: now,
    });
  }
  return { ok: true, surfaces };
}

function failed(
  cv: CVData,
  snapshot: ExperienceLocalizationSnapshot,
  stage: string,
  reason: string,
  diagnostics: ExperienceLocalizationDiagnostics,
): PrepareExperienceLocalizedSurfacesResult {
  return {
    ok: false,
    cv,
    reason,
    stage,
    snapshot,
    diagnostics: { ...diagnostics, failureStage: stage, failureReason: reason },
  };
}

export async function prepareExperienceLocalizedSurfaces(options: {
  cv: CVData;
  targetLocale: Locale;
  adapter: ExperienceLocalizationAdapter;
  getCurrentCv: () => CVData;
  persist: (nextCv: CVData, expectedSnapshotId: string) => boolean | Promise<boolean>;
  operationDeadlineAt?: number;
  now?: () => number;
}): Promise<PrepareExperienceLocalizedSurfacesResult> {
  const initialCv = options.cv;
  const snapshot = buildExperienceLocalizationSnapshot(initialCv, options.targetLocale);
  let diagnostics = { ...snapshot.diagnostics };
  if (!snapshot.ok) {
    return failed(initialCv, snapshot, 'resolve_source_locale', snapshot.reason || 'experience_localization_source_locale_ambiguous', diagnostics);
  }
  if (snapshot.missingRecords.length === 0) {
    return { ok: true, cv: initialCv, snapshot, diagnostics };
  }
  const batchPlan = partitionExperienceLocalizationRecords(snapshot.missingRecords);
  if (!batchPlan.ok) return failed(initialCv, snapshot, 'plan_localization_batches', batchPlan.reason, diagnostics);
  const batches = batchPlan.batches;
  const now = options.now || Date.now;
  const operationExpired = () => Number.isFinite(options.operationDeadlineAt)
    && now() >= Number(options.operationDeadlineAt);
  if (operationExpired()) return failed(initialCv, snapshot, 'operation_deadline', 'experience_localization_operation_deadline_exceeded', diagnostics);
  const allValidatedSurfaces: PersistedExperienceLocalizedSurface[] = [];
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    if (operationExpired()) return failed(initialCv, snapshot, 'operation_deadline', 'experience_localization_operation_deadline_exceeded', diagnostics);
    const batchRecords = batches[batchIndex]!;
    const request: ExperienceLocalizationRequest = {
      task: 'localize_cv_experience_surfaces',
      snapshotId: snapshot.snapshotId,
      targetLocale: options.targetLocale,
      records: batchRecords,
    };
    let response: ExperienceLocalizationProviderResponse;
    try {
      response = await options.adapter(request, { batchIndex, batchCount: batches.length });
    } catch (error) {
      const adapterFailure = error as Error & {
        translationProviderAttemptCount?: number;
        independentVerifierAttemptCount?: number;
        translatedRecordCount?: number;
        verifiedRecordCount?: number;
        translationResponded?: boolean;
        translationParserPassed?: boolean;
        compactTranslatorIdsValidated?: boolean;
        fullIdentitiesReconstructed?: boolean;
        candidateHashesComputed?: boolean;
        verifierDispatched?: boolean;
        verifierResponded?: boolean;
        verifierParserReached?: boolean;
        routeRemainingAtVerifierDispatchMs?: number;
      };
      const adapterReason = error instanceof Error ? error.message : '';
      const typedReason = /^experience_localization_[a-z0-9_]+$/i.test(adapterReason)
        || new Set([
          'translation_transport_timeout', 'verifier_transport_timeout',
          'route_deadline_exceeded', 'route_deadline_insufficient', 'client_abort',
          'provider_http_failure', 'provider_invalid_response',
        ]).has(adapterReason)
        ? adapterReason
        : 'experience_localization_provider_failed';
      const translationAttempts = Number.isInteger(adapterFailure.translationProviderAttemptCount)
        ? Math.max(0, Number(adapterFailure.translationProviderAttemptCount)) : 1;
      const verifierAttempts = Number.isInteger(adapterFailure.independentVerifierAttemptCount)
        ? Math.max(0, Number(adapterFailure.independentVerifierAttemptCount)) : 0;
      const returned = Number.isInteger(adapterFailure.translatedRecordCount)
        ? Math.max(0, Number(adapterFailure.translatedRecordCount)) : 0;
      diagnostics = {
        ...diagnostics,
        providerRequestCount: diagnostics.providerRequestCount + translationAttempts,
        independentVerifierRequestCount: diagnostics.independentVerifierRequestCount + verifierAttempts,
        returnedRecordCount: diagnostics.returnedRecordCount + returned,
        independentlyRejectedRecordCount: verifierAttempts > 0 ? request.records.length : 0,
        translationResponded: adapterFailure.translationResponded === true,
        translationParserPassed: adapterFailure.translationParserPassed === true,
        compactTranslatorIdsValidated: adapterFailure.compactTranslatorIdsValidated === true,
        fullIdentitiesReconstructed: adapterFailure.fullIdentitiesReconstructed === true,
        candidateHashesComputed: adapterFailure.candidateHashesComputed === true,
        verifierDispatched: adapterFailure.verifierDispatched === true,
        verifierResponded: adapterFailure.verifierResponded === true,
        verifierParserReached: adapterFailure.verifierParserReached === true,
        verifiedRecordCount: Number.isInteger(adapterFailure.verifiedRecordCount)
          ? Math.max(0, Number(adapterFailure.verifiedRecordCount)) : 0,
        routeRemainingAtVerifierDispatchMs: Number.isFinite(adapterFailure.routeRemainingAtVerifierDispatchMs)
          ? Number(adapterFailure.routeRemainingAtVerifierDispatchMs) : undefined,
      };
      return failed(
        initialCv,
        snapshot,
        verifierAttempts > 0 ? 'independent_verification' : 'acquire_localized_surfaces',
        typedReason,
        diagnostics,
      );
    }
    if (operationExpired()) return failed(initialCv, snapshot, 'operation_deadline', 'experience_localization_operation_deadline_exceeded', diagnostics);
    const providerAttemptCount = Number.isInteger(response?.providerAttemptCount)
      ? Math.max(1, Number(response.providerAttemptCount)) : 1;
    const verifierAttemptCount = Number.isInteger(response?.independentVerification?.verifierAttemptCount)
      ? Math.max(1, Number(response.independentVerification.verifierAttemptCount)) : 1;
    diagnostics = {
      ...diagnostics,
      providerRequestCount: diagnostics.providerRequestCount + providerAttemptCount,
      independentVerifierRequestCount: diagnostics.independentVerifierRequestCount + verifierAttemptCount,
      returnedRecordCount: diagnostics.returnedRecordCount
        + (Array.isArray(response?.records) ? response.records.length : 0),
      providerRepairCount: diagnostics.providerRepairCount + Math.max(
        providerAttemptCount - 1,
        response?.provenance === 'provider_repair' ? 1 : 0,
      ),
    };
    const validated = validateProviderBatch({ cv: initialCv, request, response });
    if (!validated.ok) {
      diagnostics = {
        ...diagnostics,
        independentlyRejectedRecordCount: request.records.length,
        identityMismatch: /identity_mismatch|unknown_record|duplicate_record|record_count_mismatch/.test(
          validated.reason,
        ),
        candidateHashMismatch: validated.reason
          === 'experience_localization_verifier_candidate_hash_mismatch',
        ...(validated.mismatchCategory ? { semanticMismatchCategory: validated.mismatchCategory } : {}),
      };
      return failed(initialCv, snapshot, 'validate_localized_surfaces', validated.reason, diagnostics);
    }
    allValidatedSurfaces.push(...validated.surfaces);
    diagnostics = {
      ...diagnostics,
      validatedRecordCount: allValidatedSurfaces.length,
      independentlyValidatedRecordCount: allValidatedSurfaces.length,
    };
  }

  if (operationExpired()) return failed(initialCv, snapshot, 'operation_deadline', 'experience_localization_operation_deadline_exceeded', diagnostics);
  const currentCv = options.getCurrentCv();
  const currentSnapshot = buildExperienceLocalizationSnapshot(currentCv, options.targetLocale);
  if (!currentSnapshot.ok || currentSnapshot.snapshotId !== snapshot.snapshotId) {
    diagnostics = { ...diagnostics, staleResponseRejected: true };
    return failed(initialCv, snapshot, 'revalidate_export_snapshot', 'experience_localization_stale_snapshot', diagnostics);
  }

  const currentStore = usableStore(currentCv);
  const surfaces = { ...currentStore.surfaces };
  for (const surface of allValidatedSurfaces) surfaces[surface.bindingKey] = surface;
  const nextCv: CVData = {
    ...currentCv,
    experienceLocalizedSurfaces: {
      schemaVersion: EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA,
      surfaces,
    },
  };
  if (operationExpired()) return failed(initialCv, snapshot, 'operation_deadline', 'experience_localization_operation_deadline_exceeded', diagnostics);
  let persisted = false;
  try {
    persisted = await options.persist(nextCv, snapshot.snapshotId);
  } catch {
    persisted = false;
  }
  if (!persisted) {
    return failed(initialCv, snapshot, 'persist_localized_surfaces', 'experience_localization_persistence_failed', diagnostics);
  }
  diagnostics = { ...diagnostics, persistedSurfaceCount: allValidatedSurfaces.length };
  return { ok: true, cv: nextCv, snapshot, diagnostics };
}

export function projectExperienceFromLocalizedSurfaces(options: {
  cv: CVData;
  exp: WorkExperience;
  grounding: ExperienceSemanticGrounding;
  targetLocale: Locale;
}): string | null {
  if (options.grounding.source !== 'user_origin_recovered') return null;
  const source = sourceLocaleForGrounding(options.grounding);
  if (!source.locale) return null;
  if (source.locale === options.targetLocale) return options.exp.description || '';
  const store = usableStore(options.cv);
  const localized: string[] = [];
  for (const duty of options.grounding.duties) {
    const record = recordForDuty({
      cv: options.cv,
      exp: options.exp,
      grounding: options.grounding,
      duty,
      sourceLocale: source.locale,
      targetLocale: options.targetLocale,
    });
    if (isExperienceLocalizationInvariantUnit(record.sourceText)) {
      localized.push(record.sourceText);
      continue;
    }
    const surface = store.surfaces[record.requestIdentity];
    if (!storedSurfaceMatches(options.cv, record, surface)) return null;
    localized.push(surface.localizedText);
  }
  return formatExperienceBullets(localized);
}

export function resolveExperiencePresentationSnapshot(options: {
  cv: CVData;
  targetLocale: Locale;
}): ExperiencePresentationSnapshot {
  const records: ExperiencePresentationRecord[] = [];
  let ok = true;
  const experience = (options.cv.experience || []).map((exp) => {
    const current = String(exp.description || '').trim();
    const grounding = recoverSemanticDutiesFromUserOrigin(exp, options.cv.canonicalSnapshot);
    const currentLocale = resolveExperienceSourceLocale(exp, options.cv.canonicalSnapshot).locale;
    const projectionRequired = Boolean(current)
      && Boolean(currentLocale)
      && !localesEquivalent(currentLocale, options.targetLocale);
    const currentPurity = validateAiUnitLocalePurity(current, options.targetLocale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    let description = current;
    let presentationAuthority: ExperiencePresentationAuthority = 'current_visible';
    let recoveryAttempted = false;
    let recoveryKind: ExperiencePresentationRecord['recoveryKind'] = null;
    let rejectionReason: string | null = null;

    if (!current || projectionRequired || !currentPurity.ok) {
      recoveryAttempted = true;
      const projected = projectExperienceFromLocalizedSurfaces({
        cv: options.cv,
        exp,
        grounding,
        targetLocale: options.targetLocale,
      });
      const projectedPurity = validateAiUnitLocalePurity(projected || '', options.targetLocale, {
        kind: 'experience_bullet',
        requireUnits: true,
      });
      if (projected && isAcceptableExperiencePresentationPurity(projectedPurity, options.targetLocale)) {
        description = projected;
        presentationAuthority = 'validated_target_projection';
        recoveryKind = 'validated_target_projection';
      } else {
        const recovered = recoverExperiencePresentationFromSource(
          { ...exp, description: '' },
          options.targetLocale,
          options.cv.personal?.gender,
        );
        const recoveredPurity = validateAiUnitLocalePurity(recovered.description || '', options.targetLocale, {
          kind: 'experience_bullet',
          requireUnits: true,
        });
        if (
          recovered.description
          && isAcceptableExperiencePresentationPurity(recoveredPurity, options.targetLocale)
        ) {
          description = recovered.description;
          presentationAuthority = 'same_entry_semantic_recovery';
          recoveryKind = 'same_entry_semantic_recovery';
        } else {
          // No source-bound target projection or same-entry semantic recovery:
          // never compose historical source, stale generated, and visible lines.
          description = '';
          presentationAuthority = 'unresolved';
          rejectionReason = recovered.rejectionReason || 'same_entry_presentation_unresolved';
          ok = false;
        }
      }
    }

    const selectedPurity = validateAiUnitLocalePurity(description, options.targetLocale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    const leakage = description
      ? validateCrossEntryExperienceLeakage({
        cv: options.cv,
        targetExperienceId: exp.id,
        candidate: description,
      })
      : { ok: false };
    const factCoverage = evaluatePresentationFactCoverage(exp, description, options.targetLocale);
    records.push({
      owningEntryHash: hashExperienceLocalizedSurfaceValue(exp.id),
      currentVisibleDescriptionHash: hashExperienceLocalizedSurfaceValue(current),
      immutableFactSetHash: hashExperienceLocalizedSurfaceValue(
        grounding.duties.map((duty) => duty.sourceFactId || duty.key).join('|'),
      ),
      sourceLocale: currentLocale,
      targetLocale: options.targetLocale,
      projectionRequired,
      presentationAuthority,
      recoveryAttempted,
      recoveryKind,
      rejectionReason,
      selectedPresentationHash: hashExperienceLocalizedSurfaceValue(description),
      finalPresentationHash: hashExperienceLocalizedSurfaceValue(description),
      requiredFactCount: factCoverage.required,
      coveredFactCount: factCoverage.covered,
      missingFactCount: factCoverage.missing,
      factCoveragePassed: factCoverage.passed,
      detectedLocaleByBullet: selectedPurity.detectedLocaleByUnit,
      detectedScriptByBullet: selectedPurity.detectedScriptByUnit,
      mixedLanguageBulletCount: selectedPurity.mixedLanguageUnitCount,
      sourceLanguageLeakageDetected: selectedPurity.sourceLanguageLeakageDetected,
      crossEntryOwnershipPassed: leakage.ok,
    });
    return { ...exp, description };
  });
  return { cv: { ...options.cv, experience }, records, ok };
}

export function parseExperienceLocalizationProviderJson(
  raw: string,
): ExperienceLocalizationProviderResponse | null {
  const text = String(raw || '').trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return null;
  try {
    const value = JSON.parse(text) as ExperienceLocalizationProviderResponse;
    if (
      !value
      || typeof value !== 'object'
      || typeof value.snapshotId !== 'string'
      || typeof value.targetLocale !== 'string'
      || !Array.isArray(value.records)
    ) return null;
    const valid = value.records.every((record) => (
      record
      && typeof record.requestIdentity === 'string'
      && typeof record.cvId === 'string'
      && typeof record.experienceId === 'string'
      && typeof record.experienceLineageHash === 'string'
      && Number.isInteger(record.sourceClauseIndex)
      && typeof record.sourceClauseHash === 'string'
      && typeof record.semanticFactId === 'string'
      && typeof record.sourceLocale === 'string'
      && typeof record.targetLocale === 'string'
      && typeof record.canonicalLineageHash === 'string'
      && typeof record.localizedText === 'string'
      && record.semanticValidation
      && typeof record.semanticValidation === 'object'
      && typeof record.semanticValidation.validatorVersion === 'string'
      && typeof record.semanticValidation.predicatePreserved === 'boolean'
      && typeof record.semanticValidation.objectPreserved === 'boolean'
      && typeof record.semanticValidation.workDomainPreserved === 'boolean'
      && typeof record.semanticValidation.scopePreserved === 'boolean'
      && typeof record.semanticValidation.negationPreserved === 'boolean'
      && typeof record.semanticValidation.tensePreserved === 'boolean'
      && typeof record.semanticValidation.unsupportedFactsIntroduced === 'boolean'
    ));
    return valid ? value : null;
  } catch {
    return null;
  }
}

const EXPERIENCE_LOCALIZATION_MISMATCH_CATEGORIES = new Set<ExperienceLocalizationMismatchCategory>([
  'none',
  'predicate_mismatch',
  'object_mismatch',
  'work_domain_mismatch',
  'source_responsibility_removed',
  'scope_mismatch',
  'negation_mismatch',
  'tense_mismatch',
  'unsupported_responsibility_added',
  'cross_entry_fact',
  'cross_occupation_substitution',
  'ambiguous',
]);

export function parseExperienceLocalizationVerifierJson(
  raw: string,
): ExperienceLocalizationIndependentVerificationResponse | null {
  const text = String(raw || '').trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return null;
  try {
    const value = JSON.parse(text) as ExperienceLocalizationIndependentVerificationResponse;
    if (
      !value
      || typeof value !== 'object'
      || typeof value.snapshotId !== 'string'
      || typeof value.targetLocale !== 'string'
      || value.validatorVersion !== EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION
      || !Array.isArray(value.records)
    ) return null;
    const valid = value.records.every((record) => (
      record
      && typeof record.requestIdentity === 'string'
      && typeof record.cvId === 'string'
      && typeof record.experienceId === 'string'
      && typeof record.experienceLineageHash === 'string'
      && Number.isInteger(record.sourceClauseIndex)
      && typeof record.sourceClauseHash === 'string'
      && typeof record.semanticFactId === 'string'
      && typeof record.sourceLocale === 'string'
      && typeof record.targetLocale === 'string'
      && typeof record.canonicalLineageHash === 'string'
      && typeof record.candidateSurfaceHash === 'string'
      && (record.decision === 'passed' || record.decision === 'rejected')
      && EXPERIENCE_LOCALIZATION_MISMATCH_CATEGORIES.has(record.mismatchCategory)
      && typeof record.predicatePreserved === 'boolean'
      && typeof record.objectPreserved === 'boolean'
      && typeof record.workDomainPreserved === 'boolean'
      && typeof record.sourceResponsibilityPreserved === 'boolean'
      && typeof record.scopePreserved === 'boolean'
      && typeof record.negationPreserved === 'boolean'
      && typeof record.tensePreserved === 'boolean'
      && typeof record.unsupportedFactsIntroduced === 'boolean'
      && typeof record.crossEntryFactIntroduced === 'boolean'
      && typeof record.crossOccupationSubstitution === 'boolean'
    ));
    return valid ? value : null;
  } catch {
    return null;
  }
}

/** Remove malformed/unsupported entries without touching valid surfaces for other targets. */
export function pruneExperienceLocalizedSurfaces(cv: CVData): CVData {
  const store = usableStore(cv);
  const entries = new Set((cv.experience || []).map((exp) => exp.id));
  const surfaces = Object.fromEntries(Object.entries(store.surfaces).filter(([key, surface]) => (
    entries.has(surface.experienceId)
    && key === surface.bindingKey
    && surface.surfaceSchema === EXPERIENCE_LOCALIZED_SURFACE_SCHEMA
    && surface.validatorVersion === EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION
    && surface.validationProvenance === 'independent_provider_verification'
    && surface.validatedCandidateHash === surface.localizedTextHash
    && Boolean(surface.validatedAt)
    && surface.localizedTextHash === hashExperienceLocalizedSurfaceValue(surface.localizedText)
  )));
  return {
    ...cv,
    experienceLocalizedSurfaces: {
      schemaVersion: EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA,
      surfaces,
    },
  };
}

/** Test/diagnostic helper: exact number of authoritative visible clauses. */
export function countCurrentUserOriginClauses(cv: CVData): number {
  return (cv.experience || []).reduce((sum, exp) => (
    sum + splitExperienceBullets(exp.description || '').length
  ), 0);
}
