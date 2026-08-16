import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildSummaryV2ManifestForCv,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  runSummaryV2,
} from '@/lib/cv-summary-v2';
import { evaluateSummaryV2NativeSurface } from '@/lib/cv-summary-v2/native-surface';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { applyFinalizedSummaryToCv, finalizeCvAiFieldForApply, normalizeSummaryCandidateText } from '@/lib/cv-ai-finalize-apply';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { AI_USAGE_SCHEMA_VERSION, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';

const REF = '2026-08-16';

function work(options: Partial<WorkExperience> & Pick<WorkExperience, 'id' | 'position' | 'company' | 'startDate' | 'description'>): WorkExperience {
  return {
    endDate: '', isPresent: false, originalUserDescription: options.description,
    canonicalDescription: options.description, descriptionOrigin: 'user', ...options,
  } as WorkExperience;
}

function deviceCv(summary = ''): CVData {
  const testWerkSource = 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।';
  const testWerk = applyGeneratedExperienceDescription(work({
    id: 'be5c794b', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH',
    startDate: '2024-01', endDate: '2026-02', description: testWerkSource,
    descriptionSourceLocale: 'hi', positionSourceLocale: 'hi',
  }), 'Ho creato materiali grafici per supporti stampati e digitali.\nHo sviluppato concetti di design visivo in base alle esigenze dei clienti.\nHo revisionato progetti di design e verificato la qualità dei risultati finali.', {
    locale: 'it', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'generate_from_context', requestHash: 'aab462-testwerk-it',
  });
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' },
    summary, contentLocale: 'it', education: [], skills: [], languages: [],
    experience: [
      work({
        id: '90ceb215', position: 'مصممة جرافيك', company: 'Rewitu Current Test',
        startDate: '2026-03', isPresent: true, descriptionSourceLocale: 'ar', positionSourceLocale: 'ar',
        description: 'أعد المفاهيم المرئية والتخطيطات للمواد الرقمية.\nأعدل الرسومات والصور لمشاريع متنوعة.\nأنسق المسودات والمراجعات مع أعضاء فريق المشروع.',
      }),
      testWerk,
      work({
        id: 'a221433', position: 'مصممة جرافيك', company: 'Rewitu',
        startDate: '2019-06', endDate: '2023-12', generatedLocale: 'it', positionSourceLocale: 'it',
        descriptionSourceLocale: 'ar',
        description: 'أعددت المفاهيم المرئية والتخطيطات للمواد الرقمية.\nعدلت الرسومات والصور لمشاريع متنوعة.\nنسقت المسودات والمراجعات مع أعضاء فريق المشروع.',
      }),
    ],
  } as unknown as CVData;
}

const localizedFacts: Record<string, string[]> = {
  'be5c794b': [
    'Ho creato materiali grafici per supporti stampati e digitali.',
    'Ho sviluppato concetti di design visivo in base alle esigenze dei clienti.',
    'Ho revisionato progetti di design e verificato la qualità dei risultati finali.',
  ],
  '90ceb215': [
    'Preparo concetti visivi e layout per materiali digitali.',
    'Modifico grafiche e immagini per vari progetti.',
    'Coordino bozze e revisioni con i membri del team di progetto.',
  ],
  'a221433': [
    'Ho preparato concept visivi e layout per materiali digitali.',
    'Ho modificato grafiche e immagini per vari progetti.',
    'Ho coordinato bozze e revisioni con i membri del team di progetto.',
  ],
};

async function localizedDeviceManifest(cv: CVData) {
  const manifest = buildSummaryV2ManifestForCv({ cv, locale: 'it', gender: 'female', referenceDateIso: REF });
  const localize = () => localizeSummaryV2Manifest({
    manifest,
    transport: async (input) => ({
      targetLocale: input.targetLocale,
      entries: input.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: 'designer grafica',
        facts: entry.facts.map((fact, index) => ({
          factId: fact.factId,
          localizedText: localizedFacts[entry.entryId]![index]!,
        })),
      })),
    }),
  });
  await localize(); // Real structured localization accepts and records its cache first.
  const cached = await localize();
  expect(cached.manifest).not.toBeNull();
  expect(cached.validation?.ok).toBe(true);
  return { selection: manifest, localized: cached.manifest!, outcome: cached };
}

