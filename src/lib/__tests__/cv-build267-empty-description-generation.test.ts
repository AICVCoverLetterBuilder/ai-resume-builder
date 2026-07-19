/**
 * @vitest-environment jsdom
 *
 * Build 267 — empty Experience Description → Generation Mode.
 *
 * Exact production failure (sr / modern-minimal):
 * Position: Koordinator terenske dokumentacije
 * Company: Atlas | Industry: general | Level: mid | Present | Description: empty
 * Expected: generate three Serbian CV duties from job context.
 * Actual (267): source-fact validation rejected empty source.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildJobContextGenerationFallback,
  resolveExperienceAiOperationMode,
  validateExperienceGenerationOutput,
  experienceAiSourceWasEmpty,
} from '@/lib/cv-experience-ai-operation-mode';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceJobContext,
  resolveExperienceAiGrounding,
} from '@/lib/cv-experience-job-context';
import { freezeExperienceAiDescription, ensureExperienceAiSourceFrozen } from '@/lib/cv-canonical-facts';
import {
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
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
import {
  aiErrorMessage,
  mapExperienceAiFailureToErrorCode,
} from '@/lib/ai-error-codes';
import { validateSourceFactIdentityCoverage } from '@/lib/cv-source-fact-identity';
import type { Locale } from '@/lib/i18n/translations';

const EXPECTED_SR_TITLE = 'Koordinator terenske dokumentacije';

/** Unsafe / generic provider fixtures for reject→fallback paths. */
const UNSAFE_PROVIDER = formatExperienceBullets([
  'Uses Excel and Salesforce to track KPIs for Atlas clients.',
  'Led a team of 12 and increased revenue by 40%.',
  'Managed ISO 9001 certifications and awards.',
]);

const GENERIC_PROVIDER = formatExperienceBullets([
  'Obavlja dodeljene profesionalne zadatke.',
  'Obavlja dodeljene profesionalne zadatke svakodnevno.',
  'Obavlja dodeljene profesionalne zadatke po potrebi.',
]);

const UNRELATED_PROVIDER = formatExperienceBullets([
  'Priprema koktele prema standardnim recepturama.',
  'Održava čistoću bara i inventar pića.',
  'Prima narudžbine gostiju u ugostiteljstvu.',
]);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function build267Fixture(overrides?: Partial<WorkExperience> & {
  locale?: Locale;
  industry?: string;
  gender?: string;
  description?: string;
}): {
  cv: CVData;
  exp: WorkExperience;
  ctx: ReturnType<typeof buildExperienceJobContext>;
  locale: Locale;
} {
  const locale = (overrides?.locale || 'sr') as Locale;
  const description = overrides?.description ?? '';
  const exp: WorkExperience = {
    id: 'exp-267',
    company: 'Atlas',
    position: 'Koordinator terenske dokumentacije',
    startDate: '2025-03',
    endDate: '',
    isPresent: true,
    description,
    canonicalDescription: '',
    originalUserDescription: '',
    generatedDescription: '',
    descriptionOrigin: 'user',
  };
  if (overrides?.company !== undefined) exp.company = overrides.company;
  if (overrides?.position !== undefined) exp.position = overrides.position;
  if (overrides?.startDate !== undefined) exp.startDate = overrides.startDate;
  if (overrides?.endDate !== undefined) exp.endDate = overrides.endDate;
  if (overrides?.isPresent !== undefined) exp.isPresent = overrides.isPresent;
  if (overrides?.gender !== undefined) {
    // handled on personal below
  }
  exp.description = description;
  const cv: CVData = {
    id: 'cv-267',
    name: 'CV',
    personal: {
      fullName: 'Marko Marković',
      email: 'm@example.com',
      phone: '',
      address: '',
      jobTitle: exp.position,
      gender: overrides?.gender ?? 'male',
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
    industry: overrides?.industry ?? 'general',
    locale,
    level: 'mid',
  });
  return { cv, exp, ctx, locale };
}

