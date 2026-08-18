/** @vitest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { buildFactSetFromExperienceDescription, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import { buildAndStoreCvExportDiagnostic } from '@/lib/cv-export-diagnostics';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { buildCvExportRenderProjection } from '@/lib/cv-export-structured-text';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import { detectExperienceUnsupportedClaimExpansion } from '@/lib/cv-experience-unsupported-claims';
import { validateCrossLocaleSemanticCoverage } from '@/lib/cv-cross-locale-experience';
import { validateLocalizedExperienceBullets } from '@/lib/cv-semantic-fidelity';
import { validateSerbianWarehouseExperienceCoverage } from '@/lib/cv-serbian-experience-grounding';
import {
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  applyTerminalExperiencePresentationSnapshot,
  buildExperienceLocalizationSnapshot,
  canUseLegacyExperienceDisplayProjection,
  hashExperienceLocalizedSurfaceValue,
  prepareExperienceLocalizedSurfaces,
  resolveExperiencePresentationSnapshot,
  type ExperienceLocalizationIndependentVerificationRecord,
  type ExperienceLocalizationProviderRecord,
  type ExperienceLocalizationRequest,
} from '@/lib/cv-experience-localized-surfaces';

const anthropicCreateMock = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: anthropicCreateMock };
  },
}));

const HINDI_FACTS = [
  'मुद्रित और डिजिटल सामग्री के लिए ग्राफिक सामग्री तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम परिणामों की गुणवत्ता की जाँच करती थी।',
].join('\n');

const SERBIAN_FACTS = [
  'Izrađivala sam grafičke materijale za štampane i digitalne medije.',
  'Razvijala sam vizuelne dizajnerske koncepte prema potrebama klijenata.',
  'Pregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.',
].join('\n');

const SERBIAN_BULLETS = SERBIAN_FACTS.split('\n').map((line) => `• ${line}`).join('\n');

const SERBIAN_CURRENT_DESIGN_FACTS = [
  'Izrađujem grafičke materijale za štampane i digitalne medije.',
  'Razvijam vizuelne dizajnerske koncepte prema potrebama klijenata.',
  'Pregledam dizajnerske projekte i proveravam kvalitet završnih rezultata.',
].join('\n');

const SERBIAN_ATLAS_CURRENT = [
  'Proverava pristiglu robu.',
  'Proverava prateću dokumentaciju.',
  'Sarađuje sa kolegama na pripremi i premeštanju robe.',
].join('\n');

const CROATIAN_ATLAS_CURRENT = [
  'Provjerava pristiglu robu.',
  'Provjerava prateću dokumentaciju.',
  'Surađuje s kolegama na pripremi i premještanju robe.',
].join('\n');

const CROATIAN_DISPLAY = [
  'Izrađivala sam grafičke materijale za tiskane i digitalne medije.',
  'Razvijala sam koncepte vizualnog dizajna prema potrebama klijenata.',
  'Pregledavala sam dizajnerske projekte i provjeravala kvalitetu završnih rezultata.',
].join('\n');

const ARABIC_DESIGN_FACTS = [
  'أعددت موادًا رسومية للوسائط المطبوعة والرقمية.',
  'طورت مفاهيم التصميم المرئي وفقًا لاحتياجات العملاء.',
  'راجعت مشاريع التصميم وتحققت من جودة المخرجات النهائية.',
].join('\n');

const ARABIC_WAREHOUSE_FACTS = [
  'تحققت من البضائع الواردة.',
  'تحققت من المستندات المرتبطة بالبضائع الواردة.',
  'نسقت مع الزملاء إعداد البضائع ونقلها.',
].join('\n');

const SERBIAN_WAREHOUSE_FACTS = [
  'Proveravala je pristiglu robu.',
  'Proveravala je dokumentaciju povezanu sa primljenom robom.',
  'Koordinirala je sa kolegama pripremu i premeštanje robe.',
];

function experience(options: {
  id: string;
  immutableFacts: string;
  current: string;
  generatedLocale: Locale;
  isPresent?: boolean;
  position?: string;
}): WorkExperience {
  return {
    id: options.id,
    position: options.position || 'Grafička dizajnerica',
    company: options.id,
    startDate: options.isPresent ? '2024-01' : '2021-01',
    endDate: options.isPresent ? '' : '2023-12',
    isPresent: Boolean(options.isPresent),
    description: options.current,
    originalUserDescription: options.immutableFacts,
    canonicalDescription: options.immutableFacts,
    descriptionOrigin: 'deterministic_fallback',
    generatedDescription: options.current,
    generatedLocale: options.generatedLocale,
    descriptionSourceLocale: options.generatedLocale,
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(options.current),
  };
}

function cvFor(entries: WorkExperience[], sourceLocales: Locale[]): CVData {
  return {
    id: 'aab475-presentation-resolution',
    name: 'AAB475',
    personal: {
      fullName: 'Test Person', email: 'test@example.test', phone: '', address: '',
      jobTitle: 'Grafička dizajnerica', gender: 'female', photoEnabled: false,
    },
    summary: 'Sažetak.',
    contentLocale: 'sr',
    summaryOrigin: 'deterministic_fallback',
    summaryGeneratedLocale: 'sr',
    experience: entries,
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z',
    canonicalSnapshot: {
      canonicalSummary: '',
      canonicalLocale: 'sr',
      canonicalRevision: 1,
      canonicalSourceHash: 'aab475-canonical-source',
      canonicalCreatedFrom: 'user_structured_input',
      canonicalState: 'valid',
      canonicalExperiences: entries.map((entry, entryIndex) => ({
        experienceId: entry.id,
        role: entry.position,
        company: entry.company,
        current: entry.isPresent,
        sourceLocale: sourceLocales[entryIndex],
        sourceLocaleTextHash: hashExperienceSourceLocaleText(entry.originalUserDescription || ''),
        bullets: (entry.originalUserDescription || '').split('\n').map((sourceText, order) => ({
          factId: `aab475-${entry.id}-fact-${order}`,
          sourceText,
          semanticCategory: 'generic',
          order,
        })),
      })),
    },
  };
}

function semanticValidation() {
  return {
    validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
    predicatePreserved: true,
    objectPreserved: true,
    workDomainPreserved: true,
    scopePreserved: true,
    negationPreserved: true,
    tensePreserved: true,
    unsupportedFactsIntroduced: false,
  } as const;
}

function validSerbianResponse(request: ExperienceLocalizationRequest) {
  return validSerbianResponseFor(request, { 'hindi-entry': SERBIAN_FACTS.split('\n') });
}

function validSerbianResponseFor(
  request: ExperienceLocalizationRequest,
  surfacesByEntry: Record<string, string[]>,
) {
  const records: ExperienceLocalizationProviderRecord[] = request.records.map((record) => ({
    ...record,
    localizedText: surfacesByEntry[record.experienceId]?.[record.sourceClauseIndex] || '',
    semanticValidation: semanticValidation(),
  }));
  const verification: ExperienceLocalizationIndependentVerificationRecord[] = records.map((record) => ({
    ...record,
    candidateSurfaceHash: hashExperienceLocalizedSurfaceValue(record.localizedText),
    decision: 'passed',
    mismatchCategory: 'none',
    predicatePreserved: true,
    objectPreserved: true,
    workDomainPreserved: true,
    sourceResponsibilityPreserved: true,
    scopePreserved: true,
    negationPreserved: true,
    tensePreserved: true,
    unsupportedFactsIntroduced: false,
    crossEntryFactIntroduced: false,
    crossOccupationSubstitution: false,
  }));
  return {
    snapshotId: request.snapshotId,
    targetLocale: request.targetLocale,
    records,
    provenance: 'provider' as const,
    independentVerification: {
      snapshotId: request.snapshotId,
      targetLocale: request.targetLocale,
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      verifierAttemptCount: 1,
      records: verification,
    },
  };
}

function mockDownload(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://aab475/${blobs.length}`;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return blobs;
}

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const fileName = String(input).split('/').pop() || '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) return new Response(fs.readFileSync(fontPath), { status: 200 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  anthropicCreateMock.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

function anthropicJson(payload: Record<string, unknown>) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

async function importLocalizationRoute() {
  vi.stubEnv('ANTHROPIC_API_KEY', 'aab475-test-key');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('PRO_SIGNING_KEY', '');
  vi.resetModules();
  return import('../../app/api/generate/route');
}

async function localizeThroughActualRoute(
  request: ExperienceLocalizationRequest,
): Promise<ReturnType<typeof validSerbianResponse>> {
  const { POST } = await importLocalizationRoute();
  const response = await POST(new Request('https://cvproai.test/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: 'experience-localize',
      snapshotId: request.snapshotId,
      targetLocale: request.targetLocale,
      records: request.records,
    }),
  }) as never);
  const body = await response.json() as { localizedExperienceSurfaces?: ReturnType<typeof validSerbianResponse>; error?: string };
  if (response.status !== 200 || !body.localizedExperienceSurfaces) {
    throw new Error(`actual_route_failed:${response.status}:${body.error || 'unknown'}`);
  }
  return body.localizedExperienceSurfaces;
}

describe('AAB475 shared Experience presentation resolution', () => {
  it('uses immutable Serbian fact authority when a Croatian generated display must return to Serbian', () => {
    const atlas = experience({
      id: 'atlas', immutableFacts: SERBIAN_ATLAS_CURRENT,
      current: CROATIAN_ATLAS_CURRENT, generatedLocale: 'hr', isPresent: true,
    });
    atlas.position = 'Warehouse employee';
    const cv = cvFor([atlas], ['sr']);
    const snapshot = resolveExperiencePresentationSnapshot({ cv, targetLocale: 'sr' });

    expect(snapshot.ok, JSON.stringify(snapshot.records)).toBe(true);
    expect(snapshot.cv.experience[0]?.description).toBe(SERBIAN_ATLAS_CURRENT);
    expect(snapshot.records[0]).toMatchObject({
      sourceLocale: 'sr',
      immutableGroundingLocale: 'sr',
      currentPresentationLocale: 'hr',
      projectionRequired: true,
      presentationAuthority: 'same_entry_semantic_recovery',
      requiredFactCount: 3,
      coveredFactCount: 3,
      missingFactCount: 0,
      factCoveragePassed: true,
    });
    expect(snapshot.records[0]?.immutableFactSetHash)
      .toBe(hashExperienceLocalizedSurfaceValue(SERBIAN_ATLAS_CURRENT));
    expect(snapshot.records[0]?.sourceBulletScripts)
      .toEqual(['latin', 'latin_diacritic_sc', 'latin_diacritic_sc']);
    expect(snapshot.records[0]?.finalPresentationBulletScripts)
      .toEqual(['latin', 'latin_diacritic_sc', 'latin_diacritic_sc']);
  });

  it('acquires and caches a source-bound Serbian presentation for immutable Hindi AI output without mutating editor text or usage', async () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    let current = cvFor([hindi], ['hi']);
    let providerRequests = 0;

    const beforeVisible = current.experience[0]?.description;
    const preflight = buildExperienceLocalizationSnapshot(current, 'sr');
    expect(preflight.records).toHaveLength(3);
    expect(preflight.missingRecords).toHaveLength(3);
    expect(preflight.records.every((record) => record.experienceId === 'hindi-entry')).toBe(true);
    expect(preflight.records.every((record) => record.sourceLocale === 'hi')).toBe(true);
    expect(preflight.records.every((record) => record.targetLocale === 'sr')).toBe(true);
    expect(preflight.records.map((record) => record.semanticFactId))
      .toEqual(['aab475-hindi-entry-fact-0', 'aab475-hindi-entry-fact-1', 'aab475-hindi-entry-fact-2']);

    const acquired = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'sr',
      adapter: async (request) => {
        providerRequests += 1;
        return validSerbianResponse(request);
      },
      getCurrentCv: () => current,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect(acquired.ok, JSON.stringify(acquired)).toBe(true);
    expect(providerRequests).toBe(1);
    expect(acquired.diagnostics.providerRequestCount).toBe(1);
    expect(acquired.diagnostics.validatedRecordCount).toBe(3);
    expect(acquired.diagnostics.persistedSurfaceCount).toBe(3);
    expect(current.experience[0]?.description).toBe(beforeVisible);

    const terminal = resolveExperiencePresentationSnapshot({ cv: current, targetLocale: 'sr' });
    expect(terminal.ok, JSON.stringify(terminal.records)).toBe(true);
    expect(terminal.cv.experience[0]?.description).toBe(SERBIAN_BULLETS);
    expect(terminal.records[0]).toMatchObject({
      sourceLocale: 'hi',
      immutableGroundingLocale: 'hi',
      currentPresentationLocale: 'hi',
      presentationAuthority: 'validated_target_projection',
      recoveryAttempted: true,
      recoveryKind: 'validated_target_projection',
      requiredFactCount: 3,
      coveredFactCount: 3,
      missingFactCount: 0,
      factCoveragePassed: true,
      sourceLanguageLeakageDetected: false,
    });
    expect(terminal.records[0]?.finalPresentationHash)
      .toBe(terminal.records[0]?.selectedPresentationHash);
    expect(terminal.records[0]?.finalPresentationBulletCount).toBe(3);
    expect(terminal.records[0]?.immutableFactSetHash)
      .toBe(hashExperienceLocalizedSurfaceValue(HINDI_FACTS));
    expect(terminal.records[0]?.sourceBulletScripts)
      .toEqual(['devanagari', 'devanagari', 'devanagari']);
    expect(terminal.records[0]?.finalPresentationBulletScripts)
      .toEqual(['latin_diacritic_sc', 'latin', 'latin_diacritic_sc']);
    expect(terminal.records[0]?.detectedLocaleByBullet).toHaveLength(3);
    expect(terminal.records[0]?.detectedScriptByBullet)
      .toEqual(terminal.records[0]?.finalPresentationBulletScripts);
  });

  it('sends the immutable Hindi source-bound records through the real localization route and preserves editor/usage state', async () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    let current = cvFor([hindi], ['hi']);
    anthropicCreateMock
      .mockImplementationOnce(async (params: { messages: Array<{ content: string }> }) => {
        const manifest = JSON.parse(params.messages[0]!.content) as {
          records: Array<{ recordId: string }>;
        };
        return anthropicJson({
          records: manifest.records.map((record, index) => ({
            recordId: record.recordId,
            localizedSurface: SERBIAN_FACTS.split('\n')[index]!,
          })),
        });
      })
      .mockImplementationOnce(async (params: { messages: Array<{ content: string }> }) => {
        const manifest = JSON.parse(params.messages[0]!.content) as {
          records: Array<{ recordId: string }>;
        };
        return anthropicJson({
          records: manifest.records.map((record) => ({
            recordId: record.recordId,
            decision: 'passed',
            mismatchCategory: 'none',
            predicatePreserved: true,
            objectPreserved: true,
            workDomainPreserved: true,
            sourceResponsibilityPreserved: true,
            scopePreserved: true,
            negationPreserved: true,
            tensePreserved: true,
            unsupportedFactsIntroduced: false,
            crossEntryFactIntroduced: false,
            crossOccupationSubstitution: false,
          })),
        });
      });

    const beforeDescription = current.experience[0]?.description;
    const result = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'sr',
      adapter: localizeThroughActualRoute,
      getCurrentCv: () => current,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(anthropicCreateMock).toHaveBeenCalledTimes(2);
    expect(result.snapshot.records).toHaveLength(3);
    expect(result.snapshot.records.map((record) => record.experienceId))
      .toEqual(['hindi-entry', 'hindi-entry', 'hindi-entry']);
    expect(result.snapshot.records.map((record) => record.semanticFactId))
      .toEqual(['aab475-hindi-entry-fact-0', 'aab475-hindi-entry-fact-1', 'aab475-hindi-entry-fact-2']);
    expect(result.snapshot.records.every((record) => (
      record.sourceLocale === 'hi' && record.targetLocale === 'sr'
    ))).toBe(true);
    expect(current.experience[0]?.description).toBe(beforeDescription);
    expect(localStorage.getItem('cvpro-ai-usage')).toBeNull();

    const terminal = resolveExperiencePresentationSnapshot({ cv: current, targetLocale: 'sr' });
    expect(terminal.ok, JSON.stringify(terminal.records)).toBe(true);
    expect(terminal.cv.experience[0]?.description).toBe(SERBIAN_BULLETS);
    expect(terminal.records[0]).toMatchObject({
      presentationAuthority: 'validated_target_projection',
      requiredFactCount: 3,
      coveredFactCount: 3,
      missingFactCount: 0,
      factCoveragePassed: true,
    });
    expect(terminal.records[0]?.finalPresentationHash)
      .toBe(terminal.records[0]?.selectedPresentationHash);
  });

  it('reuses a validated immutable-bound target surface before provider escalation and invalidates it when a fact binding changes', async () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    let current = cvFor([hindi], ['hi']);
    let calls = 0;
    const adapter = async (request: ExperienceLocalizationRequest) => {
      calls += 1;
      return validSerbianResponse(request);
    };
    const first = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'sr',
      adapter,
      getCurrentCv: () => current,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect(first.ok).toBe(true);
    expect(calls).toBe(1);

    const cached = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'sr',
      adapter: async () => {
        throw new Error('provider must not run on a bound cache hit');
      },
      getCurrentCv: () => current,
      persist: () => {
        throw new Error('cache hit must not persist');
      },
    });
    expect(cached.ok, JSON.stringify(cached)).toBe(true);
    expect(cached.diagnostics.providerRequestCount).toBe(0);
    expect(cached.diagnostics.cacheReuseCount).toBe(3);

    const mutatedFactId = {
      ...current,
      canonicalSnapshot: {
        ...current.canonicalSnapshot!,
        canonicalExperiences: current.canonicalSnapshot!.canonicalExperiences.map((entry) => ({
          ...entry,
          bullets: entry.bullets.map((bullet, index) => index === 1
            ? { ...bullet, factId: `${bullet.factId}-changed` }
            : bullet),
        })),
      },
    };
    const stale = buildExperienceLocalizationSnapshot(mutatedFactId, 'sr');
    expect(stale.missingRecords).toHaveLength(1);
    expect(stale.cachedSurfaces).toHaveLength(2);
    expect(stale.missingRecords[0]?.semanticFactId).toMatch(/changed$/);
  });

  it('re-escalates a cache whose persisted fact-bound surface was corrupted', async () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    let current = cvFor([hindi], ['hi']);
    const first = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'sr',
      adapter: async (request) => validSerbianResponse(request),
      getCurrentCv: () => current,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect(first.ok).toBe(true);

    const keys = Object.keys(current.experienceLocalizedSurfaces?.surfaces || {}).sort();
    expect(keys).toHaveLength(3);
    const duplicateKey = keys[1]!;
    const duplicateSurface = current.experienceLocalizedSurfaces!.surfaces[duplicateKey]!;
    const duplicatedText = current.experienceLocalizedSurfaces!.surfaces[keys[0]!]!.localizedText;
    const corrupted = {
      ...current,
      experienceLocalizedSurfaces: {
        ...current.experienceLocalizedSurfaces!,
        surfaces: {
          ...current.experienceLocalizedSurfaces!.surfaces,
          [duplicateKey]: {
            ...duplicateSurface,
            // A corrupt persisted record can retain its own fact-ID binding
            // and target purity while duplicating a different source-owned
            // fact surface. It must become a cache miss only after the complete
            // entry presentation is revalidated, not a synthetic cache hit.
            localizedText: duplicatedText,
            localizedTextHash: hashExperienceLocalizedSurfaceValue(duplicatedText),
            validatedCandidateHash: hashExperienceLocalizedSurfaceValue(duplicatedText),
          },
        },
      },
    };

    const preliminary = resolveExperiencePresentationSnapshot({ cv: corrupted, targetLocale: 'sr' });
    const perRecordCache = buildExperienceLocalizationSnapshot(corrupted, 'sr');
    expect(perRecordCache.cachedSurfaces).toHaveLength(2);
    expect(perRecordCache.missingRecords).toHaveLength(1);
    expect(preliminary.ok).toBe(false);
    expect(preliminary.records[0]).toMatchObject({
      presentationAuthority: 'unresolved',
      factCoveragePassed: null,
    });

    let providerCalls = 0;
    const recovered = await prepareExperienceLocalizedSurfaces({
      cv: corrupted,
      targetLocale: 'sr',
      adapter: async (request) => {
        providerCalls += 1;
        expect(request.records).toHaveLength(3);
        return validSerbianResponse(request);
      },
      getCurrentCv: () => corrupted,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect(recovered.ok, JSON.stringify(recovered)).toBe(true);
    expect(providerCalls).toBe(1);
    expect(recovered.diagnostics.persistedSurfaceCount).toBe(3);
    const terminal = resolveExperiencePresentationSnapshot({ cv: current, targetLocale: 'sr' });
    expect(terminal.ok, JSON.stringify(terminal.records)).toBe(true);
    expect(terminal.records[0]).toMatchObject({
      requiredFactCount: 3,
      coveredFactCount: 3,
      missingFactCount: 0,
      factCoveragePassed: true,
    });
  });

  it('settles the safe Atlas same-entry semantic projection before attempting provider localization', async () => {
    const croatian = experience({
      id: 'atlas-current',
      immutableFacts: SERBIAN_ATLAS_CURRENT,
      current: CROATIAN_ATLAS_CURRENT,
      generatedLocale: 'hr',
      isPresent: true,
    });
    croatian.position = 'Warehouse employee';
    const cv = cvFor([croatian], ['sr']);
    const before = resolveExperiencePresentationSnapshot({ cv, targetLocale: 'sr' });
    expect(before.ok, JSON.stringify(before.records)).toBe(true);
    expect(before.records[0]?.presentationAuthority).toBe('same_entry_semantic_recovery');
    expect(before.cv.experience[0]?.description).not.toBe(CROATIAN_DISPLAY);

    const acquired = await prepareExperienceLocalizedSurfaces({
      cv,
      targetLocale: 'sr',
      adapter: async () => {
        throw new Error('provider must not be invoked after deterministic settlement');
      },
      getCurrentCv: () => cv,
      persist: () => {
        throw new Error('deterministic settlement must not persist a provider cache');
      },
    });
    expect(acquired.ok, JSON.stringify(acquired)).toBe(true);
    expect(acquired.diagnostics.providerRequestCount).toBe(0);
    expect(acquired.snapshot.missingRecords).toHaveLength(0);
  });

  it.each([
    ['wrong target locale', (request: ExperienceLocalizationRequest) => ({
      ...validSerbianResponse(request),
      records: validSerbianResponse(request).records.map((record) => ({ ...record, localizedText: HINDI_FACTS.split('\n')[record.sourceClauseIndex] || '' })),
    })],
    ['missing required fact', (request: ExperienceLocalizationRequest) => ({
      ...validSerbianResponse(request),
      records: validSerbianResponse(request).records.slice(0, 2),
    })],
    ['unsupported responsibility', (request: ExperienceLocalizationRequest) => {
      const response = validSerbianResponse(request);
      response.records[1] = {
        ...response.records[1]!,
        localizedText: 'Koristila sam Salesforce za upravljanje projektima klijenata.',
      };
      response.independentVerification.records[1] = {
        ...response.independentVerification.records[1]!,
        candidateSurfaceHash: hashExperienceLocalizedSurfaceValue(response.records[1].localizedText),
      };
      return response;
    }],
  ] as const)('fails closed when provider localization has a %s', async (_label, mutate) => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    const cv = cvFor([hindi], ['hi']);
    let persistCalls = 0;
    const acquired = await prepareExperienceLocalizedSurfaces({
      cv,
      targetLocale: 'sr',
      adapter: async (request) => mutate(request),
      getCurrentCv: () => cv,
      persist: () => {
        persistCalls += 1;
        return true;
      },
    });
    expect(acquired.ok).toBe(false);
    if (acquired.ok) return;
    expect(acquired.stage).toBe('validate_localized_surfaces');
    expect(acquired.diagnostics.persistedSurfaceCount).toBe(0);
    expect(persistCalls).toBe(0);
    const terminal = resolveExperiencePresentationSnapshot({ cv, targetLocale: 'sr' });
    expect(terminal.ok).toBe(false);
    expect(terminal.cv.experience[0]?.description).toBe('');
    expect(terminal.records[0]?.presentationAuthority).toBe('unresolved');
  });

  it('rejects an atomically returned cross-entry provider record before cache persistence', async () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    const other = experience({
      id: 'other-entry', immutableFacts: SERBIAN_FACTS, current: SERBIAN_FACTS, generatedLocale: 'sr',
    });
    const cv = cvFor([hindi, other], ['hi', 'sr']);
    let persistCalls = 0;
    const acquired = await prepareExperienceLocalizedSurfaces({
      cv,
      targetLocale: 'sr',
      adapter: async (request) => {
        const response = validSerbianResponse(request);
        response.records[0] = { ...response.records[0]!, experienceId: 'other-entry' };
        return response;
      },
      getCurrentCv: () => cv,
      persist: () => {
        persistCalls += 1;
        return true;
      },
    });
    expect(acquired.ok).toBe(false);
    if (acquired.ok) return;
    expect(acquired.stage).toBe('validate_localized_surfaces');
    expect(acquired.reason).toBe('experience_localization_binding_identity_mismatch');
    expect(persistCalls).toBe(0);
    expect(cv.experienceLocalizedSurfaces?.surfaces || {}).toEqual({});
  });

  it('keeps the Preview terminal contract authoritative after quality normalization', async () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    const raw = cvFor([hindi], ['hi']);
    const unresolved = resolveExperiencePresentationSnapshot({ cv: raw, targetLocale: 'sr' });
    expect(unresolved.ok).toBe(false);
    expect(unresolved.records[0]?.presentationAuthority).toBe('unresolved');
    expect(unresolved.cv.experience[0]?.description).toBe('');

    const afterQuality = applyCvContentQuality(unresolved.cv, 'sr', { gender: 'female' }).cv;
    const preview = applyTerminalExperiencePresentationSnapshot(afterQuality, unresolved);
    expect(preview.experience[0]?.description).toBe('');
    expect(preview.experience[0]?.description).not.toContain('मुद्रित');
    expect(raw.experience[0]?.description).toBe(HINDI_FACTS);

    let localized = raw;
    const acquired = await prepareExperienceLocalizedSurfaces({
      cv: localized,
      targetLocale: 'sr',
      adapter: async (request) => validSerbianResponse(request),
      getCurrentCv: () => localized,
      persist: (next) => {
        localized = next;
        return true;
      },
    });
    expect(acquired.ok).toBe(true);
    const resolved = resolveExperiencePresentationSnapshot({ cv: localized, targetLocale: 'sr' });
    expect(resolved.ok).toBe(true);
    const restored = applyTerminalExperiencePresentationSnapshot(
      applyCvContentQuality(resolved.cv, 'sr', { gender: 'female' }).cv,
      resolved,
    );
    expect(restored.experience[0]?.description).toBe(resolved.cv.experience[0]?.description);
    expect(restored.experience[0]?.description).toBe(SERBIAN_BULLETS);
  });

  it('does not let an unlabeled stale foreign surface enter the legacy formatter as manual authority', () => {
    const stale = experience({
      id: 'legacy-unknown', immutableFacts: SERBIAN_FACTS, current: CROATIAN_DISPLAY, generatedLocale: 'hr',
    });
    delete stale.descriptionOrigin;
    delete stale.generatedDescription;
    delete stale.aiOutputProvenance;
    expect(canUseLegacyExperienceDisplayProjection(stale)).toBe(false);

    const terminal = resolveExperiencePresentationSnapshot({
      cv: cvFor([stale], ['sr']),
      targetLocale: 'sr',
    });
    expect(terminal.ok).toBe(false);
    expect(terminal.cv.experience[0]?.description).toBe('');
    expect(terminal.records[0]).toMatchObject({
      presentationAuthority: 'unresolved',
      rejectionReason: 'immutable_experience_authority_unbound',
    });
  });

  it('keeps the legacy same-locale terminal text exact while PDF/DOCX derive only an ephemeral render projection', () => {
    const clauses = [
      'Pripremam materijale za štampu.',
      'Pregledam vizuelne nacrte.',
    ];
    const legacyManual: WorkExperience = {
      id: 'legacy-manual',
      position: 'Dizajner', company: 'Legacy', startDate: '2024-01', endDate: '', isPresent: true,
      description: clauses.join('\n'),
      originalUserDescription: clauses.join('\n'),
      canonicalDescription: clauses.join('\n'),
      descriptionOrigin: 'user',
      descriptionSourceLocale: 'sr',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(clauses.join('\n')),
      groundingRecoverySource: 'legacy_user_origin_duties',
      recoveredSemanticDuties: clauses.map((sourceClause, sourceClauseIndex) => ({
        key: `legacy_${sourceClauseIndex}`,
        confidence: 'exact_user_origin' as const,
        sourceClauseIndex,
        sourceClause,
        sourceClauseHash: hashExperienceLocalizedSurfaceValue(sourceClause),
        sourceFactId: `legacy-fact-${sourceClauseIndex}`,
        sourceLocale: 'sr',
        sourceLocaleResolution: 'description_source_locale' as const,
      })),
    };
    const terminal = resolveExperiencePresentationSnapshot({
      cv: cvFor([legacyManual], ['sr']), targetLocale: 'sr',
    });
    expect(terminal.ok, JSON.stringify(terminal.records)).toBe(true);
    expect(terminal.cv.experience[0]?.description).toBe(clauses.join('\n'));
    expect(terminal.records[0]).toMatchObject({
      presentationAuthority: 'current_visible',
      requiredFactCount: null,
      coveredFactCount: null,
      missingFactCount: null,
      factCoveragePassed: null,
    });
    expect(terminal.records[0]?.finalPresentationHash)
      .toBe(hashExperienceLocalizedSurfaceValue(clauses.join('\n')));
    const rendererInput = buildCvExportRenderProjection(terminal.cv, 'sr');
    expect(rendererInput.experience[0]?.description).toMatch(/^• Pripremam/mu);
    expect(terminal.cv.experience[0]?.description).toBe(clauses.join('\n'));
    expect(terminal.records[0]?.finalPresentationHash)
      .toBe(hashExperienceLocalizedSurfaceValue(terminal.cv.experience[0]?.description || ''));
  });

  it('does not let a stale legacy render projection overwrite a material same-locale user edit', () => {
    const staleClauses = [
      'Pripremam materijale za štampu.',
      'Pregledam vizuelne nacrte.',
    ];
    const editedClauses = [
      'Pripremam materijale za štampu i digitalne kanale.',
      'Pregledam vizuelne nacrte sa klijentima.',
    ];
    const editedDescription = editedClauses.join('\n');
    const edited: WorkExperience = {
      id: 'legacy-material-edit',
      position: 'Dizajner', company: 'Legacy', startDate: '2024-01', endDate: '', isPresent: true,
      description: editedDescription,
      originalUserDescription: editedDescription,
      canonicalDescription: editedDescription,
      descriptionOrigin: 'user',
      descriptionSourceLocale: 'sr',
      descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(editedDescription),
      groundingRecoverySource: 'legacy_user_origin_duties',
      recoveredSemanticDuties: staleClauses.map((sourceClause, sourceClauseIndex) => ({
        key: `legacy_${sourceClauseIndex}`,
        confidence: 'exact_user_origin' as const,
        sourceClauseIndex,
        sourceClause,
        sourceClauseHash: hashExperienceLocalizedSurfaceValue(sourceClause),
        sourceFactId: `legacy-fact-${sourceClauseIndex}`,
        sourceLocale: 'sr',
        sourceLocaleResolution: 'description_source_locale' as const,
      })),
    };
    const renderCv = buildCvExportRenderProjection(cvFor([edited], ['sr']), 'sr');
    expect(renderCv.experience[0]?.description).toBe(editedDescription);
  });

  it('serializes absent terminal presentation fields as N/A rather than an invented current-visible success', () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'sr',
      rawCv: cvFor([hindi], ['hi']),
      prepared: null,
      originalFailureReason: 'pre_terminal_failure',
    });
    expect(trace.experiences[0]).toMatchObject({
      presentationSnapshotId: null,
      presentationAuthority: null,
      projectionRequired: null,
      recoveryAttempted: null,
      presentationHash: null,
      finalPresentationHash: null,
      finalProjectedBulletCount: null,
      sourceBulletScripts: null,
      finalPresentationBulletScripts: null,
      finalBulletScripts: null,
      sourceLanguageLeakageDetected: null,
      crossEntryOwnershipPassed: null,
    });
  });

  it('feeds Preview, PDF, and DOCX the same terminal cached-provider presentation snapshot', async () => {
    const hindi = experience({
      id: 'hindi-entry', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi',
    });
    let current = cvFor([hindi], ['hi']);
    const acquired = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'sr',
      adapter: async (request) => validSerbianResponse(request),
      getCurrentCv: () => current,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect(acquired.ok).toBe(true);
    const terminal = resolveExperiencePresentationSnapshot({ cv: current, targetLocale: 'sr' });
    expect(terminal.ok).toBe(true);
    const preview = applyTerminalExperiencePresentationSnapshot(
      applyCvContentQuality(terminal.cv, 'sr', { gender: 'female' }).cv,
      terminal,
    );
    const prepared = prepareExportReadyCv(current, 'sr', 'modern-minimal', {
      referenceDate: '2026-08-17',
      gender: 'female',
    });
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.diagnostics.experiencePresentationSnapshotId)
      .toBe(terminal.presentationSnapshotId);
    expect(prepared.diagnostics.experiencePresentation?.[0]?.presentationSnapshotId)
      .toBe(terminal.presentationSnapshotId);
    expect(preview.experience.map((entry) => entry.description))
      .toEqual(prepared.cv.experience.map((entry) => entry.description));
    expect(prepared.cv.experience[0]?.description).toBe(SERBIAN_BULLETS);
    expect(prepared.diagnostics.experiencePresentation?.[0]?.finalPresentationHash)
      .toBe(terminal.records[0]?.finalPresentationHash);

    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    expect(pdf.size).toBeGreaterThan(0);
    const downloads = mockDownload();
    const docx = await exportToDOCX(prepared.cv, 'aab475-presentation', 'sr', 'modern-minimal');
    expect(docx.result).toBe('saved');
    expect(downloads.at(-1)?.size).toBeGreaterThan(0);

    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'sr',
      rawCv: current,
      prepared,
      rendererReached: true,
      blobProduced: true,
      blobSize: pdf.size,
      blobMimeType: pdf.type,
    });
    expect(trace.experiencePresentationSnapshotId).toBe(terminal.presentationSnapshotId);
    expect(trace.experiences[0]).toMatchObject({
      sourceLocale: 'hi',
      immutableGroundingLocale: 'hi',
      currentPresentationLocale: 'hi',
      presentationSnapshotId: terminal.presentationSnapshotId,
      sourceBulletScripts: ['devanagari', 'devanagari', 'devanagari'],
      finalPresentationBulletScripts: ['latin_diacritic_sc', 'latin', 'latin_diacritic_sc'],
      finalBulletScripts: ['latin_diacritic_sc', 'latin', 'latin_diacritic_sc'],
    });
    expect(trace.experiences[0]?.finalProjectedBulletCount).toBe(3);
    expect(trace.experiences[0]?.finalBulletDetectedLocales).toHaveLength(3);
  }, 60_000);

  it('resolves the five-entry AAB474-shaped sr/hr/ar/ar/hi manifest into one Serbian terminal snapshot', async () => {
    const entries = [
      experience({
        id: 'sr-current', immutableFacts: SERBIAN_CURRENT_DESIGN_FACTS,
        current: SERBIAN_CURRENT_DESIGN_FACTS, generatedLocale: 'sr', isPresent: true,
      }),
      experience({ id: 'sr-authority-hr-display', immutableFacts: SERBIAN_FACTS, current: CROATIAN_DISPLAY, generatedLocale: 'hr' }),
      experience({ id: 'arabic-design', immutableFacts: ARABIC_DESIGN_FACTS, current: ARABIC_DESIGN_FACTS, generatedLocale: 'ar' }),
      experience({
        id: 'arabic-warehouse', immutableFacts: ARABIC_WAREHOUSE_FACTS,
        current: ARABIC_WAREHOUSE_FACTS, generatedLocale: 'ar', position: 'Warehouse employee',
      }),
      experience({ id: 'hindi-design', immutableFacts: HINDI_FACTS, current: HINDI_FACTS, generatedLocale: 'hi' }),
    ];
    let current = cvFor(entries, ['sr', 'sr', 'ar', 'ar', 'hi']);
    const surfaces = {
      'arabic-design': SERBIAN_FACTS.split('\n'),
      'arabic-warehouse': SERBIAN_WAREHOUSE_FACTS,
      'hindi-design': SERBIAN_FACTS.split('\n'),
    };
    const pending = buildExperienceLocalizationSnapshot(current, 'sr').missingRecords;
    for (const record of pending) {
      const localized = surfaces[record.experienceId as keyof typeof surfaces]?.[record.sourceClauseIndex] || '';
      const unsupported = detectExperienceUnsupportedClaimExpansion(record.sourceText, localized);
      expect(unsupported.count, `${record.experienceId}:${record.sourceClauseIndex}:${unsupported.labels.join(',')}`)
        .toBe(0);
    }
    for (const entry of entries.filter((item) => surfaces[item.id as keyof typeof surfaces])) {
      const candidate = surfaces[entry.id as keyof typeof surfaces].join('\n');
      const semantic = validateCrossLocaleSemanticCoverage(entry.originalUserDescription || '', candidate);
      if (entry.id === 'arabic-warehouse') {
        const warehouse = validateSerbianWarehouseExperienceCoverage(
          entry.originalUserDescription || '', candidate,
        );
        expect(
          warehouse.ok,
          `${entry.id}:warehouse:${JSON.stringify(warehouse)}`,
        ).toBe(true);
      } else {
        expect(semantic.ok, `${entry.id}:semantic:${JSON.stringify(semantic)}`).toBe(true);
      }
      const fidelity = validateLocalizedExperienceBullets(
        candidate,
        buildFactSetFromExperienceDescription(entry.originalUserDescription || '', {
          company: entry.company, position: entry.position, startDate: entry.startDate,
          endDate: entry.endDate, isPresent: entry.isPresent,
        }),
        { locale: 'sr', gender: 'female', experienceIndex: 0, isPresent: entry.isPresent },
      );
      expect(
        fidelity.violations.filter((violation) => violation.kind !== 'missing_canonical_duty'),
        `${entry.id}:fidelity:${JSON.stringify(fidelity.violations)}`,
      ).toEqual([]);
    }
    const result = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'sr',
      adapter: async (request) => {
        return validSerbianResponseFor(request, surfaces);
      },
      getCurrentCv: () => current,
      persist: (next) => {
        current = next;
        return true;
      },
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    expect(result.diagnostics.providerRequestCount).toBe(2);
    expect(result.diagnostics.persistedSurfaceCount).toBe(9);
    const terminal = resolveExperiencePresentationSnapshot({ cv: current, targetLocale: 'sr' });
    expect(terminal.ok, JSON.stringify(terminal.records)).toBe(true);
    expect(terminal.records).toHaveLength(5);
    expect(terminal.records.map((record) => record.presentationAuthority)).toEqual([
      'current_visible',
      'same_entry_semantic_recovery',
      'validated_target_projection',
      'validated_target_projection',
      'validated_target_projection',
    ]);
    for (const [index, record] of terminal.records.entries()) {
      const description = terminal.cv.experience[index]?.description || '';
      expect(splitExperienceBullets(description)).toHaveLength(3);
      expect(description).not.toMatch(/^\s*•\s*x\s*$/iu);
      expect(record.finalPresentationBulletScripts).toHaveLength(3);
      expect(record.finalPresentationBulletScripts.every((script) => script.startsWith('latin')))
        .toBe(true);
      expect(record.detectedScriptByBullet).toEqual(record.finalPresentationBulletScripts);
      expect(record.mixedLanguageBulletCount).toBe(0);
      expect(record.sourceLanguageLeakageDetected).toBe(false);
      expect(record.crossEntryOwnershipPassed).toBe(true);
      if (record.presentationAuthority === 'current_visible') {
        // Current target-valid presentation is the established visible
        // authority; immutable fact coverage is deliberately N/A here, not a
        // false failure. Recovered/provider surfaces below must prove 3/3.
        expect(record.requiredFactCount).toBeNull();
        expect(record.coveredFactCount).toBeNull();
        expect(record.missingFactCount).toBeNull();
        expect(record.factCoveragePassed).toBeNull();
      } else {
        expect(record).toMatchObject({
          requiredFactCount: 3,
          coveredFactCount: 3,
          missingFactCount: 0,
          factCoveragePassed: true,
        });
      }
      expect(record.presentationSnapshotId).toBe(terminal.presentationSnapshotId);
    }
    expect(terminal.records[1]).toMatchObject({
      immutableGroundingLocale: 'sr',
      currentPresentationLocale: 'hr',
    });
    expect(terminal.records[4]).toMatchObject({
      immutableGroundingLocale: 'hi',
      sourceBulletScripts: ['devanagari', 'devanagari', 'devanagari'],
    });
  });
});