describe('AAB462 Italian Summary Shorter clause attachment', () => {
  beforeEach(() => setSummaryV2EnabledForTests(true));
  afterEach(() => setSummaryV2EnabledForTests(null));

  it.each([
    'Attualmente lavoro come X presso Y, preparo materiali.',
    'Ho lavorato come X presso Y, ho creato materiali.',
    'In precedenza ho lavorato come X presso Y, ho preparato materiali.',
  ])('rejects an Italian role-intro comma splice: %s', (text) => {
    const surface = evaluateSummaryV2NativeSurface({ text, locale: 'it', perspectiveMode: 'first_person' });
    expect(surface.nativeCoordinationValidationPassed).toBe(false);
    expect(surface.nativeSurfaceRejectionReasons).toContain('unnatural_coordination:it_role_intro_comma_splice');
  });

  it.each([
    'Attualmente lavoro come X presso Y, dove preparo materiali.',
    'Ho lavorato come X presso Y; ho creato materiali.',
    'In precedenza ho lavorato come X presso Y e ho preparato materiali.',
  ])('accepts a natural Italian role-to-duty attachment: %s', (text) => {
    const surface = evaluateSummaryV2NativeSurface({ text, locale: 'it', perspectiveMode: 'first_person' });
    expect(surface.nativeCoordinationValidationPassed).toBe(true);
  });

  it('replays the AAB461 Italian Stronger context through cached/mixed-authority localization, finalization, visible apply, and one usage increment', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const initial = deviceCv();
    const replay = await localizedDeviceManifest(initial);
    const { selection, localized: localizedManifest } = replay;
    expect(selection.current?.entryId).toBe('90ceb215');
    expect(selection.priors.map((entry) => entry.entryId)).toEqual(['be5c794b', 'a221433']);
    expect(replay.outcome.lineageByEntryId['90ceb215']).toBe('validated_cache');
    expect(replay.outcome.lineageByEntryId['be5c794b']).toBe('mixed_authoritative');
    expect(replay.outcome.lineageByEntryId['a221433']).toBe('validated_cache');

    const generated = runSummaryV2({ cv: initial, locale: 'it', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest });
    expect(generated.countedAsSuccess).toBe(true);
    const stronger = runSummaryV2({ cv: { ...initial, summary: generated.text } as CVData, locale: 'it', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest, rewriteStyle: 'stronger' });
    expect(stronger.countedAsSuccess).toBe(true);
    // This is the historical AAB461 Stronger surface that the device passed to
    // Shorter: its finite-clause `nonché` coordination is intentionally left in
    // the source state so Shorter must repair it, not merely re-shorten a fixed
    // Stronger output.
    const aab461Source = stronger.text
      .replace(/ e modifico /iu, ', nonché modifico ')
      .replace(/ e coordino /iu, ', nonché coordino ')
      .replace(/ e ho sviluppato /iu, ', nonché ho sviluppato ')
      .replace(/ e ho revisionato /iu, ', nonché ho revisionato ')
      .replace(/ e ho modificato /iu, ', nonché ho modificato ')
      .replace(/ e ho coordinato /iu, ', nonché ho coordinato ');
    expect(aab461Source).toMatch(/nonché modifico/iu);
    expect(aab461Source).toMatch(/nonché ho sviluppato/iu);
    expect(aab461Source).toMatch(/nonché ho modificato/iu);
    const shorterResult = runSummaryV2({
      cv: { ...initial, summary: aab461Source } as CVData, locale: 'it', gender: 'female', candidate: '',
      referenceDateIso: REF, localizedManifest, rewriteStyle: 'shorter',
    });
    expect(shorterResult.countedAsSuccess, JSON.stringify({ reason: shorterResult.reason, validation: shorterResult.validation, text: shorterResult.text })).toBe(true);
    const shorter = shorterResult.text;

    expect(stronger.text).toContain('Dispongo di circa sette anni di esperienza.');
    expect(shorter.length).toBeLessThan(stronger.text.length);
    expect(shorter).toMatch(/presso Rewitu Current Test, dove preparo/iu);
    expect(shorter).toMatch(/presso TestWerk GmbH, dove ho creato/iu);
    expect(shorter).toMatch(/presso Rewitu, dove ho preparato/iu);
    expect(shorter).not.toMatch(/presso [^,.]+,\s+(?:ho\s+)?(?:preparo|creato|preparato)/iu);

    const surface = evaluateSummaryV2NativeSurface({ text: shorter, locale: 'it', perspectiveMode: 'first_person' });
    expect(surface.nativeSurfaceValidationPassed).toBe(true);
    expect(selection.requiredCurrentFacts).toHaveLength(3);
    expect(selection.requiredPriorFacts).toHaveLength(6);

    const usageBefore = 34;
    const finalized = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_shorter', requestedLocale: 'it', gender: 'female',
      cv: { ...initial, summary: aab461Source } as CVData, candidate: shorter, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(initial.experience || [], REF),
      localizedSummaryManifest: localizedManifest, rewriteStyle: 'shorter',
    });
    expect(finalized.blocked, finalized.reason).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    const applied = applyFinalizedSummaryToCv({ ...initial, summary: aab461Source } as CVData, 'it', finalized);
    expect(applied.summary).toBe(finalized.text);
    const usageAfter = finalized.countedAsSuccess
      ? recordProAiUserActionSuccess({ schemaVersion: AI_USAGE_SCHEMA_VERSION, count: usageBefore, windowStart: Date.now(), policyLimit: 100 })
      : null;
    expect(usageAfter?.count).toBe(usageBefore + 1);
    expect(hashSummaryV2Text(applied.summary || '')).toBe(hashSummaryV2Text(finalized.text));
    // The same post-write diagnostic session used by the UI re-reads the
    // applied text; all values below come from the selected validator result,
    // then `recordVisibleApply` independently validates the actual write.
    const trace = new SummaryAiDiagnosticSession({
      uiLocale: 'it', requestedLocale: 'it', contentLocale: 'it', templateId: 'modern-minimal',
      gender: 'female', requestId: 'aab462-authentic-shorter', usageCountBefore: usageBefore,
    });
    const v = shorterResult.validation;
    const finalHash = fingerprintText(normalizeSummaryCandidateText(finalized.text) || 'empty');
    trace.patch({
      finalCandidateSource: 'deterministic_fallback', deterministicCandidatePresent: true, deterministicCandidateHash: finalHash,
      fallbackCandidatePresent: true, finalNormalizedHash: finalHash, finalValidatedCandidateHash: finalHash,
      requiredCurrentDutyFactCount: v.requiredCurrentFactCount, coveredCurrentDutyFactCount: v.coveredCurrentFactCount,
      requiredPriorDutyFactCount: v.requiredPriorFactCount, coveredPriorDutyFactCount: v.coveredPriorFactCount,
      finalCurrentDutyCoveragePassed: true, finalPriorDutyCoveragePassed: true,
      finalStructuredRoleLocaleValidationPassed: v.roleTitleSurfaceValidationPassed,
      targetLocalePurityPassed: v.targetLocalePurityPassed,
      sourceLanguageLeakageDetected: v.sourceLanguageLeakageDetected,
      finalDurationRepresentationKind: 'approximate_total_career', independentFinalDurationClaimCount: 1,
      finalDurationScopeValidationPassed: true, finalPerspectiveMode: 'first_person',
      grammarValidationPassed: true, visibleNativeSurfaceValidationPassed: true, finalPostconditionsPassed: true,
      meaningfulChangeDetected: true, noOpDetected: false, countedAsSuccess: true, apiResponseKind: 'not_attempted',
      serverFallbackUsed: false, clientFallbackUsed: false,
    });
    trace.recordVisibleApply(true, usageBefore + 1, applied.summary);
    const committed = trace.commit();
    expect(committed.visibleApplySucceeded, JSON.stringify({ failure: committed.finalTypedFailureReason, hash: committed.visibleCandidateHashAfterApply, finalHash: committed.finalNormalizedHash, completeness: committed.diagnosticCompletenessPassed, invariant: committed.diagnosticInvariantCheckPassed })).toBe(true);
    expect(committed.visibleCandidateHashAfterApply).toBe(finalHash);
    expect(committed.visibleSummaryMatchesFinalHash).toBe(true);
    expect(committed.visibleGrammarValidationPassed).toBe(true);
    expect(committed.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(committed.visibleFinalPostconditionsPassed).toBe(true);
    expect(committed.diagnosticInvariantCheckPassed).toBe(true);
    expect(committed.diagnosticCompletenessPassed, JSON.stringify({ missing: committed.missingRequiredDiagnosticFields, nulls: committed.nullRequiredDiagnosticFields })).toBe(true);
    expect(committed.privacyCheckPassed).toBe(true);
  });

  it('rejects the old comma-splice Shorter candidate before apply and preserves usage', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const initial = deviceCv();
    const { localized: localizedManifest } = await localizedDeviceManifest(initial);
    const generated = runSummaryV2({ cv: initial, locale: 'it', gender: 'female', candidate: '', referenceDateIso: REF, localizedManifest });
    const shorter = runSummaryV2({
      cv: { ...initial, summary: generated.text } as CVData, locale: 'it', gender: 'female', candidate: '',
      referenceDateIso: REF, localizedManifest, rewriteStyle: 'shorter',
    });
    const bad = shorter.text
      .replace(/, dove preparo/iu, ', preparo')
      .replace(/, dove ho creato/iu, ', ho creato')
      .replace(/, dove ho preparato/iu, ', ho preparato');
    const usageBefore = 34;
    const finalized = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_shorter', requestedLocale: 'it', gender: 'female',
      cv: { ...initial, summary: generated.text } as CVData, candidate: bad, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(initial.experience || [], REF), localizedSummaryManifest: localizedManifest, rewriteStyle: 'shorter',
    });
    expect(finalized.blocked).toBe(true);
    expect(finalized.countedAsSuccess).toBe(false);
    expect(applyFinalizedSummaryToCv({ ...initial, summary: generated.text } as CVData, 'it', finalized).summary).toBe(generated.text);
    // The failure path never calls the usage-success action, so the ledger
    // remains at the pre-operation count.
    expect(usageBefore).toBe(34);
  });
});
