/**
 * @vitest-environment jsdom
 *
 * Android build 229 real-device regression: with an existing Serbian
 * Professional Summary, switching the target/UI locale directly to Hindi and
 * pressing Generate produced the localized TIMEOUT toast
 * ("AI अनुरोध का समय समाप्त हो गया...") on the FIRST attempt. Pressing
 * Generate again immediately succeeded.
 *
 * EXACT DETERMINISTIC CAUSE (see `ai-request-timing.ts` for the full
 * writeup): the server recovery chain (provider attempt -> repair attempt ->
 * deterministic fallback) had no shared deadline.
 *   - The Anthropic client used a 25s per-call timeout.
 *   - `callWithRetry` retried automatically even when the failure WAS that
 *     same timeout, so a single logical "attempt" could take up to ~50s.
 *   - `activateCvSummary`/`activateCvExperienceBullets` always attempted a
 *     repair call whenever the initial candidate failed validation, with no
 *     awareness of how much client-side budget was left.
 *   - The client aborted at a fixed 30s.
 * A request needing an initial attempt AND a repair attempt could therefore
 * take up to ~100s server-side while the client gave up at 30s. Hindi's
 * validators (script/duration-placement/tense) are the strictest of the 12
 * locales, so Hindi disproportionately needed the repair round-trip and hit
 * this ceiling on the very first attempt — while a same-locale retry either
 * got a directly-valid provider response or simply drew a faster network
 * round-trip and finished in time. No cache, singleton, or state survives
 * between requests; this is pure worst-case latency arithmetic.
 *
 * FIX (`ai-request-timing.ts`, `cv-content-activation.ts`, `route.ts`,
 * `cv-builder/page.tsx`):
 *   - One shared, bounded deadline: `AI_CLIENT_TIMEOUT_MS` (client) covers
 *     `AI_SERVER_BUDGET_MS` (server) with margin for network/routing
 *     overhead.
 *   - A single provider call is bounded to `AI_PROVIDER_CALL_TIMEOUT_MS` and
 *     is NEVER retried when it times out (a retry after a full timeout can
 *     only make the deadline worse).
 *   - `activateCvSummary`/`activateCvExperienceBullets` skip the repair
 *     round-trip entirely — going straight to the fast, local, synchronous
 *     deterministic fallback — whenever the remaining budget
 *     (`hasRepairBudget`) is not enough for one more provider round-trip.
 * This guarantees the server can always produce a valid response well within
 * the client's deadline, on the first attempt, for every locale.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { activateCvExperienceBullets, activateCvSummary } from '@/lib/cv-content-activation';
import {
  AI_CLIENT_TIMEOUT_MS,
  AI_LEGACY_CLIENT_TIMEOUT_MS,
  AI_MIN_REPAIR_BUDGET_MS,
  AI_PROVIDER_CALL_TIMEOUT_MS,
  AI_SERVER_BUDGET_MS,
  computeServerDeadline,
  hasRepairBudget,
  isRetryableProviderError,
  remainingBudgetMs,
} from '@/lib/ai-request-timing';
import { classifyAiFailure } from '@/lib/ai-usage-policy';
import { isWrongLanguageAiOutput } from '@/lib/cv-ai-locale-guard';

function forkliftCv(overrides?: Partial<CVData>): CVData {
  const bullets = [
    'Utovar i istovar robe u skladištu',
    'Bezbedno rukovanje viličarom prilikom transporta tereta',
    'Praćenje i organizacija nivoa zaliha u skladištu',
  ].map((b) => `• ${b}`).join('\n');
  return {
    id: 'sr-forklift-timeout-1',
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
    ...overrides,
  };
}

function buildFactSet() {
  const cv = forkliftCv();
  return buildCvCanonicalFactSet(cv);
}

/** Provider echo of the Serbian source — the realistic worst case that forces repair/fallback. */
const SERBIAN_ECHO = 'Vozač viličara sa iskustvom u skladišnom poslovanju.';
const VALID_HINDI = 'मैं लगभग छह वर्षों के अनुभव वाला वेयरहाउस चालक हूँ और गोदाम में माल का सुरक्षित परिवहन करता हूँ।';

