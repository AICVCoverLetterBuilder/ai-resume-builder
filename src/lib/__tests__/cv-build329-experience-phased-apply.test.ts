/**
 * @vitest-environment jsdom
 *
 * AAB-329 — selected-final coverage, phased completeness, transactional apply truth.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION,
  EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION,
  EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION,
  EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION,
  buildExperienceSelectedFinalCandidateSnapshot,
  selectedFinalSnapshotToDiagnostics,
  checkExperiencePreapplyDiagnosticCompleteness,
  checkExperiencePreapplyDiagnosticInvariants,
  checkExperiencePostapplyDiagnosticCompleteness,
  combineExperienceDiagnosticCompleteness,
  validateVisibleExperienceCoverage,
  emptyTransactionalApplyState,
} from '@/lib/cv-experience-phased-apply-329';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  buildEnglishWarehouseExperienceFallback,
  validateEnglishWarehouseExperienceCoverage,
  scanEnglishWarehousePredicates,
} from '@/lib/cv-english-experience-warehouse-grounding';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

const WEAK_EN = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const STRONG_EN = buildEnglishWarehouseExperienceFallback({
  sourceDescription: WEAK_EN,
  isPresent: true,
});

function sessionInput(requestId: string, usageCountBefore = 0) {
  return {
    requestId,
    requestedLocale: 'en',
    uiLocale: 'en',
    templateId: 'modern',
    jobContextHash: 'job-ctx-329',
    usageCountBefore,
  };
}

describe('AAB-329 Experience phased apply / selected-final diagnostics', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes AAB-329 packaging markers', () => {
    expect(EXPERIENCE_SELECTED_FINAL_COVERAGE_329_REVISION)
      .toBe('experience-selected-final-coverage-329-v1');
    expect(EXPERIENCE_PHASED_DIAGNOSTIC_COMPLETENESS_329_REVISION)
      .toBe('experience-phased-diagnostic-completeness-329-v1');
    expect(EXPERIENCE_TRANSACTIONAL_APPLY_TRUTH_329_REVISION)
      .toBe('experience-transactional-apply-truth-329-v1');
    expect(EXPERIENCE_FINAL_VISIBLE_PREDICATE_TRUTH_329_REVISION)
      .toBe('experience-final-visible-predicate-truth-329-v1');
  });

  it('1–5. Accepted 3/3 provider populates independent final fact diagnostics', () => {
    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: STRONG_EN,
      sourceDescription: WEAK_EN,
      candidateKind: 'provider',
      source: 'provider',
      targetLocale: 'en',
      meaningfulChangeDetected: true,
      localeValidationPassed: true,
      tenseValidationPassed: true,
      perspectiveValidationPassed: true,
      unsupportedClaimCount: 0,
    });
    const cov = validateEnglishWarehouseExperienceCoverage(WEAK_EN, STRONG_EN);
    expect(snap.requiredFactCount).toBe(3);
    expect(snap.coveredFactCount).toBe(3);
    expect(snap.uncoveredFactIdentityHashes).toEqual([]);
    expect(snap.factCoveragePassed).toBe(true);
    expect(snap.requiredFactSetHash).toBe(
      fingerprintText(cov.required.map((id) => `en_wh_${id}`).sort().join('|')),
    );
    const diag = selectedFinalSnapshotToDiagnostics(snap);
    expect(diag.finalRequiredFactCount).toBe(3);
    expect(diag.finalCoveredFactCount).toBe(3);
    expect(diag.finalFactCoveragePassed).toBe(true);
  });

  it('6–11. Final predicate diagnostics are independent and reject pass-with-zero', () => {
    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: STRONG_EN,
      sourceDescription: WEAK_EN,
      targetLocale: 'en',
      meaningfulChangeDetected: true,
    });
    const pred = scanEnglishWarehousePredicates(WEAK_EN, STRONG_EN);
    expect(snap.sourcePredicateIdentityCount).toBe(3);
    expect(snap.candidatePredicateIdentityCount).toBe(3);
    expect(snap.addedPredicateCount).toBe(0);
    expect(snap.predicateCoveragePassed).toBe(true);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);

    const bad = checkExperiencePreapplyDiagnosticInvariants({
      finalCandidatePresent: true,
      finalNormalizedHash: 'abc',
      finalRequiredFactCount: 3,
      finalCoveredFactCount: 3,
      finalFactCoveragePassed: true,
      finalUncoveredFactIdentityHashes: [],
      sourcePredicateIdentityCount: 3,
      finalCandidatePredicateIdentityCount: 0,
      finalSourceUnitPredicateCoveragePassed: true,
      providerAccepted: true,
    });
    expect(bad.passed).toBe(false);
    expect(bad.failures.map((f) => f.invariantCode)).toEqual(
      expect.arrayContaining([
        'final_predicate_pass_with_insufficient_count',
        'final_predicate_count_zero_while_source_nonzero',
      ]),
    );
  });

  it('12–18. Pre-apply completeness ignores visible fields; missing final fails', () => {
    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: STRONG_EN,
      sourceDescription: WEAK_EN,
      targetLocale: 'en',
      meaningfulChangeDetected: true,
      unsupportedClaimCount: 0,
    });
    const base = {
      diagnosticContractRevision: 'v',
      schemaVersion: 1,
      requestedLocale: 'en',
      selectedSourceKind: 'currentTextarea',
      clickedExperienceEntryIdHash: 'atlas',
      factAuthorityKind: 'current_textarea',
      authoritativeFactSourceKind: 'current_textarea',
      visibleComparisonProvenance: 'ai_generated_user_edited',
      sourceFactCount: 3,
      requiredFactCount: 3,
      ...selectedFinalSnapshotToDiagnostics(snap),
      finalUnsupportedClaimCount: 0,
    };
    const ok = checkExperiencePreapplyDiagnosticCompleteness(base);
    expect(ok.passed).toBe(true);
    expect(ok.missingRequiredDiagnosticFields).not.toContain(
      'visibleDescriptionMatchesFinalHash',
    );

    const missingFact = checkExperiencePreapplyDiagnosticCompleteness({
      ...base,
      finalRequiredFactCount: undefined,
    });
    expect(missingFact.passed).toBe(false);
    expect(missingFact.nullRequiredDiagnosticFields.length
      + missingFact.missingRequiredDiagnosticFields.length).toBeGreaterThan(0);

    const missingPred = checkExperiencePreapplyDiagnosticCompleteness({
      ...base,
      finalCandidatePredicateIdentityCount: undefined,
    });
    expect(missingPred.passed).toBe(false);

    const missingHash = checkExperiencePreapplyDiagnosticCompleteness({
      ...base,
      finalNormalizedHash: '',
    });
    expect(missingHash.passed).toBe(false);
  });

  it('19–25 / 37–40. Pre-apply gate does not invent visible success; serializer keeps fail', () => {
    const session = new ExperienceAiDiagnosticSession(sessionInput('req-329'));
    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: STRONG_EN,
      sourceDescription: WEAK_EN,
      targetLocale: 'en',
      meaningfulChangeDetected: true,
      unsupportedClaimCount: 0,
    });
    session.patch({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      selectedSourceKind: 'currentTextarea',
      clickedExperienceEntryIdHash: 'atlas-hash',
      selectedExperienceEntryIdHash: 'atlas-hash',
      factAuthorityKind: 'current_textarea',
      authoritativeFactSourceKind: 'current_textarea',
      visibleComparisonProvenance: 'ai_generated_user_edited',
      sourceFactCount: 3,
      requiredFactCount: 3,
      coveredFactCount: 3,
      providerAccepted: true,
      finalCandidatePresent: true,
      ...selectedFinalSnapshotToDiagnostics(snap),
      finalUnsupportedClaimCount: 0,
      tenseValidationPassed: true,
      perspectiveValidationPassed: true,
      targetLocaleValidationPassed: true,
      meaningfulChangeDetected: true,
    });
    session.recordFinalizeResult({
      blocked: false,
      countedAsSuccess: true,
      text: STRONG_EN,
      origin: 'provider',
      diagnostics: {
        ...selectedFinalSnapshotToDiagnostics(snap),
        finalUnsupportedClaimCount: 0,
        requiredFactCount: 3,
        coveredFactCount: 3,
        sourceFactCount: 3,
        factAuthorityKind: 'current_textarea',
        authoritativeFactSourceKind: 'current_textarea',
        factAuthorityMatchesAuthoritativeSourceKind: true,
        selectedExperienceEntryIdHash: 'atlas-hash',
        tenseValidationPassed: true,
        perspectiveValidationPassed: true,
      },
    } as never);
    session.patch({
      factAuthorityKind: 'current_textarea',
      authoritativeFactSourceKind: 'current_textarea',
      sourceFactCount: 3,
      requiredFactCount: 3,
      visibleComparisonProvenance: 'ai_generated_user_edited',
      selectedSourceKind: 'currentTextarea',
      clickedExperienceEntryIdHash: 'atlas-hash',
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    expect(gate.diagnosticCompletenessPassed).toBe(true);
    session.patch({
      applyAuthorized: true,
      applyAttempted: false,
      applyCommitted: false,
      targetContentApplied: false,
      appliedExperienceEntryIdHash: null,
    });
    // Simulate pre-apply reject retention for completeness truth.
    const failSession = new ExperienceAiDiagnosticSession(sessionInput('req-329-fail'));
    failSession.recordFinalizeResult({
      blocked: false,
      countedAsSuccess: true,
      text: STRONG_EN,
      origin: 'provider',
      diagnostics: {
        requiredFactCount: 3,
        coveredFactCount: 3,
        // Intentionally omit selected-final fact fields.
        finalCandidatePresent: true,
        finalCandidateSource: 'provider',
        finalNormalizedHash: fingerprintText(STRONG_EN),
        finalCandidateBulletCount: 3,
        finalCandidateBulletScripts: ['latin', 'latin', 'latin'],
        sourcePredicateIdentityCount: 3,
        finalCandidatePredicateIdentityCount: 0,
        finalSourceUnitPredicateCoveragePassed: true,
        selectedExperienceEntryIdHash: 'atlas-hash',
      },
    } as never);
    failSession.patch({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      selectedSourceKind: 'currentTextarea',
      clickedExperienceEntryIdHash: 'atlas-hash',
      factAuthorityKind: 'current_textarea',
      authoritativeFactSourceKind: 'current_textarea',
      visibleComparisonProvenance: 'ai_generated_user_edited',
      sourceFactCount: 3,
      requiredFactCount: 3,
    });
    const failGate = failSession.evaluatePreApplyDecisionGates();
    expect(failGate.passed).toBe(false);
    failSession.recordVisibleApply(false, 0);
    const trace = failSession.commit();
    expect(trace.diagnosticCompletenessPassed).toBe(false);
    expect(trace.targetContentApplied).toBe(false);
    expect(trace.appliedExperienceEntryIdHash).toBeNull();
    expect(trace.preapplyDiagnosticCompletenessPassed).toBe(false);
  });

  it('26–36. Visible coverage independent; commit fields only after commit', () => {
    const visible = validateVisibleExperienceCoverage({
      sourceDescription: WEAK_EN,
      visibleText: STRONG_EN,
      targetLocale: 'en',
      finalNormalizedHash: fingerprintText(STRONG_EN.replace(/\s+/g, ' ').trim()),
    });
    expect(visible.visibleRequiredFactCount).toBe(3);
    expect(visible.visibleCoveredFactCount).toBe(3);
    expect(visible.visibleUncoveredFactIdentityHashes).toEqual([]);
    expect(visible.visibleFactCoveragePassed).toBe(true);
    expect(visible.visibleRequiredPredicateCount).toBe(3);
    expect(visible.visibleCoveredPredicateCount).toBe(3);
    expect(visible.visiblePredicateCoveragePassed).toBe(true);
    expect(visible.visibleDescriptionMatchesFinalHash).toBe(true);

    const lost = validateVisibleExperienceCoverage({
      sourceDescription: WEAK_EN,
      visibleText: [
        'Checks the related documents.',
        'Works with colleagues to prepare and move goods.',
      ].join('\n'),
      targetLocale: 'en',
      finalNormalizedHash: 'x',
    });
    expect(lost.visibleCoveredFactCount).toBeLessThan(3);
    expect(lost.visibleFactCoveragePassed).toBe(false);

    const empty = emptyTransactionalApplyState();
    expect(empty.targetContentApplied).toBe(false);
    expect(empty.appliedExperienceEntryIdHash).toBeNull();
    expect(empty.applyCommitted).toBe(false);
  });

  it('37–39. Completeness combine requires both phases for success', () => {
    expect(combineExperienceDiagnosticCompleteness({
      preapplyPassed: true,
      postapplyPassed: true,
      postapplyApplicable: true,
    })).toBe(true);
    expect(combineExperienceDiagnosticCompleteness({
      preapplyPassed: false,
      postapplyPassed: null,
      postapplyApplicable: false,
    })).toBe(false);
    expect(combineExperienceDiagnosticCompleteness({
      preapplyPassed: true,
      postapplyPassed: false,
      postapplyApplicable: true,
    })).toBe(false);
  });

  it('41–44. Stages: final_candidate_postconditions before preapply; no optimistic apply', () => {
    const session = new ExperienceAiDiagnosticSession(sessionInput('req-329-stages', 2));
    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: STRONG_EN,
      sourceDescription: WEAK_EN,
      targetLocale: 'en',
      meaningfulChangeDetected: true,
      unsupportedClaimCount: 0,
    });
    session.patch({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      selectedSourceKind: 'currentTextarea',
      clickedExperienceEntryIdHash: 'atlas-hash',
      selectedExperienceEntryIdHash: 'atlas-hash',
      factAuthorityKind: 'current_textarea',
      authoritativeFactSourceKind: 'current_textarea',
      visibleComparisonProvenance: 'ai_generated_user_edited',
      sourceFactCount: 3,
      requiredFactCount: 3,
    });
    session.recordFinalizeResult({
      blocked: false,
      countedAsSuccess: true,
      text: STRONG_EN,
      origin: 'provider',
      diagnostics: {
        ...selectedFinalSnapshotToDiagnostics(snap),
        finalUnsupportedClaimCount: 0,
        requiredFactCount: 3,
        coveredFactCount: 3,
        sourceFactCount: 3,
        factAuthorityKind: 'current_textarea',
        authoritativeFactSourceKind: 'current_textarea',
        factAuthorityMatchesAuthoritativeSourceKind: true,
        selectedExperienceEntryIdHash: 'atlas-hash',
      },
    } as never);
    session.patch({
      factAuthorityKind: 'current_textarea',
      authoritativeFactSourceKind: 'current_textarea',
      sourceFactCount: 3,
      requiredFactCount: 3,
      visibleComparisonProvenance: 'ai_generated_user_edited',
      selectedSourceKind: 'currentTextarea',
      clickedExperienceEntryIdHash: 'atlas-hash',
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    const stages = (session as unknown as { stages: Array<{ stage: string }> }).stages
      || [];
    // Access via commit of incomplete path
    session.patch({
      applyCommitted: true,
      applyAuthorized: true,
      applyAttempted: true,
      applyWriteSucceeded: true,
      visibleValidationAttempted: true,
      visibleValidationPassed: true,
      visibleDescriptionMatchesFinalHash: true,
      visibleRequiredFactCount: 3,
      visibleCoveredFactCount: 3,
      visibleUncoveredFactIdentityHashes: [],
      visibleFactCoveragePassed: true,
      visibleRequiredPredicateCount: 3,
      visibleCoveredPredicateCount: 3,
      visiblePredicateCoveragePassed: true,
      visibleNormalizedHash: snap.normalizedHash,
      visibleLocaleValidationPassed: true,
      visibleTenseValidationPassed: true,
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountAfter: 3,
      targetContentApplied: true,
      appliedExperienceEntryIdHash: 'atlas-hash',
      postapplyDiagnosticCompletenessPassed: true,
      preapplyDiagnosticCompletenessPassed: true,
    });
    session.recordVisibleApply(true, 3, {
      visibleDescription: STRONG_EN,
      finalNormalizedText: STRONG_EN,
    });
    const trace = session.commit();
    const names = (trace.stages || []).map((s) => s.stage);
    const candIdx = names.indexOf('final_candidate_postconditions');
    const preIdx = names.indexOf('diagnostic_preapply_gate');
    expect(candIdx).toBeGreaterThanOrEqual(0);
    expect(preIdx).toBeGreaterThan(candIdx);
    expect(names.indexOf('final_apply_postcondition')).toBe(-1);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(checkExperiencePostapplyDiagnosticCompleteness(trace as never).passed).toBe(true);
  });
});
