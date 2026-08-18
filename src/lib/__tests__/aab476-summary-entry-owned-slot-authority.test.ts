import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { validateSummaryV2AgainstManifest } from '@/lib/cv-summary-v2/validator';

const DESIGN_CURRENT = [
  'Pripremam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređujem grafike i slike za različite projekte.',
  'Usklađujem nacrte i izmene sa članovima projektnog tima.',
].join('\n');

const DESIGN_PRIOR = [
  'Izrađivala sam grafičke materijale za štampane i digitalne medije.',
  'Razvijala sam koncepte vizuelnog dizajna prema potrebama klijenata.',
  'Pregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.',
].join('\n');

const WAREHOUSE_CURRENT = [
  'Proverava pristiglu robu.',
  'Proverava prateću dokumentaciju.',
  'Sarađuje sa kolegama na pripremi i premeštanju robe.',
].join('\n');

function entry(options: {
  id: string;
  role: string;
  employer: string;
  startDate: string;
  isPresent: boolean;
  duties: string;
}): WorkExperience {
  return {
    id: options.id,
    position: options.role,
    company: options.employer,
    startDate: options.startDate,
    endDate: options.isPresent ? '' : '2025-12',
    isPresent: options.isPresent,
    description: options.duties,
    originalUserDescription: options.duties,
    canonicalDescription: options.duties,
    descriptionOrigin: 'deterministic_fallback',
    generatedDescription: options.duties,
    generatedLocale: 'sr',
    descriptionSourceLocale: 'sr',
  };
}

