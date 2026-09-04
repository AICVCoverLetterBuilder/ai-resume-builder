/**
 * @vitest-environment jsdom
 *
 * M4 usage receipt truth must remain identical in the canonical trace, copy,
 * persisted history, and the internal Summary diagnostics panel.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { InternalSummaryAiDiagnosticsPanel } from '@/components/InternalSummaryAiDiagnosticsPanel';
import type {
  SummaryV3CommitReceipt,
  SummaryV3GenerateTerminalEvent,
} from '@/lib/ai-core-v3/summary-generate';
import {
  checkM4SummaryDiagnosticApplicability,
  checkM4SummaryDiagnosticCompleteness,
  assertM4SummaryFieldAuthorityCoverage,
  clearSummaryAiDiagnosticsForTests,
  copySummaryAiDiagnosticsToClipboard,
  getM4SummaryFieldAuthority,
  getLatestSummaryAiDiagnostic,
  M4_SUMMARY_FIELD_AUTHORITY,
  M4_SUMMARY_EXTERNAL_REQUIRED_FIELDS,
  M4_SUMMARY_TERMINAL_RECEIPT_FIELDS,
  projectSummaryAiDiagnosticApplicability,
  SUMMARY_AI_DIAGNOSTIC_CONSTRUCTOR_FIELDS,
  SummaryAiDiagnosticSession,
  type SummaryM4ExternalDiagnostic,
  type SummaryV2ExternalDiagnostic,
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
  snapshotAvailable?: boolean;
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
    snapshot: scenario.snapshotAvailable === false
      ? undefined
      : {
          rawSummarySourceHash: 'm4-panel-source',
          structuredTotalDurationMonths: 24,
          manifest: { selectedEntries: [{ facts: [{ id: 'm4-panel-fact' }] }] },
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

function constructorFieldNames(): string[] {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'de',
    requestedLocale: 'de',
    contentLocale: 'de',
    templateId: 'm4-authority-inventory',
    requestId: 'm4-authority-inventory-request',
    usageCountBefore: 0,
    operationMode: 'summary_generate',
  });
  return Object.keys((session as unknown as { draft: Record<string, unknown> }).draft).sort();
}

const LEGACY_DURATION_AND_FINALIZER_FIELDS = [
  'structuredDurationMonths', 'localizedDurationPhraseHash', 'providerDurationClaimCount',
  'sourceDurationClaimCount', 'fallbackDurationClaimCount', 'durationClaimCountBeforeStrip',
  'numericDurationClaimCount', 'writtenDurationClaimCount', 'durationClaimsRemovedBeforeInsert',
  'durationClaimCountAfterInsert', 'durationClaimCountAfterFinalize',
  'independentFinalDurationClaimCount', 'visibleDurationClaimCountAfterApply',
  'visibleDurationMatchesFinalizedCount', 'durationDetectorAgreement',
  'durationInsertedExactlyOnce', 'durationFinalizerIdempotent',
  'finalDurationRepresentationKind', 'finalDurationRepresentationCount', 'finalDurationHybridDetected',
  'visibleDurationRepresentationKind', 'visibleDurationRepresentationCount',
  'visibleDurationHybridDetected', 'durationSemanticValueMonths', 'durationRepresentationAgreement',
  'finalRenderedDurationSemanticMonths', 'visibleRenderedDurationSemanticMonths',
  'finalDurationSemanticDeltaMonths', 'visibleDurationSemanticDeltaMonths',
  'finalDurationSemanticAgreementPassed', 'visibleDurationSemanticAgreementPassed',
  'summaryDurationFinalizerRevision', 'durationPass1CandidateHash', 'durationPass2CandidateHash',
  'durationPass1Hash', 'durationPass2Hash', 'durationSecondPassChanged',
  'durationSecondPassChangeReason', 'durationValidationPassed',
] as const;

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
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.notApplicableDiagnosticFieldViolations).toEqual([]);
    expect(trace.m4UsageCountAtRequest).toBe(5);
    expect(trace.m4ActualUsageBefore).toBe(6);
    expect(trace.m4ActualUsageAfter).toBe(7);
    expect(trace.m4ActualUsageDelta).toBe(1);
    expect(trace.m4StructuredDurationMonths).toBe(24);
    expect(trace.m4LegacyV2DiagnosticFieldsApplicable).toBe(false);
    // The M4 external view omits V2-only fields; the panel renders their label as n/a.
    expect(trace).not.toHaveProperty('durationValidationPassed');
    expect(trace).not.toHaveProperty('grammarValidationPassed');
    expect(trace).not.toHaveProperty('groundingValidationPassed');
    expect(trace).not.toHaveProperty('unitCount');

    const panel = renderPanelText();
    expect(panel).toContain('M4 request usage: 5');
    expect(panel).toContain('M4 usage: 6 → 7 (Δ +1)');
    expect(panel).toContain('M4 structured duration months: 24');
    expect(panel).toContain('M4 phases: structural passed · semantic passed · language passed');
    expect(panel).not.toContain('5 → 7');
    expect(panel).not.toContain('usage mismatch');
    expect(panel).not.toContain('duration count: 0');
    expect(panel).not.toContain('independent final duration: 0');
    expect(panel).not.toContain('visible duration after apply: 0');
    expect(panel).toContain('duration validation: n/a');
    expect(panel).not.toContain('duration validation: fail');
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
      m4LegacyV2DiagnosticFieldsApplicable: false,
      apiHostClassificationContractRevision: 'android-production-api-host-contract-408-v3',
    });
    expect(JSON.parse(copied[0])).not.toHaveProperty('durationValidationPassed');
  });

  it('exhaustively projects a real M4 success without V2 default sentinels', () => {
    const constructorFields = constructorFieldNames();
    expect([...SUMMARY_AI_DIAGNOSTIC_CONSTRUCTOR_FIELDS].sort()).toEqual(constructorFields);

    const authorityFields = Object.values(M4_SUMMARY_FIELD_AUTHORITY).flat();
    expect(new Set(authorityFields).size).toBe(authorityFields.length);
    expect(authorityFields.filter((field) => constructorFields.includes(field)).sort())
      .toEqual(constructorFields);
    expect(M4_SUMMARY_TERMINAL_RECEIPT_FIELDS.every(
      (field) => M4_SUMMARY_FIELD_AUTHORITY.M4_AUTHORITATIVE.includes(field),
    )).toBe(true);
    for (const field of constructorFields) {
      expect(getM4SummaryFieldAuthority(field)).not.toBeNull();
    }

    const trace = commitM4({
      requestBefore: 2, actualBefore: 2, actualAfter: 3, actualDelta: 1,
      success: true, usageAttempted: true, reason: null,
    });
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
    expect(trace.m4CandidatePresent).toBe(true);
    expect(trace.m4CandidateUnitCount).toBe(1);
    expect(trace.m4CandidateLength).toBe(12);
    expect(trace.m4StructuredDurationMonths).toBe(24);
    expect(trace.apiHostClassificationContractRevision).toBe('android-production-api-host-contract-408-v3');
    expectTypeOf(trace.m4StructuredDurationMonths).toEqualTypeOf<number | null | undefined>();
    if (trace.m4Operation !== 'summary_v3_generate') throw new Error('expected M4 trace');
    const typedM4: SummaryM4ExternalDiagnostic = trace;
    expectTypeOf(typedM4.m4StructuredDurationMonths).toEqualTypeOf<number | null>();
    expectTypeOf(typedM4.apiHostClassificationContractRevision).toEqualTypeOf<string>();
    // @ts-expect-error V2 duration evidence is forbidden by the M4 external contract.
    const _forbiddenM4Duration: boolean = typedM4.durationValidationPassed;
    expect(M4_SUMMARY_EXTERNAL_REQUIRED_FIELDS.filter((field) => !(field in trace))).toEqual([]);

    for (const field of M4_SUMMARY_FIELD_AUTHORITY.M4_NOT_APPLICABLE) {
      expect(trace).not.toHaveProperty(field);
    }
    for (const field of M4_SUMMARY_FIELD_AUTHORITY.PRESENT_BUT_NOT_EVALUATED) {
      expect(trace).not.toHaveProperty(field);
    }
    for (const field of M4_SUMMARY_FIELD_AUTHORITY.V2_AUTHORITATIVE) {
      expect(trace).not.toHaveProperty(field);
    }
    for (const field of LEGACY_DURATION_AND_FINALIZER_FIELDS) {
      expect(getM4SummaryFieldAuthority(field)).toBe('M4_NOT_APPLICABLE');
      expect(trace).not.toHaveProperty(field);
    }

    const sentinelLeak = checkM4SummaryDiagnosticApplicability({
      m4Operation: 'summary_v3_generate',
      m4LegacyV2DiagnosticFieldsApplicable: false,
      providerDurationClaimCount: 0,
      durationDetectorAgreement: false,
      durationPass1Hash: '',
      finalDurationRepresentationKind: [],
    });
    expect(sentinelLeak.notApplicableDiagnosticFieldViolations).toEqual([
      'providerDurationClaimCount',
      'durationDetectorAgreement',
      'durationPass1Hash',
      'finalDurationRepresentationKind',
    ]);
    const projection = projectSummaryAiDiagnosticApplicability({
      m4Operation: 'summary_v3_generate',
      m4LegacyV2DiagnosticFieldsApplicable: false,
      unclassifiedFutureConstructorField: 0,
    });
    expect(projection).toMatchObject({
      ok: false,
      variant: 'm4',
      unclassifiedFields: ['unclassifiedFutureConstructorField'],
      projectionFailureReason: 'unclassified_field',
    });
    expect(projection.trace).not.toHaveProperty('unclassifiedFutureConstructorField');
    expect(() => assertM4SummaryFieldAuthorityCoverage([
      ...SUMMARY_AI_DIAGNOSTIC_CONSTRUCTOR_FIELDS,
      'unclassifiedFutureConstructorField',
    ])).toThrow('unclassified M4 diagnostic fields: unclassifiedFutureConstructorField');

    const missingDuration = { ...trace } as Record<string, unknown>;
    delete missingDuration.m4StructuredDurationMonths;
    expect(checkM4SummaryDiagnosticCompleteness(missingDuration)).toMatchObject({
      passed: false,
      missingRequiredDiagnosticFields: ['m4StructuredDurationMonths'],
    });
    const missingHostRevision = { ...trace } as Record<string, unknown>;
    delete missingHostRevision.apiHostClassificationContractRevision;
    expect(checkM4SummaryDiagnosticCompleteness(missingHostRevision)).toMatchObject({
      passed: false,
      missingRequiredDiagnosticFields: ['apiHostClassificationContractRevision'],
    });
  });

  it('keeps the V2 type evaluated and permits null M4 duration only without a failure snapshot', () => {
    const v2Session = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'en', contentLocale: 'en', templateId: 'v2-type',
      requestId: 'v2-type-request', usageCountBefore: 0, operationMode: 'summary_generate',
    });
    const v2 = v2Session.commit();
    if (v2.m4Operation === 'summary_v3_generate') throw new Error('expected V2 trace');
    const typedV2: SummaryV2ExternalDiagnostic = v2;
    expectTypeOf(typedV2.durationValidationPassed).toEqualTypeOf<boolean | null>();
    // @ts-expect-error M4 terminal identity is forbidden by the V2 external contract.
    const _forbiddenV2Operation: 'summary_v3_generate' = typedV2.m4Operation;

    const failure = commitM4({
      requestBefore: 2, actualBefore: 2, actualAfter: 2, actualDelta: 0,
      success: false, usageAttempted: false, reason: 'm4_validation_failed',
      snapshotAvailable: false,
    });
    expect(failure).toMatchObject({
      m4Operation: 'summary_v3_generate',
      m4StructuredDurationMonths: null,
      countedAsSuccess: false,
      diagnosticCompletenessPassed: true,
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
