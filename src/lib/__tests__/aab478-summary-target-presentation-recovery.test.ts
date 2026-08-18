/** @vitest-environment jsdom */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { applyGeneratedExperienceDescription } from '@/lib/cv-experience-provenance';
import { captureSummaryV2Snapshot } from '@/lib/cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from '@/lib/cv-summary-v2/manifest';
import { buildSummaryV2DeterministicText } from '@/lib/cv-summary-v2/builder';
import { hashSummaryV2Text } from '@/lib/cv-summary-v2/facts';
import { validateSummaryV2AgainstManifest } from '@/lib/cv-summary-v2/validator';
import { validateCrossLocaleSemanticCoverage } from '@/lib/cv-cross-locale-experience';
import { extractExperienceSemanticArgumentKinds } from '@/lib/cv-experience-unsupported-claims';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { buildAndStoreCvExportDiagnostic } from '@/lib/cv-export-diagnostics';
import { buildModernMinimalPdfBlob, exportToDOCX } from '@/lib/export';
import { countSummaryWords } from '@/lib/cv-summary-grounding';
import {
  buildNativeFirstPersonDutyTail,
  evaluateSummaryV2NativeSurface,
} from '@/lib/cv-summary-v2/native-surface';
import {
  applyAppOwnedSummaryPreviewTerminalSnapshot,
  describePreviewSummaryRender,
  prepareExportReadyCv,
} from '@/lib/prepare-export-ready-cv';

const HINDI_TESTWERK = [
  'मुद्रित और डिजिटल सामग्री के लिए ग्राफिक सामग्री तैयार करती थी।',
  'ग्राहकों की आवश्यकताओं के अनुसार विज़ुअल डिज़ाइन अवधारणाएँ विकसित करती थी।',
  'डिज़ाइन परियोजनाओं की समीक्षा करती थी और अंतिम परिणामों की गुणवत्ता की जाँच करती थी।',
].join('\n');

const SERBIAN_TESTWERK = [
  'Izrađivala sam grafičke materijale za štampane i digitalne medije.',
  'Razvijala sam vizuelne dizajnerske koncepte prema potrebama klijenata.',
  'Pregledala sam dizajnerske projekte i proveravala kvalitet završnih rezultata.',
].join('\n');

const SERBIAN_CURRENT = [
  'Pripremam vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređujem grafike i slike za različite projekte.',
  'Usklađujem nacrte i izmene sa članovima projektnog tima.',
].join('\n');

const SERBIAN_PRIOR_REWITU = [
  'Pripremala je vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređivala je grafike i slike za različite projekte.',
  'Usklađivala je nacrte i izmene sa članovima projektnog tima.',
].join('\n');

const HINDI_UNPROJECTABLE = [
  'अपरिचित मुक्त-पाठ जिम्मेदारी एक निभाती थी।',
  'अपरिचित मुक्त-पाठ जिम्मेदारी दो निभाती थी।',
  'अपरिचित मुक्त-पाठ जिम्मेदारी तीन निभाती थी।',
].join('\n');

function regularEntry(options: {
  id: string;
  company: string;
  startDate: string;
  isPresent: boolean;
  description: string;
  position?: string;
}): WorkExperience {
  return {
    id: options.id,
    company: options.company,
    position: options.position || 'Grafička dizajnerka',
    startDate: options.startDate,
    endDate: options.isPresent ? '' : '2025-12',
    isPresent: options.isPresent,
    description: options.description,
    originalUserDescription: options.description,
    canonicalDescription: options.description,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'sr',
  };
}

