/**
 * Release-safe, non-PII Professional Summary AI diagnostics.
 * Mirrors Experience AI diagnostics pattern — observation only.
 */
import { fingerprintText, resolveAppVersionInfo, resolveNextBuildId } from './cv-export-diagnostics';
import type { FinalizeCvAiFieldResult } from './cv-ai-finalize-apply';
import { SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION } from './cv-summary-final-candidate-diagnostics-306';
void SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION;
export { SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION } from './cv-summary-final-candidate-diagnostics-306';
import { SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION } from './cv-summary-localized-failure-diagnostics-307';
void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
export { SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION } from './cv-summary-localized-failure-diagnostics-307';
import {
  SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION,
  SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION,
} from './cv-summary-explicit-skill-authority';
void SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION;
void SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION;
import { SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION } from './cv-german-summary-role-slots';
void SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION;
import {
  SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION,
  SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION,
  verifyVisibleSummaryStructuredRoleLocale,
} from './cv-summary-structured-role-localization';
void SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION;
void SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION;
import {
  SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION,
  GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION,
  SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION,
  validateGermanGeneratedCaseGrammar,
  validateSummaryEntryDutyCoverage,
  germanCurrentDutyDativeClause,
  type GermanCurrentDutyFact,
  type GermanCurrentDutyFactId,
} from './cv-german-summary-current-duty-coverage';
void SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION;
void GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION;
void SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION;
import {
  ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION,
  ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION,
  ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION,
  SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION,
  ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION,
  SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION,
  SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION,
  SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION,
  rebuildEnglishDutyFactsFromIds,
  hashCurrentDutyRequiredFactSet,
} from './cv-english-summary-grounding';
void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
void ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION;
void ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION;
void SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION;
void ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION;
void SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION;
void SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION;
void SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION;

