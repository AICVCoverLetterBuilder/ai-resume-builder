/**
 * @vitest-environment jsdom
 *
 * AAB-312 — visible snapshot wiring, semantic no-op final gate,
 * fact-authority diagnostic consistency.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION,
  EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION,
  EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION,
  EXPERIENCE_FACT_AUTHORITY_CONSISTENCY_312_REVISION,
  EXPERIENCE_PREDICATE_PHASE_DIAGNOSTICS_311_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  evaluateExperienceVisibleComparison,
  experienceSpanishWarehouseSemanticallyEquivalent,
  mapFactAuthorityKindForDiagnostics,
  shouldUseVisibleComparisonForNoOp,
} from '@/lib/cv-experience-visible-noop-authority';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import {
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { clearCvAiDiagnosticHistory } from '@/lib/cv-ai-diagnostics-contract';
import {
  createExperienceAiOperationSnapshot,
} from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceAiOutputProvenance,
} from '@/lib/cv-experience-ai-output-provenance';

const REF = '2026-07-19';

const WH_ES_SHORT = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

const WH_ES_VISIBLE = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_INCLUSIVE = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación asociada a la mercancía recibida.',
  'Coordina con sus compañeras y compañeros la preparación y el movimiento de la mercancía.',
]);

const WH_ES_SYNONYM_DOC = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const GD_ES_COMPLETED = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
]);

function spanishFixture(opts: {
  currentDesc: string;
  originalDesc?: string;
  provenance?: ReturnType<typeof buildExperienceAiOutputProvenance>;
}): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: opts.currentDesc,
    originalUserDescription: opts.originalDesc ?? opts.currentDesc,
    descriptionOrigin: opts.provenance ? 'ai_generated' : 'user',
    contentLocale: 'es',
    aiOutputProvenance: opts.provenance,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', 'female'),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: GD_ES_COMPLETED,
    originalUserDescription: GD_ES_COMPLETED,
    descriptionOrigin: 'user',
    contentLocale: 'es',
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
    experience: [current, prior],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
  };
}

describe('cv-build312 visible snapshot + semantic no-op + authority', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('exposes AAB-312 revision markers in the runtime set', () => {
    expect(EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION)
      .toBe('experience-visible-snapshot-wiring-312-v1');
    expect(EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION)
      .toBe('experience-semantic-noop-final-gate-312-v1');
    expect(EXPERIENCE_FACT_AUTHORITY_CONSISTENCY_312_REVISION)
      .toBe('experience-fact-authority-consistency-312-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_VISIBLE_SNAPSHOT_WIRING_312_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_SEMANTIC_NOOP_FINAL_GATE_312_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_FACT_AUTHORITY_CONSISTENCY_312_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_PREDICATE_PHASE_DIAGNOSTICS_311_REVISION,
    );
  });

  it('captures immutable visible comparison hashes on the operation snapshot', () => {
    const snap = createExperienceAiOperationSnapshot({
      liveText: WH_ES_VISIBLE,
      locale: 'es',
      requestId: 'req-312-snap',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: WH_ES_SHORT,
      provenanceOriginOverride: 'originalUserDescription',
    });
    expect(snap.visibleComparisonRawText.trim()).toBe(WH_ES_VISIBLE.trim());
    expect(snap.visibleComparisonHash).toBeTruthy();
    expect(snap.visibleComparisonNormalizedHash).toBeTruthy();
    expect(snap.visibleComparisonUnitCount).toBe(3);
    expect(snap.visibleComparisonCapturedAtRequest).toBe(true);
    expect(snap.authoritativeRawText.trim()).toBe(WH_ES_SHORT.trim());
    expect(snap.liveRawText.trim()).toBe(WH_ES_VISIBLE.trim());
  });

  it('treats compañeros ↔ compañeras y compañeros as semantic equivalent', () => {
    expect(experienceSpanishWarehouseSemanticallyEquivalent(
      WH_ES_VISIBLE,
      WH_ES_INCLUSIVE,
    )).toBe(true);
    const evalResult = evaluateExperienceVisibleComparison({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_VISIBLE,
      candidateText: WH_ES_INCLUSIVE,
      locale: 'es',
      visibleComparisonProvenance: 'ai_generated_unedited',
      matchedLastAiOutput: true,
      useVisibleForNoOp: true,
    });
    expect(evalResult.semanticNoOpDetected).toBe(true);
    expect(evalResult.neutralRestyleDetected).toBe(true);
    expect(evalResult.materialImprovementDetected).toBe(false);
    expect(evalResult.materialImprovementKinds).toEqual([]);
    expect(evalResult.degradationDetected).toBe(false);
    expect(
      evalResult.semanticNoOpReason === 'inclusive_gender_equivalent'
      || evalResult.semanticNoOpReason === 'neutral_restyle'
      || evalResult.semanticNoOpReason === 'semantic_equivalent_visible',
    ).toBe(true);
    expect(evalResult.visibleComparisonHash).toBeTruthy();
    expect(evalResult.visibleComparisonUnitCount).toBe(3);
  });

  it('forbids materialImprovementDetected true with empty kinds', () => {
    const evalResult = evaluateExperienceVisibleComparison({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_VISIBLE,
      candidateText: WH_ES_INCLUSIVE,
      locale: 'es',
      useVisibleForNoOp: true,
    });
    if (evalResult.materialImprovementDetected) {
      expect(evalResult.materialImprovementKinds.length).toBeGreaterThan(0);
    }
    expect(evalResult.materialImprovementDetected).toBe(false);
    expect(evalResult.materialImprovementKinds).toEqual([]);
  });

  it('AAB-311 inclusive-language fixture: no apply, populated snapshot, authority consistent', () => {
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-atlas',
      appliedOutput: WH_ES_VISIBLE,
      preAiFactText: WH_ES_SHORT,
      sourceLocale: 'es',
      targetLocale: 'es',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'pre_ai_snapshot',
    });
    const cv = spanishFixture({
      currentDesc: WH_ES_VISIBLE,
      originalDesc: WH_ES_SHORT,
      provenance,
    });
    expect(shouldUseVisibleComparisonForNoOp({
      currentTextareaProvenance: 'ai_generated_unedited',
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      visibleText: WH_ES_VISIBLE,
      factAuthorityText: WH_ES_SHORT,
    })).toBe(true);

    const snap = createExperienceAiOperationSnapshot({
      liveText: WH_ES_VISIBLE,
      locale: 'es',
      requestId: 'req-312-inclusive',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: WH_ES_SHORT,
      provenanceOriginOverride: 'originalUserDescription',
    });

    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: WH_ES_INCLUSIVE,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });

    expect(result.countedAsSuccess).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.text).toBe(WH_ES_VISIBLE);
    expect(result.diagnostics?.semanticNoOpDetected).toBe(true);
    expect(result.diagnostics?.materialImprovementDetected).toBe(false);
    expect(result.diagnostics?.materialImprovementKinds || []).toEqual([]);
    expect(result.diagnostics?.degradationDetected).toBe(false);
    expect(result.diagnostics?.visibleComparisonHash).toBeTruthy();
    expect(result.diagnostics?.visibleComparisonNormalizedHash).toBeTruthy();
    expect(result.diagnostics?.visibleComparisonUnitCount).toBe(3);
    expect(result.diagnostics?.visibleComparisonUsedForNoOp).toBe(true);
    expect(result.diagnostics?.visibleComparisonCapturedAtRequest).toBe(true);
    expect(result.diagnostics?.visibleComparisonMatchedLastAiOutput).toBe(true);
    expect(result.diagnostics?.finalCandidateSource).toBe('none');
    expect(result.diagnostics?.factAuthorityKind).toBe('pre_ai_snapshot');
    expect(
      result.diagnostics?.factAuthorityKind
      !== 'current_textarea',
    ).toBe(true);
  });

  it('user-edited synonym related↔asociada is semantic no-op', () => {
    const cv = spanishFixture({
      currentDesc: WH_ES_SYNONYM_DOC,
      originalDesc: WH_ES_SYNONYM_DOC,
    });
    const snap = createExperienceAiOperationSnapshot({
      liveText: WH_ES_SYNONYM_DOC,
      locale: 'es',
      requestId: 'req-312-user-edit',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
    });
    expect(shouldUseVisibleComparisonForNoOp({
      currentTextareaProvenance: 'ai_generated_user_edited',
      visibleText: WH_ES_SYNONYM_DOC,
      factAuthorityText: WH_ES_SYNONYM_DOC,
    })).toBe(true);

    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: WH_ES_VISIBLE,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.text).toBe(WH_ES_SYNONYM_DOC);
    expect(result.diagnostics?.semanticNoOpDetected).toBe(true);
    expect(result.diagnostics?.materialImprovementDetected).toBe(false);
    expect(result.diagnostics?.visibleComparisonHash).toBeTruthy();
  });

  it('maps fact authority kinds without inheriting visible comparison', () => {
    expect(mapFactAuthorityKindForDiagnostics('pre_ai_snapshot')).toBe('pre_ai_snapshot');
    expect(mapFactAuthorityKindForDiagnostics('current_textarea')).toBe('current_textarea');
    expect(mapFactAuthorityKindForDiagnostics('originalUserDescription')).toBe('original_user');
  });

  it('missing-fact restoration may classify as material improvement', () => {
    const incomplete = formatExperienceBullets([
      'Revisa la mercancía entrante en el almacén.',
      'Comprueba la documentación asociada a la mercancía recibida.',
    ]);
    const evalResult = evaluateExperienceVisibleComparison({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: incomplete,
      candidateText: WH_ES_VISIBLE,
      locale: 'es',
      useVisibleForNoOp: true,
    });
    expect(evalResult.semanticNoOpDetected).toBe(false);
    expect(evalResult.materialImprovementDetected).toBe(true);
    expect(evalResult.materialImprovementKinds.length).toBeGreaterThan(0);
    expect(
      evalResult.materialImprovementKinds.includes('missing_fact_restored')
      || evalResult.materialImprovementKinds.includes('missing_source_unit_restored'),
    ).toBe(true);
  });
});
