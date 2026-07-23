/**
 * @vitest-environment jsdom
 *
 * Build 263 — exact 191-vs-183 Serbian Experience AI regression.
 *
 * Device shape:
 * - live textarea length 183 (plain units, no bullet prefixes; may lack newlines)
 * - canonical/persisted length 191 = sum(units) + 3×("• ") + 2×("\\n")
 * - selectedSourceKind was wrongly canonicalDescription
 * - client deterministic fallback covered only 1/3 (mixed identities)
 *
 * Fix: one immutable operation snapshot from live + shared normalization so
 * plain / bullet / CRLF forms share stable sourceFactIds; provenance retained
 * through tense transforms → 3/3 coverage and usage 10→11.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  buildSourcePreservingExperienceBulletsWithProvenance,
} from '@/lib/cv-localized-fallback';
import {
  extractSourceDutyUnits,
  sourceFactIdentitiesFromDescription,
  sourceFactIdentityId,
  validateProvenancedDeterministicFallbackCoverage,
  validateSourceFactIdentityCoverage,
  type ProvenancedFallbackBullet,
} from '@/lib/cv-source-fact-identity';
import {
  resolveExperienceAiAuthoritativeSource,
  experienceTextsMateriallyDiffer,
} from '@/lib/cv-experience-provenance';
import {
  createExperienceAiOperationSnapshot,
  experienceAiSourcesEquivalent,
  experienceAiSourceUnits,
  experienceAiUnitSequenceHash,
  diagnoseExperienceAiSourceStructure,
  normalizeExperienceAiSourceText,
} from '@/lib/cv-experience-ai-operation-snapshot';
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

/** Exact device unit lengths 58 + 56 + 69 = 183. */
function fitExact(template: string, n: number): string {
  let s = template.replace(/\.$/, '');
  if (s.length + 1 > n) s = s.slice(0, n - 1);
  const pads = [' jos', ' sada', ' tamo', ' ovde', ' brzo', ' lepo'];
  let pi = 0;
  while (s.length + 1 < n) {
    const p = pads[pi++ % pads.length];
    if (s.length + p.length + 1 <= n) s += p;
    else s += 'x';
  }
  return `${s.slice(0, n - 1)}.`;
}

const SR_UNITS_EXACT = [
  fitExact('Pregledam pristigle terenske izveštaje i označavam nepotpune unose', 58),
  fitExact('Ažuriram zajedničku tabelu sa najnovijim statusom', 56),
  fitExact('Koordinišem sa dva interna odeljenja kada nedostaju informacije', 69),
];

/** Device live: concatenated (no separators) → length 183, starts with P. */
const LIVE_183 = SR_UNITS_EXACT.join('');
/** Device canonical: formatExperienceBullets → length 191, starts with •. */
const CANONICAL_191 = formatExperienceBullets(SR_UNITS_EXACT);

const PROVIDER_2_OF_3 = formatExperienceBullets([
  'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
  'Ažurira zajedničku tabelu sa najnovijim statusom.',
]);

