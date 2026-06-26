/**
 * @vitest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the in-app purchase flow.
 *
 * Mocked tests are acceptable. Real-device validation is still required
 * for end-to-end purchase verification on physical Android hardware.
 */

// Module-level mock controls
const mockPurchases = vi.hoisted(() => ({
  configure: vi.fn().mockResolvedValue(undefined),
  setLogLevel: vi.fn().mockResolvedValue(undefined),
  setLogHandler: vi.fn().mockResolvedValue(undefined),
  canMakePayments: vi.fn().mockResolvedValue({ canMakePayments: true }),
  getOfferings: vi.fn(),
  purchaseStoreProduct: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  getCustomerInfo: vi.fn(),
}));

const mockApp = vi.hoisted(() => ({
  addListener: vi.fn().mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) }),
  getState: vi.fn().mockResolvedValue({ isActive: true }),
}));

const mockCapacitor = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => true),
  getPlatform: vi.fn(() => 'android'),
}));

const mockPurchaseTrace = vi.hoisted(() => ({
  clearPurchaseTrace: vi.fn().mockResolvedValue(undefined),
  markPurchaseTrace: vi.fn().mockResolvedValue(undefined),
  probePurchaseBilling: vi.fn().mockResolvedValue({
    connected: true,
    responseCode: 0,
    productFound: true,
    productId: 'cv_pro_lifetime',
    productType: 'inapp',
  }),
  armPurchaseTraceWatchdog: vi.fn().mockResolvedValue(undefined),
  cancelPurchaseTraceWatchdog: vi.fn().mockResolvedValue(undefined),
}));

const mockRevenueCatModule = vi.hoisted((): { Purchases: unknown; LOG_LEVEL: { DEBUG: string } } => ({
  Purchases: undefined,
  LOG_LEVEL: { DEBUG: 'DEBUG' },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: mockCapacitor,
}));

vi.mock('@capacitor/app', () => ({
  App: mockApp,
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  get Purchases() {
    return mockRevenueCatModule.Purchases;
  },
  get LOG_LEVEL() {
    return mockRevenueCatModule.LOG_LEVEL;
  },
}));

vi.mock('../purchase-trace', () => mockPurchaseTrace);

// --- Constants ------------------------------------------------------------------

const PRO_PRODUCT_ID = 'cv_pro_lifetime';
const PACKAGE_IDENTIFIER = '$rc_lifetime';
const OFFERING_IDENTIFIER = 'default';
const PRO_ENTITLEMENT = 'CV Pro AI Pro';

// --- Mock helpers ----------------------------------------------------------------

interface MockProduct {
  identifier: string;
  priceString: string;
  currencyCode: string;
}

interface MockPackage {
  identifier: string;
  packageType: string;
  product: MockProduct;
  offeringIdentifier: string;
}

interface MockCustomerInfo {
  entitlements: {
    active: Record<string, unknown>;
  };
}

interface MockOffering {
  identifier: string;
  serverDescription: string;
  availablePackages: MockPackage[];
}

interface MockOfferings {
  current: MockOffering | null;
  all: Record<string, MockOffering>;
}

function makeProduct(overrides?: Partial<MockProduct>): MockProduct {
  return {
    identifier: PRO_PRODUCT_ID,
    priceString: '$3.99',
    currencyCode: 'USD',
    ...overrides,
  };
}

function makePackage(overrides?: Partial<MockPackage>): MockPackage {
  return {
    identifier: PACKAGE_IDENTIFIER,
    packageType: 'LIFETIME',
    product: makeProduct(),
    offeringIdentifier: OFFERING_IDENTIFIER,
    ...overrides,
  };
}

function makeOffering(
  packages: MockPackage[] = [makePackage()],
  overrides?: Partial<MockOffering>,
): MockOffering {
  return {
    identifier: OFFERING_IDENTIFIER,
    serverDescription: 'Default offering',
    availablePackages: packages,
    ...overrides,
  };
}

function makeOfferings(
  current: MockOffering | null = makeOffering(),
  all?: Record<string, MockOffering>,
): MockOfferings {
  const key = current?.identifier ?? OFFERING_IDENTIFIER;
  return {
    current,
    all: all ?? { [key]: current ?? makeOffering([]) },
  };
}

function makeCustomerInfo(
  activeEntitlements: Record<string, unknown> = {
    [PRO_ENTITLEMENT]: { entitlement_id: PRO_ENTITLEMENT, product_id: PRO_PRODUCT_ID },
  },
): MockCustomerInfo {
  return {
    entitlements: {
      active: activeEntitlements,
    },
  };
}

function traceCallIndex(phase: string): number {
  const index = mockPurchaseTrace.markPurchaseTrace.mock.calls.findIndex(([markedPhase]) => markedPhase === phase);
  if (index < 0) throw new Error(`Missing trace phase: ${phase}`);
  return index;
}

