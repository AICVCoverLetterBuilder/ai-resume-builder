/**
 * AAB-348 — Serbian Professional Summary non-empty enhancement:
 * reject Croatian role/duty leakage, incoming-goods drift, Atlas-attached
 * duration, and incomplete prior review+adaptation; select repaired provider
 * or entry-owned Serbian deterministic fallback.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  SUMMARY_RUNTIME_MARKER_SET,
  type FinalizeCvAiFieldResult,
} from '@/lib/cv-ai-finalize-apply';
import {
  SUMMARY_BUILDER_REVISION_SR,
  SUMMARY_DURATION_FINALIZER_REVISION_SR,
  SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION,
  SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION,
  SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION,
  SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION,
  analyzeSerbianSummaryEmploymentQuality,
  analyzeSerbianCroatianLocaleEvidence,
  analyzeSerbianSummaryDurationScope,
  analyzeSerbianSummaryFactCoverage,
  buildSerbianEntryOwnedSummary,
  repairSerbianSummaryProviderCandidate,
  injectSerbianTotalDurationSentence,
} from '@/lib/cv-serbian-summary-grounding';
import {
  serbianYearNounForApproxYears,
  analyzeSerbianDurationNounForms,
  hasIncorrectSerbianDurationGrammar,
  normalizeSerbianDurationGrammar,
  SERBIAN_DURATION_NOUN_FORM_349_REVISION,
} from '@/lib/cv-serbian-grammar';
import {
  formatApproximateDurationPhrase,
  buildExperienceDurationSnapshot,
} from '@/lib/cv-experience-duration';
import { countSummaryDurationExpressions } from '@/lib/cv-summary-duration-ownership';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
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

const EN_VALIDATED_SUMMARY =
  'I am a warehouse employee with approximately six and a half years of '
  + 'professional experience, currently working at Atlas, where I check incoming '
  + 'goods, verify related documentation, and coordinate with colleagues on the '
  + 'preparation and movement of goods. Previously, I worked as a graphic designer '
  + 'at Rewitu, creating visual materials and graphic elements, reviewing and '
  + 'adapting design materials, and preparing final design files for different '
  + 'formats and screens.';

/** Exact AAB-348 visible Serbian bad-provider output. */
const BAD_PROVIDER_SR =
  'Radim u kompaniji Atlas kao radnica u skladištu, od januara 2023. godine, gde '
  + 'kontrolišem prijem robe, proveravam prateću dokumentaciju i sarađujem sa '
  + 'kolegama na pripremi i premeštanju robe, sa oko šest i po godina iskustva. '
  + 'Prethodno sam radila kao grafička dizajnerica u kompaniji Rewitu, gde sam '
  + 'kreirala vizuelne materijale i grafičke elemente, prilagođavala dizajnerske '
  + 'materijale i pripremala finalne fajlove za različite formate i ekrane.';

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function atlasRewituCv(options?: {
  summary?: string;
  gender?: string;
  contentLocale?: string;
}): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Warehouse Employee',
      gender: options?.gender ?? 'female',
    },
    summary: options?.summary ?? EN_VALIDATED_SUMMARY,
    experience: [
      {
        id: 'atlas',
        position: 'Warehouse Employee',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_EN,
        canonicalDescription: WH_EN,
      },
      {
        id: 'rewitu',
        position: 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2022-12',
        isPresent: false,
        description: GD_EN,
        canonicalDescription: GD_EN,
      },
    ],
    education: [],
    skills: [],
    languages: [],
    contentLocale: options?.contentLocale ?? 'en',
  } as CVData;
}

const analyzeOpts = {
  company: 'Atlas',
  role: 'Warehouse Employee',
  priorCompany: 'Rewitu',
  priorRole: 'Graphic Designer',
  currentEntryDuties: WH_EN,
  priorEntryDuties: GD_EN,
  gender: 'female',
};

