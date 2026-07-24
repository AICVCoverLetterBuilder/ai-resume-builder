/**
 * AAB-316 — single canonical finalizer + Spanish semantic-delta grounding.
 */
import { describe, expect, it } from 'vitest';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  analyzeExperienceVisibleSource,
} from '@/lib/cv-experience-visible-source-analysis';
import {
  finalizeSpanishExperienceCandidate,
  finalizeSpanishExperienceCandidateConservatively,
  decideSpanishExperienceFinalCandidate,
  validateSpanishExperienceCandidate,
} from '@/lib/cv-experience-canonical-finalization';
import {
  detectSpanishExperienceSemanticDelta,
  EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION,
  SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION,
  SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION,
  EXPERIENCE_FINAL_DECISION_TRUTH_316_REVISION,
} from '@/lib/cv-spanish-experience-semantic-delta';
import { detectSpanishExperienceUnsupportedExpansion } from '@/lib/cv-spanish-experience-grounding';
import { countIncompleteSpanishUnits } from '@/lib/cv-spanish-experience-morphology';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import type { CVData, WorkExperience } from '@/lib/types';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';

const REF = '2026-07-24';

const REWITU_PAST = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos.',
  'Revisó y adaptó materiales de diseño.',
  'Preparó archivos finales de diseño para distintos formatos y pantallas.',
]);

const REWITU_BAD_PROVIDER = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos para diversos proyectos de diseño.',
  'Revisó y adaptó materiales de diseño según los requisitos establecidos.',
  'Preparó archivos finales de diseño optimizados para distintos formatos y pantallas.',
]);

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

function rewituFixture(desc: string): CVData {
  const exp: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', 'female'),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: desc,
    originalUserDescription: desc,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  return {
    personal: {
      fullName: 'Test User',
      jobTitle: localizeGraphicDesigner('es', 'female'),
      email: 't@example.com',
      phone: '',
      location: '',
      summary: '',
    },
    experience: [exp],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    contentLocale: 'es',
  };
}

function atlasFixture(desc: string): CVData {
  const exp: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: desc,
    originalUserDescription: desc,
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
    experience: [exp],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    contentLocale: 'es',
  };
}

describe('AAB-316 markers', () => {
  it('keeps all four revision markers reachable', () => {
    expect(EXPERIENCE_SINGLE_CANONICAL_FINALIZER_316_REVISION)
      .toBe('experience-single-canonical-finalizer-316-v1');
    expect(SPANISH_EXPERIENCE_SEMANTIC_DELTA_GROUNDING_316_REVISION)
      .toBe('spanish-experience-semantic-delta-grounding-316-v1');
    expect(SPANISH_EXPERIENCE_VALID_SOURCE_NOOP_316_REVISION)
      .toBe('spanish-experience-valid-source-noop-316-v1');
    expect(EXPERIENCE_FINAL_DECISION_TRUTH_316_REVISION)
      .toBe('experience-final-decision-truth-316-v1');
  });
});

describe('AAB-316 semantic-delta grounding', () => {
  it('rejects diversos proyectos / requisitos / optimizados when absent from source', () => {
    const delta = detectSpanishExperienceSemanticDelta(REWITU_PAST, REWITU_BAD_PROVIDER);
    expect(delta.count).toBeGreaterThan(0);
    expect(delta.kinds).toEqual(expect.arrayContaining([
      'project_scope_expansion',
      'requirements_scope_expansion',
      'optimization_claim',
    ]));
    const scan = detectSpanishExperienceUnsupportedExpansion(REWITU_PAST, REWITU_BAD_PROVIDER);
    expect(scan.count).toBeGreaterThan(0);
    expect(scan.kinds).toEqual(expect.arrayContaining([
      'project_scope_expansion',
      'requirements_scope_expansion',
      'optimization_claim',
    ]));
  });

  it('preserves project / requirements / optimization when source-supported', () => {
    expect(detectSpanishExperienceSemanticDelta(
      'Creó materiales visuales para diversos proyectos de diseño.',
      'Creó materiales visuales para diversos proyectos de diseño.',
    ).count).toBe(0);
    expect(detectSpanishExperienceSemanticDelta(
      'Adaptó materiales según los requisitos establecidos.',
      'Adaptó materiales según los requisitos establecidos.',
    ).count).toBe(0);
    expect(detectSpanishExperienceSemanticDelta(
      'Preparó y optimizó archivos finales para distintos formatos.',
      'Preparó y optimizó archivos finales para distintos formatos.',
    ).count).toBe(0);
    expect(detectSpanishExperienceSemanticDelta(
      'Preparó archivos finales de alta calidad.',
      'Preparó archivos finales de alta calidad.',
    ).count).toBe(0);
  });

  it('rejects quality modifiers when absent', () => {
    const delta = detectSpanishExperienceSemanticDelta(
      'Preparó archivos finales de diseño.',
      'Preparó archivos finales de alta calidad.',
    );
    expect(delta.kinds).toContain('quality_claim');
  });
});

describe('AAB-316 complete vs incomplete evidence', () => {
  it('treats Rewitu and Atlas complete bullets as not incomplete', () => {
    expect(countIncompleteSpanishUnits(REWITU_PAST)).toBe(0);
    expect(countIncompleteSpanishUnits(ATLAS_PAST)).toBe(0);
  });

  it('marks a real dangling fragment incomplete', () => {
    expect(countIncompleteSpanishUnits('Revisó la mercancía y')).toBeGreaterThan(0);
  });

  it('never authorizes incomplete_bullet_completed from length growth alone', () => {
    const vis = evaluateExperienceVisibleComparison({
      factAuthorityText: REWITU_PAST,
      visibleComparisonText: REWITU_PAST,
      candidateText: REWITU_BAD_PROVIDER,
      locale: 'es',
      useVisibleForNoOp: true,
      capturedAtRequest: true,
      isPresent: false,
    });
    expect(vis.materialImprovementKinds).not.toContain('incomplete_bullet_completed');
  });
});

