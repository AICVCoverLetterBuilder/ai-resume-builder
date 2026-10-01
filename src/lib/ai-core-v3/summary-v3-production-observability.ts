import type {
  SummaryV3GenerateFailureResponse,
  SummaryV3ProviderFailureEnvelope,
  SummaryV3ProviderPhase,
} from './summary-generate';
import type {
  SummaryV3StyleEvidence,
  SummaryV3StyleMode,
  SummaryV3StyleResult,
  SummaryV3StyleWriterOutputContractFailureClass,
  SummaryV3StyleFactRepresentationFailureReason,
  SummaryV3StyleDurationDiagnosticStatus,
  SummaryV3StyleMultiFactFallbackFailureReason,
  SummaryV3StyleVisibleFactKind,
  SummaryV3StyleSourceLockFailureReason,
  SummaryV3StyleSourceLockOrigin,
  SummaryV3StyleSourceLockSurfaceMatchClass,
  SummaryV3StyleEntityLock,
  SummaryV3StylePhase,
  SummaryV3StyleViolationCode,
  SummaryV3StylePostEvaluatorLocalFailureClass,
} from './summary-style-m5';
import {
  SUMMARY_V3_STYLE_M5_PHASES,
  SUMMARY_V3_STYLE_M5_POST_EVALUATOR_LOCAL_FAILURE_CLASSES,
  SUMMARY_V3_STYLE_SOURCE_LOCK_ORIGINS,
  SUMMARY_V3_STYLE_SOURCE_LOCK_SURFACE_MATCH_CLASSES,
  SUMMARY_V3_STYLE_MAX_TOTAL_FACTS,
  isSummaryV3StyleViolationCode,
} from './summary-style-m5';
import type { SummaryV3StyleM5RouteFailure } from './summary-style-m5-transport';
import { readSummaryStyleLocalDiagnostics, type SummaryStyleLocalDiagnostics } from './summary-style-m5-local-observability';

export const SUMMARY_V3_TERMINAL_EVENT_NAME = 'summary_v3_terminal' as const;
export const SUMMARY_STRONGER_TERMINAL_EVENT_NAME = 'summary_stronger_terminal' as const;

export const SUMMARY_STRONGER_TERMINAL_LAYERS = [
  'route_gate',
  'request_validation',
  'provider_transport',
  'writer_output',
  'evaluator_validation',
  'repair_validation',
  'diagnostics',
  'terminal_success',
] as const;
export type SummaryStrongerTerminalLayer = (typeof SUMMARY_STRONGER_TERMINAL_LAYERS)[number];

export const SUMMARY_STRONGER_WRITER_RESULTS = ['not_attempted', 'accepted', 'rejected', 'error'] as const;
export type SummaryStrongerWriterResult = (typeof SUMMARY_STRONGER_WRITER_RESULTS)[number];

export const SUMMARY_STRONGER_USAGE_DECISIONS = ['increment', 'no_increment', 'not_applicable'] as const;
export type SummaryStrongerUsageDecision = (typeof SUMMARY_STRONGER_USAGE_DECISIONS)[number];

type SummaryStrongerResult = SummaryV3StyleResult | SummaryV3StyleM5RouteFailure;

export interface SummaryStrongerTerminalDiagnosticInput {
  readonly requestId: unknown;
  readonly requestedLocale: unknown;
  readonly mode: SummaryV3StyleMode;
  readonly httpStatus: number;
  readonly result: SummaryStrongerResult;
}

