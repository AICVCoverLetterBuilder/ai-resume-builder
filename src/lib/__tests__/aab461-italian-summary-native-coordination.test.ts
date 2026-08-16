import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { buildSummaryV2ManifestForCv } from '@/lib/cv-summary-v2';
import { buildSummaryV2StyledDeterministicText } from '@/lib/cv-summary-v2/rewrite-style';
import { evaluateSummaryV2NativeSurface } from '@/lib/cv-summary-v2/native-surface';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';

const REF = '2026-07-01';

function italianCv(summary = ''): CVData {
  return {
    personal: { firstName: 'A', lastName: 'B', gender: 'female' },
    experience: [{
      id: 'it-current', position: 'Designer', company: 'TestWerk',
      startDate: '2020-01', endDate: '', isPresent: true,
      description: 'Preparo materiali grafici e modifico immagini.',
      originalUserDescription: 'Preparo materiali grafici e modifico immagini.',
      canonicalDescription: 'Preparo materiali grafici e modifico immagini.',
      descriptionOrigin: 'user',
    }],
    education: [], skills: [], languages: [], summary, contentLocale: 'it',
  } as unknown as CVData;
}

describe('AAB461 Italian native finite-clause coordination', () => {
  beforeEach(() => setSummaryV2EnabledForTests(true));
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('rejects scoped nonché finite-clause coordination but accepts nominal use', () => {
    for (const text of [
      'Preparo materiali, nonché modifico immagini.',
      'Ho creato materiali, nonché ho sviluppato concetti.',
      'Ho preparato materiali, nonché ho modificato immagini.',
    ]) {
      const surface = evaluateSummaryV2NativeSurface({ text, locale: 'it', perspectiveMode: 'first_person' });
      expect(surface.nativeCoordinationValidationPassed, text).toBe(false);
      expect(surface.nativeSurfaceRejectionReasons).toContain('unnatural_coordination:it_nonche_finite_clause_coordination');
    }
    expect(evaluateSummaryV2NativeSurface({
      text: 'Materiali nonché strumenti per il progetto.', locale: 'it', perspectiveMode: 'first_person',
    }).nativeCoordinationValidationPassed).toBe(true);
  });

  it('uses native e coordination for Stronger and keeps the apply gate green', () => {
    const manifest = buildSummaryV2ManifestForCv({ cv: italianCv(), locale: 'it', gender: 'female', referenceDateIso: REF });
    const source = buildSummaryV2StyledDeterministicText(manifest, 'shorter');
    const stronger = buildSummaryV2StyledDeterministicText(manifest, 'stronger');
    expect(stronger).not.toMatch(/,\s+nonché\s+/iu);
    expect(stronger).toMatch(/,\s+e\s+/u);
    const surface = evaluateSummaryV2NativeSurface({ text: stronger, locale: 'it', perspectiveMode: 'first_person' });
    expect(surface.nativeCoordinationValidationPassed).toBe(true);
    expect(surface.nativeSurfaceValidationPassed).toBe(true);
    expect(source).not.toBe(stronger);
    const fin = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_stronger', requestedLocale: 'it', gender: 'female',
      cv: { ...italianCv(source), summary: source }, candidate: stronger,
      referenceDateIso: REF, rewriteStyle: 'stronger',
    });
    expect(fin.blocked, fin.reason).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
  });

  it.each([
    ['summary_generate', 'Preparo materiali, nonché modifico immagini.'],
    ['summary_stronger', 'Ho creato materiali, nonché ho sviluppato concetti.'],
    ['summary_shorter', 'Ho preparato materiali, nonché ho modificato immagini.'],
    ['summary_professional', 'Preparo materiali, nonché modifico immagini.'],
  ] as const)('rejects malformed %s surface through the shared validator', (_action, text) => {
    const surface = evaluateSummaryV2NativeSurface({ text, locale: 'it', perspectiveMode: 'first_person' });
    expect(surface.nativeSurfaceValidationPassed).toBe(false);
  });
});
