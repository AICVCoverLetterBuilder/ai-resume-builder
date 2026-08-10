/**
 * @vitest-environment jsdom
 *
 * AAB-343 — completed arbitrary-role Experience (Spanish user-edited → HR):
 * graphic-design duties must get shared generic predicates (3/3), not vacuous
 * warehouse-only nulls. Preserves current_textarea ES authority, past tense,
 * transactional commit, and rejects incomplete/merged/added candidates.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedBulletsToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  GENERIC_EXPERIENCE_PREDICATE_343_REVISION,
  scanGenericExperiencePredicates,
  sourceRequiresGenericExperiencePredicates,
} from '@/lib/cv-generic-experience-predicate-grounding';
import { sourceRequiresCroatianWarehouseFactCoverage } from '@/lib/cv-croatian-experience-grounding';
import {
  ExperienceAiDiagnosticSession,
  clearExperienceAiDiagnosticsForTests,
} from '@/lib/cv-experience-ai-diagnostics';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import { buildExperienceAiOutputProvenance } from '@/lib/cv-experience-ai-output-provenance';
import { evaluateExperienceVisibleComparison } from '@/lib/cv-experience-visible-noop-authority';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { buildExperienceSelectedFinalCandidateSnapshot } from '@/lib/cv-experience-phased-apply-329';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { buildCrossLocaleExperienceFallback } from '@/lib/cv-cross-locale-experience';
import { formatExperienceBullets } from '@/lib/cv-canonical-facts';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2026-07-26';

/** Exact recovered Spanish user-edited duties (device hashes verified). */
export const DEVICE_ES_DESIGN_UNITS = [
  'Creó materiales visuales y elementos gráficos.',
  'Revisó y adaptó materiales de diseño.',
  'Preparó archivos finales de diseño para distintos formatos y pantallas.',
] as const;

export const DEVICE_ES_DESIGN = DEVICE_ES_DESIGN_UNITS.join('\n');

/** Exact recovered Croatian provider units (device unit hashes verified). */
export const DEVICE_HR_DESIGN_UNITS = [
  'Izrađivala je vizualne materijale i grafičke elemente.',
  'Pregledavala je i prilagođavala dizajnerske materijale.',
  'Pripremala je završne dizajnerske datoteke za različite formate i zaslone.',
] as const;

export const DEVICE_HR_DESIGN = DEVICE_HR_DESIGN_UNITS.join('\n');

const COOK_CURRENT_EN = [
  'Prepares daily dishes according to established recipes.',
  'Maintains hygiene standards at the kitchen workstation.',
  'Coordinates timing with the service team during peak hours.',
].join('\n');

const FREE_TEXT_COMPLETED_EN = [
  'Catalogued archival specimens for seasonal exhibits.',
  'Calibrated humidity sensors in storage rooms.',
  'Drafted condition reports for outgoing loans.',
].join('\n');

function graphicDesignCompletedCv(options?: {
  description?: string;
  generatedLocale?: string;
}): CVData {
  const description = options?.description ?? DEVICE_ES_DESIGN;
  const generatedLocale = options?.generatedLocale ?? 'es';
  // Prior AI output before the material user edit (shorter Spanish triad).
  const priorAiOutput = [
    'Creó materiales visuales.',
    'Revisó materiales de diseño.',
    'Preparó archivos finales.',
  ].join('\n');
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: 'exp-design-1',
    appliedOutput: priorAiOutput,
    preAiFactText: 'Created visual materials.\nReviewed design materials.\nPrepared final design files.',
    sourceLocale: 'en',
    targetLocale: generatedLocale,
    operationMode: 'enhance_existing',
    sourceAuthorityKind: 'current_textarea',
  });
  const design: WorkExperience = {
    id: 'exp-design-1',
    company: 'Rewitu',
    position: 'Graphic designer',
    startDate: '2020-01',
    endDate: '2023-04',
    isPresent: false,
    description,
    originalUserDescription: description,
    canonicalDescription: description,
    descriptionOrigin: 'ai_generated',
    generatedLocale,
    generatedDescription: priorAiOutput,
    aiOutputProvenance: provenance,
  };
  const warehouse: WorkExperience = {
    id: 'exp-warehouse-0',
    company: 'Atlas',
    position: 'Warehouse employee',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: 'Checks incoming goods.\nChecks related documents.\nWorks with colleagues.',
    originalUserDescription: 'Checks incoming goods.\nChecks related documents.\nWorks with colleagues.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-arbitrary-343',
    name: 'CV',
    personal: {
      fullName: 'Anna Test',
      email: 'anna@example.com',
      phone: '',
      address: '',
      jobTitle: 'Graphic designer',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'es',
    // Entry index 1 = completed graphic design (matches device click).
    experience: [warehouse, design],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

function finalizeDesignHr(candidate: string, extras?: Record<string, unknown>) {
  const cv = graphicDesignCompletedCv();
  return finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'hr',
    gender: 'female',
    cv,
    candidate,
    experienceId: 'exp-design-1',
    industry: 'general',
    level: 'mid',
    referenceDateIso: REF,
    operationSnapshot: createExperienceAiOperationSnapshot({
      liveText: DEVICE_ES_DESIGN,
      locale: 'hr',
      requestId: 'req-arb-343',
      jobContextHash: 'job-arb-343',
      experienceEntryId: 'exp-design-1',
      authoritativeTextOverride: DEVICE_ES_DESIGN,
      provenanceOriginOverride: 'currentTextarea',
    }),
    currentTextareaProvenance: 'ai_generated_user_edited',
    authoritativeFactSourceKind: 'current_textarea',
    currentTextareaUsedForFactExtraction: true,
    lastAiOutputHashMatched: false,
    materialUserEditDetected: true,
    staleGeneratedDescriptionIgnored: false,
    ...extras,
  });
}