describe('AAB-348 Serbian Summary non-empty enhancement', () => {
  beforeEach(() => {
    seedUsage(22);
  });

  it('markers reachable', () => {
    expect(SUMMARY_BUILDER_REVISION_SR).toBe('entry-owned-serbian-rebuild-v1');
    expect(SUMMARY_DURATION_FINALIZER_REVISION_SR).toBe('serbian-duration-total-career-v1');
    expect(SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION).toBe('serbian-summary-locale-purity-348-v1');
    expect(SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION).toBe('serbian-summary-role-align-348-v1');
    expect(SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION).toBe('serbian-summary-duration-scope-348-v1');
    expect(SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION).toBe('serbian-summary-fact-fidelity-348-v1');
    expect(SERBIAN_DURATION_NOUN_FORM_349_REVISION).toBe('serbian-duration-noun-form-349-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_BUILDER_REVISION_SR);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION);
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SERBIAN_DURATION_NOUN_FORM_349_REVISION);
  });

  it('exact device enhance: bad Serbian provider → deterministic/repair apply', () => {
    const cv = atlasRewituCv({ summary: EN_VALIDATED_SUMMARY, contentLocale: 'en' });
    expect(cv.summary).toBe(EN_VALIDATED_SUMMARY);
    expect(getProAiUsageCount()).toBe(22);

    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      candidate: BAD_PROVIDER_SR,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      originHint: 'ai_generated',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toBeTruthy();
    expect(fin.text).not.toMatch(/dizajnerica/i);
    if (summaryV2ModeActive()) {
      expectSummaryContractInvariants({
        text: fin.text,
        locale: 'sr',
        cv,
        requirePrior: true,
      });
      expect(fin.text).toMatch(/Atlas|Rewitu|godina|iskustva/i);
    } else {
      expect(fin.text).toMatch(/dizajnerka/i);
      expect(fin.text).not.toMatch(/kontrolišem\s+prijem\s+robe/i);
      expect(fin.text).toMatch(/proveravam\s+pristiglu\s+robu/i);
      expect(fin.text).toMatch(/pregledala\s+i\s+prilagođavala/i);
      expect(fin.text).toMatch(/ukupnog\s+profesionalnog\s+iskustva/i);
      expect(fin.text).toMatch(/šest\s+i\s+po\s+godina/i);
      expect(fin.text).not.toMatch(/šest\s+i\s+po\s+godine/i);
      expect(fin.text).toMatch(/završne\s+dizajnerske\s+datoteke/i);
    }
    expect(fin.origin === 'deterministic_fallback' || fin.origin === 'ai_repaired').toBe(true);
    expectV2OrLegacyBuilderRevision(fin.diagnostics?.summaryBuilderRevision, SUMMARY_BUILDER_REVISION_SR);
    expect(durationSnapshot.total.totalMonths).toBe(78);
    expect(fin.diagnostics?.authoritativeDurationMonths ?? durationSnapshot.total.totalMonths).toBe(78);
    expect(countSummaryDurationExpressions(fin.text, 'sr')).toBe(1);
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.independentFinalDurationClaimCount).toBe(1);
      expect(fin.diagnostics?.durationValidationPassed).toBe(true);
      expect(fin.diagnostics?.serbianDurationNounFormPassed).toBe(true);
      expect(fin.diagnostics?.finalDurationRepresentationKind).toBe('written');
      const q = analyzeSerbianSummaryEmploymentQuality(fin.text, analyzeOpts);
      expect(q.groundingValidationPassed).toBe(true);
      expect(q.localePurityPassed).toBe(true);
      expect(q.croatianLeakageDetected).toBe(false);
      expect(q.factCoverage.finalCurrentDutyCoveragePassed).toBe(true);
      expect(q.factCoverage.coveredCurrentDutyFactCount).toBe(3);
      expect(q.factCoverage.finalPriorDutyCoveragePassed).toBe(true);
      expect(q.factCoverage.coveredPriorDutyFactCount).toBe(3);
      expect(q.durationScope.finalDurationScopeValidationPassed).toBe(true);
      expect(q.durationScope.finalDurationCurrentRoleAttachmentRisk).toBe(false);
      expect(q.serbianDurationNounFormPassed).toBe(true);
      expect(q.perspectiveMode).toBe('first_person');
      expect(q.genderValidationPassed).toBe(true);
    }

    const next = applyFinalizedSummaryToCv(cv, 'sr', fin);
    expect(next.summary).toBe(fin.text);
    expect(next.contentLocale).toBe('sr');
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(23);
  });

  it('A. dizajnerica rejected; B. dizajnerka accepted', () => {
    expect(analyzeSerbianCroatianLocaleEvidence('grafička dizajnerica').croatianLeakageDetected).toBe(true);
    const bad = analyzeSerbianSummaryEmploymentQuality(
      BAD_PROVIDER_SR,
      analyzeOpts,
    );
    expect(bad.usesDizajnerica).toBe(true);
    expect(bad.groundingValidationPassed).toBe(false);

    const good = buildSerbianEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'sa oko šest i po godina iskustva',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration: buildExperienceDurationSnapshot(
        atlasRewituCv().experience || [],
        REF,
      ).total,
    });
    expect(good).toMatch(/dizajnerka/);
    expect(good).not.toMatch(/dizajnerica/);
    expect(analyzeSerbianSummaryEmploymentQuality(good, analyzeOpts).groundingValidationPassed).toBe(true);
  });

  it('C–L. Croatian leakage rejected; Serbian Ekavian accepted', () => {
    expect(analyzeSerbianCroatianLocaleEvidence('provjeravam').croatianLeakageDetected).toBe(true);
    expect(analyzeSerbianCroatianLocaleEvidence('proveravam').croatianLeakageDetected).toBe(false);
    expect(analyzeSerbianCroatianLocaleEvidence('surađujem').croatianLeakageDetected).toBe(true);
    expect(analyzeSerbianCroatianLocaleEvidence('sarađujem').croatianLeakageDetected).toBe(false);
    expect(analyzeSerbianCroatianLocaleEvidence('premještanje').croatianLeakageDetected).toBe(true);
    expect(analyzeSerbianCroatianLocaleEvidence('premeštanje').croatianLeakageDetected).toBe(false);
    expect(analyzeSerbianCroatianLocaleEvidence('vizualne materijale').croatianLeakageDetected).toBe(true);
    expect(analyzeSerbianCroatianLocaleEvidence('vizuelne materijale').croatianLeakageDetected).toBe(false);
    expect(analyzeSerbianCroatianLocaleEvidence('zaslone').croatianLeakageDetected).toBe(true);
    expect(analyzeSerbianCroatianLocaleEvidence('ekrane').croatianLeakageDetected).toBe(false);
  });

  it('M/N. Atlas-attached duration rejected; total-career accepted', () => {
    const attached = analyzeSerbianSummaryDurationScope(
      'Radim u kompaniji Atlas kao radnica u skladištu, sa oko šest i po godina iskustva.',
      { company: 'Atlas' },
    );
    expect(attached.finalDurationCurrentRoleAttachmentRisk).toBe(true);
    expect(attached.finalDurationScopeValidationPassed).toBe(false);

    const scoped = analyzeSerbianSummaryDurationScope(
      'Imam oko šest i po godina ukupnog profesionalnog iskustva. Trenutno radim u kompaniji Atlas.',
      { company: 'Atlas' },
    );
    expect(scoped.finalDurationScopeValidationPassed).toBe(true);
    expect(scoped.finalDurationCurrentRoleAttachmentRisk).toBe(false);
    expect(scoped.finalDurationTotalCareerMarkerPresent).toBe(true);
  });

  it('O/P. incoming-goods drift rejected; faithful wording accepted', () => {
    const drift = analyzeSerbianSummaryFactCoverage(
      'Trenutno radim u Atlasu gde kontrolišem prijem robe i proveravam dokumentaciju povezanu sa primljenom robom i sarađujem sa kolegama na pripremi i premeštanju robe.',
      analyzeOpts,
    );
    expect(drift.incomingGoodsDriftDetected).toBe(true);
    expect(drift.finalCurrentDutyCoveragePassed).toBe(false);

    const ok = analyzeSerbianSummaryFactCoverage(
      'Trenutno radim u Atlasu gde proveravam pristiglu robu i dokumentaciju povezanu sa primljenom robom i sarađujem sa kolegama na pripremi i premeštanju robe.',
      analyzeOpts,
    );
    expect(ok.incomingGoodsDriftDetected).toBe(false);
    expect(ok.coveredCurrentDutyFactCount).toBe(3);
  });

  it('Q/R. adaptation alone incomplete; review+adaptation complete', () => {
    const adaptOnly = analyzeSerbianSummaryFactCoverage(
      'Prethodno sam radila kao grafička dizajnerka u Rewitu, gde sam kreirala vizuelne materijale i grafičke elemente, prilagođavala dizajnerske materijale i pripremala završne dizajnerske datoteke za različite formate i ekrane.',
      analyzeOpts,
    );
    expect(adaptOnly.priorReviewMissingDetected).toBe(true);
    expect(adaptOnly.finalPriorDutyCoveragePassed).toBe(false);

    const both = analyzeSerbianSummaryFactCoverage(
      'Prethodno sam radila kao grafička dizajnerka u Rewitu, gde sam kreirala vizuelne materijale i grafičke elemente, pregledala i prilagođavala dizajnerske materijale i pripremala završne dizajnerske datoteke za različite formate i ekrane.',
      analyzeOpts,
    );
    expect(both.priorReviewMissingDetected).toBe(false);
    expect(both.coveredPriorDutyFactCount).toBe(3);
  });

  it('S/T/U. female, male, and unspecified Serbian builders', () => {
    const female = buildSerbianEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'sa oko šest i po godina iskustva',
      dutyFacts: [],
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
    });
    expect(female).toMatch(/radnica u skladištu/);
    expect(female).toMatch(/dizajnerka/);
    expect(female).toMatch(/Prethodno sam radila/);

    const male = buildSerbianEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'male',
      durationPhrase: 'sa oko šest i po godina iskustva',
      dutyFacts: [],
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
    });
    expect(male).toMatch(/radnik u skladištu/);
    expect(male).toMatch(/Prethodno sam radio/);
    expect(male).not.toMatch(/dizajnerka|radnica/);

    const unspecified = buildSerbianEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: '',
      durationPhrase: 'sa oko šest i po godina iskustva',
      dutyFacts: [],
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
    });
    expect(unspecified).toMatch(/Prethodno iskustvo/);
    expect(unspecified).not.toMatch(/dizajnerica/);
  });

  it('V. rejected candidate preserves English Summary and usage when blocked', () => {
    seedUsage(22);
    const cv = atlasRewituCv({ summary: EN_VALIDATED_SUMMARY });
    const blocked: FinalizeCvAiFieldResult = {
      text: '',
      blocked: true,
      countedAsSuccess: false,
      origin: 'user',
      reason: 'serbian_summary_grounding_failed',
      roleDutyConflict: false,
    };
    const next = applyFinalizedSummaryToCv(cv, 'sr', blocked);
    expect(next.summary).toBe(EN_VALIDATED_SUMMARY);
    expect(getProAiUsageCount()).toBe(22);
  });

  it('W. successful apply increments usage exactly once', () => {
    seedUsage(30);
    const cv = atlasRewituCv({ summary: EN_VALIDATED_SUMMARY });
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const good = buildSerbianEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'sa oko šest i po godina iskustva',
      dutyFacts: [],
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      duration: durationSnapshot.total,
    });
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      candidate: good,
      cv,
      requestedLocale: 'sr',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      originHint: 'ai_generated',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    const next = applyFinalizedSummaryToCv(cv, 'sr', fin);
    expect(next.summary).toBe(fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(31);
  });

  it('narrow repair relocates duration and normalizes role', () => {
    const repaired = repairSerbianSummaryProviderCandidate(BAD_PROVIDER_SR, {
      company: 'Atlas',
      priorCompany: 'Rewitu',
      gender: 'female',
      durationPhrase: 'sa oko šest i po godina iskustva',
    });
    expect(repaired.attempted).toBe(true);
    expect(repaired.text).toMatch(/dizajnerka/);
    expect(repaired.text).toMatch(/proveravam\s+pristiglu\s+robu/);
    expect(repaired.text).toMatch(/ukupnog\s+profesionalnog\s+iskustva/);
    expect(injectSerbianTotalDurationSentence(
      'Radim u Atlasu sa oko šest i po godina iskustva.',
      'sa oko šest i po godina iskustva',
    )).toMatch(/^Imam oko šest i po godina ukupnog profesionalnog iskustva\./);
  });
});

