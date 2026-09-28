import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cv-ai-unit-locale-purity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cv-ai-unit-locale-purity')>();
  return {
    ...actual,
    validateAiUnitLocalePurity: () => ({
      ok: false,
      unitCount: 1,
      detectedLocaleByUnit: ['es'],
      detectedScriptByUnit: ['latin'],
      wrongLocaleUnitCount: 0,
      wrongScriptUnitCount: 0,
      mixedLanguageUnitCount: 0,
      sourceLanguageLeakageDetected: false,
      unexpectedLocaleCodes: [],
      ambiguousLocaleCodes: ['es'],
      targetLocalePurityPassed: false,
      units: [],
      reason: 'target_locale_purity_failed',
    }),
  };
});

vi.mock('@/lib/cv-content-locale', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cv-content-locale')>();
  return {
    ...actual,
    detectTextLocale: () => 'es',
  };
});

import { classifyExportLocalizedTitleFailure } from '@/lib/cv-export-title-localization';

describe('title-localization defensive client purity subcode', () => {
  it('retains the final target-locale-purity predicate as a finite rejection subcode', () => {
    expect(classifyExportLocalizedTitleFailure({
      sourceTitle: 'Source role',
      sourceLocale: 'en',
      targetLocale: 'fr',
      localizedTitle: 'Candidate role',
    })).toBe('target_locale_purity_failed');
  });
});
