/**
 * AAB-325 — English Summary grounding, locale purity, morphology, recovery.
 */
import { describe, expect, it } from 'vitest';
import {
  ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION,
  ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION,
  ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION,
  SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION,
  detectEnglishMixedLanguageMorphology,
  detectEnglishSourceDutyLeakage,
  scanEnglishSummaryCompetencyClaims,
  analyzeEnglishSummaryDurationScope,
  analyzeEnglishSummaryEmploymentQuality,
  buildEnglishEntryOwnedSummary,
  stripEnglishUnsupportedCompetencyUnits,
} from '@/lib/cv-english-summary-grounding';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { dutyToEnglishGerundFragment } from '@/lib/cv-source-fact-identity';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
} from '@/lib/cv-german-summary-grounding';
import type { CVData } from '@/lib/types';

const WH_ES = [
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
].join('\n');

const GD_ES = [
  'Crea materiales visuales y gráficos',
  'Revisa y adapta documentos de diseño',
  'Prepara archivos de diseño finales para formatos y pantallas',
].join('\n');

/** Exact AAB-324 English device failure. */
const AAB324_EN_BAD = [
  'Warehouse Employee at Atlas since January 2023, with approximately six and a',
  'half years of experience revisingó la mercancía entrante en el almacén,',
  'comprobingó la documentación asociada a la mercancía recibida and coordinating',
  'preparation and movement of goods with colleagues. Key skills include',
  'leadership, organization, critical thinking and adaptability.',
].join(' ');

function englishFixture(summary = ''): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Empleada de almacén',
      gender: 'female',
    },
    summary,
    experience: [
      {
        id: 'atlas',
        position: 'Empleada de almacén',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_ES,
        canonicalDescription: WH_ES,
      },
      {
        id: 'rewitu',
        position: 'Diseñadora gráfica',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_ES,
        canonicalDescription: GD_ES,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'en',
  } as CVData;
}

const analyzeOpts = {
  company: 'Atlas',
  role: 'Empleada de almacén',
  startDate: '2023-01',
  priorCompany: 'Rewitu',
  priorRole: 'Diseñadora gráfica',
  currentEntryDuties: WH_ES,
  priorEntryDuties: GD_ES,
  gender: 'female',
  structuredSkills: [] as string[],
  currentEntryId: 'atlas',
};