function deviceCv(summary: string): CVData {
  const experience = [
    // Older current role deliberately comes first: array order must not decide
    // the Summary current owner.
    entry({
      id: 'atlas-current', role: 'Skladišna radnica', employer: 'Atlas',
      startDate: '2023-01', isPresent: true, duties: WAREHOUSE_CURRENT,
    }),
    entry({
      id: 'rewitu-current', role: 'Grafička dizajnerka', employer: 'Rewitu Current Test',
      startDate: '2026-03', isPresent: true, duties: DESIGN_CURRENT,
    }),
    entry({
      id: 'testwerk-prior', role: 'Grafička dizajnerka', employer: 'TestWerk GmbH',
      startDate: '2021-01', isPresent: false, duties: DESIGN_PRIOR,
    }),
    entry({
      id: 'rewitu-prior', role: 'Grafička dizajnerka', employer: 'Rewitu',
      startDate: '2018-01', isPresent: false, duties: DESIGN_PRIOR,
    }),
    entry({
      id: 'omitted-role', role: 'Operaterka', employer: 'Omitted Co',
      startDate: '2016-01', isPresent: false, duties: 'Vodila sam evidenciju smena.',
    }),
  ];
  return {
    id: 'aab476-summary-entry-authority',
    name: 'AAB476',
    personal: {
      fullName: 'Test Person', email: 'test@example.test', phone: '', address: '',
      jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false,
    },
    summary,
    summaryOrigin: 'deterministic_fallback',
    summaryGeneratedLocale: 'sr',
    contentLocale: 'sr',
    experience,
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

function manifestFor(cv: CVData) {
  return buildSummaryV2SelectionManifest(captureSummaryV2Snapshot({
    cv,
    locale: 'sr',
    gender: 'female',
    referenceDateIso: '2026-08-18',
  }));
}

describe('AAB476 — Summary entry-owned employer/date authority', () => {
  it('rejects the exact Rewitu-current / Atlas-employer-date splice and rebuilds from selected entry authority', () => {
    const provisional = deviceCv('');
    const manifest = manifestFor(provisional);
    expect(manifest.current?.entryId).toBe('rewitu-current');
    expect(manifest.priors.map((item) => item.entryId)).toEqual(['testwerk-prior', 'rewitu-prior']);

    const authoritative = buildSummaryV2DeterministicText(manifest);
    const contaminated = authoritative.replace(
      'u Rewitu Current Test',
      'u Rewitu Current Test, u kompaniji Atlas od januara 2023. godine',
    );
    expect(contaminated).toContain('Rewitu Current Test, u kompaniji Atlas od januara 2023');

    const rejected = validateSummaryV2AgainstManifest(contaminated, manifest, {
      candidateSource: 'final_selected',
    });
    expect(rejected.ok).toBe(false);
    expect(rejected.relationalOwnershipValidationPassed).toBe(false);
    expect(rejected.relationalOwnershipFailureReasons).toEqual(expect.arrayContaining([
      'foreign_employer_attached_to_role_unit',
      'foreign_start_date_attached_to_role_unit',
    ]));

    const prepared = prepareExportReadyCv(deviceCv(contaminated), 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.summary).not.toContain('Rewitu Current Test, u kompaniji Atlas');
    expect(prepared.cv.summary).toContain('Grafička dizajnerka u Rewitu Current Test');
    expect(prepared.cv.summary).not.toContain('u kompaniji Atlas od januara 2023');
    expect(prepared.diagnostics.summaryRecoverySource).toBe('deterministic_v2_manifest');
    expect(prepared.diagnostics.summaryValidationAuthoritySource).toBe('app_owned_v2_manifest');
    expect(prepared.diagnostics.summarySavedProvenance).toBe('deterministic_fallback');
    expect(prepared.diagnostics.summarySavedSummaryReboundRevalidated).toBe(true);
    expect(prepared.diagnostics.summaryRelationalOwnershipPassed).toBe(true);
    expect(prepared.diagnostics.summaryRelationalOwnershipFailureReasons).toEqual([]);
    expect(prepared.diagnostics.summarySelectedEntryHashes).toHaveLength(3);
    expect(prepared.diagnostics.summaryOmittedEntryHashes).toHaveLength(2);
    expect(prepared.diagnostics.summaryRequiredFactHashes).toHaveLength(9);
    const currentUnit = prepared.diagnostics.summaryFinalUnitOwnership?.find(
      (unit) => unit.roleSlot === 'current_role',
    );
    expect(currentUnit?.owningEntryHash).toBe(currentUnit?.roleTitleOwnerEntryHash);
    expect(currentUnit?.owningEntryHash).toBe(currentUnit?.employerOwnerEntryHash);
    expect(currentUnit?.dutyFactOwnerEntryHashes).toEqual([currentUnit?.owningEntryHash]);
  });

  it('rejects employer, date, duty and prior-employer cross-entry relationships even when all facts exist', () => {
    const cv = deviceCv('');
    const manifest = manifestFor(cv);
    const valid = buildSummaryV2DeterministicText(manifest);
    const validValidation = validateSummaryV2AgainstManifest(valid, manifest, {
      candidateSource: 'deterministic', preserveConstructionOrder: true, trustedConstructionAuthority: true,
    });
    expect(validValidation.ok).toBe(true);

    const mutations = [
      {
        candidate: valid.replace('u Rewitu Current Test', 'u Rewitu Current Test i u Atlas'),
        reason: 'foreign_employer_attached_to_role_unit',
      },
      {
        candidate: valid.replace('u Rewitu Current Test', 'u Rewitu Current Test od januara 2023. godine'),
        reason: 'foreign_start_date_attached_to_role_unit',
      },
      {
        candidate: valid.replace(
          'usklađujem nacrte i izmene sa članovima projektnog tima.',
          'usklađujem nacrte i izmene sa članovima projektnog tima i proverava pristiglu robu.',
        ),
        reason: 'foreign_duty_fact_attached_to_role_unit',
      },
      {
        candidate: valid.replace('u TestWerk GmbH', 'u TestWerk GmbH i u Rewitu'),
        reason: 'foreign_employer_attached_to_role_unit',
      },
    ];
    for (const { candidate, reason } of mutations) {
      const validation = validateSummaryV2AgainstManifest(candidate, manifest, {
        candidateSource: 'final_selected',
      });
      expect(validation.ok, reason).toBe(false);
      expect(validation.relationalOwnershipValidationPassed).toBe(false);
      expect(validation.relationalOwnershipFailureReasons).toContain(reason);
    }
  });

  it('does not force manual multi-employer Summary prose through app-owned V2 rebinding', () => {
    const cv = deviceCv('');
    const manifest = manifestFor(cv);
    const manual = {
      ...cv,
      summary: buildSummaryV2DeterministicText(manifest),
      summaryOrigin: 'user' as const,
    };
    const prepared = prepareExportReadyCv(manual, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.diagnostics.summaryValidationAuthoritySource).toBe('manual_saved_summary');
    expect(prepared.diagnostics.summarySavedSummaryReboundRevalidated).toBe(false);
  });
});
