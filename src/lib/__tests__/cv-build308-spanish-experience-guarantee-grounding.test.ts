/**
 * @vitest-environment jsdom
 *
 * AAB-308 Spanish Experience guarantee / assurance / responsibility grounding.
 * Fixture strings live only in tests — runtime must not hardcode Atlas/Rewitu.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  SPANISH_CV_AI_305_REVISION,
  SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION,
  detectSpanishExperienceUnsupportedExpansion,
  stripSpanishExperienceGuaranteeEscalation,
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
import {
  EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
  resolveExperienceTextareaProvenance,
  refreshProvenanceAfterMaterialUserEdit,
} from '@/lib/cv-experience-ai-output-provenance';

const REF = '2026-07-19';

const WH_ES = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

const BAD_AAB307 = formatExperienceBullets([
  'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
  'Comprueba la documentación relacionada con cada envío recibido.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const GOOD_SAFE = formatExperienceBullets([
  'Revisa la mercancía entrante en el almacén.',
  'Comprueba la documentación relacionada con la mercancía recibida.',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
]);

const SOURCE_SUPPORTED_GUARANTEE = formatExperienceBullets([
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
  currentProvenance?: string;
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
    canonicalDescription: currentDesc,
    descriptionOrigin: 'user',
    generatedLocale: 'es',
    ...(opts?.currentProvenance
      ? { experienceAiOutputProvenance: opts.currentProvenance }
      : {}),
  } as WorkExperience;
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', 'female'),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: opts?.priorDesc ?? GD_ES_COMPLETED,
    originalUserDescription: opts?.priorDesc ?? GD_ES_COMPLETED,
    canonicalDescription: opts?.priorDesc ?? GD_ES_COMPLETED,
    descriptionOrigin: 'user',
    generatedLocale: 'es',
  };
  return {
    id: 'cv-es-308',
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

describe('Spanish Experience guarantee grounding (AAB-308)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearCvAiDiagnosticHistory();
    localStorage.clear();
  });

  it('exposes spanish-experience-guarantee-grounding-308-v1 marker', () => {
    expect(SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION)
      .toBe('spanish-experience-guarantee-grounding-308-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_CV_AI_305_REVISION);
  });

  it('1-13: exact AAB-307 and guarantee/assurance matrix rejected when absent from source', () => {
    const cases = [
      BAD_AAB307,
      formatExperienceBullets([
        'Revisa la mercancía entrante para garantizar su correcta recepción.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Revisa la mercancía entrante para asegurar la correcta recepción.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Garantiza el correcto procesamiento de la mercancía entrante.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Asegura la correcta gestión de la mercancía entrante.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Garantiza la integridad de los envíos recibidos.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Asegura la exactitud de la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Garantiza la completitud de los registros relacionados.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Garantiza el cumplimiento de los procedimientos de recepción.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Comprueba la documentación relacionada.',
        'Asegura la preparación adecuada de la mercancía con sus compañeros.',
      ]),
      formatExperienceBullets([
        'Revisa la mercancía entrante.',
        'Comprueba la documentación relacionada.',
        'Garantiza el movimiento correcto de la mercancía con sus compañeros.',
      ]),
      formatExperienceBullets([
        'Se responsabiliza de toda la recepción de mercancía entrante.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      formatExperienceBullets([
        'Vela por la correcta ejecución de la recepción de mercancía.',
        'Comprueba la documentación relacionada.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
    ];
    for (const candidate of cases) {
      const result = scan(WH_ES, candidate);
      expect(result.count).toBeGreaterThan(0);
      expect(
        result.kinds.some((k) =>
          k === 'guarantee_escalation'
          || k === 'assurance_escalation'
          || k === 'responsibility_escalation'
          || k === 'outcome_ownership'
          || k === 'quality_guarantee'
          || k === 'completeness_guarantee'
          || k === 'compliance_guarantee'
          || k === 'organization_responsibility_claim'),
      ).toBe(true);
      expect(result.kinds.length).toBe(result.count);
    }
    const aab = scan(WH_ES, BAD_AAB307);
    expect(aab.kinds).toContain('guarantee_escalation');
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, BAD_AAB307).ok).toBe(true);
  });

  it('14-16: source-supported guarantee/assurance/quality responsibility preserved', () => {
    expect(scan(SOURCE_SUPPORTED_GUARANTEE, SOURCE_SUPPORTED_GUARANTEE).count).toBe(0);
    const assuranceSrc = formatExperienceBullets([
      'Asegura la calidad del proceso de entrada de mercancías.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(assuranceSrc, assuranceSrc).count).toBe(0);
    const qualitySrc = formatExperienceBullets([
      'Es responsable de asegurar la integridad de los envíos.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    expect(scan(qualitySrc, qualitySrc).count).toBe(0);
  });

  it('17-20: similar object does not authorize stronger predicate; coverage separate', () => {
    const stronger = formatExperienceBullets([
      'Garantiza la recepción de la mercancía entrante.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    const result = scan(WH_ES, stronger);
    expect(result.count).toBeGreaterThan(0);
    expect(result.kinds).toContain('guarantee_escalation');
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, stronger).covered.length).toBeGreaterThan(0);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB307,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerRejectionStage).toMatch(/unsupported_claim_validation/);
    expect(fin.diagnostics?.providerRejectionReason).toBeTruthy();
    expect((fin.diagnostics?.providerUnsupportedClaimCount ?? 0)).toBeGreaterThan(0);
    expect(fin.diagnostics?.providerUnsupportedClaimKinds || []).toEqual(
      expect.arrayContaining(['guarantee_escalation']),
    );
  });

  it('21-26: repair/fallback removes guarantee; terminal failure preserves source', () => {
    const repaired = stripSpanishExperienceGuaranteeEscalation(BAD_AAB307, WH_ES);
    expect(repaired).not.toMatch(/garantiz|asegur/i);
    expect(scan(WH_ES, repaired).count).toBe(0);
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, repaired).ok).toBe(true);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB307,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).not.toMatch(/garantiz|asegur|correcta recepción/i);
    expect(fin.text).toMatch(/mercancía entrante/i);
    expect(fin.text).toMatch(/documentaci[oó]n/i);
    expect(fin.text).toMatch(/compa[nñ]eros/i);
    expect(fin.text).toMatch(/preparaci[oó]n/i);
    expect(fin.text).toMatch(/movimiento/i);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalUnsupportedClaimCount ?? 0).toBe(0);
    expect(['unsupported_claim_repair', 'deterministic_fallback', 'noop_repair']).toContain(
      fin.diagnostics?.finalCandidateSource,
    );
    expect(fin.countedAsSuccess).toBe(true);

    const fb = buildSpanishWarehouseExperienceFallback({
      sourceDescription: WH_ES,
      isPresent: true,
    });
    expect(fb).not.toMatch(/garantiz|asegur/i);
    expect(scan(WH_ES, fb).count).toBe(0);

    // Invalid repair echo that still escalates → terminal when no recovery path
    // (force origin that already consumed repair + non-warehouse source).
    const nonWhSource = formatExperienceBullets([
      'Atiende consultas de clientes por correo.',
      'Registra incidencias en la herramienta interna.',
      'Prepara informes semanales de seguimiento.',
    ]);
    const badNonWh = formatExperienceBullets([
      'Garantiza la correcta atención de todas las consultas de clientes.',
      'Asegura la exactitud de cada incidencia registrada.',
      'Garantiza el cumplimiento puntual de los informes semanales.',
    ]);
    expect(scan(nonWhSource, badNonWh).count).toBeGreaterThan(0);
    const terminal = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ currentDesc: nonWhSource }),
      candidate: badNonWh,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      noOpRepairAttempted: true,
      originHint: 'ai_repaired',
    });
    if (terminal.countedAsSuccess) {
      expect(terminal.text).not.toMatch(/garantiz|asegur/i);
      expect(scan(nonWhSource, terminal.text).count).toBe(0);
    } else {
      expect(terminal.blocked).toBe(true);
      expect(terminal.countedAsSuccess).toBe(false);
      expect(terminal.diagnostics?.finalCandidateSource === 'none'
        || !terminal.diagnostics?.finalCandidateSource).toBe(true);
      expect(terminal.text).toBe(nonWhSource);
    }
  });

  it('27-34: present tense, stable entry, provenance, textarea authority', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({
        currentDesc: WH_ES,
      }),
      candidate: BAD_AAB307,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/revisa|comprueba|coordina/i);
    expect(fin.text).not.toMatch(/\brevisó\b|\bcomprobó\b|\bcoordinó\b/i);

    const cv = spanishFixture();
    const otherBefore = cv.experience.find((e) => e.id === 'exp-rewitu')!.description;
    expect(fin.text).not.toBe(otherBefore);

    void EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
    const edited = refreshProvenanceAfterMaterialUserEdit(
      {
        ...cv.experience[0]!,
        descriptionOrigin: 'ai',
        generatedDescription: GOOD_SAFE,
        aiOutputProvenance: {
          revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
          experienceEntryId: 'exp-atlas',
          lastAiOutputNormalizedHash: 'x',
          lastAiOutputRawHash: 'x',
          preAiFactSnapshotNormalizedHash: '',
          preAiFactIdentityHashes: [],
          preAiFactSnapshotText: '',
          sourceLocale: 'es',
          targetLocale: 'es',
          operationMode: 'enhance_existing_description',
          sourceAuthorityKind: 'current_textarea',
          appliedAt: REF,
          requestHash: null,
          generatedFromEmpty: false,
        },
      } as WorkExperience,
      WH_ES,
    );
    const prov = resolveExperienceTextareaProvenance({
      ...edited,
      description: WH_ES,
    });
    expect(prov.authoritativeFactSourceKind).toBe('current_textarea');
    expect(
      prov.currentTextareaProvenance === 'ai_generated_user_edited'
      || prov.currentTextareaProvenance === 'user_authored',
    ).toBe(true);
  });

  it('28: completed Spanish Experience is not forced into present tense', () => {
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
    expect(fin.text).not.toMatch(/garantiz|asegur|print|branding|Photoshop|lider/i);
  });

  it('35-36: good provider accepted; good re-run is no-op +0', () => {
    const good = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ currentDesc: WH_ES }),
      candidate: GOOD_SAFE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(good.countedAsSuccess).toBe(true);
    expect(good.text).not.toMatch(/garantiz|asegur/i);
    expect(scan(WH_ES, good.text).count).toBe(0);

    const again = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ currentDesc: good.text }),
      candidate: good.text,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(again.countedAsSuccess).toBe(false);
    expect(again.diagnostics?.finalCandidateSource === 'none'
      || again.blocked).toBe(true);
  });

  it('37-39: empty generation safe; arbitrary duties not over-rejected; source quality kept', () => {
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
    expect(empty.text).not.toMatch(/garantiz|asegur|SAP|Photoshop/i);

    const bakery = formatExperienceBullets([
      'Prepara masas y panadería artesanal.',
      'Controla tiempos de fermentación.',
      'Atiende el mostrador en horarios de punta.',
    ]);
    expect(scan(bakery, bakery).count).toBe(0);

    const withQuality = formatExperienceBullets([
      'Revisa la mercancía entrante con control de calidad.',
      'Comprueba la documentación relacionada.',
      'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
    ]);
    const keep = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture({ currentDesc: withQuality }),
      candidate: formatExperienceBullets([
        'Revisa la mercancía entrante con control de calidad en el almacén.',
        'Comprueba la documentación relacionada con los envíos.',
        'Coordina con sus compañeros la preparación y el movimiento de la mercancía.',
      ]),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    if (keep.countedAsSuccess) {
      expect(keep.text).toMatch(/calidad/i);
    }
  });

  it('AAB-307 regression: provider rejected; repair/fallback applied once', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB307,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerRejectionStage).toBe('unsupported_claim_validation');
    expect((fin.diagnostics?.providerUnsupportedClaimCount ?? 0)).toBeGreaterThan(0);
    expect(fin.diagnostics?.providerUnsupportedClaimKinds || []).toEqual(
      expect.arrayContaining(['guarantee_escalation']),
    );
    expect(fin.text).not.toMatch(/garantiz|asegur|correcta recepción/i);
    expect(validateSpanishWarehouseExperienceCoverage(WH_ES, fin.text).ok).toBe(true);
    expect(fin.diagnostics?.finalUnsupportedClaimCount ?? 0).toBe(0);
    expect(['unsupported_claim_repair', 'deterministic_fallback', 'noop_repair']).toContain(
      fin.diagnostics?.finalCandidateSource,
    );
  });
});
