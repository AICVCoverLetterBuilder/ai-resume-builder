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
      latestApp?.setIsPro(true, 'purchase-token');
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(localStorage.getItem('cvpro-pro-token')).toBe('purchase-token');
    expect(latestApp?.getProToken()).toBe('purchase-token');
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: 'purchase-token' });
    expect(latestApp?.proDiagnostics.aiGateStatus).toBe('ready');
    expect(latestApp?.proDiagnostics.aiGateTokenPresent).toBe(true);
    expect(latestApp?.proDiagnostics.aiGateIsPro).toBe(true);
    expect(latestApp?.proDiagnostics.aiGateBlockingReason).toBe('none');
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
    expect(latestApp?.proDiagnostics.tokenSyncLastResult).toBe('failed');
  });

  test('diagnostics evidence with active Pro and token produces an AI-ready gate', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, 'synced-token', {
        source: 'restore',
        entitlementResult: 'active',
        tokenSyncLastResult: 'success',
        tokenSyncLastError: '',
      });
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(latestApp?.proDiagnostics.clientIsPro).toBe(true);
    expect(latestApp?.proDiagnostics.storedTokenPresent).toBe(true);
    expect(latestApp?.proDiagnostics.memoryTokenPresent).toBe(true);
    expect(latestApp?.proDiagnostics.tokenSyncLastResult).toBe('success');
    expect(latestApp?.proDiagnostics.restoreEntitlementResult).toBe('active');
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: 'synced-token' });
    expect(latestApp?.proDiagnostics.aiGateStatus).toBe('ready');
    expect(latestApp?.proDiagnostics.aiGateBlockingReason).toBe('none');
  });

  test('old null-token closures read a token added after initial render', async () => {
    renderProvider();

    const staleGetProToken = latestApp?.getProToken;
    const staleGetAiGate = latestApp?.getAiGate;

    expect(staleGetProToken?.()).toBeNull();
    expect(staleGetAiGate?.()).toEqual({ status: 'free' });

    await act(async () => {
      latestApp?.setIsPro(true, 'late-token', {
        tokenSyncLastResult: 'success',
        tokenSyncLastError: '',
      });
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(staleGetProToken?.()).toBe('late-token');
    expect(staleGetAiGate?.()).toEqual({ status: 'ready', token: 'late-token' });
  });

  test('stale sync failure state cannot block a current valid token', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, 'valid-token', {
        tokenSyncLastResult: 'failed',
        tokenSyncLastError: 'Previous token sync failure.',
      });
    });

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(latestApp?.proDiagnostics.tokenSyncLastResult).toBe('failed');
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: 'valid-token' });
    expect(latestApp?.proDiagnostics.aiGateStatus).toBe('ready');
    expect(latestApp?.proDiagnostics.aiGateBlockingReason).toBe('none');
  });

  test('startup active entitlement refreshes a missing token into canonical state', async () => {
    mocks.syncProEntitlement.mockResolvedValue({
      entitlementResult: 'active',
      tokenSyncLastResult: 'success',
      isPro: true,
      token: 'startup-token',
    });

    renderProvider();

    await waitFor(() => expect(latestApp?.isPro).toBe(true));
    expect(localStorage.getItem('cvpro-plan')).toBe('pro');
    expect(latestApp?.getProToken()).toBe('startup-token');
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: 'startup-token' });
    expect(latestApp?.proDiagnostics.startupEntitlementResult).toBe('active');
    expect(latestApp?.proDiagnostics.tokenSyncLastResult).toBe('success');
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

    await waitFor(() => expect(latestApp?.proDiagnostics.startupEntitlementResult).toBe('inactive'));
    expect(latestApp?.isPro).toBe(false);
    expect(latestApp?.getAiGate()).toEqual({ status: 'free' });
    expect(localStorage.getItem('cvpro-plan')).toBeNull();
    expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
  });

  test('app restart reloads a persisted token into memory immediately', () => {
    localStorage.setItem('cvpro-plan', 'pro');
    localStorage.setItem('cvpro-pro-token', 'persisted-token');

    renderProvider();

    expect(latestApp?.isPro).toBe(true);
    expect(latestApp?.getProToken()).toBe('persisted-token');
    expect(latestApp?.getAiGate()).toEqual({ status: 'ready', token: 'persisted-token' });
    expect(latestApp?.proDiagnostics.memoryTokenPresent).toBe(true);
  });

  test('confirmed Pro users bypass Free counters without incrementing or resetting them', async () => {
    renderProvider();

    await act(async () => {
      latestApp?.setIsPro(true, 'purchase-token');
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
      latestApp?.setIsPro(true, 'purchase-token');
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
