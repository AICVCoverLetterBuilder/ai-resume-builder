/**
 * Build-286 device regression: live textarea already holds the rejected
 * build-285 generic/visual-dup Russian design prose. Provider reject must stay
 * fail-closed; concrete three-family rebuild must apply with usage +1.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
  SUMMARY_RUNTIME_MARKER_SET,
} from '../cv-ai-finalize-apply';
import {
  experienceNeedsRussianDesignFamilyRebuild,
  isRussianDesignFamilyRejectionReason,
  RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION,
  RUSSIAN_DESIGN_FAMILIES_REVISION,
  validateRussianDesignFactFamilies,
} from '../cv-material-duty-coverage';
import { buildJobContextGenerationFallback } from '../cv-experience-ai-operation-mode';
import { formatExperienceBullets } from '../cv-canonical-facts';

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
void DESIGN_AR_PAST;

const WH_RU_DEVICE = [
  'Проверяет входящие товары и сопроводительную документацию для обеспечения точности учёта.',
  'Ведёт складские записи и поддерживает порядок и организацию хранения товаров.',
  'Координирует с коллегами подготовку товаров и организацию их перемещения внутри склада.',
].join('\n');

/** Exact live textarea / provider text from build-286 device failure. */
const DESIGN_RU_BAD_LIVE = [
  'Выполняла повседневные дизайн-задачи, проверяя точность сопутствующих материалов.',
  'Проверяла визуальные материалы и дизайн-спецификации на согласованность.',
  'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
].join('\n');

const DESIGN_RU_GOOD = formatExperienceBullets([
  'Создавала визуальные материалы и графические элементы для цифровых продуктов и платформ.',
  'Проверяла и адаптировала дизайн-материалы в соответствии с требованиями проекта.',
  'Подготавливала финальные дизайн-файлы и настраивала форматы для разных экранов.',
]);

