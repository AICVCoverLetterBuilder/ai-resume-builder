/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import type { CVData, WorkExperience } from '@/lib/types';
import { CV_DRAFT_STORAGE_KEY, clearCvDraft, loadCvDraft } from '@/lib/draft-storage';
import { buildCanonicalSnapshotFromCv } from '@/lib/cv-canonical-snapshot';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { templateComponents } from '@/components/cv-templates';
import { buildAndStoreCvExportDiagnostic } from '@/lib/cv-export-diagnostics';

function experience(
  id: string,
  company: string,
  position: string,
  startDate: string,
  endDate: string,
  isPresent: boolean,
  description: string,
): WorkExperience {
  return {
    id, company, position, startDate, endDate, isPresent, description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'sr',
  };
}

function currentCv(): CVData {
  return {
    id: 'canonical-coherence-fixture', name: 'Canonical coherence',
    personal: {
      fullName: 'Fixture User', email: 'fixture@example.test', phone: '', address: '',
      jobTitle: 'Dizajnerka vizuelnih sadržaja', gender: 'female', photoEnabled: false,
    },
    summary: 'Imam iskustvo u vizuelnom dizajnu i radu sa digitalnim materijalima.',
    summaryOrigin: 'deterministic_fallback', summaryGeneratedLocale: 'sr', contentLocale: 'sr',
    experience: [
      experience('current-studio', 'North Studio', 'Dizajnerka vizuelnih sadržaja', '2024-01', '', true,
        'Pripremam vizuelne koncepte i rasporede za digitalne materijale.\nUređujem grafike i fotografije za različite projekte.\nUsaglašavam nacrte i izmene sa članovima projektnog tima.'),
      experience('prior-print', 'Paper Works', 'Dizajnerka grafike', '2021-01', '2023-12', false,
        'Kreirala sam grafičke materijale za štampane i digitalne medije.\nRazvijala sam koncepte vizuelnog dizajna prema potrebama klijenata.\nPregledala sam projekte dizajna i proveravala kvalitet finalnih rezultata.'),
      experience('prior-layout', 'Layout House', 'Dizajnerka grafike', '2018-01', '2020-12', false,
        'Pripremala sam vizuelne koncepte i rasporede za digitalne materijale.\nUređivala sam grafike i fotografije za različite projekte.\nUsaglašavala sam nacrte i izmene sa članovima projektnog tima.'),
    ],
    education: [], skills: [], certifications: [], languages: [], projects: [],
    templateId: 'creative-artistic', region: 'EU',
    createdAt: '2026-08-19T00:00:00.000Z', updatedAt: '2026-08-19T00:00:00.000Z',
    runtimeMigrationVersion: 3,
  } as CVData;
}

function incoherentPersistedCv(): CVData {
  const current = currentCv();
  const staleGermanSummary = 'Ich arbeitete als Fahrradmechanikerin bei RadWerk und betreute Gäste im StadtHotel.';
  const snapshot = buildCanonicalSnapshotFromCv(
    { ...current, canonicalSummary: staleGermanSummary },
    { canonicalLocale: 'sr', createdFrom: 'user_structured_input', revision: 86 },
  );
  return {
    ...current,
    canonicalSummary: staleGermanSummary,
    canonicalSnapshot: snapshot,
  };
}

describe('AAB491 canonical snapshot semantic coherence', () => {
  it('rebuilds an app-owned, structurally bound but semantically unrelated snapshot through hydration and terminal Preview authority', () => {
    const persisted = incoherentPersistedCv();
    const before = JSON.stringify(persisted);
    localStorage.setItem(CV_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 3, cv: persisted }));
    const hydrated = loadCvDraft()?.cv;
    expect(hydrated).toBeTruthy();
    expect(hydrated?.canonicalSnapshot?.canonicalState).toBe('valid');
    const normalized = normalizeLegacyCvRuntime(hydrated!, 'sr');
    expect(normalized.canonicalSnapshot?.canonicalState).toBe('valid');

    const prepared = prepareExportReadyCv(normalized, 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.diagnostics).toMatchObject({
      canonicalSnapshotStructurallyPopulated: true,
      canonicalSnapshotSemanticallyCoherent: false,
      canonicalSnapshotCoherenceRebuildAttempted: true,
      summaryCanonicalCandidateRejectedReason: 'canonical_snapshot_semantically_incoherent',
      summaryAuthorityDecisionBranch: 'app_owned_canonical_snapshot_rebuilt',
      selectedFinalSource: 'deterministic_v2_manifest',
      summaryRelationalOwnershipPassed: true,
    });
    expect(prepared.diagnostics.canonicalSnapshotSemanticFailureReasons).toEqual(
      expect.arrayContaining([
        'canonical_summary_entry_ownership_mismatch',
      ]),
    );
    expect(prepared.cv.summary).not.toContain('RadWerk');
    expect(prepared.cv.summary).not.toContain('StadtHotel');
    expect(prepared.cv.summary).toContain('North Studio');
    expect(prepared.diagnostics.selectedFinalSummaryHash).toBe(hashSummaryV2Text(prepared.cv.summary));
    expect(prepared.diagnostics.summaryFinalUnitOwnership).toHaveLength(4);
    expect(JSON.stringify(persisted)).toBe(before);

    for (const templateId of ['corporate-navy', 'modern-minimal'] as const) {
      const sibling = prepareExportReadyCv(normalized, 'sr', templateId, {
        gender: 'female', referenceDate: '2026-08-19',
      });
      expect(sibling.ok, sibling.ok ? '' : `${templateId}:${sibling.reason}:${sibling.stage}`).toBe(true);
      if (!sibling.ok) continue;
      expect(sibling.diagnostics.selectedFinalSource).toBe('deterministic_v2_manifest');
      expect(sibling.diagnostics.selectedFinalSummaryHash).toBe(prepared.diagnostics.selectedFinalSummaryHash);
      expect(sibling.cv.summary).toBe(prepared.cv.summary);
    }

    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'sr', rawCv: normalized, prepared,
      rendererReached: true, blobProduced: true,
    });
    expect(trace).toMatchObject({
      canonicalSnapshotStructurallyPopulated: true,
      canonicalSnapshotStructurallyVerified: true,
      canonicalSnapshotSemanticallyCoherent: false,
      canonicalSnapshotCoherenceRebuildAttempted: true,
      summaryCanonicalCandidateRejectedReason: 'canonical_snapshot_semantically_incoherent',
      selectedFinalSource: 'deterministic_v2_manifest',
      diagnosticCompletenessPassed: true,
    });

    const Template = templateComponents['creative-artistic'];
    const preview = renderToStaticMarkup(React.createElement(Template, {
      data: prepared.cv, locale: 'sr',
    }));
    expect(preview).toContain('North Studio');
    expect(preview).not.toContain('RadWerk');
    clearCvDraft();
  });

  it('retains valid explicit user Summary authority despite an incoherent canonical snapshot', () => {
    const userOwned = {
      ...incoherentPersistedCv(),
      summary: 'Radim kao Dizajnerka vizuelnih sadržaja u North Studio i pripremam vizuelne koncepte za digitalne materijale.',
      summaryOrigin: 'user' as const,
    };
    const prepared = prepareExportReadyCv(userOwned, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.summary).toContain('North Studio');
    expect(prepared.diagnostics.summaryAuthorityDecisionBranch).toBe('manual_saved_summary');
    expect(prepared.diagnostics.selectedFinalSource).toBe('saved_summary');
  });
});
