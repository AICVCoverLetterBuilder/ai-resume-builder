import {
  hashExperienceSourceLocaleText,
} from '../cv-experience-source-locale';
import {
  hashSummarySourceLocaleText,
} from '../cv-summary-source-locale';
import {
  CONTENT_LOCALIZE_M6_TARGET_LOCALES,
  type ContentLocalizeM6Snapshot,
  type ContentLocalizeM6TargetKind,
  type ContentLocalizeM6TargetLocale,
} from './content-localize-m6';
import { immutableCopy } from './immutability';

export type ContentLocalizeM6ServerFailureReason =
  | 'invalid_authorization_snapshot'
  | 'writer_failed'
  | 'writer_identity_mismatch'
  | 'writer_candidate_invalid'
  | 'evaluator_failed'
  | 'evaluator_identity_mismatch'
  | 'candidate_rejected'
  | 'repair_failed'
  | 'repair_identity_mismatch'
  | 'repair_candidate_invalid'
  | 'deadline_exceeded';

type ContentLocalizeM6Identity = Readonly<{
  operationId: string;
  requestId: string;
  kind: ContentLocalizeM6TargetKind;
  sourceLocale: ContentLocalizeM6TargetLocale;
  targetLocale: ContentLocalizeM6TargetLocale;
  sourceTextHash: string;
}>;

export type ContentLocalizeM6WriterRequest = ContentLocalizeM6Identity & Readonly<{
  sourceText: string;
  experienceEntryId?: string;
  semanticContract: readonly string[];
}>;

export type ContentLocalizeM6EvaluatorRequest = ContentLocalizeM6Identity & Readonly<{
  sourceText: string;
  translatedText: string;
  candidateTextHash: string;
  candidateOrigin: 'primary' | 'repair';
  experienceEntryId?: string;
  criteria: readonly ContentLocalizeM6EvaluationCriterion[];
}>;

export type ContentLocalizeM6RepairRequest = ContentLocalizeM6WriterRequest & Readonly<{
  primaryTranslatedText: string;
  primaryCandidateTextHash: string;
  reasonCodes: readonly string[];
  failedCriteria: readonly string[];
}>;

export type ContentLocalizeM6EvaluationCriterion =
  | 'meaningPreserved'
  | 'noFactsAdded'
  | 'noFactsRemoved'
  | 'factualAnchorsPreserved'
  | 'targetLocaleSatisfied'
  | 'professionalCvQuality'
  | 'noLeakage';

export interface ContentLocalizeM6ServerDependencies {
  readonly writer: (request: ContentLocalizeM6WriterRequest) => Promise<unknown>;
  readonly evaluator: (request: ContentLocalizeM6EvaluatorRequest) => Promise<unknown>;
  readonly repair: (request: ContentLocalizeM6RepairRequest) => Promise<unknown>;
}

export type ContentLocalizeM6CandidateReceipt = ContentLocalizeM6Identity & Readonly<{
  translatedText: string;
  candidateTextHash: string;
  candidateOrigin: 'primary' | 'repair';
  experienceEntryId?: string;
}>;

export type ContentLocalizeM6ServerResult =
  | Readonly<{ status: 'handled_failure'; reason: ContentLocalizeM6ServerFailureReason }>
  | Readonly<{ status: 'candidate_ready'; receipt: ContentLocalizeM6CandidateReceipt }>;

const SUPPORTED_LOCALES = new Set<string>(CONTENT_LOCALIZE_M6_TARGET_LOCALES);

const EVALUATION_CRITERIA: readonly ContentLocalizeM6EvaluationCriterion[] = [
  'meaningPreserved',
  'noFactsAdded',
  'noFactsRemoved',
  'factualAnchorsPreserved',
  'targetLocaleSatisfied',
  'professionalCvQuality',
  'noLeakage',
];

const WRITER_SEMANTIC_CONTRACT = [
  'Translate only the exact sourceText into targetLocale.',
  'Preserve every supported fact and do not add or remove facts.',
  'Preserve names, brands, product names, URLs, email addresses, numeric values, dates, percentages, and currency amounts.',
  'Do not translate Experience position/title or company.',
  'Do not infer missing context and do not emit commentary.',
] as const;

type UnknownRecord = Record<string, unknown>;

type ParsedWriter =
  | Readonly<{ ok: true; translatedText: string; candidateTextHash: string }>
  | Readonly<{ ok: false; reason: 'writer_failed' | 'writer_identity_mismatch' | 'writer_candidate_invalid' }>;

