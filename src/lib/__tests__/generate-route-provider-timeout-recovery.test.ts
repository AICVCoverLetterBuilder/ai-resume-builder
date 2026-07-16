/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_PROVIDER_CALL_TIMEOUT_MS, AI_SERVER_BUDGET_MS } from '@/lib/ai-request-timing';

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

const SUMMARY_BODY = {
  action: 'summary',
  locale: 'sr',
  gender: 'male',
  jobTitle: 'Vozač viličara',
  experienceEntries: [
    {
      position: 'Vozač viličara',
      company: 'Upopo',
      startDate: '2021-03',
      endDate: 'present',
      description: 'Utovar i istovar robe u skladištu',
    },
  ],
  skills: ['Rukovanje viličarom', 'Bezbedan transport robe'],
  languages: [{ name: 'Engleski', level: 'Srednji' }],
  education: [],
  experienceDurationSnapshot: {
    total: { totalMonths: 60, hasValidDates: true, hasAnyExperience: true },
  },
};

async function importRoute() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

describe('provider timeout recovery in /api/generate', () => {
  beforeEach(() => {
    anthropicCreateMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('provider timeout at ~8s reaches activateCvSummary with null candidate and returns Serbian fallback (200)', async () => {
    vi.useFakeTimers();
    anthropicCreateMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      return { content: [{ type: 'text', text: 'late' }] };
    });

    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    vi.resetModules();
    const activation = await import('@/lib/cv-content-activation');
    const activateSpy = vi.spyOn(activation, 'activateCvSummary');
    const { POST } = await import('../../app/api/generate/route');

    const pending = POST(makeGenerateRequest(SUMMARY_BODY) as never);
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 100);
    const response = await pending;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.code).not.toBe('request_timeout');
    expect(data.cvFidelityStatus).toBe('fallback');
    expect(data.result).toEqual(expect.any(String));
    expect(String(data.result).trim().length).toBeGreaterThan(0);
    expect(activateSpy).toHaveBeenCalled();
    expect(activateSpy.mock.calls[0]?.[0]?.candidate).toBe('');
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  it('Hindi first-generate: provider timeout returns Devanagari fallback in same request', async () => {
    vi.useFakeTimers();
    anthropicCreateMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      return { content: [{ type: 'text', text: 'late' }] };
    });

    const { POST } = await importRoute();
    const pending = POST(makeGenerateRequest({
      ...SUMMARY_BODY,
      locale: 'hi',
      jobTitle: 'वेयरहाउस चालक',
    }) as never);
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 100);
    const response = await pending;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.cvFidelityStatus).toBe('fallback');
    expect(String(data.result)).toMatch(/[\u0900-\u097F]/);
  });

  it('provider invalid + repair timeout -> fallback (200), no terminal request_timeout', async () => {
    vi.useFakeTimers();
    anthropicCreateMock
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Vozač viličara sa iskustvom u skladišnom poslovanju.' }],
      })
      .mockImplementationOnce(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return { content: [{ type: 'text', text: 'late repair' }] };
      });

    const { POST } = await importRoute();
    const pending = POST(makeGenerateRequest({
      ...SUMMARY_BODY,
      locale: 'hi',
      jobTitle: 'वेयरहाउस चालक',
    }) as never);
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 200);
    const response = await pending;
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.code).not.toBe('request_timeout');
    expect(data.cvFidelityStatus).toBe('fallback');
    expect(String(data.result)).toMatch(/[\u0900-\u097F]/);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
  });

  it('whole-request deadline exhaustion returns structured request_timeout only then', async () => {
    vi.useFakeTimers();
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    vi.stubEnv('PRO_SIGNING_KEY', '');
    vi.resetModules();
    const activation = await import('@/lib/cv-content-activation');
    vi.spyOn(activation, 'activateCvSummary').mockResolvedValue({
      content: '',
      status: 'blocked',
      repairAttempted: false,
      fallbackUsed: true,
      blocked: true,
      violations: [],
    });
    anthropicCreateMock.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + AI_SERVER_BUDGET_MS + 250);
      const err = new Error('Request timeout after 8000ms');
      err.name = 'AbortError';
      throw err;
    });

    const { POST } = await import('../../app/api/generate/route');
    const response = await POST(makeGenerateRequest(SUMMARY_BODY) as never);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.code).toBe('request_timeout');
  });

  it('50 runs: provider timeout path always falls back without flake', async () => {
    for (let i = 0; i < 50; i += 1) {
      vi.useFakeTimers();
      vi.setSystemTime(2_100_000_000_000 + i * 1_000);
      anthropicCreateMock.mockReset();
      anthropicCreateMock.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60_000));
        return { content: [{ type: 'text', text: 'late' }] };
      });
      const { POST } = await importRoute();
      const pending = POST(makeGenerateRequest(SUMMARY_BODY) as never);
      await vi.advanceTimersByTimeAsync(AI_PROVIDER_CALL_TIMEOUT_MS + 100);
      const response = await pending;
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.cvFidelityStatus).toBe('fallback');
      expect(String(data.result).trim().length).toBeGreaterThan(0);
      vi.useRealTimers();
    }
  });
});

