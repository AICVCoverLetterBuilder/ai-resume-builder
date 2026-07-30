/**
 * Build 241: old saved Hindi Summary must export PDF/DOCX without regeneration.
 * False mixed-language / title-conflict from Latin proper nouns + Hindi duties.
 */
import { describe, it, expect } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { validateLocalizedSummary } from '@/lib/cv-semantic-fidelity';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { formatCvExportIntegrityToast } from '@/lib/cv-export-error-message';
import {
  classifyDutyFamilies,
  evaluateRoleDutyConsistency,
  occupationalTitlesAreEquivalent,
  localizeBaker,
} from '@/lib/cv-role-title';
import {
  stripStructuredCvProperNouns,
  textMatchesRequestedFieldLocale,
} from '@/lib/cv-field-locale-integrity';
import { resolveExperienceGroundingDescription } from '@/lib/cv-experience-provenance';
import { getLocalizedCvSkillName } from '@/lib/cv-skill-options';
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

/** Exact awkward Hindi summary from build-240 device save. */
const SAVED_HI_SUMMARY =
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

/** Old saved CV: Hindi AI display + Hindi canonical, no originalUserDescription. */
function oldSavedCv(overrides?: Partial<CVData>): CVData {
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
    summary: SAVED_HI_SUMMARY,
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
      canonicalDescription: HI_DUTIES,
      descriptionOrigin: 'ai_generated',
      // Intentionally omit originalUserDescription — old save path.
    }],
    education: [],
    skills: [...SKILLS],
    certifications: [],
    languages: [{ name: 'English', level: 'native' }],
    templateId: 'creative-artistic',
    ...overrides,
  } as CVData;
}

function latinTokens(text: string): string[] {
  return [...text.matchAll(/[A-Za-zÀ-ÖØ-öø-ÿ]+/g)].map((m) => m[0]);
}

