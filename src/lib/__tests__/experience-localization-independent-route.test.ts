import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  hashExperienceLocalizedSurfaceValue,
} from '@/lib/cv-experience-localized-surfaces';

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
  sourceClauseHash: 'source-hash-1',
  semanticFactId: 'warehouse-fact-1',
  sourceLocale: 'en',
  targetLocale: 'de',
  canonicalLineageHash: 'canonical-1',
  sourceText: SOURCE,
};

function translatorPayload(selfAttests = true, candidate = CANDIDATE) {
  return {
    snapshotId: 'snapshot-1',
    targetLocale: 'de',
    records: [{
      ...RECORD,
      localizedText: candidate,
      semanticValidation: {
        validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
        predicatePreserved: selfAttests,
        objectPreserved: selfAttests,
        workDomainPreserved: selfAttests,
        scopePreserved: selfAttests,
        negationPreserved: selfAttests,
        tensePreserved: selfAttests,
        unsupportedFactsIntroduced: !selfAttests,
      },
    }],
  };
}

function verifierPayload(passed: boolean, candidate = CANDIDATE) {
  return {
    snapshotId: 'snapshot-1',
    targetLocale: 'de',
    validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
    records: [{
      ...RECORD,
      candidateSurfaceHash: hashExperienceLocalizedSurfaceValue(candidate),
      decision: passed ? 'passed' : 'rejected',
      mismatchCategory: passed ? 'none' : 'cross_occupation_substitution',
      predicatePreserved: passed,
      objectPreserved: passed,
      workDomainPreserved: passed,
      sourceResponsibilityPreserved: passed,
      scopePreserved: passed,
      negationPreserved: passed,
      tensePreserved: passed,
      unsupportedFactsIntroduced: false,
      crossEntryFactIntroduced: false,
      crossOccupationSubstitution: !passed,
    }],
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

async function importRoute() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

describe('Experience localization independent server verifier', () => {
  afterEach(() => {
    anthropicCreateMock.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('uses two bounded calls and excludes translator self-attestation from verifier input', async () => {
    anthropicCreateMock
      .mockResolvedValueOnce(anthropicJson(translatorPayload(false)))
      .mockResolvedValueOnce(anthropicJson(verifierPayload(true)));
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    const verifierInput = anthropicCreateMock.mock.calls[1][0].messages[0].content as string;
    expect(verifierInput).toContain(SOURCE);
    expect(verifierInput).toContain(CANDIDATE);
    expect(verifierInput).toContain(hashExperienceLocalizedSurfaceValue(CANDIDATE));
    expect(verifierInput).not.toContain('semanticValidation');
    const verifierManifest = JSON.parse(verifierInput) as { records: Array<Record<string, unknown>> };
    expect(verifierManifest.records[0]).not.toHaveProperty('predicatePreserved');
    expect(verifierManifest.records[0]).not.toHaveProperty('workDomainPreserved');
    expect(data.localizedExperienceSurfaces.independentVerification).toMatchObject({
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      verifierAttemptCount: 1,
    });
  });

  test('rejects the batch when independent verification rejects positive self-attestation', async () => {
    anthropicCreateMock
      .mockResolvedValueOnce(anthropicJson(translatorPayload(true, UNRELATED_CANDIDATE)))
      .mockResolvedValueOnce(anthropicJson(verifierPayload(false, UNRELATED_CANDIDATE)));
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
    ['timeout', new DOMException('timed out', 'AbortError'), 'experience_localization_verifier_failed'],
    ['malformed', anthropicJson({ invalid: true }), 'experience_localization_verifier_malformed_json'],
  ] as const)('fails closed on verifier %s', async (_name, verifierResult, expectedReason) => {
    anthropicCreateMock.mockResolvedValueOnce(anthropicJson(translatorPayload(true)));
    if (verifierResult instanceof Error) {
      anthropicCreateMock.mockRejectedValueOnce(verifierResult);
    } else {
      anthropicCreateMock.mockResolvedValueOnce(verifierResult);
    }
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(422);
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
