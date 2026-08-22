import { describe, expect, it } from 'vitest';
import type { Locale } from '@/lib/i18n/translations';
import { languages } from '@/lib/i18n/translations';
import type { CVData, WorkExperience } from '@/lib/types';
import { getCvContentLocale } from '@/lib/cv-simple-v1';
import {
  clearKnownRoleIdentityForManualPositionEdit,
  getRoleDisplayTitle,
  isKnownRoleKey,
  projectExperienceRoleDisplayTitles,
  resolveExperienceRoleDisplayTitle,
  SIMPLE_V1_KNOWN_ROLE_KEYS,
} from '@/lib/cv-known-role-simple-v1';

const WAREHOUSE_TITLES: Record<Locale, string> = {
  sr: 'Radnik u magacinu',
  en: 'Warehouse Employee',
  hi: 'वेयरहाउस कर्मचारी',
  ar: 'موظف مستودع',
  ja: '倉庫作業員',
  de: 'Lagermitarbeiter',
  fr: 'Employé d’entrepôt',
  es: 'Empleado de almacén',
  it: 'Addetto al magazzino',
  hr: 'Radnik u skladištu',
  'pt-BR': 'Funcionário de armazém',
  ru: 'Кладовщик',
};

function experience(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'role-1',
    company: 'Example Company',
    position: 'Graphic Designer',
    positionProvenance: 'occupation_option',
    positionSourceKey: 'graphic_designer',
    positionSourceLocale: 'en',
    startDate: '2024-01',
    endDate: '',
    isPresent: true,
    description: 'Creates visual layouts.',
    ...overrides,
  };
}

function cvWith(entry: WorkExperience): CVData {
  return {
    id: 'known-role-cv',
    name: 'Known role CV',
    personal: {
      fullName: 'Mila Petrović',
      email: '',
      phone: '',
      address: '',
      jobTitle: '',
      gender: 'female',
    },
    summary: 'User-owned Summary remains unchanged.',
    contentLocale: 'sr',
    experience: [entry],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'Balkan',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-22T00:00:00.000Z',
  };
}