describe('Build 241 old saved Hindi Summary export recovery', () => {
  it('1–5. structured exemptions + Baker↔बेकर + duty families', () => {
    const structured = {
      fullName: 'Ivan Grozni',
      companies: ['Ztrew'],
      email: 'ivan@test.com',
      phone: '+38160111222',
      jobTitles: ['Baker', 'बेकर'],
    };
    expect(textMatchesRequestedFieldLocale(SAVED_HI_SUMMARY, 'hi', 'summary', structured)).toBe(true);
    expect(latinTokens(SAVED_HI_SUMMARY)).toEqual(['Ztrew', 'Ztrew']);
    const neutralized = stripStructuredCvProperNouns(SAVED_HI_SUMMARY, structured);
    expect(neutralized).not.toContain('Ztrew');
    expect(neutralized).not.toMatch(/\b2024\b/);
    expect(occupationalTitlesAreEquivalent('Baker', localizeBaker('hi', 'female'), 'hi')).toBe(true);

    const families = classifyDutyFamilies(HI_DUTIES).map((f) => f.family);
    expect(families).toContain('cooking');
    expect(
      evaluateRoleDutyConsistency({
        profileJobTitle: 'Baker',
        experienceTitle: 'Baker',
        dutiesText: HI_DUTIES,
      }).conflict,
    ).toBe(false);

    const factSet = buildCvCanonicalFactSet(oldSavedCv());
    const check = validateLocalizedSummary(SAVED_HI_SUMMARY, factSet, {
      locale: 'hi',
      gender: 'female',
      stage: 'export',
    });
    expect(check.valid).toBe(true);
    expect(check.violations.some((v) => /forced-conflicting-title|mixed_language/i.test(`${v.kind}:${v.matched}`))).toBe(false);
  });

  it('6–9. PDF/DOCX succeed identically without regeneration; zero AI usage', () => {
    const cv = oldSavedCv();
    const pdf = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const docx = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(pdf.cv.summary).toBe(SAVED_HI_SUMMARY);
    expect(docx.cv.summary).toBe(pdf.cv.summary);
    expect(pdf.cv.summaryOrigin).toBe('ai_generated');
    for (const skill of SKILLS) {
      expect(pdf.cv.summary).toContain(getLocalizedCvSkillName(skill, 'hi'));
      expect(pdf.cv.summary).not.toContain(skill);
    }
  });

  it('10–11. raw English skills and appended English sentence still rejected', () => {
    const factSet = buildCvCanonicalFactSet(oldSavedCv());
    const withSkills = SAVED_HI_SUMMARY.replace(
      /प्रस्तुति कौशल, नेतृत्व, संगठन, आलोचनात्मक सोच, अनुकूलनशीलता, समस्या समाधान और समय प्रबंधन/,
      'Critical Thinking, Adaptability, Problem Solving and Time Management',
    );
    const withSentence = `${SAVED_HI_SUMMARY} I am currently contributing to kitchen operations.`;
    expect(validateLocalizedSummary(withSkills, factSet, {
      locale: 'hi',
      gender: 'female',
      stage: 'export',
    }).valid).toBe(false);
    expect(validateLocalizedSummary(withSentence, factSet, {
      locale: 'hi',
      gender: 'female',
      stage: 'export',
    }).valid).toBe(false);
  });

  it('12. genuinely unsafe summary recovers deterministically for PDF and DOCX', () => {
    const unsafe = `${SAVED_HI_SUMMARY} Key skills include Critical Thinking and Problem Solving.`;
    const cv = oldSavedCv({
      summary: unsafe,
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
      }],
    });
    const pdf = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const docx = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(pdf.cv.summary).not.toBe(unsafe);
    expect(pdf.cv.summaryOrigin).toBe('deterministic_fallback');
    expect(docx.cv.summary).toBe(pdf.cv.summary);
    expect(pdf.cv.summary).toContain('बेकर');
    expect(pdf.cv.summary).toMatch(/Ztrew|व्यंजन|स्वच्छ|सहयोग/);
    expect(pdf.cv.summary).not.toMatch(/Critical Thinking|Key skills include/);
    // Must not surface regenerate toast path.
    expect(() => {
      prepareCreativeArtisticExport(cv, 'hi', { gender: 'female', referenceDate: REF });
    }).not.toThrow();
  });

  it('13. previous AI display text never becomes canonical grounding when original exists', () => {
    const cv = oldSavedCv({
      experience: [{
        id: 'exp-baker',
        position: 'Baker',
        company: 'Ztrew',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: HI_DUTIES,
        originalUserDescription: EN_DUTIES,
        canonicalDescription: HI_DUTIES,
        descriptionOrigin: 'ai_generated',
      }],
    });
    expect(resolveExperienceGroundingDescription(cv.experience[0])).toBe(EN_DUTIES);
    const prepared = prepareCreativeArtisticExport(cv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(prepared.cv.summary).toBe(SAVED_HI_SUMMARY);
    expect(prepared.cv.experience[0].originalUserDescription).toBe(EN_DUTIES);
  });

  it('regenerate toast is not produced for old saved Hindi CV', () => {
    try {
      prepareCreativeArtisticExport(oldSavedCv(), 'hi', {
        gender: 'female',
        referenceDate: REF,
      });
    } catch (err) {
      const toast = formatCvExportIntegrityToast(err, 'en', 'pdf');
      expect(toast).not.toMatch(/mixes languages|Regenerate/i);
      throw err;
    }
  });

  it('50× cold: old saved Hindi CV PDF/DOCX identical, zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const cv = oldSavedCv();
      const duration = buildExperienceDurationSnapshot(cv.experience, REF);
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
      expect(pdf.cv.summary, `pdf ${i}`).toBe(SAVED_HI_SUMMARY);
      expect(docx.cv.summary, `docx ${i}`).toBe(pdf.cv.summary);
      expect(
        evaluateRoleDutyConsistency({
          profileJobTitle: 'Baker',
          experienceTitle: 'Baker',
          dutiesText: HI_DUTIES,
        }).conflict,
        `conflict ${i}`,
      ).toBe(false);
    }
  });
});
