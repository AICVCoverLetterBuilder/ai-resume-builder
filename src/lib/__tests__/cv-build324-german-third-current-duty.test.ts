/**
 * AAB-324 — German Summary third current duty + authoritative/required parity.
 */
import { describe, expect, it } from 'vitest';
import {
  GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION,
  SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION,
  SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION,
  SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION,
  extractGermanCurrentWarehouseDutyFacts,
  buildGermanCurrentDutyExperiencePhrase,
  analyzeCurrentDutyRequiredFactParity,
  validateSummaryEntryDutyCoverage,
  validateGermanGeneratedCaseGrammar,
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
} from '@/lib/cv-german-summary-grounding';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

const WH_ES = [
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
].join('\n');

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

/** Exact AAB-323 visible output — missing third current duty. */
const AAB323_TWO_DUTY = [
  'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Prüfung',
  'eingehender Waren und der Prüfung der zugehörigen Dokumentation. Zuvor war sie',
  'als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien,',
  'überarbeitete Designunterlagen und bereitete finale Dateien für verschiedene',
  'Formate und Bildschirme vor. Insgesamt verfügt sie über etwa sechseinhalb Jahre',
  'Berufserfahrung.',
].join(' ');

function germanFixture(description = WH_ES, summary = ''): CVData {
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
        description,
        canonicalDescription: description,
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

describe('AAB-324 German Summary third current duty and parity', () => {
  it('revision markers reachable', () => {
    expect(GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION).toBe(
      'german-summary-third-current-duty-324-v1',
    );
    expect(SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION).toBe(
      'summary-authoritative-duty-parity-324-v1',
    );
    expect(SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION).toBe(
      'summary-visible-duty-parity-324-v1',
    );
    expect(SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION).toBe(
      'summary-duty-parity-apply-gate-324-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION,
    );
  });

  it('1-4. Spanish Atlas source yields three required identities including coordination', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({
      currentEntryDuties: WH_ES,
      entryId: 'atlas',
    });
    expect(facts).toHaveLength(3);
    expect(facts.map((f) => f.canonicalFactId)).toEqual([
      'incoming_goods_check',
      'related_documentation_check',
      'colleague_coordination_goods_preparation_movement',
    ]);
    expect(facts.every((f) => f.requiredForSummary)).toBe(true);
    const parity = analyzeCurrentDutyRequiredFactParity({
      currentEntryDuties: WH_ES,
      requiredFacts: facts,
    });
    expect(parity.authoritativeCurrentDutyFactCount).toBe(3);
    expect(parity.authoritativeCanonicalCurrentDutyFactCount).toBe(3);
    expect(parity.requiredCurrentDutyFactCount).toBe(3);
    expect(parity.classifiedRequiredCurrentDutyFactCount).toBe(3);
    expect(parity.unclassifiedAuthoritativeCurrentDutyFactCount).toBe(0);
    expect(parity.requiredFactSetMatchesAuthoritativeFactSet).toBe(true);
    expect(parity.currentDutyRequiredFactParityPassed).toBe(true);
  });

  it('5-8. material-key grouping / optional / unknown do not drop facts', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_ES });
    expect(new Set(facts.map((f) => f.materialCategory)).size).toBeGreaterThan(1);
    expect(facts.filter((f) => f.materialCategory === 'warehouse_movement')).toHaveLength(1);
    expect(facts.every((f) => f.requiredForSummary)).toBe(true);
  });

  it('9-16. coverage: 3/3 pass; AAB-323 two-duty text fails 2/3', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_ES });
    const full = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      dutyFacts: WH_ES.split('\n').map((value) => ({ value, sourceText: value })),
      priorRole: 'Diseñadora gráfica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
      durationPhrase: 'etwa sechseinhalb Jahre',
    });
    const ok = validateSummaryEntryDutyCoverage({
      requiredFacts: facts,
      candidateText: full,
    });
    expect(ok.requiredCurrentDutyFactCount).toBe(3);
    expect(ok.coveredCurrentDutyFactCount).toBe(3);
    expect(ok.finalCurrentDutyCoveragePassed).toBe(true);
    expect(full).toMatch(/eingehende\s+Waren\s+prüfe/iu);
    expect(full).toMatch(/Dokumentation\s+kontrolliere|gehörende\s+Dokumentation/iu);
    expect(full).toMatch(/Kolleg|abstimme/iu);
    expect(full).not.toMatch(/Erfahrung\s+in\s+die\s+Abstimmung/iu);
    expect(full).toMatch(/grafische\s+Elemente/iu);
    expect(validateGermanGeneratedCaseGrammar(full).germanControlledCaseGrammarPassed).toBe(true);

    const regress = validateSummaryEntryDutyCoverage({
      requiredFacts: facts,
      candidateText: AAB323_TWO_DUTY,
    });
    expect(regress.coveredCurrentDutyFactCount).toBe(2);
    expect(regress.missingCurrentDutyFactCount).toBe(1);
    expect(regress.finalCurrentDutyCoveragePassed).toBe(false);

    const q = analyzeGermanSummaryEmploymentQuality(AAB323_TWO_DUTY, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      gender: 'female',
      currentEntryId: 'atlas',
    });
    expect(q.requiredCurrentDutyFactCount).toBe(3);
    expect(q.coveredCurrentDutyFactCount).toBe(2);
    expect(q.finalCurrentDutyCoveragePassed).toBe(false);
    expect(q.ok).toBe(false);
  });

  it('17-25. deterministic builder serializes all three duties once', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      dutyFacts: WH_ES.split('\n').map((value) => ({ value, sourceText: value })),
      priorRole: 'Diseñadora gráfica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
      durationPhrase: 'etwa sechseinhalb Jahre',
    });
    const phrase = buildGermanCurrentDutyExperiencePhrase(
      extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_ES }),
    );
    expect(phrase).toMatch(/sowie in der Abstimmung/iu);
    expect(text).toMatch(/\bLagermitarbeiterin\b/);
    expect(text).toMatch(/\bAtlas\b/);
    expect(text).toMatch(/Derzeit\s+arbeite\s+ich/iu);
    expect(text).toMatch(/\bGrafikdesignerin\b/);
    expect(text).toMatch(/\bRewitu\b/);
    expect(text).toMatch(/Ich\s+verfüge|insgesamt/iu);
    expect(text).toMatch(/grafische\s+Elemente/iu);
    expect(text).toMatch(/Bildschirme/iu);
    expect((text.match(/abstimme|Abstimmung/giu) || []).length).toBeGreaterThanOrEqual(1);
  });

  it('26-30. finalize recovers Spanish Atlas with 3/3 parity and apply', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixture(WH_ES, ''),
      candidate: 'weak provider text without duties',
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.authoritativeCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.currentDutyRequiredFactParityPassed).toBe(true);
    expect(fin.diagnostics?.requiredFactSetMatchesAuthoritativeFactSet).toBe(true);
    expect(fin.diagnostics?.unclassifiedAuthoritativeCurrentDutyFactCount).toBe(0);
    expect(fin.text).toMatch(/Kolleg|abstimme/iu);
    expect(fin.text).not.toMatch(/Erfahrung\s+in\s+die\s+Abstimmung/iu);
    expect(fin.text).toMatch(/Derzeit\s+arbeite\s+ich|Ich\s+verfüge/iu);
  });

  it('German WH_DE still yields 3/3', () => {
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_DE });
    expect(facts).toHaveLength(3);
    const parity = analyzeCurrentDutyRequiredFactParity({
      currentEntryDuties: WH_DE,
      requiredFacts: facts,
    });
    expect(parity.currentDutyRequiredFactParityPassed).toBe(true);
  });
});
