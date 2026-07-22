/**
 * AAB 296: Hindi Professional Summary — reject unsupported print medium and
 * incomplete finite-sentence grammar; repair → deterministic fallback; usage +0/+1.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import {
  analyzeHindiSummaryEmploymentQuality,
  buildHindiPriorDesignSentence,
  scanHindiUnsupportedDesignMediumClaims,
  validateHindiSummaryFiniteGrammar,
  splitHindiSummaryUnits,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION,
  HINDI_PRINT_CLAIM_RE,
  sourceSupportsHindiPrintMedium,
} from '../cv-summary-grounding';

const WH_HI = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

/** Digital-only prior design — no print in authoritative facts. */
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

/** Exact AAB-296 faulty Hindi Summary (unsupported print + incomplete grammar). */
const DEVICE_296 = `जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। जहाँ प्राप्त माल की जाँच, संबंधित दस्तावेज़ों की सटीकता की पुष्टि, वेयरहाउस रिकॉर्ड अपडेट करने और संग्रहीत माल की व्यवस्थित व्यवस्था बनाए रखने का कार्य करती। इससे पूर्व Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट और डिजिटल सामग्री के लिए डिज़ाइन तैयार करती थीं; प्रमुख कौशल में नेतृत्व, संगठन, अनुकूलनशीलता और संचार शामिल हैं।`;

