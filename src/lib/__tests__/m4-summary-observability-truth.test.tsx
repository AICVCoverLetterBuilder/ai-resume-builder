/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { InternalSummaryAiDiagnosticsPanel } from '@/components/InternalSummaryAiDiagnosticsPanel';
import {
  buildCvAiDiagnosticBuildIdentity,
  classifyApiHostClass,
  clearCvAiDiagnosticHistory,
  getCvAiDiagnosticHistory,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  clearSummaryAiDiagnosticsForTests,
  formatSummaryAiDiagnosticForCopy,
  getLatestSummaryAiDiagnostic,
  M4_LEGACY_V2_DIAGNOSTIC_FIELDS,
  projectSummaryAiDiagnosticApplicability,
  SummaryAiDiagnosticSession,
} from '@/lib/cv-summary-ai-diagnostics';
import { M4_SUMMARY_GENERATE_AAB555_OBSERVABILITY_OBSERVATION } from '@/lib/ai-core-v3/fixtures/m4-summary-generate-aab555-observability-observation';

const CORRECTED_PREVIEW = 'https://ai-resume-builder-881wxzajh-aicvcoverletterbuilders-projects.vercel.app';
const REJECTED_PREVIEW = 'https://ai-resume-builder-jgw67jqu2-aicvcoverletterbuilders-projects.vercel.app';
const PRODUCTION = 'https://ai-resume-builder-six-gamma.vercel.app';
const PROTECTED_PRODUCTION = 'https://ai-resume-builder-aicvcoverletterbuilders-projects.vercel.app';

function commitM4PhaseFailure(failedPhase: 'structural' | 'semantic' | 'language_quality' = 'structural') {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'de', requestedLocale: 'de', contentLocale: 'de', templateId: 'm4-observability',
    requestId: 'm4-observability-request', usageCountBefore: 0, operationMode: 'summary_generate',
  });
  session.recordCvSnapshot({
    id: 'm4-observability-cv', name: '', personal: {}, summary: '', contentLocale: 'de',
    experience: [], education: [], skills: [], certifications: [], languages: [],
  } as never, '');
  session.recordM4Terminal({
    input: { exactVisibleSummary: '', usageCountBefore: 0 },
    snapshot: { rawSummarySourceHash: 'source', manifest: { selectedEntries: [] } },
    kind: 'handled_failure', typedReason: 'm4_validation_failed', routeHttpStatus: 422,
    evidence: {
      candidateAccepted: false, candidatePresent: true, candidateHash: 'candidate', candidateLength: 12,
      candidateUnitCount: 1, candidateUnitHashes: ['unit'], candidateUnitLengths: [12],
      writer: { attempted: true, result: 'succeeded' },
      evaluator: { attempted: true, result: 'succeeded' },
      phases: {
        structural: failedPhase === 'structural' ? 'failed' : 'passed',
        semantic: failedPhase === 'semantic' ? 'failed' : 'passed',
        language_quality: failedPhase === 'language_quality' ? 'failed' : 'passed',
      },
      semanticViolationCount: 0, semanticViolationCodes: [], languageQualityViolationCount: 0,
      languageQualityViolationCodes: [], violationFactIdHashesByCode: {}, violationEntryIdHashesByCode: {},
      primaryValidationRejectionCode: 'structural_rejected', repairAttempted: false, providerResponseKind: 'provider',
    },
    commitReceipt: {
      kind: 'failed', operationId: 'operation', requestId: 'request', intendedCandidateHash: 'candidate',
      committedSummaryHash: null, committedContentLocale: null, canonicalAccepted: false, candidateMatched: false,
      persistenceAttempted: false, persistenceResult: 'skipped', canonicalApplyAttempted: false,
      canonicalApplyResult: 'skipped', usageAttempted: false, usageResult: 'skipped',
      usageForwardWriteResult: 'not_attempted', usageVerificationResult: 'not_attempted',
      usageRollbackAttempted: false, usageRollbackResult: 'not_required', actualUsageBefore: 0,
      actualUsageAfter: 0, actualUsageDelta: 0, rollbackAttempted: false, rollbackResult: 'not_required',
    },
    applyCommitted: false, usageAfter: 0,
  } as never);
  return session.commit();
}

