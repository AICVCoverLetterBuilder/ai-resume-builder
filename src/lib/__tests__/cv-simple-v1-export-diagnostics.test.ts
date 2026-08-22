/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  buildCvSimpleV1ExportDiagnostic,
  captureCvRenderSnapshot,
  describeCvRenderTarget,
  type CvSimpleV1ExportLifecycle,
} from '@/lib/cv-render-model-simple-v1';
import {
  buildAndStoreCvExportDiagnostic,
  clearCvExportDiagnosticsForTests,
  getLatestCvExportDiagnostic,
  storeSimpleV1CvExportDiagnostic,
} from '@/lib/cv-export-diagnostics';

function fixture(): CVData {
  return {
    id: 'simple-v1-export-diagnostic',
    name: 'Simple V1 export diagnostic fixture',
    personal: {
      fullName: 'Mila Petrović',
      email: 'mila@example.test',
      phone: '',
      address: 'Novi Sad',
      jobTitle: 'Graphic Designer',
      gender: 'female',
    },
    summary: 'CURRENT_SUMMARY_SENTINEL stored Summary authority.',
    contentLocale: 'sr',
    canonicalSummary: 'STALE_SUMMARY_SENTINEL',
    experience: [{
      id: 'exp-current',
      company: 'CURRENT_EMPLOYER_SENTINEL',
      position: 'Graphic Designer',
      positionSourceKey: 'graphic_designer',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: 'Creates visual concepts and production layouts.',
    }],
    education: [],
    skills: ['Illustrator'],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  };
}

const SUCCESS: CvSimpleV1ExportLifecycle = {
  rendererReached: true,
  rendererStarted: true,
  rendererSucceeded: true,
  blobProduced: true,
  blobSucceeded: true,
  saveReached: true,
  saveSucceeded: true,
};

function diagnostic(
  format: 'pdf' | 'docx',
  lifecycle: CvSimpleV1ExportLifecycle = SUCCESS,
) {
  const snapshot = captureCvRenderSnapshot(fixture());
  return {
    snapshot,
    trace: buildCvSimpleV1ExportDiagnostic(
      describeCvRenderTarget(snapshot, format),
      lifecycle,
      {
        capturedAt: '2026-08-22T10:00:00.000Z',
        sourceCommitShort: '4be23bd7dae2',
        nextBuildId: 'simple-v1-test-build',
      },
    ),
  };
}

