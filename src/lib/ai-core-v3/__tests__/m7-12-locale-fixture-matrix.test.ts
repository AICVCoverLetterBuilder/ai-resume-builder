import { describe, expect, it } from 'vitest';
import { createEmptyCv } from '../../cv-defaults';
import { hashExperienceSourceLocaleText } from '../../cv-experience-source-locale';
import { hashSummarySourceLocaleText } from '../../cv-summary-source-locale';
import type { Locale } from '../../i18n/translations';
import type { CVData } from '../../types';
import {
  CONTENT_LOCALIZE_M6_TARGET_LOCALES,
  createContentLocalizeM6Operation,
  type ContentLocalizeM6Snapshot,
} from '../content-localize-m6';
import { classifyExperienceV3Routing } from '../experience-generate';
import { classifyExperienceV3EnhanceRouting } from '../experience-enhance';
import { classifySummaryV3GenerateRouting } from '../summary-generate';
import {
  SUMMARY_V3_STYLE_M5_STYLES,
  SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES,
  canonicalSummaryV3StyleLocale,
  decideSummaryV3StyleOwnership,
} from '../summary-style-m5';
import { GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE } from '../fixtures/german-aab529-device-output';
import {
  runExperienceV3GenerateAdapter,
  type ExperienceV3AdapterInput,
} from '../experience-generate';
import {
  executeExperienceV3GenerateServer,
  EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
} from '../experience-generate-server';
import {
  executeContentLocalizeM6Server,
  type ContentLocalizeM6EvaluatorRequest,
  type ContentLocalizeM6WriterRequest,
} from '../content-localize-m6-server';

/**
 * M7 synthetic fixtures are test-authored native-language source surfaces.
 * They are neither user-authored, device-observed, provider-observed, nor
 * historical output. Historical evidence remains separately classified below.
 *
 * Software-only PASS definitions:
 * - Semantic: a real committed V3 evaluator rejects an exact locale-bound
 *   candidate on a negative semantic verdict and the server fails closed.
 * - Language Quality: the independent evaluator rejects exactly its
 *   professionalCvQuality criterion and cannot provide replacement prose.
 * - Usage: the committed transactional owner durably applies once and charges
 *   +1; rejected candidates write/persist/charge nothing.
 *
 * None of these software-only gates claims every future live-provider sentence
 * is semantically or linguistically perfect. M8 owns provider/device quality.
 */
type M7LocaleFixture = Readonly<{
  readonly fixtureId: string;
  readonly locale: Locale;
  readonly sourceEvidenceType: 'synthetic_native_test_fixture';
  readonly role: string;
  readonly employer: string;
  readonly summary: string;
  readonly experienceDescription: string;
  readonly exactCandidateOutputSurface: 'synthetic_test_candidate';
  readonly transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test';
  readonly expectedTerminalResult: 'owned_or_request_ready';
  readonly expectedUsageDelta: 'success_plus_one_reject_zero';
  readonly expectedSourceCanonicalPreservation: 'preserved';
  readonly expectedLocaleBinding: 'exact_source_and_target';
  readonly expectedSemanticViolations: 'semantic_and_language_rejection_enforced';
  readonly semanticEvidence: 'PASS';
  readonly languageQualityEvidence: 'PASS';
  readonly usageEvidence: 'PASS';
}>;

