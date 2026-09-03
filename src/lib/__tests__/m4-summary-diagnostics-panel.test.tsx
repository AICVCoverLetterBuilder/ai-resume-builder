/**
 * @vitest-environment jsdom
 *
 * M4 usage receipt truth must remain identical in the canonical trace, copy,
 * persisted history, and the internal Summary diagnostics panel.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { InternalSummaryAiDiagnosticsPanel } from '@/components/InternalSummaryAiDiagnosticsPanel';
import type {
  SummaryV3CommitReceipt,
  SummaryV3GenerateTerminalEvent,
} from '@/lib/ai-core-v3/summary-generate';
import {
  clearSummaryAiDiagnosticsForTests,
  copySummaryAiDiagnosticsToClipboard,
  getLatestSummaryAiDiagnostic,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  clearCvAiDiagnosticHistory,
  getCvAiDiagnosticHistory,
} from '@/lib/cv-ai-diagnostics-contract';

type M4Scenario = Readonly<{
  requestBefore: number;
  actualBefore: number | null;
  actualAfter: number | null;
  actualDelta: number | null;
  success: boolean;
  usageAttempted: boolean;
  reason: string | null;
}>;

function baseCv() {
  return {
    id: 'm4-panel-cv',
    name: 'Internal test CV',
    personal: {
      fullName: '', email: '', phone: '', address: '', jobTitle: '', gender: '',
    },
    summary: '',
    contentLocale: 'en',
    experience: [],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

function terminalEvent(scenario: M4Scenario): SummaryV3GenerateTerminalEvent {
  const receipt = {
    kind: scenario.success ? 'committed' : 'failed',
    ...(scenario.success ? {} : { reason: scenario.reason || 'usage_accounting_failed' }),
    operationId: 'm4-panel-operation',
    requestId: 'm4-panel-request',
    intendedCandidateHash: 'm4-panel-candidate',
    committedSummaryHash: scenario.success ? 'm4-panel-candidate' : null,
    committedContentLocale: scenario.success ? 'en' : null,
    canonicalAccepted: scenario.success,
    candidateMatched: scenario.success,
    persistenceAttempted: scenario.success,
    persistenceResult: scenario.success ? 'passed' : 'skipped',
    canonicalApplyAttempted: scenario.success,
    canonicalApplyResult: scenario.success ? 'passed' : 'skipped',
    usageAttempted: scenario.usageAttempted,
    usageResult: scenario.success ? 'passed' : (scenario.usageAttempted ? 'failed' : 'skipped'),
    usageForwardWriteResult: scenario.success ? 'succeeded' : (scenario.usageAttempted ? 'succeeded' : 'not_attempted'),
    usageVerificationResult: scenario.success ? 'passed' : (scenario.actualAfter === null ? 'unknown' : 'failed'),
    usageRollbackAttempted: scenario.usageAttempted && !scenario.success,
    usageRollbackResult: scenario.actualAfter === null
      ? 'unknown'
      : scenario.actualDelta === 0
        ? 'succeeded'
        : 'failed',
    actualUsageBefore: scenario.actualBefore,
    actualUsageAfter: scenario.actualAfter,
    actualUsageDelta: scenario.actualDelta,
    rollbackAttempted: scenario.usageAttempted && !scenario.success,
    rollbackResult: scenario.success ? 'not_required' : 'succeeded',
  } as unknown as SummaryV3CommitReceipt;

  return {
    input: {
      exactVisibleSummary: '',
      usageCountBefore: scenario.requestBefore,
    },
    // Only the hash and selected-entry count are read by the diagnostic projection.
    snapshot: {
      rawSummarySourceHash: 'm4-panel-source',
      manifest: { selectedEntries: [] },
    },
    kind: scenario.success ? 'handled_success' : 'handled_failure',
    typedReason: scenario.reason,
    evidence: {
      candidateAccepted: scenario.success,
      candidatePresent: scenario.success,
      candidateHash: scenario.success ? 'm4-panel-candidate' : null,
      candidateLength: scenario.success ? 12 : null,
      candidateUnitCount: scenario.success ? 1 : null,
      candidateUnitHashes: scenario.success ? ['m4-panel-unit'] : [],
      candidateUnitLengths: scenario.success ? [12] : [],
      writer: {
        attempted: scenario.success, result: scenario.success ? 'succeeded' : 'not_attempted',
        stopReason: null, contentBlockCount: null, textBlockCount: null, toolBlockCount: null,
        expectedToolCount: null, toolNameMatched: null, toolInputObject: null,
        toolInputSchemaPassed: null, identityPassed: null,
      },
      evaluator: {
        attempted: scenario.success, result: scenario.success ? 'succeeded' : 'not_attempted',
        stopReason: null, contentBlockCount: null, textBlockCount: null, toolBlockCount: null,
        expectedToolCount: null, toolNameMatched: null, toolInputObject: null,
        toolInputSchemaPassed: null, identityPassed: null,
      },
      phases: {
        structural: scenario.success ? 'passed' : 'not_evaluated',
        semantic: scenario.success ? 'passed' : 'not_evaluated',
        language_quality: scenario.success ? 'passed' : 'not_evaluated',
      },
      semanticViolationCount: 0,
      semanticViolationCodes: [],
      languageQualityViolationCount: 0,
      languageQualityViolationCodes: [],
      violationFactIdHashesByCode: {},
      violationEntryIdHashesByCode: {},
      primaryValidationRejectionCode: null,
      repairAttempted: false,
      providerResponseKind: scenario.success ? 'provider' : 'none',
    },
    commitReceipt: receipt,
    applyCommitted: scenario.success,
    usageAfter: scenario.actualAfter,
    routeHttpStatus: scenario.success ? 200 : 422,
  } as unknown as SummaryV3GenerateTerminalEvent;
}

function createM4Session(scenario: M4Scenario) {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'ja',
    requestedLocale: 'ja',
    contentLocale: 'ja',
    templateId: 'panel-test',
    requestId: 'm4-panel-request',
    usageCountBefore: scenario.requestBefore,
    operationMode: 'summary_generate',
  });
  session.recordCvSnapshot({ ...baseCv(), contentLocale: 'ja' } as never, '');
  session.recordM4Terminal(terminalEvent(scenario));
  return session;
}

function commitM4(scenario: M4Scenario) {
  const session = createM4Session(scenario);
  return session.commit();
}

function commitLegacy(success: boolean) {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'en',
    requestedLocale: 'en',
    contentLocale: 'en',
    templateId: 'panel-test',
    requestId: success ? 'legacy-success' : 'legacy-failure',
    usageCountBefore: 2,
    operationMode: 'enhance_existing_content',
  });
  session.recordCvSnapshot(baseCv() as never, '');
  session.patch({
    countedAsSuccess: success,
    visibleApplySucceeded: success,
    usageCountBefore: 2,
    usageCountAfter: success ? 3 : 2,
    finalTypedFailureReason: success ? null : 'summary_noop_after_normalization',
    meaningfulChangeDetected: success,
    noOpDetected: !success,
  });
  return session.commit();
}

function renderPanelText(): string {
  render(<InternalSummaryAiDiagnosticsPanel refreshToken={1} />);
  return screen.getByTestId('summary-ai-diagnostics-section').textContent || '';
}

describe('M4 Summary diagnostics panel usage truth', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
    vi.restoreAllMocks();
  });

  it('renders the authoritative concurrent M4 transaction instead of request-start arithmetic', async () => {
    const trace = commitM4({
      requestBefore: 5, actualBefore: 6, actualAfter: 7, actualDelta: 1,
      success: true, usageAttempted: true, reason: null,
    });
    expect(trace.diagnosticInvariantFailures).toEqual([]);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.m4UsageCountAtRequest).toBe(5);
    expect(trace.m4ActualUsageBefore).toBe(6);
    expect(trace.m4ActualUsageAfter).toBe(7);
    expect(trace.m4ActualUsageDelta).toBe(1);

    const panel = renderPanelText();
    expect(panel).toContain('M4 request usage: 5');
    expect(panel).toContain('M4 usage: 6 → 7 (Δ +1)');
    expect(panel).not.toContain('5 → 7');
    expect(panel).not.toContain('usage mismatch');
    expect(getCvAiDiagnosticHistory('summary')[0]).toMatchObject({
      m4UsageCountAtRequest: 5,
      m4ActualUsageBefore: 6,
      m4ActualUsageAfter: 7,
      m4ActualUsageDelta: 1,
    });

    const copied: string[] = [];
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async (text: string) => copied.push(text)) } });
    expect(await copySummaryAiDiagnosticsToClipboard()).toBe(true);
    expect(JSON.parse(copied[0])).toMatchObject({
      m4UsageCountAtRequest: 5,
      m4ActualUsageBefore: 6,
      m4ActualUsageAfter: 7,
      m4ActualUsageDelta: 1,
    });
  });

  it('keeps an unknown M4 final state unknown in latest, copy, history, and the panel', async () => {
    const trace = commitM4({
      requestBefore: 5, actualBefore: 6, actualAfter: null, actualDelta: null,
      success: false, usageAttempted: true, reason: 'usage_final_state_unknown',
    });
    expect(trace).toMatchObject({
      m4ActualUsageBefore: 6,
      m4ActualUsageAfter: null,
      m4ActualUsageDelta: null,
      usageCountAfter: null,
    });
    expect(getLatestSummaryAiDiagnostic()).toMatchObject({ m4ActualUsageAfter: null, usageCountAfter: null });
    expect(getCvAiDiagnosticHistory('summary')[0]).toMatchObject({
      m4UsageFinalStateKnown: false,
      m4ActualUsageBefore: 6,
      m4ActualUsageAfter: null,
      m4ActualUsageDelta: null,
      usageCountAfter: null,
    });

    const panel = renderPanelText();
    expect(panel).toContain('unknown final state');
    expect(panel).toContain('usage final state unknown');
    expect(panel).not.toContain('NaN');
    expect(panel).not.toContain('6 → 6');
    expect(panel).not.toContain('0 → 0');

    const copied: string[] = [];
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async (text: string) => copied.push(text)) } });
    expect(await copySummaryAiDiagnosticsToClipboard()).toBe(true);
    expect(JSON.parse(copied[0])).toMatchObject({ usageCountAfter: null, m4ActualUsageAfter: null });
  });

  it('retains a known failed rollback charge and warns without relabeling the operation successful', () => {
    commitM4({
      requestBefore: 5, actualBefore: 6, actualAfter: 7, actualDelta: 1,
      success: false, usageAttempted: true, reason: 'usage_rollback_failed',
    });
    const panel = renderPanelText();
    expect(panel).toContain('success: no');
    expect(panel).toContain('usage_rollback_failed');
    expect(panel).toContain('6 → 7 (Δ +1)');
    expect(panel).toContain('usage changed after failed operation');
  });

  it('renders a verified clean rollback as numeric restoration rather than unknown', () => {
    commitM4({
      requestBefore: 5, actualBefore: 6, actualAfter: 6, actualDelta: 0,
      success: false, usageAttempted: true, reason: 'usage_accounting_failed',
    });
    const panel = renderPanelText();
    expect(panel).toContain('success: no');
    expect(panel).toContain('6 → 6 (Δ +0)');
    expect(panel).not.toContain('unknown final state');
  });

  it('distinguishes an M4 pre-commit failure from an attempted unknown usage transaction', () => {
    commitM4({
      requestBefore: 5, actualBefore: 5, actualAfter: 5, actualDelta: 0,
      success: false, usageAttempted: false, reason: 'persistence_failed',
    });
    const panel = renderPanelText();
    expect(panel).toContain('not attempted (request 5; persistence_failed)');
    expect(panel).not.toContain('unknown final state');
    expect(panel).not.toContain('5 → 5 (Δ +0)');
  });

  it('preserves V2 numeric success and failure/no-op panel behavior', () => {
    commitLegacy(true);
    expect(renderPanelText()).toContain('2 → 3 (Δ +1)');
    cleanup();
    clearSummaryAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();

    commitLegacy(false);
    const panel = renderPanelText();
    expect(panel).toContain('success: no');
    expect(panel).toContain('2 → 2 (Δ +0)');
    expect(panel).not.toContain('unknown final state');
  });

  it('fails M4 completeness when a required M4 diagnostic field is absent', () => {
    const session = createM4Session({
      requestBefore: 5, actualBefore: 6, actualAfter: 7, actualDelta: 1,
      success: true, usageAttempted: true, reason: null,
    });
    delete (session as unknown as { draft: Record<string, unknown> }).draft.m4Writer;

    const trace = session.commit();
    expect(trace.diagnosticCompletenessPassed).toBe(false);
    expect(trace.missingRequiredDiagnosticFields).toContain('m4Writer');
  });

  it('contains no M4 null-to-zero source coercion in the production panel', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/InternalSummaryAiDiagnosticsPanel.tsx'), 'utf8');
    expect(source).not.toMatch(/m4ActualUsageAfter\s*\?\?\s*0/u);
    expect(source).not.toMatch(/m4ActualUsageDelta\s*\?\?\s*0/u);
    expect(source).not.toMatch(/Number\(m4ActualUsage(?:After|Delta)\)/u);
    expect(source).not.toMatch(/m4ActualUsage(?:After|Delta)\s*\|\|\s*0/u);
  });
});
