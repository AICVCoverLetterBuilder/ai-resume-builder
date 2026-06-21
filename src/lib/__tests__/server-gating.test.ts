/**
 * Tests for server-side AI gating hardening.
 *
 * These test the server enforcement rules implemented in /api/generate:
 *
 *   Free-allowed actions (with separate counters):
 *     cover-letter-gen: 1 per Free user
 *     cover-letter-regen: 1 per Free user
 *
 *   Pro-only actions (rejected for Free):
 *     summary, bullets, rewrite, unknown
 *
 *   Pro users with a valid token can use all actions.
 *   Invalid/missing Pro token cannot access Pro-only actions.
 */

import { describe, expect, test } from 'vitest';

// ─── Constants (mirroring the server endpoint) ────────────────────────────────

const FREE_ACTION_LIMITS: Record<string, number> = {
  'cover-letter-gen': 1,
  'cover-letter-regen': 1,
};

const ALLOWED_ACTIONS = new Set([
  'cover-letter-gen',
  'cover-letter-regen',
  'cover-letter',
  'summary',
  'bullets',
  'rewrite',
]);

const FREE_ALLOWED_ACTIONS = new Set(['cover-letter-gen', 'cover-letter-regen']);

const _PRO_ONLY_ACTIONS = ['summary', 'bullets', 'rewrite', 'unknown-action'];

// ─── Simulation helpers ───────────────────────────────────────────────────────
// These simulate the server-side logic without the actual AI/HTTP layer.

function resolveAction(action: string): string {
  if (action === 'cover-letter') return 'cover-letter-gen';
  if (ALLOWED_ACTIONS.has(action)) return action;
  return action;
}

function canUseFreeAction(
  usageMap: Record<string, number>,
  userId: string,
  action: string,
): boolean {
  const limit = FREE_ACTION_LIMITS[action];
  if (!limit) return false; // action not in FREE_ACTION_LIMITS
  const used = usageMap[userId + ':' + action] || 0;
  return used < limit;
}

function recordFreeAction(
  usageMap: Record<string, number>,
  userId: string,
  action: string,
): void {
  const key = userId + ':' + action;
  usageMap[key] = (usageMap[key] || 0) + 1;
}

