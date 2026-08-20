/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CVData, TemplateId, WorkExperience } from '@/lib/types';
import { CV_DRAFT_STORAGE_KEY, clearCvDraft, loadCvDraft } from '@/lib/draft-storage';
import { buildCanonicalSnapshotFromCv } from '@/lib/cv-canonical-snapshot';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import {
  applyAppOwnedSummaryPreviewTerminalSnapshot,
  commitPreviewSummaryLeafEvidence,
  describePreviewSummaryRender,
  prepareExportReadyCv,
} from '@/lib/prepare-export-ready-cv';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { resolveExperienceTitleForDisplay } from '@/lib/cv-role-title';
import { applyCvContentQuality } from '@/lib/cv-content-quality';
import { templateComponents } from '@/components/cv-templates';
import {
  buildCreativeArtisticPdfBlob,
  buildCorporateNavyPdfBlob,
  buildModernMinimalPdfBlob,
  exportCreativeArtisticPdf,
  exportCorporateNavyPdf,
  exportModernMinimalPdf,
  formatExperienceDateRange,
} from '@/lib/export';
import { saveFileViaPlatform } from '@/lib/native-save';
import { buildAndStoreCvExportDiagnostic, clearCvExportDiagnosticsForTests } from '@/lib/cv-export-diagnostics';

vi.mock('@/lib/native-save', async () => {
  const actual = await vi.importActual<typeof import('@/lib/native-save')>('@/lib/native-save');
  return { ...actual, saveFileViaPlatform: vi.fn() };
});

const EXPECTED = 'Imam oko sedam godina iskustva. Trenutno radim kao Grafička dizajnerka u Rewitu Current Test, gde pripremam vizuelne koncepte i rasporede za digitalne materijale, uređujem grafike i fotografije za različite projekte i usaglašavam nacrte i izmene sa članovima projektnog tima. Prethodno sam radila kao Grafička dizajnerka u TestWerk GmbH, gde sam kreirala grafičke materijale za štampane i digitalne medije, razvijala koncepte vizuelnog dizajna prema potrebama klijenata i pregledala projekte dizajna i proveravala kvalitet finalnih rezultata. Prethodno sam radila kao Grafička dizajnerka u Rewitu, gde sam izrađivala vizuelne koncepte i rasporede za digitalne materijale, uređivala grafike i fotografije za različite projekte i usaglašavala nacrte i izmene sa članovima projektnog tima.';
const STALE = 'Imam iskustvo u vizuelnom dizajnu, koordinaciji projekata i radu sa kreativnim timovima.';
const CURRENT = 'Pripremam vizuelne koncepte i rasporede za digitalne materijale.\nUređujem grafike i fotografije za različite projekte.\nUsaglašavam nacrte i izmene sa članovima projektnog tima.';
const PRIOR = 'Kreirala sam grafičke materijale za štampane i digitalne medije.\nRazvijala sam koncepte vizuelnog dizajna prema potrebama klijenata.\nPregledala sam projekte dizajna i proveravala kvalitet finalnih rezultata.';
const REWITU_PRIOR = 'Izrađivala sam vizuelne koncepte i rasporede za digitalne materijale.\nUređivala sam grafike i fotografije za različite projekte.\nUsaglašavala sam nacrte i izmene sa članovima projektnog tima.';
const HINDI = 'मुद्रित और डिजिटल सामग्री के लिए ग्राफिक सामग्री तैयार करती थी।\nग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।\nडिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम परिणामों की गुणवत्ता की जाँच करती थी।';
const EXPECTED_HASH = 'fnv1a_e7f712af';

function exp(id: string, company: string, position: string, startDate: string, endDate: string, isPresent: boolean, description: string): WorkExperience {
  return {
    id, company, position, startDate, endDate, isPresent, description,
    originalUserDescription: description, canonicalDescription: description,
    descriptionOrigin: 'user', descriptionSourceLocale: 'sr',
  };
}

/**
 * Sanitized shape from the persisted device record: an app-generated known
 * title was historically stamped as manual even though its declared source
 * locale remains foreign. This must not override the terminal target-locale
 * title authority.
 */
function staleAppOwnedGraphicDesigner(exp: WorkExperience, positionSourceLocale: string): WorkExperience {
  return {
    ...exp,
    position: 'Grafički dizajner',
    positionProvenance: 'manual',
    positionUserEdited: true,
    positionSourceLocale,
    descriptionOrigin: 'ai_generated',
    generatedDescription: exp.description,
    generatedLocale: 'sr',
  };
}

