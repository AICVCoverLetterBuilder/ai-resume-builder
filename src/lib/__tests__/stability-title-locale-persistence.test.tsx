/** @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CVData } from '@/lib/types';
import { createEmptyCv } from '@/lib/cv-defaults';
import { AppProvider, useApp } from '@/lib/store';
import { CV_DRAFT_STORAGE_KEY, loadCvDraft } from '@/lib/draft-storage';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import { applyCanonicalExperienceEdit } from '@/lib/cv-canonical-snapshot';
import { prepareExportLocalizedTitles } from '@/lib/cv-export-title-localization';
import {
  collectUnboundTitleLocaleFields,
  confirmTitleLocales,
  hashTitleLocaleText,
  resolveExperienceTitleLocale,
  resolvePersonalTitleLocale,
} from '@/lib/cv-title-locale-authority';

vi.mock('../iap', () => ({
  syncProEntitlement: vi.fn(() => new Promise(() => {})),
}));

let app: ReturnType<typeof useApp> | null = null;

function StoreProbe() {
  app = useApp();
  return null;
}

function mountStore() {
  return render(<AppProvider><StoreProbe /></AppProvider>);
}

function sourceCv(title = 'Qxz'): CVData {
  return {
    ...createEmptyCv('sr'),
    id: 'synthetic-persistence-title',
    personal: {
      ...createEmptyCv('sr').personal,
      fullName: 'Synthetic',
      jobTitle: title,
    },
    contentLocale: 'sr',
    runtimeMigrationVersion: 3,
    experience: [{
      id: 'exp',
      company: 'Synthetic Organization',
      position: title,
      positionSourceLocale: 'en', // Legacy metadata without a text binding.
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: '',
    }],
  };
}

async function saveThroughStore(cv: CVData) {
  await act(async () => {
    expect(app?.persistCurrentCvTransactionally(cv)).toBe(true);
  });
  const serialized = localStorage.getItem(CV_DRAFT_STORAGE_KEY);
  expect(serialized).toBeTruthy();
  return JSON.parse(serialized!) as { cv: CVData };
}

function reloadStore(view: ReturnType<typeof render>) {
  view.unmount();
  app = null;
  const restarted = mountStore();
  const reloadedApp = app as ReturnType<typeof useApp> | null;
  expect(reloadedApp?.currentCv).toBeTruthy();
  return restarted;
}

describe('title-locale binding across the real CV draft store boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    app = null;
    vi.stubEnv('NEXT_PUBLIC_CV_SIMPLE_V1', 'false');
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('confirms Experience SR, saves, serializes, reloads v3, and exports without a second confirmation or provider', async () => {
    const source = sourceCv();
    const fields = collectUnboundTitleLocaleFields(source);
    expect(fields.map((field) => field.fieldKey)).toEqual(['experience.exp.position']);
    const confirmed = confirmTitleLocales(source, fields.map((field) => ({ ...field, locale: 'sr' })))!;
    let view = mountStore();
    const stored = await saveThroughStore(confirmed);
    const titleHash = hashTitleLocaleText('Qxz');
    expect(stored.cv.experience[0]?.positionSourceLocaleTextHash).toBe(titleHash);
    expect(stored.cv.experience[0]?.positionSourceLocale).toBe('sr');
    expect(stored.cv.runtimeMigrationVersion).toBe(3);

    view = reloadStore(view);
    const reloaded = app!.currentCv!;
    expect(loadCvDraft()?.cv.experience[0]?.positionSourceLocaleTextHash).toBe(titleHash);
    expect(normalizeLegacyCvRuntime(reloaded).experience[0]?.positionSourceLocaleTextHash).toBe(titleHash);
    expect(reloaded.experience[0]?.position).toBe('Qxz');
    expect(reloaded.experience[0]?.positionSourceLocale).toBe('sr');
    expect(reloaded.experience[0]?.positionSourceLocaleTextHash).toBe(titleHash);
    expect(resolveExperienceTitleLocale(reloaded.experience[0]!)).toEqual({ locale: 'sr', status: 'bound' });
    expect(resolvePersonalTitleLocale(reloaded)).toEqual({ locale: 'sr', status: 'bound' });
    expect(collectUnboundTitleLocaleFields(reloaded)).toEqual([]);

    const adapter = vi.fn();
    const exportResult = await prepareExportLocalizedTitles({
      sourceCv: reloaded,
      exportCv: structuredClone(reloaded),
      targetLocale: 'sr',
      includePersonalTitle: true,
      adapter,
    });
    expect(exportResult.ok).toBe(true);
    expect(exportResult.diagnostics.titleProviderRequestCount).toBe(0);
    expect(exportResult.diagnostics.titleProviderRepairCount).toBe(0);
    expect(adapter).not.toHaveBeenCalled();
    expect(JSON.stringify(exportResult.diagnostics)).not.toContain(titleHash);

    const edited = applyCanonicalExperienceEdit(reloaded, 'exp', 'position', 'Zyx', 'sr');
    expect(edited.experience[0]?.positionSourceLocale).toBeUndefined();
    expect(edited.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
    const active = await saveThroughStore(edited);
    expect(active.cv.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
    view = reloadStore(view);
    expect(app!.currentCv!.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
    expect(loadCvDraft()?.cv.experience[0]?.positionSourceLocaleTextHash).toBeUndefined();
    expect(resolveExperienceTitleLocale(app!.currentCv!.experience[0]!))
      .toEqual({ locale: null, status: 'legacy_unbound' });
  });

  it('persists an independently confirmed Personal title through same-version reload', async () => {
    const source = { ...sourceCv(), experience: [] };
    source.personal = { ...source.personal, jobTitle: 'Tuv' };
    const fields = collectUnboundTitleLocaleFields(source);
    expect(fields.map((field) => field.fieldKey)).toEqual(['personal.jobTitle']);
    const confirmed = confirmTitleLocales(source, fields.map((field) => ({ ...field, locale: 'sr' })))!;
    const view = mountStore();
    const stored = await saveThroughStore(confirmed);
    const titleHash = hashTitleLocaleText('Tuv');
    expect(stored.cv.personal.jobTitleSourceLocaleTextHash).toBe(titleHash);
    reloadStore(view);
    const reloaded = app!.currentCv!;
    expect(reloaded.personal.jobTitle).toBe('Tuv');
    expect(reloaded.personal.jobTitleSourceLocale).toBe('sr');
    expect(reloaded.personal.jobTitleSourceLocaleTextHash).toBe(titleHash);
    expect(normalizeLegacyCvRuntime(reloaded).personal.jobTitleSourceLocaleTextHash).toBe(titleHash);
    expect(resolvePersonalTitleLocale(reloaded)).toEqual({ locale: 'sr', status: 'bound' });
    expect(collectUnboundTitleLocaleFields(reloaded)).toEqual([]);
  });

  it('retains the EN-to-SR provider route after confirmed EN binding survives reload', async () => {
    const source = sourceCv();
    const fields = collectUnboundTitleLocaleFields(source);
    const confirmed = confirmTitleLocales(source, fields.map((field) => ({ ...field, locale: 'en' })))!;
    const view = mountStore();
    await saveThroughStore(confirmed);
    reloadStore(view);
    const reloaded = app!.currentCv!;
    expect(resolveExperienceTitleLocale(reloaded.experience[0]!)).toEqual({ locale: 'en', status: 'bound' });
    const adapter = vi.fn(async (input: { targetLocale: string; entries: Array<{ entryId: string }> }) => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({
        entryId: entry.entryId, localizedRoleTitle: 'Koordinator projekta', facts: [],
      })),
    }));
    const result = await prepareExportLocalizedTitles({
      sourceCv: reloaded,
      exportCv: structuredClone(reloaded),
      targetLocale: 'sr',
      includePersonalTitle: true,
      adapter,
    });
    expect(result.ok).toBe(true);
    expect(adapter).toHaveBeenCalled();
    expect(result.diagnostics.titleProviderRequestCount).toBeGreaterThan(0);
    expect(result.diagnostics.titleSameLocaleCount).toBe(0);
    expect(JSON.stringify(result.diagnostics)).not.toContain(hashTitleLocaleText('Qxz'));
  });
});
