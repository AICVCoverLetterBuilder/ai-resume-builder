import { describe, expect, it } from 'vitest';
import {
  buildNativeFirstPersonDutyTail,
  evaluateSummaryV2NativeSurface,
  normalizeFrenchTokenBoundaries,
} from '../cv-summary-v2/native-surface';
import { SummaryAiDiagnosticSession } from '../cv-summary-ai-diagnostics';

describe('AAB-437 French Summary token boundaries and clause casing', () => {
  it('serializes coordinated French duties with lexical spaces and lowercase continuation predicates', () => {
    const tail = buildNativeFirstPersonDutyTail([
      'Cr\u00e9ais les concepts visuels et les maquettes',
      'D\u00e9veloppais les graphiques et les images',
      'Examinais les \u00e9bauches et les modifications',
    ], 'fr', 'completed');
    expect(tail).toContain('o\u00f9 je cr\u00e9ais');
    expect(tail).toContain('et les maquettes');
    expect(tail).toContain('et les images');
    expect(tail).toContain('et les modifications');
    expect(tail).toContain(', d\u00e9veloppais');
    expect(tail).toContain('et examinais');
    expect(tail).not.toMatch(/etles|oules|avecles|pourles|dansles|surles/iu);
    expect(tail).not.toMatch(/oÃ¹ je \p{Lu}\p{Ll}+/u);
    const present = buildNativeFirstPersonDutyTail([
      'Pr\u00e9pare les concepts et les maquettes',
      'Coordonne les modifications',
    ], 'fr', 'present');
    expect(present).toContain('o\u00f9 je pr\u00e9pare');
    expect(present).toContain('et coordonne');

    const composed = buildNativeFirstPersonDutyTail([
      'A Pr\u00e9par\u00e9 les concepts',
      'A Retouch\u00e9 les illustrations',
    ], 'fr', 'completed');
    expect(composed).toContain("o\u00f9 j'ai pr\u00e9par\u00e9");
    expect(composed).toContain('et retouch\u00e9');
  });

  it('repairs shared function-word/article joins but rejects malformed final surfaces', () => {
    expect(normalizeFrenchTokenBoundaries('etles maquettes avecles supports pourles projets')).toBe(
      'et les maquettes avec les supports pour les projets',
    );
    const malformed = evaluateSummaryV2NativeSurface({
      text: 'Je travaille actuellement comme graphiste, o\u00f9 je pr\u00e9pare les concepts etles maquettes.',
      locale: 'fr',
    });
    expect(malformed.nativeSurfaceValidationPassed).toBe(false);
    expect(malformed.frenchTokenBoundaryValidationPassed).toBe(false);
    expect(malformed.nativeSurfaceRejectionReasons).toContain('french_token_boundary_violation');
  });

  it('rejects artificial embedded capitalization while preserving proper nouns and acronyms', () => {
    const malformed = evaluateSummaryV2NativeSurface({
      text: 'Je travaille chez Rewitu, o\u00f9 je Cr\u00e9ais les concepts et les maquettes, D\u00e9veloppais les visuels pour NASA.',
      locale: 'fr',
    });
    expect(malformed.nativeSurfaceValidationPassed).toBe(false);
    expect(malformed.frenchClauseCasingValidationPassed).toBe(false);
    expect(malformed.nativeSurfaceRejectionReasons).toContain('french_embedded_clause_capitalization');

    const valid = evaluateSummaryV2NativeSurface({
      text: 'Je travaille chez Rewitu, o\u00f9 je cr\u00e9ais les concepts et les maquettes pour NASA.',
      locale: 'fr',
    });
    expect(valid.nativeSurfaceValidationPassed).toBe(true);
  });

  it('fails malformed final/visible French closed and counts only a valid surface as success', () => {
    const makeSession = () => new SummaryAiDiagnosticSession({
      uiLocale: 'fr',
      requestedLocale: 'fr',
      contentLocale: 'fr',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab437-visible',
      usageCountBefore: 41,
      operationMode: 'generate_from_context',
    });
    const malformed = makeSession();
    malformed.patch({
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
    malformed.recordVisibleApply(true, 42, 'Je dispose d\'environ 86 mois d\'exp\u00e9rience professionnelle, o\u00f9 je pr\u00e9pare les concepts etles maquettes.');
    const failed = malformed.commit();
    expect(failed.visibleApplySucceeded).toBe(false);
    expect(failed.countedAsSuccess).toBe(false);
    expect(failed.usageCountAfter).toBe(41);
    expect(failed.visibleGrammarValidationPassed).toBe(false);
    expect(failed.visibleNativeSurfaceValidationPassed).toBe(false);
    expect(failed.visibleFinalPostconditionsPassed).toBe(false);

    const valid = makeSession();
    valid.patch({
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
    valid.recordVisibleApply(true, 42, 'Je dispose d\'environ 86 mois d\'exp\u00e9rience professionnelle, o\u00f9 je pr\u00e9pare les concepts et les maquettes.');
    const passed = valid.commit();
    expect(passed.visibleApplySucceeded).toBe(true);
    expect(passed.countedAsSuccess).toBe(true);
    expect(passed.usageCountAfter).toBe(42);
    expect(passed.visibleGrammarValidationPassed).toBe(true);
    expect(passed.visibleNativeSurfaceValidationPassed).toBe(true);
    expect(passed.visibleFinalPostconditionsPassed).toBe(true);
  });
});