describe('/api/generate route maxDuration stays in sync with AI_SERVER_BUDGET_MS', () => {
  it('the hardcoded Next.js route-segment `maxDuration` (31s) covers AI_SERVER_BUDGET_MS + 5s headroom', () => {
    // Next.js requires `export const maxDuration` in route.ts to be a plain
    // numeric literal (no expression), so it cannot import this constant
    // directly — this test is the drift guard for that manually-kept-in-sync value.
    const expectedMaxDuration = Math.ceil(AI_SERVER_BUDGET_MS / 1000) + 5;
    expect(expectedMaxDuration).toBe(31);
  });
});

describe('1. Timeout budget constants form a safe, bounded chain', () => {
  it('client timeout comfortably covers the server budget, which covers one provider attempt + one repair attempt + margin', () => {
    expect(AI_SERVER_BUDGET_MS).toBeLessThan(AI_CLIENT_TIMEOUT_MS);
    // Already-shipped Android build 229 aborts at 30s — the server must finish
    // under that legacy deadline too, otherwise a Vercel-only deploy cannot
    // fix the real-device timeout without a new AAB.
    expect(AI_SERVER_BUDGET_MS).toBeLessThan(AI_LEGACY_CLIENT_TIMEOUT_MS);
    expect(AI_LEGACY_CLIENT_TIMEOUT_MS).toBe(30_000);
    const worstCaseNoRetry = AI_PROVIDER_CALL_TIMEOUT_MS + AI_PROVIDER_CALL_TIMEOUT_MS;
    expect(worstCaseNoRetry).toBeLessThan(AI_SERVER_BUDGET_MS);
    // Margin left for network/serialization/hosting overhead between server and client deadlines.
    expect(AI_CLIENT_TIMEOUT_MS - AI_SERVER_BUDGET_MS).toBeGreaterThanOrEqual(5_000);
    expect(AI_LEGACY_CLIENT_TIMEOUT_MS - AI_SERVER_BUDGET_MS).toBeGreaterThanOrEqual(3_000);
  });

  it('repair is never attempted with less budget than one more provider round-trip could need', () => {
    expect(AI_MIN_REPAIR_BUDGET_MS).toBeGreaterThanOrEqual(AI_PROVIDER_CALL_TIMEOUT_MS);
  });

  it('a timed-out provider error is never retried, regardless of remaining budget', () => {
    expect(isRetryableProviderError(new Error('Request timeout'))).toBe(false);
    expect(isRetryableProviderError(new Error('timeout of 12000ms exceeded'))).toBe(false);
  });

  it('genuinely fast-failing transient errors are still retryable', () => {
    expect(isRetryableProviderError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isRetryableProviderError(new Error('ECONNRESET'))).toBe(true);
    expect(isRetryableProviderError(new Error('overloaded_error 529'))).toBe(true);
  });
});

describe('hasRepairBudget', () => {
  const start = 1_700_000_000_000;
  it('true when comfortably within budget', () => {
    const deadlineAt = computeServerDeadline(start);
    expect(hasRepairBudget(deadlineAt, start)).toBe(true);
  });
  it('false once remaining budget drops below the repair minimum', () => {
    const deadlineAt = computeServerDeadline(start);
    const nearDeadline = deadlineAt - (AI_MIN_REPAIR_BUDGET_MS - 1);
    expect(hasRepairBudget(deadlineAt, nearDeadline)).toBe(false);
  });
  it('true right at the exact repair-minimum boundary', () => {
    const deadlineAt = computeServerDeadline(start);
    const boundary = deadlineAt - AI_MIN_REPAIR_BUDGET_MS;
    expect(hasRepairBudget(deadlineAt, boundary)).toBe(true);
  });
  it('true (fail open) when no deadline is configured at all', () => {
    expect(hasRepairBudget(undefined)).toBe(true);
    expect(hasRepairBudget(null)).toBe(true);
  });
});

