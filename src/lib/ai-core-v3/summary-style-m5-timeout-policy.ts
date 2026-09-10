import type { SummaryV3StyleProviderPhase } from './summary-style-m5-provider';

/**
 * M5 strict-tool timeout authority.
 *
 * Both the writer and evaluator may be the first use of their respective
 * strict schema. Their combined normal-path allowance therefore leaves a
 * separate application/transport margin inside the overall route budget.
 * Repair remains the existing short, bounded post-validation path and never
 * acts as a timeout retry.
 */
export const SUMMARY_V3_STYLE_M5_INITIAL_WRITER_TIMEOUT_MS = 30_000;
export const SUMMARY_V3_STYLE_M5_INITIAL_EVALUATOR_TIMEOUT_MS = 30_000;
export const SUMMARY_V3_STYLE_M5_REPAIR_TIMEOUT_MS = 8_000;
export const SUMMARY_V3_STYLE_M5_OVERALL_SERVER_BUDGET_MS = 75_000;
export const SUMMARY_V3_STYLE_M5_CLIENT_ABORT_TIMEOUT_MS = 85_000;
/** Must stay synchronized with the static Next route export. */
export const SUMMARY_V3_STYLE_M5_ROUTE_MAX_DURATION_S = 90;

export const SUMMARY_V3_STYLE_M5_EXPECTED_OVERHEAD_MARGIN_MS =
  SUMMARY_V3_STYLE_M5_OVERALL_SERVER_BUDGET_MS
  - SUMMARY_V3_STYLE_M5_INITIAL_WRITER_TIMEOUT_MS
  - SUMMARY_V3_STYLE_M5_INITIAL_EVALUATOR_TIMEOUT_MS;

export const SUMMARY_V3_STYLE_M5_PLATFORM_MARGIN_MS =
  SUMMARY_V3_STYLE_M5_ROUTE_MAX_DURATION_S * 1_000
  - SUMMARY_V3_STYLE_M5_OVERALL_SERVER_BUDGET_MS;

export function computeSummaryV3StyleM5ServerDeadline(requestStartedAt: number): number {
  return requestStartedAt + SUMMARY_V3_STYLE_M5_OVERALL_SERVER_BUDGET_MS;
}

export function summaryV3StyleM5TimeoutForPhase(phase: SummaryV3StyleProviderPhase): number {
  if (phase === 'initial_writer') return SUMMARY_V3_STYLE_M5_INITIAL_WRITER_TIMEOUT_MS;
  if (phase === 'initial_evaluator') return SUMMARY_V3_STYLE_M5_INITIAL_EVALUATOR_TIMEOUT_MS;
  return SUMMARY_V3_STYLE_M5_REPAIR_TIMEOUT_MS;
}

export function resolveSummaryV3StyleM5ClientAbortTimeoutMs(): number {
  return SUMMARY_V3_STYLE_M5_CLIENT_ABORT_TIMEOUT_MS;
}
