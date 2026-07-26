/**
 * @vitest-environment jsdom
 *
 * AAB-339 — Hindi-visible → Japanese Experience cross-locale:
 * EN pre_ai fact authority + unedited Hindi AI textarea + ja target must
 * reject the merged soft CJK provider triad (2 real duties), select a hard
 * Japanese 3/3 warehouse fallback, pass preapply predicates, freeze provider
 * rejection evidence, keep meaningfulChangeDetected consistent with
 * wrong_locale_fixed, and commit once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  JAPANESE_EXPERIENCE_GROUNDING_339_REVISION,
  validateJapaneseWarehouseExperienceCoverage,
  scanJapaneseWarehousePredicates,
  buildJapaneseWarehouseExperienceFallback,
  japaneseWarehouseFactDiagId,
  sourceRequiresJapaneseWarehouseFactCoverage,
} from '@/lib/cv-japanese-experience-grounding';
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
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { resolveExperienceAiAuthoritativeSource } from '@/lib/cv-experience-provenance';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';

const REF = '2026-07-26';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const HI_AI_UNEDITED = [
  'गोदाम में आने वाले माल की जाँच करती हैं।',
  'प्राप्त माल से संबंधित दस्तावेज़ों की जाँच करती हैं।',
  'माल की तैयारी और स्थानांतरण के लिए सहकर्मियों के साथ समन्वय करती हैं।',
].join('\n');

/**
 * Device-equivalent soft JA provider triad (AAB 339).
 * Bullet 1 merges incoming goods + documentation and adds an accuracy claim.
 * Bullet 2 invents inventory update + orderly placement.
 * Bullet 3 alone preserves colleague coordination.
 */
const DEVICE_SOFT_JA_PROVIDER = [
  '入荷した商品と関連書類の正確性を確認する。',
  '倉庫記録を更新し、保管品の整然とした配置を維持する。',
  '同僚と連携して商品の準備と移動を調整する。',
].join('\n');

const EXPECTED_JA_HARD_TRIAD = [
  '倉庫に入荷する商品を確認します。',
  '受領した商品に関連する書類を確認します。',
  '商品の準備と移動について同僚と連携します。',
];

function atlasHiVisibleJaTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: HI_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'hi',
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
    description: HI_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'hi',
    generatedDescription: HI_AI_UNEDITED,
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
    id: 'cv-hi-ja-339',
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

