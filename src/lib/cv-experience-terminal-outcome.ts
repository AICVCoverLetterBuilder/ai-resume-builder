import type {
  ExperienceOperationSourceBundle,
  UneditedRerunEarlyNoOpPreflight,
} from './cv-experience-operation-source-bundle';
import type { ExperienceVisibleSourceAnalysis } from './cv-experience-visible-source-analysis';

/**
 * AAB-318 — Experience AI terminal outcome model.
 *
 * Clean no-op must not pass through rejected-apply / failure terminalizers.
 * Provider-not-attempted, candidate N/A, and stage skip semantics are explicit.
 */
export const EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION =
  'experience-preflight-build-metadata-318-v1' as const;
export const EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION =
  'experience-clean-noop-terminal-outcome-318-v1' as const;
export const EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION =
  'experience-provider-not-attempted-truth-318-v1' as const;
export const EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION =
  'experience-terminal-diagnostic-consistency-318-v1' as const;
export const EXPERIENCE_TRUE_TERMINAL_CLEAN_NOOP_448_REVISION =
  'experience-true-terminal-clean-noop-448-v1' as const;

void EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION;
void EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION;
void EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION;
void EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION;
void EXPERIENCE_TRUE_TERMINAL_CLEAN_NOOP_448_REVISION;

export type ExperienceAiTerminalDecisionKind =
  | 'material_improvement_applied'
  | 'exact_noop'
  | 'semantic_noop'
  | 'invalid_candidate_rejected'
  | 'degradation_rejected'
  | 'operation_failed';

export type ExperienceAiCleanNoOpTerminalFields = {
  revision: typeof EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION;
  experiencePreflightBuildMetadataRevision:
    typeof EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION;
  experienceProviderNotAttemptedTruthRevision:
    typeof EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION;
  experienceTerminalDiagnosticConsistencyRevision:
    typeof EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION;
  cleanNoOpTerminalized: true;
  finalDecisionKind: 'semantic_noop' | 'exact_noop';
  finalOutcomeReason: 'experience_ai_noop';
  semanticNoOpDetected: true;
  semanticNoOpReason: 'unedited_ai_output_already_valid' | string;
  preflightNoOpDetected: true;
  earlyNoOpPreflightPassed: true;
  earlyNoOpPreflightEvaluated: true;
  uneditedRerunDetected: true;
  materialImprovementDetected: false;
  materialImprovementKinds: [];
  materialImprovementEvidenceCount: 0;
  degradationDetected: false;
  degradationKinds: [];
  finalTypedFailureReason: null;
  rejectionStage: null;
  typedFailureReason: null;
  blocked: false;
  shouldApply: false;
  applyAttempted: false;
  applyNotAttemptedReason: 'no_apply_for_noop';
  visibleApplyApplicable: false;
  visibleApplySucceeded: false;
  shouldIncrementUsage: false;
  usageIncrementAttempted: false;
  countedAsSuccess: false;
  providerAttempted: false;
  providerHttpStatus: null;
  providerResponseKind: 'not_attempted';
  apiResponseKind: 'not_attempted';
  providerNoOpDetected: false;
  providerAccepted: false;
  providerRejectionStage: null;
  providerRejectionReasons: [];
  providerBulletCount: 0;
  providerBulletScripts: [];
  providerValidationApplicable: false;
  providerRequiredFactCount: null;
  providerCoveredFactCount: null;
  providerUnsupportedClaimCount: null;
  providerUnsupportedClaimKinds: [];
  finalCandidatePresent: false;
  finalCandidateSource: 'none';
  finalCandidateValidationApplicable: false;
  finalCandidatePredicateValidationApplicable: false;
  finalCandidatePredicateIdentityCount: null;
  finalSourceUnitPredicateCoveragePassed: null;
  finalCandidateBulletCount: 0;
  finalCandidateBulletScripts: [];
  appliedFinalBulletCount: 0;
  appliedFinalBulletScripts: [];
  finalBulletCount: 0;
  finalBulletScripts: [];
  finalNormalizedHash: null;
  visibleTextareaMatchesFinalNormalizedHash: null;
  raceGuardApplicable: false;
  raceGuardResult: 'not_required';
  appliedEmploymentState: null;
  arrayIndexAtApply: null;
  stableEntryIdentityMatched: null;
  targetEntryStillExists: null;
  entryContextMatchedAtApply: null;
  relevanceValidationApplicable: false;
  localeValidationApplicable: boolean;
  tenseValidationApplicable: boolean;
  perspectiveValidationApplicable: false;
  predicateValidationApplicable: false;
  relevanceValidationPassed: null;
  perspectiveValidationPassed: null;
  candidateLineage: Array<{
    candidateKind: 'visible_current_text';
    candidateOrigin: 'request_time_visible_source';
    present: true;
    attempted: true;
    accepted: false;
    acceptedForApply: false;
    selectionRole: 'no_op_authority';
    sourceAlreadyValidForTarget: true;
    meaningfulChangeDetected: false;
    finalDecisionRelevance: 'caused_early_noop';
    hash?: string | null;
    normalizedHash?: string | null;
    unitCount?: number;
  }>;
};

