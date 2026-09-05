// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '../cv-defaults';
import {
  CV_DRAFT_STORAGE_KEY,
  clearCvDraft,
  loadCvDraft,
  saveCvDraft,
} from '../draft-storage';
import { hashSummarySourceLocaleText } from '../cv-summary-source-locale';

function legacyCvWithoutContentLocale() {
  const { contentLocale: _contentLocale, ...cv } = {
    ...createEmptyCv('sr'),
    summary: 'Sačuvani srpski sažetak',
    experience: [{
      id: 'experience-1',
      company: 'Atlas',
      position: 'Koordinator',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: 'Koordiniram radne zadatke.',
    }],
  };
  return cv;
}

describe('Simple V1 draft persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('NEXT_PUBLIC_CV_SIMPLE_V1', 'true');
  });

  afterEach(() => {
    clearCvDraft();
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it('persists the compatibility bridge once and keeps it after UI locale changes', () => {
    localStorage.setItem('cvpro-locale', 'sr');
    const legacyCv = legacyCvWithoutContentLocale();

    expect(saveCvDraft({ cv: legacyCv, savedAt: '2026-08-22T00:00:00.000Z' })).toBe(true);
    expect(loadCvDraft()?.cv.contentLocale).toBe('sr');

    localStorage.setItem('cvpro-locale', 'ja');
    const loaded = loadCvDraft()?.cv;

    expect(loaded?.contentLocale).toBe('sr');
    expect(loaded?.summary).toBe(legacyCv.summary);
    expect(loaded?.experience).toStrictEqual(legacyCv.experience);
  });

  it('leaves feature-off draft storage on the legacy migration path', () => {
    vi.stubEnv('NEXT_PUBLIC_CV_SIMPLE_V1', 'false');
    const legacyCv = legacyCvWithoutContentLocale();

    expect(saveCvDraft({ cv: legacyCv, savedAt: '2026-08-22T00:00:00.000Z' })).toBe(true);

    const stored = JSON.parse(localStorage.getItem(CV_DRAFT_STORAGE_KEY) || '{}');
    expect(stored.cv.runtimeMigrationVersion).toBe(3);
  });

  it('round-trips optional Summary locale/hash binding through the actual draft seam', () => {
    const summary = 'Prüft Prozesse und koordiniert Termine.';
    const sourceHash = hashSummarySourceLocaleText(summary);
    const source = {
      ...createEmptyCv('en'),
      summary,
      summaryOrigin: 'ai_generated' as const,
      contentLocale: 'en' as const,
      summarySourceLocale: 'de' as const,
      summarySourceLocaleTextHash: sourceHash,
    };
    expect(saveCvDraft({ cv: source, savedAt: '2026-08-22T00:00:00.000Z' })).toBe(true);
    const loaded = loadCvDraft()?.cv;
    expect(loaded?.summary).toBe(summary);
    expect(loaded?.summarySourceLocale).toBe('de');
    expect(loaded?.summarySourceLocaleTextHash).toBe(sourceHash);
    expect(loaded?.contentLocale).toBe('en');

    const legacy = { ...source } as typeof source & { summarySourceLocale?: string; summarySourceLocaleTextHash?: string };
    delete legacy.summarySourceLocale;
    delete legacy.summarySourceLocaleTextHash;
    expect(saveCvDraft({ cv: legacy, savedAt: '2026-08-22T00:00:00.000Z' })).toBe(true);
    const legacyLoaded = loadCvDraft()?.cv;
    expect(legacyLoaded?.summary).toBe(summary);
    expect(legacyLoaded?.contentLocale).toBe('en');
    expect(legacyLoaded?.summarySourceLocale).toBeUndefined();
    expect(legacyLoaded?.summarySourceLocaleTextHash).toBeUndefined();
  });
});
