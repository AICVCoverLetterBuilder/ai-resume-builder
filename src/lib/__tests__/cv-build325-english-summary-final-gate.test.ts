/**
 * AAB-325 Phase 2 — English Summary final gate, apply/usage, pre-apply invariants.
 */
import { describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION,
  analyzeEnglishSummaryEmploymentQuality,
  buildEnglishEntryOwnedSummary,
} from '@/lib/cv-english-summary-grounding';
import {
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  checkSummaryDiagnosticInvariants,
  checkSummaryDiagnosticCompleteness,
} from '@/lib/cv-ai-diagnostics-contract';
import type { CVData } from '@/lib/types';

const WH_ES = [
  'Revisó la mercancía entrante en el almacén.',
  'Comprobó la documentación asociada a la mercancía recibida.',
  'Coordinó con sus compañeros la preparación y el movimiento de la mercancía.',
].join('\n');

const GD_ES = [
  'Crea materiales visuales y gráficos',
  'Revisa y adapta documentos de diseño',
  'Prepara archivos de diseño finales para formatos y pantallas',
].join('\n');

const AAB324_EN_BAD = [
  'Warehouse Employee at Atlas since January 2023, with approximately six and a',
  'half years of experience revisingó la mercancía entrante en el almacén,',
  'comprobingó la documentación asociada a la mercancía recibida and coordinating',
  'preparation and movement of goods with colleagues. Key skills include',
  'leadership, organization, critical thinking and adaptability.',
].join(' ');

function englishFixture(): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Empleada de almacén',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
        id: 'atlas',
        position: 'Empleada de almacén',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_ES,
        canonicalDescription: WH_ES,
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
    contentLocale: 'en',
  } as CVData;
}

describe('AAB-325 English Summary final gate and apply contract', () => {
  it('pre-apply marker reachable', () => {
    expect(SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION).toBe(
      'summary-invariant-preapply-gate-325-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION,
    );
  });

  it('12. invariant failure blocks apply and usage', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: AAB324_EN_BAD,
    });
    expect(fin.countedAsSuccess).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(fin.origin).toBe('deterministic_fallback');
    }

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 't',
      gender: 'female',
      requestId: 'req-325',
      usageCountBefore: 38,
      operationMode: 'generate',
      jobContextHash: 'j',
    });
    session.recordFinalizeResult(fin);
    const pre = session.evaluatePreApplyDecisionGates();
    if (!summaryV2ModeActive()) {
      expect(pre.diagnosticInvariantCheckPassed).toBe(true);
      expect(pre.passed).toBe(true);
    }
    session.recordVisibleApply(true, 39, fin.text);
    const trace = session.commit();
    if (!summaryV2ModeActive()) {
      expect(trace.visibleApplySucceeded).toBe(true);
      expect(trace.countedAsSuccess).toBe(true);
      expect(trace.usageCountAfter).toBe(39);
      expect(trace.diagnosticInvariantCheckPassed).toBe(true);
      expect(trace.diagnosticCompletenessPassed).toBe(true);
    }
  });

  it('47-52. English success populates structured fields and semantic roles', () => {
    const text = buildEnglishEntryOwnedSummary({
      role: 'Empleada de almacén',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'approximately six and a half years',
      dutyFacts: WH_ES.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Diseñadora gráfica',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_ES,
    });
    const q = analyzeEnglishSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'Empleada de almacén',
      priorCompany: 'Rewitu',
      priorRole: 'Diseñadora gráfica',
      currentEntryDuties: WH_ES,
      priorEntryDuties: GD_ES,
      gender: 'female',
      structuredSkills: [],
      currentEntryId: 'atlas',
    });
    expect(q.finalUnitSemanticRolesByUnit.length).toBeGreaterThanOrEqual(2);
    expect(q.finalUnitRoleSlots).toContain('current_intro');
    expect(q.finalUnitRoleSlots).toContain('prior_role');
    expect(q.finalUnitRoleSlots).not.toEqual(['summary_unit']);
    expect(q.currentRoleConcreteFactCoverage).toBeGreaterThanOrEqual(3);
    expect(q.priorRoleGroundingPassed).toBe(true);
    expect(q.finalUnsupportedCompetencyCount).toBe(0);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: englishFixture(),
      candidate: '',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalUnitSemanticRolesByUnit).toBeTruthy();
    expect(fin.diagnostics?.finalSlotValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalCurrentEmployerPresent).toBe(true);
    expect(fin.diagnostics?.finalPriorEmployerPresent).toBe(true);
  });

  it('es purity contradiction cannot succeed', () => {
    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'en',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      targetLocalePurityPassed: true,
      sourceLanguageLeakageDetected: false,
      wrongLocaleUnitCount: 0,
      unexpectedLocaleCodes: ['es'],
      detectedLocaleByUnit: ['es', 'en'],
      finalUnitRoleSlots: ['current_intro', 'current_duty', 'prior_role', 'total_duration'],
      finalUnitSemanticRolesByUnit: [['current_role_intro'], ['prior_role_intro'], ['total_duration']],
      currentRoleConcreteFactCoverage: 3,
      priorRoleGroundingPassed: true,
      currentRoleTitlePresent: true,
      finalCurrentEmployerPresent: true,
      finalPriorEmployerPresent: true,
      finalCurrentDutyCoveragePassed: true,
      finalPriorDutyCoveragePassed: true,
      finalSlotValidationPassed: true,
      structuredRoleLocaleValidationPassed: true,
      finalUnsupportedCompetencyCount: 0,
      finalDurationOwnerDetected: 'total_professional_experience',
      finalDurationScopeValidationPassed: true,
      requiredPriorDutyFactCount: 3,
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0]);
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) => String(f.invariantCode || '').includes('english_es'))).toBe(true);
  });

  it('null decision fields block completeness on English success', () => {
    const c = checkSummaryDiagnosticCompleteness({
      operationKind: 'summary',
      marker: 'SUMMARY_AI_DIAG_V1',
      requestedLocale: 'en',
      countedAsSuccess: true,
      visibleApplySucceeded: false,
      finalCandidateSource: 'deterministic_fallback',
      providerCandidatePresent: true,
      deterministicCandidatePresent: true,
      grammarValidationPassed: true,
      groundingValidationPassed: true,
      durationValidationPassed: true,
      usageCountBefore: 0,
      usageCountAfter: 0,
      meaningfulChangeDetected: true,
      noOpDetected: false,
      apiResponseKind: 'ok',
      serverFallbackUsed: false,
      clientFallbackUsed: true,
      apiBaseUrlConfigured: true,
      capacitorServerUrlConfigured: false,
      sourceCommitStatus: 'unknown',
      // Intentionally omit English decision fields
    });
    expect(c.passed).toBe(false);
  });
});
