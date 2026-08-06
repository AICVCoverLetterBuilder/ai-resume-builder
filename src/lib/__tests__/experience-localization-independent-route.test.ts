import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS,
  EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS,
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  canonicalizeExperienceLocalizationText,
  hashExperienceLocalizedSurfaceValue,
} from '@/lib/cv-experience-localized-surfaces';
import {
  EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS,
  EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS,
} from '@/lib/ai-request-timing';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const SOURCE = 'Inspect incoming goods for damage.';
const CANDIDATE = 'PrÃ¼ft eingehende Waren auf SchÃ¤den.';
const UNRELATED_CANDIDATE = 'Entwickelt Softwaredienste fÃ¼r Kunden.';
const RECORD = {
  requestIdentity: 'exp-surface-request-1',
  cvId: 'route-cv',
  experienceId: 'warehouse-entry',
  experienceLineageHash: 'lineage-1',
  sourceClauseIndex: 0,
  sourceClauseHash: hashExperienceLocalizedSurfaceValue(SOURCE),
  semanticFactId: 'warehouse-fact-1',
  sourceLocale: 'en',
  targetLocale: 'de',
  canonicalLineageHash: 'canonical-1',
  sourceText: SOURCE,
};

function compactTranslatorPayload(
  params: { messages: Array<{ content: string }> },
  candidates: string | string[] = CANDIDATE,
) {
  const manifest = JSON.parse(params.messages[0].content) as {
    records: Array<{ recordId: string }>;
  };
  const values = Array.isArray(candidates) ? candidates : manifest.records.map(() => candidates);
  return {
    records: manifest.records.map((record, index) => ({
      recordId: record.recordId,
      localizedSurface: values[index],
    })),
  };
}

function verifierFromParams(params: { messages: Array<{ content: string }> }, passed = true) {
  const manifest = JSON.parse(params.messages[0].content) as {
    records: Array<Record<string, unknown>>;
  };
  return {
    records: manifest.records.map((record) => ({
      recordId: record.recordId,
      decision: passed ? 'passed' : 'rejected',
      mismatchCategory: passed ? 'none' : 'cross_occupation_substitution',
      predicatePreserved: passed, objectPreserved: passed, workDomainPreserved: passed,
      sourceResponsibilityPreserved: passed, scopePreserved: passed,
      negationPreserved: passed, tensePreserved: passed,
      unsupportedFactsIntroduced: false, crossEntryFactIntroduced: false,
      crossOccupationSubstitution: !passed,
    })),
  };
}

function anthropicJson(payload: Record<string, unknown>) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

function makeRequest() {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'experience-localize',
      snapshotId: 'snapshot-1',
      targetLocale: 'de',
      records: [RECORD],
    }),
  });
}

