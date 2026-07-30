/**
 * AAB-354 — Arabic Professional Summary Stronger cross-locale defects:
 * first-person perspective, 3+3 facts, total-career duration slot,
 * deterministic hash packaging, provider rejection lineage.
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
  analyzeArabicSummaryEmploymentQuality,
  buildConciseGroundedSummary,
} from '@/lib/cv-summary-grounding';
import {
  buildArabicEntryOwnedSummary,
  detectArabicSummaryPerspective,
  isArabicEntryOwnedSummaryComplete,
  isArabicThirdPersonBiographySummary,
  analyzeArabicSummaryFactCoverage,
  SUMMARY_BUILDER_REVISION_AR,
  SUMMARY_GROUNDING_REVISION_AR,
} from '@/lib/cv-arabic-summary-grounding';
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
import { fingerprintText } from '@/lib/cv-export-diagnostics';
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

/** Validated 527-character Hindi Summary (source before Arabic Stronger). */
const SOURCE_HI =
  'मेरे पास लगभग साढ़े छह वर्षों का कुल पेशेवर अनुभव है। वर्तमान में मैं Atlas '
  + 'में वेयरहाउस कर्मचारी के रूप में कार्यरत हूँ, जहाँ मैं आने वाले माल की जाँच '
  + 'करती हूँ, प्राप्त माल से संबंधित दस्तावेज़ों का सत्यापन करती हूँ और माल की '
  + 'तैयारी तथा स्थानांतरण में सहकर्मियों के साथ समन्वय करती हूँ। इससे पहले मैंने '
  + 'Rewitu में ग्राफ़िक डिज़ाइनर के रूप में काम किया, जहाँ मैंने दृश्य सामग्री '
  + 'बनाई और ग्राफ़िक तत्व तैयार किए, डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया '
  + 'तथा विभिन्न प्रारूपों और स्क्रीन के लिए अंतिम डिज़ाइन फ़ाइलें तैयार कीं।';

