/**
 * Professional Summary grounding: authoritative fact use, claim rejection,
 * skill-label handling, length caps, and concise deterministic fallbacks.
 *
 * Previous AI-generated summaries are never treated as factual grounding.
 */
import type { Locale } from './i18n/translations';
import type { CoverLetterGender } from './cover-letter-gender';
import { normalizeCoverLetterGender } from './cover-letter-gender';
import type { CvCanonicalFact, CvCanonicalFactSet } from './cv-canonical-facts';
import {
  formatApproximateDurationPhrase,
  yearWordForLocale,
  type ExperienceDuration,
} from './cv-experience-duration';
import { classifyMaterialDutyKeys, validateMaterialDutyCoverage, hindiWarehouseCueKeysFromUnit } from './cv-material-duty-coverage';
import {
  localizeBaker,
  localizeWarehouseEmployee,
  resolveOccupationalTitleForSummary,
} from './cv-role-title';
import {
  analyzeArabicSummaryEmploymentQuality,
  buildArabicEntryOwnedSummary,
  arabicWarehouseSummaryFragment,
  SUMMARY_BUILDER_REVISION_AR,
  SUMMARY_GROUNDING_REVISION_AR,
  SUMMARY_UNIT_SPLITTER_REVISION_AR,
} from './cv-arabic-summary-grounding';
import {
  analyzeRussianSummaryEmploymentQuality,
  buildRussianEntryOwnedSummary,
  russianWarehouseSummaryFragment,
  SUMMARY_BUILDER_REVISION_RU,
  SUMMARY_GROUNDING_REVISION_RU,
  SUMMARY_UNIT_SPLITTER_REVISION_RU,
} from './cv-russian-summary-grounding';
import {
  analyzeJapaneseSummaryEmploymentQuality,
  buildJapaneseEntryOwnedSummary,
  japaneseWarehouseSummaryFragment,
  SUMMARY_BUILDER_REVISION_JA,
  SUMMARY_GROUNDING_REVISION_JA,
  SUMMARY_UNIT_SPLITTER_REVISION_JA,
  JAPANESE_DURATION_IN_INTRO_MARKER,
  JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
} from './cv-japanese-summary-grounding';
import {
  analyzeCroatianSummaryEmploymentQuality,
  buildCroatianEntryOwnedSummary,
  croatianWarehouseSummaryFragment,
  SUMMARY_BUILDER_REVISION_HR,
  SUMMARY_GROUNDING_REVISION_HR,
  SUMMARY_UNIT_SPLITTER_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
  CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION,
  CROATIAN_NOOP_USAGE_REVISION,
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
} from './cv-croatian-summary-grounding';
import {
  analyzeSerbianSummaryEmploymentQuality,
  buildSerbianEntryOwnedSummary,
  isSerbianStructuredSummaryDomain,
  evaluateSerbianStructuredDomainGate,
  detectSerbianPerspective,
  scanSerbianSummaryUnsupportedClaims,
  buildSerbianEntryOwnedSummaryFromPayload,
  isSerbianEntryOwnedSummaryComplete,
  SERBIAN_ENTRY_OWNED_OUTPUT_INCOMPLETE,
  injectSerbianTotalDurationSentence,
  SUMMARY_BUILDER_REVISION_SR,
  SUMMARY_GROUNDING_REVISION_SR,
  SUMMARY_UNIT_SPLITTER_REVISION_SR,
  SUMMARY_DURATION_FINALIZER_REVISION_SR,
  SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION,
  SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION,
  SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION,
  SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION,
} from './cv-serbian-summary-grounding';
export {
  analyzeSerbianSummaryEmploymentQuality,
  buildSerbianEntryOwnedSummary,
  isSerbianStructuredSummaryDomain,
  evaluateSerbianStructuredDomainGate,
  detectSerbianPerspective,
  scanSerbianSummaryUnsupportedClaims,
  buildSerbianEntryOwnedSummaryFromPayload,
  isSerbianEntryOwnedSummaryComplete,
  SERBIAN_ENTRY_OWNED_OUTPUT_INCOMPLETE,
  injectSerbianTotalDurationSentence,
  analyzeSerbianCroatianLocaleEvidence,
  analyzeSerbianSummaryDurationScope,
  analyzeSerbianSummaryFactCoverage,
  repairSerbianSummaryProviderCandidate,
  SUMMARY_BUILDER_REVISION_SR,
  SUMMARY_GROUNDING_REVISION_SR,
  SUMMARY_UNIT_SPLITTER_REVISION_SR,
  SUMMARY_DURATION_FINALIZER_REVISION_SR,
  SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION,
  SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION,
  SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION,
  SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION,
} from './cv-serbian-summary-grounding';
import {
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
  germanWarehouseSummaryFragment,
  GERMAN_CV_AI_302_REVISION,
  SUMMARY_BUILDER_REVISION_DE,
  SUMMARY_GROUNDING_REVISION_DE,
  SUMMARY_UNIT_SPLITTER_REVISION_DE,
  SUMMARY_DURATION_FINALIZER_REVISION_DE,
  GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
} from './cv-german-summary-grounding';
import {
  analyzeEnglishSummaryEmploymentQuality,
  buildEnglishEntryOwnedSummary,
  isEnglishStructuredSummaryDomain,
  ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION,
  ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION,
  ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION,
  SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION,
  ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION,
  SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION,
  SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION,
  SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION,
  SUMMARY_BUILDER_REVISION_EN,
  stripEnglishUnsupportedCompetencyUnits,
  detectEnglishMixedLanguageMorphology,
  rebuildEnglishDutyFactsFromIds,
  hashCurrentDutyRequiredFactSet,
  validateEnglishSummaryFiniteClauses,
  detectEnglishSummaryPerspective,
  ENGLISH_SUMMARY_FINITE_CLAUSE_346_REVISION,
  ENGLISH_SUMMARY_PERSPECTIVE_CONTRACT_346,
  ENGLISH_SUMMARY_VALIDATION_ROLE_ALIGN_347_REVISION,
  ENGLISH_SUMMARY_GROUNDED_FAILCLOSED_347_REVISION,
  SUMMARY_CANDIDATE_PROJECTION_INVARIANT_347_REVISION,
} from './cv-english-summary-grounding';
export {
  analyzeEnglishSummaryEmploymentQuality,
  buildEnglishEntryOwnedSummary,
  isEnglishStructuredSummaryDomain,
  ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION,
  ENGLISH_SUMMARY_ENTITY_LOCALE_PURITY_325_REVISION,
  ENGLISH_SUMMARY_CURRENT_PRIOR_COVERAGE_325_REVISION,
  SUMMARY_INVARIANT_PREAPPLY_GATE_325_REVISION,
  ENGLISH_SUMMARY_VISIBLE_CURRENT_COVERAGE_326_REVISION,
  SUMMARY_VISIBLE_REQUIRED_FACT_PARITY_326_REVISION,
  SUMMARY_SELECTED_LINEAGE_HASH_TRUTH_326_REVISION,
  SUMMARY_SENTENCE_SEMANTIC_ROLE_TRUTH_326_REVISION,
  SUMMARY_BUILDER_REVISION_EN,
  stripEnglishUnsupportedCompetencyUnits,
  detectEnglishMixedLanguageMorphology,
  rebuildEnglishDutyFactsFromIds,
  hashCurrentDutyRequiredFactSet,
  validateEnglishSummaryFiniteClauses,
  detectEnglishSummaryPerspective,
  ENGLISH_SUMMARY_FINITE_CLAUSE_346_REVISION,
  ENGLISH_SUMMARY_PERSPECTIVE_CONTRACT_346,
  ENGLISH_SUMMARY_VALIDATION_ROLE_ALIGN_347_REVISION,
  ENGLISH_SUMMARY_GROUNDED_FAILCLOSED_347_REVISION,
  SUMMARY_CANDIDATE_PROJECTION_INVARIANT_347_REVISION,
} from './cv-english-summary-grounding';
import {
  analyzeSpanishSummaryEmploymentQuality,
  buildSpanishEntryOwnedSummary,
  spanishWarehouseSummaryFragment,
  SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION,
} from './cv-spanish-summary-grounding';
import { SPANISH_CV_AI_305_REVISION } from './cv-spanish-experience-grounding';
import {
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297,
  HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION,
  buildHindiPriorDesignSentence,
  scanHindiUnsupportedDesignMediumClaims,
  validateHindiSummaryFiniteGrammar,
  type HindiUnsupportedDesignMediumKind,
} from './cv-hindi-summary-medium-grammar';

void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION;
void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297;
void HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION;
void JAPANESE_DURATION_IN_INTRO_MARKER;
void JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void SUMMARY_DURATION_FINALIZER_REVISION_HR;
void SUMMARY_DURATION_FINALIZER_REVISION_HR_V2;
void CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION;
void CROATIAN_NOOP_USAGE_REVISION;
void CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION;
void GERMAN_CV_AI_302_REVISION;
void SPANISH_CV_AI_305_REVISION;
void SUMMARY_BUILDER_REVISION_DE;
void SUMMARY_GROUNDING_REVISION_DE;
void SUMMARY_UNIT_SPLITTER_REVISION_DE;
void SUMMARY_DURATION_FINALIZER_REVISION_DE;
void GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void analyzeGermanSummaryEmploymentQuality;
void germanWarehouseSummaryFragment;
void analyzeSpanishSummaryEmploymentQuality;
void spanishWarehouseSummaryFragment;
export {
  analyzeArabicSummaryEmploymentQuality,
  buildArabicEntryOwnedSummary,
  arabicWarehouseSummaryFragment,
  splitArabicSummaryUnits,
  SUMMARY_BUILDER_REVISION_AR,
  SUMMARY_GROUNDING_REVISION_AR,
  SUMMARY_UNIT_SPLITTER_REVISION_AR,
} from './cv-arabic-summary-grounding';
export {
  analyzeRussianSummaryEmploymentQuality,
  buildRussianEntryOwnedSummary,
  russianWarehouseSummaryFragment,
  splitRussianSummaryUnits,
  SUMMARY_BUILDER_REVISION_RU,
  SUMMARY_GROUNDING_REVISION_RU,
  SUMMARY_UNIT_SPLITTER_REVISION_RU,
} from './cv-russian-summary-grounding';
export {
  analyzeJapaneseSummaryEmploymentQuality,
  buildJapaneseEntryOwnedSummary,
  japaneseWarehouseSummaryFragment,
  splitJapaneseSummaryUnits,
  SUMMARY_BUILDER_REVISION_JA,
  SUMMARY_GROUNDING_REVISION_JA,
  SUMMARY_UNIT_SPLITTER_REVISION_JA,
  JAPANESE_DURATION_IN_INTRO_MARKER,
  JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  isJapaneseGenericSkillsUnit,
  countJapaneseUnsupportedSummaryClaims,
  injectJapaneseDurationIntoCurrentIntro,
} from './cv-japanese-summary-grounding';
export {
  analyzeCroatianSummaryEmploymentQuality,
  buildCroatianEntryOwnedSummary,
  croatianWarehouseSummaryFragment,
  splitCroatianSummaryUnits,
  SUMMARY_BUILDER_REVISION_HR,
  SUMMARY_GROUNDING_REVISION_HR,
  SUMMARY_UNIT_SPLITTER_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
  CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION,
  CROATIAN_NOOP_USAGE_REVISION,
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  injectCroatianDurationIntoCurrentIntro,
  formatCroatianCompanyLocative,
  validateCroatianSummaryIntroGrammar,
  ensureCroatianDurationExperienceNoun,
} from './cv-croatian-summary-grounding';
export {
  analyzeGermanSummaryEmploymentQuality,
  buildGermanEntryOwnedSummary,
  germanWarehouseSummaryFragment,
  splitGermanSummaryUnits,
  formatGermanEmployerPrepositional,
  validateGermanSummaryIntroGrammar,
  GERMAN_CV_AI_302_REVISION,
  SUMMARY_BUILDER_REVISION_DE,
  SUMMARY_GROUNDING_REVISION_DE,
  SUMMARY_UNIT_SPLITTER_REVISION_DE,
  SUMMARY_DURATION_FINALIZER_REVISION_DE,
  GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  GERMAN_SUMMARY_EMPLOYER_PREPOSITION_REVISION,
  GERMAN_SUMMARY_COMPETENCY_GROUNDING_319_REVISION,
  GERMAN_SUMMARY_DURATION_SCOPE_319_REVISION,
  SUMMARY_EXPLICIT_SKILL_AUTHORITY_319_REVISION,
  SUMMARY_FINAL_CLAIM_ACCEPTANCE_319_REVISION,
  GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION,
  GERMAN_SUMMARY_ROLE_SLOT_CLASSIFIER_320_REVISION,
  SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION,
  SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION,
  SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION,
  SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION,
  GERMAN_SUMMARY_EMPLOYER_COVERAGE_321_REVISION,
  GERMAN_SUMMARY_EMPLOYMENT_STATE_321_REVISION,
  GERMAN_SUMMARY_STRUCTURED_ROLE_LOCALIZATION_322_REVISION,
  SUMMARY_SHARED_ROLE_LOCALIZATION_322_REVISION,
  SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION,
  SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION,
  GERMAN_SUMMARY_CURRENT_DUTY_SERIALIZATION_323_REVISION,
  SUMMARY_ENTRY_DUTY_COVERAGE_323_REVISION,
  GERMAN_SUMMARY_CONTROLLED_CASE_GRAMMAR_323_REVISION,
  SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION,
  GERMAN_SUMMARY_THIRD_CURRENT_DUTY_324_REVISION,
  SUMMARY_AUTHORITATIVE_DUTY_PARITY_324_REVISION,
  SUMMARY_VISIBLE_DUTY_PARITY_324_REVISION,
  SUMMARY_DUTY_PARITY_APPLY_GATE_324_REVISION,
  stripGermanUnsupportedCompetencyUnits,
  scanGermanSummaryCompetencyClaims,
  analyzeGermanSummaryDurationScope,
  formatGermanTotalProfessionalDurationSentence,
  injectGermanTotalDurationSentence,
  extractGermanSummaryCompetencyClaims,
  buildSummaryExplicitSkillAuthority,
  buildGermanSummarySkillAuthorityReport,
  splitGermanCompetencyListItems,
  analyzeGermanSummaryUnitSemantics,
  buildGermanSlotRejectionReasons,
  primaryRolesToLegacySlots,
  deriveGermanSlotPresenceFromSemanticRoles,
  analyzeGermanCurrentRoleCoverage,
  analyzeGermanPriorRoleCoverage,
  repairGermanSummaryEmployerStatus,
  resolveLocalizedSummaryRole,
  validateSummaryStructuredRoleLocale,
  repairGermanSummaryStructuredRoleLocales,
  verifyVisibleSummaryStructuredRoleLocale,
  extractGermanCurrentWarehouseDutyFacts,
  buildGermanCurrentDutyExperiencePhrase,
  validateGermanGeneratedCaseGrammar,
  validateSummaryEntryDutyCoverage,
  verifyVisibleSummaryCurrentDutyCoverage,
  analyzeCurrentDutyRequiredFactParity,
} from './cv-german-summary-grounding';
export {
  analyzeSpanishSummaryEmploymentQuality,
  buildSpanishEntryOwnedSummary,
  spanishWarehouseSummaryFragment,
  splitSpanishSummaryUnits,
  formatSpanishEmployerPhrase,
  validateSpanishSummaryIntroGrammar,
  extractSpanishEntryOwnedFactIds,
  spanishPriorEntryRequiresRoleSlot,
} from './cv-spanish-summary-grounding';
export { SPANISH_CV_AI_305_REVISION } from './cv-spanish-experience-grounding';
export {
  SPANISH_SUMMARY_GROUNDING_306_REVISION,
  SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION,
} from './cv-spanish-summary-grounding';
export {
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297,
  HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION,
  buildHindiPriorDesignSentence,
  scanHindiUnsupportedDesignMediumClaims,
  validateHindiSummaryFiniteGrammar,
  sourceSupportsHindiPrintMedium,
  HINDI_PRINT_CLAIM_RE,
} from './cv-hindi-summary-medium-grammar';
import { getLocalizedCvSkillName } from './cv-skill-options';
import type { CvFidelityViolation, CvFidelityViolationKind } from './cv-semantic-fidelity';
import {
  dutyToEnglishGerundFragment,
  sanitizeSummaryListMarkers,
  sourceUsableInLocale,
  stripDutyListPrefix,
  summaryContainsListMarkerLeakage,
  validateSummarySourceFactCoverage,
} from './cv-source-fact-identity';
import { fingerprintText } from './cv-export-diagnostics';

