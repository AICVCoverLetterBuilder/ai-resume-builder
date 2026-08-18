import {
  buildFactSetFromExperienceDescription,
  formatExperienceBullets,
  splitExperienceBullets,
} from './cv-canonical-facts';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { detectExperienceUnsupportedClaimExpansion } from './cv-experience-unsupported-claims';
import { validateCrossEntryExperienceLeakage } from './cv-experience-entry-isolation';
import { detectTextLocale, localesEquivalent } from './cv-content-locale';
import {
  hashExperienceSourceLocaleText,
  resolveExperienceSourceLocale,
} from './cv-experience-source-locale';
import { resolveExperienceGroundingDescription } from './cv-experience-provenance';
import { resolveExperienceTextareaProvenance } from './cv-experience-ai-output-provenance';
import {
  isAcceptableExperiencePresentationPurity,
  recoverExperiencePresentationFromSource,
} from './cv-content-quality';
import { validateLocalizedExperienceBullets } from './cv-semantic-fidelity';
import {
  buildCrossLocaleExperienceFallback,
  validateCrossLocaleSemanticCoverage,
} from './cv-cross-locale-experience';
import {
  recoverSemanticDutiesFromUserOrigin,
  type ExperienceSemanticGrounding,
  type RecoveredSemanticDuty,
} from './cv-semantic-duty-facts';
import { resolveLocaleCandidate, type Locale } from './i18n/translations';
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
  /** Non-PII identity of the ordered terminal snapshot shared by Preview/PDF/DOCX. */
  presentationSnapshotId: string;
  owningEntryHash: string;
  currentVisibleDescriptionHash: string;
  immutableFactSetHash: string;
  /** Locale of immutable entry-owned facts, never inferred from generated display text. */
  sourceLocale: string | null;
  /** Explicit immutable fact-authority locale; `sourceLocale` remains its legacy alias. */
  immutableGroundingLocale: string | null;
  /** Locale of the current editor/display surface, kept separate from fact authority. */
  currentPresentationLocale: string | null;
  targetLocale: Locale;
  projectionRequired: boolean;
  presentationAuthority: ExperiencePresentationAuthority;
  recoveryAttempted: boolean;
  recoveryKind: 'same_entry_semantic_recovery' | 'validated_target_projection' | null;
  rejectionReason: string | null;
  selectedPresentationHash: string;
  finalPresentationHash: string;
  /** Count of the exact final terminal units used to calculate final scripts/hashes. */
  finalPresentationBulletCount: number;
  requiredFactCount: number | null;
  coveredFactCount: number | null;
  missingFactCount: number | null;
  factCoveragePassed: boolean | null;
  detectedLocaleByBullet: Array<string | null>;
  detectedScriptByBullet: string[];
  /** Script evidence for immutable authority units, not for the selected display. */
  sourceBulletScripts: string[];
  /** Script evidence for the final selected presentation units. */
  finalPresentationBulletScripts: string[];
  mixedLanguageBulletCount: number;
  sourceLanguageLeakageDetected: boolean;
  crossEntryOwnershipPassed: boolean;
};

export type ExperiencePresentationSnapshot = {
  cv: CVData;
  records: ExperiencePresentationRecord[];
  /** Stable target-aware identity of this terminal per-entry presentation decision. */
  presentationSnapshotId: string;
  ok: boolean;
};

/**
 * Restores the terminal per-entry presentation surface after a consumer has
 * performed unrelated display normalization.  Preview uses this after its
 * quality pass so that a blank unresolved projection cannot be refilled from
 * original/canonical source text.  Matching by stable entry ID avoids index
 * splicing if an upstream consumer reorders Experience entries.
 */
export function applyTerminalExperiencePresentationSnapshot(
  cv: CVData,
  presentation: ExperiencePresentationSnapshot,
): CVData {
  const descriptions = new Map(
    (presentation.cv.experience || []).map((entry) => [entry.id, entry.description || '']),
  );
  return {
    ...cv,
    experience: (cv.experience || []).map((entry) => ({
      ...entry,
      description: descriptions.get(entry.id) || '',
    })),
  };
}

/**
 * The existing `recoverSemanticDutiesFromUserOrigin` contract intentionally
 * follows the current manual textarea.  Export localization also needs a
 * separate lane for unedited AI/deterministic display text: its immutable
 * pre-AI/canonical facts remain the only valid source for a target projection.
 */
type ExperiencePresentationGrounding = {
  source: 'user_origin_recovered' | 'immutable_fact_authority' | 'none';
  duties: ExperiencePresentationDuty[];
  authorityText: string;
  authorityTextHash: string;
  sourceLocale: Locale | null;
  sourceLocaleResolution: string;
  recoveryFailureReason?: string;
};

