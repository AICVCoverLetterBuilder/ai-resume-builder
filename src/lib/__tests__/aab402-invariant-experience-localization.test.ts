import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { recoverSemanticDutiesFromUserOrigin } from '@/lib/cv-semantic-duty-facts';
import { hashExperienceSourceLocaleText } from '@/lib/cv-experience-source-locale';
import {
  EXPERIENCE_LOCALIZATION_INVARIANT_PASSTHROUGH_REVISION,
  EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
  buildExperienceLocalizationSnapshot,
  hashExperienceLocalizedSurfaceValue,
  isExperienceLocalizationInvariantUnit,
  partitionExperienceLocalizationRecords,
  prepareExperienceLocalizedSurfaces,
  projectExperienceFromLocalizedSurfaces,
  type ExperienceLocalizationIndependentVerificationRecord,
  type ExperienceLocalizationProviderRecord,
  type ExperienceLocalizationRequest,
} from '@/lib/cv-experience-localized-surfaces';

const MARKER = 'AAB400-END-CHECK-7291';

function entry(id: string, duties: string[]): WorkExperience {
  const description = duties.join('\n');
  return {
    id,
    company: id === 'current' ? 'RadWerk' : 'StadtHotel',
    position: id === 'current' ? 'Fahrradmechaniker' : 'Rezeptionist',
    startDate: '2023-01',
    endDate: id === 'current' ? '' : '2022-12',
    isPresent: id === 'current',
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'de',
    descriptionSourceLocaleTextHash: hashExperienceSourceLocaleText(description),
  };
}

function cv(experience: WorkExperience[]): CVData {
  return {
    id: 'aab402-cv',
    name: 'AAB402',
    personal: {
      fullName: 'Test',
      email: '',
      phone: '',
      address: '',
      jobTitle: 'Fahrradmechaniker',
    },
    summary: '',
    experience,
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern-minimal',
    region: 'EU',
    createdAt: '2026-01-01',
    updatedAt: '2026-08-06',
    runtimeMigrationVersion: 3,
  };
}

function validResponse(request: ExperienceLocalizationRequest) {
  const records = request.records.map((record): ExperienceLocalizationProviderRecord => ({
    ...record,
    localizedText: 'Inspecciona las mercancías recibidas para detectar daños.',
    semanticValidation: {
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      predicatePreserved: true,
      objectPreserved: true,
      workDomainPreserved: true,
      scopePreserved: true,
      negationPreserved: true,
      tensePreserved: true,
      unsupportedFactsIntroduced: false,
    },
  }));
  const verificationRecords = records.map(
    (record): ExperienceLocalizationIndependentVerificationRecord => ({
      ...record,
      candidateSurfaceHash: hashExperienceLocalizedSurfaceValue(record.localizedText),
      decision: 'passed',
      mismatchCategory: 'none',
      predicatePreserved: true,
      objectPreserved: true,
      workDomainPreserved: true,
      sourceResponsibilityPreserved: true,
      scopePreserved: true,
      negationPreserved: true,
      tensePreserved: true,
      unsupportedFactsIntroduced: false,
      crossEntryFactIntroduced: false,
      crossOccupationSubstitution: false,
    }),
  );
  return {
    snapshotId: request.snapshotId,
    targetLocale: request.targetLocale,
    records,
    provenance: 'provider' as const,
    providerAttemptCount: 1,
    independentVerification: {
      snapshotId: request.snapshotId,
      targetLocale: request.targetLocale,
      validatorVersion: EXPERIENCE_LOCALIZATION_VALIDATOR_VERSION,
      records: verificationRecords,
      verifierAttemptCount: 1,
    },
  };
}

