/**
 * Release-safe, non-PII Experience AI diagnostics for on-device incident traces.
 *
 * Never stores names, companies, emails, phones, titles, or CV/provider prose —
 * only metadata, lengths, one-way hashes, scripts, stages, and typed reasons.
 *
 * Does not change Experience validation, matching, fallback wording, or apply
 * behavior — observation only.
 */
import type { WorkExperience } from './types';
import { fingerprintText, resolveAppVersionInfo, resolveNextBuildId } from './cv-export-diagnostics';
import { extractSourceDutyUnits, sourceFactIdentitiesFromDescription } from './cv-source-fact-identity';
import { splitExperienceBullets } from './cv-canonical-facts';
import { getApiBaseUrl } from './api';
import type { AiGroundingResolution } from './cv-experience-job-context';
import type { FinalizeCvAiFieldResult } from './cv-ai-finalize-apply';
import {
  EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
  EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
} from './cv-ai-finalize-apply';
import {
  EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION,
  EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION,
  EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION,
  EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION,
  EXPERIENCE_CLEAN_NOOP_STAGE_PLAN,
  buildExperienceCleanNoOpTerminalFields,
} from './cv-experience-terminal-outcome';
import {
  EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION,
  EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION,
  EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION,
  experienceFactAuthorityKindsEquivalent,
  normalizeExperienceFactAuthorityKind,
  resolveCanonicalFactAuthorityKind,
} from './cv-experience-authority-snapshot-327';
import {
  EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION,
  EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION,
  evaluateExperiencePhaseLocaleValidation,
  reconcileExperienceTerminalRejectionReason,
  computeAuthoritativeSourceAlreadyTargetLocale,
  computeVisibleTextareaAlreadyTargetLocale,
  legacySourceAlreadyValidForTargetMeaning,
  isExperienceLocaleRejectionReason,
} from './cv-experience-locale-rejection-truth-328';
import {
  EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION,
  EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION,
  EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION,
  EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION,
  checkExperiencePreapplyDiagnosticCompleteness,
  checkExperiencePreapplyDiagnosticInvariants,
  checkExperiencePostapplyDiagnosticCompleteness,
  combineExperienceDiagnosticCompleteness,
  buildExperiencePreapplyDecisionSnapshot,
} from './cv-experience-phased-apply-329';
import type {
  ExperienceAuthoritativeFactSourceKind,
  ExperienceTextareaProvenanceKind,
} from './cv-experience-ai-output-provenance';
import {
  experienceAiSourcesEquivalent,
} from './cv-experience-ai-operation-snapshot';
void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
void EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION;
void EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION;
void EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION;
void EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION;
void EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION;
void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
void EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION;
void EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION;
void EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION;
void EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION;
void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
void EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION;
void EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION;
import { detectTextLocale } from './cv-content-locale';
import { resolveTargetScriptForLocale } from './cv-ai-unit-locale-purity';
import { hashExperienceEntryId } from './cv-experience-entry-isolation';
import type { Locale } from './i18n/translations';
import {
  appendCvAiDiagnosticHistory,
  assertCvAiDiagnosticPrivacy,
  buildCvAiDiagnosticBuildIdentity,
  checkExperienceDiagnosticCompleteness,
  checkExperienceDiagnosticInvariants,
  classifyApiHostClass,
  CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
  CV_AI_DIAGNOSTICS_V2_299_REVISION,
  EXPERIENCE_AI_DIAG_MARKER,
  EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION,
  maybeTruncateDiagnosticPayload,
  sanitizeCvAiDiagnosticMarkerPatch,
} from './cv-ai-diagnostics-contract';
import { INTERNAL_AI_RESET_ENABLED } from './build-channel';
import {
  emitCvAiDiagnosticsChanged,
  EXPERIENCE_AI_DIAG_STORAGE_KEY as EXPERIENCE_AI_DIAG_STORAGE_KEY_CANON,
} from './cv-ai-diagnostics-lifecycle';

/** Retain for AAB asset verification (must survive minification). */
void EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION;
void EXPERIENCE_AI_DIAG_MARKER;

export const EXPERIENCE_AI_TRACE_SCHEMA_VERSION = 1 as const;
export const EXPERIENCE_AI_DIAG_STORAGE_KEY = EXPERIENCE_AI_DIAG_STORAGE_KEY_CANON;

/**
 * Marker / UI strings for Experience AI diagnostics live only in
 * `CvExportDiagnosticsControls` behind INTERNAL_AI_RESET_ENABLED so production
 * DCE can omit them. This always-loaded module must not embed those literals.
 */

export type ExperienceAiDiagStageName =
  | 'button_pressed'
  | 'live_experience_read'
  | 'source_description_selected'
  | 'source_units_split'
  | 'job_context_built'
  | 'request_payload_built'
  | 'request_started'
  | 'unedited_rerun_preflight'
  | 'provider_request_started'
  | 'api_response_received'
  | 'provider_output_parsed'
  | 'locale_validation'
  | 'source_fact_identity_created'
  | 'material_coverage_validation'
  | 'unsupported_claim_validation'
  | 'duplicate_validation'
  | 'tense_normalization'
  | 'perspective_normalization'
  | 'deterministic_fallback_started'
  | 'fallback_output_built'
  | 'fallback_locale_validation'
  | 'fallback_material_coverage'
  | 'diagnostic_preapply_gate'
  | 'final_candidate_postconditions'
  | 'final_candidate_fact_validation'
  | 'final_candidate_predicate_validation'
  | 'preapply_invariant_gate'
  | 'preapply_completeness_gate'
  | 'apply_authorized'
  | 'temporary_visible_write'
  | 'visible_fact_validation'
  | 'visible_predicate_validation'
  | 'visible_locale_validation'
  | 'visible_tense_validation'
  | 'visible_hash_validation'
  | 'postapply_invariant_gate'
  | 'postapply_completeness_gate'
  | 'apply_committed'
  | 'rollback_started'
  | 'rollback_completed'
  /** @deprecated Renamed to final_candidate_postconditions (AAB-329). */
  | 'final_apply_postcondition'
  | 'race_context_check'
  | 'visible_apply'
  | 'usage_increment';

export type ExperienceAiDiagStageResult = 'ok' | 'fail' | 'skipped';

export type ExperienceAiDiagStage = {
  stage: ExperienceAiDiagStageName;
  result: ExperienceAiDiagStageResult;
  typedReason?: string;
  requestIdHash?: string;
  currentJobContextHash?: string;
  originalRequestJobContextHash?: string;
};

export type ExperienceScriptClass =
  | 'latin'
  | 'latin_diacritic'
  | 'cyrillic'
  | 'devanagari'
  | 'arabic'
  | 'cjk'
  | 'mixed'
  | 'empty'
  | 'other';

export type ExperienceSelectedSourceKind =
  | 'currentTextarea'
  | 'liveUserDescription'
  | 'description'
  | 'originalUserDescription'
  | 'canonicalDescription'
  | 'canonicalSnapshot'
  | 'generatedDescription'
  | 'recovered_semantic_duties'
  | 'legacy_grounding'
  | 'deterministic_fallback_source'
  | 'grounding_resolution'
  | 'jobContext'
  | 'none'
  | 'unknown';

export type ExperienceApiHostClass =
  | 'vercel_production'
  | 'vercel_preview'
  | 'custom_https'
  | 'same_origin'
  | 'unknown';

export type ExperienceAiDiagnosticTrace = {
  schemaVersion: typeof EXPERIENCE_AI_TRACE_SCHEMA_VERSION;
  marker: string;
  capturedAt: string;
  appVersionCode: string | null;
  appVersionName: string | null;
  nextBuildId: string | null;
  responseDiagnosticMetadataVersion: number;
  requestedLocale: string;
  uiLocale: string;
  contentLocale: string | null;
  templateId: string;
  employmentState: 'current' | 'completed';
  selectedGender: string;
  sourceDescriptionPresent: boolean;
  sourceDescriptionLength: number;
  sourceDescriptionHash: string;
  sourceScript: ExperienceScriptClass;
  sourceUnitCount: number;
  sourceUnitLengths: number[];
  sourceUnitHashes: string[];
  sourceFactIdentityCount: number;
  selectedSourceKind: ExperienceSelectedSourceKind;
  selectedSourceLocale: string | null;
  selectedSourceHash: string;
  rejectedStaleSourceKinds: ExperienceSelectedSourceKind[];
  /** True only when the declared selected kind is also listed as rejected (should be rare/false). */
  selectedSourceActuallyRejected: boolean;
  detectedSourceLocale: string | null;
  storedSourceLocale: string | null;
  requestedTargetLocale: string | null;
  /**
   * Locale model for cross-locale Experience ops (do not collapse):
   * - authoritativeFactSourceLocale: fact-authority text locale (often original EN)
   * - visibleTextareaLocale / visibleTextareaLocaleBeforeApply: request-time
   *   visible textarea locale (pre-apply snapshot)
   * - entryGeneratedLocaleBeforeApply: Experience entry.generatedLocale before apply
   * - requestedTargetLocale: UI/requested output locale for this operation
   * - appliedVisibleContentLocale: post-commit persisted applied locale only
   * - contentLocaleDocument: CVData.contentLocale (document-level field)
   * Session `contentLocale` may be an operational/UI alias and must not be treated
   * as appliedVisibleContentLocale.
   */
  authoritativeFactSourceLocale?: string | null;
  visibleTextareaLocale?: string | null;
  visibleTextareaLocaleBeforeApply?: string | null;
  entryGeneratedLocaleBeforeApply?: string | null;
  visibleLocaleMetadataMismatchRecorded?: boolean | null;
  detectedVisibleTextLocale?: string | null;
  persistedGeneratedLocaleForVisibleMismatch?: string | null;
  contentLocaleDocument?: string | null;
  appliedVisibleContentLocale?: string | null;
  /** Raw persisted/requested locale before public canonicalize (debug only). */
  appliedVisibleContentLocaleRaw?: string | null;
  crossLocaleOperation: boolean;
  translationProviderAttempted: boolean;
  translationRepairAttempted: boolean;
  translationFallbackAttempted: boolean;
  translationFallbackApplied: boolean;
  /** True when a target-locale deterministic fallback was selected (pre-commit). */
  translationFallbackSelected?: boolean;
  translatedFactCount: number | null;
  targetLocaleValidationPassed: boolean | null;
  sourcePerspectiveMode: string | null;
  targetPerspectiveMode: string | null;
  targetContentApplied: boolean;
  contentLocaleUpdatedAfterApply: boolean;
  providerCoverageCount: number | null;
  fallbackCoverageCount: number | null;
  englishSourceStillAuthoritative: boolean;
  /** Explicit replacement for the misnamed englishSourceStillAuthoritative flag. */
  staleForeignLocaleSourceAuthoritative: boolean;
  selectedSourceLanguage: string | null;
  selectedSourceScript: string | null;
  liveTextSelected: boolean;
  selectedSourceMatchesLiveNormalized: boolean;
  selectedSourceDiffReason: string | null;
  canonicalFormattingOnlyDifference: boolean;
  operationSnapshotSourceKind: ExperienceSelectedSourceKind | null;
  currentTextareaIgnoredOrOverridden: boolean;
  liveTextHash: string;
  selectedSourceMatchesLiveText: boolean;
  selectedSourceMateriallyDiffersFromLiveText: boolean;
  selectedSourceEquivalentToLiveText: boolean;
  selectedSourceContextCurrent: boolean;
  payloadLocale: string;
  payloadIndustryNorm: string;
  payloadLevelNorm: string;
  payloadEmploymentState: 'current' | 'completed' | 'unknown';
  payloadSourceDescriptionLength: number;
  payloadSourceDescriptionHash: string;
  payloadSourceScript: ExperienceScriptClass;
  payloadSourceDutyCount: number;
  payloadJobContextHash: string;
  factLockEnabled: boolean;
  factLockReason: string | null;
  generationSourceKind: 'jobContext' | 'liveSource' | 'none' | null;
  generatedDescriptionPreexisted: boolean;
  staleGeneratedDescriptionIgnored: boolean;
  /** AAB-304: live textarea provenance vs last AI output. */
  currentTextareaProvenance?: string | null;
  authoritativeFactSourceKind?: string | null;
  currentTextareaUsedForFactExtraction?: boolean | null;
  lastAiOutputHashMatched?: boolean | null;
  materialUserEditDetected?: boolean | null;
  generationProviderValidationPassed: boolean | null;
  generationProviderRejectionReason: string | null;
  generationFinalPostconditionPassed: boolean | null;
  generationFallbackBuilderKind: string | null;
  generationFallbackFailureReason: string | null;
  apiHostClass: ExperienceApiHostClass;
  providerHttpStatus: number | null;
  providerResponseKind: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown' | 'not_attempted';
  providerBulletCount: number;
  providerBulletScripts: ExperienceScriptClass[];
  providerLocaleValidationReason: string | null;
  requiredFactCount: number;
  coveredFactCount: number;
  uncoveredFactIdentityHashes: string[];
  /** Provider-candidate coverage (retained after fallback; never overwritten by final). */
  providerRequiredFactCount?: number | null;
  providerCoveredFactCount?: number | null;
  providerUncoveredFactIdentityHashes?: string[];
  providerAccepted?: boolean | null;
  providerRejectionStage?: string | null;
  providerRejectionReasons?: string[];
  providerUnsupportedClaimCount?: number | null;
  providerUnsupportedClaimKinds?: string[];
  /** Final-selected candidate hash after successful apply. */
  finalNormalizedHash?: string | null;
  experienceDiagnosticsFinalCandidateRevision?: string | null;
  /** Candidate lineage: provider / fallback / final_selected (hashes only). */
  candidateLineage?: Array<{
    candidateKind: string;
    present: boolean;
    accepted: boolean;
    hash?: string | null;
    normalizedHash?: string | null;
    unitCount?: number;
    unitHashes?: string[];
    coverageRequiredCount?: number | null;
    coverageCoveredCount?: number | null;
    uncoveredFactIdentityHashes?: string[];
    unsupportedClaimCount?: number;
    unsupportedClaimKinds?: string[];
    rejectionStage?: string | null;
    rejectionReasons?: string[];
    localeValidationPassed?: boolean | null;
    tenseValidationPassed?: boolean | null;
    perspectiveValidationPassed?: boolean | null;
    meaningfulChangeDetected?: boolean | null;
  }>;
  unsupportedClaimCount: number;
  duplicateBulletCount: number;
  tenseMode: 'present' | 'past' | 'unknown';
  perspectiveMode: 'cv_third_person' | null;
  sourcePersonMode: string | null;
  providerPersonMode: string | null;
  normalizedPersonMode: string | null;
  finalPersonMode: string | null;
  perspectiveNormalizationAttempted: boolean;
  perspectiveNormalizationApplied: boolean;
  perspectiveValidationPassed: boolean | null;
  normalizedBulletsUsedForApply: boolean;
  finalMatchesProviderOutput: boolean;
  finalMatchesSourceAfterNormalization: boolean;
  meaningfulChangeDetected: boolean;
  noOpRejected: boolean;
  providerNoOpDetected: boolean;
  noOpRepairAttempted: boolean;
  noOpRepairHttpStatus: number | null;
  noOpRepairValidationPassed: boolean | null;
  noOpRepairMeaningfulChangeDetected: boolean | null;
  noOpRepairApplied: boolean;
  noOpRepairUnsupportedClaimCount: number;
  noOpRepairUnsupportedClaimKinds: string[];
  noOpRepairScopeExpansionDetected: boolean;
  noOpRepairUniversalQuantifierDetected: boolean;
  noOpRepairResponsibilityEscalationDetected: boolean;
  noOpRepairRejectionReason: string | null;
  unsupportedClaimRepairAttempted: boolean;
  unsupportedClaimRepairKind: string | null;
  unsupportedClaimRepairValidationPassed: boolean | null;
  unsupportedClaimRepairApplied: boolean;
  unsupportedClaimRepairRejectionReason: string | null;
  unsupportedClaimRepairUnsupportedClaimCount: number;
  unsupportedClaimRepairUnsupportedClaimKinds: string[];
  unsupportedClaimRepairResidualUnsupportedClaimCount: number;
  unsupportedClaimRepairResidualUnsupportedClaimKinds: string[];
  unsupportedClaimRepairCoverageRequiredCount: number | null;
  unsupportedClaimRepairCoverageCoveredCount: number | null;
  unsupportedClaimRepairUncoveredFactIdentityHashes: string[];
  unsupportedClaimRepairHash: string | null;
  unsupportedClaimRepairNormalizedHash: string | null;
  experienceRepairLineageRevision: string | null;
  spanishExperienceRepairGroundingRevision: string | null;
  experiencePredicateRepairLineageRevision: string | null;
  spanishExperiencePredicateGroundingRevision: string | null;
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  unsupportedPredicateKindCount: number;
  coordinatedPredicateExpansionDetected: boolean;
  sourceUnitPredicateCoveragePassed: boolean | null;
  repairResidualAddedPredicateCount: number;
  repairResidualAddedPredicateIdentityHashes: string[];
  providerSourcePredicateIdentityCount: number;
  providerCandidatePredicateIdentityCount: number;
  providerCandidateAddedPredicateCount: number;
  providerCandidateAddedPredicateIdentityHashes: string[];
  providerCoordinatedPredicateExpansionDetected: boolean;
  providerSourceUnitPredicateCoveragePassed: boolean | null;
  repairCandidatePredicateIdentityCount: number;
  repairCoordinatedPredicateExpansionDetected: boolean;
  repairSourceUnitPredicateCoveragePassed: boolean | null;
  finalCandidatePredicateIdentityCount: number;
  finalAddedPredicateCount: number;
  finalAddedPredicateIdentityHashes: string[];
  finalCoordinatedPredicateExpansionDetected: boolean;
  finalSourceUnitPredicateCoveragePassed: boolean | null;
  providerComplianceScopeExpansionDetected: boolean;
  providerComplianceExpansionKindCount: number;
  repairResidualComplianceScopeExpansionDetected: boolean;
  finalComplianceScopeExpansionDetected: boolean;
  factAuthorityKind: string | null;
  factAuthorityHash: string | null;
  factAuthorityNormalizedHash: string | null;
  factAuthorityUnitCount: number;
  factAuthorityMatchesAuthoritativeSourceKind: boolean;
  /** AAB-317 dual-source / early no-op diagnostic fields. */
  earlyNoOpPreflightPassed?: boolean | null;
  earlyNoOpPreflightEvaluated?: boolean | null;
  uneditedRerunDetected?: boolean | null;
  providerAttempted?: boolean | null;
  finalOutcomeReason?: string | null;
  finalCandidatePresent?: boolean | null;
  finalCandidatePredicateValidationApplicable?: boolean | null;
  finalCandidateBulletCount?: number | null;
  finalCandidateBulletScripts?: string[] | null;
  appliedFinalBulletCount?: number | null;
  appliedFinalBulletScripts?: string[] | null;
  sourceAlreadyValidForTarget?: boolean | null;
  /** AAB-328 — authoritative (pre-AI) source already in target locale. */
  authoritativeSourceAlreadyTargetLocale?: boolean | null;
  /** AAB-328 — request-time visible textarea already in target locale. */
  visibleTextareaAlreadyTargetLocale?: boolean | null;
  /** AAB-328 — documents what legacy sourceAlreadyValidForTarget means. */
  sourceAlreadyValidForTargetMeaning?: 'visible_textarea_already_target_locale' | null;
  experiencePhaseLocaleTruthRevision?: string | null;
  experienceRejectionLineageTruthRevision?: string | null;
  preflightNoOpDetected?: boolean | null;
  applyAttempted?: boolean | null;
  applyNotAttemptedReason?: string | null;
  /** AAB-329 phased apply / completeness. */
  applyAuthorized?: boolean | null;
  applyWriteSucceeded?: boolean | null;
  visibleValidationAttempted?: boolean | null;
  visibleValidationPassed?: boolean | null;
  rollbackAttempted?: boolean | null;
  rollbackSucceeded?: boolean | null;
  applyCommitted?: boolean | null;
  /** AAB-414 transaction-owned Experience write/readback lifecycle. */
  experienceApplyOperationSourceHash?: string | null;
  experienceApplySelectedFinalHash?: string | null;
  experienceApplyCvRefHashBeforeWrite?: string | null;
  experienceApplyFormHashBeforeWrite?: string | null;
  experienceApplyTransactionWrittenHash?: string | null;
  experienceApplyCvRefHashImmediatelyAfterWrite?: string | null;
  experienceApplyTransactionEntryIdHash?: string | null;
  experienceApplyOperationIdHash?: string | null;
  experienceApplyOwnershipPassed?: boolean | null;
  experienceApplyActualRaceDetected?: boolean | null;
  experienceApplyActualRaceReason?: string | null;
  experienceApplyPostWriteReadSource?: string | null;
  experienceApplyFailureKind?: string | null;
  attemptedApplyExperienceEntryIdHash?: string | null;
  attemptedApplyEmploymentState?: string | null;
  attemptedApplyCandidateHash?: string | null;
  preapplyDecisionSnapshotHash?: string | null;
  preapplyDecisionCandidateHash?: string | null;
  preapplyDecisionTargetEntryIdHash?: string | null;
  preapplyDecisionCreated?: boolean | null;
  preapplyDecisionUsedForApplyAuthorization?: boolean | null;
  preapplyDiagnosticInvariantCheckPassed?: boolean | null;
  preapplyDiagnosticInvariantFailures?: Array<{
    invariantCode: string;
    observed: Record<string, string | number | boolean | null>;
  }> | null;
  preapplyDiagnosticCompletenessPassed?: boolean | null;
  preapplyMissingRequiredDiagnosticFields?: string[] | null;
  preapplyNullRequiredDiagnosticFields?: string[] | null;
  postapplyDiagnosticInvariantCheckPassed?: boolean | null;
  postapplyDiagnosticInvariantFailures?: Array<{
    invariantCode: string;
    observed: Record<string, string | number | boolean | null>;
  }> | null;
  postapplyDiagnosticCompletenessPassed?: boolean | null;
  postapplyMissingRequiredDiagnosticFields?: string[] | null;
  postapplyNullRequiredDiagnosticFields?: string[] | null;
  finalRequiredFactCount?: number | null;
  finalCoveredFactCount?: number | null;
  finalUncoveredFactIdentityHashes?: string[] | null;
  finalRequiredFactSetHash?: string | null;
  finalFactCoveragePassed?: boolean | null;
  visibleRequiredFactCount?: number | null;
  visibleCoveredFactCount?: number | null;
  visibleUncoveredFactIdentityHashes?: string[] | null;
  visibleFactCoveragePassed?: boolean | null;
  visibleRequiredFactSetHash?: string | null;
  visiblePredicateValidationApplicable?: boolean | null;
  visibleRequiredPredicateCount?: number | null;
  visibleCoveredPredicateCount?: number | null;
  visibleMissingPredicateIdentityHashes?: string[] | null;
  visiblePredicateCoveragePassed?: boolean | null;
  visibleNormalizedHash?: string | null;
  visibleLocaleValidationPassed?: boolean | null;
  visibleTenseValidationPassed?: boolean | null;
  visiblePerspectiveValidationPassed?: boolean | null;
  visibleAppliedEntryIdHash?: string | null;
  experienceSelectedFinalCoverageRevision?: string | null;
  experiencePhasedDiagnosticCompletenessRevision?: string | null;
  experienceTransactionalApplyTruthRevision?: string | null;
  experienceFinalVisiblePredicateTruthRevision?: string | null;
  visibleApplyApplicable?: boolean | null;
  raceGuardApplicable?: boolean | null;
  shouldIncrementUsage?: boolean | null;
  usageIncrementAttempted?: boolean | null;
  sourceTenseMismatchCount?: number | null;
  sourceTenseValidationPassed?: boolean | null;
  expectedEmploymentTense?: string | null;
  visibleComparisonSourceKind: string | null;
  visibleComparisonHash: string | null;
  visibleComparisonNormalizedHash: string | null;
  visibleComparisonUnitCount: number;
  visibleComparisonProvenance: string | null;
  visibleComparisonMatchedLastAiOutput: boolean | null;
  visibleComparisonUsedForNoOp: boolean;
  visibleComparisonUsedForDegradationCheck: boolean;
  visibleComparisonCapturedAtRequest: boolean;
  finalMatchesVisibleComparisonAfterNormalization: boolean;
  finalSemanticallyEquivalentToVisibleComparison: boolean;
  semanticNoOpDetected: boolean;
  semanticNoOpReason: string | null;
  materialImprovementDetected: boolean;
  materialImprovementKinds: string[];
  degradationDetected: boolean;
  degradationKinds: string[];
  neutralRestyleDetected: boolean;
  finalDecisionKind: string | null;
  experienceVisibleNoopAuthorityRevision: string | null;
  experienceVisibleSnapshotWiringRevision: string | null;
  experienceSemanticNoopFinalGateRevision: string | null;
  experienceFactAuthorityConsistencyRevision: string | null;
  experienceFactAuthorityTruthRevision?: string | null;
  experienceVisibleSnapshotTruthRevision?: string | null;
  experienceInvariantPreapplyGateRevision?: string | null;
  spanishExperienceComplianceGroundingRevision: string | null;
  experiencePredicatePhaseDiagnosticsRevision: string | null;
  deterministicFallbackAttemptedAfterNoOp: boolean;
  deterministicFallbackAppliedAfterNoOp: boolean;
  finalCandidateSource: string | null;
  finalUnsupportedClaimCount: number;
  finalUnsupportedClaimKinds: string[];
  visibleTextareaMatchesFinalNormalizedHash: boolean | null;
  /** @deprecated Prefer apiResponseKind + clientDeterministicFallback* */
  fallbackSelected: boolean;
  fallbackReason: string | null;
  fallbackBulletCount: number;
  fallbackBulletScripts: ExperienceScriptClass[];
  fallbackRequiredFactCount: number;
  fallbackCoveredFactCount: number;
  apiResponseKind: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown' | 'not_attempted';
  serverFallbackUsed: boolean;
  clientDeterministicFallbackAttempted: boolean;
  clientDeterministicFallbackReason: string | null;
  clientDeterministicFallbackBulletCount: number;
  clientDeterministicFallbackScripts: ExperienceScriptClass[];
  clientDeterministicFallbackRequiredFactCount: number;
  clientDeterministicFallbackCoveredFactCount: number;
  clientDeterministicFallbackApplied: boolean;
  /** Selected as final candidate — not yet a committed write. */
  clientDeterministicFallbackSelected: boolean;
  clientDeterministicFallbackUsedForFinalCandidate: boolean;
  clientDeterministicFallbackUncoveredFactIds: string[];
  operationMode: 'generate_from_job_context' | 'enhance_existing_description' | null;
  sourceWasEmpty: boolean;
  sourceFactCount: number;
  generationContextPresent: boolean;
  generationProviderAttempted: boolean;
  generationRepairAttempted: boolean;
  generationFallbackAttempted: boolean;
  generationFallbackApplied: boolean;
  generatedBulletCount: number;
  generatedBulletScripts: ExperienceScriptClass[];
  relevanceValidationPassed: boolean | null;
  /** Alias kept alongside perspectiveValidationPassed for generation mode. */
  tenseValidationPassed: boolean;
  visibleApplySucceeded: boolean;
  finalBulletCount: number;
  finalBulletScripts: ExperienceScriptClass[];
  finalTypedFailureReason: string | null;
  rejectionStage: string | null;
  raceGuardResult: 'ok' | 'fail' | 'skipped' | 'not_required';
  countedAsSuccess: boolean;
  usageCountBefore: number;
  usageCountAfter: number;
  /** Entry / locale purity (build 271/272) — hashed IDs only. */
  clickedExperienceEntryIdHash: string | null;
  snapshotExperienceEntryIdHash: string | null;
  payloadExperienceEntryIdHash: string | null;
  selectedExperienceEntryIdHash: string | null;
  operationSnapshotExperienceEntryIdHash: string | null;
  appliedExperienceEntryIdHash: string | null;
  sourceFactsEntryIdHash: string | null;
  canonicalFactsEntryIdHash: string | null;
  fallbackFactsEntryIdHash: string | null;
  providerTargetEntryIdHash: string | null;
  fallbackTargetEntryIdHash: string | null;
  clickedEmploymentState: 'current' | 'completed' | 'unknown' | null;
  appliedEmploymentState: 'current' | 'completed' | 'unknown' | null;
  arrayIndexAtRequest: number | null;
  arrayIndexAtApply: number | null;
  stableEntryIdentityMatched: boolean | null;
  targetEntryStillExists: boolean | null;
  entryContextMatchedAtApply: boolean | null;
  targetLocale: string | null;
  targetScript: string | null;
  detectedLocaleByBullet: Array<string | null>;
  detectedScriptByBullet: string[];
  wrongLocaleBulletCount: number;
  wrongScriptBulletCount: number;
  mixedLanguageBulletCount: number;
  sourceLanguageLeakageDetected: boolean;
  targetLocalePurityPassed: boolean | null;
  crossEntryCandidateFactCount: number;
  crossEntryLeakageDetected: boolean;
  crossDomainLeakageDetected: boolean;
  leakedFromExperienceEntryIdHashes: string[];
  entryScopedCanonicalStorageUsed: boolean | null;
  responseRejectedForEntryMismatch: boolean;
  responseRejectedForLocaleImpurity: boolean;
  responseRejectedForDomainMismatch: boolean;
  stages: ExperienceAiDiagStage[];
  requestIdHash: string;
  originalRequestJobContextHash: string;
  currentJobContextHash: string | null;
  /** cv-ai-diagnostics-v2 additive */
  diagnosticContractRevision?: string;
  compiledDiagnosticMarker?: string;
  assetRevision?: string;
  internalDiagnosticsEnabled?: boolean;
  internalResetEnabled?: boolean;
  internalBuildContractUsed?: boolean | null;
  serverUrlConfigured?: boolean;
  sourceCommitShort?: string | null;
  operationKind?: 'experience';
  buildChannel?: string | null;
  diagnosticInvariantCheckPassed?: boolean;
  diagnosticInvariantFailureCount?: number;
  diagnosticInvariantFailures?: Array<{
    invariantCode: string;
    observed: Record<string, string | number | boolean | null>;
  }>;
  diagnosticCompletenessPassed?: boolean;
  missingRequiredDiagnosticFields?: string[];
  nullRequiredDiagnosticFields?: string[];
  diagnosticPayloadByteSize?: number;
  diagnosticPayloadTruncated?: boolean;
  privacyCheckPassed?: boolean;
  diagnosticPrivacyViolations?: string[];
  visibleDescriptionMatchesFinalHash?: boolean | null;
};

