/**
 * Build-288 exact-device Japanese Summary regression.
 * Invalid provider candidate (skills + unsupported design + shipment drift +
 * four-unit duration append) must fail closed → deterministic three-slot rebuild.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
  SUMMARY_RUNTIME_MARKER_SET,
} from '../cv-ai-finalize-apply';
import {
  analyzeJapaneseSummaryEmploymentQuality,
  buildConciseGroundedSummary,
  splitJapaneseSummaryUnits,
  isJapaneseGenericSkillsUnit,
  countJapaneseUnsupportedSummaryClaims,
  JAPANESE_DURATION_IN_INTRO_MARKER,
  JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  SUMMARY_BUILDER_REVISION_JA,
} from '../cv-summary-grounding';
import { buildCvCanonicalFactSet } from '../cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
} from '../cv-experience-duration';
import { SUMMARY_DURATION_FINALIZER_REVISION_JA } from '../cv-content-quality';
import {
  countSummaryDurationExpressions,
} from '../cv-summary-duration-ownership';
import { SummaryAiDiagnosticSession } from '../cv-summary-ai-diagnostics';
import { buildExperienceJobContext } from '../cv-experience-job-context';

const WH_JA = [
  '入荷した商品と関連書類の正確性を確認する。',
  '倉庫記録を更新し、保管品の整然とした配置を維持する。',
  '同僚と連携して商品の準備と移動を調整する。',
].join('\n');

const DESIGN_JA = [
  'デジタル製品やプラットフォーム向けにビジュアル素材とグラフィック要素を作成する。',
  '要件に合わせてデザイン素材を確認し調整する。',
  '最終デザインファイルを準備し、画面ごとに形式を調整する。',
].join('\n');

/** Exact invalid provider body from internal Android build 288 (before duration append). */
const BUILD288_INVALID_PROVIDER = [
  '2023年1月よりAtlasにて倉庫作業員として、入荷商品および関連書類の確認・記録管理、倉庫記録の更新と商品整理、同僚との出荷準備および商品移動の調整を担当しています。',
  'それ以前はRewituにてグラフィックデザイナーとして、印刷・デジタル素材のデザイン制作およびブランドの視覚的ガイドラインの遵守に従事していました。',
  '主なスキルはリーダーシップ、組織力、批判的思考、適応力、問題解決、タイムマネジメント、コミュニケーションです。',
].join('');

function baseCv(summary?: string): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: '倉庫作業員',
      gender: 'female',
    },
    summary: summary ?? '',
    summaryOrigin: 'ai_generated',
    experience: [
      {
        id: 'exp-wh',
        position: '倉庫作業員',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_JA,
      },
      {
        id: 'exp-design',
        position: 'グラフィックデザイナー',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: DESIGN_JA,
      },
    ],
    education: [],
    skills: [
      'Leadership',
      'Organization',
      'Critical Thinking',
      'Adaptability',
      'Problem Solving',
      'Time Management',
      'Communication',
    ],
    languages: [],
    contentLocale: 'ja',
    templateId: 'modern-minimal',
  } as CVData;
}

function runWithUsage(cv: CVData, candidate: string) {
  const requestedLocale = 'ja' as const;
  const durationSnapshot = buildExperienceDurationSnapshot(
    cv.experience || [],
    '2026-07-20',
  );
  const jobContext = buildExperienceJobContext({
    position: '倉庫作業員',
    locale: requestedLocale,
  });
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'ja',
    requestedLocale,
    contentLocale: cv.contentLocale || null,
    templateId: '',
    gender: cv.personal.gender || '',
    requestId: 'req-build288-ja',
    usageCountBefore: 0,
    operationMode: 'generate_from_context',
    jobContextHash: jobContext.key,
  });
  session.recordCvSnapshot(cv, (cv.summary || '').trim());
  const pipe = runCvAiApplyPipeline({
    cv,
    locale: requestedLocale,
    action: 'summary_generate',
    candidate,
    durationSnapshot,
    referenceDateIso: '2026-07-20',
    jobContext,
  });
  session.recordFinalizeResult(pipe.finalized);
  const applied = !pipe.blocked && pipe.finalized.countedAsSuccess;
  let usageAfter = 0;
  if (applied) usageAfter = 1;
  session.recordVisibleApply(applied, usageAfter, applied ? pipe.finalized.text : undefined);
  return { pipe, trace: session.commit(), usageAfter, applied };
}

