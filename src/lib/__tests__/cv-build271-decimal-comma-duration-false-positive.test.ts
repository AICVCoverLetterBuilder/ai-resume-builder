/**
 * @vitest-environment jsdom
 *
 * Build 271 — Summary duration false-positive: decimal-comma numeric claims
 * (`približno 6,5 godina radnog iskustva`) must be detected alongside written
 * forms (`oko šest i po godine iskustva`). Visible text with two claims must
 * never diagnose as a PASS.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  countSummaryDurationExpressions,
  enforceAuthoritativeSummaryDuration,
  normalizeDurationScanText,
  scanSummaryDurationClaims,
  summarizeDurationClaimBreakdown,
  stripAllSummaryDurationExpressions,
  verifyIndependentFinalDurationCount,
} from '@/lib/cv-summary-duration-ownership';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
} from '@/lib/cv-experience-duration';
import { resolveSummaryWithDurationPolicy } from '@/lib/cv-content-quality';
import { buildJobContextGenerationFallback } from '@/lib/cv-experience-ai-operation-mode';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { Locale } from '@/lib/i18n/translations';

const RUNS = 50;

const MIXED_SAME_SENTENCE =
  'Profesionalka sa približno 6,5 godina radnog iskustva i sa oko šest i po godine iskustva u skladištu.';

const MIXED_SEPARATE_SENTENCES =
  'Profesionalka sa približno 6,5 godina radnog iskustva. Radi u skladištu sa oko šest i po godine iskustva.';

const PLAIN_GROUNDED = [
  'Radnica u skladištu u Atlasu.',
  'Proverava robu i dokumentaciju, ažurira evidenciju i koordiniše kretanje robe.',
  'Ranije je radila kao grafički dizajner na vizuelnim materijalima.',
].join(' ');

/** Real applied-Summary shape with the dual-claim false-positive from build 271. */
const MIXED_GROUNDED =
  `${PLAIN_GROUNDED} Sa približno 6,5 godina radnog iskustva i sa oko šest i po godine iskustva.`;

const MIXED_GROUNDED_SEPARATE =
  `${PLAIN_GROUNDED} Sa približno 6,5 godina radnog iskustva. Takođe sa oko šest i po godine iskustva.`;

