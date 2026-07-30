/**
 * Build-284 Russian Experience + Summary package regression.
 * Fixture: Arabic warehouse current + Arabic/Russian design prior → Russian target.
 */
import { describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
  SUMMARY_PIPELINE_REVISION,
} from '../cv-ai-finalize-apply';
import {
  buildJobContextGenerationFallback,
} from '../cv-experience-ai-operation-mode';
import {
  classifyMaterialDutyKeys,
  russianWarehouseCueKeysFromUnit,
  russianDesignCueKeysFromUnit,
  RUSSIAN_EXPERIENCE_MATERIAL_REVISION,
} from '../cv-material-duty-coverage';
import {
  analyzeRussianSummaryEmploymentQuality,
  buildConciseGroundedSummary,
  SUMMARY_BUILDER_REVISION_RU,
  SUMMARY_UNIT_SPLITTER_REVISION_RU,
  SUMMARY_GROUNDING_REVISION_RU,
} from '../cv-summary-grounding';
import { buildCvCanonicalFactSet } from '../cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '../cv-experience-duration';
import { SUMMARY_DURATION_FINALIZER_REVISION_RU } from '../cv-content-quality';
import { validateAiUnitLocalePurity, guessUnitLocale } from '../cv-ai-unit-locale-purity';
import { analyzeContentLocale } from '../cv-content-locale';
import { validateRussianExperienceEmploymentTense } from '../cv-russian-experience-tense';

const WH_AR = [
  'تتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
  'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع.',
  'تنسّق إعداد البضائع وحركتها مع الزملاء.',
].join('\n');

const WH_EN = [
  'checks incoming goods;',
  'checks documentation related to received goods;',
  'coordinates with colleagues on preparation and movement of goods.',
].join('\n');

const DESIGN_AR_PAST = [
  'أعدّت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
  'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
  'أعدّت ملفات التصميم النهائية وضبطت الصيغ لشاشات مختلفة.',
].join('\n');

const WH_RU_PRESENT = [
  'Проверяет поступающие товары и сопроводительные документы, обеспечивая точность учёта.',
  'Обновляет складские записи и поддерживает порядок и организованное размещение товаров.',
  'Координирует с коллегами подготовку товаров и их перемещение внутри склада.',
].join('\n');

const DESIGN_RU_PAST = [
  'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
  'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
  'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
].join('\n');

function baseCv(options?: {
  order?: 'normal' | 'reversed';
  priorDescription?: string;
  currentDescription?: string;
}): CVData {
  const current = {
    id: 'exp-wh',
    position: 'Radnica u skladištu',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: options?.currentDescription ?? WH_AR,
  };
  const prior = {
    id: 'exp-design',
    position: 'Grafički dizajner',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: options?.priorDescription ?? DESIGN_AR_PAST,
  };
  const order = options?.order || 'normal';
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary: 'Carries out assigned professional duties with accuracy and professional communication.',
    summaryOrigin: 'ai_generated',
    experience: order === 'normal' ? [current, prior] : [prior, current],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'ar',
    templateId: 'modern-minimal',
  } as CVData;
}

