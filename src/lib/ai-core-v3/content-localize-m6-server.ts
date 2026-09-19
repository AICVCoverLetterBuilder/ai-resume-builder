import {
  hashExperienceSourceLocaleText,
} from '../cv-experience-source-locale';
import { fingerprintText } from '../cv-export-diagnostics';
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
import {
  createEmptyContentLocalizeV3ServerDiagnostic,
  diagnosticPhaseFromProviderObservation,
  type ContentLocalizeV3DiagnosticPhase,
  type ContentLocalizeV3ServerDiagnostic,
} from './content-localize-v3-terminal-diagnostics';
import { readContentLocalizeV3ProviderObservation } from './content-localize-v3-provider';
import {
  readLocalDeadlineProvenance,
  type LocalDeadlineOwner,
  type LocalDeadlinePhase,
  type LocalDeadlineProvenance,
} from '../ai-request-timing';

export type ContentLocalizeM6ServerFailureReason =
  | 'v3_feature_disabled'
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

export interface ContentLocalizeM6ServerExecutionOptions {
  readonly routeStartedAt?: number;
  readonly routeBudgetMs?: number;
}

export type ContentLocalizeM6CandidateReceipt = ContentLocalizeM6Identity & Readonly<{
  translatedText: string;
  candidateTextHash: string;
  candidateOrigin: 'primary' | 'repair';
  experienceEntryId?: string;
}>;

export type ContentLocalizeM6ServerResult =
  | Readonly<{ status: 'handled_failure'; reason: ContentLocalizeM6ServerFailureReason; diagnostic: ContentLocalizeV3ServerDiagnostic }>
  | Readonly<{ status: 'candidate_ready'; receipt: ContentLocalizeM6CandidateReceipt; diagnostic: ContentLocalizeV3ServerDiagnostic }>;

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
  | Readonly<{ ok: true; translatedText: string; candidateTextHash: string; schemaPassed: true; identityPassed: true }>
  | Readonly<{ ok: false; reason: 'writer_failed' | 'writer_identity_mismatch' | 'writer_candidate_invalid'; schemaPassed: boolean; identityPassed: boolean | null }>;

type ParsedEvaluation =
  | Readonly<{
    ok: true;
    accepted: boolean;
    criteria: Readonly<Record<ContentLocalizeM6EvaluationCriterion, boolean>>;
    reasonCodes: readonly string[];
    failedCriteria: readonly string[];
    schemaPassed: true;
    identityPassed: true;
  }>
  | Readonly<{ ok: false; reason: 'evaluator_failed' | 'evaluator_identity_mismatch'; schemaPassed: boolean; identityPassed: boolean | null }>;

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

function parsedWriterFailure(
  reason: ParsedWriterFailure['reason'],
  schemaPassed = false,
  identityPassed: boolean | null = null,
): ParsedWriter {
  const value: ParsedWriterFailure = { ok: false, reason, schemaPassed, identityPassed };
  return immutableCopy(value);
}

function parsedEvaluationFailure(
  reason: ParsedEvaluationFailure['reason'],
  schemaPassed = false,
  identityPassed: boolean | null = null,
): ParsedEvaluation {
  const value: ParsedEvaluationFailure = { ok: false, reason, schemaPassed, identityPassed };
  return immutableCopy(value);
}

function writerSchemaPassed(value: UnknownRecord, snapshot: ContentLocalizeM6Snapshot): boolean {
  return hasExactKeys(value, writerKeys(snapshot)) && isNonBlank(value.translatedText);
}

function evaluatorSchemaPassed(value: UnknownRecord, snapshot: ContentLocalizeM6Snapshot): boolean {
  return hasExactKeys(value, evaluatorKeys(snapshot))
    && typeof value.accepted === 'boolean'
    && EVALUATION_CRITERIA.every((criterion) => typeof value[criterion] === 'boolean')
    && parseReasonCodes(value.reasonCodes) !== null;
}

function identityEvidence(
  value: UnknownRecord,
  snapshot: ContentLocalizeM6Snapshot,
  hash?: string,
): boolean | null {
  const keys = ['operationId', 'requestId', 'kind', 'sourceTextHash', 'sourceLocale', 'targetLocale',
    ...(snapshot.kind === 'experience_description' ? ['experienceEntryId'] : [])];
  if (hash !== undefined) keys.push('candidateTextHash');
  if (!keys.every((key) => hasOwn(value, key))) return null;
  return identityMatches(value, snapshot, hash);
}

