/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SummaryGenerateTerminalDecisionControl } from '@/components/CvExportDiagnosticsControls';
import {
  clearSummaryAiDiagnosticsForTests,
  getM4SummaryFieldAuthority,
  getM5SummaryFieldAuthority,
  projectSummaryAiDiagnosticApplicability,
  SUMMARY_AI_DIAG_STORAGE_KEY,
  SummaryAiDiagnosticSession,
  type SummaryGenerateTerminalStage,
} from '../cv-summary-ai-diagnostics';

const contentSentinel = 'PRIVATE SUMMARY AND PROVIDER OUTPUT MUST NOT ENTER THE EVENT';

function createSession(input: {
  owner?: 'summary_v3' | 'summary_v2_legacy' | 'none';
  routingReason?: 'owned' | 'feature_disabled' | 'operation_mismatch' | 'source_not_empty'
    | 'locale_mismatch' | 'stored_locale_mismatch' | 'capture_incomplete';
} = {}) {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'sr', requestedLocale: 'sr', contentLocale: 'sr', templateId: 'terminal-decision',
    requestId: 'summary_req_607_1', usageCountBefore: 4, operationMode: 'summary_generate',
  });
  session.recordSummaryGenerateRoutingDecision({
    requestId: 'summary_req_607_1',
    owner: input.owner ?? 'summary_v2_legacy',
    routingReason: input.routingReason ?? 'capture_incomplete',
  });
  return session;
}

function record(session: SummaryAiDiagnosticSession, options: {
  stage: SummaryGenerateTerminalStage;
  applied?: boolean;
  delta?: number;
  reason?: string | null;
  httpStatus?: number | null;
}) {
  const applied = options.applied ?? false;
  const delta = options.delta ?? 0;
  session.patch({
    visibleApplySucceeded: applied,
    countedAsSuccess: applied,
    usageCountAfter: 4 + delta,
    finalTypedFailureReason: options.reason ?? (applied ? null : 'generation_validation_failed'),
  });
  return session.recordSummaryGenerateTerminalDecision({
    terminalStage: options.stage,
    httpStatus: options.httpStatus ?? (options.stage === 'route' ? null : 200),
  });
}

