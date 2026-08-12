/**
 * @vitest-environment jsdom
 *
 * Build 268 — empty Experience Description with stale generatedDescription metadata.
 *
 * Real device failure (versionCode 268, sr, female, construction/mid, modern-minimal):
 * - operationMode correctly generate_from_job_context / sourceWasEmpty true
 * - but selectedSourceKind=generatedDescription, payload 179 chars / 3 duties,
 *   factLockEnabled true → missing_canonical_duty reject → empty generation fallback
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildJobContextGenerationFallback,
  resolveExperienceAiOperationMode,
  validateExperienceGenerationOutput,
} from '@/lib/cv-experience-ai-operation-mode';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceJobContext,
  resolveExperienceAiGrounding,
} from '@/lib/cv-experience-job-context';
import {
  freezeExperienceAiDescription,
  ensureExperienceAiSourceFrozen,
} from '@/lib/cv-canonical-facts';
import { resolveExperienceAiAuthoritativeSource } from '@/lib/cv-experience-provenance';
import { ExperienceAiDiagnosticSession } from '@/lib/cv-experience-ai-diagnostics';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { extractPdfUnicodeText } from '@/lib/pdf-text-extract';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { validateSourceFactIdentityCoverage } from '@/lib/cv-source-fact-identity';
import { AI_SUPPORTED_LOCALES } from '@/lib/cv-ai-operation-contract';
import type { Locale } from '@/lib/i18n/translations';

const TITLE = 'Koordinator terenske dokumentacije';

/** Stale prior AI duties (~179 chars) that must NOT become generation source. */
const STALE_GENERATED = formatExperienceBullets([
  'Obavlja svakodnevne zadatke u ulozi Koordinator terenske dokumentacije uz proveru tačnosti podataka.',
  'Ažurira evidenciju i prati status stavki vezanih za rad kao Koordinator terenske dokumentacije.',
  'Koordiniše razmenu informacija sa kolegama radi blagovremenog zatvaranja zadataka.',
]);

