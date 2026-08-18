import { describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import { validateSummaryV2AgainstManifest } from '@/lib/cv-summary-v2/validator';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { buildAndStoreCvExportDiagnostic } from '@/lib/cv-export-diagnostics';

const CURRENT = [
  'Pripremam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređujem grafike i slike za različite projekte.',
  'Usklađujem nacrte i izmene sa članovima projektnog tima.',
].join('\n');
const PRIOR = [
  'Izrađivala sam grafičke materijale za štampane i digitalne medije.',
  'Razvijala sam koncepte vizuelnog dizajna prema potrebama klijenata.',
  'Pregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.',
].join('\n');

function entry(
  id: string, role: string, company: string, startDate: string, isPresent: boolean, description: string,
): WorkExperience {
  return {
    id, position: role, company, startDate, endDate: isPresent ? '' : '2025-12', isPresent,
    description, originalUserDescription: description, canonicalDescription: description,
    descriptionOrigin: 'deterministic_fallback', generatedDescription: description,
    generatedLocale: 'sr', descriptionSourceLocale: 'sr',
  };
}

function deviceCv(summary = ''): CVData {
  return {
    id: 'aab477-stale-summary', name: 'AAB477',
    personal: {
      fullName: 'Test Person', email: 'test@example.test', phone: '', address: '',
      jobTitle: 'Grafička dizajnerica', gender: 'female', photoEnabled: false,
    },
    summary, summaryOrigin: 'deterministic_fallback', summaryGeneratedLocale: 'sr', contentLocale: 'sr',
    experience: [
      entry('atlas-current', 'Skladišna radnica', 'Atlas', '2023-01', true,
        'Proverava pristiglu robu.\nProverava prateću dokumentaciju.\nSarađuje sa kolegama na pripremi robe.'),
      entry('rewitu-current', 'Grafička dizajnerica', 'Rewitu Current Test', '2026-03', true, CURRENT),
      entry('testwerk-prior', 'Grafička dizajnerica', 'TestWerk GmbH', '2021-01', false, PRIOR),
      entry('rewitu-prior', 'Grafička dizajnerica', 'Rewitu', '2018-01', false, PRIOR),
      entry('omitted-role', 'Operaterka', 'Omitted Co', '2016-01', false, 'Vodila sam evidenciju smena.'),
    ],
    education: [], skills: [], certifications: [], languages: [], templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

function manifestFor(cv: CVData) {
  return buildSummaryV2SelectionManifest(captureSummaryV2Snapshot({
    cv, locale: 'sr', gender: 'female', referenceDateIso: '2026-08-18',
  }));
}

describe('AAB477 — stale app-owned Summary recovery', () => {
  it('localizes target role surfaces before Serbian final locale validation and preserves exact entry ownership', () => {
    const initial = deviceCv();
    const sourceManifest = manifestFor(initial);
    expect(sourceManifest.current?.entryId).toBe('rewitu-current');
    expect(sourceManifest.priors.map((entry) => entry.entryId)).toEqual(['testwerk-prior', 'rewitu-prior']);

    const rawBeforeRecovery = buildSummaryV2DeterministicText(sourceManifest);
    const rawPurity = validateAiUnitLocalePurity(rawBeforeRecovery, 'sr', {
      kind: 'summary_sentence', requireUnits: true,
    });
    // The AAB476 false negative: Croatian feminine role labels are present in
    // a Serbian shell before target-title projection, so this must not be the
    // candidate submitted to final recovery validation.
    expect(rawBeforeRecovery).toContain('Grafička dizajnerica');
    expect(rawPurity.ok).toBe(false);
    expect(rawPurity.reason).toBe('wrong_language');

    const stale = rawBeforeRecovery.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    );
    const savedValidation = validateSummaryV2AgainstManifest(stale, sourceManifest, {
      candidateSource: 'final_selected',
    });
    expect(savedValidation.relationalOwnershipValidationPassed).toBe(false);
    expect(savedValidation.relationalOwnershipFailureReasons).toEqual(expect.arrayContaining([
      'foreign_employer_attached_to_role_unit',
      'foreign_start_date_attached_to_role_unit',
    ]));

    const prepared = prepareExportReadyCv(deviceCv(stale), 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;

    const final = prepared.cv.summary;
    expect(final).toContain('Grafička dizajnerka u Rewitu Current Test');
    expect(final).not.toContain('dizajnerica');
    expect(final).not.toContain('Atlas');
    expect(final).not.toContain('januara 2023');
    expect(validateAiUnitLocalePurity(final, 'sr', {
      kind: 'summary_sentence', requireUnits: true,
    }).ok).toBe(true);
    expect(prepared.diagnostics).toMatchObject({
      summaryRecoverySource: 'deterministic_v2_manifest',
      summaryValidationAuthoritySource: 'app_owned_v2_manifest',
      savedSummaryOwnershipPassed: false,
      savedSummaryJobContextPassed: false,
      recoveryCandidateLocaleValidationPassed: true,
      recoveryCandidateNativeSurfacePassed: true,
      recoveryCandidateOwnershipPassed: true,
      summaryRelationalOwnershipPassed: true,
      summaryFactSetSource: 'app_owned_v2_manifest',
      selectedFinalSource: 'deterministic_v2_manifest',
    });
    expect(prepared.diagnostics.savedSummaryOwnershipFailureReasons).toEqual(expect.arrayContaining([
      'foreign_employer_attached_to_role_unit',
      'foreign_start_date_attached_to_role_unit',
    ]));
    expect(prepared.diagnostics.recoveryCandidateRejectionReasons).toEqual([]);
    expect(prepared.diagnostics.recoveryDetectedLocaleByUnit).toEqual(['sr', 'sr', 'sr', 'sr']);
    expect(prepared.diagnostics.recoveryDetectedScriptByUnit).toHaveLength(4);
    const finalHash = hashSummaryV2Text(final || '');
    expect(prepared.diagnostics.selectedFinalSummaryHash).toBe(finalHash);
    expect(prepared.diagnostics.visiblePreviewSummaryHash).toBe(finalHash);
    expect(prepared.diagnostics.exportSummaryHash).toBe(finalHash);
    const exportTrace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'sr', rawCv: deviceCv(stale), prepared,
    });
    expect(exportTrace).toMatchObject({
      savedSummaryOwnershipPassed: false,
      recoveryCandidateLocaleValidationPassed: true,
      recoveryCandidateOwnershipPassed: true,
      selectedFinalSummaryHash: finalHash,
      visiblePreviewSummaryHash: finalHash,
      exportSummaryHash: finalHash,
    });
    const current = prepared.diagnostics.summaryFinalUnitOwnership?.find((unit) => unit.roleSlot === 'current_role');
    expect(current?.owningEntryHash).toBe(current?.roleTitleOwnerEntryHash);
    expect(current?.owningEntryHash).toBe(current?.employerOwnerEntryHash);
    expect(current?.dutyFactOwnerEntryHashes).toEqual([current?.owningEntryHash]);
  });

  it('continues rejecting actual Croatian, Hindi and Arabic leakage in a Serbian recovery candidate', () => {
    const manifest = manifestFor(deviceCv());
    const raw = buildSummaryV2DeterministicText(manifest);
    const candidates = [
      raw,
      raw.replace('Pripremam vizuelne koncepte', 'मैं दृश्य अवधारणाएँ तैयार करती हूँ'),
      raw.replace('Pripremam vizuelne koncepte', 'أُعِدّ مفاهيم بصرية'),
    ];
    for (const candidate of candidates) {
      expect(validateAiUnitLocalePurity(candidate, 'sr', {
        kind: 'summary_sentence', requireUnits: true,
      }).ok).toBe(false);
    }
  });

  it('leaves a manual Summary outside the app-owned automatic recovery rule', () => {
    const initial = deviceCv();
    const valid = buildSummaryV2DeterministicText(manifestFor(initial))
      .replaceAll('Grafička dizajnerica', 'Grafička dizajnerka');
    const manual = { ...initial, summary: valid, summaryOrigin: 'user' as const };
    const prepared = prepareExportReadyCv(manual, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.diagnostics.summaryValidationAuthoritySource).toBe('manual_saved_summary');
    expect(prepared.diagnostics.summarySavedSummaryReboundRevalidated).toBe(false);
    expect(['saved_summary', 'bounded_saved_summary']).toContain(
      prepared.diagnostics.summaryRecoverySource,
    );
  });
});
