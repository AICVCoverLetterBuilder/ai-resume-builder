/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations, type Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { captureCvRenderSnapshot } from '@/lib/cv-render-model-simple-v1';
import {
  clearCvExportDiagnosticsForTests,
  getLatestCvExportDiagnostic,
} from '@/lib/cv-export-diagnostics';

const CURRENT = 'CURRENT_SENTINEL_NOVA_FIRMA stored editor Summary';
const STALE = 'STALE_SENTINEL_OLD_SUMMARY legacy recovery candidate';

const runtime = vi.hoisted(() => ({
  currentCv: null as CVData | null,
  aiUsage: 4,
  requests: [] as Array<Record<string, unknown>>,
  preview: null as CVData | null,
  previewLocale: '' as string,
  pdf: null as CVData | null,
  pdfLocale: '' as string,
  docx: null as CVData | null,
  docxLocale: '' as string,
  pdfOutcome: 'saved' as 'saved' | 'renderer_failure' | 'blob_failure' | 'save_failure',
  docxOutcome: 'saved' as 'saved' | 'save_failure',
  mutateLiveCvDuringPdf: false,
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'de' as Locale, t: translations.de }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: runtime.currentCv,
    setCurrentCv: (next: CVData) => { runtime.currentCv = next; },
    persistCurrentCvTransactionally: (next: CVData) => { runtime.currentCv = next; return true; },
    isPro: true,
    canDownload: () => true,
    incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: () => { runtime.aiUsage += 1; },
    getProAiUsageCount: () => runtime.aiUsage,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'm3-test-token' }),
  }),
}));
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    apiFetch: vi.fn(async (_path: string, options: { body?: Record<string, unknown> }) => {
      runtime.requests.push(options.body || {});
      throw new Error('Simple V1 rendering must not call the provider');
    }),
  };
});
vi.mock('@/lib/export', async () => {
  const actual = await vi.importActual<typeof import('@/lib/export')>('@/lib/export');
  return {
    ...actual,
    exportModernMinimalPdf: vi.fn(async (cv: CVData, fileName: string, locale: Locale) => {
      runtime.pdf = cv;
      runtime.pdfLocale = locale;
      if (runtime.mutateLiveCvDuringPdf && runtime.currentCv) {
        runtime.currentCv.summary = 'LIVE_SUMMARY_AFTER_CAPTURE';
        runtime.currentCv.experience[0].company = 'LIVE_EMPLOYER_AFTER_CAPTURE';
      }
      if (runtime.pdfOutcome === 'renderer_failure') throw new Error('renderer_failed');
      if (runtime.pdfOutcome === 'blob_failure') throw new Error('blob_failed');
      return {
        result: runtime.pdfOutcome === 'save_failure' ? 'failed' as const : 'saved' as const,
        message: runtime.pdfOutcome,
        platform: 'web' as const,
        fileName,
      };
    }),
    exportToDOCX: vi.fn(async (cv: CVData, fileName: string, locale: Locale) => {
      runtime.docx = cv;
      runtime.docxLocale = locale;
      return {
        result: runtime.docxOutcome === 'save_failure' ? 'failed' as const : 'saved' as const,
        message: runtime.docxOutcome,
        platform: 'web' as const,
        fileName,
      };
    }),
  };
});
vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));
vi.mock('@/components/cv-templates', () => ({
  templateComponents: {
    'modern-minimal': ({ data, locale }: { data: CVData; locale: Locale }) => {
      runtime.preview = data;
      runtime.previewLocale = locale;
      return <div data-testid="m3-preview">{data.summary}</div>;
    },
  },
}));
vi.mock('@/components/TemplatePreview', () => ({ TemplatePreview: () => <div /> }));
vi.mock('@/components/TemplatePreviewFullscreenModal', () => ({ TemplatePreviewFullscreenModal: () => null }));

