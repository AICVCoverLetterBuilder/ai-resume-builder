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

  it('prepareExportReadyCv fails closed on the unsupported generated Summary without mutating source state', () => {
    const raw = exactTraceFixture();
    const sourceBefore = JSON.stringify(raw);
    const usageBefore = localStorage.getItem('cvpro-ai-usage');
    localStorage.setItem('cvpro-cvs', 'persisted-cv-sentinel');
    const persistedBefore = localStorage.getItem('cvpro-cvs');

    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared).toMatchObject({
      ok: false,
      reason: 'summary_unsupported_domain_claims',
      stage: 'validate_summary',
      diagnostics: {
        selectedTemplateId: 'modern-minimal',
        requestedLocale: 'hi',
        experienceCount: 1,
        stage: 'validate_summary',
      },
    });
    expect('cv' in prepared).toBe(false);
    expect(JSON.stringify(raw)).toBe(sourceBefore);
    expect(raw.summary).toBe(SUMMARY_EN);
    expect(raw.experience[0].description).toBe(EN_DISPLAY);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(usageBefore);
    expect(localStorage.getItem('cvpro-cvs')).toBe(persistedBefore);
  });

  it('typed rejection prevents both PDF and DOCX rendering and preserves usage/persistence', () => {
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
    expect(prepared).toMatchObject({
      ok: false,
      reason: 'summary_unsupported_domain_claims',
      stage: 'validate_summary',
    });
    expect(() => unwrapExportReadyCv(prepared)).toThrow(
      'summary_unsupported_domain_claims @ validate_summary',
    );

    const pdfTrace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: false,
      blobProduced: false,
      androidSaveReached: false,
    });
    const docxTrace = buildAndStoreCvExportDiagnostic({
      format: 'docx',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: false,
      blobProduced: false,
      androidSaveReached: false,
    });

    expect(pdfTrace.ok).toBe(false);
    expect(pdfTrace.rendererReached).toBe(false);
    expect(pdfTrace.blobProduced).toBe(false);
    expect(docxTrace.ok).toBe(false);
    expect(docxTrace.rendererReached).toBe(false);
    expect(docxTrace.blobProduced).toBe(false);
    const validateStage = pdfTrace.stages.find((s) => s.stage === 'validate_summary');
    expect(validateStage?.result).toBe('fail');
    expect(validateStage?.reason).toBe('summary_unsupported_domain_claims');
    expect(blobs).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(JSON.stringify(raw)).toBe(sourceBefore);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);
    expect(localStorage.getItem('cvpro-cvs')).toBe(persistedBefore);
  });

  it('50× cold exact-trace preparation deterministically fails closed with zero exports', () => {
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
      expect(prepared, `run ${i} prepare`).toMatchObject({
        ok: false,
        reason: 'summary_unsupported_domain_claims',
        stage: 'validate_summary',
      });
      expect(JSON.stringify(raw), `run ${i} source`).toBe(sourceBefore);
    }
    expect(blobs).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(usageBefore);
  }, 180_000);
});
