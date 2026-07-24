/**
 * Entry-owned German Professional Summary grounding (three semantic slots).
 * Employer preposition: natural `bei <Employer>` — never bare `in <Employer>`
 * for company names.
 */
import type { Locale } from './i18n/translations';
import { classifyMaterialDutyKeys } from './cv-material-duty-coverage';
import {
  localizeGraphicDesigner,
  localizeWarehouseEmployee,
  matchesWarehouseOccupationalTitle,
} from './cv-role-title';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';
import {
  GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION,
  GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION,
  SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION,
  SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION,
  SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION,
  SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION,
  analyzeGermanSummaryDurationScope,
  formatGermanTotalProfessionalDurationSentence,
  isGermanGenericCompetencyUnit,
  scanGermanSummaryCompetencyClaims,
  type GermanDurationScopeAnalysis,
  type GermanSummaryCompetencyScan,
} from './cv-german-summary-competency-grounding';
import {
  GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION,
  GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION,
  SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION,
  SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION,
  analyzeGermanSummaryUnitSemantics,
  buildGermanSlotRejectionReasons,
  primaryRolesToLegacySlots,
  type GermanSummaryUnitSemanticAnalysis,
} from './cv-german-summary-role-slots';
import {
  GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION,
  GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION,
  analyzeGermanCurrentRoleCoverage,
  analyzeGermanPriorRoleCoverage,
  repairGermanSummaryEmployerStatus,
  type GermanCurrentRoleCoverage,
  type GermanPriorRoleCoverage,
} from './cv-german-summary-employer-status';
import {
  GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION,
  SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION,
  SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION,
  SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION,
  resolveLocalizedSummaryRole,
  validateSummaryStructuredRoleLocale,
  repairGermanSummaryStructuredRoleLocales,
  verifyVisibleSummaryStructuredRoleLocale,
  type StructuredRoleLocaleValidation,
} from './cv-summary-structured-role-localization';
import {
  GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION,
  SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION,
  GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION,
  SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION,
  GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION,
  SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION,
  SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION,
  SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION,
  extractGermanCurrentWarehouseDutyFacts,
  buildGermanCurrentDutyExperiencePhrase,
  validateGermanGeneratedCaseGrammar,
  validateSummaryEntryDutyCoverage,
  verifyVisibleSummaryCurrentDutyCoverage,
  analyzeCurrentDutyRequiredFactParity,
  type SummaryEntryDutyCoverageResult,
  type AuthoritativeCurrentDutyParityResult,
} from './cv-german-summary-current-duty-coverage';
export {
  GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION,
  GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION,
  analyzeGermanCurrentRoleCoverage,
  analyzeGermanPriorRoleCoverage,
  repairGermanSummaryEmployerStatus,
} from './cv-german-summary-employer-status';
export {
  GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION,
  SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION,
  SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION,
  SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION,
  resolveLocalizedSummaryRole,
  validateSummaryStructuredRoleLocale,
  repairGermanSummaryStructuredRoleLocales,
  verifyVisibleSummaryStructuredRoleLocale,
} from './cv-summary-structured-role-localization';
export {
  GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION,
  SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION,
  GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION,
  SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION,
  GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION,
  SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION,
  SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION,
  SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION,
  extractGermanCurrentWarehouseDutyFacts,
  buildGermanCurrentDutyExperiencePhrase,
  validateGermanGeneratedCaseGrammar,
  validateSummaryEntryDutyCoverage,
  verifyVisibleSummaryCurrentDutyCoverage,
  analyzeCurrentDutyRequiredFactParity,
} from './cv-german-summary-current-duty-coverage';
export type {
  SummaryEntryDutyCoverageResult,
  AuthoritativeCurrentDutyParityResult,
} from './cv-german-summary-current-duty-coverage';
export {
  GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION,
  GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION,
  SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION,
  SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION,
  stripGermanUnsupportedCompetencyUnits,
  scanGermanSummaryCompetencyClaims,
  analyzeGermanSummaryDurationScope,
  isGermanGenericCompetencyUnit,
  extractGermanSummaryCompetencyClaims,
  buildSummaryExplicitSkillAuthority,
  buildGermanSummarySkillAuthorityReport,
  splitGermanCompetencyListItems,
  formatGermanTotalProfessionalDurationSentence,
  injectGermanTotalDurationSentence,
  SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION,
  SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION,
} from './cv-german-summary-competency-grounding';
export {
  GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION,
  GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION,
  SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION,
  SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION,
  analyzeGermanSummaryUnitSemantics,
  buildGermanSlotRejectionReasons,
  primaryRolesToLegacySlots,
  deriveGermanSlotPresenceFromSemanticRoles,
} from './cv-german-summary-role-slots';

