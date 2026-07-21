import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  getPremiumRecommendationFallback,
  getTemplateRecommendationScoreBreakdown,
  normalizeRecommendedTemplateId,
  PREMIUM_RECOMMENDATION_TIE_BREAK_ORDER,
  recommendTemplate,
  recommendTemplateDetails,
  templateInfo,
  type CVData,
  type TemplateId,
} from '@/lib/types';

function cv(overrides: Partial<CVData> = {}): CVData {
  const { personal, ...rest } = overrides;
  const base: CVData = {
    id: 'test-cv',
    name: '',
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '' },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'US',
    createdAt: '',
    updatedAt: '',
  };
  const merged = { ...base, ...rest };
  merged.personal = { ...base.personal, ...personal };
  return merged;
}

const registryIds = Object.keys(templateInfo) as TemplateId[];
const freeTemplateIds = registryIds.filter((id) => !templateInfo[id].isPro);
const premiumTemplateIds = registryIds.filter((id) => templateInfo[id].isPro);

function expectPremiumRecommendation(id: TemplateId) {
  expect(registryIds).toContain(id);
  expect(premiumTemplateIds).toContain(id);
  expect(templateInfo[id].isPro).toBe(true);
  expect(freeTemplateIds).not.toContain(id);
  expect(id).not.toBe('modern-minimal');
}