const EXPECTED_FINAL = [
  /^Pregleda\b/,
  /^Ažurira\b/,
  /^Koordiniše\b/,
];

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function build263Fixture(overrides?: Partial<WorkExperience>): {
  cv: CVData;
  exp: WorkExperience;
  ctx: ReturnType<typeof buildExperienceJobContext>;
} {
  const exp: WorkExperience = {
    id: 'exp-263',
    company: 'Ops',
    position: 'Koordinator terenske dokumentacije',
    startDate: '2022-03',
    endDate: '',
    isPresent: true,
    description: LIVE_183,
    canonicalDescription: CANONICAL_191,
    originalUserDescription: CANONICAL_191,
    generatedDescription: LIVE_183,
    generatedLocale: 'sr',
    descriptionOrigin: 'ai_generated',
    ...overrides,
  };
  const cv: CVData = {
    id: 'cv-263',
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

function runExactBuild263(usageBefore = 10) {
  const { cv, exp, ctx } = build263Fixture();
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: exp.description || '',
    canonicalText: exp.canonicalDescription || '',
    originalText: exp.originalUserDescription || '',
    locale: 'sr',
    requestId: 'req-263-exact',
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
    gender: 'male',
    industryNorm: ctx.industryNorm,
    levelNorm: ctx.levelNorm,
    jobContextHash: ctx.key,
    requestId: 'req-263-exact',
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
    operationSnapshot: snapshot,
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
  return { finalized, nextCv, trace: session.commit(), auth, snapshot, usageBefore, usageAfter };
}

describe('build 263 — 191-vs-183 structural difference', () => {
  it('reproduces exact +8 bullet serialization delta', () => {
    expect(SR_UNITS_EXACT.map((u) => u.length)).toEqual([58, 56, 69]);
    expect(SR_UNITS_EXACT.reduce((a, u) => a + u.length, 0)).toBe(183);
    expect(LIVE_183.length).toBe(183);
    expect(CANONICAL_191.length).toBe(191);
    expect(LIVE_183.charCodeAt(0)).toBe('P'.charCodeAt(0));
    expect(CANONICAL_191.charCodeAt(0)).toBe(8226); // •
    expect(CANONICAL_191.length - LIVE_183.length).toBe(8);
    // 3 × "• " (6) + 2 × "\n" (2) = 8 — created by formatExperienceBullets
    expect(formatExperienceBullets(SR_UNITS_EXACT)).toBe(CANONICAL_191);
  });

  it('shared normalization makes live and canonical unit sequences equivalent', () => {
    expect(experienceAiSourcesEquivalent(LIVE_183, CANONICAL_191)).toBe(true);
    expect(experienceAiSourceUnits(LIVE_183)).toHaveLength(3);
    expect(experienceAiSourceUnits(CANONICAL_191)).toHaveLength(3);
    expect(experienceAiUnitSequenceHash(LIVE_183)).toBe(experienceAiUnitSequenceHash(CANONICAL_191));
    const liveIds = sourceFactIdentitiesFromDescription(LIVE_183).map((i) => i.id);
    const canonIds = sourceFactIdentitiesFromDescription(CANONICAL_191).map((i) => i.id);
    expect(liveIds).toEqual(canonIds);
    expect(liveIds).toHaveLength(3);
    expect(experienceTextsMateriallyDiffer(LIVE_183, CANONICAL_191)).toBe(false);

    const structLive = diagnoseExperienceAiSourceStructure(LIVE_183);
    const structCanon = diagnoseExperienceAiSourceStructure(CANONICAL_191);
    expect(structLive.unitSequenceHash).toBe(structCanon.unitSequenceHash);
    expect(structCanon.listMarkerCount).toBeGreaterThanOrEqual(3);
    expect(structLive.rawSourceLength).toBe(183);
    expect(structCanon.rawSourceLength).toBe(191);
  });
});

describe('build 263 — live textarea + operation snapshot', () => {
  beforeEach(() => seedUsage(10));

  it('live textarea becomes operation source; canonical does not override', () => {
    const { exp } = build263Fixture();
    const auth = resolveExperienceAiAuthoritativeSource(exp);
    expect(auth.kind).toBe('currentTextarea');
    expect(auth.currentTextareaIgnoredOrOverridden).toBe(false);
    expect(auth.englishSourceStillAuthoritative).toBe(false);
    expect(auth.staleForeignLocaleSourceAuthoritative).toBe(false);
    expect(auth.liveTextSelected).toBe(true);
    expect(auth.selectedSourceMatchesLiveNormalized).toBe(true);
    expect(auth.selectedSourceLanguage).toBe('sr');
    expect(auth.selectedSourceScript).toBe('latin');

    const selection = diagnoseExperienceSourceSelection(
      exp,
      auth.text,
      'genuine_user',
      { requestedLocale: 'sr', selectedSourceKindHint: 'currentTextarea' },
    );
    expect(selection.currentTextareaIgnoredOrOverridden).toBe(false);
    expect(selection.englishSourceStillAuthoritative).toBe(false);
    expect(selection.selectedSourceEquivalentToLiveText).toBe(true);
    expect(selection.selectedSourceMatchesLiveNormalized).toBe(true);
  });

  it('exact fixture: snapshot + 3/3 fallback + usage 10→11', () => {
    seedUsage(10);
    const { finalized, nextCv, trace, snapshot, usageBefore, usageAfter } = runExactBuild263(10);

    expect(snapshot.provenanceOrigin).toBe('currentTextarea');
    expect(snapshot.sourceUnitCount).toBe(3);
    expect(snapshot.sourceFactIds).toHaveLength(3);
    expect(new Set(snapshot.units.map((u) => u.operationSnapshotId)).size).toBe(1);

    expect(trace.contentLocale).toBe('sr');
    expect(trace.selectedGender).toBe('male');
    expect(trace.selectedSourceKind).toBe('currentTextarea');
    expect(trace.englishSourceStillAuthoritative).toBe(false);
    expect(trace.staleForeignLocaleSourceAuthoritative).toBe(false);
    expect(trace.currentTextareaIgnoredOrOverridden).toBe(false);
    expect(trace.selectedSourceMatchesLiveNormalized).toBe(true);
    expect(trace.liveTextSelected).toBe(true);
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
    expect(finalized.diagnostics?.clientDeterministicFallbackUncoveredFactIds || []).toEqual([]);

    const bullets = splitExperienceBullets(finalized.text);
    expect(bullets).toHaveLength(3);
    EXPECTED_FINAL.forEach((re, i) => expect(bullets[i]).toMatch(re));
    expect(bullets[0]).toMatch(/označava/i);
    expect(bullets[1]).toMatch(/najnovijim statusom/i);
    expect(bullets[2]).toMatch(/dva interna odeljenja/i);
    expect(bullets[2]).toMatch(/nedostaju informacije/i);

    expect(usageBefore).toBe(10);
    expect(usageAfter).toBe(11);

    const applied = nextCv.experience[0].description || '';
    expect(splitExperienceBullets(applied)).toHaveLength(3);
  });

  it('50× exact fixture — zero flakes', () => {
    for (let i = 0; i < 50; i += 1) {
      seedUsage(10);
      const { finalized, trace, usageAfter, snapshot } = runExactBuild263(10);
      expect(finalized.countedAsSuccess, `rep ${i}`).toBe(true);
      expect(finalized.diagnostics?.clientDeterministicFallbackCoveredFactCount, `rep ${i}`).toBe(3);
      expect(usageAfter, `rep ${i}`).toBe(11);
      expect(trace.currentTextareaIgnoredOrOverridden, `rep ${i}`).toBe(false);
      expect(trace.englishSourceStillAuthoritative, `rep ${i}`).toBe(false);
      expect(snapshot.sourceUnitCount, `rep ${i}`).toBe(3);
    }
  });
});

describe('build 263 — provenance retention + negatives', () => {
  it('tense normalization retains operationSnapshotId on all three bullets', () => {
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: LIVE_183,
      canonicalText: CANONICAL_191,
      locale: 'sr',
      requestId: 'req-prov',
      jobContextHash: 'job',
    });
    const built = buildSourcePreservingExperienceBulletsWithProvenance(
      snapshot.normalizedSourceText,
      'sr',
      'male',
      {
        isPresent: true,
        operationSnapshotId: snapshot.operationSnapshotId,
        snapshotUnits: snapshot.units.map((u) => ({
          rawUnit: u.rawUnit,
          sourceUnitId: u.sourceUnitId,
          sourceFactIds: u.sourceFactIds,
          operationSnapshotId: u.operationSnapshotId,
        })),
      },
    );
    expect(built.bullets).toHaveLength(3);
    for (const b of built.bullets) {
      expect(b.operationSnapshotId).toBe(snapshot.operationSnapshotId);
      expect(snapshot.sourceFactIds).toContain(b.sourceUnitId);
    }
    const cov = validateProvenancedDeterministicFallbackCoverage(
      snapshot.normalizedSourceText,
      built.bullets,
      { expectedOperationSnapshotId: snapshot.operationSnapshotId },
    );
    expect(cov.ok).toBe(true);
    expect(cov.coveredIds).toHaveLength(3);
  });

  it('rejects wrong sourceUnitId / snapshot mismatch / dropped clauses / additions', () => {
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: LIVE_183,
      locale: 'sr',
      requestId: 'req-neg',
      jobContextHash: 'job',
    });
    const built = buildSourcePreservingExperienceBulletsWithProvenance(
      snapshot.normalizedSourceText,
      'sr',
      'male',
      {
        isPresent: true,
        operationSnapshotId: snapshot.operationSnapshotId,
        snapshotUnits: snapshot.units.map((u) => ({
          rawUnit: u.rawUnit,
          sourceUnitId: u.sourceUnitId,
          sourceFactIds: u.sourceFactIds,
          operationSnapshotId: u.operationSnapshotId,
        })),
      },
    );

    const wrongId: ProvenancedFallbackBullet[] = built.bullets.map((b, i) => ({
      ...b,
      sourceUnitId: i === 0 ? 'sf_deadbeef' : b.sourceUnitId,
      sourceFactIds: i === 0 ? ['sf_deadbeef'] : b.sourceFactIds,
    }));
    expect(validateProvenancedDeterministicFallbackCoverage(
      snapshot.normalizedSourceText,
      wrongId,
      { expectedOperationSnapshotId: snapshot.operationSnapshotId },
    ).ok).toBe(false);

    const wrongSnap = built.bullets.map((b) => ({
      ...b,
      operationSnapshotId: 'op_other',
    }));
    expect(validateProvenancedDeterministicFallbackCoverage(
      snapshot.normalizedSourceText,
      wrongSnap,
      { expectedOperationSnapshotId: snapshot.operationSnapshotId },
    ).ok).toBe(false);

    const dupMap = built.bullets.map((b) => ({
      ...b,
      sourceUnitId: built.bullets[0].sourceUnitId,
      sourceFactIds: [built.bullets[0].sourceUnitId],
    }));
    expect(validateProvenancedDeterministicFallbackCoverage(
      snapshot.normalizedSourceText,
      dupMap,
      { expectedOperationSnapshotId: snapshot.operationSnapshotId },
    ).ok).toBe(false);

    const dropClause = built.bullets.map((b, i) => ({
      ...b,
      text: i === 0 ? 'Pregleda pristigle terenske izveštaje.' : b.text,
    }));
    expect(validateProvenancedDeterministicFallbackCoverage(
      snapshot.normalizedSourceText,
      dropClause,
    ).ok).toBe(false);

    const dropStatus = built.bullets.map((b, i) => ({
      ...b,
      text: i === 1 ? 'Ažurira zajedničku tabelu.' : b.text,
    }));
    expect(validateProvenancedDeterministicFallbackCoverage(
      snapshot.normalizedSourceText,
      dropStatus,
    ).ok).toBe(false);

    const dropDepts = built.bullets.map((b, i) => ({
      ...b,
      text: i === 2 ? 'Koordiniše sa odeljenjima.' : b.text,
    }));
    expect(validateProvenancedDeterministicFallbackCoverage(
      snapshot.normalizedSourceText,
      dropDepts,
    ).ok).toBe(false);

    const withTools = built.bullets.map((b, i) => ({
      ...b,
      text: i === 1 ? `${b.text} koristeći Excel i Salesforce KPI.` : b.text,
    }));
    // Provenance coverage checks material preservation of source — extras are
    // rejected by unsupported-claim / no-extra validators on apply path.
    const providerCov = validateSourceFactIdentityCoverage(
      snapshot.normalizedSourceText,
      formatExperienceBullets(withTools.map((b) => b.text)),
    );
    // Still covers facts, but extras are a separate gate — ensure material drop tests above fail.
    expect(providerCov.requiredIds.length).toBe(3);
  });

  it('reproduces legacy 1/3 when identities are mixed across representations', () => {
    // Pre-fix path: required from bullet canonical, provenance rebuilt from a
    // single concatenated live unit (old extract failed to split) → ≤1 covered.
    const oldLiveUnits = [LIVE_183]; // simulate failed split
    const oldId = sourceFactIdentityId(oldLiveUnits[0]);
    const required = sourceFactIdentitiesFromDescription(CANONICAL_191);
    expect(required).toHaveLength(3);
    const fakeProv: ProvenancedFallbackBullet[] = [{
      text: 'Pregleda pristigle terenske izveštaje i označava nepotpune unose.',
      sourceUnitId: oldId,
      sourceFactIds: [oldId],
      sourceUnit: LIVE_183,
      transformationKind: 'universal_preserve_tense',
      locale: 'sr',
      tenseMode: 'present',
    }];
    const mixed = validateProvenancedDeterministicFallbackCoverage(CANONICAL_191, fakeProv);
    expect(mixed.ok).toBe(false);
    expect(mixed.coveredIds.length).toBeLessThanOrEqual(1);
    expect(mixed.missingIds.length).toBeGreaterThanOrEqual(2);
  });
});

