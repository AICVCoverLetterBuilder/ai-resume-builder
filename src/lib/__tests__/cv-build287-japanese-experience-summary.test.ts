/**
 * Build-287/288 Japanese Experience + Summary package regression.
 * Fixture: Russian warehouse current + Russian design prior → Japanese target.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
  SUMMARY_PIPELINE_REVISION,
  SUMMARY_RUNTIME_MARKER_SET,
} from '../cv-ai-finalize-apply';
import {
  buildJobContextGenerationFallback,
} from '../cv-experience-ai-operation-mode';
import {
  classifyMaterialDutyKeys,
  japaneseWarehouseCueKeysFromUnit,
  japaneseDesignCueKeysFromUnit,
  JAPANESE_EXPERIENCE_MATERIAL_REVISION,
} from '../cv-material-duty-coverage';
import {
  analyzeJapaneseSummaryEmploymentQuality,
  buildConciseGroundedSummary,
  splitJapaneseSummaryUnits,
  SUMMARY_BUILDER_REVISION_JA,
  SUMMARY_UNIT_SPLITTER_REVISION_JA,
  SUMMARY_GROUNDING_REVISION_JA,
} from '../cv-summary-grounding';
import { buildCvCanonicalFactSet } from '../cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  yearWordForLocale,
} from '../cv-experience-duration';
import {
  SUMMARY_DURATION_FINALIZER_REVISION_JA,
  SUMMARY_DURATION_FINALIZER_REVISION_JA_LEGACY,
} from '../cv-content-quality';
import { validateAiUnitLocalePurity, guessUnitLocale } from '../cv-ai-unit-locale-purity';
import {
  countSummaryDurationExpressions,
  analyzeDurationRepresentations,
} from '../cv-summary-duration-ownership';

const WH_RU = [
  'Проверяет поступающие товары и сопроводительные документы, обеспечивая точность учёта.',
  'Обновляет складские записи и поддерживает порядок и организованное размещение товаров.',
  'Координирует с коллегами подготовку товаров и их перемещение внутри склада.',
].join('\n');

const DESIGN_RU = [
  'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
  'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
  'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
].join('\n');

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

function baseCv(options?: {
  order?: 'normal' | 'reversed';
  priorDescription?: string;
  currentDescription?: string;
  summary?: string;
}): CVData {
  const current = {
    id: 'exp-wh',
    position: '倉庫作業員',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: options?.currentDescription ?? WH_JA,
  };
  const prior = {
    id: 'exp-design',
    position: 'グラフィックデザイナー',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: options?.priorDescription ?? DESIGN_JA,
  };
  const order = options?.order || 'normal';
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: '倉庫作業員',
      gender: 'female',
    },
    summary: options?.summary
      ?? 'Графический дизайнер 約6.5年の経験. Carries out assigned professional duties with accuracy and professional communication.',
    summaryOrigin: 'ai_generated',
    experience: order === 'normal' ? [current, prior] : [prior, current],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'ru',
    templateId: 'modern-minimal',
  } as CVData;
}

describe('cv-build287 Japanese Experience/Summary package', () => {
  it('exposes Japanese runtime markers', () => {
    expect(SUMMARY_PIPELINE_REVISION).toBe('summary-runtime-282-v1');
    expect(SUMMARY_BUILDER_REVISION_JA).toBe('entry-owned-japanese-rebuild-v1');
    expect(SUMMARY_UNIT_SPLITTER_REVISION_JA).toBe('japanese-three-sentence-slots-v1');
    expect(SUMMARY_GROUNDING_REVISION_JA).toBe('entry-owned-japanese-grounding-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_JA).toBe('japanese-duration-idempotent-v2');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_JA_LEGACY).toBe('japanese-duration-idempotent-v1');
    expect(JAPANESE_EXPERIENCE_MATERIAL_REVISION).toBe('japanese-experience-material-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toEqual(expect.arrayContaining([
      SUMMARY_BUILDER_REVISION_JA,
      SUMMARY_UNIT_SPLITTER_REVISION_JA,
      SUMMARY_GROUNDING_REVISION_JA,
      SUMMARY_DURATION_FINALIZER_REVISION_JA,
      SUMMARY_DURATION_FINALIZER_REVISION_JA_LEGACY,
      JAPANESE_EXPERIENCE_MATERIAL_REVISION,
      'japanese-duration-in-intro-289-v1',
      'japanese-summary-strict-postconditions-289-v1',
    ]));
  });

  it('A: Russian → Japanese current warehouse Experience applies with coverage 3/3', () => {
    const fallback = buildJobContextGenerationFallback({
      locale: 'ja',
      gender: 'female',
      position: '倉庫作業員',
      isPresent: true,
    });
    expect(fallback).toMatch(/入荷した商品/);

    const pipe = runCvAiApplyPipeline({
      cv: baseCv({ currentDescription: WH_RU }),
      locale: 'ja',
      action: 'experience_bullets',
      candidate: WH_JA,
      experienceId: 'exp-wh',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.diagnostics?.finalBulletCount).toBe(3);
    expect(pipe.finalized.diagnostics?.wrongLocaleBulletCount).toBe(0);
    expect(pipe.finalized.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.relevanceValidationPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.tenseValidationPassed).toBe(true);
    // Soft JA triad merges goods+docs and invents inventory/placement — rejected.
    // Hard Japanese warehouse triad is selected instead (AAB-339).
    expect(pipe.finalized.diagnostics?.providerAccepted).toBe(false);
    expect(pipe.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(pipe.finalized.text).toMatch(/倉庫に入荷する商品を確認/);
    expect(pipe.finalized.text).toMatch(/受領した商品に関連する書類を確認/);
    expect(pipe.finalized.text).toMatch(/商品の準備と移動について同僚と連携/);
    expect(pipe.finalized.text).not.toMatch(/倉庫記録を更新|正確性|整然とした配置/);
    expect(pipe.finalized.text).not.toMatch(/loading|delivery|販売|料理|管理/i);
  });

  it('B: Russian → Japanese completed design Experience preserves three families', () => {
    const pipe = runCvAiApplyPipeline({
      cv: baseCv({ priorDescription: DESIGN_RU }),
      locale: 'ja',
      action: 'experience_bullets',
      candidate: DESIGN_JA,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.diagnostics?.finalBulletCount).toBe(3);
    expect(pipe.finalized.text).toMatch(/ビジュアル素材|グラフィック要素/);
    expect(pipe.finalized.text).toMatch(/確認|調整/);
    expect(pipe.finalized.text).toMatch(/ファイル|形式|画面/);
    expect(pipe.finalized.text).not.toMatch(/generic|повседневн|Carries/i);
    const cues = DESIGN_JA.split('\n').flatMap((u) => japaneseDesignCueKeysFromUnit(u));
    expect(cues).toEqual(expect.arrayContaining([
      'design_visual_materials',
      'design_graphic_elements',
      'design_review_adapt',
      'design_files_formats',
      'design_different_screens',
    ]));
  });

  it('C: Japanese Summary rebuilds three entry-owned slots from leak candidate', () => {
    const cv = baseCv({
      currentDescription: WH_JA,
      priorDescription: DESIGN_JA,
    });
    const facts = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
    expect(duration.totalMonths).toBe(78);
    expect(yearWordForLocale('ja', 6.5)).toBe('六年半');
    expect(formatApproximateDurationPhrase(duration, 'ja')).toMatch(/通算約六年半/);
    expect(formatApproximateDurationPhrase(duration, 'ja')).not.toMatch(/6\.5/);

    const summary = buildConciseGroundedSummary(facts, 'ja', 'female', duration, {
      includeSkills: true,
    });
    expect(splitJapaneseSummaryUnits(summary)).toHaveLength(3);
    expect(summary).toMatch(/倉庫作業員/);
    expect(summary).toMatch(/Atlas/);
    expect(summary).toMatch(/2023年1月/);
    expect(summary).toMatch(/通算約六年半/);
    expect(summary).not.toMatch(/6\.5/);
    expect(summary).toMatch(/以前は/);
    expect(summary).toMatch(/Rewitu/);
    expect(summary).toMatch(/グラフィックデザイナー/);
    expect(summary).toMatch(/ビジュアル|グラフィック/);
    expect(summary).not.toMatch(/Графический/);
    expect(summary).not.toMatch(/Carries out assigned/i);
    expect(summary).not.toMatch(/プロフェッショナルな日常/);

    const q = analyzeJapaneseSummaryEmploymentQuality(summary, {
      company: 'Atlas',
      role: '倉庫作業員',
      startDate: '2023-01',
      currentEntryDuties: WH_JA,
      priorEntryDuties: DESIGN_JA,
      priorCompany: 'Rewitu',
      structuredRole: '倉庫作業員',
      gender: 'female',
    });
    expect(q.finalUnitRoleSlots).toEqual(['current_intro', 'current_duty', 'prior_role']);
    expect(q.finalSentenceRoleSlots).toEqual(['current_intro', 'current_duty', 'prior_role']);
    expect(q.currentEmploymentIntroductionCount).toBe(1);
    expect(q.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(q.priorRoleGroundingPassed).toBe(true);
    expect(q.currentSlotForeignFactCount).toBe(0);
    expect(q.priorSlotForeignFactCount).toBe(0);
    expect(q.semanticCrossEntryLeakageDetected).toBe(false);
    expect(q.groundingValidationPassed).toBe(true);

    const leak = 'Графический дизайнер 約6.5年の経験. Carries out assigned professional duties with accuracy and professional communication.';
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'ja',
      gender: 'female',
      cv,
      candidate: leak,
    });
    expect(finalized.blocked).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.text).not.toMatch(/Графический/);
    expect(finalized.text).not.toMatch(/Carries out assigned/i);
    expect(finalized.text).not.toMatch(/6\.5/);
    expect(finalized.text).toMatch(/倉庫作業員/);
    expect(finalized.text).toMatch(/グラフィックデザイナー/);
    expect(finalized.text).toMatch(/通算約六年半/);
    expect(finalized.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
    expect(finalized.diagnostics?.finalUnitRoleSlots).toEqual([
      'current_intro',
      'current_duty',
      'prior_role',
    ]);
    expect(finalized.diagnostics?.finalSentenceRoleSlots).toEqual([
      'current_intro',
      'current_duty',
      'prior_role',
    ]);
    expect(finalized.diagnostics?.currentEmploymentIntroductionCount).toBe(1);
    expect(finalized.diagnostics?.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(finalized.diagnostics?.priorRoleGroundingPassed).toBe(true);
    expect(finalized.diagnostics?.currentSlotForeignFactCount).toBe(0);
    expect(finalized.diagnostics?.priorSlotForeignFactCount).toBe(0);
    expect(finalized.diagnostics?.semanticCrossEntryLeakageDetected).toBe(false);
    expect(finalized.diagnostics?.groundingValidationPassed).toBe(true);
    expect(finalized.diagnostics?.finalPostconditionsPassed).toBe(true);
    expect(finalized.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_JA);
    expect(finalized.diagnostics?.summaryUnitSplitterRevision).toBe(SUMMARY_UNIT_SPLITTER_REVISION_JA);
    expect(finalized.diagnostics?.summaryGroundingRevision).toBe(SUMMARY_GROUNDING_REVISION_JA);
    expect(finalized.diagnostics?.summaryDurationFinalizerRevision).toBe(
      SUMMARY_DURATION_FINALIZER_REVISION_JA,
    );
    expect(finalized.diagnostics?.durationPass1Hash).toBe(finalized.diagnostics?.durationPass2Hash);
    expect(finalized.diagnostics?.durationFinalizerIdempotent).toBe(true);
    expect(countSummaryDurationExpressions(finalized.text, 'ja')).toBe(1);
    const rep = analyzeDurationRepresentations(finalized.text, 'ja');
    expect(rep.numericRepresentationCount).toBe(0);
    expect(rep.writtenRepresentationCount).toBeGreaterThanOrEqual(1);
    expect(rep.hybridDetected).toBe(false);

    const after = applyFinalizedSummaryToCv(cv, 'ja', finalized);
    expect(after.summary).toMatch(/倉庫作業員/);
    expect(after.summary).not.toContain('Графический');
    expect(after.summary).not.toMatch(/6\.5/);
  });

  it('D: mixed-source Experience still yields Japanese Summary', () => {
    const mixedA = baseCv({
      currentDescription: WH_JA,
      priorDescription: DESIGN_RU,
    });
    const mixedB = baseCv({
      currentDescription: WH_RU,
      priorDescription: DESIGN_JA,
    });
    for (const cv of [mixedA, mixedB]) {
      const finalized = finalizeCvAiFieldForApply({
        action: 'summary',
        field: 'summary',
        requestedLocale: 'ja',
        gender: 'female',
        cv,
        candidate: '',
      });
      expect(finalized.blocked).toBe(false);
      expect(finalized.countedAsSuccess).toBe(true);
      expect(finalized.text).toMatch(/倉庫作業員/);
      expect(finalized.text).toMatch(/グラフィックデザイナー/);
      expect(finalized.text).not.toMatch(/[а-яёА-ЯЁ]{4,}/u);
      expect(finalized.text).not.toMatch(/Carries out assigned/i);
    }
  });

  it('E: locale/script purity accepts CJK + approved Latin; rejects RU/EN clauses', () => {
    const purity = validateAiUnitLocalePurity(WH_JA, 'ja', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBe(0);

    const withTokens = 'AtlasとRewitu向けにREST APIおよびSQL・Python・Agileを扱う。';
    expect(validateAiUnitLocalePurity(withTokens, 'ja', {
      kind: 'experience_bullet',
      requireUnits: true,
    }).targetLocalePurityPassed).toBe(true);

    const ruLeak = 'Графический дизайнер выполняет повседневные обязанности.';
    expect(validateAiUnitLocalePurity(ruLeak, 'ja', {
      kind: 'experience_bullet',
      requireUnits: true,
    }).targetLocalePurityPassed).toBe(false);

    const enLeak = 'Carries out assigned professional duties with accuracy and professional communication.';
    expect(validateAiUnitLocalePurity(enLeak, 'ja', {
      kind: 'experience_bullet',
      requireUnits: true,
    }).targetLocalePurityPassed).toBe(false);

    expect(guessUnitLocale(WH_JA.split('\n')[0]!, 'ja')).toBe('ja');
  });

  it('F: entry ownership survives reverse order and delete-while-pending', () => {
    const reversed = baseCv({ order: 'reversed' });
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'ja',
      gender: 'female',
      cv: reversed,
      candidate: '',
    });
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.diagnostics?.finalUnitRoleSlots).toEqual([
      'current_intro',
      'current_duty',
      'prior_role',
    ]);
    expect(finalized.text).toMatch(/Atlas/);
    expect(finalized.text).toMatch(/Rewitu/);
    const intro = splitJapaneseSummaryUnits(finalized.text)[0] || '';
    const duty = splitJapaneseSummaryUnits(finalized.text)[1] || '';
    const prior = splitJapaneseSummaryUnits(finalized.text)[2] || '';
    expect(duty).toMatch(/入荷|倉庫|同僚/);
    expect(duty).not.toMatch(/ビジュアル|デザインファイル/);
    expect(prior).toMatch(/ビジュアル|グラフィック|デザイン/);
    expect(prior).not.toMatch(/入荷した商品/);

    const deleted = runCvAiApplyPipeline({
      cv: baseCv(),
      locale: 'ja',
      action: 'experience_bullets',
      candidate: WH_JA,
      experienceId: 'exp-missing',
    });
    expect(deleted.finalized.blocked).toBe(true);
    expect(deleted.finalized.countedAsSuccess).toBe(false);
  });

  it('G: 50× repeated/reordered Summary runs stay stable', () => {
    const orders: Array<'normal' | 'reversed'> = ['normal', 'reversed'];
    for (let i = 0; i < 50; i += 1) {
      const cv = baseCv({ order: orders[i % 2]! });
      const finalized = finalizeCvAiFieldForApply({
        action: 'summary',
        field: 'summary',
        requestedLocale: 'ja',
        gender: 'female',
        cv,
        candidate: i % 3 === 0
          ? 'Графический дизайнер 約6.5年の経験. Carries out assigned professional duties with accuracy and professional communication.'
          : '',
      });
      expect(finalized.countedAsSuccess).toBe(true);
      expect(finalized.diagnostics?.finalUnitRoleSlots).toEqual([
        'current_intro',
        'current_duty',
        'prior_role',
      ]);
      expect(finalized.text).not.toMatch(/Carries out assigned/i);
      expect(finalized.text).not.toMatch(/Графический/);
      expect(finalized.text).not.toMatch(/6\.5/);
      expect(countSummaryDurationExpressions(finalized.text, 'ja')).toBe(1);
    }
  });

  it('maps Japanese warehouse material cues (not generic_duty)', () => {
    for (const unit of WH_JA.split('\n')) {
      const cues = japaneseWarehouseCueKeysFromUnit(unit!);
      expect(cues.length).toBeGreaterThan(0);
      expect(cues).not.toContain('generic_duty');
    }
    const all = WH_JA.split('\n').flatMap((u) => japaneseWarehouseCueKeysFromUnit(u));
    expect(all).toEqual(expect.arrayContaining([
      'warehouse_inbound_check',
      'warehouse_records',
      'warehouse_colleague_coordination',
    ]));
    expect(classifyMaterialDutyKeys(WH_JA).some((k) => k.startsWith('warehouse_'))).toBe(true);
  });

  it('Japanese splitter handles 。 and Latin nouns without space dependence', () => {
    const text = '倉庫作業員としてAtlasに2023年1月から勤務し、通算約六年半の実務経験を有する。入荷商品の確認に従事している。以前はRewituでグラフィックデザイナーとして担当した。';
    const units = splitJapaneseSummaryUnits(text);
    expect(units).toHaveLength(3);
    expect(units[0]).toContain('Atlas');
    expect(units[0]).toContain('2023年1月');
    expect(units[2]).toContain('Rewitu');
  });
});
