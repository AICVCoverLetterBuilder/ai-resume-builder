/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import type { CVData } from '@/lib/types';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { buildSummaryV2ManifestForCv, localizeSummaryV2Manifest, setSummaryV2EnabledForTests, type SummaryV2LocalizationTransport } from '@/lib/cv-summary-v2';
import { AAB389_REF, aab389AssertSummarySuccess, aab389CommitSummary, aab389Cv, aab389Hash, aab389SeedUsage, UNIVERSAL_STYLE_FIXTURES } from '@/lib/__tests__/helpers/aab389-permanent-fixtures';

const mixedSources: Locale[] = ['de', 'es', 'fr', 'sr', 'ru'];
const mixedTargets: Locale[] = ['en', 'de', 'es', 'sr', 'ru', 'ja'];

function provider(target: Locale): SummaryV2LocalizationTransport {
  const fixture = UNIVERSAL_STYLE_FIXTURES[target];
  const croatian = target === 'hr'
    ? { roleC: 'Mehaničar za bicikle', roleP: 'Pomoćnik u biciklističkoj radionici', current: ['Održava bicikle.', 'Provjerava bicikle zbog kvarova.', 'Mijenja neispravne dijelove bicikala.'], prior: ['Provjeravao bicikle zbog kvarova.', 'Bilježio napomene o popravcima.', 'Mijenjao neispravne dijelove bicikala.'] }
    : null;
  return async ({ entries }) => ({ targetLocale: target, entries: entries.map((entry) => {
    const current = entry.employmentState === 'present';
    const duties = croatian ? (current ? croatian.current : croatian.prior) : (current ? fixture.current : fixture.prior).split('\n').map((text) => text.trim());
    return { entryId: entry.entryId, localizedRoleTitle: current ? (croatian?.roleC || fixture.roleC) : (croatian?.roleP || fixture.roleP), facts: entry.facts.map((fact, index) => ({ factId: fact.factId, localizedText: duties[index] || duties.at(-1)! })) };
  }) });
}

function mixedCv(): CVData {
  const cv = aab389Cv({ locale: 'en', seed: 'five' });
  cv.experience!.forEach((entry, index) => {
    const source = mixedSources[index];
    const fixture = UNIVERSAL_STYLE_FIXTURES[source];
    entry.generatedLocale = source;
    entry.position = index === 0 ? fixture.roleC : fixture.roleP;
    entry.description = index === 0 ? fixture.current : fixture.prior;
    entry.originalUserDescription = entry.description;
  });
  return cv;
}

async function localize(cv: CVData, target: Locale) {
  const manifest = buildSummaryV2ManifestForCv({ cv, locale: target, referenceDateIso: AAB389_REF });
  expect(manifest).not.toBeNull();
  const result = await localizeSummaryV2Manifest({ manifest: manifest!, transport: provider(target) });
  expect(result.reason, target).toBeNull();
  expect(result.manifest, target).not.toBeNull();
  return { manifest: manifest!, localized: result.manifest! };
}

describe('AAB-390 mixed-entry and sequential locale ship gates', () => {
  beforeEach(() => { setSummaryV2EnabledForTests(true); aab389SeedUsage(100); });
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('localizes two mixed current/prior entry sets to each required target without losing ownership or employers', async () => {
    for (const target of mixedTargets) {
      for (let variant = 0; variant < 2; variant += 1) {
        const cv = mixedCv();
        if (variant) cv.experience!.reverse();
        const { manifest, localized } = await localize(cv, target);
        expect(localized.entries.map((entry) => entry.entryId).sort(), target).toEqual(
          [...new Set([...(manifest.current ? [manifest.current.entryId] : []), ...manifest.priors.map((entry) => entry.entryId)])].sort(),
        );
        for (const entry of localized.entries) {
          expect(entry.employer, `${target}/${entry.entryId}`).toBe(
            cv.experience!.find((experience) => experience.id === entry.entryId)?.company || '',
          );
        }
        const fin = finalizeCvAiFieldForApply({
          field: 'summary', action: 'summary_generate', requestedLocale: target, cv, candidate: '',
          referenceDateIso: AAB389_REF, durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], AAB389_REF),
          localizedSummaryManifest: localized,
        });
        const text = aab389AssertSummarySuccess(fin, target, `${target}/${variant}`);
        const committed = aab389CommitSummary({ locale: target, cv, fin, usageBefore: 100 + variant, requestId: `mixed-${target}-${variant}` });
        expect(committed.visibleHash).toBe(aab389Hash(text));
        expect(committed.persistedHash).toBe(committed.visibleHash);
      }
    }
  });

  it('keeps the newest locale result authoritative across sequential locale switches', async () => {
    const cv = aab389Cv({ locale: 'de' });
    let visible = '';
    const switches: Array<{ target: Locale; delay: number }> = [
      { target: 'en', delay: 0 }, { target: 'de', delay: 50 }, { target: 'es', delay: 500 },
      { target: 'fr', delay: 850 }, { target: 'sr', delay: 0 }, { target: 'ja', delay: 50 },
      { target: 'ru', delay: 500 }, { target: 'hr', delay: 850 }, { target: 'pt-BR', delay: 0 },
    ];
    for (const { target, delay } of switches) {
      if (delay) await new Promise<void>((resolve) => setTimeout(resolve, delay));
      const { localized } = await localize(cv, target);
      const fin = finalizeCvAiFieldForApply({
        field: 'summary', action: 'summary_generate', requestedLocale: target, cv, candidate: '',
        referenceDateIso: AAB389_REF, durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], AAB389_REF),
        localizedSummaryManifest: localized,
      });
      visible = aab389AssertSummarySuccess(fin, target, `sequential/${target}`);
      expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
      expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    }
    expect(visible).toMatch(/Tenho cerca de/u);
  });
});
