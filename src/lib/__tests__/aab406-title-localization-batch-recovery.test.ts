import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
  prepareExportLocalizedTitles,
  type ExportTitleLocalizationTransportInput,
} from '@/lib/cv-export-title-localization';

function experience(
  id: string,
  position: string,
  company: string,
  description: string,
  isPresent = false,
): WorkExperience {
  return {
    id,
    position,
    company,
    startDate: '2023-01',
    endDate: isPresent ? '' : '2025-12',
    isPresent,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'de',
    positionSourceLocale: 'de',
    positionProvenance: 'manual',
    positionUserEdited: true,
  };
}

function fixture(): CVData {
  return {
    id: 'aab406-title-cv',
    name: 'John wayn',
    personal: {
      fullName: 'John wayn',
      email: 'john@example.test',
      phone: '337373737',
      address: 'xjdjdjxh',
      jobTitle: 'Koordinator für E-Bike-Service und Kundenannahme',
      gender: 'male',
    },
    summary: 'Cuento con experiencia profesional en RadWerk y StadtHotel.',
    canonicalSummary: 'Cuento con experiencia profesional en RadWerk y StadtHotel.',
    summaryOrigin: 'user',
    contentLocale: 'es',
    experience: [
      experience(
        'current',
        'Koordinator für E-Bike-Service und Kundenannahme',
        'RadWerk',
        'Koordiniert Wartungstermine für E-Bikes.',
        true,
      ),
      experience(
        'prior',
        'Mitarbeiter für Gästeempfang und Reservierungsverwaltung',
        'StadtHotel',
        'Begrüßte Gäste an der Rezeption.',
      ),
      experience(
        'bike',
        'Fahrradmechaniker',
        'RadWerk',
        'Führt Wartungsarbeiten an Fahrrädern durch.',
      ),
      experience(
        'hotel',
        'Rezeptionist',
        'StadtHotel',
        'Begrüßte Gäste professionell an der Rezeption.',
      ),
    ],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01',
    updatedAt: '2026-08-07',
    runtimeMigrationVersion: 3,
  };
}

const localizedTitles = new Map<string, string>([
  [
    'Koordinator für E-Bike-Service und Kundenannahme',
    'Coordinador de servicio de bicicletas eléctricas y atención al cliente',
  ],
  [
    'Mitarbeiter für Gästeempfang und Reservierungsverwaltung',
    'Empleado de recepción de huéspedes y gestión de reservas',
  ],
  ['Fahrradmechaniker', 'Mecánico de bicicletas'],
  ['Rezeptionist', 'Recepcionista'],
]);

function success(input: ExportTitleLocalizationTransportInput) {
  return {
    targetLocale: input.targetLocale,
    entries: input.entries.map((entry) => ({
      entryId: entry.entryId,
      localizedRoleTitle: localizedTitles.get(entry.roleTitle) || `ES ${entry.roleTitle}`,
      facts: [],
    })),
  };
}

describe('AAB-406 export-title batch recovery', () => {
  it('isolates a rejected mixed batch and recovers without changing source titles or employers', async () => {
    const source = fixture();
    const callSizes: number[] = [];
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      gender: 'male',
      getCurrentCv: () => source,
      adapter: async (input) => {
        callSizes.push(input.entries.length);
        const titles = input.entries.map((entry) => entry.roleTitle);
        const containsBothLongTitles = titles.includes(
          'Koordinator für E-Bike-Service und Kundenannahme',
        ) && titles.includes(
          'Mitarbeiter für Gästeempfang und Reservierungsverwaltung',
        );
        if (containsBothLongTitles && input.entries.length > 1) {
          throw new Error('export_title_localization_independent_verification_failed');
        }
        return success(input);
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(callSizes).toEqual([4, 4, 2, 2, 1, 1, 2]);
    expect(result.exportCv.personal.jobTitle).toBe(
      'Coordinador de servicio de bicicletas eléctricas y atención al cliente',
    );
    expect(result.exportCv.experience.map((entry) => entry.position)).toEqual([
      'Coordinador de servicio de bicicletas eléctricas y atención al cliente',
      'Empleado de recepción de huéspedes y gestión de reservas',
      'Mecánico de bicicletas',
      'Recepcionista',
    ]);
    expect(result.exportCv.experience.map((entry) => entry.company)).toEqual([
      'RadWerk',
      'StadtHotel',
      'RadWerk',
      'StadtHotel',
    ]);
    expect(source.personal.jobTitle).toBe('Koordinator für E-Bike-Service und Kundenannahme');
    expect(source.experience.map((entry) => entry.position)).toEqual([
      'Koordinator für E-Bike-Service und Kundenannahme',
      'Mitarbeiter für Gästeempfang und Reservierungsverwaltung',
      'Fahrradmechaniker',
      'Rezeptionist',
    ]);
    expect(result.diagnostics).toMatchObject({
      titleBatchRecoveryRevision: CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
      titleBatchSplitCount: 2,
      titleSingletonFailureCount: 0,
      titleLastProviderFailureReason: 'export_title_localization_independent_verification_failed',
      titleProviderRequestCount: 7,
      titleProviderRepairCount: 2,
      titleLocalizedFieldCount: 5,
      titleProjectionPassed: true,
      employerIdentityPassed: true,
    });
  });

  it('fails atomically with the exact typed reason when one isolated title still cannot verify', async () => {
    const source = fixture();
    const sourceBefore = structuredClone(source);
    const exportBefore = structuredClone(source);
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: exportBefore,
      targetLocale: 'es',
      gender: 'male',
      getCurrentCv: () => source,
      adapter: async (input) => {
        if (input.entries.some((entry) => (
          entry.roleTitle === 'Mitarbeiter für Gästeempfang und Reservierungsverwaltung'
        ))) {
          throw new Error('export_title_localization_independent_verification_failed');
        }
        return success(input);
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('export_title_localization_independent_verification_failed');
    expect(result.persistableCv).toEqual(sourceBefore);
    expect(result.exportCv).toEqual(exportBefore);
    expect(source).toEqual(sourceBefore);
    expect(result.diagnostics).toMatchObject({
      titleBatchRecoveryRevision: CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
      titleSingletonFailureCount: 1,
      titleLastProviderFailureReason: 'export_title_localization_independent_verification_failed',
      titleLocalizedFieldCount: 0,
      titleProjectionPassed: false,
      employerIdentityPassed: false,
      titleFailureReason: 'export_title_localization_independent_verification_failed',
    });
  });

  it('does not fan out non-isolatable transport failures and preserves their failure identity', async () => {
    const source = fixture();
    let calls = 0;
    const result = await prepareExportLocalizedTitles({
      sourceCv: source,
      exportCv: structuredClone(source),
      targetLocale: 'es',
      gender: 'male',
      adapter: async () => {
        calls += 1;
        throw new Error('experience_localization_operation_deadline_exceeded');
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(calls).toBe(2);
    expect(result.reason).toBe('experience_localization_operation_deadline_exceeded');
    expect(result.diagnostics).toMatchObject({
      titleBatchRecoveryRevision: CV_EXPORT_TITLE_BATCH_RECOVERY_REVISION,
      titleBatchSplitCount: 0,
      titleSingletonFailureCount: 0,
      titleLastProviderFailureReason: 'experience_localization_operation_deadline_exceeded',
      titleFailureReason: 'experience_localization_operation_deadline_exceeded',
    });
  });
});