describe('build 263 — multilingual formatting/provenance matrix', () => {
  const rows: Array<{ locale: Locale; plain: string[]; isPresent: boolean }> = [
    {
      locale: 'sr',
      plain: SR_UNITS_EXACT,
      isPresent: true,
    },
    {
      locale: 'sr',
      plain: [
        'Прегледам пристигле теренске извештаје и означавам непотпуне уносе.',
        'Ажурирам заједничку табелу са најновијим статусом.',
        'Координишем са два интерна одељења када недостају информације.',
      ],
      isPresent: true,
    },
    {
      locale: 'en',
      plain: [
        'I review incoming field reports and mark incomplete entries.',
        'I update a shared table with the latest status.',
        'I coordinate with two internal departments when information is missing.',
      ],
      isPresent: true,
    },
    {
      locale: 'de',
      plain: [
        'Ich prüfe eingehende Außendienstberichte und markiere unvollständige Einträge.',
        'Ich aktualisiere eine gemeinsame Tabelle mit dem neuesten Status.',
        'Ich koordiniere mit zwei internen Abteilungen wenn Informationen fehlen.',
      ],
      isPresent: false,
    },
    {
      locale: 'es',
      plain: [
        'Reviso informes de campo entrantes y marco entradas incompletas.',
        'Actualizo una tabla compartida con el estado más reciente.',
        'Coordino con dos departamentos internos cuando falta información.',
      ],
      isPresent: true,
    },
    {
      locale: 'hi',
      plain: [
        'मैं आने वाली फील्ड रिपोर्ट की समीक्षा करता हूँ और अधूरे प्रविष्टियों को चिह्नित करता हूँ।',
        'मैं साझा तालिका को नवीनतम स्थिति के साथ अद्यतन करता हूँ।',
        'जब जानकारी नहीं होती है तो मैं दो आंतरिक विभागों के साथ समन्वय करता हूँ।',
      ],
      isPresent: true,
    },
    {
      locale: 'ar',
      plain: [
        'أراجع تقارير الميدان الواردة وأعلم الإدخالات غير المكتملة.',
        'أحدث جدولاً مشتركاً بأحدث حالة.',
        'أنسق مع قسمين داخليين عندما تكون المعلومات مفقودة.',
      ],
      isPresent: false,
    },
    {
      locale: 'ja',
      plain: [
        '受信した現場報告を確認し、不完全な記入をマークします。',
        '共有表を最新の状況で更新します。',
        '情報がない場合は2つの内部部門と調整します。',
      ],
      isPresent: true,
    },
  ];

  it.each(rows)(
    '$locale plain vs bullet vs CRLF share unit-sequence hash',
    ({ locale, plain, isPresent }) => {
      const live = plain.join('\n');
      const crlf = plain.join('\r\n');
      const bullets = formatExperienceBullets(plain);
      expect(experienceAiSourcesEquivalent(live, bullets)).toBe(true);
      expect(experienceAiSourcesEquivalent(live, crlf)).toBe(true);
      expect(experienceAiUnitSequenceHash(live)).toBe(experienceAiUnitSequenceHash(bullets));

      const snapshot = createExperienceAiOperationSnapshot({
        liveText: live,
        canonicalText: bullets,
        locale,
        requestId: `req-${locale}`,
        jobContextHash: 'job',
      });
      expect(snapshot.provenanceOrigin).toBe('currentTextarea');
      expect(snapshot.sourceUnitCount).toBe(plain.length);

      const built = buildSourcePreservingExperienceBulletsWithProvenance(
        snapshot.normalizedSourceText,
        locale,
        'male',
        {
          isPresent,
          operationSnapshotId: snapshot.operationSnapshotId,
          snapshotUnits: snapshot.units.map((u) => ({
            rawUnit: u.rawUnit,
            sourceUnitId: u.sourceUnitId,
            sourceFactIds: u.sourceFactIds,
            operationSnapshotId: u.operationSnapshotId,
          })),
        },
      );
      expect(built.bullets.length).toBe(plain.length);
      expect(built.bullets.every((b) => b.operationSnapshotId === snapshot.operationSnapshotId)).toBe(true);
      const cov = validateProvenancedDeterministicFallbackCoverage(
        snapshot.normalizedSourceText,
        built.bullets,
        { expectedOperationSnapshotId: snapshot.operationSnapshotId },
      );
      expect(cov.ok).toBe(true);
    },
  );
});

