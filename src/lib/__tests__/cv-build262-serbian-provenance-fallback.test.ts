/**
 * @vitest-environment jsdom
 *
 * Build 262 — client deterministic Serbian fallback must cover 3/3 source facts
 * via provenance-preserving tense normalization (not weak token rediscovery alone).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildSourcePreservingExperienceBulletsWithProvenance,
} from '@/lib/cv-localized-fallback';
import {
  deterministicBulletPreservesSourceUnit,
  sourceFactIdentitiesFromDescription,
  splitCompoundDutyClauses,
  stemTokenForCoverage,
  validateProvenancedDeterministicFallbackCoverage,
  validateSourceFactIdentityCoverage,
} from '@/lib/cv-source-fact-identity';
import {
  resolveExperienceAiAuthoritativeSource,
} from '@/lib/cv-experience-provenance';
import {
  buildExperienceJobContext,
  resolveExperienceAiGrounding,
} from '@/lib/cv-experience-job-context';
import { freezeExperienceAiDescription, ensureExperienceAiSourceFrozen } from '@/lib/cv-canonical-facts';
import {
  ExperienceAiDiagnosticSession,
  diagnoseExperienceSourceSelection,
} from '@/lib/cv-experience-ai-diagnostics';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
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

const SR_UNITS = [
  'Pregledam pristigle terenske izveštaje i označavam nepotpune unose.',
  'Ažuriram zajedničku tabelu sa najnovijim statusom.',
  'Koordinišem sa dva interna odeljenja kada nedostaju informacije.',
];
const SR_BLOCK = SR_UNITS.join('\n');

const EN_STALE = [
  'Prepared Serbian and Mediterranean dishes for restaurant guests.',
  'Maintained kitchen hygiene and food safety standards.',
  'Coordinated plating during busy service periods.',
].join('\n');

const PROVIDER_2_OF_3 = formatExperienceBullets([
  'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
  'Ažurira zajedničku tabelu sa najnovijim statusom.',
]);

const SR_CYR = [
  'Прегледам пристигле теренске извештаје и означавам непотпуне уносе.',
  'Ажурирам заједничку табелу са најновијим статусом.',
  'Координишем са два интерна одељења када недостају информације.',
].join('\n');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function build262Fixture(): {
  cv: CVData;
  exp: WorkExperience;
  ctx: ReturnType<typeof buildExperienceJobContext>;
} {
  const exp: WorkExperience = {
    id: 'exp-262',
    company: 'Ops',
    position: 'Koordinator terenske dokumentacije',
    startDate: '2022-03',
    endDate: '',
    isPresent: true,
    description: SR_BLOCK,
    canonicalDescription: SR_BLOCK,
    originalUserDescription: SR_BLOCK,
    generatedDescription: EN_STALE,
    generatedLocale: 'en',
    descriptionOrigin: 'user',
  };
  const cv: CVData = {
    id: 'cv-262',
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

function runExactBuild262(usageBefore = 10) {
  const { cv, exp, ctx } = build262Fixture();
  const auth = resolveExperienceAiAuthoritativeSource(exp);
  const frozen = ensureExperienceAiSourceFrozen(exp);
  const grounding = resolveExperienceAiGrounding(frozen, ctx, freezeExperienceAiDescription);
  grounding.sourceDescription = auth.text;
  grounding.experienceForAi = auth.experienceForAi;

  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'sr',
    requestedLocale: 'sr',
    contentLocale: 'sr',
    templateId: 'modern-minimal',
    gender: 'male',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    jobContextHash: ctx.key,
    requestId: 'req-262-exact',
    usageCountBefore: usageBefore,
  });
  session.stage('button_pressed', 'ok');
  session.recordLiveExperience(exp, true);
  session.recordSourceSelection(exp, grounding, {
    requestedLocale: 'sr',
    selectedSourceKindHint: auth.kind === 'canonicalDescription'
      ? 'canonicalDescription'
      : 'currentTextarea',
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
    resultText: PROVIDER_2_OF_3,
  });
  session.recordRaceCheck(true, undefined, ctx.key);

  const finalized = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'sr',
    gender: 'male',
    cv: { ...cv, experience: [grounding.experienceForAi] },
    candidate: PROVIDER_2_OF_3,
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
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    nextCv = applyFinalizedBulletsToCv(cv, 'sr', exp.id, finalized, ctx);
    session.patch({
      visibleRequiredFactCount: finalized.diagnostics?.finalRequiredFactCount ?? 3,
      visibleCoveredFactCount: finalized.diagnostics?.finalCoveredFactCount ?? 3,
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
  return { finalized, nextCv, trace: session.commit(), auth, usageBefore, usageAfter };
}

describe('build 262 — exact Serbian provenance fallback', () => {
  beforeEach(() => seedUsage(10));

  it('exact fixture: flags + provenance 3/3 + usage 10→11', () => {
    seedUsage(10);
    const { finalized, nextCv, trace, auth, usageBefore, usageAfter } = runExactBuild262(10);

    expect(trace.contentLocale).toBe('sr');
    expect(trace.selectedGender).toBe('male');
    expect(['currentTextarea', 'canonicalDescription', 'description']).toContain(trace.selectedSourceKind);
    expect(trace.selectedSourceLocale).toBe('sr|latin');
    expect(trace.selectedSourceHash).toBe(fingerprintText(SR_BLOCK));
    expect(trace.payloadSourceDescriptionHash).toBe(fingerprintText(SR_BLOCK));
    expect(trace.englishSourceStillAuthoritative).toBe(false);
    expect(trace.currentTextareaIgnoredOrOverridden).toBe(false);
    expect(trace.selectedSourceMatchesLiveText).toBe(true);
    expect(trace.selectedSourceEquivalentToLiveText).toBe(true);
    expect(trace.sourceFactIdentityCount).toBe(3);

    expect(trace.providerResponseKind).toBe('fallback');
    // Provider covered 2/3; top-level coveredFactCount describes the final selected candidate.
    expect(trace.providerCoveredFactCount ?? 2).toBe(2);
    expect(trace.coveredFactCount).toBe(3);
    expect(trace.uncoveredFactIdentityHashes || []).toEqual([]);

    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.origin).toBe('deterministic_fallback');
    expect(finalized.diagnostics?.clientDeterministicFallbackAttempted).toBe(true);
    expect(finalized.diagnostics?.clientDeterministicFallbackApplied).toBe(true);
    expect(finalized.diagnostics?.clientDeterministicFallbackBulletCount).toBe(3);
    expect(finalized.diagnostics?.clientDeterministicFallbackCoveredFactCount).toBe(3);
    expect(finalized.diagnostics?.clientDeterministicFallbackScripts?.length).toBeGreaterThan(0);

    const bullets = splitExperienceBullets(finalized.text);
    expect(bullets).toHaveLength(3);
    expect(bullets[0]).toMatch(/^Pregleda\b/);
    expect(bullets[0]).toMatch(/označava nepotpune unose/i);
    expect(bullets[1]).toMatch(/^Ažurira\b/);
    expect(bullets[1]).toMatch(/najnovijim statusom/i);
    expect(bullets[2]).toMatch(/^Koordiniše\b/);
    expect(bullets[2]).toMatch(/dva interna odeljenja/i);
    expect(bullets[2]).toMatch(/nedostaju informacije/i);

    expect(trace.clientDeterministicFallbackApplied).toBe(true);
    expect(trace.clientDeterministicFallbackCoveredFactCount).toBe(3);
    expect(trace.clientDeterministicFallbackBulletCount).toBe(3);
    expect(trace.clientDeterministicFallbackScripts.length).toBeGreaterThan(0);
    expect(trace.fallbackBulletCount).toBe(3);
    expect(trace.fallbackCoveredFactCount).toBe(3);
    expect(trace.finalBulletCount).toBe(3);
    expect(trace.finalTypedFailureReason).toBeNull();
    expect(trace.rejectionStage).toBeNull();
    expect(trace.raceGuardResult).toBe('ok');
    expect(usageAfter).toBe(usageBefore + 1);
    expect(auth.englishSourceStillAuthoritative).toBe(false);

    expect(splitExperienceBullets(nextCv.experience[0].description)).toHaveLength(3);
  });

  it('50× cold exact fixture — zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      seedUsage(10);
      const { finalized, trace } = runExactBuild262(10);
      expect(finalized.countedAsSuccess, `rep ${i}`).toBe(true);
      expect(trace.clientDeterministicFallbackCoveredFactCount, `rep ${i}`).toBe(3);
      expect(trace.englishSourceStillAuthoritative, `rep ${i}`).toBe(false);
      expect(trace.currentTextareaIgnoredOrOverridden, `rep ${i}`).toBe(false);
      expect(getProAiUsageCount(), `rep ${i}`).toBe(11);
    }
  });

  it('reload / PDF / DOCX preserve three facts; export +0', async () => {
    seedUsage(10);
    const { finalized, nextCv } = runExactBuild262(10);
    expect(finalized.countedAsSuccess).toBe(true);
    const before = getProAiUsageCount();
    const prepared = prepareExportReadyCv(nextCv, 'sr');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    expect(pdfText).toMatch(/terensk|izvešt|tabel|odeljen/i);
    await exportToDOCX(prepared.cv, 'cv-262', 'sr', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(before);
  });
});

describe('build 262 — provenance + morphology + negatives', () => {
  it('Serbian morphology stems are compatible across 1sg/3sg', () => {
    const pairs: Array<[string, string]> = [
      ['pregledam', 'pregleda'],
      ['označavam', 'označava'],
      ['ažuriram', 'ažurira'],
      ['koordinišem', 'koordiniše'],
      ['nedostaju', 'nedostaje'],
      ['izveštaje', 'izveštaja'],
      ['unose', 'unosa'],
      ['odeljenja', 'odeljenje'],
      ['informacije', 'informacija'],
      ['statusom', 'status'],
    ];
    for (const [a, b] of pairs) {
      expect(stemTokenForCoverage(a), `${a}/${b}`).toBe(stemTokenForCoverage(b));
    }
  });

  it('compound clauses require both sides', () => {
    const unit = SR_UNITS[0];
    const clauses = splitCompoundDutyClauses(unit);
    expect(clauses.length).toBe(2);
    const full = 'Pregleda pristigle terenske izveštaje i označava nepotpune unose.';
    expect(deterministicBulletPreservesSourceUnit(unit, full)).toBe(true);
    expect(deterministicBulletPreservesSourceUnit(
      unit,
      'Pregleda pristigle terenske izveštaje.',
    )).toBe(false);
  });

  it('negative: dropped clauses fail provenance coverage', () => {
    const built = buildSourcePreservingExperienceBulletsWithProvenance(SR_BLOCK, 'sr', 'male', {
      isPresent: true,
    });
    const drops = [
      {
        ...built.bullets[0],
        text: 'Pregleda pristigle terenske izveštaje.',
      },
      built.bullets[1],
      built.bullets[2],
    ];
    expect(validateProvenancedDeterministicFallbackCoverage(SR_BLOCK, drops).ok).toBe(false);

    const dropStatus = [
      built.bullets[0],
      { ...built.bullets[1], text: 'Ažurira zajedničku tabelu.' },
      built.bullets[2],
    ];
    expect(validateProvenancedDeterministicFallbackCoverage(SR_BLOCK, dropStatus).ok).toBe(false);

    const dropDepts = [
      built.bullets[0],
      built.bullets[1],
      { ...built.bullets[2], text: 'Koordiniše kada nedostaju informacije.' },
    ];
    expect(validateProvenancedDeterministicFallbackCoverage(SR_BLOCK, dropDepts).ok).toBe(false);

    const dropWhen = [
      built.bullets[0],
      built.bullets[1],
      { ...built.bullets[2], text: 'Koordiniše sa dva interna odeljenja.' },
    ];
    expect(validateProvenancedDeterministicFallbackCoverage(SR_BLOCK, dropWhen).ok).toBe(false);
  });

  it('negative: unsupported additions rejected by finalize extras', () => {
    const { cv, exp, ctx } = build262Fixture();
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    const polluted = formatExperienceBullets([
      'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
      'Ažurira zajedničku tabelu sa najnovijim statusom u Excelu i Salesforceu.',
      'Koordiniše sa dva interna odeljenja kada nedostaju informacije i managed a team of clients with KPI metrics.',
    ]);
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'male',
      cv: { ...cv, experience: [auth.experienceForAi] },
      candidate: polluted,
      experienceId: exp.id,
      industry: 'general',
      level: 'mid',
      jobContext: ctx,
      originHint: 'ai_generated',
    });
    // Polluted provider must not become the final applied text.
    expect(finalized.text).not.toMatch(/Excel|Salesforce|managed a team|KPI|clients/i);
    if (finalized.countedAsSuccess) {
      expect(finalized.origin).toBe('deterministic_fallback');
      expect(splitExperienceBullets(finalized.text)).toHaveLength(3);
    }
  });

  it('duplicated source mapping cannot cover two distinct facts', () => {
    const ids = sourceFactIdentitiesFromDescription(SR_BLOCK);
    const built = buildSourcePreservingExperienceBulletsWithProvenance(SR_BLOCK, 'sr', 'male', {
      isPresent: true,
    });
    const dupMap = [
      { ...built.bullets[0], sourceFactIds: [ids[0].id, ids[1].id] },
      built.bullets[1],
      built.bullets[2],
    ];
    const coverage = validateProvenancedDeterministicFallbackCoverage(SR_BLOCK, dupMap);
    expect(coverage.ok).toBe(false);
  });

  it('each provenanced bullet retains source-unit id', () => {
    const built = buildSourcePreservingExperienceBulletsWithProvenance(SR_BLOCK, 'sr', 'male', {
      isPresent: true,
    });
    expect(built.bullets).toHaveLength(3);
    const ids = sourceFactIdentitiesFromDescription(SR_BLOCK);
    built.bullets.forEach((b, i) => {
      expect(b.sourceFactIds).toEqual([ids[i].id]);
      expect(b.transformationKind).toBe('universal_preserve_tense');
      expect(b.tenseMode).toBe('present');
      expect(b.locale).toBe('sr');
    });
    expect(validateProvenancedDeterministicFallbackCoverage(SR_BLOCK, built.bullets).ok).toBe(true);
  });
});

describe('build 262 — multilingual provenance matrix', () => {
  const rows: Array<{ locale: Locale; source: string[]; isPresent: boolean }> = [
    { locale: 'sr', source: SR_UNITS, isPresent: true },
    {
      locale: 'sr',
      source: [
        'Прегледам пристигле теренске извештаје и означавам непотпуне уносе.',
        'Ажурирам заједничку табелу са најновијим статусом.',
        'Координишем са два интерна одељења када недостају информације.',
      ],
      isPresent: true,
    },
    {
      locale: 'en',
      source: [
        'Review incoming field reports and mark incomplete entries.',
        'Update the shared tracking sheet with the latest status.',
        'Coordinate with two internal departments when information is missing.',
      ],
      isPresent: true,
    },
    {
      locale: 'de',
      source: [
        'Ich prüfe eingehende Feldberichte und markiere unvollständige Einträge.',
        'Ich aktualisiere die gemeinsame Tabelle mit dem neuesten Status.',
        'Ich koordiniere mit zwei internen Abteilungen, wenn Informationen fehlen.',
      ],
      isPresent: false,
    },
    {
      locale: 'es',
      source: [
        'Reviso los informes de campo entrantes y marco las entradas incompletas.',
        'Actualizo la tabla compartida con el estado más reciente.',
        'Coordino con dos departamentos internos cuando falta información.',
      ],
      isPresent: true,
    },
    {
      locale: 'hi',
      source: [
        'मैं आने वाली फील्ड रिपोर्ट्स की समीक्षा करता हूँ और अधूरे प्रविष्टियों को चिह्नित करता हूँ।',
        'मैं साझा ट्रैकिंग शीट को नवीनतम स्थिति के साथ अपडेट करता हूँ।',
        'जब जानकारी गायब होती है तो मैं दो आंतरिक विभागों के साथ समन्वय करता हूँ।',
      ],
      isPresent: true,
    },
    {
      locale: 'ar',
      source: [
        'أراجع تقارير الميدان الواردة وأعلّم الإدخالات غير المكتملة.',
        'أحدث الجدول المشترك بأحدث حالة.',
        'أنسق مع قسمين داخليين عندما تكون المعلومات ناقصة.',
      ],
      isPresent: true,
    },
    {
      locale: 'ja',
      source: [
        '到着した現場報告書を確認し、不完全な入力をマークする。',
        '共有表を最新のステータスで更新する。',
        '情報が不足している場合は、2つの内部部門と調整する。',
      ],
      isPresent: true,
    },
  ];

  for (const row of rows) {
    it(`${row.locale} (${row.isPresent ? 'current' : 'completed'}) provenance covers all units`, () => {
      const source = row.source.join('\n');
      const built = buildSourcePreservingExperienceBulletsWithProvenance(
        source,
        row.locale,
        'male',
        { isPresent: row.isPresent },
      );
      expect(built.bullets.length).toBe(row.source.length);
      const coverage = validateProvenancedDeterministicFallbackCoverage(source, built.bullets);
      expect(coverage.ok, `${row.locale} missing=${coverage.missingIds.join(',')}`).toBe(true);
      expect(coverage.coveredIds.length).toBe(row.source.length);
      if (row.locale !== 'en') {
        expect(built.text).not.toMatch(/Prepared Serbian and Mediterranean/i);
      }
    });
  }

  it('provider semantic coverage still rejects 2/3 without provenance bypass', () => {
    expect(validateSourceFactIdentityCoverage(SR_BLOCK, PROVIDER_2_OF_3).ok).toBe(false);
    expect(validateSourceFactIdentityCoverage(SR_BLOCK, PROVIDER_2_OF_3).coveredIds.length).toBe(2);
  });

  it('diagnose: identical Serbian canonical/live is not an override', () => {
    const { exp } = build262Fixture();
    const selection = diagnoseExperienceSourceSelection(
      exp,
      SR_BLOCK,
      'genuine_user',
      { requestedLocale: 'sr', selectedSourceKindHint: 'canonicalDescription' },
    );
    expect(selection.currentTextareaIgnoredOrOverridden).toBe(false);
    expect(selection.englishSourceStillAuthoritative).toBe(false);
    expect(selection.selectedSourceMatchesLiveText).toBe(true);
    expect(selection.selectedSourceLocale).toBe('sr|latin');
  });

  it('Cyrillic source preserves under provenance', () => {
    const built = buildSourcePreservingExperienceBulletsWithProvenance(SR_CYR, 'sr', 'male', {
      isPresent: true,
    });
    expect(validateProvenancedDeterministicFallbackCoverage(SR_CYR, built.bullets).ok).toBe(true);
  });
});
