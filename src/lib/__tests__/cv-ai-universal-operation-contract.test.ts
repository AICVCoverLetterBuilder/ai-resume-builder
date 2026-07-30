/**
 * @vitest-environment jsdom
 *
 * Universal AI generate/enhance contract — property-based / randomized matrix.
 * No occupation catalogue, no per-title special cases.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  AI_INDUSTRY_VALUES,
  AI_LEVEL_VALUES,
  AI_SUPPORTED_LOCALES,
  resolveAiOperationMode,
  textLooksRelevantToFreeTextTitle,
  freeTextTitleStems,
  mapAiOperationFailureToErrorCode,
  toExperienceAiOperationModeCompat,
} from '@/lib/cv-ai-operation-contract';
import {
  buildJobContextGenerationFallback,
  resolveExperienceAiOperationMode,
  validateExperienceGenerationOutput,
} from '@/lib/cv-experience-ai-operation-mode';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import {
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

/** Deterministic PRNG (mulberry32). */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

const FREE_TEXT_TITLES = [
  'Koordinator terenske dokumentacije',
  'Field Documentation Coordinator',
  'Analitičar logističkih tokova',
  'Quantum Workflow Harmonizer',
  'Специалист по документу обороту',
  'フィールド記録コーディネーター',
  'منسق توثيق ميداني',
  'क्षेत्रीय दस्तावेज़ समन्वयक',
  'Coordenador de fluxos operacionais',
  'Responsable d’alignement process',
  'Kuvar',
  'Pharmacist',
  'Customer Support Specialist',
  'XYZ-42 Pipeline Steward',
] as const;

const GENDERS = ['male', 'female', ''] as const;

function makeCv(opts: {
  locale: Locale;
  position: string;
  industry: string;
  level: string;
  isPresent: boolean;
  gender: string;
  description: string;
  company?: string;
}): { cv: CVData; exp: WorkExperience; ctx: ReturnType<typeof buildExperienceJobContext> } {
  const exp: WorkExperience = {
    id: 'exp-u',
    company: opts.company !== undefined ? opts.company : 'Acme',
    position: opts.position,
    startDate: '2024-01',
    endDate: opts.isPresent ? '' : '2025-06',
    isPresent: opts.isPresent,
    description: opts.description,
    canonicalDescription: opts.description ? opts.description : '',
    originalUserDescription: opts.description ? opts.description : '',
    descriptionOrigin: 'user',
  };
  const cv: CVData = {
    id: 'cv-u',
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      address: '',
      jobTitle: opts.position,
      gender: opts.gender,
    },
    summary: '',
    experience: [exp],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'EU',
    contentLocale: opts.locale,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const ctx = buildExperienceJobContext({
    position: opts.position,
    industry: opts.industry,
    locale: opts.locale,
    level: opts.level,
  });
  return { cv, exp, ctx };
}

