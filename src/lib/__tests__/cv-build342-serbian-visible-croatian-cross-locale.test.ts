/**
 * @vitest-environment jsdom
 *
 * AAB-342 — Serbian-visible → Croatian Experience cross-locale:
 * EN pre_ai fact authority + unedited Serbian AI textarea + hr target must
 * accept a genuinely complete Croatian provider triad (3/3 facts + predicates),
 * reject soft merged HR shells (2 real duties → required=2), keep
 * wrong_locale_fixed only with meaningfulChangeDetected=true,
 * sourceAlreadyValidForTarget=false, and commit once with transactional rollback.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  CROATIAN_EXPERIENCE_GROUNDING_342_REVISION,
  validateCroatianWarehouseExperienceCoverage,
  scanCroatianWarehousePredicates,
  buildCroatianWarehouseExperienceFallback,
  croatianWarehouseFactDiagId,
  sourceRequiresCroatianWarehouseFactCoverage,
} from '@/lib/cv-croatian-experience-grounding';
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
import { analyzeExperienceVisibleSource } from '@/lib/cv-experience-visible-source-analysis';
import { isCrossLocaleOperation, localesEquivalent } from '@/lib/cv-content-locale';

const REF = '2026-07-26';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

/** Accepted Serbian hard triad already visible on device (AAB 342 lineage). */
const SR_AI_UNEDITED = [
  'Proverava pristiglu robu.',
  'Proverava prateću dokumentaciju.',
  'Sarađuje sa kolegama na pripremi i premeštanju robe.',
].join('\n');

/**
 * Complete Croatian provider triad (HR lexical forms of the SR device provider).
 * Independently covers incoming goods, documentation, and colleague prep/movement.
 * Device unit hashes (fnv1a_dba06064 / de65d670 / a6cd7f55) were not recoverable
 * from local dumps; this triad is the validated complete 3/3 shape.
 */
const DEVICE_HR_PROVIDER = [
  'Provjerava pristiglu robu.',
  'Provjerava prateću dokumentaciju.',
  'Surađuje s kolegama na pripremi i premještanju robe.',
].join('\n');

/**
 * Soft HR shells that collapse 3→2 (merged goods+docs + invented records).
 * Not a safe provider — used to prove incomplete rejection + hard recovery.
 */
const DEVICE_SOFT_HR_SHELL = [
  'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
  'Ažurira skladišnu evidenciju te održava uredno i organizirano skladištenje robe.',
  'Surađuje s kolegama pri pripremi i premještanju robe unutar skladišta.',
].join('\n');

const EXPECTED_HR_HARD_TRIAD = [
  'Provjerava robu koja pristiže u skladište.',
  'Provjerava dokumentaciju povezanu s primljenom robom.',
  'Surađuje s kolegama na pripremi i premještanju robe.',
];

function atlasSrVisibleHrTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: SR_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'sr',
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
    description: SR_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'sr',
    generatedDescription: SR_AI_UNEDITED,
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
    id: 'cv-sr-hr-342',
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

