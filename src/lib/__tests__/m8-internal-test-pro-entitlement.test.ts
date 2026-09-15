import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  INTERNAL_TEST_PRO_TOKEN_AUDIENCE,
  getInternalTestBootstrapCapability,
  isInternalTestClientCapabilityEnabled,
  isInternalTestServerCapabilityEnabled,
  isInternalTestTokenRuntimeAllowed,
} from '../internal-test-pro-entitlement';
import { createProToken, verifyProTokenDetailed } from '../pro-token';
import { isUsableProToken, readProTokenEntitlementSource } from '../pro-token-client';
import { checkProAccess, PRO_AI_SAFETY_CAP } from '../store';

const testKey = 'm8-internal-entitlement-test-key';
const testBootstrapCapability = ['m8', 'qa', 'bootstrap', 'fixture'].join('-');
const testBootstrapDigest = createHash('sha256').update(testBootstrapCapability, 'utf8').digest('hex');
const request = (body: unknown) => new Request('https://example.test/api/verify-pro', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

beforeEach(() => {
  vi.stubEnv('PRO_SIGNING_KEY', testKey);
  vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'production');
  vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'false');
  vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY', '');
  vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'false');
  vi.stubEnv('AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256', '');
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('REVENUECAT_SECRET_API_KEY', '');
  vi.stubEnv('REVENUECAT_PROJECT_ID', '');
  vi.stubEnv('REVENUECAT_ENTITLEMENT_ID', '');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('unexpected provider request'); }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('two-sided internal Pro capability gates', () => {
  test('capability matrix is fail-closed unless both sides agree in Preview', () => {
    expect(isInternalTestClientCapabilityEnabled({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal', NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT: 'true',
      NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY: testBootstrapCapability,
    })).toBe(true);
    expect(getInternalTestBootstrapCapability({
      NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY: '',
    })).toBeNull();
    expect(isInternalTestServerCapabilityEnabled({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal', AI_INTERNAL_TEST_PRO_ENTITLEMENT: 'true', VERCEL_ENV: 'preview',
    })).toBe(true);
    expect(isInternalTestServerCapabilityEnabled({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal', AI_INTERNAL_TEST_PRO_ENTITLEMENT: 'true', VERCEL_ENV: 'production',
    })).toBe(false);
    expect(isInternalTestClientCapabilityEnabled({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal', NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT: 'false',
    })).toBe(false);
    expect(isInternalTestTokenRuntimeAllowed({
      NEXT_PUBLIC_BUILD_CHANNEL: 'internal', AI_INTERNAL_TEST_PRO_ENTITLEMENT: 'true', VERCEL_ENV: 'preview',
    })).toBe(true);
  });

  test('client-only or server-only configuration does not issue a QA token', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'false');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.resetModules();
    const { POST } = await import('../../app/api/verify-pro/route');
    const response = await POST(request({ internalTestProEntitlementRequested: true }) as never);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('internal_test_entitlement_not_authorized');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('server flag alone and ordinary internal builds stay free', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'false');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.resetModules();
    const { POST } = await import('../../app/api/verify-pro/route');
    const response = await POST(request({}) as never);
    const { token, proEntitlementSource } = await response.json();
    expect(proEntitlementSource).toBeUndefined();
    expect((await verifyProTokenDetailed(token)).reason).toBe('is_pro_false');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('non-boolean or missing request markers cannot trigger internal issuance', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.resetModules();
    const { POST } = await import('../../app/api/verify-pro/route');
    const response = await POST(request({ internalTestProEntitlementRequested: 'true' }) as never);
    const { token } = await response.json();
    expect((await verifyProTokenDetailed(token)).reason).toBe('is_pro_false');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('forged marker=true without a build capability fails closed', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.resetModules();
    const { POST } = await import('../../app/api/verify-pro/route');
    const response = await POST(request({ internalTestProEntitlementRequested: true }) as never);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe('internal_test_entitlement_not_authorized');
    expect(body.token).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('wrong, malformed, oversized, or mismatched capabilities never issue a token', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256', testBootstrapDigest);
    vi.resetModules();
    const { POST } = await import('../../app/api/verify-pro/route');
    const invalidCapabilities: unknown[] = [
      'm8-wrong-capability', '', '   ', 42, 'x'.repeat(257), null,
    ];
    for (const capability of invalidCapabilities) {
      const response = await POST(request({
        internalTestProEntitlementRequested: true,
        internalTestProBootstrapCapability: capability,
      }) as never);
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        code: 'internal_test_entitlement_not_authorized',
      });
    }
    vi.stubEnv('AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256', '0'.repeat(64));
    const mismatchedDigestResponse = await POST(request({
      internalTestProEntitlementRequested: true,
      internalTestProBootstrapCapability: testBootstrapCapability,
    }) as never);
    expect(mismatchedDigestResponse.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('correct capability is still forbidden outside the approved Preview runtime', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256', testBootstrapDigest);
    vi.resetModules();
    const { POST } = await import('../../app/api/verify-pro/route');
    const response = await POST(request({
      internalTestProEntitlementRequested: true,
      internalTestProBootstrapCapability: testBootstrapCapability,
    }) as never);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: 'internal_test_entitlement_not_authorized',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('approved internal Preview issues one canonical signed QA token without RevenueCat', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY', testBootstrapCapability);
    vi.stubEnv('AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256', testBootstrapDigest);
    vi.resetModules();
    const { POST } = await import('../../app/api/verify-pro/route');
    const response = await POST(request({
      internalTestProEntitlementRequested: true,
      internalTestProBootstrapCapability: testBootstrapCapability,
    }) as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.proEntitlementSource).toBe('internal_test');
    expect(typeof body.token).toBe('string');
    expect(fetch).not.toHaveBeenCalled();
    expect((await verifyProTokenDetailed(body.token)).reason).toBe('valid');
    expect(readProTokenEntitlementSource(body.token)).toBe('internal_test');
    expect(isUsableProToken(body.token)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(testBootstrapCapability);
  });

  test('the normal entitlement bootstrap requests the internal token through apiFetch', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY', testBootstrapCapability);
    vi.stubEnv('AI_INTERNAL_TEST_PRO_BOOTSTRAP_SHA256', testBootstrapDigest);
    const token = await createProToken(true, { source: 'internal_test' });
    const transport = vi.fn(async (_url: unknown, options: RequestInit) => {
      expect(JSON.parse(String(options.body))).toMatchObject({
        internalTestProEntitlementRequested: true,
        internalTestProBootstrapCapability: testBootstrapCapability,
      });
      return Response.json({ token, proEntitlementSource: 'internal_test' });
    });
    vi.stubGlobal('fetch', transport);
    vi.resetModules();
    const { syncProEntitlement } = await import('../iap');
    const result = await syncProEntitlement();
    expect(result).toMatchObject({
      entitlementResult: 'active',
      tokenSyncLastResult: 'success',
      isPro: true,
      token,
      entitlementSource: 'internal_test',
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  test('signed internal token is rejected after crossing into production', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    const token = await createProToken(true, { source: 'internal_test' });
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'production');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'false');
    expect((await verifyProTokenDetailed(token)).reason).toBe('internal_test_not_allowed');
    expect(isUsableProToken(token)).toBe(false);
    expect(readProTokenEntitlementSource(token)).toBe('internal_test');
  });

  test('generate route fences a copied internal token before provider work', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    const token = await createProToken(true, { source: 'internal_test' });
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'production');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.resetModules();
    const { POST } = await import('../../app/api/generate/route');
    const response = await POST(new Request('https://example.test/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'summary_v3_generate', proToken: token }),
    }) as never);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Pro access required for AI features.', code: 'invalid_pro_token' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('legacy/commercial tokens remain valid and checkProAccess remains the sole gate', async () => {
    const token = await createProToken(true);
    expect((await verifyProTokenDetailed(token)).reason).toBe('valid');
    expect(readProTokenEntitlementSource(token)).toBe('commercial');
    expect(checkProAccess(true, 0)).toBe('allowed');
    expect(checkProAccess(false, 0)).toBe('upgrade');
    expect(checkProAccess(true, PRO_AI_SAFETY_CAP)).toBe('safety_cap');
  });

  test('internal source requires the fixed signed audience', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('AI_INTERNAL_TEST_PRO_ENTITLEMENT', 'true');
    vi.stubEnv('VERCEL_ENV', 'preview');
    const token = await createProToken(true, { source: 'internal_test' });
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as {
      audience: string;
    };
    expect(payload.audience).toBe(INTERNAL_TEST_PRO_TOKEN_AUDIENCE);
  });
});
