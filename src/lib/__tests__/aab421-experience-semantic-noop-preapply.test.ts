/**
 * @vitest-environment jsdom
 *
 * AAB-421 source gate: a grounded Experience candidate may be valid at the
 * provider layer and still be a non-billable semantic no-op against the text
 * already visible when the operation started.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  applyFinalizedBulletsToCv,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  decideExperienceCanonicalPreapply,
  evaluateExperienceVisibleComparison,
  EXPERIENCE_CANONICAL_PREAPPLY_DECISION_421_REVISION,
} from '@/lib/cv-experience-visible-noop-authority';
import {
  createExperienceAiOperationSnapshot,
} from '@/lib/cv-experience-ai-operation-snapshot';
import {
  buildExperienceAiOutputProvenance,
} from '@/lib/cv-experience-ai-output-provenance';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  assertCvAiDiagnosticPrivacy,
  checkExperienceDiagnosticCompleteness,
  checkExperienceDiagnosticInvariants,
  clearCvAiDiagnosticHistory,
} from '@/lib/cv-ai-diagnostics-contract';
import {
  emptyTransactionalApplyState,
} from '@/lib/cv-experience-phased-apply-329';
import { hashExperienceEntryId } from '@/lib/cv-experience-entry-isolation';
import {
  AI_USAGE_STORAGE_KEY,
  getProAiUsageCount,
  recordProAiUserActionSuccess,
} from '@/lib/ai-usage-policy';

const ENTRY_ID = 'exp-aab421-258601';
const ENTRY_HASH = 'fnv1a_90ceb7d_l17_b101_e49';

const SOURCE_SR_CURRENT = [
  'Priprema vizuelne koncepte i rasporede za digitalne materijale.',
  'Uređuje grafiku i fotografije za različite projekte.',
  'Koordiniše nacrte i izmene sa članovima projektnog tima.',
].map((line) => `• ${line}`).join('\n');

const VISIBLE_AR_CURRENT = [
  'تُعِدّ المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'تُحرِّر الرسومات والصور لمختلف المشاريع.',
  'تُنسِّق المسودات والتعديلات مع أعضاء فريق المشروع.',
].map((line) => `• ${line}`).join('\n');

// Same Arabic duties and predicates with neutral diacritic/surface restyling.
const PROVIDER_AR_NEUTRAL = [
  'تُعِدّ المفاهيم البصرية والتخطيطات للمواد الرقمية،',
  'تُحرِّر الرسومات والصور لمختلف المشاريع،',
  'تُنسِّق المسودات والتعديلات مع أعضاء فريق المشروع،',
].map((line) => `• ${line}`).join('\n');

const VISIBLE_AR_INCOMPLETE = [
  'تُعِدّ المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'تُحرِّر الرسومات والصور لمختلف المشاريع.',
].map((line) => `• ${line}`).join('\n');

const VISIBLE_AR_COMPLETED = [
  'أعدّت المفاهيم البصرية والتخطيطات للمواد الرقمية.',
  'حرّرت الرسومات والصور لمختلف المشاريع.',
  'نسّقت المسودات والتعديلات مع أعضاء فريق المشروع.',
].map((line) => `• ${line}`).join('\n');

const PROVIDER_AR_COMPLETED_NEUTRAL = [
  'أعدّت المفاهيم البصرية والتخطيطات للمواد الرقمية،',
  'حرّرت الرسومات والصور لمختلف المشاريع،',
  'نسّقت المسودات والتعديلات مع أعضاء فريق المشروع،',
].map((line) => `• ${line}`).join('\n');

function seedUsage(count = 11): void {
  localStorage.setItem(AI_USAGE_STORAGE_KEY, JSON.stringify({
    schemaVersion: 1,
    count,
    windowStart: Date.now(),
    policyLimit: 150,
  }));
}

function fixture(options?: {
  isPresent?: boolean;
  visible?: string;
  source?: string;
  sourceLocale?: string;
  contentLocale?: string;
}): { cv: CVData; experience: WorkExperience } {
  const isPresent = options?.isPresent !== false;
  const visible = options?.visible
    ?? (isPresent ? VISIBLE_AR_CURRENT : VISIBLE_AR_COMPLETED);
  const source = options?.source
    ?? (isPresent ? SOURCE_SR_CURRENT : VISIBLE_AR_COMPLETED);
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: ENTRY_ID,
    appliedOutput: visible,
    preAiFactText: source,
    sourceLocale: options?.sourceLocale ?? 'sr',
    targetLocale: 'ar',
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'pre_ai_snapshot',
  });
  const experience = {
    id: ENTRY_ID,
    company: 'Rewitu Current Test',
    position: 'Grafička dizajnerka',
    startDate: '2026-03',
    endDate: isPresent ? '' : '2026-07',
    isPresent,
    description: visible,
    originalUserDescription: source,
    canonicalDescription: source,
    generatedDescription: visible,
    descriptionOrigin: 'ai_generated',
    contentLocale: 'ar',
    generatedLocale: 'ar',
    aiOutputProvenance: provenance,
  } as unknown as WorkExperience;
  const cv = {
    id: 'cv-aab421',
    name: 'AAB 421 fixture',
    personal: {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '',
      address: '',
      jobTitle: 'Grafička dizajnerka',
      gender: 'female',
    },
    summary: '',
    experience: [experience],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    contentLocale: options?.contentLocale ?? 'ar',
    templateId: 'modern-minimal',
    region: 'RS',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  } as unknown as CVData;
  return { cv, experience };
}

function operationSnapshot(experience: WorkExperience, source: string, requestId: string) {
  return createExperienceAiOperationSnapshot({
    liveText: experience.description || '',
    locale: 'ar',
    requestId,
    jobContextHash: 'aab421-current-role',
    experienceEntryId: ENTRY_ID,
    authoritativeTextOverride: source,
    provenanceOriginOverride: 'originalUserDescription',
  });
}

function finalizeNeutral(options?: { completed?: boolean }) {
  const completed = options?.completed === true;
  const source = completed ? VISIBLE_AR_COMPLETED : SOURCE_SR_CURRENT;
  const { cv, experience } = fixture({
    isPresent: !completed,
    source,
    sourceLocale: completed ? 'ar' : 'sr',
  });
  return {
    cv,
    finalized: finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'ar',
      gender: 'female',
      experienceId: ENTRY_ID,
      candidate: completed ? PROVIDER_AR_COMPLETED_NEUTRAL : PROVIDER_AR_NEUTRAL,
      cv,
      operationSnapshot: operationSnapshot(
        experience,
        source,
        completed ? 'aab421-completed' : 'aab421-current',
      ),
    }),
  };
}

describe('AAB-421 canonical Experience semantic-noop source gate', () => {
  beforeEach(() => {
    localStorage.clear();
    clearExperienceAiDiagnosticsForTests();
    clearCvAiDiagnosticHistory();
    seedUsage();
  });

  it('packages the locale-shared immutable preapply decision marker', () => {
    expect(EXPERIENCE_CANONICAL_PREAPPLY_DECISION_421_REVISION)
      .toBe('experience-canonical-preapply-decision-421-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET)
      .toContain(EXPERIENCE_CANONICAL_PREAPPLY_DECISION_421_REVISION);
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: true,
      semanticNoOpDetected: true,
      semanticNoOpReason: 'neutral_restyle',
      materialImprovementDetected: false,
      materialImprovementKinds: [],
      neutralRestyleDetected: true,
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect(Object.isFrozen(decision.materialImprovementKinds)).toBe(true);
    expect(decision.finalDecisionKind).toBe('semantic_noop');
    expect(decision.shouldApply).toBe(false);
    expect(decision.shouldIncrementUsage).toBe(false);
  });

  it('exact AAB-421 current Arabic 3/3 semantically-same candidate is no apply and +0', () => {
    expect(hashExperienceEntryId(ENTRY_ID)).toBe(ENTRY_HASH);
    const { cv, finalized } = finalizeNeutral();
    const d = finalized.diagnostics || {};

    expect(finalized.blocked).toBe(true);
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.text).toBe(VISIBLE_AR_CURRENT);
    expect(d.semanticNoOpDetected).toBe(true);
    expect(['neutral_restyle', 'normalized_visible_match'])
      .toContain(d.semanticNoOpReason);
    expect(d.finalSemanticallyEquivalentToVisibleComparison).toBe(true);
    expect(d.neutralRestyleDetected).toBe(d.semanticNoOpReason === 'neutral_restyle');
    expect(d.materialImprovementDetected).toBe(false);
    expect(d.materialImprovementKinds).toEqual([]);
    expect(d.finalDecisionKind).toBe('semantic_noop');
    expect(d.providerCandidateValidationAccepted).toBe(true);
    expect(d.finalVisibleDecisionAcceptedForApply).toBe(false);
    expect(d.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(d.canonicalExperienceDecisionAllowsUsage).toBe(false);
    expect(d.experienceCanonicalPreapplyDecisionRevision)
      .toBe(EXPERIENCE_CANONICAL_PREAPPLY_DECISION_421_REVISION);
    expect(d.providerAccepted).toBe(true);
    expect(d.requiredFactCount).toBe(3);
    expect(d.coveredFactCount).toBe(3);
    expect(d.sourcePredicateIdentityCount).toBe(3);
    expect(d.candidatePredicateIdentityCount).toBe(3);
    expect(d.sourceUnitPredicateCoveragePassed).toBe(true);
    expect(d.unsupportedClaimCount).toBe(0);
    expect(d.tenseValidationPassed).toBe(true);
    expect(d.perspectiveValidationPassed).toBe(true);
    expect(d.targetLocalePurityPassed).toBe(true);
    expect(d.crossEntryLeakageDetected).toBe(false);
    expect(d.selectedExperienceEntryIdHash).toBe(ENTRY_HASH);
    expect(d.operationSnapshotExperienceEntryIdHash).toBe(ENTRY_HASH);
    expect(d.providerTargetEntryIdHash).toBe(ENTRY_HASH);
    expect(d.appliedExperienceEntryIdHash).toBeNull();

    const after = applyFinalizedBulletsToCv(cv, 'ar', ENTRY_ID, finalized);
    expect(after).toBe(cv);
    expect(after.experience[0]?.description).toBe(VISIBLE_AR_CURRENT);
    expect(after.contentLocale).toBe('ar');
    expect(getProAiUsageCount()).toBe(11);
  });

  it('semantic no-op is authoritative before apply authorization and performs zero writes', () => {
    const { finalized } = finalizeNeutral();
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'aab421-session',
      requestedLocale: 'ar',
      uiLocale: 'ar',
      contentLocale: 'ar',
      templateId: 'modern-minimal',
      jobContextHash: 'aab421-current-role',
      usageCountBefore: 11,
    });
    session.recordExperienceEntryTarget({
      experienceEntryId: ENTRY_ID,
      isPresent: true,
      arrayIndexAtRequest: 0,
    });
    session.recordFinalizeResult(finalized);
    session.recordVisibleApply(false, 11);
    const trace = session.commit();
    const tx = emptyTransactionalApplyState();

    expect(tx.applyAuthorized).toBe(false);
    expect(tx.applyAttempted).toBe(false);
    expect(tx.applyWriteSucceeded).toBe(false);
    expect(tx.visibleValidationAttempted).toBe(false);
    expect(tx.applyCommitted).toBe(false);
    expect(trace.applyAuthorized).toBe(false);
    expect(trace.applyAttempted).toBe(false);
    expect(trace.applyWriteSucceeded).not.toBe(true);
    expect(trace.visibleApplySucceeded).toBe(false);
    expect(trace.applyCommitted).toBe(false);
    expect(trace.targetContentApplied).toBe(false);
    expect(trace.contentLocaleUpdatedAfterApply).toBe(false);
    expect(trace.countedAsSuccess).toBe(false);
    expect(trace.usageCountBefore).toBe(11);
    expect(trace.usageCountAfter).toBe(11);
    expect(trace.clickedExperienceEntryIdHash).toBe(ENTRY_HASH);
    expect(trace.snapshotExperienceEntryIdHash).toBe(ENTRY_HASH);
    expect(trace.payloadExperienceEntryIdHash).toBe(ENTRY_HASH);
    expect(trace.appliedExperienceEntryIdHash).toBeNull();
    expect(checkExperienceDiagnosticInvariants(trace).passed).toBe(true);
    expect(checkExperienceDiagnosticCompleteness(trace).passed).toBe(true);
    expect(assertCvAiDiagnosticPrivacy(trace)).toEqual([]);
  });

  it('defensive preapply rejects contradictory success instead of returning false-green', () => {
    const { finalized } = finalizeNeutral();
    const contradictory = {
      ...finalized,
      blocked: false,
      countedAsSuccess: true,
    };
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'aab421-false-green',
      requestedLocale: 'ar',
      uiLocale: 'ar',
      contentLocale: 'ar',
      templateId: 'modern-minimal',
      jobContextHash: 'aab421-current-role',
      usageCountBefore: 11,
    });
    session.recordExperienceEntryTarget({
      experienceEntryId: ENTRY_ID,
      isPresent: true,
      arrayIndexAtRequest: 0,
    });
    session.recordFinalizeResult(contradictory);
    const gate = session.evaluatePreApplyDecisionGates();
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;

    expect(gate.passed).toBe(false);
    expect(gate.diagnosticInvariantCheckPassed).toBe(false);
    expect(draft.preapplyDiagnosticInvariantCheckPassed).toBe(false);
    expect(draft.applyAuthorized).toBe(false);
    expect(draft.applyAttempted).toBe(false);
    expect(draft.applyCommitted).toBe(false);
    expect(draft.preapplyDecisionCreated).toBe(true);
    expect(draft.preapplyDecisionUsedForApplyAuthorization).toBe(true);
    expect((draft.preapplyDiagnosticInvariantFailures as Array<{ invariantCode: string }>)
      .some((failure) => failure.invariantCode
        === 'canonical_experience_decision_does_not_authorize_apply')).toBe(true);
  });

  it('genuine role-congruent missing-duty restoration is material and billable once', () => {
    const evaluation = evaluateExperienceVisibleComparison({
      factAuthorityText: SOURCE_SR_CURRENT,
      visibleComparisonText: VISIBLE_AR_INCOMPLETE,
      candidateText: VISIBLE_AR_CURRENT,
      locale: 'ar',
      visibleComparisonProvenance: 'ai_generated_unedited',
      matchedLastAiOutput: true,
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
    });
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: true,
      semanticNoOpDetected: evaluation.semanticNoOpDetected,
      semanticNoOpReason: evaluation.semanticNoOpReason,
      materialImprovementDetected: evaluation.materialImprovementDetected,
      materialImprovementKinds: evaluation.materialImprovementKinds,
      degradationDetected: evaluation.degradationDetected,
      degradationKinds: evaluation.degradationKinds,
    });

    expect(evaluation.semanticNoOpDetected).toBe(false);
    expect(evaluation.materialImprovementDetected).toBe(true);
    expect(evaluation.materialImprovementKinds.length).toBeGreaterThan(0);
    expect(decision.finalDecisionKind).toBe('material_improvement');
    expect(decision.shouldApply).toBe(true);
    expect(decision.shouldIncrementUsage).toBe(true);
    expect(getProAiUsageCount()).toBe(11);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(12);
  });

  it('grounded target generation without visible target text is meaningful +1', () => {
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: false,
      semanticNoOpDetected: false,
      materialImprovementDetected: false,
      materialImprovementKinds: [],
      allowMaterialApplyWithoutVisibleComparison: true,
    });
    expect(decision.finalDecisionKind).toBe('material_improvement');
    expect(decision.shouldApply).toBe(true);
    expect(decision.shouldIncrementUsage).toBe(true);
  });

  it('completed-role Experience uses the same semantic no-op/no-apply contract', () => {
    const { cv, finalized } = finalizeNeutral({ completed: true });
    expect(finalized.blocked).toBe(true);
    expect(finalized.countedAsSuccess).toBe(false);
    expect(finalized.text).toBe(VISIBLE_AR_COMPLETED);
    expect(finalized.diagnostics?.semanticNoOpDetected).toBe(true);
    expect(finalized.diagnostics?.materialImprovementDetected).toBe(false);
    expect(finalized.diagnostics?.finalDecisionKind).toBe('semantic_noop');
    expect(finalized.diagnostics?.canonicalExperienceDecisionAllowsApply).toBe(false);
    expect(applyFinalizedBulletsToCv(cv, 'ar', ENTRY_ID, finalized)).toBe(cv);
    expect(getProAiUsageCount()).toBe(11);
  });

  it('semantic no-op remains authoritative when a comparator also reports degradation', () => {
    const decision = decideExperienceCanonicalPreapply({
      candidateValidationAccepted: true,
      visibleComparisonAvailable: true,
      semanticNoOpDetected: true,
      semanticNoOpReason: 'neutral_restyle',
      materialImprovementDetected: false,
      materialImprovementKinds: [],
      neutralRestyleDetected: true,
      degradationDetected: true,
      degradationKinds: ['restyle_without_benefit'],
    });

    expect(decision.finalDecisionKind).toBe('semantic_noop');
    expect(decision.semanticNoOpDetected).toBe(true);
    expect(decision.degradationDetected).toBe(false);
    expect(decision.shouldApply).toBe(false);
    expect(decision.shouldIncrementUsage).toBe(false);
  });

  it.each(['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ru', 'hi', 'ja', 'ar', 'sr', 'hr'])(
    '%s uses the same neutral-restyle semantic-noop architecture',
    (locale) => {
      const decision = decideExperienceCanonicalPreapply({
        candidateValidationAccepted: true,
        visibleComparisonAvailable: true,
        semanticNoOpDetected: true,
        semanticNoOpReason: 'neutral_restyle',
        materialImprovementDetected: false,
        materialImprovementKinds: [],
        neutralRestyleDetected: true,
      });
      expect(decision.finalDecisionKind).toBe('semantic_noop');
      expect(decision.shouldApply).toBe(false);
      expect(decision.shouldIncrementUsage).toBe(false);
    },
  );
});