describe('template recommendation', () => {
  test('AI recommendations only consider premium templates from the canonical registry', () => {
    expect(freeTemplateIds).toEqual(['modern-minimal', 'clean-simple', 'professional-classic']);
    expect(premiumTemplateIds).toEqual([
      'creative-bold',
      'creative-artistic',
      'elegant-formal',
      'ats-standard',
      'executive-premium',
      'nordic-clean',
      'tech-sidebar',
      'corporate-navy',
      'contemporary-bold',
      'rirekisho',
    ]);
    expect(PREMIUM_RECOMMENDATION_TIE_BREAK_ORDER).toEqual([
      'ats-standard',
      'tech-sidebar',
      'nordic-clean',
      'contemporary-bold',
      'creative-bold',
      'creative-artistic',
      'corporate-navy',
      'elegant-formal',
      'executive-premium',
      'rirekisho',
    ]);
  });

  test('Nordic Clean is not a universal fallback and free fallbacks are excluded', () => {
    const emptyRecommendation = recommendTemplateDetails(cv());
    const unknownRecommendation = recommendTemplate(cv({
      personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Office Coordinator' },
      summary: 'Reliable administrative professional focused on scheduling, documentation, and client support.',
    }));

    expect(emptyRecommendation.templateId).toBe(getPremiumRecommendationFallback());
    expect(emptyRecommendation.templateId).not.toBe('nordic-clean');
    expect(unknownRecommendation).not.toBe('nordic-clean');
    expectPremiumRecommendation(emptyRecommendation.templateId);
    expectPremiumRecommendation(unknownRecommendation);
  });

  test('substantially different CV profiles produce different valid recommendations', () => {
    const profiles = [
      cv({
        personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Senior React Platform Engineer' },
        summary: 'Senior engineer building TypeScript, React, Kubernetes, cloud, and developer platform systems.',
        experience: [
          { id: '1', company: 'CloudCo', position: 'Senior Software Engineer', startDate: '', endDate: '', isPresent: true, description: 'Led frontend platform architecture and CI/CD modernization.' },
          { id: '2', company: 'DataCo', position: 'Software Engineer', startDate: '', endDate: '', isPresent: false, description: 'Built fullstack web applications.' },
        ],
        skills: ['TypeScript', 'React', 'Kubernetes', 'Cloud'],
      }),
      cv({
        personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Creative Brand Designer', photo: 'data:image/png;base64,photo', photoEnabled: true },
        summary: 'Portfolio-focused designer creating brand systems, campaigns, Figma prototypes, illustration, and social media assets.',
        skills: ['Figma', 'Illustration', 'Brand Strategy', 'Campaign Design'],
      }),
      cv({
        personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Chief Financial Officer' },
        summary: 'CFO and board advisor leading finance, investment, compliance, risk, audit, and banking strategy.',
        experience: [
          { id: '1', company: 'Enterprise', position: 'Chief Financial Officer', startDate: '', endDate: '', isPresent: true, description: 'Managed capital planning, audit, and risk governance.' },
          { id: '2', company: 'Bank', position: 'Finance Director', startDate: '', endDate: '', isPresent: false, description: 'Led banking and investment reporting.' },
          { id: '3', company: 'Consulting', position: 'Senior Finance Manager', startDate: '', endDate: '', isPresent: false, description: 'Owned executive reporting.' },
        ],
      }),
    ];

    const recommendations = profiles.map((profile) => recommendTemplate(profile));
    expect(new Set(recommendations).size).toBeGreaterThanOrEqual(3);
    recommendations.forEach(expectPremiumRecommendation);
  });

  test('every returned template ID exists in the real template registry and is premium', () => {
    const inputs = [
      cv({ region: 'Japan', personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Software Engineer' } }),
      cv({ personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Junior Graduate Assistant' }, education: [{ id: 'e', school: 'University', degree: 'BA', startDate: '', endDate: '', description: '' }] }),
      cv({ personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Nurse Practitioner' }, summary: 'Clinical healthcare and medical patient care.' }),
      cv({ personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Product Operations Manager' }, skills: ['Scrum', 'Agile', 'Delivery'] }),
    ];

    inputs.map((input) => recommendTemplate(input)).forEach((id) => {
      expectPremiumRecommendation(id);
    });
  });

  test('malformed, invalid, or free AI-like result uses the documented premium fallback', () => {
    expect(normalizeRecommendedTemplateId('{bad-json')).toBe(getPremiumRecommendationFallback());
    expect(normalizeRecommendedTemplateId({ templateId: 'missing-template' })).toBe(getPremiumRecommendationFallback());
    expect(normalizeRecommendedTemplateId({ templateId: 'modern-minimal' })).toBe(getPremiumRecommendationFallback());
    expect(normalizeRecommendedTemplateId({ slug: 'creative_bold' })).toBe('creative-bold');
  });

  test('missing data is handled explicitly with a premium fallback', () => {
    const recommendation = recommendTemplateDetails(cv());

    expect(recommendation.confidence).toBe('insufficient-data');
    expect(recommendation.templateId).toBe(getPremiumRecommendationFallback());
    expect(recommendation.reason).toContain('Not enough CV content');
    expect(recommendation.reason).toContain(getPremiumRecommendationFallback());
    expectPremiumRecommendation(recommendation.templateId);
  });

  test('modern-minimal cannot be returned by recommendation or normalization', () => {
    const inputs = [
      cv(),
      cv({ personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Modern minimal ATS resume parser keyword profile' } }),
      cv({ personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Student Intern' }, education: [{ id: 'e', school: 'College', degree: 'Marketing', startDate: '', endDate: '', description: '' }] }),
      cv({ personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Software Engineer' }, summary: 'React TypeScript developer.' }),
    ];

    inputs.map((input) => recommendTemplate(input)).forEach((id) => {
      expect(id).not.toBe('modern-minimal');
      expectPremiumRecommendation(id);
    });
    expect(normalizeRecommendedTemplateId('modern-minimal')).not.toBe('modern-minimal');
  });

  test('experienced sales/marketing and sparse entry-level profiles use different premium recommendations from score signals', () => {
    const experiencedSalesMarketing = cv({
      personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Senior Sales and Marketing Manager', photo: 'data:image/png;base64,photo', photoEnabled: true },
      summary: 'Senior revenue leader for sales, growth marketing, brand campaigns, account expansion, and business development.',
      experience: [
        { id: '1', company: 'SaaSCo', position: 'Senior Sales and Marketing Manager', startDate: '', endDate: '', isPresent: true, description: 'Led revenue campaigns, partner marketing, sales enablement, and account growth across enterprise markets.' },
        { id: '2', company: 'RetailCo', position: 'Marketing Lead', startDate: '', endDate: '', isPresent: false, description: 'Managed brand, content, social, SEO, email marketing, and campaign analytics.' },
        { id: '3', company: 'Agency', position: 'Account Executive', startDate: '', endDate: '', isPresent: false, description: 'Owned client sales presentations, pipeline development, and conversion reporting.' },
      ],
      skills: ['Sales Strategy', 'Growth Marketing', 'Brand Campaigns', 'Revenue Operations'],
    });
    const sparseEntryLevel = cv({
      personal: { fullName: '', email: '', phone: '', address: '', jobTitle: 'Entry Level Marketing Assistant' },
      education: [{ id: 'e', school: 'University', degree: 'BA Marketing', startDate: '', endDate: '', description: '' }],
      skills: ['Social Media'],
    });

    const experiencedBreakdown = getTemplateRecommendationScoreBreakdown(experiencedSalesMarketing);
    const sparseBreakdown = getTemplateRecommendationScoreBreakdown(sparseEntryLevel);
    const experiencedRecommendation = recommendTemplate(experiencedSalesMarketing);
    const sparseRecommendation = recommendTemplate(sparseEntryLevel);

    expect(experiencedBreakdown.level).toBe('senior');
    expect(experiencedBreakdown.hasPhoto).toBe(true);
    expect(experiencedBreakdown.filledExperience).toBe(3);
    expect(experiencedBreakdown.scores['contemporary-bold']).toBeGreaterThan(experiencedBreakdown.scores['ats-standard']);

    expect(sparseBreakdown.level).toBe('entry');
    expect(sparseBreakdown.hasPhoto).toBe(false);
    expect(sparseBreakdown.wordCount).toBeLessThan(80);
    expect(sparseBreakdown.scores['ats-standard']).toBeGreaterThan(sparseBreakdown.scores['contemporary-bold']);

    expect(experiencedRecommendation).toBe('contemporary-bold');
    expect(sparseRecommendation).toBe('ats-standard');
    expect(experiencedRecommendation).not.toBe(sparseRecommendation);
    expect(recommendTemplate(experiencedSalesMarketing)).toBe(experiencedRecommendation);
    expect(recommendTemplate(sparseEntryLevel)).toBe(sparseRecommendation);
  });

  test('Free/Pro gating remains before recommendation and template selection still uses the returned ID', () => {
    const cvBuilder = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');
    const handlerStart = cvBuilder.indexOf('const handleTemplateRecommend = () => {');
    const handlerEnd = cvBuilder.indexOf('const TemplateComponent = templateComponents[cv.templateId];');
    const handler = cvBuilder.slice(handlerStart, handlerEnd);

    expect(handler).toContain('getCurrentProTokenOrToast(() => setAiRecommendModal(true))');
    expect(handler.indexOf('getCurrentProTokenOrToast')).toBeLessThan(handler.indexOf('recommendTemplate(cv)'));
    expect(handler).toContain('commitCvUpdate(prev => ({ ...prev, templateId: recommended }))');
    expect(handler).toContain('setRecommendedTemplateId(recommended)');
  });

  test('ordinary manual template selection still includes free templates', () => {
    const cvBuilder = fs.readFileSync(path.resolve('src/app/cv-builder/page.tsx'), 'utf8');

    expect(cvBuilder).toContain('(Object.entries(templateInfo) as [TemplateId, typeof templateInfo[TemplateId]][]).map');
    expect(cvBuilder).toContain('commitCvUpdate');
    expect(freeTemplateIds.length).toBeGreaterThan(0);
    freeTemplateIds.forEach((id) => {
      expect(registryIds).toContain(id);
    });
  });

  test('AI recommendation source remains isolated from export/template rendering changes', () => {
    const changedFiles = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' })
      .split(/\r?\n/)
      .filter(Boolean);

    // Optional canonical fact-lock fields on CVData/WorkExperience are allowed;
    // recommendation scoring sources must not be altered by export/content work.
    if (changedFiles.includes('src/lib/types.ts')) {
      const typesDiff = execFileSync('git', ['diff', '--', 'src/lib/types.ts'], { encoding: 'utf8' });
      expect(typesDiff).not.toMatch(/recommendTemplate|ProfessionCategory/);
      expect(typesDiff).toMatch(
        /canonicalDescription|canonicalSummary|generationJobContextKey|summaryGenerationContextKey|positionProvenance|positionUserEdited|positionSourceLocale|positionSourceKey/,
      );
    }
    expect(changedFiles.filter((f) => f === 'src/lib/ai.ts' || f.endsWith('/recommend-template.ts'))).toEqual([]);
  });
});
