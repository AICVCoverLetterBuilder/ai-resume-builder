/**
 * @vitest-environment jsdom
 *
 * AAB-310 Spanish Experience candidate-added predicate grounding.
 * Fixture strings live only in tests — runtime must not hardcode Atlas/Rewitu.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
  EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION,
  SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION,
  detectSpanishExperienceUnsupportedExpansion,
  detectSpanishExperiencePredicateExpansion,
  stripSpanishExperienceUnsupportedEscalation,
  extractSpanishExperiencePredicates,
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

const BAD_AAB309_FINAL = formatExperienceBullets([
  'Revisa y verifica la mercancía entrante en el almacén.',
  'Comprueba y gestiona la documentación relacionada con la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const BAD_PROVIDER = formatExperienceBullets([
  'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
  'Comprueba y gestiona la documentación relacionada con los envíos y entregas de mercancía.',
  'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
]);

const GD_ES_COMPLETED = formatExperienceBullets([
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
]);

function spanishFixture(opts?: { currentDesc?: string; priorDesc?: string }): CVData {
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
    id: 'cv-es-310',
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

describe('Spanish Experience predicate grounding (AAB-310)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearCvAiDiagnosticHistory();
    localStorage.clear();
  });

  it('exposes spanish-experience-predicate-grounding-310-v1 marker', () => {
    expect(SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION)
      .toBe('spanish-experience-predicate-grounding-310-v1');
    expect(EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION)
      .toBe('experience-predicate-repair-lineage-310-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(EXPERIENCE_REPAIR_LINEAGE_309_REVISION);
  });

  it('1-6: exact comprueba y gestiona regression + repair strip', () => {
    const pred = detectSpanishExperiencePredicateExpansion(WH_ES, BAD_AAB309_FINAL);
    expect(pred.candidateAddedPredicateCount).toBeGreaterThan(0);
    expect(pred.unsupportedKinds).toEqual(expect.arrayContaining([
      'action_scope_expansion',
      'document_management_expansion',
    ]));

    const full = scan(WH_ES, BAD_AAB309_FINAL);
    expect(full.count).toBeGreaterThan(0);
    expect(full.kinds).toEqual(expect.arrayContaining([
      'action_scope_expansion',
      'document_management_expansion',
    ]));
    expect(full.candidateAddedPredicateCount ?? 0).toBeGreaterThan(0);

    const stripped = stripSpanishExperienceUnsupportedEscalation(BAD_AAB309_FINAL, WH_ES);
    expect(stripped).not.toMatch(/gestiona/i);
    expect(stripped).toMatch(/comprueba/i);
    expect(stripped).not.toMatch(/revisa y verifica/i);
    expect(scan(WH_ES, stripped).count).toBe(0);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_PROVIDER,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.unsupportedClaimRepairAttempted).toBe(true);
    expect(fin.diagnostics?.noOpRepairAttempted).toBeFalsy();
    expect(fin.diagnostics?.noOpRepairApplied).toBeFalsy();
    if (fin.countedAsSuccess) {
      expect(fin.text).not.toMatch(/gestiona|eficiente|entregas|garantiz/i);
      expect(scan(WH_ES, fin.text).count).toBe(0);
      expect(validateSpanishWarehouseExperienceCoverage(WH_ES, fin.text).ok).toBe(true);
      expect(fin.diagnostics?.finalUnsupportedClaimCount ?? 0).toBe(0);
      expect(['unsupported_claim_repair', 'deterministic_fallback']).toContain(
        fin.diagnostics?.finalCandidateSource,
      );
    } else {
      expect(fin.text).toBe(WH_ES);
    }
  });

  it('7-15: coordinated predicate expansions rejected', () => {
    const cases = [
      'Revisa y archiva la documentación relacionada.',
      'Comprueba y tramita la documentación relacionada.',
      'Verifica y registra la documentación relacionada.',
      'Coordina y supervisa la preparación de la mercancía.',
      'Prepara y distribuye el movimiento de la mercancía.',
      'Revisa y aprueba la documentación relacionada.',
      'Comprueba la documentación antes de autorizar el envío.',
      'Verifica la documentación para certificar la recepción.',
    ];
    for (const mid of cases) {
      const candidate = formatExperienceBullets([
        'Revisa la mercancía entrante.',
        mid,
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]);
      expect(scan(WH_ES, candidate).count, mid).toBeGreaterThan(0);
      expect(scan(WH_ES, candidate).kinds, mid).toContain('action_scope_expansion');
    }
  });

  it('16-23: document management expansions rejected when absent', () => {
    const cases = [
      'Gestiona la documentación relacionada.',
      'Administra la documentación relacionada.',
      'Tramita la documentación relacionada.',
      'Procesa la documentación relacionada.',
      'Archiva documentos relacionados.',
      'Registra datos de la documentación relacionada.',
      'Actualiza registros de la mercancía.',
      'Elabora informes de la mercancía recibida.',
    ];
    for (const mid of cases) {
      const candidate = formatExperienceBullets([
        'Revisa la mercancía entrante.',
        mid,
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]);
      expect(scan(WH_ES, candidate).count, mid).toBeGreaterThan(0);
    }
  });

  it('24-30: source-supported controls + industry does not authorize', () => {
    const manageSource = formatExperienceBullets([
      'Revisa la mercancía entrante',
      'Comprueba y gestiona la documentación relacionada',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
    ]);
    const manageCand = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Revisa y gestiona la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(manageSource, manageCand).kinds).not.toContain('document_management_expansion');

    const processSource = formatExperienceBullets([
      'Revisa la mercancía entrante',
      'Tramita la documentación de la mercancía recibida',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
    ]);
    const processCand = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Gestiona la tramitación de la documentación recibida.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    // gestion/tramit both manage_docs family — should not add unsupported doc-management
    expect(scan(processSource, processCand).kinds).not.toContain('document_management_expansion');

    expect(scan(
      WH_ES,
      formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Comprueba y gestiona la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
    ).kinds).toContain('action_scope_expansion');

    const lexical = formatExperienceBullets([
      'Verifica la mercancía entrante en el almacén.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(WH_ES, lexical).kinds).not.toContain('action_scope_expansion');
  });

  it('31-34: cross-bullet predicate isolation', () => {
    const candidate = formatExperienceBullets([
      'Revisa la mercancía entrante.',
      'Coordina y gestiona la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    const result = scan(WH_ES, candidate);
    expect(result.count).toBeGreaterThan(0);
    expect(result.kinds).toEqual(expect.arrayContaining([
      'action_scope_expansion',
      'document_management_expansion',
    ]));
    // coordinate in bullet 1 must not authorize coordinate+manage on docs bullet
    const pred = detectSpanishExperiencePredicateExpansion(WH_ES, candidate);
    expect(pred.candidateAddedPredicateCount).toBeGreaterThan(0);
  });

  it('49-52: redundant verify synonym stacking collapses', () => {
    const stacked = formatExperienceBullets([
      'Revisa y verifica la mercancía entrante en el almacén.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    const stripped = stripSpanishExperienceUnsupportedEscalation(stacked, WH_ES);
    expect(stripped).toMatch(/revisa la mercancía/i);
    expect(stripped).not.toMatch(/revisa y verifica/i);
    const preds = extractSpanishExperiencePredicates(
      'Revisa y verifica la mercancía entrante',
    );
    expect(preds.every((p) => p.family === 'verify')).toBe(true);
  });

  it('controls + completed Rewitu + empty remain safe', () => {
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
    // AAB-316: completed Rewitu source is already valid — provider restyle/scope
    // additions must not apply or bill.
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.blocked).toBe(true);
    expect(fin.text).toMatch(/creó|revisó|preparó/i);
    expect(fin.text).not.toMatch(/gestiona|supervisa|aprueba|garantiz|eficiente/i);
    expect(fin.text).not.toMatch(/requisitos del proyecto/i);

    const empty = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ currentDesc: '' }),
      candidate: '',
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(empty.countedAsSuccess).toBe(true);
  });
});
