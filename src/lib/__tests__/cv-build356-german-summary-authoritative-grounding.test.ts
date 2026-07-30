/**
 * AAB-356 — German Summary Stronger: one authoritative entry-owned grounding
 * acceptance. Shared occupation-key material gate must not override complete
 * German/canonical/generic coverage (Atlas/Rewitu regression + universal matrix).
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
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildConciseGroundedSummary,
  validateSummaryMaterialFacts,
} from '@/lib/cv-summary-grounding';
import {
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
  detectGermanSummaryPerspective,
  SUMMARY_BUILDER_REVISION_DE,
} from '@/lib/cv-german-summary-grounding';
import { extractGermanCurrentWarehouseDutyFacts } from '@/lib/cv-german-summary-current-duty-coverage';
import {
  SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION,
  SUMMARY_MATERIAL_FACT_UNIVERSAL_356_REVISION,
  GERMAN_SUMMARY_AUTHORITATIVE_ACCEPT_356_REVISION,
  buildGermanAuthoritativeGroundingRecord,
  secondaryMaterialRejectionAllowed,
  isGermanStructuredSummaryDomain,
} from '@/lib/cv-summary-authoritative-grounding';
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
import { materialDutyKeysCoveredInLocalizedText } from '@/lib/cv-material-duty-coverage';
import type { CVData } from '@/lib/types';

const REF = '2026-07-20';
const EXPECTED_DE_HASH = 'fnv1a_d35ada3c_l548_b73_e46';

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

const WH_AR = [
  'تتحقق من البضائع الواردة؛',
  'تتحقق من الوثائق المتعلقة بالبضائع المستلمة؛',
  'تنسّق مع الزملاء بشأن إعداد البضائع وحركتها.',
].join('\n');

const GD_AR = [
  'أنشأت مواد بصرية وعناصر رسومية؛',
  'راجعت وطوّرت مواد التصميم؛',
  'أعدت ملفات التصميم النهائية لصيغ وشاشات مختلفة.',
].join('\n');

function seedUsage(count: number): void {
  persistProAiRecord({
    schemaVersion: AI_USAGE_SCHEMA_VERSION,
    count,
    windowStart: Date.now(),
    policyLimit: PRO_AI_SAFETY_CAP,
  });
}

function atlasRewituCv(options: {
  summary: string;
  contentLocale?: string;
  dutiesLocale?: 'en' | 'ar';
  jobTitle?: string;
  currentPosition?: string;
  priorPosition?: string;
}): CVData {
  const ar = options.dutiesLocale === 'ar';
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: options.jobTitle || (ar ? 'موظفة مستودع' : 'Warehouse Employee'),
      gender: 'female',
    },
    summary: options.summary,
    contentLocale: options.contentLocale || 'ar',
    summaryOrigin: 'ai_generated',
    experience: [
      {
        id: 'atlas',
        position: options.currentPosition || (ar ? 'موظفة مستودع' : 'Warehouse Employee'),
        company: 'Atlas',
        startDate: '2023-01',
        endDate: '',
        isPresent: true,
        description: ar ? WH_AR : WH_EN,
        canonicalDescription: ar ? WH_AR : WH_EN,
        descriptionOrigin: 'user',
        generatedLocale: ar ? 'ar' : 'en',
      },
      {
        id: 'rewitu',
        position: options.priorPosition || (ar ? 'مصممة جرافيك' : 'Graphic Designer'),
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: ar ? GD_AR : GD_EN,
        canonicalDescription: ar ? GD_AR : GD_EN,
        descriptionOrigin: 'user',
        generatedLocale: ar ? 'ar' : 'en',
      },
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

function germanHint(): string {
  return [
    'Ich verfüge über insgesamt etwa sechseinhalb Jahre Berufserfahrung.',
    'Derzeit arbeite ich bei Atlas als Lagermitarbeiterin, wo ich eingehende Waren prüfe,',
    'die zu den erhaltenen Waren gehörende Dokumentation kontrolliere und mich mit',
    'Kolleginnen und Kollegen bei der Vorbereitung und Bewegung der Waren abstimme.',
    'Zuvor arbeitete ich bei Rewitu als Grafikdesignerin, wo ich visuelle Materialien',
    'und grafische Elemente erstellte, Designmaterialien überprüfte und anpasste sowie',
    'finale Designdateien für verschiedene Formate und Bildschirme vorbereitete.',
  ].join(' ').replace(/\s+/g, ' ').trim();
}

describe('AAB-356 German authoritative grounding', () => {
  beforeEach(() => {
    seedUsage(27);
  });

  it('exposes AAB-356 authoritative grounding revisions', () => {
    expect(SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION).toBe(
      'summary-authoritative-grounding-356-v1',
    );
    expect(SUMMARY_MATERIAL_FACT_UNIVERSAL_356_REVISION).toBe(
      'summary-material-fact-universal-356-v1',
    );
    expect(GERMAN_SUMMARY_AUTHORITATIVE_ACCEPT_356_REVISION).toBe(
      'german-summary-authoritative-accept-356-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toEqual(expect.arrayContaining([
      SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION,
      SUMMARY_MATERIAL_FACT_UNIVERSAL_356_REVISION,
      GERMAN_SUMMARY_AUTHORITATIVE_ACCEPT_356_REVISION,
      SUMMARY_BUILDER_REVISION_DE,
    ]));
  });

  it('exact AAB-356: Arabic source → DE Stronger recovers deterministic German', () => {
    const empty = atlasRewituCv({ summary: '', dutiesLocale: 'en' });
    const factSet = buildCvCanonicalFactSet(empty, { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(empty.experience || [], REF);
    const sourceAr = buildConciseGroundedSummary(factSet, 'ar', 'female', durationSnapshot.total);
    expect(sourceAr.length).toBe(361);

    const cv = atlasRewituCv({ summary: sourceAr, dutiesLocale: 'en', contentLocale: 'ar' });
    const before = getProAiUsageCount();

    // Shared material gate alone used to emit summary_missing_material_fact on German.
    const withoutAuth = validateSummaryMaterialFacts(germanHint(), factSet, { locale: 'de' });
    expect(withoutAuth.every((v) => v.kind !== 'summary_missing_material_fact'
      || v.matched !== 'warehouse_facts_absent')).toBe(true);

    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourceAr,
      cv,
      requestedLocale: 'de',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });
    const d = fin.diagnostics || {};
    expect(fin.blocked).toBe(false);
    expect(fin.countedAsSuccess).toBe(true);
    expect(d.deterministicCandidatePresent).toBe(true);
    if (!summaryV2ModeActive()) {
      expect(d.deterministicCandidateHash).toBe(EXPECTED_DE_HASH);
      expect(d.deterministicCandidateNormalizedHash).toBe(EXPECTED_DE_HASH);
      expect(d.deterministicAccepted).toBe(true);
      expect(d.finalValidatedCandidateHash).toBe(EXPECTED_DE_HASH);
      expect(d.providerTypedRejectionReason || d.providerRejectionReason)
        .toMatch(/german_summary_foreign_script/);
      expect(d.coveredCurrentDutyFactCount).toBe(3);
      expect(d.requiredCurrentDutyFactCount).toBe(3);
      expect(d.coveredPriorDutyFactCount).toBe(3);
      expect(d.requiredPriorDutyFactCount).toBe(3);
      expect(d.finalDurationScopeValidationPassed).toBe(true);
      expect(d.finalDurationTotalCareerMarkerPresent).toBe(true);
      expect(fin.text).toMatch(/Dokumentation\s+kontrolliere|gehörende\s+Dokumentation/i);
    } else {
      expect(d.deterministicCandidateHash).toBeTruthy();
      expectProviderRejectedReason(
        d.providerTypedRejectionReason || d.providerRejectionReason,
        /german_summary_foreign_script/,
      );
      expectSummaryContractInvariants({
        text: fin.text,
        locale: 'de',
        cv,
        requirePrior: true,
      });
    }
    expect(d.clientFallbackUsed).toBe(true);
    expect(d.finalCandidateSource).toBe('deterministic_fallback');
    expect(d.finalTypedFailureReason).not.toBe('summary_missing_material_fact');
    expect(d.finalDurationOwnerExpected).toBe('total_professional_experience');
    expect(d.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(d.finalDurationCurrentRoleAttachmentRisk).toBe(false);
    expect(d.previousSummaryTextUsedByDeterministicFallback).toBeFalsy();
    expect(d.providerTextUsedByDeterministicFallback).toBeFalsy();
    expect(d.flattenedFactArrayUsed).toBeFalsy();
    expect(detectGermanSummaryPerspective(fin.text)).toBe('first_person');

    const session = new SummaryAiDiagnosticSession({
      requestId: 'aab356-exact',
      operationMode: 'stronger',
      rewriteStyle: 'stronger',
      requestedLocale: 'de',
      uiLocale: 'de',
      usageCountBefore: before,
    });
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, before, fin.text);
    session.patch({ usageCountAfter: before + 1 });
    const gate = session.evaluatePreApplyDecisionGates();
    if (!summaryV2ModeActive()) {
      expect(gate.passed).toBe(true);
    }

    applyFinalizedSummaryToCv(cv, 'de', fin);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(before + 1);
  });

  it('Arabic Experience duties still recover German 3/3 + 3/3', () => {
    const empty = atlasRewituCv({ summary: '', dutiesLocale: 'ar' });
    const factSet = buildCvCanonicalFactSet(empty, { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(empty.experience || [], REF);
    const sourceAr = buildConciseGroundedSummary(factSet, 'ar', 'female', durationSnapshot.total);
    const cv = atlasRewituCv({ summary: sourceAr, dutiesLocale: 'ar' });
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: WH_AR });
    expect(facts.map((f) => f.canonicalFactId)).toEqual([
      'incoming_goods_check',
      'related_documentation_check',
      'colleague_coordination_goods_preparation_movement',
    ]);
    const fin = finalizeCvAiFieldForApply({
      action: 'summary_stronger',
      field: 'summary',
      candidate: sourceAr,
      cv,
      requestedLocale: 'de',
      gender: 'female',
      referenceDateIso: REF,
      durationSnapshot,
      rewriteStyle: 'stronger',
      originHint: 'ai_repaired',
    });
    expect(fin.blocked).toBe(false);
    expect(fin.diagnostics?.coveredCurrentDutyFactCount).toBe(3);
    expect(fin.diagnostics?.coveredPriorDutyFactCount).toBe(3);
    if (!summaryV2ModeActive()) {
      if (!summaryV2ModeActive()) {
      expect(fin.diagnostics?.deterministicCandidateHash).toBe(EXPECTED_DE_HASH);
    } else {
      expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    }
    } else {
      expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    }
  });

  it('secondary occupation-key gate cannot override authoritative coverage', () => {
    const auth = buildGermanAuthoritativeGroundingRecord({
      groundingValidationPassed: true,
      slotValidationPassed: true,
      requiredCurrentDutyFactIds: [
        'incoming_goods_check',
        'related_documentation_check',
        'colleague_coordination_goods_preparation_movement',
      ],
      coveredCurrentDutyFactCount: 3,
      requiredCurrentDutyFactCount: 3,
      missingCurrentDutyFactCount: 0,
      requiredPriorDutyFactCount: 3,
      coveredPriorDutyFactCount: 3,
      missingPriorDutyFactCount: 0,
      unsupportedClaimCount: 0,
    });
    expect(auth.accepted).toBe(true);
    const secondary = secondaryMaterialRejectionAllowed({
      authoritative: auth,
      secondaryMissingFactIds: ['warehouse_inbound_check', 'warehouse_movement'],
    });
    expect(secondary.allowed).toBe(false);
    expect(secondary.exactMissingFactIds).toEqual([]);
  });

  it('localized material coverage accepts German warehouse prose', () => {
    const covered = materialDutyKeysCoveredInLocalizedText(
      ['warehouse_inbound_check', 'warehouse_movement'],
      germanHint(),
    );
    expect(covered.missing).toEqual([]);
    expect(covered.covered.length).toBeGreaterThanOrEqual(2);
  });

  it('German arbitrary free-text current role does not require warehouse material keys', () => {
    const duties = [
      'schedules weekly client onboarding calls;',
      'documents action items from stakeholder meetings;',
      'coordinates handoffs with the delivery team.',
    ].join('\n');
    const cv = {
      personal: {
        fullName: 'T',
        email: 't@e.com',
        phone: '',
        location: '',
        jobTitle: 'Client Onboarding Lead',
        gender: 'female',
      },
      summary: '',
      contentLocale: 'en',
      experience: [{
        id: 'cur',
        position: 'Client Onboarding Lead',
        company: 'Nimbus',
        startDate: '2022-01',
        endDate: '',
        isPresent: true,
        description: duties,
        canonicalDescription: duties,
        descriptionOrigin: 'user',
      }],
      education: [],
      skills: [],
      languages: [],
    } as CVData;
    expect(isGermanStructuredSummaryDomain(`${duties} Client Onboarding Lead`)).toBe(false);
    const factSet = buildCvCanonicalFactSet(cv, { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(cv.experience || [], REF);
    const text = buildGermanEntryOwnedSummary({
      role: 'Client Onboarding Lead',
      employer: 'Nimbus',
      datesValue: '2022-01 — Present',
      gender: 'female',
      duration: durationSnapshot.total,
      dutyFacts: factSet.facts.filter((f) => f.type === 'experience_bullet'),
      hasCurrentRole: true,
    });
    expect(text).toMatch(/Derzeit\s+arbeite\s+ich/i);
    expect(text).not.toMatch(/Waren|Lagermitarbeiter/i);
    const q = analyzeGermanSummaryEmploymentQuality(text, {
      company: 'Nimbus',
      role: 'Client Onboarding Lead',
      currentEntryDuties: duties,
      gender: 'female',
    });
    expect(q.requiredCurrentDutyFactCount || 0).toBe(0);
  });

  it('German current-only topology covers current facts without prior', () => {
    const dutyFacts = WH_EN.split('\n').map((value) => ({ value }));
    const text = buildGermanEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01 — Present',
      gender: 'female',
      duration: { totalMonths: 43, approxYears: 3.5, hasValidDates: true } as never,
      dutyFacts,
      hasCurrentRole: true,
    });
    expect(text).toMatch(/Derzeit\s+arbeite\s+ich\s+bei\s+Atlas/i);
    expect(text).not.toMatch(/Zuvor|Rewitu/i);
  });

  it('German completed-only topology emits prior without current Atlas', () => {
    const text = buildGermanEntryOwnedSummary({
      role: '',
      employer: '',
      datesValue: '',
      gender: 'female',
      duration: { totalMonths: 40, approxYears: 3.5, hasValidDates: true } as never,
      dutyFacts: [],
      hasCurrentRole: false,
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
    });
    expect(text).toMatch(/Zuvor\s+arbeitete\s+ich\s+bei\s+Rewitu/i);
    expect(text).not.toMatch(/Derzeit\s+arbeite\s+ich\s+bei\s+Atlas/i);
  });

  it('German multi-prior / large CV keeps entry ownership', () => {
    const extras = Array.from({ length: 4 }, (_, i) => ({
      role: `Operator ${i + 1}`,
      employer: `Firm${i + 1}`,
      duties: 'managed shift handovers;',
    }));
    const text = buildGermanEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01 — Present',
      gender: 'female',
      duration: { totalMonths: 120, approxYears: 10, hasValidDates: true } as never,
      dutyFacts: WH_EN.split('\n').map((value) => ({ value })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      additionalPriorEntries: extras,
      hasCurrentRole: true,
    });
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/Rewitu/);
    expect(text).toMatch(/eingehende\s+Waren/i);
  });

  it('mixed classified + unclassified duties stay grounded without invented keys', () => {
    const duties = [
      'checks incoming goods;',
      'supports afternoon loading bay logistics notes.',
    ].join('\n');
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: duties });
    expect(facts.some((f) => f.canonicalFactId === 'incoming_goods_check')).toBe(true);
    expect(facts.length).toBeLessThan(3);
  });

  it('all unclassified duties remain valid generic authority', () => {
    const duties = [
      'triaged overnight incident reports;',
      'wrote handoff summaries for next shift;',
      'escalated blockers to the floor lead.',
    ].join('\n');
    const facts = extractGermanCurrentWarehouseDutyFacts({ currentEntryDuties: duties });
    expect(facts).toEqual([]);
    expect(isGermanStructuredSummaryDomain(duties)).toBe(false);
  });

  it('genuinely missing duty rejects with exact fact identity', () => {
    const incomplete = [
      'Ich verfüge über insgesamt etwa sechseinhalb Jahre Berufserfahrung.',
      'Derzeit arbeite ich bei Atlas als Lagermitarbeiterin, wo ich eingehende Waren prüfe',
      'und mich mit Kollegen abstimme.',
      'Zuvor arbeitete ich bei Rewitu als Grafikdesignerin, wo ich visuelle Materialien',
      'und grafische Elemente erstellte, Designmaterialien überprüfte und anpasste sowie',
      'finale Designdateien für verschiedene Formate und Bildschirme vorbereitete.',
    ].join(' ');
    const q = analyzeGermanSummaryEmploymentQuality(incomplete, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      priorRole: 'Graphic Designer',
      gender: 'female',
    });
    expect(q.finalCurrentDutyCoveragePassed).toBe(false);
    expect(q.missingCurrentDutyFactCount || 0).toBeGreaterThan(0);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('genuinely missing prior duty rejects with coverage identity', () => {
    const incompletePrior = [
      'Ich verfüge über insgesamt etwa sechseinhalb Jahre Berufserfahrung.',
      'Derzeit arbeite ich bei Atlas als Lagermitarbeiterin, wo ich eingehende Waren prüfe,',
      'die zu den erhaltenen Waren gehörende Dokumentation kontrolliere und mich mit',
      'Kolleginnen und Kollegen bei der Vorbereitung und Bewegung der Waren abstimme.',
      'Zuvor arbeitete ich bei Rewitu als Grafikdesignerin.',
    ].join(' ');
    const q = analyzeGermanSummaryEmploymentQuality(incompletePrior, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      priorRole: 'Graphic Designer',
      gender: 'female',
    });
    expect(q.finalPriorDutyCoveragePassed).toBe(false);
    expect(q.missingPriorDutyFactCount || 0).toBeGreaterThan(0);
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('cross-entry employer leakage is rejected', () => {
    const leaked = [
      'Ich verfüge über insgesamt etwa sechseinhalb Jahre Berufserfahrung.',
      'Derzeit arbeite ich bei Rewitu als Lagermitarbeiterin, wo ich eingehende Waren prüfe,',
      'die zu den erhaltenen Waren gehörende Dokumentation kontrolliere und mich mit',
      'Kolleginnen und Kollegen bei der Vorbereitung und Bewegung der Waren abstimme.',
      'Zuvor arbeitete ich bei Atlas als Grafikdesignerin, wo ich visuelle Materialien',
      'und grafische Elemente erstellte, Designmaterialien überprüfte und anpasste sowie',
      'finale Designdateien für verschiedene Formate und Bildschirme vorbereitete.',
    ].join(' ');
    const q = analyzeGermanSummaryEmploymentQuality(leaked, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      priorRole: 'Graphic Designer',
      gender: 'female',
      currentEntryId: 'atlas',
      priorEntryId: 'rewitu',
    });
    expect(
      q.employerCrossEntryLeakageDetected === true
      || q.groundingValidationPassed === false
      || (q.slotRejectionReasons || []).some((r) => /leak|employer|role/i.test(r)),
    ).toBe(true);
  });

  it('authoritative record carries entry ownership and employment state', () => {
    const auth = buildGermanAuthoritativeGroundingRecord({
      groundingValidationPassed: true,
      slotValidationPassed: true,
      requiredCurrentDutyFactIds: [
        'incoming_goods_check',
        'related_documentation_check',
        'colleague_coordination_goods_preparation_movement',
      ],
      coveredCurrentDutyFactCount: 3,
      requiredCurrentDutyFactCount: 3,
      missingCurrentDutyFactCount: 0,
      requiredPriorDutyFactCount: 3,
      coveredPriorDutyFactCount: 3,
      missingPriorDutyFactCount: 0,
      unsupportedClaimCount: 0,
      currentEntryId: 'atlas',
      priorEntryId: 'rewitu',
      currentEmployer: 'Atlas',
      priorEmployer: 'Rewitu',
      currentRole: 'Warehouse Employee',
      priorRole: 'Graphic Designer',
      currentIsPresent: true,
      currentStartDate: '2023-01',
      currentEndDate: '',
      priorStartDate: '2020-01',
      priorEndDate: '2023-04',
      genericCurrentDutyEvidence: WH_EN.split('\n'),
    });
    expect(auth.accepted).toBe(true);
    expect(auth.factsByEntry[0]?.employmentState).toBe('present');
    expect(auth.factsByEntry[0]?.startDate).toBe('2023-01');
    expect(auth.factsByEntry[1]?.employmentState).toBe('completed');
    expect(auth.factsByEntry[1]?.endDate).toBe('2023-04');
    expect(auth.occupationMaterialKeysEnrichmentOnly).toBe(true);
  });

  it('unsupported added duty remains rejected', () => {
    const inflated = `${germanHint()} Außerdem erstellt sie Printmedien und Marketingmaterialien.`;
    const q = analyzeGermanSummaryEmploymentQuality(inflated, {
      company: 'Atlas',
      role: 'Warehouse Employee',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      priorCompany: 'Rewitu',
      priorRole: 'Graphic Designer',
      gender: 'female',
    });
    expect(
      q.unsupportedClaimCount > 0
      || q.unsupportedDesignMedium
      || q.groundingValidationPassed === false,
    ).toBe(true);
  });

  it('diagnostic invariants catch coverage-pass vs generic material reject', () => {
    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'de',
      groundingValidationPassed: true,
      durationValidationPassed: true,
      slotValidationPassed: true,
      targetLocalePurityPassed: true,
      requiredCurrentDutyFactCount: 3,
      coveredCurrentDutyFactCount: 3,
      missingCurrentDutyFactCount: 0,
      requiredPriorDutyFactCount: 3,
      coveredPriorDutyFactCount: 3,
      requiredCurrentDutyFactIds: [
        'incoming_goods_check',
        'related_documentation_check',
        'colleague_coordination_goods_preparation_movement',
      ],
      currentEntryMaterialKeys: ['warehouse_inbound_check', 'warehouse_movement'],
      finalTypedFailureReason: 'summary_missing_material_fact',
      typedFailureReason: 'summary_missing_material_fact',
      rejectionStage: 'summary_grounding',
      countedAsSuccess: false,
      deterministicCandidatePresent: true,
      deterministicCandidateHash: EXPECTED_DE_HASH,
      finalCandidateSource: 'none',
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0]);
    const codes = inv.failures.map((f) => f.invariantCode);
    expect(codes).toEqual(expect.arrayContaining([
      'authoritative_coverage_pass_but_generic_material_reject',
      'grounding_passed_but_rejected_at_summary_grounding',
      'material_reject_with_zero_missing_facts',
      'secondary_material_keys_diverge_from_authoritative_required_ids',
      'validators_passed_but_final_candidate_source_none',
    ]));
  });
});
