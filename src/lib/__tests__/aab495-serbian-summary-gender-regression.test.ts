/**
 * AAB495 real-device topology: exact-locale Serbian roles, female Summary,
 * live employer mutation, five entries, and mixed historical provenance.
 *
 * The assertion intentionally exercises snapshot → same-locale localized
 * manifest → projection → deterministic V2 Summary, rather than a title helper.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  buildSameLocaleLocalizedManifest,
  buildSummaryV2DeterministicText,
  buildSummaryV2ManifestForCv,
  projectLocalizedSummaryV2Manifest,
  runSummaryV2,
  setSummaryV2EnabledForTests,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';

const REF = '2026-08-21';

const DESIGN_DUTIES = [
  'Pripremam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređujem grafike i slike za različite projekte.',
  'Usklađujem nacrte i izmene sa članovima projektnog tima.',
].join('\n');

function graphicExperience(options: Partial<WorkExperience>): WorkExperience {
  return {
    id: options.id || 'graphic',
    position: 'Grafički dizajner',
    company: 'Firma',
    startDate: '2020-01',
    endDate: '2020-12',
    isPresent: false,
    description: DESIGN_DUTIES,
    // The device path contains Serbian visible role surfaces plus older
    // description provenance from other locales. Only live description drives V2.
    generatedLocale: 'sr',
    canonicalDescription: 'Legacy foreign historical description.',
    descriptionOrigin: 'ai_generated',
    positionProvenance: 'occupation_option',
    ...options,
  };
}

function deviceCv(options?: { gender?: string; summary?: string; manualTitle?: boolean }): CVData {
  const experience: WorkExperience[] = [
    graphicExperience({
      id: 'current-2026-03',
      company: 'Nova Firma SR Test',
      startDate: '2026-03',
      endDate: '',
      isPresent: true,
      // The raw Experience title remains unchanged after generated Summary projection.
      ...(options?.manualTitle ? { positionProvenance: 'manual', positionUserEdited: true } : {}),
    }),
    graphicExperience({
      id: 'prior-testwerk',
      company: 'TestWerk GmbH',
      startDate: '2024-01',
      endDate: '2026-02',
      generatedLocale: 'sr',
      canonicalDescription: 'Historical English source description.',
    }),
    graphicExperience({
      id: 'prior-rewitu',
      company: 'Rewitu',
      startDate: '2022-01',
      endDate: '2023-12',
      generatedLocale: 'sr',
      canonicalDescription: 'Historischer deutscher Beschreibungstext.',
    }),
    {
      id: 'older-support', position: 'Korisnička podrška', company: 'Old Support',
      startDate: '2020-01', endDate: '2021-12', isPresent: false,
      description: 'Odgovaram na upite. Evidentiram zahteve. Pomažem korisnicima.',
      generatedLocale: 'sr', positionProvenance: 'occupation_option',
    },
    {
      id: 'older-retail', position: 'Prodavac', company: 'Old Retail',
      startDate: '2019-03', endDate: '2019-12', isPresent: false,
      description: 'Uslužujem kupce. Dopunjujem robu. Vodim evidenciju.',
      generatedLocale: 'sr', positionProvenance: 'occupation_option',
    },
  ];
  return {
    id: 'aab495-device-equivalent',
    name: 'Sanitized AAB495',
    personal: {
      fullName: 'Test User', email: 'test@example.invalid', phone: '', address: '',
      jobTitle: 'Grafički dizajner', gender: options?.gender ?? 'female',
    },
    summary: options?.summary ?? '', experience, education: [], skills: [], certifications: [],
    languages: [], templateId: 'modern-minimal', region: 'EU', createdAt: '2026-01-01',
    updatedAt: '2026-08-21', contentLocale: 'sr',
  };
}

describe('AAB495 Serbian Summary gender source gate', () => {
  it('turns the pre-fix raw same-locale path red, then projects all three selected female roles', () => {
    const cv = deviceCv();
    const source = buildSummaryV2ManifestForCv({ cv, locale: 'sr', gender: 'female', referenceDateIso: REF });
    expect(source.current?.employer).toBe('Nova Firma SR Test');
    expect(source.priors.map((entry) => entry.employer)).toEqual(['TestWerk GmbH', 'Rewitu']);
    expect(source.current?.role).toBe('Grafički dizajner'); // persisted/raw authority is untouched

    const preFixSurface = buildSummaryV2DeterministicText(source);
    const red = validateSummaryV2AgainstManifest(preFixSurface, source);
    expect(red.roleTitleGenderValidationPassed).toBe(false);
    expect(red.roleTitleGenderEvidence).toHaveLength(3);
    expect(red.roleTitleGenderEvidence.every((e) => e.genderValidationApplicable)).toBe(true);
    expect(red.roleTitleGenderEvidence.every((e) => !e.genderValidationPassed)).toBe(true);

    const localized = buildSameLocaleLocalizedManifest(source)!;
    const projected = projectLocalizedSummaryV2Manifest({ manifest: source, localized })!;
    expect(projected.current?.role).toBe('Grafička dizajnerka');
    expect(projected.priors.map((entry) => entry.role)).toEqual([
      'Grafička dizajnerka', 'Grafička dizajnerka',
    ]);

    const generated = runSummaryV2({ cv, locale: 'sr', gender: 'female', referenceDateIso: REF, candidate: '' });
    expect(generated.blocked).toBe(false);
    expect(generated.text).toContain('Grafička dizajnerka u Nova Firma SR Test');
    expect(generated.text).toContain('Grafička dizajnerka u TestWerk GmbH');
    expect(generated.text).toContain('Grafička dizajnerka u Rewitu');
    expect(generated.text).not.toContain('Grafički dizajner');
    expect(generated.validation.roleTitleGenderValidationPassed).toBe(true);
    expect(generated.validation.roleTitleGenderEvidence.every((e) => (
      e.genderValidationApplicable && e.genderValidationPassed
    ))).toBe(true);
    expect(cv.experience?.[0]?.position).toBe('Grafički dizajner');
  });

  it('preserves male, unspecified, explicit-manual, and Enhance authority contracts', () => {
    const male = runSummaryV2({ cv: deviceCv({ gender: 'male' }), locale: 'sr', gender: 'male', referenceDateIso: REF, candidate: '' });
    expect(male.text).toContain('Grafički dizajner u Nova Firma SR Test');
    expect(male.validation.roleTitleGenderValidationPassed).toBe(true);

    const unspecified = runSummaryV2({ cv: deviceCv({ gender: '' }), locale: 'sr', gender: '', referenceDateIso: REF, candidate: '' });
    expect(unspecified.text).toContain('Grafički dizajner u Nova Firma SR Test');
    expect(unspecified.validation.roleTitleGenderEvidence.every((e) => !e.genderValidationApplicable)).toBe(true);

    const manual = runSummaryV2({ cv: deviceCv({ manualTitle: true }), locale: 'sr', gender: 'female', referenceDateIso: REF, candidate: '' });
    expect(manual.text).toContain('Grafički dizajner u Nova Firma SR Test');
    expect(manual.validation.roleTitleGenderEvidence[0]).toMatchObject({
      genderValidationApplicable: false, genderValidationPassed: true,
    });

    const enhanced = runSummaryV2({
      cv: deviceCv({ summary: 'Moja postojeća sažeta napomena.' }),
      locale: 'sr', gender: 'female', referenceDateIso: REF,
      candidate: 'Neutemeljen kandidat.',
    });
    expect(enhanced.blocked).toBe(false);
    expect(enhanced.text).toContain('Grafička dizajnerka u Nova Firma SR Test');
    expect(enhanced.text).not.toContain('Rewitu Current Test');
  });

  it('emits truthful finalizer diagnostics for all three selected female role titles', () => {
    setSummaryV2EnabledForTests(true);
    try {
      const finalized = finalizeCvAiFieldForApply({
        action: 'summary_generate', field: 'summary', requestedLocale: 'sr', gender: 'female',
        cv: deviceCv(), candidate: '', referenceDateIso: REF,
      });
      const diagnostic = finalized.diagnostics as {
        roleTitleGenderValidationPassed?: boolean;
        roleTitleSurfaceEvidence?: Array<{
          genderValidationApplicable: boolean;
          genderValidationPassed: boolean;
        }>;
      };
      expect(finalized.blocked).toBe(false);
      expect(diagnostic.roleTitleGenderValidationPassed).toBe(true);
      expect(diagnostic.roleTitleSurfaceEvidence).toHaveLength(3);
      expect(diagnostic.roleTitleSurfaceEvidence?.every((e) => (
        e.genderValidationApplicable && e.genderValidationPassed
      ))).toBe(true);
    } finally {
      setSummaryV2EnabledForTests(null);
    }
  });
});
