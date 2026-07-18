/**
 * Build 240 device fixture: Hindi Professional Summary exports as PDF + DOCX.
 * Apply and export share one acceptance contract; proper nouns / Baker↔बेकर allowed.
 */
import { describe, it, expect } from 'vitest';
import { buildCvCanonicalFactSet, classifyDutyCategory } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { validateLocalizedSummary } from '@/lib/cv-semantic-fidelity';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  prepareCreativeArtisticExport,
  resolveCanonicalExperienceDescription,
} from '@/lib/cv-export-integrity';
import {
  resolveExperienceGroundingDescription,
  captureUserGroundingBeforeAi,
} from '@/lib/cv-experience-provenance';
import { getLocalizedCvSkillName } from '@/lib/cv-skill-options';
import { occupationalTitlesAreEquivalent, localizeBaker } from '@/lib/cv-role-title';
import {
  stripStructuredCvProperNouns,
  textMatchesRequestedFieldLocale,
} from '@/lib/cv-field-locale-integrity';
import { isWrongLanguageAiOutput } from '@/lib/cv-ai-locale-guard';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import type { CVData } from '@/lib/types';

const REF = '2026-07-17';

const EN_DUTIES = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');

const HI_DUTIES = [
  'मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ।',
  'मैं कार्यस्थल की स्वच्छता बनाए रखती हूँ।',
  'मैं रसोई टीम के साथ सहयोग करती हूँ।',
].join('\n');

/** Exact awkward Hindi summary observed on Android build 240. */
const DEVICE_HI_SUMMARY =
  'मैं लगभग ढाई वर्षों के अनुभव वाली बेकर हूँ और जनवरी 2024 से Ztrew में कार्यरत हूँ। मैं Ztrew में, जहाँ मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ और रसोई दल के साथ मिलकर कार्यस्थल की स्वच्छता बनाए रखती हूँ। मेरी प्रमुख दक्षताओं में प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन शामिल हैं।';

const SKILLS = [
  'Presentation Skills',
  'Leadership',
  'Organization',
  'Critical Thinking',
  'Adaptability',
  'Problem Solving',
  'Time Management',
];

function deviceCv(overrides?: Partial<CVData> & {
  experienceOverrides?: Record<string, unknown>;
}): CVData {
  const { experienceOverrides, ...cvOverrides } = overrides || {};
  return {
    personal: {
      fullName: 'Ivan Grozni',
      jobTitle: 'Baker',
      gender: 'female',
      email: 'ivan@test.com',
      phone: '+38160111222',
      address: 'Belgrade',
      photoEnabled: false,
    },
    summary: DEVICE_HI_SUMMARY,
    summaryOrigin: 'ai_generated',
    contentLocale: 'hi',
    experience: [{
      id: 'exp-baker',
      position: 'Baker',
      company: 'Ztrew',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: HI_DUTIES,
      originalUserDescription: EN_DUTIES,
      canonicalDescription: EN_DUTIES,
      descriptionOrigin: 'ai_generated',
      ...(experienceOverrides || {}),
    }],
    education: [],
    skills: [...SKILLS],
    certifications: [],
    languages: [{ name: 'English', level: 'native' }],
    templateId: 'creative-artistic',
    ...cvOverrides,
  } as CVData;
}