/** Sanitized twin of the already-current, incoherent app-owned device state. */
function incoherentFiveEntryDraft(templateId: TemplateId): CVData {
  const testWerkSource = {
    ...exp('be5c794b', 'TestWerk GmbH', 'Graphic designer', '2024-01', '', false, HINDI),
    descriptionSourceLocale: 'hi' as const,
    positionSourceLocale: 'en' as const,
  };
  const testWerk = staleAppOwnedGraphicDesigner(applyGeneratedExperienceDescription(testWerkSource, PRIOR, {
    locale: 'sr', sourceLocale: 'hi', origin: 'ai_generated', operationMode: 'enhance', requestHash: 'aab491-downstream-testwerk',
  }), 'de');
  const cv = {
    id: 'aab491-downstream-sanitized', name: 'AAB491 downstream',
    personal: { fullName: 'Test User', email: 'test@example.test', phone: '', address: '', jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false },
    summary: STALE, summaryOrigin: 'deterministic_fallback' as const, summaryGeneratedLocale: 'sr' as const, contentLocale: 'sr' as const,
    experience: [
      staleAppOwnedGraphicDesigner(exp('90ceb215', 'Rewitu Current Test', 'Grafička dizajnerka', '2026-03', '', true, CURRENT), 'ar'),
      testWerk,
      staleAppOwnedGraphicDesigner(exp('a221433', 'Rewitu', 'Grafička dizajnerka', '2019-06', '2022-12', false, REWITU_PRIOR), 'hi'),
      exp('b9d3a6a5', 'Atlas', 'Skladišni radnik', '2023-01', '', true, 'Proveravam pristiglu robu.\nProveravam dokumentaciju.\nSarađujem sa kolegama.'),
      staleAppOwnedGraphicDesigner(exp('8da68c15', 'Pixel Studio', 'Graphic designer', '2026-01', '', true, 'Pripremam vizuelne materijale.\nUređujem grafike za digitalne sadržaje.\nProveravam završne nacrte.'), 'hi'),
    ],
    education: [], skills: [], certifications: [], languages: [], projects: [], templateId, region: 'EU' as const,
    createdAt: '2026-08-19T00:00:00.000Z', updatedAt: '2026-08-19T00:00:00.000Z', runtimeMigrationVersion: 3,
  } as CVData;
  const unrelatedGerman = 'Ich arbeitete als Fahrradmechanikerin bei RadWerk und betreute Gäste im StadtHotel.';
  const snapshot = buildCanonicalSnapshotFromCv(
    { ...cv, canonicalSummary: unrelatedGerman },
    { canonicalLocale: 'en', createdFrom: 'user_structured_input', revision: 86 },
  );
  return { ...cv, canonicalSummary: unrelatedGerman, canonicalSnapshot: snapshot };
}

function expectedDate(experience: WorkExperience): string {
  return formatExperienceDateRange(experience.startDate, experience.endDate, experience.isPresent, 'Trenutno');
}

const expectedRows = [
  ['be5c794b', 'TestWerk GmbH', 'Grafička dizajnerka', '2024-01', 3],
  ['b9d3a6a5', 'Atlas', 'Skladišni radnik', '2023-01 - Trenutno', 3],
  ['a221433', 'Rewitu', 'Grafička dizajnerka', '2019-06 - 2022-12', 3],
  ['90ceb215', 'Rewitu Current Test', 'Grafička dizajnerka', '2026-03 - Trenutno', 3],
  ['8da68c15', 'Pixel Studio', 'Grafička dizajnerka', '2026-01 - Trenutno', 3],
] as const;