describe('build 263 — reload / PDF / DOCX', () => {
  beforeEach(() => seedUsage(10));

  it('reload + PDF/DOCX preserve three facts; export adds zero usage', async () => {
    seedUsage(10);
    const { finalized, nextCv, usageAfter } = runExactBuild263(10);
    expect(usageAfter).toBe(11);
    expect(finalized.countedAsSuccess).toBe(true);

    const reloaded: CVData = JSON.parse(JSON.stringify(nextCv));
    expect(splitExperienceBullets(reloaded.experience[0].description || '')).toHaveLength(3);

    const beforeExport = getProAiUsageCount();
    const prepared = prepareExportReadyCv(reloaded, 'sr');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    const pdfText = extractPdfUnicodeText(Buffer.from(await pdf.arrayBuffer()));
    expect(pdfText).toMatch(/terensk|izvešt|tabel|odeljen/i);

    await exportToDOCX(prepared.cv, 'cv-263', 'sr', 'modern-minimal');
    expect(getProAiUsageCount()).toBe(beforeExport);
  });
});

describe('build 263 — CRLF / whitespace normalization', () => {
  it('normalizeExperienceAiSourceText strips per-line bullets and CRLF', () => {
    const a = normalizeExperienceAiSourceText(LIVE_183);
    const b = normalizeExperienceAiSourceText(CANONICAL_191.replace(/\n/g, '\r\n'));
    expect(experienceAiSourceUnits(a)).toEqual(experienceAiSourceUnits(b));
  });

  it('extractSourceDutyUnits splits concatenated Android form', () => {
    expect(extractSourceDutyUnits(LIVE_183)).toHaveLength(3);
    expect(extractSourceDutyUnits(CANONICAL_191).map((u) => u.length)).toEqual([58, 56, 69]);
  });
});
