/**
 * @vitest-environment jsdom
 *
 * Build 243 production regression: serialized pre-provenance Corporate Navy
 * Hindi Android save must export PDF + DOCX on first attempt after hydration.
 *
 * Traced build-243 failure (device generic toast):
 * - Integrity prep could succeed after build-242 recovery work.
 * - PDF renderer + DOCX builder crashed on invalid/missing `region`:
 *   `Cannot read properties of undefined (reading 'showAddress')`
 * - That TypeError had no `.reason`, so formatCvExportIntegrityToast
 *   collapsed both formats into the generic localized export failure.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
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
import { prepareCorporateNavyExport } from '@/lib/corporate-navy-export-integrity';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  extractCvExportFailureReason,
  formatCvExportIntegrityToast,
} from '@/lib/cv-export-error-message';
import {
  exportCorporateNavyPdf,
  exportToDOCX,
} from '@/lib/export';

const REF = '2026-07-17';
const SUMMARY =
  'मैं लगभग ढाई वर्षों के अनुभव वाली बेकर हूँ और जनवरी 2024 से Ztrew में कार्यरत हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, रसोई टीम के साथ सहयोग करती हूँ और कार्यस्थल की स्वच्छता बनाए रखती हूँ। मेरे प्रमुख कौशलों में प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन शामिल हैं।';
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

function legacyCorporateNavySave(overrides: Record<string, unknown> = {}): CVData {
  return {
    id: 'legacy-build-239-cn',
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
      canonicalDescription: HI_DUTIES,
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
    // Real old saves sometimes omitted region or stored a non-Region string.
    // Build 243 failed here: preview/editor could still show Summary text while
    // PDF/DOCX crashed on regionSettings[undefined].showAddress.
    region: undefined as unknown as CVData['region'],
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

function loadCvDraftAfterPersist(cv: CVData): CVData {
  persistRawLegacy(cv);
  return loadCvDraft()!.cv;
}

function mockBrowserDownload() {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://legacy-build-243/${blobs.length}`;
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

describe('Build 243 realistic Corporate Navy Hindi save', () => {
  beforeEach(() => localStorage.clear());

  it('invalid/missing region is normalized before PDF/DOCX and never maps to a bare TypeError', async () => {
    const historical = new Error("Cannot read properties of undefined (reading 'showAddress')");
    expect(extractCvExportFailureReason(historical)).toMatch(/legacy_runtime_snapshot_invalid/);
    expect(formatCvExportIntegrityToast(historical, 'en', 'pdf')).toMatch(/refresh|Open the CV/i);
    expect(formatCvExportIntegrityToast(historical, 'en', 'pdf')).not.toMatch(/^PDF export failed/);

    const hydrated = loadCvDraftAfterPersist(legacyCorporateNavySave({
      region: undefined,
    }));
    expect(hydrated.region).toBe('EU');
    mockBrowserDownload();
    await expect(exportCorporateNavyPdf(hydrated, 'Ivan', 'hi')).resolves.toMatchObject({
      result: 'saved',
    });
    await expect(exportToDOCX(hydrated, 'Ivan', 'hi', 'corporate-navy')).resolves.toMatchObject({
      result: 'saved',
    });
  }, 30_000);

  it('hydrates, commits identical snapshots for state/cvRef/preview/PDF/DOCX, and reloads', async () => {
    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    persistRawLegacy(legacyCorporateNavySave({ region: 'international' as never }));

    const draft = loadCvDraft()!;
    const hydrated = draft.cv;
    expect(hydrated.runtimeMigrationVersion).toBe(CV_RUNTIME_MIGRATION_VERSION);
    expect(hydrated.region).toBe('EU');
    expect(hydrated.summary).toBe(SUMMARY);
    expect(hydrated.contentLocale).toBe('hi');
    expect(hydrated.summaryOrigin).toBe('ai_generated');
    expect(hydrated.summaryGeneratedLocale).toBe('hi');
    expect(hydrated.templateId).toBe('corporate-navy');

    // Simulate atomic commit used by the builder page.
    const state = hydrated;
    const cvRef = { current: hydrated };
    expect(state).toEqual(cvRef.current);

    const preview = applyCvContentQuality(state, 'hi', {
      gender: 'female',
      summaryOrigin: state.summaryOrigin,
      referenceDate: REF,
    }).cv;
    expect(preview.summary).toBe(SUMMARY);

    const pdfPrep = prepareCorporateNavyExport(cvRef.current, 'hi', { referenceDate: REF });
    const docxPrep = prepareCorporateNavyExport(state, 'hi', { referenceDate: REF });
    expect(pdfPrep.cv.summary).toBe(SUMMARY);
    expect(docxPrep.cv.summary).toBe(pdfPrep.cv.summary);
    expect(pdfPrep.projection.localizedExperiences).toEqual(docxPrep.projection.localizedExperiences);
    expect(pdfPrep.diagnostics.recoverySource).toBe('deterministic_authoritative_facts');

    const blobs = mockBrowserDownload();
    const pdf = await exportCorporateNavyPdf(cvRef.current, 'Ivan-Grozni-CV', 'hi');
    const docx = await exportToDOCX(state, 'Ivan-Grozni-CV', 'hi', 'corporate-navy');
    expect(pdf).toMatchObject({ result: 'saved', fileName: 'Ivan-Grozni-CV.pdf' });
    expect(docx).toMatchObject({ result: 'saved', fileName: 'Ivan-Grozni-CV.docx' });
    expect(blobs).toHaveLength(2);
    expect(blobs[0].type).toMatch(/pdf/);
    expect(blobs[1].type).toMatch(/officedocument|octet-stream|zip/i);
    expect(blobs[0].size).toBeGreaterThan(0);
    expect(blobs[1].size).toBeGreaterThan(0);

    saveCvDraft({ cv: hydrated, savedAt: draft.savedAt });
    const reloaded = loadCvDraft()!.cv;
    expect(reloaded.runtimeMigrationVersion).toBe(CV_RUNTIME_MIGRATION_VERSION);
    expect(reloaded.region).toBe('EU');
    expect(reloaded.summary).toBe(SUMMARY);

    const pdf2 = await exportCorporateNavyPdf(reloaded, 'Ivan-Grozni-CV', 'hi');
    const docx2 = await exportToDOCX(reloaded, 'Ivan-Grozni-CV', 'hi', 'corporate-navy');
    expect(pdf2.result).toBe('saved');
    expect(docx2.result).toBe('saved');
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);
  }, 60_000);

  it('Creative Artistic control recovers genuine mixed English without AI', () => {
    const unsafe = `${SUMMARY} I am currently contributing to kitchen operations.`;
    const hydrated = loadCvDraftAfterPersist(legacyCorporateNavySave({
      templateId: 'creative-artistic',
      summary: unsafe,
      region: 'EU',
    }));
    const prepared = prepareCreativeArtisticExport(hydrated, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.summaryDiagnostics?.initialValidation.reason).toBe('mixed_locale_summary');
    expect(prepared.summaryDiagnostics?.recoverySource).toBe('deterministic_authoritative_facts');
    expect(prepared.cv.summary).not.toMatch(/I am currently|kitchen operations/i);
    expect(localStorage.getItem('cvpro-ai-usage')).toBeNull();
  });

  it('English control with Corporate Navy still exports', async () => {
    const enSummary =
      'I am a baker with nearly two years of experience at Ztrew since January 2024. I prepare dishes according to restaurant standards, collaborate with the kitchen team, and maintain workplace hygiene. My key skills include presentation skills, leadership, organization, critical thinking, adaptability, problem solving and time management.';
    const hydrated = loadCvDraftAfterPersist(legacyCorporateNavySave({
      summary: enSummary,
      contentLocale: 'en',
      region: 'EU',
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: EN_DUTIES,
        originalUserDescription: EN_DUTIES,
        canonicalDescription: EN_DUTIES,
        descriptionOrigin: 'user',
      }],
      summaryOrigin: 'user',
      canonicalSummary: enSummary,
      canonicalSnapshot: undefined,
      localizedProjections: undefined,
    }));
    mockBrowserDownload();
    await expect(exportCorporateNavyPdf(hydrated, 'EN-Control', 'en')).resolves.toMatchObject({
      result: 'saved',
    });
    await expect(exportToDOCX(hydrated, 'EN-Control', 'en', 'corporate-navy')).resolves.toMatchObject({
      result: 'saved',
    });
  }, 30_000);

  it('50× cold serialized loads export PDF and DOCX with zero flakes and zero AI', async () => {
    for (let run = 0; run < 50; run += 1) {
      localStorage.clear();
      const hydrated = loadCvDraftAfterPersist(legacyCorporateNavySave({
        region: run % 2 === 0 ? undefined : ('international' as never),
      }));
      expect(hydrated.region, `region run ${run}`).toBe('EU');
      const pdfPrep = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
      const docxPrep = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF });
      expect(pdfPrep.cv.summary, `pdf summary run ${run}`).toBe(SUMMARY);
      expect(docxPrep.cv.summary, `docx summary run ${run}`).toBe(SUMMARY);
      expect(pdfPrep.projection.localizedSummary, `projection run ${run}`)
        .toBe(docxPrep.projection.localizedSummary);

      mockBrowserDownload();
      const pdf = await exportCorporateNavyPdf(hydrated, `run-${run}`, 'hi');
      const docx = await exportToDOCX(hydrated, `run-${run}`, 'hi', 'corporate-navy');
      expect(pdf.result, `pdf save run ${run}`).toBe('saved');
      expect(docx.result, `docx save run ${run}`).toBe('saved');
      expect(localStorage.getItem('cvpro-ai-usage'), `AI run ${run}`).toBeNull();
    }
  }, 180_000);

  it('migration v2 normalizes region and is idempotent', () => {
    const { cv, trace } = normalizeLegacyCvRuntimeWithTrace(
      legacyCorporateNavySave({ region: 'international' as never }),
      'hi',
    );
    expect(trace.applied).toBe(true);
    expect(trace.toVersion).toBe(CV_RUNTIME_MIGRATION_VERSION);
    expect(cv.region).toBe('EU');
    const second = normalizeLegacyCvRuntimeWithTrace(cv, 'hi');
    expect(second.trace.applied).toBe(false);
    expect(second.cv.region).toBe('EU');
  });
});
