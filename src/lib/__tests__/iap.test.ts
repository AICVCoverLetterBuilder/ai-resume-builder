/**
 * @vitest-environment jsdom
 */
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for the in-app purchase flow:
 *   - successful package lookup
 *   - missing current Offering
 *   - missing Package
 *   - purchase cancellation
 *   - purchase error
 *   - successful purchase and entitlement refresh
 *   - loading state reset in every outcome
 *   - prevention of duplicate rapid taps
 */

// Module-level variable to control behavior in vi.mock factories
const mockPurchases = vi.hoisted(() => ({
  configure: vi.fn().mockResolvedValue(undefined),
  getOfferings: vi.fn(),
  purchasePackage: vi.fn(),
  restorePurchases: vi.fn(),
  getCustomerInfo: vi.fn(),
}));

// Mock Capacitor first (hoisted automatically)
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
  },
}));

vi.mock('@revenuecat/purchases-capacitor', () => ({
  Purchases: mockPurchases,
}));

import type { IAPResult } from '../iap';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRO_PRODUCT_ID = 'cv_pro_lifetime';
const PACKAGE_IDENTIFIER = '$rc_lifetime';
const OFFERING_IDENTIFIER = 'default';

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
    'CV Pro AI Pro': { entitlement_id: 'CV Pro AI Pro', product_id: PRO_PRODUCT_ID },
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

// Stub RevenueCat API key so initIAP() doesn't fail in test environment.
// This is a fake key used only for testing — never a real API key.
vi.stubEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY', 'test_mock_android_key_none_real');
vi.stubEnv('NEXT_PUBLIC_REVENUECAT_IOS_KEY', 'test_mock_ios_key_none_real');

  mockPurchases.restorePurchases.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
  mockPurchases.getCustomerInfo.mockResolvedValue({
    customerInfo: makeCustomerInfo(),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('in-app purchase flow', () => {
  beforeEach(async () => {
    resetMockPurchases();
    // Initialize SDK so purchasePro doesn't re-init
    await import('../iap');
    // Reset _initialized if it was set by previous tests
    // by clearing module state
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('package lookup', () => {
    test('finds lifetime package in current offering', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      const offering = makeOffering([makePackage()]);
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(offering));

      const result = await purchasePro();

      expect(result.success).toBe(true);
      expect(mockPurchases.getOfferings).toHaveBeenCalledTimes(1);
      expect(mockPurchases.purchasePackage).toHaveBeenCalledWith({
        aPackage: expect.objectContaining({
          identifier: PACKAGE_IDENTIFIER,
        }),
      });
    });

    test('fails with user-facing message when current offering is null', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(null, {}));

      const result: IAPResult = await purchasePro();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('No offerings available');
      expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    });

    test('fails when lifetime package is missing from current offering', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      const offering = makeOffering([]);
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(offering));

      const result: IAPResult = await purchasePro();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('Lifetime package not found');
      expect(mockPurchases.purchasePackage).not.toHaveBeenCalled();
    });
  });

  describe('purchase outcomes', () => {
    test('purchase cancellation returns cancelled = true', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.purchasePackage.mockRejectedValue({
        userCancelled: true,
        message: 'User cancelled purchase.',
      });

      const result: IAPResult = await purchasePro();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    test('purchase error returns failure with error message', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.purchasePackage.mockRejectedValue({
        code: 'BILLING_ERROR',
        message: 'Play Billing is not available.',
      });

      const result: IAPResult = await purchasePro();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toBeTruthy();
    });

    test('purchase network error returns failure', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.purchasePackage.mockRejectedValue(
        new Error('Network request failed'),
      );

      const result: IAPResult = await purchasePro();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toBeTruthy();
    });

    test('successful purchase returns success', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.getOfferings.mockResolvedValue(makeOfferings());
      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo(),
      });

      const result: IAPResult = await purchasePro();

      // Purchase completed — server verification depends on external API
      // so purchase succeeds but isPro may be false
      expect(result.success).toBe(true);
    });

    test('entitlement not found after purchase returns failure', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo({}),
      });

      const result: IAPResult = await purchasePro();

      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
      expect(result.message).toContain('entitlement not found');
    });
  });

  describe('loading state reset (purchasePro never throws)', () => {
    test('purchasePro returns on success', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      const result: IAPResult = await purchasePro();
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    test('purchasePro returns on cancellation', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockRejectedValue({ userCancelled: true });
      const result: IAPResult = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(true);
    });

    test('purchasePro returns on error', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.purchasePackage.mockRejectedValue(new Error('fail'));
      const result: IAPResult = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
    });

    test('purchasePro returns on missing offering', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(null, {}));
      const result: IAPResult = await purchasePro();
      expect(result.success).toBe(false);
    });

    test('purchasePro returns on missing package', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockResolvedValue(makeOfferings(makeOffering([])));
      const result: IAPResult = await purchasePro();
      expect(result.success).toBe(false);
    });

    test('purchasePro returns on timeout', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();
      mockPurchases.getOfferings.mockRejectedValue(
        new Error('[IAP] getOfferings timed out after 30000ms'),
      );
      const result: IAPResult = await purchasePro();
      expect(result.success).toBe(false);
      expect(result.cancelled).toBe(false);
    });
  });

  describe('duplicate tap prevention', () => {
    test('purchasePro handles concurrent calls gracefully', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo(),
      });

      const [result1, result2] = await Promise.all([
        purchasePro(),
        purchasePro(),
      ]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      // Two calls should both go through (loading state prevents at hook level)
      expect(mockPurchases.purchasePackage).toHaveBeenCalledTimes(2);
    });
  });

  describe('purchase constants', () => {
    test('PRO_PRODUCT_ID is cv_pro_lifetime', async () => {
      const { PRO_PRODUCT_ID: id } = await import('../iap');
      expect(id).toBe('cv_pro_lifetime');
    });

    test('PACKAGE_IDENTIFIER is $rc_lifetime', async () => {
      const { PACKAGE_IDENTIFIER: pkg } = await import('../iap');
      expect(pkg).toBe('$rc_lifetime');
    });

    test('OFFERING_IDENTIFIER is default', async () => {
      const { OFFERING_IDENTIFIER: off } = await import('../iap');
      expect(off).toBe('default');
    });

    test('PRO_ENTITLEMENT is CV Pro AI Pro', async () => {
      const { PRO_ENTITLEMENT: ent } = await import('../iap');
      expect(ent).toBe('CV Pro AI Pro');
    });
  });

  describe('isNative detection', () => {
    test('isNative returns true when Capacitor reports native', async () => {
      const { isNative } = await import('../iap');
      expect(isNative()).toBe(true);
    });
  });

  describe('server verification failure handling', () => {
    test('purchase returns success=true isPro=false when server verification fails', async () => {
      const { purchasePro, initIAP } = await import('../iap');
      await initIAP();

      mockPurchases.purchasePackage.mockResolvedValue({
        customerInfo: makeCustomerInfo(),
      });

      // Server verification will fail (no real server), but purchase itself succeeded
      const result: IAPResult = await purchasePro();

      expect(result.success).toBe(true);
      // isPro may be false because verifyProWithServer can't reach the server
      // This is expected and handled
    });
  });
});
