import { describe, expect, test } from 'vitest';

// ─── Helper: simulate the RevenueCat V2 active_entitlements API response ──────

interface V2ActiveEntitlement {
  entitlement_id: string;
  product_id: string;
  starts_at: string | null;
  expires_at: string | null;
  grace_period_expires_at: string | null;
  store: string;
}

interface V2ActiveEntitlementsResponse {
  items: V2ActiveEntitlement[];
}

/**
 * Pure function: given a V2 API response and our entitlement ID,
 * determine if the user is Pro.
 */
function isProFromV2Response(
  response: V2ActiveEntitlementsResponse,
  expectedEntitlementId: string,
): boolean {
  return (
    Array.isArray(response.items) &&
    response.items.some((item) => item.entitlement_id === expectedEntitlementId)
  );
}

// ─── Status classification helpers ────────────────────────────────────────────

const RC_SERVER_ERROR_STATUSES = new Set([401, 403, 429]);
const RC_RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function isConfigurationError(status: number): boolean {
  return RC_SERVER_ERROR_STATUSES.has(status);
}

function isRetryable(status: number): boolean {
  return RC_RETRYABLE_STATUSES.has(status);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

const TARGET_ENTITLEMENT_ID = 'entl_test_target';

describe('RevenueCat V2 active_entitlements response parsing', () => {
  describe('isProFromV2Response', () => {
    test('matching active entitlement → Pro true', () => {
      const response: V2ActiveEntitlementsResponse = {
        items: [
          {
            entitlement_id: TARGET_ENTITLEMENT_ID,
            product_id: 'cv_pro_lifetime',
            starts_at: '2024-01-01T00:00:00Z',
            expires_at: null,
            grace_period_expires_at: null,
            store: 'play_store',
          },
        ],
      };
      expect(isProFromV2Response(response, TARGET_ENTITLEMENT_ID)).toBe(true);
    });

    test('empty items → Pro false', () => {
      const response: V2ActiveEntitlementsResponse = { items: [] };
      expect(isProFromV2Response(response, TARGET_ENTITLEMENT_ID)).toBe(false);
    });

    test('different entitlement present → Pro false', () => {
      const response: V2ActiveEntitlementsResponse = {
        items: [
          {
            entitlement_id: 'entl_other_entitlement',
            product_id: 'other_product',
            starts_at: '2024-01-01T00:00:00Z',
            expires_at: null,
            grace_period_expires_at: null,
            store: 'play_store',
          },
        ],
      };
      expect(isProFromV2Response(response, TARGET_ENTITLEMENT_ID)).toBe(false);
    });

    test('lifetime entitlement with null expires_at → Pro true', () => {
      const response: V2ActiveEntitlementsResponse = {
        items: [
          {
            entitlement_id: TARGET_ENTITLEMENT_ID,
            product_id: 'cv_pro_lifetime',
            starts_at: '2024-06-01T00:00:00Z',
            expires_at: null,
            grace_period_expires_at: null,
            store: 'play_store',
          },
        ],
      };
      // Lifetime purchases return expires_at: null but are still active —
      // the V2 active_entitlements endpoint only returns currently active items.
      expect(isProFromV2Response(response, TARGET_ENTITLEMENT_ID)).toBe(true);
    });

    test('multiple entitlements with target present → Pro true', () => {
      const response: V2ActiveEntitlementsResponse = {
        items: [
          { entitlement_id: 'entl_other', product_id: 'p1', starts_at: null, expires_at: null, grace_period_expires_at: null, store: 'play_store' },
          { entitlement_id: TARGET_ENTITLEMENT_ID, product_id: 'cv_pro_lifetime', starts_at: '2024-01-01T00:00:00Z', expires_at: null, grace_period_expires_at: null, store: 'play_store' },
        ],
      };
      expect(isProFromV2Response(response, TARGET_ENTITLEMENT_ID)).toBe(true);
    });

    test('null items field → Pro false', () => {
      const response = { items: null } as unknown as V2ActiveEntitlementsResponse;
      expect(isProFromV2Response(response, TARGET_ENTITLEMENT_ID)).toBe(false);
    });

    test('undefined items field → Pro false', () => {
      const response = {} as V2ActiveEntitlementsResponse;
      expect(isProFromV2Response(response, TARGET_ENTITLEMENT_ID)).toBe(false);
    });
  });

  describe('HTTP status classification', () => {
    test('401 is a configuration error', () => {
      expect(isConfigurationError(401)).toBe(true);
    });

    test('403 is a configuration error', () => {
      expect(isConfigurationError(403)).toBe(true);
    });

    test('429 is a configuration error (retryable)', () => {
      expect(isConfigurationError(429)).toBe(true);
    });

    test('200/404 are NOT configuration errors', () => {
      expect(isConfigurationError(200)).toBe(false);
      expect(isConfigurationError(404)).toBe(false);
    });

    test('429 is retryable', () => {
      expect(isRetryable(429)).toBe(true);
    });

    test('5xx statuses are retryable', () => {
      expect(isRetryable(502)).toBe(true);
      expect(isRetryable(503)).toBe(true);
      expect(isRetryable(504)).toBe(true);
    });

    test('401/403 are NOT retryable', () => {
      expect(isRetryable(401)).toBe(false);
      expect(isRetryable(403)).toBe(false);
    });
  });
});