const SAFE_PROVIDER_SR = formatExperienceBullets([
  'Pregleda pristiglu terensku dokumentaciju i proverava potpunost podataka.',
  'Ažurira evidenciju statusa dokumentacije prema potrebama radnog mesta.',
  'Koordiniše razmenu informacija sa kolegama radi pravovremenog kompletiranja dokumentacije.',
]);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function build268Fixture(overrides?: {
  locale?: Locale;
  industry?: string;
  level?: string;
  gender?: string;
  position?: string;
  isPresent?: boolean;
}): {
  cv: CVData;
  exp: WorkExperience;
  ctx: ReturnType<typeof buildExperienceJobContext>;
  locale: Locale;
} {
  const locale = (overrides?.locale || 'sr') as Locale;
  const exp: WorkExperience = {
    id: 'exp-268',
    company: 'Atlas',
    position: overrides?.position || TITLE,
    startDate: '2025-03',
    endDate: '',
    isPresent: overrides?.isPresent !== false,
    description: '',
    canonicalDescription: STALE_GENERATED,
    originalUserDescription: '',
    generatedDescription: STALE_GENERATED,
    descriptionOrigin: 'ai_generated',
  };
  const cv: CVData = {
    id: 'cv-268',
    name: 'CV',
    personal: {
      fullName: 'Ana Anić',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: exp.position,
      gender: overrides?.gender ?? 'female',
    },
    summary: '',
    experience: [exp],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    contentLocale: locale,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const ctx = buildExperienceJobContext({
    position: exp.position,
    industry: overrides?.industry ?? 'construction',
    locale,
    level: overrides?.level ?? 'mid',
  });
  return { cv, exp, ctx, locale };
}

function runExactBuild268(options?: {
  usageBefore?: number;
  candidate?: string;
  originHint?: 'ai_generated' | 'ai_repaired' | 'deterministic_fallback';
  locale?: Locale;
  position?: string;
  industry?: string;
  gender?: string;
  isPresent?: boolean;
}) {
  const usageBefore = options?.usageBefore ?? 18;
  seedUsage(usageBefore);
  const { cv, exp, ctx, locale } = build268Fixture({
    locale: options?.locale,
    position: options?.position,
    industry: options?.industry,
    gender: options?.gender,
    isPresent: options?.isPresent,
  });

  const liveDescription = '';
  const authoritative = resolveExperienceAiAuthoritativeSource({
    ...exp,
    description: liveDescription,
  });
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: liveDescription,
    canonicalText: exp.canonicalDescription || '',
    originalText: exp.originalUserDescription || '',
    locale,
    requestId: 'req-268-exact',
    jobContextHash: ctx.key,
  });
  const operationMode = resolveExperienceAiOperationMode(snapshot.normalizedSourceText);
  const frozen = ensureExperienceAiSourceFrozen(exp);
  const grounding = resolveExperienceAiGrounding(frozen, ctx, freezeExperienceAiDescription);
  // Mirror page: generation mode forces empty payload source.
  grounding.sourceDescription = '';
  grounding.experienceForAi = {
    ...authoritative.experienceForAi,
    description: '',
    originalUserDescription: '',
    canonicalDescription: '',
    generatedDescription: '',
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
    requestId: 'req-268-exact',
    usageCountBefore: usageBefore,
  });
  session.stage('button_pressed', 'ok');
  session.recordLiveExperience(exp, Boolean(exp.isPresent));
  session.recordSourceSelection(
    { ...exp, description: liveDescription },
    grounding,
    {
      requestedLocale: locale,
      selectedSourceKindHint: 'jobContext',
      operationalContentLocale: locale,
      generationSourceKind: 'jobContext',
      generatedDescriptionPreexisted: true,
      staleGeneratedDescriptionIgnored: true,
      factLockReason: 'generation_mode_empty_live',
    },
  );
  session.recordPayloadBuilt({
    locale,
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    isPresent: Boolean(exp.isPresent),
  });

  const candidate = options?.candidate
    ?? (options?.originHint === 'deterministic_fallback'
      ? buildJobContextGenerationFallback({
        locale,
        gender: cv.personal.gender || '',
        position: exp.position,
        industry: ctx.industryNorm,
        isPresent: Boolean(exp.isPresent),
      })
      : SAFE_PROVIDER_SR);

  session.recordApiResponse({
    httpStatus: 200,
    fallbackUsed: options?.originHint === 'deterministic_fallback',
    resultText: candidate,
  });
  session.recordRaceCheck(true, undefined, ctx.key);

  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: locale,
    gender: cv.personal.gender || '',
    cv: { ...cv, experience: [grounding.experienceForAi] },
    candidate,
    experienceId: exp.id,
    industry: options?.industry ?? 'construction',
    level: 'mid',
    jobContext: ctx,
    operationSnapshot: snapshot,
    originHint: options?.originHint ?? 'ai_generated',
  });
  session.recordFinalizeResult(finalized);

  let nextCv = cv;
  let usageAfter = usageBefore;
  if (finalized.countedAsSuccess && !finalized.blocked) {
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    nextCv = applyFinalizedBulletsToCv(cv, locale, exp.id, finalized, ctx);
    session.patch({
      visibleRequiredFactCount: finalized.diagnostics?.finalRequiredFactCount ?? 0,
      visibleCoveredFactCount: finalized.diagnostics?.finalCoveredFactCount ?? 0,
      visibleUncoveredFactIdentityHashes: [],
      visibleFactCoveragePassed: true,
      visibleRequiredPredicateCount: finalized.diagnostics?.sourcePredicateIdentityCount ?? 0,
      visibleCoveredPredicateCount:
        finalized.diagnostics?.finalCandidatePredicateIdentityCount ?? 0,
      visiblePredicateCoveragePassed: true,
      visibleNormalizedHash: finalized.diagnostics?.finalNormalizedHash,
      visibleLocaleValidationPassed: true,
      visibleTenseValidationPassed: finalized.diagnostics?.tenseValidationPassed !== false,
    });
    recordProAiUserActionSuccess();
    usageAfter = getProAiUsageCount();
    session.recordVisibleApply(true, usageAfter, {
      visibleDescription: nextCv.experience[0].description || '',
      finalNormalizedText: finalized.text,
    });
  } else {
    session.recordVisibleApply(false, usageBefore);
  }
  const trace = session.commit();

  return {
    cv,
    exp,
    ctx,
    locale,
    authoritative,
    snapshot,
    operationMode,
    grounding,
    finalized,
    nextCv,
    usageBefore,
    usageAfter,
    trace,
    candidate,
  };
}

