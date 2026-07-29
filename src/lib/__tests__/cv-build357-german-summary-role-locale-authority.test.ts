/**
 * AAB-357 — German Summary target-locale role authority.
 * Raw FR Employée d’entrepôt must not reject a correct Lagermitarbeiterin candidate.
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  finalizeCvAiFieldForApply,
  applyFinalizedSummaryToCv,
  SUMMARY_RUNTIME_MARKER_SET,
} from '@/lib/cv-ai-finalize-apply';
import { buildConciseGroundedSummary } from '@/lib/cv-summary-grounding';
import { buildCvCanonicalFactSet } from '@/lib/cv-canonical-facts';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  analyzeGermanSummaryEmploymentQuality,
  detectGermanSummaryPerspective,
} from '@/lib/cv-german-summary-grounding';
import {
  validateSummaryStructuredRoleLocale,
  resolveLocalizedSummaryRole,
} from '@/lib/cv-summary-structured-role-localization';
import {
  SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION,
  SUMMARY_ROLE_LOCALE_ACCEPTANCE_357_REVISION,
  GERMAN_SUMMARY_ROLE_LOCALE_AUTHORITY_357_REVISION,
  buildSummaryTargetRoleAuthority,
  candidateMatchesTargetRoleAuthority,
} from '@/lib/cv-summary-target-role-authority';
import {
  getProAiUsageCount,
  persistProAiRecord,
  recordProAiUserActionSuccess,
  AI_USAGE_SCHEMA_VERSION,
  PRO_AI_SAFETY_CAP,
} from '@/lib/ai-usage-policy';
import { SummaryAiDiagnosticSession } from '@/lib/cv-summary-ai-diagnostics';
import { checkSummaryDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import { matchesWarehouseOccupationalTitle } from '@/lib/cv-role-title';
import type { CVData } from '@/lib/types';

const REF = '2026-07-20';
const EXPECTED_DE_HASH = 'fnv1a_d35ada3c_l548_b73_e46';
const FR_WAREHOUSE = "Employée d'entrepôt";
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

function atlasRewituCv(options: {
  summary: string;
  currentPosition?: string;
  priorPosition?: string;
  dutiesLocale?: 'en' | 'ar';
  extraEntries?: Array<{ id: string; position: string; company: string; present?: boolean }>;
}): CVData {
  const ar = options.dutiesLocale === 'ar';
  const extras = (options.extraEntries || []).map((e) => ({
    id: e.id,
    position: e.position,
    company: e.company,
    startDate: '2015-01',
    endDate: e.present ? '' : '2018-01',
    isPresent: Boolean(e.present),
    description: 'supported routine operations;',
    canonicalDescription: 'supported routine operations;',
    descriptionOrigin: 'user' as const,
  }));
  return {
    personal: {
      fullName: 'Sara Test',
      email: 's@e.com',
      phone: '',
      location: '',
      jobTitle: options.currentPosition || FR_WAREHOUSE,
      gender: 'female',
    },
    summary: options.summary,
    contentLocale: 'ar',
    experience: [
      {
        id: 'atlas',
        position: options.currentPosition || FR_WAREHOUSE,
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
        position: options.priorPosition || 'Graphic Designer',
        company: 'Rewitu',
        startDate: '2020-01',
        endDate: '2023-04',
        isPresent: false,
        description: ar ? GD_AR : GD_EN,
        canonicalDescription: ar ? GD_AR : GD_EN,
        descriptionOrigin: 'user',
        generatedLocale: ar ? 'ar' : 'en',
      },
      ...extras,
    ],
    education: [],
    skills: [],
    languages: [],
  } as CVData;
}

describe('AAB-357 German target-locale role authority', () => {
  beforeEach(() => {
    seedUsage(27);
  });

  it('exposes AAB-357 role-authority revisions', () => {
    expect(SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION).toBe(
      'summary-target-role-authority-357-v1',
    );
    expect(SUMMARY_ROLE_LOCALE_ACCEPTANCE_357_REVISION).toBe(
      'summary-role-locale-acceptance-357-v1',
    );
    expect(GERMAN_SUMMARY_ROLE_LOCALE_AUTHORITY_357_REVISION).toBe(
      'german-summary-role-locale-authority-357-v1',
    );
    expect(SUMMARY_RUNTIME_MARKER_SET).toEqual(expect.arrayContaining([
      SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION,
      SUMMARY_ROLE_LOCALE_ACCEPTANCE_357_REVISION,
      GERMAN_SUMMARY_ROLE_LOCALE_AUTHORITY_357_REVISION,
    ]));
  });

  it('correct localized current role: accept', () => {
    expect(matchesWarehouseOccupationalTitle(FR_WAREHOUSE)).toBe(true);
    const auth = buildSummaryTargetRoleAuthority({
      entryId: 'atlas',
      rawRoleTitle: FR_WAREHOUSE,
      requestedTargetLocale: 'de',
      gender: 'female',
      employmentState: 'present',
      employer: 'Atlas',
    });
    expect(auth.localizedTargetRoleTitle).toBe('Lagermitarbeiterin');
    expect(auth.targetRoleValidationPassed).toBe(true);
    expect(auth.rawRoleTitle).toBe(FR_WAREHOUSE);
    const match = candidateMatchesTargetRoleAuthority({
      summary: germanHint(),
      authority: auth,
    });
    expect(match.accepted).toBe(true);
    expect(match.candidateContainsRawRole).toBe(false);
  });

  it('raw source role absent but localized role present: accept', () => {
    const v = validateSummaryStructuredRoleLocale({
      summary: germanHint(),
      targetLocale: 'de',
      gender: 'female',
      currentRole: FR_WAREHOUSE,
      priorRole: 'Graphic Designer',
      currentEntryId: 'atlas',
      priorEntryId: 'rewitu',
    });
    expect(v.structuredRoleLocaleValidationPassed).toBe(true);
    expect(v.failureKinds).not.toContain('current_role_locale_mismatch');
    expect(v.currentRoleLocalizationValidationPassed).toBe(true);
    expect(v.foreignCurrentRoleTitleDetected).toBe(false);
    expect(germanHint()).not.toMatch(/Employée|entrepôt/i);
    expect(germanHint()).toMatch(/Lagermitarbeiterin/);
  });

  it('exact AAB-357: FR warehouse title + Arabic Summary → DE Stronger accepts', () => {
    const empty = atlasRewituCv({ summary: '', currentPosition: FR_WAREHOUSE });
    const factSet = buildCvCanonicalFactSet(empty, { referenceDate: REF });
    const durationSnapshot = buildExperienceDurationSnapshot(empty.experience || [], REF);
    const sourceAr = buildConciseGroundedSummary(factSet, 'ar', 'female', durationSnapshot.total);
    expect(sourceAr.length).toBe(361);

    const cv = atlasRewituCv({ summary: sourceAr, currentPosition: FR_WAREHOUSE });
    const before = getProAiUsageCount();
    expect(before).toBe(27);

    const authority = buildSummaryTargetRoleAuthority({
      entryId: 'atlas',
      rawRoleTitle: FR_WAREHOUSE,
      requestedTargetLocale: 'de',
      gender: 'female',
      employmentState: 'present',
      employer: 'Atlas',
      dutiesText: WH_EN,
    });
    expect(authority.localizedTargetRoleTitle).toBe('Lagermitarbeiterin');

    // Old stale path: raw FR role into validate without FR matcher → mismatch.
    // Confirmed historical identity is now resolved.
    const resolved = resolveLocalizedSummaryRole({
      role: FR_WAREHOUSE,
      targetLocale: 'de',
      gender: 'female',
      entryId: 'atlas',
    });
    expect(resolved.localizationValidationPassed).toBe(true);

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
    expect(d.deterministicCandidateHash).toBe(EXPECTED_DE_HASH);
    expect(d.deterministicAccepted).toBe(true);
    expect(d.finalCandidateSource).toBe('deterministic_fallback');
    expect(d.finalTypedFailureReason).not.toBe('current_role_locale_mismatch');
    expect(d.typedFailureReason).not.toBe('current_role_locale_mismatch');
    expect(d.structuredRoleLocaleValidationPassed).toBe(true);
    expect(d.currentRoleLocalizationValidationPassed).toBe(true);
    expect(d.candidateCurrentRoleTitleMatchesStructuredRole).toBe(true);
    expect(d.finalWrongLocaleStructuredRoleCount ?? 0).toBe(0);
    expect(d.foreignCurrentRoleTitleDetected).toBe(false);
    expect(d.rawSourceRoleLeakageDetected).toBe(false);
    expect(String(d.contextCurrentRoleLocalized || '')).toMatch(/Lagermitarbeiterin/i);
    expect(String(d.contextCurrentRoleResolved || '')).toMatch(/Employée|entrepôt|Warehouse|مستودع/i);
    expect(d.coveredCurrentDutyFactCount).toBe(3);
    expect(d.requiredCurrentDutyFactCount).toBe(3);
    expect(d.coveredPriorDutyFactCount).toBe(3);
    expect(d.requiredPriorDutyFactCount).toBe(3);
    expect(d.finalDurationOwnerDetected).toBe('total_professional_experience');
    expect(detectGermanSummaryPerspective(fin.text)).toBe('first_person');
    expect(fin.text).toMatch(/Lagermitarbeiterin/);
    expect(fin.text).toMatch(/Grafikdesignerin/);
    expect(fin.text).not.toMatch(/Employée|entrepôt/i);

    // Provider/repair lineage stays isolated from deterministic acceptance.
    expect(d.providerTypedRejectionReason || d.providerRejectionReason).toBeTruthy();
    expect(d.deterministicAccepted).toBe(true);

    const session = new SummaryAiDiagnosticSession({
      requestId: 'aab357-exact',
      operationMode: 'stronger',
      rewriteStyle: 'stronger',
      requestedLocale: 'de',
      uiLocale: 'de',
      usageCountBefore: before,
    });
    session.recordFinalizeResult(fin);
    session.recordVisibleApply(true, before, fin.text);
    session.patch({ usageCountAfter: before + 1 });
    expect(session.evaluatePreApplyDecisionGates().passed).toBe(true);

    applyFinalizedSummaryToCv(cv, 'de', fin);
    recordProAiUserActionSuccess();
    expect(getProAiUsageCount()).toBe(28);
  });

  it('wrong unrelated current role: reject', () => {
    const q = analyzeGermanSummaryEmploymentQuality(
      germanHint().replace(/Lagermitarbeiterin/g, 'Softwareentwicklerin'),
      {
        company: 'Atlas',
        role: 'Lagermitarbeiterin',
        rawCurrentRole: FR_WAREHOUSE,
        priorCompany: 'Rewitu',
        priorRole: 'Grafikdesignerin',
        currentEntryDuties: WH_EN,
        priorEntryDuties: GD_EN,
        gender: 'female',
        currentEntryId: 'atlas',
        priorEntryId: 'rewitu',
      },
    );
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('prior role used as current role: reject as entry mismatch', () => {
    const swapped = germanHint()
      .replace(/Lagermitarbeiterin/g, 'Grafikdesignerin')
      .replace(/Grafikdesignerin(?!.*Grafikdesignerin)/, 'Lagermitarbeiterin');
    const q = analyzeGermanSummaryEmploymentQuality(swapped, {
      company: 'Atlas',
      role: 'Lagermitarbeiterin',
      rawCurrentRole: FR_WAREHOUSE,
      priorCompany: 'Rewitu',
      priorRole: 'Grafikdesignerin',
      currentEntryDuties: WH_EN,
      priorEntryDuties: GD_EN,
      gender: 'female',
      currentEntryId: 'atlas',
      priorEntryId: 'rewitu',
    });
    expect(q.groundingValidationPassed).toBe(false);
  });

  it('foreign raw role leaked into final German candidate: reject', () => {
    const leaked = germanHint().replace(
      'Lagermitarbeiterin',
      FR_WAREHOUSE,
    );
    const v = validateSummaryStructuredRoleLocale({
      summary: leaked,
      targetLocale: 'de',
      gender: 'female',
      currentRole: FR_WAREHOUSE,
      priorRole: 'Graphic Designer',
      currentEntryId: 'atlas',
      priorEntryId: 'rewitu',
    });
    expect(v.structuredRoleLocaleValidationPassed).toBe(false);
    expect(v.rawSourceRoleLeakageDetected || v.foreignCurrentRoleTitleDetected).toBe(true);
  });

  it('arbitrary free-text role without mapping: safe preservation path', () => {
    const auth = buildSummaryTargetRoleAuthority({
      entryId: 'x1',
      rawRoleTitle: 'Client Onboarding Lead',
      requestedTargetLocale: 'de',
      gender: 'female',
      employmentState: 'present',
      employer: 'Nimbus',
      dutiesText: 'schedules weekly client onboarding calls;',
    });
    expect(auth.canonicalRoleIdentity).toBeNull();
    // Free-text with no dictionary: either duties-backed generic DE, or preserved / rejected
    // without inventing warehouse/design occupations.
    expect(auth.localizedTargetRoleTitle).not.toMatch(/Lagermitarbeiter|Grafikdesigner/i);
  });

  it('two similar roles in different entries: no collision', () => {
    const a = buildSummaryTargetRoleAuthority({
      entryId: 'e1',
      rawRoleTitle: FR_WAREHOUSE,
      requestedTargetLocale: 'de',
      gender: 'female',
      employer: 'Atlas',
      employmentState: 'present',
    });
    const b = buildSummaryTargetRoleAuthority({
      entryId: 'e2',
      rawRoleTitle: 'Warehouse Employee',
      requestedTargetLocale: 'de',
      gender: 'male',
      employer: 'Beta Lager',
      employmentState: 'completed',
    });
    expect(a.entryIdHash).not.toBe(b.entryIdHash);
    expect(a.localizedTargetRoleTitle).toBe('Lagermitarbeiterin');
    expect(b.localizedTargetRoleTitle).toBe('Lagermitarbeiter');
    expect(a.employer).toBe('Atlas');
    expect(b.employer).toBe('Beta Lager');
  });

  it('five-plus-entry CV: selected role ownership remains correct', () => {
    const empty = atlasRewituCv({
      summary: '',
      currentPosition: FR_WAREHOUSE,
      extraEntries: [
        { id: 'old1', position: 'Assistant', company: 'A1' },
        { id: 'old2', position: 'Clerk', company: 'A2' },
        { id: 'old3', position: 'Intern', company: 'A3' },
      ],
    });
    expect(empty.experience?.length).toBeGreaterThanOrEqual(5);
    const auth = buildSummaryTargetRoleAuthority({
      entryId: 'atlas',
      rawRoleTitle: FR_WAREHOUSE,
      requestedTargetLocale: 'de',
      gender: 'female',
      employer: 'Atlas',
      employmentState: 'present',
      dutiesText: WH_EN,
    });
    expect(auth.entryId).toBe('atlas');
    expect(auth.localizedTargetRoleTitle).toBe('Lagermitarbeiterin');
    const durationSnapshot = buildExperienceDurationSnapshot(empty.experience || [], REF);
    const factSet = buildCvCanonicalFactSet(empty, { referenceDate: REF });
    const sourceAr = buildConciseGroundedSummary(factSet, 'ar', 'female', durationSnapshot.total);
    const cv = atlasRewituCv({
      summary: sourceAr,
      currentPosition: FR_WAREHOUSE,
      extraEntries: [
        { id: 'old1', position: 'Assistant', company: 'A1' },
        { id: 'old2', position: 'Clerk', company: 'A2' },
        { id: 'old3', position: 'Intern', company: 'A3' },
      ],
    });
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
    expect(fin.text).toMatch(/Lagermitarbeiterin/);
    expect(fin.text).toMatch(/\bAtlas\b/);
    expect(fin.diagnostics?.finalTypedFailureReason).not.toBe('current_role_locale_mismatch');
  });

  it('role-locale contradiction invariants fire on mismatched pass+reject', () => {
    const inv = checkSummaryDiagnosticInvariants({
      requestedLocale: 'de',
      groundingValidationPassed: true,
      slotValidationPassed: true,
      durationValidationPassed: true,
      finalStructuredRoleLocaleValidationPassed: true,
      currentRoleLocalizationValidationPassed: true,
      finalWrongLocaleStructuredRoleCount: 0,
      candidateCurrentRoleTitleMatchesStructuredRole: true,
      candidateCurrentRoleTitlePresent: true,
      contextCurrentRoleLocalized: 'Lagermitarbeiterin',
      contextCurrentRoleResolved: FR_WAREHOUSE,
      deterministicCandidateHash: EXPECTED_DE_HASH,
      deterministicAccepted: false,
      finalTypedFailureReason: 'current_role_locale_mismatch',
      typedFailureReason: 'current_role_locale_mismatch',
      rejectionStage: 'summary_grounding',
      countedAsSuccess: false,
      noOpDetected: false,
      finalCandidateSource: 'none',
      deterministicCandidatePresent: true,
    } as Parameters<typeof checkSummaryDiagnosticInvariants>[0]);
    const codes = inv.failures.map((f) => f.invariantCode);
    expect(codes).toEqual(expect.arrayContaining([
      'role_locale_pass_but_current_role_locale_mismatch',
      'candidate_role_matches_but_current_role_locale_mismatch',
      'role_localization_pass_but_deterministic_role_locale_reject',
      'raw_source_role_lexical_equality_required',
    ]));
  });
});
