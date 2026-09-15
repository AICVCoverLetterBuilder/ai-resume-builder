import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createProToken } from '@/lib/pro-token';
import { resolveCorsOrigin, buildCorsHeaders, handleOptions } from '@/lib/cors';
import {
  INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY_MAX_LENGTH,
  getInternalTestBootstrapCapability,
  isInternalTestServerCapabilityEnabled,
} from '@/lib/internal-test-pro-entitlement';

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

const INTERNAL_TEST_ENTITLEMENT_NOT_AUTHORIZED = 'internal_test_entitlement_not_authorized';

/** Validate a per-build bearer capability without logging or returning it. */
function matchesInternalTestBootstrapCapability(value: unknown): boolean {
  if (typeof value !== 'string'
    || value.length === 0
    || value.trim().length === 0
    || value.length > INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY_MAX_LENGTH) {
    return false;
  }
  const expectedHex = process.env.AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256;
  if (typeof expectedHex !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHex)) return false;
  const actualDigest = crypto.createHash('sha256').update(value, 'utf8').digest();
  const expectedDigest = Buffer.from(expectedHex, 'hex');
  return expectedDigest.length === actualDigest.length
    && crypto.timingSafeEqual(actualDigest, expectedDigest);
}

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

  // Parse the request once. The internal request marker is intentionally a
  // strict boolean; it is only a request capability, never an entitlement.
  let body: {
    revenueCatAppUserId?: unknown;
    internalTestProEntitlementRequested?: unknown;
    internalTestProBootstrapCapability?: unknown;
  } = {};
  try {
    const parsed: unknown = await req.json();
    if (parsed && typeof parsed === 'object') {
      body = parsed as typeof body;
    }
  } catch {
    // Body is optional — the commercial path issues a free token below.
  }

  if (body.internalTestProEntitlementRequested === true) {
    const capability = getInternalTestBootstrapCapability({
      NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY:
        typeof body.internalTestProBootstrapCapability === 'string'
          ? body.internalTestProBootstrapCapability
          : undefined,
    });
    if (isInternalTestServerCapabilityEnabled() && capability
      && matchesInternalTestBootstrapCapability(capability)) {
      const token = await createProToken(true, { source: 'internal_test' });
      return jsonResponse({ token, proEntitlementSource: 'internal_test' });
    }
    return jsonResponse(
      {
        error: 'Internal test Pro entitlement is not authorized.',
        code: INTERNAL_TEST_ENTITLEMENT_NOT_AUTHORIZED,
      },
      { status: 403 },
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Environment validation — all three must be set for commercial Pro
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

  // ── Commercial RevenueCat request ──────────────────────────────────
  const revenueCatAppUserId = typeof body.revenueCatAppUserId === 'string'
    ? body.revenueCatAppUserId : undefined;

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