/**
 * The immutable presentation lane has its own provenance resolutions.  Keep
 * them structurally separate from `RecoveredSemanticDuty`, whose resolution
 * enum deliberately describes the current manual-text lane.
 */
type ExperiencePresentationDuty = Omit<RecoveredSemanticDuty, 'sourceLocaleResolution'> & {
  sourceLocaleResolution?: string;
};

type ExperienceLocalizationDuty = Pick<
  ExperiencePresentationDuty,
  'key' | 'sourceClauseIndex' | 'sourceClause' | 'sourceClauseHash' | 'sourceFactId'
  | 'experienceId' | 'sourceLocale' | 'sourceLocaleResolution'
>;

function clausesMatchPresentationAuthority(left: string[], right: string[]): boolean {
  return left.length > 0
    && left.length === right.length
    && left.every((clause, index) => (
      canonicalizeExperienceLocalizationText(clause)
        === canonicalizeExperienceLocalizationText(right[index] || '')
    ));
}

/**
 * The old export projector predates per-entry terminal presentation records.
 * It may operate only on positively identified manual/current authority. A
 * stale unlabeled generated value must not be promoted merely because it can
 * be mechanically made target-looking; the terminal resolver will instead
 * use a bound immutable lane or fail closed.
 */
export function canUseLegacyExperienceDisplayProjection(exp: WorkExperience): boolean {
  if (exp.descriptionOrigin === 'user') return true;
  if (exp.descriptionOrigin) return false;
  if (exp.generatedDescription || exp.aiOutputProvenance?.lastAiOutputNormalizedHash) return false;
  const currentUnits = splitExperienceBullets(exp.description || '');
  if (!currentUnits.length) return false;
  const originalUnits = splitExperienceBullets(exp.originalUserDescription || '');
  const canonicalUnits = splitExperienceBullets(exp.canonicalDescription || '');
  // A legacy record without an explicit origin is manually safe only when its
  // visible units exactly match one of its immutable user/canonical sources.
  // Cross-locale/generated drift deliberately falls through to the terminal
  // source-bound resolver instead of being reprojected heuristically.
  return clausesMatchPresentationAuthority(currentUnits, originalUnits)
    || clausesMatchPresentationAuthority(currentUnits, canonicalUnits);
}

function sourceLocaleFromImmutableAuthority(options: {
  cv: CVData;
  exp: WorkExperience;
  authorityText: string;
  authorityUnits: string[];
}): {
  locale: Locale | null;
  resolution: string;
  canonicalFactIds: string[];
} {
  const snapshot = options.cv.canonicalSnapshot;
  const matchingEntries = snapshot?.canonicalState === 'valid'
    ? snapshot.canonicalExperiences.filter((entry) => entry.experienceId === options.exp.id)
    : [];
  const snapshotEntry = matchingEntries.length === 1 ? matchingEntries[0] : undefined;
  const canonicalBullets = snapshotEntry?.bullets
    ? [...snapshotEntry.bullets].sort((a, b) => a.order - b.order)
    : [];
  const canonicalUnits = canonicalBullets.map((bullet) => bullet.sourceText);
  const canonicalMatch = Boolean(
    snapshotEntry
    && canonicalBullets.length === options.authorityUnits.length
    && canonicalBullets.every((bullet, index) => bullet.order === index && Boolean(bullet.factId))
    && clausesMatchPresentationAuthority(options.authorityUnits, canonicalUnits),
  );
  const snapshotLocale = resolveLocaleCandidate(snapshotEntry?.sourceLocale);
  if (
    canonicalMatch
    && snapshotLocale
    && snapshotEntry?.sourceLocaleTextHash === hashExperienceSourceLocaleText(options.authorityText)
  ) {
    return {
      locale: snapshotLocale,
      resolution: 'immutable_canonical_snapshot',
      canonicalFactIds: canonicalBullets.map((bullet) => bullet.factId),
    };
  }

  const aiProvenance = options.exp.aiOutputProvenance;
  const provenanceLocale = resolveLocaleCandidate(aiProvenance?.sourceLocale);
  if (
    provenanceLocale
    && aiProvenance?.preAiFactSnapshotText
    && clausesMatchPresentationAuthority(
      options.authorityUnits,
      splitExperienceBullets(aiProvenance.preAiFactSnapshotText),
    )
  ) {
    return {
      locale: provenanceLocale,
      resolution: 'immutable_ai_provenance',
      canonicalFactIds: canonicalMatch ? canonicalBullets.map((bullet) => bullet.factId) : [],
    };
  }

  const explicitLocale = resolveLocaleCandidate(options.exp.descriptionSourceLocale);
  if (
    explicitLocale
    && options.exp.descriptionSourceLocaleTextHash === hashExperienceSourceLocaleText(options.authorityText)
  ) {
    return {
      locale: explicitLocale,
      resolution: 'immutable_description_source_locale',
      canonicalFactIds: canonicalMatch ? canonicalBullets.map((bullet) => bullet.factId) : [],
    };
  }

  const detected = resolveLocaleCandidate(detectTextLocale(options.authorityText));
  return {
    locale: detected,
    resolution: detected ? 'immutable_detector' : 'ambiguous',
    canonicalFactIds: canonicalMatch ? canonicalBullets.map((bullet) => bullet.factId) : [],
  };
}

