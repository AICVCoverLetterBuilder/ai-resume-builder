/**
 * Summary rewrite page-handler clean no-op toast routing.
 * Mirrors handleRewrite Stronger/Shorter/Professional terminal decisions.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_NOOP_REJECTION_REASON,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import {
  resolveSummaryFinalizeClientOutcome,
  isSummaryCleanNoOpFinalizeResult,
} from '@/lib/cv-summary-noop-ui';
import { setSummaryV2EnabledForTests, isSummaryV2Enabled, buildSummaryV2ManifestForCv, buildSummaryV2StyledDeterministicText } from '@/lib/cv-summary-v2';
import { summaryV2ModeActive } from './helpers/summary-v2-invariants';
import {
  getProAiUsageCount,
  persistProAiRecord,
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

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function fixture(summary: string): CVData {
  return {
    id: 'noop-ui',
    name: 'NoOp UI',
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
        id: 'cur',
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
        id: 'pri',
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

/**
 * Production-like rewrite handler terminal (toast + stages + usage), without React.
 */
function runRewritePageHandler(opts: {
  style: 'stronger' | 'shorter' | 'professional';
  candidate: string;
  summary?: string;
  locale?: Locale;
  toast: { error: (msg: string) => void; success: (msg: string) => void };
}) {
  const locale = opts.locale || 'en';
  const sourceSummary = opts.summary ?? EXPECTED_EN;
  const cv = fixture(sourceSummary);
  const liveSummaryAtPress = sourceSummary;
  const countBefore = getProAiUsageCount();
  const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
  const action = opts.style === 'shorter'
    ? 'summary_shorter'
    : opts.style === 'professional'
      ? 'summary_professional'
      : 'summary_stronger';
  const fin = finalizeCvAiFieldForApply({
    action,
    field: 'summary',
    requestedLocale: 'en',
    gender: 'female',
    cv,
    candidate: opts.candidate,
    referenceDateIso: REF,
    durationSnapshot: duration,
    rewriteStyle: opts.style,
  });
  const session = new SummaryAiDiagnosticSession({
    uiLocale: locale,
    requestedLocale: 'en',
    contentLocale: 'en',
    templateId: 'modern',
    gender: 'female',
    requestId: `noop-ui-${opts.style}`,
    usageCountBefore: countBefore,
    operationMode: 'enhance_existing_content',
    rewriteStyle: opts.style,
  });
  session.recordFinalizeResult(fin);
  const outcome = resolveSummaryFinalizeClientOutcome(
    fin,
    opts.style === 'stronger' ? 'stronger_content_generation_failed' : 'summary_rewrite_failed',
  );

  let wroteVisible = false;
  let usageAfter = countBefore;

  if (outcome.kind === 'clean_noop') {
    session.recordVisibleApplyNotApplicable(countBefore);
    const toastMsg = aiErrorMessage('ai_noop', locale);
    opts.toast.error(toastMsg);
    const trace = session.commit();
    return {
      fin,
      outcome,
      trace,
      wroteVisible,
      usageBefore: countBefore,
      usageAfter,
      toastMsg,
      summaryUnchanged: (cv.summary || '').trim() === liveSummaryAtPress,
    };
  }

  if (fin.blocked || !fin.countedAsSuccess) {
    // V2 style-saturated terminal uses style_no_safe_material_change.
    if (
      fin.reason === 'style_no_safe_material_change'
      || fin.diagnostics?.noOpRejectionReason === 'style_no_safe_material_change'
    ) {
      session.recordVisibleApplyNotApplicable(countBefore);
      const toastMsg = aiErrorMessage('ai_noop', locale);
      opts.toast.error(toastMsg);
      const trace = session.commit();
      return {
        fin,
        outcome: {
          kind: 'clean_noop' as const,
          toastCode: 'ai_noop' as const,
          reason: 'style_no_safe_material_change',
        },
        trace,
        wroteVisible,
        usageBefore: countBefore,
        usageAfter,
        toastMsg,
        summaryUnchanged: true,
      };
    }
    const failCode = outcome.toastCode
      || (opts.style === 'stronger' ? 'stronger_content_generation_failed' : 'summary_rewrite_failed');
    const toastMsg = aiErrorMessage(failCode, locale);
    session.recordVisibleApply(false, countBefore);
    opts.toast.error(toastMsg);
    const trace = session.commit();
    return {
      fin,
      outcome,
      trace,
      wroteVisible,
      usageBefore: countBefore,
      usageAfter,
      toastMsg,
      summaryUnchanged: true,
    };
  }

  wroteVisible = true;
  usageAfter = countBefore + 1;
  session.recordVisibleApply(true, countBefore, fin.text || '');
  session.patch({ usageCountAfter: usageAfter });
  opts.toast.success('ok');
  const trace = session.commit();
  return {
    fin,
    outcome,
    trace,
    wroteVisible,
    usageBefore: countBefore,
    usageAfter,
    toastMsg: null as string | null,
    summaryUnchanged: false,
  };
}

