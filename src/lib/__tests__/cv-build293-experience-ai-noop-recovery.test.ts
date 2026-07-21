/**
 * Build-293 Experience AI no-op recovery + stable entry targeting regressions.
 * Does not modify Croatian Summary intro grammar / duration-v2 behavior.
 */
import { describe, expect, it } from 'vitest';
import type { CVData } from '../types';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
} from '../cv-ai-finalize-apply';
import { formatExperienceBullets } from '../cv-canonical-facts';
import { hashExperienceEntryId } from '../cv-experience-entry-isolation';
import {
  EXPERIENCE_AI_NOOP_RECOVERY_REVISION,
  buildExperienceAiNoOpStylisticFallback,
  isRecoverableExperienceProviderNoOp,
} from '../cv-experience-ai-noop-recovery';
import { experienceAiHasMeaningfulChange } from '../cv-experience-perspective';
import { createExperienceAiOperationSnapshot } from '../cv-experience-ai-operation-snapshot';
import { ExperienceAiDiagnosticSession } from '../cv-experience-ai-diagnostics';
import {
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
} from '../cv-croatian-summary-grounding';

const HR_WH_EXACT = formatExperienceBullets([
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe.',
  'Surađuje s kolegicama i kolegama na koordinaciji pripreme i premještanja robe.',
]);

const HR_WH_REPAIRED = formatExperienceBullets([
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Ažurira skladišnu evidenciju te održava uredno i organizirano skladištenje robe.',
  'Surađuje s kolegama pri pripremi i premještanju robe u skladištu.',
]);

const HR_DESIGN_COMPLETED = formatExperienceBullets([
  'Izrađivala je vizualne materijale i grafičke elemente prema brend smjernicama.',
  'Pregledavala je i prilagođavala dizajne prema zahtjevima projekta.',
  'Pripremala je datoteke za tisak i zaslon.',
]);

