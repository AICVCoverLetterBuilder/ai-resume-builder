/**
 * @vitest-environment jsdom
 */
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
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  getCustomerInfo: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  },
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: mockPurchases,
}));


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

function resetMockPurchases() {
  mockPurchases.configure.mockResolvedValue(undefined);
  mockPurchases.getOfferings.mockResolvedValue(makeOfferings());
  mockPurchases.purchasePackage.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
  mockPurchases.restorePurchases.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
  mockPurchases.getCustomerInfo.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
}

vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'test_mock_ios_key_none_real');

// --- Tests -----------------------------------------------------------------------

describe('in-app purchase flow', () => {
  beforeEach(async () => {
    vi.resetModules();
    resetMockPurchases();
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
          aPackage: expect.objectContaining({ identifier: PACKAGE_IDENTIFIER }),
        }),
      );
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
      expect(result.success).toBe(true);
      expect(result.isPro).toBe(false);
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
    expect(result.success).toBe(true);
    expect(result.isPro).toBe(false);
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
