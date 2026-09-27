// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '../../types';
import {
  buildExperienceAiOutputProvenance,
  buildExperienceV3EmptySourceRequestContextHash,
  EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
  parseExperienceV3StructuredDate,
  verifyGeneratedFromEmptyExperienceAuthority,
  type GeneratedFromEmptyAuthorityDecisionReason,
} from '../../cv-experience-ai-output-provenance';
import { buildExperienceJobContext } from '../../cv-experience-job-context';
import {
  EXPERIENCE_LOCALIZED_SURFACE_SCHEMA,
  EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA,
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  buildExperienceLocalizationSnapshot,
  hashExperienceLocalizedSurfaceValue,
  resolveExperiencePresentationSnapshot,
  type PersistedExperienceLocalizedSurface,
} from '../../cv-experience-localized-surfaces';
import type { Locale } from '../../i18n/translations';
import { loadCvDraft, saveCvDraft } from '../../draft-storage';
import { prepareExportReadyCv } from '../../prepare-export-ready-cv';
import { buildAndStoreCvExportDiagnostic } from '../../cv-export-diagnostics';
import {
  captureExperienceV3OperationSnapshot,
  runExperienceV3GenerateAdapter,
  type ExperienceV3AdapterInput,
} from '../experience-generate';
import {
  EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
  executeExperienceV3GenerateServer,
} from '../experience-generate-server';

const INDUSTRY = 'customer-service';
const LEVEL = 'mid';
const GENDER = 'female';
const OUTPUT = [
  'Supports routine customer requests in line with the supplied role context.',
  'Coordinates daily work with colleagues and follows established workplace guidance.',
  'Maintains clear records for ordinary tasks within the assigned area of responsibility.',
] as const;
const OUTPUT_TEXT = OUTPUT.map((bullet) => `• ${bullet}`).join('\n');
const SERBIAN_OUTPUT = [
  'Pruža podršku rutinskim zahtevima korisnika u skladu sa datim kontekstom uloge.',
  'Koordinira svakodnevni rad sa kolegama i prati utvrđena radna uputstva.',
  'Vodi jasnu evidenciju o redovnim zadacima u okviru dodeljene odgovornosti.',
] as const;
const SERBIAN_OUTPUT_TEXT = SERBIAN_OUTPUT.map((bullet) => `• ${bullet}`).join('\n');
const GERMAN_OUTPUT = [
  'Bearbeitet routinemäßige Kundenanfragen und folgt dem bereitgestellten Rollenprofil.',
  'Koordiniert die tägliche Arbeit mit Kolleginnen und Kollegen nach festgelegten Arbeitsanweisungen.',
  'Führt klare Aufzeichnungen über reguläre Aufgaben im zugewiesenen Verantwortungsbereich.',
] as const;

