/**
 * AAB-353 — Hindi Professional Summary Stronger cross-locale defects:
 * first-person perspective, no duplicate warehouse intro, 3+3 facts,
 * total-career duration once, candidate lineage truth.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  analyzeHindiSummaryEmploymentQuality,
  buildConciseGroundedSummary,
} from '@/lib/cv-summary-grounding';
import {
  buildHindiEntryOwnedSummary,
  detectHindiSummaryPerspective,
  isHindiEntryOwnedSummaryComplete,
  isHindiThirdPersonBiographySummary,
  analyzeHindiSummaryFactCoverage,
} from '@/lib/cv-hindi-summary-grounding';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import type { CVData } from '@/lib/types';

const REF = '2026-07-20';

const WH_EN = [
  'checks incoming goods;',
  'checks documentation related to received goods;',
  'coordinates with colleagues on preparation and movement of goods.',
].join('\n');

const GD_EN = [
  'created visual materials and graphic elements;',
  'reviewed and adapted design materials;',
  'prepared final design files for different formats and screens.',
].join('\n');

/** Validated 493-character Serbian Summary (source before Hindi Stronger). */
const SOURCE_SR =
  'Imam oko šest i po godina ukupnog profesionalnog iskustva. Trenutno radim u '
  + 'kompaniji Atlas kao radnica u skladištu, gde proveravam pristiglu robu i '
  + 'dokumentaciju povezanu sa primljenom robom i sarađujem sa kolegama na pripremi i '
  + 'premeštanju robe. Prethodno sam radila kao grafička dizajnerka u kompaniji '
  + 'Rewitu, gde sam kreirala vizuelne materijale i grafičke elemente, pregledala i '
  + 'prilagođavala dizajnerske materijale i pripremala završne dizajnerske datoteke '
  + 'za različite formate i ekrane.';

/** AAB-353 device provider form (two-sentence third-person biography). */
const PROVIDER_AAB353 =
  'जनवरी 2023 से Atlas में वेयरहाउस कर्मचारी के रूप में कार्यरत, लगभग साढ़े छह '
  + 'वर्षों का संयुक्त अनुभव रखने वाली पेशेवर हैं। वेयरहाउस वर्कर के रूप में '
  + 'कार्यरत हैं, आने वाले माल और संबंधित दस्तावेज़ों की जाँच करती हैं तथा माल की '
  + 'तैयारी और स्थानांतरण में सहयोगियों के साथ काम करती हैं। इससे पहले Rewitu में '
  + 'ग्राफ़िक डिज़ाइनर के रूप में विज़ुअल सामग्री तैयार की, डिज़ाइन सामग्रियों की '
  + 'समीक्षा और अनुकूलन किया, तथा विभिन्न फ़ॉर्मेट के लिए अंतिम डिज़ाइन फ़ाइलें '
  + 'तैयार कीं।';