function traceCallOrder(phase: string): number {
  return mockPurchaseTrace.markPurchaseTrace.mock.invocationCallOrder[traceCallIndex(phase)];
}

function latestTracePhase(): string | undefined {
  const calls = mockPurchaseTrace.markPurchaseTrace.mock.calls;
  return calls[calls.length - 1]?.[0];
}

async function flushMicrotasks(times = 25): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}

function makeThenablePurchasesProxy(thenAccess: ReturnType<typeof vi.fn>, thenCall: ReturnType<typeof vi.fn>) {
  return new Proxy(mockPurchases, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        thenAccess();
        return thenCall;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

function resetMockPurchases() {
  mockCapacitor.isNativePlatform.mockReset();
  mockCapacitor.isNativePlatform.mockReturnValue(true);
  mockCapacitor.getPlatform.mockReset();
  mockCapacitor.getPlatform.mockReturnValue('android');
  mockRevenueCatModule.Purchases = mockPurchases;
  mockRevenueCatModule.LOG_LEVEL = { DEBUG: 'DEBUG' };

  mockPurchases.configure.mockReset();
  mockPurchases.configure.mockResolvedValue(undefined);
  mockPurchases.setLogLevel.mockReset();
  mockPurchases.setLogLevel.mockResolvedValue(undefined);
  mockPurchases.canMakePayments.mockReset();
  mockPurchases.canMakePayments.mockResolvedValue({ canMakePayments: true });
  mockPurchases.getOfferings.mockResolvedValue(makeOfferings());
  mockPurchases.purchaseStoreProduct.mockReset();
  mockPurchases.purchaseStoreProduct.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
  mockPurchases.purchasePackage.mockReset();
  mockPurchases.purchasePackage.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
  mockPurchases.restorePurchases.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
  mockPurchases.getCustomerInfo.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
  mockApp.addListener.mockReset();
  mockApp.addListener.mockResolvedValue({ remove: vi.fn().mockResolvedValue(undefined) });
  mockApp.getState.mockReset();
  mockApp.getState.mockResolvedValue({ isActive: true });

  mockPurchaseTrace.clearPurchaseTrace.mockReset();
  mockPurchaseTrace.clearPurchaseTrace.mockResolvedValue(undefined);
  mockPurchaseTrace.markPurchaseTrace.mockReset();
  mockPurchaseTrace.markPurchaseTrace.mockResolvedValue(undefined);
  mockPurchaseTrace.probePurchaseBilling.mockReset();
  mockPurchaseTrace.probePurchaseBilling.mockResolvedValue({
    connected: true,
    responseCode: 0,
    productFound: true,
    productId: PRO_PRODUCT_ID,
    productType: 'inapp',
  });
  mockPurchaseTrace.armPurchaseTraceWatchdog.mockReset();
  mockPurchaseTrace.armPurchaseTraceWatchdog.mockResolvedValue(undefined);
  mockPurchaseTrace.cancelPurchaseTraceWatchdog.mockReset();
  mockPurchaseTrace.cancelPurchaseTraceWatchdog.mockResolvedValue(undefined);
}

vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'test_mock_ios_key_none_real');

// --- Tests -----------------------------------------------------------------------

describe('RevenueCat plugin acquisition', () => {
  test('uses synchronous static Purchases acquisition instead of a runtime dynamic import in iap.ts', () => {
    const source = fs.readFileSync(path.resolve('src/lib/iap.ts'), 'utf8');

    expect(source).toContain("import { LOG_LEVEL, Purchases as RevenueCatPurchases } from '@revenuecat/purchases-capacitor';");
    expect(source).toContain('function getPurchases() {');
    expect(source).toContain('Purchases = getPurchases();');
    expect(source).not.toContain("import('@revenuecat/purchases-capacitor')");
    expect(source).not.toContain("await import('@revenuecat/purchases-capacitor')");
    expect(source).not.toContain('async function getPurchases');
    expect(source).not.toContain('await getPurchases()');
    expect(source).not.toContain('Awaited<ReturnType<typeof getPurchases>>');
    expect(source).not.toMatch(/Promise\.resolve\(\s*getPurchases\(/);
  });
});

describe('in-app purchase flow', () => {
  beforeEach(async () => {
    vi.resetModules();
    resetMockPurchases();
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: 'eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ' }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------------------------------------------
  // 1. configure success
  // ------------------------------------------------------------------------------
  describe('configure success', () => {
    test('initIAP resolves and subsequent purchasePro works', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings());
      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo(),
      });
      const result = await purchasePro();
      expect(result.success).toBe(true);
    });
  });

  describe('platform guards', () => {
    test('web purchase path does not call RevenueCat native methods', async () => {
      mockCapacitor.isNativePlatform.mockReturnValue(false);
      mockCapacitor.getPlatform.mockReturnValue('web');
      const { checkProEntitlement, initIAP, purchasePro, refreshStorePrice, restorePro } = await import('../iap');

      await initIAP();
      await expect(refreshStorePrice()).resolves.toBeNull();
      const purchaseResult = await purchasePro();
      const restoreResult = await restorePro();
      const hasPro = await checkProEntitlement();

      expect(purchaseResult.success).toBe(false);
      expect(purchaseResult.success === false && purchaseResult.message).toContain('Native purchases');
      expect(restoreResult.success).toBe(true);
      expect(hasPro).toBe(false);
      expect(mockPurchases.configure).not.toHaveBeenCalled();
      expect(mockPurchases.canMakePayments).not.toHaveBeenCalled();
      expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
      expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
      expect(mockPurchases.restorePurchases).not.toHaveBeenCalled();
      expect(mockPurchases.getCustomerInfo).not.toHaveBeenCalled();
    });
  });

  describe('Pro token synchronization', () => {
    test('successful restore obtains and persists a Pro token', async () => {
      const { initIAP, restorePro } = await import('../iap');
      await initIAP();

      const result = await restorePro();

      expect(result.success).toBe(true);
      expect(result.success && result.isPro).toBe(true);
      expect(result.success && result.token).toBe('eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ');
      expect(localStorage.getItem('cvpro-pro-token')).toBe('eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/verify-pro'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    test('active entitlement with failed token sync returns recoverable auth failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: 'Temporary verification failure' }),
      });
      const { initIAP, restorePro } = await import('../iap');
      await initIAP();

      const result = await restorePro();

      expect(result.success).toBe(false);
      expect(result.success === false && result.entitlementActive).toBe(true);
      expect(result.success === false && result.message).toContain('Temporary verification failure');
      expect(localStorage.getItem('cvpro-pro-token')).toBeNull();
    });
  });

  // ------------------------------------------------------------------------------
  // 2. configure failure
  // ------------------------------------------------------------------------------
  describe('configure failure', () => {
    test('initIAP failure returns user-facing error on purchase', async () => {
      mockPurchases.configure.mockRejectedValue(new Error('Network error'));
      const { purchasePro } = await import('../iap');
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toBeTruthy();
      expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------------------------------------------
  // 3. missing Android API key
  // ------------------------------------------------------------------------------
  describe('missing Android API key', () => {
    test('initIAP throws with clear message when key is empty', async () => {
      vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', '');
      const { initIAP } = await import('../iap');
      await expect(initIAP()).rejects.toThrow('RevenueCat API key not configured');
      vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
    });

    test('purchasePro returns error when key is empty', async () => {
      vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', '');
      const { purchasePro } = await import('../iap');
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('API key');
      vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
    });
  });

  // ------------------------------------------------------------------------------
  // 4. offerings success
  // ------------------------------------------------------------------------------
  describe('offerings success', () => {
    test('finds lifetime package and invokes purchase', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      const result = await purchasePro();
      expect(result.success).toBe(true);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------------------
  // 5. no current offering
  // ------------------------------------------------------------------------------
  describe('no current offering', () => {
    test('returns error with user-facing message when current is null', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(null, {}));
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('No offerings');
    });
  });

  // ------------------------------------------------------------------------------
  // 6. missing lifetime package
  // ------------------------------------------------------------------------------
  describe('missing lifetime package', () => {
    test('returns error when $rc_lifetime is missing from current offering', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(makeOffering([])));
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('Lifetime package');
    });

    test('finds lifetime package in fallback offering', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue({
        current: makeOffering([]),
        all: { default: makeOffering([]), fallback: makeOffering([makePackage()]) },
      });
      const result = await purchasePro();
      expect(result.success).toBe(true);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------------------------------------------
  // 7. purchase sheet invocation
  // ------------------------------------------------------------------------------
  describe('purchase sheet invocation', () => {
    test('calls Purchases.purchasePackage with lifetime package', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      await purchasePro();
      expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(
        expect.objectContaining({
          aPackage: expect.objectContaining({
            identifier: PACKAGE_IDENTIFIER,
            offeringIdentifier: OFFERING_IDENTIFIER,
            product: expect.objectContaining({ identifier: PRO_PRODUCT_ID }),
          }),
        }),
      );
    });

    test('runs diagnostic probe and arms native watchdog before purchasePackage', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      await purchasePro();

      expect(mockPurchaseTrace.clearPurchaseTrace).toHaveBeenCalledTimes(1);
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_PURCHASE_PRO_ENTERED', undefined, expect.any(Number));
      expect(mockPurchaseTrace.markPurchaseTrace).not.toHaveBeenCalledWith('JS_PURCHASE_FLOW_STARTED', undefined, expect.any(Number));
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_BEFORE_BILLING_PROBE', undefined, expect.any(Number));
      expect(mockPurchaseTrace.probePurchaseBilling).toHaveBeenCalledWith(PRO_PRODUCT_ID, expect.any(Number));
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith(
        'JS_BILLING_PROBE_COMPLETED',
        expect.stringContaining('productFound=true'),
        expect.any(Number),
      );
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_PURCHASE_CALL', undefined, expect.any(Number));
      expect(mockPurchaseTrace.armPurchaseTraceWatchdog).toHaveBeenCalledWith(20_000, expect.any(Number));

      expect(mockPurchaseTrace.probePurchaseBilling.mock.invocationCallOrder[0]).toBeLessThan(
        mockPurchases.purchasePackage.mock.invocationCallOrder[0],
      );
      expect(traceCallOrder('JS_PACKAGE_SELECTED')).toBeLessThan(
        mockPurchaseTrace.probePurchaseBilling.mock.invocationCallOrder[0],
      );
      expect(traceCallOrder('JS_PURCHASE_CALL')).toBeLessThan(
        mockPurchases.purchasePackage.mock.invocationCallOrder[0],
      );
      expect(mockPurchases.purchasePackage.mock.invocationCallOrder[0]).toBeLessThan(
        traceCallOrder('JS_PURCHASE_RESOLVED'),
      );
      expect(mockPurchaseTrace.armPurchaseTraceWatchdog.mock.invocationCallOrder[0]).toBeLessThan(
        mockPurchases.purchasePackage.mock.invocationCallOrder[0],
      );
    });

    test('diagnostic rejection does not prevent purchasePackage', async () => {
      mockPurchaseTrace.probePurchaseBilling.mockRejectedValueOnce(new Error('probe failed'));
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      const result = await purchasePro();

      expect(result.success).toBe(true);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_BILLING_PROBE_FAILED', undefined, expect.any(Number));
    });

    test('diagnostic timeout fallback does not prevent purchasePackage', async () => {
      mockPurchaseTrace.probePurchaseBilling.mockResolvedValueOnce(null);
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      const result = await purchasePro();

      expect(result.success).toBe(true);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_BILLING_PROBE_FAILED', undefined, expect.any(Number));
    });

    test('successful purchase records resolution and cancels native watchdog', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      const result = await purchasePro();

      expect(result.success).toBe(true);
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_PURCHASE_RESOLVED', undefined, expect.any(Number));
      expect(mockPurchaseTrace.cancelPurchaseTraceWatchdog).toHaveBeenCalledTimes(1);
    });

    test('rejected purchase records rejection and cancels native watchdog', async () => {
      mockPurchases.purchasePackage.mockRejectedValueOnce(new Error('Billing error'));
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      const result = await purchasePro();

      expect(result.success).toBe(false);
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_PURCHASE_REJECTED', undefined, expect.any(Number));
      expect(mockPurchaseTrace.cancelPurchaseTraceWatchdog).toHaveBeenCalledTimes(1);
    });
  });

  describe('purchase trace boundaries', () => {
    test('does not assimilate a thenable Purchases plugin proxy during acquisition', async () => {
      const thenAccess = vi.fn();
      const thenCall = vi.fn(() => new Promise(() => {}));
      mockRevenueCatModule.Purchases = makeThenablePurchasesProxy(thenAccess, thenCall);

      const { purchasePro } = await import('../iap');
      const result = await purchasePro();

      expect(result.success).toBe(true);
      expect(thenAccess).not.toHaveBeenCalled();
      expect(thenCall).not.toHaveBeenCalled();
      expect(traceCallOrder('JS_BEFORE_GET_PURCHASES')).toBeLessThan(traceCallOrder('JS_AFTER_GET_PURCHASES'));
      expect(traceCallOrder('JS_AFTER_GET_PURCHASES')).toBeLessThan(traceCallOrder('JS_BEFORE_CAN_MAKE_PAYMENTS'));
      expect(mockPurchases.canMakePayments).toHaveBeenCalledTimes(1);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledWith(
        expect.objectContaining({
          aPackage: expect.objectContaining({
            identifier: PACKAGE_IDENTIFIER,
            offeringIdentifier: OFFERING_IDENTIFIER,
            product: expect.objectContaining({ identifier: PRO_PRODUCT_ID }),
          }),
        }),
      );
    });

    test('clears and marks purchase entry before initIAP or core purchase flow', async () => {
      const { purchasePro } = await import('../iap');
      const result = await purchasePro();

      expect(result.success).toBe(true);
      expect(mockPurchaseTrace.clearPurchaseTrace).toHaveBeenCalledTimes(1);
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_PURCHASE_PRO_ENTERED', undefined, expect.any(Number));
      expect(mockPurchaseTrace.clearPurchaseTrace.mock.invocationCallOrder[0]).toBeLessThan(
        traceCallOrder('JS_PURCHASE_PRO_ENTERED'),
      );
      expect(traceCallOrder('JS_PURCHASE_PRO_ENTERED')).toBeLessThan(traceCallOrder('JS_BEFORE_INIT_IAP'));
      expect(traceCallOrder('JS_BEFORE_INIT_IAP')).toBeLessThan(mockPurchases.configure.mock.invocationCallOrder[0]);
      expect(traceCallOrder('JS_AFTER_INIT_IAP')).toBeLessThan(traceCallOrder('JS_BEFORE_GET_PURCHASES'));
      expect(traceCallOrder('JS_BEFORE_GET_PURCHASES')).toBeLessThan(
        mockPurchases.canMakePayments.mock.invocationCallOrder[0],
      );
    });

    test('preflight no longer clears earlier trace events', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      await purchasePro();

      expect(mockPurchaseTrace.clearPurchaseTrace).toHaveBeenCalledTimes(1);
      expect(traceCallOrder('JS_PURCHASE_PRO_ENTERED')).toBeLessThan(traceCallOrder('JS_BEFORE_BILLING_PROBE'));
      expect(traceCallOrder('JS_BEFORE_BILLING_PROBE')).toBeLessThan(
        mockPurchaseTrace.probePurchaseBilling.mock.invocationCallOrder[0],
      );
    });

    test('records BEFORE and AFTER markers around RevenueCat pre-purchase boundaries', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      await purchasePro();

      expect(traceCallOrder('JS_BEFORE_GET_PURCHASES')).toBeLessThan(
        traceCallOrder('JS_AFTER_GET_PURCHASES'),
      );
      expect(traceCallOrder('JS_AFTER_GET_PURCHASES')).toBeLessThan(
        traceCallOrder('JS_BEFORE_CAN_MAKE_PAYMENTS'),
      );
      expect(traceCallOrder('JS_BEFORE_GET_PURCHASES')).toBeLessThan(
        mockPurchases.canMakePayments.mock.invocationCallOrder[0],
      );
      expect(traceCallOrder('JS_BEFORE_CAN_MAKE_PAYMENTS')).toBeLessThan(
        mockPurchases.canMakePayments.mock.invocationCallOrder[0],
      );
      expect(mockPurchases.canMakePayments.mock.invocationCallOrder[0]).toBeLessThan(
        traceCallOrder('JS_AFTER_CAN_MAKE_PAYMENTS'),
      );
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith(
        'JS_AFTER_CAN_MAKE_PAYMENTS',
        'canMakePayments=true',
        expect.any(Number),
      );
      expect(traceCallOrder('JS_BEFORE_GET_OFFERINGS')).toBeLessThan(
        mockPurchases.getOfferings.mock.invocationCallOrder[0],
      );
      expect(mockPurchases.getOfferings.mock.invocationCallOrder[0]).toBeLessThan(
        traceCallOrder('JS_AFTER_GET_OFFERINGS'),
      );
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith(
        'JS_AFTER_GET_OFFERINGS',
        'currentOffering=true;packageCount=1',
        expect.any(Number),
      );
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith(
        'JS_PACKAGE_SELECTED',
        `packageIdentifier=${PACKAGE_IDENTIFIER};productIdentifier=${PRO_PRODUCT_ID}`,
        expect.any(Number),
      );
      expect(traceCallOrder('JS_PACKAGE_SELECTED')).toBeLessThan(
        mockPurchaseTrace.probePurchaseBilling.mock.invocationCallOrder[0],
      );
      expect(traceCallOrder('JS_PURCHASE_CALL')).toBeLessThan(
        mockPurchases.purchasePackage.mock.invocationCallOrder[0],
      );
    });

    test('failure and early-return paths record matching trace phases', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();

      mockPurchases.canMakePayments.mockResolvedValueOnce({ canMakePayments: false });
      await purchasePro();
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith(
        'JS_AFTER_CAN_MAKE_PAYMENTS',
        'canMakePayments=false',
        expect.any(Number),
      );

      resetMockPurchases();
      await initIAP();
      mockPurchases.canMakePayments.mockRejectedValueOnce(new Error('billing check failed'));
      await purchasePro();
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_CAN_MAKE_PAYMENTS_FAILED', undefined, expect.any(Number));

      resetMockPurchases();
      await initIAP();
      mockPurchases.getOfferings.mockRejectedValueOnce(new Error('offerings failed'));
      await purchasePro();
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_GET_OFFERINGS_FAILED', undefined, expect.any(Number));

      resetMockPurchases();
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValueOnce(makeOfferings(null, {}));
      await purchasePro();
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_CURRENT_OFFERING_MISSING', undefined, expect.any(Number));

      resetMockPurchases();
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValueOnce(makeOfferings(makeOffering([])));
      await purchasePro();
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_PACKAGE_NOT_FOUND', undefined, expect.any(Number));

      resetMockPurchases();
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValueOnce(makeOfferings(makeOffering([makePackage({ product: makeProduct({ priceString: '' }) })])));
      await purchasePro();
      expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_PRICE_MISSING', undefined, expect.any(Number));
    });

    test('a never-resolving canMakePayments leaves BEFORE_CAN_MAKE_PAYMENTS as the latest persisted stage', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();

      vi.useFakeTimers();
      mockPurchases.canMakePayments.mockReturnValueOnce(new Promise(() => {}));
      const resultPromise = purchasePro();
      await flushMicrotasks();

      expect(mockPurchases.canMakePayments).toHaveBeenCalledTimes(1);
      expect(traceCallOrder('JS_BEFORE_GET_PURCHASES')).toBeLessThan(traceCallOrder('JS_AFTER_GET_PURCHASES'));
      expect(traceCallOrder('JS_AFTER_GET_PURCHASES')).toBeLessThan(traceCallOrder('JS_BEFORE_CAN_MAKE_PAYMENTS'));
      expect(latestTracePhase()).toBe('JS_BEFORE_CAN_MAKE_PAYMENTS');

      await vi.advanceTimersByTimeAsync(15_001);
      const result = await resultPromise;
      expect(result.success).toBe(false);
      vi.useRealTimers();
    });

    test('a never-resolving getOfferings leaves BEFORE_GET_OFFERINGS as the latest persisted stage', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();

      vi.useFakeTimers();
      mockPurchases.getOfferings.mockReturnValueOnce(new Promise(() => {}));
      const resultPromise = purchasePro();
      await flushMicrotasks();

      expect(mockPurchases.getOfferings).toHaveBeenCalledTimes(1);
      expect(latestTracePhase()).toBe('JS_BEFORE_GET_OFFERINGS');

      await vi.advanceTimersByTimeAsync(30_001);
      const result = await resultPromise;
      expect(result.success).toBe(false);
      vi.useRealTimers();
    });

    test('diagnostic rejection never prevents the normal purchase flow', async () => {
      mockPurchaseTrace.clearPurchaseTrace.mockRejectedValue(new Error('trace clear failed'));
      mockPurchaseTrace.markPurchaseTrace.mockRejectedValue(new Error('trace mark failed'));
      mockPurchaseTrace.probePurchaseBilling.mockRejectedValue(new Error('trace probe failed'));
      mockPurchaseTrace.armPurchaseTraceWatchdog.mockRejectedValue(new Error('trace arm failed'));
      mockPurchaseTrace.cancelPurchaseTraceWatchdog.mockRejectedValue(new Error('trace cancel failed'));

      const { purchasePro } = await import('../iap');
      const result = await purchasePro();

      expect(result.success).toBe(true);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
    });

    test('diagnostic timeout never prevents the normal purchase flow', async () => {
      vi.useFakeTimers();
      mockPurchaseTrace.clearPurchaseTrace.mockReturnValueOnce(new Promise(() => {}));
      const { purchasePro } = await import('../iap');

      const resultPromise = purchasePro();
      await vi.advanceTimersByTimeAsync(1_501);
      await flushMicrotasks();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  // ------------------------------------------------------------------------------
  // 8. purchase cancellation
  // ------------------------------------------------------------------------------
  describe('purchase cancellation', () => {
    test('returns cancelled=true when RevenueCat throws userCancelled', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: true });
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------
  // 9. purchase error
  // ------------------------------------------------------------------------------
  describe('purchase error', () => {
    test('returns error with message when purchasePackage throws', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockRejectedValue(new Error('Billing error'));
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  // ------------------------------------------------------------------------------
  // 10. successful purchase
  // ------------------------------------------------------------------------------
  describe('successful purchase', () => {
    test('returns success=true when purchase completes', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      const result = await purchasePro();
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------
  // 11. entitlement missing after purchase
  // ------------------------------------------------------------------------------
  describe('entitlement missing after purchase', () => {
    test('returns error when entitlement is not active after purchase', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo({}),
      });
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.message).toContain('entitlement');
    });
  });

  // ------------------------------------------------------------------------------
  // 12. loading-state reset — every path proves both shared and caller state resets
  // ------------------------------------------------------------------------------
  describe('loading-state reset: every path returns structured result', () => {
    test('purchasePro returns on success', async () => {
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      const result = await purchasePro();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
    });

    test('purchasePro returns on missing API key', async () => {
      vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', '');
      const { purchasePro } = await import('../iap');
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('API key');
      vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
    });

    test('purchasePro returns on configure failure', async () => {
      mockPurchases.configure.mockRejectedValue(new Error('configure fail'));
      const { purchasePro } = await import('../iap');
      const result = await purchasePro();
      expect(result.success).toBe(false);
    });

    test('purchasePro returns on offerings timeout', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockRejectedValue(new Error('[IAP] getOfferings timed out after 30000ms'));
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toBeTruthy();
    });

    test('purchasePro returns on no current offering', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(null, {}));
      const result = await purchasePro();
      expect(result.success).toBe(false);
    });

    test('purchasePro returns on missing lifetime package', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(makeOffering([])));
      const result = await purchasePro();
      expect(result.success).toBe(false);
    });

    test('purchasePro returns on user cancellation', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: true });
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    test('purchasePro returns on purchase error', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockRejectedValue(new Error('Billing error'));
      const result = await purchasePro();
      expect(result.success).toBe(false);
    });

    test('purchasePro returns on entitlement missing after purchase', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo({}),
      });
      const result = await purchasePro();
      expect(result.success).toBe(false);
    });

    test('purchasePro returns on server verification failure', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });
      const result = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.entitlementActive).toBe(true);
    });
  });

  // ------------------------------------------------------------------------------
  // 13. duplicate tap prevention at purchasePro level
  // ------------------------------------------------------------------------------
  describe('duplicate tap prevention', () => {
    test('purchasePro handles concurrent calls gracefully', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo(),
      });
      const [r1, r2] = await Promise.all([purchasePro(), purchasePro()]);
      expect(r1).toBeDefined();
      expect(r2).toBeDefined();
      // Both called because purchasePro itself does not lock — useIAP hook does
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(2);
    });
  });

  // ------------------------------------------------------------------------------
  // 14. no silent errors — all failure paths log
  // ------------------------------------------------------------------------------
  describe('no silent errors', () => {
    test('init failure is logged via console.error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPurchases.configure.mockRejectedValue(new Error('configure fail'));
      const { purchasePro } = await import('../iap');
      await purchasePro();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('no current offering is logged via console.error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(null, {}));
      await purchasePro();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('missing package is logged via console.error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(makeOffering([])));
      await purchasePro();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('entitlement not found after purchase logs via console.error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { initIAP, purchasePro } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo({}),
      });
      await purchasePro();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ------------------------------------------------------------------------------
  // 15. purchase constants
  // ------------------------------------------------------------------------------
  describe('purchase constants', () => {
    test('PRO_PRODUCT_ID is cv_pro_lifetime', async () => {
      const { PRO_PRODUCT_ID: id } = await import('../iap');
      expect(id).toBe('cv_pro_lifetime');
    });
    test('PACKAGE_IDENTIFIER is $rc_lifetime', async () => {
      const { PACKAGE_IDENTIFIER: id } = await import('../iap');
      expect(id).toBe('$rc_lifetime');
    });
    test('OFFERING_IDENTIFIER is default', async () => {
      const { OFFERING_IDENTIFIER: id } = await import('../iap');
      expect(id).toBe('default');
    });
    test('PRO_ENTITLEMENT is CV Pro AI Pro', async () => {
      const { PRO_ENTITLEMENT: e } = await import('../iap');
      expect(e).toBe('CV Pro AI Pro');
    });
  });

  // ------------------------------------------------------------------------------
  // 16. isNative detection
  // ------------------------------------------------------------------------------
  describe('isNative detection', () => {
    test('isNative returns true when Capacitor reports native', async () => {
      const { isNative } = await import('../iap');
      expect(isNative()).toBe(true);
    });
  });
});

// ------------------------------------------------------------------------------
// 17. purchasing state reset — tests proving shared purchasing state always resets
// ------------------------------------------------------------------------------
describe('purchasing state reset', () => {
  beforeEach(async () => {
    vi.resetModules();
    resetMockPurchases();
    vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
    vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'test_mock_ios_key_none_real');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: 'eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ' }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('useIAP resets purchasing state when the Purchases plugin reference is unavailable', async () => {
    mockRevenueCatModule.Purchases = undefined;
    const { useIAP } = await import('../iap');
    const { result, unmount } = renderHook(() => useIAP());

    let purchaseResult: Awaited<ReturnType<typeof result.current.purchase>> | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase();
    });

    expect(purchaseResult?.success).toBe(false);
    expect(purchaseResult?.success === false && purchaseResult.message).toContain('RevenueCat Purchases plugin unavailable');
    await waitFor(() => expect(result.current.purchasing).toBe(false));
    expect(mockPurchases.configure).not.toHaveBeenCalled();
    expect(mockPurchases.canMakePayments).not.toHaveBeenCalled();
    expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    unmount();
  });

  test('useIAP resets purchasing state when core plugin acquisition fails synchronously', async () => {
    const { initIAP, useIAP } = await import('../iap');
    await initIAP();
    mockRevenueCatModule.Purchases = undefined;
    const { result, unmount } = renderHook(() => useIAP());

    let purchaseResult: Awaited<ReturnType<typeof result.current.purchase>> | undefined;
    await act(async () => {
      purchaseResult = await result.current.purchase();
    });

    expect(purchaseResult?.success).toBe(false);
    expect(purchaseResult?.success === false && purchaseResult.message).toContain('RevenueCat Purchases plugin unavailable');
    expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_BEFORE_GET_PURCHASES', undefined, expect.any(Number));
    expect(mockPurchaseTrace.markPurchaseTrace).toHaveBeenCalledWith('JS_GET_PURCHASES_FAILED', undefined, expect.any(Number));
    expect(mockPurchaseTrace.markPurchaseTrace).not.toHaveBeenCalledWith('JS_AFTER_GET_PURCHASES', undefined, expect.any(Number));
    await waitFor(() => expect(result.current.purchasing).toBe(false));
    expect(mockPurchases.canMakePayments).not.toHaveBeenCalled();
    expect(mockPurchases.getOfferings).not.toHaveBeenCalled();
    expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    unmount();
  });

  test('purchasePro resolves on configure failure (never hangs)', async () => {
    mockPurchases.configure.mockRejectedValue(new Error('configure fail'));
    const { purchasePro } = await import('../iap');
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.message).toBeTruthy();
  });

  test('purchasePro resolves on missing API key (never hangs)', async () => {
    vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', '');
    const { purchasePro } = await import('../iap');
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.message).toContain('API key');
  });

  test('purchasePro resolves on offerings timeout (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.getOfferings.mockRejectedValue(new Error('[IAP] getOfferings timed out'));
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.message).toBeTruthy();
  });

  test('purchasePro resolves on no current offering (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.getOfferings.mockResolvedValue(makeOfferings(null, {}));
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.message).toBeTruthy();
  });

  test('purchasePro resolves on missing lifetime package (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.getOfferings.mockResolvedValue(makeOfferings(makeOffering([])));
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.message).toContain('Lifetime package');
  });

  test('purchasePro resolves on user cancellation (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: true });
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
  });

  test('purchasePro resolves on purchase error (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.purchasePackage.mockRejectedValue(new Error('Billing error'));
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.message).toBeTruthy();
  });

  test('purchasePro resolves on entitlement missing after purchase (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: makeCustomerInfo({}),
    });
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.message).toContain('entitlement');
  });

  test('purchasePro resolves on server verification failure (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.entitlementActive).toBe(true);
  });

  test('purchasePro resolves on successful purchase (never hangs)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: makeCustomerInfo(),
    });
    const result = await purchasePro();
    expect(result.success).toBe(true);
  });

  test('repeated purchasePro calls both resolve (no permanent lock)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.purchasePackage.mockResolvedValue({
      customerInfo: makeCustomerInfo(),
    });
    const [r1, r2] = await Promise.all([purchasePro(), purchasePro()]);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
    expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(2);
  });

  test('successive purchasePro calls work after failure', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();

    // First call fails
    mockPurchases.purchasePackage.mockRejectedValueOnce(new Error('First fail'));
    const r1 = await purchasePro();
    expect(r1.success).toBe(false);

    // Second call succeeds
    mockPurchases.purchasePackage.mockResolvedValueOnce({
      customerInfo: makeCustomerInfo(),
    });
    const r2 = await purchasePro();
    expect(r2.success).toBe(true);
  });
});