type ParsedEvaluation =
  | Readonly<{
    ok: true;
    accepted: boolean;
    reasonCodes: readonly string[];
    failedCriteria: readonly string[];
  }>
  | Readonly<{ ok: false; reason: 'evaluator_failed' | 'evaluator_identity_mismatch' }>;

type ParsedWriterFailure = Extract<ParsedWriter, { ok: false }>;
type ParsedEvaluationFailure = Extract<ParsedEvaluation, { ok: false }>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function hasExactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  return keys.every((key) => hasOwn(value, key))
    && Object.keys(value).every((key) => keys.includes(key));
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSupportedLocale(value: unknown): value is ContentLocalizeM6TargetLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.has(value);
}

function snapshotKeys(kind: unknown): readonly string[] {
  const common = ['operationId', 'requestId', 'kind', 'sourceLocale', 'targetLocale', 'sourceText', 'sourceTextHash'];
  return kind === 'experience_description' ? [...common, 'experienceEntryId'] : common;
}

function snapshotHash(snapshot: ContentLocalizeM6Snapshot): string {
  return snapshot.kind === 'summary'
    ? hashSummarySourceLocaleText(snapshot.sourceText)
    : hashExperienceSourceLocaleText(snapshot.sourceText);
}

function candidateHash(snapshot: ContentLocalizeM6Snapshot, text: string): string {
  return snapshot.kind === 'summary'
    ? hashSummarySourceLocaleText(text)
    : hashExperienceSourceLocaleText(text);
}

/**
 * The M6.3 type is narrow, but route/provider boundaries are runtime-untrusted.
 * Validate only the already-authorized snapshot; never rediscover source authority.
 */
function validateSnapshot(value: unknown): ContentLocalizeM6Snapshot | null {
  if (!isRecord(value) || (value.kind !== 'summary' && value.kind !== 'experience_description')) return null;
  if (!hasExactKeys(value, snapshotKeys(value.kind))
    || !isNonBlank(value.operationId)
    || !isNonBlank(value.requestId)
    || !isSupportedLocale(value.sourceLocale)
    || !isSupportedLocale(value.targetLocale)
    || value.sourceLocale === value.targetLocale
    || !isNonBlank(value.sourceText)
    || typeof value.sourceTextHash !== 'string') return null;

  if (value.kind === 'experience_description' && !isNonBlank(value.experienceEntryId)) return null;

  const expectedHash = value.kind === 'summary'
    ? hashSummarySourceLocaleText(value.sourceText)
    : hashExperienceSourceLocaleText(value.sourceText);
  if (value.sourceTextHash !== expectedHash) return null;

  if (value.kind === 'summary') {
    return immutableCopy({
      operationId: value.operationId,
      requestId: value.requestId,
      kind: 'summary' as const,
      sourceLocale: value.sourceLocale,
      targetLocale: value.targetLocale,
      sourceText: value.sourceText,
      sourceTextHash: value.sourceTextHash,
    }) as ContentLocalizeM6Snapshot;
  }

  return immutableCopy({
    operationId: value.operationId,
    requestId: value.requestId,
    kind: 'experience_description' as const,
    experienceEntryId: value.experienceEntryId,
    sourceLocale: value.sourceLocale,
    targetLocale: value.targetLocale,
    sourceText: value.sourceText,
    sourceTextHash: value.sourceTextHash,
  }) as ContentLocalizeM6Snapshot;
}

function identity(snapshot: ContentLocalizeM6Snapshot): ContentLocalizeM6Identity & Readonly<{ experienceEntryId?: string }> {
  return snapshot.kind === 'summary'
    ? immutableCopy({
      operationId: snapshot.operationId,
      requestId: snapshot.requestId,
      kind: snapshot.kind,
      sourceLocale: snapshot.sourceLocale,
      targetLocale: snapshot.targetLocale,
      sourceTextHash: snapshot.sourceTextHash,
    })
    : immutableCopy({
      operationId: snapshot.operationId,
      requestId: snapshot.requestId,
      kind: snapshot.kind,
      experienceEntryId: snapshot.experienceEntryId,
      sourceLocale: snapshot.sourceLocale,
      targetLocale: snapshot.targetLocale,
      sourceTextHash: snapshot.sourceTextHash,
    });
}

function identityMatches(value: UnknownRecord, snapshot: ContentLocalizeM6Snapshot, hash?: string): boolean {
  if (value.operationId !== snapshot.operationId
    || value.requestId !== snapshot.requestId
    || value.kind !== snapshot.kind
    || value.sourceTextHash !== snapshot.sourceTextHash
    || value.sourceLocale !== snapshot.sourceLocale
    || value.targetLocale !== snapshot.targetLocale) return false;
  if (hash !== undefined && value.candidateTextHash !== hash) return false;
  return snapshot.kind === 'summary'
    ? !hasOwn(value, 'experienceEntryId')
    : value.experienceEntryId === snapshot.experienceEntryId;
}

