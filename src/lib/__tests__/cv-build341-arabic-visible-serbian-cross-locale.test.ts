/**
 * @vitest-environment jsdom
 *
 * AAB-341 — Arabic-visible → Serbian Experience cross-locale:
 * EN pre_ai fact authority + unedited Arabic AI textarea + sr target must
 * accept a genuinely complete Serbian provider triad (3/3 facts + predicates),
 * reject soft merged SR shells (2 real duties → required=2), keep
 * wrong_locale_fixed only, and commit once with transactional rollback safety.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  SERBIAN_EXPERIENCE_GROUNDING_341_REVISION,
  validateSerbianWarehouseExperienceCoverage,
  scanSerbianWarehousePredicates,
  buildSerbianWarehouseExperienceFallback,
  serbianWarehouseFactDiagId,
  sourceRequiresSerbianWarehouseFactCoverage,
} from '@/lib/cv-serbian-experience-grounding';
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

/** Accepted Arabic hard triad already visible on device (AAB 341 lineage). */
const AR_AI_UNEDITED = [
  'تفحص البضائع الواردة إلى المستودع.',
  'تتحقق من المستندات المتعلقة بالبضائع المستلمة.',
  'تنسق مع الزملاء لإعداد البضائع ونقلها.',
].join('\n');

/**
 * Exact AAB-341 device Serbian provider triad.
 * Unit hashes: fnv1a_80bcb134 / fnv1a_5288e5a0 / fnv1a_ff33f360
 * Final (bullet-formatted, space-normalized): fnv1a_15c96118
 * Scripts: latin / latin_diacritic / latin_diacritic
 */
const DEVICE_SR_PROVIDER = [
  'Proverava pristiglu robu.',
  'Proverava prateću dokumentaciju.',
  'Sarađuje sa kolegama na pripremi i premeštanju robe.',
].join('\n');

/**
 * Soft SR shells that collapse 3→2 (merged goods+docs + invented records).
 * Not the device provider — used to prove incomplete rejection + hard recovery.
 */
const DEVICE_SOFT_SR_SHELL = [
  'Proverava pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.',
  'Ažurira skladišnu evidenciju i vodi računa o urednom rasporedu robe.',
  'Koordiniše pripremu i kretanje robe u saradnji sa kolegama.',
].join('\n');

const EXPECTED_SR_HARD_TRIAD = [
  'Proverava robu koja pristiže u skladište.',
  'Proverava dokumentaciju povezanu sa primljenom robom.',
  'Koordinira sa kolegama pripremu i premeštanje robe.',
];

function atlasArVisibleSrTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: AR_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'ar',
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
    description: AR_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'ar',
    generatedDescription: AR_AI_UNEDITED,
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
    id: 'cv-ar-sr-341',
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

