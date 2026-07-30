/**
 * @vitest-environment jsdom
 *
 * AAB-369 — English empty-source fallback surface prose quality.
 * Action grounding stays; reject title-echo / role-requirement filler; emit
 * natural lowercase compound duties for arbitrary free-text titles.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  buildExperienceJobContext,
  resolveExperienceAiGrounding,
} from '@/lib/cv-experience-job-context';
import {
  freezeExperienceAiDescription,
  ensureExperienceAiSourceFrozen,
} from '@/lib/cv-canonical-facts';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildJobContextGenerationFallback,
  validateExperienceGenerationOutput,
} from '@/lib/cv-experience-ai-operation-mode';
import {
  detectExperienceGenerationUnsupportedClaims,
  EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION,
} from '@/lib/cv-experience-unsupported-claims';
import {
  generationLooksRoleTitleEchoFillerOnly,
  textLooksRelevantToFreeTextTitle,
  EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION,
} from '@/lib/cv-ai-operation-contract';
import {
  persistProAiRecord,
  recordProAiUserActionSuccess,
  getProAiUsageCount,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const TITLE_ECHO_SOLAR = formatExperienceBullets([
  'Installs Solar Panels as assigned for the Solar Panel Installer role.',
  'Positions and secures Solar Panels according to role requirements.',
  'Coordinates with colleagues on Solar Panels installation work.',
]);

const UNSAFE_SOLAR = formatExperienceBullets([
  'Installs solar panels on residential and commercial rooftops to manufacturer standards.',
  'Connects wiring and inverters while following electrical safety standards.',
  'Performs inspection and maintenance to ensure optimal performance and compliance.',
]);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function assertNaturalSurface(text: string, position: string): void {
  const bullets = splitExperienceBullets(text);
  expect(bullets).toHaveLength(3);
  expect(text).not.toMatch(/for the .+ role/i);
  expect(text).not.toMatch(/\bas assigned for\b/i);
  expect(text).not.toMatch(/according to role requirements/i);
  expect(text).not.toMatch(/\b[A-Z][a-z]+\s+[A-Z][a-z]+s\s+installation\b/);
  expect(generationLooksRoleTitleEchoFillerOnly(text)).toBe(false);
  expect(textLooksRelevantToFreeTextTitle(text, position)).toBe(true);
  expect(detectExperienceGenerationUnsupportedClaims({
    candidateText: text,
    position,
  }).count).toBe(0);
  expect(validateExperienceGenerationOutput(text, {
    locale: 'en',
    position,
    isPresent: true,
  }).ok).toBe(true);
}

function buildCv(options?: {
  position?: string;
  isPresent?: boolean;
  extraEntries?: number;
}): { cv: CVData; exp: WorkExperience } {
  const position = options?.position || 'Solar Panel Installer';
  const isPresent = options?.isPresent !== false;
  const exp: WorkExperience = {
    id: 'exp-solar-369',
    company: 'SunCo',
    position,
    startDate: isPresent ? '2024-01' : '2020-01',
    endDate: isPresent ? '' : '2023-06',
    isPresent,
    description: '',
    canonicalDescription: '',
    originalUserDescription: '',
    generatedDescription: '',
    descriptionOrigin: 'user',
  };
  const extras: WorkExperience[] = [];
  for (let i = 0; i < (options?.extraEntries ?? 0); i += 1) {
    extras.push({
      id: `exp-other-${i}`,
      company: `OtherCo${i}`,
      position: `Other Role ${i}`,
      startDate: '2018-01',
      endDate: '2019-01',
      isPresent: false,
      description: `Performed core duties for Other Role ${i} at OtherCo${i}.`,
      descriptionOrigin: 'user',
    });
  }
  const experience = [exp, ...extras];
  if ((options?.extraEntries ?? 0) >= 5) {
    experience.splice(2, 0, experience.shift()!);
  }
  const cv: CVData = {
    id: 'cv-en-369',
    name: 'CV',
    personal: {
      fullName: 'Sam Solar',
      email: 's@example.com',
      phone: '',
      address: '',
      jobTitle: position,
      gender: 'male',
    },
    summary: '',
    experience,
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'US',
    contentLocale: 'en',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { cv, exp: experience.find((e) => e.id === exp.id)! };
}

function runGen(options: {
  usageBefore?: number;
  candidate: string;
  position?: string;
  isPresent?: boolean;
  extraEntries?: number;
}) {
  const usageBefore = options.usageBefore ?? 0;
  seedUsage(usageBefore);
  const { cv, exp } = buildCv({
    position: options.position,
    isPresent: options.isPresent,
    extraEntries: options.extraEntries,
  });
  const locale: Locale = 'en';
  const ctx = buildExperienceJobContext({
    position: exp.position,
    industry: 'general',
    locale,
    level: 'mid',
  });
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: '',
    canonicalText: '',
    originalText: '',
    locale,
    requestId: 'req-en-369',
    jobContextHash: ctx.key,
    experienceEntryId: exp.id,
  });
  const frozen = ensureExperienceAiSourceFrozen(exp);
  const grounding = resolveExperienceAiGrounding(frozen, ctx, freezeExperienceAiDescription);
  grounding.sourceDescription = '';
  grounding.experienceForAi = {
    ...grounding.experienceForAi,
    description: '',
    originalUserDescription: '',
    canonicalDescription: '',
  };
  const session = new ExperienceAiDiagnosticSession({
    uiLocale: locale,
    requestedLocale: locale,
    contentLocale: locale,
    templateId: 'modern-minimal',
    gender: 'male',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    jobContextHash: ctx.key,
    requestId: 'req-en-369',
    usageCountBefore: usageBefore,
  });
  session.recordLiveExperience(exp, Boolean(exp.isPresent));
  session.recordExperienceEntryTarget({
    experienceEntryId: exp.id,
    isPresent: Boolean(exp.isPresent),
    arrayIndexAtRequest: cv.experience.findIndex((e) => e.id === exp.id),
  });
  session.recordSourceSelection(
    { ...exp, description: '' },
    grounding,
    {
      requestedLocale: locale,
      selectedSourceKindHint: 'jobContext',
      operationalContentLocale: locale,
      generationSourceKind: 'jobContext',
      generatedDescriptionPreexisted: false,
      staleGeneratedDescriptionIgnored: false,
      factLockReason: 'generation_mode_empty_live',
    },
  );
  session.recordPayloadBuilt({
    locale,
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    isPresent: Boolean(exp.isPresent),
  });
  session.recordApiResponse({
    httpStatus: 200,
    fallbackUsed: false,
    resultText: options.candidate,
  });
  session.recordRaceCheck(true, undefined, ctx.key);

  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: locale,
    gender: 'male',
    cv: {
      ...cv,
      experience: cv.experience.map((e) => (e.id === exp.id ? grounding.experienceForAi : e)),
    },
    candidate: options.candidate,
    experienceId: exp.id,
    industry: 'general',
    level: 'mid',
    jobContext: ctx,
    operationSnapshot: snapshot,
    originHint: 'ai_generated',
  });
  session.recordFinalizeResult(finalized);

  let nextCv = cv;
  let usageAfter = usageBefore;
  if (finalized.countedAsSuccess && !finalized.blocked) {
    const preApplyGate = session.evaluatePreApplyDecisionGates();
    if (preApplyGate.passed) {
      nextCv = applyFinalizedBulletsToCv(cv, locale, exp.id, finalized, ctx);
      recordProAiUserActionSuccess();
      usageAfter = getProAiUsageCount();
      session.recordVisibleApply(true, usageAfter, {
        visibleDescription: nextCv.experience.find((e) => e.id === exp.id)?.description || '',
        finalNormalizedText: finalized.text,
      });
    } else {
      session.recordVisibleApply(false, usageBefore);
    }
  } else {
    session.recordVisibleApply(false, usageBefore);
  }
  session.commit();
  return { cv, exp, nextCv, finalized, usageBefore, usageAfter };
}

describe('AAB-369 English empty-source fallback surface quality', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
    seedUsage(0);
  });

  it('exposes surface-quality marker and keeps claim-safety marker', () => {
    expect(EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION)
      .toBe('experience-generation-fallback-surface-369-v1');
    expect(EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION)
      .toBe('experience-generation-claim-safety-366-v1');
  });

  it('exact Solar Panel Installer fallback is natural CV prose', () => {
    const fb = buildJobContextGenerationFallback({
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(fb).toMatch(/Installs solar panels as part of assigned installation work/i);
    expect(fb).toMatch(/Positions and secures panels during installation/i);
    expect(fb).toMatch(/Coordinates installation activities with colleagues/i);
    expect(fb).not.toMatch(/Solar Panels installation|for the Solar Panel Installer role/i);
    assertNaturalSurface(fb, 'Solar Panel Installer');
  });

  it('rejects title-echo filler provider and applies natural fallback once', () => {
    expect(generationLooksRoleTitleEchoFillerOnly(TITLE_ECHO_SOLAR)).toBe(true);
    expect(validateExperienceGenerationOutput(TITLE_ECHO_SOLAR, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    }).ok).toBe(false);
    const r = runGen({ candidate: TITLE_ECHO_SOLAR, usageBefore: 0 });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    assertNaturalSurface(r.finalized.text, 'Solar Panel Installer');
    expect(r.usageAfter).toBe(1);
  });

  it('compound action-based titles get lowercase varied object phrasing', () => {
    const cases: Array<{ position: string; expectRe: RegExp }> = [
      { position: 'Conveyor Belt Operator', expectRe: /Operates conveyor belts/i },
      { position: 'Network Traffic Analyst', expectRe: /Analyzes network traffic/i },
      { position: 'Fleet Route Coordinator', expectRe: /Coordinates fleet route/i },
      { position: 'Roof Membrane Technician', expectRe: /technical checks on roof membranes/i },
    ];
    for (const { position, expectRe } of cases) {
      const fb = buildJobContextGenerationFallback({
        locale: 'en',
        position,
        isPresent: true,
      });
      expect(fb, position).toMatch(expectRe);
      assertNaturalSurface(fb, position);
    }
  });

  it('opaque/unknown titles stay useful without role-title echo filler', () => {
    const position = 'Quantum Workflow Harmonizer';
    const fb = buildJobContextGenerationFallback({
      locale: 'en',
      position,
      isPresent: true,
    });
    expect(fb).toContain(position);
    expect(fb).toMatch(/Produces concrete outputs for Quantum Workflow Harmonizer work/i);
    assertNaturalSurface(fb, position);
  });

  it('current and past tense remain correct', () => {
    const present = buildJobContextGenerationFallback({
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    const past = buildJobContextGenerationFallback({
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: false,
    });
    expect(present).toMatch(/^•?\s*Installs\b/m);
    expect(past).toMatch(/^•?\s*Installed\b/m);
    expect(present).not.toMatch(/\bInstalled\b/);
    expect(past).not.toMatch(/\bInstalls\b/);
    assertNaturalSurface(present, 'Solar Panel Installer');
  });

  it('claim-safety still rejects unsafe Solar inventiveness then applies natural fallback', () => {
    const r = runGen({ candidate: UNSAFE_SOLAR, usageBefore: 2 });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    assertNaturalSurface(r.finalized.text, 'Solar Panel Installer');
    expect(r.finalized.text).not.toMatch(/residential|wiring|inverter|optimal performance/i);
    expect(r.usageAfter).toBe(3);
  });

  it('closed Experience past tense + 5+ entries without leakage', () => {
    const r = runGen({
      candidate: TITLE_ECHO_SOLAR,
      isPresent: false,
      extraEntries: 5,
      usageBefore: 1,
    });
    expect(r.cv.experience.length).toBeGreaterThanOrEqual(6);
    expect(r.finalized.text).toMatch(/^•?\s*Installed\b/m);
    expect(r.finalized.text).not.toMatch(/\bInstalls\b/);
    const target = r.nextCv.experience.find((e) => e.id === r.exp.id);
    expect(target?.description).toBe(r.finalized.text);
    for (const e of r.nextCv.experience) {
      if (e.id === r.exp.id) continue;
      const prior = r.cv.experience.find((x) => x.id === e.id);
      expect(e.description).toBe(prior?.description);
    }
    expect(r.usageAfter).toBe(2);
  });
});
