/**
 * @vitest-environment jsdom
 *
 * Build 261 — exact Android build-261 diagnostic regression:
 * materially edited live Serbian textarea must beat stale English canonical,
 * and provider/server coverage failure must trigger client source-preserving
 * fallback that applies 3/3 Serbian bullets and counts usage once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  freezeExperienceAiDescription,
  ensureExperienceAiSourceFrozen,
} from '@/lib/cv-canonical-facts';
import {
  resolveExperienceAiAuthoritativeSource,
  experienceTextsMateriallyDiffer,
} from '@/lib/cv-experience-provenance';
import { applyCanonicalExperienceEdit } from '@/lib/cv-canonical-snapshot';
import {
  buildExperienceJobContext,
  resolveExperienceAiGrounding,
} from '@/lib/cv-experience-job-context';
import {
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import { fingerprintText as fp } from '@/lib/cv-export-diagnostics';
import {
  extractSourceDutyUnits,
  sourceFactIdentitiesFromDescription,
  validateSourceFactIdentityCoverage,
} from '@/lib/cv-source-fact-identity';
import { buildSourcePreservingExperienceBullets } from '@/lib/cv-localized-fallback';
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

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

const SR_LATIN_DUTIES = [
  'Pregledam pristigle terenske izveštaje i označavam nepotpune unose.',
  'Ažuriram zajedničku tabelu sa najnovijim statusom.',
  'Koordinišem sa dva interna odeljenja kada nedostaju informacije.',
];
const SR_BLOCK = SR_LATIN_DUTIES.join('\n');

const EN_STALE_DUTIES = [
  'Prepared Serbian and Mediterranean dishes for restaurant guests.',
  'Maintained kitchen hygiene and food safety standards.',
  'Coordinated plating during busy service periods.',
];
const EN_STALE = EN_STALE_DUTIES.join('\n');

/** Provider/server output covering only 2 of 3 Serbian facts. */
const PROVIDER_FALLBACK_2_OF_3 = formatExperienceBullets([
  'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
  'Ažurira zajedničku tabelu sa najnovijim statusom.',
  // Missing coordination fact — collapses / omits third duty
]);

const SR_CYRILLIC = [
  'Прегледам пристигле теренске извештаје и означавам непотпуне уносе.',
  'Ажурирам заједничку табелу са најновијим статусом.',
  'Координишем са два интерна одељења када недостају информације.',
].join('\n');

const HI_DUTIES = [
  'मैं आने वाली फील्ड रिपोर्ट्स की समीक्षा करता हूँ और अधूरे प्रविष्टियों को चिह्नित करता हूँ।',
  'मैं साझा ट्रैकिंग शीट को नवीनतम स्थिति के साथ अपडेट करता हूँ।',
  'जब जानकारी गायब होती है तो मैं दो आंतरिक विभागों के साथ समन्वय करता हूँ।',
].join('\n');

const AR_DUTIES = [
  'أراجع تقارير الميدان الواردة وأعلّم الإدخالات غير المكتملة.',
  'أحدث الجدول المشترك بأحدث حالة.',
  'أنسق مع قسمين داخليين عندما تكون المعلومات ناقصة.',
].join('\n');

const JA_DUTIES = [
  '到着した現場報告書を確認し、不完全な入力をマークする。',
  '共有表を最新のステータスで更新する。',
  '情報が不足している場合は、2つの内部部門と調整する。',
].join('\n');

