/**
 * Summary V2 architecture — parallel engine behind feature flag.
 * Legacy Summary path remains default (flag off).
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  expectSummaryContractInvariants,
  expectV2OrLegacyBuilderRevision,
  expectProviderRejectedReason,
  summaryV2ModeActive,
} from './helpers/summary-v2-invariants';
import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  finalizeCvAiFieldForApply,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { countSummaryDurationExpressions } from '@/lib/cv-summary-duration-ownership';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import {
  SUMMARY_V2_REVISION,
  setSummaryV2EnabledForTests,
  isSummaryV2Enabled,
  runSummaryV2,
  buildSummaryV2ManifestForCv,
  compareSummaryV2AgainstLegacy,
  liveExperienceDescription,
  captureSummaryV2Snapshot,
} from '@/lib/cv-summary-v2';

const REF = '2026-07-01';

const ALL_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

const SOLAR_DUTIES = [
  'installs solar panels',
  'positions and secures panels',
  'coordinates installation activities',
].join('\n');

const LIBRARY_DUTIES = [
  'records borrowed and returned books',
  'arranges books by catalogue and shelf location',
  'helps visitors locate requested titles',
].join('\n');

const WH_EN = [
  'checking incoming goods;',
  'checking documentation related to received goods;',
  'coordinating with colleagues on preparation and movement of goods.',
].join('\n');

const GD_EN = [
  'creating visual materials and graphic elements;',
  'reviewing and adapting design materials;',
  'preparing final design files for different formats and screens.',
].join('\n');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function solarLibraryCv(options?: {
  summary?: string;
  currentId?: string;
  priorId?: string;
  extraEntries?: WorkExperience[];
  swapOrder?: boolean;
  staleCanonical?: boolean;
}): CVData {
  const current: WorkExperience = {
    id: options?.currentId || 'atlas',
    position: 'Solar Panel Installer',
    company: 'SunGrid',
    startDate: '2024-01',
    endDate: '',
    isPresent: true,
    description: SOLAR_DUTIES,
    ...(options?.staleCanonical
      ? { canonicalDescription: WH_EN, generatedDescription: WH_EN }
      : { canonicalDescription: SOLAR_DUTIES }),
    descriptionOrigin: 'user',
    generatedLocale: 'en',
  };
  const prior: WorkExperience = {
    id: options?.priorId || 'rewitu',
    position: 'Library Assistant',
    company: 'City Library',
    startDate: '2021-01',
    endDate: '2023-12',
    isPresent: false,
    description: LIBRARY_DUTIES,
    ...(options?.staleCanonical
      ? { canonicalDescription: GD_EN, generatedDescription: GD_EN }
      : { canonicalDescription: LIBRARY_DUTIES }),
    descriptionOrigin: 'user',
    generatedLocale: 'en',
  };
  const experience = options?.swapOrder
    ? [prior, current, ...(options?.extraEntries || [])]
    : [current, prior, ...(options?.extraEntries || [])];
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
    summary: options?.summary ?? '',
    experience,
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

describe('Summary V2 architecture', () => {
  beforeEach(() => {
    setSummaryV2EnabledForTests(true);
    seedUsage(8);
  });

  afterEach(() => {
    setSummaryV2EnabledForTests(null);
  });

  it('marker reachable and flag defaults off outside override', () => {
    expect(SUMMARY_V2_REVISION).toBe('summary-v2-architecture-371-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(SUMMARY_V2_REVISION);
    const prevEnv = process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
    try {
      delete process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
      setSummaryV2EnabledForTests(null);
      expect(isSummaryV2Enabled()).toBe(false);
      setSummaryV2EnabledForTests(true);
      expect(isSummaryV2Enabled()).toBe(true);
    } finally {
      setSummaryV2EnabledForTests(null);
      if (prevEnv === undefined) delete process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2;
      else process.env.NEXT_PUBLIC_ENABLE_SUMMARY_V2 = prevEnv;
    }
  });

  it('exact Solar/Library fixture: 66 months once, 3/3+3/3, natural EN, usage +1', () => {
    const cv = solarLibraryCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(duration.total?.totalMonths).toBe(66);

    const liveOnly = liveExperienceDescription(cv.experience![0]);
    expect(liveOnly).toBe(SOLAR_DUTIES);
    expect(liveOnly).not.toMatch(/incoming goods/i);

    const result = runSummaryV2({
      cv,
      locale: 'en',
      gender: 'female',
      referenceDateIso: REF,
      candidate: '',
    });
    expect(result.blocked).toBe(false);
    expect(result.countedAsSuccess).toBe(true);
    expect(result.origin).toBe('deterministic_fallback');

    const text = result.text;
    // Exact generated fixture text (pinned).
    expect(text).toBe(
      'I have approximately five and a half years of experience. '
      + 'I currently work as a Solar Panel Installer at SunGrid, where I install solar panels, '
      + 'position and secure panels, and coordinate installation activities. '
      + 'Previously, I worked as a Library Assistant at City Library, where I recorded borrowed and returned books, '
      + 'arranged books by catalogue and shelf location, and helped visitors locate requested titles.',
    );
    expect(result.validation.currentDutyTenseOk).toBe(true);
    expect(result.validation.priorDutyTenseOk).toBe(true);
    expect(text).toMatch(/where I install solar panels/);
    expect(text).toMatch(/where I recorded borrowed/);
    expect(text).not.toMatch(/where I record borrowed/);
    expect(countSummaryDurationExpressions(text, 'en')).toBe(1);
    expect(result.validation.requiredCurrentFactCount).toBe(3);
    expect(result.validation.coveredCurrentFactCount).toBe(3);
    expect(result.validation.requiredPriorFactCount).toBe(3);
    expect(result.validation.coveredPriorFactCount).toBe(3);
    expect(text).not.toMatch(/\bAtlas\b|\bRewitu\b|incoming goods|warehouse|graphic designer/i);

    const before = getProAiUsageCount();
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
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.text).toBe(text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(before + 1);
  });

  it('current/completed duty tense follows employmentState for arbitrary occupations', () => {
    const cv: CVData = {
      personal: {
        fullName: 'X',
        email: 'x@y.z',
        phone: '',
        address: '',
        jobTitle: 'River Guide',
        gender: 'female',
      },
      summary: '',
      experience: [
        {
          id: 'cur',
          position: 'River Guide',
          company: 'Eddy Co',
          startDate: '2024-01',
          endDate: '',
          isPresent: true,
          description: 'leads rafting trips\nbriefssafety protocols\ncoordinates put-in logistics'
            .replace('briefssafety', 'briefs safety'),
        },
        {
          id: 'pri',
          position: 'Camp Counselor',
          company: 'Pine Camp',
          startDate: '2021-01',
          endDate: '2023-12',
          isPresent: false,
          description: 'supervises cabin groups\nplans evening activities\nsupports trail hikes',
        },
      ],
      education: [],
      skills: [],
      languages: [],
    };
    const r = runSummaryV2({ cv, locale: 'en', referenceDateIso: REF, candidate: '' });
    expect(r.blocked).toBe(false);
    expect(r.manifest.current?.employmentState).toBe('present');
    expect(r.manifest.priors[0]?.employmentState).toBe('completed');
    expect(r.text).toMatch(/where I lead rafting trips/);
    expect(r.text).toMatch(/where I supervised cabin groups/);
    expect(r.text).toMatch(/planned evening activities/);
    expect(r.text).toMatch(/supported trail hikes/);
    expect(r.text).not.toMatch(/where I supervise cabin/);
    expect(r.validation.currentDutyTenseOk).toBe(true);
    expect(r.validation.priorDutyTenseOk).toBe(true);

    // Wrong-tense provider must be repaired or rejected — never accepted as-is.
    const wrongTense = r.text
      .replace(/supervised cabin groups/i, 'supervise cabin groups')
      .replace(/planned evening activities/i, 'plan evening activities')
      .replace(/supported trail hikes/i, 'support trail hikes');
    const bad = runSummaryV2({
      cv,
      locale: 'en',
      referenceDateIso: REF,
      candidate: wrongTense,
    });
    expect(bad.blocked).toBe(false);
    expect(bad.text).toMatch(/supervised cabin groups/);
    expect(bad.validation.priorDutyTenseOk).toBe(true);
  });

  it('Enhance-existing uses same fact authority as Generate-from-empty', () => {
    const empty = solarLibraryCv({ summary: '' });
    const populated = solarLibraryCv({
      summary: 'Professional cook with warehouse experience at Atlas Logistics.',
    });
    const gen = runSummaryV2({
      cv: empty,
      locale: 'en',
      referenceDateIso: REF,
      candidate: '',
    });
    const enhance = runSummaryV2({
      cv: populated,
      locale: 'en',
      referenceDateIso: REF,
      candidate: 'I love cooking pasta at Atlas.',
    });
    expect(gen.manifest.snapshotHash).toBe(
      buildSummaryV2ManifestForCv({
        cv: populated,
        locale: 'en',
        referenceDateIso: REF,
      }).snapshotHash,
    );
    // Style hint may differ; required facts must match live Experience.
    expect(gen.validation.requiredCurrentFactCount).toBe(3);
    expect(enhance.validation.requiredCurrentFactCount).toBe(3);
    expect(enhance.text).toMatch(/SunGrid/i);
    expect(enhance.text).not.toMatch(/\bAtlas\b|cook|pasta/i);
    expect(enhance.countedAsSuccess).toBe(true);
  });

  it('replaced same entry IDs discard Atlas/Rewitu residue', () => {
    const cv = solarLibraryCv({
      currentId: 'atlas',
      priorId: 'rewitu',
      staleCanonical: true,
    });
    const snap = captureSummaryV2Snapshot({
      cv,
      locale: 'en',
      referenceDateIso: REF,
    });
    expect(snap.entries[0].facts.every((f) => !/incoming|warehouse/i.test(f.bulletText)))
      .toBe(true);
    const result = runSummaryV2({ cv, locale: 'en', referenceDateIso: REF });
    expect(result.text).toMatch(/SunGrid|City Library/i);
    expect(result.text).not.toMatch(/\bAtlas\b|\bRewitu\b|incoming goods/i);
    expect(result.validation.coveredCurrentFactCount).toBe(3);
    expect(result.validation.coveredPriorFactCount).toBe(3);
  });

  it('reordered and deleted entries preserve ownership / zero deleted facts', () => {
    const swapped = solarLibraryCv({ swapOrder: true });
    const m1 = buildSummaryV2ManifestForCv({
      cv: swapped,
      locale: 'en',
      referenceDateIso: REF,
    });
    expect(m1.current?.employer).toBe('SunGrid');
    expect(m1.priors[0]?.employer).toBe('City Library');

    const deletedPrior = solarLibraryCv();
    deletedPrior.experience = deletedPrior.experience!.filter((e) => e.isPresent);
    const m2 = buildSummaryV2ManifestForCv({
      cv: deletedPrior,
      locale: 'en',
      referenceDateIso: REF,
    });
    expect(m2.requiredPriorFacts.length).toBe(0);
    expect(m2.requiredCurrentFacts.length).toBe(3);
    const r = runSummaryV2({ cv: deletedPrior, locale: 'en', referenceDateIso: REF });
    expect(r.text).toMatch(/SunGrid/i);
    expect(r.text).not.toMatch(/City Library/i);
  });

  it('5+ Experience entries: bounded selection, no cross-entry leakage', () => {
    const extras: WorkExperience[] = [
      {
        id: 'e3',
        position: 'Cafe Host',
        company: 'Bean Bar',
        startDate: '2019-01',
        endDate: '2020-12',
        isPresent: false,
        description: 'Greets guests.\nManages reservations.\nPrepares opening checklists.',
      },
      {
        id: 'e4',
        position: 'Stock Clerk',
        company: 'MartCo',
        startDate: '2018-01',
        endDate: '2018-12',
        isPresent: false,
        description: 'Counts inventory.\nLabels shelves.\nReports shortages.',
      },
      {
        id: 'e5',
        position: 'Tutor',
        company: 'LearnLab',
        startDate: '2017-01',
        endDate: '2017-12',
        isPresent: false,
        description: 'Tutored algebra.\nPrepared worksheets.\nTracked student progress.',
      },
    ];
    const cv = solarLibraryCv({ extraEntries: extras });
    const m = buildSummaryV2ManifestForCv({ cv, locale: 'en', referenceDateIso: REF });
    expect(m.current?.employer).toBe('SunGrid');
    expect(m.priors.length).toBeLessThanOrEqual(2);
    expect(m.requiredCurrentFacts.length).toBe(3);
    const r = runSummaryV2({ cv, locale: 'en', referenceDateIso: REF });
    expect(r.text).toMatch(/SunGrid/i);
    // Current Solar duties must not be attributed to prior employers.
    expect(r.text).not.toMatch(/City Library[^.]*install solar panels/i);
    expect(r.validation.staleResidueDetected).toBe(false);
  });

  it('rejection preserves usage; invalid candidate does not apply', () => {
    const cv = solarLibraryCv();
    const before = getProAiUsageCount();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: { ...cv, summary: 'Keep me visible.' },
      candidate: 'I am a warehouse employee at Atlas with incoming goods expertise.',
      referenceDateIso: REF,
    });
    // Provider rejected → deterministic should still succeed for this fixture.
    expect(fin.blocked).toBe(false);
    expect(fin.text).not.toMatch(/Atlas|incoming goods/i);
    expect(getProAiUsageCount()).toBe(before);

    // Force failure by emptying Experience.
    const emptyCv = { ...cv, experience: [], summary: 'Keep me visible.' };
    const fail = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: emptyCv,
      candidate: '',
      referenceDateIso: REF,
    });
    expect(fail.blocked).toBe(true);
    expect(fail.text).toBe('Keep me visible.');
    expect(fail.countedAsSuccess).toBe(false);
    expect(getProAiUsageCount()).toBe(before);
  });

  it('all 12 locales: Generate succeeds with duration once and no Atlas residue', () => {
    const cv = solarLibraryCv();
    for (const locale of ALL_LOCALES) {
      const r = runSummaryV2({
        cv,
        locale,
        gender: 'female',
        referenceDateIso: REF,
        candidate: '',
      });
      expect(r.blocked, locale).toBe(false);
      expect(r.countedAsSuccess, locale).toBe(true);
      expect(r.text, locale).toMatch(/SunGrid/i);
      expect(r.text, locale).toMatch(/City Library/i);
      expect(r.text, locale).not.toMatch(/\bAtlas\b|\bRewitu\b/i);
      expect(r.validation.durationExpressionCount, locale).toBeGreaterThanOrEqual(1);
      expect(r.validation.coveredCurrentFactCount, locale).toBe(3);
      expect(r.validation.coveredPriorFactCount, locale).toBe(3);
    }
  });

  it('shadow comparison vs legacy for EN fixture (informational, not equality)', () => {
    const cv = solarLibraryCv();
    const shadow = compareSummaryV2AgainstLegacy({
      cv,
      locale: 'en',
      gender: 'female',
      referenceDateIso: REF,
    });
    expect(shadow.v2Ok).toBe(true);
    expect(shadow.v2RequiredCurrent).toBe(3);
    expect(shadow.v2CoveredCurrent).toBe(3);
    expect(shadow.v2RequiredPrior).toBe(3);
    expect(shadow.v2CoveredPrior).toBe(3);
    expect(shadow.v2Text).toMatch(/SunGrid/i);
    expect(shadow.legacyText.length).toBeGreaterThan(0);
    // V2 and legacy may differ; shadow only records both.
    expect(typeof shadow.textsEqual).toBe('boolean');
  });

  it('legacy path unchanged when V2 flag is off', () => {
    setSummaryV2EnabledForTests(false);
    const cv = solarLibraryCv();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: '',
      referenceDateIso: REF,
    });
    // Legacy engine still runs (may succeed via entry-owned 370 path).
    expect(fin.origin === 'deterministic_fallback' || fin.origin === 'ai_generated').toBe(true);
    expect(isSummaryV2Enabled()).toBe(false);
  });
});