function warehouseCv(overrides?: Partial<CVData>): CVData {
  return {
    personal: {
      fullName: 'Ana Anić',
      email: 'ana@example.com',
      phone: '',
      address: '',
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
        descriptionOrigin: 'user',
      },
      {
        id: 'exp-design',
        position: 'grafička dizajnerica',
        company: 'Rewitu',
        startDate: '2019-01',
        endDate: '2022-12',
        isPresent: false,
        description: HR_DESIGN_COMPLETED,
        originalUserDescription: HR_DESIGN_COMPLETED,
        canonicalDescription: HR_DESIGN_COMPLETED,
        descriptionOrigin: 'user',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    customSections: [],
    ...overrides,
  };
}

describe('cv-build293 Experience AI no-op recovery + entry targeting', () => {
  it('exposes no-op recovery revision without touching Summary grammar markers', () => {
    expect(EXPERIENCE_AI_NOOP_RECOVERY_REVISION).toBe('experience-ai-noop-recovery-293-v1');
    expect(CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION).toBe('croatian-summary-intro-grammar-292-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_HR_V2).toBe('croatian-duration-idempotent-v2');
  });

  it('A: current Croatian provider echo → repair → apply + meaningful present tense', () => {
    const cv = warehouseCv();
    const first = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hr',
      gender: 'female',
      cv,
      candidate: HR_WH_EXACT,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
    });
    expect(first.blocked).toBe(true);
    expect(first.diagnostics?.providerNoOpDetected).toBe(true);
    expect(first.diagnostics?.noOpRejected).toBe(true);
    expect(isRecoverableExperienceProviderNoOp(first)).toBe(true);
    expect(first.diagnostics?.clientDeterministicFallbackAttempted).toBeFalsy();

    expect(experienceAiHasMeaningfulChange(HR_WH_EXACT, HR_WH_REPAIRED)).toBe(true);

    const repaired = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_REPAIRED,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(repaired.blocked).toBe(false);
    expect(repaired.finalized.countedAsSuccess).toBe(true);
    expect(repaired.finalized.diagnostics?.noOpRepairApplied).toBe(true);
    expect(repaired.finalized.diagnostics?.finalCandidateSource).toBe('noop_repair');
    expect(repaired.finalized.text).toMatch(/Provjerava|Ažurira|Surađuje/);
    expect(repaired.finalized.text).not.toMatch(/Provjeravala je|Ažurirala je|Surađivala je/);
    expect(repaired.stateCv.experience.find((e) => e.id === 'exp-wh')?.description)
      .toBe(repaired.finalized.text);
    expect(repaired.stateCv.experience.find((e) => e.id === 'exp-design')?.description)
      .toBe(HR_DESIGN_COMPLETED);
  });

  it('B: repair also echoes → deterministic stylistic fallback applies once', () => {
    const cv = warehouseCv();
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_EXACT,
      experienceId: 'exp-wh',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    expect(recovered.blocked).toBe(false);
    expect(recovered.finalized.countedAsSuccess).toBe(true);
    expect(recovered.finalized.diagnostics?.providerNoOpDetected).toBe(true);
    expect(recovered.finalized.diagnostics?.deterministicFallbackAttemptedAfterNoOp).toBe(true);
    expect(recovered.finalized.diagnostics?.deterministicFallbackAppliedAfterNoOp).toBe(true);
    expect(recovered.finalized.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(experienceAiHasMeaningfulChange(HR_WH_EXACT, recovered.finalized.text)).toBe(true);
    expect(recovered.finalized.text).toMatch(/Provjerava|Ažurira|Surađuje|preglednom rasporedu|kolegama/);
    expect(recovered.finalized.text).toContain('urednom i preglednom rasporedu');
    expect(recovered.finalized.text).not.toMatch(/pregledom rasporedu|urednom i pregledom/i);
    // Single apply path — usage counted once by client when countedAsSuccess.
    expect(recovered.finalized.countedAsSuccess).toBe(true);
  });

  it('C: failed recovery leaves textarea untouched', () => {
    const cv = warehouseCv();
    // Empty candidate after repair flag with no usable source → still fail closed.
    const emptySourceCv: CVData = {
      ...cv,
      experience: cv.experience.map((e) =>
        e.id === 'exp-wh'
          ? {
            ...e,
            description: 'x',
            originalUserDescription: 'x',
            canonicalDescription: 'x',
          }
          : e),
    };
    const failed = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hr',
      gender: 'female',
      cv: emptySourceCv,
      candidate: 'x',
      experienceId: 'exp-wh',
      noOpRepairAttempted: true,
      industry: 'logistics',
      level: 'mid',
    });
    expect(failed.countedAsSuccess).toBe(false);
    const applied = applyFinalizedBulletsToCv(emptySourceCv, 'hr', 'exp-wh', failed);
    expect(applied.experience.find((e) => e.id === 'exp-wh')?.description).toBe('x');
    expect(failed.diagnostics?.finalCandidateSource === 'none'
      || failed.blocked).toBe(true);
  });

  it('D: AI on previous/completed entry targets only that entry + past tense', () => {
    const cv = warehouseCv();
    const whHash = hashExperienceEntryId('exp-wh');
    const designHash = hashExperienceEntryId('exp-design');
    expect(whHash).not.toBe(designHash);

    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'hr',
      requestedLocale: 'hr',
      contentLocale: 'hr',
      templateId: '',
      gender: 'female',
      industryNorm: 'general',
      levelNorm: 'mid',
      jobContextHash: 'ctx-design',
      requestId: 'req-design-2',
      usageCountBefore: 0,
    });
    const designExp = cv.experience.find((e) => e.id === 'exp-design')!;
    session.recordLiveExperience(designExp, false);
    session.recordExperienceEntryTarget({
      experienceEntryId: 'exp-design',
      isPresent: false,
      arrayIndexAtRequest: 1,
    });

    const pipe = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_DESIGN_COMPLETED,
      experienceId: 'exp-design',
      industry: 'design',
      level: 'mid',
    });
    // Exact echo of completed design may no-op; recover with repair flag + past shells.
    const recovered = pipe.blocked
      ? runCvAiApplyPipeline({
        cv,
        locale: 'hr',
        action: 'experience_bullets',
        candidate: HR_DESIGN_COMPLETED,
        experienceId: 'exp-design',
        industry: 'design',
        level: 'mid',
        noOpRepairAttempted: true,
      })
      : pipe;

    expect(recovered.finalized.diagnostics?.selectedExperienceEntryIdHash).toBe(designHash);
    expect(recovered.finalized.diagnostics?.providerTargetEntryIdHash).toBe(designHash);
    expect(recovered.finalized.diagnostics?.selectedExperienceEntryIdHash).not.toBe(whHash);

    const designOut = recovered.stateCv.experience.find((e) => e.id === 'exp-design')!;
    const warehouseOut = recovered.stateCv.experience.find((e) => e.id === 'exp-wh')!;
    expect(warehouseOut.description).toBe(HR_WH_EXACT);

    if (recovered.blocked) {
      // If design echo cannot recover (families already polished), at least targeting is correct.
      expect(session.commit().clickedExperienceEntryIdHash).toBe(designHash);
      expect(session.commit().payloadEmploymentState).toBe('completed');
    } else {
      expect(designOut.description).not.toBe(HR_WH_EXACT);
      expect(designOut.description).toMatch(/la je|ao je|Izrađivala|Pregledavala|Pripremala/i);
      expect(designOut.description).not.toMatch(/\bProvjerava\b|\bAžurira\b|\bSurađuje\b/);
    }

    const diag = session.commit();
    expect(diag.clickedExperienceEntryIdHash).toBe(designHash);
    expect(diag.payloadExperienceEntryIdHash).toBe(designHash);
    expect(diag.clickedEmploymentState).toBe('completed');
    expect(diag.payloadEmploymentState).toBe('completed');
  });

  it('E: reorder race — stable entry ID still applies to original clicked entry', () => {
    const cv = warehouseCv();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: HR_DESIGN_COMPLETED,
      canonicalText: HR_DESIGN_COMPLETED,
      originalText: HR_DESIGN_COMPLETED,
      locale: 'hr',
      requestId: 'req-reorder',
      jobContextHash: 'ctx-design',
      experienceEntryId: 'exp-design',
    });
    const repairedDesign = formatExperienceBullets([
      'Izrađivala je vizualne materijale te grafičke elemente prema brend smjernicama.',
      'Pregledavala je i prilagođavala dizajne prema zahtjevima projekta.',
      'Pripremala je datoteke za tisak i zaslon u sklopu redovitih radnih zadataka.',
    ]);
    const finalized = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hr',
      gender: 'female',
      cv,
      candidate: repairedDesign,
      experienceId: 'exp-design',
      operationSnapshot: snapshot,
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
      industry: 'design',
      level: 'mid',
    });
    expect(finalized.countedAsSuccess).toBe(true);

    // Reorder before apply: design moves to index 0.
    const reordered: CVData = {
      ...cv,
      experience: [cv.experience[1], cv.experience[0]],
    };
    expect(reordered.experience[0].id).toBe('exp-design');
    const next = applyFinalizedBulletsToCv(reordered, 'hr', 'exp-design', finalized);
    expect(next.experience.find((e) => e.id === 'exp-design')?.description)
      .toBe(finalized.text);
    expect(next.experience.find((e) => e.id === 'exp-wh')?.description)
      .toBe(HR_WH_EXACT);
  });

  it('F: stylistic fallback preserves duties and rejects punctuation-only change', () => {
    const stylistic = buildExperienceAiNoOpStylisticFallback({
      sourceDescription: HR_WH_EXACT,
      locale: 'hr',
      isPresent: true,
      gender: 'female',
    });
    expect(stylistic.trim()).toBeTruthy();
    expect(experienceAiHasMeaningfulChange(HR_WH_EXACT, stylistic)).toBe(true);
    expect(stylistic).toMatch(/zaprimljen|skladiš|premješt|robe/i);

    const punctOnly = formatExperienceBullets([
      'Provjerava točnost zaprimljene robe i prateće dokumentacije!',
      'Ažurira skladišne evidencije i održava urednu raspoređenost uskladištene robe!',
      'Surađuje s kolegicama i kolegama na koordinaciji pripreme i premještanja robe!',
    ]);
    expect(experienceAiHasMeaningfulChange(HR_WH_EXACT, punctOnly)).toBe(false);
  });

  it('completed Croatian warehouse uses past CV perspective after no-op recovery', () => {
    const cv = warehouseCv({
      experience: [
        {
          id: 'exp-wh-past',
          position: 'Radnica u skladištu',
          company: 'Atlas',
          startDate: '2020-01',
          endDate: '2022-12',
          isPresent: false,
          description: HR_WH_EXACT,
          originalUserDescription: HR_WH_EXACT,
          canonicalDescription: HR_WH_EXACT,
          descriptionOrigin: 'user',
        },
      ],
    });
    const recovered = runCvAiApplyPipeline({
      cv,
      locale: 'hr',
      action: 'experience_bullets',
      candidate: HR_WH_EXACT,
      experienceId: 'exp-wh-past',
      industry: 'logistics',
      level: 'mid',
      noOpRepairAttempted: true,
    });
    expect(recovered.blocked).toBe(false);
    expect(recovered.finalized.text).toMatch(/Provjeravala je|Ažurirala je|ažurirala|Surađivala je|skrbila/);
    expect(recovered.finalized.text).toContain('urednom i preglednom rasporedu');
    expect(recovered.finalized.text).not.toMatch(/pregledom rasporedu|urednom i pregledom/i);
    expect(recovered.finalized.text).not.toMatch(/^• Provjerava /m);
  });
});
