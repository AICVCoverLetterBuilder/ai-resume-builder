import { describe, expect, it } from 'vitest';
import { languages, translations } from '@/lib/i18n/translations';

describe('M6 source/target language translation catalog contract', () => {
  it('defines distinct non-fallback source and target labels for every established locale', () => {
    expect(Object.keys(translations).sort()).toEqual(languages.map((language) => language.code).sort());

    for (const language of languages) {
      const common = translations[language.code].common;
      expect(Object.prototype.hasOwnProperty.call(common, 'sourceLanguage')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(common, 'targetLanguage')).toBe(true);
      expect(common.sourceLanguage.trim()).not.toBe('');
      expect(common.targetLanguage.trim()).not.toBe('');
      expect(common.sourceLanguage).not.toBe(common.targetLanguage);
    }

    // The established locale/display metadata remains the sole display owner.
    expect(languages).toHaveLength(12);
    expect(new Set(languages.map((language) => language.code)).size).toBe(12);
  });
});