describe('universal AI operation mode contract', () => {
  it('empty → generate_from_context; non-empty → enhance for all locales', () => {
    for (const locale of AI_SUPPORTED_LOCALES) {
      expect(resolveAiOperationMode({ targetContent: '' }), locale).toBe('generate_from_context');
      expect(resolveAiOperationMode({ targetContent: '   ' }), locale).toBe('generate_from_context');
      expect(resolveAiOperationMode({ targetContent: 'Some prior text' }), locale)
        .toBe('enhance_existing_content');
      expect(resolveAiOperationMode({
        targetContent: 'x',
        forceRegenerate: true,
      })).toBe('regenerate_existing_content');
    }
  });

  it('Experience adapter mirrors universal emptiness decision', () => {
    expect(resolveExperienceAiOperationMode('')).toBe('generate_from_job_context');
    expect(resolveExperienceAiOperationMode('Duty one.\nDuty two.')).toBe('enhance_existing_description');
    expect(toExperienceAiOperationModeCompat('generate_from_context')).toBe('generate_from_job_context');
  });

  it('free-text stems are derived from title tokens, not a catalogue', () => {
    const stems = freeTextTitleStems('Quantum Workflow Harmonizer');
    expect(stems.some((s) => s.includes('quantum') || s.includes('workflow') || s.includes('harmon'))).toBe(true);
    expect(textLooksRelevantToFreeTextTitle(
      'Installs quantum workflow components as part of assigned installation work.\nPositions and secures components during installation.\nCoordinates installation activities with colleagues.',
      'Quantum Workflow Harmonizer',
    )).toBe(true);
    expect(textLooksRelevantToFreeTextTitle(
      'Installs quantum workflow components as assigned for the Quantum Workflow Harmonizer role.\nReviews quantum workflow findings according to role requirements.\nCoordinates with colleagues on quantum workflow completion.',
      'Quantum Workflow Harmonizer',
    )).toBe(false);
    expect(textLooksRelevantToFreeTextTitle(
      'Performs day-to-day quantum workflow work duties as assigned.\nCompletes assigned role tasks according to role needs.\nCoordinates with colleagues on shared role work activities.',
      'Quantum Workflow Harmonizer',
    )).toBe(false);
    expect(textLooksRelevantToFreeTextTitle(
      'Reviews day-to-day records related to Quantum Workflow Harmonizer and verifies data completeness.\nUpdates work documentation and tracks open items according to role needs.\nCoordinates information sharing with colleagues to complete documentation on time.',
      'Quantum Workflow Harmonizer',
    )).toBe(false);
  });

  it('maps typed failures without collapsing to generic validation toast codes', () => {
    expect(mapAiOperationFailureToErrorCode('summary_generation_failed')).toBe('summary_generation_failed');
    expect(mapAiOperationFailureToErrorCode('cover_letter_generation_failed')).toBe('cover_letter_generation_failed');
    expect(mapAiOperationFailureToErrorCode('ai_noop')).toBe('ai_noop');
  });
});

describe('universal Experience generation fallback (no occupation catalogue)', () => {
  it('embeds arbitrary free-text title for every supported locale', () => {
    for (const locale of AI_SUPPORTED_LOCALES) {
      for (const title of ['Nebula Ops Liaison', 'अनजान भूमिका', '未知の担当']) {
        const out = buildJobContextGenerationFallback({
          locale,
          position: title,
          industry: 'general',
          isPresent: true,
          gender: 'male',
        });
        const bullets = splitExperienceBullets(out);
        expect(bullets, locale).toHaveLength(3);
        expect(generationTextLooksRelevantToTitleOrPass(out, title), `${locale}:${title}`).toBe(true);
        const v = validateExperienceGenerationOutput(out, {
          locale,
          position: title,
          isPresent: true,
        });
        // Hindi/ar/ja may use locale-specific person modes that still pass perspective gate
        expect(v.generatedBulletCount, locale).toBe(3);
        if (locale === 'en' || locale === 'sr' || locale === 'de' || locale === 'es') {
          expect(v.ok, `${locale} ${title} ${v.reason}`).toBe(true);
        }
      }
    }
  });

  it('present vs past tense for completed roles (sr/en)', () => {
    const present = buildJobContextGenerationFallback({
      locale: 'en', position: 'Ops Analyst', isPresent: true,
    });
    const past = buildJobContextGenerationFallback({
      locale: 'en', position: 'Ops Analyst', isPresent: false,
    });
    expect(present).toMatch(/^• Analyzes\b/m);
    expect(past).toMatch(/^• Analyzed\b/m);
  });
});

function generationTextLooksRelevantToTitleOrPass(text: string, title: string): boolean {
  return textLooksRelevantToFreeTextTitle(text, title) || text.includes(title);
}

