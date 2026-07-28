/**
 * AAB-322 Phase 1 — German Summary structured role localization.
 */
import { describe, expect, it } from 'vitest';
import {
  GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION,
  SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION,
  analyzeGermanSummaryEmploymentQuality,
  resolveLocalizedSummaryRole,
  repairGermanSummaryStructuredRoleLocales,
  validateSummaryStructuredRoleLocale,
} from '@/lib/cv-german-summary-grounding';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

/** Exact AAB-321 device Summary with Spanish prior role leak. */
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

describe('AAB-322 German Summary structured role localization', () => {
  it('revision markers reachable', () => {
    expect(GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION).toBe(
      'german-summary-structured-role-localization-322-v1',
    );
    expect(SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION).toBe(
      'summary-shared-role-localization-322-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION,
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION);
  });

  it('1-3. exact AAB-321 Summary detects Spanish prior and fails purity', () => {
    const q = analyzeGermanSummaryEmploymentQuality(AAB321_SPANISH_PRIOR_LEAK, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_ES,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.foreignPriorRoleTitleCount).toBeGreaterThanOrEqual(1);
    expect(q.rawSourceRoleLeakageDetected).toBe(true);
    expect(q.structuredRoleLocaleValidationPassed).toBe(false);
    expect(q.slotValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('4-6. repair replaces with Grafikdesignerin and passes', () => {
    const repaired = repairGermanSummaryStructuredRoleLocales(AAB321_SPANISH_PRIOR_LEAK, {
      currentRole: 'Lagermitarbeiterin',
      priorRole: 'Diseñadora gráfica',
      gender: 'female',
    });
    expect(repaired.applied).toBe(true);
    expect(repaired.text).toMatch(/Grafikdesignerin/);
    expect(repaired.text).not.toMatch(/Diseñadora\s+gráfica/i);
    expect(repaired.text).toMatch(/\bAtlas\b/);
    expect(repaired.text).toMatch(/\bRewitu\b/);
    expect(repaired.text).toMatch(/seit\s+Januar\s+2023/i);
    expect(repaired.text).toMatch(/insgesamt/i);
    expect(repaired.transformationKinds).toContain('prior_role_title_localized');

    const q = analyzeGermanSummaryEmploymentQuality(repaired.text, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_DE,
      priorEntryDuties: GD_ES,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.structuredRoleLocaleValidationPassed).toBe(true);
    expect(q.foreignPriorRoleTitleCount).toBe(0);
    expect(q.rawSourceRoleLeakageDetected).toBe(false);
    // AAB-355: repaired third-person shell still fails first-person Summary contract.
    expect(q.perspectiveMode).toBe('neutral_cv');
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('7-8. finalize applies localized repaired candidate', () => {
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
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toMatch(/Grafikdesignerin/);
    expect(fin.text).not.toMatch(/Diseñadora\s+gráfica/i);
    expect(
      fin.diagnostics?.finalCandidateSource === 'repaired_provider'
      || fin.diagnostics?.finalCandidateSource === 'deterministic_fallback',
    ).toBe(true);
    expect(fin.text).toMatch(/Ich\s+verfüge|Derzeit\s+arbeite\s+ich/i);
    expect(fin.diagnostics?.structuredRoleLocaleValidationPassed).toBe(true);
    expect(fin.diagnostics?.foreignPriorRoleTitleCount).toBe(0);
  });

  it('9-12. shared resolver gender forms', () => {
    const female = resolveLocalizedSummaryRole({
      role: 'Diseñadora gráfica',
      sourceLocale: 'es',
      targetLocale: 'de',
      gender: 'female',
    });
    expect(female.localizedTargetRoleLabel).toBe('Grafikdesignerin');
    expect(female.localizationValidationPassed).toBe(true);

    const male = resolveLocalizedSummaryRole({
      role: 'Diseñador gráfico',
      sourceLocale: 'es',
      targetLocale: 'de',
      gender: 'male',
    });
    expect(male.localizedTargetRoleLabel).toBe('Grafikdesigner');

    const unspecified = resolveLocalizedSummaryRole({
      role: 'Diseñadora gráfica',
      targetLocale: 'de',
      gender: 'unspecified',
    });
    expect(unspecified.localizedTargetRoleLabel).toMatch(/Grafikdesigner/);
    expect(unspecified.localizationValidationPassed).toBe(true);

    const current = resolveLocalizedSummaryRole({
      role: 'Lagermitarbeiterin',
      targetLocale: 'de',
      gender: 'female',
    });
    const prior = resolveLocalizedSummaryRole({
      role: 'Diseñadora gráfica',
      targetLocale: 'de',
      gender: 'female',
    });
    expect(current.localizationSource).toBeTruthy();
    expect(prior.canonicalRoleIdentity).toBe('graphic_designer');
    expect(prior.canonicalRoleIdentityHash).toBeTruthy();
  });

  it('13-15. canonical identity preserved; no invented seniority', () => {
    const r = resolveLocalizedSummaryRole({
      role: 'Diseñadora gráfica',
      targetLocale: 'de',
      gender: 'female',
    });
    expect(r.canonicalRoleIdentity).toBe('graphic_designer');
    expect(r.localizedTargetRoleLabel).not.toMatch(/Senior|Lead|Director|Art\s*Director/i);
    expect(r.localizedTargetRoleLabel).not.toBe('Designerin');
    expect(r.localizedTargetRoleLabel).not.toMatch(/Mediengestalter/i);
  });

  it('16-19. foreign role detection and employer exemption', () => {
    const bad = validateSummaryStructuredRoleLocale({
      summary: AAB321_SPANISH_PRIOR_LEAK,
      targetLocale: 'de',
      gender: 'female',
      currentRole: 'Lagermitarbeiterin',
      priorRole: 'Diseñadora gráfica',
    });
    expect(bad.structuredRoleLocaleValidationPassed).toBe(false);
    expect(bad.foreignPriorRoleTitleCount).toBeGreaterThanOrEqual(1);

    const good = validateSummaryStructuredRoleLocale({
      summary: AAB321_SPANISH_PRIOR_LEAK.replace(/Diseñadora gráfica/g, 'Grafikdesignerin'),
      targetLocale: 'de',
      gender: 'female',
      currentRole: 'Lagermitarbeiterin',
      priorRole: 'Diseñadora gráfica',
    });
    expect(good.structuredRoleLocaleValidationPassed).toBe(true);
    // Employer proper nouns remain.
    expect(AAB321_SPANISH_PRIOR_LEAK).toMatch(/\bAtlas\b/);
    expect(AAB321_SPANISH_PRIOR_LEAK).toMatch(/\bRewitu\b/);
  });

  it('21-24. free-text unknown foreign role fails closed', () => {
    const unknown = resolveLocalizedSummaryRole({
      role: 'Especialista en unicornios cuánticos',
      sourceLocale: 'es',
      targetLocale: 'de',
      gender: 'female',
    });
    expect(unknown.localizationValidationPassed).toBe(false);
    expect(unknown.rejectionReasons.length).toBeGreaterThan(0);
    expect(unknown.localizedTargetRoleLabel).toBe('');
  });
});
