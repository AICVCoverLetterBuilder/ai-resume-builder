/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import type { SummaryV3GenerateTerminalEvent } from '@/lib/ai-core-v3/summary-generate';
import { createEmptyCv } from '@/lib/cv-defaults';
import {
  assertM5SummaryFieldAuthorityCoverage,
  checkM5SummaryDiagnosticApplicability,
  checkM5SummaryDiagnosticCompleteness,
  checkM5SummaryDiagnosticInvariants,
  clearSummaryAiDiagnosticsForTests,
  getLatestSummaryAiDiagnostic,
  getM5SummaryFieldAuthority,
  isPersistedSummaryM5Diagnostic,
  M5_FIELD_AUTHORITY_DUPLICATE_COUNT,
  M5_FIELD_AUTHORITY_UNCLASSIFIED_COUNT,
  M5_SUMMARY_FIELD_INVENTORY,
  M5_SUMMARY_FIELD_AUTHORITY,
  projectSummaryAiDiagnosticApplicability,
  SUMMARY_AI_DIAG_STORAGE_KEY,
  summarizeSummaryAiDiagnostic,
  SummaryAiDiagnosticSession,
  type SummaryAiDiagnosticTrace,
  type SummaryM4ExternalDiagnostic,
  type SummaryM5ExternalDiagnostic,
  type SummaryV2ExternalDiagnostic,
} from '@/lib/cv-summary-ai-diagnostics';

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

async function buildSuccessfulM5Trace(): Promise<SummaryAiDiagnosticTrace> {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'en',
    requestedLocale: 'en',
    contentLocale: 'en',
    templateId: 'm5-contract-test',
    requestId: 'm5-contract-success',
    usageCountBefore: 0,
    operationMode: 'enhance_existing_content',
    rewriteStyle: 'shorter',
    m5Operation: 'summary_style',
  });
  const cv = createEmptyCv('en');
  cv.summary = 'Engineer builds APIs.';
  session.recordCvSnapshot(cv, cv.summary);
  session.stage('api_response', 'ok');
  session.stage('visible_apply', 'ok');
  session.stage('post_write_validation', 'ok');
  session.stage('usage_accounting', 'ok');
  session.patch({
    finalCandidateSource: 'v3_style',
    providerCandidatePresent: true,
    deterministicCandidatePresent: false,
    providerResponseKind: 'provider',
    providerHttpStatus: null,
    apiResponseKind: 'provider',
    serverFallbackUsed: false,
    clientFallbackUsed: false,
    meaningfulChangeDetected: true,
    noOpDetected: false,
    raceGuardResult: 'ok',
    finalPostconditionsPassed: true,
    visibleApplySucceeded: true,
    countedAsSuccess: true,
    usageCountAfter: 1,
    finalTypedFailureReason: null,
    rejectionStage: null,
    unsupportedClaimCategory: null,
    writerCandidateReachedValidation: true,
    evaluatorReached: true,
    safeNoOpConsidered: false,
    safeNoOpSelected: false,
    roleIdentityResolution: 'equivalent',
  });
  await session.resolveVersions();
  return session.commit();
}

function buildSuccessfulM4Trace(): SummaryAiDiagnosticTrace {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'de',
    requestedLocale: 'de',
    contentLocale: 'de',
    templateId: 'm4-readback-test',
    requestId: 'm4-readback-test',
    usageCountBefore: 4,
    operationMode: 'summary_generate',
  });
  session.recordCvSnapshot({
    id: 'cv-1', name: '', personal: {}, summary: '', contentLocale: 'de',
    experience: [], education: [], skills: [], certifications: [], languages: [],
  } as never, '');
  session.recordM4Terminal(committedM4Terminal());
  return session.commit();
}

function readOnlyFromPersistedStorage(value: unknown): SummaryAiDiagnosticTrace | null {
  clearSummaryAiDiagnosticsForTests();
  localStorage.setItem(SUMMARY_AI_DIAG_STORAGE_KEY, JSON.stringify(value));
  return getLatestSummaryAiDiagnostic();
}

