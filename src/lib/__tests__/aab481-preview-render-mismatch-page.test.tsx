/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CVData, WorkExperience } from '@/lib/types';
import { translations } from '@/lib/i18n/translations';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import {
  clearCvExportDiagnosticsForTests,
  getLatestCvExportDiagnostic,
} from '@/lib/cv-export-diagnostics';

const runtime = vi.hoisted(() => ({
  currentCv: undefined as unknown as CVData,
  pdfRenderer: vi.fn(async () => ({ result: 'saved' as const, fileName: 'aab481.pdf' })),
  docxRenderer: vi.fn(async () => ({ result: 'saved' as const, fileName: 'aab481.docx' })),
  errorToast: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: runtime.errorToast,
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'sr', t: translations.sr }),
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
    recordProAiSuccess: vi.fn(),
    getProAiUsageCount: () => 0,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab481-parity-token' }),
  }),
}));

vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));
vi.mock('@/components/TemplatePreview', () => ({ TemplatePreview: () => <div /> }));
vi.mock('@/components/TemplatePreviewFullscreenModal', () => ({ TemplatePreviewFullscreenModal: () => null }));
vi.mock('@/components/cv-templates', () => ({
  templateComponents: {
    'modern-minimal': () => (
      <div data-template-id="modern-minimal">
        <section><p data-testid="stale-template-leaf">{runtime.currentCv.summary}</p></section>
      </div>
    ),
  },
}));

vi.mock('@/lib/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export')>();
  return {
    ...actual,
    exportModernMinimalPdf: runtime.pdfRenderer,
    exportToDOCX: runtime.docxRenderer,
  };
});

const CURRENT = [
  'Pripremam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređujem grafike i slike za različite projekte.',
  'Usklađujem nacrte i izmene sa članovima projektnog tima.',
].join('\n');
const PRIOR = [
  'Izrađivala sam grafičke materijale za štampane i digitalne medije.',
  'Razvijala sam koncepte vizuelnog dizajna prema potrebama klijenata.',
  'Pregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.',
].join('\n');

function entry(id: string, company: string, startDate: string, present: boolean, description: string): WorkExperience {
  return {
    id, company, position: 'Grafička dizajnerka', startDate,
    endDate: present ? '' : '2025-12', isPresent: present, description,
    originalUserDescription: description, canonicalDescription: description,
    descriptionOrigin: 'deterministic_fallback', generatedDescription: description,
    generatedLocale: 'sr', descriptionSourceLocale: 'sr',
  };
}

function fixture(): CVData {
  const source = {
    id: 'aab481-mismatch', name: 'AAB481',
    personal: { fullName: 'AAB481', email: 'test@example.test', phone: '', address: '', jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false },
    summary: '', summaryOrigin: 'deterministic_fallback' as const,
    summaryGeneratedLocale: 'sr' as const, contentLocale: 'sr' as const,
    experience: [
      entry('current', 'Rewitu Current Test', '2026-03', true, CURRENT),
      entry('prior-1', 'TestWerk GmbH', '2021-01', false, PRIOR),
      entry('prior-2', 'Rewitu', '2018-01', false, PRIOR),
    ],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal' as const, region: 'EU' as const,
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
    runtimeMigrationVersion: 3,
  } as CVData;
  const manifest = buildSummaryV2SelectionManifest(captureSummaryV2Snapshot({
    cv: source, locale: 'sr', gender: 'female', referenceDateIso: '2026-08-18',
  }));
  const valid = buildSummaryV2DeterministicText(manifest);
  return {
    ...source,
    summary: valid.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    ),
  };
}

async function openStalePreview(): Promise<void> {
  const Page = (await import('@/app/cv-builder/page')).default;
  render(<Page />);
  fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[0]!);
  await waitFor(() => expect(screen.getByTestId('stale-template-leaf').textContent).toContain('Atlas'));
  // Let the post-commit leaf witness observe the competing stale template source.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AAB481 — actual page export fails closed on same-snapshot leaf mismatch', () => {
  beforeEach(() => {
    runtime.currentCv = fixture();
    runtime.pdfRenderer.mockClear();
    runtime.docxRenderer.mockClear();
    runtime.errorToast.mockClear();
    clearCvExportDiagnosticsForTests();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('blocks PDF before renderer/blob/save when the committed Preview leaf retained stale Summary text', async () => {
    await openStalePreview();
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(translations.sr.cv.downloadCv, 'i') })[0]!);
    fireEvent.click(await screen.findByText(translations.sr.cv.downloadPdf));
    await waitFor(() => expect(getLatestCvExportDiagnostic('pdf')).not.toBeNull());
    expect(getLatestCvExportDiagnostic('pdf')).toMatchObject({
      rendererReached: false,
      blobProduced: false,
      androidSaveReached: false,
      saveResult: null,
      ok: false,
      finalTypedFailureReason: 'preview_render_mismatch',
      previewRenderAuthority: 'render_mismatch',
      previewSelectedFinalParityPassed: false,
    });
    expect(runtime.pdfRenderer).not.toHaveBeenCalled();
  });

  it('blocks DOCX before renderer/blob/save under the same unchanged Preview snapshot', async () => {
    await openStalePreview();
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(translations.sr.cv.downloadCv, 'i') })[0]!);
    fireEvent.click(await screen.findByText(translations.sr.cv.downloadDocx));
    await waitFor(() => expect(getLatestCvExportDiagnostic('docx')).not.toBeNull());
    expect(getLatestCvExportDiagnostic('docx')).toMatchObject({
      rendererReached: false,
      blobProduced: false,
      androidSaveReached: false,
      saveResult: null,
      ok: false,
      finalTypedFailureReason: 'preview_render_mismatch',
      previewRenderAuthority: 'render_mismatch',
      previewSelectedFinalParityPassed: false,
    });
    expect(runtime.docxRenderer).not.toHaveBeenCalled();
  });
});