function build261Fixture(overrides?: Partial<WorkExperience>): {
  cv: CVData;
  exp: WorkExperience;
  ctx: ReturnType<typeof buildExperienceJobContext>;
} {
  const exp: WorkExperience = {
    id: 'exp-261',
    company: 'Terrain Ops',
    position: 'Koordinator terenske dokumentacije',
    startDate: '2022-03',
    endDate: '',
    isPresent: true,
    description: SR_BLOCK,
    originalUserDescription: EN_STALE,
    canonicalDescription: EN_STALE,
    generatedDescription: EN_STALE,
    generatedLocale: 'en',
    descriptionOrigin: 'user_confirmed_ai_edit',
    generationJobContextKey: undefined,
    ...overrides,
  };
  const cv: CVData = {
    id: 'cv-261',
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      address: '',
      jobTitle: 'Koordinator terenske dokumentacije',
      gender: 'male',
    },
    summary: '',
    experience: [exp],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    contentLocale: 'en',
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

function runExactBuild261Pipeline(usageBefore = 9) {
  const { cv, exp, ctx } = build261Fixture();
  const authoritative = resolveExperienceAiAuthoritativeSource(exp);
  const frozen = ensureExperienceAiSourceFrozen(exp);
  const grounding = resolveExperienceAiGrounding(
    frozen,
    ctx,
    freezeExperienceAiDescription,
  );
  grounding.sourceDescription = authoritative.text;
  grounding.experienceForAi = authoritative.experienceForAi;

  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'sr',
    requestedLocale: 'sr',
    contentLocale: 'sr',
    templateId: 'modern-minimal',
    gender: 'male',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    jobContextHash: ctx.key,
    requestId: 'req-261-exact',
    usageCountBefore: usageBefore,
  });
  session.stage('button_pressed', 'ok');
  session.recordLiveExperience(exp, true);
  session.recordSourceSelection(exp, grounding, {
    requestedLocale: 'sr',
    selectedSourceKindHint: 'currentTextarea',
    operationalContentLocale: 'sr',
  });
  session.recordPayloadBuilt({
    locale: 'sr',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    isPresent: true,
  });
  session.recordApiResponse({
    httpStatus: 200,
    fallbackUsed: true,
    resultText: PROVIDER_FALLBACK_2_OF_3,
  });
  session.recordRaceCheck(true, undefined, ctx.key);

  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'sr',
    gender: 'male',
    cv: {
      ...cv,
      experience: [grounding.experienceForAi],
    },
    candidate: PROVIDER_FALLBACK_2_OF_3,
    experienceId: exp.id,
    industry: 'general',
    level: 'mid',
    jobContext: ctx,
    originHint: 'deterministic_fallback',
  });
  session.recordFinalizeResult(finalized);

  let nextCv = cv;
  let usageAfter = usageBefore;
  if (finalized.countedAsSuccess && !finalized.blocked) {
    nextCv = applyFinalizedBulletsToCv(cv, 'sr', exp.id, finalized, ctx);
    recordProAiUserActionSuccess();
    usageAfter = getProAiUsageCount();
    session.recordVisibleApply(true, usageAfter);
  } else {
    session.recordVisibleApply(false, usageBefore);
  }
  const trace = session.commit();
  return { finalized, nextCv, trace, grounding, authoritative, usageBefore, usageAfter };
}

