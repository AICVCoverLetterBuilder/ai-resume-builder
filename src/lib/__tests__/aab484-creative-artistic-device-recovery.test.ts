/**
 * @vitest-environment jsdom
 */
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CVData, WorkExperience } from '@/lib/types';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import { buildCanonicalSnapshotFromCv } from '@/lib/cv-canonical-snapshot';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { templateComponents } from '@/components/cv-templates';
import { CV_DRAFT_STORAGE_KEY } from '@/lib/draft-storage';
import { AppProvider, useApp } from '@/lib/store';
import {
  buildAndStoreCvExportDiagnostic,
  clearCvExportDiagnosticsForTests,
  getLatestCvExportDiagnostic,
} from '@/lib/cv-export-diagnostics';

const iapMocks = vi.hoisted(() => ({
  initIAP: vi.fn(),
  syncProEntitlement: vi.fn(),
}));

vi.mock('@/lib/iap', () => ({
  initIAP: iapMocks.initIAP,
  syncProEntitlement: iapMocks.syncProEntitlement,
}));

const EXPECTED = 'Imam oko sedam godina iskustva. Trenutno radim kao Grafička dizajnerka u Rewitu Current Test, gde pripremam vizuelne koncepte i rasporede za digitalne materijale, uređujem grafike i fotografije za različite projekte i usaglašavam nacrte i izmene sa članovima projektnog tima. Prethodno sam radila kao Grafička dizajnerka u TestWerk GmbH, gde sam kreirala grafičke materijale za štampane i digitalne medije, razvijala koncepte vizuelnog dizajna prema potrebama klijenata i pregledala projekte dizajna i proveravala kvalitet finalnih rezultata. Prethodno sam radila kao Grafička dizajnerka u Rewitu, gde sam izrađivala vizuelne koncepte i rasporede za digitalne materijale, uređivala grafike i fotografije za različite projekte i usaglašavala nacrte i izmene sa članovima projektnog tima.';
const STALE = 'Imam oko sedam godina iskustva. Trenutno radim kao Grafička dizajnerka u Rewitu Current Test, pripremam vizuelne koncepte i rasporede za digitalne materijale, uređujem grafike i slike za različite projekte i usklađujem nacrte i izmene sa članovima projektnog tima. Ranije sam radila kao Grafička dizajnerka u TestWerk GmbH, kreirala grafičke materijale za štampane i digitalne medije, razvijala koncepte vizuelnog dizajna prema potrebama klijenata i pregledala projekte dizajna i proveravala kvalitet finalnih rezultata. Prethodno sam radila kao Grafička dizajnerka u Rewitu, pripremala vizuelne koncepte i rasporede za digitalne materijale, uređivala grafike i slike za različite projekte i usklađivala nacrte i izmene sa članovima projektnog tima.';

const CURRENT = 'Pripremam vizuelne koncepte i rasporede za digitalne materijale.\nUređujem grafike i slike za različite projekte.\nUsklađujem nacrte i izmene sa članovima projektnog tima.';
const PRIOR = 'Izrađivala sam grafičke materijale za štampane i digitalne medije.\nRazvijala sam vizuelne dizajnerske koncepte prema potrebama klijenata.\nPregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.';
const REWITU_PRIOR = 'Pripremala sam vizuelne koncepte i rasporede za digitalne materijale.\nUređivala sam grafike i slike za različite projekte.\nUsklađivala sam nacrte i izmene sa članovima projektnog tima.';

function exp(id: string, company: string, position: string, startDate: string, endDate: string, isPresent: boolean, description: string): WorkExperience {
  return { id, company, position, startDate, endDate, isPresent, description, originalUserDescription: description, canonicalDescription: description, descriptionOrigin: 'user', descriptionSourceLocale: 'sr' };
}

