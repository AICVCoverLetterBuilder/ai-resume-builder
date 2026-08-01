import { beforeAll, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import {
  clearSummaryAiDiagnosticsForTests,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  buildSummaryV2ManifestForCv,
  acceptSummaryV2LocalizationResponse,
  parseSummaryV2LocalizationProviderJson,
  validateSummaryV2LocalizationResponse,
  setSummaryV2EnabledForTests,
  validateSummaryV2AgainstManifest,
  realizeFirstPersonDutyClause,
  evaluateSummaryV2NativeSurface,
  clearSummaryV2LocalizationCacheForTests,
  localizeSummaryV2Manifest,
} from '@/lib/cv-summary-v2';
import type { SummaryV2LocalizedManifest } from '@/lib/cv-summary-v2';

const REFERENCE_DATE = '2026-08-01';

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
        description: 'Begrüßte Gäste professionell an der Rezeption des Hotels.\nErfasste und verwaltete Reservierungen sowie nahm notwendige Änderungen vor.\nBeantwortete Anfragen und Fragen der Gäste kompetent und serviceorientiert.',
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
            { factId: prior[0].factId, localizedText: 'Recibió a los huéspedes de manera profesional en la recepción del hotel.' },
            { factId: prior[1].factId, localizedText: 'Registró y gestionó las reservas, y realizó los cambios necesarios.' },
            { factId: prior[2].factId, localizedText: 'Atendió las consultas y preguntas de los huéspedes de forma competente y orientada al servicio.' },
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
    const duration = buildExperienceDurationSnapshot(germanExperienceCv().experience, REFERENCE_DATE);
    expect(duration.byExperienceId['current-de'].totalMonths).toBe(31);
    expect(duration.byExperienceId['prior-de'].totalMonths).toBe(35);
    expect(duration.total.totalMonths).toBe(67);
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
    expect(result.text).toContain('registr\u00e9 y gestion\u00e9');
    expect(result.text).toContain('realic\u00e9');
    expect(result.text).toContain('atend\u00ed');
    expect(result.text).not.toMatch(/\b(?:realiz\u00f3|atendi\u00f3|respondi\u00f3|gestion\u00f3)\b/iu);
  });

  it.each([
    ['present pair', 'Registra y gestiona reservas.', 'present', 'registro y gestiono reservas'],
    ['present triple', 'Realiza, revisa y comprueba la documentaci\u00f3n.', 'present', 'realizo, reviso y compruebo la documentaci\u00f3n'],
    ['completed pair', 'Registr\u00f3 y gestion\u00f3 reservas.', 'completed', 'registr\u00e9 y gestion\u00e9 reservas'],
    ['completed triple', 'Recibi\u00f3, registr\u00f3 y respondi\u00f3 consultas.', 'completed', 'recib\u00ed, registr\u00e9 y respond\u00ed consultas'],
    ['completed compound object', 'Registr\u00f3 y gestion\u00f3 las reservas, y realiz\u00f3 los cambios necesarios.', 'completed', 'registr\u00e9 y gestion\u00e9 las reservas, y realic\u00e9 los cambios necesarios'],
  ] as const)('realizes Spanish %s coordinated predicates consistently', (_label, source, state, expected) => {
    expect(realizeFirstPersonDutyClause(source, 'es', state)).toBe(expected);
  });

  it('rejects a mixed-person Spanish chain before selection or apply', () => {
    const fullMalformed = 'Anteriormente trabaj\u00e9 como recepcionista, donde recib\u00ed a los hu\u00e9spedes, registr\u00e9 y gestion\u00e9 reservas, y realiz\u00f3 los cambios necesarios y atend\u00ed consultas.';
    expect(evaluateSummaryV2NativeSurface({ text: fullMalformed, locale: 'es', perspectiveMode: 'first_person', hasPrior: true }).nativeSurfaceValidationPassed).toBe(false);
    const malformed = 'Anteriormente trabaj\u00e9 como recepcionista, donde registr\u00e9 y gestion\u00f3 reservas.';
    const native = evaluateSummaryV2NativeSurface({ text: malformed, locale: 'es', hasPrior: true });
    expect(native.nativeSurfaceValidationPassed).toBe(false);
    expect(native.grammaticalPersonValidationPassed).toBe(false);
    expect(native.nativeSurfaceRejectionReasons).toContain('mixed_person_predicate_chain');
    const manifest = buildSummaryV2ManifestForCv({
      cv: germanExperienceCv(), locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE,
    });
    const invalid = structuredClone({
      targetLocale: 'es',
      entries: spanishLocalization().entries.map((entry) => ({
        entryId: entry.entryId,
        localizedRoleTitle: entry.localizedRoleTitle,
        facts: entry.facts.map((fact) => ({ factId: fact.factId, localizedText: fact.localizedText })),
      })),
    });
    invalid.entries[1].facts[1].localizedText = 'Registr\u00e9 y gestion\u00f3 reservas.';
    expect(validateSummaryV2LocalizationResponse(manifest, invalid).reason).toBe('mixed_person_predicate_chain');
  });

  it('keeps Spanish first- and third-person coordination contracts separate', () => {
    const firstValid = evaluateSummaryV2NativeSurface({
      text: 'Actualmente trabajo como recepcionista, donde registr\u00e9 y gestion\u00e9 reservas.',
      locale: 'es', perspectiveMode: 'first_person', hasCurrent: true,
    });
    const firstInvalid = evaluateSummaryV2NativeSurface({
      text: 'Actualmente trabajo como recepcionista, donde registr\u00e9 y gestion\u00f3 reservas.',
      locale: 'es', perspectiveMode: 'first_person', hasCurrent: true,
    });
    const thirdValid = evaluateSummaryV2NativeSurface({
      text: 'Profesional que actualmente trabaja como recepcionista. Registra y gestiona reservas. Anteriormente trabaj\u00f3 como asistente, donde registr\u00f3 y gestion\u00f3 solicitudes.',
      locale: 'es', perspectiveMode: 'cv_third_person', hasCurrent: true, hasPrior: true,
    });
    const thirdInvalid = evaluateSummaryV2NativeSurface({
      text: 'Anteriormente trabaj\u00f3 como asistente, donde registr\u00f3 y gestion\u00e9 solicitudes.',
      locale: 'es', perspectiveMode: 'cv_third_person', hasPrior: true,
    });
    expect(firstValid.nativeSurfaceValidationPassed).toBe(true);
    expect(firstInvalid.nativeSurfaceRejectionReasons).toContain('mixed_person_predicate_chain');
    expect(thirdValid.nativeSurfaceValidationPassed).toBe(true);
    expect(thirdInvalid.nativeSurfaceRejectionReasons).toContain('mixed_person_predicate_chain');
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

  it('distinguishes ambiguous Romance detection from confirmed foreign leakage', () => {
    const acceptedSpanish = validateAiUnitLocalePurity(
      'Actualmente trabajo como instalador, donde coloco y aseguro los paneles solares.',
      'es',
      { kind: 'summary_sentence' },
    );
    expect(acceptedSpanish.targetLocalePurityPassed).toBe(true);
    expect(acceptedSpanish.unexpectedLocaleCodes).toEqual([]);

    const leakedGerman = validateAiUnitLocalePurity(
      'Actualmente trabajo como instalador. Ich pr\u00fcfe Fahrr\u00e4der und tausche defekte Bauteile aus.',
      'es',
      { kind: 'summary_sentence' },
    );
    expect(leakedGerman.targetLocalePurityPassed).toBe(false);
    expect(leakedGerman.unexpectedLocaleCodes).toContain('de');
    expect(leakedGerman.sourceLanguageLeakageDetected).toBe(true);
  });

  it('uses operation locale authority and makes Spanish visible validation transactional', () => {
    clearSummaryAiDiagnosticsForTests();
    const cv = germanExperienceCv();
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'es', contentLocale: 'de', templateId: 'modern-minimal',
      requestId: 'aab391-visible-pass', usageCountBefore: 0, gender: 'male',
      operationMode: 'generate_empty_content',
    });
    session.recordCvSnapshot(cv, '');
    const generated = finalizeCvAiFieldForApply({
      field: 'summary', action: 'summary_generate', requestedLocale: 'es', gender: 'male',
      cv, candidate: '', referenceDateIso: REFERENCE_DATE,
      localizedSummaryManifest: spanishLocalization(),
    });
    session.recordFinalizeResult(generated);
    session.recordVisibleApply(true, 1, generated.text);
    const trace = session.commit();
    expect(trace.storedContentLocaleBeforeRequest).toBe('de');
    expect(trace.storedContentLocale).toBe('es');
    expect(trace.visibleTargetLocalePurityPassed).toBe(true);
    expect(trace.visibleSourceLanguageLeakageDetected).toBe(false);
    expect(trace.visibleGrammarValidationPassed).toBe(true);
    expect(trace.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(trace.visibleCurrentDutyCoveragePassed).toBe(true);
    expect(trace.visiblePriorDutyCoveragePassed).toBe(true);
    expect(trace.visibleFinalPostconditionsPassed).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(1);

    const failed = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'es', contentLocale: 'de', templateId: 'modern-minimal',
      requestId: 'aab391-visible-fail', usageCountBefore: 0, gender: 'male',
      operationMode: 'generate_empty_content',
    });
    failed.recordCvSnapshot(cv, '');
    failed.recordFinalizeResult(generated);
    failed.recordVisibleApply(true, 1, generated.text.replace('registr\u00e9 y gestion\u00e9', 'registr\u00e9 y gestion\u00f3'));
    const failedTrace = failed.commit();
    expect(failedTrace.visibleNativeSurfaceValidationPassed).toBe(false);
    expect(failedTrace.visibleFinalPostconditionsPassed).toBe(false);
    expect(failedTrace.countedAsSuccess).toBe(false);
    expect(failedTrace.usageCountAfter).toBe(0);
  });

  it('attributes stale declared Experience locale separately from effective text authority', () => {
    clearSummaryAiDiagnosticsForTests();
    const cv = germanExperienceCv();
    cv.contentLocale = 'es';
    for (const entry of cv.experience) entry.generatedLocale = 'es';
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'es', requestedLocale: 'es', contentLocale: 'es', templateId: 'modern-minimal',
      requestId: 'aab394-stale-entry-locale', usageCountBefore: 0, gender: 'male',
      operationMode: 'generate_from_context',
    });
    session.recordCvSnapshot(cv, '');
    const trace = session.commit();
    expect(Object.values(trace.declaredExperienceLocaleByEntryHash)).toEqual(['es', 'es']);
    expect(Object.values(trace.detectedExperienceTextLocaleByEntryHash)).toEqual(['de', 'de']);
    expect(Object.values(trace.effectiveSourceLocaleByEntryHash)).toEqual(['de', 'de']);
    expect(Object.values(trace.effectiveSourceLocaleAuthorityByEntryHash)).toEqual(['detected', 'detected']);
    expect(Object.values(trace.localizationRequiredByEntryHash)).toEqual([true, true]);
  });

  it('does not let a validated localization cache mask stale declared locale or changed German source text', async () => {
    clearSummaryV2LocalizationCacheForTests();
    const cv = germanExperienceCv();
    cv.contentLocale = 'es';
    for (const entry of cv.experience) entry.generatedLocale = 'es';
    let calls = 0;
    const transport = async (request: { entries: Array<{ entryId: string; facts: Array<{ factId: string }> }> }) => {
      calls += 1;
      const localized = new Map(spanishLocalization().entries.map((entry) => [
        entry.entryId,
        new Map(entry.facts.map((fact) => [fact.factId, fact.localizedText])),
      ]));
      return {
        targetLocale: 'es' as const,
        entries: request.entries.map((entry) => ({
          entryId: entry.entryId,
          localizedRoleTitle: entry.entryId === 'current-de' ? 'Mecánico de bicicletas' : 'Recepcionista',
          facts: entry.facts.map((fact) => ({
            factId: fact.factId,
            localizedText: localized.get(entry.entryId)?.get(fact.factId) || 'Atendió las consultas de los huéspedes.',
          })),
        })),
      };
    };
    const first = buildSummaryV2ManifestForCv({ cv, locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE });
    expect(first.current?.sourceLocale).toBe('de');
    expect(first.priors[0]?.sourceLocale).toBe('de');
    const cold = await localizeSummaryV2Manifest({ manifest: first, transport });
    expect(cold.localizationSource).toBe('provider');
    expect(calls).toBe(1);
    const cached = await localizeSummaryV2Manifest({ manifest: first, transport });
    expect(cached.localizationSource).toBe('validated_cache');
    expect(calls).toBe(1);
    cv.experience[1].description += '\\nBearbeitete zusätzliche deutsche Anfragen.';
    cv.experience[1].description = cv.experience[1].description.replace('professionell', 'zuvorkommend');
    const changed = buildSummaryV2ManifestForCv({ cv, locale: 'es', gender: 'male', referenceDateIso: REFERENCE_DATE });
    const changedOutcome = await localizeSummaryV2Manifest({ manifest: changed, transport });
    expect(changed.priors[0]?.sourceLocale).toBe('de');
    expect(changedOutcome.localizationSource).toBe('provider');
    expect(calls).toBe(2);
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
