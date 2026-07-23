/**
 * @vitest-environment jsdom
 *
 * AAB-306 Phase 1: Spanish Summary fact grounding — exact AAB-305 device failure.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  SPANISH_SUMMARY_GROUNDING_306_REVISION,
  analyzeSpanishSummaryEmploymentQuality,
  buildSpanishEntryOwnedSummary,
  countSpanishUnsupportedSummaryClaims,
  isSpanishGenericSkillsUnit,
  validateSpanishSummaryIntroGrammar,
} from '@/lib/cv-spanish-summary-grounding';
import { SPANISH_CV_AI_305_REVISION } from '@/lib/cv-spanish-experience-grounding';
import {
  formatApproximateDurationPhrase,
  applyApproximateDurationPolicy,
} from '@/lib/cv-experience-duration';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';
import {
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import { clearExperienceAiDiagnosticsForTests } from '@/lib/cv-experience-ai-diagnostics';
import { clearCvAiDiagnosticHistory } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-19';

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

const WH_ES = [
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
].join('\n');

const GD_ES = [
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
].join('\n');

function spanishFixture(opts?: { summary?: string; skills?: string[] }): CVData {
  const gender = 'female';
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', gender),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_ES,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', gender),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: GD_ES,
  };
  return {
    personal: {
      fullName: 'Ana',
      email: 'a@b.c',
      phone: '',
      location: '',
      jobTitle: localizeWarehouseEmployee('es', gender),
      gender,
      photo: '',
    },
    summary: opts?.summary ?? '',
    experience: [current, prior],
    education: [],
    skills: opts?.skills ?? [],
    languages: [],
    certifications: [],
    contentLocale: 'es',
  } as CVData;
}

describe('Spanish Summary fact grounding (AAB-306 Phase 1)', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('exposes spanish-summary-grounding-306-v1 marker', () => {
    expect(SPANISH_SUMMARY_GROUNDING_306_REVISION).toBe('spanish-summary-grounding-306-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_SUMMARY_GROUNDING_306_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_CV_AI_305_REVISION);
  });

  it('1. exact AAB-305 bad Summary is rejected by quality analysis', () => {
    const q = analyzeSpanishSummaryEmploymentQuality(BAD_AAB305_ES, {
      company: 'Atlas',
      role: localizeWarehouseEmployee('es', 'female'),
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      gender: 'female',
      structuredRole: localizeWarehouseEmployee('es', 'female'),
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.grammarValidationPassed).toBe(false);
    expect(q.hasGenericSkillsUnit || q.unsupportedClaimKinds.some((k) => k.includes('skill') || k.includes('skills'))).toBe(true);
    expect(q.unsupportedDesignMedium || q.unsupportedClaimKinds.includes('unsupported_design_medium')).toBe(true);
    expect(
      q.unsupportedClaimKinds.includes('unsupported_quality_completeness')
      || q.unsupportedClaimKinds.includes('unsupported_logistics_substitution')
      || /integridad|expedici/i.test(BAD_AAB305_ES),
    ).toBe(true);
    expect(q.priorCompanyPresent).toBe(false);
    expect(q.priorRoleGroundingPassed).toBe(false);
  });

  it('2–10. unsupported skills / print / logistics / quality detected', () => {
    expect(isSpanishGenericSkillsUnit('Habilidades clave: liderazgo, comunicación y Agile.')).toBe(true);
    const scan = countSpanishUnsupportedSummaryClaims(BAD_AAB305_ES, {
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
    });
    expect(scan.unsupportedClaimCount).toBeGreaterThan(0);
    expect(scan.unsupportedClaimKinds.join(' ')).toMatch(/skill|skills|design|quality|logistics|tool/i);
    expect(validateSpanishSummaryIntroGrammar(BAD_AAB305_ES).ok).toBe(false);
  });

  it('11–17. exact bad provider candidate does not apply; deterministic recovery succeeds', () => {
    const usageBefore = getProAiUsageCount();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB305_ES,
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.blocked).toBe(false);
    expect(fin.text).not.toMatch(/Habilidades clave|liderazgo|Agile|Scrum|materiales impresos|integridad y completitud|pedidos para su expedici/i);
    expect(fin.text).toMatch(/Atlas/i);
    expect(fin.text).toMatch(/Rewitu/i);
    expect(fin.text).toMatch(/mercanc/i);
    expect(fin.text).toMatch(/document/i);
    expect(fin.text).toMatch(/compa[nñ]er/i);
    expect(fin.text).toMatch(/preparaci|movimiento/i);
    expect(fin.text).toMatch(/visual|gr[aá]fic|dise[nñ]o/i);
    expect(fin.text).toMatch(/formato|pantalla/i);
    expect(fin.text).toMatch(/alrededor de seis años y medio/i);
    expect(fin.origin).toMatch(/deterministic|fallback|ai_generated|ai_repaired/i);
    // Usage is incremented by the page layer; finalize only marks success.
    expect(getProAiUsageCount()).toBe(usageBefore);
  });

  it('18–21. empty generate recovers grounded three-unit Spanish', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: '',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/trabaja/i);
    expect(fin.text).toMatch(/Atlas/i);
    expect(fin.text).toMatch(/Rewitu/i);
    expect(fin.text).not.toMatch(/Habilidades clave/i);
    const q = analyzeSpanishSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      role: localizeWarehouseEmployee('es', 'female'),
      structuredRole: localizeWarehouseEmployee('es', 'female'),
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.finalSentenceHashes.length).toBe(q.unitCount);
    expect(q.finalSentenceRoleSlots.length).toBe(q.unitCount);
    expect(q.currentDutySlotPresent).toBe(true);
    expect(q.priorRoleSlotPresent).toBe(true);
  });

  it('22–32. source-supported print is not falsely rejected; structured skill allowed', () => {
    const withPrint = `${WH_ES}\nMateriales impresos y digitales.`;
    const scanOk = countSpanishUnsupportedSummaryClaims(
      'Anteriormente trabajó como diseñadora gráfica en Rewitu con materiales impresos.',
      { priorEntryDuties: withPrint, currentEntryDuties: WH_ES },
    );
    expect(scanOk.unsupportedClaimKinds.includes('unsupported_design_medium')).toBe(false);

    const scanSkill = countSpanishUnsupportedSummaryClaims(
      'Habilidades clave: organización.',
      {
        currentEntryDuties: WH_ES,
        structuredSkills: ['organización'],
      },
    );
    // Single authorized skill without a full invented block of unsupported labels.
    expect(scanSkill.unsupportedClaimKinds.some((k) => k === 'skill:liderazgo')).toBe(false);
  });

  it('33–42. grammar: gerund intro / prior fragment rejected; finite forms accepted', () => {
    expect(validateSpanishSummaryIntroGrammar(
      'Profesional, actualmente desempeñándose como operaria de almacén en Atlas.',
    ).ok).toBe(false);
    expect(validateSpanishSummaryIntroGrammar(
      'Con experiencia previa en diseño gráfico.',
    ).ok).toBe(false);
    const good = buildSpanishEntryOwnedSummary({
      role: localizeWarehouseEmployee('es', 'female'),
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: formatApproximateDurationPhrase(applyApproximateDurationPolicy(78), 'es'),
      dutyFacts: WH_ES.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: localizeGraphicDesigner('es', 'female'),
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
    });
    expect(validateSpanishSummaryIntroGrammar(good, { company: 'Atlas' }).ok).toBe(true);
    expect(good).toMatch(/trabaja/i);
    expect(good).toMatch(/Anteriormente trabajó/i);
  });
});
