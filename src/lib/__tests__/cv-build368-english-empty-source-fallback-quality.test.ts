/**
 * @vitest-environment jsdom
 *
 * AAB-368 — English empty-source Experience fallback quality.
 * Reject tautological role/duties/tasks/activities shells; preserve complete
 * free-text title; emit 3 distinct action-grounded duties without inventing
 * tools/venues/standards/metrics/maintenance/outcomes.
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
  resolveExperienceAiOperationMode,
  validateExperienceGenerationOutput,
} from '@/lib/cv-experience-ai-operation-mode';
import {
  detectExperienceGenerationUnsupportedClaims,
  EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION,
} from '@/lib/cv-experience-unsupported-claims';
import {
  generationLooksTautologicalRoleShellOnly,
  textLooksRelevantToFreeTextTitle,
  EXPERIENCE_GENERATION_FALLBACK_QUALITY_368_REVISION,
  EXPERIENCE_GENERATION_RELEVANCE_367_REVISION,
} from '@/lib/cv-ai-operation-contract';
import {
  persistProAiRecord,
  recordProAiUserActionSuccess,
  getProAiUsageCount,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const TAUTOLOGICAL_SOLAR = formatExperienceBullets([
  'Performs day-to-day solar panel work duties as assigned.',
  'Completes assigned role tasks according to role needs.',
  'Coordinates with colleagues on shared role work activities.',
]);

const UNSAFE_SOLAR = formatExperienceBullets([
  'Installs solar panels on residential and commercial rooftops to manufacturer standards.',
  'Connects wiring and inverters while following electrical safety standards.',
  'Performs inspection and maintenance to ensure optimal performance and compliance.',
]);

const ADMIN_SOLAR = formatExperienceBullets([
  'Reviews day-to-day records related to solar panel installation and verifies data completeness.',
  'Updates work documentation and tracks open items according to role needs.',
  'Coordinates information sharing with colleagues to complete documentation on time.',
]);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function buildCv(options?: {
  position?: string;
  isPresent?: boolean;
  extraEntries?: number;
}): { cv: CVData; exp: WorkExperience; ctx: ReturnType<typeof buildExperienceJobContext> } {
  const position = options?.position || 'Solar Panel Installer';
  const isPresent = options?.isPresent !== false;
  const exp: WorkExperience = {
    id: 'exp-solar-368',
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
    id: 'cv-en-368',
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
  const ctx = buildExperienceJobContext({
    position,
    industry: 'general',
    locale: 'en' as Locale,
    level: 'mid',
  });
  return { cv, exp: experience.find((e) => e.id === exp.id)!, ctx };
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
  const { cv, exp, ctx } = buildCv({
    position: options.position,
    isPresent: options.isPresent,
    extraEntries: options.extraEntries,
  });
  const locale: Locale = 'en';
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: '',
    canonicalText: '',
    originalText: '',
    locale,
    requestId: 'req-en-368',
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
    requestId: 'req-en-368',
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
  session.recordExperienceEntryTarget({
    experienceEntryId: exp.id,
    isPresent: Boolean(exp.isPresent),
    arrayIndexAtRequest: cv.experience.findIndex((e) => e.id === exp.id),
  });

  let preApplyGate: ReturnType<ExperienceAiDiagnosticSession['evaluatePreApplyDecisionGates']> | null = null;
  let nextCv = cv;
  let usageAfter = usageBefore;
  if (finalized.countedAsSuccess && !finalized.blocked) {
    preApplyGate = session.evaluatePreApplyDecisionGates();
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
  return {
    cv,
    exp,
    nextCv,
    finalized,
    usageBefore,
    usageAfter,
    preApplyGate,
    operationMode: resolveExperienceAiOperationMode(''),
  };
}

function assertClaimSafe(text: string, position: string): void {
  expect(detectExperienceGenerationUnsupportedClaims({
    candidateText: text,
    position,
  }).count).toBe(0);
  expect(validateExperienceGenerationOutput(text, {
    locale: 'en',
    position,
    isPresent: true,
  }).ok).toBe(true);
  expect(text).not.toMatch(
    /residential|commercial|rooftop|wiring|inverter|manufacturer standards|electrical safety|optimal performance|ISO\s*\d+|Salesforce|Excel|day-to-day.{0,40}duties|assigned role tasks|shared role work activities/i,
  );
}

describe('AAB-368 English empty-source Experience fallback quality', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
    seedUsage(0);
  });

  it('exposes fallback-quality and prior revision markers', () => {
    expect(EXPERIENCE_GENERATION_FALLBACK_QUALITY_368_REVISION)
      .toBe('experience-generation-fallback-quality-368-v1');
    expect(EXPERIENCE_GENERATION_RELEVANCE_367_REVISION)
      .toBe('experience-generation-relevance-367-v1');
    expect(EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION)
      .toBe('experience-generation-claim-safety-366-v1');
  });

  it('exact Solar Panel Installer: tautological shell rejected; action fallback applies once', () => {
    expect(generationLooksTautologicalRoleShellOnly(TAUTOLOGICAL_SOLAR)).toBe(true);
    expect(textLooksRelevantToFreeTextTitle(TAUTOLOGICAL_SOLAR, 'Solar Panel Installer')).toBe(false);
    const v = validateExperienceGenerationOutput(TAUTOLOGICAL_SOLAR, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('experience_generation_not_relevant');

    const fb = buildJobContextGenerationFallback({
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    const bullets = splitExperienceBullets(fb);
    expect(bullets).toHaveLength(3);
    expect(fb).toMatch(/Solar Panel Installer/);
    expect(fb).toMatch(/Installs solar panels/i);
    expect(fb).toMatch(/Positions and secures/i);
    expect(fb).toMatch(/Coordinates with colleagues/i);
    assertClaimSafe(fb, 'Solar Panel Installer');

    const r = runGen({ candidate: TAUTOLOGICAL_SOLAR, usageBefore: 0 });
    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.text).toBe(fb);
    expect(r.usageAfter).toBe(1);
  });

  it('arbitrary action-based titles derive distinct core-action duties', () => {
    for (const position of [
      'Conveyor Belt Operator',
      'Network Traffic Analyst',
      'Fleet Route Coordinator',
    ]) {
      const fb = buildJobContextGenerationFallback({
        locale: 'en',
        position,
        isPresent: true,
      });
      expect(fb).toContain(position);
      expect(generationLooksTautologicalRoleShellOnly(fb)).toBe(false);
      assertClaimSafe(fb, position);
      expect(splitExperienceBullets(fb)).toHaveLength(3);
    }
  });

  it('opaque/unknown free-text titles preserve full title once with useful duties', () => {
    const position = 'Quantum Workflow Harmonizer';
    const fb = buildJobContextGenerationFallback({
      locale: 'en',
      position,
      isPresent: true,
    });
    expect(fb).toContain(position);
    expect(fb).toMatch(/Produces concrete outputs/i);
    expect(generationLooksTautologicalRoleShellOnly(fb)).toBe(false);
    const titleHits = splitExperienceBullets(fb)
      .filter((l) => l.includes(position)).length;
    expect(titleHits).toBe(1);
    assertClaimSafe(fb, position);
  });

  it('current and completed roles use matching tense', () => {
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
  });

  it('5+ Experience entries: no cross-entry leakage', () => {
    const r = runGen({
      candidate: ADMIN_SOLAR,
      extraEntries: 5,
      usageBefore: 1,
    });
    expect(r.cv.experience.length).toBeGreaterThanOrEqual(6);
    expect(r.finalized.countedAsSuccess).toBe(true);
    const target = r.nextCv.experience.find((e) => e.id === r.exp.id);
    expect(target?.description).toBe(r.finalized.text);
    expect(r.finalized.text).toMatch(/Installs solar panels/i);
    for (const e of r.nextCv.experience) {
      if (e.id === r.exp.id) continue;
      const prior = r.cv.experience.find((x) => x.id === e.id);
      expect(e.description).toBe(prior?.description);
    }
    expect(r.usageAfter).toBe(2);
  });

  it('claim-safety regressions remain closed for unsafe Solar inventiveness', () => {
    expect(validateExperienceGenerationOutput(UNSAFE_SOLAR, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    }).ok).toBe(false);
    const r = runGen({ candidate: UNSAFE_SOLAR, usageBefore: 3 });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    assertClaimSafe(r.finalized.text, 'Solar Panel Installer');
    expect(r.usageAfter).toBe(4);
  });

  it('weak tautological provider never applies as ai_generated', () => {
    const r = runGen({ candidate: TAUTOLOGICAL_SOLAR, usageBefore: 7 });
    expect(r.finalized.origin).not.toBe('ai_generated');
    expect(r.finalized.text).not.toBe(TAUTOLOGICAL_SOLAR);
    expect(r.finalized.text).not.toMatch(/assigned role tasks|shared role work activities/i);
    expect(r.usageAfter).toBe(8);
  });
});
