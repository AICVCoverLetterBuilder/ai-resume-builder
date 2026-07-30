/**
 * AAB-373 — Summary V2 runtime preapply diagnostic snapshot ordering.
 * Production-like path through finalize → diagnostic session → visible apply.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
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

function solarLibraryCv(): CVData {
  return {
    id: 'summary-v2-solar-library',
    name: 'V2 Fixture',
    personal: {
      fullName: 'Alex Example',
      email: 'a@example.com',
      phone: '',
      address: '',
      jobTitle: 'Solar Panel Installer',
      gender: 'female',
    },
    summary: '',
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

describe('Summary V2 preapply diagnostic snapshot (AAB-373)', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(8);
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('Solar/Library: complete final snapshot before gate; apply + usage 8→9', () => {
    const cv = solarLibraryCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: BAD_PROVIDER,
      referenceDateIso: REF,
      durationSnapshot: duration,
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.text).toBe(EXPECTED_EN);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.deterministicAccepted).toBe(true);
    expect(fin.diagnostics?.requiredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.requiredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.finalNormalizedHash).toBeTruthy();
    expect(fin.diagnostics?.currentRoleTitlePresent).toBe(true);
    expect(fin.diagnostics?.structuredRoleLocaleValidationPassed).toBe(true);
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_V2_REVISION);

    const countBefore = getProAiUsageCount();
    expect(countBefore).toBe(8);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 'modern',
      gender: 'female',
      requestId: 'aab-373-v2-preapply',
      usageCountBefore: countBefore,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);

    // Gate must see the same completed final-candidate snapshot.
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed).toBe(true);
    expect(pre.diagnosticInvariantCheckPassed).toBe(true);
    expect(pre.diagnosticCompletenessPassed).toBe(true);
    expect(pre.reason).toBeNull();

    const draft = (session as unknown as { draft: Record<string, unknown> }).draft;
    expect(draft.finalPostconditionsPassed).toBe(true);
    expect(draft.finalNormalizedHash).toBeTruthy();
    expect(draft.rejectionStage).toBeNull();
    expect(draft.finalTypedFailureReason).toBeNull();
    expect(draft.diagnosticInvariantCheckPassed).toBe(true);

    const applied = applyFinalizedSummaryToCv(cv, 'en', fin);
    expect(applied.summary).toBe(EXPECTED_EN);

    // Mirror production page.tsx: visible apply with countBefore, then +1 usage.
    session.recordVisibleApply(true, countBefore, fin.text || '');
    expect(session.visibleApplySucceeded).toBe(true);
    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: countBefore + 1 });

    const trace = session.commit();
    const finalSelected = (trace.candidateLineage || [])
      .find((c) => c.candidateKind === 'final_selected');

    expect(trace.finalPostconditionsPassed).toBe(true);
    expect(trace.finalNormalizedHash).toBe(finalSelected?.normalizedHash);
    expect(trace.diagnosticInvariantCheckPassed).toBe(true);
    expect(trace.diagnosticInvariantFailureCount).toBe(0);
    expect(trace.diagnosticCompletenessPassed).toBe(true);
    expect(trace.rejectionStage).toBeNull();
    expect(trace.finalTypedFailureReason).toBeNull();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.countedAsSuccess).toBe(true);
    expect(trace.usageCountBefore).toBe(8);
    expect(trace.usageCountAfter).toBe(9);
    expect(getProAiUsageCount()).toBe(9);
    expect(trace.requiredCurrentDutyFactCount).toBe(3);
    expect(trace.coveredCurrentDutyFactCount).toBe(3);
    expect(trace.requiredPriorDutyFactCount).toBe(3);
    expect(trace.coveredPriorDutyFactCount).toBe(3);
  });
});
