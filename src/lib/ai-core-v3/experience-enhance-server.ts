import { createCandidateEnvelope } from './candidate-envelope';
import type Anthropic from '@anthropic-ai/sdk';
import type { AiCoreV3CandidateEnvelope, ExperienceFactManifest } from './contracts';
import { createExperienceFactManifest } from './experience-manifest';
import {
  EXPERIENCE_V3_ENHANCE_ACTION,
  EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS,
  hashExperienceV3EnhanceValue,
  type ExperienceV3EnhanceMaterialityEvidence,
  type ExperienceV3EnhanceMaterialityKind,
  type ExperienceV3EnhanceProviderOutput,
  type ExperienceV3EnhanceResponse,
} from './experience-enhance';
import { immutableCopy } from './immutability';
import { INTERNAL_AI_RESET_ENABLED } from '../build-channel';
import {
  unavailableExperienceV3DiagnosticEvidence,
  type ExperienceV3ProviderErrorClass,
  type ExperienceV3ProviderErrorType,
  type ExperienceV3ProviderFailureEvidence,
  type ExperienceV3ProviderFailureStage,
  type ExperienceV3DiagnosticEvidence,
  type ExperienceV3InternalRejectionAudit,
} from './experience-generate';
import {
  runAiCoreV3Validation,
  validateStructuralPhase,
  type AggregateValidationResult,
  type AiCoreV3Violation,
  type ValidationPhaseResult,
} from './validators';

export interface ExperienceV3EnhanceTransportSet {
  readonly generate: (prompt: string) => Promise<ExperienceV3EnhanceWriterResponse>;
  readonly evaluate: (prompt: string) => Promise<ExperienceV3EnhanceEvaluatorResponse>;
}

const SAFE_PROVIDER_ERROR_CODES = new Set([
  'invalid_request', 'invalid_request_error', 'invalid_param', 'invalid_api_key',
  'authentication_error', 'permission_denied', 'permission_error', 'rate_limit',
  'rate_limit_error', 'overloaded', 'overloaded_error', 'internal_server_error',
  'model_not_found', 'billing_error', 'quota_exceeded', 'timeout', 'connection_error',
]);

function safeProviderErrorCode(value: unknown): string | null {
  return typeof value === 'string'
    && /^[a-z][a-z0-9_.-]{0,63}$/u.test(value)
    && SAFE_PROVIDER_ERROR_CODES.has(value)
    ? value
    : null;
}

function providerErrorClass(error: unknown): ExperienceV3ProviderErrorClass | null {
  const className = error && typeof error === 'object' && error.constructor && typeof error.constructor === 'function'
    ? error.constructor.name
    : error instanceof Error ? 'Error' : null;
  if (className === 'APIConnectionTimeoutError') return 'APIConnectionTimeoutError';
  if (className === 'APIUserAbortError') return 'APIUserAbortError';
  if (className === 'APIConnectionError') return 'APIConnectionError';
  if (className === 'BadRequestError') return 'BadRequestError';
  if (className === 'AuthenticationError') return 'AuthenticationError';
  if (className === 'PermissionDeniedError') return 'PermissionDeniedError';
  if (className === 'RateLimitError') return 'RateLimitError';
  if (className === 'InternalServerError') return 'InternalServerError';
  if (className === 'APIError') return 'APIError';
  if (className === 'Error') return 'Error';
  return null;
}

function providerStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as Record<string, unknown>).status;
  return Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599
    ? Number(status)
    : null;
}

function errorClassName(error: unknown): string | null {
  return error && typeof error === 'object' && error.constructor && typeof error.constructor === 'function'
    ? error.constructor.name
    : error instanceof Error ? 'Error' : null;
}

function isDeadlineOrAbortError(error: unknown): boolean {
  if (error instanceof Error && (error.name === 'AbortError'
    || error.name === 'APIUserAbortError'
    || error.name === 'APIConnectionTimeoutError')) return true;
  if (!error || typeof error !== 'object') return false;
  const owner = (error as Record<string, unknown>).deadlineOwner;
  return owner === 'provider_transport' || owner === 'verifier_transport'
    || owner === 'route_deadline' || owner === 'client_abort';
}

function providerType(
  error: unknown,
  status: number | null,
  stage: ExperienceV3ProviderFailureStage,
): ExperienceV3ProviderErrorType {
  if (stage === 'response_extraction') return 'response_extraction';
  if (status === 400) return 'invalid_request';
  if (status === 401) return 'authentication';
  if (status === 403) return 'permission';
  if (status === 429) return 'rate_limit';
  if (status !== null && status >= 500) return 'provider_5xx';
  if (isDeadlineOrAbortError(error)
    || errorClassName(error) === 'APIConnectionTimeoutError' || errorClassName(error) === 'APIUserAbortError') return 'timeout';
  if (errorClassName(error) === 'APIConnectionError') return 'connection/network';
  return 'unknown';
}

function derivedFailureStage(error: unknown, status: number | null): ExperienceV3ProviderFailureStage {
  if (status !== null) return 'provider_response';
  if (isDeadlineOrAbortError(error)) return 'sdk_request';
  if (errorClassName(error) === 'APIConnectionError'
    || errorClassName(error) === 'APIConnectionTimeoutError'
    || errorClassName(error) === 'APIUserAbortError') return 'sdk_request';
  return 'unknown';
}

function retryableForType(type: ExperienceV3ProviderErrorType): boolean | null {
  if (type === 'rate_limit' || type === 'provider_5xx' || type === 'connection/network') return true;
  if (type === 'invalid_request' || type === 'authentication' || type === 'permission'
    || type === 'timeout' || type === 'response_extraction') return false;
  return null;
}

function structuralPath(value: string | null | undefined): string | null {
  return typeof value === 'string' && /^[a-z][a-z0-9_.-]{0,127}$/u.test(value) ? value : null;
}

