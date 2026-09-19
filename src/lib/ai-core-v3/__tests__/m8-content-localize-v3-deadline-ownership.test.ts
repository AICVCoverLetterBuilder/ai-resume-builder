import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AI_PROVIDER_CALL_TIMEOUT_MS,
  AI_RESPONSE_GUARD_MS,
  CONTENT_LOCALIZE_V3_CLIENT_TIMEOUT_MS,
  CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS,
  callProviderWithDeadline,
  readLocalDeadlineProvenance,
} from '../../ai-request-timing';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import type { ContentLocalizeM6Snapshot } from '../content-localize-m6';
import { executeContentLocalizeM6Server } from '../content-localize-m6-server';
import {
  buildContentLocalizeV3TerminalDiagnostic,
  createEmptyContentLocalizeV3ServerDiagnostic,
} from '../content-localize-v3-terminal-diagnostics';

function snapshot(): ContentLocalizeM6Snapshot {
  const sourceText = 'A grounded summary.';
  return {
    operationId: 'deadline-operation',
    requestId: 'deadline-request',
    kind: 'summary',
    sourceLocale: 'de',
    targetLocale: 'fr',
    sourceText,
    sourceTextHash: hashSummarySourceLocaleText(sourceText),
  };
}

describe('content-localize-v3 deadline ownership', () => {
  it('T1: provider timer owns its deadline and emits explicit provenance', async () => {
    vi.useFakeTimers();
    try {
      const pending = callProviderWithDeadline(() => new Promise<never>(() => undefined));
      const rejection = pending.catch((error) => error);
      await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS);
      await expect(rejection).resolves.toMatchObject({ name: 'AbortError', deadlineOwner: 'provider_transport' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('A: the real provider timer reaches the server as provider_call', async () => {
    vi.useFakeTimers();
    try {
      const resultPromise = executeContentLocalizeM6Server(snapshot(), {
        writer: () => callProviderWithDeadline(() => new Promise<never>(() => undefined)),
        evaluator: async () => ({}),
        repair: async () => ({}),
      });
      await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS);
      const result = await resultPromise;
      expect(result).toMatchObject({ status: 'handled_failure', reason: 'deadline_exceeded' });
      expect((result as { diagnostic: Record<string, unknown> }).diagnostic).toMatchObject({
        deadlineExceeded: true,
        deadlineOwner: 'provider_call',
        deadlinePhase: 'writer',
        providerCallTimeoutMs: AI_PROVIDER_CALL_TIMEOUT_MS,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('B: the real nearer route timer reaches the server as route_budget', async () => {
    vi.useFakeTimers();
    try {
      const routeStartedAt = Date.now();
      const routeDeadline = routeStartedAt + 9_000;
      const resultPromise = executeContentLocalizeM6Server(snapshot(), {
        writer: () => callProviderWithDeadline(() => new Promise<never>(() => undefined), routeDeadline),
        evaluator: async () => ({}),
        repair: async () => ({}),
      }, { routeStartedAt, routeBudgetMs: CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS });
      await vi.advanceTimersByTimeAsync(9_001);
      const result = await resultPromise;
      expect(result).toMatchObject({ status: 'handled_failure', reason: 'deadline_exceeded' });
      expect((result as { diagnostic: Record<string, unknown> }).diagnostic).toMatchObject({
        deadlineExceeded: true,
        deadlineOwner: 'route_budget',
        deadlinePhase: 'writer',
        routeBudgetMs: CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('T2/T5: a nearer shared route budget wins deterministically', async () => {
    vi.useFakeTimers();
    try {
      const start = Date.now();
      const pending = callProviderWithDeadline(() => new Promise<never>(() => undefined), start + 9_000);
      const rejection = pending.catch((error) => error);
      await vi.advanceTimersByTimeAsync(7_001);
      const error = await rejection;
      expect(error).toMatchObject({ name: 'AbortError', deadlineOwner: 'route_deadline' });
      expect(readLocalDeadlineProvenance(error)).toMatchObject({ deadlineExceeded: true, deadlineOwner: 'route_budget' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('T3/T4: an upstream AbortError without local provenance is transport failure', async () => {
    const upstreamAbort = Object.assign(new Error('upstream closed'), {
      name: 'AbortError', deadlineExceeded: true, deadlineOwner: 'provider_call',
    });
    await expect(callProviderWithDeadline(async () => { throw upstreamAbort; }, null)).rejects.toBe(upstreamAbort);
    await expect(executeContentLocalizeM6Server(snapshot(), {
      writer: async () => { throw upstreamAbort; },
      evaluator: async () => ({}),
      repair: async () => ({}),
    })).resolves.toMatchObject({ status: 'handled_failure', reason: 'writer_failed' });
    expect(readLocalDeadlineProvenance(upstreamAbort)).toMatchObject({ deadlineExceeded: false, deadlineOwner: 'unknown' });
  });

  it('D: contradictory raw timeout fields cannot override authoritative unowned evidence', async () => {
    const misleading = Object.assign(new Error('upstream closed'), {
      name: 'AbortError', deadlineExceeded: true, deadlineOwner: 'provider_call',
    });
    let authoritativeError: unknown;
    try {
      await callProviderWithDeadline(async () => { throw misleading; }, null);
      throw new Error('expected callProviderWithDeadline to reject');
    } catch (error) {
      authoritativeError = error;
      expect(error).toBe(misleading);
    }
    const result = await executeContentLocalizeM6Server(snapshot(), {
      writer: async () => { throw authoritativeError; },
      evaluator: async () => ({}),
      repair: async () => ({}),
    });
    expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_failed' });
    expect((result as { diagnostic: Record<string, unknown> }).diagnostic).toMatchObject({
      deadlineExceeded: false,
      deadlineOwner: 'unknown',
      deadlinePhase: null,
    });
  });

  it('E: raw timeout-shaped fields without canonical provenance are non-deadline', async () => {
    for (const owner of ['provider_call', 'route_budget'] as const) {
      const rawOnly = Object.assign(new Error(`raw ${owner}`), {
        name: 'AbortError',
        deadlineExceeded: true,
        deadlineOwner: owner,
      });
      expect(readLocalDeadlineProvenance(rawOnly)).toBeNull();
      const result = await executeContentLocalizeM6Server(snapshot(), {
        writer: async () => { throw rawOnly; },
        evaluator: async () => ({}),
        repair: async () => ({}),
      });
      expect(result).toMatchObject({ status: 'handled_failure', reason: 'writer_failed' });
      expect((result as { diagnostic: Record<string, unknown> }).diagnostic).toMatchObject({
        deadlineExceeded: false,
        deadlineOwner: 'unknown',
        deadlinePhase: null,
      });
      const terminal = buildContentLocalizeV3TerminalDiagnostic({
        snapshot: snapshot(),
        operation: 'summary_translate',
        routeHttpStatus: 502,
        serverDiagnostic: (result as { diagnostic: Parameters<typeof buildContentLocalizeV3TerminalDiagnostic>[0]['serverDiagnostic'] }).diagnostic,
        finalDecision: 'transport_failure',
        applyAuthorized: false,
        applyAttempted: false,
        applyCommitted: false,
        persistenceAttempted: false,
        persistenceResult: 'not_attempted',
        raceGuardResult: 'not_evaluated',
        usageBefore: 11,
        usageAfter: 11,
      });
      expect(terminal).toMatchObject({
        applyAuthorized: false,
        persistenceAttempted: false,
        usageDelta: 0,
        fallbackUsed: false,
      });
    }
  });

  it('T6-T10: both clients and all four phases fit the content-localize budget', () => {
    const fourPhases = AI_PROVIDER_CALL_TIMEOUT_MS * 4;
    expect(fourPhases + AI_RESPONSE_GUARD_MS).toBeLessThan(CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS);
    expect(CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS).toBeLessThan(CONTENT_LOCALIZE_V3_CLIENT_TIMEOUT_MS);
    expect(CONTENT_LOCALIZE_V3_CLIENT_TIMEOUT_MS).toBeLessThan(90_000);
    const routeSource = readFileSync('src/app/api/generate/route.ts', 'utf8');
    const pageSource = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    expect(routeSource).toContain("action === 'content-localize-v3'");
    expect(routeSource).toContain('computeContentLocalizeV3Deadline(serverReceivedAt)');
    expect(pageSource.match(/resolveClientAbortTimeoutMs\(CONTENT_LOCALIZE_V3_CLIENT_TIMEOUT_MS\)/g)).toHaveLength(2);
    expect(pageSource).toContain('runContentLocalizeV3ExperienceClientOperation');
  });

  it('T11-T13: diagnostics expose bounded ownership and preserve fail-closed invariants', () => {
    const server = {
      ...createEmptyContentLocalizeV3ServerDiagnostic(),
      deadlineExceeded: true,
      deadlineOwner: 'provider_call' as const,
      deadlinePhase: 'writer' as const,
      providerCallTimeoutMs: AI_PROVIDER_CALL_TIMEOUT_MS,
      routeBudgetMs: CONTENT_LOCALIZE_V3_ROUTE_BUDGET_MS,
      providerElapsedMs: 8_000,
      routeElapsedMs: 8_100,
    };
    const diagnostic = buildContentLocalizeV3TerminalDiagnostic({
      snapshot: snapshot(), operation: 'summary_translate', routeHttpStatus: 504,
      serverDiagnostic: server, finalDecision: 'deadline_exceeded',
      applyAuthorized: false, applyAttempted: false, applyCommitted: false,
      persistenceAttempted: false, persistenceResult: 'not_attempted',
      raceGuardResult: 'not_evaluated', usageBefore: 11, usageAfter: 11,
    });
    expect(diagnostic).toMatchObject({
      deadlineExceeded: true, deadlineOwner: 'provider_call', deadlinePhase: 'writer',
      applyAuthorized: false, applyAttempted: false, persistenceAttempted: false,
      usageDelta: 0, fallbackUsed: false,
    });
    expect(JSON.stringify(diagnostic)).not.toContain('A grounded summary.');
  });
});