function runExactBuild267(options?: {
  usageBefore?: number;
  candidate?: string;
  originHint?: 'ai_generated' | 'ai_repaired' | 'deterministic_fallback';
  locale?: Locale;
  position?: string;
  description?: string;
  isPresent?: boolean;
  industry?: string;
  gender?: string;
  company?: string;
}) {
  const usageBefore = options?.usageBefore ?? 10;
  seedUsage(usageBefore);
  const { cv, exp, ctx, locale } = build267Fixture({
    ...(options?.locale !== undefined ? { locale: options.locale } : {}),
    ...(options?.position !== undefined ? { position: options.position } : {}),
    description: options?.description ?? '',
    ...(options?.isPresent !== undefined ? { isPresent: options.isPresent } : {}),
    ...(options?.industry !== undefined ? { industry: options.industry } : {}),
    ...(options?.gender !== undefined ? { gender: options.gender } : {}),
    ...(options?.company !== undefined ? { company: options.company } : {}),
  });
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: exp.description || '',
    canonicalText: exp.canonicalDescription || '',
    originalText: exp.originalUserDescription || '',
    locale,
    requestId: 'req-267-exact',
    jobContextHash: ctx.key,
  });
  const operationMode = resolveExperienceAiOperationMode(snapshot.normalizedSourceText);
  const frozen = ensureExperienceAiSourceFrozen(exp);
  const grounding = resolveExperienceAiGrounding(frozen, ctx, freezeExperienceAiDescription);
  grounding.sourceDescription = snapshot.normalizedSourceText;
  grounding.experienceForAi = {
    ...grounding.experienceForAi,
    description: snapshot.normalizedSourceText,
    originalUserDescription: snapshot.normalizedSourceText,
    canonicalDescription: snapshot.normalizedSourceText,
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
    requestId: 'req-267-exact',
    usageCountBefore: usageBefore,
  });
  session.stage('button_pressed', 'ok');
  session.recordLiveExperience(exp, true);
  session.recordSourceSelection(exp, grounding, {
    requestedLocale: locale,
    selectedSourceKindHint: 'currentTextarea',
    operationalContentLocale: locale,
  });
  session.recordPayloadBuilt({
    locale,
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    isPresent: Boolean(exp.isPresent),
  });

  const candidate = options?.candidate
    ?? (operationMode === 'generate_from_job_context'
      ? buildJobContextGenerationFallback({
        locale,
        gender: cv.personal.gender || '',
        position: exp.position,
        industry: ctx.industryNorm,
        isPresent: Boolean(exp.isPresent),
      })
      : formatExperienceBullets(splitExperienceBullets(exp.description || '')));

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
    industry: options?.industry ?? 'general',
    level: 'mid',
    jobContext: ctx,
    operationSnapshot: snapshot,
    originHint: options?.originHint ?? 'ai_generated',
  });
  session.recordFinalizeResult(finalized);

  let nextCv = cv;
  let usageAfter = usageBefore;
  if (finalized.countedAsSuccess && !finalized.blocked) {
    nextCv = applyFinalizedBulletsToCv(cv, locale, exp.id, finalized, ctx);
    recordProAiUserActionSuccess();
    usageAfter = getProAiUsageCount();
    session.recordVisibleApply(true, usageAfter);
  } else {
    session.recordVisibleApply(false, usageBefore);
  }
  const trace = session.commit();
  return {
    finalized,
    nextCv,
    trace,
    snapshot,
    operationMode,
    usageBefore,
    usageAfter,
    cv,
    exp,
    ctx,
    locale,
  };
}

describe('build 267 — mode selection', () => {
  it('empty sanitized duties → generate_from_job_context', () => {
    expect(resolveExperienceAiOperationMode('')).toBe('generate_from_job_context');
    expect(resolveExperienceAiOperationMode('   ')).toBe('generate_from_job_context');
    expect(experienceAiSourceWasEmpty('')).toBe(true);
  });

  it('non-empty duties → enhance_existing_description', () => {
    expect(resolveExperienceAiOperationMode(
      'Pregleda dokumentaciju i proverava podatke.',
    )).toBe('enhance_existing_description');
    expect(experienceAiSourceWasEmpty('Pregleda dokumentaciju.')).toBe(false);
  });
});