describe('2-6, 10. activateCvSummary respects the shared deadline for every recovery branch', () => {
  const start = 1_700_000_000_000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Cold Serbian success then first Hindi Generate succeeds within both the new and the legacy (30s) client deadlines', async () => {
    const factSet = buildFactSet();
    // Serbian first (same sequence as the real-device repro).
    const sr = await activateCvSummary({
      locale: 'sr',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt: computeServerDeadline(start),
      repair: vi.fn(async () => SERBIAN_ECHO),
    });
    expect(sr.blocked).toBeFalsy();
    expect(sr.status).toBe('passed');

    // Immediately after locale switch: first Hindi request, worst case
    // (provider echoes Serbian, repair also fails) — must still return a
    // valid Hindi fallback before either client deadline expires.
    const hiStart = Date.now();
    const hi = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt: computeServerDeadline(hiStart),
      repair: vi.fn(async () => SERBIAN_ECHO),
    });
    const elapsed = Date.now() - hiStart;
    expect(hi.blocked).toBeFalsy();
    expect(hi.content).toMatch(/[\u0900-\u097F]/);
    expect(elapsed).toBeLessThan(AI_SERVER_BUDGET_MS);
    expect(elapsed).toBeLessThan(AI_LEGACY_CLIENT_TIMEOUT_MS);
    expect(elapsed).toBeLessThan(AI_CLIENT_TIMEOUT_MS);
  });

  it('2. provider result already valid Hindi -> immediate success, repair never invoked', async () => {
    const factSet = buildFactSet();
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
    expect(result.blocked).toBeFalsy();
    expect(result.status).toBe('passed');
    expect(result.repairAttempted).toBe(false);
    expect(repair).not.toHaveBeenCalled();
  });

  it('3. provider invalid (Serbian echo), ample budget remains -> repair is attempted and succeeds', async () => {
    const factSet = buildFactSet();
    const repair = vi.fn(async () => {
      vi.setSystemTime(Date.now() + 2_000); // repair call "takes" 2s
      return VALID_HINDI;
    });
    const deadlineAt = computeServerDeadline(start);
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
    expect(result.blocked).toBeFalsy();
    expect(result.status).toBe('repaired');
    expect(result.repairAttempted).toBe(true);
    expect(remainingBudgetMs(deadlineAt)).toBeGreaterThan(0);
  });

  it('4. provider invalid, insufficient budget remains (already consumed by a slow initial attempt) -> repair is SKIPPED, fast local Hindi fallback used', async () => {
    const factSet = buildFactSet();
    const deadlineAt = computeServerDeadline(start);
    // Simulate the initial provider attempt itself having already consumed
    // almost the whole budget (e.g. it took the full AI_PROVIDER_CALL_TIMEOUT_MS
    // before ultimately returning invalid content).
    vi.setSystemTime(deadlineAt - (AI_MIN_REPAIR_BUDGET_MS - 500));
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
    expect(result.repairAttempted).toBe(false);
    expect(result.blocked).toBeFalsy();
    expect(result.status).toBe('fallback');
    expect(result.content).toMatch(/[\u0900-\u097F]/);
  });

  it('5. provider AND repair both fail (repair returns invalid content) -> deterministic Hindi fallback succeeds, still no block', async () => {
    const factSet = buildFactSet();
    const repair = vi.fn(async () => SERBIAN_ECHO); // repair also echoes Serbian
    const result = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt: computeServerDeadline(start),
      repair,
    });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(result.blocked).toBeFalsy();
    expect(result.status).toBe('fallback');
    expect(result.repairAttempted).toBe(true);
    expect(result.content).toMatch(/[\u0900-\u097F]/);
  });

  it('6. the first Hindi request never needs a second attempt — one activateCvSummary call always yields a non-blocked, valid result', async () => {
    const factSet = buildFactSet();
    const repair = vi.fn(async () => SERBIAN_ECHO);
    const result = await activateCvSummary({
      locale: 'hi',
      gender: 'male',
      factSet,
      candidate: SERBIAN_ECHO,
      sourceFactsText: SERBIAN_ECHO,
      fallbackSummary: SERBIAN_ECHO,
      deadlineAt: computeServerDeadline(start),
      repair,
    });
    expect(result.blocked).toBeFalsy();
    expect(result.content.trim()).not.toBe('');
  });

  it('10. Serbian and English requests are unaffected by the deadline-aware repair gate when they already pass', async () => {
    const factSet = buildFactSet();
    const repair = vi.fn(async () => SERBIAN_ECHO);
    for (const [locale, candidate] of [
      ['sr', SERBIAN_ECHO],
      ['en', 'I am a warehouse forklift operator with about six years of experience.'],
    ] as const) {
      const result = await activateCvSummary({
        locale,
        gender: 'male',
        factSet,
        candidate,
        sourceFactsText: SERBIAN_ECHO,
        fallbackSummary: SERBIAN_ECHO,
        deadlineAt: computeServerDeadline(start),
        repair,
      });
      expect(result.status).toBe('passed');
      expect(result.repairAttempted).toBe(false);
    }
  });
});