export interface SummaryStrongerTerminalDiagnosticEvent extends SummaryStyleLocalDiagnostics {
  readonly event: typeof SUMMARY_STRONGER_TERMINAL_EVENT_NAME;
  readonly requestCorrelationId: string | null;
  readonly operation: 'summary_style';
  readonly style: 'stronger';
  readonly mode: SummaryV3StyleMode;
  readonly requestedLocale: string | null;
  readonly httpStatus: number;
  readonly terminalLayer: SummaryStrongerTerminalLayer;
  readonly terminalReason: string;
  readonly writerAttempted: boolean;
  /** not_attempted=no provider attempt; error=initial writer provider failure before response extraction; accepted=writer passed its contract; rejected=the initial writer contract rejected (with or without a parsed candidate). */
  readonly writerResult: SummaryStrongerWriterResult;
  /** True only when a parsed writer candidate reached M5 validation; never raw provider output. */
  readonly writerCandidateReachedValidation: boolean;
  /** The authoritative finite initial-writer contract class, when present. */
  readonly writerFailureClass: SummaryV3StyleWriterOutputContractFailureClass | null;
  /** Existing bounded fact coverage from the server evidence; never recomputed here. */
  readonly coveredFactCount: number | null;
  readonly missingFactCount: number | null;
  readonly evaluatorTerminalPhase: SummaryV3StylePhase | null;
  readonly evaluatorViolationCode: SummaryV3StyleViolationCode | null;
  readonly evaluatorViolationRepairable: boolean | null;
  readonly postEvaluatorLocalFailureClass: SummaryV3StylePostEvaluatorLocalFailureClass | null;
  /** Present only for the decisive initial Stronger candidate source-floor branch. */
  readonly sourceFloorFailureStage?: 'fact_representation' | 'multi_fact_fallback';
  /** Present only for the decisive initial Stronger source-lock branch. */
  readonly sourceLockFailureKind?: SummaryV3StyleEntityLock['kind'];
  readonly sourceLockFailureReason?: SummaryV3StyleSourceLockFailureReason;
  readonly sourceLockFailedIndex?: number;
  readonly sourceLockOrigin: SummaryV3StyleSourceLockOrigin | null;
  readonly sourceLockSurfaceMatchClass: SummaryV3StyleSourceLockSurfaceMatchClass | null;
  readonly sourceLockRequiredFactBindingCount: number | null;
  readonly sourceLockDeclaredFactBindingCount: number | null;
  readonly factRepresentationFailureReason?: SummaryV3StyleFactRepresentationFailureReason;
  readonly factRepresentationFailedFactIndex?: number;
  readonly factRepresentationFailedFactSemanticKind?: SummaryV3StyleVisibleFactKind;
  readonly requiredAnchorCount?: number;
  readonly missingAnchorCount?: number;
  readonly requiredNumericAnchorCount?: number;
  readonly missingNumericAnchorCount?: number;
  readonly durationDiagnosticStatus?: SummaryV3StyleDurationDiagnosticStatus;
  readonly transformableDutyAvailable?: boolean;
  readonly predicateReplacementEligible?: boolean;
  readonly groundedReplacementRecognized?: boolean;
  readonly newCandidateTokenPresent?: boolean;
  readonly multiFactFallbackResult?: 'pass' | 'fail';
  readonly multiFactFallbackFailureReason?: SummaryV3StyleMultiFactFallbackFailureReason;
  readonly multiFactFallbackFailedFactIndex?: number;
  readonly repairAttempted: boolean;
  readonly repairProviderRequestAttempted: boolean;
  readonly evaluatorAttempted: boolean;
  readonly finalApplyEligible: boolean;
  readonly usageDecision: SummaryStrongerUsageDecision;
}

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

export type SummaryV3TransportTerminationKind =
  | 'application_slice_timeout'
  | 'route_budget_timeout'
  | 'sdk_timeout'
  | 'client_abort'
  | 'network_error'
  | 'provider_http_error'
  | 'unknown';

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
  readonly transportTerminationKind: SummaryV3TransportTerminationKind;
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

function safeLocale(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z]{2}(?:-[A-Za-z0-9]{2,8})?$/u.test(value)
    ? value
    : null;
}

function isStyleRouteFailure(result: SummaryStrongerResult): result is SummaryV3StyleM5RouteFailure {
  return result.kind === 'route_failure';
}

function styleEvidence(
  result: SummaryStrongerResult,
): SummaryV3StyleM5RouteFailure['evidence'] | SummaryV3StyleEvidence | null {
  if (isStyleRouteFailure(result)) return result.evidence ?? null;
  if (result.kind === 'not_applicable') return null;
  return result.evidence;
}

function styleProviderFailure(
  result: SummaryStrongerResult,
): SummaryV3ProviderFailureEnvelope | null {
  return styleEvidence(result)?.m5ProviderFailure ?? null;
}