const M7_LOCALE_FIXTURES: readonly M7LocaleFixture[] = [
  { fixtureId: 'm7-sr', locale: 'sr', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Inženjerka', employer: 'Nova', summary: 'Inženjerka gradi API-je, koordinira zahteve i vodi evidenciju.', experienceDescription: 'Gradi API-je.\nKoordinira zahteve.\nVodi evidenciju.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-en', locale: 'en', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Engineer', employer: 'Nova', summary: 'Engineer builds APIs, coordinates requests, and maintains records.', experienceDescription: 'Builds APIs.\nCoordinates requests.\nMaintains records.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-hi', locale: 'hi', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'इंजीनियर', employer: 'नोवा', summary: 'इंजीनियर एपीआई बनाती हैं, अनुरोधों का समन्वय करती हैं और रिकॉर्ड रखती हैं।', experienceDescription: 'एपीआई बनाती हैं।\nअनुरोधों का समन्वय करती हैं।\nरिकॉर्ड रखती हैं।', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-ar', locale: 'ar', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'مهندسة', employer: 'نوفا', summary: 'مهندسة تبني واجهات برمجة التطبيقات وتنسق الطلبات وتحافظ على السجلات.', experienceDescription: 'تبني واجهات برمجة التطبيقات.\nتنسق الطلبات.\nتحافظ على السجلات.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-ja', locale: 'ja', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'エンジニア', employer: 'ノヴァ', summary: 'エンジニアとしてAPIを構築し、依頼を調整し、記録を管理します。', experienceDescription: 'APIを構築します。\n依頼を調整します。\n記録を管理します。', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-de', locale: 'de', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Ingenieurin', employer: 'Nova', summary: 'Ingenieurin entwickelt APIs, koordiniert Anfragen und pflegt Unterlagen.', experienceDescription: 'Entwickelt APIs.\nKoordiniert Anfragen.\nPflegt Unterlagen.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-fr', locale: 'fr', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Ingénieure', employer: 'Nova', summary: 'Ingénieure construit des API, coordonne les demandes et tient les dossiers.', experienceDescription: 'Construit des API.\nCoordonne les demandes.\nTient les dossiers.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-es', locale: 'es', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Ingeniera', employer: 'Nova', summary: 'Ingeniera construye API, coordina solicitudes y mantiene registros.', experienceDescription: 'Construye API.\nCoordina solicitudes.\nMantiene registros.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-it', locale: 'it', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Ingegnera', employer: 'Nova', summary: 'Ingegnera costruisce API, coordina le richieste e mantiene i registri.', experienceDescription: 'Costruisce API.\nCoordina le richieste.\nMantiene i registri.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-hr', locale: 'hr', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Inženjerka', employer: 'Nova', summary: 'Inženjerka izrađuje API-je, koordinira zahtjeve i vodi evidenciju.', experienceDescription: 'Izrađuje API-je.\nKoordinira zahtjeve.\nVodi evidenciju.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-pt-br', locale: 'pt-BR', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Engenheira', employer: 'Nova', summary: 'Engenheira cria APIs, coordena solicitações e mantém registros.', experienceDescription: 'Cria APIs.\nCoordena solicitações.\nMantém registros.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
  { fixtureId: 'm7-ru', locale: 'ru', sourceEvidenceType: 'synthetic_native_test_fixture', role: 'Инженер', employer: 'Нова', summary: 'Инженер создаёт API, координирует запросы и ведёт записи.', experienceDescription: 'Создаёт API.\nКоординирует запросы.\nВедёт записи.', exactCandidateOutputSurface: 'synthetic_test_candidate', transactionCandidateProvenance: 'synthetic_target_surface_for_transaction_test', expectedTerminalResult: 'owned_or_request_ready', expectedUsageDelta: 'success_plus_one_reject_zero', expectedSourceCanonicalPreservation: 'preserved', expectedLocaleBinding: 'exact_source_and_target', expectedSemanticViolations: 'semantic_and_language_rejection_enforced', semanticEvidence: 'PASS', languageQualityEvidence: 'PASS', usageEvidence: 'PASS' },
] as const;

const M7_HISTORICAL_AUTHORITY_MAP = [
  {
    locale: 'de',
    provenance: 'user_supplied_device_output',
    paths: [
      'src/lib/ai-core-v3/__tests__/german-aab529-device-output.test.ts',
      'src/lib/ai-core-v3/__tests__/experience-generate-m2.test.ts',
      'src/lib/ai-core-v3/__tests__/experience-enhance-m3.test.ts',
    ],
  },
  {
    locale: 'sr',
    provenance: 'committed_regression_test_authority',
    paths: ['src/lib/ai-core-v3/__tests__/summary-style-m5-server.test.ts'],
  },
  {
    locale: 'ja',
    provenance: 'committed_regression_test_authority',
    paths: [
      'src/lib/ai-core-v3/__tests__/summary-generate-m4.test.ts',
      'src/lib/ai-core-v3/__tests__/summary-style-m5-server.test.ts',
    ],
  },
] as const;

type M7GateKind = 'semantic' | 'language_quality';

function m6SnapshotFor(fixture: M7LocaleFixture): ContentLocalizeM6Snapshot {
  const operation = createContentLocalizeM6Operation({
    operationId: `${fixture.fixtureId}-m6-gate`,
    requestId: `${fixture.fixtureId}-m6-gate`,
    kind: 'summary',
    targetLocale: nextLocale(fixture.locale),
    confirmed: true,
    cv: cvFor(fixture),
  });
  if (operation.status !== 'request_ready') throw new Error(`M7 M6 snapshot not ready: ${operation.status}`);
  return operation.snapshot;
}

function m6WriterOutput(request: ContentLocalizeM6WriterRequest, suffix: string): Record<string, unknown> {
  return {
    operationId: request.operationId,
    requestId: request.requestId,
    kind: request.kind,
    sourceTextHash: request.sourceTextHash,
    sourceLocale: request.sourceLocale,
    targetLocale: request.targetLocale,
    ...(request.kind === 'experience_description' ? { experienceEntryId: request.experienceEntryId } : {}),
    translatedText: `synthetic_test_candidate:${request.sourceLocale}:${request.targetLocale}:${suffix}`,
  };
}

function m6RejectedEvaluation(
  request: ContentLocalizeM6EvaluatorRequest,
  gate: M7GateKind,
): Record<string, unknown> {
  return {
    operationId: request.operationId,
    requestId: request.requestId,
    kind: request.kind,
    sourceTextHash: request.sourceTextHash,
    candidateTextHash: request.candidateTextHash,
    sourceLocale: request.sourceLocale,
    targetLocale: request.targetLocale,
    ...(request.kind === 'experience_description' ? { experienceEntryId: request.experienceEntryId } : {}),
    accepted: true,
    meaningPreserved: gate !== 'semantic',
    noFactsAdded: true,
    noFactsRemoved: true,
    factualAnchorsPreserved: true,
    targetLocaleSatisfied: true,
    professionalCvQuality: gate !== 'language_quality',
    noLeakage: true,
    reasonCodes: [gate === 'semantic'
      ? 'synthetic_semantic_rejection'
      : 'synthetic_language_quality_rejection'],
  };
}

async function runM6GateRejection(fixture: M7LocaleFixture, gate: M7GateKind) {
  const snapshot = m6SnapshotFor(fixture);
  const writers: ContentLocalizeM6WriterRequest[] = [];
  const evaluators: ContentLocalizeM6EvaluatorRequest[] = [];
  const evaluationResponses: Record<string, unknown>[] = [];
  const repairs: ContentLocalizeM6WriterRequest[] = [];
  const result = await executeContentLocalizeM6Server(snapshot, {
    writer: async (request) => {
      writers.push(request);
      return m6WriterOutput(request, 'primary');
    },
    evaluator: async (request) => {
      evaluators.push(request);
      const response = m6RejectedEvaluation(request, gate);
      evaluationResponses.push(response);
      return response;
    },
    repair: async (request) => {
      repairs.push(request);
      return m6WriterOutput(request, 'repair');
    },
  });
  return { snapshot, writers, evaluators, evaluationResponses, repairs, result };
}

function m2InputFor(fixture: M7LocaleFixture): ExperienceV3AdapterInput {
  const cv = cvFor(fixture);
  cv.personal.gender = 'female';
  const entry = cv.experience[0]!;
  cv.experience = [{
    id: entry.id,
    company: entry.company,
    position: entry.position,
    startDate: entry.startDate,
    endDate: entry.endDate,
    isPresent: entry.isPresent,
    description: '',
  }];
  return {
    enabled: true,
    operationKind: 'experience_generate',
    operationId: `${fixture.fixtureId}-m2-usage`,
    entryId: entry.id,
    entryIndexDiagnostic: 0,
    cv,
    industry: 'customer-service',
    level: 'mid',
    gender: 'female',
    requestedLocale: fixture.locale,
    uiLocale: fixture.locale,
    storedContentLocale: fixture.locale,
    exactVisibleDescription: '',
    usageCountBefore: 41,
  };
}

function m2EvaluatorResponse(
  manifest: Parameters<typeof executeExperienceV3GenerateServer>[0] extends never ? never : {
    operationId: string; entryId: string; snapshotHash: string; locale: string;
  },
  gate: M7GateKind | null,
) {
  const phase = (category: M7GateKind) => gate === category
    ? {
      status: 'failed' as const,
      violations: [{
        code: category === 'semantic' ? 'synthetic_semantic_rejection' : 'synthetic_language_quality_rejection',
        category,
        detail: 'Synthetic test-only independent evaluator rejection.',
        entryIds: [manifest.entryId],
      }],
    }
    : { status: 'passed' as const, violations: [] };
  return {
    stopReason: 'tool_use',
    content: [{
      type: 'tool_use' as const,
      name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
      input: {
        operationId: manifest.operationId,
        entryId: manifest.entryId,
        snapshotHash: manifest.snapshotHash,
        locale: manifest.locale,
        phases: {
          semantic: phase('semantic'),
          language_quality: phase('language_quality'),
        },
      },
    }],
  };
}

async function runM2UsageTransaction(fixture: M7LocaleFixture, gate: M7GateKind | null) {
  const input = m2InputFor(fixture);
  let cv = input.cv;
  let persistedCv = input.cv;
  let usage = input.usageCountBefore;
  let writeCount = 0;
  let persistCount = 0;
  let usageCallCount = 0;
  let serverWriterCalls = 0;
  let serverEvaluatorCalls = 0;
  const nativeSyntheticBullets = fixture.experienceDescription.split('\n');
  const result = await runExperienceV3GenerateAdapter(input, {
    request: async ({ manifest }) => executeExperienceV3GenerateServer({ manifest }, {
      generate: async () => {
        serverWriterCalls += 1;
        return JSON.stringify({
          operationId: manifest.operationId,
          entryId: manifest.entryId,
          snapshotHash: manifest.snapshotHash,
          locale: manifest.locale,
          bullets: nativeSyntheticBullets,
        });
      },
      evaluate: async () => {
        serverEvaluatorCalls += 1;
        return m2EvaluatorResponse(manifest, gate);
      },
    }),
    getLiveState: () => ({
      cv,
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
      storedContentLocale: input.storedContentLocale,
      exactVisibleDescription: input.exactVisibleDescription,
      industry: input.industry,
      level: input.level,
    }),
    writeCv: (next) => {
      writeCount += 1;
      cv = next;
    },
    persistCv: (next) => {
      persistCount += 1;
      persistedCv = next;
      return true;
    },
    incrementUsage: () => {
      usageCallCount += 1;
      usage += 1;
    },
    getUsageCount: () => usage,
  });
  return {
    input, result, cv, persistedCv, usage, writeCount, persistCount, usageCallCount,
    serverWriterCalls, serverEvaluatorCalls,
  };
}

function cvFor(fixture: M7LocaleFixture): CVData {
  const cv = createEmptyCv(fixture.locale);
  cv.id = fixture.fixtureId;
  cv.personal.fullName = 'M7 Fixture';
  cv.personal.jobTitle = fixture.role;
  cv.summary = fixture.summary;
  cv.summaryOrigin = 'user';
  cv.summarySourceLocale = fixture.locale;
  cv.summarySourceLocaleTextHash = hashSummarySourceLocaleText(fixture.summary);
  cv.experience = [{
    id: `${fixture.fixtureId}-current`,
    company: fixture.employer,
    position: fixture.role,
    startDate: '2022-01',
    endDate: '',
    isPresent: true,
    description: fixture.experienceDescription,
    originalUserDescription: fixture.experienceDescription,
    canonicalDescription: fixture.experienceDescription,
    descriptionOrigin: 'user',
    descriptionSourceLocale: fixture.locale,
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(fixture.experienceDescription),
  }];
  return cv;
}

function nextLocale(locale: Locale): Locale {
  const index = CONTENT_LOCALIZE_M6_TARGET_LOCALES.indexOf(locale);
  return CONTENT_LOCALIZE_M6_TARGET_LOCALES[(index + 1) % CONTENT_LOCALIZE_M6_TARGET_LOCALES.length]!;
}

function requestReady<T extends ReturnType<typeof createContentLocalizeM6Operation>>(result: T) {
  expect(result.status).toBe('request_ready');
  if (result.status !== 'request_ready') throw new Error(`expected request_ready, got ${result.status}`);
  return result.snapshot;
}

describe('M7 authoritative 12-locale fixture matrix', () => {
  it('publishes exactly the twelve canonical locales without replacing pt-BR with an alias', () => {
    const expected = ['sr', 'en', 'hi', 'ar', 'ja', 'de', 'fr', 'es', 'it', 'hr', 'pt-BR', 'ru'];
    expect(CONTENT_LOCALIZE_M6_TARGET_LOCALES).toEqual(expected);
    expect(SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES).toHaveLength(12);
    expect(new Set(SUMMARY_V3_STYLE_M5_SUPPORTED_LOCALES)).toEqual(new Set(expected));
    expect(canonicalSummaryV3StyleLocale('pt-BR')).toBe('pt-BR');
    expect(canonicalSummaryV3StyleLocale('pt-PT')).toBeNull();
    expect(M7_LOCALE_FIXTURES.map((fixture) => fixture.locale)).toEqual(expected);
  });

  it.each(M7_LOCALE_FIXTURES)('$fixtureId: routes M2, M3, M4, M5, M6.5 and M6.6 from exact locale-bound source state', (fixture) => {
    const cv = cvFor(fixture);
    const entry = cv.experience[0]!;
    const emptySummaryCv = { ...cv, summary: '', summarySourceLocale: undefined, summarySourceLocaleTextHash: undefined };

    expect(fixture.sourceEvidenceType).toBe('synthetic_native_test_fixture');
    expect(fixture.exactCandidateOutputSurface).toBe('synthetic_test_candidate');
    expect(fixture.transactionCandidateProvenance).toBe('synthetic_target_surface_for_transaction_test');
    expect(fixture.expectedTerminalResult).toBe('owned_or_request_ready');
    expect(fixture.expectedUsageDelta).toBe('success_plus_one_reject_zero');
    expect(fixture.expectedSourceCanonicalPreservation).toBe('preserved');
    expect(fixture.expectedLocaleBinding).toBe('exact_source_and_target');
    expect(fixture.expectedSemanticViolations).toBe('semantic_and_language_rejection_enforced');

    expect(classifyExperienceV3Routing({
      enabled: true, operationKind: 'experience_generate', requestedLocale: fixture.locale,
      uiLocale: fixture.locale, storedContentLocale: fixture.locale, exactVisibleDescription: '',
    })).toBe('owned');
    expect(classifyExperienceV3EnhanceRouting({
      enabled: true, operationKind: 'experience_enhance', entryId: entry.id, cv,
      requestedLocale: fixture.locale, uiLocale: fixture.locale, storedContentLocale: fixture.locale,
      exactVisibleDescription: fixture.experienceDescription, jobContextHash: `${fixture.fixtureId}-context`,
    })).toBe('owned');
    expect(classifySummaryV3GenerateRouting({
      enabled: true, operationKind: 'summary_generate', cv: emptySummaryCv,
      requestedLocale: fixture.locale, uiLocale: fixture.locale, storedContentLocale: fixture.locale,
      exactVisibleSummary: '', referenceDateIso: '2026-09-01', jobContextHash: `${fixture.fixtureId}-context`,
    })).toBe('owned');
    for (const style of SUMMARY_V3_STYLE_M5_STYLES) {
      expect(decideSummaryV3StyleOwnership({
        enabled: true, operation: `summary_${style}`, style,
        requestedLocale: fixture.locale, sourceLocale: fixture.locale,
      })).toEqual({ kind: 'owned', style, requestedLocale: fixture.locale });
    }

    const targetLocale = nextLocale(fixture.locale);
    const before = structuredClone(cv);
    const summarySnapshot = requestReady(createContentLocalizeM6Operation({
      operationId: `${fixture.fixtureId}-summary`, requestId: `${fixture.fixtureId}-summary`,
      kind: 'summary', targetLocale, confirmed: true, cv,
    }));
    const experienceSnapshot = requestReady(createContentLocalizeM6Operation({
      operationId: `${fixture.fixtureId}-experience`, requestId: `${fixture.fixtureId}-experience`,
      kind: 'experience_description', experienceEntryId: entry.id, targetLocale, confirmed: true, cv,
    }));
    expect(summarySnapshot).toMatchObject({
      kind: 'summary', sourceLocale: fixture.locale, targetLocale, sourceText: fixture.summary,
      sourceTextHash: hashSummarySourceLocaleText(fixture.summary),
    });
    expect(experienceSnapshot).toMatchObject({
      kind: 'experience_description', experienceEntryId: entry.id, sourceLocale: fixture.locale, targetLocale,
      sourceText: fixture.experienceDescription,
      sourceTextHash: hashExperienceSourceLocaleText(fixture.experienceDescription),
    });
    expect(cv).toEqual(before);
    expect(cv.experience[0]?.originalUserDescription).toBe(fixture.experienceDescription);
    expect(cv.experience[0]?.canonicalDescription).toBe(fixture.experienceDescription);
  });

  it('routes all 132 directed non-self translation pairs with immutable exact source bindings', () => {
    let routedPairs = 0;
    for (const fixture of M7_LOCALE_FIXTURES) {
      for (const targetLocale of CONTENT_LOCALIZE_M6_TARGET_LOCALES) {
        if (targetLocale === fixture.locale) continue;
        const cv = cvFor(fixture);
        const entry = cv.experience[0]!;
        const before = structuredClone(cv);
        const summary = requestReady(createContentLocalizeM6Operation({
          operationId: `${fixture.fixtureId}-s-${targetLocale}`, requestId: `r-s-${targetLocale}`,
          kind: 'summary', targetLocale, confirmed: true, cv,
        }));
        const experience = requestReady(createContentLocalizeM6Operation({
          operationId: `${fixture.fixtureId}-e-${targetLocale}`, requestId: `r-e-${targetLocale}`,
          kind: 'experience_description', experienceEntryId: entry.id, targetLocale, confirmed: true, cv,
        }));
        expect(summary.sourceLocale).toBe(fixture.locale);
        expect(summary.targetLocale).toBe(targetLocale);
        expect(summary.sourceText).toBe(fixture.summary);
        expect(experience.sourceLocale).toBe(fixture.locale);
        expect(experience.targetLocale).toBe(targetLocale);
        expect(experience.sourceText).toBe(fixture.experienceDescription);
        expect(cv).toEqual(before);
        routedPairs += 1;
      }
    }
    expect(routedPairs).toBe(132);
  });

  it.each(M7_LOCALE_FIXTURES)('$fixtureId: fails closed for both same-locale translation targets', (fixture) => {
    const cv = cvFor(fixture);
    const entry = cv.experience[0]!;
    expect(createContentLocalizeM6Operation({
      operationId: `${fixture.fixtureId}-same-summary`, requestId: 'same-summary',
      kind: 'summary', targetLocale: fixture.locale, confirmed: true, cv,
    })).toEqual({ status: 'handled_failure', reason: 'target_matches_source' });
    expect(createContentLocalizeM6Operation({
      operationId: `${fixture.fixtureId}-same-experience`, requestId: 'same-experience',
      kind: 'experience_description', experienceEntryId: entry.id, targetLocale: fixture.locale, confirmed: true, cv,
    })).toEqual({ status: 'handled_failure', reason: 'target_matches_source' });
  });

  it.each(M7_LOCALE_FIXTURES)('$fixtureId: rejects wrong locale bindings before an operation becomes owned', (fixture) => {
    const wrongLocale = nextLocale(fixture.locale);
    const cv = cvFor(fixture);
    const entry = cv.experience[0]!;
    expect(classifyExperienceV3Routing({
      enabled: true, operationKind: 'experience_generate', requestedLocale: fixture.locale,
      uiLocale: wrongLocale, storedContentLocale: fixture.locale, exactVisibleDescription: '',
    })).toBe('not_applicable');
    expect(classifyExperienceV3EnhanceRouting({
      enabled: true, operationKind: 'experience_enhance', entryId: entry.id, cv,
      requestedLocale: fixture.locale, uiLocale: wrongLocale, storedContentLocale: fixture.locale,
      exactVisibleDescription: fixture.experienceDescription, jobContextHash: 'wrong-locale',
    })).toBe('not_applicable');
    expect(decideSummaryV3StyleOwnership({
      enabled: true, operation: 'summary_shorter', style: 'shorter',
      requestedLocale: fixture.locale, sourceLocale: wrongLocale,
    })).toEqual({ kind: 'not_applicable', reason: 'cross_locale' });
  });

  it('classifies every authored M7 surface as synthetic while recording software-gate coverage as PASS', () => {
    for (const fixture of M7_LOCALE_FIXTURES) {
      expect(fixture.sourceEvidenceType).toBe('synthetic_native_test_fixture');
      expect(fixture.exactCandidateOutputSurface).toBe('synthetic_test_candidate');
      expect(fixture.transactionCandidateProvenance).toBe('synthetic_target_surface_for_transaction_test');
      expect(fixture.semanticEvidence).toBe('PASS');
      expect(fixture.languageQualityEvidence).toBe('PASS');
      expect(fixture.usageEvidence).toBe('PASS');
    }
  });

  it.each(M7_LOCALE_FIXTURES)('$fixtureId: semantic evaluator rejection is locale-bound and fails closed without an M6 side effect', async (fixture) => {
    const proof = await runM6GateRejection(fixture, 'semantic');

    expect(proof.snapshot.sourceLocale).toBe(fixture.locale);
    expect(proof.snapshot.targetLocale).toBe(nextLocale(fixture.locale));
    expect(proof.snapshot.sourceText).toBe(fixture.summary);
    expect(proof.snapshot.sourceTextHash).toBe(hashSummarySourceLocaleText(fixture.summary));
    expect(proof.writers).toHaveLength(1);
    expect(proof.repairs).toHaveLength(1);
    expect(proof.evaluators).toHaveLength(2);
    expect(proof.evaluationResponses).toHaveLength(2);
    for (const evaluation of proof.evaluationResponses) {
      expect(evaluation.accepted).toBe(true);
      expect([
        'meaningPreserved',
        'noFactsAdded',
        'noFactsRemoved',
        'factualAnchorsPreserved',
        'targetLocaleSatisfied',
        'professionalCvQuality',
        'noLeakage',
      ].filter((criterion) => evaluation[criterion] !== true)).toEqual(['meaningPreserved']);
      expect(evaluation.sourceLocale).toBe(fixture.locale);
      expect(evaluation.targetLocale).toBe(nextLocale(fixture.locale));
    }
    for (const evaluation of proof.evaluators) {
      expect(evaluation.sourceLocale).toBe(fixture.locale);
      expect(evaluation.targetLocale).toBe(nextLocale(fixture.locale));
      expect(evaluation.sourceText).toBe(fixture.summary);
      expect(evaluation.criteria).toContain('meaningPreserved');
      expect(evaluation.candidateOrigin).toMatch(/primary|repair/);
    }
    expect(proof.result).toEqual({ status: 'handled_failure', reason: 'candidate_rejected' });
  });

  it.each(M7_LOCALE_FIXTURES)('$fixtureId: independent language-quality rejection controls acceptance without replacement prose', async (fixture) => {
    const proof = await runM6GateRejection(fixture, 'language_quality');

    expect(proof.evaluators).toHaveLength(2);
    expect(proof.evaluationResponses).toHaveLength(2);
    for (const evaluation of proof.evaluationResponses) {
      expect(evaluation.accepted).toBe(true);
      expect([
        'meaningPreserved',
        'noFactsAdded',
        'noFactsRemoved',
        'factualAnchorsPreserved',
        'targetLocaleSatisfied',
        'professionalCvQuality',
        'noLeakage',
      ].filter((criterion) => evaluation[criterion] !== true)).toEqual(['professionalCvQuality']);
      expect(evaluation.sourceLocale).toBe(fixture.locale);
      expect(evaluation.targetLocale).toBe(nextLocale(fixture.locale));
    }
    for (const evaluation of proof.evaluators) {
      expect(evaluation.sourceLocale).toBe(fixture.locale);
      expect(evaluation.targetLocale).toBe(nextLocale(fixture.locale));
      expect(evaluation.criteria).toContain('professionalCvQuality');
      expect(Object.keys(evaluation)).not.toContain('replacementText');
      expect(Object.keys(evaluation)).not.toContain('correctedText');
    }
    expect(proof.result).toEqual({ status: 'handled_failure', reason: 'candidate_rejected' });
  });

  it.each(M7_LOCALE_FIXTURES)('$fixtureId: durable M2 apply charges once while semantic rejection charges zero', async (fixture) => {
    const success = await runM2UsageTransaction(fixture, null);
    if (success.result.kind !== 'handled_success') {
      throw new Error(`expected handled_success, got ${success.result.kind}`);
    }
    expect(success.serverWriterCalls).toBe(1);
    expect(success.serverEvaluatorCalls).toBe(1);
    expect(success.writeCount).toBe(1);
    expect(success.persistCount).toBe(1);
    expect(success.usageCallCount).toBe(1);
    expect(success.usage).toBe(success.input.usageCountBefore + 1);
    expect(success.persistedCv.experience[0]?.description).not.toBe('');
    expect(success.result.diagnostic.usageDelta).toBe(1);
    expect(success.result.diagnostic.v2FallthroughCount).toBe(0);

    const rejected = await runM2UsageTransaction(fixture, 'semantic');
    expect(rejected.result.kind).toBe('handled_failure');
    if (rejected.result.kind === 'handled_failure') {
      expect(rejected.result.typedReason).toBe('validation_rejected');
      expect(rejected.result.diagnostic.phases.semantic).toBe('failed');
      expect(rejected.result.diagnostic.phases.language_quality).toBe('passed');
      expect(rejected.result.diagnostic.usageDelta).toBe(0);
      expect(rejected.result.diagnostic.v2FallthroughCount).toBe(0);
    }
    expect(rejected.serverWriterCalls).toBe(1);
    expect(rejected.serverEvaluatorCalls).toBe(1);
    expect(rejected.writeCount).toBe(0);
    expect(rejected.persistCount).toBe(0);
    expect(rejected.usageCallCount).toBe(0);
    expect(rejected.usage).toBe(rejected.input.usageCountBefore);
  });

  it('fails closed when the independent M6 evaluator attempts to return replacement prose', async () => {
    const fixture = M7_LOCALE_FIXTURES[0]!;
    const snapshot = m6SnapshotFor(fixture);
    const result = await executeContentLocalizeM6Server(snapshot, {
      writer: async (request) => m6WriterOutput(request, 'primary'),
      evaluator: async (request) => ({ ...m6RejectedEvaluation(request, 'language_quality'), replacementText: 'forbidden' }),
      repair: async (request) => m6WriterOutput(request, 'repair'),
    });
    expect(result).toEqual({ status: 'handled_failure', reason: 'evaluator_failed' });
  });

  it('maps and reuses the committed German, Serbian, and Japanese historical language authorities without fabricating a passing candidate', () => {
    expect(M7_HISTORICAL_AUTHORITY_MAP.map((authority) => authority.locale)).toEqual(['de', 'sr', 'ja']);
    expect(GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE.provenance).toBe('user_supplied_device_output');
    expect(GERMAN_AAB529_DEVICE_OUTPUT_FIXTURE.malformedSurfaceMarkers)
      .toEqual(['abprüfe', 'weiterdokumentierte']);
    expect(M7_HISTORICAL_AUTHORITY_MAP.find((authority) => authority.locale === 'de')?.provenance)
      .toBe('user_supplied_device_output');
    expect(M7_HISTORICAL_AUTHORITY_MAP.find((authority) => authority.locale === 'de')?.paths)
      .toContain('src/lib/ai-core-v3/__tests__/experience-enhance-m3.test.ts');
    expect(M7_HISTORICAL_AUTHORITY_MAP.find((authority) => authority.locale === 'sr')?.paths)
      .toContain('src/lib/ai-core-v3/__tests__/summary-style-m5-server.test.ts');
    expect(M7_HISTORICAL_AUTHORITY_MAP.find((authority) => authority.locale === 'ja')?.paths)
      .toContain('src/lib/ai-core-v3/__tests__/summary-generate-m4.test.ts');
  });
});