describe('M5 Summary typed diagnostic applicability', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
  });

  afterEach(() => {
    localStorage.clear();
    clearSummaryAiDiagnosticsForTests();
  });

  it('has exhaustive, non-overlapping field authority', () => {
    expect(M5_FIELD_AUTHORITY_UNCLASSIFIED_COUNT).toBe(0);
    expect(M5_FIELD_AUTHORITY_DUPLICATE_COUNT).toBe(0);
    expect(() => assertM5SummaryFieldAuthorityCoverage(M5_SUMMARY_FIELD_INVENTORY)).not.toThrow();
    for (const field of M5_SUMMARY_FIELD_INVENTORY) {
      expect(getM5SummaryFieldAuthority(field)).not.toBeNull();
    }

    const syntheticFutureCanonicalField = 'future_unclassified_field';
    const syntheticFutureLedger = [
      ...M5_SUMMARY_FIELD_INVENTORY,
      syntheticFutureCanonicalField,
    ];
    expect(getM5SummaryFieldAuthority(syntheticFutureCanonicalField)).toBeNull();
    expect(() => assertM5SummaryFieldAuthorityCoverage(syntheticFutureLedger))
      .toThrow('unclassified M5 diagnostic fields: future_unclassified_field');
  });

  it('projects and reads back a successful M5 trace without V2-only fields', async () => {
    clearSummaryAiDiagnosticsForTests();
    const trace = await buildSuccessfulM5Trace();
    expect(trace.m5Operation).toBe('summary_style');
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.missingRequiredDiagnosticFields).toEqual([]);
    expect(trace.nullRequiredDiagnosticFields).toEqual([]);
    expect(trace.notApplicableDiagnosticFieldViolations).toEqual([]);
    expect(isPersistedSummaryM5Diagnostic(trace)).toBe(true);
    expect(Object.isFrozen(trace)).toBe(true);
    const readback = readOnlyFromPersistedStorage(trace);
    expect(readback).toEqual(trace);
    expect(readback).toMatchObject({
      m5Operation: 'summary_style',
      roleIdentityResolution: 'equivalent',
      providerHttpStatus: null,
      m5FailureStage: null,
      m5CanonicalFailureCause: null,
    });
    expect(Object.isFrozen(readback)).toBe(true);
    for (const field of [
      ...M5_SUMMARY_FIELD_AUTHORITY.V2_NOT_APPLICABLE_TO_M5,
      ...M5_SUMMARY_FIELD_AUTHORITY.M4_NOT_APPLICABLE_TO_M5,
      ...M5_SUMMARY_FIELD_AUTHORITY.PRESENT_BUT_NOT_EVALUATED,
      ...M5_SUMMARY_FIELD_AUTHORITY.DEPRECATED,
    ]) {
      expect(trace).not.toHaveProperty(field);
    }
    const summary = summarizeSummaryAiDiagnostic(trace);
    expect(summary?.durationCount).toBeNull();
    expect(summary?.durationValidationPassed).toBeNull();
  });

  it('keeps the M5 invariant scope universal and ignores V2 semantic checks', async () => {
    const trace = await buildSuccessfulM5Trace();
    const invariant = checkM5SummaryDiagnosticInvariants(trace);
    const completeness = checkM5SummaryDiagnosticCompleteness(trace);
    expect(invariant.passed).toBe(true);
    expect(completeness.passed).toBe(true);
    expect(checkM5SummaryDiagnosticApplicability(trace)).toEqual({
      unclassifiedFields: [],
      notApplicableDiagnosticFieldViolations: [],
      unexpectedDiagnosticFieldTypes: [],
    });
  });

  it('persists only finite M5 provider cause fields and rejects app-status masquerading as upstream status', async () => {
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'en', contentLocale: 'en',
      templateId: 'm5-provider-failure', requestId: 'm5-provider-failure', usageCountBefore: 3,
      operationMode: 'enhance_existing_content', rewriteStyle: 'stronger', m5Operation: 'summary_style',
    });
    const cv = createEmptyCv('en');
    cv.summary = 'Engineer maintains systems.';
    session.recordCvSnapshot(cv, cv.summary);
    session.recordPreCandidateTerminalFailure({
      stage: 'api_response', reason: 'writer_request_failed', usageAfter: 3,
      httpStatus: 429, apiResponseKind: 'error',
    });
    session.patch({
      m5FailureStage: 'sdk_request',
      m5CanonicalFailureCause: 'rate_limit',
      safeNoOpEligibilityReason: 'source_inconsistency',
      roleIdentityResolution: 'unresolved',
    });
    await session.resolveVersions();
    const trace = session.commit();
    expect(trace).toMatchObject({
      m5Operation: 'summary_style',
      finalTypedFailureReason: 'writer_request_failed',
      providerHttpStatus: 429,
      m5FailureStage: 'sdk_request',
      m5CanonicalFailureCause: 'rate_limit',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 3,
      usageCountAfter: 3,
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    expect(isPersistedSummaryM5Diagnostic(trace)).toBe(true);
    expect(readOnlyFromPersistedStorage(trace)).toEqual(trace);

    const appStatusWithoutFailureStage = checkM5SummaryDiagnosticInvariants({
      ...trace,
      m5FailureStage: null,
      m5CanonicalFailureCause: null,
      providerHttpStatus: 502,
    });
    expect(appStatusWithoutFailureStage.passed).toBe(false);
    expect(appStatusWithoutFailureStage.failures.map((failure) => failure.invariantCode))
      .toContain('m5_provider_failure_evidence_requires_stage');
  });

  it('persists the typed unsupported-claim source-retention no-op without apply or usage', async () => {
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'en', contentLocale: 'en',
      templateId: 'm5-safe-noop', requestId: 'm5-safe-noop', usageCountBefore: 3,
      operationMode: 'enhance_existing_content', rewriteStyle: 'stronger', m5Operation: 'summary_style',
    });
    const cv = createEmptyCv('en');
    cv.summary = 'Engineer maintains systems.';
    session.recordCvSnapshot(cv, cv.summary);
    session.stage('api_response', 'ok');
    session.patch({
      finalCandidateSource: 'none', providerCandidatePresent: true,
      providerResponseKind: 'provider', providerHttpStatus: null, apiResponseKind: 'provider',
      serverFallbackUsed: false, clientFallbackUsed: false,
      meaningfulChangeDetected: false, noOpDetected: true,
      raceGuardResult: 'skipped', finalPostconditionsPassed: true,
      visibleApplySucceeded: false, countedAsSuccess: false, usageCountAfter: 3,
      finalTypedFailureReason: null, rejectionStage: null,
      unsupportedClaimCategory: 'unsupported_result_relation',
      writerCandidateReachedValidation: true, evaluatorReached: false,
      safeNoOpConsidered: true, safeNoOpSelected: true,
      safeNoOpEligibilityReason: 'eligible',
      roleIdentityResolution: 'not_required',
    });
    await session.resolveVersions();
    const trace = session.commit();
    expect(trace).toMatchObject({
      unsupportedClaimCategory: 'unsupported_result_relation',
      writerCandidateReachedValidation: true,
      evaluatorReached: false,
      safeNoOpConsidered: true,
      safeNoOpSelected: true,
      roleIdentityResolution: 'not_required',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 3,
      usageCountAfter: 3,
    });
    expect(checkM5SummaryDiagnosticApplicability(trace)).toEqual({
      unclassifiedFields: [], notApplicableDiagnosticFieldViolations: [], unexpectedDiagnosticFieldTypes: [],
    });
    expect(checkM5SummaryDiagnosticCompleteness(trace).passed).toBe(true);
    expect(checkM5SummaryDiagnosticInvariants(trace).passed).toBe(true);
  });

  it('fails closed for an unclassified projected field', async () => {
    const trace = await buildSuccessfulM5Trace();
    const result = projectSummaryAiDiagnosticApplicability({
      ...trace,
      future_unclassified_field: true,
    });
    expect(result.ok).toBe(false);
    expect(result.variant).toBe('m5');
    expect(result.unclassifiedFields).toContain('future_unclassified_field');
  });

  it('rejects malformed and incomplete M5 persistence without V2 fallback', async () => {
    const validM5 = await buildSuccessfulM5Trace();
    const malformedM5 = {
      ...validM5,
      future_unclassified_field: true,
    };
    expect(isPersistedSummaryM5Diagnostic(malformedM5)).toBe(false);
    expect(readOnlyFromPersistedStorage(malformedM5)).toBeNull();
    expect(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY)).toBeNull();

    const missingRequiredM5 = { ...validM5 } as Record<string, unknown>;
    delete missingRequiredM5.operationKind;
    expect(isPersistedSummaryM5Diagnostic(missingRequiredM5)).toBe(false);
    expect(readOnlyFromPersistedStorage(missingRequiredM5)).toBeNull();
    expect(localStorage.getItem(SUMMARY_AI_DIAG_STORAGE_KEY)).toBeNull();

    const missingRoleResolution = { ...validM5 } as Record<string, unknown>;
    delete missingRoleResolution.roleIdentityResolution;
    expect(checkM5SummaryDiagnosticCompleteness(missingRoleResolution).passed).toBe(false);
    expect(isPersistedSummaryM5Diagnostic(missingRoleResolution)).toBe(false);

    const invalidRoleResolution = { ...validM5, roleIdentityResolution: 'plausible' };
    expect(checkM5SummaryDiagnosticApplicability(invalidRoleResolution).unexpectedDiagnosticFieldTypes)
      .toContain('roleIdentityResolution:invalid');
    expect(isPersistedSummaryM5Diagnostic(invalidRoleResolution)).toBe(false);
  });

  it('reads valid V2, M4, and M5 persisted variants through the public owner', async () => {
    const v2Session = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'en', contentLocale: 'en',
      templateId: 'v2-readback-test', requestId: 'v2-readback-test', usageCountBefore: 0,
    });
    await v2Session.resolveVersions();
    const validV2 = v2Session.commit();
    const v2Readback = readOnlyFromPersistedStorage(validV2);
    expect(v2Readback).toEqual(validV2);
    expect(v2Readback).not.toHaveProperty('m4Operation');
    expect(v2Readback).not.toHaveProperty('m5Operation');

    const validM4 = buildSuccessfulM4Trace();
    const m4Readback = readOnlyFromPersistedStorage(validM4);
    expect(m4Readback).toEqual(validM4);
    expect(m4Readback).toMatchObject({ m4Operation: 'summary_v3_generate' });
    expect(m4Readback).not.toHaveProperty('m5Operation');

    const validM5 = await buildSuccessfulM5Trace();
    const m5Readback = readOnlyFromPersistedStorage(validM5);
    expect(m5Readback).toEqual(validM5);
    expect(m5Readback).toMatchObject({ m5Operation: 'summary_style', roleIdentityResolution: 'equivalent' });
    expect(m5Readback).not.toHaveProperty('m4Operation');
  });

  it('keeps the external variant discriminator types disjoint', () => {
    expectTypeOf<SummaryV2ExternalDiagnostic['m5Operation']>().toEqualTypeOf<undefined>();
    expectTypeOf<SummaryM4ExternalDiagnostic['m5Operation']>().toEqualTypeOf<undefined>();
    expectTypeOf<SummaryM5ExternalDiagnostic['m5Operation']>()
      .toEqualTypeOf<'summary_style'>();
  });

  it('keeps ordinary V2 traces on the legacy external variant', async () => {
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en', requestedLocale: 'en', contentLocale: 'en',
      templateId: 'v2-contract-test', requestId: 'v2-contract-test', usageCountBefore: 0,
    });
    await session.resolveVersions();
    const trace = session.commit();
    expect(trace).not.toHaveProperty('m5Operation');
    expect(isPersistedSummaryM5Diagnostic(trace)).toBe(false);
  });
});
