/**
 * AAB-355 — Arabic → German Professional Summary Stronger cross-locale recovery.
 * Shared requested-locale dispatch; first-person German from structured Experience.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
} from '@/lib/cv-ai-finalize-apply';
import {
  buildConciseGroundedSummary,
} from '@/lib/cv-summary-grounding';
import {
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
  detectGermanSummaryPerspective,
  isGermanThirdPersonBiographySummary,
  SUMMARY_BUILDER_REVISION_DE,
} from '@/lib/cv-german-summary-grounding';
import {
  resolveSummaryBuilderRevision,
  resolveSummaryTargetScript,
  detectSummaryPerspectiveForLocale,
  SUMMARY_REQUESTED_LOCALE_DISPATCH_355_REVISION,
  assertSummaryBuilderMatchesRequestedLocale,
} from '@/lib/cv-summary-locale-dispatch';
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
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';

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

function atlasRewituCv(summary: string, contentLocale: string = 'ar'): CVData {
  return {
    personal: {
      fullName: 'Test User',
      email: 't@example.com',
      phone: '',
      location: '',
      jobTitle: 'Warehouse Employee',
      gender: 'female',
    },
    summary,
    contentLocale,
    summaryOrigin: 'ai_generated',
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
        generatedLocale: 'en',
      },
      {
        id: 'rewitu',
        position: 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
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
  } as CVData;
}

function assertFirstPersonGerman(text: string): void {
  expect(detectGermanSummaryPerspective(text)).toBe('first_person');
  expect(isGermanThirdPersonBiographySummary(text)).toBe(false);
  expect(text).toMatch(/Ich\s+verfüge\s+über\s+insgesamt/i);
  expect(text).toMatch(/Derzeit\s+arbeite\s+ich\s+bei\s+Atlas\s+als\s+Lagermitarbeiterin/i);
  expect(text).toMatch(/eingehende\s+Waren\s+prüfe/i);
  expect(text).toMatch(/Dokumentation\s+kontrolliere|gehörende\s+Dokumentation/i);
  expect(text).toMatch(/Kolleg|abstimme/i);
  expect(text).toMatch(/Zuvor\s+arbeitete\s+ich\s+bei\s+Rewitu\s+als\s+Grafikdesignerin/i);
  expect(text).toMatch(/grafische\s+Elemente/i);
  expect(text).toMatch(/Bildschirme/i);
  expect(text).not.toMatch(/verfügt\s+sie|war\s+sie\s+als/i);
  expect(text).not.toMatch(/[\u0600-\u06FF\u0900-\u097F]/);
}

describe('AAB-355 Arabic→German Summary Stronger', () => {
  beforeEach(() => {
    seedUsage(27);
  });

  it('exposes German 355 builder + shared locale dispatch revisions', () => {
    expect(SUMMARY_BUILDER_REVISION_DE).toBe('entry-owned-german-rebuild-355-v1');
    expect(SUMMARY_REQUESTED_LOCALE_DISPATCH_355_REVISION).toBe(
      'summary-requested-locale-dispatch-355-v1',
    );
    expect(resolveSummaryBuilderRevision('de')).toBe(SUMMARY_BUILDER_REVISION_DE);
    expect(resolveSummaryTargetScript('de')).toBe('latin');
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'de',
      'live-hindi-material-rebuild-v3',
    )).toBe('german_request_routed_to_hindi_builder');
  });

  it('source Arabic Summary is the validated 361-character form', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const duration = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const ar = buildConciseGroundedSummary(factSet, 'ar', 'female', duration.total);
    expect(ar.length).toBe(361);
    expect(fingerprintText(ar)).toBe('fnv1a_4e028439_l361_b1604_e46');
  });

  it('builder emits first-person German from structured Experience (not Arabic)', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Lagermitarbeiterin',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'rund sechseinhalb Jahre',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      locale: 'de',
    });
    assertFirstPersonGerman(text);
  });

  it('exact Stronger path: Arabic provider echo → German deterministic apply + usage 27→28', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    expect(durationSnapshot.total.totalMonths).toBe(78);
    const sourceAr = buildConciseGroundedSummary(factSet, 'ar', 'female', durationSnapshot.total);
    expect(sourceAr.length).toBe(361);
    const cv = atlasRewituCv(sourceAr, 'ar');
    expect(getProAiUsageCount()).toBe(27);

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
    expect(fin.countedAsSuccess).toBe(true);
    assertFirstPersonGerman(fin.text);
    expect(fin.diagnostics?.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_DE);
    expect(fin.diagnostics?.summaryBuilderRevision).not.toMatch(/hindi|arabic/i);
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
    expect(fin.diagnostics?.totalDurationSlotPresent
      ?? fin.diagnostics?.finalTotalDurationSlotPresent).toBe(true);
    expect(fin.diagnostics?.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(fin.diagnostics?.finalDurationScopeValidationPassed).toBe(true);
    expect(fin.diagnostics?.finalDurationCurrentRoleAttachmentRisk).toBe(false);
    expect(fin.diagnostics?.providerAccepted).toBe(false);
    expect(fin.diagnostics?.providerTypedRejectionReason
      || fin.diagnostics?.providerRejectionReason).toBe('german_summary_foreign_script');
    expect(fin.origin).toBe('deterministic_fallback');
    expect(fin.diagnostics?.finalCandidateSource).toBe('deterministic_fallback');
    expect(fin.diagnostics?.deterministicCandidatePresent).toBe(true);
    expect(fin.diagnostics?.deterministicCandidateHash).toBeTruthy();
    expect(fin.diagnostics?.deterministicCandidateNormalizedHash).toBeTruthy();
    expect(fin.diagnostics?.deterministicCandidateHash).toBe(
      fin.diagnostics?.finalValidatedCandidateHash,
    );
    expect(fin.diagnostics?.clientFallbackUsed).toBe(true);
    expect(fin.diagnostics?.fallbackApplied).toBe(true);
    expect(fin.diagnostics?.targetLocalePurityPassed).toBe(true);
    expect(fin.diagnostics?.sourceLanguageLeakageDetected).toBe(false);

    const session = new SummaryAiDiagnosticSession({
      uiLocale: 'de',
      requestedLocale: 'de',
      contentLocale: 'ar',
      gender: 'female',
      usageCountBefore: 27,
      operationMode: 'enhance_existing_content',
      rewriteStyle: 'stronger',
    });
    session.recordCvSnapshot(cv, sourceAr);
    session.recordFinalizeResult(fin);
    expect(session.draft.targetScript).toBe('latin');
    expect(session.draft.summaryBuilderRevision).toBe(SUMMARY_BUILDER_REVISION_DE);
    expect(session.draft.detectedLocaleByUnit).toEqual(['de', 'de', 'de']);
    expect(session.draft.detectedScriptByUnit).toEqual(['latin', 'latin', 'latin']);
    expect(session.draft.wrongLocaleUnitCount).toBe(0);
    expect(session.draft.wrongScriptUnitCount).toBe(0);
    expect(session.draft.sourceLanguageLeakageDetected).toBe(false);
    expect(session.draft.targetLocalePurityPassed).toBe(true);
    const pre = session.evaluatePreApplyDecisionGates();
    expect(pre.passed, JSON.stringify(pre)).toBe(true);
    const next = applyFinalizedSummaryToCv(cv, 'de', fin);
    expect(next.summary).toBe(fin.text);
    session.recordVisibleApply(true, 28, fin.text);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(28);
    const trace = session.commit();
    expect(trace.visibleApplySucceeded).toBe(true);
    expect(trace.visibleCandidateHashAfterApply).toBe(fin.diagnostics?.finalValidatedCandidateHash);
    expect(trace.visibleSummaryMatchesFinalHash).toBe(true);
    const inv = checkSummaryDiagnosticInvariants(trace as Parameters<typeof checkSummaryDiagnosticInvariants>[0]);
    expect(inv.passed, JSON.stringify(inv.failures)).toBe(true);
  });

  it('rejects unchanged Arabic provider and recovers without empty_summary', () => {
    const factSet = buildCvCanonicalFactSet(atlasRewituCv(''), { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(
      atlasRewituCv('').experience || [],
      REF,
    );
    const sourceAr = buildConciseGroundedSummary(factSet, 'ar', 'female', durationSnapshot.total);
    const cv = atlasRewituCv(sourceAr);
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
    });
    expect(fingerprintText(sourceAr)).toBe(fingerprintText(sourceAr));
    expect(fin.diagnostics?.providerCandidateHash).toBe(fingerprintText(sourceAr));
    expect(fin.blocked).toBe(false);
    expect(fin.reason).not.toBe('empty_summary');
    expect(fin.text.trim().length).toBeGreaterThan(0);
  });

  it('rejects neutral_cv German final Summary', () => {
    const third = [
      'Lagermitarbeiterin bei Atlas seit Januar 2023 mit Erfahrung in der Prüfung',
      'eingehender Waren und der Prüfung der zugehörigen Dokumentation sowie in der',
      'Abstimmung mit Kolleginnen und Kollegen bei der Vorbereitung und Bewegung von Waren.',
      'Zuvor war sie als Grafikdesignerin bei Rewitu tätig und erstellte visuelle Materialien',
      'und grafische Elemente, überarbeitete Designunterlagen und bereitete finale Dateien',
      'für verschiedene Formate und Bildschirme vor.',
      'Insgesamt verfügt sie über etwa sechseinhalb Jahre Berufserfahrung.',
    ].join(' ');
    const q = analyzeGermanSummaryEmploymentQuality(third, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      startDate: '2023-01',
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
      expectedDurationOwner: 'total_professional_experience',
    });
    expect(q.perspectiveMode).toBe('neutral_cv');
    expect(q.perspectiveValidationPassed).toBe(false);
    expect(q.ok).toBe(false);
  });
});

describe('AAB-355 shared cross-locale Summary routing matrix', () => {
  const cases: Array<{
    name: string;
    sourceLocale: string;
    target: Locale;
    expectedScript: string;
    builderIncludes: RegExp;
  }> = [
    { name: 'ar→de', sourceLocale: 'ar', target: 'de', expectedScript: 'latin', builderIncludes: /german/i },
    { name: 'hi→de', sourceLocale: 'hi', target: 'de', expectedScript: 'latin', builderIncludes: /german/i },
    { name: 'sr→de', sourceLocale: 'sr', target: 'de', expectedScript: 'latin', builderIncludes: /german/i },
    { name: 'de→fr', sourceLocale: 'de', target: 'fr', expectedScript: 'latin', builderIncludes: /french/i },
    { name: 'ar→it', sourceLocale: 'ar', target: 'it', expectedScript: 'latin', builderIncludes: /italian-rebuild-359|entry-owned-italian/i },
    { name: 'hi→pt-BR', sourceLocale: 'hi', target: 'pt-BR' as Locale, expectedScript: 'latin', builderIncludes: /ptbr-rebuild-361|entry-owned-ptbr/i },
    { name: 'ar→ru', sourceLocale: 'ar', target: 'ru', expectedScript: 'cyrillic', builderIncludes: /russian/i },
    { name: 'en→ja', sourceLocale: 'en', target: 'ja', expectedScript: 'cjk', builderIncludes: /japanese/i },
  ];

  it.each(cases)('$name: builder+script from requested locale only', ({ sourceLocale, target, expectedScript, builderIncludes }) => {
    void sourceLocale;
    const rev = resolveSummaryBuilderRevision(target);
    expect(rev).toMatch(builderIncludes);
    expect(rev).not.toBe('live-hindi-material-rebuild-v3');
    expect(resolveSummaryTargetScript(target)).toBe(expectedScript);
    if (target === 'de') {
      expect(assertSummaryBuilderMatchesRequestedLocale('de', rev)).toBeNull();
    }
  });

  it('de request never selects Hindi builder revision', () => {
    expect(resolveSummaryBuilderRevision('de')).toBe(SUMMARY_BUILDER_REVISION_DE);
    expect(assertSummaryBuilderMatchesRequestedLocale(
      'de',
      resolveSummaryBuilderRevision('hi'),
    )).toBeTruthy();
  });

  it('perspective dispatch uses requested locale (not Hindi fallthrough)', () => {
    expect(detectSummaryPerspectiveForLocale(
      'Ich verfüge über insgesamt rund sechseinhalb Jahre Berufserfahrung.',
      'de',
    )).toBe('first_person');
    expect(detectSummaryPerspectiveForLocale(
      'Lagermitarbeiterin bei Atlas seit Januar 2023.',
      'de',
    )).toBe('neutral_cv');
  });

  it('arbitrary free-text occupation builds first-person German without inventing tools', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Solar Panel Technician',
      employer: 'HelioCo',
      datesValue: '2022-06',
      gender: 'female',
      durationPhrase: 'etwa zwei Jahre',
      dutyFacts: [
        { value: 'installs rooftop panels', sourceText: 'installs rooftop panels' },
        { value: 'tests electrical connections', sourceText: 'tests electrical connections' },
      ],
      locale: 'de',
    });
    expect(text).toMatch(/Ich\s+verfüge|Derzeit\s+arbeite\s+ich/i);
    expect(text).toMatch(/HelioCo/);
    expect(text).not.toMatch(/SAP|Six Sigma|ISO\s*9001/i);
    expect(text).not.toMatch(/Atlas|Rewitu|Lagermitarbeiter/i);
  });

  it('current-only CV emits duration + current without prior Rewitu', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Baker',
      employer: 'Ztrew',
      datesValue: '2024-01',
      gender: 'female',
      durationPhrase: 'etwa ein Jahr',
      dutyFacts: [
        { value: 'Preparing dishes according to restaurant standards', sourceText: 'Preparing dishes according to restaurant standards' },
        { value: 'Maintaining workplace hygiene', sourceText: 'Maintaining workplace hygiene' },
        { value: 'Collaborating with the kitchen team', sourceText: 'Collaborating with the kitchen team' },
      ],
      locale: 'de',
    });
    expect(text).toMatch(/Derzeit\s+arbeite\s+ich\s+bei\s+Ztrew/i);
    expect(text).not.toMatch(/Zuvor|Rewitu|Grafik/i);
  });

  it('completed-only CV emits prior without current Atlas', () => {
    const text = buildGermanEntryOwnedSummary({
      role: '',
      employer: '',
      datesValue: '',
      gender: 'female',
      durationPhrase: 'etwa drei Jahre',
      dutyFacts: [],
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      hasCurrentRole: false,
      locale: 'de',
    });
    expect(text).toMatch(/Zuvor\s+arbeitete\s+ich\s+bei\s+Rewitu/i);
    expect(text).not.toMatch(/Derzeit\s+arbeite\s+ich\s+bei\s+Atlas/i);
  });

  it('large CV with five+ entries keeps current + one selected prior', () => {
    const text = buildGermanEntryOwnedSummary({
      role: 'Warehouse Employee',
      employer: 'Atlas',
      datesValue: '2023-01',
      gender: 'female',
      durationPhrase: 'rund sechseinhalb Jahre',
      dutyFacts: WH_EN.split('\n').map((v) => ({ value: v, sourceText: v })),
      priorRole: 'Graphic Designer',
      priorEmployer: 'Rewitu',
      priorSourceDuties: GD_EN,
      additionalPriorEntries: [
        { role: 'Cashier', employer: 'ShopA', duties: 'handled payments' },
        { role: 'Driver', employer: 'FleetB', duties: 'delivered parcels' },
        { role: 'Clerk', employer: 'OfficeC', duties: 'filed documents' },
      ],
      locale: 'de',
    });
    expect(text).toMatch(/Atlas/);
    expect(text).toMatch(/Rewitu/);
    expect(text).not.toMatch(/ShopA|FleetB|OfficeC/);
    assertFirstPersonGerman(text);
  });
});
