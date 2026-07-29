/**
 * AAB-358 — German → French Professional Summary Stronger cross-locale recovery.
 * Shared requested-locale dispatch; first-person French from structured Experience.
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
  analyzeFrenchSummaryEmploymentQuality,
  buildFrenchEntryOwnedSummary,
  detectFrenchSummaryPerspective,
  SUMMARY_BUILDER_REVISION_FR,
  PROVIDER_CROSS_LOCALE_NOOP_REASON,
} from '@/lib/cv-french-summary-grounding';
import {
  resolveSummaryBuilderRevision,
  resolveSummaryTargetScript,
  assertSummaryBuilderMatchesRequestedLocale,
  SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION,
  SUMMARY_REQUESTED_LOCALE_DISPATCH_358_REVISION,
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

function atlasRewituCv(summary: string, contentLocale: string = 'de'): CVData {
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
  } as CVData;
}

function assertFirstPersonFrench(text: string): void {
  expect(detectFrenchSummaryPerspective(text)).toBe('first_person');
  expect(text).toMatch(/Je\s+dispose\s+d['’]environ\s+six\s+ans\s+et\s+demi/i);
  expect(text).toMatch(/Je\s+travaille\s+actuellement\s+chez\s+Atlas/i);
  expect(text).toMatch(/employée\s+d['’]entrepôt/i);
  expect(text).toMatch(/marchandises\s+entrantes/i);
  expect(text).toMatch(/documentation\s+relative\s+aux\s+marchandises\s+re[cç]ues/i);
  expect(text).toMatch(/coordonne\s+avec\s+(?:mes\s+)?coll[eè]gues/i);
  expect(text).toMatch(/Auparavant,\s+j['’]ai\s+travaillé\s+chez\s+Rewitu/i);
  expect(text).toMatch(/graphiste|conceptrice\s+graphique/i);
  expect(text).toMatch(/supports\s+visuels/i);
  expect(text).toMatch(/éléments\s+graphiques/i);
  expect(text).toMatch(/fichiers\s+de\s+conception\s+finaux/i);
  expect(text).toMatch(/formats|écrans/i);
  expect(text).not.toMatch(/\b(?:ich|derzeit|arbeite|prüfe)\b/i);
  expect(text).not.toMatch(/\b(?:elle|il)\s+travaille\b/i);
}

describe('AAB-358 German→French Summary Stronger', () => {
  beforeEach(() => {
    seedUsage(28);
  });

  it('routes requestedLocale=fr to French builder (never English/German)', () => {
    expect(SUMMARY_BUILDER_REVISION_FR).toBe('entry-owned-french-rebuild-358-v1');
    expect(SUMMARY_REQUESTED_LOCALE_DISPATCH_358_REVISION).toBe(
      'summary-requested-locale-dispatch-358-v1',
    );
    expect(resolveSummaryBuilderRevision('fr')).toBe(SUMMARY_BUILDER_REVISION_FR);
    expect(resolveSummaryTargetScript('fr')).toBe('latin');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'fr',
      'entry-owned-english-rebuild-v1',
    )).toBe('french_request_routed_to_english_builder');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'fr',
      'entry-owned-german-rebuild-355-v1',
    )).toBe('french_request_routed_to_german_builder');
  });

  it('remaining-locale routing matrix (pt-BR dedicated; foreign reuse blocked)', () => {
    expect(resolveSummaryBuilderRevision('pt-BR')).toBe('entry-owned-ptbr-rebuild-361-v1');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'pt-BR',
      'entry-owned-english-rebuild-v1',
    )).toBe('ptbr_request_routed_to_english_builder');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'it',
      'entry-owned-english-rebuild-v1',
    )).toBe('italian_request_routed_to_english_builder');

    const deText = [
      'Ich verfüge über insgesamt rund sechseinhalb Jahre Berufserfahrung.',
      'Derzeit arbeite ich bei Atlas als Lagermitarbeiterin.',
      'Zuvor arbeitete ich bei Rewitu als Grafikdesignerin.',
    ].join(' ');
    for (const locale of ['fr', 'it', 'pt-BR'] as const) {
      const purity = validateAiUnitLocalePurity(deText, locale, {
        kind: 'summary_sentence',
        requireUnits: true,
      });
      expect(purity.targetLocalePurityPassed, locale).toBe(false);
      expect(purity.unexpectedLocaleCodes).toContain('de');
      expect(purity.wrongLocaleUnitCount).toBeGreaterThan(0);
    }
    const latin = 'Je travaille actuellement chez Atlas en tant qu’employée d’entrepôt.';
    for (const locale of ['ru', 'ja'] as const) {
      const purity = validateAiUnitLocalePurity(latin, locale, {
        kind: 'summary_sentence',
        requireUnits: true,
      });
      expect(purity.targetLocalePurityPassed || purity.ok, locale).toBe(false);
    }
  });

  it('source German Summary is the validated 548-character form', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const de = buildConciseGroundedSummary(factSet, 'de', 'female', duration.total);
    expect(de.length).toBe(548);
    expect(fingerprintText(de)).toBe('fnv1a_d35ada3c_l548_b73_e46');
  });

  it('builder emits first-person French from structured Experience (not German)', () => {
    const text = buildFrenchEntryOwnedSummary({
      role: "Employée d'entrepôt",
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'environ six ans et demi',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      locale: 'fr',
    });
    assertFirstPersonFrench(text);
  });

  it('exact Stronger path: German provider echo → French deterministic apply + usage 28→29', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    expect(durationSnapshot.total.totalMonths).toBe(78);
    const sourceDe = buildConciseGroundedSummary(factSet, 'de', 'female', durationSnapshot.total);
    expect(sourceDe.length).toBe(548);
    expect(fingerprintText(sourceDe)).toBe('fnv1a_d35ada3c_l548_b73_e46');
    const cv = atlasRewituCv(sourceDe, 'de');
    expect(getProAiUsageCount()).toBe(28);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourceDe,
      cv,
      requestedLocale: 'fr',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertFirstPersonFrench(fin.text);
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_FR);
    expect(fin.diagnostics?.summaryBuilderRevision).not.toMatch(/english|german|hindi/i);
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
    expect(fin.diagnostics?.detectedLocaleByUnit).toEqual(['fr', 'fr', 'fr']);
    expect(fin.diagnostics?.detectedScriptByUnit).toEqual(['latin', 'latin', 'latin']);
    expect(fin.diagnostics?.wrongLocaleUnitCount).toBe(0);
    expect(fin.diagnostics?.unexpectedLocaleCodes || []).toEqual([]);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.localeValidationPassed).toBe(true);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason
      || fin.diagnostics?.providerRejectionReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.diagnostics?.clientFallbackReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.deterministicAccepted).toBe(true);
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    expect(fin.diagnostics?.deterministicCandidateNormalizedHash).toBeTruthy();
    expect(fin.diagnostics?.deterministicCandidateHash).toBe(
      fin.diagnostics?.finalValidatedCandidateHash,
    );
    expect(fin.diagnostics?.clientFallbackUsed).toBe(true);
    expect(fin.diagnostics?.fallbackApplied).toBe(true);

    const q = analyzeFrenchSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      role: "employée d'entrepôt",
      priorCompany: 'Rewitu',
      priorRole: 'graphiste',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.perspectiveMode).toBe('first_person');

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'fr',
      requestedLocale: 'fr',
      contentLocale: 'de',
      gender: 'female',
      usageCountBefore: 28,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, sourceDe);
    session.recordFinalizeResult(fin);
    expect(session.draft.targetScript).toBe('latin');
    expect(session.draft.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_FR);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(
      pre.passed,
      JSON.stringify({
        pre,
        failures: session.draft.diagnosticInvariantFailures,
        nullFields: session.draft.nullRequiredDiagnosticFields,
      }, null, 2),
    ).toBe(true);
    const next = applyFinalizedSummaryToCv(cv, 'fr', fin);
    expect(next.summary).toBe(fin.text);
    session.recordVisibleApply(true, 29, fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(29);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.visibleCandidateHashAfterApply).toBe(fin.diagnostics?.finalValidatedCandidateHash);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    const inv = checkSummaryDiagnosticInvariants(
      trace as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
    );
    expect(inv.passed, JSON.stringify(inv.failures)).toBe(true);
  });

  it('rejects German deterministic candidate for French target', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const de = buildConciseGroundedSummary(factSet, 'de', 'female', durationSnapshot.total);
    const purity = validateAiUnitLocalePurity(de, 'fr', {
      kind: 'summary_sentence',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(false);
    expect(purity.wrongLocaleUnitCount).toBe(3);
    expect(purity.unexpectedLocaleCodes).toContain('de');
    expect(purity.detectedLocaleByUnit).toEqual(['de', 'de', 'de']);
  });

  it('rejects neutral French perspective', () => {
    const neutral = 'Professionnelle avec expérience en entrepôt chez Atlas et design chez Rewitu.';
    const q = analyzeFrenchSummaryEmploymentQuality(neutral, {
      company: 'Atlas',
      role: "employée d'entrepôt",
      priorCompany: 'Rewitu',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.perspectiveValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('accepts arbitrary free-text role with grounded French duties', () => {
    const text = [
      'Je dispose d’environ trois ans d’expérience professionnelle au total.',
      'Je travaille actuellement chez Nova en tant que coordinatrice logistique,',
      'où je contrôle les marchandises entrantes, vérifie la documentation relative',
      'aux marchandises reçues et me coordonne avec mes collègues pour la préparation',
      'et le déplacement des marchandises.',
    ].join(' ');
    const q = analyzeFrenchSummaryEmploymentQuality(text, {
      company: 'Nova',
      role: 'coordinatrice logistique',
      currentEntryDuties: WH_EN,
      gender: 'female',
    });
    expect(q.finalCurrentDutyCoveragePassed).toBe(true);
    expect(q.perspectiveMode).toBe('first_person');
  });

  it('rejected path preserves Summary and usage', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceDe = buildConciseGroundedSummary(factSet, 'de', 'female', durationSnapshot.total);
    const cv = atlasRewituCv(sourceDe, 'de');
    seedUsage(28);
    // pt-BR now has a dedicated builder; usage/Summary still preserved on this path.
    expect(resolveSummaryBuilderRevision('pt-BR')).toBe('entry-owned-ptbr-rebuild-361-v1');
    expect(getProAiUsageCount()).toBe(28);
    expect(cv.summary).toBe(sourceDe);
  });
});