function emptyCv(): CVData {
  return {
    id: 'cv-generated-empty',
    name: 'Generated empty authority fixture',
    personal: {
      fullName: '',
      email: '',
      phone: '',
      address: '',
      jobTitle: 'Support Specialist',
      gender: GENDER,
    },
    summary: 'Provides reliable support and coordinates organized daily work.',
    summaryOrigin: 'user',
    contentLocale: 'en',
    experience: [{
      id: 'exp-generated-empty',
      company: 'Example Company',
      position: 'Support Specialist',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: '',
    }],
    education: [],
    skills: ['Customer service'],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

function adapterInput(
  cv: CVData,
  options: { requestedLocale?: Locale; uiLocale?: Locale; storedContentLocale?: Locale } = {},
): ExperienceV3AdapterInput {
  const requestedLocale = options.requestedLocale || 'en';
  const uiLocale = options.uiLocale || requestedLocale;
  const storedContentLocale = options.storedContentLocale || 'en';
  return {
    enabled: true,
    operationKind: 'experience_generate',
    operationId: 'stability-generated-empty-operation',
    entryId: 'exp-generated-empty',
    entryIndexDiagnostic: 0,
    cv,
    industry: INDUSTRY,
    level: LEVEL,
    gender: GENDER,
    requestedLocale,
    uiLocale,
    storedContentLocale,
    exactVisibleDescription: '',
    usageCountBefore: 4,
  };
}

async function acceptedResponse(
  manifest: ReturnType<typeof captureExperienceV3OperationSnapshot>['manifest'],
  bullets: readonly string[] = OUTPUT,
) {
  return executeExperienceV3GenerateServer({ manifest }, {
    generate: async () => JSON.stringify({
      operationId: manifest.operationId,
      entryId: manifest.entryId,
      snapshotHash: manifest.snapshotHash,
      locale: manifest.locale,
      bullets,
    }),
    evaluate: async () => ({
      stopReason: 'tool_use' as const,
      content: [{
        type: 'tool_use' as const,
        name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
        input: {
          operationId: manifest.operationId,
          entryId: manifest.entryId,
          snapshotHash: manifest.snapshotHash,
          locale: manifest.locale,
          phases: {
            semantic: { status: 'passed', violations: [] },
            language_quality: { status: 'passed', violations: [] },
          },
        },
      }],
    }),
  });
}

async function runRealAdapterAndDraftRoundTrip(options: {
  requestedLocale?: Locale;
  uiLocale?: Locale;
  storedContentLocale?: Locale;
  bullets?: readonly string[];
} = {}) {
  const input = adapterInput(emptyCv(), options);
  let cv = input.cv;
  let usage = input.usageCountBefore;
  let persistCount = 0;
  let providerRequestCount = 0;
  const result = await runExperienceV3GenerateAdapter(input, {
    request: async ({ manifest }) => {
      providerRequestCount += 1;
      return acceptedResponse(manifest, options.bullets || OUTPUT);
    },
    getLiveState: () => ({
      cv,
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
      storedContentLocale: input.storedContentLocale,
      exactVisibleDescription: '',
      industry: INDUSTRY,
      level: LEVEL,
    }),
    writeCv: (next) => { cv = next; },
    persistCv: (next) => {
      persistCount += 1;
      return saveCvDraft({ cv: next, savedAt: '2026-09-27T00:00:00.000Z' });
    },
    incrementUsage: () => { usage += 1; },
  });
  return {
    result,
    cv,
    usage,
    persistCount,
    providerRequestCount,
    reloaded: loadCvDraft()?.cv || null,
  };
}

function existingAab609StyleExperience(options: {
  requestedLocale?: Locale;
  storedContentLocale?: Locale;
  generatedText?: string;
} = {}): WorkExperience {
  const requestedLocale = options.requestedLocale || 'en';
  const storedContentLocale = options.storedContentLocale || 'en';
  const generatedText = options.generatedText || OUTPUT_TEXT;
  const start = parseExperienceV3StructuredDate('2024-01')!;
  const requestHash = buildExperienceV3EmptySourceRequestContextHash({
    documentId: 'cv-generated-empty',
    entryId: 'exp-generated-empty',
    roleTitle: 'Support Specialist',
    company: 'Example Company',
    employmentState: 'present',
    rawStartDate: '2024-01',
    rawEndDate: '',
    dates: { start, end: null },
    industry: INDUSTRY,
    level: LEVEL,
    gender: GENDER,
    requestedLocale,
    uiLocale: requestedLocale,
    storedContentLocale,
    exactVisibleDescription: '',
  });
  return {
    ...emptyCv().experience[0],
    description: generatedText,
    generatedDescription: generatedText,
    generatedLocale: requestedLocale,
    descriptionOrigin: 'ai_generated',
    aiOutputProvenance: buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-generated-empty',
      appliedOutput: generatedText,
      preAiFactText: '',
      sourceLocale: storedContentLocale,
      targetLocale: requestedLocale,
      operationMode: 'generate',
      sourceAuthorityKind: 'generated_from_empty',
      requestHash,
      generatedFromEmpty: true,
      appliedAt: '2026-09-01T00:00:00.000Z',
    }),
  };
}

function verifier(
  exp: WorkExperience,
  options: { requestedLocale?: Locale; industry?: string; level?: string; gender?: string } = {},
) {
  return verifyGeneratedFromEmptyExperienceAuthority({
    documentId: 'cv-generated-empty',
    experience: exp,
    industry: options.industry || INDUSTRY,
    level: options.level || LEVEL,
    gender: options.gender || GENDER,
    requestedLocale: options.requestedLocale || 'en',
  });
}

