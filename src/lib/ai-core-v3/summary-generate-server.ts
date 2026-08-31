import { createCandidateEnvelope } from './candidate-envelope';
import type Anthropic from '@anthropic-ai/sdk';
import type { AiCoreV3CandidateEnvelope } from './contracts';
import { immutableCopy } from './immutability';
import { INTERNAL_AI_RESET_ENABLED } from '../build-channel';
import {
  AI_PLATFORM_MAX_DURATION_S,
  EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS,
  EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS,
} from '../ai-request-timing';
import {
  SUMMARY_V3_GENERATE_ACTION,
  hashSummaryV3Value,
  type SummaryV3DiagnosticAttempt,
  type SummaryV3GenerateResponse,
  type SummaryV3Manifest,
  type SummaryV3WriterOutput,
  type SummaryV3WriterUnit,
  type SummaryV3TransportEvidence,
  type SummaryV3ProviderPhase,
  type SummaryV3ProviderFailureStage,
  type SummaryV3ProviderFailureEnvelope,
  type SummaryV3ProviderErrorClass,
  type SummaryV3ProviderErrorType,
} from './summary-generate';
import {
  runAiCoreV3Validation,
  validateStructuralPhase,
  type AggregateValidationResult,
  type AiCoreV3Violation,
  type ValidationPhaseResult,
} from './validators';

export interface SummaryV3GenerateTransportSet {
  readonly write: (prompt: string, phase?: SummaryV3ProviderPhase) => Promise<SummaryV3WriterResponse>;
  readonly evaluate: (prompt: string, phase?: SummaryV3ProviderPhase) => Promise<SummaryV3EvaluatorResponse>;
}

export const SUMMARY_V3_WRITER_TOOL_NAME = 'submit_summary_generation' as const;
export const SUMMARY_V3_EVALUATOR_TOOL_NAME = 'submit_summary_validation' as const;

/** M4 aliases existing constrained-provider authorities; no new transport value is introduced. */
export const SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS = EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS;
export const SUMMARY_V3_SERVER_BUDGET_MS = EXPERIENCE_LOCALIZATION_SERVER_BUDGET_MS;
export const SUMMARY_V3_POST_PROCESSING_HEADROOM_MS =
  AI_PLATFORM_MAX_DURATION_S * 1_000 - SUMMARY_V3_SERVER_BUDGET_MS;

export function computeSummaryV3ServerDeadline(requestStartedAt: number): number {
  return requestStartedAt + SUMMARY_V3_SERVER_BUDGET_MS;
}

type EvaluatedCategory = 'semantic' | 'language_quality';

interface EvaluatorPayload {
  readonly operationId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly phases: Readonly<Record<EvaluatedCategory, {
    readonly status: 'passed' | 'failed';
    readonly violations: readonly AiCoreV3Violation[];
  }>>;
  readonly checks: Readonly<Record<SummaryEvaluatorCheck, boolean>>;
}

const SUMMARY_EVALUATOR_CHECKS = [
  'factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
  'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected',
  'targetLanguageAndScript', 'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense',
  'grammarAndClarity', 'duplicationAndDegradationAbsent', 'completeSummaryUsable',
] as const;
type SummaryEvaluatorCheck = (typeof SUMMARY_EVALUATOR_CHECKS)[number];

const SAFE_PROVIDER_ERROR_CODES = new Set([
  'invalid_request', 'invalid_request_error', 'invalid_param', 'invalid_api_key',
  'authentication_error', 'permission_denied', 'permission_error', 'rate_limit',
  'rate_limit_error', 'overloaded', 'overloaded_error', 'internal_server_error',
  'model_not_found', 'billing_error', 'quota_exceeded', 'timeout', 'connection_error',
]);

const SAFE_TOOL_VALIDATION_CODES = new Set([
  'input_not_object', 'top_level_keys', 'units_type', 'units_length', 'unit_not_object',
  'unit_keys', 'slot_type_or_enum', 'entry_id_type', 'fact_ids_type', 'fact_id_type',
  'text_type', 'text_content', 'unit_order', 'duration_contract', 'entry_ownership',
  'fact_ownership', 'duplicate_fact_ids',
]);

function providerStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as Record<string, unknown>).status;
  return Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599 ? Number(status) : null;
}

function errorClassName(error: unknown): string | null {
  return error && typeof error === 'object' && error.constructor && typeof error.constructor === 'function'
    ? error.constructor.name
    : error instanceof Error ? 'Error' : null;
}

function providerErrorClass(error: unknown): SummaryV3ProviderErrorClass | null {
  const name = errorClassName(error);
  return name && ['APIError', 'APIUserAbortError', 'APIConnectionError', 'APIConnectionTimeoutError',
    'BadRequestError', 'AuthenticationError', 'PermissionDeniedError', 'RateLimitError',
    'InternalServerError', 'Error'].includes(name) ? name as SummaryV3ProviderErrorClass : null;
}

function isDeadlineOrAbortError(error: unknown): boolean {
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'APIUserAbortError'
    || error.name === 'APIConnectionTimeoutError')) return true;
  if (!error || typeof error !== 'object') return false;
  const owner = (error as Record<string, unknown>).deadlineOwner;
  return owner === 'provider_transport' || owner === 'verifier_transport'
    || owner === 'route_deadline' || owner === 'client_abort';
}

function providerErrorType(error: unknown, status: number | null, stage: SummaryV3ProviderFailureStage): SummaryV3ProviderErrorType {
  if (stage === 'response_extraction') return 'response_extraction';
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission';
  if (status === 429) return 'rate_limit';
  if (status !== null && status >= 500) return 'provider_5xx';
  if (isDeadlineOrAbortError(error) || errorClassName(error) === 'APIConnectionTimeoutError'
    || errorClassName(error) === 'APIUserAbortError') return 'timeout';
  if (errorClassName(error) === 'APIConnectionError') return 'connection/network';
  return 'unknown';
}

function retryableForType(type: SummaryV3ProviderErrorType): boolean | null {
  if (type === 'rate_limit' || type === 'provider_5xx' || type === 'connection/network') return true;
  if (type === 'invalid_request' || type === 'authentication' || type === 'permission'
    || type === 'timeout' || type === 'response_extraction') return false;
  return null;
}