function styleProviderAttempted(
  failure: SummaryV3ProviderFailureEnvelope | null,
): boolean {
  if (!failure) return false;
  if (failure.failureStage === 'request_construction' || failure.failureStage === 'orchestration') {
    return false;
  }
  return true;
}

function styleTerminalLayer(
  result: SummaryStrongerResult,
): SummaryStrongerTerminalLayer {
  if (styleProviderFailure(result)) return 'provider_transport';
  if (isStyleRouteFailure(result)) return 'route_gate';
  if (result.kind === 'candidate_ready' || result.kind === 'safe_no_op') return 'terminal_success';
  if (result.kind === 'not_applicable') return 'request_validation';

  const reason = result.typedReason;
  if (result.evidence.m5ProviderFailure) return 'provider_transport';
  if (reason === 'diagnostic_size_exceeded') return 'diagnostics';
  if (result.evidence.repairWriterAttempts > 0 || result.evidence.repairEvaluatorAttempts > 0) return 'repair_validation';
  if (result.evidence.writerCandidateReachedValidation && result.evidence.evaluatorReached) return 'evaluator_validation';
  if (result.evidence.writerAttempts > 0
    && (result.evidence.writerOutputContractFailureClass !== null
      || !result.evidence.writerCandidateReachedValidation)) return 'writer_output';
  if (reason.startsWith('repair_')) return 'repair_validation';
  if (reason === 'evaluator_rejected' || reason === 'style_not_fulfilled'
    || reason === 'invalid_language_or_native_surface') return 'evaluator_validation';
  if (reason === 'writer_identity_mismatch' || reason === 'candidate_malformed'
    || reason === 'lost_source_fact' || reason === 'unsupported_claim') return 'writer_output';
  if (reason === 'malformed_request' || reason === 'insufficient_context'
    || reason === 'ambiguous_current_role' || reason === 'source_fact_not_visible'
    || reason === 'stale_identity') return 'request_validation';
  return 'request_validation';
}

function styleWriterResult(
  result: SummaryStrongerResult,
): SummaryStrongerWriterResult {
  const providerFailure = styleProviderFailure(result);
  if (providerFailure?.phase === 'initial_writer'
    && providerFailure.failureStage !== 'request_construction') return 'error';
  if (isStyleRouteFailure(result) || result.kind === 'not_applicable') return 'not_attempted';
  const evidence = result.evidence;
  if (evidence.writerAttempts <= 0) return 'not_attempted';
  if (evidence.m5ProviderFailure?.phase === 'initial_writer'
    && evidence.m5ProviderFailure.failureStage !== 'response_extraction') return 'error';
  if (evidence.writerOutputContractFailureClass !== null) return 'rejected';
  return evidence.writerCandidateReachedValidation ? 'accepted' : 'rejected';
}

function styleRepairProviderRequestAttempted(
  result: SummaryStrongerResult,
): boolean {
  const providerFailure = styleProviderFailure(result);
  if (isStyleRouteFailure(result)) {
    return (providerFailure?.phase === 'repair_writer' || providerFailure?.phase === 'post_repair_evaluator')
      && styleProviderAttempted(providerFailure);
  }
  if (result.kind === 'not_applicable') return false;
  const evidence = result.evidence;
  if (evidence.repairWriterAttempts > 0 || evidence.repairEvaluatorAttempts > 0) {
    if (evidence.m5ProviderFailure?.failureStage === 'request_construction') return false;
    return evidence.m5ProviderFailure?.phase === 'repair_writer'
      || evidence.m5ProviderFailure?.phase === 'post_repair_evaluator'
      || !evidence.m5ProviderFailure;
  }
  return false;
}

function styleUsageDecision(
  result: SummaryStrongerResult,
): SummaryStrongerUsageDecision {
  if (styleProviderFailure(result)) return 'no_increment';
  if (isStyleRouteFailure(result) || result.kind === 'not_applicable') return 'not_applicable';
  return result.kind === 'candidate_ready' ? 'increment' : 'no_increment';
}

/**
 * The sole privacy-safe terminal observer for the M5 Summary Stronger route.
 * It projects only bounded enums, booleans, locale, status, and infrastructure
 * correlation; it never serializes request, candidate, prompt, or provider text.
 */
