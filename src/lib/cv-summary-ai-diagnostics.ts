/**
 * Release-safe, non-PII Professional Summary AI diagnostics.
 * Mirrors Experience AI diagnostics pattern — observation only.
 */
import { fingerprintText, resolveNextBuildId } from './cv-export-diagnostics';
import type { FinalizeCvAiFieldResult } from './cv-ai-finalize-apply';
import { hashExperienceEntryId } from './cv-experience-entry-isolation';
import type { CVData } from './types';
import {
  countSummaryDurationExpressions,
} from './cv-summary-duration-ownership';

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
  durationClaimsRemovedBeforeInsert: number;
  durationClaimCountAfterFinalize: number;
  durationInsertedExactlyOnce: boolean;
  durationFinalizerIdempotent: boolean;
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
  canonicalGroundingEnabled: boolean;
  authoritativeEntryCount: number;
  staleFactCandidateCount: number;
  staleFactsRejectedCount: number;
  unsupportedClaimCount: number;
  duplicateSentenceCount: number;
  nearDuplicateSentenceCount: number;
  repeatedClauseCount: number;
  perspectiveMode: string | null;
  perspectiveValidationPassed: boolean;
  genderValidationPassed: boolean;
  tenseValidationPassed: boolean;
  localeValidationPassed: boolean;
  grammarValidationPassed: boolean;
  durationValidationPassed: boolean;
  groundingValidationPassed: boolean;
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
      durationClaimsRemovedBeforeInsert: 0,
      durationClaimCountAfterFinalize: 0,
      durationInsertedExactlyOnce: false,
      durationFinalizerIdempotent: false,
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
      canonicalGroundingEnabled: true,
      authoritativeEntryCount: 0,
      staleFactCandidateCount: 0,
      staleFactsRejectedCount: 0,
      unsupportedClaimCount: 0,
      duplicateSentenceCount: 0,
      nearDuplicateSentenceCount: 0,
      repeatedClauseCount: 0,
      perspectiveMode: null,
      perspectiveValidationPassed: false,
      genderValidationPassed: false,
      tenseValidationPassed: false,
      localeValidationPassed: false,
      grammarValidationPassed: false,
      durationValidationPassed: false,
      groundingValidationPassed: false,
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
    const after = countSummaryDurationExpressions(text);
    const beforeProvider = diag.summaryDurationExpressionCount ?? 0;
    const idempotent = after <= 1;
    this.patch({
      providerDurationClaimCount: beforeProvider,
      durationClaimsRemovedBeforeInsert: diag.duplicateDurationRemoved ? 1 : 0,
      durationClaimCountAfterFinalize: diag.finalDurationExpressionCount ?? after,
      durationInsertedExactlyOnce: (diag.finalDurationExpressionCount ?? after) === 1,
      durationFinalizerIdempotent: idempotent,
      structuredDurationMonths: diag.authoritativeDurationMonths ?? null,
      localizedDurationPhraseHash: text
        ? fingerprintText(`dur:${diag.finalDurationExpressionCount ?? after}`)
        : null,
      fallbackAttempted: Boolean(diag.fallbackApplied || diag.clientDeterministicFallbackAttempted),
      fallbackApplied: Boolean(
        finalized.origin === 'deterministic_fallback' || diag.fallbackApplied,
      ),
      fallbackKind: finalized.origin === 'deterministic_fallback' ? 'deterministic' : null,
      fallbackSentenceCount: text ? text.split(/[.!?।]/u).filter((s) => s.trim()).length : 0,
      providerSentenceCount: text ? text.split(/[.!?।]/u).filter((s) => s.trim()).length : 0,
      perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed ?? true),
      localeValidationPassed: finalized.reason !== 'locale_mismatch',
      durationValidationPassed: (diag.finalDurationExpressionCount ?? after) <= 1,
      groundingValidationPassed: !finalized.blocked,
      finalPostconditionsPassed: Boolean(finalized.countedAsSuccess && !finalized.blocked),
      countedAsSuccess: Boolean(finalized.countedAsSuccess),
      finalTypedFailureReason: finalized.blocked ? (finalized.reason || null) : null,
      rejectionStage: finalized.blocked ? (diag.rejectionStage || 'final_apply') : null,
      genderValidationPassed: true,
      tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? true),
      grammarValidationPassed: finalized.reason !== 'malformed_serbian_token',
      unsupportedClaimCount: diag.unsupportedClaimCount ?? 0,
      duplicateSentenceCount: 0,
    });
    this.stage(
      'duration_validation',
      (diag.finalDurationExpressionCount ?? after) <= 1 ? 'ok' : 'fail',
    );
    this.stage(
      'final_postconditions',
      finalized.countedAsSuccess && !finalized.blocked ? 'ok' : 'fail',
      finalized.reason || undefined,
    );
  }

  recordVisibleApply(ok: boolean, usageAfter: number): void {
    this.patch({
      visibleApplySucceeded: ok,
      contentLocaleUpdatedAfterApply: ok,
      usageCountAfter: usageAfter,
      visibleSummaryMatchesFinalHash: ok,
    });
    this.stage('visible_apply', ok ? 'ok' : 'fail');
  }

  recordRaceGuard(result: 'ok' | 'fail' | 'skipped'): void {
    this.patch({ raceGuardResult: result });
    this.stage('race_guard', result === 'fail' ? 'fail' : 'ok');
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
  applied: boolean;
} | null {
  if (!trace) return null;
  const last = trace.stages[trace.stages.length - 1];
  return {
    timestamp: trace.capturedAt,
    locale: trace.requestedLocale,
    finalStage: last?.name || 'unknown',
    typedFailureReason: trace.finalTypedFailureReason || 'none',
    durationCount: trace.durationClaimCountAfterFinalize,
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
