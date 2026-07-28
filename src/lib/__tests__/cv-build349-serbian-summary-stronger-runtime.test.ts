/**
 * AAB-349 — Serbian Stronger runtime: provider grounding failure must not be
 * terminal; structured-domain gate uses canonical facts; deterministic
 * entry-owned fallback must apply with truthful diagnostics.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  SUMMARY_BUILDER_REVISION_SR,
  analyzeSerbianSummaryEmploymentQuality,
  evaluateSerbianStructuredDomainGate,
  detectSerbianPerspective,
  scanSerbianSummaryUnsupportedClaims,
  buildSerbianEntryOwnedSummary,
  buildSerbianEntryOwnedSummaryFromPayload,
  isSerbianStructuredSummaryDomain,
  isSerbianEntryOwnedSummaryComplete,
  SERBIAN_ENTRY_OWNED_OUTPUT_INCOMPLETE,
} from '@/lib/cv-serbian-summary-grounding';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { deterministicLocalizedSummaryFromCanonical } from '@/lib/cv-localized-fallback';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
} from '@/lib/cv-experience-duration';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import type { CVData } from '@/lib/types';

const REF = '2026-07-20';

const WH_EN = [
  'checks incoming goods;',
  'checks documentation related to received goods;',
  'coordinates with colleagues on preparation and movement of goods.',
].join('\n');

const GD_EN = [
  'created visual materials and graphic elements;',
  'reviewed and adapted design materials;',
  'prepared final design files for different formats and screens.',
].join('\n');

const BAD_SOURCE_SR =
  'Radim u kompaniji Atlas kao radnica u skladištu, od januara 2023. godine, gde '
  + 'kontrolišem prijem robe, proveravam prateću dokumentaciju i sarađujem sa '
  + 'kolegama na pripremi i premeštanju robe, sa oko šest i po godina iskustva. '
  + 'Prethodno sam radila kao grafička dizajnerica u kompaniji Rewitu, gde sam '
  + 'kreirala vizuelne materijale i grafičke elemente, prilagođavala dizajnerske '
  + 'materijale i pripremala finalne fajlove za različite formate i ekrane.';

const EXPECTED_FINAL =
  'Imam oko šest i po godina ukupnog profesionalnog iskustva. Trenutno radim u '
  + 'kompaniji Atlas kao radnica u skladištu, gde proveravam pristiglu robu i '
  + 'dokumentaciju povezanu sa primljenom robom i sarađujem sa kolegama na pripremi i '
  + 'premeštanju robe. Prethodno sam radila kao grafička dizajnerka u kompaniji '
  + 'Rewitu, gde sam kreirala vizuelne materijale i grafičke elemente, pregledala i '
  + 'prilagođavala dizajnerske materijale i pripremala završne dizajnerske datoteke '
  + 'za različite formate i ekrane.';

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function deviceCv(options?: { summary?: string; aiOnlyDuties?: boolean }): CVData {
  const wh = WH_EN;
  const gd = GD_EN;
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: "Ouvrière d'entrepôt",
      gender: 'female',
    },
    summary: options?.summary ?? BAD_SOURCE_SR,
    contentLocale: 'sr',
    summaryOrigin: 'ai_generated',
    experience: [
      {
        id: 'atlas',
        position: 'Radnica u magacinu',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: wh,
        canonicalDescription: options?.aiOnlyDuties ? '' : wh,
        descriptionOrigin: options?.aiOnlyDuties ? 'ai_generated' : 'user',
        generatedLocale: 'hr',
      },
      {
        id: 'rewitu',
        position: 'Grafička dizajnerka',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: gd,
        canonicalDescription: options?.aiOnlyDuties ? '' : gd,
        descriptionOrigin: options?.aiOnlyDuties ? 'ai_generated' : 'user',
        generatedLocale: 'hr',
      },
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

describe('AAB-349 Serbian Stronger runtime', () => {
  beforeEach(() => {
    seedUsage(23);
  });

  it('exact Stronger path: provider grounding fail → deterministic apply + usage +1', () => {
    const cv = deviceCv();
    expect(cv.summary.length).toBe(446);
    expect(getProAiUsageCount()).toBe(23);
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(durationSnapshot.total.totalMonths).toBe(78);

    const provider = `${BAD_SOURCE_SR} Dodatno pomažem u organizaciji skladišta i rasporedu robe.`;
    expect(provider.length).toBeGreaterThan(480);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: provider,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_generated',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.text).toMatch(/šest\s+i\s+po\s+godina/);
    expect(fin.text).not.toMatch(/šest\s+i\s+po\s+godine/);
    expect(fin.text).toMatch(/dizajnerka/);
    expect(fin.text).not.toMatch(/dizajnerica/);
    expect(fin.text).toMatch(/proveravam\s+pristiglu\s+robu/);
    expect(fin.text).toMatch(/pregledala\s+i\s+prilagođavala/);
    expect(fin.text).toMatch(/ukupnog\s+profesionalnog\s+iskustva/);
    expect(fin.diagnostics?.rewriteStyle).toBe('stronger');
    expect(fin.diagnostics?.previousSummaryUsedAsFactSource).toBe(false);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerOutcome).toBe('rejected_grounding');
    expect(
      fin.diagnostics?.providerRejectionReason
      || fin.diagnostics?.providerTypedRejectionReason,
    ).toBeTruthy();
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
    expect(fin.diagnostics?.serbianEntryOwnedBuilderAttempted).toBe(true);
    expect(fin.diagnostics?.serbianEntryOwnedBuilderSucceeded).toBe(true);
    expect(fin.diagnostics?.serbianStructuredDomainGatePassed).toBe(true);
    expect(fin.diagnostics?.serbianStructuredDomainCurrentCoveredFactCount).toBe(3);
    expect(fin.diagnostics?.serbianStructuredDomainPriorCoveredFactCount).toBe(3);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.requiredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.perspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.finalPerspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.unsupportedClaimCount ?? 0).toBe(0);
    expect(fin.diagnostics?.typedFailureReason).not.toBe('serbian_summary_unsupported_claims');

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'sr',
      requestedLocale: 'sr',
      contentLocale: 'sr',
      gender: 'female',
      usageCountBefore: 23,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, BAD_SOURCE_SR);
    session.recordFinalizeResult(fin);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed).toBe(true);
    session.recordVisibleApply(true, 23, fin.text);
    const next = applyFinalizedSummaryToCv(cv, 'sr', fin);
    expect(next.summary).toBe(fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(24);
  });

  it('A. provider grounding fail still runs deterministic fallback', () => {
    const cv = deviceCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: BAD_SOURCE_SR,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      rewriteStyle: 'stronger',
    });
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.countedAsSuccess).toBe(true);
  });

  it('B/C. unsupported claims require typed evidence; count 0 forbids reason', () => {
    const scan = scanSerbianSummaryUnsupportedClaims(EXPECTED_FINAL);
    expect(scan.unsupportedClaimCount).toBe(0);
    const q = analyzeSerbianSummaryEmploymentQuality(EXPECTED_FINAL, {
      company: 'Atlas',
      role: 'Radnica u magacinu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      priorRole: 'Grafička dizajnerka',
      gender: 'female',
    });
    expect(q.unsupportedClaimCount).toBe(0);
    expect(q.typedRejectionReason).not.toBe('serbian_summary_unsupported_claims');
    expect(q.groundingValidationPassed).toBe(true);

    const bad = analyzeSerbianSummaryEmploymentQuality(
      `${EXPECTED_FINAL} Ključne veštine uključuju leadership i marketing.`,
      {
        company: 'Atlas',
        role: 'Radnica u magacinu',
        currentEntryDuties: WH_EN,
        priorEntryDuties: GD_EN,
        gender: 'female',
      },
    );
    expect(bad.unsupportedClaimCount).toBeGreaterThan(0);
    expect(bad.typedRejectionReason).toBe('serbian_summary_unsupported_claims');
  });

  it('F/G/I. structured-domain gate uses canonical facts; docs not lost', () => {
    const gate = evaluateSerbianStructuredDomainGate({
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      currentRole: 'Radnica u magacinu',
      priorRole: 'Grafička dizajnerka',
      jobTitle: "Ouvrière d'entrepôt",
    });
    expect(gate.passed).toBe(true);
    expect(gate.currentCoveredFactCount).toBe(3);
    expect(gate.priorCoveredFactCount).toBe(3);
    expect(gate.failureReasons).toEqual([]);
  });

  it('H. generic warehouse without design does not activate canned builder', () => {
    const gate = evaluateSerbianStructuredDomainGate({
      currentEntryDuties: 'loads packages and transports goods between docks',
      priorEntryDuties: 'assisted with general office tasks',
      currentRole: 'Warehouse Employee',
      priorRole: 'Assistant',
    });
    expect(gate.passed).toBe(false);
    expect(isSerbianStructuredSummaryDomain(
      'Warehouse Employee loads packages and transports goods',
    )).toBe(false);
  });

  it('J/K. Stronger rewriteStyle + first_person perspective', () => {
    expect(detectSerbianPerspective(BAD_SOURCE_SR)).toBe('first_person');
    expect(detectSerbianPerspective(EXPECTED_FINAL)).toBe('first_person');
    const cv = deviceCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: BAD_SOURCE_SR,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      rewriteStyle: 'stronger',
    });
    expect(fin.diagnostics?.rewriteStyle).toBe('stronger');
    expect(fin.diagnostics?.perspectiveMode).toBe('first_person');
  });

  it('L/M. rejection preserves source+usage; success increments once', () => {
    const cv = deviceCv();
    seedUsage(23);
    const failFin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: 'Hello this is English garbage only.',
      cv: {
        ...cv,
        experience: [
          {
            id: 'x',
            position: 'Clerk',
            company: 'Acme',
            startDate: '2024-01',
            endDate: '',
            isPresent: true,
            description: 'answers phones',
            canonicalDescription: 'answers phones',
          },
        ],
      },
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot([
        {
          id: 'x',
          position: 'Clerk',
          company: 'Acme',
          startDate: '2024-01',
          endDate: '',
          isPresent: true,
          description: 'answers phones',
        },
      ], REF),
    });
    if (failFin.blocked || !failFin.countedAsSuccess) {
      const preserved = applyFinalizedSummaryToCv(cv, 'sr', failFin);
      expect(preserved.summary).toBe(BAD_SOURCE_SR);
      expect(getProAiUsageCount()).toBe(23);
    }

    seedUsage(23);
    const ok = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: BAD_SOURCE_SR,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      rewriteStyle: 'stronger',
    });
    expect(ok.countedAsSuccess).toBe(true);
    applyFinalizedSummaryToCv(cv, 'sr', ok);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(24);
  });

  it('ai-only duties (empty canonical) still rebuild via live description', () => {
    const cv = deviceCv({ aiOnlyDuties: true });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: BAD_SOURCE_SR,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      rewriteStyle: 'stronger',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.serbianEntryOwnedBuilderSucceeded).toBe(true);
  });

  it('builder revision label is not proof of invocation', () => {
    expect(SUMMARY_BUILDER_REVISION_SR).toBe('entry-owned-serbian-rebuild-v1');
    const built = buildSerbianEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v })),
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration: buildExperienceDurationSnapshot(deviceCv().experience || [], REF).total,
    });
    expect(built.split(/(?<=[.!?])\s+/).length).toBe(3);
  });

  it('AAB-350 device shell: empty live + canonical facts still builds 3 sentences', () => {
    // Legacy live fragments empty; canonical 3+3 remain — gate payload must drive builder.
    const cv = deviceCv();
    cv.experience![0]!.description = '';
    cv.experience![1]!.description = '';
    expect(cv.summary.length).toBe(446);
    seedUsage(23);
    const provider = `${BAD_SOURCE_SR} Dodatno pomažem.`;
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: provider,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      rewriteStyle: 'stronger',
      originHint: 'ai_generated',
    });
    expect(fin.diagnostics?.serbianStructuredDomainGatePassed).toBe(true);
    expect(fin.diagnostics?.serbianEntryOwnedBuilderAttempted).toBe(true);
    expect(fin.diagnostics?.serbianEntryOwnedBuilderSucceeded).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
    expect((fin.diagnostics?.serbianEntryOwnedBuilderOutputLength || 0)).toBeGreaterThan(52);
    expect(fin.text.length).toBeGreaterThan(52);
    expect(fin.text).toMatch(/Trenutno radim u kompaniji Atlas/);
    expect(fin.text).toMatch(/Prethodno sam radila/);
    expect(fin.diagnostics?.deterministicCandidateEqualsGroundingInput).toBe(true);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.rejectionStage).not.toBe('independent_final_duration_verification');
  });

  it('A. empty legacy fragments + canonical 3+3 → full candidate', () => {
    const cv = deviceCv();
    cv.experience![0]!.description = '';
    cv.experience![1]!.description = '';
    const gate = evaluateSerbianStructuredDomainGate({
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      currentRole: 'Radnica u magacinu',
      priorRole: 'Grafička dizajnerka',
      currentEmployer: 'Atlas',
      priorEmployer: 'Rewitu',
      gender: 'female',
      duration: buildExperienceDurationSnapshot(cv.experience || [], REF).total,
    });
    expect(gate.passed).toBe(true);
    expect(gate.payload).toBeTruthy();
    const built = buildSerbianEntryOwnedSummaryFromPayload(gate.payload!);
    expect(isSerbianEntryOwnedSummaryComplete(built)).toBe(true);
    expect(built.split(/(?<=[.!?])\s+/).length).toBe(3);
  });

  it('B. structured roles without canonical duties → gate fails', () => {
    const gate = evaluateSerbianStructuredDomainGate({
      currentEntryDuties: '',
      priorEntryDuties: '',
      currentRole: 'Radnica u magacinu',
      priorRole: 'Grafička dizajnerka',
    });
    expect(gate.passed).toBe(false);
    expect(gate.payload).toBeNull();
  });

  it('C. duration-only / role+duration 52-char shell is not builder success', () => {
    const shell = 'Radnica u magacinu sa oko šest i po godina iskustva.';
    expect(fingerprintText(shell)).toBe('fnv1a_d5b60c8d_l52_b82_e46');
    expect(isSerbianEntryOwnedSummaryComplete(shell)).toBe(false);
    expect(SERBIAN_ENTRY_OWNED_OUTPUT_INCOMPLETE).toBe('serbian_entry_owned_output_incomplete');
  });

  it('D. enrichSerbian must not diverge structured hashes (95-char mismatch)', () => {
    const shell = 'Radnica u magacinu sa oko šest i po godina iskustva.';
    const enriched =
      'Radnica u magacinu u kompaniji Atlas od januara 2023. godine, sa oko šest i po godina iskustva.';
    expect(fingerprintText(enriched)).toBe('fnv1a_184d29e5_l95_b82_e46');
    expect(fingerprintText(shell)).not.toBe(fingerprintText(enriched));
    // Production structured path must not select the shell (or its enriched form).
    const cv = deviceCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: BAD_SOURCE_SR,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience || [], REF),
      rewriteStyle: 'stronger',
    });
    expect(fin.diagnostics?.deterministicCandidateHash).not.toBe(fingerprintText(shell));
    expect(fin.diagnostics?.groundingInputCandidateHash).not.toBe(fingerprintText(enriched));
    expect(fin.diagnostics?.deterministicCandidateEqualsGroundingInput).toBe(true);
  });

  it('E. generic warehouse CV without design does not use canned builder', () => {
    const factSet = buildCvCanonicalFactSet({
      personal: { fullName: 'T', email: 't@e.com', phone: '', jobTitle: 'Warehouse Employee', gender: 'female' },
      summary: '',
      experience: [{
        id: 'w',
        position: 'Warehouse Employee',
        company: 'Logi',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: 'loads packages and transports goods between docks',
        canonicalDescription: 'loads packages and transports goods between docks',
      }],
      education: [],
      skills: [],
      languages: [],
    } as never);
    const text = deterministicLocalizedSummaryFromCanonical(
      factSet,
      'sr',
      'female',
      buildExperienceDurationSnapshot([{
        id: 'w',
        position: 'Warehouse Employee',
        company: 'Logi',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: 'loads packages',
      }], REF).total,
    );
    expect(text).not.toMatch(/Rewitu/);
    expect(text).not.toMatch(/dizajnerka/);
  });

  it('F/I. complete structured candidate is first_person with 3 Serbian units', () => {
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: BAD_SOURCE_SR,
      cv: deviceCv(),
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot(deviceCv().experience || [], REF),
      rewriteStyle: 'stronger',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.finalPerspectiveMode || fin.diagnostics?.perspectiveMode)
      .toBe('first_person');
    expect(fin.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
  });

  it('H. material failure stage is not duration when duration passes', () => {
    // Incomplete non-structured CV: duration may still finalize once, but rejection
    // must not blame the successful duration stage when material facts fail.
    const cv = deviceCv();
    cv.experience = [{
      id: 'only',
      position: 'Clerk',
      company: 'Acme',
      startDate: '2023-01',
      endDate: '',
      isPresent: true,
      description: 'answers phones',
      canonicalDescription: 'answers phones',
    }];
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: 'English only garbage summary without Serbian duties.',
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      durationSnapshot: buildExperienceDurationSnapshot(cv.experience, REF),
      rewriteStyle: 'stronger',
    });
    if (!fin.countedAsSuccess) {
      expect(fin.diagnostics?.rejectionStage).not.toBe('independent_final_duration_verification');
    }
  });
});
