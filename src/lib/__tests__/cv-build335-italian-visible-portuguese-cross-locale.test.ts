/**
 * @vitest-environment jsdom
 *
 * AAB-335+ — Italian-visible → Brazilian Portuguese Experience cross-locale:
 * EN pre_ai fact authority + unedited Italian AI textarea + pt-BR target must
 * reject wrong-language provider, select a real PT-BR 3/3 warehouse fallback,
 * pass preapply predicates/purity/invariants, and commit once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION,
  validatePortugueseWarehouseExperienceCoverage,
  scanPortugueseWarehousePredicates,
  buildPortugueseWarehouseExperienceFallback,
  portugueseWarehouseFactDiagId,
} from '@/lib/cv-portuguese-experience-grounding';
import {
  detectTextLocale,
  normalizeLocaleKey,
  localesEquivalent,
  canonicalizeContentLocale,
  isPortugueseBrazilLocale,
} from '@/lib/cv-content-locale';
import {
  guessUnitLocale,
  validateAiUnitLocalePurity,
} from '@/lib/cv-ai-unit-locale-purity';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { countTranslatedFactUnits } from '@/lib/cv-cross-locale-experience';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { resolveLocaleCandidate } from '@/lib/i18n/translations';

const REF = '2026-07-25';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const IT_AI_UNEDITED = [
  'Controlla le merci in entrata nel magazzino.',
  'Verifica la documentazione relativa alle merci ricevute.',
  'Si coordina con i colleghi per la preparazione e la movimentazione delle merci.',
].join('\n');

const EN_PROVIDER_NOOP = EN_ORIGINAL;

const EXPECTED_PT_TRIAD = [
  'Verifica as mercadorias que chegam ao armazém.',
  'Confere a documentação relacionada às mercadorias recebidas.',
  'Coordena com os colegas a preparação e a movimentação das mercadorias.',
];

function atlasItVisiblePtTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: IT_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'it',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'pre_ai_snapshot',
  });
  const current: WorkExperience = {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'Warehouse employee',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: IT_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'it',
    generatedDescription: IT_AI_UNEDITED,
    aiOutputProvenance: provenance,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu',
    company: 'Rewitu',
    position: 'Assistant',
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: 'Supported basic administrative tasks.',
    originalUserDescription: 'Supported basic administrative tasks.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-it-pt-335',
    name: 'CV',
    personal: {
      fullName: 'Anna Test',
      email: 'anna@example.com',
      phone: '',
      address: '',
      jobTitle: 'Warehouse employee',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'en',
    experience: [current, prior],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

describe('AAB-335 Italian-visible → Brazilian Portuguese Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Portuguese grounding revision for packaging', () => {
    expect(PORTUGUESE_EXPERIENCE_GROUNDING_335_REVISION).toBe(
      'portuguese-experience-grounding-335-v1',
    );
  });

  it('E. Alias normalization: pt-BR / pt-br / pt_BR / pt compare consistently', () => {
    expect(resolveLocaleCandidate('pt-BR')).toBe('pt-BR');
    expect(resolveLocaleCandidate('pt-br')).toBe('pt-BR');
    expect(resolveLocaleCandidate('pt_BR')).toBe('pt-BR');
    expect(resolveLocaleCandidate('pt')).toBe('pt-BR');
    expect(canonicalizeContentLocale('pt-br')).toBe('pt-BR');
    expect(canonicalizeContentLocale('pt_BR')).toBe('pt-BR');
    expect(isPortugueseBrazilLocale('pt-BR')).toBe(true);
    expect(isPortugueseBrazilLocale('pt-br')).toBe(true);
    expect(isPortugueseBrazilLocale('pt_BR')).toBe(true);
    expect(isPortugueseBrazilLocale('pt')).toBe(true);
    expect(normalizeLocaleKey('pt')).toBe('pt-br');
    expect(normalizeLocaleKey('pt-BR')).toBe('pt-br');
    expect(localesEquivalent('pt', 'pt-BR')).toBe(true);
    expect(localesEquivalent('pt-br', 'pt_BR')).toBe(true);
    expect(localesEquivalent('pt-BR', 'it')).toBe(false);
  });

  it('A. Exact pt-BR triad per-bullet locale — no English/IT/DE false positives', () => {
    const pt = buildPortugueseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    for (const line of EXPECTED_PT_TRIAD) {
      expect(pt).toContain(line);
    }
    const purity = validateAiUnitLocalePurity(pt, 'pt-BR', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBe(0);
    expect(purity.mixedLanguageUnitCount).toBe(0);
    expect(purity.sourceLanguageLeakageDetected).toBe(false);
    expect(purity.detectedLocaleByUnit).toEqual(['pt-BR', 'pt-BR', 'pt-BR']);
    for (const loc of purity.detectedLocaleByUnit || []) {
      expect(loc === null || localesEquivalent(loc, 'pt-BR')).toBe(true);
      expect(loc).not.toBe('en');
      expect(loc).not.toBe('it');
      expect(loc).not.toBe('es');
      expect(loc).not.toBe('fr');
      expect(loc).not.toBe('de');
    }
    for (const bullet of pt.split('\n').filter(Boolean)) {
      expect(guessUnitLocale(bullet, 'pt-BR')).toBe('pt-BR');
    }
  });

  it('B. Predicate completeness: finalSourceUnitPredicateCoveragePassed is true, not null', () => {
    const fallback = buildPortugueseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const cov = validatePortugueseWarehouseExperienceCoverage(EN_ORIGINAL, fallback);
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    expect(cov.uncovered).toEqual([]);
    const pred = scanPortugueseWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
    expect(/\b(checks?|works? with colleagues|incoming goods)\b/iu.test(fallback)).toBe(false);
    expect(/controlla|documentazione|magazzino|colleghi/iu.test(fallback)).toBe(false);
    expect(/contr[oô]le|marchandises|coll[eè]gues/iu.test(fallback)).toBe(false);
    expect(/mercanc|documentaci[oó]n|compa[nñ]er/iu.test(fallback)).toBe(false);
  });

  it('C. Visible comparison: IT 3/3 → PT-BR 3/3 is wrong_locale_fixed only', () => {
    const fallback = buildPortugueseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: IT_AI_UNEDITED,
      candidateText: fallback,
      locale: 'pt-BR',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.degradationKinds).toEqual([]);
    expect(evalVis.materialImprovementDetected).toBe(true);
    expect(evalVis.materialImprovementKinds).toContain('wrong_locale_fixed');
    expect(evalVis.materialImprovementKinds).not.toContain('missing_fact_restored');
    expect(evalVis.semanticNoOpDetected).toBe(false);
  });

  it('D. Preapply rejection: inconsistent locale diagnostics remain blocked', () => {
    const blocked = checkExperienceDiagnosticInvariants({
      targetLocalePurityPassed: true,
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      requestedTargetLocale: 'pt-BR',
      detectedLocaleByBullet: [null, 'en', 'en'],
      finalCandidateSource: 'deterministic_fallback',
      clientDeterministicFallbackSelected: true,
      clientDeterministicFallbackApplied: false,
      countedAsSuccess: false,
      applyCommitted: false,
    } as never);
    expect(
      blocked.failures.some((f) =>
        String(f.invariantCode).includes('purity_pass_with_foreign_detected_bullet_locale')),
    ).toBe(true);

    const cv = atlasItVisiblePtTargetCv();
    const rejectedFinalize = {
      blocked: true,
      countedAsSuccess: false,
      text: '',
      origin: 'ai_generated' as const,
      diagnostics: {
        applyCommitted: false,
        visibleApplySucceeded: false,
        targetContentApplied: false,
        contentLocaleUpdatedAfterApply: false,
        appliedVisibleContentLocale: null,
        translationFallbackApplied: false,
        clientDeterministicFallbackApplied: false,
        countedAsSuccess: false,
      },
    };
    const beforeDesc = cv.experience![0]!.description;
    const beforeGen = (cv.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale;
    const applied = applyFinalizedBulletsToCv(cv, 'pt-BR', 'exp-atlas', rejectedFinalize as never);
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
  });

  it('Incomplete PT coverage populates pt_br_wh_* missing identities', () => {
    const softEnglish = [
      'Checks incoming goods and related documentation for accurate recording.',
      'Updates warehouse records for accurate storage.',
      'Works with colleagues to prepare and move goods.',
    ].join('\n');
    const cov = validatePortugueseWarehouseExperienceCoverage(EN_ORIGINAL, softEnglish);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBeLessThan(3);
    expect(cov.uncovered.length).toBeGreaterThan(0);
    const hashes = cov.uncovered.map((id) => portugueseWarehouseFactDiagId(id));
    expect(hashes.every((h) => h.startsWith('pt_br_wh_'))).toBe(true);
  });

  it('1–26. IT-visible → pt-BR Stronger AI: provider rejected; PT fallback 3/3 selected + applied', () => {
    const cv = atlasItVisiblePtTargetCv();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: IT_AI_UNEDITED,
      locale: 'pt-BR',
      requestId: 'req-it-pt-335',
      jobContextHash: 'job-it-pt-335',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'pt-BR',
      gender: 'female',
      cv,
      candidate: EN_PROVIDER_NOOP,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: snapshot,
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      staleGeneratedDescriptionIgnored: true,
    });

    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.blocked).not.toBe(true);
    expect(localesEquivalent(
      String(fin.diagnostics?.requestedLocale || fin.diagnostics?.requestedTargetLocale || ''),
      'pt-BR',
    )).toBe(true);
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^it/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^it/);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.translationFallbackAttempted).toBe(true);
    expect(fin.diagnostics?.translationFallbackSelected).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidatePresent).not.toBe(false);
    expect(fin.diagnostics?.clientDeterministicFallbackSelected).toBe(true);
    expect(fin.diagnostics?.clientDeterministicFallbackUsedForFinalCandidate).toBe(true);
    // Selection is not a committed write.
    expect(fin.diagnostics?.clientDeterministicFallbackApplied).toBe(false);
    expect(fin.diagnostics?.translationFallbackApplied).toBe(false);
    expect(fin.diagnostics?.applyCommitted).not.toBe(true);

    expect(Number(fin.diagnostics?.fallbackRequiredFactCount ?? fin.diagnostics?.requiredFactCount))
      .toBe(3);
    expect(Number(fin.diagnostics?.fallbackCoveredFactCount ?? fin.diagnostics?.coveredFactCount))
      .toBe(3);
    expect(Number(fin.diagnostics?.finalRequiredFactCount ?? fin.diagnostics?.requiredFactCount))
      .toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount ?? fin.diagnostics?.coveredFactCount))
      .toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount)).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.finalUnsupportedClaimCount ?? 0)).toBe(0);

    const bullets = fin.diagnostics?.detectedLocaleByBullet || [];
    expect(bullets.length).toBe(3);
    for (const loc of bullets) {
      expect(localesEquivalent(loc, 'pt-BR')).toBe(true);
    }
    expect(Number(fin.diagnostics?.wrongLocaleBulletCount ?? 0)).toBe(0);
    expect(Number(fin.diagnostics?.mixedLanguageBulletCount ?? 0)).toBe(0);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);

    const kinds = fin.diagnostics?.materialImprovementKinds || [];
    expect(fin.diagnostics?.materialImprovementDetected).toBe(true);
    expect(kinds).toContain('wrong_locale_fixed');
    expect(kinds).not.toContain('missing_fact_restored');
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.diagnosticInvariantCheckPassed !== false).toBe(true);

    for (const line of EXPECTED_PT_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
    const appliedText = (fin.text || '').trim();

    const usageBefore = 9;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-it-pt-335-apply',
      requestedLocale: 'pt-BR',
      uiLocale: 'pt-BR',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-it-pt-335',
      usageCountBefore: usageBefore,
    });
    session.patch({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      selectedSourceKind: 'originalUserDescription',
      clickedExperienceEntryIdHash: 'atlas-hash',
      selectedExperienceEntryIdHash: 'atlas-hash',
      factAuthorityKind: 'pre_ai_snapshot',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaProvenance: 'ai_generated_unedited',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      sourceFactCount: 3,
      requiredFactCount: 3,
      coveredFactCount: 3,
      authoritativeFactSourceLocale: 'en',
      visibleTextareaLocale: 'it',
      visibleTextareaLocaleBeforeApply: 'it',
      requestedTargetLocale: 'pt-BR',
      entryGeneratedLocaleBeforeApply: 'it',
      contentLocaleDocument: 'en',
      appliedVisibleContentLocale: null,
      visibleLocaleMetadataMismatchRecorded: false,
    });
    session.recordFinalizeResult(fin);
    session.patch({
      factAuthorityKind: 'pre_ai_snapshot',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      sourceFactCount: 3,
      requiredFactCount: 3,
      visibleComparisonProvenance: 'ai_generated_unedited',
      selectedSourceKind: 'originalUserDescription',
      clickedExperienceEntryIdHash: 'atlas-hash',
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      lastAiOutputHashMatched: true,
      visibleComparisonMatchedLastAiOutput: true,
      translationFallbackSelected: true,
      translationFallbackAttempted: true,
      crossLocaleOperation: true,
      clientDeterministicFallbackSelected: true,
      clientDeterministicFallbackUsedForFinalCandidate: true,
      clientDeterministicFallbackApplied: false,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    expect(gate.diagnosticCompletenessPassed).toBe(true);
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.preapplyDiagnosticCompletenessPassed).toBe(true);
    expect(draft.applyAuthorized).toBe(true);
    expect(draft.diagnosticInvariantCheckPassed !== false).toBe(true);
    expect(Number(draft.diagnosticInvariantFailureCount || 0)).toBe(0);
    expect(draft.clientDeterministicFallbackSelected).toBe(true);
    expect(draft.clientDeterministicFallbackApplied).toBe(false);
    expect(draft.finalSourceUnitPredicateCoveragePassed).toBe(true);

    session.patch({
      applyAuthorized: true,
      applyAttempted: true,
      applyWriteSucceeded: true,
      visibleValidationAttempted: true,
      visibleValidationPassed: true,
      applyCommitted: true,
      targetContentApplied: true,
      visibleApplySucceeded: true,
      visibleRequiredFactCount: 3,
      visibleCoveredFactCount: 3,
      visibleUncoveredFactIdentityHashes: [],
      visibleFactCoveragePassed: true,
      visibleRequiredPredicateCount: 3,
      visibleCoveredPredicateCount: 3,
      visiblePredicateCoveragePassed: true,
      visibleNormalizedHash: fingerprintText(appliedText.replace(/\s+/g, ' ').trim()),
      visibleDescriptionMatchesFinalHash: true,
      visibleLocaleValidationPassed: true,
      visibleTenseValidationPassed: true,
      visiblePerspectiveValidationPassed: true,
      postapplyDiagnosticCompletenessPassed: true,
      postapplyDiagnosticInvariantCheckPassed: true,
      preapplyDiagnosticCompletenessPassed: true,
      preapplyDiagnosticInvariantCheckPassed: true,
      appliedVisibleContentLocale: 'pt-BR',
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyAuthorized).toBe(true);
    expect(trace.applyWriteSucceeded).toBe(true);
    expect(trace.visibleFactCoveragePassed).toBe(true);
    expect(trace.visiblePredicateCoveragePassed).toBe(true);
    expect(trace.visibleLocaleValidationPassed).toBe(true);
    expect(trace.visibleValidationPassed).toBe(true);
    expect(trace.applyCommitted).toBe(true);
    expect(trace.targetContentApplied).toBe(true);
    expect(trace.contentLocaleUpdatedAfterApply).toBe(true);
    expect(trace.translationFallbackApplied).toBe(true);
    expect(localesEquivalent(trace.appliedVisibleContentLocale, 'pt-BR')).toBe(true);
    expect(trace.clientDeterministicFallbackApplied).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(usageBefore);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'pt-BR', 'exp-atlas', fin);
    expect(write.experience![0]!.description).toContain(EXPECTED_PT_TRIAD[0]!);
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('pt-BR');
    expect(write.experience![1]!.description).toContain('administrative');

    const finAlias = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'pt-br' as never,
      gender: 'female',
      cv: atlasItVisiblePtTargetCv(),
      candidate: EN_PROVIDER_NOOP,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: IT_AI_UNEDITED,
        locale: 'pt-BR',
        requestId: 'req-it-pt-alias',
        jobContextHash: 'job-it-pt-alias',
        experienceEntryId: 'exp-atlas',
        authoritativeTextOverride: EN_ORIGINAL,
        provenanceOriginOverride: 'originalUserDescription',
      }),
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      staleGeneratedDescriptionIgnored: true,
    });
    expect(finAlias.countedAsSuccess).toBe(true);
    expect(finAlias.text || '').toContain(EXPECTED_PT_TRIAD[0]!);
    void detectTextLocale;
  });
});
