import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { INTERNAL_AI_RESET_ENABLED } from '@/lib/build-channel';
import type { ContentLocalizeM6Snapshot } from './content-localize-m6';
import { emitCvAiDiagnosticsChanged } from '@/lib/cv-ai-diagnostics-lifecycle';

export const CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_MARKER =
  'CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC' as const;
export const CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_REVISION =
  'content-localize-v3-terminal-diagnostic-v1' as const;
export const CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_STORAGE_KEY =
  'cvpro-content-localize-v3-terminal-diagnostic-v1' as const;
export const CONTENT_LOCALIZE_V3_TERMINAL_HISTORY_STORAGE_KEY =
  'cvpro-content-localize-v3-terminal-history-v1' as const;
export const CONTENT_LOCALIZE_V3_TERMINAL_HISTORY_LIMIT = 5;

export type ContentLocalizeV3DiagnosticOperation = 'summary_translate' | 'experience_translate';
export type ContentLocalizeV3DiagnosticPhaseResult =
  | 'succeeded' | 'failed' | 'malformed' | 'not_attempted' | 'unknown';

export type ContentLocalizeV3DiagnosticPhase = Readonly<{
  attempted: boolean | null;
  result: ContentLocalizeV3DiagnosticPhaseResult;
  stopReason: string | null;
  contentBlockCount: number | null;
  textBlockCount: number | null;
  toolBlockCount: number | null;
  expectedToolCount: number | null;
  toolNameMatched: boolean | null;
  toolInputObject: boolean | null;
  toolInputSchemaPassed: boolean | null;
  identityPassed: boolean | null;
}>;

export type ContentLocalizeV3DiagnosticEvaluation = Readonly<{
  accepted: boolean | null;
  meaningPreserved: boolean | null;
  noFactsAdded: boolean | null;
  noFactsRemoved: boolean | null;
  factualAnchorsPreserved: boolean | null;
  targetLocaleSatisfied: boolean | null;
  professionalCvQuality: boolean | null;
  noLeakage: boolean | null;
}>;

export type ContentLocalizeV3ServerDiagnostic = Readonly<{
  writer: ContentLocalizeV3DiagnosticPhase;
  primaryEvaluator: ContentLocalizeV3DiagnosticPhase;
  repair: ContentLocalizeV3DiagnosticPhase;
  repairEvaluator: ContentLocalizeV3DiagnosticPhase;
  primaryEvaluation: ContentLocalizeV3DiagnosticEvaluation;
  repairEvaluation: ContentLocalizeV3DiagnosticEvaluation;
  candidatePresent: boolean;
  candidateHash: string | null;
  candidateLength: number | null;
  repairCandidatePresent: boolean;
  repairCandidateHash: string | null;
  repairCandidateLength: number | null;
  finalDecision: 'accepted' | 'rejected' | 'transport_failure' | 'deadline_exceeded';
  rejectionReasonCodes: readonly string[];
  providerFailureStage: string | null;
  providerErrorType: string | null;
  providerHttpStatus: number | null;
  providerErrorCode: string | null;
  providerMessageFingerprint: string | null;
  providerRetryable: boolean | null;
}>;

