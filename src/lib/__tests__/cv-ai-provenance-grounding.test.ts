import { describe, it, expect } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  acceptValidatedAiContent,
  migrateLegacyCanonicalCv,
} from '@/lib/cv-canonical-snapshot';
import {
  applyGeneratedExperienceDescription,
  captureUserGroundingBeforeAi,
  hasCuisineSpecificClaim,
  resolveExperienceGroundingDescription,
} from '@/lib/cv-experience-provenance';
import { runCvAiApplyPipeline } from '@/lib/cv-ai-finalize-apply';
import { deterministicLocalizedBulletsFromCanonical } from '@/lib/cv-localized-fallback';
import { buildCvCanonicalFactSet, formatExperienceBullets } from '@/lib/cv-canonical-facts';

const USER_SR = formatExperienceBullets([
  'Pripremala sam jela u skladu sa standardima restorana Boranija.',
  'Organizovala sam pripremu namirnica i održavala uredan radni prostor u kuhinji.',
  'Sarađivala sam sa kolegama iz kuhinjskog tima tokom dnevnog servisa.',
  'Poštovala sam higijenske procedure i pravila skladištenja namirnica.',
]);

const AI_SR_INVENTED = formatExperienceBullets([
  'Pripremala sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana Boranija.',
  'Organizovala sam pripremu namirnica i održavala uredan radni prostor u kuhinji.',
  'Sarađivala sam sa kolegama iz kuhinjskog tima tokom dnevnog servisa.',
  'Poštovala sam higijenske procedure i pravila skladištenja namirnica.',
]);

function makeCv(overrides?: Partial<CVData['experience'][0]>): CVData {
  return {
    personal: {
      fullName: 'Ana',
      jobTitle: 'Kuvar',
      gender: 'female',
      email: '',
      phone: '',
      address: '',
      photoEnabled: false,
    },
    summary: '',
    experience: [{
      id: 'exp-1',
      position: 'Kuvar',
      company: 'Boranija',
      startDate: '2022-01',
      endDate: '',
      isPresent: true,
      description: USER_SR,
      originalUserDescription: USER_SR,
      canonicalDescription: USER_SR,
      descriptionOrigin: 'user',
      ...overrides,
    }],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  } as CVData;
}

