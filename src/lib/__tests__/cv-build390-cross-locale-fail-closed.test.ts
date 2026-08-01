import { beforeAll, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import {
  buildSummaryV2ManifestForCv,
  acceptSummaryV2LocalizationResponse,
  parseSummaryV2LocalizationProviderJson,
  validateSummaryV2LocalizationResponse,
  setSummaryV2EnabledForTests,
  validateSummaryV2AgainstManifest,
} from '@/lib/cv-summary-v2';
import type { SummaryV2LocalizedManifest } from '@/lib/cv-summary-v2';

const REFERENCE_DATE = '2026-07-01';

const MIXED_GENERATE = 'Cuento con alrededor de cinco años y medio de experiencia. Actualmente trabajo como Fahrradmechaniker en RadWerk, donde führt Wartungsarbeiten an Fahrrädern durch, prüft Fahrräder auf technische Mängel y tauscht defekte Bauteile an Fahrrädern aus. Anteriormente trabajé como Rezeptionist en StadtHotel, donde begrüßte Gäste herzlich an der Rezeption des Hotels, erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen y beantwortete Fragen der Gäste kompetent und serviceorientiert.';

const MIXED_STRONGER = 'Cuento con alrededor de cinco años y medio de experiencia. Actualmente trabajo como Fahrradmechaniker en RadWerk, donde führt con rigor Wartungsarbeiten an Fahrrädern durch, a la vez que prüft Fahrräder auf technische Mängel y tauscht defekte Bauteile an Fahrrädern aus. Anteriormente trabajé como Rezeptionist en StadtHotel, donde begrüßte Gäste herzlich an der Rezeption des Hotels, a la vez que erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen y beantwortete Fragen der Gäste kompetent und serviceorientiert.';

function germanExperienceCv(summary = ''): CVData {
  return {
    id: 'aab390-de-es',
    name: 'AAB 390 cross-locale',
    personal: {
      fullName: 'Test User', email: 'test@example.com', phone: '', address: '',
      jobTitle: 'Fahrradmechaniker', gender: 'male',
    },
    summary,
    summaryOrigin: summary ? 'user' : undefined,
    contentLocale: 'de',
    experience: [
      {
        id: 'current-de', company: 'RadWerk', position: 'Fahrradmechaniker',
        startDate: '2024-01', endDate: '', isPresent: true,
        generatedLocale: 'de',
        description: 'Führt Wartungsarbeiten an Fahrrädern durch.\nPrüft Fahrräder auf technische Mängel.\nTauscht defekte Bauteile an Fahrrädern aus.',
      },
      {
        id: 'prior-de', company: 'StadtHotel', position: 'Rezeptionist',
        startDate: '2021-01', endDate: '2023-12', isPresent: false,
        generatedLocale: 'de',
        description: 'Begrüßte Gäste herzlich an der Rezeption des Hotels.\nErfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen.\nBeantwortete Fragen der Gäste kompetent und serviceorientiert.',
      },
    ],
    education: [], skills: [], languages: [], certifications: [], projects: [],
    templateId: 'modern-minimal',
  };
}

function finalize(candidate: string, summary = '', rewriteStyle?: 'stronger') {
  const cv = germanExperienceCv(summary);
  return finalizeCvAiFieldForApply({
    field: 'summary',
    action: rewriteStyle ? 'summary_stronger' : 'summary_generate',
    requestedLocale: 'es',
    gender: 'male',
    cv,
    candidate,
    referenceDateIso: REFERENCE_DATE,
    durationSnapshot: buildExperienceDurationSnapshot(cv.experience, REFERENCE_DATE),
    rewriteStyle,
  });
}

function spanishLocalization(summary = ''): SummaryV2LocalizedManifest {
  const manifest = buildSummaryV2ManifestForCv({
    cv: germanExperienceCv(summary), locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE,
  });
  const current = manifest.requiredCurrentFacts;
  const prior = manifest.requiredPriorFacts;
  const accepted = acceptSummaryV2LocalizationResponse({
    manifest,
    source: 'provider',
    response: {
      targetLocale: 'es',
      entries: [
        {
          entryId: 'current-de',
          localizedRoleTitle: 'Mecánico de bicicletas',
          facts: [
            { factId: current[0].factId, localizedText: 'Realiza el mantenimiento de bicicletas.' },
            { factId: current[1].factId, localizedText: 'Inspecciona bicicletas para detectar defectos técnicos.' },
            { factId: current[2].factId, localizedText: 'Sustituye componentes defectuosos de bicicletas.' },
          ],
        },
        {
          entryId: 'prior-de',
          localizedRoleTitle: 'Recepcionista',
          facts: [
            { factId: prior[0].factId, localizedText: 'Recibió cordialmente a los huéspedes en la recepción del hotel.' },
            { factId: prior[1].factId, localizedText: 'Registró y gestionó reservas y sus modificaciones.' },
            { factId: prior[2].factId, localizedText: 'Respondió con competencia y orientación al servicio a las preguntas de los huéspedes.' },
          ],
        },
      ],
    },
  });
  expect(accepted.validation).toMatchObject({
    ok: true,
    entryIdParityPassed: true,
    factIdParityPassed: true,
    factOwnershipParityPassed: true,
  });
  return accepted.manifest!;
}

describe('AAB-390 cross-locale purity is fail-closed before selection/apply', () => {
  beforeAll(() => setSummaryV2EnabledForTests(true));

  it('preserves per-entry and per-fact German source-locale ownership', () => {
    const manifest = buildSummaryV2ManifestForCv({
      cv: germanExperienceCv(), locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE,
    });
    expect(manifest.current?.sourceLocale).toBe('de');
    expect(manifest.priors[0]?.sourceLocale).toBe('de');
    expect(manifest.requiredCurrentFacts).toHaveLength(3);
    expect(manifest.requiredPriorFacts).toHaveLength(3);
    expect(manifest.requiredCurrentFacts.every((fact) => fact.entryId === 'current-de' && fact.sourceLocale === 'de')).toBe(true);
    expect(manifest.requiredPriorFacts.every((fact) => fact.entryId === 'prior-de' && fact.sourceLocale === 'de')).toBe(true);
  });

  it('rejects malformed JSON and every structural localization parity violation', () => {
    const manifest = buildSummaryV2ManifestForCv({
      cv: germanExperienceCv(), locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE,
    });
    const accepted = spanishLocalization();
    const valid = {
      targetLocale: accepted.targetLocale,
      entries: accepted.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: entry.localizedRoleTitle,
        facts: entry.facts.map((fact) => ({ factId: fact.factId, localizedText: fact.localizedText })),
      })),
    };
    expect(parseSummaryV2LocalizationProviderJson('{broken')).toBeNull();
    expect(validateSummaryV2LocalizationResponse(manifest, {
      ...valid, entries: valid.entries.slice(0, 1),
    }).reason).toBe('localization_entry_id_parity_failed');
    expect(validateSummaryV2LocalizationResponse(manifest, {
      ...valid, entries: valid.entries.map((entry, index) => index ? entry : { ...entry, facts: entry.facts.slice(1) }),
    }).reason).toBe('localization_fact_id_parity_failed');
    expect(validateSummaryV2LocalizationResponse(manifest, {
      ...valid, entries: valid.entries.map((entry, index) => index ? entry : { ...entry, facts: [...entry.facts, entry.facts[0]] }),
    }).reason).toBe('localization_fact_id_parity_failed');
    const moved = structuredClone(valid);
    moved.entries[1].facts.push(moved.entries[0].facts.pop()!);
    expect(validateSummaryV2LocalizationResponse(manifest, moved).reason).toBe('localization_fact_ownership_failed');
    expect(validateSummaryV2LocalizationResponse(manifest, { ...valid, targetLocale: 'de' }).reason)
      .toBe('localization_wrong_target_locale');
  });

  it('rejects untranslated, wrong-script, and enriched localized surfaces', () => {
    const manifest = buildSummaryV2ManifestForCv({
      cv: germanExperienceCv(), locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE,
    });
    const accepted = spanishLocalization();
    const valid = {
      targetLocale: accepted.targetLocale,
      entries: accepted.entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: entry.localizedRoleTitle,
        facts: entry.facts.map((fact) => ({ factId: fact.factId, localizedText: fact.localizedText })),
      })),
    };
    const germanRole = structuredClone(valid);
    germanRole.entries[0].localizedRoleTitle = manifest.current!.role;
    expect(validateSummaryV2LocalizationResponse(manifest, germanRole).reason).toBe('locale_impurity');
    const germanDuty = structuredClone(valid);
    germanDuty.entries[0].facts[0].localizedText = manifest.requiredCurrentFacts[0].bulletText;
    expect(validateSummaryV2LocalizationResponse(manifest, germanDuty).reason).toBe('locale_impurity');
    const wrongScript = structuredClone(valid);
    wrongScript.entries[0].facts[0].localizedText = '自転車を整備します。';
    expect(validateSummaryV2LocalizationResponse(manifest, wrongScript).reason).toBe('localization_wrong_script');
    const enriched = structuredClone(valid);
    enriched.entries[0].facts[0].localizedText = 'Increased efficiency by 20%.';
    expect(validateSummaryV2LocalizationResponse(manifest, enriched).reason)
      .toBe('localization_unsupported_material_claim');
  });

  it('generates a fully localized Spanish Summary from the validated fact manifest', () => {
    const cv = germanExperienceCv();
    const result = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_generate', requestedLocale: 'es', gender: 'male',
      cv, candidate: '', referenceDateIso: REFERENCE_DATE,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience, REFERENCE_DATE),
      localizedSummaryManifest: spanishLocalization(),
    });
    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    expect(result.text).toMatch(/Mecánico de bicicletas|Recepcionista/u);
    expect(result.text).toMatch(/mantenimiento de bicicletas|reservas/u);
    expect(result.text).not.toMatch(/Fahrrad|Rezeption|Wartungsarbeiten|Gäste|Reservierungen/u);
    expect(result.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(result.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(result.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(result.diagnostics?.finalPostconditionsPassed).toBe(true);
  });

  it('immediately strengthens the committed Spanish Summary without re-reading German facts', () => {
    const generated = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_generate', requestedLocale: 'es', gender: 'male',
      cv: germanExperienceCv(), candidate: '', referenceDateIso: REFERENCE_DATE,
      localizedSummaryManifest: spanishLocalization(),
    });
    const cv = germanExperienceCv(generated.text);
    const stronger = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_stronger', requestedLocale: 'es', gender: 'male',
      cv, candidate: '', rewriteStyle: 'stronger', referenceDateIso: REFERENCE_DATE,
      localizedSummaryManifest: spanishLocalization(generated.text),
    });
    expect(stronger.blocked).toBe(false);
    expect(stronger.countedAsSuccess).toBe(true);
    expect(stronger.text).not.toBe(generated.text);
    expect(stronger.text).not.toMatch(/Fahrrad|Rezeption|Wartungsarbeiten|Gäste|Reservierungen/u);
    expect(stronger.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(stronger.diagnostics?.finalPostconditionsPassed).toBe(true);
  });

  it.each([
    ['Generate', MIXED_GENERATE, undefined],
    ['Stronger', MIXED_STRONGER, 'stronger' as const],
  ])('rejects the exact mixed AAB-389 %s candidate before success', (_label, candidate, style) => {
    const original = style ? 'Resumen español válido conservado.' : '';
    const manifest = buildSummaryV2ManifestForCv({
      cv: germanExperienceCv(original), locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE,
    });
    const purity = validateSummaryV2AgainstManifest(candidate, manifest);
    expect(purity.ok).toBe(false);
    expect(purity.reason).toBe('locale_impurity');
    expect(purity.targetLocalePurityPassed).toBe(false);
    expect(purity.sourceLanguageLeakageDetected).toBe(true);
    expect(purity.unexpectedLocaleCodes).toContain('de');

    const result = finalize(candidate, original, style);
    expect(result.blocked).toBe(true);
    expect(result.countedAsSuccess).toBe(false);
    expect(result.reason).toBe('locale_impurity');
    expect(result.text).toBe(original);
    expect(result.diagnostics?.deterministicAccepted).toBe(false);
    expect(result.diagnostics?.finalPostconditionsPassed).toBe(false);
    expect(result.diagnostics?.finalTypedFailureReason).toBe('locale_impurity');
  });
});