function deviceCv(
  summary = '',
  options?: {
    testWerkImmutable?: string;
    testWerkPresentation?: string;
  },
): CVData {
  const testWerkImmutable = options?.testWerkImmutable || HINDI_TESTWERK;
  const testWerkPresentation = options?.testWerkPresentation || SERBIAN_TESTWERK;
  const testWerkSource: WorkExperience = {
    id: 'be5c794b',
    company: 'TestWerk GmbH',
    position: 'Grafička dizajnerka',
    startDate: '2021-01',
    endDate: '2024-01',
    isPresent: false,
    description: testWerkImmutable,
    originalUserDescription: testWerkImmutable,
    canonicalDescription: testWerkImmutable,
    descriptionOrigin: 'user',
    descriptionSourceLocale: 'hi',
  };
  const testWerk = applyGeneratedExperienceDescription(testWerkSource, testWerkPresentation, {
    locale: 'sr',
    sourceLocale: 'hi',
    origin: 'ai_generated',
    operationMode: 'enhance',
    requestHash: 'aab478-device-testwerk',
  });
  return {
    id: 'aab478-device-five-entry',
    name: 'AAB478',
    personal: {
      fullName: 'Test Person', email: 'test@example.test', phone: '', address: '',
      jobTitle: 'Grafička dizajnerka', gender: 'female', photoEnabled: false,
    },
    summary,
    summaryOrigin: 'deterministic_fallback',
    summaryGeneratedLocale: 'sr',
    contentLocale: 'sr',
    experience: [
      regularEntry({
        id: '90ceb215', company: 'Rewitu Current Test', startDate: '2026-03', isPresent: true,
        description: SERBIAN_CURRENT,
      }),
      testWerk,
      regularEntry({
        id: 'a221433', company: 'Rewitu', startDate: '2018-01', isPresent: false,
        description: SERBIAN_PRIOR_REWITU,
      }),
      regularEntry({
        id: 'b9d3a6a5', company: 'Atlas', startDate: '2023-01', isPresent: true,
        position: 'Skladišna radnica',
        description: 'Proveravam pristiglu robu.\nProveravam prateću dokumentaciju.\nSarađujem sa kolegama.',
      }),
      regularEntry({
        id: '8da68c15', company: 'Pixel Studio', startDate: '2016-01', isPresent: false,
        position: 'Operaterka',
        description: 'Vodila sam evidenciju smena.',
      }),
    ],
    education: [], skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:00.000Z',
  };
}

function deviceManifest(cv: CVData) {
  return buildSummaryV2SelectionManifest(captureSummaryV2Snapshot({
    cv, locale: 'sr', gender: 'female', referenceDateIso: '2026-08-18',
  }));
}