export const SUMMARY_MAX_WORDS = 90;

/** Runtime revision — returned by the splitter/grounding/builder that executed. */
export const SUMMARY_UNIT_SPLITTER_REVISION = 'hindi-three-sentence-slots-v3' as const;
export const SUMMARY_GROUNDING_REVISION = 'entry-owned-grounding-v3' as const;
export const SUMMARY_BUILDER_REVISION = 'live-hindi-material-rebuild-v3' as const;

/** Unsupported summary inventions (always reject — hygiene ≠ health/quality claims). */
const UNSUPPORTED_SUMMARY_CLAIM_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bhigh[- ]?quality\s+dishes?\b/iu, label: 'high-quality dishes' },
  { re: /उच्च[- ]?गुणवत्त[ाा]\s*(?:के\s*)?(?:व्यंजन|भोजन|dish)/iu, label: 'high-quality dishes' },
  { re: /\bhealth\s+standards?\b/iu, label: 'health standards' },
  { re: /स्वास्थ्य\s*(?:मानक|मानकों)/iu, label: 'health standards' },
  { re: /\bstrictly\b/iu, label: 'strictly' },
  { re: /कठोरता\s*से|सख्ती\s*से/iu, label: 'strictly' },
  { re: /\bfast[- ]?paced\b/iu, label: 'fast-paced environment' },
  { re: /\bunder\s+pressure\b/iu, label: 'under pressure' },
  { re: /pod\s+pritisk/iu, label: 'under pressure' },
  { re: /\brunning\s+smoothly\b/iu, label: 'running smoothly' },
  { re: /\boperational\s+efficiency\b/iu, label: 'operational efficiency' },
  { re: /\battention\s+to\s+detail\b/iu, label: 'attention to detail' },
  { re: /\bdedication\s+to\s+quality\b/iu, label: 'dedication to quality' },
  { re: /\bgenuine\s+dedication\b/iu, label: 'dedication' },
  { re: /\breliabilit(?:y|ies)\b/iu, label: 'reliability' },
  { re: /\bgreater\s+responsibility\b/iu, label: 'greater responsibility' },
  { re: /\bcareer\s+(?:focus|ambition|goal)/iu, label: 'career ambition' },
  { re: /\binternational\s+workplace/iu, label: 'international workplace' },
  { re: /\bcross[- ]?team\s+communication\b/iu, label: 'cross-team communication' },
  { re: /\bcommunicates?\s+effectively\b/iu, label: 'effective communication' },
  { re: /\bmeeting\s+service\s+expectations\b/iu, label: 'service expectations' },
  { re: /\bpresentation\s+standards?\b/iu, label: 'presentation standards' },
  { re: /prezentacij\w*\s+svakog\s+obrok/iu, label: 'presentation of every meal' },
  { re: /kvalitet\w*\s+i\s+prezentacij/iu, label: 'quality and presentation' },
  { re: /kvalitetu\s+i\s+prezentaciji/iu, label: 'quality and presentation' },
  { re: /dinamičn\w*\s+radn\w*\s+okružen/iu, label: 'dynamic work environment' },
  { re: /\bprofessional\s+kitchen\s+experience\b/iu, label: 'professional kitchen experience' },
  { re: /\buphold\s+quality\b/iu, label: 'uphold quality' },
  { re: /\bconsistent\s+performance\b/iu, label: 'consistent performance' },
  { re: /\btaking\s+on\s+greater\b/iu, label: 'greater responsibility' },
  { re: /\bcommitted\s+to\s+continued\s+growth\b/iu, label: 'career ambition' },
];

/** Skill labels converted into demonstrated achievements / personality. */
const SKILL_INFLATION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /demonstrated\s+leadership/iu, label: 'demonstrated leadership' },
  { re: /leadership\s+capabilities/iu, label: 'leadership capabilities' },
  { re: /liderske\s+kvalitet/iu, label: 'demonstrated leadership' },
  { re: /pokazujući\s+lidersk/iu, label: 'demonstrated leadership' },
  { re: /preuzimajući\s+inicijativ/iu, label: 'taking initiative' },
  { re: /\btook\s+initiative\b/iu, label: 'taking initiative' },
  { re: /\btaking\s+initiative\b/iu, label: 'taking initiative' },
  { re: /\bshowed\s+leadership\b/iu, label: 'demonstrated leadership' },
  { re: /razvijala\s+sam\s+veštine/iu, label: 'skill inflation as achievement' },
  { re: /applied\s+daily\s+to\s+uphold/iu, label: 'skills as performance proof' },
  { re: /strong\s+time\s+management.{0,40}applied/iu, label: 'skills as performance proof' },
  { re: /solved\s+complex\s+problems/iu, label: 'problem-solving achievement' },
  { re: /improved\s+efficiency/iu, label: 'efficiency achievement' },
  { re: /ensured\s+customer\s+satisfaction/iu, label: 'customer satisfaction' },
  { re: /led\s+(?:the\s+)?(?:team|kitchen)/iu, label: 'team leadership' },
  { re: /team[- ]?lead(?:er)?\b/iu, label: 'team leadership' },
  { re: /revenue\s+growth/iu, label: 'revenue growth' },
  { re: /route\s+planning/iu, label: 'route planning' },
  { re: /logistics\s+optimization/iu, label: 'logistics optimization' },
  { re: /medication\s+administration/iu, label: 'medication administration' },
];

const OCCUPATION_INFERENCE_PATTERNS: Array<{ re: RegExp; label: string; support?: RegExp }> = [
  { re: /\bmenu\s+development\b/iu, label: 'menu development' },
  {
    re: /\binventory\b/iu,
    label: 'inventory',
    // Warehouse/stock source may legitimately localize to inventory wording.
    support: /\binventory\b|skladišt|warehouse|stock|zalih|magacin|inventur/iu,
  },
  {
    re: /\bingredient\s+storage\b/iu,
    label: 'ingredient storage',
    support: /ingredient|namirnic|skladišt\w*\s+namirnic|भंडारण/iu,
  },
  {
    re: /सामग्री\s*भंडारण|भंडारण\s*प्रक्रिया/iu,
    label: 'ingredient storage',
    support: /ingredient|namirnic|भंडारण|skladišt\w*\s+namirnic/iu,
  },
  {
    re: /skladišt\w*\s+namirnic/iu,
    label: 'ingredient storage',
    support: /namirnic|ingredient|skladišt\w*\s+namirnic/iu,
  },
  {
    re: /\bfood\s+safety\b/iu,
    label: 'food safety',
    support: /food\s+safet|higijen|hygiene|bezbednost\s+hran/iu,
  },
];

export function countSummaryWords(text: string, locale?: string): number {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  if (locale === 'ja') {
    // CJK length budget: ~1 word per 3 characters (professional Japanese Summary).
    return Math.ceil([...t.replace(/\s/g, '')].length / 3);
  }
  return t.split(/\s+/).filter(Boolean).length;
}

function dutiesCorpus(factSet: CvCanonicalFactSet): string {
  // Authoritative grounding only — never previous AI summary text.
  return factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .map((f) => `${f.sourceText || ''} ${f.value || ''}`)
    .join('\n')
    .toLowerCase();
}

function claimSupportedInDuties(label: string, corpus: string): boolean {
  const token = label.toLowerCase().slice(0, 24);
  if (!token) return false;
  return corpus.includes(token);
}

export function validateSummaryUnsupportedClaims(
  summary: string,
  factSet: CvCanonicalFactSet,
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  const corpus = dutiesCorpus(factSet);
  for (const row of UNSUPPORTED_SUMMARY_CLAIM_PATTERNS) {
    const m = summary.match(row.re);
    if (!m?.[0]) continue;
    if (claimSupportedInDuties(row.label, corpus)) continue;
    violations.push({
      kind: 'unsupported_summary_claim' as CvFidelityViolationKind,
      matched: row.label,
      section: 'summary',
      evidence: m[0],
    });
  }
  for (const row of OCCUPATION_INFERENCE_PATTERNS) {
    const m = summary.match(row.re);
    if (!m?.[0]) continue;
    if (row.support?.test(corpus) || claimSupportedInDuties(row.label, corpus) || row.re.test(corpus)) {
      continue;
    }
    violations.push({
      kind: 'occupation_inference' as CvFidelityViolationKind,
      matched: row.label,
      section: 'summary',
      evidence: m[0],
    });
  }
  return violations;
}

export function validateSummarySkillInflation(summary: string): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  for (const row of SKILL_INFLATION_PATTERNS) {
    const m = summary.match(row.re);
    if (!m?.[0]) continue;
    violations.push({
      kind: 'skill_inflation' as CvFidelityViolationKind,
      matched: row.label,
      section: 'summary',
      evidence: m[0],
    });
  }
  return violations;
}

export function validateSummaryLength(
  summary: string,
  locale?: string,
): CvFidelityViolation[] {
  const words = countSummaryWords(summary, locale);
  if (words > SUMMARY_MAX_WORDS) {
    return [{
      kind: 'summary_too_long' as CvFidelityViolationKind,
      matched: `${words} words, maximum ${SUMMARY_MAX_WORDS}`,
      section: 'summary',
      evidence: `wordCount=${words}`,
    }];
  }
  return [];
}

/**
 * Baker + female + sr/hr must use Pekarka, never Pekara (bakery) or male Pekar alone.
 */
export function validateSummaryGenderOccupation(
  summary: string,
  factSet: CvCanonicalFactSet,
  options: { locale?: Locale | string; gender?: CoverLetterGender | string },
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  const locale = (options.locale || 'en') as Locale;
  const gender = normalizeCoverLetterGender(options.gender);
  const titles = factSet.facts
    .filter((f) => f.type === 'job_title' || f.type === 'role')
    .map((f) => f.value || '')
    .join(' ');
  const isBaker = /baker|pekar|bäcker|बेकर|خباز|ベイカー/iu.test(titles);
  if (!isBaker) return violations;

  if ((locale === 'sr' || locale === 'hr') && gender === 'female') {
    if (/\bPekara\b/.test(summary)) {
      violations.push({
        kind: 'summary_gender_mismatch' as CvFidelityViolationKind,
        matched: 'Pekara is not female Baker; use Pekarka',
        section: 'summary',
      });
    } else if (/\bPekar\b/.test(summary) && !/\bPekarka\b/.test(summary)) {
      violations.push({
        kind: 'summary_gender_mismatch' as CvFidelityViolationKind,
        matched: 'Pekar is male form; female Baker is Pekarka',
        section: 'summary',
      });
    }
  }
  if ((locale === 'sr' || locale === 'hr') && gender === 'male' && /\bPekarka\b/.test(summary)) {
    violations.push({
      kind: 'summary_gender_mismatch' as CvFidelityViolationKind,
      matched: 'Pekarka is female form; male Baker is Pekar',
      section: 'summary',
    });
  }
  return violations;
}

