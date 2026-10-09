import {
  SUMMARY_V3_STYLE_M5_PHASES,
  isSummaryV3StyleViolationCode,
  type SummaryV3StylePhase,
  type SummaryV3StyleResult,
  type SummaryV3StyleViolationCode,
} from './summary-style-m5';

export const SUMMARY_STYLE_REPAIR_FAILURE_CLASSES = [
  'writer_transport_malformed', 'candidate_malformed', 'lost_source_fact',
  'writer_identity_mismatch', 'other_finite_known_class',
] as const;
export const SUMMARY_STYLE_REPAIR_FAILURE_OWNERS = [
  'repair_writer_envelope', 'repair_writer_candidate_structure',
  'repair_writer_source_validation', 'repair_writer_identity', 'repair_writer_parser_other',
] as const;

export interface SummaryStyleRepairDiagnostics {
  readonly initialEvaluatorPhase: SummaryV3StylePhase | null;
  readonly initialEvaluatorViolationCode: SummaryV3StyleViolationCode | null;
  readonly initialEvaluatorViolationRepairable: boolean | null;
  readonly repairFailureClass: (typeof SUMMARY_STYLE_REPAIR_FAILURE_CLASSES)[number] | null;
  readonly repairFailureOwner: (typeof SUMMARY_STYLE_REPAIR_FAILURE_OWNERS)[number] | null;
}

// Process-local, log-only facts. The result JSON, provider input, and the
// historical Summary diagnostic sidecar remain byte-identical.
const repairDiagnostics = new WeakMap<object, SummaryStyleRepairDiagnostics>();
const finite = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && allowed.includes(value as T) ? value as T : null;

export function recordSummaryStyleRepairDiagnostics(
  result: SummaryV3StyleResult,
  value: SummaryStyleRepairDiagnostics,
): SummaryV3StyleResult {
  repairDiagnostics.set(result, Object.freeze({
    initialEvaluatorPhase: finite(value.initialEvaluatorPhase, SUMMARY_V3_STYLE_M5_PHASES),
    initialEvaluatorViolationCode: isSummaryV3StyleViolationCode(value.initialEvaluatorViolationCode)
      ? value.initialEvaluatorViolationCode : null,
    initialEvaluatorViolationRepairable: typeof value.initialEvaluatorViolationRepairable === 'boolean'
      ? value.initialEvaluatorViolationRepairable : null,
    repairFailureClass: finite(value.repairFailureClass, SUMMARY_STYLE_REPAIR_FAILURE_CLASSES),
    repairFailureOwner: finite(value.repairFailureOwner, SUMMARY_STYLE_REPAIR_FAILURE_OWNERS),
  }));
  return result;
}

export function readSummaryStyleRepairDiagnostics(result: object): SummaryStyleRepairDiagnostics | null {
  return repairDiagnostics.get(result) ?? null;
}
