import {
  isContentLocalizeM6TargetLocale,
  type ContentLocalizeM6Snapshot,
} from './content-localize-m6';
import type {
  ContentLocalizeM6ServerResult,
} from './content-localize-m6-server';
import type {
  ContentLocalizeV3DiagnosticPhase,
  ContentLocalizeV3ServerDiagnostic,
} from './content-localize-v3-terminal-diagnostics';

export const CONTENT_LOCALIZE_V3_TERMINAL_EVENT_NAME = 'content_localize_v3_terminal' as const;
export const CONTENT_LOCALIZE_V3_OBSERVABILITY_ACTION = 'content-localize-v3' as const;

export const CONTENT_LOCALIZE_V3_TERMINAL_PHASES = [
  'request_validation',
  'route_gate',
  'route_auth',
  'route_rate_limit',
  'route_configuration',
  'initial_writer',
  'initial_evaluator',
  'repair_writer',
  'repair_evaluator',
  'validation',
  'route_deadline',
  'unknown_runtime',
] as const;

export type ContentLocalizeV3TerminalPhase =
  (typeof CONTENT_LOCALIZE_V3_TERMINAL_PHASES)[number];

export type ContentLocalizeV3TerminalFailureFamily =
  | 'request_contract'
  | 'feature_gate'
  | 'auth'
  | 'rate_limit'
  | 'configuration'
  | 'provider_transport'
  | 'output_contract'
  | 'validation'
  | 'timeout'
  | 'runtime';

export type ContentLocalizeV3TimeoutOwner = 'provider' | 'server' | null;

export interface ContentLocalizeV3RouteTerminalFailure {
  readonly phase: Extract<ContentLocalizeV3TerminalPhase,
    'route_gate' | 'route_auth' | 'route_rate_limit' | 'route_configuration' | 'unknown_runtime'>;
  readonly typedFailureCode: string;
  readonly failureFamily: Extract<ContentLocalizeV3TerminalFailureFamily,
    'feature_gate' | 'auth' | 'rate_limit' | 'configuration' | 'runtime'>;
}

export interface ContentLocalizeV3ProductionTerminalEvent {
  readonly event: typeof CONTENT_LOCALIZE_V3_TERMINAL_EVENT_NAME;
  readonly requestId: string | null;
  readonly action: typeof CONTENT_LOCALIZE_V3_OBSERVABILITY_ACTION;
  readonly httpStatus: number;
  readonly elapsedMs: number;
  readonly snapshotKind: ContentLocalizeM6Snapshot['kind'] | null;
  readonly sourceLocale: ContentLocalizeM6Snapshot['sourceLocale'] | null;
  readonly targetLocale: ContentLocalizeM6Snapshot['targetLocale'] | null;
  readonly phase: ContentLocalizeV3TerminalPhase;
  readonly typedFailureCode: string;
  readonly failureFamily: ContentLocalizeV3TerminalFailureFamily;
  readonly timeoutPhase: Extract<ContentLocalizeV3TerminalPhase,
    'initial_writer' | 'initial_evaluator' | 'repair_writer' | 'repair_evaluator'> | null;
  readonly timeoutOwner: ContentLocalizeV3TimeoutOwner;
  readonly providerAttemptCount: number | null;
  readonly providerReached: boolean | null;
  readonly providerResponseReceived: boolean | null;
  readonly providerFailureStage: string | null;
  readonly providerErrorType: string | null;
  readonly writerReached: boolean | null;
  readonly evaluatorReached: boolean | null;
  readonly repairWriterReached: boolean | null;
  readonly repairEvaluatorReached: boolean | null;
  readonly validatorReached: boolean | null;
  readonly outputContractFailureClass: string | null;
  readonly validationFailureClass: string | null;
  readonly usageCommitted: false;
}

export interface ContentLocalizeV3ProductionTerminalInput {
  readonly requestId: unknown;
  readonly snapshot: unknown;
  readonly httpStatus: number;
  readonly elapsedMs: number;
  readonly result?: Extract<ContentLocalizeM6ServerResult, { status: 'handled_failure' }>;
  readonly routeFailure?: ContentLocalizeV3RouteTerminalFailure;
}

type FailureResult = Extract<ContentLocalizeM6ServerResult, { status: 'handled_failure' }>;
type ProviderPhaseName = 'initial_writer' | 'initial_evaluator' | 'repair_writer' | 'repair_evaluator';

function safeRequestId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9:_-]{1,128}$/u.test(value)
    ? value
    : null;
}

function safeCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.\/-]{0,127}$/u.test(value)
    ? value
    : fallback;
}

function safeOptionalCode(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.\/-]{0,127}$/u.test(value)
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

