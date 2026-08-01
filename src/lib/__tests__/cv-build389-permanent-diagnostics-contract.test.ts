/**
 * Permanent AAB-389 — diagnostics truth contract.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import {
  setSummaryV2EnabledForTests,
  analyzeStrongerNativeSurface,
  evaluateSummaryV2NativeSurface,
} from '@/lib/cv-summary-v2';
import {
  AAB389_LOCALES,
  aab389Cv,
  aab389DeterministicSource,
  aab389FinalizeSummary,
  aab389CommitSummary,
  aab389AssertSummarySuccess,
  aab389SeedUsage,
  aab389Hash,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

describe('AAB-389 permanent diagnostics contract', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(60);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('successful Stronger exposes truthful style/native/coverage/hash fields', () => {
    for (const locale of AAB389_LOCALES) {
      const source = aab389DeterministicSource(locale, 'male');
      aab389SeedUsage(60);
      const fin = aab389FinalizeSummary({
        locale,
        gender: 'male',
        action: 'stronger',
        existingSummary: source,
      });
      const text = aab389AssertSummarySuccess(fin, locale, locale);
      const d = fin.diagnostics;
      expect(d?.strongerStyleFulfilled, locale).toBe(true);
      expect(d?.nativeSurfaceValidationPassed, locale).toBe(true);
      expect(d?.nativeStrongSurfacePassed, locale).toBe(true);
      expect(d?.unresolvedGenderPlaceholderDetected, locale).not.toBe(true);
      expect(d?.finiteDurationSentencePassed, locale).not.toBe(false);
      expect(d?.firstPersonPredicateChainPassed, locale).not.toBe(false);
      expect(d?.localeVerbMorphologyPassed, locale).not.toBe(false);
      expect(d?.sentenceCompletenessPassed, locale).not.toBe(false);
      expect(d?.coveredCurrentDutyFactCount, locale).toBe(3);
      expect(d?.coveredPriorDutyFactCount, locale).toBe(3);
      expect(d?.durationExpressionCount ?? 1, locale).toBe(1);
      expect(d?.repeatedStyleModifierCount ?? 0, locale).toBe(0);
      expect(d?.stackedModifierDetected, locale).not.toBe(true);
      expect(d?.modifierOnlyTransformationDetected, locale).not.toBe(true);
      expect(d?.providerAccepted, locale).toBe(false);
      expect(aab389Hash(text), locale).not.toBe(aab389Hash(source));

      const commit = aab389CommitSummary({
        locale,
        cv: aab389Cv({ locale, gender: 'male', summary: source }),
        fin,
        usageBefore: 60,
        requestId: `aab389-diag-${locale}`,
        gender: 'male',
      });
      expect(commit.visibleHash).toBe(aab389Hash(text));
      expect(commit.cvRefHash).toBe(commit.visibleHash);
      expect(commit.reactHash).toBe(commit.visibleHash);
      expect(commit.persistedHash).toBe(commit.visibleHash);
      expect(commit.raceGuardResult).toBe('ok');
      expect(commit.usageAfter).toBe(61);
    }
  });

  it('never reports nativeStrongSurfacePassed for malformed visible text', () => {
    const locale: Locale = 'es';
    const bad = 'Cuento con cinco años. Actualmente trabajo como X, donde sustituyé piezas.';
    const strong = analyzeStrongerNativeSurface({
      sourceText: 'source',
      candidateText: bad,
      locale,
    });
    const native = evaluateSummaryV2NativeSurface({ text: bad, locale });
    expect(strong.nativeStrongSurfacePassed).toBe(false);
    expect(native.nativeSurfaceValidationPassed).toBe(false);
  });
});
