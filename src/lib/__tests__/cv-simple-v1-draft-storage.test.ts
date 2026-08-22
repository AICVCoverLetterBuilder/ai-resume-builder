// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCv } from '../cv-defaults';
import {
  CV_DRAFT_STORAGE_KEY,
  clearCvDraft,
  loadCvDraft,
  saveCvDraft,
} from '../draft-storage';

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
});
