/**
 * AAB-383 — German Summary V2 surface → finalizer integration.
 * Exact AAB 382 device fixture (Fahrradmechaniker/RadWerk + Rezeptionist/StadtHotel):
 * grammar must accept finite "sowie …" object NPs; duration/lineage must stay
 * truthful through finalize → visible apply → usage.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  normalizeSummaryCandidateText,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import {
  SummaryAiDiagnosticSession,
  resolveAuthoritativeVisibleSummaryText,
} from '@/lib/cv-summary-ai-diagnostics';
import {
  validateGermanGeneratedCaseGrammar,
  buildGermanSummaryV2PreapplyCompletenessFields,
  GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION as GRAMMAR_383,
} from '@/lib/cv-german-summary-current-duty-coverage';
import {
  analyzeGermanSummaryDurationScope,
  formatGermanTotalProfessionalDurationSentence,
} from '@/lib/cv-german-summary-competency-grounding';
import {
  countSummaryDurationExpressions,
  enforceAuthoritativeSummaryDuration,
  verifyIndependentFinalDurationCount,
} from '@/lib/cv-summary-duration-ownership';
import {
  setSummaryV2EnabledForTests,
  isSummaryV2Enabled,
  SUMMARY_V2_REVISION,
  buildGermanSummaryV2FromManifest,
  buildSummaryV2ManifestForCv,
  bulletToGermanWoIchClause,
  runSummaryV2,
  GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';

const REF = '2026-07-01';

const CURRENT_RAD = [
  'Führt Wartungsarbeiten an Fahrrädern durch.',
  'Prüft Fahrräder auf technische Mängel.',
  'Tauscht defekte Bauteile an Fahrrädern aus.',
].join('\n');

const PRIOR_HOTEL = [
  'Begrüßte Gäste herzlich an der Rezeption des Hotels.',
  'Erfasste und bearbeitete Reservierungen sowie vorgenommene Änderungen.',
  'Beantwortete Fragen der Gäste kompetent und serviceorientiert.',
].join('\n');

const BAD_FRAGMENT = 'mit etwa fünfeinhalb Jahren Erfahrung.';
const BAD_DASH_3SG = [
  'Ich verfüge über insgesamt etwa fünfeinhalb Jahre Berufserfahrung.',
  'Ich arbeite derzeit als Fahrradmechaniker bei RadWerk — Führt Wartungsarbeiten durch; Prüft Fahrräder; Tauscht Bauteile aus.',
].join(' ');
const BAD_PRIOR_DASH = [
  'Ich verfüge über insgesamt etwa fünfeinhalb Jahre Berufserfahrung.',
  'Derzeit arbeite ich als Fahrradmechaniker bei RadWerk, wo ich Wartungsarbeiten durchführe.',
  'Zuvor arbeitete ich als Rezeptionist bei StadtHotel — Begrüßte Gäste; Erfasste Reservierungen; Beantwortete Fragen.',
].join(' ');
const BAD_DANGLING_SOWIE = 'sowie vorgenommene Änderungen.';

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function deviceCv(options?: {
  currentRole?: string;
  currentCompany?: string;
  priorRole?: string;
  priorCompany?: string;
  currentDuties?: string;
  priorDuties?: string;
  priorPresent?: boolean;
  extraEntries?: CVData['experience'];
}): CVData {
  const experience = [
    {
      id: 'radwerk',
      position: options?.currentRole || 'Fahrradmechaniker',
      company: options?.currentCompany || 'RadWerk',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: options?.currentDuties || CURRENT_RAD,
      canonicalDescription: options?.currentDuties || CURRENT_RAD,
    },
    {
      id: 'stadthotel',
      position: options?.priorRole || 'Rezeptionist',
      company: options?.priorCompany || 'StadtHotel',
      startDate: '2021-01',
      endDate: '2023-12',
      isPresent: false,
      description: options?.priorDuties || PRIOR_HOTEL,
      canonicalDescription: options?.priorDuties || PRIOR_HOTEL,
    },
    ...(options?.extraEntries || []),
  ];
  return {
    id: 'aab-383-device',
    name: 'DE V2 Surface Finalizer',
    personal: {
      fullName: 'Max Mustermann',
      email: 'm@example.com',
      phone: '',
      address: '',
      jobTitle: options?.currentRole || 'Fahrradmechaniker',
      gender: 'male',
    },
    summary: '',
    experience,
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    templateId: 'modern',
    contentLocale: 'de',
  } as CVData;
}

function stageHashes(text: string) {
  const units = text
    ? text.split(/(?<=[.!?])\s+(?=\S)/u).map((u) => u.trim()).filter(Boolean)
    : [];
  return {
    raw: fingerprintText(text || 'empty'),
    normalized: fingerprintText(normalizeSummaryCandidateText(text) || 'empty'),
    unitCount: units.length,
    unitHashes: units.map((u) => fingerprintText(u)),
    durationCount: countSummaryDurationExpressions(text, 'de'),
  };
}

describe('AAB-383 German Summary V2 surface→finalizer integration', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(17);
  });
  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('exports 383 revision markers', () => {
    expect(GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION).toBe(
      'german-summary-v2-surface-finalizer-383-v1',
    );
    expect(GRAMMAR_383).toBe(GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION);
  });

  it('A. exact AAB 382 device-equivalent end-to-end through visible apply + usage', () => {
    const cv = deviceCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(duration.total.totalMonths).toBe(66);

    // Stage: immutable V2 manifest
    const manifest = buildSummaryV2ManifestForCv({
      cv,
      locale: 'de',
      gender: 'male',
      referenceDateIso: REF,
    });
    expect(manifest.totalDurationMonths).toBe(66);
    expect(manifest.requiredCurrentFacts).toHaveLength(3);
    expect(manifest.requiredPriorFacts).toHaveLength(3);

    // Stage: German surface builder
    const built = buildGermanSummaryV2FromManifest(manifest);
    const builtH = stageHashes(built);
    expect(built).toMatch(/^Ich verfüge über (?:insgesamt )?etwa fünfeinhalb Jahre Berufserfahrung\./u);
    expect(built).toMatch(/\bDerzeit arbeite ich als Fahrradmechaniker bei RadWerk\b/u);
    expect(built).toMatch(/\bZuvor arbeitete ich als Rezeptionist bei StadtHotel\b/u);
    expect(built).toMatch(/\bwo ich\b/u);
    expect(built).toMatch(/\bReservierungen sowie vorgenommene Änderungen\b/u);
    expect(built).not.toMatch(/v2_entry_/u);
    expect(built).not.toMatch(/\[object /u);
    expect(builtH.unitCount).toBe(3);
    expect(builtH.durationCount).toBe(1);
    expect(validateGermanGeneratedCaseGrammar(built).germanControlledCaseGrammarPassed).toBe(true);

    // Stage: runSummaryV2 (serializer + validator)
    const v2 = runSummaryV2({
      cv,
      locale: 'de',
      gender: 'male',
      candidate: '',
      referenceDateIso: REF,
    });
    expect(v2.blocked).toBe(false);
    expect(v2.countedAsSuccess).toBe(true);
    expect(v2.origin).toBe('deterministic_fallback');
    expect(v2.text).toBe(built);
    expect(v2.validation.durationExpressionCount).toBe(1);
    expect(v2.validation.coveredCurrentFactCount).toBe(3);
    expect(v2.validation.coveredPriorFactCount).toBe(3);

    // Stage: top-level finalize (grammar/grounding/slots/selection/diagnostics)
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });
    const d = fin.diagnostics || {};
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toBe(built);
    expect(d.summaryBuilderRevision).toBe(SUMMARY_V2_REVISION);
    expect(d.grammarValidationPassed).toBe(true);
    expect(d.germanControlledCaseGrammarPassed).toBe(true);
    expect(d.finalGermanGrammarValidationPassed).toBe(true);
    expect(d.groundingValidationPassed).toBe(true);
    expect(d.coveredCurrentDutyFactCount).toBe(3);
    expect(d.coveredPriorDutyFactCount).toBe(3);
    expect(d.requiredCurrentDutyFactCount).toBe(3);
    expect(d.requiredPriorDutyFactCount).toBe(3);

    // Duration finalizer truth (pass1 === pass2, never 1→0)
    expect(d.durationClaimCountBeforeStrip).toBe(1);
    expect(d.durationClaimCountAfterInsert).toBe(1);
    expect(d.durationClaimCountAfterFinalize).toBe(1);
    expect(d.durationInsertedExactlyOnce).toBe(true);
    expect(d.durationFinalizerIdempotent).toBe(true);
    expect(d.durationSecondPassChanged).toBe(false);
    expect(d.durationPass1CandidateHash).toBe(d.durationPass2CandidateHash);
    expect(d.durationPass1CandidateHash).toBeTruthy();
    expect(d.localizedDurationPhraseHash).toBeTruthy();
    expect(d.durationSemanticValueMonths).toBe(66);
    expect(d.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(d.finalDurationScopeValidationPassed).toBe(true);

    // Candidate lineage truth
    expect(d.deterministicCandidatePresent).toBe(true);
    expect(d.deterministicCandidateHash).toBeTruthy();
    expect(d.deterministicCandidateNormalizedHash).toBeTruthy();
    expect(d.finalValidatedCandidateHash).toBeTruthy();
    expect(d.finalNormalizedHash).toBeTruthy();
    expect(d.deterministicAccepted).toBe(true);
    expect(d.finalCandidateSource).toBe('deterministic_fallback');
    expect(d.deterministicCandidateSentenceCount).toBe(3);
    expect((d.deterministicCandidateUnitHashes || []).length).toBe(3);
    expect((d.finalUnitRoleSlots || []).includes('duration')).toBe(true);

    // Transactional visible apply via operation-owned cvRef
    const cvRef = { current: { ...cv } };
    const written = applyFinalizedSummaryToCv(cvRef.current, 'de', fin);
    cvRef.current = written;
    const visibleText = resolveAuthoritativeVisibleSummaryText({
      operationOwnedSummary: cvRef.current.summary,
      staleReactSummary: '',
    });
    expect(visibleText).toBe(fin.text);

    const before = getProAiUsageCount();
    expect(before).toBe(17);
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'male',
      requestId: 'aab-383-device-e2e',
      usageCountBefore: before,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    expect(session.draft.durationClaimCountAfterFinalize).toBe(1);
    expect(session.draft.localizedDurationPhraseHash).toBeTruthy();
    expect(session.draft.deterministicCandidatePresent).toBe(true);
    expect(session.draft.deterministicCandidateHash).toBeTruthy();
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);

    session.recordVisibleApply(true, before, visibleText);
    expect(session.visibleApplySucceeded).toBe(true);
    expect(session.draft.visibleGermanGrammarValidationPassed).toBe(true);
    expect(session.draft.visibleSummaryMatchesFinalHash).toBe(true);
    expect(session.draft.visibleDurationScopeValidationPassed).toBe(true);
    expect(session.draft.raceGuardResult).toBe('ok');
    expect(session.draft.visibleCandidateHashAfterApply).toBe(
      fingerprintText(normalizeSummaryCandidateText(visibleText) || 'empty'),
    );
    expect(session.draft.visibleCandidateHashAfterApply).toBe(
      d.finalValidatedCandidateHash ?? d.finalNormalizedHash,
    );
    expect(session.draft.visibleCoveredCurrentDutyFactCount).toBe(3);
    expect(session.draft.visibleCoveredPriorDutyFactCount).toBe(3);

    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: before + 1 });
    const trace = session.commit();
    expect(trace.usageCountAfter).toBe(18);
    expect(getProAiUsageCount()).toBe(18);
    expect(trace.finalTypedFailureReason).toBeNull();
  });

  it('B. negative old-output shapes: grammar/preapply reject; no apply; usage unchanged', () => {
    for (const bad of [BAD_FRAGMENT, BAD_DASH_3SG, BAD_PRIOR_DASH, BAD_DANGLING_SOWIE]) {
      const g = validateGermanGeneratedCaseGrammar(bad);
      expect(g.germanControlledCaseGrammarPassed, bad).toBe(false);
      const pre = buildGermanSummaryV2PreapplyCompletenessFields({
        finalCandidateText: bad,
        requiredCurrentFacts: [
          { factId: 'v2_entry_a' },
          { factId: 'v2_entry_b' },
          { factId: 'v2_entry_c' },
        ],
      });
      expect(pre.blocksAcceptance, bad).toBe(true);
      expect(pre.blockReason, bad).toBe('german_controlled_case_grammar_failed');
    }

    // Finite "sowie …" object NP inside wo-ich clause must remain accepted.
    const goodSowie = [
      'Ich verfüge über insgesamt etwa fünfeinhalb Jahre Berufserfahrung.',
      'Derzeit arbeite ich als Fahrradmechaniker bei RadWerk, wo ich Wartungsarbeiten an Fahrrädern durchführe.',
      'Zuvor arbeitete ich als Rezeptionist bei StadtHotel, wo ich Reservierungen sowie vorgenommene Änderungen erfasste und bearbeitete.',
    ].join(' ');
    expect(validateGermanGeneratedCaseGrammar(goodSowie).germanControlledCaseGrammarPassed)
      .toBe(true);

    const before = getProAiUsageCount();
    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'de',
      templateId: 'modern',
      gender: 'male',
      requestId: 'aab-383-neg',
      usageCountBefore: before,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult({
      blocked: true,
      countedAsSuccess: false,
      text: '',
      origin: 'deterministic_fallback',
      roleDutyConflict: false,
      reason: 'german_controlled_case_grammar_failed',
      diagnostics: {
        summaryBuilderRevision: SUMMARY_V2_REVISION,
        evaluatedCandidateText: BAD_DASH_3SG,
        deterministicCandidatePresent: true,
        deterministicCandidateHash: fingerprintText(BAD_DASH_3SG),
        deterministicCandidateNormalizedHash: fingerprintText(
          normalizeSummaryCandidateText(BAD_DASH_3SG) || 'empty',
        ),
        finalCandidateSource: 'none',
        deterministicAccepted: false,
        grammarValidationPassed: false,
        germanControlledCaseGrammarPassed: false,
        finalGermanGrammarValidationPassed: false,
        durationClaimCountBeforeStrip: 1,
        durationClaimCountAfterInsert: 1,
        durationClaimCountAfterFinalize: 1,
        durationInsertedExactlyOnce: true,
        durationFinalizerIdempotent: true,
        localizedDurationPhraseHash: fingerprintText('dur_phrase:test'),
        typedFailureReason: 'german_controlled_case_grammar_failed',
        finalTypedFailureReason: 'german_controlled_case_grammar_failed',
        rejectionStage: 'summary_v2_german_preapply_completeness',
      } as never,
    });
    expect(session.draft.durationClaimCountAfterFinalize).toBe(1);
    expect(session.draft.deterministicCandidatePresent).toBe(true);
    expect(session.draft.deterministicCandidateHash).toBeTruthy();
    expect(session.draft.finalCandidateSource).toBe('none');
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(false);
    session.recordVisibleApply(true, before, BAD_DASH_3SG);
    expect(session.visibleApplySucceeded).toBe(false);
    expect(getProAiUsageCount()).toBe(17);
  });

  it('C. duration finalizer integration: complete DE sentence, pass1=pass2, 66 months, total-career', () => {
    const sentence = formatGermanTotalProfessionalDurationSentence(
      'mit etwa fünfeinhalb Jahren Erfahrung',
      'male',
    );
    expect(sentence).toMatch(/^Ich verfüge über/u);
    expect(countSummaryDurationExpressions(sentence, 'de')).toBe(1);
    expect(verifyIndependentFinalDurationCount(sentence, 'de', { requireExactlyOne: true }).count)
      .toBe(1);
    const scope = analyzeGermanSummaryDurationScope(sentence, { company: 'RadWerk' });
    expect(scope.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(scope.finalDurationScopeValidationPassed).toBe(true);

    const duration = {
      totalMonths: 66,
      approxYears: 5.5,
      unit: 'years' as const,
      hasValidDates: true,
      approxLabel: 'etwa fünfeinhalb Jahre',
    };
    const body = [
      sentence,
      'Derzeit arbeite ich als Fahrradmechaniker bei RadWerk, wo ich Wartungsarbeiten an Fahrrädern durchführe.',
    ].join(' ');
    const pass1 = enforceAuthoritativeSummaryDuration(body, duration, 'de', {
      requireDurationClaim: true,
      injectFn: (text, dur) => {
        const phrase = formatApproximateOrFallback(dur);
        if (countSummaryDurationExpressions(text, 'de') === 1) return text;
        return `${phrase} ${text}`.replace(/\s+/g, ' ').trim();
      },
    });
    const pass2 = enforceAuthoritativeSummaryDuration(pass1.summary, duration, 'de', {
      requireDurationClaim: true,
      injectFn: (text, dur) => {
        const phrase = formatApproximateOrFallback(dur);
        if (countSummaryDurationExpressions(text, 'de') === 1) return text;
        return `${phrase} ${text}`.replace(/\s+/g, ' ').trim();
      },
    });
    expect(pass1.summary).toBe(pass2.summary);
    expect(pass1.diagnostics.durationClaimCountAfterInsert).toBe(1);
    expect(pass2.diagnostics.durationClaimCountAfterInsert).toBe(1);
    expect(pass1.diagnostics.independentFinalDurationClaimCount).toBe(1);
    expect(pass2.diagnostics.independentFinalDurationClaimCount).toBe(1);
    expect(pass1.diagnostics.durationSemanticValueMonths).toBe(66);
    expect(pass2.diagnostics.durationSemanticValueMonths).toBe(66);
    expect(pass1.changed && pass2.changed).toBe(false);

    // Numeric + written variants already supported by detector.
    expect(countSummaryDurationExpressions(
      'Ich verfüge über insgesamt etwa 5,5 Jahre Berufserfahrung.',
      'de',
    )).toBe(1);
    expect(countSummaryDurationExpressions(
      'Ich verfüge über etwa fünfeinhalb Jahre Berufserfahrung.',
      'de',
    )).toBe(1);
  });

  it('D. German language breadth: free-text titles, separable/irregular/umlauts, entry counts', () => {
    expect(bulletToGermanWoIchClause('führt Wartungsarbeiten durch', 'present'))
      .toMatch(/Wartungsarbeiten durchführe/i);
    expect(bulletToGermanWoIchClause('nimmt Anrufe entgegen', 'present'))
      .toMatch(/Anrufe entgegennehme/i);
    expect(bulletToGermanWoIchClause('überprüft und passt Designmaterialien an', 'present'))
      .toMatch(/anpasse/i);
    expect(bulletToGermanWoIchClause('sprach mit Kundinnen', 'past'))
      .toMatch(/sprach/i);
    expect(bulletToGermanWoIchClause('prüft Güter für die Öffentlichkeitsarbeit', 'present'))
      .toMatch(/Öffentlichkeitsarbeit prüfe/i);

    // One entry
    const one = deviceCv({
      currentRole: 'Küchenhilfe',
      currentCompany: 'NordBäckerei',
      currentDuties: [
        'Bereitet Speisen vor.',
        'Hält die Küche sauber.',
        'Unterstützt den Service.',
      ].join('\n'),
      priorDuties: '',
    });
    one.experience = [one.experience![0]!];
    const finOne = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv: one,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(one.experience || [], REF),
    });
    expect(finOne.blocked).toBe(false);
    expect(finOne.text).toMatch(/Küchenhilfe/);
    expect(finOne.text).toMatch(/NordBäckerei/);
    expect(finOne.text).toMatch(/wo ich/);
    expect(finOne.text).not.toMatch(/Zuvor arbeitete/u);

    // Two entries with unknown free-text titles
    const two = deviceCv({
      currentRole: 'Drohnenpilot',
      currentCompany: 'SkyScan GmbH',
      priorRole: 'Bibliotheksassistent',
      priorCompany: 'Stadtbücherei Öhringen',
      currentDuties: [
        'Führt Inspektionsflüge durch.',
        'Prüft Bilddaten auf Vollständigkeit.',
        'Tauscht defekte Rotoren aus.',
      ].join('\n'),
      priorDuties: [
        'Katalogisierte Medien für die Öffentlichkeit.',
        'Beriet Besucherinnen kompetent.',
        'Erfasste und bearbeitete Entleihungen sowie vorgenommene Änderungen.',
      ].join('\n'),
    });
    const finTwo = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv: two,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(two.experience || [], REF),
    });
    expect(finTwo.blocked).toBe(false);
    expect(finTwo.text).toMatch(/Drohnenpilot/);
    expect(finTwo.text).toMatch(/Bibliotheksassistent/);
    expect(finTwo.text).toMatch(/Öhringen|Stadtbücherei/);
    expect(validateGermanGeneratedCaseGrammar(finTwo.text || '').germanControlledCaseGrammarPassed)
      .toBe(true);

    // Three+ entries still produce finite first-person German
    const three = deviceCv({
      extraEntries: [
        {
          id: 'cafe',
          position: 'Barista',
          company: 'KaffeeHaus',
          startDate: '2019-01',
          endDate: '2020-12',
          isPresent: false,
          description: 'Bereitete Getränke zu.\nBediente Gäste.\nHielt die Theke sauber.',
        },
      ],
    });
    const finThree = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'de',
      gender: 'male',
      cv: three,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(three.experience || [], REF),
    });
    expect(finThree.blocked).toBe(false);
    expect(finThree.text).toMatch(/Fahrradmechaniker|Barista|Rezeptionist/);
    expect(finThree.text).toMatch(/wo ich/);
  });

  it('E. cross-system guards: EN Summary + DE Experience unchanged shape; V2 default OFF', () => {
    const prevEnv = process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
    setSummaryV2EnabledForTests(null);
    delete process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
    expect(isSummaryV2Enabled()).toBe(false);

    setSummaryV2EnabledForTests(true);
    const enCv = deviceCv();
    enCv.contentLocale = 'en';
    enCv.personal!.jobTitle = 'Bicycle Mechanic';
    enCv.experience![0]!.position = 'Bicycle Mechanic';
    enCv.experience![0]!.description = [
      'Performs bicycle maintenance.',
      'Inspects bikes for defects.',
      'Replaces defective parts.',
    ].join('\n');
    enCv.experience![1]!.position = 'Receptionist';
    enCv.experience![1]!.description = [
      'Greeted hotel guests.',
      'Managed reservations.',
      'Answered guest questions.',
    ].join('\n');
    const enFin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'male',
      cv: enCv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: buildExperienceDurationSnapshot(enCv.experience || [], REF),
    });
    expect(enFin.blocked).toBe(false);
    expect(enFin.text).toMatch(/I (?:have|bring|currently)/i);
    expect(enFin.text).not.toMatch(/Ich verfüge|Derzeit arbeite ich/u);

    // Production/web default remains OFF when override cleared and env unset.
    setSummaryV2EnabledForTests(null);
    delete process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
    expect(isSummaryV2Enabled()).toBe(false);
    if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
    else process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 = prevEnv;
  });
});

function formatApproximateOrFallback(dur: {
  approxLabel?: string;
  totalMonths?: number;
}): string {
  const label = (dur.approxLabel || 'etwa fünfeinhalb Jahre').trim();
  return formatGermanTotalProfessionalDurationSentence(`mit ${label} Erfahrung`);
}
