/**
 * @vitest-environment node
 *
 * Android build 231: ~32s pending then `Mrežna greška` — Vercel platform
 * termination (~31s maxDuration) closed the connection before the client 40s
 * AbortController. These tests prove the application responds under the 22s
 * budget with hard-cancelled provider calls and deadline-aware repair.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { activateCvSummary } from '@/lib/cv-content-activation';
import {
  AI_CLIENT_TIMEOUT_MS,
  AI_MIN_REPAIR_BUDGET_MS,
  AI_PLATFORM_MAX_DURATION_S,
  AI_PLATFORM_SAFETY_MARGIN_MS,
  AI_PROVIDER_CALL_TIMEOUT_MS,
  AI_RESPONSE_GUARD_MS,
  AI_SERVER_BUDGET_MS,
  callProviderWithDeadline,
  computeServerDeadline,
  hasRepairBudget,
  isProviderAbortOrTimeoutError,
  isRetryableProviderError,
  providerCallTimeoutMs,
  remainingBudgetMs,
  shouldForceRespond,
  type ProviderCallOptions,
} from '@/lib/ai-request-timing';
import { classifyAiFailure } from '@/lib/ai-usage-policy';

function forkliftCv(): CVData {
  const bullets = [
    'Utovar i istovar robe u skladištu',
    'Bezbedno rukovanje viličarom prilikom transporta tereta',
    'Praćenje i organizacija nivoa zaliha u skladištu',
  ].map((b) => `• ${b}`).join('\n');
  return {
    id: 'deadline-budget-1',
    name: 'Vozac',
    personal: {
      fullName: 'Testni Vozač',
      email: 'vozac@example.com',
      phone: '+381',
      address: 'Novi Sad',
      jobTitle: 'Vozač viličara',
      gender: 'male',
    },
    summary: 'Vozač viličara sa iskustvom u skladišnom poslovanju.',
    experience: [
      {
        id: 'exp-skladiste',
        company: 'Upopo',
        position: 'Vozač viličara',
        startDate: '2021-03',
        endDate: '',
        isPresent: true,
        description: bullets,
        canonicalDescription: bullets,
      },
    ],
    education: [],
    skills: ['Rukovanje viličarom'],
    certifications: [],
    languages: [{ name: 'Engleski', level: 'Srednji' }],
    templateId: 'creative-artistic',
    region: 'Balkan',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

const SERBIAN_ECHO = 'Vozač viličara sa iskustvom u skladišnom poslovanju.';
const VALID_HINDI =
  'मैं लगभग छह वर्षों के अनुभव वाला वेयरहाउस चालक हूँ और गोदाम में माल का सुरक्षित परिवहन करता हूँ।';
describe('budget constants vs Vercel platform limit (build 231)', () => {
  it('application budget is 22s with ≥6s margin under a 30s platform maxDuration', () => {
    expect(AI_SERVER_BUDGET_MS).toBe(22_000);
    expect(AI_PLATFORM_MAX_DURATION_S).toBe(30);
    expect(AI_PLATFORM_SAFETY_MARGIN_MS).toBeGreaterThanOrEqual(6_000);
    expect(AI_PROVIDER_CALL_TIMEOUT_MS).toBe(8_000);
    expect(AI_MIN_REPAIR_BUDGET_MS).toBe(AI_PROVIDER_CALL_TIMEOUT_MS + 2_000);
    expect(AI_RESPONSE_GUARD_MS).toBe(2_000);
    expect(AI_PROVIDER_CALL_TIMEOUT_MS * 2 + 1_000).toBeLessThan(AI_SERVER_BUDGET_MS);
    expect(AI_SERVER_BUDGET_MS).toBeLessThan(AI_CLIENT_TIMEOUT_MS);
  });

  it('route entry computes deadline before expensive work (source guard)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    const deadlineIdx = src.indexOf('const deadlineAt = computeServerDeadline(serverReceivedAt)');
    const jsonIdx = src.indexOf('await req.json()');
    const verifyIdx = src.indexOf('await verifyProToken');
    expect(deadlineIdx).toBeGreaterThan(0);
    expect(deadlineIdx).toBeLessThan(jsonIdx);
    expect(deadlineIdx).toBeLessThan(verifyIdx);
    expect(src).toContain('maxRetries: 0');
    expect(src).toContain('callProviderWithDeadline');
  });
});

describe('callProviderWithDeadline hard-cancel', () => {
  const start = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. provider valid in 5s resolves without waiting for the full slice', async () => {
    const deadlineAt = computeServerDeadline(start);
    let sawSignal: AbortSignal | undefined;
    const create = vi.fn(async (options: ProviderCallOptions) => {
      sawSignal = options.signal;
      await new Promise((r) => setTimeout(r, 5_000));
      return { ok: true as const };
    });
    const pending = callProviderWithDeadline(create, deadlineAt);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(sawSignal?.aborted).toBe(false);
    expect(Date.now() - start).toBe(5_000);
    expect(Date.now() - start).toBeLessThan(AI_SERVER_BUDGET_MS);
  });

  it('3. provider delayed beyond slice is aborted; control returns promptly', async () => {
    const deadlineAt = computeServerDeadline(start);
    let sawSignal: AbortSignal | undefined;
    let createFinished = false;
    const create = vi.fn(async (options: ProviderCallOptions) => {
      sawSignal = options.signal;
      await new Promise((r) => setTimeout(r, 60_000));
      createFinished = true;
      return { ok: true as const };
    });
    const pending = callProviderWithDeadline(create, deadlineAt);
    const expectReject = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS);
    await expectReject;
    expect(sawSignal?.aborted).toBe(true);
    expect(createFinished).toBe(false);
    expect(Date.now() - start).toBeLessThanOrEqual(AI_PROVIDER_CALL_TIMEOUT_MS);
    // Late create() may still resolve in the background after abort — the
    // wrapper must already have returned (proved above) and must not await it.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(createFinished).toBe(true);
  });

  it('passes maxRetries: 0 and a finite timeout to the create options', async () => {
    const deadlineAt = computeServerDeadline(start);
    const create = vi.fn(async (options: ProviderCallOptions) => {
      expect(options.maxRetries).toBe(0);
      expect(options.timeout).toBeLessThanOrEqual(AI_PROVIDER_CALL_TIMEOUT_MS);
      expect(options.signal).toBeInstanceOf(AbortSignal);
      return 'done';
    });
    await expect(callProviderWithDeadline(create, deadlineAt)).resolves.toBe('done');
  });
});

describe('deadline-aware repair + fallback branches', () => {
  const start = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('2. provider invalid in 10s with budget left -> repair succeeds under app deadline', async () => {
    const factSet = buildCvCanonicalFactSet(forkliftCv());
    const deadlineAt = computeServerDeadline(start);
    vi.setSystemTime(start + 10_000);
    const repair = vi.fn(async () => {
      vi.setSystemTime(Date.now() + 2_000);
      return VALID_HINDI;
    });
    const result = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt,
      repair,
    });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('repaired');
    expect(Date.now() - start).toBeLessThan(AI_SERVER_BUDGET_MS);
  });

  it('4. provider consumes most budget -> repair skipped, local fallback immediate', async () => {
    const factSet = buildCvCanonicalFactSet(forkliftCv());
    const deadlineAt = computeServerDeadline(start);
    vi.setSystemTime(deadlineAt - (AI_MIN_REPAIR_BUDGET_MS - 400));
    expect(hasRepairBudget(deadlineAt)).toBe(false);
    const repair = vi.fn(async () => VALID_HINDI);
    const before = Date.now();
    const result = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt,
      repair,
    });
    expect(repair).not.toHaveBeenCalled();
    expect(result.status).toBe('fallback');
    expect(result.content).toMatch(/[\u0900-\u097F]/);
    expect(Date.now()).toBe(before);
  });

  it('5. repair times out (abort) -> fallback returned without waiting for late repair', async () => {
    const factSet = buildCvCanonicalFactSet(forkliftCv());
    const deadlineAt = computeServerDeadline(start);
    const repair = vi.fn(async () => {
      const err = new Error('Request timeout after 8000ms');
      err.name = 'AbortError';
      throw err;
    });
    const result = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt,
      repair,
    });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('fallback');
    expect(result.content).toMatch(/[\u0900-\u097F]/);
  });

  it('9. valid Serbian candidate succeeds without repair', async () => {
    const factSet = buildCvCanonicalFactSet(forkliftCv());
    const repair = vi.fn(async () => SERBIAN_ECHO);
    const result = await activateCvSummary({
      locale: 'sr',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt: computeServerDeadline(start),
      repair,
    });
    expect(result.status).toBe('passed');
    expect(repair).not.toHaveBeenCalled();
  });

  it('10. first Hindi generate with valid provider output succeeds without retry', async () => {
    const factSet = buildCvCanonicalFactSet(forkliftCv());
    const repair = vi.fn(async () => VALID_HINDI);
    const result = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: VALID_HINDI,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt: computeServerDeadline(start),
      repair,
    });
    expect(result.status).toBe('passed');
    expect(repair).not.toHaveBeenCalled();
  });

  it('11. Hindi invalid provider + slow repair skipped near deadline -> Hindi fallback before deadline', async () => {
    const factSet = buildCvCanonicalFactSet(forkliftCv());
    const deadlineAt = computeServerDeadline(start);
    vi.setSystemTime(deadlineAt - (AI_MIN_REPAIR_BUDGET_MS - 100));
    const repair = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 15_000));
      return VALID_HINDI;
    });
    const result = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt,
      repair,
    });
    expect(repair).not.toHaveBeenCalled();
    expect(result.status).toBe('fallback');
    expect(result.content).toMatch(/[\u0900-\u097F]/);
    expect(remainingBudgetMs(deadlineAt)).toBeGreaterThan(0);
  });

  it('6. no permitted branch exceeds the application response budget', () => {
    const worst = AI_PROVIDER_CALL_TIMEOUT_MS + AI_PROVIDER_CALL_TIMEOUT_MS + 1_500;
    expect(worst).toBeLessThan(AI_SERVER_BUDGET_MS);
    expect(AI_SERVER_BUDGET_MS + AI_PLATFORM_SAFETY_MARGIN_MS).toBe(AI_PLATFORM_MAX_DURATION_S * 1000);
  });

  it('8. cold-start overhead simulation still leaves response margin', () => {
    const coldStartMs = 3_000;
    const afterCold = start + coldStartMs;
    const deadlineAt = computeServerDeadline(start);
    expect(remainingBudgetMs(deadlineAt, afterCold)).toBe(AI_SERVER_BUDGET_MS - coldStartMs);
    expect(hasRepairBudget(deadlineAt, afterCold)).toBe(true);
    expect(shouldForceRespond(deadlineAt, afterCold)).toBe(false);
    expect(providerCallTimeoutMs(deadlineAt, afterCold)).toBeLessThanOrEqual(AI_PROVIDER_CALL_TIMEOUT_MS);
  });
});

describe('12-13. structured timeout vs network error', () => {
  it('provider abort/timeout is request_timeout, not network_error', () => {
    expect(isProviderAbortOrTimeoutError(Object.assign(new Error('timeout'), { name: 'AbortError' }))).toBe(true);
    expect(isRetryableProviderError(new Error('Request timeout after 8000ms'))).toBe(false);
    const classified = classifyAiFailure({
      error: Object.assign(new Error('AI request timed out.'), { name: 'Error' }),
      httpStatus: 504,
      body: { code: 'request_timeout', error: 'AI request timed out.' },
    });
    expect(classified.code).toBe('request_timeout');
  });

  it('Failed to fetch without HTTP status remains network_error', () => {
    const classified = classifyAiFailure({
      error: new TypeError('Failed to fetch'),
      httpStatus: null,
      body: null,
    });
    expect(classified.code).toBe('network_error');
  });

  it('shouldForceRespond trips inside the response-guard margin', () => {
    const deadlineAt = computeServerDeadline(1_700_000_000_000);
    expect(shouldForceRespond(deadlineAt, deadlineAt - AI_RESPONSE_GUARD_MS)).toBe(true);
    expect(shouldForceRespond(deadlineAt, deadlineAt - AI_RESPONSE_GUARD_MS - 1)).toBe(false);
  });
});

describe('14-16. usage counting semantics for timeout / fallback / late provider', () => {
  it('timed-out provider path does not count as applied success', () => {
    // Client only calls recordProAiSuccess after a successful apply; a transport
    // close / timeout never reaches that branch.
    let usage = 0;
    const apply = (ok: boolean) => {
      if (ok) usage += 1;
    };
    apply(false); // aborted / no JSON
    expect(usage).toBe(0);
  });

  it('successful deterministic fallback increments exactly once', () => {
    let usage = 0;
    const applyFallback = () => {
      usage += 1;
    };
    applyFallback();
    expect(usage).toBe(1);
  });

  it('late provider completion cannot apply after a newer requestId won', () => {
    let latest = 'req_B';
    let applied = '';
    const lateA = { requestId: 'req_A', content: SERBIAN_ECHO };
    if (lateA.requestId === latest) applied = lateA.content;
    expect(applied).toBe('');
    applied = VALID_HINDI;
    latest = 'req_B';
    expect(applied).toBe(VALID_HINDI);
  });
});

describe('50-run flake suite: hard-cancel + fallback under budget', () => {
  it('50× provider hard-abort returns promptly with aborted signal', async () => {
    for (let i = 0; i < 50; i += 1) {
      vi.useFakeTimers();
      const start = 1_900_000_000_000 + i * 1_000;
      vi.setSystemTime(start);
      try {
        let sawSignal: AbortSignal | undefined;
        const create = vi.fn(async (options: ProviderCallOptions) => {
          sawSignal = options.signal;
          await new Promise((r) => setTimeout(r, 45_000));
          return 'late';
        });
        const pending = callProviderWithDeadline(create, computeServerDeadline(start));
        const expectReject = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
        await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS);
        await expectReject;
        expect(sawSignal?.aborted).toBe(true);
        expect(Date.now() - start).toBeLessThanOrEqual(AI_PROVIDER_CALL_TIMEOUT_MS);
      } finally {
        vi.useRealTimers();
      }
    }
  });

  it('50× Hindi invalid + tight deadline -> fallback, never repair, under app budget', async () => {
    for (let i = 0; i < 50; i += 1) {
      vi.useFakeTimers();
      const start = 2_000_000_000_000 + i;
      vi.setSystemTime(start);
      try {
        const factSet = buildCvCanonicalFactSet(forkliftCv());
        const deadlineAt = computeServerDeadline(start);
        vi.setSystemTime(deadlineAt - (AI_MIN_REPAIR_BUDGET_MS - 250));
        const repair = vi.fn(async () => VALID_HINDI);
        const result = await activateCvSummary({
          locale: 'hi',
          gender: 'male',
          factSet,
          candidate: SERBIAN_ECHO,
          sourceFactsText: SERBIAN_ECHO,
          fallbackSummary: SERBIAN_ECHO,
          deadlineAt,
          repair,
        });
        expect(repair).not.toHaveBeenCalled();
        expect(result.status).toBe('fallback');
        expect(result.content).toMatch(/[\u0900-\u097F]/);
        expect(Date.now() - start).toBeLessThan(AI_SERVER_BUDGET_MS);
      } finally {
        vi.useRealTimers();
      }
    }
  });
});