function parseWriter(value: unknown, snapshot: ContentLocalizeM6Snapshot): ParsedWriter {
  if (!isRecord(value)) return parsedWriterFailure('writer_failed');
  const requiredKeys = writerKeys(snapshot);
  const schemaPassed = writerSchemaPassed(value, snapshot);
  const identityPassed = identityMatches(value, snapshot);
  if (!identityPassed) return parsedWriterFailure('writer_identity_mismatch', schemaPassed, identityEvidence(value, snapshot));
  if (!hasExactKeys(value, requiredKeys)) return parsedWriterFailure('writer_failed', schemaPassed, true);
  if (!isNonBlank(value.translatedText)) return parsedWriterFailure('writer_candidate_invalid', false, true);
  return immutableCopy({
    ok: true as const,
    translatedText: value.translatedText,
    candidateTextHash: candidateHash(snapshot, value.translatedText),
    schemaPassed: true as const,
    identityPassed: true as const,
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
  const schemaPassed = evaluatorSchemaPassed(value, snapshot);
  const identityPassed = identityMatches(value, snapshot, textHash);
  if (!identityPassed) return parsedEvaluationFailure('evaluator_identity_mismatch', schemaPassed, identityEvidence(value, snapshot, textHash));
  if (!hasExactKeys(value, evaluatorKeys(snapshot))
    || typeof value.accepted !== 'boolean'
    || !EVALUATION_CRITERIA.every((criterion) => typeof value[criterion] === 'boolean')) return parsedEvaluationFailure('evaluator_failed', schemaPassed, true);
  const reasonCodes = parseReasonCodes(value.reasonCodes);
  if (!reasonCodes) return parsedEvaluationFailure('evaluator_failed', false, true);
  const failedCriteria: ContentLocalizeM6EvaluationCriterion[] = EVALUATION_CRITERIA
    .filter((criterion) => value[criterion] !== true);
  const accepted = value.accepted === true;
  return immutableCopy({
    ok: true as const,
    accepted: accepted && failedCriteria.length === 0,
    criteria: Object.fromEntries(EVALUATION_CRITERIA.map((criterion) => [criterion, value[criterion] === true])) as Record<ContentLocalizeM6EvaluationCriterion, boolean>,
    reasonCodes,
    failedCriteria,
    schemaPassed: true as const,
    identityPassed: true as const,
  });
}

function handledFailure(
  reason: ContentLocalizeM6ServerFailureReason,
  diagnostic: ContentLocalizeV3ServerDiagnostic,
): ContentLocalizeM6ServerResult {
  const result = { status: 'handled_failure' as const, reason } as { status: 'handled_failure'; reason: ContentLocalizeM6ServerFailureReason };
  Object.defineProperty(result, 'diagnostic', { value: diagnostic, enumerable: false, configurable: false });
  return Object.freeze(result) as ContentLocalizeM6ServerResult;
}

/**
 * Canonical handled-failure envelope for route-owned failures that occur
 * before the provider pipeline starts. The route serializes this same typed
 * result shape that the client already accepts for executor failures.
 */
export function createContentLocalizeM6HandledFailure(
  reason: ContentLocalizeM6ServerFailureReason,
  diagnostic: ContentLocalizeV3ServerDiagnostic = createEmptyContentLocalizeV3ServerDiagnostic(),
): Extract<ContentLocalizeM6ServerResult, { status: 'handled_failure' }> {
  return handledFailure(reason, diagnostic) as Extract<ContentLocalizeM6ServerResult, { status: 'handled_failure' }>;
}

function candidateReady(
  snapshot: ContentLocalizeM6Snapshot,
  translatedText: string,
  textHash: string,
  origin: 'primary' | 'repair',
  diagnostic: ContentLocalizeV3ServerDiagnostic,
): ContentLocalizeM6ServerResult {
  const result = {
    status: 'candidate_ready' as const,
    receipt: immutableCopy({
      ...identity(snapshot),
      translatedText,
      candidateTextHash: textHash,
      candidateOrigin: origin,
    }),
  } as { status: 'candidate_ready'; receipt: ContentLocalizeM6CandidateReceipt };
  Object.defineProperty(result, 'diagnostic', { value: diagnostic, enumerable: false, configurable: false });
  return Object.freeze(result) as ContentLocalizeM6ServerResult;
}

interface LocalDeadlineDecision {
  readonly deadlineExceeded: boolean;
  readonly deadlineOwner: LocalDeadlineOwner;
  readonly provenance: LocalDeadlineProvenance | null;
}

/** The sole server-side reader for deadline ownership and exceeded state. */
function readDeadlineDecision(error: unknown): LocalDeadlineDecision {
  const provenance = readLocalDeadlineProvenance(error);
  if (provenance) {
    return {
      deadlineExceeded: provenance.deadlineExceeded,
      deadlineOwner: provenance.deadlineOwner,
      provenance,
    };
  }
  return {
    deadlineExceeded: false,
    deadlineOwner: 'unknown',
    provenance: null,
  };
}

function isDeadlineFailure(error: unknown): boolean {
  return readDeadlineDecision(error).deadlineExceeded;
}

function deadlineMetadata(
  error: unknown,
  phase: LocalDeadlinePhase,
  options: ContentLocalizeM6ServerExecutionOptions | undefined,
): Pick<ContentLocalizeV3ServerDiagnostic, 'deadlineExceeded' | 'deadlineOwner' | 'deadlinePhase' | 'providerCallTimeoutMs' | 'routeBudgetMs' | 'providerElapsedMs' | 'routeElapsedMs'> {
  const decision = readDeadlineDecision(error);
  const provenance = decision.provenance;
  const record = isRecord(error) ? error : null;
  return {
    deadlineExceeded: decision.deadlineExceeded,
    deadlineOwner: decision.deadlineOwner,
    deadlinePhase: decision.deadlineExceeded ? phase : null,
    providerCallTimeoutMs: provenance?.configuredTimeoutMs
      ?? (typeof record?.configuredTimeoutMs === 'number' ? record.configuredTimeoutMs : null),
    routeBudgetMs: options?.routeBudgetMs ?? null,
    providerElapsedMs: provenance?.elapsedMs ?? null,
    routeElapsedMs: options?.routeStartedAt == null ? null : Math.max(0, Date.now() - options.routeStartedAt),
  };
}

const SAFE_PROVIDER_ERROR_CODES = new Set([
  'invalid_request', 'invalid_request_error', 'invalid_param', 'invalid_api_key',
  'authentication_error', 'permission_denied', 'permission_error', 'rate_limit',
  'rate_limit_error', 'overloaded', 'overloaded_error', 'internal_server_error',
  'model_not_found', 'billing_error', 'quota_exceeded', 'timeout', 'connection_error',
]);

function providerFailureMetadata(error: unknown, stage: string): Pick<ContentLocalizeV3ServerDiagnostic, 'providerFailureStage' | 'providerErrorType' | 'providerHttpStatus' | 'providerErrorCode' | 'providerMessageFingerprint' | 'providerRetryable'> {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const status = record && Number.isInteger(record.status) && Number(record.status) >= 100 && Number(record.status) <= 599
    ? Number(record.status)
    : null;
  const body = record?.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : null;
  const rawCode = typeof body?.code === 'string' ? body.code : typeof record?.code === 'string' ? record.code : null;
  const code = rawCode && /^[a-z][a-z0-9_.-]{0,63}$/u.test(rawCode)
    && SAFE_PROVIDER_ERROR_CODES.has(rawCode) ? rawCode : null;
  const retryable = typeof record?.retryable === 'boolean'
    ? record.retryable
    : typeof body?.retryable === 'boolean' ? body.retryable : null;
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null;
  return {
    providerFailureStage: stage,
    providerErrorType: error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(error.name)
      ? error.name
      : 'provider_error',
    providerHttpStatus: status,
    providerErrorCode: code,
    providerMessageFingerprint: fingerprintText(message),
    providerRetryable: retryable,
  };
}

/**
 * Executes the M6.4 logical candidate contract only. Model transport, routes,
 * apply, persistence, usage, and UI remain outside this server foundation.
 */
export async function executeContentLocalizeM6Server(
  snapshot: ContentLocalizeM6Snapshot,
  dependencies: ContentLocalizeM6ServerDependencies,
  options?: ContentLocalizeM6ServerExecutionOptions,
): Promise<ContentLocalizeM6ServerResult> {
  const authorized = validateSnapshot(snapshot);
  const diagnostic = { ...createEmptyContentLocalizeV3ServerDiagnostic() };
  if (!authorized) return handledFailure('invalid_authorization_snapshot', diagnostic);

  if (!dependencies || typeof dependencies.writer !== 'function') return handledFailure('writer_failed', diagnostic);
  let writerObservation: Partial<ContentLocalizeV3DiagnosticPhase> | null = null;
  let primaryRaw: unknown;
  try {
    primaryRaw = await dependencies.writer(writerRequest(authorized));
    writerObservation = readContentLocalizeV3ProviderObservation(primaryRaw);
  } catch (error) {
    const deadline = deadlineMetadata(error, 'writer', options);
    const reason = isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'writer_failed' as const;
    const d = { ...diagnostic, ...providerFailureMetadata(error, 'writer_transport'), ...deadline, writer: diagnosticPhaseFromProviderObservation({ result: 'failed' }, true), finalDecision: isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'transport_failure' as const, rejectionReasonCodes: [reason] };
    return handledFailure(reason, d);
  }
  const primaryWriter = parseWriter(primaryRaw, authorized);
  diagnostic.writer = diagnosticPhaseFromProviderObservation({ ...writerObservation, result: primaryWriter.ok ? 'succeeded' : 'malformed', identityPassed: primaryWriter.identityPassed, toolInputSchemaPassed: primaryWriter.schemaPassed }, true);
  if (!primaryWriter.ok) {
    return handledFailure(primaryWriter.reason, { ...diagnostic, finalDecision: 'transport_failure', rejectionReasonCodes: [primaryWriter.reason] });
  }
  diagnostic.candidatePresent = true;
  diagnostic.candidateHash = primaryWriter.candidateTextHash;
  diagnostic.candidateLength = primaryWriter.translatedText.length;

  if (typeof dependencies.evaluator !== 'function') return handledFailure('evaluator_failed', { ...diagnostic, finalDecision: 'transport_failure', rejectionReasonCodes: ['evaluator_failed'] });
  let primaryEvaluatorObservation: Partial<ContentLocalizeV3DiagnosticPhase> | null = null;
  let primaryEvaluationRaw: unknown;
  try {
    primaryEvaluationRaw = await dependencies.evaluator(evaluatorRequest(
      authorized,
      primaryWriter.translatedText,
      primaryWriter.candidateTextHash,
      'primary',
    ));
    primaryEvaluatorObservation = readContentLocalizeV3ProviderObservation(primaryEvaluationRaw);
  } catch (error) {
    const deadline = deadlineMetadata(error, 'evaluator', options);
    const reason = isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'evaluator_failed' as const;
    const d = { ...diagnostic, ...providerFailureMetadata(error, 'primary_evaluator_transport'), ...deadline, primaryEvaluator: diagnosticPhaseFromProviderObservation({ result: 'failed' }, true), finalDecision: isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'transport_failure' as const, rejectionReasonCodes: [reason] };
    return handledFailure(reason, d);
  }
  const primaryEvaluation = parseEvaluation(primaryEvaluationRaw, authorized, primaryWriter.candidateTextHash);
  diagnostic.primaryEvaluator = diagnosticPhaseFromProviderObservation({ ...primaryEvaluatorObservation, result: primaryEvaluation.ok ? 'succeeded' : 'malformed', identityPassed: primaryEvaluation.identityPassed, toolInputSchemaPassed: primaryEvaluation.schemaPassed }, true);
  if (!primaryEvaluation.ok) return handledFailure(primaryEvaluation.reason, { ...diagnostic, finalDecision: 'transport_failure', rejectionReasonCodes: [primaryEvaluation.reason] });
  diagnostic.primaryEvaluation = {
    accepted: primaryEvaluation.accepted,
    ...primaryEvaluation.criteria,
  };
  if (primaryEvaluation.accepted) {
    return candidateReady(authorized, primaryWriter.translatedText, primaryWriter.candidateTextHash, 'primary', { ...diagnostic, finalDecision: 'accepted' });
  }

  if (typeof dependencies.repair !== 'function') return handledFailure('repair_failed', { ...diagnostic, finalDecision: 'transport_failure', rejectionReasonCodes: ['repair_failed'] });
  let repairObservation: Partial<ContentLocalizeV3DiagnosticPhase> | null = null;
  let repairRaw: unknown;
  try {
    repairRaw = await dependencies.repair(repairRequest(
      authorized,
      primaryWriter.translatedText,
      primaryWriter.candidateTextHash,
      primaryEvaluation,
    ));
    repairObservation = readContentLocalizeV3ProviderObservation(repairRaw);
  } catch (error) {
    const deadline = deadlineMetadata(error, 'repair_writer', options);
    const reason = isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'repair_failed' as const;
    const d = { ...diagnostic, ...providerFailureMetadata(error, 'repair_writer_transport'), ...deadline, repair: diagnosticPhaseFromProviderObservation({ result: 'failed' }, true), finalDecision: isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'transport_failure' as const, rejectionReasonCodes: [reason] };
    return handledFailure(reason, d);
  }
  const repairedWriter = parseWriter(repairRaw, authorized);
  diagnostic.repair = diagnosticPhaseFromProviderObservation({ ...repairObservation, result: repairedWriter.ok ? 'succeeded' : 'malformed', identityPassed: repairedWriter.identityPassed, toolInputSchemaPassed: repairedWriter.schemaPassed }, true);
  if (!repairedWriter.ok) {
    const reason = repairedWriter.reason === 'writer_identity_mismatch'
      ? 'repair_identity_mismatch'
      : repairedWriter.reason === 'writer_candidate_invalid'
        ? 'repair_candidate_invalid'
        : 'repair_failed';
    return handledFailure(reason, { ...diagnostic, finalDecision: 'transport_failure', rejectionReasonCodes: [reason] });
  }
  diagnostic.repairCandidatePresent = true;
  diagnostic.repairCandidateHash = repairedWriter.candidateTextHash;
  diagnostic.repairCandidateLength = repairedWriter.translatedText.length;

  let repairEvaluatorObservation: Partial<ContentLocalizeV3DiagnosticPhase> | null = null;
  let repairEvaluationRaw: unknown;
  try {
    repairEvaluationRaw = await dependencies.evaluator(evaluatorRequest(
      authorized,
      repairedWriter.translatedText,
      repairedWriter.candidateTextHash,
      'repair',
    ));
    repairEvaluatorObservation = readContentLocalizeV3ProviderObservation(repairEvaluationRaw);
  } catch (error) {
    const deadline = deadlineMetadata(error, 'repair_evaluator', options);
    const reason = isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'evaluator_failed' as const;
    const d = { ...diagnostic, ...providerFailureMetadata(error, 'repair_evaluator_transport'), ...deadline, repairEvaluator: diagnosticPhaseFromProviderObservation({ result: 'failed' }, true), finalDecision: isDeadlineFailure(error) ? 'deadline_exceeded' as const : 'transport_failure' as const, rejectionReasonCodes: [reason] };
    return handledFailure(reason, d);
  }
  const repairEvaluation = parseEvaluation(repairEvaluationRaw, authorized, repairedWriter.candidateTextHash);
  diagnostic.repairEvaluator = diagnosticPhaseFromProviderObservation({ ...repairEvaluatorObservation, result: repairEvaluation.ok ? 'succeeded' : 'malformed', identityPassed: repairEvaluation.identityPassed, toolInputSchemaPassed: repairEvaluation.schemaPassed }, true);
  if (!repairEvaluation.ok) return handledFailure(repairEvaluation.reason, { ...diagnostic, finalDecision: 'transport_failure', rejectionReasonCodes: [repairEvaluation.reason] });
  diagnostic.repairEvaluation = {
    accepted: repairEvaluation.accepted,
    ...repairEvaluation.criteria,
  };
  if (!repairEvaluation.accepted) return handledFailure('candidate_rejected', { ...diagnostic, finalDecision: 'rejected', rejectionReasonCodes: [...repairEvaluation.reasonCodes, 'candidate_rejected'] });
  return candidateReady(authorized, repairedWriter.translatedText, repairedWriter.candidateTextHash, 'repair', { ...diagnostic, finalDecision: 'accepted' });
}
