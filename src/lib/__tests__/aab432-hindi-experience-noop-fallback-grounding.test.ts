import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import { classifyDutyCategory, formatExperienceBullets } from '../cv-canonical-facts';
import { runCvAiApplyPipeline } from '../cv-ai-finalize-apply';
import { fingerprintText } from '../cv-export-diagnostics';
import { normalizeExperienceAiSourceText } from '../cv-experience-ai-operation-snapshot';
import {
  buildExperienceAiNoOpStylisticFallback,
  experienceAiNoOpFallbackIsSafe,
} from '../cv-experience-ai-noop-recovery';
import {
  detectExperienceUnsupportedClaimExpansion,
  experienceUnsupportedClaimRejectionReason,
} from '../cv-experience-unsupported-claims';

const SOURCE = formatExperienceBullets([
  'प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री बनाती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ बनाती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम आउटपुट की गुणवत्ता जाँचती थी।',
]);

const DAILY_FILLER = formatExperienceBullets([
  'प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री बनाती थी दैनिक भूमिका के अंतर्गत।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ बनाती थी दैनिक भूमिका के अंतर्गत।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम आउटपुट की गुणवत्ता जाँचती थी दैनिक भूमिका के अंतर्गत।',
]);

const EXACT_BE5C_SOURCE = formatExperienceBullets([
  'प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री बनाती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ बनाती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम आउटपुट की गुणवत्ता जाँचती थी।',
]);