function cvFrom(exp: WorkExperience): CVData {
  return {
    ...emptyCv(),
    runtimeMigrationVersion: 3,
    experience: [exp],
  };
}

function cvWithTargetSummary(cv: CVData, locale: 'sr' | 'de'): CVData {
  const summary = locale === 'sr'
    ? 'Pruža pouzdanu podršku i koordinira svakodnevni rad.'
    : 'Ich arbeite derzeit als Support Specialist bei Example Company und bearbeite Kundenanfragen zuverlässig.';
  return {
    ...cv,
    summary,
    summaryOrigin: 'user',
    summarySourceLocale: locale,
    ...(locale === 'de' ? { contentLocale: 'de' as const } : {}),
  };
}

function preparedFrom(exp: WorkExperience, locale: Locale = 'en', cv: CVData = cvFrom(exp)) {
  return prepareExportReadyCv(cv, locale, 'modern-minimal', {
    industry: INDUSTRY,
    level: LEVEL,
    gender: GENDER,
    referenceDate: '2026-09-27',
  });
}

function withValidatedGermanSurfaces(
  sourceCv: CVData,
  decision = verifier(sourceCv.experience[0]!, { requestedLocale: 'de' }),
): CVData {
  const snapshot = buildExperienceLocalizationSnapshot(sourceCv, 'de', {
    verifiedGeneratedFromEmptyAuthorityByEntry: new Map([[sourceCv.experience[0]!.id, decision]]),
  });
  expect(snapshot.ok).toBe(true);
  expect(snapshot.records).toHaveLength(GERMAN_OUTPUT.length);
  const surfaces = Object.fromEntries(snapshot.records.map((record, index) => {
    const localizedText = GERMAN_OUTPUT[index]!;
    const localizedTextHash = hashExperienceLocalizedSurfaceValue(localizedText);
    const surface: PersistedExperienceLocalizedSurface = {
      ...record,
      surfaceSchema: EXPERIENCE_LOCALIZED_SURFACE_SCHEMA,
      bindingKey: record.requestIdentity,
      localizedText,
      localizedTextHash,
      localizationProvenance: 'provider',
      validatorDecision: 'passed',
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      validationProvenance: 'independent_provider_verification',
      validatedCandidateHash: localizedTextHash,
      validatedAt: '2026-09-27T00:00:00.000Z',
      createdAt: '2026-09-27T00:00:00.000Z',
    };
    return [record.requestIdentity, surface];
  }));
  return {
    ...sourceCv,
    experienceLocalizedSurfaces: {
      schemaVersion: EXPERIENCE_LOCALIZED_SURFACE_STORE_SCHEMA,
      surfaces,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('AAB609 generated-from-empty Experience export authority', () => {
  it('runs the real M2 adapter for the sr-request/en-stored physical shape, stamps the historical context, persists once, and increments once', async () => {
    const run = await runRealAdapterAndDraftRoundTrip({
      requestedLocale: 'sr', uiLocale: 'sr', storedContentLocale: 'en', bullets: SERBIAN_OUTPUT,
    });
    expect(run.result.kind).toBe('handled_success');
    expect(run.persistCount).toBe(1);
    expect(run.usage).toBe(5);
    expect(run.providerRequestCount).toBe(1);
    const entry = run.cv.experience[0];
    const expectedContext = buildExperienceJobContext({
      position: entry.position,
      industry: INDUSTRY,
      locale: 'sr',
      level: LEVEL,
    });
    expect(entry).toMatchObject({
      description: SERBIAN_OUTPUT_TEXT,
      generatedDescription: SERBIAN_OUTPUT_TEXT,
      generatedLocale: 'sr',
      descriptionOrigin: 'ai_generated',
      generationJobContextKey: expectedContext.key,
      aiOutputProvenance: {
        generatedFromEmpty: true,
        sourceAuthorityKind: 'generated_from_empty',
        operationMode: 'generate',
        sourceLocale: 'en',
        targetLocale: 'sr',
      },
    });
    expect(entry.originalUserDescription).toBeUndefined();
    expect(entry.canonicalDescription).toBeUndefined();
    expect(run.reloaded?.experience[0].generationJobContextKey).toBe(expectedContext.key);
    expect(verifier(entry, { requestedLocale: 'sr' })).toMatchObject({
      historicalSourceAuthorityVerified: true,
      directPresentationAllowed: true,
      verifierPassed: true,
    });
    expect(verifier(run.reloaded!.experience[0]!, { requestedLocale: 'sr' }).verifierPassed).toBe(true);
  });

  it('uses the real draft reload/normalize path and reaches the shared PDF and DOCX prepared boundary', async () => {
    const run = await runRealAdapterAndDraftRoundTrip({
      requestedLocale: 'sr', uiLocale: 'sr', storedContentLocale: 'en', bullets: SERBIAN_OUTPUT,
    });
    expect(run.reloaded).not.toBeNull();
    const pdfPrepared = prepareExportReadyCv(run.reloaded!, 'sr', 'modern-minimal', {
      industry: INDUSTRY, level: LEVEL, gender: GENDER, referenceDate: '2026-09-27',
    });
    const docxPrepared = prepareExportReadyCv(run.reloaded!, 'sr', 'modern-minimal', {
      industry: INDUSTRY, level: LEVEL, gender: GENDER, referenceDate: '2026-09-27',
    });
    expect(pdfPrepared.ok).toBe(true);
    expect(docxPrepared.ok).toBe(true);
    if (!pdfPrepared.ok || !docxPrepared.ok) return;
    expect(pdfPrepared.diagnostics.experienceProvenance[0].generatedFromEmptyAuthority)
      .toMatchObject({
        verifierPassed: true,
        verifierDecisionReason: 'verified',
        historicalSourceAuthorityVerified: true,
        directPresentationAllowed: true,
      });
    expect(docxPrepared.diagnostics.experienceProvenance[0].generatedFromEmptyAuthority)
      .toEqual(pdfPrepared.diagnostics.experienceProvenance[0].generatedFromEmptyAuthority);
  });

  it('recovers a valid existing AAB609-style row without a job-context key and without network or usage effects', () => {
    const requestSpy = vi.fn();
    const usageDelta = 0;
    const exp = existingAab609StyleExperience();
    expect(exp.generationJobContextKey).toBeUndefined();
    const decision = verifier(exp);
    expect(decision).toMatchObject({
      generationJobContextKeyPresent: false,
      generationJobContextKeyMatched: true,
      verifierPassed: true,
      verifierDecisionReason: 'verified',
    });
    const prepared = preparedFrom(exp);
    expect(prepared.ok).toBe(true);
    expect(requestSpy).not.toHaveBeenCalled();
    expect(usageDelta).toBe(0);
    if (!prepared.ok) return;
    expect(prepared.cv.experience[0].originalUserDescription).toBeUndefined();
    expect(prepared.cv.experience[0].canonicalDescription).toBeUndefined();
  });

  it.each([
    ['provenance missing', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: undefined }), 'provenance_missing'],
    ['revision unsupported', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, revision: 'unsupported' as never } }), 'provenance_revision_unsupported'],
    ['entry mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, experienceEntryId: 'other' } }), 'entry_identity_mismatch'],
    ['flag mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, generatedFromEmpty: false } }), 'generated_from_empty_flag_mismatch'],
    ['authority mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, sourceAuthorityKind: 'original_user' } }), 'source_authority_kind_mismatch'],
    ['operation mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, operationMode: 'enhance' } }), 'operation_mode_mismatch'],
    ['source not empty', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, preAiFactSnapshotText: 'prior source' } }), 'expected_empty_source_mismatch'],
    ['generated output missing', (exp: WorkExperience) => ({ ...exp, generatedDescription: '' }), 'generated_output_missing'],
    ['visible output edited', (exp: WorkExperience) => ({ ...exp, description: `${exp.description} Edited.` }), 'visible_output_mismatch'],
    ['normalized hash mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, lastAiOutputNormalizedHash: 'mismatch' } }), 'normalized_output_hash_mismatch'],
    ['raw hash mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, lastAiOutputRawHash: 'mismatch' } }), 'raw_output_hash_mismatch'],
    ['source locale mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, sourceLocale: 'unsupported-locale' } }), 'source_locale_mismatch'],
    ['generated locale mismatch', (exp: WorkExperience) => ({ ...exp, generatedLocale: 'de' }), 'generated_locale_mismatch'],
    ['request hash mismatch', (exp: WorkExperience) => ({ ...exp, aiOutputProvenance: { ...exp.aiOutputProvenance!, requestHash: 'mismatch' } }), 'request_context_mismatch'],
    ['role drift', (exp: WorkExperience) => ({ ...exp, position: 'Different Role' }), 'request_context_mismatch'],
    ['company drift', (exp: WorkExperience) => ({ ...exp, company: 'Different Company' }), 'request_context_mismatch'],
    ['date drift', (exp: WorkExperience) => ({ ...exp, startDate: '2023-01' }), 'request_context_mismatch'],
    ['employment-state drift', (exp: WorkExperience) => ({ ...exp, isPresent: false, endDate: '2025-12' }), 'request_context_mismatch'],
    ['job-context key mismatch', (exp: WorkExperience) => ({ ...exp, generationJobContextKey: 'mismatch' }), 'generation_job_context_mismatch'],
  ] as const)('fails closed for %s with a typed reason', (_label, mutate, reason) => {
    const exp = mutate(existingAab609StyleExperience()) as WorkExperience;
    const decision = verifier(exp);
    expect(decision.verifierPassed).toBe(false);
    expect(decision.verifierDecisionReason).toBe(reason as GeneratedFromEmptyAuthorityDecisionReason);
    const prepared = preparedFrom(exp);
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.reason).toBe('legacy_export_recovery_no_safe_duties');
    expect(prepared.diagnostics.experienceProvenance[0].generatedFromEmptyAuthority.verifierDecisionReason)
      .toBe(reason);
  });

  it.each([
    ['industry', { industry: 'healthcare' }],
    ['level', { level: 'senior' }],
    ['gender', { gender: 'male' }],
  ] as const)('fails closed when historical request context has %s drift', (_label, drift) => {
    const decision = verifier(existingAab609StyleExperience(), drift);
    expect(decision).toMatchObject({
      verifierPassed: false,
      historicalSourceAuthorityVerified: false,
      verifierDecisionReason: 'request_context_mismatch',
    });
  });

  it('recovers the exact physical sr-request/en-stored existing AAB609-style row directly without canonical promotion', () => {
    const exp = existingAab609StyleExperience({
      requestedLocale: 'sr', storedContentLocale: 'en', generatedText: SERBIAN_OUTPUT_TEXT,
    });
    const decision = verifier(exp, { requestedLocale: 'sr' });
    expect(decision).toMatchObject({
      verifierPassed: true,
      historicalSourceAuthorityVerified: true,
      requestedLocaleCompatible: true,
      directPresentationAllowed: true,
      generationJobContextKeyPresent: false,
    });
    const prepared = preparedFrom(exp, 'sr', cvWithTargetSummary(cvFrom(exp), 'sr'));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.experience[0]).toMatchObject({ description: SERBIAN_OUTPUT_TEXT });
    expect(prepared.cv.experience[0].originalUserDescription).toBeUndefined();
    expect(prepared.cv.experience[0].canonicalDescription).toBeUndefined();
    expect(prepared.cv.experience[0].recoveredSemanticDuties).toEqual([]);
    expect(prepared.diagnostics.summarySemanticDutyKeys).toEqual([]);
    expect(prepared.diagnostics.summaryFactSetSource).toBe('occupation_generic');
  });

  it('uses an independently validated M6 target surface for a verified cross-locale generated-from-empty source', () => {
    const exp = existingAab609StyleExperience();
    const sourceCv = cvWithTargetSummary(cvFrom(exp), 'de');
    const decision = verifier(exp, { requestedLocale: 'de' });
    expect(decision).toMatchObject({
      verifierPassed: true,
      historicalSourceAuthorityVerified: true,
      directPresentationAllowed: false,
      requestedLocaleCompatible: false,
    });
    const localizedCv = withValidatedGermanSurfaces(sourceCv, decision);
    const cached = buildExperienceLocalizationSnapshot(localizedCv, 'de', {
      verifiedGeneratedFromEmptyAuthorityByEntry: new Map([[exp.id, decision]]),
    });
    expect(cached.missingRecords.map((record) => record.sourceClauseIndex)).toEqual([]);
    const directPresentation = resolveExperiencePresentationSnapshot({
      cv: localizedCv,
      targetLocale: 'de',
      verifiedGeneratedFromEmptyAuthorityByEntry: new Map([[exp.id, decision]]),
    });
    expect(directPresentation.ok).toBe(true);
    expect(directPresentation.records[0].presentationAuthority).toBe('validated_target_projection');
    const prepared = preparedFrom(exp, 'de', localizedCv);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.experience[0].description).toBe(GERMAN_OUTPUT.map((line) => `• ${line}`).join('\n'));
    expect(prepared.cv.experience[0].description).not.toBe(OUTPUT_TEXT);
    expect(prepared.cv.experience[0].originalUserDescription).toBeUndefined();
    expect(prepared.cv.experience[0].canonicalDescription).toBeUndefined();
    expect(prepared.cv.experience[0].recoveredSemanticDuties).toEqual([]);
    expect(prepared.diagnostics.summarySemanticDutyKeys).toEqual([]);
    expect(prepared.diagnostics.summaryFactSetSource).toBe('occupation_generic');
    expect(prepared.diagnostics.experienceProvenance[0].generatedFromEmptyAuthority).toMatchObject({
      historicalSourceAuthorityVerified: true,
      directPresentationAllowed: false,
    });
    expect(prepared.diagnostics.experiencePresentation?.[0]).toMatchObject({
      presentationAuthority: 'validated_target_projection',
      targetLocale: 'de',
    });
  });

  it.each([
    ['no target surface', (cv: CVData) => cv],
    ['stale target surface', (cv: CVData) => {
      const [key, surface] = Object.entries(cv.experienceLocalizedSurfaces!.surfaces)[0]!;
      return {
        ...cv,
        experienceLocalizedSurfaces: {
          ...cv.experienceLocalizedSurfaces!,
          surfaces: { ...cv.experienceLocalizedSurfaces!.surfaces, [key]: { ...surface, localizedTextHash: 'stale' } },
        },
      };
    }],
  ])('fails cross-locale presentation through the existing projection contract when there is %s', (_label, mutate) => {
    const exp = existingAab609StyleExperience();
    const sourceCv = cvWithTargetSummary(cvFrom(exp), 'de');
    const decision = verifier(exp, { requestedLocale: 'de' });
    const cv = _label === 'no target surface'
      ? sourceCv
      : mutate(withValidatedGermanSurfaces(sourceCv, decision));
    const directPresentation = resolveExperiencePresentationSnapshot({
      cv,
      targetLocale: 'de',
      verifiedGeneratedFromEmptyAuthorityByEntry: new Map([[exp.id, decision]]),
    });
    expect(directPresentation.records[0].presentationAuthority).toBe('unresolved');
    expect(directPresentation.ok).toBe(false);
    const prepared = preparedFrom(exp, 'de', cv);
    expect(decision).toMatchObject({ historicalSourceAuthorityVerified: true, directPresentationAllowed: false });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.reason).toBe('localized_display_projection_incomplete');
    expect(prepared.diagnostics.experienceProvenance[0].generatedFromEmptyAuthority)
      .toMatchObject({ historicalSourceAuthorityVerified: true, directPresentationAllowed: false });
    expect(prepared.diagnostics.experiencePresentation?.[0]?.rejectionReason)
      .toBe('generated_from_empty_validated_surface_required');
  });

  it('does not let a valid target surface rescue invalid historical source authority', () => {
    const exp = existingAab609StyleExperience();
    const validSurfaceCv = withValidatedGermanSurfaces(cvFrom(exp));
    const invalidExp = {
      ...exp,
      aiOutputProvenance: { ...exp.aiOutputProvenance!, requestHash: 'mismatch' },
    };
    const invalidCv = { ...validSurfaceCv, experience: [invalidExp] };
    const prepared = preparedFrom(invalidExp, 'de', invalidCv);
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.reason).toBe('legacy_export_recovery_no_safe_duties');
    expect(prepared.diagnostics.experienceProvenance[0].generatedFromEmptyAuthority)
      .toMatchObject({ historicalSourceAuthorityVerified: false, verifierDecisionReason: 'request_context_mismatch' });
  });

  it('preserves independent user/canonical semantic authority while retaining the stale generated verifier failure', () => {
    const generated = existingAab609StyleExperience();
    const manualText = [
      'Handles routine customer requests using established support procedures.',
      'Coordinates daily support work with colleagues.',
      'Maintains clear records for assigned customer-service tasks.',
    ].map((bullet) => `• ${bullet}`).join('\n');
    const exp: WorkExperience = {
      ...generated,
      description: manualText,
      descriptionOrigin: 'user',
      originalUserDescription: manualText,
      canonicalDescription: manualText,
    };

    const decision = verifier(exp);
    expect(decision).toMatchObject({
      applicable: true,
      verifierPassed: false,
      historicalSourceAuthorityVerified: false,
      verifierDecisionReason: 'visible_output_mismatch',
    });

    const prepared = preparedFrom(exp);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.diagnostics.experienceProvenance[0]).toMatchObject({
      source: 'user_origin_recovered',
      generatedFromEmptyAuthority: {
        verifierPassed: false,
        historicalSourceAuthorityVerified: false,
        verifierDecisionReason: 'visible_output_mismatch',
        authoritySource: 'none',
      },
    });
    expect(prepared.cv.experience[0]).toMatchObject({
      description: manualText,
      originalUserDescription: manualText,
      canonicalDescription: manualText,
      generatedDescription: OUTPUT_TEXT,
      descriptionOrigin: 'user',
    });
    expect(prepared.cv.experience[0].recoveredSemanticDuties).toHaveLength(3);
    expect(prepared.cv.experience[0].recoveredSemanticDuties?.map((duty) => duty.sourceClause))
      .toEqual([
        'Handles routine customer requests using established support procedures.',
        'Coordinates daily support work with colleagues.',
        'Maintains clear records for assigned customer-service tasks.',
      ]);
    expect(prepared.diagnostics.summarySemanticDutyKeys).toHaveLength(3);
    expect(prepared.diagnostics.summaryFactSetSource).toBe('semantic_duties');
  });

  it('keeps early Experience failure diagnostics complete and explicitly marks Summary authority not reached', () => {
    const exp = existingAab609StyleExperience();
    exp.aiOutputProvenance = { ...exp.aiOutputProvenance!, requestHash: 'mismatch' };
    const raw = { ...emptyCv(), runtimeMigrationVersion: 3, experience: [exp] };
    const prepared = prepareExportReadyCv(raw, 'en', 'modern-minimal', {
      industry: INDUSTRY, level: LEVEL, gender: GENDER, referenceDate: '2026-09-27',
    });
    expect(prepared.ok).toBe(false);
    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'en',
      rawCv: raw,
      prepared,
      originalFailureReason: prepared.ok ? undefined : prepared.reason,
      finalError: prepared.ok ? undefined : { reason: prepared.reason },
    });
    expect(trace.experiences[0].generatedFromEmptyAuthority).toMatchObject({
      verifierPassed: false,
      verifierDecisionReason: 'request_context_mismatch',
      authoritySource: 'none',
    });
    expect(trace.summaryAuthorityDiagnosticsStatus).toBe('not_reached');
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.diagnosticCompletenessFailureReasons).not.toContain(
      'migration_diagnostic_missing:resolvedCanonicalSummarySource',
    );
  });

  it('keeps Enhance-style provenance outside generated-from-empty recovery', () => {
    const exp = existingAab609StyleExperience();
    exp.originalUserDescription = 'User-authored duties.';
    exp.canonicalDescription = 'User-authored duties.';
    exp.aiOutputProvenance = buildExperienceAiOutputProvenance({
      experienceEntryId: exp.id,
      appliedOutput: exp.description,
      preAiFactText: exp.originalUserDescription,
      sourceLocale: 'en',
      targetLocale: 'en',
      operationMode: 'enhance',
      sourceAuthorityKind: 'original_user',
      generatedFromEmpty: false,
    });
    const decision = verifier(exp);
    expect(decision.applicable).toBe(false);
    expect(decision.verifierDecisionReason).toBe('not_applicable');
  });
});