function deviceCv(): CVData {
  const hindiTestWerk = 'मुद्रित और डिजिटल सामग्री के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम परिणामों की गुणवत्ता की जाँच करती थी।';
  const testWerkSource = { ...exp('be5c794b', 'TestWerk GmbH', 'Graphic designer', '2024-01', '', false, hindiTestWerk), positionSourceLocale: 'en' as const };
  const testWerk = applyGeneratedExperienceDescription(testWerkSource, PRIOR, {
    locale: 'sr', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'enhance', requestHash: 'aab484-device-testwerk',
  });
  return {
    id: 'aab484-device', name: 'AAB484',
    personal: { fullName: 'Test', email: 'test@example.test', phone: '', address: '', jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false },
    summary: STALE, canonicalSummary: EXPECTED, summaryOrigin: 'deterministic_fallback', summaryGeneratedLocale: 'sr', contentLocale: 'sr',
    experience: [
      exp('90ceb215', 'Rewitu Current Test', 'Grafička dizajnerka', '2026-03', '', true, CURRENT),
      testWerk,
      exp('a221433', 'Rewitu', 'Grafička dizajnerka', '2019-06', '2022-12', false, REWITU_PRIOR),
      exp('b9d3a6a5', 'Atlas', 'Skladišna radnica', '2023-01', '', true, 'Proveravam pristiglu robu.\nProveravam dokumentaciju.\nSarađujem sa kolegama.'),
      exp('8da68c15', 'Pixel Studio', 'Grafički dizajner', '2026-01', '', true, 'Pripremam vizuelne materijale.'),
    ],
    education: [], skills: [], certifications: [], languages: [], projects: [], templateId: 'creative-artistic', region: 'EU',
    createdAt: '2026-08-19T00:00:00.000Z', updatedAt: '2026-08-19T00:00:00.000Z', runtimeMigrationVersion: 3,
  } as CVData;
}

/**
 * Real AAB485 hydration branch: deterministic app-owned prose survived with a
 * stale generation-context key.  The canonical V2 terminal text is valid, but
 * the old classifier incorrectly used the saved key when judging that
 * canonical surface and therefore promoted the stale visible Summary.
 */
function stalePersistedDeviceCv(): CVData {
  const base = deviceCv();
  return {
    ...base,
    summaryGenerationContextKey: 'fnv1a_aab485_stale_saved_summary_context',
    // Real persisted branch: the display was deterministic/app-owned and
    // carried no user-origin semantic-duty binding.  The visible target-native
    // duties still form the canonical V2 selection manifest, while the legacy
    // summary fact-set classification is occupation_generic.
    experience: base.experience.map((experience) => ({
      ...experience,
      descriptionOrigin: 'deterministic_fallback' as const,
      originalUserDescription: undefined,
      canonicalDescription: undefined,
      generatedDescription: undefined,
      generatedLocale: 'sr' as const,
      descriptionSourceLocale: 'sr' as const,
    })),
  };
}

let hydratedCv: CVData | null = null;

function HydratedDraftProbe() {
  hydratedCv = useApp().currentCv;
  return null;
}

