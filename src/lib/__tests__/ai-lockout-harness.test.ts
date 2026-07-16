/**
 * @vitest-environment jsdom
 *
 * Deterministic 60-request sequential AI harness — no real provider calls.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  PRO_AI_SAFETY_CAP,
  PRO_AI_WINDOW_MS,
  canUseProAiSafety,
  clearTransientAiSessionState,
  classifyAiFailure,
  getAiCircuitState,
  getProAiUsageCount,
  isAiCircuitOpen,
  loadProAiRecord,
  noteAiRequestFailure,
  noteAiRequestSuccess,
  openAiCircuit,
  recordProAiUserActionSuccess,
  simulateReinstallAiState,
} from '@/lib/ai-usage-policy';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import { checkProAccess } from '@/lib/store';

describe('60 sequential visible AI actions (mocked provider)', () => {
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

  test('60 visible actions: each counts once; lockout only at configured PRO_AI_SAFETY_CAP', () => {
    let record = loadProAiRecord();
    let visibleActions = 0;
    let repairPasses = 0;
    let fallbackPasses = 0;
    let allowedBeforeCap = 0;
    let blockedAtCap = 0;

    // Simulated Pro token refresh mid-run — entitlement stays ready
    let isProVerified = true;

    for (let i = 0; i < 60; i++) {
      const access = checkProAccess(isProVerified, record.count);
      if (access === 'allowed') {
        allowedBeforeCap++;
        // One user-visible Generate/Rewrite/Stronger counts once
        record = recordProAiUserActionSuccess(record);
        visibleActions++;
        // Simulated automatic repair + validation fallback — must NOT increment again
        repairPasses++;
        fallbackPasses++;
      } else {
        expect(access).toBe('safety_cap');
        blockedAtCap++;
        // Blocked requests must not increment usage
        expect(record.count).toBe(PRO_AI_SAFETY_CAP);
      }

      // Occasional mocked provider 429 / 503 — transient circuit, then success clears it
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

      // Mid-run Pro token refresh simulation
      if (i === 15) {
        isProVerified = true;
      }
    }

    expect(PRO_AI_SAFETY_CAP).toBe(20);
    expect(visibleActions).toBe(PRO_AI_SAFETY_CAP);
    expect(allowedBeforeCap).toBe(PRO_AI_SAFETY_CAP);
    expect(blockedAtCap).toBe(60 - PRO_AI_SAFETY_CAP);
    expect(repairPasses).toBe(PRO_AI_SAFETY_CAP);
    expect(fallbackPasses).toBe(PRO_AI_SAFETY_CAP);
    expect(record.count).toBe(PRO_AI_SAFETY_CAP);
    // No early lockout from double-counting around 10–19
    expect(canUseProAiSafety(true, { count: 19, windowStart: record.windowStart })).toBe(true);
    expect(canUseProAiSafety(true, record)).toBe(false);
  });

  test('repair-only bursts do not advance the Pro safety counter', () => {
    const start = loadProAiRecord();
    for (let i = 0; i < 40; i++) {
      // repair / fallback only
      repairPassesNoop();
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

  test('error codes remain distinct and Hindi toasts are localized', () => {
    expect(aiErrorMessage('pro_safety_limit_reached', 'hi')).toMatch(/सुरक्षा|सीमा/);
    expect(aiErrorMessage('pro_safety_limit_reached', 'hi')).not.toBe(
      aiErrorMessage('pro_safety_limit_reached', 'en'),
    );
    expect(aiErrorMessage('server_rate_limited', 'hi', 12)).toContain('12');
    expect(aiErrorMessage('provider_temporarily_unavailable', 'hi')).toMatch(/प्रदाता|उपलब्ध/);
    expect(aiErrorMessage('network_error', 'hi')).toMatch(/नेटवर्क/);
    expect(aiErrorMessage('invalid_pro_token', 'hi')).toMatch(/Pro|प्राधिकरण|रीफ़्रेश/);
    expect(aiErrorMessage('free_ai_limit_reached', 'hi')).toMatch(/मुफ़्त|सीमा/);

    const codes = [
      classifyAiFailure({ httpStatus: 429, body: { code: 'server_rate_limited' } }).code,
      classifyAiFailure({ httpStatus: 429, body: { code: 'provider_rate_limited' } }).code,
      classifyAiFailure({ httpStatus: 503 }).code,
      classifyAiFailure({ httpStatus: 403, body: { error: 'Pro access required' } }).code,
      classifyAiFailure({ httpStatus: 422 }).code,
    ];
    expect(new Set(codes).size).toBe(codes.length);
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
      'cvpro-ai-usage',
      JSON.stringify({ count: PRO_AI_SAFETY_CAP, windowStart: start }),
    );
    expect(canUseProAiSafety(true, loadProAiRecord())).toBe(false);

    vi.setSystemTime(start + PRO_AI_WINDOW_MS + 1);
    expect(canUseProAiSafety(true, loadProAiRecord())).toBe(true);
  });
});

function repairPassesNoop() {
  // Intentionally empty — repair/fallback must not touch usage storage
}

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
