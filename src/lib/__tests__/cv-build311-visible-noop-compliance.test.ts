/**
 * @vitest-environment jsdom
 *
 * AAB-311 — dual-source visible no-op authority + Spanish compliance grounding.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION,
  EXPERIENCE_PREDICATE_PHASE_DIAGNOSTICS_311_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION,
  SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION,
  detectSpanishExperienceUnsupportedExpansion,
  detectSpanishExperiencePredicateExpansion,
  stripSpanishExperienceUnsupportedEscalation,
} from '@/lib/cv-spanish-experience-grounding';
import {
  EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION as VIS_REV,
  evaluateExperienceVisibleComparison,
  experienceSpanishWarehouseSemanticallyEquivalent,
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

const WH_ES_GOOD = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const BAD_CONFORMIDAD = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con cada conformidad.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía dentro del almacén.',
]);

const BAD_GESTIONA = formatExperienceBullets([
  'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
  'Comprueba y gestiona la documentación relacionada con los envíos y entregas de mercancía.',
  'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
]);

const SUPPORTED_CONFORMIDAD_SRC = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba certificados y declaraciones de conformidad',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
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

describe('cv-build311 visible no-op authority + compliance grounding', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('exposes AAB-311 revision markers in the runtime set', () => {
    expect(EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION)
      .toBe('experience-visible-noop-authority-311-v1');
    expect(SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION)
      .toBe('spanish-experience-compliance-grounding-311-v1');
    expect(EXPERIENCE_PREDICATE_PHASE_DIAGNOSTICS_311_REVISION)
      .toBe('experience-predicate-phase-diagnostics-311-v1');
    expect(VIS_REV).toBe(EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_VISIBLE_NOOP_AUTHORITY_311_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SPANISH_EXPERIENCE_COMPLIANCE_GROUNDING_311_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_PREDICATE_PHASE_DIAGNOSTICS_311_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION,
    );
  });

  it('detects cada conformidad as unsupported compliance expansion', () => {
    const scan = detectSpanishExperienceUnsupportedExpansion(WH_ES_SHORT, BAD_CONFORMIDAD);
    expect(scan.count).toBeGreaterThan(0);
    expect(scan.kinds).toContain('conformity_object_expansion');
    expect(scan.kinds).toContain('compliance_scope_expansion');
  });

  it('preserves source-supported conformidad wording', () => {
    const cand = formatExperienceBullets([
      'Revisa la mercancía entrante en el almacén.',
      'Verifica la documentación y los certificados de conformidad.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    const scan = detectSpanishExperienceUnsupportedExpansion(SUPPORTED_CONFORMIDAD_SRC, cand);
    expect(scan.kinds).not.toContain('conformity_object_expansion');
  });

  it('strips unsupported cada conformidad without inventing replacements', () => {
    const repaired = stripSpanishExperienceUnsupportedEscalation(
      BAD_CONFORMIDAD,
      WH_ES_SHORT,
    );
    expect(repaired.toLowerCase()).not.toMatch(/conformidad/);
    expect(repaired.toLowerCase()).toMatch(/documentaci/);
  });

  it('counts three source predicate action units for the warehouse fixture', () => {
    const pred = detectSpanishExperiencePredicateExpansion(WH_ES_SHORT, WH_ES_GOOD);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('treats synonym / almacén swaps as semantic equivalent', () => {
    const synonym = formatExperienceBullets([
      'Verifica la mercancía entrante en el almacén.',
      'Revisa la documentación relacionada con la mercancía recibida.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(experienceSpanishWarehouseSemanticallyEquivalent(WH_ES_GOOD, synonym)).toBe(true);
    const shorter = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(experienceSpanishWarehouseSemanticallyEquivalent(WH_ES_GOOD, shorter)).toBe(true);
  });

  it('AAB-310 Test A regression: gestiona strip still applies from short source', () => {
    const cv = spanishFixture({ currentDesc: WH_ES_SHORT });
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: WH_ES_SHORT,
      locale: 'es',
      requestId: 'req-311-a',
      jobContextHash: 'j',
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: BAD_GESTIONA,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(true);
    expect(result.text.toLowerCase()).not.toMatch(/gestiona/);
    expect(result.text.toLowerCase()).not.toMatch(/garantiz/);
    expect(['unsupported_claim_repair', 'deterministic_fallback']).toContain(
      result.diagnostics?.finalCandidateSource,
    );
    expect(result.diagnostics?.finalUnsupportedClaimCount ?? 0).toBe(0);
  });

  it('AAB-310 Test B: unedited AI re-run with conformidad is no-op / no usage', () => {
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-atlas',
      appliedOutput: WH_ES_GOOD,
      preAiFactText: WH_ES_SHORT,
      sourceLocale: 'es',
      targetLocale: 'es',
      operationMode: 'enhance_existing',
      sourceAuthorityKind: 'pre_ai_snapshot',
    });
    const cv = spanishFixture({
      currentDesc: WH_ES_GOOD,
      originalDesc: WH_ES_SHORT,
      provenance,
    });
    expect(shouldUseVisibleComparisonForNoOp({
      currentTextareaProvenance: 'ai_generated_unedited',
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      visibleText: WH_ES_GOOD,
      factAuthorityText: WH_ES_SHORT,
    })).toBe(true);

    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: WH_ES_GOOD,
      locale: 'es',
      requestId: 'req-311-b',
      jobContextHash: 'j',
      authoritativeTextOverride: WH_ES_SHORT,
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: BAD_CONFORMIDAD,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.text).toBe(WH_ES_GOOD);
    expect(result.diagnostics?.semanticNoOpDetected === true
      || result.diagnostics?.degradationDetected === true
      || result.diagnostics?.noOpDetected === true
      || result.reason === 'experience_ai_noop'
      || result.reason === 'experience_ai_degradation').toBe(true);
  });

  it('semantic re-run of equivalent good result is no-op', () => {
    const provenance = buildExperienceAiOutputProvenance({
      experienceEntryId: 'exp-atlas',
      appliedOutput: WH_ES_GOOD,
      preAiFactText: WH_ES_SHORT,
      sourceLocale: 'es',
      targetLocale: 'es',
      sourceAuthorityKind: 'pre_ai_snapshot',
    });
    const synonym = formatExperienceBullets([
      'Verifica la mercancía entrante en el almacén.',
      'Revisa la documentación relacionada con la mercancía recibida.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    const cv = spanishFixture({
      currentDesc: WH_ES_GOOD,
      originalDesc: WH_ES_SHORT,
      provenance,
    });
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: WH_ES_GOOD,
      locale: 'es',
      requestId: 'req-311-syn',
      jobContextHash: 'j',
      authoritativeTextOverride: WH_ES_SHORT,
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      experienceId: 'exp-atlas',
      candidate: synonym,
      cv,
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.text).toBe(WH_ES_GOOD);
  });

  it('visible comparison evaluation separates fact authority from visible baseline', () => {
    const evalResult = evaluateExperienceVisibleComparison({
      factAuthorityText: WH_ES_SHORT,
      visibleComparisonText: WH_ES_GOOD,
      candidateText: WH_ES_GOOD,
      locale: 'es',
      matchedLastAiOutput: true,
      useVisibleForNoOp: true,
    });
    expect(evalResult.semanticNoOpDetected).toBe(true);
    expect(evalResult.materialImprovementDetected).toBe(false);
    expect(evalResult.visibleComparisonUsedForNoOp).toBe(true);
  });
});
