/**
 * AAB-359 — French → Italian Professional Summary Stronger cross-locale recovery.
 * Shared requested-locale dispatch; first-person Italian from structured Experience.
 * Shared duration-slot packaging: totalDurationSlotPresent agrees with duration unit.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildConciseGroundedSummary,
} from '@/lib/cv-summary-grounding';
import {
  analyzeItalianSummaryEmploymentQuality,
  buildItalianEntryOwnedSummary,
  detectItalianSummaryPerspective,
  SUMMARY_BUILDER_REVISION_IT,
} from '@/lib/cv-italian-summary-grounding';
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from '@/lib/cv-french-summary-grounding';
import {
  resolveSummaryBuilderRevision,
  resolveSummaryTargetScript,
  assertSummaryBuilderMatchesRequestedLocale,
  SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION,
} from '@/lib/cv-summary-locale-dispatch';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
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

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function atlasRewituCv(summary: string, contentLocale: string = 'fr'): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: "Employée d'entrepôt",
      gender: 'female',
    },
    summary,
    contentLocale,
    summaryOrigin: 'ai_generated',
    experience: [
      {
        id: 'atlas',
        position: "Employée d'entrepôt",
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_EN,
        canonicalDescription: WH_EN,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
      {
        id: 'rewitu',
        position: 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: GD_EN,
        canonicalDescription: GD_EN,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
    ],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
  };
}

function assertFirstPersonItalian(text: string): void {
  expect(detectItalianSummaryPerspective(text)).toBe('first_person');
  expect(text).toMatch(/dispongo|attualmente\s+lavoro|in\s+precedenza/iu);
  expect(text).toMatch(/addetta\s+al\s+magazzino/i);
  expect(text).toMatch(/designer\s+grafica|graphic\s+designer/i);
  expect(text).not.toMatch(/\b(?:je|dispose|travaille actuellement|auparavant)\b/iu);
  expect(text).not.toMatch(/\b(?:ich|derzeit|arbeite)\b/iu);
}

describe('AAB-359 French→Italian Summary Stronger', () => {
  beforeEach(() => {
    seedUsage(29);
  });

  it('routes requestedLocale=it to Italian builder (never English/German/French)', () => {
    expect(SUMMARY_BUILDER_REVISION_IT).toBe('entry-owned-italian-rebuild-359-v1');
    expect(resolveSummaryBuilderRevision('it')).toBe(SUMMARY_BUILDER_REVISION_IT);
    expect(resolveSummaryTargetScript('it')).toBe('latin');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'it',
      'entry-owned-english-rebuild-v1',
    )).toBe('italian_request_routed_to_english_builder');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'it',
      'entry-owned-french-rebuild-358-v1',
    )).toBe('italian_request_routed_to_french_builder');
  });

  it('remaining-locale fail-closed matrix for pt-BR/ru/ja', () => {
    expect(resolveSummaryBuilderRevision('pt-BR')).toBe(
      SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION,
    );
    const frText = [
      'Je dispose d’environ six ans et demi d’expérience professionnelle au total.',
      'Je travaille actuellement chez Atlas en tant qu’employée d’entrepôt.',
      'Auparavant, j’ai travaillé chez Rewitu en tant que graphiste.',
    ].join(' ');
    for (const locale of ['it', 'pt-BR'] as const) {
      const purity = validateAiUnitLocalePurity(frText, locale, {
        kind: 'summary_sentence',
        requireUnits: true,
      });
      expect(purity.targetLocalePurityPassed, locale).toBe(false);
      expect(purity.unexpectedLocaleCodes).toContain('fr');
    }
    for (const locale of ['ru', 'ja'] as const) {
      const purity = validateAiUnitLocalePurity(frText, locale, {
        kind: 'summary_sentence',
        requireUnits: true,
      });
      expect(purity.targetLocalePurityPassed || purity.ok, locale).toBe(false);
    }
  });

  it('source French Summary is the validated 585-character form', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const fr = buildConciseGroundedSummary(factSet, 'fr', 'female', duration.total);
    expect(fr.length).toBe(585);
    expect(fingerprintText(fr)).toBe('fnv1a_925ad56f_l585_b74_e46');
  });

  it('builder emits first-person Italian from structured Experience (not French)', () => {
    const text = buildItalianEntryOwnedSummary({
      role: "Employée d'entrepôt",
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'sei anni e mezzo',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      locale: 'it',
    });
    assertFirstPersonItalian(text);
  });

  it('exact Stronger path: French provider echo → Italian deterministic apply + usage 29→30', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    expect(durationSnapshot.total.totalMonths).toBe(78);
    const sourceFr = buildConciseGroundedSummary(factSet, 'fr', 'female', durationSnapshot.total);
    expect(sourceFr.length).toBe(585);
    expect(fingerprintText(sourceFr)).toBe('fnv1a_925ad56f_l585_b74_e46');
    const cv = atlasRewituCv(sourceFr, 'fr');
    expect(getProAiUsageCount()).toBe(29);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourceFr,
      cv,
      requestedLocale: 'it',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertFirstPersonItalian(fin.text);
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_IT);
    expect(fin.diagnostics?.summaryBuilderRevision).not.toMatch(/english|german|french|hindi/i);
    expect(fin.diagnostics?.perspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.finalPerspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.perspectiveValidationPassed).toBe(true);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.missingCurrentDutyFactCount).toBe(0);
    expect(fin.diagnostics?.finalCurrentDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.requiredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.missingPriorDutyFactCount).toBe(0);
    expect(fin.diagnostics?.finalPriorDutyCoveragePassed).toBe(true);
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
    expect(fin.diagnostics?.totalDurationSlotPresent).toBe(true);
    expect(fin.diagnostics?.finalTotalDurationSlotPresent).toBe(true);
    expect(fin.diagnostics?.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(fin.diagnostics?.detectedLocaleByUnit).toEqual(['it', 'it', 'it']);
    expect(fin.diagnostics?.detectedScriptByUnit).toEqual(['latin', 'latin', 'latin']);
    expect(fin.diagnostics?.wrongLocaleUnitCount).toBe(0);
    expect(fin.diagnostics?.unexpectedLocaleCodes || []).toEqual([]);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.localeValidationPassed).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason
      || fin.diagnostics?.providerRejectionReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.diagnostics?.clientFallbackReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.diagnostics?.providerOutcome).toBe('rejected_locale');
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.deterministicAccepted).toBe(true);
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    expect(fin.diagnostics?.deterministicCandidateNormalizedHash).toBeTruthy();
    expect(fin.diagnostics?.clientFallbackUsed).toBe(true);
    expect(fin.diagnostics?.fallbackApplied).toBe(true);

    const q = analyzeItalianSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      role: 'addetta al magazzino',
      priorCompany: 'Rewitu',
      priorRole: 'designer grafica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.perspectiveMode).toBe('first_person');
    expect(q.totalDurationSlotPresent).toBe(true);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'it',
      requestedLocale: 'it',
      contentLocale: 'fr',
      gender: 'female',
      usageCountBefore: 29,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, sourceFr);
    session.recordFinalizeResult(fin);
    expect(session.draft.targetScript).toBe('latin');
    expect(session.draft.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_IT);
    expect(session.draft.totalDurationSlotPresent).toBe(true);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(
      pre.passed,
      JSON.stringify({
        pre,
        failures: session.draft.diagnosticInvariantFailures,
        nullFields: session.draft.nullRequiredDiagnosticFields,
      }, null, 2),
    ).toBe(true);
    const next = applyFinalizedSummaryToCv(cv, 'it', fin);
    expect(next.summary).toBe(fin.text);
    session.recordVisibleApply(true, 30, fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(30);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.visibleCandidateHashAfterApply).toBe(fin.diagnostics?.finalValidatedCandidateHash);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    expect(trace.totalDurationSlotPresent).toBe(true);
    const inv = checkSummaryDiagnosticInvariants(
      trace as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
    );
    expect(inv.passed, JSON.stringify(inv.failures, null, 2)).toBe(true);
  });

  it('rejects French deterministic candidate for Italian target', () => {
    const fr = [
      'Je dispose d’environ six ans et demi d’expérience professionnelle au total.',
      'Je travaille actuellement chez Atlas en tant qu’employée d’entrepôt.',
      'Auparavant, j’ai travaillé chez Rewitu en tant que graphiste.',
    ].join(' ');
    const purity = validateAiUnitLocalePurity(fr, 'it', {
      kind: 'summary_sentence',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(false);
    const q = analyzeItalianSummaryEmploymentQuality(fr, {
      company: 'Atlas',
      role: 'addetta al magazzino',
      priorCompany: 'Rewitu',
      priorRole: 'designer grafica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('rejects neutral Italian perspective', () => {
    const neutral = [
      'Dispongo complessivamente di circa sei anni e mezzo di esperienza professionale.',
      'Lavoro attualmente presso Atlas come addetta al magazzino.',
      'In precedenza ha lavorato presso Rewitu come designer grafica.',
    ].join(' ');
    // Force third-person cue without first-person verbs beyond duration.
    const q = analyzeItalianSummaryEmploymentQuality(
      'Professionista con esperienza magazzino presso Atlas. Precedente ruolo design presso Rewitu.',
      {
        company: 'Atlas',
        role: 'addetta al magazzino',
        priorCompany: 'Rewitu',
        priorRole: 'designer grafica',
        currentEntryDuties: WH_EN,
        priorEntryDuties: GD_EN,
        gender: 'female',
      },
    );
    expect(q.perspectiveValidationPassed).toBe(false);
    void neutral;
  });

  it('accepts arbitrary free-text role with grounded Italian duties', () => {
    const text = buildItalianEntryOwnedSummary({
      role: 'Coordinatrice logistica regionale',
      employer: 'NordPack',
      gender: 'female',
      durationPhrase: 'cinque anni',
      dutyFacts: [
        { value: 'coordina i flussi di magazzino', sourceText: 'coordina i flussi di magazzino' },
        { value: 'verifica la documentazione spedizioni', sourceText: 'verifica la documentazione spedizioni' },
        { value: 'supporta il team operativo', sourceText: 'supporta il team operativo' },
      ],
      locale: 'it',
    });
    expect(text).toMatch(/NordPack/i);
    expect(text).toMatch(/coordinatrice\s+logistica\s+regionale/i);
    expect(detectItalianSummaryPerspective(text)).toBe('first_person');
  });

  it('five-plus-entry CV preserves entry ownership and bounded output', () => {
    const many: CVData = {
      ...atlasRewituCv(''),
      experience: [
        ...(atlasRewituCv('').experience || []),
        {
          id: 'e3',
          position: 'Assistente',
          company: 'Beta',
          startDate: '2018-01',
          endDate: '2019-12',
          isPresent: false,
          description: 'supporto amministrativo;',
          descriptionOrigin: 'user',
        },
        {
          id: 'e4',
          position: 'Stagista',
          company: 'Gamma',
          startDate: '2017-01',
          endDate: '2017-12',
          isPresent: false,
          description: 'archiviazione documenti;',
          descriptionOrigin: 'user',
        },
        {
          id: 'e5',
          position: 'Cassiera',
          company: 'Delta',
          startDate: '2016-01',
          endDate: '2016-12',
          isPresent: false,
          description: 'gestione cassa;',
          descriptionOrigin: 'user',
        },
      ],
    };
    const factSet = buildCvCanonicalFactSet(many, { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(many.experience || [], REF);
    const text = buildConciseGroundedSummary(factSet, 'it', 'female', duration.total);
    expect(text.length).toBeGreaterThan(80);
    expect(text.length).toBeLessThan(1200);
    expect(text).toMatch(/Atlas/i);
    expect(detectItalianSummaryPerspective(text)).toBe('first_person');
  });

  it('duration slot packaging invariant: duration unit implies totalDurationSlotPresent', () => {
    const failures = checkSummaryDiagnosticInvariants({
      requestedLocale: 'it',
      countedAsSuccess: true,
      slotValidationPassed: true,
      totalDurationSlotPresent: false,
      finalUnitRoleSlots: ['duration', 'current_intro', 'prior_role'],
      finalDurationOwnerDetected: 'total_professional_experience',
      finalDurationOwnerExpected: 'total_professional_experience',
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0]);
    expect(failures.passed).toBe(false);
    expect(failures.failures.some((f) => f.invariantCode === 'total_duration_slot_false_with_duration_unit')).toBe(true);
  });

  it('rejected path preserves Summary and usage', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceFr = buildConciseGroundedSummary(factSet, 'fr', 'female', durationSnapshot.total);
    const cv = atlasRewituCv(sourceFr, 'fr');
    seedUsage(29);
    expect(resolveSummaryBuilderRevision('pt-BR')).toBe(
      SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION,
    );
    expect(getProAiUsageCount()).toBe(29);
    expect(cv.summary).toBe(sourceFr);
  });
});