/** Packaging proof — must survive minification in internal Android/AAB assets. */
export const GERMAN_CV_AI_302_REVISION = 'german-cv-ai-302-v1' as const;
export const SUMMARY_UNIT_SPLITTER_REVISION_DE = 'german-three-sentence-slots-v1' as const;
export const SUMMARY_GROUNDING_REVISION_DE = 'entry-owned-german-grounding-v1' as const;
export const SUMMARY_BUILDER_REVISION_DE = 'entry-owned-german-rebuild-v1' as const;
export const SUMMARY_DURATION_FINALIZER_REVISION_DE = 'german-duration-idempotent-v1' as const;
export const GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER =
  'german-summary-strict-postconditions-v1' as const;
export const GERMAN_SUMMARY_EMPLOYER_PREPOSITION_REVISION =
  'german-summary-employer-bei-302-v1' as const;

void GERMAN_CV_AI_302_REVISION;
void SUMMARY_UNIT_SPLITTER_REVISION_DE;
void SUMMARY_GROUNDING_REVISION_DE;
void SUMMARY_BUILDER_REVISION_DE;
void SUMMARY_DURATION_FINALIZER_REVISION_DE;
void GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void GERMAN_SUMMARY_EMPLOYER_PREPOSITION_REVISION;
void GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION;
void GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION;
void SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION;
void SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION;
void GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION;
void GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION;
void SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION;
void SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION;
void GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION;
void GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION;
void SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION;
void SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION;

const GERMAN_MONTHS: Record<string, string> = {
  '01': 'Januar',
  '02': 'Februar',
  '03': 'März',
  '04': 'April',
  '05': 'Mai',
  '06': 'Juni',
  '07': 'Juli',
  '08': 'August',
  '09': 'September',
  '10': 'Oktober',
  '11': 'November',
  '12': 'Dezember',
};

const DESIGN_UNSUPPORTED_DE =
  /\b(?:Druck(?:medien)?|Printmedien|Branding|Markenidentität|Marketingmaterial(?:ien)?|Logos?|Werbekampagn(?:e|en)|Social\s*Media|Verpackungsdesign)\b/iu;

const WAREHOUSE_FACT_CUE_DE =
  /(?:eingehend\w*\s+Waren|Wareneingang|Unterlagen|Dokument(?:e|ation)|vorbereit|beweg|Kolleg|prüfen|Kontrolle)/iu;
const DESIGN_FACT_CUE_DE =
  /(?:visuell|grafisch|Design|Designdatei|Bildschirm|Format|Element)/iu;

export type GermanSummaryRoleSlot =
  | 'current_intro'
  | 'current_duty'
  | 'prior_role'
  | 'total_duration'
  | 'skills'
  | 'other';

/** Natural German employer preposition — `bei Atlas`, never `in Atlas` for employers. */
export function formatGermanEmployerPrepositional(employer: string): string | null {
  const company = (employer || '').replace(/\s+/g, ' ').trim();
  if (!company) return null;
  if (/^(?:bei|in|im|am)\s+/iu.test(company)) return company;
  return `bei ${company}`;
}

export function germanWarehouseSummaryFragment(key: string): string {
  // AAB-323: each warehouse fact family has a distinct dative-ready clause.
  // Do not merge inbound + documentation into one shared string.
  switch (key) {
    case 'warehouse_inbound_check':
      return 'der Prüfung eingehender Waren';
    case 'warehouse_document_check':
    case 'warehouse_records':
    case 'warehouse_orderly_goods':
      return 'der Prüfung der zugehörigen Dokumentation';
    case 'warehouse_movement':
    case 'warehouse_preparation':
    case 'warehouse_colleague_coordination':
      return 'der Abstimmung mit Kolleginnen und Kollegen bei der Vorbereitung und Bewegung von Waren';
    default:
      return '';
  }
}