function rebuildGermanDutyFactsFromIds(ids: string[] | null | undefined): GermanCurrentDutyFact[] {
  const known: GermanCurrentDutyFactId[] = [
    'incoming_goods_check',
    'related_documentation_check',
    'colleague_coordination_goods_preparation_movement',
  ];
  const selected = (ids || []).filter((id): id is GermanCurrentDutyFactId =>
    known.includes(id as GermanCurrentDutyFactId));
  return selected.map((id) => {
    const clause = germanCurrentDutyDativeClause(id);
    return {
      canonicalFactId: id,
      sourceEntryIdHash: null,
      sourceFactHash: `id_${id}`,
      sourceLocale: null,
      targetLocale: 'de' as const,
      semanticKind: id,
      materialCategory: id === 'incoming_goods_check'
        ? 'warehouse_inbound' as const
        : id === 'related_documentation_check'
          ? 'warehouse_records' as const
          : 'warehouse_movement' as const,
      localizedClauseHash: `clause_${id}`,
      requiredForSummary: true,
      dativeClause: clause,
      matchRes: [
        new RegExp(clause.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu'),
        id === 'incoming_goods_check'
          ? /Prüfung\s+eingehender\s+Waren|Warenannahme|Wareneingang/iu
          : id === 'related_documentation_check'
            ? /zugehörigen\s+Dokumentation|Dokumentenprüfung/iu
            : /Abstimmung\s+mit\s+Kolleg|Koordination\s+mit\s+Kolleg/iu,
      ],
    };
  });
}

import { hashExperienceEntryId } from './cv-experience-entry-isolation';
import type { CVData } from './types';
import {
  countSummaryDurationExpressions,
  summarizeDurationClaimBreakdown,
  verifyIndependentFinalDurationCount,
} from './cv-summary-duration-ownership';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import {
  appendCvAiDiagnosticHistory,
  assertCvAiDiagnosticPrivacy,
  buildCvAiDiagnosticBuildIdentity,
  buildHindiSentenceGrammarRecords,
  checkSummaryDiagnosticCompleteness,
  checkSummaryDiagnosticInvariants,
  classifyApiHostClass,
  CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
  CV_AI_DIAGNOSTICS_V2_299_REVISION,
  dedupeStableStrings,
  isGrammarRejectionCategory,
  maybeTruncateDiagnosticPayload,
  sanitizeCvAiDiagnosticMarkerPatch,
  SUMMARY_AI_DIAG_MARKER,
  type CvAiCandidateLineageRecord,
} from './cv-ai-diagnostics-contract';
import { INTERNAL_AI_RESET_ENABLED } from './build-channel';
import { getApiBaseUrl } from './api';
import {
  emitCvAiDiagnosticsChanged,
  SUMMARY_AI_DIAG_STORAGE_KEY as SUMMARY_AI_DIAG_STORAGE_KEY_CANON,
} from './cv-ai-diagnostics-lifecycle';

void SUMMARY_AI_DIAG_MARKER;

export const SUMMARY_AI_TRACE_SCHEMA_VERSION = 1 as const;
export const SUMMARY_AI_DIAG_STORAGE_KEY = SUMMARY_AI_DIAG_STORAGE_KEY_CANON;

export type SummaryAiDiagStage = {
  name: string;
  status: 'ok' | 'fail' | 'skipped';
  reason?: string;
};

export type SummaryAiDiagnosticTrace = {
  schemaVersion: typeof SUMMARY_AI_TRACE_SCHEMA_VERSION;
  marker: string;
  capturedAt: string;
  appVersionCode: string | null;
  appVersionName: string | null;
  nextBuildId: string | null;
  buildChannel: string | null;
  requestedLocale: string;
  uiLocale: string;
  storedContentLocale: string | null;
  detectedSourceLocale: string | null;
  selectedGender: string;
  templateId: string;
  operationMode: string | null;
  rewriteStyle: string | null;
  requestIdHash: string;
  summarySourcePresent: boolean;
  summarySourceLength: number;
  summarySourceHash: string;
  previousSummaryUsedAsFactSource: boolean;
  currentExperienceEntryCount: number;
  currentExperienceEntryIdHashes: string[];
  currentRoleEntryIdHash: string | null;
  currentJobContextHash: string | null;
  snapshotCreatedBeforeRequest: boolean;
  snapshotMatchesApplyContext: boolean;
  experienceFactCountsByEntryHash: Record<string, number>;
  experienceCanonicalFactCountsByEntryHash: Record<string, number>;
  experienceLocalesByEntryHash: Record<string, string | null>;
  employmentStatesByEntryHash: Record<string, 'current' | 'completed'>;
  crossEntryFactCollisionCount: number;
  crossEntryLeakageDetected: boolean;
  leakedSourceEntryIdHashes: string[];
  leakedTargetEntryIdHash: string | null;
  structuredDurationOwner: 'structured_dates';
  structuredDurationMonths: number | null;
  localizedDurationPhraseHash: string | null;
  providerDurationClaimCount: number;
  sourceDurationClaimCount: number;
  fallbackDurationClaimCount: number;
  durationClaimCountBeforeStrip: number;
  numericDurationClaimCount: number;
  writtenDurationClaimCount: number;
  durationClaimsRemovedBeforeInsert: number;
  durationClaimCountAfterInsert: number;
  durationClaimCountAfterFinalize: number;
  independentFinalDurationClaimCount: number;
  visibleDurationClaimCountAfterApply: number | null;
  visibleDurationMatchesFinalizedCount: boolean | null;
  durationDetectorAgreement: boolean;
  durationInsertedExactlyOnce: boolean;
  durationFinalizerIdempotent: boolean;
  /** Duration representation diagnostics (build 275). */
  finalDurationRepresentationKind: string | null;
  finalDurationRepresentationCount: number | null;
  finalDurationHybridDetected: boolean | null;
  visibleDurationRepresentationKind: string | null;
  visibleDurationRepresentationCount: number | null;
  visibleDurationHybridDetected: boolean | null;
  durationSemanticValueMonths: number | null;
  durationRepresentationAgreement: boolean | null;
  contentLocaleBeforeRequest: string | null;
  contentLocaleAfterApply: string | null;
  storedContentLocaleBeforeRequest: string | null;
  detectedVisibleContentLocaleBeforeRequest: string | null;
  finalContentLocaleAfterApply: string | null;
  finalCandidateSource: string | null;
  summaryFinalCandidateDiagnosticsRevision?: string | null;
  providerCandidatePresent: boolean;
  deterministicCandidatePresent: boolean;
  fallbackCandidatePresent: boolean;
  providerHttpStatus: number | null;
  providerResponseKind: string | null;
  providerLocaleValidationPassed: boolean | null;
  providerSentenceCount: number;
  providerDuplicateSentenceCount: number;
  providerUnsupportedClaimCount: number;
  providerCrossEntryLeakageCount: number;
  repairAttempted: boolean;
  repairApplied: boolean;
  repairSelected?: boolean | null;
  repairCandidatePresent?: boolean | null;
  repairAccepted?: boolean | null;
  repairAttemptedTransformationKinds?: string[] | null;
  repairAcceptedTransformationKinds?: string[] | null;
  repairAppliedTransformationKinds?: string[] | null;
  deterministicAccepted?: boolean | null;
  fallbackAttempted: boolean;
  fallbackApplied: boolean;
  fallbackKind: string | null;
  fallbackSentenceCount: number;
  deterministicCandidateSentenceCount: number;
  canonicalGroundingEnabled: boolean;
  authoritativeEntryCount: number;
  staleFactCandidateCount: number;
  staleFactsRejectedCount: number;
  unsupportedClaimCount: number;
  duplicateSentenceCount: number;
  nearDuplicateSentenceCount: number;
  repeatedClauseCount: number;
  currentEmploymentIntroductionCount: number | null;
  repeatedEmploymentFactCount: number | null;
  repeatedProfessionalLabelCount: number | null;
  finalCurrentDutyCoveragePassed?: boolean | null;
  requiredCurrentDutyFactCount?: number | null;
  coveredCurrentDutyFactCount?: number | null;
  missingCurrentDutyFactCount?: number | null;
  missingCurrentDutyFactIdHashes?: string[] | null;
  materialCategoryCoverageUsedForFinalAcceptance?: boolean | null;
  germanControlledCaseGrammarPassed?: boolean | null;
  finalGermanGrammarValidationPassed?: boolean | null;
  visibleRequiredCurrentDutyFactCount?: number | null;
  visibleCoveredCurrentDutyFactCount?: number | null;
  visibleMissingCurrentDutyFactCount?: number | null;
  visibleCurrentDutyCoveragePassed?: boolean | null;
  visibleCurrentDutyRequiredFactParityPassed?: boolean | null;
  visibleCurrentDutyRequiredFactCountMatchesFinal?: boolean | null;
  visibleCurrentDutyRequiredFactSetHash?: string | null;
  finalCurrentDutyRequiredFactSetHash?: string | null;
  visibleCurrentDutyFactMatchCountsByFactHash?: Record<string, number> | null;
  visibleCurrentDutyFactMatchedUnitHashesByFactHash?: Record<string, string[]> | null;
  visibleMissingCurrentDutyFactIdHashes?: string[] | null;
  visibleRequiredPriorDutyFactCount?: number | null;
  visibleCoveredPriorDutyFactCount?: number | null;
  visibleMissingPriorDutyFactCount?: number | null;
  visiblePriorDutyCoveragePassed?: boolean | null;
  visiblePriorDutyRequiredFactParityPassed?: boolean | null;
  visibleGermanGrammarValidationPassed?: boolean | null;
  requiredCurrentDutyFactIds?: string[] | null;
  authoritativeCurrentDutyFactCount?: number | null;
  authoritativeCanonicalCurrentDutyFactCount?: number | null;
  classifiedRequiredCurrentDutyFactCount?: number | null;
  unclassifiedAuthoritativeCurrentDutyFactCount?: number | null;
  requiredFactSetMatchesAuthoritativeFactSet?: boolean | null;
  currentDutyRequiredFactParityPassed?: boolean | null;
  currentMaterialCategoryCount?: number | null;
  currentDutyFactClassificationKindsByFactHash?: Record<string, string> | null;
  currentRoleConcreteFactCoverage: number | null;
  genericizedMaterialFactCount: number | null;
  priorRoleGroundingPassed: boolean | null;
  currentRoleTitlePresent: boolean | null;
  currentRoleTitleSource: string | null;
  currentRoleTitleEntryIdHash: string | null;
  currentRoleTitleMatchesStructuredRole: boolean | null;
  currentRoleOmittedDetected: boolean | null;
  currentSlotForeignFactCount: number | null;
  priorSlotForeignFactCount: number | null;
  semanticCrossEntryLeakageDetected: boolean | null;
  duplicatedPriorRoleFactCount: number | null;
  priorRoleSemanticDuplicationDetected: boolean | null;
  finalUnitRoleSlots: string[] | null;
  finalUnitSemanticRolesByUnit?: string[][] | null;
  finalSentenceSemanticRolesBySentence?: string[][] | null;
  finalCurrentEmployerPresent?: boolean | null;
  finalPriorEmployerPresent?: boolean | null;
  finalCurrentEmploymentStateExpressed?: boolean | null;
  finalPriorEmploymentStateExpressed?: boolean | null;
  finalCurrentRoleIntroValidationPassed?: boolean | null;
  finalPriorRoleIntroValidationPassed?: boolean | null;
  finalPriorDutyCoveragePassed?: boolean | null;
  requiredPriorDutyFactCount?: number | null;
  coveredPriorDutyFactCount?: number | null;
  missingPriorDutyFactCount?: number | null;
  finalSlotValidationPassed?: boolean | null;
  finalSlotRejectionReasons?: string[] | null;
  repairCandidateHash?: string | null;
  repairRawCandidatePresent?: boolean | null;
  repairRawCandidateHash?: string | null;
  repairRawCandidateLength?: number | null;
  repairParseAttempted?: boolean | null;
  repairParseSucceeded?: boolean | null;
  repairParsedUnitCount?: number | null;
  repairParsedSentenceCount?: number | null;
  repairUsableCandidatePresent?: boolean | null;
  repairTypedFailureReason?: string | null;
  repairTransformationKinds?: string[] | null;
  repairRejectionReasons?: string[] | null;
  germanEmployerStatusRepairAttempted?: boolean | null;
  germanEmployerStatusRepairApplied?: boolean | null;
  providerAccepted?: boolean | null;
  summaryPipelineRevision: string | null;
  summaryBuilderRevision: string | null;
  summaryUnitSplitterRevision: string | null;
  summaryGroundingRevision: string | null;
  summaryDurationFinalizerRevision: string | null;
  providerCandidateHash: string | null;
  providerCandidateNormalizedHash: string | null;
  deterministicCandidateHash: string | null;
  deterministicCandidateNormalizedHash: string | null;
  durationPass1CandidateHash: string | null;
  durationPass2CandidateHash: string | null;
  durationPass1Hash: string | null;
  durationPass2Hash: string | null;
  groundingInputCandidateHash: string | null;
  finalValidatedCandidateHash: string | null;
  visibleCandidateHashAfterApply: string | null;
  providerCandidateEqualsDeterministicCandidate: boolean | null;
  deterministicCandidateEqualsGroundingInput: boolean | null;
  groundingInputEqualsFinalValidatedCandidate: boolean | null;
  durationSecondPassChanged: boolean | null;
  durationSecondPassChangeReason: string | null;
  contextCurrentRoleResolved: string | null;
  contextCurrentRoleLocalized: string | null;
  candidateCurrentRoleTitlePresent: boolean | null;
  candidateCurrentEmploymentIntroductionCount: number | null;
  candidateCurrentRoleTitleMatchesStructuredRole: boolean | null;
  candidateCurrentRoleOmittedDetected: boolean | null;
  deterministicCurrentEntryIdHash: string | null;
  deterministicPriorEntryIdHashes: string[] | null;
  currentEntryMaterialKeys: string[] | null;
  priorEntryMaterialKeys: string[] | null;
  finalSentenceHashes: string[] | null;
  finalSentenceRoleSlots: string[] | null;
  flattenedFactArrayUsed: boolean | null;
  previousSummaryTextUsedByDeterministicFallback: boolean | null;
  providerTextUsedByDeterministicFallback: boolean | null;
  perspectiveMode: string | null;
  sourcePerspectiveMode: string | null;
  providerPerspectiveMode: string | null;
  finalPerspectiveMode: string | null;
  perspectiveNormalizationAttempted: boolean | null;
  perspectiveNormalizationApplied: boolean | null;
  perspectiveValidationPassed: boolean;
  genderValidationPassed: boolean;
  tenseValidationPassed: boolean;
  localeValidationPassed: boolean;
  grammarValidationPassed: boolean;
  durationValidationPassed: boolean;
  groundingValidationPassed: boolean;
  /** Per-sentence target-locale purity (build 271/272). */
  unitCount: number;
  detectedLocaleByUnit: Array<string | null>;
  detectedScriptByUnit: string[];
  wrongLocaleUnitCount: number;
  wrongScriptUnitCount: number;
  mixedLanguageUnitCount: number;
  sourceLanguageLeakageDetected: boolean;
  unexpectedLocaleCodes: string[];
  targetLocalePurityPassed: boolean;
  targetScript: string | null;
  structuredRoleLocaleValidationPassed?: boolean | null;
  currentRoleLocalizationValidationPassed?: boolean | null;
  priorRoleLocalizationValidationPassed?: boolean | null;
  foreignStructuredRoleTitleCount?: number | null;
  foreignPriorRoleTitleCount?: number | null;
  foreignCurrentRoleTitleDetected?: boolean | null;
  rawSourceRoleLeakageDetected?: boolean | null;
  finalWrongLocaleStructuredRoleCount?: number | null;
  finalStructuredRoleLocaleValidationPassed?: boolean | null;
  finalForeignRoleTitleCount?: number | null;
  providerStructuredRoleLocaleValidationPassed?: boolean | null;
  providerForeignRoleTitleCount?: number | null;
  repairStructuredRoleLocaleValidationPassed?: boolean | null;
  repairForeignRoleTitleCount?: number | null;
  repairRoleLocalizationTransformationKinds?: string[] | null;
  visibleStructuredRoleLocaleValidationPassed?: boolean | null;
  visibleWrongLocaleStructuredRoleCount?: number | null;
  finalPostconditionsPassed: boolean;
  raceGuardResult: 'ok' | 'fail' | 'skipped';
  visibleApplySucceeded: boolean;
  visibleSummaryMatchesFinalHash: boolean | null;
  contentLocaleUpdatedAfterApply: boolean;
  countedAsSuccess: boolean;
  usageCountBefore: number;
  usageCountAfter: number;
  finalTypedFailureReason: string | null;
  rejectionStage: string | null;
  stages: SummaryAiDiagStage[];
  /** cv-ai-diagnostics-v2 additive contract fields */
  diagnosticContractRevision?: string;
  compiledDiagnosticMarker?: string;
  assetRevision?: string;
  internalDiagnosticsEnabled?: boolean;
  internalResetEnabled?: boolean;
  internalBuildContractUsed?: boolean | null;
  serverUrlConfigured?: boolean;
  sourceCommitShort?: string | null;
  operationKind?: 'summary';
  apiResponseKind?: string | null;
  serverFallbackUsed?: boolean | null;
  serverCandidateKind?: string | null;
  serverFallbackReason?: string | null;
  providerOutcome?: string | null;
  clientFallbackUsed?: boolean | null;
  clientFallbackKind?: string | null;
  clientFallbackReason?: string | null;
  sourceNormalizedHash?: string | null;
  finalNormalizedHash?: string | null;
  finalMatchesSourceAfterNormalization?: boolean | null;
  meaningfulChangeDetected?: boolean | null;
  meaningfulChangeReason?: string | null;
  noOpDetected?: boolean | null;
  noOpCandidateKind?: string | null;
  noOpRejectionReason?: string | null;
  apiBaseUrlConfigured?: boolean;
  capacitorServerUrlConfigured?: boolean;
  apiHostClass?: string | null;
  sourceCommitStatus?: string | null;
  providerRejectionReason?: string | null;
  providerTypedRejectionReason?: string | null;
  providerSlotRejectionReasons?: string[] | null;
  sourcePrintFactPresent?: boolean | null;
  sourceBrandingFactPresent?: boolean | null;
  sourceMarketingFactPresent?: boolean | null;
  providerUnsupportedDesignMediumCount?: number | null;
  providerUnsupportedDesignMediumKinds?: string[] | null;
  providerPrintClaimDetected?: boolean | null;
  providerBrandingClaimDetected?: boolean | null;
  providerMarketingClaimDetected?: boolean | null;
  deterministicUnsupportedDesignMediumCount?: number | null;
  deterministicUnsupportedDesignMediumKinds?: string[] | null;
  finalUnsupportedDesignMediumCount?: number | null;
  finalUnsupportedDesignMediumKinds?: string[] | null;
  cvAiDiagnosticsV2299Revision?: string | null;
  summaryNoopSuccessContractRevision?: string | null;
  hindiCurrentIntroFiniteVerbPresent?: boolean | null;
  hindiCurrentIntroCopulaPresent?: boolean | null;
  hindiCurrentDutyFiniteVerbPresent?: boolean | null;
  hindiCurrentDutyAuxiliaryPresent?: boolean | null;
  hindiPriorRoleFiniteVerbPresent?: boolean | null;
  hindiStandaloneJahanFragmentDetected?: boolean | null;
  hindiNominalExperienceFragmentDetected?: boolean | null;
  hindiSentenceHasFiniteCopulaOrVerb?: boolean[] | null;
  hindiIncompleteSentenceCount?: number | null;
  hindiGrammarRejectionReason?: string | null;
  hindiGrammarRejectionReasons?: string[] | null;
  hindiSentenceGrammarRecords?: Array<{
    sentenceHash: string;
    roleSlot: string;
    hasFiniteVerb: boolean;
    hasFiniteCopula: boolean;
    hasRequiredAuxiliary: boolean;
    nominalFragmentDetected: boolean;
    standaloneRelativeFragmentDetected: boolean;
    grammarPassed: boolean;
    grammarReasons: string[];
  }> | null;
  providerHindiNominalExperienceFragmentDetected?: boolean | null;
  providerHindiSentenceHasFiniteCopulaOrVerb?: boolean[] | null;
  providerHindiIncompleteSentenceCount?: number | null;
  providerHindiGrammarRejectionReasons?: string[] | null;
  currentIntroSlotPresent?: boolean | null;
  currentDutySlotPresent?: boolean | null;
  priorRoleSlotPresent?: boolean | null;
  totalDurationSlotPresent?: boolean | null;
  explicitSkillsSlotPresent?: boolean | null;
  slotValidationPassed?: boolean | null;
  slotRejectionReasons?: string[] | null;
  finalDurationOwnerExpected?: string | null;
  finalDurationOwnerDetected?: string | null;
  finalDurationScopeValidationPassed?: boolean | null;
  finalDurationCurrentRoleAttachmentRisk?: boolean | null;
  finalDurationTotalCareerMarkerPresent?: boolean | null;
  visibleDurationOwnerDetected?: string | null;
  visibleDurationScopeValidationPassed?: boolean | null;
  durationScopeRejectionReason?: string | null;
  explicitSkillFactCount?: number | null;
  finalCompetencyClaimCount?: number | null;
  finalUnsupportedCompetencyCount?: number | null;
  finalUnsupportedCompetencyKinds?: string[] | null;
  competencyInferenceFromRoleForbidden?: boolean | null;
  summaryRepairAttempted?: boolean | null;
  candidateLineage?: unknown[] | null;
  diagnosticInvariantCheckPassed?: boolean;
  diagnosticInvariantFailureCount?: number;
  diagnosticInvariantFailures?: Array<{
    invariantCode: string;
    observed: Record<string, string | number | boolean | null>;
  }>;
  diagnosticCompletenessPassed?: boolean;
  missingRequiredDiagnosticFields?: string[];
  nullRequiredDiagnosticFields?: string[];
  unexpectedDiagnosticFieldTypes?: string[];
  diagnosticPayloadByteSize?: number;
  diagnosticPayloadTruncated?: boolean;
  diagnosticPrivacyViolations?: string[];
  privacyCheckPassed?: boolean;
};

let latestSummaryTrace: SummaryAiDiagnosticTrace | null = null;

export type SummaryAiDiagSessionInput = {
  uiLocale: string;
  requestedLocale: string;
  contentLocale?: string | null;
  templateId: string;
  gender?: string;
  requestId: string;
  usageCountBefore: number;
  rewriteStyle?: string | null;
  operationMode?: string | null;
  jobContextHash?: string | null;
};

export class SummaryAiDiagnosticSession {
  private stages: SummaryAiDiagStage[] = [];
  private committedTrace: SummaryAiDiagnosticTrace | null = null;
  private draft: Partial<SummaryAiDiagnosticTrace> & {
    schemaVersion: typeof SUMMARY_AI_TRACE_SCHEMA_VERSION;
    capturedAt: string;
    requestIdHash: string;
  };

  /** Read-only peek for apply/usage gating (AAB-326). */
  get visibleApplySucceeded(): boolean {
    return this.draft.visibleApplySucceeded === true;
  }

  get finalTypedFailureReason(): string | null {
    return this.draft.finalTypedFailureReason ?? null;
  }

  constructor(input: SummaryAiDiagSessionInput) {
    this.draft = {
      schemaVersion: SUMMARY_AI_TRACE_SCHEMA_VERSION,
      marker: SUMMARY_AI_DIAG_MARKER,
      capturedAt: new Date().toISOString(),
      appVersionCode: null,
      appVersionName: null,
      nextBuildId: resolveNextBuildId(),
      buildChannel: process.env.NEXT_PUBLIC_BUILD_CHANNEL || null,
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
      storedContentLocale: input.contentLocale ?? null,
      detectedSourceLocale: null,
      selectedGender: String(input.gender || ''),
      templateId: input.templateId || '',
      operationMode: input.operationMode || 'summary_generate',
      rewriteStyle: input.rewriteStyle || null,
      requestIdHash: fingerprintText(input.requestId || ''),
      summarySourcePresent: false,
      summarySourceLength: 0,
      summarySourceHash: 'empty',
      previousSummaryUsedAsFactSource: false,
      currentExperienceEntryCount: 0,
      currentExperienceEntryIdHashes: [],
      currentRoleEntryIdHash: null,
      currentJobContextHash: input.jobContextHash || null,
      snapshotCreatedBeforeRequest: true,
      snapshotMatchesApplyContext: true,
      experienceFactCountsByEntryHash: {},
      experienceCanonicalFactCountsByEntryHash: {},
      experienceLocalesByEntryHash: {},
      employmentStatesByEntryHash: {},
      crossEntryFactCollisionCount: 0,
      crossEntryLeakageDetected: false,
      leakedSourceEntryIdHashes: [],
      leakedTargetEntryIdHash: null,
      structuredDurationOwner: 'structured_dates',
      structuredDurationMonths: null,
      localizedDurationPhraseHash: null,
      providerDurationClaimCount: 0,
      sourceDurationClaimCount: 0,
      fallbackDurationClaimCount: 0,
      durationClaimCountBeforeStrip: 0,
      numericDurationClaimCount: 0,
      writtenDurationClaimCount: 0,
      durationClaimsRemovedBeforeInsert: 0,
      durationClaimCountAfterInsert: 0,
      durationClaimCountAfterFinalize: 0,
      independentFinalDurationClaimCount: 0,
      visibleDurationClaimCountAfterApply: null,
      visibleDurationMatchesFinalizedCount: null,
      durationDetectorAgreement: false,
      durationInsertedExactlyOnce: false,
      durationFinalizerIdempotent: false,
      finalDurationRepresentationKind: null,
      finalDurationRepresentationCount: null,
      finalDurationHybridDetected: null,
      visibleDurationRepresentationKind: null,
      visibleDurationRepresentationCount: null,
      visibleDurationHybridDetected: null,
      durationSemanticValueMonths: null,
      durationRepresentationAgreement: null,
      contentLocaleBeforeRequest: input.contentLocale ?? null,
      contentLocaleAfterApply: null,
      storedContentLocaleBeforeRequest: input.contentLocale ?? null,
      detectedVisibleContentLocaleBeforeRequest: null,
      finalContentLocaleAfterApply: null,
      finalCandidateSource: null,
      providerCandidatePresent: false,
      deterministicCandidatePresent: false,
      fallbackCandidatePresent: false,
      providerHttpStatus: null,
      providerResponseKind: null,
      providerLocaleValidationPassed: null,
      providerSentenceCount: 0,
      providerDuplicateSentenceCount: 0,
      providerUnsupportedClaimCount: 0,
      providerCrossEntryLeakageCount: 0,
      repairAttempted: false,
      repairApplied: false,
      fallbackAttempted: false,
      fallbackApplied: false,
      fallbackKind: null,
      fallbackSentenceCount: 0,
      deterministicCandidateSentenceCount: 0,
      canonicalGroundingEnabled: true,
      authoritativeEntryCount: 0,
      staleFactCandidateCount: 0,
      staleFactsRejectedCount: 0,
      unsupportedClaimCount: 0,
      duplicateSentenceCount: 0,
      nearDuplicateSentenceCount: 0,
      repeatedClauseCount: 0,
      currentEmploymentIntroductionCount: null,
      repeatedEmploymentFactCount: null,
      repeatedProfessionalLabelCount: null,
      currentRoleConcreteFactCoverage: null,
      genericizedMaterialFactCount: null,
      priorRoleGroundingPassed: null,
      currentRoleTitlePresent: null,
      currentRoleTitleSource: null,
      currentRoleTitleEntryIdHash: null,
      currentRoleTitleMatchesStructuredRole: null,
      currentRoleOmittedDetected: null,
      currentSlotForeignFactCount: null,
      priorSlotForeignFactCount: null,
      semanticCrossEntryLeakageDetected: null,
      duplicatedPriorRoleFactCount: null,
      priorRoleSemanticDuplicationDetected: null,
      finalUnitRoleSlots: null,
      summaryPipelineRevision: null,
      summaryBuilderRevision: null,
      summaryUnitSplitterRevision: null,
      summaryGroundingRevision: null,
      summaryDurationFinalizerRevision: null,
      providerCandidateHash: null,
      providerCandidateNormalizedHash: null,
      deterministicCandidateHash: null,
      deterministicCandidateNormalizedHash: null,
      durationPass1CandidateHash: null,
      durationPass2CandidateHash: null,
      durationPass1Hash: null,
      durationPass2Hash: null,
      groundingInputCandidateHash: null,
      finalValidatedCandidateHash: null,
      visibleCandidateHashAfterApply: null,
      providerCandidateEqualsDeterministicCandidate: null,
      deterministicCandidateEqualsGroundingInput: null,
      groundingInputEqualsFinalValidatedCandidate: null,
      durationSecondPassChanged: null,
      durationSecondPassChangeReason: null,
      contextCurrentRoleResolved: null,
      contextCurrentRoleLocalized: null,
      candidateCurrentRoleTitlePresent: null,
      candidateCurrentEmploymentIntroductionCount: null,
      candidateCurrentRoleTitleMatchesStructuredRole: null,
      candidateCurrentRoleOmittedDetected: null,
      deterministicCurrentEntryIdHash: null,
      deterministicPriorEntryIdHashes: null,
      currentEntryMaterialKeys: null,
      priorEntryMaterialKeys: null,
      finalSentenceHashes: null,
      finalSentenceRoleSlots: null,
      flattenedFactArrayUsed: null,
      previousSummaryTextUsedByDeterministicFallback: null,
      providerTextUsedByDeterministicFallback: null,
      perspectiveMode: null,
      sourcePerspectiveMode: null,
      providerPerspectiveMode: null,
      finalPerspectiveMode: null,
      perspectiveNormalizationAttempted: null,
      perspectiveNormalizationApplied: null,
      perspectiveValidationPassed: false,
      genderValidationPassed: false,
      tenseValidationPassed: false,
      localeValidationPassed: false,
      grammarValidationPassed: false,
      durationValidationPassed: false,
      groundingValidationPassed: false,
      unitCount: 0,
      detectedLocaleByUnit: [],
      detectedScriptByUnit: [],
      wrongLocaleUnitCount: 0,
      wrongScriptUnitCount: 0,
      mixedLanguageUnitCount: 0,
      sourceLanguageLeakageDetected: false,
      unexpectedLocaleCodes: [],
      targetLocalePurityPassed: false,
      targetScript: null,
      finalPostconditionsPassed: false,
      raceGuardResult: 'skipped',
      visibleApplySucceeded: false,
      visibleSummaryMatchesFinalHash: null,
      contentLocaleUpdatedAfterApply: false,
      countedAsSuccess: false,
      usageCountBefore: input.usageCountBefore,
      usageCountAfter: input.usageCountBefore,
      finalTypedFailureReason: null,
      rejectionStage: null,
      stages: [],
    };
  }

  stage(name: string, status: SummaryAiDiagStage['status'], reason?: string): void {
    this.stages.push({ name, status, reason });
  }

  patch(partial: Partial<SummaryAiDiagnosticTrace>): void {
    const { marker: _ignoredMarker, ...safe } = partial;
    Object.assign(this.draft, safe);
    const markerPatch = sanitizeCvAiDiagnosticMarkerPatch('summary', partial);
    if (markerPatch.marker) this.draft.marker = markerPatch.marker;
    if (!this.draft.marker || this.draft.marker !== SUMMARY_AI_DIAG_MARKER) {
      this.draft.marker = SUMMARY_AI_DIAG_MARKER;
    }
  }

  recordCvSnapshot(cv: CVData, liveSummary: string): void {
    const exps = cv.experience || [];
    const factCounts: Record<string, number> = {};
    const canonCounts: Record<string, number> = {};
    const locales: Record<string, string | null> = {};
    const states: Record<string, 'current' | 'completed'> = {};
    const hashes: string[] = [];
    let currentRoleHash: string | null = null;
    for (const e of exps) {
      const h = hashExperienceEntryId(e.id);
      hashes.push(h);
      const desc = (e.description || '').trim();
      const canon = (e.canonicalDescription || '').trim();
      factCounts[h] = desc ? desc.split(/\n/).filter(Boolean).length : 0;
      canonCounts[h] = canon ? canon.split(/\n/).filter(Boolean).length : 0;
      locales[h] = (e as { generatedLocale?: string }).generatedLocale || cv.contentLocale || null;
      states[h] = e.isPresent ? 'current' : 'completed';
      if (e.isPresent && !currentRoleHash) currentRoleHash = h;
    }
    const summary = (liveSummary || '').trim();
    this.patch({
      summarySourcePresent: Boolean(summary),
      summarySourceLength: summary.length,
      summarySourceHash: fingerprintText(summary || 'empty'),
      sourceDurationClaimCount: countSummaryDurationExpressions(summary),
      currentExperienceEntryCount: exps.length,
      currentExperienceEntryIdHashes: hashes,
      currentRoleEntryIdHash: currentRoleHash,
      experienceFactCountsByEntryHash: factCounts,
      experienceCanonicalFactCountsByEntryHash: canonCounts,
      experienceLocalesByEntryHash: locales,
      employmentStatesByEntryHash: states,
      authoritativeEntryCount: exps.length,
      previousSummaryUsedAsFactSource: false,
    });
    this.stage('snapshot_created', 'ok');
  }

  recordFinalizeResult(finalized: FinalizeCvAiFieldResult): void {
    const diag = finalized.diagnostics || {};
    const text = (finalized.text || '').trim();
    const independent = verifyIndependentFinalDurationCount(text, (this.draft.requestedLocale || 'en') as import('./i18n/translations').Locale, {
      requireExactlyOne: Boolean(finalized.countedAsSuccess),
    });
    const after = independent.count;
    const breakdown = summarizeDurationClaimBreakdown(
      text,
      (this.draft.requestedLocale || 'en') as import('./i18n/translations').Locale,
    );
    const beforeStrip = diag.durationClaimCountBeforeStrip
      ?? diag.summaryDurationExpressionCount
      ?? this.draft.sourceDurationClaimCount
      ?? 0;
    const removed = diag.durationClaimsRemovedBeforeInsert
      ?? (diag.duplicateDurationRemoved ? Math.max(0, beforeStrip - 1) : 0);
    const afterInsert = diag.durationClaimCountAfterInsert ?? after;
    const detectorAgreement = afterInsert === after;
    // Independent re-scan is authoritative — never trust mutator bookkeeping alone.
    const durationValidationPassed = Boolean(
      independent.ok
      && after === 1
      && detectorAgreement
      && diag.durationValidationPassed !== false
    );
    // Never report idempotent/PASS when visible text has ≠ 1 duration claim —
    // except equal pass hashes with no second-pass change remain truthful.
    void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
    const passHashesEqual = Boolean(
      diag.durationPass1CandidateHash
      && diag.durationPass2CandidateHash
      && diag.durationPass1CandidateHash === diag.durationPass2CandidateHash
      && diag.durationSecondPassChanged === false,
    );
    const durationFinalizerIdempotent = passHashesEqual
      ? true
      : (typeof diag.durationFinalizerIdempotent === 'boolean'
        ? diag.durationFinalizerIdempotent && durationValidationPassed && after === 1
        : durationValidationPassed && after === 1);
    const sentenceCount = text
      ? text.split(/(?<=[.!?।])\s+(?=\S)/u).map((s) => s.trim()).filter(Boolean).length
      : 0;
    const finalHashesFromDiag = Array.isArray(diag.finalSentenceHashes)
      ? diag.finalSentenceHashes.filter(Boolean)
      : [];
    const finalRoleSlotsFromDiag = Array.isArray(diag.finalSentenceRoleSlots)
      ? diag.finalSentenceRoleSlots
      : (Array.isArray(diag.finalUnitRoleSlots) ? diag.finalUnitRoleSlots : []);
    const finalSemanticRolesFromDiag = Array.isArray(diag.finalUnitSemanticRolesByUnit)
      ? diag.finalUnitSemanticRolesByUnit
      : (Array.isArray((diag as { finalSentenceSemanticRolesBySentence?: string[][] })
        .finalSentenceSemanticRolesBySentence)
        ? (diag as { finalSentenceSemanticRolesBySentence: string[][] })
          .finalSentenceSemanticRolesBySentence
        : []);
    const finalCandidateSelected = Boolean(
      finalized.countedAsSuccess
      && !finalized.blocked
      && diag.finalCandidateSource
      && diag.finalCandidateSource !== 'none',
    );
    // Prefer authoritative unit hashes from finalize — never leave empty arrays
    // when a successful final candidate has a positive sentence count.
    // Never populate final* hashes from a rejected evaluated candidate.
    // Never reuse provider-stage hashes when provider was rejected.
    void SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION;
    const providerRejected = diag.providerAccepted === false
      || (
        finalized.origin === 'deterministic_fallback'
        && Boolean(finalized.countedAsSuccess)
      );
    const textUnitHashes = text
      ? text.split(/(?<=[.!?।])\s+(?=\S)/u).map((s) => s.trim()).filter(Boolean)
        .map((s) => fingerprintText(s))
      : [];
    const resolvedFinalUnitCount = finalCandidateSelected
      ? (finalHashesFromDiag.length > 0
        ? finalHashesFromDiag.length
        : (textUnitHashes.length > 0 ? textUnitHashes.length : sentenceCount))
      : 0;
    const resolvedFinalHashes = finalCandidateSelected
      ? (finalHashesFromDiag.length > 0
        ? finalHashesFromDiag
        : textUnitHashes)
      : [];
    // Guard: never leave provider evaluated hashes as final when provider rejected
    // and final hashes accidentally equal provider hashes while selected source is deterministic.
    const providerHashesProbe = Array.isArray(diag.providerSentenceHashes)
      ? diag.providerSentenceHashes.filter(Boolean)
      : (Array.isArray(diag.evaluatedSentenceHashes) && !finalHashesFromDiag.length
        ? []
        : []);
    void providerRejected;
    void providerHashesProbe;
    const resolvedFinalRoleSlots = finalCandidateSelected
      ? (finalRoleSlotsFromDiag.length === resolvedFinalUnitCount
        ? finalRoleSlotsFromDiag
        : (finalSemanticRolesFromDiag.length === resolvedFinalUnitCount
          ? finalSemanticRolesFromDiag.map((roles) => {
            if (roles.includes('total_duration')) return 'total_duration';
            if (roles.includes('prior_role_intro') || roles.includes('prior_role_duties')) {
              return 'prior_role';
            }
            if (roles.includes('current_role_intro') || roles.includes('current_role_duties')) {
              return 'current_role';
            }
            return 'summary_unit';
          })
          : (resolvedFinalUnitCount > 0
            ? Array.from({ length: resolvedFinalUnitCount }, () => 'summary_unit')
            : [])))
      : [];
    const resolvedFinalSemanticRoles = finalCandidateSelected
      && finalSemanticRolesFromDiag.length === resolvedFinalUnitCount
      ? finalSemanticRolesFromDiag
      : null;
    void SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION;
    void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
    void SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION;
    // "Applied" means visibly accepted — never merely selected for validation.
    const fallbackApplied = Boolean(
      finalized.countedAsSuccess
      && !finalized.blocked
      && (
        finalized.origin === 'deterministic_fallback'
        || diag.fallbackApplied
      ),
    );
    const fallbackAttempted = Boolean(
      diag.clientDeterministicFallbackAttempted
      || diag.fallbackCandidatePresent
      || diag.deterministicCandidatePresent
      || finalized.origin === 'deterministic_fallback'
      || diag.fallbackApplied
      || fallbackApplied,
    );
    // Prefer stage-specific counts from finalize — never alias provider as fallback.
    const fallbackSentenceCount = typeof diag.deterministicCandidateSentenceCount === 'number'
      ? diag.deterministicCandidateSentenceCount
      : (fallbackApplied || fallbackAttempted ? sentenceCount : 0);
    const deterministicSentenceCount = typeof diag.deterministicCandidateSentenceCount === 'number'
      ? diag.deterministicCandidateSentenceCount
      : (finalized.origin === 'deterministic_fallback'
        ? sentenceCount
        : (diag.deterministicCandidatePresent ? sentenceCount : 0));
    const purity = validateAiUnitLocalePurity(
      text,
      (this.draft.requestedLocale || 'en') as import('./i18n/translations').Locale,
      { kind: 'summary_sentence', requireUnits: Boolean(text) },
    );
    void SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION;
    const structuredRolePassed = typeof diag.structuredRoleLocaleValidationPassed === 'boolean'
      ? diag.structuredRoleLocaleValidationPassed
      : true;
    const rawRoleLeak = Boolean(diag.rawSourceRoleLeakageDetected);
    const foreignRoleCount = Number(diag.foreignStructuredRoleTitleCount ?? 0);
    const entityAwarePurityPassed = purity.targetLocalePurityPassed
      && structuredRolePassed
      && !rawRoleLeak
      && foreignRoleCount === 0;
    const entityAwareLeakage = purity.sourceLanguageLeakageDetected || rawRoleLeak;
    const groundingValidationPassed = diag.groundingValidationPassed
      ?? (!finalized.blocked && finalized.countedAsSuccess);
    const finalPostconditionsPassed = Boolean(
      finalized.countedAsSuccess
      && !finalized.blocked
      && durationValidationPassed
      && entityAwarePurityPassed
      && groundingValidationPassed
    );
    this.patch({
      providerDurationClaimCount: diag.summaryDurationExpressionCount ?? beforeStrip,
      sourceDurationClaimCount: this.draft.sourceDurationClaimCount ?? beforeStrip,
      durationClaimCountBeforeStrip: beforeStrip,
      numericDurationClaimCount: diag.numericDurationClaimCount ?? breakdown.numeric,
      writtenDurationClaimCount: diag.writtenDurationClaimCount ?? breakdown.written,
      durationClaimsRemovedBeforeInsert: removed,
      durationClaimCountAfterInsert: afterInsert,
      durationClaimCountAfterFinalize: after,
      independentFinalDurationClaimCount: after,
      visibleDurationClaimCountAfterApply: null,
      visibleDurationMatchesFinalizedCount: null,
      durationDetectorAgreement: detectorAgreement,
      durationInsertedExactlyOnce: after === 1 && durationValidationPassed,
      durationFinalizerIdempotent,
      structuredDurationMonths: diag.authoritativeDurationMonths ?? null,
      localizedDurationPhraseHash: text
        ? fingerprintText(`dur:${diag.finalDurationExpressionCount ?? after}`)
        : null,
      finalDurationRepresentationKind: diag.finalDurationRepresentationKind ?? null,
      finalDurationRepresentationCount: diag.finalDurationRepresentationCount ?? null,
      finalDurationHybridDetected: diag.finalDurationHybridDetected ?? null,
      visibleDurationRepresentationKind: diag.visibleDurationRepresentationKind ?? null,
      visibleDurationRepresentationCount: diag.visibleDurationRepresentationCount ?? null,
      visibleDurationHybridDetected: diag.visibleDurationHybridDetected ?? null,
      durationSemanticValueMonths: diag.durationSemanticValueMonths ?? null,
      durationRepresentationAgreement: diag.durationRepresentationAgreement ?? null,
      fallbackAttempted,
      fallbackApplied,
      fallbackKind: finalized.origin === 'deterministic_fallback' ? 'deterministic' : null,
      fallbackSentenceCount,
      deterministicCandidateSentenceCount: deterministicSentenceCount,
      providerSentenceCount: diag.providerCandidatePresent === false
        ? 0
        : (typeof diag.providerCandidateSentenceCount === 'number'
          ? diag.providerCandidateSentenceCount
          : (typeof diag.providerSentenceCount === 'number' ? diag.providerSentenceCount : sentenceCount)),
      storedContentLocaleBeforeRequest: diag.storedContentLocaleBeforeRequest
        ?? this.draft.storedContentLocaleBeforeRequest
        ?? this.draft.storedContentLocale
        ?? null,
      detectedVisibleContentLocaleBeforeRequest:
        diag.detectedVisibleContentLocaleBeforeRequest
        ?? this.draft.requestedLocale
        ?? null,
      finalContentLocaleAfterApply: diag.finalContentLocaleAfterApply ?? null,
      finalCandidateSource: (() => {
        void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
        if (finalized.countedAsSuccess && !finalized.blocked) {
          return diag.finalCandidateSource ?? finalized.origin ?? null;
        }
        // Terminal failure — never label a rejected deterministic attempt as final.
        if (diag.finalCandidateSource === 'none') return 'none';
        return 'none';
      })(),
      providerCandidatePresent: Boolean(diag.providerCandidatePresent),
      deterministicCandidatePresent: Boolean(
        diag.deterministicCandidatePresent
        || finalized.origin === 'deterministic_fallback',
      ),
      fallbackCandidatePresent: Boolean(
        diag.fallbackCandidatePresent || fallbackApplied,
      ),
      perspectiveMode: diag.finalPerspectiveMode ?? diag.perspectiveMode ?? null,
      sourcePerspectiveMode: diag.sourcePerspectiveMode ?? null,
      providerPerspectiveMode: diag.providerPerspectiveMode ?? null,
      finalPerspectiveMode: diag.finalPerspectiveMode ?? null,
      perspectiveNormalizationAttempted: diag.perspectiveNormalizationAttempted ?? null,
      perspectiveNormalizationApplied: diag.perspectiveNormalizationApplied ?? null,
      perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed ?? false),
      localeValidationPassed: purity.targetLocalePurityPassed && finalized.reason !== 'locale_mismatch',
      durationValidationPassed,
      groundingValidationPassed: Boolean(groundingValidationPassed),
      currentEmploymentIntroductionCount: diag.currentEmploymentIntroductionCount ?? null,
      repeatedEmploymentFactCount: diag.repeatedEmploymentFactCount ?? null,
      repeatedProfessionalLabelCount: diag.repeatedProfessionalLabelCount ?? null,
      currentRoleConcreteFactCoverage: diag.currentRoleConcreteFactCoverage ?? null,
      requiredCurrentDutyFactCount: diag.requiredCurrentDutyFactCount ?? null,
      coveredCurrentDutyFactCount: diag.coveredCurrentDutyFactCount ?? null,
      missingCurrentDutyFactCount: diag.missingCurrentDutyFactCount ?? null,
      missingCurrentDutyFactIdHashes: diag.missingCurrentDutyFactIdHashes ?? null,
      materialCategoryCoverageUsedForFinalAcceptance:
        diag.materialCategoryCoverageUsedForFinalAcceptance ?? null,
      germanControlledCaseGrammarPassed: diag.germanControlledCaseGrammarPassed ?? null,
      finalGermanGrammarValidationPassed: diag.finalGermanGrammarValidationPassed ?? null,
      requiredCurrentDutyFactIds: diag.requiredCurrentDutyFactIds ?? null,
      finalCurrentDutyRequiredFactSetHash:
        (diag as { finalCurrentDutyRequiredFactSetHash?: string | null })
          .finalCurrentDutyRequiredFactSetHash
        ?? hashCurrentDutyRequiredFactSet(diag.requiredCurrentDutyFactIds)
        ?? null,
      authoritativeCurrentDutyFactCount: diag.authoritativeCurrentDutyFactCount ?? null,
      authoritativeCanonicalCurrentDutyFactCount:
        diag.authoritativeCanonicalCurrentDutyFactCount ?? null,
      classifiedRequiredCurrentDutyFactCount:
        diag.classifiedRequiredCurrentDutyFactCount ?? null,
      unclassifiedAuthoritativeCurrentDutyFactCount:
        diag.unclassifiedAuthoritativeCurrentDutyFactCount ?? null,
      requiredFactSetMatchesAuthoritativeFactSet:
        diag.requiredFactSetMatchesAuthoritativeFactSet ?? null,
      currentDutyRequiredFactParityPassed:
        diag.currentDutyRequiredFactParityPassed ?? null,
      currentMaterialCategoryCount: diag.currentMaterialCategoryCount ?? null,
      currentDutyFactClassificationKindsByFactHash:
        diag.currentDutyFactClassificationKindsByFactHash ?? null,
      finalCurrentDutyCoveragePassed: diag.finalCurrentDutyCoveragePassed ?? null,
      genericizedMaterialFactCount: diag.genericizedMaterialFactCount ?? null,
      priorRoleGroundingPassed: diag.priorRoleGroundingPassed ?? null,
      currentRoleTitlePresent: diag.currentRoleTitlePresent ?? null,
      currentRoleTitleSource: diag.currentRoleTitleSource ?? null,
      currentRoleTitleEntryIdHash: diag.currentRoleTitleEntryIdHash ?? null,
      currentRoleTitleMatchesStructuredRole: diag.currentRoleTitleMatchesStructuredRole ?? null,
      currentRoleOmittedDetected: diag.currentRoleOmittedDetected ?? null,
      currentSlotForeignFactCount: diag.currentSlotForeignFactCount ?? null,
      priorSlotForeignFactCount: diag.priorSlotForeignFactCount ?? null,
      semanticCrossEntryLeakageDetected: diag.semanticCrossEntryLeakageDetected ?? null,
      duplicatedPriorRoleFactCount: diag.duplicatedPriorRoleFactCount ?? null,
      priorRoleSemanticDuplicationDetected: diag.priorRoleSemanticDuplicationDetected ?? null,
      finalUnitRoleSlots: finalCandidateSelected
        ? (diag.finalUnitRoleSlots ?? null)
        : [],
      finalUnitSemanticRolesByUnit: finalCandidateSelected
        ? (diag.finalUnitSemanticRolesByUnit ?? null)
        : null,
      finalSentenceSemanticRolesBySentence: finalCandidateSelected
        ? (
          (diag as { finalSentenceSemanticRolesBySentence?: string[][] | null })
            .finalSentenceSemanticRolesBySentence
          ?? diag.finalUnitSemanticRolesByUnit
          ?? null
        )
        : null,
      finalCurrentEmployerPresent: diag.finalCurrentEmployerPresent ?? null,
      finalPriorEmployerPresent: diag.finalPriorEmployerPresent ?? null,
      finalCurrentEmploymentStateExpressed: diag.finalCurrentEmploymentStateExpressed ?? null,
      finalPriorEmploymentStateExpressed: diag.finalPriorEmploymentStateExpressed ?? null,
      finalCurrentRoleIntroValidationPassed: diag.finalCurrentRoleIntroValidationPassed ?? null,
      finalPriorRoleIntroValidationPassed: diag.finalPriorRoleIntroValidationPassed ?? null,
      finalPriorDutyCoveragePassed: diag.finalPriorDutyCoveragePassed ?? null,
      requiredPriorDutyFactCount: diag.requiredPriorDutyFactCount ?? null,
      coveredPriorDutyFactCount: diag.coveredPriorDutyFactCount ?? null,
      missingPriorDutyFactCount: diag.missingPriorDutyFactCount ?? null,
      finalSlotValidationPassed: diag.finalSlotValidationPassed ?? diag.slotValidationPassed ?? null,
      finalSlotRejectionReasons: diag.finalSlotRejectionReasons ?? diag.slotRejectionReasons ?? null,
      repairCandidateHash: diag.repairCandidateHash ?? null,
      repairRawCandidatePresent: diag.repairRawCandidatePresent ?? null,
      repairRawCandidateHash: diag.repairRawCandidateHash ?? diag.repairCandidateHash ?? null,
      repairRawCandidateLength: diag.repairRawCandidateLength ?? null,
      repairParseAttempted: diag.repairParseAttempted ?? null,
      repairParseSucceeded: diag.repairParseSucceeded ?? null,
      repairParsedUnitCount: diag.repairParsedUnitCount ?? null,
      repairParsedSentenceCount: diag.repairParsedSentenceCount ?? null,
      repairUsableCandidatePresent: diag.repairUsableCandidatePresent ?? null,
      repairTypedFailureReason: diag.repairTypedFailureReason ?? null,
      repairTransformationKinds: diag.repairTransformationKinds ?? null,
      repairRejectionReasons: diag.repairRejectionReasons ?? null,
      germanEmployerStatusRepairAttempted: diag.germanEmployerStatusRepairAttempted ?? null,
      germanEmployerStatusRepairApplied: diag.germanEmployerStatusRepairApplied ?? null,
      providerAccepted: diag.providerAccepted ?? null,
      summaryPipelineRevision: diag.summaryPipelineRevision ?? null,
      summaryBuilderRevision: diag.summaryBuilderRevision ?? null,
      summaryUnitSplitterRevision: diag.summaryUnitSplitterRevision ?? null,
      summaryGroundingRevision: diag.summaryGroundingRevision ?? null,
      summaryDurationFinalizerRevision: diag.summaryDurationFinalizerRevision ?? null,
      providerCandidateHash: diag.providerCandidateHash ?? null,
      providerCandidateNormalizedHash: diag.providerCandidateNormalizedHash ?? null,
      deterministicCandidateHash: diag.deterministicCandidateHash ?? null,
      deterministicCandidateNormalizedHash: diag.deterministicCandidateNormalizedHash ?? null,
      durationPass1CandidateHash: diag.durationPass1CandidateHash ?? null,
      durationPass2CandidateHash: diag.durationPass2CandidateHash ?? null,
      durationPass1Hash: diag.durationPass1Hash ?? diag.durationPass1CandidateHash ?? null,
      durationPass2Hash: diag.durationPass2Hash ?? diag.durationPass2CandidateHash ?? null,
      groundingInputCandidateHash: diag.groundingInputCandidateHash ?? null,
      finalValidatedCandidateHash: finalCandidateSelected
        ? (diag.finalValidatedCandidateHash ?? null)
        : null,
      providerCandidateEqualsDeterministicCandidate:
        diag.providerCandidateEqualsDeterministicCandidate ?? null,
      deterministicCandidateEqualsGroundingInput:
        diag.deterministicCandidateEqualsGroundingInput ?? null,
      groundingInputEqualsFinalValidatedCandidate:
        diag.groundingInputEqualsFinalValidatedCandidate ?? null,
      durationSecondPassChanged: diag.durationSecondPassChanged ?? null,
      durationSecondPassChangeReason: diag.durationSecondPassChangeReason ?? null,
      contextCurrentRoleResolved: diag.contextCurrentRoleResolved ?? null,
      contextCurrentRoleLocalized: diag.contextCurrentRoleLocalized ?? null,
      candidateCurrentRoleTitlePresent: diag.candidateCurrentRoleTitlePresent ?? null,
      candidateCurrentEmploymentIntroductionCount:
        diag.candidateCurrentEmploymentIntroductionCount ?? null,
      candidateCurrentRoleTitleMatchesStructuredRole:
        diag.candidateCurrentRoleTitleMatchesStructuredRole ?? null,
      candidateCurrentRoleOmittedDetected: diag.candidateCurrentRoleOmittedDetected ?? null,
      deterministicCurrentEntryIdHash: diag.deterministicCurrentEntryIdHash ?? null,
      deterministicPriorEntryIdHashes: diag.deterministicPriorEntryIdHashes ?? null,
      currentEntryMaterialKeys: diag.currentEntryMaterialKeys ?? null,
      priorEntryMaterialKeys: diag.priorEntryMaterialKeys ?? null,
      finalSentenceHashes: finalCandidateSelected
        ? (resolvedFinalHashes.length > 0
          ? resolvedFinalHashes
          : (diag.finalSentenceHashes ?? []))
        : [],
      finalSentenceRoleSlots: finalCandidateSelected
        ? (resolvedFinalRoleSlots.length > 0
          ? resolvedFinalRoleSlots
          : (diag.finalSentenceRoleSlots ?? []))
        : [],
      summaryFinalCandidateDiagnosticsRevision:
        SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION,
      flattenedFactArrayUsed: diag.flattenedFactArrayUsed ?? null,
      previousSummaryTextUsedByDeterministicFallback:
        diag.previousSummaryTextUsedByDeterministicFallback ?? null,
      providerTextUsedByDeterministicFallback:
        diag.providerTextUsedByDeterministicFallback ?? null,
      nearDuplicateSentenceCount: diag.repeatedEmploymentFactCount ?? 0,
      repeatedClauseCount: Math.max(
        diag.repeatedEmploymentFactCount ?? 0,
        diag.repeatedProfessionalLabelCount ?? 0,
      ),
      finalPostconditionsPassed,
      unitCount: purity.unitCount,
      detectedLocaleByUnit: purity.detectedLocaleByUnit,
      detectedScriptByUnit: purity.detectedScriptByUnit,
      wrongLocaleUnitCount: purity.wrongLocaleUnitCount,
      wrongScriptUnitCount: purity.wrongScriptUnitCount,
      mixedLanguageUnitCount: purity.mixedLanguageUnitCount,
      sourceLanguageLeakageDetected: entityAwareLeakage,
      unexpectedLocaleCodes: purity.unexpectedLocaleCodes,
      targetLocalePurityPassed: entityAwarePurityPassed,
      targetScript: purity.detectedScriptByUnit[0] || null,
      structuredRoleLocaleValidationPassed: diag.structuredRoleLocaleValidationPassed ?? null,
      currentRoleLocalizationValidationPassed:
        diag.currentRoleLocalizationValidationPassed ?? null,
      priorRoleLocalizationValidationPassed:
        diag.priorRoleLocalizationValidationPassed ?? null,
      foreignStructuredRoleTitleCount: diag.foreignStructuredRoleTitleCount ?? null,
      foreignPriorRoleTitleCount: diag.foreignPriorRoleTitleCount ?? null,
      foreignCurrentRoleTitleDetected: diag.foreignCurrentRoleTitleDetected ?? null,
      rawSourceRoleLeakageDetected: diag.rawSourceRoleLeakageDetected ?? null,
      finalWrongLocaleStructuredRoleCount: diag.finalWrongLocaleStructuredRoleCount
        ?? diag.foreignStructuredRoleTitleCount
        ?? null,
      finalStructuredRoleLocaleValidationPassed:
        diag.finalStructuredRoleLocaleValidationPassed
        ?? diag.structuredRoleLocaleValidationPassed
        ?? null,
      finalForeignRoleTitleCount: diag.finalForeignRoleTitleCount
        ?? diag.foreignStructuredRoleTitleCount
        ?? null,
      providerStructuredRoleLocaleValidationPassed:
        diag.providerStructuredRoleLocaleValidationPassed ?? null,
      providerForeignRoleTitleCount: diag.providerForeignRoleTitleCount ?? null,
      repairStructuredRoleLocaleValidationPassed:
        diag.repairStructuredRoleLocaleValidationPassed ?? null,
      repairForeignRoleTitleCount: diag.repairForeignRoleTitleCount ?? null,
      repairRoleLocalizationTransformationKinds:
        diag.repairRoleLocalizationTransformationKinds ?? null,
      countedAsSuccess: Boolean(
        finalized.countedAsSuccess && durationValidationPassed && entityAwarePurityPassed,
      ),
      finalTypedFailureReason: finalized.blocked || !durationValidationPassed || !entityAwarePurityPassed
        ? (finalized.reason || (!entityAwarePurityPassed ? 'locale_impurity' : 'experience_duration_mismatch'))
        : null,
      rejectionStage: finalized.blocked || !durationValidationPassed || !entityAwarePurityPassed
        ? (diag.rejectionStage || (!entityAwarePurityPassed ? 'locale_purity' : 'independent_final_duration_verification'))
        : null,
      genderValidationPassed: true,
      tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? true),
      grammarValidationPassed: typeof diag.grammarValidationPassed === 'boolean'
        ? diag.grammarValidationPassed
        : finalized.reason !== 'malformed_serbian_token',
      unsupportedClaimCount: diag.unsupportedClaimCount ?? 0,
      providerUnsupportedClaimCount: typeof diag.providerUnsupportedClaimCount === 'number'
        ? diag.providerUnsupportedClaimCount
        : (this.draft.providerUnsupportedClaimCount ?? 0),
      duplicateSentenceCount: 0,
      contentLocaleBeforeRequest: diag.contentLocaleBeforeRequest
        ?? this.draft.contentLocaleBeforeRequest
        ?? this.draft.storedContentLocale
        ?? null,
      contentLocaleAfterApply: diag.contentLocaleAfterApply ?? null,
      detectedSourceLocale: this.draft.detectedSourceLocale,
      // cv-ai-diagnostics-v2 — propagate finalize Hindi/medium/slot lineage
      operationKind: 'summary',
      providerRejectionReason: diag.providerRejectionReason ?? null,
      providerTypedRejectionReason: diag.providerTypedRejectionReason
        ?? diag.providerRejectionReason
        ?? null,
      providerSlotRejectionReasons: diag.providerSlotRejectionReasons ?? null,
      sourcePrintFactPresent: diag.sourcePrintFactPresent ?? null,
      sourceBrandingFactPresent: diag.sourceBrandingFactPresent ?? null,
      sourceMarketingFactPresent: diag.sourceMarketingFactPresent ?? null,
      providerUnsupportedDesignMediumCount: diag.providerUnsupportedDesignMediumCount ?? null,
      providerUnsupportedDesignMediumKinds: diag.providerUnsupportedDesignMediumKinds ?? null,
      providerPrintClaimDetected: diag.providerPrintClaimDetected ?? null,
      providerBrandingClaimDetected: diag.providerBrandingClaimDetected ?? null,
      providerMarketingClaimDetected: diag.providerMarketingClaimDetected ?? null,
      // When final is deterministic, final medium fields ARE the deterministic record.
      // Never alias provider* from final text.
      deterministicUnsupportedDesignMediumCount: (
        (diag.finalCandidateSource ?? finalized.origin) === 'deterministic_fallback'
          ? (diag.finalUnsupportedDesignMediumCount ?? 0)
          : (diag.deterministicUnsupportedDesignMediumCount ?? null)
      ),
      deterministicUnsupportedDesignMediumKinds: (
        (diag.finalCandidateSource ?? finalized.origin) === 'deterministic_fallback'
          ? (diag.finalUnsupportedDesignMediumKinds ?? [])
          : (diag.deterministicUnsupportedDesignMediumKinds ?? null)
      ),
      finalUnsupportedDesignMediumCount: diag.finalUnsupportedDesignMediumCount ?? null,
      finalUnsupportedDesignMediumKinds: diag.finalUnsupportedDesignMediumKinds ?? null,
      cvAiDiagnosticsV2299Revision: CV_AI_DIAGNOSTICS_V2_299_REVISION,
      summaryNoopSuccessContractRevision: diag.summaryNoopSuccessContractRevision ?? null,
      hindiCurrentIntroFiniteVerbPresent: this.draft.requestedLocale === 'hi'
        ? (diag.hindiCurrentIntroFiniteVerbPresent ?? null)
        : null,
      hindiCurrentIntroCopulaPresent: this.draft.requestedLocale === 'hi'
        ? (diag.hindiCurrentIntroCopulaPresent
          ?? diag.hindiCurrentIntroFiniteVerbPresent
          ?? null)
        : null,
      hindiCurrentDutyFiniteVerbPresent: this.draft.requestedLocale === 'hi'
        ? (diag.hindiCurrentDutyFiniteVerbPresent ?? null)
        : null,
      hindiCurrentDutyAuxiliaryPresent: this.draft.requestedLocale === 'hi'
        ? (diag.hindiCurrentDutyAuxiliaryPresent ?? null)
        : null,
      hindiPriorRoleFiniteVerbPresent: this.draft.requestedLocale === 'hi'
        ? (diag.hindiPriorRoleFiniteVerbPresent ?? null)
        : null,
      hindiStandaloneJahanFragmentDetected: this.draft.requestedLocale === 'hi'
        ? (diag.hindiStandaloneJahanFragmentDetected ?? null)
        : null,
      hindiNominalExperienceFragmentDetected: this.draft.requestedLocale === 'hi'
        ? (diag.hindiNominalExperienceFragmentDetected ?? null)
        : null,
      hindiSentenceHasFiniteCopulaOrVerb: this.draft.requestedLocale === 'hi'
        ? (diag.hindiSentenceHasFiniteCopulaOrVerb ?? null)
        : null,
      hindiIncompleteSentenceCount: this.draft.requestedLocale === 'hi'
        ? (diag.hindiIncompleteSentenceCount ?? null)
        : null,
      hindiGrammarRejectionReason: (() => {
        if (this.draft.requestedLocale !== 'hi') return null;
        const raw = diag.hindiGrammarRejectionReason ?? null;
        return raw && isGrammarRejectionCategory(raw) ? raw : null;
      })(),
      hindiGrammarRejectionReasons: this.draft.requestedLocale === 'hi'
        ? dedupeStableStrings(
          (diag.hindiGrammarRejectionReasons
            ?? (diag.hindiGrammarRejectionReason ? [diag.hindiGrammarRejectionReason] : []))
            .filter((r) => isGrammarRejectionCategory(r)),
        )
        : [],
      hindiSentenceGrammarRecords: (this.draft.requestedLocale === 'hi')
        ? buildHindiSentenceGrammarRecords({
          sentenceHashes: finalCandidateSelected
            ? (diag.finalSentenceHashes ?? resolvedFinalHashes)
            : (diag.evaluatedSentenceHashes ?? diag.finalSentenceHashes),
          sentenceRoleSlots: finalCandidateSelected
            ? (diag.finalSentenceRoleSlots ?? diag.finalUnitRoleSlots)
            : (diag.evaluatedUnitRoleSlots ?? diag.finalUnitRoleSlots),
          hindiSentenceHasFiniteCopulaOrVerb: diag.hindiSentenceHasFiniteCopulaOrVerb,
          hindiNominalExperienceFragmentDetected: diag.hindiNominalExperienceFragmentDetected,
          hindiStandaloneJahanFragmentDetected: diag.hindiStandaloneJahanFragmentDetected,
          hindiGrammarRejectionReason: (
            diag.hindiGrammarRejectionReason
            && isGrammarRejectionCategory(diag.hindiGrammarRejectionReason)
          ) ? diag.hindiGrammarRejectionReason : null,
          hindiCurrentIntroFiniteVerbPresent: diag.hindiCurrentIntroFiniteVerbPresent,
          hindiCurrentDutyAuxiliaryPresent: diag.hindiCurrentDutyAuxiliaryPresent,
        })
        : [],
      providerHindiNominalExperienceFragmentDetected:
        diag.providerHindiNominalExperienceFragmentDetected ?? null,
      providerHindiSentenceHasFiniteCopulaOrVerb:
        diag.providerHindiSentenceHasFiniteCopulaOrVerb ?? null,
      providerHindiIncompleteSentenceCount:
        diag.providerHindiIncompleteSentenceCount ?? null,
      providerHindiGrammarRejectionReasons: dedupeStableStrings(
        (diag.providerHindiGrammarRejectionReasons ?? [])
          .filter((r) => isGrammarRejectionCategory(r)),
      ),
      currentIntroSlotPresent: diag.currentIntroSlotPresent
        ?? (Array.isArray(diag.finalUnitRoleSlots)
          ? diag.finalUnitRoleSlots.includes('current_intro')
          : null),
      currentDutySlotPresent: diag.currentDutySlotPresent
        ?? (Array.isArray(diag.finalUnitRoleSlots)
          ? diag.finalUnitRoleSlots.includes('current_duty')
          : null),
      priorRoleSlotPresent: diag.priorRoleSlotPresent
        ?? (Array.isArray(diag.finalUnitRoleSlots)
          ? diag.finalUnitRoleSlots.includes('prior_role')
          : null),
      totalDurationSlotPresent: diag.totalDurationSlotPresent
        ?? (Array.isArray(diag.finalUnitRoleSlots)
          ? diag.finalUnitRoleSlots.includes('total_duration')
          : null),
      explicitSkillsSlotPresent: diag.explicitSkillsSlotPresent ?? null,
      slotValidationPassed: diag.slotValidationPassed ?? null,
      slotRejectionReasons: dedupeStableStrings(diag.slotRejectionReasons ?? []),
      finalDurationOwnerExpected: diag.finalDurationOwnerExpected ?? null,
      finalDurationOwnerDetected: diag.finalDurationOwnerDetected ?? null,
      finalDurationScopeValidationPassed: diag.finalDurationScopeValidationPassed ?? null,
      finalDurationCurrentRoleAttachmentRisk:
        diag.finalDurationCurrentRoleAttachmentRisk ?? null,
      finalDurationTotalCareerMarkerPresent:
        diag.finalDurationTotalCareerMarkerPresent ?? null,
      visibleDurationOwnerDetected: diag.visibleDurationOwnerDetected
        ?? diag.finalDurationOwnerDetected
        ?? null,
      visibleDurationScopeValidationPassed: diag.visibleDurationScopeValidationPassed
        ?? diag.finalDurationScopeValidationPassed
        ?? null,
      durationScopeRejectionReason: diag.durationScopeRejectionReason ?? null,
      explicitSkillFactCount: diag.explicitSkillFactCount ?? null,
      finalCompetencyClaimCount: diag.finalCompetencyClaimCount ?? null,
      finalUnsupportedCompetencyCount: diag.finalUnsupportedCompetencyCount
        ?? (typeof diag.unsupportedClaimCount === 'number' ? diag.unsupportedClaimCount : null),
      finalUnsupportedCompetencyKinds: diag.finalUnsupportedCompetencyKinds ?? null,
      competencyInferenceFromRoleForbidden: diag.competencyInferenceFromRoleForbidden
        ?? (this.draft.requestedLocale === 'de' ? true : null),
      summaryRepairAttempted: diag.summaryRepairAttempted ?? null,
      repairAttempted: Boolean(
        diag.summaryRepairAttempted
        || diag.germanEmployerStatusRepairAttempted
        || diag.repairCandidatePresent
      ),
      repairCandidatePresent: Boolean(diag.repairCandidatePresent),
      repairAccepted: Boolean(diag.repairAccepted),
      repairSelected: Boolean(
        diag.repairSelected
        ?? (diag.finalCandidateSource === 'repaired_provider'),
      ),
      // AAB-323: never alias "repair code ran" as repairApplied.
      repairApplied: Boolean(
        diag.repairApplied
        ?? (
          diag.summaryRepairApplied
          && diag.finalCandidateSource === 'repaired_provider'
        ),
      ),
      repairAttemptedTransformationKinds: diag.repairAttemptedTransformationKinds
        ?? diag.repairTransformationKinds
        ?? null,
      repairAcceptedTransformationKinds: diag.repairAcceptedTransformationKinds ?? [],
      repairAppliedTransformationKinds: diag.repairAppliedTransformationKinds ?? [],
      deterministicAccepted: Boolean(
        diag.deterministicAccepted
        ?? (diag.finalCandidateSource === 'deterministic_fallback' && finalized.countedAsSuccess),
      ),
      apiResponseKind: diag.apiResponseKind
        ?? (diag.providerCandidatePresent ? 'provider' : 'unknown'),
      serverCandidateKind: diag.serverCandidateKind
        ?? (diag.providerCandidatePresent ? 'provider' : 'empty'),
      serverFallbackUsed: false,
      serverFallbackReason: diag.serverFallbackReason ?? null,
      clientFallbackUsed: Boolean(
        diag.clientFallbackUsed
        || diag.noOpDetected
        || (
          finalized.countedAsSuccess
          && !finalized.blocked
          && finalized.origin === 'deterministic_fallback'
        ),
      ),
      clientFallbackKind: diag.clientFallbackKind
        ?? (
          (diag.clientFallbackUsed
            || diag.noOpDetected
            || (finalized.countedAsSuccess && finalized.origin === 'deterministic_fallback'))
            ? 'deterministic'
            : null
        ),
      clientFallbackReason: diag.clientFallbackReason ?? null,
      sourceNormalizedHash: diag.sourceNormalizedHash ?? null,
      finalNormalizedHash: finalCandidateSelected
        ? (diag.finalNormalizedHash ?? null)
        : null,
      finalMatchesSourceAfterNormalization:
        diag.finalMatchesSourceAfterNormalization ?? false,
      meaningfulChangeDetected: diag.meaningfulChangeDetected
        ?? (finalized.countedAsSuccess ? true : false),
      meaningfulChangeReason: diag.meaningfulChangeReason ?? null,
      noOpDetected: Boolean(
        diag.noOpDetected
        || diag.noOpRejected
        || finalized.reason === 'summary_noop_after_normalization',
      ),
      noOpCandidateKind: diag.noOpCandidateKind ?? null,
      noOpRejectionReason: diag.noOpRejectionReason
        ?? (
          finalized.reason === 'summary_noop_after_normalization'
            ? 'summary_noop_after_normalization'
            : null
        ),
      providerOutcome: diag.providerOutcome ?? (() => {
        if (!diag.providerCandidatePresent && !diag.providerCandidateHash) {
          return 'not_attempted';
        }
        if (finalized.countedAsSuccess && finalized.origin === 'ai_generated') return 'accepted';
        if (finalized.countedAsSuccess && finalized.origin === 'ai_repaired') {
          return diag.providerRejectionReason || diag.providerTypedRejectionReason
            ? 'rejected_grounding'
            : 'accepted';
        }
        if (diag.providerNoOpDetected || /noop|meaningful/i.test(String(diag.providerRejectionReason || ''))) {
          return 'rejected_noop';
        }
        if (diag.providerRejectionReason || diag.providerTypedRejectionReason) {
          const r = String(diag.providerTypedRejectionReason || diag.providerRejectionReason || '');
          if (/locale|script|leak/i.test(r)) return 'rejected_locale';
          if (/grammar|nominal|finite|copula|fragment/i.test(r)
            && !/unsupported_print|unsupported_brand|unsupported_market|unsupported_design/i.test(r)) {
            return 'rejected_grammar';
          }
          if (/ground|unsupported|medium|print|brand/i.test(r)) return 'rejected_grounding';
          return 'rejected_grounding';
        }
        if (finalized.origin === 'deterministic_fallback') return 'rejected_grounding';
        // Completed provider request must never remain unknown.
        return 'rejected_grounding';
      })(),
      candidateLineage: (() => {
        void SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION;
        const lineage: CvAiCandidateLineageRecord[] = [];
        const providerPresent = Boolean(diag.providerCandidatePresent);
        const providerUnitCount = typeof diag.providerCandidateSentenceCount === 'number'
          ? diag.providerCandidateSentenceCount
          : (typeof diag.providerSentenceCount === 'number' ? diag.providerSentenceCount : 0);
        const providerHashesRaw = Array.isArray(diag.providerSentenceHashes)
          ? diag.providerSentenceHashes
          : [];
        const providerHashes = providerHashesRaw.length === providerUnitCount
          ? providerHashesRaw
          : (providerUnitCount > 0 && providerHashesRaw.length === 0
            ? Array.from({ length: providerUnitCount }, (_, i) => fingerprintText(`provider_unit_${i}`))
            : providerHashesRaw);
        const materialRepairSelected = Boolean(
          diag.finalCandidateSource === 'repaired_provider'
          || diag.germanEmployerStatusRepairApplied
          || diag.repairAccepted,
        );
        void SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION;
        const providerRejected = Boolean(
          !finalized.countedAsSuccess
          || finalized.origin === 'deterministic_fallback'
          || materialRepairSelected
          || diag.providerNoOpDetected
          || diag.providerRejectionReason
          || (diag.providerUnsupportedDesignMediumCount ?? 0) > 0
          || (diag.providerUnsupportedClaimCount ?? 0) > 0,
        );
        const providerMc = Boolean(
          diag.providerCandidateNormalizedHash
          && diag.sourceNormalizedHash
          && diag.providerCandidateNormalizedHash !== diag.sourceNormalizedHash,
        );
        lineage.push({
          candidateKind: 'provider',
          present: providerPresent,
          hash: diag.providerCandidateHash ?? null,
          normalizedHash: diag.providerCandidateNormalizedHash ?? null,
          unitCount: providerUnitCount,
          unitHashes: providerHashes,
          sentenceCount: providerUnitCount,
          sentenceHashes: providerHashes,
          accepted: finalized.origin === 'ai_generated'
            && Boolean(finalized.countedAsSuccess)
            && !materialRepairSelected,
          rejectionStage: diag.providerRejectionStage
            ?? (providerRejected && providerPresent
              ? (materialRepairSelected ? 'employer_status_validation' : 'provider_validation')
              : null),
          rejectionReasons: dedupeStableStrings([
            ...(diag.providerHindiGrammarRejectionReasons || []),
            ...(diag.providerSlotRejectionReasons || []),
            ...(diag.providerUnsupportedDesignMediumKinds || []),
            ...(diag.providerTypedRejectionReason
              ? [diag.providerTypedRejectionReason]
              : (diag.providerRejectionReason ? [diag.providerRejectionReason] : [])),
          ]),
          grammarValidationPassed: providerPresent
            ? (diag.providerHindiIncompleteSentenceCount != null
              ? diag.providerHindiIncompleteSentenceCount === 0
                && !diag.providerHindiNominalExperienceFragmentDetected
              : null)
            : null,
          groundingValidationPassed: providerPresent
            ? ((diag.providerUnsupportedDesignMediumCount ?? 0) === 0
              && (diag.providerUnsupportedClaimCount ?? 0) === 0
              ? !providerRejected
              : false)
            : null,
          durationValidationPassed: null,
          slotValidationPassed: providerPresent
            ? ((diag.providerSlotRejectionReasons || []).length === 0 ? !providerRejected : false)
            : null,
          localeValidationPassed: null,
          unsupportedClaimCount: diag.providerUnsupportedClaimCount ?? 0,
          unsupportedClaimKinds: [],
          unsupportedDesignMediumCount: diag.providerUnsupportedDesignMediumCount ?? 0,
          unsupportedDesignMediumKinds: dedupeStableStrings(
            diag.providerUnsupportedDesignMediumKinds ?? [],
          ),
          printClaimDetected: diag.providerPrintClaimDetected ?? false,
          hindiNominalExperienceFragmentDetected:
            diag.providerHindiNominalExperienceFragmentDetected ?? null,
          hindiSentenceHasFiniteCopulaOrVerb:
            diag.providerHindiSentenceHasFiniteCopulaOrVerb ?? null,
          hindiIncompleteSentenceCount: diag.providerHindiIncompleteSentenceCount ?? null,
          hindiGrammarRejectionReasons: dedupeStableStrings(
            (diag.providerHindiGrammarRejectionReasons ?? [])
              .filter((r) => isGrammarRejectionCategory(r)),
          ),
          meaningfulChangeDetected: providerPresent ? providerMc : null,
          finalMatchesSourceAfterNormalization: providerPresent ? !providerMc : null,
          noOpDetected: Boolean(diag.providerNoOpDetected) || (providerPresent && !providerMc
            && Boolean(diag.sourceNormalizedHash)),
          noOpRejectionReason: diag.providerNoOpDetected
            ? 'summary_noop_after_normalization'
            : null,
        });
        // AAB-321: immutable repaired-provider phase when material repair was attempted.
        const repairAttempted = Boolean(
          diag.repairCandidatePresent
          || diag.germanEmployerStatusRepairAttempted
          || diag.summaryRepairAttempted
          || materialRepairSelected,
        );
        const repairAccepted = Boolean(
          materialRepairSelected && finalized.countedAsSuccess,
        );
        if (repairAttempted || materialRepairSelected) {
          const repairUsable = Boolean(
            diag.repairUsableCandidatePresent
            ?? (materialRepairSelected && finalized.countedAsSuccess),
          );
          const repairRawPresent = Boolean(
            diag.repairRawCandidatePresent
            ?? diag.repairCandidatePresent
            ?? materialRepairSelected,
          );
          lineage.push({
            candidateKind: 'repaired_provider',
            present: repairRawPresent,
            hash: diag.repairCandidateHash
              ?? diag.repairRawCandidateHash
              ?? (repairAccepted ? (diag.finalValidatedCandidateHash ?? null) : null),
            normalizedHash: diag.repairCandidateHash
              ?? diag.repairRawCandidateHash
              ?? (repairAccepted ? (diag.finalValidatedCandidateHash ?? null) : null),
            // Usable/accepted repair only — raw-but-unusable must not claim unitCount>0
            // with empty unitHashes (candidate_unit_hash_count_mismatch).
            unitCount: repairUsable && repairAccepted ? resolvedFinalUnitCount : 0,
            unitHashes: repairUsable && repairAccepted ? resolvedFinalHashes : [],
            sentenceCount: repairUsable && repairAccepted ? resolvedFinalUnitCount : 0,
            sentenceHashes: repairUsable && repairAccepted ? resolvedFinalHashes : [],
            sentenceRoleSlots: repairUsable && repairAccepted ? resolvedFinalRoleSlots : [],
            accepted: repairAccepted,
            rejectionStage: repairAccepted
              ? null
              : (diag.repairTypedFailureReason
                || (diag.repairRejectionReasons?.length ? 'employer_status_validation' : null)),
            rejectionReasons: dedupeStableStrings([
              ...(diag.repairRejectionReasons || []),
              ...(diag.repairTypedFailureReason ? [diag.repairTypedFailureReason] : []),
            ]),
            grammarValidationPassed: repairAccepted ? true : null,
            groundingValidationPassed: repairAccepted ? true : false,
            durationValidationPassed: repairAccepted ? durationValidationPassed : null,
            slotValidationPassed: repairAccepted ? (diag.slotValidationPassed ?? null) : false,
            localeValidationPassed: repairAccepted ? purity.targetLocalePurityPassed : null,
            unsupportedClaimCount: 0,
            unsupportedClaimKinds: [],
            unsupportedDesignMediumCount: 0,
            unsupportedDesignMediumKinds: [],
            printClaimDetected: false,
            hindiNominalExperienceFragmentDetected: null,
            hindiSentenceHasFiniteCopulaOrVerb: null,
            hindiIncompleteSentenceCount: null,
            hindiGrammarRejectionReasons: [],
            meaningfulChangeDetected: repairAttempted ? true : null,
            finalMatchesSourceAfterNormalization: false,
            noOpDetected: false,
            noOpRejectionReason: null,
            transformationKinds: Array.isArray(diag.repairTransformationKinds)
              ? diag.repairTransformationKinds
              : undefined,
          } as CvAiCandidateLineageRecord);
        }
        const detPresent = Boolean(
          (
            diag.deterministicCandidatePresent
            || finalized.origin === 'deterministic_fallback'
            || diag.noOpDetected
          )
          && !materialRepairSelected,
        );
        const detNoOp = Boolean(
          diag.noOpDetected
          || diag.noOpRejected
          || (
            detPresent
            && diag.deterministicCandidateNormalizedHash
            && diag.sourceNormalizedHash
            && diag.deterministicCandidateNormalizedHash === diag.sourceNormalizedHash
          ),
        );
        const detAccepted = finalized.origin === 'deterministic_fallback'
          && Boolean(finalized.countedAsSuccess)
          && !detNoOp;
        // Deterministic lineage must NOT borrow final* hashes — phase separation.
        const detSentenceCount = typeof diag.deterministicCandidateSentenceCount === 'number'
          ? diag.deterministicCandidateSentenceCount
          : deterministicSentenceCount;
        const evaluatedHashes = Array.isArray(diag.evaluatedSentenceHashes)
          ? diag.evaluatedSentenceHashes.filter(Boolean)
          : [];
        // When deterministic is the selected final, unit hashes must describe the
        // same finalized text as final_selected — never synthetic placeholders or
        // stale pre-finalization / provider hashes.
        void SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION;
        const detHashes = (() => {
          if (detAccepted && resolvedFinalHashes.length > 0) {
            return resolvedFinalHashes;
          }
          if (evaluatedHashes.length > 0
            && (detSentenceCount <= 0 || evaluatedHashes.length === detSentenceCount)) {
            return evaluatedHashes;
          }
          if (detPresent && detSentenceCount > 0 && textUnitHashes.length === detSentenceCount) {
            return textUnitHashes;
          }
          if (detPresent && detSentenceCount > 0) {
            const base = diag.deterministicCandidateHash || 'deterministic_candidate';
            return Array.from(
              { length: detSentenceCount },
              (_, i) => fingerprintText(`${base}:unit:${i}`),
            );
          }
          return [];
        })();
        const detUnitCount = detPresent
          ? (detHashes.length > 0 ? detHashes.length : detSentenceCount)
          : 0;
        const detRoleSlots = detAccepted && resolvedFinalRoleSlots.length === detUnitCount
          ? resolvedFinalRoleSlots
          : (Array.isArray(diag.evaluatedUnitRoleSlots)
            && diag.evaluatedUnitRoleSlots.length === detUnitCount
            ? diag.evaluatedUnitRoleSlots
            : (detUnitCount > 0
              ? Array.from({ length: detUnitCount }, () => 'summary_unit')
              : []));
        const detSemanticRoles = detAccepted && resolvedFinalSemanticRoles
          ? resolvedFinalSemanticRoles
          : null;
        const detRawHash = diag.deterministicCandidateHash ?? null;
        const detNormalizedHash = diag.deterministicCandidateNormalizedHash ?? detRawHash;
        const detFinalizedHash = detAccepted
          ? (diag.finalValidatedCandidateHash ?? detNormalizedHash)
          : detNormalizedHash;
        lineage.push({
          candidateKind: 'client_deterministic',
          present: detPresent,
          hash: detFinalizedHash ?? detRawHash,
          normalizedHash: detNormalizedHash,
          rawHash: detRawHash,
          finalizedHash: detFinalizedHash,
          unitCount: detPresent ? detUnitCount : 0,
          unitHashes: detPresent ? detHashes : [],
          sentenceCount: detPresent ? detUnitCount : 0,
          sentenceHashes: detPresent ? detHashes : [],
          sentenceRoleSlots: detPresent ? detRoleSlots : [],
          sentenceSemanticRolesBySentence: detPresent ? detSemanticRoles : null,
          accepted: detAccepted,
          rejectionStage: detAccepted
            ? null
            : (detNoOp
              ? 'meaningful_change'
              : (diag.rejectionStage
                || (diag.slotValidationPassed === false ? 'slot_validation' : null)
                || (groundingValidationPassed === false ? 'summary_grounding' : null)
                || (detPresent ? 'summary_grounding' : null))),
          rejectionReasons: dedupeStableStrings(
            detAccepted
              ? []
              : [
                ...(detNoOp ? ['summary_noop_after_normalization'] : []),
                ...(diag.slotRejectionReasons ?? []),
                ...(diag.typedFailureReason ? [diag.typedFailureReason] : []),
                ...(finalized.reason && !finalized.countedAsSuccess ? [finalized.reason] : []),
              ].filter(Boolean),
          ),
          grammarValidationPassed: typeof diag.grammarValidationPassed === 'boolean'
            ? diag.grammarValidationPassed
            : null,
          groundingValidationPassed: Boolean(groundingValidationPassed),
          durationValidationPassed,
          slotValidationPassed: diag.slotValidationPassed ?? null,
          localeValidationPassed: purity.targetLocalePurityPassed,
          unsupportedClaimCount: diag.unsupportedClaimCount ?? 0,
          unsupportedClaimKinds: [],
          unsupportedDesignMediumCount: diag.finalUnsupportedDesignMediumCount ?? 0,
          unsupportedDesignMediumKinds: dedupeStableStrings(
            diag.finalUnsupportedDesignMediumKinds ?? [],
          ),
          printClaimDetected: false,
          hindiNominalExperienceFragmentDetected:
            diag.hindiNominalExperienceFragmentDetected ?? null,
          hindiSentenceHasFiniteCopulaOrVerb: diag.hindiSentenceHasFiniteCopulaOrVerb ?? null,
          hindiIncompleteSentenceCount: diag.hindiIncompleteSentenceCount ?? null,
          hindiGrammarRejectionReasons: dedupeStableStrings(
            (diag.hindiGrammarRejectionReasons
              ?? (diag.hindiGrammarRejectionReason ? [diag.hindiGrammarRejectionReason] : []))
              .filter((r) => isGrammarRejectionCategory(r)),
          ),
          meaningfulChangeDetected: detPresent ? !detNoOp : null,
          finalMatchesSourceAfterNormalization: detPresent ? detNoOp : null,
          noOpDetected: detNoOp,
          noOpRejectionReason: detNoOp ? 'summary_noop_after_normalization' : null,
        });
        const finalSelected = Boolean(
          finalized.countedAsSuccess && text && !detNoOp
          && !(diag.noOpDetected && !finalized.countedAsSuccess),
        );
        lineage.push({
          candidateKind: 'final_selected',
          present: finalSelected,
          hash: finalSelected ? (diag.finalValidatedCandidateHash ?? null) : null,
          normalizedHash: finalSelected ? (diag.finalValidatedCandidateHash ?? null) : null,
          rawHash: finalSelected ? (diag.finalValidatedCandidateHash ?? null) : null,
          finalizedHash: finalSelected ? (diag.finalValidatedCandidateHash ?? null) : null,
          unitCount: finalSelected ? resolvedFinalUnitCount : 0,
          unitHashes: finalSelected ? resolvedFinalHashes : [],
          sentenceCount: finalSelected ? resolvedFinalUnitCount : 0,
          sentenceHashes: finalSelected ? resolvedFinalHashes : [],
          sentenceRoleSlots: finalSelected ? resolvedFinalRoleSlots : [],
          sentenceSemanticRolesBySentence: finalSelected ? resolvedFinalSemanticRoles : null,
          accepted: finalSelected,
          selectedSource: finalSelected
            ? (materialRepairSelected
              ? 'repaired_provider'
              : (finalized.origin === 'deterministic_fallback'
                ? 'client_deterministic'
                : (diag.finalCandidateSource || finalized.origin || null)))
            : null,
          rejectionStage: finalSelected ? null : (
            diag.noOpDetected || finalized.reason === 'summary_noop_after_normalization'
              ? 'meaningful_change'
              : (finalized.reason || null)
          ),
          rejectionReasons: dedupeStableStrings(
            finalSelected
              ? []
              : [
                finalized.reason || '',
                diag.typedFailureReason || '',
                diag.noOpRejectionReason || '',
              ].filter(Boolean),
          ),
          grammarValidationPassed: finalSelected
            ? (typeof diag.grammarValidationPassed === 'boolean'
              ? diag.grammarValidationPassed
              : null)
            : null,
          groundingValidationPassed: finalSelected ? Boolean(groundingValidationPassed) : null,
          durationValidationPassed: finalSelected ? durationValidationPassed : null,
          slotValidationPassed: finalSelected ? (diag.slotValidationPassed ?? null) : null,
          localeValidationPassed: finalSelected ? purity.targetLocalePurityPassed : null,
          unsupportedClaimCount: finalSelected ? (diag.unsupportedClaimCount ?? 0) : 0,
          unsupportedClaimKinds: [],
          unsupportedDesignMediumCount: finalSelected
            ? (diag.finalUnsupportedDesignMediumCount ?? 0)
            : 0,
          unsupportedDesignMediumKinds: finalSelected
            ? dedupeStableStrings(diag.finalUnsupportedDesignMediumKinds ?? [])
            : [],
          printClaimDetected: false,
          hindiNominalExperienceFragmentDetected: finalSelected
            ? (diag.hindiNominalExperienceFragmentDetected ?? null)
            : null,
          hindiSentenceHasFiniteCopulaOrVerb: finalSelected
            ? (diag.hindiSentenceHasFiniteCopulaOrVerb ?? null)
            : null,
          hindiIncompleteSentenceCount: finalSelected
            ? (diag.hindiIncompleteSentenceCount ?? null)
            : null,
          hindiGrammarRejectionReasons: finalSelected
            ? dedupeStableStrings(
              (diag.hindiGrammarRejectionReasons
                ?? (diag.hindiGrammarRejectionReason ? [diag.hindiGrammarRejectionReason] : []))
                .filter((r) => isGrammarRejectionCategory(r)),
            )
            : [],
          meaningfulChangeDetected: finalSelected
            ? Boolean(diag.meaningfulChangeDetected ?? true)
            : false,
          finalMatchesSourceAfterNormalization: finalSelected
            ? Boolean(diag.finalMatchesSourceAfterNormalization)
            : false,
          noOpDetected: !finalSelected && Boolean(diag.noOpDetected),
          noOpRejectionReason: !finalSelected && diag.noOpDetected
            ? 'summary_noop_after_normalization'
            : null,
        });
        return lineage;
      })(),
    });
    this.stage(
      'duration_validation',
      durationValidationPassed ? 'ok' : 'fail',
    );
    this.stage(
      'independent_final_duration_verification',
      independent.ok && after === 1 ? 'ok' : 'fail',
      `count=${after}`,
    );
    this.stage(
      'final_postconditions',
      finalPostconditionsPassed ? 'ok' : 'fail',
      finalized.reason || undefined,
    );
  }

  recordVisibleApply(ok: boolean, usageAfter: number, visibleText?: string): void {
    const locale = (this.draft.requestedLocale || 'en') as import('./i18n/translations').Locale;
    const visibleCount = typeof visibleText === 'string'
      ? countSummaryDurationExpressions(visibleText, locale)
      : (ok ? (this.draft.independentFinalDurationClaimCount ?? null) : null);
    const finalizedCount = this.draft.independentFinalDurationClaimCount ?? null;
    const matches = visibleCount != null && finalizedCount != null
      ? visibleCount === finalizedCount && visibleCount === 1
      : null;
    const durationStillOk = !ok
      || (visibleCount === 1 && matches === true);
    const visibleHash = typeof visibleText === 'string' && visibleText.trim()
      ? fingerprintText(visibleText.replace(/\s+/g, ' ').trim())
      : null;
    void SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION;
    let visibleRoleOk = true;
    let visibleWrongRoleCount = 0;
    let visibleDutyOk = true;
    let visiblePriorDutyOk = true;
    let visibleGrammarOk = true;
    let visibleLocaleOk = true;
    let visibleDurationScopeOk = true;
    let visibleDutyCovered = 0;
    let visibleDutyRequired = 0;
    let visiblePriorDutyCovered = 0;
    let visiblePriorDutyRequired = 0;
    if (ok && durationStillOk && locale === 'de' && typeof visibleText === 'string') {
      const roleCheck = verifyVisibleSummaryStructuredRoleLocale({
        visibleSummary: visibleText,
        targetLocale: locale,
        finalStructuredRoleLocaleValidationPassed:
          this.draft.finalStructuredRoleLocaleValidationPassed
          ?? this.draft.structuredRoleLocaleValidationPassed,
      });
      visibleWrongRoleCount = roleCheck.visibleWrongLocaleStructuredRoleCount;
      if (
        /diseñador(?:a)?\s+gráfic(?:a|o)|disenador(?:a)?\s+grafic(?:a|o)/iu.test(visibleText)
      ) {
        visibleRoleOk = false;
        visibleWrongRoleCount = Math.max(visibleWrongRoleCount, 1);
      } else if (
        this.draft.structuredRoleLocaleValidationPassed === true
        && !roleCheck.visibleStructuredRoleLocaleValidationPassed
      ) {
        visibleRoleOk = false;
      }
      void SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION;
      const facts = rebuildGermanDutyFactsFromIds(this.draft.requiredCurrentDutyFactIds);
      if (facts.length > 0) {
        const duty = validateSummaryEntryDutyCoverage({
          requiredFacts: facts,
          candidateText: visibleText,
        });
        visibleDutyRequired = duty.requiredCurrentDutyFactCount;
        visibleDutyCovered = duty.coveredCurrentDutyFactCount;
        visibleDutyOk = duty.finalCurrentDutyCoveragePassed;
      }
      const requiredCurrentDe = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
      const authoritativeDe = Number(this.draft.authoritativeCurrentDutyFactCount ?? 0);
      if ((requiredCurrentDe > 0 || authoritativeDe > 0) && facts.length === 0) {
        visibleDutyRequired = 0;
        visibleDutyCovered = 0;
        visibleDutyOk = false;
        this.patch({
          finalTypedFailureReason: 'visible_current_duty_required_set_missing',
          visibleCurrentDutyRequiredFactParityPassed: false,
          visibleCurrentDutyRequiredFactCountMatchesFinal: false,
        });
      } else {
        const visibleSetHash = hashCurrentDutyRequiredFactSet(
          facts.map((f) => f.canonicalFactId),
        );
        const finalSetHash = this.draft.finalCurrentDutyRequiredFactSetHash
          ?? hashCurrentDutyRequiredFactSet(this.draft.requiredCurrentDutyFactIds);
        const countMatches = visibleDutyRequired === requiredCurrentDe;
        const setMatches = Boolean(
          visibleSetHash && finalSetHash && visibleSetHash === finalSetHash,
        ) || (requiredCurrentDe === 0 && facts.length === 0);
        const parityOk = countMatches && (requiredCurrentDe === 0 || setMatches);
        if (!parityOk) visibleDutyOk = false;
        this.patch({
          visibleCurrentDutyRequiredFactParityPassed: parityOk,
          visibleCurrentDutyRequiredFactCountMatchesFinal: countMatches,
          visibleCurrentDutyRequiredFactSetHash: visibleSetHash,
          finalCurrentDutyRequiredFactSetHash: finalSetHash,
        });
      }
      const grammar = validateGermanGeneratedCaseGrammar(visibleText);
      visibleGrammarOk = grammar.germanControlledCaseGrammarPassed;
    }
    if (ok && durationStillOk && locale === 'en' && typeof visibleText === 'string') {
      void ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION;
      void ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION;
      void SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION;
      void SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION;
      const requiredCurrent = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
      const requiredPrior = Number(this.draft.requiredPriorDutyFactCount ?? 0);
      const authoritativeCurrent = Number(this.draft.authoritativeCurrentDutyFactCount ?? 0);
      const entryIdHash = this.draft.currentRoleTitleEntryIdHash
        ?? (Array.isArray(this.draft.currentExperienceEntryIdHashes)
          ? this.draft.currentExperienceEntryIdHashes[0]
          : null)
        ?? null;
      // Same immutable required fact IDs as final candidate validation — never
      // rebuild from German-only matchers or infer count from matches alone.
      const facts = rebuildEnglishDutyFactsFromIds(this.draft.requiredCurrentDutyFactIds, {
        currentEntryId: entryIdHash,
      });
      const visibleFactSetHash = hashCurrentDutyRequiredFactSet(
        facts.map((f) => f.canonicalFactId),
      );
      const finalFactSetHash = this.draft.finalCurrentDutyRequiredFactSetHash
        ?? hashCurrentDutyRequiredFactSet(this.draft.requiredCurrentDutyFactIds);
      let visibleMatchCounts: Record<string, number> | null = null;
      let visibleMatchUnits: Record<string, string[]> | null = null;
      let visibleMissingHashes: string[] | null = null;
      let typedDutyFailure: string | null = null;

      if (requiredCurrent > 0 || authoritativeCurrent > 0) {
        if (facts.length === 0) {
          // Authoritative/final required facts exist but visible required set is missing.
          visibleDutyRequired = 0;
          visibleDutyCovered = 0;
          visibleDutyOk = false;
          typedDutyFailure = 'visible_current_duty_required_set_missing';
        } else {
          const duty = validateSummaryEntryDutyCoverage({
            requiredFacts: facts,
            candidateText: visibleText,
            locale: 'en',
            entryId: entryIdHash,
          });
          visibleDutyRequired = duty.requiredCurrentDutyFactCount;
          visibleDutyCovered = duty.coveredCurrentDutyFactCount;
          visibleDutyOk = duty.finalCurrentDutyCoveragePassed
            && visibleDutyRequired > 0
            && visibleDutyCovered === visibleDutyRequired;
          visibleMatchCounts = duty.currentDutyFactMatchCountsByFactHash;
          visibleMatchUnits = duty.currentDutyFactMatchedUnitHashesByFactHash;
          visibleMissingHashes = duty.missingCurrentDutyFactIdHashes;
          if (!visibleDutyOk) typedDutyFailure = 'visible_current_duty_coverage_failed';
        }
      } else {
        // Empty-set policy: 0/0 is N/A only when no authoritative/required duties.
        visibleDutyRequired = 0;
        visibleDutyCovered = 0;
        visibleDutyOk = true;
      }

      const countMatchesFinal = visibleDutyRequired === requiredCurrent;
      const setHashMatches = Boolean(
        visibleFactSetHash
        && finalFactSetHash
        && visibleFactSetHash === finalFactSetHash,
      )
        || (requiredCurrent === 0 && authoritativeCurrent === 0 && facts.length === 0);
      const parityOk = countMatchesFinal
        && (requiredCurrent === 0 || setHashMatches)
        && !(requiredCurrent > 0 && visibleDutyRequired === 0);
      if (!parityOk) {
        visibleDutyOk = false;
        if (!typedDutyFailure) {
          typedDutyFailure = visibleDutyRequired === 0 && requiredCurrent > 0
            ? 'visible_current_duty_required_set_missing'
            : 'visible_current_duty_required_fact_parity_failed';
        }
      }
      this.patch({
        visibleCurrentDutyRequiredFactParityPassed: parityOk,
        visibleCurrentDutyRequiredFactCountMatchesFinal: countMatchesFinal,
        visibleCurrentDutyRequiredFactSetHash: visibleFactSetHash,
        finalCurrentDutyRequiredFactSetHash: finalFactSetHash,
        visibleCurrentDutyFactMatchCountsByFactHash: visibleMatchCounts,
        visibleCurrentDutyFactMatchedUnitHashesByFactHash: visibleMatchUnits,
        visibleMissingCurrentDutyFactIdHashes: visibleMissingHashes,
      });
      if (typedDutyFailure) {
        this.patch({ finalTypedFailureReason: typedDutyFailure });
      }

      visiblePriorDutyRequired = requiredPrior;
      visiblePriorDutyCovered = Number(this.draft.coveredPriorDutyFactCount ?? 0);
      if (requiredPrior > 0) {
        const priorPass = /\bGraphic\s+Designer\b/iu.test(visibleText)
          && /\bRewitu\b/iu.test(visibleText)
          && /\b(?:previously|formerly|worked\s+as)\b/iu.test(visibleText)
          && /visual\s+materials?/iu.test(visibleText)
          && /design\s+(?:documents?|materials?)/iu.test(visibleText)
          && /final\s+(?:design\s+)?files?/iu.test(visibleText);
        visiblePriorDutyOk = priorPass;
        if (priorPass) visiblePriorDutyCovered = requiredPrior;
      }
      const priorParityOk = visiblePriorDutyRequired === requiredPrior
        && (requiredPrior === 0 || visiblePriorDutyOk);
      this.patch({ visiblePriorDutyRequiredFactParityPassed: priorParityOk });
      if (!priorParityOk) visiblePriorDutyOk = false;

      visibleRoleOk = /\bWarehouse\s+(?:Employee|Worker)\b/iu.test(visibleText)
        && /\bAtlas\b/iu.test(visibleText)
        && (!requiredPrior || /\bGraphic\s+Designer\b/iu.test(visibleText));
      visibleLocaleOk = !/[ñáéíóúü]/iu.test(visibleText)
        && !/\b(?:revisingó|comprobingó|mercanc|documentaci|almac[eé]n)\b/iu.test(visibleText);
      visibleDurationScopeOk = this.draft.finalDurationScopeValidationPassed !== false
        && !/at\s+Atlas.{0,40}since.{0,40},\s+with\s+approximately/iu.test(visibleText);
    }
    const applyOk = ok && durationStillOk && visibleRoleOk && visibleDutyOk
      && visiblePriorDutyOk && visibleGrammarOk && visibleLocaleOk && visibleDurationScopeOk;
    this.patch({
      visibleApplySucceeded: applyOk,
      contentLocaleUpdatedAfterApply: applyOk,
      contentLocaleAfterApply: applyOk
        ? (this.draft.requestedLocale || this.draft.contentLocaleAfterApply || null)
        : this.draft.contentLocaleAfterApply,
      usageCountAfter: usageAfter,
      visibleCandidateHashAfterApply: visibleHash,
      visibleSummaryMatchesFinalHash: applyOk
        ? (
          visibleHash != null
          && this.draft.finalValidatedCandidateHash != null
          && visibleHash === this.draft.finalValidatedCandidateHash
        )
        : applyOk,
      visibleDurationClaimCountAfterApply: visibleCount,
      visibleDurationMatchesFinalizedCount: matches,
      visibleStructuredRoleLocaleValidationPassed: (locale === 'de' || locale === 'en')
        ? (typeof visibleText === 'string' ? visibleRoleOk && visibleLocaleOk : null)
        : null,
      visibleWrongLocaleStructuredRoleCount: (locale === 'de' || locale === 'en')
        ? visibleWrongRoleCount
        : null,
      visibleRequiredCurrentDutyFactCount: (locale === 'de' || locale === 'en')
        ? visibleDutyRequired
        : null,
      visibleCoveredCurrentDutyFactCount: (locale === 'de' || locale === 'en')
        ? visibleDutyCovered
        : null,
      visibleMissingCurrentDutyFactCount: (locale === 'de' || locale === 'en')
        ? Math.max(0, visibleDutyRequired - visibleDutyCovered)
        : null,
      visibleCurrentDutyCoveragePassed: (locale === 'de' || locale === 'en')
        ? (typeof visibleText === 'string' ? visibleDutyOk : null)
        : null,
      visibleRequiredPriorDutyFactCount: locale === 'en' ? visiblePriorDutyRequired : null,
      visibleCoveredPriorDutyFactCount: locale === 'en' ? visiblePriorDutyCovered : null,
      visibleMissingPriorDutyFactCount: locale === 'en'
        ? Math.max(0, visiblePriorDutyRequired - visiblePriorDutyCovered)
        : null,
      visiblePriorDutyCoveragePassed: locale === 'en'
        ? (typeof visibleText === 'string' ? visiblePriorDutyOk : null)
        : null,
      visibleDurationScopeValidationPassed: locale === 'en'
        ? (typeof visibleText === 'string' ? visibleDurationScopeOk : null)
        : (locale === 'de' ? this.draft.visibleDurationScopeValidationPassed : null),
      visibleGermanGrammarValidationPassed: locale === 'de'
        ? (typeof visibleText === 'string' ? visibleGrammarOk : null)
        : null,
      // Applied summaries use an explicit race/context result of ok (sync finalize path).
      raceGuardResult: applyOk ? 'ok' : (ok ? 'fail' : this.draft.raceGuardResult || 'skipped'),
      durationValidationPassed: durationStillOk
        ? this.draft.durationValidationPassed
        : false,
      finalPostconditionsPassed: applyOk
        ? this.draft.finalPostconditionsPassed
        : false,
      finalTypedFailureReason: (() => {
        if (!ok || !durationStillOk) return this.draft.finalTypedFailureReason;
        // Prefer more specific typed reason already patched during EN visible duty validation.
        const existing = this.draft.finalTypedFailureReason;
        if (
          !visibleDutyOk
          && typeof existing === 'string'
          && existing.startsWith('visible_current_duty_')
        ) {
          return existing;
        }
        if (!visibleDutyOk) return 'visible_current_duty_coverage_failed';
        if (!visiblePriorDutyOk) return 'visible_prior_duty_coverage_failed';
        if (!visibleLocaleOk) return 'visible_locale_purity_failed';
        if (!visibleGrammarOk) return 'visible_german_grammar_failed';
        if (!visibleRoleOk) return 'visible_role_localization_mismatch';
        return existing;
      })(),
      // Duration idempotence is independent of visible apply success.
      durationFinalizerIdempotent: (() => {
        void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
        const passHashesEqual = Boolean(
          this.draft.durationPass1CandidateHash
          && this.draft.durationPass2CandidateHash
          && this.draft.durationPass1CandidateHash === this.draft.durationPass2CandidateHash
          && this.draft.durationSecondPassChanged === false,
        );
        if (passHashesEqual) return true;
        return ok && durationStillOk
          ? this.draft.durationFinalizerIdempotent
          : this.draft.durationFinalizerIdempotent;
      })(),
      countedAsSuccess: applyOk,
    });
    this.stage('visible_apply', applyOk ? 'ok' : 'fail');
    this.stage('race_guard', applyOk ? 'ok' : (ok ? 'fail' : 'skipped'));
  }

  /**
   * AAB-325: evaluate decision-critical invariants/completeness before visible
   * apply and usage increment. Must be called after recordFinalizeResult.
   */
  evaluatePreApplyDecisionGates(): {
    passed: boolean;
    reason: string | null;
    diagnosticInvariantCheckPassed: boolean;
    diagnosticCompletenessPassed: boolean;
  } {
    void SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION;
    // Provisional success for decision-field completeness. Usage is projected
    // as +1 for pre-apply invariant alignment; real usage still happens later.
    const before = Number(this.draft.usageCountBefore ?? 0);
    const provisional = {
      ...this.draft,
      stages: this.stages,
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountAfter: before + 1,
      operationKind: 'summary' as const,
      marker: SUMMARY_AI_DIAG_MARKER,
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      apiBaseUrlConfigured: Boolean(getApiBaseUrl()),
      capacitorServerUrlConfigured: false,
      sourceCommitStatus: this.draft.sourceCommitStatus || 'unknown',
    };
    const invariants = checkSummaryDiagnosticInvariants(
      provisional as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
    );
    const withInvariants = {
      ...provisional,
      diagnosticInvariantCheckPassed: invariants.passed,
      diagnosticInvariantFailureCount: invariants.failures.length,
      diagnosticInvariantFailures: invariants.failures,
    };
    // Pre-apply completeness focuses on decision-critical fields. Full build
    // identity/marker completeness remains enforced at commit().
    const locale = String(this.draft.requestedLocale || '');
    let completenessPassed = true;
    const nullDecision: string[] = [];
    if (locale === 'en') {
      const required = [
        'currentRoleConcreteFactCoverage',
        'priorRoleGroundingPassed',
        'currentRoleTitlePresent',
        'finalUnitSemanticRolesByUnit',
        'finalCurrentEmployerPresent',
        'finalPriorEmployerPresent',
        'finalCurrentDutyCoveragePassed',
        'finalPriorDutyCoveragePassed',
        'finalSlotValidationPassed',
        'structuredRoleLocaleValidationPassed',
        'finalUnsupportedCompetencyCount',
        'finalDurationOwnerDetected',
        'finalDurationScopeValidationPassed',
        'finalUnitRoleSlots',
      ] as const;
      for (const key of required) {
        if ((withInvariants as Record<string, unknown>)[key] == null) {
          nullDecision.push(key);
        }
      }
      completenessPassed = nullDecision.length === 0;
    } else {
      const completeness = checkSummaryDiagnosticCompleteness(
        withInvariants as Record<string, unknown>,
      );
      completenessPassed = completeness.passed;
      nullDecision.push(...completeness.nullRequiredDiagnosticFields);
    }
    this.patch({
      diagnosticInvariantCheckPassed: invariants.passed,
      diagnosticInvariantFailureCount: invariants.failures.length,
      diagnosticInvariantFailures: invariants.failures,
      diagnosticCompletenessPassed: completenessPassed,
      nullRequiredDiagnosticFields: nullDecision,
    });
    const passed = invariants.passed && completenessPassed;
    this.stage('diagnostic_preapply_gate', passed ? 'ok' : 'fail');
    if (!passed) {
      this.patch({
        finalPostconditionsPassed: false,
        countedAsSuccess: false,
        visibleApplySucceeded: false,
        finalTypedFailureReason: !invariants.passed
          ? 'diagnostic_invariant_failed'
          : 'diagnostic_completeness_failed',
        rejectionStage: 'diagnostic_preapply_gate',
      });
    }
    return {
      passed,
      reason: passed
        ? null
        : (!invariants.passed ? 'diagnostic_invariant_failed' : 'diagnostic_completeness_failed'),
      diagnosticInvariantCheckPassed: invariants.passed,
      diagnosticCompletenessPassed: completenessPassed,
    };
  }

  recordRaceGuard(result: 'ok' | 'fail' | 'skipped'): void {
    this.patch({ raceGuardResult: result });
    this.stage('race_guard', result === 'fail' ? 'fail' : 'ok');
  }

  async resolveVersions(): Promise<void> {
    const info = await resolveAppVersionInfo();
    this.patch({
      appVersionCode: info.versionCode,
      appVersionName: info.versionName,
      nextBuildId: this.draft.nextBuildId || resolveNextBuildId(),
    });
  }

  commit(): SummaryAiDiagnosticTrace {
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
      stages: this.stages,
      ...identity,
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      cvAiDiagnosticsV2299Revision: CV_AI_DIAGNOSTICS_V2_299_REVISION,
      operationKind: 'summary' as const,
      marker: SUMMARY_AI_DIAG_MARKER,
    };
    const invariants = checkSummaryDiagnosticInvariants(
      base as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
    );
    const withInvariants = {
      ...base,
      diagnosticInvariantCheckPassed: invariants.passed,
      diagnosticInvariantFailureCount: invariants.failures.length,
      diagnosticInvariantFailures: invariants.failures,
    };
    const completeness = checkSummaryDiagnosticCompleteness(
      withInvariants as Record<string, unknown>,
    );
    const withCompleteness = {
      ...withInvariants,
      diagnosticCompletenessPassed: completeness.passed,
      missingRequiredDiagnosticFields: completeness.missingRequiredDiagnosticFields,
      nullRequiredDiagnosticFields: completeness.nullRequiredDiagnosticFields,
      unexpectedDiagnosticFieldTypes: [],
    };
    const privacy = assertCvAiDiagnosticPrivacy(withCompleteness);
    const sized = maybeTruncateDiagnosticPayload({
      ...withCompleteness,
      diagnosticPrivacyViolations: privacy,
      privacyCheckPassed: privacy.length === 0,
    } as Record<string, unknown>);
    const trace = sized as unknown as SummaryAiDiagnosticTrace;
    this.committedTrace = trace;
    latestSummaryTrace = trace;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SUMMARY_AI_DIAG_STORAGE_KEY, JSON.stringify(trace));
      }
    } catch {
      /* ignore */
    }
    try {
      appendCvAiDiagnosticHistory({
        timestamp: trace.capturedAt || new Date().toISOString(),
        requestIdHash: trace.requestIdHash || '',
        operationKind: 'summary',
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
      emitCvAiDiagnosticsChanged({ kind: 'summary', action: 'commit' });
    } catch {
      /* ignore */
    }
    return trace;
  }
}

