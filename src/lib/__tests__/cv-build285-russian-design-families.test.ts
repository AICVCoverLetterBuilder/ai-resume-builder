/**
 * Build-285 Russian completed design Experience: reject false-positive provider
 * generic/visual-dup bullets; apply concrete three-family fallback.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import {
  classifyMaterialDutyKeys,
  collectDesignMaterialKeysFromDescription,
  isRussianGenericDesignDutyUnit,
  russianDesignCueKeysFromUnit,
  sourceRequiresRussianDesignFamilies,
  validateExperienceApplyMaterialPostcondition,
  validateMaterialDutyCoverage,
  validateRussianDesignFactFamilies,
  RUSSIAN_DESIGN_FAMILIES_REVISION,
} from '../cv-material-duty-coverage';
import { validateCrossLocaleSemanticCoverage } from '../cv-cross-locale-experience';
import { buildConciseGroundedSummary } from '../cv-summary-grounding';
import { buildCvCanonicalFactSet } from '../cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '../cv-experience-duration';

const WH_AR = [
  'تتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
  'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع.',
  'تنسّق إعداد البضائع وحركتها مع الزملاء.',
].join('\n');

const DESIGN_AR_PAST = [
  'أعدّت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
  'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
  'أعدّت ملفات التصميم النهائية وضبطت الصيغ لشاشات مختلفة.',
].join('\n');

const WH_RU_DEVICE = [
  'Проверяет входящие товары и сопроводительную документацию для обеспечения точности учёта.',
  'Ведёт складские записи и поддерживает порядок и организацию хранения товаров.',
  'Координирует с коллегами подготовку товаров и организацию их перемещения внутри склада.',
].join('\n');

const DESIGN_RU_GOOD = [
  'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
  'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
  'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
].join('\n');

/** Exact bad provider output from build-285 device. */
const DESIGN_RU_BAD_PROVIDER = [
  'Выполняла повседневные дизайн-задачи, проверяя точность сопутствующих материалов.',
  'Проверяла визуальные материалы и дизайн-спецификации на согласованность.',
  'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
].join('\n');

