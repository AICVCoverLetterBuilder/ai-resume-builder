/**
 * @vitest-environment jsdom
 *
 * AAB-377 — German empty-source Experience generation claim safety.
 * Reject unsupported autonomy / universal-type-scope / quality-compliance
 * modifiers; repair to neutral role-relevant duties; preserve legitimate
 * maintenance/diagnosis/replacement/guidance duties; allow source-supported
 * uses of the same modifiers. No Fahrradmechaniker hard-coding.
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
  detectGermanAutonomyScopeQualityClaims,
  detectGermanExperienceUnsupportedExpansion,
  GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION,
} from '@/lib/cv-german-experience-grounding';
import {
  persistProAiRecord,
  recordProAiUserActionSuccess,
  getProAiUsageCount,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

/** Exact device-style unsafe inventiveness (bicycle mechanic prose — not hard-coded in prod). */
const BIKE_UNSAFE_DEVICE = formatExperienceBullets([
  'Repariert eigenständig Fahrräder aller Bauarten fachgerecht.',
  'Führt Wartungsarbeiten und Diagnosen an Komponenten durch.',
  'Berät Kundinnen und Kunden zu Reparaturmöglichkeiten.',
]);

const UNSAFE_AUTONOMY_ONLY = formatExperienceBullets([
  'Führt zugewiesene Aufgaben eigenständig im Rollenbereich aus.',
  'Erledigt Arbeitsaufgaben entsprechend den Rollenanforderungen.',
  'Stimmt Arbeitstätigkeiten mit Kolleginnen und Kollegen ab.',
]);

const UNSAFE_UNIVERSAL_SCOPE_ONLY = formatExperienceBullets([
  'Bearbeitet Aufträge aller Bauarten im zugewiesenen Arbeitsbereich.',
  'Erledigt Arbeitsaufgaben entsprechend den Rollenanforderungen.',
  'Stimmt Arbeitstätigkeiten mit Kolleginnen und Kollegen ab.',
]);

const UNSAFE_QUALITY_ONLY = formatExperienceBullets([
  'Führt zugewiesene Aufgaben fachgerecht im Rollenbereich aus.',
  'Erledigt Arbeitsaufgaben entsprechend den Rollenanforderungen.',
  'Stimmt Arbeitstätigkeiten mit Kolleginnen und Kollegen ab.',
]);

/** Legitimate role-relevant duties without unsupported modifiers. */
const LEGITIMATE_MAINTENANCE_DIAGNOSIS = formatExperienceBullets([
  'Führt Wartungsarbeiten an zugewiesenen Geräten durch.',
  'Diagnostiziert technische Störungen anhand vorliegender Symptome.',
  'Tauscht defekte Bauteile aus und berät Kundinnen und Kunden.',
]);