export type ContentLocalizeV3TerminalDiagnostic = Readonly<{
  schemaVersion: 1;
  marker: typeof CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_MARKER;
  revision: typeof CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_REVISION;
  capturedAt: string;
  operation: ContentLocalizeV3DiagnosticOperation;
  requestIdHash: string;
  operationIdHash: string;
  targetEntryIdHash: string | null;
  sourceLocale: string;
  targetLocale: string;
  sourceTextPresent: boolean;
  sourceTextLength: number;
  sourceTextHash: string;
  sourceBindingResult: 'exact_snapshot' | 'unresolved' | 'not_applicable';
  sourceBindingAuthority: string;
  routeHttpStatus: number | null;
  writer: ContentLocalizeV3DiagnosticPhase;
  primaryEvaluator: ContentLocalizeV3DiagnosticPhase;
  repair: ContentLocalizeV3DiagnosticPhase;
  repairEvaluator: ContentLocalizeV3DiagnosticPhase;
  primaryEvaluation: ContentLocalizeV3DiagnosticEvaluation;
  repairEvaluation: ContentLocalizeV3DiagnosticEvaluation;
  finalDecision: 'accepted' | 'rejected' | 'transport_failure' | 'deadline_exceeded' | 'apply_failure' | 'persistence_failure' | 'race_rejected' | 'not_attempted';
  rejectionReasonCodes: readonly string[];
  providerFailureStage: string | null;
  providerErrorType: string | null;
  providerHttpStatus: number | null;
  providerErrorCode: string | null;
  providerMessageFingerprint: string | null;
  providerRetryable: boolean | null;
  candidatePresent: boolean;
  candidateHash: string | null;
  candidateLength: number | null;
  repairCandidatePresent: boolean;
  repairCandidateHash: string | null;
  repairCandidateLength: number | null;
  applyAuthorized: boolean | null;
  applyAttempted: boolean | null;
  applyCommitted: boolean | null;
  persistenceAttempted: boolean | null;
  persistenceResult: 'succeeded' | 'failed' | 'not_attempted' | 'unknown';
  raceGuardResult: 'passed' | 'failed' | 'not_evaluated';
  usageBefore: number | null;
  usageAfter: number | null;
  usageDelta: number | null;
  fallbackUsed: false;
  sourceCommitMarker: string | null;
  buildChannel: string | null;
}>;

export type ContentLocalizeV3TerminalDiagnosticHistoryItem = Readonly<Pick<
  ContentLocalizeV3TerminalDiagnostic,
  'capturedAt' | 'operation' | 'sourceLocale' | 'targetLocale' | 'finalDecision'
> & { routeHttpStatus: number | null; usageBefore: number | null; usageAfter: number | null }>;

const emptyPhase = (attempted = false): ContentLocalizeV3DiagnosticPhase => ({
  attempted,
  result: attempted ? 'unknown' : 'not_attempted',
  stopReason: null,
  contentBlockCount: null,
  textBlockCount: null,
  toolBlockCount: null,
  expectedToolCount: null,
  toolNameMatched: null,
  toolInputObject: null,
  toolInputSchemaPassed: null,
  identityPassed: null,
});

const emptyEvaluation = (): ContentLocalizeV3DiagnosticEvaluation => ({
  accepted: null,
  meaningPreserved: null,
  noFactsAdded: null,
  noFactsRemoved: null,
  factualAnchorsPreserved: null,
  targetLocaleSatisfied: null,
  professionalCvQuality: null,
  noLeakage: null,
});

export function createEmptyContentLocalizeV3ServerDiagnostic(): ContentLocalizeV3ServerDiagnostic {
  return {
    writer: emptyPhase(),
    primaryEvaluator: emptyPhase(),
    repair: emptyPhase(),
    repairEvaluator: emptyPhase(),
    primaryEvaluation: emptyEvaluation(),
    repairEvaluation: emptyEvaluation(),
    candidatePresent: false,
    candidateHash: null,
    candidateLength: null,
    repairCandidatePresent: false,
    repairCandidateHash: null,
    repairCandidateLength: null,
    finalDecision: 'transport_failure',
    rejectionReasonCodes: [],
    providerFailureStage: null,
    providerErrorType: null,
    providerHttpStatus: null,
    providerErrorCode: null,
    providerMessageFingerprint: null,
    providerRetryable: null,
  };
}

export function diagnosticPhaseFromProviderObservation(
  observation: Partial<ContentLocalizeV3DiagnosticPhase> | null | undefined,
  attempted: boolean,
): ContentLocalizeV3DiagnosticPhase {
  const base = emptyPhase(attempted);
  return Object.freeze({
    ...base,
    ...observation,
    attempted,
    result: observation?.result || base.result,
  });
}