function designCvLiveBad(order: 'design-first' | 'warehouse-first' = 'design-first'): CVData {
  const design = {
    id: 'exp-design',
    position: 'Grafički dizajner',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    // Device after build-285 false-positive: live + frozen fields are the bad prose.
    description: DESIGN_RU_BAD_LIVE,
    originalUserDescription: DESIGN_RU_BAD_LIVE,
    canonicalDescription: DESIGN_RU_BAD_LIVE,
    generatedDescription: DESIGN_RU_BAD_LIVE,
  };
  const warehouse = {
    id: 'exp-wh',
    position: 'Radnica u skladištu',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_AR,
  };
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
    experience: order === 'design-first' ? [design, warehouse] : [warehouse, design],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

describe('cv-build286 Russian design fallback routing', () => {
  it('exposes russian-design-fallback-routing-287-v1 and retains families-286 marker', () => {
    expect(RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION).toBe(
      'russian-design-fallback-routing-287-v1',
    );
    expect(RUSSIAN_DESIGN_FAMILIES_REVISION).toBe('russian-design-families-286-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(RUSSIAN_DESIGN_FAMILIES_REVISION);
  });

  it('detects rebuild need for live bad textarea without treating locale as the failure', () => {
    expect(experienceNeedsRussianDesignFamilyRebuild({
      locale: 'ru',
      sourceDescription: DESIGN_RU_BAD_LIVE,
      position: 'Grafički dizajner',
      rejectReason: 'russian_design_generic_duty',
    })).toBe(true);
    expect(isRussianDesignFamilyRejectionReason('russian_design_generic_duty')).toBe(true);
    expect(isRussianDesignFamilyRejectionReason('locale_mismatch')).toBe(false);
    const fam = validateRussianDesignFactFamilies(DESIGN_RU_BAD_LIVE);
    expect(fam.ok).toBe(false);
    expect(fam.reason).toBe('russian_design_generic_duty');
  });

  it('exact device live-bad textarea: reject provider, rebuild three families, usage +1', () => {
    const pipe = runCvAiApplyPipeline({
      cv: designCvLiveBad(),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: DESIGN_RU_BAD_LIVE,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.diagnostics?.providerRejectionReason
      || pipe.finalized.diagnostics?.typedFailureReason).toMatch(/russian_design/);
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackReason)
      .toBe('russian_design_family_rebuild');
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackReason)
      .not.toBe('locale_mismatch');
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackApplied).toBe(true);
    expect(pipe.finalized.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(pipe.finalized.diagnostics?.authoritativeRequiredFamilyCount).toBe(3);
    expect(pipe.finalized.diagnostics?.finalSelectedCoveredFamilyCount).toBe(3);
    expect(pipe.finalized.diagnostics?.fallbackCoveredFamilyCount).toBe(3);
    expect(pipe.finalized.text).not.toMatch(/повседневн/i);
    expect(pipe.finalized.text).not.toMatch(/сопутствующ/i);
    expect(pipe.finalized.text).not.toMatch(/товар|склад/i);
    expect(pipe.finalized.text).toMatch(/Создавала/);
    expect(pipe.finalized.text).toMatch(/адаптировала/i);
    expect(pipe.finalized.text).toMatch(/Подготавливала|настраивала/i);
    const fam = validateRussianDesignFactFamilies(pipe.finalized.text);
    expect(fam.ok).toBe(true);
    expect(fam.coveredFamilies).toEqual([
      'creation',
      'review_adaptation',
      'final_delivery_formats',
    ]);
    expect(pipe.stateCv.experience?.find((e) => e.id === 'exp-design')?.description)
      .toMatch(/адаптировала/i);
  });

  it('provider-only reject path stays usage +0 until apply succeeds', () => {
    const fin = finalizeCvAiFieldForApply({
      cv: designCvLiveBad(),
      locale: 'ru',
      requestedLocale: 'ru',
      gender: 'female',
      action: 'experience_bullets',
      field: 'experience_description',
      candidate: DESIGN_RU_BAD_LIVE,
      experienceId: 'exp-design',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.providerRejectionReason).toBe('russian_design_generic_duty');
    expect(fin.diagnostics?.clientDeterministicFallbackReason)
      .toBe('russian_design_family_rebuild');
    expect(fin.text).not.toMatch(/повседневн/i);
    expect(fin.origin).toMatch(/fallback|deterministic/i);
  });

  it('bypasses source-preserving of bad live prose', () => {
    const expected = buildJobContextGenerationFallback({
      locale: 'ru',
      gender: 'female',
      position: 'Grafički dizajner',
      industry: 'design',
      isPresent: false,
    });
    const pipe = runCvAiApplyPipeline({
      cv: designCvLiveBad(),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: DESIGN_RU_BAD_LIVE,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackReason)
      .toBe('russian_design_family_rebuild');
    expect(pipe.finalized.text.replace(/\s+/g, ' ').trim())
      .toBe(expected.replace(/\s+/g, ' ').trim());
    expect(pipe.finalized.text).toBe(DESIGN_RU_GOOD);
  });

  it('reversed Experience order and warehouse preservation', () => {
    const designPipe = runCvAiApplyPipeline({
      cv: designCvLiveBad('warehouse-first'),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: DESIGN_RU_BAD_LIVE,
      experienceId: 'exp-design',
    });
    expect(designPipe.finalized.countedAsSuccess).toBe(true);
    expect(designPipe.finalized.text).toBe(DESIGN_RU_GOOD);
    expect(designPipe.finalized.text).not.toMatch(/товар|склад/i);

    const wh = runCvAiApplyPipeline({
      cv: designCvLiveBad('warehouse-first'),
      locale: 'ru',
      action: 'experience_bullets',
      candidate: WH_RU_DEVICE,
      experienceId: 'exp-wh',
    });
    expect(wh.finalized.blocked).toBe(false);
    expect(wh.finalized.countedAsSuccess).toBe(true);
    expect(wh.finalized.text).toMatch(/Проверяет|Ведёт|Координирует/);
    expect(wh.finalized.diagnostics?.clientDeterministicFallbackReason)
      .not.toBe('russian_design_family_rebuild');
  });

  it('male completed design rebuild uses masculine past forms', () => {
    const cv = designCvLiveBad();
    cv.personal = { ...cv.personal!, gender: 'male' };
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'ru',
      action: 'experience_bullets',
      candidate: DESIGN_RU_BAD_LIVE,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackReason)
      .toBe('russian_design_family_rebuild');
    expect(pipe.finalized.text).toMatch(/Создавал/);
    expect(pipe.finalized.text).not.toMatch(/Создавала/);
    expect(pipe.finalized.text).toMatch(/адаптировал/);
    expect(pipe.finalized.text).not.toMatch(/адаптировала/);
  });

  it('50× repeated live-bad rebuild stays stable', () => {
    for (let i = 0; i < 50; i += 1) {
      const pipe = runCvAiApplyPipeline({
        cv: designCvLiveBad(i % 2 === 0 ? 'design-first' : 'warehouse-first'),
        locale: 'ru',
        action: 'experience_bullets',
        candidate: DESIGN_RU_BAD_LIVE,
        experienceId: 'exp-design',
      });
      expect(pipe.finalized.countedAsSuccess, `run ${i}`).toBe(true);
      expect(pipe.finalized.diagnostics?.clientDeterministicFallbackReason, `run ${i}`)
        .toBe('russian_design_family_rebuild');
      expect(pipe.finalized.text, `run ${i}`).toBe(DESIGN_RU_GOOD);
      expect(validateRussianDesignFactFamilies(pipe.finalized.text).ok, `run ${i}`).toBe(true);
    }
  });
});
