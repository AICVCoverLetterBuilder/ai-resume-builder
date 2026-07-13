import { afterEach, describe, expect, test, vi } from 'vitest';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: anthropicCreateMock,
    };
  },
}));

function makeGenerateRequest(body: Record<string, unknown>) {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function anthropicJson(payload: Record<string, unknown>) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

const CANDIDATE = 'Alex Carter';
const COMPANY = 'Tuxy';

const VALID_HINDI = {
  dateLine: '12 जुलाई 2026',
  greeting: 'Tuxy की भर्ती टीम को,',
  paragraph1: 'मैं Tuxy में सॉफ्टवेयर इंजीनियर पद के लिए आवेदन कर रही हूँ। मेरे पास वेब एप्लिकेशन विकसित करने का व्यावहारिक अनुभव है।',
  paragraph2: 'मैंने टीम परियोजनाओं में सहयोग किया है और गुणवत्ता-केंद्रित वितरण पर काम किया है।',
  paragraph3: 'Tuxy की उत्पाद गुणवत्ता और ग्राहक-केंद्रित दृष्टि मुझे प्रेरित करती है, और मैं आपकी टीम में सार्थक योगदान देने के लिए उत्सुक हूँ।',
  closing: 'मैं साक्षात्कार में अपनी योग्यता पर चर्चा करने का अवसर चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
  signOff: 'सादर',
  candidateName: CANDIDATE,
};

const INVALID_HINDI = {
  ...VALID_HINDI,
  paragraph3: 'Tuxy एक ऐसी कंपनी है जो अपने उत्पादों और सेवाओं की गुणवत्ता के प्रति प्रतिबद्ध है, और यही',
  closing: '',
  signOff: '',
  candidateName: '',
};

const VALID_ENGLISH = {
  dateLine: 'July 12, 2026',
  greeting: 'Dear Tuxy Hiring Team,',
  paragraph1: 'I am applying for the Software Engineer role at Tuxy and bring practical experience building reliable web applications.',
  paragraph2: 'My background includes collaborative product work, careful debugging, and delivering user-focused features.',
  paragraph3: 'Tuxy commitment to product quality and customer focus is motivating, and I am eager to contribute meaningfully to your team.',
  closing: 'I would welcome the opportunity to discuss my fit in an interview and thank you for your time and consideration.',
  signOff: 'Sincerely',
  candidateName: CANDIDATE,
};

async function importRoute() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

describe('structured cover letter API generation', () => {
  afterEach(() => {
    anthropicCreateMock.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('Hindi API returns complete assembled content from valid structured JSON', async () => {
    anthropicCreateMock.mockResolvedValueOnce(anthropicJson(VALID_HINDI));

    const { POST } = await importRoute();
    const response = await POST(makeGenerateRequest({
      action: 'cover-letter-gen',
      locale: 'hi',
      jobTitle: 'Software Engineer',
      companyName: COMPANY,
      tone: 'formal',
      personalName: CANDIDATE,
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result).toContain('सादर,');
    expect(data.result).toContain(CANDIDATE);
    expect(data.result).toContain('साक्षात्कार');
    expect(data.result).not.toMatch(/और\s+यही$/u);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    expect(anthropicCreateMock.mock.calls[0][0].max_tokens).toBe(1200);
  });

  test('Hindi API retries and does not return success for incomplete paragraph3', async () => {
    anthropicCreateMock
      .mockResolvedValueOnce(anthropicJson(INVALID_HINDI))
      .mockResolvedValueOnce(anthropicJson(INVALID_HINDI))
      .mockResolvedValueOnce(anthropicJson(INVALID_HINDI));

    const { POST } = await importRoute();
    const response = await POST(makeGenerateRequest({
      action: 'cover-letter-gen',
      locale: 'hi',
      jobTitle: 'Software Engineer',
      companyName: COMPANY,
      tone: 'formal',
      personalName: CANDIDATE,
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.result).toBeUndefined();
    expect(data.error).toContain('Cover letter generation was incomplete');
    expect(anthropicCreateMock).toHaveBeenCalledTimes(3);
  });

  test('English API returns English-only content with Sincerely and candidate name', async () => {
    anthropicCreateMock.mockResolvedValueOnce(anthropicJson(VALID_ENGLISH));

    const { POST } = await importRoute();
    const response = await POST(makeGenerateRequest({
      action: 'cover-letter-gen',
      locale: 'en',
      jobTitle: 'Software Engineer',
      companyName: COMPANY,
      tone: 'formal',
      personalName: CANDIDATE,
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.result).toContain('Sincerely,');
    expect(data.result).toContain(CANDIDATE);
    expect(data.result).not.toMatch(/[\u0900-\u097F]/u);
    expect(anthropicCreateMock.mock.calls[0][0].max_tokens).toBe(600);
  });
});
