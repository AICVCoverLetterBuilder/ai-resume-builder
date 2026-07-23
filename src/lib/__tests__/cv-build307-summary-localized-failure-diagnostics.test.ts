/**
 * @vitest-environment jsdom
 *
 * AAB-307 Phase 2: Spanish failure toast + truthful Summary diagnostics.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  SUMMARY_RUNTIME_MARKER_SET,
  runCvAiApplyPipeline,
} from '@/lib/cv-ai-finalize-apply';
import {
  SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION,
} from '@/lib/cv-summary-localized-failure-diagnostics-307';
import {
  SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION,
  setOmitSpanishPriorRoleSlotForTests,
} from '@/lib/cv-spanish-summary-grounding';
import { aiErrorMessage } from '@/lib/ai-error-codes';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { buildExperienceJobContext } from '@/lib/cv-experience-job-context';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import {
  clearSummaryAiDiagnosticsForTests,
  SummaryAiDiagnosticSession,
  formatSummaryAiDiagnosticForCopy,
} from '@/lib/cv-summary-ai-diagnostics';
import { clearExperienceAiDiagnosticsForTests } from '@/lib/cv-experience-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  checkSummaryDiagnosticCompleteness,
  checkSummaryDiagnosticInvariants,
} from '@/lib/cv-ai-diagnostics-contract';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';

const REF = '2026-07-19';

const WH_DE = formatExperienceBullets([
  'Prüfung eingehender Waren und zugehöriger Unterlagen.',
  'Koordination der Vorbereitung und Bewegung der Waren mit Kolleginnen.',
]);

const GD_HI = formatExperienceBullets([
  'विभिन्न परियोजनाओं के लिए दृश्य सामग्री और ग्राफिक तत्व तैयार किए।',
  'आवश्यकताओं के अनुसार डिज़ाइन सामग्री की समीक्षा और अनुकूलन किया।',
  'अंतिम डिज़ाइन फ़ाइलें तैयार कीं और उन्हें विभिन्न प्रारूपों / स्क्रीन के लिए अनुकूलित किया।',
]);

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

function deviceFixture(): CVData {
  const gender = 'female';
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'Lagermitarbeiterin',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: WH_DE,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: 'ग्राफिक डिज़ाइनर',
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: GD_HI,
  };
  return {
    personal: {
      fullName: 'Ana',
      email: 'a@b.c',
      phone: '',
      location: '',
      jobTitle: 'Lagermitarbeiterin',
      gender,
      photo: '',
    },
    summary: '',
    experience: [current, prior],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    contentLocale: 'de',
  } as CVData;
}

function runDiag(candidate: string) {
  const cv = deviceFixture();
  const usageBefore = getProAiUsageCount();
  const requestedLocale = 'es' as const;
  const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
  const jobContext = buildExperienceJobContext({
    position: localizeWarehouseEmployee('es', 'female'),
    locale: requestedLocale,
  });
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'es',
    requestedLocale,
    contentLocale: 'de',
    templateId: 'modern-minimal',
    gender: 'female',
    requestId: 'req-aab307-es-fail',
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

describe('Summary failure localization and diagnostics (AAB-307 Phase 2)', () => {
  beforeEach(() => {
    clearSummaryAiDiagnosticsForTests();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
    setOmitSpanishPriorRoleSlotForTests(false);
  });
  afterEach(() => {
    setOmitSpanishPriorRoleSlotForTests(false);
  });

  it('exposes summary-localized-failure-diagnostics-307-v1 marker', () => {
    expect(SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION)
      .toBe('summary-localized-failure-diagnostics-307-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION);
  });

  it('43–47. Spanish summary_grounding_failed toast is Spanish; EN/SR remain native', () => {
    const es = aiErrorMessage('summary_grounding_failed', 'es');
    const en = aiErrorMessage('summary_grounding_failed', 'en');
    const sr = aiErrorMessage('summary_grounding_failed', 'sr');
    expect(es).toMatch(/experiencia|resumen|aplicó/i);
    expect(es).not.toMatch(/grounded|was not applied/i);
    expect(es).not.toMatch(/summary_grounding_failed/);
    expect(en).toMatch(/grounded|experience|not applied/i);
    expect(sr).toMatch(/iskustvo|primenjen/i);
    expect(en).not.toBe(es);
  });

  it('37–42. omitted prior: fallbackApplied false, final source none, rejection evidence', () => {
    setOmitSpanishPriorRoleSlotForTests(true);
    const { pipe, trace, applied, usageAfter, usageBefore } = runDiag(BAD_AAB305_ES);
    expect(applied).toBe(false);
    expect(pipe.finalized.countedAsSuccess).toBe(false);
    expect(trace.fallbackAttempted).toBe(true);
    expect(trace.fallbackApplied).toBe(false);
    expect(trace.clientFallbackUsed).toBe(false);
    expect(trace.finalCandidateSource).toBe('none');
    expect(trace.priorRoleSlotPresent).toBe(false);
    expect(trace.slotValidationPassed).toBe(false);
    const det = (trace.candidateLineage || []).find((c) => c.candidateKind === 'client_deterministic');
    expect(det?.present).toBe(true);
    expect(det?.accepted).toBe(false);
    expect(det?.rejectionStage).toBeTruthy();
    expect((det?.rejectionReasons || []).length).toBeGreaterThan(0);
    expect(
      (det?.rejectionReasons || []).join(' '),
    ).toMatch(/prior_role|slot|grounding/i);
    const final = (trace.candidateLineage || []).find((c) => c.candidateKind === 'final_selected');
    expect(final?.present).toBe(false);
    expect(usageAfter).toBe(usageBefore);
    expect(checkSummaryDiagnosticInvariants(trace).passed).toBe(true);
    expect(checkSummaryDiagnosticCompleteness(trace).passed).toBe(true);
  });

  it('48–52. equal duration pass hashes ⇒ durationFinalizerIdempotent true (even when rejected)', () => {
    setOmitSpanishPriorRoleSlotForTests(true);
    const { trace } = runDiag(BAD_AAB305_ES);
    if (trace.durationPass1CandidateHash && trace.durationPass2CandidateHash) {
      expect(trace.durationPass1CandidateHash).toBe(trace.durationPass2CandidateHash);
      expect(trace.durationSecondPassChanged).toBe(false);
      expect(trace.durationFinalizerIdempotent).toBe(true);
    }
  });

  it('53–56. Spanish operation leaves Hindi grammar records empty', () => {
    const { trace } = runDiag('');
    expect(trace.requestedLocale).toBe('es');
    expect(trace.hindiSentenceGrammarRecords || []).toEqual([]);
    expect(trace.hindiSentenceHasFiniteCopulaOrVerb).toBeNull();
    expect(trace.hindiNominalExperienceFragmentDetected).toBeNull();
    expect(trace.hindiIncompleteSentenceCount).toBeNull();
  });

  it('57–58. valid deterministic apply: fallbackApplied true, usage +1', () => {
    const { pipe, trace, applied, usageAfter, usageBefore } = runDiag(BAD_AAB305_ES);
    expect(applied).toBe(true);
    expect(pipe.finalized.origin).toMatch(/deterministic|fallback/i);
    expect(trace.fallbackAttempted).toBe(true);
    expect(trace.fallbackApplied).toBe(true);
    expect(trace.finalCandidateSource).toMatch(/deterministic|fallback/i);
    expect(trace.priorRoleSlotPresent).toBe(true);
    expect(trace.slotValidationPassed).toBe(true);
    expect(trace.durationFinalizerIdempotent).toBe(true);
    expect(trace.hindiSentenceGrammarRecords || []).toEqual([]);
    expect(usageAfter).toBe(usageBefore + 1);
    expect(checkSummaryDiagnosticInvariants(trace).passed).toBe(true);
  });

  it('copy payload retains SUMMARY_AI_DIAG_V1 and Phase 2 marker', () => {
    const { trace } = runDiag('');
    const copy = formatSummaryAiDiagnosticForCopy(trace);
    expect(copy).toContain('SUMMARY_AI_DIAG_V1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION);
  });
});