describe('build 261 — Serbian live source + client fallback', () => {
  beforeEach(() => {
    seedUsage(9);
  });

  it('exact fixture: live Serbian wins over stale English canonical', () => {
    const { exp } = build261Fixture();
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    expect(auth.kind).toBe('currentTextarea');
    expect(auth.text).toBe(SR_BLOCK);
    expect(auth.currentTextareaIgnoredOrOverridden).toBe(false);
    expect(auth.englishSourceStillAuthoritative).toBe(false);
    expect(freezeExperienceAiDescription(exp)).toBe(SR_BLOCK);
    expect(extractSourceDutyUnits(auth.text)).toHaveLength(3);
    expect(sourceFactIdentitiesFromDescription(auth.text)).toHaveLength(3);
  });

  it('exact build-261 pipeline: client fallback applies 3/3 and usage 9→10', () => {
    seedUsage(9);

    const { finalized, nextCv, trace, authoritative, usageBefore, usageAfter } =
      runExactBuild261Pipeline(getProAiUsageCount());

    expect(authoritative.kind).toBe('currentTextarea');
    expect(trace.contentLocale).toBe('sr');
    expect(trace.selectedGender).toBe('male');
    expect(trace.selectedSourceKind).toBe('currentTextarea');
    expect(trace.selectedSourceLocale).toBe('sr|latin');
    expect(trace.englishSourceStillAuthoritative).toBe(false);
    expect(trace.currentTextareaIgnoredOrOverridden).toBe(false);
    expect(trace.sourceUnitCount).toBe(3);
    expect(trace.sourceFactIdentityCount).toBe(3);
    expect(trace.payloadSourceDescriptionHash).toBe(fp(SR_BLOCK));
    expect(trace.payloadLocale).toBe('sr');
    expect(trace.factLockEnabled).toBe(true);

    expect(trace.providerResponseKind).toBe('fallback');
    expect(trace.apiResponseKind).toBe('fallback');
    expect(trace.serverFallbackUsed).toBe(true);
    expect(trace.coveredFactCount).toBeLessThan(3);

    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.blocked).toBe(false);
    expect(finalized.origin).toBe('deterministic_fallback');
    expect(finalized.diagnostics?.clientDeterministicFallbackAttempted).toBe(true);
    expect(finalized.diagnostics?.clientDeterministicFallbackApplied).toBe(true);
    expect(finalized.diagnostics?.clientDeterministicFallbackBulletCount).toBe(3);
    expect(finalized.diagnostics?.clientDeterministicFallbackCoveredFactCount).toBe(3);

    const bullets = splitExperienceBullets(finalized.text);
    expect(bullets).toHaveLength(3);
    expect(validateSourceFactIdentityCoverage(SR_BLOCK, finalized.text).ok).toBe(true);

    expect(trace.clientDeterministicFallbackAttempted).toBe(true);
    expect(trace.clientDeterministicFallbackApplied).toBe(true);
    expect(trace.clientDeterministicFallbackBulletCount).toBe(3);
    expect(trace.clientDeterministicFallbackCoveredFactCount).toBe(3);
    expect(trace.finalBulletCount).toBe(3);
    expect(trace.finalTypedFailureReason).toBeNull();
    expect(trace.rejectionStage).toBeNull();
    expect(trace.raceGuardResult).toBe('ok');
    expect(trace.countedAsSuccess).toBe(true);
    expect(usageAfter).toBe(usageBefore + 1);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);
    expect(trace.selectedGender).toBe('male');

    // Applied text survives on CV
    expect(nextCv.experience[0].description).toContain('Pregleda');
    expect(splitExperienceBullets(nextCv.experience[0].description)).toHaveLength(3);
  });

  it('50× cold exact Serbian fixture — zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      seedUsage(9);
      const { finalized, trace } = runExactBuild261Pipeline(9);
      expect(finalized.countedAsSuccess, `rep ${i}`).toBe(true);
      expect(trace.finalBulletCount, `rep ${i}`).toBe(3);
      expect(trace.clientDeterministicFallbackApplied, `rep ${i}`).toBe(true);
      expect(trace.currentTextareaIgnoredOrOverridden, `rep ${i}`).toBe(false);
      expect(trace.englishSourceStillAuthoritative, `rep ${i}`).toBe(false);
      expect(getProAiUsageCount(), `rep ${i}`).toBe(10);
    }
  });

  it('reload / PDF / DOCX preserve three Serbian facts; export usage +0', async () => {
    seedUsage(9);
    const { finalized, nextCv } = runExactBuild261Pipeline(9);
    expect(finalized.countedAsSuccess).toBe(true);
    const usageBeforeExport = getProAiUsageCount();

    const prepared = prepareExportReadyCv(nextCv, 'sr');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const bullets = splitExperienceBullets(prepared.cv.experience[0].description);
    expect(bullets.length).toBeGreaterThanOrEqual(3);

    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    expect(pdfText).toMatch(/terensk|izvešt|tabel|odeljen/i);

    await exportToDOCX(prepared.cv, 'cv-261', 'sr', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(usageBeforeExport);
  });
});