/** Immutable clean no-op terminal fields for early unedited-rerun preflight. */
export function buildExperienceCleanNoOpTerminalFields(options: {
  decisionKind?: 'semantic_noop' | 'exact_noop';
  semanticNoOpReason?: string;
  visibleSourceAlreadyValid?: boolean;
  visibleComparisonHash?: string | null;
  visibleComparisonNormalizedHash?: string | null;
  visibleComparisonUnitCount?: number;
}): ExperienceAiCleanNoOpTerminalFields {
  void EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION;
  void EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION;
  const visibleOk = options.visibleSourceAlreadyValid !== false;
  return {
    revision: EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION,
    experiencePreflightBuildMetadataRevision:
      EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION,
    experienceProviderNotAttemptedTruthRevision:
      EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION,
    experienceTerminalDiagnosticConsistencyRevision:
      EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION,
    cleanNoOpTerminalized: true,
    finalDecisionKind: options.decisionKind || 'semantic_noop',
    finalOutcomeReason: 'experience_ai_noop',
    semanticNoOpDetected: true,
    semanticNoOpReason:
      options.semanticNoOpReason || 'unedited_ai_output_already_valid',
    preflightNoOpDetected: true,
    earlyNoOpPreflightPassed: true,
    earlyNoOpPreflightEvaluated: true,
    uneditedRerunDetected: true,
    materialImprovementDetected: false,
    materialImprovementKinds: [],
    materialImprovementEvidenceCount: 0,
    degradationDetected: false,
    degradationKinds: [],
    finalTypedFailureReason: null,
    rejectionStage: null,
    typedFailureReason: null,
    blocked: false,
    shouldApply: false,
    applyAttempted: false,
    applyNotAttemptedReason: 'no_apply_for_noop',
    visibleApplyApplicable: false,
    visibleApplySucceeded: false,
    shouldIncrementUsage: false,
    usageIncrementAttempted: false,
    countedAsSuccess: false,
    providerAttempted: false,
    providerHttpStatus: null,
    providerResponseKind: 'not_attempted',
    apiResponseKind: 'not_attempted',
    providerNoOpDetected: false,
    providerAccepted: false,
    providerRejectionStage: null,
    providerRejectionReasons: [],
    providerBulletCount: 0,
    providerBulletScripts: [],
    providerValidationApplicable: false,
    providerRequiredFactCount: null,
    providerCoveredFactCount: null,
    providerUnsupportedClaimCount: null,
    providerUnsupportedClaimKinds: [],
    finalCandidatePresent: false,
    finalCandidateSource: 'none',
    finalCandidateValidationApplicable: false,
    finalCandidatePredicateValidationApplicable: false,
    finalCandidatePredicateIdentityCount: null,
    finalSourceUnitPredicateCoveragePassed: null,
    finalCandidateBulletCount: 0,
    finalCandidateBulletScripts: [],
    appliedFinalBulletCount: 0,
    appliedFinalBulletScripts: [],
    finalBulletCount: 0,
    finalBulletScripts: [],
    finalNormalizedHash: null,
    visibleTextareaMatchesFinalNormalizedHash: null,
    raceGuardApplicable: false,
    raceGuardResult: 'not_required',
    appliedEmploymentState: null,
    arrayIndexAtApply: null,
    stableEntryIdentityMatched: null,
    targetEntryStillExists: null,
    entryContextMatchedAtApply: null,
    relevanceValidationApplicable: false,
    localeValidationApplicable: visibleOk,
    tenseValidationApplicable: visibleOk,
    perspectiveValidationApplicable: false,
    predicateValidationApplicable: false,
    relevanceValidationPassed: null,
    perspectiveValidationPassed: null,
    candidateLineage: [{
      candidateKind: 'visible_current_text',
      candidateOrigin: 'request_time_visible_source',
      present: true,
      attempted: true,
      accepted: false,
      acceptedForApply: false,
      selectionRole: 'no_op_authority',
      sourceAlreadyValidForTarget: true,
      meaningfulChangeDetected: false,
      finalDecisionRelevance: 'caused_early_noop',
      hash: options.visibleComparisonHash ?? null,
      normalizedHash: options.visibleComparisonNormalizedHash ?? null,
      unitCount: options.visibleComparisonUnitCount ?? 0,
    }],
  };
}

