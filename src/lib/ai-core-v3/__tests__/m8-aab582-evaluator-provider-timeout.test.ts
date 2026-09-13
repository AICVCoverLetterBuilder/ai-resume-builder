import { describe, expect, it, vi } from 'vitest';
import {
  callProviderWithDeadline,
  readProviderTimingEvidence,
  type ProviderCallOptions,
} from '../../ai-request-timing';
import {
  SUMMARY_V3_INITIAL_EVALUATOR_HARD_MAX_MS,
  SUMMARY_V3_INITIAL_EVALUATOR_TIMEOUT_MS,
  SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS,
  SUMMARY_V3_EVALUATOR_DISPATCH_SAFETY_MS,
  SUMMARY_V3_POST_EVALUATOR_RESERVE_MS,
  SUMMARY_V3_POST_PROCESSING_HEADROOM_MS,
  SUMMARY_V3_ROUTE_MAX_DURATION_S,
  SUMMARY_V3_SERVER_BUDGET_MS,
  computeSummaryV3EvaluatorTimeoutMs,
} from '../summary-generate-server';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function runEvaluator(
  writerElapsedMs: number,
  evaluatorDelayMs: number,
): Promise<{
  readonly timeoutMs: number | null;
  readonly result: 'resolved' | 'rejected';
  readonly error: unknown;
  readonly create: ReturnType<typeof vi.fn>;
}> {
  const deadlineAt = SUMMARY_V3_SERVER_BUDGET_MS;
  vi.setSystemTime(writerElapsedMs);
  const timeoutMs = computeSummaryV3EvaluatorTimeoutMs(deadlineAt);
  const create = vi.fn(async (_options: ProviderCallOptions) => {
    await delay(evaluatorDelayMs);
    return 'evaluator-ok';
  });
  if (timeoutMs === null) {
    return { timeoutMs, result: 'rejected', error: new Error('no dispatch window'), create };
  }
  const pending = callProviderWithDeadline(create, deadlineAt, timeoutMs, 'verifier')
    .then(() => ({ result: 'resolved' as const, error: undefined }))
    .catch((error: unknown) => ({ result: 'rejected' as const, error }));
  await vi.advanceTimersByTimeAsync(evaluatorDelayMs);
  const outcome = await pending;
  return { timeoutMs, ...outcome, create };
}

describe('M8 AAB582 initial-evaluator provider timeout repair', () => {
  it('derives one dynamic evaluator authority and preserves the required deadline order', () => {
    expect(SUMMARY_V3_INITIAL_EVALUATOR_TIMEOUT_MS).toBe(20_000);
    expect(SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS).toBe(13_000);
    expect(SUMMARY_V3_POST_EVALUATOR_RESERVE_MS).toBe(4_000);
    expect(SUMMARY_V3_POST_EVALUATOR_RESERVE_MS).toBe(SUMMARY_V3_POST_PROCESSING_HEADROOM_MS);
    expect(SUMMARY_V3_EVALUATOR_DISPATCH_SAFETY_MS).toBe(1);
    expect(SUMMARY_V3_INITIAL_EVALUATOR_HARD_MAX_MS).toBe(33_999);
    expect(SUMMARY_V3_INITIAL_EVALUATOR_HARD_MAX_MS + SUMMARY_V3_POST_EVALUATOR_RESERVE_MS)
      .toBe(SUMMARY_V3_SERVER_BUDGET_MS - SUMMARY_V3_EVALUATOR_DISPATCH_SAFETY_MS);
    expect(SUMMARY_V3_INITIAL_WRITER_TIMEOUT_MS).toBeLessThan(SUMMARY_V3_SERVER_BUDGET_MS);
    expect(SUMMARY_V3_SERVER_BUDGET_MS).toBeLessThan(SUMMARY_V3_ROUTE_MAX_DURATION_S * 1_000);
    expect(SUMMARY_V3_ROUTE_MAX_DURATION_S).toBe(45);
  });

  it('reuses early-writer slack while leaving the explicit post-evaluator reserve', () => {
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 0)).toBe(33_999);
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 5_489)).toBe(28_510);
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 12_999)).toBe(21_000);
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 13_000)).toBe(20_999);
    expect(computeSummaryV3EvaluatorTimeoutMs(SUMMARY_V3_SERVER_BUDGET_MS, 34_001)).toBeNull();
  });

  it('accepts the physical-like evaluator at 19,999ms and the repaired 20,001ms case', async () => {
    vi.useFakeTimers();
    try {
      const physicalLike = await runEvaluator(5_489, 19_999);
      expect(physicalLike.timeoutMs).toBe(28_510);
      expect(physicalLike.result).toBe('resolved');
      expect(physicalLike.create).toHaveBeenCalledTimes(1);

      const repairedBoundary = await runEvaluator(5_489, 20_001);
      expect(repairedBoundary.timeoutMs).toBe(28_510);
      expect(repairedBoundary.result).toBe('resolved');
      expect(repairedBoundary.create).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts just below the repaired dynamic limit and fails closed above it', async () => {
    vi.useFakeTimers();
    try {
      const below = await runEvaluator(5_489, 28_509);
      expect(below.timeoutMs).toBe(28_510);
      expect(below.result).toBe('resolved');

      const above = await runEvaluator(5_489, 28_512);
      expect(above.timeoutMs).toBe(28_510);
      expect(above.result).toBe('rejected');
      expect(above.error).toMatchObject({ name: 'AbortError', deadlineOwner: 'verifier_transport',
        configuredTimeoutMs: 28_510, effectiveTimeoutMs: 28_510 });
      expect(readProviderTimingEvidence(above.error)).toMatchObject({
        configuredTimeoutMs: 28_510, effectiveTimeoutMs: 28_510,
        outerBudgetRemainingAtStartMs: 32_511,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('clamps a near-maximum writer to a safe evaluator window with no retry', async () => {
    vi.useFakeTimers();
    try {
      const nearMax = await runEvaluator(12_999, 20_999);
      expect(nearMax.timeoutMs).toBe(21_000);
      expect(nearMax.result).toBe('resolved');
      expect(nearMax.create).toHaveBeenCalledTimes(1);

      const overNearMax = await runEvaluator(13_000, 21_001);
      expect(overNearMax.timeoutMs).toBe(20_999);
      expect(overNearMax.result).toBe('rejected');
      expect(overNearMax.create).toHaveBeenCalledTimes(1);
      expect(overNearMax.error).toMatchObject({ name: 'AbortError', deadlineOwner: 'verifier_transport' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed without dispatch when the explicit reserve leaves no provider window', () => {
    expect(computeSummaryV3EvaluatorTimeoutMs(38_000, 37_001)).toBeNull();
    expect(computeSummaryV3EvaluatorTimeoutMs(38_000, 37_000)).toBeNull();
  });
});
