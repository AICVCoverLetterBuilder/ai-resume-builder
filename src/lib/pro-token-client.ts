/**
 * Browser-safe Pro-token usability checks.
 *
 * This deliberately does not verify the signature. The server remains the
 * authority for signature and entitlement validation; the client only decides
 * whether a persisted token is usable for the click-time gate.
 */

import { AI_CLIENT_TIMEOUT_MS, AI_RESPONSE_GUARD_MS } from './ai-request-timing';
import {
  INTERNAL_TEST_PRO_TOKEN_AUDIENCE,
  isInternalTestClientCapabilityEnabled,
} from './internal-test-pro-entitlement';

export type ProEntitlementSource = 'commercial' | 'internal_test' | 'none';

/** One admitted token must outlive the complete bounded AI operation. */
export const AI_PRO_TOKEN_OPERATION_LEASE_MS = AI_CLIENT_TIMEOUT_MS + AI_RESPONSE_GUARD_MS;

function base64UrlDecode(value: string): string {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  return atob(base64);
}

/**
 * A token is client-usable only when it decodes to an explicit Pro payload
 * with a finite expiration and the caller-required remaining lifetime.
 * Signature authority remains exclusively server-side.
 */
export function isUsableProToken(
  token: string | null | undefined,
  now = Date.now(),
  minimumRemainingMs = 0,
): boolean {
  if (!token) return false;
  if (!Number.isFinite(now) || !Number.isFinite(minimumRemainingMs) || minimumRemainingMs < 0) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const payloadPart = parts[0];
    const decoded: unknown = JSON.parse(base64UrlDecode(payloadPart));
    if (!decoded || typeof decoded !== 'object') return false;
    const payload = decoded as { isPro?: unknown; exp?: unknown; source?: unknown; audience?: unknown };
    const internalTestToken = payload.source === 'internal_test';
    if (internalTestToken && (!isInternalTestClientCapabilityEnabled()
      || payload.audience !== INTERNAL_TEST_PRO_TOKEN_AUDIENCE)) return false;
    if (payload.source !== undefined && payload.source !== 'commercial' && !internalTestToken) return false;
    const remainingMs = typeof payload.exp === 'number' ? payload.exp - now : Number.NaN;
    return payload.isPro === true
      && typeof payload.exp === 'number'
      && Number.isFinite(payload.exp)
      && remainingMs > 0
      && remainingMs >= minimumRemainingMs;
  } catch {
    return false;
  }
}

/** Read the signed token's non-secret entitlement source for diagnostics only. */
export function readProTokenEntitlementSource(token: string | null | undefined): ProEntitlementSource {
  if (!token) return 'none';
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0]) return 'none';
    const decoded: unknown = JSON.parse(base64UrlDecode(parts[0]));
    if (!decoded || typeof decoded !== 'object') return 'none';
    const payload = decoded as { isPro?: unknown; source?: unknown; audience?: unknown };
    if (payload.isPro !== true) return 'none';
    if (payload.source === 'internal_test' && payload.audience === INTERNAL_TEST_PRO_TOKEN_AUDIENCE) {
      return 'internal_test';
    }
    if (payload.source === undefined || payload.source === 'commercial') return 'commercial';
    return 'none';
  } catch {
    return 'none';
  }
}
