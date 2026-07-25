/**
 * @vitest-environment jsdom
 *
 * AAB-337 — Portuguese-visible → Russian Experience cross-locale:
 * EN pre_ai fact authority + unedited pt-BR AI textarea + ru target must
 * reject the merged soft Cyrillic provider (2 real duties / 3 bullets),
 * select a hard Russian 3/3 warehouse fallback, pass preapply predicates,
 * and commit once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION,
  validateRussianWarehouseExperienceCoverage,
  scanRussianWarehousePredicates,
  buildRussianWarehouseExperienceFallback,
  russianWarehouseFactDiagId,
  sourceRequiresRussianWarehouseFactCoverage,
} from '@/lib/cv-russian-experience-grounding';
import {
  detectTextLocale,
  normalizeLocaleKey,
  localesEquivalent,
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
import { buildExperienceSelectedFinalCandidateSnapshot } from '@/lib/cv-experience-phased-apply-329';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-25';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const PT_BR_AI_UNEDITED = [
  'Verifica as mercadorias que chegam ao armazém.',
  'Confere a documentação relacionada às mercadorias recebidas.',
  'Coordena com os colegas a preparação e a movimentação das mercadorias.',
].join('\n');

/** Device-equivalent soft RU provider triad (merged goods+docs + invented update). */
const DEVICE_SOFT_RU_PROVIDER = [
  'Проверяет поступившие товары и сопроводительные документы для точного учёта.',
  'Обновляет складской учёт и поддерживает упорядоченное размещение товаров.',
  'Координирует подготовку и перемещение товаров совместно с коллегами.',
].join('\n');

const EXPECTED_RU_HARD_TRIAD = [
  'Проверяет поступающие на склад товары.',
  'Проверяет документацию, связанную с полученными товарами.',
  'Координирует с коллегами подготовку и перемещение товаров.',
];

function atlasPtVisibleRuTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: PT_BR_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'pt-BR',
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
    description: PT_BR_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'pt-BR',
    generatedDescription: PT_BR_AI_UNEDITED,
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
    id: 'cv-pt-ru-337',
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

