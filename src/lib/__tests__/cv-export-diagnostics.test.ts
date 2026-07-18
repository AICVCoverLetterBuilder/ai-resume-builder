/**
 * @vitest-environment jsdom
 *
 * Release diagnostics for CV PDF/DOCX export — non-PII traces only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import {
  assertDiagnosticHasNoCvText,
  buildAndStoreCvExportDiagnostic,
  clearCvExportDiagnosticsForTests,
  copyCvExportDiagnosticsToClipboard,
  fingerprintText,
  formatCvExportDiagnosticForCopy,
  getLatestCvExportDiagnostic,
  resolveCvExportToastMappingKey,
} from '@/lib/cv-export-diagnostics';
import { exportModernMinimalPdf, exportToDOCX } from '@/lib/export';

const REF = '2026-07-17';
const HI_DUTIES = [
  'रेस्तराँ के मानकों के अनुसार व्यंजन तैयार कर रही हूँ।',
  'कार्यस्थल की स्वच्छता बनाए रखती हूँ और रसोई टीम के साथ मिलकर काम कर रही हूँ।',
].join('\n');
const SUMMARY =
  'मैं लगभग दो वर्षों के अनुभव वाली बेकर हूँ और जनवरी 2024 से Ztrew में कार्यरत हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, रसोई टीम के साथ सहयोग करती हूँ और कार्यस्थल की स्वच्छता बनाए रखती हूँ। मेरे प्रमुख कौशलों में संगठन, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन शामिल हैं।';

function legacyMm(overrides: Record<string, unknown> = {}): CVData {
  return {
    id: 'diag-mm',
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
      descriptionOrigin: 'ai_generated',
      generatedLocale: 'hi',
    }],
    education: [],
    skills: ['Organization', 'Adaptability', 'Problem Solving', 'Time Management'],
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
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:http://diag/1'),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

describe('CV export diagnostics (non-PII)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCvExportDiagnosticsForTests();
  });

  it('1–3. legacy Hindi MM failure produces structured stage/reason trace without CV text', () => {
    const raw = legacyMm({
      summary: 'मैं बेकर हूँ। I am currently contributing to international workplaces with guaranteed results.',
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: 'मैं भंडारण और leadership के साथ efficiency बढ़ाती हूँ।',
        generatedDescription: 'मैं भंडारण और leadership के साथ efficiency बढ़ाती हूँ।',
        descriptionOrigin: 'ai_generated',
        generatedLocale: 'hi',
      }],
    });
    const before = structuredClone(raw);
    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;

    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'hi',
      rawCv: raw,
      prepared,
      originalFailureReason: prepared.reason,
      finalError: { reason: prepared.reason },
      appVersionCode: '248',
      appVersionName: '1.0.248',
      nextBuildId: 'test-build',
    });

    expect(trace.stages.length).toBeGreaterThan(3);
    expect(trace.stages.some((s) => s.result === 'fail')).toBe(true);
    expect(trace.finalTypedFailureReason).toBeTruthy();
    expect(trace.finalTypedFailureReason).not.toMatch(/unknown|Error: undefined/i);
    expect(trace.toastMappingKey).toBeTruthy();
    expect(trace.toastMappingKey).not.toBe('UNKNOWN');
    expect(assertDiagnosticHasNoCvText(trace)).toEqual([]);
    expect(formatCvExportDiagnosticForCopy(trace)).not.toMatch(/Ivan|Ztrew|ivan@|भंडारण|Prepare dishes/i);
    // Diagnostics must not mutate CV
    expect(raw).toEqual(before);
  });

  it('4. PDF and DOCX traces share the same export-ready snapshot id for the same prepare', async () => {
    mockDownload();
    const raw = legacyMm();
    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const pdfTrace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: true,
      blobProduced: true,
      blobMimeType: 'application/pdf',
      androidSaveReached: true,
      saveResult: { result: 'saved', message: 'ok' },
      extraStages: [
        { stage: 'render_blob', result: 'ok' },
        { stage: 'android_save', result: 'ok' },
      ],
    });
    const docxTrace = buildAndStoreCvExportDiagnostic({
      format: 'docx',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: true,
      blobProduced: true,
      blobMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      androidSaveReached: true,
      saveResult: { result: 'saved', message: 'ok' },
      extraStages: [
        { stage: 'render_blob', result: 'ok' },
        { stage: 'android_save', result: 'ok' },
      ],
    });
    expect(pdfTrace.exportReadySnapshotId).toBe(docxTrace.exportReadySnapshotId);
    expect(pdfTrace.summaryHash).toBe(docxTrace.summaryHash);
  });

  it('5. successful export records Blob and Android-save stages', async () => {
    mockDownload();
    const raw = legacyMm();
    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const pdf = await exportModernMinimalPdf(prepared.cv, 'diag-pdf', 'hi');
    const docx = await exportToDOCX(prepared.cv, 'diag-docx', 'hi', 'modern-minimal');
    expect(pdf.result).toBe('saved');
    expect(docx.result).toBe('saved');

    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'hi',
      rawCv: raw,
      prepared,
      rendererReached: true,
      blobProduced: true,
      blobSize: 1234,
      blobMimeType: 'application/pdf',
      androidSaveReached: true,
      saveResult: pdf,
      extraStages: [
        { stage: 'render_blob', result: 'ok' },
        { stage: 'android_save', result: 'ok' },
      ],
    });
    expect(trace.stages.some((s) => s.stage === 'render_blob' && s.result === 'ok')).toBe(true);
    expect(trace.stages.some((s) => s.stage === 'android_save' && s.result === 'ok')).toBe(true);
    expect(trace.blobProduced).toBe(true);
    expect(trace.androidSaveReached).toBe(true);
    expect(trace.saveResult).toBe('saved');
  }, 60_000);

  it('6. Summary validation failure is never only an unknown generic error', () => {
    const key = resolveCvExportToastMappingKey(
      'summary_validation_failed_after_recovery',
      'pdf',
    );
    expect(key).toBe('SUMMARY_FACTS_REVIEW');
    const key2 = resolveCvExportToastMappingKey(
      'unsupported_summary_fact:food_preparation:foo',
      'docx',
    );
    expect(key2).toBe('SUMMARY_FACTS_REVIEW');
    const key3 = resolveCvExportToastMappingKey('mixed_locale_field', 'pdf');
    expect(key3).toBe('SUMMARY_FACTS_REVIEW');
  });

  it('7–8. copying diagnostics does not consume AI usage and does not mutate CV', async () => {
    const raw = legacyMm({
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: 'मैं भंडारण और leadership के साथ efficiency बढ़ाती हूँ।',
        generatedDescription: 'मैं भंडारण और leadership के साथ efficiency बढ़ाती हूँ।',
        descriptionOrigin: 'ai_generated',
      }],
    });
    const prepared = prepareExportReadyCv(raw, 'hi', 'modern-minimal', {
      gender: 'female',
      referenceDate: REF,
    });
    buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'hi',
      rawCv: raw,
      prepared,
      finalError: prepared.ok ? undefined : { reason: prepared.reason },
    });
    const aiBefore = localStorage.getItem('cvpro-ai-usage');
    const before = structuredClone(raw);
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
    const ok = await copyCvExportDiagnosticsToClipboard('pdf');
    expect(ok).toBe(true);
    expect(localStorage.getItem('cvpro-ai-usage')).toBe(aiBefore);
    expect(raw).toEqual(before);
    expect(getLatestCvExportDiagnostic('pdf')).toBeTruthy();
    expect(fingerprintText('abc')).not.toBe(fingerprintText('abcd'));
  });

  it('page wires PDF and DOCX through diagnostic-aware prepareExportReadyCv', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const page = fs.readFileSync(
      path.resolve('src/app/cv-builder/page.tsx'),
      'utf8',
    );
    expect(page).toContain('prepareExportReadyCv');
    expect(page).toContain('buildAndStoreCvExportDiagnostic');
    expect(page).toContain('Copy diagnostics');
    expect(page).toContain('handlePDFDownload');
    expect(page).toContain('handleDOCXDownload');
    expect(page).toContain('recordExportDiagnostic');
    expect(page).toContain('showExportFailureToast');
  });
});
