/**
 * @vitest-environment jsdom
 *
 * AAB-340 — Japanese-visible → Arabic Experience cross-locale:
 * EN pre_ai fact authority + unedited Japanese AI textarea + ar target must
 * reject the merged soft Arabic provider triad (2 real duties → required=2),
 * select a hard Arabic 3/3 warehouse fallback, pass preapply predicates,
 * freeze provider rejection evidence, keep wrong_locale_fixed only, and commit
 * once without rewriting the Japanese visible text on rejection.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  ARABIC_EXPERIENCE_GROUNDING_340_REVISION,
  validateArabicWarehouseExperienceCoverage,
  scanArabicWarehousePredicates,
  buildArabicWarehouseExperienceFallback,
  arabicWarehouseFactDiagId,
  sourceRequiresArabicWarehouseFactCoverage,
} from '@/lib/cv-arabic-experience-grounding';
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
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { splitExperienceBullets, formatExperienceBullets } from '@/lib/cv-canonical-facts';

const REF = '2026-07-26';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

/** Accepted Japanese hard triad already visible on device (AAB 339 lineage). */
const JA_AI_UNEDITED = [
  '倉庫に入荷する商品を確認します。',
  '受領した商品に関連する書類を確認します。',
  '商品の準備と移動について同僚と連携します。',
].join('\n');

/**
 * Device-equivalent soft AR provider/server-fallback triad (AAB 340).
 * Unit hashes: fnv1a_c571775b / fnv1a_308e8055 / fnv1a_9614d1e0
 * Final: fnv1a_2cf4472c
 * Bullet 1 merges incoming goods + documentation + accurate registration.
 * Bullet 2 invents warehouse-record update + goods organization.
 * Bullet 3 alone preserves colleague coordination.
 */
const DEVICE_SOFT_AR_PROVIDER = [
  'تتحقق من البضائع الواردة والوثائق المرفقة لضمان التسجيل الدقيق.',
  'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع.',
  'تنسّق إعداد البضائع وحركتها مع الزملاء.',
].join('\n');

const EXPECTED_AR_HARD_TRIAD = [
  'تفحص البضائع الواردة إلى المستودع.',
  'تتحقق من المستندات المتعلقة بالبضائع المستلمة.',
  'تنسق مع الزملاء لإعداد البضائع ونقلها.',
];

function atlasJaVisibleArTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: JA_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'ja',
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
    description: JA_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'ja',
    generatedDescription: JA_AI_UNEDITED,
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
    id: 'cv-ja-ar-340',
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

