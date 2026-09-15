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
});