/** Build finite, non-PII provider-failure metadata without changing failure control flow. */
export function classifyExperienceV3EnhanceProviderFailure(
  error: unknown,
  stage?: ExperienceV3ProviderFailureStage,
  fieldPath?: string | null,
): ExperienceV3ProviderFailureEvidence {
  const status = providerStatus(error);
  const resolvedStage = stage ?? derivedFailureStage(error, status);
  const type = providerType(error, status, resolvedStage);
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : null;
  const providerBody = record?.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : null;
  const rawRequestId = record?.requestID;
  const message = error instanceof Error && error.message.trim() ? error.message : null;
  return {
    providerFailureStage: resolvedStage,
    providerErrorClass: providerErrorClass(error),
    providerHttpStatus: status,
    providerErrorType: type === 'unknown' ? null : type,
    providerErrorCode: safeProviderErrorCode(providerBody?.code),
    providerRequestIdHash: typeof rawRequestId === 'string' && rawRequestId.length > 0
      ? hashExperienceV3EnhanceValue(rawRequestId)
      : null,
    providerRetryable: retryableForType(type),
    providerMessageFingerprint: message ? hashExperienceV3EnhanceValue(message) : null,
    providerStructuralFieldPath: structuralPath(fieldPath),
  };
}

/** Backward-compatible writer name; the evidence fields are provider-generic. */
export const classifyExperienceV3EnhanceWriterFailure = classifyExperienceV3EnhanceProviderFailure;

/** Transport wrapper carrying only pre-sanitized provider failure evidence. */
export class ExperienceV3EnhanceProviderTransportError extends Error {
  readonly evidence: ExperienceV3ProviderFailureEvidence;

  constructor(evidence: ExperienceV3ProviderFailureEvidence) {
    super('M3 provider transport failure');
    this.name = 'ExperienceV3EnhanceProviderTransportError';
    this.evidence = immutableCopy(evidence);
  }
}

/** Writer-specific subtype retained for existing callers and tests. */
export class ExperienceV3EnhanceWriterTransportError extends ExperienceV3EnhanceProviderTransportError {
  constructor(evidence: ExperienceV3ProviderFailureEvidence) {
    super(evidence);
    this.name = 'ExperienceV3EnhanceWriterTransportError';
  }
}

export function createExperienceV3EnhanceProviderTransportError(
  error: unknown,
  stage?: ExperienceV3ProviderFailureStage,
  fieldPath?: string | null,
): ExperienceV3EnhanceProviderTransportError {
  return new ExperienceV3EnhanceProviderTransportError(classifyExperienceV3EnhanceProviderFailure(error, stage, fieldPath));
}

export function createExperienceV3EnhanceWriterTransportError(
  error: unknown,
  stage?: ExperienceV3ProviderFailureStage,
  fieldPath?: string | null,
): ExperienceV3EnhanceWriterTransportError {
  return new ExperienceV3EnhanceWriterTransportError(classifyExperienceV3EnhanceProviderFailure(error, stage, fieldPath));
}

export const EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME = 'submit_experience_enhancement' as const;
export const EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME = 'submit_experience_enhancement_validation' as const;

function enhancementUnitSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['factId', 'text'],
    properties: {
      factId: { type: 'string' },
      text: { type: 'string' },
    },
  } as const;
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

export const EXPERIENCE_V3_ENHANCE_WRITER_TOOL: Anthropic.Tool = {
  name: EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME,
  description: 'Submit only the fact-locked Experience enhancement units. This tool cannot authorize validation, apply, persistence, usage, or repair.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['operationId', 'entryId', 'snapshotHash', 'locale', 'units'],
    properties: {
      operationId: { type: 'string' },
      entryId: { type: 'string' },
      snapshotHash: { type: 'string' },
      locale: { type: 'string' },
      units: { type: 'array', items: enhancementUnitSchema() },
    },
  },
};

export const EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL: Anthropic.Tool = {
  name: EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME,
  description: 'Submit only independent Experience enhancement validation evidence. This tool cannot rewrite or authorize apply, persistence, usage, or repair.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['operationId', 'entryId', 'snapshotHash', 'locale', 'phases', 'materiality'],
    properties: {
      operationId: { type: 'string' },
      entryId: { type: 'string' },
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
      materiality: {
        type: 'object',
        additionalProperties: false,
        required: ['status', 'kind', 'sourceEquivalent', 'degradationDetected'],
        properties: {
          status: { type: 'string', enum: ['material', 'no_op', 'degraded'] },
          kind: { anyOf: [{ type: 'string', enum: [...EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS] }, { type: 'null' }] },
          sourceEquivalent: { type: 'boolean' },
          degradationDetected: { type: 'boolean' },
        },
      },
    },
  },
};

export type ExperienceV3EnhanceContentBlock =
  | { readonly type: 'tool_use'; readonly name: string; readonly input: unknown }
  | { readonly type: string; readonly text?: string };

export interface ExperienceV3EnhanceWriterResponse {
  readonly stopReason: string | null;
  readonly content: readonly ExperienceV3EnhanceContentBlock[];
}

export interface ExperienceV3EnhanceEvaluatorResponse {
  readonly stopReason: string | null;
  readonly content: readonly ExperienceV3EnhanceContentBlock[];
}

type EvaluatedCategory = 'semantic' | 'language_quality';
type EvaluatorPhasePayload = {
  readonly status: 'passed' | 'failed';
  readonly violations: readonly AiCoreV3Violation[];
};
type EvaluatorMaterialityPayload = {
  readonly status: 'material' | 'no_op' | 'degraded';
  readonly kind: ExperienceV3EnhanceMaterialityKind | null;
  readonly sourceEquivalent: boolean;
  readonly degradationDetected: boolean;
};
type EvaluatorPayload = {
  readonly operationId: string;
  readonly entryId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly phases: {
    readonly semantic: EvaluatorPhasePayload;
    readonly language_quality: EvaluatorPhasePayload;
  };
  readonly materiality: EvaluatorMaterialityPayload;
};

export type ExperienceV3EnhanceWriterDiagnosticMetadata = {
  readonly writerStopReason: string | null;
  readonly writerContentBlockCount: number | null;
  readonly writerTextBlockCount: number | null;
  readonly writerToolBlockCount: number | null;
  readonly writerExpectedToolCount: number | null;
  readonly writerToolNameMatched: boolean | null;
  readonly writerToolInputObject: boolean | null;
  readonly writerToolInputSchemaPassed: boolean | null;
  readonly writerIdentityPassed: boolean | null;
};