const VARIANT_CLAIMS = [
  '6,5 godina iskustva',
  '6.5 godina iskustva',
  'oko 6,5 godina iskustva',
  'približno 6,5 godina radnog iskustva',
  'šest i po godina iskustva',
  'oko šest i po godina iskustva',
] as const;

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function baseCv(): CVData {
  const warehouse: WorkExperience = {
    id: 'exp-wh',
    company: 'Atlas',
    position: 'Radnica u skladištu',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: '',
    descriptionOrigin: 'user',
  };
  const designer: WorkExperience = {
    id: 'exp-gd',
    company: 'Rewitu',
    position: 'Grafički dizajner',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: '',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-271',
    name: 'CV',
    personal: {
      fullName: 'Ana Anić',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary: '',
    experience: [warehouse, designer],
    education: [],
    skills: ['Communication', 'Teamwork'],
    languages: [],
    certifications: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    contentLocale: 'sr',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function enhanceEntry(cv: CVData, experienceId: string, locale: Locale, candidate: string) {
  const exp = cv.experience.find((e) => e.id === experienceId)!;
  const ctx = buildExperienceJobContext({
    position: exp.position,
    industry: 'general',
    locale,
    level: 'mid',
  });
  const snapshot = createExperienceAiOperationSnapshot({
    liveText: exp.description || '',
    locale,
    requestId: `271-${experienceId}-${locale}`,
    jobContextHash: ctx.key,
    experienceEntryId: experienceId,
  });
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: locale,
    gender: 'female',
    cv,
    candidate,
    experienceId,
    industry: 'general',
    level: 'mid',
    jobContext: ctx,
    operationSnapshot: snapshot,
    originHint: 'ai_generated',
  });
}

/** Ground both Experience entries so Summary finalize has canonical facts. */
function groundedCv(): CVData {
  let cv = baseCv();
  for (const id of ['exp-wh', 'exp-gd'] as const) {
    const exp = cv.experience.find((e) => e.id === id)!;
    const gen = buildJobContextGenerationFallback({
      locale: 'sr',
      gender: 'female',
      position: exp.position,
      industry: 'general',
      isPresent: Boolean(exp.isPresent),
    });
    const fin = enhanceEntry(cv, id, 'sr', gen);
    if (fin.blocked) throw new Error(`enhance ${id}: ${fin.reason}`);
    cv = applyFinalizedBulletsToCv(cv, 'sr', id, fin);
  }
  return cv;
}

function finalizeSr(cv: CVData, candidate: string, locale: Locale = 'sr') {
  return finalizeCvAiFieldForApply({
    action: 'summary_generate',
    field: 'summary',
    requestedLocale: locale,
    gender: 'female',
    cv,
    candidate,
    originHint: 'ai_generated',
    referenceDateIso: '2026-07-19',
  });
}

function longTenureDuration() {
  return buildExperienceDurationSnapshot(baseCv().experience, '2026-07-19').total;
}

describe('build 271 — detector gap: decimal comma + radnog', () => {
  it('normalizes 6,5 → 6.5 for scanning', () => {
    expect(normalizeDurationScanText('približno 6,5 godina')).toContain('6.5');
    expect(normalizeDurationScanText('oko 6.5 godina')).toContain('6.5');
  });

  it('recognizes every listed numeric/written variant as ≥1 claim', () => {
    for (const v of VARIANT_CLAIMS) {
      const text = `Profesionalka sa ${v}.`;
      const count = countSummaryDurationExpressions(text, 'sr');
      expect(count, v).toBeGreaterThanOrEqual(1);
      const hits = scanSummaryDurationClaims(text, 'sr');
      expect(hits.length, v).toBeGreaterThanOrEqual(1);
    }
  });

  it('counts BOTH decimal-comma and written claims in the build-271 fixture', () => {
    const count = countSummaryDurationExpressions(MIXED_SAME_SENTENCE, 'sr');
    expect(count).toBe(2);
    const breakdown = summarizeDurationClaimBreakdown(MIXED_SAME_SENTENCE, 'sr');
    expect(breakdown.total).toBe(2);
    expect(breakdown.numeric + breakdown.mixed).toBeGreaterThanOrEqual(1);
    expect(breakdown.written + breakdown.mixed).toBeGreaterThanOrEqual(1);
  });

  it('separate-sentence mixed fixture also counts 2', () => {
    expect(countSummaryDurationExpressions(MIXED_SEPARATE_SENTENCES, 'sr')).toBe(2);
  });
});

describe('build 271 — enforce → independent verify → exactly one', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
    seedUsage(0);
  });

  it(`collapses mixed variants to exactly one — ${RUNS} runs, zero flakes`, () => {
    const snap = { total: longTenureDuration() };
    const phrase = formatApproximateDurationPhrase(snap.total, 'sr');
    expect(phrase).toBeTruthy();

    for (let i = 0; i < RUNS; i += 1) {
      for (const input of [MIXED_SAME_SENTENCE, MIXED_SEPARATE_SENTENCES, MIXED_GROUNDED]) {
        const owned = enforceAuthoritativeSummaryDuration(input, snap.total, 'sr', {
          requireDurationClaim: true,
          context: { role: 'Radnica u skladištu', gender: 'female' },
        });
        expect(owned.diagnostics.durationClaimCountBeforeStrip, `before r${i}`).toBeGreaterThanOrEqual(2);
        expect(owned.diagnostics.durationClaimsRemovedBeforeInsert, `removed r${i}`).toBeGreaterThanOrEqual(2);
        expect(owned.diagnostics.independentFinalDurationClaimCount, `indep r${i}`).toBe(1);
        expect(owned.diagnostics.durationValidationPassed, `valid r${i}`).toBe(true);
        expect(countSummaryDurationExpressions(owned.summary, 'sr'), `count r${i}`).toBe(1);
        const indep = verifyIndependentFinalDurationCount(owned.summary, 'sr', {
          requireExactlyOne: true,
        });
        expect(indep.ok, `verify r${i}`).toBe(true);
        expect(indep.count, `verify-count r${i}`).toBe(1);

        // Idempotency: finalize(finalize(x)) === finalize(x)
        const again = enforceAuthoritativeSummaryDuration(owned.summary, snap.total, 'sr', {
          requireDurationClaim: true,
          context: { role: 'Radnica u skladištu', gender: 'female' },
        });
        expect(again.summary).toBe(owned.summary);
        expect(again.diagnostics.independentFinalDurationClaimCount).toBe(1);
      }
    }
  });

  it(`each single variant strips and re-inserts exactly once — ${RUNS} runs`, () => {
    const dur = longTenureDuration();
    for (let i = 0; i < RUNS; i += 1) {
      for (const v of VARIANT_CLAIMS) {
        const input = `Profesionalka sa ${v} u skladištu.`;
        const owned = enforceAuthoritativeSummaryDuration(input, dur, 'sr', {
          requireDurationClaim: true,
        });
        expect(owned.diagnostics.durationClaimCountBeforeStrip, `${v} before`).toBeGreaterThanOrEqual(1);
        expect(owned.diagnostics.independentFinalDurationClaimCount, `${v} after`).toBe(1);
        expect(stripAllSummaryDurationExpressions(owned.summary, 'sr')).not.toMatch(
          /\b(?:6[.,]5|šest\s+i\s+po|približno|otprilike)\b/iu,
        );
      }
    }
  });

  it(`finalizeCvAiFieldForApply collapses mixed provider text — ${RUNS} runs`, () => {
    for (let i = 0; i < RUNS; i += 1) {
      seedUsage(20);
      const cv = groundedCv();
      const fin = finalizeSr(cv, MIXED_GROUNDED);
      expect(fin.blocked, `blocked r${i}: ${fin.reason}`).toBe(false);
      expect(fin.countedAsSuccess, `success r${i}`).toBe(true);
      expect(countSummaryDurationExpressions(fin.text, 'sr')).toBe(1);
      expect(fin.diagnostics?.independentFinalDurationClaimCount).toBe(1);
      expect(fin.diagnostics?.durationValidationPassed).toBe(true);
      expect(fin.diagnostics?.durationClaimCountBeforeStrip).toBeGreaterThanOrEqual(2);
      expect(fin.diagnostics?.durationClaimsRemovedBeforeInsert).toBeGreaterThanOrEqual(2);

      const applied = applyFinalizedSummaryToCv(cv, 'sr', fin);
      expect(countSummaryDurationExpressions(applied.summary || '', 'sr')).toBe(1);
      recordProAiUserActionSuccess();
    }
  });

  it('diagnostics never PASS when visible text still has two duration claims', () => {
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      contentLocale: 'sr',
      templateId: 'modern-minimal',
      gender: 'female',
      requestId: '271-false-pass',
      usageCountBefore: 0,
    });
    session.recordCvSnapshot(baseCv(), MIXED_SAME_SENTENCE);
    // Simulate a buggy finalize that claimed success with two visible claims.
    session.recordFinalizeResult({
      blocked: false,
      text: MIXED_SAME_SENTENCE,
      origin: 'ai_generated',
      countedAsSuccess: true,
      diagnostics: {
        durationValidationPassed: true,
        finalDurationExpressionCount: 1,
        durationClaimCountBeforeStrip: 1,
        durationClaimsRemovedBeforeInsert: 0,
        independentFinalDurationClaimCount: 1,
        durationDetectorAgreement: true,
      },
    });
    session.recordVisibleApply(true, 1, MIXED_SAME_SENTENCE);
    const trace = session.commit();
    expect(trace.independentFinalDurationClaimCount).toBe(2);
    expect(trace.visibleDurationClaimCountAfterApply).toBe(2);
    expect(trace.visibleDurationMatchesFinalizedCount).toBe(false);
    expect(trace.durationValidationPassed).toBe(false);
    expect(trace.finalPostconditionsPassed).toBe(false);
    expect(trace.durationFinalizerIdempotent).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
  });

  it('successful apply records raceGuardResult=ok and duration count=1', () => {
    seedUsage(20);
    const cv = groundedCv();
    const fin = finalizeSr(cv, MIXED_GROUNDED);
    expect(fin.countedAsSuccess).toBe(true);
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      contentLocale: 'sr',
      templateId: 'modern-minimal',
      gender: 'female',
      requestId: '271-race-ok',
      usageCountBefore: getProAiUsageCount(),
    });
    session.recordCvSnapshot(cv, MIXED_GROUNDED);
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, getProAiUsageCount() + 1, fin.text);
    const trace = session.commit();
    expect(trace.raceGuardResult).toBe('ok');
    expect(trace.independentFinalDurationClaimCount).toBe(1);
    expect(trace.visibleDurationClaimCountAfterApply).toBe(1);
    expect(trace.durationValidationPassed).toBe(true);
    expect(trace.finalPostconditionsPassed).toBe(true);
    expect(trace.contentLocaleBeforeRequest).toBe('sr');
    expect(trace.contentLocaleAfterApply).toBe('sr');
  });
});

