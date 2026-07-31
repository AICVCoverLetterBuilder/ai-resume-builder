/**
 * AAB-323 Phase 1 — German Summary current-duty coverage + controlled case grammar.
 */
import { describe, expect, it } from 'vitest';
import {
  GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION,
  SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION,
  GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION,
  extractGermanCurrentWarehouseDutyFacts,
  buildGermanCurrentDutyExperiencePhrase,
  validateGermanGeneratedCaseGrammar,
  validateSummaryEntryDutyCoverage,
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
} from '@/lib/cv-german-summary-grounding';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

const AAB322_OMISSION_AND_GRAMMAR = [
  'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in die Abstimmung',
  'der Vorbereitung und Bewegung von Waren mit Kolleginnen und Kollegen. Zuvor war',
  'sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien,',
  'überarbeitete Designunterlagen und bereitete finale Dateien für verschiedene',
  'Formate und Bildschirme vor. Insgesamt verfügt sie über etwa sechseinhalb Jahre',
  'Berufserfahrung.',
].join(' ');

const WH_DE = [
  'Prüft eingehende Waren',
  'Prüft die zugehörige Dokumentation',
  'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
].join('\n');

const GD_ES = [
  'Crea materiales visuales y gráficos',
  'Revisa y adapta documentos de diseño',
  'Prepara archivos de diseño finales para formatos y pantallas',
].join('\n');