describe('M4 Summary observability truth', () => {
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
  });

  it('retains the single AAB 555 observation as a deeply immutable, non-PII record', () => {
    const observation = M4_SUMMARY_GENERATE_AAB555_OBSERVABILITY_OBSERVATION;
    expect(observation.physicalCoreResult).toBe('PASS');
    expect(observation.routing.packageResolverClassification).toBe('preview');
    expect(observation.routing.observedDiagnosticApiHostClass).toBe('production');
    expect(Object.isFrozen(observation)).toBe(true);
    expect(Object.isFrozen(observation.routing)).toBe(true);
    expect(Object.isFrozen(observation.candidate)).toBe(true);
    const serialized = JSON.stringify(observation);
    expect(serialized).not.toMatch(/(?:@|authorization|cookie|token|email|phone|address|provider[_ ]?payload)/iu);
  });

  it('omits legacy V2 fields from the M4 external view without mutating V2 input', () => {
    const source = {
      m4Operation: 'summary_v3_generate',
      m4LegacyV2DiagnosticFieldsApplicable: false,
      durationValidationPassed: false,
      unitCount: 0,
    };
    const projection = projectSummaryAiDiagnosticApplicability(source);
    const projected = projection.trace;
    expect(projection.ok).toBe(true);
    for (const key of M4_LEGACY_V2_DIAGNOSTIC_FIELDS) {
      expect(projected).not.toHaveProperty(key);
    }
    expect(source.durationValidationPassed).toBe(false);
    expect(source.unitCount).toBe(0);
    expect(projectSummaryAiDiagnosticApplicability({ durationValidationPassed: false })).toMatchObject({
      ok: true,
      variant: 'v2',
      trace: { durationValidationPassed: false },
    });
  });

  it.each(['structural', 'semantic', 'language_quality'] as const)(
    'renders a real M4 %s failure without manufacturing a legacy duration failure',
    (failedPhase) => {
      const trace = commitM4PhaseFailure(failedPhase);
      expect(trace.m4Phases?.[failedPhase]).toBe('failed');
      expect(trace).not.toHaveProperty('durationValidationPassed');
      expect(getLatestSummaryAiDiagnostic()).toEqual(trace);
      expect(JSON.parse(formatSummaryAiDiagnosticForCopy(trace))).toEqual(trace);
      expect(getCvAiDiagnosticHistory('summary')[0]).toMatchObject({
        m4Operation: 'summary_v3_generate',
        success: false,
        m4UsageFinalStateKnown: true,
        m4ActualUsageBefore: 0,
        m4ActualUsageAfter: 0,
      });
      render(<InternalSummaryAiDiagnosticsPanel refreshToken={1} />);
      const panel = screen.getByTestId('summary-ai-diagnostics-section').textContent || '';
      expect(panel).toContain(`M4 phases: structural ${failedPhase === 'structural' ? 'failed' : 'passed'}`);
      expect(panel).toContain('duration validation: n/a');
      expect(panel).not.toContain('duration validation: fail');
    },
  );

  it('classifies only declared production origins and recognized immutable Preview shapes', () => {
    expect(classifyApiHostClass(CORRECTED_PREVIEW)).toBe('preview');
    expect(classifyApiHostClass(REJECTED_PREVIEW)).toBe('preview');
    expect(classifyApiHostClass('https://ai-resume-builder-git-branch-aicvcoverletterbuilders-projects.vercel.app')).toBe('preview');
    expect(classifyApiHostClass(PRODUCTION)).toBe('production');
    expect(classifyApiHostClass(PROTECTED_PRODUCTION)).toBe('production');
    expect(classifyApiHostClass('')).toBe('relative');
    expect(classifyApiHostClass('not a URL')).toBe('unknown');
    expect(classifyApiHostClass('https://ai-resume.example.test')).toBe('unknown');
    expect(classifyApiHostClass('https://cv.example.test')).toBe('unknown');
    expect(classifyApiHostClass('https://unrelated.vercel.app')).toBe('unknown');
    expect(buildCvAiDiagnosticBuildIdentity({ apiBaseUrlConfigured: true }).apiHostClass).toBe('unknown');
  });
});
