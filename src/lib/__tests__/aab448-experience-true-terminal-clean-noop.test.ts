import { describe, expect, it } from 'vitest';
import { ExperienceAiDiagnosticSession } from '@/lib/cv-experience-ai-diagnostics';
import type {
  ExperienceOperationSourceBundle,
  UneditedRerunEarlyNoOpPreflight,
} from '@/lib/cv-experience-operation-source-bundle';
import {
  buildExperienceRequestTimeCleanNoOpSnapshot,
  type ExperienceVisibleCoverageForCleanNoOp,
} from '@/lib/cv-experience-terminal-outcome';
import { analyzeExperienceVisibleSource } from '@/lib/cv-experience-visible-source-analysis';

const visibleText = 'Preparaba materiales y coordinaba proyectos para clientes.';

function buildTerminalSnapshot() {
  const visibleAuthority = analyzeExperienceVisibleSource({
    visibleText,
    targetLocale: 'fr',
    trustedLocale: 'fr',
    generatedLocale: 'fr',
    storedLocale: 'es',
    isPresent: false,
  });
  const sourceBundle = {
    factAuthorityKind: 'pre_ai_snapshot',
    factAuthorityHash: 'fnv1a_authority',
    factAuthorityNormalizedHash: 'fnv1a_authority_normalized',
    factAuthorityUnitCount: 3,
    authoritativeFactSourceKind: 'pre_ai_snapshot',
    factAuthorityMatchesAuthoritativeSourceKind: true,
    factAuthoritySeparatedFromVisibleSource: true,
    visibleOperationSourceKind: 'currentTextarea',
    providerRewriteBaseKind: 'currentTextarea',
    visibleComparisonSourceKind: 'currentTextarea',
    visibleSourceHash: 'fnv1a_visible',
    visibleSourceNormalizedHash: 'fnv1a_visible_normalized',
    visibleSourceUnitCount: 3,
    visibleSourceProvenance: 'ai_generated_unedited',
    visibleSourceMatchedLastAiOutput: true,
    visibleSourceMateriallyEdited: false,
  } as unknown as ExperienceOperationSourceBundle;
  const preflight = {
    uneditedRerunDetected: true,
    earlyNoOpPreflightEvaluated: true,
    earlyNoOpPreflightPassed: true,
    earlyNoOpPreflightFailureReasons: [],
    employmentStateMatchesLastAiOutput: true,
    localeMatchesLastAiOutput: true,
    entryIdentityMatchesLastAiOutput: true,
    jobContextMatchesLastAiOutput: true,
    visibleHashMatchesLastAiOutput: true,
    visibleSourceAlreadyValidForTarget: true,
    semanticNoOpReason: 'unedited_ai_output_already_valid',
  } as unknown as UneditedRerunEarlyNoOpPreflight;
  const visibleCoverage = {
    visibleRequiredFactCount: 3,
    visibleCoveredFactCount: 3,
    visibleUncoveredFactIdentityHashes: [],
    visibleFactCoveragePassed: true,
    visibleRequiredPredicateCount: 3,
    visibleCoveredPredicateCount: 3,
    visibleMissingPredicateIdentityHashes: [],
    visiblePredicateCoveragePassed: true,
    visiblePredicateValidationApplicable: true,
    visibleNormalizedHash: 'fnv1a_visible_normalized',
    visibleDescriptionMatchesFinalHash: true,
    visibleLocaleValidationPassed: true,
    visiblePerspectiveValidationPassed: true,
    visibleNativeMorphologyValidationPassed: true,
  } satisfies ExperienceVisibleCoverageForCleanNoOp;
  return buildExperienceRequestTimeCleanNoOpSnapshot({
    sourceBundle,
    preflight,
    visibleAuthority,
    visibleCoverage,
    requestedLocale: 'fr',
    entryGeneratedLocaleBeforeApply: 'fr',
    contentLocaleDocument: 'es',
  });
}

describe('AAB448 Experience true terminal clean-noop', () => {
  it('serializes the trusted visible locale and no non-applicable phase evidence', () => {
    const snapshot = buildTerminalSnapshot();
    expect(snapshot.visibleTextareaLocale).toBe('fr');
    expect(snapshot.detectedVisibleTextLocale).toBe('es');
    expect(snapshot.visibleLocaleAuthorityKind).toBe('ai_output_provenance');
    expect(snapshot.rawDetectorDisagreesWithTrustedLocale).toBe(true);
    expect(snapshot.providerAttempted).toBe(false);
    expect(snapshot.providerRequiredFactCount).toBeNull();
    expect(snapshot.providerUncoveredFactIdentityHashes).toEqual([]);
    expect(snapshot.recoveryAttempted).toBe(false);
    expect(snapshot.translationFallbackAttempted).toBe(false);
    expect(snapshot.clientDeterministicFallbackAttempted).toBe(false);
    expect(snapshot.finalCandidateSource).toBe('none');
    expect(snapshot.candidateLineage).toEqual([
      expect.objectContaining({ candidateKind: 'visible_current_text' }),
    ]);
  });

  it('rejects every phase write after the clean-noop terminal snapshot is locked', () => {
    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'fr',
      requestedLocale: 'fr',
      contentLocale: 'es',
      templateId: 'modern-minimal',
      gender: 'female',
      jobContextHash: 'fnv1a_context',
      requestId: 'aab448-terminal-guard',
      usageCountBefore: 35,
    });
    session.recordRequestTimeCleanNoOpTerminal(buildTerminalSnapshot());

    expect(() => session.patch({ providerAttempted: true })).toThrow(
      'experience_clean_noop_post_terminal_field_write:providerAttempted',
    );
    expect(() => session.patch({ fallbackSelected: true })).toThrow(
      'experience_clean_noop_post_terminal_field_write:fallbackSelected',
    );
    expect(() => session.patch({ deterministicFallbackAttemptedAfterNoOp: true })).toThrow(
      'experience_clean_noop_post_terminal_field_write:deterministicFallbackAttemptedAfterNoOp',
    );
    expect(() => session.stage('api_response_received', 'ok')).toThrow(
      'experience_clean_noop_post_terminal_stage_write:api_response_received',
    );

    const trace = session.commit();
    expect(trace.providerAttempted).toBe(false);
    expect(trace.fallbackSelected).toBe(false);
    expect(trace.stages.some((stage) => stage.result === 'fail')).toBe(false);
  });
});
