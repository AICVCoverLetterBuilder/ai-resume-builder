/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SummaryV3GenerateTerminalEvent } from '@/lib/ai-core-v3/summary-generate';
import {
  clearSummaryAiDiagnosticsForTests,
  getLatestSummaryAiDiagnostic,
  SUMMARY_AI_DIAG_STORAGE_KEY,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  getCvAiDiagnosticHistory,
} from '@/lib/cv-ai-diagnostics-contract';
import { CV_AI_DIAGNOSTICS_CHANGED_EVENT } from '@/lib/cv-ai-diagnostics-lifecycle';

function committedM4Terminal(): SummaryV3GenerateTerminalEvent {
  return {
    input: { exactVisibleSummary: '', usageCountBefore: 4 },
    snapshot: {
      rawSummarySourceHash: 'source-hash',
      structuredTotalDurationMonths: 18,
      manifest: { selectedEntries: [{ facts: [{ id: 'fact-1' }] }] },
    },
    kind: 'handled_success',
    typedReason: null,
    routeHttpStatus: 200,
    evidence: {
      candidateAccepted: true,
      candidatePresent: true,
      candidateHash: 'candidate-hash',
      candidateLength: 17,
      candidateUnitCount: 1,
      candidateUnitHashes: ['unit-hash'],
      candidateUnitLengths: [17],
      writer: { attempted: true, result: 'succeeded' },
      evaluator: { attempted: true, result: 'succeeded' },
      phases: { structural: 'passed', semantic: 'passed', language_quality: 'passed' },
      semanticViolationCount: 0,
      semanticViolationCodes: [],
      languageQualityViolationCount: 0,
      languageQualityViolationCodes: [],
      violationFactIdHashesByCode: {},
      violationEntryIdHashesByCode: {},
      primaryValidationRejectionCode: null,
      repairAttempted: false,
      providerResponseKind: 'provider',
    },
    commitReceipt: {
      kind: 'committed',
      operationId: 'operation-1',
      requestId: 'request-1',
      intendedCandidateHash: 'candidate-hash',
      committedSummaryHash: 'candidate-hash',
      committedContentLocale: 'de',
      canonicalAccepted: true,
      candidateMatched: true,
      persistenceAttempted: true,
      persistenceResult: 'passed',
      canonicalApplyAttempted: true,
      canonicalApplyResult: 'passed',
      usageAttempted: true,
      usageResult: 'passed',
      usageForwardWriteResult: 'succeeded',
      usageVerificationResult: 'passed',
      usageRollbackAttempted: false,
      usageRollbackResult: 'not_required',
      actualUsageBefore: 4,
      actualUsageAfter: 5,
      actualUsageDelta: 1,
      rollbackAttempted: false,
      rollbackResult: 'not_required',
    },
    applyCommitted: true,
    usageAfter: 5,
  } as unknown as SummaryV3GenerateTerminalEvent;
}

function createCommittedSession(): SummaryAiDiagnosticSession {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'de', requestedLocale: 'de', contentLocale: 'de', templateId: 'noninterference',
    requestId: 'request-1', usageCountBefore: 4, operationMode: 'summary_generate',
  });
  session.recordCvSnapshot({
    id: 'cv-1', name: '', personal: {}, summary: '', contentLocale: 'de',
    experience: [], education: [], skills: [], certifications: [], languages: [],
  } as never, '');
  session.recordM4Terminal(committedM4Terminal());
  return session;
}

describe('M4 Summary diagnostic terminal noninterference', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  it('preserves the committed business result when a runtime diagnostic field is unclassified', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const session = createCommittedSession();
    const injectRuntimeField = session.patch.bind(session) as (value: Record<string, unknown>) => void;
    injectRuntimeField({ unclassifiedRuntimeDiagnosticField: 'bounded-code' });

    let committed: ReturnType<SummaryAiDiagnosticSession['commit']> | undefined;
    expect(() => {
      committed = session.commit();
    }).not.toThrow();
    if (!committed) throw new Error('terminal trace was not returned');

    expect(committed).toBe(getLatestSummaryAiDiagnostic());
    expect(committed).toMatchObject({
      m4Operation: 'summary_v3_generate',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 4,
      usageCountAfter: 5,
      m4ActualUsageDelta: 1,
      m4RollbackAttempted: false,
      m4UsageRollbackAttempted: false,
      m4V2FallthroughCount: 0,
      diagnosticInvariantCheckPassed: false,
      diagnosticCompletenessPassed: false,
      notApplicableDiagnosticFieldViolations: ['unclassifiedRuntimeDiagnosticField'],
    });
    expect(committed).not.toHaveProperty('unclassifiedRuntimeDiagnosticField');
    expect(committed.stages.filter((stage) => stage.name === 'm4_terminal')).toHaveLength(1);
    expect(setItem.mock.calls.filter(([key]) => key === SUMMARY_AI_DIAG_STORAGE_KEY)).toHaveLength(1);
    expect(getCvAiDiagnosticHistory('summary')).toHaveLength(1);
    expect(dispatchEvent.mock.calls.filter(([event]) => {
      const detail = (event as CustomEvent<{ kind?: string; action?: string }>).detail;
      return event.type === CV_AI_DIAGNOSTICS_CHANGED_EVENT
        && detail?.kind === 'summary'
        && detail.action === 'commit';
    })).toHaveLength(1);
  });

  it('returns one deeply immutable terminal and writes storage, history, and commit event once', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const commitEvents: Event[] = [];
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; action?: string }>).detail;
      if (detail?.kind === 'summary' && detail.action === 'commit') commitEvents.push(event);
    };
    window.addEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onEvent);
    try {
      const session = createCommittedSession();
      const first = session.commit();
      const second = session.commit();

      expect(second).toBe(first);
      expect(Object.isFrozen(first)).toBe(true);
      expect(Object.isFrozen(first.stages)).toBe(true);
      expect(first.stages.every(Object.isFrozen)).toBe(true);
      expect(setItem.mock.calls.filter(([key]) => key === SUMMARY_AI_DIAG_STORAGE_KEY)).toHaveLength(1);
      expect(JSON.parse(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY) || 'null')).toEqual(first);
      expect(getCvAiDiagnosticHistory('summary')).toHaveLength(1);
      expect(commitEvents).toHaveLength(1);
    } finally {
      window.removeEventListener(CV_AI_DIAGNOSTICS_CHANGED_EVENT, onEvent);
    }
  });
});