describe('Simple V1 known-role identity and display authority', () => {
  it('1. reuses positionSourceKey as the stable identity for app-known selections', () => {
    const selected = experience();
    expect(selected.positionProvenance).toBe('occupation_option');
    expect(selected.positionSourceKey).toBe('graphic_designer');
    expect(isKnownRoleKey(selected.positionSourceKey)).toBe(true);
    expect(SIMPLE_V1_KNOWN_ROLE_KEYS).toEqual(['graphic_designer', 'warehouse_worker']);
  });

  it('2. arbitrary free text has no known identity and stays byte-for-byte exact', () => {
    const rawPosition = '  Lead Visual Unicorn Designer  ';
    expect(getRoleDisplayTitle({
      rawPosition,
      contentLocale: 'sr',
      gender: 'female',
    })).toBe(rawPosition);
  });

  it('3. never infers a known role from recognizable or translated free text', () => {
    expect(getRoleDisplayTitle({
      rawPosition: 'Graphic Designer',
      contentLocale: 'sr',
      gender: 'female',
    })).toBe('Graphic Designer');
    expect(getRoleDisplayTitle({
      rawPosition: 'Skladišni radnik',
      contentLocale: 'en',
      gender: 'male',
    })).toBe('Skladišni radnik');
  });

  it('4. an unknown persisted key fails conservatively to the raw title', () => {
    expect(getRoleDisplayTitle({
      roleKey: 'future_unknown_role',
      rawPosition: 'Custom Operations Lead',
      contentLocale: 'fr',
      gender: 'female',
    })).toBe('Custom Operations Lead');
    expect(isKnownRoleKey('future_unknown_role')).toBe(false);
  });

  it('5. display resolution never mutates the stored Experience.position', () => {
    const stored = experience();
    const before = structuredClone(stored);
    expect(resolveExperienceRoleDisplayTitle(stored, 'sr', 'female'))
      .toBe('Grafička dizajnerka');
    expect(stored).toEqual(before);
    expect(stored.position).toBe('Graphic Designer');
  });

  it('6. presentation projection changes only the copied known-role surface', () => {
    const stored = experience();
    const projected = projectExperienceRoleDisplayTitles([stored], 'sr', 'female');
    expect(projected[0]).not.toBe(stored);
    expect(projected[0].position).toBe('Grafička dizajnerka');
    expect(projected[0].company).toBe(stored.company);
    expect(stored.position).toBe('Graphic Designer');
  });

  it('7. a manual position edit clears catalog identity without changing raw text', () => {
    const edited = cvWith(experience({
      position: 'Lead Visual Unicorn Designer',
      positionProvenance: 'manual',
      positionUserEdited: true,
    }));
    const cleared = clearKnownRoleIdentityForManualPositionEdit(edited, 'role-1');
    expect(cleared.experience[0].position).toBe('Lead Visual Unicorn Designer');
    expect(cleared.experience[0].positionSourceKey).toBeUndefined();
    expect(edited.experience[0].positionSourceKey).toBe('graphic_designer');
  });

  it('8. clearing a free-text entry is an identity-preserving no-op', () => {
    const freeText = experience({
      position: 'Lead Visual Unicorn Designer',
      positionProvenance: 'manual',
      positionSourceKey: undefined,
    });
    const source = cvWith(freeText);
    expect(clearKnownRoleIdentityForManualPositionEdit(source, 'role-1')).toBe(source);
  });

  it('9. Serbian Graphic Designer female surface is native', () => {
    expect(resolveExperienceRoleDisplayTitle(experience(), 'sr', 'female'))
      .toBe('Grafička dizajnerka');
  });

  it('10. Serbian Graphic Designer male surface is native', () => {
    expect(resolveExperienceRoleDisplayTitle(experience(), 'sr', 'male'))
      .toBe('Grafički dizajner');
  });

  it('11. unspecified Serbian Graphic Designer preserves the safe product default', () => {
    expect(resolveExperienceRoleDisplayTitle(experience(), 'sr'))
      .toBe('Grafički dizajner');
  });

  it('12. free-text Grafički dizajner is not feminized without identity', () => {
    expect(resolveExperienceRoleDisplayTitle(experience({
      position: 'Grafički dizajner',
      positionProvenance: 'manual',
      positionUserEdited: true,
      positionSourceKey: undefined,
    }), 'sr', 'female')).toBe('Grafički dizajner');
  });

  it.each(Object.entries(WAREHOUSE_TITLES) as Array<[Locale, string]>) (
    '13. known Warehouse Worker resolves to native product terminology in %s',
    (contentLocale, expected) => {
      expect(resolveExperienceRoleDisplayTitle(experience({
        position: 'Skladišni radnik',
        positionSourceKey: 'warehouse_worker',
      }), contentLocale)).toBe(expected);
    },
  );

  it('14. known Warehouse Worker has no Serbian leakage in historical target locales', () => {
    for (const contentLocale of ['en', 'fr', 'es', 'it', 'pt-BR', 'ar'] as const) {
      const title = resolveExperienceRoleDisplayTitle(experience({
        position: 'Skladišni radnik',
        positionSourceKey: 'warehouse_worker',
      }), contentLocale);
      expect(title, contentLocale).toBe(WAREHOUSE_TITLES[contentLocale]);
      expect(title, contentLocale).not.toContain('Skladišni radnik');
    }
  });

  it('15. the matrix is exactly the product supported-locale set', () => {
    expect(new Set(Object.keys(WAREHOUSE_TITLES)))
      .toEqual(new Set(languages.map((language) => language.code)));
    expect(Object.keys(WAREHOUSE_TITLES)).toHaveLength(12);
  });

  it('16. uiLocale changes cannot change a fixed cv.contentLocale role surface', () => {
    const source = cvWith(experience());
    for (const uiLocale of ['de', 'en', 'ar', 'ja'] as const) {
      const contentLocale = getCvContentLocale(source, { uiLocale });
      expect(contentLocale).toBe('sr');
      expect(resolveExperienceRoleDisplayTitle(source.experience[0], contentLocale, 'female'))
        .toBe('Grafička dizajnerka');
    }
  });

  it('17. only an explicit contentLocale change changes known-role language', () => {
    const source = cvWith(experience());
    const germanCv = { ...source, contentLocale: 'de' as const };
    expect(resolveExperienceRoleDisplayTitle(
      source.experience[0],
      getCvContentLocale(source, { uiLocale: 'de' }),
      'female',
    )).toBe('Grafička dizajnerka');
    expect(resolveExperienceRoleDisplayTitle(
      germanCv.experience[0],
      getCvContentLocale(germanCv, { uiLocale: 'sr' }),
      'female',
    )).toBe('Grafikdesignerin');
    expect(source.experience[0].position).toBe('Graphic Designer');
  });

  it('18. gender-neutral Japanese role surfaces do not change by gender', () => {
    const knownWarehouse = experience({ positionSourceKey: 'warehouse_worker' });
    expect(resolveExperienceRoleDisplayTitle(knownWarehouse, 'ja', 'female')).toBe('倉庫作業員');
    expect(resolveExperienceRoleDisplayTitle(knownWarehouse, 'ja', 'male')).toBe('倉庫作業員');
  });
});
