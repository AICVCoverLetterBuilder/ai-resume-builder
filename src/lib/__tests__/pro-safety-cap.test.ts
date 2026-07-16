import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import {
  PRO_AI_SAFETY_CAP,
  PRO_AI_WINDOW_MS,
  canUseProAiSafety,
} from '@/lib/ai-usage-policy';

describe('Pro AI safety cap (internal PRO_AI_SAFETY_CAP from ai-usage-policy)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('uses 1 through 20 are allowed for a Pro user', () => {
    const windowStart = Date.now();
    for (let i = 0; i < PRO_AI_SAFETY_CAP; i++) {
      expect(canUseProAiSafety(true, { count: i, windowStart })).toBe(true);
    }
  });

  test('use 21 is blocked by the internal safety limit', () => {
    expect(canUseProAiSafety(true, { count: PRO_AI_SAFETY_CAP, windowStart: Date.now() })).toBe(false);
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

  test('the Pro AI safety cap is exactly 20 (configured value, not 50)', () => {
    expect(PRO_AI_SAFETY_CAP).toBe(20);
  });
});
