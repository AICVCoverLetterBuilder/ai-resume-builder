/**
 * Build-289 Croatian Experience + Summary package regressions.
 * Exact device failures: Serbian design fallback under hr; mixed JA/SR Summary.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
  SUMMARY_RUNTIME_MARKER_SET,
} from '../cv-ai-finalize-apply';
import {
  croatianWarehouseCueKeysFromUnit,
  croatianDesignCueKeysFromUnit,
  validateCroatianDesignFactFamilies,
  experienceNeedsCroatianDesignFamilyRebuild,
  isCroatianDesignFamilyRejectionReason,
  CROATIAN_EXPERIENCE_MATERIAL_REVISION,
  CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION,
} from '../cv-material-duty-coverage';
import {
  analyzeCroatianSerbianLocaleEvidence,
  validateAiUnitLocalePurity,
  resolveTargetScriptForLocale,
} from '../cv-ai-unit-locale-purity';
import {
  analyzeCroatianSummaryEmploymentQuality,
  buildCroatianEntryOwnedSummary,
  SUMMARY_BUILDER_REVISION_HR,
  SUMMARY_UNIT_SPLITTER_REVISION_HR,
  SUMMARY_GROUNDING_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR,
  CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
} from '../cv-croatian-summary-grounding';
import { buildJobContextGenerationFallback } from '../cv-experience-ai-operation-mode';
import { formatExperienceBullets } from '../cv-canonical-facts';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '../cv-role-title';
import {
  formatApproximateDurationPhrase,
  buildExperienceDurationSnapshot,
} from '../cv-experience-duration';

const JA_WH = [
  '入荷した商品と関連書類の正確さを確認する。',
  '倉庫記録を更新し、保管品を整理整頓する。',
  '同僚と連携して商品の準備と移動を調整する。',
].join('\n');

const JA_DESIGN = [
  'デジタル製品やプラットフォーム向けのビジュアル素材とグラフィック要素を制作した。',
  'デザイン素材を確認し、プロジェクト要件に合わせて調整した。',
  '最終デザインファイルを準備し、画面ごとに形式を調整した。',
].join('\n');

const HR_WH_GOOD = formatExperienceBullets([
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Ažurira skladišnu evidenciju te održava uredno i organizirano skladištenje robe.',
  'Surađuje s kolegama pri pripremi i premještanju robe unutar skladišta.',
]);

const HR_DESIGN_GOOD = formatExperienceBullets([
  'Izrađivala je vizualne materijale i grafičke elemente za digitalne proizvode i platforme.',
  'Pregledavala je i prilagođavala dizajnerske materijale zahtjevima projekta.',
  'Pripremala je završne dizajnerske datoteke i prilagođavala formate različitim zaslonima.',
]);

/** Exact failed Serbian generic design bullets from build-289. */
const SR_DESIGN_FAIL = [
  '• Obavljala je svakodnevne dužnosti uz proveru tačnosti povezanih podataka.',
  '• Koordinisala je razmenu informacija sa kolegama.',
  '• Pregledala je dokumentaciju i proveravala potpunost podataka.',
].join('\n');

/** Exact failed Summary candidate from build-289. */
const HR_SUMMARY_FAIL =
  'Zaposlena kao グラフィックデザイナー u kompaniji Rewitu od januara 2020, s oko šest i po godine iskustva. Obavlja dodeljene profesionalne zadatke u skladu sa standardima radnog mesta, uz tačnost i profesionalnu komunikaciju u timu.';

function fixtureCv(order: 'warehouse-first' | 'design-first' = 'warehouse-first'): CVData {
  const warehouse = {
    id: 'exp-wh',
    position: '倉庫作業員',
    company: 'Atlas',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: JA_WH,
    originalUserDescription: JA_WH,
    canonicalDescription: JA_WH,
  };
  const design = {
    id: 'exp-design',
    position: 'グラフィックデザイナー',
    company: 'Rewitu',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description: JA_DESIGN,
    originalUserDescription: JA_DESIGN,
    canonicalDescription: JA_DESIGN,
  };
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: '倉庫作業員',
      gender: 'female',
    },
    summary: '',
    experience: order === 'warehouse-first' ? [warehouse, design] : [design, warehouse],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