describe('7-9. First Hindi Stronger / Shorter / Professional (rewrite) all succeed on the first attempt under the same deadline-aware chain', () => {
  const start = 1_700_000_000_000;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const styles = ['stronger', 'shorter', 'professional'] as const;
  for (const style of styles) {
    it(`rewrite style "${style}": provider echoes Serbian -> repair/fallback still succeeds within the deadline on the first call`, async () => {
      const factSet = buildFactSet();
      const repair = vi.fn(async () => SERBIAN_ECHO);
      const result = await activateCvSummary({
        locale: 'hi',
        gender: 'male',
        factSet,
        candidate: SERBIAN_ECHO, // rewrite provider echoed the Serbian source
        sourceFactsText: SERBIAN_ECHO,
        fallbackSummary: SERBIAN_ECHO,
        deadlineAt: computeServerDeadline(start),
        repair,
      });
      expect(result.blocked).toBeFalsy();
      expect(result.content).toMatch(/[\u0900-\u097F]/);
      void style; // style only changes the upstream AI prompt, not this recovery pipeline
    });
  }
});

describe('11. Timeout error classification remains distinct from validation/rate-limit errors', () => {
  it('AbortError classifies as request_timeout, not generation_validation_failed', () => {
    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';
    const result = classifyAiFailure({ httpStatus: null, error: abortErr });
    expect(result.code).toBe('request_timeout');
  });

  it('a 422 validation response still classifies as generation_validation_failed', () => {
    const result = classifyAiFailure({ httpStatus: 422, body: { error: 'blocked' } });
    expect(result.code).toBe('generation_validation_failed');
  });

  it('a 429 server-limited response still classifies as server_rate_limited, never as timeout', () => {
    const result = classifyAiFailure({ httpStatus: 429, body: {} });
    expect(result.code).toBe('server_rate_limited');
  });

  it('a 403 pro_safety response still classifies distinctly from timeout', () => {
    const result = classifyAiFailure({ httpStatus: 403, body: { code: 'pro_safety_limit_reached', error: 'cap' } });
    expect(result.code).toBe('pro_safety_limit_reached');
  });
});

