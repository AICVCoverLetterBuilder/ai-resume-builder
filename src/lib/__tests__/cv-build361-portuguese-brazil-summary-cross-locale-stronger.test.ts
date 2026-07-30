/**
 * AAB-361 — Italian → Brazilian Portuguese Professional Summary Stronger.
 * Entry-owned pt-BR deterministic fallback; provider rejection totality;
 * three-unit topology; locale transaction it → pt-BR.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  analyzePortugueseBrazilSummaryEmploymentQuality,
  analyzePortugueseBrazilDurationGrammar,
  buildPortugueseBrazilEntryOwnedSummary,
  detectPortugueseBrazilSummaryPerspective,
  hasIncorrectPortugueseBrazilDurationGrammar,
  splitPortugueseBrazilSummaryUnits,
  SUMMARY_BUILDER_REVISION_PT_BR,
  PTBR_SUMMARY_UNIT_SPLITTER_361_REVISION,
  PTBR_SUMMARY_DURATION_GRAMMAR_INVALID,
  PTBR_SUMMARY_DURATION_GRAMMAR_REVISION,
} from '@/lib/cv-portuguese-summary-grounding';
import { PROVIDER_CROSS_LOCALE_NOOP_REASON } from '@/lib/cv-french-summary-grounding';
import {
  resolveSummaryBuilderRevision,
  resolveSummaryTargetScript,
  assertSummaryBuilderMatchesRequestedLocale,
  SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION,
} from '@/lib/cv-summary-locale-dispatch';
import { validateAiUnitLocalePurity } from '@/lib/cv-ai-unit-locale-purity';
import { detectTextLocale } from '@/lib/cv-content-locale';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import {
  applyApproximateDurationPolicy,
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  formatPortugueseBrazilDurationCore,
} from '@/lib/cv-experience-duration';
import { buildConciseGroundedSummary } from '@/lib/cv-summary-grounding';
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

function atlasRewituCv(summary: string, contentLocale: string = 'it'): CVData {
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
        endDate: '2022-12',
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
    projects: [],
    customSections: [],
  } as CVData;
}

function assertFirstPersonPtBr(text: string, cv?: CVData): void {
  if (summaryV2ModeActive()) {
    expectSummaryContractInvariants({
      text,
      locale: 'pt-BR',
      cv: cv || atlasRewituCv(''),
      requirePrior: true,
    });
    return;
  }

  expect(detectPortugueseBrazilSummaryPerspective(text)).toBe('first_person');
  expect(text).toMatch(/\btenho\b/iu);
  expect(text).toMatch(/\batualmente\s+trabalho\b/iu);
  expect(text).toMatch(/\banteriormente\b/iu);
  expect(text).toMatch(/funcion[aá]ria\s+de\s+armaz[eé]m/iu);
  expect(text).toMatch(/designer\s+gr[aá]fica/iu);
  expect(text).toMatch(/\bseis\s+anos\s+e\s+meio\b/iu);
  expect(text).not.toMatch(/\bseis\s+e\s+meio\s+anos\b/iu);
  expect(text).not.toMatch(/\bdispongo\b|\battualmente\b|\becr[aã]s\b/iu);
  expect(text).toMatch(/\btelas\b/iu);
  expect(hasIncorrectPortugueseBrazilDurationGrammar(text)).toBe(false);

}

describe('AAB-361 Italian→pt-BR Summary Stronger', () => {
  beforeEach(() => {
    seedUsage(30);
  });

  it('routes requestedLocale=pt-BR to Brazilian Portuguese builder', () => {
    expect(SUMMARY_BUILDER_REVISION_PT_BR).toBe('entry-owned-ptbr-rebuild-361-v1');
    expect(resolveSummaryBuilderRevision('pt-BR')).toBe(SUMMARY_BUILDER_REVISION_PT_BR);
    expect(resolveSummaryTargetScript('pt-BR')).toBe('latin');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'pt-BR',
      'entry-owned-italian-rebuild-359-v1',
    )).toBe('ptbr_request_routed_to_italian_builder');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'pt-BR',
      'entry-owned-french-rebuild-358-v1',
    )).toBe('ptbr_request_routed_to_french_builder');
  });

  it('Russian and Japanese remain fail-closed for unsupported builder reuse', () => {
    expect(resolveSummaryBuilderRevision('ru')).not.toBe(
      SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION,
    );
    // ru/ja have builders but Italian text must fail purity for those targets
    const itText = [
      'Dispongo complessivamente di circa sei anni e mezzo di esperienza professionale.',
      'Attualmente lavoro presso Atlas come addetta al magazzino.',
      'In precedenza ho lavorato presso Rewitu come designer grafica.',
    ].join(' ');
    for (const locale of ['ru', 'ja'] as const) {
      const purity = validateAiUnitLocalePurity(itText, locale, {
        kind: 'summary_sentence',
        requireUnits: true,
      });
      expect(purity.targetLocalePurityPassed || purity.ok, locale).toBe(false);
    }
  });

  it('source Italian Summary is the validated 538-character form', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const it = buildConciseGroundedSummary(factSet, 'it', 'female', duration.total);
    expect(it.length).toBe(538);
    expect(fingerprintText(it)).toBe('fnv1a_530b6c66_l538_b68_e46');
  });

  it('builder emits first-person Brazilian Portuguese from structured Experience', () => {
    void PTBR_SUMMARY_UNIT_SPLITTER_361_REVISION;
    const text = buildPortugueseBrazilEntryOwnedSummary({
      role: "Employée d'entrepôt",
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'seis anos e meio',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      locale: 'pt-BR',
    });
    assertFirstPersonPtBr(text);
  });

  it('exact AAB 361 path: Italian provider echo → pt-BR deterministic apply + usage 30→31', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    expect(durationSnapshot.total.totalMonths).toBe(78);
    const sourceIt = buildConciseGroundedSummary(factSet, 'it', 'female', durationSnapshot.total);
    expect(sourceIt.length).toBe(538);
    expect(fingerprintText(sourceIt)).toBe('fnv1a_530b6c66_l538_b68_e46');
    const cv = atlasRewituCv(sourceIt, 'it');
    expect(detectTextLocale(sourceIt, { storedLocale: 'it' })).toBe('it');
    expect(getProAiUsageCount()).toBe(30);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourceIt,
      cv,
      requestedLocale: 'pt-BR',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertFirstPersonPtBr(fin.text);
    if (!summaryV2ModeActive()) {
      expect(fin.text).toMatch(/\btenho,?\s+ao\s+todo,?\s+cerca\s+de\s+seis\s+anos\s+e\s+meio\b/iu);
      expect(fin.text).not.toMatch(/\bseis\s+e\s+meio\s+anos\b/iu);
    } else {
      expect(fin.text).toMatch(/cerca de|anos|experiência/i);
      expect(fin.text).toMatch(/Atualmente|Anteriormente/i);
    }
    expect(fin.diagnostics?.grammarValidationPassed).toBe(true);
    expect(fin.diagnostics?.durationValidationPassed).toBe(true);
    expect(
      fin.diagnostics?.structuredDurationMonths
      ?? fin.diagnostics?.durationSemanticValueMonths,
    ).toBe(78);
    if (!summaryV2ModeActive()) {
      expect(fin.text).toMatch(/\bseis\s+anos\s+e\s+meio\b/iu);
      expect(fin.text).not.toMatch(/\bseis\s+e\s+meio\s+anos\b/iu);
    } else {
      expect(fin.text).toMatch(/anos|experiência|Atlas|Rewitu/i);
    }
    expectV2OrLegacyBuilderRevision(fin.diagnostics?.summaryBuilderRevision, SUMMARY_BUILDER_REVISION_PT_BR);
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
    expect(fin.diagnostics?.finalSentenceRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
    expect(fin.diagnostics?.deterministicCandidateSentenceCount).toBe(3);
    expect(fin.diagnostics?.totalDurationSlotPresent).toBe(true);
    expect(fin.diagnostics?.finalDurationOwnerDetected).toBe('total_professional_experience');
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.detectedLocaleByUnit).toEqual(['pt-BR', 'pt-BR', 'pt-BR']);
      expect(fin.diagnostics?.detectedScriptByUnit).toEqual(['latin', 'latin', 'latin']);
    }
    expect(fin.diagnostics?.wrongLocaleUnitCount).toBe(0);
    expect(fin.diagnostics?.unexpectedLocaleCodes || []).toEqual([]);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.detectedVisibleContentLocaleBeforeRequest).toBe('it');
      expect(fin.diagnostics?.contentLocaleAfterApply).toBe('it');
      expect(fin.diagnostics?.finalContentLocaleAfterApply).toBeNull();
    } else {
      expect(fin.diagnostics?.detectedVisibleContentLocaleBeforeRequest).toBeTruthy();
    }
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    if (summaryV2ModeActive()) {
      expect(
        fin.diagnostics?.providerTypedRejectionReason
          || fin.diagnostics?.providerRejectionReason,
      ).toBeTruthy();
      expect(
        fin.diagnostics?.clientFallbackReason
          || fin.diagnostics?.providerTypedRejectionReason,
      ).toBeTruthy();
    } else {
      expect(fin.diagnostics?.providerTypedRejectionReason
        || fin.diagnostics?.providerRejectionReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
      expect(fin.diagnostics?.clientFallbackReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    }
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();

    if (!summaryV2ModeActive()) {
      const q = analyzePortugueseBrazilSummaryEmploymentQuality(fin.text, {
        company: 'Atlas',
        role: 'funcionária de armazém',
        priorCompany: 'Rewitu',
        priorRole: 'designer gráfica',
        currentEntryDuties: WH_EN,
        priorEntryDuties: GD_EN,
        gender: 'female',
      });
      expect(q.groundingValidationPassed).toBe(true);
      expect(q.unitCount).toBe(3);
      expect(q.finalUnitRoleSlots).toEqual(['duration', 'current_intro', 'prior_role']);
    }

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'pt-BR',
      requestedLocale: 'pt-BR',
      contentLocale: 'it',
      gender: 'female',
      usageCountBefore: 30,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, sourceIt);
    session.recordFinalizeResult(fin);
    if (!summaryV2ModeActive()) {
      expect(session.draft.detectedVisibleContentLocaleBeforeRequest).toBe('it');
    }
    const pre = session.evaluatePreApplyDecisionGates();
    if (!summaryV2ModeActive()) {
      expect(pre.passed, JSON.stringify(session.draft.diagnosticInvariantFailures, null, 2)).toBe(true);
    }
    const next = applyFinalizedSummaryToCv(cv, 'pt-BR', fin);
    expect(next.summary).toBe(fin.text);
    expect(next.contentLocale).toBe('pt-BR');
    session.recordVisibleApply(true, 31, fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(31);
    const trace = session.commit();
    if (!summaryV2ModeActive()) {
      expect(trace.visibleApplySucceeded).toBe(true);
      expect(trace.contentLocaleAfterApply).toBe('pt-BR');
      expect(trace.finalContentLocaleAfterApply).toBe('pt-BR');
      expect(trace.contentLocaleUpdatedAfterApply).toBe(true);
      const inv = checkSummaryDiagnosticInvariants(
        trace as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
      );
      if (!summaryV2ModeActive()) {
        expect(inv.passed, JSON.stringify(inv.failures, null, 2)).toBe(true);
      }
    } else {
      expect(next.summary).toBe(fin.text);
      expect(next.contentLocale).toBe('pt-BR');
      expect(getProAiUsageCount()).toBe(31);
    }
  });

  it('changed-invalid provider gets typed grounding rejection (not noop)', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceIt = buildConciseGroundedSummary(factSet, 'it', 'female', durationSnapshot.total);
    const changedProvider = [
      'Tenho experiência profissional relevante no setor logístico.',
      'Atualmente trabalho na Atlas como funcionária de armazém com responsabilidades operacionais.',
    ].join(' ');
    expect(fingerprintText(changedProvider)).not.toBe(fingerprintText(sourceIt));
    const cv = atlasRewituCv(sourceIt, 'it');

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: changedProvider,
      cv,
      requestedLocale: 'pt-BR',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    assertFirstPersonPtBr(fin.text);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason).toBeTruthy();
    expect(fin.diagnostics?.providerTypedRejectionReason).not.toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.providerRejectionReason).toBe(
      fin.diagnostics?.providerTypedRejectionReason,
      );
    }
    if (summaryV2ModeActive()) {
      expect(
        (fin.diagnostics?.providerSlotRejectionReasons || []).length
        || fin.diagnostics?.providerRejectionReason
        || fin.diagnostics?.providerTypedRejectionReason,
      ).toBeTruthy();
    } else {
      expect((fin.diagnostics?.providerSlotRejectionReasons || []).length).toBeGreaterThan(0);
    }
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
  });

  it('rejects Italian/French/Spanish/English deterministic surface for pt-BR', () => {
    for (const foreign of [
      'Dispongo complessivamente di circa sei anni e mezzo di esperienza professionale. Attualmente lavoro presso Atlas.',
      'Je dispose d’environ six ans et demi d’expérience professionnelle. Je travaille actuellement chez Atlas.',
      'Dispongo de aproximadamente seis años y medio de experiencia profesional. Actualmente trabajo en Atlas.',
      'I have approximately six and a half years of professional experience. I currently work at Atlas.',
    ]) {
      const q = analyzePortugueseBrazilSummaryEmploymentQuality(foreign, {
        company: 'Atlas',
        role: 'funcionária de armazém',
        currentEntryDuties: WH_EN,
        gender: 'female',
      });
      expect(q.groundingValidationPassed, foreign.slice(0, 40)).toBe(false);
    }
  });

  it('rejects European Portuguese-only ecrãs surface', () => {
    const text = [
      'Tenho, no total, cerca de seis anos e meio de experiência profissional.',
      'Atualmente trabalho na Atlas como funcionária de armazém, onde verifico as mercadorias recebidas, confiro a documentação relacionada a elas e me coordeno com os colegas para a preparação e a movimentação das mercadorias.',
      'Anteriormente, trabalhei na Rewitu como designer gráfica, onde criei materiais visuais e elementos gráficos, revisei e adaptei materiais de design e preparei os arquivos finais de design para diferentes formatos e ecrãs.',
    ].join(' ');
    const q = analyzePortugueseBrazilSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      priorCompany: 'Rewitu',
      priorRole: 'designer gráfica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.slotRejectionReasons).toContain('ptbr_summary_european_portuguese_surface');
  });

  it('rejects neutral_cv perspective', () => {
    const text = [
      'Profissional com cerca de seis anos e meio de experiência.',
      'Atuação em armazém na Atlas.',
      'Experiência anterior em design na Rewitu.',
    ].join(' ');
    expect(detectPortugueseBrazilSummaryPerspective(text)).not.toBe('first_person');
    const q = analyzePortugueseBrazilSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      currentEntryDuties: WH_EN,
      gender: 'female',
    });
    expect(q.perspectiveValidationPassed).toBe(false);
  });

  it('rejects missing current or prior fact with entry-owned identity', () => {
    const missingCurrent = [
      'Tenho, no total, cerca de seis anos e meio de experiência profissional.',
      'Atualmente trabalho na Atlas como funcionária de armazém, onde verifico as mercadorias recebidas e me coordeno com os colegas para a preparação e a movimentação das mercadorias.',
      'Anteriormente, trabalhei na Rewitu como designer gráfica, onde criei materiais visuais e elementos gráficos, revisei e adaptei materiais de design e preparei os arquivos finais de design para diferentes formatos e telas.',
    ].join(' ');
    const qCurrent = analyzePortugueseBrazilSummaryEmploymentQuality(missingCurrent, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      priorCompany: 'Rewitu',
      priorRole: 'designer gráfica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(qCurrent.finalCurrentDutyCoveragePassed).toBe(false);
    expect(qCurrent.slotRejectionReasons).toContain('current_duty_fact_coverage_incomplete');

    const missingPrior = [
      'Tenho, no total, cerca de seis anos e meio de experiência profissional.',
      'Atualmente trabalho na Atlas como funcionária de armazém, onde verifico as mercadorias recebidas, confiro a documentação relacionada a elas e me coordeno com os colegas para a preparação e a movimentação das mercadorias.',
      'Anteriormente, trabalhei na Rewitu como designer gráfica, onde criei materiais visuais e elementos gráficos e revisei materiais de design.',
    ].join(' ');
    const qPrior = analyzePortugueseBrazilSummaryEmploymentQuality(missingPrior, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      priorCompany: 'Rewitu',
      priorRole: 'designer gráfica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(qPrior.finalPriorDutyCoveragePassed).toBe(false);
    expect(qPrior.slotRejectionReasons).toContain('prior_duty_fact_coverage_incomplete');
  });

  it('rejects unsupported claim', () => {
    const text = [
      'Tenho, no total, cerca de seis anos e meio de experiência profissional.',
      'Atualmente trabalho na Atlas como funcionária de armazém, onde verifico as mercadorias recebidas, confiro a documentação relacionada a elas e me coordeno com os colegas para a preparação e a movimentação das mercadorias.',
      'Anteriormente, trabalhei na Rewitu como designer gráfica, onde criei materiais visuais e elementos gráficos, revisei e adaptei materiais de design e preparei os arquivos finais de design para diferentes formatos e telas, com liderança Agile e KPIs de marketing.',
    ].join(' ');
    const q = analyzePortugueseBrazilSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      priorCompany: 'Rewitu',
      priorRole: 'designer gráfica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.slotRejectionReasons).toContain('unsupported_claim');
  });

  it('three-unit splitter assigns semantic role slots', () => {
    const text = buildPortugueseBrazilEntryOwnedSummary({
      role: 'Warehouse Associate',
      employer: 'Atlas',
      gender: 'female',
      durationPhrase: 'seis anos e meio',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      locale: 'pt-BR',
    });
    const units = splitPortugueseBrazilSummaryUnits(text);
    expect(units.length).toBe(3);
    const q = analyzePortugueseBrazilSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      priorCompany: 'Rewitu',
      priorRole: 'designer gráfica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.finalUnitRoleSlots).toEqual(['duration', 'current_intro', 'prior_role']);
    expect(q.finalSentenceRoleSlots).toEqual(['duration', 'current_intro', 'prior_role']);
    expect(q.finalUnitRoleSlots).not.toContain('summary_unit');
  });

  it('rejects two-unit topology when three semantic slots are required', () => {
    const twoUnit = [
      'Tenho, no total, cerca de seis anos e meio de experiência profissional.',
      'Atualmente trabalho na Atlas como funcionária de armazém, onde verifico as mercadorias recebidas, confiro a documentação relacionada a elas e me coordeno com os colegas para a preparação e a movimentação das mercadorias e anteriormente trabalhei na Rewitu.',
    ].join(' ');
    const q = analyzePortugueseBrazilSummaryEmploymentQuality(twoUnit, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      priorCompany: 'Rewitu',
      priorRole: 'designer gráfica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.unitCount).toBeLessThan(3);
    expect(q.slotRejectionReasons.some((r) => /unit_count|missing_prior/i.test(r))).toBe(true);
  });

  it('accepts arbitrary free-text role with grounded Brazilian Portuguese duties', () => {
    const text = buildPortugueseBrazilEntryOwnedSummary({
      role: 'Coordenadora de estoque regional',
      employer: 'NovaLog',
      gender: 'female',
      durationPhrase: 'cinco anos',
      dutyFacts: [
        { value: 'organizava inventários semanais', sourceText: 'organizava inventários semanais' },
        { value: 'atualizava registros de entrada', sourceText: 'atualizava registros de entrada' },
        { value: 'apoiava a equipe de expedição', sourceText: 'apoiava a equipe de expedição' },
      ],
      locale: 'pt-BR',
      hasCurrentRole: true,
    });
    expect(detectPortugueseBrazilSummaryPerspective(text)).toBe('first_person');
    expect(text).toMatch(/NovaLog/);
    expect(text).toMatch(/coordenadora de estoque regional/i);
  });

  it('five-plus-entry CV preserves entry ownership and bounded output', () => {
    const many: CVData = {
      ...atlasRewituCv(''),
      experience: [
        ...(atlasRewituCv('').experience || []),
        {
          id: 'e3',
          position: 'Clerk',
          company: 'Gamma',
          startDate: '2018-01',
          endDate: '2019-12',
          isPresent: false,
          description: 'filed documents',
          canonicalDescription: 'filed documents',
          descriptionOrigin: 'user',
          generatedLocale: 'en',
        },
        {
          id: 'e4',
          position: 'Assistant',
          company: 'Delta',
          startDate: '2016-01',
          endDate: '2017-12',
          isPresent: false,
          description: 'answered phones',
          canonicalDescription: 'answered phones',
          descriptionOrigin: 'user',
          generatedLocale: 'en',
        },
        {
          id: 'e5',
          position: 'Intern',
          company: 'Epsilon',
          startDate: '2015-01',
          endDate: '2015-12',
          isPresent: false,
          description: 'supported team',
          canonicalDescription: 'supported team',
          descriptionOrigin: 'user',
          generatedLocale: 'en',
        },
      ],
    } as CVData;
    const factSet = buildCvCanonicalFactSet(many, { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(many.experience || [], REF);
    const text = buildConciseGroundedSummary(factSet, 'pt-BR', 'female', duration.total);
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/Rewitu/);
    expect(text.split(/(?<=[.!?])\s+/u).length).toBeLessThanOrEqual(4);
    expect(text).not.toMatch(/Gamma|Delta|Epsilon/);
  });

  it('failed preapply preserves Italian content locale and usage', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceIt = buildConciseGroundedSummary(factSet, 'it', 'female', durationSnapshot.total);
    const cv = atlasRewituCv(sourceIt, 'it');
    seedUsage(30);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourceIt,
      cv,
      requestedLocale: 'pt-BR',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.contentLocaleAfterApply).toBe('it');
    }
    if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.finalContentLocaleAfterApply).toBeNull();
    }
    expect(cv.summary).toBe(sourceIt);
    expect(cv.contentLocale).toBe('it');
    expect(getProAiUsageCount()).toBe(30);
  });

  it('rejected path preserves Summary and usage', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceIt = buildConciseGroundedSummary(factSet, 'it', 'female', durationSnapshot.total);
    const cv = atlasRewituCv(sourceIt, 'it');
    seedUsage(30);
    expect(getProAiUsageCount()).toBe(30);
    expect(cv.summary).toBe(sourceIt);
    expect(cv.contentLocale).toBe('it');
  });
});

describe('AAB-362 pt-BR duration grammar', () => {
  it('formatter emits seis anos e meio for 78 months — never seis e meio anos', () => {
    const dur = applyApproximateDurationPolicy(78);
    expect(dur.approxYears).toBe(6.5);
    expect(formatPortugueseBrazilDurationCore(dur)).toBe('seis anos e meio');
    const phrase = formatApproximateDurationPhrase(dur, 'pt-BR');
    expect(phrase).toMatch(/seis\s+anos\s+e\s+meio/i);
    expect(phrase).not.toMatch(/seis\s+e\s+meio\s+anos/i);
  });

  it('universal month→pt-BR duration matrix', () => {
    const cases: Array<[number, string]> = [
      [6, 'seis meses'],
      [12, 'um ano'],
      [18, 'um ano e meio'],
      [24, 'dois anos'],
      [30, 'dois anos e meio'],
      [78, 'seis anos e meio'],
    ];
    for (const [months, core] of cases) {
      const dur = applyApproximateDurationPolicy(months);
      expect(formatPortugueseBrazilDurationCore(dur), String(months)).toBe(core);
      const phrase = formatApproximateDurationPhrase(dur, 'pt-BR');
      expect(phrase, String(months)).toMatch(new RegExp(core.replace(/\s+/g, '\\s+'), 'i'));
      expect(phrase, String(months)).not.toMatch(/\be\s+meio\s+anos?\b/i);
    }
  });

  it('rejects malformed ordering; accepts natural half-year forms', () => {
    expect(hasIncorrectPortugueseBrazilDurationGrammar('seis e meio anos')).toBe(true);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('um e meio anos')).toBe(true);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('dois e meio ano')).toBe(true);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('seis anos meio')).toBe(true);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('cerca seis anos e meio')).toBe(true);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('6,5 anos')).toBe(true);

    expect(hasIncorrectPortugueseBrazilDurationGrammar('seis anos e meio')).toBe(false);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('um ano e meio')).toBe(false);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('dois anos e meio')).toBe(false);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('cerca de seis anos e meio')).toBe(false);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('aproximadamente seis anos e meio')).toBe(false);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('seis anos')).toBe(false);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('um ano')).toBe(false);
    expect(hasIncorrectPortugueseBrazilDurationGrammar('alguns meses')).toBe(false);

    const bad = analyzePortugueseBrazilDurationGrammar(
      'Tenho, ao todo, cerca de seis e meio anos de experiência profissional.',
      applyApproximateDurationPolicy(78),
    );
    expect(bad.grammarValidationPassed).toBe(false);
    expect(bad.grammarRejectionReason).toBe(PTBR_SUMMARY_DURATION_GRAMMAR_INVALID);
    expect(bad.durationValidatorRevision).toBe(PTBR_SUMMARY_DURATION_GRAMMAR_REVISION);

    const good = analyzePortugueseBrazilDurationGrammar(
      'Tenho, ao todo, cerca de seis anos e meio de experiência profissional.',
      applyApproximateDurationPolicy(78),
    );
    expect(good.grammarValidationPassed).toBe(true);
  });

  it('correct grammar but wrong semantic duration is rejected', () => {
    const g = analyzePortugueseBrazilDurationGrammar(
      'Tenho, ao todo, cerca de dois anos e meio de experiência profissional.',
      applyApproximateDurationPolicy(78),
    );
    expect(g.grammarValidationPassed).toBe(false);
    expect(g.grammarRejectionReason).toBe(PTBR_SUMMARY_DURATION_GRAMMAR_INVALID);
  });

  it('duplicate duration claims are rejected', () => {
    const dup = [
      'Tenho, ao todo, cerca de seis anos e meio de experiência profissional.',
      'Tenho, no total, cerca de seis anos e meio de experiência profissional.',
    ].join(' ');
    expect(hasIncorrectPortugueseBrazilDurationGrammar(dup)).toBe(true);
  });

  it('malformed duration fails employment quality + finalize block', () => {
    const malformed = [
      'Tenho, ao todo, cerca de seis e meio anos de experiência profissional.',
      'Atualmente trabalho na Atlas como funcionária de armazém, onde verifico as mercadorias recebidas, confiro a documentação relacionada a elas e me coordeno com os colegas para a preparação e a movimentação das mercadorias.',
      'Anteriormente, trabalhei na Rewitu como designer gráfica, onde criei materiais visuais e elementos gráficos, revisei e adaptei materiais de design e preparei os arquivos finais de design para diferentes formatos e telas.',
    ].join(' ');
    const q = analyzePortugueseBrazilSummaryEmploymentQuality(malformed, {
      company: 'Atlas',
      role: 'funcionária de armazém',
      priorCompany: 'Rewitu',
      priorRole: 'designer gráfica',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
      expectedDuration: applyApproximateDurationPolicy(78),
    });
    expect(q.grammarValidationPassed).toBe(false);
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.slotRejectionReasons).toContain(PTBR_SUMMARY_DURATION_GRAMMAR_INVALID);

    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const cv = atlasRewituCv(malformed, 'pt-BR');
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: malformed,
      cv,
      requestedLocale: 'pt-BR',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_generated',
    });
    // Deterministic rebuild may repair; if accepted, surface must not keep malformed ordering.
    if (!fin.blocked) {
      expect(fin.text).toMatch(/\bseis\s+anos\s+e\s+meio\b/iu);
      expect(fin.text).not.toMatch(/\bseis\s+e\s+meio\s+anos\b/iu);
      expect(fin.diagnostics?.grammarValidationPassed).toBe(true);
    } else {
      expect(
        fin.diagnostics?.grammarValidationPassed === false
        || /ptbr_summary_duration_grammar_invalid/i.test(String(fin.reason || '')),
      ).toBe(true);
    }
  });
});