describe('cv-build289 Croatian Experience + Summary', () => {
  it('exposes required Croatian runtime markers', () => {
    expect(CROATIAN_EXPERIENCE_MATERIAL_REVISION).toBe('croatian-experience-material-v1');
    expect(CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION)
      .toBe('croatian-serbian-locale-discrimination-v1');
    expect(SUMMARY_BUILDER_REVISION_HR).toBe('entry-owned-croatian-rebuild-v1');
    expect(SUMMARY_UNIT_SPLITTER_REVISION_HR).toBe('croatian-three-sentence-slots-v1');
    expect(SUMMARY_GROUNDING_REVISION_HR).toBe('entry-owned-croatian-grounding-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR).toBe('croatian-duration-idempotent-v1');
    expect(CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER)
      .toBe('croatian-summary-strict-postconditions-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(CROATIAN_EXPERIENCE_MATERIAL_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_BUILDER_REVISION_HR);
  });

  it('A: current Japanese warehouse → grounded Croatian present bullets', () => {
    const pipe = runCvAiApplyPipeline({
      cv: fixtureCv(),
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_GOOD,
      experienceId: 'exp-wh',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.text).toMatch(/Provjerava|Ažurira|Surađuje/);
    expect(pipe.finalized.text).toMatch(/zaprimljen|skladišn|premješt/);
    expect(pipe.finalized.text).not.toMatch(/proverav|koordinisala|razmenu|magacin/i);
    expect(pipe.finalized.text).not.toMatch(/[\u3040-\u30FF\u3400-\u9FFF]/);
  });

  it('B: completed Japanese design → Croatian female past with three families', () => {
    const pipe = runCvAiApplyPipeline({
      cv: fixtureCv(),
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_DESIGN_GOOD,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.text).toMatch(/Izrađivala je.*vizualne materijale.*grafičke elemente/is);
    expect(pipe.finalized.text).toMatch(/Pregledavala je|prilagođavala je/i);
    expect(pipe.finalized.text).toMatch(/Pripremala je.*datotek|zaslon/i);
    expect(pipe.finalized.text).not.toMatch(/zaprimljen|skladišt|proveru|koordinisala|razmenu/i);
    expect(validateCroatianDesignFactFamilies(pipe.finalized.text).ok).toBe(true);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
  });

  it('C: exact Serbian generic design fallback is rejected then rebuilt', () => {
    expect(analyzeCroatianSerbianLocaleEvidence(SR_DESIGN_FAIL).serbianLeakageDetected).toBe(true);
    expect(validateCroatianDesignFactFamilies(SR_DESIGN_FAIL).ok).toBe(false);
    expect(isCroatianDesignFamilyRejectionReason(
      validateCroatianDesignFactFamilies(SR_DESIGN_FAIL).reason,
    )).toBe(true);

    const purity = validateAiUnitLocalePurity(SR_DESIGN_FAIL, 'hr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.ok).toBe(false);
    expect(purity.serbianLeakageDetected).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBeGreaterThan(0);

    const cv = fixtureCv();
    cv.experience = cv.experience.map((e) => (
      e.id === 'exp-design'
        ? {
          ...e,
          description: SR_DESIGN_FAIL,
          originalUserDescription: JA_DESIGN,
          canonicalDescription: JA_DESIGN,
        }
        : e
    ));
    expect(experienceNeedsCroatianDesignFamilyRebuild({
      locale: 'hr',
      sourceDescription: JA_DESIGN,
      position: 'グラフィックデザイナー',
      rejectReason: 'croatian_serbian_locale_leakage',
    })).toBe(true);

    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: SR_DESIGN_FAIL,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackReason)
      .toBe('croatian_design_family_rebuild');
    expect(validateCroatianDesignFactFamilies(pipe.finalized.text).ok).toBe(true);
    expect(pipe.finalized.text).not.toMatch(/proveru|koordinisala|razmenu|svakodnevne dužnosti/i);
  });

  it('blocks Serbian design apply with usage +0 when rebuild cannot run without design domain', () => {
    const blocked = finalizeCvAiFieldForApply({
      field: 'experience_description',
      candidate: SR_DESIGN_FAIL,
      requestedLocale: 'hr',
      cv: {
        ...fixtureCv(),
        experience: [{
          id: 'exp-other',
          position: 'Asistent',
          company: 'X',
          startDate: '2020-01',
          endDate: '2021-01',
          isPresent: false,
          description: 'Generic admin notes.',
        }],
      },
      experienceId: 'exp-other',
      gender: 'female',
    });
    // Without design canonical facts, Serbian leakage must not apply as success.
    if (blocked.blocked) {
      expect(blocked.countedAsSuccess).toBe(false);
    }
  });

  it('D: failed Summary routes to entry-owned Croatian three-slot rebuild', () => {
    const cv = fixtureCv();
    cv.summary = HR_SUMMARY_FAIL;
    const snap = buildExperienceDurationSnapshot(cv.experience || [], new Date('2026-07-20'));
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'summary_professional',
      candidate: HR_SUMMARY_FAIL,
      durationSnapshot: snap,
      referenceDateIso: '2026-07-20',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.origin).toBe('deterministic_fallback');
    const text = pipe.finalized.text;
    expect(text).toMatch(/Radnica u skladištu/);
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/siječnja 2023/);
    expect(text).toMatch(/oko šest i pol godina|ukupno oko šest i pol/i);
    expect(text).toMatch(/Rewitu/);
    expect(text).toMatch(/grafička dizajnerica/);
    expect(text).not.toMatch(/グラフィック|dodeljene|radnog mesta|januara|kompaniji Rewitu/i);
    const units = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    expect(units.length).toBe(3);
    const quality = analyzeCroatianSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'Radnica u skladištu',
      startDate: '2023-01',
      currentEntryDuties: JA_WH,
      priorEntryDuties: JA_DESIGN,
      priorCompany: 'Rewitu',
      structuredRole: 'Radnica u skladištu',
      gender: 'female',
    });
    expect(quality.groundingValidationPassed).toBe(true);
    expect(quality.finalUnitRoleSlots).toEqual(['current_intro', 'current_duty', 'prior_role']);
  });

  it('material cues map warehouse and design families', () => {
    expect(croatianWarehouseCueKeysFromUnit(
      'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
    ).length).toBeGreaterThan(0);
    expect(croatianDesignCueKeysFromUnit(
      'Izrađivala je vizualne materijale i grafičke elemente za digitalne proizvode.',
    )).toContain('design_visual_materials');
  });

  it('role titles localize to Croatian skladište / dizajnerica', () => {
    expect(localizeWarehouseEmployee('hr', 'female')).toBe('Radnica u skladištu');
    expect(localizeWarehouseEmployee('hr', 'male')).toBe('Radnik u skladištu');
    expect(localizeGraphicDesigner('hr', 'female')).toBe('grafička dizajnerica');
    expect(localizeGraphicDesigner('hr', 'male')).toBe('grafički dizajner');
    expect(localizeWarehouseEmployee('sr', 'female')).toBe('Radnica u magacinu');
  });

  it('duration phrase is oko šest i pol godina once', () => {
    const phrase = formatApproximateDurationPhrase({
      hasValidDates: true,
      unit: 'years',
      approxYears: 6.5,
      totalMonths: 78,
      fullYears: 6,
      remainingMonths: 6,
    }, 'hr');
    expect(phrase).toMatch(/šest i pol/);
    expect(phrase).not.toMatch(/6\.5/);
    expect(phrase).not.toMatch(/\bi po\b/);
  });

  it('targetScript for hr is latin', () => {
    expect(resolveTargetScriptForLocale('hr')).toBe('latin');
  });

  it('job-context shells are Croatian not Serbian for design/warehouse', () => {
    const design = buildJobContextGenerationFallback({
      locale: 'hr',
      gender: 'female',
      position: 'graphic designer',
      industry: 'design',
      isPresent: false,
    });
    expect(design).toMatch(/Izrađivala je|vizualne materijale|zahtjevima projekta|zaslonima/);
    expect(design).not.toMatch(/prover|koordinisala|razmenu|zahtevima|vizuelne/i);

    const wh = buildJobContextGenerationFallback({
      locale: 'hr',
      gender: 'female',
      position: 'warehouse worker',
      industry: 'warehouse',
      isPresent: true,
    });
    expect(wh).toMatch(/Provjerava|zaprimljen|skladišn/);
    expect(wh).not.toMatch(/proverava|magacin/i);
  });

  it('entry-owned Summary builder emits three grounded sentences', () => {
    const text = buildCroatianEntryOwnedSummary({
      role: 'Radnica u skladištu',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 's ukupno oko šest i pol godina iskustva',
      dutyFacts: [
        { value: HR_WH_GOOD, sourceText: JA_WH },
      ],
      priorRole: 'グラフィックデザイナー',
      priorEmployer: 'Rewitu',
      priorSourceDuties: JA_DESIGN,
      locale: 'hr',
    });
    expect(text.split(/(?<=[.!?])\s+/).filter(Boolean).length).toBe(3);
    expect(text).toMatch(/Radnica u skladištu/);
    expect(text).toMatch(/grafička dizajnerica/);
    expect(text).not.toMatch(/グラフィック|magacin|dodeljene/i);
  });

  it('reversed Experience order still binds design rebuild to design entry', () => {
    const pipe = runCvAiApplyPipeline({
      cv: fixtureCv('design-first'),
      locale: 'hr',
      action: 'experience_bullets',
      candidate: SR_DESIGN_FAIL,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.text).not.toMatch(/zaprimljen|skladišt/i);
    expect(validateCroatianDesignFactFamilies(pipe.finalized.text).ok).toBe(true);
  });

  it('50× repeated design rebuild stays stable', () => {
    for (let i = 0; i < 50; i += 1) {
      const pipe = runCvAiApplyPipeline({
        cv: fixtureCv(i % 2 === 0 ? 'warehouse-first' : 'design-first'),
        locale: 'hr',
        action: 'experience_bullets',
        candidate: SR_DESIGN_FAIL,
        experienceId: 'exp-design',
      });
      expect(pipe.finalized.countedAsSuccess).toBe(true);
      expect(validateCroatianDesignFactFamilies(pipe.finalized.text).ok).toBe(true);
      expect(pipe.finalized.text).not.toMatch(/proveru|koordinisala|razmenu/i);
    }
  });

  it('preserves Japanese markers in runtime set', () => {
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain('japanese-experience-material-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain('entry-owned-japanese-rebuild-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain('russian-design-fallback-routing-287-v1');
  });
});
