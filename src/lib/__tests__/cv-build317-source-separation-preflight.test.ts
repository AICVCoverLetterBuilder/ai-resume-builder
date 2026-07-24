/**
 * AAB-317 Phase 1 — fact/visible source separation + unedited-rerun preflight.
 */
import { describe, expect, it, vi } from 'vitest';
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
  buildExperienceOperationSourceBundle,
  evaluateUneditedRerunEarlyNoOpPreflight,
  resolveExperienceFactAuthorityText,
} from '@/lib/cv-experience-operation-source-bundle';
import { analyzeExperienceVisibleSource } from '@/lib/cv-experience-visible-source-analysis';
import { resolveExperienceTextareaProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';

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

function atlasCv(opts: {
  currentDesc: string;
  originalDesc?: string;
  isPresent?: boolean;
  withProvenance?: boolean;
}): CVData {
  const provenance = opts.withProvenance
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
    endDate: opts.isPresent === false ? '2024-01' : '',
    isPresent: opts.isPresent !== false,
    description: opts.currentDesc,
    originalUserDescription: opts.originalDesc || ATLAS_PAST,
    generatedDescription: opts.withProvenance ? ATLAS_PRESENT : undefined,
    descriptionOrigin: opts.withProvenance ? 'ai_generated' : 'user',
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

describe('AAB-317 Phase 1 markers', () => {
  it('keeps 317 markers reachable in SUMMARY_RUNTIME_MARKER_SET', () => {
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

describe('AAB-317 source separation', () => {
  it('keeps pre-AI fact authority alongside current visible source', () => {
    const cv = atlasCv({
      currentDesc: ATLAS_PRESENT,
      withProvenance: true,
    });
    const exp = cv.experience[0];
    const prov = resolveExperienceTextareaProvenance(exp);
    expect(prov.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(prov.authoritativeFactSourceKind).toBe('pre_ai_snapshot');
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-317-sep',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fact = resolveExperienceFactAuthorityText({
      textareaProvenance: prov,
      snapshot: snap,
    });
    expect(fact).toContain('Revisó');
    const bundle = buildExperienceOperationSourceBundle({
      textareaProvenance: prov,
      snapshot: snap,
      factAuthorityText: fact,
      visibleSourceText: ATLAS_PRESENT,
      locale: 'es',
      isPresent: true,
      experienceEntryId: 'exp-atlas',
      jobContextHash: 'j',
      exp,
    });
    expect(bundle.factAuthorityKind).toBe('pre_ai_snapshot');
    expect(bundle.authoritativeFactSourceKind).toBe('pre_ai_snapshot');
    expect(bundle.factAuthorityMatchesAuthoritativeSourceKind).toBe(true);
    expect(bundle.visibleSourceKind).toBe('currentTextarea');
    expect(bundle.visibleSourceProvenance).toBe('ai_generated_unedited');
    expect(bundle.visibleSourceMatchedLastAiOutput).toBe(true);
    expect(bundle.factAuthoritySeparatedFromVisibleSource).toBe(true);
  });

  it('analyzes visible present text, not historical past fact authority', () => {
    const analysis = analyzeExperienceVisibleSource({
      visibleText: ATLAS_PRESENT,
      targetLocale: 'es',
      isPresent: true,
      storedLocale: 'es',
    });
    expect(analysis.tenseMismatchCount).toBe(0);
    expect(analysis.sourceAlreadyValidForTarget).toBe(true);
    expect(analysis.correctableDefectCount).toBe(0);
  });

  it('historical past fact authority alone does not produce tense_regressed', () => {
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PRESENT,
      candidateText: ATLAS_PRESENT,
      locale: 'es',
      isPresent: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      matchedLastAiOutput: true,
      useVisibleForNoOp: true,
      capturedAtRequest: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.degradationKinds).not.toContain('tense_regressed');
    expect(evalVis.semanticNoOpDetected || evalVis.finalDecisionKind === 'exact_noop').toBe(true);
  });

  it('candidate changing present visible to past produces tense_regressed', () => {
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PRESENT,
      candidateText: ATLAS_PAST,
      locale: 'es',
      isPresent: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      matchedLastAiOutput: true,
      useVisibleForNoOp: true,
      capturedAtRequest: true,
    });
    expect(evalVis.degradationKinds).toContain('tense_regressed');
    expect(evalVis.degradationDetected).toBe(true);
  });
});

describe('AAB-317 unedited-rerun preflight', () => {
  it('short-circuits before provider for exact unedited valid AI output', () => {
    const cv = atlasCv({
      currentDesc: ATLAS_PRESENT,
      withProvenance: true,
    });
    const exp = cv.experience[0];
    const prov = resolveExperienceTextareaProvenance(exp);
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-317-pre',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const analysis = analyzeExperienceVisibleSource({
      visibleText: ATLAS_PRESENT,
      targetLocale: 'es',
      isPresent: true,
      storedLocale: 'es',
    });
    const bundle = buildExperienceOperationSourceBundle({
      textareaProvenance: prov,
      snapshot: snap,
      factAuthorityText: ATLAS_PAST,
      visibleSourceText: ATLAS_PRESENT,
      locale: 'es',
      isPresent: true,
      experienceEntryId: 'exp-atlas',
      jobContextHash: 'j',
      exp,
    });
    const pre = evaluateUneditedRerunEarlyNoOpPreflight({
      bundle,
      visibleSourceAnalysis: analysis,
      sourceWasEmpty: false,
    });
    expect(pre.uneditedRerunDetected).toBe(true);
    expect(pre.earlyNoOpPreflightPassed).toBe(true);
    expect(pre.semanticNoOpReason).toBe('unedited_ai_output_already_valid');

    const provider = vi.fn();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: ATLAS_PAST, // would be a degrading provider echo if evaluated
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
      jobContextHash: 'j',
    });
    expect(provider).not.toHaveBeenCalled();
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.diagnostics?.earlyNoOpPreflightPassed).toBe(true);
    expect(fin.diagnostics?.providerAttempted).toBe(false);
    expect(fin.diagnostics?.semanticNoOpDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.degradationKinds || []).toEqual([]);
    expect(fin.diagnostics?.factAuthorityKind).toBe('pre_ai_snapshot');
    expect(fin.diagnostics?.authoritativeFactSourceKind).toBe('pre_ai_snapshot');
    expect(fin.diagnostics?.factAuthorityMatchesAuthoritativeSourceKind).toBe(true);
    expect(fin.diagnostics?.visibleComparisonProvenance).toBe('ai_generated_unedited');
    expect(fin.diagnostics?.visibleComparisonMatchedLastAiOutput).toBe(true);
    expect(fin.diagnostics?.finalDecisionKind).toMatch(/noop/);
    expect(fin.diagnostics?.rejectionStage).toBeNull();
    expect(fin.diagnostics?.finalCandidateSource).toBe('none');
  });

  it('disables preflight after material user edit', () => {
    const cv = atlasCv({
      currentDesc: ATLAS_PRESENT + '\nGestiona envíos especiales.',
      withProvenance: true,
    });
    // Force edit classification
    cv.experience[0].description = formatExperienceBullets([
      'Revisa la mercancía entrante en el almacén.',
      'Comprueba la documentación asociada a la mercancía recibida.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      'Gestiona envíos especiales al cliente.',
    ]);
    const prov = resolveExperienceTextareaProvenance(cv.experience[0]);
    expect(prov.materialUserEditDetected).toBe(true);
    const analysis = analyzeExperienceVisibleSource({
      visibleText: cv.experience[0].description,
      targetLocale: 'es',
      isPresent: true,
      storedLocale: 'es',
    });
    const snap = createExperienceAiOperationSnapshot({
      liveText: cv.experience[0].description,
      locale: 'es',
      requestId: 'req-317-edit',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
    });
    const bundle = buildExperienceOperationSourceBundle({
      textareaProvenance: prov,
      snapshot: snap,
      factAuthorityText: prov.authoritativeFactText || cv.experience[0].description,
      visibleSourceText: cv.experience[0].description,
      locale: 'es',
      isPresent: true,
      experienceEntryId: 'exp-atlas',
      jobContextHash: 'j',
      exp: cv.experience[0],
    });
    const pre = evaluateUneditedRerunEarlyNoOpPreflight({
      bundle,
      visibleSourceAnalysis: analysis,
      sourceWasEmpty: false,
    });
    expect(pre.earlyNoOpPreflightPassed).toBe(false);
    expect(pre.earlyNoOpPreflightFailureReasons.length).toBeGreaterThan(0);
  });

  it('disables preflight after employment-state change (present text, completed role)', () => {
    const cv = atlasCv({
      currentDesc: ATLAS_PRESENT,
      withProvenance: true,
      isPresent: false,
    });
    const analysis = analyzeExperienceVisibleSource({
      visibleText: ATLAS_PRESENT,
      targetLocale: 'es',
      isPresent: false,
      storedLocale: 'es',
    });
    expect(analysis.sourceAlreadyValidForTarget).toBe(false);
    const prov = resolveExperienceTextareaProvenance(cv.experience[0]);
    const snap = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-317-emp',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const bundle = buildExperienceOperationSourceBundle({
      textareaProvenance: prov,
      snapshot: snap,
      factAuthorityText: ATLAS_PAST,
      visibleSourceText: ATLAS_PRESENT,
      locale: 'es',
      isPresent: false,
      experienceEntryId: 'exp-atlas',
      jobContextHash: 'j',
      exp: cv.experience[0],
    });
    const pre = evaluateUneditedRerunEarlyNoOpPreflight({
      bundle,
      visibleSourceAnalysis: analysis,
      sourceWasEmpty: false,
    });
    expect(pre.earlyNoOpPreflightPassed).toBe(false);
    expect(pre.earlyNoOpPreflightFailureReasons).toContain('visible_source_not_already_valid');
  });

  it('past→present apply then immediate unedited rerun is no-op +0', () => {
    // Step 1: past → present
    const cv1 = atlasCv({ currentDesc: ATLAS_PAST });
    const snap1 = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PAST,
      locale: 'es',
      requestId: 'req-317-s1',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const step1 = finalizeCvAiFieldForApply({
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
    expect(step1.countedAsSuccess).toBe(true);
    expect(step1.text).toContain('Revisa');

    // Step 2: unedited rerun
    const cv2 = atlasCv({
      currentDesc: ATLAS_PRESENT,
      withProvenance: true,
    });
    const snap2 = createExperienceAiOperationSnapshot({
      liveText: ATLAS_PRESENT,
      locale: 'es',
      requestId: 'req-317-s2',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const step2 = finalizeCvAiFieldForApply({
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
    expect(step2.countedAsSuccess).toBe(false);
    expect(step2.diagnostics?.earlyNoOpPreflightPassed).toBe(true);
    expect(step2.diagnostics?.degradationDetected).toBe(false);
    expect(step2.diagnostics?.materialImprovementDetected).toBe(false);
    expect(step2.diagnostics?.visibleComparisonProvenance).toBe('ai_generated_unedited');
    expect(step2.diagnostics?.factAuthorityKind).toBe('pre_ai_snapshot');
    // Must not inherit step1 improvement kinds
    expect(step2.diagnostics?.materialImprovementKinds || []).toEqual([]);
  });
});
