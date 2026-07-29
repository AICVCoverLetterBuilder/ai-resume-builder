/**
 * AAB-364 — Japanese Summary final employer / employment-state / role-intro
 * diagnostics packaging. Exact Atlas/Rewitu text + fail-closed negatives.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  analyzeJapaneseSummaryEmploymentQuality,
  buildJapaneseEntryOwnedSummary,
  splitJapaneseSummaryUnits,
  SUMMARY_BUILDER_REVISION_JA,
  JAPANESE_SUMMARY_EMPLOYER_STATE_364_REVISION,
} from '@/lib/cv-japanese-summary-grounding';
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from '@/lib/cv-french-summary-grounding';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildConciseGroundedSummary } from '@/lib/cv-summary-grounding';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import type { CVData } from '@/lib/types';

const REF = '2026-07-20';

const WH_EN = [
  'checks incoming goods;',
  'checks documentation related to received goods;',
  'coordinates with colleagues on preparation and movement of goods.',
].join('\n');

const GD_EN = [
  'created visual materials and graphic elements;',
  'reviewed and adapted design materials;',
  'prepared final design files for different formats and screens.',
].join('\n');

const EXPECTED_JA = [
  '通算で約6年半の実務経験があります。',
  '現在はAtlasで倉庫担当として、入荷商品の確認、受領品に関連する書類の確認、商品の準備および移動に関する同僚との連携を行っています。',
  '以前はRewituでグラフィックデザイナーとして、ビジュアル素材とグラフィック要素の作成、デザイン素材の確認・調整、さまざまな形式や画面向けの最終デザインファイルの準備を担当していました。',
].join('');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function atlasRewituCv(summary: string, contentLocale: string = 'ru'): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: "Employée d'entrepôt",
      gender: 'female',
    },
    summary,
    contentLocale,
    summaryOrigin: 'ai_generated',
    experience: [
      {
        id: 'atlas',
        position: "Employée d'entrepôt",
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_EN,
        canonicalDescription: WH_EN,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
      {
        id: 'rewitu',
        position: 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_EN,
        canonicalDescription: GD_EN,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    customSections: [],
  } as CVData;
}

describe('AAB-364 Japanese Summary employer/state/role-intro diagnostics', () => {
  beforeEach(() => {
    seedUsage(32);
  });

  it('exposes AAB-364 employer-state marker', () => {
    expect(JAPANESE_SUMMARY_EMPLOYER_STATE_364_REVISION)
      .toBe('japanese-summary-employer-state-364-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(JAPANESE_SUMMARY_EMPLOYER_STATE_364_REVISION);
    expect(SUMMARY_BUILDER_REVISION_JA).toBe('entry-owned-japanese-rebuild-363-v1');
  });

  it('exact path: employer/state/role-intro finals true with preserved text/hash/usage', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    expect(durationSnapshot.total.totalMonths).toBe(78);
    const sourceRu = buildConciseGroundedSummary(factSet, 'ru', 'female', durationSnapshot.total);
    expect(sourceRu.length).toBe(477);
    expect(fingerprintText(sourceRu)).toBe('fnv1a_3f3837fe_l477_b1059_e46');
    const cv = atlasRewituCv(sourceRu, 'ru');
    expect(getProAiUsageCount()).toBe(32);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourceRu,
      cv,
      requestedLocale: 'ja',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toBe(EXPECTED_JA);
    expect(fingerprintText(fin.text)).toBe('fnv1a_8eade4e2_l179_b36890_e12290');
    expect(fin.diagnostics?.finalCurrentDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.finalPriorDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
    expect(fin.diagnostics?.finalCurrentEmployerPresent).toBe(true);
    expect(fin.diagnostics?.finalPriorEmployerPresent).toBe(true);
    expect(fin.diagnostics?.finalCurrentEmploymentStateExpressed).toBe(true);
    expect(fin.diagnostics?.finalPriorEmploymentStateExpressed).toBe(true);
    expect(fin.diagnostics?.finalCurrentRoleIntroValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalPriorRoleIntroValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalPostconditionsPassed).toBe(true);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.providerTypedRejectionReason
      || fin.diagnostics?.providerRejectionReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);

    const q = analyzeJapaneseSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      priorRole: 'グラフィックデザイナー',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
      expectedDuration: durationSnapshot.total,
    });
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.finalCurrentEmployerPresent).toBe(true);
    expect(q.finalPriorEmployerPresent).toBe(true);
    expect(q.finalCurrentEmploymentStateExpressed).toBe(true);
    expect(q.finalPriorEmploymentStateExpressed).toBe(true);
    expect(q.finalCurrentRoleIntroValidationPassed).toBe(true);
    expect(q.finalPriorRoleIntroValidationPassed).toBe(true);

    const next = applyFinalizedSummaryToCv(cv, 'ja', fin);
    expect(next.summary).toBe(EXPECTED_JA);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(33);
  });

  it('rejects missing current employer', () => {
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    ).total;
    const full = buildJapaneseEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration,
      locale: 'ja',
    });
    const missingCurrentEmployer = full.replace(/Atlas/g, '');
    const q = analyzeJapaneseSummaryEmploymentQuality(missingCurrentEmployer, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      expectedDuration: duration,
    });
    expect(q.finalCurrentEmployerPresent).toBe(false);
    expect(q.finalCurrentRoleIntroValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.typedRejectionReason).toMatch(
      /japanese_summary_current_employer_missing|japanese_summary_current_role_intro_invalid/,
    );
  });

  it('rejects missing prior employer', () => {
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    ).total;
    const full = buildJapaneseEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration,
      locale: 'ja',
    });
    const missingPriorEmployer = full.replace(/Rewitu/g, '');
    const q = analyzeJapaneseSummaryEmploymentQuality(missingPriorEmployer, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      expectedDuration: duration,
    });
    expect(q.finalPriorEmployerPresent).toBe(false);
    expect(q.finalPriorRoleIntroValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.typedRejectionReason).toMatch(
      /japanese_summary_prior_employer_missing|japanese_summary_prior_role_intro_invalid/,
    );
  });

  it('rejects missing current employment state', () => {
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    ).total;
    const full = buildJapaneseEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration,
      locale: 'ja',
    });
    const missingCurrentState = full.replace(/現在は/g, '');
    const q = analyzeJapaneseSummaryEmploymentQuality(missingCurrentState, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      expectedDuration: duration,
    });
    expect(q.finalCurrentEmploymentStateExpressed).toBe(false);
    expect(q.finalCurrentRoleIntroValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.typedRejectionReason).toMatch(
      /japanese_summary_current_employment_state_missing|japanese_summary_current_role_intro_invalid|japanese_summary_role_slot_mismatch/,
    );
  });

  it('rejects missing prior employment state', () => {
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    ).total;
    const full = buildJapaneseEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration,
      locale: 'ja',
    });
    const missingPriorState = full.replace(/以前は/g, '');
    const q = analyzeJapaneseSummaryEmploymentQuality(missingPriorState, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      expectedDuration: duration,
    });
    expect(q.finalPriorEmploymentStateExpressed).toBe(false);
    expect(q.finalPriorRoleIntroValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.typedRejectionReason).toMatch(
      /japanese_summary_prior_employment_state_missing|japanese_summary_prior_role_intro_invalid|japanese_summary_role_slot_mismatch/,
    );
  });

  it('rejects missing role intro (current role title omitted)', () => {
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    ).total;
    const full = buildJapaneseEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration,
      locale: 'ja',
    });
    const missingRole = full
      .replace(/倉庫担当/g, '')
      .replace(/倉庫作業員/g, '');
    const q = analyzeJapaneseSummaryEmploymentQuality(missingRole, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      expectedDuration: duration,
    });
    expect(q.currentRoleTitlePresent).toBe(false);
    expect(q.finalCurrentRoleIntroValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.typedRejectionReason).toMatch(
      /japanese_summary_current_role_intro_invalid|japanese_summary/,
    );
    expect(splitJapaneseSummaryUnits(full)).toHaveLength(3);
  });

  it('arbitrary occupation still packages employer/state/role-intro', () => {
    const duration = {
      hasValidDates: true,
      totalMonths: 36,
      approxYears: 3,
      unit: 'years' as const,
    };
    const text = buildJapaneseEntryOwnedSummary({
      role: 'Kitchen Lead',
      employer: 'NovaBistro',
      gender: 'female',
      dutyFacts: [
        { value: 'レストラン基準に沿った料理の準備', sourceText: 'prep meals' },
        { value: '作業場の衛生管理', sourceText: 'hygiene' },
        { value: 'キッチンチームとの協力', sourceText: 'team' },
      ],
      priorRole: 'Cashier',
      priorEmployer: 'MartOne',
      priorSourceDuties: 'handled payments',
      duration,
      locale: 'ja',
    });
    expect(text).toMatch(/現在はNovaBistroで/);
    expect(text).toMatch(/以前はMartOneで/);
    const q = analyzeJapaneseSummaryEmploymentQuality(text, {
      company: 'NovaBistro',
      role: 'Kitchen Lead',
      priorCompany: 'MartOne',
      priorRole: 'Cashier',
      currentEntryDuties: 'prep meals\nhygiene\nteam',
      priorEntryDuties: 'handled payments',
      expectedDuration: duration,
    });
    expect(q.finalCurrentEmployerPresent).toBe(true);
    expect(q.finalPriorEmployerPresent).toBe(true);
    expect(q.finalCurrentEmploymentStateExpressed).toBe(true);
    expect(q.finalPriorEmploymentStateExpressed).toBe(true);
    expect(q.finalCurrentRoleIntroValidationPassed).toBe(true);
    expect(q.finalPriorRoleIntroValidationPassed).toBe(true);
  });
});