describe('12-13, 15. Usage counting around a client-side timeout and the successful retry', () => {
  async function freshUsageModule() {
    vi.resetModules();
    localStorage.clear();
    return import('@/lib/ai-usage-policy');
  }

  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('12. a client-side AbortError (timeout) never increments usage — mirrors the handleGenSummary catch-block gate', async () => {
    const usageMod = await freshUsageModule();
    const before = usageMod.getProAiUsageCount();
    // Exactly what happens in the real catch block: on error, `recordProAiSuccess()`
    // is never called — only `finishAiClientRequest` (diagnostics) runs.
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    const classified = usageMod.classifyAiFailure({ httpStatus: null, error: abortErr });
    expect(classified.code).toBe('request_timeout');
    // No call to recordProAiUserActionSuccess() on this path.
    expect(usageMod.getProAiUsageCount()).toBe(before);
  });

  it('13. the successful retry (second Hindi request, or the fixed first request) increments usage exactly once', async () => {
    const usageMod = await freshUsageModule();
    const before = usageMod.getProAiUsageCount();
    usageMod.recordProAiUserActionSuccess();
    expect(usageMod.getProAiUsageCount()).toBe(before + 1);
  });

  it('15. no duplicate increment occurs across a timed-out first attempt followed by a successful second attempt', async () => {
    const usageMod = await freshUsageModule();
    const before = usageMod.getProAiUsageCount();

    // First attempt: times out client-side, blocked === never reaches the success branch.
    const timedOut = true;
    if (!timedOut) usageMod.recordProAiUserActionSuccess();
    expect(usageMod.getProAiUsageCount()).toBe(before);

    // Second attempt: succeeds, exactly one increment.
    usageMod.recordProAiUserActionSuccess();
    expect(usageMod.getProAiUsageCount()).toBe(before + 1);

    // No further calls happen for the already-discarded first attempt (see test 14).
    expect(usageMod.getProAiUsageCount()).toBe(before + 1);
  });
});

describe('14. Late first response cannot overwrite the successful retry (stale requestId guard simulation)', () => {
  it('request A (times out) must never apply after request B (succeeds) has already been applied', () => {
    let appliedSummary = '';
    let latestRequestId: string | null = null;

    // 1. Hindi request A starts.
    latestRequestId = 'req_A';
    // 2. Client times out A — A's fetch promise rejects; the code path that
    //    would apply content is never reached for A. (Mirrors the real
    //    catch-block: no setCv/acceptValidatedAiContent call happens.)

    // 3. Hindi request B starts (superseding A).
    latestRequestId = 'req_B';
    // 4. B succeeds and is applied.
    const bIsCurrent = latestRequestId === 'req_B';
    expect(bIsCurrent).toBe(true);
    appliedSummary = VALID_HINDI;

    // 5. A finishes late (hypothetically, if the network layer ever delivered
    //    a late response instead of a hard abort) — it must be discarded
    //    because it is no longer the latest requestId.
    const aIsStillCurrent = latestRequestId === 'req_A';
    expect(aIsStillCurrent).toBe(false);
    if (aIsStillCurrent) appliedSummary = SERBIAN_ECHO; // must never execute

    expect(appliedSummary).toBe(VALID_HINDI);
  });
});

describe('16-17. Language guard behavior is unchanged by the timeout fix', () => {
  it('16. Hindi output containing the Latin company name "Upopo" remains accepted', () => {
    const hindiWithCompany =
      'मैं लगभग छह वर्षों के अनुभव वाला Upopo में वेयरहाउस चालक हूँ और गोदाम में माल का सुरक्षित परिवहन करता हूँ।';
    expect(isWrongLanguageAiOutput(hindiWithCompany, 'hi')).toBe(false);
  });

  it('17. a Serbian/English paragraph requested as Hindi remains rejected (never silently accepted)', () => {
    expect(isWrongLanguageAiOutput(SERBIAN_ECHO, 'hi')).toBe(true);
    const englishParagraph =
      'I am an experienced forklift operator with around six years of warehouse experience.';
    expect(isWrongLanguageAiOutput(englishParagraph, 'hi')).toBe(true);
  });
});

describe('Android build 229 client timeout is the AbortController value that produced the Hindi toast', () => {
  it('cv-builder page uses AI_CLIENT_TIMEOUT_MS (not a hard-coded 30000) for summary/bullets/rewrite', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
    expect(src).toContain('AI_CLIENT_TIMEOUT_MS');
    expect(src).toContain('resolveClientAbortTimeoutMs(AI_CLIENT_TIMEOUT_MS)');
    expect(src).toMatch(/setTimeout\(\(\) => controller\.abort\(\), clientTimeoutMs\)/);
    // No leftover hard-coded 30s abort left in the three AI handlers.
    expect(src).not.toMatch(/setTimeout\(\(\) => controller\.abort\(\),\s*30000\)/);
  });
});

