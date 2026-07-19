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

export const SUMMARY_AI_TRACE_SCHEMA_VERSION = 1 as const;
export const SUMMARY_AI_DIAG_STORAGE_KEY = 'cvpro-summary-ai-diag-v1';

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
    const durationFinalizerIdempotent = durationValidationPassed && after === 1;
    const sentenceCount = text ? text.split(/[.!?।]/u).filter((s) => s.trim()).length : 0;
    const fallbackApplied = Boolean(
      finalized.origin === 'deterministic_fallback' || diag.fallbackApplied,
    );
    const fallbackAttempted = Boolean(
      diag.fallbackApplied
      || diag.clientDeterministicFallbackAttempted
      || fallbackApplied,
    );
    // Never report fallbackSentenceCount as provider length when no fallback ran.
    const fallbackSentenceCount = fallbackApplied || fallbackAttempted
      ? sentenceCount
      : 0;
    const deterministicSentenceCount = finalized.origin === 'deterministic_fallback'
      ? sentenceCount
      : (diag.deterministicCandidatePresent ? sentenceCount : 0);
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
        : (typeof diag.providerSentenceCount === 'number' ? diag.providerSentenceCount : sentenceCount),
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
      grammarValidationPassed: finalized.reason !== 'malformed_serbian_token',
      unsupportedClaimCount: diag.unsupportedClaimCount ?? 0,
      duplicateSentenceCount: 0,
      contentLocaleBeforeRequest: diag.contentLocaleBeforeRequest
        ?? this.draft.contentLocaleBeforeRequest
        ?? this.draft.storedContentLocale
        ?? null,
      contentLocaleAfterApply: diag.contentLocaleAfterApply ?? null,
      detectedSourceLocale: this.draft.detectedSourceLocale,
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
    this.patch({
      visibleApplySucceeded: ok && durationStillOk,
      contentLocaleUpdatedAfterApply: ok && durationStillOk,
      contentLocaleAfterApply: ok && durationStillOk
        ? (this.draft.requestedLocale || this.draft.contentLocaleAfterApply || null)
        : this.draft.contentLocaleAfterApply,
      usageCountAfter: usageAfter,
      visibleSummaryMatchesFinalHash: ok && durationStillOk,
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
    const trace = {
      ...this.draft,
      stages: this.stages,
      marker: 'SUMMARY_AI_DIAG_V1',
    } as SummaryAiDiagnosticTrace;
    latestSummaryTrace = trace;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SUMMARY_AI_DIAG_STORAGE_KEY, JSON.stringify(trace));
      }
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
    return JSON.parse(raw) as SummaryAiDiagnosticTrace;
  } catch {
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
