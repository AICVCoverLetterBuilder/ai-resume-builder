/**
 * Build 275: Hindi Summary — employment dedupe, professional-label once,
 * concrete warehouse grounding, perspective/duration/provenance diagnostics.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import { analyzeHindiSummaryEmploymentQuality } from '../cv-summary-grounding';
import { analyzeDurationRepresentations } from '../cv-summary-duration-ownership';
import { resolveOccupationalTitleForSummary } from '../cv-role-title';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '../cv-summary-ai-diagnostics';

const WH_HI = formatExperienceBullets([
  'आने वाले माल और संबंधित दस्तावेज़ों की जाँच कर सही रिकॉर्ड सुनिश्चित करती है।',
  'गोदाम के रिकॉर्ड अद्यतन करती है और सामान को व्यवस्थित रखती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
]);

const GD_HI = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों के लिए अनुकूलित किया।',
]);

const DEVICE_275 = `जनवरी 2023 से Atlas में पेशेवर के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। वर्तमान में Atlas में वेयरहाउस वर्कर के रूप में दैनिक रिकॉर्ड की समीक्षा करती, कार्य दस्तावेज़ अपडेट करती और सहयोगियों के साथ जानकारी का समन्वय करती। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट व डिजिटल सामग्री के लिए डिज़ाइन तैयार करती थीं और ब्रांड दिशानिर्देशों का पालन करते हुए टीम के साथ समन्वय करती थीं।`;

function fixtureCv(summary = DEVICE_275): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      location: 'Beograd',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary,
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
        description: GD_HI,
        descriptionOrigin: 'user',
        originalUserDescription: GD_HI,
        canonicalDescription: GD_HI,
        generatedLocale: 'hi',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'en',
  };
}

function assertValidBuild275Summary(text: string) {
  expect(text.trim()).toBeTruthy();
  expect(text).toMatch(/\p{Script=Devanagari}/u);
  expect(text).toMatch(/(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|कार्यरत\s+हूँ|मेरे\s+पास/u);
  expect(text).not.toMatch(/पेशेवर\s+हैं|कार्यरत\s+हैं|वेयरहाउस\s*वर्कर/u);
  expect(text).toMatch(/साढ़े\s*छह/);
  expect(text).not.toMatch(/साढ़े\s*6\.5|6\.5/);
  expect(text).toMatch(/कुल\s+पेशेवर\s+अनुभव|संयुक्त\s*अनुभव/);
  expect(text).toMatch(/वेयरहाउस\s*कर्मचारी/);
  expect(text).toMatch(/Atlas/);
  expect((text.match(/Atlas/g) || []).length).toBe(1);
  expect((text.match(/पेशेवर/g) || []).length).toBeGreaterThanOrEqual(1);
  expect(text).toMatch(/माल|गोदाम/);
  expect(text).not.toMatch(/दैनिक\s*रिकॉर्ड|कार्य\s*दस्तावेज़|जानकारी\s*का\s*समन्वय/);
  expect(text).not.toMatch(/वर्तमान\s+में\s+Atlas\s+में\s+वेयरहाउस/);
  expect(text).toMatch(/Rewitu|ग्राफिक|ग्राफ़िक|डिज़ाइन|दृश्य|डिजिटल/);
  expect(text).not.toMatch(/प्रिंट|मुद्रित|मुद्रण|छपाई/);
  expect(text).toMatch(/कार्यरत\s+हूँ|मेरे\s+पास/);
  const q = analyzeHindiSummaryEmploymentQuality(text, {
    company: 'Atlas',
    role: 'वेयरहाउस कर्मचारी',
    startDate: '2023-01',
    sourceDuties: WH_HI,
    currentEntryDuties: WH_HI,
    priorEntryDuties: GD_HI,
    priorCompany: 'Rewitu',
    structuredRole: 'वेयरहाउस कर्मचारी',
  });
  expect(q.currentEmploymentIntroductionCount).toBe(1);
  expect(q.repeatedEmploymentFactCount).toBe(0);
  expect(q.repeatedProfessionalLabelCount).toBe(0);
  expect(q.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
  expect(q.genericizedMaterialFactCount).toBe(0);
  expect(q.priorRoleGroundingPassed).toBe(true);
  expect(q.groundingValidationPassed).toBe(true);
}

describe('build 275 Hindi Summary employment/warehouse quality', () => {
  it('localizes Warehouse Employee to वेयरहाउस कर्मचारी (not पेशेवर)', () => {
    expect(resolveOccupationalTitleForSummary({
      profileJobTitle: 'Warehouse Employee',
      currentExperienceTitle: 'Warehouse Employee',
      locale: 'hi',
      gender: 'female',
      dutiesText: WH_HI,
    })).toBe('वेयरहाउस कर्मचारी');
  });

  it('rejects device-275 duplicate employment + generic duties in quality analyzer', () => {
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_275, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      startDate: '2023-01',
      sourceDuties: WH_HI,
    });
    expect(q.currentEmploymentIntroductionCount).toBeGreaterThanOrEqual(2);
    expect(q.repeatedEmploymentFactCount).toBeGreaterThanOrEqual(1);
    expect(q.repeatedProfessionalLabelCount).toBeGreaterThanOrEqual(1);
    expect(q.genericizedMaterialFactCount).toBeGreaterThanOrEqual(1);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('finalizes device-275 fixture to grounded Hindi Summary; usage +1', () => {
    const cv = fixtureCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_275,
      referenceDateIso: '2026-07-19',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertValidBuild275Summary(fin.text);
    expect(fin.diagnostics?.finalPerspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.perspectiveValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalDurationRepresentationKind).toBe('written_half_year');
    expect(fin.diagnostics?.finalDurationRepresentationCount).toBe(1);
    expect(fin.diagnostics?.finalDurationHybridDetected).toBe(false);
    expect(fin.diagnostics?.visibleDurationRepresentationKind).toBe('written_half_year');
    expect(fin.diagnostics?.durationSemanticValueMonths).toBe(78);
    expect(fin.diagnostics?.durationRepresentationAgreement).toBe(true);
    expect(fin.diagnostics?.currentEmploymentIntroductionCount).toBe(1);
    expect(fin.diagnostics?.repeatedEmploymentFactCount).toBe(0);
    expect(fin.diagnostics?.repeatedProfessionalLabelCount).toBe(0);
    expect(fin.diagnostics?.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(fin.diagnostics?.genericizedMaterialFactCount).toBe(0);
    expect(fin.diagnostics?.priorRoleGroundingPassed).toBe(true);
    expect(fin.diagnostics?.groundingValidationPassed).toBe(true);
    expect(fin.diagnostics?.storedContentLocaleBeforeRequest).toBe('en');
    expect(fin.diagnostics?.detectedVisibleContentLocaleBeforeRequest).toBe('hi');
    expect(fin.diagnostics?.finalContentLocaleAfterApply).toBe('hi');

    const applied = applyFinalizedSummaryToCv(cv, 'hi', fin);
    expect(applied.contentLocale).toBe('hi');
    expect(applied.summary).toBe(fin.text);
  });

  it('exposes perspective/duration/provenance fields on diagnostic session JSON', () => {
    clearSummaryAiDiagnosticsForTests();
    const cv = fixtureCv();
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'hi',
      contentLocale: 'en',
      templateId: 'modern',
      requestId: 'build275-diag',
      usageCountBefore: 49,
      gender: 'female',
      operationMode: 'enhance_existing_content',
    });
    session.recordCvSnapshot(cv, DEVICE_275);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_275,
      referenceDateIso: '2026-07-19',
    });
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, 50, fin.text);
    const trace = session.commit();
    const json = JSON.stringify(trace);
    expect(json).toMatch(/"finalDurationRepresentationKind":\s*"written_half_year"/);
    expect(json).toMatch(/"visibleDurationRepresentationKind":\s*"written_half_year"/);
    expect(json).toMatch(/"durationSemanticValueMonths":\s*78/);
    expect(json).toMatch(/"durationRepresentationAgreement":\s*true/);
    expect(json).toMatch(/"finalPerspectiveMode":\s*"first_person"/);
    expect(json).toMatch(/"perspectiveValidationPassed":\s*true/);
    expect(json).toMatch(/"sourcePerspectiveMode"/);
    expect(json).toMatch(/"providerPerspectiveMode"/);
    expect(json).toMatch(/"perspectiveNormalizationAttempted"/);
    expect(json).toMatch(/"storedContentLocaleBeforeRequest":\s*"en"/);
    expect(json).toMatch(/"detectedVisibleContentLocaleBeforeRequest":\s*"hi"/);
    expect(json).toMatch(/"finalContentLocaleAfterApply":\s*"hi"/);
    expect(json).toMatch(/"finalCandidateSource"/);
    expect(json).toMatch(/"providerCandidatePresent"/);
    expect(json).toMatch(/"deterministicCandidatePresent"/);
    expect(json).toMatch(/"fallbackCandidatePresent"/);
    expect(json).toMatch(/"currentEmploymentIntroductionCount":\s*1/);
    expect(json).toMatch(/"repeatedEmploymentFactCount":\s*0/);
    expect(json).toMatch(/"repeatedProfessionalLabelCount":\s*0/);
    expect(json).toMatch(/"groundingValidationPassed":\s*true/);
    // Must not conflate provider length into fallback when deterministic rebuild applied.
    if (!trace.fallbackApplied) {
      expect(trace.fallbackSentenceCount).toBe(0);
    }
    expect(trace.perspectiveMode).not.toBeNull();
  });

  it('quality failure matrix: only fully grounded candidates apply', () => {
    const cv = fixtureCv('');
    const cases: Array<{ candidate: string; expectSuccess: boolean; label: string }> = [
      {
        label: 'duplicate Atlas intro',
        expectSuccess: false,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत। वर्तमान में Atlas में वेयरहाउस कर्मचारी के रूप में माल की जाँच करती। लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर।',
      },
      {
        label: 'duplicate पेशेवर',
        expectSuccess: false,
        candidate: 'जनवरी 2023 से Atlas में पेशेवर के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल और संबंधित दस्तावेज़ों की जाँच तथा गोदाम रिकॉर्ड के अद्यतन का अनुभव।',
      },
      {
        label: 'generic daily records',
        expectSuccess: false,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। दैनिक रिकॉर्ड की समीक्षा करती, कार्य दस्तावेज़ अपडेट करती और जानकारी का समन्वय करती।',
      },
      {
        label: 'first-person Hindi',
        expectSuccess: false,
        candidate: 'मैं जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत हूँ और लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर हूँ। आने वाले माल और संबंधित दस्तावेज़ों की जाँच तथा गोदाम रिकॉर्ड के अद्यतन का अनुभव।',
      },
      {
        label: 'hybrid duration',
        expectSuccess: false,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े 6.5 वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल और संबंधित दस्तावेज़ों की जाँच तथा गोदाम रिकॉर्ड के अद्यतन तथा सहकर्मियों के साथ माल की आवाजाही के समन्वय का अनुभव।',
      },
      {
        label: 'cross-domain warehouse in design',
        expectSuccess: false,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल और संबंधित दस्तावेज़ों की जाँच तथा गोदाम रिकॉर्ड के अद्यतन का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में माल और गोदाम की आवाजाही का समन्वय किया।',
      },
      {
        label: 'concrete warehouse + design grounded',
        expectSuccess: true,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल और संबंधित दस्तावेज़ों की जाँच, गोदाम रिकॉर्ड के अद्यतन तथा सहकर्मियों के साथ माल की तैयारी और आवाजाही के समन्वय का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट और डिजिटल सामग्री तैयार की और ब्रांड दिशानिर्देशों का पालन किया।',
      },
    ];

    for (const c of cases) {
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'hi',
        gender: 'female',
        cv,
        candidate: c.candidate,
        referenceDateIso: '2026-07-19',
      });
      if (c.expectSuccess) {
        expect(fin.countedAsSuccess, c.label).toBe(true);
        expect(fin.blocked, c.label).toBe(false);
        assertValidBuild275Summary(fin.text);
      } else if (fin.countedAsSuccess) {
        // Rejected candidates may be repaired into a valid grounded Summary.
        assertValidBuild275Summary(fin.text);
        expect(fin.text === c.candidate, `${c.label} must not apply invalid text unchanged`).toBe(false);
      } else {
        expect(fin.blocked || !fin.countedAsSuccess, c.label).toBe(true);
      }
    }
  });

  it('exact build-275 regression ×50 zero flakes; restart preserves Summary+locale', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const cv = fixtureCv(DEVICE_275);
      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'hi',
        action: 'summary_generate',
        candidate: DEVICE_275,
        referenceDateIso: '2026-07-19',
      });
      expect(pipe.blocked, `iter ${i}: ${pipe.reason}`).toBe(false);
      expect(pipe.finalized.countedAsSuccess).toBe(true);
      assertValidBuild275Summary(pipe.finalized.text);
      hashes.add(pipe.finalized.text);
      expect(pipe.stateCv.summary).toBe(pipe.finalized.text);
      expect(pipe.stateCv.contentLocale).toBe('hi');
      const reloaded = structuredClone(pipe.stateCv);
      expect(reloaded.summary).toBe(pipe.finalized.text);
      expect(reloaded.contentLocale).toBe('hi');
      const again = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'hi',
        gender: 'female',
        cv: reloaded,
        candidate: reloaded.summary,
        referenceDateIso: '2026-07-19',
      });
      if (again.countedAsSuccess) {
        assertValidBuild275Summary(again.text);
      }
    }
    expect(hashes.size).toBe(1);
  });

  it('written_half_year representation for साढ़े छह', () => {
    const rep = analyzeDurationRepresentations(
      'लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर।',
      'hi',
    );
    expect(rep.representationKind).toBe('written_half_year');
    expect(rep.hybridDetected).toBe(false);
    expect(rep.representationCount).toBe(1);
  });
});
