/**
 * @vitest-environment jsdom
 *
 * Build 249 exact diagnostic-trace regression:
 * modern provenance + stale locale metadata + English display bullets
 * must become one Hindi export-ready snapshot for PDF and DOCX.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import { validateSummaryExportCandidate } from '@/lib/cv-export-integrity';
import { buildCvCanonicalFactSet, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  internalShellsFromSemanticDuties,
  resolveExperienceSemanticGrounding,
} from '@/lib/cv-semantic-duty-facts';
import {
  buildAndStoreCvExportDiagnostic,
  classifyBulletScript,
  clearCvExportDiagnosticsForTests,
} from '@/lib/cv-export-diagnostics';
import { validateMaterialDutyCoverage } from '@/lib/cv-material-duty-coverage';
import { buildConciseGroundedSummary } from '@/lib/cv-summary-grounding';
import { prepareExportReadyCv, unwrapExportReadyCv } from '@/lib/prepare-export-ready-cv';

const REF = '2026-07-17';
const EN_SHELLS = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');
const EN_DISPLAY = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene and collaborate with the kitchen team.',
].join('\n');
const SUMMARY_EN =
  'I am a Baker with about two years of experience. I prepare dishes according to restaurant standards, maintain workplace hygiene, and collaborate with the kitchen team. My key skills include Organization, Adaptability, Problem Solving and Time Management.';
const SEMANTIC_KEYS = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
] as const;

function exactTraceFixture(): CVData {
  return {
    id: 'trace-249-exact',
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
    summary: SUMMARY_EN,
    contentLocale: 'en',
    summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: 'en',
    experience: [{
      id: 'exp-1',
      position: 'Baker',
      company: 'Ztrew',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: EN_DISPLAY,
      generatedDescription: EN_DISPLAY,
      originalUserDescription: EN_SHELLS,
      canonicalDescription: EN_SHELLS,
      descriptionOrigin: 'ai_generated',
      generatedLocale: 'sr',
    }],
    education: [],
    skills: ['Organization', 'Adaptability', 'Problem Solving', 'Time Management'],
    certifications: [],
    languages: [{ name: 'English', level: 'native' }],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    runtimeMigrationVersion: 3,
    canonicalSnapshot: {
      schemaVersion: 1,
      frozenAt: '2025-01-01T00:00:00.000Z',
      canonicalLocale: 'en',
      personal: { fullName: 'Ivan Grozni', jobTitle: 'Baker' },
      summary: '',
      experience: [{
        id: 'exp-1',
        company: 'Ztrew',
        position: 'Baker',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: EN_SHELLS,
      }],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
    },
  } as CVData;
}

function mockDownload() {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://b249/${blobs.length}`;
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

describe('Build 249 exact diagnostic-trace export fix', () => {
  beforeEach(() => {
    clearCvExportDiagnosticsForTests();
    localStorage.clear();
  });

  it('documents the exact broken input state from the device trace', () => {
    const raw = exactTraceFixture();
    const scripts = splitExperienceBullets(raw.experience[0].description).map(classifyBulletScript);
    expect(scripts).toEqual(['en', 'en']);
    expect(raw.experience[0].generatedLocale).toBe('sr');
    expect(raw.summaryGeneratedLocale).toBe('en');
    expect(raw.contentLocale).toBe('en');
    expect(raw.runtimeMigrationVersion).toBe(3);
    expect(raw.templateId).toBe('modern-minimal');

    const grounding = resolveExperienceSemanticGrounding(raw.experience[0]);
    expect(grounding.source).toBe('modern_provenance');
    expect(grounding.duties.map((d) => d.key)).toEqual([...SEMANTIC_KEYS]);

    const shells = internalShellsFromSemanticDuties(grounding.duties);
    const factSet = buildCvCanonicalFactSet({
      ...raw,
      experience: raw.experience.map((e) => ({ ...e, description: shells })),
      summary: '',
    });
    const initial = validateSummaryExportCandidate(
      SUMMARY_EN,
      factSet,
      'hi',
      'female',
      '',
      undefined,
      raw,
    );
    expect(initial.valid).toBe(false);
    expect(initial.reason).toBe('mixed_locale_summary');

    // Combined hygiene+collab line used to drop kitchen_collaboration from
    // deterministic Summary fragments when classified as hygiene alone.
    const twoLineFacts = buildCvCanonicalFactSet({
      ...raw,
      experience: raw.experience.map((e) => ({ ...e, description: EN_DISPLAY })),
      summary: '',
    });
    const duration = buildExperienceDurationSnapshot(raw.experience, REF).total;
    const brokenStyle = buildConciseGroundedSummary(twoLineFacts, 'hi', 'female', duration, {
      includeSkills: true,
    });
    // After fix: combined line still preserves collaboration in the Summary.
    expect(brokenStyle).toMatch(/रसोई|सहयोग/);
    const coverage = validateMaterialDutyCoverage(EN_SHELLS, brokenStyle);
    expect(coverage.missing).not.toContain('kitchen_collaboration');
  });

  it('prepareExportReadyCv replaces the mixed-locale Summary with a grounded Hindi snapshot without mutating source state', () => {
    const raw = exactTraceFixture();
    const sourceBefore = JSON.stringify(raw);
    const usageBefore = localStorage.getItem('cvpro-ai-usage');
    localStorage.setItem('cvpro-cvs', 'persisted-cv-sentinel');
    const persistedBefore = localStorage.getItem('cvpro-cvs');

    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared, JSON.stringify(prepared, null, 2)).toMatchObject({
      ok: true,
      diagnostics: {
        selectedTemplateId: 'modern-minimal',
        requestedLocale: 'hi',
        experienceCount: 1,
        summaryInitialValid: false,
        summaryInitialReason: 'mixed_locale_summary',
        summaryRecoverySource: 'deterministic_semantic_facts',
        summaryRecoveryReason: 'valid',
        summaryMaterialCoverageResult: 'complete',
        stage: 'complete',
      },
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(`${prepared.reason} @ ${prepared.stage}`);
    expect(prepared.cv.contentLocale).toBe('hi');
    expect(prepared.cv.summaryGeneratedLocale).toBe('hi');
    expect(prepared.cv.summary).toMatch(/[\u0900-\u097F]/u);
    expect(validateMaterialDutyCoverage(EN_SHELLS, prepared.cv.summary).missing).toEqual([]);
    expect(JSON.stringify(raw)).toBe(sourceBefore);
    expect(raw.summary).toBe(SUMMARY_EN);
    expect(raw.experience[0].description).toBe(EN_DISPLAY);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(usageBefore);
    expect(localStorage.getItem('cvpro-cvs')).toBe(persistedBefore);
  });

  it('the recovered snapshot is eligible for both PDF and DOCX without usage/persistence side effects', () => {
    const raw = exactTraceFixture();
    const sourceBefore = JSON.stringify(raw);
    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    localStorage.setItem('cvpro-cvs', 'persisted-cv-sentinel');
    const persistedBefore = localStorage.getItem('cvpro-cvs');
    const blobs = mockDownload();
    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.ok, JSON.stringify(prepared, null, 2)).toBe(true);
    const exportReadyCv = unwrapExportReadyCv(prepared);
    expect(exportReadyCv.summary).toMatch(/[\u0900-\u097F]/u);
    expect(validateMaterialDutyCoverage(EN_SHELLS, exportReadyCv.summary).missing).toEqual([]);

    const pdfTrace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: true,
      blobProduced: true,
      androidSaveReached: false,
    });
    const docxTrace = buildAndStoreCvExportDiagnostic({
      format: 'docx',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: true,
      blobProduced: true,
      androidSaveReached: false,
    });

    expect(pdfTrace.ok).toBe(true);
    expect(pdfTrace.rendererReached).toBe(true);
    expect(pdfTrace.blobProduced).toBe(true);
    expect(docxTrace.ok).toBe(true);
    expect(docxTrace.rendererReached).toBe(true);
    expect(docxTrace.blobProduced).toBe(true);
    const validateStage = pdfTrace.stages.find((s) => s.stage === 'validate_summary');
    const recoveryStage = pdfTrace.stages.find((s) => s.stage === 'recover_summary');
    expect(validateStage?.result).toBe('fail');
    expect(validateStage?.reason).toBe('mixed_locale_summary');
    expect(recoveryStage?.result).toBe('ok');
    expect(blobs).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(JSON.stringify(raw)).toBe(sourceBefore);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);
    expect(localStorage.getItem('cvpro-cvs')).toBe(persistedBefore);
  });

  it('50× cold exact-trace preparation deterministically produces the same safe Hindi recovery', () => {
    const blobs = mockDownload();
    const usageBefore = localStorage.getItem('cvpro-ai-usage');
    for (let i = 0; i < 50; i += 1) {
      clearCvExportDiagnosticsForTests();
      const raw = exactTraceFixture();
      const sourceBefore = JSON.stringify(raw);
      const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
        gender: 'female',
        referenceDate: REF,
      });
      expect(prepared.ok, `run ${i} prepare: ${JSON.stringify(prepared)}`).toBe(true);
      if (!prepared.ok) throw new Error(`run ${i}: ${prepared.reason} @ ${prepared.stage}`);
      expect(prepared.cv.contentLocale, `run ${i} locale`).toBe('hi');
      expect(prepared.cv.summary, `run ${i} script`).toMatch(/[\u0900-\u097F]/u);
      expect(
        validateMaterialDutyCoverage(EN_SHELLS, prepared.cv.summary).missing,
        `run ${i} duty coverage`,
      ).toEqual([]);
      expect(JSON.stringify(raw), `run ${i} source`).toBe(sourceBefore);
    }
    expect(blobs).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(usageBefore);
  }, 180_000);
});