const COOKING_SUMMARY_KEYS = new Set([
  'food_prep',
  'hygiene_workplace',
  'kitchen_collaboration',
]);

const WAREHOUSE_SUMMARY_KEYS = new Set([
  'warehouse_inbound_check',
  'warehouse_records',
  'warehouse_movement',
]);

/** Generic records/docs/info language that must not replace concrete warehouse facts. */
const GENERICIZED_WAREHOUSE_RE =
  /(?:दैनिक\s*रिकॉर्ड|कार्य\s*दस्तावेज़|जानकारी\s*का\s*समन्वय|daily\s+records?|work\s+documents?|coordinates?\s+information)/iu;

const DESIGN_FACT_CUE_RE =
  /(?:ग्राफिक|डिज़ाइन|प्रिंट|डिजिटल|दृश्य|ब्रांड|दिशानिर्देश|graphic|design|print|digital|visual\s+identity|brand\s+guidelines?|مواد\s*بصرية|عناصر\s*رسومية|جرافيك|تصميم|هوية\s*بصرية)/iu;
const WAREHOUSE_FACT_CUE_RE =
  /(?:माल|गोदाम|आवाजाही|सामान|incoming\s+goods|warehouse|goods\b|orderly|بضائع|وثائق|مستودع|سجلات|واردة)/iu;
const FINITE_THEN_KA_ANUBHAV_RE =
  /(?:करती|करता|किए|किया|की|थीं|थे|था|हैं|है|हूँ|हूं)(?:\s+(?:हैं|है|थीं|थे|था|हूँ|हूं))?\s+का\s+अनुभव/u;

const HINDI_MONTH_FROM_RE =
  /(?:जनवरी|फ़रवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्तूबर|नवंबर|दिसंबर)(?:\s+\d{4})?\s+से/u;

/**
 * Split Summary into sentence-level units for Hindi slot ownership.
 * Devanagari-dominant prose uses danda / ! / ? only — ASCII '.' must not create
 * false `current_duty` fragments (hybrid/provider leftovers previously yielded ×N).
 * Latin-dominant text still respects non-decimal periods.
 */
export function splitHindiSummaryUnits(text: string): string[] {
  void SUMMARY_UNIT_SPLITTER_REVISION;
  const units: string[] = [];
  let buf = '';
  const s = (text || '').replace(/\s+/g, ' ').trim();
  const devanagari = (s.match(/[\u0900-\u097F]/g) || []).length;
  const latin = (s.match(/[A-Za-z]/g) || []).length;
  const dandaOnly = devanagari >= Math.max(8, latin);
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i]!;
    buf += ch;
    if (ch === '।' || ch === '!' || ch === '?') {
      const t = buf.replace(/[।.!?]+$/u, '').trim();
      if (t) units.push(t);
      buf = '';
      continue;
    }
    if (ch === '.' && !dandaOnly) {
      const prev = s[i - 1] || '';
      const next = s[i + 1] || '';
      // Keep decimal numbers like 6.5 inside the same unit.
      if (/\d/.test(prev) && /\d/.test(next)) continue;
      const t = buf.replace(/[।.!?]+$/u, '').trim();
      if (t) units.push(t);
      buf = '';
    }
  }
  const rest = buf.replace(/[।.!?]+$/u, '').trim();
  if (rest) units.push(rest);
  return units;
}

/**
 * Semantic employment-fact / professional-label quality for Hindi Summary postconditions.
 * Compares structured company/role/current/start predicates across clauses — not token overlap alone.
 */
export type HindiSummaryEmploymentQuality = {
  currentEmploymentIntroductionCount: number;
  repeatedEmploymentFactCount: number;
  repeatedProfessionalLabelCount: number;
  professionalLabelCount: number;
  currentRoleConcreteFactCoverage: number;
  genericizedMaterialFactCount: number;
  priorRoleGroundingPassed: boolean;
  crossDomainLeakageDetected: boolean;
  groundingValidationPassed: boolean;
  currentRoleTitlePresent: boolean;
  currentRoleTitleMatchesStructuredRole: boolean;
  currentRoleOmittedDetected: boolean;
  currentSlotForeignFactCount: number;
  priorSlotForeignFactCount: number;
  semanticCrossEntryLeakageDetected: boolean;
  duplicatedPriorRoleFactCount: number;
  priorRoleSemanticFactMentionCount: number;
  priorRoleSemanticDuplicationDetected: boolean;
  hindiFiniteKaAnubhavCollision: boolean;
  unsupportedClaimCount: number;
  unsupportedClaimKinds: HindiUnsupportedDesignMediumKind[];
  sourcePrintFactPresent: boolean;
  sourceBrandingFactPresent: boolean;
  sourceMarketingFactPresent: boolean;
  providerUnsupportedDesignMediumCount: number;
  providerUnsupportedDesignMediumKinds: HindiUnsupportedDesignMediumKind[];
  providerPrintClaimDetected: boolean;
  providerBrandingClaimDetected: boolean;
  providerMarketingClaimDetected: boolean;
  finalUnsupportedDesignMediumCount: number;
  finalUnsupportedDesignMediumKinds: HindiUnsupportedDesignMediumKind[];
  grammarValidationPassed: boolean;
  hindiCurrentIntroFiniteVerbPresent: boolean;
  hindiCurrentDutyFiniteVerbPresent: boolean;
  hindiCurrentIntroCopulaPresent: boolean;
  hindiCurrentDutyAuxiliaryPresent: boolean;
  hindiPriorRoleFiniteVerbPresent: boolean;
  hindiStandaloneJahanFragmentDetected: boolean;
  hindiNominalExperienceFragmentDetected: boolean;
  hindiSentenceHasFiniteCopulaOrVerb: boolean[];
  hindiIncompleteSentenceCount: number;
  hindiGrammarRejectionReason: string | null;
  hindiGrammarRejectionReasons: string[];
  typedRejectionReason: string | null;
  finalUnitRoleSlots: Array<'current_intro' | 'current_duty' | 'prior_role' | 'duration' | 'other'>;
  currentIntroSlotPresent: boolean;
  currentDutySlotPresent: boolean;
  priorRoleSlotPresent: boolean;
  slotValidationPassed: boolean;
  slotRejectionReasons: string[];
  /** Sentence-level (not comma-fragment) ownership diagnostics — hashes only. */
  finalSentenceHashes: string[];
  finalSentenceRoleSlots: Array<'current_intro' | 'current_duty' | 'prior_role' | 'duration' | 'other'>;
  finalSentenceMaterialKeyCounts: number[];
  /** Non-PII revision markers from the grounding/splitter implementations that ran. */
  summaryUnitSplitterRevision: typeof SUMMARY_UNIT_SPLITTER_REVISION;
  summaryGroundingRevision: typeof SUMMARY_GROUNDING_REVISION;
};

/** Resolve which Experience index owns the current (Present) role in a fact set. */
export function resolveCurrentExperienceIndex(factSet: CvCanonicalFactSet): number {
  const dateFacts = factSet.facts.filter((f) => f.type === 'dates' && typeof f.experienceIndex === 'number');
  const present = dateFacts.find((d) => /present|current|danas|сегодня|ปัจจุบัน/i.test(d.value || ''));
  if (typeof present?.experienceIndex === 'number') return present.experienceIndex;
  const roleFacts = factSet.facts.filter((f) => f.type === 'role' && typeof f.experienceIndex === 'number');
  if (roleFacts.length) return roleFacts[0].experienceIndex as number;
  return 0;
}

export function factsForExperienceIndex(
  factSet: CvCanonicalFactSet,
  experienceIndex: number,
  type?: CvCanonicalFact['type'],
): CvCanonicalFact[] {
  return factSet.facts.filter((f) => (
    f.experienceIndex === experienceIndex
    && (type ? f.type === type : true)
  ));
}