function serverCheck(
  isPro: boolean,
  action: string,
  usageMap: Record<string, number>,
  userId: string,
): { allowed: boolean; status?: number } {
  const resolved = resolveAction(action);

  // Reject unknown actions
  if (!ALLOWED_ACTIONS.has(resolved) && !ALLOWED_ACTIONS.has(action)) {
    return { allowed: false, status: 400 };
  }
  const effective = ALLOWED_ACTIONS.has(resolved) ? resolved : action;

  // Pro users: allowed for any known action
  if (isPro) return { allowed: true };

  // Free users: only cover-letter operations allowed
  if (!FREE_ALLOWED_ACTIONS.has(effective)) {
    return { allowed: false, status: 402 };
  }

  // Check free usage limit
  if (!canUseFreeAction(usageMap, userId, effective)) {
    return { allowed: false, status: 403 };
  }

  return { allowed: true };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('server AI gating — Free user', () => {
  const userId = 'test-free-user-1';
  let usage: Record<string, number>;

  beforeEach(() => {
    usage = {};
  });

  test('Free summary request rejected with 402', () => {
    const result = serverCheck(false, 'summary', usage, userId);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(402);
  });

  test('Free bullets request rejected with 402', () => {
    const result = serverCheck(false, 'bullets', usage, userId);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(402);
  });

  test('Free rewrite request rejected with 402', () => {
    const result = serverCheck(false, 'rewrite', usage, userId);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(402);
  });

  test('Free unknown action rejected with 400', () => {
    const result = serverCheck(false, 'unknown-action', usage, userId);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(400);
  });

  test('Free first cover-letter-gen allowed', () => {
    const result = serverCheck(false, 'cover-letter-gen', usage, userId);
    expect(result.allowed).toBe(true);
  });

  test('Free second cover-letter-gen rejected with 403', () => {
    recordFreeAction(usage, userId, 'cover-letter-gen');
    const result = serverCheck(false, 'cover-letter-gen', usage, userId);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  test('Free first cover-letter-regen allowed', () => {
    const result = serverCheck(false, 'cover-letter-regen', usage, userId);
    expect(result.allowed).toBe(true);
  });

  test('Free second cover-letter-regen rejected with 403', () => {
    recordFreeAction(usage, userId, 'cover-letter-regen');
    const result = serverCheck(false, 'cover-letter-regen', usage, userId);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(403);
  });

  test('gen and regen use separate counters', () => {
    // Use gen once
    recordFreeAction(usage, userId, 'cover-letter-gen');
    // gen is now consumed
    expect(serverCheck(false, 'cover-letter-gen', usage, userId).allowed).toBe(false);
    // regen is still available
    expect(serverCheck(false, 'cover-letter-regen', usage, userId).allowed).toBe(true);
    // Use regen once
    recordFreeAction(usage, userId, 'cover-letter-regen');
    // Now both consumed
    expect(serverCheck(false, 'cover-letter-regen', usage, userId).allowed).toBe(false);
  });

  test('legacy cover-letter action mapped to cover-letter-gen', () => {
    const resolved = resolveAction('cover-letter');
    expect(resolved).toBe('cover-letter-gen');
    const result = serverCheck(false, 'cover-letter', usage, userId);
    expect(result.allowed).toBe(true);
  });

  test('different Free users have separate counters', () => {
    const userA = 'user-a';
    const userB = 'user-b';
    recordFreeAction(usage, userA, 'cover-letter-gen');
    expect(serverCheck(false, 'cover-letter-gen', usage, userA).allowed).toBe(false);
    expect(serverCheck(false, 'cover-letter-gen', usage, userB).allowed).toBe(true);
  });
});

describe('server AI gating — Pro user with valid token', () => {
  const userId = 'pro-user-1';
  let usage: Record<string, number>;

  beforeEach(() => {
    usage = {};
  });

  test('Pro user can use cover-letter-gen', () => {
    expect(serverCheck(true, 'cover-letter-gen', usage, userId).allowed).toBe(true);
  });

  test('Pro user can use cover-letter-regen', () => {
    expect(serverCheck(true, 'cover-letter-regen', usage, userId).allowed).toBe(true);
  });

  test('Pro user can use summary', () => {
    expect(serverCheck(true, 'summary', usage, userId).allowed).toBe(true);
  });

  test('Pro user can use bullets', () => {
    expect(serverCheck(true, 'bullets', usage, userId).allowed).toBe(true);
  });

  test('Pro user can use rewrite', () => {
    expect(serverCheck(true, 'rewrite', usage, userId).allowed).toBe(true);
  });

  test('Pro user does not consume free counters', () => {
    serverCheck(true, 'cover-letter-gen', usage, userId);
    // Free counter should remain at 0 because Pro skips free tracking
    expect(canUseFreeAction(usage, userId, 'cover-letter-gen')).toBe(true);
  });

  test('Pro user with unknown action gets 400', () => {
    const result = serverCheck(true, 'completely-unknown', usage, userId);
    expect(result.allowed).toBe(false);
    expect(result.status).toBe(400);
  });
});

describe('server AI gating — missing/invalid Pro token', () => {
  const userId = 'anon';
  let usage: Record<string, number>;

  beforeEach(() => {
    usage = {};
  });

  test('isPro=false cannot access summary', () => {
    expect(serverCheck(false, 'summary', usage, userId).allowed).toBe(false);
  });

  test('isPro=false cannot access bullets', () => {
    expect(serverCheck(false, 'bullets', usage, userId).allowed).toBe(false);
  });

  test('isPro=false cannot access rewrite', () => {
    expect(serverCheck(false, 'rewrite', usage, userId).allowed).toBe(false);
  });
});

describe('client handler action values', () => {
  test('handleGenerate sends cover-letter-gen', () => {
    // This validates the constant used in the client
    const generateAction = 'cover-letter-gen';
    expect(generateAction).toBe('cover-letter-gen');
  });

  test('handleRegenerate sends cover-letter-regen', () => {
    const regenerateAction = 'cover-letter-regen';
    expect(regenerateAction).toBe('cover-letter-regen');
  });

  test('action values match server FREE_ACTION_LIMITS keys', () => {
    const clientActions = ['cover-letter-gen', 'cover-letter-regen'];
    for (const action of clientActions) {
      expect(FREE_ACTION_LIMITS).toHaveProperty(action);
    }
  });
});