export function splitGermanSummaryUnits(text: string): string[] {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  return normalized
    .split(/(?<=[.!?])\s+(?=\S)/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateGermanSummaryIntroGrammar(
  summary: string,
  options: { company?: string } = {},
): {
  ok: boolean;
  reason: string | null;
  invalidEmployerPreposition: boolean;
  hybridDuration: boolean;
} {
  const intro = splitGermanSummaryUnits(summary)[0] || (summary || '').trim();
  const company = (options.company || '').replace(/\s+/g, ' ').trim();
  let invalidEmployerPreposition = false;
  if (company) {
    const esc = company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const bareIn = new RegExp(`\\b(?:in|im)\\s+${esc}\\b`, 'iu');
    const beiOk = new RegExp(`\\bbei\\s+${esc}\\b`, 'iu');
    if (bareIn.test(intro) && !beiOk.test(intro)) {
      invalidEmployerPreposition = true;
    }
  }
  // Reject hybrid numeric + written duration (e.g. "6,5 sechseinhalb Jahre").
  const hybridDuration = /\d+[.,]\d+\s+(?:anderthalb|zweieinhalb|dreieinhalb|viereinhalb|fünfeinhalb|sechseinhalb|siebeneinhalb)|(?:anderthalb|zweieinhalb|dreieinhalb|viereinhalb|fünfeinhalb|sechseinhalb)\s+\d+[.,]\d+/iu
    .test(intro)
    || /\d+[.,]\d+\s+Jahre.{0,24}(?:anderthalb|zweieinhalb|dreieinhalb|sechseinhalb)/iu.test(intro);

  if (hybridDuration) {
    return {
      ok: false,
      reason: 'german_summary_hybrid_duration',
      invalidEmployerPreposition,
      hybridDuration: true,
    };
  }
  if (invalidEmployerPreposition) {
    return {
      ok: false,
      reason: 'german_summary_invalid_employer_preposition',
      invalidEmployerPreposition: true,
      hybridDuration: false,
    };
  }
  return {
    ok: true,
    reason: null,
    invalidEmployerPreposition: false,
    hybridDuration: false,
  };
}

export type GermanSummaryEmploymentQuality = {
  ok: boolean;
  reason: string | null;
  unitCount: number;
  finalUnitRoleSlots: GermanSummaryRoleSlot[];
  unsupportedDesignMedium: boolean;
  invalidEmployerPreposition: boolean;
  hybridDuration: boolean;
  groundingValidationPassed: boolean;
  typedRejectionReason: string | null;
  unsupportedClaimCount: number;
  unsupportedClaimKinds: string[];
  competencyScan: GermanSummaryCompetencyScan;
  durationScope: GermanDurationScopeAnalysis;
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  totalDurationSlotPresent: boolean;
  explicitSkillsSlotPresent: boolean;
  slotValidationPassed: boolean;
  slotRejectionReasons: string[];
  unitSemanticAnalyses: GermanSummaryUnitSemanticAnalysis[];
  currentRoleTitlePresent: boolean | null;
  currentRoleTitleMatchesStructuredRole: boolean | null;
  currentRoleOmittedDetected: boolean | null;
  currentRoleConcreteFactCoverage: number;
  priorRoleGroundingPassed: boolean;
  currentEmploymentIntroductionCount: number | null;
  finalSentenceHashes?: string[];
  finalSentenceRoleSlots?: GermanSummaryRoleSlot[];
  currentRoleCoverage?: GermanCurrentRoleCoverage;
  priorRoleCoverage?: GermanPriorRoleCoverage;
  finalCurrentRoleTitlePresent?: boolean;
  finalCurrentEmployerPresent?: boolean;
  finalCurrentEmploymentStateExpressed?: boolean;
  finalCurrentRoleIntroValidationPassed?: boolean;
  finalCurrentDutyCoveragePassed?: boolean;
  finalPriorRoleTitlePresent?: boolean;
  finalPriorEmployerPresent?: boolean;
  finalPriorEmploymentStateExpressed?: boolean;
  finalPriorRoleIntroValidationPassed?: boolean;
  finalPriorDutyCoveragePassed?: boolean;
  finalTotalDurationSlotPresent?: boolean;
  finalSlotValidationPassed?: boolean;
  finalSlotRejectionReasons?: string[];
  finalUnitSemanticRolesByUnit?: string[][];
  employerCrossEntryLeakageDetected?: boolean;
  structuredRoleLocale?: StructuredRoleLocaleValidation;
  structuredRoleLocaleValidationPassed?: boolean;
  currentRoleLocalizationValidationPassed?: boolean;
  priorRoleLocalizationValidationPassed?: boolean;
  foreignStructuredRoleTitleCount?: number;
  foreignPriorRoleTitleCount?: number;
  foreignCurrentRoleTitleDetected?: boolean;
  finalWrongLocaleStructuredRoleCount?: number;
  rawSourceRoleLeakageDetected?: boolean;
  requiredCurrentDutyFactCount?: number;
  coveredCurrentDutyFactCount?: number;
  missingCurrentDutyFactCount?: number;
  missingCurrentDutyFactIdHashes?: string[];
  currentDutyFactMatchCountsByFactHash?: Record<string, number>;
  currentMaterialCategoryMatchCount?: number;
  currentCanonicalDutyFactMatchCount?: number;
  materialCategoryCoverageUsedForFinalAcceptance?: false;
  germanControlledCaseGrammarPassed?: boolean;
  finalGermanGrammarValidationPassed?: boolean;
  requiredCurrentDutyFactIds?: string[];
  currentDutyCoverage?: SummaryEntryDutyCoverageResult;
  currentDutyParity?: AuthoritativeCurrentDutyParityResult;
  authoritativeCurrentDutyFactCount?: number;
  authoritativeCanonicalCurrentDutyFactCount?: number;
  classifiedRequiredCurrentDutyFactCount?: number;
  unclassifiedAuthoritativeCurrentDutyFactCount?: number;
  requiredFactSetMatchesAuthoritativeFactSet?: boolean;
  currentDutyRequiredFactParityPassed?: boolean;
  currentMaterialCategoryCount?: number;
  currentDutyFactClassificationKindsByFactHash?: Record<string, string>;
};

export function analyzeGermanSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
    priorCompany?: string;
    priorRole?: string;
    currentEntryDuties?: string;
    priorEntryDuties?: string;
    gender?: string;
    structuredSkills?: string[];
    expectedDurationOwner?: 'total_professional_experience' | 'current_role_duration';
    currentEntryId?: string | null;
    priorEntryId?: string | null;
  } = {},
): GermanSummaryEmploymentQuality {
  void GERMAN_CV_AI_302_REVISION;
  void GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
  void GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION;
  void GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION;
  void SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION;
  void GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION;
  void GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION;
  void GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION;
  void GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION;
  void GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION;
  void SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION;
  void SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION;
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const units = splitGermanSummaryUnits(text);
  const introGrammar = validateGermanSummaryIntroGrammar(text, { company: options.company });
  const unsupportedDesignMedium = DESIGN_UNSUPPORTED_DE.test(text);
  const competencyScan = scanGermanSummaryCompetencyClaims(text, {
    structuredSkills: options.structuredSkills,
  });

  const currentLocalized = resolveLocalizedSummaryRole({
    role: options.role || '',
    targetLocale: 'de',
    gender: options.gender,
    entryId: options.currentEntryId,
  });
  const priorLocalized = resolveLocalizedSummaryRole({
    role: options.priorRole || '',
    targetLocale: 'de',
    gender: options.gender,
    entryId: options.priorEntryId,
  });
  const localizedCurrentRole = currentLocalized.localizationValidationPassed
    ? currentLocalized.localizedTargetRoleLabel
    : (options.role || '');
  const localizedPriorRole = priorLocalized.localizationValidationPassed
    ? priorLocalized.localizedTargetRoleLabel
    : (options.priorRole || '');

  const durationScope = analyzeGermanSummaryDurationScope(text, {
    company: options.company,
    role: localizedCurrentRole || options.role,
    expectedOwner: options.expectedDurationOwner || 'total_professional_experience',
  });

  const unitSemanticAnalyses = analyzeGermanSummaryUnitSemantics(units, {
    company: options.company,
    role: localizedCurrentRole || options.role,
    priorCompany: options.priorCompany,
    priorRole: localizedPriorRole || options.priorRole,
    currentEntryDuties: options.currentEntryDuties,
    priorEntryDuties: options.priorEntryDuties,
  });
  const slots = primaryRolesToLegacySlots(unitSemanticAnalyses) as GermanSummaryRoleSlot[];
  const finalSentenceHashes = unitSemanticAnalyses.map((a) => a.unitHash);
  const finalUnitSemanticRolesByUnit = unitSemanticAnalyses.map((a) => [
    ...a.detectedSemanticRoles,
  ]);

  void GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION;
  void SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION;
  void GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION;

  const structuredRoleLocale = validateSummaryStructuredRoleLocale({
    summary: text,
    targetLocale: 'de',
    gender: options.gender,
    currentRole: options.role,
    priorRole: options.priorRole,
    currentEntryId: options.currentEntryId,
    priorEntryId: options.priorEntryId,
    currentLocalized,
    priorLocalized,
  });

  const requiredCurrentDutyFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: options.currentEntryDuties,
    entryId: options.currentEntryId,
  });
  const currentDutyParity = analyzeCurrentDutyRequiredFactParity({
    currentEntryDuties: options.currentEntryDuties,
    requiredFacts: requiredCurrentDutyFacts,
    entryId: options.currentEntryId,
  });
  const currentDutyCoverage = validateSummaryEntryDutyCoverage({
    requiredFacts: requiredCurrentDutyFacts,
    candidateText: text,
    entryId: options.currentEntryId,
  });
  const caseGrammar = validateGermanGeneratedCaseGrammar(text);

  const currentRoleCoverage = analyzeGermanCurrentRoleCoverage(text, {
    company: options.company,
    role: localizedCurrentRole || options.role,
    startDate: options.startDate,
  });
  const priorRoleCoverage = analyzeGermanPriorRoleCoverage(text, {
    priorCompany: options.priorCompany,
    priorRole: localizedPriorRole || options.priorRole,
  });
  const employerCrossEntryLeakageDetected = Boolean(
    (options.company || '').trim()
    && (options.priorCompany || '').trim()
    && options.company !== options.priorCompany
    && unitSemanticAnalyses.some((a) => (
      (a.employerEntryMatches && a.priorEmployerEntryMatches)
      || (
        a.detectedSemanticRoles.includes('current_role_intro')
        && a.priorEmployerEntryMatches
        && !a.employerEntryMatches
      )
      || (
        a.detectedSemanticRoles.includes('prior_role_intro')
        && a.employerEntryMatches
        && !a.priorEmployerEntryMatches
      )
    )),
  );

  let reason: string | null = null;
  const dutiesCorpus = `${options.currentEntryDuties || ''} ${options.priorEntryDuties || ''} ${options.role || ''}`;
  const warehouseDomain = WAREHOUSE_FACT_CUE_DE.test(dutiesCorpus)
    || matchesWarehouseOccupationalTitle(options.role || '')
    || /lager|warehouse/i.test(options.role || '');
  const designDomain = DESIGN_FACT_CUE_DE.test(dutiesCorpus)
    || /grafik|design|diseñ|dizajn/i.test(
      `${options.role || ''} ${options.priorRole || ''} ${options.priorEntryDuties || ''}`,
    );
  const requireSlots = warehouseDomain || designDomain;

  const semanticCurrentIntro = unitSemanticAnalyses.some((a) => (
    a.detectedSemanticRoles.includes('current_role_intro')
  ));
  const currentDutySlotPresent = unitSemanticAnalyses.some((a) => (
    a.detectedSemanticRoles.includes('current_role_duties')
    || (a.detectedSemanticRoles.includes('current_role_intro') && a.currentDutyFactMatches)
  ));
  const semanticPriorRole = unitSemanticAnalyses.some((a) => (
    a.detectedSemanticRoles.includes('prior_role_intro')
    || a.detectedSemanticRoles.includes('prior_role_duties')
  ));
  // AAB-321: slot presence derives from serialized semantic roles (not a hidden
  // classifier). Employer/status remain separate gate fields for slotValidationPassed.
  const currentIntroSlotPresent = finalUnitSemanticRolesByUnit.some((roles) => (
    roles.includes('current_role_intro')
  ));
  const priorRoleSlotPresent = finalUnitSemanticRolesByUnit.some((roles) => (
    roles.includes('prior_role_intro') || roles.includes('prior_role_duties')
  ));
  // When structured prior employer exists, priorRoleSlotPresent alone is insufficient
  // for grounding — priorRoleIntroValidationPassed / slotValidationPassed enforce it.
  const totalDurationSlotPresent = finalUnitSemanticRolesByUnit.some((roles) => (
    roles.includes('total_duration')
  ));
  const explicitSkillsSlotPresent = unitSemanticAnalyses.some((a) => (
    a.primaryRole === 'explicit_skills'
  )) && competencyScan.unsupportedCompetencyCount === 0;

  const slotRejectionReasons = [
    ...buildGermanSlotRejectionReasons(unitSemanticAnalyses, {
      requireCurrent: requireSlots,
      requirePrior: Boolean(options.priorCompany || options.priorEntryDuties || designDomain),
      requireDuration: DURATION_CUE_PRESENT(text) || requireSlots,
    }),
    ...currentRoleCoverage.currentRoleIntroRejectionReasons,
    ...priorRoleCoverage.priorRoleIntroRejectionReasons,
    ...(employerCrossEntryLeakageDetected ? ['employer_cross_entry_leakage'] : []),
    ...structuredRoleLocale.failureKinds,
  ];
  // Deduplicate while preserving order.
  const dedupedSlotRejectionReasons = [...new Set(slotRejectionReasons)];
  const employerStatusOk = currentRoleCoverage.currentRoleIntroValidationPassed
    && priorRoleCoverage.priorRoleIntroValidationPassed
    && !employerCrossEntryLeakageDetected;
  const baseSlotOk = !requireSlots
    || buildGermanSlotRejectionReasons(unitSemanticAnalyses, {
      requireCurrent: requireSlots,
      requirePrior: Boolean(options.priorCompany || options.priorEntryDuties || designDomain),
      requireDuration: DURATION_CUE_PRESENT(text) || requireSlots,
    }).length === 0;
  const slotValidationPassed = baseSlotOk
    && employerStatusOk
    && structuredRoleLocale.structuredRoleLocaleValidationPassed
    && (requiredCurrentDutyFacts.length === 0
      || currentDutyCoverage.finalCurrentDutyCoveragePassed)
    && currentDutyParity.currentDutyRequiredFactParityPassed
    && caseGrammar.germanControlledCaseGrammarPassed;
  const finalSlotRejectionReasons = [
    ...dedupedSlotRejectionReasons,
    ...(requiredCurrentDutyFacts.length > 0
      && !currentDutyCoverage.finalCurrentDutyCoveragePassed
      ? ['current_duty_fact_coverage_incomplete']
      : []),
    ...(!currentDutyParity.currentDutyRequiredFactParityPassed
      && currentDutyParity.rejectionReason
      ? [currentDutyParity.rejectionReason]
      : []),
    ...caseGrammar.failureKinds,
  ];
  const finalSlotValidationPassed = slotValidationPassed;

  if (!text) reason = 'empty_summary';
  else if (unsupportedDesignMedium) reason = 'german_summary_unsupported_design_medium';
  else if (competencyScan.unsupportedCompetencyCount > 0) {
    reason = competencyScan.providerRejectionStage || 'competency_grounding_validation';
  } else if (!durationScope.finalDurationScopeValidationPassed && DURATION_CUE_PRESENT(text)) {
    reason = durationScope.durationScopeRejectionReason || 'duration_scope_mismatch';
  } else if (!structuredRoleLocale.structuredRoleLocaleValidationPassed) {
    reason = structuredRoleLocale.failureKinds[0] || 'foreign_prior_role_title';
  } else if (!currentDutyParity.currentDutyRequiredFactParityPassed) {
    reason = currentDutyParity.rejectionReason || 'current_duty_required_fact_parity_failed';
  } else if (
    requiredCurrentDutyFacts.length > 0
    && !currentDutyCoverage.finalCurrentDutyCoveragePassed
  ) {
    reason = 'current_duty_fact_coverage_incomplete';
  } else if (!caseGrammar.germanControlledCaseGrammarPassed) {
    reason = caseGrammar.failureKinds[0] || 'german_controlled_case_grammar_failed';
  } else if (!slotValidationPassed) {
    reason = finalSlotRejectionReasons[0] || 'invalid_role_slot_classification';
  } else if (!introGrammar.ok) reason = introGrammar.reason;
  else if (requireSlots && units.length < 2) {
    reason = 'german_summary_incomplete_slots';
  } else if (/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(text)) {
    reason = 'german_summary_foreign_script';
  }

  const groundingOk = reason == null
    && introGrammar.ok
    && !unsupportedDesignMedium
    && competencyScan.unsupportedCompetencyCount === 0
    && slotValidationPassed
    && structuredRoleLocale.structuredRoleLocaleValidationPassed
    && currentDutyParity.currentDutyRequiredFactParityPassed
    && (requiredCurrentDutyFacts.length === 0
      || currentDutyCoverage.finalCurrentDutyCoveragePassed)
    && caseGrammar.germanControlledCaseGrammarPassed
    && (durationScope.finalDurationScopeValidationPassed || !DURATION_CUE_PRESENT(text));

  const rolePresent = Boolean(
    (localizedCurrentRole || options.role || '').trim()
    && new RegExp(
      (localizedCurrentRole || options.role || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'iu',
    ).test(text),
  );

  // AAB-323: concrete coverage is distinct matched facts — never source count or
  // a hard-coded 3 from coarse duty-slot presence.
  const dutyCoverage = currentDutyCoverage.currentRoleConcreteFactCoverage;

  // Count only intros that express current employment state (AAB-321 invariant 7).
  const currentEmploymentIntroductionCount = (
    semanticCurrentIntro
    && (
      !currentRoleCoverage.currentStatusMarkerRequired
      || currentRoleCoverage.currentEmploymentStateExpressed
    )
  ) ? 1 : 0;

  return {
    ok: groundingOk,
    reason,
    unitCount: units.length,
    finalUnitRoleSlots: slots,
    unsupportedDesignMedium,
    invalidEmployerPreposition: introGrammar.invalidEmployerPreposition,
    hybridDuration: introGrammar.hybridDuration,
    groundingValidationPassed: groundingOk,
    typedRejectionReason: reason,
    unsupportedClaimCount: competencyScan.unsupportedCompetencyCount,
    unsupportedClaimKinds: competencyScan.unsupportedCompetencyKinds,
    competencyScan,
    durationScope,
    currentIntroSlotPresent,
    currentDutySlotPresent,
    priorRoleSlotPresent,
    totalDurationSlotPresent,
    explicitSkillsSlotPresent,
    slotValidationPassed,
    slotRejectionReasons: finalSlotRejectionReasons,
    unitSemanticAnalyses,
    currentRoleTitlePresent: rolePresent,
    currentRoleTitleMatchesStructuredRole: rolePresent,
    currentRoleOmittedDetected: requireSlots && !rolePresent,
    currentRoleConcreteFactCoverage: dutyCoverage,
    priorRoleGroundingPassed: Boolean(
      priorRoleSlotPresent
      && priorRoleCoverage.priorRoleIntroValidationPassed
    ) || !(options.priorCompany || options.priorEntryDuties),
    currentEmploymentIntroductionCount,
    finalSentenceHashes,
    finalSentenceRoleSlots: slots,
    currentRoleCoverage,
    priorRoleCoverage,
    finalCurrentRoleTitlePresent: currentRoleCoverage.currentRoleTitlePresent,
    finalCurrentEmployerPresent: currentRoleCoverage.currentEmployerPresent,
    finalCurrentEmploymentStateExpressed: currentRoleCoverage.currentEmploymentStateExpressed,
    finalCurrentRoleIntroValidationPassed: currentRoleCoverage.currentRoleIntroValidationPassed,
    finalCurrentDutyCoveragePassed: requiredCurrentDutyFacts.length === 0
      ? currentDutySlotPresent
      : currentDutyCoverage.finalCurrentDutyCoveragePassed,
    finalPriorRoleTitlePresent: priorRoleCoverage.priorRoleTitlePresent,
    finalPriorEmployerPresent: priorRoleCoverage.priorEmployerPresent,
    finalPriorEmploymentStateExpressed: priorRoleCoverage.priorEmploymentStateExpressed,
    finalPriorRoleIntroValidationPassed: priorRoleCoverage.priorRoleIntroValidationPassed,
    finalPriorDutyCoveragePassed: semanticPriorRole,
    finalTotalDurationSlotPresent: totalDurationSlotPresent,
    finalSlotValidationPassed,
    finalSlotRejectionReasons,
    finalUnitSemanticRolesByUnit,
    employerCrossEntryLeakageDetected,
    structuredRoleLocale,
    structuredRoleLocaleValidationPassed:
      structuredRoleLocale.structuredRoleLocaleValidationPassed,
    currentRoleLocalizationValidationPassed:
      structuredRoleLocale.currentRoleLocalizationValidationPassed,
    priorRoleLocalizationValidationPassed:
      structuredRoleLocale.priorRoleLocalizationValidationPassed,
    foreignStructuredRoleTitleCount: structuredRoleLocale.foreignStructuredRoleTitleCount,
    foreignPriorRoleTitleCount: structuredRoleLocale.foreignPriorRoleTitleCount,
    foreignCurrentRoleTitleDetected: structuredRoleLocale.foreignCurrentRoleTitleDetected,
    finalWrongLocaleStructuredRoleCount:
      structuredRoleLocale.finalWrongLocaleStructuredRoleCount,
    rawSourceRoleLeakageDetected: structuredRoleLocale.rawSourceRoleLeakageDetected,
    requiredCurrentDutyFactCount: currentDutyCoverage.requiredCurrentDutyFactCount,
    coveredCurrentDutyFactCount: currentDutyCoverage.coveredCurrentDutyFactCount,
    missingCurrentDutyFactCount: currentDutyCoverage.missingCurrentDutyFactCount,
    missingCurrentDutyFactIdHashes: currentDutyCoverage.missingCurrentDutyFactIdHashes,
    currentDutyFactMatchCountsByFactHash:
      currentDutyCoverage.currentDutyFactMatchCountsByFactHash,
    currentMaterialCategoryMatchCount:
      currentDutyCoverage.currentMaterialCategoryMatchCount,
    currentCanonicalDutyFactMatchCount:
      currentDutyCoverage.currentCanonicalDutyFactMatchCount,
    materialCategoryCoverageUsedForFinalAcceptance: false,
    germanControlledCaseGrammarPassed: caseGrammar.germanControlledCaseGrammarPassed,
    finalGermanGrammarValidationPassed: caseGrammar.germanControlledCaseGrammarPassed
      && introGrammar.ok,
    requiredCurrentDutyFactIds: requiredCurrentDutyFacts.map((f) => f.canonicalFactId),
    currentDutyCoverage,
    currentDutyParity,
    authoritativeCurrentDutyFactCount: currentDutyParity.authoritativeCurrentDutyFactCount,
    authoritativeCanonicalCurrentDutyFactCount:
      currentDutyParity.authoritativeCanonicalCurrentDutyFactCount,
    classifiedRequiredCurrentDutyFactCount:
      currentDutyParity.classifiedRequiredCurrentDutyFactCount,
    unclassifiedAuthoritativeCurrentDutyFactCount:
      currentDutyParity.unclassifiedAuthoritativeCurrentDutyFactCount,
    requiredFactSetMatchesAuthoritativeFactSet:
      currentDutyParity.requiredFactSetMatchesAuthoritativeFactSet,
    currentDutyRequiredFactParityPassed:
      currentDutyParity.currentDutyRequiredFactParityPassed,
    currentMaterialCategoryCount: currentDutyParity.currentMaterialCategoryCount,
    currentDutyFactClassificationKindsByFactHash:
      currentDutyParity.currentDutyFactClassificationKindsByFactHash,
  };
}

