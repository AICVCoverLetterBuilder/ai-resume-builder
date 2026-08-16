/**
 * Permanent AAB-389 — native-surface positive + locale regression assertions.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2';
import {
  AAB389_LOCALES,
  aab389DeterministicSource,
  aab389FinalizeSummary,
  aab389AssertSummarySuccess,
  aab389SeedUsage,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';
import type { Locale } from '@/lib/i18n/translations';

describe('AAB-389 permanent native-surface', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(20);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('Stronger visible text passes every locale regression assertion', () => {
    const checks: Partial<Record<Locale, (text: string) => void>> = {
      es: (t) => {
        expect(t).toMatch(/sustituí/u);
        expect(t).not.toMatch(/sustituyé/u);
        expect(t).toMatch(/(?:a la vez que|así como)/u);
      },
      'pt-BR': (t) => {
        expect(t).toMatch(/substituo/u);
        expect(t).not.toMatch(/(?:^|[^\p{L}])substitui(?=[^\p{L}])/u);
      },
      fr: (t) => {
        expect(t).not.toMatch(/ainsi que remplace(?=[^\p{L}])/u);
        expect(t).not.toMatch(/ainsi que remplaçais/u);
        expect(t).toMatch(/ainsi que j(?:e |')/u);
      },
      it: (t) => {
        // Generic quality/manner wording is not source-authorized; the
        // semantic Stronger gate must remove it rather than inventing it.
        expect(t).not.toMatch(/con rigore/u);
        expect(t).not.toMatch(/con ricore/u);
        expect(t).toMatch(/\bho\s+(?:controllato|registrato|sostituito)/iu);
      },
      ar: (t) => {
        expect(t).toMatch(/^أمتلك/u);
        expect(t).toMatch(/راجعت|أعددت|ضبطت/u);
        expect(t).not.toMatch(/ت\u0651/u);
        expect(t).not.toMatch(/[\u0600-\u06FF]\s*,/u);
      },
      sr: (t) => {
        expect(t).toMatch(/^Imam /u);
        expect(t).not.toMatch(/radio\s*\/\s*la|zaposlen\s*\/\s*a/u);
        expect(t).toMatch(/Prethodno sam radio\b/u);
      },
      hr: (t) => {
        expect(t).toMatch(/^Imam /u);
        expect(t).not.toMatch(/radio\s*\/\s*la/u);
        expect(t).toMatch(/gdje/u);
        expect(t).not.toMatch(/(?:^|[^\p{L}])gde(?=[^\p{L}])/u);
      },
      ru: (t) => {
        expect(t).toMatch(/^У меня /u);
        expect(t).not.toMatch(/работал\(а\)/u);
        expect(t).not.toMatch(/работа(?:ю|л|ла)\s+как\s/u);
        expect(t).toMatch(/, а также /u);
      },
      hi: (t) => {
        expect(t).toMatch(/मेरे पास .+ है।/u);
        expect(t).not.toMatch(/करता\s*\/\s*करती|था\s*\/\s*थी/u);
        expect(t).not.toMatch(/^जहाँ/u);
      },
      ja: (t) => {
        expect(t).toMatch(/実務経験があります。/u);
        expect(t).not.toMatch(/通算で約5年半。/u);
        expect(t).not.toMatch(/、また/u);
        expect(t).not.toMatch(/(?:う|る)、|した、/u);
      },
      de: (t) => {
        expect(t).not.toMatch(/zielgerichtet\s+als/iu);
        expect(t).not.toMatch(/\bübernahm(?:\s+\p{L}+){0,4}\s+als\b/iu);
        expect((t.match(/\bzuverlässig\b/giu) || []).length).toBeLessThanOrEqual(1);
        expect(t).toMatch(/Derzeit arbeite ich als/iu);
      },
      en: (t) => {
        expect(t).toMatch(/^I bring .+\. I currently work as .+\. Previously, I worked as .+\.$/u);
        expect(t).not.toMatch(/\bI bring\s*[.…]/u);
        expect(t).toMatch(/as well as/iu);
      },
    };

    for (const locale of AAB389_LOCALES) {
      const source = aab389DeterministicSource(locale, 'male');
      const fin = aab389FinalizeSummary({
        locale,
        gender: 'male',
        action: 'stronger',
        existingSummary: source,
      });
      const text = aab389AssertSummarySuccess(fin, locale, locale);
      expect(fin.diagnostics?.strongerStyleFulfilled, locale).toBe(true);
      expect(fin.diagnostics?.nativeStrongSurfacePassed, locale).toBe(true);
      expect(fin.diagnostics?.repeatedStyleModifierCount ?? 0, locale).toBe(0);
      expect(fin.diagnostics?.stackedModifierDetected, locale).not.toBe(true);
      expect(fin.diagnostics?.modifierOnlyTransformationDetected, locale).not.toBe(true);
      checks[locale]?.(text);
    }
  });
});
