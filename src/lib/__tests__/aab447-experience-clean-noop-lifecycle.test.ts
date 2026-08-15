import { describe, expect, it } from 'vitest';
import {
  resolveTrustedUneditedAiOutputLocale,
} from '@/lib/cv-experience-ai-output-provenance';
import {
  analyzeExperienceVisibleSource,
} from '@/lib/cv-experience-visible-source-analysis';
import {
  buildExperienceCleanNoOpTerminalFields,
  EXPERIENCE_CLEAN_NOOP_STAGE_PLAN,
} from '@/lib/cv-experience-terminal-outcome';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import type { WorkExperience } from '@/lib/types';

const provenance = {
  currentTextareaProvenance: 'ai_generated_unedited' as const,
  lastAiOutputHashMatched: true,
  materialUserEditDetected: false,
};

describe('AAB447 Experience clean-noop lifecycle', () => {
  it('uses entry-scoped generated locale after persisted provenance and before document metadata', () => {
    const exp = {
      id: 'entry-a',
      generatedLocale: 'fr',
      aiOutputProvenance: undefined,
    } as Pick<WorkExperience, 'id' | 'generatedLocale' | 'aiOutputProvenance'>;
    expect(resolveTrustedUneditedAiOutputLocale({
      exp,
      provenance,
      requestedLocale: 'fr',
    })).toBe('fr');
    expect(analyzeExperienceVisibleSource({
      visibleText: 'Preparaba materiales y coordinaba proyectos para clientes.',
      targetLocale: 'fr',
      trustedLocale: 'fr',
      generatedLocale: 'fr',
      storedLocale: 'es',
      isPresent: false,
    }).sourceLocale).toBe('fr');
  });

  it('does not reuse entry locale authority after an edit, target change, or entry change', () => {
    const exp = {
      id: 'entry-a',
      generatedLocale: 'fr',
      aiOutputProvenance: {
        experienceEntryId: 'entry-a',
        targetLocale: 'fr',
      },
    } as Pick<WorkExperience, 'id' | 'generatedLocale' | 'aiOutputProvenance'>;
    expect(resolveTrustedUneditedAiOutputLocale({
      exp,
      provenance: { ...provenance, materialUserEditDetected: true },
      requestedLocale: 'fr',
    })).toBeNull();
    expect(resolveTrustedUneditedAiOutputLocale({
      exp,
      provenance,
      requestedLocale: 'de',
    })).toBeNull();
    expect(resolveTrustedUneditedAiOutputLocale({
      exp: { ...exp, id: 'entry-b' },
      provenance,
      requestedLocale: 'fr',
    })).toBeNull();
  });

  it('keeps raw detector disagreement advisory while trusted locale remains authoritative', () => {
    const analysis = analyzeExperienceVisibleSource({
      visibleText: 'Preparaba materiales y coordinaba proyectos para clientes.',
      targetLocale: 'fr',
      trustedLocale: 'fr',
      storedLocale: 'es',
      isPresent: false,
    });
    expect(analysis.sourceLocale).toBe('fr');
    expect(analysis.localeAuthorityKind).toBe('ai_output_provenance');
    expect(analysis.rawDetectedLocale).toBe('es');
    expect(analysis.rawDetectorDisagreesWithTrustedLocale).toBe(true);
    expect(analysis.sourceAlreadyValidForTarget).toBe(true);
  });

  it('models a clean no-op as a terminal skipped-stage outcome with no provider evidence', () => {
    const clean = buildExperienceCleanNoOpTerminalFields({
      visibleSourceAlreadyValid: true,
      visibleComparisonHash: 'fnv1a_visible',
      visibleComparisonNormalizedHash: 'fnv1a_visible_normalized',
      visibleComparisonUnitCount: 3,
    });
    const stages = EXPERIENCE_CLEAN_NOOP_STAGE_PLAN.map((stage) => ({
      stage: stage.stage,
      result: stage.result,
      typedReason: stage.typedReason,
    }));
    const trace = {
      ...clean,
      stages,
      providerAttempted: false,
      providerHttpStatus: null,
      providerResponseKind: 'not_attempted',
      apiResponseKind: 'not_attempted',
      candidateLineage: clean.candidateLineage,
      recoveryAttempted: false,
      recoveryCandidatePresent: false,
      recoverySelected: false,
      serverRepairAttempted: false,
      serverRepairSelected: false,
      translationFallbackAttempted: false,
      translationFallbackSelected: false,
      clientDeterministicFallbackAttempted: false,
      clientDeterministicFallbackSelected: false,
      fallbackSelected: false,
      earlyNoOpPreflightPassed: true,
      sourceAlreadyValidForTarget: true,
      finalDecisionKind: 'semantic_noop',
      finalCandidateSource: 'none',
      finalCandidatePresent: false,
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      shouldIncrementUsage: false,
      usageCountBefore: 35,
      usageCountAfter: 35,
    };
    const invariant = checkExperienceDiagnosticInvariants(trace);
    if (!invariant.passed) console.log('AAB447 invariant failures', invariant.failures);
    expect(invariant.passed).toBe(true);
    expect(stages.some((stage) => (stage.result as string) === 'fail')).toBe(false);
    expect(clean.providerRequiredFactCount).toBeNull();
    expect(clean.providerCoveredFactCount).toBeNull();
    expect(clean.finalCandidateSource).toBe('none');
    expect(clean.countedAsSuccess).toBe(false);
  });
});