function safeProviderCode(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,63}$/u.test(value) && SAFE_PROVIDER_ERROR_CODES.has(value) ? value : null;
}

function safeStructuralPath(value: string | null | undefined): string | null {
  return typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,127}$/u.test(value) ? value : null;
}

function safeHash(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? hashSummaryV3Value(value) : null;
}

/** Build finite provider evidence without serializing raw SDK errors. */
export function classifySummaryV3ProviderFailure(
  error: unknown,
  phase: SummaryV3ProviderPhase,
  stage: SummaryV3ProviderFailureStage = 'sdk_request',
  fieldPath?: string | null,
): SummaryV3ProviderFailureEnvelope {
  if (error instanceof SummaryV3ProviderTransportError) return error.envelope;
  const status = providerStatus(error);
  const type = providerErrorType(error, status, stage);
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const body = record?.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : null;
  const message = error instanceof Error && error.message.trim() ? error.message : null;
  const requestId = typeof record?.requestID === 'string' ? record.requestID : null;
  return immutableCopy({
    phase,
    failureStage: stage,
    errorClass: providerErrorClass(error),
    providerHttpStatus: status,
    providerErrorType: type === 'unknown' ? null : type,
    providerErrorCode: safeProviderCode(body?.code),
    providerRequestIdHash: safeHash(requestId),
    providerRetryable: retryableForType(type),
    providerMessageFingerprint: safeHash(message),
    providerStructuralFieldPath: safeStructuralPath(fieldPath),
    providerHttpResponseReceived: stage === 'response_extraction' || stage === 'tool_validation'
      ? true : status !== null ? true : null,
  }) as SummaryV3ProviderFailureEnvelope;
}

type SummaryV3ToolValidationEvidence = Readonly<{
  readonly code: string;
  readonly fieldPath: string | null;
}>;

function toolValidationFailure(
  phase: SummaryV3ProviderPhase,
  reason: string,
  evidence?: SummaryV3ToolValidationEvidence,
): SummaryV3ProviderFailureEnvelope {
  const base = classifySummaryV3ProviderFailure(new Error(reason), phase, 'tool_validation', evidence?.fieldPath);
  return immutableCopy({ ...base, errorClass: null, providerErrorType: null, providerRetryable: false,
    providerErrorCode: evidence && SAFE_TOOL_VALIDATION_CODES.has(evidence.code) ? evidence.code : null,
    providerHttpResponseReceived: true }) as SummaryV3ProviderFailureEnvelope;
}

/** Error wrapper preserves the original Error in memory while exposing only safe evidence. */
export class SummaryV3ProviderTransportError extends Error {
  readonly envelope: SummaryV3ProviderFailureEnvelope;
  constructor(envelope: SummaryV3ProviderFailureEnvelope, cause?: unknown) {
    super('M4 provider transport failure');
    this.name = 'SummaryV3ProviderTransportError';
    this.envelope = immutableCopy(envelope);
    if (cause !== undefined) Object.defineProperty(this, 'cause', { value: cause, enumerable: false, configurable: true });
  }
}

export function createSummaryV3ProviderTransportError(
  error: unknown,
  phase: SummaryV3ProviderPhase,
  stage: SummaryV3ProviderFailureStage = 'sdk_request',
  fieldPath?: string | null,
): SummaryV3ProviderTransportError {
  return new SummaryV3ProviderTransportError(classifySummaryV3ProviderFailure(error, phase, stage, fieldPath), error);
}

function evaluatorPhaseSchema(category: EvaluatedCategory) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'violations'],
    properties: {
      status: { type: 'string', enum: ['passed', 'failed'] },
      violations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'category', 'detail'],
          properties: {
            code: { type: 'string' },
            category: { type: 'string', const: category },
            detail: { type: 'string' },
            factIds: { type: 'array', items: { type: 'string' } },
            entryIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  } as const;
}

export const SUMMARY_V3_WRITER_TOOL: Anthropic.Tool = {
  name: SUMMARY_V3_WRITER_TOOL_NAME,
  description: 'Submit only the fact-locked Summary units. This tool cannot authorize validation, apply, persistence, usage, retries, or repair.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['operationId', 'snapshotHash', 'locale', 'units'],
    properties: {
      operationId: { type: 'string' },
      snapshotHash: { type: 'string' },
      locale: { type: 'string' },
      units: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['slot', 'entryId', 'factIds', 'text'],
          properties: {
            slot: { type: 'string', enum: ['duration', 'experience'] },
            entryId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            factIds: { type: 'array', items: { type: 'string' } },
            text: { type: 'string' },
          },
        },
      },
    },
  },
};

export const SUMMARY_V3_EVALUATOR_TOOL: Anthropic.Tool = {
  name: SUMMARY_V3_EVALUATOR_TOOL_NAME,
  description: 'Submit only independent Summary validation evidence. This tool cannot rewrite or authorize apply, persistence, usage, retries, or repair.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['operationId', 'snapshotHash', 'locale', 'phases', 'checks'],
    properties: {
      operationId: { type: 'string' },
      snapshotHash: { type: 'string' },
      locale: { type: 'string' },
      phases: {
        type: 'object',
        additionalProperties: false,
        required: ['semantic', 'language_quality'],
        properties: {
          semantic: evaluatorPhaseSchema('semantic'),
          language_quality: evaluatorPhaseSchema('language_quality'),
        },
      },
      checks: {
        type: 'object',
        additionalProperties: false,
        required: [...SUMMARY_EVALUATOR_CHECKS],
        properties: Object.fromEntries(SUMMARY_EVALUATOR_CHECKS.map((check) => [check, { type: 'boolean' }])),
      },
    },
  },
};

export type SummaryV3ContentBlock =
  | { readonly type: 'tool_use'; readonly name: string; readonly input: unknown }
  | { readonly type: string; readonly text?: string };

export interface SummaryV3WriterResponse {
  readonly stopReason: string | null;
  readonly content: readonly SummaryV3ContentBlock[];
}