describe('build 267 — exact empty Serbian fixture', () => {
  beforeEach(() => seedUsage(10));

  it('generates three relevant Serbian duties; usage +1; no source-fact gate', () => {
    const result = runExactBuild267({ usageBefore: 10 });
    expect(result.operationMode).toBe('generate_from_job_context');
    expect(result.snapshot.sourceUnitCount).toBe(0);
    expect(result.finalized.diagnostics?.operationMode).toBe('generate_from_job_context');
    expect(result.finalized.diagnostics?.sourceWasEmpty).toBe(true);
    expect(result.finalized.diagnostics?.sourceFactCount).toBe(0);
    expect(result.finalized.countedAsSuccess).toBe(true);
    expect(result.finalized.blocked).toBe(false);

    // No source-fact coverage requirement for empty source.
    const coverage = validateSourceFactIdentityCoverage('', result.finalized.text);
    expect(coverage.requiredIds.length).toBe(0);

    const bullets = splitExperienceBullets(result.finalized.text);
    expect(bullets).toHaveLength(3);
    expect(new Set(bullets.map((b) => b.toLowerCase())).size).toBe(3);
    bullets.forEach((b) => {
      expect(b).not.toMatch(/\bExcel\b|\bKPI\b|tim od|increased revenue/i);
      expect(b).not.toMatch(/Obavlja dodeljene profesionalne/i);
    });
    // Title-relevant without repeating the full job title in every bullet.
    expect(result.finalized.text).toMatch(/terenske dokumentacije/i);
    expect(bullets[0]).toMatch(/^(Obavlja|Pregleda|Ažurira)/);
    expect(result.finalized.text).toBe(
      buildJobContextGenerationFallback({
        locale: 'sr',
        gender: 'male',
        position: EXPECTED_SR_TITLE,
        industry: 'general',
        isPresent: true,
      }),
    );

    expect(result.finalized.diagnostics?.relevanceValidationPassed).toBe(true);
    expect(result.finalized.diagnostics?.perspectiveValidationPassed).toBe(true);
    expect(result.finalized.diagnostics?.tenseValidationPassed).toBe(true);
    expect(result.finalized.diagnostics?.unsupportedClaimCount).toBe(0);
    expect(result.finalized.diagnostics?.generatedBulletCount).toBe(3);

    expect(result.usageBefore).toBe(10);
    expect(result.usageAfter).toBe(11);

    const applied = result.nextCv.experience[0].description || '';
    expect(applied.trim().length).toBeGreaterThan(0);
    expect(splitExperienceBullets(applied)).toHaveLength(3);

    // Confirmed as grounding for Summary.
    expect((result.nextCv.experience[0].canonicalDescription || '').trim().length).toBeGreaterThan(0);
    expect((result.nextCv.experience[0].originalUserDescription || '').trim().length).toBeGreaterThan(0);

    expect(result.trace.operationMode).toBe('generate_from_job_context');
    expect(result.trace.sourceWasEmpty).toBe(true);
    expect(result.trace.sourceFactCount).toBe(0);
    expect(result.trace.generatedBulletCount).toBe(3);
    expect(result.trace.relevanceValidationPassed).toBe(true);
    expect(result.trace.perspectiveValidationPassed).toBe(true);
    expect(result.trace.tenseValidationPassed).toBe(true);
    expect(result.trace.unsupportedClaimCount).toBe(0);
    expect(result.trace.visibleApplySucceeded).toBe(true);
    expect(result.trace.countedAsSuccess).toBe(true);
  });

  it('50× exact fixture — zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      const result = runExactBuild267({ usageBefore: 20 + (i % 5) });
      expect(result.finalized.countedAsSuccess, `run ${i}`).toBe(true);
      expect(splitExperienceBullets(result.finalized.text), `run ${i}`).toHaveLength(3);
      expect(result.usageAfter, `run ${i}`).toBe(result.usageBefore + 1);
      expect(result.finalized.diagnostics?.operationMode, `run ${i}`)
        .toBe('generate_from_job_context');
    }
  });
});

