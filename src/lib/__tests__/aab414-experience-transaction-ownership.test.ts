/**
 * @vitest-environment jsdom
 *
 * AAB414 device regression: authorized Experience output is owned by one
 * stable-entry transaction from synchronous CV write through visible truth.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  type FinalizeCvAiFieldResult,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildExperienceAiOutputProvenance,
  resolveExperienceTextareaProvenance,
} from '@/lib/cv-experience-ai-output-provenance';
import { buildHindiWarehouseExperienceFallback } from '@/lib/cv-hindi-experience-grounding';
import { createExperienceAiOperationSnapshot } from '@/lib/cv-experience-ai-operation-snapshot';
import {
  checkExperiencePostapplyDiagnosticCompleteness,
  validateVisibleExperienceCoverage,
} from '@/lib/cv-experience-phased-apply-329';
import { ExperienceAiDiagnosticSession } from '@/lib/cv-experience-ai-diagnostics';
import { formatExperienceBullets, splitExperienceBullets } from '@/lib/cv-canonical-facts';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  EXPERIENCE_TRANSACTION_OWNERSHIP_414_REVISION,
  commitExperienceApplyTransactionally,
  createExperienceApplyOwnershipState,
  hashExperienceTextForApply,
  rollbackExperienceApplyTransactionally,
  shouldAcceptIncomingExperienceCv,
} from '@/lib/cv-experience-transactional-apply';

const DEVICE_ID = 'exp-device-414';
const DEVICE_SOURCE = [
  'Proveravam dolaznu robu.',
  'Proveravam prate\u0107u dokumentaciju za primljenu robu.',
  'Koordiniram sa kolegama pripremu i kretanje robe.',
].join('\n');
const SAFE_HI = buildHindiWarehouseExperienceFallback({
  sourceDescription: DEVICE_SOURCE,
  isPresent: true,
  gender: 'female',
});
const PRIOR_HI = SAFE_HI;

function baseCv(options?: {
  description?: string;
  generatedDescription?: string;
  includeProvenance?: boolean;
  secondEntry?: boolean;
}): CVData {
  const generatedDescription = options?.generatedDescription ?? PRIOR_HI;
  const current: WorkExperience = {
    id: DEVICE_ID,
    company: 'Current employer',
    position: 'Operater prijema robe',
    startDate: '2025-01',
    endDate: '',
    isPresent: true,
    description: options?.description ?? DEVICE_SOURCE,
    originalUserDescription: 'Prior original reception duty.',
    canonicalDescription: 'Prior original reception duty.',
    generatedDescription,
    generatedLocale: 'hi',
    descriptionOrigin: 'ai_generated',
    ...(options?.includeProvenance === false
      ? {}
      : {
        aiOutputProvenance: buildExperienceAiOutputProvenance({
          experienceEntryId: DEVICE_ID,
          appliedOutput: generatedDescription,
          preAiFactText: 'Prior original reception duty.',
          sourceLocale: 'en',
          targetLocale: 'hi',
          sourceAuthorityKind: 'original_user',
        }),
      }),
  };
  const prior: WorkExperience = {
    id: 'exp-prior-414',
    company: 'Prior employer',
    position: 'Laboratory assistant',
    startDate: '2022-01',
    endDate: '2024-12',
    isPresent: false,
    description: 'Prepared samples.\nRecorded observations.',
    originalUserDescription: 'Prepared samples.\nRecorded observations.',
    descriptionOrigin: 'user',
  };
  return {
    id: 'cv-aab414',
    name: 'CV',
    personal: {
      fullName: 'Test User',
      email: 'test@example.com',
      phone: '',
      address: '',
      jobTitle: 'Operater prijema robe',
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'sr',
    experience: options?.secondEntry ? [current, prior] : [current],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
  };
}

function finalized(text: string, origin = 'deterministic_fallback'): FinalizeCvAiFieldResult {
  return {
    blocked: false,
    countedAsSuccess: true,
    text,
    origin: origin as FinalizeCvAiFieldResult['origin'],
    diagnostics: { sourceWasEmpty: false },
  } as FinalizeCvAiFieldResult;
}

function finalizeExactDevice(cv: CVData) {
  const operationSnapshot = createExperienceAiOperationSnapshot({
    liveText: DEVICE_SOURCE,
    locale: 'hi',
    requestId: 'req-device-414',
    jobContextHash: 'job-device-414',
    experienceEntryId: DEVICE_ID,
  });
  const safeUnits = splitExperienceBullets(SAFE_HI);
  const providerTwoOfThree = formatExperienceBullets([safeUnits[0]!, safeUnits[2]!]);
  const result = finalizeCvAiFieldForApply({
    action: 'experience_bullets',
    field: 'experience_description',
    requestedLocale: 'hi',
    gender: 'female',
    cv,
    candidate: providerTwoOfThree,
    originHint: 'ai_generated',
    experienceId: DEVICE_ID,
    industry: 'general',
    level: 'mid',
    operationSnapshot,
  });
  return { operationSnapshot, result };
}

describe('AAB414 Experience transaction ownership / post-write truth', () => {
  beforeEach(() => localStorage.clear());

  it('retains the exact device fallback hash and commits visible 3/3 truth with usage +1', () => {
    const cv = baseCv();
    const provenance = resolveExperienceTextareaProvenance(cv.experience[0]!);
    expect(provenance.currentTextareaProvenance).toBe('ai_generated_user_edited');
    expect(provenance.authoritativeFactSourceKind).toBe('current_textarea');
    expect(provenance.materialUserEditDetected).toBe(true);

    const { operationSnapshot, result } = finalizeExactDevice(cv);
    expect(result.diagnostics?.providerAccepted).toBe(false);
    expect(result.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(result.text).toBe(SAFE_HI);
    expect(result.diagnostics?.finalFactCoveragePassed).toBe(true);
    expect(result.diagnostics?.finalSourceUnitPredicateCoveragePassed).toBe(true);

    const cvRef = { current: cv };
    const ownership = createExperienceApplyOwnershipState();
    let reactCv = cv;
    let usage = 0;
    const tx = commitExperienceApplyTransactionally({
      cvRef,
      ownership,
      locale: 'hi',
      experienceId: DEVICE_ID,
      finalized: result,
      operationSourceText: operationSnapshot.visibleComparisonRawText,
      currentVisibleText: DEVICE_SOURCE,
      operationId: operationSnapshot.requestId,
      scheduleReactCv: (next) => { reactCv = next; },
    });
    if (tx.ok) usage += 1;

    const visible = validateVisibleExperienceCoverage({
      sourceDescription: DEVICE_SOURCE,
      visibleText: tx.writtenDescription,
      targetLocale: 'hi',
      finalNormalizedHash: hashExperienceTextForApply(result.text),
    });
    expect(tx.ok).toBe(true);
    expect(tx.lifecycle.postWriteReadSource).toBe('operation_owned_written_experience');
    expect(tx.lifecycle.transactionEntryIdHash).toBe(fingerprintText(DEVICE_ID));
    expect(tx.lifecycle.transactionWrittenHash).toBe(hashExperienceTextForApply(result.text));
    expect(cvRef.current.experience[0]!.description).toBe(result.text);
    expect(reactCv.experience[0]!.description).toBe(result.text);
    expect(visible.visibleCoveredFactCount).toBe(3);
    expect(visible.visibleCoveredPredicateCount).toBe(3);
    expect(visible.visibleFactCoveragePassed).toBe(true);
    expect(visible.visiblePredicateCoveragePassed).toBe(true);
    expect(visible.visibleLocaleValidationPassed).toBe(true);
    expect(visible.visibleDescriptionMatchesFinalHash).toBe(true);
    expect(usage).toBe(1);
  });

  it('covers fresh, unedited, user-edited, formatting-only, and hydrated provenance states', () => {
    const fresh = baseCv({ description: DEVICE_SOURCE, generatedDescription: '', includeProvenance: false });
    fresh.experience[0]!.descriptionOrigin = 'user';
    fresh.experience[0]!.originalUserDescription = DEVICE_SOURCE;
    expect(resolveExperienceTextareaProvenance(fresh.experience[0]!).currentTextareaProvenance)
      .toBe('user_authored');

    const unedited = baseCv({ description: PRIOR_HI });
    expect(resolveExperienceTextareaProvenance(unedited.experience[0]!).currentTextareaProvenance)
      .toBe('ai_generated_unedited');

    const edited = baseCv();
    expect(resolveExperienceTextareaProvenance(edited.experience[0]!).currentTextareaProvenance)
      .toBe('ai_generated_user_edited');

    const formatting = baseCv({ description: PRIOR_HI.replace(/\n/g, '\r\n') });
    const formattingTruth = resolveExperienceTextareaProvenance(formatting.experience[0]!);
    expect(formattingTruth.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(formattingTruth.materialUserEditDetected).toBe(false);

    const hydrated = JSON.parse(JSON.stringify(edited)) as CVData;
    const hydratedTruth = resolveExperienceTextareaProvenance(hydrated.experience[0]!);
    expect(hydratedTruth.currentTextareaProvenance).toBe('ai_generated_user_edited');
    expect(hydratedTruth.authoritativeFactText).toBe(DEVICE_SOURCE);
  });

  it('keeps multiple entries isolated and blocks stale incoming snapshots', () => {
    const cv = baseCv({ secondEntry: true });
    const priorText = cv.experience[1]!.description;
    const cvRef = { current: cv };
    const ownership = createExperienceApplyOwnershipState();
    const tx = commitExperienceApplyTransactionally({
      cvRef,
      ownership,
      locale: 'hi',
      experienceId: DEVICE_ID,
      finalized: finalized(SAFE_HI),
      operationSourceText: DEVICE_SOURCE,
      currentVisibleText: DEVICE_SOURCE,
      operationId: 'req-isolation',
      scheduleReactCv: () => {},
    });
    expect(tx.ok).toBe(true);
    expect(cvRef.current.experience[1]!.description).toBe(priorText);
    expect(shouldAcceptIncomingExperienceCv({
      ownership,
      incomingCv: cv,
      localCvRef: cvRef.current,
    })).toBe(false);
  });

  it('rejects a newer user edit before write and bills +0', () => {
    const cv = baseCv();
    const cvRef = { current: cv };
    let usage = 0;
    const tx = commitExperienceApplyTransactionally({
      cvRef,
      ownership: createExperienceApplyOwnershipState(),
      locale: 'hi',
      experienceId: DEVICE_ID,
      finalized: finalized(SAFE_HI),
      operationSourceText: DEVICE_SOURCE,
      currentVisibleText: `${DEVICE_SOURCE}\nNova korisni\u010dka izmena.`,
      operationId: 'req-stale',
      scheduleReactCv: () => { throw new Error('must not schedule'); },
    });
    if (tx.ok) usage += 1;
    expect(tx.ok).toBe(false);
    expect(tx.lifecycle.actualRaceReason).toBe('source_hash_changed_before_write');
    expect(cvRef.current).toBe(cv);
    expect(usage).toBe(0);
  });

  it('classifies an actual non-materialized write, restores the prior snapshot, and bills +0', () => {
    const cv = baseCv();
    const cvRef = { current: cv };
    const ownership = createExperienceApplyOwnershipState();
    let scheduled = cv;
    const tx = commitExperienceApplyTransactionally({
      cvRef,
      ownership,
      locale: 'hi',
      experienceId: DEVICE_ID,
      finalized: finalized(SAFE_HI),
      operationSourceText: DEVICE_SOURCE,
      currentVisibleText: DEVICE_SOURCE,
      operationId: 'req-write-fail',
      scheduleReactCv: (next) => { scheduled = next; },
      applyToCv: (input) => input,
    });
    const rollback = rollbackExperienceApplyTransactionally({
      cvRef,
      ownership,
      experienceId: DEVICE_ID,
      previousCv: tx.previousCv,
      scheduleReactCv: (next) => { scheduled = next; },
    });
    expect(tx.ok).toBe(false);
    expect(tx.lifecycle.failureKind).toBe('write_did_not_materialize_selected_hash');
    expect(rollback).toBe(true);
    expect(scheduled.experience[0]!.description).toBe(DEVICE_SOURCE);
  });

  it('uses the transaction snapshot while React is deferred, then converges the textarea state', () => {
    const cv = baseCv();
    const cvRef = { current: cv };
    let pending: CVData | null = null;
    const tx = commitExperienceApplyTransactionally({
      cvRef,
      ownership: createExperienceApplyOwnershipState(),
      locale: 'hi',
      experienceId: DEVICE_ID,
      finalized: finalized(SAFE_HI),
      operationSourceText: DEVICE_SOURCE,
      currentVisibleText: DEVICE_SOURCE,
      operationId: 'req-deferred-render',
      scheduleReactCv: (next) => { pending = next; },
    });
    expect(tx.ok).toBe(true);
    expect(cvRef.current.experience[0]!.description).toBe(SAFE_HI);
    expect(tx.writtenDescription).toBe(SAFE_HI);
    expect((pending as CVData | null)?.experience[0]!.description).toBe(SAFE_HI);
  });

  it('supports an arbitrary occupation and a Latin target locale', () => {
    const source = [
      'Develops application features and APIs.',
      'Tests features with automated checks.',
      'Documents implementation details for the team.',
    ].join('\n');
    const german = formatExperienceBullets([
      'Entwickelt Anwendungsfunktionen und APIs.',
      'Testet Funktionen mit automatisierten Pr\u00fcfungen.',
      'Dokumentiert Implementierungsdetails f\u00fcr das Team.',
    ]);
    const cv = baseCv({ description: source, generatedDescription: '' });
    cv.experience[0]!.position = 'Software engineer';
    cv.experience[0]!.descriptionOrigin = 'user';
    cv.experience[0]!.originalUserDescription = source;
    const cvRef = { current: cv };
    const tx = commitExperienceApplyTransactionally({
      cvRef,
      ownership: createExperienceApplyOwnershipState(),
      locale: 'de',
      experienceId: DEVICE_ID,
      finalized: finalized(german, 'ai_generated'),
      operationSourceText: source,
      currentVisibleText: source,
      operationId: 'req-software-de',
      scheduleReactCv: () => {},
    });
    const visible = validateVisibleExperienceCoverage({
      sourceDescription: source,
      visibleText: tx.writtenDescription,
      targetLocale: 'de',
      finalNormalizedHash: hashExperienceTextForApply(german),
    });
    expect(tx.ok).toBe(true);
    expect(visible.visibleLocaleValidationPassed).toBe(true);
    expect(visible.visibleDescriptionMatchesFinalHash).toBe(true);
  });

  it('derives locale/fact/predicate/hash truth from one snapshot and keeps completeness coherent', () => {
    const visible = validateVisibleExperienceCoverage({
      sourceDescription: DEVICE_SOURCE,
      visibleText: DEVICE_SOURCE,
      targetLocale: 'hi',
      finalNormalizedHash: hashExperienceTextForApply(SAFE_HI),
    });
    expect(visible.visibleDescriptionMatchesFinalHash).toBe(false);
    expect(visible.visibleFactCoveragePassed).toBe(false);
    expect(visible.visiblePredicateCoveragePassed).toBe(false);
    expect(visible.visibleLocaleValidationPassed).toBe(false);

    const post = checkExperiencePostapplyDiagnosticCompleteness({
      applyAuthorized: true,
      applyAttempted: true,
      applyWriteSucceeded: true,
      visibleValidationAttempted: true,
      visibleValidationPassed: false,
      applyCommitted: false,
      visibleDescriptionMatchesFinalHash: false,
      visibleRequiredFactCount: 3,
      visibleCoveredFactCount: 0,
      visibleUncoveredFactIdentityHashes: ['a', 'b', 'c'],
      visibleFactCoveragePassed: false,
      visibleRequiredPredicateCount: 3,
      visibleCoveredPredicateCount: 0,
      visiblePredicateCoveragePassed: false,
      visibleNormalizedHash: visible.visibleNormalizedHash,
      visibleLocaleValidationPassed: false,
      visibleTenseValidationPassed: true,
    });
    expect(post.passed).toBe(true);
    expect(post.missingRequiredDiagnosticFields).toEqual([]);
    expect(post.nullRequiredDiagnosticFields).toEqual([]);

    const session = new ExperienceAiDiagnosticSession({
      requestId: 'req-completeness-414',
      requestedLocale: 'hi',
      uiLocale: 'hi',
      templateId: 'modern',
      jobContextHash: 'job-414',
      usageCountBefore: 0,
    });
    session.patch({
      preapplyDiagnosticCompletenessPassed: true,
      preapplyDiagnosticInvariantCheckPassed: true,
      applyAuthorized: true,
      applyAttempted: true,
      applyWriteSucceeded: true,
      visibleValidationAttempted: true,
      visibleValidationPassed: false,
      applyCommitted: false,
      targetContentApplied: false,
      visibleDescriptionMatchesFinalHash: false,
      visibleRequiredFactCount: 3,
      visibleCoveredFactCount: 0,
      visibleUncoveredFactIdentityHashes: ['a', 'b', 'c'],
      visibleFactCoveragePassed: false,
      visibleRequiredPredicateCount: 3,
      visibleCoveredPredicateCount: 0,
      visiblePredicateCoveragePassed: false,
      visibleNormalizedHash: visible.visibleNormalizedHash,
      visibleLocaleValidationPassed: false,
      visibleTenseValidationPassed: true,
    });
    const trace = session.commit();
    expect(trace.postapplyDiagnosticCompletenessPassed).toBe(true);
    expect(trace.postapplyMissingRequiredDiagnosticFields).toEqual([]);
    expect(trace.postapplyNullRequiredDiagnosticFields).toEqual([]);
  });

  it('wires write-failure identity only to an actual transaction write failure', async () => {
    expect(EXPERIENCE_TRANSACTION_OWNERSHIP_414_REVISION)
      .toBe('experience-transaction-ownership-414-v1');
    const page = await import('node:fs/promises').then((fs) => (
      fs.readFile('src/app/cv-builder/page.tsx', 'utf8')
    ));
    expect(page).toContain('const actualWriteFailure = !applyTransaction.ok;');
    expect(page).toMatch(/finalTypedFailureReason:\s*actualWriteFailure[\s\S]*?'visible_apply_write_failed'[\s\S]*?'visible_apply_validation_failed'/);
    expect(page).not.toContain("diagSession.stage('temporary_visible_write', 'ok');");
  });
});