export function buildContentLocalizeV3TerminalDiagnostic(input: {
  snapshot: ContentLocalizeM6Snapshot;
  operation: ContentLocalizeV3DiagnosticOperation;
  routeHttpStatus: number | null;
  serverDiagnostic?: ContentLocalizeV3ServerDiagnostic | null;
  finalDecision: ContentLocalizeV3TerminalDiagnostic['finalDecision'];
  rejectionReasonCodes?: readonly string[];
  applyAuthorized: boolean | null;
  applyAttempted: boolean | null;
  applyCommitted: boolean | null;
  persistenceAttempted: boolean | null;
  persistenceResult: ContentLocalizeV3TerminalDiagnostic['persistenceResult'];
  raceGuardResult: ContentLocalizeV3TerminalDiagnostic['raceGuardResult'];
  usageBefore: number | null;
  usageAfter: number | null;
  sourceCommitMarker?: string | null;
  buildChannel?: string | null;
}): ContentLocalizeV3TerminalDiagnostic {
  const server = input.serverDiagnostic || createEmptyContentLocalizeV3ServerDiagnostic();
  const sourceText = input.snapshot.sourceText || '';
  const reasonCodes = Array.from(new Set([
    ...(server.rejectionReasonCodes || []),
    ...(input.rejectionReasonCodes || []),
  ].map((value) => String(value).trim()).filter(Boolean)));
  return Object.freeze({
    schemaVersion: 1 as const,
    marker: CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_MARKER,
    revision: CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_REVISION,
    capturedAt: new Date().toISOString(),
    operation: input.operation,
    requestIdHash: fingerprintText(input.snapshot.requestId),
    operationIdHash: fingerprintText(input.snapshot.operationId),
    targetEntryIdHash: input.snapshot.kind === 'experience_description'
      ? fingerprintText(input.snapshot.experienceEntryId)
      : null,
    sourceLocale: input.snapshot.sourceLocale,
    targetLocale: input.snapshot.targetLocale,
    sourceTextPresent: Boolean(sourceText.trim()),
    sourceTextLength: sourceText.length,
    sourceTextHash: input.snapshot.sourceTextHash,
    sourceBindingResult: sourceText.trim() ? 'exact_snapshot' : 'unresolved',
    sourceBindingAuthority: input.snapshot.kind === 'summary'
      ? 'm6_summary_source_locale'
      : 'm6_experience_description_source_locale',
    routeHttpStatus: input.routeHttpStatus,
    writer: server.writer,
    primaryEvaluator: server.primaryEvaluator,
    repair: server.repair,
    repairEvaluator: server.repairEvaluator,
    primaryEvaluation: server.primaryEvaluation,
    repairEvaluation: server.repairEvaluation,
    finalDecision: input.finalDecision,
    rejectionReasonCodes: reasonCodes,
    providerFailureStage: server.providerFailureStage,
    providerErrorType: server.providerErrorType,
    providerHttpStatus: server.providerHttpStatus,
    providerErrorCode: server.providerErrorCode,
    providerMessageFingerprint: server.providerMessageFingerprint,
    providerRetryable: server.providerRetryable,
    candidatePresent: server.candidatePresent,
    candidateHash: server.candidateHash,
    candidateLength: server.candidateLength,
    repairCandidatePresent: server.repairCandidatePresent,
    repairCandidateHash: server.repairCandidateHash,
    repairCandidateLength: server.repairCandidateLength,
    applyAuthorized: input.applyAuthorized,
    applyAttempted: input.applyAttempted,
    applyCommitted: input.applyCommitted,
    persistenceAttempted: input.persistenceAttempted,
    persistenceResult: input.persistenceResult,
    raceGuardResult: input.raceGuardResult,
    usageBefore: input.usageBefore,
    usageAfter: input.usageAfter,
    usageDelta: input.usageAfter !== null && input.usageBefore !== null
      ? input.usageAfter - input.usageBefore
      : null,
    fallbackUsed: false as const,
    sourceCommitMarker: input.sourceCommitMarker ?? safeBuildValue(process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT),
    buildChannel: input.buildChannel ?? safeBuildValue(process.env.NEXT_PUBLIC_BUILD_CHANNEL),
  });
}

function safeBuildValue(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text && text.length <= 80 && !/[\r\n]/u.test(text) ? text : null;
}

