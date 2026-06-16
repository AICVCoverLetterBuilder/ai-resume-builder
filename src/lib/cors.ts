/**
 * CORS origin validation for Capacitor native app API calls.
 *
 * Capacitor Android/iOS loads the app locally (capacitor://localhost, https://localhost)
 * and calls the deployed Vercel backend via fetch(). The WebView enforces CORS.
 *
 * This module validates the Origin header against an allowlist and echoes back only
 * the matching origin — never the wildcard "*". This avoids combining a wildcard
 * origin with credentials while keeping the Capacitor app able to reach the API.
 *
 * Allowed origins are either in the built-in allowlist below or configured via
 * the CORS_ORIGIN env var for production Capacitor builds.
 */

/** Known safe origins for Capacitor and local development. */
const ALLOWED_ORIGINS = new Set([
  'capacitor://localhost',
  'https://localhost',
  'http://localhost:3000',
  'http://localhost',
]);

/**
 * Determines the allowed CORS origin for a given request origin.
 *
 * Returns the origin to echo back in Access-Control-Allow-Origin, or null
 * if the origin is not allowed. When null is returned, no CORS headers
 * should be set (browser will enforce same-origin policy).
 */
export function resolveCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) return null; // Same-origin request — no CORS needed

  if (ALLOWED_ORIGINS.has(requestOrigin)) return requestOrigin;

  // Allowlist can be extended via env var (e.g. production Capacitor origin)
  const configured = process.env.CORS_ORIGIN;
  if (configured && requestOrigin === configured) return requestOrigin;

  return null; // Origin not allowed
}

/**
 * Builds the minimum CORS headers for a given origin.
 * Returns an empty object when origin is null (no CORS needed).
 */
export function buildCorsHeaders(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Creates an OPTIONS preflight response for the given request origin,
 * or a generic 204 when the origin is not in the allowlist.
 */
export function handleOptions(request: { headers: { get(name: string): string | null } }): Response {
  const origin = request.headers.get('origin');
  const corsOrigin = resolveCorsOrigin(origin);
  return new Response(null, {
    status: 204,
    headers: corsOrigin
      ? buildCorsHeaders(corsOrigin)
      : {},
  });
}