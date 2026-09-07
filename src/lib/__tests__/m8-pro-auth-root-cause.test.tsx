/** Deterministic M8 Pro-token expiry and startup-gate contract tests. */
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { restorePro, syncProEntitlement } from '../iap';
import { createProToken, verifyProToken } from '../pro-token';
import { AI_PRO_TOKEN_OPERATION_LEASE_MS, isUsableProToken } from '../pro-token-client';

const TEST_KEY = 'm8-deterministic-test-signing-key';

function expiredSignedProToken(): string {
  const payload = JSON.stringify({ isPro: true, exp: Date.now() - 1 });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', TEST_KEY).update(payload).digest('base64url');
  return `${encoded}.${signature}`;
}

function signedToken(payload: Record<string, unknown>): string {
  const raw = JSON.stringify(payload);
  const encoded = Buffer.from(raw).toString('base64url');
  const signature = crypto.createHmac('sha256', TEST_KEY).update(raw).digest('base64url');
  return `${encoded}.${signature}`;
}

const storage = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => { storage.clear(); },
};

describe('M8 Pro auth expiry contract', () => {
  beforeEach(() => {
    process.env.PRO_SIGNING_KEY = TEST_KEY;
    storage.clear();
    (globalThis as Record<string, unknown>).window = {};
    (globalThis as Record<string, unknown>).localStorage = fakeLocalStorage;
  });

  afterEach(() => {
    storage.clear();
  });

  test('client rejects an expired token while accepting a finite future token', () => {
    const now = 1_700_000_000_000;
    expect(isUsableProToken(null, now)).toBe(false);
    expect(isUsableProToken('%%%.sig', now)).toBe(false);
    expect(isUsableProToken(`${Buffer.from('not-json').toString('base64url')}.sig`, now)).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: true, exp: now - 1 }), now)).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: true, exp: now }), now)).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: true, exp: now + 1 }), now)).toBe(true);
    expect(isUsableProToken(signedToken({ exp: now + 1 }), now)).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: true, exp: String(now + 1) }), now)).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: true, exp: Number.NaN }))).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: true }))).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: false, exp: now + 1 }), now)).toBe(false);
    expect(isUsableProToken('not-a-token', now)).toBe(false);
    expect(isUsableProToken(signedToken({ isPro: true, exp: now + 1 }), now, AI_PRO_TOKEN_OPERATION_LEASE_MS)).toBe(false);
  });

  test('freshly issued Pro token is usable and server-verifiable', async () => {
    const token = await createProToken(true);
    expect(isUsableProToken(token, Date.now(), AI_PRO_TOKEN_OPERATION_LEASE_MS)).toBe(true);
    expect(await verifyProToken(token)).toMatchObject({ isPro: true, exp: expect.any(Number) });
  });

  test('web entitlement sync clears an expired persisted token before any AI call', async () => {
    const token = expiredSignedProToken();
    fakeLocalStorage.setItem('cvpro-pro-token', token);
    const result = await syncProEntitlement();
    expect(result).toEqual({ entitlementResult: 'inactive', tokenSyncLastResult: 'not-run', isPro: false });
    expect(fakeLocalStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('web restore follows the same rule and clears an expired persisted token', async () => {
    fakeLocalStorage.setItem('cvpro-pro-token', expiredSignedProToken());
    await expect(restorePro()).resolves.toEqual({ success: true, isPro: false, token: undefined });
    expect(fakeLocalStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('server rejects the same expired signed Pro token', async () => {
    expect(await verifyProToken(expiredSignedProToken())).toBeNull();
  });

  test('server rejects tampered, false-entitlement, and malformed tokens', async () => {
    const valid = signedToken({ isPro: true, exp: Date.now() + 60_000 });
    const tampered = `${valid.slice(0, -1)}${valid.endsWith('a') ? 'b' : 'a'}`;
    expect(await verifyProToken(tampered)).toBeNull();
    expect(await verifyProToken(signedToken({ isPro: false, exp: Date.now() + 60_000 }))).toBeNull();
    expect(await verifyProToken('not-a-token')).toBeNull();
  });

  test('startup persistence and click-time gate share the canonical usability helper', () => {
    const source = fs.readFileSync(path.resolve('src/lib/store.tsx'), 'utf8');
    const cvBuilder = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
    expect(source).toContain("localStorage.getItem('cvpro-plan') === 'pro' && isUsableProToken(localStorage.getItem(PRO_TOKEN_KEY))");
    expect(source).toContain("if (tokenSyncLastResultRef.current !== 'success') {");
    expect(source).toContain('isUsableProToken(currentToken, Date.now(), AI_PRO_TOKEN_OPERATION_LEASE_MS)');
    expect(source).toContain("return { status: 'syncing', reason: 'missing-token' }");
    expect(cvBuilder).toContain("if (aiGate.status === 'syncing') {");
    expect(cvBuilder).toContain("return aiGate.status === 'ready' ? aiGate.token : null;");
  });
});