function writerKeys(snapshot: ContentLocalizeM6Snapshot): readonly string[] {
  const keys = ['operationId', 'requestId', 'kind', 'sourceTextHash', 'sourceLocale', 'targetLocale', 'translatedText'];
  return snapshot.kind === 'experience_description' ? [...keys, 'experienceEntryId'] : keys;
}

function evaluatorKeys(snapshot: ContentLocalizeM6Snapshot): readonly string[] {
  const keys = [
    'operationId', 'requestId', 'kind', 'sourceTextHash', 'candidateTextHash', 'sourceLocale', 'targetLocale',
    'accepted', ...EVALUATION_CRITERIA, 'reasonCodes',
  ];
  return snapshot.kind === 'experience_description' ? [...keys, 'experienceEntryId'] : keys;
}

function writerRequest(snapshot: ContentLocalizeM6Snapshot): ContentLocalizeM6WriterRequest {
  return immutableCopy({
    ...identity(snapshot),
    sourceText: snapshot.sourceText,
    semanticContract: WRITER_SEMANTIC_CONTRACT,
  }) as ContentLocalizeM6WriterRequest;
}

function evaluatorRequest(
  snapshot: ContentLocalizeM6Snapshot,
  translatedText: string,
  textHash: string,
  origin: 'primary' | 'repair',
): ContentLocalizeM6EvaluatorRequest {
  return immutableCopy({
    ...identity(snapshot),
    sourceText: snapshot.sourceText,
    translatedText,
    candidateTextHash: textHash,
    candidateOrigin: origin,
    criteria: EVALUATION_CRITERIA,
  }) as ContentLocalizeM6EvaluatorRequest;
}

function repairRequest(
  snapshot: ContentLocalizeM6Snapshot,
  primaryText: string,
  primaryHash: string,
  evaluation: Extract<ParsedEvaluation, { ok: true }>,
): ContentLocalizeM6RepairRequest {
  return immutableCopy({
    ...writerRequest(snapshot),
    primaryTranslatedText: primaryText,
    primaryCandidateTextHash: primaryHash,
    reasonCodes: evaluation.reasonCodes,
    failedCriteria: evaluation.failedCriteria,
  }) as ContentLocalizeM6RepairRequest;
}

function parsedWriterFailure(reason: ParsedWriterFailure['reason']): ParsedWriter {
  const value: ParsedWriterFailure = { ok: false, reason };
  return immutableCopy(value);
}

function parsedEvaluationFailure(reason: ParsedEvaluationFailure['reason']): ParsedEvaluation {
  const value: ParsedEvaluationFailure = { ok: false, reason };
  return immutableCopy(value);
}

function parseWriter(value: unknown, snapshot: ContentLocalizeM6Snapshot): ParsedWriter {
  if (!isRecord(value)) return parsedWriterFailure('writer_failed');
  if (!identityMatches(value, snapshot)) return parsedWriterFailure('writer_identity_mismatch');
  if (!hasExactKeys(value, writerKeys(snapshot))) return parsedWriterFailure('writer_failed');
  if (!isNonBlank(value.translatedText)) return parsedWriterFailure('writer_candidate_invalid');
  return immutableCopy({
    ok: true as const,
    translatedText: value.translatedText,
    candidateTextHash: candidateHash(snapshot, value.translatedText),
  });
}

function parseReasonCodes(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? immutableCopy([...value]) as readonly string[]
    : null;
}

function parseEvaluation(
  value: unknown,
  snapshot: ContentLocalizeM6Snapshot,
  textHash: string,
): ParsedEvaluation {
  if (!isRecord(value)) return parsedEvaluationFailure('evaluator_failed');
  if (!identityMatches(value, snapshot, textHash)) {
    return parsedEvaluationFailure('evaluator_identity_mismatch');
  }
  if (!hasExactKeys(value, evaluatorKeys(snapshot))
    || typeof value.accepted !== 'boolean'
    || !EVALUATION_CRITERIA.every((criterion) => typeof value[criterion] === 'boolean')) {
    return parsedEvaluationFailure('evaluator_failed');
  }
  const reasonCodes = parseReasonCodes(value.reasonCodes);
  if (!reasonCodes) return parsedEvaluationFailure('evaluator_failed');
  const failedCriteria: ContentLocalizeM6EvaluationCriterion[] = EVALUATION_CRITERIA
    .filter((criterion) => value[criterion] !== true);
  const accepted = value.accepted === true;
  return immutableCopy({
    ok: true as const,
    accepted: accepted && failedCriteria.length === 0,
    reasonCodes,
    failedCriteria,
  });
}