describe('AAB-402 invariant Experience localization passthrough', () => {
  it('classifies machine identifiers as invariant without exempting real prose', () => {
    expect(isExperienceLocalizationInvariantUnit(MARKER)).toBe(true);
    expect(isExperienceLocalizationInvariantUnit('ISO-9001')).toBe(true);
    expect(isExperienceLocalizationInvariantUnit('Q4 KPI')).toBe(true);
    expect(isExperienceLocalizationInvariantUnit('https://example.test/aab400')).toBe(true);
    expect(isExperienceLocalizationInvariantUnit('WARTUNG.')).toBe(false);
    expect(isExperienceLocalizationInvariantUnit(
      'Prüft Fahrräder auf technische Mängel.',
    )).toBe(false);
  });

  it('keeps the marker in the snapshot but removes it from provider batches', () => {
    const currentDuties = [
      ...Array.from({ length: 12 }, (_, index) => (
        `Prüft Vorgang Nummer ${index + 1} und dokumentiert den technischen Status.`
      )),
      MARKER,
    ];
    const priorDuties = [
      'Begrüßte Gäste professionell an der Rezeption.',
      'Erfasste und bearbeitete Reservierungen.',
      'Beantwortete Fragen der Gäste serviceorientiert.',
    ];
    const snapshot = buildExperienceLocalizationSnapshot(
      cv([entry('current', currentDuties), entry('prior', priorDuties)]),
      'es',
    );

    expect(snapshot.ok).toBe(true);
    expect(snapshot.records).toHaveLength(16);
    expect(snapshot.records.some((record) => record.sourceText === MARKER)).toBe(true);
    expect(snapshot.missingRecords).toHaveLength(15);
    expect(snapshot.missingRecords.some((record) => record.sourceText === MARKER)).toBe(false);
    expect(snapshot.diagnostics).toMatchObject({
      invariantPassthroughCount: 1,
      providerTranslatableRecordCount: 15,
      invariantPassthroughRevision:
        EXPERIENCE_LOCALIZATION_INVARIANT_PASSTHROUGH_REVISION,
    });

    const plan = partitionExperienceLocalizationRecords(snapshot.missingRecords);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.batches.map((batch) => batch.length)).toEqual([6, 6, 3]);
    }
  });

  it('translates prose, persists one surface, and projects the exact marker locally', async () => {
    let current = cv([
      entry('current', [
        'Prüft eingehende Waren auf Schäden.',
        MARKER,
      ]),
    ]);
    const requests: ExperienceLocalizationRequest[] = [];
    let persistCalls = 0;

    const result = await prepareExperienceLocalizedSurfaces({
      cv: current,
      targetLocale: 'es',
      adapter: async (request) => {
        requests.push(request);
        return validResponse(request);
      },
      getCurrentCv: () => current,
      persist: (next) => {
        persistCalls += 1;
        current = next;
        return true;
      },
    });

    expect(result.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0].records).toHaveLength(1);
    expect(requests[0].records[0].sourceText).not.toBe(MARKER);
    expect(result.diagnostics).toMatchObject({
      invariantPassthroughCount: 1,
      providerTranslatableRecordCount: 1,
      providerRequestCount: 1,
      independentVerifierRequestCount: 1,
      validatedRecordCount: 1,
      persistedSurfaceCount: 1,
    });
    expect(persistCalls).toBe(1);
    expect(Object.keys(current.experienceLocalizedSurfaces?.surfaces || {}))
      .toHaveLength(1);

    const grounding = recoverSemanticDutiesFromUserOrigin(
      current.experience[0],
      current.canonicalSnapshot,
    );
    const projected = projectExperienceFromLocalizedSurfaces({
      cv: current,
      exp: current.experience[0],
      grounding,
      targetLocale: 'es',
    });

    expect(splitExperienceBullets(projected || '')).toEqual([
      'Inspecciona las mercancías recibidas para detectar daños.',
      MARKER,
    ]);
  });

  it('keeps unchanged-provider-output rejection strict for real prose', async () => {
    const fs = await import('node:fs');
    const route = fs.readFileSync('src/app/api/generate/route.ts', 'utf8');
    expect(route).toContain(
      'candidate.localizedText === expectedById.get(candidate.requestIdentity)?.sourceText',
    );
  });
});