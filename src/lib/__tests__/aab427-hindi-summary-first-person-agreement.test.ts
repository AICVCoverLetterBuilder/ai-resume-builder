import { describe, expect, it } from 'vitest';
import {
  analyzeHindiSummaryFirstPersonAgreement,
  evaluateNativeRealizationContract,
  realizeFirstPersonDutyClause,
} from '../cv-summary-v2/native-surface';
import { buildSummaryV2DeterministicText } from '../cv-summary-v2/builder';
import type { SummaryV2SelectionManifest } from '../cv-summary-v2/types';

function manifest(gender: 'female' | 'male' | 'unspecified' = 'female') {
  return {
    locale: 'hi',
    gender,
    durationPhrase: 'लगभग दो वर्षों का अनुभव',
    totalDurationMonths: 24,
    snapshotHash: 'aab427-manifest',
    current: {
      entryId: 'current', role: 'डिज़ाइनर', employer: 'Rewitu', employmentState: 'present',
    },
    priors: [{
      entryId: 'prior', role: 'सहायक डिज़ाइनर', employer: 'Studio', employmentState: 'completed',
    }],
    requiredCurrentFacts: [{ entryId: 'current', factId: 'current-1', bulletText: 'दृश्य सामग्री तैयार करती हूँ।', tokenStems: ['दृश्य', 'सामग्री'] }],
    requiredPriorFacts: [{ entryId: 'prior', factId: 'prior-1', bulletText: 'दृश्य सामग्री बनाई।', tokenStems: ['दृश्य', 'सामग्री'] }],
  } as unknown as SummaryV2SelectionManifest;
}

describe('AAB-427 Hindi Summary first-person agreement', () => {
  it('accepts female, male, neutral, and ergative-perfective first-person clauses without duty vocabulary allowlists', () => {
    const female = 'मैं वर्तमान में Rewitu में डिज़ाइनर के रूप में काम करती हूँ तथा सामग्री संपादित करती हूँ। इससे पहले मैं Studio में सहायक के रूप में काम करती थी तथा डिज़ाइन की समीक्षा करती थी।';
    const male = female.replaceAll('करती', 'करता').replaceAll('थी', 'था');
    const neutral = female;
    const perfective = 'इससे पहले मैंने Rewitu में डिज़ाइनर के रूप में काम किया तथा सामग्री बनाई, संपादित किया और प्रकाशित किया।';

    expect(analyzeHindiSummaryFirstPersonAgreement({ text: female, gender: 'female' }).every((r) => r.grammarPassed)).toBe(true);
    expect(analyzeHindiSummaryFirstPersonAgreement({ text: male, gender: 'male' }).every((r) => r.grammarPassed)).toBe(true);
    expect(analyzeHindiSummaryFirstPersonAgreement({ text: neutral, gender: 'unspecified' }).every((r) => r.grammarPassed)).toBe(true);
    expect(analyzeHindiSummaryFirstPersonAgreement({ text: perfective, gender: 'female' }).every((r) => r.grammarPassed)).toBe(true);
  });

  it('realizes every coordinated current/prior habitual from arbitrary localized source predicates', () => {
    expect(realizeFirstPersonDutyClause(
      'सामग्री तैयार करती हैं तथा चित्र संपादित करती हैं और टीम के साथ समन्वय करती हैं।',
      'hi',
      'present',
      'female',
    )).toBe('सामग्री तैयार करती हूँ तथा चित्र संपादित करती हूँ और टीम के साथ समन्वय करती हूँ');
    expect(realizeFirstPersonDutyClause(
      'सामग्री तैयार करती थीं तथा चित्र संपादित करती थीं और टीम के साथ समन्वय करती थीं।',
      'hi',
      'completed',
      'female',
    )).toBe('सामग्री तैयार करती थी तथा चित्र संपादित करती थी और टीम के साथ समन्वय करती थी');
  });

  it('rejects honorific/third-person auxiliaries, gender mismatch, and mixed bare perfectives per clause', () => {
    const malformed = 'मैं वर्तमान में Rewitu में डिज़ाइनर के रूप में काम करती हैं तथा सामग्री संपादित करती हैं। इससे पहले मैं Studio में सहायक के रूप में काम करती थीं तथा सामग्री तैयार किए, समीक्षा किया।';
    const contract = evaluateNativeRealizationContract({
      text: malformed,
      locale: 'hi',
      perspectiveMode: 'first_person',
      gender: 'female',
    });
    const reasons = contract.hindiSentenceAgreementRecords.flatMap((r) => r.grammarReasons);

    expect(contract.hindiFirstPersonAgreementPassed).toBe(false);
    expect(contract.localeVerbMorphologyPassed).toBe(false);
    expect(reasons).toContain('hindi_first_person_present_auxiliary_invalid');
    expect(reasons).toContain('hindi_first_person_completed_auxiliary_invalid');
    expect(reasons).toContain('hindi_first_person_perfective_ergative_missing');
    expect(reasons).toContain('hindi_first_person_mixed_aspect_coordination');
  });

  it('builds completed perfective fallback in an ergative frame and rejects the same malformed provider candidate', () => {
    const sourceManifest = manifest('female');
    const fallback = buildSummaryV2DeterministicText(sourceManifest);
    const fallbackContract = evaluateNativeRealizationContract({
      text: fallback,
      locale: 'hi',
      perspectiveMode: 'first_person',
      gender: 'female',
    });
    const malformedProvider = fallback.replaceAll('हूँ', 'हैं').replaceAll('थी', 'थीं');
    const malformedProviderContract = evaluateNativeRealizationContract({
      text: malformedProvider,
      locale: 'hi',
      perspectiveMode: 'first_person',
      gender: 'female',
    });

    expect(fallback).toContain('इससे पहले मैंने');
    expect(fallbackContract.hindiFirstPersonAgreementPassed).toBe(true);
    expect(malformedProviderContract.hindiFirstPersonAgreementPassed).toBe(false);
  });
});