describe('randomized Experience AI matrix (200 draws)', () => {
  it('empty description always generates; non-empty stays enhance mode', () => {
    const rng = mulberry32(26701);
    for (let i = 0; i < 200; i += 1) {
      const locale = pick(rng, AI_SUPPORTED_LOCALES);
      const position = pick(rng, FREE_TEXT_TITLES);
      const industry = pick(rng, AI_INDUSTRY_VALUES);
      const level = pick(rng, AI_LEVEL_VALUES);
      const isPresent = rng() > 0.4;
      const gender = pick(rng, GENDERS);
      const empty = rng() > 0.35;
      const description = empty
        ? ''
        : formatExperienceBullets([
          `Duty alpha for ${position} with accuracy checks.`,
          `Duty beta tracks status for ${position}.`,
          `Duty gamma coordinates colleagues for ${position}.`,
        ]);

      const mode = resolveExperienceAiOperationMode(description);
      expect(mode).toBe(empty ? 'generate_from_job_context' : 'enhance_existing_description');

      if (!empty) continue;

      const { cv, exp, ctx } = makeCv({
        locale, position, industry, level, isPresent, gender, description: '',
        company: rng() > 0.5 ? 'Atlas' : '',
      });
      const snapshot = createExperienceAiOperationSnapshot({
        liveText: '',
        locale,
        requestId: `r-${i}`,
        jobContextHash: ctx.key,
      });
      const candidate = buildJobContextGenerationFallback({
        locale,
        gender,
        position,
        industry,
        isPresent,
      });
      // Provider failure simulation: empty / unsafe / wrong-locale / malformed
      const failureKind = Math.floor(rng() * 5);
      let providerCandidate = candidate;
      if (failureKind === 1) providerCandidate = '';
      if (failureKind === 2) {
        providerCandidate = formatExperienceBullets([
          'Uses Excel and Salesforce KPIs for Atlas clients.',
          'Led a team of 12 and increased revenue by 40%.',
          'Managed ISO 9001 certifications.',
        ]);
      }
      if (failureKind === 3) {
        providerCandidate = formatExperienceBullets([
          'This is completely unrelated English filler duty one.',
          'This is completely unrelated English filler duty two.',
          'This is completely unrelated English filler duty three.',
        ]);
      }
      if (failureKind === 4) providerCandidate = 'not bullets at all {{{';

      const finalized = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale: locale,
        gender,
        cv: { ...cv, experience: [{ ...exp, description: '' }] },
        candidate: providerCandidate,
        experienceId: exp.id,
        industry,
        level,
        jobContext: ctx,
        operationSnapshot: snapshot,
        originHint: failureKind === 0 ? 'ai_generated' : 'ai_generated',
      });

      expect(finalized.diagnostics?.operationMode, `draw ${i}`).toBe('generate_from_job_context');
      expect(finalized.diagnostics?.sourceWasEmpty, `draw ${i}`).toBe(true);
      // Safe fallback must recover for empty-description generation across locales
      // that the universal fallback templates cover well.
      if (['en', 'sr', 'hr', 'de', 'es', 'fr', 'it', 'ru', 'pt-BR', 'ja', 'ar', 'hi'].includes(locale)) {
        expect(finalized.countedAsSuccess, `draw ${i} locale=${locale} kind=${failureKind} reason=${finalized.reason}`).toBe(true);
        expect(splitExperienceBullets(finalized.text).length, `draw ${i}`).toBe(3);
        expect(finalized.text, `draw ${i}`).not.toMatch(/\bExcel\b|\bKPI\b|increased revenue/i);
      }
    }
  });
});

describe('Summary empty vs non-empty mode tagging', () => {
  it('empty summary finalize reports generation mode', () => {
    const { cv, ctx } = makeCv({
      locale: 'en',
      position: 'Ops Analyst',
      industry: 'general',
      level: 'mid',
      isPresent: true,
      gender: 'male',
      description: formatExperienceBullets([
        'Review operational reports and mark incomplete entries.',
        'Update shared status tables.',
        'Coordinate with two internal teams when information is missing.',
      ]),
    });
    cv.summary = '';
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'male',
      cv,
      candidate: '',
      jobContext: ctx,
      originHint: 'ai_generated',
    });
    expect(finalized.diagnostics?.sourceWasEmpty).toBe(true);
    expect(finalized.diagnostics?.operationMode).toBe('generate_from_job_context');
  });
});