function readLatest(): ContentLocalizeV3TerminalDiagnostic | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContentLocalizeV3TerminalDiagnostic;
    return parsed && parsed.marker === CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_MARKER ? parsed : null;
  } catch {
    return null;
  }
}

let latest: ContentLocalizeV3TerminalDiagnostic | null = null;

export function recordContentLocalizeV3TerminalDiagnostic(
  diagnostic: ContentLocalizeV3TerminalDiagnostic,
): ContentLocalizeV3TerminalDiagnostic {
  latest = diagnostic;
  if (INTERNAL_AI_RESET_ENABLED) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_STORAGE_KEY, JSON.stringify(diagnostic));
        const history = getContentLocalizeV3DiagnosticHistory();
        const item: ContentLocalizeV3TerminalDiagnosticHistoryItem = {
          capturedAt: diagnostic.capturedAt,
          operation: diagnostic.operation,
          sourceLocale: diagnostic.sourceLocale,
          targetLocale: diagnostic.targetLocale,
          finalDecision: diagnostic.finalDecision,
          routeHttpStatus: diagnostic.routeHttpStatus,
          usageBefore: diagnostic.usageBefore,
          usageAfter: diagnostic.usageAfter,
        };
        localStorage.setItem(
          CONTENT_LOCALIZE_V3_TERMINAL_HISTORY_STORAGE_KEY,
          JSON.stringify([item, ...history].slice(0, CONTENT_LOCALIZE_V3_TERMINAL_HISTORY_LIMIT)),
        );
      }
    } catch {
      /* diagnostics must never affect the user operation */
    }
  }
  try {
    emitCvAiDiagnosticsChanged({ kind: diagnostic.operation === 'summary_translate' ? 'summary' : 'experience', action: 'commit' });
  } catch {
    /* diagnostics only */
  }
  return diagnostic;
}

export function getLatestContentLocalizeV3TerminalDiagnostic(): ContentLocalizeV3TerminalDiagnostic | null {
  return latest || readLatest();
}

export function getContentLocalizeV3DiagnosticHistory(): ContentLocalizeV3TerminalDiagnosticHistoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CONTENT_LOCALIZE_V3_TERMINAL_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, CONTENT_LOCALIZE_V3_TERMINAL_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function clearContentLocalizeV3Diagnostics(): void {
  latest = null;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CONTENT_LOCALIZE_V3_TERMINAL_DIAGNOSTIC_STORAGE_KEY);
      localStorage.removeItem(CONTENT_LOCALIZE_V3_TERMINAL_HISTORY_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
  try {
    emitCvAiDiagnosticsChanged({ kind: 'summary', action: 'clear_latest' });
    emitCvAiDiagnosticsChanged({ kind: 'experience', action: 'clear_latest' });
  } catch {
    /* ignore */
  }
}

export function formatContentLocalizeV3DiagnosticsForCopy(
  diagnostic: ContentLocalizeV3TerminalDiagnostic | null = getLatestContentLocalizeV3TerminalDiagnostic(),
): string {
  return diagnostic ? JSON.stringify(diagnostic, null, 2) : 'No content localization diagnostics recorded yet.';
}

export async function copyContentLocalizeV3DiagnosticsToClipboard(): Promise<boolean> {
  const text = formatContentLocalizeV3DiagnosticsForCopy();
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

export function assertContentLocalizeV3DiagnosticPrivacy(value: unknown): string[] {
  const json = JSON.stringify(value);
  const violations: string[] = [];
  const secretPrefixDetected = [`sk-${'ant'}-`, `sk-${'proj'}-`].some((prefix) => json.includes(prefix));
  if (secretPrefixDetected || /Bearer\s+[A-Za-z0-9._-]{20,}/iu.test(json)) violations.push('secret_like_token');
  if (/"(?:sourceText|translatedText|candidateText|prompt|authorization|token)"\s*:/iu.test(json)) {
    violations.push('raw_payload_field');
  }
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu.test(json)) violations.push('email_like_token');
  if (/\b[A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+){8,}\b/u.test(json)) violations.push('long_latin_prose');
  return violations;
}