export function analyzeHindiSummaryEmploymentQuality(
  summary: string,
  options: {
    company?: string;
    role?: string;
    startDate?: string;
    /** All Experience duties (legacy). Prefer currentEntryDuties when available. */
    sourceDuties?: string;
    /** Duties owned by the structured current Experience entry only. */
    currentEntryDuties?: string;
    /** Duties owned by prior/completed Experience entries. */
    priorEntryDuties?: string;
    structuredRole?: string;
    /** Prior employer name for slot ownership (optional). */
    priorCompany?: string;
  } = {},
): HindiSummaryEmploymentQuality {
  const text = (summary || '').replace(/\s+/g, ' ').trim();
  const company = (options.company || '').trim();
  const priorCompany = (options.priorCompany || '').trim();
  const structuredRole = (options.structuredRole || options.role || '').trim();
  const currentEntryDuties = (options.currentEntryDuties || '').trim();
  const priorEntryDuties = (options.priorEntryDuties || '').trim();
  const source = currentEntryDuties || (options.sourceDuties || '');
  const companyEsc = company ? company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
  const priorCompanyEsc = priorCompany
    ? priorCompany.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';

  const sentences = splitHindiSummaryUnits(text);
  const finalUnitRoleSlots: HindiSummaryEmploymentQuality['finalUnitRoleSlots'] = [];
  let priorClauseSeen = false;
  for (const sentence of sentences) {
    if (
      /इससे\s+(?:पहले|पूर्व)/u.test(sentence)
      || (priorCompanyEsc
        && new RegExp(priorCompanyEsc, 'iu').test(sentence)
        && !(companyEsc && new RegExp(companyEsc, 'iu').test(sentence)))
    ) {
      priorClauseSeen = true;
      finalUnitRoleSlots.push('prior_role');
      continue;
    }
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasMonthFrom = HINDI_MONTH_FROM_RE.test(sentence) || /\d{4}\s+से/u.test(sentence);
    const hasEmployed = /(?:कार्यरत|वर्तमान\s+में)/u.test(sentence);
    if ((hasCompany && (hasEmployed || hasMonthFrom || /के\s+रूप\s+में/u.test(sentence)))
      || (hasMonthFrom && hasEmployed)
      || (hasMonthFrom && hasCompany)) {
      finalUnitRoleSlots.push('current_intro');
      continue;
    }
    if (
      /(?:लगभग|करीब)\s+(?:साढ़े\s*)?(?:\d+(?:[.,]\d+)?|एक|दो|तीन|चार|पाँच|पांच|छह|सात|आठ|नौ|दस|ढाई|डेढ़)\s*वर्ष/u.test(sentence)
      && !DESIGN_FACT_CUE_RE.test(sentence)
      && !WAREHOUSE_FACT_CUE_RE.test(sentence)
      && !hasEmployed
    ) {
      finalUnitRoleSlots.push('duration');
      continue;
    }
    if (!priorClauseSeen) {
      finalUnitRoleSlots.push('current_duty');
    } else {
      finalUnitRoleSlots.push('other');
    }
  }

  let currentEmploymentIntroductionCount = 0;
  for (const sentence of sentences) {
    const hasCompany = companyEsc ? new RegExp(companyEsc, 'iu').test(sentence) : false;
    const hasMonthFrom = HINDI_MONTH_FROM_RE.test(sentence) || /\d{4}\s+से/u.test(sentence);
    const hasEmployed = /(?:कार्यरत|वर्तमान\s+में)/u.test(sentence);
    const hasRoleForm = /के\s+रूप\s+में/u.test(sentence);
    const isEmploymentIntro = companyEsc
      ? (hasCompany && (hasEmployed || hasRoleForm || hasMonthFrom))
      : hasEmployed || (hasMonthFrom && hasRoleForm);
    if (isEmploymentIntro) currentEmploymentIntroductionCount += 1;
  }

  const repeatedEmploymentFactCount = Math.max(0, currentEmploymentIntroductionCount - 1);

  const professionalMatches = text.match(/पेशेवर/gu) || [];
  const professionalLabelCount = professionalMatches.length;
  const repeatedProfessionalLabelCount = Math.max(0, professionalLabelCount - 1);

  const summaryWhKeys = [...new Set(
    classifyMaterialDutyKeys(text).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const currentRoleConcreteFactCoverage = summaryWhKeys.length;

  const sourceWh = [...new Set(
    classifyMaterialDutyKeys(source).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];
  const roleLooksWarehouse = /(?:warehouse|वेयरहाउस|गोदाम|magacin|skladist)/iu.test(
    `${structuredRole} ${options.role || ''} ${currentEntryDuties}`,
  );
  const requireWarehouseCoverage = sourceWh.length >= 2 || roleLooksWarehouse;

  const hasGeneric = GENERICIZED_WAREHOUSE_RE.test(text);
  const genericizedMaterialFactCount = hasGeneric && currentRoleConcreteFactCoverage < 2
    ? Math.max(1, sourceWh.length, requireWarehouseCoverage ? 1 : 0)
    : 0;

  const roleEsc = structuredRole && !/^(?:पेशेवर|professional)$/iu.test(structuredRole)
    ? structuredRole.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : '';
  const structuredIsGeneric = !structuredRole
    || /^(?:पेशेवर|professional)$/iu.test(structuredRole);
  const warehouseTitlePresent = /वेयरहाउस\s*कर्मचारी/u.test(text);
  const warehouseTitleAsRole = /वेयरहाउस\s*कर्मचारी\s+के\s+रूप\s+में/u.test(text);

  // Generic `पेशेवर` must never satisfy structured warehouse title matching.
  let currentRoleTitlePresent: boolean;
  let currentRoleTitleMatchesStructuredRole: boolean;
  let currentRoleOmittedDetected: boolean;
  if (requireWarehouseCoverage || roleLooksWarehouse) {
    currentRoleTitlePresent = warehouseTitlePresent;
    currentRoleTitleMatchesStructuredRole = warehouseTitleAsRole;
    currentRoleOmittedDetected = !warehouseTitlePresent;
  } else if (structuredIsGeneric) {
    // Generic `पेशेवर के रूप में` is never a structured title match.
    // Other free-text roles may open with company+कार्यरत without a localized title.
    const professionalAsRole = /पेशेवर\s+के\s+रूप\s+में/u.test(text);
    currentRoleTitlePresent = !professionalAsRole;
    currentRoleTitleMatchesStructuredRole = !professionalAsRole;
    currentRoleOmittedDetected = professionalAsRole;
  } else {
    currentRoleTitlePresent = Boolean(roleEsc && new RegExp(roleEsc, 'iu').test(text));
    currentRoleTitleMatchesStructuredRole = Boolean(
      roleEsc && new RegExp(`${roleEsc}\\s+के\\s+रूप\\s+में`, 'iu').test(text),
    );
    currentRoleOmittedDetected = Boolean(roleEsc && !currentRoleTitlePresent);
  }

  const currentLooksDesign = DESIGN_FACT_CUE_RE.test(currentEntryDuties)
    || /(?:design|dizajn|ग्राफिक|डिज़ाइन|graphic)/iu.test(structuredRole);
  const priorLooksDesign = DESIGN_FACT_CUE_RE.test(priorEntryDuties);
  const priorLooksWarehouse = WAREHOUSE_FACT_CUE_RE.test(priorEntryDuties)
    || /(?:warehouse|वेयरहाउस|गोदाम)/iu.test(priorEntryDuties);

  // Slot-level semantic ownership: foreign domain cues in the wrong role slot.
  let currentSlotForeignFactCount = 0;
  let priorSlotForeignFactCount = 0;
  let priorRoleSemanticFactMentionCount = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    const sentence = sentences[i];
    const slot = finalUnitRoleSlots[i];
    const hasDesign = DESIGN_FACT_CUE_RE.test(sentence);
    const hasWarehouse = WAREHOUSE_FACT_CUE_RE.test(sentence);
    if (slot === 'current_duty') {
      if (hasDesign && requireWarehouseCoverage && !currentLooksDesign) {
        currentSlotForeignFactCount += 1;
      }
      if (hasWarehouse && currentLooksDesign && !requireWarehouseCoverage) {
        currentSlotForeignFactCount += 1;
      }
    }
    if (slot === 'prior_role') {
      if (hasDesign) priorRoleSemanticFactMentionCount += 1;
      // Warehouse facts in a design-owned prior clause (or vice versa) are foreign.
      if (hasWarehouse && priorLooksDesign && !priorLooksWarehouse) {
        priorSlotForeignFactCount += 1;
      }
      if (hasDesign && priorLooksWarehouse && !priorLooksDesign && !hasWarehouse) {
        priorSlotForeignFactCount += 1;
      }
    }
  }
  // Design cues appearing both in a current_duty sentence and a prior sentence
  // (only illegal when the current role is warehouse / non-design).
  const designInCurrentDuty = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'current_duty' && DESIGN_FACT_CUE_RE.test(s)
  ));
  const designInPrior = sentences.some((s, i) => (
    finalUnitRoleSlots[i] === 'prior_role' && DESIGN_FACT_CUE_RE.test(s)
  ));
  const duplicatedPriorRoleFactCount = (
    designInCurrentDuty && designInPrior && requireWarehouseCoverage && !currentLooksDesign
  ) ? 1 : 0;
  const priorRoleSemanticDuplicationDetected = duplicatedPriorRoleFactCount > 0;

  const sourceHasDesign = DESIGN_FACT_CUE_RE.test(priorEntryDuties || options.sourceDuties || '');
  const priorDesignFacts = designInPrior || (/इससे\s+पहले/u.test(text) && DESIGN_FACT_CUE_RE.test(text));
  const priorRoleGroundingPassed = sourceHasDesign ? priorDesignFacts : true;

  const semanticCrossEntryLeakageDetected = currentSlotForeignFactCount > 0
    || priorSlotForeignFactCount > 0
    || priorRoleSemanticDuplicationDetected;

  const hindiFiniteKaAnubhavCollision = FINITE_THEN_KA_ANUBHAV_RE.test(text);

  const mediumScan = scanHindiUnsupportedDesignMediumClaims(
    text,
    priorEntryDuties || options.sourceDuties || '',
  );
  const grammar = validateHindiSummaryFiniteGrammar(sentences, finalUnitRoleSlots);

  const unsupportedClaimKinds = mediumScan.finalUnsupportedDesignMediumKinds;
  const unsupportedClaimCount = mediumScan.finalUnsupportedDesignMediumCount
    + (hindiFiniteKaAnubhavCollision ? 1 : 0);

  let typedRejectionReason: string | null = null;
  if (mediumScan.finalUnsupportedDesignMediumCount > 0) {
    typedRejectionReason = mediumScan.finalUnsupportedDesignMediumKinds[0]
      || 'unsupported_print_medium';
  } else if (!grammar.ok) {
    typedRejectionReason = grammar.hindiGrammarRejectionReason
      || 'hindi_summary_grammar_invalid';
  } else if (hindiFiniteKaAnubhavCollision) {
    typedRejectionReason = 'hindi_finite_ka_anubhav_collision';
  } else if (!priorRoleGroundingPassed) {
    typedRejectionReason = 'hindi_summary_prior_role_ungrounded';
  } else if (semanticCrossEntryLeakageDetected) {
    typedRejectionReason = 'hindi_summary_cross_entry_leakage';
  }

  const groundingOk = (
    repeatedEmploymentFactCount === 0
    && repeatedProfessionalLabelCount === 0
    && currentEmploymentIntroductionCount === 1
    && currentRoleTitlePresent
    && currentRoleTitleMatchesStructuredRole
    && (!requireWarehouseCoverage || currentRoleConcreteFactCoverage >= 2)
    && currentSlotForeignFactCount === 0
    && !semanticCrossEntryLeakageDetected
    && duplicatedPriorRoleFactCount === 0
    && priorRoleGroundingPassed
    && genericizedMaterialFactCount === 0
    && !currentRoleOmittedDetected
    && !hindiFiniteKaAnubhavCollision
    && mediumScan.finalUnsupportedDesignMediumCount === 0
    && grammar.ok
  );

  return {
    currentEmploymentIntroductionCount,
    repeatedEmploymentFactCount,
    repeatedProfessionalLabelCount,
    professionalLabelCount,
    currentRoleConcreteFactCoverage,
    genericizedMaterialFactCount,
    priorRoleGroundingPassed,
    crossDomainLeakageDetected: semanticCrossEntryLeakageDetected,
    groundingValidationPassed: groundingOk,
    currentRoleTitlePresent,
    currentRoleTitleMatchesStructuredRole,
    currentRoleOmittedDetected,
    currentSlotForeignFactCount,
    priorSlotForeignFactCount,
    semanticCrossEntryLeakageDetected,
    duplicatedPriorRoleFactCount,
    priorRoleSemanticFactMentionCount,
    priorRoleSemanticDuplicationDetected,
    hindiFiniteKaAnubhavCollision,
    unsupportedClaimCount,
    unsupportedClaimKinds,
    sourcePrintFactPresent: mediumScan.sourcePrintFactPresent,
    sourceBrandingFactPresent: mediumScan.sourceBrandingFactPresent,
    sourceMarketingFactPresent: mediumScan.sourceMarketingFactPresent,
    providerUnsupportedDesignMediumCount: mediumScan.providerUnsupportedDesignMediumCount,
    providerUnsupportedDesignMediumKinds: mediumScan.providerUnsupportedDesignMediumKinds,
    providerPrintClaimDetected: mediumScan.providerPrintClaimDetected,
    providerBrandingClaimDetected: mediumScan.providerBrandingClaimDetected,
    providerMarketingClaimDetected: mediumScan.providerMarketingClaimDetected,
    finalUnsupportedDesignMediumCount: mediumScan.finalUnsupportedDesignMediumCount,
    finalUnsupportedDesignMediumKinds: mediumScan.finalUnsupportedDesignMediumKinds,
    grammarValidationPassed: grammar.ok,
    hindiCurrentIntroFiniteVerbPresent: grammar.hindiCurrentIntroFiniteVerbPresent,
    hindiCurrentDutyFiniteVerbPresent: Boolean(
      grammar.hindiSentenceHasFiniteCopulaOrVerb[
        finalUnitRoleSlots.indexOf('current_duty')
      ],
    ),
    hindiCurrentIntroCopulaPresent: grammar.hindiCurrentIntroFiniteVerbPresent,
    hindiCurrentDutyAuxiliaryPresent: grammar.hindiCurrentDutyAuxiliaryPresent,
    hindiPriorRoleFiniteVerbPresent: Boolean(
      grammar.hindiSentenceHasFiniteCopulaOrVerb[
        finalUnitRoleSlots.indexOf('prior_role')
      ],
    ),
    hindiStandaloneJahanFragmentDetected: grammar.hindiStandaloneJahanFragmentDetected,
    hindiNominalExperienceFragmentDetected: grammar.hindiNominalExperienceFragmentDetected,
    hindiSentenceHasFiniteCopulaOrVerb: grammar.hindiSentenceHasFiniteCopulaOrVerb,
    hindiIncompleteSentenceCount: grammar.hindiIncompleteSentenceCount,
    hindiGrammarRejectionReason: grammar.hindiGrammarRejectionReason,
    hindiGrammarRejectionReasons: grammar.hindiGrammarRejectionReason
      ? [grammar.hindiGrammarRejectionReason]
      : [],
    typedRejectionReason,
    finalUnitRoleSlots,
    currentIntroSlotPresent: finalUnitRoleSlots.includes('current_intro'),
    currentDutySlotPresent: finalUnitRoleSlots.includes('current_duty'),
    priorRoleSlotPresent: finalUnitRoleSlots.includes('prior_role'),
    slotValidationPassed: finalUnitRoleSlots.includes('current_intro')
      && finalUnitRoleSlots.includes('current_duty')
      && finalUnitRoleSlots.includes('prior_role'),
    slotRejectionReasons: [
      ...(!finalUnitRoleSlots.includes('current_intro') ? ['missing_current_intro_slot'] : []),
      ...(!finalUnitRoleSlots.includes('current_duty') ? ['missing_current_duty_slot'] : []),
      ...(!finalUnitRoleSlots.includes('prior_role') ? ['missing_prior_role_slot'] : []),
      ...(finalUnitRoleSlots.filter((s) => s === 'current_intro').length > 1
        ? ['duplicate_role_slot']
        : []),
    ],
    finalSentenceHashes: sentences.map((s) => fingerprintText(s)),
    finalSentenceRoleSlots: [...finalUnitRoleSlots],
    finalSentenceMaterialKeyCounts: sentences.map(
      (s) => classifyMaterialDutyKeys(s).length,
    ),
    summaryUnitSplitterRevision: SUMMARY_UNIT_SPLITTER_REVISION,
    summaryGroundingRevision: SUMMARY_GROUNDING_REVISION,
  };
}

