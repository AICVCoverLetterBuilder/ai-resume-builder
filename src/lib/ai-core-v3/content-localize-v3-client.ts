import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import { hashSummarySourceLocaleText } from '@/lib/cv-summary-source-locale';
import type { CVData } from '@/lib/types';
import type { ContentLocalizeM6ExperienceSnapshot, ContentLocalizeM6SummarySnapshot } from './content-localize-m6';
import { hashSummaryV3Value, type SummaryV3CommitReceipt, type SummaryV3CommitRequest } from './summary-generate';
import {
  buildContentLocalizeV3TerminalDiagnostic,
  recordContentLocalizeV3TerminalDiagnostic,
  type ContentLocalizeV3ServerDiagnostic,
  type ContentLocalizeV3TerminalDiagnostic,
} from './content-localize-v3-terminal-diagnostics';

/** Frozen M6.4 route operation; this module has no provider or route ownership. */
export const CONTENT_LOCALIZE_V3_CLIENT_ACTION = 'content-localize-v3' as const;

export interface ContentLocalizeV3ClientInput {
  readonly snapshot: ContentLocalizeM6SummarySnapshot;
  readonly cv: CVData;
  readonly proToken: string;
  readonly usageCountBefore: number;
}

export interface ContentLocalizeV3ClientDependencies {
  readonly request: (body: Record<string, unknown>) => Promise<{ data: unknown; status: number }>;
  readonly getLiveCv: () => CVData;
  readonly getActiveOperationId: () => string;
  readonly commitCandidate: (request: SummaryV3CommitRequest) => SummaryV3CommitReceipt;
  readonly getUsageCount?: () => number;
  readonly recordDiagnostic?: (diagnostic: ContentLocalizeV3TerminalDiagnostic) => void;
}

export type ContentLocalizeV3ClientOutcome =
  | Readonly<{ kind: 'committed'; status: 200; receipt: Extract<SummaryV3CommitReceipt, { kind: 'committed' }> }>
  | Readonly<{ kind: 'terminal'; status: number; reason: string }>;

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function exactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => keys.includes(key));
}

function terminal(status: number, reason: string): ContentLocalizeV3ClientOutcome {
  return { kind: 'terminal', status, reason };
}

type TerminalApplyEvidence = {
  authorized: boolean | null;
  attempted: boolean | null;
  committed: boolean | null;
  persistenceAttempted?: boolean | null;
  persistenceResult: ContentLocalizeV3TerminalDiagnostic['persistenceResult'];
  race: ContentLocalizeV3TerminalDiagnostic['raceGuardResult'];
  usageAfter?: number | null;
};

