/**
 * @vitest-environment jsdom
 *
 * AAB-367 — English empty-source generation relevance for free-text roles.
 * Generic administrative/documentation shells must not pass relevance for
 * non-documentation occupations (exact device: Solar Panel Installer).
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
  generationLooksGenericAdministrativeOnly,
  textLooksRelevantToFreeTextTitle,
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

/** Exact failing device server-fallback shell. */
const SOLAR_ADMIN_SERVER_FALLBACK = formatExperienceBullets([
  'Reviews day-to-day records related to solar panel installation and verifies data completeness.',
  'Updates work documentation and tracks open items according to role needs.',
  'Coordinates information sharing with colleagues to complete documentation on time.',
]);

const UNRELATED_CAFE = formatExperienceBullets([
  'Brews espresso drinks and manages cafe inventory each shift.',
  'Greets cafe guests and processes counter payments accurately.',
  'Cleans cafe equipment and restocks pastry displays before close.',
]);

const UNSAFE_SOLAR = formatExperienceBullets([
  'Installs solar panels on residential and commercial rooftops to manufacturer standards.',
  'Connects wiring and inverters while following electrical safety standards.',
  'Performs inspection and maintenance to ensure optimal performance and compliance.',
]);

const ROLE_RELEVANT_SOLAR = formatExperienceBullets([
  'Installs solar panels as part of assigned installation work.',
  'Positions and secures panels during installation.',
  'Coordinates installation activities with colleagues.',
]);