function mockDownload(): Blob[] {
  const blobs: Blob[] = [];
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:http://aab478/${blobs.length}`;
    }),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return blobs;
}

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    value: { load: async () => [], ready: Promise.resolve() },
    configurable: true,
  });
  globalThis.fetch = (async (input: string | URL | Request) => {
    const fileName = String(input).split('/').pop() || '';
    const fontPath = path.join(process.cwd(), 'public', 'fonts', fileName);
    if (fs.existsSync(fontPath)) return new Response(fs.readFileSync(fontPath), { status: 200 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AAB478 Summary recovery uses fact-bound target presentation surfaces', () => {
  it('replays the five-entry device state without serializing the selected Hindi TestWerk source surface', () => {
    const initial = deviceCv();
    const manifest = deviceManifest(initial);
    expect(manifest.current?.entryId).toBe('90ceb215');
    expect(manifest.priors.map((entry) => entry.entryId)).toEqual(['be5c794b', 'a221433']);
    expect(manifest.allEntries?.map((entry) => entry.entryId)).toEqual([
      '90ceb215', 'be5c794b', 'a221433', 'b9d3a6a5', '8da68c15',
    ]);

    const testWerk = manifest.priors[0]!;
    expect(testWerk.facts.map((fact) => fact.bulletText)).toEqual(HINDI_TESTWERK.split('\n'));
    expect(testWerk.facts.map((fact) => fact.sourceLocale)).toEqual(['hi', 'hi', 'hi']);
    expect(testWerk.facts.map((fact) => fact.presentationText)).toEqual(SERBIAN_TESTWERK.split('\n'));

    const currentTargetTestWerk = testWerk.facts
      .map((fact) => fact.presentationText || '')
      .join('\n');
    expect(extractExperienceSemanticArgumentKinds(HINDI_TESTWERK)).toEqual(expect.arrayContaining([
      'material_medium', 'criterion', 'beneficiary', 'quality_output',
    ]));
    expect(currentTargetTestWerk).toContain('štampane i digitalne medije');
    expect(validateCrossLocaleSemanticCoverage(HINDI_TESTWERK, currentTargetTestWerk))
      .toMatchObject({
        ok: true, coveredCount: 3, uncoveredCount: 0,
      });
    expect(validateAiUnitLocalePurity(currentTargetTestWerk, 'sr', {
      kind: 'experience_bullet', requireUnits: true,
    })).toMatchObject({ targetLocalePurityPassed: true, mixedLanguageUnitCount: 0 });

    const raw = buildSummaryV2DeterministicText(manifest);
    expect(raw).toMatch(/[\u0900-\u097F]/u);
    // This is the exact stale-owner shape from AAB477: the Atlas employer/date
    // is spliced into the selected Rewitu current-role unit, not a selected fact.
    const stale = raw.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    );
    const saved = validateSummaryV2AgainstManifest(stale, manifest, {
      candidateSource: 'final_selected',
    });
    expect(saved.relationalOwnershipValidationPassed).toBe(false);
    expect(saved.relationalOwnershipFailureReasons).toEqual(expect.arrayContaining([
      'foreign_employer_attached_to_role_unit',
      'foreign_start_date_attached_to_role_unit',
    ]));

    const prepared = prepareExportReadyCv(deviceCv(stale), 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok, prepared.ok ? '' : JSON.stringify({
      reason: prepared.reason,
      stage: prepared.stage,
      diagnostics: prepared.diagnostics,
    })).toBe(true);
    if (!prepared.ok) return;

    const final = prepared.cv.summary || '';
    expect(final).not.toMatch(/[\u0900-\u097F]/u);
    expect(final).not.toContain('Atlas');
    expect(final).not.toContain('januara 2023');
    expect(final).toContain('štampane i digitalne medije');
    expect(final).toContain('potrebama klijenata');
    expect(final).toContain('kvalitet završnih rezultata');
    expect(prepared.diagnostics.recoveryDetectedLocaleByUnit).toEqual(['sr', 'sr', 'sr', 'sr']);
    expect(prepared.diagnostics.recoveryDetectedScriptByUnit).toEqual([
      'latin', 'latin_diacritic_sc', 'latin_diacritic_sc', 'latin_diacritic_sc',
    ]);
    expect(prepared.diagnostics.recoveryFactPresentation).toEqual(expect.arrayContaining(
      testWerk.facts.map((fact) => expect.objectContaining({
        owningEntryHash: hashSummaryV2Text('be5c794b'),
        factIdHash: hashSummaryV2Text(fact.factId),
        immutableAuthorityHash: fact.sourceFactHash,
        presentationSurfaceAuthority: 'validated_current_target_experience',
        detectedTargetLocale: 'sr',
      })),
    ));
    expect(prepared.diagnostics).toMatchObject({
      savedSummaryOwnershipPassed: false,
      recoveryCandidateLocaleValidationPassed: true,
      recoveryCandidateNativeSurfacePassed: true,
      recoveryCandidateOwnershipPassed: true,
      selectedFinalSource: 'deterministic_v2_manifest',
    });
    expect(prepared.diagnostics.selectedFinalSummaryHash).toBe(hashSummaryV2Text(final));
    // Export preparation cannot observe a React render.  It must never claim
    // that its selected candidate was already visible in Preview.
    expect(prepared.diagnostics.visiblePreviewSummaryHash).toBeNull();
    expect(prepared.diagnostics.exportSummaryHash).toBe(hashSummaryV2Text(final));
  });

  it('does not let a failed app-owned recovery fall back to its stale saved Summary in Preview', () => {
    const source = deviceCv();
    const raw = buildSummaryV2DeterministicText(deviceManifest(source));
    const stale = raw.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    );
    const unprojectable = deviceCv(stale, {
      testWerkImmutable: HINDI_UNPROJECTABLE,
    });
    const prepared = prepareExportReadyCv(unprojectable, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.diagnostics.selectedFinalSource).toBeNull();
      expect(prepared.diagnostics.summaryRelationalOwnershipPassed).toBeNull();
      expect(prepared.diagnostics.summaryFinalUnitOwnership).toEqual([]);
    }

    const preview = applyAppOwnedSummaryPreviewTerminalSnapshot(unprojectable, prepared);
    expect(preview.summary).toBe('');
    expect(preview.summary).not.toBe(stale);
  });

  it('binds reordered trusted Serbian Experience bullets by semantic fact identity, not textarea index', () => {
    const reversed = SERBIAN_TESTWERK.split('\n').reverse().join('\n');
    const initial = deviceCv('', { testWerkPresentation: reversed });
    const raw = buildSummaryV2DeterministicText(deviceManifest(initial));
    const stale = raw.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    );
    const prepared = prepareExportReadyCv(deviceCv(stale, {
      testWerkPresentation: reversed,
    }), 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok, prepared.ok ? '' : JSON.stringify(prepared.diagnostics)).toBe(true);
    if (!prepared.ok) return;
    const testWerkUnit = prepared.cv.summary
      .split(/(?<=\.)\s+(?=Prethodno sam)/u)[1] || '';
    expect(testWerkUnit.indexOf('štampane i digitalne medije'), testWerkUnit)
      .toBeLessThan(testWerkUnit.indexOf('potrebama klijenata'));
    expect(testWerkUnit.indexOf('potrebama klijenata'))
      .toBeLessThan(testWerkUnit.indexOf('završnih rezultata'));
    expect(prepared.diagnostics.recoveryFactPresentation
      ?.filter((fact) => fact.owningEntryHash === hashSummaryV2Text('be5c794b'))
      .map((fact) => fact.presentationSurfaceAuthority))
      .toEqual([
        'validated_current_target_experience',
        'validated_current_target_experience',
        'validated_current_target_experience',
      ]);
  });

  it('shares the selected recovered Summary hash with Preview, PDF and DOCX', async () => {
    const initial = deviceCv();
    const raw = buildSummaryV2DeterministicText(deviceManifest(initial));
    const stale = raw.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    );
    const source = deviceCv(stale);
    const prepared = prepareExportReadyCv(source, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok, prepared.ok ? '' : JSON.stringify(prepared.diagnostics)).toBe(true);
    if (!prepared.ok) return;

    const preview = applyAppOwnedSummaryPreviewTerminalSnapshot(source, prepared, {
      forceAppOwnedTerminal: true,
    });
    const finalHash = hashSummaryV2Text(prepared.cv.summary || '');
    expect(preview.summary).toBe(prepared.cv.summary);
    const previewRender = describePreviewSummaryRender(preview, prepared, true);
    expect(prepared.diagnostics).toMatchObject({
      selectedFinalSource: 'deterministic_v2_manifest',
      selectedFinalSummaryHash: finalHash,
      visiblePreviewSummaryHash: null,
      exportSummaryHash: finalHash,
    });
    expect(previewRender).toEqual({
      previewRenderedSummaryHash: finalHash,
      previewRenderAuthority: 'selected_final',
      selectedFinalSummaryHash: finalHash,
    });

    const pdf = await buildModernMinimalPdfBlob(prepared.cv, 'sr');
    expect(pdf.size).toBeGreaterThan(0);
    const downloads = mockDownload();
    const docx = await exportToDOCX(prepared.cv, 'aab478-summary', 'sr', 'modern-minimal');
    expect(docx.result).toBe('saved');
    expect(downloads.at(-1)?.size).toBeGreaterThan(0);

    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'sr', rawCv: source, prepared,
      previewSummaryRender: previewRender,
      rendererReached: true, blobProduced: true, blobSize: pdf.size, blobMimeType: pdf.type,
    });
    expect(trace).toMatchObject({
      selectedFinalSummaryHash: finalHash,
      previewRenderedSummaryHash: finalHash,
      previewRenderAuthority: 'selected_final',
      visiblePreviewSummaryHash: finalHash,
      exportSummaryHash: finalHash,
    });
    expect(trace.recoveryFactPresentation?.filter((fact) => (
      fact.owningEntryHash === hashSummaryV2Text('be5c794b')
    ))).toHaveLength(3);
  }, 60_000);

  it('AAB479 renders the terminal Serbian recovery in Preview and removes only a shell-duplicated past auxiliary', () => {
    const initial = deviceCv();
    const raw = buildSummaryV2DeterministicText(deviceManifest(initial));
    const stale = raw.replace(
      'u Rewitu Current Test, gde',
      'u Rewitu Current Test i kompaniji Atlas od januara 2023. godine, gde',
    );
    const source = deviceCv(stale);
    const prepared = prepareExportReadyCv(source, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok, prepared.ok ? '' : JSON.stringify(prepared.diagnostics)).toBe(true);
    if (!prepared.ok) return;

    // This is the exact Preview terminalizer path: app-owned provenance makes
    // a stale saved Summary ineligible even if older diagnostics are absent.
    const preview = applyAppOwnedSummaryPreviewTerminalSnapshot(source, prepared, {
      forceAppOwnedTerminal: true,
    });
    const final = prepared.cv.summary || '';
    const finalHash = hashSummaryV2Text(final);
    const previewRender = describePreviewSummaryRender(preview, prepared, true);
    expect(source.summary).toContain('Atlas');
    expect(preview.summary).toBe(final);
    expect(preview.summary).not.toContain('Atlas');
    expect(preview.summary).not.toContain('januara 2023');
    expect(preview.summary).not.toMatch(/[\u0900-\u097F]/u);
    expect(preview.summary).not.toMatch(/gd(?:e|je)\s+sam\s+\p{L}+(?:ala|ela|ila)\s+sam\b/iu);
    expect(prepared.diagnostics).toMatchObject({
      savedSummaryOwnershipPassed: false,
      recoveryCandidateOwnershipPassed: true,
      recoveryCandidateLocaleValidationPassed: true,
      recoveryCandidateNativeSurfacePassed: true,
      selectedFinalSource: 'deterministic_v2_manifest',
      selectedFinalSummaryHash: finalHash,
      exportSummaryHash: finalHash,
      // This is a raw phase result, not a terminal rejection.
      rawRecoveryWordCount: 110,
      rawRecoveryWordBudgetPassed: true,
      compactionAttempted: null,
      selectedFinalWordCount: 110,
      selectedFinalWordBudgetPassed: true,
    });
    expect(countSummaryWords(final, 'sr')).toBe(110);
    expect(previewRender).toEqual({
      previewRenderedSummaryHash: finalHash,
      previewRenderAuthority: 'selected_final',
      selectedFinalSummaryHash: finalHash,
    });

    const trace = buildAndStoreCvExportDiagnostic({
      format: 'pdf', locale: 'sr', rawCv: source, prepared,
      previewSummaryRender: previewRender,
      rendererReached: true, blobProduced: true, blobSize: 1, blobMimeType: 'application/pdf',
    });
    expect(trace).toMatchObject({
      savedSummaryHash: hashSummaryV2Text(stale),
      savedSummaryOwnershipPassed: false,
      recoveryCandidateHash: finalHash,
      rawRecoveryWordCount: 110,
      rawRecoveryWordBudgetPassed: true,
      selectedFinalSummaryHash: finalHash,
      selectedFinalSource: 'deterministic_v2_manifest',
      selectedFinalWordCount: 110,
      selectedFinalWordBudgetPassed: true,
      previewRenderedSummaryHash: finalHash,
      previewRenderAuthority: 'selected_final',
      visiblePreviewSummaryHash: finalHash,
      exportSummaryHash: finalHash,
    });

    // Standalone first-person target bullets retain `sam`; only the enclosing
    // completed-role shell consumes it. Predicate arguments remain verbatim.
    const pastTail = buildNativeFirstPersonDutyTail([
      'Izrađivala sam vizuelne koncepte i rasporede za digitalne materijale.',
      'Uređivala sam grafike i slike za različite projekte.',
      'Usaglašavala sam nacrte i izmene sa članovima projektnog tima.',
    ], 'sr', 'completed', 'female');
    expect(pastTail).toContain(', gde sam izrađivala vizuelne koncepte i rasporede za digitalne materijale');
    expect(pastTail).toContain('uređivala grafike i slike za različite projekte');
    expect(pastTail).toContain('usaglašavala nacrte i izmene sa članovima projektnog tima');
    expect(pastTail).not.toMatch(/gd(?:e|je)\s+sam\s+\p{L}+(?:ala|ela|ila)\s+sam\b/iu);
    const presentTail = buildNativeFirstPersonDutyTail([
      'Pripremam vizuelne koncepte i rasporede za digitalne materijale.',
    ], 'sr', 'present', 'female');
    expect(presentTail).toContain(', gde pripremam vizuelne koncepte');

    const malformed = evaluateSummaryV2NativeSurface({
      text: final.replace('gde sam izrađivala', 'gde sam izrađivala sam'),
      locale: 'sr', hasCurrent: true, hasPrior: true, perspectiveMode: 'first_person', gender: 'female',
    });
    expect(malformed.nativeSurfaceValidationPassed).toBe(false);
    expect(malformed.nativeSurfaceRejectionReasons).toContain(
      'locale_verb_morphology:sr_duplicate_first_person_past_auxiliary',
    );
  });

  it('AAB479 records a 111-word app-owned recovery as advisory raw budget evidence, not a final failure', () => {
    const source = deviceCv();
    // Employer names are source-owned role metadata. Extending this arbitrary
    // source value by one word exercises the historic 110-word boundary while
    // retaining the same selected-entry fact/ownership contract.
    source.experience[0] = {
      ...source.experience[0]!,
      company: 'Rewitu Current Test Studio',
    };
    const raw = buildSummaryV2DeterministicText(deviceManifest(source));
    source.summary = raw.replace(
      'u Rewitu Current Test Studio, gde',
      'u Rewitu Current Test Studio i kompaniji Atlas od januara 2023. godine, gde',
    );
    const prepared = prepareExportReadyCv(source, 'sr', 'modern-minimal', {
      gender: 'female', referenceDate: '2026-08-18',
    });
    expect(prepared.ok, prepared.ok ? '' : JSON.stringify(prepared.diagnostics)).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.diagnostics).toMatchObject({
      rawRecoveryWordCount: 111,
      rawRecoveryWordBudgetPassed: false,
      compactionAttempted: false,
      compactedRecoveryWordCount: null,
      selectedFinalWordCount: 111,
      selectedFinalWordBudgetPassed: true,
      selectedFinalSource: 'deterministic_v2_manifest',
    });
    expect(prepared.diagnostics.summaryRecoveryReason).toBe('legacy_word_budget_advisory_not_final_gate');
    expect(prepared.diagnostics.recoveryCandidateRejectionReasons || []).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^summary_too_long:/u)]),
    );
  });
});
