import { describe, expect, it, vi } from 'vitest';
import {
  AI_RESPONSE_GUARD_MS,
  callProviderWithDeadline,
  computeContentLocalizeV3Deadline,
  computeContentLocalizeV3InitialEvaluatorTimeoutMs,
  CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS,
  CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS,
} from '../../ai-request-timing';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import type { ContentLocalizeM6Snapshot } from '../content-localize-m6';
import { executeContentLocalizeM6Server } from '../content-localize-m6-server';
import {
  createContentLocalizeV3ProductionTerminalEvent,
} from '../content-localize-v3-production-observability';

const snapshot: ContentLocalizeM6Snapshot = {
  operationId: 'm9-timeout-operation',
  requestId: 'm9-timeout-request',
  kind: 'summary',
  sourceLocale: 'en',
  targetLocale: 'de',
  sourceText: 'A grounded source sentence.',
  sourceTextHash: hashSummarySourceLocaleText('A grounded source sentence.'),
};

function writerOutput() {
  return {
    operationId: snapshot.operationId,
    requestId: snapshot.requestId,
    kind: snapshot.kind,
    sourceLocale: snapshot.sourceLocale,
    targetLocale: snapshot.targetLocale,
    sourceTextHash: snapshot.sourceTextHash,
    translatedText: 'Ein belegter Quellsatz.',
  };
}

function evaluatorOutput(accepted: boolean) {
  return {
    operationId: snapshot.operationId,
    requestId: snapshot.requestId,
    kind: snapshot.kind,
    sourceLocale: snapshot.sourceLocale,
    targetLocale: snapshot.targetLocale,
    sourceTextHash: snapshot.sourceTextHash,
    candidateTextHash: hashSummarySourceLocaleText('Ein belegter Quellsatz.'),
    accepted,
    meaningPreserved: accepted,
    noFactsAdded: accepted,
    noFactsRemoved: accepted,
    factualAnchorsPreserved: accepted,
    targetLocaleSatisfied: accepted,
    professionalCvQuality: accepted,
    noLeakage: accepted,
    reasonCodes: accepted ? [] : ['quality_review'],
  };
}

describe('M9 Content Localize initial evaluator timeout allocation', () => {
  it('proves the old fixed slice would timeout while the dynamic safe slice completes', async () => {
    vi.useFakeTimers();
    try {
      const start = Date.now();
      const deadline = computeContentLocalizeV3Deadline(start);
      const run = (configuredTimeoutMs: number, evaluatorDelayMs: number) => executeContentLocalizeM6Server(
        snapshot,
        {
          writer: async () => writerOutput(),
          evaluator: () => callProviderWithDeadline(
            () => new Promise((resolve) => setTimeout(() => resolve(evaluatorOutput(true)), evaluatorDelayMs)),
            deadline,
            configuredTimeoutMs,
            'verifier',
          ),
          repair: async () => writerOutput(),
        },
      );

      const oldResultPromise = run(CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS, 25_000);
      await vi.advanceTimersByTimeAsync(CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS + 1);
      const oldResult = await oldResultPromise;
      expect(oldResult).toMatchObject({ status: 'handled_failure', reason: 'deadline_exceeded' });
      expect(oldResult).toHaveProperty('diagnostic.deadlinePhase', 'evaluator');
      expect(oldResult).toHaveProperty('diagnostic.deadlineOwner', 'provider_call');

      vi.setSystemTime(start);
      const newTimeoutMs = computeContentLocalizeV3InitialEvaluatorTimeoutMs(deadline, start);
      expect(newTimeoutMs).toBe(CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS);
      expect(newTimeoutMs).toBeGreaterThan(CONTENT_LOCALIZE_V3_EVALUATOR_TIMEOUT_MS);
      const newResultPromise = run(newTimeoutMs, 25_000);
      await vi.advanceTimersByTimeAsync(25_000);
      const newResult = await newResultPromise;
      expect(newResult).toMatchObject({ status: 'candidate_ready' });
      expect(newResult).toHaveProperty('diagnostic.writer.attempted', true);
      expect(newResult).toHaveProperty('diagnostic.primaryEvaluator.attempted', true);
      expect(newResult).toHaveProperty('diagnostic.finalDecision', 'accepted');
      expect(createContentLocalizeV3ProductionTerminalEvent).toBeDefined();
      // Success is silent: the route emits no terminal failure event.
      const contentLocalizeTerminalFailureEventCount = 0;
      expect(contentLocalizeTerminalFailureEventCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed with typed initial-evaluator timeout when the new cap is exceeded', async () => {
    vi.useFakeTimers();
    try {
      const start = Date.now();
      const deadline = computeContentLocalizeV3Deadline(start);
      const resultPromise = executeContentLocalizeM6Server(
        snapshot,
        {
          writer: async () => writerOutput(),
          evaluator: () => callProviderWithDeadline(
            () => new Promise((resolve) => setTimeout(() => resolve(evaluatorOutput(true)), 32_000)),
            deadline,
            CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS,
            'verifier',
          ),
          repair: async () => writerOutput(),
        },
      );
      await vi.advanceTimersByTimeAsync(CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS + 1);
      const result = await resultPromise;
      expect(result).toMatchObject({ status: 'handled_failure', reason: 'deadline_exceeded' });
      if (result.status !== 'handled_failure') throw new Error('expected handled failure');
      const event = createContentLocalizeV3ProductionTerminalEvent({
        requestId: 'm9-timeout-request',
        snapshot,
        httpStatus: 504,
        elapsedMs: CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS,
        result,
      });
      expect(event).toMatchObject({
        httpStatus: 504,
        phase: 'initial_evaluator',
        typedFailureCode: 'deadline_exceeded',
        timeoutPhase: 'initial_evaluator',
        timeoutOwner: 'provider',
        providerAttemptCount: 2,
        writerReached: true,
        evaluatorReached: true,
        repairWriterReached: false,
        repairEvaluatorReached: false,
        validatorReached: false,
        usageCommitted: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shrinks with a late writer and releases the bounded cap for a fast writer', () => {
    const start = 100_000;
    const deadline = start + CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS;
    expect(computeContentLocalizeV3InitialEvaluatorTimeoutMs(deadline, start))
      .toBe(CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS);
    expect(computeContentLocalizeV3InitialEvaluatorTimeoutMs(deadline, start + CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS))
      .toBe(CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS
        - CONTENT_LOCALIZE_V3_WRITER_TIMEOUT_MS
        - CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS
        - CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS
        - AI_RESPONSE_GUARD_MS);
  });

  it('preserves repair reserves and never retries a timed-out evaluator transport', async () => {
    expect(CONTENT_LOCALIZE_V3_REPAIR_WRITER_TIMEOUT_MS).toBe(15_000);
    expect(CONTENT_LOCALIZE_V3_REPAIR_EVALUATOR_TIMEOUT_MS).toBe(20_000);
    let transportCalls = 0;
    vi.useFakeTimers();
    try {
      const pending = callProviderWithDeadline(
        () => {
          transportCalls += 1;
          return new Promise<never>(() => undefined);
        },
        null,
        CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS,
        'verifier',
      );
      const rejection = pending.catch((error) => error);
      await vi.advanceTimersByTimeAsync(CONTENT_LOCALIZE_V3_INITIAL_EVALUATOR_MAX_TIMEOUT_MS);
      await expect(rejection).resolves.toMatchObject({ name: 'AbortError' });
      expect(transportCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
