/**
 * Summary V2 completed-duty tense idempotence.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CVData } from '@/lib/types';
import {
  applyFinalizedSummaryToCv,
  finalizeCvAiFieldForApply,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import {
  bulletToWhereClauseEn,
  isMalformedDoublePastToken,
  peelEnglishVerbToLemma,
  setSummaryV2EnabledForTests,
  summaryHasMalformedDoublePast,
  toEnglishPastVerb,
  validateSummaryV2AgainstManifest,
  buildSummaryV2ManifestForCv,
  runSummaryV2,
} from '@/lib/cv-summary-v2';

const REF = '2026-07-01';

const SOLAR = [
  'installs solar panels',
  'positions and secures panels',
  'coordinates installation activities',
].join('\n');

const LIB_PRESENT = [
  'records borrowed and returned books',
  'arranges books by catalogue and shelf location',
  'helps visitors locate requested titles',
].join('\n');

const LIB_ALREADY_PAST = [
  'Registered borrowed and returned books in the library system.',
  'Arranged books by catalogue and shelf location.',
  'Helped visitors locate requested titles.',
].join('\n');

const EXPECTED_SOLAR_LIBRARY =
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

function fixture(priorDuties: string): CVData {
  return {
    id: 'summary-v2-tense',
    name: 'V2 Tense',
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
        description: priorDuties,
        canonicalDescription: priorDuties,
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

describe('Summary V2 duty tense idempotence', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(8);
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('morphology: already-past and base forms are idempotent', () => {
    expect(toEnglishPastVerb('registered')).toBe('registered');
    expect(toEnglishPastVerb('Registered')).toBe('registered');
    expect(toEnglishPastVerb('arranged')).toBe('arranged');
    expect(toEnglishPastVerb('helped')).toBe('helped');
    expect(toEnglishPastVerb('record')).toBe('recorded');
    expect(toEnglishPastVerb('arrange')).toBe('arranged');
    expect(toEnglishPastVerb('help')).toBe('helped');
    expect(toEnglishPastVerb('registered')).not.toMatch(/registeredd|registeredded/i);
    expect(toEnglishPastVerb('registeredd')).toBe('registered');
    expect(toEnglishPastVerb('registeredded')).toBe('registered');

    // Irregular past unchanged.
    expect(toEnglishPastVerb('made')).toBe('made');
    expect(toEnglishPastVerb('wrote')).toBe('wrote');
    expect(toEnglishPastVerb('built')).toBe('built');
    expect(toEnglishPastVerb('led')).toBe('led');
    expect(toEnglishPastVerb('make')).toBe('made');
    expect(toEnglishPastVerb('write')).toBe('wrote');

    // Current-role present lemmas stay present in present tense.
    expect(bulletToWhereClauseEn('installs solar panels', 'present')).toBe('install solar panels');
    expect(bulletToWhereClauseEn('positions and secures panels', 'present'))
      .toBe('position and secure panels');
    expect(bulletToWhereClauseEn('Registered borrowed books', 'present'))
      .toBe('register borrowed books');

    // Completed: already-past and base both yield single past.
    expect(bulletToWhereClauseEn(
      'Registered borrowed and returned books in the library system.',
      'past',
    )).toBe('registered borrowed and returned books in the library system');
    expect(bulletToWhereClauseEn('Arranged books by catalogue', 'past'))
      .toBe('arranged books by catalogue');
    expect(bulletToWhereClauseEn('Helped visitors locate titles', 'past'))
      .toBe('helped visitors locate titles');
    expect(bulletToWhereClauseEn('record borrowed books', 'past'))
      .toBe('recorded borrowed books');
    expect(bulletToWhereClauseEn('arrange books', 'past')).toBe('arranged books');
    expect(bulletToWhereClauseEn('help visitors', 'past')).toBe('helped visitors');

    expect(peelEnglishVerbToLemma('registered')).toBe('register');
    expect(peelEnglishVerbToLemma('arranged')).toBe('arrange');
    expect(isMalformedDoublePastToken('registeredded')).toBe(true);
    expect(isMalformedDoublePastToken('registered')).toBe(false);
    expect(summaryHasMalformedDoublePast(
      'where I registeredded borrowed books',
    )).toBe(true);
    expect(summaryHasMalformedDoublePast(
      'where I registered borrowed books',
    )).toBe(false);
  });

  it('validator rejects malformed double-past provider text', () => {
    const cv = fixture(LIB_PRESENT);
    const manifest = buildSummaryV2ManifestForCv({
      cv,
      locale: 'en',
      referenceDateIso: REF,
    });
    const bad =
      'I have approximately five and a half years of experience. '
      + 'I currently work as a Solar Panel Installer at SunGrid, where I install solar panels, '
      + 'position and secure panels, and coordinate installation activities. '
      + 'Previously, I worked as a Library Assistant at City Library, where I registeredded '
      + 'borrowed and returned books, arranged books by catalogue and shelf location, '
      + 'and helped visitors locate requested titles.';
    const v = validateSummaryV2AgainstManifest(bad, manifest);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('malformed_double_past_inflection');
  });

  it('already-past Library duties never emit registeredded; apply + usage 8→9', () => {
    const cv = fixture(LIB_ALREADY_PAST);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(duration.total?.totalMonths).toBe(66);

    const result = runSummaryV2({
      cv,
      locale: 'en',
      gender: 'female',
      referenceDateIso: REF,
      candidate: '',
    });
    expect(result.blocked).toBe(false);
    expect(result.text).not.toMatch(/registeredd|registeredded|arrangedd|helpedd/i);
    expect(result.text).toMatch(/where I registered borrowed and returned books/i);
    expect(result.text).toMatch(/arranged books by catalogue/i);
    expect(result.text).toMatch(/helped visitors locate requested titles/i);
    expect(result.validation.requiredCurrentFactCount).toBe(3);
    expect(result.validation.coveredCurrentFactCount).toBe(3);
    expect(result.validation.requiredPriorFactCount).toBe(3);
    expect(result.validation.coveredPriorFactCount).toBe(3);
    expect(result.validation.durationExpressionCount).toBe(1);
    expect(result.validation.currentDutyTenseOk).toBe(true);
    expect(result.validation.priorDutyTenseOk).toBe(true);

    const before = getProAiUsageCount();
    expect(before).toBe(8);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
      durationSnapshot: duration,
    });
    expect(fin.blocked).toBe(false);
    expect(fin.text).not.toMatch(/registeredd|registeredded/i);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'en',
      requestedLocale: 'en',
      contentLocale: 'en',
      templateId: 'modern',
      gender: 'female',
      requestId: 'tense-idempotence',
      usageCountBefore: before,
      operationMode: 'generate_from_context',
    });
    session.recordFinalizeResult(fin);
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);
    const applied = applyFinalizedSummaryToCv(cv, 'en', fin);
    expect(applied.summary).toBe(fin.text);
    session.recordVisibleApply(true, before, fin.text || '');
    expect(session.visibleApplySucceeded).toBe(true);
    recordProAiUserActionSuccess();
    session.patch({ usageCountAfter: before + 1 });
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.usageCountAfter).toBe(9);
    expect(getProAiUsageCount()).toBe(9);
  });

  it('exact Solar/Library present-duty fixture remains unchanged', () => {
    const cv = fixture(LIB_PRESENT);
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const result = runSummaryV2({
      cv,
      locale: 'en',
      gender: 'female',
      referenceDateIso: REF,
      candidate: '',
    });
    expect(result.text).toBe(EXPECTED_SOLAR_LIBRARY);
    expect(result.validation.coveredCurrentFactCount).toBe(3);
    expect(result.validation.coveredPriorFactCount).toBe(3);
    expect(result.validation.durationExpressionCount).toBe(1);
    expect(duration.total?.totalMonths).toBe(66);
  });
});
