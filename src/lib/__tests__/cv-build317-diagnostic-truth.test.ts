/**
 * AAB-317 Phase 2 — unedited-rerun diagnostic truth.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  SUMMARY_RUNTIME_MARKER_SET,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData, WorkExperience } from '@/lib/types';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceAiOutputProvenance,
} from '@/lib/cv-experience-ai-output-provenance';
import {
  EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION,
  EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION,
  EXPERIENCE_NOOP_DEGRADATION_ORDER_317_REVISION,
  EXPERIENCE_UNEDITED_RERUN_DIAGNOSTIC_TRUTH_317_REVISION,
} from '@/lib/cv-experience-operation-source-bundle';
import {
  checkExperienceDiagnosticInvariants,
  checkExperienceDiagnosticCompleteness,
} from '@/lib/cv-ai-diagnostics-contract';
import { ExperienceAiDiagnosticSession } from '@/lib/cv-experience-ai-diagnostics';
import { resolveExperienceAiGrounding } from '@/lib/cv-experience-job-context';
import { freezeExperienceAiDescription } from '@/lib/cv-canonical-facts';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';

const REF = '2026-07-24';

const ATLAS_PAST = formatExperienceBullets([
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const ATLAS_PRESENT = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

function atlasCv(withProvenance: boolean, desc = ATLAS_PRESENT): CVData {
  const provenance = withProvenance
    ? buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-atlas',
      appliedOutput: ATLAS_PRESENT,
      preAiFactText: ATLAS_PAST,
      sourceLocale: 'es',
      targetLocale: 'es',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'pre_ai_snapshot',
    })
    : undefined;
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: desc,
    originalUserDescription: ATLAS_PAST,
    generatedDescription: withProvenance ? ATLAS_PRESENT : undefined,
    descriptionOrigin: withProvenance ? 'ai_generated' : 'user',
    contentLocale: 'es',
    aiOutputProvenance: provenance,
  };
  return {
    personal: {
      fullName: 'Test User',
      jobTitle: localizeWarehouseEmployee('es', 'female'),
      email: 't@example.com',
      phone: '',
      location: '',
      summary: '',
    },
    experience: [current],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
  };
}

describe('AAB-317 Phase 2 markers', () => {
  it('keeps all four 317 markers in SUMMARY_RUNTIME_MARKER_SET', () => {
    for (const m of [
      EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION,
      EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION,
      EXPERIENCE_NOOP_DEGRADATION_ORDER_317_REVISION,
      EXPERIENCE_UNEDITED_RERUN_DIAGNOSTIC_TRUTH_317_REVISION,
    ]) {
      expect(SUMMARY_RUNTIME_MARKER_SET).toContain(m);
    }
  });
});

describe('AAB-317 diagnostic truth for unedited rerun', () => {
  it('emits consistent fact-authority and visible-comparison fields', () => {
    const cv = atlasCv(true);
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-317-diag',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: ATLAS_PAST,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
      jobContextHash: 'j',
    });
    const d = fin.diagnostics!;
    expect(d.factAuthorityKind).toBe('pre_ai_snapshot');
    expect(d.authoritativeFactSourceKind).toBe('pre_ai_snapshot');
    expect(d.factAuthorityMatchesAuthoritativeSourceKind).toBe(true);
    expect(d.visibleComparisonProvenance).toBe('ai_generated_unedited');
    expect(d.visibleComparisonMatchedLastAiOutput).toBe(true);
    expect(d.visibleComparisonCapturedAtRequest).toBe(true);
    expect(d.semanticNoOpDetected).toBe(true);
    expect(d.degradationDetected).toBe(false);
    expect(d.degradationKinds || []).toEqual([]);
    expect(d.finalDecisionKind).toMatch(/noop/);
    expect(d.rejectionStage).toBeNull();
    expect(d.finalTypedFailureReason ?? null).toBeNull();
    expect(d.finalCandidateSource).toBe('none');
    expect(d.finalCandidatePresent).toBe(false);
    expect(d.finalCandidateBulletCount).toBe(0);
    expect(d.finalCandidateBulletScripts || []).toEqual([]);
    expect(d.providerBulletCount).toBe(0);
    expect(d.providerBulletScripts || []).toEqual([]);
    expect(d.finalBulletCount).toBe(0);
    expect(d.finalBulletScripts || []).toEqual([]);
  });

  it('passes invariants / completeness / privacy for the exact rerun fixture', () => {
    const cv = atlasCv(true);
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-317-inv',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: '',
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
      jobContextHash: 'j',
      earlyUneditedRerunNoOp: true,
    });
    const jobCtx = buildExperienceJobContext({
      position: cv.experience[0].position,
      industry: 'warehouse',
      locale: 'es',
      level: 'mid',
    });
    const grounding = resolveExperienceAiGrounding(
      cv.experience[0],
      jobCtx,
      freezeExperienceAiDescription,
    );
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'es',
      requestedLocale: 'es',
      contentLocale: 'es',
      templateId: '',
      gender: 'female',
      industryNorm: '',
      levelNorm: '',
      jobContextHash: 'j',
      requestId: 'req-317-inv',
      usageCountBefore: 28,
    });
    session.recordLiveExperience(cv.experience[0], true);
    session.recordSourceSelection(cv.experience[0], grounding, {
      requestedLocale: 'es',
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
    });
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(false, 28);
    const trace = session.commit();
    const inv = checkExperienceDiagnosticInvariants(trace);
    expect(inv.failures, JSON.stringify(inv.failures, null, 2)).toEqual([]);
    expect(inv.passed).toBe(true);
    const comp = checkExperienceDiagnosticCompleteness(trace);
    expect(comp.passed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('second operation does not inherit first-operation decision fields', () => {
    // Op 1: past → present apply
    const cv1 = atlasCv(false, ATLAS_PAST);
    const snap1 = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PAST,
      locale: 'es',
      requestId: 'req-317-op1',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const op1 = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: cv1,
      candidate: ATLAS_PAST,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap1,
    });
    expect(op1.countedAsSuccess).toBe(true);

    const session1 = new ExperienceAiDiagnosticSession({
      uiLocale: 'es',
      requestedLocale: 'es',
      contentLocale: 'es',
      templateId: '',
      gender: 'female',
      industryNorm: '',
      levelNorm: '',
      jobContextHash: 'j',
      requestId: 'req-317-op1',
      usageCountBefore: 27,
    });
    session1.recordFinalizeResult(op1);
    session1.recordVisibleApply(true, 28);
    const t1 = session1.commit();
    expect(t1.materialImprovementDetected).toBe(true);

    // Op 2: fresh session for unedited rerun
    const cv2 = atlasCv(true);
    const snap2 = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-317-op2',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const op2 = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: cv2,
      candidate: ATLAS_PAST,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap2,
      jobContextHash: 'j',
    });
    const session2 = new ExperienceAiDiagnosticSession({
      uiLocale: 'es',
      requestedLocale: 'es',
      contentLocale: 'es',
      templateId: '',
      gender: 'female',
      industryNorm: '',
      levelNorm: '',
      jobContextHash: 'j',
      requestId: 'req-317-op2',
      usageCountBefore: 28,
    });
    session2.recordSourceSelection(cv2.experience[0], resolveExperienceAiGrounding(
      cv2.experience[0],
      buildExperienceJobContext({
        position: cv2.experience[0].position,
        industry: 'warehouse',
        locale: 'es',
        level: 'mid',
      }),
      freezeExperienceAiDescription,
    ), {
      requestedLocale: 'es',
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
    });
    session2.recordFinalizeResult(op2);
    session2.recordVisibleApply(false, 28);
    const t2 = session2.commit();
    expect(t2.materialImprovementDetected).toBe(false);
    expect(t2.materialImprovementKinds || []).toEqual([]);
    expect(t2.degradationDetected).toBe(false);
    expect(t2.visibleComparisonProvenance).toBe('ai_generated_unedited');
    expect(t2.factAuthorityKind).toBe('pre_ai_snapshot');
    expect(t2.finalCandidateSource === 'none' || t2.finalCandidateSource == null
      || t2.earlyNoOpPreflightPassed === true).toBe(true);
  });
});
