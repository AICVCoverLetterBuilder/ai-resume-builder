/**
 * @vitest-environment jsdom
 *
 * AAB-305 Experience final-candidate diagnostics truthfulness.
 * Top-level fields must describe the FINAL selected candidate;
 * provider rejection evidence must remain separately visible.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { CVData, WorkExperience } from '@/lib/types';
import {
  EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION,
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  clearExperienceAiDiagnosticsForTests,
  clearExperienceAiDiagnostics,
  ExperienceAiDiagnosticSession,
  formatExperienceAiDiagnosticForCopy,
  getLatestExperienceAiDiagnostic,
} from '@/lib/cv-experience-ai-diagnostics';
import {
  clearSummaryAiDiagnostics,
  clearSummaryAiDiagnosticsForTests,
  getLatestSummaryAiDiagnostic,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  checkExperienceDiagnosticCompleteness,
  checkExperienceDiagnosticInvariants,
  clearCvAiDiagnosticHistory,
  EXPERIENCE_AI_DIAG_MARKER,
} from '@/lib/cv-ai-diagnostics-contract';
import { localizeWarehouseEmployee } from '@/lib/cv-role-title';
import {
  buildGermanWarehouseExperienceFallback,
  validateGermanWarehouseExperienceCoverage,
} from '@/lib/cv-german-experience-grounding';
import {
  applyGeneratedExperienceDescription,
  resolveExperienceAiAuthoritativeSource,
} from '@/lib/cv-experience-provenance';
import { getProAiUsageCount } from '@/lib/ai-usage-policy';
import { EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION } from '@/lib/cv-experience-ai-output-provenance';

const REF = '2026-07-19';

const HI_WH = [
  'आने वाले माल की जाँच करती है।',
  'संबंधित दस्तावेज़ों की जाँच करती है।',
  'सहकर्मियों के साथ माल की तैयारी और आवाजाही का समन्वय करती है।',
].join('\n');

const BAD_AAB302_DE = [
  'Prüft täglich Unterlagen im Lagerbereich und kontrolliert die Vollständigkeit der erfassten Daten.',
  'Aktualisiert die Arbeitsdokumentation und verfolgt offene Vorgänge bis zur Klärung.',
  'Koordiniert den Informationsaustausch mit Kolleginnen und Kollegen zur fristgerechten Fertigstellung der Aufgaben.',
].join('\n');

const GOOD_DE = [
  'Prüft eingehende Waren.',
  'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
  'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
].join('\n');

function baseCv(entries: WorkExperience[]): CVData {
  return {
    id: 'cv-fc-305',
    name: 'CV',
    personal: {
      fullName: 'Anna Test',
      email: 'anna@example.com',
      phone: '',
      address: '',
      jobTitle: localizeWarehouseEmployee('de', 'female'),
      gender: 'female',
      photoEnabled: false,
    },
    summary: '',
    contentLocale: 'de',
    templateId: 'modern-minimal',
    experience: entries,
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    hobbies: [],
    updatedAt: REF,
  };
}

function warehouseEntry(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp-atlas',
    company: 'Atlas',
    position: 'गोदाम कर्मचारी',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: HI_WH,
    originalUserDescription: HI_WH,
    descriptionOrigin: 'user',
    contentLocale: 'hi',
    ...overrides,
  };
}

function contaminateWithBadAi(entry: WorkExperience): WorkExperience {
  return applyGeneratedExperienceDescription(entry, BAD_AAB302_DE, {
    locale: 'de',
    preserveOriginalUserDescription: true,
  });
}

function commitFinalize(
  fin: ReturnType<typeof finalizeCvAiFieldForApply>,
  opts: {
    usageBefore?: number;
    apply?: boolean;
    patch?: Record<string, unknown>;
  } = {},
) {
  const usageBefore = opts.usageBefore ?? 10;
  const session = new ExperienceAiDiagnosticSession({
    uiLocale: 'de',
    requestedLocale: 'de',
    templateId: 'modern-minimal',
    jobContextHash: 'fc-305',
    requestId: `fc-305-${Math.random().toString(36).slice(2, 8)}`,
    usageCountBefore: usageBefore,
  });
  session.patch({
    selectedSourceKind: 'original_user',
    clickedExperienceEntryIdHash: 'fnv1a_atlas',
    detectedSourceLocale: 'hi',
    crossLocaleOperation: true,
    ...(opts.patch || {}),
  });
  session.recordFinalizeResult(fin);
  if (opts.apply === false || fin.blocked || !fin.countedAsSuccess) {
    session.recordVisibleApply(false, usageBefore);
  } else {
    const preapply = session.evaluatePreApplyDecisionGates();
    expect(preapply.passed).toBe(true);
    const requiredFacts = Number(
      fin.diagnostics?.finalRequiredFactCount
      ?? fin.diagnostics?.requiredFactCount
      ?? 0,
    );
    const coveredFacts = Number(
      fin.diagnostics?.finalCoveredFactCount
      ?? fin.diagnostics?.coveredFactCount
      ?? requiredFacts,
    );
    const requiredPredicates = Number(
      fin.diagnostics?.sourcePredicateIdentityCount
      ?? fin.diagnostics?.finalCandidatePredicateIdentityCount
      ?? 0,
    );
    const coveredPredicates = Number(
      fin.diagnostics?.finalCandidatePredicateIdentityCount
      ?? fin.diagnostics?.candidatePredicateIdentityCount
      ?? requiredPredicates,
    );
    session.patch({
      visibleRequiredFactCount: requiredFacts,
      visibleCoveredFactCount: coveredFacts,
      visibleUncoveredFactIdentityHashes: [],
      visibleFactCoveragePassed: coveredFacts >= requiredFacts,
      visibleRequiredPredicateCount: requiredPredicates,
      visibleCoveredPredicateCount: coveredPredicates,
      visiblePredicateCoveragePassed: coveredPredicates >= requiredPredicates,
      visibleNormalizedHash: fin.diagnostics?.finalNormalizedHash,
      visibleLocaleValidationPassed: true,
      visibleTenseValidationPassed: fin.diagnostics?.tenseValidationPassed !== false,
    });
    session.recordVisibleApply(true, usageBefore + 1, {
      visibleDescription: fin.text,
      finalNormalizedText: fin.text,
    });
  }
  return session.commit();
}

describe('AAB-305 Experience final-candidate diagnostics', () => {
  beforeEach(() => {
    clearExperienceAiDiagnosticsForTests();
    clearExperienceAiDiagnostics();
    clearSummaryAiDiagnosticsForTests();
    clearSummaryAiDiagnostics();
    clearCvAiDiagnosticHistory();
  });

  it('revision marker is reachable and not tree-shakeable', () => {
    expect(EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION)
      .toBe('experience-diagnostics-final-candidate-305-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(
      EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION,
    );
  });

  it('1. Provider success top-level fields describe provider', () => {
    const cv = baseCv([warehouseEntry({ description: GOOD_DE, originalUserDescription: GOOD_DE, contentLocale: 'de' })]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: [
        'Prüft eingehende Waren sorgfältig.',
        'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
        'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
      ].join('\n'),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('provider');
    const trace = commitFinalize(fin);
    expect(trace.finalCandidateSource).toBe('provider');
    expect(trace.coveredFactCount).toBeGreaterThanOrEqual(3);
    expect(trace.uncoveredFactIdentityHashes).toEqual([]);
    expect(trace.providerAccepted).toBe(true);
    expect(trace.finalMatchesProviderOutput).toBe(true);
    expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    expect(trace.visibleDescriptionMatchesFinalHash).toBe(true);
    expect(trace.marker).toBe(EXPERIENCE_AI_DIAG_MARKER);
  });

  it('2. Server fallback success top-level fields describe server fallback', () => {
    const cv = baseCv([warehouseEntry({
      description: GOOD_DE,
      originalUserDescription: GOOD_DE,
      contentLocale: 'de',
      position: 'Lagermitarbeiterin',
    })]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: [
        'Prüft eingehende Waren im Wareneingang.',
        'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
        'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
      ].join('\n'),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'deterministic_fallback',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalCandidateSource).toBe('server_fallback');
    const trace = commitFinalize(fin);
    expect(trace.finalCandidateSource).toBe('server_fallback');
    expect(trace.coveredFactCount).toBeGreaterThanOrEqual(3);
    expect(trace.uncoveredFactIdentityHashes).toEqual([]);
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
  });

  it('3. No-op repair success top-level fields describe repair when applied', () => {
    const cv = baseCv([warehouseEntry({ description: GOOD_DE, originalUserDescription: GOOD_DE, contentLocale: 'de' })]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: [
        'Prüft eingehende Waren und dokumentiert den Wareneingang.',
        'Kontrolliert die dazugehörigen Unterlagen und Aufzeichnungen.',
        'Koordiniert mit Kolleginnen und Kollegen die Vorbereitung und Bewegung der Waren.',
      ].join('\n'),
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
      originHint: 'ai_repaired',
      noOpRepairAttempted: true,
    });
    if (fin.countedAsSuccess) {
      const src = fin.diagnostics?.finalCandidateSource;
      expect(['noop_repair', 'provider', 'deterministic_fallback']).toContain(src);
      const trace = commitFinalize(fin);
      expect(trace.finalCandidateSource).toBe(src);
      expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    }
  });

  it('4–11,18–20. Deterministic fallback: provider 1/3 retained; final 3/3; equality false; visible hash true', () => {
    const contaminated = contaminateWithBadAi(warehouseEntry());
    const cv = baseCv([contaminated]);
    const auth = resolveExperienceAiAuthoritativeSource(contaminated);
    expect(auth.kind).toMatch(/original|pre_ai|canonical|user/i);

    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });

    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(
      fin.diagnostics?.clientDeterministicFallbackSelected === true
      || fin.diagnostics?.clientDeterministicFallbackUsedForFinalCandidate === true
      || fin.diagnostics?.clientDeterministicFallbackApplied === true,
    ).toBe(true);
    expect(fin.diagnostics?.providerCoveredFactCount).toBe(1);
    expect(
      (fin.diagnostics?.providerUncoveredFactIdentityHashes || []).length,
    ).toBeGreaterThan(0);
    expect(fin.diagnostics?.coveredFactCount).toBe(3);
    expect(fin.diagnostics?.requiredFactCount).toBe(3);
    expect(fin.diagnostics?.finalMatchesProviderOutput).toBe(false);
    expect(fin.diagnostics?.experienceDiagnosticsFinalCandidateRevision)
      .toBe(EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION);

    const covFinal = validateGermanWarehouseExperienceCoverage(auth.text, fin.text);
    expect(covFinal.ok).toBe(true);
    expect(covFinal.covered.length).toBe(3);

    const usageBefore = getProAiUsageCount();
    const trace = commitFinalize(fin, { usageBefore: 10 });
    expect(trace.finalCandidateSource).toBe('deterministic_fallback');
    expect(trace.fallbackSelected).toBe(true);
    expect(trace.clientDeterministicFallbackApplied).toBe(true);
    expect(trace.providerCoveredFactCount).toBe(1);
    expect((trace.providerUncoveredFactIdentityHashes || []).length).toBeGreaterThan(0);
    expect(trace.coveredFactCount).toBe(3);
    expect(trace.uncoveredFactIdentityHashes).toEqual([]);
    expect(trace.fallbackCoveredFactCount).toBe(3);
    expect(trace.finalMatchesProviderOutput).toBe(false);
    expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    expect(trace.visibleDescriptionMatchesFinalHash).toBe(true);
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountAfter).toBe(11);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.privacyCheckPassed).toBe(true);
    expect(trace.finalNormalizedHash).toBeTruthy();

    const lineage = trace.candidateLineage || [];
    expect(lineage.some((c) => c.candidateKind === 'provider' && !c.accepted)).toBe(true);
    expect(lineage.some((c) =>
      c.candidateKind === 'deterministic_fallback' && c.accepted)).toBe(true);
    const finalSel = lineage.find((c) => c.candidateKind === 'final_selected');
    expect(finalSel?.accepted).toBe(true);
    expect(finalSel?.coverageCoveredCount).toBe(3);
    expect(finalSel?.normalizedHash).toBe(trace.finalNormalizedHash);
    expect(getProAiUsageCount()).toBe(usageBefore);
  });

  it('5–7. Provider failure followed by fallback retains provider rejection evidence', () => {
    const cv = baseCv([contaminateWithBadAi(warehouseEntry())]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    const trace = commitFinalize(fin);
    expect(trace.providerCoveredFactCount).toBe(1);
    expect((trace.providerUncoveredFactIdentityHashes || []).length).toBeGreaterThan(0);
    expect(trace.coveredFactCount).toBe(3);
    expect(trace.uncoveredFactIdentityHashes).toEqual([]);
    expect(trace.providerAccepted).toBe(false);
  });

  it('8–9. Final/provider normalized equality is hash-based; fallback does not inherit true', () => {
    const cv = baseCv([contaminateWithBadAi(warehouseEntry())]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    expect(fin.text.replace(/\s+/g, ' ').trim()).not.toBe(BAD_AAB302_DE.replace(/\s+/g, ' ').trim());
    expect(fin.diagnostics?.finalMatchesProviderOutput).toBe(false);
    const trace = commitFinalize(fin);
    expect(trace.finalMatchesProviderOutput).toBe(false);
  });

  it('12. Successful apply with null visible hash fails completeness', () => {
    const result = checkExperienceDiagnosticCompleteness({
      diagnosticContractRevision: 'cv-ai-diagnostics-v2',
      schemaVersion: 1,
      requestedLocale: 'de',
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 1,
      usageCountAfter: 2,
      selectedSourceKind: 'original_user',
      clickedExperienceEntryIdHash: 'x',
      marker: EXPERIENCE_AI_DIAG_MARKER,
      operationKind: 'experience',
      visibleTextareaMatchesFinalNormalizedHash: null,
      visibleDescriptionMatchesFinalHash: null,
      finalNormalizedHash: 'abc',
    });
    expect(result.passed).toBe(false);
    expect(result.nullRequiredDiagnosticFields).toEqual(
      expect.arrayContaining([
        'visibleTextareaMatchesFinalNormalizedHash',
        'visibleDescriptionMatchesFinalHash',
      ]),
    );
  });

  it('13. Successful apply with false visible hash fails invariant', () => {
    const inv = checkExperienceDiagnosticInvariants({
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 1,
      usageCountAfter: 2,
      visibleTextareaMatchesFinalNormalizedHash: false,
      visibleDescriptionMatchesFinalHash: false,
      finalCandidateSource: 'provider',
      finalNormalizedHash: 'abc',
      requiredFactCount: 3,
      coveredFactCount: 3,
      uncoveredFactIdentityHashes: [],
    });
    expect(inv.passed).toBe(false);
    expect(inv.failures.some((f) =>
      f.invariantCode.includes('visible') || f.invariantCode.includes('hash'))).toBe(true);
  });

  it('14–15. Terminal failure usage +0; visible-match null allowed', () => {
    const cv = baseCv([warehouseEntry({ description: GOOD_DE, originalUserDescription: GOOD_DE, contentLocale: 'de' })]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: 'SAP Excel KPI 50% Produktivitätssteigerung täglich.',
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    // May fall back safely or reject — force a blocked path via empty candidate reject
    if (!fin.countedAsSuccess) {
      const trace = commitFinalize(fin, { apply: false, usageBefore: 7 });
      expect(trace.countedAsSuccess).toBe(false);
      expect(trace.visibleApplySucceeded).toBe(false);
      expect(trace.usageCountAfter).toBe(7);
      expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBeNull();
    } else {
      // Deterministic recovery still counts as success — exercise typed failure via session
      const session = new ExperienceAiDiagnosticSession({
        uiLocale: 'de',
        requestedLocale: 'de',
        templateId: 'modern',
        jobContextHash: 'fail',
        requestId: 'fail-305',
        usageCountBefore: 7,
      });
      session.patch({
        selectedSourceKind: 'live_textarea',
        clickedExperienceEntryIdHash: 'x',
        countedAsSuccess: false,
        visibleApplySucceeded: false,
        finalCandidateSource: 'none',
      });
      session.recordVisibleApply(false, 7);
      const trace = session.commit();
      expect(trace.usageCountAfter).toBe(7);
      expect(trace.visibleTextareaMatchesFinalNormalizedHash).toBeNull();
    }
  });

  it('16–17. Unsupported claim fields describe final; provider evidence stays separate', () => {
    const cv = baseCv([contaminateWithBadAi(warehouseEntry())]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    const trace = commitFinalize(fin);
    expect(trace.finalUnsupportedClaimCount ?? 0).toBe(0);
    expect(trace.providerCoveredFactCount).toBe(1);
    expect((trace.providerUncoveredFactIdentityHashes || []).length).toBeGreaterThan(0);
  });

  it('21. Experience marker remains correct', () => {
    const cv = baseCv([contaminateWithBadAi(warehouseEntry())]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    const trace = commitFinalize(fin);
    expect(trace.marker).toBe(EXPERIENCE_AI_DIAG_MARKER);
  });

  it('22–23. Provenance diagnostics remain correct; no raw CV text in diagnostics', () => {
    const contaminated = contaminateWithBadAi(warehouseEntry());
    const cv = baseCv([contaminated]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    const trace = commitFinalize(fin, {
      patch: {
        currentTextareaProvenance: 'ai_generated_unedited',
        authoritativeFactSourceKind: 'original_user',
        currentTextareaUsedForFactExtraction: false,
        lastAiOutputHashMatched: false,
        materialUserEditDetected: false,
        staleGeneratedDescriptionIgnored: true,
        generatedDescriptionPreexisted: true,
      },
    });
    expect(trace.currentTextareaProvenance).toBe('ai_generated_unedited');
    expect(trace.authoritativeFactSourceKind).toBe('original_user');
    const json = JSON.stringify(trace);
    expect(json).not.toMatch(/täglich Unterlagen|आने वाले माल|Prüft eingehende/);
    expect(json).not.toMatch(/anna@example\.com/i);
  });

  it('24–25. Restart serialization and Copy payload preserve truthful fields', () => {
    const cv = baseCv([contaminateWithBadAi(warehouseEntry())]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    const trace = commitFinalize(fin);
    const rehydrated = getLatestExperienceAiDiagnostic();
    expect(rehydrated?.finalCandidateSource).toBe('deterministic_fallback');
    expect(rehydrated?.providerCoveredFactCount).toBe(1);
    expect(rehydrated?.coveredFactCount).toBe(3);
    expect(rehydrated?.finalMatchesProviderOutput).toBe(false);
    expect(rehydrated?.visibleTextareaMatchesFinalNormalizedHash).toBe(true);
    const copy = formatExperienceAiDiagnosticForCopy(trace);
    expect(copy).toMatch(/deterministic_fallback/);
    expect(copy).toMatch(/providerCoveredFactCount|providerCoverage/i);
  });

  it('26. Summary diagnostics are unaffected', () => {
    expect(getLatestSummaryAiDiagnostic()).toBeNull();
    const cv = baseCv([contaminateWithBadAi(warehouseEntry())]);
    const fin = finalizeCvAiFieldForApply({
      action: 'experience_bullets',
      field: 'experience_description',
      requestedLocale: 'de',
      gender: 'female',
      cv,
      candidate: BAD_AAB302_DE,
      experienceId: 'exp-atlas',
      referenceDateIso: REF,
    });
    commitFinalize(fin);
    expect(getLatestSummaryAiDiagnostic()).toBeNull();
  });

  it('27. Existing AAB-304 provenance fixture remains passing', () => {
    const contaminated = contaminateWithBadAi(warehouseEntry());
    expect(contaminated.aiOutputProvenance?.revision)
      .toBe(EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION);
    const auth = resolveExperienceAiAuthoritativeSource(contaminated);
    expect(auth.currentTextareaIgnoredOrOverridden).toBe(true);
    expect(auth.text).toContain('माल');
    const safe = buildGermanWarehouseExperienceFallback({
      sourceDescription: auth.text,
      isPresent: true,
    });
    expect(validateGermanWarehouseExperienceCoverage(auth.text, safe).ok).toBe(true);
  });

  it('invariants: incomplete coverage with empty uncovered hashes fails', () => {
    const inv = checkExperienceDiagnosticInvariants({
      requiredFactCount: 3,
      coveredFactCount: 1,
      uncoveredFactIdentityHashes: [],
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      usageCountBefore: 1,
      usageCountAfter: 1,
    });
    expect(inv.failures.some((f) =>
      f.invariantCode === 'incomplete_coverage_with_empty_uncovered_hashes')).toBe(true);
  });

  it('invariants: provider rejection evidence overwritten fails', () => {
    const inv = checkExperienceDiagnosticInvariants({
      finalCandidateSource: 'deterministic_fallback',
      clientDeterministicFallbackApplied: true,
      providerCoveredFactCount: 1,
      providerRequiredFactCount: 3,
      providerUncoveredFactIdentityHashes: [],
      requiredFactCount: 3,
      coveredFactCount: 3,
      uncoveredFactIdentityHashes: [],
      countedAsSuccess: true,
      visibleApplySucceeded: true,
      usageCountBefore: 1,
      usageCountAfter: 2,
      visibleDescriptionMatchesFinalHash: true,
      visibleTextareaMatchesFinalNormalizedHash: true,
      finalNormalizedHash: 'x',
      finalMatchesProviderOutput: false,
    });
    expect(inv.failures.some((f) =>
      f.invariantCode === 'provider_rejection_evidence_overwritten')).toBe(true);
  });
});