describe('AAB484 Creative Artistic persisted-device recovery', () => {
  beforeEach(() => {
    hydratedCv = null;
    localStorage.clear();
    clearCvExportDiagnosticsForTests();
    vi.clearAllMocks();
    iapMocks.initIAP.mockResolvedValue(undefined);
    iapMocks.syncProEntitlement.mockResolvedValue({ status: 'not_available' });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('repairs a fully persisted already-v3 pre-state snapshot through real draft hydration before export and Preview authority', async () => {
    const persisted = stalePersistedDeviceCv();
    delete persisted.canonicalSummary;
    const legacySnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    // Actual pre-state serialized shape: structural evidence predates the
    // later state/provenance labels.  Keep revision/locale/hash/Summary and
    // every entry binding intact; do not inject current-schema fields.
    delete (legacySnapshot as Partial<typeof legacySnapshot>).canonicalState;
    delete (legacySnapshot as Partial<typeof legacySnapshot>).canonicalCreatedFrom;
    persisted.canonicalSnapshot = legacySnapshot;

    localStorage.setItem(CV_DRAFT_STORAGE_KEY, JSON.stringify({
      schemaVersion: 3,
      savedAt: '2026-08-19T17:41:00.000Z',
      cv: persisted,
    }));

    const rendered = render(React.createElement(
      AppProvider,
      null,
      React.createElement(HydratedDraftProbe),
    ));
    await act(async () => { await Promise.resolve(); });
    rendered.unmount();

    expect(hydratedCv?.runtimeMigrationVersion).toBe(3);
    expect(hydratedCv?.canonicalSnapshot?.canonicalState).toBe('valid');
    expect(hydratedCv?.canonicalSnapshot?.canonicalStateSource).toBe('legacy_state_inferred');
    expect(hydratedCv?.canonicalSnapshot?.canonicalSummary).toBe(EXPECTED);
    expect(hydratedCv?.summary).toBe(STALE);

    const persistedAfterHydration = JSON.parse(localStorage.getItem(CV_DRAFT_STORAGE_KEY) || '{}') as {
      cv?: CVData;
    };
    expect(persistedAfterHydration.cv?.canonicalSnapshot?.canonicalState).toBe('valid');
    expect(persistedAfterHydration.cv?.canonicalSnapshot?.canonicalStateSource)
      .toBe('legacy_state_inferred');
    expect(persistedAfterHydration.cv?.runtimeMigrationRepair).toMatchObject({
      migrationVersionBefore: 3,
      migrationVersionAfter: 3,
      structuralUpgradeAttempted: true,
      structuralUpgradeResult: 'accepted',
      canonicalSnapshotStateBefore: 'absent',
      canonicalSnapshotStateAfter: 'valid',
    });

    const hydratedBeforeExport = JSON.stringify(hydratedCv);
    const prepared = prepareExportReadyCv(hydratedCv!, 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.diagnostics.selectedFinalSource).toBe('deterministic_v2_manifest');
    expect(hashSummaryV2Text(prepared.cv.summary)).toBe('fnv1a_e7f712af');
    // Export/Preview authority is a projection only: the hydrated editor
    // draft must retain the historical app-owned display text until a user
    // actually edits it.
    expect(JSON.stringify(hydratedCv)).toBe(hydratedBeforeExport);
    const Template = templateComponents['creative-artistic'];
    const previewHtml = renderToStaticMarkup(React.createElement(Template, {
      data: prepared.cv,
      locale: 'sr',
    }));
    expect(previewHtml).toContain('fotografije');
    expect(previewHtml).not.toContain('usklađujem nacrte');
    expect(prepared.diagnostics).toMatchObject({
      runtimeMigrationVersionBefore: 3,
      runtimeMigrationVersionAfter: 3,
      legacyCanonicalSnapshotPresent: true,
      legacyCanonicalSnapshotStructurallyValid: true,
      legacyCanonicalSnapshotStructuralUpgradeAttempted: true,
      legacyCanonicalSnapshotStructuralUpgradeResult: 'accepted',
      legacyCanonicalSnapshotStructuralUpgradeSkipReason: null,
      canonicalSnapshotStateBefore: 'absent',
      canonicalSnapshotStateAfter: 'valid',
      resolvedCanonicalSummarySource: 'canonical_snapshot_legacy_state_inferred',
      resolvedCanonicalSummaryHash: 'fnv1a_e7f712af',
      summaryAuthorityDecisionBranch: 'app_owned_canonical_v2_authority',
    });

    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'sr', rawCv: hydratedCv!, prepared,
      rendererReached: true, blobProduced: true,
    });
    expect(trace).toMatchObject({
      runtimeMigrationVersionBefore: 3,
      runtimeMigrationVersionAfter: 3,
      legacyCanonicalSnapshotPresent: true,
      legacyCanonicalSnapshotStructurallyValid: true,
      legacyCanonicalSnapshotStructuralUpgradeAttempted: true,
      legacyCanonicalSnapshotStructuralUpgradeResult: 'accepted',
      legacyCanonicalSnapshotStructuralUpgradeSkipReason: null,
      canonicalSnapshotStateBefore: 'absent',
      canonicalSnapshotStateAfter: 'valid',
      resolvedCanonicalSummarySource: 'canonical_snapshot_legacy_state_inferred',
      resolvedCanonicalSummaryHash: 'fnv1a_e7f712af',
      summaryAuthorityDecisionBranch: 'app_owned_canonical_v2_authority',
      migrationDiagnosticsApplicable: true,
      migrationDiagnosticsComplete: true,
      diagnosticCompletenessPassed: true,
      diagnosticCompletenessFailureReasons: [],
    });
    expect(JSON.stringify(trace)).not.toContain(EXPECTED);
    // Latest Diagnostics is what the device exposes; prove the privacy-safe
    // migration trace survives that serializer rather than only a local
    // prepare-export object.
    expect(getLatestCvExportDiagnostic('pdf')).toMatchObject({
      legacyCanonicalSnapshotStructuralUpgradeResult: 'accepted',
      canonicalSnapshotStateBefore: 'absent',
      canonicalSnapshotStateAfter: 'valid',
      resolvedCanonicalSummaryHash: 'fnv1a_e7f712af',
      summaryAuthorityDecisionBranch: 'app_owned_canonical_v2_authority',
      diagnosticCompletenessPassed: true,
    });

    hydratedCv = null;
    const restarted = render(React.createElement(
      AppProvider,
      null,
      React.createElement(HydratedDraftProbe),
    ));
    await act(async () => { await Promise.resolve(); });
    restarted.unmount();
    const restartedCv = hydratedCv as CVData | null;
    expect(restartedCv?.canonicalSnapshot?.canonicalState).toBe('valid');
    expect(restartedCv?.canonicalSnapshot?.canonicalStateSource).toBe('legacy_state_inferred');
  });

  it('does not promote a stale app-owned unstructured Summary over a divergent canonical V2 terminal surface', () => {
    const hydrated = normalizeLegacyCvRuntime(stalePersistedDeviceCv(), 'sr');
    const prepared = prepareExportReadyCv(hydrated, 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.diagnostics).toMatchObject({
      summaryFactSetSource: 'app_owned_v2_manifest',
      summaryValidationAuthoritySource: 'app_owned_v2_manifest',
      summarySavedProvenance: 'deterministic_fallback',
      summaryStaleMetadataDetected: true,
      savedSummaryJobContextPassed: false,
      selectedFinalSource: 'deterministic_v2_manifest',
    });
    expect(hashSummaryV2Text(prepared.cv.summary)).toBe('fnv1a_e7f712af');
    expect(prepared.cv.summary).toBe(EXPECTED);
    expect(prepared.diagnostics.summaryRelationalOwnershipPassed).toBe(true);
    // One duration unit plus the current and two selected prior roles.
    expect(prepared.diagnostics.summaryFinalUnitOwnership).toHaveLength(4);
  });

  it('uses the validated canonical V2 snapshot when the stale app-owned draft has no top-level canonicalSummary', () => {
    const persisted = {
      ...deviceCv(),
      summaryGenerationContextKey: 'fnv1a_aab486_stale_saved_summary_context',
    };
    // The device branch was hydrated from a persisted canonical snapshot. Its
    // top-level legacy mirror is absent, so the authority state machine must
    // not treat that as absence of canonical V2 authority.
    delete persisted.canonicalSummary;
    persisted.canonicalSnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    const hydrated = normalizeLegacyCvRuntime(persisted, 'sr');
    expect(hydrated.canonicalSummary).toBeUndefined();
    expect(hydrated.canonicalSnapshot?.canonicalSummary).toBe(EXPECTED);

    const prepared = prepareExportReadyCv(hydrated, 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.cv.summary).toBe(EXPECTED);
    expect(prepared.diagnostics).toMatchObject({
      summaryFactSetSource: 'app_owned_v2_manifest',
      summaryValidationAuthoritySource: 'app_owned_v2_manifest',
      summarySavedProvenance: 'deterministic_fallback',
      summaryStaleMetadataDetected: true,
      savedSummaryJobContextPassed: false,
      summaryVisibleTextAuthorityRebound: false,
      summaryVisibleTextAuthorityBlockedReason: 'app_owned_canonical_v2_authority',
      summarySavedSummaryReboundRevalidated: true,
      selectedFinalSource: 'deterministic_v2_manifest',
    });
    expect(prepared.diagnostics.savedSummaryHash).toBe(hashSummaryV2Text(STALE));
    expect(prepared.diagnostics.selectedFinalSummaryHash).toBe(hashSummaryV2Text(EXPECTED));
    expect(prepared.diagnostics.summaryRelationalOwnershipPassed).toBe(true);
    expect(prepared.diagnostics.summaryFinalUnitOwnership).toHaveLength(4);
  });

  it('retains snapshot-only canonical V2 authority through the real stale persisted migration shape', () => {
    const persisted = stalePersistedDeviceCv();
    delete persisted.canonicalSummary;
    // The persisted snapshot is captured before the stale display-only
    // Experience projections. Hydration must retain this immutable authority
    // while normalizing those projections.
    persisted.canonicalSnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    const hydrated = normalizeLegacyCvRuntime(persisted, 'sr');
    expect(hydrated.canonicalSummary).toBeUndefined();
    expect(hydrated.canonicalSnapshot?.canonicalSummary).toBe(EXPECTED);

    const prepared = prepareExportReadyCv(hydrated, 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.summary).toBe(EXPECTED);
    expect(prepared.diagnostics.selectedFinalSource).toBe('deterministic_v2_manifest');
  });

  it('rebinds a structurally valid pre-state persisted canonical snapshot before stale app-owned recovery', () => {
    const persisted = stalePersistedDeviceCv();
    delete persisted.canonicalSummary;
    const canonicalSnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    // The device draft predates canonicalState. This is the persisted schema
    // that reaches hydration, not a synthetic current-schema snapshot.
    delete (canonicalSnapshot as Partial<typeof canonicalSnapshot>).canonicalState;
    persisted.canonicalSnapshot = canonicalSnapshot;
    const hydrated = normalizeLegacyCvRuntime(persisted, 'sr');
    expect(hydrated.canonicalSummary).toBeUndefined();
    expect(hydrated.canonicalSnapshot?.canonicalSummary).toBe(EXPECTED);

    const prepared = prepareExportReadyCv(hydrated, 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.diagnostics).toMatchObject({
      canonicalSummaryTopLevelPresent: false,
      canonicalSnapshotPresent: true,
      canonicalSnapshotSummaryPresent: true,
      canonicalSnapshotSummaryHash: 'fnv1a_e7f712af',
      canonicalSnapshotStateSource: 'legacy_state_inferred',
      resolvedCanonicalSummaryPresent: true,
      resolvedCanonicalSummaryHash: 'fnv1a_e7f712af',
      resolvedCanonicalSummarySource: 'canonical_snapshot_legacy_state_inferred',
      resolvedCanonicalSummaryRejectionReason: null,
      summaryAuthorityDecisionBranch: 'app_owned_canonical_v2_authority',
      summaryFactSetSource: 'app_owned_v2_manifest',
      summaryValidationAuthoritySource: 'app_owned_v2_manifest',
      summarySavedProvenance: 'deterministic_fallback',
      summaryStaleMetadataDetected: true,
      savedSummaryJobContextPassed: false,
      summaryVisibleTextAuthorityBlockedReason: 'app_owned_canonical_v2_authority',
      selectedFinalSource: 'deterministic_v2_manifest',
    });
    expect(prepared.diagnostics.selectedFinalSummaryHash).toBe('fnv1a_e7f712af');
    expect(prepared.cv.summary).toBe(EXPECTED);
  });

  it('does not promote a malformed pre-state canonical snapshot into app-owned authority', () => {
    const persisted = stalePersistedDeviceCv();
    delete persisted.canonicalSummary;
    const canonicalSnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    delete (canonicalSnapshot as Partial<typeof canonicalSnapshot>).canonicalState;
    canonicalSnapshot.canonicalSourceHash = '';
    persisted.canonicalSnapshot = canonicalSnapshot;

    const prepared = prepareExportReadyCv(normalizeLegacyCvRuntime(persisted, 'sr'), 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.summary).toBe(STALE);
    expect(prepared.diagnostics).toMatchObject({
      canonicalSnapshotPresent: true,
      canonicalSnapshotStateSource: 'not_valid',
      resolvedCanonicalSummaryPresent: false,
      resolvedCanonicalSummarySource: 'none',
      resolvedCanonicalSummaryRejectionReason: 'canonical_snapshot_state_not_valid',
      selectedFinalSource: 'saved_summary',
    });
  });

  it('keeps explicit user-authored and user-edited Summary authority over legacy canonical repair', () => {
    const canonicalSnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    const authored: CVData = {
      ...stalePersistedDeviceCv(),
      summary: STALE,
      summaryOrigin: 'user',
      canonicalSnapshot,
    };
    const editedAfterAi: CVData = {
      ...authored,
      summaryGeneratedLocale: 'sr',
      summaryGenerationContextKey: 'fnv1a_user_edited_after_ai',
    };

    for (const current of [authored, editedAfterAi]) {
      const prepared = prepareExportReadyCv(current, 'sr', 'modern-minimal', {
        gender: 'female', referenceDate: '2026-08-19',
      });
      expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
      if (!prepared.ok) continue;
      // The shared duration composition can add a sourced date phrase, but
      // manual authority must never be displaced by the canonical V2 e7
      // surface selected for stale app-owned content.
      expect(prepared.cv.summary).toContain('Ranije sam radila');
      expect(prepared.cv.summary).not.toContain('fotografije');
      expect(prepared.diagnostics.summaryAuthorityDecisionBranch).toBe('manual_saved_summary');
      expect(prepared.diagnostics.selectedFinalSource).toBe('saved_summary');
    }
  });

  it('repairs only structurally eligible snapshots idempotently, including a non-Creative template and another locale normalization', () => {
    const persisted = stalePersistedDeviceCv();
    delete persisted.canonicalSummary;
    const preState = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    delete (preState as Partial<typeof preState>).canonicalState;
    delete (preState as Partial<typeof preState>).canonicalCreatedFrom;
    persisted.canonicalSnapshot = preState;

    const first = normalizeLegacyCvRuntime(persisted, 'hr');
    const second = normalizeLegacyCvRuntime(first, 'hr');
    expect(first.canonicalSnapshot?.canonicalState).toBe('valid');
    expect(first.runtimeMigrationRepair?.structuralUpgradeResult).toBe('accepted');
    expect(second).toEqual(first);

    const prepared = prepareExportReadyCv(first, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.diagnostics.selectedFinalSource).toBe('deterministic_v2_manifest');
    expect(hashSummaryV2Text(prepared.cv.summary)).toBe('fnv1a_e7f712af');
  });

  it('does not rewrite an empty saved Summary while canonical V2 authority selects the terminal export surface', () => {
    const empty = stalePersistedDeviceCv();
    empty.summary = '';
    delete empty.canonicalSummary;
    empty.canonicalSnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    const before = JSON.stringify(empty);
    const prepared = prepareExportReadyCv(empty, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.summary).toBe(EXPECTED);
    expect(empty.summary).toBe('');
    expect(JSON.stringify(empty)).toBe(before);
  });

  it('fails the internal diagnostics-completeness gate when an applicable migration field is absent', () => {
    const persisted = stalePersistedDeviceCv();
    delete persisted.canonicalSummary;
    const snapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: EXPECTED },
      { canonicalLocale: 'sr', createdFrom: 'legacy_migration', revision: 2 },
    );
    delete (snapshot as Partial<typeof snapshot>).canonicalState;
    persisted.canonicalSnapshot = snapshot;
    const prepared = prepareExportReadyCv(normalizeLegacyCvRuntime(persisted, 'sr'), 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    const incomplete = {
      ...prepared,
      diagnostics: {
        ...prepared.diagnostics,
        runtimeMigrationVersionBefore: undefined,
      },
    };
    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'sr', rawCv: persisted, prepared: incomplete,
      rendererReached: true, blobProduced: true,
    });
    expect(trace.migrationDiagnosticsApplicable).toBe(true);
    expect(trace.migrationDiagnosticsComplete).toBe(false);
    expect(trace.diagnosticCompletenessPassed).toBe(false);
    expect(trace.diagnosticCompletenessFailureReasons).toContain(
      'migration_diagnostic_missing:runtimeMigrationVersionBefore',
    );
  });

  it('fails closed when stale app-owned prose has only a wrong-locale canonical snapshot candidate', () => {
    const persisted = stalePersistedDeviceCv();
    delete persisted.canonicalSummary;
    const foreignSnapshot = buildCanonicalSnapshotFromCv(
      { ...deviceCv(), canonicalSummary: 'Experienced graphic designer with seven years of experience.' },
      { canonicalLocale: 'en', createdFrom: 'legacy_migration', revision: 2 },
    );
    persisted.canonicalSnapshot = foreignSnapshot;

    const prepared = prepareExportReadyCv(persisted, 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.reason).toMatch(/canonical|locale|summary/i);
  });

  it('keeps an app-owned Summary when its canonical terminal surface and context are genuinely aligned', () => {
    const base = deviceCv();
    const aligned: CVData = {
      ...base,
      summary: EXPECTED,
      canonicalSummary: EXPECTED,
      summaryGenerationContextKey: undefined,
    };
    const prepared = prepareExportReadyCv(normalizeLegacyCvRuntime(aligned, 'sr'), 'sr', 'creative-artistic', {
      gender: 'female', referenceDate: '2026-08-19',
    });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.cv.summary).toBe(EXPECTED);
    expect(prepared.diagnostics).toMatchObject({
      summaryValidationAuthoritySource: 'app_owned_unstructured_legacy',
      summarySavedSummaryReboundRevalidated: false,
      selectedFinalSource: 'saved_summary',
    });
  });

  it('recovers the selected terminal Summary instead of retaining the stale persisted surface', () => {
    const normalized = normalizeLegacyCvRuntime(deviceCv(), 'sr');
    const prepared = prepareExportReadyCv(normalized, 'sr', 'creative-artistic', { gender: 'female', referenceDate: '2026-08-19' });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    expect(hashSummaryV2Text(prepared.cv.summary)).toBe('fnv1a_e7f712af');
    expect(prepared.cv.summary).toBe(EXPECTED);
  });

  it('keeps Creative Artistic date ranges bounded and role-title presentation target-native', () => {
    const prepared = prepareExportReadyCv(normalizeLegacyCvRuntime(deviceCv(), 'sr'), 'sr', 'creative-artistic', { gender: 'female', referenceDate: '2026-08-19' });
    expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
    if (!prepared.ok) return;
    const Template = templateComponents['creative-artistic'];
    const html = renderToStaticMarkup(React.createElement(Template, { data: prepared.cv, locale: 'sr' }));
    expect(html).toContain('TestWerk GmbH | 2024-01');
    expect(html).not.toContain('TestWerk GmbH | 2024-01 -');
    expect(html).toContain('Pixel Studio | 2026-01 - Trenutno');
    const pixelDate = html.indexOf('Pixel Studio |');
    expect(pixelDate).toBeGreaterThan(0);
    expect(html.slice(html.lastIndexOf('<h3', pixelDate), pixelDate)).toContain('Grafička dizajnerka');
  });
});
