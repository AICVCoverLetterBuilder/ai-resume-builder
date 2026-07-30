/**
 * Build-290 Croatian real-device regressions:
 * - warehouse no-op must not count as success / usage
 * - poisoned Serbian design live source → croatian_design_family_rebuild
 * - Summary recovers design prior + three slots + duration once
 * - missing canonical design facts fail closed
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
  runCvAiApplyPipeline,
  SUMMARY_RUNTIME_MARKER_SET,
} from '../cv-ai-finalize-apply';
import { detectTextLocale } from '../cv-content-locale';
import {
  analyzeCroatianSerbianLocaleEvidence,
  guessUnitLocale,
  validateAiUnitLocalePurity,
} from '../cv-ai-unit-locale-purity';
import {
  classifyMaterialDutyKeys,
  classifyMaterialDutyKeysForRole,
  experienceNeedsCroatianDesignFamilyRebuild,
  isCroatianDesignPoisonedLiveSource,
  CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION,
  CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION,
  CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION,
} from '../cv-material-duty-coverage';
import {
  buildCroatianEntryOwnedSummary,
  injectCroatianDurationIntoCurrentIntro,
  SUMMARY_DURATION_FINALIZER_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
  CROATIAN_NOOP_USAGE_REVISION,
  CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION,
} from '../cv-croatian-summary-grounding';
import { formatExperienceBullets } from '../cv-canonical-facts';
import {
  formatApproximateDurationPhrase,
  buildExperienceDurationSnapshot,
} from '../cv-experience-duration';
import {
  countSummaryDurationExpressions,
  verifyIndependentFinalDurationCount,
} from '../cv-summary-duration-ownership';
import { classifyFreeTextJobDomain } from '../cv-ai-operation-contract';

const HR_WH_EXACT = formatExperienceBullets([
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe.',
  'Surađuje s kolegicama i kolegama na koordinaciji pripreme i premještanja robe.',
]);

const SR_DESIGN_POISONED = [
  '• Obavljala je svakodnevne dužnosti uz proveru tačnosti povezanih podataka.',
  '• Koordinisala je razmenu informacija sa kolegama.',
  '• Pregledala je dokumentaciju i proveravala potpunost podataka.',
].join('\n');

const JA_DESIGN_CANONICAL = [
  'デジタル製品やプラットフォーム向けのビジュアル素材とグラフィック要素を制作した。',
  'デザイン素材を確認し、プロジェクト要件に合わせて調整した。',
  '最終デザインファイルを準備し、画面ごとに形式を調整した。',
].join('\n');

function fixture(options?: {
  priorLive?: string;
  priorCanonical?: string;
  priorPosition?: string;
}): CVData {
  const priorLive = options?.priorLive ?? SR_DESIGN_POISONED;
  const priorCanonical = options?.priorCanonical ?? JA_DESIGN_CANONICAL;
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
        description: HR_WH_EXACT,
        originalUserDescription: HR_WH_EXACT,
        canonicalDescription: HR_WH_EXACT,
      },
      {
        id: 'exp-design',
        position: options?.priorPosition ?? 'グラフィックデザイナー',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: priorLive,
        originalUserDescription: priorCanonical,
        canonicalDescription: priorCanonical,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
  };
}

describe('cv-build290 Croatian no-op / poisoned design / Summary recovery', () => {
  it('exposes build-291 Croatian runtime markers', () => {
    expect(CROATIAN_NOOP_USAGE_REVISION).toBe('croatian-noop-usage-291-v1');
    expect(CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION)
      .toBe('croatian-design-poisoned-source-recovery-291-v1');
    expect(CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION)
      .toBe('croatian-design-fallback-routing-291-v1');
    expect(CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION)
      .toBe('croatian-role-aware-material-classifier-291-v1');
    expect(CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION)
      .toBe('croatian-summary-canonical-recovery-291-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR).toBe('croatian-duration-idempotent-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2).toBe('croatian-duration-idempotent-v2');
    expect(SUMMARY_RUNTIME_MARKER_SET).toEqual(expect.arrayContaining([
      CROATIAN_NOOP_USAGE_REVISION,
      CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION,
      CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION,
      CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION,
      CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION,
      SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
    ]));
  });

  it('A: exact warehouse no-op → +0 usage / no visible apply', () => {
    expect(detectTextLocale(HR_WH_EXACT)).toBe('hr');
    expect(guessUnitLocale(HR_WH_EXACT, 'hr')).toBe('hr');
    const evidence = analyzeCroatianSerbianLocaleEvidence(HR_WH_EXACT);
    expect(evidence.croatianLocaleEvidencePassed).toBe(true);
    expect(evidence.serbianLeakageDetected).toBe(false);
    expect(evidence.croatianExclusiveCueCount).toBeGreaterThan(0);

    const pipe = runCvAiApplyPipeline({
      cv: fixture(),
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_EXACT,
      experienceId: 'exp-wh',
    });
    expect(pipe.finalized.blocked).toBe(true);
    expect(pipe.finalized.countedAsSuccess).toBe(false);
    expect(pipe.finalized.diagnostics?.meaningfulChangeDetected).toBe(false);
    expect(pipe.finalized.diagnostics?.noOpRejected).toBe(true);
    expect(pipe.finalized.reason).toMatch(/experience_ai_noop|ai_no_meaningful_change|ai_noop/);
    expect(pipe.finalized.text).toBe(HR_WH_EXACT);
  });

  it('B: poisoned Serbian design → croatian_design_family_rebuild +1', () => {
    expect(isCroatianDesignPoisonedLiveSource(
      SR_DESIGN_POISONED,
      'グラフィックデザイナー',
    )).toBe(true);
    expect(classifyFreeTextJobDomain('グラフィックデザイナー')).toBe('design');
    expect(experienceNeedsCroatianDesignFamilyRebuild({
      locale: 'hr',
      sourceDescription: SR_DESIGN_POISONED,
      position: 'グラフィックデザイナー',
      rejectReason: 'wrong_language',
    })).toBe(true);

    const pipe = runCvAiApplyPipeline({
      cv: fixture(),
      locale: 'hr',
      action: 'experience_bullets',
      candidate: SR_DESIGN_POISONED,
      experienceId: 'exp-design',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackReason)
      .toBe('croatian_design_family_rebuild');
    expect(pipe.finalized.diagnostics?.clientDeterministicFallbackApplied).toBe(true);
    expect(pipe.finalized.diagnostics?.selectedSourceActuallyRejected).toBe(true);
    expect(pipe.finalized.diagnostics?.rejectedSourceReason)
      .toBe('croatian_design_poisoned_live_source');
    expect(pipe.finalized.text).toMatch(/Izrađivala je.*vizualne materijale.*grafičke elemente/is);
    expect(pipe.finalized.text).toMatch(/Pregledavala je|prilagođavala/i);
    expect(pipe.finalized.text).toMatch(/Pripremala je.*datotek|zaslon/i);
    expect(pipe.finalized.text).not.toMatch(/proveru|koordinisala|razmenu|svakodnevne dužnosti/i);
    expect(pipe.finalized.text).not.toMatch(/zaprimljen|skladišt/i);
    const purity = validateAiUnitLocalePurity(pipe.finalized.text, 'hr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.ok).toBe(true);
    expect(purity.detectedLocaleByUnit).toEqual(['hr', 'hr', 'hr']);
    expect(purity.serbianLeakageDetected).toBe(false);
  });

  it('C: Summary with poisoned prior + canonical design → 3 slots + duration once', () => {
    const cv = fixture();
    const snap = buildExperienceDurationSnapshot(cv.experience || [], new Date('2026-07-20'));
    expect(snap.total.totalMonths).toBe(78);
    const phrase = formatApproximateDurationPhrase(snap.total, 'hr');
    expect(phrase).toMatch(/oko šest i pol godina/);
    expect(phrase).toBeTruthy();

    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'summary_professional',
      candidate: 'bad provider',
      durationSnapshot: snap,
      referenceDateIso: '2026-07-20',
    });
    expect(pipe.finalized.blocked).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(true);
    const text = pipe.finalized.text;
    if (!summaryV2ModeActive()) {
      expect(text).toMatch(/Radnica u skladištu/);
      expect(text).toMatch(/u tvrtki Atlas/);
      expect(text).not.toMatch(/(?:zaposlena|zaposlen|radi)\s+u\s+Atlas\b/i);
      expect(text).toMatch(/siječnja 2023/);
      expect(text).toMatch(/oko šest i pol godina iskustva/);
      expect(text).toMatch(/Rewitu/);
      expect(text).toMatch(/grafička dizajnerica/);
      expect(text).not.toMatch(/proveru|koordinisala|razmenu|warehouse_inbound/i);
      const units = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(units.length).toBe(3);
      expect(pipe.finalized.diagnostics?.finalUnitRoleSlots)
        .toEqual(['current_intro', 'current_duty', 'prior_role']);
      expect(pipe.finalized.diagnostics?.summaryDurationFinalizerRevision)
        .toBe('croatian-duration-idempotent-v2');
      expect(pipe.finalized.diagnostics?.grammarValidationPassed).toBe(true);
      expect(pipe.finalized.diagnostics?.priorEntryMaterialKeys)
        .toEqual(expect.arrayContaining([
          'design_visual_materials',
          'design_review_adapt',
          'design_files_formats',
        ]));
      expect(pipe.finalized.diagnostics?.priorEntryMaterialKeys)
        .not.toContain('warehouse_inbound_check');
    } else {
      expectSummaryContractInvariants({
        text,
        locale: 'hr',
        cv,
        requirePrior: true,
      });
      expect(text).toMatch(/Atlas|Rewitu|godina/i);
    }
    expect(countSummaryDurationExpressions(text, 'hr')).toBe(1);
    expect(verifyIndependentFinalDurationCount(text, 'hr', { requireExactlyOne: true }).ok)
      .toBe(true);

    const pass1 = injectCroatianDurationIntoCurrentIntro(text, snap.total);
    const pass2 = injectCroatianDurationIntoCurrentIntro(pass1, snap.total);
    expect(pass1).toBe(pass2);
  });

  it('D: poisoned prior without canonical design facts → fail closed +0', () => {
    const cv = fixture({
      priorLive: SR_DESIGN_POISONED,
      priorCanonical: '',
      priorPosition: 'Asistent',
    });
    cv.experience = cv.experience.map((e) => (
      e.id === 'exp-design'
        ? {
          ...e,
          position: 'Asistent',
          description: SR_DESIGN_POISONED,
          originalUserDescription: '',
          canonicalDescription: '',
        }
        : e
    ));
    const snap = buildExperienceDurationSnapshot(cv.experience || [], new Date('2026-07-20'));
    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'summary_professional',
      candidate: 'bad',
      durationSnapshot: snap,
      referenceDateIso: '2026-07-20',
    });
    // Must not invent design/warehouse prior from poisoned Serbian admin prose.
    if (pipe.finalized.countedAsSuccess) {
      expect(pipe.finalized.text).not.toMatch(/grafička dizajnerica|vizualne materijale/i);
      if (!summaryV2ModeActive()) {
        expect(pipe.finalized.text).not.toMatch(/proveru tačnosti|koordinisala|razmenu/i);
      }
    } else {
      expect(pipe.finalized.countedAsSuccess).toBe(false);
      expect(pipe.finalized.blocked).toBe(true);
    }
  });

  it('role-aware material: design poisoned text is not warehouse_inbound_check', () => {
    expect(classifyMaterialDutyKeys(SR_DESIGN_POISONED))
      .not.toContain('warehouse_inbound_check');
    expect(classifyMaterialDutyKeysForRole(
      SR_DESIGN_POISONED,
      'グラフィックデザイナー',
    ).some((k) => k.startsWith('warehouse_'))).toBe(false);
    expect(classifyMaterialDutyKeys(
      'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
    )).toContain('warehouse_inbound_check');
  });

  it('source-locale classification: Croatian warehouse is hr not sr', () => {
    expect(detectTextLocale(HR_WH_EXACT, { storedLocale: 'hr' })).toBe('hr');
    expect(detectTextLocale(SR_DESIGN_POISONED)).toBe('sr');
  });

  it('50× reorder stability for no-op + design rebuild + summary', () => {
    for (let i = 0; i < 50; i += 1) {
      const order = i % 2 === 0 ? 'warehouse-first' : 'design-first';
      const cv = fixture();
      if (order === 'design-first') {
        cv.experience = [cv.experience[1]!, cv.experience[0]!];
      }
      const noop = finalizeCvAiFieldForApply({
        field: 'experience_description',
        candidate: HR_WH_EXACT,
        requestedLocale: 'hr',
        cv,
        experienceId: 'exp-wh',
        gender: 'female',
      });
      expect(noop.countedAsSuccess).toBe(false);
      expect(noop.diagnostics?.noOpRejected).toBe(true);

      const design = finalizeCvAiFieldForApply({
        field: 'experience_description',
        candidate: SR_DESIGN_POISONED,
        requestedLocale: 'hr',
        cv,
        experienceId: 'exp-design',
        gender: 'female',
      });
      expect(design.countedAsSuccess).toBe(true);
      expect(design.diagnostics?.clientDeterministicFallbackReason)
        .toBe('croatian_design_family_rebuild');

      const snap = buildExperienceDurationSnapshot(cv.experience || [], new Date('2026-07-20'));
      const summary = runCvAiApplyPipeline({
        cv,
        locale: 'hr',
        action: 'summary_professional',
        candidate: 'x',
        durationSnapshot: snap,
        referenceDateIso: '2026-07-20',
      });
      expect(summary.finalized.countedAsSuccess).toBe(true);
      expect(summary.finalized.text.split(/(?<=[.!?])\s+/).filter(Boolean).length).toBe(3);
    }
  });

  it('entry-owned builder recovers design prior from Japanese title alone', () => {
    const text = buildCroatianEntryOwnedSummary({
      role: 'Radnica u skladištu',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 's ukupno oko šest i pol godina',
      dutyFacts: [
        { sourceText: 'Provjerava točnost zaprimljene robe i prateće dokumentacije.', value: 'a' },
        { sourceText: 'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe.', value: 'b' },
        { sourceText: 'Surađuje s kolegicama i kolegama na koordinaciji pripreme i premještanja robe.', value: 'c' },
      ],
      priorRole: 'グラフィックデザイナー',
      priorEmployer: 'Rewitu',
      priorSourceDuties: SR_DESIGN_POISONED,
      locale: 'hr',
    });
    expect(text.split(/(?<=[.!?])\s+/).filter(Boolean).length).toBe(3);
    expect(text).toMatch(/Radnica u skladištu/);
    expect(text).toMatch(/grafička dizajnerica/);
  });
});