describe('build 261 — source-selection matrix', () => {
  const locales: Array<{ locale: Locale; live: string }> = [
    { locale: 'en', live: EN_STALE },
    { locale: 'sr', live: SR_BLOCK },
    { locale: 'sr', live: SR_CYRILLIC },
    { locale: 'hi', live: HI_DUTIES },
    { locale: 'ar', live: AR_DUTIES },
    { locale: 'ja', live: JA_DUTIES },
  ];

  it('A: live edited beats stale canonical', () => {
    const { exp } = build261Fixture();
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    expect(auth.kind).toBe('currentTextarea');
    expect(auth.text).toBe(SR_BLOCK);
  });

  it('B: live equals current-context canonical — reuse allowed (same text)', () => {
    const { exp } = build261Fixture({
      description: SR_BLOCK,
      canonicalDescription: SR_BLOCK,
      originalUserDescription: SR_BLOCK,
      generatedDescription: undefined,
      descriptionOrigin: 'user',
    });
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    expect(experienceTextsMateriallyDiffer(auth.text, SR_BLOCK)).toBe(false);
    expect(auth.currentTextareaIgnoredOrOverridden).toBe(false);
  });

  it('C: empty live → genuine canonical used', () => {
    const { exp } = build261Fixture({
      description: '',
      canonicalDescription: SR_BLOCK,
      originalUserDescription: SR_BLOCK,
      descriptionOrigin: 'user',
    });
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    // Empty live → Generation Mode: never promote canonical/generated into AI source.
    expect(auth.text).toBe('');
    expect(auth.kind).toBe('none');
  });

  it('D: position/industry change excludes stale AI via job context', () => {
    const bakerCtx = buildExperienceJobContext({
      position: 'Baker',
      industry: 'hospitality',
      locale: 'en',
      level: 'mid',
    });
    const pharmCtx = buildExperienceJobContext({
      position: 'Pharmacist',
      industry: 'pharmacy',
      locale: 'en',
      level: 'mid',
    });
    const cooking = [
      '• Prepare dishes according to restaurant standards.',
      '• Maintain workplace hygiene.',
      '• Collaborate with the kitchen team.',
    ].join('\n');
    const exp: WorkExperience = {
      id: 'x',
      company: 'C',
      position: 'Pharmacist',
      startDate: '2020-01',
      endDate: '',
      isPresent: true,
      description: cooking,
      canonicalDescription: cooking,
      originalUserDescription: cooking,
      descriptionOrigin: 'ai_generated',
      generationJobContextKey: bakerCtx.key,
      recoveredSemanticDuties: [
        { key: 'food_prep', confidence: 'narrow_supported', sourceClauseIndex: 0 },
      ],
    };
    const grounding = resolveExperienceAiGrounding(exp, pharmCtx, freezeExperienceAiDescription);
    expect(grounding.staleGeneratedContentExcluded || grounding.sourceDescription === '').toBe(true);
    expect(bakerCtx.key).not.toBe(pharmCtx.key);
  });

  it('E: locale changed + new localized live text wins', () => {
    const { exp } = build261Fixture({
      description: HI_DUTIES,
      descriptionOrigin: 'user_confirmed_ai_edit',
      generatedLocale: 'en',
    });
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    expect(auth.text).toBe(HI_DUTIES);
    expect(auth.kind).toBe('currentTextarea');
  });

  it('F: locale changed, user did not edit AI display — canonical may remain for AI translate', () => {
    const { exp } = build261Fixture({
      description: EN_STALE,
      generatedDescription: EN_STALE,
      canonicalDescription: EN_STALE,
      originalUserDescription: EN_STALE,
      descriptionOrigin: 'ai_generated',
    });
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    expect(auth.kind === 'canonicalDescription' || auth.text === EN_STALE).toBe(true);
  });

  it('G: same locale, duties completely replaced', () => {
    const replacement = [
      'Vodim evidenciju o zalihama kancelarijskog materijala.',
      'Šaljem nedeljne izveštaje nadređenom.',
      'Arhiviram ugovore u digitalnom sistemu.',
    ].join('\n');
    const { exp } = build261Fixture({
      description: replacement,
      descriptionOrigin: 'user',
    });
    expect(resolveExperienceAiAuthoritativeSource(exp).text).toBe(replacement);
  });

  it('H: unknown title still works with live source', () => {
    const { exp, ctx } = build261Fixture({
      position: 'Specijalista za nepoznatu ulogu XYZ',
    });
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    const grounding = resolveExperienceAiGrounding(
      ensureExperienceAiSourceFrozen(exp),
      ctx,
      freezeExperienceAiDescription,
    );
    expect(auth.text).toBe(SR_BLOCK);
    expect(grounding.sourceDescription.length).toBeGreaterThan(20);
  });

  it('I: autosave lag — visible textarea value still wins via DOM-equivalent live description', () => {
    // Simulate React state still holding English while live description arg is Serbian.
    const staleState = build261Fixture({
      description: EN_STALE,
      descriptionOrigin: 'ai_generated',
    }).exp;
    const liveFromDom = { ...staleState, description: SR_BLOCK, descriptionOrigin: 'user_confirmed_ai_edit' as const };
    const auth = resolveExperienceAiAuthoritativeSource(liveFromDom);
    expect(auth.text).toBe(SR_BLOCK);
    expect(auth.kind).toBe('currentTextarea');
  });

  it('J: race — finalize against old context must not apply when caller rejects', () => {
    const { cv, exp, ctx } = build261Fixture();
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'male',
      cv: { ...cv, experience: [auth.experienceForAi] },
      candidate: PROVIDER_FALLBACK_2_OF_3,
      experienceId: exp.id,
      industry: 'general',
      level: 'mid',
      jobContext: ctx,
      originHint: 'deterministic_fallback',
    });
    expect(finalized.countedAsSuccess).toBe(true);
    // Race rejection is the caller's job — usage stays unchanged when apply is skipped.
    const before = getProAiUsageCount();
    // intentionally do not apply / increment
    expect(getProAiUsageCount()).toBe(before);
  });

  it('multilingual live-edit matrix prefers live text', () => {
    for (const row of locales) {
      const { exp } = build261Fixture({
        description: row.live,
        descriptionOrigin: 'user_confirmed_ai_edit',
      });
      const auth = resolveExperienceAiAuthoritativeSource(exp);
      expect(auth.text, row.locale).toBe(row.live);
      expect(auth.currentTextareaIgnoredOrOverridden, row.locale).toBe(false);
    }
  });

  it('applyCanonicalExperienceEdit marks material Serbian edit as user grounding', () => {
    const { cv } = build261Fixture({
      description: EN_STALE,
      descriptionOrigin: 'ai_generated',
      canonicalDescription: EN_STALE,
      originalUserDescription: EN_STALE,
    });
    const next = applyCanonicalExperienceEdit(cv, 'exp-261', 'description', SR_BLOCK, 'sr');
    const e = next.experience[0];
    expect(e.description).toBe(SR_BLOCK);
    expect(e.descriptionOrigin).toBe('user_confirmed_ai_edit');
    expect(experienceTextsMateriallyDiffer(e.originalUserDescription || '', SR_BLOCK)).toBe(false);
    expect(experienceTextsMateriallyDiffer(e.canonicalDescription || '', SR_BLOCK)).toBe(false);
    expect(next.contentLocale === 'sr' || next.canonicalSnapshot?.canonicalLocale === 'sr').toBe(true);
  });
});