export type ExperienceV3EnhanceEvaluatorDiagnosticMetadata = {
  readonly evaluatorStopReason: string | null;
  readonly evaluatorContentBlockCount: number | null;
  readonly evaluatorTextBlockCount: number | null;
  readonly evaluatorToolBlockCount: number | null;
  readonly evaluatorExpectedToolCount: number | null;
  readonly evaluatorToolNameMatched: boolean | null;
  readonly evaluatorToolInputObject: boolean | null;
  readonly evaluatorToolInputSchemaPassed: boolean | null;
  readonly evaluatorIdentityPassed: boolean | null;
};

type WriterToolRejectionReason =
  | 'writer_max_tokens'
  | 'writer_tool_missing'
  | 'writer_multiple_tools'
  | 'writer_wrong_tool'
  | 'writer_unexpected_text_block'
  | 'writer_tool_input_malformed'
  | 'writer_identity_mismatch'
  | 'provider_output_malformed';

type EvaluatorToolRejectionReason =
  | 'evaluator_max_tokens'
  | 'evaluator_tool_missing'
  | 'evaluator_multiple_tools'
  | 'evaluator_wrong_tool'
  | 'evaluator_unexpected_text_block'
  | 'evaluator_tool_input_malformed'
  | 'evaluator_identity_mismatch'
  | 'evaluator_output_malformed';

export type ExperienceV3EnhanceWriterToolParseResult =
  | { readonly ok: true; readonly value: ExperienceV3EnhanceProviderOutput; readonly diagnosticMetadata: ExperienceV3EnhanceWriterDiagnosticMetadata }
  | { readonly ok: false; readonly typedReason: WriterToolRejectionReason; readonly diagnosticMetadata: ExperienceV3EnhanceWriterDiagnosticMetadata };

export type ExperienceV3EnhanceEvaluatorToolParseResult =
  | { readonly ok: true; readonly value: EvaluatorPayload; readonly diagnosticMetadata: ExperienceV3EnhanceEvaluatorDiagnosticMetadata }
  | { readonly ok: false; readonly typedReason: EvaluatorToolRejectionReason; readonly diagnosticMetadata: ExperienceV3EnhanceEvaluatorDiagnosticMetadata };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.has(key));
}

function failure(
  typedReason: string,
  validation?: AggregateValidationResult,
  diagnosticEvidence: ExperienceV3DiagnosticEvidence = unavailableExperienceV3DiagnosticEvidence(),
  internalRejectionAudit?: ExperienceV3InternalRejectionAudit,
): ExperienceV3EnhanceResponse {
  return immutableCopy({
    ok: false as const,
    action: EXPERIENCE_V3_ENHANCE_ACTION,
    typedReason,
    ...(validation ? { validation } : {}),
    diagnosticEvidence,
    ...(internalRejectionAudit ? { internalRejectionAudit } : {}),
  }) as ExperienceV3EnhanceResponse;
}

function diagnosticEvidence(
  candidate: AiCoreV3CandidateEnvelope | null,
  validation?: AggregateValidationResult,
  writer: ExperienceV3EnhanceWriterDiagnosticMetadata = unavailableEnhanceWriterMetadata(),
  evaluator: ExperienceV3EnhanceEvaluatorDiagnosticMetadata = unavailableEnhanceEvaluatorMetadata(),
  writerFailure?: ExperienceV3ProviderFailureEvidence,
): ExperienceV3DiagnosticEvidence {
  const semantic = validation?.phases.semantic?.violations ?? [];
  const language = validation?.phases.language_quality?.violations ?? [];
  const hashIds = (items: readonly AiCoreV3Violation[], key: 'factIds' | 'entryIds') => Object.fromEntries(
    items.map((item) => [item.code, (item[key] ?? []).map(hashExperienceV3EnhanceValue)]),
  );
  const units = candidate?.units ?? [];
  return immutableCopy({
    candidatePresent: candidate !== null,
    candidateHash: candidate ? hashExperienceV3EnhanceValue(candidate.text) : null,
    candidateUnitCount: candidate ? units.length : null,
    candidateUnitHashes: candidate ? units.map((unit) => hashExperienceV3EnhanceValue(unit.text)) : [],
    candidateUnitLengths: candidate ? units.map((unit) => unit.text.length) : [],
    ...writer,
    ...evaluator,
    ...(writerFailure ?? {}),
    semanticViolationCount: validation ? semantic.length : null,
    semanticViolationCodes: semantic.map((item) => item.code),
    languageQualityViolationCount: validation ? language.length : null,
    languageQualityViolationCodes: language.map((item) => item.code),
    violationFactIdHashesByCode: hashIds([...semantic, ...language], 'factIds'),
    violationEntryIdHashesByCode: hashIds([...semantic, ...language], 'entryIds'),
    primaryValidationRejectionCode: semantic[0]?.code ?? language[0]?.code ?? null,
  }) as ExperienceV3DiagnosticEvidence;
}

function internalRejectionAudit(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
  validation?: AggregateValidationResult,
): ExperienceV3InternalRejectionAudit | undefined {
  if (!INTERNAL_AI_RESET_ENABLED) return undefined;
  return immutableCopy({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    sourceUnits: manifest.facts.map((fact) => fact.text),
    candidate: {
      candidateId: candidate.candidateId,
      units: (candidate.units ?? []).map((unit) => ({ unitId: unit.unitId, entryId: unit.entryId, text: unit.text })),
    },
    phases: {
      structural: validation?.phases.structural?.status ?? 'not_evaluated',
      semantic: validation?.phases.semantic?.status ?? 'not_evaluated',
      language_quality: validation?.phases.language_quality?.status ?? 'not_evaluated',
    },
    evaluator: {
      evaluatorStopReason: null,
      evaluatorContentBlockCount: null,
      evaluatorTextBlockCount: null,
      evaluatorToolBlockCount: null,
      evaluatorExpectedToolCount: null,
      evaluatorToolNameMatched: null,
      evaluatorToolInputObject: null,
      evaluatorToolInputSchemaPassed: null,
      evaluatorIdentityPassed: null,
      semanticViolations: validation?.phases.semantic?.violations ?? [],
      languageQualityViolations: validation?.phases.language_quality?.violations ?? [],
    },
  }) as ExperienceV3InternalRejectionAudit;
}

