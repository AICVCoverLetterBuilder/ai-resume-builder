/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CVData } from '@/lib/types';
import { languages, translations } from '@/lib/i18n/translations';
import { hashTitleLocaleText } from '@/lib/cv-title-locale-authority';
import { loadCvDraft, saveCvDraft } from '@/lib/draft-storage';
import {
  clearCvExportDiagnosticsForTests,
  formatCvExportDiagnosticForCopy,
  getLatestCvExportDiagnostic,
} from '@/lib/cv-export-diagnostics';

const runtime = vi.hoisted(() => ({
  currentCv: undefined as unknown as CVData,
  persist: vi.fn((_next: CVData) => true),
  pdfRenderer: vi.fn(async () => ({ result: 'saved' as const, fileName: 'synthetic.pdf' })),
  docxRenderer: vi.fn(async () => ({ result: 'saved' as const, fileName: 'synthetic.docx' })),
  usage: vi.fn(),
  onSetCurrentCv: vi.fn((_next: CVData) => {}),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'sr', t: translations.sr }),
}));
vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: runtime.currentCv,
    setCurrentCv: (next: CVData) => {
      runtime.onSetCurrentCv(next);
      runtime.currentCv = next;
    },
    persistCurrentCvTransactionally: (next: CVData) => {
      runtime.persist(next);
      runtime.currentCv = next;
      return true;
    },
    isPro: true,
    canDownload: () => true,
    incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: runtime.usage,
    getProAiUsageCount: () => 0,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'synthetic-test-token' }),
  }),
}));
vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));
vi.mock('@/components/TemplatePreview', () => ({ TemplatePreview: () => <div /> }));
vi.mock('@/components/TemplatePreviewFullscreenModal', () => ({ TemplatePreviewFullscreenModal: () => null }));
vi.mock('@/components/cv-templates', () => ({
  templateComponents: { 'modern-minimal': () => <div data-template-id="modern-minimal" /> },
}));
vi.mock('@/lib/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/export')>();
  return { ...actual, exportModernMinimalPdf: runtime.pdfRenderer, exportToDOCX: runtime.docxRenderer };
});

function fixture(): CVData {
  return {
    id: 'synthetic-title-cv', name: 'Synthetic',
    personal: { fullName: 'Synthetic', email: '', phone: '', address: '', jobTitle: 'Qxz' },
    summary: '', contentLocale: 'sr',
    experience: [{ id: 'exp', company: 'Synthetic', position: 'Qxz',
      positionSourceLocale: 'en', startDate: '2024-01', endDate: '', isPresent: true,
      description: 'Priprema i proverava dokumentaciju.' }],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-01-01', updatedAt: '2026-09-28', runtimeMigrationVersion: 3,
  };
}

async function requestExport(format: 'pdf' | 'docx'): Promise<void> {
  const Page = (await import('@/app/cv-builder/page')).default;
  render(<Page />);
  fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[0]!);
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(translations.sr.cv.downloadCv, 'i') })[0]!);
  fireEvent.click(await screen.findByText(format === 'pdf'
    ? translations.sr.cv.downloadPdf : translations.sr.cv.downloadDocx));
  await screen.findByRole('dialog', { name: translations.sr.titleLocaleConfirmation.dialogTitle });
}