export function createSummaryStrongerTerminalDiagnostic(
  input: SummaryStrongerTerminalDiagnosticInput,
): SummaryStrongerTerminalDiagnosticEvent {
  const routeFailure = isStyleRouteFailure(input.result);
  const evidence = styleEvidence(input.result);
  const providerFailure = styleProviderFailure(input.result);
  const writerAttempted = providerFailure
    ? providerFailure.phase === 'initial_writer' && styleProviderAttempted(providerFailure)
    : evidence ? 'writerAttempts' in evidence && evidence.writerAttempts > 0 : false;
  const repairAttempted = evidence
    ? ('repairWriterAttempts' in evidence
      ? evidence.repairWriterAttempts > 0 || evidence.repairEvaluatorAttempts > 0
      : providerFailure?.phase === 'repair_writer' || providerFailure?.phase === 'post_repair_evaluator')
    : false;
  const terminalReason = routeFailure
    ? safeCode(input.result.typedReason, 'route_failure')
    : input.result.kind === 'not_applicable'
      ? safeCode(input.result.reason, 'not_applicable')
      : input.result.kind === 'candidate_ready'
        ? 'candidate_ready'
        : input.result.typedReason === 'safe_no_op'
          ? 'safe_no_op'
          : safeCode(input.result.typedReason, 'unknown_failure');
  const candidateSourceFloorEvidence: SummaryV3StyleEvidence | null = !routeFailure
    && input.result.kind !== 'not_applicable'
    ? input.result.evidence
    : null;
  const sourceFloorEvidence = candidateSourceFloorEvidence?.writerOutputContractFailureClass === 'candidate_source_floor'
    ? {
      ...(candidateSourceFloorEvidence.sourceFloorFailureStage ? { sourceFloorFailureStage: candidateSourceFloorEvidence.sourceFloorFailureStage } : {}),
      ...(candidateSourceFloorEvidence.factRepresentationFailureReason ? { factRepresentationFailureReason: candidateSourceFloorEvidence.factRepresentationFailureReason } : {}),
      ...(typeof candidateSourceFloorEvidence.factRepresentationFailedFactIndex === 'number' ? { factRepresentationFailedFactIndex: safeNonNegativeInteger(candidateSourceFloorEvidence.factRepresentationFailedFactIndex) } : {}),
      ...(candidateSourceFloorEvidence.factRepresentationFailedFactSemanticKind ? { factRepresentationFailedFactSemanticKind: candidateSourceFloorEvidence.factRepresentationFailedFactSemanticKind } : {}),
      ...(typeof candidateSourceFloorEvidence.requiredAnchorCount === 'number' ? { requiredAnchorCount: safeNonNegativeInteger(candidateSourceFloorEvidence.requiredAnchorCount) } : {}),
      ...(typeof candidateSourceFloorEvidence.missingAnchorCount === 'number' ? { missingAnchorCount: safeNonNegativeInteger(candidateSourceFloorEvidence.missingAnchorCount) } : {}),
      ...(typeof candidateSourceFloorEvidence.requiredNumericAnchorCount === 'number' ? { requiredNumericAnchorCount: safeNonNegativeInteger(candidateSourceFloorEvidence.requiredNumericAnchorCount) } : {}),
      ...(typeof candidateSourceFloorEvidence.missingNumericAnchorCount === 'number' ? { missingNumericAnchorCount: safeNonNegativeInteger(candidateSourceFloorEvidence.missingNumericAnchorCount) } : {}),
      ...(candidateSourceFloorEvidence.durationDiagnosticStatus ? { durationDiagnosticStatus: candidateSourceFloorEvidence.durationDiagnosticStatus } : {}),
      ...(typeof candidateSourceFloorEvidence.transformableDutyAvailable === 'boolean' ? { transformableDutyAvailable: candidateSourceFloorEvidence.transformableDutyAvailable } : {}),
      ...(typeof candidateSourceFloorEvidence.predicateReplacementEligible === 'boolean' ? { predicateReplacementEligible: candidateSourceFloorEvidence.predicateReplacementEligible } : {}),
      ...(typeof candidateSourceFloorEvidence.groundedReplacementRecognized === 'boolean' ? { groundedReplacementRecognized: candidateSourceFloorEvidence.groundedReplacementRecognized } : {}),
      ...(typeof candidateSourceFloorEvidence.newCandidateTokenPresent === 'boolean' ? { newCandidateTokenPresent: candidateSourceFloorEvidence.newCandidateTokenPresent } : {}),
      ...(candidateSourceFloorEvidence.multiFactFallbackResult ? { multiFactFallbackResult: candidateSourceFloorEvidence.multiFactFallbackResult } : {}),
      ...(candidateSourceFloorEvidence.multiFactFallbackFailureReason ? { multiFactFallbackFailureReason: candidateSourceFloorEvidence.multiFactFallbackFailureReason } : {}),
      ...(typeof candidateSourceFloorEvidence.multiFactFallbackFailedFactIndex === 'number' ? { multiFactFallbackFailedFactIndex: safeNonNegativeInteger(candidateSourceFloorEvidence.multiFactFallbackFailedFactIndex) } : {}),
    }
    : {};
  const sourceLockEvidence = candidateSourceFloorEvidence?.writerOutputContractFailureClass === 'source_lock_preservation'
    ? {
      ...(candidateSourceFloorEvidence.sourceLockFailureKind ? { sourceLockFailureKind: candidateSourceFloorEvidence.sourceLockFailureKind } : {}),
      ...(candidateSourceFloorEvidence.sourceLockFailureReason ? { sourceLockFailureReason: candidateSourceFloorEvidence.sourceLockFailureReason } : {}),
      ...(typeof candidateSourceFloorEvidence.sourceLockFailedIndex === 'number' ? { sourceLockFailedIndex: safeNonNegativeInteger(candidateSourceFloorEvidence.sourceLockFailedIndex) } : {}),
    }
    : {};
  const lockFailure = input.result.kind === 'handled_failure'
    && input.result.typedReason === 'lost_source_fact'
    && candidateSourceFloorEvidence?.writerOutputContractFailureClass === 'source_lock_preservation'
    ? candidateSourceFloorEvidence : null;
  const bindingCount = (value: unknown): number | null => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= 0 && value <= SUMMARY_V3_STYLE_MAX_TOTAL_FACTS ? value : null;
  const requiredBindingCount = bindingCount(lockFailure?.sourceLockRequiredFactBindingCount);
  const declaredBindingCount = bindingCount(lockFailure?.sourceLockDeclaredFactBindingCount);

  return {
    event: SUMMARY_STRONGER_TERMINAL_EVENT_NAME,
    requestCorrelationId: safeRequestId(input.requestId),
    operation: 'summary_style',
    style: 'stronger',
    mode: input.mode,
    requestedLocale: safeLocale(input.requestedLocale),
    httpStatus: safeHttpStatus(input.httpStatus),
    terminalLayer: styleTerminalLayer(input.result),
    terminalReason,
    writerAttempted,
    writerResult: styleWriterResult(input.result),
    writerCandidateReachedValidation: evidence?.writerCandidateReachedValidation === true,
    writerFailureClass: evidence?.writerOutputContractFailureClass ?? null,
    coveredFactCount: evidence && 'coveredFactCount' in evidence
      ? safeNonNegativeInteger(evidence.coveredFactCount)
      : null,
    missingFactCount: evidence && 'missingFactCount' in evidence
      ? safeNonNegativeInteger(evidence.missingFactCount)
      : null,
    evaluatorTerminalPhase: candidateSourceFloorEvidence?.evaluatorTerminalPhase
      && SUMMARY_V3_STYLE_M5_PHASES.includes(candidateSourceFloorEvidence.evaluatorTerminalPhase)
      ? candidateSourceFloorEvidence.evaluatorTerminalPhase : null,
    evaluatorViolationCode: isSummaryV3StyleViolationCode(candidateSourceFloorEvidence?.evaluatorViolationCode)
      ? candidateSourceFloorEvidence.evaluatorViolationCode : null,
    evaluatorViolationRepairable: typeof candidateSourceFloorEvidence?.evaluatorViolationRepairable === 'boolean'
      ? candidateSourceFloorEvidence.evaluatorViolationRepairable : null,
    postEvaluatorLocalFailureClass: candidateSourceFloorEvidence?.postEvaluatorLocalFailureClass
      && SUMMARY_V3_STYLE_M5_POST_EVALUATOR_LOCAL_FAILURE_CLASSES.includes(candidateSourceFloorEvidence.postEvaluatorLocalFailureClass)
      ? candidateSourceFloorEvidence.postEvaluatorLocalFailureClass : null,
    ...readSummaryStyleLocalDiagnostics(input.result),
    ...sourceFloorEvidence,
    ...sourceLockEvidence,
    sourceLockOrigin: lockFailure
      ? lockFailure.sourceLockOrigin && SUMMARY_V3_STYLE_SOURCE_LOCK_ORIGINS.includes(lockFailure.sourceLockOrigin)
        ? lockFailure.sourceLockOrigin : 'unknown'
      : null,
    sourceLockSurfaceMatchClass: lockFailure
      ? lockFailure.sourceLockSurfaceMatchClass && SUMMARY_V3_STYLE_SOURCE_LOCK_SURFACE_MATCH_CLASSES.includes(lockFailure.sourceLockSurfaceMatchClass)
        ? lockFailure.sourceLockSurfaceMatchClass : 'not_applicable'
      : null,
    sourceLockRequiredFactBindingCount: requiredBindingCount,
    sourceLockDeclaredFactBindingCount: requiredBindingCount !== null && declaredBindingCount !== null && declaredBindingCount <= requiredBindingCount
      ? declaredBindingCount : null,
    repairAttempted,
    repairProviderRequestAttempted: styleRepairProviderRequestAttempted(input.result),
    evaluatorAttempted: evidence?.evaluatorReached === true
      || providerFailure?.phase === 'initial_evaluator'
      || providerFailure?.phase === 'post_repair_evaluator',
    finalApplyEligible: input.result.kind === 'candidate_ready',
    usageDecision: styleUsageDecision(input.result),
  };
}

