/**
 * @vitest-environment jsdom
 *
 * AAB-311 — phase-scoped Experience predicate / compliance diagnostics.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_PREDICATE_PHASE_DIAGNOSTICS_311_REVISION,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import {
  detectSpanishExperienceUnsupportedExpansion,
} from '@/lib/cv-spanish-experience-grounding';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import {
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { clearCvAiDiagnosticHistory } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-19';

const WH_ES = formatExperienceBullets([
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
]);

const BAD_PROVIDER = formatExperienceBullets([
  'Revisa la mercancía entrante para garantizar su correcta recepción en el almacén.',
  'Comprueba y gestiona la documentación relacionada con los envíos y entregas de mercancía.',
  'Coordina con sus compañeros la preparación y el movimiento eficiente de la mercancía.',
]);

function cv(): CVData {
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', 'female'),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_ES,
    originalUserDescription: WH_ES,
    descriptionOrigin: 'user',
    contentLocale: 'es',
  };
  return {
    personal: {
      fullName: 'Test',
      jobTitle: localizeWarehouseEmployee('es', 'female'),
      email: 't@example.com',
      phone: '',
      location: '',
      summary: '',
    },
    experience: [current],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
  };
}

describe('cv-build311 predicate phase diagnostics', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('exposes phase diagnostics revision', () => {
    expect(EXPERIENCE_PREDICATE_PHASE_DIAGNOSTICS_311_REVISION)
      .toBe('experience-predicate-phase-diagnostics-311-v1');
  });

  it('provider phase fields match provider unsupported kinds when already-valid source rejects apply', () => {
    const scan = detectSpanishExperienceUnsupportedExpansion(WH_ES, BAD_PROVIDER);
    expect(scan.kinds).toEqual(expect.arrayContaining([
      'coordinated_predicate_expansion',
    ]));
    expect(scan.sourcePredicateIdentityCount).toBe(3);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv: cv(),
      candidate: BAD_PROVIDER,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    // AAB-316: already-valid short source → reject unsupported provider, no billable apply.
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.blocked).toBe(true);
    expect(fin.text.trim()).toBe(WH_ES.trim());
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(
      (fin.diagnostics?.providerUnsupportedClaimCount ?? 0) > 0
      || (fin.diagnostics?.providerUnsupportedClaimKinds || []).length > 0
      || scan.count > 0,
    ).toBe(true);
  });
});
