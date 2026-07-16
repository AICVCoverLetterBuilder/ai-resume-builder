import { describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { sealCanonicalFromValidatedSource } from '@/lib/cv-canonical-snapshot';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import {
  finalizeClientAiSummary,
} from '@/lib/cv-summary-integrity';
import {
  isValidOccupationalTitle,
  resolveOccupationalTitleForSummary,
} from '@/lib/cv-role-title';
import { deduplicateSkillsForExport } from '@/lib/cv-skills-projection';
import {
  validateLocalizedSummary,
  validateSummaryCompleteness,
} from '@/lib/cv-semantic-fidelity';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';

const REF = '2026-07-15';

const PRODUCTION_BULLETS = [
  'Development and implementation of internal processes',
  'Collaboration with cross-functional teams on project execution',
  'Business-data analysis and reporting for senior management',
  'Planning and coordination of departmental activities',
].map((b) => `• ${b}`).join('\n');

function productionOperatorCv(overrides?: Partial<CVData>): CVData {
  const cv: CVData = {
    id: 'prod-op-1',
    name: 'Operator',
    personal: {
      fullName: 'Test Operator',
      email: 'op@example.com',
      phone: '+381',
      address: 'Belgrade',
      jobTitle: 'OPERATER U PROIZVODNJI',
      gender: 'female',
    },
    summary: 'Production operator with experience in processes and reporting.',
    experience: [
      {
        id: 'exp-hilux',
        company: 'Hilux',
        position: 'V',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: PRODUCTION_BULLETS,
        canonicalDescription: PRODUCTION_BULLETS,
      },
    ],
    education: [],
    skills: ['Upravljanje projektima', 'Project Management', 'Communication'],
    certifications: [],
    languages: [
      { name: 'English', level: 'Napredni' },
      { name: 'Dutch', level: 'Tečan' },
    ],
    templateId: 'creative-artistic',
    region: 'Balkan',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
  return sealCanonicalFromValidatedSource(cv, {
    locale: 'en',
    createdFrom: 'user_structured_input',
    revise: false,
  });
}

describe('Stronger AI production-operator integrity', () => {
  const cv = productionOperatorCv();
  const durationSnapshot = buildExperienceDurationSnapshot(cv.experience, REF);

  it('rejects Serbian summary truncated at kvalitet i trajno', () => {
    const truncated =
      'Kontinuirano unapređuje svoje kompetencije i teži da doprinese organizacijama koje cene efikasnost, kvalitet i trajno';
    expect(validateSummaryCompleteness(truncated, { locale: 'sr' }).valid).toBe(false);
    const finalized = finalizeClientAiSummary(truncated, cv, 'sr', durationSnapshot);
    expect(finalized.blocked).toBe(false);
    expect(finalized.summary).not.toMatch(/kvalitet i trajno\s*$/i);
    expect(finalized.summary).toMatch(/[.!?]\s*$/);
  });

  it('Serbian export: complete summary, grounded bullets, no fluff', () => {
    const badSummary =
      'Operaterka u proizvodnji sa oko četiri godine iskustva. Doprinela stabilnijem funkcionisanju organizacije u celini i produktivnoj saradnji sa partnerima iz različitih zemalja.';
    const srCv = {
      ...cv,
      summary: badSummary,
      summaryOrigin: 'ai_generated' as const,
    };
    const q = applyCvContentQuality(srCv, 'sr', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'ai_generated',
    });
    expect(q.cv.summary).not.toMatch(/stabilnijem funkcionisanju/i);
    expect(q.cv.summary).not.toMatch(/partnerima iz različitih zemalja/i);
    expect(q.cv.summary).toMatch(/[.!?]\s*$/);
    const bullets = q.cv.experience[0].description || '';
    expect(bullets).toMatch(/Radim/i);
    expect(bullets).toMatch(/Sarađujem/i);
    expect(bullets).toMatch(/Analiziram/i);
    expect(bullets).toMatch(/Učestvujem/i);
    expect(bullets).not.toMatch(/Radila sam/i);
  });

  it('Hindi export: resolved role, no V placeholder, no generic template, no inventory', () => {
    const badSummary =
      'मैं लगभग चार वर्षों के अनुभव वाली V हूँ। पेशेवर के पास प्रासंगिक अनुभव है। स्टॉक स्तरों का प्रबंधन और इन्वेंटरी गणना में सहायता।';
    const hiCv = {
      ...cv,
      summary: badSummary,
      summaryOrigin: 'ai_generated' as const,
    };
    const q = applyCvContentQuality(hiCv, 'hi', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'ai_generated',
    });
    expect(q.cv.summary).not.toMatch(/\bV\b/u);
    expect(q.cv.summary).not.toMatch(/पेशेवर के पास प्रासंगिक अनुभव है/u);
    expect(q.cv.summary).not.toMatch(/स्टॉक|इन्वेंटरी|आपूर्ति/u);
    expect(q.cv.summary).toMatch(/उत्पादन ऑपरेटर/u);
    expect(q.cv.summary).toMatch(/[।.!?]\s*$/u);
    const bullets = q.cv.experience[0].description || '';
    expect(bullets).toMatch(/कर रही हूँ/u);
    expect(bullets).not.toMatch(/करती थी/u);
  });

  it('Hindi language levels are localized, not Serbian', () => {
    const q = applyCvContentQuality(cv, 'hi', {
      referenceDate: REF,
      gender: 'female',
      summaryOrigin: 'ai_generated',
    });
    const levels = (q.cv.languages || []).map((l) => l.level).join(' ');
    expect(levels).toMatch(/उन्नत/u);
    expect(levels).toMatch(/धाराप्रवाह/u);
    expect(levels).not.toMatch(/Napredni|Tečan/);
  });

  it('deduplicates project management skill once in export projection', () => {
    const q = applyCvContentQuality(cv, 'hi', { referenceDate: REF, gender: 'female' });
    const skills = q.cv.skills || [];
    const pmCount = skills.filter((s) => /परियोजना प्रबंधन|project management/i.test(s)).length;
    expect(pmCount).toBe(1);
    expect(deduplicateSkillsForExport(cv.skills, 'hi').length).toBe(2);
  });

  it('PDF and DOCX receive identical validated content', () => {
    const hiCv = {
      ...cv,
      summary: 'मैं लगभग चार वर्षों के अनुभव वाली V हूँ।',
      summaryOrigin: 'ai_generated' as const,
    };
    const pdf = prepareCreativeArtisticExport(hiCv, 'hi', { gender: 'female', referenceDate: REF });
    const docx = prepareCreativeArtisticExport(hiCv, 'hi', { gender: 'female', referenceDate: REF });
    expect(pdf.cv.summary).toBe(docx.cv.summary);
    expect(pdf.cv.skills).toEqual(docx.cv.skills);
    expect(pdf.cv.languages).toEqual(docx.cv.languages);
    expect(pdf.cv.experience[0].description).toBe(docx.cv.experience[0].description);
  });

  it('stale bartender inventory facts do not survive canonical revision switch', () => {
    const bartenderBullets = [
      'Prepared and served cocktails and beverages',
      'Managed stock levels and inventory counts',
    ].map((b) => `• ${b}`).join('\n');
    let stale = productionOperatorCv({
      summary: 'Bartender with inventory experience.',
      experience: [
        {
          id: 'exp-bar',
          company: 'Bar Co',
          position: 'Bartender',
          startDate: '2018-01',
          endDate: '2021-12',
          isPresent: false,
          description: bartenderBullets,
          canonicalDescription: bartenderBullets,
        },
      ],
    });
    stale = productionOperatorCv();
    const factSet = buildCvCanonicalFactSet(stale);
    const grounded = finalizeClientAiSummary(
      'स्टॉक स्तरों का प्रबंधन और इन्वेंटरी गणना में सहायता।',
      stale,
      'hi',
      buildExperienceDurationSnapshot(stale.experience, REF),
    );
    expect(grounded.summary).not.toMatch(/स्टॉक|इन्वेंटरी/u);
    expect(validateLocalizedSummary(grounded.summary, factSet, { locale: 'hi', gender: 'female' }).valid).toBe(true);
  });
});

describe('occupational title resolver', () => {
  it('rejects placeholder experience titles', () => {
    expect(isValidOccupationalTitle('V')).toBe(false);
    expect(isValidOccupationalTitle('X')).toBe(false);
    expect(isValidOccupationalTitle('-')).toBe(false);
    expect(isValidOccupationalTitle('N/A')).toBe(false);
    expect(isValidOccupationalTitle('')).toBe(false);
    expect(isValidOccupationalTitle('OPERATER U PROIZVODNJI')).toBe(true);
  });

  it('prefers profile title over placeholder experience title', () => {
    expect(resolveOccupationalTitleForSummary({
      profileJobTitle: 'OPERATER U PROIZVODNJI',
      currentExperienceTitle: 'V',
      locale: 'hi',
      gender: 'female',
    })).toBe('उत्पादन ऑपरेटर');
    expect(resolveOccupationalTitleForSummary({
      profileJobTitle: 'OPERATER U PROIZVODNJI',
      currentExperienceTitle: 'V',
      locale: 'sr',
      gender: 'female',
    })).toMatch(/Operaterka u proizvodnji/i);
  });
});