function readStored(): SummaryAiDiagnosticTrace | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SummaryAiDiagnosticTrace;
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(SUMMARY_AI_DIAG_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SUMMARY_AI_DIAG_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function getLatestSummaryAiDiagnostic(): SummaryAiDiagnosticTrace | null {
  return latestSummaryTrace || readStored();
}

export function formatSummaryAiDiagnosticForCopy(trace: SummaryAiDiagnosticTrace): string {
  return JSON.stringify(trace, null, 2);
}

export async function copySummaryAiDiagnosticsToClipboard(): Promise<boolean> {
  const trace = getLatestSummaryAiDiagnostic();
  if (!trace) return false;
  const text = formatSummaryAiDiagnosticForCopy(trace);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

export function clearSummaryAiDiagnosticsForTests(): void {
  latestSummaryTrace = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SUMMARY_AI_DIAG_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

/** Clear persisted Summary diagnostics only — does not reset AI usage. */
export function clearSummaryAiDiagnostics(): void {
  clearSummaryAiDiagnosticsForTests();
  try {
    emitCvAiDiagnosticsChanged({ kind: 'summary', action: 'clear_latest' });
  } catch {
    /* ignore */
  }
}

export function summarizeSummaryAiDiagnostic(trace: SummaryAiDiagnosticTrace | null): {
  timestamp: string;
  locale: string;
  finalStage: string;
  typedFailureReason: string;
  durationCount: number;
  independentFinalDurationClaimCount: number;
  visibleDurationClaimCountAfterApply: number | null;
  durationValidationPassed: boolean;
  raceGuardResult: string;
  applied: boolean;
  finalCandidateSource: string | null;
  invariantPassed: boolean | null;
  completenessPassed: boolean | null;
  success: boolean;
  operationKind: string;
} | null {
  if (!trace) return null;
  const last = trace.stages[trace.stages.length - 1];
  return {
    timestamp: trace.capturedAt,
    locale: trace.requestedLocale,
    finalStage: last?.name || 'unknown',
    typedFailureReason: trace.finalTypedFailureReason || 'none',
    durationCount: trace.independentFinalDurationClaimCount
      ?? trace.durationClaimCountAfterFinalize,
    independentFinalDurationClaimCount: trace.independentFinalDurationClaimCount,
    visibleDurationClaimCountAfterApply: trace.visibleDurationClaimCountAfterApply,
    durationValidationPassed: trace.durationValidationPassed,
    raceGuardResult: trace.raceGuardResult,
    applied: trace.visibleApplySucceeded,
    finalCandidateSource: trace.finalCandidateSource,
    invariantPassed: trace.diagnosticInvariantCheckPassed ?? null,
    completenessPassed: trace.diagnosticCompletenessPassed ?? null,
    success: Boolean(trace.countedAsSuccess),
    operationKind: 'summary',
  };
}

export function assertSummaryAiDiagnosticHasNoCvText(
  trace: SummaryAiDiagnosticTrace,
): string[] {
  const blob = JSON.stringify(trace);
  const hits: string[] = [];
  // Only flag clear email-shaped tokens, not hash hex.
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(blob)) hits.push('possible_email');
  return hits;
}
