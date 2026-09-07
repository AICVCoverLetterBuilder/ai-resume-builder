/**
 * Browser-safe Pro-token usability checks.
 *
 * This deliberately does not verify the signature. The server remains the
 * authority for signature and entitlement validation; the client only decides
 * whether a persisted token is usable for the click-time gate.
 */

function base64UrlDecode(value: string): string {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  return atob(base64);
}

/**
 * A token is client-usable only when it decodes to an explicit Pro payload
 * with a finite expiration strictly in the future.
 */
export function isUsableProToken(token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const payloadPart = parts[0];
    const decoded: unknown = JSON.parse(base64UrlDecode(payloadPart));
    if (!decoded || typeof decoded !== 'object') return false;
    const payload = decoded as { isPro?: unknown; exp?: unknown };
    return payload.isPro === true
      && typeof payload.exp === 'number'
      && Number.isFinite(payload.exp)
      && now < payload.exp;
  } catch {
    return false;
  }
}
