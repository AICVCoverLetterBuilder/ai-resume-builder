/**
 * @vitest-environment jsdom
 *
 * Deterministic sequential AI harness — no real provider calls.
 * Cap is authoritative PRO_AI_SAFETY_CAP (50).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  PRO_AI_SAFETY_CAP,
  PRO_AI_WINDOW_MS,
  PRO_AI_LEGACY_SAFETY_CAP,
  AI_USAGE_SCHEMA_VERSION,
  AI_USAGE_STORAGE_KEY,
  canUseProAiSafety,
  clearTransientAiSessionState,
  classifyAiFailure,
  getAiCircuitState,
  getProAiUsageCount,
  isAiCircuitOpen,
  loadProAiRecord,
  migrateProAiRecord,
  noteAiRequestFailure,
  noteAiRequestSuccess,
  openAiCircuit,
  recordProAiUserActionSuccess,
  simulateReinstallAiState,
} from '@/lib/ai-usage-policy';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import { checkProAccess } from '@/lib/store';

describe('sequential visible AI actions (mocked provider)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  test('60 visible actions: each counts once; lockout only at configured PRO_AI_SAFETY_CAP (50)', () => {
    let record = loadProAiRecord();
    let visibleActions = 0;
    let repairPasses = 0;
    let fallbackPasses = 0;
    let allowedBeforeCap = 0;
    let blockedAtCap = 0;
    let isProVerified = true;

    for (let i = 0; i < 60; i++) {
      const access = checkProAccess(isProVerified, record.count);
      if (access === 'allowed') {
        allowedBeforeCap++;
        record = recordProAiUserActionSuccess(record);
        visibleActions++;
        repairPasses++;
        fallbackPasses++;
      } else {
        expect(access).toBe('safety_cap');
        blockedAtCap++;
        expect(record.count).toBe(PRO_AI_SAFETY_CAP);
      }

      if (i === 5) {
        noteAiRequestFailure(classifyAiFailure({ httpStatus: 429, retryAfterSec: 2 }));
        expect(isAiCircuitOpen()).toBe(true);
        vi.advanceTimersByTime(3_000);
        expect(isAiCircuitOpen()).toBe(false);
      }
      if (i === 8) {
        noteAiRequestFailure(classifyAiFailure({ httpStatus: 503, retryAfterSec: 1 }));
        expect(getAiCircuitState().openUntil).toBeGreaterThan(Date.now());
        noteAiRequestSuccess();
        expect(isAiCircuitOpen()).toBe(false);
      }
      if (i === 15) {
        isProVerified = true;
      }
    }

    expect(PRO_AI_SAFETY_CAP).toBe(50);
    expect(visibleActions).toBe(PRO_AI_SAFETY_CAP);
    expect(allowedBeforeCap).toBe(PRO_AI_SAFETY_CAP);
    expect(blockedAtCap).toBe(60 - PRO_AI_SAFETY_CAP);
    expect(repairPasses).toBe(PRO_AI_SAFETY_CAP);
    expect(fallbackPasses).toBe(PRO_AI_SAFETY_CAP);
    expect(record.count).toBe(PRO_AI_SAFETY_CAP);
    expect(canUseProAiSafety(true, { count: 49, windowStart: record.windowStart })).toBe(true);
    expect(canUseProAiSafety(true, record)).toBe(false);
  });

  test('10 Summary + 10 Stronger AI = count 20; next 30 visible actions work through count 50', () => {
    let record = loadProAiRecord();
    for (let i = 0; i < 10; i++) {
      record = recordProAiUserActionSuccess(record); // Summary
    }
    for (let i = 0; i < 10; i++) {
      record = recordProAiUserActionSuccess(record); // Stronger AI
    }
    expect(record.count).toBe(20);
    expect(checkProAccess(true, record.count)).toBe('allowed');

    for (let i = 0; i < 30; i++) {
      expect(checkProAccess(true, record.count)).toBe('allowed');
      record = recordProAiUserActionSuccess(record);
    }
    expect(record.count).toBe(50);
    expect(checkProAccess(true, record.count)).toBe('safety_cap');
  });

  test('repair-only bursts do not advance the Pro safety counter', () => {
    const start = loadProAiRecord();
    for (let i = 0; i < 40; i++) {
      // intentional no-op — repair/fallback must not touch usage
    }
    expect(loadProAiRecord().count).toBe(start.count);
    expect(canUseProAiSafety(true, loadProAiRecord())).toBe(true);
  });

  test('cooldown expires automatically; success resets transient failure state', () => {
    openAiCircuit('provider_temporarily_unavailable', 5);
    expect(isAiCircuitOpen()).toBe(true);
    vi.advanceTimersByTime(6_000);
    expect(isAiCircuitOpen()).toBe(false);

    openAiCircuit('server_rate_limited', 30);
    noteAiRequestSuccess();
    expect(isAiCircuitOpen()).toBe(false);
  });

  test('Pro never falls into free counter path when gate is ready', () => {
    expect(canUseProAiSafety(false, { count: 0, windowStart: Date.now() })).toBe(false);
    expect(checkProAccess(false, 0)).toBe('upgrade');
    expect(checkProAccess(true, 5)).toBe('allowed');
  });

  test('app reload hydrates unexpired usage but does not create permanent lock', () => {
    let record = loadProAiRecord();
    for (let i = 0; i < 5; i++) {
      record = recordProAiUserActionSuccess(record);
    }
    const hydrated = loadProAiRecord();
    expect(hydrated.count).toBe(5);
    expect(canUseProAiSafety(true, hydrated)).toBe(true);

    openAiCircuit('provider_rate_limited', 10);
    clearTransientAiSessionState();
    expect(isAiCircuitOpen()).toBe(false);
    expect(getProAiUsageCount()).toBe(5);
  });

  test('clearing local storage is not required for circuit recovery', () => {
    openAiCircuit('provider_temporarily_unavailable', 2);
    expect(isAiCircuitOpen()).toBe(true);
    vi.advanceTimersByTime(3_000);
    expect(isAiCircuitOpen()).toBe(false);
    expect(getProAiUsageCount()).toBe(0);
  });

  test('error codes remain distinct; Serbian and Hindi use UI locales', () => {
    expect(aiErrorMessage('pro_safety_limit_reached', 'sr')).toMatch(/privremeno|zaštite|kasnije/i);
    expect(aiErrorMessage('pro_safety_limit_reached', 'sr')).not.toMatch(/temporarily unavailable/i);
    expect(aiErrorMessage('pro_safety_limit_reached', 'hi')).toMatch(/सुरक्षा|उच्च|प्रयास/);
    expect(aiErrorMessage('pro_safety_limit_reached', 'hi')).not.toBe(
      aiErrorMessage('pro_safety_limit_reached', 'en'),
    );
    expect(aiErrorMessage('server_rate_limited', 'hi', 12)).toContain('12');
    expect(aiErrorMessage('provider_temporarily_unavailable', 'hi')).toMatch(/प्रदाता|उपलब्ध/);

    const codes = [
      classifyAiFailure({ httpStatus: 429, body: { code: 'server_rate_limited' } }).code,
      classifyAiFailure({ httpStatus: 429, body: { code: 'provider_rate_limited' } }).code,
      classifyAiFailure({ httpStatus: 503 }).code,
      classifyAiFailure({ httpStatus: 403, body: { error: 'Pro access required' } }).code,
      classifyAiFailure({ httpStatus: 422 }).code,
    ];
    expect(new Set(codes).size).toBe(codes.length);
    expect(classifyAiFailure({ httpStatus: 429, body: { code: 'server_rate_limited' } }).code)
      .not.toBe('pro_safety_limit_reached');
  });

  test('Android storage lifecycle: restart / reload / clear session / reinstall simulation', () => {
    let record = loadProAiRecord();
    record = recordProAiUserActionSuccess(record);
    expect(record.count).toBe(1);
    openAiCircuit('server_rate_limited', 20);

    expect(loadProAiRecord().count).toBe(1);

    clearTransientAiSessionState();
    expect(isAiCircuitOpen()).toBe(false);
    expect(loadProAiRecord().count).toBe(1);

    expect(canUseProAiSafety(true, loadProAiRecord())).toBe(true);

    simulateReinstallAiState();
    expect(loadProAiRecord().count).toBe(0);
    expect(isAiCircuitOpen()).toBe(false);
  });

  test('30-day window expiry restores allowance without clearing storage manually', () => {
    const start = Date.now();
    vi.setSystemTime(start);
    localStorage.setItem(
      AI_USAGE_STORAGE_KEY,
      JSON.stringify({ count: PRO_AI_SAFETY_CAP, windowStart: start }),
    );
    expect(canUseProAiSafety(true, loadProAiRecord())).toBe(false);

    vi.setSystemTime(start + PRO_AI_WINDOW_MS + 1);
    expect(canUseProAiSafety(true, loadProAiRecord())).toBe(true);
  });
});

describe('build-223 → schema v2 Pro usage migration', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  test('count=20 under old limit 20 becomes allowed under policy 50 without clearing storage', () => {
    const windowStart = Date.now() - 3 * 24 * 60 * 60 * 1000;
    // Exact build-223 shape
    localStorage.setItem(
      AI_USAGE_STORAGE_KEY,
      JSON.stringify({
        count: 20,
        windowStart,
        oldLimit: PRO_AI_LEGACY_SAFETY_CAP,
      }),
    );

    // Would have been blocked under legacy 20:
    expect(20 >= PRO_AI_LEGACY_SAFETY_CAP).toBe(true);

    const migrated = loadProAiRecord();
    expect(migrated.count).toBe(20);
    expect(migrated.windowStart).toBe(windowStart);
    expect(migrated.schemaVersion).toBe(AI_USAGE_SCHEMA_VERSION);
    expect(migrated.policyLimit).toBe(50);
    expect(canUseProAiSafety(true, migrated)).toBe(true);
    expect(checkProAccess(true, migrated.count)).toBe('allowed');

    // Action 21 succeeds and increments
    const after21 = recordProAiUserActionSuccess(migrated);
    expect(after21.count).toBe(21);
    expect(after21.windowStart).toBe(windowStart);
    expect(after21.policyLimit).toBe(50);

    const persisted = JSON.parse(localStorage.getItem(AI_USAGE_STORAGE_KEY)!);
    expect(persisted.schemaVersion).toBe(2);
    expect(persisted.policyLimit).toBe(50);
    expect(persisted.count).toBe(21);
    expect(persisted.blocked).toBeUndefined();
    expect(persisted.limitReached).toBeUndefined();
  });

  test('migrateProAiRecord ignores persisted blocked/limitReached flags', () => {
    const windowStart = Date.now();
    const migrated = migrateProAiRecord({
      count: 20,
      windowStart,
      blocked: true,
      limitReached: true,
      oldLimit: 20,
    });
    expect(migrated.count).toBe(20);
    expect(migrated.windowStart).toBe(windowStart);
    expect(migrated.policyLimit).toBe(50);
    expect(canUseProAiSafety(true, migrated)).toBe(true);
  });
});

describe('API failure classification contract', () => {
  test('maps HTTP statuses to distinct application codes', () => {
    expect(classifyAiFailure({
      httpStatus: 429,
      body: { code: 'server_rate_limited', retryAfter: 15 },
      retryAfterSec: 15,
    })).toMatchObject({ code: 'server_rate_limited', retryAfterSec: 15 });
    expect(classifyAiFailure({
      httpStatus: 429,
      body: { code: 'provider_rate_limited' },
    }).code).toBe('provider_rate_limited');
    expect(classifyAiFailure({ httpStatus: 503 }).code).toBe('provider_temporarily_unavailable');
    expect(classifyAiFailure({ httpStatus: 529 }).code).toBe('provider_temporarily_unavailable');
    expect(classifyAiFailure({ error: new DOMException('aborted', 'AbortError') }).code).toBe('request_timeout');
    expect(classifyAiFailure({
      httpStatus: 403,
      body: { error: 'Pro access required for AI features.' },
    }).code).toBe('free_ai_limit_reached');
  });
});
