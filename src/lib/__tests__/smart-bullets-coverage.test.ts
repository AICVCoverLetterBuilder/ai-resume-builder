import { describe, expect, test } from 'vitest';
import {
  LOCALE_TEMPLATES,
  generateBulletsOffline,
  type BulletIndustry,
  type BulletLevel,
} from '../ai-bullets';
import type { Locale } from '../i18n/translations';

const locales = ['de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja'] as const satisfies readonly Locale[];
const industries = ['tech', 'sales', 'marketing', 'finance', 'healthcare', 'education'] as const satisfies readonly BulletIndustry[];
const levels = ['entry', 'mid', 'senior'] as const satisfies readonly BulletLevel[];
const forbiddenEnglishWords = ['Developed', 'Implemented', 'Managed', 'Created', 'Led', 'Improved', 'Built'] as const;
const forbiddenEnglishRegex = new RegExp(
  `(?:^|[^\\p{L}])(${forbiddenEnglishWords.join('|')})(?=$|[^\\p{L}])`,
  'iu',
);

type Status = 'OK' | 'FAIL' | 'MISSING_TEMPLATE';

function getTemplatePool(locale: Locale, industry: BulletIndustry, level: BulletLevel): string[] {
  const localeTemplates = LOCALE_TEMPLATES[locale] as Partial<Record<BulletIndustry, Partial<Record<BulletLevel, string[]>>>> | undefined;

  return localeTemplates?.[industry]?.[level] ?? [];
}

describe('AI Improvements localization coverage', () => {
  test('never returns common English verbs for non-English locales in the required matrix', () => {
    const rows: Array<{ Locale: Locale; Industry: BulletIndustry; Level: BulletLevel; Status: Status }> = [];

    let passed = 0;
    let failed = 0;
    let missingTemplates = 0;

    locales.forEach((locale) => {
      industries.forEach((industry) => {
        levels.forEach((level) => {
          const templatePool = getTemplatePool(locale, industry, level);
          const result = generateBulletsOffline(industry, level, 'Test Company', locale);
          const hasMissingTemplate = templatePool.length === 0;
          const hasEnglishInTemplates = templatePool.some((template) => forbiddenEnglishRegex.test(template));
          const hasEnglishInResult = forbiddenEnglishRegex.test(result);

          let status: Status = 'OK';

          if (hasMissingTemplate) {
            status = 'MISSING_TEMPLATE';
            missingTemplates += 1;
          } else if (hasEnglishInTemplates || hasEnglishInResult) {
            status = 'FAIL';
            failed += 1;
          } else {
            passed += 1;
          }

          rows.push({
            Locale: locale,
            Industry: industry,
            Level: level,
            Status: status,
          });
        });
      });
    });

    const totalTestedCombinations = rows.length;
    const fullyLocalized = failed === 0 && missingTemplates === 0;

    console.table(rows);
    console.log('AI Improvements summary:', {
      totalTestedCombinations,
      passed,
      failed,
      missingTemplates,
    });
    console.log(`AI Improvements fully localized: ${fullyLocalized ? 'YES' : 'NO'}`);

    expect(totalTestedCombinations).toBe(198);
    expect(failed).toBe(0);
    expect(missingTemplates).toBe(0);
  });
});