function exactBe5cCv(): CVData {
  const cv: CVData = {
    id: 'aab432-device',
    name: 'AAB432 device fixture',
    personal: {
      fullName: 'Test User', email: 'test@example.com', phone: '', address: '',
      jobTitle: 'ग्राफिक डिज़ाइनर', gender: 'female',
    },
    summary: '',
    experience: [{
      id: 'be5c794b', position: 'ग्राफिक डिज़ाइनर', company: 'TestWerk GmbH',
      startDate: '2024-01', endDate: '2026-02', isPresent: false,
      description: EXACT_BE5C_SOURCE, originalUserDescription: EXACT_BE5C_SOURCE,
      canonicalDescription: EXACT_BE5C_SOURCE, descriptionOrigin: 'user',
    }],
    education: [], skills: [], languages: [], certifications: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
  return cv;
}

function normalizedSourceHash(text: string): string {
  return fingerprintText(normalizeExperienceAiSourceText(text));
}

describe('AAB432 Hindi Experience no-op fallback grounding', () => {
  it('classifies generic Hindi preparation contextually', () => {
    expect(classifyDutyCategory('ग्राफिक सामग्री तैयार करती थी।')).toBe('generic');
    expect(classifyDutyCategory('दस्तावेज़ तैयार किए।')).toBe('generic');
    expect(classifyDutyCategory('रिपोर्ट तैयार की।')).toBe('generic');
    expect(classifyDutyCategory('भोजन तैयार किया।')).toBe('food_preparation');
    expect(classifyDutyCategory('खाना तैयार किया।')).toBe('food_preparation');
    expect(classifyDutyCategory('व्यंजन तैयार किए।')).toBe('food_preparation');
  });
  it('rejects the exact repeated daily-role fallback before apply or usage', () => {
    const scan = detectExperienceUnsupportedClaimExpansion(SOURCE, DAILY_FILLER);
    expect(scan.kinds).toEqual(expect.arrayContaining([
      'frequency_scope_claim',
      'repeated_generic_enrichment',
    ]));
    expect(scan.scopeExpansionDetected).toBe(true);
    expect(experienceUnsupportedClaimRejectionReason(scan))
      .toBe('unsupported_frequency_scope_claim');
    expect(experienceAiNoOpFallbackIsSafe({
      sourceDescription: SOURCE,
      candidate: DAILY_FILLER,
    })).toBe(false);
  });

  it.each([
    'दैनिक', 'प्रतिदिन', 'साप्ताहिक', 'नियमित रूप से', 'हर दिन',
  ])('rejects unsupported Hindi frequency scope %s for arbitrary duties', (frequency) => {
    const candidate = `• पुस्तकालय सामग्री व्यवस्थित करती थी ${frequency}।`;
    const scan = detectExperienceUnsupportedClaimExpansion(
      '• पुस्तकालय सामग्री व्यवस्थित करती थी।',
      candidate,
    );
    expect(scan.kinds).toContain('frequency_scope_claim');
  });

  it('allows a source-authorized frequency claim without false rejection', () => {
    const source = '• पुस्तकालय सामग्री नियमित रूप से व्यवस्थित करती थी।';
    const candidate = '• पुस्तकालय सामग्री नियमित रूप से व्यवस्थित करती थी और सूची अपडेट करती थी।';
    const scan = detectExperienceUnsupportedClaimExpansion(source, candidate);
    expect(scan.kinds).not.toContain('frequency_scope_claim');
  });

  it('distinguishes semantic repeated filler from legitimate grammatical repetition', () => {
    const grammatical = formatExperienceBullets([
      'सामग्री तैयार करती थी।', 'अवधारणाएँ विकसित करती थी।', 'परियोजनाओं की समीक्षा करती थी।',
    ]);
    expect(detectExperienceUnsupportedClaimExpansion(SOURCE, grammatical).kinds)
      .not.toContain('repeated_generic_enrichment');
    const authorizedSource = formatExperienceBullets([
      'दैनिक सामग्री तैयार करती थी।', 'दैनिक अवधारणाएँ विकसित करती थी।', 'दैनिक परियोजनाओं की समीक्षा करती थी।',
    ]);
    expect(detectExperienceUnsupportedClaimExpansion(authorizedSource, authorizedSource).kinds)
      .not.toContain('repeated_generic_enrichment');
  });

  it('does not manufacture a Hindi role/frequency suffix when no safe improvement exists', () => {
    const fallback = buildExperienceAiNoOpStylisticFallback({
      sourceDescription: SOURCE,
      locale: 'hi',
      isPresent: false,
      gender: 'female',
    });
    expect(fallback).toBe('');
  });

  it('accepts a native source-equivalent verb-only improvement without frequency filler', () => {
    const safe = formatExperienceBullets([
      'प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।',
      'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
      'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम आउटपुट की गुणवत्ता जाँचती थी।',
    ]);
    const scan = detectExperienceUnsupportedClaimExpansion(SOURCE, safe);
    expect(scan.count).toBe(0);
    expect(experienceAiNoOpFallbackIsSafe({ sourceDescription: SOURCE, candidate: safe })).toBe(true);
  });

  it('runs the exact completed be5c provider-no-op -> repair-no-op terminal path', () => {
    const cv = exactBe5cCv();
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'experience_bullets',
      candidate: EXACT_BE5C_SOURCE,
      experienceId: 'be5c794b',
      industry: 'design',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    const d = recovered.finalized.diagnostics || {};
    const expectedHash = normalizedSourceHash(EXACT_BE5C_SOURCE);
    expect(d.visibleComparisonNormalizedHash).toBe(expectedHash);
    expect(d.finalNormalizedHash).toBeNull();
    expect(d.finalMatchesSourceAfterNormalization).toBe(true);
    expect(normalizedSourceHash(recovered.finalized.text)).toBe(expectedHash);
    expect(recovered.stateCv.experience[0].description).toBe(EXACT_BE5C_SOURCE);
    expect(recovered.stateCv.experience[0].canonicalDescription).toBe(EXACT_BE5C_SOURCE);
    expect(recovered.stateCv.experience[0].generatedDescription).not.toBe(EXACT_BE5C_SOURCE);
    expect(recovered.finalized.text).not.toContain('दैनिक भूमिका के अंतर्गत');
    expect(d.providerNoOpDetected).toBe(true);
    expect(d.selectedExperienceEntryIdHash).toBeTruthy();
    expect(d.selectedExperienceEntryIdHash).toBe(d.sourceFactsEntryIdHash);
    expect(d.finalUnsupportedClaimCount || 0).toBe(0);
    expect(recovered.finalized.text).toBe(EXACT_BE5C_SOURCE);
    expect(d.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(d.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(d.shouldIncrementUsage).toBe(false);
    expect(recovered.finalized.countedAsSuccess).toBe(false);
    expect(d.finalDecisionKind).toMatch(/semantic_noop|invalid_candidate_rejected|none/);
  });

  it('keeps terminal usage truth for valid improvement and invalid candidate', () => {
    const cv = exactBe5cCv();
    const valid = runCvAiApplyPipeline({
      cv,
      locale: 'hi', action: 'experience_bullets', candidate: formatExperienceBullets([
        'विभिन्न प्रिंट और डिजिटल माध्यमों के लिए ग्राफिक सामग्री तैयार करती थी।',
        'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
        'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम आउटपुट की गुणवत्ता जाँचती थी।',
      ]),
      experienceId: 'be5c794b', industry: 'design', level: 'mid',
      noOpRepairAttempted: true, originHint: 'ai_repaired',
    });
    expect(valid.finalized.countedAsSuccess).toBe(true);
    expect(valid.finalized.diagnostics?.canonicalExperienceDecisionAllowsUsage).toBe(true);
    expect(valid.finalized.diagnostics?.shouldIncrementUsage).toBe(true);

    const invalid = runCvAiApplyPipeline({
      cv,
      locale: 'hi', action: 'experience_bullets', candidate: DAILY_FILLER,
      experienceId: 'be5c794b', industry: 'design', level: 'mid',
      noOpRepairAttempted: true, originHint: 'ai_repaired',
    });
    expect(invalid.finalized.countedAsSuccess).toBe(false);
    expect(invalid.finalized.diagnostics?.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(invalid.finalized.diagnostics?.shouldIncrementUsage).toBe(false);
  });
});
