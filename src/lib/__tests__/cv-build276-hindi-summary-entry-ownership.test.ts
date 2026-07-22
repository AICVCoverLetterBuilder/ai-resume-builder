/**
 * Build 276: Hindi Summary — current-entry ownership, role title required,
 * concrete coverage ≥2, semantic cross-entry rejection, grammar, usage +0/+1.
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
  buildConciseGroundedSummary,
} from '../cv-summary-grounding';
import { buildCvCanonicalFactSet } from '../cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '../cv-experience-duration';
import { hashExperienceEntryId } from '../cv-experience-entry-isolation';

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

const DEVICE_276 = `जनवरी 2023 से Atlas में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। विभिन्न प्रिंट और डिजिटल सामग्री के लिए ग्राफिक डिज़ाइन तैयार करती थीं तथा ब्रांड की दृश्य पहचान को बनाए रखने के लिए डिज़ाइन दिशानिर्देशों का पालन करती थीं का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट और डिजिटल सामग्री तैयार की और ब्रांड की दृश्य पहचान बनाए रखी।`;

function fixtureCv(order: 'wh-first' | 'gd-first' = 'wh-first', summary = DEVICE_276): CVData {
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

function assertValidBuild276(text: string) {
  expect(text).toMatch(/वेयरहाउस\s*कर्मचारी/);
  expect(text).toMatch(/Atlas/);
  expect((text.match(/Atlas/g) || []).length).toBe(1);
  expect((text.match(/पेशेवर/g) || []).length).toBe(1);
  expect(text).toMatch(/साढ़े\s*छह/);
  expect(text).not.toMatch(/साढ़े\s*6\.5|6\.5/);
  expect(text).toMatch(/माल|गोदाम/);
  expect(text).toMatch(/Rewitu|ग्राफिक|डिज़ाइन|दृश्य|डिजिटल/);
  expect(text).not.toMatch(/प्रिंट|मुद्रित|मुद्रण|छपाई/);
  expect(text).toMatch(/पेशेवर\s+हैं।|कार्यरत\s+हैं।/);
  // Design must not occupy the current-duty slot before prior clause.
  const beforePrior = text.split(/इससे\s+पहले/)[0] || text;
  const dutyPart = beforePrior.replace(/^[^।]*।\s*/, '');
  expect(dutyPart).not.toMatch(/ग्राफिक|डिज़ाइन|प्रिंट|डिजिटल|ब्रांड/);
  expect(text).not.toMatch(/करती\s+थीं\s+का\s+अनुभव|करती\s+हैं\s+का\s+अनुभव/);
  expect(text).not.toMatch(/(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|हूँ/u);
}

