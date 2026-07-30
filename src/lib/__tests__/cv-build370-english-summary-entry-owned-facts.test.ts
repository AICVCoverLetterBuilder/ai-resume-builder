/**
 * AAB-370 — English Summary: entry-owned facts from live Experience bullets.
 * Arbitrary occupations (Solar/Library), stale Atlas/Rewitu discard, 3/3+3/3.
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
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  analyzeEnglishSummaryEmploymentQuality,
  buildEnglishEntryOwnedSummary,
  extractEnglishEntryOwnedDutyFacts,
  isEnglishEntryOwnedSummaryPath,
  isEnglishLegacyWarehouseFactIdentity,
  resolveEnglishSummaryEntryDuties,
  ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION,
} from '@/lib/cv-english-summary-grounding';
import { buildConciseGroundedSummary } from '@/lib/cv-summary-grounding';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { countSummaryDurationExpressions } from '@/lib/cv-summary-duration-ownership';
import type { CVData, WorkExperience } from '@/lib/types';

const REF = '2025-07-01';

const SOLAR_DUTIES = [
  'Installs solar panels as part of assigned installation work.',
  'Positions and secures panels during installation.',
  'Coordinates installation activities with colleagues.',
].join('\n');

const LIBRARY_DUTIES = [
  'Assists patrons with locating library materials.',
  'Shelves and organizes returned books and media.',
  'Maintains quiet study areas and circulation records.',
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

const NEBULA_DUTIES = [
  'Orchestrates nebula workflow handoffs across pods.',
  'Audits opaque relay packets for delivery integrity.',
  'Aligns cross-team escalation paths for incident closure.',
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
}): CVData {
  const current: WorkExperience = {
    id: options?.currentId || 'atlas',
    position: 'Solar Panel Installer',
    company: 'SunGrid',
    startDate: '2023-01',
    endDate: '',
    isPresent: true,
    description: SOLAR_DUTIES,
    canonicalDescription: SOLAR_DUTIES,
    descriptionOrigin: 'user',
    generatedLocale: 'en',
  };
  const prior: WorkExperience = {
    id: options?.priorId || 'rewitu',
    position: 'Library Assistant',
    company: 'City Library',
    startDate: '2020-01',
    endDate: '2022-12',
    isPresent: false,
    description: LIBRARY_DUTIES,
    canonicalDescription: LIBRARY_DUTIES,
    descriptionOrigin: 'user',
    generatedLocale: 'en',
  };
  const experience = options?.swapOrder
    ? [prior, current, ...(options?.extraEntries || [])]
    : [current, prior, ...(options?.extraEntries || [])];
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Solar Panel Installer',
      gender: 'female',
    },
    summary: options?.summary ?? '',
    contentLocale: 'en',
    experience,
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

function atlasRewituCv(): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary: '',
    contentLocale: 'en',
    experience: [
      {
        id: 'atlas',
        position: 'Warehouse Employee',
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: WH_EN,
        canonicalDescription: WH_EN,
        descriptionOrigin: 'user',
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
      },
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

describe('AAB-370 English Summary entry-owned facts', () => {
  beforeEach(() => {
    seedUsage(8);
  });

  it('marker reachable', () => {
    expect(ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION)
      .toBe('english-summary-entry-owned-facts-370-v1');
    expect(SUMMARY_RUNTIME_MARKER_SET).toContain(ENGLISH_SUMMARY_ENTRY_OWNED_FACTS_370_REVISION);
  });

  it('exact Solar/Library fixture: 3/3 current + 3/3 prior, duration once, intros present', () => {
    const cv = solarLibraryCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    expect(duration.total?.totalMonths).toBe(66);

    const facts = extractEnglishEntryOwnedDutyFacts({
      entryDuties: SOLAR_DUTIES,
      role: 'Solar Panel Installer',
      entryId: 'atlas',
    });
    expect(facts).toHaveLength(3);
    expect(facts.every((f) => f.kind === 'generic_entry_owned')).toBe(true);
    expect(facts.some((f) => isEnglishLegacyWarehouseFactIdentity(f.factId))).toBe(false);

    const factSet = buildCvCanonicalFactSet(cv, { referenceDate: REF });
    const text = buildConciseGroundedSummary(factSet, 'en', 'female', duration.total);
    expect(text).toMatch(/SunGrid/i);
    expect(text).toMatch(/solar panel installer/i);
    expect(text).toMatch(/currently working/i);
    expect(text).toMatch(/City Library/i);
    expect(text).toMatch(/library assistant/i);
    expect(text).toMatch(/Previously/i);
    expect(text).toMatch(/solar panels/i);
    expect(text).toMatch(/panels/i);
    expect(text).toMatch(/installation/i);
    expect(text).toMatch(/patrons|library materials/i);
    expect(text).toMatch(/books|shelve/i);
    expect(text).toMatch(/circulation|study areas/i);
    expect(text).not.toMatch(/\bAtlas\b/i);
    expect(text).not.toMatch(/\bRewitu\b/i);
    expect(text).not.toMatch(/incoming goods|warehouse/i);
    expect(countSummaryDurationExpressions(text, 'en')).toBe(1);

    const q = analyzeEnglishSummaryEmploymentQuality(text, {
      company: 'SunGrid',
      role: 'Solar Panel Installer',
      priorCompany: 'City Library',
      priorRole: 'Library Assistant',
      currentEntryDuties: SOLAR_DUTIES,
      priorEntryDuties: LIBRARY_DUTIES,
      currentEntryId: 'atlas',
      priorEntryId: 'rewitu',
      gender: 'female',
    });
    expect(q.requiredCurrentDutyFactCount).toBe(3);
    expect(q.coveredCurrentDutyFactCount).toBe(3);
    expect(q.requiredPriorDutyFactCount).toBe(3);
    expect(q.coveredPriorDutyFactCount).toBe(3);
    expect(q.requiredCurrentDutyFactIds.every((id) => !isEnglishLegacyWarehouseFactIdentity(id)))
      .toBe(true);
    expect(q.ok).toBe(true);
    expect(q.finalCurrentEmploymentStateExpressed).toBe(true);
    expect(q.finalPriorEmploymentStateExpressed).toBe(true);
  });

  it('Atlas→Solar same entry IDs: zero stale warehouse fact hashes; coverage 3/3+3/3', () => {
    const resolved = resolveEnglishSummaryEntryDuties({
      role: 'Solar Panel Installer',
      liveDescription: SOLAR_DUTIES,
      groundedDescription: WH_EN,
    });
    expect(resolved).toBe(SOLAR_DUTIES);
    expect(resolved).not.toMatch(/incoming goods/i);

    const cv = solarLibraryCv();
    cv.experience![0] = {
      ...cv.experience![0],
      id: 'atlas',
      position: 'Solar Panel Installer',
      company: 'SunGrid',
      description: SOLAR_DUTIES,
      canonicalDescription: WH_EN,
      originalUserDescription: WH_EN,
    };
    cv.experience![1] = {
      ...cv.experience![1],
      id: 'rewitu',
      position: 'Library Assistant',
      company: 'City Library',
      description: LIBRARY_DUTIES,
      canonicalDescription: GD_EN,
      originalUserDescription: GD_EN,
    };

    const facts = extractEnglishEntryOwnedDutyFacts({
      entryDuties: resolveEnglishSummaryEntryDuties({
        role: 'Solar Panel Installer',
        liveDescription: SOLAR_DUTIES,
        groundedDescription: WH_EN,
      }),
      role: 'Solar Panel Installer',
      entryId: 'atlas',
    });
    expect(facts).toHaveLength(3);
    expect(facts.every((f) => !isEnglishLegacyWarehouseFactIdentity(f.factId))).toBe(true);
    expect(facts.every((f) => !isEnglishLegacyWarehouseFactIdentity(f.sourceFactHash))).toBe(true);

    seedUsage(8);
    const before = getProAiUsageCount();
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: '',
    });
    expect(fin.countedAsSuccess).toBe(true);
    expect(fin.blocked).toBe(false);
    const text = fin.text || '';
    expect(text).toMatch(/SunGrid/i);
    expect(text).toMatch(/City Library/i);
    expect(text).not.toMatch(/\bAtlas\b|\bRewitu\b|incoming goods|warehouse employee/i);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.missingCurrentDutyFactCount).toBe(0);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    expect(fin.diagnostics?.missingPriorDutyFactCount).toBe(0);
    const ids = fin.diagnostics?.requiredCurrentDutyFactIds || [];
    expect(ids.some(isEnglishLegacyWarehouseFactIdentity)).toBe(false);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(before + 1);
  });

  it('arbitrary free-text / unknown occupation uses entry-owned path', () => {
    expect(isEnglishEntryOwnedSummaryPath({
      currentDuties: NEBULA_DUTIES,
      priorDuties: LIBRARY_DUTIES,
      currentRole: 'Nebula Ops Liaison',
      priorRole: 'Library Assistant',
    })).toBe(true);

    // Serbian Latin duties must not activate the EN entry-owned gate (sr→en).
    expect(isEnglishEntryOwnedSummaryPath({
      currentDuties: [
        'Razvoj i implementacija internih procesa',
        'Planiranje i koordinacija aktivnosti odeljenja',
        'Analiza poslovnih podataka i priprema izvestaja',
      ].join('\n'),
      currentRole: 'Operater u proizvodnji',
    })).toBe(false);

    // Role/duty conflict keeps the neutral Professional fidelity path.
    expect(isEnglishEntryOwnedSummaryPath({
      currentDuties: [
        'Transport, load and safely deliver goods within warehouse operations.',
        'Work on the development and implementation of internal processes.',
        'Collaborate with cross-functional teams on project execution.',
      ].join('\n'),
      currentRole: 'Kuvar',
      roleDutyConflict: true,
    })).toBe(false);

    const text = buildEnglishEntryOwnedSummary({
      role: 'Nebula Ops Liaison',
      employer: 'Orbit Desk',
      datesValue: 'x',
      durationPhrase: 'approximately four years',
      dutyFacts: NEBULA_DUTIES.split('\n').map((s) => ({ value: s, sourceText: s })),
      priorRole: 'Library Assistant',
      priorEmployer: 'City Library',
      priorSourceDuties: LIBRARY_DUTIES,
    });
    expect(text).toMatch(/Orbit Desk/i);
    expect(text).toMatch(/nebula/i);
    expect(text).toMatch(/City Library/i);
    expect(text).not.toMatch(/incoming goods|Atlas|Rewitu/i);
    const q = analyzeEnglishSummaryEmploymentQuality(text, {
      company: 'Orbit Desk',
      role: 'Nebula Ops Liaison',
      priorCompany: 'City Library',
      priorRole: 'Library Assistant',
      currentEntryDuties: NEBULA_DUTIES,
      priorEntryDuties: LIBRARY_DUTIES,
    });
    expect(q.requiredCurrentDutyFactCount).toBe(3);
    expect(q.coveredCurrentDutyFactCount).toBe(3);
    expect(q.ok).toBe(true);
  });

  it('5+ Experience entries: current+prior only; deleted jobs contribute zero facts', () => {
    const extras: WorkExperience[] = [
      {
        id: 'old-atlas',
        position: 'Warehouse Employee',
        company: 'Atlas',
        startDate: '2016-01',
        endDate: '2017-12',
        isPresent: false,
        description: WH_EN,
        canonicalDescription: WH_EN,
      },
      {
        id: 'old-rewitu',
        position: 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2018-01',
        endDate: '2019-06',
        isPresent: false,
        description: GD_EN,
        canonicalDescription: GD_EN,
      },
      {
        id: 'ghost',
        position: 'Deleted Role',
        company: 'Gone Co',
        startDate: '2015-01',
        endDate: '2015-06',
        isPresent: false,
        description: 'Handled phantom warehouse inbound checks.',
        canonicalDescription: 'Handled phantom warehouse inbound checks.',
      },
    ];
    const cv = solarLibraryCv({ extraEntries: extras });
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const factSet = buildCvCanonicalFactSet(cv, { referenceDate: REF });
    const text = buildConciseGroundedSummary(factSet, 'en', 'female', duration.total);
    expect(text).toMatch(/SunGrid/i);
    expect(text).toMatch(/City Library/i);
    expect(text).not.toMatch(/\bAtlas\b|\bRewitu\b|Gone Co|phantom warehouse/i);
  });

  it('current/completed ordering: completed-first list still emits current then prior', () => {
    const cv = solarLibraryCv({ swapOrder: true });
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const factSet = buildCvCanonicalFactSet(cv, { referenceDate: REF });
    const text = buildConciseGroundedSummary(factSet, 'en', 'female', duration.total);
    const currentIdx = text.search(/currently working at SunGrid/i);
    const priorIdx = text.search(/Previously.*City Library/i);
    expect(currentIdx).toBeGreaterThanOrEqual(0);
    expect(priorIdx).toBeGreaterThan(currentIdx);
  });

  it('valid apply increments usage once; rejection remains unchanged', () => {
    seedUsage(8);
    const cv = solarLibraryCv();
    const beforeOk = getProAiUsageCount();
    const ok = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv,
      candidate: '',
    });
    expect(ok.countedAsSuccess).toBe(true);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(beforeOk + 1);

    seedUsage(8);
    const emptyCv = {
      ...solarLibraryCv({ summary: '' }),
      experience: [] as WorkExperience[],
    };
    const reject = finalizeCvAiFieldForApply({
      action: 'summary_generate',
      field: 'summary',
      requestedLocale: 'en',
      gender: 'female',
      cv: emptyCv,
      candidate: 'Overall, with approximately five years of professional experience.',
    });
    expect(reject.countedAsSuccess).toBe(false);
    expect(getProAiUsageCount()).toBe(8);
  });

  it('Atlas/Rewitu warehouse fixture remains valid (no regression)', () => {
    const cv = atlasRewituCv();
    const duration = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const factSet = buildCvCanonicalFactSet(cv, { referenceDate: REF });
    const text = buildConciseGroundedSummary(factSet, 'en', 'female', duration.total);
    expect(text).toMatch(/Atlas/i);
    expect(text).toMatch(/Rewitu/i);
    expect(text).toMatch(/incoming goods/i);
    const q = analyzeEnglishSummaryEmploymentQuality(text, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      priorCompany: 'Rewitu',
      priorRole: 'Graphic Designer',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      currentEntryId: 'atlas',
    });
    expect(q.requiredCurrentDutyFactCount).toBe(3);
    expect(q.coveredCurrentDutyFactCount).toBe(3);
    expect(q.ok).toBe(true);
  });
});