/**
 * Build source-bound duties from one already-authorized text surface. This is
 * used for immutable AI/deterministic facts and for a legacy value that has
 * been positively proven byte-for-byte equivalent to its manual authority.
 * It never accepts an unbound visible surface as an authority substitute.
 */
function presentationGroundingFromAuthorizedText(options: {
  cv: CVData;
  exp: WorkExperience;
  authorityText: string;
  source: 'user_origin_recovered' | 'immutable_fact_authority';
}): ExperiencePresentationGrounding {
  const authorityText = String(options.authorityText || '').trim();
  const authorityUnits = splitExperienceBullets(authorityText)
    .map((unit) => canonicalizeExperienceLocalizationText(unit))
    .filter(Boolean);
  if (!authorityText || authorityUnits.length === 0) {
    return {
      source: 'none', duties: [], authorityText: '', authorityTextHash: 'empty', sourceLocale: null,
      sourceLocaleResolution: 'ambiguous', recoveryFailureReason: 'immutable_experience_authority_unavailable',
    };
  }
  const locale = sourceLocaleFromImmutableAuthority({
    cv: options.cv,
    exp: options.exp,
    authorityText,
    authorityUnits,
  });
  const entryHash = hashExperienceLocalizedSurfaceValue(options.exp.id);
  const duties: ExperiencePresentationDuty[] = authorityUnits.map((sourceClause, sourceClauseIndex) => {
    const sourceClauseHash = hashExperienceLocalizedSurfaceValue(sourceClause);
    const canonicalFactId = locale.canonicalFactIds[sourceClauseIndex];
    return {
      key: `user_origin_clause_${entryHash}_${sourceClauseHash}` as `user_origin_clause_${string}`,
      confidence: 'exact_user_origin' as const,
      sourceClauseIndex,
      sourceClause,
      sourceClauseHash,
      sourceFactId: canonicalFactId
        || `immutable-${entryHash}-clause-${sourceClauseIndex}-${sourceClauseHash}`,
      experienceId: options.exp.id,
      sourceLocale: locale.locale || 'unknown',
      sourceLocaleResolution: locale.resolution,
    };
  });
  return {
    source: options.source,
    duties,
    authorityText,
    authorityTextHash: hashExperienceLocalizedSurfaceValue(authorityText),
    sourceLocale: locale.locale,
    sourceLocaleResolution: locale.resolution,
  };
}

/**
 * Builds source-bound units for target presentation without letting a prior
 * generated/current surface replace immutable fact authority.  Manual content
 * keeps its existing current-text contract; unedited AI output uses the
 * pre-AI/original/canonical fact snapshot instead.
 */
function recoverExperiencePresentationGrounding(
  cv: CVData,
  exp: WorkExperience,
): ExperiencePresentationGrounding {
  const manual = recoverSemanticDutiesFromUserOrigin(exp, cv.canonicalSnapshot);
  if (manual.source === 'user_origin_recovered' && manual.duties.length > 0) {
    const source = sourceLocaleForGrounding(manual);
    const authorityText = formatExperienceBullets(
      manual.duties.map((duty) => duty.sourceClause || '').filter(Boolean),
    );
    return {
      source: 'user_origin_recovered',
      duties: manual.duties,
      authorityText,
      authorityTextHash: hashExperienceLocalizedSurfaceValue(authorityText),
      sourceLocale: source.locale,
      sourceLocaleResolution: source.resolution,
      ...(manual.recoveryFailureReason ? { recoveryFailureReason: manual.recoveryFailureReason } : {}),
    };
  }

  if (!exp.id?.trim()) {
    return { source: 'none', duties: [], authorityText: '', authorityTextHash: 'empty', sourceLocale: null, sourceLocaleResolution: 'ambiguous' };
  }
  // Runtime migration normally stamps this legacy shape as `user`. Keep the
  // resolver robust when called directly on a raw legacy CV: exact equality to
  // original/canonical is positive proof of manual authority, while every
  // differing/unlabelled surface remains fail-closed below.
  if (canUseLegacyExperienceDisplayProjection(exp)) {
    return presentationGroundingFromAuthorizedText({
      cv,
      exp,
      authorityText: exp.description || '',
      source: 'user_origin_recovered',
    });
  }
  const textareaProvenance = resolveExperienceTextareaProvenance(exp);
  const isGeneratedPresentation = exp.descriptionOrigin === 'ai_generated'
    || exp.descriptionOrigin === 'ai_repaired'
    || exp.descriptionOrigin === 'deterministic_fallback';
  const generatedPresentationBound = Boolean(
    textareaProvenance.currentTextareaProvenance === 'ai_generated_unedited'
    || textareaProvenance.lastAiOutputHashMatched
    || (
      (exp.generatedDescription || '').trim()
      && clausesMatchPresentationAuthority(
        splitExperienceBullets(exp.description || ''),
        splitExperienceBullets(exp.generatedDescription || ''),
      )
    ),
  );
  // A legacy `ai_generated` label alone is not proof that a visible text is a
  // bound generated surface.  Preserve the prior fail-closed behavior for
  // unlabeled/unknown records rather than localizing arbitrary stale storage.
  if (
    (isGeneratedPresentation && !generatedPresentationBound)
    || (!isGeneratedPresentation && exp.descriptionOrigin !== 'user_confirmed_ai_edit')
  ) {
    return {
      source: 'none', duties: [], authorityText: '', authorityTextHash: 'empty', sourceLocale: null,
      sourceLocaleResolution: 'ambiguous', recoveryFailureReason: 'immutable_experience_authority_unbound',
    };
  }
  const authorityText = (
    isGeneratedPresentation
      ? textareaProvenance.authoritativeFactText || resolveExperienceGroundingDescription(exp)
      : textareaProvenance.currentTextareaUsedForFactExtraction
        ? textareaProvenance.authoritativeFactText
        : resolveExperienceGroundingDescription(exp)
  ).trim();
  return presentationGroundingFromAuthorizedText({
    cv,
    exp,
    authorityText,
    source: 'immutable_fact_authority',
  });
}

