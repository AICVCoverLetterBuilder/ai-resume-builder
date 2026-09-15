/** @vitest-environment jsdom */
import React from 'react';
import { render, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AppProvider, useApp, checkProAccess } from '../store';
import { createProToken } from '../pro-token';

const mocks = vi.hoisted(() => ({ initIAP: vi.fn(), syncProEntitlement: vi.fn() }));
const testBootstrapCapability = ['m8', 'qa', 'bootstrap', 'fixture'].join('-');
vi.mock('../iap', () => ({ ...mocks }));
vi.mock('@capacitor/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@capacitor/core')>(),
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
}));

let app: ReturnType<typeof useApp>;
function Probe() {
  app = useApp();
  return null;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.stubEnv('PRO_SIGNING_KEY', 'm8-internal-entitlement-store-test-key');
  vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
  vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
  vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY', testBootstrapCapability);
  vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
  vi.stubEnv('VERCEL_ENV', 'preview');
  mocks.initIAP.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
  localStorage.clear();
});

describe('internal entitlement uses the canonical AppProvider gate', () => {
  test('eligible upgrade-in-place QA startup is not blocked by RevenueCat initialization', async () => {
    const token = await createProToken(true, { source: 'internal_test' });
    localStorage.setItem('cvpro-plan', 'free');
    localStorage.setItem('cvpro-pro-token', 'expired-upgrade-token');
    mocks.initIAP.mockRejectedValue(new Error('RevenueCat initialization unavailable'));
    mocks.syncProEntitlement.mockResolvedValue({
      entitlementResult: 'active',
      tokenSyncLastResult: 'success',
      isPro: true,
      token,
      entitlementSource: 'internal_test',
    });

    render(<AppProvider><Probe /></AppProvider>);
    const usageBefore = app.getProAiUsageCount();

    await waitFor(() => expect(app.getAiGate()).toEqual({ status: 'ready', token }));
    expect(mocks.initIAP).not.toHaveBeenCalled();
    expect(mocks.syncProEntitlement).toHaveBeenCalledTimes(1);
    expect(app.isPro).toBe(true);
    expect(app.proEntitlementSource).toBe('internal_test');
    expect(checkProAccess(app.isPro, app.getProAiUsageCount())).toBe('allowed');
    expect(app.getProAiUsageCount()).toBe(usageBefore);
  });

  test('server-issued internal token hydrates source diagnostics and checkProAccess', async () => {
    const token = await createProToken(true, { source: 'internal_test' });
    mocks.syncProEntitlement.mockResolvedValue({
      entitlementResult: 'active',
      tokenSyncLastResult: 'success',
      isPro: true,
      token,
      entitlementSource: 'internal_test',
    });

    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(app.getAiGate()).toEqual({ status: 'ready', token }));
    expect(app.isPro).toBe(true);
    expect(app.proEntitlementSource).toBe('internal_test');
    expect(app.getProEntitlementSource()).toBe('internal_test');
    expect(checkProAccess(app.isPro, app.getProAiUsageCount())).toBe('allowed');
    await expect(app.getProAuthObservation(token)).resolves.toMatchObject({
      proEntitlementSource: 'internal_test',
    });
    expect(localStorage.getItem('cvpro-pro-token')).toBe(token);
    const observation = await app.getProAuthObservation(token);
    expect(JSON.stringify(observation)).not.toContain(testBootstrapCapability);
    expect(localStorage.getItem(testBootstrapCapability)).toBeNull();
  });

  test('ordinary free and commercial Pro results keep the canonical paywall behavior', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'production');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'false');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY', '');
    mocks.syncProEntitlement.mockResolvedValueOnce({
      entitlementResult: 'inactive', tokenSyncLastResult: 'not-run', isPro: false,
    });

    const free = render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(mocks.syncProEntitlement).toHaveBeenCalledTimes(1));
    expect(app.getAiGate()).toEqual({ status: 'free' });
    expect(checkProAccess(app.isPro, app.getProAiUsageCount())).toBe('upgrade');
    free.unmount();

    vi.clearAllMocks();
    const token = await createProToken(true);
    mocks.syncProEntitlement.mockResolvedValueOnce({
      entitlementResult: 'active', tokenSyncLastResult: 'success', isPro: true,
      token, entitlementSource: 'commercial',
    });
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(app.getAiGate()).toEqual({ status: 'ready', token }));
    expect(app.proEntitlementSource).toBe('commercial');
    expect(checkProAccess(app.isPro, app.getProAiUsageCount())).toBe('allowed');
  });
});
