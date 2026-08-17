import { describe, expect, it } from 'vitest';
import {
  evaluateSummaryV2StyleFulfillment,
  isSummaryV2MarkerOnlyStyleChange,
} from '@/lib/cv-summary-v2/rewrite-style';

const DEVICE_SOURCE = [
  'Imam oko sedam godina iskustva.',
  'Trenutno radim kao Grafički dizajner u Rewitu Current Test, gde pripremam vizuelne koncepte i rasporede za digitalne materijale, uređujem grafike i slike za različite projekte i usklađujem nacrte i izmene sa članovima projektnog tima.',
  'Prethodno sam radila kao Grafički dizajner u TestWerk GmbH, gde sam kreirala grafičke materijale za štampane i digitalne medije, razvijala koncepte vizuelnog dizajna prema potrebama klijenata i pregledala projekte dizajna i proveravala kvalitet finalnih rezultata.',
  'Prethodno sam radila kao Grafički dizajner u Rewitu, gde sam pripremala vizuelne koncepte i rasporede za digitalne materijale, uređivala grafike i slike za različite projekte i usklađivala nacrte i izmene sa članovima projektnog tima.',
].join(' ');

describe('AAB468 Serbian Summary Stronger meaningful style gate', () => {
  it('rejects the AAB467 connector-only device transformation as a semantic no-op', () => {
    const connectorOnly = DEVICE_SOURCE
      .replace(', uređujem', ' te uređujem')
      .replace(', razvijala', ' te razvijala')
      .replace(', uređivala', ' te uređivala');
    const result = evaluateSummaryV2StyleFulfillment({
      style: 'stronger', sourceText: DEVICE_SOURCE, candidateText: connectorOnly, locale: 'sr',
    });

    expect(isSummaryV2MarkerOnlyStyleChange(DEVICE_SOURCE, connectorOnly, 'sr', 'stronger')).toBe(true);
    expect(result.strongerStyleFulfilled).toBe(false);
    expect(result.styleValidationPassed).toBe(false);
    expect(result.styleRejectionReasons).toContain('stronger_marker_only');
    expect(result.semanticStyleOperationsApplied).not.toContain('duty_predicate_strengthen');
  });

  it('accepts a grounded predicate-level Stronger change for an unrelated occupation', () => {
    const source = 'Imam iskustvo. Trenutno radim kao tehničarka u Servisu, gde obavljam zadatke održavanja.';
    const stronger = 'Imam iskustvo. Trenutno radim kao tehničarka u Servisu, gde sprovodim zadatke održavanja.';
    const result = evaluateSummaryV2StyleFulfillment({
      style: 'stronger', sourceText: source, candidateText: stronger, locale: 'sr',
    });

    expect(result.strongerVerbTransformationCount).toBe(1);
    expect(result.semanticStyleOperationsApplied).toContain('duty_predicate_strengthen');
    expect(result.strongerStyleFulfilled).toBe(true);
  });
});
