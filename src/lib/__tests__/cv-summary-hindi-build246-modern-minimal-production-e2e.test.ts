/**
 * @vitest-environment jsdom
 *
 * Build 246 production incident: serialized legacy Modern Minimal Hindi draft
 * through real loadCvDraft → prepareExportReadyCv → PDF/DOCX blobs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  CV_DRAFT_STORAGE_KEY,
  loadCvDraft,
  saveCvDraft,
} from '@/lib/draft-storage';
import {
  prepareExportReadyCv,
} from '@/lib/prepare-export-ready-cv';
import { recoverSemanticDutiesFromDisplayText } from '@/lib/cv-semantic-duty-facts';
import { resolveCanonicalExperienceDescription } from '@/lib/cv-export-integrity';
import { exportModernMinimalPdf, exportToDOCX } from '@/lib/export';
import { formatCvExportIntegrityToast } from '@/lib/cv-export-error-message';

const REF = '2026-07-17';
const HI_DUTIES = [
  'रेस्तराँ के मानकों के अनुसार व्यंजन तैयार कर रही हूँ।',
  'कार्यस्थल की स्वच्छता बनाए रखती हूँ और रसोई टीम के साथ मिलकर काम कर रही हूँ।',
].join('\n');
const SUMMARY =
  'मैं लगभग दो वर्षों के अनुभव वाली बेकर हूँ और जनवरी 2024 से Ztrew में कार्यरत हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, रसोई टीम के साथ सहयोग करती हूँ और कार्यस्थल की स्वच्छता बनाए रखती हूँ। मेरे प्रमुख कौशलों में प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन शामिल हैं।';
const SEMANTIC_KEYS = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
] as const;

/** Exact old draft-storage schema (schemaVersion 0), no modern provenance. */
function serializeLegacyDraft(overrides: Record<string, unknown> = {}): string {
  const cv = {
    id: 'legacy-mm-246-device',
    name: 'CV',
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
    experience: [{
      id: 'exp-baker',
      position: 'Baker',
      company: 'Ztrew',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: HI_DUTIES,
      generatedDescription: HI_DUTIES,
      descriptionOrigin: 'ai_generated',
      generatedLocale: 'hi',
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
    // region intentionally missing/invalid in original serialized draft
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    runtimeMigrationVersion: 3,
    ...overrides,
  };
  return JSON.stringify({
    cv,
    savedAt: '2025-01-01T00:00:00.000Z',
    schemaVersion: 0,
  });
}

function mockDownload() {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://b246/${blobs.length}`;
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

function productionPrepare(cv: CVData) {
  return prepareExportReadyCv(cv, 'hi', 'modern-minimal', {
    gender: 'female',
    referenceDate: REF,
  });
}

describe('Build 246 Modern Minimal production path', () => {
  beforeEach(() => localStorage.clear());

  it('semantic duties: 2 Hindi lines → 3 duty keys', () => {
    const grounding = recoverSemanticDutiesFromDisplayText(HI_DUTIES);
    expect(grounding.source).toBe('legacy_recovered_display_duties');
    expect(grounding.duties.map((d) => d.key)).toEqual([...SEMANTIC_KEYS]);
    expect(grounding.duties[1].sourceClauseIndex).toBe(1);
    expect(grounding.duties[2].sourceClauseIndex).toBe(1);
  });

  it('serialized draft → load → prepare → first PDF/DOCX succeed identically', async () => {
    const rawJson = serializeLegacyDraft();
    const parsed = JSON.parse(rawJson);
    expect(parsed.cv.experience[0].originalUserDescription).toBeUndefined();
    expect(parsed.cv.canonicalSnapshot).toBeUndefined();
    expect(parsed.schemaVersion).toBe(0);

    localStorage.setItem(CV_DRAFT_STORAGE_KEY, rawJson);
    const loaded = loadCvDraft()!.cv;
    expect(loaded.templateId).toBe('modern-minimal');

    // React-equivalent state + cvRef
    const state = loaded;
    const cvRef = { current: loaded };
    expect(state).toEqual(cvRef.current);

    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    const pdfPrep = productionPrepare(cvRef.current);
    const docxPrep = productionPrepare(state);
    expect(pdfPrep.ok).toBe(true);
    expect(docxPrep.ok).toBe(true);
    if (!pdfPrep.ok || !docxPrep.ok) return;

    expect(pdfPrep.diagnostics.recoveryInvoked).toBe(true);
    expect(pdfPrep.diagnostics.summarySemanticDutyKeys).toEqual([...SEMANTIC_KEYS]);
    expect(pdfPrep.diagnostics.summaryFactSetSource).toBe('semantic_duties');
    expect(pdfPrep.cv.summary).toBe(docxPrep.cv.summary);
    expect(pdfPrep.cv.experience[0].description).toBe(HI_DUTIES);
    expect(/[A-Za-z]{4,}/.test(pdfPrep.cv.experience[0].description)).toBe(false);
    expect(
      pdfPrep.diagnostics.summaryInitialValid
      || pdfPrep.diagnostics.summaryRecoverySource === 'deterministic_semantic_facts',
    ).toBe(true);

    const blobs = mockDownload();
    const pdf = await exportModernMinimalPdf(pdfPrep.cv, 'Ivan-Grozni-CV', 'hi');
    const docx = await exportToDOCX(docxPrep.cv, 'Ivan-Grozni-CV', 'hi', 'modern-minimal');
    expect(pdf).toMatchObject({ result: 'saved' });
    expect(docx).toMatchObject({ result: 'saved' });
    expect(blobs[0].size).toBeGreaterThan(0);
    expect(blobs[1].size).toBeGreaterThan(0);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);

    // Persist repaired metadata and reload
    saveCvDraft({
      cv: {
        ...state,
        region: pdfPrep.cv.region,
        runtimeMigrationVersion: pdfPrep.cv.runtimeMigrationVersion,
        experience: state.experience.map((exp) => ({
          ...exp,
          originalUserDescription: pdfPrep.cv.experience[0].originalUserDescription,
          canonicalDescription: pdfPrep.cv.experience[0].canonicalDescription,
          groundingRecoverySource: pdfPrep.cv.experience[0].groundingRecoverySource,
          recoveredSemanticDuties: pdfPrep.cv.experience[0].recoveredSemanticDuties,
        })),
      },
      savedAt: new Date().toISOString(),
    });
    const reloaded = loadCvDraft()!.cv;
    const pdf2Prep = productionPrepare(reloaded);
    const docx2Prep = productionPrepare(reloaded);
    expect(pdf2Prep.ok && docx2Prep.ok).toBe(true);
    if (!pdf2Prep.ok || !docx2Prep.ok) return;
    const pdf2 = await exportModernMinimalPdf(pdf2Prep.cv, 'Ivan-Grozni-CV', 'hi');
    const docx2 = await exportToDOCX(docx2Prep.cv, 'Ivan-Grozni-CV', 'hi', 'modern-minimal');
    expect(pdf2.result).toBe('saved');
    expect(docx2.result).toBe('saved');
    expect(pdf2Prep.cv.summary).toBe(docx2Prep.cv.summary);
  }, 90_000);

  it('rejects unsafe legacy generated claims', () => {
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, serializeLegacyDraft({
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: 'मैं भंडारण, स्वास्थ्य मानक और leadership के साथ efficiency बढ़ाती हूँ।',
        generatedDescription: 'मैं भंडारण, स्वास्थ्य मानक और leadership के साथ efficiency बढ़ाती हूँ।',
        descriptionOrigin: 'ai_generated',
      }],
      summary: 'मैं बेकर हूँ और storage तथा management में माहिर हूँ।',
    }));
    const loaded = loadCvDraft()!.cv;
    // Clear any migration-invented grounding for this negative case
    const hostile: CVData = {
      ...loaded,
      experience: loaded.experience.map((exp) => ({
        ...exp,
        originalUserDescription: undefined,
        canonicalDescription: undefined,
        groundingRecoverySource: undefined,
        recoveredSemanticDuties: undefined,
        description: 'मैं भंडारण, स्वास्थ्य मानक और leadership के साथ efficiency बढ़ाती हूँ।',
        generatedDescription: 'मैं भंडारण, स्वास्थ्य मानक और leadership के साथ efficiency बढ़ाती हूँ।',
      })),
      canonicalSnapshot: undefined,
    };
    const result = productionPrepare(hostile);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(
      /legacy_export_recovery_no_safe_duties|summary_fact_set_missing_recovered_duties|summary_validation_failed_after_recovery/,
    );
  });

  it('mixed-language Summary is rejected or rebuilt from semantic facts', () => {
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, serializeLegacyDraft({
      summary: `${SUMMARY} I am currently contributing to international workplaces.`,
    }));
    const loaded = loadCvDraft()!.cv;
    const result = productionPrepare(loaded);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cv.summary).not.toMatch(/I am currently contributing/i);
    expect(result.diagnostics.summaryRecoverySource === 'deterministic_semantic_facts'
      || !/I am currently/i.test(result.cv.summary)).toBe(true);
  });

  it('50× cold serialized legacy export with zero flakes', async () => {
    mockDownload();
    for (let i = 0; i < 50; i += 1) {
      localStorage.clear();
      localStorage.setItem(CV_DRAFT_STORAGE_KEY, serializeLegacyDraft({ id: `cold-${i}` }));
      const loaded = loadCvDraft()!.cv;
      // Ensure cold path still sees empty resolve before prepare when provenance cleared
      const cold: CVData = {
        ...loaded,
        experience: loaded.experience.map((exp) => ({
          ...exp,
          // Keep only AI display — strip migrated shells to force export-boundary recovery
          originalUserDescription: undefined,
          canonicalDescription: undefined,
          groundingRecoverySource: undefined,
          recoveredSemanticDuties: undefined,
          description: HI_DUTIES,
          generatedDescription: HI_DUTIES,
          descriptionOrigin: 'ai_generated' as const,
          generatedLocale: 'hi',
        })),
        canonicalSnapshot: undefined,
        runtimeMigrationVersion: 3,
        region: undefined as unknown as CVData['region'],
      };
      expect(resolveCanonicalExperienceDescription(cold.experience[0])).toBe('');
      const prepared = productionPrepare(cold);
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) {
        throw new Error(`${prepared.reason} @ ${prepared.stage}`);
      }
      expect(prepared.diagnostics.summarySemanticDutyKeys).toEqual([...SEMANTIC_KEYS]);
      expect(prepared.cv.experience[0].description).toBe(HI_DUTIES);
      const pdf = await exportModernMinimalPdf(prepared.cv, `cold-${i}`, 'hi');
      const docx = await exportToDOCX(prepared.cv, `cold-${i}`, 'hi', 'modern-minimal');
      expect(pdf.result).toBe('saved');
      expect(docx.result).toBe('saved');
    }
  }, 180_000);

  it('wiring failures are not mapped to Summary content toast', () => {
    const toast = formatCvExportIntegrityToast(
      { reason: 'modern_minimal_stale_snapshot' },
      'en',
      'pdf',
    );
    expect(toast).not.toMatch(/could not be verified against the saved experience/i);
  });
});
