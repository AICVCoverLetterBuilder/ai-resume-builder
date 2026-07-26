/**
 * Build-282 Arabic Experience + Summary package regression.
 * Fixture: Hindi-validated CV switched to Arabic (warehouse current + design prior).
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
  applyFinalizedSummaryToCv,
  runCvAiApplyPipeline,
  SUMMARY_PIPELINE_REVISION,
} from '../cv-ai-finalize-apply';
import {
  buildJobContextGenerationFallback,
  validateExperienceGenerationOutput,
} from '../cv-experience-ai-operation-mode';
import {
  classifyMaterialDutyKeys,
  arabicWarehouseCueKeysFromUnit,
  arabicDesignCueKeysFromUnit,
  materialDutyKeysFromDescription,
} from '../cv-material-duty-coverage';
import {
  analyzeArabicSummaryEmploymentQuality,
  buildConciseGroundedSummary,
  SUMMARY_BUILDER_REVISION_AR,
  SUMMARY_UNIT_SPLITTER_REVISION_AR,
  SUMMARY_GROUNDING_REVISION_AR,
} from '../cv-summary-grounding';
import { buildCvCanonicalFactSet } from '../cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '../cv-experience-duration';
import { localizeOccupationalTitleForProjection } from '../cv-role-title';
import { prepareExportReadyCv } from '../prepare-export-ready-cv';
import { SUMMARY_DURATION_FINALIZER_REVISION_AR } from '../cv-content-quality';
import { validateArabicExperienceEmploymentTense } from '../cv-arabic-experience-tense';

const WH_AR = [
  'تتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
  'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع.',
  'تنسّق إعداد البضائع وحركتها مع الزملاء.',
].join('\n');

/** Authoritative EN warehouse triad (pre_ai / Atlas lineage). */
const WH_EN = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const DESIGN_AR_PAST = [
  'أعدّت مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
  'راجعت وكيّفت مواد التصميم وفق متطلبات المشروع.',
  'أعدّت ملفات التصميم النهائية وضبطت الصيغ لشاشات مختلفة.',
].join('\n');

const DESIGN_AR_PRESENT_BAD = [
  'تعدّ مواد بصرية وعناصر رسومية للمنتجات والمنصات الرقمية.',
  'تراجع وتكيّف مواد التصميم وفق متطلبات المشروع.',
  'تعدّ ملفات التصميم النهائية وتضبط الصيغ لشاشات مختلفة.',
].join('\n');

function baseCv(order: 'normal' | 'reversed' = 'normal'): CVData {
  const current = {
    id: 'exp-wh',
    position: 'Radnica u skladištu',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_AR,
  };
  const prior = {
    id: 'exp-design',
    position: 'Grafički dizajner',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: DESIGN_AR_PAST,
  };
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Radnica u skladištu',
      gender: 'female',
    },
    summary: 'पुराना हिंदी सारांश',
    summaryOrigin: 'ai_generated',
    experience: order === 'normal' ? [current, prior] : [prior, current],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'hi',
    templateId: 'modern-minimal',
  } as CVData;
}