describe('build 268 — root-cause source selection', () => {
  it('empty live ignores stale generatedDescription for AI authoritative source', () => {
    const { exp } = build268Fixture();
    expect((exp.generatedDescription || '').length).toBeGreaterThan(100);
    const auth = resolveExperienceAiAuthoritativeSource({ ...exp, description: '' });
    expect(auth.text).toBe('');
    expect(auth.kind).toBe('none');
    expect(auth.experienceForAi.generatedDescription || '').toBe('');
    expect(auth.experienceForAi.canonicalDescription || '').toBe('');
  });

  it('operation snapshot stays empty despite stale canonical/generated metadata', () => {
    const { exp, ctx, locale } = build268Fixture();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: '',
      canonicalText: exp.canonicalDescription || '',
      originalText: exp.originalUserDescription || '',
      locale,
      requestId: 'snap-268',
      jobContextHash: ctx.key,
    });
    expect(resolveExperienceAiOperationMode(snapshot.normalizedSourceText)).toBe(
      'generate_from_job_context',
    );
    expect(snapshot.sourceUnitCount).toBe(0);
    expect(snapshot.normalizedSourceText).toBe('');
    expect(snapshot.provenanceOrigin).toBe('none');
  });
});

describe('build 268 — exact provider success fixture', () => {
  beforeEach(() => seedUsage(18));

  it('accepts valid provider generation; usage 18→19; no missing_canonical_duty', () => {
    const r = runExactBuild268({ usageBefore: 18, candidate: SAFE_PROVIDER_SR });
    expect(r.operationMode).toBe('generate_from_job_context');
    expect(r.snapshot.sourceUnitCount).toBe(0);
    expect(r.snapshot.normalizedSourceText).toBe('');
    expect(r.authoritative.kind).toBe('none');
    expect(r.grounding.sourceDescription).toBe('');
    expect(r.trace.sourceDescriptionPresent).toBe(false);
    expect(r.trace.sourceDescriptionLength).toBe(0);
    expect(r.trace.sourceUnitCount).toBe(0);
    expect(r.trace.sourceFactIdentityCount).toBe(0);
    expect(r.trace.payloadSourceDescriptionLength).toBe(0);
    expect(r.trace.payloadSourceDutyCount).toBe(0);
    expect(r.trace.factLockEnabled).toBe(false);
    expect(r.trace.selectedSourceKind === 'jobContext' || r.trace.selectedSourceKind === 'none').toBe(true);
    expect(r.trace.staleGeneratedDescriptionIgnored).toBe(true);
    expect(r.trace.generatedDescriptionPreexisted).toBe(true);

    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.diagnostics?.sourceWasEmpty).toBe(true);
    expect(r.finalized.diagnostics?.operationMode).toBe('generate_from_job_context');
    expect(r.finalized.diagnostics?.typedFailureReason).toBeUndefined();
    expect(r.finalized.reason).not.toBe('missing_canonical_duty');
    expect(r.finalized.diagnostics?.generationFallbackAttempted).toBe(false);
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(false);
    expect(r.finalized.diagnostics?.relevanceValidationPassed).toBe(true);
    expect(r.finalized.diagnostics?.generatedBulletCount).toBe(3);
    expect(r.finalized.diagnostics?.generationFinalPostconditionPassed).toBe(true);

    // No enhancement source-fact coverage.
    expect(validateSourceFactIdentityCoverage('', r.finalized.text).requiredIds.length).toBe(0);

    const bullets = splitExperienceBullets(r.finalized.text);
    expect(bullets).toHaveLength(3);
    expect(r.finalized.text).toBe(SAFE_PROVIDER_SR);

    // generated/canonical written only after apply
    expect((r.nextCv.experience[0].description || '').trim()).toBe(SAFE_PROVIDER_SR.trim());
    expect((r.nextCv.experience[0].generatedDescription || '').trim().length).toBeGreaterThan(0);
    expect((r.nextCv.experience[0].canonicalDescription || '').trim().length).toBeGreaterThan(0);

    expect(r.usageBefore).toBe(18);
    expect(r.usageAfter).toBe(19);
    expect(r.trace.visibleApplySucceeded).toBe(true);
    expect(r.trace.countedAsSuccess).toBe(true);
    expect(r.trace.finalTypedFailureReason).toBeNull();
  });

  it('50× exact fixture — zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const r = runExactBuild268({ usageBefore: 18 });
      expect(r.finalized.countedAsSuccess, `run ${i}`).toBe(true);
      expect(r.usageAfter, `run ${i}`).toBe(19);
      expect(r.trace.factLockEnabled, `run ${i}`).toBe(false);
      expect(r.trace.payloadSourceDutyCount, `run ${i}`).toBe(0);
      expect(r.finalized.diagnostics?.sourceWasEmpty, `run ${i}`).toBe(true);
      expect(splitExperienceBullets(r.finalized.text), `run ${i}`).toHaveLength(3);
    }
  });
});

