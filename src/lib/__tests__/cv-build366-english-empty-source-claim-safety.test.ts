/**
 * @vitest-environment jsdom
 *
 * AAB-366 — English empty-source generation claim safety.
 * generate_from_job_context must reject invented environments/tools/standards/
 * maintenance/outcomes; then deterministic fallback applies once (usage +1).
 *
 * Exact device regression: Solar Panel Installer unsupported provider claims.
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
  persistProAiRecord,
  recordProAiUserActionSuccess,
  getProAiUsageCount,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

/** Exact failing device-style provider inventiveness. */
const SOLAR_UNSAFE_DEVICE = formatExperienceBullets([
  'Installs solar panels on residential and commercial rooftops to manufacturer standards.',
  'Connects wiring and inverters while following electrical safety standards.',
  'Performs inspection and maintenance to ensure optimal performance and compliance.',
]);

const SOLAR_UNSAFE_SCOPE_TOOLS = formatExperienceBullets([
  'Installs solar panel arrays on residential and commercial roofs according to site plans.',
  'Checks mounting hardware, wiring connections, and system readiness before commissioning.',
  'Coordinates with site supervisors to complete safe installation stages on schedule.',
]);

const SAFE_GENERIC_SOLAR = formatExperienceBullets([
  'Reviews day-to-day records related to solar panel installation and verifies data completeness.',
  'Updates work documentation and tracks open items according to role needs.',
  'Coordinates information sharing with colleagues to complete documentation on time.',
]);

const SAFE_BEEKEEPER = formatExperienceBullets([
  'Reviews day-to-day records related to beekeeping work and verifies data completeness.',
  'Updates work documentation and tracks open items according to role needs.',
  'Coordinates information sharing with colleagues to complete documentation on time.',
]);