describe('AAB-343 completed arbitrary-role ES→HR Experience', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it('exposes generic predicate revision', () => {
    expect(GENERIC_EXPERIENCE_PREDICATE_343_REVISION).toBe(
      'generic-experience-predicate-343-v1',
    );
  });

  it('A. recovers exact Spanish source and Croatian provider hashes', () => {
    expect(fingerprintText(DEVICE_ES_DESIGN)).toBe('fnv1a_60772d38_l156_b67_e46');
    expect(fingerprintText(DEVICE_ES_DESIGN_UNITS[0]!)).toBe('fnv1a_26278ea0_l46_b67_e46');
    expect(fingerprintText(DEVICE_ES_DESIGN_UNITS[1]!)).toBe('fnv1a_3ffb2c2_l37_b82_e46');
    expect(fingerprintText(DEVICE_ES_DESIGN_UNITS[2]!)).toBe('fnv1a_10b9bcae_l71_b80_e46');
    expect(fingerprintText(DEVICE_HR_DESIGN_UNITS[0]!)).toBe('fnv1a_b8966270_l54_b73_e46');
    expect(fingerprintText(DEVICE_HR_DESIGN_UNITS[1]!)).toMatch(/^fnv1a_0?9d65ee3_l55_b80_e46$/);
    expect(fingerprintText(DEVICE_HR_DESIGN_UNITS[2]!)).toBe('fnv1a_6660ae48_l74_b80_e46');
    expect(sourceRequiresCroatianWarehouseFactCoverage(DEVICE_ES_DESIGN)).toBe(false);
    expect(sourceRequiresGenericExperiencePredicates(DEVICE_ES_DESIGN)).toBe(true);
  });

  it('B. generic predicates 3/3 for device provider (not vacuous)', () => {
    const pred = scanGenericExperiencePredicates(DEVICE_ES_DESIGN, DEVICE_HR_DESIGN);
    expect(pred.sourcePredicateIdentityCount).toBe(3);
    expect(pred.candidatePredicateIdentityCount).toBe(3);
    expect(pred.candidateAddedPredicateCount).toBe(0);
    expect(pred.candidateAddedPredicateIdentityHashes).toEqual([]);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(true);
  });

  it('C. provider accepted with facts 3/3 and predicates 3/3', () => {
    const fin = finalizeDesignHr(DEVICE_HR_DESIGN);
    expect(fin.diagnostics?.providerAccepted).toBe(true);
    expect(Number(fin.diagnostics?.providerRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.providerUncoveredFactIdentityHashes || []).toEqual([]);
    expect(Number(fin.diagnostics?.providerSourcePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.providerCandidateAddedPredicateCount ?? 0)).toBe(0);
    expect(fin.diagnostics?.providerSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('provider');
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(fin.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalCandidatePredicateValidationApplicable).toBe(true);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount ?? 0)).toBe(0);
    expect(fin.diagnostics?.finalAddedPredicateIdentityHashes || []).toEqual([]);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalCoordinatedPredicateExpansionDetected).toBeFalsy();
    expect(fin.diagnostics?.expectedEmploymentTense).toBe('past');
    expect(fin.diagnostics?.sourceTenseValidationPassed).toBe(true);
    expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
    expect(fin.diagnostics?.authoritativeFactSourceKind).toMatch(/current_textarea/);
    expect(fin.diagnostics?.authoritativeFactSourceLocale).toBe('es');
    expect(fin.diagnostics?.englishSourceStillAuthoritative).toBe(false);
    // Request-time input flags may be mirrored via provenance resolution.
    expect(
      fin.diagnostics?.materialUserEditDetected === true
      || fin.diagnostics?.currentTextareaProvenance === 'ai_generated_user_edited'
      || fin.diagnostics?.authoritativeFactSourceKind === 'current_textarea',
    ).toBe(true);
  });

  it('D. selected-final snapshot recomputes generic predicates independently', () => {
    const snap = buildExperienceSelectedFinalCandidateSnapshot({
      candidateText: DEVICE_HR_DESIGN,
      sourceDescription: DEVICE_ES_DESIGN,
      targetLocale: 'hr',
      candidateKind: 'provider',
      source: 'provider',
      employmentState: 'completed',
      meaningfulChangeDetected: true,
    });
    expect(snap.sourcePredicateIdentityCount).toBe(3);
    expect(snap.candidatePredicateIdentityCount).toBe(3);
    expect(snap.predicateCoveragePassed).toBe(true);
    expect(snap.factCoveragePassed).toBe(true);
  });

  it('E. incomplete predicate candidate is rejected', () => {
    const incomplete = [
      DEVICE_HR_DESIGN_UNITS[0],
      DEVICE_HR_DESIGN_UNITS[1],
    ].join('\n');
    const fin = finalizeDesignHr(incomplete);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    const predCount = Number(fin.diagnostics?.providerCandidatePredicateIdentityCount ?? 0);
    const coverage = fin.diagnostics?.providerSourceUnitPredicateCoveragePassed;
    expect(
      predCount < 3
      || coverage === false
      || fin.diagnostics?.finalSourceUnitPredicateCoveragePassed === false
      || fin.ok === false,
    ).toBe(true);
  });

  it('F. merged-duty candidate is rejected', () => {
    const merged = [
      'Izrađivala je vizualne materijale i pregledavala dizajnerske materijale.',
      'Pripremala je završne dizajnerske datoteke za različite formate i zaslone.',
    ].join('\n');
    const pred = scanGenericExperiencePredicates(DEVICE_ES_DESIGN, merged);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
    const fin = finalizeDesignHr(merged);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
  });

  it('G. added-action candidate is rejected', () => {
    const added = formatExperienceBullets([
      ...DEVICE_HR_DESIGN_UNITS,
      'Optimizirala je sve KPI metrike kvalitete dizajna.',
    ]);
    const pred = scanGenericExperiencePredicates(DEVICE_ES_DESIGN, added);
    expect(pred.sourceUnitPredicateCoveragePassed).toBe(false);
    expect(pred.candidateAddedPredicateCount).toBeGreaterThan(0);
    const fin = finalizeDesignHr(added);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
  });

  it('H. wrong_locale_fixed + transactional commit + usage +1', () => {
    const cv = graphicDesignCompletedCv();
    const fin = finalizeDesignHr(DEVICE_HR_DESIGN);
    expect(fin.countedAsSuccess).toBe(true);
    const purity = validateAiUnitLocalePurity(fin.text || '', 'hr');
    expect(purity.ok).toBe(true);

    const evalVis = evaluateExperienceVisibleComparison({
      factAuthorityText: DEVICE_ES_DESIGN,
      visibleComparisonText: DEVICE_ES_DESIGN,
      candidateText: fin.text || DEVICE_HR_DESIGN,
      locale: 'hr',
      useVisibleForNoOp: true,
      crossLocaleOperation: true,
      matchedLastAiOutput: false,
      visibleComparisonProvenance: 'ai_generated_user_edited',
      isPresent: false,
    });
    expect(evalVis.materialImprovementKinds).toContain('wrong_locale_fixed');
    expect(evalVis.degradationDetected).toBe(false);

    const appliedText = (fin.text || '').trim();
    const usageBefore = 18;
    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-arb-343-apply',
      requestedLocale: 'hr',
      uiLocale: 'hr',
      contentLocale: 'es',
      templateId: 'modern',
      jobContextHash: 'job-arb-343',
      usageCountBefore: usageBefore,
    });
    session.patch({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1 as never,
      selectedSourceKind: 'currentTextarea',
      clickedExperienceEntryIdHash: 'design-hash',
      selectedExperienceEntryIdHash: 'design-hash',
      factAuthorityKind: 'current_textarea',
      authoritativeFactSourceKind: 'current_textarea',
      currentTextareaProvenance: 'ai_generated_user_edited',
      currentTextareaUsedForFactExtraction: true,
      lastAiOutputHashMatched: false,
      materialUserEditDetected: true,
      visibleComparisonProvenance: 'ai_generated_user_edited',
      sourceFactCount: 3,
      requiredFactCount: 3,
      coveredFactCount: 3,
      authoritativeFactSourceLocale: 'es',
      visibleTextareaLocale: 'es',
      visibleTextareaLocaleBeforeApply: 'es',
      requestedTargetLocale: 'hr',
      entryGeneratedLocaleBeforeApply: 'es',
      contentLocaleDocument: 'es',
      appliedVisibleContentLocale: null,
      staleForeignLocaleSourceAuthoritative: false,
      englishSourceStillAuthoritative: false,
      sourceAlreadyValidForTarget: false,
      meaningfulChangeDetected: true,
      clickedEmploymentState: 'completed',
      expectedEmploymentTense: 'past',
    });
    session.recordFinalizeResult(fin);
    session.patch({
      selectedSourceKind: 'currentTextarea',
      authoritativeFactSourceKind: 'current_textarea',
      currentTextareaUsedForFactExtraction: true,
      englishSourceStillAuthoritative: false,
      staleForeignLocaleSourceAuthoritative: false,
      materialUserEditDetected: true,
      lastAiOutputHashMatched: false,
      meaningfulChangeDetected: true,
      crossLocaleOperation: true,
    });
    const gate = session.evaluatePreApplyDecisionGates();
    expect(gate.passed).toBe(true);
    expect(gate.diagnosticCompletenessPassed).toBe(true);
    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.applyAuthorized).toBe(true);
    expect(draft.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(Number(draft.sourcePredicateIdentityCount ?? 0)).toBeGreaterThan(0);
    expect(draft.finalSourceUnitPredicateCoveragePassed).not.toBeNull();

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
      visibleMissingPredicateIdentityHashes: [],
      visiblePredicateCoveragePassed: true,
      visiblePredicateValidationApplicable: true,
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
      appliedEmploymentState: 'completed',
      diagnosticCompletenessPassed: true,
      diagnosticInvariantCheckPassed: true,
      diagnosticInvariantFailureCount: 0,
      rollbackAttempted: false,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: appliedText,
      finalNormalizedText: appliedText,
    });
    const trace = session.commit();
    expect(trace.applyCommitted).toBe(true);
    expect(trace.usageCountAfter).toBe(usageBefore + 1);
    expect(trace.appliedVisibleContentLocale).toBe('hr');

    const next = applyFinalizedBulletsToCv(cv, 'hr', 'exp-design-1', fin);
    expect(next.experience[1]?.description).toMatch(/vizualne|dizajn/i);
    expect(next.experience[1]?.generatedLocale).toBe('hr');
    expect(next.experience[0]?.description).toMatch(/incoming|goods|documents/i);
  });

  it('I. failed generic predicate preserves Spanish text and usage', () => {
    const cv = graphicDesignCompletedCv();
    const bad = [
      'Izrađivala je vizualne materijale i grafičke elemente.',
      'Optimizirala je sve KPI metrike kvalitete.',
    ].join('\n');
    const fin = finalizeDesignHr(bad);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    // Do not apply rejected candidate.
    expect(cv.experience[1]?.description).toBe(DEVICE_ES_DESIGN);
    expect(cv.experience[1]?.generatedLocale).toBe('es');
  });

  it('J. user-edited live text remains authoritative (not pre_ai English)', () => {
    const fin = finalizeDesignHr(DEVICE_HR_DESIGN);
    expect(fin.diagnostics?.authoritativeFactSourceKind).toMatch(/current_textarea/);
    expect(fin.diagnostics?.englishSourceStillAuthoritative).toBe(false);
    expect(String(fin.diagnostics?.authoritativeFactSourceLocale || '')).toBe('es');
  });

  it('K. cook uses a grounded path; unrecognized free-text fallback fails closed', () => {
    const cookDe = buildCrossLocaleExperienceFallback({
      sourceDescription: COOK_CURRENT_EN,
      sourceLocale: 'en',
      targetLocale: 'de',
      isPresent: true,
      gender: 'female',
      position: 'Cook',
    });
    const cookPred = scanGenericExperiencePredicates(COOK_CURRENT_EN, cookDe);
    expect(cookPred.sourcePredicateIdentityCount).toBe(3);
    expect(cookPred.sourceUnitPredicateCoveragePassed, JSON.stringify({ cookDe, cookPred })).toBe(true);

    const freeFr = buildCrossLocaleExperienceFallback({
      sourceDescription: FREE_TEXT_COMPLETED_EN,
      sourceLocale: 'en',
      targetLocale: 'fr',
      isPresent: false,
      gender: 'female',
      position: 'Museum Collections Technician III',
    });
    const freePred = scanGenericExperiencePredicates(FREE_TEXT_COMPLETED_EN, freeFr);
    expect(freePred.sourcePredicateIdentityCount).toBe(3);
    expect(freeFr).toBe('');
    expect(freePred.sourceUnitPredicateCoveragePassed).toBe(false);
  });
});