describe('AAB-325 English Summary grounding and locale purity', () => {
  it('revision markers reachable', () => {
    expect(ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION).toBe(
      'english-summary-shared-final-gate-325-v1',
    );
    expect(ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION).toBe(
      'english-summary-entity-locale-purity-325-v1',
    );
    expect(ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION).toBe(
      'english-summary-current-prior-coverage-325-v1',
    );
    expect(SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION).toBe(
      'summary-invariant-preapply-gate-325-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION,
    );
  });

  it('1-4. exact AAB-324 malformed output is rejected', () => {
    const q = analyzeEnglishSummaryEmploymentQuality(AAB324_EN_BAD, analyzeOpts);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.mixedLanguageMorphologyDetected).toBe(true);
    expect(q.sourceLanguageLeakageDetected).toBe(true);
    expect(q.targetLocalePurityPassed).toBe(false);
    expect(q.finalPriorEmployerPresent).toBe(false);
    expect(q.finalPriorDutyCoveragePassed).toBe(false);
    expect(q.finalUnsupportedCompetencyCount).toBeGreaterThan(0);
    expect(q.finalDurationCurrentRoleAttachmentRisk).toBe(true);
  });

  it('2-3. revisingó and comprobingó trigger mixed morphology', () => {
    expect(detectEnglishMixedLanguageMorphology('revisingó goods').mixedLanguageMorphologyDetected)
      .toBe(true);
    expect(detectEnglishMixedLanguageMorphology('comprobingó docs').mixedLanguageMorphologyDetected)
      .toBe(true);
  });

  it('4. Spanish duty phrase triggers leakage', () => {
    const leak = detectEnglishSourceDutyLeakage(
      'checking la mercancía entrante en el almacén',
    );
    expect(leak.sourceDutyLeakageDetected).toBe(true);
  });

  it('5-6. detected es / unexpected es forces locale failure', () => {
    const purity = validateAiUnitLocalePurity(
      'Revisó la mercancía entrante en el almacén.',
      'en',
      { kind: 'summary_sentence' },
    );
    expect(purity.unexpectedLocaleCodes.includes('es') || purity.wrongLocaleUnitCount > 0)
      .toBe(true);
    expect(purity.targetLocalePurityPassed).toBe(false);
    expect(purity.sourceLanguageLeakageDetected).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBeGreaterThanOrEqual(1);
  });

  it('7-9. omitted Rewitu / prior role / prior duties reject provider', () => {
    const noPrior = [
      'Warehouse Employee at Atlas since January 2023 with experience checking',
      'incoming goods and the related documentation, and coordinating with',
      'colleagues during the preparation and movement of goods. Overall, she has',
      'approximately six and a half years of professional experience.',
    ].join(' ');
    const q = analyzeEnglishSummaryEmploymentQuality(noPrior, analyzeOpts);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.finalPriorEmployerPresent).toBe(false);
  });

  it('10. unsupported skills sentence rejects provider', () => {
    const scan = scanEnglishSummaryCompetencyClaims(
      'Key skills include leadership, organization, critical thinking and adaptability.',
      [],
    );
    expect(scan.finalUnsupportedCompetencyCount).toBeGreaterThanOrEqual(4);
  });

  it('11. current-role-attached total duration rejects', () => {
    const scope = analyzeEnglishSummaryDurationScope(AAB324_EN_BAD, { company: 'Atlas' });
    expect(scope.finalDurationCurrentRoleAttachmentRisk).toBe(true);
    expect(scope.finalDurationScopeValidationPassed).toBe(false);
  });

  it('13-17. current duties 3/3; Spanish duties do not count', () => {
    const good = buildEnglishEntryOwnedSummary({
      role: 'Empleada de almacén',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'approximately six and a half years',
      dutyFacts: WH_ES.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Diseñadora gráfica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
    });
    const q = analyzeEnglishSummaryEmploymentQuality(good, analyzeOpts);
    expect(q.requiredCurrentDutyFactCount).toBe(3);
    expect(q.coveredCurrentDutyFactCount).toBe(3);
    expect(q.finalCurrentDutyCoveragePassed).toBe(true);
    expect(/revisingó|comprobingó|mercanc/i.test(good)).toBe(false);

    const spanishOnly = analyzeEnglishSummaryEmploymentQuality(
      'Warehouse Employee at Atlas since January 2023 with experience Revisó la mercancía.',
      analyzeOpts,
    );
    expect(spanishOnly.finalCurrentDutyCoveragePassed).toBe(false);
  });

  it('19-23. prior duties 3/3; title/employer alone insufficient', () => {
    const titleOnly = analyzeEnglishSummaryEmploymentQuality(
      [
        'Warehouse Employee at Atlas since January 2023 with experience checking incoming',
        'goods and the related documentation, and coordinating with colleagues during the',
        'preparation and movement of goods. Previously, she worked as a Graphic Designer',
        'at Rewitu. Overall, she has approximately six and a half years of professional',
        'experience.',
      ].join(' '),
      analyzeOpts,
    );
    expect(titleOnly.finalPriorDutyCoveragePassed).toBe(false);
  });

  it('24-29. English locale pass; Spanish role/duty fail; morphology fails', () => {
    const good = buildEnglishEntryOwnedSummary({
      role: 'Empleada de almacén',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'approximately six and a half years',
      dutyFacts: WH_ES.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Diseñadora gráfica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
    });
    expect(analyzeEnglishSummaryEmploymentQuality(good, analyzeOpts).groundingValidationPassed)
      .toBe(true);
    expect(
      analyzeEnglishSummaryEmploymentQuality(
        `${good} Empleada de almacén still here.`,
        analyzeOpts,
      ).groundingValidationPassed,
    ).toBe(false);
  });

  it('30-34. competency grounding', () => {
    const empty = scanEnglishSummaryCompetencyClaims(
      'Key skills include leadership.',
      [],
    );
    expect(empty.finalUnsupportedCompetencyCount).toBeGreaterThanOrEqual(1);
    const authorized = scanEnglishSummaryCompetencyClaims(
      'Key skills include leadership.',
      ['leadership'],
    );
    expect(authorized.finalUnsupportedCompetencyCount).toBe(0);
    const stripped = stripEnglishUnsupportedCompetencyUnits(AAB324_EN_BAD);
    expect(/leadership|adaptability/i.test(stripped)).toBe(false);
  });

  it('35-38. duration ownership', () => {
    const standalone = [
      'Warehouse Employee at Atlas since January 2023 with experience checking incoming',
      'goods and the related documentation, and coordinating with colleagues during the',
      'preparation and movement of goods. Previously, she worked as a Graphic Designer at',
      'Rewitu, creating visual materials, revising design documents and preparing final',
      'files for different formats and screens. Overall, she has approximately six and a',
      'half years of professional experience.',
    ].join(' ');
    const scope = analyzeEnglishSummaryDurationScope(standalone, { company: 'Atlas' });
    expect(scope.finalDurationScopeValidationPassed).toBe(true);
    expect(scope.finalDurationOwnerDetected).toBe('total_professional_experience');
  });

  it('39-45. bad provider recovers via deterministic English fallback', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(''),
      candidate: AAB324_EN_BAD,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    const text = fin.text || '';
    expect(/Warehouse\s+(?:Employee|Worker)/i.test(text)).toBe(true);
    expect(/Atlas/i.test(text)).toBe(true);
    expect(/Graphic\s+Designer/i.test(text)).toBe(true);
    expect(/Rewitu/i.test(text)).toBe(true);
    expect(/Overall/i.test(text)).toBe(true);
    expect(/revisingó|comprobingó|leadership|adaptability|mercanc/i.test(text)).toBe(false);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalUnsupportedCompetencyCount).toBe(0);
    expect(fin.diagnostics?.finalCurrentDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalPriorDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalDurationScopeValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalSlotValidationPassed).toBe(true);
  });

  it('does not morph Spanish source into revisingó', () => {
    expect(dutyToEnglishGerundFragment('Revisó la mercancía entrante')).toBe('');
    expect(dutyToEnglishGerundFragment('Comprobó la documentación')).toBe('');
  });

  it('female/male/unspecified deterministic English', () => {
    for (const gender of ['female', 'male', ''] as const) {
      const text = buildEnglishEntryOwnedSummary({
        role: 'Empleada de almacén',
        employer: 'Atlas',
        datesValue: '2023-01',
        gender,
        durationPhrase: 'approximately six and a half years',
        dutyFacts: WH_ES.split('\n').map((v) => ({ value: v, sourceText: v })),
        priorRole: 'Diseñadora gráfica',
        priorEmployer: 'Rewitu',
        priorSourceDuties: GD_ES,
      });
      expect(analyzeEnglishSummaryEmploymentQuality(text, {
        ...analyzeOpts,
        gender,
      }).groundingValidationPassed).toBe(true);
    }
  });

  it('German AAB-324 parity remains passing', () => {
    const deText = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'etwa sechseinhalb Jahre',
      dutyFacts: WH_ES.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Diseñadora gráfica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
    });
    const q = analyzeGermanSummaryEmploymentQuality(deText, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      gender: 'female',
      structuredSkills: [],
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.requiredCurrentDutyFactCount ?? q.currentDutyCoverage?.requiredCurrentDutyFactCount)
      .toBe(3);
  });
});
