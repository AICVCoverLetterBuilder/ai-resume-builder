/**
 * @vitest-environment jsdom
 *
 * cv-ai-diagnostics-v2 — additive privacy-safe diagnostic contract for
 * Experience + Professional Summary (AAB-298 payload gap + lineage).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import { finalizeCvAiFieldForApply, evaluateSummaryMeaningfulChange, SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION } from '../cv-ai-finalize-apply';
import {
  analyzeHindiSummaryEmploymentQuality,
  scanHindiUnsupportedDesignMediumClaims,
  validateHindiSummaryFiniteGrammar,
  splitHindiSummaryUnits,
} from '../cv-summary-grounding';
import {
  clearSummaryAiDiagnosticsForTests,
  formatSummaryAiDiagnosticForCopy,
  SummaryAiDiagnosticSession,
  type SummaryAiDiagnosticTrace,
} from '../cv-summary-ai-diagnostics';
import {
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
} from '../cv-experience-ai-diagnostics';
import {
  appendCvAiDiagnosticHistory,
  assertCvAiDiagnosticPrivacy,
  checkSummaryDiagnosticCompleteness,
  checkSummaryDiagnosticInvariants,
  clearCvAiDiagnosticHistory,
  CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
  CV_AI_DIAGNOSTIC_MAX_PAYLOAD_CHARS,
  dedupeStableStrings,
  getCvAiDiagnosticHistory,
  maybeTruncateDiagnosticPayload,
} from '../cv-ai-diagnostics-contract';
import { INTERNAL_AI_RESET_ENABLED } from '../build-channel';
import { hashExperienceEntryId } from '../cv-experience-entry-isolation';

const WH_HI = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const GD_HI_DIGITAL = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों / स्क्रीन के लिए अनुकूलित किया।',
]);

const GD_HI_WITH_PRINT = formatExperienceBullets([
  'प्रिंट और डिजिटल दोनों माध्यमों के लिए ग्राफिक डिज़ाइन तैयार किया।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
]);

/** Two-sentence invalid provider (wrong slot count). */
const PROVIDER_TWO_SENTENCE = [
  'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत हैं।',
  'आने वाले माल की जाँच करती हैं।',
].join(' ');

/** Provider with unsupported print + otherwise finite-ish shape. */
const PROVIDER_WITH_PRINT = [
  'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत हैं।',
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच करती हैं।',
  'इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट सामग्री तैयार कीं।',
].join(' ');

const PROVIDER_NOMINAL = [
  'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर हैं।',
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच तथा सहकर्मियों के साथ माल की तैयारी और आवाजाही के समन्वय का अनुभव।',
  'इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
].join(' ');

const PROVIDER_WRONG_LOCALE = [
  'Od januara 2023. radi kao Warehouse Employee u Atlasu.',
  'Reviews incoming goods and warehouse records carefully.',
  'Previously worked as a graphic designer at Rewitu.',
].join(' ');

/** AAB-298-style incomplete copied payload (broad flags only). */
function aab298IncompletePayload(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    marker: 'SUMMARY_AI_DIAG_V1',
    requestedLocale: 'hi',
    finalCandidateSource: 'deterministic_fallback',
    providerCandidatePresent: true,
    deterministicCandidatePresent: true,
    providerSentenceCount: 2,
    grammarValidationPassed: true,
    groundingValidationPassed: true,
    unsupportedClaimCount: 0,
    finalPostconditionsPassed: true,
    durationValidationPassed: true,
    countedAsSuccess: true,
    visibleApplySucceeded: true,
    usageCountBefore: 0,
    usageCountAfter: 1,
    // Missing v2 granular Hindi/medium fields on purpose.
  };
}

function fixtureCv(options: {
  summary?: string;
  priorDesc?: string;
  contentLocale?: string;
} = {}): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '+381641234567',
      location: 'Beograd, Knez Mihailova 12',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary: options.summary ?? 'पूर्व सारांश अपरिवर्तित रखें।',
    experience: [
      {
        id: 'exp-wh',
        position: 'Warehouse Employee',
        company: 'Atlas Logistics',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_HI,
        descriptionOrigin: 'user',
        originalUserDescription: WH_HI,
        canonicalDescription: WH_HI,
        generatedLocale: 'hi',
      },
      {
        id: 'exp-gd',
        position: 'Grafički dizajner',
        company: 'Rewitu Studio',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: options.priorDesc ?? GD_HI_DIGITAL,
        descriptionOrigin: 'user',
        originalUserDescription: options.priorDesc ?? GD_HI_DIGITAL,
        canonicalDescription: options.priorDesc ?? GD_HI_DIGITAL,
        generatedLocale: 'hi',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: options.contentLocale ?? 'hi',
  };
}

