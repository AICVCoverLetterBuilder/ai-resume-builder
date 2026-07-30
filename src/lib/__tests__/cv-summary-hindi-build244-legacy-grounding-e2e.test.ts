/**
 * @vitest-environment jsdom
 *
 * Build 244: legacy Corporate Navy Hindi save without English snapshot.
 * Prior fixtures included canonicalSnapshot English duties — the real device
 * save often has only AI Hindi display + missing originalUserDescription, so
 * Summary grounding failed after migration v2 left experienceSources=none.
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
import { resolveCanonicalExperienceDescription } from '@/lib/cv-export-integrity';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { validateLocalizedSummary } from '@/lib/cv-semantic-fidelity';
import { formatCvExportIntegrityToast } from '@/lib/cv-export-error-message';
import { exportCorporateNavyPdf, exportToDOCX } from '@/lib/export';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';

const REF = '2026-07-17';
const SUMMARY =
  'मैं लगभग ढाई वर्षों के अनुभव वाली बेकर हूँ और जनवरी 2024 से Ztrew में कार्यरत हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, रसोई टीम के साथ सहयोग करती हूँ और कार्यस्थल की स्वच्छता बनाए रखती हूँ। मेरे प्रमुख कौशलों में प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन शामिल हैं।';
const HI_DUTIES = [
  'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ।',
  'मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ।',
  'मैं रसोई टीम के साथ सहयोग करती हूँ।',
].join('\n');
const EN_DUTIES = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');
const ACCEPTABLE_RECOVERED = [
  'मैं लगभग ढाई वर्षों के अनुभव वाली बेकर हूँ',
  'रेस्तरां',
  'व्यंजन',
  'स्वच्छता',
  'रसोई',
];

function legacyNoSnapshot(overrides: Record<string, unknown> = {}): CVData {
  return {
    id: 'legacy-build-244',
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
      // Real old schema: no originalUserDescription / descriptionOrigin /
      // generatedLocale, and either missing or AI-polluted canonical.
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
    region: undefined as unknown as CVData['region'],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    // No canonicalSnapshot — this is the build-244 gap vs prior fixtures.
    ...overrides,
  } as CVData;
}

function persist(cv: CVData) {
  localStorage.setItem(CV_DRAFT_STORAGE_KEY, JSON.stringify({
    cv,
    savedAt: '2025-01-01T00:00:00.000Z',
    schemaVersion: 0,
  }));
}

function hydrate(cv: CVData): CVData {
  persist(cv);
  return loadCvDraft()!.cv;
}

function mockDownload() {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://b244/${blobs.length}`;
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

describe('Build 244 legacy grounding recovery', () => {
  beforeEach(() => localStorage.clear());

  it('traces pre-fix empty-grounding validation failure', () => {
    // Simulate migration v2 outcome: AI-only, no authoritative duties.
    const preFix: CVData = {
      ...legacyNoSnapshot({
        region: 'EU',
        runtimeMigrationVersion: 2,
        contentLocale: 'hi',
        summaryOrigin: 'ai_generated',
        summaryGeneratedLocale: 'hi',
      }),
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
        descriptionOrigin: 'ai_generated',
      }],
    };
    expect(resolveCanonicalExperienceDescription(preFix.experience[0])).toBe('');
    const factSet = buildCvCanonicalFactSet({
      ...preFix,
      experience: preFix.experience.map((exp) => ({
        ...exp,
        description: resolveCanonicalExperienceDescription(exp),
      })),
      summary: '',
    });
    expect(factSet.facts.filter((f) => f.type === 'experience_bullet')).toHaveLength(0);
    const semantic = validateLocalizedSummary(SUMMARY, factSet, {
      locale: 'hi',
      gender: 'female',
      expectedDuration: buildExperienceDurationSnapshot(preFix.experience, REF).total,
      stage: 'export',
    });
    expect(semantic.valid).toBe(false);
    expect(semantic.violations.some((v) => v.kind === 'unsupported_summary_fact')).toBe(true);
  });

  it('migrates classified visible Hindi duties into English authoritative shells', () => {
    const { cv, trace } = normalizeLegacyCvRuntimeWithTrace(legacyNoSnapshot(), 'hi');
    expect(trace.experienceSources).toEqual(['legacy_recovered_display_duties']);
    expect(cv.runtimeMigrationVersion).toBe(CV_RUNTIME_MIGRATION_VERSION);
    expect(cv.region).toBe('EU');
    expect(cv.experience[0].originalUserDescription).toBe(EN_DUTIES);
    expect(cv.experience[0].canonicalDescription).toBe(EN_DUTIES);
    expect(cv.experience[0].description).toBe(HI_DUTIES);
    expect(cv.experience[0].descriptionOrigin).toBe('ai_generated');
    expect(resolveCanonicalExperienceDescription(cv.experience[0])).toBe(EN_DUTIES);
  });

  it('hydrates, recovers Summary, exports PDF/DOCX identically, reloads', async () => {
    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    const hydrated = hydrate(legacyNoSnapshot({ region: 'international' as never }));
    expect(hydrated.experience[0].originalUserDescription).toBe(EN_DUTIES);
    expect(hydrated.region).toBe('EU');

    const state = hydrated;
    const cvRef = { current: hydrated };
    expect(state).toEqual(cvRef.current);

    const pdfPrep = prepareCorporateNavyExport(cvRef.current, 'hi', {
      referenceDate: REF,
      gender: 'female',
    });
    const docxPrep = prepareCorporateNavyExport(state, 'hi', {
      referenceDate: REF,
      gender: 'female',
    });
    expect(pdfPrep.cv.summary).toBe(docxPrep.cv.summary);
    for (const token of ACCEPTABLE_RECOVERED) {
      expect(pdfPrep.cv.summary).toContain(token);
    }
    expect(pdfPrep.diagnostics.summaryInitialReason === 'valid'
      || pdfPrep.diagnostics.summaryRecoverySource === 'deterministic_authoritative_facts').toBe(true);

    const blobs = mockDownload();
    const pdf = await exportCorporateNavyPdf(cvRef.current, 'Ivan-Grozni-CV', 'hi');
    const docx = await exportToDOCX(state, 'Ivan-Grozni-CV', 'hi', 'corporate-navy');
    expect(pdf).toMatchObject({ result: 'saved' });
    expect(docx).toMatchObject({ result: 'saved' });
    expect(blobs[0].size).toBeGreaterThan(0);
    expect(blobs[1].size).toBeGreaterThan(0);

    saveCvDraft({ cv: hydrated, savedAt: new Date().toISOString() });
    const reloaded = loadCvDraft()!.cv;
    expect(reloaded.experience[0].originalUserDescription).toBe(EN_DUTIES);
    expect(reloaded.runtimeMigrationVersion).toBe(CV_RUNTIME_MIGRATION_VERSION);
    const pdf2 = await exportCorporateNavyPdf(reloaded, 'Ivan-Grozni-CV', 'hi');
    const docx2 = await exportToDOCX(reloaded, 'Ivan-Grozni-CV', 'hi', 'corporate-navy');
    expect(pdf2.result).toBe('saved');
    expect(docx2.result).toBe('saved');
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);
  }, 60_000);

  it('already-migrated v2 empty grounding is repaired by v3 without AI', () => {
    const v2Empty: CVData = {
      ...legacyNoSnapshot({
        region: 'EU',
        runtimeMigrationVersion: 2,
        contentLocale: 'hi',
        summaryOrigin: 'ai_generated',
        summaryGeneratedLocale: 'hi',
      }),
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
        descriptionOrigin: 'ai_generated',
      }],
    };
    const { cv, trace } = normalizeLegacyCvRuntimeWithTrace(v2Empty, 'hi');
    expect(trace.applied).toBe(true);
    expect(cv.runtimeMigrationVersion).toBe(3);
    expect(cv.experience[0].originalUserDescription).toBe(EN_DUTIES);
    const prepared = prepareCorporateNavyExport(cv, 'hi', { referenceDate: REF, gender: 'female' });
    expect(prepared.cv.summary).toMatch(/बेकर/);
    expect(prepared.cv.summary).toMatch(/व्यंजन|स्वच्छता|रसोई/);
  });

  it('genuine unsupported English prose is not accepted as Summary grounding', () => {
    const unsafe = `${SUMMARY} I am currently contributing to kitchen operations.`;
    const hydrated = hydrate(legacyNoSnapshot({ summary: unsafe, region: 'EU' }));
    const prepared = prepareCreativeArtisticExport(hydrated, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.cv.summary).not.toMatch(/I am currently|kitchen operations/i);
    expect(prepared.summaryDiagnostics?.recoverySource).toBe('deterministic_authoritative_facts');
  });

  it('50× cold loads export PDF and DOCX with zero flakes', async () => {
    for (let run = 0; run < 50; run += 1) {
      localStorage.clear();
      const hydrated = hydrate(legacyNoSnapshot({
        region: run % 2 === 0 ? undefined : ('international' as never),
        experience: [{
          id: 'exp-baker',
          position: 'Baker',
          company: 'Ztrew',
          startDate: '2024-01',
          endDate: '',
          isPresent: true,
          description: HI_DUTIES,
          generatedDescription: HI_DUTIES,
          // Alternate polluted vs missing canonical.
          ...(run % 3 === 0 ? {} : { canonicalDescription: HI_DUTIES }),
        }],
      }));
      expect(hydrated.experience[0].originalUserDescription, `orig ${run}`).toBe(EN_DUTIES);
      const pdfPrep = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF, gender: 'female' });
      const docxPrep = prepareCorporateNavyExport(hydrated, 'hi', { referenceDate: REF, gender: 'female' });
      expect(pdfPrep.cv.summary, `summary ${run}`).toBe(docxPrep.cv.summary);
      expect(pdfPrep.cv.summary, `duties ${run}`).toMatch(/व्यंजन|स्वच्छता|रसोई/);
      mockDownload();
      const pdf = await exportCorporateNavyPdf(hydrated, `r${run}`, 'hi');
      const docx = await exportToDOCX(hydrated, `r${run}`, 'hi', 'corporate-navy');
      expect(pdf.result, `pdf ${run}`).toBe('saved');
      expect(docx.result, `docx ${run}`).toBe('saved');
      expect(localStorage.getItem('cvpro-ai-usage'), `ai ${run}`).toBeNull();
    }
  }, 180_000);
});