export type SummaryV3EvaluatorResponse = SummaryV3WriterResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function failure(
  typedReason: string,
  validation?: AggregateValidationResult,
  repairAttempted?: boolean,
  rejectedCandidate?: AiCoreV3CandidateEnvelope,
  transportEvidence?: SummaryV3TransportEvidence,
  m4ProviderFailure?: SummaryV3ProviderFailureEnvelope | null,
): SummaryV3GenerateResponse {
  return immutableCopy({
    ok: false as const,
    action: SUMMARY_V3_GENERATE_ACTION,
    typedReason,
    ...(validation ? { validation } : {}),
    ...(repairAttempted !== undefined ? { repairAttempted } : {}),
    ...(INTERNAL_AI_RESET_ENABLED && rejectedCandidate ? { rejectedCandidate } : {}),
    ...(transportEvidence ? { transportEvidence } : {}),
    ...(m4ProviderFailure ? { m4ProviderFailure } : {}),
  }) as SummaryV3GenerateResponse;
}

function parseDate(value: unknown): { readonly year: number; readonly month?: number; readonly day?: number } | null {
  if (!isRecord(value) || !exactKeys(value, ['year'], ['month', 'day']) || !Number.isInteger(value.year)) return null;
  if (value.month !== undefined && (!Number.isInteger(value.month) || Number(value.month) < 1 || Number(value.month) > 12)) return null;
  if (value.day !== undefined && (!Number.isInteger(value.day) || Number(value.day) < 1 || Number(value.day) > 31)) return null;
  return { year: Number(value.year), ...(value.month !== undefined ? { month: Number(value.month) } : {}),
    ...(value.day !== undefined ? { day: Number(value.day) } : {}) };
}

function parseAuthorities(value: unknown): readonly { id: string; text: string; hash: string }[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((item) => {
    if (!isRecord(item) || !exactKeys(item, ['id', 'text', 'hash'])
      || typeof item.id !== 'string' || !item.id.trim() || typeof item.text !== 'string'
      || typeof item.hash !== 'string' || !item.hash.trim()) return null;
    return { id: item.id, text: item.text, hash: item.hash };
  });
  return parsed.some((item) => item === null) ? null : parsed as readonly { id: string; text: string; hash: string }[];
}

export function parseSummaryV3GenerateRequest(value: unknown): SummaryV3Manifest | null {
  if (!isRecord(value) || !exactKeys(value, ['manifest']) || !isRecord(value.manifest)) return null;
  const manifest = value.manifest;
  if (!exactKeys(manifest, [
    'operationId', 'operationKind', 'targetLocale', 'currentRoleEntryId', 'selectedEntries',
    'structuredTotalDurationMonths', 'skills', 'education', 'languages', 'sourceSnapshotHash',
    'requestedLocale', 'sourceLocale', 'jobContextHash', 'manifestHash', 'gender',
    'skillAuthorities', 'educationAuthorities', 'languageAuthorities',
  ])) return null;
  if (manifest.operationKind !== 'summary_generate' || typeof manifest.operationId !== 'string' || !manifest.operationId.trim()
    || typeof manifest.targetLocale !== 'string' || !manifest.targetLocale.trim()
    || manifest.requestedLocale !== manifest.targetLocale || manifest.sourceLocale !== manifest.targetLocale
    || typeof manifest.sourceSnapshotHash !== 'string' || !manifest.sourceSnapshotHash.trim()
    || typeof manifest.jobContextHash !== 'string' || !manifest.jobContextHash.trim()
    || typeof manifest.manifestHash !== 'string' || !manifest.manifestHash.trim()
    || typeof manifest.gender !== 'string' || typeof manifest.currentRoleEntryId !== 'string'
    || !manifest.currentRoleEntryId.trim() || !Number.isInteger(manifest.structuredTotalDurationMonths)
    || Number(manifest.structuredTotalDurationMonths) < 0 || !Array.isArray(manifest.selectedEntries)
    || manifest.selectedEntries.length === 0 || !Array.isArray(manifest.skills)
    || !Array.isArray(manifest.education) || !Array.isArray(manifest.languages)) return null;
  const entries = manifest.selectedEntries.map((entry) => {
    if (!isRecord(entry) || !exactKeys(entry, [
      'entryId', 'roleTitle', 'employer', 'employmentState', 'dates', 'facts',
      'exactSourceDescription', 'sourceKind', 'sourceHash', 'sourceUnits', 'sourceFactSetHash',
      'rawStartDate', 'rawEndDate', 'indexDiagnostic',
    ]) || typeof entry.entryId !== 'string' || !entry.entryId.trim()
      || typeof entry.roleTitle !== 'string' || !entry.roleTitle.trim() || typeof entry.employer !== 'string'
      || (entry.employmentState !== 'present' && entry.employmentState !== 'completed')
      || typeof entry.exactSourceDescription !== 'string' || !entry.exactSourceDescription.trim()
      || (entry.sourceKind !== 'mounted_textarea' && entry.sourceKind !== 'committed_cv_ref')
      || typeof entry.sourceHash !== 'string' || typeof entry.sourceFactSetHash !== 'string'
      || typeof entry.rawStartDate !== 'string' || typeof entry.rawEndDate !== 'string'
      || !Number.isInteger(entry.indexDiagnostic) || !Array.isArray(entry.sourceUnits)
      || entry.sourceUnits.length === 0 || !Array.isArray(entry.facts) || !isRecord(entry.dates)
      || !exactKeys(entry.dates, ['start', 'end'])) return null;
    const start = parseDate(entry.dates.start);
    const end = entry.dates.end === null ? null : parseDate(entry.dates.end);
    if (!start || (entry.employmentState === 'present' ? end !== null : !end)) return null;
    const facts = entry.facts.map((fact) => {
      if (!isRecord(fact) || !exactKeys(fact, ['factId', 'text', 'sourceHash', 'required'])
        || typeof fact.factId !== 'string' || !fact.factId.trim() || typeof fact.text !== 'string'
        || !fact.text.trim() || typeof fact.sourceHash !== 'string' || fact.required !== true) return null;
      return { factId: fact.factId, text: fact.text, sourceHash: fact.sourceHash, required: true as const };
    });
    if (facts.some((fact) => fact === null) || facts.length !== entry.sourceUnits.length) return null;
    return { ...entry, dates: { start, end }, facts };
  });
  if (entries.some((entry) => entry === null)) return null;
  const typedEntries = entries as unknown as SummaryV3Manifest['selectedEntries'];
  const entryIds = typedEntries.map((entry) => entry.entryId);
  const factIds = typedEntries.flatMap((entry) => entry.facts.map((fact) => fact.factId));
  if (new Set(entryIds).size !== entryIds.length || new Set(factIds).size !== factIds.length
    || !entryIds.includes(manifest.currentRoleEntryId)) return null;
  const skillAuthorities = parseAuthorities(manifest.skillAuthorities);
  const educationAuthorities = parseAuthorities(manifest.educationAuthorities);
  const languageAuthorities = parseAuthorities(manifest.languageAuthorities);
  if (!skillAuthorities || !educationAuthorities || !languageAuthorities) return null;
  const candidate = {
    ...manifest,
    selectedEntries: typedEntries,
    skillAuthorities,
    educationAuthorities,
    languageAuthorities,
  } as unknown as SummaryV3Manifest;
  const { manifestHash: _hash, ...withoutHash } = candidate;
  const hashable = {
    ...withoutHash,
    selectedEntries: candidate.selectedEntries.map(({ indexDiagnostic: _indexDiagnostic, ...entry }) => entry),
  };
  if (hashSummaryV3Value(hashable) !== manifest.manifestHash) return null;
  return immutableCopy(candidate) as SummaryV3Manifest;
}

