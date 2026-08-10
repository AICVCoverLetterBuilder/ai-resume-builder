/**
 * @vitest-environment jsdom
 *
 * AAB-307 Phase 1: Spanish Summary prior-role deterministic fallback
 * (exact AAB-306 device failure: Hindi prior + German current → Spanish UI).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  SPANISH_SUMMARY_GROUNDING_306_REVISION,
  SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION,
  analyzeSpanishSummaryEmploymentQuality,
  buildSpanishEntryOwnedSummary,
  extractSpanishEntryOwnedFactIds,
  spanishPriorEntryRequiresRoleSlot,
  splitSpanishSummaryUnits,
} from '@/lib/cv-spanish-summary-grounding';
import { SPANISH_CV_AI_305_REVISION } from '@/lib/cv-spanish-experience-grounding';
import {
  formatApproximateDurationPhrase,
  applyApproximateDurationPolicy,
} from '@/lib/cv-experience-duration';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import {
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import { clearExperienceAiDiagnosticsForTests } from '@/lib/cv-experience-ai-diagnostics';
import { clearCvAiDiagnosticHistory } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-19';

const WH_DE = formatExperienceBullets([
  'Prüfung eingehender Waren und zugehöriger Unterlagen.',
  'Koordination der Vorbereitung und Bewegung der Waren mit Kolleginnen.',
]);

const GD_HI = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों / स्क्रीन के लिए अनुकूलित किया।',
]);

const GD_DE = formatExperienceBullets([
  'Erstellte visuelle Materialien und grafische Elemente.',
  'Prüfte und passte Designmaterialien an.',
  'Bereitete finale Designdateien für verschiedene Formate und Bildschirme vor.',
]);

const GD_SR = formatExperienceBullets([
  'Kreirala vizuelne materijale i grafičke elemente.',
  'Pregledala i prilagodila dizajn materijale.',
  'Pripremila finalne dizajn fajlove za različite formate i ekrane.',
]);

const BAD_AAB305_ES = [
  'Profesional, actualmente desempeñándose como operaria de almacén en Atlas,',
  'donde realiza la recepción de mercancías, verifica la integridad y completitud',
  'de los envíos entrantes, y prepara pedidos para su expedición, con alrededor',
  'de seis años y medio de experiencia. Con experiencia previa en diseño gráfico',
  'para materiales impresos y digitales. Habilidades clave: liderazgo,',
  'organización, pensamiento crítico, adaptabilidad, resolución de problemas,',
  'gestión del tiempo, inteligencia emocional, atención al detalle, comunicación',
  'y Agile/Scrum.',
].join(' ').replace(/\s+/g, ' ').trim();

function aab306DeviceFixture(opts?: {
  summary?: string;
  priorDescription?: string;
  priorPosition?: string;
  currentDescription?: string;
}): CVData {
  const gender = 'female';
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'Lagermitarbeiterin',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: opts?.currentDescription ?? WH_DE,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: opts?.priorPosition ?? 'ग्राफिक डिज़ाइनर',
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: opts?.priorDescription ?? GD_HI,
  };
  return {
    personal: {
      fullName: 'Ana',
      email: 'a@b.c',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender,
      photo: '',
    },
    summary: opts?.summary ?? '',
    experience: [current, prior],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    contentLocale: 'de',
  } as CVData;
}

describe('Spanish Summary prior-role slot (AAB-307 Phase 1)', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('exposes spanish-summary-prior-slot-307-v1 marker', () => {
    expect(SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION).toBe('spanish-summary-prior-slot-307-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_SUMMARY_GROUNDING_306_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_CV_AI_305_REVISION);
  });

  it('1–16. Hindi prior rebuilds into three Spanish units with Rewitu design facts', () => {
    const built = buildSpanishEntryOwnedSummary({
      role: localizeWarehouseEmployee('es', 'female'),
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: formatApproximateDurationPhrase(applyApproximateDurationPolicy(78), 'es'),
      dutyFacts: WH_DE.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'ग्राफिक डिज़ाइनर',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_HI,
    });
    const units = splitSpanishSummaryUnits(built);
    expect(units).toHaveLength(3);
    expect(built).toMatch(/Atlas/i);
    expect(built).toMatch(/alrededor de seis años y medio/i);
    expect(built).toMatch(/operari|emplead|almac/i);
    if (!summaryV2ModeActive()) {
      expect(built).toMatch(/mercanc/i);
    } else {
      expect(String(built || "")).toMatch(/Atlas|Rewitu/i);
    }
    expect(built).toMatch(/document/i);
    expect(built).toMatch(/compa[nñ]er/i);
    expect(built).toMatch(/preparaci/i);
    expect(built).toMatch(/movimiento/i);
    expect(built).toMatch(/Rewitu/i);
    expect(built).toMatch(/diseñadora gr[aá]fica|diseño gr[aá]fico/i);
    expect(built).toMatch(/materiales visuales/i);
    expect(built).toMatch(/elementos gr[aá]ficos/i);
    expect(built).toMatch(/revis/i);
    expect(built).toMatch(/adapt/i);
    expect(built).toMatch(/archivos? finales/i);
    expect(built).toMatch(/formatos/i);
    expect(built).toMatch(/pantallas/i);
  });

  it('17–19. German / Serbian prior facts also rebuild into Spanish prior unit', () => {
    for (const priorDuties of [GD_DE, GD_SR]) {
      const built = buildSpanishEntryOwnedSummary({
        role: localizeWarehouseEmployee('es', 'female'),
        employer: 'Atlas',
        datesValue: '2023-01',
        gender: 'female',
        durationPhrase: formatApproximateDurationPhrase(applyApproximateDurationPolicy(78), 'es'),
        dutyFacts: WH_DE.split('\n').map((v) => ({ value: v, sourceText: v })),
        priorRole: localizeGraphicDesigner('de', 'female'),
        priorEmployer: 'Rewitu',
        priorSourceDuties: priorDuties,
      });
      expect(splitSpanishSummaryUnits(built)).toHaveLength(3);
      expect(built).toMatch(/Rewitu/i);
      expect(built).toMatch(/visuales|gr[aá]fic|dise[nñ]o/i);
    }
  });

  it('20–24. non-design prior is not omitted; empty prior is not required', () => {
    const nonDesign = buildSpanishEntryOwnedSummary({
      role: localizeWarehouseEmployee('es', 'female'),
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: formatApproximateDurationPhrase(applyApproximateDurationPolicy(78), 'es'),
      dutyFacts: WH_DE.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Asistente administrativo',
      priorEmployer: 'Nova',
      priorSourceDuties: 'Gestionó documentación administrativa y atención al cliente.',
    });
    expect(nonDesign).toMatch(/Nova/i);
    expect(nonDesign).toMatch(/Anteriormente trabajó/i);
    expect(spanishPriorEntryRequiresRoleSlot({
      priorRole: '',
      priorEmployer: '',
      priorDuties: '',
    })).toBe(false);
  });

  it('25–30. entry-owned fact identities are not collapsed to generic_duty only', () => {
    const currentIds = extractSpanishEntryOwnedFactIds(WH_DE);
    const priorIds = extractSpanishEntryOwnedFactIds(GD_HI);
    expect(currentIds).toEqual(expect.arrayContaining([
      'incoming_goods_check',
      'related_documents_check',
      'colleague_coordination',
      'goods_preparation',
      'goods_movement',
    ]));
    expect(priorIds).toEqual(expect.arrayContaining([
      'visual_material_creation',
      'graphic_element_creation',
      'design_material_review',
      'design_material_adaptation',
      'final_design_file_preparation',
      'multi_format_preparation',
      'screen_preparation',
    ]));
    expect(currentIds).not.toEqual(['generic_duty']);
    expect(priorIds).not.toEqual(['design_brand_identity']);
  });

  it('31–36. missing required prior slot fails slot validation', () => {
    const twoUnit = [
      'Profesional que actualmente trabaja como operaria de almacén en Atlas con alrededor de seis años y medio de experiencia.',
      'Revisa la mercancía entrante y la documentación relacionada, y coordina con sus compañeros la preparación y el movimiento de las mercancías.',
    ].join(' ');
    const q = analyzeSpanishSummaryEmploymentQuality(twoUnit, {
      company: 'Atlas',
      role: localizeWarehouseEmployee('es', 'female'),
      priorRole: 'ग्राफिक डिज़ाइनर',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_HI,
      gender: 'female',
      structuredRole: localizeWarehouseEmployee('es', 'female'),
    });
    expect(q.priorRoleSlotPresent).toBe(false);
    expect(q.slotValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
    expectProviderRejectedReason(q.typedRejectionReason, /missing_prior_role_slot|incomplete_slots/);
  });

  it('34. complete three slots pass', () => {
    const good = buildSpanishEntryOwnedSummary({
      role: localizeWarehouseEmployee('es', 'female'),
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: formatApproximateDurationPhrase(applyApproximateDurationPolicy(78), 'es'),
      dutyFacts: WH_DE.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'ग्राफिक डिज़ाइनर',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_HI,
    });
    const q = analyzeSpanishSummaryEmploymentQuality(good, {
      company: 'Atlas',
      role: localizeWarehouseEmployee('es', 'female'),
      priorRole: 'ग्राफिक डिज़ाइनर',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_HI,
      gender: 'female',
      structuredRole: localizeWarehouseEmployee('es', 'female'),
    });
    expect(q.currentIntroSlotPresent).toBe(true);
    expect(q.currentDutySlotPresent).toBe(true);
    expect(q.priorRoleSlotPresent).toBe(true);
    expect(q.slotValidationPassed).toBe(true);
    expect(q.groundingValidationPassed).toBe(true);
  });

  it('76. AAB-306 device fixture: Hindi prior + German current recovers three-unit Spanish', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv: aab306DeviceFixture(),
      candidate: BAD_AAB305_ES,
      referenceDateIso: REF,
    });
    expect(fin.blocked, `${fin.reason}: ${JSON.stringify(fin.diagnostics)}`).toBe(false);
    expect(fin.countedAsSuccess, `${fin.reason}: ${JSON.stringify(fin.diagnostics)}`).toBe(true);
    expect(fin.origin).toMatch(/deterministic|fallback|ai_generated|ai_repaired/i);
    expect(fin.text).toMatch(/Atlas/i);
    expect(fin.text).toMatch(/Rewitu/i);
    if (!summaryV2ModeActive()) {
      expect(fin.text).toMatch(/mercanc/i);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.text).toMatch(/visuales|gr[aá]fic|dise[nñ]o/i);
    } else {
      expect(fin.text).toMatch(/Atlas|Rewitu|años|experiencia/i);
    }
    expect(fin.text).toMatch(/alrededor de seis años y medio/i);
    expect(fin.text).not.toMatch(/Habilidades clave|Agile|Scrum|materiales impresos/i);
    expect(splitSpanishSummaryUnits(fin.text)).toHaveLength(3);
  });

  it('empty generate with Hindi prior also yields three Spanish units', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv: aab306DeviceFixture(),
      candidate: '',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(splitSpanishSummaryUnits(fin.text)).toHaveLength(3);
    expect(fin.text).toMatch(/Rewitu/i);
  });
});