const OUTCOME_METRICS = formatExperienceBullets([
  'Led a team of 40 and increased revenue by 65% for solar customers.',
  'Managed ISO 9001 certifications and won industry awards across markets.',
  'Closed enterprise contracts worth $12M using Salesforce and Excel dashboards.',
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
    id: 'exp-solar-366',
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
    id: 'cv-en-366',
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
    requestId: 'req-en-366',
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
    requestId: 'req-en-366',
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

describe('AAB-366 English empty-source generation claim safety', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
    seedUsage(0);
  });

  it('exposes experience-generation-claim-safety-366-v1 marker', () => {
    expect(EXPERIENCE_GENERATION_CLAIM_SAFETY_366_REVISION)
      .toBe('experience-generation-claim-safety-366-v1');
  });

  it('rejects exact Solar Panel Installer unsupported device claims', () => {
    const scan = detectExperienceGenerationUnsupportedClaims({
      candidateText: SOLAR_UNSAFE_DEVICE,
      position: 'Solar Panel Installer',
    });
    expect(scan.count).toBeGreaterThan(0);
    expect(scan.scopeExpansionDetected || scan.kinds.length > 0).toBe(true);
    expect(validateExperienceGenerationOutput(SOLAR_UNSAFE_DEVICE, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    }).ok).toBe(false);
    expect(validateExperienceGenerationOutput(SOLAR_UNSAFE_DEVICE, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    }).reason).toBe('experience_generation_unsafe_claims');
  });

  it('Solar unsafe provider → safe fallback applies once; usage 0→1', () => {
    const r = runGen({ usageBefore: 0, candidate: SOLAR_UNSAFE_DEVICE, isPresent: true });
    expect(resolveExperienceAiOperationMode('')).toBe('generate_from_job_context');
    expect(r.snapshot.sourceUnitCount).toBe(0);
    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(true);
    expect(r.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(r.finalized.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(false);
    expect(r.finalized.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBeNull();
    expect(r.preApplyGate?.passed).toBe(true);
    const text = r.finalized.text;
    expect(splitExperienceBullets(text)).toHaveLength(3);
    expect(text).not.toMatch(/residential|commercial|rooftop|wiring|inverter|electrical safety|optimal performance/i);
    expect(text).toMatch(/Reviews|Updates|Coordinates/);
    expect(r.nextCv.experience.find((e) => e.id === r.exp.id)?.description).toBe(text);
    expect(r.usageBefore).toBe(0);
    expect(r.usageAfter).toBe(1);
  });

  it('rejects unsupported scope/tools/standards/outcomes variants', () => {
    for (const candidate of [SOLAR_UNSAFE_SCOPE_TOOLS, OUTCOME_METRICS]) {
      expect(validateExperienceGenerationOutput(candidate, {
        locale: 'en',
        position: 'Solar Panel Installer',
        isPresent: true,
      }).ok, candidate.slice(0, 40)).toBe(false);
      const r = runGen({ candidate, usageBefore: 0 });
      expect(r.finalized.countedAsSuccess).toBe(true);
      expect(r.finalized.origin).toBe('deterministic_fallback');
      expect(r.usageAfter).toBe(1);
      expect(r.finalized.text).not.toMatch(/wiring|inverter|Salesforce|Excel|ISO 9001|residential/i);
    }
  });

  it('safe arbitrary occupation generation applies as provider', () => {
    const r = runGen({
      position: 'Beekeeper',
      candidate: SAFE_BEEKEEPER,
    });
    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.origin).toBe('ai_generated');
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(false);
    expect(r.finalized.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(false);
    expect(r.usageAfter).toBe(1);
  });

  it('safe Solar generic duties apply without inventing rooftops/wiring', () => {
    expect(validateExperienceGenerationOutput(SAFE_GENERIC_SOLAR, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    }).ok).toBe(true);
    const r = runGen({ candidate: SAFE_GENERIC_SOLAR });
    expect(r.finalized.origin).toBe('ai_generated');
    expect(r.finalized.text).toBe(SAFE_GENERIC_SOLAR);
    expect(r.usageAfter).toBe(1);
  });

  it('current and past tense fallbacks remain tense-correct after unsafe reject', () => {
    const present = runGen({
      candidate: SOLAR_UNSAFE_DEVICE,
      isPresent: true,
    });
    expect(present.finalized.text).toMatch(/^•?\s*Reviews/m);
    expect(present.finalized.text).not.toMatch(/\bReviewed\b/);

    const past = runGen({
      candidate: SOLAR_UNSAFE_DEVICE,
      isPresent: false,
    });
    expect(past.finalized.text).toMatch(/^•?\s*Reviewed/m);
    expect(past.finalized.text).not.toMatch(/\bReviews\b/);
    expect(past.usageAfter).toBe(1);
  });

  it('no cross-entry leakage with 5+ Experience entries', () => {
    const r = runGen({
      candidate: SOLAR_UNSAFE_DEVICE,
      extraEntries: 5,
    });
    expect(r.cv.experience.length).toBeGreaterThanOrEqual(6);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.preApplyGate?.passed).toBe(true);
    const target = r.nextCv.experience.find((e) => e.id === r.exp.id);
    expect(target?.description).toBe(r.finalized.text);
    for (const e of r.nextCv.experience) {
      if (e.id === r.exp.id) continue;
      const prior = r.cv.experience.find((x) => x.id === e.id);
      expect(e.description).toBe(prior?.description);
    }
  });

  it('deterministic fallback itself validates as safe generation output', () => {
    const fb = buildJobContextGenerationFallback({
      locale: 'en',
      gender: 'male',
      position: 'Solar Panel Installer',
      industry: 'general',
      isPresent: true,
    });
    const v = validateExperienceGenerationOutput(fb, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(v.ok).toBe(true);
    expect(v.unsupportedClaimCount).toBe(0);
    expect(detectExperienceGenerationUnsupportedClaims({
      candidateText: fb,
      position: 'Solar Panel Installer',
    }).count).toBe(0);
  });
});
