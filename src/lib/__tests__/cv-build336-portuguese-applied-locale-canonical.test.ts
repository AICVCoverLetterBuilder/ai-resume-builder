/**
 * @vitest-environment jsdom
 *
 * AAB-336 — post-commit Brazilian Portuguese locale must publish canonical
 * `pt-BR`, never a lowercased comparison key `pt-br`.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  canonicalizeContentLocale,
  normalizeLocaleKey,
  resolveCommittedAppliedVisibleContentLocale,
} from '@/lib/cv-content-locale';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { checkExperiencePreapplyDiagnosticInvariants } from '@/lib/cv-experience-phased-apply-329';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

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
  return {
    templateId: 'modern',
    contentLocale: 'en',
    personal: {
      fullName: 'Test',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Warehouse employee',
      gender: 'female',
    },
    summary: '',
    experience: [
      {
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
      },
    ],
    education: [],
    skills: [],
    languages: [],
  };
}

describe('AAB-336 Portuguese appliedVisibleContentLocale canonicalization', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
  });

  it('separates internal lowercase key from public canonical pt-BR', () => {
    expect(normalizeLocaleKey('pt-BR')).toBe('pt-br');
    expect(normalizeLocaleKey('pt')).toBe('pt-br');
    expect(canonicalizeContentLocale('pt-br')).toBe('pt-BR');
    expect(canonicalizeContentLocale('pt_BR')).toBe('pt-BR');
    expect(canonicalizeContentLocale('pt')).toBe('pt-BR');
    for (const alias of ['pt', 'pt-br', 'pt_BR', 'pt-BR'] as const) {
      const resolved = resolveCommittedAppliedVisibleContentLocale({
        persistedGeneratedLocale: alias,
        requestedTargetLocale: alias,
      });
      expect(resolved.appliedVisibleContentLocale).toBe('pt-BR');
    }
  });

  it('rejects lowercase pt-br as public appliedVisibleContentLocale after commit', () => {
    const inv = checkExperienceDiagnosticInvariants({
      applyCommitted: true,
      targetContentApplied: true,
      requestedTargetLocale: 'pt-BR',
      appliedVisibleContentLocale: 'pt-br',
      countedAsSuccess: false,
      visibleApplySucceeded: false,
    } as never);
    expect(inv.passed).toBe(false);
    expect(
      inv.failures.some(
        (f) => f.invariantCode === 'applied_visible_locale_not_canonical_after_commit',
      ),
    ).toBe(true);

    const phased = checkExperiencePreapplyDiagnosticInvariants({
      applyCommitted: true,
      targetContentApplied: true,
      requestedTargetLocale: 'pt-BR',
      appliedVisibleContentLocale: 'pt-br',
    });
    expect(phased.passed).toBe(false);
    expect(
      phased.failures.some(
        (f) => f.invariantCode === 'applied_visible_locale_not_canonical_after_commit',
      ),
    ).toBe(true);
  });

  it('IT-visible → pt-BR commit publishes canonical public locales for all aliases', () => {
    for (const alias of ['pt', 'pt-br', 'pt_BR', 'pt-BR'] as const) {
      const cv = atlasItVisiblePtTargetCv();
      const fin = finalizeCvAiFieldForApply({
        action: 'experience_bullets',
        field: 'experience_description',
        requestedLocale: alias as never,
        gender: 'female',
        cv,
        candidate: EN_PROVIDER_NOOP,
        experienceId: 'exp-atlas',
        industry: 'general',
        level: 'mid',
        referenceDateIso: REF,
        operationSnapshot: createExperienceAiOperationSnapshot({
          liveText: IT_AI_UNEDITED,
          locale: 'pt-BR',
          requestId: `req-336-${alias}`,
          jobContextHash: `job-336-${alias}`,
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
      expect(fin.countedAsSuccess, alias).toBe(true);
      expect(fin.blocked, alias).toBe(false);
      expect(fin.diagnostics?.requestedTargetLocale, alias).toBe('pt-BR');
      expect(fin.diagnostics?.targetLocale || fin.diagnostics?.requestedTargetLocale, alias)
        .toBe('pt-BR');
      expect(fin.diagnostics?.detectedLocaleByBullet, alias).toEqual([
        'pt-BR',
        'pt-BR',
        'pt-BR',
      ]);
      expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed, alias).toBe(true);
      expect(fin.diagnostics?.materialImprovementKinds, alias).toEqual(['wrong_locale_fixed']);

      const write = applyFinalizedBulletsToCv(cv, alias as never, 'exp-atlas', fin);
      const entry = write.experience![0] as WorkExperience & { generatedLocale?: string };
      expect(entry.generatedLocale, alias).toBe('pt-BR');
      expect(write.contentLocale, alias).toBe('pt-BR');
      expect(entry.description, alias).toContain(EXPECTED_PT_TRIAD[0]!);

      const pageLike = resolveCommittedAppliedVisibleContentLocale({
        persistedGeneratedLocale: entry.generatedLocale,
        requestedTargetLocale: alias,
      });
      expect(pageLike.appliedVisibleContentLocale, alias).toBe('pt-BR');

      const usageBefore = 9;
      const session = new ExperienceAiDiagnosticSession({
        requestId: `req-336-diag-${alias}`,
        requestedLocale: 'pt-BR',
        uiLocale: 'pt-BR',
        contentLocale: 'en',
        templateId: 'modern',
        jobContextHash: `job-336-diag-${alias}`,
        usageCountBefore: usageBefore,
      });
      const appliedText = fin.text || '';
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
      });
      session.recordFinalizeResult(fin);
      session.patch({
        translationFallbackSelected: true,
        translationFallbackAttempted: true,
        crossLocaleOperation: true,
        clientDeterministicFallbackSelected: true,
        clientDeterministicFallbackUsedForFinalCandidate: true,
        clientDeterministicFallbackApplied: false,
        lastAiOutputHashMatched: true,
        visibleComparisonMatchedLastAiOutput: true,
      });
      const gate = session.evaluatePreApplyDecisionGates();
      expect(gate.passed, alias).toBe(true);
      session.patch({
        applyAuthorized: true,
        applyAttempted: true,
        applyWriteSucceeded: true,
        visibleValidationAttempted: true,
        visibleValidationPassed: true,
        applyCommitted: true,
        targetContentApplied: true,
        visibleApplySucceeded: true,
        contentLocaleUpdatedAfterApply: true,
        translationFallbackApplied: true,
        clientDeterministicFallbackApplied: true,
        contentLocaleDocument: 'pt-BR',
        appliedVisibleContentLocale: pageLike.appliedVisibleContentLocale,
        appliedVisibleContentLocaleRaw: pageLike.appliedVisibleContentLocaleRaw,
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
        diagnosticCompletenessPassed: true,
        diagnosticInvariantCheckPassed: true,
      });
      session.recordVisibleApply(true, usageBefore + 1, {
        visibleDescription: appliedText,
        finalNormalizedText: appliedText,
      });
      const trace = session.commit();
      expect(trace.requestedTargetLocale, alias).toBe('pt-BR');
      expect(trace.contentLocaleDocument, alias).toBe('pt-BR');
      expect(trace.appliedVisibleContentLocale, alias).toBe('pt-BR');
      expect(trace.detectedLocaleByBullet, alias).toEqual(['pt-BR', 'pt-BR', 'pt-BR']);
      expect(trace.applyCommitted, alias).toBe(true);
      expect(trace.targetContentApplied, alias).toBe(true);
      expect(trace.translationFallbackApplied, alias).toBe(true);
      expect(trace.diagnosticInvariantCheckPassed, alias).toBe(true);
      expect(trace.usageCountAfter, alias).toBe(usageBefore + 1);
    }
  });
});