function parseDate(value: unknown): { readonly year: number; readonly month?: number; readonly day?: number } | null {
  if (!isRecord(value) || !exactKeys(value, ['year'], ['month', 'day']) || !Number.isInteger(value.year)) return null;
  if (value.month !== undefined && (!Number.isInteger(value.month) || Number(value.month) < 1 || Number(value.month) > 12)) return null;
  if (value.day !== undefined && (!Number.isInteger(value.day) || Number(value.day) < 1 || Number(value.day) > 31)) return null;
  return {
    year: Number(value.year),
    ...(value.month !== undefined ? { month: Number(value.month) } : {}),
    ...(value.day !== undefined ? { day: Number(value.day) } : {}),
  };
}

export function parseExperienceV3EnhanceRequest(value: unknown): ExperienceFactManifest | null {
  if (!isRecord(value) || !exactKeys(value, ['manifest'])) return null;
  const manifest = value.manifest;
  if (!isRecord(manifest) || !exactKeys(manifest, [
    'operationId', 'operationKind', 'mode', 'entryId', 'locale', 'roleTitle', 'company',
    'employmentState', 'dates', 'exactSourceText', 'facts', 'snapshotHash',
    'sourceLocale', 'targetLocale', 'contextHash',
  ], ['industry', 'level'])) return null;
  if (
    manifest.operationKind !== 'experience_enhance'
    || manifest.mode !== 'enhance'
    || typeof manifest.operationId !== 'string'
    || typeof manifest.entryId !== 'string'
    || typeof manifest.locale !== 'string'
    || typeof manifest.roleTitle !== 'string'
    || typeof manifest.company !== 'string'
    || (manifest.employmentState !== 'present' && manifest.employmentState !== 'completed')
    || typeof manifest.exactSourceText !== 'string'
    || !manifest.exactSourceText.trim()
    || typeof manifest.snapshotHash !== 'string'
    || typeof manifest.sourceLocale !== 'string'
    || typeof manifest.targetLocale !== 'string'
    || typeof manifest.contextHash !== 'string'
    || manifest.sourceLocale !== manifest.locale
    || manifest.targetLocale !== manifest.locale
    || !Array.isArray(manifest.facts)
    || manifest.facts.length === 0
    || !isRecord(manifest.dates)
    || !exactKeys(manifest.dates, ['start', 'end'])
  ) return null;
  const start = parseDate(manifest.dates.start);
  const end = manifest.dates.end === null ? null : parseDate(manifest.dates.end);
  if (!start || (manifest.employmentState === 'present' ? end !== null : !end)) return null;
  const facts = manifest.facts.map((fact) => {
    if (!isRecord(fact) || !exactKeys(fact, ['factId', 'text', 'sourceHash', 'required'])) return null;
    if (typeof fact.factId !== 'string' || !fact.factId.trim()
      || typeof fact.text !== 'string' || !fact.text.trim()
      || typeof fact.sourceHash !== 'string' || !fact.sourceHash.trim()
      || fact.required !== true) return null;
    return { factId: fact.factId, text: fact.text, sourceHash: fact.sourceHash, required: true as const };
  });
  if (facts.some((fact) => fact === null)) return null;
  const factIds = facts.map((fact) => fact!.factId);
  if (new Set(factIds).size !== factIds.length) return null;
  try {
    return createExperienceFactManifest({
      operationId: manifest.operationId,
      mode: 'enhance',
      entryId: manifest.entryId,
      locale: manifest.locale,
      roleTitle: manifest.roleTitle,
      company: manifest.company,
      employmentState: manifest.employmentState,
      dates: { start, end },
      ...(typeof manifest.industry === 'string' ? { industry: manifest.industry } : {}),
      ...(typeof manifest.level === 'string' ? { level: manifest.level } : {}),
      exactSourceText: manifest.exactSourceText,
      facts: facts as NonNullable<(typeof facts)[number]>[],
      snapshotHash: manifest.snapshotHash,
      sourceLocale: manifest.sourceLocale,
      targetLocale: manifest.targetLocale,
      contextHash: manifest.contextHash,
    });
  } catch {
    return null;
  }
}