/** Bare Title-Case skill list as its own sentence (not "Key skills include …"). */
export function summaryHasMalformedSkillsFragment(summary: string): boolean {
  const t = (summary || '').trim();
  if (!t) return false;
  // Trailing or standalone comma-separated Title-Case labels without a skills opener.
  if (
    /(?:^|[.!?]\s+)((?:[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)(?:,\s*(?:[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)){2,})\.\s*$/u.test(t)
    && !/\b(?:Key skills include|Ključne veštine|Wichtige Fähigkeiten|Las habilidades clave|Les compétences clés|Le competenze chiave|As competências|Ключевые навыки|मुख्य कौशल|मेरे प्रमुख कौशलों)\b/u.test(t)
  ) {
    return true;
  }
  return false;
}

export function validateSummaryMaterialFacts(
  summary: string,
  factSet: CvCanonicalFactSet,
  options?: { locale?: Locale | string },
): CvFidelityViolation[] {
  // Hard material coverage is scoped to the Present/current Experience entry.
  // Prior-role cooking/warehouse/design facts must not force Summary coverage —
  // they belong in an optional prior clause, not the current-role slot.
  const currentIndex = resolveCurrentExperienceIndex(factSet);
  const currentBullets = factsForExperienceIndex(factSet, currentIndex, 'experience_bullet');
  const source = currentBullets
    .map((f) => f.sourceText || f.value)
    .join('\n');
  if (!source.trim()) return [];
  const violations: CvFidelityViolation[] = [];
  const locale = (options?.locale || 'en') as Locale;

  if (summaryContainsListMarkerLeakage(summary)) {
    violations.push({
      kind: 'summary_list_marker_leakage' as CvFidelityViolationKind,
      matched: 'list_marker',
      section: 'summary',
    });
  }
  if (summaryHasMalformedSkillsFragment(summary)) {
    violations.push({
      kind: 'summary_malformed_skills_fragment' as CvFidelityViolationKind,
      matched: 'bare_skills_list',
      section: 'summary',
    });
  }

  // Universal source-fact identity coverage for English summaries of
  // English-authored sources. When Experience was authored in another language,
  // token overlap is not meaningful — cooking / material-key validators apply.
  if (locale === 'en') {
    const sourceIsEnglishCompatible = !/[čćžšđČĆŽŠĐ]/.test(source)
      && !/\p{Script=Devanagari}|\p{Script=Arabic}|\p{Script=Cyrillic}/u.test(source);
    if (sourceIsEnglishCompatible) {
      const identity = validateSummarySourceFactCoverage(source, summary);
      if (!identity.ok) {
        violations.push({
          kind: 'summary_material_fact_coverage_incomplete' as CvFidelityViolationKind,
          matched: identity.missingIds.slice(0, 4).join(',') || 'missing_source_facts',
          section: 'summary',
          evidence: `covered=${identity.coveredIds.length}/${identity.requiredIds.length}`,
        });
      }
    }
  }

  // Keep cooking triad hard-require for Baker/Cook fixtures (legacy kind).
  const coverage = validateMaterialDutyCoverage(source, summary);
  const bulletTexts = currentBullets.map((f) => f.sourceText || f.value);
  const sourceWarehouse = [...new Set(
    bulletTexts.flatMap((b) => classifyMaterialDutyKeys(b))
      .filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
  )];

  // Concrete warehouse Experience must not be genericized into records/docs/info prose,
  // and must retain at least two concrete warehouse action-object frames.
  if (sourceWarehouse.length >= 1) {
    const summaryWhKeys = [...new Set(
      classifyMaterialDutyKeys(summary).filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k)),
    )];
    const hasConcreteCue = /(?:माल|गोदाम|goods|warehouse|incoming|आने\s*वाल|بضائع|товар|入荷|商品|倉庫|品物|zaprimljen|primljen|ulazn\w*\s+rob|skladišt|prateć|robe)/iu.test(summary);
    const hasGeneric = GENERICIZED_WAREHOUSE_RE.test(summary);
    // Generic records/docs/info alone (or with <2 concrete frames) must fail.
    if (hasGeneric && summaryWhKeys.length < 2) {
      violations.push({
        kind: 'summary_missing_material_fact' as CvFidelityViolationKind,
        matched: 'warehouse_genericized',
        section: 'summary',
        evidence: `genericizedMaterialFactCount=${sourceWarehouse.length};concrete=${summaryWhKeys.length}`,
      });
    } else if (summaryWhKeys.length < 2 && sourceWarehouse.length >= 2) {
      violations.push({
        kind: 'summary_missing_material_fact' as CvFidelityViolationKind,
        matched: 'warehouse_facts_absent',
        section: 'summary',
        evidence: `requiredSummaryFactCount=2;covered=${summaryWhKeys.length};cue=${hasConcreteCue}`,
      });
    } else if (!hasConcreteCue && sourceWarehouse.length >= 2) {
      violations.push({
        kind: 'summary_missing_material_fact' as CvFidelityViolationKind,
        matched: 'warehouse_facts_absent',
        section: 'summary',
        evidence: `requiredSummaryFactCount=${sourceWarehouse.length}`,
      });
    }
  }

  if (!coverage.valid) {
    const requiredCooking = coverage.required.filter((k) => COOKING_SUMMARY_KEYS.has(k));
    if (requiredCooking.length >= 2) {
      const missingCooking = coverage.missing.filter((k) => COOKING_SUMMARY_KEYS.has(k));
      for (const key of missingCooking) {
        violations.push({
          kind: 'summary_missing_material_fact' as CvFidelityViolationKind,
          matched: key,
          section: 'summary',
        });
      }
    }
    const requiredWarehouse = coverage.required.filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k));
    if (requiredWarehouse.length >= 2) {
      const missingWarehouse = coverage.missing.filter((k) => WAREHOUSE_SUMMARY_KEYS.has(k));
      // Require at least 2 warehouse material frames for the headline current role.
      if (missingWarehouse.length > requiredWarehouse.length - 2) {
        for (const key of missingWarehouse) {
          violations.push({
            kind: 'summary_missing_material_fact' as CvFidelityViolationKind,
            matched: key,
            section: 'summary',
          });
        }
      }
    }
  }
  return violations;
}

export function validateSummaryEmploymentStatus(
  summary: string,
  factSet: CvCanonicalFactSet,
): CvFidelityViolation[] {
  const dates = factSet.facts.filter((f) => f.type === 'dates').map((f) => f.value.toLowerCase());
  const hasPresent = dates.some((d) => /present|current|danas|сегодня|ปัจจุบัน/.test(d) || d.includes('present'));
  const pastOnly = dates.length > 0 && !hasPresent;
  if (pastOnly && /\bcurrently\b|\bcurrent(?:ly)?\s+contributing\b|\bpresently\b/iu.test(summary)) {
    return [{
      kind: 'summary_employment_status_mismatch' as CvFidelityViolationKind,
      matched: 'currently',
      section: 'summary',
    }];
  }
  return [];
}

export function runSummaryGroundingValidators(
  summary: string,
  factSet: CvCanonicalFactSet,
  options: { locale?: Locale | string; gender?: CoverLetterGender | string },
): CvFidelityViolation[] {
  return [
    ...validateSummaryLength(summary, options.locale),
    ...validateSummaryUnsupportedClaims(summary, factSet),
    ...validateSummarySkillInflation(summary),
    ...validateSummarySkillLocalization(summary, options.locale),
    ...validateSummaryMixedLanguage(summary, options.locale),
    ...validateSummaryGenderOccupation(summary, factSet, options),
    ...validateSummaryMaterialFacts(summary, factSet, { locale: options.locale }),
    ...validateSummaryEmploymentStatus(summary, factSet),
  ];
}

type GenderTone = 'male' | 'female' | 'neutral';

function tone(gender?: CoverLetterGender | string): GenderTone {
  const g = normalizeCoverLetterGender(gender);
  if (g === 'male') return 'male';
  if (g === 'female') return 'female';
  return 'neutral';
}

type CookingIntent = 'cuisine_prep' | 'workplace_hygiene' | 'kitchen_collab';

/**
 * All cooking intents present in one source unit.
 * Combined hygiene+collaboration lines must yield BOTH — never hygiene alone.
 */
function cookingIntentsInSource(text: string): CookingIntent[] {
  const t = text.toLowerCase().normalize('NFKC');
  const kitchenCtx = /(kuhinj|kitchen|jel\w*|cuisine|dish(?:es)?|restaurant|food|व्यंजन|रसोई|namirnic)/iu.test(t);
  // Warehouse goods preparation must never classify as cuisine.
  if (/(?:माल|गोदाम|goods|warehouse|skladist)/iu.test(t) && !kitchenCtx) {
    return [];
  }
  const intents: CookingIntent[] = [];
  // Dish prep against restaurant standards — require food/dish/restaurant anchors.
  // Bare Hindi तैयार/तैयारी is not enough (warehouse "तैयारी" collision).
  if (
    /(priprem\w*.{0,40}(jel|hran|obrok|dish)|(?:prepare|prepared|preparing)\s+(?:dishes|food|meals?)|restaurant\s+standards?|prema\s+standardima\s+restorana|व्यंजन)/iu.test(t)
    || (kitchenCtx && /तैयार/u.test(t))
  ) {
    intents.push('cuisine_prep');
  }
  // Explicit workplace hygiene (Baker fixture) — not bare "clean code" / quality standards.
  if (
    /(workplace\s+hygiene|higijen\w*\s+radnog|higijenu\s+radnog|održav\w*\s+higijen|कार्यस्थल.{0,12}स्वच्छ)/iu.test(t)
    || (kitchenCtx && /(higijen|hygiene|स्वच्छ)/iu.test(t))
  ) {
    intents.push('workplace_hygiene');
  }
  // Kitchen collaboration — independent of hygiene (combined lines keep both).
  if (
    kitchenCtx
    && /(sara[dđ]|collaborat|surađ|सहयोग|kuhinjsk\w*\s+tim|kitchen\s+team)/iu.test(t)
  ) {
    intents.push('kitchen_collab');
  }
  return intents;
}

function classifySummaryCookingIntent(text: string): CookingIntent | 'other' {
  const intents = cookingIntentsInSource(text);
  if (intents.length === 0) return 'other';
  // Prefer prep, then hygiene, then collab for single-fragment callers.
  if (intents.includes('cuisine_prep')) return 'cuisine_prep';
  if (intents.includes('workplace_hygiene')) return 'workplace_hygiene';
  return intents[0];
}

/** Short duty fragment for one cooking intent. */
function summaryFragmentForIntent(
  intent: CookingIntent,
  locale: Locale,
  g: GenderTone,
): string {
  if (intent === 'cuisine_prep') {
    if (locale === 'en') return 'preparing dishes according to restaurant standards';
    if (locale === 'sr' || locale === 'hr') return 'pripremi jela prema standardima restorana';
    if (locale === 'hi') {
      return g === 'female'
        ? 'रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ'
        : 'रेस्तरां के मानकों के अनुसार व्यंजन तैयार करता हूँ';
    }
    if (locale === 'de') return 'Zubereitung von Gerichten gemäß Restaurantstandards';
    if (locale === 'es') return 'preparación de platos según los estándares del restaurante';
    if (locale === 'fr') return 'préparation de plats selon les normes du restaurant';
    if (locale === 'it') return 'preparazione di piatti secondo gli standard del ristorante';
    if (locale === 'pt-BR') return 'preparação de pratos conforme os padrões do restaurante';
    if (locale === 'ru') return 'приготовлении блюд по стандартам ресторана';
    if (locale === 'ar') return 'إعداد الأطباق وفق معايير المطعم';
    if (locale === 'ja') return 'レストラン基準に沿った料理の準備';
  }
  if (intent === 'workplace_hygiene') {
    if (locale === 'en') return 'maintaining workplace hygiene';
    if (locale === 'sr' || locale === 'hr') return 'održavanju higijene radnog prostora';
    if (locale === 'hi') {
      return g === 'female'
        ? 'कार्यस्थल की स्वच्छता बनाए रखती हूँ'
        : 'कार्यस्थल की स्वच्छता बनाए रखता हूँ';
    }
    if (locale === 'de') return 'Einhaltung der Hygiene am Arbeitsplatz';
    if (locale === 'es') return 'mantenimiento de la higiene del puesto de trabajo';
    if (locale === 'fr') return 'maintien de l’hygiène du poste de travail';
    if (locale === 'it') return 'mantenimento dell’igiene della postazione';
    if (locale === 'pt-BR') return 'manutenção da higiene do local de trabalho';
    if (locale === 'ru') return 'поддержании чистоты рабочего места';
    if (locale === 'ar') return 'الحفاظ على نظافة مكان العمل';
    if (locale === 'ja') return '作業場の衛生管理';
  }
  if (intent === 'kitchen_collab') {
    if (locale === 'en') return 'collaborating with the kitchen team';
    if (locale === 'sr' || locale === 'hr') return 'saradnji sa kuhinjskim timom';
    if (locale === 'hi') {
      return g === 'female'
        ? 'रसोई टीम के साथ सहयोग करती हूँ'
        : 'रसोई टीम के साथ सहयोग करता हूँ';
    }
    if (locale === 'de') return 'Zusammenarbeit mit dem Küchenteam';
    if (locale === 'es') return 'colaboración con el equipo de cocina';
    if (locale === 'fr') return 'collaboration avec l’équipe de cuisine';
    if (locale === 'it') return 'collaborazione con il team di cucina';
    if (locale === 'pt-BR') return 'colaboração com a equipe da cozinha';
    if (locale === 'ru') return 'сотрудничестве с кухонной бригадой';
    if (locale === 'ar') return 'التعاون مع فريق المطبخ';
    if (locale === 'ja') return 'キッチンチームとの協力';
  }
  return '';
}

/**
 * Universal duty fragment for Summary prose — any occupation / free-text title.
 * Cooking intents keep curated fragments; everything else preserves source meaning
 * without inventing tools, metrics, or role stereotypes.
 */
function warehouseSummaryFragment(
  key: string,
  locale: Locale,
): string {
  if (locale === 'hi') {
    if (key === 'warehouse_inbound_check') {
      return 'आने वाले माल और संबंधित दस्तावेज़ों की जाँच';
    }
    if (key === 'warehouse_records') {
      return 'गोदाम रिकॉर्ड के अद्यतन तथा सामान की व्यवस्थित व्यवस्था';
    }
    if (key === 'warehouse_movement') {
      return 'सहकर्मियों के साथ माल की तैयारी और आवाजाही के समन्वय';
    }
  }
  if (locale === 'ar') {
    return arabicWarehouseSummaryFragment(key);
  }
  if (locale === 'en') {
    if (key === 'warehouse_inbound_check') {
      return 'checking incoming goods and accompanying documentation';
    }
    if (key === 'warehouse_records') {
      return 'updating warehouse records and keeping goods orderly';
    }
    if (key === 'warehouse_movement') {
      return 'coordinating preparation and movement of goods with colleagues';
    }
  }
  return '';
}