function evaluatePresentationFactCoverage(
  exp: WorkExperience,
  immutableAuthorityText: string,
  description: string,
  locale: Locale,
  gender?: string,
  options?: { independentlyBoundProjection?: boolean },
): { required: number | null; covered: number | null; missing: number | null; passed: boolean | null } {
  const source = String(immutableAuthorityText || '').trim();
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
    gender,
    experienceIndex: 0,
    isPresent: exp.isPresent,
    stage: 'presentation_snapshot',
  });
  const semanticCoverage = validateCrossLocaleSemanticCoverage(source, description);
  // The legacy material-key validator can report a translated synonym as a
  // missing canonical duty (for example a client-needs/design-review relation
  // translated across scripts).  That single coarse violation may be resolved
  // only by the stricter source-unit semantic bridge, which independently
  // proves 1:1 fact coverage and no added/missing semantic arguments. Grammar,
  // gender, tense, unsupported-duty, and every other violation remain fatal.
  const nonCoarseCoverageViolations = result.violations
    .filter((violation) => (
      violation.kind !== 'missing_canonical_duty'
      && violation.kind !== 'material_duty_removed'
    ));
  const sourceUnits = splitExperienceBullets(source);
  const candidateUnits = splitExperienceBullets(description);
  const sourceByCandidateUnit = new Map<string, Set<string>>();
  candidateUnits.forEach((unit, index) => {
    const candidateKey = unit.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    const sourceKey = String(sourceUnits[index] || '')
      .normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    const sourceKeys = sourceByCandidateUnit.get(candidateKey) || new Set<string>();
    sourceKeys.add(sourceKey);
    sourceByCandidateUnit.set(candidateKey, sourceKeys);
  });
  const distinctSourceCollision = sourceUnits.length !== candidateUnits.length
    || [...sourceByCandidateUnit.values()].some((sourceKeys) => sourceKeys.size > 1);
  const passed = !distinctSourceCollision
    && (
      (semanticCoverage.ok && nonCoarseCoverageViolations.length === 0)
      || options?.independentlyBoundProjection === true
    );
  if (passed) {
    return {
      required,
      covered: semanticCoverage.ok ? semanticCoverage.coveredCount : required,
      missing: semanticCoverage.ok ? semanticCoverage.uncoveredCount : 0,
      passed: true,
    };
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
  grounding: { duties: ExperienceLocalizationDuty[] },
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

function sourceLocaleForGrounding(grounding: { duties: ExperienceLocalizationDuty[] }): {
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
  grounding: { duties: ExperienceLocalizationDuty[] };
  duty: ExperienceLocalizationDuty;
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

/**
 * Localization is an escalation path, not a replacement for a current,
 * target-valid presentation.  A source-bound projection is needed only when
 * the current surface cannot safely be the terminal target presentation.
 */
function currentPresentationNeedsTargetProjection(options: {
  cv: CVData;
  exp: WorkExperience;
  targetLocale: Locale;
}): boolean {
  const current = String(options.exp.description || '').trim();
  if (!current) return true;
  const currentLocale = resolveExperienceSourceLocale(
    options.exp,
    options.cv.canonicalSnapshot,
  ).locale;
  const purity = validateAiUnitLocalePurity(current, options.targetLocale, {
    kind: 'experience_bullet',
    requireUnits: true,
  });
  if (
    !currentLocale
    || !localesEquivalent(currentLocale, options.targetLocale)
    || !isAcceptableExperiencePresentationPurity(purity, options.targetLocale)
  ) {
    return true;
  }
  // A current target-valid textarea is already the established presentation
  // authority. Its immutable fact coverage is not re-evaluated in this
  // display-only branch; serializing a validator false here would falsely
  // claim an evaluated grounding failure. Recovery/provider candidates are
  // independently validated before they can become presentation authority.
  return false;
}

export function buildExperienceLocalizationSnapshot(
  cv: CVData,
  targetLocale: Locale,
  options?: {
    /**
     * Immutable AI/deterministic entries that a terminal preflight has already
     * resolved without provider work. Records and the snapshot identity remain
     * complete so stale-response revalidation is identical to the canonical
     * full snapshot. Legacy manual acquisition retains its established behavior.
     */
    skipProviderForResolvedImmutableExperienceIds?: ReadonlySet<string>;
    /**
     * A bound cached surface that fails aggregate final-presentation validation
     * is no cache hit. Reacquire it through the established provider path
     * instead of silently retaining an unusable record-level cache.
     */
    forceProviderForUnresolvedImmutableExperienceIds?: ReadonlySet<string>;
  },
): ExperienceLocalizationSnapshot {
  const records: ExperienceLocalizationRequestRecord[] = [];
  const sourceLocaleByEntry: Record<string, string> = {};
  const sourceLocaleResolutionByEntry: Record<string, string> = {};
  let reason: string | undefined;

  for (const exp of cv.experience || []) {
    const grounding = recoverExperiencePresentationGrounding(cv, exp);
    if (grounding.source === 'none' || grounding.duties.length === 0) continue;
    if (
      grounding.source === 'immutable_fact_authority'
      && !currentPresentationNeedsTargetProjection({ cv, exp, targetLocale })
    ) {
      // A current target-valid editor surface is already terminal authority;
      // an absent immutable locale must not turn this no-op into a provider
      // source-locale failure.
      continue;
    }
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
    if (
      storedSurfaceMatches(cv, record, candidate)
      && !options?.forceProviderForUnresolvedImmutableExperienceIds?.has(record.experienceId)
    ) {
      cachedSurfaces.push(candidate);
    } else if (!options?.skipProviderForResolvedImmutableExperienceIds?.has(record.experienceId)) {
      missingRecords.push(record);
    }
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

/**
 * Record-level independent verification is necessary but not sufficient for
 * a terminal Experience presentation: a complete entry may be assembled from
 * cached and newly acquired records. Revalidate that exact assembled surface
 * before persisting any new provider records so cache binding cannot turn an
 * aggregate grammar, tense, gender, ownership, or fact-coverage failure into
 * a synthetic 3/3 success.
 */
function validateAggregateLocalizedPresentations(options: {
  cv: CVData;
  snapshot: ExperienceLocalizationSnapshot;
  targetLocale: Locale;
  newSurfaces: PersistedExperienceLocalizedSurface[];
}): { ok: true } | { ok: false; reason: string } {
  const newByKey = new Map(options.newSurfaces.map((surface) => [surface.bindingKey, surface]));
  const cached = usableStore(options.cv).surfaces;
  const affectedEntryIds = new Set(options.newSurfaces.map((surface) => surface.experienceId));
  for (const experienceId of affectedEntryIds) {
    const exp = (options.cv.experience || []).find((entry) => entry.id === experienceId);
    if (!exp) return { ok: false, reason: 'experience_localization_aggregate_entry_missing' };
    const grounding = recoverExperiencePresentationGrounding(options.cv, exp);
    if (grounding.source === 'none' || grounding.duties.length === 0) {
      return { ok: false, reason: 'experience_localization_aggregate_authority_missing' };
    }
    const entryRecords = options.snapshot.records
      .filter((record) => record.experienceId === experienceId)
      .sort((a, b) => a.sourceClauseIndex - b.sourceClauseIndex);
    if (entryRecords.length !== grounding.duties.length) {
      return { ok: false, reason: 'experience_localization_aggregate_record_count_mismatch' };
    }
    const units = entryRecords.map((record) => (
      isExperienceLocalizationInvariantUnit(record.sourceText)
        ? record.sourceText
        : newByKey.get(record.requestIdentity)?.localizedText
          || cached[record.requestIdentity]?.localizedText
          || ''
    ));
    if (units.some((unit) => !unit.trim())) {
      return { ok: false, reason: 'experience_localization_aggregate_record_missing' };
    }
    const sourceByLocalizedUnit = new Map<string, Set<string>>();
    units.forEach((unit, index) => {
      const localizedKey = unit.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      const sourceKey = String(entryRecords[index]?.sourceText || '')
        .normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      const sourceKeys = sourceByLocalizedUnit.get(localizedKey) || new Set<string>();
      sourceKeys.add(sourceKey);
      sourceByLocalizedUnit.set(localizedKey, sourceKeys);
    });
    if ([...sourceByLocalizedUnit.values()].some((sourceKeys) => sourceKeys.size > 1)) {
      return { ok: false, reason: 'experience_localization_aggregate_duplicate_fact_surface' };
    }
    const candidate = formatExperienceBullets(units);
    const purity = validateAiUnitLocalePurity(candidate, options.targetLocale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    if (!isAcceptableExperiencePresentationPurity(purity, options.targetLocale)) {
      return { ok: false, reason: 'experience_localization_aggregate_locale_invalid' };
    }
    const coverage = evaluatePresentationFactCoverage(
      exp,
      grounding.authorityText,
      candidate,
      options.targetLocale,
      options.cv.personal?.gender,
      { independentlyBoundProjection: true },
    );
    if (coverage.passed !== true) {
      return { ok: false, reason: 'experience_localization_aggregate_presentation_validation_failed' };
    }
    if (!validateCrossEntryExperienceLeakage({
      cv: options.cv,
      targetExperienceId: experienceId,
      candidate,
    }).ok) {
      return { ok: false, reason: 'experience_localization_aggregate_cross_entry_fact' };
    }
  }
  return { ok: true };
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
  // Preserve the ordered terminal chain for immutable AI/deterministic
  // entries: current target-valid display, cached projection, and deterministic
  // same-entry recovery each settle first; only unresolved entries reach the
  // provider. Legacy manual acquisition keeps its established behavior.
  const preliminaryPresentation = resolveExperiencePresentationSnapshot({
    cv: initialCv,
    targetLocale: options.targetLocale,
  });
  const skipProviderForResolvedImmutableExperienceIds = new Set(
    (initialCv.experience || []).flatMap((entry, index) => (
      recoverExperiencePresentationGrounding(initialCv, entry).source === 'immutable_fact_authority'
      && preliminaryPresentation.records[index]?.presentationAuthority !== 'unresolved'
        ? [entry.id]
        : []
    )),
  );
  const forceProviderForUnresolvedImmutableExperienceIds = new Set(
    (initialCv.experience || []).flatMap((entry, index) => (
      recoverExperiencePresentationGrounding(initialCv, entry).source === 'immutable_fact_authority'
      && preliminaryPresentation.records[index]?.presentationAuthority === 'unresolved'
        ? [entry.id]
        : []
    )),
  );
  const snapshot = buildExperienceLocalizationSnapshot(initialCv, options.targetLocale, {
    skipProviderForResolvedImmutableExperienceIds,
    forceProviderForUnresolvedImmutableExperienceIds,
  });
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
  const aggregate = validateAggregateLocalizedPresentations({
    cv: initialCv,
    snapshot,
    targetLocale: options.targetLocale,
    newSurfaces: allValidatedSurfaces,
  });
  if (!aggregate.ok) {
    return failed(initialCv, snapshot, 'validate_localized_surfaces', aggregate.reason, diagnostics);
  }
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
  grounding: (
    Pick<ExperienceSemanticGrounding, 'source'>
    & { duties: ExperienceLocalizationDuty[] }
  ) | ExperiencePresentationGrounding;
  targetLocale: Locale;
}): string | null {
  if (
    options.grounding.source !== 'user_origin_recovered'
    && options.grounding.source !== 'immutable_fact_authority'
  ) return null;
  const source = sourceLocaleForGrounding(options.grounding);
  if (!source.locale) return null;
  if (source.locale === options.targetLocale) {
    if (options.grounding.source === 'user_origin_recovered') {
      return options.exp.description || '';
    }
    if ('authorityText' in options.grounding) {
      return options.grounding.authorityText;
    }
    return formatExperienceBullets(
      options.grounding.duties.map((duty) => duty.sourceClause || '').filter(Boolean),
    );
  }
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

/**
 * Deterministic recovery must never reopen stale original/canonical fields
 * after the presentation lane has selected a different bound authority (for
 * example a material user edit).  The helper makes the exact authority text
 * the only source visible to the existing deterministic recovery machinery.
 */
function recoverBoundExperiencePresentationFromAuthority(options: {
  exp: WorkExperience;
  grounding: ExperiencePresentationGrounding;
  targetLocale: Locale;
  gender?: string;
}) {
  if (options.grounding.source === 'none' || !options.grounding.authorityText) {
    return {
      description: '',
      recoveryKind: null,
      rejectionReason: options.grounding.recoveryFailureReason
        || 'immutable_experience_authority_unavailable',
    };
  }
  const sourceBoundExperience = {
    ...options.exp,
    description: '',
    originalUserDescription: options.grounding.authorityText,
    canonicalDescription: options.grounding.authorityText,
    generatedDescription: undefined,
    aiOutputProvenance: undefined,
  };
  const recovered = recoverExperiencePresentationFromSource(
    sourceBoundExperience,
    options.targetLocale,
    options.gender,
  );
  if (recovered.description) return recovered;

  // Reuse the established relation-aware cross-locale fallback before a
  // provider is required. It receives only the already-bound immutable text;
  // the shared aggregate fact/argument/locale/tense gates below still decide
  // whether the result may become terminal presentation authority.
  const crossLocale = buildCrossLocaleExperienceFallback({
    sourceDescription: options.grounding.authorityText,
    sourceLocale: options.grounding.sourceLocale,
    targetLocale: options.targetLocale,
    gender: options.gender,
    isPresent: options.exp.isPresent,
    position: options.exp.position,
  }).trim();
  return crossLocale
    ? {
      description: crossLocale,
      recoveryKind: 'same_entry_semantic_recovery' as const,
      rejectionReason: null,
    }
    : recovered;
}

export function resolveExperiencePresentationSnapshot(options: {
  cv: CVData;
  targetLocale: Locale;
}): ExperiencePresentationSnapshot {
  const records: ExperiencePresentationRecord[] = [];
  let ok = true;
  const experience = (options.cv.experience || []).map((exp) => {
    const current = String(exp.description || '').trim();
    const grounding = recoverExperiencePresentationGrounding(options.cv, exp);
    const immutableSource = sourceLocaleForGrounding(grounding);
    const currentLocale = resolveExperienceSourceLocale(exp, options.cv.canonicalSnapshot).locale;
    const projectionRequired = !current
      || !currentLocale
      || !localesEquivalent(currentLocale, options.targetLocale);
    const currentPurity = validateAiUnitLocalePurity(current, options.targetLocale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    const currentLocaleAndSurfaceValid = Boolean(current)
      && !projectionRequired
      && isAcceptableExperiencePresentationPurity(currentPurity, options.targetLocale);
    // Manual current text remains established presentation authority. For an
    // unedited AI/deterministic surface, however, a target-locale label alone
    // cannot turn three distinct source facts into one repeated bullet. Detect
    // that source-to-presentation collision without re-adjudicating every
    // already-visible current surface (whose coverage is intentionally N/A).
    const currentSourceUnits = splitExperienceBullets(grounding.authorityText);
    const currentPresentationUnits = splitExperienceBullets(current);
    const currentUnitSources = new Map<string, Set<string>>();
    currentPresentationUnits.forEach((unit, index) => {
      const candidateKey = unit.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      const sourceKey = String(currentSourceUnits[index] || '')
        .normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      const sourceKeys = currentUnitSources.get(candidateKey) || new Set<string>();
      sourceKeys.add(sourceKey);
      currentUnitSources.set(candidateKey, sourceKeys);
    });
    const currentDistinctSourceCollision = grounding.source === 'immutable_fact_authority'
      && currentSourceUnits.length === currentPresentationUnits.length
      && [...currentUnitSources.values()].some((sourceKeys) => sourceKeys.size > 1);
    const currentTargetValid = currentLocaleAndSurfaceValid
      && !currentDistinctSourceCollision;
    let description = currentTargetValid
      ? current
      : '';
    let presentationAuthority: ExperiencePresentationAuthority = 'current_visible';
    let recoveryAttempted = false;
    let recoveryKind: ExperiencePresentationRecord['recoveryKind'] = null;
    let rejectionReason: string | null = null;

    if (!currentTargetValid) {
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
        // `projectExperienceFromLocalizedSurfaces` either returns exact
        // immutable same-entry units for a same-locale projection or only
        // persisted units that already passed independent binding/fidelity
        // verification. The aggregate selected description is nevertheless
        // revalidated below before it can become terminal authority.
        if (immutableSource.locale && localesEquivalent(immutableSource.locale, options.targetLocale)) {
          presentationAuthority = 'same_entry_semantic_recovery';
          recoveryKind = 'same_entry_semantic_recovery';
        } else {
          presentationAuthority = 'validated_target_projection';
          recoveryKind = 'validated_target_projection';
        }
      } else {
        const recovered = recoverBoundExperiencePresentationFromAuthority({
          exp,
          grounding,
          targetLocale: options.targetLocale,
          gender: options.cv.personal?.gender,
        });
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

    // A target-valid current textarea is the established display authority.
    // Immutable facts remain its grounding/provenance authority, but they are
    // not used to re-adjudicate the already-visible presentation during export;
    // record that coverage check as genuinely N/A rather than a false failure.
    // Recovered/cache/provider surfaces still require evaluated 1:1 coverage.
    let factCoverage = presentationAuthority === 'current_visible'
      ? { required: null, covered: null, missing: null, passed: null }
      : evaluatePresentationFactCoverage(
        exp,
        grounding.authorityText,
        description,
        options.targetLocale,
        options.cv.personal?.gender,
        { independentlyBoundProjection: presentationAuthority === 'validated_target_projection' },
      );
    let leakage = description
      ? validateCrossEntryExperienceLeakage({
        cv: options.cv,
        targetExperienceId: exp.id,
        candidate: description,
      })
      : { ok: false };
    // A terminal presentation cannot claim success with an evaluated but
    // incomplete immutable-fact check.  Preserve the evaluated false state in
    // diagnostics rather than rewriting it to an invented N/A value.
    if (description && factCoverage.passed === false) {
      description = '';
      presentationAuthority = 'unresolved';
      rejectionReason ||= 'same_entry_presentation_fact_coverage_failed';
      ok = false;
    }
    if (description && !leakage.ok) {
      description = '';
      presentationAuthority = 'unresolved';
      rejectionReason ||= 'same_entry_presentation_cross_entry_ownership_failed';
      ok = false;
    }
    if (!description) {
      leakage = { ok: false };
      if (factCoverage.passed === null) {
        factCoverage = { required: null, covered: null, missing: null, passed: null };
      }
    }
    const finalPurity = validateAiUnitLocalePurity(description, options.targetLocale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    const sourcePurity = grounding.authorityText && immutableSource.locale
      ? validateAiUnitLocalePurity(grounding.authorityText, immutableSource.locale, {
        kind: 'experience_bullet',
        requireUnits: true,
      })
      : null;
    records.push({
      // Filled with the ordered terminal snapshot identity once every entry is
      // resolved below. Keep the field present on every record so diagnostics
      // cannot accidentally compare unrelated per-entry arrays.
      presentationSnapshotId: '',
      owningEntryHash: hashExperienceLocalizedSurfaceValue(exp.id),
      currentVisibleDescriptionHash: hashExperienceLocalizedSurfaceValue(current),
      // This is the exact immutable authority material consumed by cache
      // binding/deterministic recovery, not a count-derived placeholder or a
      // current generated display hash.  It therefore cannot be empty on a
      // successful same-entry 3/3 recovery.
      immutableFactSetHash: grounding.duties.length > 0
        ? grounding.authorityTextHash
        : 'empty',
      sourceLocale: immutableSource.locale,
      immutableGroundingLocale: immutableSource.locale,
      currentPresentationLocale: currentLocale,
      targetLocale: options.targetLocale,
      projectionRequired,
      presentationAuthority,
      recoveryAttempted,
      recoveryKind,
      rejectionReason,
      selectedPresentationHash: hashExperienceLocalizedSurfaceValue(description),
      finalPresentationHash: hashExperienceLocalizedSurfaceValue(description),
      finalPresentationBulletCount: splitExperienceBullets(description).length,
      requiredFactCount: factCoverage.required,
      coveredFactCount: factCoverage.covered,
      missingFactCount: factCoverage.missing,
      factCoveragePassed: factCoverage.passed,
      detectedLocaleByBullet: finalPurity.detectedLocaleByUnit,
      detectedScriptByBullet: finalPurity.detectedScriptByUnit,
      sourceBulletScripts: sourcePurity?.detectedScriptByUnit || [],
      finalPresentationBulletScripts: finalPurity.detectedScriptByUnit,
      mixedLanguageBulletCount: finalPurity.mixedLanguageUnitCount,
      sourceLanguageLeakageDetected: finalPurity.sourceLanguageLeakageDetected,
      crossEntryOwnershipPassed: leakage.ok,
    });
    return { ...exp, description };
  });
  const presentationSnapshotId = hashExperienceLocalizedSurfaceValue(JSON.stringify({
    targetLocale: options.targetLocale,
    entries: records.map((record) => ({
      owningEntryHash: record.owningEntryHash,
      currentVisibleDescriptionHash: record.currentVisibleDescriptionHash,
      immutableFactSetHash: record.immutableFactSetHash,
      immutableGroundingLocale: record.immutableGroundingLocale,
      currentPresentationLocale: record.currentPresentationLocale,
      targetLocale: record.targetLocale,
      finalPresentationHash: record.finalPresentationHash,
      presentationAuthority: record.presentationAuthority,
      factCoveragePassed: record.factCoveragePassed,
    })),
  }));
  const finalizedRecords = records.map((record) => ({
    ...record,
    presentationSnapshotId,
  }));
  return {
    cv: { ...options.cv, experience },
    records: finalizedRecords,
    presentationSnapshotId,
    ok,
  };
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