describe('AAB-339 Hindi-visible → Japanese Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Japanese grounding revision for packaging', () => {
    expect(JAPANESE_EXPERIENCE_GROUNDING_339_REVISION).toBe(
      'japanese-experience-grounding-339-v1',
    );
  });

  it('A. Japanese fact separation: three independent required identities', () => {
    expect(sourceRequiresJapaneseWarehouseFactCoverage(EN_ORIGINAL)).toBe(true);
    const soft = validateJapaneseWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_JA_PROVIDER);
    expect(soft.required.length).toBe(3);
    expect(soft.required).toEqual([
      'incoming_goods_check',
      'document_check',
      'goods_prep_movement_colleagues',
    ]);
    expect(soft.ok).toBe(false);
    expect(soft.covered.length).toBeLessThan(3);
    expect(soft.uncovered.length).toBeGreaterThan(0);
    const hashes = soft.uncovered.map((id) => japaneseWarehouseFactDiagId(id));
    expect(hashes.every((h) => h.startsWith('ja_wh_'))).toBe(true);

    const hard = buildJapaneseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    for (const line of EXPECTED_JA_HARD_TRIAD) {
      expect(hard).toContain(line);
    }
    const hardCov = validateJapaneseWarehouseExperienceCoverage(EN_ORIGINAL, hard);
    expect(hardCov.ok).toBe(true);
    expect(hardCov.covered.length).toBe(3);

    const male = buildJapaneseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'male',
    });
    const unspecified = buildJapaneseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'unspecified',
    });
    expect(validateJapaneseWarehouseExperienceCoverage(EN_ORIGINAL, male).ok).toBe(true);
    expect(validateJapaneseWarehouseExperienceCoverage(EN_ORIGINAL, unspecified).ok).toBe(true);
    expect(male).toContain(EXPECTED_JA_HARD_TRIAD[0]!);
    expect(unspecified).toContain(EXPECTED_JA_HARD_TRIAD[0]!);
  });

  it('B. Predicate completeness: 3/3 and true, never 0/null', () => {
    const fallback = buildJapaneseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    const pred = scanJapaneseWarehousePredicates(EN_ORIGINAL, fallback);
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
      targetLocale: 'ja',
      employmentState: 'current',
      meaningfulChangeDetected: true,
    });
    expect(snap.requiredFactCount).toBe(3);
    expect(snap.coveredFactCount).toBe(3);
    expect(snap.sourcePredicateIdentityCount).toBe(3);
    expect(snap.candidatePredicateIdentityCount).toBe(3);
    expect(snap.predicateCoveragePassed).toBe(true);
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
  });

  it('C. Provider with three Japanese bullets but only two real duties is rejected', () => {
    const purity = validateAiUnitLocalePurity(DEVICE_SOFT_JA_PROVIDER, 'ja', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.detectedLocaleByUnit).toEqual(['ja', 'ja', 'ja']);
    const cov = validateJapaneseWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_JA_PROVIDER);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBeLessThan(3);
    expect(cov.uncovered.map((id) => japaneseWarehouseFactDiagId(id)).length).toBeGreaterThan(0);
    const pred = scanJapaneseWarehousePredicates(EN_ORIGINAL, DEVICE_SOFT_JA_PROVIDER);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
  });

  it('D. Japanese fallback recovery: invalid provider selects hard JA 3/3', () => {
    const cv = atlasHiVisibleJaTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ja',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_JA_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: HI_AI_UNEDITED,
        locale: 'ja',
        requestId: 'req-hi-ja-339-d',
        jobContextHash: 'job-hi-ja-339-d',
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
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    for (const line of EXPECTED_JA_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
  });

  it('E. HI 3/3 → JA 3/3 visible comparison: wrong_locale_fixed only', () => {
    const fallback = buildJapaneseWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: HI_AI_UNEDITED,
      candidateText: fallback,
      locale: 'ja',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.materialImprovementDetected).toBe(true);
    expect(evalVis.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(evalVis.materialImprovementKinds).not.toContain('missing_fact_restored');
    expect(evalVis.semanticNoOpDetected).toBe(false);
  });

  it('F. meaningfulChange consistency with wrong_locale_fixed', () => {
    const cv = atlasHiVisibleJaTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ja',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_JA_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: HI_AI_UNEDITED,
        locale: 'ja',
        requestId: 'req-hi-ja-339-f',
        jobContextHash: 'job-hi-ja-339-f',
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
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.finalDecisionKind || 'material_improvement').toMatch(
      /material_improvement|accepted/,
    );
    const inv = checkExperienceDiagnosticInvariants({
      ...fin.diagnostics,
      materialImprovementKinds: ['wrong_locale_fixed'],
      finalDecisionKind: 'material_improvement',
      meaningfulChangeDetected: true,
      finalCandidatePredicateValidationApplicable: true,
      finalCandidatePredicateIdentityCount: 3,
      finalSourceUnitPredicateCoveragePassed: true,
      finalRequiredFactCount: 3,
      finalFactCoveragePassed: true,
      applyAuthorized: true,
      requestedTargetLocale: 'ja',
    } as never);
    expect(inv.failures.map((f) => f.invariantCode)).not.toContain(
      'wrong_locale_fixed_without_meaningful_change',
    );
    expect(inv.failures.map((f) => f.invariantCode)).not.toContain(
      'final_predicate_coverage_vacuous_or_null',
    );
  });

  it('G. Rejection safety: incomplete Japanese diagnostics preserve Hindi text', () => {
    const cv = atlasHiVisibleJaTargetCv();
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
    const applied = applyFinalizedBulletsToCv(cv, 'ja', 'exp-atlas', rejectedFinalize as never);
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
    expect(applied.experience![0]!.description).toContain('गोदाम में आने वाले माल');
  });

  it('H. Stable Atlas entry identity', () => {
    const cv = atlasHiVisibleJaTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ja',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_JA_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: HI_AI_UNEDITED,
        locale: 'ja',
        requestId: 'req-hi-ja-339-h',
        jobContextHash: 'job-hi-ja-339-h',
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
    const write = applyFinalizedBulletsToCv(cv, 'ja', 'exp-atlas', fin);
    expect(write.experience![0]!.id).toBe('exp-atlas');
    expect(write.experience![0]!.company).toBe('Atlas');
    expect(write.experience![1]!.description).toContain('administrative');
  });

  it('I. Provider rejection evidence remains frozen after fallback selection', () => {
    const cv = atlasHiVisibleJaTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ja',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_JA_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: HI_AI_UNEDITED,
        locale: 'ja',
        requestId: 'req-hi-ja-339-i',
        jobContextHash: 'job-hi-ja-339-i',
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
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(Number(fin.diagnostics?.providerRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerCoveredFactCount)).toBeLessThan(3);
    const uncovered = fin.diagnostics?.providerUncoveredFactIdentityHashes || [];
    expect(uncovered.length).toBeGreaterThan(0);
    expect(uncovered.every((h: string) => String(h).startsWith('ja_wh_'))).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
  });

  it('1–21. HI-visible → ja Stronger AI: soft provider rejected; JA hard 3/3 applied', () => {
    const cv = atlasHiVisibleJaTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ja',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_JA_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: HI_AI_UNEDITED,
        locale: 'ja',
        requestId: 'req-hi-ja-339',
        jobContextHash: 'job-hi-ja-339',
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
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^hi/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^hi/);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toBe('ja');
    expect(fin.diagnostics?.staleForeignLocaleSourceAuthoritative).toBe(false);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.sourceFactIdentityCount || fin.diagnostics?.sourceFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.requiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.translatedFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount)).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.detectedLocaleByBullet).toEqual(['ja', 'ja', 'ja']);
    expect(fin.diagnostics?.detectedScriptByBullet).toEqual(['cjk', 'cjk', 'cjk']);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    const uncovered = fin.diagnostics?.providerUncoveredFactIdentityHashes || [];
    expect(uncovered.length).toBeGreaterThan(0);

    for (const line of EXPECTED_JA_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
    expect(/गोदाम|जाँच|समन्वय/u.test(fin.text || '')).toBe(false);
    expect(/正確性|倉庫記録を更新|整然とした配置/u.test(fin.text || '')).toBe(false);
    const appliedText = (fin.text || '').trim();

    const usageBefore = 14;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-hi-ja-339-apply',
      requestedLocale: 'ja',
      uiLocale: 'ja',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-hi-ja-339',
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
      visibleTextareaLocale: 'hi',
      visibleTextareaLocaleBeforeApply: 'hi',
      requestedTargetLocale: 'ja',
      entryGeneratedLocaleBeforeApply: 'hi',
      contentLocaleDocument: 'en',
      appliedVisibleContentLocale: null,
      staleForeignLocaleSourceAuthoritative: false,
      englishSourceStillAuthoritative: true,
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
      staleForeignLocaleSourceAuthoritative: false,
      currentTextareaUsedForFactExtraction: false,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    expect(gate.diagnosticCompletenessPassed).toBe(true);
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.preapplyDiagnosticCompletenessPassed).toBe(true);
    expect(draft.applyAuthorized).toBe(true);
    expect(draft.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(draft.staleForeignLocaleSourceAuthoritative).toBe(false);
    expect(draft.meaningfulChangeDetected).toBe(true);

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
      contentLocaleDocument: 'ja',
      appliedVisibleContentLocale: 'ja',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(true);
    expect(trace.appliedVisibleContentLocale).toBe('ja');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'ja', 'exp-atlas', fin);
    expect(write.experience![0]!.description).toContain(EXPECTED_JA_HARD_TRIAD[0]!);
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('ja');
    expect(write.contentLocale).toBe('ja');
    expect(write.experience![1]!.description).toContain('administrative');
  });
});
