/**
 * AAB-322 Phase 2 — structured entity locale diagnostics + visible verification.
 */
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION,
  SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION,
  validateSummaryStructuredRoleLocale,
  verifyVisibleSummaryStructuredRoleLocale,
} from '@/lib/cv-summary-structured-role-localization';
import {
  checkSummaryDiagnosticCompleteness,
  checkSummaryDiagnosticInvariants,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

const AAB321_SPANISH_PRIOR_LEAK = [
  'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Warenannahme,',
  'Dokumentenprüfung und Abstimmung mit Kolleginnen und Kollegen bei der',
  'Vorbereitung und dem Transport von Waren. Zuvor war sie als Diseñadora gráfica',
  'bei Rewitu tätig mit der Erstellung und Anpassung visueller Materialien sowie',
  'Aufbereitung finaler Designdateien für verschiedene Formate und Bildschirme.',
  'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
].join(' ');

const WH_DE = [
  'Prüft eingehende Waren',
  'Prüft die zugehörige Dokumentation',
  'Koordiniert mit Kollegen die Vorbereitung und Bewegung von Waren',
].join('\n');

const GD_ES = [
  'Crea materiales visuales y gráficos',
  'Revisa y adapta documentos de diseño',
  'Prepara archivos de diseño finales para formatos y pantallas',
].join('\n');

function germanFixtureWithSpanishPrior(summary = ''): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender: 'female',
    },
    summary,
    experience: [
      {
        id: 'atlas',
        position: 'Lagermitarbeiterin',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_DE,
        canonicalDescription: WH_DE,
      },
      {
        id: 'rewitu',
        position: 'Diseñadora gráfica',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_ES,
        canonicalDescription: GD_ES,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-322 structured entity locale diagnostics', () => {
  it('markers reachable in runtime set', () => {
    expect(SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION).toBe(
      'summary-structured-entity-locale-validation-322-v1',
    );
    expect(SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION).toBe(
      'summary-visible-role-locale-verification-322-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION,
    );
  });

  it('25-27. unit may be German while structured role fails purity', () => {
    const v = validateSummaryStructuredRoleLocale({
      summary: AAB321_SPANISH_PRIOR_LEAK,
      targetLocale: 'de',
      gender: 'female',
      currentRole: 'Lagermitarbeiterin',
      priorRole: 'Diseñadora gráfica',
    });
    expect(v.structuredRoleLocaleValidationPassed).toBe(false);
    expect(v.foreignPriorRoleTitleCount).toBeGreaterThanOrEqual(1);
    expect(v.rawSourceRoleLeakageDetected).toBe(true);
    expect(v.failureKinds).toEqual(
      expect.arrayContaining(['foreign_prior_role_title', 'raw_source_role_leakage']),
    );
  });

  it('28-30. finalize recovers German first-person with localized prior role; hashes diverge', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixtureWithSpanishPrior(''),
      candidate: AAB321_SPANISH_PRIOR_LEAK,
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    // AAB-355: third-person repaired shells fail first-person contract → deterministic recovery.
    expect(
      fin.diagnostics?.finalCandidateSource === 'repaired_provider'
      || fin.diagnostics?.finalCandidateSource === 'deterministic_fallback',
    ).toBe(true);
    expect(fin.text).toMatch(/Grafikdesignerin/);
    expect(fin.text).not.toMatch(/Diseñadora\s+gráfica/i);
    expect(fin.text).toMatch(/Ich\s+verfüge|Derzeit\s+arbeite\s+ich/i);
    if (fin.diagnostics?.finalCandidateSource === 'repaired_provider') {
      expect(fin.diagnostics?.repairTransformationKinds).toEqual(
        expect.arrayContaining(['prior_role_title_localized']),
      );
      expect(fin.diagnostics?.repairRoleLocalizationTransformationKinds).toEqual(
        expect.arrayContaining(['prior_role_title_localized']),
      );
    }
    expect(fin.diagnostics?.structuredRoleLocaleValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalStructuredRoleLocaleValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalForeignRoleTitleCount).toBe(0);
    expect(fin.diagnostics?.rawSourceRoleLeakageDetected).toBe(false);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    const providerHash = String(fin.diagnostics?.providerCandidateHash || '');
    const finalHash = String(
      fin.diagnostics?.finalValidatedCandidateHash
      || fin.diagnostics?.deterministicCandidateHash
      || fin.diagnostics?.repairCandidateHash
      || '',
    );
    expect(finalHash.length).toBeGreaterThan(0);
    if (providerHash) {
      expect(finalHash).not.toBe(providerHash);
    }
  });

  it('31. visible structured-role verification passes for localized text', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv: germanFixtureWithSpanishPrior(''),
      candidate: AAB321_SPANISH_PRIOR_LEAK,
      originHint: 'ai_generated',
      referenceDateIso: REF,
    });
    const visible = verifyVisibleSummaryStructuredRoleLocale({
      visibleSummary: fin.text,
      targetLocale: 'de',
      gender: 'female',
      currentRole: 'Lagermitarbeiterin',
      priorRole: 'Diseñadora gráfica',
      finalStructuredRoleLocaleValidationPassed: true,
    });
    expect(visible.visibleStructuredRoleLocaleValidationPassed).toBe(true);
    expect(visible.visibleWrongLocaleStructuredRoleCount).toBe(0);
    expect(visible.visibleRoleLocalizationMismatch).toBe(false);
  });

  it('visible Spanish leak fails visible verification', () => {
    const visible = verifyVisibleSummaryStructuredRoleLocale({
      visibleSummary: AAB321_SPANISH_PRIOR_LEAK,
      targetLocale: 'de',
      gender: 'female',
      currentRole: 'Lagermitarbeiterin',
      priorRole: 'Diseñadora gráfica',
      finalStructuredRoleLocaleValidationPassed: true,
    });
    expect(visible.visibleStructuredRoleLocaleValidationPassed).toBe(false);
    expect(visible.visibleWrongLocaleStructuredRoleCount).toBeGreaterThanOrEqual(1);
    expect(visible.failureKind).toBe('visible_role_localization_mismatch');
  });

  it('invariants: target purity cannot pass with foreign structured role', () => {
    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'de',
      targetLocalePurityPassed: true,
      foreignStructuredRoleTitleCount: 1,
      wrongLocaleUnitCount: 0,
      countedAsSuccess: false,
    } as never);
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) =>
      f.invariantCode === 'target_purity_forbids_foreign_structured_roles'
      || f.invariantCode === 'unit_locale_ok_cannot_hide_foreign_structured_role')).toBe(true);
  });

  it('completeness requires structured-role fields on DE success', () => {
    const incomplete = checkSummaryDiagnosticCompleteness({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1,
      marker: 'SUMMARY_AI_DIAG_V1',
      operationKind: 'summary',
      finalCandidateSource: 'repaired_provider',
      providerCandidatePresent: true,
      deterministicCandidatePresent: false,
      grammarValidationPassed: true,
      groundingValidationPassed: true,
      durationValidationPassed: true,
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 0,
      usageCountAfter: 1,
      meaningfulChangeDetected: true,
      noOpDetected: false,
      apiResponseKind: 'provider',
      serverFallbackUsed: false,
      clientFallbackUsed: false,
      apiBaseUrlConfigured: true,
      capacitorServerUrlConfigured: false,
      sourceCommitStatus: 'embedded',
      sourceCommitShort: 'abc1234',
      requestedLocale: 'de',
      finalUnitRoleSlots: ['current_intro'],
      currentIntroSlotPresent: true,
      currentDutySlotPresent: true,
      priorRoleSlotPresent: true,
      unsupportedClaimCount: 0,
      finalDurationOwnerExpected: 'total_professional_experience',
      finalDurationOwnerDetected: 'total_professional_experience',
      finalDurationScopeValidationPassed: true,
      finalDurationCurrentRoleAttachmentRisk: false,
      finalDurationTotalCareerMarkerPresent: true,
      competencyInferenceFromRoleForbidden: true,
      finalUnitSemanticRolesByUnit: [['current_intro']],
      finalCurrentEmployerPresent: true,
      finalPriorEmployerPresent: true,
      finalCurrentEmploymentStateExpressed: true,
      finalPriorEmploymentStateExpressed: true,
      finalCurrentRoleIntroValidationPassed: true,
      finalPriorRoleIntroValidationPassed: true,
      finalSlotValidationPassed: true,
      // intentionally omit AAB-322 fields
    });
    expect(incomplete.passed).toBe(false);
    expect(incomplete.missingRequiredDiagnosticFields).toEqual(
      expect.arrayContaining([
        'structuredRoleLocaleValidationPassed',
        'rawSourceRoleLeakageDetected',
        'finalStructuredRoleLocaleValidationPassed',
      ]),
    );
  });

  it('32. privacy: validator failure kinds are typed codes only', () => {
    const v = validateSummaryStructuredRoleLocale({
      summary: AAB321_SPANISH_PRIOR_LEAK,
      targetLocale: 'de',
      priorRole: 'Diseñadora gráfica',
      gender: 'female',
    });
    const blob = JSON.stringify(v);
    expect(blob).not.toMatch(/Diseñadora/);
    expect(v.priorRoleCanonicalIdentityHashes.every((h) => /^fnv1a_/.test(h))).toBe(true);
  });
});
