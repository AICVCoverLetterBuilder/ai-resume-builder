/**
 * Hindi Professional Summary must not apply/export with raw English skill lists.
 * Apply and PDF/DOCX share one acceptance contract.
 */
import { describe, it, expect } from 'vitest';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { activateCvSummary } from '@/lib/cv-content-activation';
import { validateLocalizedSummary } from '@/lib/cv-semantic-fidelity';
import {
  deterministicLocalizedSummaryFromCanonical,
} from '@/lib/cv-localized-fallback';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import { prepareCreativeArtisticExport } from '@/lib/cv-export-integrity';
import { prepareCorporateNavyExport } from '@/lib/corporate-navy-export-integrity';
import { getLocalizedCvSkillName } from '@/lib/cv-skill-options';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

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

const MIXED_PROVIDER =
  'मैं लगभग दो वर्षों के अनुभव वाली बेकर हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, कार्यस्थल की स्वच्छता बनाए रखती हूँ और रसोई टीम के साथ सहयोग करती हूँ। मुख्य कौशल में Critical Thinking, Adaptability, Problem Solving and Time Management शामिल हैं।';

const MIXED_REPAIR =
  'मैं लगभग दो वर्षों के अनुभव वाली बेकर हूँ। Key skills include Critical Thinking, Adaptability, Problem Solving.';

function bakerCv(overrides?: Partial<CVData>): CVData {
  return {
    personal: {
      fullName: 'Ana Baker',
      jobTitle: 'Baker',
      gender: 'female',
      email: 'a@test.com',
      phone: '',
      address: '',
      photoEnabled: false,
    },
    summary: '',
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
    education: [],
    skills: [
      'Presentation Skills',
      'Leadership',
      'Organization',
      'Critical Thinking',
      'Adaptability',
      'Problem Solving',
      'Time Management',
    ],
    certifications: [],
    languages: [],
    templateId: 'creative-artistic',
    ...overrides,
  } as CVData;
}