describe('AAB-340 Japanese-visible → Arabic Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Arabic grounding revision for packaging', () => {
    expect(ARABIC_EXPERIENCE_GROUNDING_340_REVISION).toBe(
      'arabic-experience-grounding-340-v1',
    );
  });

  it('A. Exact AAB-340 device lineage: JA visible → AR target, EN pre_ai source', () => {
    expect(sourceRequiresArabicWarehouseFactCoverage(EN_ORIGINAL)).toBe(true);
    const soft = validateArabicWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_AR_PROVIDER);
    expect(soft.required.length).toBe(3);
    expect(soft.required).toEqual([
      'incoming_goods_check',
      'document_check',
      'goods_prep_movement_colleagues',
    ]);
    expect(soft.ok).toBe(false);
    expect(soft.covered.length).toBeLessThan(3);
    expect(soft.uncovered.map((id) => arabicWarehouseFactDiagId(id)).every(
      (h) => h.startsWith('ar_wh_'),
    )).toBe(true);
  });

  it('B. Captured soft Arabic provider is rejected', () => {
    const purity = validateAiUnitLocalePurity(DEVICE_SOFT_AR_PROVIDER, 'ar', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.detectedLocaleByUnit).toEqual(['ar', 'ar', 'ar']);
    const cov = validateArabicWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_AR_PROVIDER);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBe(1);
    expect(cov.uncovered).toEqual(
      expect.arrayContaining(['incoming_goods_check', 'document_check']),
    );
    const pred = scanArabicWarehousePredicates(EN_ORIGINAL, DEVICE_SOFT_AR_PROVIDER);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
  });

  it('C. Hard female/current Arabic triad passes 3/3 facts', () => {
    const hard = buildArabicWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    for (const line of EXPECTED_AR_HARD_TRIAD) {
      expect(hard).toContain(line);
    }
    const hardCov = validateArabicWarehouseExperienceCoverage(EN_ORIGINAL, hard);
    expect(hardCov.ok).toBe(true);
    expect(hardCov.covered.length).toBe(3);
    expect(hardCov.uncovered).toEqual([]);

    const male = buildArabicWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'male',
    });
    const unspecified = buildArabicWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'unspecified',
    });
    expect(validateArabicWarehouseExperienceCoverage(EN_ORIGINAL, male).ok).toBe(true);
    expect(validateArabicWarehouseExperienceCoverage(EN_ORIGINAL, unspecified).ok).toBe(true);
    expect(male).toContain('يفحص البضائع الواردة إلى المستودع.');
    expect(unspecified).toContain(EXPECTED_AR_HARD_TRIAD[0]!);
  });

  it('D. Hard triad passes 3/3 predicates with zero additions', () => {
    const fallback = buildArabicWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    const pred = scanArabicWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.predicateFamiliesSource).toEqual([
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ]);
    expect(pred.predicateFamiliesCandidate).toEqual([
      'inspect_incoming',
      'verify_documentation',
      'coordinate_colleagues',
    ]);

    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: fallback,
      sourceDescription: EN_ORIGINAL,
      candidateKind: 'deterministic_fallback',
      source: 'deterministic_fallback',
      targetLocale: 'ar',
      employmentState: 'current',
      meaningfulChangeDetected: true,
    });
    expect(snap.requiredFactCount).toBe(3);
    expect(snap.coveredFactCount).toBe(3);
    expect(snap.sourcePredicateIdentityCount).toBe(3);
    expect(snap.candidatePredicateIdentityCount).toBe(3);
    expect(snap.predicateCoveragePassed).toBe(true);
  });

  it('E. Incoming and documentation cannot be merged into one fact', () => {
    const mergedOnly = [
      'تتحقق من البضائع الواردة والوثائق المرفقة.',
      'تنسق مع الزملاء لإعداد البضائع ونقلها.',
    ].join('\n');
    const cov = validateArabicWarehouseExperienceCoverage(EN_ORIGINAL, mergedOnly);
    expect(cov.ok).toBe(false);
    expect(cov.covered).not.toContain('incoming_goods_check');
    expect(cov.covered).not.toContain('document_check');
  });

  it('F. Unsupported record/accuracy/organization claims are rejected', () => {
    const invented = [
      'تفحص البضائع الواردة إلى المستودع.',
      'تحدّث سجلات المستودع وتحافظ على ترتيب البضائع لضمان التسجيل الدقيق.',
      'تنسق مع الزملاء لإعداد البضائع ونقلها.',
    ].join('\n');
    const cov = validateArabicWarehouseExperienceCoverage(EN_ORIGINAL, invented);
    expect(cov.ok).toBe(false);
    expect(cov.uncovered.length).toBeGreaterThan(0);
  });

  it('G. translatedFactCount is 3 for the hard triad', () => {
    const fallback = buildArabicWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
    expect(countTranslatedFactUnits(EN_ORIGINAL, DEVICE_SOFT_AR_PROVIDER)).toBeLessThan(3);
  });

  it('H. Provider uncovered ar_wh_* evidence remains frozen', () => {
    const cv = atlasJaVisibleArTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_AR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: JA_AI_UNEDITED,
        locale: 'ar',
        requestId: 'req-ja-ar-340-h',
        jobContextHash: 'job-ja-ar-340-h',
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
    expect(uncovered.every((h: string) => String(h).startsWith('ar_wh_'))).toBe(true);
    expect(uncovered).toEqual(
      expect.arrayContaining([
        'ar_wh_incoming_goods_check',
        'ar_wh_document_check',
      ]),
    );
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.fallbackRequiredFactCount
      ?? fin.diagnostics?.clientDeterministicFallbackRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.fallbackCoveredFactCount
      ?? fin.diagnostics?.clientDeterministicFallbackCoveredFactCount)).toBe(3);
  });

  it('I. Visible comparison reports wrong_locale_fixed only', () => {
    const fallback = buildArabicWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: JA_AI_UNEDITED,
      candidateText: fallback,
      locale: 'ar',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.degradationKinds).toEqual([]);
    expect(evalVis.materialImprovementDetected).toBe(true);
    expect(evalVis.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(evalVis.materialImprovementKinds).not.toContain('missing_fact_restored');
    expect(evalVis.semanticNoOpDetected).toBe(false);
  });

  it('J–L. Full phased apply commits only Atlas; locale ar after commit; usage +1', () => {
    const cv = atlasJaVisibleArTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_AR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: JA_AI_UNEDITED,
        locale: 'ar',
        requestId: 'req-ja-ar-340',
        jobContextHash: 'job-ja-ar-340',
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
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^ja/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^ja/);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toBe('ar');
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
    expect(fin.diagnostics?.finalUncoveredFactIdentityHashes || []).toEqual([]);
    expect(Number(fin.diagnostics?.sourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount)).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.detectedLocaleByBullet).toEqual(['ar', 'ar', 'ar']);
    expect(fin.diagnostics?.detectedScriptByBullet).toEqual(['arabic', 'arabic', 'arabic']);
    expect(Number(fin.diagnostics?.wrongLocaleBulletCount || 0)).toBe(0);
    expect(Number(fin.diagnostics?.wrongScriptBulletCount || 0)).toBe(0);
    expect(Number(fin.diagnostics?.mixedLanguageBulletCount || 0)).toBe(0);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);

    for (const line of EXPECTED_AR_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
    expect(/倉庫|確認します|同僚/u.test(fin.text || '')).toBe(false);
    expect(/التسجيل الدقيق|سجلات المستودع|ترتيب البضائع/u.test(fin.text || '')).toBe(false);

    const appliedText = (fin.text || '').trim();
    const usageBefore = 15;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-ja-ar-340-apply',
      requestedLocale: 'ar',
      uiLocale: 'ar',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-ja-ar-340',
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
      visibleTextareaLocale: 'ja',
      visibleTextareaLocaleBeforeApply: 'ja',
      requestedTargetLocale: 'ar',
      entryGeneratedLocaleBeforeApply: 'ja',
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
      contentLocaleDocument: 'ar',
      appliedVisibleContentLocale: 'ar',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(true);
    expect(trace.appliedVisibleContentLocale).toBe('ar');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'ar', 'exp-atlas', fin);
    expect(write.experience![0]!.id).toBe('exp-atlas');
    expect(write.experience![0]!.company).toBe('Atlas');
    expect(write.experience![0]!.description).toContain(EXPECTED_AR_HARD_TRIAD[0]!);
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('ar');
    expect(write.contentLocale).toBe('ar');
    expect(write.experience![1]!.description).toContain('administrative');
  });

  it('M. Rejection preserves Japanese text and usage', () => {
    const cv = atlasJaVisibleArTargetCv();
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
    const applied = applyFinalizedBulletsToCv(cv, 'ar', 'exp-atlas', rejectedFinalize as never);
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
    expect(applied.experience![0]!.description).toContain('倉庫に入荷する商品');
    expect(beforeGen).toBe('ja');
  });

  it('N. RTL text survives normalization, hashing, splitting, visible write, and re-read', () => {
    const hard = buildArabicWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    const bullets = splitExperienceBullets(hard);
    expect(bullets).toHaveLength(3);
    const roundTrip = formatExperienceBullets(bullets);
    expect(roundTrip).toContain(EXPECTED_AR_HARD_TRIAD[0]!);
    const hash = fingerprintText(roundTrip.replace(/\s+/g, ' ').trim());
    expect(hash.length).toBeGreaterThan(8);

    const cv = atlasJaVisibleArTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_AR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: JA_AI_UNEDITED,
        locale: 'ar',
        requestId: 'req-ja-ar-340-rtl',
        jobContextHash: 'job-ja-ar-340-rtl',
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
    const write = applyFinalizedBulletsToCv(cv, 'ar', 'exp-atlas', fin);
    const reread = splitExperienceBullets(write.experience![0]!.description || '');
    expect(reread).toHaveLength(3);
    expect(reread[0]).toContain('البضائع الواردة');
    expect(reread[1]).toContain('المستندات المتعلقة');
    expect(reread[2]).toContain('الزملاء');
    // No LTR reversal / bullet reorder of the hard triad.
    expect(reread[0]).toMatch(/^تفحص/);
    expect(reread[2]).toMatch(/^تنسق/);
  });

  it('meaningfulChange consistency with wrong_locale_fixed (invariant gate)', () => {
    const cv = atlasJaVisibleArTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_AR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: JA_AI_UNEDITED,
        locale: 'ar',
        requestId: 'req-ja-ar-340-inv',
        jobContextHash: 'job-ja-ar-340-inv',
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
      requestedTargetLocale: 'ar',
    } as never);
    expect(inv.failures.map((f) => f.invariantCode)).not.toContain(
      'wrong_locale_fixed_without_meaningful_change',
    );
    expect(inv.failures.map((f) => f.invariantCode)).not.toContain(
      'final_predicate_coverage_vacuous_or_null',
    );
    expect(inv.failures.map((f) => f.invariantCode)).not.toContain(
      'provider_rejection_evidence_overwritten',
    );
  });
});