function safeUnitText(text: string): boolean {
  const trimmed = text.trim();
  return Boolean(trimmed) && !/```|^#{1,6}\s|^(?:[-*•▪◦‣⁃]|\d+[.)])\s|^(?:summary|output|explanation|here(?:'s| is))\b/imu.test(trimmed);
}

type SummaryV3WriterObjectParseResult =
  | { readonly ok: true; readonly value: SummaryV3WriterOutput }
  | { readonly ok: false; readonly evidence: SummaryV3ToolValidationEvidence };

function writerObjectFailure(code: string, fieldPath: string | null): SummaryV3WriterObjectParseResult {
  return { ok: false, evidence: { code, fieldPath } };
}

type SummaryV3WriterUnitParseResult =
  | { readonly ok: true; readonly value: SummaryV3WriterUnit }
  | { readonly ok: false; readonly evidence: SummaryV3ToolValidationEvidence };

function writerUnitFailure(code: string, fieldPath: string): SummaryV3WriterUnitParseResult {
  return { ok: false, evidence: { code, fieldPath } };
}

function parseSummaryV3WriterObjectDetailed(
  value: unknown,
  manifest: SummaryV3Manifest,
): SummaryV3WriterObjectParseResult {
  if (!isRecord(value)) return writerObjectFailure('input_not_object', null);
  if (!exactKeys(value, ['operationId', 'snapshotHash', 'locale', 'units'])) {
    return writerObjectFailure('top_level_keys', 'root');
  }
  if (value.operationId !== manifest.operationId || value.snapshotHash !== manifest.sourceSnapshotHash
    || value.locale !== manifest.targetLocale) {
    return writerObjectFailure('top_level_keys', 'root');
  }
  if (!Array.isArray(value.units)) return writerObjectFailure('units_type', 'units');
  if (value.units.length !== manifest.selectedEntries.length + 1) {
    return writerObjectFailure('units_length', 'units');
  }
  const units = value.units.map((unit, index) => {
    const path = `units.${index}`;
    if (!isRecord(unit)) return writerUnitFailure('unit_not_object', path);
    if (!exactKeys(unit, ['slot', 'entryId', 'factIds', 'text'])) return writerUnitFailure('unit_keys', path);
    if (unit.slot !== 'duration' && unit.slot !== 'experience') {
      return writerUnitFailure('slot_type_or_enum', `${path}.slot`);
    }
    if (!(typeof unit.entryId === 'string' || unit.entryId === null)) {
      return writerUnitFailure('entry_id_type', `${path}.entryId`);
    }
    if (!Array.isArray(unit.factIds)) return writerUnitFailure('fact_ids_type', `${path}.factIds`);
    if (unit.factIds.some((id) => typeof id !== 'string')) {
      return writerUnitFailure('fact_id_type', `${path}.factIds`);
    }
    if (typeof unit.text !== 'string') return writerUnitFailure('text_type', `${path}.text`);
    if (!safeUnitText(unit.text)) return writerUnitFailure('text_content', `${path}.text`);
    return { ok: true as const, value: { slot: unit.slot, entryId: unit.entryId, factIds: unit.factIds, text: unit.text } as SummaryV3WriterUnit };
  });
  const firstFailure = units.find((unit): unit is { readonly ok: false; readonly evidence: SummaryV3ToolValidationEvidence } => !unit.ok);
  if (firstFailure) return firstFailure;
  const typed = units.map((unit) => (unit as { readonly ok: true; readonly value: SummaryV3WriterUnit }).value);
  if (typed[0]?.slot !== 'duration' || typed.slice(1).some((unit) => unit.slot !== 'experience')) {
    return writerObjectFailure('unit_order', 'units');
  }
  const duration = typed.filter((unit) => unit.slot === 'duration');
  const experiences = typed.filter((unit) => unit.slot === 'experience');
  if (duration.length !== 1 || duration[0].entryId !== null || duration[0].factIds.length !== 0
    || experiences.length !== manifest.selectedEntries.length) {
    return writerObjectFailure('duration_contract', 'units');
  }
  for (let index = 0; index < experiences.length; index += 1) {
    const expected = manifest.selectedEntries[index];
    const actual = experiences[index];
    const expectedFactIds = expected.facts.map((fact) => fact.factId);
    if (actual.entryId !== expected.entryId) return writerObjectFailure('entry_ownership', `units.${index + 1}.entryId`);
    if (actual.factIds.length !== expectedFactIds.length
      || actual.factIds.some((id, factIndex) => id !== expectedFactIds[factIndex])) {
      return writerObjectFailure('fact_ownership', `units.${index + 1}.factIds`);
    }
  }
  const all = experiences.flatMap((unit) => unit.factIds);
  if (new Set(all).size !== all.length) return writerObjectFailure('duplicate_fact_ids', 'units.factIds');
  return { ok: true, value: immutableCopy({ operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash,
    locale: manifest.targetLocale, units: typed }) as SummaryV3WriterOutput };
}

function parseSummaryV3WriterObject(value: unknown, manifest: SummaryV3Manifest): SummaryV3WriterOutput | null {
  const result = parseSummaryV3WriterObjectDetailed(value, manifest);
  return result.ok ? result.value : null;
}

export function parseSummaryV3WriterOutput(value: unknown, manifest: SummaryV3Manifest): SummaryV3WriterOutput | null {
  return parseSummaryV3WriterObject(value, manifest);
}

function emptyTransportAttempt(attempted: boolean, result: SummaryV3DiagnosticAttempt['result']): SummaryV3DiagnosticAttempt {
  return {
    attempted, result, stopReason: null,
    contentBlockCount: null, textBlockCount: null, toolBlockCount: null,
    expectedToolCount: null, toolNameMatched: null, toolInputObject: null,
    toolInputSchemaPassed: null, identityPassed: null,
  };
}

function responseTransportAttempt(
  response: SummaryV3WriterResponse | SummaryV3EvaluatorResponse | null | undefined,
  expectedToolName: string,
  result: SummaryV3DiagnosticAttempt['result'],
): SummaryV3DiagnosticAttempt {
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) {
    return emptyTransportAttempt(true, result);
  }
  const tools = response.content.filter((block): block is Extract<SummaryV3ContentBlock, { type: 'tool_use' }> => (
    block.type === 'tool_use'
  ));
  const expected = tools.length === 1 ? tools[0] : null;
  return {
    attempted: true,
    result,
    stopReason: typeof response.stopReason === 'string' && /^[a-z][a-z0-9_-]{0,63}$/u.test(response.stopReason)
      ? response.stopReason : null,
    contentBlockCount: response.content.length,
    textBlockCount: response.content.filter((block) => block.type === 'text').length,
    toolBlockCount: tools.length,
    expectedToolCount: 1,
    toolNameMatched: expected ? expected.name === expectedToolName : null,
    toolInputObject: expected ? isRecord(expected.input) : null,
    toolInputSchemaPassed: null,
    identityPassed: null,
  };
}

function updateTransportAttempt(
  response: SummaryV3WriterResponse | SummaryV3EvaluatorResponse,
  expectedToolName: string,
  result: SummaryV3DiagnosticAttempt['result'],
  schemaPassed: boolean | null,
  identityPassed: boolean | null,
): SummaryV3DiagnosticAttempt {
  return {
    ...responseTransportAttempt(response, expectedToolName, result),
    toolInputSchemaPassed: schemaPassed,
    identityPassed,
  };
}

function unavailableTransportEvidence(): SummaryV3TransportEvidence {
  return { writer: emptyTransportAttempt(false, 'not_attempted'), evaluator: emptyTransportAttempt(false, 'not_attempted') };
}

function failedTransportEvidence(
  evidence: SummaryV3TransportEvidence,
  phase: 'writer' | 'evaluator',
): SummaryV3TransportEvidence {
  return { ...evidence, [phase]: emptyTransportAttempt(true, 'failed') } as SummaryV3TransportEvidence;
}

export type SummaryV3WriterToolParseResult =
  | { readonly ok: true; readonly value: SummaryV3WriterOutput; readonly diagnosticMetadata: SummaryV3DiagnosticAttempt }
  | { readonly ok: false; readonly typedReason: string; readonly diagnosticMetadata: SummaryV3DiagnosticAttempt; readonly toolValidation?: SummaryV3ToolValidationEvidence };

export function parseSummaryV3WriterToolResponse(
  response: SummaryV3WriterResponse,
  manifest: SummaryV3Manifest,
): SummaryV3WriterToolParseResult {
  const base = responseTransportAttempt(response, SUMMARY_V3_WRITER_TOOL_NAME, 'unknown');
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) {
    return { ok: false, typedReason: 'provider_output_malformed', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  if (response.stopReason === 'max_tokens') {
    return { ok: false, typedReason: 'writer_max_tokens', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  if (response.stopReason !== 'tool_use') {
    return { ok: false, typedReason: 'provider_output_malformed', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  const unexpected = response.content.find((block) => block.type !== 'tool_use');
  if (unexpected?.type === 'text') {
    return { ok: false, typedReason: 'writer_unexpected_text_block', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  if (unexpected) {
    return { ok: false, typedReason: 'provider_output_malformed', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  const tools = response.content.filter((block): block is Extract<SummaryV3ContentBlock, { type: 'tool_use' }> => (
    block.type === 'tool_use'
  ));
  if (tools.length === 0) return { ok: false, typedReason: 'writer_tool_missing', diagnosticMetadata: { ...base, result: 'malformed' } };
  if (tools.length !== 1) return { ok: false, typedReason: 'writer_multiple_tools', diagnosticMetadata: { ...base, result: 'malformed' } };
  const [tool] = tools;
  if (tool.name !== SUMMARY_V3_WRITER_TOOL_NAME) {
    return { ok: false, typedReason: 'writer_wrong_tool', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  const inputMetadata = { ...base, toolInputObject: isRecord(tool.input) };
  if (!isRecord(tool.input)) {
    return { ok: false, typedReason: 'writer_tool_input_malformed', diagnosticMetadata: { ...inputMetadata, result: 'malformed', toolInputSchemaPassed: false },
      toolValidation: { code: 'input_not_object', fieldPath: null } };
  }
  if (!exactKeys(tool.input, ['operationId', 'snapshotHash', 'locale', 'units'])) {
    return { ok: false, typedReason: 'writer_tool_input_malformed', diagnosticMetadata: { ...inputMetadata, result: 'malformed', toolInputSchemaPassed: false },
      toolValidation: { code: 'top_level_keys', fieldPath: 'root' } };
  }
  if (tool.input.operationId !== manifest.operationId || tool.input.snapshotHash !== manifest.sourceSnapshotHash
    || tool.input.locale !== manifest.targetLocale) {
    return { ok: false, typedReason: 'writer_identity_mismatch', diagnosticMetadata: {
      ...inputMetadata, result: 'malformed', toolInputSchemaPassed: true, identityPassed: false,
    } };
  }
  const value = parseSummaryV3WriterObject(tool.input, manifest);
  if (!value) {
    const detailed = parseSummaryV3WriterObjectDetailed(tool.input, manifest);
    return { ok: false, typedReason: 'writer_tool_input_malformed', diagnosticMetadata: { ...inputMetadata, result: 'malformed', toolInputSchemaPassed: false, identityPassed: true },
      toolValidation: detailed.ok ? undefined : detailed.evidence };
  }
  return { ok: true, value, diagnosticMetadata: updateTransportAttempt(response, SUMMARY_V3_WRITER_TOOL_NAME, 'succeeded', true, true) };
}

function candidateFromOutput(manifest: SummaryV3Manifest, output: SummaryV3WriterOutput): AiCoreV3CandidateEnvelope {
  const text = output.units.map((unit) => unit.text).join(' ');
  return createCandidateEnvelope({
    operationId: manifest.operationId,
    candidateId: hashSummaryV3Value(`${manifest.operationId}:${manifest.sourceSnapshotHash}:${text}`),
    operationKind: 'summary_generate',
    targetLocale: manifest.targetLocale,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    text,
    units: output.units.map((unit, index) => ({
      unitId: unit.slot === 'duration' ? 'summary:duration' : `summary:${unit.entryId}:${index}`,
      ...(unit.entryId ? { entryId: unit.entryId } : {}),
      factIds: unit.factIds,
      text: unit.text,
    })),
  });
}

function structuralPhase(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope,
  output: SummaryV3WriterOutput): ValidationPhaseResult {
  const base = validateStructuralPhase({ manifest, candidate });
  const violations = [...base.violations];
  if (candidate.text !== output.units.map((unit) => unit.text).join(' ')) {
    violations.push({ code: 'writer_text_mutated', category: 'structural', detail: 'Candidate must be the byte-exact deterministic unit join' });
  }
  return immutableCopy({ category: 'structural' as const,
    status: violations.length ? 'failed' as const : 'passed' as const, violations }) as ValidationPhaseResult;
}

function parseViolation(value: unknown, category: EvaluatedCategory): AiCoreV3Violation | null {
  if (!isRecord(value) || !exactKeys(value, ['code', 'category', 'detail'], ['factIds', 'entryIds'])
    || value.category !== category || typeof value.code !== 'string' || !value.code.trim()
    || typeof value.detail !== 'string' || !value.detail.trim()
    || (value.factIds !== undefined && (!Array.isArray(value.factIds) || value.factIds.some((id) => typeof id !== 'string')))
    || (value.entryIds !== undefined && (!Array.isArray(value.entryIds) || value.entryIds.some((id) => typeof id !== 'string')))) return null;
  return immutableCopy({ code: value.code, category, detail: value.detail,
    ...(value.factIds !== undefined ? { factIds: value.factIds as string[] } : {}),
    ...(value.entryIds !== undefined ? { entryIds: value.entryIds as string[] } : {}) }) as AiCoreV3Violation;
}

function parseSummaryV3EvaluatorObject(value: unknown, manifest: SummaryV3Manifest): EvaluatorPayload | null {
  if (!isRecord(value) || !exactKeys(value, ['operationId', 'snapshotHash', 'locale', 'phases', 'checks'])
    || value.operationId !== manifest.operationId || value.snapshotHash !== manifest.sourceSnapshotHash
    || value.locale !== manifest.targetLocale || !isRecord(value.phases) || !isRecord(value.checks)
    || !exactKeys(value.phases, ['semantic', 'language_quality'])) return null;
  const checks = value.checks;
  if (!exactKeys(checks, SUMMARY_EVALUATOR_CHECKS)
    || SUMMARY_EVALUATOR_CHECKS.some((check) => typeof checks[check] !== 'boolean')) return null;
  const parsePhase = (input: unknown, category: EvaluatedCategory) => {
    if (!isRecord(input) || !exactKeys(input, ['status', 'violations']) || !Array.isArray(input.violations)
      || (input.status !== 'passed' && input.status !== 'failed')) return null;
    const violations = input.violations.map((item) => parseViolation(item, category));
    if (violations.some((item) => item === null) || (input.status === 'passed' ? violations.length !== 0 : violations.length === 0)) return null;
    return { status: input.status, violations: violations as AiCoreV3Violation[] };
  };
  const semantic = parsePhase(value.phases.semantic, 'semantic');
  const languageQuality = parsePhase(value.phases.language_quality, 'language_quality');
  if (!semantic || !languageQuality) return null;
  const phasesPassed = semantic.status === 'passed' && languageQuality.status === 'passed';
  const checksPassed = SUMMARY_EVALUATOR_CHECKS.every((check) => checks[check] === true);
  if (phasesPassed !== checksPassed) return null;
  return immutableCopy({ operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash,
    locale: manifest.targetLocale, phases: { semantic, language_quality: languageQuality },
    checks }) as unknown as EvaluatorPayload;
}

export function parseSummaryV3EvaluatorOutput(value: unknown, manifest: SummaryV3Manifest): EvaluatorPayload | null {
  return parseSummaryV3EvaluatorObject(value, manifest);
}

export type SummaryV3EvaluatorToolParseResult =
  | { readonly ok: true; readonly value: EvaluatorPayload; readonly diagnosticMetadata: SummaryV3DiagnosticAttempt }
  | { readonly ok: false; readonly typedReason: string; readonly diagnosticMetadata: SummaryV3DiagnosticAttempt };

export function parseSummaryV3EvaluatorToolResponse(
  response: SummaryV3EvaluatorResponse,
  manifest: SummaryV3Manifest,
): SummaryV3EvaluatorToolParseResult {
  const base = responseTransportAttempt(response, SUMMARY_V3_EVALUATOR_TOOL_NAME, 'unknown');
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) {
    return { ok: false, typedReason: 'evaluator_output_malformed', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  if (response.stopReason === 'max_tokens') {
    return { ok: false, typedReason: 'evaluator_max_tokens', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  if (response.stopReason !== 'tool_use') {
    return { ok: false, typedReason: 'evaluator_output_malformed', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  const unexpected = response.content.find((block) => block.type !== 'tool_use');
  if (unexpected?.type === 'text') {
    return { ok: false, typedReason: 'evaluator_unexpected_text_block', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  if (unexpected) {
    return { ok: false, typedReason: 'evaluator_output_malformed', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  const tools = response.content.filter((block): block is Extract<SummaryV3ContentBlock, { type: 'tool_use' }> => (
    block.type === 'tool_use'
  ));
  if (tools.length === 0) return { ok: false, typedReason: 'evaluator_tool_missing', diagnosticMetadata: { ...base, result: 'malformed' } };
  if (tools.length !== 1) return { ok: false, typedReason: 'evaluator_multiple_tools', diagnosticMetadata: { ...base, result: 'malformed' } };
  const [tool] = tools;
  if (tool.name !== SUMMARY_V3_EVALUATOR_TOOL_NAME) {
    return { ok: false, typedReason: 'evaluator_wrong_tool', diagnosticMetadata: { ...base, result: 'malformed' } };
  }
  const inputMetadata = { ...base, toolInputObject: isRecord(tool.input) };
  if (!isRecord(tool.input)) {
    return { ok: false, typedReason: 'evaluator_tool_input_malformed', diagnosticMetadata: { ...inputMetadata, result: 'malformed', toolInputSchemaPassed: false } };
  }
  if (!exactKeys(tool.input, ['operationId', 'snapshotHash', 'locale', 'phases', 'checks'])) {
    return { ok: false, typedReason: 'evaluator_tool_input_malformed', diagnosticMetadata: { ...inputMetadata, result: 'malformed', toolInputSchemaPassed: false } };
  }
  if (tool.input.operationId !== manifest.operationId || tool.input.snapshotHash !== manifest.sourceSnapshotHash
    || tool.input.locale !== manifest.targetLocale) {
    return { ok: false, typedReason: 'evaluator_identity_mismatch', diagnosticMetadata: {
      ...inputMetadata, result: 'malformed', toolInputSchemaPassed: true, identityPassed: false,
    } };
  }
  const value = parseSummaryV3EvaluatorObject(tool.input, manifest);
  if (!value) {
    return { ok: false, typedReason: 'evaluator_tool_input_malformed', diagnosticMetadata: {
      ...inputMetadata, result: 'malformed', toolInputSchemaPassed: false, identityPassed: true,
    } };
  }
  return { ok: true, value, diagnosticMetadata: updateTransportAttempt(response, SUMMARY_V3_EVALUATOR_TOOL_NAME, 'succeeded', true, true) };
}

function aggregate(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope,
  structural: ValidationPhaseResult, evaluator: EvaluatorPayload): AggregateValidationResult {
  return runAiCoreV3Validation({ manifest, candidate }, {
    structural: () => structural,
    semantic: () => ({ category: 'semantic', ...evaluator.phases.semantic }),
    languageQuality: () => ({ category: 'language_quality', ...evaluator.phases.language_quality }),
  });
}

export function buildSummaryV3WriterPrompt(manifest: SummaryV3Manifest): string {
  return [
    'Write one grounded professional first-person CV Summary in the requested locale and script.',
    `Invoke only the ${SUMMARY_V3_WRITER_TOOL_NAME} tool. Do not emit text, Markdown, code fences, commentary, explanations, headings, or reasoning.`,
    'The tool input has exactly operationId, snapshotHash, locale, and units.',
    'Return exactly one duration unit followed by one experience unit per selected entry in manifest order.',
    'Each unit has exactly slot, entryId, factIds, and text. Preserve owning entry and every factId exactly once.',
    'Use exactly one total-career duration representation. Keep current and prior roles separate and use correct current/past state.',
    'Do not invent facts, metrics, achievements, tools, certifications, leadership, education, skills, languages, employers, roles, or dates.',
    'No headings, bullets, markdown, commentary, diagnostics, authority fields, or mutation instructions.',
    JSON.stringify(manifest),
  ].join('\n');
}

export function buildSummaryV3EvaluatorPrompt(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope): string {
  return [
    'Act only as an independent non-writing evaluator. Never rewrite, repair, suggest prose, or return authority.',
    'Evaluate entry/fact retention and ownership, current/prior separation, role/employer/state accuracy, unsupported claims, and duration meaning/scope.',
    'Evaluate target language/script, first-person perspective, current/past tense, grammar, clarity, duplication, degradation, and complete usability.',
    `Invoke only the ${SUMMARY_V3_EVALUATOR_TOOL_NAME} tool. Do not emit text, Markdown, code fences, commentary, explanations, headings, or reasoning.`,
    'The tool input has exactly operationId, snapshotHash, locale, phases, and checks.',
    'phases has exactly semantic and language_quality. Each has status passed or failed and violations only.',
    `checks has exactly these boolean evidence fields: ${SUMMARY_EVALUATOR_CHECKS.join(', ')}. All must be true only when both phases pass.`,
    'Do not return candidate text, units, replacement prose, apply, persistence, usage, or acceptance authority.',
    JSON.stringify({ manifest, candidate }),
  ].join('\n');
}

export function buildSummaryV3RepairPrompt(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope,
  violations: readonly AiCoreV3Violation[]): string {
  return [
    'Repair the candidate once using only the unchanged manifest and finite violations. Add no facts.',
    `Invoke only the ${SUMMARY_V3_WRITER_TOOL_NAME} tool with the identical strict writer schema and identities. Do not emit text, Markdown, code fences, commentary, diagnostics, authority, or fallback prose.`,
    JSON.stringify({ operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash,
      locale: manifest.targetLocale, manifest, candidate, violations }),
  ].join('\n');
}

type EvaluateCandidateResult =
  | { readonly ok: true; readonly candidate: AiCoreV3CandidateEnvelope; readonly validation: AggregateValidationResult; readonly evaluatorMetadata: SummaryV3DiagnosticAttempt }
  | { readonly ok: false; readonly typedReason: string; readonly evaluatorMetadata: SummaryV3DiagnosticAttempt; readonly m4ProviderFailure?: SummaryV3ProviderFailureEnvelope | null };

async function evaluateCandidate(manifest: SummaryV3Manifest, output: SummaryV3WriterOutput,
  transports: SummaryV3GenerateTransportSet,
  phase: Extract<SummaryV3ProviderPhase, 'initial_evaluator' | 'post_repair_evaluator'> = 'initial_evaluator',
): Promise<EvaluateCandidateResult> {
  const candidate = candidateFromOutput(manifest, output);
  const structural = structuralPhase(manifest, candidate, output);
  if (structural.status !== 'passed') {
    return { ok: false, typedReason: 'structural_validation_failed', evaluatorMetadata: emptyTransportAttempt(false, 'not_attempted') };
  }
  let prompt: string;
  try {
    prompt = buildSummaryV3EvaluatorPrompt(manifest, candidate);
  } catch (error) {
    return { ok: false, typedReason: 'validator_exception', evaluatorMetadata: emptyTransportAttempt(false, 'not_attempted'),
      m4ProviderFailure: classifySummaryV3ProviderFailure(error, phase, 'request_construction') };
  }
  let response: SummaryV3EvaluatorResponse;
  try {
    response = await transports.evaluate(prompt, phase);
  } catch (error) {
    return { ok: false, typedReason: 'validator_exception', evaluatorMetadata: emptyTransportAttempt(true, 'failed'),
      m4ProviderFailure: classifySummaryV3ProviderFailure(error, phase, 'sdk_request') };
  }
  const evaluator = parseSummaryV3EvaluatorToolResponse(response, manifest);
  if (!evaluator.ok) return { ok: false, typedReason: evaluator.typedReason, evaluatorMetadata: evaluator.diagnosticMetadata,
    m4ProviderFailure: toolValidationFailure(phase, evaluator.typedReason) };
  return { ok: true, candidate, validation: aggregate(manifest, candidate, structural, evaluator.value), evaluatorMetadata: evaluator.diagnosticMetadata };
}

export async function executeSummaryV3GenerateServer(
  rawRequest: unknown,
  transports: SummaryV3GenerateTransportSet,
): Promise<SummaryV3GenerateResponse> {
  const manifest = parseSummaryV3GenerateRequest(rawRequest);
  if (!manifest) return failure('invalid_request_contract', undefined, false);
  let transportEvidence = unavailableTransportEvidence();
  let primaryResponse: SummaryV3WriterResponse;
  let primaryPrompt: string;
  try {
    primaryPrompt = buildSummaryV3WriterPrompt(manifest);
  } catch (error) {
    return failure('provider_request_failed', undefined, false, undefined, failedTransportEvidence(transportEvidence, 'writer'),
      classifySummaryV3ProviderFailure(error, 'initial_writer', 'request_construction'));
  }
  try {
    primaryResponse = await transports.write(primaryPrompt, 'initial_writer');
  } catch (error) {
    return failure('provider_request_failed', undefined, false, undefined, failedTransportEvidence(transportEvidence, 'writer'),
      classifySummaryV3ProviderFailure(error, 'initial_writer', 'sdk_request'));
  }
  const primaryOutput = parseSummaryV3WriterToolResponse(primaryResponse, manifest);
  transportEvidence = { ...transportEvidence, writer: primaryOutput.diagnosticMetadata };
  if (!primaryOutput.ok) return failure(primaryOutput.typedReason, undefined, false, undefined, transportEvidence,
    toolValidationFailure('initial_writer', primaryOutput.typedReason, primaryOutput.toolValidation));
  const primary = await evaluateCandidate(manifest, primaryOutput.value, transports);
  transportEvidence = { ...transportEvidence, evaluator: primary.evaluatorMetadata };
  if (!primary.ok) return failure(primary.typedReason, undefined, false, undefined, transportEvidence, primary.m4ProviderFailure);
  if (primary.validation.decision === 'accept') {
    return immutableCopy({ ok: true as const, action: SUMMARY_V3_GENERATE_ACTION,
      providerOutput: primaryOutput.value, candidate: primary.candidate, validation: primary.validation,
      repairAttempted: false, transportEvidence }) as SummaryV3GenerateResponse;
  }
  const violations = primary.validation.violations;
  if (violations.length === 0) return failure('validation_rejected', primary.validation, false, primary.candidate, transportEvidence);
  let repairResponse: SummaryV3WriterResponse;
  let repairPrompt: string;
  try {
    repairPrompt = buildSummaryV3RepairPrompt(manifest, primary.candidate, violations);
  } catch (error) {
    return failure('repair_provider_failed', primary.validation, true, primary.candidate, failedTransportEvidence(transportEvidence, 'writer'),
      classifySummaryV3ProviderFailure(error, 'repair_writer', 'request_construction'));
  }
  try {
    repairResponse = await transports.write(repairPrompt, 'repair_writer');
  } catch (error) {
    return failure('repair_provider_failed', primary.validation, true, primary.candidate, failedTransportEvidence(transportEvidence, 'writer'),
      classifySummaryV3ProviderFailure(error, 'repair_writer', 'sdk_request'));
  }
  const repairOutput = parseSummaryV3WriterToolResponse(repairResponse, manifest);
  transportEvidence = { ...transportEvidence, writer: repairOutput.diagnosticMetadata };
  if (!repairOutput.ok) return failure('repair_output_malformed', primary.validation, true, primary.candidate, transportEvidence,
    toolValidationFailure('repair_writer', repairOutput.typedReason, repairOutput.toolValidation));
  const repair = await evaluateCandidate(manifest, repairOutput.value, transports, 'post_repair_evaluator');
  transportEvidence = { ...transportEvidence, evaluator: repair.evaluatorMetadata };
  if (!repair.ok) return failure(`repair_${repair.typedReason}`, primary.validation, true, primary.candidate, transportEvidence, repair.m4ProviderFailure);
  if (repair.validation.decision !== 'accept') return failure('repair_validation_rejected', repair.validation, true, repair.candidate, transportEvidence);
  return immutableCopy({ ok: true as const, action: SUMMARY_V3_GENERATE_ACTION,
    providerOutput: repairOutput.value, candidate: repair.candidate, validation: repair.validation,
    repairAttempted: true, transportEvidence }) as SummaryV3GenerateResponse;
}
