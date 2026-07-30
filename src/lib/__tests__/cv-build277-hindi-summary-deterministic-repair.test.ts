/**
 * Build 277: Hindi Summary deterministic repair must produce grounded,
 * role-owned Summary; invalid candidates stay rejected with usage +0.
 */
import { describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData } from '../types';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import {
  analyzeHindiSummaryEmploymentQuality,
  splitHindiSummaryUnits,
} from '../cv-summary-grounding';
import { resolveSummaryWithDurationPolicy } from '../cv-content-quality';
import { buildExperienceDurationSnapshot } from '../cv-experience-duration';

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

/** Exact invalid build-277 style candidate (role omitted + design in current slot). */
const DEVICE_277 = `जनवरी 2023 से Atlas में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। विभिन्न प्रिंट और डिजिटल सामग्री के लिए ग्राफिक डिज़ाइन तैयार करती थीं तथा ब्रांड की दृश्य पहचान को बनाए रखने के लिए डिज़ाइन दिशानिर्देशों का पालन करती थीं का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट और डिजिटल सामग्री तैयार की और ब्रांड की दृश्य पहचान बनाए रखी।`;

function fixtureCv(order: 'wh-first' | 'gd-first' = 'wh-first', summary = DEVICE_277): CVData {
  const wh = {
    id: 'exp-wh',
    position: 'Warehouse Employee',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_HI,
    descriptionOrigin: 'user' as const,
    originalUserDescription: WH_HI,
    canonicalDescription: WH_HI,
    generatedLocale: 'hi' as const,
  };
  const gd = {
    id: 'exp-gd',
    position: 'Grafički dizajner',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: GD_HI,
    descriptionOrigin: 'user' as const,
    originalUserDescription: GD_HI,
    canonicalDescription: GD_HI,
    generatedLocale: 'hi' as const,
  };
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
    experience: order === 'wh-first' ? [wh, gd] : [gd, wh],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'hi',
  };
}

function assertValidBuild277(text: string) {
  if (summaryV2ModeActive()) {
    expectSummaryContractInvariants({
      text,
      locale: 'hi',
      cv: fixtureCv(),
      requirePrior: true,
    });
    return;
  }

  if (!summaryV2ModeActive()) {
    expect(text).toMatch(/वेयरहाउस\s*कर्मचारी\s+के\s+रूप\s+में/);
  }
  expect(text).toMatch(/Atlas/);
  expect((text.match(/Atlas/g) || []).length).toBe(1);
  expect((text.match(/पेशेवर/g) || []).length).toBeGreaterThanOrEqual(1);
  expect(text).not.toMatch(/पेशेवर\s+के\s+रूप\s+में/);
  expect(text).toMatch(/साढ़े\s*छह/);
  expect(text).toMatch(/माल|गोदाम/);
  expect(text).toMatch(/Rewitu|ग्राफिक|डिज़ाइन|दृश्य|डिजिटल/);
  const beforePrior = text.split(/इससे\s+पहले/)[0] || text;
  const dutyPart = beforePrior.replace(/^[^।]*।\s*/, '');
  expect(dutyPart).not.toMatch(/ग्राफिक|डिज़ाइन|प्रिंट|डिजिटल|ब्रांड/);
  // Digital-only prior facts must not invent print media.
  expect(text).not.toMatch(/प्रिंट|मुद्रित|मुद्रण|छपाई/);
  if (!summaryV2ModeActive()) {
    expect(text).toMatch(/कार्यरत\s+हूँ|मेरे\s+पास/);
  }
  expect(text).not.toMatch(/करती थीं\s+का\s+अनुभव/);
}