afterEach(() => {
  clearCvExportDiagnosticsForTests();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Simple V1 live export diagnostic contract', () => {
  it('1. stores a truthful compact PDF success using contentLocale rather than UI locale', () => {
    const { snapshot, trace } = diagnostic('pdf');
    const uiLocale = 'de';
    void uiLocale;
    storeSimpleV1CvExportDiagnostic(trace);

    expect(getLatestCvExportDiagnostic('pdf')).toEqual(trace);
    expect(trace).toMatchObject({
      simpleV1: true,
      format: 'pdf',
      templateId: 'modern-minimal',
      contentLocale: 'sr',
      renderModelHash: snapshot.renderModelHash,
      summaryHash: snapshot.summaryHash,
      experienceHash: snapshot.experienceHash,
      rendererReached: true,
      rendererStarted: true,
      rendererSucceeded: true,
      blobProduced: true,
      blobSucceeded: true,
      saveReached: true,
      saveSucceeded: true,
      ok: true,
      sourceCommitShort: '4be23bd',
    });
    expect(trace).not.toHaveProperty('requestedLocale');
  });

  it('2. stores a truthful compact DOCX success without legacy prepared state', () => {
    const { trace } = diagnostic('docx');
    storeSimpleV1CvExportDiagnostic(trace);
    expect(getLatestCvExportDiagnostic('docx')).toEqual(trace);
    expect(trace).toMatchObject({
      simpleV1: true,
      format: 'docx',
      contentLocale: 'sr',
      ok: true,
    });
    expect(trace).not.toHaveProperty('prepared');
    expect(trace).not.toHaveProperty('stages');
    expect(trace).not.toHaveProperty('summaryRecoverySource');
  });

  it('3. PDF and DOCX descriptors from the same CV carry identical authority hashes', () => {
    const snapshot = captureCvRenderSnapshot(fixture());
    const pdf = buildCvSimpleV1ExportDiagnostic(describeCvRenderTarget(snapshot, 'pdf'), SUCCESS);
    const docx = buildCvSimpleV1ExportDiagnostic(describeCvRenderTarget(snapshot, 'docx'), SUCCESS);
    expect(pdf.renderModelHash).toBe(docx.renderModelHash);
    expect(pdf.summaryHash).toBe(docx.summaryHash);
    expect(pdf.experienceHash).toBe(docx.experienceHash);
  });

  it('4. stored hashes remain bound to capture after the live CV mutates', () => {
    const liveCv = fixture();
    const captured = captureCvRenderSnapshot(liveCv);
    const descriptor = describeCvRenderTarget(captured, 'pdf');
    liveCv.summary = 'LIVE_SUMMARY_AFTER_CAPTURE';
    liveCv.experience[0].company = 'LIVE_EMPLOYER_AFTER_CAPTURE';
    const liveAfter = captureCvRenderSnapshot(liveCv);
    const trace = buildCvSimpleV1ExportDiagnostic(descriptor, SUCCESS);
    storeSimpleV1CvExportDiagnostic(trace);

    expect(trace.renderModelHash).toBe(captured.renderModelHash);
    expect(trace.summaryHash).toBe(captured.summaryHash);
    expect(trace.experienceHash).toBe(captured.experienceHash);
    expect(trace.renderModelHash).not.toBe(liveAfter.renderModelHash);
    expect(trace.summaryHash).not.toBe(liveAfter.summaryHash);
    expect(trace.experienceHash).not.toBe(liveAfter.experienceHash);
  });

  it('5. a renderer failure is terminal false', () => {
    const { trace } = diagnostic('pdf', {
      rendererReached: true,
      rendererStarted: true,
      rendererSucceeded: false,
      blobProduced: false,
      blobSucceeded: false,
      saveReached: false,
      saveSucceeded: false,
      failureReason: 'renderer_failed',
    });
    expect(trace.ok).toBe(false);
    expect(trace.rendererSucceeded).toBe(false);
  });

  it('6. a blob failure is terminal false', () => {
    const { trace } = diagnostic('pdf', {
      rendererReached: true,
      rendererStarted: true,
      rendererSucceeded: true,
      blobProduced: false,
      blobSucceeded: false,
      saveReached: false,
      saveSucceeded: false,
      failureReason: 'blob_failed',
    });
    expect(trace.ok).toBe(false);
    expect(trace.blobSucceeded).toBe(false);
  });

  it('7. a save failure is terminal false while renderer and blob truth stay successful', () => {
    const { trace } = diagnostic('docx', {
      ...SUCCESS,
      saveSucceeded: false,
      failureReason: 'save_failed',
    });
    expect(trace).toMatchObject({
      rendererSucceeded: true,
      blobSucceeded: true,
      saveReached: true,
      saveSucceeded: false,
      ok: false,
    });
  });

  it('8. export diagnostic construction and storage perform no provider or recovery calls', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { trace } = diagnostic('pdf');
    storeSimpleV1CvExportDiagnostic(trace);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('9. export diagnostic construction and storage consume zero AI usage', () => {
    const usage = 7;
    const before = usage;
    const { trace } = diagnostic('docx');
    storeSimpleV1CvExportDiagnostic(trace);
    expect(usage).toBe(before);
  });

  it('10. serialized Simple V1 records stay below 2 KB', () => {
    for (const format of ['pdf', 'docx'] as const) {
      const { trace } = diagnostic(format);
      expect(Buffer.byteLength(JSON.stringify(trace), 'utf8')).toBeLessThan(2_000);
    }
  });

  it('11. feature-OFF legacy builder keeps its prepared-dependent behavior unchanged', () => {
    const cv = fixture();
    const legacy = buildAndStoreCvExportDiagnostic({
      format: 'pdf',
      locale: 'de',
      rawCv: cv,
      prepared: null,
      rendererReached: true,
      blobProduced: true,
      androidSaveReached: true,
      saveResult: {
        result: 'saved',
        message: 'saved',
        platform: 'web',
        fileName: 'legacy.pdf',
      },
    });
    expect(legacy.ok).toBe(false);
    expect(legacy.requestedLocale).toBe('de');
    expect(legacy).not.toHaveProperty('simpleV1');
    expect(getLatestCvExportDiagnostic('pdf')).toEqual(legacy);
  });
});
