/**
 * AAB-390 permanent localization ship matrix.
 *
 * The deterministic fixture is deliberately limited to the external structured
 * provider boundary.  Every CV enters with visible role/duty text in its
 * declared source locale; no target-language text enters before manifest
 * localization and validation.
 */
/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  finalizeCvAiFieldForApply,
  type FinalizeCvAiFieldResult,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildSummaryV2ManifestForCv,
  localizeSummaryV2Manifest,
  setSummaryV2EnabledForTests,
  type SummaryV2LocalizedManifest,
  type SummaryV2LocalizationTransport,
} from '@/lib/cv-summary-v2';
import {
  AAB389_GENDERS,
  AAB389_LOCALES,
  AAB389_REF,
  AAB389_SUMMARY_ACTIONS,
  aab389AssertSummarySuccess,
  aab389CommitSummary,
  aab389Cv,
  aab389Hash,
  aab389SeedUsage,
  UNIVERSAL_STYLE_FIXTURES,
} from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

type Action = (typeof AAB389_SUMMARY_ACTIONS)[number];

function differentSourceFor(target: Locale): Locale {
  const index = AAB389_LOCALES.indexOf(target);
  return AAB389_LOCALES[(index + 1) % AAB389_LOCALES.length];
}

export function aab390ProviderFixture(target: Locale): SummaryV2LocalizationTransport {
  const targetFixture = UNIVERSAL_STYLE_FIXTURES[target];
  const croatian = target === 'hr'
    ? {
      roleC: 'Mehaničar za bicikle',
      roleP: 'Pomoćnik u biciklističkoj radionici',
      current: ['Održava bicikle.', 'Provjerava bicikle zbog kvarova.', 'Mijenja neispravne dijelove bicikala.'],
      prior: ['Provjeravao bicikle zbog kvarova.', 'Bilježio napomene o popravcima.', 'Mijenjao neispravne dijelove bicikala.'],
    }
    : null;
  return async ({ entries }) => ({
    targetLocale: target,
    entries: entries.map((entry) => {
      const current = entry.employmentState === 'present';
      const duties = croatian
        ? (current ? croatian.current : croatian.prior)
        : (current ? targetFixture.current : targetFixture.prior)
          .split('\n')
          .map((text) => text.trim());
      return {
        entryId: entry.entryId,
        localizedRoleTitle: current
          ? (croatian?.roleC || targetFixture.roleC)
          : (croatian?.roleP || targetFixture.roleP),
        facts: entry.facts.map((fact, factIndex) => ({
          factId: fact.factId,
          localizedText: duties[factIndex] || duties[duties.length - 1],
        })),
      };
    }),
  });
}

async function localizedManifest(
  cv: CVData,
  target: Locale,
  gender?: string,
): Promise<SummaryV2LocalizedManifest> {
  const manifest = buildSummaryV2ManifestForCv({
    cv, locale: target, gender, referenceDateIso: AAB389_REF,
  });
  expect(manifest).not.toBeNull();
  const outcome = await localizeSummaryV2Manifest({
    manifest: manifest!, transport: aab390ProviderFixture(target),
  });
  expect(outcome.manifest, `${cv.id}->${target}: ${outcome.reason}`).not.toBeNull();
  expect(outcome.reason, `${cv.id}->${target}`).toBeNull();
  return outcome.manifest!;
}

async function finalize(options: {
  source: Locale;
  target: Locale;
  gender?: string;
  action: Action;
  summary: string;
}): Promise<{ cv: CVData; fin: FinalizeCvAiFieldResult }> {
  const cv = aab389Cv({ locale: options.source, gender: options.gender, summary: options.summary });
  const localized = await localizedManifest(cv, options.target, options.gender);
  const rewriteStyle = options.action === 'shorter' || options.action === 'stronger'
    || options.action === 'professional'
    ? options.action
    : undefined;
  const fin = finalizeCvAiFieldForApply({
    field: 'summary',
    action: rewriteStyle ? `summary_${rewriteStyle}` : 'summary_generate',
    requestedLocale: options.target,
    gender: options.gender,
    cv,
    candidate: '',
    referenceDateIso: AAB389_REF,
    durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], AAB389_REF),
    localizedSummaryManifest: localized,
    ...(rewriteStyle ? { rewriteStyle } : {}),
  });
  return { cv, fin };
}

