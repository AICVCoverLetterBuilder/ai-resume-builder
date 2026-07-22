/**
 * Release-safe, non-PII Professional Summary AI diagnostics.
 * Mirrors Experience AI diagnostics pattern — observation only.
 */
import { fingerprintText, resolveAppVersionInfo, resolveNextBuildId } from './cv-export-diagnostics';
import type { FinalizeCvAiFieldResult } from './cv-ai-finalize-apply';
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
  type CvAiCandidateLineageRecord,
} from './cv-ai-diagnostics-contract';
import { INTERNAL_AI_RESET_ENABLED } from './build-channel';
import { getApiBaseUrl } from './api';
import {
  emitCvAiDiagnosticsChanged,
  SUMMARY_AI_DIAG_STORAGE_KEY as SUMMARY_AI_DIAG_STORAGE_KEY_CANON,
} from './cv-ai-diagnostics-lifecycle';

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
  slotValidationPassed?: boolean | null;
  slotRejectionReasons?: string[] | null;
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

  constructor(input: SummaryAiDiagSessionInput) {
    this.draft = {
      schemaVersion: SUMMARY_AI_TRACE_SCHEMA_VERSION,
      marker: '',
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
    Object.assign(this.draft, partial);
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
    // Never report idempotent/PASS when visible text has ≠ 1 duration claim.
    // Prefer finalize-computed double-pass idempotence when present.
    const durationFinalizerIdempotent = typeof diag.durationFinalizerIdempotent === 'boolean'
      ? diag.durationFinalizerIdempotent && durationValidationPassed && after === 1
      : durationValidationPassed && after === 1;
    const sentenceCount = text ? text.split(/[.!?।]/u).filter((s) => s.trim()).length : 0;
    const fallbackApplied = Boolean(
      finalized.origin === 'deterministic_fallback' || diag.fallbackApplied,
    );
    const fallbackAttempted = Boolean(
      diag.fallbackApplied
      || diag.clientDeterministicFallbackAttempted
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
    const groundingValidationPassed = diag.groundingValidationPassed
      ?? (!finalized.blocked && finalized.countedAsSuccess);
    const finalPostconditionsPassed = Boolean(
      finalized.countedAsSuccess
      && !finalized.blocked
      && durationValidationPassed
      && purity.targetLocalePurityPassed
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
      finalCandidateSource: diag.finalCandidateSource ?? finalized.origin ?? null,
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
      finalUnitRoleSlots: diag.finalUnitRoleSlots ?? null,
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
      finalValidatedCandidateHash: diag.finalValidatedCandidateHash ?? null,
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
      finalSentenceHashes: diag.finalSentenceHashes ?? null,
      finalSentenceRoleSlots: diag.finalSentenceRoleSlots ?? null,
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
      sourceLanguageLeakageDetected: purity.sourceLanguageLeakageDetected,
      unexpectedLocaleCodes: purity.unexpectedLocaleCodes,
      targetLocalePurityPassed: purity.targetLocalePurityPassed,
      targetScript: purity.detectedScriptByUnit[0] || null,
      countedAsSuccess: Boolean(
        finalized.countedAsSuccess && durationValidationPassed && purity.targetLocalePurityPassed,
      ),
      finalTypedFailureReason: finalized.blocked || !durationValidationPassed || !purity.targetLocalePurityPassed
        ? (finalized.reason || (!purity.targetLocalePurityPassed ? 'locale_impurity' : 'experience_duration_mismatch'))
        : null,
      rejectionStage: finalized.blocked || !durationValidationPassed || !purity.targetLocalePurityPassed
        ? (diag.rejectionStage || (!purity.targetLocalePurityPassed ? 'locale_purity' : 'independent_final_duration_verification'))
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
      hindiCurrentIntroFiniteVerbPresent: diag.hindiCurrentIntroFiniteVerbPresent ?? null,
      hindiCurrentIntroCopulaPresent: diag.hindiCurrentIntroCopulaPresent
        ?? diag.hindiCurrentIntroFiniteVerbPresent
        ?? null,
      hindiCurrentDutyFiniteVerbPresent: diag.hindiCurrentDutyFiniteVerbPresent ?? null,
      hindiCurrentDutyAuxiliaryPresent: diag.hindiCurrentDutyAuxiliaryPresent ?? null,
      hindiPriorRoleFiniteVerbPresent: diag.hindiPriorRoleFiniteVerbPresent ?? null,
      hindiStandaloneJahanFragmentDetected: diag.hindiStandaloneJahanFragmentDetected ?? null,
      hindiNominalExperienceFragmentDetected: diag.hindiNominalExperienceFragmentDetected ?? null,
      hindiSentenceHasFiniteCopulaOrVerb: diag.hindiSentenceHasFiniteCopulaOrVerb ?? null,
      hindiIncompleteSentenceCount: diag.hindiIncompleteSentenceCount ?? null,
      hindiGrammarRejectionReason: (() => {
        const raw = diag.hindiGrammarRejectionReason ?? null;
        return raw && isGrammarRejectionCategory(raw) ? raw : null;
      })(),
      hindiGrammarRejectionReasons: dedupeStableStrings(
        (diag.hindiGrammarRejectionReasons
          ?? (diag.hindiGrammarRejectionReason ? [diag.hindiGrammarRejectionReason] : []))
          .filter((r) => isGrammarRejectionCategory(r)),
      ),
      hindiSentenceGrammarRecords: buildHindiSentenceGrammarRecords({
        sentenceHashes: diag.finalSentenceHashes,
        sentenceRoleSlots: diag.finalSentenceRoleSlots ?? diag.finalUnitRoleSlots,
        hindiSentenceHasFiniteCopulaOrVerb: diag.hindiSentenceHasFiniteCopulaOrVerb,
        hindiNominalExperienceFragmentDetected: diag.hindiNominalExperienceFragmentDetected,
        hindiStandaloneJahanFragmentDetected: diag.hindiStandaloneJahanFragmentDetected,
        hindiGrammarRejectionReason: (
          diag.hindiGrammarRejectionReason
          && isGrammarRejectionCategory(diag.hindiGrammarRejectionReason)
        ) ? diag.hindiGrammarRejectionReason : null,
        hindiCurrentIntroFiniteVerbPresent: diag.hindiCurrentIntroFiniteVerbPresent,
        hindiCurrentDutyAuxiliaryPresent: diag.hindiCurrentDutyAuxiliaryPresent,
      }),
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
      slotValidationPassed: diag.slotValidationPassed ?? null,
      slotRejectionReasons: dedupeStableStrings(diag.slotRejectionReasons ?? []),
      summaryRepairAttempted: diag.summaryRepairAttempted ?? null,
      repairAttempted: Boolean(diag.summaryRepairAttempted),
      repairApplied: Boolean(diag.summaryRepairApplied),
      apiResponseKind: diag.apiResponseKind
        ?? (diag.providerCandidatePresent ? 'provider' : 'unknown'),
      serverCandidateKind: diag.serverCandidateKind
        ?? (diag.providerCandidatePresent ? 'provider' : 'empty'),
      serverFallbackUsed: false,
      serverFallbackReason: diag.serverFallbackReason ?? null,
      clientFallbackUsed: Boolean(
        diag.clientFallbackUsed
        || finalized.origin === 'deterministic_fallback'
        || diag.noOpDetected,
      ),
      clientFallbackKind: diag.clientFallbackKind
        ?? (
          (diag.clientFallbackUsed || finalized.origin === 'deterministic_fallback')
            ? 'deterministic'
            : null
        ),
      clientFallbackReason: diag.clientFallbackReason ?? null,
      sourceNormalizedHash: diag.sourceNormalizedHash ?? null,
      finalNormalizedHash: diag.finalNormalizedHash ?? null,
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
        return 'unknown';
      })(),
      candidateLineage: (() => {
        const lineage: CvAiCandidateLineageRecord[] = [];
        const providerPresent = Boolean(diag.providerCandidatePresent);
        const providerUnitCount = typeof diag.providerCandidateSentenceCount === 'number'
          ? diag.providerCandidateSentenceCount
          : (typeof diag.providerSentenceCount === 'number' ? diag.providerSentenceCount : 0);
        const providerHashes = Array.isArray(diag.providerSentenceHashes)
          ? diag.providerSentenceHashes
          : [];
        const providerRejected = Boolean(
          !finalized.countedAsSuccess
          || finalized.origin === 'deterministic_fallback'
          || diag.providerNoOpDetected
          || diag.providerRejectionReason
          || (diag.providerUnsupportedDesignMediumCount ?? 0) > 0,
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
          accepted: finalized.origin === 'ai_generated' && Boolean(finalized.countedAsSuccess),
          rejectionStage: diag.providerRejectionStage
            ?? (providerRejected && providerPresent ? 'provider_validation' : null),
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
              ? true
              : false)
            : null,
          durationValidationPassed: null,
          slotValidationPassed: providerPresent
            ? ((diag.providerSlotRejectionReasons || []).length === 0 ? true : false)
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
        const detPresent = Boolean(
          diag.deterministicCandidatePresent
          || finalized.origin === 'deterministic_fallback'
          || diag.noOpDetected,
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
        const detHashes = diag.finalSentenceHashes || [];
        lineage.push({
          candidateKind: 'client_deterministic',
          present: detPresent,
          hash: diag.deterministicCandidateHash ?? null,
          normalizedHash: diag.deterministicCandidateNormalizedHash ?? null,
          unitCount: deterministicSentenceCount,
          unitHashes: detHashes,
          sentenceCount: deterministicSentenceCount,
          sentenceHashes: detHashes,
          sentenceRoleSlots: diag.finalSentenceRoleSlots || diag.finalUnitRoleSlots || [],
          accepted: detAccepted,
          rejectionStage: detNoOp ? 'meaningful_change' : null,
          rejectionReasons: dedupeStableStrings(
            detNoOp ? ['summary_noop_after_normalization'] : [],
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
          unitCount: finalSelected ? sentenceCount : 0,
          unitHashes: finalSelected ? (diag.finalSentenceHashes || []) : [],
          sentenceCount: finalSelected ? sentenceCount : 0,
          sentenceHashes: finalSelected ? (diag.finalSentenceHashes || []) : [],
          sentenceRoleSlots: finalSelected
            ? (diag.finalSentenceRoleSlots || diag.finalUnitRoleSlots || [])
            : [],
          accepted: finalSelected,
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
            : true,
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
    this.patch({
      visibleApplySucceeded: ok && durationStillOk,
      contentLocaleUpdatedAfterApply: ok && durationStillOk,
      contentLocaleAfterApply: ok && durationStillOk
        ? (this.draft.requestedLocale || this.draft.contentLocaleAfterApply || null)
        : this.draft.contentLocaleAfterApply,
      usageCountAfter: usageAfter,
      visibleCandidateHashAfterApply: visibleHash,
      visibleSummaryMatchesFinalHash: ok && durationStillOk
        ? (
          visibleHash != null
          && this.draft.finalValidatedCandidateHash != null
          && visibleHash === this.draft.finalValidatedCandidateHash
        )
        : (ok && durationStillOk),
      visibleDurationClaimCountAfterApply: visibleCount,
      visibleDurationMatchesFinalizedCount: matches,
      // Applied summaries use an explicit race/context result of ok (sync finalize path).
      raceGuardResult: ok && durationStillOk ? 'ok' : (ok ? 'fail' : this.draft.raceGuardResult || 'skipped'),
      durationValidationPassed: durationStillOk
        ? this.draft.durationValidationPassed
        : false,
      finalPostconditionsPassed: ok && durationStillOk
        ? this.draft.finalPostconditionsPassed
        : false,
      durationFinalizerIdempotent: ok && durationStillOk
        ? this.draft.durationFinalizerIdempotent
        : false,
      countedAsSuccess: ok && durationStillOk,
    });
    this.stage('visible_apply', ok && durationStillOk ? 'ok' : 'fail');
    this.stage('race_guard', ok && durationStillOk ? 'ok' : (ok ? 'fail' : 'skipped'));
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
      marker: 'SUMMARY_AI_DIAG_V1',
      ...identity,
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      cvAiDiagnosticsV2299Revision: CV_AI_DIAGNOSTICS_V2_299_REVISION,
      operationKind: 'summary' as const,
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