describe('build 277 Hindi Summary deterministic repair', () => {
  it('rejects generic पेशेवर as warehouse title match', () => {
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_277, {
      company: 'Atlas',
      role: 'पेशेवर',
      structuredRole: 'पेशेवर',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI,
      priorCompany: 'Rewitu',
    });
    expect(q.currentRoleTitleMatchesStructuredRole).toBe(false);
    expect(q.currentRoleOmittedDetected).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(q.currentRoleConcreteFactCoverage).toBe(0);
    }
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.finalUnitRoleSlots).toContain('current_intro');
    expect(q.finalUnitRoleSlots).toContain('prior_role');
  });

  it('counts employment intro without के रूप में', () => {
    const text = 'जनवरी 2023 से Atlas में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर।';
    const q = analyzeHindiSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
    });
    expect(q.currentEmploymentIntroductionCount).toBe(1);
    expect(q.finalUnitRoleSlots[0]).toBe('current_intro');
  });

  it('does not split decimal 6.5 into separate units', () => {
    const text = 'जनवरी 2023 से Atlas में कार्यरत, लगभग साढ़े 6.5 वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल की जाँच का अनुभव।';
    const units = splitHindiSummaryUnits(text);
    expect(units.length).toBe(2);
    expect(units[0]).toMatch(/6\.5/);
  });

  it('repairs DEVICE_277 via deterministic fallback; usage +1; diagnostics truthful', () => {
    const cv = fixtureCv('wh-first');
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_enhance',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_277,
      referenceDateIso: '2026-07-19',
      originHint: 'deterministic_fallback',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertValidBuild277(fin.text);
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.currentRoleTitleMatchesStructuredRole).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.currentRoleOmittedDetected).toBe(false);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.currentRoleTitleSource).toBe('structured_current_role');
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.currentEmploymentIntroductionCount).toBe(1);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.priorRoleGroundingPassed).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.currentSlotForeignFactCount).toBe(0);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.semanticCrossEntryLeakageDetected).toBe(false);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.durationFinalizerIdempotent).toBe(true);
    }
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual(
      expect.arrayContaining(['duration', 'current_intro', 'prior_role']),
    );
    expect(fin.diagnostics?.finalUnitRoleSlots?.every((s) => s === 'current_duty')).toBe(false);

    const dur = buildExperienceDurationSnapshot(cv.experience!, '2026-07-19').total;
    const again = resolveSummaryWithDurationPolicy(fin.text, dur, 'hi', {
      forceDurationPhrase: true,
      requireDurationClaim: true,
      context: {
        role: 'वेयरहाउस कर्मचारी',
        company: 'Atlas',
        startDate: '2023-01',
        gender: 'female',
      },
    });
    expect(again.summary.trim()).toBe(fin.text.trim());
    expect(fin.text).not.toBe(DEVICE_277);
  });

  it('rejected invalid candidate counts as non-success when grounding cannot repair empty CV duties', () => {
    const bare: CVData = {
      ...fixtureCv('wh-first', DEVICE_277),
      experience: [],
    };
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_enhance',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: bare,
      candidate: DEVICE_277,
      referenceDateIso: '2026-07-19',
    });
    // Without Experience facts, repair cannot ground — fail closed, +0.
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.text === DEVICE_277 || fin.blocked || !fin.countedAsSuccess).toBe(true);
  });

  it('invalid DEVICE_277 analyzer stays fail-closed', () => {
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_277, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI,
      priorCompany: 'Rewitu',
    });
    expect(q.groundingValidationPassed).toBe(false);
    if (!summaryV2ModeActive()) {
      expect(q.currentRoleConcreteFactCoverage).toBe(0);
    }
  });

  it('reorder + splitting matrix; 50× zero flakes; restart preserves Summary+locale', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const order = i % 2 === 0 ? 'wh-first' : 'gd-first';
      const cv = fixtureCv(order, DEVICE_277);
      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'hi',
        action: 'summary_enhance',
        candidate: DEVICE_277,
        referenceDateIso: '2026-07-19',
      });
      expect(pipe.blocked, `iter ${i}`).toBe(false);
      expect(pipe.finalized.countedAsSuccess, `iter ${i}`).toBe(true);
      assertValidBuild277(pipe.finalized.text);
      if (!summaryV2ModeActive()) {
        expect(pipe.finalized.diagnostics?.durationFinalizerIdempotent).toBe(true);
      }
      expect(pipe.finalized.diagnostics?.currentEmploymentIntroductionCount).toBe(1);
      hashes.add(pipe.finalized.text);
      expect(pipe.stateCv.contentLocale).toBe('hi');
      expect(pipe.stateCv.summary).toBe(pipe.finalized.text);
      const restarted = structuredClone(pipe.stateCv);
      expect(restarted.summary).toBe(pipe.finalized.text);
      expect(restarted.contentLocale).toBe('hi');
    }
    expect(hashes.size).toBe(1);
  });
});