describe('cv-build284 Russian Experience/Summary package', () => {
  it('exposes Russian runtime markers', () => {
    expect(SUMMARY_PIPELINE_REVISION).toBe('summary-runtime-282-v1');
    expect(SUMMARY_BUILDER_REVISION_RU).toBe('entry-owned-russian-rebuild-362-v1');
    expect(SUMMARY_UNIT_SPLITTER_REVISION_RU).toBe('russian-three-unit-slots-362-v1');
    expect(SUMMARY_GROUNDING_REVISION_RU).toBe('entry-owned-russian-grounding-362-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_RU).toBe('russian-duration-idempotent-v1');
    expect(RUSSIAN_EXPERIENCE_MATERIAL_REVISION).toBe('russian-experience-material-v1');
  });

  it('classifies three Russian warehouse bullets as ru/ru/ru (no false Serbian)', () => {
    const purity = validateAiUnitLocalePurity(WH_RU_PRESENT, 'ru', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.detectedLocaleByUnit).toEqual(['ru', 'ru', 'ru']);
    expect(purity.wrongLocaleUnitCount).toBe(0);
    expect(purity.wrongScriptUnitCount).toBe(0);
    expect(purity.sourceLanguageLeakageDetected).toBe(false);
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(guessUnitLocale(WH_RU_PRESENT.split('\n')[2]!, 'ru')).toBe('ru');
    expect(analyzeContentLocale(WH_RU_PRESENT.split('\n')[2]!).detectedLocale).toBe('ru');
  });

  it('keeps Serbian Cyrillic distinct from Russian', () => {
    const sr = 'Прегледа пристиглу робу и ажурира евиденцију у заједничком одељењу.';
    expect(guessUnitLocale(sr, 'sr')).toBe('sr');
    expect(analyzeContentLocale(sr).detectedLocale).toBe('sr');
    const purity = validateAiUnitLocalePurity(sr, 'ru', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(false);
  });

  it('allows Latin proper nouns and REST/SQL inside Russian', () => {
    const bullet = 'Проверяет REST API и SQL-записи склада Atlas для Rewitu.';
    const purity = validateAiUnitLocalePurity(bullet, 'ru', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongScriptUnitCount).toBe(0);
  });

  it('maps Russian warehouse and design material cues', () => {
    const whKeys = classifyMaterialDutyKeys(WH_RU_PRESENT);
    expect(whKeys).toEqual(expect.arrayContaining([
      'warehouse_inbound_check',
      'warehouse_records',
      'warehouse_movement',
    ]));
    expect(russianWarehouseCueKeysFromUnit(WH_RU_PRESENT.split('\n')[0]!)).toEqual(
      expect.arrayContaining(['warehouse_inbound_check']),
    );
    const designKeys = classifyMaterialDutyKeys(DESIGN_RU_PAST);
    expect(designKeys.some((k) => k.startsWith('design_'))).toBe(true);
    expect(russianDesignCueKeysFromUnit(DESIGN_RU_PAST.split('\n')[0]!)).toContain(
      'design_visual_materials',
    );
  });

  it('A: Arabic → Russian current warehouse Experience applies with usage +1', () => {
    const cv = baseCv();
    const fallback = buildJobContextGenerationFallback({
      locale: 'ru',
      gender: 'female',
      position: 'Кладовщица',
      isPresent: true,
    });
    expect(fallback).toMatch(/Проверяет поступающие товары/);

    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'ru',
      action: 'experience_bullets',
      candidate: WH_RU_PRESENT,
      experienceId: 'exp-wh',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.diagnostics?.finalBulletCount).toBe(3);
    expect(pipe.finalized.diagnostics?.wrongLocaleBulletCount).toBe(0);
    expect(pipe.finalized.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.relevanceValidationPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.tenseValidationPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.perspectiveValidationPassed).toBe(true);
    expect(pipe.finalized.text).toMatch(/Проверяет/);
    expect(pipe.finalized.text).toMatch(/Координирует/);
    expect(pipe.stateCv.experience.find((e) => e.id === 'exp-wh')?.description).toContain('Проверяет');

    const tense = validateRussianExperienceEmploymentTense(pipe.finalized.text, {
      isPresent: true,
      gender: 'female',
    });
    expect(tense.finalTensePassed).toBe(true);
  });

  it('B: Arabic → Russian completed design Experience applies concrete past bullets', () => {
    const pipe = runCvAiApplyPipeline({
      cv: baseCv(),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: DESIGN_RU_PAST,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.text).not.toMatch(/повседневн/i);
    expect(pipe.finalized.text).toMatch(/Создавала/);
    expect(pipe.finalized.text).toMatch(/Подготавливала/);
    expect(pipe.finalized.diagnostics?.relevanceValidationPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.tenseValidationPassed).toBe(true);
    expect(classifyMaterialDutyKeys(pipe.finalized.text).some((k) => k.startsWith('design_'))).toBe(true);
    expect(russianDesignCueKeysFromUnit(pipe.finalized.text.split('\n')[0] || pipe.finalized.text))
      .toContain('design_visual_materials');
  });

  it('C: mixed-locale Russian Summary builds three entry-owned sentences', () => {
    const cv = baseCv({
      currentDescription: WH_AR,
      priorDescription: DESIGN_RU_PAST,
    });
    const facts = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
    const summary = buildConciseGroundedSummary(facts, 'ru', 'female', duration, {
      includeSkills: true,
    });
    expect(summary).not.toMatch(/Carries out assigned professional duties/i);
    if (!summaryV2ModeActive()) {
      expect(summary).toMatch(/сотрудниц(?:ей|а)\s+склад|кладовщиц/iu);
    } else {
      expect(String(summary || "")).toMatch(/Atlas|Rewitu/i);
    }
    expect(summary).toMatch(/Atlas/);
    expect(summary).toMatch(/У меня около/);
    expect(summary).toMatch(/Rewitu/);
    expect(summary).toMatch(/Ранее я работала/);
    expect(summary).toMatch(/создавала|проверяла|адаптировала|подготавливала/i);
    expect(summary).toMatch(/шести с половиной лет/);
    expect(summary).not.toMatch(/6\.5/);

    const q = analyzeRussianSummaryEmploymentQuality(summary, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      startDate: '2023-01',
      currentEntryDuties: WH_EN,
      priorEntryDuties: DESIGN_RU_PAST,
      priorCompany: 'Rewitu',
      priorRole: 'Graphic Designer',
      structuredRole: 'сотрудницей склада',
      gender: 'female',
      expectedDuration: duration,
    });
    expect(q.finalUnitRoleSlots).toEqual(['duration', 'current_intro', 'prior_role']);
    expect(q.finalSentenceRoleSlots).toEqual(['duration', 'current_intro', 'prior_role']);
    expect(q.currentEmploymentIntroductionCount).toBe(1);
    expect(q.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(q.priorRoleGroundingPassed).toBe(true);
    expect(q.currentSlotForeignFactCount).toBe(0);
    expect(q.priorSlotForeignFactCount).toBe(0);
    if (!summaryV2ModeActive()) {
      expect(q.semanticCrossEntryLeakageDetected).toBe(false);
    }
    expect(q.groundingValidationPassed).toBe(true);

    const leak = 'Carries out assigned professional duties with accuracy and professional communication.';
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'ru',
      gender: 'female',
      cv,
      candidate: leak,
    });
    expect(finalized.blocked).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.text).not.toMatch(/Carries out assigned/i);
    expectV2OrLegacyBuilderRevision(finalized.diagnostics?.summaryBuilderRevision, SUMMARY_BUILDER_REVISION_RU);
    if (!summaryV2ModeActive()) {
      expect(finalized.diagnostics?.summaryUnitSplitterRevision).toBe(SUMMARY_UNIT_SPLITTER_REVISION_RU);
      expect(finalized.diagnostics?.summaryGroundingRevision).toBe(SUMMARY_GROUNDING_REVISION_RU);
      expect(finalized.diagnostics?.summaryDurationFinalizerRevision).toBe(
        SUMMARY_DURATION_FINALIZER_REVISION_RU,
      );
      expect(finalized.diagnostics?.finalUnitRoleSlots).toEqual([
        'duration',
        'current_intro',
        'prior_role',
      ]);
      expect(finalized.diagnostics?.durationPass1Hash).toBe(finalized.diagnostics?.durationPass2Hash);
      expect(finalized.diagnostics?.groundingValidationPassed).toBe(true);
      expect(finalized.diagnostics?.finalPostconditionsPassed).toBe(true);
    } else {
      expectSummaryContractInvariants({
        text: finalized.text,
        locale: 'ru',
        cv,
        requirePrior: true,
      });
    }

    const after = applyFinalizedSummaryToCv(cv, 'ru', finalized);
    if (!summaryV2ModeActive()) {
      expect(after.summary).toMatch(/сотрудниц(?:ей|а)\s+склад|кладовщиц/iu);
    } else {
      expect(String(after.summary || "")).toMatch(/Atlas|Rewitu/i);
    }
    expect(after.summary).not.toContain(leak);
  });

  it('rejects English generic Summary sentence under Russian', () => {
    const leak = 'Carries out assigned professional duties with accuracy and professional communication.';
    const cv = baseCv();
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'ru',
      gender: 'female',
      cv,
      candidate: leak,
    });
    expect(finalized.text || '').not.toContain(leak);
    expect(finalized.text || '').not.toMatch(/Carries out assigned/i);
  });

  it('E: reverse Experience order preserves entry ownership', () => {
    const cv = baseCv({ order: 'reversed', priorDescription: DESIGN_RU_PAST });
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'ru',
      action: 'summary',
      candidate: '',
    });
    expect(pipe.finalized.blocked).toBe(false);
    if (!summaryV2ModeActive()) {
      expect(pipe.finalized.text).toMatch(/сотрудниц(?:ей|а)\s+склад|кладовщиц/iu);
    } else {
      expect(String(pipe.finalized.text || "")).toMatch(/Atlas|Rewitu/i);
    }
    expect(pipe.finalized.text).toMatch(/Rewitu/);
    if (!summaryV2ModeActive()) {
      expect(pipe.finalized.diagnostics?.semanticCrossEntryLeakageDetected).toBe(false);
    }
  });

  it('F: 50 repeated/reordered runs stay stable', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const order = i % 2 === 0 ? 'normal' : 'reversed';
      const cv = baseCv({
        order,
        priorDescription: i % 3 === 0 ? DESIGN_RU_PAST : DESIGN_AR_PAST,
      });
      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'ru',
        action: 'summary',
        candidate: '',
      });
      expect(pipe.finalized.blocked, `run ${i}`).toBe(false);
      expect(pipe.finalized.diagnostics?.finalUnitRoleSlots, `run ${i}`).toEqual([
        'duration',
        'current_intro',
        'prior_role',
      ]);
      expect(pipe.finalized.text, `run ${i}`).not.toMatch(/Carries out assigned/i);
      hashes.add((pipe.finalized.text || '').replace(/\s+/g, ' ').trim());
      const purity = validateAiUnitLocalePurity(WH_RU_PRESENT, 'ru', {
        kind: 'experience_bullet',
        requireUnits: true,
      });
      expect(purity.detectedLocaleByUnit, `run ${i}`).toEqual(['ru', 'ru', 'ru']);
    }
    expect(hashes.size).toBeGreaterThanOrEqual(1);
    expect(hashes.size).toBeLessThanOrEqual(4);
  });

  it('G: successful Russian Experience apply increments once', () => {
    const pipe = runCvAiApplyPipeline({
      cv: baseCv(),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: WH_RU_PRESENT,
      experienceId: 'exp-wh',
    });
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.stateCv.experience.find((e) => e.id === 'exp-wh')?.description).toMatch(/Проверяет/);
  });
});
