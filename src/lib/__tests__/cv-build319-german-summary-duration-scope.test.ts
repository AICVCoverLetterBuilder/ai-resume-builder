/**
 * AAB-319 Phase 2 — German Summary duration scope + final acceptance gate.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import {
  GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION,
  SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION,
  analyzeGermanSummaryDurationScope,
  analyzeGermanSummaryEmploymentQuality,
  injectGermanTotalDurationSentence,
  formatGermanTotalProfessionalDurationSentence,
} from '@/lib/cv-german-summary-grounding';
import { resolveSummaryWithDurationPolicy } from '@/lib/cv-content-quality';
import { applyApproximateDurationPolicy } from '@/lib/cv-experience-duration';
import { finalizeCvAiFieldForApply, SUMMARY_RUNTIME_MARKER_SET } from '@/lib/cv-ai-finalize-apply';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
} from '@/lib/cv-summary-ai-diagnostics';
import type { CVData } from '@/lib/types';

const REF = '2026-07-19';

const WH_DE = [
  'Eingehende Waren prüfen',
  'Unterlagen prüfen',
  'Waren mit Kollegen vorbereiten und bewegen',
].join('\n');

const GD_DE = [
  'Visuelle Materialien und grafische Elemente erstellt',
  'Designmaterialien geprüft und angepasst',
  'Finale Designdateien für verschiedene Formate und Bildschirme vorbereitet',
].join('\n');

function germanFixture(summary = ''): CVData {
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
        position: 'Grafikdesignerin',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_DE,
        canonicalDescription: GD_DE,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: 'de',
  } as CVData;
}

describe('AAB-319 German Summary duration scope and acceptance', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
  });

  it('exposes Phase 2 revision markers in runtime set', () => {
    expect(GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION).toBe(
      'german-summary-duration-scope-319-v1',
    );
    expect(SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION).toBe(
      'summary-final-claim-acceptance-319-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain('german-summary-competency-grounding-319-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain('summary-explicit-skill-authority-319-v1');
  });

  it('CONTROL 1 — standalone insgesamt duration passes', () => {
    const ok = 'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.';
    const scope = analyzeGermanSummaryDurationScope(ok, { company: 'Atlas' });
    expect(scope.finalDurationScopeValidationPassed).toBe(true);
    expect(scope.finalDurationTotalCareerMarkerPresent).toBe(true);
    expect(scope.finalDurationCurrentRoleAttachmentRisk).toBe(false);
    expect(scope.finalDurationOwnerDetected).toBe('total_professional_experience');
  });

  it('CONTROL 2 — current-role attachment rejects', () => {
    const bad = 'Lagermitarbeiterin bei Atlas seit Januar 2023 mit etwa sechseinhalb Jahren Erfahrung.';
    const scope = analyzeGermanSummaryDurationScope(bad, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
    });
    expect(scope.finalDurationScopeValidationPassed).toBe(false);
    expect(scope.finalDurationCurrentRoleAttachmentRisk).toBe(true);
    const quality = analyzeGermanSummaryEmploymentQuality(bad, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      currentEntryDuties: WH_DE,
    });
    expect(quality.groundingValidationPassed).toBe(false);
  });

  it('CONTROL 3 — injectGermanTotalDurationSentence is idempotent and scoped', () => {
    const base = 'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Prüfung eingehender Waren.';
    const phrase = 'mit etwa sechseinhalb Jahren Erfahrung';
    const once = injectGermanTotalDurationSentence(base, phrase, 'female');
    const twice = injectGermanTotalDurationSentence(once, phrase, 'female');
    expect(once).toMatch(/insgesamt/i);
    expect(once).toMatch(/sechseinhalb/);
    expect(twice).toBe(once);
    const scope = analyzeGermanSummaryDurationScope(once, { company: 'Atlas' });
    expect(scope.finalDurationScopeValidationPassed).toBe(true);
  });

  it('CONTROL 4 — duration finalizer relocates attached duration to total-career sentence', () => {
    const attached = 'Lagermitarbeiterin bei Atlas seit Januar 2023 mit etwa sechseinhalb Jahren Erfahrung. Zuvor war sie als Grafikdesignerin bei Rewitu tätig.';
    const duration = applyApproximateDurationPolicy(78);
    const resolved = resolveSummaryWithDurationPolicy(attached, duration, 'de', {
      forceDurationPhrase: true,
      requireDurationClaim: true,
      context: { company: 'Atlas', role: 'Lagermitarbeiterin', gender: 'female' },
    });
    expect(resolved.summary).toMatch(/insgesamt/i);
    expect(resolved.summary).toMatch(/sechseinhalb/);
    expect(resolved.summary).not.toMatch(
      /bei Atlas seit Januar 2023[^.]*sechseinhalb/i,
    );
    const scope = analyzeGermanSummaryDurationScope(resolved.summary, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
    });
    expect(scope.finalDurationScopeValidationPassed).toBe(true);
  });

  it('CONTROL 5 — exactly one duration claim after German inject', () => {
    const sentence = formatGermanTotalProfessionalDurationSentence(
      'mit etwa sechseinhalb Jahren Erfahrung',
      'female',
    );
    expect(sentence).toMatch(/^Ich verfüge über insgesamt etwa sechseinhalb Jahre Berufserfahrung\.$/);
  });

  it('empty German Summary finalize: duration scope + slots + acceptance diagnostics', () => {
    const cv = germanFixture('');
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(fin.text).toMatch(/insgesamt/i);
      expect(fin.text).toMatch(/sechseinhalb/i);
    } else {
      expectSummaryContractInvariants({
        text: fin.text,
        locale: 'de',
        cv,
        requirePrior: true,
      });
      expect(fin.text).toMatch(/Erfahrung|Jahre|Atlas|Ich/i);
    }
    expect(fin.text).not.toMatch(/Kernkompetenzen/i);
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.finalDurationScopeValidationPassed).toBe(true);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.finalDurationOwnerDetected).toBe('total_professional_experience');
      expect(fin.diagnostics?.finalDurationCurrentRoleAttachmentRisk).toBe(false);
      expect(fin.diagnostics?.finalDurationTotalCareerMarkerPresent).toBe(true);
      expect(fin.diagnostics?.unsupportedClaimCount).toBe(0);
      expect(fin.diagnostics?.currentIntroSlotPresent).toBe(true);
      expect(fin.diagnostics?.priorRoleSlotPresent).toBe(true);
      expect(fin.diagnostics?.competencyInferenceFromRoleForbidden).toBe(true);
      expect(Array.isArray(fin.diagnostics?.finalUnitRoleSlots)).toBe(true);
      expect((fin.diagnostics?.finalUnitRoleSlots || []).length).toBeGreaterThan(0);
    }

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      requestId: 'de-319-scope',
      usageCountBefore: 0,
      gender: 'female',
      operationMode: 'generate_from_empty',
    });
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, 1, fin.text);
    const trace = session.commit();
    if (!summaryV2ModeActive()) {
      expect(trace.diagnosticInvariantCheckPassed).toBe(true);
      expect(trace.diagnosticCompletenessPassed).toBe(true);
      expect(trace.finalDurationScopeValidationPassed).toBe(true);
      expect(trace.unsupportedClaimCount).toBe(0);
      expect(trace.countedAsSuccess).toBe(true);
    } else {
      expect(fin.countedAsSuccess).toBe(true);
      expect(fin.text.length).toBeGreaterThan(40);
    }
  });

  it('ambiguous provider duration is rejected or restructured before apply', () => {
    const cv = germanFixture('');
    const ambiguous = [
      'Lagermitarbeiterin bei Atlas seit Januar 2023, zuständig für die Prüfung',
      'eingehender Waren und der zugehörigen Dokumentation sowie die Koordination mit',
      'Kollegen bei der Vorbereitung und dem Transport von Waren, mit etwa',
      'sechseinhalb Jahren Erfahrung. Zuvor war sie als Grafikdesignerin bei Rewitu',
      'tätig, wo sie visuelle Materialien erstellte, Designunterlagen überarbeitete und',
      'finale Dateien für verschiedene Formate aufbereitete.',
    ].join(' ');
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: ambiguous,
      referenceDateIso: REF,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(fin.text).toMatch(/insgesamt/i);
    } else {
      expect(fin.text).toMatch(/Erfahrung|Jahre|Atlas|Ich/i);
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.finalDurationScopeValidationPassed).toBe(true);
    }
    expect(fin.diagnostics?.finalDurationCurrentRoleAttachmentRisk).toBe(false);
    expect(fin.text).not.toMatch(
      /bei Atlas seit Januar 2023[^.]*sechseinhalb Jahren Erfahrung/i,
    );
  });
});