function unitTextIsStructurallySafe(text: string): boolean {
  const trimmed = text.trim();
  return Boolean(trimmed)
    && !/^#{1,6}\s/u.test(trimmed)
    && !/^(?:here(?:'s| is| are)|enhanced|rewritten|output|explanation|summary)\b/iu.test(trimmed)
    && !/```/u.test(trimmed);
}

function comparableUnit(value: string): string {
  return value.normalize('NFKC')
    .replace(/^\s*(?:[-*•▪◦‣⁃]|\d+[.)])\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase();
}

function unitsHaveNearDuplicate(units: readonly string[]): boolean {
  const normalized = units.map(comparableUnit);
  return new Set(normalized).size !== normalized.length;
}

function parseExperienceV3EnhanceProviderValue(
  value: unknown,
  manifest: ExperienceFactManifest,
): ExperienceV3EnhanceProviderOutput | null {
  if (!isRecord(value) || !exactKeys(value, ['operationId', 'entryId', 'snapshotHash', 'locale', 'units'])) return null;
  if (
    value.operationId !== manifest.operationId
    || value.entryId !== manifest.entryId
    || value.snapshotHash !== manifest.snapshotHash
    || value.locale !== manifest.locale
    || !Array.isArray(value.units)
    || value.units.length !== manifest.facts.length
  ) return null;
  const units = value.units.map((unit, index) => {
    if (!isRecord(unit) || !exactKeys(unit, ['factId', 'text'])) return null;
    if (unit.factId !== manifest.facts[index].factId || typeof unit.text !== 'string' || !unitTextIsStructurallySafe(unit.text)) return null;
    return { factId: unit.factId as string, text: unit.text };
  });
  if (units.some((unit) => unit === null)) return null;
  const typedUnits = units as ExperienceV3EnhanceProviderOutput['units'];
  if (new Set(typedUnits.map((unit) => unit.factId)).size !== typedUnits.length) return null;
  if (unitsHaveNearDuplicate(typedUnits.map((unit) => unit.text))) return null;
  return immutableCopy({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    units: typedUnits,
  }) as ExperienceV3EnhanceProviderOutput;
}

function candidateFromOutput(
  manifest: ExperienceFactManifest,
  output: ExperienceV3EnhanceProviderOutput,
): AiCoreV3CandidateEnvelope {
  const text = output.units.map((unit) => `• ${unit.text}`).join('\n');
  return createCandidateEnvelope({
    operationId: manifest.operationId,
    candidateId: hashExperienceV3EnhanceValue(`${manifest.operationId}:${manifest.snapshotHash}:${text}`),
    operationKind: 'experience_enhance',
    targetLocale: manifest.locale,
    sourceSnapshotHash: manifest.snapshotHash,
    text,
    units: output.units.map((unit, index) => ({
      unitId: `${manifest.entryId}:enhance:${index + 1}`,
      entryId: manifest.entryId,
      factIds: [unit.factId],
      text: unit.text,
    })),
  });
}

function phaseViolation(code: string, detail: string, manifest: ExperienceFactManifest): AiCoreV3Violation {
  return { code, category: 'structural', detail, entryIds: [manifest.entryId] };
}

function validateEnhanceStructure(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
  output: ExperienceV3EnhanceProviderOutput,
): ValidationPhaseResult {
  const base = validateStructuralPhase({ manifest, candidate });
  const violations: AiCoreV3Violation[] = [...base.violations];
  if (output.units.length !== manifest.facts.length || candidate.units?.length !== manifest.facts.length) {
    violations.push(phaseViolation('fact_unit_count_mismatch', 'Every required fact must own exactly one candidate unit', manifest));
  }
  if (output.units.some((unit, index) => unit.factId !== manifest.facts[index]?.factId)) {
    violations.push(phaseViolation('fact_id_coverage_mismatch', 'Candidate fact IDs must exactly preserve source order', manifest));
  }
  if (candidate.units?.some((unit, index) => (
    unit.entryId !== manifest.entryId
    || unit.text !== output.units[index]?.text
    || unit.factIds?.length !== 1
    || unit.factIds[0] !== manifest.facts[index]?.factId
  ))) {
    violations.push(phaseViolation('candidate_unit_mismatch', 'Candidate units changed writer identity or text', manifest));
  }
  return immutableCopy({
    category: 'structural' as const,
    status: violations.length === 0 ? 'passed' as const : 'failed' as const,
    violations,
  }) as ValidationPhaseResult;
}

function parseViolation(value: unknown, category: EvaluatedCategory): AiCoreV3Violation | null {
  if (!isRecord(value) || !exactKeys(value, ['code', 'category', 'detail'], ['factIds', 'entryIds'])) return null;
  if (value.category !== category || typeof value.code !== 'string' || !value.code.trim()
    || typeof value.detail !== 'string' || !value.detail.trim()
    || (value.factIds !== undefined && (!Array.isArray(value.factIds) || value.factIds.some((id) => typeof id !== 'string')))
    || (value.entryIds !== undefined && (!Array.isArray(value.entryIds) || value.entryIds.some((id) => typeof id !== 'string')))) return null;
  return immutableCopy({
    code: value.code,
    category,
    detail: value.detail,
    ...(value.factIds !== undefined ? { factIds: value.factIds as string[] } : {}),
    ...(value.entryIds !== undefined ? { entryIds: value.entryIds as string[] } : {}),
  }) as AiCoreV3Violation;
}

function parseEvaluatorPhase(value: unknown, category: EvaluatedCategory): EvaluatorPhasePayload | null {
  if (!isRecord(value) || !exactKeys(value, ['status', 'violations']) || !Array.isArray(value.violations)) return null;
  if (value.status !== 'passed' && value.status !== 'failed') return null;
  const violations = value.violations.map((item) => parseViolation(item, category));
  if (violations.some((item) => item === null)) return null;
  if ((value.status === 'passed' && violations.length !== 0) || (value.status === 'failed' && violations.length === 0)) return null;
  return immutableCopy({ status: value.status, violations }) as EvaluatorPhasePayload;
}

function parseExperienceV3EnhanceEvaluatorValue(
  value: unknown,
  manifest: ExperienceFactManifest,
): EvaluatorPayload | null {
  if (!isRecord(value) || !exactKeys(value, [
    'operationId', 'entryId', 'snapshotHash', 'locale', 'phases', 'materiality',
  ])) return null;
  if (
    value.operationId !== manifest.operationId
    || value.entryId !== manifest.entryId
    || value.snapshotHash !== manifest.snapshotHash
    || value.locale !== manifest.locale
    || !isRecord(value.phases)
    || !exactKeys(value.phases, ['semantic', 'language_quality'])
    || !isRecord(value.materiality)
    || !exactKeys(value.materiality, ['status', 'kind', 'sourceEquivalent', 'degradationDetected'])
  ) return null;
  const semantic = parseEvaluatorPhase(value.phases.semantic, 'semantic');
  const languageQuality = parseEvaluatorPhase(value.phases.language_quality, 'language_quality');
  if (!semantic || !languageQuality) return null;
  const status = value.materiality.status;
  const kind = value.materiality.kind;
  if ((status !== 'material' && status !== 'no_op' && status !== 'degraded')
    || typeof value.materiality.sourceEquivalent !== 'boolean'
    || typeof value.materiality.degradationDetected !== 'boolean') return null;
  if (status === 'material') {
    if (!EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS.includes(kind as ExperienceV3EnhanceMaterialityKind)
      || value.materiality.sourceEquivalent !== false || value.materiality.degradationDetected !== false) return null;
  } else if (kind !== null) return null;
  if (status === 'degraded' && value.materiality.degradationDetected !== true) return null;
  return immutableCopy({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    phases: { semantic, language_quality: languageQuality },
    materiality: {
      status,
      kind: kind as ExperienceV3EnhanceMaterialityKind | null,
      sourceEquivalent: value.materiality.sourceEquivalent,
      degradationDetected: value.materiality.degradationDetected,
    },
  }) as EvaluatorPayload;
}

function unavailableEnhanceWriterMetadata(): ExperienceV3EnhanceWriterDiagnosticMetadata {
  return immutableCopy({
    writerStopReason: null,
    writerContentBlockCount: null,
    writerTextBlockCount: null,
    writerToolBlockCount: null,
    writerExpectedToolCount: null,
    writerToolNameMatched: null,
    writerToolInputObject: null,
    writerToolInputSchemaPassed: null,
    writerIdentityPassed: null,
  }) as ExperienceV3EnhanceWriterDiagnosticMetadata;
}

function unavailableEnhanceEvaluatorMetadata(): ExperienceV3EnhanceEvaluatorDiagnosticMetadata {
  return immutableCopy({
    evaluatorStopReason: null,
    evaluatorContentBlockCount: null,
    evaluatorTextBlockCount: null,
    evaluatorToolBlockCount: null,
    evaluatorExpectedToolCount: null,
    evaluatorToolNameMatched: null,
    evaluatorToolInputObject: null,
    evaluatorToolInputSchemaPassed: null,
    evaluatorIdentityPassed: null,
  }) as ExperienceV3EnhanceEvaluatorDiagnosticMetadata;
}

function writerMetadata(response: ExperienceV3EnhanceWriterResponse | null | undefined): ExperienceV3EnhanceWriterDiagnosticMetadata {
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) return unavailableEnhanceWriterMetadata();
  const tools = response.content.filter((block): block is Extract<ExperienceV3EnhanceContentBlock, { type: 'tool_use' }> => block.type === 'tool_use');
  const expected = tools.length === 1 ? tools[0] : null;
  return immutableCopy({
    writerStopReason: typeof response.stopReason === 'string' ? response.stopReason : null,
    writerContentBlockCount: response.content.length,
    writerTextBlockCount: response.content.filter((block) => block.type === 'text').length,
    writerToolBlockCount: tools.length,
    writerExpectedToolCount: 1,
    writerToolNameMatched: expected ? expected.name === EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME : null,
    writerToolInputObject: expected ? isRecord(expected.input) : null,
    writerToolInputSchemaPassed: null,
    writerIdentityPassed: null,
  }) as ExperienceV3EnhanceWriterDiagnosticMetadata;
}

function evaluatorMetadata(response: ExperienceV3EnhanceEvaluatorResponse | null | undefined): ExperienceV3EnhanceEvaluatorDiagnosticMetadata {
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) return unavailableEnhanceEvaluatorMetadata();
  const tools = response.content.filter((block): block is Extract<ExperienceV3EnhanceContentBlock, { type: 'tool_use' }> => block.type === 'tool_use');
  const expected = tools.length === 1 ? tools[0] : null;
  return immutableCopy({
    evaluatorStopReason: typeof response.stopReason === 'string' ? response.stopReason : null,
    evaluatorContentBlockCount: response.content.length,
    evaluatorTextBlockCount: response.content.filter((block) => block.type === 'text').length,
    evaluatorToolBlockCount: tools.length,
    evaluatorExpectedToolCount: 1,
    evaluatorToolNameMatched: expected ? expected.name === EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME : null,
    evaluatorToolInputObject: expected ? isRecord(expected.input) : null,
    evaluatorToolInputSchemaPassed: null,
    evaluatorIdentityPassed: null,
  }) as ExperienceV3EnhanceEvaluatorDiagnosticMetadata;
}

function writerReject(
  typedReason: WriterToolRejectionReason,
  diagnosticMetadata: ExperienceV3EnhanceWriterDiagnosticMetadata,
): ExperienceV3EnhanceWriterToolParseResult {
  return immutableCopy({ ok: false as const, typedReason, diagnosticMetadata }) as ExperienceV3EnhanceWriterToolParseResult;
}

function evaluatorReject(
  typedReason: EvaluatorToolRejectionReason,
  diagnosticMetadata: ExperienceV3EnhanceEvaluatorDiagnosticMetadata,
): ExperienceV3EnhanceEvaluatorToolParseResult {
  return immutableCopy({ ok: false as const, typedReason, diagnosticMetadata }) as ExperienceV3EnhanceEvaluatorToolParseResult;
}

export function parseExperienceV3EnhanceWriterToolResponse(
  response: ExperienceV3EnhanceWriterResponse,
  manifest: ExperienceFactManifest,
): ExperienceV3EnhanceWriterToolParseResult {
  const metadata = writerMetadata(response);
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) return writerReject('provider_output_malformed', metadata);
  if (response.stopReason === 'max_tokens') return writerReject('writer_max_tokens', metadata);
  if (response.stopReason !== 'tool_use') return writerReject('provider_output_malformed', metadata);
  const unexpected = response.content.find((block) => block.type !== 'tool_use');
  if (unexpected?.type === 'text') return writerReject('writer_unexpected_text_block', metadata);
  if (unexpected) return writerReject('provider_output_malformed', metadata);
  const tools = response.content.filter((block): block is Extract<ExperienceV3EnhanceContentBlock, { type: 'tool_use' }> => block.type === 'tool_use');
  if (tools.length === 0) return writerReject('writer_tool_missing', metadata);
  if (tools.length !== 1) return writerReject('writer_multiple_tools', metadata);
  const [tool] = tools;
  if (tool.name !== EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME) return writerReject('writer_wrong_tool', metadata);
  const inputMetadata = immutableCopy({ ...metadata, writerToolInputObject: isRecord(tool.input) }) as ExperienceV3EnhanceWriterDiagnosticMetadata;
  if (!isRecord(tool.input) || !exactKeys(tool.input, ['operationId', 'entryId', 'snapshotHash', 'locale', 'units'])) {
    return writerReject('writer_tool_input_malformed', immutableCopy({ ...inputMetadata, writerToolInputSchemaPassed: false }) as ExperienceV3EnhanceWriterDiagnosticMetadata);
  }
  if (tool.input.operationId !== manifest.operationId || tool.input.entryId !== manifest.entryId
    || tool.input.snapshotHash !== manifest.snapshotHash || tool.input.locale !== manifest.locale) {
    return writerReject('writer_identity_mismatch', immutableCopy({ ...inputMetadata, writerToolInputSchemaPassed: true, writerIdentityPassed: false }) as ExperienceV3EnhanceWriterDiagnosticMetadata);
  }
  const value = parseExperienceV3EnhanceProviderValue(tool.input, manifest);
  if (!value) return writerReject('writer_tool_input_malformed', immutableCopy({ ...inputMetadata, writerToolInputSchemaPassed: false, writerIdentityPassed: true }) as ExperienceV3EnhanceWriterDiagnosticMetadata);
  return immutableCopy({
    ok: true as const,
    value,
    diagnosticMetadata: { ...inputMetadata, writerToolInputSchemaPassed: true, writerIdentityPassed: true },
  }) as ExperienceV3EnhanceWriterToolParseResult;
}

export function parseExperienceV3EnhanceEvaluatorToolResponse(
  response: ExperienceV3EnhanceEvaluatorResponse,
  manifest: ExperienceFactManifest,
): ExperienceV3EnhanceEvaluatorToolParseResult {
  const metadata = evaluatorMetadata(response);
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) return evaluatorReject('evaluator_output_malformed', metadata);
  if (response.stopReason === 'max_tokens') return evaluatorReject('evaluator_max_tokens', metadata);
  if (response.stopReason !== 'tool_use') return evaluatorReject('evaluator_output_malformed', metadata);
  const unexpected = response.content.find((block) => block.type !== 'tool_use');
  if (unexpected?.type === 'text') return evaluatorReject('evaluator_unexpected_text_block', metadata);
  if (unexpected) return evaluatorReject('evaluator_output_malformed', metadata);
  const tools = response.content.filter((block): block is Extract<ExperienceV3EnhanceContentBlock, { type: 'tool_use' }> => block.type === 'tool_use');
  if (tools.length === 0) return evaluatorReject('evaluator_tool_missing', metadata);
  if (tools.length !== 1) return evaluatorReject('evaluator_multiple_tools', metadata);
  const [tool] = tools;
  if (tool.name !== EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME) return evaluatorReject('evaluator_wrong_tool', metadata);
  const inputMetadata = immutableCopy({ ...metadata, evaluatorToolInputObject: isRecord(tool.input) }) as ExperienceV3EnhanceEvaluatorDiagnosticMetadata;
  if (!isRecord(tool.input) || !exactKeys(tool.input, ['operationId', 'entryId', 'snapshotHash', 'locale', 'phases', 'materiality'])) {
    return evaluatorReject('evaluator_tool_input_malformed', immutableCopy({ ...inputMetadata, evaluatorToolInputSchemaPassed: false }) as ExperienceV3EnhanceEvaluatorDiagnosticMetadata);
  }
  if (tool.input.operationId !== manifest.operationId || tool.input.entryId !== manifest.entryId
    || tool.input.snapshotHash !== manifest.snapshotHash || tool.input.locale !== manifest.locale) {
    return evaluatorReject('evaluator_identity_mismatch', immutableCopy({ ...inputMetadata, evaluatorToolInputSchemaPassed: true, evaluatorIdentityPassed: false }) as ExperienceV3EnhanceEvaluatorDiagnosticMetadata);
  }
  const value = parseExperienceV3EnhanceEvaluatorValue(tool.input, manifest);
  if (!value) return evaluatorReject('evaluator_tool_input_malformed', immutableCopy({ ...inputMetadata, evaluatorToolInputSchemaPassed: false, evaluatorIdentityPassed: true }) as ExperienceV3EnhanceEvaluatorDiagnosticMetadata);
  return immutableCopy({
    ok: true as const,
    value,
    diagnosticMetadata: { ...inputMetadata, evaluatorToolInputSchemaPassed: true, evaluatorIdentityPassed: true },
  }) as ExperienceV3EnhanceEvaluatorToolParseResult;
}

function aggregate(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
  structural: ValidationPhaseResult,
  semantic: ValidationPhaseResult,
  languageQuality: ValidationPhaseResult,
): AggregateValidationResult {
  return runAiCoreV3Validation({ manifest, candidate }, {
    structural: () => structural,
    semantic: () => semantic,
    languageQuality: () => languageQuality,
  });
}

function comparableSource(value: string): string {
  return value.normalize('NFKC')
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦‣⁃]|\d+[.)])\s*/u, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function materialityIsCosmeticOnly(
  manifest: ExperienceFactManifest,
  output: ExperienceV3EnhanceProviderOutput,
  materiality: EvaluatorMaterialityPayload,
): boolean {
  const source = comparableSource(manifest.exactSourceText);
  const candidate = comparableSource(output.units.map((unit) => unit.text).join('\n'));
  if (source === candidate) return true;
  const punctuationFree = (value: string) => value.replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/gu, ' ').trim();
  if (punctuationFree(source) === punctuationFree(candidate)) return true;
  if (source.toLocaleLowerCase() === candidate.toLocaleLowerCase()) {
    return materiality.kind !== 'grammar_correction';
  }
  return false;
}

export function buildExperienceV3EnhanceWriterPrompt(manifest: ExperienceFactManifest): string {
  const tense = manifest.employmentState === 'present' ? 'current/present CV form' : 'completed/past CV form';
  return [
    'Enhance the exact Experience source without adding, deleting, merging, or moving material facts.',
    `Write only in locale ${manifest.locale} using ${tense}. Preserve professional CV perspective.`,
    'Return exactly one unit for every required factId, in the supplied source order.',
    'Improve only grammar, clarity, safe concision, professional phrasing, tense, or CV perspective.',
    'Never invent metrics, achievements, tools, certifications, leadership, ownership, scope, responsibility, domain expertise, or universal claims.',
    'Do not return headings, commentary, markdown, diagnostics, Summary prose, validation, apply authority, usage authority, or mutation instructions.',
    `Invoke only the ${EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME} tool. Do not emit text, Markdown, code fences, commentary, explanations, headings, or reasoning.`,
    'Its input has exactly operationId, entryId, snapshotHash, locale, and units. Each unit has exactly factId and text.',
    JSON.stringify(manifest),
  ].join('\n');
}

export function buildExperienceV3EnhanceEvaluatorPrompt(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
): string {
  return [
    'Act only as an independent non-writing validator. Never rewrite, repair, or suggest replacement prose.',
    'Check complete fact retention, entry ownership, unsupported claims, escalation, quantifiers, cross-entry leakage, role/company/date mutation, target language/script, grammar, clarity, employment tense, CV perspective, degradation, and material improvement.',
    `Invoke only the ${EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME} tool. Do not emit text, Markdown, code fences, commentary, explanations, headings, or reasoning.`,
    'Its input has exactly operationId, entryId, snapshotHash, locale, phases, and materiality.',
    'phases contains exactly semantic and language_quality; each contains status and structured violations.',
    `materiality status is material, no_op, or degraded. A material result requires exactly one kind from: ${EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS.join(', ')}.`,
    'For no_op or degraded, kind must be null. Include sourceEquivalent and degradationDetected booleans.',
    'Do not return candidate text, corrected units, apply authority, usage authority, persistence authority, or acceptance authority.',
    JSON.stringify({ manifest, candidate }),
  ].join('\n');
}

export async function executeExperienceV3EnhanceServer(
  rawRequest: unknown,
  transports: ExperienceV3EnhanceTransportSet,
): Promise<ExperienceV3EnhanceResponse> {
  const manifest = parseExperienceV3EnhanceRequest(rawRequest);
  if (!manifest) return failure('invalid_request_contract');
  let writerResponse: ExperienceV3EnhanceWriterResponse;
  try {
    writerResponse = await transports.generate(buildExperienceV3EnhanceWriterPrompt(manifest));
  } catch (error) {
    const writerFailure = error instanceof ExperienceV3EnhanceProviderTransportError
      ? error.evidence
      : classifyExperienceV3EnhanceProviderFailure(error);
    return failure(
      'writer_request_failed',
      undefined,
      diagnosticEvidence(null, undefined, unavailableEnhanceWriterMetadata(), unavailableEnhanceEvaluatorMetadata(), writerFailure),
    );
  }
  const writerResult = parseExperienceV3EnhanceWriterToolResponse(writerResponse, manifest);
  if (!writerResult.ok) return failure(
    writerResult.typedReason,
    undefined,
    diagnosticEvidence(null, undefined, writerResult.diagnosticMetadata),
  );
  const providerOutput = writerResult.value;
  const writerDiagnostic = writerResult.diagnosticMetadata;
  const candidate = candidateFromOutput(manifest, providerOutput);
  const structural = validateEnhanceStructure(manifest, candidate, providerOutput);
  if (structural.status !== 'passed') {
    const notEvaluated = (category: EvaluatedCategory): ValidationPhaseResult => ({
      category,
      status: 'not_evaluated',
      violations: [],
    });
    const validation = aggregate(
      manifest,
      candidate,
      structural,
      notEvaluated('semantic'),
      notEvaluated('language_quality'),
    );
    return failure('structural_validation_failed', validation, diagnosticEvidence(candidate, validation, writerDiagnostic), internalRejectionAudit(manifest, candidate, validation));
  }
  let evaluatorResponse: ExperienceV3EnhanceEvaluatorResponse;
  try {
    evaluatorResponse = await transports.evaluate(buildExperienceV3EnhanceEvaluatorPrompt(manifest, candidate));
  } catch (error) {
    return failure(
      'validator_exception',
      undefined,
      diagnosticEvidence(
        candidate,
        undefined,
        writerDiagnostic,
        unavailableEnhanceEvaluatorMetadata(),
        error instanceof ExperienceV3EnhanceProviderTransportError
          ? error.evidence
          : classifyExperienceV3EnhanceProviderFailure(error),
      ),
      internalRejectionAudit(manifest, candidate),
    );
  }
  const evaluatorResult = parseExperienceV3EnhanceEvaluatorToolResponse(evaluatorResponse, manifest);
  if (!evaluatorResult.ok) return failure(
    evaluatorResult.typedReason,
    undefined,
    diagnosticEvidence(candidate, undefined, writerDiagnostic, evaluatorResult.diagnosticMetadata),
    internalRejectionAudit(manifest, candidate),
  );
  const evaluator = evaluatorResult.value;
  const evaluatorDiagnostic = evaluatorResult.diagnosticMetadata;
  const semantic = immutableCopy({ category: 'semantic' as const, ...evaluator.phases.semantic }) as ValidationPhaseResult;
  const languageQuality = immutableCopy({
    category: 'language_quality' as const,
    ...evaluator.phases.language_quality,
  }) as ValidationPhaseResult;
  const validation = aggregate(manifest, candidate, structural, semantic, languageQuality);
  const evidence = diagnosticEvidence(candidate, validation, writerDiagnostic, evaluatorDiagnostic);
  const audit = internalRejectionAudit(manifest, candidate, validation);
  if (validation.decision !== 'accept') return failure('validation_rejected', validation, evidence, audit);
  if (evaluator.materiality.status === 'degraded' || evaluator.materiality.degradationDetected) {
    return failure('materiality_degraded', validation, evidence, audit);
  }
  if (evaluator.materiality.status !== 'material'
    || evaluator.materiality.sourceEquivalent
    || materialityIsCosmeticOnly(manifest, providerOutput, evaluator.materiality)) {
    return failure('no_material_improvement', validation, evidence, audit);
  }
  const materiality = immutableCopy({
    status: 'material' as const,
    kind: evaluator.materiality.kind,
    sourceEquivalent: false as const,
    degradationDetected: false as const,
  }) as ExperienceV3EnhanceMaterialityEvidence;
  return immutableCopy({
    ok: true as const,
    action: EXPERIENCE_V3_ENHANCE_ACTION,
    providerOutput,
    candidate,
    validation,
    materiality,
    diagnosticEvidence: evidence,
  }) as ExperienceV3EnhanceResponse;
}
