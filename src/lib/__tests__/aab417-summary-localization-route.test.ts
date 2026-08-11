/** @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  AI_PROVIDER_CALL_TIMEOUT_MS,
  EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS,
} from '@/lib/ai-request-timing';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const ENTRY = {
  entryId: 'e2-hi-current-newest',
  sourceLocale: 'hi',
  roleTitle: 'रखरखाव तकनीशियन',
  employer: 'مؤسسة الأفق',
  employmentState: 'present',
  facts: [
    { factId: 'e2:f1', sourceText: 'उपकरणों की दैनिक जाँच करती हैं।', sourceTextHash: 'h1' },
    { factId: 'e2:f2', sourceText: 'रखरखाव कार्य दर्ज करती हैं।', sourceTextHash: 'h2' },
    { factId: 'e2:f3', sourceText: 'टीम के साथ मरम्मत का समन्वय करती हैं।', sourceTextHash: 'h3' },
  ],
};

const LOCALIZED = {
  targetLocale: 'ar',
  entries: [{
    entryId: ENTRY.entryId,
    localizedRoleTitle: 'فنية صيانة معدات',
    facts: [
      { factId: 'e2:f1', localizedText: 'تفحص المعدات يومياً.' },
      { factId: 'e2:f2', localizedText: 'تسجل أعمال الصيانة.' },
      { factId: 'e2:f3', localizedText: 'تنسق الإصلاحات مع الفريق.' },
    ],
  }],
};

function request(action: 'summary-localize' | 'summary-context-localize', repair = false) {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action,
      requestId: `aab417-${action}`,
      targetLocale: 'ar',
      gender: 'female',
      repair,
      entries: [ENTRY],
    }),
  });
}

async function importRoute() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

describe('AAB 417 Summary localization route contracts', () => {
  beforeEach(() => anthropicCreateMock.mockReset());

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('returns an ID-stable localized manifest and makes repair a materially different prompt', async () => {
    anthropicCreateMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(LOCALIZED) }],
    });
    const { POST } = await importRoute();
    const response = await POST(request('summary-localize', true) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.apiResponseKind).toBe('localized_manifest');
    expect(data.localizationSource).toBe('provider');
    expect(data.localizedManifest).toEqual(LOCALIZED);
    const call = anthropicCreateMock.mock.calls[0]![0];
    expect(call.system).toContain('Previous structured localization was rejected');
    const payload = JSON.parse(call.messages[0].content);
    expect(payload.task).toBe('localize_cv_experience_manifest');
    expect(payload.entries).toHaveLength(1);
    expect(payload.entries[0].entryId).toBe(ENTRY.entryId);
    expect(anthropicCreateMock.mock.calls[0]![1].timeout).toBe(AI_PROVIDER_CALL_TIMEOUT_MS);
  });

  it('serializes timeout identity in the route instead of collapsing it to a generic localization failure', () => {
    const route = readFileSync('src/app/api/generate/route.ts', 'utf8');
    const start = route.indexOf("if (action === 'summary-localize' || action === 'summary-context-localize')");
    const end = route.indexOf("if (action === 'summary')", start);
    const branch = route.slice(start, end);
    expect(branch).toContain("typedReason = timeout ? 'request_timeout' : classified.code");
    expect(branch).toContain("apiResponseKind: timeout ? 'timeout' : 'http_error'");
    expect(branch).toContain('localizationTypedFailureReason: typedReason');
    expect(branch).toContain('serverFallbackUsed: false');
    expect(branch).toContain('clientFallbackUsed: false');
    expect(branch).toContain('false);'); // SDK retry is disabled; client owns hierarchy.
  });

  it('gives the alternate target-Summary context transform its longer deadline and distinct contract', async () => {
    anthropicCreateMock.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(LOCALIZED) }],
    });
    const { POST } = await importRoute();
    const response = await POST(request('summary-context-localize') as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.apiResponseKind).toBe('localized_manifest');
    expect(data.localizationSource).toBe('summary_provider_recovery');
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
    expect(anthropicCreateMock.mock.calls[0]![1].timeout)
      .toBe(EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS);
    const call = anthropicCreateMock.mock.calls[0]![0];
    expect(call.system).toContain('target-language Experience context for a professional Summary');
    const payload = JSON.parse(call.messages[0].content);
    expect(payload.task).toBe('prepare_target_summary_experience_context');
  });
});
