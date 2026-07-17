/**
 * @vitest-environment jsdom
 *
 * Build 242 production regression: serialized pre-provenance Android save.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  CV_DRAFT_STORAGE_KEY,
  loadCvDraft,
  saveCvDraft,
} from '@/lib/draft-storage';
import {
  CV_RUNTIME_MIGRATION_VERSION,
  normalizeLegacyCvRuntimeWithTrace,
} from '@/lib/cv-legacy-runtime-migration';
import {
  CorporateNavyLocaleExportError,
  prepareCorporateNavyExport,
} from '@/lib/corporate-navy-export-integrity';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import {
  classifyDutyCategory,
  splitExperienceBullets,
} from '@/lib/cv-canonical-facts';
import {
  classifyDutyFamilies,
  evaluateRoleDutyConsistency,
} from '@/lib/cv-role-title';
import { formatCvExportIntegrityToast } from '@/lib/cv-export-error-message';
import {
  exportCorporateNavyPdf,
  exportToDOCX,
} from '@/lib/export';

const REF = '2026-07-17';
const SUMMARY =
  'मैं लगभग दो वर्षों के अनुभव वाली बेकर हूँ और जनवरी 2024 से Ztrew में कार्यरत हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, रसोई टीम के साथ सहयोग करती हूँ और कार्यस्थल की स्वच्छता बनाए रखती हूँ। मेरे प्रमुख कौशलों में प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन शामिल हैं।';
const EN_DUTIES = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');
const HI_DUTIES = [
  'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ।',
  'मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ।',
  'मैं रसोई टीम के साथ सहयोग करती हूँ।',
].join('\n');
const OLD_EN_SUMMARY =
  'Experienced baker preparing dishes, maintaining workplace hygiene and collaborating with the kitchen team.';

function legacyCv(overrides: Record<string, unknown> = {}): CVData {
  return {
    id: 'legacy-build-239',
    name: 'Ivan Grozni CV',
    personal: {
      fullName: 'Ivan Grozni',
      jobTitle: 'Baker',
      gender: 'female',
      email: 'ivan@example.com',
      phone: '+381 60 111 222',
      address: 'Belgrade',
      photoEnabled: false,
    },
    summary: SUMMARY,
    canonicalSummary: OLD_EN_SUMMARY,
    // Real old schema: stale locale, no summaryOrigin/runtime migration marker.
    contentLocale: 'en',
    experience: [{
      id: 'exp-baker',
      position: 'Baker',
      company: 'Ztrew',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: HI_DUTIES,
      generatedDescription: HI_DUTIES,
      generatedLocale: 'hi',
      // Polluted by the old apply/autosave path.
      canonicalDescription: HI_DUTIES,
      // descriptionOrigin and originalUserDescription did not exist yet.
    }],
    education: [],
    skills: [
      'Presentation Skills',
      'Leadership',
      'Organization',
      'Critical Thinking',
      'Adaptability',
      'Problem Solving',
      'Time Management',
    ],
    certifications: [],
    languages: [{ name: 'English', level: 'native' }],
    templateId: 'corporate-navy',
    region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    canonicalSnapshot: {
      canonicalSummary: OLD_EN_SUMMARY,
      canonicalExperiences: [{
        experienceId: 'exp-baker',
        role: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        current: true,
        // Old cached categories were stale/generic; migration must reclassify.
        bullets: splitExperienceBullets(EN_DUTIES).map((sourceText, order) => ({
          factId: `experience-0-bullet-${order}`,
          sourceText,
          semanticCategory: 'generic',
          order,
        })),
      }],
      canonicalLocale: 'en',
      canonicalRevision: 1,
      canonicalSourceHash: 'old-stale-hash',
      canonicalCreatedFrom: 'legacy_migration',
      canonicalState: 'valid',
    },
    localizedProjections: {
      en: {} as never,
    },
    ...overrides,
  } as CVData;
}

function persistRawLegacy(cv: CVData): string {
  const serialized = JSON.stringify({
    cv,
    savedAt: '2025-01-01T00:00:00.000Z',
    schemaVersion: 0,
    autosaveVersion: 2,
  });
  localStorage.setItem(CV_DRAFT_STORAGE_KEY, serialized);
  return serialized;
}

describe('Build 242 realistic old Hindi save hydration/export', () => {
  beforeEach(() => localStorage.clear());

  it('captures the exact pre-recovery Corporate Navy rejection and non-language toast mapping', () => {
    const hydrated = loadCvDraftAfterPersist(legacyCv());
    const prepared = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
    expect(prepared.diagnostics.initialRecoveryReasons).toEqual([
      'mixed_locale_projection: fact experience-0-bullet-0 could not be localized to hi',
    ]);
    expect(prepared.diagnostics.recoverySource).toBe('deterministic_authoritative_facts');

    const oldError = new CorporateNavyLocaleExportError(
      'hi',
      prepared.diagnostics.initialRecoveryReasons[0],
    );
    expect(formatCvExportIntegrityToast(oldError, 'en', 'pdf')).toBe(
      'The professional summary could not be verified against the saved experience. Review the saved CV and export again.',
    );
    expect(formatCvExportIntegrityToast(oldError, 'en', 'pdf')).not.toMatch(/mixes languages|regenerate/i);
    expect(formatCvExportIntegrityToast(oldError, 'en', 'pdf')).not.toMatch(/^PDF export failed/);
  });

  it('serializes, hydrates, previews, exports PDF/DOCX projections, and reloads idempotently', () => {
    const aiUsageBefore = localStorage.getItem('cvpro-ai-usage');
    const raw = persistRawLegacy(legacyCv());
    expect(JSON.parse(raw).cv.summary).toBe(SUMMARY);

    const firstDraft = loadCvDraft()!;
    const hydrated = firstDraft.cv;
    expect(hydrated.summary).toBe(SUMMARY);
    expect(hydrated.contentLocale).toBe('hi');
    expect(hydrated.summaryOrigin).toBe('ai_generated');
    expect(hydrated.summaryGeneratedLocale).toBe('hi');
    expect(hydrated.runtimeMigrationVersion).toBe(CV_RUNTIME_MIGRATION_VERSION);
    expect(hydrated.canonicalSummary).toBeUndefined();
    expect(hydrated.localizedProjections).toBeUndefined();

    const exp = hydrated.experience[0];
    expect(exp.position).toBe('Baker');
    expect(exp.company).toBe('Ztrew');
    expect(exp.originalUserDescription).toBe(EN_DUTIES);
    expect(exp.canonicalDescription).toBe(EN_DUTIES);
    expect(exp.description).toBe(HI_DUTIES);
    expect(exp.descriptionOrigin).toBe('ai_generated');
    expect(exp.generatedDescription).toBe(HI_DUTIES);
    expect(exp.generatedLocale).toBe('hi');

    const categories = hydrated.canonicalSnapshot!.canonicalExperiences[0].bullets
      .map((bullet) => bullet.semanticCategory);
    expect(categories).toEqual([
      'food_preparation',
      'hygiene_safety',
      'food_preparation',
    ]);
    expect(classifyDutyFamilies(EN_DUTIES).map((hit) => hit.family)).toEqual([
      'cooking',
      'hygiene_safety',
      'kitchen_collaboration',
    ]);
    expect(evaluateRoleDutyConsistency({
      profileJobTitle: 'Baker',
      experienceTitle: 'Baker',
      dutiesText: EN_DUTIES,
    }).conflict).toBe(false);

    // Same normalized object used by the page's preview memo.
    const preview = applyCvContentQuality(hydrated, 'hi', {
      gender: 'female',
      summaryOrigin: hydrated.summaryOrigin,
      referenceDate: REF,
    }).cv;
    expect(preview.summary).toBe(SUMMARY);

    const pdf = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
    const docx = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
    expect(pdf.cv.summary).toBe(SUMMARY);
    expect(docx.cv.summary).toBe(pdf.cv.summary);
    expect(pdf.projection.localizedSummary).toBe(docx.projection.localizedSummary);
    expect(pdf.projection.localizedExperiences).toEqual(docx.projection.localizedExperiences);

    saveCvDraft({ cv: hydrated, savedAt: firstDraft.savedAt });
    const persistedAfterFirstLoad = localStorage.getItem(CV_DRAFT_STORAGE_KEY);
    const reloaded = loadCvDraft()!;
    expect(reloaded.cv).toEqual(hydrated);
    expect(localStorage.getItem(CV_DRAFT_STORAGE_KEY)).toBe(persistedAfterFirstLoad);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiUsageBefore);
  });

  it('creates non-empty PDF and DOCX files from the first hydrated old save', async () => {
    const hydrated = loadCvDraftAfterPersist(legacyCv());
    const blobs: Blob[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn((blob: Blob) => {
        blobs.push(blob);
        return `blob:http://legacy-build-242/${blobs.length}`;
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

    const pdf = await exportCorporateNavyPdf(hydrated, 'Ivan-Grozni-CV', 'hi');
    const docx = await exportToDOCX(
      hydrated,
      'Ivan-Grozni-CV',
      'hi',
      'corporate-navy',
    );

    expect(pdf).toMatchObject({ result: 'saved', fileName: 'Ivan-Grozni-CV.pdf' });
    expect(docx).toMatchObject({ result: 'saved', fileName: 'Ivan-Grozni-CV.docx' });
    expect(blobs).toHaveLength(2);
    expect(blobs[0].size).toBeGreaterThan(0);
    expect(blobs[1].size).toBeGreaterThan(0);
    expect(localStorage.getItem('cvpro-ai-usage')).toBeNull();
  }, 30_000);

  it.each([
    ['missing contentLocale', { contentLocale: undefined }],
    ['stale contentLocale=en', { contentLocale: 'en' }],
    ['polluted canonicalDescription', {}],
    ['missing descriptionOrigin', {}],
    ['old generated Experience text', {}],
  ])('%s migrates on first load without regeneration', (_name, overrides) => {
    const cv = legacyCv(overrides);
    const hydrated = loadCvDraftAfterPersist(cv);
    const prepared = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
    expect(prepared.cv.summary).toBe(SUMMARY);
    expect(hydrated.experience[0].canonicalDescription).toBe(EN_DUTIES);
    expect(hydrated.experience[0].descriptionOrigin).toBe('ai_generated');
  });

  it('genuine appended English prose is not accepted as the saved Summary', () => {
    const unsafe = `${SUMMARY} I am currently contributing to kitchen operations.`;
    const hydrated = loadCvDraftAfterPersist(legacyCv({ summary: unsafe }));
    const prepared = prepareCreativeArtisticExport(hydrated, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.summaryDiagnostics?.initialValidation.reason).toBe('mixed_locale_summary');
    expect(prepared.summaryDiagnostics?.recoverySource).toBe('deterministic_authoritative_facts');
    expect(prepared.summaryDiagnostics?.recoveryValidation?.valid).toBe(true);
    expect(prepared.cv.summary).not.toBe(unsafe);
    expect(prepared.cv.summary).not.toMatch(/I am currently|kitchen operations/i);
  });

  it('50× cold serialized loads are stable with zero flakes and zero AI usage', () => {
    for (let run = 0; run < 50; run += 1) {
      localStorage.clear();
      const hydrated = loadCvDraftAfterPersist(legacyCv());
      const pdf = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
      const docx = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
      expect(pdf.cv.summary, `pdf run ${run}`).toBe(SUMMARY);
      expect(docx.cv.summary, `docx run ${run}`).toBe(SUMMARY);
      expect(pdf.projection.localizedExperiences, `projection run ${run}`)
        .toEqual(docx.projection.localizedExperiences);
      expect(localStorage.getItem('cvpro-ai-usage'), `AI run ${run}`).toBeNull();
    }
  });

  it('migration trace exposes stale fields and authoritative recovery source', () => {
    const { cv, trace } = normalizeLegacyCvRuntimeWithTrace(legacyCv(), 'hi');
    expect(trace).toMatchObject({
      applied: true,
      fromVersion: 0,
      toVersion: CV_RUNTIME_MIGRATION_VERSION,
      contentLocaleBefore: 'en',
      contentLocaleAfter: 'hi',
      summaryOriginAfter: 'ai_generated',
      generatedSummaryLocale: 'hi',
      experienceSources: ['canonicalSnapshot'],
      clearedLocalizedProjections: true,
      rebuiltCanonicalSnapshot: true,
    });
    expect(cv.canonicalSnapshot?.canonicalSourceHash).not.toBe('old-stale-hash');
    expect(cv.canonicalSnapshot?.canonicalSummary).toBe('');
    expect(splitExperienceBullets(cv.experience[0].canonicalDescription || '').map(classifyDutyCategory))
      .toEqual(['food_preparation', 'hygiene_safety', 'food_preparation']);
  });
});

function loadCvDraftAfterPersist(cv: CVData): CVData {
  persistRawLegacy(cv);
  return loadCvDraft()!.cv;
}