describe('AAB-342 Serbian-visible → Croatian Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Croatian grounding revision for packaging', () => {
    expect(CROATIAN_EXPERIENCE_GROUNDING_342_REVISION).toBe(
      'croatian-experience-grounding-342-v1',
    );
  });

  it('A. Exact AAB-342 device lineage: SR visible → HR target, EN pre_ai source', () => {
    expect(sourceRequiresCroatianWarehouseFactCoverage(EN_ORIGINAL)).toBe(true);
    expect(localesEquivalent('sr', 'hr')).toBe(false);
    expect(isCrossLocaleOperation('sr', 'hr')).toBe(true);
    const provider = validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_HR_PROVIDER);
    expect(provider.required.length).toBe(3);
    expect(provider.required).toEqual([
      'incoming_goods_check',
      'document_check',
      'goods_prep_movement_colleagues',
    ]);
    expect(provider.ok).toBe(true);
    expect(provider.covered.length).toBe(3);
    expect(provider.uncovered).toEqual([]);
  });

  it('B. Captured Croatian provider preserves three independent warehouse duties', () => {
    const units = DEVICE_HR_PROVIDER.split('\n');
    expect(units).toHaveLength(3);
    expect(units[0]).toMatch(/Provjerava.*pristiglu\s+robu/i);
    expect(units[1]).toMatch(/Provjerava.*prateću\s+dokumentaciju/i);
    expect(units[2]).toMatch(/Surađuje\s+s\s+kolegama.*priprem.*premještanj/i);
    expect(DEVICE_HR_PROVIDER).not.toMatch(/\bproverava\b|\bsarađuje\b|\bsa\s+kolegama\b|\bpremeštanj/i);
    expect(DEVICE_HR_PROVIDER).not.toMatch(/ažurira|evidencij|uredn|organiziran|točnost|kvalitet|sigurnost|efikasnost/i);
    const cov = validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_HR_PROVIDER);
    expect(cov.ok).toBe(true);
  });

  it('C–D. Real Croatian fact separation and predicate completeness', () => {
    const cov = validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_HR_PROVIDER);
    expect(cov.ok).toBe(true);
    expect(cov.covered).toEqual([
      'incoming_goods_check',
      'document_check',
      'goods_prep_movement_colleagues',
    ]);
    const pred = scanCroatianWarehousePredicates(EN_ORIGINAL, DEVICE_HR_PROVIDER);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
  });

  it('E. A merged goods/documentation sentence cannot cover both duties', () => {
    const mergedOnly = [
      'Provjerava točnost zaprimljene robe i prateće dokumentacije.',
      'Surađuje s kolegama na pripremi i premještanju robe.',
    ].join('\n');
    const cov = validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, mergedOnly);
    expect(cov.ok).toBe(false);
    expect(cov.covered).not.toContain('incoming_goods_check');
    expect(cov.covered).not.toContain('document_check');
  });

  it('F. Exact provider is accepted only on real 3/3 facts and predicates', () => {
    const cv = atlasSrVisibleHrTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hr',
      gender: 'female',
      cv,
      candidate: DEVICE_HR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SR_AI_UNEDITED,
        locale: 'hr',
        requestId: 'req-sr-hr-342-f',
        jobContextHash: 'job-sr-hr-342-f',
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
    expect(fin.diagnostics?.providerAccepted).toBe(true);
    expect(Number(fin.diagnostics?.providerRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.providerUncoveredFactIdentityHashes || []).toEqual([]);
    expect(Number(fin.diagnostics?.providerCandidatePredicateIdentityCount)).toBe(3);
    expect(fin.diagnostics?.providerSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('provider');
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount)).toBe(0);
  });

  it('G. Soft incomplete HR shell is rejected with frozen hr_wh_* evidence + hard recovery', () => {
    const soft = validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_HR_SHELL);
    expect(soft.ok).toBe(false);
    expect(soft.covered.length).toBeLessThan(3);
    expect(soft.uncovered.map((id) => croatianWarehouseFactDiagId(id)).every(
      (h) => h.startsWith('hr_wh_'),
    )).toBe(true);

    const cv = atlasSrVisibleHrTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hr',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_HR_SHELL,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SR_AI_UNEDITED,
        locale: 'hr',
        requestId: 'req-sr-hr-342-g',
        jobContextHash: 'job-sr-hr-342-g',
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
    expect(uncovered.every((h: string) => String(h).startsWith('hr_wh_'))).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.fallbackRequiredFactCount
      ?? fin.diagnostics?.clientDeterministicFallbackRequiredFactCount)).toBe(3);
    for (const line of EXPECTED_HR_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
  });

  it('H. Hard Croatian fallback recovers 3/3 for all genders', () => {
    const hard = buildCroatianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    for (const line of EXPECTED_HR_HARD_TRIAD) {
      expect(hard).toContain(line);
    }
    expect(hard).not.toMatch(/\bproverava\b|\bsarađuje\b|\bsa\s+kolegama\b|\bpremeštanj/i);
    expect(validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, hard).ok).toBe(true);
    const male = buildCroatianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'male',
    });
    const unspecified = buildCroatianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'unspecified',
    });
    expect(validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, male).ok).toBe(true);
    expect(validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, unspecified).ok).toBe(true);
    expect(male).toContain(EXPECTED_HR_HARD_TRIAD[0]!);
  });

  it('I. translatedFactCount is 3 for complete Croatian candidates', () => {
    const fallback = buildCroatianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
    expect(countTranslatedFactUnits(EN_ORIGINAL, DEVICE_HR_PROVIDER)).toBe(3);
    expect(countTranslatedFactUnits(EN_ORIGINAL, DEVICE_SOFT_HR_SHELL)).toBeLessThan(3);
  });

  it('J–L. Serbian 3/3 → Croatian 3/3: wrong_locale_fixed, meaningful change, not already-valid', () => {
    const sourceAnalysis = analyzeExperienceVisibleSource({
      visibleText: SR_AI_UNEDITED,
      targetLocale: 'hr',
      storedLocale: 'sr',
      isPresent: true,
    });
    expect(sourceAnalysis.sourceAlreadyValidForTarget).toBe(false);
    expect(sourceAnalysis.localeMismatchCount).toBe(1);

    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: SR_AI_UNEDITED,
      candidateText: DEVICE_HR_PROVIDER,
      locale: 'hr',
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
    expect(evalVis.materialImprovementDetected).toBe(true);
    expect(evalVis.finalDecisionKind).toBe('material_improvement');
    expect(evalVis.finalMatchesVisibleComparisonAfterNormalization).toBe(false);
    expect(evalVis.finalSemanticallyEquivalentToVisibleComparison).toBe(false);
  });

  it('M. englishSourceStillAuthoritative stays true for EN pre_ai + SR visible', () => {
    const cv = atlasSrVisibleHrTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hr',
      gender: 'female',
      cv,
      candidate: DEVICE_HR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SR_AI_UNEDITED,
        locale: 'hr',
        requestId: 'req-sr-hr-342-m',
        jobContextHash: 'job-sr-hr-342-m',
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
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(fin.diagnostics?.englishSourceStillAuthoritative).toBe(true);
    expect(fin.diagnostics?.staleForeignLocaleSourceAuthoritative).toBe(false);
  });

  it('N. Croatian lexical purity rejects Serbian leakage', () => {
    const purity = validateAiUnitLocalePurity(DEVICE_HR_PROVIDER, 'hr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.detectedLocaleByUnit).toEqual(['hr', 'hr', 'hr']);
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBe(0);
    expect(purity.wrongScriptUnitCount).toBe(0);
    expect(purity.mixedLanguageUnitCount).toBe(0);
    expect(purity.sourceLanguageLeakageDetected).toBe(false);
    expect(purity.detectedScriptByUnit.every((s) =>
      s === 'latin' || s === 'latin_diacritic_sc' || s === 'latin_diacritic')).toBe(true);

    const leaked = [
      'Proverava pristiglu robu.',
      'Proverava prateću dokumentaciju.',
      'Sarađuje sa kolegama na pripremi i premeštanju robe.',
    ].join('\n');
    const leakedPurity = validateAiUnitLocalePurity(leaked, 'hr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(
      leakedPurity.targetLocalePurityPassed === false
      || leakedPurity.sourceLanguageLeakageDetected === true
      || (leakedPurity.croatianLocaleEvidencePassed === false),
    ).toBe(true);
  });

  it('O–R. Full phased apply commits Atlas only; usage +1; rollback preserves Serbian', () => {
    const cv = atlasSrVisibleHrTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'hr',
      gender: 'female',
      cv,
      candidate: DEVICE_HR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SR_AI_UNEDITED,
        locale: 'hr',
        requestId: 'req-sr-hr-342',
        jobContextHash: 'job-sr-hr-342',
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
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^sr/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^sr/);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toBe('hr');
    expect(fin.diagnostics?.staleForeignLocaleSourceAuthoritative).toBe(false);
    expect(fin.diagnostics?.englishSourceStillAuthoritative).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('provider');
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
    expect(fin.diagnostics?.detectedLocaleByBullet).toEqual(['hr', 'hr', 'hr']);
    expect(Number(fin.diagnostics?.wrongLocaleBulletCount || 0)).toBe(0);
    expect(Number(fin.diagnostics?.wrongScriptBulletCount || 0)).toBe(0);
    expect(Number(fin.diagnostics?.mixedLanguageBulletCount || 0)).toBe(0);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.sourceAlreadyValidForTarget).toBe(false);

    expect(fin.text || '').toContain('Provjerava pristiglu robu.');
    expect(fin.text || '').toContain('Provjerava prateću dokumentaciju.');
    expect(fin.text || '').toContain('Surađuje s kolegama na pripremi i premještanju robe.');
    expect(/\bproverava\b|\bsarađuje\b|\bsa\s+kolegama\b|\bpremeštanj/i.test(fin.text || '')).toBe(false);
    expect(/točnost|skladišnu evidenciju|organiziran/iu.test(fin.text || '')).toBe(false);

    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: fin.text || '',
      sourceDescription: EN_ORIGINAL,
      targetLocale: 'hr',
      candidateKind: 'provider',
      source: 'provider',
      employmentState: 'current',
      meaningfulChangeDetected: true,
    });
    expect(snap.requiredFactCount).toBe(3);
    expect(snap.coveredFactCount).toBe(3);
    expect(snap.factCoveragePassed).toBe(true);
    expect(snap.sourcePredicateIdentityCount).toBe(3);
    expect(snap.candidatePredicateIdentityCount).toBe(3);
    expect(snap.predicateCoveragePassed).toBe(true);

    const appliedText = (fin.text || '').trim();
    const usageBefore = 17;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-sr-hr-342-apply',
      requestedLocale: 'hr',
      uiLocale: 'hr',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-sr-hr-342',
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
      visibleTextareaLocale: 'sr',
      visibleTextareaLocaleBeforeApply: 'sr',
      requestedTargetLocale: 'hr',
      entryGeneratedLocaleBeforeApply: 'sr',
      contentLocaleDocument: 'en',
      appliedVisibleContentLocale: null,
      staleForeignLocaleSourceAuthoritative: false,
      englishSourceStillAuthoritative: true,
      visibleLocaleMetadataMismatchRecorded: false,
      sourceAlreadyValidForTarget: false,
      meaningfulChangeDetected: true,
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
      crossLocaleOperation: true,
      staleForeignLocaleSourceAuthoritative: false,
      currentTextareaUsedForFactExtraction: false,
      englishSourceStillAuthoritative: true,
      sourceAlreadyValidForTarget: false,
      meaningfulChangeDetected: true,
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
      contentLocaleDocument: 'hr',
      appliedVisibleContentLocale: 'hr',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(true);
    expect(trace.appliedVisibleContentLocale).toBe('hr');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'hr', 'exp-atlas', fin);
    expect(write.experience![0]!.id).toBe('exp-atlas');
    expect(write.experience![0]!.company).toBe('Atlas');
    expect(write.experience![0]!.description).toContain('Provjerava pristiglu robu.');
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('hr');
    expect(write.contentLocale).toBe('hr');
    expect(write.experience![1]!.description).toContain('administrative');

    // Q. Rejection preserves Serbian text and usage
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
    const cvReject = atlasSrVisibleHrTargetCv();
    const beforeDesc = cvReject.experience![0]!.description;
    const beforeGen = (cvReject.experience![0] as WorkExperience & { generatedLocale?: string })
      .generatedLocale;
    const applied = applyFinalizedBulletsToCv(
      cvReject,
      'hr',
      'exp-atlas',
      rejectedFinalize as never,
    );
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
    expect(applied.experience![0]!.description).toContain('Proverava pristiglu robu.');
    expect(beforeGen).toBe('sr');
  });

  it('predicate stage/diagnostic consistency: vacuous null cannot pass as ok for hr', () => {
    const inv = checkExperienceDiagnosticInvariants({
      materialImprovementKinds: ['wrong_locale_fixed'],
      finalDecisionKind: 'material_improvement',
      meaningfulChangeDetected: true,
      finalCandidatePredicateValidationApplicable: true,
      finalCandidatePredicateIdentityCount: 0,
      finalSourceUnitPredicateCoveragePassed: null,
      finalRequiredFactCount: 3,
      finalFactCoveragePassed: true,
      applyAuthorized: true,
      requestedTargetLocale: 'hr',
      finalCandidateSource: 'provider',
    } as never);
    expect(inv.failures.map((f) => f.invariantCode)).toContain(
      'final_predicate_coverage_vacuous_or_null',
    );

    const authInv = checkExperienceDiagnosticInvariants({
      factAuthorityKind: 'pre_ai_snapshot',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      authoritativeFactSourceLocale: 'en',
      factAuthorityMatchesAuthoritativeSourceKind: true,
      englishSourceStillAuthoritative: false,
      materialImprovementKinds: ['wrong_locale_fixed'],
      finalDecisionKind: 'material_improvement',
      meaningfulChangeDetected: true,
      finalCandidatePredicateIdentityCount: 3,
      finalSourceUnitPredicateCoveragePassed: true,
      finalRequiredFactCount: 3,
      finalFactCoveragePassed: true,
      applyAuthorized: true,
      requestedTargetLocale: 'hr',
      finalCandidateSource: 'provider',
    } as never);
    expect(authInv.failures.map((f) => f.invariantCode)).toContain(
      'english_source_authority_flag_contradiction',
    );
  });

  it('unsupported inventory/accuracy/organization claims are rejected', () => {
    const invented = [
      'Provjerava robu koja pristiže u skladište.',
      'Ažurira skladišnu evidenciju te održava uredno i organizirano skladištenje robe.',
      'Surađuje s kolegama na pripremi i premještanju robe.',
    ].join('\n');
    const cov = validateCroatianWarehouseExperienceCoverage(EN_ORIGINAL, invented);
    expect(cov.ok).toBe(false);
    expect(cov.uncovered.length).toBeGreaterThan(0);
  });
});