describe('build 276 Hindi Summary current-entry ownership', () => {
  it('rejects exact device-276 output in quality analyzer', () => {
    const q = analyzeHindiSummaryEmploymentQuality(DEVICE_276, {
      company: 'Atlas',
      role: 'वेयरहाउस कर्मचारी',
      structuredRole: 'वेयरहाउस कर्मचारी',
      startDate: '2023-01',
      currentEntryDuties: WH_HI,
      priorEntryDuties: GD_HI,
      sourceDuties: `${WH_HI}\n${GD_HI}`,
    });
    expect(q.currentRoleConcreteFactCoverage).toBe(0);
    expect(q.currentRoleOmittedDetected).toBe(true);
    expect(q.currentSlotForeignFactCount).toBeGreaterThan(0);
    expect(q.semanticCrossEntryLeakageDetected).toBe(true);
    expect(q.duplicatedPriorRoleFactCount).toBeGreaterThan(0);
    expect(q.hindiFiniteKaAnubhavCollision).toBe(true);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('deterministic concise builder scopes facts by Present entry ID, not array order', () => {
    for (const order of ['wh-first', 'gd-first'] as const) {
      const cv = fixtureCv(order, '');
      const factSet = buildCvCanonicalFactSet(cv);
      const dur = buildExperienceDurationSnapshot(cv.experience!, '2026-07-19').total;
      const text = buildConciseGroundedSummary(factSet, 'hi', 'female', dur);
      assertValidBuild276(text);
      expect(text).toMatch(/जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी/);
      expect(text).toMatch(/इससे पहले Rewitu में ग्राफिक डिज़ाइनर/);
    }
  });

  it('finalizes device-276 → grounded Hindi; usage +1; diagnostics truthful', () => {
    const cv = fixtureCv('wh-first');
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_276,
      referenceDateIso: '2026-07-19',
      originHint: 'deterministic_fallback',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertValidBuild276(fin.text);
    expect(fin.diagnostics?.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(fin.diagnostics?.groundingValidationPassed).toBe(true);
    expect(fin.diagnostics?.currentRoleTitlePresent).toBe(true);
    expect(fin.diagnostics?.currentRoleTitleMatchesStructuredRole).toBe(true);
    expect(fin.diagnostics?.currentRoleOmittedDetected).toBe(false);
    expect(fin.diagnostics?.currentSlotForeignFactCount).toBe(0);
    expect(fin.diagnostics?.semanticCrossEntryLeakageDetected).toBe(false);
    expect(fin.diagnostics?.duplicatedPriorRoleFactCount).toBe(0);
    expect(fin.diagnostics?.finalPerspectiveMode).toBe('neutral_cv');
    expect(fin.diagnostics?.currentRoleTitleEntryIdHash).toBe(hashExperienceEntryId('exp-wh'));
  });

  it('invalid device-276 candidate alone never counts success without repair', () => {
    // Analyzer rejects; finalize must repair or block — never apply DEVICE_276 as-is.
    const cv = fixtureCv('wh-first');
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv,
      candidate: DEVICE_276,
      referenceDateIso: '2026-07-19',
    });
    expect(fin.text).not.toBe(DEVICE_276);
    if (fin.countedAsSuccess) {
      assertValidBuild276(fin.text);
    } else {
      expect(fin.blocked).toBe(true);
    }
  });

  it('failure matrix: only fully owned grounded candidates apply', () => {
    const cv = fixtureCv('wh-first', '');
    const cases: Array<{ label: string; candidate: string; expectApplyOk: boolean }> = [
      {
        label: 'role omitted + design in current slot',
        expectApplyOk: false,
        candidate: DEVICE_276,
      },
      {
        label: 'coverage 0 design-only duty',
        expectApplyOk: false,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। प्रिंट और डिजिटल सामग्री के लिए डिज़ाइन तैयार करने का अनुभव।',
      },
      {
        label: 'coverage 1 only inbound',
        expectApplyOk: false,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल की जाँच का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट तैयार की।',
      },
      {
        label: 'finite verb + का अनुभव',
        expectApplyOk: false,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल की जाँच करती थीं का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट तैयार की।',
      },
      {
        label: 'valid coverage 2+ warehouse + prior design',
        expectApplyOk: true,
        candidate: 'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह वर्षों का संयुक्त अनुभव रखने वाली पेशेवर। आने वाले माल और संबंधित दस्तावेज़ों की जाँच तथा गोदाम रिकॉर्ड के अद्यतन तथा सहकर्मियों के साथ माल की आवाजाही के समन्वय का अनुभव। इससे पहले Rewitu में ग्राफिक डिज़ाइनर के रूप में प्रिंट और डिजिटल सामग्री तैयार की और ब्रांड दिशानिर्देशों का पालन किया।',
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
      if (c.expectApplyOk) {
        expect(fin.countedAsSuccess, c.label).toBe(true);
        assertValidBuild276(fin.text);
      } else if (fin.countedAsSuccess) {
        // Must have been repaired away from the invalid candidate.
        expect(fin.text, c.label).not.toBe(c.candidate);
        assertValidBuild276(fin.text);
      } else {
        expect(fin.blocked || !fin.countedAsSuccess, c.label).toBe(true);
      }
    }
  });

  it('reordered Experience array keeps ownership via Present + entry IDs; 50×', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const order = i % 2 === 0 ? 'wh-first' : 'gd-first';
      const cv = fixtureCv(order, DEVICE_276);
      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'hi',
        action: 'summary_generate',
        candidate: DEVICE_276,
        referenceDateIso: '2026-07-19',
      });
      expect(pipe.blocked, `iter ${i} ${order}`).toBe(false);
      expect(pipe.finalized.countedAsSuccess).toBe(true);
      assertValidBuild276(pipe.finalized.text);
      expect(pipe.finalized.diagnostics?.currentRoleTitleEntryIdHash).toBe(
        hashExperienceEntryId('exp-wh'),
      );
      hashes.add(pipe.finalized.text);
      expect(pipe.stateCv.contentLocale).toBe('hi');
      expect(pipe.stateCv.summary).toBe(pipe.finalized.text);
      const restarted = structuredClone(pipe.stateCv);
      expect(restarted.summary).toBe(pipe.finalized.text);
      expect(restarted.contentLocale).toBe('hi');
    }
    // Both orderings must produce the same Atlas/warehouse current Summary.
    expect(hashes.size).toBe(1);
  });

  it('universal role-pair matrix: current slot never absorbs prior domain', () => {
    const COOK_HI = formatExperienceBullets([
      'दैनिक मेनू के अनुसार व्यंजन तैयार करती है।',
      'रसोई की स्वच्छता और खाद्य सुरक्षा बनाए रखती है।',
      'सामग्री की सूची अद्यतन करती है और ऑर्डर समन्वय करती है।',
    ]);
    const ADMIN_HI = formatExperienceBullets([
      'कार्यालय दस्तावेज़ों का प्रबंधन करती है।',
      'बैठकों का समन्वय करती है और कैलेंडर अपडेट करती है।',
      'आंतरिक पत्राचार और अभिलेखों का रखरखाव करती है।',
    ]);
    const pairs: Array<{
      label: string;
      currentPos: string;
      currentCo: string;
      currentDesc: string;
      priorPos: string;
      priorCo: string;
      priorDesc: string;
      currentCue: RegExp;
      foreignCue: RegExp;
    }> = [
      {
        label: 'warehouse + design',
        currentPos: 'Warehouse Employee',
        currentCo: 'Atlas',
        currentDesc: WH_HI,
        priorPos: 'Grafički dizajner',
        priorCo: 'Rewitu',
        priorDesc: GD_HI,
        currentCue: /माल|गोदाम/,
        foreignCue: /ग्राफिक|डिज़ाइन|प्रिंट/,
      },
      {
        label: 'design + warehouse',
        currentPos: 'Graphic Designer',
        currentCo: 'Rewitu',
        currentDesc: GD_HI,
        priorPos: 'Warehouse Employee',
        priorCo: 'Atlas',
        priorDesc: WH_HI,
        currentCue: /डिज़ाइन|दृश्य|ग्राफिक/,
        foreignCue: /माल और|गोदाम रिकॉर्ड|आवाजाही/,
      },
      {
        label: 'cook + administration',
        currentPos: 'Cook',
        currentCo: 'Bistro',
        currentDesc: COOK_HI,
        priorPos: 'Office Administrator',
        priorCo: 'OfficeCo',
        priorDesc: ADMIN_HI,
        currentCue: /व्यंजन|रसोई|खाद्य/,
        foreignCue: /दस्तावेज़ों का प्रबंधन|कैलेंडर|पत्राचार/,
      },
      {
        label: 'unknown free-text + known warehouse',
        currentPos: 'Floor Lead Associate',
        currentCo: 'ShopX',
        currentDesc: formatExperienceBullets([
          'ग्राहकों की सहायता करती है और दैनिक कार्यों का समन्वय करती है।',
          'स्टॉक स्तर की जाँच करती है और टीम को निर्देश देती है।',
          'शिफ्ट रिपोर्ट तैयार करती है।',
        ]),
        priorPos: 'Warehouse Employee',
        priorCo: 'Atlas',
        priorDesc: WH_HI,
        currentCue: /ग्राहक|स्टॉक|शिफ्ट/,
        foreignCue: /माल और|गोदाम रिकॉर्ड|आवाजाही/,
      },
      {
        label: 'two similar warehouse roles',
        currentPos: 'Warehouse Employee',
        currentCo: 'Atlas',
        currentDesc: WH_HI,
        priorPos: 'Warehouse Assistant',
        priorCo: 'Depot',
        priorDesc: formatExperienceBullets([
          'आने वाले माल की जाँच की।',
          'गोदाम रिकॉर्ड अद्यतन किए।',
          'माल की आवाजाही का समन्वय किया।',
        ]),
        currentCue: /माल|गोदाम/,
        foreignCue: /ग्राफिक|डिज़ाइन/,
      },
      {
        label: 'two distinct roles warehouse + cook',
        currentPos: 'Warehouse Employee',
        currentCo: 'Atlas',
        currentDesc: WH_HI,
        priorPos: 'Cook',
        priorCo: 'Bistro',
        priorDesc: COOK_HI,
        currentCue: /माल|गोदाम/,
        foreignCue: /व्यंजन|रसोई|खाद्य/,
      },
    ];
    for (const p of pairs) {
      const cv: CVData = {
        personal: {
          fullName: 'Ana', email: 'a@b.c', phone: '', location: '',
          jobTitle: p.currentPos, gender: 'female',
        },
        summary: '',
        experience: [
          {
            id: 'exp-prior',
            position: p.priorPos,
            company: p.priorCo,
            startDate: '2020-01',
            endDate: '2023-04',
            isPresent: false,
            description: p.priorDesc,
            descriptionOrigin: 'user',
            originalUserDescription: p.priorDesc,
            canonicalDescription: p.priorDesc,
            generatedLocale: 'hi',
          },
          {
            id: 'exp-cur',
            position: p.currentPos,
            company: p.currentCo,
            startDate: '2023-01',
            endDate: '',
            isPresent: true,
            description: p.currentDesc,
            descriptionOrigin: 'user',
            originalUserDescription: p.currentDesc,
            canonicalDescription: p.currentDesc,
            generatedLocale: 'hi',
          },
        ],
        education: [],
        skills: [],
        languages: [],
        contentLocale: 'hi',
      };
      const fin = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'hi',
        gender: 'female',
        cv,
        candidate: 'x',
        referenceDateIso: '2026-07-19',
      });
      expect(fin.countedAsSuccess, `${p.label}: ${fin.reason}`).toBe(true);
      expect(fin.text, p.label).toMatch(p.currentCue);
      expect(fin.text, p.label).toMatch(new RegExp(p.currentCo));
      const beforePrior = fin.text.split(/इससे\s+पहले/)[0] || fin.text;
      const dutyPart = beforePrior.replace(/^[^।]*।\s*/, '');
      expect(dutyPart, p.label).not.toMatch(p.foreignCue);
    }
  });
});
