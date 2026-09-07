/**
 * @vitest-environment jsdom
 */
import { cleanup, render, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as React from 'react';
import { AppProvider, useApp } from '../store';

const mocks = vi.hoisted(() => ({
  initIAP: vi.fn(),
  syncProEntitlement: vi.fn(),
}));

vi.mock('../iap', () => ({
  initIAP: mocks.initIAP,
  syncProEntitlement: mocks.syncProEntitlement,
}));

type AppState = ReturnType<typeof useApp>;
let latestApp: AppState | null = null;

const VALID_TOKEN = 'eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5OTk5fQ.test';

function tokenWithExpiration(exp: number): string {
  return `${Buffer.from(JSON.stringify({ isPro: true, exp })).toString('base64url')}.test`;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function Probe() {
  latestApp = useApp();
  return <div data-testid="pro-state">{String(latestApp.isPro)}</div>;
}

function renderProvider() {
  latestApp = null;
  render(
    <AppProvider>
      <Probe />
    </AppProvider>,
  );
  if (!latestApp) throw new Error('AppProvider did not render probe');
  return latestApp;
}

describe('canonical Pro entitlement state', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.initIAP.mockResolvedValue(undefined);
    mocks.syncProEntitlement.mockImplementation(() => new Promise(() => {}));
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  test('successful purchase activation updates canonical Pro state and token immediately', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, VALID_TOKEN);
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(localStorage.getItem('cvpro-pro-token')).toBe(VALID_TOKEN);
    expect(latestApp?.getProToken()).toBe(VALID_TOKEN);
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: VALID_TOKEN });
  });

  test('fresh install starts without a token or Pro state', () => {
    renderProvider();

    expect(latestApp?.isPro).toBe(false);
    expect(latestApp?.getProToken()).toBeNull();
    expect(latestApp?.getAiGate()).toEqual({ status: 'free' });
    expect(localStorage.getItem('cvpro-plan')).toBeNull();
    expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('setIsPro(true, undefined) cannot leave the app AI-ready Pro without a token', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, undefined);
    });

    expect(latestApp?.isPro).toBe(false);
    expect(latestApp?.getProToken()).toBeNull();
    expect(latestApp?.getAiGate()).toEqual({ status: 'free' });
    expect(localStorage.getItem('cvpro-plan')).toBeNull();
    expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('restore activation with active Pro and token produces an AI-ready gate', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, VALID_TOKEN, {
        source: 'restore',
        entitlementResult: 'active',
        tokenSyncLastResult: 'success',
        tokenSyncLastError: '',
      });
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(localStorage.getItem('cvpro-pro-token')).toBe(VALID_TOKEN);
    expect(latestApp?.getProToken()).toBe(VALID_TOKEN);
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: VALID_TOKEN });
  });

  test('old null-token closures read a token added after initial render', async () => {
    renderProvider();

    const staleGetProToken = latestApp?.getProToken;
    const staleGetAiGate = latestApp?.getAiGate;

    expect(staleGetProToken?.()).toBeNull();
    expect(staleGetAiGate?.()).toEqual({ status: 'free' });

    await act(async () => {
      latestApp?.setIsPro(true, VALID_TOKEN, {
        tokenSyncLastResult: 'success',
        tokenSyncLastError: '',
      });
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(staleGetProToken?.()).toBe(VALID_TOKEN);
    expect(staleGetAiGate?.()).toEqual({ status: 'ready', token: VALID_TOKEN });
  });

  test('failed current-session sync clears a structurally valid stale token', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, VALID_TOKEN, {
        tokenSyncLastResult: 'failed',
        tokenSyncLastError: 'Previous token sync failure.',
      });
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(false));
    expect(latestApp?.getAiGate()).toEqual({ status: 'free' });
    expect(latestApp?.getProToken()).toBeNull();
    expect(localStorage.getItem('cvpro-plan')).toBeNull();
    expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('startup active entitlement refreshes a missing token into canonical state', async () => {
    mocks.syncProEntitlement.mockResolvedValue({
      entitlementResult: 'active',
      tokenSyncLastResult: 'success',
      isPro: true,
      token: VALID_TOKEN,
    });

    renderProvider();

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(latestApp?.getProToken()).toBe(VALID_TOKEN);
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: VALID_TOKEN });
  });

  test('startup inactive entitlement clears Pro state and token', async () => {
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', 'old-token');
    mocks.syncProEntitlement.mockResolvedValue({
      entitlementResult: 'inactive',
      tokenSyncLastResult: 'not-run',
      isPro: false,
    });

    renderProvider();

    await waitFor(() => expect(latestApp?.isPro).toBe(false));
    expect(latestApp?.isPro).toBe(false);
    expect(latestApp?.getAiGate()).toEqual({ status: 'free' });
    expect(localStorage.getItem('cvpro-plan')).toBeNull();
    expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('app restart keeps a persisted token provisional until startup sync succeeds', () => {
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', VALID_TOKEN);

    renderProvider();

    expect(latestApp?.isPro).toBe(true);
    expect(latestApp?.getProToken()).toBeNull();
    expect(latestApp?.getAiGate()).toEqual({ status: 'syncing', reason: 'missing-token' });
  });

  test('expired persisted token is never AI-ready while startup sync is pending', async () => {
    const expiredToken = tokenWithExpiration(Date.now() - 1);
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', expiredToken);
    const pending = deferred<unknown>();
    mocks.syncProEntitlement.mockReturnValue(pending.promise);

    renderProvider();

    expect(latestApp?.isPro).toBe(false);
    expect(latestApp?.getProToken()).toBeNull();
    expect(latestApp?.getAiGate().status).toBe('free');
    expect(latestApp?.getAiGate().status).not.toBe('ready');

    await act(async () => {
      pending.resolve({ entitlementResult: 'inactive', tokenSyncLastResult: 'not-run', isPro: false });
    });
    await waitFor(() => expect(localStorage.getItem('cvpro-pro-token')).toBeNull());
  });

  test('startup sync replaces an expired persisted token with a fresh usable token', async () => {
    const expiredToken = tokenWithExpiration(Date.now() - 1);
    const freshToken = tokenWithExpiration(Date.now() + 60_000);
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', expiredToken);
    const pending = deferred<unknown>();
    mocks.syncProEntitlement.mockReturnValue(pending.promise);

    renderProvider();
    expect(latestApp?.getAiGate().status).not.toBe('ready');
    expect(latestApp?.getProToken()).toBeNull();

    await act(async () => {
      pending.resolve({
        entitlementResult: 'active',
        tokenSyncLastResult: 'success',
        isPro: true,
        token: freshToken,
      });
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(latestApp?.getProToken()).toBe(freshToken);
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: freshToken });
    expect(localStorage.getItem('cvpro-pro-token')).toBe(freshToken);
    expect(localStorage.getItem('cvpro-pro-token')).not.toBe(expiredToken);
  });

  test('startup sync failure clears an expired persisted token and keeps the gate closed', async () => {
    const expiredToken = tokenWithExpiration(Date.now() - 1);
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', expiredToken);
    const pending = deferred<unknown>();
    mocks.syncProEntitlement.mockReturnValue(pending.promise);

    renderProvider();
    expect(latestApp?.getAiGate().status).not.toBe('ready');

    await act(async () => {
      pending.reject(new Error('deterministic startup sync failure'));
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(false));
    expect(latestApp?.getProToken()).toBeNull();
    expect(latestApp?.getAiGate()).toEqual({ status: 'free' });
    expect(localStorage.getItem('cvpro-plan')).toBeNull();
    expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('confirmed Pro users bypass Free counters without incrementing or resetting them', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, VALID_TOKEN);
    });
    await waitFor(() => expect(latestApp?.isPro).toBe(true));

    await act(async () => {
      latestApp?.incrementDownloads('cv');
      latestApp?.incrementDownloads('cl');
      latestApp?.incrementClGeneration();
      latestApp?.incrementClRegen();
      latestApp?.markAiRecommendUsed();
      latestApp?.resetClRegen();
    });

    expect(latestApp?.canDownload('cv')).toBe(true);
    expect(latestApp?.canDownload('cl')).toBe(true);
    expect(latestApp?.canGenerateCoverLetter()).toBe(true);
    expect(latestApp?.canRegenerateCoverLetter()).toBe(true);
    expect(localStorage.getItem('cvpro-downloads')).toBeNull();
    expect(localStorage.getItem('cvpro-cl-generations')).toBeNull();
    expect(localStorage.getItem('cvpro-cl-regenerations')).toBeNull();
    expect(localStorage.getItem('cvpro-ai-recommend-used')).toBeNull();
  });

  test('stale Free counter callbacks do not consume Cover Letter allowance after Pro activation', async () => {
    renderProvider();

    const staleIncrementClGeneration = latestApp?.incrementClGeneration;
    const staleIncrementClRegen = latestApp?.incrementClRegen;
    const staleResetClRegen = latestApp?.resetClRegen;

    await act(async () => {
      latestApp?.setIsPro(true, VALID_TOKEN);
    });
    await waitFor(() => expect(latestApp?.isPro).toBe(true));

    await act(async () => {
      staleIncrementClGeneration?.();
      staleIncrementClGeneration?.();
      staleIncrementClRegen?.();
      staleResetClRegen?.();
    });

    expect(localStorage.getItem('cvpro-cl-generations')).toBeNull();
    expect(localStorage.getItem('cvpro-cl-regenerations')).toBeNull();
    expect(latestApp?.canGenerateCoverLetter()).toBe(true);
    expect(latestApp?.canRegenerateCoverLetter()).toBe(true);
  });

  test('Free users still consume Free counters and hit the expected limits', async () => {
    renderProvider();

    expect(latestApp?.isPro).toBe(false);
    expect(latestApp?.canDownload('cv')).toBe(true);
    expect(latestApp?.canGenerateCoverLetter()).toBe(true);
    expect(latestApp?.canRegenerateCoverLetter()).toBe(true);

    await act(async () => {
      latestApp?.incrementDownloads('cv');
      latestApp?.incrementClGeneration();
      latestApp?.incrementClRegen();
      latestApp?.markAiRecommendUsed();
    });

    expect(latestApp?.canDownload('cv')).toBe(false);
    expect(latestApp?.canGenerateCoverLetter()).toBe(false);
    expect(latestApp?.canRegenerateCoverLetter()).toBe(false);
    expect(localStorage.getItem('cvpro-ai-recommend-used')).toBe('1');
  });
});