describe('Summary Generate terminal decision diagnostic', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
  });

  it('A. emits one correlated event for an owned V3 Generate operation', () => {
    const session = createSession({ owner: 'summary_v3', routingReason: 'owned' });
    const event = record(session, { stage: 'success', applied: true, delta: 1 });
    expect(event).toMatchObject({
      event: 'summary_generate_terminal_decision',
      requestId: 'summary_req_607_1',
      owner: 'summary_v3',
      routingReason: 'owned',
      terminalStage: 'success',
      reasonCode: 'success',
      httpStatus: 200,
      applied: true,
      usageDelta: 1,
    });
  });

  it('B-D. preserves stored-locale, UI-locale, and capture routing reasons distinctly', () => {
    const cases = [
      ['stored_locale_mismatch', 'stored_locale_mismatch'],
      ['locale_mismatch', 'locale_mismatch'],
      ['capture_incomplete', 'capture_incomplete'],
    ] as const;
    for (const [routingReason, expected] of cases) {
      const event = record(createSession({ routingReason }), { stage: 'route', reason: routingReason });
      expect(event?.routingReason).toBe(expected);
    }
  });

  it('E. identifies the legacy Summary owner after V3 not-applicability', () => {
    const event = record(createSession({ owner: 'summary_v2_legacy', routingReason: 'feature_disabled' }), {
      stage: 'server_response', reason: 'provider_temporarily_unavailable', httpStatus: 503,
    });
    expect(event).toMatchObject({ owner: 'summary_v2_legacy', routingReason: 'feature_disabled' });
  });

  it('F. labels a client finalizer rejection with a typed locale reason', () => {
    expect(record(createSession(), { stage: 'finalizer', reason: 'locale_impurity' })).toMatchObject({
      terminalStage: 'finalizer', reasonCode: 'locale_language_rejected', applied: false, usageDelta: 0,
    });
  });

  it('G. identifies preapply rejection', () => {
    expect(record(createSession(), { stage: 'preapply', reason: 'diagnostic_invariant_failed' })).toMatchObject({
      terminalStage: 'preapply', reasonCode: 'generation_validation_failed',
    });
  });

  it('H. identifies transactional failure', () => {
    expect(record(createSession(), { stage: 'transaction', reason: 'summary_state_write_failed' })).toMatchObject({
      terminalStage: 'transaction', reasonCode: 'transaction_persistence_failed',
    });
  });

  it('I. identifies visible-readback failure', () => {
    expect(record(createSession(), { stage: 'visible_readback', reason: 'summary_state_write_failed' })).toMatchObject({
      terminalStage: 'visible_readback', reasonCode: 'visible_readback_failed',
    });
  });

  it('J. records an accepted apply and exactly one usage increment', () => {
    expect(record(createSession({ owner: 'summary_v3', routingReason: 'owned' }), {
      stage: 'success', applied: true, delta: 1, reason: null,
    })).toMatchObject({ terminalStage: 'success', reasonCode: 'success', applied: true, usageDelta: 1 });
  });

  it('K. records rejected results without an increment', () => {
    expect(record(createSession(), { stage: 'finalizer', applied: false, delta: 0 })).toMatchObject({
      applied: false, usageDelta: 0,
    });
  });

  it('L. is idempotent and persists exactly one terminal decision per operation', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const session = createSession();
    record(session, { stage: 'finalizer', reason: 'grounding_failed' });
    expect(session.recordSummaryGenerateTerminalDecision({ terminalStage: 'success', httpStatus: 200 })).toBeNull();
    const first = session.commit();
    const second = session.commit();
    expect(second).toBe(first);
    expect(first.summaryGenerateTerminalDecision).toBeDefined();
    expect(setItem.mock.calls.filter(([key]) => key === SUMMARY_AI_DIAG_STORAGE_KEY)).toHaveLength(1);
    expect((JSON.parse(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY) || 'null') as Record<string, unknown>)
      .summaryGenerateTerminalDecision).toEqual(first.summaryGenerateTerminalDecision);
  });

  it('M. keeps the event payload finite, content-free, and separately authorized in M4/M5 projections', () => {
    const event = record(createSession(), { stage: 'finalizer', reason: contentSentinel });
    if (!event) throw new Error('expected terminal decision');
    expect(Object.keys(event).sort()).toEqual([
      'applied', 'event', 'httpStatus', 'owner', 'reasonCode', 'requestId', 'routingReason',
      'terminalStage', 'usageDelta',
    ].sort());
    expect(JSON.stringify(event)).not.toContain(contentSentinel);
    expect(JSON.stringify(event)).not.toMatch(/summaryText|candidate|prompt|stack|employer|email|phone|address/i);
    expect(getM4SummaryFieldAuthority('summaryGenerateTerminalDecision')).toBe('M4_AUTHORITATIVE');
    expect(getM5SummaryFieldAuthority('summaryGenerateTerminalDecision')).toBe('SHARED_AUTHORITATIVE');
    expect(projectSummaryAiDiagnosticApplicability({
      m4Operation: 'summary_v3_generate',
      m4LegacyV2DiagnosticFieldsApplicable: false,
      summaryGenerateTerminalDecision: event,
    })).toMatchObject({ ok: true, variant: 'm4' });
  });

  it('N. leaves the established legacy/V3 owner decision distinct from the terminal result', () => {
    const session = createSession({ owner: 'summary_v2_legacy', routingReason: 'source_not_empty' });
    const event = record(session, { stage: 'server_response', reason: 'validation_rejected', httpStatus: 422 });
    expect(event).toMatchObject({
      owner: 'summary_v2_legacy',
      routingReason: 'source_not_empty',
      terminalStage: 'server_response',
      reasonCode: 'generation_validation_failed',
    });
  });

  it('O. phone control shows and copies only the finite terminal record without app-state or request mutation', async () => {
    const privacySentinel = 'PRIVATE_SUMMARY_CV_CANDIDATE_PROVIDER_PROMPT_EMPLOYER_EMAIL_PHONE_ADDRESS_JOB_STACK_EXCEPTION';
    const session = createSession({ owner: 'summary_v3', routingReason: 'owned' });
    const expectedDecision = record(session, {
      stage: 'finalizer', reason: privacySentinel, applied: false, delta: 0,
    });
    session.commit();
    const persistedBefore = localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY);
    const writeText = vi.fn(async (_text: string) => {});
    const priorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      render(React.createElement(SummaryGenerateTerminalDecisionControl));
      const json = screen.getByTestId('summary-terminal-decision-json').textContent || '';
      const displayed = JSON.parse(json) as Record<string, unknown>;
      expect(displayed).toEqual(expectedDecision);
      expect(Object.keys(displayed).sort()).toEqual([
        'applied', 'event', 'httpStatus', 'owner', 'reasonCode', 'requestId',
        'routingReason', 'terminalStage', 'usageDelta',
      ].sort());
      expect(json).not.toContain(privacySentinel);
      expect(screen.queryByText(/reset|clear|history|bootstrap|entitlement|rejected.audit/i)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Copy Summary terminal diagnostic' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
      expect(writeText).toHaveBeenCalledWith(json);
      expect(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY)).toBe(persistedBefore);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      if (priorClipboard) Object.defineProperty(navigator, 'clipboard', priorClipboard);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('P. observing invalid stored diagnostics does not clear or rewrite application storage', () => {
    const malformedRecord = '{not-json';
    localStorage.setItem(SUMMARY_AI_DIAG_STORAGE_KEY, malformedRecord);
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    try {
      render(React.createElement(SummaryGenerateTerminalDecisionControl));
      expect(screen.queryByTestId('summary-terminal-decision-control')).toBeNull();
      expect(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY)).toBe(malformedRecord);
      expect(removeItem).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      removeItem.mockRestore();
      setItem.mockRestore();
    }
  });
});
