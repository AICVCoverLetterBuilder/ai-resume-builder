/**
 * @vitest-environment jsdom
 *
 * AAB-331 — post-apply Experience locale diagnostic truth:
 * after DE-visible → ES committed apply, appliedVisibleContentLocale must be
 * `es` (from persisted entry), not the pre-apply German snapshot.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import { buildSpanishWarehouseExperienceFallback } from '@/lib/cv-spanish-experience-grounding';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { checkExperiencePreapplyDiagnosticInvariants } from '@/lib/cv-experience-phased-apply-329';

const REF = '2026-07-25';

const EN_ORIGINAL = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');

const DE_AI_UNEDITED = [
  'Prüft eingehende Waren.',
  'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
  'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
].join('\n');

function atlasDeVisibleCv(docLocale: 'en' | 'de' = 'de'): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas',
    appliedOutput: DE_AI_UNEDITED,
    preAiFactText: EN_ORIGINAL,
    sourceLocale: 'en',
    targetLocale: 'de',
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
    description: DE_AI_UNEDITED,
    originalUserDescription: EN_ORIGINAL,
    canonicalDescription: EN_ORIGINAL,
    descriptionOrigin: 'ai_generated',
    generatedLocale: 'de',
    generatedDescription: DE_AI_UNEDITED,
    aiOutputProvenance: provenance,
  };
  return {
    id: 'cv-aab331-locale',
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
    contentLocale: docLocale,
    experience: [current],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

describe('AAB-331 post-apply Experience locale diagnostic truth', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('finalize leaves appliedVisibleContentLocale null (pre-apply must not stamp de)', () => {
    const cv = atlasDeVisibleCv('de');
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: DE_AI_UNEDITED,
      locale: 'es',
      requestId: 'req-331-pre',
      jobContextHash: 'job-331',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: EN_ORIGINAL,
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
    expect(fin.diagnostics?.appliedVisibleContentLocale ?? null).toBeNull();
    expect(String(fin.diagnostics?.visibleTextareaLocale || '')).toMatch(/^de/);
    expect(String(fin.diagnostics?.visibleTextareaLocaleBeforeApply || '')).toMatch(/^de/);
    expect(String(fin.diagnostics?.entryGeneratedLocaleBeforeApply || '')).toMatch(/^de/);
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toMatch(/^en/);
    expect(fin.diagnostics?.requestedTargetLocale).toMatch(/^es/);
    expect(fin.diagnostics?.contentLocaleDocument).toBe('de');
  });

  it('committed DE→ES apply persists generatedLocale=es and appliedVisibleContentLocale=es', () => {
    const cv = atlasDeVisibleCv('de');
    const snapshot = createExperienceAiOperationSnapshot({
      liveText: DE_AI_UNEDITED,
      locale: 'es',
      requestId: 'req-331-commit',
      jobContextHash: 'job-331',
      experienceEntryId: 'exp-atlas',
      authoritativeTextOverride: EN_ORIGINAL,
      provenanceOriginOverride: 'originalUserDescription',
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'es',
      gender: 'female',
      cv,
      candidate: EN_ORIGINAL,
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
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');

    const applied = applyFinalizedBulletsToCv(cv, 'es', 'exp-atlas', fin);
    const entry = applied.experience!.find((e) => e.id === 'exp-atlas')!;
    expect(entry.generatedLocale).toBe('es');
    expect(entry.description).toBe(fin.text);
    expect(entry.originalUserDescription).toBe(EN_ORIGINAL);
    expect(/prüft|kontrolliert/iu.test(entry.description || '')).toBe(false);

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-331-commit',
      requestedLocale: 'es',
      uiLocale: 'es',
      contentLocale: 'en',
      templateId: 'modern',
      jobContextHash: 'job-331',
      usageCountBefore: 2,
    });
    session.recordFinalizeResult(fin);
    session.patch({
      applyAuthorized: true,
      applyAttempted: true,
      applyWriteSucceeded: true,
      visibleValidationAttempted: true,
      visibleValidationPassed: true,
      visibleFactCoveragePassed: true,
      visiblePredicateCoveragePassed: true,
      visibleLocaleValidationPassed: true,
      visibleTenseValidationPassed: true,
      visibleDescriptionMatchesFinalHash: true,
      visibleNormalizedHash: fingerprintText((fin.text || '').replace(/\s+/g, ' ').trim()),
      preapplyDiagnosticCompletenessPassed: true,
      preapplyDiagnosticInvariantCheckPassed: true,
      clickedExperienceEntryIdHash: 'atlas-hash',
      selectedExperienceEntryIdHash: 'atlas-hash',
      translationFallbackSelected: true,
      translationFallbackAttempted: true,
      crossLocaleOperation: true,
      // Re-read persisted entry (device path).
      appliedVisibleContentLocale: entry.generatedLocale || 'es',
      contentLocaleDocument: applied.contentLocale || null,
      entryGeneratedLocaleBeforeApply: 'de',
      visibleTextareaLocale: 'de',
      visibleTextareaLocaleBeforeApply: 'de',
      authoritativeFactSourceLocale: 'en',
      requestedTargetLocale: 'es',
    });
    session.recordVisibleApply(true, 3, {
      visibleDescription: entry.description || '',
      finalNormalizedText: fin.text || '',
    });
    const trace = session.commit();

    expect(trace.authoritativeFactSourceLocale).toMatch(/^en/);
    expect(String(trace.visibleTextareaLocale || '')).toMatch(/^de/);
    expect(String(trace.visibleTextareaLocaleBeforeApply || '')).toMatch(/^de/);
    expect(trace.requestedTargetLocale).toMatch(/^es/);
    expect(String(trace.appliedVisibleContentLocale || '')).toMatch(/^es/);
    expect(entry.generatedLocale).toBe('es');
    expect(trace.contentLocaleUpdatedAfterApply).toBe(true);
    expect(trace.translationFallbackApplied).toBe(true);
    expect(trace.applyCommitted).toBe(true);
    expect(trace.targetContentApplied).toBe(true);
    expect(trace.usageCountBefore).toBe(2);
    expect(trace.usageCountAfter).toBe(3);
    expect(trace.countedAsSuccess).toBe(true);

    const inv = checkExperiencePreapplyDiagnosticInvariants(trace as never);
    expect(inv.passed).toBe(true);
  });

  it('rollback restores German description + generatedLocale; appliedVisibleContentLocale stays null', () => {
    const cv = atlasDeVisibleCv('de');
    const esText = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    // Simulate temporary write that would set Spanish locale.
    const temp: CVData = {
      ...cv,
      contentLocale: 'es',
      experience: cv.experience!.map((e) =>
        e.id === 'exp-atlas'
          ? {
            ...e,
            description: esText,
            generatedDescription: esText,
            generatedLocale: 'es',
          }
          : e,
      ),
    };
    expect(temp.experience![0]!.generatedLocale).toBe('es');

    // Rollback restores prior German description + generated locale together.
    const rolled: CVData = {
      ...temp,
      experience: temp.experience!.map((e) =>
        e.id === 'exp-atlas'
          ? {
            ...e,
            description: DE_AI_UNEDITED,
            generatedDescription: DE_AI_UNEDITED,
            generatedLocale: 'de',
          }
          : e,
      ),
    };
    expect(rolled.experience![0]!.description).toBe(DE_AI_UNEDITED);
    expect(rolled.experience![0]!.generatedLocale).toBe('de');

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-331-rollback',
      requestedLocale: 'es',
      uiLocale: 'es',
      contentLocale: 'de',
      templateId: 'modern',
      jobContextHash: 'job-331-rb',
      usageCountBefore: 2,
    });
    session.patch({
      translationFallbackSelected: true,
      translationFallbackAttempted: true,
      crossLocaleOperation: true,
      requestedTargetLocale: 'es',
      entryGeneratedLocaleBeforeApply: 'de',
      visibleTextareaLocaleBeforeApply: 'de',
      applyAttempted: true,
      applyWriteSucceeded: true,
      visibleValidationAttempted: true,
      visibleValidationPassed: false,
      rollbackAttempted: true,
      rollbackSucceeded: true,
    });
    session.recordVisibleApply(false, 2);
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(false);
    expect(trace.translationFallbackApplied).toBe(false);
    expect(trace.appliedVisibleContentLocale ?? null).toBeNull();
    expect(trace.contentLocaleUpdatedAfterApply).toBe(false);
    expect(trace.usageCountAfter).toBe(2);
    expect(trace.countedAsSuccess).toBe(false);
  });

  it('cross-locale DE visible → ES candidate does not claim missing_fact_restored when visible already 3/3', () => {
    const fallback = buildSpanishWarehouseExperienceFallback({
      sourceDescription: EN_ORIGINAL,
      isPresent: true,
    });
    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: EN_ORIGINAL,
      visibleComparisonText: DE_AI_UNEDITED,
      candidateText: fallback,
      locale: 'es',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: true,
      visibleComparisonProvenance: 'ai_generated_unedited',
      isPresent: true,
    });
    expect(evalVis.degradationDetected).toBe(false);
    expect(evalVis.materialImprovementKinds).toContain('wrong_locale_fixed');
    expect(evalVis.materialImprovementKinds).not.toContain('missing_fact_restored');
  });
});
