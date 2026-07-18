/**
 * @vitest-environment jsdom
 *
 * Build 264 — Serbian Experience AI perspective (1sg → CV 3sg) must apply to
 * accepted provider output, not only deterministic fallback.
 *
 * Device: provider returned the same first-person source; diagnostics reported
 * tense_normalization: ok and visible_apply: ok, but textarea stayed:
 * Pregledam / Ažuriram / Koordinišem.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  resolveExperienceAiAuthoritativeSource,
} from '@/lib/cv-experience-provenance';
import {
  createExperienceAiOperationSnapshot,
} from '@/lib/cv-experience-ai-operation-snapshot';
import {
  detectExperiencePersonMode,
  normalizeExperienceBulletPerspective,
  normalizeExperienceBulletsPerspective,
  validateExperienceCvPerspective,
  experienceAiHasMeaningfulChange,
} from '@/lib/cv-experience-perspective';
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
import type { Locale } from '@/lib/i18n/translations';

const SR_1SG = [
  'Pregledam pristigle terenske izveštaje i označavam nepotpune unose.',
  'Ažuriram zajedničku tabelu sa najnovijim statusom.',
  'Koordinišem sa dva interna odeljenja kada nedostaju informacije.',
];
const SR_1SG_BLOCK = SR_1SG.join('\n');
const SR_3SG = [
  'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
  'Ažurira zajedničku tabelu sa najnovijim statusom.',
  'Koordiniše sa dva interna odeljenja kada nedostaju informacije.',
];
const PROVIDER_SAME_1SG = formatExperienceBullets(SR_1SG);
const PROVIDER_CORRECT_3SG = formatExperienceBullets(SR_3SG);

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function build264Fixture(overrides?: Partial<WorkExperience> & { isPresent?: boolean; gender?: string }): {
  cv: CVData;
  exp: WorkExperience;
  ctx: ReturnType<typeof buildExperienceJobContext>;
} {
  const gender = overrides?.gender || 'male';
  const isPresent = overrides?.isPresent !== false;
  const rest = { ...(overrides || {}) } as Partial<WorkExperience>;
  delete (rest as { isPresent?: boolean }).isPresent;
  delete (rest as { gender?: string }).gender;
  const description = rest.description ?? SR_1SG_BLOCK;
  const exp: WorkExperience = {
    id: 'exp-264',
    company: 'Ops',
    position: 'Koordinator terenske dokumentacije',
    startDate: '2022-03',
    endDate: isPresent ? '' : '2024-01',
    description,
    canonicalDescription: rest.canonicalDescription ?? description,
    originalUserDescription: rest.originalUserDescription ?? description,
    generatedDescription: '',
    descriptionOrigin: 'user',
    ...rest,
    isPresent,
  };
  const cv: CVData = {
    id: 'cv-264',
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      address: '',
      jobTitle: 'Koordinator terenske dokumentacije',
      gender: gender as 'male' | 'female',
    },
    summary: '',
    experience: [exp],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    contentLocale: 'sr',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const ctx = buildExperienceJobContext({
    position: exp.position,
    industry: 'general',
    locale: 'sr',
    level: 'mid',
  });
  return { cv, exp, ctx };
}

function runExactBuild264(opts?: {
  usageBefore?: number;
  providerText?: string;
  isPresent?: boolean;
  gender?: string;
}) {
  const usageBefore = opts?.usageBefore ?? 11;
  const providerText = opts?.providerText ?? PROVIDER_SAME_1SG;
  const { cv, exp, ctx } = build264Fixture({
    ...(opts?.isPresent === undefined ? {} : { isPresent: opts.isPresent }),
    ...(opts?.gender ? { gender: opts.gender } : {}),
  });
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: exp.description || '',
    canonicalText: exp.canonicalDescription || '',
    originalText: exp.originalUserDescription || '',
    locale: 'sr',
    requestId: 'req-264-exact',
    jobContextHash: ctx.key,
  });
  const auth = resolveExperienceAiAuthoritativeSource(exp);
  const frozen = ensureExperienceAiSourceFrozen(exp);
  const grounding = resolveExperienceAiGrounding(frozen, ctx, freezeExperienceAiDescription);
  grounding.sourceDescription = snapshot.normalizedSourceText;
  grounding.experienceForAi = {
    ...auth.experienceForAi,
    description: snapshot.normalizedSourceText,
    originalUserDescription: snapshot.normalizedSourceText,
    canonicalDescription: snapshot.normalizedSourceText,
  };
  grounding.groundingSource = 'genuine_user';

  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'sr',
    requestedLocale: 'sr',
    contentLocale: 'sr',
    templateId: 'modern-minimal',
    gender: opts?.gender || 'male',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    jobContextHash: ctx.key,
    requestId: 'req-264-exact',
    usageCountBefore: usageBefore,
  });
  session.stage('button_pressed', 'ok');
  session.recordLiveExperience(exp, Boolean(exp.isPresent));
  session.recordSourceSelection(exp, grounding, {
    requestedLocale: 'sr',
    selectedSourceKindHint: 'currentTextarea',
    operationalContentLocale: 'sr',
  });
  session.recordPayloadBuilt({
    locale: 'sr',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    isPresent: Boolean(exp.isPresent),
  });
  session.recordApiResponse({
    httpStatus: 200,
    fallbackUsed: false,
    resultText: providerText,
  });
  session.recordRaceCheck(true, undefined, ctx.key);

  const beforePerson = providerText;
  const perspTrace = normalizeExperienceBulletsPerspective(beforePerson, {
    locale: 'sr',
    isPresent: Boolean(exp.isPresent),
    gender: opts?.gender || 'male',
    sourceDescription: SR_1SG_BLOCK,
  });

  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'sr',
    gender: opts?.gender || 'male',
    cv: { ...cv, experience: [grounding.experienceForAi] },
    candidate: providerText,
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
    nextCv = applyFinalizedBulletsToCv(cv, 'sr', exp.id, finalized, ctx);
    recordProAiUserActionSuccess();
    usageAfter = getProAiUsageCount();
    session.recordVisibleApply(true, usageAfter, {
      visibleDescription: nextCv.experience[0].description || '',
      finalNormalizedText: finalized.text,
    });
  } else {
    session.recordVisibleApply(false, usageBefore);
  }

  return {
    finalized,
    nextCv,
    trace: session.commit(),
    auth,
    snapshot,
    usageBefore,
    usageAfter,
    perspTrace,
    beforePerson,
    afterPerson: perspTrace.text,
  };
}

describe('build 264 — perspective unit transforms', () => {
  it('transforms exact Serbian 1sg present verbs', () => {
    expect(normalizeExperienceBulletPerspective(SR_1SG[0], {
      locale: 'sr', isPresent: true, gender: 'male',
    })).toBe(SR_3SG[0]);
    expect(normalizeExperienceBulletPerspective(SR_1SG[1], {
      locale: 'sr', isPresent: true, gender: 'male',
    })).toBe(SR_3SG[1]);
    expect(normalizeExperienceBulletPerspective(SR_1SG[2], {
      locale: 'sr', isPresent: true, gender: 'male',
    })).toBe(SR_3SG[2]);
  });

  it('detects first vs third person separately from tenseMode', () => {
    expect(detectExperiencePersonMode(SR_1SG_BLOCK, 'sr')).toBe('first_singular');
    expect(detectExperiencePersonMode(SR_3SG.join('\n'), 'sr')).toBe('third_singular');
    expect(validateExperienceCvPerspective(SR_1SG_BLOCK, 'sr').ok).toBe(false);
    expect(validateExperienceCvPerspective(SR_3SG.join('\n'), 'sr').ok).toBe(true);
  });

  it('completed male/female past forms', () => {
    const male = normalizeExperienceBulletPerspective(SR_1SG[0], {
      locale: 'sr', isPresent: false, gender: 'male',
    });
    const female = normalizeExperienceBulletPerspective(SR_1SG[0], {
      locale: 'sr', isPresent: false, gender: 'female',
    });
    expect(male).toMatch(/^Pregledao\b/);
    expect(female).toMatch(/^Pregledala\b/);
    expect(male).toMatch(/označavao|označao/i);
  });

  it('Cyrillic 1sg → 3sg', () => {
    const cyr = 'Прегледам пристигле теренске извештаје и означавам непотпуне уносе.';
    const out = normalizeExperienceBulletPerspective(cyr, {
      locale: 'sr', isPresent: true, gender: 'male',
    });
    expect(out.startsWith('Прегледа')).toBe(true);
    expect(out).toMatch(/означава/);
  });
});

describe('build 264 — exact first-person provider regression', () => {
  beforeEach(() => seedUsage(11));

  it('exact fixture: provider 1sg → visible 3sg; usage 11→12', () => {
    seedUsage(11);
    const {
      finalized, nextCv, trace, usageBefore, usageAfter, perspTrace, beforePerson, afterPerson,
    } = runExactBuild264({ usageBefore: 11 });

    // Path trace (tests only — no raw PII beyond fixture constants)
    expect(detectExperiencePersonMode(beforePerson, 'sr')).toBe('first_singular');
    expect(detectExperiencePersonMode(afterPerson, 'sr')).toBe('third_singular');
    expect(perspTrace.perspectiveNormalizationApplied).toBe(true);

    expect(trace.selectedSourceKind).toBe('currentTextarea');
    expect(trace.contentLocale).toBe('sr');
    expect(trace.sourceFactIdentityCount).toBe(3);

    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.blocked).toBe(false);
    expect(finalized.diagnostics?.perspectiveNormalizationAttempted).toBe(true);
    expect(finalized.diagnostics?.perspectiveNormalizationApplied).toBe(true);
    expect(finalized.diagnostics?.perspectiveValidationPassed).toBe(true);
    expect(finalized.diagnostics?.normalizedBulletsUsedForApply).toBe(true);
    expect(finalized.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(finalized.diagnostics?.noOpRejected).toBe(false);
    expect(finalized.diagnostics?.sourcePersonMode).toBe('first_singular');
    expect(finalized.diagnostics?.finalPersonMode).toBe('third_singular');
    expect(finalized.diagnostics?.tenseMode).toBe('present');

    const bullets = splitExperienceBullets(finalized.text);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toBe(SR_3SG[0]);
    expect(bullets[1]).toBe(SR_3SG[1]);
    expect(bullets[2]).toBe(SR_3SG[2]);
    expect(bullets[0]).not.toMatch(/Pregledam|označavam/i);
    expect(bullets[1]).not.toMatch(/Ažuriram/i);
    expect(bullets[2]).not.toMatch(/Koordinišem/i);

    const visible = nextCv.experience[0].description || '';
    expect(splitExperienceBullets(visible)).toEqual(bullets);
    expect(nextCv.experience[0].generatedDescription || '').toContain('Pregleda');

    expect(usageBefore).toBe(11);
    expect(usageAfter).toBe(12);
    expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    expect(trace.meaningfulChangeDetected).toBe(true);
  });

  it('50× exact fixture — zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      seedUsage(11);
      const { finalized, usageAfter } = runExactBuild264({ usageBefore: 11 });
      expect(finalized.countedAsSuccess, `rep ${i}`).toBe(true);
      expect(splitExperienceBullets(finalized.text)[0], `rep ${i}`).toMatch(/^Pregleda\b/);
      expect(usageAfter, `rep ${i}`).toBe(12);
    }
  });
});

describe('build 264 — controls and negatives', () => {
  beforeEach(() => seedUsage(11));

  it('B: provider already third-person — apply once without over-transform', () => {
    seedUsage(11);
    const { cv, exp, ctx } = build264Fixture({
      description: SR_3SG.join('\n'),
      canonicalDescription: SR_3SG.join('\n'),
      originalUserDescription: SR_3SG.join('\n'),
    });
    // Provider returns improved wording that still preserves facts (not identical no-op).
    const improved = formatExperienceBullets([
      'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
      'Ažurira zajedničku tabelu sa najnovijim statusom svakodnevno.',
      'Koordiniše sa dva interna odeljenja kada nedostaju informacije.',
    ]);
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'male',
      cv,
      candidate: improved,
      experienceId: exp.id,
      industry: 'general',
      level: 'mid',
      jobContext: ctx,
      originHint: 'ai_generated',
    });
    expect(finalized.countedAsSuccess).toBe(true);
    expect(splitExperienceBullets(finalized.text)[0]).toMatch(/^Pregleda\b/);
    expect(finalized.diagnostics?.finalPersonMode).toBe('third_singular');
  });

  it('K: pure no-op provider≡source third-person → reject usage +0', () => {
    seedUsage(11);
    const block = SR_3SG.join('\n');
    const { cv, exp, ctx } = build264Fixture({
      description: block,
      canonicalDescription: block,
      originalUserDescription: block,
    });
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'male',
      cv,
      candidate: formatExperienceBullets(SR_3SG),
      experienceId: exp.id,
      industry: 'general',
      level: 'mid',
      jobContext: ctx,
      originHint: 'ai_generated',
    });
    // May fall through to fallback which also produces equivalent 3sg → still no-op
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.diagnostics?.noOpRejected || finalized.reason === 'experience_ai_noop').toBeTruthy();
    expect(getProAiUsageCount()).toBe(11);
  });

  it('C: first-person provider drops a material clause → do not accept incomplete', () => {
    seedUsage(11);
    const incomplete = formatExperienceBullets([
      'Pregledam pristigle terenske izveštaje.',
      'Ažuriram zajedničku tabelu sa najnovijim statusom.',
      'Koordinišem sa dva interna odeljenja kada nedostaju informacije.',
    ]);
    const { finalized } = runExactBuild264({ providerText: incomplete });
    // Incomplete provider may still pass weak coverage after perspective — require
    // material postcondition: dropped second clause must not be accepted.
    if (finalized.countedAsSuccess) {
      const bullets = splitExperienceBullets(finalized.text);
      expect(bullets).toHaveLength(3);
      expect(bullets[0]).toMatch(/nepotpune unose/i);
      expect(bullets[0]).toMatch(/^Pregleda\b/);
    } else {
      expect(finalized.blocked).toBe(true);
    }
  });

  it('D: tools/KPI addition rejected or repaired', () => {
    seedUsage(11);
    const polluted = formatExperienceBullets([
      'Pregledam pristigle terenske izveštaje i označavam nepotpune unose.',
      'Ažuriram zajedničku tabelu sa najnovijim statusom koristeći Excel KPI.',
      'Koordinišem sa dva interna odeljenja kada nedostaju informacije.',
    ]);
    const { finalized } = runExactBuild264({ providerText: polluted });
    if (finalized.countedAsSuccess) {
      expect(finalized.text).not.toMatch(/Excel|KPI/i);
      expect(splitExperienceBullets(finalized.text)[0]).toMatch(/^Pregleda\b/);
    } else {
      expect(finalized.blocked).toBe(true);
    }
  });

  it('E: neutral CV phrase accepted without forced awkward transform', () => {
    const neutral = 'Pregled pristiglih terenskih izveštaja i označavanje nepotpunih unosa.';
    expect(detectExperiencePersonMode(neutral, 'sr')).not.toBe('first_singular');
    expect(validateExperienceCvPerspective(neutral, 'sr').ok).toBe(true);
  });

  it('F/G: completed role male/female', () => {
    seedUsage(11);
    const male = runExactBuild264({ isPresent: false, gender: 'male' });
    expect(male.finalized.countedAsSuccess).toBe(true);
    expect(splitExperienceBullets(male.finalized.text)[0]).toMatch(/^Pregledao\b/);

    seedUsage(11);
    const female = runExactBuild264({ isPresent: false, gender: 'female' });
    expect(female.finalized.countedAsSuccess).toBe(true);
    expect(splitExperienceBullets(female.finalized.text)[0]).toMatch(/^Pregledala\b/);
  });

  it('I: English first-person transforms to CV style', () => {
    const line = 'I review incoming field reports and mark incomplete entries.';
    const out = normalizeExperienceBulletPerspective(line, {
      locale: 'en', isPresent: true,
    });
    expect(out).not.toMatch(/^I\b/i);
    expect(out).toMatch(/^Review\b/i);
  });

  it('J: other locales do not force Serbian morphology', () => {
    for (const locale of ['de', 'es', 'hi', 'ar', 'ja'] as Locale[]) {
      const sample = locale === 'de'
        ? 'Ich prüfe eingehende Berichte.'
        : locale === 'es'
          ? 'Yo reviso informes entrantes.'
          : locale === 'hi'
            ? 'मैं आने वाली रिपोर्ट की समीक्षा करता हूँ।'
            : locale === 'ar'
              ? 'أراجع التقارير الواردة.'
              : '現場報告を確認します。';
      const out = normalizeExperienceBulletPerspective(sample, {
        locale, isPresent: true, gender: 'male',
      });
      expect(out.length).toBeGreaterThan(5);
      if (locale === 'de') expect(out).not.toMatch(/^Ich\b/);
      if (locale === 'es') expect(out).not.toMatch(/^Yo\b/);
    }
  });
});

describe('build 264 — reload / PDF / DOCX', () => {
  beforeEach(() => seedUsage(11));

  it('reload + PDF/DOCX show third-person; export +0', async () => {
    seedUsage(11);
    const { finalized, nextCv, usageAfter } = runExactBuild264({ usageBefore: 11 });
    expect(usageAfter).toBe(12);
    expect(splitExperienceBullets(finalized.text)[0]).toMatch(/^Pregleda\b/);

    const reloaded: CVData = JSON.parse(JSON.stringify(nextCv));
    expect(splitExperienceBullets(reloaded.experience[0].description || '')[0]).toMatch(/^Pregleda\b/);

    const beforeExport = getProAiUsageCount();
    const prepared = prepareExportReadyCv(reloaded, 'sr');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    // PDF extract may interleave null bytes for some glyphs — strip before match.
    const pdfFlat = pdfText.replace(/\u0000/g, '');
    expect(pdfFlat).toMatch(/Pregleda|Ažurira|Koordiniše/i);
    expect(pdfFlat).not.toMatch(/Pregledam|Ažuriram|Koordinišem/);
    await exportToDOCX(prepared.cv, 'cv-264', 'sr', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(beforeExport);
  });
});

describe('build 264 — meaningful-change helper', () => {
  it('perspective conversion counts as meaningful', () => {
    expect(experienceAiHasMeaningfulChange(SR_1SG_BLOCK, formatExperienceBullets(SR_3SG), {
      perspectiveApplied: true,
    })).toBe(true);
  });
});