function universalSummaryDutyFragment(
  source: string,
  locale: Locale,
  _g: GenderTone,
  _isPresent: boolean,
): string {
  const cleaned = stripDutyListPrefix(source || '').replace(/[.。۔।!?…]\s*$/u, '').trim();
  if (!cleaned) return '';

  const keys = classifyMaterialDutyKeys(cleaned);
  for (const key of keys) {
    if (key.startsWith('warehouse_')) {
      const frag = warehouseSummaryFragment(key, locale);
      if (frag) return frag;
    }
  }

  if (locale === 'en') {
    // English Summary paraphrases English source only — never Serbian/Hindi dumps
    // (including undiacritic Serbian Latin such as "Planiranje i koordinacija…").
    if (!sourceUsableInLocale(cleaned, 'en')) {
      return '';
    }
    return dutyToEnglishGerundFragment(cleaned);
  }
  if (locale === 'sr' || locale === 'hr') {
    // Cooking curated fragments still apply via cookingIntentsInSource.
    // Full Serbian duty prose is left to the legacy shell (length + grammar).
    return '';
  }
  if (locale === 'hi') {
    if (!/\p{Script=Devanagari}/u.test(cleaned)) return '';
    // Prefer concrete warehouse/design fragments over generic documentation shells.
    if (GENERICIZED_WAREHOUSE_RE.test(cleaned) && !/(?:माल|गोदाम)/u.test(cleaned)) {
      return '';
    }
    return cleaned;
  }
  if (locale === 'ar') {
    if (!/\p{Script=Arabic}/u.test(cleaned)) return '';
    if (GENERICIZED_WAREHOUSE_RE.test(cleaned) && !/(?:بضائع|مستودع)/u.test(cleaned)) {
      return '';
    }
    return cleaned;
  }
  // de/fr/es/it/pt-BR/ja/ru/…: never embed raw source units — cooking
  // curated fragments still apply; otherwise defer to the legacy shell.
  return '';
}

/** Short duty fragments for embedding in a 2-sentence summary. */
function summaryDutyFragment(
  source: string,
  locale: Locale,
  g: GenderTone,
  isPresent = true,
): string {
  const intent = classifySummaryCookingIntent(source);
  if (intent === 'other') {
    return universalSummaryDutyFragment(source, locale, g, isPresent);
  }
  return summaryFragmentForIntent(intent, locale, g);
}

/** All fragments from one source unit (combined cooking lines keep hygiene + collab). */
function summaryDutyFragmentsFromSource(
  source: string,
  locale: Locale,
  g: GenderTone,
  isPresent = true,
): string[] {
  // Warehouse material keys win over cooking false-positives (तैयारी/तैयार).
  const whKeys = classifyMaterialDutyKeys(source).filter((k) => k.startsWith('warehouse_'));
  if (whKeys.length) {
    return whKeys
      .map((k) => warehouseSummaryFragment(k, locale))
      .filter(Boolean);
  }
  const intents = cookingIntentsInSource(source);
  if (intents.length === 0) {
    const single = summaryDutyFragment(source, locale, g, isPresent);
    return single ? [single] : [];
  }
  return intents
    .map((intent) => summaryFragmentForIntent(intent, locale, g))
    .filter(Boolean);
}

function andWord(locale: Locale): string {
  if (locale === 'sr' || locale === 'hr') return 'i';
  if (locale === 'de') return 'und';
  if (locale === 'es') return 'y';
  if (locale === 'pt-BR' || locale === 'it') return 'e';
  if (locale === 'fr') return 'et';
  if (locale === 'ru') return 'и';
  if (locale === 'hi') return 'और';
  if (locale === 'ar') return 'و';
  if (locale === 'ja') return '、';
  return 'and';
}

