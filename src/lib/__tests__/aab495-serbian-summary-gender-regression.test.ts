import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  buildSameLocaleLocalizedManifest,
  buildSummaryV2ManifestForCv,
  buildSummaryV2StyledDeterministicText,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
  projectLocalizedSummaryV2Manifest,
  runSummaryV2,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import { applyFinalizedSummaryToCv, finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { AI_USAGE_SCHEMA_VERSION, recordProAiUserActionSuccess } from '@/lib/ai-usage-policy';
import { setSummaryV2EnabledForTests } from '@/lib/cv-summary-v2/flag';

const REF = '2026-08-21';
const ROLE_MALE = 'Grafički dizajner';
const ROLE_FEMALE = 'Grafička dizajnerka';

function experience(options: Partial<WorkExperience> & Pick<WorkExperience,
  'id' | 'company' | 'startDate' | 'position' | 'description'>): WorkExperience {
  return {
    endDate: '',
    isPresent: false,
    positionProvenance: 'occupation_option',
    descriptionOrigin: 'user',
    ...options,
  } as WorkExperience;
}

function srDuties(state: 'present' | 'completed'): string {
  const suffix = state === 'present' ? '' : ' ranije';
  return [
    `Pripremam vizuelne koncepte za digitalne materijale${suffix}.`,
    `Uređujem grafike za različite projekte${suffix}.`,
    `Usklađujem nacrte sa članovima tima${suffix}.`,
  ].join('\n');
}

function deviceCv(): CVData {
  return {
    personal: { gender: 'female' },
    contentLocale: 'sr',
    summary: '', education: [], skills: [], languages: [],
    experience: [
      experience({ id: 'current', company: 'Nova Firma SR Test', startDate: '2026-03', isPresent: true, position: ROLE_MALE, description: srDuties('present') }),
      experience({ id: 'testwerk', company: 'TestWerk GmbH', startDate: '2024-01', endDate: '2026-02', position: ROLE_MALE, description: srDuties('completed') }),
      experience({ id: 'rewitu', company: 'Rewitu', startDate: '2019-06', endDate: '2023-12', position: ROLE_MALE, description: srDuties('completed') }),
      experience({ id: 'older-ignored', company: 'Older', startDate: '', position: 'Skladišni radnik', description: 'Obavljam skladišne zadatke.' }),
      experience({ id: 'future-ignored', company: 'Future', startDate: '', position: 'グラフィックデザイナー', description: '手作業の職種名を保持する。', positionProvenance: 'manual', positionUserEdited: true }),
    ],
  } as unknown as CVData;
}

function mixedDeviceCv(summary = ''): CVData {
  const cv = deviceCv();
  cv.summary = summary;
  const foreignDuties = [
    'डिजिटल सामग्री के लिए दृश्य अवधारणाएँ तैयार करती हूँ।',
    'विभिन्न परियोजनाओं के लिए ग्राफिक्स संपादित करती हूँ।',
    'टीम के सदस्यों के साथ प्रारूपों का समन्वय करती हूँ।',
  ].join('\n');
  for (const entry of cv.experience!.slice(0, 3)) {
    entry.description = foreignDuties;
    entry.descriptionSourceLocale = 'hi';
  }
  return cv;
}

function localizedSerbianFact(entryId: string, index: number): string {
  const present = entryId === 'current';
  return [
    present ? 'Pripremam vizuelne koncepte za digitalne materijale.' : 'Pripremala sam vizuelne koncepte za digitalne materijale.',
    present ? 'Uređujem grafike za različite projekte.' : 'Uređivala sam grafike za različite projekte.',
    present ? 'Usklađujem nacrte sa članovima tima.' : 'Usklađivala sam nacrte sa članovima tima.',
  ][index]!;
}

describe('AAB495 Serbian Summary female-role same-locale regression', () => {
  beforeEach(() => setSummaryV2EnabledForTests(true));
  afterEach(() => setSummaryV2EnabledForTests(null));

  it('projects known non-manual Graphic Designer titles into the female Serbian surface before Generate or Enhance', () => {
    const selection = buildSummaryV2ManifestForCv({
      cv: deviceCv(), locale: 'sr', gender: 'female', referenceDateIso: REF,
    });
    expect(selection.current?.employer).toBe('Nova Firma SR Test');
    expect(selection.priors.map((entry) => entry.employer)).toEqual(['TestWerk GmbH', 'Rewitu']);
    expect(selection.requiredCurrentFacts).toHaveLength(3);
    expect(selection.requiredPriorFacts).toHaveLength(6);
    expect(selection.totalDurationMonths).toBe(86);
    expect(selection.durationPhrase).toMatch(/sedam/iu);
    expect([selection.current!, ...selection.priors].map((entry) => entry.role))
      .toEqual([ROLE_MALE, ROLE_MALE, ROLE_MALE]);
    const rawRoleValidation = validateSummaryV2AgainstManifest('', selection);
    expect(rawRoleValidation.roleTitleGenderValidationPassed).toBe(false);
    expect(rawRoleValidation.roleTitleSurfaceEvidence.every((entry) => entry.genderValidationApplicable)).toBe(true);
    expect(rawRoleValidation.roleTitleSurfaceEvidence.every((entry) => entry.genderValidationPassed)).toBe(false);

    const sameLocale = buildSameLocaleLocalizedManifest(selection);
    expect(sameLocale).not.toBeNull();
    expect(sameLocale!.entries.map((entry) => entry.localizedRoleTitle))
      .toEqual([ROLE_FEMALE, ROLE_FEMALE, ROLE_FEMALE]);

    const projected = projectLocalizedSummaryV2Manifest({ manifest: selection, localized: sameLocale! });
    expect(projected).not.toBeNull();
    const validation = validateSummaryV2AgainstManifest('', projected!);
    expect(validation.roleTitleGenderValidationPassed).toBe(true);
    expect(validation.roleTitleSurfaceEvidence.every((entry) => entry.genderValidationApplicable)).toBe(true);
    expect(validation.roleTitleSurfaceEvidence.every((entry) => entry.genderValidationPassed)).toBe(true);

    const generated = runSummaryV2({
      cv: deviceCv(), locale: 'sr', gender: 'female', candidate: '',
      referenceDateIso: REF, localizedManifest: sameLocale!,
    });
    expect(generated.countedAsSuccess, generated.reason).toBe(true);
    expect(generated.text).toContain(ROLE_FEMALE);
  });

  it('keeps manual, unknown, warehouse, male, and unspecified title surfaces out of Serbian female projection', () => {
    const localizedTitles = (cv: CVData, gender: string) => {
      const selection = buildSummaryV2ManifestForCv({ cv, locale: 'sr', gender, referenceDateIso: REF });
      return buildSameLocaleLocalizedManifest(selection)!.entries.map((entry) => entry.localizedRoleTitle);
    };
    expect(localizedTitles(deviceCv(), 'male')).toEqual([ROLE_MALE, ROLE_MALE, ROLE_MALE]);
    const unspecified = deviceCv();
    unspecified.personal!.gender = '';
    expect(localizedTitles(unspecified, '')).toEqual([ROLE_MALE, ROLE_MALE, ROLE_MALE]);

    const manual = deviceCv();
    manual.experience![0] = {
      ...manual.experience![0]!, position: ROLE_MALE,
      positionProvenance: 'manual', positionUserEdited: true,
    };
    expect(localizedTitles(manual, 'female')).toEqual([ROLE_MALE, ROLE_FEMALE, ROLE_FEMALE]);

    const warehouse = deviceCv();
    warehouse.experience![0] = { ...warehouse.experience![0]!, position: 'Skladišni radnik' };
    expect(localizedTitles(warehouse, 'female')[0]).toBe('Skladišni radnik');

    const japaneseManual = deviceCv();
    japaneseManual.experience![0] = {
      ...japaneseManual.experience![0]!, position: '特命シニアコーディネーター',
      positionProvenance: 'manual', positionUserEdited: true,
    };
    const japaneseSelection = buildSummaryV2ManifestForCv({
      cv: japaneseManual, locale: 'sr', gender: 'female', referenceDateIso: REF,
    });
    expect(japaneseSelection.current?.role).toBe('特命シニアコーディネーター');
    expect(buildSameLocaleLocalizedManifest(japaneseSelection)).toBeNull();
  });

  it('projects the role before prose in the mixed-authority Generate and Enhance runtime path', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const cv = mixedDeviceCv();
    const selection = buildSummaryV2ManifestForCv({
      cv, locale: 'sr', gender: 'female', referenceDateIso: REF,
    });
    expect(buildSameLocaleLocalizedManifest(selection)).toBeNull();

    const localized = await localizeSummaryV2Manifest({
      manifest: selection,
      transport: async (input) => ({
        targetLocale: input.targetLocale,
        entries: input.entries.map((entry) => ({
          entryId: entry.entryId,
          // This is the stale source surface the mixed-authority merge used to retain.
          localizedRoleTitle: ROLE_MALE,
          facts: entry.facts.map((fact, index) => ({
            factId: fact.factId,
            localizedText: localizedSerbianFact(entry.entryId, index),
          })),
        })),
      }),
    });
    expect(localized.validation?.ok).toBe(true);
    expect(localized.manifest?.entries.map((entry) => entry.localizedRoleTitle))
      .toEqual([ROLE_FEMALE, ROLE_FEMALE, ROLE_FEMALE]);

    const generated = runSummaryV2({
      cv, locale: 'sr', gender: 'female', candidate: '', referenceDateIso: REF,
      localizedManifest: localized.manifest!,
    });
    expect(generated.countedAsSuccess, generated.reason).toBe(true);
    expect(generated.text.match(/Grafička dizajnerka/gu)).toHaveLength(3);
    expect(generated.text).toContain('Nova Firma SR Test');
    expect(generated.text).not.toContain('Rewitu Current Test');
    expect(generated.validation.coveredCurrentFactCount).toBe(3);
    expect(generated.validation.coveredPriorFactCount).toBe(6);
    expect(generated.validation.targetLocalePurityPassed).toBe(true);

    const finalizedGenerate = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_generate', requestedLocale: 'sr', gender: 'female', cv,
      candidate: generated.text, referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      localizedSummaryManifest: localized.manifest!,
    });
    expect(finalizedGenerate.countedAsSuccess, finalizedGenerate.reason).toBe(true);
    expect(finalizedGenerate.diagnostics?.roleTitleGenderValidationPassed).toBe(true);
    expect(finalizedGenerate.diagnostics?.roleTitleSurfaceEvidence
      ?.every((entry) => entry.genderValidationApplicable && entry.genderValidationPassed)).toBe(true);
    const applied = applyFinalizedSummaryToCv(cv, 'sr', finalizedGenerate);
    expect(applied.experience![0]!.position).toBe(ROLE_MALE);
    expect(recordProAiUserActionSuccess({
      schemaVersion: AI_USAGE_SCHEMA_VERSION, count: 23, windowStart: Date.now(), policyLimit: 100,
    }).count).toBe(24);

    const enhanced = runSummaryV2({
      cv: mixedDeviceCv(generated.text), locale: 'sr', gender: 'female',
      candidate: generated.text, rewriteStyle: 'professional', referenceDateIso: REF,
      localizedManifest: localized.manifest!,
    });
    expect(enhanced.countedAsSuccess, enhanced.reason).toBe(true);
    expect(enhanced.text.match(/Grafička dizajnerka/gu)).toHaveLength(3);
    expect(enhanced.text).toContain('Nova Firma SR Test');
    expect(enhanced.text).not.toContain('Rewitu Current Test');
  });

  it('repairs a known female role before Stronger may classify a rejected provider path as a no-op', () => {
    const cv = deviceCv();
    const selection = buildSummaryV2ManifestForCv({
      cv, locale: 'sr', gender: 'female', referenceDateIso: REF,
    });
    const localized = buildSameLocaleLocalizedManifest(selection)!;
    const projected = projectLocalizedSummaryV2Manifest({ manifest: selection, localized })!;
    const correctStronger = buildSummaryV2StyledDeterministicText(projected, 'stronger');
    const legacyIncorrect = correctStronger.replaceAll(ROLE_FEMALE, ROLE_MALE);
    const persisted = { ...cv, summary: legacyIncorrect } as CVData;

    expect(legacyIncorrect).toContain(ROLE_MALE);
    expect(legacyIncorrect).not.toContain(ROLE_FEMALE);

    const pipeline = runSummaryV2({
      cv: persisted, locale: 'sr', gender: 'female', candidate: legacyIncorrect,
      referenceDateIso: REF, localizedManifest: localized, rewriteStyle: 'stronger',
    });
    expect(pipeline.pipelineDiagnostics?.appOwnedKnownRolePresentationViolation).toBe(true);
    expect(pipeline.blocked).toBe(false);

    const finalized = finalizeCvAiFieldForApply({
      field: 'summary',
      action: 'summary_stronger',
      requestedLocale: 'sr',
      gender: 'female',
      cv: persisted,
      // The rejected provider candidate is the same persisted legacy surface.
      candidate: legacyIncorrect,
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(persisted.experience || [], REF),
      localizedSummaryManifest: localized,
      rewriteStyle: 'stronger',
    });

    expect(finalized.blocked).toBe(false);
    expect(finalized.countedAsSuccess).toBe(true);
    expect(finalized.origin).toBe('deterministic_fallback');
    expect(finalized.diagnostics?.providerAccepted).toBe(false);
    expect(finalized.diagnostics?.noOpDetected).toBe(false);
    expect(finalized.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(finalized.text).toContain(ROLE_FEMALE);
    expect(finalized.text).not.toContain(ROLE_MALE);

    const applied = applyFinalizedSummaryToCv(persisted, 'sr', finalized);
    expect(applied.summary).toBe(finalized.text);
    expect(applied.summary).toContain(ROLE_FEMALE);
  });

  it.each(['stronger', 'professional', 'shorter'] as const)(
    'keeps a true no-op for an already-correct saturated %s Summary',
    (rewriteStyle) => {
      const cv = deviceCv();
      const selection = buildSummaryV2ManifestForCv({
        cv, locale: 'sr', gender: 'female', referenceDateIso: REF,
      });
      const localized = buildSameLocaleLocalizedManifest(selection)!;
      const projected = projectLocalizedSummaryV2Manifest({ manifest: selection, localized })!;
      const correct = buildSummaryV2StyledDeterministicText(projected, rewriteStyle);
      const persisted = { ...cv, summary: correct } as CVData;
      const action = rewriteStyle === 'stronger'
        ? 'summary_stronger'
        : rewriteStyle === 'professional'
          ? 'summary_professional'
          : 'summary_shorter';

      const finalized = finalizeCvAiFieldForApply({
        field: 'summary', action, requestedLocale: 'sr', gender: 'female', cv: persisted,
        candidate: correct, referenceDateIso: REF,
        durationSnapshot: buildExperienceDurationSnapshot(persisted.experience || [], REF),
        localizedSummaryManifest: localized, rewriteStyle,
      });

      expect(finalized.blocked).toBe(true);
      expect(finalized.countedAsSuccess).toBe(false);
      expect(finalized.reason).toBe('style_no_safe_material_change');
      expect(finalized.text).toBe(correct);
      expect(finalized.diagnostics?.noOpDetected).toBe(true);
    },
  );
});