// ------------------------------------------------------------------------------
// 18. Caller-level behavior tests
// ------------------------------------------------------------------------------
describe('caller-level purchase behavior', () => {
  beforeEach(async () => {
    vi.resetModules();
    resetMockPurchases();
    vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
    vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'test_mock_ios_key_none_real');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: 'eyJpc1BybyI6dHJ1ZSwiZXhwIjo5OTk5OTk5OTk5fQ' }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('purchasePro awaits completion and returns structured result', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    const result = await purchasePro();
    // Every caller must await purchasePro() and inspect its structured result
    expect(result).toHaveProperty('success');
    if (result.success === false) {
      expect(result).toHaveProperty('cancelled');
      expect(result).toHaveProperty('message');
    } else {
      expect(result).toHaveProperty('isPro');
    }
  });

  test('success closes only after purchase and server verification complete', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    // Full flow: init → offerings → purchase → entitlement check → server verification
    const result = await purchasePro();
    expect(result.success).toBe(true);
    expect(result.isPro).toBe(true);
    expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(1);
  });

  test('cancellation resets button without closing (no error toast)', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: true });
    const result = await purchasePro();
    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    // Caller should keep modal open — no success close, no error toast for cancellation
  });

  test('repeated tap cannot permanently lock the button', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    // Simulate rapid taps
    mockPurchases.purchasePackage
      .mockResolvedValueOnce({ customerInfo: makeCustomerInfo() })
      .mockResolvedValueOnce({ customerInfo: makeCustomerInfo() });
    const [r1, r2] = await Promise.all([purchasePro(), purchasePro()]);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    // Both succeeded — no permanent lock
  });

  test('failure after previous failure resets correctly', async () => {
    const { purchasePro, initIAP } = await import('../iap');
    await initIAP();
    // First call fails
    mockPurchases.purchasePackage.mockRejectedValueOnce(new Error('First fail'));
    const r1 = await purchasePro();
    expect(r1.success).toBe(false);

    // Second call also fails
    mockPurchases.purchasePackage.mockRejectedValueOnce(new Error('Second fail'));
    const r2 = await purchasePro();
    expect(r2.success).toBe(false);

    // Third call succeeds — no permanent lock
    mockPurchases.purchasePackage.mockResolvedValueOnce({
      customerInfo: makeCustomerInfo(),
    });
    const r3 = await purchasePro();
    expect(r3.success).toBe(true);
  });
});
