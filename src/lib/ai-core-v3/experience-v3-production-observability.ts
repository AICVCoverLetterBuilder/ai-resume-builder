import type {
  ExperienceV3EnhanceFailureResponse,
} from './experience-enhance';
import type {
  ExperienceV3ProviderFailureStage,
  ExperienceV3ProviderErrorType,
} from './experience-generate';
import {
  EXPERIENCE_V3_ENHANCE_VALIDATION_CODES,
  isExperienceV3EnhanceValidationCode,
  isExperienceV3EnhanceValidationCodeForCategory,
} from './experience-enhance-validation-contract';

export const EXPERIENCE_V3_TERMINAL_EVENT_NAME = 'experience_v3_terminal' as const;
export const EXPERIENCE_V3_ENHANCE_OBSERVABILITY_ACTION = 'experience_v3_enhance' as const;

/**
 * Only codes already used by the V3 validator/evaluator contracts may cross
 * the production observability boundary. Provider-supplied detail text and
 * unknown codes are intentionally omitted from the event.
 */
export const EXPERIENCE_V3_STRUCTURAL_VALIDATION_CODE_ALLOWLIST = [
  'invalid_manifest_shape',
  'missing_fact_id',
  'duplicate_fact_id',
  'invalid_employment_state',
  'invalid_dates',
  'missing_entry_id',
  'empty_enhance_source',
  'operation_id_mismatch',
  'snapshot_hash_mismatch',
  'operation_kind_mismatch',
  'target_locale_mismatch',
  'empty_candidate_text',
  'fact_unit_count_mismatch',
  'fact_id_coverage_mismatch',
  'candidate_unit_mismatch',
  'invalid_validator_result',
  'validator_reported_failure',
  'validator_exception',
] as const;

export const EXPERIENCE_V3_VALIDATION_CODE_ALLOWLIST = [
  ...EXPERIENCE_V3_STRUCTURAL_VALIDATION_CODE_ALLOWLIST,
  ...EXPERIENCE_V3_ENHANCE_VALIDATION_CODES,
] as const;

const experienceV3StructuralValidationCodeAllowlist = new Set<string>(
  EXPERIENCE_V3_STRUCTURAL_VALIDATION_CODE_ALLOWLIST,
);

export type ExperienceV3ValidationStage =
  | 'STRUCTURAL_VALIDATION'
  | 'SEMANTIC_GROUNDING_VALIDATION'
  | 'LANGUAGE_VALIDATION'
  | 'MATERIALITY_VALIDATION'
  | 'NO_MATERIAL_IMPROVEMENT'
  | 'OTHER_TYPED_VALIDATION'
  | null;

export type ExperienceV3TerminalPhase =
  | 'request_validation'
  | 'route_gate'
  | 'route_auth'
  | 'route_rate_limit'
  | 'route_configuration'
  | 'initial_writer'
  | 'initial_evaluator'
  | 'validation'
  | 'server_deadline'
  | 'route_exception';

export type ExperienceV3TerminalFailureFamily =
  | 'request_contract'
  | 'feature_gate'
  | 'auth'
  | 'rate_limit'
  | 'configuration'
  | 'provider_transport'
  | 'output_contract'
  | 'validation'
  | 'route_exception';

export type ExperienceV3TimeoutOwner = 'provider' | 'server' | 'client' | null;

export interface ExperienceV3RouteTerminalFailure {
  readonly phase: Extract<ExperienceV3TerminalPhase,
    'route_gate' | 'route_auth' | 'route_rate_limit' | 'route_configuration' | 'route_exception'>;
  readonly typedFailureCode: string;
  readonly failureFamily: Extract<ExperienceV3TerminalFailureFamily,
    'feature_gate' | 'auth' | 'rate_limit' | 'configuration' | 'route_exception'>;
}

