/**
 * @vitest-environment jsdom
 *
 * AAB-302: Experience diagnostic marker must be EXPERIENCE_AI_DIAG_V1 and
 * completeness must reject empty / wrong-kind markers.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
  EXPERIENCE_AI_DIAG_STORAGE_KEY,
  getLatestExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  clearSummaryAiDiagnosticsForTests,
  getLatestSummaryAiDiagnostic,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  checkExperienceDiagnosticCompleteness,
  checkSummaryDiagnosticCompleteness,
  EXPERIENCE_AI_DIAG_MARKER,
  EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION,
  SUMMARY_AI_DIAG_MARKER,
} from '@/lib/cv-ai-diagnostics-contract';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';
import {
  CV_AI_DIAGNOSTICS_CHANGED_EVENT,
  type CvAiDiagnosticsChangedDetail,
} from '@/lib/cv-ai-diagnostics-lifecycle';

function commitExperience(opts?: {
  success?: boolean;
  reason?: string;
  mode?: 'generate_from_empty' | 'enhance_existing_content';
  requestId?: string;
}) {
  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'en',
    requestedLocale: 'en',
    templateId: 'modern',
    jobContextHash: 'ctx-marker',
    requestId: opts?.requestId || `exp-marker-${Math.random().toString(36).slice(2, 8)}`,
    usageCountBefore: 3,
  });
  session.stage('button_pressed', 'ok');
  session.patch({
    operationMode: opts?.mode || 'enhance_existing_content',
    selectedSourceKind: 'live_textarea',
    clickedExperienceEntryIdHash: 'fnv1a_entry',
  });
  if (opts?.success) {
    const appliedText = 'Duty one.\nDuty two.\nDuty three.';
    session.recordApiResponse({ httpStatus: 200, resultText: appliedText });
    session.patch({
      finalCandidateSource: 'provider',
      finalNormalizedHash: 'fnv1a_final_ok',
      providerAccepted: true,
      requiredFactCount: 0,
      coveredFactCount: 0,
      uncoveredFactIdentityHashes: [],
    });
    session.recordVisibleApply(true, 4, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
  } else {
    session.recordApiResponse({ httpStatus: 500, errorCode: 'network_error' });
    session.patch({
      finalTypedFailureReason: opts?.reason || 'provider_network_error',
      noOpDetected: opts?.reason === 'all_candidates_noop',
      clientDeterministicFallbackApplied: opts?.reason === 'deterministic_fallback_used',
      finalCandidateSource: opts?.reason === 'deterministic_fallback_used'
        ? 'deterministic_fallback'
        : opts?.reason === 'noop_repaired'
          ? 'provider_repaired'
          : 'none',
    });
    session.recordVisibleApply(false, 3);
  }
  return session.commit();
}

function commitSummary() {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'en',
    requestedLocale: 'en',
    contentLocale: 'en',
    templateId: 'modern',
    requestId: `sum-marker-${Math.random().toString(36).slice(2, 8)}`,
    usageCountBefore: 1,
    gender: 'female',
    operationMode: 'enhance_existing_content',
  });
  session.stage('button_pressed', 'ok');
  session.patch({
    finalCandidateSource: 'provider',
    providerCandidatePresent: true,
    deterministicCandidatePresent: false,
    grammarValidationPassed: true,
    groundingValidationPassed: true,
    durationValidationPassed: true,
    meaningfulChangeDetected: true,
    noOpDetected: false,
    apiResponseKind: 'provider',
    serverFallbackUsed: false,
    clientFallbackUsed: false,
  });
  session.recordVisibleApply(true, 2, 'Improved summary text.');
  return session.commit();
}

describe('Experience diagnostic marker (AAB-302)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearSummaryAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes experience-diagnostic-marker-302-v1 for assets', () => {
    expect(EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION).toBe('experience-diagnostic-marker-302-v1');
    expect(EXPERIENCE_AI_DIAG_MARKER).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(SUMMARY_AI_DIAG_MARKER).toBe('SUMMARY_AI_DIAG_V1');
  });

  it('1. provider success commits EXPERIENCE_AI_DIAG_V1 with completeness true', () => {
    const trace = commitExperience({ success: true });
    expect(trace.marker).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(trace.operationKind).toBe('experience');
    expect(trace.diagnosticCompletenessPassed).toBe(true);
  });

  it('2–3. no-op repair / deterministic fallback paths keep Experience marker', () => {
    const repaired = commitExperience({ reason: 'noop_repaired' });
    expect(repaired.marker).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(repaired.diagnosticCompletenessPassed).toBe(true);

    const det = commitExperience({ reason: 'deterministic_fallback_used' });
    expect(det.marker).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(det.diagnosticCompletenessPassed).toBe(true);
  });

  it('4–5. terminal failure and exception/finally-style commit keep marker', () => {
    const fail = commitExperience({ reason: 'provider_network_error' });
    expect(fail.marker).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(fail.diagnosticCompletenessPassed).toBe(true);

    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'ctx',
      requestId: 'exp-finally',
      usageCountBefore: 0,
    });
    session.patch({
      selectedSourceKind: 'live_textarea',
      clickedExperienceEntryIdHash: 'fnv1a_finally',
    });
    try {
      throw new Error('simulated');
    } catch {
      session.recordVisibleApply(false, 0);
    } finally {
      const trace = session.commit();
      expect(trace.marker).toBe('EXPERIENCE_AI_DIAG_V1');
      expect(trace.diagnosticCompletenessPassed).toBe(true);
    }
  });

  it('6–7. Copy payload and restart rehydration preserve Experience marker', () => {
    const first = commitExperience({ success: true, requestId: 'exp-copy-1' });
    const raw = localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).marker).toBe('EXPERIENCE_AI_DIAG_V1');

    clearExperienceAiDiagnosticsForTests();
    // Simulate restart by restoring storage only.
    localStorage.setItem(EXPERIENCE_AI_DIAG_STORAGE_KEY, raw!);
    const rehydrated = getLatestExperienceAiDiagnostic();
    expect(rehydrated?.marker).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(rehydrated?.requestIdHash).toBe(first.requestIdHash);
  });

  it('8. Summary marker non-regression', () => {
    const sum = commitSummary();
    expect(sum.marker).toBe('SUMMARY_AI_DIAG_V1');
    expect(sum.diagnosticCompletenessPassed).toBe(true);
    expect(getLatestSummaryAiDiagnostic()?.marker).toBe('SUMMARY_AI_DIAG_V1');
  });

  it('9–13. empty / whitespace / null / missing / wrong-kind markers fail completeness', () => {
    const baseExp = {
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1,
      operationKind: 'experience',
      requestedLocale: 'en',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      selectedSourceKind: 'live_textarea',
      clickedExperienceEntryIdHash: 'fnv1a_x',
    };

    expect(checkExperienceDiagnosticCompleteness({ ...baseExp, marker: '' })
      .nullRequiredDiagnosticFields).toContain('marker_empty');
    expect(checkExperienceDiagnosticCompleteness({ ...baseExp, marker: '   ' })
      .nullRequiredDiagnosticFields).toContain('marker_empty');
    expect(checkExperienceDiagnosticCompleteness({ ...baseExp, marker: null })
      .nullRequiredDiagnosticFields).toContain('marker');
    expect(checkExperienceDiagnosticCompleteness({ ...baseExp })
      .missingRequiredDiagnosticFields).toContain('marker');
    expect(checkExperienceDiagnosticCompleteness({
      ...baseExp,
      marker: 'SUMMARY_AI_DIAG_V1',
    }).nullRequiredDiagnosticFields).toContain('marker_operation_kind_mismatch');

    expect(checkSummaryDiagnosticCompleteness({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1,
      operationKind: 'summary',
      marker: 'EXPERIENCE_AI_DIAG_V1',
      finalCandidateSource: 'provider',
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
      apiBaseUrlConfigured: false,
      capacitorServerUrlConfigured: false,
      sourceCommitStatus: 'unavailable_by_contract',
    }).nullRequiredDiagnosticFields).toContain('marker_operation_kind_mismatch');
  });

  it('14. response metadata cannot overwrite the local stable marker', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'ctx',
      requestId: 'exp-meta',
      usageCountBefore: 0,
    });
    session.patch({ marker: '' } as never);
    session.patch({ marker: '   ' } as never);
    session.patch({ marker: null } as never);
    session.patch({ marker: undefined } as never);
    session.patch({ marker: 'SUMMARY_AI_DIAG_V1' } as never);
    session.patch({ marker: 'UNKNOWN_MARKER' } as never);
    session.patch({
      selectedSourceKind: 'live_textarea',
      clickedExperienceEntryIdHash: 'fnv1a_meta',
    });
    session.recordVisibleApply(false, 0);
    const trace = session.commit();
    expect(trace.marker).toBe('EXPERIENCE_AI_DIAG_V1');
    expect(trace.diagnosticCompletenessPassed).toBe(true);
  });

  it('15. valid marker passes completeness', () => {
    const check = checkExperienceDiagnosticCompleteness({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1,
      operationKind: 'experience',
      marker: 'EXPERIENCE_AI_DIAG_V1',
      requestedLocale: 'en',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 0,
      usageCountAfter: 0,
      selectedSourceKind: 'live_textarea',
      clickedExperienceEntryIdHash: 'fnv1a_ok',
    });
    expect(check.passed).toBe(true);
  });

  it('16–18. marker fix does not duplicate history, alter usage, or change lifecycle actions', () => {
    const usageBefore = getProAiUsageCount();
    const events: string[] = [];
    const onEvent = (e: Event) => {
      const d = (e as CustomEvent<CvAiDiagnosticsChangedDetail>).detail;
      events.push(`${d.kind}:${d.action}`);
    };
    window.addEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onEvent);
    try {
      const session = new ExperienceAiDiagnosticSession({
        uiLocale: 'en',
        requestedLocale: 'en',
        templateId: 'modern',
        jobContextHash: 'ctx',
        requestId: 'exp-once',
        usageCountBefore: usageBefore,
      });
      session.patch({
        selectedSourceKind: 'live_textarea',
        clickedExperienceEntryIdHash: 'fnv1a_y',
      });
      session.recordVisibleApply(false, usageBefore);
      const first = session.commit();
      const second = session.commit();
      expect(second).toBe(first);
      expect(first.marker).toBe('EXPERIENCE_AI_DIAG_V1');
      expect(events.filter((e) => e === 'experience:commit')).toHaveLength(1);
      expect(getProAiUsageCount()).toBe(usageBefore);
    } finally {
      window.removeEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onEvent);
    }
  });
});