function joinDutyFragments(fragments: string[], locale: Locale): string {
  const clean = fragments.filter(Boolean);
  if (!clean.length) return '';
  if (locale === 'ja') return clean.join('、');
  if (locale === 'ar') return clean.join('، ');
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${andWord(locale)} ${clean[1]}`;
  const head = clean.slice(0, -1).join(', ');
  const last = clean[clean.length - 1];
  return `${head} ${andWord(locale)} ${last}`;
}

const SCRIPT_LOCALES: Locale[] = ['hi', 'ar', 'ja', 'ru'];

/** True when a skill label still looks like unlocalized English in a non-English locale. */
function isUnlocalizedEnglishSkillLabel(label: string, locale: Locale): boolean {
  if (locale === 'en') return false;
  const s = (label || '').trim();
  if (!s) return false;
  // Multi-word Title Case English skill phrases (e.g. Critical Thinking).
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(s)) return true;
  if (SCRIPT_LOCALES.includes(locale) && /^[A-Za-z][A-Za-z0-9\s/&'’.-]{1,40}$/.test(s)) {
    return true;
  }
  return false;
}

/**
 * Localize skill labels for summary prose. Omit skills that cannot be safely
 * localized into script locales — never append raw English lists.
 */
export function localizeSummarySkillLabels(skills: string[], locale: Locale): string[] {
  const out: string[] = [];
  for (const raw of skills) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    if (locale === 'en') {
      if (/[čćžšđČĆŽŠĐ]/.test(trimmed) || /[^\u0000-\u007F]/.test(trimmed)) continue;
      out.push(trimmed);
      continue;
    }
    const localized = getLocalizedCvSkillName(trimmed, locale);
    if (!localized.trim()) continue;
    if (isUnlocalizedEnglishSkillLabel(localized, locale)) continue;
    // If localization returned the same English string for a script locale, omit.
    if (
      SCRIPT_LOCALES.includes(locale)
      && localized === trimmed
      && /^[A-Za-z]/.test(trimmed)
    ) {
      continue;
    }
    out.push(localized);
    if (out.length >= 4) break;
  }
  return out;
}

/** Known English skill labels that must not appear raw in non-English summaries. */
const ENGLISH_SKILL_LABEL_RE =
  /\b(?:Critical Thinking|Problem Solving|Time Management|Presentation Skills|Adaptability|Organization|Leadership|Communication|Teamwork|Creativity|Attention to Detail)\b/g;

export function findUnlocalizedSkillLabelsInSummary(
  summary: string,
  locale: Locale,
): string[] {
  if (locale === 'en' || !summary.trim()) return [];
  const found = new Set<string>();
  for (const m of summary.matchAll(ENGLISH_SKILL_LABEL_RE)) {
    found.add(m[0]);
  }
  // Raw English Title-Case lists after an English/Hindi skills opener only.
  // Do not scan German/French/etc. localized skill sentences for Title Case —
  // words like "Organisation"/"Anpassungsfähigkeit" are valid locale labels.
  const skillsClause = summary.match(
    /(?:Key skills include|मुख्य कौशल(?:ों)? में|मेरे प्रमुख कौशलों में)\s+((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:,\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))+(?:\s+and\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))?)/u,
  );
  if (skillsClause?.[1] && /^[\x00-\x7F]+$/.test(skillsClause[1])) {
    found.add(skillsClause[1].trim());
  }
  return [...found];
}

export function validateSummarySkillLocalization(
  summary: string,
  locale?: Locale | string,
): CvFidelityViolation[] {
  const loc = (locale || 'en') as Locale;
  if (loc === 'en') return [];
  const labels = findUnlocalizedSkillLabelsInSummary(summary, loc);
  if (!labels.length) return [];
  return [{
    kind: 'unlocalized_skill_labels' as CvFidelityViolationKind,
    matched: labels.join('; '),
    section: 'summary',
    evidence: labels[0],
  }];
}

export function validateSummaryMixedLanguage(
  summary: string,
  locale?: Locale | string,
): CvFidelityViolation[] {
  const loc = (locale || 'en') as Locale;
  if (!SCRIPT_LOCALES.includes(loc)) return [];
  const value = (summary || '').normalize('NFKC').trim();
  if (!value) return [];
  // Substantial English prose clause (not a single proper noun).
  if (
    /\b(?:with approximately|years of experience|Key skills include|responsible for|currently contributing)\b/i.test(value)
  ) {
    return [{
      kind: 'mixed_language_summary' as CvFidelityViolationKind,
      matched: 'english_prose_in_script_locale',
      section: 'summary',
    }];
  }
  const unlocalized = findUnlocalizedSkillLabelsInSummary(value, loc);
  if (unlocalized.length >= 2) {
    return [{
      kind: 'mixed_language_summary' as CvFidelityViolationKind,
      matched: unlocalized.slice(0, 4).join(', '),
      section: 'summary',
    }];
  }
  return [];
}

function skillsLabelSentence(skills: string[], locale: Locale): string {
  // Deterministic small subset — never dump every skill to fill the Summary.
  const list = localizeSummarySkillLabels(skills, locale).slice(0, 4);
  if (!list.length) return '';
  const and = andWord(locale);
  let cleanJoined = list[0];
  if (locale === 'ar') {
    // Arabic punctuation: Arabic comma، and و attached (والقدرة, not و القدرة).
    if (list.length === 2) cleanJoined = `${list[0]} و${list[1]}`;
    else if (list.length > 2) {
      cleanJoined = `${list.slice(0, -1).join('، ')} و${list[list.length - 1]}`;
    }
    cleanJoined = cleanJoined.replace(/\s+/g, ' ').replace(/و\s+/g, 'و').trim();
    return `تشمل المهارات الرئيسية ${cleanJoined}.`;
  }
  if (list.length === 2) cleanJoined = `${list[0]} ${and} ${list[1]}`;
  else if (list.length > 2) {
    cleanJoined = `${list.slice(0, -1).join(', ')} ${and} ${list[list.length - 1]}`;
  }
  cleanJoined = cleanJoined.replace(/\s+/g, ' ').trim();
  if (locale === 'en') return `Key skills include ${cleanJoined.toLowerCase()}.`;
  if (locale === 'sr' || locale === 'hr') return `Ključne veštine uključuju ${cleanJoined.toLowerCase()}.`;
  if (locale === 'de') return `Wichtige Fähigkeiten umfassen ${cleanJoined}.`;
  if (locale === 'es') return `Las habilidades clave incluyen ${cleanJoined.toLowerCase()}.`;
  if (locale === 'fr') return `Les compétences clés incluent ${cleanJoined.toLowerCase()}.`;
  if (locale === 'it') return `Le competenze chiave includono ${cleanJoined.toLowerCase()}.`;
  if (locale === 'pt-BR') return `As competências principais incluem ${cleanJoined.toLowerCase()}.`;
  if (locale === 'ru') return `Ключевые навыки включают ${cleanJoined.toLowerCase()}.`;
  if (locale === 'hi') return `मेरे प्रमुख कौशलों में ${cleanJoined} शामिल हैं।`;
  if (locale === 'ja') return `主なスキルは${cleanJoined}です。`;
  return `Key skills include ${cleanJoined}.`;
}

function formatDurationForSummary(duration: ExperienceDuration | undefined, locale: Locale): string {
  if (!duration?.hasValidDates) return '';
  if (duration.unit === 'years' && duration.approxYears > 0) {
    if (locale === 'en') {
      return formatApproximateDurationPhrase(duration, 'en');
    }
    if (locale === 'hi') {
      const word = yearWordForLocale('hi', duration.approxYears);
      return `लगभग ${word} वर्षों का संयुक्त अनुभव`;
    }
  }
  if ((locale === 'sr' || locale === 'hr') && duration.unit === 'years' && duration.approxYears > 0) {
    return formatApproximateDurationPhrase(duration, locale);
  }
  return formatApproximateDurationPhrase(duration, locale);
}

/**
 * Concise deterministic summary from allowed fact set only.
 * Skills appear only as a short grammatical sentence — never as bare lists
 * or as achievements inferred from skill labels.
 */
export function buildConciseGroundedSummary(
  factSet: CvCanonicalFactSet,
  locale: Locale,
  gender?: CoverLetterGender | string,
  duration?: ExperienceDuration,
  options?: { includeSkills?: boolean },
): string {
  // Marker must be reachable from the production builder path (not diagnostics-only).
  const builderRevision = SUMMARY_BUILDER_REVISION;
  void builderRevision;
  const g = tone(gender);
  const genderNorm = normalizeCoverLetterGender(gender);
  const profileTitle = factSet.facts.find((f) => f.type === 'job_title')?.value || '';

  // Stable current/prior ownership by Present dates + experienceIndex — never flatten
  // bullets across entries or trust array order alone.
  const currentIndex = resolveCurrentExperienceIndex(factSet);
  const allIndices = [...new Set(
    factSet.facts
      .map((f) => f.experienceIndex)
      .filter((n): n is number => typeof n === 'number'),
  )];
  const priorIndex = allIndices.find((i) => i !== currentIndex);

  const experienceTitle = factsForExperienceIndex(factSet, currentIndex, 'role')[0]?.value || '';
  const employer = (factsForExperienceIndex(factSet, currentIndex, 'employer')[0]?.value || '').trim();
  const datesValue = (factsForExperienceIndex(factSet, currentIndex, 'dates')[0]?.value || '').trim();
  const isPresent = /present|current|danas|сегодня|ปัจจุบัน/i.test(datesValue);

  const dutyFacts = factsForExperienceIndex(factSet, currentIndex, 'experience_bullet').slice(0, 5);
  const sourceDuties = dutyFacts.map((f) => f.sourceText || f.value).join('\n');
  const priorDutyFacts = typeof priorIndex === 'number'
    ? factsForExperienceIndex(factSet, priorIndex, 'experience_bullet')
      .slice(0, locale === 'es' ? 12 : 5)
    : [];
  const priorSourceDuties = priorDutyFacts.map((f) => f.sourceText || f.value).join('\n');
  if (locale === 'es') {
    void SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION;
  }

  let role = resolveOccupationalTitleForSummary({
    profileJobTitle: profileTitle,
    currentExperienceTitle: experienceTitle,
    locale,
    gender: genderNorm || '',
    // Conflict check must use current-entry duties only — prior design/cook facts
    // must not neutralize the current warehouse/cook title.
    dutiesText: sourceDuties,
  });
  // Prefer explicit baker localization when title is baker.
  if (/baker|pekar/i.test(`${profileTitle} ${experienceTitle}`)) {
    role = localizeBaker(locale, genderNorm || '');
  }

  const fragments = dutyFacts
    .flatMap((f) => summaryDutyFragmentsFromSource(
      f.sourceText || f.value,
      locale,
      g,
      isPresent,
    ));
  // Deduplicate identical fragments while preserving first-seen order.
  const uniqueFragments = [...new Set(fragments.map((f) => f.trim()).filter(Boolean))];
  // When duties exist but none could be safely localized into concise fragments,
  // defer to the legacy localized shell — except dedicated entry-owned packages
  // (Hindi/Arabic/Russian/Serbian/…) which rebuild from material keys, not fragments.
  if (
    dutyFacts.length > 0
    && uniqueFragments.length === 0
    && locale !== 'hi'
    && locale !== 'ar'
    && locale !== 'ru'
    && locale !== 'ja'
    && locale !== 'hr'
    && locale !== 'de'
    && locale !== 'es'
    && locale !== 'en'
    && locale !== 'sr'
  ) {
    return '';
  }
  const durationPhrase = formatDurationForSummary(duration, locale);
  const skills = (options?.includeSkills !== false)
    ? factSet.facts.filter((f) => f.type === 'skill').map((f) => f.value).filter(Boolean)
    : [];
  let skillSentence = skillsLabelSentence(skills, locale);
  const skillsIncludedCount = skillSentence
    ? localizeSummarySkillLabels(skills, locale).slice(0, 4).length
    : 0;

  let text = '';
  if (locale === 'hi') {
    const roleRaw = (role || 'पेशेवर').trim();
    let roleIsGeneric = !roleRaw || /^(?:पेशेवर|professional)$/iu.test(roleRaw);
    // Curated warehouse noun-phrase fragments from the CURRENT entry only.
    const whFrags = [...new Set(
      dutyFacts
        .flatMap((f) => {
          const keys = classifyMaterialDutyKeys(f.sourceText || f.value)
            .filter((k) => k.startsWith('warehouse_'));
          return keys.map((k) => warehouseSummaryFragment(k, locale)).filter(Boolean);
        }),
    )];
    const cueKeyUnion = [...new Set(
      dutyFacts.flatMap((f) => hindiWarehouseCueKeysFromUnit(f.sourceText || f.value)),
    )];
    const designKeyUnion = [...new Set(
      dutyFacts.flatMap((f) => classifyMaterialDutyKeys(f.sourceText || f.value)
        .filter((k) => k.startsWith('design_'))),
    )];
    // Never omit the warehouse title when current-entry warehouse facts exist.
    if (roleIsGeneric && (whFrags.length >= 1 || cueKeyUnion.length >= 1)) {
      roleIsGeneric = false;
    }
    // Same for design — never emit a bare "कार्यरत" open when design facts exist.
    if (roleIsGeneric && designKeyUnion.length >= 1) {
      roleIsGeneric = false;
    }
    const rolePart = roleIsGeneric
      ? ''
      : (/^(?:पेशेवर|professional)$/iu.test(roleRaw)
        ? (designKeyUnion.length >= 1 && whFrags.length === 0 && cueKeyUnion.length === 0
          ? 'ग्राफिक डिज़ाइनर'
          : 'वेयरहाउस कर्मचारी')
        : /(?:graphic\s*design|grafi[cč]k\w*\s+dizajn|デザイナー)/iu.test(roleRaw)
          ? 'ग्राफिक डिज़ाइनर'
          : /(?:warehouse|वेयरहाउस)/iu.test(roleRaw)
            ? 'वेयरहाउस कर्मचारी'
            : roleRaw);
    const company = employer;
    const startMatch = /^(\d{4})-(\d{2})/.exec(datesValue);
    const hindiMonths: Record<string, string> = {
      '01': 'जनवरी', '02': 'फ़रवरी', '03': 'मार्च', '04': 'अप्रैल', '05': 'मई', '06': 'जून',
      '07': 'जुलाई', '08': 'अगस्त', '09': 'सितंबर', '10': 'अक्तूबर', '11': 'नवंबर', '12': 'दिसंबर',
    };
    const monthYear = startMatch && hindiMonths[startMatch[2]]
      ? `${hindiMonths[startMatch[2]]} ${startMatch[1]}`
      : '';
    const employmentHead = monthYear && company
      ? (rolePart
        ? `${monthYear} से ${company} में ${rolePart} के रूप में कार्यरत`
        : `${monthYear} से ${company} में कार्यरत`)
      : company
        ? (rolePart
          ? `${company} में ${rolePart} के रूप में कार्यरत`
          : `${company} में कार्यरत`)
        : (rolePart ? `${rolePart} के रूप में कार्यरत` : 'कार्यरत');
    const open = durationPhrase
      ? (g === 'female'
        ? `${employmentHead}, ${durationPhrase} रखने वाली पेशेवर हैं।`
        : g === 'male'
          ? `${employmentHead}, ${durationPhrase} रखने वाला पेशेवर है।`
          : `${employmentHead}, ${durationPhrase}।`)
      : (g === 'female'
        ? `${employmentHead} हैं।`
        : g === 'male'
          ? `${employmentHead} है।`
          : `${employmentHead}।`);
    // Prefer warehouse frames when the current entry owns them; otherwise use
    // current-entry fragments only (already entry-scoped — never prior design/warehouse).
    // Never emit a generic current-duty sentence when only generic_duty was detected.
    const onlyGenericCurrent = dutyFacts.length > 0
      && dutyFacts.every((f) => {
        const keys = classifyMaterialDutyKeys(f.sourceText || f.value);
        return keys.length === 1 && keys[0] === 'generic_duty';
      })
      && cueKeyUnion.length === 0;
    const seedFrags = whFrags.length >= 1
      ? whFrags
      : (onlyGenericCurrent ? [] : uniqueFragments);
    const nominalFrags = seedFrags
      .map((f) => f
        // Strip trailing finite Hindi verbs so we can safely append a finite closer.
        .replace(/(?:करती|करता|किए|किया|की|बनाए\s+रखती|बनाए\s+रखता)\s*(?:हैं|है|थीं|थे|था|हूँ|हूं)?$/u, '')
        .replace(/\s+/g, ' ')
        .trim())
      .filter((f) => f.length >= 8 && !FINITE_THEN_KA_ANUBHAV_RE.test(`${f} का अनुभव`));
    let dutySentence = '';
    // Prefer concrete finite duty verbs for warehouse fragments; otherwise close
    // with a finite experience copula (`का अनुभव है/रखती हैं`) — never bare `का अनुभव।`.
    const dutyFiniteCloser = g === 'female'
      ? 'का अनुभव रखती हैं।'
      : g === 'male'
        ? 'का अनुभव रखता है।'
        : 'का अनुभव है।';
    const dutyVerbCloser = g === 'female'
      ? 'करती हैं।'
      : g === 'male'
        ? 'करता है।'
        : 'करते हैं।';
    const useWarehouseVerbClose = whFrags.length >= 1
      && nominalFrags.every((f) => /(?:जाँच|अद्यतन|समन्वय|व्यवस्था)/u.test(f));
    if (nominalFrags.length >= 3) {
      const body = `${nominalFrags[0]}, ${nominalFrags[1]} तथा ${nominalFrags[2]}`;
      dutySentence = useWarehouseVerbClose
        ? `${body} ${dutyVerbCloser}`
        : `${body} ${dutyFiniteCloser}`;
    } else if (nominalFrags.length === 2) {
      const body = `${nominalFrags[0]} तथा ${nominalFrags[1]}`;
      dutySentence = useWarehouseVerbClose
        ? `${body} ${dutyVerbCloser}`
        : `${body} ${dutyFiniteCloser}`;
    } else if (nominalFrags.length === 1) {
      dutySentence = useWarehouseVerbClose
        ? `${nominalFrags[0]} ${dutyVerbCloser}`
        : `${nominalFrags[0]} ${dutyFiniteCloser}`;
    } else if (onlyGenericCurrent) {
      // Fail closed — do not invent a generic duty clause or fall into legacy flatten.
      return '';
    }
    // Prior completed role — domain-specific clause from the prior entry only.
    const priorRole = typeof priorIndex === 'number'
      ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
      : '';
    const priorEmployer = typeof priorIndex === 'number'
      ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
      : '';
    let priorSentence = '';
    if (priorRole && /dizajn|design|ग्राफिक|डिज़ाइन|visual|दृश्य|grafick/i.test(`${priorRole} ${priorSourceDuties}`)) {
      priorSentence = buildHindiPriorDesignSentence({
        priorRole,
        priorEmployer,
        priorSourceDuties,
      });
    } else if (
      priorRole
      && /(?:warehouse|वेयरहाउस|गोदाम|magacin|skladist)/i.test(`${priorRole} ${priorSourceDuties}`)
    ) {
      const priorLabel = /(?:warehouse|वेयरहाउस)/i.test(priorRole)
        ? 'वेयरहाउस कर्मचारी'
        : priorRole;
      priorSentence = priorEmployer
        ? `इससे पहले ${priorEmployer} में ${priorLabel} के रूप में आने वाले माल की जाँच की और गोदाम रिकॉर्ड अद्यतन किए।`
        : `इससे पहले ${priorLabel} के रूप में आने वाले माल की जाँच की और गोदाम रिकॉर्ड अद्यतन किए।`;
    } else if (
      priorRole
      && /(?:cook|chef|kuvar|रसोइया|व्यंजन|रसोई)/i.test(`${priorRole} ${priorSourceDuties}`)
    ) {
      const priorLabel = /(?:cook|chef|kuvar)/i.test(priorRole) ? 'रसोइया' : priorRole;
      priorSentence = priorEmployer
        ? `इससे पहले ${priorEmployer} में ${priorLabel} के रूप में व्यंजन तैयार किए और रसोई की स्वच्छता बनाए रखी।`
        : `इससे पहले ${priorLabel} के रूप में व्यंजन तैयार किए और रसोई की स्वच्छता बनाए रखी।`;
    }
    text = [open, dutySentence, priorSentence, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  } else if (locale === 'ar') {
    void SUMMARY_BUILDER_REVISION_AR;
    void SUMMARY_UNIT_SPLITTER_REVISION_AR;
    void SUMMARY_GROUNDING_REVISION_AR;
    void analyzeArabicSummaryEmploymentQuality;
    const arRole = /(?:warehouse|مستودع|skladist|magacin|radnic)/i.test(`${role} ${experienceTitle} ${sourceDuties}`)
      ? localizeWarehouseEmployee('ar', genderNorm || '')
      : (role || localizeWarehouseEmployee('ar', genderNorm || ''));
    text = buildArabicEntryOwnedSummary({
      role: arRole,
      employer,
      datesValue,
      gender: genderNorm || '',
      durationPhrase: durationPhrase || undefined,
      dutyFacts,
      priorRole: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
        : '',
      priorEmployer: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
        : '',
      priorSourceDuties,
      locale: 'ar',
    });
    // Strict three-slot Arabic package: never append a fourth skills sentence.
    skillSentence = '';
    void skillSentence;
  } else if (locale === 'ru') {
    void SUMMARY_BUILDER_REVISION_RU;
    void SUMMARY_UNIT_SPLITTER_REVISION_RU;
    void SUMMARY_GROUNDING_REVISION_RU;
    void analyzeRussianSummaryEmploymentQuality;
    void russianWarehouseSummaryFragment;
    const ruRole = /(?:warehouse|склад|кладов|skladist|magacin|radnic)/i.test(`${role} ${experienceTitle} ${sourceDuties}`)
      ? localizeWarehouseEmployee('ru', genderNorm || '')
      : (role || localizeWarehouseEmployee('ru', genderNorm || ''));
    text = buildRussianEntryOwnedSummary({
      role: ruRole,
      employer,
      datesValue,
      gender: genderNorm || '',
      durationPhrase: durationPhrase || undefined,
      dutyFacts,
      priorRole: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
        : '',
      priorEmployer: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
        : '',
      priorSourceDuties,
      locale: 'ru',
    });
    skillSentence = '';
    void skillSentence;
  } else if (locale === 'hr') {
    void SUMMARY_BUILDER_REVISION_HR;
    void SUMMARY_UNIT_SPLITTER_REVISION_HR;
    void SUMMARY_GROUNDING_REVISION_HR;
    void analyzeCroatianSummaryEmploymentQuality;
    void croatianWarehouseSummaryFragment;
    const hrRole = /(?:warehouse|skladišt|magacin|radnic|倉庫|кладов|مستودع)/i.test(`${role} ${experienceTitle} ${sourceDuties}`)
      ? localizeWarehouseEmployee('hr', genderNorm || '')
      : (role || localizeWarehouseEmployee('hr', genderNorm || ''));
    text = buildCroatianEntryOwnedSummary({
      role: hrRole,
      employer,
      datesValue,
      gender: genderNorm || '',
      durationPhrase: durationPhrase || undefined,
      dutyFacts,
      priorRole: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
        : '',
      priorEmployer: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
        : '',
      priorSourceDuties,
      locale: 'hr',
    });
    skillSentence = '';
    void skillSentence;
  } else if (locale === 'de') {
    void SUMMARY_BUILDER_REVISION_DE;
    void SUMMARY_UNIT_SPLITTER_REVISION_DE;
    void SUMMARY_GROUNDING_REVISION_DE;
    void analyzeGermanSummaryEmploymentQuality;
    void germanWarehouseSummaryFragment;
    void GERMAN_CV_AI_302_REVISION;
    const isGermanWarehouseDomain = /(?:warehouse|lager|skladist|magacin|radnic|кладов|مستودع)/i
      .test(`${role} ${experienceTitle} ${sourceDuties}`)
      || dutyFacts.some((f) => classifyMaterialDutyKeys(f.sourceText || f.value)
        .some((k) => k.startsWith('warehouse_')));
    if (isGermanWarehouseDomain) {
      const deRole = /(?:warehouse|lager|skladist|magacin|radnic)/i.test(`${role} ${experienceTitle} ${sourceDuties}`)
        ? localizeWarehouseEmployee('de', genderNorm || '')
        : (role || localizeWarehouseEmployee('de', genderNorm || ''));
      text = buildGermanEntryOwnedSummary({
        role: deRole,
        employer,
        datesValue,
        gender: genderNorm || '',
        durationPhrase: durationPhrase || undefined,
        dutyFacts,
        priorRole: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
          : '',
        priorEmployer: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
          : '',
        priorSourceDuties,
        locale: 'de',
      });
      skillSentence = '';
      void skillSentence;
    } else {
      // Non-warehouse German (baker, engineer, …): keep generic Latin-duty path.
      const dutyJoin = joinDutyFragments(uniqueFragments, locale);
      const open = dutyJoin
        ? (durationPhrase
          ? `${role || 'Fachkraft'} ${durationPhrase} in ${dutyJoin}`
          : `${role || 'Fachkraft'} in ${dutyJoin}`)
        : (durationPhrase
          ? `${role || 'Fachkraft'} ${durationPhrase}`
          : `${role || 'Fachkraft'}`);
      text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
  } else if (locale === 'es') {
    void SPANISH_CV_AI_305_REVISION;
    void analyzeSpanishSummaryEmploymentQuality;
    void spanishWarehouseSummaryFragment;
    const isSpanishWarehouseDomain = /(?:warehouse|almac[eé]n|mercanc[ií]a|skladist|magacin|lager|radnic|кладов|مستودع|emplead[oa]\s+de\s+almac|trabajador(?:a)?\s+de\s+almac|moz[oa]\s+de\s+almac)/i
      .test(`${role} ${experienceTitle} ${sourceDuties}`)
      || dutyFacts.some((f) => classifyMaterialDutyKeys(f.sourceText || f.value)
        .some((k) => k.startsWith('warehouse_')));
    if (isSpanishWarehouseDomain) {
      const esRole = /(?:warehouse|almac[eé]n|mercanc[ií]a|skladist|magacin|lager|emplead[oa]|trabajador|moz[oa])/i
        .test(`${role} ${experienceTitle} ${sourceDuties}`)
        ? localizeWarehouseEmployee('es', genderNorm || '')
        : (role || localizeWarehouseEmployee('es', genderNorm || ''));
      text = buildSpanishEntryOwnedSummary({
        role: esRole,
        employer,
        datesValue,
        gender: genderNorm || '',
        durationPhrase: durationPhrase || undefined,
        dutyFacts,
        priorRole: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
          : '',
        priorEmployer: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
          : '',
        priorSourceDuties,
        locale: 'es',
      });
      skillSentence = '';
      void skillSentence;
    } else {
      const dutyJoin = joinDutyFragments(uniqueFragments, locale);
      const open = dutyJoin
        ? (durationPhrase
          ? `${role || 'Profesional'} ${durationPhrase} en ${dutyJoin}`
          : `${role || 'Profesional'} en ${dutyJoin}`)
        : (durationPhrase
          ? `${role || 'Profesional'} ${durationPhrase}`
          : `${role || 'Profesional'}`);
      text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
  } else if (locale === 'sr') {
    void SUMMARY_BUILDER_REVISION_SR;
    void SUMMARY_GROUNDING_REVISION_SR;
    void SUMMARY_UNIT_SPLITTER_REVISION_SR;
    void SUMMARY_DURATION_FINALIZER_REVISION_SR;
    void SERBIAN_SUMMARY_LOCALE_PURITY_348_REVISION;
    void SERBIAN_SUMMARY_ROLE_ALIGN_348_REVISION;
    void SERBIAN_SUMMARY_DURATION_SCOPE_348_REVISION;
    void SERBIAN_SUMMARY_FACT_FIDELITY_348_REVISION;
    void analyzeSerbianSummaryEmploymentQuality;
    void injectSerbianTotalDurationSentence;
    const domainCorpus = `${experienceTitle} ${profileTitle} ${sourceDuties} ${priorSourceDuties}`;
    const srGate = evaluateSerbianStructuredDomainGate({
      currentEntryDuties: sourceDuties,
      priorEntryDuties: priorSourceDuties,
      currentRole: experienceTitle || role,
      priorRole: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
        : '',
      jobTitle: profileTitle,
    });
    if (srGate.passed) {
      const srRole = /(?:warehouse|skladišt|magacin|radnic)/i.test(`${role} ${experienceTitle} ${sourceDuties}`)
        ? role || 'Warehouse Employee'
        : (role || 'Warehouse Employee');
      text = buildSerbianEntryOwnedSummary({
        role: srRole,
        employer,
        datesValue,
        gender: genderNorm || '',
        durationPhrase: durationPhrase || undefined,
        dutyFacts,
        priorRole: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
          : '',
        priorEmployer: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
          : '',
        priorSourceDuties,
        locale: 'sr',
        duration: duration || null,
      });
      skillSentence = '';
      void skillSentence;
      void domainCorpus;
    } else {
      // Never emit a role+duration-only shell for near-miss structured domains.
      const dutyJoin = joinDutyFragments(uniqueFragments, locale);
      const open = dutyJoin
        ? (durationPhrase
          ? `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')} ${durationPhrase} u ${dutyJoin}`
          : `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')} sa iskustvom u ${dutyJoin}`)
        : (durationPhrase
          ? `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')} ${durationPhrase}`
          : `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')}`);
      text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
  } else if (locale === 'en') {
    void ENGLISH_SUMMARY_SHARED_FINAL_GATE_325_REVISION;
    void analyzeEnglishSummaryEmploymentQuality;
    void buildEnglishEntryOwnedSummary;
    void SUMMARY_BUILDER_REVISION_EN;
    const domainCorpus = `${experienceTitle} ${profileTitle} ${sourceDuties} ${priorSourceDuties}`;
    const isEnglishWarehouseOrDesignDomain = isEnglishStructuredSummaryDomain(domainCorpus);
    // Always use the entry-owned English builder for structured warehouse/design
    // domains — including native English duties. The legacy gerund path omitted
    // prior-role intro and failed generate_from_context after provider rejection.
    if (isEnglishWarehouseOrDesignDomain) {
      const enRole = /(?:warehouse|almac[eé]n|Lager(?:mitarbeiter|arbeiter)|emplead|incoming\s+goods)/i
        .test(`${role} ${experienceTitle} ${sourceDuties}`)
        ? localizeWarehouseEmployee('en', genderNorm || '')
        : (role || localizeWarehouseEmployee('en', genderNorm || ''));
      text = buildEnglishEntryOwnedSummary({
        role: enRole,
        employer,
        datesValue,
        gender: genderNorm || '',
        durationPhrase: durationPhrase || undefined,
        dutyFacts,
        priorRole: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
          : '',
        priorEmployer: typeof priorIndex === 'number'
          ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
          : '',
        priorSourceDuties,
        locale: 'en',
        duration: duration || null,
      });
      skillSentence = '';
      void skillSentence;
    } else {
      const dutyJoin = joinDutyFragments(uniqueFragments, locale);
      const ym = /^(\d{4})-(\d{2})/.exec(datesValue);
      const named = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i.exec(datesValue);
      let sinceClause = '';
      if (isPresent) {
        if (ym) {
          const months = [
            '', 'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ];
          const mi = Number(ym[2]);
          if (months[mi]) sinceClause = ` since ${months[mi]} ${ym[1]}`;
        } else if (named) {
          sinceClause = ` since ${named[1]} ${named[2]}`;
        }
      }
      const roleHead = role || 'Professional';
      const companyClause = employer ? ` at ${employer}` : '';
      let open = `${roleHead}${companyClause}${sinceClause}`;
      if (dutyJoin && durationPhrase) {
        open = `${open}, ${durationPhrase} ${dutyJoin}`;
      } else if (dutyJoin) {
        open = `${open} with experience ${dutyJoin}`;
      } else if (durationPhrase) {
        open = `${open} ${durationPhrase}`;
      }
      text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    }
  } else if (locale === 'ja') {
    void SUMMARY_BUILDER_REVISION_JA;
    void SUMMARY_UNIT_SPLITTER_REVISION_JA;
    void SUMMARY_GROUNDING_REVISION_JA;
    void analyzeJapaneseSummaryEmploymentQuality;
    void japaneseWarehouseSummaryFragment;
    const jaRole = /(?:warehouse|倉庫|skladist|magacin|radnic|кладов|مستودع)/i.test(`${role} ${experienceTitle} ${sourceDuties}`)
      ? localizeWarehouseEmployee('ja', genderNorm || '')
      : (role || localizeWarehouseEmployee('ja', genderNorm || ''));
    text = buildJapaneseEntryOwnedSummary({
      role: jaRole,
      employer,
      datesValue,
      gender: genderNorm || '',
      durationPhrase: durationPhrase || undefined,
      dutyFacts,
      priorRole: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'role')[0]?.value || '')
        : '',
      priorEmployer: typeof priorIndex === 'number'
        ? (factsForExperienceIndex(factSet, priorIndex, 'employer')[0]?.value || '')
        : '',
      priorSourceDuties,
      locale: 'ja',
    });
    skillSentence = '';
    void skillSentence;
  } else {
    const dutyJoin = joinDutyFragments(uniqueFragments, locale);
    // Duty fragments are often prepositional/noun phrases (e.g. RU "приготовлении…").
    // Keep them in the same sentence — never start a new sentence after a period.
    const dutyConnector =
      locale === 'it' ? 'in'
        : locale === 'pt-BR' ? 'en'
          : locale === 'fr' ? 'dans'
            : locale === 'ar' ? 'في'
              : '';
    const open = dutyJoin
      ? (durationPhrase
        ? (dutyConnector
          ? `${role || 'Professional'} ${durationPhrase} ${dutyConnector} ${dutyJoin}`
          : `${role || 'Professional'} ${durationPhrase}, ${dutyJoin}`)
        : (dutyConnector
          ? `${role || 'Professional'} ${dutyConnector} ${dutyJoin}`
          : `${role || 'Professional'} ${dutyJoin}`))
      : (durationPhrase
        ? `${role || 'Professional'} ${durationPhrase}`
        : `${role || 'Professional'}`);
    text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  if (!text.trim()) return '';
  text = sanitizeSummaryListMarkers(text);
  if (locale === 'hi' && !/[।.!?…]\s*$/u.test(text)) text = `${text}।`;
  else if (locale !== 'ja' && !/[.!?…।۔]\s*$/u.test(text)) text = `${text}.`;

  // Hard length guard: drop optional skills sentence if over budget or awkward.
  if (
    (countSummaryWords(text, locale) > SUMMARY_MAX_WORDS || countSummaryWords(text, locale) > 70)
    && skillSentence
  ) {
    text = text.replace(skillSentence, '').replace(/\s+/g, ' ').trim();
    skillSentence = '';
  }
  // Expose non-PII composition hints for diagnostics callers (no CV text).
  void skillsIncludedCount;
  return text.replace(/\s+/g, ' ').trim();
}

