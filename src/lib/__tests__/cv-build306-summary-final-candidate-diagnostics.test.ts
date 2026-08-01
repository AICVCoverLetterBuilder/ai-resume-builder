/**
 * @vitest-environment jsdom
 *
 * AAB-306 Phase 2: Summary final-candidate diagnostics truthfulness.
 * Duration normalization must not be labeled ai_repaired; provider rejection
 * evidence and final unit hashes must be complete on successful apply.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  runCvAiApplyPipeline,
  SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { SUMMARY_V2_SPANISH_PERSPECTIVE_NATIVE_SURFACE_391_REVISION } from '@/lib/cv-summary-v2';
import { SPANISH_SUMMARY_GROUNDING_306_REVISION } from '@/lib/cv-spanish-summary-grounding';
import { localizeWarehouseEmployee, localizeGraphicDesigner } from '@/lib/cv-role-title';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import {
  SummaryAiDiagnosticSession,
  clearSummaryAiDiagnosticsForTests,
  formatSummaryAiDiagnosticForCopy,
  getLatestSummaryAiDiagnostic,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  checkSummaryDiagnosticCompleteness,
  checkSummaryDiagnosticInvariants,
  clearCvAiDiagnosticHistory,
  SUMMARY_AI_DIAG_MARKER,
} from '@/lib/cv-ai-diagnostics-contract';
import { clearExperienceAiDiagnosticsForTests } from '@/lib/cv-experience-ai-diagnostics';
import { evaluateSummaryV2NativeSurface } from '@/lib/cv-summary-v2/native-surface';

const REF = '2026-07-19';

const BAD_AAB305_ES = [
  'Profesional, actualmente desempeñándose como operaria de almacén en Atlas,',
  'donde realiza la recepción de mercancías, verifica la integridad y completitud',
  'de los envíos entrantes, y prepara pedidos para su expedición, con alrededor',
  'de seis años y medio de experiencia. Con experiencia previa en diseño gráfico',
  'para materiales impresos y digitales. Habilidades clave: liderazgo,',
  'organización, pensamiento crítico, adaptabilidad, resolución de problemas,',
  'gestión del tiempo, inteligencia emocional, atención al detalle, comunicación',
  'y Agile/Scrum.',
].join(' ').replace(/\s+/g, ' ').trim();

const WH_ES = [
  'Revisa la mercancía entrante',
  'Comprueba la documentación relacionada',
  'Coordina con sus compañeros la preparación y el movimiento de la mercancía',
].join('\n');

const GD_ES = [
  'Creó materiales visuales y elementos gráficos',
  'Revisó y adaptó materiales de diseño',
  'Preparó archivos finales de diseño para distintos formatos y pantallas',
].join('\n');

function spanishFixture(summary = ''): CVData {
  const gender = 'female';
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: localizeWarehouseEmployee('es', gender),
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_ES,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: localizeGraphicDesigner('es', gender),
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: GD_ES,
  };
  return {
    personal: {
      fullName: 'Ana',
      email: 'a@b.c',
      phone: '',
      location: '',
      jobTitle: localizeWarehouseEmployee('es', gender),
      gender,
      photo: '',
    },
    summary,
    experience: [current, prior],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    contentLocale: 'es',
  } as CVData;
}

function runSpanishSummary(candidate: string, usageBefore = 13) {
  const cv = spanishFixture();
  const requestedLocale = 'es' as const;
  const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
  const jobContext = buildExperienceJobContext({
    position: localizeWarehouseEmployee('es', 'female'),
    locale: requestedLocale,
  });
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'es',
    requestedLocale,
    contentLocale: 'es',
    templateId: 'modern-minimal',
    gender: 'female',
    requestId: 'req-aab306-es-sum',
    usageCountBefore: usageBefore,
    operationMode: 'generate_from_context',
    jobContextHash: jobContext.key,
  });
  session.recordCvSnapshot(cv, (cv.summary || '').trim());
  const pipe = runCvAiApplyPipeline({
    cv,
    locale: requestedLocale,
    action: 'summary_generate',
    candidate,
    durationSnapshot,
    referenceDateIso: REF,
    jobContext,
  });
  session.recordFinalizeResult(pipe.finalized);
  const applied = !pipe.blocked && Boolean(pipe.finalized.countedAsSuccess);
  const usageAfter = applied ? usageBefore + 1 : usageBefore;
  session.recordVisibleApply(applied, usageAfter, applied ? pipe.finalized.text : undefined);
  const trace = session.commit();
  return { pipe, trace, applied, usageAfter, usageBefore };
}

describe('Summary final-candidate diagnostics (AAB-306 Phase 2)', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('exposes summary-final-candidate-diagnostics-306-v1 marker', () => {
    expect(SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION)
      .toBe('summary-final-candidate-diagnostics-306-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_SUMMARY_GROUNDING_306_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      SUMMARY_V2_SPANISH_PERSPECTIVE_NATIVE_SURFACE_391_REVISION,
    );
  });

  it('54. duration-only path is not labeled ai_repaired without content repair', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB305_ES,
      referenceDateIso: REF,
      originHint: 'ai_generated',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).not.toBe('ai_repaired');
    expect(fin.diagnostics?.summaryRepairAttempted).toBe(false);
    expect(fin.diagnostics?.summaryRepairApplied).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).not.toBe('ai_repaired');
  });

  it('55–56. rejected Spanish provider has stage/reasons; providerOutcome never unknown', () => {
    const { pipe, trace, applied } = runSpanishSummary(BAD_AAB305_ES);
    expect(applied).toBe(true);
    expect(pipe.finalized.origin).toBe('deterministic_fallback');
    expect(trace.providerOutcome).toBeTruthy();
    expect(trace.providerOutcome).not.toBe('unknown');
    expect(String(trace.providerOutcome)).toMatch(/rejected/i);
    expect(
      trace.providerRejectionReason
      || trace.providerTypedRejectionReason
      || pipe.finalized.diagnostics?.providerRejectionReason,
    ).toBeTruthy();
    const provider = (trace.candidateLineage || []).find((c) => c.candidateKind === 'provider');
    expect(provider?.present).toBe(true);
    expect(provider?.accepted).toBe(false);
    expect(provider?.rejectionStage).toBeTruthy();
    expect((provider?.rejectionReasons || []).length).toBeGreaterThan(0);
  });

  it('57–62. final_selected hashes/slots populated; source matches; invariants pass', () => {
    const { pipe, trace, applied, usageAfter, usageBefore } = runSpanishSummary(BAD_AAB305_ES);
    expect(applied).toBe(true);
    expect(usageAfter).toBe(usageBefore + 1);
    expect(trace.finalCandidateSource).toMatch(/deterministic|fallback/i);
    expect(trace.finalCandidateSource).not.toBe('ai_repaired');
    expect(trace.marker).toBe(SUMMARY_AI_DIAG_MARKER);
    expect(trace.summaryFinalCandidateDiagnosticsRevision)
      .toBe(SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION);

    const final = (trace.candidateLineage || []).find((c) => c.candidateKind === 'final_selected');
    expect(final?.present).toBe(true);
    expect(final?.accepted).toBe(true);
    expect(final?.unitCount).toBeGreaterThan(0);
    expect(final?.unitHashes?.length).toBe(final?.unitCount);
    expect(final?.sentenceHashes?.length).toBe(final?.sentenceCount);
    expect(final?.sentenceRoleSlots?.length).toBe(final?.sentenceCount);
    expect((trace.finalSentenceHashes || []).length).toBeGreaterThan(0);
    expect((trace.finalSentenceRoleSlots || []).length)
      .toBe((trace.finalSentenceHashes || []).length);

    expect(trace.unsupportedClaimCount).toBe(0);
    expect(trace.groundingValidationPassed).toBe(true);
    expect(trace.grammarValidationPassed).toBe(true);
    expect(trace.slotValidationPassed).toBe(true);
    expect(trace.priorRoleGroundingPassed).toBe(true);
    expect(trace.visibleCandidateHashAfterApply).toBe(trace.finalNormalizedHash);
    expect(trace.finalPerspectiveMode).toBe('neutral_cv');
    expect(evaluateSummaryV2NativeSurface({
      text: pipe.finalized.text,
      locale: 'es',
      hasCurrent: true,
      hasPrior: true,
      perspectiveMode: 'cv_third_person',
    }).nativeSurfaceRejectionReasons).toEqual([]);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(pipe.finalized.text).toMatch(/Atlas/i);
    expect(pipe.finalized.text).toMatch(/Rewitu/i);

    const inv = checkSummaryDiagnosticInvariants(trace);
    const comp = checkSummaryDiagnosticCompleteness(trace);
    expect(inv.passed).toBe(true);
    expect(comp.passed).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
  });

  it('63–64. unsupported kinds and missing-fact evidence exposed on provider reject', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'es',
      gender: 'female',
      cv: spanishFixture(),
      candidate: BAD_AAB305_ES,
      referenceDateIso: REF,
    });
    expect(fin.diagnostics?.providerRejectionReason || fin.diagnostics?.providerTypedRejectionReason)
      .toBeTruthy();
    expect(
      (fin.diagnostics?.providerUnsupportedClaimCount ?? 0) > 0
      || Boolean(fin.diagnostics?.providerRejectionReason),
    ).toBe(true);
  });

  it('68–70. copy/restart preserve lineage; SUMMARY_AI_DIAG_V1 marker', () => {
    const { trace } = runSpanishSummary(BAD_AAB305_ES);
    const copy = formatSummaryAiDiagnosticForCopy(trace);
    expect(copy).toContain(SUMMARY_AI_DIAG_MARKER);
    expect(copy).toMatch(/final_selected|candidateLineage|unitHashes/i);
    expect(getLatestSummaryAiDiagnostic()?.marker).toBe(SUMMARY_AI_DIAG_MARKER);
    expect(getLatestSummaryAiDiagnostic()?.candidateLineage?.length).toBeGreaterThanOrEqual(2);
  });

  it('empty generate also yields complete final lineage', () => {
    const { trace, applied, pipe } = runSpanishSummary('');
    expect(applied).toBe(true);
    expect(pipe.finalized.origin).toBe('deterministic_fallback');
    const final = (trace.candidateLineage || []).find((c) => c.candidateKind === 'final_selected');
    expect(final?.unitHashes?.length).toBe(final?.unitCount);
    expect(trace.providerOutcome).not.toBe('unknown');
    expect(trace.finalCandidateSource).toMatch(/deterministic|fallback/i);
    expect(checkSummaryDiagnosticInvariants(trace).passed).toBe(true);
  });
});
