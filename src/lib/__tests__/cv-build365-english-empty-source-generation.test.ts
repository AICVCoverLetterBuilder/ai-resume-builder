/**
 * @vitest-environment jsdom
 *
 * AAB-365 — English Experience empty-source generate_from_job_context.
 * Provider bullets must apply when sourceFactCount=0; predicate source-coverage
 * is enhancement-only (not applicable), never vacuous true / null-with-applicable.
 *
 * Exact device regression: Solar Panel Installer / empty description / EN.
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
import { resolveExperienceAiOperationMode } from '@/lib/cv-experience-ai-operation-mode';
import {
  persistProAiRecord,
  recordProAiUserActionSuccess,
  getProAiUsageCount,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import {
  scanEnglishWarehousePredicates,
  sourceRequiresStrictEnglishWarehouseFactCoverage,
} from '@/lib/cv-english-experience-warehouse-grounding';
import { ENGLISH_EMPTY_SOURCE_GENERATION_365_REVISION } from '@/lib/cv-experience-phased-apply-329';
import type { Locale } from '@/lib/i18n/translations';

const SOLAR_PRESENT = formatExperienceBullets([
  'Installs solar panel arrays on residential and commercial roofs according to site plans.',
  'Checks mounting hardware, wiring connections, and system readiness before commissioning.',
  'Coordinates with site supervisors to complete safe installation stages on schedule.',
]);

const SOLAR_PAST = formatExperienceBullets([
  'Installed solar panel arrays on residential and commercial roofs according to site plans.',
  'Checked mounting hardware, wiring connections, and system readiness before commissioning.',
  'Coordinated with site supervisors to complete safe installation stages on schedule.',
]);

const UNSUPPORTED_CLAIMS = formatExperienceBullets([
  'Led a team of 40 and increased revenue by 65% for SunCo solar customers.',
  'Managed ISO 9001 certifications and won industry awards across markets.',
  'Closed enterprise contracts worth $12M using Salesforce and Excel dashboards.',
]);

const WAREHOUSE_ENHANCE_SOURCE = [
  'Inspects incoming merchandise upon arrival at the warehouse.',
  'Verifies documentation associated with received goods.',
  'Coordinates with colleagues on the preparation and movement of merchandise.',
].join('\n');

const WAREHOUSE_ENHANCE_CANDIDATE = formatExperienceBullets([
  'Inspects incoming merchandise upon arrival at the warehouse.',
  'Verifies documentation associated with received goods.',
  'Coordinates with colleagues on the preparation and movement of merchandise.',
]);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function buildEmptyEnCv(options?: {
  position?: string;
  isPresent?: boolean;
  extraEntries?: number;
  targetId?: string;
}): { cv: CVData; exp: WorkExperience; ctx: ReturnType<typeof buildExperienceJobContext> } {
  const position = options?.position || 'Solar Panel Installer';
  const targetId = options?.targetId || 'exp-solar';
  const isPresent = options?.isPresent !== false;
  const exp: WorkExperience = {
    id: targetId,
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
  const n = Math.max(0, options?.extraEntries ?? 0);
  for (let i = 0; i < n; i += 1) {
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
  // Stable targeting: put target not only at index 0 when extras exist.
  if (n >= 5) {
    experience.splice(2, 0, experience.shift()!);
  }
  const cv: CVData = {
    id: 'cv-en-empty-365',
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
  return { cv, exp: experience.find((e) => e.id === targetId)!, ctx };
}

function runEmptyEnGeneration(options: {
  usageBefore?: number;
  candidate?: string;
  position?: string;
  isPresent?: boolean;
  originHint?: 'ai_generated' | 'deterministic_fallback';
  extraEntries?: number;
  expectApply?: boolean;
}) {
  const usageBefore = options.usageBefore ?? 0;
  seedUsage(usageBefore);
  const { cv, exp, ctx } = buildEmptyEnCv({
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
    requestId: 'req-en-empty-365',
    jobContextHash: ctx.key,
    experienceEntryId: exp.id,
  });
  const operationMode = resolveExperienceAiOperationMode(snapshot.normalizedSourceText);
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
    gender: cv.personal.gender || '',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    jobContextHash: ctx.key,
    requestId: 'req-en-empty-365',
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

  const candidate = options.candidate ?? SOLAR_PRESENT;
  session.recordApiResponse({
    httpStatus: 200,
    fallbackUsed: options.originHint === 'deterministic_fallback',
    resultText: candidate,
  });
  session.recordRaceCheck(true, undefined, ctx.key);

  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: locale,
    gender: cv.personal.gender || '',
    cv: { ...cv, experience: cv.experience.map((e) => (
      e.id === exp.id ? grounding.experienceForAi : e
    )) },
    candidate,
    experienceId: exp.id,
    industry: 'general',
    level: 'mid',
    jobContext: ctx,
    operationSnapshot: snapshot,
    originHint: options.originHint ?? 'ai_generated',
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
    if (preApplyGate.passed && options.expectApply !== false) {
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
    operationMode,
    snapshot,
    usageBefore,
    usageAfter,
    preApplyGate,
    trace,
    session,
  };
}

describe('AAB-365 English empty-source Experience generation', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
    seedUsage(0);
  });

  it('exposes english-empty-source-generation-365-v1 marker', () => {
    expect(ENGLISH_EMPTY_SOURCE_GENERATION_365_REVISION)
      .toBe('english-empty-source-generation-365-v1');
  });

  it('Solar Panel Installer: valid present-tense provider applies once; usage 0→1', () => {
    const r = runEmptyEnGeneration({
      usageBefore: 0,
      candidate: SOLAR_PRESENT,
      isPresent: true,
    });
    expect(r.operationMode).toBe('generate_from_job_context');
    expect(r.snapshot.sourceUnitCount).toBe(0);
    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.diagnostics?.sourceWasEmpty).toBe(true);
    expect(r.finalized.diagnostics?.operationMode).toBe('generate_from_job_context');
    expect(r.finalized.diagnostics?.requiredFactCount).toBe(0);
    expect(r.finalized.diagnostics?.coveredFactCount).toBe(0);
    expect(r.finalized.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(r.finalized.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(false);
    expect(r.finalized.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBeNull();
    expect(r.finalized.diagnostics?.finalCandidateSource).toBe('provider');
    expect(r.finalized.diagnostics?.providerAccepted).toBe(true);
    expect(r.finalized.diagnostics?.finalDecisionKind).toBe('material_improvement');
    expect(
      (r.finalized.diagnostics as Record<string, unknown> | undefined)
        ?.englishEmptySourceGenerationRevision,
    ).toBe(ENGLISH_EMPTY_SOURCE_GENERATION_365_REVISION);
    expect(r.preApplyGate?.passed).toBe(true);
    expect(
      (r.trace.diagnosticInvariantFailures || []).some(
        (f) => f.invariantCode === 'final_predicate_coverage_vacuous_or_null',
      ),
    ).toBe(false);
    expect(
      (r.session.draft.preapplyDiagnosticInvariantFailures || []).some(
        (f) => f.invariantCode === 'final_predicate_coverage_vacuous_or_null',
      ),
    ).toBe(false);
    expect(splitExperienceBullets(r.finalized.text)).toHaveLength(3);
    const applied = r.nextCv.experience.find((e) => e.id === r.exp.id);
    expect(applied?.description).toBe(r.finalized.text);
    expect(r.usageBefore).toBe(0);
    expect(r.usageAfter).toBe(1);
  });

  it('empty-source arbitrary occupation (Beekeeper) applies with predicate N/A', () => {
    const r = runEmptyEnGeneration({
      position: 'Beekeeper',
      candidate: formatExperienceBullets([
        'Inspects hive health and monitors bee colony conditions across apiary sites.',
        'Harvests honey and prepares bee products according to seasonal schedules.',
        'Maintains protective equipment and apiary tools ready for daily field work.',
      ]),
    });
    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(false);
    expect(r.finalized.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBeNull();
    expect(r.preApplyGate?.passed).toBe(true);
    expect(r.usageAfter).toBe(1);
  });

  it('current vs past tense empty-source generation both apply', () => {
    const present = runEmptyEnGeneration({
      usageBefore: 0,
      candidate: SOLAR_PRESENT,
      isPresent: true,
    });
    expect(present.finalized.countedAsSuccess).toBe(true);
    expect(present.preApplyGate?.passed).toBe(true);

    const past = runEmptyEnGeneration({
      usageBefore: 0,
      candidate: SOLAR_PAST,
      isPresent: false,
    });
    expect(past.finalized.countedAsSuccess).toBe(true);
    expect(past.preApplyGate?.passed).toBe(true);
    expect(past.usageAfter).toBe(1);
  });

  it('unsupported claims do not apply; text and usage preserved', () => {
    const { cv, exp } = buildEmptyEnCv();
    seedUsage(4);
    const beforeText = exp.description || '';
    const r = runEmptyEnGeneration({
      usageBefore: 4,
      candidate: UNSUPPORTED_CLAIMS,
      expectApply: false,
    });
    // May be blocked by generation validation or fail preapply — must not mutate.
    if (r.finalized.blocked || !r.finalized.countedAsSuccess || !r.preApplyGate?.passed) {
      expect(r.usageAfter).toBe(4);
      const preserved = r.nextCv.experience.find((e) => e.id === exp.id);
      expect(preserved?.description ?? '').toBe(beforeText);
      expect(cv.experience.find((e) => e.id === exp.id)?.description ?? '').toBe(beforeText);
    } else {
      // If somehow accepted, still must not fake predicate coverage true.
      expect(r.finalized.diagnostics?.finalSourceUnitPredicateCoveragePassed).not.toBe(true);
    }
  });

  it('stable entry targeting with 5+ Experience entries', () => {
    const r = runEmptyEnGeneration({
      extraEntries: 5,
      candidate: SOLAR_PRESENT,
    });
    expect(r.cv.experience.length).toBeGreaterThanOrEqual(6);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.preApplyGate?.passed).toBe(true);
    const target = r.nextCv.experience.find((e) => e.id === r.exp.id);
    expect(target?.description).toBe(r.finalized.text);
    // Other entries unchanged.
    for (const e of r.nextCv.experience) {
      if (e.id === r.exp.id) continue;
      const prior = r.cv.experience.find((x) => x.id === e.id);
      expect(e.description).toBe(prior?.description);
    }
    expect(r.trace.selectedExperienceEntryIdHash || r.trace.clickedExperienceEntryIdHash)
      .toBeTruthy();
  });

  it('non-empty English warehouse enhancement keeps predicate coverage applicable', () => {
    seedUsage(0);
    expect(sourceRequiresStrictEnglishWarehouseFactCoverage(WAREHOUSE_ENHANCE_SOURCE)).toBe(true);
    const pred = scanEnglishWarehousePredicates(
      WAREHOUSE_ENHANCE_SOURCE,
      WAREHOUSE_ENHANCE_CANDIDATE,
    );
    expect(pred.sourcePredicateIdentityCount).toBeGreaterThan(0);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);

    const exp: WorkExperience = {
      id: 'exp-wh',
      company: 'Atlas',
      position: 'Warehouse Employee',
      startDate: '2023-01',
      endDate: '',
      isPresent: true,
      description: WAREHOUSE_ENHANCE_SOURCE,
      originalUserDescription: WAREHOUSE_ENHANCE_SOURCE,
      canonicalDescription: WAREHOUSE_ENHANCE_SOURCE,
      descriptionOrigin: 'user',
    };
    const cv: CVData = {
      id: 'cv-wh',
      name: 'CV',
      personal: {
        fullName: 'Ana',
        email: 'a@e.com',
        phone: '',
        address: '',
        jobTitle: 'Warehouse Employee',
        gender: 'female',
      },
      summary: '',
      experience: [exp],
      education: [],
      skills: [],
      languages: [],
      certifications: [],
      templateId: 'modern-minimal',
      contentLocale: 'en',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const snap = createExperienceAiOperationSnapshot({
      liveText: WAREHOUSE_ENHANCE_SOURCE,
      locale: 'en',
      requestId: 'req-wh-365',
      jobContextHash: 'job-wh',
      experienceEntryId: 'exp-wh',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: WAREHOUSE_ENHANCE_CANDIDATE,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      operationSnapshot: snap,
      originHint: 'ai_generated',
    });
    // Enhancement may no-op on identical text — either way predicate applicability
    // must not collapse to the empty-source not-applicable path for warehouse source.
    if (fin.countedAsSuccess) {
      expect(fin.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(true);
      expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    } else {
      // No-op / reject on identical enhance is acceptable; scanner path stays enhancement.
      expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    }
  });
});