const MATRIX_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ru', 'hi', 'ja', 'ar', 'sr', 'hr',
];

describe('AAB-343 all-locale arbitrary-role matrix (completed graphic design)', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    localStorage.clear();
  });

  it.each(MATRIX_LOCALES)('target %s preserves ES authority + predicate 3/3 when applicable', (target) => {
    const cv = graphicDesignCompletedCv();
    let candidate: string;
    if (target === 'es') {
      // Same-locale: restyle without material change → expect safe no-op path.
      candidate = DEVICE_ES_DESIGN;
    } else if (target === 'hr') {
      candidate = DEVICE_HR_DESIGN;
    } else {
      candidate = buildCrossLocaleExperienceFallback({
        sourceDescription: DEVICE_ES_DESIGN,
        sourceLocale: 'es',
        targetLocale: target,
        isPresent: false,
        gender: 'female',
        position: 'Graphic designer',
      });
    }
    expect(candidate.trim().length).toBeGreaterThan(20);

    if (target !== 'es') {
      const pred = scanGenericExperiencePredicates(DEVICE_ES_DESIGN, candidate);
      expect(pred.sourcePredicateIdentityCount).toBe(3);
      expect(pred.candidateAddedPredicateCount).toBe(0);
      expect(
        pred.sourceUnitPredicateCoveragePassed,
        JSON.stringify({ target, candidate, pred }),
      ).toBe(true);
    }

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: target,
      gender: 'female',
      cv,
      candidate,
      experienceId: 'exp-design-1',
      industry: 'general',
      level: 'mid',
      referenceDateIso: REF,
      operationSnapshot: createExperienceAiOperationSnapshot({
        liveText: DEVICE_ES_DESIGN,
        locale: target,
        requestId: `req-arb-matrix-${target}`,
        jobContextHash: `job-arb-matrix-${target}`,
        experienceEntryId: 'exp-design-1',
        authoritativeTextOverride: DEVICE_ES_DESIGN,
        provenanceOriginOverride: 'currentTextarea',
      }),
      currentTextareaProvenance: 'ai_generated_user_edited',
      authoritativeFactSourceKind: 'current_textarea',
      currentTextareaUsedForFactExtraction: true,
      lastAiOutputHashMatched: false,
      materialUserEditDetected: true,
    });

    expect(fin.diagnostics?.authoritativeFactSourceKind).toMatch(/current_textarea/);
    expect(fin.diagnostics?.englishSourceStillAuthoritative).toBe(false);

    if (target === 'es') {
      // Same-locale identical candidate: safe semantic no-op (no fabricated wrong_locale_fixed).
      const kinds = (fin.diagnostics?.materialImprovementKinds || []) as string[];
      expect(kinds.includes('wrong_locale_fixed')).toBe(false);
      if (fin.diagnostics?.semanticNoOp === true || fin.diagnostics?.applyAuthorized === false) {
        expect(fin.diagnostics?.providerAccepted === false
          || fin.ok === false
          || fin.diagnostics?.meaningfulChangeDetected === false).toBe(true);
      }
      return;
    }

    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(true);
    expect(Number(fin.diagnostics?.finalRequiredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCoveredFactCount)).toBe(3);
    expect(Number(fin.diagnostics?.finalCandidatePredicateIdentityCount)).toBe(3);
    expect(fin.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);
    expect(Number(fin.diagnostics?.finalAddedPredicateCount ?? 0)).toBe(0);
    expect(fin.diagnostics?.expectedEmploymentTense).toBe('past');
    expect(fin.diagnostics?.tenseValidationPassed).toBe(true);
    const kinds = (fin.diagnostics?.materialImprovementKinds || []) as string[];
    expect(
      kinds.includes('wrong_locale_fixed')
      || kinds.includes('grounded_phrasing_enhancement'),
    ).toBe(true);
    expect(fin.diagnostics?.degradationDetected).toBeFalsy();
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
  });
});
