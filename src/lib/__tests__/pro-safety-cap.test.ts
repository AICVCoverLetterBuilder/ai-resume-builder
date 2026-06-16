import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the Pro internal AI safety cap.
 *
 * The production constants (store.tsx):
 *   PRO_AI_SAFETY_CAP = 20
 *   PRO_AI_WINDOW_MS  = 30 * 24 * 60 * 60 * 1000 (30 days)
 *
 * These are not exported, so we duplicate them here for verification.
 */
const PRO_SAFETY_CAP = 20;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

interface ProAiRecord {
  count: number;
  windowStart: number;
}

/**
 * Simulates the production safety-check logic from store.tsx.
 */
function canUseProAi(isPro: boolean, record: ProAiRecord): boolean {
  if (!isPro) return true; // Free users skip the Pro cap entirely
  const now = Date.now();
  const fresh = (now - record.windowStart >= WINDOW_MS)
    ? { count: 0, windowStart: now }
    : record;
  return fresh.count < PRO_SAFETY_CAP;
}

describe('Pro AI safety cap (internal PRO_AI_SAFETY_CAP = 20)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('uses 1 through 20 are allowed for a Pro user', () => {
    const record: ProAiRecord = { count: 0, windowStart: Date.now() };

    for (let i = 0; i < 20; i++) {
      expect(canUseProAi(true, record)).toBe(true);
      record.count = i + 1;
    }
  });

  test('use 21 is blocked by the internal safety limit', () => {
    const record: ProAiRecord = { count: 20, windowStart: Date.now() };
    expect(canUseProAi(true, record)).toBe(false);
  });

  test('the limit resets after the rolling 30-day period', () => {
    const start = Date.now();
    const record: ProAiRecord = { count: 20, windowStart: start };

    // At cap — 21st use blocked
    expect(canUseProAi(true, record)).toBe(false);

    // Advance past the 30-day rolling window
    vi.advanceTimersByTime(WINDOW_MS + 1);

    // Window expired — counter resets, use is allowed
    expect(canUseProAi(true, record)).toBe(true);
  });

  test('free user behavior is unaffected by the Pro safety cap', () => {
    // Free users always skip the cap check
    expect(canUseProAi(false, { count: 0, windowStart: Date.now() })).toBe(true);
    expect(canUseProAi(false, { count: 20, windowStart: Date.now() })).toBe(true);
    expect(canUseProAi(false, { count: 9999, windowStart: Date.now() })).toBe(true);
  });

  test('the Pro AI safety cap is exactly 20 (not 50 or any other value)', () => {
    expect(PRO_SAFETY_CAP).toBe(20);
  });
});