function readUsageAfter(
  getUsageCount: (() => number) | undefined,
  fallback: number | null = null,
): number | null {
  try {
    const value = getUsageCount?.();
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function recordSummaryDiagnostic(
  input: ContentLocalizeV3ClientInput,
  dependencies: ContentLocalizeV3ClientDependencies,
  status: number,
  decision: ContentLocalizeV3TerminalDiagnostic['finalDecision'],
  reason: string | null,
  serverDiagnostic: ContentLocalizeV3ServerDiagnostic | null,
  apply: TerminalApplyEvidence,
): void {
  const usageAfter = apply.usageAfter !== undefined
    ? apply.usageAfter
    : readUsageAfter(dependencies.getUsageCount);
  const diagnostic = buildContentLocalizeV3TerminalDiagnostic({
    snapshot: input.snapshot,
    operation: 'summary_translate',
    routeHttpStatus: status,
    serverDiagnostic,
    finalDecision: decision,
    rejectionReasonCodes: reason ? [reason] : [],
    applyAuthorized: apply.authorized,
    applyAttempted: apply.attempted,
    applyCommitted: apply.committed,
    persistenceAttempted: apply.persistenceAttempted !== undefined
      ? apply.persistenceAttempted
      : apply.attempted === false ? false : null,
    persistenceResult: apply.persistenceResult,
    raceGuardResult: apply.race,
    usageBefore: input.usageCountBefore,
    usageAfter,
  });
  (dependencies.recordDiagnostic || recordContentLocalizeV3TerminalDiagnostic)(diagnostic);
}

/** Summary translation owns only Summary fields; concurrent Experience work
 * must not make an otherwise-valid Summary candidate stale. */
function summaryTransactionHash(cv: CVData): string {
  return hashSummaryV3Value({
    summary: cv.summary,
    summaryOrigin: cv.summaryOrigin,
    summaryGeneratedLocale: cv.summaryGeneratedLocale,
    summarySourceLocale: cv.summarySourceLocale,
    summarySourceLocaleTextHash: cv.summarySourceLocaleTextHash,
    canonicalSummary: cv.canonicalSummary,
    canonicalSnapshot: cv.canonicalSnapshot,
    contentLocale: cv.contentLocale,
  });
}

/**
 * Client transport boundary for one already-authorized M6 Summary snapshot.
 * It validates only the server receipt identity then delegates all mutation,
 * durable readback, rollback, and post-commit usage to the existing owner.
 */
export async function runContentLocalizeV3ClientOperation(
  input: ContentLocalizeV3ClientInput,
  dependencies: ContentLocalizeV3ClientDependencies,
): Promise<ContentLocalizeV3ClientOutcome> {
  const { snapshot } = input;
  let transport: { data: unknown; status: number };
  try {
    transport = await dependencies.request({
      action: CONTENT_LOCALIZE_V3_CLIENT_ACTION,
      snapshot,
      proToken: input.proToken,
    });
  } catch (error) {
    const status = error instanceof Error && error.name === 'AbortError' ? 499 : 502;
    const reason = error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'route_request_failed';
    recordSummaryDiagnostic(input, dependencies, status, status === 499 ? 'deadline_exceeded' : 'transport_failure', reason, null, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return terminal(status, reason);
  }

  if (dependencies.getActiveOperationId() !== snapshot.operationId) {
    recordSummaryDiagnostic(input, dependencies, 409, 'race_rejected', 'operation_superseded', null, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'failed' });
    return terminal(409, 'operation_superseded');
  }

  const result = record(transport.data);
  if (result && result.status === 'handled_failure'
    && Object.keys(result).every((key) => ['status', 'reason', 'diagnostic'].includes(key))
    && Object.prototype.hasOwnProperty.call(result, 'status')
    && Object.prototype.hasOwnProperty.call(result, 'reason')
    && nonBlank(result.reason)) {
    const reason = String(result.reason);
    const decision = reason === 'deadline_exceeded' ? 'deadline_exceeded' : reason === 'candidate_rejected' ? 'rejected' : 'transport_failure';
    recordSummaryDiagnostic(input, dependencies, transport.status || 502, decision, reason, result.diagnostic as ContentLocalizeV3ServerDiagnostic, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return terminal(transport.status || 502, reason);
  }
  if (!result || !Object.keys(result).every((key) => ['status', 'receipt', 'diagnostic'].includes(key))
    || !Object.prototype.hasOwnProperty.call(result, 'receipt')
    || result.status !== 'candidate_ready') {
    recordSummaryDiagnostic(input, dependencies, transport.status || 502, 'transport_failure', 'route_result_malformed', null, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return terminal(transport.status || 502, 'route_result_malformed');
  }
  if (transport.status !== 200) {
    recordSummaryDiagnostic(input, dependencies, transport.status || 502, 'transport_failure', 'candidate_non_200', null, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return terminal(transport.status || 502, 'candidate_non_200');
  }

  const serverDiagnostic = result.diagnostic as ContentLocalizeV3ServerDiagnostic;
  const receipt = record(result.receipt);
  if (!receipt || !exactKeys(receipt, [
    'operationId', 'requestId', 'kind', 'sourceLocale', 'targetLocale',
    'sourceTextHash', 'translatedText', 'candidateTextHash', 'candidateOrigin',
  ])) {
    recordSummaryDiagnostic(input, dependencies, 422, 'transport_failure', 'candidate_identity_mismatch', serverDiagnostic, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return terminal(422, 'candidate_identity_mismatch');
  }

  const translatedText = receipt.translatedText;
  const validCandidate = nonBlank(translatedText)
    && receipt.operationId === snapshot.operationId
    && receipt.requestId === snapshot.requestId
    && receipt.kind === 'summary'
    && receipt.sourceLocale === snapshot.sourceLocale
    && receipt.targetLocale === snapshot.targetLocale
    && receipt.sourceTextHash === snapshot.sourceTextHash
    && receipt.candidateTextHash === hashSummarySourceLocaleText(translatedText)
    && (receipt.candidateOrigin === 'primary' || receipt.candidateOrigin === 'repair');
  if (!validCandidate) {
    recordSummaryDiagnostic(input, dependencies, 422, 'transport_failure', 'candidate_identity_mismatch', serverDiagnostic, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return terminal(422, 'candidate_identity_mismatch');
  }

  const before = dependencies.getLiveCv();
  if (summaryTransactionHash(before) !== summaryTransactionHash(input.cv)) {
    recordSummaryDiagnostic(input, dependencies, 409, 'race_rejected', 'stale_snapshot', null, { authorized: true, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'failed' });
    return terminal(409, 'stale_snapshot');
  }

  const next: CVData = {
    ...before,
    summary: translatedText,
    summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: snapshot.targetLocale,
    summarySourceLocale: snapshot.targetLocale,
    summarySourceLocaleTextHash: hashSummarySourceLocaleText(translatedText),
    // Summary translation is field-level. Preserve document and canonical truth
    // plus all Experience surfaces exactly as owned by the prior CV.
    contentLocale: before.contentLocale,
    canonicalSummary: before.canonicalSummary,
    canonicalSnapshot: before.canonicalSnapshot,
    experience: before.experience,
  };
  let commit: SummaryV3CommitReceipt;
  try {
    commit = dependencies.commitCandidate({
      operationId: snapshot.operationId,
      requestId: snapshot.requestId,
      previousCvHash: hashSummaryV3Value(before),
      candidateHash: hashSummaryV3Value(translatedText),
      requestedLocale: snapshot.targetLocale,
      usageCountBefore: input.usageCountBefore,
      previousCv: before,
      nextCv: next,
    });
  } catch {
    recordSummaryDiagnostic(input, dependencies, 500, 'apply_failure', 'commit_operation_failed', null, { authorized: true, attempted: true, committed: false, persistenceResult: 'unknown', race: 'passed' });
    return terminal(500, 'commit_operation_failed');
  }
  if (commit.kind === 'committed') {
    recordSummaryDiagnostic(input, dependencies, 200, 'accepted', null, serverDiagnostic || null, { authorized: true, attempted: true, committed: true, persistenceAttempted: true, persistenceResult: 'succeeded', race: 'passed', usageAfter: commit.actualUsageAfter });
    return { kind: 'committed', status: 200, receipt: commit };
  }
  const decision = commit.reason === 'persistence_failed' ? 'persistence_failure' : commit.reason === 'stale_snapshot' || commit.reason === 'operation_superseded' ? 'race_rejected' : 'apply_failure';
  recordSummaryDiagnostic(input, dependencies, 500, decision, commit.reason, serverDiagnostic || null, {
    authorized: true,
    attempted: commit.canonicalApplyAttempted,
    committed: false,
    persistenceAttempted: commit.persistenceAttempted,
    persistenceResult: commit.persistenceResult === 'passed'
      ? 'succeeded'
      : commit.persistenceResult === 'failed' ? 'failed' : 'not_attempted',
    race: decision === 'race_rejected' ? 'failed' : 'passed',
    usageAfter: commit.actualUsageAfter,
  });
  return terminal(500, commit.reason);
}

export interface ContentLocalizeV3ExperienceClientInput {
  readonly snapshot: ContentLocalizeM6ExperienceSnapshot;
  readonly cv: CVData;
  readonly proToken: string;
  readonly usageCountBefore: number;
}

export interface ContentLocalizeV3ExperienceCommitRequest {
  readonly operationId: string;
  readonly requestId: string;
  readonly experienceEntryId: string;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly sourceText: string;
  readonly translatedText: string;
  readonly sourceTextHash: string;
  readonly candidateTextHash: string;
  readonly candidateOrigin: 'primary' | 'repair';
  readonly usageCountBefore: number;
  readonly previousCv: CVData;
}

export type ContentLocalizeV3ExperienceCommitReceipt =
  | Readonly<{
      kind: 'committed';
      operationId: string;
      requestId: string;
      experienceEntryId: string;
      candidateTextHash: string;
    }>
  | Readonly<{ kind: 'failed'; reason: string }>;

export interface ContentLocalizeV3ExperienceClientDependencies {
  readonly request: (body: Record<string, unknown>) => Promise<{ data: unknown; status: number }>;
  readonly getLiveCv: () => CVData;
  readonly getActiveOperationId: () => string;
  readonly commitCandidate: (request: ContentLocalizeV3ExperienceCommitRequest) => ContentLocalizeV3ExperienceCommitReceipt;
  readonly getUsageCount?: () => number;
  readonly recordDiagnostic?: (diagnostic: ContentLocalizeV3TerminalDiagnostic) => void;
}

export type ContentLocalizeV3ExperienceClientOutcome =
  | Readonly<{
      kind: 'committed';
      status: 200;
      receipt: Extract<ContentLocalizeV3ExperienceCommitReceipt, { kind: 'committed' }>;
    }>
  | Readonly<{ kind: 'terminal'; status: number; reason: string }>;

type ExperienceUnknownRecord = Record<string, unknown>;

function recordExperienceDiagnostic(
  input: ContentLocalizeV3ExperienceClientInput,
  dependencies: ContentLocalizeV3ExperienceClientDependencies,
  status: number,
  decision: ContentLocalizeV3TerminalDiagnostic['finalDecision'],
  reason: string | null,
  serverDiagnostic: ContentLocalizeV3ServerDiagnostic | null,
  apply: TerminalApplyEvidence,
): void {
  const usageAfter = apply.usageAfter !== undefined
    ? apply.usageAfter
    : readUsageAfter(dependencies.getUsageCount);
  const diagnostic = buildContentLocalizeV3TerminalDiagnostic({
    snapshot: input.snapshot,
    operation: 'experience_translate',
    routeHttpStatus: status,
    serverDiagnostic,
    finalDecision: decision,
    rejectionReasonCodes: reason ? [reason] : [],
    applyAuthorized: apply.authorized,
    applyAttempted: apply.attempted,
    applyCommitted: apply.committed,
    persistenceAttempted: apply.persistenceAttempted !== undefined
      ? apply.persistenceAttempted
      : apply.attempted === false ? false : null,
    persistenceResult: apply.persistenceResult,
    raceGuardResult: apply.race,
    usageBefore: input.usageCountBefore,
    usageAfter,
  });
  (dependencies.recordDiagnostic || recordContentLocalizeV3TerminalDiagnostic)(diagnostic);
}

function experienceCommitFailureEvidence(reason: string): TerminalApplyEvidence {
  if (reason === 'operation_superseded' || reason === 'stale_snapshot' || reason === 'experience_entry_missing') {
    return {
      authorized: true,
      attempted: false,
      committed: false,
      persistenceAttempted: false,
      persistenceResult: 'not_attempted',
      race: 'failed',
    };
  }
  if (reason === 'transaction_apply_failed' || reason === 'readback_failed') {
    return {
      authorized: true,
      attempted: true,
      committed: false,
      persistenceAttempted: false,
      persistenceResult: 'not_attempted',
      race: 'passed',
    };
  }
  if (reason === 'persistence_failed') {
    return {
      authorized: true,
      attempted: true,
      committed: false,
      persistenceAttempted: true,
      persistenceResult: 'failed',
      race: 'passed',
    };
  }
  if (reason === 'usage_accounting_failed') {
    return {
      authorized: true,
      attempted: true,
      committed: false,
      persistenceAttempted: true,
      persistenceResult: 'succeeded',
      race: 'passed',
    };
  }
  return {
    authorized: true,
    attempted: null,
    committed: null,
    persistenceAttempted: null,
    persistenceResult: 'unknown',
    race: 'not_evaluated',
  };
}

function experienceRecord(value: unknown): ExperienceUnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ExperienceUnknownRecord : null;
}

function experienceNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function experienceExactKeys(value: ExperienceUnknownRecord, keys: readonly string[]): boolean {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => keys.includes(key));
}

/**
 * M6.6 Experience transport boundary. The route result is untrusted; only
 * the exact frozen receipt identity may reach the existing page transaction.
 */
export async function runContentLocalizeV3ExperienceClientOperation(
  input: ContentLocalizeV3ExperienceClientInput,
  dependencies: ContentLocalizeV3ExperienceClientDependencies,
): Promise<ContentLocalizeV3ExperienceClientOutcome> {
  const { snapshot } = input;
  let transport: { data: unknown; status: number };
  try {
    transport = await dependencies.request({
      action: CONTENT_LOCALIZE_V3_CLIENT_ACTION,
      snapshot,
      proToken: input.proToken,
    });
  } catch (error) {
    const status = error instanceof Error && error.name === 'AbortError' ? 499 : 502;
    const reason = error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'route_request_failed';
    recordExperienceDiagnostic(input, dependencies, status, status === 499 ? 'deadline_exceeded' : 'transport_failure', reason, null, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return {
      kind: 'terminal',
      status,
      reason,
    };
  }
  if (dependencies.getActiveOperationId() !== snapshot.operationId) {
    recordExperienceDiagnostic(input, dependencies, 409, 'race_rejected', 'operation_superseded', null, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'failed' });
    return { kind: 'terminal', status: 409, reason: 'operation_superseded' };
  }
  const result = experienceRecord(transport.data);
  if (result && result.status === 'handled_failure'
    && Object.keys(result).every((key) => ['status', 'reason', 'diagnostic'].includes(key))
    && Object.prototype.hasOwnProperty.call(result, 'status')
    && Object.prototype.hasOwnProperty.call(result, 'reason')
    && experienceNonBlank(result.reason)) {
    const reason = String(result.reason);
    const decision = reason === 'deadline_exceeded' ? 'deadline_exceeded' : reason === 'candidate_rejected' ? 'rejected' : 'transport_failure';
    recordExperienceDiagnostic(input, dependencies, transport.status || 502, decision, reason, result.diagnostic as ContentLocalizeV3ServerDiagnostic, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return { kind: 'terminal', status: transport.status || 502, reason: result.reason as string };
  }
  if (!result || !Object.keys(result).every((key) => ['status', 'receipt', 'diagnostic'].includes(key))
    || !Object.prototype.hasOwnProperty.call(result, 'receipt')
    || result.status !== 'candidate_ready') {
    recordExperienceDiagnostic(input, dependencies, transport.status || 502, 'transport_failure', 'route_result_malformed', null, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return { kind: 'terminal', status: transport.status || 502, reason: 'route_result_malformed' };
  }
  if (transport.status !== 200) {
    recordExperienceDiagnostic(input, dependencies, transport.status || 502, 'transport_failure', 'candidate_non_200', result.diagnostic as ContentLocalizeV3ServerDiagnostic, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return { kind: 'terminal', status: transport.status || 502, reason: 'candidate_non_200' };
  }
  const serverDiagnostic = result.diagnostic as ContentLocalizeV3ServerDiagnostic;
  const receipt = experienceRecord(result.receipt);
  if (!receipt || !experienceExactKeys(receipt, [
    'operationId', 'requestId', 'kind', 'experienceEntryId', 'sourceLocale', 'targetLocale',
    'sourceTextHash', 'translatedText', 'candidateTextHash', 'candidateOrigin',
  ])) {
    recordExperienceDiagnostic(input, dependencies, 422, 'transport_failure', 'candidate_identity_mismatch', serverDiagnostic, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return { kind: 'terminal', status: 422, reason: 'candidate_identity_mismatch' };
  }
  const translatedText = receipt.translatedText;
  const validCandidate = experienceNonBlank(translatedText)
    && receipt.operationId === snapshot.operationId
    && receipt.requestId === snapshot.requestId
    && receipt.kind === 'experience_description'
    && receipt.experienceEntryId === snapshot.experienceEntryId
    && receipt.sourceLocale === snapshot.sourceLocale
    && receipt.targetLocale === snapshot.targetLocale
    && receipt.sourceTextHash === snapshot.sourceTextHash
    && receipt.candidateTextHash === hashExperienceSourceLocaleText(translatedText as string)
    && (receipt.candidateOrigin === 'primary' || receipt.candidateOrigin === 'repair');
  if (!validCandidate) {
    recordExperienceDiagnostic(input, dependencies, 422, 'transport_failure', 'candidate_identity_mismatch', serverDiagnostic, { authorized: false, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'not_evaluated' });
    return { kind: 'terminal', status: 422, reason: 'candidate_identity_mismatch' };
  }

  const before = dependencies.getLiveCv();
  const entry = before.experience.find((item) => item.id === snapshot.experienceEntryId);
  if (!entry) {
    recordExperienceDiagnostic(input, dependencies, 409, 'race_rejected', 'experience_entry_missing', serverDiagnostic, { authorized: true, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'failed' });
    return { kind: 'terminal', status: 409, reason: 'experience_entry_missing' };
  }
  if (entry.description !== snapshot.sourceText
    || hashExperienceSourceLocaleText(entry.description || '') !== snapshot.sourceTextHash) {
    recordExperienceDiagnostic(input, dependencies, 409, 'race_rejected', 'stale_snapshot', serverDiagnostic, { authorized: true, attempted: false, committed: false, persistenceResult: 'not_attempted', race: 'failed' });
    return { kind: 'terminal', status: 409, reason: 'stale_snapshot' };
  }

  let commit: ContentLocalizeV3ExperienceCommitReceipt;
  try {
    commit = dependencies.commitCandidate({
      operationId: snapshot.operationId,
      requestId: snapshot.requestId,
      experienceEntryId: snapshot.experienceEntryId,
      sourceLocale: snapshot.sourceLocale,
      targetLocale: snapshot.targetLocale,
      sourceText: snapshot.sourceText,
      translatedText: translatedText as string,
      sourceTextHash: snapshot.sourceTextHash,
      candidateTextHash: receipt.candidateTextHash as string,
      candidateOrigin: receipt.candidateOrigin as 'primary' | 'repair',
      usageCountBefore: input.usageCountBefore,
      previousCv: before,
    });
  } catch {
    recordExperienceDiagnostic(input, dependencies, 500, 'apply_failure', 'commit_operation_failed', serverDiagnostic, { authorized: true, attempted: true, committed: false, persistenceResult: 'unknown', race: 'passed' });
    return { kind: 'terminal', status: 500, reason: 'commit_operation_failed' };
  }
  if (commit.kind === 'committed') {
    recordExperienceDiagnostic(input, dependencies, 200, 'accepted', null, serverDiagnostic, { authorized: true, attempted: true, committed: true, persistenceAttempted: true, persistenceResult: 'succeeded', race: 'passed' });
    return { kind: 'committed', status: 200, receipt: commit };
  }
  const decision = commit.reason === 'persistence_failed' ? 'persistence_failure' : commit.reason === 'operation_superseded' || commit.reason === 'stale_snapshot' ? 'race_rejected' : 'apply_failure';
  recordExperienceDiagnostic(input, dependencies, 500, decision, commit.reason, serverDiagnostic, experienceCommitFailureEvidence(commit.reason));
  return { kind: 'terminal', status: 500, reason: commit.reason };
}