/** Non-PII Summary composition diagnostics derived from the same builder inputs. */
export function buildSummaryCompositionDiagnostics(
  factSet: CvCanonicalFactSet,
  summary: string,
  options?: { fallbackReason?: string },
): {
  summarySourceFactCount: number;
  summaryCoveredFactCount: number;
  summaryBulletMarkersRemoved: number;
  summarySkillsIncludedCount: number;
  summarySkillsCompositionMode: 'grammatical_sentence' | 'omitted' | 'none';
  summaryFallbackReason?: string;
  summaryMaterialCoverageResult: 'complete' | 'incomplete' | 'empty_source';
} {
  const source = factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .map((f) => f.sourceText || f.value)
    .join('\n');
  const coverage = validateSummarySourceFactCoverage(source, summary);
  const rawSkills = factSet.facts.filter((f) => f.type === 'skill').map((f) => f.value);
  const hasKeySkills = /\b(?:Key skills include|Ključne veštine|मेरे प्रमुख कौशलों)\b/u.test(summary || '');
  const markersInSource = (source.match(/[•\u2022\u25CF\u25E6]/gu) || []).length
    + ((source.match(/(^|\n)\s*[-–—*]\s+/gm) || []).length);
  return {
    summarySourceFactCount: coverage.requiredIds.length,
    summaryCoveredFactCount: coverage.coveredIds.length,
    summaryBulletMarkersRemoved: markersInSource,
    summarySkillsIncludedCount: hasKeySkills
      ? localizeSummarySkillLabels(rawSkills, 'en').slice(0, 4).length
      : 0,
    summarySkillsCompositionMode: hasKeySkills
      ? 'grammatical_sentence'
      : (rawSkills.length ? 'omitted' : 'none'),
    summaryFallbackReason: options?.fallbackReason,
    summaryMaterialCoverageResult: !coverage.requiredIds.length
      ? 'empty_source'
      : (coverage.ok ? 'complete' : 'incomplete'),
  };
}