describe('build 271 — rewrite styles + locale cycles + fallback', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
    seedUsage(20);
  });

  it(`Stronger / Shorter / Professional rewrite candidates — ${RUNS} runs`, () => {
    const dur = longTenureDuration();
    const rewrites = [
      `Stronger: ${MIXED_GROUNDED}`,
      `Shorter: Radnica u skladištu proverava robu sa 6,5 godina iskustva i oko šest i po godine iskustva.`,
      `Professional: ${MIXED_GROUNDED_SEPARATE}`,
    ];
    for (let i = 0; i < RUNS; i += 1) {
      for (const candidate of rewrites) {
        const resolved = resolveSummaryWithDurationPolicy(candidate, dur, 'sr', {
          forceDurationPhrase: true,
          requireDurationClaim: true,
          context: { role: 'Radnica u skladištu', gender: 'female' },
        });
        expect(countSummaryDurationExpressions(resolved.summary, 'sr')).toBe(1);
        expect(resolved.durationDiagnostics?.durationValidationPassed).not.toBe(false);
      }
    }
  });

  it(`sr → en → sr cycle keeps exactly one duration — ${RUNS} runs`, () => {
    for (let i = 0; i < RUNS; i += 1) {
      seedUsage(20);
      let cv = groundedCv();
      const sr1 = finalizeSr(cv, MIXED_GROUNDED);
      expect(sr1.blocked).toBe(false);
      expect(countSummaryDurationExpressions(sr1.text, 'sr')).toBe(1);
      cv = applyFinalizedSummaryToCv(cv, 'sr', sr1);

      const en = finalizeSr(
        cv,
        `${sr1.text} Also around 6.5 years of experience and six and a half years of experience.`,
        'en',
      );
      expect(
        en.blocked,
        `en r${i}: ${en.reason}; ${JSON.stringify(en.diagnostics)}`,
      ).toBe(false);
      expect(countSummaryDurationExpressions(en.text, 'en')).toBe(1);
      cv = applyFinalizedSummaryToCv(cv, 'en', en);

      const sr2 = finalizeSr(
        cv,
        `${en.text} sa približno 6,5 godina radnog iskustva i oko šest i po godine iskustva.`,
      );
      expect(sr2.blocked, `sr2 r${i}: ${sr2.reason}`).toBe(false);
      expect(countSummaryDurationExpressions(sr2.text, 'sr')).toBe(1);
      recordProAiUserActionSuccess();
    }
  });

  it('provider-success and fallback paths both end with exactly one duration', () => {
    const cv = groundedCv();
    const provider = finalizeSr(cv, MIXED_GROUNDED);
    expect(provider.countedAsSuccess).toBe(true);
    expect(countSummaryDurationExpressions(provider.text, 'sr')).toBe(1);

    const fallback = finalizeSr(cv, '');
    expect(fallback.countedAsSuccess).toBe(true);
    expect(countSummaryDurationExpressions(fallback.text, 'sr')).toBe(1);
    expect(
      fallback.origin === 'deterministic_fallback'
        || fallback.origin === 'ai_repaired'
        || fallback.origin === 'ai_generated',
    ).toBe(true);
  });
});
