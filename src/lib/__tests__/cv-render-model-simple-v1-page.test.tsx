/** @vitest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translations, type Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';

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
      return { result: 'saved' as const, message: 'saved', platform: 'web' as const, fileName };
    }),
    exportToDOCX: vi.fn(async (cv: CVData, fileName: string, locale: Locale) => {
      runtime.docx = cv;
      runtime.docxLocale = locale;
      return { result: 'saved' as const, message: 'saved', platform: 'web' as const, fileName };
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
      position: 'Graficki dizajner',
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

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_CV_SIMPLE_V1;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('Simple V1 M3 real page render/export path', () => {
  it('30. Preview, PDF, and DOCX receive current authority with no provider or AI usage', async () => {
    process.env.NEXT_PUBLIC_CV_SIMPLE_V1 = 'true';
    runtime.currentCv = fixture();
    runtime.aiUsage = 4;
    runtime.requests = [];
    runtime.preview = null;
    runtime.pdf = null;
    runtime.docx = null;
    runtime.previewLocale = '';
    runtime.pdfLocale = '';
    runtime.docxLocale = '';
    HTMLElement.prototype.scrollIntoView = vi.fn();

    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    fireEvent.click(screen.getAllByRole('button', { name: translations.de.cv.preview })[1]!);

    await waitFor(() => expect(screen.getByTestId('m3-preview').textContent).toBe(CURRENT));
    expect((runtime.preview as CVData | null)?.summary).toBe(CURRENT);
    expect(JSON.stringify(runtime.preview)).not.toContain(STALE);
    expect(runtime.previewLocale).toBe('sr');

    fireEvent.click(screen.getByRole('button', { name: translations.de.cv.downloadCv }));
    fireEvent.click(screen.getByRole('button', { name: /^PDF/u }));
    await waitFor(() => expect(runtime.pdf).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: translations.de.cv.downloadCv }));
    fireEvent.click(screen.getByRole('button', { name: /^DOCX/u }));
    await waitFor(() => expect(runtime.docx).not.toBeNull());

    expect((runtime.pdf as CVData | null)?.summary).toBe(CURRENT);
    expect((runtime.docx as CVData | null)?.summary).toBe(CURRENT);
    expect((runtime.pdf as CVData | null)?.experience[0].description).toBe('CURRENT_EXPERIENCE_SENTINEL');
    expect((runtime.docx as CVData | null)?.experience[0].description).toBe('CURRENT_EXPERIENCE_SENTINEL');
    expect(runtime.pdfLocale).toBe('sr');
    expect(runtime.docxLocale).toBe('sr');
    expect(runtime.requests).toEqual([]);
    expect(runtime.aiUsage).toBe(4);
  });
});