/** Stage list for a clean early-preflight no-op (no fail results). */
export const EXPERIENCE_CLEAN_NOOP_STAGE_PLAN: ReadonlyArray<{
  stage: string;
  result: 'ok' | 'skipped';
  typedReason?: string;
}> = [
  { stage: 'unedited_rerun_preflight', result: 'ok' },
  { stage: 'provider_request_started', result: 'skipped', typedReason: 'provider_not_required' },
  { stage: 'api_response_received', result: 'skipped', typedReason: 'provider_not_required' },
  { stage: 'provider_output_parsed', result: 'skipped', typedReason: 'provider_not_required' },
  { stage: 'locale_validation', result: 'ok', typedReason: 'visible_source_already_valid' },
  { stage: 'material_coverage_validation', result: 'ok', typedReason: 'visible_source_already_valid' },
  { stage: 'unsupported_claim_validation', result: 'ok', typedReason: 'visible_source_already_valid' },
  { stage: 'duplicate_validation', result: 'ok', typedReason: 'visible_source_already_valid' },
  { stage: 'tense_normalization', result: 'skipped', typedReason: 'visible_tense_already_valid' },
  { stage: 'perspective_normalization', result: 'skipped', typedReason: 'visible_perspective_already_valid' },
  { stage: 'deterministic_fallback_started', result: 'skipped', typedReason: 'no_fallback_for_noop' },
  { stage: 'fallback_output_built', result: 'skipped', typedReason: 'no_fallback_for_noop' },
  { stage: 'fallback_locale_validation', result: 'skipped', typedReason: 'no_fallback_for_noop' },
  { stage: 'fallback_material_coverage', result: 'skipped', typedReason: 'no_fallback_for_noop' },
  { stage: 'final_apply_postcondition', result: 'skipped', typedReason: 'no_apply_for_noop' },
  { stage: 'visible_apply', result: 'skipped', typedReason: 'no_apply_for_noop' },
  { stage: 'usage_increment', result: 'skipped', typedReason: 'no_increment_for_noop' },
];