function safeSnapshot(snapshot: unknown): Pick<ContentLocalizeV3ProductionTerminalEvent,
  'snapshotKind' | 'sourceLocale' | 'targetLocale'> {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return { snapshotKind: null, sourceLocale: null, targetLocale: null };
  }
  const record = snapshot as Record<string, unknown>;
  const snapshotKind = record.kind === 'summary' || record.kind === 'experience_description'
    ? record.kind
    : null;
  const sourceLocale = typeof record.sourceLocale === 'string'
    && isContentLocalizeM6TargetLocale(record.sourceLocale)
    ? record.sourceLocale
    : null;
  const targetLocale = typeof record.targetLocale === 'string'
    && isContentLocalizeM6TargetLocale(record.targetLocale)
    ? record.targetLocale
    : null;
  return { snapshotKind, sourceLocale, targetLocale };
}

function phaseForDeadline(
  diagnostic: ContentLocalizeV3ServerDiagnostic,
): ProviderPhaseName | null {
  if (!diagnostic.deadlineExceeded) return null;
  switch (diagnostic.deadlinePhase) {
    case 'writer': return 'initial_writer';
    case 'evaluator': return 'initial_evaluator';
    case 'repair_writer': return 'repair_writer';
    case 'repair_evaluator': return 'repair_evaluator';
    default: return null;
  }
}

function phaseFromProgress(diagnostic: ContentLocalizeV3ServerDiagnostic): ProviderPhaseName | null {
  if (diagnostic.repairEvaluator.attempted) return 'repair_evaluator';
  if (diagnostic.repair.attempted) return 'repair_writer';
  if (diagnostic.primaryEvaluator.attempted) return 'initial_evaluator';
  if (diagnostic.writer.attempted) return 'initial_writer';
  return null;
}

function phaseForResult(result: FailureResult): ContentLocalizeV3TerminalPhase {
  const diagnostic = result.diagnostic;
  const timedPhase = phaseForDeadline(diagnostic);
  if (diagnostic.deadlineExceeded) {
    return diagnostic.deadlineOwner === 'route_budget'
      ? 'route_deadline'
      : timedPhase ?? 'unknown_runtime';
  }
  if (result.reason === 'invalid_authorization_snapshot') return 'request_validation';
  if (result.reason === 'candidate_rejected') return 'validation';
  return phaseFromProgress(diagnostic) ?? 'unknown_runtime';
}

function activeDiagnosticPhase(
  diagnostic: ContentLocalizeV3ServerDiagnostic,
  phase: ContentLocalizeV3TerminalPhase,
  timeoutPhase: ProviderPhaseName | null,
): ContentLocalizeV3DiagnosticPhase | null {
  const providerPhase = phase === 'route_deadline' ? timeoutPhase : phase;
  switch (providerPhase) {
    case 'initial_writer': return diagnostic.writer;
    case 'initial_evaluator': return diagnostic.primaryEvaluator;
    case 'repair_writer': return diagnostic.repair;
    case 'repair_evaluator': return diagnostic.repairEvaluator;
    default: return null;
  }
}

function failureFamily(
  result: FailureResult,
  phase: ContentLocalizeV3TerminalPhase,
): ContentLocalizeV3TerminalFailureFamily {
  if (result.diagnostic.deadlineExceeded) return 'timeout';
  if (result.reason === 'invalid_authorization_snapshot') return 'request_contract';
  if (result.reason === 'candidate_rejected') return 'validation';
  if (result.reason.endsWith('_identity_mismatch') || result.reason.endsWith('_candidate_invalid')) {
    return 'output_contract';
  }
  const active = activeDiagnosticPhase(result.diagnostic, phase, null);
  if (active?.result === 'malformed') return 'output_contract';
  if (result.diagnostic.providerFailureStage || active?.result === 'failed') return 'provider_transport';
  return 'runtime';
}

function timeoutOwner(diagnostic: ContentLocalizeV3ServerDiagnostic): ContentLocalizeV3TimeoutOwner {
  if (!diagnostic.deadlineExceeded) return null;
  if (diagnostic.deadlineOwner === 'provider_call') return 'provider';
  if (diagnostic.deadlineOwner === 'route_budget') return 'server';
  return null;
}

function providerAttemptCount(diagnostic: ContentLocalizeV3ServerDiagnostic): number {
  return [
    diagnostic.writer,
    diagnostic.primaryEvaluator,
    diagnostic.repair,
    diagnostic.repairEvaluator,
  ].filter((phase) => phase.attempted === true).length;
}