function makeSixRecordRequest() {
  const records = Array.from({ length: 6 }, (_, index) => ({
    ...RECORD,
    requestIdentity: `exp-surface-request-${index}`,
    experienceId: index < 3 ? 'bicycle-entry' : 'reception-entry',
    sourceClauseIndex: index % 3,
    sourceClauseHash: `source-hash-${index}`,
    semanticFactId: `fact-${index}`,
    sourceLocale: 'de',
    targetLocale: 'es',
    sourceText: index < 3
      ? 'Führt Wartungs- und Reparaturarbeiten an Fahrrädern durch.'
      : 'Begrüßt Gäste und bearbeitet Reservierungen.',
  })).map((record) => ({
    ...record,
    sourceClauseHash: hashExperienceLocalizedSurfaceValue(record.sourceText),
  }));
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'experience-localize',
      snapshotId: 'snapshot-1',
      targetLocale: 'es',
      records,
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

describe('Experience localization independent server verifier', () => {
  afterEach(() => {
    vi.useRealTimers();
    anthropicCreateMock.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('sends only compact translator fields and materially reduces the six-record request', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(
        params,
        Array.from({ length: 6 }, (_, index) => `Superficie localizada ${index + 1}.`),
      )))
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
    const { POST } = await importRoute();
    const response = await POST(makeSixRecordRequest() as never);

    expect(response.status).toBe(200);
    const translatorCall = anthropicCreateMock.mock.calls[0][0];
    const manifest = JSON.parse(translatorCall.messages[0].content) as {
      records: Array<Record<string, unknown>>;
      responseSchema: { records: Array<Record<string, unknown>> };
    };
    expect(manifest.records).toHaveLength(6);
    expect(manifest.records.every((record) => (
      JSON.stringify(Object.keys(record).sort())
      === JSON.stringify(['recordId', 'sourceLocale', 'sourceText', 'targetLocale'])
    ))).toBe(true);
    expect(Object.keys(manifest.responseSchema.records[0]).sort())
      .toEqual(['localizedSurface', 'recordId']);
    expect(translatorCall.messages[0].content.length).toBeLessThan(2_000);
    expect(translatorCall.system).not.toContain('semanticValidation');
    expect(translatorCall.messages[0].content).not.toContain('canonicalLineageHash');
    expect(translatorCall.messages[0].content).not.toContain('sourceClauseHash');
    expect(translatorCall.messages[0].content).not.toContain('semanticFactId');
  });

  test('accepts reordered compact records and reconstructs full identities server-side', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) => {
        const payload = compactTranslatorPayload(
          params,
          Array.from({ length: 6 }, (_, index) => `Superficie localizada ${index + 1}.`),
        );
        payload.records.reverse();
        return anthropicJson(payload);
      })
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
    const request = makeSixRecordRequest();
    const expected = (await request.clone().json()).records as typeof RECORD[];
    const { POST } = await importRoute();
    const response = await POST(request as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.localizedExperienceSurfaces.records.map((record: typeof RECORD) => record.requestIdentity).sort())
      .toEqual(expected.map((record) => record.requestIdentity).sort());
  });

  test('sends verifier only opaque IDs, source/candidate text and locales', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(params)))
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    expect(response.status).toBe(200);
    const manifest = JSON.parse(anthropicCreateMock.mock.calls[1][0].messages[0].content) as {
      records: Array<Record<string, unknown>>;
    };
    expect(Object.keys(manifest.records[0]).sort()).toEqual([
      'candidateLocalizedText', 'recordId', 'sourceLocale', 'sourceText', 'targetLocale',
    ]);
    const serialized = JSON.stringify(manifest);
    for (const forbidden of [
      'cvId', 'experienceId', 'canonicalLineageHash', 'sourceClauseHash',
      'semanticFactId', 'candidateSurfaceHash', 'snapshotId',
    ]) expect(serialized).not.toContain(forbidden);
  });

  test('accepts reordered compact verifier decisions and restores full identities', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(
        params, Array.from({ length: 6 }, (_, index) => `Superficie localizada ${index + 1}.`),
      )))
      .mockImplementationOnce(async (params) => {
        const payload = verifierFromParams(params);
        payload.records.reverse();
        return anthropicJson(payload);
      });
    const { POST } = await importRoute();
    const response = await POST(makeSixRecordRequest() as never);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.localizedExperienceSurfaces.records).toHaveLength(6);
    expect(data.localizedExperienceSurfaces.independentVerification.records).toHaveLength(6);
  });

  test.each([
    ['missing', (records: Array<Record<string, unknown>>) => records.slice(1)],
    ['duplicate', (records: Array<Record<string, unknown>>) => [...records.slice(0, -1), records[0]]],
    ['unknown', (records: Array<Record<string, unknown>>) => [
      ...records.slice(0, -1), { ...records[0], recordId: 'vr_unknown' },
    ]],
    ['altered-identity-field', (records: Array<Record<string, unknown>>) => records.map((record, index) => (
      index === 0 ? { ...record, cvId: 'provider-controlled' } : record
    ))],
  ] as const)('rejects compact verifier %s output atomically', async (_name, mutate) => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(
        params, Array.from({ length: 6 }, (_, index) => `Superficie localizada ${index + 1}.`),
      )))
      .mockImplementationOnce(async (params) => {
        const payload = verifierFromParams(params);
        return anthropicJson({ records: mutate(payload.records) });
      });
    const { POST } = await importRoute();
    const response = await POST(makeSixRecordRequest() as never);
    const data = await response.json();
    expect(response.status).toBe(422);
    expect(data.localizedExperienceSurfaces).toBeUndefined();
  });

  test.each([
    ['missing', (records: Array<Record<string, unknown>>) => records.slice(1)],
    ['duplicate', (records: Array<Record<string, unknown>>) => [...records.slice(0, -1), records[0]]],
    ['unknown', (records: Array<Record<string, unknown>>) => [
      ...records.slice(0, -1), { recordId: 'tr_unknown', localizedSurface: 'Superficie localizada.' },
    ]],
    ['extra-field', (records: Array<Record<string, unknown>>) => records.map((record, index) => (
      index === 0 ? { ...record, cvId: 'provider-controlled' } : record
    ))],
  ] as const)('rejects compact translator %s output before verifier dispatch', async (_name, mutate) => {
    anthropicCreateMock.mockImplementationOnce(async (params) => {
      const payload = compactTranslatorPayload(params, Array(6).fill('Superficie localizada.'));
      return anthropicJson({ records: mutate(payload.records) });
    });
    const { POST } = await importRoute();
    const response = await POST(makeSixRecordRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.localizedExperienceSurfaces).toBeUndefined();
    expect(data.independentVerifierAttemptCount).toBe(0);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  test('rejects an empty compact surface before verifier dispatch', async () => {
    anthropicCreateMock.mockImplementationOnce(async (params) => (
      anthropicJson(compactTranslatorPayload(params, ''))
    ));
    const { POST } = await importRoute();
    const response = await POST(makeSixRecordRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.localizedExperienceSurfaces).toBeUndefined();
    expect(data.independentVerifierAttemptCount).toBe(0);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  test('rejects unchanged source-language surfaces before verifier dispatch', async () => {
    anthropicCreateMock.mockImplementationOnce(async (params) => {
      const manifest = JSON.parse(params.messages[0].content) as {
        records: Array<{ sourceText: string }>;
      };
      return anthropicJson(compactTranslatorPayload(
        params,
        manifest.records.map((record) => record.sourceText),
      ));
    });
    const { POST } = await importRoute();
    const response = await POST(makeSixRecordRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.localizedExperienceSurfaces).toBeUndefined();
    expect(data.independentVerifierAttemptCount).toBe(0);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  test('rejects an oversized compact batch before any provider call', async () => {
    const request = makeSixRecordRequest();
    const body = await request.json();
    body.records = Array.from({ length: 13 }, (_, index) => ({
      ...body.records[index % body.records.length],
      requestIdentity: `oversized-${index}`,
      sourceClauseHash: `oversized-source-${index}`,
      semanticFactId: `oversized-fact-${index}`,
    }));
    const { POST } = await importRoute();
    const response = await POST(new Request(request.url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.localizationTypedFailureReason).toBe('experience_localization_batch_too_large');
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  test('rejects source text above the shared canonical limit before any provider call', async () => {
    const request = makeRequest();
    const body = await request.json();
    const sourceText = 'x'.repeat(EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS + 1);
    body.records[0].sourceText = sourceText;
    body.records[0].sourceClauseHash = hashExperienceLocalizedSurfaceValue(sourceText);
    const { POST } = await importRoute();
    const response = await POST(new Request(request.url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.localizationTypedFailureReason)
      .toBe('experience_localization_source_text_too_long');
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  test('rejects an oversized physical payload before any provider call', async () => {
    const sources = ['a'.repeat(3_000), 'b'.repeat(3_000)];
    const body = { action: 'experience-localize', snapshotId: 'snapshot-over-payload', targetLocale: 'de',
      records: sources.map((sourceText, index) => ({ ...RECORD, requestIdentity: `payload-${index}`,
        sourceClauseIndex: index, semanticFactId: `payload-fact-${index}`, sourceText,
        sourceClauseHash: hashExperienceLocalizedSurfaceValue(sourceText) })) };
    const { POST } = await importRoute();
    const response = await POST(new Request('https://cvproai.test/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);
    const data = await response.json();
    expect(response.status).toBe(422);
    expect(data.localizationTypedFailureReason).toBe('experience_localization_batch_payload_too_large');
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  test('rejects source/hash mismatch before any provider call', async () => {
    const body = { action: 'experience-localize', snapshotId: 'snapshot-hash-mismatch', targetLocale: 'de',
      records: [{ ...RECORD, sourceClauseHash: hashExperienceLocalizedSurfaceValue('different') }] };
    const { POST } = await importRoute();
    const response = await POST(new Request('https://cvproai.test/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);
    const data = await response.json();
    expect(response.status).toBe(422);
    expect(data.localizationTypedFailureReason).toBe('experience_localization_request_identity_invalid');
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  test('accepts source text exactly at the canonical limit without truncation', async () => {
    const sourceText = `A${'b'.repeat(EXPERIENCE_LOCALIZATION_MAX_SOURCE_TEXT_CHARS - 1)}`;
    const body = { action: 'experience-localize', snapshotId: 'snapshot-at-limit', targetLocale: 'de', records: [{
      ...RECORD, sourceText, sourceClauseHash: hashExperienceLocalizedSurfaceValue(sourceText),
    }] };
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(params, 'Bearbeitet Anfragen.')))
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
    const { POST } = await importRoute();
    const response = await POST(new Request('https://cvproai.test/api/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);
    expect(response.status).toBe(200);
    const manifest = JSON.parse(anthropicCreateMock.mock.calls[0][0].messages[0].content);
    expect(manifest.records[0].sourceText).toBe(sourceText);
  });

  test.each([7_900, 8_500, EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS - 100])(
    'accepts a translation response delayed %sms without retrying',
    async (delayMs) => {
      vi.useFakeTimers();
      const request = makeSixRecordRequest();
      const requestBody = await request.clone().json();
      const records = requestBody.records as typeof RECORD[];
      const translated = records.map((record, index) => ({
        ...record,
        localizedText: `Superficie localizada ${index + 1}.`,
      }));
      anthropicCreateMock
        .mockImplementationOnce((params) => new Promise((resolve) => setTimeout(
          () => resolve(anthropicJson(compactTranslatorPayload(
            params,
            translated.map((record) => record.localizedText),
          ))),
          delayMs,
        )))
        .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
      const { POST } = await importRoute();
      const pending = POST(request as never);
      await vi.advanceTimersByTimeAsync(delayMs);
      const response = await pending;

      expect(response.status).toBe(200);
      expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    },
  );

  test('fails a translation once just above its bound and never dispatches the verifier', async () => {
    vi.useFakeTimers();
    anthropicCreateMock.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 60_000)));
    const { POST } = await importRoute();
    const pending = POST(makeSixRecordRequest() as never);
    await vi.advanceTimersByTimeAsync(EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS + 1);
    const response = await pending;
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.localizationTypedFailureReason).toBe('translation_transport_timeout');
    expect(data.translationProviderAttemptCount).toBe(1);
    expect(data.independentVerifierAttemptCount).toBe(0);
    expect(data.retryCount).toBe(0);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  test('does not retry a fast translator provider failure', async () => {
    anthropicCreateMock.mockRejectedValueOnce(new Error('provider 503 overloaded'));
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();
    expect(response.status).toBe(422);
    expect(data.localizationTypedFailureReason).toBe('provider_http_failure');
    expect(data.translationProviderAttemptCount).toBe(1);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    [EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS - 100, 200, null],
    [EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS + 1, 504, 'verifier_transport_timeout'],
  ] as const)('bounds verifier delay %sms with status %s', async (delayMs, status, reason) => {
    vi.useFakeTimers();
    const request = makeSixRecordRequest();
    const requestBody = await request.clone().json();
    const records = requestBody.records as typeof RECORD[];
    const translated = records.map((record, index) => ({
      ...record,
      localizedText: `Superficie localizada ${index + 1}.`,
    }));
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(
        params,
        translated.map((record) => record.localizedText),
      )))
      .mockImplementationOnce((params) => new Promise((resolve) => setTimeout(
        () => resolve(anthropicJson(verifierFromParams(params))),
        delayMs,
      )));
    const { POST } = await importRoute();
    const pending = POST(request as never);
    await vi.advanceTimersByTimeAsync(delayMs);
    const response = await pending;
    const data = await response.json();

    expect(response.status).toBe(status);
    expect(data.localizationTypedFailureReason ?? null).toBe(reason);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    if (reason) {
      expect(data.independentVerifierAttemptCount).toBe(1);
      expect(data.retryCount).toBe(0);
      expect(data.localizedExperienceSurfaces).toBeUndefined();
      expect(data).toMatchObject({
        translationResponded: true,
        translationParserPassed: true,
        compactTranslatorIdsValidated: true,
        fullIdentitiesReconstructed: true,
        candidateHashesComputed: true,
        verifierDispatched: true,
        translatedRecordCount: 6,
      });
    }
  });

  test('does not dispatch verifier when route budget is insufficient after translation', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    anthropicCreateMock.mockImplementationOnce(async (params) => {
      vi.setSystemTime(start + 24_600);
      return anthropicJson(compactTranslatorPayload(
        params, Array.from({ length: 6 }, (_, index) => `Superficie localizada ${index + 1}.`),
      ));
    });
    const { POST } = await importRoute();
    const response = await POST(makeSixRecordRequest() as never);
    const data = await response.json();
    expect(response.status).toBe(504);
    expect(data.localizationTypedFailureReason).toBe('route_deadline_insufficient');
    expect(data.verifierDispatched).toBe(false);
    expect(data.translatedRecordCount).toBe(6);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(1);
  });

  test('uses two bounded calls and excludes translator self-attestation from verifier input', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(params)))
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    const verifierInput = anthropicCreateMock.mock.calls[1][0].messages[0].content as string;
    expect(verifierInput).toContain(SOURCE);
    expect(verifierInput).toContain(CANDIDATE);
    expect(verifierInput).not.toContain(hashExperienceLocalizedSurfaceValue(CANDIDATE));
    expect(verifierInput).not.toContain('semanticValidation');
    const verifierManifest = JSON.parse(verifierInput) as { records: Array<Record<string, unknown>> };
    expect(verifierManifest.records[0]).not.toHaveProperty('predicatePreserved');
    expect(verifierManifest.records[0]).not.toHaveProperty('workDomainPreserved');
    expect(data.localizedExperienceSurfaces.independentVerification).toMatchObject({
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      verifierAttemptCount: 1,
    });
  });

  test('sizes both provider calls for the six-record physical-device manifest', async () => {
    const request = makeSixRecordRequest();
    const requestBody = await request.clone().json();
    const records = requestBody.records as typeof RECORD[];
    const translated = records.map((record, index) => ({
      ...record,
      localizedText: `Superficie localizada ${index + 1}.`,
    }));
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(
        params,
        translated.map((record) => record.localizedText),
      )))
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
    const { POST } = await importRoute();
    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    const totalSourceChars = records.reduce(
      (sum, record) => sum + canonicalizeExperienceLocalizationText(record.sourceText).length, 0,
    );
    expect(anthropicCreateMock.mock.calls[0][0].max_tokens)
      .toBe(Math.min(6200, Math.max(1200, 1200 + totalSourceChars)));
    expect(anthropicCreateMock.mock.calls[1][0].max_tokens).toBe(1650);
  });

  test('fits maximum six-record compact responses under derived ceilings', async () => {
    const request = makeSixRecordRequest();
    const body = await request.json();
    body.records = Array.from({ length: 6 }, (_, index) => ({
      ...body.records[index % 6],
      requestIdentity: `max-request-${index}`,
      sourceClauseHash: hashExperienceLocalizedSurfaceValue(body.records[index % 6].sourceText),
      semanticFactId: `max-fact-${index}`,
      sourceClauseIndex: index,
    }));
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(
        params, Array.from({ length: 6 }, (_, index) => `Superficie localizada ${index + 1}.`),
      )))
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params)));
    const { POST } = await importRoute();
    const response = await POST(new Request(request.url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }) as never);
    expect(response.status).toBe(200);
    expect(anthropicCreateMock.mock.calls[0][0].max_tokens).toBeLessThanOrEqual(6200);
    expect(anthropicCreateMock.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(1200);
    expect(anthropicCreateMock.mock.calls[1][0].max_tokens).toBe(1650);
    const translatorManifest = JSON.parse(anthropicCreateMock.mock.calls[0][0].messages[0].content);
    const maximumTranslatorResponseBytes = Buffer.byteLength(JSON.stringify({
      records: translatorManifest.records.map((record: { recordId: string }) => ({
        recordId: record.recordId, localizedSurface: '\u0800'.repeat(Math.floor(EXPERIENCE_LOCALIZATION_MAX_BATCH_SOURCE_CHARS / 6)),
      })),
    }), 'utf8');
    const verifierManifest = JSON.parse(anthropicCreateMock.mock.calls[1][0].messages[0].content);
    const maximumVerifierResponseBytes = Buffer.byteLength(JSON.stringify(verifierFromParams({
      messages: [{ content: JSON.stringify(verifierManifest) }],
    }, false)), 'utf8');
    expect(Math.ceil(maximumTranslatorResponseBytes / 4)).toBeLessThan(6200);
    expect(Math.ceil(maximumVerifierResponseBytes / 4)).toBeLessThan(1650);
  });

  test('rejects the batch when independent verification rejects positive self-attestation', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(params, UNRELATED_CANDIDATE)))
      .mockImplementationOnce(async (params) => anthropicJson(verifierFromParams(params, false)));
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    expect(data.localizedExperienceSurfaces).toBeUndefined();
    expect(data.localizationTypedFailureReason)
      .toBe('experience_localization_independent_semantic_validation_failed');
    expect(data).toMatchObject({
      translationProviderAttemptCount: 1,
      independentVerifierAttemptCount: 1,
      translatedRecordCount: 1,
    });
  });

  test.each([
    ['timeout', new DOMException('timed out', 'AbortError'), 'verifier_transport_timeout'],
    ['malformed', anthropicJson({ invalid: true }), 'experience_localization_verifier_malformed_json'],
  ] as const)('fails closed on verifier %s', async (_name, verifierResult, expectedReason) => {
    anthropicCreateMock.mockImplementationOnce(async (params) => anthropicJson(compactTranslatorPayload(params)));
    if (verifierResult instanceof Error) {
      anthropicCreateMock.mockRejectedValueOnce(verifierResult);
    } else {
      anthropicCreateMock.mockResolvedValueOnce(verifierResult);
    }
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(expectedReason === 'verifier_transport_timeout' ? 504 : 422);
    expect(data.localizedExperienceSurfaces).toBeUndefined();
    expect(data.localizationTypedFailureReason).toBe(expectedReason);
  });

  test('rejects an unsupported target locale before provider work', async () => {
    const { POST } = await importRoute();
    const request = makeRequest();
    const body = await request.json();
    body.targetLocale = 'pt';
    body.records[0].targetLocale = 'pt';
    const response = await POST(new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.localizationTypedFailureReason)
      .toBe('experience_localization_unsupported_target_locale');
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });
});