const TAUTOLOGICAL_SOLAR = formatExperienceBullets([
  'Performs day-to-day solar panel work duties as assigned.',
  'Completes assigned role tasks according to role needs.',
  'Coordinates with colleagues on shared role work activities.',
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
    id: 'exp-solar-367',
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
    id: 'cv-en-367',
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
    requestId: 'req-en-367',
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
    requestId: 'req-en-367',
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
  const trace = session.commit();
  return {
    cv,
    exp,
    nextCv,
    finalized,
    preApplyGate,
    usageBefore,
    usageAfter,
    snapshot,
    trace,
  };
}

describe('AAB-367 English empty-source generation relevance', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
    seedUsage(0);
  });

  it('exposes experience-generation-relevance-367-v1 marker', () => {
    expect(EXPERIENCE_GENERATION_RELEVANCE_367_REVISION)
      .toBe('experience-generation-relevance-367-v1');
  });

  it('keeps claim-safety marker and rejects unsafe Solar inventiveness', () => {
    expect(EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION)
      .toBe('experience-generation-claim-safety-366-v1');
    expect(detectExperienceGenerationUnsupportedClaims({
      candidateText: UNSAFE_SOLAR,
      position: 'Solar Panel Installer',
    }).count).toBeGreaterThan(0);
  });

  it('exact Solar admin shell fails relevance and is classified administrative', () => {
    expect(generationLooksGenericAdministrativeOnly(SOLAR_ADMIN_SERVER_FALLBACK)).toBe(true);
    expect(textLooksRelevantToFreeTextTitle(
      SOLAR_ADMIN_SERVER_FALLBACK,
      'Solar Panel Installer',
    )).toBe(false);
    const v = validateExperienceGenerationOutput(SOLAR_ADMIN_SERVER_FALLBACK, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(v.ok).toBe(false);
    expect(v.relevanceValidationPassed).toBe(false);
    expect(v.reason).toBe('experience_generation_not_relevant');
  });

  it('exact Solar admin server-fallback → role-relevant fallback; usage 2→3', () => {
    const r = runGen({
      usageBefore: 2,
      candidate: SOLAR_ADMIN_SERVER_FALLBACK,
      isPresent: true,
    });
    expect(resolveExperienceAiOperationMode('')).toBe('generate_from_job_context');
    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(true);
    expect(r.preApplyGate?.passed).toBe(true);
    expect(splitExperienceBullets(r.finalized.text)).toHaveLength(3);
    expect(r.finalized.text).toMatch(/Installs solar panels|Solar Panel Installer/i);
    expect(r.finalized.text).not.toMatch(/work documentation|information sharing|data completeness|residential|wiring|day-to-day|assigned role tasks|shared role work activities/i);
    expect(r.nextCv.experience.find((e) => e.id === r.exp.id)?.description).toBe(r.finalized.text);
    expect(r.usageBefore).toBe(2);
    expect(r.usageAfter).toBe(3);
  });

  it('unrelated-role cafe duties reject; Solar role-relevant fallback applies once', () => {
    const v = validateExperienceGenerationOutput(UNRELATED_CAFE, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(v.ok).toBe(false);
    expect(v.relevanceValidationPassed).toBe(false);
    const r = runGen({ candidate: UNRELATED_CAFE, usageBefore: 0 });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.text).toMatch(/Installs solar panels|Solar Panel Installer/i);
    expect(r.finalized.text).not.toMatch(/cafe|espresso|pastry|day-to-day|assigned role tasks/i);
    expect(r.usageAfter).toBe(1);
  });

  it('unknown free-text occupation builds role-relevant fallback', () => {
    const fb = buildJobContextGenerationFallback({
      locale: 'en',
      position: 'Nebula Ops Liaison',
      industry: 'general',
      isPresent: true,
      gender: 'male',
    });
    expect(fb).toMatch(/nebula ops/i);
    expect(fb).not.toMatch(/for the .+ role|according to role requirements/i);
    expect(validateExperienceGenerationOutput(fb, {
      locale: 'en',
      position: 'Nebula Ops Liaison',
      isPresent: true,
    }).ok).toBe(true);
    const r = runGen({
      position: 'Nebula Ops Liaison',
      candidate: UNSAFE_SOLAR,
    });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.text).toMatch(/nebula ops/i);
    expect(r.usageAfter).toBe(1);
  });

  it('current and past tense role-relevant fallbacks', () => {
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
    expect(validateExperienceGenerationOutput(present, {
      locale: 'en', position: 'Solar Panel Installer', isPresent: true,
    }).ok).toBe(true);
    expect(validateExperienceGenerationOutput(past, {
      locale: 'en', position: 'Solar Panel Installer', isPresent: false,
    }).ok).toBe(true);
  });

  it('unsupported claims stay rejected; role-relevant fallback applies once', () => {
    const r = runGen({ candidate: UNSAFE_SOLAR, usageBefore: 4 });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.text).not.toMatch(/residential|wiring|inverter|optimal performance|day-to-day|assigned role tasks/i);
    expect(r.finalized.text).toMatch(/Installs solar panels|Solar Panel Installer/i);
    expect(r.usageAfter).toBe(5);
  });

  it('valid role-relevant provider applies once without fallback', () => {
    const r = runGen({ candidate: ROLE_RELEVANT_SOLAR, usageBefore: 0 });
    expect(r.finalized.origin).toBe('ai_generated');
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(false);
    expect(r.finalized.text).toBe(ROLE_RELEVANT_SOLAR);
    expect(r.usageAfter).toBe(1);
  });

  it('closed Experience (past) uses past-tense role-relevant fallback', () => {
    const r = runGen({
      candidate: SOLAR_ADMIN_SERVER_FALLBACK,
      isPresent: false,
      usageBefore: 1,
    });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.text).toMatch(/^•?\s*Installed\b/m);
    expect(r.finalized.text).not.toMatch(/\bInstalls\b/);
    expect(r.usageAfter).toBe(2);
  });

  it('tautological role/duties/tasks shell is rejected and replaced by action fallback', () => {
    expect(textLooksRelevantToFreeTextTitle(
      TAUTOLOGICAL_SOLAR,
      'Solar Panel Installer',
    )).toBe(false);
    const v = validateExperienceGenerationOutput(TAUTOLOGICAL_SOLAR, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('experience_generation_not_relevant');
    const r = runGen({ candidate: TAUTOLOGICAL_SOLAR, usageBefore: 0 });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.text).toMatch(/Installs solar panels/i);
    expect(r.finalized.text).not.toMatch(/day-to-day|assigned role tasks|shared role work activities/i);
    expect(r.usageAfter).toBe(1);
  });

  it('documentation occupation may keep administrative shell', () => {
    const admin = formatExperienceBullets([
      'Reviews day-to-day records related to office administration and verifies data completeness.',
      'Updates work documentation and tracks open items according to role needs.',
      'Coordinates information sharing with colleagues to complete documentation on time.',
    ]);
    expect(validateExperienceGenerationOutput(admin, {
      locale: 'en',
      position: 'Office Administrator',
      isPresent: true,
    }).ok).toBe(true);
  });

  it('no cross-entry leakage with many Experience entries', () => {
    const r = runGen({
      candidate: SOLAR_ADMIN_SERVER_FALLBACK,
      extraEntries: 5,
    });
    expect(r.cv.experience.length).toBeGreaterThanOrEqual(6);
    expect(r.finalized.countedAsSuccess).toBe(true);
    const target = r.nextCv.experience.find((e) => e.id === r.exp.id);
    expect(target?.description).toBe(r.finalized.text);
    for (const e of r.nextCv.experience) {
      if (e.id === r.exp.id) continue;
      const prior = r.cv.experience.find((x) => x.id === e.id);
      expect(e.description).toBe(prior?.description);
    }
  });
});