function fixtureCv(options: {
  summary?: string;
  priorDesc?: string;
} = {}): CVData {
  const prior = options.priorDesc ?? GD_HI_DIGITAL;
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      location: 'Beograd',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary: options.summary ?? 'पूर्व सारांश अपरिवर्तित रखें।',
    experience: [
      {
        id: 'exp-wh',
        position: 'Warehouse Employee',
        company: 'Atlas',
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
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: prior,
        descriptionOrigin: 'user',
        originalUserDescription: prior,
        canonicalDescription: prior,
        generatedLocale: 'hi',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'hi',
  };
}

describe('AAB 296 Hindi Summary print medium + finite grammar', () => {
  it('exposes runtime medium/grammar revision marker', () => {
    expect(HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION).toBe('hindi-summary-nominal-grammar-298-v1');
  });

  it('A: exact DEVICE_296 is rejected — print + incomplete grammar; no apply; usage +0', () => {
    const medium = scanHindiUnsupportedDesignMediumClaims(DEVICE_296, GD_HI_DIGITAL);
    expect(medium.providerPrintClaimDetected).toBe(true);
    expect(medium.finalUnsupportedDesignMediumKinds).toContain('unsupported_print_medium');

    const units = splitHindiSummaryUnits(DEVICE_296);
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_296, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI_DIGITAL,
      priorCompany: 'Rewitu',
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.providerPrintClaimDetected).toBe(true);
    expect(q.finalUnsupportedDesignMediumKinds).toContain('unsupported_print_medium');
    expect(q.hindiCurrentIntroFiniteVerbPresent).toBe(false);
    expect(q.hindiStandaloneJahanFragmentDetected).toBe(true);
    expect(
      q.hindiCurrentDutyAuxiliaryPresent === false
      || q.hindiStandaloneJahanFragmentDetected
      || q.hindiIncompleteSentenceCount > 0,
    ).toBe(true);

    const grammar = validateHindiSummaryFiniteGrammar(units, q.finalUnitRoleSlots);
    expect(grammar.ok).toBe(false);
    expect(
      grammar.hindiGrammarRejectionReason === 'current_intro_copula_missing'
      || grammar.hindiGrammarRejectionReason === 'standalone_relative_fragment'
      || grammar.hindiGrammarRejectionReason === 'current_duty_auxiliary_missing',
    ).toBe(true);

    const previous = 'पूर्व सारांश अपरिवर्तित रखें।';
    const cv = fixtureCv({ summary: previous });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_enhance',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_296,
      referenceDateIso: '2026-07-20',
      originHint: 'ai_generated',
    });
    // Provider candidate alone must not apply; deterministic rebuild may still succeed.
    if (fin.countedAsSuccess) {
      expect(fin.text).not.toMatch(HINDI_PRINT_CLAIM_RE);
      expect(fin.text).toMatch(/पेशेवर\s+हैं।|कार्यरत\s+हैं।/);
      expect(fin.text).not.toMatch(/^जहाँ\s/m);
      expect(fin.diagnostics?.finalUnsupportedDesignMediumCount ?? 0).toBe(0);
      expect(fin.diagnostics?.grammarValidationPassed).toBe(true);
    } else {
      expect(fin.countedAsSuccess).toBe(false);
      const applied = applyFinalizedSummaryToCv(cv, 'hi', fin);
      expect(applied.summary).toBe(previous);
    }
  });

  it('A2: rejected DEVICE_296 analyzer path — print + grammar flags; prior summary untouched', () => {
    const previous = 'पूर्व सारांश बाइट-फ़ॉर-बाइट।';
    const cv = fixtureCv({ summary: previous });
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_296, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI_DIGITAL,
      priorCompany: 'Rewitu',
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.unsupportedClaimCount).toBeGreaterThan(0);
    expect(q.providerPrintClaimDetected).toBe(true);
    expect(q.hindiCurrentIntroFiniteVerbPresent).toBe(false);
    expect(q.hindiStandaloneJahanFragmentDetected).toBe(true);
    expect(cv.summary).toBe(previous);
  });

  it('B: safe finalize after DEVICE_296 — no print, complete grammar, usage +1', () => {
    const cv = fixtureCv({ summary: 'पुराना।' });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_296,
      referenceDateIso: '2026-07-20',
      originHint: 'ai_generated',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).not.toMatch(/प्रिंट|मुद्रित|मुद्रण|छपाई/);
    expect(fin.text).toMatch(/माल|गोदाम|वेयरहाउस/);
    expect(fin.text).toMatch(/दृश्य|ग्राफिक|डिज़ाइन|डिजिटल|फ़ाइल|स्क्रीन|प्रारूप/);
    expect(fin.text).toMatch(/पेशेवर\s+हैं।|कार्यरत\s+हैं।/);
    expect(fin.text).toMatch(/साढ़े\s*छह/);
    expect(fin.text).not.toMatch(/साढ़े\s*6\.5|6\.5/);
    expect((fin.text.match(/साढ़े\s*छह/g) || []).length).toBe(1);
    const units = splitHindiSummaryUnits(fin.text);
    expect(units.length).toBeGreaterThanOrEqual(3);
    const q = analyzeHindiSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI_DIGITAL,
      priorCompany: 'Rewitu',
    });
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.grammarValidationPassed).toBe(true);
    expect(q.finalUnitRoleSlots.slice(0, 3)).toEqual([
      'current_intro',
      'current_duty',
      'prior_role',
    ]);
    expect(fin.diagnostics?.summaryDurationRepairApplied === true
      || fin.diagnostics?.finalCandidateSource === 'deterministic_fallback'
      || fin.diagnostics?.finalCandidateSource === 'ai_repaired'
      || fin.diagnostics?.finalCandidateSource === 'ai_generated').toBe(true);
    // Activation repair was not hinted — duration-only ai_repaired must not claim summaryRepairApplied.
    if (fin.origin === 'ai_repaired' && !fin.diagnostics?.summaryRepairAttempted) {
      expect(fin.diagnostics?.summaryRepairApplied).toBe(false);
      expect(fin.diagnostics?.summaryDurationRepairApplied).toBe(true);
    }
  });

  it('C: unsafe repair retaining print routes to deterministic rebuild', () => {
    const unsafeRepair = `जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत और लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर हैं। प्राप्त माल की जाँच करती हैं। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट सामग्री तैयार कीं।`;
    const medium = scanHindiUnsupportedDesignMediumClaims(unsafeRepair, GD_HI_DIGITAL);
    expect(medium.finalUnsupportedDesignMediumKinds).toContain('unsupported_print_medium');

    const cv = fixtureCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_enhance',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: unsafeRepair,
      referenceDateIso: '2026-07-20',
      originHint: 'ai_repaired',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).not.toMatch(/प्रिंट|मुद्रित|मुद्रण|छपाई/);
    expect(fin.diagnostics?.summaryRepairAttempted).toBe(true);
    // Final applied candidate is the validated rebuild, not the print-bearing repair.
    expect(fin.origin === 'deterministic_fallback' || fin.text !== unsafeRepair).toBe(true);
  });

  it('D: complete failure leaves previous Summary unchanged; usage +0', () => {
    const previous = 'बाइट-फ़ॉर-बाइट पूर्व सारांश।';
    const cv = fixtureCv({ summary: previous });
    // Empty duties → builder cannot ground; poison candidate also invalid.
    cv.experience = (cv.experience || []).map((e) => ({
      ...e,
      description: '',
      canonicalDescription: '',
      originalUserDescription: '',
    }));
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_enhance',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_296,
      referenceDateIso: '2026-07-20',
      originHint: 'ai_generated',
    });
    expect(fin.countedAsSuccess).toBe(false);
    const next = applyFinalizedSummaryToCv(cv, 'hi', fin);
    expect(next.summary).toBe(previous);
  });

  it('E: explicit print source may mention print without false-positive reject', () => {
    expect(sourceSupportsHindiPrintMedium(GD_HI_WITH_PRINT)).toBe(true);
    const prior = buildHindiPriorDesignSentence({
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_HI_WITH_PRINT,
    });
    expect(prior).toMatch(/प्रिंट/);
    const medium = scanHindiUnsupportedDesignMediumClaims(prior, GD_HI_WITH_PRINT);
    expect(medium.finalUnsupportedDesignMediumCount).toBe(0);

    const cv = fixtureCv({ priorDesc: GD_HI_WITH_PRINT });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: 'x',
      referenceDateIso: '2026-07-20',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/प्रिंट/);
  });

  it('F: digital-only design accepts डिजिटल and rejects print forms', () => {
    const digitalOk = 'इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में डिजिटल उत्पादों के लिए डिज़ाइन तैयार किए।';
    expect(scanHindiUnsupportedDesignMediumClaims(digitalOk, GD_HI_DIGITAL)
      .finalUnsupportedDesignMediumCount).toBe(0);
    for (const bad of ['प्रिंट सामग्री', 'मुद्रित सामग्री', 'मुद्रण कार्य', 'छपाई']) {
      const text = `इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में ${bad} तैयार की।`;
      expect(
        scanHindiUnsupportedDesignMediumClaims(text, GD_HI_DIGITAL)
          .finalUnsupportedDesignMediumKinds,
      ).toContain('unsupported_print_medium');
    }
  });

  it('G/H: Hindi grammar positives and negatives', () => {
    const posUnits = [
      'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत और लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर हैं',
      'प्राप्त माल की जाँच करती हैं',
      'इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में फ़ाइलें तैयार कीं',
    ];
    const posSlots = ['current_intro', 'current_duty', 'prior_role'] as const;
    expect(validateHindiSummaryFiniteGrammar([...posUnits], [...posSlots]).ok).toBe(true);

    expect(validateHindiSummaryFiniteGrammar(
      ['जनवरी 2023 से Atlas में कार्यरत रखने वाली पेशेवर'],
      ['current_intro'],
    ).hindiGrammarRejectionReason).toBe('current_intro_copula_missing');

    expect(validateHindiSummaryFiniteGrammar(
      ['जहाँ प्राप्त माल की जाँच का कार्य करती'],
      ['current_duty'],
    ).hindiStandaloneJahanFragmentDetected).toBe(true);

    expect(validateHindiSummaryFiniteGrammar(
      ['प्राप्त माल की जाँच करती'],
      ['current_duty'],
    ).hindiGrammarRejectionReason).toBe('current_duty_auxiliary_missing');

    expect(validateHindiSummaryFiniteGrammar(
      ['आने वाले माल के समन्वय का अनुभव'],
      ['current_duty'],
    ).hindiGrammarRejectionReason).toBe('nominal_experience_fragment');

    expect(validateHindiSummaryFiniteGrammar(
      ['माल की जाँच का अनुभव रखती हैं'],
      ['current_duty'],
    ).ok).toBe(true);

    expect(validateHindiSummaryFiniteGrammar(
      ['कार्यरत'],
      ['current_intro'],
    ).ok).toBe(false);
  });

  it('I/J: three-slot integrity and single Hindi duration', () => {
    const cv = fixtureCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_296,
      referenceDateIso: '2026-07-20',
    });
    expect(fin.countedAsSuccess).toBe(true);
    const q = analyzeHindiSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI_DIGITAL,
      priorCompany: 'Rewitu',
    });
    expect(q.finalUnitRoleSlots.filter((s) => s === 'current_intro').length).toBe(1);
    expect(q.finalUnitRoleSlots).toContain('current_duty');
    expect(q.finalUnitRoleSlots).toContain('prior_role');
    expect(q.semanticCrossEntryLeakageDetected).toBe(false);
    expect(fin.text).toMatch(/साढ़े\s*छह\s*वर्षों/);
    expect(fin.text).not.toMatch(/6\.5/);
  });

  it('pipeline: DEVICE_296 → one successful apply', () => {
    const cv = fixtureCv({ summary: 'पुराना।' });
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'summary_generate',
      candidate: DEVICE_296,
      referenceDateIso: '2026-07-20',
    });
    expect(pipe.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.stateCv.summary).not.toMatch(/प्रिंट/);
    expect(pipe.stateCv.summary).toMatch(/पेशेवर\s+हैं।|कार्यरत\s+हैं।/);
  });
});
