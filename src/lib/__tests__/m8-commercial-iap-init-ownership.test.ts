/**
 * @vitest-environment jsdom
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mockPurchases = vi.hoisted(() => ({
  configure: vi.fn(),
  setLogLevel: vi.fn(),
  setLogHandler: vi.fn(),
  getCustomerInfo: vi.fn(),
}));

const mockCapacitor = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'android'),
  isNativePlatform: vi.fn(() => true),
}));

const mockRevenueCatModule = vi.hoisted(() => ({
  Purchases: mockPurchases,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

vi.mock('@capacitor/core', () => ({ Capacitor: mockCapacitor }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn() } }));
vi.mock('@revenuecat/purchases-capacitor', () => mockRevenueCatModule);

const PRO_ENTITLEMENT = 'CV Pro AI Pro';

function customerInfo(active: Record<string, unknown> = {}) {
  return { customerInfo: { entitlements: { active } } };
}

function commercialEnvironment() {
  vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'production');
  vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'false');
  vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY', '');
  vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_android_key');
  vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'test_ios_key');
  vi.stubEnv('PRO_SIGNING_KEY', 'm8-commercial-init-test-key');
}

function resetPurchases() {
  mockCapacitor.getPlatform.mockReset();
  mockCapacitor.getPlatform.mockReturnValue('android');
  mockCapacitor.isNativePlatform.mockReset();
  mockCapacitor.isNativePlatform.mockReturnValue(true);
  mockPurchases.configure.mockReset();
  mockPurchases.configure.mockResolvedValue(undefined);
  mockPurchases.setLogLevel.mockReset();
  mockPurchases.setLogLevel.mockResolvedValue(undefined);
  mockPurchases.setLogHandler.mockReset();
  mockPurchases.setLogHandler.mockResolvedValue(undefined);
  mockPurchases.getCustomerInfo.mockReset();
  mockPurchases.getCustomerInfo.mockResolvedValue(customerInfo());
}

describe('M8 commercial RevenueCat initialization ownership', () => {
  beforeEach(() => {
    vi.resetModules();
    commercialEnvironment();
    resetPurchases();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ token: 'eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5OTk5fQ.test' }),
    })));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('real commercial free startup configures RevenueCat before reading customerInfo', async () => {
    const order: string[] = [];
    mockPurchases.configure.mockImplementation(async () => { order.push('configure'); });
    mockPurchases.getCustomerInfo.mockImplementation(async () => {
      order.push('getCustomerInfo');
      return customerInfo();
    });
    const { syncProEntitlement } = await import('../iap');

    const result = await syncProEntitlement();

    expect(order).toEqual(['configure', 'getCustomerInfo']);
    expect(result).toMatchObject({ entitlementResult: 'inactive', isPro: false, tokenSyncLastResult: 'not-run' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('real commercial Pro startup configures first, verifies the commercial token, and becomes allowed', async () => {
    const order: string[] = [];
    mockPurchases.configure.mockImplementation(async () => { order.push('configure'); });
    mockPurchases.getCustomerInfo.mockImplementation(async () => {
      order.push('getCustomerInfo');
      return customerInfo({ [PRO_ENTITLEMENT]: { identifier: PRO_ENTITLEMENT } });
    });
    const fetchMock = vi.fn(async (_url: unknown, options: RequestInit) => {
      order.push('verifyPro');
      const body = JSON.parse(String(options.body));
      expect(body.internalTestProEntitlementRequested).toBeUndefined();
      expect(body.internalTestProBootstrapCapability).toBeUndefined();
      return {
        ok: true,
        status: 200,
        json: async () => ({ token: 'eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5OTk5fQ.test' }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { syncProEntitlement } = await import('../iap');

    const result = await syncProEntitlement();

    expect(order).toEqual(['configure', 'getCustomerInfo', 'verifyPro']);
    expect(result).toMatchObject({ entitlementResult: 'active', isPro: true, entitlementSource: 'commercial' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('commercial initialization failure fails closed without customerInfo, token, or usage work', async () => {
    mockPurchases.configure.mockRejectedValue(new Error('RevenueCat unavailable'));
    const { syncProEntitlement } = await import('../iap');
    const usageBefore = localStorage.getItem('cvpro-ai-usage');

    const result = await syncProEntitlement();

    expect(result).toMatchObject({ entitlementResult: 'failed', isPro: false, tokenSyncLastResult: 'not-run' });
    expect(mockPurchases.getCustomerInfo).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(usageBefore);
  });

  test('valid internal bootstrap never initializes RevenueCat', async () => {
    const capability = 'm8-internal-ownership-capability';
    const digest = createHash('sha256').update(capability, 'utf8').digest('hex');
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY', capability);
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256', digest);
    vi.stubEnv('VERCEL_ENV', 'preview');
    mockPurchases.configure.mockRejectedValue(new Error('must not be called'));
    const { createProToken } = await import('../pro-token');
    const token = await createProToken(true, { source: 'internal_test' });
    const fetchMock = vi.fn(async (_url: unknown, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      expect(body.internalTestProEntitlementRequested).toBe(true);
      expect(body.internalTestProBootstrapCapability).toBe(capability);
      return { ok: true, status: 200, json: async () => ({ token, proEntitlementSource: 'internal_test' }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { syncProEntitlement } = await import('../iap');

    const result = await syncProEntitlement();

    expect(result).toMatchObject({ entitlementResult: 'active', isPro: true, entitlementSource: 'internal_test' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(mockPurchases.getCustomerInfo).not.toHaveBeenCalled();
  });

  test('repeated initialization shares one configure operation before commercial sync', async () => {
    let release: (() => void) | undefined;
    mockPurchases.configure.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const { initIAP, syncProEntitlement } = await import('../iap');

    const first = initIAP();
    const second = initIAP();
    await vi.waitFor(() => expect(mockPurchases.configure).toHaveBeenCalledTimes(1));
    release?.();
    await Promise.all([first, second]);
    const result = await syncProEntitlement();

    expect(result.entitlementResult).toBe('inactive');
    expect(mockPurchases.configure).toHaveBeenCalledTimes(1);
    expect(mockPurchases.setLogHandler).toHaveBeenCalledTimes(1);
    expect(mockPurchases.setLogLevel).toHaveBeenCalledTimes(1);
    expect(mockPurchases.getCustomerInfo).toHaveBeenCalledTimes(1);
  });
});