describe('build 261 — multilingual client fallback matrix', () => {
  const cases: Array<{ locale: Locale; source: string; gender: string }> = [
    { locale: 'sr', source: SR_BLOCK, gender: 'male' },
    { locale: 'en', source: formatExperienceBullets([
      'Review incoming field reports and mark incomplete entries.',
      'Update the shared tracking sheet with the latest status.',
      'Coordinate with two internal departments when information is missing.',
    ]), gender: 'male' },
    { locale: 'hi', source: HI_DUTIES, gender: 'male' },
    { locale: 'ar', source: AR_DUTIES, gender: 'male' },
    { locale: 'ja', source: JA_DUTIES, gender: 'male' },
  ];

  for (const row of cases) {
    it(`${row.locale}: provider omit-one-fact → client fallback covers all`, () => {
      const units = extractSourceDutyUnits(row.source);
      const partial = formatExperienceBullets(units.slice(0, Math.max(1, units.length - 1)));
      const exp: WorkExperience = {
        id: 'exp-m',
        company: 'C',
        position: 'Role',
        startDate: '2021-01',
        endDate: '',
        isPresent: true,
        description: row.source,
        originalUserDescription: row.source,
        canonicalDescription: row.source,
        descriptionOrigin: 'user',
      };
      const cv: CVData = {
        id: 'cv-m',
        name: 'CV',
        personal: {
          fullName: 'T',
          email: 't@e.com',
          phone: '',
          address: '',
          jobTitle: 'Role',
          gender: row.gender,
        },
        summary: '',
        experience: [exp],
        education: [],
        skills: [],
        languages: [],
        certifications: [],
        templateId: 'modern-minimal',
        region: 'US',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const ctx = buildExperienceJobContext({
        position: exp.position,
        industry: 'general',
        locale: row.locale,
        level: 'mid',
      });
      const auth = resolveExperienceAiAuthoritativeSource(exp);
      const finalized = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale: row.locale,
        gender: row.gender,
        cv: { ...cv, experience: [auth.experienceForAi] },
        candidate: partial,
        experienceId: exp.id,
        industry: 'general',
        level: 'mid',
        jobContext: ctx,
        originHint: 'deterministic_fallback',
      });
      expect(finalized.diagnostics?.clientDeterministicFallbackAttempted).toBe(true);
      expect(finalized.countedAsSuccess).toBe(true);
      expect(splitExperienceBullets(finalized.text).length).toBe(units.length);
      expect(validateSourceFactIdentityCoverage(row.source, finalized.text).ok).toBe(true);
      if (row.locale !== 'en') {
        expect(finalized.text).not.toMatch(/Prepared Serbian and Mediterranean/i);
      }
    });
  }

  it('server-fallback label does not skip client fallback', () => {
    const preserved = buildSourcePreservingExperienceBullets(SR_BLOCK, 'sr', 'male', { isPresent: true });
    expect(splitExperienceBullets(preserved).length).toBe(3);
    const { finalized } = runExactBuild261Pipeline(9);
    expect(finalized.origin).toBe('deterministic_fallback');
    expect(finalized.diagnostics?.serverFallbackUsed).toBe(true);
    expect(finalized.diagnostics?.clientDeterministicFallbackApplied).toBe(true);
  });
});
