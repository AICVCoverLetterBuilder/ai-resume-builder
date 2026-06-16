import { describe, expect, test } from 'vitest';
import {
  filterCvLanguageOptions,
  getLocalizedCvLanguageName,
  resolveStoredCvLanguageName,
} from '../cv-language-options';

describe('cv language options', () => {
  test('matches English from a partial latin query', () => {
    const results = filterCvLanguageOptions('eng', 'en');

    expect(results[0]?.canonicalName).toBe('English');
    expect(results[0]?.localizedLabel).toBe('English');
  });

  test('localizes suggestion labels to Arabic while keeping search flexible', () => {
    const results = filterCvLanguageOptions('eng', 'ar');

    expect(results[0]?.canonicalName).toBe('English');
    expect(results[0]?.localizedLabel).not.toBe('English');
  });

  test('returns Serbian labels in latin script', () => {
    expect(getLocalizedCvLanguageName('German', 'sr')).toBe('nemački');
  });

  test('resolves previously typed localized labels back to canonical storage', () => {
    expect(resolveStoredCvLanguageName('Deutsch')).toBe('German');
    expect(resolveStoredCvLanguageName('العربية')).toBe('Arabic');
  });
});