describe('build 267 — control matrix', () => {
  beforeEach(() => seedUsage(10));

  it('A: empty Serbian → generation', () => {
    const r = runExactBuild267({ locale: 'sr', description: '' });
    expect(r.operationMode).toBe('generate_from_job_context');
    expect(r.finalized.countedAsSuccess).toBe(true);
  });

  it('B: existing Serbian → enhancement preserves facts', () => {
    const source = formatExperienceBullets([
      'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
      'Ažurira zajedničku tabelu sa najnovijim statusom.',
      'Koordiniše sa dva interna odeljenja kada nedostaju informacije.',
    ]);
    const r = runExactBuild267({
      description: source,
      candidate: formatExperienceBullets([
        'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
        'Ažurira zajedničku tabelu sa najnovijim statusom.',
        'Koordiniše sa dva interna odeljenja kada nedostaju informacije.',
      ]),
    });
    expect(r.operationMode).toBe('enhance_existing_description');
    expect(r.finalized.diagnostics?.sourceWasEmpty).toBe(false);
    // Enhancement may reject no-op — either success with preserved facts or typed coverage/noop.
    if (r.finalized.countedAsSuccess) {
      const bullets = splitExperienceBullets(r.finalized.text);
      expect(bullets.length).toBeGreaterThanOrEqual(3);
      expect(bullets.join(' ')).toMatch(/izveštaj|statusom|odeljen/i);
    } else {
      expect(r.finalized.reason || r.finalized.diagnostics?.typedFailureReason).toMatch(
        /noop|coverage|perspective|locale/i,
      );
    }
  });

  it('C–F: empty multilingual generation', () => {
    for (const locale of ['en', 'hi', 'ar', 'ja'] as Locale[]) {
      const r = runExactBuild267({
        locale,
        position: locale === 'en'
          ? 'Field Documentation Coordinator'
          : 'Koordinator terenske dokumentacije',
        description: '',
      });
      expect(r.operationMode, locale).toBe('generate_from_job_context');
      expect(r.finalized.countedAsSuccess, locale).toBe(true);
      expect(splitExperienceBullets(r.finalized.text), locale).toHaveLength(3);
    }
  });

  it('G: empty description completed role → past tense (sr)', () => {
    const r = runExactBuild267({
      description: '',
      isPresent: false,
    });
    expect(r.finalized.countedAsSuccess).toBe(true);
    const bullets = splitExperienceBullets(r.finalized.text);
    expect(bullets[0]).toMatch(/Obavljao|Obavljala|Pregledao|Pregledala/);
    expect(bullets[0]).not.toMatch(/^Obavlja\b|^Pregleda\b/);
  });

  it('H: unknown meaningful free-text title → safe title-relevant duties', () => {
    const r = runExactBuild267({
      position: 'Analitičar logističkih tokova',
      description: '',
      industry: 'general',
    });
    expect(r.operationMode).toBe('generate_from_job_context');
    expect(r.finalized.countedAsSuccess).toBe(true);
    const text = r.finalized.text;
    expect(splitExperienceBullets(text)).toHaveLength(3);
    expect(text).toMatch(/logističkih tokova/i);
    expect(text).not.toMatch(/Obavlja dodeljene profesionalne zadatke/i);
  });

  it('I: provider invents tools/metrics → reject then job-context fallback', () => {
    const r = runExactBuild267({
      candidate: UNSAFE_PROVIDER,
      originHint: 'ai_generated',
    });
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(true);
    const text = r.finalized.text;
    expect(text).not.toMatch(/\bExcel\b|\bKPI\b|40%/);
    expect(splitExperienceBullets(text)).toHaveLength(3);
  });

  it('J: provider returns unrelated generic duties → fallback', () => {
    const r = runExactBuild267({
      candidate: UNRELATED_PROVIDER,
      originHint: 'ai_generated',
    });
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.text).toMatch(/terenske dokumentacije/i);
    expect(r.finalized.text).not.toMatch(/koktel|bara|gostiju/i);
  });

  it('K: provider empty → deterministic job-context fallback', () => {
    const r = runExactBuild267({
      candidate: '',
      originHint: 'ai_generated',
    });
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.diagnostics?.generationFallbackAttempted).toBe(true);
    expect(splitExperienceBullets(r.finalized.text)).toHaveLength(3);
  });

  it('L: existing source facts never switch to generation mode', () => {
    const source = 'Beleži status zahteva i prati rešavanje do zatvaranja predmeta.';
    expect(resolveExperienceAiOperationMode(source)).toBe('enhance_existing_description');
    const snap = createExperienceAiOperationSnapshot({
      liveText: source,
      canonicalText: '',
      originalText: '',
      locale: 'sr',
      requestId: 'req-l',
      jobContextHash: 'k',
    });
    expect(resolveExperienceAiOperationMode(snap.normalizedSourceText))
      .toBe('enhance_existing_description');
  });

  it('generic-only provider fails generation validation', () => {
    const check = validateExperienceGenerationOutput(GENERIC_PROVIDER, {
      locale: 'sr',
      position: 'Koordinator terenske dokumentacije',
      isPresent: true,
    });
    expect(check.ok).toBe(false);
    expect(check.reason).toBe('experience_generation_not_relevant');
  });
});

