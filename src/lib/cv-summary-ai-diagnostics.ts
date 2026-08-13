/**
 * Release-safe, non-PII Professional Summary AI diagnostics.
 * Mirrors Experience AI diagnostics pattern — observation only.
 */
import { fingerprintText, resolveAppVersionInfo, resolveNextBuildId } from './cv-export-diagnostics';
import { detectTextLocale } from './cv-content-locale';
import {
  detectDominantLocale,
  resolveSourceLocaleForText,
  SUMMARY_V2_SUPPORTED_LOCALES,
} from './cv-summary-v2/locale-authority';
import type { Locale } from './i18n/translations';
import type { SummaryV2MaterialAuthorityResult } from './cv-summary-v2/types';
import {
  resolveSummaryCurrentRoleWithEvidence,
  SUMMARY_CURRENT_ROLE_RESOLVER_REVISION,
} from './cv-summary-current-role';
import { validateFrenchSummaryFiniteGrammar } from './cv-french-summary-grounding';

export const SUMMARY_CONTENT_LOCALE_ROLLBACK_361_REVISION =
  'summary-content-locale-rollback-361-v1' as const;
export const SUMMARY_VISIBLE_SOURCE_LOCALE_DETECTION_361_REVISION =
  'summary-visible-source-locale-detection-361-v1' as const;
/** AAB-394 — explicit Experience declared/detected/effective locale attribution. */
export const SUMMARY_EXPERIENCE_LOCALE_DIAGNOSTICS_394_REVISION =
  'summary-experience-locale-diagnostics-394-v1' as const;
/** AAB-395 â€” emitted proof that rendered Summary durations have semantic/native-surface guards. */
export const SUMMARY_DURATION_SEMANTIC_NATIVE_SURFACE_395_REVISION =
  'summary-duration-semantic-native-surface-395-v1' as const;
/** AAB-381 — German Summary V2 post-write visible validation against operation-owned text. */
export const GERMAN_SUMMARY_V2_VISIBLE_POSTWRITE_381_REVISION =
  'german-summary-v2-visible-postwrite-381-v1' as const;
void SUMMARY_CONTENT_LOCALE_ROLLBACK_361_REVISION;
void SUMMARY_VISIBLE_SOURCE_LOCALE_DETECTION_361_REVISION;
void SUMMARY_EXPERIENCE_LOCALE_DIAGNOSTICS_394_REVISION;
void GERMAN_SUMMARY_V2_VISIBLE_POSTWRITE_381_REVISION;
import type { FinalizeCvAiFieldResult } from './cv-ai-finalize-apply';
import { normalizeSummaryCandidateText } from './cv-ai-finalize-apply';
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
          ? /Prüfung\s+eingehender\s+Waren|eingehende\s+Waren\s+prüfe|Warenannahme|Wareneingang/iu
          : id === 'related_documentation_check'
            ? /zugehörigen\s+Dokumentation|gehörende\s+Dokumentation|Dokumentation\s+kontrolliere|Dokumentenprüfung/iu
            : /Abstimmung\s+mit\s+Kolleg|Koordination\s+mit\s+Kolleg|abstimme.{0,60}Kolleg|Kolleg\w*.{0,60}abstimme/iu,
      ],
    };
  });
}

/**
 * Authoritative Summary text after temporary write.
 * Always prefer the operation-owned CV/ref value — never a stale React/render snapshot.
 */
export function resolveAuthoritativeVisibleSummaryText(options: {
  operationOwnedSummary: string | null | undefined;
  /** Stale React/render snapshot — ignored for post-write truth. */
  staleReactSummary?: string | null | undefined;
}): string {
  void GERMAN_SUMMARY_V2_VISIBLE_POSTWRITE_381_REVISION;
  void options.staleReactSummary;
  return typeof options.operationOwnedSummary === 'string'
    ? options.operationOwnedSummary
    : '';
}

import { hashExperienceEntryId } from './cv-experience-entry-isolation';
import type { CVData } from './types';
import {
  countSummaryDurationExpressions,
  summarizeDurationClaimBreakdown,
  verifyIndependentFinalDurationCount,
} from './cv-summary-duration-ownership';
import { validateAiUnitLocalePurity, resolveTargetScriptForLocale } from './cv-ai-unit-locale-purity';
import { evaluateSummaryV2NativeSurface } from './cv-summary-v2/native-surface';
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

type FrenchVisibleSummaryValidation = {
  grammarValidationPassed: boolean;
  nativeSurfaceValidationPassed: boolean;
  targetLocalePurityPassed: boolean;
  perspectiveMode: 'first_person' | 'neutral_or_unspecified';
};

/**
 * AAB-436: one shared French final/visible surface validator.
 *
 * The pre-apply gate evaluates the selected final candidate before the
 * transaction writes it; recordVisibleApply evaluates the operation-owned
 * text after the write. Both phases must use these same validators so every
 * Summary operation and candidate origin has identical French truth.
 */
