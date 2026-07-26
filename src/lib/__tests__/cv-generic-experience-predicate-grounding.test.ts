/**
 * Unit tests — shared occupation-agnostic Experience predicate grounding.
 */
import { describe, expect, it } from 'vitest';
import {
  GENERIC_EXPERIENCE_PREDICATE_343_REVISION,
  scanGenericExperiencePredicates,
  sourceRequiresGenericExperiencePredicates,
} from '@/lib/cv-generic-experience-predicate-grounding';
import { sourceRequiresCroatianWarehouseFactCoverage } from '@/lib/cv-croatian-experience-grounding';

const ES_DESIGN = [
  'Creó materiales visuales y elementos gráficos.',
  'Revisó y adaptó materiales de diseño.',
  'Preparó archivos finales de diseño para distintos formatos y pantallas.',
].join('\n');

const HR_DESIGN = [
  'Izrađivala je vizualne materijale i grafičke elemente.',
  'Pregledavala je i prilagođavala dizajnerske materijale.',
  'Pripremala je završne dizajnerske datoteke za različite formate i zaslone.',
].join('\n');

const COOK_CURRENT_EN = [
  'Prepares daily dishes according to established recipes.',
  'Maintains hygiene standards at the kitchen workstation.',
  'Coordinates timing with the service team during peak hours.',
].join('\n');

const COOK_CURRENT_DE = [
  'Bereitet tägliche Gerichte nach festgelegten Rezepten zu.',
  'Hält Hygienestandards am Küchenarbeitsplatz ein.',
  'Stimmt den Zeitablauf mit dem Service-Team in Stoßzeiten ab.',
].join('\n');

const FREE_TEXT_EN = [
  'Catalogued archival specimens for seasonal exhibits.',
  'Calibrated humidity sensors in storage rooms.',
  'Drafted condition reports for outgoing loans.',
].join('\n');

const FREE_TEXT_FR = [
  'A catalogué des spécimens d’archives pour des expositions saisonnières.',
  'A calibré des capteurs d’humidité dans les salles de stockage.',
  'A rédigé des rapports d’état pour les prêts sortants.',
].join('\n');

describe('generic Experience predicate grounding', () => {
  it('exposes packaging revision', () => {
    expect(GENERIC_EXPERIENCE_PREDICATE_343_REVISION).toBe(
      'generic-experience-predicate-343-v1',
    );
  });

  it('applies to design source (not Croatian warehouse)', () => {
    expect(sourceRequiresGenericExperiencePredicates(ES_DESIGN)).toBe(true);
    expect(sourceRequiresCroatianWarehouseFactCoverage(ES_DESIGN)).toBe(false);
  });

  it('passes 3/3 for faithful Spanish→Croatian design provider', () => {
    const pred = scanGenericExperiencePredicates(ES_DESIGN, HR_DESIGN);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.candidateAddedPredicateIdentityHashes).toEqual([]);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
  });

  it('rejects missing one duty', () => {
    const missing = [
      HR_DESIGN.split('\n')[0],
      HR_DESIGN.split('\n')[1],
    ].join('\n');
    const pred = scanGenericExperiencePredicates(ES_DESIGN, missing);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBeLessThan(3);
    expect(pred.reason).toMatch(/merged|coverage_failed|predicate/i);
  });

  it('rejects merged duties', () => {
    const merged = [
      'Izrađivala je vizualne materijale i pregledavala dizajnerske materijale.',
      'Pripremala je završne dizajnerske datoteke za različite formate i zaslone.',
    ].join('\n');
    const pred = scanGenericExperiencePredicates(ES_DESIGN, merged);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(pred.reason).toMatch(/merged|coverage_failed|predicate/i);
  });

  it('rejects added unsupported action', () => {
    const added = [
      ...HR_DESIGN.split('\n'),
      'Optimizirala je sve KPI metrike kvalitete dizajna.',
    ].join('\n');
    const pred = scanGenericExperiencePredicates(ES_DESIGN, added);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(pred.candidateAddedPredicateCount).toBeGreaterThan(0);
    expect(pred.reason).toMatch(/added|extra|predicate/i);
  });

  it('covers current cook occupation without warehouse module', () => {
    expect(sourceRequiresCroatianWarehouseFactCoverage(COOK_CURRENT_EN)).toBe(false);
    const pred = scanGenericExperiencePredicates(COOK_CURRENT_EN, COOK_CURRENT_DE);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('covers arbitrary free-text title duties', () => {
    expect(sourceRequiresGenericExperiencePredicates(FREE_TEXT_EN)).toBe(true);
    const pred = scanGenericExperiencePredicates(FREE_TEXT_EN, FREE_TEXT_FR);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('never returns vacuous 0/null applicability for non-empty source', () => {
    const pred = scanGenericExperiencePredicates(ES_DESIGN, HR_DESIGN);
    expect(pred.sourcePredicateIdentityCount).toBeGreaterThan(0);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(pred.sourceUnitPredicateCoveragePassed).not.toBeNull();
  });
});
