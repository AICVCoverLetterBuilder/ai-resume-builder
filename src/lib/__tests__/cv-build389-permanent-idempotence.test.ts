/**
 * Permanent AAB-389 — idempotence and seeded fixture coverage.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import {
  setSummaryV2EnabledForTests,
  evaluateNativeRealizationContract,
  evaluateSummaryV2NativeSurface,
  analyzeStrongerNativeSurface,
} from '@/lib/cv-summary-v2';
import {
  AAB389_LOCALES,
  aab389Cv,
  aab389DeterministicSource,
  aab389FinalizeSummary,
  aab389AssertSummarySuccess,
  aab389SeedUsage,
  aab389Hash,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

const SEEDS = ['one', 'two', 'five', 'empty_employer', 'punct_employer', 'current_last'] as const;
const SAMPLE_LOCALES: Locale[] = ['en', 'de', 'sr', 'ar', 'ja', 'hi'];

describe('AAB-389 permanent idempotence', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(70);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('same seed twice yields identical candidate/final/coverage/duration', () => {
    for (const locale of SAMPLE_LOCALES) {
      for (const seed of SEEDS) {
        const label = `${locale}/${seed}`;
        const sourceA = aab389DeterministicSource(locale, 'male', seed);
        const sourceB = aab389DeterministicSource(locale, 'male', seed);
        expect(aab389Hash(sourceA), label).toBe(aab389Hash(sourceB));

        const finA = aab389FinalizeSummary({
          locale,
          gender: 'male',
          action: 'stronger',
          existingSummary: sourceA,
          seed,
        });
        const finB = aab389FinalizeSummary({
          locale,
          gender: 'male',
          action: 'stronger',
          existingSummary: sourceB,
          seed,
        });
        // Empty-employer / one-entry may have different coverage counts but must be stable.
        if (finA.blocked || finB.blocked) {
          expect(finA.blocked, label).toBe(finB.blocked);
          expect(finA.reason, label).toBe(finB.reason);
          continue;
        }
        const textA = aab389AssertSummarySuccess(finA, locale, `${label}/a`);
        const textB = aab389AssertSummarySuccess(finB, locale, `${label}/b`);
        expect(aab389Hash(textA), label).toBe(aab389Hash(textB));
        expect(finA.diagnostics?.coveredCurrentDutyFactCount, label)
          .toBe(finB.diagnostics?.coveredCurrentDutyFactCount);
        expect(finA.diagnostics?.coveredPriorDutyFactCount, label)
          .toBe(finB.diagnostics?.coveredPriorDutyFactCount);
        expect(finA.diagnostics?.durationExpressionCount, label)
          .toBe(finB.diagnostics?.durationExpressionCount);
      }
    }
  });

  it('finalizers and validators are idempotent on the same text', () => {
    for (const locale of AAB389_LOCALES) {
      const source = aab389DeterministicSource(locale, 'male');
      const fin = aab389FinalizeSummary({
        locale,
        gender: 'male',
        action: 'stronger',
        existingSummary: source,
      });
      if (fin.blocked) continue;
      const text = fin.text || '';
      const c1 = evaluateNativeRealizationContract({ text, locale });
      const c2 = evaluateNativeRealizationContract({ text, locale });
      expect(c1).toEqual(c2);
      const n1 = evaluateSummaryV2NativeSurface({ text, locale });
      const n2 = evaluateSummaryV2NativeSurface({ text, locale });
      expect(n1.nativeSurfaceValidationPassed).toBe(n2.nativeSurfaceValidationPassed);
      expect(n1.nativeSurfaceRejectionReasons).toEqual(n2.nativeSurfaceRejectionReasons);
      const s1 = analyzeStrongerNativeSurface({
        sourceText: source,
        candidateText: text,
        locale,
      });
      const s2 = analyzeStrongerNativeSurface({
        sourceText: source,
        candidateText: text,
        locale,
      });
      expect(s1).toEqual(s2);
      // Prove CV builder for seeded variants does not throw.
      expect(aab389Cv({ locale, seed: 'five', gender: 'male' }).experience?.length).toBe(5);
    }
  });
});
