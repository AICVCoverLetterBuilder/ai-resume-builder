/** Internal observations only. No token, signature, key, or entitlement authority. */
import type { ProTokenVerificationReason } from './pro-token';
import type { ProEntitlementSource } from './pro-token-client';

export function isInternalProAuthDiagnosticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_BUILD_CHANNEL === 'internal';
}

/** One exact-byte SHA-256 fingerprint for both browser and server (96 bits).
 * Existing text fingerprints normalize input and disclose boundary characters;
 * they are deliberately not used for credentials. Failure means unknown.
 */
export async function fingerprintProToken(token: unknown): Promise<string | null> {
  try {
    if (typeof token !== 'string' || !token || token.length > 8192) return null;
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hex = Array.from(new Uint8Array(bytes)).slice(0, 12)
      .map((byte) => byte.toString(16).padStart(2, '0')).join('');
    return `sha256_${hex.slice(0, 8)}_${hex.slice(8, 16)}_${hex.slice(16, 24)}`;
  } catch { return null; }
}

export interface ProAuthObservation {
  authPlatformNative: boolean | null;
  authPlatformName: 'android' | 'ios' | 'web' | 'unknown';
  authSyncLastResult: 'success' | 'failed' | 'not-run';
  authSyncSource: 'startup' | 'purchase' | 'restore' | 'unknown';
  authTokenRemainingLifetimeBucket: 'unknown' | 'expired' | 'under_42s' | '42s_to_5m' | 'over_5m';
  authTokenFingerprint: string | null;
  authTokenFingerprintAtClick: string | null;
  /** Non-secret diagnostic classification of the canonical entitlement token. */
  proEntitlementSource?: ProEntitlementSource;
}

export interface ProAuthServerObservation {
  serverReceivedTokenFingerprint: string | null;
  serverTokenFingerprintMatchesClient: boolean | null;
  serverProTokenVerificationReason: ProTokenVerificationReason;
  serverDeploymentSourceMarker: string | null;
}

export type ProAuthBoundaryObservation = ProAuthObservation & Partial<ProAuthServerObservation>;

export function tokenLifetimeBucket(token: string | null, now: number): ProAuthObservation['authTokenRemainingLifetimeBucket'] {
  try {
    if (!token) return 'unknown';
    const raw = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(raw));
    if (typeof payload?.exp !== 'number' || !Number.isFinite(payload.exp)) return 'unknown';
    const remaining = payload.exp - now;
    return remaining <= 0 ? 'expired' : remaining < 42000 ? 'under_42s'
      : remaining <= 300000 ? '42s_to_5m' : 'over_5m';
  } catch { return 'unknown'; }
}

export function safeProTokenFingerprint(value: unknown): string | null {
  return typeof value === 'string' && /^sha256_[a-f0-9]{8}_[a-f0-9]{8}_[a-f0-9]{8}$/.test(value) ? value : null;
}

/** Never persist arbitrary server fields or messages, even on internal builds. */
export function readProAuthServerObservation(body: unknown): ProAuthServerObservation | undefined {
  if (!isInternalProAuthDiagnosticsEnabled()) return undefined;
  try {
    const raw = (body as { internalProAuth?: ProAuthServerObservation })?.internalProAuth;
    const reasons: readonly ProTokenVerificationReason[] = ['valid', 'missing_token', 'malformed_format',
      'payload_decode_failed', 'signature_length_mismatch', 'signature_mismatch', 'expired',
      'is_pro_false', 'signing_key_unavailable', 'internal_test_not_allowed', 'unsupported_source'];
    if (!raw || !reasons.includes(raw.serverProTokenVerificationReason)) return undefined;
    return {
      serverReceivedTokenFingerprint: safeProTokenFingerprint(raw.serverReceivedTokenFingerprint),
      serverTokenFingerprintMatchesClient: typeof raw.serverTokenFingerprintMatchesClient === 'boolean'
        ? raw.serverTokenFingerprintMatchesClient : null,
      serverProTokenVerificationReason: raw.serverProTokenVerificationReason,
      serverDeploymentSourceMarker: typeof raw.serverDeploymentSourceMarker === 'string'
        && /^[a-f0-9]{7,40}$/.test(raw.serverDeploymentSourceMarker) ? raw.serverDeploymentSourceMarker : null,
    };
  } catch { return undefined; }
}
