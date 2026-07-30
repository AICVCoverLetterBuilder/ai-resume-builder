/**
 * @vitest-environment jsdom
 *
 * AAB-378 — German empty-source Experience fallback quality.
 * Reject title-echo / zugewiesene Aufgaben / Arbeitsaufgaben / Rollenanforderungen;
 * emit concrete role-relevant duties from title morphology; preserve EN path.
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
  detectGermanAutonomyScopeQualityClaims,
  GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION,
} from '@/lib/cv-german-experience-grounding';
import {
  generationLooksRoleTitleEchoFillerOnly,
  generationLooksTautologicalRoleShellOnly,
  textLooksRelevantToFreeTextTitle,
  peelGermanAgentiveCompound,
  foldAiTextToken,
  EXPERIENCE_GENERATION_FALLBACK_QUALITY_378_REVISION,
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

const TITLE_ECHO_DEVICE = formatExperienceBullets([
  'Führt zugewiesene Aufgaben im Bereich Fahrradmechaniker aus.',
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

function assertConcreteDeSurface(text: string, position: string): void {
  const bullets = splitExperienceBullets(text);
  expect(bullets).toHaveLength(3);
  expect(text).not.toMatch(/zugewiesene\s+Aufgaben/iu);
  expect(text).not.toMatch(/Arbeitsaufgaben/iu);
  expect(text).not.toMatch(/Rollenanforderungen/iu);
  expect(text).not.toMatch(/im\s+Bereich\s+\S+/iu);
  expect(text).not.toMatch(/\btäglich|eigenständig|aller\s+Bauarten|fachgerecht/iu);
  expect(generationLooksRoleTitleEchoFillerOnly(text)).toBe(false);
  expect(generationLooksTautologicalRoleShellOnly(text)).toBe(false);
  expect(textLooksRelevantToFreeTextTitle(text, position)).toBe(true);
  expect(detectGermanAutonomyScopeQualityClaims('', text).count).toBe(0);
  const v = validateExperienceGenerationOutput(text, {
    locale: 'de',
    position,
    isPresent: true,
  });
  expect(v.ok).toBe(true);
  expect(v.relevanceValidationPassed).toBe(true);
}

function buildCv(options?: {
  position?: string;
  isPresent?: boolean;
  locale?: Locale;
}): { cv: CVData; exp: WorkExperience } {
  const position = options?.position || 'Fahrradmechaniker';
  const isPresent = options?.isPresent !== false;
  const locale = options?.locale || 'de';
  const exp: WorkExperience = {
    id: 'exp-de-378',
    company: 'RadWerk',
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
  const cv: CVData = {
    id: 'cv-de-378',
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
    region: locale === 'de' ? 'DE' : 'US',
    contentLocale: locale,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { cv, exp };
}

function runGen(options: {
  usageBefore?: number;
  candidate: string;
  position?: string;
  isPresent?: boolean;
  locale?: Locale;
}) {
  const usageBefore = options.usageBefore ?? 0;
  seedUsage(usageBefore);
  const locale: Locale = options.locale || 'de';
  const { cv, exp } = buildCv({
    position: options.position,
    isPresent: options.isPresent,
    locale,
  });
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
    requestId: 'req-de-378',
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
    requestId: 'req-de-378',
    usageCountBefore: usageBefore,
  });
  session.recordLiveExperience(exp, Boolean(exp.isPresent));
  session.recordExperienceEntryTarget({
    experienceEntryId: exp.id,
    isPresent: Boolean(exp.isPresent),
    arrayIndexAtRequest: 0,
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
    const gate = session.evaluatePreApplyDecisionGates();
    if (gate.passed) {
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
  return { finalized, usageBefore, usageAfter, nextCv, exp };
}

describe('AAB-378 German empty-source fallback quality', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
    seedUsage(0);
  });

  it('exposes experience-generation-fallback-quality-378-v1 marker', () => {
    expect(EXPERIENCE_GENERATION_FALLBACK_QUALITY_378_REVISION)
      .toBe('experience-generation-fallback-quality-378-v1');
    expect(GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION)
      .toBe('german-experience-generation-claim-safety-377-v1');
    expect(EXPERIENCE_GENERATION_FALLBACK_SURFACE_369_REVISION)
      .toBe('experience-generation-fallback-surface-369-v1');
  });

  it('exact device title-echo rejected; relevanceValidationPassed=false', () => {
    expect(generationLooksRoleTitleEchoFillerOnly(TITLE_ECHO_DEVICE)).toBe(true);
    const v = validateExperienceGenerationOutput(TITLE_ECHO_DEVICE, {
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('experience_generation_not_relevant');
    expect(v.relevanceValidationPassed).toBe(false);
  });

  it('exact Fahrradmechaniker fallback → concrete bicycle maintenance/repair/check', () => {
    const peeled = peelGermanAgentiveCompound(foldAiTextToken('Fahrradmechaniker'));
    expect(peeled?.objectStem).toBe('fahrrad');
    expect(peeled?.agentive).toMatch(/^mechaniker/);
    const fb = buildJobContextGenerationFallback({
      locale: 'de',
      gender: 'male',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    assertConcreteDeSurface(fb, 'Fahrradmechaniker');
    expect(fb).toMatch(/Fahrräder|Fahrrad/i);
    expect(fb).toMatch(/Wartung/i);
    expect(fb).toMatch(/Prüft/i);
    expect(fb).toMatch(/Bauteile|Repar/i);
    expect(fb).not.toMatch(/Fahrradmechaniker/i);
  });

  it('title-echo provider → concrete DE fallback applies; usage 0→1', () => {
    const r = runGen({ candidate: TITLE_ECHO_DEVICE, position: 'Fahrradmechaniker' });
    expect(r.finalized.origin).toBe('deterministic_fallback');
    expect(r.finalized.diagnostics?.generationFallbackApplied).toBe(true);
    assertConcreteDeSurface(r.finalized.text, 'Fahrradmechaniker');
    expect(r.usageAfter).toBe(1);
  });

  it('arbitrary occupations get concrete morphology-based duties', () => {
    const cases: Array<{ position: string; expectRe: RegExp }> = [
      { position: 'Solaranlagenmonteur', expectRe: /Solaranlagen|Montier/i },
      { position: 'Bibliotheksassistent', expectRe: /Bibliothek/i },
      { position: 'Bienenhalter', expectRe: /Bienen/i },
    ];
    for (const { position, expectRe } of cases) {
      const fb = buildJobContextGenerationFallback({
        locale: 'de',
        gender: 'male',
        position,
        isPresent: true,
      });
      assertConcreteDeSurface(fb, position);
      expect(fb, position).toMatch(expectRe);
      expect(fb, position).not.toMatch(new RegExp(position, 'i'));
    }
  });

  it('unknown titles get safe generic without title echo', () => {
    const fb = buildJobContextGenerationFallback({
      locale: 'de',
      gender: 'male',
      position: 'Xyzqwertzrolle',
      isPresent: true,
    });
    expect(splitExperienceBullets(fb)).toHaveLength(3);
    expect(fb).not.toMatch(/zugewiesene\s+Aufgaben|Arbeitsaufgaben|Rollenanforderungen|im\s+Bereich/iu);
    expect(fb).not.toMatch(/Xyzqwertzrolle/i);
    expect(validateExperienceGenerationOutput(fb, {
      locale: 'de',
      position: 'Xyzqwertzrolle',
      isPresent: true,
    }).ok).toBe(true);
  });

  it('present vs past tense German fallback', () => {
    const present = buildJobContextGenerationFallback({
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    const past = buildJobContextGenerationFallback({
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: false,
    });
    expect(present).toMatch(/\b(Führt|Prüft|Tauscht)\b/);
    expect(present).not.toMatch(/\b(Führte|Prüfte|Tauschte)\b/);
    expect(past).toMatch(/\b(Führte|Prüfte|Tauschte)\b/);
    expect(past).not.toMatch(/\b(Führt|Prüft|Tauscht)\b/);
  });

  it('locale purity: DE fallback stays German; EN Solar path unchanged', () => {
    const de = buildJobContextGenerationFallback({
      locale: 'de',
      position: 'Fahrradmechaniker',
      isPresent: true,
    });
    expect(de).toMatch(/[äöüÄÖÜß]|Wartung|Prüft|Kolleg/i);
    expect(de).not.toMatch(/\b(Installs|Coordinates|Performs)\b/);

    const en = buildJobContextGenerationFallback({
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    });
    expect(en).toMatch(/Installs solar panels/i);
    expect(en).not.toMatch(/zugewiesene|Rollenanforderungen|Fahrrad/i);
    expect(validateExperienceGenerationOutput(en, {
      locale: 'en',
      position: 'Solar Panel Installer',
      isPresent: true,
    }).ok).toBe(true);
  });

  it('closed DE claim-safety marker still present', () => {
    expect(GERMAN_EXPERIENCE_GENERATION_CLAIM_SAFETY_377_REVISION)
      .toContain('377');
  });
});