describe('AAB491 incoherent canonical snapshot downstream closure', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCvExportDiagnosticsForTests();
    vi.clearAllMocks();
    vi.mocked(saveFileViaPlatform).mockResolvedValue({
      result: 'saved', message: 'saved', fileName: 'aab491-downstream.pdf', platform: 'android',
      sourceBytes: 1024, bytesWritten: 1024, verifiedSize: 1024,
    });
  });

  afterEach(() => {
    clearCvDraft();
    localStorage.clear();
  });

  it('repairs only the contradicted stale app-owned known title provenance', () => {
    const staleGraphicDesigner = {
      position: 'Grafički dizajner', positionProvenance: 'manual', positionUserEdited: true, positionSourceLocale: 'hi', descriptionOrigin: 'ai_generated',
    };
    expect(resolveExperienceTitleForDisplay(staleGraphicDesigner, 'sr', 'female')).toBe('Grafička dizajnerka');
    expect(resolveExperienceTitleForDisplay(staleGraphicDesigner, 'sr', 'male')).toBe('Grafički dizajner');
    expect(resolveExperienceTitleForDisplay(staleGraphicDesigner, 'sr')).toBe('Grafički dizajner');
    expect(resolveExperienceTitleForDisplay(staleGraphicDesigner, 'hr', 'female')).toBe('Grafička dizajnerica');
    expect(resolveExperienceTitleForDisplay(staleGraphicDesigner, 'en', 'female')).toBe('Graphic Designer');
    expect(resolveExperienceTitleForDisplay({
      position: 'Grafički dizajner', positionProvenance: 'manual', positionUserEdited: true, positionSourceLocale: 'sr',
    }, 'sr', 'female')).toBe('Grafički dizajner');
    expect(resolveExperienceTitleForDisplay({
      position: 'Vlastiti naziv zanimanja', positionProvenance: 'manual', positionUserEdited: true, positionSourceLocale: 'hi',
    }, 'sr', 'female')).toBe('Vlastiti naziv zanimanja');
    expect(resolveExperienceTitleForDisplay({
      position: 'Specijalista za iskustvo kupaca', positionProvenance: 'ai_generated', positionSourceLocale: 'hi', descriptionOrigin: 'ai_generated',
    }, 'sr', 'female')).toBe('Specijalista za iskustvo kupaca');
    expect(resolveExperienceTitleForDisplay({
      position: 'Skladišni radnik', positionProvenance: 'manual', positionUserEdited: true, positionSourceLocale: 'hi', descriptionOrigin: 'ai_generated',
    }, 'sr', 'female')).toBe('Skladišni radnik');
  });

  it.each(['creative-artistic', 'corporate-navy', 'modern-minimal'] as const)(
    'carries the recovered terminal Summary and all five rows through %s Preview template and dedicated PDF boundaries',
    async (templateId) => {
      const persisted = incoherentFiveEntryDraft(templateId);
      const persistedBefore = JSON.stringify(persisted);
      localStorage.setItem(CV_DRAFT_STORAGE_KEY, JSON.stringify({ schemaVersion: 3, cv: persisted }));
      const hydrated = loadCvDraft()?.cv;
      expect(hydrated).toBeTruthy();
      const normalized = normalizeLegacyCvRuntime(hydrated!, 'sr');
      expect(normalized.experience.filter((entry) => entry.position === 'Grafički dizajner')
        .map((entry) => entry.positionSourceLocale).sort())
        .toEqual(['ar', 'de', 'hi', 'hi']);
      expect(applyCvContentQuality(normalized, 'sr', { gender: 'female' }).cv.experience
        .filter((entry) => entry.id !== 'b9d3a6a5').map((entry) => entry.position))
        .toEqual(['Grafička dizajnerka', 'Grafička dizajnerka', 'Grafička dizajnerka', 'Grafička dizajnerka']);
      const prepared = prepareExportReadyCv(normalized, 'sr', templateId, {
        gender: 'female', referenceDate: '2026-08-19',
      });
      expect(prepared.ok, prepared.ok ? '' : `${prepared.reason}:${prepared.stage}`).toBe(true);
      if (!prepared.ok) return;

      expect(prepared.cv.experience.filter((entry) => entry.id !== 'b9d3a6a5')
        .map((entry) => entry.position))
        .toEqual(['Grafička dizajnerka', 'Grafička dizajnerka', 'Grafička dizajnerka', 'Grafička dizajnerka']);

      const selectedFinalSummaryHash = hashSummaryV2Text(prepared.cv.summary);
      expect(selectedFinalSummaryHash).toBe(EXPECTED_HASH);
      expect(prepared.cv.summary).toBe(EXPECTED);
      expect(prepared.diagnostics).toMatchObject({
        canonicalSnapshotSemanticallyCoherent: false,
        canonicalSnapshotCoherenceRebuildAttempted: true,
        summaryCanonicalCandidateRejectedReason: 'canonical_snapshot_semantically_incoherent',
        summaryAuthorityDecisionBranch: 'app_owned_canonical_snapshot_rebuilt',
        selectedFinalSource: 'deterministic_v2_manifest',
        summaryRelationalOwnershipPassed: true,
      });
      expect(prepared.diagnostics.summaryFinalUnitOwnership?.length).toBeGreaterThan(0);
      expect(JSON.stringify(persisted)).toBe(persistedBefore);

      const previewInput = applyAppOwnedSummaryPreviewTerminalSnapshot(normalized, prepared, { forceAppOwnedTerminal: true });
      expect(hashSummaryV2Text(previewInput.summary)).toBe(EXPECTED_HASH);
      const Template = templateComponents[templateId];
      const html = renderToStaticMarkup(React.createElement(Template, { data: previewInput, locale: 'sr' }));
      const witness = commitPreviewSummaryLeafEvidence(
        describePreviewSummaryRender(previewInput, prepared, true, {
          previewSnapshotId: `aab491-${templateId}`, previewInputSummaryHash: selectedFinalSummaryHash,
          selectedFinalSummaryHash,
        }),
        previewInput.summary,
        html,
      );
      const seven = {
        selectedFinalSummaryHash,
        previewInputSummaryHash: hashSummaryV2Text(previewInput.summary),
        templatePreviewSummaryHash: witness.templatePreviewSummaryHash,
        templateLeafSummaryHash: witness.templateLeafSummaryHash,
        previewRenderedSummaryHash: witness.previewRenderedSummaryHash,
        visiblePreviewSummaryHash: hashSummaryV2Text(previewInput.summary),
        exportSummaryHash: prepared.diagnostics.exportSummaryHash,
      };
      expect(seven).toEqual({
        selectedFinalSummaryHash: EXPECTED_HASH, previewInputSummaryHash: EXPECTED_HASH,
        templatePreviewSummaryHash: EXPECTED_HASH, templateLeafSummaryHash: EXPECTED_HASH,
        previewRenderedSummaryHash: EXPECTED_HASH, visiblePreviewSummaryHash: EXPECTED_HASH,
        exportSummaryHash: EXPECTED_HASH,
      });
      expect(witness.previewRenderAuthority).toBe('selected_final');
      expect(witness.previewSelectedFinalParityPassed).toBe(true);
      expect(html).not.toContain('RadWerk');
      expect(html).not.toContain('Grafički dizajner');

      expect(prepared.cv.experience).toHaveLength(5);
      for (const [id, company, title, date, bullets] of expectedRows) {
        const rowIndex = prepared.cv.experience.findIndex((entry) => entry.id === id);
        const row = prepared.cv.experience[rowIndex];
        const previewRow = previewInput.experience.find((entry) => entry.id === id);
        const presentation = prepared.diagnostics.experiencePresentation?.[rowIndex];
        expect(row, id).toBeTruthy();
        expect(row).toMatchObject({ company, position: title });
        expect(previewRow, `${id}: preview entry`).toMatchObject({ company, position: title });
        expect(previewRow?.position).toBe(row?.position);
        expect(presentation).toMatchObject({
          targetLocale: 'sr', finalPresentationBulletCount: bullets,
          crossEntryOwnershipPassed: true, sourceLanguageLeakageDetected: false,
        });
        expect(expectedDate(row!)).toBe(date);
        expect(row!.description.split(/\n+/u).filter(Boolean)).toHaveLength(bullets);
        expect(row!.description).not.toMatch(/[\u0900-\u097f\u0600-\u06ff]/u);
        expect(html).toContain(company);
        expect(html).toContain(title);
      }

      const blob = templateId === 'creative-artistic'
        ? await buildCreativeArtisticPdfBlob(prepared.cv, 'sr', { alreadyPrepared: true })
        : templateId === 'corporate-navy'
          ? await buildCorporateNavyPdfBlob(prepared.cv, 'sr', { alreadyPrepared: true })
          : await buildModernMinimalPdfBlob(prepared.cv, 'sr');
      expect(blob.type).toBe('application/pdf');
      expect(blob.size).toBeGreaterThan(0);
      const saved = templateId === 'creative-artistic'
        ? await exportCreativeArtisticPdf(prepared.cv, 'aab491-downstream', 'sr', { alreadyPrepared: true })
        : templateId === 'corporate-navy'
          ? await exportCorporateNavyPdf(prepared.cv, 'aab491-downstream', 'sr', { alreadyPrepared: true })
          : await exportModernMinimalPdf(prepared.cv, 'aab491-downstream', 'sr');
      expect(saved.result).toBe('saved');
      expect(saveFileViaPlatform).toHaveBeenCalledWith(expect.any(Blob), 'aab491-downstream.pdf', 'application/pdf');

      const trace = buildAndStoreCvExportDiagnostic({
        format: 'pdf', locale: 'sr', rawCv: normalized, prepared,
        previewSummaryRender: witness, rendererReached: true, blobProduced: true,
        blobMimeType: blob.type, blobSize: blob.size, androidSaveReached: true, saveResult: saved,
      });
      expect(trace).toMatchObject({
        selectedFinalSummaryHash: EXPECTED_HASH, exportSummaryHash: EXPECTED_HASH,
        previewRenderAuthority: 'selected_final', previewSelectedFinalParityPassed: true,
        rendererReached: true, blobProduced: true, blobMimeType: 'application/pdf',
        androidSaveReached: true, saveResult: 'saved', ok: true,
      });
    },
    120_000,
  );
});
