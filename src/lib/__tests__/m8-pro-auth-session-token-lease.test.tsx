/**
 * @vitest-environment jsdom
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AppProvider, useApp } from '../store';
import { verifyProToken } from '../pro-token';
import { AI_CLIENT_TIMEOUT_MS } from '../ai-request-timing';
import { AI_PRO_TOKEN_OPERATION_LEASE_MS, isUsableProToken } from '../pro-token-client';

const iapMocks = vi.hoisted(() => ({
  initIAP: vi.fn(),
  syncProEntitlement: vi.fn(),
}));

vi.mock('../iap', () => ({
  initIAP: iapMocks.initIAP,
  syncProEntitlement: iapMocks.syncProEntitlement,
}));

const TEST_SIGNING_KEY = 'm8-session-token-lease-test-key';
type AppState = ReturnType<typeof useApp>;
let currentApp: AppState | null = null;

function signedProToken(exp: number): string {
  const payload = JSON.stringify({ isPro: true, exp });
  const encoded = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', TEST_SIGNING_KEY).update(payload).digest('base64url');
  return `${encoded}.${signature}`;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function Probe() {
  currentApp = useApp();
  return null;
}

function mountProvider() {
  currentApp = null;
  render(<AppProvider><Probe /></AppProvider>);
  const renderedApp = currentApp as AppState | null;
  if (!renderedApp) throw new Error('AppProvider probe did not render');
  return renderedApp;
}

describe('M8 AAB558 session-token lifecycle and lease closure', () => {
  beforeEach(() => {
    process.env.PRO_SIGNING_KEY = TEST_SIGNING_KEY;
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    iapMocks.initIAP.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.useRealTimers();
  });

  test('persisted future token stays provisional while current-session startup sync is pending', async () => {
    const pending = deferred<never>();
    const persistedToken = signedProToken(Date.now() + 24 * 60 * 60 * 1000);
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', persistedToken);
    iapMocks.syncProEntitlement.mockReturnValue(pending.promise);

    mountProvider();

    await act(async () => {
      await Promise.resolve();
    });

    expect(currentApp?.isPro).toBe(true);
    expect(currentApp?.getAiGate()).toEqual({ status: 'syncing', reason: 'missing-token' });
    expect(currentApp?.getProToken()).toBeNull();
    expect(iapMocks.syncProEntitlement).toHaveBeenCalledTimes(1);
  });

  test('near-expiry token reproduces the old stage race but is rejected for a full operation lease', async () => {
    const stageOneNow = 1_900_000_000_000;
    const token = signedProToken(stageOneNow + 1_000);
    vi.useFakeTimers();
    vi.setSystemTime(stageOneNow);

    expect(isUsableProToken(token)).toBe(true);
    expect(isUsableProToken(token, stageOneNow, AI_PRO_TOKEN_OPERATION_LEASE_MS)).toBe(false);
    expect(await verifyProToken(token)).not.toBeNull();

    vi.setSystemTime(stageOneNow + 1_001);
    expect(await verifyProToken(token)).toBeNull();
  });

  test('same captured Summary token deterministically passes localization and expires before main generation', async () => {
    const stageOneNow = 1_900_000_000_000;
    const capturedToken = signedProToken(stageOneNow + 1_000);
    const localizationToken = capturedToken;
    const generationToken = capturedToken;
    vi.useFakeTimers();
    vi.setSystemTime(stageOneNow);

    const localizationAuth = await verifyProToken(localizationToken);
    vi.setSystemTime(stageOneNow + 1_001);
    const generationAuth = await verifyProToken(generationToken);

    expect(localizationToken).toBe(generationToken);
    expect(localizationAuth).not.toBeNull();
    expect(generationAuth).toBeNull();
  });

  test('Summary captures one token and passes that same binding to localization and generation', () => {
    const source = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
    const handlerStart = source.indexOf('  const handleGenSummary = async () => {');
    const handlerEnd = source.indexOf('  const handleGenBullets = async', handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handlerStart).toBeGreaterThanOrEqual(0);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    expect(handler.match(/const proToken = getCurrentProTokenOrToast/g)).toHaveLength(1);
    expect(handler).toContain('resolveSummaryLocalizedManifest({');
    expect(handler).toContain('proToken,');
    expect(handler).toContain("action: 'summary'");
    expect(handler).not.toContain("'/api/verify-pro'");
  });

  test('one shared server verifier precedes every generate action dispatch', () => {
    const route = fs.readFileSync(path.resolve('src/app/api/generate/route.ts'), 'utf8');
    const verifierCall = 'await verifyProToken(proToken,';
    expect(route.match(/await verifyProToken\(proToken,/g)).toHaveLength(1);
    const verifierIndex = route.indexOf(verifierCall);
    const actionDispatches = [
      "if (action === 'summary-localize' || action === 'summary-context-localize')",
      "if (action === 'summary')",
      "if (action === 'bullets')",
      "if (action === 'rewrite')",
      'if (action === CONTENT_LOCALIZE_V3_OPERATION)',
      'if (action === SUMMARY_V3_GENERATE_ACTION)',
      'if (action === EXPERIENCE_V3_GENERATE_ACTION)',
      'if (action === EXPERIENCE_V3_ENHANCE_ACTION)',
    ];
    for (const dispatch of actionDispatches) {
      expect(route.indexOf(dispatch), dispatch).toBeGreaterThan(verifierIndex);
    }
  });

  test('all UI callers use the shared gate without per-button token refresh', () => {
    const store = fs.readFileSync(path.resolve('src/lib/store.tsx'), 'utf8');
    const cvBuilder = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
    const coverLetter = fs.readFileSync(path.resolve('src/app/cover-letter/page.tsx'), 'utf8');
    expect(store.match(/const getAiGate = useCallback/g)).toHaveLength(1);
    expect(cvBuilder).toContain('getCurrentProTokenOrToast');
    expect(cvBuilder).toContain('handleGenSummary');
    expect(cvBuilder).toContain('handleSummaryV3Style');
    expect(cvBuilder).toContain('handleGenBullets');
    expect(cvBuilder).toContain('handleRewrite');
    expect(coverLetter).toContain('getAiGate()');
    expect(`${cvBuilder}\n${coverLetter}`).not.toContain("'/api/verify-pro'");
  });

  test('operation lease boundaries are explicit and a newly issued lifetime remains admissible', () => {
    const now = 1_900_000_000_000;
    expect(isUsableProToken(signedProToken(now), now, AI_PRO_TOKEN_OPERATION_LEASE_MS)).toBe(false);
    expect(isUsableProToken(signedProToken(now + 1), now, AI_PRO_TOKEN_OPERATION_LEASE_MS)).toBe(false);
    expect(isUsableProToken(
      signedProToken(now + AI_PRO_TOKEN_OPERATION_LEASE_MS - 1),
      now,
      AI_PRO_TOKEN_OPERATION_LEASE_MS,
    )).toBe(false);
    expect(isUsableProToken(
      signedProToken(now + AI_PRO_TOKEN_OPERATION_LEASE_MS),
      now,
      AI_PRO_TOKEN_OPERATION_LEASE_MS,
    )).toBe(true);
    expect(isUsableProToken(signedProToken(now + 24 * 60 * 60 * 1000), now, AI_PRO_TOKEN_OPERATION_LEASE_MS)).toBe(true);
  });

  test('an admitted lease remains server-valid through the client deadline', async () => {
    const startedAt = 1_900_000_000_000;
    const admittedToken = signedProToken(startedAt + AI_PRO_TOKEN_OPERATION_LEASE_MS);
    vi.useFakeTimers();
    vi.setSystemTime(startedAt);

    expect(isUsableProToken(admittedToken, startedAt, AI_PRO_TOKEN_OPERATION_LEASE_MS)).toBe(true);
    expect(await verifyProToken(admittedToken)).not.toBeNull();

    vi.setSystemTime(startedAt + AI_CLIENT_TIMEOUT_MS);
    expect(await verifyProToken(admittedToken)).not.toBeNull();
  });

  test('startup sync success replaces provisional persistence with the fresh authoritative token', async () => {
    const oldToken = signedProToken(Date.now() + 24 * 60 * 60 * 1000);
    const freshToken = signedProToken(Date.now() + 24 * 60 * 60 * 1000 + 1);
    const pending = deferred<{
      entitlementResult: 'active';
      tokenSyncLastResult: 'success';
      isPro: true;
      token: string;
    }>();
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', oldToken);
    iapMocks.syncProEntitlement.mockReturnValue(pending.promise);
    mountProvider();

    await act(async () => {
      await Promise.resolve();
    });
    expect(currentApp?.getAiGate().status).toBe('syncing');

    await act(async () => {
      pending.resolve({
        entitlementResult: 'active',
        tokenSyncLastResult: 'success',
        isPro: true,
        token: freshToken,
      });
    });

    await waitFor(() => expect(currentApp?.getAiGate()).toEqual({ status: 'ready', token: freshToken }));
    expect(currentApp?.getProToken()).toBe(freshToken);
    expect(localStorage.getItem('cvpro-pro-token')).toBe(freshToken);
    expect(localStorage.getItem('cvpro-pro-token')).not.toBe(oldToken);
  });

  test('startup sync failure clears provisional persistence and never exposes the stale token', async () => {
    const staleToken = signedProToken(Date.now() + 24 * 60 * 60 * 1000);
    const pending = deferred<never>();
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', staleToken);
    iapMocks.syncProEntitlement.mockReturnValue(pending.promise);
    mountProvider();

    await act(async () => {
      await Promise.resolve();
    });
    expect(currentApp?.getAiGate().status).toBe('syncing');
    expect(currentApp?.getProToken()).toBeNull();

    await act(async () => {
      pending.reject(new Error('deterministic current-session sync failure'));
    });

    await waitFor(() => expect(currentApp?.isPro).toBe(false));
    expect(currentApp?.getAiGate()).toEqual({ status: 'free' });
    expect(currentApp?.getProToken()).toBeNull();
    expect(localStorage.getItem('cvpro-plan')).toBeNull();
    expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('no persisted token becomes ready after active startup sync and inactive entitlement stays free', async () => {
    const freshToken = signedProToken(Date.now() + 24 * 60 * 60 * 1000);
    iapMocks.syncProEntitlement.mockResolvedValueOnce({
      entitlementResult: 'active',
      tokenSyncLastResult: 'success',
      isPro: true,
      token: freshToken,
    });
    mountProvider();
    await waitFor(() => expect(currentApp?.getAiGate()).toEqual({ status: 'ready', token: freshToken }));
    cleanup();
    currentApp = null;
    localStorage.clear();

    iapMocks.syncProEntitlement.mockResolvedValueOnce({
      entitlementResult: 'inactive',
      tokenSyncLastResult: 'not-run',
      isPro: false,
    });
    const inactiveApp = mountProvider();
    await waitFor(() => expect(currentApp?.getAiGate()).toEqual({ status: 'free' }));
    expect(inactiveApp.getProToken()).toBeNull();
  });
});
