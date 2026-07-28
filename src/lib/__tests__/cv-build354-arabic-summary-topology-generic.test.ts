/**
 * AAB-354 collateral — Arabic Summary topology-aware generic fallback.
 * Baker/Ztrew current-only + arbitrary occupations must not require Atlas/Rewitu.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildArabicEntryOwnedSummary,
  detectArabicSummaryPerspective,
  isArabicThirdPersonBiographySummary,
  resolveArabicSummaryExperienceTopology,
  arabicRequiredRoleSlotsForTopology,
  analyzeArabicSummaryEmploymentQuality,
} from '@/lib/cv-arabic-summary-grounding';
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

const REF = '2026-07-17';

const BAKER_DUTIES = [
  'Prepare dishes according to restaurant standards.',
  'Maintain workplace hygiene.',
  'Collaborate with the kitchen team.',
].join('\n');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function bakerCv(overrides?: Partial<CVData>): CVData {
  return {
    personal: {
      fullName: 'Ana Baker',
      jobTitle: 'Baker',
      gender: 'female',
      email: 'a@test.com',
      phone: '',
      address: '',
      photoEnabled: false,
    },
    summary: '',
    experience: [{
      id: 'exp-baker',
      position: 'Baker',
      company: 'Ztrew',
      startDate: '2024-01',
      endDate: '',
      isPresent: true,
      description: BAKER_DUTIES,
      originalUserDescription: BAKER_DUTIES,
      canonicalDescription: BAKER_DUTIES,
      descriptionOrigin: 'user',
    }],
    education: [],
    skills: ['Organization'],
    certifications: [],
    languages: [],
    templateId: 'creative-artistic',
    ...overrides,
  } as CVData;
}

describe('AAB-354 Arabic topology-aware generic Summary', () => {
  beforeEach(() => {
    seedUsage(26);
  });

  it('topology helpers: current-only does not require prior slot', () => {
    const topology = resolveArabicSummaryExperienceTopology({
      hasCurrentRole: true,
      hasPriorRole: false,
    });
    expect(topology).toBe('current_only');
    const slots = arabicRequiredRoleSlotsForTopology(topology, { durationAvailable: true });
    expect(slots.requiredRoleSlots).toEqual(['duration', 'current_intro']);
    expect(slots.requiredRoleSlots).not.toContain('prior_role');
  });

  it('exact Baker/Ztrew current-only Stronger/generate path', () => {
    const cv = bakerCv();
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      candidate: 'INVALID mixed Critical Thinking Adaptability Problem Solving',
      cv,
      requestedLocale: 'ar',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
    });

    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text.trim().length).toBeGreaterThan(20);
    expect(fin.text).toMatch(/Ztrew/i);
    expect(fin.text).toMatch(/خباز/);
    expect(fin.text).toMatch(/أعمل\s+حاليا/);
    expect(fin.text).toMatch(/أطباق|معايير\s*المطعم/);
    expect(fin.text).toMatch(/نظافة/);
    expect(fin.text).toMatch(/مطبخ/);
    expect(fin.text).not.toMatch(/مستودع|Atlas|Rewitu|بضائع\s*واردة|Critical Thinking/);
    expect(detectArabicSummaryPerspective(fin.text)).toBe('first_person');
    expect(isArabicThirdPersonBiographySummary(fin.text)).toBe(false);
    expect(fin.diagnostics?.finalPerspectiveMode).toBe('first_person');
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    expect(fin.diagnostics?.deterministicCandidateHash).toBe(
      fin.diagnostics?.finalValidatedCandidateHash,
    );
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(
      fin.diagnostics?.providerTypedRejectionReason
      || fin.diagnostics?.providerRejectionReason,
    ).toBeTruthy();
    expect(fin.diagnostics?.finalUnitRoleSlots).toContain('current_intro');
    expect(fin.diagnostics?.finalUnitRoleSlots).not.toContain('prior_role');
    expect(fin.diagnostics?.finalDurationOwnerDetected).toBe('total_professional_experience');

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'ar',
      requestedLocale: 'ar',
      contentLocale: 'en',
      gender: 'female',
      usageCountBefore: 26,
      operationMode: 'generate_from_empty',
    });
    session.recordCvSnapshot(cv, '');
    session.recordFinalizeResult(fin);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed, JSON.stringify({
      reason: pre.reason,
      nullish: session.draft.nullRequiredDiagnosticFields,
      invariants: session.draft.diagnosticInvariantFailures,
    })).toBe(true);
    expect(getProAiUsageCount()).toBe(26);
    const next = applyFinalizedSummaryToCv(cv, 'ar', fin);
    expect(next.summary).toBe(fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(27);
    session.recordVisibleApply(true, 27, fin.text);
    expect(session.draft.visibleApplySucceeded).toBe(true);
    expect(session.draft.visibleCandidateHashAfterApply).toBeTruthy();
    const inv = checkSummaryDiagnosticInvariants(session.draft as never);
    expect(inv.passed, JSON.stringify(inv.failures)).toBe(true);
  });

  it('free-text occupation without dedicated classifier', () => {
    const duties = 'Reviews shift reports.\nSupports front-desk guests.';
    const built = buildArabicEntryOwnedSummary({
      role: 'Floor Coordinator',
      employer: 'Nordic Hub',
      gender: 'female',
      currentEntryDuties: duties,
      hasCurrentRole: true,
      duration: {
        totalMonths: 18,
        approxYears: 1.5,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    expect(built).toMatch(/أعمل\s+حاليا/);
    expect(built).toMatch(/Nordic Hub/);
    expect(built).toMatch(/Floor Coordinator/);
    expect(built).not.toMatch(/مستودع|بضائع|Atlas/);
    expect(detectArabicSummaryPerspective(built)).toBe('first_person');
  });

  it('completed-only arbitrary occupation does not fabricate current role', () => {
    const built = buildArabicEntryOwnedSummary({
      role: '',
      employer: '',
      gender: 'female',
      currentEntryDuties: '',
      hasCurrentRole: false,
      priorRole: 'Cashier',
      priorEmployer: 'Market One',
      priorEntryDuties: 'Handled payments.\nBalanced the till.',
      duration: {
        totalMonths: 12,
        approxYears: 1,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    expect(built).toMatch(/سبق\s+أن\s+عملت/);
    expect(built).toMatch(/Market One/);
    expect(built).not.toMatch(/أعمل\s+حاليا/);
    const q = analyzeArabicSummaryEmploymentQuality(built, {
      company: '',
      priorCompany: 'Market One',
      priorRole: 'Cashier',
      priorEntryDuties: 'Handled payments.',
      hasCurrentRole: false,
      hasPriorRole: true,
      gender: 'female',
    });
    expect(q.summaryExperienceTopology).toBe('completed_only');
    expect(q.requiredRoleSlots).not.toContain('current_intro');
    expect(q.slotValidationPassed).toBe(true);
  });

  it('current plus multiple priors keeps current and one selected prior', () => {
    const built = buildArabicEntryOwnedSummary({
      role: 'Baker',
      employer: 'Ztrew',
      gender: 'female',
      currentEntryDuties: BAKER_DUTIES,
      hasCurrentRole: true,
      priorRole: 'Cashier',
      priorEmployer: 'Shop A',
      priorEntryDuties: 'Handled payments.',
      additionalPriorEntries: [
        { role: 'Host', employer: 'Shop B', duties: 'Welcomed guests.' },
        { role: 'Runner', employer: 'Shop C', duties: 'Carried trays.' },
      ],
      duration: {
        totalMonths: 40,
        approxYears: 3,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    expect(built).toMatch(/Ztrew/);
    expect(built).toMatch(/أعمل\s+حاليا/);
    expect(built).toMatch(/سبق\s+أن\s+عملت/);
    expect(built).toMatch(/Shop A/);
    expect(built).not.toMatch(/Shop B|Shop C/);
  });

  it('missing employer still emits first-person current intro', () => {
    const built = buildArabicEntryOwnedSummary({
      role: 'Baker',
      employer: '',
      gender: 'female',
      currentEntryDuties: BAKER_DUTIES,
      hasCurrentRole: true,
      duration: {
        totalMonths: 24,
        approxYears: 2,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    expect(built).toMatch(/^لدي\s+نحو/);
    expect(built).toMatch(/أعمل\s+حالياً\s+كخباز/);
    expect(built).not.toMatch(/لدى\s+\s*ك/);
  });

  it('negative: actual missing current intro still rejected when required', () => {
    const q = analyzeArabicSummaryEmploymentQuality(
      'لدي نحو سنتين من الخبرة المهنية الإجمالية.',
      {
        company: 'Ztrew',
        role: 'Baker',
        structuredRole: 'Baker',
        currentEntryDuties: BAKER_DUTIES,
        hasCurrentRole: true,
        hasPriorRole: false,
        gender: 'female',
      },
    );
    expect(q.slotValidationPassed).toBe(false);
    expect(q.slotRejectionReasons).toContain('missing_current_intro_slot');
    expect(q.typedRejectionReason).toBe('missing_current_intro_slot');
  });

  it('stable entry id hashes recorded when provided', () => {
    const id = fingerprintText('exp-baker');
    const built = buildArabicEntryOwnedSummary({
      role: 'Baker',
      employer: 'Ztrew',
      gender: 'female',
      currentEntryDuties: BAKER_DUTIES,
      hasCurrentRole: true,
      duration: {
        totalMonths: 24,
        approxYears: 2,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    const q = analyzeArabicSummaryEmploymentQuality(built, {
      company: 'Ztrew',
      role: 'Baker',
      structuredRole: 'Baker',
      currentEntryDuties: BAKER_DUTIES,
      hasCurrentRole: true,
      hasPriorRole: false,
      gender: 'female',
      selectedEntryIdHashes: [id],
      omittedEntryIdHashes: [],
      entrySelectionReasonByHash: { [id]: 'current_role_mandatory' },
    });
    expect(q.selectedEntryIdHashes).toEqual([id]);
    expect(q.entrySelectionReasonByHash[id]).toBe('current_role_mandatory');
    expect(q.groundingValidationPassed).toBe(true);
  });

  it('current role with no entered duties still emits first-person intro', () => {
    const built = buildArabicEntryOwnedSummary({
      role: 'Baker',
      employer: 'Ztrew',
      gender: 'female',
      currentEntryDuties: '',
      hasCurrentRole: true,
      duration: {
        totalMonths: 12,
        approxYears: 1,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    expect(built).toMatch(/أعمل\s+حاليا/);
    expect(built).toMatch(/Ztrew/);
    expect(built).toMatch(/خباز/);
    expect(detectArabicSummaryPerspective(built)).toBe('first_person');
  });

  it('long CV selects current + one prior and records omitted hashes', () => {
    const entries = [
      { id: 'cur', role: 'Baker', employer: 'Ztrew', duties: BAKER_DUTIES, present: true },
      { id: 'p1', role: 'Cashier', employer: 'Shop A', duties: 'Handled payments.', present: false },
      { id: 'p2', role: 'Host', employer: 'Shop B', duties: 'Welcomed guests.', present: false },
      { id: 'p3', role: 'Runner', employer: 'Shop C', duties: 'Carried trays.', present: false },
      { id: 'p4', role: 'Stock', employer: 'Shop D', duties: 'Counted shelves.', present: false },
    ];
    const built = buildArabicEntryOwnedSummary({
      role: entries[0]!.role,
      employer: entries[0]!.employer,
      gender: 'female',
      currentEntryDuties: entries[0]!.duties,
      hasCurrentRole: true,
      priorRole: entries[1]!.role,
      priorEmployer: entries[1]!.employer,
      priorEntryDuties: entries[1]!.duties,
      additionalPriorEntries: entries.slice(2).map((e) => ({
        role: e.role,
        employer: e.employer,
        duties: e.duties,
      })),
      duration: {
        totalMonths: 60,
        approxYears: 5,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    expect(built).toMatch(/Ztrew/);
    expect(built).toMatch(/Shop A/);
    expect(built).not.toMatch(/Shop B|Shop C|Shop D/);
    expect(built.length).toBeLessThan(900);
    const selected = [fingerprintText('cur'), fingerprintText('p1')];
    const omitted = entries.slice(2).map((e) => fingerprintText(e.id));
    const q = analyzeArabicSummaryEmploymentQuality(built, {
      company: 'Ztrew',
      role: 'Baker',
      structuredRole: 'Baker',
      currentEntryDuties: BAKER_DUTIES,
      priorCompany: 'Shop A',
      priorRole: 'Cashier',
      priorEntryDuties: 'Handled payments.',
      hasCurrentRole: true,
      hasPriorRole: true,
      priorEntryCount: 4,
      gender: 'female',
      selectedEntryIdHashes: selected,
      omittedEntryIdHashes: omitted,
      entrySelectionReasonByHash: {
        [selected[0]!]: 'current_role_mandatory',
        [selected[1]!]: 'most_recent_prior',
      },
    });
    expect(q.summaryExperienceTopology).toBe('current_plus_many_prior');
    expect(q.omittedEntryIdHashes).toEqual(omitted);
    expect(q.requiredRoleSlots).toContain('prior_role');
  });

  it('two similar occupations keep entry ownership without collision', () => {
    const built = buildArabicEntryOwnedSummary({
      role: 'Baker',
      employer: 'Ztrew',
      gender: 'female',
      currentEntryDuties: BAKER_DUTIES,
      hasCurrentRole: true,
      priorRole: 'Baker',
      priorEmployer: 'Oven Co',
      priorEntryDuties: 'Kneaded dough daily.',
      duration: {
        totalMonths: 36,
        approxYears: 3,
        unit: 'years',
        hasValidDates: true,
        approxLabel: '',
      },
    });
    expect(built).toMatch(/Ztrew/);
    expect(built).toMatch(/Oven Co/);
    expect(built).toMatch(/أطباق|معايير/);
    expect(built).toMatch(/عجن|عجينة/);
    expect(built).not.toMatch(/مستودع|Atlas/);
    // Ownership: current cooking duties stay on current; prior kneading stays on prior.
    const priorUnit = built.split(/(?<=[.。۔])\s+/).find((u) => /Oven Co/.test(u)) || '';
    expect(priorUnit).toMatch(/عجن|عجينة/);
    expect(priorUnit).not.toMatch(/أطباق|معايير\s*المطعم/);
  });
});