export type ExperienceVisibleCoverageForCleanNoOp = Readonly<{
  visibleRequiredFactCount: number;
  visibleCoveredFactCount: number;
  visibleUncoveredFactIdentityHashes: string[];
  visibleFactCoveragePassed: boolean;
  visibleRequiredPredicateCount: number;
  visibleCoveredPredicateCount: number;
  visibleMissingPredicateIdentityHashes: string[];
  visiblePredicateCoveragePassed: boolean;
  visiblePredicateValidationApplicable: boolean;
  visibleNormalizedHash: string;
  visibleDescriptionMatchesFinalHash: boolean;
  visibleLocaleValidationPassed: boolean;
  visiblePerspectiveValidationPassed: boolean;
  visibleNativeMorphologyValidationPassed: boolean;
}>;

/**
 * Immutable request-time clean-noop snapshot.
 *
 * This is built from the exact authority and coverage objects that made the
 * preflight decision. It must not invoke provider/fallback finalization again.
 */
export function buildExperienceRequestTimeCleanNoOpSnapshot(options: {
  sourceBundle: ExperienceOperationSourceBundle;
  preflight: UneditedRerunEarlyNoOpPreflight;
  visibleAuthority: ExperienceVisibleSourceAnalysis;
  visibleCoverage: ExperienceVisibleCoverageForCleanNoOp;
  requestedLocale: string;
  entryGeneratedLocaleBeforeApply?: string | null;
  contentLocaleDocument?: string | null;
}): Readonly<Record<string, unknown>> {
  void EXPERIENCE_TRUE_TERMINAL_CLEAN_NOOP_448_REVISION;
  const { sourceBundle, preflight, visibleAuthority, visibleCoverage } = options;
  if (
    preflight.earlyNoOpPreflightPassed !== true
    || visibleAuthority.sourceAlreadyValidForTarget !== true
    || visibleCoverage.visibleFactCoveragePassed !== true
    || (
      visibleCoverage.visiblePredicateValidationApplicable
      && visibleCoverage.visiblePredicateCoveragePassed !== true
    )
    || visibleCoverage.visibleLocaleValidationPassed !== true
    || visibleCoverage.visiblePerspectiveValidationPassed !== true
    || visibleCoverage.visibleNativeMorphologyValidationPassed !== true
  ) {
    throw new Error('experience_clean_noop_snapshot_requires_valid_preflight');
  }

  const base = buildExperienceCleanNoOpTerminalFields({
    decisionKind: 'semantic_noop',
    semanticNoOpReason:
      preflight.semanticNoOpReason || 'unedited_ai_output_already_valid',
    visibleSourceAlreadyValid: true,
    visibleComparisonHash: sourceBundle.visibleSourceHash,
    visibleComparisonNormalizedHash: sourceBundle.visibleSourceNormalizedHash,
    visibleComparisonUnitCount: sourceBundle.visibleSourceUnitCount,
  });
  const emptyStrings = Object.freeze([] as string[]);
  const visibleLineage = Object.freeze(base.candidateLineage.map((item) => Object.freeze({
    ...item,
  })));

  return Object.freeze({
    ...base,
    candidateLineage: visibleLineage,
    experienceTrueTerminalCleanNoopRevision:
      EXPERIENCE_TRUE_TERMINAL_CLEAN_NOOP_448_REVISION,
    cleanNoOpTerminalSnapshotFrozen: true,

    factAuthorityKind: sourceBundle.factAuthorityKind,
    factAuthorityHash: sourceBundle.factAuthorityHash,
    factAuthorityNormalizedHash: sourceBundle.factAuthorityNormalizedHash,
    factAuthorityUnitCount: sourceBundle.factAuthorityUnitCount,
    authoritativeFactSourceKind: sourceBundle.authoritativeFactSourceKind,
    factAuthorityMatchesAuthoritativeSourceKind:
      sourceBundle.factAuthorityMatchesAuthoritativeSourceKind,
    factAuthoritySeparatedFromVisibleSource:
      sourceBundle.factAuthoritySeparatedFromVisibleSource,
    visibleOperationSourceKind: sourceBundle.visibleOperationSourceKind,
    visibleSourceAnalysisKind: 'currentTextarea',
    providerRewriteBaseKind: sourceBundle.providerRewriteBaseKind,
    visibleComparisonSourceKind: sourceBundle.visibleComparisonSourceKind,
    visibleComparisonHash: sourceBundle.visibleSourceHash,
    visibleComparisonNormalizedHash: sourceBundle.visibleSourceNormalizedHash,
    visibleComparisonUnitCount: sourceBundle.visibleSourceUnitCount,
    visibleComparisonProvenance: sourceBundle.visibleSourceProvenance,
    visibleComparisonMatchedLastAiOutput:
      sourceBundle.visibleSourceMatchedLastAiOutput,
    visibleComparisonUsedForNoOp: true,
    visibleComparisonUsedForDegradationCheck: true,
    visibleComparisonCapturedAtRequest: true,
    currentTextareaProvenance: sourceBundle.visibleSourceProvenance,
    lastAiOutputHashMatched: sourceBundle.visibleSourceMatchedLastAiOutput,
    materialUserEditDetected: sourceBundle.visibleSourceMateriallyEdited,

    uneditedRerunDetected: preflight.uneditedRerunDetected,
    earlyNoOpPreflightEvaluated: preflight.earlyNoOpPreflightEvaluated,
    earlyNoOpPreflightPassed: preflight.earlyNoOpPreflightPassed,
    earlyNoOpPreflightFailureReasons: Object.freeze([
      ...preflight.earlyNoOpPreflightFailureReasons,
    ]),
    employmentStateMatchesLastAiOutput: preflight.employmentStateMatchesLastAiOutput,
    localeMatchesLastAiOutput: preflight.localeMatchesLastAiOutput,
    entryIdentityMatchesLastAiOutput: preflight.entryIdentityMatchesLastAiOutput,
    jobContextMatchesLastAiOutput: preflight.jobContextMatchesLastAiOutput,
    visibleHashMatchesLastAiOutput: preflight.visibleHashMatchesLastAiOutput,
    visibleSourceAlreadyValidForTarget: preflight.visibleSourceAlreadyValidForTarget,
    sourceAlreadyValidForTarget: true,

    visibleTextareaLocale: visibleAuthority.sourceLocale,
    visibleTextareaLocaleBeforeApply: visibleAuthority.sourceLocale,
    detectedVisibleTextLocale: visibleAuthority.rawDetectedLocale,
    visibleLocaleAuthorityKind: visibleAuthority.localeAuthorityKind,
    rawDetectorDisagreesWithTrustedLocale:
      visibleAuthority.rawDetectorDisagreesWithTrustedLocale,
    visibleLocaleMetadataMismatchRecorded:
      visibleAuthority.rawDetectorDisagreesWithTrustedLocale,
    entryGeneratedLocaleBeforeApply:
      options.entryGeneratedLocaleBeforeApply || null,
    contentLocaleDocument: options.contentLocaleDocument || null,
    requestedTargetLocale: options.requestedLocale,
    targetLocale: options.requestedLocale,
    targetLocaleValidationPassed: true,
    localeValidationPassed: true,
    targetLocalePurityPassed: true,
    relevanceValidationPassed: true,
    tenseValidationPassed: true,
    sourceTenseMismatchCount: visibleAuthority.tenseMismatchCount,
    sourceTenseValidationPassed: visibleAuthority.sourceTenseValidationPassed,
    expectedEmploymentTense: visibleAuthority.expectedEmploymentTense,
    sourceDetectedTense: visibleAuthority.sourceDetectedTense,

    visibleRequiredFactCount: visibleCoverage.visibleRequiredFactCount,
    visibleCoveredFactCount: visibleCoverage.visibleCoveredFactCount,
    visibleUncoveredFactIdentityHashes: Object.freeze([
      ...visibleCoverage.visibleUncoveredFactIdentityHashes,
    ]),
    visibleFactCoveragePassed: true,
    visibleRequiredPredicateCount: visibleCoverage.visibleRequiredPredicateCount,
    visibleCoveredPredicateCount: visibleCoverage.visibleCoveredPredicateCount,
    visibleMissingPredicateIdentityHashes: Object.freeze([
      ...visibleCoverage.visibleMissingPredicateIdentityHashes,
    ]),
    visiblePredicateCoveragePassed:
      visibleCoverage.visiblePredicateCoveragePassed,
    visiblePredicateValidationApplicable:
      visibleCoverage.visiblePredicateValidationApplicable,
    visibleNativeMorphologyValidationPassed: true,
    perspectiveValidationPassed: true,

    providerAttempted: false,
    providerHttpStatus: null,
    providerResponseKind: 'not_attempted',
    apiResponseKind: 'not_attempted',
    providerValidationApplicable: false,
    providerRequiredFactCount: null,
    providerCoveredFactCount: null,
    providerUncoveredFactCount: null,
    providerUncoveredFactIdentityHashes: emptyStrings,
    providerRejectionStage: null,
    providerRejectionReasons: emptyStrings,
    providerUnsupportedClaimCount: null,
    providerUnsupportedClaimKinds: emptyStrings,
    providerAccepted: false,

    recoveryAttempted: false,
    recoveryHttpStatus: null,
    recoveryCandidatePresent: false,
    recoveryCandidateHash: null,
    recoveryCandidateNormalizedHash: null,
    recoveryCandidateUnitCount: 0,
    recoveryCandidateUnitHashes: emptyStrings,
    recoveryAccepted: false,
    recoverySelected: false,
    recoveryRejectionReasons: emptyStrings,
    serverRepairAttempted: false,
    serverRepairSelected: false,
    serverRepairSource: null,

    translationProviderAttempted: false,
    translationRepairAttempted: false,
    translationFallbackAttempted: false,
    translationFallbackApplied: false,
    translationFallbackSelected: false,
    fallbackApplied: false,
    fallbackSelected: false,
    fallbackReason: null,
    fallbackBulletCount: 0,
    fallbackBulletScripts: emptyStrings,
    clientDeterministicFallbackAttempted: false,
    clientDeterministicFallbackSelected: false,
    clientDeterministicFallbackApplied: false,
    clientDeterministicFallbackUsedForFinalCandidate: false,
    clientDeterministicFallbackBulletCount: 0,
    clientDeterministicFallbackScripts: emptyStrings,

    finalCandidateSource: 'none',
    finalCandidatePresent: false,
    finalCandidateValidationApplicable: false,
    finalCandidatePredicateValidationApplicable: false,
    finalCandidatePredicateIdentityCount: null,
    finalSourceUnitPredicateCoveragePassed: null,
    finalCandidateBulletCount: 0,
    finalCandidateBulletScripts: emptyStrings,
    finalRequiredFactCount: 0,
    finalCoveredFactCount: 0,
    finalUncoveredFactIdentityHashes: emptyStrings,
    finalNormalizedHash: null,
    finalBulletCount: 0,
    finalBulletScripts: emptyStrings,
    appliedFinalBulletCount: 0,
    appliedFinalBulletScripts: emptyStrings,

    applyAuthorized: false,
    applyAttempted: false,
    applyWriteSucceeded: false,
    applyCommitted: false,
    targetContentApplied: false,
    visibleApplyApplicable: false,
    visibleApplySucceeded: false,
    visibleValidationAttempted: false,
    visibleValidationPassed: false,
    shouldIncrementUsage: false,
    usageIncrementAttempted: false,
    countedAsSuccess: false,
    canonicalExperienceDecisionCreated: true,
    providerPrimaryCandidateValidationAccepted: null,
    providerCandidateValidationAccepted: null,
    finalVisibleDecisionAcceptedForApply: false,
    canonicalExperienceDecisionAllowsApply: false,
    canonicalExperienceDecisionAllowsUsage: false,
  });
}