export interface ExperienceV3TerminalDiagnosticEvent {
  readonly event: typeof EXPERIENCE_V3_TERMINAL_EVENT_NAME;
  readonly requestId: string | null;
  readonly action: typeof EXPERIENCE_V3_ENHANCE_OBSERVABILITY_ACTION;
  readonly httpStatus: number;
  readonly phase: ExperienceV3TerminalPhase;
  readonly typedFailureCode: string;
  readonly failureFamily: ExperienceV3TerminalFailureFamily;
  readonly elapsedMs: number;
  readonly clientAbortRelevant: boolean | null;
  readonly serverOuterDeadlineReached: boolean | null;
  readonly providerReached: boolean | null;
  readonly providerAttemptCount: number | null;
  readonly providerResponseReceived: boolean | null;
  readonly writerReached: boolean | null;
  readonly evaluatorReached: boolean | null;
  readonly validatorReached: boolean | null;
  readonly timeoutPhase: 'initial_writer' | 'initial_evaluator' | null;
  readonly timeoutOwner: ExperienceV3TimeoutOwner;
  readonly outputContractFailureClass: string | null;
  readonly validationRejected: boolean | null;
  readonly validationStage: ExperienceV3ValidationStage;
  readonly primaryValidationCode: string | null;
  readonly validationCodes: readonly string[];
  readonly structuralViolationCount: number | null;
  readonly semanticViolationCount: number | null;
  readonly languageViolationCount: number | null;
  readonly materialityFailure: boolean | null;
  readonly noMaterialImprovement: boolean | null;
  readonly usageCommitted: false;
}

export interface ExperienceV3TerminalDiagnosticInput {
  readonly requestId: unknown;
  readonly httpStatus: number;
  readonly elapsedMs: number;
  readonly result?: ExperienceV3EnhanceFailureResponse;
  readonly routeFailure?: ExperienceV3RouteTerminalFailure;
}

type ProviderEvidence = {
  readonly providerFailureStage?: ExperienceV3ProviderFailureStage;
  readonly providerErrorType?: ExperienceV3ProviderErrorType | null;
  readonly providerErrorCode?: string | null;
  readonly providerHttpResponseReceived?: boolean | null;
};

type ProviderDeadlineOwner = 'provider_transport' | 'verifier_transport' | 'route_deadline' | 'client_abort';
const providerDeadlineOwners = new WeakMap<object, ProviderDeadlineOwner>();

export function rememberExperienceV3ProviderDeadlineOwner(
  evidence: object,
  owner: ProviderDeadlineOwner | null,
): void {
  if (owner) providerDeadlineOwners.set(evidence, owner);
}

export function readExperienceV3ProviderDeadlineOwner(
  evidence: object,
): ProviderDeadlineOwner | null {
  return providerDeadlineOwners.get(evidence) ?? null;
}

function safeCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[a-z][a-z0-9_.\/-]{0,127}$/u.test(value)
    ? value
    : fallback;
}

function safeRequestId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/u.test(value)
    ? value
    : null;
}

function safeHttpStatus(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : 500;
}

