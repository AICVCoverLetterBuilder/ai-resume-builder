import type {
  SummaryV3GenerateFailureResponse,
  SummaryV3ProviderFailureEnvelope,
  SummaryV3ProviderPhase,
} from './summary-generate';

export const SUMMARY_V3_TERMINAL_EVENT_NAME = 'summary_v3_terminal' as const;

export type SummaryV3TerminalPhase =
  | SummaryV3ProviderPhase
  | 'request_validation'
  | 'route_auth'
  | 'route_rate_limit'
  | 'route_configuration'
  | 'route_gate'
  | 'primary_validation'
  | 'repair_validation'
  | 'route_exception';

export type SummaryV3TerminalFailureFamily =
  | 'request_contract'
  | 'auth'
  | 'rate_limit'
  | 'configuration'
  | 'feature_gate'
  | 'provider_transport'
  | 'output_contract'
  | 'structural_validation'
  | 'semantic_validation'
  | 'route_exception';

export interface SummaryV3RouteTerminalFailure {
  readonly phase: Extract<SummaryV3TerminalPhase,
    'route_auth' | 'route_rate_limit' | 'route_configuration' | 'route_gate' | 'route_exception'>;
  readonly typedFailureCode: string;
  readonly failureFamily: Extract<SummaryV3TerminalFailureFamily,
    'auth' | 'rate_limit' | 'configuration' | 'feature_gate' | 'route_exception'>;
}

export interface SummaryV3TerminalDiagnosticInput {
  readonly requestId: unknown;
  readonly httpStatus: number;
  readonly elapsedMs: number;
  readonly result?: SummaryV3GenerateFailureResponse;
  readonly routeFailure?: SummaryV3RouteTerminalFailure;
}

export interface SummaryV3TerminalDiagnosticEvent {
  readonly event: typeof SUMMARY_V3_TERMINAL_EVENT_NAME;
  readonly requestId: string | null;
  readonly action: 'summary_v3_generate';
  readonly httpStatus: number;
  readonly phase: SummaryV3TerminalPhase;
  readonly typedFailureCode: string;
  readonly failureFamily: SummaryV3TerminalFailureFamily;
  readonly elapsedMs: number;
  readonly providerReached: boolean | null;
  readonly providerAttemptCount: number | null;
  readonly providerResponseReceived: boolean | null;
  readonly writerReached: boolean | null;
  readonly evaluatorReached: boolean | null;
  readonly validatorReached: boolean | null;
  readonly repairWriterReached: boolean | null;
  readonly postRepairEvaluatorReached: boolean | null;
  readonly finalizerReached: false;
  readonly validationRejected: boolean | null;
  readonly repairValidationRejected: boolean | null;
  readonly timeoutPhase: SummaryV3ProviderPhase | null;
  readonly outputContractFailureClass: string | null;
  readonly usageCommitted: false;
}

type SummaryV3ResponseClassification = Readonly<{
  phase: SummaryV3TerminalPhase;
  failureFamily: SummaryV3TerminalFailureFamily;
}>;

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

