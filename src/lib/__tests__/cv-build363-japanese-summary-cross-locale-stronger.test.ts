/**
 * AAB-363 — Russian → Japanese Professional Summary Stronger.
 * Entry-owned Japanese deterministic fallback; provider rejection totality;
 * three-unit topology; locale transaction ru → ja.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  analyzeJapaneseSummaryEmploymentQuality,
  buildJapaneseEntryOwnedSummary,
  detectJapaneseSummaryPerspective,
  formatJapaneseDurationCore,
  hasIncorrectJapaneseDurationGrammar,
  splitJapaneseSummaryUnits,
  SUMMARY_BUILDER_REVISION_JA,
  JAPANESE_SUMMARY_DURATION_GRAMMAR_INVALID,
} from '@/lib/cv-japanese-summary-grounding';
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from '@/lib/cv-french-summary-grounding';
import {
  resolveSummaryBuilderRevision,
  resolveSummaryTargetScript,
  assertSummaryBuilderMatchesRequestedLocale,
} from '@/lib/cv-summary-locale-dispatch';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { detectTextLocale } from '@/lib/cv-content-locale';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
} from '@/lib/cv-experience-duration';
import { buildConciseGroundedSummary } from '@/lib/cv-summary-grounding';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { SUMMARY_BUILDER_REVISION_RU } from '@/lib/cv-russian-summary-grounding';
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

function assertFirstPersonJa(text: string): void {
  expect(detectJapaneseSummaryPerspective(text)).toBe('first_person');
  expect(text).toMatch(/通算で約6年半の実務経験があります/);
  expect(text).toMatch(/現在はAtlasで倉庫担当として/);
  expect(text).toMatch(/以前はRewituでグラフィックデザイナーとして/);
  expect(text).toMatch(/行っています/);
  expect(text).toMatch(/担当していました/);
  expect(text).not.toMatch(/[а-яё]/iu);
  expect(text).not.toMatch(/\b(?:tenho|atualmente|dispongo|attualmente|у меня)\b/iu);
  expect(hasIncorrectJapaneseDurationGrammar(text)).toBe(false);
}

describe('AAB-363 RU→Japanese Summary Stronger', () => {
  beforeEach(() => {
    seedUsage(32);
  });

  it('routes requestedLocale=ja to Japanese builder', () => {
    expect(SUMMARY_BUILDER_REVISION_JA).toBe('entry-owned-japanese-rebuild-363-v1');
    expect(resolveSummaryBuilderRevision('ja')).toBe(SUMMARY_BUILDER_REVISION_JA);
    expect(resolveSummaryTargetScript('ja')).toBe('cjk');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'ja',
      'entry-owned-russian-rebuild-362-v1',
    )).toBe('japanese_request_routed_to_russian_builder');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'ja',
      'entry-owned-english-rebuild-v1',
    )).toBe('japanese_request_routed_to_english_builder');
  });

  it('source Russian Summary is the validated 477-character form', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const ru = buildConciseGroundedSummary(factSet, 'ru', 'female', duration.total);
    expect(ru.length).toBe(477);
    expect(fingerprintText(ru)).toBe('fnv1a_3f3837fe_l477_b1059_e46');
  });

  it('builder emits exact first-person Japanese from structured Experience', () => {
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    ).total;
    const text = buildJapaneseEntryOwnedSummary({
      role: "Employée d'entrepôt",
      employer: 'Atlas',
      gender: 'female',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration,
      locale: 'ja',
    });
    expect(text).toBe(EXPECTED_JA);
    assertFirstPersonJa(text);
  });

  it('exact AAB 363 path: RU provider echo → Japanese deterministic apply + usage 32→33', () => {
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
    expect(detectTextLocale(sourceRu, { storedLocale: 'ru' })).toBe('ru');
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
    assertFirstPersonJa(fin.text);
    expect(fingerprintText(fin.text)).toBe('fnv1a_8eade4e2_l179_b36890_e12290');
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.missingCurrentDutyFactCount).toBe(0);
    expect(fin.diagnostics?.finalCurrentDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.requiredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.missingPriorDutyFactCount).toBe(0);
    expect(fin.diagnostics?.finalPriorDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
    expect(fin.diagnostics?.finalSentenceRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
    expect(fin.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
    expect(fin.diagnostics?.totalDurationSlotPresent).toBe(true);
    expect(fin.diagnostics?.detectedLocaleByUnit).toEqual(['ja', 'ja', 'ja']);
    expect(fin.diagnostics?.wrongLocaleUnitCount).toBe(0);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason
      || fin.diagnostics?.providerRejectionReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_JA);
    expect(fin.diagnostics?.summaryBuilderRevision).not.toBe(SUMMARY_BUILDER_REVISION_RU);

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
    expect(q.unitCount).toBe(3);
    expect(q.finalUnitRoleSlots).toEqual(['duration', 'current_intro', 'prior_role']);
    expect(splitJapaneseSummaryUnits(fin.text)).toHaveLength(3);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'ja',
      requestedLocale: 'ja',
      contentLocale: 'ru',
      gender: 'female',
      usageCountBefore: 32,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, sourceRu);
    session.recordFinalizeResult(fin);
    expect(session.draft.detectedVisibleContentLocaleBeforeRequest).toBe('ru');
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed, JSON.stringify(session.draft.diagnosticInvariantFailures, null, 2)).toBe(true);
    const next = applyFinalizedSummaryToCv(cv, 'ja', fin);
    expect(next.summary).toBe(fin.text);
    expect(next.contentLocale).toBe('ja');
    session.recordVisibleApply(true, 33, fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(33);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.contentLocaleAfterApply).toBe('ja');
    expect(trace.finalContentLocaleAfterApply).toBe('ja');
    expect(trace.contentLocaleUpdatedAfterApply).toBe(true);
    const inv = checkSummaryDiagnosticInvariants(
      trace as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
    );
    expect(inv.passed, JSON.stringify(inv.failures, null, 2)).toBe(true);
  });

  it('changed-invalid provider gets typed grounding rejection (not noop)', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceRu = buildConciseGroundedSummary(factSet, 'ru', 'female', durationSnapshot.total);
    const changedProvider = '現在はAtlasで倉庫担当として一般業務を行っています。';
    expect(fingerprintText(changedProvider)).not.toBe(fingerprintText(sourceRu));
    const cv = atlasRewituCv(sourceRu, 'ru');

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: changedProvider,
      cv,
      requestedLocale: 'ja',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    assertFirstPersonJa(fin.text);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason).toBeTruthy();
    expect(fin.diagnostics?.providerTypedRejectionReason).not.toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
  });

  it('rejects RU/pt-BR/Italian/English deterministic surface for Japanese', () => {
    for (const foreign of [
      'У меня около шести с половиной лет общего профессионального опыта. Сейчас я работаю в Atlas.',
      'Tenho, ao todo, cerca de seis anos e meio de experiência profissional. Atualmente trabalho na Atlas.',
      'Dispongo complessivamente di circa sei anni e mezzo di esperienza professionale.',
      'I have approximately six and a half years of professional experience.',
    ]) {
      const q = analyzeJapaneseSummaryEmploymentQuality(foreign, {
        company: 'Atlas',
        role: '倉庫担当',
        currentEntryDuties: WH_EN,
        gender: 'female',
      });
      expect(q.groundingValidationPassed, foreign.slice(0, 40)).toBe(false);
      const purity = validateAiUnitLocalePurity(foreign, 'ja', {
        kind: 'summary_sentence',
        requireUnits: true,
      });
      expect(purity.targetLocalePurityPassed || purity.ok).toBe(false);
    }
  });

  it('rejects malformed duration and wrong month semantic value', () => {
    const badOrder = '通算で年半約6の実務経験があります。現在はAtlasで倉庫担当として、入荷商品の確認、受領品に関連する書類の確認、商品の準備および移動に関する同僚との連携を行っています。以前はRewituでグラフィックデザイナーとして、ビジュアル素材とグラフィック要素の作成、デザイン素材の確認・調整、さまざまな形式や画面向けの最終デザインファイルの準備を担当していました。';
    expect(hasIncorrectJapaneseDurationGrammar(badOrder)).toBe(true);

    const wrongMonths = buildExperienceDurationSnapshot(
      [{
        id: 'a',
        position: 'x',
        company: 'Atlas',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: WH_EN,
      }] as never,
      REF,
    ).total;
    const text = EXPECTED_JA;
    const q = analyzeJapaneseSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      priorRole: 'グラフィックデザイナー',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      expectedDuration: wrongMonths,
    });
    expect(q.grammarValidationPassed).toBe(false);
    expect(q.slotRejectionReasons).toContain(JAPANESE_SUMMARY_DURATION_GRAMMAR_INVALID);
  });

  it('rejects missing current or prior fact', () => {
    const missingCurrent = [
      '通算で約6年半の実務経験があります。',
      '現在はAtlasで倉庫担当として、入荷商品の確認、商品の準備および移動に関する同僚との連携を行っています。',
      '以前はRewituでグラフィックデザイナーとして、ビジュアル素材とグラフィック要素の作成、デザイン素材の確認・調整、さまざまな形式や画面向けの最終デザインファイルの準備を担当していました。',
    ].join('');
    const qCurrent = analyzeJapaneseSummaryEmploymentQuality(missingCurrent, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      priorRole: 'グラフィックデザイナー',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
    });
    expect(qCurrent.finalCurrentDutyCoveragePassed).toBe(false);

    const missingPrior = [
      '通算で約6年半の実務経験があります。',
      '現在はAtlasで倉庫担当として、入荷商品の確認、受領品に関連する書類の確認、商品の準備および移動に関する同僚との連携を行っています。',
      '以前はRewituでグラフィックデザイナーとして、ビジュアル素材とグラフィック要素の作成を担当していました。',
    ].join('');
    const qPrior = analyzeJapaneseSummaryEmploymentQuality(missingPrior, {
      company: 'Atlas',
      role: '倉庫担当',
      priorCompany: 'Rewitu',
      priorRole: 'グラフィックデザイナー',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
    });
    expect(qPrior.finalPriorDutyCoveragePassed).toBe(false);
  });

  it('accepts arbitrary free-text occupation with grounded Japanese duties', () => {
    const duties = [
      '地域倉庫の出荷指示を確認する。',
      '拠点間の移動計画を同僚と調整する。',
      '入荷枠の日程を更新する。',
    ].join('\n');
    const text = buildJapaneseEntryOwnedSummary({
      role: 'Regional Hub Coordinator',
      employer: 'NordicLog',
      gender: 'female',
      dutyFacts: duties.split('\n').map((v) => ({ value: v, sourceText: v })),
      duration: {
        hasValidDates: true,
        totalMonths: 24,
        unit: 'years',
        approxYears: 2,
      } as never,
      hasCurrentRole: true,
    });
    expect(text).toMatch(/NordicLog/);
    expect(text).toMatch(/通算で約2年/);
    expect(text).toMatch(/現在は/);
    expect(detectJapaneseSummaryPerspective(text)).toBe('first_person');
  });

  it('five-plus-entry CV keeps Atlas/Rewitu ownership and bounded output', () => {
    const cv = atlasRewituCv('');
    cv.experience = [
      ...(cv.experience || []),
      {
        id: 'gamma',
        position: 'Clerk',
        company: 'Gamma',
        startDate: '2018-01',
        endDate: '2019-12',
        isPresent: false,
        description: 'filed invoices;',
        canonicalDescription: 'filed invoices;',
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
      {
        id: 'delta',
        position: 'Assistant',
        company: 'Delta',
        startDate: '2016-01',
        endDate: '2017-12',
        isPresent: false,
        description: 'scheduled meetings;',
        canonicalDescription: 'scheduled meetings;',
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
      {
        id: 'epsilon',
        position: 'Intern',
        company: 'Epsilon',
        startDate: '2015-01',
        endDate: '2015-12',
        isPresent: false,
        description: 'supported team;',
        canonicalDescription: 'supported team;',
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
    ];
    const factSet = buildCvCanonicalFactSet(cv, { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF).total;
    const text = buildConciseGroundedSummary(factSet, 'ja', 'female', duration);
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/Rewitu/);
    expect(text).not.toMatch(/Gamma|Delta|Epsilon/);
    expect(splitJapaneseSummaryUnits(text).length).toBeLessThanOrEqual(3);
    expect(text.length).toBeLessThan(400);
  });

  it('Japanese duration matrix covers supported month spans', () => {
    const cases: Array<[number, string]> = [
      [6, '約6か月'],
      [12, '約1年'],
      [18, '約1年半'],
      [24, '約2年'],
      [30, '約2年半'],
      [60, '約5年'],
      [78, '約6年半'],
    ];
    for (const [months, core] of cases) {
      expect(formatJapaneseDurationCore({
        hasValidDates: true,
        totalMonths: months,
        unit: 'years',
        approxYears: months / 12,
      } as never)).toBe(core);
    }
    expect(formatApproximateDurationPhrase({
      hasValidDates: true,
      totalMonths: 78,
      unit: 'years',
      approxYears: 6.5,
    } as never, 'ja')).toMatch(/通算で約6年半/);
  });

  it('rejected operation preserves Summary, locale and usage', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceRu = buildConciseGroundedSummary(factSet, 'ru', 'female', durationSnapshot.total);
    const cv = atlasRewituCv(sourceRu, 'ru');
    seedUsage(32);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: '',
      cv,
      requestedLocale: 'ja',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });
    // Empty provider still rebuilds when structured domain can produce JA.
    if (fin.blocked) {
      expect(cv.summary).toBe(sourceRu);
      expect(cv.contentLocale).toBe('ru');
      expect(getProAiUsageCount()).toBe(32);
    } else {
      expect(fin.text).toBe(EXPECTED_JA);
    }
  });
});