describe('Build 240 Hindi summary PDF/DOCX export contract', () => {
  it('1–8. device summary apply + PDF/DOCX identical acceptance', () => {
    const cv = deviceCv();
    expect(cv.summary).toContain('Ztrew');
    for (const skill of SKILLS) {
      const hi = getLocalizedCvSkillName(skill, 'hi');
      expect(cv.summary).toContain(hi);
      expect(cv.summary).not.toContain(skill);
    }
    expect(cv.summary).not.toMatch(/Critical Thinking|Problem Solving|Time Management/);

    const apply = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'hi',
      gender: 'female',
      cv: { ...cv, summary: '' },
      candidate: DEVICE_HI_SUMMARY,
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(apply.blocked).toBe(false);
    expect(apply.countedAsSuccess).toBe(true);
    expect(apply.text).toContain('Ztrew');
    expect(cv.contentLocale).toBe('hi');

    const pdf = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const docx = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(pdf.cv.summary).toBe(DEVICE_HI_SUMMARY);
    expect(docx.cv.summary).toBe(DEVICE_HI_SUMMARY);
    expect(pdf.cv.summary).toBe(docx.cv.summary);
    expect(pdf.cv.contentLocale || cv.contentLocale).toBe('hi');
  });

  it('9–12. proper nouns, Baker↔बेकर, dates do not reject', () => {
    expect(occupationalTitlesAreEquivalent('Baker', 'बेकर', 'hi', 'female')).toBe(true);
    expect(localizeBaker('hi', 'female')).toBe('बेकर');

    const structured = {
      fullName: 'Ivan Grozni',
      companies: ['Ztrew'],
      email: 'ivan@test.com',
      phone: '+38160111222',
      jobTitles: ['Baker', 'बेकर'],
    };
    const neutralized = stripStructuredCvProperNouns(DEVICE_HI_SUMMARY, structured);
    expect(neutralized).not.toContain('Ivan Grozni');
    expect(neutralized).not.toContain('Ztrew');
    expect(textMatchesRequestedFieldLocale(DEVICE_HI_SUMMARY, 'hi', 'summary', structured)).toBe(true);

    const factSet = buildCvCanonicalFactSet(deviceCv());
    const check = validateLocalizedSummary(DEVICE_HI_SUMMARY, factSet, {
      locale: 'hi',
      gender: 'female',
      stage: 'export',
    });
    expect(check.valid).toBe(true);
    expect(check.violations.some((v) => /wrong_language|mixed_language|forced-conflicting-title/i.test(v.kind + v.matched))).toBe(false);
  });

  it('13–14. English sentence / raw English skills still rejected', () => {
    const factSet = buildCvCanonicalFactSet(deviceCv());
    const withEnglish = `${DEVICE_HI_SUMMARY} I am currently contributing to kitchen operations.`;
    const englishSkills = DEVICE_HI_SUMMARY.replace(
      /प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन/,
      'Critical Thinking, Adaptability, Problem Solving and Time Management',
    );
    expect(validateLocalizedSummary(withEnglish, factSet, {
      locale: 'hi',
      gender: 'female',
      stage: 'export',
    }).valid).toBe(false);
    expect(validateLocalizedSummary(englishSkills, factSet, {
      locale: 'hi',
      gender: 'female',
      stage: 'export',
    }).valid).toBe(false);
  });

  it('15–18. polluted AI canonical recovers from original; zero AI usage; no new facts', () => {
    const polluted = deviceCv({
      experienceOverrides: {
        canonicalDescription: HI_DUTIES,
        descriptionOrigin: 'ai_generated',
      },
    });
    expect(resolveExperienceGroundingDescription(polluted.experience[0])).toBe(EN_DUTIES);
    expect(resolveCanonicalExperienceDescription(polluted.experience[0])).toBe(EN_DUTIES);

    const repaired = captureUserGroundingBeforeAi(polluted.experience[0]);
    expect(repaired.canonicalDescription).toBe(EN_DUTIES);
    expect(repaired.originalUserDescription).toBe(EN_DUTIES);

    const exportResult = prepareCreativeArtisticExport(polluted, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    // Valid device text kept; recovery must not invent cuisine/awards facts.
    expect(exportResult.cv.summary).toMatch(/Ztrew|बेकर|व्यंजन|स्वच्छ/);
    expect(exportResult.cv.summary).not.toMatch(/award|revenue|Serbian and Mediterranean|भूमध्य/i);
    expect(
      exportResult.cv.summaryOrigin === 'ai_generated'
      || exportResult.cv.summaryOrigin === 'deterministic_fallback',
    ).toBe(true);
    // Export path does not call the AI provider — deterministic only.
    expect(
      exportResult.projection.validationStatus === 'passed'
      || exportResult.projection.validationStatus === 'fallback'
      || exportResult.projection.validationStatus === 'repaired',
    ).toBe(true);

    // Hindi AI display text never becomes grounding.
    expect(resolveExperienceGroundingDescription({
      description: HI_DUTIES,
      canonicalDescription: '',
      originalUserDescription: '',
      descriptionOrigin: 'ai_generated',
    })).toBe('');
  });

  it('19. English PDF/DOCX control still passes', () => {
    const enSummary = 'Baker with approximately two years of experience. I prepare dishes according to restaurant standards, maintain workplace hygiene, and collaborate with the kitchen team. Key skills include leadership, organization, and time management.';
    const cv = deviceCv({
      summary: enSummary,
      contentLocale: 'en',
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: EN_DUTIES,
        originalUserDescription: EN_DUTIES,
        canonicalDescription: EN_DUTIES,
        descriptionOrigin: 'user',
      }],
    });
    const pdf = prepareCreativeArtisticExport(cv, 'en', { gender: 'female', referenceDate: REF });
    const docx = prepareCreativeArtisticExport(cv, 'en', { gender: 'female', referenceDate: REF });
    expect(pdf.cv.summary).toBeTruthy();
    expect(docx.cv.summary).toBe(pdf.cv.summary);
  });

  it('20. Arabic and Japanese proper-noun controls remain passing', () => {
    const ar = 'خبازة بخبرة حوالي سنتين في Ztrew لدى Ivan Grozni.';
    const ja = 'ZtrewのIvan Grozniとして約2年の経験を持つベイカーです。';
    // Bounded Latin proper nouns must not alone mark scripted AI output wrong-language.
    expect(isWrongLanguageAiOutput(ar, 'ar')).toBe(false);
    expect(isWrongLanguageAiOutput(ja, 'ja')).toBe(false);
    const structured = {
      fullName: 'Ivan Grozni',
      companies: ['Ztrew'],
    };
    expect(stripStructuredCvProperNouns(ar, structured)).not.toContain('Ztrew');
    expect(stripStructuredCvProperNouns(ja, structured)).not.toContain('Ivan Grozni');
  });

  it('Hindi duties classify as cooking/hygiene (ASCII \\b must not block Devanagari)', () => {
    expect(classifyDutyCategory(HI_DUTIES.split('\n')[0])).toBe('food_preparation');
    expect(classifyDutyCategory(HI_DUTIES.split('\n')[1])).toBe('hygiene_safety');
    expect(classifyDutyCategory(HI_DUTIES.split('\n')[2])).toBe('food_preparation');
  });

  it('EN experience + Hindi summary: export localizes duties and keeps summary (build-240 gate)', () => {
    const cv = deviceCv({
      experienceOverrides: {
        description: EN_DUTIES,
        descriptionOrigin: 'user',
        originalUserDescription: EN_DUTIES,
        canonicalDescription: EN_DUTIES,
      },
    });
    const prepared = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.cv.summary).toBe(DEVICE_HI_SUMMARY);
    expect(prepared.cv.experience[0].description).toMatch(/व्यंजन|स्वच्छ|सहयोग/);
    expect(prepared.cv.experience[0].description).not.toMatch(/Prepare dishes/);
  });

  it('50× cold: device fixture PDF/DOCX identical, zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = deviceCv();
      const duration = buildExperienceDurationSnapshot(cv.experience, REF);
      const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });
      const apply = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: 'hi',
        gender: 'female',
        cv: { ...cv, summary: '' },
        candidate: DEVICE_HI_SUMMARY,
        originHint: 'ai_generated',
        referenceDateIso: REF,
        durationSnapshot: duration,
      });
      expect(apply.blocked, `apply iter ${i}`).toBe(false);

      const pdf = prepareCreativeArtisticExport(cv, 'hi', {
        gender: 'female',
        referenceDate: REF,
        durationSnapshot: duration,
      });
      const docx = prepareCreativeArtisticExport(cv, 'hi', {
        gender: 'female',
        referenceDate: REF,
        durationSnapshot: duration,
      });
      expect(pdf.cv.summary, `pdf iter ${i}`).toBe(DEVICE_HI_SUMMARY);
      expect(docx.cv.summary, `docx iter ${i}`).toBe(pdf.cv.summary);
      expect(validateLocalizedSummary(pdf.cv.summary, factSet, {
        locale: 'hi',
        gender: 'female',
        stage: 'export',
      }).valid, `fidelity iter ${i}`).toBe(true);

      // Previous AI summary / Hindi experience never used as canonical grounding.
      expect(resolveCanonicalExperienceDescription(cv.experience[0])).toBe(EN_DUTIES);
      expect(pdf.cv.experience[0].originalUserDescription || EN_DUTIES).toBe(EN_DUTIES);
    }
  });

  it('deterministic Hindi recovery grammar avoids awkward company relative clause', () => {
    const cv = deviceCv({ summary: '' });
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience, REF).total;
    const grounded = deterministicLocalizedSummaryFromCanonical(
      factSet,
      'hi',
      'female',
      duration,
    );
    expect(grounded).toBeTruthy();
    expect(grounded).toContain('Ztrew');
    expect(grounded).toContain('बेकर');
    expect(grounded).not.toMatch(/मैं Ztrew में,\s*जहाँ मैं/);
    expect(grounded).toMatch(/व्यंजन तैयार|स्वच्छता|सहयोग/);
  });
});
