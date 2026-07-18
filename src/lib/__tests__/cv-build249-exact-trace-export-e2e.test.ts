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
  buildExportReadySnapshotId,
  fingerprintText,
} from '@/lib/cv-export-diagnostics';
import { exportModernMinimalPdf, exportToDOCX } from '@/lib/export';
import { validateMaterialDutyCoverage } from '@/lib/cv-material-duty-coverage';
import { buildConciseGroundedSummary } from '@/lib/cv-summary-grounding';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';

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

  it('prepareExportReadyCv projects Hindi Experience + Summary with all three facts', () => {
    const raw = exactTraceFixture();
    const canonicalBefore = raw.experience[0].canonicalDescription;
    const originalBefore = raw.experience[0].originalUserDescription;
    const snapshotBefore = JSON.stringify(raw.canonicalSnapshot);

    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const scripts = splitExperienceBullets(prepared.cv.experience[0].description)
      .map(classifyBulletScript);
    expect(scripts.every((s) => s === 'hi')).toBe(true);
    expect(scripts.some((s) => s === 'en')).toBe(false);
    expect(scripts.length).toBeGreaterThanOrEqual(2);
    expect(scripts.length).toBeLessThanOrEqual(3);

    const desc = prepared.cv.experience[0].description;
    expect(desc).toMatch(/व्यंजन|तैयार/);
    expect(desc).toMatch(/स्वच्छ/);
    expect(desc).toMatch(/रसोई|सहयोग/);

    expect(prepared.diagnostics.summarySemanticDutyKeys).toEqual([...SEMANTIC_KEYS]);
    expect(prepared.diagnostics.summaryFactSetSource).toBe('semantic_duties');
    expect(prepared.cv.contentLocale).toBe('hi');
    expect(prepared.cv.summaryGeneratedLocale).toBe('hi');
    // Historical provenance locale may remain sr on the stored experience.
    expect(prepared.cv.experience[0].generatedLocale).toBe('sr');
    expect(prepared.cv.summary).toMatch(/रसोई टीम के साथ सहयोग|सहयोग करती हूँ/);
    expect(prepared.cv.summary).not.toMatch(/\bI am a Baker\b/);

    // Canonical user facts unchanged.
    expect(prepared.cv.experience[0].canonicalDescription).toBe(canonicalBefore);
    expect(prepared.cv.experience[0].originalUserDescription).toBe(originalBefore);
    expect(JSON.stringify(prepared.cv.canonicalSnapshot)).toBe(snapshotBefore);

    expect(prepared.diagnostics.summaryInitialValid).toBe(false);
    expect(prepared.diagnostics.summaryInitialReason).toBe('mixed_locale_summary');
    expect(prepared.diagnostics.summaryRecoverySource).toBe('deterministic_semantic_facts');
  });

  it('PDF and DOCX share one exportReadySnapshotId and produce non-empty blobs', async () => {
    const raw = exactTraceFixture();
    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const blobs = mockDownload();
    const pdfSave = await exportModernMinimalPdf(prepared.cv, 'trace-249', 'hi');
    expect(pdfSave.result === 'saved' || pdfSave.result === 'shared' || pdfSave.result === 'downloaded').toBe(true);
    const pdfBlob = blobs[blobs.length - 1];
    expect(pdfBlob).toBeInstanceOf(Blob);
    expect(pdfBlob.size).toBeGreaterThan(0);

    const docxBefore = blobs.length;
    const docxSave = await exportToDOCX(prepared.cv, 'trace-249', 'hi');
    expect(docxSave.result === 'saved' || docxSave.result === 'shared' || docxSave.result === 'downloaded').toBe(true);
    expect(blobs.length).toBeGreaterThan(docxBefore);
    const docxBlob = blobs[blobs.length - 1];
    expect(docxBlob).toBeInstanceOf(Blob);
    expect(docxBlob.size).toBeGreaterThan(0);

    const pdfTrace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: true,
      blobProduced: true,
      blobSize: pdfBlob.size,
      androidSaveReached: true,
      saveResult: pdfSave,
    });
    const docxTrace = buildAndStoreCvExportDiagnostic({
      format: 'docx',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: true,
      blobProduced: true,
      blobSize: docxBlob.size,
      androidSaveReached: true,
      saveResult: docxSave,
    });

    expect(pdfTrace.exportReadySnapshotId).toBe(docxTrace.exportReadySnapshotId);
    expect(pdfTrace.exportReadySnapshotId).toBeTruthy();
    expect(pdfTrace.experiences[0].finalBulletScripts.every((s) => s === 'hi')).toBe(true);
    expect(pdfTrace.summaryGeneratedLocale).toBe('hi');
    expect(pdfTrace.contentLocale).toBe('hi');
    expect(pdfTrace.summarySemanticFactKeys).toEqual([...SEMANTIC_KEYS]);
    expect(pdfTrace.ok).toBe(true);
    expect(pdfTrace.rendererReached).toBe(true);
    expect(pdfTrace.blobProduced).toBe(true);

    // validate_summary must not be ok when initial reason was mixed_locale_summary
    const validateStage = pdfTrace.stages.find((s) => s.stage === 'validate_summary');
    expect(validateStage?.result).toBe('fail');
    expect(validateStage?.reason).toBe('mixed_locale_summary');
    const recoverStage = pdfTrace.stages.find((s) => s.stage === 'recover_summary');
    expect(recoverStage?.result).toBe('ok');

    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);

    // Snapshot id formula sanity
    const expectedId = buildExportReadySnapshotId({
      templateId: 'modern-minimal',
      locale: 'hi',
      runtimeMigrationVersion: 3,
      experienceCount: 1,
      summaryHash: fingerprintText(prepared.cv.summary || ''),
      dutyKeys: [...SEMANTIC_KEYS],
    });
    expect(pdfTrace.exportReadySnapshotId).toBe(expectedId);
  });

  it('50× cold exact-trace prepare+PDF+DOCX with zero flakes', async () => {
    for (let i = 0; i < 50; i += 1) {
      clearCvExportDiagnosticsForTests();
      const raw = exactTraceFixture();
      const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
        gender: 'female',
        referenceDate: REF,
      });
      expect(prepared.ok, `run ${i} prepare`).toBe(true);
      if (!prepared.ok) return;

      const scripts = splitExperienceBullets(prepared.cv.experience[0].description)
        .map(classifyBulletScript);
      expect(scripts.every((s) => s === 'hi'), `run ${i} scripts`).toBe(true);
      expect(prepared.cv.contentLocale).toBe('hi');
      expect(prepared.cv.summaryGeneratedLocale).toBe('hi');
      expect(prepared.cv.summary).toMatch(/सहयोग/);
      expect(prepared.diagnostics.summarySemanticDutyKeys).toEqual([...SEMANTIC_KEYS]);

      const blobs = mockDownload();
      await exportModernMinimalPdf(prepared.cv, `trace-249-${i}`, 'hi');
      expect(blobs[blobs.length - 1]?.size, `run ${i} pdf`).toBeGreaterThan(0);
      await exportToDOCX(prepared.cv, `trace-249-${i}`, 'hi');
      expect(blobs[blobs.length - 1]?.size, `run ${i} docx`).toBeGreaterThan(0);
    }
  }, 180_000);
});