describe('build 268 — generation fallback matrix', () => {
  beforeEach(() => seedUsage(18));

  const badProviders = {
    timeout_empty: '',
    malformed: 'not bullets',
    wrong_locale: formatExperienceBullets([
      'Reviews field documentation and checks completeness.',
      'Updates documentation status trackers.',
      'Coordinates information exchange with colleagues.',
    ]),
    unrelated: formatExperienceBullets([
      'Priprema koktele prema standardnim recepturama.',
      'Održava čistoću bara i inventar pića.',
      'Prima narudžbine gostiju u ugostiteljstvu.',
    ]),
    unsafe: formatExperienceBullets([
      'Uses Excel and Salesforce to track KPIs for clients.',
      'Led a team of 12 and increased revenue by 40%.',
      'Managed ISO 9001 certifications and awards.',
    ]),
  } as const;

  for (const [name, candidate] of Object.entries(badProviders)) {
    it(`provider ${name} → non-empty job-context fallback; usage +1`, () => {
      // Finalize with bad candidate; generation path should fall back.
      const r = runExactBuild268({
        usageBefore: 18,
        candidate,
        originHint: 'ai_generated',
      });
      // Empty/malformed/wrong may go through tryAcceptGeneration fail then fallback.
      expect(r.finalized.countedAsSuccess).toBe(true);
      expect(r.finalized.origin).toBe('deterministic_fallback');
      expect(r.finalized.diagnostics?.generationFallbackAttempted).toBe(true);
      expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(true);
      expect(r.finalized.diagnostics?.generationFallbackFailureReason).toBeFalsy();
      const bullets = splitExperienceBullets(r.finalized.text);
      expect(bullets).toHaveLength(3);
      expect(r.finalized.text).toMatch(/terenske dokumentacije|dokumentacij/i);
      expect(r.finalized.text).not.toMatch(/\bExcel\b|\bKPI\b|koktel|Salesforce/i);
      expect(r.usageAfter).toBe(19);
      expect(r.trace.finalTypedFailureReason).toBeNull();
    });
  }

  it('arbitrary free-text titles across locales produce 3 non-empty duties', () => {
    const titles = [
      'Koordinator terenske dokumentacije',
      'Quantum Workflow Harmonizer',
      'Analitičar logističkih tokova',
      'XYZ-42 Pipeline Steward',
      'Field Documentation Coordinator',
    ];
    for (const locale of AI_SUPPORTED_LOCALES) {
      for (const position of titles) {
        const text = buildJobContextGenerationFallback({
          locale: locale as Locale,
          gender: 'female',
          position,
          industry: 'construction',
          isPresent: true,
        });
        const v = validateExperienceGenerationOutput(text, {
          locale: locale as Locale,
          position,
          isPresent: true,
        });
        expect(v.ok, `${locale}/${position}: ${v.reason}`).toBe(true);
        expect(splitExperienceBullets(text)).toHaveLength(3);
        expect(text).not.toMatch(/Obavlja dodeljene profesionalne/i);
      }
    }
  });
});

describe('build 268 — reload / Summary / PDF / DOCX', () => {
  beforeEach(() => seedUsage(18));

  it('reload preserves duties; Summary uses them; export +0', async () => {
    const r = runExactBuild268({ usageBefore: 18 });
    expect(r.usageAfter).toBe(19);
    const reloaded: CVData = JSON.parse(JSON.stringify(r.nextCv));
    expect(splitExperienceBullets(reloaded.experience[0].description || '')).toHaveLength(3);

    const summaryCandidate = [
      'Koordinator terenske dokumentacije u Atlasu od marta 2025.',
      'Pregleda pristiglu terensku dokumentaciju i proverava potpunost podataka,',
      'ažurira evidenciju statusa dokumentacije i koordiniše razmenu informacija sa kolegama.',
      'Ima oko 1 godinu i 4 meseca iskustva.',
    ].join(' ');
    const summaryFinal = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'sr',
      gender: 'female',
      cv: reloaded,
      candidate: summaryCandidate,
      originHint: 'ai_generated',
    });
    expect(summaryFinal.blocked).toBe(false);
    expect(summaryFinal.countedAsSuccess).toBe(true);

    const beforeExport = getProAiUsageCount();
    const prepared = prepareExportReadyCv(reloaded, 'sr', 'modern-minimal', {
      gender: 'female',
      industry: 'construction',
      level: 'mid',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfFlat = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer())).replace(/\u0000/g, '');
    expect(pdfFlat).toMatch(/Pregleda|Ažurira|Koordin|dokumentacij/i);
    await exportToDOCX(prepared.cv, 'cv-268', 'sr', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(beforeExport);
  });
});
