import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
} from '@/lib/cv-export-title-localization';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const translations = new Map<string, string>([
  [
    'Koordinator für E-Bike-Service und Kundenannahme',
    'Coordinador de servicio de bicicletas eléctricas y atención al cliente',
  ],
  [
    'Mitarbeiter für Gästeempfang und Reservierungsverwaltung',
    'Empleado de recepción de huéspedes y gestión de reservas',
  ],
  ['Fahrradmechaniker', 'Mecánico de bicicletas'],
  ['Rezeptionist', 'Recepcionista'],
]);

const entries = [
  {
    entryId: 'title-current-coordinator',
    sourceLocale: 'de',
    roleTitle: 'Koordinator für E-Bike-Service und Kundenannahme',
    employer: 'RadWerk',
    employmentState: 'present',
    facts: [],
  },
  {
    entryId: 'title-prior-reception-admin',
    sourceLocale: 'de',
    roleTitle: 'Mitarbeiter für Gästeempfang und Reservierungsverwaltung',
    employer: 'StadtHotel',
    employmentState: 'completed',
    facts: [],
  },
  {
    entryId: 'title-current-mechanic',
    sourceLocale: 'de',
    roleTitle: 'Fahrradmechaniker',
    employer: 'RadWerk',
    employmentState: 'present',
    facts: [],
  },
  {
    entryId: 'title-prior-receptionist',
    sourceLocale: 'de',
    roleTitle: 'Rezeptionist',
    employer: 'StadtHotel',
    employmentState: 'completed',
    facts: [],
  },
] as const;

function anthropicJson(payload: Record<string, unknown>) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  };
}

function translatorFromParams(params: { messages: Array<{ content: string }> }) {
  const body = JSON.parse(params.messages[0].content) as {
    targetLocale: string;
    entries: Array<{ entryId: string; roleTitle: string }>;
  };
  return {
    targetLocale: body.targetLocale,
    entries: body.entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle:
        translations.get(entry.roleTitle) || `ES ${entry.roleTitle}`,
    })),
  };
}

function verifierFromParams(
  params: { messages: Array<{ content: string }> },
  passed = true,
) {
  const body = JSON.parse(params.messages[0].content) as {
    targetLocale: string;
    entries: Array<{ entryId: string }>;
  };
  return {
    targetLocale: body.targetLocale,
    entries: body.entries.map((entry) => ({
      entryId: entry.entryId,
      decision: passed ? 'passed' : 'rejected',
      semanticEquivalent: passed,
      targetLocalePassed: passed,
      unsupportedScopeIntroduced: false,
    })),
  };
}

