import { describe, expect, test } from 'vitest';
import {
  LOCALE_TEMPLATES,
  generateBulletsOffline,
  industryOptions,
  levelOptions,
} from '../ai-bullets';
import { languages, translations, type Locale } from '../i18n/translations';

const supportedLocales = languages.map((language) => language.code);
const industries = industryOptions.map((option) => option.value);
const levels = levelOptions.map((option) => option.value);
const allowedPlaceholders = new Set([
  '{company}', '{count}', '{count2}', '{count3}', '{pct}', '{pct2}', '{dollars}', '{dollars2}',
  '{months}', '{days}', '{years}', '{stack}', '{component}', '{feature}', '{product}', '{process}',
  '{initiative}', '{setting}', '{specialty}', '{practice}',
]);

function collectMissingPaths(base: unknown, candidate: unknown, path = 'root'): string[] {
  if (Array.isArray(base)) {
    if (!Array.isArray(candidate) || candidate.length === 0) return [path];

    return candidate.flatMap((item, index) => collectMissingPaths(base[0], item, `${path}[${index}]`));
  }

  if (typeof base === 'string') {
    return typeof candidate === 'string' && candidate.trim().length > 0 ? [] : [path];
  }

  if (base && typeof base === 'object') {
    if (!candidate || typeof candidate !== 'object') return [path];

    return Object.entries(base as Record<string, unknown>).flatMap(([key, value]) =>
      collectMissingPaths(value, (candidate as Record<string, unknown>)[key], `${path}.${key}`)
    );
  }

  return [];
}

describe('Localization coverage', () => {
  describe('Translation tree coverage', () => {
    test.each(supportedLocales)('%s matches the full translation shape', (locale) => {
      const missingPaths = collectMissingPaths(translations.en, translations[locale]);
      expect(missingPaths).toEqual([]);
    });
  });

  describe('Offline bullet template matrix', () => {
    test.each(supportedLocales)('%s has every industry and level', (locale) => {
      const localeTemplates = LOCALE_TEMPLATES[locale];
      expect(localeTemplates).toBeDefined();

      industries.forEach((industry) => {
        levels.forEach((level) => {
          const templates = localeTemplates[industry][level];
          expect(Array.isArray(templates)).toBe(true);
          expect(templates.length).toBeGreaterThanOrEqual(4);
          templates.forEach((template) => expect(template.trim().length).toBeGreaterThan(0));
        });
      });
    });

    test('all locale/industry/level combinations generate hydrated bullets', () => {
      supportedLocales.forEach((locale) => {
        industries.forEach((industry) => {
          levels.forEach((level) => {
            const result = generateBulletsOffline(industry, level, 'Acme', locale);
            const lines = result.split('\n').filter(Boolean);
            expect(lines.length).toBeGreaterThanOrEqual(3);
            expect(lines.length).toBeLessThanOrEqual(5);
            lines.forEach((line) => {
              expect(line.startsWith('• ')).toBe(true);
              expect(line.includes('{')).toBe(false);
              expect(line.trim().length).toBeGreaterThan(3);
            });
          });
        });
      });
    });
  });

  describe('Placeholder consistency', () => {
    test('uses only supported placeholders across all locales', () => {
      const placeholderRegex = /\{[\w]+\}/g;

      supportedLocales.forEach((locale) => {
        industries.forEach((industry) => {
          levels.forEach((level) => {
            LOCALE_TEMPLATES[locale][industry][level].forEach((template) => {
              const placeholders = template.match(placeholderRegex) || [];
              placeholders.forEach((placeholder) => expect(allowedPlaceholders.has(placeholder)).toBe(true));
            });
          });
        });
      });
    });
  });

  describe('Script validation', () => {
    const scriptChecks: Array<{ locale: Locale; pattern: RegExp }> = [
      { locale: 'ru', pattern: /[а-яА-ЯёЁ]/ },
      { locale: 'ar', pattern: /[\u0600-\u06FF]/ },
      { locale: 'hi', pattern: /[\u0900-\u097F]/ },
      { locale: 'ja', pattern: /[\u3040-\u30FF\u4E00-\u9FFF]/ },
    ];

    test.each(scriptChecks)('$locale uses the expected writing system', ({ locale, pattern }) => {
      const combined = industries
        .flatMap((industry) => levels.flatMap((level) => LOCALE_TEMPLATES[locale][industry][level]))
        .join(' ');

      expect(pattern.test(combined)).toBe(true);
    });
  });
});