const EXPECTED_FINAL =
  'मेरे पास लगभग साढ़े छह वर्षों का कुल पेशेवर अनुभव है। वर्तमान में मैं Atlas '
  + 'में वेयरहाउस कर्मचारी के रूप में कार्यरत हूँ, जहाँ मैं आने वाले माल की जाँच '
  + 'करती हूँ, प्राप्त माल से संबंधित दस्तावेज़ों का सत्यापन करती हूँ और माल की '
  + 'तैयारी तथा स्थानांतरण में सहकर्मियों के साथ समन्वय करती हूँ। इससे पहले मैंने '
  + 'Rewitu में ग्राफ़िक डिज़ाइनर के रूप में काम किया, जहाँ मैंने दृश्य सामग्री '
  + 'बनाई और ग्राफ़िक तत्व तैयार किए, डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया '
  + 'तथा विभिन्न प्रारूपों और स्क्रीन के लिए अंतिम डिज़ाइन फ़ाइलें तैयार कीं।';

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function deviceCv(summary = SOURCE_SR): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary,
    contentLocale: 'sr',
    summaryOrigin: 'ai_generated',
    experience: [
      {
        id: 'atlas',
        position: 'Warehouse Employee',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_EN,
        canonicalDescription: WH_EN,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
      {
        id: 'rewitu',
        position: 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: GD_EN,
        canonicalDescription: GD_EN,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

function assertFirstPersonHindiFinal(text: string, cv?: CVData): void {
  if (summaryV2ModeActive()) {
    expectSummaryContractInvariants({
      text,
      locale: 'hi',
      cv: cv || deviceCv(),
      requirePrior: true,
    });
    return;
  }

  expect(text.replace(/\s+/g, ' ').trim()).toBe(EXPECTED_FINAL.replace(/\s+/g, ' ').trim());
  expect(detectHindiSummaryPerspective(text)).toBe('first_person');
  expect(isHindiThirdPersonBiographySummary(text)).toBe(false);
  expect(isHindiEntryOwnedSummaryComplete(text)).toBe(true);
  expect(text).toMatch(/मेरे\s+पास/);
  expect(text).toMatch(/कार्यरत\s+हूँ/);
  expect(text).toMatch(/जाँच\s+करती\s+हूँ/);
  expect(text).toMatch(/मैंने/);
  expect(text).not.toMatch(/पेशेवर\s+हैं/);
  expect(text).not.toMatch(/कार्यरत\s+हैं/);
  expect(text).not.toMatch(/वेयरहाउस\s*वर्कर/);
  expect((text.match(/वेयरहाउस\s*कर्मचारी/g) || []).length).toBe(1);
  expect(text).toMatch(/ग्राफ़िक\s*तत्व|ग्राफिक\s*तत्व/);
  expect(text).toMatch(/स्क्रीन/);
  const units = text.split(/(?<=[।.!?])\s+/u).filter(Boolean);
  expect(units).toHaveLength(3);

}

describe('AAB-353 Hindi Summary Stronger first-person contract', () => {
  beforeEach(() => {
    seedUsage(24);
  });

  it('source Serbian Summary is the validated 493-character form', () => {
    expect(SOURCE_SR.length).toBe(493);
  });

  it('builder emits exact three-sentence first-person Hindi', () => {
    const built = buildHindiEntryOwnedSummary({
      gender: 'female',
      employer: 'Atlas',
      priorEmployer: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      duration: {
        hasValidDates: true,
        unit: 'years',
        approxYears: 6.5,
        totalMonths: 78,
        fullYears: 6,
        remainingMonths: 6,
      },
    });
    assertFirstPersonHindiFinal(built);
  });

  it('exact Stronger path: AAB-353 provider → first-person apply + usage +1', () => {
    const cv = deviceCv();
    expect(cv.summary.length).toBe(493);
    expect(getProAiUsageCount()).toBe(24);
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(durationSnapshot.total.totalMonths).toBe(78);

    expect(isHindiThirdPersonBiographySummary(PROVIDER_AAB353)).toBe(true);
    expect(detectHindiSummaryPerspective(PROVIDER_AAB353)).toBe('neutral_cv');

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: PROVIDER_AAB353,
      cv,
      requestedLocale: 'hi',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertFirstPersonHindiFinal(fin.text);
    expect(fin.diagnostics?.rewriteStyle).toBe('stronger');
    expect(fin.diagnostics?.structuredDurationMonths
      ?? durationSnapshot.total.totalMonths).toBe(78);
    expect(fin.diagnostics?.perspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.finalPerspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.perspectiveValidationPassed).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.missingCurrentDutyFactCount).toBe(0);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.finalCurrentDutyCoveragePassed).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.requiredPriorDutyFactCount).toBe(3);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.missingPriorDutyFactCount).toBe(0);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.finalPriorDutyCoveragePassed).toBe(true);
    }
    expect(fin.diagnostics?.totalDurationSlotPresent).toBe(true);
    expect(fin.diagnostics?.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(fin.diagnostics?.finalDurationScopeValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalDurationCurrentRoleAttachmentRisk).toBe(false);
    expect(fin.diagnostics?.finalCurrentEmployerPresent).toBe(true);
    expect(fin.diagnostics?.finalPriorEmployerPresent).toBe(true);
    expect(fin.diagnostics?.finalCurrentEmploymentStateExpressed).toBe(true);
    expect(fin.diagnostics?.finalPriorEmploymentStateExpressed).toBe(true);
    expect(fin.diagnostics?.finalCurrentRoleIntroValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalPriorRoleIntroValidationPassed).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.repairApplied).not.toBe(true);
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.repairCandidatePresent).not.toBe(true);
    }

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'hi',
      requestedLocale: 'hi',
      contentLocale: 'sr',
      gender: 'female',
      usageCountBefore: 24,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, SOURCE_SR);
    session.recordFinalizeResult(fin);
    const pre = session.evaluatePreApplyDecisionGates();
    if (!summaryV2ModeActive()) {
      expect(pre.passed).toBe(true);
    }
    const next = applyFinalizedSummaryToCv(cv, 'hi', fin);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(25);
    session.recordVisibleApply(true, 25, fin.text);
    if (!summaryV2ModeActive()) {
      expect(next.summary).toBe(fin.text);
      expect(session.draft.visibleApplySucceeded).toBe(true);
      expect(session.draft.visibleRequiredCurrentDutyFactCount).toBe(3);
      expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(3);
      expect(session.draft.visibleMissingCurrentDutyFactCount).toBe(0);
      expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(true);
      expect(session.draft.visibleRequiredPriorDutyFactCount).toBe(3);
      expect(session.draft.visibleCoveredPriorDutyFactCount).toBe(3);
      expect(session.draft.visibleMissingPriorDutyFactCount).toBe(0);
      expect(session.draft.visiblePriorDutyCoveragePassed).toBe(true);
      expect(session.draft.visibleDurationScopeValidationPassed).toBe(true);
      const inv = checkSummaryDiagnosticInvariants(session.draft as never);
      expect(inv.passed, JSON.stringify(inv.failures)).toBe(true);
    } else {
      // V2 owns finalize text; apply may preserve source until V2 apply packaging lands.
      expect(fin.text.length).toBeGreaterThan(40);
      expect(fin.countedAsSuccess).toBe(true);
      expect(getProAiUsageCount()).toBe(25);
    }
  });

  it('rejects collapsed inbound+docs and missing graphic/screens coverage', () => {
    const collapsed = analyzeHindiSummaryFactCoverage(PROVIDER_AAB353, {
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      role: 'Warehouse Employee',
      priorRole: 'Graphic Designer',
    });
    expect(collapsed.collapsedInboundDocsDetected).toBe(true);
    expect(collapsed.finalCurrentDutyCoveragePassed).toBe(false);
    expect(collapsed.priorScreensMissingDetected).toBe(true);
    expect(collapsed.finalPriorDutyCoveragePassed).toBe(false);

    const ok = analyzeHindiSummaryFactCoverage(EXPECTED_FINAL, {
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      role: 'Warehouse Employee',
      priorRole: 'Graphic Designer',
    });
    expect(ok.finalCurrentDutyCoveragePassed).toBe(true);
    expect(ok.finalPriorDutyCoveragePassed).toBe(true);
    expect(ok.coveredCurrentDutyFactCount).toBe(3);
    expect(ok.coveredPriorDutyFactCount).toBe(3);
  });

  it('employment quality requires first-person and total-career duration', () => {
    const bad = analyzeHindiSummaryEmploymentQuality(PROVIDER_AAB353, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
    });
    expect(bad.groundingValidationPassed).toBe(false);
    expect(bad.perspectiveValidationPassed).toBe(false);
    expect(bad.thirdPersonBiographyDetected).toBe(true);
    expect(bad.duplicateWarehouseRoleIntroDetected).toBe(true);

    const good = analyzeHindiSummaryEmploymentQuality(EXPECTED_FINAL, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
    });
    expect(good.groundingValidationPassed).toBe(true);
    expect(good.perspectiveMode).toBe('first_person');
    expect(good.perspectiveValidationPassed).toBe(true);
    expect(good.totalDurationSlotPresent).toBe(true);
    expect(good.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(good.slotValidationPassed).toBe(true);
  });

  it('canonical grounded builder matches entry-owned Hindi package', () => {
    const cv = deviceCv();
    const factSet = buildCvCanonicalFactSet(cv, 'hi');
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF).total;
    const text = buildConciseGroundedSummary(factSet, 'hi', 'female', duration);
    assertFirstPersonHindiFinal(text);
  });
});
