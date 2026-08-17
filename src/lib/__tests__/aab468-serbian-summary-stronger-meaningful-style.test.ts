import { describe, expect, it } from 'vitest';
import {
  evaluateSummaryV2StyleFulfillment,
  isSummaryV2MarkerOnlyStyleChange,
} from '@/lib/cv-summary-v2/rewrite-style';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
} from '@/lib/cv-summary-v2';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import type { CVData, WorkExperience } from '@/lib/types';

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

const DEVICE_SOURCE = [
  'Imam oko sedam godina iskustva.',
  'Trenutno radim kao Grafički dizajner u Rewitu Current Test, gde pripremam vizuelne koncepte i rasporede za digitalne materijale, uređujem grafike i slike za različite projekte i usklađujem nacrte i izmene sa članovima projektnog tima.',
  'Prethodno sam radila kao Grafički dizajner u TestWerk GmbH, gde sam kreirala grafičke materijale za štampane i digitalne medije, razvijala koncepte vizuelnog dizajna prema potrebama klijenata i pregledala projekte dizajna i proveravala kvalitet finalnih rezultata.',
  'Prethodno sam radila kao Grafički dizajner u Rewitu, gde sam pripremala vizuelne koncepte i rasporede za digitalne materijale, uređivala grafike i slike za različite projekte i usklađivala nacrte i izmene sa članovima projektnog tima.',
].join(' ');

describe('AAB468 Serbian Summary Stronger meaningful style gate', () => {
  it('rejects the AAB467 connector-only device transformation as a semantic no-op', () => {
    const connectorOnly = DEVICE_SOURCE
      .replace(', uređujem', ' te uređujem')
      .replace(', razvijala', ' te razvijala')
      .replace(', uređivala', ' te uređivala');
    const result = evaluateSummaryV2StyleFulfillment({
      style: 'stronger', sourceText: DEVICE_SOURCE, candidateText: connectorOnly, locale: 'sr',
    });

    expect(isSummaryV2MarkerOnlyStyleChange(DEVICE_SOURCE, connectorOnly, 'sr', 'stronger')).toBe(true);
    expect(result.strongerStyleFulfilled).toBe(false);
    expect(result.styleValidationPassed).toBe(false);
    expect(result.styleRejectionReasons).toContain('stronger_marker_only');
    expect(result.semanticStyleOperationsApplied).not.toContain('duty_predicate_strengthen');
  });

  it('accepts a grounded predicate-level Stronger change for an unrelated occupation', () => {
    const source = 'Imam iskustvo. Trenutno radim kao tehničarka u Servisu, gde obavljam zadatke održavanja.';
    const stronger = 'Imam iskustvo. Trenutno radim kao tehničarka u Servisu, gde sprovodim zadatke održavanja.';
    const result = evaluateSummaryV2StyleFulfillment({
      style: 'stronger', sourceText: source, candidateText: stronger, locale: 'sr',
    });

    expect(result.strongerVerbTransformationCount).toBe(1);
    expect(result.semanticStyleOperationsApplied).toContain('duty_predicate_strengthen');
    expect(result.strongerStyleFulfilled).toBe(true);
  });

  it('keeps the exact AAB468 Serbian Shorter connector-only compression as a terminal no-op', async () => {
    expect(DEVICE_SOURCE).toHaveLength(766);
    const connectorOnly = DEVICE_SOURCE
      .replace(/,\s+gde\s+sam\s+/giu, ', ')
      .replace(/,\s+gde\s+/giu, ', ')
      .replace(/\bPrethodno\b/giu, 'Ranije');
    expect(connectorOnly.length).toBeLessThan(DEVICE_SOURCE.length);
    expect(connectorOnly.length).toBeGreaterThan(DEVICE_SOURCE.length * 0.95);

    const fulfillment = evaluateSummaryV2StyleFulfillment({
      style: 'shorter', sourceText: DEVICE_SOURCE, candidateText: connectorOnly, locale: 'sr',
    });
    expect(fulfillment.shorterStyleFulfilled).toBe(false);
    expect(fulfillment.styleValidationPassed).toBe(false);
    expect(fulfillment.styleRejectionReasons).toContain('shorter_neutral_only_compression');

    clearSummaryV2LocalizationCacheForTests();
    setSummaryV2EnabledForTests(true);
    const cv = deviceCv(DEVICE_SOURCE) as CVData;
    const selection = buildSummaryV2ManifestForCv({
      cv, locale: 'sr', gender: 'female', referenceDateIso: REF,
    });
    const localized = await localizeSummaryV2Manifest({
      manifest: selection,
      transport: async (input) => ({
        targetLocale: input.targetLocale,
        entries: input.entries.map((entry) => ({
          entryId: entry.entryId,
          localizedRoleTitle: 'Grafička dizajnerka',
          facts: entry.facts.map((fact, index) => ({
            factId: fact.factId,
            localizedText: localizedFacts[entry.entryId]![index]!,
          })),
        })),
      }),
    });
    const finalized = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_shorter', requestedLocale: 'sr', gender: 'female', cv,
      candidate: connectorOnly, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      localizedSummaryManifest: localized.manifest!, rewriteStyle: 'shorter',
    });
    expect(finalized.blocked).toBe(true);
    expect(finalized.reason).toBe('style_no_safe_material_change');
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.text).toBe(DEVICE_SOURCE);
    expect(finalized.diagnostics?.meaningfulChangeDetected).toBe(false);
    expect(finalized.diagnostics?.meaningfulChangeReason).toBeNull();
    expect(finalized.diagnostics?.noOpDetected).toBe(true);
    expect(finalized.diagnostics?.finalCandidateSource).toBe('none');
  });

  it('allows a genuinely compressed Serbian Shorter rewrite after a gde bridge is removed', () => {
    const source = 'Imam sedam godina iskustva. Trenutno radim kao tehničarka u Servisu, gde obavljam zadatke održavanja opreme i vodim detaljnu evidenciju inventara u svakodnevnom radu.';
    const candidate = 'Imam sedam godina iskustva. Trenutno radim kao tehničarka u Servisu; održavam opremu i vodim evidenciju inventara.';
    const result = evaluateSummaryV2StyleFulfillment({
      style: 'shorter', sourceText: source, candidateText: candidate, locale: 'sr',
    });

    expect(candidate.length).toBeLessThan(source.length * 0.97);
    expect(result.shorterStyleFulfilled).toBe(true);
    expect(result.styleValidationPassed).toBe(true);
    expect(result.styleRejectionReasons).not.toContain('shorter_neutral_only_compression');
  });
});