const SAFE_NEUTRAL_GENERIC = formatExperienceBullets([
  'Führt zugewiesene Aufgaben im Bereich Fachkraft aus.',
  'Erledigt Arbeitsaufgaben entsprechend den Rollenanforderungen.',
  'Stimmt Arbeitstätigkeiten mit Kolleginnen und Kollegen ab.',
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
  description?: string;
}): { cv: CVData; exp: WorkExperience; ctx: ReturnType<typeof buildExperienceJobContext> } {
  const position = options?.position || 'Fahrradmechaniker';
  const isPresent = options?.isPresent !== false;
  const description = options?.description ?? '';
  const exp: WorkExperience = {
    id: 'exp-de-377',
    company: 'RadWerk',
    position,
    startDate: isPresent ? '2024-01' : '2020-01',
    endDate: isPresent ? '' : '2023-06',
    isPresent,
    description,
    canonicalDescription: description,
    originalUserDescription: description,
    generatedDescription: '',
    descriptionOrigin: 'user',
  };
  const cv: CVData = {
    id: 'cv-de-377',
    name: 'CV',
    personal: {
      fullName: 'Max Muster',
      email: 'm@example.com',
      phone: '',
      address: '',
      jobTitle: position,
      gender: 'male',
    },
    summary: '',
    experience: [exp],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'DE',
    contentLocale: 'de',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const ctx = buildExperienceJobContext({
    position,
    industry: 'general',
    locale: 'de' as Locale,
    level: 'mid',
  });
  return { cv, exp, ctx };
}

function runGen(options: {
  usageBefore?: number;
  candidate: string;
  position?: string;
  isPresent?: boolean;
}) {
  const usageBefore = options.usageBefore ?? 0;
  seedUsage(usageBefore);
  const { cv, exp, ctx } = buildCv({
    position: options.position,
    isPresent: options.isPresent,
  });
  const locale: Locale = 'de';
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: '',
    canonicalText: '',
    originalText: '',
    locale,
    requestId: 'req-de-377',
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
    requestId: 'req-de-377',
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
  const trace = session.commit();
  return {
    cv,
    exp,
    nextCv,
    finalized,
    usageBefore,
    usageAfter,
    snapshot,
    trace,
  };
}

describe('AAB-377 German empty-source Experience claim safety', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
    seedUsage(0);
  });

  it('exposes german-experience-generation-claim-safety-377-v1 marker', () => {
    expect(GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION)
      .toBe('german-experience-generation-claim-safety-377-v1');
  });

  it('exact device regression: eigenständig + aller Bauarten + fachgerecht → count>0', () => {
    const scan = detectGermanAutonomyScopeQualityClaims('', BIKE_UNSAFE_DEVICE);
    expect(scan.count).toBeGreaterThan(0);
    expect(scan.labels).toEqual(expect.arrayContaining([
      'unsupported_autonomy_modifier',
      'unsupported_universal_type_scope',
      'unsupported_quality_compliance_modifier',
    ]));
    expect(scan.kinds).toEqual(expect.arrayContaining([
      'unsupported_modifier_expansion',
      'universal_scope_claim',
      'quality_claim',
      'standards_compliance_claim',
    ]));
    const v = validateExperienceGenerationOutput(BIKE_UNSAFE_DEVICE, {
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('experience_generation_unsafe_claims');
    expect(v.unsupportedClaimCount).toBeGreaterThan(0);
  });

  it('exact unsafe provider → neutral fallback applies once; modifiers gone; usage 0→1', () => {
    expect(resolveExperienceAiOperationMode('')).toBe('generate_from_job_context');
    const r = runGen({ usageBefore: 0, candidate: BIKE_UNSAFE_DEVICE, isPresent: true });
    expect(r.snapshot.sourceUnitCount).toBe(0);
    expect(r.finalized.blocked).toBe(false);
    expect(r.finalized.countedAsSuccess).toBe(true);
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(true);
    const text = r.finalized.text;
    expect(splitExperienceBullets(text)).toHaveLength(3);
    expect(text).not.toMatch(/eigenständig|aller\s+Bauarten|fachgerecht/iu);
    expect(text).not.toMatch(/\btäglich/iu);
    expect(text).toMatch(/Aufgaben|Arbeitsaufgaben|Kolleg/i);
    expect(r.nextCv.experience.find((e) => e.id === r.exp.id)?.description).toBe(text);
    expect(r.usageBefore).toBe(0);
    expect(r.usageAfter).toBe(1);
  });

  it('rejects each unsupported modifier class in isolation', () => {
    for (const candidate of [
      UNSAFE_AUTONOMY_ONLY,
      UNSAFE_UNIVERSAL_SCOPE_ONLY,
      UNSAFE_QUALITY_ONLY,
    ]) {
      const v = validateExperienceGenerationOutput(candidate, {
        locale: 'de',
        position: 'Lagerfachkraft',
        isPresent: true,
      });
      expect(v.ok, candidate.slice(0, 48)).toBe(false);
      expect(v.unsupportedClaimCount).toBeGreaterThan(0);
      expect(v.reason).toBe('experience_generation_unsafe_claims');
    }
  });

  it('arbitrary occupations: same unsupported modifiers rejected universally', () => {
    // Occupation-neutral unsafe prose — no Fahrradmechaniker hard-coding; modifiers alone fail.
    const arbitraryUnsafe = formatExperienceBullets([
      'Führt zugewiesene Aufgaben eigenständig an Geräten aller Bauarten fachgerecht aus.',
      'Erledigt Arbeitsaufgaben entsprechend den Rollenanforderungen.',
      'Stimmt Arbeitstätigkeiten mit Kolleginnen und Kollegen ab.',
    ]);
    for (const position of [
      'Solaranlagenmonteur',
      'Bibliotheksassistent',
      'Bienenhalter',
      'Lagerfachkraft',
    ]) {
      const scan = detectGermanAutonomyScopeQualityClaims('', arbitraryUnsafe);
      expect(scan.count, position).toBeGreaterThan(0);
      const v = validateExperienceGenerationOutput(arbitraryUnsafe, {
        locale: 'de',
        position,
        isPresent: true,
      });
      expect(v.ok, position).toBe(false);
      expect(v.reason, position).toBe('experience_generation_unsafe_claims');
      expect(v.unsupportedClaimCount, position).toBeGreaterThan(0);
      const r = runGen({ candidate: arbitraryUnsafe, position });
      expect(r.finalized.origin, position).toBe('deterministic_fallback');
      expect(r.finalized.text, position).not.toMatch(/eigenständig|aller\s+Bauarten|fachgerecht/iu);
      expect(r.usageAfter, position).toBe(1);
    }
  });

  it('preserves legitimate maintenance / diagnosis / replacement / guidance duties', () => {
    const scan = detectGermanAutonomyScopeQualityClaims('', LEGITIMATE_MAINTENANCE_DIAGNOSIS);
    expect(scan.count).toBe(0);
    const v = validateExperienceGenerationOutput(LEGITIMATE_MAINTENANCE_DIAGNOSIS, {
      locale: 'de',
      position: 'Servicetechniker',
      isPresent: true,
    });
    expect(v.ok).toBe(true);
    expect(v.unsupportedClaimCount).toBe(0);
    const r = runGen({
      position: 'Servicetechniker',
      candidate: LEGITIMATE_MAINTENANCE_DIAGNOSIS,
    });
    expect(r.finalized.origin).toBe('ai_generated');
    expect(r.finalized.text).toMatch(/Wartung|Diagnostiz|Bauteile|berät/i);
    expect(r.finalized.text).not.toMatch(/eigenständig|aller\s+Bauarten|fachgerecht/iu);
    expect(r.usageAfter).toBe(1);
  });

  it('source-supported uses of the same modifiers are allowed on enhancement', () => {
    const source = formatExperienceBullets([
      'Repariert Fahrräder aller Bauarten fachgerecht und eigenständig.',
      'Führt Wartungsarbeiten durch.',
      'Berät Kundinnen und Kunden.',
    ]);
    const candidate = formatExperienceBullets([
      'Repariert Fahrräder aller Bauarten fachgerecht und eigenständig nach Auftrag.',
      'Führt Wartungsarbeiten an Komponenten durch.',
      'Berät Kundinnen und Kunden zu Reparaturmöglichkeiten.',
    ]);
    const scan = detectGermanAutonomyScopeQualityClaims(source, candidate);
    expect(scan.count).toBe(0);
    const expansion = detectGermanExperienceUnsupportedExpansion(source, candidate);
    expect(expansion.labels).not.toEqual(expect.arrayContaining([
      'unsupported_autonomy_modifier',
      'unsupported_universal_type_scope',
      'unsupported_quality_compliance_modifier',
    ]));

    const { cv, exp, ctx } = buildCv({
      position: 'Fahrradmechaniker',
      description: source,
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'male',
      cv,
      candidate,
      experienceId: exp.id,
      industry: 'general',
      level: 'mid',
      jobContext: ctx,
      originHint: 'ai_generated',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/eigenständig|aller\s+Bauarten|fachgerecht/iu);
  });

  it('safe neutral generation and deterministic fallback validate with claim count 0', () => {
    expect(validateExperienceGenerationOutput(SAFE_NEUTRAL_GENERIC, {
      locale: 'de',
      position: 'Fachkraft',
      isPresent: true,
    }).ok).toBe(true);
    const fb = buildJobContextGenerationFallback({
      locale: 'de',
      gender: 'male',
      position: 'Fahrradmechaniker',
      industry: 'general',
      isPresent: true,
    });
    const v = validateExperienceGenerationOutput(fb, {
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    expect(v.ok).toBe(true);
    expect(v.unsupportedClaimCount).toBe(0);
    expect(fb).not.toMatch(/eigenständig|aller\s+Bauarten|fachgerecht|\btäglich/iu);
    expect(detectGermanAutonomyScopeQualityClaims('', fb).count).toBe(0);
  });
});
