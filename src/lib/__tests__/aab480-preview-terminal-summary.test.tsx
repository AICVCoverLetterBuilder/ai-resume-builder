/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CVData, WorkExperience } from '@/lib/types';
import { translations } from '@/lib/i18n/translations';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';

const preview = vi.hoisted(() => ({ summary: '', origin: '' }));

vi.mock('@/lib/i18n/context', () => ({
  useI18n: () => ({ locale: 'sr', t: translations.sr }),
}));

const state: { currentCv: CVData; writes: CVData[] } = {
  currentCv: undefined as unknown as CVData,
  writes: [],
};

vi.mock('@/lib/store', () => ({
  checkProAccess: () => 'allowed',
  useApp: () => ({
    currentCv: state.currentCv,
    setCurrentCv: (next: CVData) => { state.currentCv = next; state.writes.push(next); },
    persistCurrentCvTransactionally: (next: CVData) => { state.currentCv = next; state.writes.push(next); return true; },
    isPro: true,
    canDownload: () => true,
    incrementDownloads: vi.fn(),
    markAiRecommendUsed: vi.fn(),
    recordProAiSuccess: vi.fn(),
    getProAiUsageCount: () => 0,
    lastCvSavedAt: 0,
    getAiGate: () => ({ status: 'ready', token: 'aab480-test' }),
  }),
}));

vi.mock('@/components/Header', () => ({ default: () => <div /> }));
vi.mock('@/components/Footer', () => ({ default: () => <div /> }));
vi.mock('@/components/cv-templates', () => ({
  templateComponents: {
    'modern-minimal': ({ data }: { data: CVData }) => {
      preview.summary = data.summary;
      preview.origin = data.summaryOrigin || '';
      return <div data-testid="actual-preview-summary">{data.summary}</div>;
    },
  },
}));
vi.mock('@/components/TemplatePreview', () => ({ TemplatePreview: () => <div /> }));
vi.mock('@/components/TemplatePreviewFullscreenModal', () => ({ TemplatePreviewFullscreenModal: () => null }));

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

function entry(id: string, company: string, startDate: string, isPresent: boolean, description: string, position = 'Grafička dizajnerka'): WorkExperience {
  return {
    id,
    company,
    position,
    startDate,
    endDate: isPresent ? '' : '2025-12',
    isPresent,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'deterministic_fallback',
    generatedDescription: description,
    generatedLocale: 'sr',
    descriptionSourceLocale: 'sr',
  };
}

function deviceCv(): CVData {
  const initial = {
    id: 'aab480-preview-first', name: 'AAB480',
    personal: { fullName: 'AAB480', email: 'aab480@example.test', phone: '', address: '', jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false },
    summary: '', summaryOrigin: 'deterministic_fallback' as const, summaryGeneratedLocale: 'sr' as const, contentLocale: 'sr' as const,
    experience: [
      entry('atlas-current', 'Atlas', '2023-01', true, 'Proverava pristiglu robu.\nProverava prateću dokumentaciju.\nSarađuje sa kolegama na pripremi robe.', 'Skladišna radnica'),
      entry('rewitu-current', 'Rewitu Current Test', '2026-03', true, CURRENT),
      entry('testwerk-prior', 'TestWerk GmbH', '2021-01', false, PRIOR),
      entry('rewitu-prior', 'Rewitu', '2018-01', false, PRIOR),
      entry('omitted-role', 'Omitted Co', '2016-01', false, 'Vodila sam evidenciju smena.', 'Operaterka'),
    ],
    education: [], skills: [], certifications: [], languages: [], projects: [],
    templateId: 'modern-minimal' as const, region: 'EU' as const,
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
    runtimeMigrationVersion: 3,
  } as CVData;
  const manifest = buildSummaryV2SelectionManifest(captureSummaryV2Snapshot({
    cv: initial, locale: 'sr', gender: 'female', referenceDateIso: '2026-08-18',
  }));
  const stale = buildSummaryV2DeterministicText(manifest).replace(
    'u Rewitu Current Test, gde',
    'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
  );
  return { ...initial, summary: stale };
}

describe('AAB480 — actual Preview consumes the terminal app-owned Summary', () => {
  beforeEach(() => {
    state.currentCv = deviceCv();
    state.writes = [];
    preview.summary = '';
    preview.origin = '';
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('opens Preview first and passes the selected recovered Summary to the actual template before PDF preparation', async () => {
    const source = state.currentCv;
    const prepared = prepareExportReadyCv(normalizeLegacyCvRuntime(source, 'sr'), 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok, prepared.ok ? '' : prepared.reason).toBe(true);
    if (!prepared.ok) return;
    const selected = prepared.cv.summary;
    const selectedHash = hashSummaryV2Text(selected);
    expect(source.summary).toContain('Atlas');

    const Page = (await import('@/app/cv-builder/page')).default;
    render(<Page />);
    // The Preview wizard step mounts the actual TemplateComponent route.
    fireEvent.click(screen.getAllByRole('button', { name: translations.sr.cv.preview })[1]!);

    await waitFor(() => expect(preview.origin).toBe('deterministic_fallback'));
    await waitFor(() => expect(screen.getByTestId('actual-preview-summary').textContent).toBe(selected));
    expect(preview.summary).toBe(selected);
    expect(preview.summary).not.toContain('Atlas');
    expect(preview.summary).not.toContain('januara 2023');
    expect(hashSummaryV2Text(preview.summary)).toBe(selectedHash);
    expect(state.currentCv.summary).toBe(source.summary);
    expect(state.writes).toEqual([]);
  });
});