function fixture(): CVData {
  return {
    id: 'm3-real-page',
    name: 'M3 real page',
    personal: {
      fullName: 'Mila Petrovic',
      email: 'mila@example.test',
      phone: '',
      address: 'Novi Sad',
      jobTitle: 'Graficki dizajner',
      gender: 'female',
      photoEnabled: false,
    },
    summary: CURRENT,
    contentLocale: 'sr',
    summaryOrigin: 'ai_repaired',
    summaryGeneratedLocale: 'hi',
    canonicalSummary: STALE,
    canonicalSnapshot: { summary: STALE } as unknown as CVData['canonicalSnapshot'],
    experience: [{
      id: 'exp-current',
      company: 'Nova Firma',
      position: 'Graphic Designer',
      positionProvenance: 'occupation_option',
      positionSourceKey: 'graphic_designer',
      positionSourceLocale: 'en',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: 'CURRENT_EXPERIENCE_SENTINEL',
      generatedDescription: 'STALE_EXPERIENCE_SENTINEL',
      generatedLocale: 'hi',
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

function resetRuntime(cv: CVData): void {
  runtime.currentCv = cv;
  runtime.aiUsage = 4;
  runtime.requests = [];
  runtime.preview = null;
  runtime.pdf = null;
  runtime.docx = null;
  runtime.previewLocale = '';
  runtime.pdfLocale = '';
  runtime.docxLocale = '';
  runtime.pdfOutcome = 'saved';
  runtime.docxOutcome = 'saved';
  runtime.mutateLiveCvDuringPdf = false;
  clearCvExportDiagnosticsForTests();
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

async function renderSimpleV1Page(): Promise<void> {
  const Page = (await import('@/app/cv-builder/page')).default;
  render(<Page />);
  fireEvent.click(screen.getAllByRole('button', { name: translations.de.cv.preview })[1]!);
  await waitFor(() => expect(screen.getByTestId('m3-preview')).toBeTruthy());
}

async function runPdfFromPage(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: translations.de.cv.downloadCv }));
  fireEvent.click(screen.getByRole('button', { name: /^PDF/u }));
  await waitFor(() => expect(getLatestCvExportDiagnostic('pdf')).not.toBeNull());
}

afterEach(() => {
  cleanup();
  clearCvExportDiagnosticsForTests();
  localStorage.clear();
  delete process.env.NEXT_PUBLIC_CV_SIMPLE_V1;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('Simple V1 M3 real page render/export path', () => {
  it('30. Preview, PDF, and DOCX receive current authority with no provider or AI usage', async () => {
    process.env.NEXT_PUBLIC_CV_SIMPLE_V1 = 'true';
    const rawCv = fixture();
    runtime.currentCv = rawCv;
    runtime.aiUsage = 4;
    runtime.requests = [];
    runtime.preview = null;
    runtime.pdf = null;
    runtime.docx = null;
    runtime.previewLocale = '';
    runtime.pdfLocale = '';
    runtime.docxLocale = '';
    runtime.pdfOutcome = 'saved';
    runtime.docxOutcome = 'saved';
    runtime.mutateLiveCvDuringPdf = false;
    clearCvExportDiagnosticsForTests();
    HTMLElement.prototype.scrollIntoView = vi.fn();

    const expectedSnapshot = captureCvRenderSnapshot(rawCv);

    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getAllByRole('button', { name: translations.de.cv.preview })[1]!);

    await waitFor(() => expect(screen.getByTestId('m3-preview').textContent).toBe(CURRENT));
    expect((runtime.preview as CVData | null)?.summary).toBe(CURRENT);
    expect((runtime.preview as CVData | null)?.experience[0].position).toBe('Grafička dizajnerka');
    expect(JSON.stringify(runtime.preview)).not.toContain(STALE);
    expect(runtime.previewLocale).toBe('sr');

    fireEvent.click(screen.getByRole('button', { name: translations.de.cv.downloadCv }));
    fireEvent.click(screen.getByRole('button', { name: /^PDF/u }));
    await waitFor(() => expect(runtime.pdf).not.toBeNull());
    await waitFor(() => expect(getLatestCvExportDiagnostic('pdf')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: translations.de.cv.downloadCv }));
    fireEvent.click(screen.getByRole('button', { name: /^DOCX/u }));
    await waitFor(() => expect(runtime.docx).not.toBeNull());
    await waitFor(() => expect(getLatestCvExportDiagnostic('docx')).not.toBeNull());

    expect((runtime.pdf as CVData | null)?.summary).toBe(CURRENT);
    expect((runtime.docx as CVData | null)?.summary).toBe(CURRENT);
    expect((runtime.pdf as CVData | null)?.experience[0].position).toBe('Grafička dizajnerka');
    expect((runtime.docx as CVData | null)?.experience[0].position).toBe('Grafička dizajnerka');
    expect((runtime.pdf as CVData | null)?.experience[0].description).toBe('CURRENT_EXPERIENCE_SENTINEL');
    expect((runtime.docx as CVData | null)?.experience[0].description).toBe('CURRENT_EXPERIENCE_SENTINEL');
    expect(runtime.pdfLocale).toBe('sr');
    expect(runtime.docxLocale).toBe('sr');
    expect(runtime.requests).toEqual([]);
    expect(runtime.aiUsage).toBe(4);
    expect(rawCv.experience[0].position).toBe('Graphic Designer');
    expect(rawCv.experience[0].positionSourceKey).toBe('graphic_designer');

    const pdfDiagnostic = getLatestCvExportDiagnostic('pdf');
    const docxDiagnostic = getLatestCvExportDiagnostic('docx');
    expect(pdfDiagnostic).toMatchObject({
      simpleV1: true,
      format: 'pdf',
      templateId: 'modern-minimal',
      contentLocale: 'sr',
      renderModelHash: expectedSnapshot.renderModelHash,
      summaryHash: expectedSnapshot.summaryHash,
      experienceHash: expectedSnapshot.experienceHash,
      rendererSucceeded: true,
      blobSucceeded: true,
      saveSucceeded: true,
      ok: true,
    });
    expect(docxDiagnostic).toMatchObject({
      simpleV1: true,
      format: 'docx',
      templateId: 'modern-minimal',
      contentLocale: 'sr',
      renderModelHash: expectedSnapshot.renderModelHash,
      summaryHash: expectedSnapshot.summaryHash,
      experienceHash: expectedSnapshot.experienceHash,
      rendererSucceeded: true,
      blobSucceeded: true,
      saveSucceeded: true,
      ok: true,
    });
    expect(Buffer.byteLength(JSON.stringify(pdfDiagnostic), 'utf8')).toBeLessThan(2_000);
    expect(Buffer.byteLength(JSON.stringify(docxDiagnostic), 'utf8')).toBeLessThan(2_000);
  });

  it.each([
    ['renderer_failure', 'renderer_failed'],
    ['blob_failure', 'blob_failed'],
  ] as const)('31. actual %s records terminal false', async (outcome, failureReason) => {
    process.env.NEXT_PUBLIC_CV_SIMPLE_V1 = 'true';
    resetRuntime(fixture());
    runtime.pdfOutcome = outcome;

    await renderSimpleV1Page();
    await runPdfFromPage();

    expect(getLatestCvExportDiagnostic('pdf')).toMatchObject({
      simpleV1: true,
      format: 'pdf',
      contentLocale: 'sr',
      rendererReached: true,
      rendererStarted: true,
      rendererSucceeded: false,
      blobProduced: false,
      blobSucceeded: false,
      saveReached: false,
      saveSucceeded: false,
      ok: false,
      failureReason,
    });
    expect(runtime.requests).toEqual([]);
    expect(runtime.aiUsage).toBe(4);
  });

  it('32. an actual failed save preserves renderer/blob success and records terminal false', async () => {
    process.env.NEXT_PUBLIC_CV_SIMPLE_V1 = 'true';
    resetRuntime(fixture());
    runtime.pdfOutcome = 'save_failure';

    await renderSimpleV1Page();
    await runPdfFromPage();

    expect(getLatestCvExportDiagnostic('pdf')).toMatchObject({
      simpleV1: true,
      format: 'pdf',
      contentLocale: 'sr',
      rendererSucceeded: true,
      blobProduced: true,
      blobSucceeded: true,
      saveReached: true,
      saveSucceeded: false,
      ok: false,
      failureReason: 'save_result_failed',
    });
    expect(runtime.requests).toEqual([]);
    expect(runtime.aiUsage).toBe(4);
  });

  it('33. live mutation after PDF capture cannot change the stored snapshot hashes', async () => {
    process.env.NEXT_PUBLIC_CV_SIMPLE_V1 = 'true';
    const liveCv = fixture();
    resetRuntime(liveCv);
    runtime.mutateLiveCvDuringPdf = true;
    const captured = captureCvRenderSnapshot(liveCv);

    await renderSimpleV1Page();
    await runPdfFromPage();

    const changed = captureCvRenderSnapshot(liveCv);
    expect(getLatestCvExportDiagnostic('pdf')).toMatchObject({
      simpleV1: true,
      renderModelHash: captured.renderModelHash,
      summaryHash: captured.summaryHash,
      experienceHash: captured.experienceHash,
      ok: true,
    });
    expect(changed.renderModelHash).not.toBe(captured.renderModelHash);
    expect(changed.summaryHash).not.toBe(captured.summaryHash);
    expect(changed.experienceHash).not.toBe(captured.experienceHash);
    expect(runtime.requests).toEqual([]);
    expect(runtime.aiUsage).toBe(4);
  });
});
