import { describe, expect, it } from 'vitest';
import {
  buildNativeFirstPersonDutyTail,
  evaluateSummaryV2NativeSurface,
} from '@/lib/cv-summary-v2/native-surface';
import {
  realizeSouthSlavicPredicateChain,
} from '@/lib/cv-summary-v2/south-slavic-predicates';

const VALID_SUMMARY = [
  'Imam oko sedam godina ukupnog profesionalnog iskustva.',
  'Trenutno radim kao grafička dizajnerka u Rewitu, gde pripremam rasporede za digitalne materijale.',
  'Prethodno sam radila kao grafička dizajnerka u TestWerku, gde sam kreirala materijale za štampane i digitalne medije.',
].join(' ');

describe('AAB466 Serbian Summary native morphology', () => {
  it('normalizes third-person feminine past predicates into the first-person shell', () => {
    const realized = realizeSouthSlavicPredicateChain({
      bullet: 'Kreirala je vizuelne materijale i razvijala je koncepte dizajna.',
      locale: 'sr',
      employmentState: 'completed',
      gender: 'female',
    });

    expect(realized.text).toBe('kreirala vizuelne materijale i razvijala koncepte dizajna');
    expect(realized.text).not.toMatch(/(?:ala|ela|ila)\s+je\b/iu);

    const tail = buildNativeFirstPersonDutyTail(
      [
        'Kreirala je vizuelne materijale',
        'Razvijala je koncepte dizajna',
        'Pregledala je projekte i proveravala kvalitet rezultata',
      ],
      'sr',
      'completed',
      'female',
    );
    expect(tail).toContain(', gde sam kreirala vizuelne materijale');
    expect(tail).toContain('razvijala koncepte dizajna');
    expect(tail).not.toMatch(/sam\s+\p{L}+(?:ala|ela|ila)\s+je\b/iu);
  });

  it('accepts coherent current and completed Serbian first-person morphology', () => {
    const native = evaluateSummaryV2NativeSurface({
      text: VALID_SUMMARY,
      locale: 'sr',
      hasCurrent: true,
      hasPrior: true,
      perspectiveMode: 'first_person',
      gender: 'female',
    });

    expect(native.nativeSurfaceValidationPassed).toBe(true);
    expect(native.firstPersonPredicateChainPassed).toBe(true);
    expect(native.localeVerbMorphologyPassed).toBe(true);
    expect(native.mixedPersonPredicateDetected).toBe(false);
  });

  it('rejects mixed first/third-person and duplicate-auxiliary surfaces before apply', () => {
    for (const text of [
      VALID_SUMMARY.replace('gde pripremam', 'gde priprema'),
      VALID_SUMMARY.replace('gde sam kreirala', 'gde sam kreirala je'),
    ]) {
      const native = evaluateSummaryV2NativeSurface({
        text,
        locale: 'sr',
        hasCurrent: true,
        hasPrior: true,
        perspectiveMode: 'first_person',
        gender: 'female',
      });
      expect(native.nativeSurfaceValidationPassed).toBe(false);
      expect(native.firstPersonPredicateChainPassed).toBe(false);
    }
  });

  it('rejects noun-like layout mutations while preserving a valid layout object', () => {
    const malformed = evaluateSummaryV2NativeSurface({
      text: VALID_SUMMARY.replace('gde pripremam rasporede', 'gde rasporedem'),
      locale: 'sr',
      hasCurrent: true,
      hasPrior: true,
      perspectiveMode: 'first_person',
      gender: 'female',
    });
    expect(malformed.nativeSurfaceValidationPassed).toBe(false);
    expect(malformed.nativeSurfaceRejectionReasons.join('|')).toContain(
      'sr_malformed_noun_predicate_mutation',
    );

    const valid = evaluateSummaryV2NativeSurface({
      text: VALID_SUMMARY,
      locale: 'sr',
      hasCurrent: true,
      hasPrior: true,
      perspectiveMode: 'first_person',
      gender: 'female',
    });
    expect(valid.nativeSurfaceValidationPassed).toBe(true);
    expect(VALID_SUMMARY).toContain('rasporede za digitalne materijale');
  });
});