describe('Summary rewrite page-handler clean no-op toast routing', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(10);
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('prioritizes noOpDetected over generic validation-failure mapping', () => {
    const outcome = resolveSummaryFinalizeClientOutcome({
      blocked: true,
      countedAsSuccess: false,
      reason: undefined,
      diagnostics: {
        noOpDetected: true,
        typedFailureReason: null,
      },
    }, 'generation_validation_failed');
    expect(outcome.kind).toBe('clean_noop');
    expect(outcome.toastCode).toBe('ai_noop');
    expect(mapExperienceAiFailureToErrorCode(outcome.reason)).toBe('ai_noop');
    expect(aiErrorMessage('ai_noop', 'en')).not.toMatch(/failed validation/i);
    expect(aiErrorMessage('generation_validation_failed', 'en')).toMatch(/failed validation/i);
  });

  it.each(['stronger', 'shorter', 'professional'] as const)(
    '%s clean no-op: one ai_noop toast, no validation toast, no write, usage unchanged',
    (style) => {
      const errors: string[] = [];
      const successes: string[] = [];
      const toast = {
        error: (msg: string) => { errors.push(msg); },
        success: (msg: string) => { successes.push(msg); },
      };
      // Under V2, identical canonical text is style-transformed. True no-op uses
      // a source that already satisfies the requested style.
      let summary = EXPECTED_EN;
      let candidate = EXPECTED_EN;
      if (summaryV2ModeActive() || isSummaryV2Enabled()) {
        const cv0 = fixture(EXPECTED_EN);
        const manifest = buildSummaryV2ManifestForCv({
          cv: cv0,
          locale: 'en',
          gender: 'female',
          referenceDateIso: REF,
        });
        summary = buildSummaryV2StyledDeterministicText(manifest, style);
        candidate = summary;
      }
      const result = runRewritePageHandler({
        style,
        candidate,
        summary,
        toast,
      });

      expect(isSummaryCleanNoOpFinalizeResult(result.fin) || result.outcome.kind === 'clean_noop')
        .toBe(true);
      expect(result.outcome.kind).toBe('clean_noop');
      expect(
        result.fin.reason === SUMMARY_NOOP_REJECTION_REASON
        || result.fin.reason === 'style_no_safe_material_change',
      ).toBe(true);
      expect(result.wroteVisible).toBe(false);
      expect(result.summaryUnchanged).toBe(true);
      expect(result.usageBefore).toBe(10);
      expect(result.usageAfter).toBe(10);
      expect(getProAiUsageCount()).toBe(10);
      expect(successes).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(aiErrorMessage('ai_noop', 'en'));
      expect(errors[0]).not.toBe(aiErrorMessage('generation_validation_failed', 'en'));
      expect(errors[0]).not.toBe(aiErrorMessage('summary_rewrite_failed', 'en'));
      expect(errors[0]).not.toBe(aiErrorMessage('stronger_content_generation_failed', 'en'));

      expect(result.trace.noOpDetected).toBe(true);
      expect(result.trace.visibleApplySucceeded).toBe(false);
      expect(result.trace.countedAsSuccess).toBe(false);
      const vis = (result.trace.stages || []).find((s) => s.name === 'visible_apply');
      expect(vis?.status).toBe('skipped');
    },
  );

  it('genuine validation rejection still uses failure toast (not ai_noop)', () => {
    const outcome = resolveSummaryFinalizeClientOutcome({
      blocked: true,
      countedAsSuccess: false,
      reason: 'summary_grounding_failed',
      diagnostics: { noOpDetected: false },
    }, 'summary_rewrite_failed');
    expect(outcome.kind).toBe('validation_failure');
    expect(outcome.toastCode).toBe('summary_grounding_failed');
    expect(outcome.toastCode).not.toBe('ai_noop');
  });

  it('page.tsx handleRewrite prioritizes clean no-op before failure branch', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/app/cv-builder/page.tsx'),
      'utf8',
    );
    const fn = source.slice(
      source.indexOf('const handleRewrite'),
      source.indexOf('const handleAnalyzeJob'),
    );
    expect(fn).toContain('resolveSummaryFinalizeClientOutcome');
    expect(fn).toContain("kind === 'clean_noop'");
    expect(fn).toContain('recordVisibleApplyNotApplicable');
    expect(fn).toContain("aiErrorMessage('ai_noop'");
    const noopIdx = fn.indexOf("kind === 'clean_noop'");
    const failIdx = fn.indexOf('finalizedGate.blocked || !finalizedGate.countedAsSuccess');
    // After our change, clean_noop check appears before the remaining failure block
    // that still uses blocked || !countedAsSuccess for real failures.
    expect(noopIdx).toBeGreaterThan(-1);
    expect(failIdx).toBeGreaterThan(noopIdx);
  });
});
