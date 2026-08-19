import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CVData, WorkExperience } from '@/lib/types';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { normalizeLegacyCvRuntime } from '@/lib/cv-legacy-runtime-migration';
import { prepareExportReadyCv } from '@/lib/prepare-export-ready-cv';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { templateComponents } from '@/components/cv-templates';

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

describe('AAB484 Creative Artistic persisted-device recovery', () => {
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