/** Third-person Arabic biography (provider/device-like rejection form). */
const PROVIDER_AAB354 =
  'موظفة مستودع تعمل لدى Atlas منذ يناير 2023، ولديها نحو ست سنوات ونصف من '
  + 'الخبرة المشتركة. تتمتع بخبرة في فحص البضائع الواردة والوثائق المرفقة، '
  + 'وتنسيق تجهيز البضائع وحركتها مع الزملاء. سبق لها العمل لدى Rewitu '
  + 'كمصممة جرافيك، حيث أعدّت مواد مطبوعة ورقمية.';

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function deviceCv(summary = SOURCE_HI): CVData {
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
    contentLocale: 'hi',
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

function assertFirstPersonArabicFinal(text: string, cv?: CVData): void {
  if (summaryV2ModeActive()) {
    expectSummaryContractInvariants({
      text,
      locale: 'ar',
      cv: cv || deviceCv(''),
      requirePrior: true,
    });
    return;
  }

  expect(detectArabicSummaryPerspective(text)).toBe('first_person');
  expect(isArabicThirdPersonBiographySummary(text)).toBe(false);
  expect(isArabicEntryOwnedSummaryComplete(text)).toBe(true);
  expect(text).toMatch(/لدي\s+نحو/);
  expect(text).toMatch(/الخبرة\s*المهنية\s*الإجمالية/);
  expect(text).toMatch(/أعمل\s+حاليا/);
  expect(text).toMatch(/موظفة\s*مستودع/);
  expect(text).toMatch(/البضائع\s*الواردة/);
  expect(text).toMatch(/الوثائق\s*المتعلق/);
  expect(text).toMatch(/الزملاء/);
  expect(text).toMatch(/سبق\s+أن\s+عملت/);
  expect(text).toMatch(/عناصر\s*رسومية/);
  expect(text).toMatch(/شاشات/);
  expect(text).not.toMatch(/تعمل\s+لدى/);
  expect(text).not.toMatch(/تتمتع\s+بخبرة/);
  expect(text).not.toMatch(/سبق\s+لها\s+العمل/);
  const units = text.split(/(?<=[.!?۔؟])\s+/u).filter(Boolean);
  expect(units).toHaveLength(3);

}

describe('AAB-354 Arabic Summary Stronger first-person contract', () => {
  beforeEach(() => {
    seedUsage(26);
  });

  it('exposes Arabic 354 builder/grounding revisions', () => {
    expect(SUMMARY_BUILDER_REVISION_AR).toBe('entry-owned-arabic-rebuild-354-v2');
    expect(SUMMARY_GROUNDING_REVISION_AR).toBe('entry-owned-arabic-grounding-354-v2');
  });

  it('source Hindi Summary is the validated 527-character form', () => {
    expect(SOURCE_HI.length).toBe(527);
  });

  it('builder emits exact three-sentence first-person Arabic', () => {
    const built = buildArabicEntryOwnedSummary({
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
    assertFirstPersonArabicFinal(built);
  });

  it('exact Stronger path: AAB-354 provider → first-person apply + usage +1', () => {
    const cv = deviceCv();
    expect(cv.summary.length).toBe(527);
    expect(getProAiUsageCount()).toBe(26);
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(durationSnapshot.total.totalMonths).toBe(78);

    expect(isArabicThirdPersonBiographySummary(PROVIDER_AAB354)).toBe(true);
    expect(detectArabicSummaryPerspective(PROVIDER_AAB354)).toBe('neutral_cv');

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: PROVIDER_AAB354,
      cv,
      requestedLocale: 'ar',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertFirstPersonArabicFinal(fin.text);
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
    expect(fin.diagnostics?.providerRejectionReason).toBeTruthy();
    expect(fin.diagnostics?.providerTypedRejectionReason).toBeTruthy();
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.deterministicCandidateHash).toBe(
      fin.diagnostics?.finalValidatedCandidateHash,
      );
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.durationPass1CandidateHash).toBe(
        fin.diagnostics?.deterministicCandidateHash,
      );
      expect(fin.diagnostics?.durationPass2CandidateHash).toBe(
        fin.diagnostics?.deterministicCandidateHash,
      );
      if (!summaryV2ModeActive()) {
        expect(fin.diagnostics?.groundingInputCandidateHash).toBe(
        fin.diagnostics?.deterministicCandidateHash,
        );
      }
      if (!summaryV2ModeActive()) {
        expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
        'duration',
        'current_intro',
        'prior_role',
        ]);
      }
    }

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'ar',
      requestedLocale: 'ar',
      contentLocale: 'hi',
      gender: 'female',
      usageCountBefore: 26,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, SOURCE_HI);
    session.recordFinalizeResult(fin);
    if (!summaryV2ModeActive()) {
      expect(session.draft.deterministicCandidateHash).toBe(
        fin.diagnostics?.deterministicCandidateHash,
      );
    }
    const pre = session.evaluatePreApplyDecisionGates();
    if (!summaryV2ModeActive()) {
      expect(pre.passed, JSON.stringify({
        reason: pre.reason,
        nullish: session.draft.nullRequiredDiagnosticFields,
        invariants: session.draft.diagnosticInvariantFailures,
      })).toBe(true);
    }
    const next = applyFinalizedSummaryToCv(cv, 'ar', fin);
    expect(next.summary).toBe(fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(27);
    session.recordVisibleApply(true, 27, fin.text);
    if (!summaryV2ModeActive()) {
      expect(session.draft.visibleApplySucceeded).toBe(true);
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleRequiredCurrentDutyFactCount).toBe(3);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(3);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleMissingCurrentDutyFactCount).toBe(0);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleCurrentDutyCoveragePassed).toBe(true);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleRequiredPriorDutyFactCount).toBe(3);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleCoveredPriorDutyFactCount).toBe(3);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleMissingPriorDutyFactCount).toBe(0);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visiblePriorDutyCoveragePassed).toBe(true);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleDurationScopeValidationPassed).toBe(true);
      }
      if (!summaryV2ModeActive()) {
        expect(session.draft.visibleCandidateHashAfterApply).toBe(
        fin.diagnostics?.deterministicCandidateHash,
        );
      }
      const inv = checkSummaryDiagnosticInvariants(session.draft as never);
      if (!summaryV2ModeActive()) {
        expect(inv.passed, JSON.stringify(inv.failures)).toBe(true);
      }
    } else {
      expect(next.summary).toBe(fin.text);
      expect(getProAiUsageCount()).toBe(27);
    }
  });

  it('originHint deterministic_fallback still packages top-level hash', () => {
    const cv = deviceCv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const good = buildArabicEntryOwnedSummary({
      gender: 'female',
      employer: 'Atlas',
      priorEmployer: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      duration: durationSnapshot.total,
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: good,
      cv,
      requestedLocale: 'ar',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'deterministic_fallback',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.deterministicCandidateHash).toBe(
        fingerprintText(good.replace(/\s+/g, ' ').trim()),
      );
    }
  });

  it('rejects collapsed inbound+docs and missing graphic/screens coverage', () => {
    const collapsed = analyzeArabicSummaryFactCoverage(PROVIDER_AAB354, {
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      role: 'Warehouse Employee',
      priorRole: 'Graphic Designer',
    });
    expect(collapsed.collapsedInboundDocsDetected).toBe(true);
    expect(collapsed.finalCurrentDutyCoveragePassed).toBe(false);
    expect(collapsed.finalPriorDutyCoveragePassed).toBe(false);

    const okText = buildArabicEntryOwnedSummary({
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
    const ok = analyzeArabicSummaryFactCoverage(okText, {
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
    const bad = analyzeArabicSummaryEmploymentQuality(PROVIDER_AAB354, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      gender: 'female',
    });
    expect(bad.groundingValidationPassed).toBe(false);
    expect(bad.perspectiveValidationPassed).toBe(false);
    expect(bad.thirdPersonBiographyDetected).toBe(true);
    expect(bad.typedRejectionReason).toBeTruthy();

    const goodText = buildArabicEntryOwnedSummary({
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
    const good = analyzeArabicSummaryEmploymentQuality(goodText, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      gender: 'female',
    });
    expect(good.groundingValidationPassed).toBe(true);
    expect(good.perspectiveMode).toBe('first_person');
    expect(good.perspectiveValidationPassed).toBe(true);
    expect(good.totalDurationSlotPresent).toBe(true);
    expect(good.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(good.slotValidationPassed).toBe(true);
  });

  it('canonical grounded builder matches entry-owned Arabic package', () => {
    const cv = deviceCv();
    const factSet = buildCvCanonicalFactSet(cv, 'ar');
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF).total;
    const text = buildConciseGroundedSummary(factSet, 'ar', 'female', duration);
    assertFirstPersonArabicFinal(text);
  });

  it('invariant: deterministic present + null hash fails', () => {
    const inv = checkSummaryDiagnosticInvariants({
      finalCandidateSource: 'deterministic_fallback',
      deterministicCandidatePresent: true,
      deterministicCandidateHash: null,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 26,
      usageCountAfter: 26,
      requestedLocale: 'ar',
    } as never);
    if (!summaryV2ModeActive()) {
      expect(inv.passed).toBe(false);
    }
    expect(inv.failures.some((f) => f.invariantCode === 'deterministic_present_without_hash')).toBe(true);
  });

  it('invariant: rejected provider without typed reason fails', () => {
    const inv = checkSummaryDiagnosticInvariants({
      providerCandidatePresent: true,
      providerAccepted: false,
      providerRejectionReason: null,
      providerTypedRejectionReason: null,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 26,
      usageCountAfter: 26,
      requestedLocale: 'ar',
    } as never);
    if (!summaryV2ModeActive()) {
      expect(inv.passed).toBe(false);
    }
    expect(inv.failures.some((f) => f.invariantCode === 'provider_rejected_without_typed_reason')).toBe(true);
  });

  it('rejected path preserves source Summary and usage', () => {
    seedUsage(26);
    const cv = deviceCv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: 'Carries out assigned professional duties only.',
      cv,
      requestedLocale: 'ar',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_generated',
    });
    // English leak should not apply as provider; deterministic may still succeed.
    if (fin.blocked || !fin.countedAsSuccess) {
      expect(getProAiUsageCount()).toBe(26);
      expect(cv.summary).toBe(SOURCE_HI);
    } else {
      expect(fin.origin).toBe('deterministic_fallback');
      expect(fin.diagnostics?.providerRejectionReason || fin.diagnostics?.providerTypedRejectionReason)
        .toBeTruthy();
    }
  });
});
