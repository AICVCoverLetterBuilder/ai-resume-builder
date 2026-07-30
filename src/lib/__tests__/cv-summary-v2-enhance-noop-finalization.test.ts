/**
 * Summary V2 enhance clean no-op finalization (AAB-374 follow-up).
 * Production-like path through finalize → diagnostic session → visible apply.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  evaluateSummaryMeaningfulChange,
  SUMMARY_NOOP_REJECTION_REASON,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import {
  setSummaryV2EnabledForTests,
  SUMMARY_V2_REVISION,
} from '@/lib/cv-summary-v2';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import {
  aiErrorMessage,
  mapExperienceAiFailureToErrorCode,
} from '@/lib/ai-error-codes';
import type { Locale } from '@/lib/i18n/translations';

const REF = '2026-07-01';

const SOLAR = [
  'installs solar panels',
  'positions and secures panels',
  'coordinates installation activities',
].join('\n');

const LIB = [
  'records borrowed and returned books',
  'arranges books by catalogue and shelf location',
  'helps visitors locate requested titles',
].join('\n');

const EXPECTED_EN =
  'I have approximately five and a half years of experience. '
  + 'I currently work as a Solar Panel Installer at SunGrid, where I install solar panels, '
  + 'position and secure panels, and coordinate installation activities. '
  + 'Previously, I worked as a Library Assistant at City Library, where I recorded borrowed and returned books, '
  + 'arranged books by catalogue and shelf location, and helped visitors locate requested titles.';

const BAD_PROVIDER =
  'I currently work as a Solar Panel Installer at SunGrid where I cook pasta '
  + 'and manage warehouses at Atlas Logistics. Previously I was a graphic designer '
  + 'with leadership and critical thinking skills.';

const WEAK_SUMMARY =
  'I work at SunGrid as a Solar Panel Installer.';

function solarLibraryCv(summary: string): CVData {
  return {
    id: 'summary-v2-enhance-noop',
    name: 'V2 NoOp Fixture',
    personal: {
      fullName: 'Alex Example',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: 'Solar Panel Installer',
      gender: 'female',
    },
    summary,
    experience: [
      {
        id: 'atlas',
        position: 'Solar Panel Installer',
        company: 'SunGrid',
        startDate: '2024-01',
        endDate: '',
        isPresent: true,
        description: SOLAR,
        canonicalDescription: SOLAR,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
      {
        id: 'rewitu',
        position: 'Library Assistant',
        company: 'City Library',
        startDate: '2021-01',
        endDate: '2023-12',
        isPresent: false,
        description: LIB,
        canonicalDescription: LIB,
        descriptionOrigin: 'user',
        generatedLocale: 'en',
      },
    ],
    education: [],
    skills: [],
    certifications: [],
    languages: [],
    templateId: 'modern',
    region: 'EU',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    contentLocale: 'en',
  };
}

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function runEnhance(opts: {
  summary: string;
  candidate: string;
  rewriteStyle?: 'stronger' | 'shorter' | 'professional';
  action?: 'summary_stronger' | 'summary_shorter' | 'summary_professional' | 'summary_generate';
  usageBefore?: number;
}) {
  const cv = solarLibraryCv(opts.summary);
  const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
  const style = opts.rewriteStyle || 'stronger';
  const action = opts.action
    || (style === 'shorter'
      ? 'summary_shorter'
      : style === 'professional'
        ? 'summary_professional'
        : 'summary_stronger');
  const usageBefore = opts.usageBefore ?? 10;
  seedUsage(usageBefore);
  const fin = finalizeCvAiFieldForApply({
    action,
    field: 'summary',
    requestedLocale: 'en',
    gender: 'female',
    cv,
    candidate: opts.candidate,
    referenceDateIso: REF,
    durationSnapshot: duration,
    rewriteStyle: style,
  });
  const session = new SummaryAiDiagnosticSession({
    uiLocale: 'en',
    requestedLocale: 'en',
    contentLocale: 'en',
    templateId: 'modern',
    gender: 'female',
    requestId: `v2-noop-${style}-${usageBefore}`,
    usageCountBefore: usageBefore,
    operationMode: 'enhance_existing_content',
  });
  session.recordFinalizeResult(fin);
  // Clean no-op must never enter the normal apply authorization gate.
  if (!(fin.blocked && fin.reason === SUMMARY_NOOP_REJECTION_REASON)) {
    const pre = session.evaluatePreApplyDecisionGates();
    if (pre.passed && fin.countedAsSuccess) {
      const applied = applyFinalizedSummaryToCv(cv, 'en', fin);
      session.recordVisibleApply(true, usageBefore, fin.text || '');
      recordProAiUserActionSuccess();
      session.patch({ usageCountAfter: usageBefore + 1 });
      return { fin, session, trace: session.commit(), cv: applied, usageBefore };
    }
    session.recordVisibleApply(false, usageBefore);
    return { fin, session, trace: session.commit(), cv, usageBefore };
  }
  session.recordVisibleApplyNotApplicable(usageBefore);
  return { fin, session, trace: session.commit(), cv, usageBefore };
}

function expectCleanNoOpTruth(trace: ReturnType<SummaryAiDiagnosticSession['commit']>, fin: ReturnType<typeof finalizeCvAiFieldForApply>) {
  expect(fin.blocked).toBe(true);
  expect(fin.countedAsSuccess).toBe(false);
  expect(fin.reason).toBe(SUMMARY_NOOP_REJECTION_REASON);
  expect((fin.text || '').replace(/\s+/g, ' ').trim()).toBe(EXPECTED_EN);

  expect(fin.diagnostics?.noOpDetected).toBe(true);
  expect(fin.diagnostics?.meaningfulChangeDetected).toBe(false);
  expect(fin.diagnostics?.finalMatchesSourceAfterNormalization).toBe(true);
  expect(fin.diagnostics?.rejectionStage == null).toBe(true);
  expect(fin.diagnostics?.typedFailureReason == null).toBe(true);
  expect(fin.diagnostics?.noOpCandidateKind).toBeTruthy();
  expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_V2_REVISION);

  expect(trace.noOpDetected).toBe(true);
  expect(trace.meaningfulChangeDetected).toBe(false);
  expect(trace.finalMatchesSourceAfterNormalization).toBe(true);
  expect(trace.visibleApplySucceeded).toBe(false);
  expect(trace.countedAsSuccess).toBe(false);
  expect(trace.rejectionStage).toBeNull();
  expect(trace.finalTypedFailureReason).toBeNull();
  expect(trace.usageCountBefore).toBe(10);
  expect(trace.usageCountAfter).toBe(10);
  expect(trace.diagnosticInvariantCheckPassed).toBe(true);
  expect(trace.noOpCandidateKind).toBe(fin.diagnostics?.noOpCandidateKind);

  const post = (trace.stages || []).find((s) => s.name === 'final_postconditions');
  expect(post?.status).toBe('ok');
  expect(post?.reason).toBe('summary_noop_after_normalization');
  const vis = (trace.stages || []).find((s) => s.name === 'visible_apply');
  expect(vis?.status).toBe('skipped');
  expect(vis?.reason).toBe('not_applicable');
  expect(
    (trace.stages || []).some((s) => s.status === 'fail'),
  ).toBe(false);

  const provider = (trace.candidateLineage || []).find((c) => c.candidateKind === 'provider');
  const finalSel = (trace.candidateLineage || []).find((c) => c.candidateKind === 'final_selected');
  expect(finalSel?.present).toBe(false);
  expect(finalSel?.accepted).toBe(false);
  expect(finalSel?.noOpDetected).toBe(true);
  expect(finalSel?.rejectionStage).toBeNull();
  // Top-level and lineage must not contradict on no-op truth.
  expect(trace.noOpDetected).toBe(true);
  if (provider?.noOpDetected) {
    expect(trace.noOpDetected).toBe(provider.noOpDetected);
  }
}

describe('Summary V2 enhance no-op finalization', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(10);
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('exact identical provider output is a clean no-op (stronger)', () => {
    const { fin, trace } = runEnhance({
      summary: EXPECTED_EN,
      candidate: EXPECTED_EN,
      rewriteStyle: 'stronger',
    });
    expectCleanNoOpTruth(trace, fin);
    expect(fin.diagnostics?.noOpCandidateKind).toBe('provider');
    expect(fin.diagnostics?.providerNoOpDetected).toBe(true);
    expect(getProAiUsageCount()).toBe(10);
  });

  it('formatting-only equivalent output is a clean no-op', () => {
    const formattingOnly = `  ${EXPECTED_EN.replace(/\./g, '.  ')} \n`;
    const cmp = evaluateSummaryMeaningfulChange(EXPECTED_EN, formattingOnly);
    expect(cmp.noOpDetected).toBe(true);
    expect(cmp.meaningfulChangeDetected).toBe(false);

    const { fin, trace } = runEnhance({
      summary: EXPECTED_EN,
      candidate: formattingOnly,
      rewriteStyle: 'stronger',
    });
    expectCleanNoOpTruth(trace, fin);
    expect(getProAiUsageCount()).toBe(10);
  });

  it('semantically equivalent paraphrase with no material improvement is a clean no-op', () => {
    const paraphrase = EXPECTED_EN.replace('I currently work', 'I presently work');
    const cmp = evaluateSummaryMeaningfulChange(EXPECTED_EN, paraphrase);
    expect(cmp.noOpDetected).toBe(true);
    expect(cmp.meaningfulChangeDetected).toBe(false);
    expect(cmp.finalMatchesSourceAfterNormalization).toBe(true);

    const { fin, trace } = runEnhance({
      summary: EXPECTED_EN,
      candidate: paraphrase,
      rewriteStyle: 'professional',
    });
    expectCleanNoOpTruth(trace, fin);
    expect(getProAiUsageCount()).toBe(10);
  });

  it('genuine grounded improvement applies once and increments usage once', () => {
    const { fin, trace, cv } = runEnhance({
      summary: WEAK_SUMMARY,
      candidate: EXPECTED_EN,
      rewriteStyle: 'stronger',
      usageBefore: 10,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.diagnostics?.noOpDetected).toBe(false);
    expect(fin.diagnostics?.meaningfulChangeDetected).toBe(true);
    expect(cv.summary).toBe(EXPECTED_EN);
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(10);
    expect(trace.usageCountAfter).toBe(11);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(getProAiUsageCount()).toBe(11);
  });

  it('unsafe candidate is rejected; when source already authoritative, clean no-op', () => {
    const { fin, trace } = runEnhance({
      summary: EXPECTED_EN,
      candidate: BAD_PROVIDER,
      rewriteStyle: 'stronger',
    });
    expectCleanNoOpTruth(trace, fin);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.noOpCandidateKind).toBe('client_deterministic');
    expect(getProAiUsageCount()).toBe(10);
  });

  it.each(['stronger', 'shorter', 'professional'] as const)(
    'rewriteStyle=%s identical enhance is clean no-op',
    (style) => {
      const { fin, trace } = runEnhance({
        summary: EXPECTED_EN,
        candidate: EXPECTED_EN,
        rewriteStyle: style,
      });
      expectCleanNoOpTruth(trace, fin);
      expect(fin.diagnostics?.rewriteStyle).toBe(style);
      expect(getProAiUsageCount()).toBe(10);
    },
  );

  it('localized no-op toast code maps to ai_noop across locales', () => {
    const locales: Locale[] = ['en', 'de', 'fr', 'es', 'it', 'pt-BR', 'ru', 'sr', 'hr', 'hi', 'ar', 'ja'];
    const code = mapExperienceAiFailureToErrorCode(SUMMARY_NOOP_REJECTION_REASON);
    expect(code).toBe('ai_noop');
    for (const locale of locales) {
      const msg = aiErrorMessage(code, locale);
      expect(msg.trim().length).toBeGreaterThan(10);
      // Must not be the generic validation-failure toast.
      expect(msg.toLowerCase()).not.toMatch(/validation failed|generation failed/);
    }
  });

  it('does not call apply gate path: blocked no-op never projects enhance success', () => {
    const cv = solarLibraryCv(EXPECTED_EN);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    seedUsage(10);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: EXPECTED_EN,
      referenceDateIso: REF,
      durationSnapshot: duration,
      rewriteStyle: 'stronger',
    });
    expect(fin.blocked).toBe(true);
    expect(fin.countedAsSuccess).toBe(false);
    expect(fin.diagnostics?.noOpDetected).toBe(true);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 'modern',
      gender: 'female',
      requestId: 'v2-noop-no-preapply',
      usageCountBefore: 10,
      operationMode: 'enhance_existing_content',
    });
    session.recordFinalizeResult(fin);
    // Production rewrite path returns before evaluatePreApplyDecisionGates on blocked.
    session.recordVisibleApplyNotApplicable(10);
    const trace = session.commit();
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.rejectionStage == null).toBe(true);
    expect(trace.finalTypedFailureReason == null).toBe(true);
    expect(
      (trace.stages || []).find((s) => s.name === 'final_postconditions')?.status,
    ).toBe('ok');
    expect(
      (trace.stages || []).find((s) => s.name === 'visible_apply')?.status,
    ).toBe('skipped');
    expect(
      (trace.diagnosticInvariantFailures || [])
        .some((f) => String(f).includes('enhance_success_without_meaningful_change')),
    ).toBe(false);
    expect(
      (trace.diagnosticInvariantFailures || [])
        .some((f) => String(f).includes('enhance_visible_apply_equals_source')),
    ).toBe(false);
  });
});