function makeRequest(extra: Record<string, unknown> = {}) {
  return new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'export-title-localize',
      targetLocale: 'es',
      gender: 'male',
      entries,
      ...extra,
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

describe('AAB-407 title localization failure identity chain', () => {
  afterEach(() => {
    anthropicCreateMock.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('runs the real title translator + independent verifier route for the four device titles', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) =>
        anthropicJson(translatorFromParams(params)))
      .mockImplementationOnce(async (params) =>
        anthropicJson(verifierFromParams(params)));

    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    expect(data.localizedManifest.targetLocale).toBe('es');
    expect(data.localizedManifest.entries).toHaveLength(4);
    expect(data.localizedManifest.entries.map(
      (entry: { localizedRoleTitle: string }) => entry.localizedRoleTitle,
    )).toEqual([
      'Coordinador de servicio de bicicletas eléctricas y atención al cliente',
      'Empleado de recepción de huéspedes y gestión de reservas',
      'Mecánico de bicicletas',
      'Recepcionista',
    ]);
  });

  it('preserves a typed translator timeout instead of collapsing to provider_failed', async () => {
    anthropicCreateMock.mockRejectedValueOnce(
      new DOMException('timed out', 'AbortError'),
    );

    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.localizationTypedFailureReason)
      .toBe('export_title_localization_translation_transport_timeout');
    expect(data.localizationTypedFailureReason)
      .not.toBe('export_title_localization_provider_failed');
    expect(data.localizationFailureStage).toBe('title_translation_transport');
    expect(data.titleTranslatorAttemptCount).toBe(1);
    expect(data.titleVerifierAttemptCount).toBe(0);
  });

  it('preserves provider outage identity and does not disguise it as a recoverable batch failure', async () => {
    anthropicCreateMock.mockRejectedValueOnce(
      new Error('provider 503 overloaded'),
    );

    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.localizationTypedFailureReason)
      .toBe('export_title_localization_provider_temporarily_unavailable');
    expect(data.localizationTypedFailureReason)
      .not.toBe('export_title_localization_provider_failed');
    expect(data.localizationTypedFailureReason)
      .not.toBe('export_title_localization_provider_malformed');
    expect(data.localizationFailureStage).toBe('title_translation_transport');
  });

  it('preserves a typed verifier timeout after translator success', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) =>
        anthropicJson(translatorFromParams(params)))
      .mockRejectedValueOnce(new DOMException('timed out', 'AbortError'));

    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(504);
    expect(data.localizationTypedFailureReason)
      .toBe('export_title_localization_verifier_transport_timeout');
    expect(data.localizationFailureStage).toBe('title_verifier_transport');
    expect(data.titleTranslatorAttemptCount).toBe(1);
    expect(data.titleVerifierAttemptCount).toBe(1);
  });

  it('returns repair context for malformed translator output', async () => {
    anthropicCreateMock.mockResolvedValueOnce(
      anthropicJson({ invalid: true }),
    );

    const { POST } = await importRoute();
    const response = await POST(makeRequest() as never);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.localizationTypedFailureReason)
      .toBe('export_title_localization_provider_malformed');
    expect(data.localizationFailureStage).toBe('title_translation_parse');
    expect(data.titleRepairContext).toMatchObject({
      failedStage: 'translator_parse',
      verifierDecisions: [],
    });
    expect(Array.isArray(data.titleRepairContext.previousCandidates)).toBe(true);
  });

  it('returns rejected candidates + verifier decisions and feeds them into the repair request', async () => {
    anthropicCreateMock
      .mockImplementationOnce(async (params) =>
        anthropicJson(translatorFromParams(params)))
      .mockImplementationOnce(async (params) =>
        anthropicJson(verifierFromParams(params, false)));

    const firstRoute = await importRoute();
    const firstResponse = await firstRoute.POST(makeRequest() as never);
    const firstData = await firstResponse.json();

    expect(firstResponse.status).toBe(422);
    expect(firstData.localizationTypedFailureReason)
      .toBe('export_title_localization_independent_verification_failed');
    expect(firstData.titleRepairContext.failedStage)
      .toBe('independent_verifier');
    expect(firstData.titleRepairContext.previousCandidates).toHaveLength(4);
    expect(firstData.titleRepairContext.verifierDecisions).toHaveLength(4);

    anthropicCreateMock.mockReset();
    anthropicCreateMock
      .mockImplementationOnce(async (params) =>
        anthropicJson(translatorFromParams(params)))
      .mockImplementationOnce(async (params) =>
        anthropicJson(verifierFromParams(params)));

    const repairRoute = await importRoute();
    const repairResponse = await repairRoute.POST(makeRequest({
      repair: true,
      repairContext: firstData.titleRepairContext,
    }) as never);

    expect(repairResponse.status).toBe(200);
    const translatorPayload = JSON.parse(
      anthropicCreateMock.mock.calls[0][0].messages[0].content,
    );
    expect(translatorPayload.repairContext.failedStage)
      .toBe('independent_verifier');
    expect(translatorPayload.repairContext.previousCandidates).toHaveLength(4);
    expect(translatorPayload.repairContext.verifierDecisions).toHaveLength(4);
  });

  it('wires a fresh title operation deadline, stable client failure identity, cancellation, and strict split policy', () => {
    const page = readFileSync('src/app/cv-builder/page.tsx', 'utf8');
    const route = readFileSync('src/app/api/generate/route.ts', 'utf8');
    const title = readFileSync(
      'src/lib/cv-export-title-localization.ts',
      'utf8',
    );

    const pageStart = page.indexOf(
      'const titleLocalizationOperationDeadlineAt',
    );
    const pageEnd = page.indexOf(
      'if (!titleLocalization.ok)',
      pageStart,
    );
    expect(pageStart).toBeGreaterThanOrEqual(0);
    expect(pageEnd).toBeGreaterThan(pageStart);
    const titleClientBlock = page.slice(pageStart, pageEnd);

    expect(titleClientBlock).toContain(
      'computeExperienceLocalizationOperationDeadline(Date.now())',
    );
    expect(titleClientBlock).toContain(
      'titleLocalizationOperationDeadlineAt - Date.now()',
    );
    expect(titleClientBlock).not.toContain(
      'experienceLocalizationOperationDeadlineAt - Date.now()',
    );
    expect(titleClientBlock).toContain('titleRepairContextByBatchKey');
    expect(titleClientBlock).toContain('data?.localizationTypedFailureReason');
    expect(titleClientBlock).not.toContain(
      "data?.error || 'export_title_localization_provider_failed'",
    );

    const routeStart = route.indexOf(
      "if (action === 'export-title-localize')",
    );
    const nextAction = route.indexOf(
      "if (action === '",
      routeStart + 20,
    );
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(nextAction).toBeGreaterThan(routeStart);
    const titleRouteBlock = route.slice(routeStart, nextAction);

    expect(titleRouteBlock).toContain(
      "EXPERIENCE_LOCALIZATION_TRANSLATION_TIMEOUT_MS, 'translation', req.signal, false",
    );
    expect(titleRouteBlock).toContain(
      "EXPERIENCE_LOCALIZATION_VERIFIER_TIMEOUT_MS, 'verifier', req.signal, false",
    );
    expect(titleRouteBlock).toContain(
      'export_title_localization_provider_malformed',
    );
    expect(titleRouteBlock).toContain(
      'export_title_localization_independent_verification_failed',
    );
    expect(titleRouteBlock).toContain('titleRepairContext');

    const classifierStart = title.indexOf(
      'function batchFailureCanBeIsolated',
    );
    const classifierEnd = title.indexOf(
      'function cachedMatches',
      classifierStart,
    );
    const classifier = title.slice(classifierStart, classifierEnd);
    expect(classifier).toContain(
      'export_title_localization_provider_malformed',
    );
    expect(classifier).toContain(
      'export_title_localization_independent_verification_failed',
    );
    expect(classifier).not.toContain(
      "|| reason === 'export_title_localization_provider_failed'",
    );
    expect(classifier).not.toContain(
      'export_title_localization_provider_temporarily_unavailable',
    );
    expect(classifier).not.toContain(
      'export_title_localization_translation_transport_timeout',
    );

    expect(CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION)
      .toBe('cv-export-title-batch-recovery-407-v3');
  });
});
it('declares the AAB-407 title transport diagnostics contract explicitly', () => {
  const diagnosticsSource = readFileSync(
    'src/lib/cv-experience-localized-surfaces.ts',
    'utf8',
  );
  const pageSource = readFileSync('src/app/cv-builder/page.tsx', 'utf8');

  const requiredFields = [
    'titleTransportFailureReason?: string;',
    'titleTransportFailureStage?: string;',
    'titleTransportHttpStatus?: number | null;',
    'titleTransportApplicationCode?: string | null;',
    'titleTransportProviderStatus?: number | string | null;',
    'titleTransportDeadlineOwner?: string | null;',
    'titleTransportTranslatorAttemptCount?: number | null;',
    'titleTransportVerifierAttemptCount?: number | null;',
    'titleTransportRetryAfterSec?: number | null;',
    'titleTransportRepairContextPresent?: boolean;',
    'titleTransportRecovered?: boolean;',
  ];

  for (const field of requiredFields) {
    expect(diagnosticsSource).toContain(field);
  }

  expect(pageSource).toContain(
    'const titleTransportDiagnostics: Partial<ExperienceLocalizationDiagnostics> = {};',
  );
});