function safeNonNegativeInteger(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

function safeHttpStatus(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : 500;
}

function classifyResponseFailure(
  result: SummaryV3GenerateFailureResponse,
): SummaryV3ResponseClassification {
  const providerFailure = result.m4ProviderFailure;
  if (providerFailure) {
    return {
      phase: providerFailure.phase,
      failureFamily: providerFailure.failureStage === 'tool_validation'
        ? 'output_contract'
        : 'provider_transport',
    };
  }
  if (result.typedReason === 'invalid_request_contract') {
    return { phase: 'request_validation', failureFamily: 'request_contract' };
  }
  if (result.typedReason === 'structural_validation_failed') {
    return { phase: 'primary_validation', failureFamily: 'structural_validation' };
  }
  if (result.typedReason === 'repair_structural_validation_failed') {
    return { phase: 'repair_validation', failureFamily: 'structural_validation' };
  }
  if (result.typedReason === 'repair_validation_rejected') {
    return { phase: 'repair_validation', failureFamily: 'semantic_validation' };
  }
  return { phase: 'primary_validation', failureFamily: 'semantic_validation' };
}

function attemptsBeforePhase(phase: SummaryV3ProviderPhase): number {
  if (phase === 'initial_writer') return 0;
  if (phase === 'initial_evaluator') return 1;
  if (phase === 'repair_writer') return 2;
  return 3;
}

function completedProviderAttemptCount(
  result: SummaryV3GenerateFailureResponse,
  providerFailure: SummaryV3ProviderFailureEnvelope | null,
): number | null {
  if (providerFailure) {
    const completedBefore = attemptsBeforePhase(providerFailure.phase);
    if (providerFailure.failureStage === 'request_construction') return completedBefore;
    if (providerFailure.failureStage === 'sdk_request') return null;
    return completedBefore + 1;
  }
  if (result.typedReason === 'invalid_request_contract') return 0;
  if (result.typedReason === 'structural_validation_failed') return 1;
  if (result.typedReason === 'repair_structural_validation_failed') return 3;
  if (result.typedReason === 'repair_validation_rejected') return 4;
  return result.repairAttempted ? 4 : 2;
}

function responseReachedProvider(
  result: SummaryV3GenerateFailureResponse,
  providerFailure: SummaryV3ProviderFailureEnvelope | null,
): boolean | null {
  if (!providerFailure) return result.typedReason !== 'invalid_request_contract';
  if (providerFailure.failureStage === 'request_construction') return false;
  if (providerFailure.failureStage === 'sdk_request') return null;
  return true;
}

function executionReach(
  result: SummaryV3GenerateFailureResponse,
  phase: SummaryV3TerminalPhase,
): Pick<SummaryV3TerminalDiagnosticEvent,
  'writerReached' | 'evaluatorReached' | 'validatorReached'
  | 'repairWriterReached' | 'postRepairEvaluatorReached'> {
  if (result.typedReason === 'invalid_request_contract') {
    return {
      writerReached: false,
      evaluatorReached: false,
      validatorReached: false,
      repairWriterReached: false,
      postRepairEvaluatorReached: false,
    };
  }
  const repairWriterReached = phase === 'repair_writer'
    || phase === 'post_repair_evaluator'
    || phase === 'repair_validation';
  const postRepairEvaluatorReached = phase === 'post_repair_evaluator'
    || phase === 'repair_validation' && result.typedReason !== 'repair_structural_validation_failed';
  const evaluatorReached = phase === 'initial_evaluator'
    || phase === 'post_repair_evaluator'
    || phase === 'primary_validation' && result.typedReason !== 'structural_validation_failed'
    || postRepairEvaluatorReached;
  const validatorReached = phase !== 'initial_writer' && phase !== 'request_validation';
  return {
    writerReached: true,
    evaluatorReached,
    validatorReached,
    repairWriterReached,
    postRepairEvaluatorReached,
  };
}

export function createSummaryV3TerminalDiagnostic(
  input: SummaryV3TerminalDiagnosticInput,
): SummaryV3TerminalDiagnosticEvent {
  const routeFailure = input.routeFailure;
  if (routeFailure) {
    return {
      event: SUMMARY_V3_TERMINAL_EVENT_NAME,
      requestId: safeRequestId(input.requestId),
      action: 'summary_v3_generate',
      httpStatus: safeHttpStatus(input.httpStatus),
      phase: routeFailure.phase,
      typedFailureCode: safeCode(routeFailure.typedFailureCode, 'route_failure'),
      failureFamily: routeFailure.failureFamily,
      elapsedMs: safeNonNegativeInteger(input.elapsedMs),
      providerReached: false,
      providerAttemptCount: 0,
      providerResponseReceived: false,
      writerReached: false,
      evaluatorReached: false,
      validatorReached: false,
      repairWriterReached: false,
      postRepairEvaluatorReached: false,
      finalizerReached: false,
      validationRejected: false,
      repairValidationRejected: false,
      timeoutPhase: null,
      outputContractFailureClass: null,
      usageCommitted: false,
    };
  }

  const result = input.result;
  if (!result) {
    throw new Error('Summary V3 terminal diagnostic requires a typed failure source');
  }
  const typedFailureCode = safeCode(result.typedReason, 'unknown_failure');
  const classification = classifyResponseFailure(result);
  const providerFailure = result.m4ProviderFailure ?? null;
  const reach = executionReach(result, classification.phase);
  return {
    event: SUMMARY_V3_TERMINAL_EVENT_NAME,
    requestId: safeRequestId(input.requestId),
    action: 'summary_v3_generate',
    httpStatus: safeHttpStatus(input.httpStatus),
    phase: classification.phase,
    typedFailureCode,
    failureFamily: classification.failureFamily,
    elapsedMs: safeNonNegativeInteger(input.elapsedMs),
    providerReached: responseReachedProvider(result, providerFailure),
    providerAttemptCount: completedProviderAttemptCount(result, providerFailure),
    providerResponseReceived: providerFailure
      ? providerFailure.providerHttpResponseReceived
      : result.typedReason === 'invalid_request_contract' ? false : true,
    ...reach,
    finalizerReached: false,
    validationRejected: result.repairAttempted === true || result.typedReason === 'validation_rejected',
    repairValidationRejected: result.typedReason === 'repair_validation_rejected',
    timeoutPhase: providerFailure?.providerErrorType === 'timeout'
      ? providerFailure.phase
      : null,
    outputContractFailureClass: providerFailure?.failureStage === 'tool_validation'
      ? safeCode(providerFailure.providerErrorCode, typedFailureCode)
      : null,
    usageCommitted: false,
  };
}

/** Logging must remain observational: even a replaced console cannot change the response. */
export function emitSummaryV3TerminalDiagnostic(
  input: SummaryV3TerminalDiagnosticInput,
): SummaryV3TerminalDiagnosticEvent {
  const event = createSummaryV3TerminalDiagnostic(input);
  try {
    console.info(JSON.stringify(event));
  } catch {
    // Observability is deliberately non-interfering.
  }
  return event;
}