describe('AAB-337 Portuguese-visible → Russian Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Russian grounding revision for packaging', () => {
    expect(RUSSIAN_EXPERIENCE_GROUNDING_337_REVISION).toBe(
      'russian-experience-grounding-337-v1',
    );
  });

  it('A. Russian fact separation: three independent required identities', () => {
    expect(sourceRequiresRussianWarehouseFactCoverage(EN_ORIGINAL)).toBe(true);
    const soft = validateRussianWarehouseExperienceCoverage(
      EN_ORIGINAL,
      DEVICE_SOFT_RU_PROVIDER,
    );
    expect(soft.required.length).toBe(3);
    expect(soft.required).toEqual([
      'incoming_goods_check',
      'document_check',
      'goods_prep_movement_colleagues',
    ]);
    expect(soft.ok).toBe(false);
    expect(soft.covered.length).toBeLessThan(3);
    expect(soft.uncovered.length).toBeGreaterThan(0);
    const hashes = soft.uncovered.map((id) => russianWarehouseFactDiagId(id));
    expect(hashes.every((h) => h.startsWith('ru_wh_'))).toBe(true);
    expect(hashes).toContain('ru_wh_document_check');

    const hard = buildRussianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const hardCov = validateRussianWarehouseExperienceCoverage(EN_ORIGINAL, hard);
    expect(hardCov.ok).toBe(true);
    expect(hardCov.covered.length).toBe(3);
    expect(hardCov.uncovered).toEqual([]);
  });

  it('B. Predicate completeness: 3/3 and true, never 0/null', () => {
    const fallback = buildRussianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const pred = scanRussianWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);

    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: fallback,
      sourceDescription: EN_ORIGINAL,
      candidateKind: 'deterministic_fallback',
      source: 'deterministic_fallback',
      targetLocale: 'ru',
      employmentState: 'current',
      meaningfulChangeDetected: true,
    });
    expect(snap.requiredFactCount).toBe(3);
    expect(snap.coveredFactCount).toBe(3);
    expect(snap.sourcePredicateIdentityCount).toBe(3);
    expect(snap.candidatePredicateIdentityCount).toBe(3);
    expect(snap.predicateCoveragePassed).toBe(true);
    expect(snap.predicateCoveragePassed).not.toBeNull();
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
  });

  it('C. Provider with only two real duties rejected despite three Cyrillic bullets', () => {
    const purity = validateAiUnitLocalePurity(DEVICE_SOFT_RU_PROVIDER, 'ru', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.detectedLocaleByUnit).toEqual(['ru', 'ru', 'ru']);
    expect(DEVICE_SOFT_RU_PROVIDER.split('\n').filter(Boolean)).toHaveLength(3);

    const cov = validateRussianWarehouseExperienceCoverage(
      EN_ORIGINAL,
      DEVICE_SOFT_RU_PROVIDER,
    );
    expect(cov.ok).toBe(false);
    // Soft shell merges goods+docs into one bullet and invents an update-records
    // duty — at most colleagues + optionally incoming; never a dedicated docs fact.
    expect(cov.covered.length).toBeLessThan(3);
    expect(cov.covered.length).toBeGreaterThanOrEqual(1);
    expect(cov.uncovered).toContain('document_check');
    expect(cov.uncovered.map((id) => russianWarehouseFactDiagId(id))
      .every((h) => h.startsWith('ru_wh_'))).toBe(true);

    const pred = scanRussianWarehousePredicates(EN_ORIGINAL, DEVICE_SOFT_RU_PROVIDER);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(pred.candidatePredicateIdentityCount).toBeLessThan(3);
  });

  it('D. Russian fallback recovery: provider rejection selects hard RU 3/3', () => {
    const cv = atlasPtVisibleRuTargetCv();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: PT_BR_AI_UNEDITED,
      locale: 'ru',
      requestId: 'req-pt-ru-337-d',
      jobContextHash: 'job-pt-ru-337-d',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ru',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_RU_PROVIDER,
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
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.providerRequiredFactCount
      ?? fin.diagnostics?.requiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.translatedFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount)).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).not.toBeNull();
    for (const line of EXPECTED_RU_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
  });

  it('E. PT-BR 3/3 → RU 3/3 visible comparison: wrong_locale_fixed only', () => {
    const fallback = buildRussianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: PT_BR_AI_UNEDITED,
      candidateText: fallback,
      locale: 'ru',
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

  it('F. Rejection safety: incomplete Russian diagnostics preserve Portuguese text', () => {
    // Mirror the device failure: purity looked fine but predicate completeness was null/0.
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-pt-ru-337-reject-safety',
      requestedLocale: 'ru',
      uiLocale: 'ru',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-pt-ru-337-reject',
      usageCountBefore: 12,
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
      requiredFactCount: 2,
      coveredFactCount: 2,
      authoritativeFactSourceLocale: 'en',
      visibleTextareaLocale: 'pt-BR',
      visibleTextareaLocaleBeforeApply: 'pt-BR',
      requestedTargetLocale: 'ru',
      entryGeneratedLocaleBeforeApply: 'pt-BR',
      contentLocaleDocument: 'en',
      appliedVisibleContentLocale: null,
      finalCandidatePresent: true,
      finalCandidateSource: 'provider',
      finalRequiredFactCount: 2,
      finalCoveredFactCount: 2,
      finalFactCoveragePassed: true,
      sourcePredicateIdentityCount: 0,
      finalCandidatePredicateIdentityCount: 0,
      finalAddedPredicateCount: 0,
      finalSourceUnitPredicateCoveragePassed: null,
      finalUnsupportedClaimCount: 0,
      materialImprovementDetected: true,
      materialImprovementKinds: ['wrong_locale_fixed'],
      materialImprovementEvidenceCount: 1,
      everyImprovementKindHasEvidence: true,
      semanticNoOpDetected: false,
      degradationDetected: false,
      finalDecisionKind: 'material_improvement',
      targetLocalePurityPassed: true,
      detectedLocaleByBullet: ['ru', 'ru', 'ru'],
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      countedAsSuccess: true,
      applyCommitted: false,
      clientDeterministicFallbackSelected: false,
      translationFallbackSelected: false,
      crossLocaleOperation: true,
      providerAccepted: true,
      canonicalAcceptancePassed: true,
      sourceAlreadyValidForTarget: false,
      expectedEmploymentTense: 'present',
      sourceTenseMismatchCount: 0,
      sourceTenseValidationPassed: true,
      providerNoOpEligibleAsFinal: false,
      providerNoOpBlockedBySourceDefect: false,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(false);
    expect(
      gate.diagnosticCompletenessPassed === false
      || (gate as { invariantCheckPassed?: boolean }).invariantCheckPassed === false
      || Number((session as unknown as { draft: Record<string, unknown> }).draft
        .diagnosticInvariantFailureCount || 0) > 0
      || ((session as unknown as { draft: Record<string, unknown> }).draft
        .preapplyNullRequiredDiagnosticFields as string[] | undefined)?.length,
    ).toBeTruthy();

    const cv = atlasPtVisibleRuTargetCv();
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
    const beforeGen = (cv.experience![0] as WorkExperience & { generatedLocale?: string })
      .generatedLocale;
    const applied = applyFinalizedBulletsToCv(cv, 'ru', 'exp-atlas', rejectedFinalize as never);
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
    expect(applied.experience![0]!.description).toContain('Verifica as mercadorias');
    void checkExperienceDiagnosticInvariants;
  });

  it('1–20. PT-BR-visible → ru Stronger AI: soft provider rejected; RU hard 3/3 applied', () => {
    const cv = atlasPtVisibleRuTargetCv();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: PT_BR_AI_UNEDITED,
      locale: 'ru',
      requestId: 'req-pt-ru-337',
      jobContextHash: 'job-pt-ru-337',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ru',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_RU_PROVIDER,
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
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/pt/i);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/pt/i);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toBe('ru');
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.translationFallbackAttempted).toBe(true);
    expect(fin.diagnostics?.translationFallbackSelected).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.clientDeterministicFallbackSelected).toBe(true);
    expect(fin.diagnostics?.clientDeterministicFallbackApplied).toBe(false);
    expect(fin.diagnostics?.applyCommitted).not.toBe(true);

    expect(Number(fin.diagnostics?.requiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerRequiredFactCount
      ?? fin.diagnostics?.requiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.translatedFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount)).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.finalUnsupportedClaimCount ?? 0)).toBe(0);

    expect(fin.diagnostics?.detectedLocaleByBullet).toEqual(['ru', 'ru', 'ru']);
    expect(fin.diagnostics?.detectedScriptByBullet).toEqual([
      'cyrillic',
      'cyrillic',
      'cyrillic',
    ]);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);

    const kinds = fin.diagnostics?.materialImprovementKinds || [];
    expect(fin.diagnostics?.materialImprovementDetected).toBe(true);
    expect(kinds).toContain('wrong_locale_fixed');
    expect(kinds).not.toContain('missing_fact_restored');
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.diagnosticInvariantCheckPassed !== false).toBe(true);

    for (const line of EXPECTED_RU_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
    expect(/mercadorias|armazém|documentação/iu.test(fin.text || '')).toBe(false);
    expect(/\b(checks?|incoming goods)\b/iu.test(fin.text || '')).toBe(false);
    const appliedText = (fin.text || '').trim();

    const usageBefore = 12;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-pt-ru-337-apply',
      requestedLocale: 'ru',
      uiLocale: 'ru',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-pt-ru-337',
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
      visibleTextareaLocale: 'pt-BR',
      visibleTextareaLocaleBeforeApply: 'pt-BR',
      requestedTargetLocale: 'ru',
      entryGeneratedLocaleBeforeApply: 'pt-BR',
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
      contentLocaleDocument: 'ru',
      appliedVisibleContentLocale: 'ru',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
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
    expect(trace.appliedVisibleContentLocale).toBe('ru');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(usageBefore);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'ru', 'exp-atlas', fin);
    expect(write.experience![0]!.description).toContain(EXPECTED_RU_HARD_TRIAD[0]!);
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('ru');
    expect(write.contentLocale).toBe('ru');
    expect(write.experience![1]!.description).toContain('administrative');

    for (const bullet of (fin.text || '').split('\n').filter(Boolean)) {
      expect(guessUnitLocale(bullet, 'ru')).toBe('ru');
    }
    void detectTextLocale;
    void normalizeLocaleKey;
    void localesEquivalent;
  });

  it('Valid hard Russian provider may be accepted at 3/3', () => {
    const hard = EXPECTED_RU_HARD_TRIAD.join('\n');
    const cv = atlasPtVisibleRuTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ru',
      gender: 'female',
      cv,
      candidate: hard,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: PT_BR_AI_UNEDITED,
        locale: 'ru',
        requestId: 'req-pt-ru-337-valid-provider',
        jobContextHash: 'job-pt-ru-337-valid-provider',
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
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(true);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    for (const line of EXPECTED_RU_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
  });
});
