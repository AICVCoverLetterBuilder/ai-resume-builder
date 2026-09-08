/** @vitest-environment jsdom */
import React from 'react';
import { webcrypto } from 'node:crypto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AppProvider, useApp } from '../store';
import { createProToken } from '../pro-token';
import { fingerprintProToken } from '../pro-auth-diagnostics';
import { translations } from '../i18n/translations';
import { createEmptyCv } from '../cv-defaults';
import { getLatestSummaryAiDiagnostic, clearSummaryAiDiagnosticsForTests } from '../cv-summary-ai-diagnostics';

const mocks = vi.hoisted(() => ({ initIAP: vi.fn(), syncProEntitlement: vi.fn() }));
vi.mock('../iap', () => ({ ...mocks,
  useIAP: () => ({ purchasing: false, isNativeApp: true }),
}));
vi.mock('@capacitor/core', async (importOriginal) => ({
  ...await importOriginal<typeof import('@capacitor/core')>(),
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
}));
vi.mock('@/lib/i18n/context', () => ({ useI18n: () => ({ locale: 'en', t: translations.en }) }));
vi.mock('@/components/Header', () => ({ default: () => null }));
vi.mock('@/components/Footer', () => ({ default: () => null }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

type State = ReturnType<typeof useApp>;
let app: State;
function Probe() { app = useApp(); return null; }
function deferred<T>() {
  let resolve!: (result: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}
const active = (token: string) => ({ isPro: true, token, entitlementResult: 'active' as const, tokenSyncLastResult: 'success' as const });

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); clearSummaryAiDiagnosticsForTests();
  vi.clearAllMocks();
  vi.stubGlobal('crypto', webcrypto);
  vi.stubEnv('PRO_SIGNING_KEY', 'deterministic-auth-boundary-test-only');
  vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
  vi.stubEnv('NEXT_PUBLIC_AI_CORE_V3_ENABLED', 'true');
  vi.stubEnv('AI_CORE_V3_ENABLED', 'true');
  mocks.initIAP.mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in client test'); }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

describe('real AppProvider identity and startup ownership', () => {
  test.each([true, false])('fresh startup token reaches real Summary click and invalid auth increments usage by zero, V3=%s', async (v3Enabled) => {
    vi.stubEnv('NEXT_PUBLIC_AI_CORE_V3_ENABLED', String(v3Enabled));
    const token = await createProToken(true);
    const oldToken = token + 'old-test-only';
    localStorage.setItem('cvpro-pro-token', oldToken);
    localStorage.setItem('cvpro-plan', 'pro');
    mocks.syncProEntitlement.mockResolvedValue(active(token));
    const mounted = render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(app.getProToken() === token).toBe(true));
    expect(app.getAiGate()).toEqual({ status: 'ready', token });
    expect(localStorage.getItem('cvpro-pro-token') === token).toBe(true);
    const observation = await app.getProAuthObservation(token);
    expect(observation).toMatchObject({ authPlatformNative: true, authPlatformName: 'android',
      authSyncLastResult: 'success', authSyncSource: 'startup', authTokenRemainingLifetimeBucket: 'over_5m',
      authTokenFingerprint: await fingerprintProToken(token), authTokenFingerprintAtClick: await fingerprintProToken(token) });
    const cv = createEmptyCv('en');
    cv.runtimeMigrationVersion = 3;
    cv.personal.jobTitle = 'Engineer';
    cv.experience = [{ id: 'test-experience', company: 'Example', position: 'Engineer', startDate: '2020-01',
      endDate: '', isPresent: true, description: 'Designs reliable systems.' }];
    await act(async () => { app.setCurrentCv(cv); });
    const before = app.getProAiUsageCount();
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: unknown, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      bodies.push(body);
      return Response.json({ code: 'invalid_pro_token', error: 'Pro access required for AI features.',
        internalProAuth: { serverReceivedTokenFingerprint: await fingerprintProToken(body.proToken),
          serverTokenFingerprintMatchesClient: true, serverProTokenVerificationReason: 'signature_mismatch',
          serverDeploymentSourceMarker: '2c849bf' } }, { status: 403 });
    }));
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
    const Page = (await import('../../app/cv-builder/page')).default;
    mounted.rerender(<AppProvider><Probe /><Page /></AppProvider>);
    fireEvent.click(screen.getByRole('button', { name: translations.en.cv.summary }));
    const generate = screen.getAllByRole('button').find((button) => button.textContent?.includes(translations.en.cv.generateSubtext));
    expect(generate).toBeDefined();
    fireEvent.click(generate!);
    const action = v3Enabled ? 'summary_v3_generate' : 'summary';
    await waitFor(() => expect(bodies.some((body) => body.action === action)).toBe(true));
    // Existing M4 normalizer classifies the generic auth body as malformed V3;
    // this task observes that fact rather than changing its acceptance contract.
    await waitFor(() => expect(getLatestSummaryAiDiagnostic()?.finalTypedFailureReason)
      .toBe(v3Enabled ? 'invalid_v3_summary_response' : 'invalid_pro_token'));
    const main = bodies.find((body) => body.action === action)!;
    expect(main.proToken === token).toBe(true);
    expect(main.authTokenFingerprintAtClick).toBe(await fingerprintProToken(token));
    const trace = getLatestSummaryAiDiagnostic()!;
    expect(trace.authBoundary).toMatchObject({ ...observation, serverProTokenVerificationReason: 'signature_mismatch',
      serverTokenFingerprintMatchesClient: true, serverReceivedTokenFingerprint: await fingerprintProToken(token) });
    expect(JSON.stringify(trace)).not.toContain(token);
    expect(app.getProAiUsageCount()).toBe(before);
    expect(trace.countedAsSuccess).toBe(false);
    expect(mocks.syncProEntitlement).toHaveBeenCalledTimes(1);
    expect(bodies).toHaveLength(1);
  });

  test.each([false, true])('StrictMode development double-effect completion order reverse=%s is observable, not physical proof', async (reverse) => {
    const tokenA = await createProToken(true);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1);
    const tokenB = await createProToken(true);
    const a = deferred<ReturnType<typeof active>>(); const b = deferred<ReturnType<typeof active>>();
    mocks.syncProEntitlement.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    render(<React.StrictMode><AppProvider><Probe /></AppProvider></React.StrictMode>);
    await waitFor(() => expect(mocks.syncProEntitlement).toHaveBeenCalledTimes(2));
    await act(async () => { (reverse ? b : a).resolve(active(reverse ? tokenB : tokenA)); });
    await act(async () => { (reverse ? a : b).resolve(active(reverse ? tokenA : tokenB)); });
    expect(app.getProToken() === (reverse ? tokenA : tokenB)).toBe(true);
    // Both were issued by the same real authority and retain a full lease.
    expect(app.getAiGate().status).toBe('ready');
  });

  test('navigation below the one provider does not start a second entitlement sync', async () => {
    const token = await createProToken(true);
    mocks.syncProEntitlement.mockResolvedValue(active(token));
    const mounted = render(<AppProvider><Probe /><div key="page-a" /></AppProvider>);
    await waitFor(() => expect(app.getProToken() === token).toBe(true));
    mounted.rerender(<AppProvider><Probe /><div key="page-b" /></AppProvider>);
    await act(async () => { await Promise.resolve(); });
    expect(mocks.syncProEntitlement).toHaveBeenCalledTimes(1);
    expect(app.getProToken() === token).toBe(true);
  });

  test('unmounted startup completion can rewrite persistence but not the newer mounted owner ref', async () => {
    const tokenA = await createProToken(true);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1);
    const tokenB = await createProToken(true);
    const a = deferred<ReturnType<typeof active>>();
    mocks.syncProEntitlement.mockReturnValueOnce(a.promise).mockResolvedValueOnce(active(tokenB));
    const first = render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(mocks.syncProEntitlement).toHaveBeenCalledTimes(1));
    first.unmount();
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(app.getProToken() === tokenB).toBe(true));
    await act(async () => { a.resolve(active(tokenA)); });
    expect(localStorage.getItem('cvpro-pro-token') === tokenA).toBe(true);
    expect(app.getProToken() === tokenB).toBe(true);
  });

  test('default channel omits observations without fingerprinting', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'production');
    const token = await createProToken(true);
    mocks.syncProEntitlement.mockResolvedValue(active(token));
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(app.getProToken() === token).toBe(true));
    const digest = vi.spyOn(webcrypto.subtle, 'digest');
    expect(await app.getProAuthObservation(token)).toBeUndefined();
    expect(digest).not.toHaveBeenCalled();
  });
});
