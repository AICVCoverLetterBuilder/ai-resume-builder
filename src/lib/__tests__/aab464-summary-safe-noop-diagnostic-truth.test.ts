import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
} from '@/lib/cv-summary-v2';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import {
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  clearSummaryAiDiagnosticsForTests,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import type { CvAiCandidateLineageRecord } from '@/lib/cv-ai-diagnostics-contract';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

const REF = '2026-08-16';
const SOURCE = 'Dispongo di circa sette anni di esperienza. Attualmente lavoro come Graphic designer presso Rewitu Current Test, dove preparo concetti visivi e layout per materiali digitali, e modifico grafiche e immagini per vari progetti e coordino bozze e revisioni con i membri del team di progetto. In precedenza ho lavorato come Graphic designer presso TestWerk GmbH, dove ho creato materiali grafici per supporti stampati e digitali, e ho sviluppato concetti di design visivo in base alle esigenze dei clienti e ho revisionato progetti di design e verificato la qualità dei risultati finali. In precedenza ho lavorato come Graphic designer presso Rewitu, dove ho preparato concept visivi e layout per materiali digitali, e ho modificato grafiche e immagini per vari progetti e ho coordinato bozze e revisioni con i membri del team di progetto.';

function work(options: Partial<WorkExperience> & Pick<WorkExperience, 'id' | 'position' | 'company' | 'startDate' | 'description'>): WorkExperience {
  return {
    endDate: '', isPresent: false, originalUserDescription: options.description,
    canonicalDescription: options.description, descriptionOrigin: 'user', ...options,
  } as WorkExperience;
}

function deviceCv(): CVData {
  const testWerk = applyGeneratedExperienceDescription(work({
    id: 'be5c794b', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH',
    startDate: '2024-01', endDate: '2026-02', descriptionSourceLocale: 'hi', positionSourceLocale: 'hi',
    description: 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।',
  }), 'Ho creato materiali grafici per supporti stampati e digitali.\nHo sviluppato concetti di design visivo in base alle esigenze dei clienti.\nHo revisionato progetti di design e verificato la qualità dei risultati finali.', {
    locale: 'it', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'generate_from_context', requestHash: 'aab464-testwerk-it',
  });
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' }, summary: SOURCE, contentLocale: 'it', education: [], skills: [], languages: [],
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

describe('AAB464 safe Shorter no-op diagnostic truth', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    clearSummaryAiDiagnosticsForTests();
    clearSummaryV2LocalizationCacheForTests();
  });
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('serializes unreached validators as null while preserving no-op terminal truth', async () => {
    expect(SOURCE).toHaveLength(834);
    expect(fingerprintText(SOURCE)).toBe('fnv1a_f8c7a497_l834_b68_e46');
    const cv = deviceCv();
    const localization = await localize(cv);
    const manifest = localization.manifest!;
    expect(localization.lineageByEntryId['90ceb215']).toBe('provider_primary');
    expect(localization.lineageByEntryId['be5c794b']).toBe('mixed_authoritative');
    expect(localization.lineageByEntryId['a221433']).toBe('provider_primary');
    const finalized = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_shorter', requestedLocale: 'it', gender: 'female',
      cv, candidate: SOURCE, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      localizedSummaryManifest: manifest, rewriteStyle: 'shorter',
    });
    expect(finalized.blocked).toBe(true);
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.diagnostics?.noOpDetected).toBe(true);
    expect(finalized.reason).toBe('style_no_safe_material_change');

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'it', requestedLocale: 'it', contentLocale: 'it', templateId: 'modern-minimal',
      gender: 'female', requestId: 'aab464-noop', usageCountBefore: 19,
      operationMode: 'summary_shorter', jobContextHash: 'aab464-job',
    });
    session.patch({ rewriteStyle: 'shorter', operationMode: 'enhance_existing_content' });
    session.recordCvSnapshot(cv, SOURCE);
    session.recordFinalizeResult(finalized);
    session.recordVisibleApplyNotApplicable(19);
    const trace = session.commit();
    const lineage = (trace.candidateLineage || []) as CvAiCandidateLineageRecord[];
    const client = lineage.find((entry) => entry.candidateKind === 'client_deterministic');
    const selected = lineage.find((entry) => entry.candidateKind === 'final_selected');

    // Keep the exact device-equivalent, privacy-safe diagnostic evidence visible
    // in test output without serializing source prose.
    console.log(JSON.stringify({
      summarySourceHash: trace.summarySourceHash,
      rewriteStyle: trace.rewriteStyle,
      localizationLineageByEntryId: localization.lineageByEntryId,
      candidateTransformationBeforeHash: trace.candidateTransformationBeforeHash,
      candidateTransformationAfterHash: trace.candidateTransformationAfterHash,
      deterministicCandidateHash: trace.deterministicCandidateHash,
      sourceNormalizedHash: trace.sourceNormalizedHash,
      finalNormalizedHash: trace.finalNormalizedHash,
      finalCandidateSource: trace.finalCandidateSource,
      noOpDetected: trace.noOpDetected,
      noOpRejectionReason: trace.noOpRejectionReason,
      finalTypedFailureReason: trace.finalTypedFailureReason,
      rejectionStage: trace.rejectionStage,
      finalPostconditionsPassed: trace.finalPostconditionsPassed,
      finalPostconditionsStage: trace.stages?.find((stage) => stage.name === 'final_postconditions') ?? null,
      grammarValidationPassed: trace.grammarValidationPassed,
      groundingValidationPassed: trace.groundingValidationPassed,
      slotValidationPassed: trace.slotValidationPassed,
      durationValidationPassed: trace.durationValidationPassed,
      localeValidationPassed: trace.localeValidationPassed,
      clientDeterministic: client && {
        rejectionStage: client.rejectionStage,
        rejectionReasons: client.rejectionReasons,
        grammarValidationPassed: client.grammarValidationPassed,
        groundingValidationPassed: client.groundingValidationPassed,
        slotValidationPassed: client.slotValidationPassed,
        durationValidationPassed: client.durationValidationPassed,
        localeValidationPassed: client.localeValidationPassed,
      },
      finalSelected: selected && {
        present: selected.present,
        accepted: selected.accepted,
        grammarValidationPassed: selected.grammarValidationPassed,
        groundingValidationPassed: selected.groundingValidationPassed,
        slotValidationPassed: selected.slotValidationPassed,
        durationValidationPassed: selected.durationValidationPassed,
        localeValidationPassed: selected.localeValidationPassed,
      },
      visibleApplySucceeded: trace.visibleApplySucceeded,
      countedAsSuccess: trace.countedAsSuccess,
      usage: [trace.usageCountBefore, trace.usageCountAfter],
      diagnosticInvariantCheckPassed: trace.diagnosticInvariantCheckPassed,
      diagnosticCompletenessPassed: trace.diagnosticCompletenessPassed,
      privacyCheckPassed: trace.privacyCheckPassed,
      nullRequiredDiagnosticFields: trace.nullRequiredDiagnosticFields,
      missingRequiredDiagnosticFields: trace.missingRequiredDiagnosticFields,
    }, null, 2));

    expect(trace.finalCandidateSource).toBe('none');
    expect(trace.noOpDetected).toBe(true);
    expect(trace.noOpRejectionReason).toBe('style_no_safe_material_change');
    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountBefore).toBe(19);
    expect(trace.usageCountAfter).toBe(19);
    for (const key of [
      'grammarValidationPassed', 'groundingValidationPassed', 'slotValidationPassed',
      'durationValidationPassed', 'localeValidationPassed',
    ] as const) expect(trace[key]).toBeNull();
    expect(client).toBeDefined();
    for (const key of [
      'grammarValidationPassed', 'groundingValidationPassed', 'slotValidationPassed',
      'durationValidationPassed', 'localeValidationPassed',
    ] as const) expect(client?.[key]).toBeNull();
    expect(selected?.present).toBe(false);
    expect(selected?.accepted).toBe(false);
    for (const key of [
      'grammarValidationPassed', 'groundingValidationPassed', 'slotValidationPassed',
      'durationValidationPassed', 'localeValidationPassed',
    ] as const) expect(selected?.[key]).toBeNull();
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('keeps a real provider grounding rejection false rather than converting that evaluated phase to not-evaluated', async () => {
    const cv = deviceCv();
    const localization = await localize(cv);
    const finalized = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_shorter', requestedLocale: 'it', gender: 'female',
      cv,
      candidate: 'Ho circa sette anni di esperienza. Attualmente lavoro come designer grafica presso Rewitu Current Test, dove preparo concetti visivi e layout per materiali digitali.',
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      localizedSummaryManifest: localization.manifest!, rewriteStyle: 'shorter',
    });
    expect(finalized.blocked).toBe(true);
    // The shared Summary pipeline safely reaches its material-safe no-op after
    // rejecting this incomplete provider candidate.  The terminal fields are
    // therefore N/A; the evaluated provider lineage must retain the real
    // grounding failure rather than being nulled by the clean-no-op serializer.
    expect(finalized.diagnostics?.noOpDetected).toBe(true);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'it', requestedLocale: 'it', contentLocale: 'it', templateId: 'modern-minimal',
      gender: 'female', requestId: 'aab464-grounding-reject', usageCountBefore: 19,
      operationMode: 'summary_shorter', jobContextHash: 'aab464-job',
    });
    session.recordCvSnapshot(cv, SOURCE);
    session.recordFinalizeResult(finalized);
    session.recordVisibleApplySkippedFailure(19, finalized.reason || 'summary_grounding_failed');
    const trace = session.commit();
    expect(trace.noOpDetected).toBe(true);
    expect(trace.groundingValidationPassed).toBeNull();
    const lineage = (trace.candidateLineage || []) as CvAiCandidateLineageRecord[];
    const provider = lineage.find((entry) => entry.candidateKind === 'provider');
    console.log(JSON.stringify({
      realProviderGroundingNegative: {
        present: provider?.present,
        groundingValidationPassed: provider?.groundingValidationPassed,
        rejectionStage: provider?.rejectionStage,
        rejectionReasons: provider?.rejectionReasons,
      },
    }, null, 2));
    expect(provider?.present).toBe(true);
    expect(provider?.groundingValidationPassed).toBe(false);
    expect(provider?.rejectionStage).not.toBeNull();
    expect(provider?.rejectionReasons.length).toBeGreaterThan(0);
    expect(provider?.rejectionReasons).toContain('missing_current_role_intro');
    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountAfter).toBe(19);
  });
});