describe('AI provenance — never promote hallucinations to canonical', () => {
  it('1. AI Serbian invention is not written into canonicalDescription', () => {
    const cv = makeCv();
    const next = acceptValidatedAiContent(cv, {
      locale: 'sr',
      experienceId: 'exp-1',
      description: AI_SR_INVENTED,
      descriptionOrigin: 'ai_generated',
    });
    expect(next.experience[0].description).toContain('mediteranske');
    expect(next.experience[0].canonicalDescription).toBe(USER_SR);
    expect(next.experience[0].originalUserDescription).toBe(USER_SR);
    expect(next.experience[0].descriptionOrigin).toBe('ai_generated');
    expect(hasCuisineSpecificClaim(next.experience[0].canonicalDescription!)).toBe(false);
  });

  it('2. English AI Improvements grounds on user text, not invented cuisine', () => {
    let cv = makeCv();
    cv = acceptValidatedAiContent(cv, {
      locale: 'sr',
      experienceId: 'exp-1',
      description: AI_SR_INVENTED,
      descriptionOrigin: 'ai_generated',
    });
    const pipeline = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
    });
    expect(pipeline.blocked).toBe(false);
    expect(pipeline.stateCv.experience[0].description).not.toMatch(/Serbian and Mediterranean/i);
    expect(pipeline.stateCv.experience[0].canonicalDescription).toBe(USER_SR);
    expect(pipeline.stateCv.experience[0].description).toMatch(/Prepared dishes|restaurant/i);
  });

  it('3. polluted canonical is repaired from originalUserDescription', () => {
    const polluted = captureUserGroundingBeforeAi({
      id: 'e',
      company: 'B',
      position: 'Kuvar',
      startDate: '2022-01',
      endDate: '',
      isPresent: true,
      description: AI_SR_INVENTED,
      descriptionOrigin: 'ai_generated',
      originalUserDescription: USER_SR,
      canonicalDescription: AI_SR_INVENTED,
    });
    expect(polluted.canonicalDescription).toBe(USER_SR);
    expect(resolveExperienceGroundingDescription(polluted)).toBe(USER_SR);
  });

  it('4. ensure/capture never freezes AI display into canonical', () => {
    const afterAi = applyGeneratedExperienceDescription(
      {
        id: 'e',
        company: 'B',
        position: 'Kuvar',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: USER_SR,
        descriptionOrigin: 'user',
      },
      AI_SR_INVENTED,
      { locale: 'sr', origin: 'ai_generated' },
    );
    expect(afterAi.canonicalDescription).toBe(USER_SR);
    expect(afterAi.originalUserDescription).toBe(USER_SR);
    const again = captureUserGroundingBeforeAi(afterAi);
    expect(again.canonicalDescription).toBe(USER_SR);
  });

  it('5. cuisine-specific fallback only when source names both cuisines', () => {
    const withCuisine = formatExperienceBullets([
      'Pripremala sam jela srpske i mediteranske kuhinje u skladu sa standardima restorana.',
    ]);
    const plain = formatExperienceBullets([
      'Pripremala sam jela u skladu sa standardima restorana.',
    ]);
    const factsCuisine = buildCvCanonicalFactSet(makeCv({
      description: withCuisine,
      originalUserDescription: withCuisine,
      canonicalDescription: withCuisine,
    })).facts.filter((f) => f.type === 'experience_bullet');
    const factsPlain = buildCvCanonicalFactSet(makeCv({
      description: plain,
      originalUserDescription: plain,
      canonicalDescription: plain,
    })).facts.filter((f) => f.type === 'experience_bullet');
    expect(deterministicLocalizedBulletsFromCanonical(factsCuisine, 'en', 'female'))
      .toMatch(/Serbian and Mediterranean/i);
    expect(deterministicLocalizedBulletsFromCanonical(factsPlain, 'en', 'female'))
      .not.toMatch(/Serbian and Mediterranean/i);
  });

  it('6. Hindi AI Improvements succeeds after Serbian→English AI chain', () => {
    let cv = makeCv();
    cv = acceptValidatedAiContent(cv, {
      locale: 'sr',
      experienceId: 'exp-1',
      description: AI_SR_INVENTED,
      descriptionOrigin: 'ai_generated',
    });
    const en = runCvAiApplyPipeline({
      cv,
      locale: 'en',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
    });
    expect(en.blocked).toBe(false);
    cv = en.stateCv;
    const hi = runCvAiApplyPipeline({
      cv,
      locale: 'hi',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-1',
    });
    expect(hi.blocked).toBe(false);
    expect(hi.finalized.countedAsSuccess).toBe(true);
    expect(hi.stateCv.experience[0].description).toMatch(/[\u0900-\u097F]/);
    expect(hi.stateCv.experience[0].canonicalDescription).toBe(USER_SR);
    expect(hi.stateCv.experience[0].description).not.toMatch(/सर्बियाई और भूमध्य/u);
  });

  it('7. AI summary is not promoted to canonicalSummary', () => {
    const cv = makeCv();
    cv.canonicalSummary = 'User summary grounded.';
    const next = acceptValidatedAiContent(cv, {
      locale: 'en',
      summary: 'AI invented Mediterranean cuisine leadership summary.',
      summaryOrigin: 'ai_generated',
    });
    expect(next.summary).toMatch(/AI invented/);
    expect(next.canonicalSummary).toBe('User summary grounded.');
  });

  it('8. migrateLegacyCanonicalCv repairs polluted canonical', () => {
    const legacy = makeCv({
      description: AI_SR_INVENTED,
      descriptionOrigin: 'ai_generated',
      originalUserDescription: USER_SR,
      canonicalDescription: AI_SR_INVENTED,
    });
    const migrated = migrateLegacyCanonicalCv(legacy);
    expect(migrated.experience[0].canonicalDescription).toBe(USER_SR);
  });

  it('9. 50× provenance chain sr→en→hi zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      let cv = makeCv();
      cv = acceptValidatedAiContent(cv, {
        locale: 'sr',
        experienceId: 'exp-1',
        description: AI_SR_INVENTED,
        descriptionOrigin: 'ai_generated',
      });
      const en = runCvAiApplyPipeline({
        cv,
        locale: 'en',
        action: 'experience_bullets',
        candidate: i % 2 === 0 ? '' : '• Increased revenue and led the kitchen team.\n• Won awards.',
        experienceId: 'exp-1',
      });
      expect(en.blocked, `en ${i}`).toBe(false);
      const hi = runCvAiApplyPipeline({
        cv: en.stateCv,
        locale: 'hi',
        action: 'experience_bullets',
        candidate: '',
        experienceId: 'exp-1',
      });
      expect(hi.blocked, `hi ${i}`).toBe(false);
      expect(hi.stateCv.experience[0].canonicalDescription, `canon ${i}`).toBe(USER_SR);
      expect(hi.stateCv.experience[0].description, `hi text ${i}`).not.toMatch(/Serbian and Mediterranean|mediteransk/i);
    }
  });
});
