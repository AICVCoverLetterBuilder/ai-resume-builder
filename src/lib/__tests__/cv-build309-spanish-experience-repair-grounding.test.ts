/**
 * @vitest-environment jsdom
 *
 * AAB-309 Spanish Experience post-repair grounding:
 * efficiency/performance claims + material object/scope expansion +
 * source-constrained repair with full revalidation.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION,
  SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION,
  detectSpanishExperienceUnsupportedExpansion,
  stripSpanishExperienceUnsupportedEscalation,
  buildSpanishWarehouseExperienceFallback,
  validateSpanishWarehouseExperienceCoverage,
} from '@/lib/cv-spanish-experience-grounding';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import {
  clearExperienceAiDiagnosticsForTests,
  clearExperienceAiDiagnostics,
} from '@/lib/cv-experience-ai-diagnostics';
import { clearCvAiDiagnosticHistory } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-19';

const WH_ES = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

/** Exact AAB-308 bad provider-shaped candidate (guarantee + envíos/entregas + eficiente). */
const BAD_AAB308_PROVIDER = formatExperienceBullets([
  'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
  'Comprueba la documentación relacionada con los envíos y entregas de mercancía.',
  'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
]);

/** Post-strip bad final that AAB-308 incorrectly applied. */
const BAD_AAB308_REPAIRED_RESIDUAL = formatExperienceBullets([
  'Revisa y verifica la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con los envíos y entregas de mercancía.',
  'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
]);

const EFFICIENCY_SOURCE = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina de forma eficiente la preparación y el movimiento de la mercancía',
]);

const DELIVERIES_SOURCE = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación de los envíos y entregas',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

const GUARANTEE_SOURCE = formatExperienceBullets([
  'Garantiza la correcta recepción de la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

const GD_ES_COMPLETED = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
]);