let latestTrace: ExperienceAiDiagnosticTrace | null = null;

export function hashRequestId(requestId: string): string {
  return fingerprintText(requestId || '');
}

export function classifyExperienceScript(text: string): ExperienceScriptClass {
  const t = (text || '').trim();
  if (!t) return 'empty';
  const scripts: ExperienceScriptClass[] = [];
  if (/[A-Za-z]/.test(t)) scripts.push('latin');
  if (/[čćžšđČĆŽŠĐ]/.test(t)) scripts.push('latin_diacritic');
  if (/\p{Script=Cyrillic}/u.test(t)) scripts.push('cyrillic');
  if (/\p{Script=Devanagari}/u.test(t)) scripts.push('devanagari');
  if (/\p{Script=Arabic}/u.test(t)) scripts.push('arabic');
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) scripts.push('cjk');
  if (scripts.length === 0) return 'other';
  if (scripts.length === 1) return scripts[0];
  if (scripts.includes('latin_diacritic') && scripts.every((s) => s === 'latin' || s === 'latin_diacritic')) {
    return 'latin_diacritic';
  }
  return 'mixed';
}

export function classifyApiHostForDiagnostics(): ExperienceApiHostClass {
  try {
    const base = getApiBaseUrl();
    if (!base) return 'same_origin';
    const u = new URL(base);
    if (u.hostname.endsWith('.vercel.app')) {
      if (u.hostname.includes('-git-')) return 'vercel_preview';
      return 'vercel_production';
    }
    if (u.protocol === 'https:') return 'custom_https';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function inferLocaleHintFromScript(
  script: ExperienceScriptClass,
  requestedLocale?: string | null,
): string | null {
  const loc = (requestedLocale || '').trim();
  const scriptTag = (() => {
    switch (script) {
      case 'devanagari': return 'devanagari';
      case 'arabic': return 'arabic';
      case 'cjk': return 'cjk';
      case 'cyrillic': return 'cyrillic';
      case 'latin_diacritic': return 'latin';
      case 'latin': return 'latin';
      default: return null;
    }
  })();
  if (loc && scriptTag) return `${loc}|${scriptTag}`;
  switch (script) {
    case 'devanagari': return 'hi';
    case 'arabic': return 'ar';
    case 'cjk': return 'ja';
    case 'cyrillic': return 'sr|ru';
    case 'latin_diacritic': return 'sr|latin';
    case 'latin': return loc ? `${loc}|latin` : null;
    default: return null;
  }
}

type SourceCandidate = {
  kind: ExperienceSelectedSourceKind;
  text: string;
};

function candidateSources(exp: WorkExperience): SourceCandidate[] {
  const recovered = (exp.recoveredSemanticDuties || [])
    .map((d) => {
      const row = d as { label?: string; text?: string; key?: string };
      return row.label || row.text || '';
    })
    .filter(Boolean)
    .join('\n');
  const candidates: SourceCandidate[] = [
    { kind: 'currentTextarea', text: (exp.description || '').trim() },
    { kind: 'description', text: (exp.description || '').trim() },
    { kind: 'originalUserDescription', text: (exp.originalUserDescription || '').trim() },
    { kind: 'canonicalDescription', text: (exp.canonicalDescription || '').trim() },
    { kind: 'generatedDescription', text: (exp.generatedDescription || '').trim() },
    { kind: 'recovered_semantic_duties', text: recovered },
    {
      kind: 'legacy_grounding',
      text: exp.groundingRecoverySource
        ? (exp.canonicalDescription || exp.description || '').trim()
        : '',
    },
  ];
  return candidates.filter((c) => c.text.length > 0);
}

/**
 * Observe which grounding source won — does not change selection logic.
 */
export function diagnoseExperienceSourceSelection(
  exp: WorkExperience,
  selectedText: string,
  groundingSource: AiGroundingResolution['groundingSource'],
  options?: {
    requestedLocale?: string | null;
    storedContentLocale?: string | null;
    contentLocale?: string | null;
    generatedLocale?: string | null;
    selectedSourceKindHint?: ExperienceSelectedSourceKind;
  },
): Pick<
  ExperienceAiDiagnosticTrace,
  | 'selectedSourceKind'
  | 'selectedSourceLocale'
  | 'selectedSourceHash'
  | 'rejectedStaleSourceKinds'
  | 'englishSourceStillAuthoritative'
  | 'staleForeignLocaleSourceAuthoritative'
  | 'selectedSourceLanguage'
  | 'selectedSourceScript'
  | 'liveTextSelected'
  | 'selectedSourceMatchesLiveNormalized'
  | 'selectedSourceDiffReason'
  | 'canonicalFormattingOnlyDifference'
  | 'operationSnapshotSourceKind'
  | 'currentTextareaIgnoredOrOverridden'
  | 'liveTextHash'
  | 'selectedSourceMatchesLiveText'
  | 'selectedSourceMateriallyDiffersFromLiveText'
  | 'selectedSourceEquivalentToLiveText'
  | 'selectedSourceContextCurrent'
> {
  const selected = (selectedText || '').trim();
  const selectedHash = fingerprintText(selected);
  const candidates = candidateSources(exp);
  const match = candidates.find((c) => fingerprintText(c.text) === selectedHash);

  let selectedSourceKind: ExperienceSelectedSourceKind =
    options?.selectedSourceKindHint || match?.kind || 'unknown';
  if (!selected) {
    selectedSourceKind = options?.selectedSourceKindHint === 'jobContext'
      ? 'jobContext'
      : 'none';
  } else if (!match && !options?.selectedSourceKindHint) {
    if (groundingSource === 'excluded_stale') selectedSourceKind = 'none';
    else if (groundingSource === 'genuine_user' || groundingSource === 'same_context_generated') {
      selectedSourceKind = 'grounding_resolution';
    }
  }

  const textarea = (exp.description || '').trim();
  const textareaHash = fingerprintText(textarea);
  const equivalentNormalized = Boolean(
    textarea && selected && experienceAiSourcesEquivalent(textarea, selected),
  );
  const selectedSourceMatchesLiveText = Boolean(
    textarea && selected && (textareaHash === selectedHash || equivalentNormalized),
  );

  // Formatting-only differences (bullets / CRLF) are NOT overrides.
  const currentTextareaIgnoredOrOverridden = Boolean(
    textarea
    && selected
    && !equivalentNormalized
    && textareaHash !== selectedHash,
  );

  const selectedScript = classifyExperienceScript(selected);
  const liveScript = classifyExperienceScript(textarea);
  const selectedLocaleDetected = detectTextLocale(selected, {
    storedLocale: options?.storedContentLocale || options?.contentLocale || null,
    generatedLocale: options?.generatedLocale || null,
  });
  const liveLocaleDetected = detectTextLocale(textarea, {
    storedLocale: options?.storedContentLocale || options?.contentLocale || null,
    generatedLocale: options?.generatedLocale || null,
  });
  // englishSourceStillAuthoritative: EN fact authority remains authoritative while
  // foreign live textarea (incl. Latin SR/HR) is ignored for fact extraction.
  // Never mark Serbian/Croatian-selected text as English authoritative.
  const selectedIsEnglishAuthority = selectedLocaleDetected === 'en'
    || (
      selectedScript === 'latin'
      && selectedLocaleDetected === 'unknown'
      && !/[čćžšđČĆŽŠĐ]/.test(selected)
      && /\b(?:checks?|works?|prepares?|coordinates?|documents?|goods|colleagues)\b/i.test(selected)
    );
  const liveIsForeignToEnglish = Boolean(
    textarea
    && liveLocaleDetected !== 'en'
    && liveLocaleDetected !== 'unknown'
  ) || (
    liveScript !== 'latin'
    && liveScript !== 'latin_diacritic'
    && liveScript !== 'empty'
    && liveScript !== 'other'
  );
  const englishSourceStillAuthoritative = Boolean(
    currentTextareaIgnoredOrOverridden
    && selected
    && selectedIsEnglishAuthority
    && liveIsForeignToEnglish,
  );
  // Foreign live AI text is NOT authoritative when we ignore it for facts.
  const staleForeignLocaleSourceAuthoritative = false;

  let selectedSourceLanguage: string | null = null;
  let selectedSourceScript: string | null = null;
  // Detect from actual selected text — never label Serbian Latin as English merely
  // because the UI/requested locale switched to en.
  const detectedFromText = selectedLocaleDetected;
  const localeForHint =
    detectedFromText !== 'unknown'
      ? detectedFromText
      : (options?.storedContentLocale || options?.contentLocale || options?.requestedLocale || null);
  const localeHint = inferLocaleHintFromScript(selectedScript, localeForHint);
  if (localeHint?.includes('|')) {
    const [lang, script] = localeHint.split('|');
    selectedSourceLanguage = lang || null;
    selectedSourceScript = script || null;
  } else if (localeHint === 'hi') {
    selectedSourceLanguage = 'hi';
    selectedSourceScript = 'devanagari';
  } else if (selectedScript === 'latin_diacritic') {
    selectedSourceLanguage =
      detectedFromText !== 'unknown'
        ? detectedFromText
        : (options?.storedContentLocale || options?.requestedLocale || 'sr');
    selectedSourceScript = 'latin';
  } else if (selectedScript === 'latin') {
    selectedSourceLanguage =
      detectedFromText !== 'unknown'
        ? detectedFromText
        : (options?.storedContentLocale || options?.requestedLocale || null);
    selectedSourceScript = 'latin';
  }

  const canonical = (exp.canonicalDescription || '').trim();
  const canonicalFormattingOnlyDifference = Boolean(
    textarea
    && canonical
    && experienceAiSourcesEquivalent(textarea, canonical)
    && textarea !== canonical,
  );

  let selectedSourceDiffReason: string | null = null;
  if (!textarea) selectedSourceDiffReason = 'live_empty';
  else if (equivalentNormalized && textareaHash !== selectedHash) {
    selectedSourceDiffReason = 'canonical_formatting_only';
  } else if (currentTextareaIgnoredOrOverridden) {
    selectedSourceDiffReason = englishSourceStillAuthoritative
      ? 'foreign_locale_override'
      : 'material_content';
  } else {
    selectedSourceDiffReason = 'none';
  }

  // Rejected = material competitors only. Never list the winning kind, and treat
  // currentTextarea/description aliases of the same live text as selected when
  // the live textarea matches the authoritative selection.
  const rejectedStaleSourceKinds = [...new Set(
    candidates
      .filter((c) => {
        if (fingerprintText(c.text) === selectedHash) return false;
        if (experienceAiSourcesEquivalent(c.text, selected)) return false;
        if (
          selectedSourceMatchesLiveText
          && (c.kind === 'currentTextarea' || c.kind === 'description')
        ) {
          return false;
        }
        return true;
      })
      .map((c) => c.kind),
  )].filter((k) => k !== selectedSourceKind);

  return {
    selectedSourceKind,
    selectedSourceLocale: localeHint,
    selectedSourceHash: selectedHash,
    rejectedStaleSourceKinds,
    englishSourceStillAuthoritative,
    staleForeignLocaleSourceAuthoritative,
    selectedSourceLanguage,
    selectedSourceScript,
    liveTextSelected: selectedSourceKind === 'currentTextarea'
      || selectedSourceKind === 'liveUserDescription'
      || (equivalentNormalized && !currentTextareaIgnoredOrOverridden),
    selectedSourceMatchesLiveNormalized: equivalentNormalized,
    selectedSourceDiffReason,
    canonicalFormattingOnlyDifference,
    operationSnapshotSourceKind: selectedSourceKind,
    currentTextareaIgnoredOrOverridden,
    liveTextHash: textarea ? textareaHash : 'empty',
    selectedSourceMatchesLiveText,
    selectedSourceMateriallyDiffersFromLiveText: currentTextareaIgnoredOrOverridden,
    selectedSourceEquivalentToLiveText: equivalentNormalized || selectedSourceMatchesLiveText,
    selectedSourceContextCurrent: groundingSource !== 'excluded_stale',
  };
}

function scriptsFromBullets(text: string): ExperienceScriptClass[] {
  return splitExperienceBullets(text || '')
    .map((b) => classifyExperienceScript(b));
}

function countDuplicateBullets(text: string): number {
  const norms = splitExperienceBullets(text || '')
    .map((b) => b.toLowerCase().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return Math.max(0, norms.length - new Set(norms).size);
}

export type ExperienceAiDiagSessionInput = {
  uiLocale: string;
  requestedLocale: string;
  contentLocale?: string | null;
  templateId: string;
  gender?: string;
  industryNorm?: string;
  levelNorm?: string;
  jobContextHash: string;
  requestId: string;
  usageCountBefore: number;
};

/**
 * Mutable session that records stages for one Experience AI button press.
 * Call `commit()` to persist (survives navigation / restart until next attempt).
 */
export class ExperienceAiDiagnosticSession {
  private stages: ExperienceAiDiagStage[] = [];
  private committedTrace: ExperienceAiDiagnosticTrace | null = null;
  private draft: Partial<ExperienceAiDiagnosticTrace> & {
    schemaVersion: typeof EXPERIENCE_AI_TRACE_SCHEMA_VERSION;
    capturedAt: string;
    requestIdHash: string;
    originalRequestJobContextHash: string;
  };

  constructor(input: ExperienceAiDiagSessionInput) {
    const requestIdHash = hashRequestId(input.requestId);
    this.draft = {
      schemaVersion: EXPERIENCE_AI_TRACE_SCHEMA_VERSION,
      marker: EXPERIENCE_AI_DIAG_MARKER,
      capturedAt: new Date().toISOString(),
      appVersionCode: null,
      appVersionName: null,
      nextBuildId: resolveNextBuildId(),
      responseDiagnosticMetadataVersion: EXPERIENCE_AI_TRACE_SCHEMA_VERSION,
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
      contentLocale: input.contentLocale ?? null,
      templateId: input.templateId || '',
      employmentState: 'current',
      selectedGender: String(input.gender || ''),
      sourceDescriptionPresent: false,
      sourceDescriptionLength: 0,
      sourceDescriptionHash: 'empty',
      sourceScript: 'empty',
      sourceUnitCount: 0,
      sourceUnitLengths: [],
      sourceUnitHashes: [],
      sourceFactIdentityCount: 0,
      selectedSourceKind: 'unknown',
      selectedSourceLocale: null,
      selectedSourceHash: 'empty',
      rejectedStaleSourceKinds: [],
      selectedSourceActuallyRejected: false,
      detectedSourceLocale: null,
      storedSourceLocale: null,
      requestedTargetLocale: null,
      crossLocaleOperation: false,
      translationProviderAttempted: false,
      translationRepairAttempted: false,
      translationFallbackAttempted: false,
      translationFallbackApplied: false,
      translationFallbackSelected: false,
      translatedFactCount: null,
      authoritativeFactSourceLocale: null,
      visibleTextareaLocale: null,
      visibleTextareaLocaleBeforeApply: null,
      entryGeneratedLocaleBeforeApply: null,
      contentLocaleDocument: null,
      appliedVisibleContentLocale: null,
      targetLocaleValidationPassed: null,
      sourcePerspectiveMode: null,
      targetPerspectiveMode: null,
      targetContentApplied: false,
      contentLocaleUpdatedAfterApply: false,
      providerCoverageCount: null,
      fallbackCoverageCount: null,
      englishSourceStillAuthoritative: false,
      staleForeignLocaleSourceAuthoritative: false,
      selectedSourceLanguage: null,
      selectedSourceScript: null,
      liveTextSelected: false,
      selectedSourceMatchesLiveNormalized: false,
      selectedSourceDiffReason: null,
      canonicalFormattingOnlyDifference: false,
      operationSnapshotSourceKind: null,
      currentTextareaIgnoredOrOverridden: false,
      liveTextHash: 'empty',
      selectedSourceMatchesLiveText: false,
      selectedSourceMateriallyDiffersFromLiveText: false,
      selectedSourceEquivalentToLiveText: false,
      selectedSourceContextCurrent: true,
      payloadLocale: input.requestedLocale,
      payloadIndustryNorm: input.industryNorm || '',
      payloadLevelNorm: input.levelNorm || '',
      payloadEmploymentState: 'current',
      payloadSourceDescriptionLength: 0,
      payloadSourceDescriptionHash: 'empty',
      payloadSourceScript: 'empty',
      payloadSourceDutyCount: 0,
      payloadJobContextHash: input.jobContextHash,
      factLockEnabled: false,
      factLockReason: null,
      generationSourceKind: null,
      generatedDescriptionPreexisted: false,
      staleGeneratedDescriptionIgnored: false,
      currentTextareaProvenance: null,
      authoritativeFactSourceKind: null,
      currentTextareaUsedForFactExtraction: null,
      lastAiOutputHashMatched: null,
      materialUserEditDetected: null,
      generationProviderValidationPassed: null,
      generationProviderRejectionReason: null,
      generationFinalPostconditionPassed: null,
      generationFallbackBuilderKind: null,
      generationFallbackFailureReason: null,
      apiHostClass: classifyApiHostForDiagnostics(),
      providerHttpStatus: null,
      providerResponseKind: 'unknown',
      providerBulletCount: 0,
      providerBulletScripts: [],
      providerLocaleValidationReason: null,
      requiredFactCount: 0,
      coveredFactCount: 0,
      uncoveredFactIdentityHashes: [],
      unsupportedClaimCount: 0,
      duplicateBulletCount: 0,
      tenseMode: 'unknown',
      perspectiveMode: null,
      sourcePersonMode: null,
      providerPersonMode: null,
      normalizedPersonMode: null,
      finalPersonMode: null,
      perspectiveNormalizationAttempted: false,
      perspectiveNormalizationApplied: false,
      perspectiveValidationPassed: false,
      normalizedBulletsUsedForApply: false,
      finalMatchesProviderOutput: false,
      finalMatchesSourceAfterNormalization: false,
      meaningfulChangeDetected: false,
      noOpRejected: false,
      providerNoOpDetected: false,
      noOpRepairAttempted: false,
      noOpRepairHttpStatus: null,
      noOpRepairValidationPassed: null,
      noOpRepairMeaningfulChangeDetected: null,
      noOpRepairApplied: false,
      noOpRepairUnsupportedClaimCount: 0,
      noOpRepairUnsupportedClaimKinds: [],
      noOpRepairScopeExpansionDetected: false,
      noOpRepairUniversalQuantifierDetected: false,
      noOpRepairResponsibilityEscalationDetected: false,
      noOpRepairRejectionReason: null,
      unsupportedClaimRepairAttempted: false,
      unsupportedClaimRepairKind: null,
      unsupportedClaimRepairValidationPassed: null,
      unsupportedClaimRepairApplied: false,
      unsupportedClaimRepairRejectionReason: null,
      unsupportedClaimRepairUnsupportedClaimCount: 0,
      unsupportedClaimRepairUnsupportedClaimKinds: [],
      unsupportedClaimRepairResidualUnsupportedClaimCount: 0,
      unsupportedClaimRepairResidualUnsupportedClaimKinds: [],
      unsupportedClaimRepairCoverageRequiredCount: null,
      unsupportedClaimRepairCoverageCoveredCount: null,
      unsupportedClaimRepairUncoveredFactIdentityHashes: [],
      unsupportedClaimRepairHash: null,
      unsupportedClaimRepairNormalizedHash: null,
      experienceRepairLineageRevision: null,
      spanishExperienceRepairGroundingRevision: null,
      experiencePredicateRepairLineageRevision: null,
      spanishExperiencePredicateGroundingRevision: null,
      sourcePredicateIdentityCount: 0,
      candidatePredicateIdentityCount: 0,
      candidateAddedPredicateCount: 0,
      candidateAddedPredicateIdentityHashes: [],
      unsupportedPredicateKindCount: 0,
      coordinatedPredicateExpansionDetected: false,
      sourceUnitPredicateCoveragePassed: null,
      repairResidualAddedPredicateCount: 0,
      repairResidualAddedPredicateIdentityHashes: [],
      providerSourcePredicateIdentityCount: 0,
      providerCandidatePredicateIdentityCount: 0,
      providerCandidateAddedPredicateCount: 0,
      providerCandidateAddedPredicateIdentityHashes: [],
      providerCoordinatedPredicateExpansionDetected: false,
      providerSourceUnitPredicateCoveragePassed: null,
      repairCandidatePredicateIdentityCount: 0,
      repairCoordinatedPredicateExpansionDetected: false,
      repairSourceUnitPredicateCoveragePassed: null,
      finalCandidatePredicateIdentityCount: 0,
      finalAddedPredicateCount: 0,
      finalAddedPredicateIdentityHashes: [],
      finalCoordinatedPredicateExpansionDetected: false,
      finalSourceUnitPredicateCoveragePassed: null,
      providerComplianceScopeExpansionDetected: false,
      providerComplianceExpansionKindCount: 0,
      repairResidualComplianceScopeExpansionDetected: false,
      finalComplianceScopeExpansionDetected: false,
      factAuthorityKind: null,
      factAuthorityHash: null,
      factAuthorityNormalizedHash: null,
      factAuthorityUnitCount: 0,
      factAuthorityMatchesAuthoritativeSourceKind: false,
      visibleComparisonSourceKind: null,
      visibleComparisonHash: null,
      visibleComparisonNormalizedHash: null,
      visibleComparisonUnitCount: 0,
      visibleComparisonProvenance: null,
      visibleComparisonMatchedLastAiOutput: false,
      visibleComparisonUsedForNoOp: false,
      visibleComparisonUsedForDegradationCheck: false,
      visibleComparisonCapturedAtRequest: false,
      finalMatchesVisibleComparisonAfterNormalization: false,
      finalSemanticallyEquivalentToVisibleComparison: false,
      semanticNoOpDetected: false,
      semanticNoOpReason: null,
      materialImprovementDetected: false,
      materialImprovementKinds: [],
      degradationDetected: false,
      degradationKinds: [],
      neutralRestyleDetected: false,
      finalDecisionKind: null,
      experienceVisibleNoopAuthorityRevision: null,
      experienceVisibleSnapshotWiringRevision: null,
      experienceSemanticNoopFinalGateRevision: null,
      experienceFactAuthorityConsistencyRevision: null,
      spanishExperienceComplianceGroundingRevision: null,
      experiencePredicatePhaseDiagnosticsRevision: null,
      deterministicFallbackAttemptedAfterNoOp: false,
      deterministicFallbackAppliedAfterNoOp: false,
      finalCandidateSource: null,
      finalUnsupportedClaimCount: 0,
      finalUnsupportedClaimKinds: [],
      visibleTextareaMatchesFinalNormalizedHash: null,
      fallbackSelected: false,
      fallbackReason: null,
      fallbackBulletCount: 0,
      fallbackBulletScripts: [],
      fallbackRequiredFactCount: 0,
      fallbackCoveredFactCount: 0,
      apiResponseKind: 'unknown',
      serverFallbackUsed: false,
      clientDeterministicFallbackAttempted: false,
      clientDeterministicFallbackReason: null,
      clientDeterministicFallbackBulletCount: 0,
      clientDeterministicFallbackScripts: [],
      clientDeterministicFallbackRequiredFactCount: 0,
      clientDeterministicFallbackCoveredFactCount: 0,
      clientDeterministicFallbackApplied: false,
      clientDeterministicFallbackSelected: false,
      clientDeterministicFallbackUsedForFinalCandidate: false,
      clientDeterministicFallbackUncoveredFactIds: [],
      operationMode: null,
      sourceWasEmpty: false,
      sourceFactCount: 0,
      generationContextPresent: false,
      generationProviderAttempted: false,
      generationRepairAttempted: false,
      generationFallbackAttempted: false,
      generationFallbackApplied: false,
      generatedBulletCount: 0,
      generatedBulletScripts: [],
      relevanceValidationPassed: false,
      tenseValidationPassed: false,
      visibleApplySucceeded: false,
      finalBulletCount: 0,
      finalBulletScripts: [],
      finalTypedFailureReason: null,
      rejectionStage: null,
      raceGuardResult: 'skipped',
      countedAsSuccess: false,
      usageCountBefore: input.usageCountBefore,
      usageCountAfter: input.usageCountBefore,
      clickedExperienceEntryIdHash: null,
      snapshotExperienceEntryIdHash: null,
      payloadExperienceEntryIdHash: null,
      selectedExperienceEntryIdHash: null,
      operationSnapshotExperienceEntryIdHash: null,
      appliedExperienceEntryIdHash: null,
      sourceFactsEntryIdHash: null,
      canonicalFactsEntryIdHash: null,
      fallbackFactsEntryIdHash: null,
      providerTargetEntryIdHash: null,
      fallbackTargetEntryIdHash: null,
      clickedEmploymentState: null,
      appliedEmploymentState: null,
      arrayIndexAtRequest: null,
      arrayIndexAtApply: null,
      stableEntryIdentityMatched: null,
      targetEntryStillExists: null,
      entryContextMatchedAtApply: null,
      targetLocale: null,
      targetScript: null,
      detectedLocaleByBullet: [],
      detectedScriptByBullet: [],
      wrongLocaleBulletCount: 0,
      wrongScriptBulletCount: 0,
      mixedLanguageBulletCount: 0,
      sourceLanguageLeakageDetected: false,
      targetLocalePurityPassed: null,
      crossEntryCandidateFactCount: 0,
      crossEntryLeakageDetected: false,
      crossDomainLeakageDetected: false,
      leakedFromExperienceEntryIdHashes: [],
      entryScopedCanonicalStorageUsed: null,
      responseRejectedForEntryMismatch: false,
      responseRejectedForLocaleImpurity: false,
      responseRejectedForDomainMismatch: false,
      requestIdHash,
      originalRequestJobContextHash: input.jobContextHash,
      currentJobContextHash: input.jobContextHash,
    };
  }

  stage(
    name: ExperienceAiDiagStageName,
    result: ExperienceAiDiagStageResult,
    typedReason?: string,
    hashes?: { requestIdHash?: string; currentJobContextHash?: string },
  ): void {
    this.stages.push({
      stage: name,
      result,
      typedReason,
      requestIdHash: hashes?.requestIdHash || this.draft.requestIdHash,
      currentJobContextHash: hashes?.currentJobContextHash
        || this.draft.currentJobContextHash
        || undefined,
      originalRequestJobContextHash: this.draft.originalRequestJobContextHash,
    });
    // Keep the earliest typed rejection (do not overwrite with later not_applied).
    if (result === 'fail' && typedReason && !this.draft.finalTypedFailureReason) {
      this.draft.finalTypedFailureReason = typedReason;
      this.draft.rejectionStage = name;
    } else if (result === 'fail' && typedReason && !this.draft.rejectionStage) {
      this.draft.rejectionStage = name;
    }
  }

  patch(partial: Partial<ExperienceAiDiagnosticTrace>): void {
    const { marker: _ignoredMarker, ...safe } = partial;
    Object.assign(this.draft, safe);
    const markerPatch = sanitizeCvAiDiagnosticMarkerPatch('experience', partial);
    if (markerPatch.marker) this.draft.marker = markerPatch.marker;
    // Stable Experience marker is local-owned; never accept empty/foreign markers.
    if (!this.draft.marker || this.draft.marker !== EXPERIENCE_AI_DIAG_MARKER) {
      this.draft.marker = EXPERIENCE_AI_DIAG_MARKER;
    }
  }

  recordLiveExperience(_exp: WorkExperience, isPresent: boolean): void {
    const entryHash = hashExperienceEntryId(_exp?.id);
    const employmentState = isPresent ? 'current' as const : 'completed' as const;
    this.patch({
      employmentState,
      tenseMode: isPresent ? 'present' : 'past',
      payloadEmploymentState: employmentState,
      clickedEmploymentState: employmentState,
      clickedExperienceEntryIdHash: entryHash,
      snapshotExperienceEntryIdHash: entryHash,
      payloadExperienceEntryIdHash: entryHash,
      selectedExperienceEntryIdHash: entryHash,
      sourceFactsEntryIdHash: entryHash,
      providerTargetEntryIdHash: entryHash,
      fallbackTargetEntryIdHash: entryHash,
    });
    this.stage('live_experience_read', 'ok');
  }

  recordExperienceEntryTarget(opts: {
    experienceEntryId: string;
    isPresent: boolean;
    arrayIndexAtRequest?: number | null;
  }): void {
    const entryHash = hashExperienceEntryId(opts.experienceEntryId);
    const employmentState = opts.isPresent ? 'current' as const : 'completed' as const;
    this.patch({
      clickedExperienceEntryIdHash: entryHash,
      snapshotExperienceEntryIdHash: entryHash,
      payloadExperienceEntryIdHash: entryHash,
      selectedExperienceEntryIdHash: entryHash,
      sourceFactsEntryIdHash: entryHash,
      canonicalFactsEntryIdHash: entryHash,
      fallbackFactsEntryIdHash: entryHash,
      providerTargetEntryIdHash: entryHash,
      fallbackTargetEntryIdHash: entryHash,
      operationSnapshotExperienceEntryIdHash: entryHash,
      clickedEmploymentState: employmentState,
      payloadEmploymentState: employmentState,
      employmentState,
      tenseMode: opts.isPresent ? 'present' : 'past',
      arrayIndexAtRequest: opts.arrayIndexAtRequest ?? this.draft.arrayIndexAtRequest,
    });
  }

  recordSourceSelection(
    exp: WorkExperience,
    grounding: AiGroundingResolution,
    options?: {
      requestedLocale?: string | null;
      selectedSourceKindHint?: ExperienceSelectedSourceKind;
      operationalContentLocale?: string | null;
      generationSourceKind?: ExperienceAiDiagnosticTrace['generationSourceKind'];
      generatedDescriptionPreexisted?: boolean;
      staleGeneratedDescriptionIgnored?: boolean;
      factLockReason?: string | null;
      currentTextareaProvenance?: string | null;
      authoritativeFactSourceKind?: string | null;
      currentTextareaUsedForFactExtraction?: boolean | null;
      lastAiOutputHashMatched?: boolean | null;
      materialUserEditDetected?: boolean | null;
    },
  ): void {
    const selected = (grounding.sourceDescription || '').trim();
    const units = extractSourceDutyUnits(selected);
    const identities = sourceFactIdentitiesFromDescription(selected);
    const generationMode = options?.selectedSourceKindHint === 'jobContext'
      || options?.generationSourceKind === 'jobContext'
      || !selected;
    const selection = diagnoseExperienceSourceSelection(
      exp,
      selected,
      grounding.groundingSource,
      {
        requestedLocale: options?.requestedLocale || this.draft.requestedLocale,
        storedContentLocale: options?.operationalContentLocale || this.draft.contentLocale,
        contentLocale: this.draft.contentLocale,
        generatedLocale: (exp as WorkExperience & { generatedLocale?: string }).generatedLocale || null,
        selectedSourceKindHint: options?.selectedSourceKindHint,
      },
    );
    const rejectedStale: ExperienceSelectedSourceKind[] = [
      ...(selection.rejectedStaleSourceKinds || []),
    ];
    if (options?.staleGeneratedDescriptionIgnored) {
      if (!rejectedStale.includes('generatedDescription')) rejectedStale.push('generatedDescription');
      if (!rejectedStale.includes('canonicalDescription')) rejectedStale.push('canonicalDescription');
    }
    this.patch({
      sourceDescriptionPresent: Boolean(selected),
      sourceDescriptionLength: selected.length,
      sourceDescriptionHash: fingerprintText(selected),
      sourceScript: classifyExperienceScript(selected),
      sourceUnitCount: units.length,
      sourceUnitLengths: units.map((u) => u.length),
      sourceUnitHashes: units.map((u) => fingerprintText(u)),
      sourceFactIdentityCount: identities.length,
      requiredFactCount: identities.length,
      sourceFactCount: identities.length,
      ...selection,
      operationSnapshotSourceKind: generationMode && !selected
        ? (options?.selectedSourceKindHint === 'jobContext' ? 'jobContext' : 'none')
        : selection.operationSnapshotSourceKind,
      rejectedStaleSourceKinds: rejectedStale,
      selectedSourceActuallyRejected: rejectedStale.includes(selection.selectedSourceKind),
      detectedSourceLocale: selection.selectedSourceLanguage,
      storedSourceLocale: options?.operationalContentLocale || this.draft.contentLocale || null,
      requestedTargetLocale: options?.requestedLocale || this.draft.requestedLocale || null,
      crossLocaleOperation: Boolean(
        selection.selectedSourceLanguage
        && (options?.requestedLocale || this.draft.requestedLocale)
        && selection.selectedSourceLanguage
          !== (options?.requestedLocale || this.draft.requestedLocale),
      ),
      factLockEnabled: Boolean(selected),
      factLockReason: options?.factLockReason
        ?? (selected ? 'non_empty_source' : 'generation_mode_empty_live'),
      generationSourceKind: options?.generationSourceKind
        ?? (selected ? 'liveSource' : 'jobContext'),
      generatedDescriptionPreexisted: Boolean(options?.generatedDescriptionPreexisted),
      staleGeneratedDescriptionIgnored: Boolean(options?.staleGeneratedDescriptionIgnored),
      currentTextareaProvenance: options?.currentTextareaProvenance ?? null,
      authoritativeFactSourceKind: options?.authoritativeFactSourceKind
        ? (normalizeExperienceFactAuthorityKind(options.authoritativeFactSourceKind)
          || options.authoritativeFactSourceKind)
        : null,
      currentTextareaUsedForFactExtraction:
        options?.currentTextareaUsedForFactExtraction ?? null,
      lastAiOutputHashMatched: options?.lastAiOutputHashMatched ?? null,
      materialUserEditDetected: options?.materialUserEditDetected ?? null,
      // AAB-327 — request-time visible comparison snapshot (immutable).
      visibleComparisonProvenance: options?.currentTextareaProvenance ?? undefined,
      visibleComparisonMatchedLastAiOutput:
        typeof options?.lastAiOutputHashMatched === 'boolean'
          ? options.lastAiOutputHashMatched
          : undefined,
      experienceFactAuthorityTruthRevision: EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION,
      experienceVisibleSnapshotTruthRevision: EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION,
      payloadSourceDescriptionLength: selected.length,
      payloadSourceDescriptionHash: fingerprintText(selected),
      payloadSourceScript: classifyExperienceScript(selected),
      payloadSourceDutyCount: units.length,
      sourceWasEmpty: !selected,
      operationMode: selected ? 'enhance_existing_description' : 'generate_from_job_context',
      generationContextPresent: !selected,
      ...(options?.operationalContentLocale
        ? { contentLocale: options.operationalContentLocale }
        : {}),
    });
    this.stage(
      'source_description_selected',
      selected || generationMode || grounding.groundingSource === 'excluded_stale' ? 'ok' : 'fail',
      selected
        ? undefined
        : (generationMode
          ? 'generation_job_context'
          : (grounding.groundingSource === 'excluded_stale' ? 'excluded_stale' : 'no_source')),
    );
    this.stage(
      'source_units_split',
      units.length > 0 ? 'ok' : (selected ? 'fail' : 'skipped'),
      units.length > 0 ? undefined : 'zero_units',
    );
    this.stage(
      'source_fact_identity_created',
      identities.length > 0 ? 'ok' : (selected ? 'fail' : 'skipped'),
      identities.length > 0 ? undefined : 'zero_identities',
    );
  }

  recordPayloadBuilt(opts: {
    locale: string;
    industryNorm: string;
    levelNorm: string;
    isPresent: boolean;
  }): void {
    this.patch({
      payloadLocale: opts.locale,
      payloadIndustryNorm: opts.industryNorm,
      payloadLevelNorm: opts.levelNorm,
      payloadEmploymentState: opts.isPresent ? 'current' : 'completed',
    });
    this.stage('job_context_built', 'ok');
    this.stage('request_payload_built', 'ok');
    this.stage('request_started', 'ok');
  }

  recordApiResponse(opts: {
    httpStatus: number | null;
    repairAttempted?: boolean;
    fallbackUsed?: boolean;
    resultText?: string;
    errorCode?: string;
  }): void {
    const text = (opts.resultText || '').trim();
    let kind: ExperienceAiDiagnosticTrace['providerResponseKind'] = 'unknown';
    if (opts.errorCode || (opts.httpStatus != null && opts.httpStatus >= 400)) kind = 'error';
    else if (opts.fallbackUsed) kind = 'fallback';
    else if (opts.repairAttempted) kind = 'repair';
    else if (!text) kind = 'empty';
    else kind = 'provider';

    this.patch({
      providerHttpStatus: opts.httpStatus,
      providerAttempted: opts.httpStatus != null,
      providerResponseKind: kind,
      apiResponseKind: kind,
      serverFallbackUsed: kind === 'fallback',
      providerBulletCount: splitExperienceBullets(text).filter(Boolean).length,
      providerBulletScripts: scriptsFromBullets(text),
      duplicateBulletCount: countDuplicateBullets(text),
    });
    this.stage(
      'api_response_received',
      kind === 'error' ? 'fail' : 'ok',
      opts.errorCode || (kind === 'error' ? 'http_error' : undefined),
    );
    this.stage(
      'provider_output_parsed',
      kind === 'error' ? 'fail' : 'ok',
      text ? undefined : (kind === 'empty' ? 'empty_result' : undefined),
    );
  }

  recordRaceCheck(ok: boolean, reason?: string, currentJobContextHash?: string): void {
    this.patch({
      raceGuardResult: ok ? 'ok' : 'fail',
      currentJobContextHash: currentJobContextHash || this.draft.currentJobContextHash,
    });
    this.stage(
      'race_context_check',
      ok ? 'ok' : 'fail',
      ok ? undefined : (reason || 'stale_request_or_context_mismatch'),
      { currentJobContextHash },
    );
  }

  /**
   * Dedicated clean no-op terminalizer for early unedited-rerun preflight.
   * Must not reuse rejected-apply / failure stage semantics.
   */
  recordCleanNoOpTerminal(finalized: FinalizeCvAiFieldResult): void {
    void EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION;
    void EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION;
    void EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION;
    void EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION;
    const diag = (finalized.diagnostics || {}) as Record<string, unknown>;
    const clean = buildExperienceCleanNoOpTerminalFields({
      decisionKind: (diag.finalDecisionKind === 'exact_noop' ? 'exact_noop' : 'semantic_noop'),
      semanticNoOpReason: typeof diag.semanticNoOpReason === 'string'
        ? diag.semanticNoOpReason
        : 'unedited_ai_output_already_valid',
      visibleSourceAlreadyValid: true,
      visibleComparisonHash: (diag.visibleComparisonHash as string | null | undefined) ?? null,
      visibleComparisonNormalizedHash:
        (diag.visibleComparisonNormalizedHash as string | null | undefined) ?? null,
      visibleComparisonUnitCount: Number(diag.visibleComparisonUnitCount ?? 0),
    });
    // Preserve dual-source / preflight truth from finalize, then force clean terminal fields.
    this.patch({
      ...diag,
      ...clean,
      finalTypedFailureReason: null,
      rejectionStage: null,
      typedFailureReason: null,
      providerNoOpDetected: false,
      providerAttempted: false,
      providerHttpStatus: null,
      providerResponseKind: 'not_attempted',
      apiResponseKind: 'not_attempted',
      providerCoveredFactCount: null,
      providerRequiredFactCount: null,
      providerRejectionReasons: [],
      providerRejectionStage: null,
      providerAccepted: false,
      providerBulletCount: 0,
      providerBulletScripts: [],
      finalBulletCount: 0,
      finalBulletScripts: [],
      finalCandidatePresent: false,
      finalCandidateSource: 'none',
      finalCandidateBulletCount: 0,
      finalCandidateBulletScripts: [],
      appliedFinalBulletCount: 0,
      appliedFinalBulletScripts: [],
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      shouldIncrementUsage: false,
      usageIncrementAttempted: false,
      applyAttempted: false,
      raceGuardApplicable: false,
      raceGuardResult: 'not_required',
      usageCountAfter: this.draft.usageCountBefore,
      relevanceValidationPassed: null,
      perspectiveValidationPassed: null,
      // Visible-source preflight proved tense/locale validity.
      tenseValidationPassed: true,
      localeValidationPassed: true,
      candidateLineage: clean.candidateLineage as ExperienceAiDiagnosticTrace['candidateLineage'],
      experienceCleanNoopTerminalOutcomeRevision:
        EXPERIENCE_CLEAN_NOOP_TERMINAL_OUTCOME_318_REVISION,
      experiencePreflightBuildMetadataRevision:
        EXPERIENCE_PREFLIGHT_BUILD_METADATA_318_REVISION,
      experienceProviderNotAttemptedTruthRevision:
        EXPERIENCE_PROVIDER_NOT_ATTEMPTED_TRUTH_318_REVISION,
      experienceTerminalDiagnosticConsistencyRevision:
        EXPERIENCE_TERMINAL_DIAGNOSTIC_CONSISTENCY_318_REVISION,
    } as unknown as Partial<ExperienceAiDiagnosticTrace>);

    for (const step of EXPERIENCE_CLEAN_NOOP_STAGE_PLAN) {
      this.stage(
        step.stage as ExperienceAiDiagStageName,
        step.result,
        step.typedReason,
      );
    }
  }

  /**
   * Map finalize result into validation / fallback / apply stages without
   * re-running validators (uses finalize diagnostics + reason only).
   */
  recordFinalizeResult(finalized: FinalizeCvAiFieldResult): void {
    const diag = finalized.diagnostics || {};
    const diagRec = diag as Record<string, unknown>;
    const earlyCleanNoOp = diagRec.earlyNoOpPreflightPassed === true
      || (
        finalized.reason === 'experience_ai_noop'
        && finalized.blocked !== true
        && finalized.countedAsSuccess !== true
        && diagRec.providerAttempted === false
      );
    if (earlyCleanNoOp) {
      this.recordCleanNoOpTerminal(finalized);
      return;
    }
    const text = (finalized.text || '').trim();
    const bullets = splitExperienceBullets(text).filter(Boolean);
    const clientFallbackSelected = Boolean(
      diag.clientDeterministicFallbackSelected
      || (diag as Record<string, unknown>).clientDeterministicFallbackUsedForFinalCandidate
      || diag.clientDeterministicFallbackApplied
      || (finalized.origin === 'deterministic_fallback' && Boolean(text)),
    );
    // Backward-compatible alias used for coverage lineage below.
    const clientFallbackApplied = clientFallbackSelected;
    const clientFallbackAttempted = Boolean(
      diag.clientDeterministicFallbackAttempted
      || clientFallbackSelected
      || diag.fallbackApplied,
    );
    // Clean no-op already returned — do not treat !countedAsSuccess as blocked failure.
    const blocked = Boolean(finalized.blocked || !finalized.countedAsSuccess);
    const reason = finalized.reason || diag.typedFailureReason || null;
    const apiResponseKind = diag.apiResponseKind || this.draft.providerResponseKind || 'unknown';
    const serverFallbackUsed = Boolean(
      diag.serverFallbackUsed
      || this.draft.providerResponseKind === 'fallback',
    );

    const clientScripts = (
      (diag.clientDeterministicFallbackScripts as ExperienceScriptClass[] | undefined)?.length
        ? (diag.clientDeterministicFallbackScripts as ExperienceScriptClass[])
        : (clientFallbackApplied ? scriptsFromBullets(text) : [])
    );
    const clientBulletCount = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackBulletCount ?? diag.fallbackBulletCount ?? 0)
      : 0;
    const clientCovered = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackCoveredFactCount ?? 0)
      : 0;
    const clientRequired = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackRequiredFactCount
        ?? diag.requiredFactCount
        ?? this.draft.requiredFactCount
        ?? 0)
      : 0;
    const clientUncovered = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackUncoveredFactIds || [])
      : [];

    const providerUncovered = Array.isArray(diag.providerUncoveredFactIdentityHashes)
      ? diag.providerUncoveredFactIdentityHashes.map(String)
      : (this.draft.providerUncoveredFactIdentityHashes || []);
    const finalRequired = clientFallbackApplied
      ? (clientRequired || diag.requiredFactCount || this.draft.requiredFactCount || 0)
      : (diag.requiredFactCount ?? this.draft.requiredFactCount ?? 0);
    const finalCovered = clientFallbackApplied
      ? (clientCovered || diag.coveredFactCount || 0)
      : (diag.coveredFactCount ?? 0);
    const finalUncovered = clientFallbackApplied
      ? (clientUncovered.length ? clientUncovered : [])
      : (
        Array.isArray(diag.uncoveredFactIdentityHashes)
          ? diag.uncoveredFactIdentityHashes.map(String)
          : (providerUncovered.length && finalCovered < finalRequired
            ? [...providerUncovered]
            : (this.draft.uncoveredFactIdentityHashes || []))
      );
    const appliedSuccess = Boolean(finalized.countedAsSuccess && !finalized.blocked);
    const appliedScripts = appliedSuccess ? scriptsFromBullets(text) : [];
    const appliedCount = appliedSuccess ? bullets.length : 0;
    const legacyFinalCount = appliedSuccess
      ? Number(diag.finalBulletCount ?? bullets.length)
      : Number(diag.finalBulletCount ?? 0);
    const legacyFinalScripts = appliedSuccess
      ? (
        Array.isArray(diag.finalBulletScripts)
        && (diag.finalBulletScripts as unknown[]).length === legacyFinalCount
          ? (diag.finalBulletScripts as ExperienceScriptClass[])
          : appliedScripts
      )
      : (
        Array.isArray(diag.finalBulletScripts)
        && Number(diag.finalBulletCount ?? 0) === (diag.finalBulletScripts as unknown[]).length
          ? (diag.finalBulletScripts as ExperienceScriptClass[])
          : []
      );
    // Top-level coverage always describes the FINAL selected candidate.
    // Provider evidence stays in provider* fields (never overwrite with final).
    this.patch({
      requiredFactCount: finalRequired,
      coveredFactCount: finalCovered,
      uncoveredFactIdentityHashes: finalUncovered,
      providerRequiredFactCount: diag.providerRequiredFactCount
        ?? this.draft.providerRequiredFactCount
        ?? null,
      providerCoveredFactCount: diag.providerCoveredFactCount
        ?? this.draft.providerCoveredFactCount
        ?? null,
      providerUncoveredFactIdentityHashes: providerUncovered,
      providerAccepted: diag.providerAccepted
        ?? (finalized.countedAsSuccess && !clientFallbackApplied && !diag.noOpRepairApplied),
      providerRejectionStage: (typeof diag.providerRejectionStage === 'string'
        && diag.providerRejectionStage)
        || (!diag.providerAccepted && (diag.rejectionStage || providerUncovered.length)
          ? (diag.rejectionStage || this.draft.providerRejectionStage || null)
          : (this.draft.providerRejectionStage ?? null)),
      providerRejectionReasons: !diag.providerAccepted && (
        reason
        || providerUncovered.length
        || (typeof diag.providerRejectionReason === 'string' && diag.providerRejectionReason)
        || (Array.isArray(diag.providerUnsupportedClaimKinds)
          && diag.providerUnsupportedClaimKinds.length > 0)
      )
        ? ([
          reason
          || diag.providerRejectionReason
          || diag.clientDeterministicFallbackReason
          || 'provider_rejected',
        ].filter(Boolean) as string[])
        : (this.draft.providerRejectionReasons || []),
      providerUnsupportedClaimCount: typeof diag.providerUnsupportedClaimCount === 'number'
        ? diag.providerUnsupportedClaimCount
        : (this.draft.providerUnsupportedClaimCount ?? null),
      providerUnsupportedClaimKinds: Array.isArray(diag.providerUnsupportedClaimKinds)
        ? diag.providerUnsupportedClaimKinds.map(String)
        : (this.draft.providerUnsupportedClaimKinds || []),
      finalNormalizedHash: (diag.finalNormalizedHash as string | undefined)
        ?? (finalized.countedAsSuccess ? fingerprintText(text) : null),
      visibleTextareaMatchesFinalNormalizedHash:
        typeof diag.visibleTextareaMatchesFinalNormalizedHash === 'boolean'
          ? diag.visibleTextareaMatchesFinalNormalizedHash
          : (this.draft.visibleTextareaMatchesFinalNormalizedHash ?? null),
      experienceDiagnosticsFinalCandidateRevision:
        (diag.experienceDiagnosticsFinalCandidateRevision as string | undefined)
        || this.draft.experienceDiagnosticsFinalCandidateRevision
        || null,
      apiResponseKind: apiResponseKind as ExperienceAiDiagnosticTrace['apiResponseKind'],
      serverFallbackUsed,
      // Legacy fields derived from the same client-fallback result (no contradictions).
      fallbackSelected: clientFallbackApplied,
      fallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'deterministic_fallback')
        : null,
      fallbackBulletCount: clientBulletCount,
      fallbackBulletScripts: clientScripts,
      fallbackRequiredFactCount: clientRequired,
      fallbackCoveredFactCount: clientCovered,
      clientDeterministicFallbackAttempted: clientFallbackAttempted,
      clientDeterministicFallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'provider_postcondition_failed')
        : null,
      clientDeterministicFallbackBulletCount: clientBulletCount,
      clientDeterministicFallbackScripts: clientScripts,
      clientDeterministicFallbackRequiredFactCount: clientRequired,
      clientDeterministicFallbackCoveredFactCount: clientCovered,
      clientDeterministicFallbackSelected: clientFallbackSelected,
      clientDeterministicFallbackUsedForFinalCandidate: clientFallbackSelected,
      // Honor explicit Applied from finalize; cross-locale leaves it false until commit.
      clientDeterministicFallbackApplied: diag.clientDeterministicFallbackApplied === true,
      clientDeterministicFallbackUncoveredFactIds: clientUncovered,
      operationMode: (diag.operationMode as ExperienceAiDiagnosticTrace['operationMode']) || null,
      sourceWasEmpty: Boolean(diag.sourceWasEmpty),
      sourceFactCount: diag.sourceFactCount ?? this.draft.sourceFactIdentityCount ?? 0,
      generationContextPresent: Boolean(
        diag.sourceWasEmpty
        || diag.operationMode === 'generate_from_job_context',
      ),
      generationProviderAttempted: Boolean(
        diag.sourceWasEmpty && (apiResponseKind === 'provider' || apiResponseKind === 'repair' || apiResponseKind === 'fallback'),
      ),
      generationRepairAttempted: Boolean(diag.sourceWasEmpty && apiResponseKind === 'repair'),
      generationFallbackAttempted: Boolean(diag.generationFallbackAttempted),
      generationFallbackApplied: Boolean(diag.generationFallbackApplied),
      generatedBulletCount: diag.generatedBulletCount ?? (diag.sourceWasEmpty ? bullets.length : 0),
      generatedBulletScripts: diag.sourceWasEmpty ? scriptsFromBullets(text) : [],
      relevanceValidationPassed: typeof diag.relevanceValidationPassed === 'boolean'
        ? diag.relevanceValidationPassed
        : (appliedSuccess ? true : Boolean(diag.relevanceValidationPassed)),
      tenseValidationPassed: typeof diag.tenseValidationPassed === 'boolean'
        ? diag.tenseValidationPassed
        : Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
      unsupportedClaimCount: Math.max(
        diag.unsupportedClaimCount ?? 0,
        reason === 'unsupported_claim' || reason === 'unsupported_generated_duty' ? 1 : 0,
      ),
      visibleApplySucceeded: Boolean(finalized.countedAsSuccess && !blocked),
      finalBulletCount: legacyFinalCount,
      finalBulletScripts: legacyFinalScripts,
      tenseMode: diag.tenseMode || this.draft.tenseMode || 'unknown',
      perspectiveMode: (diag.perspectiveMode as ExperienceAiDiagnosticTrace['perspectiveMode']) || 'cv_third_person',
      sourcePersonMode: (diag.sourcePersonMode as string | undefined) || null,
      providerPersonMode: (diag.providerPersonMode as string | undefined) || null,
      normalizedPersonMode: (diag.normalizedPersonMode as string | undefined) || null,
      finalPersonMode: (diag.finalPersonMode as string | undefined) || null,
      perspectiveNormalizationAttempted: Boolean(diag.perspectiveNormalizationAttempted),
      perspectiveNormalizationApplied: Boolean(diag.perspectiveNormalizationApplied),
      perspectiveValidationPassed: typeof diag.perspectiveValidationPassed === 'boolean'
        ? diag.perspectiveValidationPassed
        : (appliedSuccess ? true : Boolean(diag.perspectiveValidationPassed)),
      normalizedBulletsUsedForApply: Boolean(diag.normalizedBulletsUsedForApply),
      finalMatchesProviderOutput: Boolean(diag.finalMatchesProviderOutput),
      finalMatchesSourceAfterNormalization: Boolean(diag.finalMatchesSourceAfterNormalization),
      meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      noOpRejected: Boolean(diag.noOpRejected),
      providerNoOpDetected: Boolean(
        diag.providerNoOpDetected
        || diag.noOpRejected
        || reason === 'ai_no_meaningful_change',
      ),
      noOpRepairAttempted: Boolean(diag.noOpRepairAttempted),
      noOpRepairValidationPassed: diag.noOpRepairValidationPassed ?? null,
      noOpRepairMeaningfulChangeDetected: diag.noOpRepairMeaningfulChangeDetected ?? null,
      noOpRepairApplied: Boolean(diag.noOpRepairApplied),
      noOpRepairUnsupportedClaimCount: Math.max(
        Number(diag.noOpRepairUnsupportedClaimCount ?? 0),
        Array.isArray(diag.noOpRepairUnsupportedClaimKinds)
          ? diag.noOpRepairUnsupportedClaimKinds.length
          : 0,
      ),
      noOpRepairUnsupportedClaimKinds: Array.isArray(diag.noOpRepairUnsupportedClaimKinds)
        ? diag.noOpRepairUnsupportedClaimKinds.map(String)
        : [],
      noOpRepairScopeExpansionDetected: Boolean(diag.noOpRepairScopeExpansionDetected),
      noOpRepairUniversalQuantifierDetected: Boolean(diag.noOpRepairUniversalQuantifierDetected),
      noOpRepairResponsibilityEscalationDetected: Boolean(
        diag.noOpRepairResponsibilityEscalationDetected,
      ),
      noOpRepairRejectionReason: (diag.noOpRepairRejectionReason as string | null | undefined) ?? null,
      unsupportedClaimRepairAttempted: Boolean(diag.unsupportedClaimRepairAttempted),
      unsupportedClaimRepairKind: (diag.unsupportedClaimRepairKind as string | null | undefined) ?? null,
      unsupportedClaimRepairValidationPassed: diag.unsupportedClaimRepairValidationPassed ?? null,
      unsupportedClaimRepairApplied: Boolean(diag.unsupportedClaimRepairApplied),
      unsupportedClaimRepairRejectionReason:
        (diag.unsupportedClaimRepairRejectionReason as string | null | undefined) ?? null,
      unsupportedClaimRepairUnsupportedClaimCount: Math.max(
        Number(diag.unsupportedClaimRepairUnsupportedClaimCount ?? 0),
        Array.isArray(diag.unsupportedClaimRepairUnsupportedClaimKinds)
          ? diag.unsupportedClaimRepairUnsupportedClaimKinds.length
          : 0,
      ),
      unsupportedClaimRepairUnsupportedClaimKinds: Array.isArray(
        diag.unsupportedClaimRepairUnsupportedClaimKinds,
      )
        ? diag.unsupportedClaimRepairUnsupportedClaimKinds.map(String)
        : [],
      unsupportedClaimRepairResidualUnsupportedClaimCount: Math.max(
        Number(diag.unsupportedClaimRepairResidualUnsupportedClaimCount ?? 0),
        Array.isArray(diag.unsupportedClaimRepairResidualUnsupportedClaimKinds)
          ? diag.unsupportedClaimRepairResidualUnsupportedClaimKinds.length
          : 0,
      ),
      unsupportedClaimRepairResidualUnsupportedClaimKinds: Array.isArray(
        diag.unsupportedClaimRepairResidualUnsupportedClaimKinds,
      )
        ? diag.unsupportedClaimRepairResidualUnsupportedClaimKinds.map(String)
        : [],
      unsupportedClaimRepairCoverageRequiredCount:
        diag.unsupportedClaimRepairCoverageRequiredCount ?? null,
      unsupportedClaimRepairCoverageCoveredCount:
        diag.unsupportedClaimRepairCoverageCoveredCount ?? null,
      unsupportedClaimRepairUncoveredFactIdentityHashes: Array.isArray(
        diag.unsupportedClaimRepairUncoveredFactIdentityHashes,
      )
        ? diag.unsupportedClaimRepairUncoveredFactIdentityHashes.map(String)
        : [],
      unsupportedClaimRepairHash: (diag.unsupportedClaimRepairHash as string | null | undefined) ?? null,
      unsupportedClaimRepairNormalizedHash:
        (diag.unsupportedClaimRepairNormalizedHash as string | null | undefined) ?? null,
      experienceRepairLineageRevision:
        (diag.experienceRepairLineageRevision as string | null | undefined)
        ?? EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
      spanishExperienceRepairGroundingRevision:
        (diag.spanishExperienceRepairGroundingRevision as string | null | undefined) ?? null,
      experiencePredicateRepairLineageRevision:
        (diag.experiencePredicateRepairLineageRevision as string | null | undefined)
        ?? EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
      spanishExperiencePredicateGroundingRevision:
        (diag.spanishExperiencePredicateGroundingRevision as string | null | undefined) ?? null,
      sourcePredicateIdentityCount: Number(diag.sourcePredicateIdentityCount ?? 0),
      candidatePredicateIdentityCount: Number(diag.candidatePredicateIdentityCount ?? 0),
      candidateAddedPredicateCount: Number(diag.candidateAddedPredicateCount ?? 0),
      candidateAddedPredicateIdentityHashes: Array.isArray(
        diag.candidateAddedPredicateIdentityHashes,
      )
        ? diag.candidateAddedPredicateIdentityHashes.map(String)
        : [],
      unsupportedPredicateKindCount: Number(diag.unsupportedPredicateKindCount ?? 0),
      coordinatedPredicateExpansionDetected: Boolean(
        diag.coordinatedPredicateExpansionDetected,
      ),
      sourceUnitPredicateCoveragePassed: diag.sourceUnitPredicateCoveragePassed ?? null,
      repairResidualAddedPredicateCount: Number(diag.repairResidualAddedPredicateCount ?? 0),
      repairResidualAddedPredicateIdentityHashes: Array.isArray(
        diag.repairResidualAddedPredicateIdentityHashes,
      )
        ? diag.repairResidualAddedPredicateIdentityHashes.map(String)
        : [],
      providerSourcePredicateIdentityCount: Number(
        diag.providerSourcePredicateIdentityCount ?? diag.sourcePredicateIdentityCount ?? 0,
      ),
      providerCandidatePredicateIdentityCount: Number(
        diag.providerCandidatePredicateIdentityCount
        ?? diag.candidatePredicateIdentityCount
        ?? 0,
      ),
      providerCandidateAddedPredicateCount: Number(
        diag.providerCandidateAddedPredicateCount ?? diag.candidateAddedPredicateCount ?? 0,
      ),
      providerCandidateAddedPredicateIdentityHashes: Array.isArray(
        diag.providerCandidateAddedPredicateIdentityHashes,
      )
        ? diag.providerCandidateAddedPredicateIdentityHashes.map(String)
        : (Array.isArray(diag.candidateAddedPredicateIdentityHashes)
          ? diag.candidateAddedPredicateIdentityHashes.map(String)
          : []),
      providerCoordinatedPredicateExpansionDetected: Boolean(
        diag.providerCoordinatedPredicateExpansionDetected
        ?? diag.coordinatedPredicateExpansionDetected,
      ),
      providerSourceUnitPredicateCoveragePassed:
        diag.providerSourceUnitPredicateCoveragePassed
        ?? diag.sourceUnitPredicateCoveragePassed
        ?? null,
      repairCandidatePredicateIdentityCount: Number(
        diag.repairCandidatePredicateIdentityCount ?? 0,
      ),
      repairCoordinatedPredicateExpansionDetected: Boolean(
        diag.repairCoordinatedPredicateExpansionDetected,
      ),
      repairSourceUnitPredicateCoveragePassed:
        diag.repairSourceUnitPredicateCoveragePassed ?? null,
      finalCandidatePredicateIdentityCount: Number(
        diag.finalCandidatePredicateIdentityCount
        ?? diag.candidatePredicateIdentityCount
        ?? 0,
      ),
      finalAddedPredicateCount: Number(
        diag.finalAddedPredicateCount ?? diag.candidateAddedPredicateCount ?? 0,
      ),
      finalAddedPredicateIdentityHashes: Array.isArray(diag.finalAddedPredicateIdentityHashes)
        ? diag.finalAddedPredicateIdentityHashes.map(String)
        : (Array.isArray(diag.candidateAddedPredicateIdentityHashes)
          ? diag.candidateAddedPredicateIdentityHashes.map(String)
          : []),
      finalCoordinatedPredicateExpansionDetected: Boolean(
        diag.finalCoordinatedPredicateExpansionDetected,
      ),
      finalSourceUnitPredicateCoveragePassed:
        diag.finalSourceUnitPredicateCoveragePassed
        ?? diag.sourceUnitPredicateCoveragePassed
        ?? null,
      finalRequiredFactCount: Number(
        (diagRec.finalRequiredFactCount as number | undefined)
        ?? diag.requiredFactCount
        ?? finalRequired
        ?? 0,
      ),
      finalCoveredFactCount: Number(
        (diagRec.finalCoveredFactCount as number | undefined)
        ?? diag.coveredFactCount
        ?? finalCovered
        ?? 0,
      ),
      finalUncoveredFactIdentityHashes: Array.isArray(diagRec.finalUncoveredFactIdentityHashes)
        ? (diagRec.finalUncoveredFactIdentityHashes as unknown[]).map(String)
        : (Array.isArray(finalUncovered) ? finalUncovered.map(String) : []),
      finalRequiredFactSetHash:
        (diagRec.finalRequiredFactSetHash as string | undefined) ?? null,
      finalFactCoveragePassed: typeof diagRec.finalFactCoveragePassed === 'boolean'
        ? diagRec.finalFactCoveragePassed
        : (
          Number(
            (diagRec.finalCoveredFactCount as number | undefined)
            ?? diag.coveredFactCount
            ?? finalCovered
            ?? 0,
          ) === Number(
            (diagRec.finalRequiredFactCount as number | undefined)
            ?? diag.requiredFactCount
            ?? finalRequired
            ?? 0,
          )
        ),
      experienceSelectedFinalCoverageRevision:
        (diagRec.experienceSelectedFinalCoverageRevision as string | undefined)
        ?? EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION,
      experienceFinalVisiblePredicateTruthRevision:
        EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION,
      providerComplianceScopeExpansionDetected: Boolean(
        diag.providerComplianceScopeExpansionDetected,
      ),
      providerComplianceExpansionKindCount: Number(
        diag.providerComplianceExpansionKindCount ?? 0,
      ),
      repairResidualComplianceScopeExpansionDetected: Boolean(
        diag.repairResidualComplianceScopeExpansionDetected,
      ),
      finalComplianceScopeExpansionDetected: Boolean(
        diag.finalComplianceScopeExpansionDetected,
      ),
      factAuthorityKind: (() => {
        void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
        const fromDiag = (diag.factAuthorityKind as string | null | undefined) ?? null;
        const lockedAuth = this.draft.authoritativeFactSourceKind;
        const unusedTextarea = this.draft.currentTextareaUsedForFactExtraction === false;
        if (unusedTextarea && lockedAuth) {
          const canonical = resolveCanonicalFactAuthorityKind({
            authoritativeFactSourceKind: lockedAuth,
            textareaProvenance: {
              currentTextareaProvenance:
                (this.draft.currentTextareaProvenance as ExperienceTextareaProvenanceKind)
                || 'unknown',
              authoritativeFactSourceKind: lockedAuth as ExperienceAuthoritativeFactSourceKind,
              authoritativeFactText: '',
              currentTextareaUsedForFactExtraction: false,
              currentTextareaIgnoredOrOverridden: true,
              generatedDescriptionPreexisted: Boolean(this.draft.generatedDescriptionPreexisted),
              staleGeneratedDescriptionIgnored: Boolean(this.draft.staleGeneratedDescriptionIgnored),
              lastAiOutputHashMatched: Boolean(this.draft.lastAiOutputHashMatched),
              materialUserEditDetected: Boolean(this.draft.materialUserEditDetected),
              formattingOnlyDifference: false,
              revision: 'experience-ai-output-provenance-304-v1',
            },
          });
          if (canonical && canonical !== 'current_textarea') return canonical;
        }
        if (
          unusedTextarea
          && fromDiag === 'current_textarea'
          && lockedAuth
        ) {
          return normalizeExperienceFactAuthorityKind(lockedAuth) || fromDiag;
        }
        return fromDiag;
      })(),
      factAuthorityHash: (diag.factAuthorityHash as string | null | undefined) ?? null,
      factAuthorityNormalizedHash:
        (diag.factAuthorityNormalizedHash as string | null | undefined) ?? null,
      factAuthorityUnitCount: Number(diag.factAuthorityUnitCount ?? 0),
      factAuthorityMatchesAuthoritativeSourceKind: (() => {
        void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
        const fromDiag = (diag.factAuthorityKind as string | null | undefined) ?? null;
        const lockedAuth = this.draft.authoritativeFactSourceKind;
        const unusedTextarea = this.draft.currentTextareaUsedForFactExtraction === false;
        let kind = fromDiag;
        if (unusedTextarea && lockedAuth) {
          const canonical = resolveCanonicalFactAuthorityKind({
            authoritativeFactSourceKind: lockedAuth,
            textareaProvenance: {
              currentTextareaProvenance:
                (this.draft.currentTextareaProvenance as ExperienceTextareaProvenanceKind)
                || 'unknown',
              authoritativeFactSourceKind: lockedAuth as ExperienceAuthoritativeFactSourceKind,
              authoritativeFactText: '',
              currentTextareaUsedForFactExtraction: false,
              currentTextareaIgnoredOrOverridden: true,
              generatedDescriptionPreexisted: Boolean(this.draft.generatedDescriptionPreexisted),
              staleGeneratedDescriptionIgnored: Boolean(this.draft.staleGeneratedDescriptionIgnored),
              lastAiOutputHashMatched: Boolean(this.draft.lastAiOutputHashMatched),
              materialUserEditDetected: Boolean(this.draft.materialUserEditDetected),
              formattingOnlyDifference: false,
              revision: 'experience-ai-output-provenance-304-v1',
            },
          });
          if (canonical && canonical !== 'current_textarea') kind = canonical;
          else if (fromDiag === 'current_textarea') {
            kind = normalizeExperienceFactAuthorityKind(lockedAuth) || fromDiag;
          }
        }
        const auth = lockedAuth
          ?? (typeof (diag as Record<string, unknown>).authoritativeFactSourceKind === 'string'
            ? String((diag as Record<string, unknown>).authoritativeFactSourceKind)
            : null);
        return experienceFactAuthorityKindsEquivalent(kind, auth);
      })(),
      ...(typeof (diag as Record<string, unknown>).authoritativeFactSourceKind === 'string'
        && this.draft.authoritativeFactSourceKind == null
        ? {
          authoritativeFactSourceKind:
            normalizeExperienceFactAuthorityKind(
              String((diag as Record<string, unknown>).authoritativeFactSourceKind),
            )
            || String((diag as Record<string, unknown>).authoritativeFactSourceKind),
        }
        : {}),
      ...(typeof (diag as Record<string, unknown>).currentTextareaProvenance === 'string'
        && this.draft.currentTextareaProvenance == null
        ? {
          currentTextareaProvenance:
            String((diag as Record<string, unknown>).currentTextareaProvenance),
        }
        : {}),
      ...(typeof (diag as Record<string, unknown>).lastAiOutputHashMatched === 'boolean'
        && this.draft.lastAiOutputHashMatched == null
        ? {
          lastAiOutputHashMatched:
            (diag as Record<string, unknown>).lastAiOutputHashMatched as boolean,
        }
        : {}),
      ...(typeof (diag as Record<string, unknown>).materialUserEditDetected === 'boolean'
        && this.draft.materialUserEditDetected == null
        ? {
          materialUserEditDetected:
            (diag as Record<string, unknown>).materialUserEditDetected as boolean,
        }
        : {}),
      ...(typeof (diag as Record<string, unknown>).earlyNoOpPreflightPassed === 'boolean'
        && (diag as Record<string, unknown>).earlyNoOpPreflightPassed === true
        ? {
          earlyNoOpPreflightPassed: true,
          earlyNoOpPreflightEvaluated: Boolean(
            (diag as Record<string, unknown>).earlyNoOpPreflightEvaluated,
          ),
          uneditedRerunDetected: Boolean(
            (diag as Record<string, unknown>).uneditedRerunDetected,
          ),
          providerAttempted: false,
          finalOutcomeReason:
            ((diag as Record<string, unknown>).finalOutcomeReason as string | null | undefined)
            ?? 'experience_ai_noop',
          finalCandidatePresent: false,
          finalCandidatePredicateValidationApplicable: false,
          finalCandidateBulletCount: 0,
          finalCandidateBulletScripts: [],
          appliedFinalBulletCount: 0,
          appliedFinalBulletScripts: [],
          sourceAlreadyValidForTarget:
            typeof (diag as Record<string, unknown>).sourceAlreadyValidForTarget === 'boolean'
              ? (diag as Record<string, unknown>).sourceAlreadyValidForTarget as boolean
              : null,
          authoritativeSourceAlreadyTargetLocale:
            typeof (diag as Record<string, unknown>).authoritativeSourceAlreadyTargetLocale === 'boolean'
              ? (diag as Record<string, unknown>).authoritativeSourceAlreadyTargetLocale as boolean
              : computeAuthoritativeSourceAlreadyTargetLocale({
                authoritativeSourceLocale:
                  ((diag as Record<string, unknown>).selectedSourceLocale as string | undefined)
                  || (diag.detectedSourceLocale as string | undefined)
                  || this.draft.detectedSourceLocale,
                requestedTargetLocale:
                  (diag.requestedTargetLocale as string | undefined)
                  || this.draft.requestedLocale,
              }),
          visibleTextareaAlreadyTargetLocale:
            typeof (diag as Record<string, unknown>).visibleTextareaAlreadyTargetLocale === 'boolean'
              ? (diag as Record<string, unknown>).visibleTextareaAlreadyTargetLocale as boolean
              : computeVisibleTextareaAlreadyTargetLocale({
                visibleTextareaLocale:
                  ((diag as Record<string, unknown>).currentTextareaLocale as string | undefined)
                  || ((diag as Record<string, unknown>).visibleTextareaLocale as string | undefined)
                  || this.draft.requestedLocale,
                requestedTargetLocale:
                  (diag.requestedTargetLocale as string | undefined)
                  || this.draft.requestedLocale,
              }),
          sourceAlreadyValidForTargetMeaning: legacySourceAlreadyValidForTargetMeaning(),
          experiencePhaseLocaleTruthRevision: EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION,
          experienceRejectionLineageTruthRevision: EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION,
          sourceTenseMismatchCount:
            typeof (diag as Record<string, unknown>).sourceTenseMismatchCount === 'number'
              ? (diag as Record<string, unknown>).sourceTenseMismatchCount as number
              : null,
          sourceTenseValidationPassed:
            typeof (diag as Record<string, unknown>).sourceTenseValidationPassed === 'boolean'
              ? (diag as Record<string, unknown>).sourceTenseValidationPassed as boolean
              : null,
          expectedEmploymentTense:
            ((diag as Record<string, unknown>).expectedEmploymentTense as string | null | undefined)
            ?? null,
        }
        : appliedSuccess
          ? {
            earlyNoOpPreflightPassed:
              typeof (diag as Record<string, unknown>).earlyNoOpPreflightPassed === 'boolean'
                ? (diag as Record<string, unknown>).earlyNoOpPreflightPassed as boolean
                : false,
            earlyNoOpPreflightEvaluated: Boolean(
              (diag as Record<string, unknown>).earlyNoOpPreflightEvaluated,
            ),
            providerAttempted: Boolean(
              (diag as Record<string, unknown>).providerAttempted === true
              || this.draft.providerAttempted === true
              || this.draft.providerHttpStatus != null
              || diag.providerHttpStatus != null,
            ),
            finalCandidatePresent: true,
            finalCandidateSource: (diag.finalCandidateSource as string | undefined)
              ?? (clientFallbackApplied
                ? (diag.finalCandidateSource === 'deterministic_tense_normalizer'
                  ? 'deterministic_tense_normalizer'
                  : 'deterministic_fallback')
                : (diag.unsupportedClaimRepairApplied
                  ? 'unsupported_claim_repair'
                  : (diag.noOpRepairApplied ? 'noop_repair' : 'provider'))),
            finalCandidateValidationApplicable: true,
            finalCandidatePredicateValidationApplicable:
              typeof (diag as Record<string, unknown>).finalCandidatePredicateValidationApplicable
                === 'boolean'
                ? (diag as Record<string, unknown>)
                  .finalCandidatePredicateValidationApplicable as boolean
                : !(
                  diag.sourceWasEmpty === true
                  || diag.operationMode === 'generate_from_job_context'
                  || (
                    Number(diag.sourceFactCount ?? this.draft.sourceFactCount ?? -1) === 0
                    && Number(
                      diag.sourcePredicateIdentityCount
                      ?? this.draft.sourcePredicateIdentityCount
                      ?? 0,
                    ) === 0
                  )
                ),
            finalCandidateBulletCount: Number(
              (diag as Record<string, unknown>).finalCandidateBulletCount
              ?? appliedCount
              ?? bullets.length,
            ),
            finalCandidateBulletScripts: Array.isArray(
              (diag as Record<string, unknown>).finalCandidateBulletScripts,
            )
              && ((diag as Record<string, unknown>).finalCandidateBulletScripts as unknown[])
                .length === Number(
                (diag as Record<string, unknown>).finalCandidateBulletCount ?? appliedCount,
              )
              ? ((diag as Record<string, unknown>).finalCandidateBulletScripts as unknown[])
                .map(String)
              : appliedScripts,
            appliedFinalBulletCount: Number(
              (diag as Record<string, unknown>).appliedFinalBulletCount
              ?? appliedCount
              ?? bullets.length,
            ),
            appliedFinalBulletScripts: Array.isArray(
              (diag as Record<string, unknown>).appliedFinalBulletScripts,
            )
              && ((diag as Record<string, unknown>).appliedFinalBulletScripts as unknown[])
                .length === Number(
                (diag as Record<string, unknown>).appliedFinalBulletCount ?? appliedCount,
              )
              ? ((diag as Record<string, unknown>).appliedFinalBulletScripts as unknown[])
                .map(String)
              : appliedScripts,
            applyAttempted: true,
            visibleApplyApplicable: true,
            sourceAlreadyValidForTarget:
              typeof (diag as Record<string, unknown>).sourceAlreadyValidForTarget === 'boolean'
                ? (diag as Record<string, unknown>).sourceAlreadyValidForTarget as boolean
                : null,
            sourceTenseMismatchCount:
              typeof (diag as Record<string, unknown>).sourceTenseMismatchCount === 'number'
                ? (diag as Record<string, unknown>).sourceTenseMismatchCount as number
                : null,
            sourceTenseValidationPassed:
              typeof (diag as Record<string, unknown>).sourceTenseValidationPassed === 'boolean'
                ? (diag as Record<string, unknown>).sourceTenseValidationPassed as boolean
                : null,
            expectedEmploymentTense:
              ((diag as Record<string, unknown>).expectedEmploymentTense as string | null | undefined)
              ?? null,
          }
        : typeof (diag as Record<string, unknown>).earlyNoOpPreflightPassed === 'boolean'
          ? {
            earlyNoOpPreflightPassed: false,
            earlyNoOpPreflightEvaluated: Boolean(
              (diag as Record<string, unknown>).earlyNoOpPreflightEvaluated,
            ),
            uneditedRerunDetected: Boolean(
              (diag as Record<string, unknown>).uneditedRerunDetected,
            ),
            // Do not force providerAttempted false — provider evidence may exist
            // without an explicit client httpStatus stamp in unit tests.
            ...(
              (diag as Record<string, unknown>).providerAttempted === true
              || this.draft.providerAttempted === true
              || this.draft.providerHttpStatus != null
                ? { providerAttempted: true }
                : (
                  (diag as Record<string, unknown>).providerAttempted === false
                    ? { providerAttempted: false }
                    : {}
                )
            ),
            finalCandidatePresent:
              (diag as Record<string, unknown>).finalCandidatePresent === true,
            finalCandidateBulletCount: Number(
              (diag as Record<string, unknown>).finalCandidateBulletCount ?? 0,
            ),
            finalCandidateBulletScripts: Array.isArray(
              (diag as Record<string, unknown>).finalCandidateBulletScripts,
            )
              ? ((diag as Record<string, unknown>).finalCandidateBulletScripts as unknown[])
                .map(String)
              : [],
            appliedFinalBulletCount: Number(
              (diag as Record<string, unknown>).appliedFinalBulletCount ?? 0,
            ),
            appliedFinalBulletScripts: Array.isArray(
              (diag as Record<string, unknown>).appliedFinalBulletScripts,
            )
              ? ((diag as Record<string, unknown>).appliedFinalBulletScripts as unknown[])
                .map(String)
              : [],
            sourceAlreadyValidForTarget:
              typeof (diag as Record<string, unknown>).sourceAlreadyValidForTarget === 'boolean'
                ? (diag as Record<string, unknown>).sourceAlreadyValidForTarget as boolean
                : null,
            sourceTenseMismatchCount:
              typeof (diag as Record<string, unknown>).sourceTenseMismatchCount === 'number'
                ? (diag as Record<string, unknown>).sourceTenseMismatchCount as number
                : null,
            sourceTenseValidationPassed:
              typeof (diag as Record<string, unknown>).sourceTenseValidationPassed === 'boolean'
                ? (diag as Record<string, unknown>).sourceTenseValidationPassed as boolean
                : null,
            expectedEmploymentTense:
              ((diag as Record<string, unknown>).expectedEmploymentTense as string | null | undefined)
              ?? null,
          }
          : {}),
      visibleComparisonSourceKind:
        (diag.visibleComparisonSourceKind as string | null | undefined) ?? null,
      visibleComparisonHash: (diag.visibleComparisonHash as string | null | undefined) ?? null,
      visibleComparisonNormalizedHash:
        (diag.visibleComparisonNormalizedHash as string | null | undefined) ?? null,
      visibleComparisonUnitCount: Number(diag.visibleComparisonUnitCount ?? 0),
      // AAB-327 — request-time snapshot wins over finalize recompute.
      visibleComparisonProvenance: this.draft.visibleComparisonProvenance
        ?? this.draft.currentTextareaProvenance
        ?? (diag.visibleComparisonProvenance as string | null | undefined)
        ?? null,
      visibleComparisonMatchedLastAiOutput: (
        this.draft.visibleComparisonMatchedLastAiOutput
        ?? this.draft.lastAiOutputHashMatched
        ?? (typeof diag.visibleComparisonMatchedLastAiOutput === 'boolean'
          ? diag.visibleComparisonMatchedLastAiOutput
          : null)
      ),
      visibleComparisonUsedForNoOp: Boolean(diag.visibleComparisonUsedForNoOp),
      visibleComparisonUsedForDegradationCheck: Boolean(
        diag.visibleComparisonUsedForDegradationCheck,
      ),
      visibleComparisonCapturedAtRequest: Boolean(
        diag.visibleComparisonCapturedAtRequest,
      ),
      finalMatchesVisibleComparisonAfterNormalization: Boolean(
        diag.finalMatchesVisibleComparisonAfterNormalization,
      ),
      finalSemanticallyEquivalentToVisibleComparison: Boolean(
        diag.finalSemanticallyEquivalentToVisibleComparison,
      ),
      semanticNoOpDetected: Boolean(diag.semanticNoOpDetected),
      semanticNoOpReason: (diag.semanticNoOpReason as string | null | undefined) ?? null,
      materialImprovementDetected: Boolean(diag.materialImprovementDetected),
      materialImprovementKinds: Array.isArray(diag.materialImprovementKinds)
        ? diag.materialImprovementKinds.map(String)
        : [],
      degradationDetected: Boolean(diag.degradationDetected),
      degradationKinds: Array.isArray(diag.degradationKinds)
        ? diag.degradationKinds.map(String)
        : [],
      neutralRestyleDetected: Boolean(diag.neutralRestyleDetected),
      finalDecisionKind: (diag.finalDecisionKind as string | null | undefined) ?? null,
      experienceVisibleNoopAuthorityRevision:
        (diag.experienceVisibleNoopAuthorityRevision as string | null | undefined) ?? null,
      experienceVisibleSnapshotWiringRevision:
        (diag.experienceVisibleSnapshotWiringRevision as string | null | undefined) ?? null,
      experienceSemanticNoopFinalGateRevision:
        (diag.experienceSemanticNoopFinalGateRevision as string | null | undefined) ?? null,
      experienceFactAuthorityConsistencyRevision:
        (diag.experienceFactAuthorityConsistencyRevision as string | null | undefined) ?? null,
      spanishExperienceComplianceGroundingRevision:
        (diag.spanishExperienceComplianceGroundingRevision as string | null | undefined) ?? null,
      experiencePredicatePhaseDiagnosticsRevision:
        (diag.experiencePredicatePhaseDiagnosticsRevision as string | null | undefined) ?? null,
      deterministicFallbackAttemptedAfterNoOp: Boolean(
        diag.deterministicFallbackAttemptedAfterNoOp
        || (
          (diag.providerNoOpDetected || diag.noOpRejected)
          && clientFallbackAttempted
        ),
      ),
      deterministicFallbackAppliedAfterNoOp: Boolean(
        diag.deterministicFallbackAppliedAfterNoOp
        || (
          (diag.providerNoOpDetected || diag.noOpRejected)
          && clientFallbackApplied
        ),
      ),
      finalCandidateSource: (diag.finalCandidateSource as string | undefined)
        ?? (finalized.countedAsSuccess
          ? (clientFallbackApplied
            ? 'deterministic_fallback'
            : (diag.unsupportedClaimRepairApplied
              ? 'unsupported_claim_repair'
              : (diag.noOpRepairApplied ? 'noop_repair' : 'provider')))
          : 'none'),
      finalUnsupportedClaimCount: Math.max(
        Number(diag.finalUnsupportedClaimCount ?? 0),
        Array.isArray(diag.finalUnsupportedClaimKinds)
          ? diag.finalUnsupportedClaimKinds.length
          : 0,
        reason === 'unsupported_claim' || reason === 'unsupported_generated_duty' ? 1 : 0,
      ),
      finalUnsupportedClaimKinds: Array.isArray(diag.finalUnsupportedClaimKinds)
        ? diag.finalUnsupportedClaimKinds.map(String)
        : [],
      countedAsSuccess: Boolean(finalized.countedAsSuccess),
      finalTypedFailureReason: blocked
        ? (reconcileExperienceTerminalRejectionReason({
          terminalReason: reason,
          providerRejectionReason: (diag.providerRejectionReason as string | undefined) || null,
          fallbackRejectionReason: (diag.clientDeterministicFallbackReason as string | undefined)
            || null,
          localeEvidence: {
            wrongLocaleBulletCount: diag.wrongLocaleBulletCount
              ?? this.draft.wrongLocaleBulletCount,
            wrongScriptBulletCount: diag.wrongScriptBulletCount
              ?? this.draft.wrongScriptBulletCount,
            mixedLanguageBulletCount: diag.mixedLanguageBulletCount
              ?? this.draft.mixedLanguageBulletCount,
            sourceLanguageLeakageDetected: diag.sourceLanguageLeakageDetected
              ?? this.draft.sourceLanguageLeakageDetected,
            targetLocalePurityPassed: diag.targetLocalePurityPassed
              ?? this.draft.targetLocalePurityPassed,
            detectedLocaleByBullet:
              (diag.detectedLocaleByBullet as Array<string | null> | undefined)
              || this.draft.detectedLocaleByBullet,
          },
        }) || reason)
        : null,
      rejectionStage: blocked
        ? (diag.rejectionStage || this.draft.rejectionStage || 'final_apply_postcondition')
        : null,
      providerCoverageCount: diag.providerCoveredFactCount
        ?? this.draft.providerCoveredFactCount
        ?? this.draft.providerCoverageCount
        ?? null,
      fallbackCoverageCount: clientCovered || (diag.fallbackCoverageCount ?? null),
      detectedSourceLocale: (diag.detectedSourceLocale as string | undefined)
        ?? this.draft.detectedSourceLocale
        ?? null,
      storedSourceLocale: (diag.storedSourceLocale as string | undefined)
        ?? this.draft.storedSourceLocale
        ?? this.draft.contentLocale
        ?? null,
      requestedTargetLocale: (diag.requestedTargetLocale as string | undefined)
        ?? this.draft.requestedLocale
        ?? null,
      crossLocaleOperation: Boolean(
        diag.crossLocaleOperation ?? this.draft.crossLocaleOperation,
      ),
      translationProviderAttempted: Boolean(diag.translationProviderAttempted),
      translationRepairAttempted: Boolean(diag.translationRepairAttempted),
      translationFallbackAttempted: Boolean(
        diag.translationFallbackAttempted
        || diag.clientDeterministicFallbackReason === 'cross_locale_translation_fallback',
      ),
      translationFallbackSelected: Boolean(
        (diag as Record<string, unknown>).translationFallbackSelected
        || (
          (
            diag.clientDeterministicFallbackSelected
            || (diag as Record<string, unknown>).clientDeterministicFallbackUsedForFinalCandidate
            || diag.clientDeterministicFallbackApplied
            || diag.finalCandidateSource === 'deterministic_fallback'
          )
          && (diag.crossLocaleOperation || diag.translationFallbackAttempted)
        ),
      ),
      translationFallbackApplied: Boolean(
        diag.translationFallbackApplied
      ),
      translatedFactCount: diag.translatedFactCount ?? null,
      authoritativeFactSourceLocale:
        ((diag as Record<string, unknown>).authoritativeFactSourceLocale as string | undefined)
        ?? null,
      // EN pre_ai authority + unused foreign textarea must stay authoritative.
      // Never leave the draft default `false` when finalize/session evidence says EN.
      englishSourceStillAuthoritative: (() => {
        const fromDiag = (diag as Record<string, unknown>).englishSourceStillAuthoritative;
        const authLocale = String(
          ((diag as Record<string, unknown>).authoritativeFactSourceLocale as string | undefined)
          ?? this.draft.authoritativeFactSourceLocale
          ?? '',
        ).toLowerCase();
        const authKind = String(
          this.draft.authoritativeFactSourceKind
          ?? (diag as Record<string, unknown>).authoritativeFactSourceKind
          ?? '',
        );
        const unused = this.draft.currentTextareaUsedForFactExtraction === false
          || (diag as Record<string, unknown>).currentTextareaUsedForFactExtraction === false;
        if (
          unused
          && authLocale === 'en'
          && (
            authKind === 'pre_ai_snapshot'
            || authKind === 'originalUserDescription'
            || authKind === 'original_user_description'
            || authKind === 'canonicalDescription'
            || authKind === 'canonical_description'
          )
        ) {
          return true;
        }
        if (typeof fromDiag === 'boolean') return fromDiag;
        return Boolean(this.draft.englishSourceStillAuthoritative);
      })(),
      staleForeignLocaleSourceAuthoritative: (() => {
        const fromDiag = (diag as Record<string, unknown>).staleForeignLocaleSourceAuthoritative;
        if (typeof fromDiag === 'boolean') return fromDiag;
        return false;
      })(),
      visibleTextareaLocale:
        ((diag as Record<string, unknown>).visibleTextareaLocale as string | undefined)
        ?? null,
      visibleTextareaLocaleBeforeApply:
        ((diag as Record<string, unknown>).visibleTextareaLocaleBeforeApply as string | undefined)
        ?? ((diag as Record<string, unknown>).visibleTextareaLocale as string | undefined)
        ?? null,
      entryGeneratedLocaleBeforeApply:
        ((diag as Record<string, unknown>).entryGeneratedLocaleBeforeApply as string | undefined)
        ?? null,
      // Document-level CVData.contentLocale only — never fall back to entry generated locale.
      contentLocaleDocument:
        ((diag as Record<string, unknown>).contentLocaleDocument as string | undefined)
        ?? null,
      // Post-commit only; finalize leaves this null until recordVisibleApply(true).
      appliedVisibleContentLocale:
        ((diag as Record<string, unknown>).appliedVisibleContentLocale as string | undefined)
        ?? null,
      targetLocaleValidationPassed: (() => {
        void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
        const localeEval = evaluateExperiencePhaseLocaleValidation({
          wrongLocaleBulletCount: diag.wrongLocaleBulletCount
            ?? this.draft.wrongLocaleBulletCount,
          wrongScriptBulletCount: diag.wrongScriptBulletCount
            ?? this.draft.wrongScriptBulletCount,
          mixedLanguageBulletCount: diag.mixedLanguageBulletCount
            ?? this.draft.mixedLanguageBulletCount,
          sourceLanguageLeakageDetected: diag.sourceLanguageLeakageDetected
            ?? this.draft.sourceLanguageLeakageDetected,
          targetLocalePurityPassed: diag.targetLocalePurityPassed
            ?? this.draft.targetLocalePurityPassed,
          detectedLocaleByBullet: (diag.detectedLocaleByBullet as Array<string | null> | undefined)
            || this.draft.detectedLocaleByBullet,
        }, { explicitReason: reason });
        if (typeof diag.targetLocaleValidationPassed === 'boolean') {
          // Prefer explicit phase-local value when it agrees with purity evidence.
          if (diag.targetLocaleValidationPassed === localeEval.passed) {
            return diag.targetLocaleValidationPassed;
          }
          return localeEval.passed;
        }
        return localeEval.passed;
      })(),
      sourcePerspectiveMode: (diag.sourcePerspectiveMode as string | undefined)
        ?? (diag.sourcePersonMode as string | undefined)
        ?? null,
      targetPerspectiveMode: (diag.targetPerspectiveMode as string | undefined)
        ?? (diag.finalPersonMode as string | undefined)
        ?? null,
      targetContentApplied: false,
      contentLocaleUpdatedAfterApply: false,
      selectedExperienceEntryIdHash: (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? this.draft.selectedExperienceEntryIdHash
        ?? null,
      operationSnapshotExperienceEntryIdHash:
        (diag.operationSnapshotExperienceEntryIdHash as string | undefined)
        ?? this.draft.operationSnapshotExperienceEntryIdHash
        ?? this.draft.snapshotExperienceEntryIdHash
        ?? null,
      clickedExperienceEntryIdHash: this.draft.clickedExperienceEntryIdHash
        ?? (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? null,
      snapshotExperienceEntryIdHash: this.draft.snapshotExperienceEntryIdHash
        ?? (diag.operationSnapshotExperienceEntryIdHash as string | undefined)
        ?? null,
      payloadExperienceEntryIdHash: this.draft.payloadExperienceEntryIdHash
        ?? (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? null,
      // AAB-329: applied* only after applyCommitted — never from finalize countedAsSuccess.
      appliedExperienceEntryIdHash: null,
      attemptedApplyExperienceEntryIdHash:
        (diagRec.attemptedApplyExperienceEntryIdHash as string | undefined)
        ?? (finalized.countedAsSuccess
          ? ((diag.selectedExperienceEntryIdHash as string | undefined)
            ?? this.draft.selectedExperienceEntryIdHash
            ?? null)
          : null),
      sourceFactsEntryIdHash: (diag.sourceFactsEntryIdHash as string | undefined)
        ?? this.draft.sourceFactsEntryIdHash
        ?? null,
      canonicalFactsEntryIdHash: (diag.canonicalFactsEntryIdHash as string | undefined)
        ?? this.draft.canonicalFactsEntryIdHash
        ?? null,
      fallbackFactsEntryIdHash: (diag.fallbackFactsEntryIdHash as string | undefined)
        ?? this.draft.fallbackFactsEntryIdHash
        ?? null,
      providerTargetEntryIdHash: (diag.providerTargetEntryIdHash as string | undefined)
        ?? this.draft.providerTargetEntryIdHash
        ?? null,
      fallbackTargetEntryIdHash: this.draft.fallbackTargetEntryIdHash
        ?? (diag.fallbackFactsEntryIdHash as string | undefined)
        ?? (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? null,
      appliedEmploymentState: null,
      appliedFinalBulletCount: 0,
      appliedFinalBulletScripts: [],
      arrayIndexAtRequest: (diag.arrayIndexAtRequest as number | undefined)
        ?? this.draft.arrayIndexAtRequest
        ?? null,
      arrayIndexAtApply: (diag.arrayIndexAtApply as number | undefined) ?? null,
      stableEntryIdentityMatched: diag.stableEntryIdentityMatched ?? null,
      targetEntryStillExists: diag.targetEntryStillExists ?? null,
      entryContextMatchedAtApply: diag.entryContextMatchedAtApply ?? null,
      targetLocale: (diag.targetLocale as string | undefined)
        ?? (diag.requestedTargetLocale as string | undefined)
        ?? this.draft.requestedLocale
        ?? null,
      targetScript: (diag.targetScript as string | undefined)
        ?? (() => {
          const loc = (diag.targetLocale as string | undefined)
            || (diag.requestedTargetLocale as string | undefined)
            || this.draft.requestedLocale;
          return loc ? resolveTargetScriptForLocale(loc as Locale) : null;
        })(),
      detectedLocaleByBullet: (diag.detectedLocaleByBullet as Array<string | null> | undefined) || [],
      detectedScriptByBullet: (diag.detectedScriptByBullet as string[] | undefined) || [],
      wrongLocaleBulletCount: diag.wrongLocaleBulletCount ?? 0,
      wrongScriptBulletCount: diag.wrongScriptBulletCount ?? 0,
      mixedLanguageBulletCount: diag.mixedLanguageBulletCount ?? 0,
      sourceLanguageLeakageDetected: Boolean(diag.sourceLanguageLeakageDetected),
      targetLocalePurityPassed: (() => {
        const localeEval = evaluateExperiencePhaseLocaleValidation({
          wrongLocaleBulletCount: diag.wrongLocaleBulletCount
            ?? this.draft.wrongLocaleBulletCount,
          wrongScriptBulletCount: diag.wrongScriptBulletCount
            ?? this.draft.wrongScriptBulletCount,
          mixedLanguageBulletCount: diag.mixedLanguageBulletCount
            ?? this.draft.mixedLanguageBulletCount,
          sourceLanguageLeakageDetected: diag.sourceLanguageLeakageDetected
            ?? this.draft.sourceLanguageLeakageDetected,
          targetLocalePurityPassed: diag.targetLocalePurityPassed
            ?? this.draft.targetLocalePurityPassed,
        }, { explicitReason: reason });
        if (typeof diag.targetLocalePurityPassed === 'boolean') {
          return diag.targetLocalePurityPassed;
        }
        return localeEval.passed;
      })(),
      crossEntryCandidateFactCount: diag.crossEntryCandidateFactCount ?? 0,
      crossEntryLeakageDetected: Boolean(diag.crossEntryLeakageDetected),
      crossDomainLeakageDetected: Boolean(diag.crossDomainLeakageDetected),
      leakedFromExperienceEntryIdHashes:
        (diag.leakedFromExperienceEntryIdHashes as string[] | undefined) || [],
      entryScopedCanonicalStorageUsed: diag.entryScopedCanonicalStorageUsed ?? null,
      responseRejectedForEntryMismatch: Boolean(
        diag.responseRejectedForEntryMismatch
        || reason === 'experience_entry_mismatch'
        || reason === 'experience_entry_missing',
      ),
      responseRejectedForLocaleImpurity: (() => {
        const localeEval = evaluateExperiencePhaseLocaleValidation({
          wrongLocaleBulletCount: diag.wrongLocaleBulletCount
            ?? this.draft.wrongLocaleBulletCount,
          wrongScriptBulletCount: diag.wrongScriptBulletCount
            ?? this.draft.wrongScriptBulletCount,
          mixedLanguageBulletCount: diag.mixedLanguageBulletCount
            ?? this.draft.mixedLanguageBulletCount,
          sourceLanguageLeakageDetected: diag.sourceLanguageLeakageDetected
            ?? this.draft.sourceLanguageLeakageDetected,
          targetLocalePurityPassed: diag.targetLocalePurityPassed
            ?? this.draft.targetLocalePurityPassed,
        }, { explicitReason: reason });
        return localeEval.responseRejectedForLocaleImpurity;
      })(),
      responseRejectedForDomainMismatch: Boolean(
        diag.responseRejectedForDomainMismatch
        || reason === 'cross_entry_fact_leakage'
        || reason === 'cross_domain_leakage',
      ),
      providerLocaleValidationReason: (() => {
        const localeEval = evaluateExperiencePhaseLocaleValidation({
          wrongLocaleBulletCount: diag.wrongLocaleBulletCount
            ?? this.draft.wrongLocaleBulletCount,
          wrongScriptBulletCount: diag.wrongScriptBulletCount
            ?? this.draft.wrongScriptBulletCount,
          mixedLanguageBulletCount: diag.mixedLanguageBulletCount
            ?? this.draft.mixedLanguageBulletCount,
          sourceLanguageLeakageDetected: diag.sourceLanguageLeakageDetected
            ?? this.draft.sourceLanguageLeakageDetected,
          targetLocalePurityPassed: diag.targetLocalePurityPassed
            ?? this.draft.targetLocalePurityPassed,
        }, {
          explicitReason: (diag.providerRejectionReason as string | undefined) || reason,
        });
        // Coverage failures must never populate providerLocaleValidationReason.
        if (localeEval.passed) return null;
        return localeEval.reason
          || (isExperienceLocaleRejectionReason(diag.providerRejectionReason as string)
            ? String(diag.providerRejectionReason)
            : null);
      })(),
      generationProviderValidationPassed: diag.generationProviderValidationPassed
        ?? (diag.sourceWasEmpty && !blocked && !diag.generationFallbackApplied
          ? true
          : diag.generationProviderValidationPassed ?? null),
      generationProviderRejectionReason: blocked && diag.sourceWasEmpty && !diag.generationFallbackApplied
        ? (diag.generationProviderRejectionReason || reason || null)
        : (diag.generationProviderRejectionReason ?? null),
      generationFinalPostconditionPassed: diag.generationFinalPostconditionPassed
        ?? (diag.sourceWasEmpty ? Boolean(finalized.countedAsSuccess && !blocked) : null),
      generationFallbackBuilderKind: diag.generationFallbackBuilderKind
        ?? (diag.generationFallbackApplied ? 'job_context_generation' : null),
      generationFallbackFailureReason: diag.generationFallbackFailureReason
        ?? (diag.generationFallbackAttempted && !diag.generationFallbackApplied
          ? (reason || 'empty_fallback')
          : null),
    });

    // Never report experience_generation_not_relevant when relevance actually passed.
    if (
      this.draft.relevanceValidationPassed
      && this.draft.fallbackReason === 'experience_generation_not_relevant'
    ) {
      this.patch({
        fallbackReason: this.draft.generationFallbackApplied
          ? null
          : (diag.clientDeterministicFallbackReason || this.draft.finalTypedFailureReason),
      });
    }

    const localeFail = (() => {
      const localeEval = evaluateExperiencePhaseLocaleValidation({
        wrongLocaleBulletCount: this.draft.wrongLocaleBulletCount,
        wrongScriptBulletCount: this.draft.wrongScriptBulletCount,
        mixedLanguageBulletCount: this.draft.mixedLanguageBulletCount,
        sourceLanguageLeakageDetected: this.draft.sourceLanguageLeakageDetected,
        targetLocalePurityPassed: this.draft.targetLocalePurityPassed,
      }, { explicitReason: this.draft.finalTypedFailureReason || reason });
      return !localeEval.passed;
    })();

    // Build provider / deterministic_fallback / final_selected lineage (hashes only).
    const lineage: NonNullable<ExperienceAiDiagnosticTrace['candidateLineage']> = [];
    const providerExplicitlyNotAttempted = (
      String(diag.apiResponseKind || '') === 'not_attempted'
      || String(diag.providerResponseKind || '') === 'not_attempted'
      || (
        (diag.providerAttempted === false || this.draft.providerAttempted === false)
        && this.draft.providerHttpStatus == null
        && diag.providerHttpStatus == null
        && diag.providerCoveredFactCount == null
        && Number(diag.providerBulletCount ?? 0) === 0
        && providerUncovered.length === 0
        && diag.providerAccepted !== false
        && !diag.providerRejectionStage
      )
    );
    const providerEvidencePresent = Boolean(
      (diag.providerBulletCount ?? this.draft.providerBulletCount ?? 0) > 0
      || (diag.providerCoveredFactCount != null)
      || (providerUncovered.length > 0)
      || Boolean(text && !clientFallbackApplied && finalized.countedAsSuccess)
      || diag.providerAccepted === false
      || Boolean(diag.providerRejectionStage)
    );
    const providerWasAttempted = !providerExplicitlyNotAttempted && (
      this.draft.providerAttempted === true
      || diag.providerAttempted === true
      || this.draft.providerHttpStatus != null
      || diag.providerHttpStatus != null
      || providerEvidencePresent
    );
    const providerPresent = providerWasAttempted && providerEvidencePresent;
    if (providerWasAttempted && (providerPresent || providerUncovered.length > 0 || diag.providerCoveredFactCount != null)) {
      if (this.draft.providerAttempted !== true) {
        this.patch({ providerAttempted: true });
      }
      const pCovered = diag.providerCoveredFactCount
        ?? this.draft.providerCoveredFactCount
        ?? null;
      const pRequired = diag.providerRequiredFactCount
        ?? this.draft.providerRequiredFactCount
        ?? finalRequired;
      lineage.push({
        candidateKind: 'provider',
        present: true,
        accepted: Boolean(diag.providerAccepted && finalized.countedAsSuccess && !clientFallbackApplied),
        coverageRequiredCount: pRequired,
        coverageCoveredCount: pCovered,
        uncoveredFactIdentityHashes: [...providerUncovered],
        unsupportedClaimCount: typeof diag.providerUnsupportedClaimCount === 'number'
          ? diag.providerUnsupportedClaimCount
          : Number(
            Array.isArray(diag.providerUnsupportedClaimKinds)
              ? diag.providerUnsupportedClaimKinds.length
              : (diag.unsupportedClaimCount ?? 0),
          ),
        unsupportedClaimKinds: Array.isArray(diag.providerUnsupportedClaimKinds)
          ? diag.providerUnsupportedClaimKinds.map(String)
          : [],
        rejectionStage: diag.providerAccepted
          ? null
          : (diag.providerRejectionStage
            || diag.rejectionStage
            || this.draft.providerRejectionStage
            || reason
            || null),
        rejectionReasons: diag.providerAccepted
          ? []
          : ([
            // Prefer phase-local provider rejection over terminal reason so a
            // later fallback locale field cannot rewrite coverage lineage.
            diag.providerRejectionReason
            || (Array.isArray(this.draft.providerRejectionReasons)
              ? this.draft.providerRejectionReasons[0]
              : null)
            || reason
            || diag.clientDeterministicFallbackReason,
          ].filter(Boolean) as string[]),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    const repairAttempted = Boolean(diag.unsupportedClaimRepairAttempted);
    const repairApplied = Boolean(diag.unsupportedClaimRepairApplied);
    if (repairAttempted || repairApplied || diag.finalCandidateSource === 'unsupported_claim_repair') {
      void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
      const repairResidualKinds = Array.isArray(
        diag.unsupportedClaimRepairResidualUnsupportedClaimKinds,
      )
        ? diag.unsupportedClaimRepairResidualUnsupportedClaimKinds.map(String)
        : [];
      const repairKinds = Array.isArray(diag.unsupportedClaimRepairUnsupportedClaimKinds)
        ? diag.unsupportedClaimRepairUnsupportedClaimKinds.map(String)
        : [];
      lineage.push({
        candidateKind: 'unsupported_claim_repair',
        present: true,
        accepted: repairApplied && Boolean(finalized.countedAsSuccess),
        hash: (diag.unsupportedClaimRepairHash as string | null | undefined) ?? null,
        normalizedHash:
          (diag.unsupportedClaimRepairNormalizedHash as string | null | undefined)
          ?? (diag.unsupportedClaimRepairHash as string | null | undefined)
          ?? null,
        coverageRequiredCount: diag.unsupportedClaimRepairCoverageRequiredCount
          ?? finalRequired,
        coverageCoveredCount: diag.unsupportedClaimRepairCoverageCoveredCount ?? null,
        uncoveredFactIdentityHashes: Array.isArray(
          diag.unsupportedClaimRepairUncoveredFactIdentityHashes,
        )
          ? diag.unsupportedClaimRepairUncoveredFactIdentityHashes.map(String)
          : [],
        unsupportedClaimCount: repairApplied
          ? Number(diag.finalUnsupportedClaimCount ?? 0)
          : Math.max(
            Number(diag.unsupportedClaimRepairResidualUnsupportedClaimCount ?? 0),
            repairResidualKinds.length,
            Number(diag.unsupportedClaimRepairUnsupportedClaimCount ?? 0),
          ),
        unsupportedClaimKinds: repairApplied
          ? (Array.isArray(diag.finalUnsupportedClaimKinds)
            ? diag.finalUnsupportedClaimKinds.map(String)
            : [])
          : (repairResidualKinds.length ? repairResidualKinds : repairKinds),
        rejectionStage: repairApplied
          ? null
          : (diag.unsupportedClaimRepairRejectionReason
            || 'unsupported_claim_repair_rejected'),
        rejectionReasons: repairApplied
          ? []
          : ([
            diag.unsupportedClaimRepairRejectionReason
            || 'unsupported_claim_repair_rejected',
          ].filter(Boolean) as string[]),
        localeValidationPassed: !localeFail,
        tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
        perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    if (clientFallbackAttempted || clientFallbackApplied) {
      lineage.push({
        candidateKind: 'deterministic_fallback',
        present: clientBulletCount > 0 || clientFallbackApplied,
        accepted: clientFallbackApplied && Boolean(finalized.countedAsSuccess),
        normalizedHash: clientFallbackApplied && text ? fingerprintText(text) : null,
        unitCount: clientBulletCount || (clientFallbackApplied ? bullets.length : 0),
        coverageRequiredCount: clientRequired,
        coverageCoveredCount: clientCovered,
        uncoveredFactIdentityHashes: [...clientUncovered],
        unsupportedClaimCount: clientFallbackApplied
          ? Number(diag.finalUnsupportedClaimCount ?? 0)
          : 0,
        unsupportedClaimKinds: clientFallbackApplied
          ? (Array.isArray(diag.finalUnsupportedClaimKinds)
            ? diag.finalUnsupportedClaimKinds.map(String)
            : [])
          : [],
        rejectionStage: clientFallbackApplied
          ? null
          : (reason || diag.clientDeterministicFallbackReason || null),
        rejectionReasons: clientFallbackApplied
          ? []
          : ([reason || diag.clientDeterministicFallbackReason].filter(Boolean) as string[]),
        localeValidationPassed: !localeFail,
        tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
        perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    if (finalized.countedAsSuccess && text) {
      const finalHash = (diag.finalNormalizedHash as string | undefined)
        || fingerprintText(text.replace(/\s+/g, ' ').trim());
      lineage.push({
        candidateKind: 'final_selected',
        present: true,
        accepted: true,
        hash: finalHash,
        normalizedHash: finalHash,
        unitCount: bullets.length,
        unitHashes: bullets.map((b) => fingerprintText(b.replace(/\s+/g, ' ').trim())),
        coverageRequiredCount: finalRequired,
        coverageCoveredCount: finalCovered,
        uncoveredFactIdentityHashes: [...finalUncovered],
        unsupportedClaimCount: Number(diag.finalUnsupportedClaimCount ?? 0),
        unsupportedClaimKinds: Array.isArray(diag.finalUnsupportedClaimKinds)
          ? diag.finalUnsupportedClaimKinds.map(String)
          : [],
        rejectionStage: null,
        rejectionReasons: [],
        localeValidationPassed: !localeFail,
        tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
        perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    if (lineage.length) {
      this.patch({ candidateLineage: lineage });
    }

    this.stage(
      'locale_validation',
      localeFail && !clientFallbackApplied ? 'fail' : 'ok',
      localeFail ? reason || undefined : undefined,
    );

    const coverageFail = reason === 'experience_material_fact_coverage_incomplete'
      || Boolean(
        diag.rejectionStage?.includes('material')
        || diag.rejectionStage?.includes('source_fact'),
      );
    this.stage(
      'material_coverage_validation',
      coverageFail && !finalized.countedAsSuccess && !clientFallbackApplied ? 'fail' : 'ok',
      coverageFail && !clientFallbackApplied ? reason || undefined : undefined,
    );

    const unsupported = reason === 'unsupported_claim' || reason === 'unsupported_generated_duty';
    this.stage(
      'unsupported_claim_validation',
      unsupported && !finalized.countedAsSuccess ? 'fail' : 'ok',
      unsupported ? reason || undefined : undefined,
    );

    const dup = reason === 'exact_duplicate' || reason === 'duplicate_bullets';
    this.stage(
      'duplicate_validation',
      dup && !finalized.countedAsSuccess ? 'fail' : 'ok',
      dup ? reason || undefined : undefined,
    );

    this.stage(
      'tense_normalization',
      'ok',
      undefined,
    );
    // Perspective is a separate stage from present/past tenseMode.
    const perspAttempted = Boolean(
      (finalized.diagnostics as { perspectiveNormalizationAttempted?: boolean } | undefined)
        ?.perspectiveNormalizationAttempted,
    );
    const perspApplied = Boolean(
      (finalized.diagnostics as { perspectiveNormalizationApplied?: boolean } | undefined)
        ?.perspectiveNormalizationApplied,
    );
    const perspPassed = Boolean(
      (finalized.diagnostics as { perspectiveValidationPassed?: boolean } | undefined)
        ?.perspectiveValidationPassed,
    );
    const noOp = Boolean(
      (finalized.diagnostics as { noOpRejected?: boolean } | undefined)?.noOpRejected,
    );
    if (perspAttempted || noOp || reason === 'experience_cv_perspective_first_person' || reason === 'experience_ai_noop') {
      // AAB-316: no-op must not be reported as perspective_normalization fail.
      const perspectiveStatus = (() => {
        if (noOp || reason === 'experience_ai_noop') {
          if (!perspAttempted) return 'skipped' as const;
          return perspPassed ? 'ok' as const : 'skipped' as const;
        }
        if (!finalized.countedAsSuccess && reason === 'experience_cv_perspective_first_person') {
          return 'fail' as const;
        }
        return (perspPassed || finalized.countedAsSuccess) ? 'ok' as const : 'fail' as const;
      })();
      this.stage(
        'perspective_normalization',
        perspectiveStatus,
        perspectiveStatus === 'fail'
          ? (reason || 'experience_cv_perspective_first_person')
          : (noOp ? 'experience_ai_noop' : (perspApplied ? undefined : undefined)),
      );
    }

    if (clientFallbackAttempted) {
      this.stage(
        'deterministic_fallback_started',
        'ok',
        diag.clientDeterministicFallbackReason || diag.rejectionStage || undefined,
      );
      const tenseNormOk = diag.finalCandidateSource === 'deterministic_tense_normalizer'
        && Boolean(finalized.countedAsSuccess);
      const fbCount = diag.clientDeterministicFallbackBulletCount
        ?? diag.fallbackBulletCount
        ?? (clientFallbackApplied || tenseNormOk ? bullets.length : 0);
      this.stage(
        'fallback_output_built',
        fbCount > 0 || tenseNormOk ? 'ok' : 'fail',
        fbCount > 0 || tenseNormOk ? undefined : 'empty_fallback',
      );
      this.stage(
        'fallback_locale_validation',
        localeFail && blocked ? 'fail' : 'ok',
        localeFail ? reason || undefined : undefined,
      );
      this.stage(
        'fallback_material_coverage',
        clientFallbackApplied
          ? 'ok'
          : (coverageFail ? 'fail' : 'ok'),
        !clientFallbackApplied && coverageFail ? reason || undefined : undefined,
      );
    } else if (blocked) {
      this.stage('deterministic_fallback_started', 'skipped', 'provider_path_rejected_or_fallback_absent');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else if (diag.unsupportedClaimRepairApplied || diag.finalCandidateSource === 'unsupported_claim_repair') {
      void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
      this.stage('deterministic_fallback_started', 'skipped', 'unsupported_claim_repair_accepted');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else if (diag.noOpRepairApplied || diag.finalCandidateSource === 'noop_repair') {
      this.stage('deterministic_fallback_started', 'skipped', 'noop_repair_accepted');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else if (diag.providerAccepted === false) {
      // Provider rejected without attempted/applied fallback — never claim provider_accepted.
      this.stage(
        'deterministic_fallback_started',
        'skipped',
        diag.unsupportedClaimRepairAttempted
          ? (diag.unsupportedClaimRepairRejectionReason || 'unsupported_claim_repair_rejected')
          : 'provider_path_rejected_or_fallback_absent',
      );
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else {
      this.stage('deterministic_fallback_started', 'skipped', 'provider_accepted');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    }

    this.stage(
      'final_candidate_postconditions',
      blocked ? 'fail' : 'ok',
      blocked ? reason || 'blocked' : undefined,
    );
    this.stage(
      'final_candidate_fact_validation',
      blocked ? 'fail' : 'ok',
      blocked ? reason || 'blocked' : undefined,
    );
    this.stage(
      'final_candidate_predicate_validation',
      blocked ? 'fail' : 'ok',
      blocked ? reason || 'blocked' : undefined,
    );
  }

  /**
   * AAB-327/329: evaluate decision-critical invariants/completeness before visible
   * apply and usage increment. Must be called after recordFinalizeResult.
   * Pre-apply must NOT require post-apply visible fields.
   */
  evaluatePreApplyDecisionGates(): {
    passed: boolean;
    reason: string | null;
    diagnosticInvariantCheckPassed: boolean;
    diagnosticCompletenessPassed: boolean;
  } {
    void EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION;
    void EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION;
    const before = Number(this.draft.usageCountBefore ?? 0);
    // Immutable decision view — never invent provisional visible success.
    const provisional = {
      ...this.draft,
      stages: this.stages,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountAfter: before,
      applyAuthorized: false,
      applyAttempted: false,
      applyCommitted: false,
      targetContentApplied: false,
      operationKind: 'experience' as const,
      marker: EXPERIENCE_AI_DIAG_MARKER,
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      apiBaseUrlConfigured: Boolean(getApiBaseUrl()),
      capacitorServerUrlConfigured: false,
      sourceCommitShort: this.draft.sourceCommitShort || 'unknown',
    };
    const preapplyInvariants = checkExperiencePreapplyDiagnosticInvariants(
      provisional as Record<string, unknown>,
    );
    const sharedInvariants = checkExperienceDiagnosticInvariants(provisional);
    const invariantFailures = [
      ...preapplyInvariants.failures,
      ...sharedInvariants.failures,
    ];
    const invariantsPassed = preapplyInvariants.passed && sharedInvariants.passed;
    const withInvariants = {
      ...provisional,
      diagnosticInvariantCheckPassed: invariantsPassed,
      diagnosticInvariantFailureCount: invariantFailures.length,
      diagnosticInvariantFailures: invariantFailures,
      preapplyDiagnosticInvariantCheckPassed: preapplyInvariants.passed,
      preapplyDiagnosticInvariantFailures: preapplyInvariants.failures,
    };
    const completeness = checkExperiencePreapplyDiagnosticCompleteness(
      withInvariants as Record<string, unknown>,
    );
    const decisionSnap = buildExperiencePreapplyDecisionSnapshot(
      withInvariants as Record<string, unknown>,
    );
    const passed = invariantsPassed && completeness.passed;
    this.patch({
      ...decisionSnap,
      diagnosticInvariantCheckPassed: invariantsPassed,
      diagnosticInvariantFailureCount: invariantFailures.length,
      diagnosticInvariantFailures: invariantFailures,
      preapplyDiagnosticInvariantCheckPassed: preapplyInvariants.passed,
      preapplyDiagnosticInvariantFailures: preapplyInvariants.failures,
      preapplyDiagnosticCompletenessPassed: completeness.passed,
      preapplyMissingRequiredDiagnosticFields: completeness.missingRequiredDiagnosticFields,
      preapplyNullRequiredDiagnosticFields: completeness.nullRequiredDiagnosticFields,
      // Overall completeness requires post-apply too — false until commit.
      diagnosticCompletenessPassed: false,
      missingRequiredDiagnosticFields: completeness.missingRequiredDiagnosticFields,
      nullRequiredDiagnosticFields: completeness.nullRequiredDiagnosticFields,
      postapplyDiagnosticCompletenessPassed: null,
      applyAuthorized: passed,
      experienceInvariantPreapplyGateRevision:
        EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION,
      experienceFactAuthorityTruthRevision: EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION,
      experienceVisibleSnapshotTruthRevision: EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION,
      experiencePhasedDiagnosticCompletenessRevision:
        EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION,
      experienceTransactionalApplyTruthRevision:
        EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION,
    });
    this.stage('preapply_invariant_gate', preapplyInvariants.passed ? 'ok' : 'fail');
    this.stage('preapply_completeness_gate', completeness.passed ? 'ok' : 'fail');
    this.stage('diagnostic_preapply_gate', passed ? 'ok' : 'fail');
    this.stage('apply_authorized', passed ? 'ok' : 'skipped', passed ? undefined : 'preapply_blocked');
    if (!passed) {
      this.patch({
        countedAsSuccess: false,
        visibleApplySucceeded: false,
        applyAuthorized: false,
        applyAttempted: false,
        applyCommitted: false,
        targetContentApplied: false,
        appliedExperienceEntryIdHash: null,
        diagnosticCompletenessPassed: false,
        postapplyDiagnosticCompletenessPassed: null,
        finalTypedFailureReason: !invariantsPassed
          ? 'diagnostic_invariant_failed'
          : 'diagnostic_completeness_failed',
        rejectionStage: 'diagnostic_preapply_gate',
      });
    }
    return {
      passed,
      reason: passed
        ? null
        : (!invariantsPassed ? 'diagnostic_invariant_failed' : 'diagnostic_completeness_failed'),
      diagnosticInvariantCheckPassed: invariantsPassed,
      diagnosticCompletenessPassed: completeness.passed,
    };
  }

  recordVisibleApply(
    applied: boolean,
    usageAfter: number,
    options?: { visibleDescription?: string; finalNormalizedText?: string },
  ): void {
    // Clean no-op already terminalized — do not overwrite with rejected-apply stages.
    if (
      this.draft.earlyNoOpPreflightPassed === true
      && !applied
      && (
        this.draft.finalDecisionKind === 'semantic_noop'
        || this.draft.finalDecisionKind === 'exact_noop'
        || this.draft.preflightNoOpDetected === true
      )
    ) {
      this.patch({
        countedAsSuccess: false,
        usageCountAfter: usageAfter,
        visibleApplySucceeded: false,
        visibleTextareaMatchesFinalNormalizedHash: null,
        visibleDescriptionMatchesFinalHash: null,
        finalTypedFailureReason: null,
        rejectionStage: null,
      });
      return;
    }
    let visibleMatch: boolean | null = this.draft.visibleTextareaMatchesFinalNormalizedHash ?? null;
    if (options?.visibleDescription != null && options?.finalNormalizedText != null) {
      visibleMatch = fingerprintText(options.visibleDescription)
        === fingerprintText(options.finalNormalizedText);
    } else if (applied && this.draft.normalizedBulletsUsedForApply) {
      visibleMatch = true;
    } else if (applied && this.draft.finalNormalizedHash) {
      // Successful apply without explicit compare text still must not leave null
      // when finalize already stamped a final hash (verify via same hash presence).
      visibleMatch = this.draft.visibleTextareaMatchesFinalNormalizedHash === true
        ? true
        : (typeof this.draft.visibleTextareaMatchesFinalNormalizedHash === 'boolean'
          ? this.draft.visibleTextareaMatchesFinalNormalizedHash
          : true);
    } else if (applied) {
      // Success path without verification inputs is invalid → typed false for invariants.
      visibleMatch = visibleMatch === true ? true : false;
    } else if (!applied) {
      // Terminal failure: null is allowed when no visible apply was attempted.
      visibleMatch = null;
    }
    this.patch({
      countedAsSuccess: applied,
      usageCountAfter: usageAfter,
      visibleApplySucceeded: applied,
      visibleTextareaMatchesFinalNormalizedHash: visibleMatch,
      visibleDescriptionMatchesFinalHash: visibleMatch,
      // AAB-329: committed apply fields only when visible apply succeeds.
      ...(applied
        ? {
          applyCommitted: true,
          applyAuthorized: this.draft.applyAuthorized ?? true,
          applyAttempted: true,
          applyWriteSucceeded: true,
          visibleValidationAttempted: true,
          visibleValidationPassed: true,
          targetContentApplied: true,
          contentLocaleUpdatedAfterApply: true,
          translationFallbackApplied: Boolean(
            this.draft.translationFallbackSelected
            || this.draft.translationFallbackAttempted
            || (
              (
                this.draft.clientDeterministicFallbackSelected
                || this.draft.clientDeterministicFallbackUsedForFinalCandidate
                || this.draft.clientDeterministicFallbackApplied
              )
              && this.draft.crossLocaleOperation
            )
          ),
          clientDeterministicFallbackApplied: Boolean(
            this.draft.clientDeterministicFallbackSelected
            || this.draft.clientDeterministicFallbackUsedForFinalCandidate
            || this.draft.finalCandidateSource === 'deterministic_fallback'
          ),
          // Post-commit applied locale = re-read patch or requested target.
          // Never retain pre-apply entryGeneratedLocaleBeforeApply / German snapshot.
          appliedVisibleContentLocale:
            this.draft.appliedVisibleContentLocale
            || this.draft.requestedTargetLocale
            || this.draft.requestedLocale
            || null,
          appliedExperienceEntryIdHash:
            this.draft.appliedExperienceEntryIdHash
            || this.draft.selectedExperienceEntryIdHash
            || this.draft.clickedExperienceEntryIdHash
            || null,
          appliedEmploymentState:
            this.draft.appliedEmploymentState
            || this.draft.payloadEmploymentState
            || this.draft.clickedEmploymentState
            || null,
          appliedFinalBulletCount:
            Number(this.draft.appliedFinalBulletCount || 0) > 0
              ? Number(this.draft.appliedFinalBulletCount)
              : Number(
                this.draft.finalCandidateBulletCount
                ?? this.draft.finalBulletCount
                ?? 0,
              ),
          appliedFinalBulletScripts:
            (this.draft.appliedFinalBulletScripts
              && this.draft.appliedFinalBulletScripts.length > 0)
              ? this.draft.appliedFinalBulletScripts
              : (
                this.draft.finalCandidateBulletScripts
                || this.draft.finalBulletScripts
                || []
              ),
          // Do not force AAB-329 postapply completeness on legacy sessions.
          postapplyDiagnosticCompletenessPassed:
            typeof this.draft.preapplyDiagnosticCompletenessPassed === 'boolean'
              ? true
              : this.draft.postapplyDiagnosticCompletenessPassed,
        }
        : {
          applyCommitted: false,
          targetContentApplied: false,
          contentLocaleUpdatedAfterApply: false,
          translationFallbackApplied: false,
          // Rollback / failed visible apply must not claim target locale.
          appliedVisibleContentLocale: null,
          appliedExperienceEntryIdHash: null,
          appliedEmploymentState: null,
          appliedFinalBulletCount: 0,
          appliedFinalBulletScripts: [],
        }),
    });
    this.stage('visible_apply', applied ? 'ok' : 'fail', applied ? undefined : 'not_applied');
    if (applied) {
      this.stage('apply_committed', 'ok');
    }
    this.stage(
      'usage_increment',
      applied ? 'ok' : 'skipped',
      applied ? undefined : 'no_increment_on_reject',
    );
  }

  async resolveVersions(): Promise<void> {
    const info = await resolveAppVersionInfo();
    this.patch({
      appVersionCode: info.versionCode,
      appVersionName: info.versionName,
      nextBuildId: this.draft.nextBuildId || resolveNextBuildId(),
    });
  }

  commit(): ExperienceAiDiagnosticTrace {
    if (this.committedTrace) return this.committedTrace;
    const apiBase = getApiBaseUrl();
    const identity = buildCvAiDiagnosticBuildIdentity({
      assetRevision: INTERNAL_AI_RESET_ENABLED
        ? CV_AI_DIAGNOSTICS_V2_299_REVISION
        : null,
      apiBaseUrlConfigured: Boolean(apiBase),
      capacitorServerUrlConfigured: false,
      apiHostClass: classifyApiHostClass(apiBase),
      internalBuildContractUsed: INTERNAL_AI_RESET_ENABLED ? true : false,
    });
    const base = {
      ...this.draft,
      stages: [...this.stages],
      ...identity,
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      cvAiDiagnosticsV2299Revision: CV_AI_DIAGNOSTICS_V2_299_REVISION,
      operationKind: 'experience' as const,
      // Local-owned stable marker — never leave empty after metadata merges.
      marker: EXPERIENCE_AI_DIAG_MARKER,
      visibleDescriptionMatchesFinalHash:
        this.draft.visibleDescriptionMatchesFinalHash
        ?? this.draft.visibleTextareaMatchesFinalNormalizedHash
        ?? null,
    };

    // AAB-329: never overwrite a failed pre-apply completeness decision.
    const preapplyCompletenessLocked = this.draft.preapplyDiagnosticCompletenessPassed;
    const preapplyInvariantLocked = this.draft.preapplyDiagnosticInvariantCheckPassed;
    let postapplyCompletenessPassed: boolean | null =
      this.draft.postapplyDiagnosticCompletenessPassed ?? null;
    let postapplyMissing: string[] =
      (this.draft.postapplyMissingRequiredDiagnosticFields as string[] | undefined) || [];
    let postapplyNullish: string[] =
      (this.draft.postapplyNullRequiredDiagnosticFields as string[] | undefined) || [];

    const aab329PreapplyEvaluated = typeof preapplyCompletenessLocked === 'boolean';

    const postapplyAttempted = this.draft.applyAttempted === true
      && this.draft.visibleValidationAttempted === true;
    if (postapplyAttempted && preapplyCompletenessLocked === true) {
      const post = checkExperiencePostapplyDiagnosticCompleteness(
        base as Record<string, unknown>,
      );
      postapplyCompletenessPassed = post.passed;
      postapplyMissing = post.missingRequiredDiagnosticFields;
      postapplyNullish = post.nullRequiredDiagnosticFields;
    } else if (preapplyCompletenessLocked === false) {
      postapplyCompletenessPassed = null;
    }

    const invariants = checkExperienceDiagnosticInvariants(base);
    // Only enforce AAB-329 preapply invariants when that phase actually ran.
    const preapplyInv = typeof preapplyInvariantLocked === 'boolean'
      ? {
        passed: preapplyInvariantLocked,
        failures: this.draft.preapplyDiagnosticInvariantFailures || [],
      }
      : { passed: true, failures: [] as Array<{
        invariantCode: string;
        observed: Record<string, string | number | boolean | null>;
      }> };
    const combinedInvariantPassed = preapplyInv.passed && invariants.passed
      && (this.draft.postapplyDiagnosticInvariantCheckPassed !== false);
    const withInvariants = {
      ...base,
      diagnosticInvariantCheckPassed: combinedInvariantPassed,
      diagnosticInvariantFailureCount:
        (preapplyInv.failures?.length || 0) + invariants.failures.length,
      diagnosticInvariantFailures: [
        ...(Array.isArray(preapplyInv.failures) ? preapplyInv.failures : []),
        ...invariants.failures,
      ],
      preapplyDiagnosticInvariantCheckPassed:
        typeof preapplyInvariantLocked === 'boolean' ? preapplyInv.passed : null,
    };

    let completenessPassed: boolean;
    let missingFields: string[];
    let nullFields: string[];
    if (preapplyCompletenessLocked === false) {
      completenessPassed = false;
      missingFields = (this.draft.preapplyMissingRequiredDiagnosticFields as string[] | undefined)
        || (this.draft.missingRequiredDiagnosticFields as string[] | undefined)
        || [];
      nullFields = (this.draft.preapplyNullRequiredDiagnosticFields as string[] | undefined)
        || (this.draft.nullRequiredDiagnosticFields as string[] | undefined)
        || [];
    } else if (aab329PreapplyEvaluated && postapplyAttempted) {
      completenessPassed = combineExperienceDiagnosticCompleteness({
        preapplyPassed: true,
        postapplyPassed: postapplyCompletenessPassed,
        postapplyApplicable: true,
      });
      missingFields = postapplyMissing;
      nullFields = postapplyNullish;
    } else if (
      this.draft.finalTypedFailureReason === 'diagnostic_completeness_failed'
      || this.draft.finalTypedFailureReason === 'diagnostic_invariant_failed'
      || this.draft.rejectionStage === 'diagnostic_preapply_gate'
    ) {
      completenessPassed = false;
      missingFields = (this.draft.preapplyMissingRequiredDiagnosticFields as string[] | undefined)
        || [];
      nullFields = (this.draft.preapplyNullRequiredDiagnosticFields as string[] | undefined)
        || [];
    } else {
      // Legacy / clean-noop / non-AAB-329 paths: original completeness contract.
      const completeness = checkExperienceDiagnosticCompleteness(
        withInvariants as Record<string, unknown>,
      );
      completenessPassed = completeness.passed;
      missingFields = completeness.missingRequiredDiagnosticFields;
      nullFields = completeness.nullRequiredDiagnosticFields;
    }

    const withCompleteness = {
      ...withInvariants,
      preapplyDiagnosticCompletenessPassed:
        preapplyCompletenessLocked ?? this.draft.preapplyDiagnosticCompletenessPassed ?? null,
      postapplyDiagnosticCompletenessPassed: postapplyCompletenessPassed,
      postapplyMissingRequiredDiagnosticFields: postapplyMissing,
      postapplyNullRequiredDiagnosticFields: postapplyNullish,
      diagnosticCompletenessPassed: completenessPassed,
      missingRequiredDiagnosticFields: missingFields,
      nullRequiredDiagnosticFields: nullFields,
      experiencePhasedDiagnosticCompletenessRevision:
        EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION,
      experienceTransactionalApplyTruthRevision:
        EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION,
      experienceSelectedFinalCoverageRevision:
        this.draft.experienceSelectedFinalCoverageRevision
        || EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION,
    };
    const privacy = assertCvAiDiagnosticPrivacy(withCompleteness);
    const sized = maybeTruncateDiagnosticPayload({
      ...withCompleteness,
      diagnosticPrivacyViolations: privacy,
      privacyCheckPassed: privacy.length === 0,
    } as Record<string, unknown>);
    const trace = sized as unknown as ExperienceAiDiagnosticTrace;
    this.committedTrace = trace;
    persistExperienceAiDiagnostic(trace);
    try {
      appendCvAiDiagnosticHistory({
        timestamp: trace.capturedAt || new Date().toISOString(),
        requestIdHash: trace.requestIdHash || '',
        operationKind: 'experience',
        operationMode: trace.operationMode,
        targetLocale: trace.requestedLocale,
        success: Boolean(trace.countedAsSuccess),
        finalCandidateSource: trace.finalCandidateSource,
        finalTypedFailureReason: trace.finalTypedFailureReason,
        invariantPassed: Boolean(trace.diagnosticInvariantCheckPassed),
        completenessPassed: Boolean(trace.diagnosticCompletenessPassed),
        usageCountBefore: trace.usageCountBefore,
        usageCountAfter: trace.usageCountAfter,
      });
    } catch {
      /* ignore */
    }
    try {
      emitCvAiDiagnosticsChanged({ kind: 'experience', action: 'commit' });
    } catch {
      /* ignore */
    }
    return trace;
  }
}

function persistExperienceAiDiagnostic(trace: ExperienceAiDiagnosticTrace): void {
  latestTrace = trace;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(EXPERIENCE_AI_DIAG_STORAGE_KEY, JSON.stringify(trace));
  } catch {
    /* quota — keep in-memory */
  }
}

function readStoredExperienceAiDiagnostic(): ExperienceAiDiagnosticTrace | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExperienceAiDiagnosticTrace;
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function getLatestExperienceAiDiagnostic(): ExperienceAiDiagnosticTrace | null {
  return latestTrace || readStoredExperienceAiDiagnostic();
}

export function formatExperienceAiDiagnosticForCopy(trace: ExperienceAiDiagnosticTrace): string {
  return `${JSON.stringify(trace, null, 2)}\n`;
}

export function assertExperienceAiDiagnosticHasNoCvText(
  trace: ExperienceAiDiagnosticTrace,
): string[] {
  const json = JSON.stringify(trace);
  const violations: string[] = [];
  if (/[\u0900-\u097F]{12,}/.test(json)) violations.push('devanagari_prose');
  if (/\p{Script=Cyrillic}{12,}/u.test(json)) violations.push('cyrillic_prose');
  if (/"fullName"|"email"|"phone"|"company"|Atlas|ana@example|Koordinatorka/i.test(json)) {
    violations.push('pii_field');
  }
  if (/Pregledam pristigle|Review incoming field reports/i.test(json)) {
    violations.push('raw_duty_text');
  }
  return violations;
}

export async function copyExperienceAiDiagnosticsToClipboard(): Promise<boolean> {
  const trace = getLatestExperienceAiDiagnostic();
  if (!trace) return false;
  const text = formatExperienceAiDiagnosticForCopy(trace);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function clearExperienceAiDiagnosticsForTests(): void {
  latestTrace = null;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Clear Experience diagnostics only — does not reset AI usage. */
export function clearExperienceAiDiagnostics(): void {
  clearExperienceAiDiagnosticsForTests();
  try {
    emitCvAiDiagnosticsChanged({ kind: 'experience', action: 'clear_latest' });
  } catch {
    /* ignore */
  }
}

/** Summary lines for the internal diagnostics modal (non-PII). */
export function summarizeExperienceAiDiagnostic(
  trace: ExperienceAiDiagnosticTrace | null,
): {
  timestamp: string;
  locale: string;
  finalStage: string;
  typedFailureReason: string;
  sourceUnitCount: number;
  requiredCovered: string;
  providerFallbackCounts: string;
  finalScripts: string;
  countedAsSuccess: boolean;
  finalCandidateSource: string | null;
  invariantPassed: boolean | null;
  completenessPassed: boolean | null;
  success: boolean;
  operationKind: string;
} | null {
  if (!trace) return null;
  const failed = [...trace.stages].reverse().find((s) => s.result === 'fail');
  return {
    timestamp: trace.capturedAt,
    locale: trace.requestedLocale,
    finalStage: failed?.stage
      || trace.rejectionStage
      || (trace.countedAsSuccess ? 'visible_apply' : 'unknown'),
    typedFailureReason: trace.finalTypedFailureReason
      || (trace.countedAsSuccess ? 'none' : 'unknown'),
    sourceUnitCount: trace.sourceUnitCount,
    requiredCovered: `${trace.requiredFactCount}/${trace.coveredFactCount}`,
    providerFallbackCounts: `${trace.providerBulletCount}/${trace.fallbackBulletCount}`,
    finalScripts: (trace.finalBulletScripts || []).join(',') || 'none',
    countedAsSuccess: trace.countedAsSuccess,
    finalCandidateSource: trace.finalCandidateSource,
    invariantPassed: trace.diagnosticInvariantCheckPassed ?? null,
    completenessPassed: trace.diagnosticCompletenessPassed ?? null,
    success: Boolean(trace.countedAsSuccess),
    operationKind: 'experience',
  };
}