describe('AAB-349 Serbian written-duration noun grammar', () => {
  it('formatter emits šest i po godina for 78 months / 6.5 years', () => {
    const dur = buildExperienceDurationSnapshot(
      atlasRewituCv().experience || [],
      REF,
    ).total;
    expect(dur.totalMonths).toBe(78);
    expect(dur.approxYears).toBe(6.5);
    const phrase = formatApproximateDurationPhrase(dur, 'sr');
    expect(phrase).toMatch(/šest\s+i\s+po\s+godina/i);
    expect(phrase).not.toMatch(/šest\s+i\s+po\s+godine/i);
    expect(serbianYearNounForApproxYears(6.5)).toBe('godina');
  });

  it('half-year inflection matrix', () => {
    const cases: Array<[number, 'godina' | 'godine' | 'godinu']> = [
      [1, 'godina'],
      [1.5, 'godine'],
      [2, 'godine'],
      [2.5, 'godine'],
      [3.5, 'godine'],
      [4.5, 'godine'],
      [5.5, 'godina'],
      [6.5, 'godina'],
      [10.5, 'godina'],
      [11.5, 'godina'],
      [12.5, 'godina'],
      [21.5, 'godina'],
    ];
    for (const [n, noun] of cases) {
      expect(serbianYearNounForApproxYears(n), String(n)).toBe(noun);
    }
  });

  it('A. šest i po godine → reject; B. šest i po godina → accept', () => {
    expect(hasIncorrectSerbianDurationGrammar('sa oko šest i po godine iskustva')).toBe(true);
    expect(analyzeSerbianDurationNounForms('sa oko šest i po godine iskustva')
      .serbianDurationGrammarRejectionReason).toBe('serbian_duration_noun_form_invalid');
    expect(hasIncorrectSerbianDurationGrammar('sa oko šest i po godina iskustva')).toBe(false);
    expect(normalizeSerbianDurationGrammar('sa oko šest i po godine iskustva'))
      .toMatch(/šest\s+i\s+po\s+godina/i);
  });

  it('C–G. accept correct half-year paucal/genitive peers', () => {
    for (const ok of [
      'dve i po godine iskustva',
      'tri i po godine iskustva',
      'četiri i po godine iskustva',
      'pet i po godina iskustva',
      'jedanaest i po godina iskustva',
    ]) {
      expect(hasIncorrectSerbianDurationGrammar(ok), ok).toBe(false);
    }
  });

  it('H/I. correct noun but Atlas-attached duration still fails scope; total-career passes', () => {
    const attached = analyzeSerbianSummaryDurationScope(
      'Radim u kompaniji Atlas kao radnica u skladištu, sa oko šest i po godina iskustva.',
      { company: 'Atlas' },
    );
    expect(attached.finalDurationCurrentRoleAttachmentRisk).toBe(true);
    expect(attached.finalDurationScopeValidationPassed).toBe(false);
    expect(hasIncorrectSerbianDurationGrammar(
      'Radim u kompaniji Atlas kao radnica u skladištu, sa oko šest i po godina iskustva.',
    )).toBe(false);

    const scoped = 'Imam oko šest i po godina ukupnog profesionalnog iskustva. Trenutno radim u kompaniji Atlas.';
    expect(analyzeSerbianSummaryDurationScope(scoped, { company: 'Atlas' })
      .finalDurationScopeValidationPassed).toBe(true);
    expect(hasIncorrectSerbianDurationGrammar(scoped)).toBe(false);
  });
});
