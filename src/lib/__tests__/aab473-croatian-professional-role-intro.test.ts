import { describe, expect, it } from 'vitest';
import type { SummaryV2EntryOwned, SummaryV2SelectionManifest } from '@/lib/cv-summary-v2';
import {
  buildEntryOwnedFactsFromLiveDescription,
  buildSummaryV2DeterministicText,
  buildSummaryV2StyledDeterministicText,
  hashSummaryV2Text,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import { evaluateSummaryV2NativeSurface } from '@/lib/cv-summary-v2/native-surface';

const DUTIES = [
  'Priprema materijale za digitalne medije.',
  'Razvija vizualne koncepte prema potrebama klijenata.',
  'Pregledava projekte i provjerava kvalitetu završnih rezultata.',
];

function entry(
  id: string,
  role: string,
  state: 'present' | 'completed',
): SummaryV2EntryOwned {
  return {
    entryId: id,
    role,
    sourceRoleTitle: role,
    employer: `${id} Company`,
    startDate: state === 'present' ? '2022-01' : '2018-01',
    endDate: state === 'present' ? '' : '2021-12',
    isPresent: state === 'present',
    employmentState: state,
    sourceRoleTitleHash: hashSummaryV2Text(role),
    roleSourceLocale: 'hr',
    sourceLocale: 'hr',
    descriptionHash: `description-${id}`,
    facts: buildEntryOwnedFactsFromLiveDescription({
      entryId: id,
      liveDescription: DUTIES.join('\n'),
      sourceLocale: 'hr',
    }),
  };
}

function manifest(gender: 'female' | 'male', currentRole: string, priorRole: string): SummaryV2SelectionManifest {
  const current = entry('current', currentRole, 'present');
  const prior = entry('prior', priorRole, 'completed');
  return {
    revision: 'aab473-croatian-professional-role-intro',
    snapshotHash: `snapshot-${gender}`,
    locale: 'hr',
    gender,
    totalDurationMonths: 86,
    durationPhrase: 'oko sedam godina',
    styleHintUsed: false,
    current,
    priors: [prior],
    requiredCurrentFacts: current.facts,
    requiredPriorFacts: prior.facts,
    maxDutiesPerEntry: 3,
  };
}

describe('AAB473 Croatian Professional role-intro native surface', () => {
  it.each([
    ['female', 'Specijalistica logistike', 'Koordinatorica operacija', 'radila'],
    ['male', 'Tehničar održavanja', 'Koordinator operacija', 'radio'],
  ] as const)('uses safe nominative role framing for arbitrary %s titles', (gender, currentRole, priorRole, priorFrame) => {
    const source = manifest(gender, currentRole, priorRole);
    const generated = buildSummaryV2DeterministicText(source);
    const professional = buildSummaryV2StyledDeterministicText(source, 'professional');

    expect(professional).toContain(`Trenutno radim kao ${currentRole}`);
    expect(professional).toContain(`Prethodno sam djelov${priorFrame === 'radila' ? 'ala' : 'ao'} kao ${priorRole}`);
    expect(professional).not.toMatch(/\b(?:obavljam|obavljala|obavljao)\s+poslove\s+kao\b/iu);

    const native = evaluateSummaryV2NativeSurface({
      text: professional,
      locale: 'hr',
      hasCurrent: true,
      hasPrior: true,
      gender,
    });
    const validation = validateSummaryV2AgainstManifest(professional, source, {
      trustedConstructionAuthority: true,
      candidateSource: 'deterministic',
    });

    expect(native.nativeSurfaceValidationPassed, native.nativeSurfaceRejectionReasons.join(',')).toBe(true);
    expect(validation.ok, validation.reason || 'validation failed').toBe(true);
    expect(validation.requiredCurrentFactCount).toBe(3);
    expect(validation.coveredCurrentFactCount).toBe(3);
    expect(validation.requiredPriorFactCount).toBe(3);
    expect(validation.coveredPriorFactCount).toBe(3);
    expect(validation.durationExpressionCount).toBe(1);
    expect(generated).toContain('Trenutno radim kao');
  });

  it('rejects the former obavljam/obavljala/obavljao poslove kao role shell', () => {
    const source = manifest('female', 'Specijalistica logistike', 'Koordinatorica operacija');
    const safe = buildSummaryV2StyledDeterministicText(source, 'professional');
    const malformed = safe
      .replace(/Trenutno (?:radim|djelujem) kao/iu, 'Trenutno obavljam poslove kao')
      .replace(/Prethodno sam (?:radila|djelovala) kao/iu, 'Prethodno sam obavljala poslove kao');

    const native = evaluateSummaryV2NativeSurface({
      text: malformed,
      locale: 'hr',
      hasCurrent: true,
      hasPrior: true,
      gender: 'female',
    });
    const validation = validateSummaryV2AgainstManifest(malformed, source, {
      trustedConstructionAuthority: true,
      candidateSource: 'final_selected',
    });

    expect(native.nativeSurfaceValidationPassed).toBe(false);
    expect(native.nativeSurfaceRejectionReasons).toContain(
      'unnatural_coordination:hr_awkward_professional_role_intro',
    );
    expect(validation.ok).toBe(false);
    expect(validation.reason).toBe('hr_awkward_professional_role_intro');
  });
});