describe('cv-build282 Arabic Experience/Summary package', () => {
  it('exposes Arabic runtime markers', () => {
    expect(SUMMARY_PIPELINE_REVISION).toBe('summary-runtime-282-v1');
    expect(SUMMARY_BUILDER_REVISION_AR).toBe('entry-owned-arabic-rebuild-v1');
    expect(SUMMARY_UNIT_SPLITTER_REVISION_AR).toBe('arabic-three-sentence-slots-v1');
    expect(SUMMARY_GROUNDING_REVISION_AR).toBe('entry-owned-arabic-grounding-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_AR).toBe('arabic-duration-idempotent-v1');
  });

  it('localizes female warehouse and graphic-designer titles', () => {
    expect(localizeOccupationalTitleForProjection('Radnica u skladištu', 'ar', 'female'))
      .toBe('موظفة مستودع');
    expect(localizeOccupationalTitleForProjection('Grafički dizajner', 'ar', 'female'))
      .toBe('مصممة جرافيك');
    expect(localizeOccupationalTitleForProjection('Radnica u skladištu', 'ar', 'male'))
      .toBe('موظف مستودع');
  });

  it('extracts Arabic warehouse and design material keys (not generic_duty only)', () => {
    const whKeys = materialDutyKeysFromDescription(WH_AR).filter((k) => k !== 'generic_duty');
    expect(whKeys.length).toBeGreaterThanOrEqual(2);
    expect(whKeys.some((k) => k.startsWith('warehouse_'))).toBe(true);
    const cues = WH_AR.split(/\n+/).flatMap((u) => arabicWarehouseCueKeysFromUnit(u));
    expect(cues.length).toBeGreaterThanOrEqual(2);

    const designKeys = materialDutyKeysFromDescription(DESIGN_AR_PAST)
      .filter((k) => k !== 'generic_duty');
    expect(designKeys.some((k) => k.startsWith('design_'))).toBe(true);
    expect(arabicDesignCueKeysFromUnit(DESIGN_AR_PAST.split('\n')[0]!)).toContain(
      'design_visual_materials',
    );
    expect(classifyMaterialDutyKeys(WH_AR.split('\n')[0]!)).not.toEqual(['generic_duty']);
  });

  it('rejects completed Arabic Experience that remains present tense', () => {
    const tense = validateArabicExperienceEmploymentTense(DESIGN_AR_PRESENT_BAD, {
      isPresent: false,
      gender: 'female',
    });
    expect(tense.finalTensePassed).toBe(false);
    expect(tense.finalEmploymentState).toBe('completed');

    const gen = validateExperienceGenerationOutput(DESIGN_AR_PRESENT_BAD, {
      locale: 'ar',
      position: 'Grafički dizajner',
      isPresent: false,
      gender: 'female',
    });
    expect(gen.ok).toBe(false);
    expect(gen.tenseValidationPassed).toBe(false);

    const pastShell = buildJobContextGenerationFallback({
      locale: 'ar',
      gender: 'female',
      position: 'Grafički dizajner',
      isPresent: false,
    });
    expect(pastShell).toMatch(/أعدّت|راجعت|كيّفت/);
    expect(pastShell).not.toMatch(/تعدّ|تراجع/);
    const pastOk = validateExperienceGenerationOutput(pastShell, {
      locale: 'ar',
      position: 'Grafički dizajner',
      isPresent: false,
      gender: 'female',
    });
    expect(pastOk.ok).toBe(true);
    expect(pastOk.tenseValidationPassed).toBe(true);
  });

  it('accepts current female Arabic warehouse present forms', () => {
    const gen = validateExperienceGenerationOutput(WH_AR, {
      locale: 'ar',
      position: 'Radnica u skladištu',
      isPresent: true,
      gender: 'female',
    });
    expect(gen.ok).toBe(true);
    expect(gen.finalTensePassed).toBe(true);
    expect(gen.finalGenderAgreementPassed).toBe(true);
  });

  it('builds entry-owned Arabic three-slot Summary with natural duration', () => {
    const cv = baseCv();
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
    const text = buildConciseGroundedSummary(factSet, 'ar', 'female', duration, {
      includeSkills: true,
    });
    expect(text).toMatch(/موظفة\s*مستودع/);
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/نحو\s+ست\s+سنوات\s+ونصف\s+من\s+الخبرة\s+المشتركة/);
    expect(text).not.toMatch(/6\.5/);
    expect(text).toMatch(/بضائع|وثائق|سجلات|مستودع/);
    expect(text).toMatch(/سبق\s+لها\s+العمل/);
    expect(text).toMatch(/مصممة\s*جرافيك|Rewitu/);
    expect(text).not.toMatch(/Grafički|Carries\s+out|dish|مطبخ|تحميل/);
    expect(text).not.toMatch(/تشمل\s+المهارات/);
    expect(text).not.toMatch(/و القدرة/);

    const q = analyzeArabicSummaryEmploymentQuality(text, {
      company: 'Atlas',
      priorCompany: 'Rewitu',
      structuredRole: 'موظفة مستودع',
      currentEntryDuties: WH_AR,
      priorEntryDuties: DESIGN_AR_PAST,
      gender: 'female',
    });
    expect(q.currentEmploymentIntroductionCount).toBe(1);
    expect(q.currentRoleTitlePresent).toBe(true);
    expect(q.currentRoleTitleMatchesStructuredRole).toBe(true);
    expect(q.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(2);
    expect(q.priorRoleGroundingPassed).toBe(true);
    expect(q.semanticCrossEntryLeakageDetected).toBe(false);
    expect(q.finalUnitRoleSlots).toEqual(['current_intro', 'current_duty', 'prior_role']);
    expect(q.finalUnitRoleSlots).not.toContain('other');
    expect(q.groundingValidationPassed).toBe(true);
  });

  it('rejects mixed Serbian/English provider and never applies that mixed text', () => {
    const cv = baseCv();
    const before = cv.summary;
    const mixed = 'موظفة مستودع. Grafički dizajner. Carries out assigned professional duties with accuracy and professional communication.';
    const finalized = finalizeCvAiFieldForApply({
      action: 'summary',
      field: 'summary',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: mixed,
    });
    // Mixed provider must not remain. Grounded Arabic rebuild may succeed (+1).
    expect(finalized.text || '').not.toMatch(/Grafički|Carries\s+out/);
    if (finalized.countedAsSuccess) {
      expect(finalized.text || '').toMatch(/موظفة\s*مستودع/);
      expect(finalized.text || '').toMatch(/[\u0600-\u06FF]/);
      const after = applyFinalizedSummaryToCv(cv, 'ar', finalized);
      expect(after.summary).not.toBe(mixed);
      expect(after.summary).toMatch(/موظفة\s*مستودع/);
    } else {
      const after = applyFinalizedSummaryToCv(cv, 'ar', finalized);
      expect(after.summary).toBe(before);
    }
  });

  it('successful Summary apply increments once and localizes Experience titles on bullet apply', () => {
    let cv = baseCv();
    const bullets = runCvAiApplyPipeline({
      cv,
      locale: 'ar',
      action: 'experience_bullets',
      candidate: '',
      experienceId: 'exp-design',
    });
    // Empty candidate → deterministic past design shell when repair is needed.
    // Already-valid AR past design may no-op; that is acceptable here.
    if (bullets.finalized.countedAsSuccess) {
      cv = bullets.stateCv;
    } else {
      const past = buildJobContextGenerationFallback({
        locale: 'ar',
        gender: 'female',
        position: 'Grafički dizajner',
        isPresent: false,
      });
      const pipe = runCvAiApplyPipeline({
        cv,
        locale: 'ar',
        action: 'experience_bullets',
        candidate: past,
        experienceId: 'exp-design',
      });
      if (pipe.finalized.countedAsSuccess) {
        cv = pipe.stateCv;
      }
    }
    const design = (cv.experience || []).find((e) => e.id === 'exp-design');
    expect(design?.description || '').toMatch(/أعدّت|راجعت/);

    // Soft AR candidate against EN authority (device lineage) — not soft≡soft no-op.
    const whCv: CVData = {
      ...cv,
      experience: (cv.experience || []).map((e) => (
        e.id === 'exp-wh'
          ? {
            ...e,
            description: WH_EN,
            originalUserDescription: WH_EN,
            canonicalDescription: WH_EN,
          }
          : e
      )),
    };
    const whApply = runCvAiApplyPipeline({
      cv: whCv,
      locale: 'ar',
      action: 'experience_bullets',
      candidate: WH_AR,
      experienceId: 'exp-wh',
    });
    expect(whApply.finalized.countedAsSuccess).toBe(true);
    // Soft AR triad merges goods+docs and invents records/organization — rejected.
    // Hard Arabic warehouse triad is selected instead (AAB-340).
    expect(whApply.finalized.diagnostics?.providerAccepted).toBe(false);
    expect(whApply.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(whApply.finalized.text || '').toMatch(/البضائع الواردة إلى المستودع/);
    expect(whApply.finalized.text || '').toMatch(/المستندات المتعلقة بالبضائع المستلمة/);
    expect(whApply.finalized.text || '').not.toMatch(/التسجيل الدقيق|سجلات المستودع|ترتيب البضائع/);
    cv = whApply.stateCv;
    expect((cv.experience || []).find((e) => e.id === 'exp-wh')?.position).toBe('موظفة مستودع');
    // After warehouse apply, design title should still be localizable when touched.
    expect((cv.experience || []).find((e) => e.id === 'exp-design')?.description || '')
      .toMatch(/أعدّت|راجعت/);

    const summaryPipe = runCvAiApplyPipeline({
      cv,
      locale: 'ar',
      action: 'summary',
      candidate: '',
    });
    expect(summaryPipe.finalized.countedAsSuccess).toBe(true);
    expect(summaryPipe.finalized.diagnostics?.summaryPipelineRevision)
      .toBe('summary-runtime-282-v1');
    expect(summaryPipe.finalized.diagnostics?.summaryBuilderRevision)
      .toBe('entry-owned-arabic-rebuild-v1');
    expect(summaryPipe.finalized.diagnostics?.summaryDurationFinalizerRevision)
      .toBe('arabic-duration-idempotent-v1');
    expect(summaryPipe.finalized.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
    expect(summaryPipe.finalized.diagnostics?.finalUnitRoleSlots).toEqual([
      'current_intro',
      'current_duty',
      'prior_role',
    ]);
    cv = summaryPipe.stateCv;
    expect(cv.summary).toMatch(/موظفة\s*مستودع/);
    expect(cv.summary).not.toMatch(/6\.5/);
    expect(cv.summary).not.toMatch(/تشمل\s+المهارات/);
  });

  it('export rejects unsupported cooking/transport Summary; parity for grounded Arabic', () => {
    const cv = baseCv();
    const factSet = buildCvCanonicalFactSet(cv);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
    const good = buildConciseGroundedSummary(factSet, 'ar', 'female', duration, {
      includeSkills: false,
    });
    const grounded: CVData = {
      ...cv,
      summary: good,
      summaryOrigin: 'ai_generated',
      contentLocale: 'ar',
      experience: (cv.experience || []).map((e) => ({
        ...e,
        position: localizeOccupationalTitleForProjection(e.position || '', 'ar', 'female'),
      })),
      personal: {
        ...cv.personal,
        jobTitle: 'موظفة مستودع',
      },
    };
    const pdf = prepareExportReadyCv(grounded, 'ar', 'modern-minimal');
    const docx = prepareExportReadyCv(grounded, 'ar', 'modern-minimal');
    expect(pdf.ok).toBe(true);
    expect(docx.ok).toBe(true);
    if (pdf.ok && docx.ok) {
      expect(pdf.cv.summary).toBe(good);
      expect(docx.cv.summary).toBe(pdf.cv.summary);
      expect(pdf.cv.summary).not.toMatch(/مطبخ|أطباق|تحميل|توصيل/);
    }

    const staleCooking: CVData = {
      ...grounded,
      summary: 'موظفة مستودع تقوم بتحميل وتسليم البضائع وتحضير الأطباق وفق معايير المطعم والمطبخ.',
    };
    const bad = prepareExportReadyCv(staleCooking, 'ar', 'modern-minimal');
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.reason).toBe('summary_unsupported_domain_claims');
    }
  });

  it('50-run stability + reversed Experience order', () => {
    for (let i = 0; i < 50; i += 1) {
      const order = i % 2 === 0 ? 'normal' : 'reversed';
      const cv = baseCv(order);
      const factSet = buildCvCanonicalFactSet(cv);
      const duration = buildExperienceDurationSnapshot(cv.experience || [], '2026-07-20').total;
      const text = buildConciseGroundedSummary(factSet, 'ar', 'female', duration, {
        includeSkills: false,
      });
      expect(text, `run ${i}`).toMatch(/موظفة\s*مستودع/);
      expect(text, `run ${i}`).toMatch(/نحو\s+ست\s+سنوات\s+ونصف/);
      expect(text, `run ${i}`).toMatch(/سبق\s+لها\s+العمل/);
      const q = analyzeArabicSummaryEmploymentQuality(text, {
        company: 'Atlas',
        priorCompany: 'Rewitu',
        structuredRole: 'موظفة مستودع',
        currentEntryDuties: WH_AR,
        priorEntryDuties: DESIGN_AR_PAST,
        gender: 'female',
      });
      expect(q.groundingValidationPassed, `run ${i}`).toBe(true);
      expect(q.finalUnitRoleSlots, `run ${i}`).toEqual([
        'current_intro',
        'current_duty',
        'prior_role',
      ]);
    }
  });

  it('present-tense completed design is repaired to past (never leaves present applied)', () => {
    const cv = baseCv();
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: DESIGN_AR_PRESENT_BAD,
      experienceId: 'exp-design',
    });
    // Provider present tense must not remain — accept only past repair/fallback.
    expect(finalized.text || '').toMatch(/أعدّت|راجعت|كيّفت/);
    expect(finalized.text || '').not.toMatch(/تعدّ|تراجع(?!\s*وتكي)/);
    if (finalized.countedAsSuccess) {
      expect(finalized.origin).toBe('deterministic_fallback');
    }
  });
});