function safeElapsedMs(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function providerEvidence(result: ExperienceV3EnhanceFailureResponse): ProviderEvidence {
  return (result.diagnosticEvidence ?? {}) as ProviderEvidence;
}

function safeValidationCodes(
  violations: readonly unknown[] | undefined,
  category: 'structural' | 'semantic' | 'language_quality',
): readonly string[] {
  if (!violations) return [];
  return violations.flatMap((violation) => {
    if (!violation || typeof violation !== 'object' || Array.isArray(violation)) return [];
    const code = (violation as Record<string, unknown>).code;
    if (category === 'structural') {
      return typeof code === 'string' && experienceV3StructuralValidationCodeAllowlist.has(code) ? [code] : [];
    }
    return isExperienceV3EnhanceValidationCodeForCategory(code, category) ? [code] : [];
  });
}

function uniqueCodes(codes: readonly string[]): readonly string[] {
  return [...new Set(codes)];
}

function validationDetail(result: ExperienceV3EnhanceFailureResponse): {
  readonly validationStage: ExperienceV3ValidationStage;
  readonly primaryValidationCode: string | null;
  readonly validationCodes: readonly string[];
  readonly structuralViolationCount: number | null;
  readonly semanticViolationCount: number | null;
  readonly languageViolationCount: number | null;
  readonly materialityFailure: boolean | null;
  readonly noMaterialImprovement: boolean | null;
} {
  const validation = result.validation;
  if (!validation) {
    return {
      validationStage: null,
      primaryValidationCode: null,
      validationCodes: [],
      structuralViolationCount: null,
      semanticViolationCount: null,
      languageViolationCount: null,
      materialityFailure: null,
      noMaterialImprovement: null,
    };
  }
  const structuralViolations = validation.phases.structural?.violations ?? [];
  const semanticViolations = validation.phases.semantic?.violations ?? [];
  const languageViolations = validation.phases.language_quality?.violations ?? [];
  const structuralCodes = safeValidationCodes(structuralViolations, 'structural');
  const semanticCodes = safeValidationCodes(semanticViolations, 'semantic');
  const languageCodes = safeValidationCodes(languageViolations, 'language_quality');
  const validationCodes = uniqueCodes([...structuralCodes, ...semanticCodes, ...languageCodes]);
  const evidenceCode = result.diagnosticEvidence?.primaryValidationRejectionCode;
  const primaryValidationCode = typeof evidenceCode === 'string'
    && (experienceV3StructuralValidationCodeAllowlist.has(evidenceCode)
      || isExperienceV3EnhanceValidationCode(evidenceCode))
    ? evidenceCode
    : validationCodes[0] ?? null;
  const validationStage = validation.phases.structural?.status === 'failed'
    ? 'STRUCTURAL_VALIDATION' as const
    : validation.phases.semantic?.status === 'failed'
      ? 'SEMANTIC_GROUNDING_VALIDATION' as const
      : validation.phases.language_quality?.status === 'failed'
        ? 'LANGUAGE_VALIDATION' as const
        : result.typedReason === 'materiality_degraded'
          ? 'MATERIALITY_VALIDATION' as const
          : result.typedReason === 'no_material_improvement'
            ? 'NO_MATERIAL_IMPROVEMENT' as const
            : result.typedReason === 'validation_rejected' || validation.decision === 'reject'
              ? 'OTHER_TYPED_VALIDATION' as const
              : null;
  return {
    validationStage,
    primaryValidationCode,
    validationCodes,
    structuralViolationCount: structuralViolations.length,
    semanticViolationCount: semanticViolations.length,
    languageViolationCount: languageViolations.length,
    materialityFailure: result.typedReason === 'materiality_degraded',
    noMaterialImprovement: result.typedReason === 'no_material_improvement',
  };
}

function timeoutOwner(value: ProviderDeadlineOwner | null): ExperienceV3TimeoutOwner {
  if (value === 'route_deadline') return 'server';
  if (value === 'client_abort') return 'client';
  if (value === 'provider_transport' || value === 'verifier_transport') return 'provider';
  return null;
}

function phaseForResult(
  result: ExperienceV3EnhanceFailureResponse,
  evidence: ProviderEvidence,
  deadlineOwner: ProviderDeadlineOwner | null,
): { readonly phase: ExperienceV3TerminalPhase; readonly family: ExperienceV3TerminalFailureFamily } {
  const reason = result.typedReason;
  if (reason === 'invalid_request_contract') return { phase: 'request_validation', family: 'request_contract' };
  const writerReason = reason === 'writer_request_failed' || reason.startsWith('writer_') || reason === 'provider_output_malformed';
  const evaluatorReason = reason === 'evaluator_timeout' || reason === 'evaluator_request_failed'
    || reason.startsWith('evaluator_') || reason === 'validator_exception';
  const outputContractEvidence = evidence.providerFailureStage === 'response_extraction'
    || evidence.providerErrorType === 'response_extraction';
  if (evidence.providerErrorType === 'timeout' && deadlineOwner === 'route_deadline') {
    return { phase: 'server_deadline', family: 'provider_transport' };
  }
  if (writerReason) {
    return {
      phase: 'initial_writer',
      family: outputContractEvidence ? 'output_contract' : evidence.providerFailureStage || reason === 'writer_request_failed'
        ? 'provider_transport' : 'output_contract',
    };
  }
  if (evaluatorReason) {
    return {
      phase: 'initial_evaluator',
      family: outputContractEvidence ? 'output_contract' : evidence.providerFailureStage || reason === 'evaluator_request_failed' || reason === 'validator_exception'
        ? 'provider_transport' : 'output_contract',
    };
  }
  if (reason === 'structural_validation_failed' || reason === 'validation_rejected'
    || reason === 'materiality_degraded' || reason === 'no_material_improvement') {
    return { phase: 'validation', family: 'validation' };
  }
  return { phase: 'route_exception', family: 'route_exception' };
}

function reachedState(
  result: ExperienceV3EnhanceFailureResponse,
  phase: ExperienceV3TerminalPhase,
): Pick<ExperienceV3TerminalDiagnosticEvent, 'writerReached' | 'evaluatorReached' | 'validatorReached'> {
  if (phase === 'request_validation' || phase === 'route_gate' || phase === 'route_auth'
    || phase === 'route_rate_limit' || phase === 'route_configuration' || phase === 'route_exception') {
    return { writerReached: false, evaluatorReached: false, validatorReached: false };
  }
  if (phase === 'initial_writer') return { writerReached: true, evaluatorReached: false, validatorReached: false };
  if (phase === 'initial_evaluator') return { writerReached: true, evaluatorReached: true, validatorReached: false };
  if (phase === 'server_deadline') {
    const evaluator = result.typedReason === 'evaluator_timeout' || result.typedReason.startsWith('evaluator_');
    return { writerReached: true, evaluatorReached: evaluator, validatorReached: false };
  }
  return { writerReached: true, evaluatorReached: true, validatorReached: true };
}

function providerAttempts(
  result: ExperienceV3EnhanceFailureResponse,
  phase: ExperienceV3TerminalPhase,
  evidence: ProviderEvidence,
): number | null {
  if (phase === 'request_validation' || phase === 'route_gate' || phase === 'route_auth'
    || phase === 'route_rate_limit' || phase === 'route_configuration') return 0;
  if (phase === 'route_exception') return null;
  if (phase === 'initial_writer') {
    if (!evidence.providerFailureStage) return 1;
    return evidence.providerFailureStage === 'request_construction' ? 0
      : evidence.providerFailureStage === 'sdk_request' ? null : 1;
  }
  if (phase === 'initial_evaluator' || phase === 'server_deadline') {
    if (!evidence.providerFailureStage) return 2;
    return evidence.providerFailureStage === 'request_construction' ? 1
      : evidence.providerFailureStage === 'sdk_request' ? null : 2;
  }
  return result.typedReason === 'structural_validation_failed' ? 1 : 2;
}

export function createExperienceV3TerminalDiagnostic(
  input: ExperienceV3TerminalDiagnosticInput,
): ExperienceV3TerminalDiagnosticEvent {
  if (input.routeFailure) {
    return {
      event: EXPERIENCE_V3_TERMINAL_EVENT_NAME,
      requestId: safeRequestId(input.requestId),
      action: EXPERIENCE_V3_ENHANCE_OBSERVABILITY_ACTION,
      httpStatus: safeHttpStatus(input.httpStatus),
      phase: input.routeFailure.phase,
      typedFailureCode: safeCode(input.routeFailure.typedFailureCode, 'route_failure'),
      failureFamily: input.routeFailure.failureFamily,
      elapsedMs: safeElapsedMs(input.elapsedMs),
      clientAbortRelevant: null,
      serverOuterDeadlineReached: false,
      providerReached: false,
      providerAttemptCount: 0,
      providerResponseReceived: false,
      writerReached: false,
      evaluatorReached: false,
      validatorReached: false,
      timeoutPhase: null,
      timeoutOwner: null,
      outputContractFailureClass: null,
      validationRejected: false,
      validationStage: null,
      primaryValidationCode: null,
      validationCodes: [],
      structuralViolationCount: null,
      semanticViolationCount: null,
      languageViolationCount: null,
      materialityFailure: null,
      noMaterialImprovement: null,
      usageCommitted: false,
    };
  }
  const result = input.result;
  if (!result) throw new Error('Experience V3 terminal diagnostic requires a typed failure source');
  const evidence = providerEvidence(result);
  const deadline = result.diagnosticEvidence && typeof result.diagnosticEvidence === 'object'
    ? readExperienceV3ProviderDeadlineOwner(result.diagnosticEvidence)
    : null;
  const classification = phaseForResult(result, evidence, deadline);
  const reached = reachedState(result, classification.phase);
  const detail = validationDetail(result);
  const typedTimeout = evidence.providerErrorType === 'timeout';
  const owner = typedTimeout ? timeoutOwner(deadline) : null;
  return {
    event: EXPERIENCE_V3_TERMINAL_EVENT_NAME,
    requestId: safeRequestId(input.requestId),
    action: EXPERIENCE_V3_ENHANCE_OBSERVABILITY_ACTION,
    httpStatus: safeHttpStatus(input.httpStatus),
    phase: classification.phase,
    typedFailureCode: safeCode(result.typedReason, 'unknown_failure'),
    failureFamily: classification.family,
    elapsedMs: safeElapsedMs(input.elapsedMs),
    clientAbortRelevant: typedTimeout ? owner === 'client' ? true : owner === null ? null : false : null,
    serverOuterDeadlineReached: typedTimeout ? owner === 'server' ? true : owner === null ? null : false : null,
    providerReached: classification.phase === 'request_validation' ? false
      : evidence.providerFailureStage === 'request_construction' ? false
        : evidence.providerFailureStage === 'sdk_request' ? null : classification.phase === 'route_exception' ? null : true,
    providerAttemptCount: providerAttempts(result, classification.phase, evidence),
    providerResponseReceived: evidence.providerFailureStage
      ? evidence.providerFailureStage === 'request_construction' ? false
        : evidence.providerFailureStage === 'sdk_request' ? (evidence.providerHttpResponseReceived ?? null) : true
      : classification.phase === 'request_validation' || classification.phase === 'route_exception' ? null : true,
    ...reached,
    timeoutPhase: typedTimeout
      ? classification.phase === 'server_deadline'
        ? (result.typedReason.startsWith('evaluator') || result.typedReason === 'validator_exception' ? 'initial_evaluator' : 'initial_writer')
        : classification.phase === 'initial_writer' || classification.phase === 'initial_evaluator'
          ? classification.phase
          : null
      : null,
    timeoutOwner: owner,
    outputContractFailureClass: classification.family === 'output_contract'
      ? safeCode(evidence.providerErrorCode ?? evidence.providerErrorType ?? result.typedReason, 'output_contract_failure')
      : null,
    validationRejected: classification.family === 'validation',
    ...detail,
    usageCommitted: false,
  };
}

/** Logging is observational only and never participates in response handling. */
export function emitExperienceV3TerminalDiagnostic(
  input: ExperienceV3TerminalDiagnosticInput,
): ExperienceV3TerminalDiagnosticEvent {
  const event = createExperienceV3TerminalDiagnostic(input);
  try {
    console.info(JSON.stringify(event));
  } catch {
    // Diagnostics must never interfere with the route response.
  }
  return event;
}