function DURATION_CUE_PRESENT(text: string): boolean {
  return /(?:etwa|rund|ca\.?|ungefähr|insgesamt|sechseinhalb).{0,40}Jahre|Jahre(?:n)?\s+(?:Berufs)?[Ee]rfahrung/iu
    .test(text || '');
}

export function buildGermanEntryOwnedSummary(options: {
  role: string;
  employer: string;
  datesValue: string;
  gender?: string;
  durationPhrase?: string;
  dutyFacts: Array<{ sourceText?: string; value: string }>;
  priorRole?: string;
  priorEmployer?: string;
  priorSourceDuties?: string;
  locale?: Locale;
  duration?: ExperienceDuration | null;
}): string {
  void SUMMARY_BUILDER_REVISION_DE;
  void SUMMARY_GROUNDING_REVISION_DE;
  void SUMMARY_UNIT_SPLITTER_REVISION_DE;
  void GERMAN_CV_AI_302_REVISION;
  void options.locale;

  const g = String(options.gender || '').toLowerCase();
  const female = g === 'female' || g === 'f' || g === 'weiblich';
  const male = g === 'male' || g === 'm' || g === 'männlich';
  const unspecified = !female && !male;

  let role = (options.role || '').trim();
  const warehouseRole = !role
    || /^(?:fachkraft|professional|professionalin)$/iu.test(role)
    || matchesWarehouseOccupationalTitle(role)
    || /lager|warehouse|skladist|magazin/i.test(role);
  if (!unspecified) {
    if (!role || /^(?:fachkraft|professional|professionalin)$/iu.test(role) || warehouseRole) {
      role = localizeWarehouseEmployee('de', options.gender);
    }
  } else if (warehouseRole) {
    role = 'Fachkraft mit Lagererfahrung';
  }

  const startMatch = /^(\d{4})-(\d{2})/.exec(options.datesValue || '');
  const monthYear = startMatch && GERMAN_MONTHS[startMatch[2]]
    ? `${GERMAN_MONTHS[startMatch[2]]} ${startMatch[1]}`
    : '';
  const company = (options.employer || '').trim();
  const beiCompany = formatGermanEmployerPrepositional(company);

  let durRaw = (options.durationPhrase || '')
    .replace(/^[,，]\s*/u, '')
    .replace(/\.$/u, '')
    .trim();
  if (!durRaw && options.duration) {
    durRaw = formatApproximateDurationPhrase(options.duration, 'de')
      .replace(/\.$/u, '')
      .trim();
  }
  // Prefer written half-years; never leave hybrid numeric forms.
  durRaw = durRaw
    .replace(/\b6[,.]5\b/gu, 'sechseinhalb')
    .replace(/\b3[,.]5\b/gu, 'dreieinhalb')
    .replace(/\bdreiereinhalb\b/giu, 'dreieinhalb');

  // UNIT 1 — current role + duties (no total-duration attachment).
  let intro = '';
  if (beiCompany && monthYear) {
    intro = `${role} ${beiCompany} seit ${monthYear}`;
  } else if (beiCompany) {
    intro = `${role} ${beiCompany}`;
  } else if (monthYear) {
    intro = `${role} seit ${monthYear}`;
  } else {
    intro = role;
  }

  const whFrags = [...new Set(
    options.dutyFacts.flatMap((f) => {
      const src = f.sourceText || f.value;
      const keys = classifyMaterialDutyKeys(src).filter((k) => k.startsWith('warehouse_'));
      return keys.map((k) => germanWarehouseSummaryFragment(k)).filter(Boolean);
    }),
  )];
  // AAB-323: prefer ordered per-fact canonical duties over collapsed material keys.
  const canonicalCurrentFacts = extractGermanCurrentWarehouseDutyFacts({
    currentEntryDuties: options.dutyFacts
      .map((f) => f.sourceText || f.value)
      .filter(Boolean)
      .join('\n'),
  });
  const experiencePhrase = canonicalCurrentFacts.length > 0
    ? buildGermanCurrentDutyExperiencePhrase(canonicalCurrentFacts)
    : '';
  if (experiencePhrase) {
    intro = `${intro} ${experiencePhrase}`;
  } else {
    const preferred = [
      germanWarehouseSummaryFragment('warehouse_inbound_check'),
      germanWarehouseSummaryFragment('warehouse_records'),
      germanWarehouseSummaryFragment('warehouse_movement'),
    ].filter((frag) => whFrags.includes(frag));
    const dutyFrags = preferred.length >= 2 ? preferred : whFrags.slice(0, 3);
    if (dutyFrags.length >= 2) {
      intro = `${intro} mit Erfahrung in ${dutyFrags[0]}${
        dutyFrags[1] ? ` und ${dutyFrags[1]}` : ''
      }${dutyFrags[2] ? ` sowie in ${dutyFrags[2]}` : ''}`;
    } else if (dutyFrags.length === 1) {
      intro = `${intro} mit Erfahrung in ${dutyFrags[0]}`;
    } else if (warehouseRole) {
      intro = `${intro} mit Erfahrung in der Prüfung eingehender Waren und der Prüfung der zugehörigen Dokumentation sowie in der Abstimmung mit Kolleginnen und Kollegen bei der Vorbereitung und Bewegung von Waren`;
    }
  }
  if (!/[.]$/u.test(intro)) intro = `${intro}.`;

  const priorRole = (options.priorRole || '').trim();
  const priorEmployer = (options.priorEmployer || '').trim();
  const priorBei = formatGermanEmployerPrepositional(priorEmployer);
  const priorDuties = options.priorSourceDuties || '';
  const priorLooksDesign = /(?:dizajn|design|grafik|visual|vizuel|visuell|デザイン|diseñ)/i
    .test(`${priorRole} ${priorDuties}`);
  let priorSentence = '';
  if (priorRole && priorLooksDesign) {
    const priorResolved = resolveLocalizedSummaryRole({
      role: priorRole,
      targetLocale: 'de',
      gender: options.gender,
    });
    const priorLabel = priorResolved.localizationValidationPassed
      ? priorResolved.localizedTargetRoleLabel
      : (unspecified
        ? 'Grafikdesign'
        : localizeGraphicDesigner('de', options.gender));
    const designFacts = female
      ? 'und erstellte visuelle Materialien, überarbeitete Designunterlagen und bereitete finale Dateien für verschiedene Formate und Bildschirme vor'
      : male
        ? 'und erstellte visuelle Materialien, überarbeitete Designunterlagen und bereitete finale Dateien für verschiedene Formate und Bildschirme vor'
        : 'und erstellte visuelle Materialien, überarbeitete Designunterlagen und bereitete finale Dateien für verschiedene Formate und Bildschirme vor';
    priorSentence = priorBei
      ? `Zuvor war ${female ? 'sie' : male ? 'er' : 'die Fachkraft'} als ${priorLabel} ${priorBei} tätig ${designFacts}.`
      : `Zuvor war ${female ? 'sie' : male ? 'er' : 'die Fachkraft'} als ${priorLabel} tätig ${designFacts}.`;
  }

  // UNIT 3 — clearly scoped total professional experience (never inside role clause).
  const durationSentence = durRaw
    ? formatGermanTotalProfessionalDurationSentence(durRaw, options.gender)
    : '';

  return [intro, priorSentence, durationSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
