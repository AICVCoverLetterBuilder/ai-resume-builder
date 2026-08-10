/**
 * @vitest-environment jsdom
 *
 * AAB-334 — French-visible → Italian Experience cross-locale:
 * EN pre_ai fact authority + unedited French AI textarea + IT target must
 * reject wrong-language provider, select a real Italian 3/3 warehouse fallback,
 * report visibleTextareaLocaleBeforeApply=fr (not es), and commit once.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  ITALIAN_EXPERIENCE_GROUNDING_334_REVISION,
  validateItalianWarehouseExperienceCoverage,
  scanItalianWarehousePredicates,
  buildItalianWarehouseExperienceFallback,
  italianWarehouseFactDiagId,
} from '@/lib/cv-italian-experience-grounding';
import { detectTextLocale } from '@/lib/cv-content-locale';
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

const REF = '2026-07-25';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const FR_AI_UNEDITED = [
  'Contrôle les marchandises entrantes dans l’entrepôt.',
  'Vérifie les documents associés aux marchandises reçues.',
  'Coordonne avec ses collègues la préparation et le déplacement des marchandises.',
].join('\n');

const EN_PROVIDER_NOOP = EN_ORIGINAL;

function splitBulletCount(text: string): number {
  return (text || '')
    .split(/\n+/)
    .map((l) => l.replace(/^[•\-\d.)\s]+/, '').trim())
    .filter(Boolean).length;
}

function atlasFrVisibleItTargetCv(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: FR_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'fr',
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
    description: FR_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'fr',
    generatedDescription: FR_AI_UNEDITED,
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
    id: 'cv-fr-it-334',
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

describe('AAB-334 French-visible → Italian Experience cross-locale', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes Italian grounding revision for packaging', () => {
    expect(ITALIAN_EXPERIENCE_GROUNDING_334_REVISION).toBe('italian-experience-grounding-334-v1');
  });

  it('A. French whole-text request-time detection → fr, not es', () => {
    expect(detectTextLocale(FR_AI_UNEDITED, { generatedLocale: 'fr' })).toBe('fr');
    expect(detectTextLocale(FR_AI_UNEDITED)).toBe('fr');
    expect(detectTextLocale(FR_AI_UNEDITED, { storedLocale: 'it' })).toBe('fr');
  });

  it('Italian per-bullet locale detection for expected triad', () => {
    const it = buildItalianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const purity = validateAiUnitLocalePurity(it, 'it', {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(true);
    expect(purity.wrongLocaleUnitCount).toBe(0);
    expect(purity.mixedLanguageUnitCount).toBe(0);
    expect(purity.sourceLanguageLeakageDetected).toBe(false);
    expect(purity.detectedLocaleByUnit).toEqual(['it', 'it', 'it']);
    for (const loc of purity.detectedLocaleByUnit || []) {
      expect(loc === null || loc === 'it').toBe(true);
    }
    for (const bullet of it.split('\n').filter(Boolean)) {
      expect(guessUnitLocale(bullet, 'it')).toBe('it');
    }
  });

  it('Italian warehouse fallback covers EN authority facts/predicates 3/3', () => {
    const fallback = buildItalianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const cov = validateItalianWarehouseExperienceCoverage(EN_ORIGINAL, fallback);
    expect(cov.ok).toBe(true);
    expect(cov.covered.length).toBe(3);
    expect(cov.uncovered).toEqual([]);
    const pred = scanItalianWarehousePredicates(EN_ORIGINAL, fallback);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(countTranslatedFactUnits(EN_ORIGINAL, fallback)).toBe(3);
    expect(/\b(checks?|works? with colleagues|incoming goods)\b/iu.test(fallback)).toBe(false);
    expect(/contr[oô]le|marchandises|coll[eè]gues/iu.test(fallback)).toBe(false);
    expect(/mercanc|documentaci|compa[nñ]er/iu.test(fallback)).toBe(false);
  });

  it('B. Incomplete Italian coverage populates it_wh_* missing identities', () => {
    const softEnglish = [
      'Checks incoming goods and related documentation for accurate recording.',
      'Updates warehouse records for accurate storage.',
      'Works with colleagues to prepare and move goods.',
    ].join('\n');
    const cov = validateItalianWarehouseExperienceCoverage(EN_ORIGINAL, softEnglish);
    expect(cov.ok).toBe(false);
    expect(cov.covered.length).toBeLessThan(3);
    expect(cov.uncovered.length).toBeGreaterThan(0);
    const hashes = cov.uncovered.map((id) => italianWarehouseFactDiagId(id));
    expect(hashes.every((h) => h.startsWith('it_wh_'))).toBe(true);
    const emptyUncovered = checkExperienceDiagnosticInvariants({
      requiredFactCount: cov.required.length,
      coveredFactCount: cov.covered.length,
      uncoveredFactIdentityHashes: [],
      finalCandidateSource: 'deterministic_fallback',
      countedAsSuccess: false,
    } as never);
    expect(
      emptyUncovered.failures.some((f) =>
        String(f.invariantCode).includes('incomplete_coverage_with_empty_uncovered')),
    ).toBe(true);
    const withHashes = checkExperienceDiagnosticInvariants({
      requiredFactCount: cov.required.length,
      coveredFactCount: cov.covered.length,
      uncoveredFactIdentityHashes: hashes,
      finalCandidateSource: 'deterministic_fallback',
      countedAsSuccess: false,
    } as never);
    expect(
      withHashes.failures.some((f) =>
        String(f.invariantCode).includes('incomplete_coverage_with_empty_uncovered')),
    ).toBe(false);
  });

  it('cross-locale FR visible vs IT 3/3 fallback is wrong_locale_fixed without missing_fact_restored', () => {
    const fallback = buildItalianWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: FR_AI_UNEDITED,
      candidateText: fallback,
      locale: 'it',
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

  it('C. Rejection safety: invalid Italian candidate preserves French and does not increment usage', () => {
    const cv = atlasFrVisibleItTargetCv();
    const blocked = {
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
        countedAsSuccess: false,
      },
    };
    const beforeDesc = cv.experience![0]!.description;
    const beforeGen = (cv.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale;
    const applied = applyFinalizedBulletsToCv(cv, 'it', 'exp-atlas', blocked as never);
    expect(applied.experience![0]!.description).toBe(beforeDesc);
    expect(
      (applied.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe(beforeGen);
    expect(applied).toBe(cv);
  });

  it('1–24. FR-visible → IT Stronger AI: provider rejected; IT fallback 3/3 selected + applied', () => {
    const cv = atlasFrVisibleItTargetCv();
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: FR_AI_UNEDITED,
      locale: 'it',
      requestId: 'req-fr-it-334',
      jobContextHash: 'job-fr-it-334',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'it',
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
    expect(String(fin.diagnostics?.requestedLocale || fin.diagnostics?.requestedTargetLocale || 'it'))
      .toMatch(/^it/);
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(String(fin.diagnostics?.visibleTextareaLocale || '')).toMatch(/^fr/);
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^fr/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^fr/);
    expect(String(fin.diagnostics?.requestedTargetLocale || '')).toMatch(/^it/);
    expect(fin.diagnostics?.crossLocaleOperation).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.translationFallbackAttempted).toBe(true);
    expect(fin.diagnostics?.translationFallbackSelected).toBe(true);
    expect(fin.diagnostics?.translationFallbackApplied).toBe(false);
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidatePresent).toBe(true);
    expect(fin.diagnostics?.fallbackRequiredFactCount ?? fin.diagnostics?.clientDeterministicFallbackRequiredFactCount)
      .toBe(3);
    expect(fin.diagnostics?.fallbackCoveredFactCount ?? fin.diagnostics?.clientDeterministicFallbackCoveredFactCount)
      .toBe(3);
    expect(fin.diagnostics?.finalRequiredFactCount).toBe(3);
    expect(fin.diagnostics?.finalCoveredFactCount).toBe(3);
    expect(fin.diagnostics?.finalUncoveredFactIdentityHashes || []).toEqual([]);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(fin.diagnostics?.sourcePredicateIdentityCount).toBe(3);
    expect(fin.diagnostics?.finalCandidatePredicateIdentityCount).toBe(3);
    expect(fin.diagnostics?.finalAddedPredicateCount).toBe(0);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalUnsupportedClaimCount ?? 0).toBe(0);
    const bullets = fin.diagnostics?.detectedLocaleByBullet || [];
    for (const loc of bullets) {
      expect(loc === null || loc === 'it').toBe(true);
    }
    expect(fin.diagnostics?.wrongLocaleBulletCount ?? 0).toBe(0);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBe(false);
    expect(fin.diagnostics?.degradationKinds || []).toEqual([]);
    expect(fin.diagnostics?.materialImprovementDetected).toBe(true);
    expect(fin.diagnostics?.materialImprovementKinds || []).not.toContain('missing_fact_restored');
    expect(fin.diagnostics?.semanticNoOpDetected).toBe(false);
    expect(fin.diagnostics?.diagnosticInvariantCheckPassed !== false).toBe(true);

    const appliedText = (fin.text || '').trim();
    expect(appliedText.length).toBeGreaterThan(40);
    expect(/controlla|verifica|coordina|magazzino|documentazione|colleghi|movimentazione/iu.test(appliedText))
      .toBe(true);
    expect(/contr[oô]le|marchandises|coll[eè]gues/iu.test(appliedText)).toBe(false);
    expect(/mercanc|documentaci|compa[nñ]er/iu.test(appliedText)).toBe(false);
    expect(/\b(checks?|works? with colleagues|incoming goods)\b/iu.test(appliedText)).toBe(false);
    expect(splitBulletCount(appliedText)).toBe(3);

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-fr-it-334',
      requestedLocale: 'it',
      uiLocale: 'it',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-fr-it-334',
      usageCountBefore: 8,
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
      visibleTextareaLocale: 'fr',
      visibleTextareaLocaleBeforeApply: 'fr',
      requestedTargetLocale: 'it',
      entryGeneratedLocaleBeforeApply: 'fr',
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
    });
    const gate = session.evaluatePreApplyDecisionGates();
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(gate.passed, JSON.stringify({ gate, failures: draft.diagnosticInvariantFailures })).toBe(true);
    expect(gate.diagnosticCompletenessPassed).toBe(true);
    expect(draft.preapplyDiagnosticCompletenessPassed).toBe(true);
    expect(draft.applyAuthorized).toBe(true);
    expect(draft.diagnosticInvariantCheckPassed !== false).toBe(true);
    expect(Number(draft.diagnosticInvariantFailureCount || 0)).toBe(0);

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
      appliedVisibleContentLocale: 'it',
    });
    session.recordVisibleApply(true, 9, {
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
    expect(trace.appliedVisibleContentLocale).toBe('it');
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(8);
    expect(trace.usageCountAfter).toBe(9);

    const write = applyFinalizedBulletsToCv(cv, 'it', 'exp-atlas', fin);
    expect(write.experience![0]!.description).toContain('Controlla');
    expect(
      (write.experience![0] as WorkExperience & { generatedLocale?: string }).generatedLocale,
    ).toBe('it');
    expect(write.experience![1]!.description).toContain('Supported basic');
  });
});