describe('cv-build288 Japanese Summary exact-device invalid provider', () => {
  it('exposes strict postcondition and duration-in-intro markers', () => {
    expect(SUMMARY_DURATION_FINALIZER_REVISION_JA).toBe('japanese-duration-idempotent-v2');
    expect(JAPANESE_DURATION_IN_INTRO_MARKER).toBe('japanese-duration-in-intro-289-v1');
    expect(JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER)
      .toBe('japanese-summary-strict-postconditions-363-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toEqual(expect.arrayContaining([
      JAPANESE_DURATION_IN_INTRO_MARKER,
      JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
      SUMMARY_BUILDER_REVISION_JA,
    ]));
  });

  it('rejects the exact skills sentence as a generic skills unit', () => {
    const skills = '主なスキルはリーダーシップ、組織力、批判的思考、適応力、問題解決、タイムマネジメント、コミュニケーションです。';
    expect(isJapaneseGenericSkillsUnit(skills)).toBe(true);
    const q = analyzeJapaneseSummaryEmploymentQuality(
      `${BUILD288_INVALID_PROVIDER}, 通算で約6年半.`,
      {
        company: 'Atlas',
        role: '倉庫作業員',
        priorCompany: 'Rewitu',
        currentEntryDuties: WH_JA,
        priorEntryDuties: DESIGN_JA,
        structuredRole: '倉庫作業員',
      },
    );
    expect(q.hasGenericSkillsUnit).toBe(true);
    expect(q.finalUnitRoleSlots).toContain('skills');
    expect(q.unitCount).toBeGreaterThanOrEqual(3);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.typedRejectionReason).toMatch(
      /japanese_summary_generic_skills_unit|japanese_summary_unsupported_claim|japanese_summary_role_slot_mismatch|japanese_summary_unit_count_mismatch|japanese_summary_malformed_punctuation/,
    );
  });

  it('rejects 印刷 / brand-guideline / 出荷 without source facts', () => {
    const claims = countJapaneseUnsupportedSummaryClaims(BUILD288_INVALID_PROVIDER, {
      currentEntryDuties: WH_JA,
      priorEntryDuties: DESIGN_JA,
    });
    expect(claims.unsupportedClaimCount).toBeGreaterThanOrEqual(2);
    expect(claims.reasons.some((r) => r.includes('印刷'))).toBe(true);
    expect(claims.reasons.some((r) => r.includes('ブランド') || r.includes('視覚的ガイドライン'))).toBe(true);
    expect(claims.reasons).toContain('unsupported_shipment_cue');
    expect(BUILD288_INVALID_PROVIDER).toMatch(/出荷準備/);
    expect(WH_JA).not.toMatch(/出荷|発送|配送|納品|積み込み/);
  });

  it('routes exact build-288 provider to deterministic three-slot Summary', () => {
    const cv = baseCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
    expect(duration.totalMonths).toBe(78);
    expect(formatApproximateDurationPhrase(duration, 'ja')).toMatch(/通算で約6年半/);

    const { pipe, trace, usageAfter, applied } = runWithUsage(cv, BUILD288_INVALID_PROVIDER);
    const finalized = pipe.finalized;

    expect(finalized.diagnostics?.providerCandidatePresent).toBe(true);
    expect(finalized.diagnostics?.providerRejectionReason).toMatch(
      /japanese_summary_generic_skills_unit|japanese_summary_unsupported_claim|japanese_summary_role_slot_mismatch|japanese_summary_unit_count_mismatch|japanese_summary_malformed_punctuation|japanese_summary_duration_not_standalone|japanese_summary_duration_outside_intro|japanese_summary_current_duty_missing|japanese_summary_locale_impurity/,
    );
    expect(finalized.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(finalized.origin).toBe('deterministic_fallback');
    expect(finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(finalized.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
    expect(trace.fallbackAttempted).toBe(true);
    expect(trace.fallbackApplied).toBe(true);
    expect(trace.fallbackKind).toBe('deterministic');
    expect(trace.fallbackSentenceCount).toBe(3);

    expect(finalized.blocked).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(applied).toBe(true);
    expect(usageAfter).toBe(1);
    expect(trace.usageCountBefore).toBe(0);
    expect(trace.usageCountAfter).toBe(1);
    expect(trace.visibleApplySucceeded).toBe(true);

    const units = splitJapaneseSummaryUnits(finalized.text);
    expect(units).toHaveLength(3);
    expect(finalized.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
    expect(finalized.diagnostics?.finalSentenceRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
    expect(finalized.diagnostics?.currentEmploymentIntroductionCount).toBe(1);
    expect(finalized.diagnostics?.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(finalized.diagnostics?.priorRoleGroundingPassed).toBe(true);
    expect(finalized.diagnostics?.unsupportedClaimCount).toBe(0);
    expect(finalized.diagnostics?.groundingValidationPassed).toBe(true);
    expect(finalized.diagnostics?.finalPostconditionsPassed).toBe(true);
    expect(finalized.diagnostics?.summaryDurationFinalizerRevision)
      .toBe('japanese-duration-idempotent-v2');
    expect(finalized.diagnostics?.durationPass1Hash)
      .toBe(finalized.diagnostics?.durationPass2Hash);
    expect(finalized.diagnostics?.durationFinalizerIdempotent).toBe(true);
    expect(countSummaryDurationExpressions(finalized.text, 'ja')).toBe(1);

    expect(finalized.text).toMatch(/倉庫担当/);
    expect(finalized.text).toMatch(/Atlas/);
    expect(finalized.text).toMatch(/通算で約6年半/);
    expect(finalized.text).toMatch(/入荷|倉庫|同僚/);
    expect(finalized.text).toMatch(/以前は/);
    expect(finalized.text).toMatch(/Rewitu/);
    expect(finalized.text).toMatch(/グラフィックデザイナー/);
    expect(finalized.text).toMatch(/ビジュアル|グラフィック/);
    expect(finalized.text).toMatch(/確認|調整/);
    expect(finalized.text).toMatch(/ファイル|形式|画面/);
    expect(finalized.text).not.toMatch(/主なスキル/);
    expect(finalized.text).not.toMatch(/リーダーシップ/);
    expect(finalized.text).not.toMatch(/印刷/);
    expect(finalized.text).not.toMatch(/ブランドの視覚的ガイドライン|視覚的ガイドライン/);
    expect(finalized.text).not.toMatch(/出荷/);
    expect(finalized.text).not.toMatch(/です。\s*,/);
    expect(finalized.text).not.toMatch(/。\s*,/);
    expect(finalized.text.endsWith('。')).toBe(true);

    const durationUnit = units[0] || '';
    const intro = units[1] || '';
    const prior = units[2] || '';
    expect(durationUnit).toMatch(/通算で約6年半/);
    expect(intro).not.toMatch(/通算で約6年半/);
    expect(prior).not.toMatch(/通算で約6年半/);
    expect(intro).toMatch(/入荷|倉庫|同僚|商品の準備|移動/);
    expect(intro).not.toMatch(/ビジュアル|デザインファイル|Rewitu/);
    expect(prior).toMatch(/ビジュアル|グラフィック|デザイン/);
    expect(prior).not.toMatch(/入荷した商品|倉庫記録/);

    const after = applyFinalizedSummaryToCv(cv, 'ja', finalized);
    expect(after.summary).toBe(finalized.text);
  });

  it('increments usage +0 when provider and deterministic both fail', () => {
    const cv = baseCv();
    // Empty experience → deterministic builder cannot form warehouse/design slots.
    cv.experience = [];
    const { pipe, usageAfter, applied, trace } = runWithUsage(cv, BUILD288_INVALID_PROVIDER);
    expect(pipe.finalized.countedAsSuccess).toBe(false);
    expect(applied).toBe(false);
    expect(usageAfter).toBe(0);
    expect(trace.usageCountAfter).toBe(0);
    expect(trace.visibleApplySucceeded).toBe(false);
  });

  it('includeSkills never adds a Japanese skills sentence from Skills section', () => {
    const cv = baseCv();
    const facts = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
    const summary = buildConciseGroundedSummary(facts, 'ja', 'female', duration, {
      includeSkills: true,
    });
    expect(summary).not.toMatch(/主なスキル/);
    expect(splitJapaneseSummaryUnits(summary)).toHaveLength(3);
  });

  it('malformed duration punctuation cannot pass postconditions', () => {
    const bad = `${BUILD288_INVALID_PROVIDER}, 通算約六年半.`;
    expect(bad).toMatch(/です。,/);
    const q = analyzeJapaneseSummaryEmploymentQuality(bad, {
      company: 'Atlas',
      role: '倉庫作業員',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_JA,
      priorEntryDuties: DESIGN_JA,
      structuredRole: '倉庫作業員',
    });
    expect(q.malformedPunctuation || q.durationOutsideIntro || q.unitCount !== 3).toBe(true);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('three-slot punctuation and duration placement tests', () => {
    const cv = baseCv();
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'ja',
      gender: 'female',
      cv,
      candidate: BUILD288_INVALID_PROVIDER,
    });
    expect(finalized.text).toMatch(/。$/);
    expect(countSummaryDurationExpressions(finalized.text, 'ja')).toBe(1);
    const intro = splitJapaneseSummaryUnits(finalized.text)[0] || '';
    expect(intro).toMatch(/通算で約6年半/);
    expect(finalized.diagnostics?.visibleDurationClaimCountAfterApply ?? 1).toBe(1);
  });
});
