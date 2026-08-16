/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import {
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';

function session(): ExperienceAiDiagnosticSession {
  return new ExperienceAiDiagnosticSession({
    uiLocale: 'it',
    requestedLocale: 'it',
    contentLocale: 'hi',
    templateId: 'modern',
    gender: 'female',
    requestId: 'aab460-terminal-truth',
    usageCountBefore: 10,
    jobContextHash: 'aab460-job',
  });
}

function authorize(s: ExperienceAiDiagnosticSession, source: string): void {
  s.patch({
    selectedSourceKind: 'originalUserDescription',
    clickedExperienceEntryIdHash: 'fnv1a_entry',
    applyAuthorized: true,
    applyWriteSucceeded: true,
    applyCommitted: true,
    finalCandidateSource: source,
    finalCandidatePresent: true,
    finalCandidateBulletCount: 3,
    finalCandidateBulletScripts: ['latin', 'latin', 'latin'],
    finalBulletCount: 3,
    finalBulletScripts: ['latin', 'latin', 'latin'],
    finalNormalizedHash: 'fnv1a_final',
    finalRequiredFactCount: 3,
    finalCoveredFactCount: 3,
    finalUncoveredFactIdentityHashes: [],
    requiredFactCount: 3,
    coveredFactCount: 3,
    canonicalExperienceDecisionAllowsApply: true,
    canonicalExperienceDecisionAllowsUsage: true,
    finalVisibleDecisionAcceptedForApply: true,
    finalCandidateValidationAccepted: true,
    finalDecisionKind: 'material_improvement',
    materialImprovementDetected: true,
    materialImprovementKinds: ['wrong_locale_fixed'],
    meaningfulChangeDetected: true,
    semanticNoOpDetected: false,
    visibleComparisonUsedForNoOp: true,
    visibleComparisonHash: 'fnv1a_visible',
    visibleComparisonNormalizedHash: 'fnv1a_visible',
    diagnosticContractRevision: 'cv-ai-diagnostics-v2',
    schemaVersion: 1,
  });
}

describe('AAB460 Experience fallback terminal diagnostic truth', () => {
  it('reconciles stale empty fallback fields to the selected deterministic final', () => {
    const s = session();
    authorize(s, 'deterministic_fallback');
    s.patch({
      finalTypedFailureReason: 'empty_fallback',
      rejectionStage: 'fallback_output_built',
      fallbackSelected: true,
      fallbackBulletCount: 0,
      fallbackRequiredFactCount: 3,
      fallbackCoveredFactCount: 0,
      clientDeterministicFallbackSelected: true,
      clientDeterministicFallbackUsedForFinalCandidate: true,
      clientDeterministicFallbackApplied: true,
      clientDeterministicFallbackBulletCount: 0,
      clientDeterministicFallbackRequiredFactCount: 3,
      clientDeterministicFallbackCoveredFactCount: 0,
      serverFallbackUsed: true,
    });
    s.stage('api_response_received', 'fail', 'generation_validation_failed');
    s.recordVisibleApply(true, 11, {
      visibleDescription: 'Ha creato materiali grafici.\n• Ha sviluppato concetti visivi.\n• Ha revisionato progetti.',
      finalNormalizedText: 'Ha creato materiali grafici.\n• Ha sviluppato concetti visivi.\n• Ha revisionato progetti.',
    });
    const trace = s.commit();
    expect(trace.finalCandidateSource).toBe('deterministic_fallback');
    expect(trace.finalTypedFailureReason).toBeNull();
    expect(trace.rejectionStage).toBeNull();
    expect(trace.fallbackSelected).toBe(true);
    expect(trace.fallbackBulletCount).toBe(3);
    expect(trace.fallbackCoveredFactCount).toBe(3);
    expect(trace.clientDeterministicFallbackBulletCount).toBe(3);
    expect(trace.clientDeterministicFallbackCoveredFactCount).toBe(3);
    expect(trace.serverFallbackUsed).toBe(true);
    expect(trace.stages.some((stage) => stage.result === 'fail')).toBe(false);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
  });

  it('keeps server fallback and client deterministic fallback mutually exclusive', () => {
    const s = session();
    authorize(s, 'server_fallback');
    s.patch({
      serverFallbackUsed: true,
      clientDeterministicFallbackSelected: true,
      clientDeterministicFallbackUsedForFinalCandidate: true,
      clientDeterministicFallbackApplied: true,
      fallbackSelected: true,
      fallbackBulletCount: 0,
      finalTypedFailureReason: 'empty_fallback',
      rejectionStage: 'fallback_output_built',
    });
    s.recordVisibleApply(true, 11, {
      visibleDescription: 'Ha creato materiali.\n• Ha sviluppato concetti.\n• Ha revisionato progetti.',
      finalNormalizedText: 'Ha creato materiali.\n• Ha sviluppato concetti.\n• Ha revisionato progetti.',
    });
    const trace = s.commit();
    expect(trace.finalCandidateSource).toBe('server_fallback');
    expect(trace.serverFallbackUsed).toBe(true);
    expect(trace.clientDeterministicFallbackSelected).toBe(false);
    expect(trace.clientDeterministicFallbackUsedForFinalCandidate).toBe(false);
    expect(trace.fallbackSelected).toBe(false);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
  });

  it('detects the pre-fix contradictory terminal record', () => {
    const result = checkExperienceDiagnosticInvariants({
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      applyCommitted: true,
      finalTypedFailureReason: 'empty_fallback',
      rejectionStage: 'fallback_output_built',
    });
    expect(result.passed).toBe(false);
    expect(result.failures.map((failure) => failure.invariantCode)).toEqual(
      expect.arrayContaining([
        'success_with_terminal_failure_reason',
        'committed_with_rejection_stage',
      ]),
    );
  });
});
