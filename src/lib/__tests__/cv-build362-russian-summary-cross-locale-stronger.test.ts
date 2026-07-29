/**
 * AAB-362 — Portuguese-Brazil → Russian Professional Summary Stronger.
 * Entry-owned Russian deterministic fallback; provider rejection totality;
 * three-unit topology; locale transaction pt-BR → ru.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  analyzeRussianSummaryEmploymentQuality,
  analyzeRussianDurationGrammar,
  buildRussianEntryOwnedSummary,
  detectRussianSummaryPerspective,
  hasIncorrectRussianDurationGrammar,
  splitRussianSummaryUnits,
  SUMMARY_BUILDER_REVISION_RU,
  RUSSIAN_SUMMARY_DURATION_GRAMMAR_INVALID,
  RUSSIAN_SUMMARY_DURATION_GRAMMAR_REVISION,
} from '@/lib/cv-russian-summary-grounding';
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
  formatRussianDurationCore,
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
import { SUMMARY_BUILDER_REVISION_JA } from '@/lib/cv-japanese-summary-grounding';
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

function atlasRewituCv(summary: string, contentLocale: string = 'pt-BR'): CVData {
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

function assertFirstPersonRu(text: string): void {
  expect(detectRussianSummaryPerspective(text)).toBe('first_person');
  expect(text).toMatch(/у\s+меня/iu);
  expect(text).toMatch(/сейчас\s+я\s+работаю/iu);
  expect(text).toMatch(/ранее\s+я\s+работала/iu);
  expect(text).toMatch(/сотрудниц(?:ей|а)\s+склад/iu);
  expect(text).toMatch(/графическим\s+дизайнером/iu);
  expect(text).toMatch(/шести\s+с\s+половиной\s+лет/iu);
  expect(text).not.toMatch(/шести\s+лет\s+с\s+половиной/iu);
  expect(text).not.toMatch(/\b(?:tenho|atualmente|dispongo|attualmente)\b/iu);
  expect(hasIncorrectRussianDurationGrammar(text)).toBe(false);
}

describe('AAB-362 pt-BR→Russian Summary Stronger', () => {
  beforeEach(() => {
    seedUsage(31);
  });

  it('routes requestedLocale=ru to Russian builder', () => {
    expect(SUMMARY_BUILDER_REVISION_RU).toBe('entry-owned-russian-rebuild-362-v1');
    expect(resolveSummaryBuilderRevision('ru')).toBe(SUMMARY_BUILDER_REVISION_RU);
    expect(resolveSummaryTargetScript('ru')).toBe('cyrillic');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'ru',
      'entry-owned-ptbr-rebuild-361-v1',
    )).toBe('russian_request_routed_to_ptbr_builder');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'ru',
      'entry-owned-italian-rebuild-359-v1',
    )).toBe('russian_request_routed_to_italian_builder');
  });

  it('Japanese remains on its own builder and stays purity-fail-closed for Latin Romance', () => {
    expect(resolveSummaryBuilderRevision('ja')).toBe(SUMMARY_BUILDER_REVISION_JA);
    expect(resolveSummaryBuilderRevision('ja')).not.toBe(
      SUMMARY_LOCALE_UNSUPPORTED_FAILCLOSED_358_REVISION,
    );
    const ptbr = [
      'Tenho, ao todo, cerca de seis anos e meio de experiência profissional.',
      'Atualmente trabalho na Atlas como funcionária de armazém.',
    ].join(' ');
    const purity = validateAiUnitLocalePurity(ptbr, 'ja', {
      kind: 'summary_sentence',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed || purity.ok).toBe(false);
  });

  it('source pt-BR Summary is the validated 512-character form', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const pt = buildConciseGroundedSummary(factSet, 'pt-BR', 'female', duration.total);
    expect(pt.length).toBe(512);
    expect(fingerprintText(pt)).toBe('fnv1a_ef460c5b_l512_b84_e46');
  });

  it('builder emits first-person Russian from structured Experience', () => {
    const text = buildRussianEntryOwnedSummary({
      role: "Employée d'entrepôt",
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'шести с половиной лет',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      locale: 'ru',
    });
    assertFirstPersonRu(text);
  });

  it('exact AAB 362 path: pt-BR provider echo → Russian deterministic apply + usage 31→32', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    expect(durationSnapshot.total.totalMonths).toBe(78);
    const sourcePt = buildConciseGroundedSummary(factSet, 'pt-BR', 'female', durationSnapshot.total);
    expect(sourcePt.length).toBe(512);
    expect(fingerprintText(sourcePt)).toBe('fnv1a_ef460c5b_l512_b84_e46');
    const cv = atlasRewituCv(sourcePt, 'pt-BR');
    expect(detectTextLocale(sourcePt, { storedLocale: 'pt-BR' })).toBe('pt-BR');
    expect(getProAiUsageCount()).toBe(31);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourcePt,
      cv,
      requestedLocale: 'ru',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    assertFirstPersonRu(fin.text);
    expect(fin.text).toMatch(/у\s+меня\s+около\s+шести\s+с\s+половиной\s+лет/iu);
    expect(fin.diagnostics?.grammarValidationPassed).toBe(true);
    expect(fin.diagnostics?.durationValidationPassed).toBe(true);
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
    expect(fin.diagnostics?.detectedLocaleByUnit).toEqual(['ru', 'ru', 'ru']);
    expect(fin.diagnostics?.detectedScriptByUnit).toEqual(['cyrillic', 'cyrillic', 'cyrillic']);
    expect(fin.diagnostics?.wrongLocaleUnitCount).toBe(0);
    expect(fin.diagnostics?.unexpectedLocaleCodes || []).toEqual([]);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.detectedVisibleContentLocaleBeforeRequest).toBe('pt-BR');
    expect(fin.diagnostics?.contentLocaleAfterApply).toBe('pt-BR');
    expect(fin.diagnostics?.finalContentLocaleAfterApply).toBeNull();
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason
      || fin.diagnostics?.providerRejectionReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.diagnostics?.clientFallbackReason).toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_RU);

    const q = analyzeRussianSummaryEmploymentQuality(fin.text, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      priorCompany: 'Rewitu',
      priorRole: 'графическим дизайнером',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
      expectedDuration: durationSnapshot.total,
    });
    expect(q.groundingValidationPassed).toBe(true);
    expect(q.unitCount).toBe(3);
    expect(q.finalUnitRoleSlots).toEqual(['duration', 'current_intro', 'prior_role']);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'ru',
      requestedLocale: 'ru',
      contentLocale: 'pt-BR',
      gender: 'female',
      usageCountBefore: 31,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, sourcePt);
    session.recordFinalizeResult(fin);
    expect(session.draft.detectedVisibleContentLocaleBeforeRequest).toBe('pt-BR');
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed, JSON.stringify(session.draft.diagnosticInvariantFailures, null, 2)).toBe(true);
    const next = applyFinalizedSummaryToCv(cv, 'ru', fin);
    expect(next.summary).toBe(fin.text);
    expect(next.contentLocale).toBe('ru');
    session.recordVisibleApply(true, 32, fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(32);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.contentLocaleAfterApply).toBe('ru');
    expect(trace.finalContentLocaleAfterApply).toBe('ru');
    expect(trace.contentLocaleUpdatedAfterApply).toBe(true);
    const inv = checkSummaryDiagnosticInvariants(
      trace as Parameters<typeof checkSummaryDiagnosticInvariants>[0],
    );
    expect(inv.passed, JSON.stringify(inv.failures, null, 2)).toBe(true);
  });

  it('changed-invalid provider gets typed grounding rejection (not noop)', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourcePt = buildConciseGroundedSummary(factSet, 'pt-BR', 'female', durationSnapshot.total);
    const changedProvider = [
      'У меня релевантный профессиональный опыт в логистике.',
      'Сейчас я работаю в компании Atlas сотрудницей склада с операционными обязанностями.',
    ].join(' ');
    expect(fingerprintText(changedProvider)).not.toBe(fingerprintText(sourcePt));
    const cv = atlasRewituCv(sourcePt, 'pt-BR');

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: changedProvider,
      cv,
      requestedLocale: 'ru',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });

    expect(fin.blocked).toBe(false);
    assertFirstPersonRu(fin.text);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason).toBeTruthy();
    expect(fin.diagnostics?.providerTypedRejectionReason).not.toBe(PROVIDER_CROSS_LOCALE_NOOP_REASON);
    expect(fin.diagnostics?.providerRejectionReason).toBe(
      fin.diagnostics?.providerTypedRejectionReason,
    );
    expect((fin.diagnostics?.providerSlotRejectionReasons || []).length).toBeGreaterThan(0);
    expect(fin.diagnostics?.finalUnitRoleSlots).toEqual([
      'duration',
      'current_intro',
      'prior_role',
    ]);
  });

  it('rejects pt-BR/Italian/English/German/Serbian-Latin deterministic surface for Russian', () => {
    for (const foreign of [
      'Tenho, ao todo, cerca de seis anos e meio de experiência profissional. Atualmente trabalho na Atlas.',
      'Dispongo complessivamente di circa sei anni e mezzo di esperienza professionale. Attualmente lavoro presso Atlas.',
      'I have approximately six and a half years of professional experience. I currently work at Atlas.',
      'Ich verfüge über insgesamt etwa sechseinhalb Jahre Erfahrung. Derzeit arbeite ich bei Atlas.',
      'Imam oko šest i po godina iskustva. Trenutno radim u Atlasu.',
    ]) {
      const q = analyzeRussianSummaryEmploymentQuality(foreign, {
        company: 'Atlas',
        role: 'сотрудницей склада',
        currentEntryDuties: WH_EN,
        gender: 'female',
      });
      expect(q.groundingValidationPassed, foreign.slice(0, 40)).toBe(false);
    }
  });

  it('rejects Serbian Cyrillic falsely classified as Russian', () => {
    const sr = 'Прегледа пристиглу робу и ажурира евиденцију у заједничком одељењу.';
    const purity = validateAiUnitLocalePurity(sr, 'ru', {
      kind: 'summary_sentence',
      requireUnits: true,
    });
    expect(purity.targetLocalePurityPassed).toBe(false);
    const q = analyzeRussianSummaryEmploymentQuality(sr, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      currentEntryDuties: WH_EN,
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('rejects masculine past-tense forms with selected female', () => {
    const text = [
      'У меня около шести с половиной лет общего профессионального опыта.',
      'Сейчас я работаю в компании Atlas сотрудником склада: проверяю поступающие товары и связанную с ними документацию, а также координирую с коллегами подготовку и перемещение товаров.',
      'Ранее я работал в компании Rewitu графическим дизайнером: создавал визуальные материалы и графические элементы, проверял и адаптировал дизайн-материалы и подготавливал финальные дизайн-файлы для различных форматов и экранов.',
    ].join(' ');
    const q = analyzeRussianSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      priorCompany: 'Rewitu',
      priorRole: 'графическим дизайнером',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.genderValidationPassed).toBe(false);
    expect(q.slotRejectionReasons).toContain('russian_summary_gender_mismatch');
  });

  it('rejects neutral_cv / third person', () => {
    const text = [
      'Кладовщица с общим опытом около шести с половиной лет, работающая в Atlas.',
      'Имеет опыт проверки поступающих товаров и связанной с ними документации.',
      'Ранее работала в Rewitu графическим дизайнером.',
    ].join(' ');
    expect(detectRussianSummaryPerspective(text)).not.toBe('first_person');
    const q = analyzeRussianSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      currentEntryDuties: WH_EN,
      gender: 'female',
    });
    expect(q.perspectiveValidationPassed).toBe(false);
  });

  it('rejects missing current or prior fact with entry-owned identity', () => {
    const missingCurrent = [
      'У меня около шести с половиной лет общего профессионального опыта.',
      'Сейчас я работаю в компании Atlas сотрудницей склада: проверяю поступающие товары и координирую с коллегами подготовку и перемещение товаров.',
      'Ранее я работала в компании Rewitu графическим дизайнером: создавала визуальные материалы и графические элементы, проверяла и адаптировала дизайн-материалы и подготавливала финальные дизайн-файлы для различных форматов и экранов.',
    ].join(' ');
    const qCurrent = analyzeRussianSummaryEmploymentQuality(missingCurrent, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      priorCompany: 'Rewitu',
      priorRole: 'графическим дизайнером',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(qCurrent.finalCurrentDutyCoveragePassed).toBe(false);
    expect(qCurrent.slotRejectionReasons).toContain('current_duty_fact_coverage_incomplete');

    const missingPrior = [
      'У меня около шести с половиной лет общего профессионального опыта.',
      'Сейчас я работаю в компании Atlas сотрудницей склада: проверяю поступающие товары и связанную с ними документацию, а также координирую с коллегами подготовку и перемещение товаров.',
      'Ранее я работала в компании Rewitu графическим дизайнером: создавала визуальные материалы и графические элементы и проверяла материалы.',
    ].join(' ');
    const qPrior = analyzeRussianSummaryEmploymentQuality(missingPrior, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      priorCompany: 'Rewitu',
      priorRole: 'графическим дизайнером',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(qPrior.finalPriorDutyCoveragePassed).toBe(false);
    expect(qPrior.slotRejectionReasons).toContain('prior_duty_fact_coverage_incomplete');
  });

  it('rejects unsupported claim and foreign role-title leakage', () => {
    const unsupported = [
      'У меня около шести с половиной лет общего профессионального опыта.',
      'Сейчас я работаю в компании Atlas сотрудницей склада: проверяю поступающие товары и связанную с ними документацию, а также координирую с коллегами подготовку и перемещение товаров.',
      'Ранее я работала в компании Rewitu графическим дизайнером: создавала визуальные материалы и графические элементы, проверяла и адаптировала дизайн-материалы и подготавливала финальные дизайн-файлы для различных форматов и экранов, с лидерством Agile и KPI маркетинга.',
    ].join(' ');
    const q = analyzeRussianSummaryEmploymentQuality(unsupported, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      priorCompany: 'Rewitu',
      priorRole: 'графическим дизайнером',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(q.groundingValidationPassed).toBe(false);
    expect(q.slotRejectionReasons).toContain('unsupported_claim');

    const leak = [
      'У меня около шести с половиной лет общего профессионального опыта.',
      "Сейчас я работаю в компании Atlas как Employée d'entrepôt: проверяю поступающие товары и связанную с ними документацию, а также координирую с коллегами подготовку и перемещение товаров.",
      'Ранее я работала в компании Rewitu графическим дизайнером: создавала визуальные материалы и графические элементы, проверяла и адаптировала дизайн-материалы и подготавливала финальные дизайн-файлы для различных форматов и экранов.',
    ].join(' ');
    const qLeak = analyzeRussianSummaryEmploymentQuality(leak, {
      company: 'Atlas',
      role: 'сотрудницей склада',
      priorCompany: 'Rewitu',
      priorRole: 'графическим дизайнером',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
    });
    expect(qLeak.groundingValidationPassed).toBe(false);
    expect(qLeak.slotRejectionReasons).toContain('russian_summary_foreign_role_title_leakage');
  });

  it('accepts arbitrary free-text occupation with grounded Russian duties', () => {
    const text = buildRussianEntryOwnedSummary({
      role: 'Координатор регионального склада',
      employer: 'NovaLog',
      gender: 'female',
      durationPhrase: 'пяти лет',
      dutyFacts: [
        { value: 'организую еженедельные инвентаризации', sourceText: 'организую еженедельные инвентаризации' },
        { value: 'обновляю записи о поступлении', sourceText: 'обновляю записи о поступлении' },
        { value: 'поддерживаю команду отгрузки', sourceText: 'поддерживаю команду отгрузки' },
      ],
      locale: 'ru',
      hasCurrentRole: true,
    });
    expect(detectRussianSummaryPerspective(text)).toBe('first_person');
    expect(text).toMatch(/NovaLog/);
    expect(text).toMatch(/координатор регионального склада/i);
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
    const text = buildConciseGroundedSummary(factSet, 'ru', 'female', duration.total);
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/Rewitu/);
    expect(splitRussianSummaryUnits(text).length).toBeLessThanOrEqual(4);
    expect(text).not.toMatch(/Gamma|Delta|Epsilon/);
  });

  it('failed preapply preserves pt-BR content locale and usage', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourcePt = buildConciseGroundedSummary(factSet, 'pt-BR', 'female', durationSnapshot.total);
    const cv = atlasRewituCv(sourcePt, 'pt-BR');
    seedUsage(31);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourcePt,
      cv,
      requestedLocale: 'ru',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });
    expect(fin.diagnostics?.contentLocaleAfterApply).toBe('pt-BR');
    expect(fin.diagnostics?.finalContentLocaleAfterApply).toBeNull();
    expect(cv.summary).toBe(sourcePt);
    expect(cv.contentLocale).toBe('pt-BR');
    expect(getProAiUsageCount()).toBe(31);
  });
});

describe('AAB-362 Russian duration grammar', () => {
  it('formatter emits шести с половиной лет for 78 months', () => {
    const dur = applyApproximateDurationPolicy(78);
    expect(dur.approxYears).toBe(6.5);
    expect(formatRussianDurationCore(dur)).toBe('шести с половиной лет');
    const phrase = formatApproximateDurationPhrase(dur, 'ru');
    expect(phrase).toMatch(/шести\s+с\s+половиной\s+лет/i);
    expect(phrase).not.toMatch(/шести\s+лет\s+с\s+половиной/i);
  });

  it('universal month→Russian duration matrix', () => {
    const cases: Array<[number, string]> = [
      [6, 'шести месяцев'],
      [12, 'одного года'],
      [18, 'полутора лет'],
      [24, 'двух лет'],
      [30, 'двух с половиной лет'],
      [78, 'шести с половиной лет'],
    ];
    for (const [months, core] of cases) {
      const dur = applyApproximateDurationPolicy(months);
      expect(formatRussianDurationCore(dur), String(months)).toBe(core);
      const phrase = formatApproximateDurationPhrase(dur, 'ru');
      expect(phrase, String(months)).toMatch(new RegExp(core.replace(/\s+/g, '\\s+'), 'i'));
    }
  });

  it('rejects malformed ordering; accepts natural genitive forms', () => {
    expect(hasIncorrectRussianDurationGrammar('около шесть с половиной лет')).toBe(true);
    expect(hasIncorrectRussianDurationGrammar('шести лет с половиной')).toBe(true);
    expect(hasIncorrectRussianDurationGrammar('6.5 лет')).toBe(true);
    expect(hasIncorrectRussianDurationGrammar('шести половиной лет')).toBe(true);

    expect(hasIncorrectRussianDurationGrammar('шести с половиной лет')).toBe(false);
    expect(hasIncorrectRussianDurationGrammar('около шести с половиной лет')).toBe(false);
    expect(hasIncorrectRussianDurationGrammar('примерно шести с половиной лет')).toBe(false);
    expect(hasIncorrectRussianDurationGrammar('одного года')).toBe(false);
    expect(hasIncorrectRussianDurationGrammar('двух лет')).toBe(false);

    const bad = analyzeRussianDurationGrammar(
      'У меня около шесть с половиной лет общего профессионального опыта.',
      applyApproximateDurationPolicy(78),
    );
    expect(bad.grammarValidationPassed).toBe(false);
    expect(bad.grammarRejectionReason).toBe(RUSSIAN_SUMMARY_DURATION_GRAMMAR_INVALID);
    expect(bad.durationValidatorRevision).toBe(RUSSIAN_SUMMARY_DURATION_GRAMMAR_REVISION);

    const good = analyzeRussianDurationGrammar(
      'У меня около шести с половиной лет общего профессионального опыта.',
      applyApproximateDurationPolicy(78),
    );
    expect(good.grammarValidationPassed).toBe(true);
  });

  it('correct grammar but wrong semantic duration is rejected', () => {
    const g = analyzeRussianDurationGrammar(
      'У меня около двух с половиной лет общего профессионального опыта.',
      applyApproximateDurationPolicy(78),
    );
    expect(g.grammarValidationPassed).toBe(false);
    expect(g.grammarRejectionReason).toBe(RUSSIAN_SUMMARY_DURATION_GRAMMAR_INVALID);
  });

  it('duplicate duration claims are rejected', () => {
    const dup = [
      'У меня около шести с половиной лет общего профессионального опыта.',
      'У меня около шести с половиной лет общего профессионального опыта.',
    ].join(' ');
    expect(hasIncorrectRussianDurationGrammar(dup)).toBe(true);
  });
});
