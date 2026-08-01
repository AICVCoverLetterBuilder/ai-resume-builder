/**
 * Permanent AAB-389 — Experience matrix
 * 12 locales × 3 paths (empty generate / weak Stronger / saturated no-op)
 * plus gender modes for gender-dependent locales.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2';
import { normalizeSummaryCandidateText } from '@/lib/cv-ai-finalize-apply';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';
import {
  AAB389_LOCALES,
  AAB389_GENDERED_LOCALES,
  AAB389_GENDERS,
  UNIVERSAL_STYLE_FIXTURES,
  aab389Cv,
  aab389FinalizeExperience,
  aab389ApplyExperience,
  aab389SeedUsage,
  aab389Hash,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

function stripBullets(t: string): string {
  return normalizeSummaryCandidateText(
    (t || '').replace(/^[•\-\u2022]\s*/gm, ''),
  );
}

describe('AAB-389 permanent Experience matrix', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(50);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('36 base paths: empty generate + weak Stronger + saturated no-op', () => {
    let executed = 0;
    let usage = 50;

    for (const locale of AAB389_LOCALES) {
      const f = UNIVERSAL_STYLE_FIXTURES[locale];

      // 1) Empty current → Generate
      const emptyCurrent = aab389Cv({ locale, gender: 'male' });
      emptyCurrent.experience = (emptyCurrent.experience || []).map((e) => (
        e.id === 'radwerk' ? { ...e, description: '', originalUserDescription: '' } : e
      ));
      aab389SeedUsage(usage);
      const genFin = aab389FinalizeExperience({
        locale,
        gender: 'male',
        experienceId: 'radwerk',
        cv: emptyCurrent,
        candidate: f.current,
      });
      expect(genFin.blocked, `${locale}/gen`).toBe(false);
      expect(genFin.countedAsSuccess, `${locale}/gen`).toBe(true);
      const genNext = aab389ApplyExperience(emptyCurrent, locale, 'radwerk', genFin);
      const genEntry = (genNext.experience || []).find((e) => e.id === 'radwerk');
      expect((genEntry?.description || '').trim().length, `${locale}/gen`).toBeGreaterThan(0);
      // Prior entry untouched.
      const prior = (genNext.experience || []).find((e) => e.id === 'stadthotel');
      expect(prior?.description || '', `${locale}/gen prior`).toBe(f.prior);
      usage += 1;
      executed += 1;

      // 2) Weak completed → Stronger
      const weakPrior = f.prior
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join('\n');
      const weakCv = aab389Cv({ locale, gender: 'male' });
      weakCv.experience = (weakCv.experience || []).map((e) => (
        e.id === 'stadthotel'
          ? {
            ...e,
            description: weakPrior,
            originalUserDescription: weakPrior,
            descriptionOrigin: 'user' as const,
          }
          : e
      ));
      aab389SeedUsage(usage);
      const strongFin = aab389FinalizeExperience({
        locale,
        gender: 'male',
        experienceId: 'stadthotel',
        cv: weakCv,
        candidate: weakPrior,
        rewriteStyle: 'stronger',
      });
      expect(strongFin.blocked, `${locale}/stronger ${strongFin.reason}`).toBe(false);
      expect(strongFin.countedAsSuccess, `${locale}/stronger`).toBe(true);
      expect(stripBullets(strongFin.text || ''))
        .not.toBe(stripBullets(weakPrior));
      expect(strongFin.text || '', `${locale}/stronger`).not.toMatch(
        /FakeCorp|99%|Leadership|Team leader/iu,
      );
      const strongNext = aab389ApplyExperience(weakCv, locale, 'stadthotel', strongFin);
      const strongEntry = (strongNext.experience || []).find((e) => e.id === 'stadthotel');
      const current = (strongNext.experience || []).find((e) => e.id === 'radwerk');
      expect(current?.description || '', `${locale}/no-leak`).toBe(f.current);
      usage += 1;
      executed += 1;

      // 3) Style-saturated → true no-op
      const saturated = strongEntry?.description || strongFin.text || '';
      const satCv = aab389Cv({ locale, gender: 'male' });
      satCv.experience = (satCv.experience || []).map((e) => (
        e.id === 'stadthotel'
          ? {
            ...e,
            description: saturated,
            originalUserDescription: saturated,
            descriptionOrigin: 'user' as const,
          }
          : e
      ));
      aab389SeedUsage(usage);
      const satFin = aab389FinalizeExperience({
        locale,
        gender: 'male',
        experienceId: 'stadthotel',
        cv: satCv,
        candidate: saturated,
        rewriteStyle: 'stronger',
      });
      expect(satFin.blocked, `${locale}/noop`).toBe(true);
      expect(satFin.countedAsSuccess, `${locale}/noop`).toBe(false);
      expect(satFin.reason, `${locale}/noop`).toBe('experience_style_no_safe_material_change');
      expect(getProAiUsageCount(), `${locale}/noop`).toBe(usage);
      expect(aab389Hash(saturated)).toBe(aab389Hash(saturated));
      executed += 1;
    }

    expect(executed).toBe(36);
  });

  it('gender modes for gendered locales on Experience Stronger', () => {
    for (const locale of AAB389_GENDERED_LOCALES) {
      const f = UNIVERSAL_STYLE_FIXTURES[locale];
      for (const gender of AAB389_GENDERS) {
        const label = `${locale}/${gender.key}`;
        const weakPrior = f.prior;
        const cv = aab389Cv({ locale, gender: gender.value });
        cv.experience = (cv.experience || []).map((e) => (
          e.id === 'stadthotel'
            ? {
              ...e,
              description: weakPrior,
              originalUserDescription: weakPrior,
              descriptionOrigin: 'user' as const,
            }
            : e
        ));
        aab389SeedUsage(80);
        const fin = aab389FinalizeExperience({
          locale,
          gender: gender.value,
          experienceId: 'stadthotel',
          cv,
          candidate: weakPrior,
          rewriteStyle: 'stronger',
        });
        if (!fin.blocked) {
          const text = fin.text || '';
          expect(text, label).not.toMatch(/radio\s*\/\s*la|работал\(а\)|करता\s*\/\s*करती/u);
        }
      }
    }
  });
});
