/** AAB-470 — Croatian cross-locale provider/preapply diagnostic truth. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import { finalizeCvAiFieldForApply } from '@/lib/cv-ai-finalize-apply';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  clearExperienceAiDiagnosticsForTests,
  ExperienceAiDiagnosticSession,
} from '@/lib/cv-experience-ai-diagnostics';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';

const EN_SOURCE = [
  'Checks incoming goods.',
  'Checks the related documents.',
  'Works with colleagues to prepare and move goods.',
].join('\n');
const SR_VISIBLE = [
  'Proverava pristiglu robu.',
  'Proverava prateću dokumentaciju.',
  'Sarađuje sa kolegama na pripremi i premeštanju robe.',
].join('\n');
const HR_PROVIDER = [
  'Provjerava pristiglu robu.',
  'Provjerava prateću dokumentaciju.',
  'Surađuje s kolegama na pripremi i premještanju robe.',
].join('\n');

function fixture(): CVData {
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-atlas', appliedOutput: SR_VISIBLE,
    preAiFactText: EN_SOURCE, sourceLocale: 'en', targetLocale: 'sr',
    operationMode: 'enhance_existing', sourceAuthorityKind: 'pre_ai_snapshot',
  });
  const current: WorkExperience = {
    id: 'exp-atlas', company: 'Atlas', position: 'Warehouse employee',
    startDate: '2023-01', endDate: '', isPresent: true, description: SR_VISIBLE,
    originalUserDescription: EN_SOURCE, canonicalDescription: EN_SOURCE,
    descriptionOrigin: 'ai_generated', generatedLocale: 'sr',
    generatedDescription: SR_VISIBLE, aiOutputProvenance: provenance,
  };
  const prior: WorkExperience = {
    id: 'exp-rewitu', company: 'Rewitu', position: 'Assistant',
    startDate: '2020-01', endDate: '2022-12', isPresent: false,
    description: 'Supported basic administrative tasks.',
    originalUserDescription: 'Supported basic administrative tasks.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-aab470', name: 'CV', personal: {
      fullName: 'Anna Test', email: 'anna@example.com', phone: '', address: '',
      jobTitle: 'Warehouse employee', gender: 'female', photoEnabled: false,
    }, summary: '', contentLocale: 'en', education: [],
    skills: [], certifications: [], languages: [],
    templateId: 'modern-minimal', region: 'EU',
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
    experience: [current, prior],
  };
}

describe('AAB-470 Croatian Experience preapply diagnostic truth', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
  });

  it('does not accept a provider phase that reports incomplete coverage', () => {
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description',
      requestedLocale: 'hr', gender: 'female', cv: fixture(), candidate: HR_PROVIDER,
      experienceId: 'exp-atlas', industry: 'general', level: 'mid',
      referenceDateIso: '2026-07-26',
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SR_VISIBLE, locale: 'hr', requestId: 'aab470',
        jobContextHash: 'aab470', experienceEntryId: 'exp-atlas',
        authoritativeTextOverride: EN_SOURCE, provenanceOriginOverride: 'originalUserDescription',
      }),
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false, lastAiOutputHashMatched: true,
      materialUserEditDetected: false, staleGeneratedDescriptionIgnored: true,
      providerPhaseDiagnostics: {
        candidatePresent: true, requiredFactCount: 3, coveredFactCount: 2,
        uncoveredSourceIndexes: [], accepted: true,
      },
    });
    const d = result.diagnostics as Record<string, unknown>;
    expect(result.countedAsSuccess).toBe(true);
    expect(d.providerAccepted).toBe(false);
    expect(d.providerCoveredFactCount).toBe(2);
    expect(d.providerRequiredFactCount).toBe(3);
    expect(d.providerCoverageCount).toBe(2);
    expect(d.providerUncoveredFactCount).toBe(1);
    expect(d.providerUncoveredFactIdentityHashes).toHaveLength(1);
    expect(d.providerRejectionReason).toBe('provider_phase_coverage_incomplete');
    expect(d.providerRejectionStage).toBe('provider:provider_phase_coverage');
    expect(d.finalCandidateSource).toBe('deterministic_fallback');
    expect(d.finalRequiredFactCount).toBe(3);
    expect(d.finalCoveredFactCount).toBe(3);

    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'hr', requestedLocale: 'hr', templateId: 'modern-minimal',
      jobContextHash: 'aab470-2of3', requestId: 'aab470-2of3', usageCountBefore: 20,
    });
    session.recordApiResponse({ httpStatus: 200, resultText: HR_PROVIDER });
    session.recordFinalizeResult(result);
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.preapplyDiagnosticInvariantCheckPassed).toBe(true);
    expect(draft.diagnosticInvariantCheckPassed).toBe(true);
    expect(draft.providerCoveredFactCount).toBe(2);
    expect(draft.providerRequiredFactCount).toBe(3);
    expect(draft.providerUncoveredFactIdentityHashes).toHaveLength(1);
  });

  it('accepts a complete provider phase and marks wrong-locale correction meaningful', () => {
    const result = finalizeCvAiFieldForApply({
      action: 'experience_bullets', field: 'experience_description',
      requestedLocale: 'hr', gender: 'female', cv: fixture(), candidate: HR_PROVIDER,
      experienceId: 'exp-atlas', industry: 'general', level: 'mid',
      referenceDateIso: '2026-07-26',
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: SR_VISIBLE, locale: 'hr', requestId: 'aab470-ok',
        jobContextHash: 'aab470-ok', experienceEntryId: 'exp-atlas',
        authoritativeTextOverride: EN_SOURCE, provenanceOriginOverride: 'originalUserDescription',
      }),
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: 'pre_ai_snapshot',
      currentTextareaUsedForFactExtraction: false, lastAiOutputHashMatched: true,
      materialUserEditDetected: false, staleGeneratedDescriptionIgnored: true,
      providerPhaseDiagnostics: {
        candidatePresent: true, requiredFactCount: 3, coveredFactCount: 3,
        uncoveredSourceIndexes: [], accepted: true,
      },
    });
    const d = result.diagnostics as Record<string, unknown>;
    expect(result.countedAsSuccess).toBe(true);
    expect(d.providerAccepted).toBe(true);
    expect(d.providerCoveredFactCount).toBe(3);
    expect(d.providerUncoveredFactCount).toBe(0);
    expect(d.providerUncoveredFactIdentityHashes).toEqual([]);
    expect(d.meaningfulChangeDetected).toBe(true);
    expect(d.materialImprovementKinds).toContain('wrong_locale_fixed');
    expect(d.providerRequiredFactCount).toBe(3);
    expect(d.providerCoverageCount).toBe(3);

    const session = new ExperienceAiDiagnosticSession({
      uiLocale: 'hr', requestedLocale: 'hr', templateId: 'modern-minimal',
      jobContextHash: 'aab470-3of3', requestId: 'aab470-3of3', usageCountBefore: 20,
    });
    session.recordApiResponse({ httpStatus: 200, resultText: HR_PROVIDER });
    session.recordFinalizeResult(result);
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.preapplyDiagnosticInvariantCheckPassed).toBe(true);
    expect(draft.diagnosticInvariantCheckPassed).toBe(true);
  });
});