describe('AAB-390 cross-locale ship matrices', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    aab389SeedUsage(100);
  });
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('executes 180/180 target-locale cross-locale production-path cases', async () => {
    let executed = 0;
    let usage = 100;
    for (const target of AAB389_LOCALES) {
      const source = differentSourceFor(target);
      for (const gender of AAB389_GENDERS) {
        for (const action of AAB389_SUMMARY_ACTIONS) {
          const seed = await finalize({ source, target, gender: gender.value, action: 'generate_empty', summary: '' });
          const existing = action === 'generate_empty' ? '' : seed.fin.text;
          const { cv, fin } = action === 'generate_empty'
            ? seed
            : await finalize({ source, target, gender: gender.value, action, summary: existing });
          const label = `${source}->${target}/${gender.key}/${action}`;
          if (target === 'sr' && (action === 'stronger' || action === 'shorter') && fin.blocked) {
            expect(fin.countedAsSuccess, label).toBe(false);
            expect(fin.reason, label).toBe('style_no_safe_material_change');
            expect(aab389Hash(fin.text || ''), label).toBe(aab389Hash(existing || ''));
            executed += 1;
            continue;
          }
          const text = aab389AssertSummarySuccess(fin, target, label);
          expect(fin.diagnostics?.crossLocaleLocalizationRequired, label).toBe(true);
          expect(fin.diagnostics?.localizationSource, label)
            .toMatch(/provider|validated_cache|mixed_authoritative/);
          expect(fin.diagnostics?.entryIdParityPassed, label).toBe(true);
          expect(fin.diagnostics?.factIdParityPassed, label).toBe(true);
          expect(fin.diagnostics?.factOwnershipParityPassed, label).toBe(true);
          expect(fin.diagnostics?.targetLocalePurityPassed, label).toBe(true);
          expect(fin.diagnostics?.targetScriptPurityPassed, label).toBe(true);
          expect(fin.diagnostics?.sourceLanguageLeakageDetected, label).toBe(false);
          expect(fin.diagnostics?.coveredCurrentDutyFactCount, label).toBe(3);
          expect(fin.diagnostics?.coveredPriorDutyFactCount, label).toBe(3);
          const commit = aab389CommitSummary({
            locale: target, cv, fin, usageBefore: usage, gender: gender.value,
            requestId: `aab390-fast-${source}-${target}-${gender.key}-${action}`,
          });
          expect(commit.visibleHash, label).toBe(aab389Hash(text));
          expect(commit.cvRefHash, label).toBe(commit.visibleHash);
          expect(commit.reactHash, label).toBe(commit.visibleHash);
          expect(commit.persistedHash, label).toBe(commit.visibleHash);
          expect(commit.usageAfter, label).toBe(usage + 1);
          usage += 1;
          executed += 1;
        }
      }
    }
    expect(executed).toBe(180);
  });

  it('executes 2,160/2,160 same- and cross-locale production-path cases', async () => {
    let executed = 0;
    let sameLocale = 0;
    let crossLocale = 0;
    let usage = 100;
    for (const source of AAB389_LOCALES) {
      for (const target of AAB389_LOCALES) {
        for (const gender of AAB389_GENDERS) {
          for (const action of AAB389_SUMMARY_ACTIONS) {
            const seed = await finalize({ source, target, gender: gender.value, action: 'generate_empty', summary: '' });
            const existing = action === 'generate_empty' ? '' : seed.fin.text;
            const { cv, fin } = action === 'generate_empty'
              ? seed
              : await finalize({ source, target, gender: gender.value, action, summary: existing });
            const label = `${source}->${target}/${gender.key}/${action}`;
            if (target === 'sr' && (action === 'stronger' || action === 'shorter') && fin.blocked) {
              expect(fin.countedAsSuccess, label).toBe(false);
            expect(fin.reason, label).toBe('style_no_safe_material_change');
            expect(aab389Hash(fin.text || ''), label).toBe(aab389Hash(existing || ''));
            if (source === target) sameLocale += 1;
            else crossLocale += 1;
            executed += 1;
              continue;
            }
            const text = aab389AssertSummarySuccess(fin, target, label);
            expect(fin.diagnostics?.entryIdParityPassed, label).toBe(true);
            expect(fin.diagnostics?.factIdParityPassed, label).toBe(true);
            expect(fin.diagnostics?.factOwnershipParityPassed, label).toBe(true);
            expect(fin.diagnostics?.targetLocalePurityPassed, label).toBe(true);
            expect(fin.diagnostics?.targetScriptPurityPassed, label).toBe(true);
            expect(fin.diagnostics?.sourceLanguageLeakageDetected, label).toBe(false);
            expect(fin.diagnostics?.coveredCurrentDutyFactCount, label).toBe(3);
            expect(fin.diagnostics?.coveredPriorDutyFactCount, label).toBe(3);
            const commit = aab389CommitSummary({
              locale: target, cv, fin, usageBefore: usage, gender: gender.value,
              requestId: `aab390-pair-${source}-${target}-${gender.key}-${action}`,
            });
            expect(commit.visibleHash, label).toBe(aab389Hash(text));
            expect(commit.persistedHash, label).toBe(commit.visibleHash);
            expect(commit.usageAfter, label).toBe(usage + 1);
            if (source === target) sameLocale += 1;
            else crossLocale += 1;
            usage += 1;
            executed += 1;
          }
        }
      }
    }
    expect(executed).toBe(2160);
    expect(sameLocale).toBe(180);
    expect(crossLocale).toBe(1980);
  }, 180_000);
});