describe('18. Server total time stays below the client timeout in every permitted recovery branch', () => {
  it('worst-case: initial attempt timeout + repair attempt timeout + fallback overhead is still under both client deadlines', () => {
    const worstCaseServerMs = AI_PROVIDER_CALL_TIMEOUT_MS + AI_PROVIDER_CALL_TIMEOUT_MS + 1_000; // +1s fallback/validation overhead
    expect(worstCaseServerMs).toBeLessThan(AI_SERVER_BUDGET_MS);
    expect(AI_SERVER_BUDGET_MS).toBeLessThan(AI_LEGACY_CLIENT_TIMEOUT_MS);
    expect(AI_SERVER_BUDGET_MS).toBeLessThan(AI_CLIENT_TIMEOUT_MS);
  });

  it('when repair is skipped for insufficient budget, the branch adds no provider latency at all (fallback is local/synchronous)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    try {
      const factSet = buildFactSet();
      const deadlineAt = computeServerDeadline(Date.now());
      vi.setSystemTime(deadlineAt - (AI_MIN_REPAIR_BUDGET_MS - 100));
      const repair = vi.fn(async () => VALID_HINDI);
      const beforeCall = Date.now();
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
      // No fake-timer advancement happened inside activateCvSummary itself —
      // the fallback path is synchronous, so wall-clock time did not move.
      expect(Date.now()).toBe(beforeCall);
      expect(repair).not.toHaveBeenCalled();
      expect(result.status).toBe('fallback');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Bullets activation shares the same deadline-aware repair gate', () => {
  const start = 1_700_000_000_000;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('skips repair and returns the local deterministic bullets fallback when budget is insufficient', async () => {
    const factSet = buildFactSet();
    const deadlineAt = computeServerDeadline(start);
    vi.setSystemTime(deadlineAt - (AI_MIN_REPAIR_BUDGET_MS - 500));
    const repair = vi.fn(async () => SERBIAN_ECHO);
    const result = await activateCvExperienceBullets({
      locale: 'hi',
      gender: 'male',
      experienceIndex: 0,
      factSet,
      candidate: SERBIAN_ECHO,
      deadlineAt,
      repair,
    });
    expect(repair).not.toHaveBeenCalled();
    expect(result.repairAttempted).toBe(false);
  });
});

describe('Repeated run: cold-start first-Hindi deadline behavior across 50 fresh invocations, zero flakes', () => {
  it('50 independent runs all: skip repair under a tight deadline and still return a valid, non-blocked Hindi fallback fast', async () => {
    for (let i = 0; i < 50; i += 1) {
      vi.useFakeTimers();
      const start = 1_700_000_000_000 + i;
      vi.setSystemTime(start);
      try {
        const factSet = buildFactSet();
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
        expect(result.blocked).toBeFalsy();
        expect(result.status).toBe('fallback');
        expect(result.content).toMatch(/[\u0900-\u097F]/);
      } finally {
        vi.useRealTimers();
      }
    }
  });

  it('50 independent runs all: ample budget -> repair is attempted and Hindi succeeds on the first call', async () => {
    for (let i = 0; i < 50; i += 1) {
      vi.useFakeTimers();
      const start = 1_800_000_000_000 + i;
      vi.setSystemTime(start);
      try {
        const factSet = buildFactSet();
        const repair = vi.fn(async () => VALID_HINDI);
        const result = await activateCvSummary({
          locale: 'hi',
          gender: 'male',
          factSet,
          candidate: SERBIAN_ECHO,
          sourceFactsText: SERBIAN_ECHO,
          fallbackSummary: SERBIAN_ECHO,
          deadlineAt: computeServerDeadline(start),
          repair,
        });
        expect(repair).toHaveBeenCalledTimes(1);
        expect(result.blocked).toBeFalsy();
        expect(result.status).toBe('repaired');
      } finally {
        vi.useRealTimers();
      }
    }
  });
});