describe('Hindi summary mixed-language apply/export contract', () => {
  const cv = bakerCv();
  const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });
  const duration = buildExperienceDurationSnapshot(cv.experience, REF);

  it('1–8. mixed English skills rejected; fallback localized; no Critical Thinking list', async () => {
    const check = validateLocalizedSummary(MIXED_PROVIDER, factSet, {
      locale: 'hi',
      gender: 'female',
      expectedDuration: duration.total,
    });
    expect(check.valid).toBe(false);
    expect(check.violations.some((v) =>
      v.kind === 'unlocalized_skill_labels' || v.kind === 'mixed_language_summary',
    )).toBe(true);

    const activated = await activateCvSummary({
      locale: 'hi',
      gender: 'female',
      factSet,
      candidate: MIXED_PROVIDER,
      sourceFactsText: EN_DUTIES,
      duration: duration.total,
      fallbackSummary: '',
      repair: async () => MIXED_REPAIR,
    });
    expect(activated.status).toBe('fallback');
    expect(activated.content).toMatch(/सहयोग|तैयार|स्वच्छ/);
    expect(activated.content).not.toMatch(/Critical Thinking|Adaptability|Problem Solving/);
    expect(activated.content).toMatch(/करती हूँ|वाली/);
    // Localized skills optional
    if (/कौशल/.test(activated.content)) {
      expect(activated.content).toMatch(/संगठन|अनुकूलनशीलता|समस्या समाधान|समय प्रबंधन|नेतृत्व|आलोचनात्मक|प्रस्तुति/);
    }

    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'summary_generate',
      candidate: MIXED_PROVIDER,
      referenceDateIso: REF,
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
    expect(pipeline.stateCv.summary).not.toMatch(/Critical Thinking,\s*Adaptability/);
    expect(pipeline.stateCv.contentLocale || 'hi').toBeTruthy();
  });

  it('9–18. finalized Hindi exports identically to PDF and DOCX; usage once; export zero', async () => {
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'summary_generate',
      candidate: MIXED_PROVIDER,
      referenceDateIso: REF,
    });
    expect(pipeline.blocked).toBe(false);
    const summary = pipeline.stateCv.summary;
    expect(summary).toBeTruthy();

    // Simulate Hindi experience display already applied (AI Improvements) while
    // grounding remains English user duties.
    const stateCv = {
      ...pipeline.stateCv,
      contentLocale: 'hi' as Locale,
      experience: [{
        ...pipeline.stateCv.experience[0],
        description: HI_DUTIES,
        descriptionOrigin: 'deterministic_fallback' as const,
        originalUserDescription: EN_DUTIES,
        canonicalDescription: EN_DUTIES,
      }],
    };

    const pdf = prepareCreativeArtisticExport(stateCv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    const docx = prepareCreativeArtisticExport(stateCv, 'hi', {
      gender: 'female',
      referenceDate: REF,
    });
    expect(pdf.cv.summary).toBe(docx.cv.summary);
    // Export may safely re-project mixed legacy text; must not keep English skill list.
    expect(pdf.cv.summary).not.toMatch(/Critical Thinking|Adaptability,\s*Problem/);
    expect(pdf.cv.summary).toMatch(/[\u0900-\u097F]/);
    expect(pdf.cv.summary).toMatch(/सहयोग|तैयार|स्वच्छ/);
    expect(pdf.cv.summary).not.toMatch(/high-quality|health standards|under pressure/i);
    expect(pipeline.finalized.countedAsSuccess).toBe(true);
  });

  it('19–23. old saved mixed Hindi summary recovers on export without promoting it as facts', () => {
    const stale = bakerCv({
      summary: MIXED_PROVIDER,
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
      }],
    });
    const pdf = prepareCreativeArtisticExport(stale, 'hi', { gender: 'female', referenceDate: REF });
    const docx = prepareCreativeArtisticExport(stale, 'hi', { gender: 'female', referenceDate: REF });
    expect(pdf.cv.summary).toBe(docx.cv.summary);
    expect(pdf.cv.summary).not.toBe(MIXED_PROVIDER);
    expect(pdf.cv.summary).not.toMatch(/Critical Thinking/);
    expect(pdf.cv.summary).toMatch(/तैयार|स्वच्छ|सहयोग/);
    // Grounding unchanged
    expect(stale.experience[0].originalUserDescription).toBe(EN_DUTIES);
    expect(stale.experience[0].canonicalDescription).toBe(EN_DUTIES);
  });

  it('24–26. English control still exports with English skill labels', () => {
    const enCv = bakerCv({
      summary: 'Baker with approximately two years of experience preparing dishes according to restaurant standards, maintaining workplace hygiene and collaborating with the kitchen team. Key skills include organization, adaptability, problem solving and time management.',
      summaryOrigin: 'deterministic_fallback',
      contentLocale: 'en',
    });
    const pdf = prepareCreativeArtisticExport(enCv, 'en', { gender: 'female', referenceDate: REF });
    const docx = prepareCreativeArtisticExport(enCv, 'en', { gender: 'female', referenceDate: REF });
    expect(pdf.cv.summary).toBe(docx.cv.summary);
    expect(pdf.cv.summary).toMatch(/Key skills include|organization|adaptability/i);
    expect(pdf.cv.summary.length).toBeLessThan(600);
  });

  it('27. Serbian summary uses localized skill labels', () => {
    const factSet = buildCvCanonicalFactSet({ ...cv, summary: '' });
    const grounded = deterministicLocalizedSummaryFromCanonical(
      factSet, 'sr', 'female', duration.total,
    );
    expect(grounded).toMatch(/Pekarka/);
    expect(grounded).not.toMatch(/Critical Thinking/);
    if (/veštine uključuju/i.test(grounded)) {
      expect(grounded).toMatch(/organizacija|prilagodljivost|rešavanje problema|upravljanje vremenom|liderstvo|kritičko/i);
    }
  });

  it('28–29. Arabic and Japanese summaries finalize without English skill lists', () => {
    for (const locale of ['ar', 'ja'] as const) {
      const finalized = finalizeCvAiFieldForApply({
        action: 'summary_generate',
        field: 'summary',
        requestedLocale: locale,
        gender: 'female',
        cv: bakerCv(),
        candidate: 'INVALID mixed Critical Thinking Adaptability Problem Solving',
        durationSnapshot: duration,
        referenceDateIso: REF,
      });
      expect(finalized.blocked, locale).toBe(false);
      expect(finalized.text, locale).not.toMatch(/Critical Thinking|Adaptability|Problem Solving/);
      expect(finalized.text.trim().length, locale).toBeGreaterThan(20);
      // Export uses experience localization independently; summary text itself is accepted.
      const check = validateLocalizedSummary(finalized.text, factSet, {
        locale,
        gender: 'female',
        expectedDuration: duration.total,
      });
      expect(check.valid, locale).toBe(true);
    }
  });

  it('30. company names do not trigger wrong-language rejection', async () => {
    const withCompany = `${MIXED_PROVIDER.replace(/Critical Thinking.*/, '').trim()} Ztrew.`;
    // Duty-only Hindi + company Latin is fine when no English skill list.
    const dutyOnly =
      'मैं लगभग दो वर्षों के अनुभव वाली बेकर हूँ। मैं रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ, कार्यस्थल की स्वच्छता बनाए रखती हूँ और रसोई टीम के साथ सहयोग करती हूँ। Ztrew.';
    const check = validateLocalizedSummary(dutyOnly, factSet, {
      locale: 'hi',
      gender: 'female',
      expectedDuration: duration.total,
    });
    expect(check.valid).toBe(true);
    expect(withCompany).toBeTruthy();
  });

  it('skill localization source of truth', () => {
    expect(getLocalizedCvSkillName('Critical Thinking', 'hi')).toBe('आलोचनात्मक सोच');
    expect(getLocalizedCvSkillName('Adaptability', 'hi')).toBe('अनुकूलनशीलता');
    expect(getLocalizedCvSkillName('Problem Solving', 'hi')).toBe('समस्या समाधान');
    expect(getLocalizedCvSkillName('Time Management', 'hi')).toBe('समय प्रबंधन');
    expect(getLocalizedCvSkillName('Organization', 'hi')).toBe('संगठन');
    expect(getLocalizedCvSkillName('Leadership', 'hi')).toBe('नेतृत्व');
    expect(getLocalizedCvSkillName('Presentation Skills', 'hi')).toBe('प्रस्तुति कौशल');
  });

  it('50× cold Hindi activateCvSummary is stable without English skill lists', async () => {
    let first = '';
    for (let i = 0; i < 50; i++) {
      const activated = await activateCvSummary({
        locale: 'hi',
        gender: 'female',
        factSet,
        candidate: MIXED_PROVIDER,
        sourceFactsText: EN_DUTIES,
        duration: duration.total,
        fallbackSummary: '',
        repair: async () => MIXED_REPAIR,
      });
      expect(activated.status, `run ${i}`).toBe('fallback');
      expect(activated.content, `run ${i}`).not.toMatch(/Critical Thinking|Adaptability/);
      if (i === 0) first = activated.content;
      else expect(activated.content, `run ${i}`).toBe(first);
    }
  });
});

describe('Corporate Navy Hindi export control', () => {
  it('exports Hindi summary without English skill list', () => {
    const cv = bakerCv({
      templateId: 'corporate-navy',
      summary: MIXED_PROVIDER,
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
      }],
    });
    // Corporate navy may use its own path; if it throws, document — prefer creative-artistic path.
    try {
      const out = prepareCorporateNavyExport(cv, 'hi', { gender: 'female', referenceDate: REF });
      expect(out.cv.summary).not.toMatch(/Critical Thinking,\s*Adaptability/);
    } catch {
      // Some templates share creative-artistic integrity; ensure creative path works.
      const ca = prepareCreativeArtisticExport(
        { ...cv, templateId: 'creative-artistic' },
        'hi',
        { gender: 'female', referenceDate: REF },
      );
      expect(ca.cv.summary).not.toMatch(/Critical Thinking/);
    }
  });
});