function providerResponseReceived(
  diagnostic: ContentLocalizeV3ServerDiagnostic,
  active: ContentLocalizeV3DiagnosticPhase | null,
  attempts: number,
): boolean | null {
  if (attempts === 0) return false;
  if (!active) {
    return [
      diagnostic.writer,
      diagnostic.primaryEvaluator,
      diagnostic.repair,
      diagnostic.repairEvaluator,
    ].some((phase) => phase.result === 'succeeded' || phase.result === 'malformed')
      ? true
      : null;
  }
  if (active.result === 'succeeded' || active.result === 'malformed') return true;
  if (active.result === 'failed') return diagnostic.providerHttpStatus === null ? null : true;
  return null;
}

function validatorReached(diagnostic: ContentLocalizeV3ServerDiagnostic): boolean {
  return [diagnostic.primaryEvaluator, diagnostic.repairEvaluator]
    .some((phase) => phase.result === 'succeeded' || phase.result === 'malformed');
}

function routeEvent(
  input: ContentLocalizeV3ProductionTerminalInput,
  routeFailure: ContentLocalizeV3RouteTerminalFailure,
): ContentLocalizeV3ProductionTerminalEvent {
  const unknownRuntime = routeFailure.phase === 'unknown_runtime';
  return {
    event: CONTENT_LOCALIZE_V3_TERMINAL_EVENT_NAME,
    requestId: safeRequestId(input.requestId),
    action: CONTENT_LOCALIZE_V3_OBSERVABILITY_ACTION,
    httpStatus: safeHttpStatus(input.httpStatus),
    elapsedMs: safeElapsedMs(input.elapsedMs),
    ...safeSnapshot(input.snapshot),
    phase: routeFailure.phase,
    typedFailureCode: safeCode(routeFailure.typedFailureCode, 'route_failure'),
    failureFamily: routeFailure.failureFamily,
    timeoutPhase: null,
    timeoutOwner: null,
    providerAttemptCount: unknownRuntime ? null : 0,
    providerReached: unknownRuntime ? null : false,
    providerResponseReceived: unknownRuntime ? null : false,
    providerFailureStage: null,
    providerErrorType: null,
    writerReached: unknownRuntime ? null : false,
    evaluatorReached: unknownRuntime ? null : false,
    repairWriterReached: unknownRuntime ? null : false,
    repairEvaluatorReached: unknownRuntime ? null : false,
    validatorReached: unknownRuntime ? null : false,
    outputContractFailureClass: null,
    validationFailureClass: null,
    usageCommitted: false,
  };
}

export function createContentLocalizeV3ProductionTerminalEvent(
  input: ContentLocalizeV3ProductionTerminalInput,
): ContentLocalizeV3ProductionTerminalEvent {
  if (input.routeFailure) return routeEvent(input, input.routeFailure);
  const result = input.result;
  if (!result) throw new Error('Content Localize V3 terminal event requires a typed failure source');

  const diagnostic = result.diagnostic;
  const phase = phaseForResult(result);
  const timeoutPhase = phaseForDeadline(diagnostic);
  const active = activeDiagnosticPhase(diagnostic, phase, timeoutPhase);
  const attempts = providerAttemptCount(diagnostic);
  const family = failureFamily(result, phase);

  return {
    event: CONTENT_LOCALIZE_V3_TERMINAL_EVENT_NAME,
    requestId: safeRequestId(input.requestId),
    action: CONTENT_LOCALIZE_V3_OBSERVABILITY_ACTION,
    httpStatus: safeHttpStatus(input.httpStatus),
    elapsedMs: safeElapsedMs(input.elapsedMs),
    ...safeSnapshot(input.snapshot),
    phase,
    typedFailureCode: result.reason,
    failureFamily: family,
    timeoutPhase,
    timeoutOwner: timeoutOwner(diagnostic),
    providerAttemptCount: attempts,
    providerReached: attempts > 0,
    providerResponseReceived: providerResponseReceived(diagnostic, active, attempts),
    providerFailureStage: safeOptionalCode(diagnostic.providerFailureStage),
    providerErrorType: safeOptionalCode(diagnostic.providerErrorType),
    writerReached: diagnostic.writer.attempted,
    evaluatorReached: diagnostic.primaryEvaluator.attempted,
    repairWriterReached: diagnostic.repair.attempted,
    repairEvaluatorReached: diagnostic.repairEvaluator.attempted,
    validatorReached: validatorReached(diagnostic),
    outputContractFailureClass: family === 'output_contract' ? result.reason : null,
    validationFailureClass: family === 'validation' ? result.reason : null,
    usageCommitted: false,
  };
}

/** Logging is observational only and never participates in response handling. */
export function emitContentLocalizeV3ProductionTerminalEvent(
  input: ContentLocalizeV3ProductionTerminalInput,
): ContentLocalizeV3ProductionTerminalEvent {
  const event = createContentLocalizeV3ProductionTerminalEvent(input);
  try {
    console.info(JSON.stringify(event));
  } catch {
    // Diagnostics must never interfere with the route response.
  }
  return event;
}
