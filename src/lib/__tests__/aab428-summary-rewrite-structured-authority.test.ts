/**
 * AAB-428 — a V2 rewrite-style surface is freshly constructed from the
 * manifest.  Validate it with that construction authority, rather than trying
 * to infer role and tense slots back from localized prose.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildSummaryV2DeterministicText,
  buildSummaryV2ManifestForCv,
  evaluateSummaryV2StyleFulfillment,
  runSummaryV2,
  setSummaryV2EnabledForTests,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
} from '@/lib/ai-usage-policy';

const REF = '2026-08-11';
const BAD_PROVIDER = 'अनग्राउंडेड प्रदाता पाठ।';

function work(options: Partial<WorkExperience> & Pick<WorkExperience, 'id' | 'position' | 'company' | 'startDate' | 'description'>): WorkExperience {
  return {
    endDate: '', isPresent: false, originalUserDescription: options.description,
    descriptionOrigin: 'user', ...options,
  } as WorkExperience;
}

/** Exact AAB-427 selected-entry topology: 90ceb current; be5c + a221 priors. */
function deviceCv(summary = ''): CVData {
  return {
    id: 'aab428-hindi-rewrite-authority',
    personal: { fullName: 'Test User', email: '', phone: '', address: '', jobTitle: '', gender: 'female' },
    summary,
    contentLocale: 'hi',
    experience: [
      work({ id: '90ceb-current-2026-03', position: 'ग्राफिक डिज़ाइनर', company: 'Rewitu Current Test', startDate: '2026-03', isPresent: true, generatedLocale: 'hi', description: 'डिजिटल सामग्री के लिए दृश्य अवधारणाएँ और लेआउट तैयार करती हूँ।\nविभिन्न परियोजनाओं के लिए ग्राफिक्स और छवियों को संपादित करती हूँ।\nपरियोजना टीम के सदस्यों के साथ मसौदों और संशोधनों का समन्वय करती हूँ।' }),
      work({ id: '8da-current-2026-01', position: 'अभिलेख पर्यवेक्षक', company: 'Archive Co', startDate: '2026-01', isPresent: true, generatedLocale: 'ar', description: 'रिकॉर्ड की समीक्षा करती हूँ।' }),
      work({ id: 'b9d3-current-2023-01', position: 'फाइल पर्यवेक्षक', company: 'File Co', startDate: '2023-01', isPresent: true, generatedLocale: 'ar', description: 'फाइलों का आयोजन करती हूँ।' }),
      work({ id: 'be5c-hi-completed', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH', startDate: '2024-01', endDate: '2026-02', generatedLocale: 'hi', description: 'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी।' }),
      work({ id: 'a221-ar-completed', position: 'ग्राफिक डिज़ाइनर', company: 'Rewitu', startDate: '2019-06', endDate: '2023-12', generatedLocale: 'ar', description: 'डिजिटल सामग्री के लिए दृश्य अवधारणाएँ और लेआउट तैयार किए।\nविभिन्न परियोजनाओं के लिए ग्राफिक्स और छवियों का संपादन किया।\nपरियोजना दल के सदस्यों के साथ मसौदों और संशोधनों का समन्वय किया।' }),
    ],
    education: [], skills: [], languages: [], certifications: [], projects: [], templateId: 'modern',
  } as unknown as CVData;
}

function seededCv(): CVData {
  const cv = deviceCv();
  const manifest = buildSummaryV2ManifestForCv({ cv, locale: 'hi', gender: 'female', referenceDateIso: REF });
  cv.summary = buildSummaryV2DeterministicText(manifest);
  return cv;
}

describe('AAB-428 Summary V2 rewrite structured-authority contract', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    persistProAiRecord({ schemaVersion: AI_USAGE_SCHEMA_VERSION, count: 427, windowStart: Date.now(), policyLimit: PRO_AI_SAFETY_CAP });
  });

  it('keeps 90ceb/be5c/a221 role and tense authority through Hindi Stronger validation and apply +1', () => {
    const cv = seededCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(duration.total.totalMonths).toBe(86);

    const pipeline = runSummaryV2({ cv, locale: 'hi', gender: 'female', referenceDateIso: REF, candidate: BAD_PROVIDER, rewriteStyle: 'stronger' });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.countedAsSuccess).toBe(true);
    expect(pipeline.validation.currentDutyTenseOk).toBe(true);
    expect(pipeline.validation.priorDutyTenseOk).toBe(true);
    expect(pipeline.validation.reason).toBeNull();
    expect(pipeline.pipelineDiagnostics?.styleFulfillment?.semanticStyleOperationsApplied)
      .toContain('duty_predicate_strengthen');
    expect(pipeline.validation.requiredCurrentFactCount).toBe(3);
    expect(pipeline.validation.requiredPriorFactCount).toBe(6);
    expect(pipeline.validation.finalUnitOwnership.map((unit) => unit.roleSlot)).toEqual([
      'duration', 'current_role', 'prior_role', 'prior_role',
    ]);
    expect(pipeline.validation.finalUnitOwnership.slice(1).every((unit) => unit.owningEntryHash !== null)).toBe(true);
    expect(pipeline.validation.materialAuthority.sourceAuthorityEvidence.some((evidence) => (
      evidence.owningEntryHash === pipeline.validation.finalUnitOwnership[2]?.owningEntryHash
    ))).toBe(true);
    expect(pipeline.text).toContain('डिजिटल सामग्री के लिए दृश्य अवधारणाएँ और लेआउट तैयार करती हूँ');
    expect(pipeline.text).toContain('विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी');
    expect(pipeline.text).toContain('ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी');
    expect(pipeline.text).toContain('डिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी');
    expect(pipeline.text).not.toMatch(/तैयार\s+सावधानीपूर्वक\s+करती हूँ/u);
    expect(pipeline.text).not.toContain('मुद्रित, साथ ही डिजिटल दृश्य अवधारणाएँ');
    expect(pipeline.text).not.toContain('साथ ही');

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger', field: 'summary', candidate: BAD_PROVIDER, cv,
      requestedLocale: 'hi', gender: 'female', referenceDateIso: REF,
      durationSnapshot: duration, rewriteStyle: 'stronger',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual(['duration', 'current_intro', 'prior_role', 'prior_role']);
    expect(getProAiUsageCount()).toBe(427);
    const applied = applyFinalizedSummaryToCv(cv, 'hi', fin);
    recordProAiUserActionSuccess();
    expect(applied.summary).toBe(fin.text);
    expect(getProAiUsageCount()).toBe(428);
  });

  it.each(['shorter', 'stronger', 'professional'] as const)(
    'preserves structured Hindi authority for %s without falling back to generic units',
    (rewriteStyle) => {
      const cv = seededCv();
      // Shorter needs a source with safe removable presentation emphasis; use
      // the manifest-owned Stronger surface, not an unrelated prose fixture.
      if (rewriteStyle === 'shorter') {
        const stronger = runSummaryV2({
          cv, locale: 'hi', gender: 'female', referenceDateIso: REF,
          candidate: BAD_PROVIDER, rewriteStyle: 'stronger',
        });
        expect(stronger.countedAsSuccess).toBe(true);
        cv.summary = stronger.text;
      }
      const sourceHash = cv.summary;
      const out = runSummaryV2({
        cv, locale: 'hi', gender: 'female', referenceDateIso: REF,
        candidate: BAD_PROVIDER, rewriteStyle,
      });
      expect(out.blocked).toBe(false);
      expect(out.countedAsSuccess).toBe(true);
      expect(out.text).not.toBe(sourceHash);
      expect(out.pipelineDiagnostics?.candidateTransformationKind).toBe(`v2_rewrite_${rewriteStyle}`);
      expect(out.validation.currentDutyTenseOk).toBe(true);
      expect(out.validation.priorDutyTenseOk).toBe(true);
      expect(out.validation.hindiFirstPersonAgreementPassed).toBe(true);
      expect(out.validation.finalUnitOwnership.map((unit) => unit.roleSlot)).toEqual([
        'duration', 'current_role', 'prior_role', 'prior_role',
      ]);
      expect(out.validation.factUnitOwnershipValidationPassed).toBe(true);
      expect(out.validation.unsupportedClaimCount).toBe(0);
    },
  );

  it.each([
    ['generate', 'shorter'],
    ['generate', 'professional'],
    ['stronger', 'shorter'],
    ['stronger', 'professional'],
    ['shorter', 'stronger'],
    ['professional', 'shorter'],
  ] as const)(
    'keeps immutable Hindi manifest authority through %s → %s',
    (firstStyle, secondStyle) => {
      const cv = seededCv();
      if (firstStyle !== 'generate') {
        const first = runSummaryV2({
          cv, locale: 'hi', gender: 'female', referenceDateIso: REF,
          candidate: BAD_PROVIDER, rewriteStyle: firstStyle,
        });
        expect(first.blocked, `${firstStyle}: ${first.reason || ''}`).toBe(false);
        expect(first.countedAsSuccess).toBe(true);
        cv.summary = first.text;
      }
      const before = cv.summary;
      const out = runSummaryV2({
        cv, locale: 'hi', gender: 'female', referenceDateIso: REF,
        candidate: BAD_PROVIDER, rewriteStyle: secondStyle,
      });

      expect(out.blocked, `${firstStyle} → ${secondStyle}: ${out.reason || ''}`).toBe(false);
      expect(out.countedAsSuccess).toBe(true);
      expect(out.text).not.toBe(before);
      expect(out.pipelineDiagnostics?.candidateTransformationKind).toBe(`v2_rewrite_${secondStyle}`);
      expect(out.validation.requiredCurrentFactCount).toBe(3);
      expect(out.validation.coveredCurrentFactCount).toBe(3);
      expect(out.validation.requiredPriorFactCount).toBe(6);
      expect(out.validation.coveredPriorFactCount).toBe(6);
      expect(out.validation.currentDutyTenseOk).toBe(true);
      expect(out.validation.priorDutyTenseOk).toBe(true);
      expect(out.validation.hindiFirstPersonAgreementPassed).toBe(true);
      expect(out.validation.durationExpressionCount).toBe(1);
      expect(out.validation.finalUnitOwnership.map((unit) => unit.roleSlot)).toEqual([
        'duration', 'current_role', 'prior_role', 'prior_role',
      ]);
      expect(out.validation.factUnitOwnershipValidationPassed).toBe(true);
      expect(out.validation.materialAuthority.invariantPassed).toBe(true);
      expect(out.validation.unsupportedClaimCount).toBe(0);
      expect(out.text).toMatch(/(?:विभिन्न\s+)?प्रिंट\s+(?:और|व)\s+डिजिटल\s+माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी/u);
      expect(out.text).toContain('ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी');
      expect(out.text).toContain('डिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी');
      if (secondStyle === 'shorter') {
        expect(out.text.length).toBeLessThan(before.length);
        expect(out.pipelineDiagnostics?.styleFulfillment?.shorterStyleFulfilled).toBe(true);
      }
    },
  );

  it('applies the exact Hindi Stronger → Shorter device path once with full immutable authority', () => {
    const cv = seededCv();
    const stronger = runSummaryV2({
      cv, locale: 'hi', gender: 'female', referenceDateIso: REF,
      candidate: BAD_PROVIDER, rewriteStyle: 'stronger',
    });
    expect(stronger.blocked).toBe(false);
    expect(stronger.countedAsSuccess).toBe(true);
    cv.summary = stronger.text;
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_shorter', field: 'summary', candidate: BAD_PROVIDER, cv,
      requestedLocale: 'hi', gender: 'female', referenceDateIso: REF,
      durationSnapshot: duration, rewriteStyle: 'shorter',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text.length).toBeLessThan(stronger.text.length);
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration', 'current_intro', 'prior_role', 'prior_role',
    ]);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(6);
    expect(fin.diagnostics?.totalDurationSlotPresent).toBe(true);
    expect(fin.diagnostics?.factUnitOwnershipValidationPassed).toBe(true);
    expect(getProAiUsageCount()).toBe(427);
    const applied = applyFinalizedSummaryToCv(cv, 'hi', fin);
    recordProAiUserActionSuccess();
    expect(applied.summary).toBe(fin.text);
    expect(getProAiUsageCount()).toBe(428);
  });

  it('still rejects a genuinely malformed Hindi current-duty tense after structured construction', () => {
    const cv = seededCv();
    const out = runSummaryV2({
      cv, locale: 'hi', gender: 'female', referenceDateIso: REF,
      candidate: BAD_PROVIDER, rewriteStyle: 'stronger',
    });
    const malformed = out.text.replace('करती हूँ', 'करती थीं');
    expect(malformed).not.toBe(out.text);
    const q = validateSummaryV2AgainstManifest(malformed, out.manifest, {
      candidateSource: 'deterministic', preserveConstructionOrder: true,
      trustedConstructionAuthority: true,
    });
    expect(q.ok).toBe(false);
    expect(q.hindiFirstPersonAgreementPassed).toBe(false);
    expect(q.reason).toBe('hindi_first_person_agreement_invalid');
  });

  it('rejects keyword-preserving Hindi filler and fact-relation degradation as Stronger', () => {
    const source = seededCv().summary;
    for (const degraded of [
      source.replace('काम करती हूँ', 'काम करती हूँ तथा दृश्य अवधारणाएँ, साथ ही डिजिटल सामग्री तैयार सावधानीपूर्वक करती हूँ'),
      source.replace('विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी', 'मुद्रित और डिजिटल विज़ुअल अवधारणाएँ तैयार करती थी'),
      source.replace('ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी', 'विज़ुअल डिज़ाइन अवधारणाएँ तैयार करती थी'),
      source.replace('डिज़ाइन परियोजनाओं की समीक्षा करके अंतिम आउटपुट की गुणवत्ता सुनिश्चित करती थी', 'डिजिटल सामग्री तैयार करती थी'),
    ]) {
      const quality = evaluateSummaryV2StyleFulfillment({
        style: 'stronger', sourceText: source, candidateText: degraded, locale: 'hi',
      });
      expect(quality.styleValidationPassed).toBe(false);
    }
  });

  it('rejects Hindi active-role framing as a substitute for duty strengthening', () => {
    const source = seededCv().summary;
    const roleOnly = source.replace(/काम करती हूँ/u, 'कार्यरत हूँ');
    const quality = evaluateSummaryV2StyleFulfillment({
      style: 'stronger', sourceText: source, candidateText: roleOnly, locale: 'hi',
    });
    expect(quality.styleValidationPassed).toBe(false);
    expect(quality.semanticStyleOperationsApplied).not.toContain('duty_predicate_strengthen');
  });
});