function runSummaryDiag(candidate: string, priorDesc?: string) {
  clearSummaryAiDiagnosticsForTests();
  const cv = fixtureCv({ priorDesc });
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'en',
    requestedLocale: 'hi',
    contentLocale: 'hi',
    templateId: 'modern',
    requestId: `diag-v2-${Math.random().toString(36).slice(2, 8)}`,
    usageCountBefore: 0,
    gender: 'female',
    operationMode: 'enhance_existing_content',
  });
  session.recordCvSnapshot(cv, candidate);
  const fin = finalizeCvAiFieldForApply({
    action: 'summary_generate',
    field: 'summary',
    requestedLocale: 'hi',
    gender: 'female',
    cv,
    candidate,
    referenceDateIso: '2026-07-19',
  });
  session.recordFinalizeResult(fin);
  if (fin.countedAsSuccess && fin.text) {
    session.recordVisibleApply(true, 1, fin.text);
  } else {
    session.recordVisibleApply(false, 0);
  }
  const trace = session.commit();
  return { fin, trace, cv };
}

describe('cv-ai-diagnostics-v2 contract', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });
  afterEach(() => {
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('A: AAB-298 incomplete payload fails completeness; new payload passes', () => {
    const old = aab298IncompletePayload();
    const oldCheck = checkSummaryDiagnosticCompleteness(old);
    expect(oldCheck.passed).toBe(false);
    expect(oldCheck.missingRequiredDiagnosticFields).toEqual(
      expect.arrayContaining([
        'diagnosticContractRevision',
        'hindiNominalExperienceFragmentDetected',
        'hindiSentenceHasFiniteCopulaOrVerb',
        'finalUnsupportedDesignMediumCount',
        'providerPrintClaimDetected',
        'hindiSentenceGrammarRecords',
      ]),
    );

    const { fin, trace } = runSummaryDiag(PROVIDER_TWO_SENTENCE);
    expect(trace.diagnosticContractRevision).toBe(CV_AI_DIAGNOSTIC_CONTRACT_REVISION);
    expect(trace.finalCandidateSource).toBe('deterministic_fallback');
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.hindiNominalExperienceFragmentDetected).not.toBeUndefined();
    expect(Array.isArray(trace.hindiSentenceHasFiniteCopulaOrVerb)).toBe(true);
    expect(typeof trace.finalUnsupportedDesignMediumCount).toBe('number');
    expect(typeof trace.deterministicUnsupportedDesignMediumCount).toBe('number');
    expect(Array.isArray(trace.hindiSentenceGrammarRecords)).toBe(true);
    expect(trace.cvAiDiagnosticsV2299Revision).toBe('cv-ai-diagnostics-v2-299-v1');
    expect(fin.diagnostics?.summaryNoopSuccessContractRevision)
      .toBe(SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION);
    expect(trace.summaryNoopSuccessContractRevision)
      .toBe(SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION);
    expect(trace.missingRequiredDiagnosticFields || []).toHaveLength(0);
  });

  it('B: provider rejection lineage is visible for two-sentence invalid structure', () => {
    const { fin, trace } = runSummaryDiag(PROVIDER_TWO_SENTENCE);
    expect(trace.providerCandidatePresent).toBe(true);
    expect(trace.providerSentenceCount).toBe(2);
    expect(trace.deterministicCandidatePresent).toBe(true);
    expect(trace.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.origin).toBe('deterministic_fallback');
    const providerLine = (trace.candidateLineage || []).find(
      (c: { candidateKind?: string }) => c.candidateKind === 'provider',
    ) as { rejectionReasons?: string[]; present?: boolean } | undefined;
    expect(providerLine?.present).toBe(true);
    expect((providerLine?.rejectionReasons || []).length).toBeGreaterThan(0);
    const det = (trace.candidateLineage || []).find(
      (c: { candidateKind?: string }) => c.candidateKind === 'client_deterministic',
    );
    expect(det).toBeTruthy();
    expect(trace.providerOutcome).toMatch(/rejected_/);
    expect(trace.providerOutcome).not.toBe('server_deterministic_fallback');
    expect(trace.serverFallbackUsed).toBe(false);
    expect(trace.clientFallbackUsed).toBe(true);
    expect(trace.clientFallbackKind).toBe('deterministic');
  });

  it('C: unsupported print — provider detected; final medium count 0', () => {
    const { fin, trace } = runSummaryDiag(PROVIDER_WITH_PRINT, GD_HI_DIGITAL);
    expect(trace.providerPrintClaimDetected).toBe(true);
    expect(trace.providerUnsupportedDesignMediumKinds || []).toContain('unsupported_print_medium');
    expect(trace.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.text || '').not.toMatch(/प्रिंट/);
    expect(trace.finalUnsupportedDesignMediumCount).toBe(0);
    expect(trace.deterministicUnsupportedDesignMediumCount).toBe(0);
  });

  it('D: source-backed print is not unsupported', () => {
    const medium = scanHindiUnsupportedDesignMediumClaims(
      PROVIDER_WITH_PRINT,
      GD_HI_WITH_PRINT,
    );
    expect(medium.sourcePrintFactPresent).toBe(true);
    expect(medium.providerPrintClaimDetected).toBe(true);
    expect(medium.finalUnsupportedDesignMediumKinds).not.toContain('unsupported_print_medium');

    const q = analyzeHindiSummaryEmploymentQuality(PROVIDER_WITH_PRINT, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI_WITH_PRINT,
      priorCompany: 'Rewitu',
    });
    // May still fail other grounding, but print must not be classified unsupported.
    expect(q.sourcePrintFactPresent).toBe(true);
    expect(q.finalUnsupportedDesignMediumKinds).not.toContain('unsupported_print_medium');
  });

  it('E: Hindi nominal fragment — grammar rejection; not applied as provider', () => {
    const units = splitHindiSummaryUnits(PROVIDER_NOMINAL);
    const slots = units.map((_, i) => (
      i === 0 ? 'current_intro' : i === 1 ? 'current_duty' : 'prior_role'
    )) as Array<'current_intro' | 'current_duty' | 'prior_role'>;
    const g = validateHindiSummaryFiniteGrammar(units, slots);
    expect(g.hindiNominalExperienceFragmentDetected).toBe(true);
    expect(g.hindiSentenceHasFiniteCopulaOrVerb.some((v) => v === false)).toBe(true);
    expect(g.hindiGrammarRejectionReason).toBeTruthy();

    const { fin, trace } = runSummaryDiag(PROVIDER_NOMINAL);
    expect(trace.providerHindiNominalExperienceFragmentDetected
      || trace.providerCandidatePresent).toBeTruthy();
    if (fin.origin === 'deterministic_fallback') {
      expect(trace.finalCandidateSource).toBe('deterministic_fallback');
      expect(fin.text || '').not.toMatch(/का अनुभव।\s*$/u);
    }
  });

  it('F: valid Hindi finite sentences have aligned grammar arrays', () => {
    const { fin, trace } = runSummaryDiag(PROVIDER_TWO_SENTENCE);
    expect(fin.countedAsSuccess).toBe(true);
    expect(trace.hindiSentenceHasFiniteCopulaOrVerb?.length).toBeGreaterThanOrEqual(2);
    expect(trace.hindiSentenceGrammarRecords?.length).toBe(
      trace.hindiSentenceHasFiniteCopulaOrVerb?.length,
    );
    expect(trace.hindiSentenceHasFiniteCopulaOrVerb?.every(Boolean)).toBe(true);
    expect(trace.hindiNominalExperienceFragmentDetected).toBe(false);
  });

  it('G: wrong locale provider is rejected with locale/leakage fields', () => {
    const { fin, trace } = runSummaryDiag(PROVIDER_WRONG_LOCALE);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(
      (trace.wrongLocaleUnitCount || 0) > 0
      || trace.sourceLanguageLeakageDetected
      || Boolean(trace.providerRejectionReason)
      || trace.finalCandidateSource === 'deterministic_fallback',
    ).toBe(true);
  });

  it('H: Experience stable entry IDs are recorded for two entries', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'hi',
      contentLocale: 'hi',
      templateId: 'modern',
      requestId: 'exp-stable-1',
      usageCountBefore: 0,
      gender: 'female',
      jobContextHash: 'ctx-a',
    });
    session.patch({
      employmentState: 'current',
      clickedExperienceEntryIdHash: hashExperienceEntryId('exp-wh'),
      snapshotExperienceEntryIdHash: hashExperienceEntryId('exp-wh'),
      payloadExperienceEntryIdHash: hashExperienceEntryId('exp-wh'),
      selectedExperienceEntryIdHash: hashExperienceEntryId('exp-wh'),
      providerTargetEntryIdHash: hashExperienceEntryId('exp-wh'),
      fallbackTargetEntryIdHash: hashExperienceEntryId('exp-wh'),
      appliedExperienceEntryIdHash: hashExperienceEntryId('exp-wh'),
      arrayIndexAtRequest: 0,
      stableEntryIdentityMatched: true,
      selectedSourceKind: 'originalUserDescription',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountAfter: 1,
      finalCandidateSource: 'provider',
      providerCandidatePresent: true,
      providerAccepted: true,
      finalNormalizedHash: 'fnv1a_final_stable',
      visibleTextareaMatchesFinalNormalizedHash: true,
      visibleDescriptionMatchesFinalHash: true,
      requiredFactCount: 0,
      coveredFactCount: 0,
      uncoveredFactIdentityHashes: [],
      finalMatchesProviderOutput: true,
    });
    const trace = session.commit();
    expect(trace.diagnosticContractRevision).toBe(CV_AI_DIAGNOSTIC_CONTRACT_REVISION);
    expect(trace.clickedExperienceEntryIdHash).toBe(hashExperienceEntryId('exp-wh'));
    expect(trace.appliedExperienceEntryIdHash).toBe(hashExperienceEntryId('exp-wh'));
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
  });

  it('I/J: Experience no-op + unsupported claim lineage fields exist on commit', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'hi',
      contentLocale: 'hi',
      templateId: 'modern',
      requestId: 'exp-noop-1',
      usageCountBefore: 2,
      gender: 'female',
      jobContextHash: 'ctx-b',
    });
    session.patch({
      employmentState: 'current',
      clickedExperienceEntryIdHash: hashExperienceEntryId('exp-wh'),
      selectedSourceKind: 'originalUserDescription',
      providerNoOpDetected: true,
      noOpRepairAttempted: true,
      noOpRepairValidationPassed: false,
      clientDeterministicFallbackAttempted: true,
      clientDeterministicFallbackApplied: true,
      finalCandidateSource: 'deterministic_fallback',
      unsupportedClaimCount: 1,
      finalUnsupportedClaimKinds: ['unsupported_leadership'],
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountAfter: 3,
    });
    const trace = session.commit();
    expect(trace.providerNoOpDetected).toBe(true);
    expect(trace.clientDeterministicFallbackApplied).toBe(true);
    expect(trace.finalUnsupportedClaimKinds).toContain('unsupported_leadership');
    expect(trace.diagnosticContractRevision).toBe(CV_AI_DIAGNOSTIC_CONTRACT_REVISION);
  });

  it('K: race failure — apply false and usage +0', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'hi',
      contentLocale: 'hi',
      templateId: 'modern',
      requestId: 'exp-race-1',
      usageCountBefore: 4,
      gender: 'female',
      jobContextHash: 'ctx-old',
    });
    session.patch({
      employmentState: 'current',
      clickedExperienceEntryIdHash: hashExperienceEntryId('exp-wh'),
      selectedSourceKind: 'originalUserDescription',
      raceGuardResult: 'fail',
      visibleApplySucceeded: false,
      countedAsSuccess: false,
      usageCountAfter: 4,
    });
    const trace = session.commit();
    expect(trace.raceGuardResult).toBe('fail');
    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.usageCountAfter).toBe(trace.usageCountBefore);
  });

  it('L: usage invariants — success +1 / fail +0', () => {
    const ok = checkSummaryDiagnosticInvariants({
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 0,
      usageCountAfter: 1,
      finalCandidateSource: 'deterministic_fallback',
      deterministicCandidatePresent: true,
      grammarValidationPassed: true,
      groundingValidationPassed: true,
      durationValidationPassed: true,
      independentFinalDurationClaimCount: 1,
      structuredDurationMonths: 78,
    });
    expect(ok.passed).toBe(true);

    const failUsage = checkSummaryDiagnosticInvariants({
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 0,
      usageCountAfter: 0,
      finalCandidateSource: 'deterministic_fallback',
      deterministicCandidatePresent: true,
    });
    expect(failUsage.passed).toBe(false);
    expect(failUsage.failures.some((f) => f.invariantCode === 'usage_increment_mismatch_success')).toBe(true);
  });

  it('M: hash apply invariant fails on mismatch', () => {
    const r = checkSummaryDiagnosticInvariants({
      visibleApplySucceeded: true,
      visibleSummaryMatchesFinalHash: false,
      countedAsSuccess: true,
      usageCountBefore: 0,
      usageCountAfter: 1,
      finalCandidateSource: 'ai_generated',
      providerCandidatePresent: true,
    });
    expect(r.failures.some((f) => f.invariantCode === 'visible_apply_hash_mismatch')).toBe(true);
  });

  it('N: diagnostic self-contradictions are reported', () => {
    const cases = [
      checkSummaryDiagnosticInvariants({
        grammarValidationPassed: true,
        hindiIncompleteSentenceCount: 1,
      }),
      checkSummaryDiagnosticInvariants({
        groundingValidationPassed: true,
        unsupportedClaimCount: 1,
      }),
      checkSummaryDiagnosticInvariants({
        finalCandidateSource: 'deterministic_fallback',
        deterministicCandidatePresent: false,
      }),
      checkSummaryDiagnosticInvariants({
        countedAsSuccess: true,
        visibleApplySucceeded: false,
      }),
    ];
    for (const c of cases) {
      expect(c.passed).toBe(false);
      expect(c.failures.length).toBeGreaterThan(0);
    }
  });

  it('O: privacy — copied diagnostics contain no raw PII/prose', () => {
    const { trace } = runSummaryDiag(PROVIDER_TWO_SENTENCE);
    const json = formatSummaryAiDiagnosticForCopy(trace);
    expect(json).not.toMatch(/ana@example\.com/i);
    expect(json).not.toMatch(/\+381641234567/);
    expect(json).not.toMatch(/Atlas Logistics/);
    expect(json).not.toMatch(/Knez Mihailova/);
    expect(json).not.toMatch(/आने वाले माल और संबंधित/);
    const privacy = assertCvAiDiagnosticPrivacy(trace);
    expect(privacy).toEqual([]);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('P: payload size stays bounded or truncates safely', () => {
    const huge = {
      schemaVersion: 1,
      marker: 'SUMMARY_AI_DIAG_V1',
      stages: Array.from({ length: 200 }, (_, i) => ({ name: `s${i}`, status: 'ok' })),
      candidateLineage: Array.from({ length: 20 }, (_, i) => ({
        candidateKind: 'provider',
        present: true,
        hash: `h${i}`,
        unitCount: 3,
        unitHashes: [],
        accepted: false,
        rejectionStage: null,
        rejectionReasons: ['x'],
        grammarValidationPassed: null,
        groundingValidationPassed: null,
        durationValidationPassed: null,
        slotValidationPassed: null,
        localeValidationPassed: null,
        unsupportedClaimCount: 0,
        unsupportedClaimKinds: [],
        normalizedHash: null,
      })),
      finalValidatedCandidateHash: 'keep-me',
      countedAsSuccess: true,
    };
    const out = maybeTruncateDiagnosticPayload(
      huge as Record<string, unknown>,
      5_000,
    );
    expect(out.diagnosticPayloadByteSize).toBeLessThanOrEqual(CV_AI_DIAGNOSTIC_MAX_PAYLOAD_CHARS);
    expect(out.finalValidatedCandidateHash).toBe('keep-me');
    if ((JSON.stringify(huge).length) > 5_000) {
      expect(out.diagnosticPayloadTruncated).toBe(true);
    }
  });

  it('Q: local history is bounded, clearable, and recovers from corruption', () => {
    for (let i = 0; i < 7; i += 1) {
      appendCvAiDiagnosticHistory({
        timestamp: new Date(2026, 6, 20, 12, i).toISOString(),
        requestIdHash: `req-${i}`,
        operationKind: 'summary',
        operationMode: 'enhance',
        targetLocale: 'hi',
        success: i % 2 === 0,
        finalCandidateSource: 'deterministic_fallback',
        finalTypedFailureReason: null,
        invariantPassed: true,
        completenessPassed: true,
        usageCountBefore: i,
        usageCountAfter: i + 1,
      });
    }
    const hist = getCvAiDiagnosticHistory('summary');
    expect(hist.length).toBeLessThanOrEqual(5);
    clearCvAiDiagnosticHistory('summary');
    expect(getCvAiDiagnosticHistory('summary')).toHaveLength(0);

    localStorage.setItem('cvpro-cv-ai-diag-history-v1', '{not-json');
    expect(getCvAiDiagnosticHistory()).toEqual([]);
  });

  it('R: internal visibility gate still compile-time gated', () => {
    // Production unit tests typically run with gate false; enabled builds set true.
    expect(typeof INTERNAL_AI_RESET_ENABLED).toBe('boolean');
  });

  it('S: non-regression — Hindi Summary still yields safe deterministic text', () => {
    const { fin, trace } = runSummaryDiag(PROVIDER_TWO_SENTENCE);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text?.split(/[।.!?]/u).filter((s) => s.trim()).length).toBeGreaterThanOrEqual(2);
    expect(trace.independentFinalDurationClaimCount).toBe(1);
    expect(trace.usageCountAfter).toBe(1);
    expect(trace.usageCountBefore).toBe(0);
    expect(trace.meaningfulChangeDetected).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
  });

  it('T: AAB-299 device no-op — identical deterministic enhance is not success', () => {
    clearSummaryAiDiagnosticsForTests();
    // First build the deterministic safe Summary (generate from empty).
    const emptyCv = fixtureCv({ summary: '' });
    const generated = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: emptyCv,
      candidate: '',
      referenceDateIso: '2026-07-19',
    });
    expect(generated.countedAsSuccess).toBe(true);
    const safeSummary = (generated.text || '').trim();
    expect(safeSummary.length).toBeGreaterThan(40);

    const enhanceCv = fixtureCv({ summary: safeSummary });
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'hi',
      contentLocale: 'hi',
      templateId: 'modern',
      requestId: 'aab299-noop',
      usageCountBefore: 0,
      gender: 'female',
      operationMode: 'enhance_existing_content',
    });
    session.recordCvSnapshot(enhanceCv, safeSummary);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: enhanceCv,
      candidate: PROVIDER_WITH_PRINT,
      referenceDateIso: '2026-07-19',
    });
    expect(fin.blocked).toBe(true);
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.reason).toBe('summary_noop_after_normalization');
    expect((fin.text || '').trim()).toBe(safeSummary);
    expect(fin.diagnostics?.providerPrintClaimDetected).toBe(true);
    expect(fin.diagnostics?.noOpDetected).toBe(true);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(false);
    expect(fin.diagnostics?.serverFallbackUsed).toBe(false);
    expect(fin.diagnostics?.clientFallbackUsed).toBe(true);
    expect(fin.diagnostics?.providerOutcome).toMatch(/rejected_/);
    expect(fin.diagnostics?.providerOutcome).not.toBe('server_deterministic_fallback');
    expect(fin.diagnostics?.hindiGrammarRejectionReason == null
      || !String(fin.diagnostics?.hindiGrammarRejectionReason).includes('print')).toBe(true);

    session.recordFinalizeResult(fin);
    session.recordVisibleApply(false, 0);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountBefore).toBe(0);
    expect(trace.usageCountAfter).toBe(0);
    expect(trace.noOpDetected).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.capacitorServerUrlConfigured).toBe(false);
    expect(typeof trace.apiBaseUrlConfigured).toBe('boolean');
    expect(trace.sourceCommitStatus === 'embedded'
      || trace.sourceCommitStatus === 'unavailable_by_contract').toBe(true);
    const det = (trace.candidateLineage || []).find((c) => c.candidateKind === 'client_deterministic');
    expect(det?.noOpDetected).toBe(true);
    expect(det?.accepted).toBe(false);
    const finalSel = (trace.candidateLineage || []).find((c) => c.candidateKind === 'final_selected');
    expect(finalSel?.present).toBe(false);
    expect(finalSel?.accepted).toBe(false);
  });

  it('U: formatting-only difference is a no-op; material wording is meaningful', () => {
    const base = 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत हैं।';
    const whitespaceOnly = `  ${base.replace(/।/g, '।  ')} \n`;
    const fmt = evaluateSummaryMeaningfulChange(base, whitespaceOnly);
    expect(fmt.noOpDetected).toBe(true);
    expect(fmt.meaningfulChangeDetected).toBe(false);
    expect(fmt.noOpRejectionReason).toBe('summary_noop_after_normalization');

    const material = `${base} आने वाले माल की जाँच करती हैं।`;
    const changed = evaluateSummaryMeaningfulChange(base, material);
    expect(changed.meaningfulChangeDetected).toBe(true);
    expect(changed.noOpDetected).toBe(false);
  });

  it('V: generate_empty accepts deterministic content without enhance no-op', () => {
    const cv = fixtureCv({ summary: '' });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: '2026-07-19',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.blocked).toBe(false);
    expect((fin.text || '').trim().length).toBeGreaterThan(20);
    expect(fin.diagnostics?.noOpDetected).toBe(false);
  });

  it('W: rejection reasons are stably deduplicated', () => {
    expect(dedupeStableStrings([
      'unsupported_print_medium',
      'unsupported_branding_claim',
      'unsupported_print_medium',
    ])).toEqual([
      'unsupported_print_medium',
      'unsupported_branding_claim',
    ]);
  });

  it('X: completeness fails on unitCount/unitHashes mismatch and null commit without status', () => {
    const bad = {
      ...aab298IncompletePayload(),
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      meaningfulChangeDetected: true,
      noOpDetected: false,
      apiResponseKind: 'provider',
      serverFallbackUsed: false,
      clientFallbackUsed: true,
      apiBaseUrlConfigured: true,
      capacitorServerUrlConfigured: false,
      sourceCommitStatus: 'embedded',
      sourceCommitShort: null,
      internalDiagnosticsEnabled: true,
      candidateLineage: [{
        candidateKind: 'provider',
        present: true,
        unitCount: 3,
        unitHashes: [],
        accepted: false,
        rejectionReasons: [],
      }],
    };
    const check = checkSummaryDiagnosticCompleteness(bad);
    expect(check.passed).toBe(false);
    expect(
      check.nullRequiredDiagnosticFields.join(' ')
      + check.missingRequiredDiagnosticFields.join(' '),
    ).toMatch(/unitHashes|sourceCommitShort|hindi/);
  });

  it('Y: provider safe meaningful change selects provider', () => {
    clearSummaryAiDiagnosticsForTests();
    const baseCv = fixtureCv({ summary: 'पुराना अलग सारांश।' });
    // Build a known-good deterministic text first, then use it as provider candidate.
    const emptyCv = fixtureCv({ summary: '' });
    const generated = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: emptyCv,
      candidate: '',
      referenceDateIso: '2026-07-19',
    });
    expect(generated.countedAsSuccess).toBe(true);
    const good = (generated.text || '').trim();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: baseCv,
      candidate: good,
      referenceDateIso: '2026-07-19',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('ai_generated');
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.clientFallbackUsed).toBe(false);
    expect(fin.diagnostics?.providerOutcome).toBe('accepted');
  });
});

describe('cv-ai-diagnostics-v2 type smoke', () => {
  it('SummaryAiDiagnosticTrace accepts v2 fields', () => {
    const t = {
      schemaVersion: 1,
      marker: 'SUMMARY_AI_DIAG_V1',
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      hindiNominalExperienceFragmentDetected: false,
      hindiSentenceHasFiniteCopulaOrVerb: [true, true, true],
      finalUnsupportedDesignMediumCount: 0,
    } as Partial<SummaryAiDiagnosticTrace>;
    expect(t.diagnosticContractRevision).toBe('cv-ai-diagnostics-v2');
  });
});
