/**
 * pro-token.ts — Server-side HMAC-signed Pro status tokens
 *
 * Prevents trivial localStorage manipulation from unlocking Pro features.
 * The client must present a signed token (obtained from /api/verify-pro)
 * to access Pro-gated server resources.
 *
 * Format: base64url(payload).base64url(signature)
 *
 * When RevenueCat becomes the source of truth, the /api/verify-pro endpoint
 * will validate against RevenueCat's backend instead of client-reported status.
 */

import crypto from 'crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getKey(): string {
  const key = process.env.PRO_SIGNING_KEY;
  if (!key) {
    throw new Error('PRO_SIGNING_KEY is required to sign Pro tokens');
  }
  return key;
}

export interface ProTokenPayload {
  /** Whether the user has Pro entitlement */
  isPro: boolean;
  /** Expiration timestamp (epoch ms) */
  exp: number;
}

/**
 * Creates a signed Pro status token for the client.
 * Called after verifying Pro entitlement (via RevenueCat or otherwise).
 */
export async function createProToken(isPro: boolean): Promise<string> {
  const payload: ProTokenPayload = {
    isPro,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadStr = JSON.stringify(payload);
  const encoded = Buffer.from(payloadStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getKey())
    .update(payloadStr)
    .digest('base64url');
  return `${encoded}.${signature}`;
}

/**
 * Verifies a signed Pro token and returns the payload.
 * Returns null if the token is invalid, expired, or tampered with.
 */
export type ProTokenVerificationReason =
  | 'valid' | 'missing_token' | 'malformed_format' | 'payload_decode_failed'
  | 'signature_length_mismatch' | 'signature_mismatch' | 'expired'
  | 'is_pro_false' | 'signing_key_unavailable';

/** Server-only taxonomy. This is the sole verifier; no key/payload is logged. */
export async function verifyProTokenDetailed(token: unknown): Promise<{
  payload: ProTokenPayload | null;
  reason: ProTokenVerificationReason;
}> {
  const reject = (reason: ProTokenVerificationReason) => ({ payload: null, reason });
  if (token == null || token === '') return reject('missing_token');
  if (typeof token !== 'string') return reject('malformed_format');
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return reject('malformed_format');

    const [encodedPayload, signature] = parts;
    const payloadStr = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload: ProTokenPayload = JSON.parse(payloadStr);

    if (!process.env.PRO_SIGNING_KEY) return reject('signing_key_unavailable');

    // Verify signature
    const expectedSig = crypto
      .createHmac('sha256', getKey())
      .update(payloadStr)
      .digest('base64url');

    // Timing-safe comparison
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expectedSig);
    if (actualBytes.length !== expectedBytes.length) return reject('signature_length_mismatch');
    if (!crypto.timingSafeEqual(actualBytes, expectedBytes)) {
      return reject('signature_mismatch');
    }

    // Check expiration
    if (payload.exp && Date.now() >= payload.exp) return reject('expired');

    // Explicitly verify isPro is exactly true — do not grant access if
    // isPro is missing, false, or malformed
    if (payload.isPro !== true) return reject('is_pro_false');

    return { payload, reason: 'valid' };
  } catch {
    return reject('payload_decode_failed');
  }
}

/** Compatibility API: observation cannot influence the authorization result. */
export async function verifyProToken(
  token: string,
  observe?: (reason: ProTokenVerificationReason) => void,
): Promise<ProTokenPayload | null> {
  const result = await verifyProTokenDetailed(token);
  try { observe?.(result.reason); } catch { /* diagnostic failure is non-authoritative */ }
  return result.payload;
}
