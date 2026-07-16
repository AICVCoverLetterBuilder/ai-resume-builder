import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  PRO_AI_SAFETY_CAP,
  PRO_AI_WINDOW_MS,
  PRO_AI_LEGACY_SAFETY_CAP,
  AI_USAGE_SCHEMA_VERSION,
  canUseProAiSafety,
  isProAiSafetyBlocked,
} from '@/lib/ai-usage-policy';

// Local boundary helper for clarity in assertions (mirrors checkProAccess / canUse)
function allowedAtCount(count: number): boolean {
  return count < PRO_AI_SAFETY_CAP;
}

describe('Pro AI safety cap (authoritative PRO_AI_SAFETY_CAP = 50)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('actions 1–49 are allowed; action 50 allowed then recorded; 51 blocked', () => {
    const windowStart = Date.now();
    for (let i = 0; i < 49; i++) {
      expect(canUseProAiSafety(true, { count: i, windowStart })).toBe(true);
      expect(allowedAtCount(i)).toBe(true);
    }
    // count 49 → action 50 allowed
    expect(canUseProAiSafety(true, { count: 49, windowStart })).toBe(true);
    // after recording action 50, count = 50 → blocked for 51
    expect(canUseProAiSafety(true, { count: 50, windowStart })).toBe(false);
    expect(isProAiSafetyBlocked({ count: 50, windowStart, policyLimit: PRO_AI_SAFETY_CAP })).toBe(true);
    expect(allowedAtCount(50)).toBe(false);
  });

  test('the limit resets after the rolling 30-day period', () => {
    const start = Date.now();
    expect(canUseProAiSafety(true, { count: PRO_AI_SAFETY_CAP, windowStart: start })).toBe(false);
    vi.advanceTimersByTime(PRO_AI_WINDOW_MS + 1);
    expect(canUseProAiSafety(true, { count: PRO_AI_SAFETY_CAP, windowStart: start })).toBe(true);
  });

  test('not-ready / free gate cannot use Pro AI safety path', () => {
    expect(canUseProAiSafety(false, { count: 0, windowStart: Date.now() })).toBe(false);
  });

  test('authoritative Pro cap is 50, not the legacy build-223 value of 20', () => {
    expect(PRO_AI_SAFETY_CAP).toBe(50);
    expect(PRO_AI_LEGACY_SAFETY_CAP).toBe(20);
    expect(AI_USAGE_SCHEMA_VERSION).toBe(2);
    expect(PRO_AI_SAFETY_CAP).not.toBe(PRO_AI_LEGACY_SAFETY_CAP);
  });
});
