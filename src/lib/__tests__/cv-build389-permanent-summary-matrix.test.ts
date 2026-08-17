/**
 * Permanent AAB-389 — Summary matrix
 * 12 locales × 5 actions × 3 genders = 180 production-path cases.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  setSummaryV2EnabledForTests,
} from '@/lib/cv-summary-v2';
import {
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { CV_AI_PERMANENT_AAB389_REGRESSION_REVISION } from '@/lib/cv-ai-permanent-aab389-regression';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';
import {
  AAB389_LOCALES,
  AAB389_GENDERS,
  AAB389_SUMMARY_ACTIONS,
  AAB389_REF,
  aab389Cv,
  aab389DeterministicSource,
  aab389FinalizeSummary,
  aab389CommitSummary,
  aab389AssertSummarySuccess,
  aab389SeedUsage,
  aab389Hash,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

describe('AAB-389 permanent Summary matrix (180)', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(10);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('embeds permanent revision in runtime marker set', () => {
    expect(CV_AI_PERMANENT_AAB389_REGRESSION_REVISION)
      .toBe('cv-ai-permanent-aab389-regression-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(CV_AI_PERMANENT_AAB389_REGRESSION_REVISION);
  });

  it('180 runtime cases: locale × action × gender through finalize→apply→usage', () => {
    let executed = 0;
    let usage = 10;

    for (const locale of AAB389_LOCALES) {
      for (const gender of AAB389_GENDERS) {
        const source = aab389DeterministicSource(locale, gender.value);
        expect(source.length, `${locale}/${gender.key} source`).toBeGreaterThan(20);

        for (const action of AAB389_SUMMARY_ACTIONS) {
          const label = `${locale}/${gender.key}/${action}`;
          aab389SeedUsage(usage);
          const existing = action === 'generate_empty' ? '' : source;
          const fin = aab389FinalizeSummary({
            locale,
            gender: gender.value,
            action,
            existingSummary: existing,
          });
          if (locale === 'sr' && action === 'shorter' && fin.blocked) {
            expect(fin.reason, label).toBe('style_no_safe_material_change');
            expect(fin.countedAsSuccess, label).toBe(false);
            expect(getProAiUsageCount(), label).toBe(usage);
            executed += 1;
            continue;
          }
          const text = aab389AssertSummarySuccess(fin, locale, label);

          // Style fulfillment when a rewrite was requested.
          if (action === 'stronger') {
            expect(fin.diagnostics?.strongerStyleFulfilled, label).toBe(true);
            expect(fin.diagnostics?.nativeStrongSurfacePassed, label).toBe(true);
            expect(aab389Hash(text), label).not.toBe(aab389Hash(source));
          }
          if (action === 'professional') {
            expect(fin.diagnostics?.professionalStyleFulfilled, label).toBe(true);
            expect(aab389Hash(text), label).not.toBe(aab389Hash(source));
          }
          if (action === 'shorter') {
            expect(fin.diagnostics?.shorterStyleFulfilled, label).toBe(true);
          }
          if (action === 'generate_existing') {
            expect(aab389Hash(text), label).not.toBe(aab389Hash(source));
          }

          const cv = aab389Cv({
            locale,
            gender: gender.value,
            summary: existing,
          });
          const commit = aab389CommitSummary({
            locale,
            cv,
            fin,
            usageBefore: usage,
            requestId: `aab389-sum-${locale}-${gender.key}-${action}`,
            gender: gender.value,
          });
          expect(commit.visibleHash, label).toBe(aab389Hash(text));
          expect(commit.cvRefHash, label).toBe(commit.visibleHash);
          expect(commit.reactHash, label).toBe(commit.visibleHash);
          expect(commit.persistedHash, label).toBe(commit.visibleHash);
          expect(commit.raceGuardResult, label).toBe('ok');
          expect(commit.usageAfter, label).toBe(usage + 1);
          expect(getProAiUsageCount(), label).toBe(usage + 1);
          usage += 1;
          executed += 1;
        }
      }
    }

    expect(executed).toBe(12 * 5 * 3);
    expect(AAB389_REF).toBe('2026-07-01');
  });
});