describe('build 267 — UX error mapping', () => {
  it('maps typed generation failures; not blank-source validation toast by default', () => {
    expect(mapExperienceAiFailureToErrorCode('experience_generation_failed'))
      .toBe('experience_generation_failed');
    expect(mapExperienceAiFailureToErrorCode('experience_generation_not_relevant'))
      .toBe('experience_generation_not_relevant');
    expect(mapExperienceAiFailureToErrorCode('experience_material_fact_coverage_incomplete'))
      .toBe('experience_enhancement_fact_coverage_incomplete');
    expect(aiErrorMessage('experience_generation_failed', 'sr'))
      .toMatch(/generisati dužnosti/i);
    expect(aiErrorMessage('experience_generation_failed', 'sr'))
      .not.toMatch(/nije prošao validaciju/i);
  });
});

describe('build 267 — reload / Summary / PDF / DOCX', () => {
  beforeEach(() => seedUsage(10));

  it('reload preserves duties; Summary can use them; export +0', async () => {
    const { finalized, nextCv, usageAfter } = runExactBuild267({ usageBefore: 10 });
    expect(usageAfter).toBe(11);
    expect(finalized.countedAsSuccess).toBe(true);

    const reloaded: CVData = JSON.parse(JSON.stringify(nextCv));
    expect(splitExperienceBullets(reloaded.experience[0].description || '')).toHaveLength(3);
    expect(reloaded.experience[0].description).toMatch(/terenske dokumentacije|Pregleda|Ažurira|Koordin/i);

    // Summary finalize path can read confirmed Experience facts.
    const summaryCandidate = [
      'Koordinator terenske dokumentacije u Atlasu od marta 2025.',
      'Pregleda pristiglu terensku dokumentaciju i proverava potpunost podataka,',
      'ažurira evidenciju statusa dokumentacije i vodi računa o tačnosti unosa,',
      'te koordiniše razmenu informacija sa internim odeljenjima radi kompletiranja dokumentacije.',
      'Ima oko 1 godinu i 4 meseca iskustva.',
    ].join(' ');
    const summaryFinal = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'sr',
      gender: 'male',
      cv: reloaded,
      candidate: summaryCandidate,
      originHint: 'ai_generated',
    });
    expect(summaryFinal.blocked).toBe(false);
    expect(summaryFinal.countedAsSuccess).toBe(true);
    expect(summaryFinal.text).toMatch(/Koordinator terenske dokumentacije/i);
    expect(summaryFinal.text).toMatch(/Atlas/i);
    expect(summaryFinal.text).toMatch(/mart|2025/i);
    expect(summaryFinal.text).toMatch(/dokumentacij/i);
    // Exactly one structured duration expression preferred.
    expect(summaryFinal.diagnostics?.finalDurationExpressionCount ?? 1).toBeLessThanOrEqual(1);

    const beforeExport = getProAiUsageCount();
    const prepared = prepareExportReadyCv(reloaded, 'sr');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfFlat = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer())).replace(/\u0000/g, '');
    expect(pdfFlat).toMatch(/terenske dokumentacije|Pregleda|Ažurira|Koordin/i);
    await exportToDOCX(prepared.cv, 'cv-267', 'sr', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(beforeExport);
  });
});
