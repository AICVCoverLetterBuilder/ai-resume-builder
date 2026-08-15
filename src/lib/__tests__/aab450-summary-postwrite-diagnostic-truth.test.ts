import { describe, expect, it } from 'vitest';
import { fingerprintText } from '../cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
} from '../cv-summary-ai-diagnostics';
import { normalizeSummaryCandidateText } from '../cv-ai-finalize-apply';

const japaneseSummary = '約6年の職務経験があります。グラフィック素材を制作し、デザインプロジェクトを確認しています。';

function sessionFor(text: string): SummaryAiDiagnosticSession {
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'ja',
    requestedLocale: 'ja',
    contentLocale: 'ja',
    templateId: 'modern-minimal',
    gender: 'female',
    requestId: 'aab450-summary-postwrite',
    usageCountBefore: 37,
  });
  const hash = fingerprintText(normalizeSummaryCandidateText(text) || 'empty');
  session.patch({
    finalCandidateSource: 'deterministic_fallback',
    deterministicCandidatePresent: true,
    deterministicCandidateHash: hash,
    fallbackCandidatePresent: true,
    providerCandidatePresent: false,
    finalNormalizedHash: hash,
    finalValidatedCandidateHash: hash,
    requiredCurrentDutyFactCount: 3,
    coveredCurrentDutyFactCount: 3,
    requiredPriorDutyFactCount: 6,
    coveredPriorDutyFactCount: 6,
    finalCurrentDutyCoveragePassed: true,
    finalPriorDutyCoveragePassed: true,
    finalDurationRepresentationKind: 'approximate_total_career',
    independentFinalDurationClaimCount: 1,
    finalDurationScopeValidationPassed: true,
    finalPerspectiveMode: 'neutral_cv',
    finalPostconditionsPassed: true,
    countedAsSuccess: true,
    meaningfulChangeDetected: true,
    noOpDetected: false,
    apiResponseKind: 'not_attempted',
    serverFallbackUsed: true,
    clientFallbackUsed: false,
  });
  return session;
}

describe('AAB450 Summary post-write diagnostic truth', () => {
  it('validates the actual Japanese written text and populates visible fields', () => {
    const session = sessionFor(japaneseSummary);
    session.recordVisibleApply(true, 38, japaneseSummary);
    const trace = session.commit();

    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(37);
    expect(trace.usageCountAfter).toBe(38);
    expect(trace.visibleCandidateHashAfterApply).toBe(trace.finalNormalizedHash);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(trace.visibleTargetLocalePurityPassed).toBe(true);
    expect(trace.visibleSourceLanguageLeakageDetected).toBe(false);
    expect(trace.visibleRequiredCurrentDutyFactCount).toBe(3);
    expect(trace.visibleCoveredCurrentDutyFactCount).toBe(3);
    expect(trace.visibleRequiredPriorDutyFactCount).toBe(6);
    expect(trace.visibleCoveredPriorDutyFactCount).toBe(6);
    expect(trace.visibleStructuredRoleLocaleValidationPassed).toBe(true);
    expect(trace.visibleDurationClaimCountAfterApply).toBe(1);
    expect(trace.visibleDurationRepresentationKind).toBe('approximate_total_career');
    expect(trace.visibleDurationScopeValidationPassed).toBe(true);
    expect(trace.visibleGrammarValidationPassed).toBe(true);
    expect(trace.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(trace.visibleFinalPostconditionsPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
  });

  it('fails closed when the post-write text is corrupted', () => {
    const session = sessionFor(japaneseSummary);
    session.recordVisibleApply(true, 38, `${japaneseSummary} 不正な追加情報。`);
    const trace = session.commit();

    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountAfter).toBe(37);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(false);
    expect(trace.visibleFinalPostconditionsPassed).toBe(false);
  });
});
