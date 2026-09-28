import { afterEach, describe, expect, it, vi } from 'vitest';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const entry = {
  entryId: 'privacy-safe-entry-id',
  sourceLocale: 'en',
  roleTitle: 'Warehouse specialist',
  employer: 'EmployerFixture',
  employmentState: 'present',
  facts: [],
};

function responseText(text: string) {
  return { content: [{ type: 'text', text }] };
}

function responseJson(payload: unknown) {
  return responseText(JSON.stringify(payload));
}

function validTranslator() {
  return {
    targetLocale: 'sr',
    entries: [{ entryId: entry.entryId, localizedRoleTitle: 'Skladišni specijalista' }],
  };
}

function validVerifier() {
  return {
    targetLocale: 'sr',
    entries: [{
      entryId: entry.entryId,
      decision: 'passed',
      semanticEquivalent: true,
      targetLocalePassed: true,
      unsupportedScopeIntroduced: false,
    }],
  };
}

function makeRequest() {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'export-title-localize',
      targetLocale: 'sr',
      entries: [entry],
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

describe('stability export-title route observability', () => {
  afterEach(() => {
    anthropicCreateMock.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    ['translator_response_not_object_or_invalid_json', responseText('not-json')],
    ['translator_target_locale_mismatch', responseJson({ ...validTranslator(), targetLocale: 'de' })],
    ['translator_entries_not_array', responseJson({ targetLocale: 'sr', entries: {} })],
    ['translator_entry_identity_count_mismatch', responseJson({ targetLocale: 'sr', entries: [] })],
    ['translator_missing_expected_identity', responseJson({
      targetLocale: 'sr',
      entries: [{ entryId: 'unexpected', localizedRoleTitle: 'Skladišni specijalista' }],
    })],
    ['translator_localized_title_wrong_type', responseJson({
      targetLocale: 'sr',
      entries: [{ entryId: entry.entryId, localizedRoleTitle: 7 }],
    })],
    ['translator_localized_title_empty', responseJson({
      targetLocale: 'sr',
      entries: [{ entryId: entry.entryId, localizedRoleTitle: '   ' }],
    })],
    ['translator_localized_title_too_long', responseJson({
      targetLocale: 'sr',
      entries: [{ entryId: entry.entryId, localizedRoleTitle: 'x'.repeat(501) }],
    })],
  ] as const)(
    'maps translator predicate %s without changing the top-level rejection',
    async (expectedSubcode, providerResponse) => {
      anthropicCreateMock.mockResolvedValueOnce(providerResponse);
      const { POST } = await importRoute();
      const response = await POST(makeRequest() as never);
      const data = await response.json();
      expect(response.status).toBe(422);
      expect(data.localizationTypedFailureReason)
        .toBe('export_title_localization_provider_malformed');
      expect(data.titleFailureLayer).toBe('server_translator_parse_or_parity');
      expect(data.titleFailureSubcode).toBe(expectedSubcode);
      expect(data.titleExpectedIdentityCount).toBe(1);
      expect(typeof data.titleReturnedIdentityCount).toBe('number');
    },
  );

  it.each([
    ['verifier_response_not_object_or_invalid_json', responseText('not-json')],
    ['verifier_target_locale_mismatch', responseJson({ ...validVerifier(), targetLocale: 'de' })],
    ['verifier_entries_not_array', responseJson({ targetLocale: 'sr', entries: {} })],
    ['verifier_entry_identity_count_mismatch', responseJson({ targetLocale: 'sr', entries: [] })],
    ['verifier_missing_expected_identity', responseJson({
      targetLocale: 'sr',
      entries: [{
        ...validVerifier().entries[0],
        entryId: 'unexpected',
      }],
    })],
    ['verifier_decision_not_passed', responseJson({
      targetLocale: 'sr',
      entries: [{ ...validVerifier().entries[0], decision: 'rejected' }],
    })],
    ['verifier_semantic_equivalence_failed', responseJson({
      targetLocale: 'sr',
      entries: [{ ...validVerifier().entries[0], semanticEquivalent: false }],
    })],
    ['verifier_target_locale_failed', responseJson({
      targetLocale: 'sr',
      entries: [{ ...validVerifier().entries[0], targetLocalePassed: false }],
    })],
    ['verifier_unsupported_scope_introduced', responseJson({
      targetLocale: 'sr',
      entries: [{ ...validVerifier().entries[0], unsupportedScopeIntroduced: true }],
    })],
  ] as const)(
    'keeps independent-verifier predicate %s distinct from translator malformed output',
    async (expectedSubcode, verifierResponse) => {
      anthropicCreateMock
        .mockResolvedValueOnce(responseJson(validTranslator()))
        .mockResolvedValueOnce(verifierResponse);
      const { POST } = await importRoute();
      const response = await POST(makeRequest() as never);
      const data = await response.json();
      expect(response.status).toBe(422);
      expect(data.localizationTypedFailureReason)
        .toBe('export_title_localization_independent_verification_failed');
      expect(data.titleFailureLayer).toBe('server_independent_verifier');
      expect(data.titleFailureSubcode).toBe(expectedSubcode);
      expect(data.titleExpectedIdentityCount).toBe(1);
      expect(typeof data.titleReturnedIdentityCount).toBe('number');
    },
  );

  it('keeps a successful manifest backwards compatible and free of required observability authority', async () => {
    anthropicCreateMock
      .mockResolvedValueOnce(responseJson(validTranslator()))
      .mockResolvedValueOnce(responseJson(validVerifier()));
    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.localizedManifest).toEqual({
      targetLocale: 'sr',
      entries: [{
        entryId: entry.entryId,
        localizedRoleTitle: 'Skladišni specijalista',
        facts: [],
      }],
    });
    expect(data.localizedManifest.titleFailureSubcode).toBeUndefined();
  });
});
