import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import { hashSummarySourceLocaleText } from '@/lib/cv-summary-source-locale';
import type { CVData } from '@/lib/types';
import type { ContentLocalizeM6ExperienceSnapshot, ContentLocalizeM6SummarySnapshot } from './content-localize-m6';
import { hashSummaryV3Value, type SummaryV3CommitReceipt, type SummaryV3CommitRequest } from './summary-generate';

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
    return terminal(error instanceof Error && error.name === 'AbortError' ? 499 : 502,
      error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'route_request_failed');
  }

  if (dependencies.getActiveOperationId() !== snapshot.operationId) {
    return terminal(409, 'operation_superseded');
  }

  const result = record(transport.data);
  if (result && result.status === 'handled_failure'
    && exactKeys(result, ['status', 'reason'])
    && nonBlank(result.reason)) return terminal(transport.status || 502, result.reason);
  if (!result || !exactKeys(result, ['status', 'receipt']) || result.status !== 'candidate_ready') {
    return terminal(transport.status || 502, 'route_result_malformed');
  }
  if (transport.status !== 200) return terminal(transport.status || 502, 'candidate_non_200');

  const receipt = record(result.receipt);
  if (!receipt || !exactKeys(receipt, [
    'operationId', 'requestId', 'kind', 'sourceLocale', 'targetLocale',
    'sourceTextHash', 'translatedText', 'candidateTextHash', 'candidateOrigin',
  ])) return terminal(422, 'candidate_identity_mismatch');

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
  if (!validCandidate) return terminal(422, 'candidate_identity_mismatch');

  const before = dependencies.getLiveCv();
  if (summaryTransactionHash(before) !== summaryTransactionHash(input.cv)) {
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
    return terminal(500, 'commit_operation_failed');
  }
  return commit.kind === 'committed'
    ? { kind: 'committed', status: 200, receipt: commit }
    : terminal(500, commit.reason);
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
}

export type ContentLocalizeV3ExperienceClientOutcome =
  | Readonly<{
      kind: 'committed';
      status: 200;
      receipt: Extract<ContentLocalizeV3ExperienceCommitReceipt, { kind: 'committed' }>;
    }>
  | Readonly<{ kind: 'terminal'; status: number; reason: string }>;

type ExperienceUnknownRecord = Record<string, unknown>;

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
    return {
      kind: 'terminal',
      status: error instanceof Error && error.name === 'AbortError' ? 499 : 502,
      reason: error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'route_request_failed',
    };
  }
  if (dependencies.getActiveOperationId() !== snapshot.operationId) {
    return { kind: 'terminal', status: 409, reason: 'operation_superseded' };
  }
  const result = experienceRecord(transport.data);
  if (result && result.status === 'handled_failure'
    && experienceExactKeys(result, ['status', 'reason'])
    && experienceNonBlank(result.reason)) {
    return { kind: 'terminal', status: transport.status || 502, reason: result.reason as string };
  }
  if (!result || !experienceExactKeys(result, ['status', 'receipt']) || result.status !== 'candidate_ready') {
    return { kind: 'terminal', status: transport.status || 502, reason: 'route_result_malformed' };
  }
  if (transport.status !== 200) {
    return { kind: 'terminal', status: transport.status || 502, reason: 'candidate_non_200' };
  }
  const receipt = experienceRecord(result.receipt);
  if (!receipt || !experienceExactKeys(receipt, [
    'operationId', 'requestId', 'kind', 'experienceEntryId', 'sourceLocale', 'targetLocale',
    'sourceTextHash', 'translatedText', 'candidateTextHash', 'candidateOrigin',
  ])) {
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
    return { kind: 'terminal', status: 422, reason: 'candidate_identity_mismatch' };
  }

  const before = dependencies.getLiveCv();
  const entry = before.experience.find((item) => item.id === snapshot.experienceEntryId);
  if (!entry) return { kind: 'terminal', status: 409, reason: 'experience_entry_missing' };
  if (entry.description !== snapshot.sourceText
    || hashExperienceSourceLocaleText(entry.description || '') !== snapshot.sourceTextHash) {
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
    return { kind: 'terminal', status: 500, reason: 'commit_operation_failed' };
  }
  return commit.kind === 'committed'
    ? { kind: 'committed', status: 200, receipt: commit }
    : { kind: 'terminal', status: 500, reason: commit.reason };
}