function germanFixture(summary = ''): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary,
    experience: [
      {
        id: 'atlas',
        position: 'Lagermitarbeiterin',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_DE,
        canonicalDescription: WH_DE,
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
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-323 German Summary current duty coverage and grammar', () => {
  it('revision markers reachable', () => {
    expect(GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION).toBe(
      'german-summary-current-duty-serialization-323-v1',
    );
    expect(SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION).toBe(
      'summary-entry-duty-coverage-323-v1',
    );
    expect(GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION).toBe(
      'german-summary-controlled-case-grammar-323-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION,
    );
  });

  it('1/13. exact AAB-322 visible output reports 1/3 and grammar fail', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: WH_DE,
      entryId: 'atlas',
    });
    expect(facts).toHaveLength(3);
    const cov = validateSummaryEntryDutyCoverage({
      requiredFacts: facts,
      candidateText: AAB322_OMISSION_AND_GRAMMAR,
    });
    expect(cov.requiredCurrentDutyFactCount).toBe(3);
    expect(cov.coveredCurrentDutyFactCount).toBe(1);
    expect(cov.finalCurrentDutyCoveragePassed).toBe(false);
    expect(cov.materialCategoryCoverageUsedForFinalAcceptance).toBe(false);
    expect(cov.currentRoleConcreteFactCoverage).toBe(1);

    const grammar = validateGermanGeneratedCaseGrammar(AAB322_OMISSION_AND_GRAMMAR);
    expect(grammar.germanControlledCaseGrammarPassed).toBe(false);
    expect(grammar.invalidErfahrungInAccusativeDetected).toBe(true);

    const q = analyzeGermanSummaryEmploymentQuality(AAB322_OMISSION_AND_GRAMMAR, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_ES,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.coveredCurrentDutyFactCount).toBe(1);
    expect(q.requiredCurrentDutyFactCount).toBe(3);
    expect(q.finalCurrentDutyCoveragePassed).toBe(false);
    expect(q.germanControlledCaseGrammarPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('2-7. partial duty combinations fail', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_DE });
    const onlyCoord = 'Lagermitarbeiterin bei Atlas mit Erfahrung in der Abstimmung mit Kolleginnen und Kollegen bei der Vorbereitung und Bewegung von Waren.';
    const onlyIncoming = 'Lagermitarbeiterin bei Atlas mit Erfahrung in der Prüfung eingehender Waren.';
    const onlyDoc = 'Lagermitarbeiterin bei Atlas mit Erfahrung in der Prüfung der zugehörigen Dokumentation.';
    const two = 'Lagermitarbeiterin bei Atlas mit Erfahrung in der Prüfung eingehender Waren und der Prüfung der zugehörigen Dokumentation.';
    expect(validateSummaryEntryDutyCoverage({ requiredFacts: facts, candidateText: onlyCoord }).coveredCurrentDutyFactCount).toBe(1);
    expect(validateSummaryEntryDutyCoverage({ requiredFacts: facts, candidateText: onlyIncoming }).coveredCurrentDutyFactCount).toBe(1);
    expect(validateSummaryEntryDutyCoverage({ requiredFacts: facts, candidateText: onlyDoc }).coveredCurrentDutyFactCount).toBe(1);
    expect(validateSummaryEntryDutyCoverage({ requiredFacts: facts, candidateText: two }).coveredCurrentDutyFactCount).toBe(2);
  });

  it('8-12. generic warehouse / prior duties do not satisfy current facts', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_DE });
    const generic = 'Lagermitarbeiterin bei Atlas mit Erfahrung in Lagerarbeit.';
    expect(validateSummaryEntryDutyCoverage({
      requiredFacts: facts,
      candidateText: generic,
    }).coveredCurrentDutyFactCount).toBe(0);
    const priorOnly = 'Zuvor war sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien.';
    expect(validateSummaryEntryDutyCoverage({
      requiredFacts: facts,
      candidateText: priorOnly,
    }).coveredCurrentDutyFactCount).toBe(0);
  });

  it('14-21. deterministic builder serializes all three duties with dative grammar', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'etwa sechseinhalb Jahre',
      dutyFacts: WH_DE.split('\n').map((value) => ({ value, sourceText: value })),
      priorRole: 'Diseñadora gráfica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
    });
    expect(text).toMatch(/eingehende\s+Waren\s+prüfe/i);
    expect(text).toMatch(/Dokumentation\s+kontrolliere|gehörende\s+Dokumentation/i);
    expect(text).toMatch(/Kolleg|abstimme/i);
    expect(text).not.toMatch(/in\s+die\s+Abstimmung/i);
    expect(text).toMatch(/Derzeit\s+arbeite\s+ich|Ich\s+verfüge/i);
    expect(text).toMatch(/\bAtlas\b/);
    expect(text).toMatch(/\bRewitu\b/);
    expect(text).toMatch(/Grafikdesignerin/);
    expect(text).toMatch(/insgesamt/i);
    expect(text).toMatch(/grafische\s+Elemente/i);
    expect(text).toMatch(/Bildschirme/i);
    expect(validateGermanGeneratedCaseGrammar(text).germanControlledCaseGrammarPassed).toBe(true);

    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_DE });
    const cov = validateSummaryEntryDutyCoverage({ requiredFacts: facts, candidateText: text });
    expect(cov.coveredCurrentDutyFactCount).toBe(3);
    expect(cov.finalCurrentDutyCoveragePassed).toBe(true);
  });

  it('22-28. controlled case grammar accept/reject', () => {
    expect(validateGermanGeneratedCaseGrammar(
      'mit Erfahrung in die Abstimmung der Vorbereitung',
    ).germanControlledCaseGrammarPassed).toBe(false);
    expect(validateGermanGeneratedCaseGrammar(
      'mit Erfahrung in der Abstimmung mit Kolleginnen und Kollegen',
    ).germanControlledCaseGrammarPassed).toBe(true);
    expect(validateGermanGeneratedCaseGrammar(
      'mit Erfahrung in der Prüfung eingehender Waren',
    ).germanControlledCaseGrammarPassed).toBe(true);
    expect(validateGermanGeneratedCaseGrammar(
      'mit Erfahrung in der Prüfung eingehender Waren und der Prüfung der zugehörigen Dokumentation sowie in der Abstimmung mit Kolleginnen und Kollegen bei der Vorbereitung und Bewegung von Waren',
    ).germanControlledCaseGrammarPassed).toBe(true);
    expect(validateGermanGeneratedCaseGrammar(
      'bei der Vorbereitung und dem Transport von Waren',
    ).germanControlledCaseGrammarPassed).toBe(true);
  });

  it('experience phrase builder uses dative clauses', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_DE });
    const phrase = buildGermanCurrentDutyExperiencePhrase(facts);
    expect(phrase).toMatch(/^mit Erfahrung in der Prüfung/);
    expect(phrase).not.toMatch(/in die /);
  });

  it('finalize rejects AAB-322 defective candidate and recovers with 3/3 duties', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixture(''),
      candidate: AAB322_OMISSION_AND_GRAMMAR,
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/eingehende\s+Waren\s+prüfe/i);
    expect(fin.text).toMatch(
      /Dokumentation\s+kontrolliere|gehörende\s+Dokumentation|zugehörige\s+Dokumentation/i,
    );
    expect(fin.text).toMatch(/Kolleg|abstimme|koordiniere/i);
    expect(fin.text).not.toMatch(/in\s+die\s+Abstimmung/i);
    expect(fin.text).toMatch(/Derzeit\s+arbeite\s+ich|Ich\s+verfüge/i);
    expect(fin.diagnostics?.finalCurrentDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.germanControlledCaseGrammarPassed).toBe(true);
    expect(fin.diagnostics?.materialCategoryCoverageUsedForFinalAcceptance).toBe(false);
  });
});
