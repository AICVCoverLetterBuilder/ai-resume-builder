import { describe, expect, it } from 'vitest';
import {
  validateFrenchSummaryFiniteGrammar,
} from '../cv-french-summary-grounding';
import {
  buildNativeFirstPersonDutyTail,
  evaluateSummaryV2NativeSurface,
  realizeFirstPersonDutyClause,
} from '../cv-summary-v2/native-surface';
import { SummaryAiDiagnosticSession } from '../cv-summary-ai-diagnostics';

describe('AAB-436 French Summary finite person/auxiliary contract', () => {
  it('realizes present, imperfect and shared completed first-person chains', () => {
    expect(realizeFirstPersonDutyClause('prépare les supports', 'fr', 'present'))
      .toBe('prépare les supports');
    expect(realizeFirstPersonDutyClause('créais des contenus et vérifiait la qualité', 'fr', 'completed'))
      .toBe('créais des contenus et vérifiais la qualité');
    expect(realizeFirstPersonDutyClause('a fait des maquettes', 'fr', 'completed'))
      .toBe('ai fait des maquettes');
    expect(buildNativeFirstPersonDutyTail([
      'a préparé les concepts',
      'a retouché les illustrations',
      'a coordonné les modifications',
    ], 'fr', 'completed'))
      .toBe(", où j'ai préparé les concepts, retouché les illustrations et coordonné les modifications");
  });

  it('accepts native French and rejects invalid subject/auxiliary switching', () => {
    const valid = [
      "Je travaille actuellement comme Graphiste, où je prépare les concepts et coordonne les projets.",
      "Auparavant, j'ai travaillé comme Graphiste, où je créais des contenus, développais des concepts et vérifiais la qualité.",
      "Auparavant, j'ai travaillé comme Graphiste, où j'ai préparé des contenus, retouché des images et coordonné les modifications.",
      "Auparavant, j'ai travaillé comme Graphiste, où j'ai fait des maquettes et vérifié la qualité.",
    ];
    for (const text of valid) {
      const grammar = validateFrenchSummaryFiniteGrammar(text);
      expect(grammar.grammarValidationPassed, text).toBe(true);
      expect(grammar.grammarRecords.length, text).toBeGreaterThan(0);
      expect(evaluateSummaryV2NativeSurface({ text, locale: 'fr' }).nativeSurfaceValidationPassed, text).toBe(true);
    }
    const invalid = [
      "Auparavant, j'ai travaillé comme Graphiste, où je créais des contenus et vérifiait la qualité.",
      "Auparavant, j'ai travaillé comme Graphiste, où j'a préparé des contenus.",
      "Auparavant, j'ai travaillé comme Graphiste, où j'ai préparé des contenus, a retouché des images et a coordonné les modifications.",
    ];
    for (const text of invalid) {
      const result = validateFrenchSummaryFiniteGrammar(text);
      expect(result.grammarValidationPassed, text).toBe(false);
      expect(evaluateSummaryV2NativeSurface({ text, locale: 'fr' }).nativeSurfaceValidationPassed, text).toBe(false);
    }
  });

  it('fails closed on malformed visible French and records successful visible truth', () => {
    const makeSession = () => {
      const session = new SummaryAiDiagnosticSession({
        uiLocale: 'fr',
        requestedLocale: 'fr',
        contentLocale: 'fr',
        templateId: 'modern',
        gender: 'female',
        requestId: 'aab436-visible',
        usageCountBefore: 27,
        operationMode: 'generate_from_context',
      });
      session.patch({
        independentFinalDurationClaimCount: 1,
        finalDurationScopeValidationPassed: true,
        finalPerspectiveMode: 'first_person',
        finalNormalizedHash: null,
        finalValidatedCandidateHash: null,
        grammarValidationPassed: true,
        finalPostconditionsPassed: true,
        requiredCurrentDutyFactCount: 0,
        requiredPriorDutyFactCount: 0,
      });
      return session;
    };
    const malformed = "Je dispose d'environ sept ans d'expérience. Auparavant, j'ai travaillé comme Graphiste, où je créais des contenus et vérifiait la qualité.";
    const failed = makeSession();
    failed.recordVisibleApply(true, 28, malformed);
    const failedTrace = failed.commit();
    expect(failedTrace.visibleApplySucceeded).toBe(false);
    expect(failedTrace.countedAsSuccess).toBe(false);
    expect(failedTrace.usageCountAfter).toBe(27);
    expect(failedTrace.visibleGrammarValidationPassed).toBe(false);
    expect(failedTrace.visibleNativeSurfaceValidationPassed).toBe(false);
    expect(failedTrace.visibleFinalPostconditionsPassed).toBe(false);

    const valid = "Je dispose d'environ sept ans d'expérience. Je travaille actuellement comme Graphiste, où je prépare les concepts et coordonne les projets.";
    const passed = makeSession();
    passed.recordVisibleApply(true, 28, valid);
    const passedTrace = passed.commit();
    expect(passedTrace.visibleApplySucceeded).toBe(true);
    expect(passedTrace.countedAsSuccess).toBe(true);
    expect(passedTrace.usageCountAfter).toBe(28);
    expect(passedTrace.visibleGrammarValidationPassed).toBe(true);
    expect(passedTrace.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(passedTrace.visibleFinalPostconditionsPassed).toBe(true);
  });

});
