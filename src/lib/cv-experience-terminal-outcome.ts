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

void EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION;
void EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION;
void EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION;
void EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION;

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
