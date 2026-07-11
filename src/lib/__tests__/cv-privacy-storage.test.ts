/**
 * @vitest-environment jsdom
 */
import { describe, expect, test, beforeEach } from 'vitest';
import { createEmptyCv, isBlankCv } from '@/lib/cv-defaults';
import {
  clearCvDraft,
  CV_DRAFT_STORAGE_KEY,
  loadCvDraft,
  saveCvDraft,
} from '@/lib/draft-storage';

describe('CV privacy storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('production initial CV state is blank when no storage exists', () => {
    expect(loadCvDraft()).toBeNull();
    const cv = createEmptyCv();
    expect(isBlankCv(cv)).toBe(true);
    expect(cv.personal.fullName).toBe('');
    expect(cv.personal.email).toBe('');
    expect(cv.experience).toEqual([]);
    expect(cv.education).toEqual([]);
  });

  test('no demo/sample CV data is seeded in production defaults', () => {
    const cv = createEmptyCv();
    const serialized = JSON.stringify(cv);
    const forbidden = ['Dragan', 'Obradovic', 'Obradović', 'Učitelj', 'diodala12', 'Braće', 'Metematički', 'Zhff', 'Hfh'];
    for (const token of forbidden) {
      expect(serialized).not.toContain(token);
    }
  });

  test('clearing CV draft storage leaves no restorable CV payload', () => {
    const cv = createEmptyCv();
    cv.personal.fullName = 'Private User';
    saveCvDraft({ cv, savedAt: new Date().toISOString() });
    expect(loadCvDraft()?.cv.personal.fullName).toBe('Private User');

    clearCvDraft();
    expect(localStorage.getItem(CV_DRAFT_STORAGE_KEY)).toBeNull();
    expect(loadCvDraft()).toBeNull();
  });

  test('loadCvDraft does not read deprecated backup keys', () => {
    localStorage.setItem('cv-draft', JSON.stringify({
      cv: { personal: { fullName: 'Legacy Key User' } },
      savedAt: new Date().toISOString(),
    }));
    localStorage.setItem('cvpro-cv-backup', JSON.stringify({
      cv: { personal: { fullName: 'Backup Key User' } },
      savedAt: new Date().toISOString(),
    }));
    expect(loadCvDraft()).toBeNull();
  });
});
