import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createProToken, verifyProToken, verifyProTokenDetailed } from '../pro-token';
import { fingerprintProToken, readProAuthServerObservation } from '../pro-auth-diagnostics';

const testKey = 'deterministic-auth-boundary-test-only';
const request = (body: unknown) => new Request('https://example.test/api/generate', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.stubEnv('PRO_SIGNING_KEY', testKey);
  vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'production');
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network request in auth test'); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.resetModules(); });

describe('one issuer/verifier authority and diagnostic-only reasons', () => {
  test('real issuance self consistency: Pro valid, non-Pro is_pro_false', async () => {
    expect((await verifyProTokenDetailed(await createProToken(true))).reason).toBe('valid');
    expect((await verifyProTokenDetailed(await createProToken(false))).reason).toBe('is_pro_false');
  });

  test.each([
    [undefined, 'missing_token'], ['', 'missing_token'], ['single', 'malformed_format'],
    [{}, 'malformed_format'], ['not-json.signature', 'payload_decode_failed'],
  ])('detailed verifier safely classifies malformed input %#', async (token, reason) => {
    expect(await verifyProTokenDetailed(token)).toEqual({ payload: null, reason });
    expect(await verifyProToken(token as string)).toBeNull();
  });

  test('signature length, same-length mismatch, expiry, and missing key are distinct', async () => {
    const token = await createProToken(true);
    expect((await verifyProTokenDetailed(token + 'x')).reason).toBe('signature_length_mismatch');
    expect((await verifyProTokenDetailed(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'))).reason).toBe('signature_mismatch');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * 60 * 1000 + 1);
    expect((await verifyProTokenDetailed(token)).reason).toBe('expired');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    expect((await verifyProTokenDetailed(token)).reason).toBe('signing_key_unavailable');
  });

  test('observer throwing cannot grant or deny; no raw token in returned reason', async () => {
    const token = await createProToken(true);
    const brokenObserver = () => { throw new Error('observation only'); };
    expect(await verifyProToken(token, brokenObserver)).not.toBeNull();
    expect(await verifyProToken('invalid', brokenObserver)).toBeNull();
    expect(JSON.stringify((await verifyProTokenDetailed(token)).reason)).not.toContain(token);
  });

  test.each([false, true])('independent verify-pro issuer / generate graph, changedKey=%s', async (changedKey) => {
    vi.stubEnv('REVENUECAT_SECRET_API_KEY', 'deterministic-rc-test-only');
    vi.stubEnv('REVENUECAT_PROJECT_ID', 'test-project');
    vi.stubEnv('REVENUECAT_ENTITLEMENT_ID', 'test-entitlement');
    const rcFetch = vi.fn(async () => Response.json({ items: [{ entitlement_id: 'test-entitlement' }] }));
    vi.stubGlobal('fetch', rcFetch);
    vi.resetModules();
    const issuer = await import('../../app/api/verify-pro/route');
    const issuedResponse = await issuer.POST(request({ revenueCatAppUserId: 'deterministic-test-user' }) as never);
    expect(issuedResponse.status).toBe(200);
    expect(rcFetch).toHaveBeenCalledTimes(1);
    const { token } = await issuedResponse.json();
    expect(typeof token).toBe('string');
    // Actual independent graph, not a same-module issue/verify shortcut.
    vi.resetModules();
    if (changedKey) vi.stubEnv('PRO_SIGNING_KEY', 'different-deterministic-test-key');
    const forbiddenNetwork = vi.fn(() => { throw new Error('Generate must stop before provider'); });
    vi.stubGlobal('fetch', forbiddenNetwork);
    const verifier = await import('../../app/api/generate/route');
    const response = await verifier.POST(request({ action: 'summary_v3_generate', proToken: token }) as never);
    expect(response.status).toBe(changedKey ? 403 : 500);
    const body = await response.json();
    if (changedKey) expect(body.code).toBe('invalid_pro_token');
    else expect(body.error).toBe('AI service is not configured. Please try again later.');
    expect(forbiddenNetwork).not.toHaveBeenCalled();
  });

  test.each(['production', 'internal'])('actual invalid response fenced by build channel %s', async (channel) => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', channel);
    vi.stubEnv('NEXT_PUBLIC_SOURCE_COMMIT_SHORT', '2c849bf');
    vi.resetModules();
    const token = await createProToken(true);
    const fingerprint = await fingerprintProToken(token);
    vi.stubEnv('PRO_SIGNING_KEY', 'different-deterministic-test-key');
    const { POST } = await import('../../app/api/generate/route');
    const response = await POST(request({ action: 'summary_v3_generate', proToken: token,
      authTokenFingerprintAtClick: fingerprint }) as never);
    expect(response.status).toBe(403);
    const body = await response.json();
    if (channel === 'production') expect(body).toEqual({ error: 'Pro access required for AI features.', code: 'invalid_pro_token' });
    else expect(body.internalProAuth).toEqual({ serverReceivedTokenFingerprint: fingerprint,
      serverTokenFingerprintMatchesClient: true, serverProTokenVerificationReason: 'signature_mismatch',
      serverDeploymentSourceMarker: '2c849bf' });
    expect(JSON.stringify(body)).not.toContain(token);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('production deployment cannot enable details via internal channel or request flags', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.resetModules();
    const { POST } = await import('../../app/api/generate/route');
    const response = await POST(request({ action: 'summary_v3_generate', proToken: 'invalid', internalProAuth: true }) as never);
    expect(await response.json()).toEqual({ error: 'Pro access required for AI features.', code: 'invalid_pro_token' });
  });

  test('fingerprint unavailable is unknown; response projection drops arbitrary credential fields', async () => {
    vi.stubEnv('NEXT_PUBLIC_BUILD_CHANNEL', 'internal');
    vi.stubGlobal('crypto', {});
    expect(await fingerprintProToken('test-only')).toBeNull();
    expect(readProAuthServerObservation({ internalProAuth: {
      serverProTokenVerificationReason: 'signature_mismatch', rawToken: 'must-not-be-retained',
      serverReceivedTokenFingerprint: 'must-not-be-retained', serverDeploymentSourceMarker: 'must-not-be-retained',
    } })).toEqual({ serverProTokenVerificationReason: 'signature_mismatch', serverReceivedTokenFingerprint: null,
      serverTokenFingerprintMatchesClient: null, serverDeploymentSourceMarker: null });
  });
});

test('actual local gateway preserves realistic signed tokens including base64url dash/underscore', async () => {
  const gateway = process.env.CVPRO_AUTH_GATEWAY_SOURCE_DIR || 'C:/Users/Q/M8-OIDC-Gateway-4d13547';
  const oidc = vi.fn(async () => 'deterministic-oidc-test-only');
  const captured: string[] = [];
  const upstream = vi.fn(async (_url: string, options: RequestInit) => {
    const parsed = await request(JSON.parse(String(options.body))).json();
    captured.push(parsed.proToken);
    return Response.json({ code: 'invalid_pro_token' }, { status: 403 });
  });
  const modules = new Map<string, Record<string, unknown>>();
  const load = (name: string): Record<string, unknown> => {
    if (name === '@vercel/oidc') return { getVercelOidcToken: oidc };
    if (modules.has(name)) return modules.get(name)!;
    const file = path.join(gateway, 'api', name.replace('./', ''));
    const source = readFileSync(file, 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const gatewayModule = { exports: {} as Record<string, unknown> };
    new Function('require', 'module', 'exports', 'fetch', 'Buffer', compiled)(load, gatewayModule, gatewayModule.exports, upstream, Buffer);
    modules.set(name, gatewayModule.exports);
    return gatewayModule.exports;
  };
  const handler = load('./generate.js').default as (req: unknown, res: unknown) => Promise<void>;
  let covered = false;
  for (let i = 0; i < 100; i++) {
    vi.spyOn(Date, 'now').mockReturnValue(1900000000000 + i);
    const token = await createProToken(true);
    if (!token.includes('-') || !token.includes('_')) continue;
    covered = true;
    for (const inputKind of ['string', 'object', 'buffer']) {
      const body = { action: 'summary_v3_generate', proToken: token };
      const res = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() };
      await handler({ method: 'POST', headers: { origin: 'https://localhost' },
        body: inputKind === 'string' ? JSON.stringify(body) : inputKind === 'buffer' ? Buffer.from(JSON.stringify(body)) : body }, res);
      expect(res.statusCode).toBe(403);
      const forwarded = JSON.parse(String(upstream.mock.calls.at(-1)![1].body)).proToken;
      expect(forwarded === token).toBe(true);
      expect(captured.at(-1) === token).toBe(true);
      expect(await fingerprintProToken(forwarded)).toBe(await fingerprintProToken(token));
    }
    console.info('TEST_ONLY_GATEWAY_FINGERPRINTS', JSON.stringify({ before: await fingerprintProToken(token),
      afterGateway: await fingerprintProToken(captured[0]), afterTargetParse: await fingerprintProToken(captured[0]) }));
    break;
  }
  expect(covered).toBe(true);
  expect(upstream).toHaveBeenCalledTimes(3);
  expect(oidc).toHaveBeenCalledTimes(3);
});
