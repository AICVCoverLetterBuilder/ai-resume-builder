import { afterEach, describe, expect, test, vi } from 'vitest';

function makeGenerateRequest(body: Record<string, unknown>) {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('server Pro token gate', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('the AI endpoint accepts the same signed Pro token issued by createProToken', async () => {
    vi.stubEnv('PRO_SIGNING_KEY', 'test-pro-signing-key');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.resetModules();

    const { createProToken } = await import('../pro-token');
    const { POST } = await import('../../app/api/generate/route');
    const proToken = await createProToken(true);

    const response = await POST(makeGenerateRequest({
      action: 'bullets',
      proToken,
      industry: 'general',
      level: 'mid',
      locale: 'en',
      position: 'Operations Manager',
      company: 'Example Co',
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result).toEqual(expect.any(String));
  });

  test('invalid Pro token keeps AI endpoint behind the Pro access gate', async () => {
    vi.stubEnv('PRO_SIGNING_KEY', 'test-pro-signing-key');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.resetModules();

    const { POST } = await import('../../app/api/generate/route');
    const response = await POST(makeGenerateRequest({
      action: 'bullets',
      proToken: 'invalid.token',
      industry: 'general',
      level: 'mid',
      locale: 'en',
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Pro access required for AI features.');
  });
});
