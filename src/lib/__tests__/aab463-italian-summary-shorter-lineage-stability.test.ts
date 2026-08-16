import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  runSummaryV2,
} from '@/lib/cv-summary-v2';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { applyFinalizedSummaryToCv, finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { evaluateSummaryV2NativeSurface } from '@/lib/cv-summary-v2/native-surface';

const REF = '2026-08-16';

function work(options: Partial<WorkExperience> & Pick<WorkExperience, 'id' | 'position' | 'company' | 'startDate' | 'description'>): WorkExperience {
  return {
    endDate: '', isPresent: false, originalUserDescription: options.description,
    canonicalDescription: options.description, descriptionOrigin: 'user', ...options,
  } as WorkExperience;
}

function deviceCv(summary = ''): CVData {
  const testWerk = applyGeneratedExperienceDescription(work({
    id: 'be5c794b', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH',
    startDate: '2024-01', endDate: '2026-02', descriptionSourceLocale: 'hi', positionSourceLocale: 'hi',
    description: 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।',
  }), 'Ho creato materiali grafici per supporti stampati e digitali.\nHo sviluppato concetti di design visivo in base alle esigenze dei clienti.\nHo revisionato progetti di design e verificato la qualità dei risultati finali.', {
    locale: 'it', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'generate_from_context', requestHash: 'aab463-testwerk-it',
  });
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' }, summary, contentLocale: 'it', education: [], skills: [], languages: [],
    experience: [
      work({ id: '90ceb215', position: 'مصممة جرافيك', company: 'Rewitu Current Test', startDate: '2026-03', isPresent: true, descriptionSourceLocale: 'ar', positionSourceLocale: 'ar', description: 'أعد المفاهيم المرئية والتخطيطات للمواد الرقمية.\nأعدل الرسومات والصور لمشاريع متنوعة.\nأنسق المسودات والمراجعات مع أعضاء فريق المشروع.' }),
      testWerk,
      work({ id: 'a221433', position: 'مصممة جرافيك', company: 'Rewitu', startDate: '2019-06', endDate: '2023-12', generatedLocale: 'it', positionSourceLocale: 'it', descriptionSourceLocale: 'ar', description: 'أعددت المفاهيم المرئية والتخطيطات للمواد الرقمية.\nعدلت الرسومات والصور لمشاريع متنوعة.\nنسقت المسودات والمراجعات مع أعضاء فريق المشروع.' }),
    ],
  } as unknown as CVData;
}

const localizedFacts: Record<string, string[]> = {
  be5c794b: [
    'Ho creato materiali grafici per supporti stampati e digitali.',
    'Ho sviluppato concetti di design visivo in base alle esigenze dei clienti.',
    'Ho revisionato progetti di design e verificato la qualità dei risultati finali.',
  ],
  '90ceb215': [
    'Preparo concetti visivi e layout per materiali digitali.',
    'Modifico grafiche e immagini per vari progetti.',
    'Coordino bozze e revisioni con i membri del team di progetto.',
  ],
  a221433: [
    'Ho preparato concept visivi e layout per materiali digitali.',
    'Ho modificato grafiche e immagini per vari progetti.',
    'Ho coordinato bozze e revisioni con i membri del team di progetto.',
  ],
};

async function localize(cv: CVData) {
  const manifest = buildSummaryV2ManifestForCv({ cv, locale: 'it', gender: 'female', referenceDateIso: REF });
  const outcome = await localizeSummaryV2Manifest({
    manifest,
    transport: async (input) => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: 'designer grafica',
        facts: entry.facts.map((fact, index) => ({ factId: fact.factId, localizedText: localizedFacts[entry.entryId]![index]! })),
      })),
    }),
  });
  expect(outcome.validation?.ok).toBe(true);
  expect(outcome.manifest).not.toBeNull();
  return outcome;
}

const AAB461_STRONGER_SOURCE = 'Dispongo di circa sette anni di esperienza. Attualmente lavoro come designer grafica presso Rewitu Current Test, dove preparo concetti visivi e layout per materiali digitali, e modifico grafiche e immagini per vari progetti e coordino bozze e revisioni con i membri del team di progetto. In precedenza ho lavorato come designer grafica presso TestWerk GmbH, dove ho creato materiali grafici per supporti stampati e digitali, e ho sviluppato concetti di design visivo in base alle esigenze dei clienti e ho revisionato progetti di design e verificato la qualità dei risultati finali. In precedenza ho lavorato come designer grafica presso Rewitu, dove ho preparato concept visivi e layout per materiali digitali, e ho modificato grafiche e immagini per vari progetti e ho coordinato bozze e revisioni con i membri del team di progetto.';