describe('title-locale confirmation on the actual shared export page', () => {
  beforeEach(() => {
    runtime.currentCv = fixture();
    runtime.persist.mockClear();
    runtime.pdfRenderer.mockClear();
    runtime.docxRenderer.mockClear();
    runtime.usage.mockClear();
    runtime.onSetCurrentCv.mockReset();
    localStorage.clear();
    clearCvExportDiagnosticsForTests();
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it.each(['pdf', 'docx'] as const)('%s blocks before provider/renderer and persists only after explicit SR confirmation', async (format) => {
    await requestExport(format);
    expect(runtime.persist).not.toHaveBeenCalled();
    expect(runtime.pdfRenderer).not.toHaveBeenCalled();
    expect(runtime.docxRenderer).not.toHaveBeenCalled();
    await waitFor(() => expect(getLatestCvExportDiagnostic(format)).not.toBeNull());
    const diagnostic = getLatestCvExportDiagnostic(format)!;
    expect(diagnostic).toMatchObject({
      finalTypedFailureReason: 'export_title_locale_authority_unbound',
      rendererReached: false,
      blobProduced: false,
      androidSaveReached: false,
      titleProviderRequestCount: 0,
      titleProviderRepairCount: 0,
      titleLocaleBindingStatusByField: { 'experience.exp.position': 'legacy_unbound' },
      titleUnboundFieldKeys: ['experience.exp.position'],
      stages: expect.arrayContaining([{
        stage: 'localize_export_titles', result: 'fail', reason: 'export_title_locale_authority_unbound',
      }]),
    });
    const copied = formatCvExportDiagnosticForCopy(diagnostic);
    expect(copied).not.toContain('Qxz');
    expect(copied).not.toContain(hashTitleLocaleText('Qxz'));
    expect(copied).not.toContain('Synthetic');
    expect(copied).not.toContain('Priprema i proverava dokumentaciju');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sr' } });
    fireEvent.click(screen.getByRole('button', { name: translations.sr.titleLocaleConfirmation.confirmLanguages }));
    await waitFor(() => expect(runtime.persist).toHaveBeenCalledTimes(1));
    expect(runtime.currentCv.experience[0]?.position).toBe('Qxz');
    expect(runtime.currentCv.experience[0]?.positionSourceLocale).toBe('sr');
    expect(runtime.currentCv.experience[0]?.positionSourceLocaleTextHash).toBe(hashTitleLocaleText('Qxz'));
    expect(runtime.usage).not.toHaveBeenCalled();
    expect(formatCvExportDiagnosticForCopy(getLatestCvExportDiagnostic(format)!))
      .not.toContain(hashTitleLocaleText('Qxz'));
  });

  it('Cancel leaves the draft, locale binding, and AI usage untouched', async () => {
    const original = runtime.currentCv;
    await requestExport('pdf');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'sr' } });
    fireEvent.click(screen.getByRole('button', { name: translations.sr.common.cancel }));
    await waitFor(() => expect(screen.queryByRole('dialog', {
      name: translations.sr.titleLocaleConfirmation.dialogTitle,
    })).toBeNull());
    expect(runtime.currentCv).toBe(original);
    expect(runtime.persist).not.toHaveBeenCalled();
    expect(runtime.usage).not.toHaveBeenCalled();
    expect(runtime.currentCv.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
  });

  it('keeps the baseline setCv editing path for unrelated Personal fields', async () => {
    const Page = (await import('@/app/cv-builder/page')).default;
    const { container } = render(<Page />);
    const fields = [
      [translations.sr.cv.fullName, 'Name'],
      [translations.sr.cv.email, 'name@example.invalid'],
      [translations.sr.cv.phone, '12345'],
      [translations.sr.cv.address, 'Address'],
    ] as const;
    for (const [label, value] of fields) {
      const input = Array.from(container.querySelectorAll('label'))
        .find((node) => node.textContent === label)?.parentElement?.querySelector('input');
      expect(input, label).toBeTruthy();
      fireEvent.change(input!, { target: { value } });
      expect(input!.value).toBe(value);
    }
    expect(runtime.persist).not.toHaveBeenCalled();
    expect(runtime.usage).not.toHaveBeenCalled();
  });

  it('invalidates and persists a standalone Personal title binding through the normal page autosave', async () => {
    runtime.currentCv = {
      ...fixture(),
      personal: {
        ...fixture().personal,
        jobTitle: 'Tuv',
        jobTitleSourceLocale: 'sr',
        jobTitleSourceLocaleTextHash: hashTitleLocaleText('Tuv'),
      },
    };
    expect(saveCvDraft({ cv: runtime.currentCv, savedAt: '2026-09-29T00:00:00.000Z' })).toBe(true);
    runtime.currentCv = loadCvDraft()!.cv;
    expect(runtime.currentCv.personal.jobTitleSourceLocaleTextHash).toBe(hashTitleLocaleText('Tuv'));
    runtime.onSetCurrentCv.mockImplementation((next: CVData) => {
      expect(saveCvDraft({ cv: next, savedAt: '2026-09-29T00:00:01.000Z' })).toBe(true);
    });
    const Page = (await import('@/app/cv-builder/page')).default;
    const { container } = render(<Page />);
    const input = Array.from(container.querySelectorAll('label'))
      .find((node) => node.textContent === translations.sr.cv.jobTitle)
      ?.parentElement?.querySelector('input');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { value: 'Zyx' } });
    await waitFor(() => expect(loadCvDraft()?.cv.personal.jobTitle).toBe('Zyx'), { timeout: 3000 });
    expect(runtime.persist).not.toHaveBeenCalled();
    expect(runtime.usage).not.toHaveBeenCalled();
    expect(loadCvDraft()?.cv.personal.jobTitleSourceLocale).toBeUndefined();
    expect(loadCvDraft()?.cv.personal.jobTitleSourceLocaleTextHash).toBeUndefined();
    expect(loadCvDraft()?.cv.personal.jobTitleSourceLocaleTextHash).toBeUndefined();
    expect(loadCvDraft()?.cv.runtimeMigrationVersion).toBe(3);
  });

  it('keeps a reloaded bound-title hash out of the actual page Copy diagnostic', async () => {
    const titleHash = hashTitleLocaleText('Qxz');
    runtime.currentCv = {
      ...fixture(),
      experience: [{
        ...fixture().experience[0]!,
        positionSourceLocale: 'sr',
        positionSourceLocaleTextHash: titleHash,
      }],
    };
    expect(saveCvDraft({ cv: runtime.currentCv, savedAt: '2026-09-29T00:00:00.000Z' })).toBe(true);
    runtime.currentCv = loadCvDraft()!.cv;
    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[0]!);
    fireEvent.click(screen.getAllByRole('button', {
      name: new RegExp(translations.sr.cv.downloadCv, 'i'),
    })[0]!);
    fireEvent.click(await screen.findByText(translations.sr.cv.downloadPdf));
    await waitFor(() => expect(getLatestCvExportDiagnostic('pdf')).not.toBeNull());
    const diagnostic = getLatestCvExportDiagnostic('pdf')!;
    expect(diagnostic).not.toMatchObject({
      finalTypedFailureReason: 'export_title_locale_authority_unbound',
    });
    const copied = formatCvExportDiagnosticForCopy(diagnostic);
    expect(copied).not.toContain(titleHash);
    expect(copied).not.toContain('Qxz');
    expect(copied).not.toContain('Synthetic Organization');
    expect(copied).not.toContain('Priprema i proverava dokumentaciju');
  });
});

describe('title confirmation i18n contract', () => {
  it('has nonempty native copy for every supported app locale', () => {
    expect(languages).toHaveLength(12);
    for (const { code } of languages) {
      const copy = translations[code].titleLocaleConfirmation;
      for (const [key, value] of Object.entries(copy)) {
        expect(value.trim().length).toBeGreaterThan(0);
        if (code !== 'en') {
          expect(value).not.toBe(translations.en.titleLocaleConfirmation[
            key as keyof typeof copy]);
        }
      }
    }
  });
});