function designCv(description = DESIGN_AR_PAST): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Grafički dizajner',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'exp-design',
        position: 'Grafički dizajner',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description,
      },
      {
        id: 'exp-wh',
        position: 'Radnica u skladištu',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_AR,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

function warehouseCv(): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'exp-wh',
        position: 'Radnica u skladištu',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_AR,
      },
      {
        id: 'exp-design',
        position: 'Grafički dizajner',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: DESIGN_AR_PAST,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

describe('cv-build285 Russian completed design false-positive coverage', () => {
  it('exposes russian-design-families-286-v1 runtime marker', () => {
    expect(RUSSIAN_DESIGN_FAMILIES_REVISION).toBe('russian-design-families-286-v1');
  });

  it('explains false 3/3: soft semantic frames pass while material/files fail', () => {
    const semantic = validateCrossLocaleSemanticCoverage(DESIGN_AR_PAST, DESIGN_RU_BAD_PROVIDER);
    expect(semantic.ok).toBe(true);
    expect(semantic.coveredCount).toBe(3);

    const coverage = validateMaterialDutyCoverage(DESIGN_AR_PAST, DESIGN_RU_BAD_PROVIDER);
    expect(coverage.valid).toBe(false);
    expect(coverage.missing).toContain('design_files_formats');

    // Bare проверя must not satisfy review/adapt after the matcher fix.
    expect(coverage.missing).toContain('design_review_adapt');

    const post = validateExperienceApplyMaterialPostcondition(
      DESIGN_AR_PAST,
      DESIGN_RU_BAD_PROVIDER,
      { targetLocale: 'ru' },
    );
    expect(post.ok).toBe(false);
  });

  it('generic design-duty unit covers zero authoritative families', () => {
    const generic = 'Выполняла повседневные дизайн-задачи, проверяя точность сопутствующих материалов.';
    expect(isRussianGenericDesignDutyUnit(generic)).toBe(true);
    expect(russianDesignCueKeysFromUnit(generic)).toEqual([]);
    expect(classifyMaterialDutyKeys(generic)).toEqual(['generic_duty']);
    const fam = validateRussianDesignFactFamilies(generic);
    expect(fam.genericOnlyMaterialCoverageCount).toBeGreaterThanOrEqual(1);
    expect(fam.coveredFamilies).toEqual([]);
  });

  it('detects distinct families and semantic visual-material duplication on bad provider', () => {
    expect(sourceRequiresRussianDesignFamilies(DESIGN_AR_PAST)).toBe(true);
    const fam = validateRussianDesignFactFamilies(DESIGN_RU_BAD_PROVIDER);
    expect(fam.ok).toBe(false);
    expect(fam.creationCovered).toBe(true);
    expect(fam.reviewAdaptationCovered).toBe(false);
    expect(fam.finalDeliveryCovered).toBe(false);
    expect(fam.missingFamilies).toContain('final_delivery_formats');
    expect(fam.missingFamilies).toContain('review_adaptation');
    expect(fam.genericDutyUnitCount).toBeGreaterThanOrEqual(1);
    expect(fam.semanticVisualMaterialDuplicateCount).toBeGreaterThanOrEqual(1);
  });

    it('rejects bad provider and applies concrete design fallback with usage +1', () => {
    const pipe = runCvAiApplyPipeline({
      cv: designCv(),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: DESIGN_RU_BAD_PROVIDER,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.text).not.toMatch(/повседневн/i);
    expect(pipe.finalized.text).not.toMatch(/сопутствующ/i);
    expect(pipe.finalized.text).toMatch(/Создавала/);
    expect(pipe.finalized.text).toMatch(/адаптировала/i);
    expect(pipe.finalized.text).toMatch(/Подготавливала|настраивала/i);
    expect(pipe.finalized.text).toMatch(/файл|формат|экран/i);
    expect(pipe.finalized.origin).toMatch(/fallback|deterministic/i);
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackApplied
      || pipe.finalized.diagnostics?.fallbackApplied).toBe(true);
    expect(pipe.finalized.diagnostics?.relevanceValidationPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.tenseValidationPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.perspectiveValidationPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.targetLocalePurityPassed).toBe(true);
    const fam = validateRussianDesignFactFamilies(pipe.finalized.text);
    expect(fam.ok).toBe(true);
    expect(fam.coveredFamilies).toEqual([
      'creation',
      'review_adaptation',
      'final_delivery_formats',
    ]);
  });

  it('bad provider fails families even when soft semantic coverage is 3/3', () => {
    const fam = validateRussianDesignFactFamilies(DESIGN_RU_BAD_PROVIDER);
    expect(fam.ok).toBe(false);
    expect(fam.reason).toBeTruthy();
    const semantic = validateCrossLocaleSemanticCoverage(DESIGN_AR_PAST, DESIGN_RU_BAD_PROVIDER);
    expect(semantic.ok).toBe(true);
    const post = validateExperienceApplyMaterialPostcondition(
      DESIGN_AR_PAST,
      DESIGN_RU_BAD_PROVIDER,
      { targetLocale: 'ru' },
    );
    expect(post.ok).toBe(false);
  });

it('good three-family output and device warehouse still pass', () => {
    const fam = validateRussianDesignFactFamilies(DESIGN_RU_GOOD);
    expect(fam.ok).toBe(true);

    const wh = runCvAiApplyPipeline({
      cv: warehouseCv(),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: WH_RU_DEVICE,
      experienceId: 'exp-wh',
    });
    expect(wh.finalized.blocked).toBe(false);
    expect(wh.finalized.countedAsSuccess).toBe(true);
    expect(wh.finalized.text).toMatch(/Проверяет|Ведёт|Координирует/);
  });

  it('Summary priorEntryMaterialKeys reports distinct design families', () => {
    const cv = designCv();
    // Prior still Arabic (authoritative); current warehouse Arabic — Summary ru.
    cv.experience = [
      {
        id: 'exp-wh',
        position: 'Radnica u skladištu',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_AR,
      },
      {
        id: 'exp-design',
        position: 'Grafički dizajner',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: DESIGN_AR_PAST,
      },
    ];
    const keys = collectDesignMaterialKeysFromDescription(DESIGN_AR_PAST);
    expect(keys).toEqual(expect.arrayContaining([
      'design_visual_materials',
      'design_review_adapt',
      'design_files_formats',
    ]));
    expect(keys).toEqual(expect.arrayContaining([
      'design_graphic_elements',
      'design_project_requirements',
      'design_different_screens',
    ]));

    const facts = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
    const summary = buildConciseGroundedSummary(facts, 'ru', 'female', duration, {
      includeSkills: true,
    });
    expect(summary).toMatch(/сотрудниц(?:ей|а)\s+склад|кладовщиц/iu);
    expect(summary).toMatch(/создавала|адаптировала|подготавливала/i);
    expect(summary).not.toMatch(/Carries out assigned/i);

    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'ru',
      gender: 'female',
      cv,
      candidate: '',
    });
    expect(finalized.blocked).toBe(false);
    const priorKeys = finalized.diagnostics?.priorEntryMaterialKeys || [];
    expect(priorKeys).toEqual(expect.arrayContaining([
      'design_visual_materials',
      'design_graphic_elements',
      'design_review_adapt',
      'design_project_requirements',
      'design_files_formats',
      'design_different_screens',
    ]));
  });

  it('50× reordered bad-provider → good fallback is stable', () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const bullets = DESIGN_RU_BAD_PROVIDER.split('\n');
      const rotated = [...bullets.slice(i % 3), ...bullets.slice(0, i % 3)].join('\n');
      const pipe = runCvAiApplyPipeline({
        cv: designCv(),
        locale: 'ru',
        action: 'experience_bullets',
        candidate: rotated,
        experienceId: 'exp-design',
      });
      expect(pipe.finalized.blocked, `run ${i}`).toBe(false);
      expect(pipe.finalized.text, `run ${i}`).not.toMatch(/повседневн/i);
      expect(validateRussianDesignFactFamilies(pipe.finalized.text).ok, `run ${i}`).toBe(true);
      hashes.add(pipe.finalized.text.replace(/\s+/g, ' ').trim());
    }
    expect(hashes.size).toBeGreaterThanOrEqual(1);
    expect(hashes.size).toBeLessThanOrEqual(3);
  });
});