describe('AAB-341 Arabic-visible → Serbian Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Serbian grounding revision for packaging', () => {
    expect(SERBIAN_EXPERIENCE_GROUNDING_341_REVISION).toBe(
      'serbian-experience-grounding-341-v1',
    );
  });

  it('A. Exact AAB-341 device lineage: AR visible → SR target, EN pre_ai source', () => {
    expect(sourceRequiresSerbianWarehouseFactCoverage(EN_ORIGINAL)).toBe(true);
    const provider = validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SR_PROVIDER);
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

  it('B. Captured Serbian provider hashes and scripts match device evidence', () => {
    const units = splitExperienceBullets(DEVICE_SR_PROVIDER);
    expect(units).toHaveLength(3);
    expect(fingerprintText(units[0]!)).toBe('fnv1a_80bcb134_l25_b80_e46');
    expect(fingerprintText(units[1]!)).toBe('fnv1a_5288e5a0_l32_b80_e46');
    expect(fingerprintText(units[2]!)).toBe('fnv1a_ff33f360_l52_b83_e46');
    const formatted = formatExperienceBullets(units);
    expect(fingerprintText(formatted.replace(/\s+/g, ' ').trim())).toBe(
      'fnv1a_15c96118_l117_b8226_e46',
    );
    const purity = validateAiUnitLocalePurity(DEVICE_SR_PROVIDER, 'sr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.detectedLocaleByUnit).toEqual(['sr', 'sr', 'sr']);
    expect(purity.detectedScriptByUnit).toEqual([
      'latin',
      'latin_diacritic_sc',
      'latin_diacritic_sc',
    ]);
    expect(purity.wrongScriptUnitCount).toBe(0);
  });

  it('C–D. Real Serbian fact separation and predicate completeness', () => {
    const cov = validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SR_PROVIDER);
    expect(cov.ok).toBe(true);
    expect(cov.covered).toEqual([
      'incoming_goods_check',
      'document_check',
      'goods_prep_movement_colleagues',
    ]);
    const pred = scanSerbianWarehousePredicates(EN_ORIGINAL, DEVICE_SR_PROVIDER);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(pred.finalCandidatePredicateValidationApplicable).toBe(true);
  });

  it('E. A merged goods/documentation sentence cannot cover both duties', () => {
    const mergedOnly = [
      'Proverava pristiglu robu i prateću dokumentaciju radi tačnog evidentiranja.',
      'Koordiniše pripremu i kretanje robe u saradnji sa kolegama.',
    ].join('\n');
    const cov = validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, mergedOnly);
    expect(cov.ok).toBe(false);
    expect(cov.covered).not.toContain('incoming_goods_check');
    expect(cov.covered).not.toContain('document_check');
  });

  it('F. Exact provider is accepted only on real 3/3 facts and predicates', () => {
    const cv = atlasArVisibleSrTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: DEVICE_SR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: AR_AI_UNEDITED,
        locale: 'sr',
        requestId: 'req-ar-sr-341-f',
        jobContextHash: 'job-ar-sr-341-f',
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

  it('G. Soft incomplete SR shell is rejected with frozen sr_wh_* evidence + hard recovery', () => {
    const soft = validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, DEVICE_SOFT_SR_SHELL);
    expect(soft.ok).toBe(false);
    expect(soft.covered.length).toBeLessThan(3);
    expect(soft.uncovered.map((id) => serbianWarehouseFactDiagId(id)).every(
      (h) => h.startsWith('sr_wh_'),
    )).toBe(true);

    const cv = atlasArVisibleSrTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: DEVICE_SOFT_SR_SHELL,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: AR_AI_UNEDITED,
        locale: 'sr',
        requestId: 'req-ar-sr-341-g',
        jobContextHash: 'job-ar-sr-341-g',
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
    expect(uncovered.every((h: string) => String(h).startsWith('sr_wh_'))).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.fallbackRequiredFactCount
      ?? fin.diagnostics?.clientDeterministicFallbackRequiredFactCount)).toBe(3);
    for (const line of EXPECTED_SR_HARD_TRIAD) {
      expect(fin.text || '').toContain(line);
    }
  });

  it('H. Hard Serbian fallback recovers 3/3 for all genders', () => {
    const hard = buildSerbianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    for (const line of EXPECTED_SR_HARD_TRIAD) {
      expect(hard).toContain(line);
    }
    expect(validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, hard).ok).toBe(true);
    const male = buildSerbianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'male',
    });
    const unspecified = buildSerbianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'unspecified',
    });
    expect(validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, male).ok).toBe(true);
    expect(validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, unspecified).ok).toBe(true);
    expect(male).toContain(EXPECTED_SR_HARD_TRIAD[0]!);
  });

  it('I. translatedFactCount is 3 for complete Serbian candidates', () => {
    const fallback = buildSerbianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
      gender: 'female',
    });
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
    expect(countTranslatedFactUnits(EN_ORIGINAL, DEVICE_SR_PROVIDER)).toBe(3);
    expect(countTranslatedFactUnits(EN_ORIGINAL, DEVICE_SOFT_SR_SHELL)).toBeLessThan(3);
  });

  it('J. Arabic 3/3 → Serbian 3/3 gives wrong_locale_fixed only', () => {
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: AR_AI_UNEDITED,
      candidateText: DEVICE_SR_PROVIDER,
      locale: 'sr',
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
    expect(evalVis.finalDecisionKind).toBe('material_improvement');
    expect(evalVis.finalMatchesVisibleComparisonAfterNormalization).toBe(false);
    expect(evalVis.finalSemanticallyEquivalentToVisibleComparison).toBe(false);
  });

  it('K. Serbian Latin/diacritic locale and script purity', () => {
    const purity = validateAiUnitLocalePurity(DEVICE_SR_PROVIDER, 'sr', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.detectedLocaleByUnit).toEqual(['sr', 'sr', 'sr']);
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBe(0);
    expect(purity.wrongScriptUnitCount).toBe(0);
    expect(purity.mixedLanguageUnitCount).toBe(0);
    expect(purity.sourceLanguageLeakageDetected).toBe(false);
    expect(purity.detectedScriptByUnit.every((s) =>
      s === 'latin' || s === 'latin_diacritic_sc')).toBe(true);
  });

  it('L–O. Full phased apply commits Atlas only; usage +1; rollback preserves Arabic', () => {
    const cv = atlasArVisibleSrTargetCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'sr',
      gender: 'female',
      cv,
      candidate: DEVICE_SR_PROVIDER,
      experienceId: 'exp-atlas',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: AR_AI_UNEDITED,
        locale: 'sr',
        requestId: 'req-ar-sr-341',
        jobContextHash: 'job-ar-sr-341',
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
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^ar/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^ar/);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toBe('sr');
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
    expect(fin.diagnostics?.detectedLocaleByBullet).toEqual(['sr', 'sr', 'sr']);
    expect(fin.diagnostics?.detectedScriptByBullet).toEqual([
      'latin',
      'latin_diacritic',
      'latin_diacritic',
    ]);
    expect(Number(fin.diagnostics?.wrongLocaleBulletCount || 0)).toBe(0);
    expect(Number(fin.diagnostics?.wrongScriptBulletCount || 0)).toBe(0);
    expect(Number(fin.diagnostics?.mixedLanguageBulletCount || 0)).toBe(0);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds).toEqual(['wrong_locale_fixed']);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);

    expect(fin.text || '').toContain('Proverava pristiglu robu.');
    expect(fin.text || '').toContain('Proverava prateću dokumentaciju.');
    expect(fin.text || '').toContain('Sarađuje sa kolegama na pripremi i premeštanju robe.');
    expect(/البضائع|المستندات|الزملاء/u.test(fin.text || '')).toBe(false);
    expect(/tačnog evidentiranja|skladišnu evidenciju|urednom rasporedu/iu.test(fin.text || '')).toBe(false);

    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: fin.text || '',
      sourceDescription: EN_ORIGINAL,
      targetLocale: 'sr',
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
    const usageBefore = 16;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-ar-sr-341-apply',
      requestedLocale: 'sr',
      uiLocale: 'sr',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-ar-sr-341',
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
      visibleTextareaLocale: 'ar',
      visibleTextareaLocaleBeforeApply: 'ar',
      requestedTargetLocale: 'sr',
      entryGeneratedLocaleBeforeApply: 'ar',
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
      crossLocaleOperation: true,
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
      contentLocaleDocument: 'sr',
      appliedVisibleContentLocale: 'sr',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(true);
    expect(trace.appliedVisibleContentLocale).toBe('sr');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);

    const write = applyFinalizedBulletsToCv(cv, 'sr', 'exp-atlas', fin);
    expect(write.experience![0]!.id).toBe('exp-atlas');
    expect(write.experience![0]!.company).toBe('Atlas');
    expect(write.experience![0]!.description).toContain('Proverava pristiglu robu.');
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('sr');
    expect(write.contentLocale).toBe('sr');
    expect(write.experience![1]!.description).toContain('administrative');

    // N. Rejection preserves Arabic text and usage
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
    const cvReject = atlasArVisibleSrTargetCv();
    const beforeDesc = cvReject.experience![0]!.description;
    const beforeGen = (cvReject.experience![0] as WorkExperience & { generatedLocale?: string })
      .generatedLocale;
    const applied = applyFinalizedBulletsToCv(
      cvReject,
      'sr',
      'exp-atlas',
      rejectedFinalize as never,
    );
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
    expect(applied.experience![0]!.description).toContain('البضائع الواردة');
    expect(beforeGen).toBe('ar');
  });

  it('predicate stage/diagnostic consistency: vacuous null cannot pass as ok', () => {
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
      requestedTargetLocale: 'sr',
      finalCandidateSource: 'provider',
    } as never);
    expect(inv.failures.map((f) => f.invariantCode)).toContain(
      'final_predicate_coverage_vacuous_or_null',
    );

    const okInv = checkExperienceDiagnosticInvariants({
      materialImprovementKinds: ['wrong_locale_fixed'],
      finalDecisionKind: 'material_improvement',
      meaningfulChangeDetected: true,
      finalCandidatePredicateValidationApplicable: true,
      finalCandidatePredicateIdentityCount: 3,
      finalSourceUnitPredicateCoveragePassed: true,
      finalRequiredFactCount: 3,
      finalFactCoveragePassed: true,
      applyAuthorized: true,
      requestedTargetLocale: 'sr',
      finalCandidateSource: 'provider',
    } as never);
    expect(okInv.failures.map((f) => f.invariantCode)).not.toContain(
      'final_predicate_coverage_vacuous_or_null',
    );
  });

  it('unsupported inventory/accuracy/organization claims are rejected', () => {
    const invented = [
      'Proverava robu koja pristiže u skladište.',
      'Ažurira skladišnu evidenciju i vodi računa o urednom rasporedu robe.',
      'Koordinira sa kolegama pripremu i premeštanje robe.',
    ].join('\n');
    const cov = validateSerbianWarehouseExperienceCoverage(EN_ORIGINAL, invented);
    expect(cov.ok).toBe(false);
    expect(cov.uncovered.length).toBeGreaterThan(0);
  });
});