describe('AAB-316 single finalizer / Rewitu fixture', () => {
  it('analyzes Rewitu completed source as already valid', () => {
    const analysis = analyzeExperienceVisibleSource({
      visibleText: REWITU_PAST,
      targetLocale: 'es',
      isPresent: false,
    });
    expect(analysis.sourceAlreadyValidForTarget).toBe(true);
    expect(analysis.correctableDefectCount).toBe(0);
    expect(analysis.incompleteUnitCount).toBe(0);
    expect(analysis.sourcePredicateIdentityCount).toBe(3);
  });

  it('rejects bad Rewitu provider via validator and conservative finalizer', () => {
    const validation = validateSpanishExperienceCandidate({
      factAuthorityText: REWITU_PAST,
      candidateText: REWITU_BAD_PROVIDER,
      candidateOrigin: 'provider',
    });
    expect(validation.candidateValid).toBe(false);
    expect(validation.unsupportedCount).toBeGreaterThan(0);

    const cons = finalizeSpanishExperienceCandidate({
      factAuthorityText: REWITU_PAST,
      visibleComparisonText: REWITU_PAST,
      providerCandidateText: REWITU_BAD_PROVIDER,
      isPresent: false,
      sourceAlreadyValidForTarget: true,
      sourceCorrectableDefectCount: 0,
    });
    expect(cons.decision.shouldApply).toBe(false);
    expect(cons.decision.shouldIncrementUsage).toBe(false);
    expect(cons.decision.materialImprovement).toBe(false);
    expect(cons.decision.materialImprovementKinds)
      .not.toContain('incomplete_bullet_completed');
    expect(cons.decision.selectedText).toBe(REWITU_PAST);
  });

  it('alias and conservative finalizer are the same path', () => {
    const a = finalizeSpanishExperienceCandidate({
      factAuthorityText: REWITU_PAST,
      visibleComparisonText: REWITU_PAST,
      providerCandidateText: REWITU_BAD_PROVIDER,
      isPresent: false,
    });
    const b = finalizeSpanishExperienceCandidateConservatively({
      factAuthorityText: REWITU_PAST,
      visibleComparisonText: REWITU_PAST,
      providerCandidateText: REWITU_BAD_PROVIDER,
      isPresent: false,
    });
    expect(a.decision.shouldApply).toBe(b.decision.shouldApply);
    expect(a.decision.finalDecisionKind).toBe(b.decision.finalDecisionKind);
  });

  it('end-to-end finalizeCvAiFieldForApply preserves Rewitu source (+0)', () => {
    const cv = rewituFixture(REWITU_PAST);
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: REWITU_PAST,
      locale: 'es',
      requestId: 'req-316-rewitu',
      jobContextHash: 'j',
      experienceEntryId: 'exp-rewitu',
      authoritativeTextOverride: REWITU_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: REWITU_BAD_PROVIDER,
      experienceId: 'exp-rewitu',
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.text.trim()).toBe(REWITU_PAST.trim());
    expect(result.diagnostics?.materialImprovementDetected).not.toBe(true);
    expect(result.diagnostics?.materialImprovementKinds || [])
      .not.toContain('incomplete_bullet_completed');
  });
});

describe('AAB-316 Atlas tense regression', () => {
  it('still applies minimal past→present via finalizer when provider is unsafe', () => {
    const cons = finalizeSpanishExperienceCandidate({
      factAuthorityText: ATLAS_PAST,
      visibleComparisonText: ATLAS_PAST,
      providerCandidateText: REWITU_BAD_PROVIDER,
      isPresent: true,
      sourceAlreadyValidForTarget: false,
      sourceCorrectableDefectCount: 1,
    });
    expect(cons.decision.shouldApply).toBe(true);
    expect(cons.decision.materialImprovementKinds).toContain('wrong_tense_fixed');
    expect(cons.decision.selectedText).toContain('Revisa');
    expect(cons.decision.selectedText).toContain('Comprueba');
    expect(cons.decision.selectedText).toContain('Coordina');
  });

  it('end-to-end Atlas past→present still applies', () => {
    const cv = atlasFixture(ATLAS_PAST);
    const snap = createExperienceAiOperationSnapshot({
      experience: cv.experience[0],
      liveText: ATLAS_PAST,
      locale: 'es',
      requestId: 'req-316-atlas',
      jobContextHash: 'j',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: ATLAS_PAST,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: ATLAS_PRESENT,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      operationSnapshot: snap,
    });
    expect(result.countedAsSuccess).toBe(true);
    expect(result.text).toContain('Revisa');
    expect(result.diagnostics?.materialImprovementKinds || [])
      .toContain('wrong_tense_fixed');
  });
});

describe('AAB-316 already-valid source no-op', () => {
  it('forbids material improvement when source already valid', () => {
    const decision = decideSpanishExperienceFinalCandidate({
      factAuthorityText: REWITU_PAST,
      visibleComparisonText: REWITU_PAST,
      candidateText: formatExperienceBullets([
        'Creó materiales visuales y elementos gráficos creativos.',
        'Revisó y adaptó materiales de diseño gráfico.',
        'Preparó archivos finales de diseño para distintos formatos y pantallas.',
      ]),
      candidateOrigin: 'provider',
      isPresent: false,
      sourceAlreadyValidForTarget: true,
      sourceCorrectableDefectCount: 0,
    });
    expect(decision.shouldApply).toBe(false);
    expect(decision.materialImprovement).toBe(false);
  });
});
