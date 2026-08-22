/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const FACTS = {
  jobTitle: 'Customer Support Specialist',
  roles: [{
    position: 'Customer Support Specialist',
    company: 'Acme Corporation',
    startDate: '2020-01',
    endDate: '',
    isPresent: true,
    description: 'Handles customer requests and maintains order records.',
  }],
  education: [],
  skills: ['Customer Support'],
  certifications: [],
  languages: [],
};

function request(body: Record<string, unknown>) {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function importRoute() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

describe('Simple V1 Summary server action', () => {
  beforeEach(() => anthropicCreateMock.mockReset());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('Generate makes a direct provider request without sending stale Summary text', async () => {
    anthropicCreateMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Customer support specialist who handles requests and maintains clear records.' }],
    });
    const { POST } = await importRoute();
    const response = await POST(request({
      action: 'summary-simple-v1',
      operation: 'generate',
      contentLocale: 'en',
      gender: 'female',
      facts: FACTS,
      sourceSummary: 'Stale Summary must be ignored by Generate.',
    }) as never);
    const data = await response.json();
    const providerBody = JSON.parse(anthropicCreateMock.mock.calls[0][0].messages[0].content);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({ simpleV1: true, providerResultKind: 'text' });
    expect(providerBody).not.toHaveProperty('currentSummary');
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  it('all rewrite styles use the same action and send only the current Summary plus style', async () => {
    for (const style of ['shorter', 'stronger', 'professional'] as const) {
      anthropicCreateMock.mockResolvedValueOnce({
        content: [{ type: 'text', text: `A valid ${style} customer support Summary with clear and reliable wording.` }],
      });
      const { POST } = await importRoute();
      const response = await POST(request({
        action: 'summary-simple-v1',
        operation: 'rewrite',
        style,
        contentLocale: 'en',
        gender: 'female',
        facts: FACTS,
        sourceSummary: 'The current authoritative Summary supplied for rewriting.',
      }) as never);
      expect(response.status).toBe(200);
      const providerBody = JSON.parse(anthropicCreateMock.mock.calls.at(-1)[0].messages[0].content);
      expect(providerBody).toMatchObject({
        operation: 'rewrite',
        style,
        currentSummary: 'The current authoritative Summary supplied for rewriting.',
      });
    }
  });

  it('provider failure returns a typed failure and never falls back to older Summary text', async () => {
    anthropicCreateMock.mockRejectedValue(new Error('invalid api key 401'));
    const { POST } = await importRoute();
    const response = await POST(request({
      action: 'summary-simple-v1',
      operation: 'generate',
      contentLocale: 'en',
      facts: FACTS,
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe('provider_auth_error');
    expect(data).not.toHaveProperty('result');
  });

  it('rejects an invalid Simple V1 operation before calling the provider', async () => {
    const { POST } = await importRoute();
    const response = await POST(request({
      action: 'summary-simple-v1',
      operation: 'translate',
      contentLocale: 'en',
      facts: FACTS,
    }) as never);
    expect(response.status).toBe(400);
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });
});