/** Logging is observational and must never alter the HTTP response or decision. */
export function emitSummaryStrongerTerminalDiagnostic(
  input: SummaryStrongerTerminalDiagnosticInput,
): SummaryStrongerTerminalDiagnosticEvent {
  const event = createSummaryStrongerTerminalDiagnostic(input);
  try {
    console.info(JSON.stringify(event));
  } catch {
    // A logging failure is deliberately non-interfering.
  }
  return event;
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

function transportTerminationKind(
  providerFailure: SummaryV3ProviderFailureEnvelope | null,
): SummaryV3TransportTerminationKind {
  if (!providerFailure) return 'unknown';

  if (providerFailure.providerErrorType === 'timeout') {
    if (providerFailure.providerDeadlineOwner === 'route_deadline') {
      return 'route_budget_timeout';
    }
    if (providerFailure.providerDeadlineOwner === 'client_abort'
      || providerFailure.errorClass === 'APIUserAbortError') {
      return 'client_abort';
    }
    if (providerFailure.providerDeadlineOwner === 'provider_transport'
      || providerFailure.providerDeadlineOwner === 'verifier_transport'
      || providerFailure.providerDeadlineOwner === 'translation_transport') {
      return 'application_slice_timeout';
    }
    if (providerFailure.errorClass === 'APIConnectionTimeoutError') {
      return 'sdk_timeout';
    }
  }

  const httpErrorType = providerFailure.providerErrorType === 'invalid_request'
    || providerFailure.providerErrorType === 'authentication'
    || providerFailure.providerErrorType === 'permission'
    || providerFailure.providerErrorType === 'rate_limit'
    || providerFailure.providerErrorType === 'provider_5xx';
  if (providerFailure.providerHttpStatus !== null
    || providerFailure.providerHttpResponseReceived === true && httpErrorType) {
    return 'provider_http_error';
  }
  if (providerFailure.providerErrorType === 'connection/network'
    || providerFailure.errorClass === 'APIConnectionError') {
    return 'network_error';
  }
  return 'unknown';
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
      transportTerminationKind: 'unknown',
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
    transportTerminationKind: transportTerminationKind(providerFailure),
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