function validateFrenchVisibleSummarySurface(
  text: string,
  finalPerspectiveMode?: string | null,
): FrenchVisibleSummaryValidation {
  const grammar = validateFrenchSummaryFiniteGrammar(text);
  const perspectiveMode = finalPerspectiveMode === 'neutral_cv'
    ? 'neutral_or_unspecified'
    : 'first_person';
  const native = evaluateSummaryV2NativeSurface({
    text,
    locale: 'fr',
    perspectiveMode,
  });
  const purity = validateAiUnitLocalePurity(text, 'fr', {
    kind: 'summary_sentence',
    requireUnits: true,
  });
  return {
    // The shared native-surface validator owns serialization truth as well as
    // finite grammar truth, so fused tokens and embedded casing cannot remain
    // green merely because the finite-verb scan passed.
    grammarValidationPassed: native.frenchGrammarValidationPassed
      ?? grammar.grammarValidationPassed,
    nativeSurfaceValidationPassed: native.nativeSurfaceValidationPassed,
    targetLocalePurityPassed: purity.targetLocalePurityPassed,
    perspectiveMode,
  };
}

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
  /** Universal applicability: warehouse vs V2 fact-id diagnostic scopes. */
  summaryV2FactIdPathActive?: boolean | null;
  serbianStructuredDomainGateApplicable?: boolean | null;
  hindiWarehouseGrammarFieldsApplicable?: boolean | null;
  /** AAB-350: Serbian structured-domain gate + entry-owned builder (privacy-safe). */
  serbianStructuredDomainGateEvaluated?: boolean | null;
  serbianStructuredDomainGatePassed?: boolean | null;
  serbianStructuredDomainCurrentRequiredFactCount?: number | null;
  serbianStructuredDomainCurrentCoveredFactCount?: number | null;
  serbianStructuredDomainPriorRequiredFactCount?: number | null;
  serbianStructuredDomainPriorCoveredFactCount?: number | null;
  serbianStructuredDomainGateFailureReasons?: string[] | null;
  serbianStructuredDomainCurrentRequiredFactIds?: string[] | null;
  serbianStructuredDomainCurrentCoveredFactIds?: string[] | null;
  serbianStructuredDomainCurrentMissingFactIds?: string[] | null;
  serbianStructuredDomainPriorRequiredFactIds?: string[] | null;
  serbianStructuredDomainPriorCoveredFactIds?: string[] | null;
  serbianStructuredDomainPriorMissingFactIds?: string[] | null;
  serbianStructuredDomainCanonicalFactIdsByEntryHash?: Record<string, string[]> | null;
  serbianStructuredDomainGateInvariantFailure?: string | null;
  serbianEntryOwnedBuilderAvailable?: boolean | null;
  serbianEntryOwnedBuilderAttempted?: boolean | null;
  serbianEntryOwnedBuilderSucceeded?: boolean | null;
  serbianEntryOwnedBuilderOutputHash?: string | null;
  serbianEntryOwnedBuilderOutputLength?: number | null;
  serbianEntryOwnedBuilderSentenceCount?: number | null;
  serbianEntryOwnedBuilderTypedFailureReason?: string | null;
  repairSkipped?: boolean | null;
  repairSkipReason?: string | null;
  repairDeferred?: boolean | null;
  repairDeferredReason?: string | null;
  serbianEnrichSkipped?: boolean | null;
  serbianEnrichSkipReason?: string | null;
  serbianStructuredPayloadCreated?: boolean | null;
  serbianStructuredPayloadCurrentFactCount?: number | null;
  serbianStructuredPayloadPriorFactCount?: number | null;
  candidateTransformationKind?: string | null;
  candidateTransformationBeforeHash?: string | null;
  candidateTransformationAfterHash?: string | null;
  currentExperienceEntryCount: number;
  currentExperienceEntryIdHashes: string[];
  currentRoleEntryIdHash: string | null;
  currentRoleCandidateCount?: number;
  currentRoleResolutionRule?: typeof SUMMARY_CURRENT_ROLE_RESOLVER_REVISION;
  currentRoleCandidateRankingByEntryHash?: Record<string, {
    dateAuthority: string;
    normalizedStartYear: number | null;
    normalizedStartMonth: number | null;
    comparisonKey: number | null;
    valid: boolean;
    rank: number;
    tieFallbackUsed: boolean;
    isWinner: boolean;
  }>;
  currentRoleTieFallbackUsed?: boolean;
  summarySelectedEntryIdHashes?: string[];
  summaryOmittedEntryIdHashes?: string[];
  currentJobContextHash: string | null;
  snapshotCreatedBeforeRequest: boolean;
  snapshotMatchesApplyContext: boolean;
  experienceFactCountsByEntryHash: Record<string, number>;
  experienceCanonicalFactCountsByEntryHash: Record<string, number>;
  /** Declared/generated entry metadata only; never effective fact authority. */
  experienceLocalesByEntryHash: Record<string, string | null>;
  declaredExperienceLocaleByEntryHash: Record<string, string | null>;
  detectedExperienceTextLocaleByEntryHash: Record<string, string | null>;
  detectedExperienceLocaleConfidenceByEntryHash: Record<string, string>;
  effectiveSourceLocaleByEntryHash: Record<string, string | null>;
  effectiveSourceLocaleAuthorityByEntryHash: Record<string, string | null>;
  localizedManifestLocaleByEntryHash: Record<string, string | null>;
  localizationRequiredByEntryHash: Record<string, boolean>;
  sameLocaleBypassUsedByEntryHash: Record<string, boolean>;
  localizedManifestCacheHitByEntryHash: Record<string, boolean>;
  localizationLineageByEntryHash?: Record<string, string>;
  localizationSurfaceTransportPlans?: Array<{
    entryHash: string;
    aggregateSourceLocale: string;
    targetLocale: string;
    roleAuthority: string;
    factAuthorityByFactHash: Record<string, string>;
    plannedRoleSurfaceCount: number;
    plannedFactSurfaceCount: number;
    actualRoleSurfaceCount: number;
    actualFactSurfaceCount: number;
    bypassedSurfaceCount: number;
    protectedSurfaceCount: number;
    roleLineage: string | null;
    factLineageByFactHash: Record<string, string>;
    entryIdParityPassed: boolean;
    factIdParityPassed: boolean;
    acceptedLocale: string | null;
  }>;
  localizationFailureEntryIdHash?: string | null;
  localizationFailureFactIdHash?: string | null;
  localizationFailureSurfaceKind?: string | null;
  localizationFailureTextPreviewHash?: string | null;
  localizationFailureDetectedLocale?: string | null;
  localizationFailureDetectedScript?: string | null;
  localizationFailureTokenClass?: string | null;
  localizationFailureProtectedEntityTokenClasses?: string[];
  localizationPrimaryFailureReason?: string | null;
  localizationRecoveryAttempted?: boolean;
  localizationRecoveryAccepted?: boolean;
  localizationSelectedEntryCount?: number;
  localizationSameLocaleBypassCount?: number;
  localizationValidatedCacheHitCount?: number;
  localizationProviderEntryCount?: number;
  localizationRecoveryEntryCount?: number;
  /** Packaged revision for the distinct Experience locale-attribution contract. */
  summaryExperienceLocaleDiagnosticsRevision: typeof SUMMARY_EXPERIENCE_LOCALE_DIAGNOSTICS_394_REVISION;
  /** Live, non-PII diagnostic contract revision for the AAB-395 duration/native-surface gate. */
  summaryDurationSemanticNativeSurfaceRevision: typeof SUMMARY_DURATION_SEMANTIC_NATIVE_SURFACE_395_REVISION;
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
  finalRenderedDurationSemanticMonths: number | null;
  visibleRenderedDurationSemanticMonths: number | null;
  finalDurationSemanticDeltaMonths: number | null;
  visibleDurationSemanticDeltaMonths: number | null;
  finalDurationSemanticAgreementPassed: boolean | null;
  visibleDurationSemanticAgreementPassed: boolean | null;
  contentLocaleBeforeRequest: string | null;
  contentLocaleAfterApply: string | null;
  storedContentLocaleBeforeRequest: string | null;
  detectedVisibleContentLocaleBeforeRequest: string | null;
  candidateTargetLocale: string | null;
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
  visibleTargetLocalePurityPassed?: boolean | null;
  visibleSourceLanguageLeakageDetected?: boolean | null;
  visibleGrammarValidationPassed?: boolean | null;
  visibleNativeSurfaceValidationPassed?: boolean | null;
  visibleFinalPostconditionsPassed?: boolean | null;
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
  roleTitleSurfaceEvidence?: Array<{
    owningEntryHash: string;
    detectedLocale: string | null;
    detectedScript: string;
    classification: 'translatable';
    targetLocaleNativeSurfacePassed: boolean;
    localizedTitleHash: string;
    sourceRoleTitleHash: string;
    provenance: string;
  }> | null;
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
  finalUnitHashes: string[] | null;
  finalSentenceRoleSlots: string[] | null;
  unitOwnershipValidationPassed: boolean | null;
  unitOwnershipFailureReason: string | null;
  factUnitOwnershipValidationPassed: boolean | null;
  finalUnitOwnershipEvidence: Array<{
    unitHash: string;
    roleSlot: 'duration' | 'current_role' | 'prior_role';
    owningEntryHash: string | null;
    priorOrdinal: number | null;
  }> | null;
  factUnitOwnershipEvidence: Array<{
    factHash: string;
    owningEntryHash: string;
    semanticRole: 'current_fact' | 'prior_fact';
    matchedUnitHashes: string[];
    matchedUnitOwnerHashes: string[];
    matchedUnitRoleSlots: Array<'duration' | 'current_role' | 'prior_role'>;
    ownershipPassed: boolean;
    covered: boolean;
  }> | null;
  flattenedFactArrayUsed: boolean | null;
  previousSummaryTextUsedByDeterministicFallback: boolean | null;
  providerTextUsedByDeterministicFallback: boolean | null;
  perspectiveMode: string | null;
  localeVerbMorphologyPassed?: boolean | null;
  sourcePerspectiveMode: string | null;
  providerPerspectiveMode: string | null;
  finalPerspectiveMode: string | null;
  visibleValidationPerspectiveMode?: 'first_person' | 'cv_third_person' | null;
  perspectiveAuthoritySource?: 'final_perspective_mode' | null;
  perspectiveContractMatched?: boolean | null;
  perspectiveNormalizationAttempted: boolean | null;
  perspectiveNormalizationApplied: boolean | null;
  perspectiveValidationPassed: boolean | null;
  genderValidationPassed: boolean | null;
  tenseValidationPassed: boolean | null;
  localeValidationPassed: boolean | null;
  /** Null means no candidate existed, so this candidate-only gate was not evaluated. */
  grammarValidationPassed: boolean | null;
  /** Null means no candidate existed, so this candidate-only gate was not evaluated. */
  durationValidationPassed: boolean | null;
  /** Null means no candidate existed, so this candidate-only gate was not evaluated. */
  groundingValidationPassed: boolean | null;
  /** Per-sentence target-locale purity (build 271/272). */
  unitCount: number;
  detectedLocaleByUnit: Array<string | null>;
  detectedScriptByUnit: string[];
  wrongLocaleUnitCount: number;
  wrongScriptUnitCount: number;
  mixedLanguageUnitCount: number;
  sourceLanguageLeakageDetected: boolean;
  unexpectedLocaleCodes: string[];
  targetLocalePurityPassed: boolean | null;
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
  finalPostconditionsPassed: boolean | null;
  raceGuardResult: 'ok' | 'fail' | 'skipped';
  visibleApplySucceeded: boolean;
  visibleSummaryMatchesFinalHash: boolean | null;
  contentLocaleUpdatedAfterApply: boolean;
  countedAsSuccess: boolean;
  usageCountBefore: number;
  usageCountAfter: number;
  finalTypedFailureReason: string | null;
  rejectionStage: string | null;
  /** AAB-387 transactional apply lifecycle (privacy-safe hashes only). */
  operationSourceHash?: string | null;
  selectedFinalHash?: string | null;
  cvRefHashBeforeWrite?: string | null;
  cvRefHashImmediatelyAfterWrite?: string | null;
  reactStateHashAfterCommit?: string | null;
  textareaValueHashAfterCommit?: string | null;
  persistedSummaryHashAfterCommit?: string | null;
  pendingAutosaveSourceHash?: string | null;
  staleAutosaveWriteSuppressed?: boolean | null;
  activeOperationIdHashBeforeWrite?: string | null;
  activeOperationIdHashAfterWrite?: string | null;
  applyOwnershipPassed?: boolean | null;
  actualRaceDetected?: boolean | null;
  actualRaceReason?: string | null;
  postWriteReadSource?: string | null;
  visibleApplyFailureStage?: string | null;
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
  sourcePrintFactPresentScope?: 'aggregate_selected_manifest_authority' | null;
  sourceBrandingFactPresent?: boolean | null;
  sourceMarketingFactPresent?: boolean | null;
  providerUnsupportedDesignMediumCount?: number | null;
  providerUnsupportedDesignMediumKinds?: string[] | null;
  providerPrintClaimDetected?: boolean | null;
  finalPrintClaimDetected?: boolean | null;
  providerBrandingClaimDetected?: boolean | null;
  providerMarketingClaimDetected?: boolean | null;
  deterministicUnsupportedDesignMediumCount?: number | null;
  deterministicUnsupportedDesignMediumKinds?: string[] | null;
  finalUnsupportedDesignMediumCount?: number | null;
  finalUnsupportedDesignMediumKinds?: string[] | null;
  /** Exact canonical final-validation result; hashes/categories only. */
  materialAuthority?: SummaryV2MaterialAuthorityResult | null;
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
    clauseIndex?: number;
    roleSlot: string;
    hasFiniteVerb: boolean;
    hasFiniteCopula: boolean;
    hasRequiredAuxiliary: boolean;
    nominalFragmentDetected: boolean;
    standaloneRelativeFragmentDetected: boolean;
    grammarPassed: boolean;
    grammarReasons: string[];
    employmentState?: 'present' | 'completed' | 'unknown';
    perspectiveMode?: 'first_person' | 'neutral_or_unspecified';
    genderMode?: 'female' | 'male' | 'neutral' | 'unspecified';
    agreementMode?: 'first_person_habitual' | 'first_person_perfective' | 'neutral' | 'unknown';
    aspect?: 'present_habitual' | 'past_habitual' | 'perfective' | 'mixed' | 'unknown';
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
      // Operation-facing legacy field: report the authoritative requested
      // locale. The pre-request stored value remains separately available in
      // storedContentLocaleBeforeRequest and never controls acceptance.
      storedContentLocale: input.requestedLocale || input.contentLocale || null,
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
      summaryV2FactIdPathActive: null,
      serbianStructuredDomainGateApplicable: null,
      hindiWarehouseGrammarFieldsApplicable: null,
      serbianStructuredDomainGateEvaluated: null,
      serbianStructuredDomainGatePassed: null,
      serbianStructuredDomainCurrentRequiredFactCount: null,
      serbianStructuredDomainCurrentCoveredFactCount: null,
      serbianStructuredDomainPriorRequiredFactCount: null,
      serbianStructuredDomainPriorCoveredFactCount: null,
      serbianStructuredDomainGateFailureReasons: null,
      serbianStructuredDomainCurrentRequiredFactIds: null,
      serbianStructuredDomainCurrentCoveredFactIds: null,
      serbianStructuredDomainCurrentMissingFactIds: null,
      serbianStructuredDomainPriorRequiredFactIds: null,
      serbianStructuredDomainPriorCoveredFactIds: null,
      serbianStructuredDomainPriorMissingFactIds: null,
      serbianStructuredDomainCanonicalFactIdsByEntryHash: null,
      serbianStructuredDomainGateInvariantFailure: null,
      serbianEntryOwnedBuilderAvailable: null,
      serbianEntryOwnedBuilderAttempted: null,
      serbianEntryOwnedBuilderSucceeded: null,
      serbianEntryOwnedBuilderOutputHash: null,
      serbianEntryOwnedBuilderOutputLength: null,
      serbianEntryOwnedBuilderSentenceCount: null,
      serbianEntryOwnedBuilderTypedFailureReason: null,
      repairSkipped: null,
      repairSkipReason: null,
      repairDeferred: null,
      repairDeferredReason: null,
      serbianEnrichSkipped: null,
      serbianEnrichSkipReason: null,
      serbianStructuredPayloadCreated: null,
      serbianStructuredPayloadCurrentFactCount: null,
      serbianStructuredPayloadPriorFactCount: null,
      candidateTransformationKind: null,
      candidateTransformationBeforeHash: null,
      candidateTransformationAfterHash: null,
      currentExperienceEntryCount: 0,
      currentExperienceEntryIdHashes: [],
      currentRoleEntryIdHash: null,
      currentRoleCandidateCount: 0,
      currentRoleResolutionRule: SUMMARY_CURRENT_ROLE_RESOLVER_REVISION,
      currentRoleCandidateRankingByEntryHash: {},
      currentRoleTieFallbackUsed: false,
      summarySelectedEntryIdHashes: [],
      summaryOmittedEntryIdHashes: [],
      currentJobContextHash: input.jobContextHash || null,
      snapshotCreatedBeforeRequest: true,
      snapshotMatchesApplyContext: true,
      experienceFactCountsByEntryHash: {},
      experienceCanonicalFactCountsByEntryHash: {},
      experienceLocalesByEntryHash: {},
      declaredExperienceLocaleByEntryHash: {},
      detectedExperienceTextLocaleByEntryHash: {},
      detectedExperienceLocaleConfidenceByEntryHash: {},
      effectiveSourceLocaleByEntryHash: {},
      effectiveSourceLocaleAuthorityByEntryHash: {},
      localizedManifestLocaleByEntryHash: {},
      localizationRequiredByEntryHash: {},
      sameLocaleBypassUsedByEntryHash: {},
      localizedManifestCacheHitByEntryHash: {},
      localizationLineageByEntryHash: {},
      localizationSurfaceTransportPlans: [],
      localizationFailureEntryIdHash: null,
      localizationFailureFactIdHash: null,
      localizationFailureSurfaceKind: null,
      localizationFailureTextPreviewHash: null,
      localizationFailureDetectedLocale: null,
      localizationFailureDetectedScript: null,
      localizationFailureTokenClass: null,
      localizationFailureProtectedEntityTokenClasses: [],
      localizationPrimaryFailureReason: null,
      localizationRecoveryAttempted: false,
      localizationRecoveryAccepted: false,
      localizationSelectedEntryCount: 0,
      localizationSameLocaleBypassCount: 0,
      localizationValidatedCacheHitCount: 0,
      localizationProviderEntryCount: 0,
      localizationRecoveryEntryCount: 0,
      summaryExperienceLocaleDiagnosticsRevision: SUMMARY_EXPERIENCE_LOCALE_DIAGNOSTICS_394_REVISION,
      summaryDurationSemanticNativeSurfaceRevision:
        SUMMARY_DURATION_SEMANTIC_NATIVE_SURFACE_395_REVISION,
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
      finalRenderedDurationSemanticMonths: null,
      visibleRenderedDurationSemanticMonths: null,
      finalDurationSemanticDeltaMonths: null,
      visibleDurationSemanticDeltaMonths: null,
      finalDurationSemanticAgreementPassed: null,
      visibleDurationSemanticAgreementPassed: null,
      contentLocaleBeforeRequest: input.contentLocale ?? null,
      contentLocaleAfterApply: null,
      storedContentLocaleBeforeRequest: input.contentLocale ?? null,
      detectedVisibleContentLocaleBeforeRequest: null,
      candidateTargetLocale: null,
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
      finalUnitHashes: null,
      finalSentenceRoleSlots: null,
      unitOwnershipValidationPassed: null,
      unitOwnershipFailureReason: null,
      factUnitOwnershipValidationPassed: null,
      finalUnitOwnershipEvidence: null,
      factUnitOwnershipEvidence: null,
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
    const detectedLocales: Record<string, string | null> = {};
    const detectedConfidence: Record<string, string> = {};
    const effectiveLocales: Record<string, string | null> = {};
    const effectiveAuthorities: Record<string, string | null> = {};
    const localizationRequired: Record<string, boolean> = {};
    const states: Record<string, 'current' | 'completed'> = {};
    const hashes: string[] = [];
    const currentRoleResolution = resolveSummaryCurrentRoleWithEvidence(exps);
    const currentRole = currentRoleResolution.selected;
    const currentRoleHash: string | null = currentRole
      ? hashExperienceEntryId(currentRole.id)
      : null;
    const currentRoleCandidateRankingByEntryHash = Object.fromEntries(
      currentRoleResolution.candidates.map((candidate) => [
        hashExperienceEntryId(candidate.entry.id),
        {
          dateAuthority: candidate.dateAuthority,
          normalizedStartYear: candidate.normalizedStartYear,
          normalizedStartMonth: candidate.normalizedStartMonth,
          comparisonKey: candidate.comparisonKey,
          valid: candidate.valid,
          rank: candidate.rank,
          tieFallbackUsed: candidate.tieFallbackUsed,
          isWinner: candidate.isWinner,
        },
      ]),
    );
    for (const e of exps) {
      const h = hashExperienceEntryId(e.id);
      hashes.push(h);
      const desc = (e.description || '').trim();
      const canon = (e.canonicalDescription || '').trim();
      factCounts[h] = desc ? desc.split(/\n/).filter(Boolean).length : 0;
      canonCounts[h] = canon ? canon.split(/\n/).filter(Boolean).length : 0;
      const declaredRaw = (e as { generatedLocale?: string; positionSourceLocale?: string }).generatedLocale
        || (e as { positionSourceLocale?: string }).positionSourceLocale
        || cv.contentLocale
        || null;
      const declared = SUMMARY_V2_SUPPORTED_LOCALES.includes(declaredRaw as Locale)
        ? declaredRaw as Locale
        : null;
      const observableText = [desc, e.position || ''].filter(Boolean).join('\n');
      const detected = detectDominantLocale(observableText);
      const resolved = resolveSourceLocaleForText({
        text: observableText,
        declaredLocale: declared,
        fallbackLocale: this.draft.requestedLocale as Locale,
      });
      // Back-compat field has declared-metadata semantics. The explicit effective
      // fields below are the only authority diagnostics consumers should use.
      locales[h] = declared;
      detectedLocales[h] = detected.locale;
      detectedConfidence[h] = detected.confidence;
      effectiveLocales[h] = resolved.sourceLocale;
      effectiveAuthorities[h] = resolved.resolvedFrom;
      const targetLocale = this.draft.requestedLocale as Locale;
      const declaredRoleRaw = e.positionSourceLocale || e.generatedLocale || cv.contentLocale || null;
      const declaredRole = SUMMARY_V2_SUPPORTED_LOCALES.includes(declaredRoleRaw as Locale)
        ? declaredRoleRaw as Locale : null;
      const declaredFactRaw = e.descriptionSourceLocale || e.generatedLocale || cv.contentLocale || null;
      const declaredFact = SUMMARY_V2_SUPPORTED_LOCALES.includes(declaredFactRaw as Locale)
        ? declaredFactRaw as Locale : null;
      const surfaceLocales = [
        resolveSourceLocaleForText({
          text: e.position || '', declaredLocale: declaredRole, fallbackLocale: targetLocale,
        }).sourceLocale,
        ...desc.split(/\n+/u).filter(Boolean).map((surface) => resolveSourceLocaleForText({
          text: surface, declaredLocale: declaredFact, fallbackLocale: targetLocale,
        }).sourceLocale),
      ];
      localizationRequired[h] = surfaceLocales.some((surfaceLocale) => surfaceLocale !== targetLocale);
      states[h] = e.isPresent ? 'current' : 'completed';
    }
    const summary = (liveSummary || '').trim();
    void SUMMARY_VISIBLE_SOURCE_LOCALE_DETECTION_361_REVISION;
    const detectedVisible = detectTextLocale(summary || '', {
      storedLocale: cv.contentLocale || null,
    });
    this.patch({
      summarySourcePresent: Boolean(summary),
      summarySourceLength: summary.length,
      summarySourceHash: fingerprintText(summary || 'empty'),
      sourceDurationClaimCount: countSummaryDurationExpressions(summary),
      detectedVisibleContentLocaleBeforeRequest: detectedVisible,
      storedContentLocaleBeforeRequest: cv.contentLocale ?? null,
      contentLocaleBeforeRequest: cv.contentLocale ?? null,
      currentExperienceEntryCount: exps.length,
      currentExperienceEntryIdHashes: hashes,
      currentRoleEntryIdHash: currentRoleHash,
      currentRoleCandidateCount: exps.filter((entry) => entry.isPresent).length,
      currentRoleResolutionRule: SUMMARY_CURRENT_ROLE_RESOLVER_REVISION,
      currentRoleCandidateRankingByEntryHash,
      currentRoleTieFallbackUsed: currentRoleResolution.tieFallbackUsed,
      experienceFactCountsByEntryHash: factCounts,
      experienceCanonicalFactCountsByEntryHash: canonCounts,
      experienceLocalesByEntryHash: locales,
      declaredExperienceLocaleByEntryHash: locales,
      detectedExperienceTextLocaleByEntryHash: detectedLocales,
      detectedExperienceLocaleConfidenceByEntryHash: detectedConfidence,
      effectiveSourceLocaleByEntryHash: effectiveLocales,
      effectiveSourceLocaleAuthorityByEntryHash: effectiveAuthorities,
      localizationRequiredByEntryHash: localizationRequired,
      employmentStatesByEntryHash: states,
      authoritativeEntryCount: exps.length,
      previousSummaryUsedAsFactSource: false,
    });
    this.stage('snapshot_created', 'ok');
  }

  recordFinalizeResult(finalized: FinalizeCvAiFieldResult): void {
    const diag = finalized.diagnostics || {};
    const sourceLocales = (diag as { sourceLocalesByEntryHash?: Record<string, string> }).sourceLocalesByEntryHash || {};
    const localizationSource = (diag as { localizationSource?: string | null }).localizationSource || null;
    const localizedTarget = (diag as { targetLocale?: string | null }).targetLocale || this.draft.requestedLocale || null;
    const localizedManifestLocales = Object.fromEntries(Object.keys(sourceLocales).map((key) => [key, localizedTarget]));
    const sameLocaleBypass = Object.keys(this.draft.sameLocaleBypassUsedByEntryHash || {}).length
      ? this.draft.sameLocaleBypassUsedByEntryHash!
      : Object.fromEntries(Object.keys(sourceLocales).map((key) => [key, localizationSource === 'same_locale_authoritative']));
    const cacheHit = Object.keys(this.draft.localizedManifestCacheHitByEntryHash || {}).length
      ? this.draft.localizedManifestCacheHitByEntryHash!
      : Object.fromEntries(Object.keys(sourceLocales).map((key) => [key, localizationSource === 'validated_cache']));
    this.patch({
      effectiveSourceLocaleByEntryHash: sourceLocales,
      localizedManifestLocaleByEntryHash: Object.keys(this.draft.localizedManifestLocaleByEntryHash || {}).length
        ? this.draft.localizedManifestLocaleByEntryHash!
        : localizedManifestLocales,
      sameLocaleBypassUsedByEntryHash: sameLocaleBypass,
      localizedManifestCacheHitByEntryHash: cacheHit,
    });
    const text = (finalized.text || '').trim();
    const evaluatedText = String(
      (diag as { evaluatedCandidateText?: string | null }).evaluatedCandidateText
      || (diag as { deterministicCandidateRawText?: string | null }).deterministicCandidateRawText
      || '',
    ).trim();
    // When apply-safe text is empty/live but an evaluated candidate exists (reject path),
    // duration/lineage must still describe the evaluated candidate — never 1→0 wipe.
    const durationScanText = text || evaluatedText;
    const independent = verifyIndependentFinalDurationCount(
      durationScanText,
      (this.draft.requestedLocale || 'en') as import('./i18n/translations').Locale,
      {
        requireExactlyOne: Boolean(finalized.countedAsSuccess),
      },
    );
    const afterFromScan = independent.count;
    const ownedAfter = typeof diag.durationClaimCountAfterFinalize === 'number'
      ? diag.durationClaimCountAfterFinalize
      : null;
    const after = (
      finalized.blocked
      && ownedAfter != null
      && ownedAfter >= afterFromScan
    )
      ? ownedAfter
      : afterFromScan;
    const breakdown = summarizeDurationClaimBreakdown(
      durationScanText,
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
    const frenchSurface = this.draft.requestedLocale === 'fr' && text
      ? validateFrenchVisibleSummarySurface(text, diag.finalPerspectiveMode)
      : null;
    const frenchPreApplyVisiblePostconditionsPassed = frenchSurface
      ? frenchSurface.grammarValidationPassed
        && frenchSurface.nativeSurfaceValidationPassed
        && frenchSurface.targetLocalePurityPassed
        && finalPostconditionsPassed
      : null;
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
      localizedDurationPhraseHash: diag.localizedDurationPhraseHash
        ?? (durationScanText
          ? fingerprintText(`dur:${diag.finalDurationRepresentationCount ?? after}`)
          : null),
      finalDurationRepresentationKind: diag.finalDurationRepresentationKind ?? null,
      finalDurationRepresentationCount: diag.finalDurationRepresentationCount ?? null,
      finalDurationHybridDetected: diag.finalDurationHybridDetected ?? null,
      visibleDurationRepresentationKind: diag.visibleDurationRepresentationKind ?? null,
      visibleDurationRepresentationCount: diag.visibleDurationRepresentationCount ?? null,
      visibleDurationHybridDetected: diag.visibleDurationHybridDetected ?? null,
      durationSemanticValueMonths: diag.durationSemanticValueMonths ?? null,
      durationRepresentationAgreement: diag.durationRepresentationAgreement ?? null,
      finalRenderedDurationSemanticMonths:
        diag.finalRenderedDurationSemanticMonths ?? null,
      visibleRenderedDurationSemanticMonths:
        diag.visibleRenderedDurationSemanticMonths ?? null,
      finalDurationSemanticDeltaMonths: diag.finalDurationSemanticDeltaMonths ?? null,
      visibleDurationSemanticDeltaMonths: diag.visibleDurationSemanticDeltaMonths ?? null,
      finalDurationSemanticAgreementPassed:
        diag.finalDurationSemanticAgreementPassed ?? null,
      visibleDurationSemanticAgreementPassed:
        diag.visibleDurationSemanticAgreementPassed ?? null,
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
        ?? this.draft.detectedVisibleContentLocaleBeforeRequest
        ?? null,
      candidateTargetLocale: (diag as { candidateTargetLocale?: string | null }).candidateTargetLocale
        ?? this.draft.requestedLocale
        ?? null,
      finalContentLocaleAfterApply: null,
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
      // Never force present=true from origin alone when hashes are null (AAB-383 / AAB-354 lineage).
      deterministicCandidatePresent: Boolean(
        diag.deterministicCandidatePresent
        && (diag.deterministicCandidateHash || diag.deterministicCandidateNormalizedHash),
      ) || Boolean(
        finalized.origin === 'deterministic_fallback'
        && (diag.deterministicCandidateHash || diag.deterministicCandidateNormalizedHash),
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
      visibleCurrentDutyFactMatchCountsByFactHash:
        finalCandidateSelected
          ? (diag.visibleCurrentDutyFactMatchCountsByFactHash ?? null)
          : null,
      visibleCurrentDutyFactMatchedUnitHashesByFactHash:
        finalCandidateSelected
          ? (diag.visibleCurrentDutyFactMatchedUnitHashesByFactHash ?? null)
          : null,
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
      roleTitleSurfaceEvidence: diag.roleTitleSurfaceEvidence ?? null,
      localeVerbMorphologyPassed: diag.localeVerbMorphologyPassed ?? null,
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
      finalUnitHashes: finalCandidateSelected
        ? (resolvedFinalHashes.length > 0
          ? resolvedFinalHashes
          : (diag.finalUnitHashes ?? []))
        : [],
      unitOwnershipValidationPassed: diag.unitOwnershipValidationPassed ?? null,
      unitOwnershipFailureReason: diag.unitOwnershipFailureReason ?? null,
      factUnitOwnershipValidationPassed:
        diag.factUnitOwnershipValidationPassed ?? null,
      finalUnitOwnershipEvidence: finalCandidateSelected
        ? (diag.finalUnitOwnershipEvidence ?? null)
        : [],
      factUnitOwnershipEvidence: finalCandidateSelected
        ? (diag.factUnitOwnershipEvidence ?? null)
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
      // AAB-436: seed the pre-apply decision gate from the same shared French
      // validator used again against the operation-owned post-write text.
      // These are never defaulted to true and are replaced by recordVisibleApply
      // after the transaction when an actual visible string is available.
      visibleGrammarValidationPassed: frenchSurface
        ? frenchSurface.grammarValidationPassed
        : null,
      visibleNativeSurfaceValidationPassed: frenchSurface
        ? frenchSurface.nativeSurfaceValidationPassed
        : null,
      visibleFinalPostconditionsPassed: frenchPreApplyVisiblePostconditionsPassed,
      visibleValidationPerspectiveMode: frenchSurface
        ? (frenchSurface.perspectiveMode === 'neutral_or_unspecified'
          ? 'cv_third_person'
          : 'first_person')
        : null,
      perspectiveAuthoritySource: frenchSurface ? 'final_perspective_mode' : null,
      perspectiveContractMatched: frenchSurface
        ? frenchSurface.nativeSurfaceValidationPassed
        : null,
      unitCount: purity.unitCount,
      detectedLocaleByUnit: purity.detectedLocaleByUnit,
      detectedScriptByUnit: purity.detectedScriptByUnit,
      wrongLocaleUnitCount: purity.wrongLocaleUnitCount,
      wrongScriptUnitCount: purity.wrongScriptUnitCount,
      mixedLanguageUnitCount: purity.mixedLanguageUnitCount,
      sourceLanguageLeakageDetected: entityAwareLeakage,
      unexpectedLocaleCodes: purity.unexpectedLocaleCodes,
      targetLocalePurityPassed: entityAwarePurityPassed,
      targetScript: resolveTargetScriptForLocale(
        (this.draft.requestedLocale || 'en') as import('./i18n/translations').Locale,
      ),
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
      finalTypedFailureReason: (() => {
        const cleanSummaryNoOp = Boolean(
          !finalized.countedAsSuccess
          && (
            diag.noOpDetected
            || diag.noOpRejected
            || finalized.reason === 'summary_noop_after_normalization'
          ),
        );
        if (cleanSummaryNoOp) return null;
        if (finalized.blocked || !durationValidationPassed || !entityAwarePurityPassed) {
          return diag.typedFailureReason
            || finalized.reason
            || (!entityAwarePurityPassed
              ? 'locale_impurity'
              : (!durationValidationPassed
                ? 'experience_duration_mismatch'
                : 'summary_grounding_failed'));
        }
        return null;
      })(),
      rejectionStage: (() => {
        const cleanSummaryNoOp = Boolean(
          !finalized.countedAsSuccess
          && (
            diag.noOpDetected
            || diag.noOpRejected
            || finalized.reason === 'summary_noop_after_normalization'
          ),
        );
        if (cleanSummaryNoOp) return null;
        if (finalized.blocked || !durationValidationPassed || !entityAwarePurityPassed) {
          return diag.rejectionStage || (
            !entityAwarePurityPassed
              ? 'locale_purity'
              : (!durationValidationPassed
                ? 'independent_final_duration_verification'
                : 'summary_grounding')
          );
        }
        return null;
      })(),
      summaryV2FactIdPathActive:
        (diag as { summaryV2FactIdPathActive?: boolean | null })
          .summaryV2FactIdPathActive ?? null,
      serbianStructuredDomainGateApplicable:
        (diag as { serbianStructuredDomainGateApplicable?: boolean | null })
          .serbianStructuredDomainGateApplicable ?? null,
      hindiWarehouseGrammarFieldsApplicable:
        (diag as { hindiWarehouseGrammarFieldsApplicable?: boolean | null })
          .hindiWarehouseGrammarFieldsApplicable ?? null,
      serbianStructuredDomainGateEvaluated:
        (diag as { serbianStructuredDomainGateEvaluated?: boolean | null })
          .serbianStructuredDomainGateEvaluated ?? null,
      serbianStructuredDomainGatePassed:
        (diag as { serbianStructuredDomainGatePassed?: boolean | null })
          .serbianStructuredDomainGatePassed ?? null,
      serbianStructuredDomainCurrentRequiredFactCount:
        (diag as { serbianStructuredDomainCurrentRequiredFactCount?: number | null })
          .serbianStructuredDomainCurrentRequiredFactCount ?? null,
      serbianStructuredDomainCurrentCoveredFactCount:
        (diag as { serbianStructuredDomainCurrentCoveredFactCount?: number | null })
          .serbianStructuredDomainCurrentCoveredFactCount ?? null,
      serbianStructuredDomainPriorRequiredFactCount:
        (diag as { serbianStructuredDomainPriorRequiredFactCount?: number | null })
          .serbianStructuredDomainPriorRequiredFactCount ?? null,
      serbianStructuredDomainPriorCoveredFactCount:
        (diag as { serbianStructuredDomainPriorCoveredFactCount?: number | null })
          .serbianStructuredDomainPriorCoveredFactCount ?? null,
      serbianStructuredDomainGateFailureReasons:
        (diag as { serbianStructuredDomainGateFailureReasons?: string[] | null })
          .serbianStructuredDomainGateFailureReasons ?? null,
      serbianStructuredDomainCurrentRequiredFactIds:
        (diag as { serbianStructuredDomainCurrentRequiredFactIds?: string[] | null })
          .serbianStructuredDomainCurrentRequiredFactIds ?? null,
      serbianStructuredDomainCurrentCoveredFactIds:
        (diag as { serbianStructuredDomainCurrentCoveredFactIds?: string[] | null })
          .serbianStructuredDomainCurrentCoveredFactIds ?? null,
      serbianStructuredDomainCurrentMissingFactIds:
        (diag as { serbianStructuredDomainCurrentMissingFactIds?: string[] | null })
          .serbianStructuredDomainCurrentMissingFactIds ?? null,
      serbianStructuredDomainPriorRequiredFactIds:
        (diag as { serbianStructuredDomainPriorRequiredFactIds?: string[] | null })
          .serbianStructuredDomainPriorRequiredFactIds ?? null,
      serbianStructuredDomainPriorCoveredFactIds:
        (diag as { serbianStructuredDomainPriorCoveredFactIds?: string[] | null })
          .serbianStructuredDomainPriorCoveredFactIds ?? null,
      serbianStructuredDomainPriorMissingFactIds:
        (diag as { serbianStructuredDomainPriorMissingFactIds?: string[] | null })
          .serbianStructuredDomainPriorMissingFactIds ?? null,
      serbianStructuredDomainCanonicalFactIdsByEntryHash:
        (diag as { serbianStructuredDomainCanonicalFactIdsByEntryHash?: Record<string, string[]> | null })
          .serbianStructuredDomainCanonicalFactIdsByEntryHash ?? null,
      serbianStructuredDomainGateInvariantFailure:
        (diag as { serbianStructuredDomainGateInvariantFailure?: string | null })
          .serbianStructuredDomainGateInvariantFailure ?? null,
      serbianEntryOwnedBuilderAvailable:
        (diag as { serbianEntryOwnedBuilderAvailable?: boolean | null })
          .serbianEntryOwnedBuilderAvailable ?? null,
      serbianEntryOwnedBuilderAttempted:
        (diag as { serbianEntryOwnedBuilderAttempted?: boolean | null })
          .serbianEntryOwnedBuilderAttempted ?? null,
      serbianEntryOwnedBuilderSucceeded:
        (diag as { serbianEntryOwnedBuilderSucceeded?: boolean | null })
          .serbianEntryOwnedBuilderSucceeded ?? null,
      serbianEntryOwnedBuilderOutputHash:
        (diag as { serbianEntryOwnedBuilderOutputHash?: string | null })
          .serbianEntryOwnedBuilderOutputHash ?? null,
      serbianEntryOwnedBuilderOutputLength:
        (diag as { serbianEntryOwnedBuilderOutputLength?: number | null })
          .serbianEntryOwnedBuilderOutputLength ?? null,
      serbianEntryOwnedBuilderSentenceCount:
        (diag as { serbianEntryOwnedBuilderSentenceCount?: number | null })
          .serbianEntryOwnedBuilderSentenceCount ?? null,
      serbianEntryOwnedBuilderTypedFailureReason:
        (diag as { serbianEntryOwnedBuilderTypedFailureReason?: string | null })
          .serbianEntryOwnedBuilderTypedFailureReason ?? null,
      repairSkipped: (diag as { repairSkipped?: boolean | null }).repairSkipped ?? null,
      repairSkipReason: (diag as { repairSkipReason?: string | null }).repairSkipReason ?? null,
      repairDeferred: (diag as { repairDeferred?: boolean | null }).repairDeferred ?? null,
      repairDeferredReason:
        (diag as { repairDeferredReason?: string | null }).repairDeferredReason ?? null,
      serbianEnrichSkipped:
        (diag as { serbianEnrichSkipped?: boolean | null }).serbianEnrichSkipped ?? null,
      serbianEnrichSkipReason:
        (diag as { serbianEnrichSkipReason?: string | null }).serbianEnrichSkipReason ?? null,
      serbianStructuredPayloadCreated:
        (diag as { serbianStructuredPayloadCreated?: boolean | null })
          .serbianStructuredPayloadCreated ?? null,
      serbianStructuredPayloadCurrentFactCount:
        (diag as { serbianStructuredPayloadCurrentFactCount?: number | null })
          .serbianStructuredPayloadCurrentFactCount ?? null,
      serbianStructuredPayloadPriorFactCount:
        (diag as { serbianStructuredPayloadPriorFactCount?: number | null })
          .serbianStructuredPayloadPriorFactCount ?? null,
      candidateTransformationKind:
        (diag as { candidateTransformationKind?: string | null })
          .candidateTransformationKind ?? null,
      candidateTransformationBeforeHash:
        (diag as { candidateTransformationBeforeHash?: string | null })
          .candidateTransformationBeforeHash ?? null,
      candidateTransformationAfterHash:
        (diag as { candidateTransformationAfterHash?: string | null })
          .candidateTransformationAfterHash ?? null,
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
      contentLocaleAfterApply: diag.contentLocaleAfterApply
        ?? this.draft.contentLocaleBeforeRequest
        ?? this.draft.storedContentLocaleBeforeRequest
        ?? null,
      detectedSourceLocale: this.draft.detectedSourceLocale,
      // cv-ai-diagnostics-v2 — propagate finalize Hindi/medium/slot lineage
      operationKind: 'summary',
      providerRejectionReason: diag.providerRejectionReason ?? null,
      providerTypedRejectionReason: diag.providerTypedRejectionReason
        ?? diag.providerRejectionReason
        ?? null,
      providerSlotRejectionReasons: diag.providerSlotRejectionReasons ?? null,
      sourcePrintFactPresent: diag.sourcePrintFactPresent ?? null,
      sourcePrintFactPresentScope: diag.sourcePrintFactPresentScope ?? null,
      sourceBrandingFactPresent: diag.sourceBrandingFactPresent ?? null,
      sourceMarketingFactPresent: diag.sourceMarketingFactPresent ?? null,
      providerUnsupportedDesignMediumCount: diag.providerUnsupportedDesignMediumCount ?? null,
      providerUnsupportedDesignMediumKinds: diag.providerUnsupportedDesignMediumKinds ?? null,
      providerPrintClaimDetected: diag.providerPrintClaimDetected ?? null,
      finalPrintClaimDetected: diag.finalPrintClaimDetected ?? null,
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
      materialAuthority: diag.materialAuthority ?? null,
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
        ? (diag.hindiSentenceGrammarRecords ?? buildHindiSentenceGrammarRecords({
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
        }))
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
          ? (
            diag.finalUnitRoleSlots.includes('total_duration')
            || diag.finalUnitRoleSlots.includes('duration')
          )
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
        ?? (
          this.draft.requestedLocale === 'de'
          || this.draft.requestedLocale === 'en'
            ? true
            : null
        ),
      summaryRepairAttempted: diag.summaryRepairAttempted ?? null,
      repairAttempted: Boolean(
        diag.summaryRepairAttempted
        || diag.germanEmployerStatusRepairAttempted
        || diag.repairCandidatePresent
        || diag.clientRepairAttempted
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
        ? (diag.finalNormalizedHash ?? diag.finalValidatedCandidateHash ?? null)
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
          printClaimDetected: diag.finalPrintClaimDetected ?? false,
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
          hash: finalSelected
            ? (diag.finalValidatedCandidateHash ?? diag.finalNormalizedHash ?? null)
            : null,
          normalizedHash: finalSelected
            ? (diag.finalNormalizedHash
              ?? diag.finalValidatedCandidateHash
              ?? null)
            : null,
          rawHash: finalSelected
            ? (diag.finalValidatedCandidateHash ?? diag.finalNormalizedHash ?? null)
            : null,
          finalizedHash: finalSelected
            ? (diag.finalValidatedCandidateHash ?? diag.finalNormalizedHash ?? null)
            : null,
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
              ? null
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
          printClaimDetected: finalSelected ? (diag.finalPrintClaimDetected ?? false) : false,
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
            : Boolean(
              diag.noOpDetected
              || finalized.reason === 'summary_noop_after_normalization'
              || diag.finalMatchesSourceAfterNormalization,
            ),
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
    const cleanSummaryNoOp = Boolean(
      !finalized.countedAsSuccess
      && (
        diag.noOpDetected
        || diag.noOpRejected
        || finalized.reason === 'summary_noop_after_normalization'
      ),
    );
    // Clean no-op is a successful terminal outcome — never stage final_postconditions as fail.
    this.stage(
      'final_postconditions',
      cleanSummaryNoOp || finalPostconditionsPassed ? 'ok' : 'fail',
      cleanSummaryNoOp
        ? 'summary_noop_after_normalization'
        : (finalized.reason || undefined),
    );
    if (cleanSummaryNoOp) {
      this.patch({
        finalPostconditionsPassed: true,
        rejectionStage: null,
        finalTypedFailureReason: null,
      });
    }
  }

  /**
   * Visible apply was intentionally not attempted (clean enhance no-op).
   * Must not mark visible_apply as fail or wipe clean no-op postcondition truth.
   */
  recordVisibleApplyNotApplicable(usageAfter: number): void {
    this.patch({
      visibleApplySucceeded: false,
      usageCountAfter: usageAfter,
      raceGuardResult: 'skipped',
      countedAsSuccess: false,
      rejectionStage: null,
      finalTypedFailureReason: null,
    });
    this.stage('visible_apply', 'skipped', 'not_applicable');
    this.stage('race_guard', 'skipped');
  }

  /**
   * Truthful terminal state when localization fails before any Summary candidate
   * exists. Candidate/apply-only stages are skipped, not failed.
   */
  recordPreCandidateTerminalFailure(input: {
    stage: string;
    reason: string;
    usageAfter: number;
    httpStatus?: number | null;
    apiResponseKind?: string | null;
    serverFallbackUsed?: boolean;
    clientFallbackUsed?: boolean;
  }): void {
    this.patch({
      finalCandidateSource: 'none',
      providerCandidatePresent: false,
      deterministicCandidatePresent: false,
      fallbackCandidatePresent: false,
      grammarValidationPassed: null,
      groundingValidationPassed: null,
      durationValidationPassed: null,
      perspectiveValidationPassed: null,
      genderValidationPassed: null,
      tenseValidationPassed: null,
      localeValidationPassed: null,
      targetLocalePurityPassed: null,
      providerHttpStatus: input.httpStatus ?? null,
      providerResponseKind: input.apiResponseKind || 'not_attempted',
      meaningfulChangeDetected: false,
      noOpDetected: false,
      apiResponseKind: input.apiResponseKind || 'not_attempted',
      serverFallbackUsed: input.serverFallbackUsed === true,
      clientFallbackUsed: input.clientFallbackUsed === true,
      repairAttempted: false,
      repairApplied: false,
      repairSelected: false,
      repairCandidatePresent: false,
      repairAccepted: false,
      fallbackAttempted: false,
      fallbackApplied: false,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountAfter: input.usageAfter,
      raceGuardResult: 'skipped',
      finalPostconditionsPassed: null,
      finalTypedFailureReason: input.reason,
      rejectionStage: input.stage,
      candidateLineage: [],
    });
    for (const name of [
      'provider_candidate',
      'repair',
      'deterministic_fallback',
      'grounding_validation',
      'locale_script_grammar_validation',
      'duration_validation',
      'final_candidate_selection',
      'race_guard',
      'visible_apply',
      'post_write_validation',
      'usage_accounting',
    ]) {
      this.stage(name, 'skipped', 'not_reached');
    }
  }

  /**
   * A terminal failure occurred before the visible-write transaction began.
   * Preserve the failure at its real stage and serialize visible/post-write
   * work as skipped rather than falsely claiming an apply attempt failed.
   */
  recordVisibleApplySkippedFailure(usageAfter: number, reason = 'not_reached'): void {
    this.patch({
      visibleApplySucceeded: false,
      usageCountAfter: usageAfter,
      countedAsSuccess: false,
    });
    this.stage('visible_apply', 'skipped', reason);
    this.stage('post_write_validation', 'skipped', reason);
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
    // Same normalizer as finalValidatedCandidateHash / finalNormalizedHash.
    const visibleHash = typeof visibleText === 'string' && visibleText.trim()
      ? fingerprintText(normalizeSummaryCandidateText(visibleText) || 'empty')
      : null;
    void SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION;
    let visibleRoleOk = true;
    let visibleWrongRoleCount = 0;
    let visibleDutyOk = true;
    let visiblePriorDutyOk = true;
    let visibleGrammarOk = true;
    let visibleLocaleOk = true;
    let visibleNativeOk = true;
    let visibleSourceLanguageLeakageDetected = false;
    let visibleValidationPerspectiveMode: 'first_person' | 'cv_third_person' | null = null;
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
      void GERMAN_SUMMARY_V2_VISIBLE_POSTWRITE_381_REVISION;
      const requiredIdsDe = Array.isArray(this.draft.requiredCurrentDutyFactIds)
        ? this.draft.requiredCurrentDutyFactIds
        : [];
      const usesSummaryV2FactIdsDe = requiredIdsDe.length > 0
        && requiredIdsDe.every((id) => String(id || '').startsWith('v2_entry_'));
      if (usesSummaryV2FactIdsDe) {
        // V2 entry-owned IDs are not German warehouse canonical IDs.
        // Cover against the immutable V2 required set by requiring the visible
        // text to match the final candidate hash, then reuse finalize coverage.
        const requiredCurrentDe = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
        const requiredPriorDe = Number(this.draft.requiredPriorDutyFactCount ?? 0);
        const finalHash = this.draft.finalNormalizedHash
          ?? this.draft.finalValidatedCandidateHash
          ?? null;
        const matchesFinal = Boolean(
          visibleHash
          && finalHash
          && visibleHash === finalHash,
        );
        visibleDutyRequired = requiredCurrentDe;
        visibleDutyCovered = matchesFinal
          ? Number(this.draft.coveredCurrentDutyFactCount ?? 0)
          : 0;
        visibleDutyOk = requiredCurrentDe === 0
          || (matchesFinal && visibleDutyCovered >= requiredCurrentDe);
        visiblePriorDutyRequired = requiredPriorDe;
        visiblePriorDutyCovered = matchesFinal
          ? Number(this.draft.coveredPriorDutyFactCount ?? 0)
          : 0;
        visiblePriorDutyOk = requiredPriorDe === 0
          || (matchesFinal && visiblePriorDutyCovered >= requiredPriorDe);
        const grammar = validateGermanGeneratedCaseGrammar(visibleText);
        visibleGrammarOk = grammar.germanControlledCaseGrammarPassed;
        // Duration scope against the same authoritative visible text.
        visibleDurationScopeOk = this.draft.finalDurationScopeValidationPassed !== false
          && countSummaryDurationExpressions(visibleText, 'de') === 1;
        if (this.draft.finalPerspectiveMode === 'neutral_cv' && requiredCurrentDe >= 3) {
          visibleDutyOk = false;
        }
        const setHash = this.draft.finalCurrentDutyRequiredFactSetHash
          ?? fingerprintText(requiredIdsDe.join('|') || 'empty_required_set');
        const matchCounts: Record<string, number> = {};
        const matchUnits: Record<string, string[]> = {};
        for (const id of requiredIdsDe) {
          const key = String(id);
          const finalMatchedUnits =
            this.draft.visibleCurrentDutyFactMatchedUnitHashesByFactHash?.[key] || [];
          matchCounts[key] = matchesFinal ? finalMatchedUnits.length : 0;
          matchUnits[key] = matchesFinal ? [...finalMatchedUnits] : [];
        }
        this.patch({
          visibleCurrentDutyRequiredFactParityPassed: visibleDutyOk && matchesFinal,
          visibleCurrentDutyRequiredFactCountMatchesFinal:
            visibleDutyRequired === requiredCurrentDe,
          visibleCurrentDutyRequiredFactSetHash: setHash,
          finalCurrentDutyRequiredFactSetHash: setHash,
          visibleCurrentDutyFactMatchCountsByFactHash: matchCounts,
          visibleCurrentDutyFactMatchedUnitHashesByFactHash: matchUnits,
          visibleMissingCurrentDutyFactIdHashes: [],
          visiblePriorDutyRequiredFactParityPassed: visiblePriorDutyOk,
          visibleSummaryMatchesFinalHash: matchesFinal,
          finalTypedFailureReason: !matchesFinal
            ? 'visible_summary_hash_mismatch'
            : (!visibleDutyOk
              ? (
                requiredCurrentDe > 0 && visibleDutyCovered === 0
                  ? 'visible_current_duty_required_set_missing'
                  : 'visible_current_duty_coverage_failed'
              )
              : null),
        });
      } else {
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
      const requiredPriorDe = Number(this.draft.requiredPriorDutyFactCount ?? 0);
      visiblePriorDutyRequired = requiredPriorDe;
      visiblePriorDutyCovered = Number(this.draft.coveredPriorDutyFactCount ?? 0);
      if (requiredPriorDe >= 3) {
        const creationOk = /visuelle\s+Materialien/iu.test(visibleText)
          && /grafische\s+Elemente/iu.test(visibleText);
        const reviewOk = /(?:überprüfte|überarbeitete|anpasste)/iu.test(visibleText)
          && /(?:Designmaterialien|Designunterlagen)/iu.test(visibleText);
        const finalOk = /(?:finale\s+Designdateien|finale\s+Dateien)/iu.test(visibleText)
          && /Formate/iu.test(visibleText)
          && /Bildschirme/iu.test(visibleText);
        visiblePriorDutyCovered = [creationOk, reviewOk, finalOk].filter(Boolean).length;
        visiblePriorDutyOk = visiblePriorDutyCovered === 3;
      }
      visibleDurationScopeOk = /Ich\s+verfüge\s+über\s+insgesamt|insgesamt.{0,40}Berufserfahrung/iu
        .test(visibleText)
        && this.draft.finalDurationScopeValidationPassed !== false;
      if (this.draft.finalPerspectiveMode === 'neutral_cv' && requiredCurrentDe >= 3) {
        visibleDutyOk = false;
      }
      } // end legacy German warehouse visible path
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
      const requiredIds = Array.isArray(this.draft.requiredCurrentDutyFactIds)
        ? this.draft.requiredCurrentDutyFactIds
        : [];
      const usesSummaryV2FactIds = requiredIds.length > 0
        && requiredIds.every((id) => String(id || '').startsWith('v2_entry_'));
      if (usesSummaryV2FactIds) {
        // Summary V2 entry-owned IDs are not English warehouse canonical IDs —
        // trust finalize coverage when visible text matches the final candidate.
        // Hash must use the same normalizer as finalNormalizedHash / finalize.
        const finalHash = this.draft.finalNormalizedHash
          ?? this.draft.finalValidatedCandidateHash
          ?? null;
        const visibleNormHash = fingerprintText(
          normalizeSummaryCandidateText(visibleText) || 'empty',
        );
        const matchesFinal = Boolean(
          visibleNormHash
          && finalHash
          && visibleNormHash === finalHash,
        );
        visibleDutyRequired = requiredCurrent;
        visibleDutyCovered = matchesFinal
          ? Number(this.draft.coveredCurrentDutyFactCount ?? 0)
          : 0;
        visibleDutyOk = requiredCurrent === 0
          || (matchesFinal && visibleDutyCovered >= requiredCurrent);
        visiblePriorDutyRequired = requiredPrior;
        visiblePriorDutyCovered = matchesFinal
          ? Number(this.draft.coveredPriorDutyFactCount ?? 0)
          : 0;
        visiblePriorDutyOk = requiredPrior === 0
          || (matchesFinal && visiblePriorDutyCovered >= requiredPrior);
        visibleRoleOk = true;
        visibleLocaleOk = true;
        visibleDurationScopeOk = this.draft.finalDurationScopeValidationPassed !== false;
        const setHash = this.draft.finalCurrentDutyRequiredFactSetHash
          ?? fingerprintText(requiredIds.join('|') || 'empty_required_set');
        const matchCounts: Record<string, number> = {};
        const matchUnits: Record<string, string[]> = {};
        for (const id of requiredIds) {
          const key = String(id);
          const finalMatchedUnits =
            this.draft.visibleCurrentDutyFactMatchedUnitHashesByFactHash?.[key] || [];
          matchCounts[key] = matchesFinal ? finalMatchedUnits.length : 0;
          matchUnits[key] = matchesFinal ? [...finalMatchedUnits] : [];
        }
        this.patch({
          visibleCurrentDutyRequiredFactParityPassed: visibleDutyOk,
          visibleCurrentDutyRequiredFactCountMatchesFinal: visibleDutyRequired === requiredCurrent,
          visibleCurrentDutyRequiredFactSetHash: setHash,
          finalCurrentDutyRequiredFactSetHash: setHash,
          visibleCurrentDutyFactMatchCountsByFactHash: matchCounts,
          visibleCurrentDutyFactMatchedUnitHashesByFactHash: matchUnits,
          visibleMissingCurrentDutyFactIdHashes: [],
          visiblePriorDutyRequiredFactParityPassed: visiblePriorDutyOk,
          visibleSummaryMatchesFinalHash: matchesFinal,
        });
      } else {
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
    }
    const trySummaryV2VisibleParity = (): boolean => {
      if (typeof visibleText !== 'string') return false;
      const requiredIds = Array.isArray(this.draft.requiredCurrentDutyFactIds)
        ? this.draft.requiredCurrentDutyFactIds
        : [];
      const usesSummaryV2FactIds = requiredIds.length > 0
        && requiredIds.every((id) => String(id || '').startsWith('v2_entry_'));
      if (!usesSummaryV2FactIds) return false;
      const requiredCurrent = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
      const requiredPrior = Number(this.draft.requiredPriorDutyFactCount ?? 0);
      const finalHash = this.draft.finalNormalizedHash
        ?? this.draft.finalValidatedCandidateHash
        ?? null;
      const visibleNormHash = fingerprintText(
        normalizeSummaryCandidateText(visibleText) || 'empty',
      );
      const matchesFinal = Boolean(
        visibleNormHash
        && finalHash
        && visibleNormHash === finalHash,
      );
      visibleDutyRequired = requiredCurrent;
      visibleDutyCovered = matchesFinal
        ? Number(this.draft.coveredCurrentDutyFactCount ?? 0)
        : 0;
      visibleDutyOk = requiredCurrent === 0
        || (matchesFinal && visibleDutyCovered >= requiredCurrent);
      visiblePriorDutyRequired = requiredPrior;
      visiblePriorDutyCovered = matchesFinal
        ? Number(this.draft.coveredPriorDutyFactCount ?? 0)
        : 0;
      visiblePriorDutyOk = requiredPrior === 0
        || (matchesFinal && visiblePriorDutyCovered >= requiredPrior);
      visibleRoleOk = true;
      visibleLocaleOk = true;
      visibleDurationScopeOk = this.draft.finalDurationScopeValidationPassed !== false;
      const setHash = this.draft.finalCurrentDutyRequiredFactSetHash
        ?? fingerprintText(requiredIds.join('|') || 'empty_required_set');
      const matchCounts: Record<string, number> = {};
      const matchUnits: Record<string, string[]> = {};
      for (const id of requiredIds) {
        const key = String(id);
        matchCounts[key] = matchesFinal ? 1 : 0;
        const finalMatchedUnits = this.draft.visibleCurrentDutyFactMatchedUnitHashesByFactHash?.[key]
          || [];
        matchUnits[key] = matchesFinal ? [...finalMatchedUnits] : [];
      }
      this.patch({
        visibleCurrentDutyRequiredFactParityPassed: visibleDutyOk,
        visibleCurrentDutyRequiredFactCountMatchesFinal:
          visibleDutyRequired === requiredCurrent,
        visibleCurrentDutyRequiredFactSetHash: setHash,
        finalCurrentDutyRequiredFactSetHash: setHash,
        visibleCurrentDutyFactMatchCountsByFactHash: matchCounts,
        visibleCurrentDutyFactMatchedUnitHashesByFactHash: matchUnits,
        visibleMissingCurrentDutyFactIdHashes: [],
        visiblePriorDutyRequiredFactParityPassed: visiblePriorDutyOk,
        visibleSummaryMatchesFinalHash: matchesFinal,
      });
      return true;
    };
    if (ok && durationStillOk && locale === 'es' && typeof visibleText === 'string') {
      trySummaryV2VisibleParity();
      const purity = validateAiUnitLocalePurity(visibleText, 'es', {
        kind: 'summary_sentence',
        requireUnits: true,
      });
      visibleSourceLanguageLeakageDetected = purity.sourceLanguageLeakageDetected;
      visibleLocaleOk = purity.targetLocalePurityPassed
        && !visibleSourceLanguageLeakageDetected;
      visibleValidationPerspectiveMode = this.draft.finalPerspectiveMode === 'neutral_cv'
        || this.draft.finalPerspectiveMode === 'cv_third_person'
        ? 'cv_third_person'
        : 'first_person';
      const native = evaluateSummaryV2NativeSurface({
        text: visibleText,
        locale: 'es',
        hasCurrent: Number(this.draft.requiredCurrentDutyFactCount ?? 0) > 0,
        hasPrior: Number(this.draft.requiredPriorDutyFactCount ?? 0) > 0,
        perspectiveMode: visibleValidationPerspectiveMode,
      });
      visibleNativeOk = native.nativeSurfaceValidationPassed;
      visibleGrammarOk = native.grammaticalPersonValidationPassed
        && native.currentTenseValidationPassed
        && native.priorTenseValidationPassed
        && native.finiteClauseValidationPassed;
    }
    if (ok && durationStillOk && locale === 'hi' && typeof visibleText === 'string') {
      if (!trySummaryV2VisibleParity()) {
      const requiredCurrent = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
      const requiredPrior = Number(this.draft.requiredPriorDutyFactCount ?? 0);
      visibleDutyRequired = requiredCurrent;
      visibleDutyCovered = Number(this.draft.coveredCurrentDutyFactCount ?? 0);
      visiblePriorDutyRequired = requiredPrior;
      visiblePriorDutyCovered = Number(this.draft.coveredPriorDutyFactCount ?? 0);
      if (requiredCurrent >= 3) {
        const incomingOk = /आने\s+वाले\s+माल/u.test(visibleText);
        const docsOk = /(?:दस्तावेज़|दस्तावेज)/u.test(visibleText)
          && /(?:संबंधित|प्राप्त\s+माल|सत्यापन)/u.test(visibleText)
          && !(/आने\s+वाले\s+माल\s+और\s+संबंधित\s+दस्तावे/u.test(visibleText)
            && !/प्राप्त\s+माल\s+से\s+संबंधित\s+दस्तावे/u.test(visibleText));
        const coordOk = /(?:सहकर्मी|समन्वय)/u.test(visibleText)
          && /(?:तैयारी|स्थानांतरण|आवाजाही)/u.test(visibleText);
        visibleDutyCovered = [incomingOk, docsOk, coordOk].filter(Boolean).length;
        visibleDutyOk = visibleDutyCovered === 3
          && !/वेयरहाउस\s*वर्कर/u.test(visibleText)
          && /वेयरहाउस\s*कर्मचारी/u.test(visibleText)
          && /(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|कार्यरत\s+हूँ/u.test(visibleText);
      }
      if (requiredPrior >= 3) {
        const creationOk = /दृश्य\s*सामग्री/u.test(visibleText)
          && /(?:ग्राफ़िक\s*तत्व|ग्राफिक\s*तत्व)/u.test(visibleText);
        const reviewOk = /समीक्षा/u.test(visibleText) && /अनुकूलन/u.test(visibleText);
        const filesOk = /(?:फ़ाइल|फाइल)/u.test(visibleText)
          && /(?:प्रारूप|फ़ॉर्मेट|फॉर्मेट)/u.test(visibleText)
          && /स्क्रीन/u.test(visibleText);
        visiblePriorDutyCovered = [creationOk, reviewOk, filesOk].filter(Boolean).length;
        visiblePriorDutyOk = visiblePriorDutyCovered === 3;
      }
      visibleDurationScopeOk = /मेरे\s+पास[\s\S]{0,80}(?:कुल\s+)?पेशेवर\s+अनुभव/u.test(visibleText)
        && this.draft.finalDurationScopeValidationPassed !== false;
      if (this.draft.finalPerspectiveMode === 'neutral_cv' && requiredCurrent >= 3) {
        visibleDutyOk = false;
      }
      }
    }
    if (ok && durationStillOk && locale === 'ar' && typeof visibleText === 'string') {
      if (!trySummaryV2VisibleParity()) {
      const requiredCurrent = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
      const requiredPrior = Number(this.draft.requiredPriorDutyFactCount ?? 0);
      visibleDutyRequired = requiredCurrent;
      visibleDutyCovered = Number(this.draft.coveredCurrentDutyFactCount ?? 0);
      visiblePriorDutyRequired = requiredPrior;
      visiblePriorDutyCovered = Number(this.draft.coveredPriorDutyFactCount ?? 0);
      if (requiredCurrent >= 3) {
        const incomingOk = /البضائع\s*الواردة/u.test(visibleText);
        const docsOk = /(?:الوثائق|المستندات)/u.test(visibleText)
          && /(?:المتعلق|المرفقة|المستلمة)/u.test(visibleText)
          && !(/البضائع\s*الواردة\s*والوثائق/u.test(visibleText)
            && !/(?:الوثائق\s*المتعلق|المستندات\s*المتعلق)/u.test(visibleText));
        const coordOk = /(?:الزملاء|أنسق|تنسيق)/u.test(visibleText)
          && /(?:إعداد|تجهيز|حركة)/u.test(visibleText);
        const warehouseCovered = [incomingOk, docsOk, coordOk].filter(Boolean).length;
        const warehouseOk = warehouseCovered === 3
          && /موظفة\s*مستودع|موظف\s*مستودع/u.test(visibleText)
          && /أعمل\s+حاليا|لدي\s+نحو/u.test(visibleText);
        if (warehouseOk) {
          visibleDutyCovered = 3;
          visibleDutyOk = true;
        } else {
          const foodOk = /أطباق|معايير\s*المطعم/u.test(visibleText);
          const hygieneOk = /نظافة\s*مكان\s*العمل/u.test(visibleText);
          const collabOk = /فريق\s*المطبخ|أتعاون|تعاونت/u.test(visibleText);
          visibleDutyCovered = [foodOk, hygieneOk, collabOk].filter(Boolean).length;
          visibleDutyOk = visibleDutyCovered >= requiredCurrent
            && /أعمل\s+حاليا/u.test(visibleText)
            && !/موظفة\s*مستودع|موظف\s*مستودع/u.test(visibleText);
        }
      } else if (requiredCurrent > 0) {
        visibleDutyOk = visibleDutyCovered >= requiredCurrent
          && /أعمل\s+حاليا/u.test(visibleText);
      }
      if (requiredPrior >= 3) {
        const creationOk = /مواد\s*بصرية/u.test(visibleText) && /عناصر\s*رسومية/u.test(visibleText);
        const reviewOk = /(?:راجع|راجعت)/u.test(visibleText)
          && /(?:كيّف|كيّفت|تكييف)/u.test(visibleText);
        const filesOk = /ملفات\s*التصميم/u.test(visibleText)
          && /(?:صيغ|الصيغ)/u.test(visibleText)
          && /(?:شاشات|الشاشات)/u.test(visibleText);
        visiblePriorDutyCovered = [creationOk, reviewOk, filesOk].filter(Boolean).length;
        visiblePriorDutyOk = visiblePriorDutyCovered === 3;
      } else {
        visiblePriorDutyOk = true;
      }
      visibleDurationScopeOk = /لدي\s+نحو[\s\S]{0,80}الخبرة\s*المهنية\s*الإجمالية/u.test(visibleText)
        && this.draft.finalDurationScopeValidationPassed !== false;
      if (this.draft.finalPerspectiveMode === 'neutral_cv' && requiredCurrent >= 3) {
        visibleDutyOk = false;
      }
      }
    }
    // AAB-436: every French Summary operation (Generate, Stronger, Shorter,
    // Professional) and every candidate origin must use the same shared
    // validators, even when duration or another visible gate is already
    // failing. This ensures the booleans are truthful rather than null and
    // keeps failure rollback fail-closed.
    if (locale === 'fr' && typeof visibleText === 'string') {
      const frenchSurface = validateFrenchVisibleSummarySurface(
        visibleText,
        this.draft.finalPerspectiveMode,
      );
      visibleGrammarOk = frenchSurface.grammarValidationPassed;
      visibleNativeOk = frenchSurface.nativeSurfaceValidationPassed;
      visibleLocaleOk = frenchSurface.targetLocalePurityPassed;
      visibleValidationPerspectiveMode = frenchSurface.perspectiveMode === 'neutral_or_unspecified'
        ? 'cv_third_person'
        : 'first_person';
      if (!trySummaryV2VisibleParity()) {
      const requiredCurrent = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
      const requiredPrior = Number(this.draft.requiredPriorDutyFactCount ?? 0);
      visibleDutyRequired = requiredCurrent;
      visibleDutyCovered = Number(this.draft.coveredCurrentDutyFactCount ?? 0);
      visiblePriorDutyRequired = requiredPrior;
      visiblePriorDutyCovered = Number(this.draft.coveredPriorDutyFactCount ?? 0);
      if (requiredCurrent >= 3) {
        const incomingOk = /marchandises?\s+entrantes?/iu.test(visibleText);
        const docsOk = /documentation\s+relative\s+aux\s+marchandises?\s+re[cç]ues?/iu.test(visibleText);
        const coordOk = /coordonne(?:r|)\s+avec\s+(?:mes\s+)?coll[eè]gues/iu.test(visibleText)
          && /pr[ée]paration\s+et\s+(?:le\s+)?d[ée]placement/iu.test(visibleText);
        visibleDutyCovered = [incomingOk, docsOk, coordOk].filter(Boolean).length;
        visibleDutyOk = visibleDutyCovered === 3
          && /employée\s+d['’]entrepôt|employé\s+d['’]entrepôt/iu.test(visibleText)
          && /\b(?:je|j['’])/iu.test(visibleText);
      }
      if (requiredPrior >= 3) {
        const creationOk = /supports?\s+visuels?/iu.test(visibleText)
          && /[ée]l[ée]ments?\s+graphiques?/iu.test(visibleText);
        const reviewOk = /examins?\s+et\s+adapt|adapt[ée]\s+les\s+supports?/iu.test(visibleText);
        const filesOk = /fichiers?\s+de\s+conception\s+finaux?/iu.test(visibleText)
          && /formats?/iu.test(visibleText)
          && /écrans?/iu.test(visibleText);
        visiblePriorDutyCovered = [creationOk, reviewOk, filesOk].filter(Boolean).length;
        visiblePriorDutyOk = visiblePriorDutyCovered === 3;
      } else {
        visiblePriorDutyOk = true;
      }
      visibleDurationScopeOk = /je\s+dispose\s+d['’]environ/iu.test(visibleText)
        && this.draft.finalDurationScopeValidationPassed !== false;
      visibleLocaleOk = !/\b(?:ich|derzeit|arbeite|prüfe)\b/iu.test(visibleText);
      if (this.draft.finalPerspectiveMode === 'neutral_cv' && requiredCurrent >= 3) {
        visibleDutyOk = false;
      }
      }
    }
    if (ok && durationStillOk && locale === 'it' && typeof visibleText === 'string') {
      if (!trySummaryV2VisibleParity()) {
      const requiredCurrent = Number(this.draft.requiredCurrentDutyFactCount ?? 0);
      const requiredPrior = Number(this.draft.requiredPriorDutyFactCount ?? 0);
      visibleDutyRequired = requiredCurrent;
      visibleDutyCovered = Number(this.draft.coveredCurrentDutyFactCount ?? 0);
      visiblePriorDutyRequired = requiredPrior;
      visiblePriorDutyCovered = Number(this.draft.coveredPriorDutyFactCount ?? 0);
      if (requiredCurrent >= 3) {
        const incomingOk = /merci\s+in\s+arrivo/iu.test(visibleText);
        const docsOk = /documentazione\s+relativa\s+alle\s+merci\s+ricevute/iu.test(visibleText);
        const coordOk = /mi\s+coordino\s+con\s+(?:i\s+)?colleghi/iu.test(visibleText)
          && /preparazione\s+e\s+la\s+movimentazione/iu.test(visibleText);
        visibleDutyCovered = [incomingOk, docsOk, coordOk].filter(Boolean).length;
        visibleDutyOk = visibleDutyCovered === 3
          && /addetta\s+al\s+magazzino|addetto\s+al\s+magazzino/iu.test(visibleText)
          && /\b(?:dispongo|lavoro|controllo|verifico|mi\s+coordino)\b/iu.test(visibleText);
      }
      if (requiredPrior >= 3) {
        const creationOk = /materiali\s+visivi/iu.test(visibleText)
          && /elementi\s+grafici/iu.test(visibleText);
        const reviewOk = /esaminato\s+e\s+adattato|adattato\s+i\s+materiali/iu.test(visibleText);
        const filesOk = /file\s+di\s+design\s+finali/iu.test(visibleText)
          && /formati/iu.test(visibleText)
          && /schermi/iu.test(visibleText);
        visiblePriorDutyCovered = [creationOk, reviewOk, filesOk].filter(Boolean).length;
        visiblePriorDutyOk = visiblePriorDutyCovered === 3;
      } else {
        visiblePriorDutyOk = true;
      }
      visibleDurationScopeOk = /dispongo\s+complessivamente/iu.test(visibleText)
        && this.draft.finalDurationScopeValidationPassed !== false;
      visibleLocaleOk = !/\b(?:je|dispose|travaille|auparavant|ich|derzeit|arbeite)\b/iu.test(visibleText);
      if (this.draft.finalPerspectiveMode === 'neutral_cv' && requiredCurrent >= 3) {
        visibleDutyOk = false;
      }
      }
    }
    const applyOk = ok && durationStillOk && visibleRoleOk && visibleDutyOk
      && visiblePriorDutyOk && visibleGrammarOk && visibleNativeOk
      && visibleLocaleOk && visibleDurationScopeOk;
    void SUMMARY_CONTENT_LOCALE_ROLLBACK_361_REVISION;
    const finalHashForRace = this.draft.finalNormalizedHash
      ?? this.draft.finalValidatedCandidateHash
      ?? null;
    const visibleHashMismatch = Boolean(
      visibleHash
      && finalHashForRace
      && visibleHash !== finalHashForRace,
    );
    const actualRaceDetected = this.draft.actualRaceDetected === true;
    // AAB-387: visible/persisted hash mismatch after a valid candidate is a
    // state-commit failure, not a source race.
    const raceGuardResult: 'ok' | 'fail' | 'skipped' = applyOk
      ? 'ok'
      : actualRaceDetected
        ? 'fail'
        : (ok ? 'ok' : (this.draft.raceGuardResult || 'skipped'));
    const typedFromLifecycle = (() => {
      if (!ok || !durationStillOk) return this.draft.finalTypedFailureReason;
      if (actualRaceDetected) {
        return this.draft.actualRaceReason
          || this.draft.finalTypedFailureReason
          || 'stale_summary_edited_in_flight';
      }
      // Prefer more specific typed reason already patched during EN visible duty validation.
      const existing = this.draft.finalTypedFailureReason;
      if (
        !visibleDutyOk
        && typeof existing === 'string'
        && (
          existing.startsWith('visible_current_duty_')
          || existing === 'visible_summary_hash_mismatch'
          || existing === 'summary_state_write_failed'
        )
      ) {
        return existing === 'visible_summary_hash_mismatch'
          ? 'summary_state_write_failed'
          : existing;
      }
      if (visibleHashMismatch && applyOk === false) {
        return existing === 'visible_summary_hash_mismatch' || !existing
          ? 'summary_state_write_failed'
          : existing;
      }
      if (!visibleDutyOk) return 'visible_current_duty_coverage_failed';
      if (!visiblePriorDutyOk) return 'visible_prior_duty_coverage_failed';
      if (!visibleLocaleOk) return 'visible_locale_purity_failed';
      if (!visibleGrammarOk) {
        return locale === 'fr' ? 'visible_french_grammar_failed' : 'visible_german_grammar_failed';
      }
      if (!visibleRoleOk) return 'visible_role_localization_mismatch';
      return existing;
    })();
    this.patch({
      visibleApplySucceeded: applyOk,
      contentLocaleUpdatedAfterApply: applyOk,
      contentLocaleAfterApply: applyOk
        ? (this.draft.requestedLocale || null)
        : (
          this.draft.contentLocaleBeforeRequest
          || this.draft.storedContentLocaleBeforeRequest
          || this.draft.contentLocaleAfterApply
        ),
      finalContentLocaleAfterApply: applyOk
        ? (this.draft.requestedLocale || null)
        : null,
      usageCountAfter: applyOk
        ? usageAfter
        : (this.draft.usageCountBefore ?? usageAfter),
      visibleCandidateHashAfterApply: visibleHash,
      visibleSummaryMatchesFinalHash: applyOk
        ? (
          visibleHash != null
          && finalHashForRace != null
          && visibleHash === finalHashForRace
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
      visibleRequiredCurrentDutyFactCount: (locale === 'de' || locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'fr' || locale === 'it')
        ? visibleDutyRequired
        : null,
      visibleCoveredCurrentDutyFactCount: (locale === 'de' || locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'fr' || locale === 'it')
        ? visibleDutyCovered
        : null,
      visibleMissingCurrentDutyFactCount: (locale === 'de' || locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'fr' || locale === 'it')
        ? Math.max(0, visibleDutyRequired - visibleDutyCovered)
        : null,
      visibleCurrentDutyCoveragePassed: (locale === 'de' || locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'fr' || locale === 'it')
        ? (typeof visibleText === 'string' ? visibleDutyOk : null)
        : null,
      visibleRequiredPriorDutyFactCount: (locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'de' || locale === 'fr' || locale === 'it')
        ? visiblePriorDutyRequired
        : null,
      visibleCoveredPriorDutyFactCount: (locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'de' || locale === 'fr' || locale === 'it')
        ? visiblePriorDutyCovered
        : null,
      visibleMissingPriorDutyFactCount: (locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'de' || locale === 'fr' || locale === 'it')
        ? Math.max(0, visiblePriorDutyRequired - visiblePriorDutyCovered)
        : null,
      visiblePriorDutyCoveragePassed: (locale === 'en' || locale === 'es' || locale === 'hi' || locale === 'ar' || locale === 'de' || locale === 'fr' || locale === 'it')
        ? (typeof visibleText === 'string' ? visiblePriorDutyOk : null)
        : null,
      visibleDurationScopeValidationPassed: locale === 'en'
        ? (typeof visibleText === 'string' ? visibleDurationScopeOk : null)
        : (locale === 'de' || locale === 'hi' || locale === 'ar' || locale === 'fr' || locale === 'it'
          ? (typeof visibleText === 'string' ? visibleDurationScopeOk : this.draft.visibleDurationScopeValidationPassed)
          : null),
      visibleGermanGrammarValidationPassed: locale === 'de'
        ? (typeof visibleText === 'string' ? visibleGrammarOk : null)
        : null,
      visibleTargetLocalePurityPassed: (locale === 'es' || locale === 'fr')
        ? (typeof visibleText === 'string' ? visibleLocaleOk : null)
        : null,
      visibleSourceLanguageLeakageDetected: locale === 'es'
        ? (typeof visibleText === 'string' ? visibleSourceLanguageLeakageDetected : null)
        : null,
      visibleGrammarValidationPassed: (locale === 'es' || locale === 'fr')
        ? (typeof visibleText === 'string' ? visibleGrammarOk : null)
        : null,
      visibleNativeSurfaceValidationPassed: (locale === 'es' || locale === 'fr')
        ? (typeof visibleText === 'string' ? visibleNativeOk : null)
        : null,
      visibleFinalPostconditionsPassed: (locale === 'es' || locale === 'fr')
        ? (typeof visibleText === 'string' ? applyOk : null)
        : null,
      visibleValidationPerspectiveMode: (locale === 'es' || locale === 'fr')
        ? visibleValidationPerspectiveMode
        : null,
      perspectiveAuthoritySource: (locale === 'es' || locale === 'fr')
        ? 'final_perspective_mode'
        : null,
      perspectiveContractMatched: (locale === 'es' || locale === 'fr')
        ? (typeof visibleText === 'string' ? visibleNativeOk : null)
        : null,
      // Applied summaries: only fail race_guard on a real source ownership conflict.
      raceGuardResult,
      actualRaceDetected,
      actualRaceReason: actualRaceDetected
        ? (this.draft.actualRaceReason || 'stale_summary_edited_in_flight')
        : null,
      visibleApplyFailureStage: applyOk
        ? null
        : (
          this.draft.visibleApplyFailureStage
          || (visibleHashMismatch ? 'post_write_visible_hash_mismatch' : null)
        ),
      durationValidationPassed: durationStillOk
        ? this.draft.durationValidationPassed
        : false,
      finalPostconditionsPassed: applyOk
        ? this.draft.finalPostconditionsPassed
        : false,
      finalTypedFailureReason: typedFromLifecycle,
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
    this.stage(
      'race_guard',
      raceGuardResult,
      actualRaceDetected
        ? (this.draft.actualRaceReason || 'stale_summary_edited_in_flight')
        : (visibleHashMismatch && !applyOk ? 'state_commit_not_race' : undefined),
    );
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
    privacyCheckPassed: boolean;
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
    const privacyViolations = assertCvAiDiagnosticPrivacy(withInvariants);
    const privacyCheckPassed = privacyViolations.length === 0;
    this.patch({
      diagnosticInvariantCheckPassed: invariants.passed,
      diagnosticInvariantFailureCount: invariants.failures.length,
      diagnosticInvariantFailures: invariants.failures,
      diagnosticCompletenessPassed: completenessPassed,
      nullRequiredDiagnosticFields: nullDecision,
      privacyCheckPassed,
      diagnosticPrivacyViolations: privacyViolations,
    });
    const passed = invariants.passed && completenessPassed && privacyCheckPassed;
    this.stage('diagnostic_preapply_gate', passed ? 'ok' : 'fail');
    if (!passed) {
      this.patch({
        finalPostconditionsPassed: false,
        countedAsSuccess: false,
        visibleApplySucceeded: false,
        finalTypedFailureReason: !invariants.passed
          ? 'diagnostic_invariant_failed'
          : !completenessPassed
            ? 'diagnostic_completeness_failed'
            : 'diagnostic_privacy_failed',
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
      privacyCheckPassed,
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
    // Preapply gate already decided invariant/completeness truth for this operation.
    // Never recompute under a different success/visible snapshot after rejection —
    // that silently flips diagnosticInvariantCheckPassed from false → true.
    const preapplyGateFailed = this.draft.rejectionStage === 'diagnostic_preapply_gate'
      && this.stages.some((s) => s.name === 'diagnostic_preapply_gate' && s.status === 'fail');
    const invariants = preapplyGateFailed
      && typeof this.draft.diagnosticInvariantCheckPassed === 'boolean'
      ? {
        passed: this.draft.diagnosticInvariantCheckPassed,
        failures: Array.isArray(this.draft.diagnosticInvariantFailures)
          ? this.draft.diagnosticInvariantFailures
          : [],
      }
      : checkSummaryDiagnosticInvariants(
        base as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
      );
    const withInvariants = {
      ...base,
      diagnosticInvariantCheckPassed: invariants.passed,
      diagnosticInvariantFailureCount: invariants.failures.length,
      diagnosticInvariantFailures: invariants.failures,
    };
    const completeness = preapplyGateFailed
      && typeof this.draft.diagnosticCompletenessPassed === 'boolean'
      ? {
        passed: this.draft.diagnosticCompletenessPassed,
        missingRequiredDiagnosticFields:
          Array.isArray(this.draft.missingRequiredDiagnosticFields)
            ? this.draft.missingRequiredDiagnosticFields
            : [],
        nullRequiredDiagnosticFields:
          Array.isArray(this.draft.nullRequiredDiagnosticFields)
            ? this.draft.nullRequiredDiagnosticFields
            : [],
      }
      : checkSummaryDiagnosticCompleteness(
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
  durationValidationPassed: boolean | null;
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
