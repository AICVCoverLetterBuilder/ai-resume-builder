import { NextRequest, NextResponse } from 'next/server';
import { createProToken } from '@/lib/pro-token';
import { resolveCorsOrigin, buildCorsHeaders, handleOptions } from '@/lib/cors';

// ─── Response shape from RevenueCat V2 active_entitlements API ─────────────────

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

// ─── Status codes that indicate server-side errors, not missing entitlement ────
// When RevenueCat is unreachable, rate-limited, or rejecting our key we must
// NOT silently treat the user as non-Pro. Return a temporary error instead.

const RC_SERVER_ERROR_STATUSES = new Set([401, 403, 429]);
const RC_RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

/**
 * POST /api/verify-pro
 *
 * Issues an HMAC-signed Pro status token for the requesting user.
 *
 * SECURITY: Pro eligibility is determined server-side via RevenueCat V2 REST API.
 * The client's claim is NEVER trusted. The client sends its RevenueCat appUserID,
 * and this endpoint calls:
 *
 *   GET https://api.revenuecat.com/v2/projects/{project_id}/customers/{customer_id}/active_entitlements
 *
 * Only if the response contains an active entitlement whose entitlement_id matches
 * REVENUECAT_ENTITLEMENT_ID do we issue a Pro token.
 *
 * Body:
 *   { revenueCatAppUserId?: string }
 *
 * Response:
 *   { token: string } | { error: string, status: number }
 */
/**
 * Handle CORS preflight for Capacitor native app cross-origin requests.
 * Validates the Origin against the allowlist before responding.
 */
export async function OPTIONS(req: NextRequest): Promise<Response> {
  return handleOptions(req);
}

export async function POST(req: NextRequest) {
  const _corsOrigin = resolveCorsOrigin(req.headers.get('origin'));
  const _corsHeaders = buildCorsHeaders(_corsOrigin);
  function jsonResponse(data: unknown, init?: ResponseInit): NextResponse {
    return NextResponse.json(data, {
      ...init,
      headers: {
        ..._corsHeaders,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Environment validation — all three must be set for Pro to work
  // ═══════════════════════════════════════════════════════════════
  const secretKey = process.env.REVENUECAT_SECRET_API_KEY;
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  const entitlementId = process.env.REVENUECAT_ENTITLEMENT_ID;

  if (!secretKey || !projectId || !entitlementId) {
    const missing: string[] = [];
    if (!secretKey) missing.push('REVENUECAT_SECRET_API_KEY');
    if (!projectId) missing.push('REVENUECAT_PROJECT_ID');
    if (!entitlementId) missing.push('REVENUECAT_ENTITLEMENT_ID');
    console.warn(
      '[verify-pro] Missing required env vars:',
      missing.join(', '),
      '— all tokens will be issued as Free.',
    );
    const token = await createProToken(false);
    return jsonResponse({ token });
  }

  // ── Parse request body ──────────────────────────────────────────────
  let revenueCatAppUserId: string | undefined;
  try {
    const body = await req.json();
    revenueCatAppUserId = body.revenueCatAppUserId;
  } catch {
    // Body is optional — if missing, we issue a free token
  }

  if (!revenueCatAppUserId) {
    const token = await createProToken(false);
    return jsonResponse({ token });
  }

  let isPro = false;

  try {
    const rcResponse = await fetch(
      `https://api.revenuecat.com/v2/projects/${encodeURIComponent(projectId)}/customers/${encodeURIComponent(revenueCatAppUserId)}/active_entitlements`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (rcResponse.ok && rcResponse.status === 200) {
      // ── 200 — parse active entitlements and check for our entitlement ──
      const rcData = (await rcResponse.json()) as V2ActiveEntitlementsResponse;
      isPro = Array.isArray(rcData.items) && rcData.items.some(
        (item) => item.entitlement_id === entitlementId,
      );
    } else if (rcResponse.status === 404) {
      // ── 404 — customer not found (no purchase ever made) — not an error ──
      isPro = false;
    } else if (RC_SERVER_ERROR_STATUSES.has(rcResponse.status)) {
      // ── 401/403 — auth/configuration error (wrong key, missing permissions)
      // ── 429 — RevenueCat rate limit hit
      // These are server configuration issues, not user entitlement status.
      console.warn(
        '[verify-pro] RevenueCat API configuration error:',
        rcResponse.status,
      );
      const isRetryable = RC_RETRYABLE_STATUSES.has(rcResponse.status);
      return jsonResponse(
        {
          error: isRetryable
            ? 'Entitlement verification temporarily unavailable. Please try again.'
            : 'Entitlement verification configuration error.',
        },
        { status: 502 },
      );
    } else if (rcResponse.status >= 500) {
      // ── 5xx — RevenueCat server error, retryable ──
      console.warn('[verify-pro] RevenueCat API server error:', rcResponse.status);
      return jsonResponse(
        { error: 'Entitlement verification temporarily unavailable. Please try again.' },
        { status: 502 },
      );
    } else {
      // ── Unexpected status — log and treat as non-Pro ──
      console.warn('[verify-pro] RevenueCat API returned unexpected status:', rcResponse.status);
    }
  } catch (rcErr) {
    console.error('[verify-pro] RevenueCat API call failed (network error):', rcErr);
    return jsonResponse(
      { error: 'Entitlement verification temporarily unavailable. Please try again.' },
      { status: 502 },
    );
  }

  const token = await createProToken(isPro);
  return jsonResponse({ token });
}