/**
 * @vitest-environment jsdom
 *
 * Build 245: Modern Minimal Hindi legacy CV (exact device shape).
 * Corporate Navy tests do not cover this path — MM uses shared pre-template
 * recovery, not prepareCorporateNavyExport.
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
import { prepareLegacyRecoveredFinalLocaleSafeCv } from '@/lib/prepare-legacy-recovered-export';
import {
  recoverLegacyExperienceGrounding,
  LEGACY_RECOVERED_DISPLAY_DUTIES,
} from '@/lib/cv-legacy-grounding-recovery';
import { recoverSemanticDutiesFromDisplayText } from '@/lib/cv-semantic-duty-facts';
import { resolveCanonicalExperienceDescription } from '@/lib/cv-export-integrity';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { prepareCorporateNavyExport } from '@/lib/corporate-navy-export-integrity';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { exportModernMinimalPdf, exportToDOCX, exportCorporateNavyPdf } from '@/lib/export';

const REF = '2026-07-17';
const HI_DUTIES = [
  'रेस्तराँ के मानकों के अनुसार व्यंजन तैयार कर रही हूँ।',
  'कार्यस्थल की स्वच्छता बनाए रखती हूँ और रसोई टीम के साथ मिलकर काम कर रही हूँ।',
].join('\n');
const SUMMARY =
  'मैं लगभग ढाई वर्षों के अनुभव वाली बेकर हूँ और जनवरी 2024 से Ztrew में कार्यरत हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, रसोई टीम के साथ सहयोग करती हूँ और कार्यस्थल की स्वच्छता बनाए रखती हूँ। मेरे प्रमुख कौशलों में प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन शामिल हैं।';
const EN_SHELLS = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');
const EXPECTED_DUTY_KEYS = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
];

function mmLegacy(overrides: Record<string, unknown> = {}): CVData {
  return {
    id: 'mm-build-245',
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
    contentLocale: 'hi',
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
      // Essential: no originalUserDescription, no canonicalSnapshot.
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
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: 'hi',
    runtimeMigrationVersion: 3,
    ...overrides,
  } as CVData;
}

function mockDownload() {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://b245/${blobs.length}`;
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

describe('Build 245 Modern Minimal legacy grounding', () => {
  beforeEach(() => localStorage.clear());

  it('Test A — exact legacy shape recovers and exports PDF/DOCX on first attempt', async () => {
    const raw = mmLegacy();
    expect(raw.templateId).toBe('modern-minimal');
    expect(raw.experience[0].originalUserDescription).toBeUndefined();
    expect(raw.canonicalSnapshot).toBeUndefined();
    expect(raw.experience[0].canonicalDescription).toBeUndefined();
    expect(raw.experience[0].descriptionOrigin).toBe('ai_generated');
    expect(raw.runtimeMigrationVersion).toBe(3);
    expect(resolveCanonicalExperienceDescription(raw.experience[0])).toBe('');

    const emptyFacts = buildCvCanonicalFactSet({
      ...raw,
      experience: raw.experience.map((exp) => ({
        ...exp,
        description: resolveCanonicalExperienceDescription(exp),
      })),
      summary: '',
    });
    expect(emptyFacts.facts.filter((f) => f.type === 'experience_bullet')).toHaveLength(0);
    expect(recoverSemanticDutiesFromDisplayText(HI_DUTIES).duties.map((d) => d.key))
      .toEqual(EXPECTED_DUTY_KEYS);

    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    const { cv, diagnostics } = prepareLegacyRecoveredFinalLocaleSafeCv(raw, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });

    expect(diagnostics.recoveryInvoked).toBe(true);
    expect(diagnostics.experienceSourcesBefore).toContain('legacy_recovered_display_duties');
    expect(diagnostics.experienceSourcesAfter).toEqual(['legacy_recovered_display_duties']);
    expect(diagnostics.recoveredDutyKeys).toEqual(EXPECTED_DUTY_KEYS);
    expect(cv.experience[0].originalUserDescription).toBe(EN_SHELLS);
    expect(cv.experience[0].groundingRecoverySource).toBe(LEGACY_RECOVERED_DISPLAY_DUTIES);
    expect(
      diagnostics.summaryInitialReason === 'valid'
      || diagnostics.summaryRecoverySource === 'deterministic_authoritative_facts',
    ).toBe(true);

    const summaryUsed = cv.summary;
    expect(summaryUsed).toBeTruthy();
    expect(/भंडारण|स्टॉक|storage|inventory|cuisine type/i.test(summaryUsed)).toBe(false);

    const blobs = mockDownload();
    const pdf = await exportModernMinimalPdf(cv, 'Ivan-Grozni-CV', 'hi');
    const docx = await exportToDOCX(cv, 'Ivan-Grozni-CV', 'hi', 'modern-minimal');
    expect(pdf).toMatchObject({ result: 'saved' });
    expect(docx).toMatchObject({ result: 'saved' });
    expect(blobs[0].size).toBeGreaterThan(0);
    expect(blobs[1].size).toBeGreaterThan(0);

    const pdfPrep = prepareLegacyRecoveredFinalLocaleSafeCv(raw, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const docxPrep = prepareLegacyRecoveredFinalLocaleSafeCv(raw, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(pdfPrep.cv.summary).toBe(docxPrep.cv.summary);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);
  }, 60_000);

  it('Test B — recovered duties are not overwritten by a later stale merge', () => {
    const raw = mmLegacy();
    const recovered = recoverLegacyExperienceGrounding(raw);
    expect(recovered.invoked).toBe(true);
    expect(recovered.recoveredDutyKeys).toEqual([
      'food_preparation',
      'hygiene_workplace',
      'kitchen_collaboration',
    ]);

    const prepared = prepareLegacyRecoveredFinalLocaleSafeCv(raw, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.diagnostics.recoveredDutyKeys).toEqual(EXPECTED_DUTY_KEYS);
    expect(prepared.cv.experience[0].originalUserDescription).toBe(EN_SHELLS);

    // Simulate a Modern Minimal merge that only spreads template fields — must
    // not restore empty authoritative grounding.
    const merged: CVData = {
      ...raw,
      ...prepared.cv,
      experience: prepared.cv.experience.map((exp) => ({ ...exp })),
      templateId: 'modern-minimal',
    };
    expect(resolveCanonicalExperienceDescription(merged.experience[0])).toBe(EN_SHELLS);
    const factSet = buildCvCanonicalFactSet({
      ...merged,
      experience: merged.experience.map((exp) => ({
        ...exp,
        description: resolveCanonicalExperienceDescription(exp),
      })),
      summary: '',
    });
    expect(factSet.facts.filter((f) => f.type === 'experience_bullet')).toHaveLength(3);
  });

  it('Test C — persistence / reload keeps repaired metadata exportable', async () => {
    const prepared = prepareLegacyRecoveredFinalLocaleSafeCv(mmLegacy(), 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const state = {
      ...mmLegacy(),
      region: prepared.cv.region,
      runtimeMigrationVersion: prepared.cv.runtimeMigrationVersion,
      experience: mmLegacy().experience.map((exp) => ({
        ...exp,
        originalUserDescription: prepared.cv.experience[0].originalUserDescription,
        canonicalDescription: prepared.cv.experience[0].canonicalDescription,
        groundingRecoverySource: prepared.cv.experience[0].groundingRecoverySource,
        descriptionOrigin: prepared.cv.experience[0].descriptionOrigin,
      })),
    };
    const cvRef = { current: prepared.cv };
    saveCvDraft({ cv: state, savedAt: new Date().toISOString() });
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, JSON.stringify({
      cv: state,
      savedAt: new Date().toISOString(),
      schemaVersion: 1,
    }));
    const reloaded = loadCvDraft()!.cv;
    expect(reloaded.experience[0].originalUserDescription).toBe(EN_SHELLS);
    expect(cvRef.current.experience[0].originalUserDescription).toBe(EN_SHELLS);

    mockDownload();
    const pdf2 = await exportModernMinimalPdf(
      prepareLegacyRecoveredFinalLocaleSafeCv(reloaded, 'hi', {
        gender: 'female',
        referenceDate: REF,
      }).cv,
      'Ivan-Grozni-CV',
      'hi',
    );
    const docx2 = await exportToDOCX(
      prepareLegacyRecoveredFinalLocaleSafeCv(reloaded, 'hi', {
        gender: 'female',
        referenceDate: REF,
      }).cv,
      'Ivan-Grozni-CV',
      'hi',
      'modern-minimal',
    );
    expect(pdf2.result).toBe('saved');
    expect(docx2.result).toBe('saved');
  }, 60_000);

  it('Test D — unsafe generated display is not recovered', () => {
    const unsafe = mmLegacy({
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: 'मैं भंडारण और नेतृत्व के साथ कार्य करती हूँ और efficiency बढ़ाती हूँ।',
        generatedDescription: 'मैं भंडारण और नेतृत्व के साथ कार्य करती हूँ और efficiency बढ़ाती हूँ।',
        generatedLocale: 'hi',
        descriptionOrigin: 'ai_generated',
      }],
      summary: 'मैं बेकर हूँ और भंडारण तथा नेतृत्व में माहिर हूँ।',
    });
    expect(recoverSemanticDutiesFromDisplayText(unsafe.experience[0].description).duties).toEqual([]);
    expect(() => prepareLegacyRecoveredFinalLocaleSafeCv(unsafe as CVData, 'hi', {
      gender: 'female',
      referenceDate: REF,
    })).toThrow(/legacy_export_recovery_no_safe_duties|summary_fact_set_missing_recovered_duties|summary_validation_failed_after_recovery|legacy_grounding_recovery_empty|summary_authoritative_fact_set_empty|summary_recovery_projection_failed/);
  });

  it('Test E — modern provenance / English MM / CN / CA controls remain green', async () => {
    const modern = mmLegacy({
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: EN_SHELLS,
        originalUserDescription: EN_SHELLS,
        canonicalDescription: EN_SHELLS,
        descriptionOrigin: 'user',
      }],
      summary: 'Experienced baker with approximately two years of experience preparing dishes, maintaining workplace hygiene, and collaborating with the kitchen team.',
      contentLocale: 'en',
      summaryOrigin: 'user',
      summaryGeneratedLocale: undefined,
    });
    const modernPrep = prepareLegacyRecoveredFinalLocaleSafeCv(modern as CVData, 'en', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(modernPrep.cv.experience[0].originalUserDescription).toBe(EN_SHELLS);
    expect(modernPrep.cv.experience[0].groundingRecoverySource).toBeUndefined();

    mockDownload();
    const enPdf = await exportModernMinimalPdf(modernPrep.cv, 'en-mm', 'en');
    const enDocx = await exportToDOCX(modernPrep.cv, 'en-mm', 'en', 'modern-minimal');
    expect(enPdf.result).toBe('saved');
    expect(enDocx.result).toBe('saved');

    const cn = {
      ...mmLegacy({ templateId: 'corporate-navy' }),
      experience: [{
        ...mmLegacy().experience[0],
        description: [
          'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ।',
          'मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ।',
          'मैं रसोई टीम के साथ सहयोग करती हूँ।',
        ].join('\n'),
        generatedDescription: [
          'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ।',
          'मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ।',
          'मैं रसोई टीम के साथ सहयोग करती हूँ।',
        ].join('\n'),
      }],
    } as CVData;
    const cnShared = prepareLegacyRecoveredFinalLocaleSafeCv(cn, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const cnPrep = prepareCorporateNavyExport(cnShared.cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(cnPrep.cv.summary).toBeTruthy();
    const cnPdf = await exportCorporateNavyPdf(cnPrep.cv, 'cn-hi', 'hi');
    expect(cnPdf.result).toBe('saved');

    const ca = {
      ...mmLegacy({ templateId: 'creative-artistic' }),
      experience: cn.experience,
    } as CVData;
    const caShared = prepareLegacyRecoveredFinalLocaleSafeCv(ca, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const caPrep = prepareCreativeArtisticExport(caShared.cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(caPrep.cv.summary).toBeTruthy();
  }, 90_000);

  it('50× cold Modern Minimal legacy export with zero flakes', async () => {
    mockDownload();
    for (let i = 0; i < 50; i += 1) {
      localStorage.clear();
      const raw = mmLegacy({ id: `mm-cold-${i}` });
      expect(resolveCanonicalExperienceDescription(raw.experience[0])).toBe('');
      const prepared = prepareLegacyRecoveredFinalLocaleSafeCv(raw, 'hi', {
        gender: 'female',
        referenceDate: REF,
      });
      expect(prepared.diagnostics.recoveredDutyKeys).toEqual(EXPECTED_DUTY_KEYS);
      const pdf = await exportModernMinimalPdf(prepared.cv, `cold-${i}`, 'hi');
      const docx = await exportToDOCX(prepared.cv, `cold-${i}`, 'hi', 'modern-minimal');
      expect(pdf.result).toBe('saved');
      expect(docx.result).toBe('saved');
      expect(prepared.cv.summary).toBeTruthy();
    }
  }, 180_000);
});
