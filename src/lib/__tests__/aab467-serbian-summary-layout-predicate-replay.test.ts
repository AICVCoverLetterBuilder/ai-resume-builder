import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  runSummaryV2,
} from '@/lib/cv-summary-v2';
import { applyFinalizedSummaryToCv, finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { AI_USAGE_SCHEMA_VERSION, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';

const REF = '2026-08-16';

function work(options: Partial<WorkExperience> & Pick<WorkExperience, 'id' | 'position' | 'company' | 'startDate' | 'description'>): WorkExperience {
  return {
    endDate: '', isPresent: false, originalUserDescription: options.description,
    canonicalDescription: options.description, descriptionOrigin: 'user', ...options,
  } as WorkExperience;
}

function deviceCv(summary = ''): CVData {
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' },
    summary, contentLocale: 'sr', education: [], skills: [], languages: [],
    experience: [
      work({ id: '90ceb215', position: 'Grafička dizajnerka', company: 'Rewitu Current Test', startDate: '2026-03', isPresent: true, descriptionSourceLocale: 'hi', positionSourceLocale: 'hi', description: 'विज़ुअल अवधारणाएँ और डिजिटल सामग्री के लिए लेआउट तैयार करती हूँ।\nविभिन्न परियोजनाओं के लिए ग्राफिक्स और छवियों को संपादित करती हूँ।\nपरियोजना टीम के सदस्यों के साथ ड्राफ्ट और संशोधनों का समन्वय करती हूँ।' }),
      work({ id: 'be5c794b', position: 'Grafička dizajnerka', company: 'TestWerk GmbH', startDate: '2024-01', endDate: '2026-02', descriptionSourceLocale: 'hi', positionSourceLocale: 'hi', description: 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।' }),
      work({ id: 'a221433', position: 'Grafička dizajnerka', company: 'Rewitu', startDate: '2019-06', endDate: '2023-12', descriptionSourceLocale: 'hi', positionSourceLocale: 'hi', description: 'विज़ुअल अवधारणाएँ और डिजिटल सामग्री के लिए लेआउट तैयार करती थी।\nविभिन्न परियोजनाओं के लिए ग्राफिक्स और छवियों को संपादित करती थी।\nपरियोजना टीम के सदस्यों के साथ ड्राफ्ट और संशोधनों का समन्वय करती थी।' }),
      work({ id: 'older-ignored', position: 'Dizajner', company: 'Older', startDate: '', description: 'Starija nepovezana dužnost.' }),
      work({ id: 'future-ignored', position: 'Dizajner', company: 'Future', startDate: '', isPresent: false, description: 'Buduća nepovezana dužnost.' }),
    ],
  } as unknown as CVData;
}

const localizedFacts: Record<string, string[]> = {
  '90ceb215': [
    'Priprema vizuelne koncepte i rasporede za digitalne materijale.',
    'Uređuje grafike i slike za različite projekte.',
    'Usklađuje nacrte i izmene sa članovima projektnog tima.',
  ],
  'be5c794b': [
    'Kreirala je grafičke materijale za štampane i digitalne medije.',
    'Razvijala je koncepte vizuelnog dizajna prema potrebama klijenata.',
    'Pregledala je projekte dizajna i proveravala kvalitet finalnih rezultata.',
  ],
  'a221433': [
    'Pripremala je vizuelne koncepte i rasporede za digitalne materijale.',
    'Uređivala je grafike i slike za različite projekte.',
    'Usklađivala je nacrte i izmene sa članovima projektnog tima.',
  ],
};

async function localizedManifest(cv: CVData) {
  const selection = buildSummaryV2ManifestForCv({ cv, locale: 'sr', gender: 'female', referenceDateIso: REF });
  const transport = async (input: { targetLocale: string; entries: Array<{ entryId: string; facts: Array<{ factId: string }> }> }) => ({
    targetLocale: input.targetLocale,
    entries: input.entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle: 'Grafička dizajnerka',
      facts: entry.facts.map((fact, index) => ({ factId: fact.factId, localizedText: localizedFacts[entry.entryId]![index]! })),
    })),
  });
  await localizeSummaryV2Manifest({ manifest: selection, transport });
  const cached = await localizeSummaryV2Manifest({ manifest: selection, transport });
  expect(cached.validation?.ok).toBe(true);
  return { selection, localized: cached.manifest! };
}

describe('AAB467 Serbian Summary layout predicate replay', () => {
  beforeEach(() => setSummaryV2EnabledForTests(true));
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('replays the empty Serbian device context without mutating a layout noun into a predicate', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const cv = deviceCv();
    const { selection, localized } = await localizedManifest(cv);
    expect(selection.current?.entryId).toBe('90ceb215');
    expect(selection.priors.map((entry) => entry.entryId)).toEqual(['be5c794b', 'a221433']);
    expect(selection.requiredCurrentFacts).toHaveLength(3);
    expect(selection.requiredPriorFacts).toHaveLength(6);

    const generated = runSummaryV2({ cv, locale: 'sr', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized });
    expect(generated.countedAsSuccess, JSON.stringify({ reason: generated.reason, text: generated.text, validation: generated.validation })).toBe(true);
    expect(generated.text).toMatch(/pripremam vizuelne koncepte i rasporede za digitalne materijale/iu);
    expect(generated.text).toMatch(/sam kreirala grafičke materijale/iu);
    expect(generated.text).not.toMatch(/sam\s+\p{L}+(?:ala|ela|ila)\s+je|raspored(?:em|ela)/iu);
    expect(generated.validation.coveredCurrentFactCount).toBe(3);
    expect(generated.validation.coveredPriorFactCount).toBe(6);
    expect(generated.validation.targetLocalePurityPassed).toBe(true);

    const finalized = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_generate', requestedLocale: 'sr', gender: 'female', cv,
      candidate: generated.text, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      localizedSummaryManifest: localized,
    });
    expect(finalized.blocked, finalized.reason).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    const applied = applyFinalizedSummaryToCv(cv, 'sr', finalized);
    expect(fingerprintText(applied.summary || '')).toBe(fingerprintText(finalized.text));
    const usage = recordProAiUserActionSuccess({ schemaVersion: AI_USAGE_SCHEMA_VERSION, count: 23, windowStart: Date.now(), policyLimit: 100 });
    expect(usage.count).toBe(24);
  });

  it('keeps the generated Serbian device summary as a safe no-op when Stronger only has neutral coordination available', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const cv = deviceCv();
    const { localized } = await localizedManifest(cv);
    const generated = runSummaryV2({ cv, locale: 'sr', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized });
    expect(generated.countedAsSuccess).toBe(true);

    const stronger = runSummaryV2({
      cv: deviceCv(generated.text),
      locale: 'sr',
      gender: 'female',
      candidate: generated.text,
      rewriteStyle: 'stronger',
      referenceDateIso: REF,
      localizedManifest: localized,
    });

    expect(stronger.countedAsSuccess).toBe(false);
    expect(stronger.blocked).toBe(true);
    expect(stronger.reason).toBe('style_no_safe_material_change');
    expect(stronger.text).toBe(generated.text);
    expect(stronger.validation.coveredCurrentFactCount).toBe(3);
    expect(stronger.validation.coveredPriorFactCount).toBe(6);
    const usageBefore = 24;
    const usageAfter = stronger.countedAsSuccess
      ? recordProAiUserActionSuccess({ schemaVersion: AI_USAGE_SCHEMA_VERSION, count: usageBefore, windowStart: Date.now(), policyLimit: 100 }).count
      : usageBefore;
    expect(usageAfter).toBe(24);
    expect(stronger.countedAsSuccess).toBe(false);
  });
});
