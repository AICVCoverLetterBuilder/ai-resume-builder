import { describe, expect, it } from 'vitest';
import type { SummaryV2EntryOwned, SummaryV2LocalizationProviderResponse, SummaryV2SelectionManifest } from '@/lib/cv-summary-v2';
import {
  acceptSummaryV2LocalizationResponse,
  hashSummaryV2Text,
  projectLocalizedSummaryV2Manifest,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import { buildEntryOwnedFactsFromLiveDescription } from '@/lib/cv-summary-v2/facts';

const ROLE_SOURCE = 'Grafički dizajner';
const ROLE_FEMALE = 'Grafička dizajnerica';
const DUTIES = [
  'Priprema grafičke materijale za digitalne medije.',
  'Razvija vizualne koncepte prema potrebama klijenata.',
  'Pregledava dizajnerske projekte i provjerava kvalitetu završnih rezultata.',
];

function entry(id: string, state: 'present' | 'completed'): SummaryV2EntryOwned {
  return {
    entryId: id,
    role: ROLE_SOURCE,
    sourceRoleTitle: ROLE_SOURCE,
    employer: id,
    startDate: state === 'present' ? '2022-01' : '2018-01',
    endDate: state === 'present' ? '' : '2021-12',
    isPresent: state === 'present',
    employmentState: state,
    sourceRoleTitleHash: hashSummaryV2Text(ROLE_SOURCE),
    roleSourceLocale: 'sr',
    sourceLocale: 'sr',
    descriptionHash: `description-${id}`,
    facts: buildEntryOwnedFactsFromLiveDescription({
      entryId: id,
      liveDescription: DUTIES.join('\n'),
      sourceLocale: 'sr',
    }),
  };
}

function manifest(): SummaryV2SelectionManifest {
  const current = entry('current', 'present');
  const testWerk = entry('testwerk', 'completed');
  const rewitu = entry('rewitu', 'completed');
  return {
    revision: 'aab472-role-title-gender',
    snapshotHash: 'snapshot-aab472',
    locale: 'hr',
    gender: 'female',
    totalDurationMonths: 86,
    durationPhrase: 'oko sedam godina',
    styleHintUsed: false,
    current,
    priors: [testWerk, rewitu],
    requiredCurrentFacts: current.facts,
    requiredPriorFacts: [...testWerk.facts, ...rewitu.facts],
    maxDutiesPerEntry: 3,
  };
}

function response(manifestValue: SummaryV2SelectionManifest, testWerkRole: string): SummaryV2LocalizationProviderResponse {
  return {
    targetLocale: 'hr',
    entries: [manifestValue.current!, ...manifestValue.priors].map((source) => ({
      entryId: source.entryId,
      localizedRoleTitle: source.entryId === 'testwerk' ? testWerkRole : ROLE_FEMALE,
      facts: source.facts.map((fact) => ({ factId: fact.factId, localizedText: fact.bulletText })),
    })),
  };
}

describe('AAB472 Croatian Summary role-title gender/native-surface contract', () => {
  it('rejects one masculine foreign-localized prior title under a female Croatian target', () => {
    const source = manifest();
    const result = acceptSummaryV2LocalizationResponse({
      manifest: source,
      response: response(source, ROLE_SOURCE),
      source: 'provider',
    });
    expect(result.manifest).toBeNull();
    expect(result.validation.ok).toBe(false);
    expect(result.validation.reason).toBe('foreign_role_title_gender_mismatch');
  });

  it('accepts repaired feminine titles and preserves entry-owned facts through projection and final validation', () => {
    const source = manifest();
    const result = acceptSummaryV2LocalizationResponse({
      manifest: source,
      response: response(source, ROLE_FEMALE),
      source: 'provider_repair',
    });
    expect(result.manifest).not.toBeNull();
    const projected = projectLocalizedSummaryV2Manifest({ manifest: source, localized: result.manifest! });
    expect(projected).not.toBeNull();
    expect([projected!.current!, ...projected!.priors].map((entryValue) => entryValue.role))
      .toEqual([ROLE_FEMALE, ROLE_FEMALE, ROLE_FEMALE]);
    expect(projected!.requiredCurrentFacts).toHaveLength(3);
    expect(projected!.requiredPriorFacts).toHaveLength(6);
    const summary = [
      'Imam oko sedam godina iskustva.',
      `Trenutačno radim kao ${ROLE_FEMALE} u currentu, gdje ${DUTIES[0]!.toLocaleLowerCase()} ${DUTIES[1]!.toLocaleLowerCase()} ${DUTIES[2]!.toLocaleLowerCase()}`,
      `Prethodno sam radila kao ${ROLE_FEMALE} u testwerku, gdje ${DUTIES[0]!.toLocaleLowerCase()} ${DUTIES[1]!.toLocaleLowerCase()} ${DUTIES[2]!.toLocaleLowerCase()}`,
      `Prethodno sam radila kao ${ROLE_FEMALE} u rewitu, gdje ${DUTIES[0]!.toLocaleLowerCase()} ${DUTIES[1]!.toLocaleLowerCase()} ${DUTIES[2]!.toLocaleLowerCase()}`,
    ].join(' ');
    const validation = validateSummaryV2AgainstManifest(summary, projected!, {
      trustedConstructionAuthority: true,
    });
    expect(validation.roleTitleGenderValidationPassed).toBe(true);
    expect(validation.roleTitleSurfaceValidationPassed).toBe(true);
    expect(validation.requiredCurrentFactCount).toBe(3);
    expect(validation.requiredPriorFactCount).toBe(6);
  });
});