describe('AAB463 Italian Shorter lineage-stable compression', () => {
  beforeEach(() => setSummaryV2EnabledForTests(true));
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('returns one identical natural Shorter no-op through provider-primary and validated-cache localization lineages', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const initial = deviceCv();
    const providerPrimary = await localize(initial);
    const validatedCache = await localize(initial);
    expect(providerPrimary.lineageByEntryId['90ceb215']).toBe('provider_primary');
    expect(providerPrimary.lineageByEntryId.be5c794b).toBe('mixed_authoritative');
    expect(providerPrimary.lineageByEntryId.a221433).toBe('provider_primary');
    expect(validatedCache.lineageByEntryId['90ceb215']).toBe('validated_cache');
    expect(validatedCache.lineageByEntryId.be5c794b).toBe('mixed_authoritative');
    expect(validatedCache.lineageByEntryId.a221433).toBe('validated_cache');

    const source = AAB461_STRONGER_SOURCE;
    expect(source).toHaveLength(834);

    const providerResult = runSummaryV2({ cv: { ...initial, summary: source } as CVData, locale: 'it', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: providerPrimary.manifest!, rewriteStyle: 'shorter' });
    const cacheResult = runSummaryV2({ cv: { ...initial, summary: source } as CVData, locale: 'it', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: validatedCache.manifest!, rewriteStyle: 'shorter' });
    // The exact 834-character device source can only lose 22 safe characters.
    // That is below the existing material Shorter threshold, so both valid
    // localization lineages must resolve to the same clean, non-billable no-op.
    expect(providerResult.countedAsSuccess, providerResult.reason).toBe(false);
    expect(cacheResult.countedAsSuccess, cacheResult.reason).toBe(false);
    expect(providerResult.reason).toBe('style_no_safe_material_change');
    expect(cacheResult.reason).toBe('style_no_safe_material_change');
    expect(providerResult.text).toBe(cacheResult.text);
    expect(providerResult.text).toBe(source);
    expect(providerResult.text).not.toMatch(/,\s*nonché\s+(?:ho|preparo|modifico|coordino)/iu);
    expect(providerResult.text).not.toMatch(/\be\s+e\s+/iu);
    expect(providerResult.text).toMatch(/presso Rewitu Current Test, dove preparo/iu);
    expect(providerResult.text).toMatch(/presso TestWerk GmbH, dove ho creato/iu);
    expect(providerResult.validation.requiredCurrentFactCount).toBe(3);
    expect(providerResult.validation.coveredCurrentFactCount).toBe(3);
    expect(providerResult.validation.requiredPriorFactCount).toBe(6);
    expect(providerResult.validation.coveredPriorFactCount).toBe(6);
    expect(providerResult.validation.durationExpressionCount).toBe(1);
    expect(providerResult.validation.unsupportedClaimCount).toBe(0);
    expect(providerResult.validation.unitOwnershipValidationPassed).toBe(true);
    expect(providerResult.validation.materialAuthority.invariantPassed).toBe(true);
    expect(providerResult.validation.targetLocalePurityPassed).toBe(true);
    expect(evaluateSummaryV2NativeSurface({ text: providerResult.text, locale: 'it', perspectiveMode: 'first_person' }).nativeSurfaceValidationPassed).toBe(true);

    const finalized = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_shorter', requestedLocale: 'it', gender: 'female',
      cv: { ...initial, summary: source } as CVData, candidate: providerResult.text, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(initial.experience || [], REF), localizedSummaryManifest: providerPrimary.manifest!, rewriteStyle: 'shorter',
    });
    expect(finalized.blocked, finalized.reason).toBe(true);
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.diagnostics?.noOpDetected).toBe(true);
    expect(finalized.diagnostics?.grammarValidationPassed).toBeNull();
    expect(finalized.diagnostics?.groundingValidationPassed).toBeNull();
    expect(finalized.diagnostics?.slotValidationPassed).toBeNull();
    expect(finalized.diagnostics?.typedFailureReason).toBeNull();
    expect(finalized.diagnostics?.finalCandidateSource).toBe('none');
    const applied = applyFinalizedSummaryToCv({ ...initial, summary: source } as CVData, 'it', finalized);
    expect(applied.summary).toBe(source);
  });

  it('turns a cosmetic, below-threshold Italian Shorter into a clean no-op rather than a validation failure', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const initial = deviceCv();
    const localized = await localize(initial);
    const generated = runSummaryV2({ cv: initial, locale: 'it', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest: localized.manifest! });
    const source = generated.text
      .replace(/Dispongo di circa/iu, 'Ho circa')
      .replace(/In precedenza ho lavorato come/iu, 'Ho già lavorato come');
    const result = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_shorter', requestedLocale: 'it', gender: 'female',
      cv: { ...initial, summary: source } as CVData, candidate: '', referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(initial.experience || [], REF), localizedSummaryManifest: localized.manifest!, rewriteStyle: 'shorter',
    });
    expect(result.blocked).toBe(true);
    expect(result.countedAsSuccess).toBe(false);
    expect(result.diagnostics?.noOpDetected).toBe(true);
    expect(result.diagnostics?.grammarValidationPassed).toBeNull();
    expect(result.diagnostics?.groundingValidationPassed).toBeNull();
    expect(result.diagnostics?.slotValidationPassed).toBeNull();
    expect(result.diagnostics?.typedFailureReason).toBeNull();
  });
});