function handledFailure(reason: ContentLocalizeM6ServerFailureReason): ContentLocalizeM6ServerResult {
  return immutableCopy({ status: 'handled_failure' as const, reason }) as ContentLocalizeM6ServerResult;
}

function candidateReady(
  snapshot: ContentLocalizeM6Snapshot,
  translatedText: string,
  textHash: string,
  origin: 'primary' | 'repair',
): ContentLocalizeM6ServerResult {
  return immutableCopy({
    status: 'candidate_ready' as const,
    receipt: {
      ...identity(snapshot),
      translatedText,
      candidateTextHash: textHash,
      candidateOrigin: origin,
    },
  }) as ContentLocalizeM6ServerResult;
}

function isDeadlineFailure(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') return true;
  if (!isRecord(error)) return false;
  return error.deadlineOwner === 'server_deadline'
    || error.deadlineOwner === 'route_deadline'
    || error.deadlineOwner === 'client_abort'
    || error.code === 'deadline_exceeded';
}

function caughtFailure(error: unknown, fallback: ContentLocalizeM6ServerFailureReason): ContentLocalizeM6ServerResult {
  return handledFailure(isDeadlineFailure(error) ? 'deadline_exceeded' : fallback);
}

/**
 * Executes the M6.4 logical candidate contract only. Model transport, routes,
 * apply, persistence, usage, and UI remain outside this server foundation.
 */
export async function executeContentLocalizeM6Server(
  snapshot: ContentLocalizeM6Snapshot,
  dependencies: ContentLocalizeM6ServerDependencies,
): Promise<ContentLocalizeM6ServerResult> {
  const authorized = validateSnapshot(snapshot);
  if (!authorized) return handledFailure('invalid_authorization_snapshot');

  if (!dependencies || typeof dependencies.writer !== 'function') return handledFailure('writer_failed');
  let primaryRaw: unknown;
  try {
    primaryRaw = await dependencies.writer(writerRequest(authorized));
  } catch (error) {
    return caughtFailure(error, 'writer_failed');
  }
  const primaryWriter = parseWriter(primaryRaw, authorized);
  if (!primaryWriter.ok) return handledFailure(primaryWriter.reason);

  if (typeof dependencies.evaluator !== 'function') return handledFailure('evaluator_failed');
  let primaryEvaluationRaw: unknown;
  try {
    primaryEvaluationRaw = await dependencies.evaluator(evaluatorRequest(
      authorized,
      primaryWriter.translatedText,
      primaryWriter.candidateTextHash,
      'primary',
    ));
  } catch (error) {
    return caughtFailure(error, 'evaluator_failed');
  }
  const primaryEvaluation = parseEvaluation(primaryEvaluationRaw, authorized, primaryWriter.candidateTextHash);
  if (!primaryEvaluation.ok) return handledFailure(primaryEvaluation.reason);
  if (primaryEvaluation.accepted) {
    return candidateReady(authorized, primaryWriter.translatedText, primaryWriter.candidateTextHash, 'primary');
  }

  if (typeof dependencies.repair !== 'function') return handledFailure('repair_failed');
  let repairRaw: unknown;
  try {
    repairRaw = await dependencies.repair(repairRequest(
      authorized,
      primaryWriter.translatedText,
      primaryWriter.candidateTextHash,
      primaryEvaluation,
    ));
  } catch (error) {
    return caughtFailure(error, 'repair_failed');
  }
  const repairedWriter = parseWriter(repairRaw, authorized);
  if (!repairedWriter.ok) {
    return handledFailure(repairedWriter.reason === 'writer_identity_mismatch'
      ? 'repair_identity_mismatch'
      : repairedWriter.reason === 'writer_candidate_invalid'
        ? 'repair_candidate_invalid'
        : 'repair_failed');
  }

  let repairEvaluationRaw: unknown;
  try {
    repairEvaluationRaw = await dependencies.evaluator(evaluatorRequest(
      authorized,
      repairedWriter.translatedText,
      repairedWriter.candidateTextHash,
      'repair',
    ));
  } catch (error) {
    return caughtFailure(error, 'evaluator_failed');
  }
  const repairEvaluation = parseEvaluation(repairEvaluationRaw, authorized, repairedWriter.candidateTextHash);
  if (!repairEvaluation.ok) return handledFailure(repairEvaluation.reason);
  if (!repairEvaluation.accepted) return handledFailure('candidate_rejected');
  return candidateReady(authorized, repairedWriter.translatedText, repairedWriter.candidateTextHash, 'repair');
}