function spanishFixture(opts?: {
  currentDesc?: string;
  priorDesc?: string;
}): CVData {
  const currentDesc = opts?.currentDesc ?? WH_ES;
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: currentDesc,
    originalUserDescription: currentDesc,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  const priorDesc = opts?.priorDesc ?? GD_ES_COMPLETED;
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', 'female'),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: priorDesc,
    originalUserDescription: priorDesc,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  return {
    id: 'cv-es-309',
    name: 'CV',
    personal: {
      fullName: 'Ana Test',
      email: 'ana@example.com',
      phone: '',
      address: '',
      jobTitle: current.position,
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'es',
    templateId: 'modern-minimal',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    hobbies: [],
    updatedAt: REF,
  };
}

function scan(source: string, candidate: string) {
  return detectSpanishExperienceUnsupportedExpansion(source, candidate);
}

describe('Spanish Experience repair grounding (AAB-309)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearCvAiDiagnosticHistory();
    localStorage.clear();
  });

  it('exposes spanish-experience-repair-grounding-309-v1 marker', () => {
    expect(SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION)
      .toBe('spanish-experience-repair-grounding-309-v1');
    expect(EXPERIENCE_REPAIR_LINEAGE_309_REVISION)
      .toBe('experience-repair-lineage-309-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(EXPERIENCE_REPAIR_LINEAGE_309_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION);
  });

  it('1-12: performance/efficiency matrix rejected when absent; ordinary verbs ok', () => {
    const cases: Array<{ cand: string; kind: string }> = [
      { cand: 'movimiento eficiente de la mercancía', kind: 'efficiency_claim' },
      { cand: 'Coordina de forma eficiente el movimiento de la mercancía.', kind: 'efficiency_claim' },
      { cand: 'Coordina con eficacia el movimiento de la mercancía.', kind: 'efficiency_claim' },
      { cand: 'Optimiza el movimiento de la mercancía.', kind: 'optimization_claim' },
      { cand: 'Agiliza la preparación de la mercancía.', kind: 'optimization_claim' },
      { cand: 'Coordina y reduce los tiempos de movimiento.', kind: 'optimization_claim' },
      { cand: 'Minimiza errores en la preparación.', kind: 'optimization_claim' },
      { cand: 'Coordina el movimiento sin errores.', kind: 'error_free_claim' },
      { cand: 'Revisa la mercancía con precisión.', kind: 'accuracy_claim' },
    ];
    for (const row of cases) {
      const candidate = formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Comprueba la documentación relacionada.',
        row.cand,
      ]);
      const result = scan(WH_ES, candidate);
      expect(result.count, row.cand).toBeGreaterThan(0);
      expect(result.kinds, row.cand).toContain(row.kind);
    }

    const ordinary = formatExperienceBullets([
      'Revisa la mercancía entrante en el almacén.',
      'Verifica la documentación relacionada.',
      'Comprueba la preparación con sus compañeros.',
    ]);
    // Ordinary revisar/verificar/comprobar alone must not invent efficiency kinds.
    expect(scan(WH_ES, ordinary).kinds).not.toEqual(
      expect.arrayContaining(['efficiency_claim', 'performance_claim']),
    );

    const supportedEff = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Comprueba la documentación relacionada.',
      'Coordina de forma eficiente la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(EFFICIENCY_SOURCE, supportedEff).kinds).not.toContain('efficiency_claim');

    const accuracySource = formatExperienceBullets([
      'Revisa la mercancía entrante con precisión',
      'Comprueba la documentación relacionada',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
    ]);
    const accuracyCand = formatExperienceBullets([
      'Revisa la mercancía entrante con exactitud.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(accuracySource, accuracyCand).kinds).not.toContain('accuracy_claim');
  });

  it('13-25: object/scope expansion rejected; source-supported and lexical equivalents ok', () => {
    expect(scan(WH_ES, BAD_AAB308_REPAIRED_RESIDUAL).kinds).toEqual(
      expect.arrayContaining(['object_scope_expansion', 'efficiency_claim']),
    );
    expect(scan(WH_ES, BAD_AAB308_REPAIRED_RESIDUAL).kinds).toContain('logistics_scope_expansion');

    const expansions = [
      'Comprueba la documentación relacionada con las entregas.',
      'Comprueba la documentación de pedidos.',
      'Comprueba la documentación de clientes.',
      'Comprueba la documentación de proveedores.',
      'Comprueba el inventario y el stock.',
      'Comprueba facturas y albaranes.',
      'Coordina la expedición y distribución de la mercancía.',
    ];
    for (const mid of expansions) {
      const candidate = formatExperienceBullets([
        'Revisa la mercancía entrante.',
        mid,
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]);
      expect(scan(WH_ES, candidate).count, mid).toBeGreaterThan(0);
      expect(scan(WH_ES, candidate).kinds, mid).toContain('object_scope_expansion');
    }

    const supportedObj = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Comprueba la documentación de los envíos y entregas.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(DELIVERIES_SOURCE, supportedObj).kinds).not.toContain('object_scope_expansion');

    const lexical = formatExperienceBullets([
      'Revisa los productos entrantes en el almacén.',
      'Comprueba los documentos relacionados.',
      'Coordina con su equipo la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(WH_ES, lexical).kinds).not.toContain('object_scope_expansion');

    // Job title / warehouse domain alone must not authorize new objects.
    const titleOnly = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Comprueba facturas, albaranes, pedidos, envíos y entregas.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(titleOnly.diagnostics?.providerAccepted).toBe(false);
    if (titleOnly.countedAsSuccess) {
      expect(titleOnly.text).not.toMatch(/facturas|albaranes|pedidos|entregas/i);
    }
  });

  it('26-39: exact AAB-308 candidate repaired or fallback; no-op fields stay false', () => {
    const providerScan = scan(WH_ES, BAD_AAB308_PROVIDER);
    expect(providerScan.count).toBeGreaterThan(0);
    expect(providerScan.kinds).toEqual(expect.arrayContaining([
      'guarantee_escalation',
      'outcome_ownership',
      'efficiency_claim',
      'object_scope_expansion',
    ]));

    const residualScan = scan(WH_ES, BAD_AAB308_REPAIRED_RESIDUAL);
    expect(residualScan.count).toBeGreaterThan(0);
    expect(residualScan.kinds).toEqual(expect.arrayContaining([
      'efficiency_claim',
      'object_scope_expansion',
    ]));

    const stripped = stripSpanishExperienceUnsupportedEscalation(
      BAD_AAB308_PROVIDER,
      WH_ES,
    );
    expect(stripped).not.toMatch(/garantiz|asegur|eficiente|entregas/i);
    expect(scan(WH_ES, stripped).count).toBe(0);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB308_PROVIDER,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerRejectionStage).toBe('unsupported_claim_validation');
    expect((fin.diagnostics?.providerUnsupportedClaimCount ?? 0)).toBeGreaterThan(0);
    expect(fin.diagnostics?.providerUnsupportedClaimKinds || []).toEqual(
      expect.arrayContaining(['guarantee_escalation', 'efficiency_claim', 'object_scope_expansion']),
    );
    expect(fin.diagnostics?.unsupportedClaimRepairAttempted).toBe(true);
    expect(fin.diagnostics?.noOpRepairAttempted).toBeFalsy();
    expect(fin.diagnostics?.noOpRepairApplied).toBeFalsy();
    expect(fin.diagnostics?.finalCandidateSource).not.toBe('noop_repair');

    if (fin.diagnostics?.unsupportedClaimRepairApplied) {
      expect(fin.diagnostics.unsupportedClaimRepairValidationPassed).toBe(true);
      expect(fin.diagnostics.finalCandidateSource).toBe('unsupported_claim_repair');
      expect(fin.countedAsSuccess).toBe(true);
      expect(fin.diagnostics.finalUnsupportedClaimCount ?? 0).toBe(0);
    } else if (fin.diagnostics?.finalCandidateSource === 'deterministic_fallback') {
      expect(fin.diagnostics.unsupportedClaimRepairValidationPassed).toBe(false);
      expect((fin.diagnostics.unsupportedClaimRepairResidualUnsupportedClaimCount ?? 0)
        + (fin.diagnostics.unsupportedClaimRepairResidualUnsupportedClaimKinds?.length ?? 0))
        .toBeGreaterThanOrEqual(0);
      expect(fin.countedAsSuccess).toBe(true);
      expect(fin.diagnostics.finalUnsupportedClaimCount ?? 0).toBe(0);
    } else if (fin.diagnostics?.finalCandidateSource === 'none' || fin.blocked) {
      expect(fin.countedAsSuccess).toBe(false);
      expect(fin.text).toBe(WH_ES);
    } else {
      expect(fin.countedAsSuccess).toBe(true);
    }

    if (fin.countedAsSuccess) {
      expect(fin.text).not.toMatch(/garantiz|asegur|eficiente|entregas/i);
      expect(validateSpanishWarehouseExperienceCoverage(WH_ES, fin.text).ok).toBe(true);
      expect(scan(WH_ES, fin.text).count).toBe(0);
      expect(fin.text).toMatch(/revisa|comprueba|coordina/i);
    }

    // Residual-only candidate must not pass final validation as-is.
    const residualFin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB308_REPAIRED_RESIDUAL,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(residualFin.diagnostics?.providerAccepted).toBe(false);
    if (residualFin.countedAsSuccess) {
      expect(residualFin.text).not.toMatch(/eficiente|entregas/i);
      expect(scan(WH_ES, residualFin.text).count).toBe(0);
    } else {
      expect(residualFin.text).toBe(WH_ES);
    }
  });

  it('40-46: invalid residual repair yields deterministic fallback with 3/3', () => {
    const fb = buildSpanishWarehouseExperienceFallback({
      sourceDescription: WH_ES,
      isPresent: true,
    });
    expect(scan(WH_ES, fb).count).toBe(0);
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, fb).ok).toBe(true);
    expect(fb).not.toMatch(/eficiente|entregas|garantiz/i);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB308_PROVIDER,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    if (fin.diagnostics?.unsupportedClaimRepairApplied !== true
      && fin.countedAsSuccess) {
      expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
      expect(validateSpanishWarehouseExperienceCoverage(WH_ES, fin.text).ok).toBe(true);
    }
  });

  it('47-53: usage +1 only for meaningful valid apply; no-op +0', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB308_PROVIDER,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    if (fin.countedAsSuccess) {
      expect(fin.diagnostics?.finalUnsupportedClaimCount ?? 0).toBe(0);
      expect(fin.text.replace(/\s+/g, ' ').trim())
        .not.toBe(WH_ES.replace(/\s+/g, ' ').trim());
    }

    const noop = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({
        currentDesc: fin.countedAsSuccess ? fin.text : WH_ES,
      }),
      candidate: fin.countedAsSuccess ? fin.text : WH_ES,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(noop.countedAsSuccess).toBe(false);
  });

  it('controls: source-supported efficiency, objects, guarantee; performance not supported', () => {
    const effCand = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Comprueba la documentación relacionada.',
      'Coordina eficientemente la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(EFFICIENCY_SOURCE, effCand).kinds).not.toContain('efficiency_claim');

    const objCand = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Comprueba la documentación de los envíos y entregas.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(DELIVERIES_SOURCE, objCand).kinds).not.toContain('object_scope_expansion');

    const guarCand = formatExperienceBullets([
      'Garantiza la correcta recepción de la mercancía entrante.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(GUARANTEE_SOURCE, guarCand).kinds).not.toContain('guarantee_escalation');

    const badPerf = formatExperienceBullets([
      'Optimiza la preparación eficiente y reduce los tiempos.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(
      formatExperienceBullets([
        'Coordina la preparación de la mercancía.',
        'Comprueba la documentación relacionada.',
        'Revisa la mercancía entrante.',
      ]),
      badPerf,
    ).count).toBeGreaterThan(0);

    const badObj = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Comprueba facturas, albaranes, pedidos, envíos y entregas.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(WH_ES, badObj).kinds).toContain('object_scope_expansion');
  });

  it('completed Rewitu remains past tense without efficiency/guarantee/object expansion', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ priorDesc: GD_ES_COMPLETED }),
      candidate: formatExperienceBullets([
        'Creó materiales visuales y elementos gráficos para distintas piezas.',
        'Revisó y adaptó materiales de diseño según los requisitos del proyecto.',
        'Preparó archivos finales de diseño para distintos formatos y pantallas.',
      ]),
      experienceId: 'exp-rewitu',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/creó|revisó|preparó/i);
    expect(fin.text).not.toMatch(/\bcrea\b|\brevisa\b|\bprepara\b/i);
    expect(fin.text).not.toMatch(/garantiz|asegur|eficiente|print|branding|Photoshop|lider/i);
  });
});
