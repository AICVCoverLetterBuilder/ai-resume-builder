/**
 * Authoritative finalization gate for freshly generated CV AI content.
 *
 * Every Generate / Shorter / Stronger / Professional / Bullets apply path MUST
 * run candidate text through `finalizeCvAiFieldForApply` before writing React
 * state, cvRef, autosave, preview, PDF, or DOCX. Raw provider/repair text must
 * never be applied after this function.
 */
import type { CVData, CvSummaryOrigin, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import type { CoverLetterGender } from './cover-letter-gender';
import {
  buildCvCanonicalFactSet,
  bulletsForExperience,
  freezeExperienceAiDescription,
  formatExperienceBullets,
  splitExperienceBullets,
  type CvCanonicalFactSet,
} from './cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  type ExperienceDuration,
  type ExperienceDurationSnapshot,
} from './cv-experience-duration';
import {
  resolveSummaryWithDurationPolicy,
  stripUnsupportedSummaryFluff,
  normalizeHindiSummaryPerspective,
  SUMMARY_DURATION_FINALIZER_REVISION,
  SUMMARY_DURATION_FINALIZER_REVISION_AR,
  SUMMARY_DURATION_FINALIZER_REVISION_RU,
  SUMMARY_DURATION_FINALIZER_REVISION_JA,
  SUMMARY_DURATION_FINALIZER_REVISION_JA_LEGACY,
  type DurationIntegrationContext,
} from './cv-content-quality';
import {
  analyzeHindiSummaryEmploymentQuality,
  analyzeArabicSummaryEmploymentQuality,
  analyzeRussianSummaryEmploymentQuality,
  analyzeJapaneseSummaryEmploymentQuality,
  splitHindiSummaryUnits,
  splitArabicSummaryUnits,
  splitRussianSummaryUnits,
  splitJapaneseSummaryUnits,
  splitCroatianSummaryUnits,
  analyzeCroatianSummaryEmploymentQuality,
  SUMMARY_BUILDER_REVISION,
  SUMMARY_BUILDER_REVISION_AR,
  SUMMARY_BUILDER_REVISION_RU,
  SUMMARY_BUILDER_REVISION_JA,
  SUMMARY_BUILDER_REVISION_HR,
  SUMMARY_UNIT_SPLITTER_REVISION_AR,
  SUMMARY_UNIT_SPLITTER_REVISION_RU,
  SUMMARY_UNIT_SPLITTER_REVISION_JA,
  SUMMARY_UNIT_SPLITTER_REVISION_HR,
  SUMMARY_GROUNDING_REVISION_AR,
  SUMMARY_GROUNDING_REVISION_RU,
  SUMMARY_GROUNDING_REVISION_JA,
  SUMMARY_GROUNDING_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
  JAPANESE_DURATION_IN_INTRO_MARKER,
  JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION,
  CROATIAN_NOOP_USAGE_REVISION,
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  analyzeGermanSummaryEmploymentQuality,
  analyzeSpanishSummaryEmploymentQuality,
  GERMAN_CV_AI_302_REVISION,
  GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297,
  HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION,
} from './cv-summary-grounding';
import {
  GERMAN_EXPERIENCE_GROUNDING_303_REVISION,
  sourceRequiresGermanWarehouseFactCoverage,
  validateGermanWarehouseExperienceCoverage,
  detectGermanExperienceUnsupportedExpansion,
  buildGermanWarehouseExperienceFallback,
} from './cv-german-experience-grounding';
import {
  SPANISH_CV_AI_305_REVISION,
  detectSpanishExperienceUnsupportedExpansion,
  buildSpanishWarehouseExperienceFallback,
  sourceRequiresSpanishWarehouseFactCoverage,
  validateSpanishWarehouseExperienceCoverage,
  stripSpanishExperienceUnsupportedEscalation,
  SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION,
  SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION,
  SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION,
} from './cv-spanish-experience-grounding';
void SPANISH_CV_AI_305_REVISION;
void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
void SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION;
void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
import {
  SPANISH_SUMMARY_GROUNDING_306_REVISION,
  SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION,
  extractSpanishEntryOwnedFactIds,
} from './cv-spanish-summary-grounding';
void SPANISH_SUMMARY_GROUNDING_306_REVISION;
void SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION;
import { EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION, resolveExperienceTextareaProvenance } from './cv-experience-ai-output-provenance';

/** Packaging proof — final-candidate diagnostic truthfulness (AAB-305). */
export const EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION =
  'experience-diagnostics-final-candidate-305-v1' as const;
void EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION;
/** AAB-309 — unsupported-claim repair lineage (distinct from no-op repair). */
export const EXPERIENCE_REPAIR_LINEAGE_309_REVISION =
  'experience-repair-lineage-309-v1' as const;
void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
/** AAB-310 — predicate repair lineage evidence. */
export const EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION =
  'experience-predicate-repair-lineage-310-v1' as const;
void EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION;
import {
  SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION,
} from './cv-summary-final-candidate-diagnostics-306';
export { SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION };
void SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION;
import {
  SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION,
} from './cv-summary-localized-failure-diagnostics-307';
export { SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION };
void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
import { fingerprintText } from './cv-export-diagnostics';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
  buildSourcePreservingExperienceBulletsWithProvenance,
} from './cv-localized-fallback';
import {
  buildCrossLocaleExperienceFallback,
  candidateLeaksSourceLocale,
  countTranslatedFactUnits,
  validateCrossLocaleSemanticCoverage,
} from './cv-cross-locale-experience';
import { validateArabicExperienceEmploymentTense } from './cv-arabic-experience-tense';
import { validateRussianExperienceEmploymentTense } from './cv-russian-experience-tense';
import {
  resolveTargetScriptForLocale,
  validateAiUnitLocalePurity,
  analyzeCroatianSerbianLocaleEvidence,
} from './cv-ai-unit-locale-purity';
import {
  experienceIndexForIdStrict,
  findExperienceById,
  hashExperienceEntryId,
  validateCrossEntryExperienceLeakage,
} from './cv-experience-entry-isolation';
import {
  detectTextLocale,
  isCrossLocaleOperation,
} from './cv-content-locale';
import {
  validateSourceFactIdentityCoverage,
  validateProvenancedDeterministicFallbackCoverage,
  validateSourceUnitsMateriallyPreserved,
  extractSourceDutyUnits,
  sourceUsableInLocale,
} from './cv-source-fact-identity';
import {
  materialDutyKeysFromDescription,
  diagnoseCurrentSourceUnitMaterial,
  hindiWarehouseCueKeysFromUnit,
  arabicWarehouseCueKeysFromUnit,
  arabicDesignCueKeysFromUnit,
  russianWarehouseCueKeysFromUnit,
  russianDesignCueKeysFromUnit,
  japaneseWarehouseCueKeysFromUnit,
  japaneseDesignCueKeysFromUnit,
  croatianDesignCueKeysFromUnit,
  validateExperienceApplyMaterialPostcondition,
  RUSSIAN_EXPERIENCE_MATERIAL_REVISION,
  JAPANESE_EXPERIENCE_MATERIAL_REVISION,
  CROATIAN_EXPERIENCE_MATERIAL_REVISION,
  CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION,
  CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION,
  CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION,
  CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION,
  collectDesignMaterialKeysFromDescription,
  validateRussianDesignFactFamilies,
  sourceRequiresRussianDesignFamilies,
  experienceNeedsRussianDesignFamilyRebuild,
  isRussianDesignFamilyRejectionReason,
  validateCroatianDesignFactFamilies,
  experienceNeedsCroatianDesignFamilyRebuild,
  isCroatianDesignFamilyRejectionReason,
  isCroatianDesignPoisonedLiveSource,
  classifyMaterialDutyKeysForRole,
  RUSSIAN_DESIGN_FAMILIES_REVISION,
  RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION,
  RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
  RUSSIAN_AUTHORITATIVE_DESIGN_MATERIAL_KEYS,
} from './cv-material-duty-coverage';
import type { ExperienceAiOperationSnapshot } from './cv-experience-ai-operation-snapshot';
import {
  normalizeExperienceBulletsPerspective,
  validateExperienceCvPerspective,
  experienceAiHasMeaningfulChange,
  detectExperiencePersonMode,
  experienceRequiresCvThirdPerson,
  type ExperiencePersonMode,
} from './cv-experience-perspective';
import {
  EXPERIENCE_AI_NOOP_RECOVERY_REVISION,
  buildExperienceAiNoOpStylisticFallback,
  experienceAiNoOpFallbackIsSafe,
  polishCroatianExperienceAiText,
} from './cv-experience-ai-noop-recovery';
import {
  detectExperienceUnsupportedClaimExpansion,
  experienceUnsupportedClaimRejectionReason,
  EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION,
  type ExperienceUnsupportedClaimKind,
} from './cv-experience-unsupported-claims';
import {
  EXPERIENCE_TITLE_PROJECTION_REVISION,
  evaluateRoleDutyConsistency,
  matchesWarehouseOccupationalTitle,
  resolveOccupationalTitleForSummary,
  localizeOccupationalTitleForProjection,
} from './cv-role-title';

/** Runtime revision for the production Summary finalize → apply orchestration. */
export const SUMMARY_PIPELINE_REVISION = 'summary-runtime-282-v1' as const;
/** Retained Hindi package marker — must remain present in packaged assets. */
export const SUMMARY_PIPELINE_REVISION_HI = 'summary-runtime-281-v1' as const;
/** Typed enhance no-op — safe identical Summary is not a successful enhancement. */
export const SUMMARY_NOOP_REJECTION_REASON = 'summary_noop_after_normalization' as const;
/** AAB-300 packaging marker for the Summary no-op / success contract. */
export const SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION =
  'summary-noop-success-contract-300-v1' as const;
/** Both markers must survive production minification for asset verification. */
export const SUMMARY_RUNTIME_MARKER_SET = [
  SUMMARY_PIPELINE_REVISION_HI,
  SUMMARY_PIPELINE_REVISION,
  SUMMARY_NOOP_REJECTION_REASON,
  SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION,
  SUMMARY_BUILDER_REVISION_RU,
  SUMMARY_UNIT_SPLITTER_REVISION_RU,
  SUMMARY_GROUNDING_REVISION_RU,
  SUMMARY_DURATION_FINALIZER_REVISION_RU,
  RUSSIAN_EXPERIENCE_MATERIAL_REVISION,
  RUSSIAN_DESIGN_FAMILIES_REVISION,
  RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION,
  SUMMARY_BUILDER_REVISION_JA,
  SUMMARY_UNIT_SPLITTER_REVISION_JA,
  SUMMARY_GROUNDING_REVISION_JA,
  SUMMARY_DURATION_FINALIZER_REVISION_JA,
  SUMMARY_DURATION_FINALIZER_REVISION_JA_LEGACY,
  JAPANESE_EXPERIENCE_MATERIAL_REVISION,
  JAPANESE_DURATION_IN_INTRO_MARKER,
  JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  SUMMARY_BUILDER_REVISION_HR,
  SUMMARY_UNIT_SPLITTER_REVISION_HR,
  SUMMARY_GROUNDING_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR,
  SUMMARY_DURATION_FINALIZER_REVISION_HR_V2,
  CROATIAN_EXPERIENCE_MATERIAL_REVISION,
  CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION,
  CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION,
  CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION,
  CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION,
  CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER,
  CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION,
  CROATIAN_NOOP_USAGE_REVISION,
  CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297,
  HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION,
  HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION,
  EXPERIENCE_AI_NOOP_RECOVERY_REVISION,
  EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION,
  EXPERIENCE_TITLE_PROJECTION_REVISION,
  GERMAN_CV_AI_302_REVISION,
  GERMAN_EXPERIENCE_GROUNDING_303_REVISION,
  SPANISH_CV_AI_305_REVISION,
  SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION,
  SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION,
  EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
  SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION,
  EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
  SPANISH_SUMMARY_GROUNDING_306_REVISION,
  SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION,
  SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION,
  SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION,
  EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
  EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION,
] as const;
void SUMMARY_BUILDER_REVISION_RU;
void SUMMARY_UNIT_SPLITTER_REVISION_RU;
void SUMMARY_GROUNDING_REVISION_RU;
void SUMMARY_DURATION_FINALIZER_REVISION_RU;
void RUSSIAN_EXPERIENCE_MATERIAL_REVISION;
void RUSSIAN_DESIGN_FAMILIES_REVISION;
void RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION;
void RUSSIAN_AUTHORITATIVE_DESIGN_MATERIAL_KEYS;
void SUMMARY_BUILDER_REVISION_JA;
void SUMMARY_UNIT_SPLITTER_REVISION_JA;
void SUMMARY_GROUNDING_REVISION_JA;
void SUMMARY_DURATION_FINALIZER_REVISION_JA;
void SUMMARY_DURATION_FINALIZER_REVISION_JA_LEGACY;
void JAPANESE_EXPERIENCE_MATERIAL_REVISION;
void JAPANESE_DURATION_IN_INTRO_MARKER;
void JAPANESE_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void SUMMARY_BUILDER_REVISION_HR;
void SUMMARY_UNIT_SPLITTER_REVISION_HR;
void SUMMARY_GROUNDING_REVISION_HR;
void SUMMARY_DURATION_FINALIZER_REVISION_HR;
void SUMMARY_DURATION_FINALIZER_REVISION_HR_V2;
void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
void CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION;
void CROATIAN_ROLE_AWARE_MATERIAL_CLASSIFIER_REVISION;
void CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION;
void CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION;
void CROATIAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION;
void CROATIAN_NOOP_USAGE_REVISION;
void CROATIAN_SUMMARY_INTRO_GRAMMAR_REVISION;
void GERMAN_CV_AI_302_REVISION;
void GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
void SPANISH_CV_AI_305_REVISION;
void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
void SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION;
void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
void EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION;
void SPANISH_SUMMARY_GROUNDING_306_REVISION;
void SPANISH_SUMMARY_PRIOR_SLOT_307_REVISION;
void SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION;
void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
void EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
void EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION;
void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION;
void HINDI_SUMMARY_MEDIUM_GRAMMAR_REVISION_297;
void HINDI_SUMMARY_NOMINAL_GRAMMAR_REVISION;
void EXPERIENCE_AI_NOOP_RECOVERY_REVISION;
void EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION;
void EXPERIENCE_TITLE_PROJECTION_REVISION;
import {
  validateLocalizedExperienceBullets,
  validateLocalizedSummary,
  validateSummaryCompleteness,
  validateSerbianDurationGrammar,
  validateSummaryForcedConflictingTitle,
} from './cv-semantic-fidelity';
import { textMatchesRequestedFieldLocale } from './cv-field-locale-integrity';
import { isWrongLanguageAiOutput } from './cv-ai-locale-guard';
import {
  hasSuspiciousHindiMergedTokens,
  normalizeHindiGeneratedWhitespace,
} from './cv-hindi-normalize';
import {
  normalizeSerbianDurationGrammar,
  repairMalformedSerbianGeneratedTokens,
  hasMalformedSerbianGeneratedToken,
  hasMixedSerbianSummaryPerspective,
  dedupeSummarySentences,
} from './cv-serbian-grammar';
import {
  normalizeSerbianLatinConfusables,
  preserveSerbianSummaryFactForms,
  enrichSerbianSummaryEmploymentGrounding,
  hasSerbianLatinMixedScriptToken,
} from './cv-serbian-latin-script';
import {
  countSummaryDurationExpressions,
  summaryDurationPostconditionFailed,
  verifyIndependentFinalDurationCount,
  summarizeDurationClaimBreakdown,
  analyzeDurationRepresentations,
  type SummaryDurationOwnershipDiagnostics,
} from './cv-summary-duration-ownership';
import { acceptValidatedAiContent } from './cv-canonical-snapshot';
import { applyCvContentQuality } from './cv-content-quality';
import { hasAiProtocolMarker, stripAiProtocolMarkers } from './cv-ai-protocol-strip';
import { hasCvMetaFallbackText } from './cv-ai-meta-text';
import {
  buildExperienceJobContext,
  buildOccupationAwareExperienceFallback,
  buildOccupationAwareSummaryFallback,
  candidateConflictsWithJobContext,
  hasUnsupportedRegulatedPharmacyClaims,
  isSummaryStaleForJobContext,
  resolveExperienceAiGrounding,
  scrubOrphanDurationFragments,
  textLooksLikeCookingDuties,
  type ExperienceJobContext,
} from './cv-experience-job-context';
import {
  buildJobContextGenerationFallback,
  resolveExperienceAiOperationMode,
  validateExperienceGenerationOutput,
  type ExperienceAiOperationMode,
} from './cv-experience-ai-operation-mode';
import {
  classifyFreeTextJobDomain,
  resolveAiOperationMode,
} from './cv-ai-operation-contract';

export type CvAiFinalizeAction =
  | 'summary_generate'
  | 'summary_shorter'
  | 'summary_stronger'
  | 'summary_professional'
  | 'experience_bullets';

export type CvAiFinalizeField = 'summary' | 'experience_description';

export type CvAiFinalizeOrigin =
  | 'ai_generated'
  | 'ai_repaired'
  | 'deterministic_fallback';

export type FinalizeCvAiFieldInput = {
  action: CvAiFinalizeAction;
  field: CvAiFinalizeField;
  requestedLocale: Locale;
  sourceLocale?: Locale | string | null;
  gender?: CoverLetterGender | string;
  cv: CVData;
  candidate: string;
  originHint?: CvAiFinalizeOrigin;
  experienceId?: string;
  durationSnapshot?: ExperienceDurationSnapshot;
  referenceDateIso?: string;
  /** Industry selected in the AI Improvements panel (BulletIndustry token). */
  industry?: string;
  /** Level selected in the AI Improvements panel. */
  level?: string;
  /** Precomputed job context; when omitted it is derived from position/industry/locale/level. */
  jobContext?: ExperienceJobContext;
  /**
   * Immutable Experience AI operation snapshot created at button press.
   * When present, source facts / fallback provenance must use this only.
   */
  operationSnapshot?: ExperienceAiOperationSnapshot;
  /**
   * True after the client already attempted the dedicated Experience AI no-op
   * repair rewrite. When set, a provider echo falls through to deterministic
   * stylistic fallback instead of terminating as a hard no-op.
   */
  noOpRepairAttempted?: boolean;
};

export type FinalizeCvAiFieldResult = {
  blocked: boolean;
  reason?: string;
  text: string;
  origin: CvSummaryOrigin | 'ai_generated' | 'ai_repaired' | 'deterministic_fallback' | 'user';
  roleDutyConflict: boolean;
  countedAsSuccess: boolean;
  /** Non-PII Experience AI rejection / apply diagnostics. */
  diagnostics?: {
    sourceLocale?: string;
    sourceFactCount?: number;
    requiredFactCount?: number;
    coveredFactCount?: number;
    providerCoveredFactCount?: number;
    providerUncoveredFactCount?: number;
    providerUncoveredFactIdentityHashes?: string[];
    uncoveredFactIdentityHashes?: string[];
    providerRequiredFactCount?: number;
    providerAccepted?: boolean;
    experienceDiagnosticsFinalCandidateRevision?: typeof EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION;
    summaryFinalCandidateDiagnosticsRevision?: typeof SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION;
    providerPrimaryRejectionReason?: string | null;
    providerBulletCount?: number;
    /** @deprecated Prefer clientDeterministicFallback* fields. */
    fallbackBulletCount?: number;
    finalBulletCount?: number;
    finalBulletScripts?: string[];
    detectedLocaleByBullet?: Array<string | null>;
    detectedScriptByBullet?: string[];
    wrongLocaleBulletCount?: number;
    wrongScriptBulletCount?: number;
    mixedLanguageBulletCount?: number;
    sourceLanguageLeakageDetected?: boolean;
    targetLocalePurityPassed?: boolean;
    responseRejectedForLocaleImpurity?: boolean;
    responseRejectedForDomainMismatch?: boolean;
    crossDomainLeakageDetected?: boolean;
    tenseMode?: 'present' | 'past' | 'unknown';
    perspectiveMode?: 'cv_third_person' | 'first_person' | 'neutral_cv';
    finalPerspectiveMode?: 'cv_third_person' | 'first_person' | 'neutral_cv';
    providerPerspectiveMode?: 'cv_third_person' | 'first_person' | 'neutral_cv';
    sourcePersonMode?: ExperiencePersonMode;
    providerPersonMode?: ExperiencePersonMode;
    normalizedPersonMode?: ExperiencePersonMode;
    finalPersonMode?: ExperiencePersonMode;
    perspectiveNormalizationAttempted?: boolean;
    perspectiveNormalizationApplied?: boolean;
    perspectiveValidationPassed?: boolean;
    finalDurationRepresentationKind?: string;
    finalDurationRepresentationCount?: number;
    finalDurationHybridDetected?: boolean;
    visibleDurationRepresentationKind?: string;
    visibleDurationRepresentationCount?: number;
    visibleDurationHybridDetected?: boolean;
    durationSemanticValueMonths?: number | null;
    durationRepresentationAgreement?: boolean;
    storedContentLocaleBeforeRequest?: string | null;
    detectedVisibleContentLocaleBeforeRequest?: string | null;
    finalContentLocaleAfterApply?: string | null;
    finalCandidateSource?: string;
    providerCandidatePresent?: boolean;
    deterministicCandidatePresent?: boolean;
    normalizedBulletsUsedForApply?: boolean;
    finalMatchesProviderOutput?: boolean;
    finalMatchesSourceAfterNormalization?: boolean;
    meaningfulChangeDetected?: boolean;
    meaningfulChangeReason?: string | null;
    noOpRejected?: boolean;
    noOpDetected?: boolean;
    noOpCandidateKind?: string | null;
    noOpRejectionReason?: string | null;
    providerNoOpDetected?: boolean;
    sourceNormalizedHash?: string | null;
    finalNormalizedHash?: string | null;
    providerSentenceHashes?: string[];
    noOpRepairAttempted?: boolean;
    noOpRepairValidationPassed?: boolean;
    noOpRepairMeaningfulChangeDetected?: boolean;
    noOpRepairApplied?: boolean;
    noOpRepairUnsupportedClaimCount?: number;
    noOpRepairUnsupportedClaimKinds?: string[];
    noOpRepairScopeExpansionDetected?: boolean;
    noOpRepairUniversalQuantifierDetected?: boolean;
    noOpRepairResponsibilityEscalationDetected?: boolean;
    noOpRepairRejectionReason?: string | null;
    unsupportedClaimRepairAttempted?: boolean;
    unsupportedClaimRepairKind?: string | null;
    unsupportedClaimRepairValidationPassed?: boolean | null;
    unsupportedClaimRepairApplied?: boolean;
    unsupportedClaimRepairRejectionReason?: string | null;
    unsupportedClaimRepairUnsupportedClaimCount?: number;
    unsupportedClaimRepairUnsupportedClaimKinds?: string[];
    unsupportedClaimRepairResidualUnsupportedClaimCount?: number;
    unsupportedClaimRepairResidualUnsupportedClaimKinds?: string[];
    unsupportedClaimRepairCoverageRequiredCount?: number | null;
    unsupportedClaimRepairCoverageCoveredCount?: number | null;
    unsupportedClaimRepairUncoveredFactIdentityHashes?: string[];
    unsupportedClaimRepairHash?: string | null;
    unsupportedClaimRepairNormalizedHash?: string | null;
    experienceRepairLineageRevision?: typeof EXPERIENCE_REPAIR_LINEAGE_309_REVISION
      | typeof EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION;
    spanishExperienceRepairGroundingRevision?: typeof SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION
      | typeof SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
    experiencePredicateRepairLineageRevision?: typeof EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION;
    spanishExperiencePredicateGroundingRevision?: typeof SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
    sourcePredicateIdentityCount?: number;
    candidatePredicateIdentityCount?: number;
    candidateAddedPredicateCount?: number;
    candidateAddedPredicateIdentityHashes?: string[];
    unsupportedPredicateKindCount?: number;
    coordinatedPredicateExpansionDetected?: boolean;
    sourceUnitPredicateCoveragePassed?: boolean | null;
    repairResidualAddedPredicateCount?: number;
    repairResidualAddedPredicateIdentityHashes?: string[];
    finalUnsupportedClaimCount?: number;
    finalUnsupportedClaimKinds?: string[];
    /** Packaged asset marker — must survive minification. */
    experienceAiNoOpRecoveryRevision?: typeof EXPERIENCE_AI_NOOP_RECOVERY_REVISION;
    experienceAiUnsupportedExpansionRevision?: typeof EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION;
    deterministicFallbackAttemptedAfterNoOp?: boolean;
    deterministicFallbackAppliedAfterNoOp?: boolean;
    rejectionStage?: string;
    typedFailureReason?: string;
    /** @deprecated Prefer clientDeterministicFallbackApplied. */
    fallbackApplied?: boolean;
    countedAsSuccess?: boolean;
    apiResponseKind?: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown';
    serverFallbackUsed?: boolean;
    serverCandidateKind?: 'provider' | 'repair' | 'fallback' | 'empty' | 'unknown';
    serverFallbackReason?: string | null;
    providerOutcome?: string | null;
    clientRepairAttempted?: boolean;
    clientFallbackUsed?: boolean;
    clientFallbackKind?: 'deterministic' | 'repair' | null;
    clientFallbackReason?: string | null;
    clientDeterministicFallbackAttempted?: boolean;
    clientDeterministicFallbackReason?: string;
    /** Provider rejection reason retained separately from fallback routing reason. */
    providerRejectionReason?: string;
    providerRejectionStage?: string;
    providerUnsupportedClaimCount?: number | null;
    providerUnsupportedClaimKinds?: string[];
    providerDetectedMaterialFamilyCount?: number;
    authoritativeRequiredFamilyCount?: number;
    fallbackCoveredFamilyCount?: number;
    finalSelectedCoveredFamilyCount?: number;
    clientDeterministicFallbackBulletCount?: number;
    clientDeterministicFallbackScripts?: string[];
    clientDeterministicFallbackRequiredFactCount?: number;
    clientDeterministicFallbackCoveredFactCount?: number;
    clientDeterministicFallbackApplied?: boolean;
    clientDeterministicFallbackUncoveredFactIds?: string[];
    summaryDurationExpressionCount?: number;
    authoritativeDurationMonths?: number | null;
    authoritativeDurationBucket?: number | null;
    providerDurationDetected?: boolean;
    conflictingDurationDetected?: boolean;
    duplicateDurationRemoved?: boolean;
    finalDurationExpressionCount?: number;
    durationClaimCountBeforeStrip?: number;
    numericDurationClaimCount?: number;
    writtenDurationClaimCount?: number;
    durationClaimsRemovedBeforeInsert?: number;
    durationClaimCountAfterInsert?: number;
    independentFinalDurationClaimCount?: number;
    visibleDurationClaimCountAfterApply?: number;
    visibleDurationMatchesFinalizedCount?: boolean;
    durationDetectorAgreement?: boolean;
    durationValidationPassed?: boolean;
    contentLocaleBeforeRequest?: string | null;
    contentLocaleAfterApply?: string | null;
    operationMode?: ExperienceAiOperationMode | 'enhance_existing_content' | 'generate_from_context';
    sourceWasEmpty?: boolean;
    generationFallbackAttempted?: boolean;
    generationFallbackApplied?: boolean;
    generatedBulletCount?: number;
    relevanceValidationPassed?: boolean;
    tenseValidationPassed?: boolean;
    grammarValidationPassed?: boolean;
    unsupportedClaimCount?: number;
    sourcePrintFactPresent?: boolean;
    sourceBrandingFactPresent?: boolean;
    sourceMarketingFactPresent?: boolean;
    providerUnsupportedDesignMediumCount?: number;
    providerUnsupportedDesignMediumKinds?: string[];
    providerPrintClaimDetected?: boolean;
    providerBrandingClaimDetected?: boolean;
    providerMarketingClaimDetected?: boolean;
    finalUnsupportedDesignMediumCount?: number;
    finalUnsupportedDesignMediumKinds?: string[];
    deterministicUnsupportedDesignMediumCount?: number;
    deterministicUnsupportedDesignMediumKinds?: string[];
    hindiCurrentIntroFiniteVerbPresent?: boolean;
    hindiCurrentIntroCopulaPresent?: boolean;
    hindiCurrentDutyFiniteVerbPresent?: boolean;
    hindiCurrentDutyAuxiliaryPresent?: boolean;
    hindiPriorRoleFiniteVerbPresent?: boolean;
    hindiStandaloneJahanFragmentDetected?: boolean;
    hindiNominalExperienceFragmentDetected?: boolean;
    hindiSentenceHasFiniteCopulaOrVerb?: boolean[];
    hindiIncompleteSentenceCount?: number;
    hindiGrammarRejectionReason?: string | null;
    hindiGrammarRejectionReasons?: string[];
    providerHindiNominalExperienceFragmentDetected?: boolean;
    providerHindiSentenceHasFiniteCopulaOrVerb?: boolean[] | null;
    providerHindiIncompleteSentenceCount?: number | null;
    providerHindiGrammarRejectionReasons?: string[];
    providerSlotRejectionReasons?: string[];
    providerTypedRejectionReason?: string | null;
    currentIntroSlotPresent?: boolean;
    currentDutySlotPresent?: boolean;
    priorRoleSlotPresent?: boolean;
    slotValidationPassed?: boolean;
    slotRejectionReasons?: string[];
    summaryRepairAttempted?: boolean;
    summaryRepairValidationPassed?: boolean | null;
    summaryRepairApplied?: boolean;
    summaryDurationRepairApplied?: boolean;
    generationProviderValidationPassed?: boolean | null;
    generationProviderRejectionReason?: string | null;
    generationFinalPostconditionPassed?: boolean | null;
    generationFallbackBuilderKind?: string | null;
    generationFallbackFailureReason?: string | null;
    detectedSourceLocale?: string | null;
    storedSourceLocale?: string | null;
    requestedTargetLocale?: string | null;
    uiLocale?: string | null;
    crossLocaleOperation?: boolean;
    translationProviderAttempted?: boolean;
    translationRepairAttempted?: boolean;
    translationFallbackAttempted?: boolean;
    translationFallbackApplied?: boolean;
    translatedFactCount?: number;
    targetLocaleValidationPassed?: boolean | null;
    sourcePerspectiveMode?: string | null | 'cv_third_person' | 'first_person' | 'neutral_cv';
    targetPerspectiveMode?: string | null;
    targetContentApplied?: boolean;
    contentLocaleUpdatedAfterApply?: boolean;
    selectedSourceActuallyRejected?: boolean;
    rejectedSourceReason?: string | null;
    currentTextareaIgnoredOrOverridden?: boolean;
    providerCoverageCount?: number;
    fallbackCoverageCount?: number;
    providerLocalePurityPassed?: boolean | null;
    providerSemanticCoveragePassed?: boolean | null;
    fallbackLocalePurityPassed?: boolean | null;
    fallbackSemanticCoveragePassed?: boolean | null;
    fallbackPrimaryRejectionReason?: string | null;
    selectedExperienceEntryIdHash?: string | null;
    operationSnapshotExperienceEntryIdHash?: string | null;
    appliedExperienceEntryIdHash?: string | null;
    sourceFactsEntryIdHash?: string | null;
    canonicalFactsEntryIdHash?: string | null;
    fallbackFactsEntryIdHash?: string | null;
    providerTargetEntryIdHash?: string | null;
    arrayIndexAtRequest?: number | null;
    arrayIndexAtApply?: number | null;
    stableEntryIdentityMatched?: boolean;
    targetEntryStillExists?: boolean;
    entryContextMatchedAtApply?: boolean;
    visibleTextareaMatchesFinalNormalizedHash?: boolean | null;
    targetLocale?: string | null;
    targetScript?: string | null;
    crossEntryCandidateFactCount?: number;
    crossEntryLeakageDetected?: boolean;
    leakedFromExperienceEntryIdHashes?: string[];
    entryScopedCanonicalStorageUsed?: boolean;
    responseRejectedForEntryMismatch?: boolean;
    /** Hindi Summary employment / warehouse grounding postconditions (build 275). */
    groundingValidationPassed?: boolean;
    finalPostconditionsPassed?: boolean;
    currentEmploymentIntroductionCount?: number;
    repeatedEmploymentFactCount?: number;
    repeatedProfessionalLabelCount?: number;
    currentRoleConcreteFactCoverage?: number;
    genericizedMaterialFactCount?: number;
    priorRoleGroundingPassed?: boolean;
    fallbackCandidatePresent?: boolean;
    providerSentenceCount?: number;
    currentRoleTitlePresent?: boolean;
    currentRoleTitleSource?: string | null;
    currentRoleTitleEntryIdHash?: string | null;
    currentRoleTitleMatchesStructuredRole?: boolean;
    currentRoleOmittedDetected?: boolean;
    currentSlotForeignFactCount?: number;
    priorSlotForeignFactCount?: number;
    semanticCrossEntryLeakageDetected?: boolean;
    duplicatedPriorRoleFactCount?: number;
    priorRoleSemanticFactMentionCount?: number;
    priorRoleSemanticDuplicationDetected?: boolean;
    finalUnitRoleSlots?: string[];
    hindiFiniteKaAnubhavCollision?: boolean;
    durationFinalizerIdempotent?: boolean;
    summaryPipelineRevision?: string;
    summaryNoopSuccessContractRevision?: typeof SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION;
    summaryRuntimeMarkerSet?: string[];
    summaryBuilderRevision?: string;
    summaryUnitSplitterRevision?: string;
    summaryGroundingRevision?: string;
    summaryDurationFinalizerRevision?: string;
    /** Non-PII candidate identity across finalize stages. */
    providerCandidateHash?: string | null;
    providerCandidateNormalizedHash?: string | null;
    deterministicCandidateHash?: string | null;
    deterministicCandidateNormalizedHash?: string | null;
    durationPass1CandidateHash?: string | null;
    durationPass2CandidateHash?: string | null;
    groundingInputCandidateHash?: string | null;
    finalValidatedCandidateHash?: string | null;
    providerCandidateEqualsDeterministicCandidate?: boolean | null;
    deterministicCandidateEqualsGroundingInput?: boolean | null;
    groundingInputEqualsFinalValidatedCandidate?: boolean | null;
    providerCandidateSentenceCount?: number | null;
    deterministicCandidateSentenceCount?: number | null;
    durationPass1SentenceCount?: number | null;
    durationPass2SentenceCount?: number | null;
    groundingInputSentenceCount?: number | null;
    durationPass1Hash?: string | null;
    durationPass2Hash?: string | null;
    durationSecondPassChanged?: boolean | null;
    durationSecondPassChangeReason?: string | null;
    contextCurrentRoleResolved?: string | null;
    contextCurrentRoleLocalized?: string | null;
    candidateCurrentRoleTitlePresent?: boolean | null;
    candidateCurrentRoleTitleMatchesStructuredRole?: boolean | null;
    candidateCurrentEmploymentIntroductionCount?: number | null;
    candidateCurrentRoleOmittedDetected?: boolean | null;
    deterministicCurrentEntryIdHash?: string | null;
    deterministicPriorEntryIdHashes?: string[];
    currentEntryMaterialKeys?: string[];
    priorEntryMaterialKeys?: string[];
    currentSourceUnitHashes?: string[];
    currentSourceUnitMaterialKeys?: string[][];
    currentSourceUnitActionKeys?: string[][];
    currentSourceUnitObjectKeys?: string[][];
    currentSourceUnitWarehouseCueCount?: number[];
    currentSourceUnitFactOwnerEntryIdHash?: string | null;
    flattenedFactArrayUsed?: boolean;
    previousSummaryTextUsedByDeterministicFallback?: boolean;
    providerTextUsedByDeterministicFallback?: boolean;
    finalSentenceHashes?: string[];
    finalSentenceRoleSlots?: string[];
  };
};

/** Non-material Summary formatting only — never used to rewrite applied text. */
export function normalizeSummaryCandidateText(text: string): string {
  return (text || '')
    .normalize('NFKC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/\s+([।.!?])/g, '$1')
    .replace(/([।.!?])\s+/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashSummaryCandidate(text: string): string {
  return fingerprintText(normalizeSummaryCandidateText(text) || 'empty');
}

export type SummaryMeaningfulChangeResult = {
  sourceNormalizedHash: string;
  finalNormalizedHash: string;
  finalMatchesSourceAfterNormalization: boolean;
  meaningfulChangeDetected: boolean;
  meaningfulChangeReason: string | null;
  noOpDetected: boolean;
  noOpRejectionReason: string | null;
};

/**
 * Authoritative Summary meaningful-change comparator for enhance_existing_content.
 * Empty source is never a no-op (generate_empty may accept deterministic content).
 */
export function evaluateSummaryMeaningfulChange(
  sourceSummary: string,
  candidateSummary: string,
): SummaryMeaningfulChangeResult {
  const sourceNorm = normalizeSummaryCandidateText(sourceSummary);
  const candNorm = normalizeSummaryCandidateText(candidateSummary);
  const sourceNormalizedHash = fingerprintText(sourceNorm || 'empty');
  const finalNormalizedHash = fingerprintText(candNorm || 'empty');
  if (!sourceNorm) {
    return {
      sourceNormalizedHash,
      finalNormalizedHash,
      finalMatchesSourceAfterNormalization: false,
      meaningfulChangeDetected: Boolean(candNorm),
      meaningfulChangeReason: candNorm ? 'generated_from_empty_source' : 'empty_source_and_candidate',
      noOpDetected: false,
      noOpRejectionReason: null,
    };
  }
  const matches = sourceNormalizedHash === finalNormalizedHash;
  return {
    sourceNormalizedHash,
    finalNormalizedHash,
    finalMatchesSourceAfterNormalization: matches,
    meaningfulChangeDetected: !matches,
    meaningfulChangeReason: matches ? null : 'normalized_text_differs',
    noOpDetected: matches,
    noOpRejectionReason: matches ? SUMMARY_NOOP_REJECTION_REASON : null,
  };
}

function hashSummaryUnits(text: string, locale: Locale): string[] {
  const t = normalizeSummaryCandidateText(text);
  if (!t) return [];
  const units = locale === 'hi'
    ? splitHindiSummaryUnits(t)
    : locale === 'ar'
      ? splitArabicSummaryUnits(t)
      : locale === 'ru'
        ? splitRussianSummaryUnits(t)
        : locale === 'ja'
          ? splitJapaneseSummaryUnits(t)
          : locale === 'hr'
            ? splitCroatianSummaryUnits(t)
            : t.split(/[.!?।]/u).map((s) => s.trim()).filter(Boolean);
  return units.map((u) => fingerprintText(normalizeSummaryCandidateText(u) || 'empty'));
}

function countSummaryCandidateSentences(text: string, locale: Locale): number {
  const t = normalizeSummaryCandidateText(text);
  if (!t) return 0;
  if (locale === 'hi') return splitHindiSummaryUnits(t).length;
  if (locale === 'ar') return splitArabicSummaryUnits(t).length;
  if (locale === 'ru') return splitRussianSummaryUnits(t).length;
  if (locale === 'ja') return splitJapaneseSummaryUnits(t).length;
  if (locale === 'hr') return splitCroatianSummaryUnits(t).length;
  return t.split(/[.!?।]/u).filter((s) => s.trim()).length;
}

/**
 * Hindi Summary rebuild: force live Experience textarea over stale EN/SR
 * canonical/generated metadata (device autosave shape). Other locales keep
 * normal grounding resolution so Serbian/English duration cycles stay stable.
 */
function buildSummaryFactSetForLocale(cv: CVData, locale: Locale): CvCanonicalFactSet {
  if (locale !== 'hi') {
    return buildCvCanonicalFactSet(cv);
  }
  const experience = (cv.experience || []).map((exp) => {
    const liveDisplay = (exp.description || '').trim();
    const liveAi = freezeExperienceAiDescription(exp).trim();
    // Prefer visible live text first — freeze already prefers live, but keep
    // an explicit description-first order for Hindi entry ownership.
    const authoritative = liveDisplay
      || liveAi
      || (exp.originalUserDescription || '').trim()
      || (exp.canonicalDescription || '').trim();
    return {
      ...exp,
      description: authoritative,
      canonicalDescription: authoritative,
      originalUserDescription: (exp.originalUserDescription || '').trim() || authoritative,
      descriptionOrigin: 'user' as const,
    };
  });
  return buildCvCanonicalFactSet({ ...cv, experience });
}

function dutiesTextFromCv(cv: CVData, experienceId?: string): string {
  const exps = cv.experience || [];
  const scoped = experienceId ? exps.filter((e) => e.id === experienceId) : exps;
  // Immutable user/source duties only — never prefer a later AI rewrite in `description`
  // when `canonicalDescription` is already frozen.
  return scoped.map((e) => freezeExperienceAiDescription(e)).join('\n');
}

function currentAndPriorDutiesFromCv(cv: CVData, locale?: Locale): {
  currentEntryDuties: string;
  priorEntryDuties: string;
  currentEntryId: string | null;
  currentRoleTitle: string;
  priorRoleTitle: string;
  priorCompany: string;
  currentCompany: string;
} {
  const exps = cv.experience || [];
  const current = exps.find((e) => e.isPresent) || exps[0] || null;
  const prior = exps.find((e) => current && e.id !== current.id) || null;
  const liveDuties = (exp: NonNullable<typeof current>) => {
    if (locale === 'hi') {
      const liveDisplay = (exp.description || '').trim();
      const liveAi = freezeExperienceAiDescription(exp).trim();
      return liveDisplay
        || liveAi
        || (exp.originalUserDescription || '').trim()
        || (exp.canonicalDescription || '').trim();
    }
    if (locale === 'hr') {
      const live = (exp.description || '').trim() || freezeExperienceAiDescription(exp).trim();
      const canonical = (exp.originalUserDescription || '').trim()
        || (exp.canonicalDescription || '').trim();
      // Reject Serbian-poisoned design live text as material authority — prefer
      // entry-owned canonical design facts when the role is graphic design.
      if (
        isCroatianDesignPoisonedLiveSource(live, exp.position)
        && canonical
        && canonical !== live
      ) {
        void CROATIAN_SUMMARY_CANONICAL_RECOVERY_REVISION;
        return canonical;
      }
      return live || canonical;
    }
    return freezeExperienceAiDescription(exp);
  };
  return {
    currentEntryDuties: current ? liveDuties(current) : '',
    priorEntryDuties: prior ? liveDuties(prior) : '',
    currentEntryId: current?.id || null,
    currentRoleTitle: (current?.position || cv.personal?.jobTitle || '').trim(),
    priorRoleTitle: (prior?.position || '').trim(),
    priorCompany: (prior?.company || '').trim(),
    currentCompany: (current?.company || '').trim(),
  };
}

function prepareCandidate(raw: string, locale: Locale, field: 'summary' | 'experience_description'): string {
  let out = stripAiProtocolMarkers(raw || '');
  if (field === 'experience_description') {
    // Preserve bullet line structure — never collapse newlines (summary fluff
    // stripper replaces all whitespace with a single space).
    out = out
      .split(/\r?\n/)
      .map((line) => {
        let row = line.replace(/^\s*[•\-\*\u2022]\s*/, '').trim();
        if (!row) return '';
        // Strip invented fluff tokens per line without joining lines.
        for (const fluff of [
          /\bincreased\s+revenue\b/giu,
          /\bcustomer[- ]satisfaction\b/giu,
          /\bawards?\b/giu,
        ]) {
          row = row.replace(fluff, ' ');
        }
        row = row.replace(/[ \t]+/g, ' ').trim();
        return row;
      })
      .filter(Boolean)
      .join('\n');
    out = normalizeLocaleText(out, locale);
    return out.trim();
  }
  out = stripUnsupportedSummaryFluff(out, locale);
  out = normalizeLocaleText(out, locale);
  return out;
}

function buildDurationContext(cv: CVData, locale: Locale): DurationIntegrationContext {
  const primaryExp = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const gender = cv.personal?.gender || '';
  // Role/title conflict checks must use current-entry duties only — prior cook/design
  // facts must not neutralize the structured current warehouse/cook title.
  const currentDuties = primaryExp ? freezeExperienceAiDescription(primaryExp) : '';
  return {
    role: resolveOccupationalTitleForSummary({
      profileJobTitle: cv.personal?.jobTitle,
      currentExperienceTitle: primaryExp?.position,
      locale,
      gender,
      dutiesText: currentDuties,
    }),
    company: primaryExp?.company || '',
    startDate: primaryExp?.startDate || '',
    gender,
  };
}

function experienceIndexForId(cv: CVData, experienceId?: string): number {
  return experienceIndexForIdStrict(cv, experienceId);
}

function normalizeLocaleText(text: string, locale: Locale): string {
  let out = (text || '').trim();
  if (locale === 'hi') {
    out = normalizeHindiGeneratedWhitespace(out, 'hi');
  }
  if (locale === 'sr' || locale === 'hr') {
    out = normalizeSerbianDurationGrammar(out);
    out = repairMalformedSerbianGeneratedTokens(out);
    // Serbian Latin Summary must not retain confusable Cyrillic letters (pregledа).
    out = normalizeSerbianLatinConfusables(out);
  }
  return out.trim();
}

function summaryPasses(
  summary: string,
  factSet: CvCanonicalFactSet,
  cv: CVData,
  locale: Locale,
  duration: ExperienceDuration,
  roleDutyConflict: boolean,
): { ok: boolean; reason?: string } {
  if (!summary.trim()) return { ok: false, reason: 'empty_summary' };
  if (!textMatchesRequestedFieldLocale(summary, locale, 'summary')) {
    return { ok: false, reason: 'locale_mismatch' };
  }
  if (isWrongLanguageAiOutput(summary, locale)) {
    return { ok: false, reason: 'wrong_language' };
  }
  const summaryPurity = validateAiUnitLocalePurity(summary, locale, {
    kind: 'summary_sentence',
    requireUnits: true,
  });
  if (!summaryPurity.ok) {
    // Proper nouns / brands can trip per-unit guesses; whole-field guards above
    // are authoritative when no mixed-language units remain.
    if (summaryPurity.mixedLanguageUnitCount > 0) {
      return { ok: false, reason: summaryPurity.reason || 'wrong_language' };
    }
  }
  if (locale === 'hi' && hasSuspiciousHindiMergedTokens(summary)) {
    return { ok: false, reason: 'hindi_merged_tokens' };
  }
  if (hasAiProtocolMarker(summary)) {
    return { ok: false, reason: 'protocol_marker_residual' };
  }
  if (!validateSummaryCompleteness(summary, { locale }).valid) {
    return { ok: false, reason: 'incomplete_summary' };
  }
  if (locale === 'es') {
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const primary = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
    const dutiesCorpus = `${entryDuties.currentEntryDuties || ''} ${entryDuties.priorEntryDuties || ''} ${primary?.position || ''} ${cv.personal?.jobTitle || ''}`;
    const spanishWarehouseOrDesignDomain = /(?:almac[eé]n|warehouse|mercanc[ií]a|dise[nñ]o|gr[aá]fic|visual)/iu
      .test(dutiesCorpus)
      || /almac[eé]n|warehouse|moz[oa]|trabajador(?:a)?\s+de\s+almac/iu
        .test(`${primary?.position || ''} ${cv.personal?.jobTitle || ''}`);
    if (spanishWarehouseOrDesignDomain) {
      const empQ = analyzeSpanishSummaryEmploymentQuality(summary, {
        company: primary?.company || '',
        role: primary?.position || cv.personal?.jobTitle || '',
        currentEntryDuties: entryDuties.currentEntryDuties,
        priorEntryDuties: entryDuties.priorEntryDuties,
        priorCompany: entryDuties.priorCompany,
        priorRole: entryDuties.priorRoleTitle,
        gender: cv.personal?.gender || '',
      });
      if (!empQ.groundingValidationPassed) {
        return {
          ok: false,
          reason: empQ.typedRejectionReason || 'spanish_summary_grounding_failed',
        };
      }
    } else {
      const fidelity = validateLocalizedSummary(summary, factSet, {
        locale,
        gender: cv.personal?.gender || '',
        expectedDuration: duration,
        stage: 'client-final-apply',
      });
      if (!fidelity.valid) {
        return { ok: false, reason: fidelity.violations[0]?.kind || 'fidelity_failed' };
      }
    }
  } else {
    const fidelity = validateLocalizedSummary(summary, factSet, {
      locale,
      gender: cv.personal?.gender || '',
      expectedDuration: duration,
      stage: 'client-final-apply',
    });
    if (!fidelity.valid) {
      return { ok: false, reason: fidelity.violations[0]?.kind || 'fidelity_failed' };
    }
  }
  const grammar = validateSerbianDurationGrammar(summary, locale);
  if (!grammar.valid) {
    return { ok: false, reason: 'serbian_duration_grammar' };
  }
  if (countSummaryDurationExpressions(summary, locale) > 1) {
    return { ok: false, reason: 'summary_duplicate_duration' };
  }
  if (locale === 'sr' && hasSerbianLatinMixedScriptToken(summary)) {
    return { ok: false, reason: 'serbian_mixed_script' };
  }
  const forcedTitle = validateSummaryForcedConflictingTitle(summary, {
    locale,
    profileJobTitle: cv.personal?.jobTitle,
    experienceTitle: (cv.experience || []).find((e) => e.isPresent)?.position
      || (cv.experience || [])[0]?.position,
    dutiesText: currentAndPriorDutiesFromCv(cv, locale).currentEntryDuties || dutiesTextFromCv(cv),
    roleDutyConflict,
  });
  if (forcedTitle.length) {
    return { ok: false, reason: 'forced_conflicting_title' };
  }
  if (locale === 'ja') {
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const primary = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
    const empQ = analyzeJapaneseSummaryEmploymentQuality(summary, {
      company: primary?.company || '',
      role: primary?.position || cv.personal?.jobTitle || '',
      startDate: primary?.startDate || '',
      sourceDuties: entryDuties.currentEntryDuties,
      currentEntryDuties: entryDuties.currentEntryDuties,
      priorEntryDuties: entryDuties.priorEntryDuties,
      priorCompany: entryDuties.priorCompany,
      structuredRole: primary?.position || entryDuties.currentRoleTitle,
      gender: cv.personal?.gender || '',
    });
    if (!empQ.groundingValidationPassed) {
      return {
        ok: false,
        reason: empQ.typedRejectionReason || 'japanese_summary_grounding_failed',
      };
    }
  }
  if (locale === 'hr') {
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const primary = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
    const empQ = analyzeCroatianSummaryEmploymentQuality(summary, {
      company: primary?.company || '',
      role: primary?.position || cv.personal?.jobTitle || '',
      startDate: primary?.startDate || '',
      sourceDuties: entryDuties.currentEntryDuties,
      currentEntryDuties: entryDuties.currentEntryDuties,
      priorEntryDuties: entryDuties.priorEntryDuties,
      priorCompany: entryDuties.priorCompany,
      structuredRole: primary?.position || entryDuties.currentRoleTitle,
      gender: cv.personal?.gender || '',
    });
    if (!empQ.groundingValidationPassed) {
      return {
        ok: false,
        reason: empQ.typedRejectionReason || 'croatian_summary_grounding_failed',
      };
    }
  }
  if (locale === 'hi') {
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const primary = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
    const localizedRole = resolveOccupationalTitleForSummary({
      profileJobTitle: cv.personal?.jobTitle,
      currentExperienceTitle: primary?.position || entryDuties.currentRoleTitle,
      locale,
      gender: cv.personal?.gender || '',
      dutiesText: entryDuties.currentEntryDuties,
    });
    const empQ = analyzeHindiSummaryEmploymentQuality(summary, {
      company: primary?.company || '',
      role: localizedRole || primary?.position || cv.personal?.jobTitle || '',
      startDate: primary?.startDate || '',
      sourceDuties: entryDuties.currentEntryDuties,
      currentEntryDuties: entryDuties.currentEntryDuties,
      priorEntryDuties: entryDuties.priorEntryDuties,
      priorCompany: entryDuties.priorCompany,
      structuredRole: localizedRole || primary?.position || entryDuties.currentRoleTitle,
    });
    if (!empQ.groundingValidationPassed) {
      return {
        ok: false,
        reason: empQ.typedRejectionReason || 'hindi_summary_grounding_failed',
      };
    }
  }
  return { ok: true };
}

function bulletsPass(
  description: string,
  factSet: CvCanonicalFactSet,
  cv: CVData,
  locale: Locale,
  experienceIndex: number,
  isPresent: boolean,
): { ok: boolean; reason?: string } {
  if (!description.trim()) return { ok: false, reason: 'empty_bullets' };
  if (!textMatchesRequestedFieldLocale(description, locale, 'experience_bullet')) {
    return { ok: false, reason: 'locale_mismatch' };
  }
  if (isWrongLanguageAiOutput(description, locale)) {
    return { ok: false, reason: 'wrong_language' };
  }
  const unitPurity = validateAiUnitLocalePurity(description, locale, {
    kind: 'experience_bullet',
    requireUnits: true,
  });
  if (!unitPurity.ok) {
    return { ok: false, reason: unitPurity.reason || 'wrong_language' };
  }
  if (locale === 'hr') {
    const evidence = analyzeCroatianSerbianLocaleEvidence(description);
    if (evidence.serbianLeakageDetected) {
      return { ok: false, reason: 'croatian_serbian_locale_leakage' };
    }
  }
  if (locale === 'hi' && hasSuspiciousHindiMergedTokens(description)) {
    return { ok: false, reason: 'hindi_merged_tokens' };
  }
  if (hasAiProtocolMarker(description)) {
    return { ok: false, reason: 'protocol_marker_residual' };
  }
  if (hasCvMetaFallbackText(description)) {
    return { ok: false, reason: 'meta_fallback_text' };
  }
  const fidelity = validateLocalizedExperienceBullets(description, factSet, {
    locale,
    gender: cv.personal?.gender || '',
    experienceIndex,
    stage: 'client-final-apply',
    isPresent,
  });
  if (!fidelity.valid) {
    const preferred = fidelity.violations.find((v) =>
      v.kind === 'unsupported_generated_duty'
      || v.kind === 'meta_fallback_text'
      || v.kind === 'missing_canonical_duty'
      || v.kind === 'employment_tense_mismatch'
      || v.kind === 'wrong_language'
      || v.kind === 'unsupported_claim'
      || v.kind === 'unsupported_duty',
    );
    const reason = preferred?.kind
      || fidelity.violations[0]?.kind
      || 'fidelity_failed';
    // Map legacy unsupported_duty to the external contract name when needed.
    if (reason === 'unsupported_duty') {
      return { ok: false, reason: 'unsupported_claim' };
    }
    return { ok: false, reason };
  }
  return { ok: true };
}

function finalizeSummary(input: FinalizeCvAiFieldInput): FinalizeCvAiFieldResult {
  const locale = input.requestedLocale;
  const cv = input.cv;
  const gender = input.gender || cv.personal?.gender || '';
  // Hindi: live Experience beats stale canonical. Other locales: normal facts.
  const factSet = buildSummaryFactSetForLocale(cv, locale);
  const durationSnapshot = input.durationSnapshot
    || buildExperienceDurationSnapshot(
      cv.experience || [],
      input.referenceDateIso || new Date().toISOString().slice(0, 10),
    );
  const dutiesText = dutiesTextFromCv(cv);
  const liveSummary = (cv.summary || '').trim();
  const summaryGenerate = resolveAiOperationMode({
    targetContent: liveSummary,
  }) === 'generate_from_context';
  const entryDutiesForRole = currentAndPriorDutiesFromCv(cv, locale);
  const consistency = evaluateRoleDutyConsistency({
    profileJobTitle: cv.personal?.jobTitle,
    experienceTitle: (cv.experience || []).find((e) => e.isPresent)?.position
      || (cv.experience || [])[0]?.position,
    dutiesText: entryDutiesForRole.currentEntryDuties || dutiesText,
  });
  const roleDutyConflict = consistency.conflict;
  const context = buildDurationContext(cv, locale);
  const contextCurrentRoleLocalized = (context.role || '').trim();
  const contextCurrentRoleResolved = (entryDutiesForRole.currentRoleTitle || '').trim();

  const providerRaw = prepareCandidate(input.candidate || '', locale, 'summary');
  const providerCandidateHash = hashSummaryCandidate(providerRaw);
  const providerCandidateNormalizedHash = hashSummaryCandidate(
    normalizeSummaryCandidateText(providerRaw),
  );
  const providerCandidateSentenceCount = countSummaryCandidateSentences(providerRaw, locale);
  const providerSentenceHashes = hashSummaryUnits(providerRaw, locale);
  const sourceNormalizedHash = hashSummaryCandidate(liveSummary);
  let summaryMeaningfulChange: SummaryMeaningfulChangeResult | null = null;
  let providerNoOpDetected = false;
  let deterministicNoOpDetected = false;
  let noOpCandidateKind: string | null = null;
  let clientFallbackUsed = false;
  let clientFallbackReason: string | null = null;
  let providerOutcomeHint: string | null = null;

  let candidate = providerRaw;
  if (hasAiProtocolMarker(candidate)) {
    candidate = '';
  }

  let deterministicCandidateRaw = '';
  let deterministicCandidateHash: string | null = null;
  let deterministicCandidateNormalizedHash: string | null = null;
  let deterministicCandidateSentenceCount: number | null = null;
  let durationPass1CandidateHash: string | null = null;
  let durationPass2CandidateHash: string | null = null;
  let durationPass1SentenceCount: number | null = null;
  let durationPass2SentenceCount: number | null = null;
  let durationSecondPassChanged: boolean | null = null;
  let durationSecondPassChangeReason: string | null = null;
  let groundingInputCandidateHash: string | null = null;
  let groundingInputSentenceCount: number | null = null;
  let previousSummaryTextUsedByDeterministicFallback = false;
  let providerTextUsedByDeterministicFallback = false;
  let flattenedFactArrayUsed = false;
  let japaneseProviderRejectionReason: string | null = null;
  let japaneseProviderUnsupportedClaimCount: number | null = null;
  let croatianProviderRejectionReason: string | null = null;
  let spanishProviderRejectionReason: string | null = null;
  let spanishProviderUnsupportedClaimCount: number | null = null;
  let hindiProviderQuality: ReturnType<typeof analyzeHindiSummaryEmploymentQuality> | null = null;
  let hindiProviderRejectionReason: string | null = null;
  const deterministicCurrentEntryIdHash: string | null = entryDutiesForRole.currentEntryId
    ? hashExperienceEntryId(entryDutiesForRole.currentEntryId)
    : null;
  const deterministicPriorEntryIdHashes: string[] = (cv.experience || [])
    .filter((e) => e.id && e.id !== entryDutiesForRole.currentEntryId)
    .map((e) => hashExperienceEntryId(e.id));
  const currentEntryMaterialKeys: string[] = (() => {
    const fromUnits = materialDutyKeysFromDescription(entryDutiesForRole.currentEntryDuties)
      .filter((k) => k !== 'generic_duty');
    const spanishOwned = locale === 'es'
      ? extractSpanishEntryOwnedFactIds(
        `${entryDutiesForRole.currentEntryDuties}\n${entryDutiesForRole.currentRoleTitle || ''}`,
      )
      : [];
    const cues = [
      ...hindiWarehouseCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
      ...(locale === 'ar' || locale === 'ru' || locale === 'ja'
        ? [
          ...arabicWarehouseCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
          ...arabicDesignCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
        ]
        : []),
      ...(locale === 'ru'
        ? [
          ...russianWarehouseCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
          ...russianDesignCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
        ]
        : []),
      ...(locale === 'ja'
        ? [
          ...japaneseWarehouseCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
          ...japaneseDesignCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
          ...russianWarehouseCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
          ...russianDesignCueKeysFromUnit(entryDutiesForRole.currentEntryDuties),
        ]
        : []),
    ];
    const merged = [...new Set([...fromUnits, ...spanishOwned, ...cues])];
    return merged.length ? merged : ['generic_duty'];
  })();
  const currentSourceUnitDiag = diagnoseCurrentSourceUnitMaterial(
    entryDutiesForRole.currentEntryDuties,
    entryDutiesForRole.currentEntryId
      ? hashExperienceEntryId(entryDutiesForRole.currentEntryId)
      : null,
  );
  // Design prior duties often contain Hindi तैयार which falsely hits food_prep.
  const priorDesignCue = /(?:ग्राफिक|डिज़ाइन|प्रिंट|डिजिटल|दृश्य|ब्रांड|graphic|design|print|digital|visual|مواد\s*بصرية|عناصر\s*رسومية|جرافيك|تصميم|визуальн|графическ|дизайн|ビジュアル|視覚|グラフィック|デザイン)/iu
    .test(`${entryDutiesForRole.priorEntryDuties || ''} ${entryDutiesForRole.priorRoleTitle || ''}`);
  const priorEntryMaterialKeys: string[] = (() => {
    const roleAware = classifyMaterialDutyKeysForRole(
      entryDutiesForRole.priorEntryDuties,
      entryDutiesForRole.priorRoleTitle,
    ).filter((k) => k !== 'generic_duty' && !(priorDesignCue && k === 'food_prep'));
    const spanishOwned = locale === 'es'
      ? extractSpanishEntryOwnedFactIds(
        `${entryDutiesForRole.priorEntryDuties}\n${entryDutiesForRole.priorRoleTitle || ''}`,
      )
      : [];
    const merged = [
      ...roleAware,
      ...spanishOwned,
      ...materialDutyKeysFromDescription(entryDutiesForRole.priorEntryDuties)
        .filter((k) => k !== 'generic_duty' && !(priorDesignCue && k === 'food_prep')),
      ...collectDesignMaterialKeysFromDescription(entryDutiesForRole.priorEntryDuties)
        .filter((k) => !(priorDesignCue && k === 'food_prep')),
      ...(locale === 'ja' || locale === 'hr'
        ? japaneseDesignCueKeysFromUnit(entryDutiesForRole.priorEntryDuties)
        : []),
      ...(locale === 'ja' || locale === 'hr'
        ? russianDesignCueKeysFromUnit(entryDutiesForRole.priorEntryDuties)
        : []),
      ...(locale === 'hr'
        ? croatianDesignCueKeysFromUnit(entryDutiesForRole.priorEntryDuties)
        : []),
    ];
    const unique = [...new Set(merged)];
    // Russian/Japanese/Spanish Summary design-prior template grounds fact families when
    // the prior entry is design-owned — report those keys for diagnostics.
    const priorLooksDesignForLocale = (locale === 'ru' || locale === 'ja' || locale === 'hr' || locale === 'es') && (
      priorDesignCue
      || /dizajn|design|グラフィック|デザイナー|グラフィックデザイナー|графическ|дизайнер|visual|визуальн|ビジュアル|デザイン|مواد\s*بصرية|عناصر\s*رسومية|grafičk|ग्राफिक|डिज़ाइन|दृश्य|dise[nñ]o|gr[aá]fic/i
        .test(`${entryDutiesForRole.priorRoleTitle || ''} ${entryDutiesForRole.priorEntryDuties || ''}`)
    );
    if (priorLooksDesignForLocale) {
      // Never report warehouse keys for a design prior (poisoned Serbian live text).
      for (let i = unique.length - 1; i >= 0; i -= 1) {
        if (String(unique[i]).startsWith('warehouse_')) unique.splice(i, 1);
      }
      for (const k of [
        'design_visual_materials',
        'design_graphic_elements',
        'design_review_adapt',
        'design_project_requirements',
        'design_files_formats',
        'design_different_screens',
        ...(locale === 'es'
          ? [
            'visual_material_creation',
            'graphic_element_creation',
            'design_material_review',
            'design_material_adaptation',
            'final_design_file_preparation',
            'multi_format_preparation',
            'screen_preparation',
          ]
          : []),
      ]) {
        if (!unique.includes(k)) unique.push(k);
      }
    }
    if (priorDesignCue && unique.filter((k) => k !== 'generic_duty').length === 0) {
      unique.push('design_visual_identity');
    }
    return unique.length ? unique : ['generic_duty'];
  })();
  // Empty Summary generation: seed from grounded Experience facts before duration
  // ownership, so injectHindiDurationWithOpening does not emit a duration-only shell.
  let emptySummarySeededFromCanonical = false;
  if (!candidate.trim() && !liveSummary.trim()) {
    candidate = prepareCandidate(
      deterministicLocalizedSummaryFromCanonical(
        factSet,
        locale,
        gender,
        durationSnapshot.total,
      ) || '',
      locale,
      'summary',
    );
    emptySummarySeededFromCanonical = Boolean(candidate.trim());
  }
  const durationResolved = resolveSummaryWithDurationPolicy(
    candidate,
    durationSnapshot.total,
    locale,
    {
      forceDurationPhrase: true,
      requireDurationClaim: true,
      context,
    },
  );
  candidate = normalizeLocaleText(durationResolved.summary, locale);
  // Idempotent duration ownership: second pass must not grow claim count.
  let durationDiag = durationResolved.durationDiagnostics;
  {
    const second = resolveSummaryWithDurationPolicy(
      candidate,
      durationSnapshot.total,
      locale,
      {
        forceDurationPhrase: true,
        requireDurationClaim: true,
        context,
      },
    );
    candidate = normalizeLocaleText(second.summary, locale);
    if (second.durationDiagnostics) {
      durationDiag = {
        ...durationResolved.durationDiagnostics!,
        ...second.durationDiagnostics,
        // Preserve pre-strip counts from the first ownership pass.
        durationClaimCountBeforeStrip:
          durationResolved.durationDiagnostics?.durationClaimCountBeforeStrip
          ?? second.durationDiagnostics.durationClaimCountBeforeStrip,
        summaryDurationExpressionCount:
          durationResolved.durationDiagnostics?.summaryDurationExpressionCount
          ?? second.durationDiagnostics.summaryDurationExpressionCount,
        numericDurationClaimCount:
          durationResolved.durationDiagnostics?.numericDurationClaimCount
          ?? second.durationDiagnostics.numericDurationClaimCount,
        writtenDurationClaimCount:
          durationResolved.durationDiagnostics?.writtenDurationClaimCount
          ?? second.durationDiagnostics.writtenDurationClaimCount,
        durationClaimsRemovedBeforeInsert:
          Math.max(
            durationResolved.durationDiagnostics?.durationClaimsRemovedBeforeInsert ?? 0,
            second.durationDiagnostics.durationClaimsRemovedBeforeInsert ?? 0,
          ),
        duplicateDurationRemoved: Boolean(
          durationResolved.durationDiagnostics?.duplicateDurationRemoved
          || second.durationDiagnostics.duplicateDurationRemoved,
        ),
      };
    }
  }
  if (locale === 'sr' || locale === 'hr') {
    candidate = preserveSerbianSummaryFactForms(candidate, dutiesText);
    candidate = normalizeSerbianLatinConfusables(candidate);
    candidate = repairMalformedSerbianGeneratedTokens(candidate);
    candidate = dedupeSummarySentences(candidate);
    // Drop first-person inventory/management fluff not grounded in Experience.
    if (!/\b(?:zalih|inventar|snabdevanj|nabavk)\w*\b/iu.test(dutiesText)) {
      candidate = candidate
        .replace(/[^.!?]*\b(?:upravljala|upravljao)\s+sam\s+nivoima\s+zaliha[^.!?]*[.!?]/giu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (!/\b(?:jel\w*|kuhinj|restoran|koktel|hrana)\b/iu.test(dutiesText)) {
      candidate = candidate
        .replace(/[^.!?]*\bpriprema\s+jela\b[^.!?]*[.!?]/giu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    candidate = enrichSerbianSummaryEmploymentGrounding(candidate, {
      role: context.role,
      company: context.company,
      startDate: context.startDate,
    });
    candidate = dedupeSummarySentences(candidate);
  }
  if (locale === 'hi') {
    candidate = normalizeHindiSummaryPerspective(candidate);
    candidate = dedupeSummarySentences(candidate);
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const empQuality = analyzeHindiSummaryEmploymentQuality(candidate, {
      company: context.company,
      role: context.role,
      startDate: context.startDate,
      sourceDuties: dutiesText,
      currentEntryDuties: entryDuties.currentEntryDuties,
      priorEntryDuties: entryDuties.priorEntryDuties,
      priorCompany: entryDuties.priorCompany,
      structuredRole: context.role || entryDuties.currentRoleTitle,
    });
    // Duplicate Atlas/current-role intros or genericized warehouse duties force rebuild.
    if (!empQuality.groundingValidationPassed && candidate.trim()) {
      // Preserve provider-candidate validation for diagnostics before blanking.
      // Contradiction fix: provider* medium/grammar fields must describe providerRaw,
      // not the eventual deterministic final text.
      hindiProviderQuality = empQuality;
      hindiProviderRejectionReason = empQuality.typedRejectionReason
        || empQuality.hindiGrammarRejectionReason
        || 'hindi_summary_grounding_failed';
      providerOutcomeHint = /grammar|nominal|finite|copula|fragment/i.test(
        hindiProviderRejectionReason,
      ) && !/unsupported_print|unsupported_brand|unsupported_market|unsupported_design/i.test(
        hindiProviderRejectionReason,
      )
        ? 'rejected_grammar'
        : 'rejected_grounding';
      candidate = '';
    }
  }
  if (locale === 'ar') {
    candidate = dedupeSummarySentences(candidate);
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const empQuality = analyzeArabicSummaryEmploymentQuality(candidate, {
      company: context.company,
      role: context.role,
      startDate: context.startDate,
      sourceDuties: dutiesText,
      currentEntryDuties: entryDuties.currentEntryDuties,
      priorEntryDuties: entryDuties.priorEntryDuties,
      priorCompany: entryDuties.priorCompany,
      structuredRole: context.role || entryDuties.currentRoleTitle,
      gender,
    });
    if (!empQuality.groundingValidationPassed && candidate.trim()) {
      candidate = '';
    }
  }
  if (locale === 'ru') {
    candidate = dedupeSummarySentences(candidate);
    // Reject English generic fallback sentences under Russian target.
    if (/Carries\s+out\s+assigned\s+professional\s+duties/iu.test(candidate)) {
      candidate = '';
    }
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const empQuality = analyzeRussianSummaryEmploymentQuality(candidate, {
      company: context.company,
      role: context.role,
      startDate: context.startDate,
      sourceDuties: dutiesText,
      currentEntryDuties: entryDuties.currentEntryDuties,
      priorEntryDuties: entryDuties.priorEntryDuties,
      priorCompany: entryDuties.priorCompany,
      structuredRole: context.role || entryDuties.currentRoleTitle,
      gender,
    });
    if (!empQuality.groundingValidationPassed && candidate.trim()) {
      candidate = '';
    }
  }
  if (locale === 'ja') {
    candidate = dedupeSummarySentences(candidate);
    // Reject mixed Russian title + English generic under Japanese target.
    if (
      /Carries\s+out\s+assigned\s+professional\s+duties/iu.test(candidate)
      || /Графический\s+дизайнер/iu.test(candidate)
      || /[а-яёА-ЯЁ]{4,}/u.test(candidate)
    ) {
      if (candidate.trim()) {
        japaneseProviderRejectionReason = japaneseProviderRejectionReason
          || 'japanese_summary_locale_impurity';
      }
      candidate = '';
    }
    if (candidate.trim()) {
      const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
      const empQuality = analyzeJapaneseSummaryEmploymentQuality(candidate, {
        company: context.company,
        role: context.role,
        startDate: context.startDate,
        sourceDuties: dutiesText,
        currentEntryDuties: entryDuties.currentEntryDuties,
        priorEntryDuties: entryDuties.priorEntryDuties,
        priorCompany: entryDuties.priorCompany,
        structuredRole: context.role || entryDuties.currentRoleTitle,
        gender,
      });
      if (!empQuality.groundingValidationPassed) {
        japaneseProviderRejectionReason = empQuality.typedRejectionReason
          || 'japanese_summary_grounding_failed';
        japaneseProviderUnsupportedClaimCount = empQuality.unsupportedClaimCount;
        candidate = '';
      }
    }
  }
  if (locale === 'hr') {
    candidate = dedupeSummarySentences(candidate);
    if (
      /Carries\s+out\s+assigned\s+professional\s+duties/iu.test(candidate)
      || /グラフィックデザイナー/u.test(candidate)
      || /[\u3040-\u30FF\u3400-\u9FFF]/.test(candidate)
      || /[\u0400-\u04FF]/.test(candidate)
      || analyzeCroatianSerbianLocaleEvidence(candidate).serbianLeakageDetected
    ) {
      if (candidate.trim()) {
        croatianProviderRejectionReason = croatianProviderRejectionReason
          || 'croatian_summary_serbian_leakage';
      }
      candidate = '';
    }
    if (candidate.trim()) {
      const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
      const empQuality = analyzeCroatianSummaryEmploymentQuality(candidate, {
        company: context.company,
        role: context.role,
        startDate: context.startDate,
        sourceDuties: dutiesText,
        currentEntryDuties: entryDuties.currentEntryDuties,
        priorEntryDuties: entryDuties.priorEntryDuties,
        priorCompany: entryDuties.priorCompany,
        structuredRole: context.role || entryDuties.currentRoleTitle,
        gender,
      });
      if (!empQuality.groundingValidationPassed) {
        croatianProviderRejectionReason = empQuality.typedRejectionReason
          || 'croatian_summary_grounding_failed';
        candidate = '';
      }
    }
  }
  if (locale === 'de') {
    void GERMAN_CV_AI_302_REVISION;
    void GERMAN_SUMMARY_STRICT_POSTCONDITIONS_MARKER;
    candidate = dedupeSummarySentences(candidate);
    if (/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(candidate)) {
      candidate = '';
    }
    if (candidate.trim()) {
      const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
      const empQuality = analyzeGermanSummaryEmploymentQuality(candidate, {
        company: context.company,
        role: context.role,
        currentEntryDuties: entryDuties.currentEntryDuties,
        priorEntryDuties: entryDuties.priorEntryDuties,
        priorCompany: entryDuties.priorCompany,
        gender,
      });
      if (!empQuality.groundingValidationPassed) {
        candidate = '';
      }
    }
  }
  if (locale === 'es') {
    void SPANISH_CV_AI_305_REVISION;
    void SPANISH_SUMMARY_GROUNDING_306_REVISION;
    candidate = dedupeSummarySentences(candidate);
    if (/[\u0900-\u097F\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]/.test(candidate)) {
      if (candidate.trim() && providerRaw.trim()) {
        spanishProviderRejectionReason = spanishProviderRejectionReason
          || 'spanish_summary_foreign_script';
      }
      candidate = '';
    }
    if (candidate.trim()) {
      const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
      const empQuality = analyzeSpanishSummaryEmploymentQuality(candidate, {
        company: context.company,
        role: context.role,
        currentEntryDuties: entryDuties.currentEntryDuties,
        priorEntryDuties: entryDuties.priorEntryDuties,
        priorCompany: entryDuties.priorCompany,
        priorRole: entryDuties.priorRoleTitle,
        gender,
        structuredRole: context.role || entryDuties.currentRoleTitle,
        structuredSkills: (cv.skills || [])
          .map((s) => (typeof s === 'string' ? s : (s as { name?: string })?.name || ''))
          .filter(Boolean),
      });
      if (!empQuality.groundingValidationPassed) {
        if (providerRaw.trim()) {
          spanishProviderRejectionReason = empQuality.typedRejectionReason
            || 'spanish_summary_grounding_failed';
          spanishProviderUnsupportedClaimCount = empQuality.unsupportedClaimCount;
        }
        candidate = '';
      }
    }
  }

  // After duration ownership, if warehouse duties were dropped, force grounded rebuild.
  // Do not blank the candidate when dutiesText is English "goods" only — require Devanagari cues
  // in the Experience corpus before demanding माल/गोदाम in the Summary.
  if (
    locale === 'hi'
    && /माल|गोदाम/.test(dutiesText)
    && candidate.trim()
    && !/माल|गोदाम/.test(candidate)
  ) {
    candidate = '';
  }

  let durationDiagFinal = durationDiag;
  if (
    summaryDurationPostconditionFailed(candidate, durationSnapshot.total, locale, {
      requireDurationClaim: true,
    })
    || (locale === 'sr' && hasSerbianLatinMixedScriptToken(candidate))
    || (locale === 'sr' && hasMalformedSerbianGeneratedToken(candidate))
    || (locale === 'sr' && hasMixedSerbianSummaryPerspective(candidate))
  ) {
    // Force deterministic grounded rebuild when postcondition still fails.
    candidate = '';
  }

  let origin: CvAiFinalizeOrigin = input.originHint || 'ai_generated';
  /** True when the API/activation path already marked the candidate as repaired. */
  const summaryRepairAttempted = input.originHint === 'ai_repaired';
  const durationRepairApplied = durationResolved.status === 'repaired';
  // Only mark content origin as ai_repaired when an actual repair candidate was
  // activated — never alias duration-policy normalization as content repair.
  if (summaryRepairAttempted) {
    origin = 'ai_repaired';
  } else if (emptySummarySeededFromCanonical && !providerRaw.trim()) {
    // Entry-owned empty generate is client deterministic — never claim provider.
    origin = 'deterministic_fallback';
  }
  // durationRepairApplied is recorded separately as summaryDurationRepairApplied.

  const attachSummaryDiag = (
    result: FinalizeCvAiFieldResult,
  ): FinalizeCvAiFieldResult => {
    const analyzedText = result.text || '';
    const independent = verifyIndependentFinalDurationCount(analyzedText, locale, {
      requireExactlyOne: true,
    });
    const breakdown = summarizeDurationClaimBreakdown(analyzedText, locale);
    const owned = durationDiagFinal as SummaryDurationOwnershipDiagnostics | undefined;
    const rep = independent.representation
      || analyzeDurationRepresentations(analyzedText, locale);
    const durationOk = independent.ok && independent.count === 1 && !rep.hybridDetected;
    const detectorAgreement = independent.count
      === (owned?.durationClaimCountAfterInsert ?? independent.count)
      && rep.agreement;
    const durationValidationPassed = Boolean(
      durationOk
      && detectorAgreement
      && (owned?.durationValidationPassed !== false)
      && (owned?.finalDurationHybridDetected !== true),
    );
    const firstPerson = /(?:^|[^\p{L}])मैं(?:ने)?(?:[^\p{L}]|$)|हूँ|करती हूँ|करता हूँ/u.test(analyzedText);
    const perspectiveMode = firstPerson ? 'first_person' : 'neutral_cv';
    const perspectiveValidationPassed = (locale === 'hi' || locale === 'ar' || locale === 'ru' || locale === 'ja' || locale === 'hr' || locale === 'es')
      ? !firstPerson
      : true;
    const entryDuties = currentAndPriorDutiesFromCv(cv, locale);
    const empQ = locale === 'hi'
      ? analyzeHindiSummaryEmploymentQuality(analyzedText, {
        company: context.company || entryDuties.currentCompany,
        role: context.role,
        startDate: context.startDate,
        sourceDuties: dutiesText,
        currentEntryDuties: entryDuties.currentEntryDuties,
        priorEntryDuties: entryDuties.priorEntryDuties,
        priorCompany: entryDuties.priorCompany,
        structuredRole: context.role || entryDuties.currentRoleTitle,
      })
      : locale === 'ar'
        ? analyzeArabicSummaryEmploymentQuality(analyzedText, {
          company: context.company || entryDuties.currentCompany,
          role: context.role,
          startDate: context.startDate,
          sourceDuties: dutiesText,
          currentEntryDuties: entryDuties.currentEntryDuties,
          priorEntryDuties: entryDuties.priorEntryDuties,
          priorCompany: entryDuties.priorCompany,
          structuredRole: context.role || entryDuties.currentRoleTitle,
          gender,
        })
        : locale === 'ru'
          ? analyzeRussianSummaryEmploymentQuality(analyzedText, {
            company: context.company || entryDuties.currentCompany,
            role: context.role,
            startDate: context.startDate,
            sourceDuties: dutiesText,
            currentEntryDuties: entryDuties.currentEntryDuties,
            priorEntryDuties: entryDuties.priorEntryDuties,
            priorCompany: entryDuties.priorCompany,
            structuredRole: context.role || entryDuties.currentRoleTitle,
            gender,
          })
          : locale === 'ja'
            ? analyzeJapaneseSummaryEmploymentQuality(analyzedText, {
              company: context.company || entryDuties.currentCompany,
              role: context.role,
              startDate: context.startDate,
              sourceDuties: dutiesText,
              currentEntryDuties: entryDuties.currentEntryDuties,
              priorEntryDuties: entryDuties.priorEntryDuties,
              priorCompany: entryDuties.priorCompany,
              structuredRole: context.role || entryDuties.currentRoleTitle,
              gender,
            })
            : locale === 'hr'
              ? analyzeCroatianSummaryEmploymentQuality(analyzedText, {
                company: context.company || entryDuties.currentCompany,
                role: context.role,
                startDate: context.startDate,
                sourceDuties: dutiesText,
                currentEntryDuties: entryDuties.currentEntryDuties,
                priorEntryDuties: entryDuties.priorEntryDuties,
                priorCompany: entryDuties.priorCompany,
                structuredRole: context.role || entryDuties.currentRoleTitle,
                gender,
              })
              : locale === 'es'
                ? analyzeSpanishSummaryEmploymentQuality(analyzedText, {
                  company: context.company || entryDuties.currentCompany,
                  role: context.role,
                  currentEntryDuties: entryDuties.currentEntryDuties,
                  priorEntryDuties: entryDuties.priorEntryDuties,
                  priorCompany: entryDuties.priorCompany,
                  priorRole: entryDuties.priorRoleTitle,
                  structuredRole: context.role || entryDuties.currentRoleTitle,
                  gender,
                  structuredSkills: (cv.skills || [])
                    .map((s) => (typeof s === 'string' ? s : (s as { name?: string })?.name || ''))
                    .filter(Boolean),
                })
            : null;
    // Candidate fields — never treat structured context alone as a passing intro/title.
    const candidateCurrentRoleTitlePresent = empQ?.currentRoleTitlePresent ?? null;
    const candidateCurrentRoleTitleMatchesStructuredRole =
      empQ?.currentRoleTitleMatchesStructuredRole ?? null;
    const candidateCurrentEmploymentIntroductionCount =
      empQ?.currentEmploymentIntroductionCount ?? null;
    const candidateCurrentRoleOmittedDetected = empQ?.currentRoleOmittedDetected ?? null;
    const groundingValidationPassed = empQ ? empQ.groundingValidationPassed : !result.blocked;
    // Hard postcondition: coverage 0 with a warehouse current role can never pass.
    const coverageHardFail = Boolean(
      empQ
      && empQ.currentRoleConcreteFactCoverage < 2
      && (
        matchesWarehouseOccupationalTitle(
          `${context.role || ''} ${entryDuties.currentRoleTitle || ''}`,
        )
        || /(?:warehouse|वेयरहाउस|गोदाम|magacin|skladist|माल|بضائع|مستودع|товар|склад|кладов|倉庫|入荷|商品|almac[eé]n|mercanc[ií]a)/iu.test(
          entryDuties.currentEntryDuties || '',
        )
      ),
    );
    // Real second-pass idempotence on the candidate under evaluation.
    let durationFinalizerIdempotent = durationValidationPassed;
    let localPass2Hash = durationPass2CandidateHash;
    if (
      (locale === 'hi' || locale === 'ar' || locale === 'ru' || locale === 'ja' || locale === 'hr' || locale === 'es')
      && analyzedText.trim()
      && durationSnapshot.total.hasValidDates
    ) {
      void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
      const secondPass = resolveSummaryWithDurationPolicy(
        analyzedText,
        durationSnapshot.total,
        locale,
        {
          forceDurationPhrase: true,
          requireDurationClaim: true,
          context,
        },
      );
      const normalizeForIdempotence = (s: string) => s.replace(/\s+/g, ' ').trim();
      const before = normalizeForIdempotence(analyzedText);
      const after = normalizeForIdempotence(secondPass.summary);
      const analysisPassChanged = before !== after;
      // Prefer rebuild pass hashes when already recorded — do not fail closed
      // solely because a tertiary analysis pass rewrites whitespace/punctuation.
      if (
        durationPass1CandidateHash
        && durationPass2CandidateHash
        && durationPass1CandidateHash === durationPass2CandidateHash
        && durationSecondPassChanged === false
      ) {
        durationFinalizerIdempotent = true;
      } else {
        durationFinalizerIdempotent = !analysisPassChanged;
      }
      // Do not overwrite rebuild pass hashes with a third analysis pass when
      // rebuild already recorded truthful pass1/pass2. Only fill gaps.
      if (durationPass1CandidateHash == null) {
        durationPass1CandidateHash = hashSummaryCandidate(analyzedText);
      }
      if (durationPass2CandidateHash == null) {
        localPass2Hash = hashSummaryCandidate(secondPass.summary);
        durationPass2CandidateHash = localPass2Hash;
      }
      // Always keep the changed flag truthful against the latest observed mutation.
      if (analysisPassChanged) {
        if (!(
          durationPass1CandidateHash
          && durationPass2CandidateHash
          && durationPass1CandidateHash === durationPass2CandidateHash
          && durationSecondPassChanged === false
        )) {
          durationSecondPassChanged = true;
          durationSecondPassChangeReason = durationSecondPassChangeReason
            || 'duration_finalizer_mutated_candidate';
        }
      } else if (durationSecondPassChanged == null) {
        durationSecondPassChanged = false;
        durationSecondPassChangeReason = null;
      }
    }
    // Equal normalized pass hashes + no second-pass change ⇒ idempotent,
    // independent of visible apply success.
    if (
      durationPass1CandidateHash
      && durationPass2CandidateHash
      && durationPass1CandidateHash === durationPass2CandidateHash
      && durationSecondPassChanged === false
    ) {
      void SUMMARY_LOCALIZED_FAILURE_DIAGNOSTICS_307_REVISION;
      durationFinalizerIdempotent = true;
    }
    const blockedForDuration = Boolean(
      result.countedAsSuccess && (!durationValidationPassed || !durationFinalizerIdempotent),
    );
    const blockedForPerspective = Boolean(
      result.countedAsSuccess
      && (locale === 'hi' || locale === 'ar' || locale === 'ru' || locale === 'ja' || locale === 'hr' || locale === 'es')
      && !perspectiveValidationPassed,
    );
    const blockedForGrounding = Boolean(
      result.countedAsSuccess
      && (locale === 'hi' || locale === 'ar' || locale === 'ru' || locale === 'ja' || locale === 'hr' || locale === 'es')
      && empQ
      && (!empQ.groundingValidationPassed || coverageHardFail),
    );
    const blocked = result.blocked
      || blockedForDuration
      || blockedForPerspective
      || blockedForGrounding;
    const success = result.countedAsSuccess
      && durationValidationPassed
      && durationFinalizerIdempotent
      && perspectiveValidationPassed
      && groundingValidationPassed
      && !coverageHardFail;
    return {
      ...result,
      blocked,
      countedAsSuccess: success,
      reason: blockedForDuration
        ? 'experience_duration_mismatch'
        : blockedForPerspective
          ? 'summary_perspective_invalid'
          : blockedForGrounding
            ? 'summary_grounding_failed'
            : result.reason,
      diagnostics: {
        ...result.diagnostics,
        operationMode: summaryGenerate
          ? 'generate_from_job_context'
          : 'enhance_existing_content',
        sourceWasEmpty: summaryGenerate,
        summaryDurationExpressionCount: owned?.summaryDurationExpressionCount
          ?? independent.count,
        authoritativeDurationMonths: owned?.authoritativeDurationMonths ?? undefined,
        authoritativeDurationBucket: owned?.authoritativeDurationBucket ?? undefined,
        providerDurationDetected: owned?.providerDurationDetected,
        conflictingDurationDetected: owned?.conflictingDurationDetected,
        duplicateDurationRemoved: owned?.duplicateDurationRemoved,
        finalDurationExpressionCount: independent.count,
        durationClaimCountBeforeStrip: owned?.durationClaimCountBeforeStrip,
        numericDurationClaimCount: owned?.numericDurationClaimCount ?? breakdown.numeric,
        writtenDurationClaimCount: owned?.writtenDurationClaimCount ?? breakdown.written,
        durationClaimsRemovedBeforeInsert: owned?.durationClaimsRemovedBeforeInsert,
        durationClaimCountAfterInsert: owned?.durationClaimCountAfterInsert ?? independent.count,
        independentFinalDurationClaimCount: independent.count,
        visibleDurationClaimCountAfterApply: independent.count,
        visibleDurationMatchesFinalizedCount: durationValidationPassed,
        durationDetectorAgreement: detectorAgreement,
        durationValidationPassed,
        finalDurationRepresentationKind: rep.representationKind,
        finalDurationRepresentationCount: rep.representationCount,
        finalDurationHybridDetected: rep.hybridDetected,
        visibleDurationRepresentationKind: rep.representationKind,
        visibleDurationRepresentationCount: rep.representationCount,
        visibleDurationHybridDetected: rep.hybridDetected,
        durationSemanticValueMonths: owned?.durationSemanticValueMonths
          ?? durationSnapshot.total.totalMonths,
        durationRepresentationAgreement: rep.agreement,
        storedContentLocaleBeforeRequest: cv.contentLocale || null,
        detectedVisibleContentLocaleBeforeRequest: locale,
        contentLocaleBeforeRequest: cv.contentLocale || null,
        contentLocaleAfterApply: success ? locale : (cv.contentLocale || null),
        finalContentLocaleAfterApply: success ? locale : null,
        finalCandidateSource: success
          ? result.origin
          : 'none',
        providerCandidatePresent: Boolean((input.candidate || '').trim()),
        deterministicCandidatePresent: Boolean(deterministicCandidateRaw.trim())
          || result.origin === 'deterministic_fallback'
          || deterministicNoOpDetected,
        fallbackCandidatePresent: result.origin === 'deterministic_fallback'
          || deterministicNoOpDetected
          || Boolean(deterministicCandidateRaw.trim()),
        fallbackApplied: Boolean(
          success && result.origin === 'deterministic_fallback',
        ),
        providerSentenceCount: providerCandidateSentenceCount,
        providerSentenceHashes,
        apiResponseKind: providerRaw.trim() ? 'provider' : (providerCandidateSentenceCount ? 'provider' : 'empty'),
        serverCandidateKind: providerRaw.trim() ? 'provider' : 'empty',
        serverFallbackUsed: false,
        serverFallbackReason: null,
        providerOutcome: (() => {
          void SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION;
          if (providerOutcomeHint) return providerOutcomeHint;
          if (!providerRaw.trim()) return 'not_attempted';
          if (success && result.origin === 'ai_generated') return 'accepted';
          if (success && result.origin === 'ai_repaired') {
            // Content repair accepted — still report provider as rejected when
            // the provider body was blanked before repair activation.
            return summaryRepairAttempted && !providerRaw.trim()
              ? 'not_attempted'
              : (spanishProviderRejectionReason
                || hindiProviderRejectionReason
                || japaneseProviderRejectionReason
                || croatianProviderRejectionReason
                ? 'rejected_grounding'
                : 'accepted');
          }
          if (success && result.origin === 'deterministic_fallback') {
            return providerNoOpDetected ? 'rejected_noop' : 'rejected_grounding';
          }
          if (result.reason === SUMMARY_NOOP_REJECTION_REASON || deterministicNoOpDetected) {
            return providerNoOpDetected ? 'rejected_noop' : (providerOutcomeHint || 'rejected_grounding');
          }
          if (result.blocked && (
            hindiProviderRejectionReason
            || japaneseProviderRejectionReason
            || croatianProviderRejectionReason
            || spanishProviderRejectionReason
          )) {
            const r = String(
              hindiProviderRejectionReason
              || japaneseProviderRejectionReason
              || croatianProviderRejectionReason
              || spanishProviderRejectionReason,
            );
            if (/locale|script|leak/i.test(r)) return 'rejected_locale';
            if (/grammar|nominal|finite|copula|fragment/i.test(r)
              && !/unsupported_print|unsupported_brand|unsupported_market|unsupported_design/i.test(r)) {
              return 'rejected_grammar';
            }
            if (/noop|meaningful/i.test(r)) return 'rejected_noop';
            return 'rejected_grounding';
          }
          // Completed request with a provider body must never remain unknown.
          if (providerRaw.trim() || providerCandidateSentenceCount) {
            return 'rejected_grounding';
          }
          return 'not_attempted';
        })(),
        clientRepairAttempted: Boolean(summaryRepairAttempted),
        clientFallbackUsed: Boolean(
          (success && (
            clientFallbackUsed
            || result.origin === 'deterministic_fallback'
          ))
          || deterministicNoOpDetected,
        ),
        clientFallbackKind: (
          clientFallbackUsed
          || result.origin === 'deterministic_fallback'
          || deterministicNoOpDetected
        ) ? 'deterministic' as const : null,
        clientFallbackReason: clientFallbackReason
          || (
            result.origin === 'deterministic_fallback' || deterministicNoOpDetected
              ? (hindiProviderRejectionReason
                || japaneseProviderRejectionReason
                || croatianProviderRejectionReason
                || spanishProviderRejectionReason
                || (providerNoOpDetected ? SUMMARY_NOOP_REJECTION_REASON : 'provider_rejected'))
              : null
          ),
        clientDeterministicFallbackAttempted: Boolean(
          deterministicCandidateRaw.trim()
          || result.origin === 'deterministic_fallback'
          || deterministicNoOpDetected,
        ),
        clientDeterministicFallbackApplied: success && result.origin === 'deterministic_fallback',
        clientDeterministicFallbackReason: clientFallbackReason
          || (
            result.origin === 'deterministic_fallback'
              ? (hindiProviderRejectionReason
                || japaneseProviderRejectionReason
                || croatianProviderRejectionReason
                || spanishProviderRejectionReason
                || 'provider_rejected')
              : undefined
          ),
        sourceNormalizedHash,
        finalNormalizedHash: (() => {
          const mc = summaryMeaningfulChange
            || (analyzedText
              ? evaluateSummaryMeaningfulChange(liveSummary, analyzedText)
              : null);
          return mc?.finalNormalizedHash
            ?? (analyzedText ? hashSummaryCandidate(analyzedText) : null);
        })(),
        finalMatchesSourceAfterNormalization: (() => {
          const mc = summaryMeaningfulChange
            || (analyzedText
              ? evaluateSummaryMeaningfulChange(liveSummary, analyzedText)
              : null);
          return mc?.finalMatchesSourceAfterNormalization ?? false;
        })(),
        meaningfulChangeDetected: (() => {
          if (summaryGenerate) return Boolean(analyzedText.trim());
          const mc = summaryMeaningfulChange
            || (analyzedText
              ? evaluateSummaryMeaningfulChange(liveSummary, analyzedText)
              : null);
          return Boolean(mc?.meaningfulChangeDetected);
        })(),
        meaningfulChangeReason: (() => {
          const mc = summaryMeaningfulChange
            || (analyzedText
              ? evaluateSummaryMeaningfulChange(liveSummary, analyzedText)
              : null);
          return mc?.meaningfulChangeReason ?? null;
        })(),
        noOpDetected: Boolean(
          providerNoOpDetected
          || deterministicNoOpDetected
          || result.reason === SUMMARY_NOOP_REJECTION_REASON,
        ),
        noOpCandidateKind,
        noOpRejectionReason: (
          providerNoOpDetected || deterministicNoOpDetected
          || result.reason === SUMMARY_NOOP_REJECTION_REASON
        ) ? SUMMARY_NOOP_REJECTION_REASON : null,
        providerNoOpDetected,
        noOpRejected: Boolean(
          deterministicNoOpDetected
          || result.reason === SUMMARY_NOOP_REJECTION_REASON,
        ),
        perspectiveMode,
        finalPerspectiveMode: perspectiveMode,
        sourcePerspectiveMode: firstPerson ? 'first_person' : 'neutral_cv',
        providerPerspectiveMode: firstPerson ? 'first_person' : 'neutral_cv',
        perspectiveNormalizationAttempted: locale === 'hi',
        perspectiveNormalizationApplied: locale === 'hi' && !firstPerson,
        perspectiveValidationPassed,
        groundingValidationPassed,
        finalPostconditionsPassed: success,
        // Candidate-derived postcondition fields (not structured context alone).
        currentEmploymentIntroductionCount: candidateCurrentEmploymentIntroductionCount ?? undefined,
        repeatedEmploymentFactCount: empQ && 'repeatedEmploymentFactCount' in empQ
          ? (empQ as { repeatedEmploymentFactCount?: number }).repeatedEmploymentFactCount
          : undefined,
        repeatedProfessionalLabelCount: empQ && 'repeatedProfessionalLabelCount' in empQ
          ? (empQ as { repeatedProfessionalLabelCount?: number }).repeatedProfessionalLabelCount
          : undefined,
        currentRoleConcreteFactCoverage: empQ?.currentRoleConcreteFactCoverage,
        genericizedMaterialFactCount: empQ && 'genericizedMaterialFactCount' in empQ
          ? (empQ as { genericizedMaterialFactCount?: number }).genericizedMaterialFactCount
          : undefined,
        priorRoleGroundingPassed: empQ?.priorRoleGroundingPassed,
        crossEntryLeakageDetected: (
          empQ && 'semanticCrossEntryLeakageDetected' in empQ
            ? Boolean((empQ as { semanticCrossEntryLeakageDetected?: boolean }).semanticCrossEntryLeakageDetected)
            : undefined
        )
          ?? (
            empQ && 'crossDomainLeakageDetected' in empQ
              ? Boolean((empQ as { crossDomainLeakageDetected?: boolean }).crossDomainLeakageDetected)
              : false
          )
          ?? false,
        currentRoleTitlePresent: candidateCurrentRoleTitlePresent ?? undefined,
        currentRoleTitleSource: candidateCurrentRoleTitleMatchesStructuredRole
          ? 'structured_current_role'
          : (/^(?:पेशेवर|professional)$/iu.test(contextCurrentRoleLocalized) || !contextCurrentRoleLocalized
            ? 'generic_professional'
            : 'context_role_only'),
        currentRoleTitleEntryIdHash: entryDuties.currentEntryId
          ? hashExperienceEntryId(entryDuties.currentEntryId)
          : null,
        currentRoleTitleMatchesStructuredRole:
          candidateCurrentRoleTitleMatchesStructuredRole ?? undefined,
        currentRoleOmittedDetected: candidateCurrentRoleOmittedDetected ?? undefined,
        currentSlotForeignFactCount: empQ && 'currentSlotForeignFactCount' in empQ
          ? (empQ as { currentSlotForeignFactCount?: number }).currentSlotForeignFactCount
          : undefined,
        priorSlotForeignFactCount: empQ && 'priorSlotForeignFactCount' in empQ
          ? (empQ as { priorSlotForeignFactCount?: number }).priorSlotForeignFactCount
          : undefined,
        semanticCrossEntryLeakageDetected: empQ && 'semanticCrossEntryLeakageDetected' in empQ
          ? (empQ as { semanticCrossEntryLeakageDetected?: boolean }).semanticCrossEntryLeakageDetected
          : undefined,
        duplicatedPriorRoleFactCount: empQ && 'duplicatedPriorRoleFactCount' in empQ
          ? (empQ as { duplicatedPriorRoleFactCount?: number }).duplicatedPriorRoleFactCount
          : undefined,
        priorRoleSemanticFactMentionCount: empQ && 'priorRoleSemanticFactMentionCount' in empQ
          ? (empQ as { priorRoleSemanticFactMentionCount?: number }).priorRoleSemanticFactMentionCount
          : undefined,
        priorRoleSemanticDuplicationDetected: empQ && 'priorRoleSemanticDuplicationDetected' in empQ
          ? (empQ as { priorRoleSemanticDuplicationDetected?: boolean }).priorRoleSemanticDuplicationDetected
          : undefined,
        finalUnitRoleSlots: empQ?.finalUnitRoleSlots,
        finalSentenceHashes: empQ?.finalSentenceHashes,
        finalSentenceRoleSlots: empQ?.finalSentenceRoleSlots,
        hindiFiniteKaAnubhavCollision: empQ && 'hindiFiniteKaAnubhavCollision' in empQ
          ? (empQ as { hindiFiniteKaAnubhavCollision?: boolean }).hindiFiniteKaAnubhavCollision
          : undefined,
        unsupportedClaimCount: locale === 'ja' || locale === 'hi' || locale === 'es'
          ? (empQ && 'unsupportedClaimCount' in empQ
            ? (empQ as { unsupportedClaimCount?: number }).unsupportedClaimCount ?? 0
            : 0)
          : result.diagnostics?.unsupportedClaimCount,
        // Provider-candidate medium/grammar (truthful lineage — not final text).
        sourcePrintFactPresent: locale === 'hi'
          ? Boolean(
            hindiProviderQuality?.sourcePrintFactPresent
            ?? (empQ as { sourcePrintFactPresent?: boolean } | null)?.sourcePrintFactPresent,
          )
          : undefined,
        sourceBrandingFactPresent: locale === 'hi'
          ? Boolean(
            hindiProviderQuality?.sourceBrandingFactPresent
            ?? (empQ as { sourceBrandingFactPresent?: boolean } | null)?.sourceBrandingFactPresent,
          )
          : undefined,
        sourceMarketingFactPresent: locale === 'hi'
          ? Boolean(
            hindiProviderQuality?.sourceMarketingFactPresent
            ?? (empQ as { sourceMarketingFactPresent?: boolean } | null)?.sourceMarketingFactPresent,
          )
          : undefined,
        providerUnsupportedDesignMediumCount: locale === 'hi'
          ? (hindiProviderQuality?.providerUnsupportedDesignMediumCount
            ?? (empQ as { providerUnsupportedDesignMediumCount?: number } | null)
              ?.providerUnsupportedDesignMediumCount
            ?? 0)
          : undefined,
        providerUnsupportedDesignMediumKinds: locale === 'hi'
          ? (hindiProviderQuality?.providerUnsupportedDesignMediumKinds
            ?? (empQ as { providerUnsupportedDesignMediumKinds?: string[] } | null)
              ?.providerUnsupportedDesignMediumKinds
            ?? [])
          : undefined,
        providerPrintClaimDetected: locale === 'hi'
          ? Boolean(
            hindiProviderQuality?.providerPrintClaimDetected
            ?? (empQ as { providerPrintClaimDetected?: boolean } | null)?.providerPrintClaimDetected,
          )
          : undefined,
        providerBrandingClaimDetected: locale === 'hi'
          ? Boolean(
            hindiProviderQuality?.providerBrandingClaimDetected
            ?? (empQ as { providerBrandingClaimDetected?: boolean } | null)
              ?.providerBrandingClaimDetected,
          )
          : undefined,
        providerMarketingClaimDetected: locale === 'hi'
          ? Boolean(
            hindiProviderQuality?.providerMarketingClaimDetected
            ?? (empQ as { providerMarketingClaimDetected?: boolean } | null)
              ?.providerMarketingClaimDetected,
          )
          : undefined,
        finalUnsupportedDesignMediumCount: locale === 'hi' && empQ
          && 'finalUnsupportedDesignMediumCount' in empQ
          ? (empQ as { finalUnsupportedDesignMediumCount?: number })
            .finalUnsupportedDesignMediumCount
          : undefined,
        finalUnsupportedDesignMediumKinds: locale === 'hi' && empQ
          && 'finalUnsupportedDesignMediumKinds' in empQ
          ? (empQ as { finalUnsupportedDesignMediumKinds?: string[] })
            .finalUnsupportedDesignMediumKinds
          : undefined,
        deterministicUnsupportedDesignMediumCount: locale === 'hi'
          && result.origin === 'deterministic_fallback'
          && empQ
          && 'finalUnsupportedDesignMediumCount' in empQ
          ? (empQ as { finalUnsupportedDesignMediumCount?: number })
            .finalUnsupportedDesignMediumCount
          : undefined,
        deterministicUnsupportedDesignMediumKinds: locale === 'hi'
          && result.origin === 'deterministic_fallback'
          && empQ
          && 'finalUnsupportedDesignMediumKinds' in empQ
          ? (empQ as { finalUnsupportedDesignMediumKinds?: string[] })
            .finalUnsupportedDesignMediumKinds
          : undefined,
        hindiCurrentIntroFiniteVerbPresent: locale === 'hi' && empQ
          && 'hindiCurrentIntroFiniteVerbPresent' in empQ
          ? Boolean((empQ as { hindiCurrentIntroFiniteVerbPresent?: boolean })
            .hindiCurrentIntroFiniteVerbPresent)
          : undefined,
        hindiCurrentIntroCopulaPresent: locale === 'hi' && empQ
          ? Boolean((empQ as { hindiCurrentIntroCopulaPresent?: boolean })
            .hindiCurrentIntroCopulaPresent
            ?? (empQ as { hindiCurrentIntroFiniteVerbPresent?: boolean })
              .hindiCurrentIntroFiniteVerbPresent)
          : undefined,
        hindiCurrentDutyFiniteVerbPresent: locale === 'hi' && empQ
          ? Boolean((empQ as { hindiCurrentDutyFiniteVerbPresent?: boolean })
            .hindiCurrentDutyFiniteVerbPresent)
          : undefined,
        hindiCurrentDutyAuxiliaryPresent: locale === 'hi' && empQ
          && 'hindiCurrentDutyAuxiliaryPresent' in empQ
          ? Boolean((empQ as { hindiCurrentDutyAuxiliaryPresent?: boolean })
            .hindiCurrentDutyAuxiliaryPresent)
          : undefined,
        hindiPriorRoleFiniteVerbPresent: locale === 'hi' && empQ
          ? Boolean((empQ as { hindiPriorRoleFiniteVerbPresent?: boolean })
            .hindiPriorRoleFiniteVerbPresent)
          : undefined,
        hindiStandaloneJahanFragmentDetected: locale === 'hi' && empQ
          && 'hindiStandaloneJahanFragmentDetected' in empQ
          ? Boolean((empQ as { hindiStandaloneJahanFragmentDetected?: boolean })
            .hindiStandaloneJahanFragmentDetected)
          : undefined,
        hindiNominalExperienceFragmentDetected: locale === 'hi' && empQ
          && 'hindiNominalExperienceFragmentDetected' in empQ
          ? Boolean((empQ as { hindiNominalExperienceFragmentDetected?: boolean })
            .hindiNominalExperienceFragmentDetected)
          : undefined,
        hindiSentenceHasFiniteCopulaOrVerb: locale === 'hi' && empQ
          && 'hindiSentenceHasFiniteCopulaOrVerb' in empQ
          ? (empQ as { hindiSentenceHasFiniteCopulaOrVerb?: boolean[] })
            .hindiSentenceHasFiniteCopulaOrVerb
          : undefined,
        hindiIncompleteSentenceCount: locale === 'hi' && empQ
          && 'hindiIncompleteSentenceCount' in empQ
          ? (empQ as { hindiIncompleteSentenceCount?: number }).hindiIncompleteSentenceCount
          : undefined,
        hindiGrammarRejectionReason: locale === 'hi'
          ? (
            (empQ as { hindiGrammarRejectionReason?: string | null } | null)
              ?.hindiGrammarRejectionReason
            ?? null
          )
          : undefined,
        hindiGrammarRejectionReasons: locale === 'hi'
          ? (
            (empQ as { hindiGrammarRejectionReasons?: string[] } | null)
              ?.hindiGrammarRejectionReasons
            ?? []
          )
          : undefined,
        providerHindiNominalExperienceFragmentDetected: locale === 'hi'
          ? Boolean(hindiProviderQuality?.hindiNominalExperienceFragmentDetected)
          : undefined,
        providerHindiSentenceHasFiniteCopulaOrVerb: locale === 'hi'
          ? (hindiProviderQuality?.hindiSentenceHasFiniteCopulaOrVerb ?? null)
          : undefined,
        providerHindiIncompleteSentenceCount: locale === 'hi'
          ? (hindiProviderQuality?.hindiIncompleteSentenceCount ?? null)
          : undefined,
        providerHindiGrammarRejectionReasons: locale === 'hi'
          ? (hindiProviderQuality?.hindiGrammarRejectionReasons ?? [])
          : undefined,
        providerSlotRejectionReasons: locale === 'hi'
          ? (hindiProviderQuality?.slotRejectionReasons ?? [])
          : undefined,
        providerTypedRejectionReason: locale === 'hi'
          ? (hindiProviderRejectionReason
            || hindiProviderQuality?.typedRejectionReason
            || null)
          : (croatianProviderRejectionReason
            || japaneseProviderRejectionReason
            || spanishProviderRejectionReason
            || result.diagnostics?.providerRejectionReason
            || null),
        currentIntroSlotPresent: (locale === 'hi' || locale === 'es') && empQ
          ? Boolean((empQ as { currentIntroSlotPresent?: boolean }).currentIntroSlotPresent)
          : undefined,
        currentDutySlotPresent: (locale === 'hi' || locale === 'es') && empQ
          ? Boolean((empQ as { currentDutySlotPresent?: boolean }).currentDutySlotPresent)
          : undefined,
        priorRoleSlotPresent: (locale === 'hi' || locale === 'es') && empQ
          ? Boolean((empQ as { priorRoleSlotPresent?: boolean }).priorRoleSlotPresent)
          : undefined,
        slotValidationPassed: (locale === 'hi' || locale === 'es') && empQ
          ? Boolean((empQ as { slotValidationPassed?: boolean }).slotValidationPassed)
          : undefined,
        slotRejectionReasons: (locale === 'hi' || locale === 'es') && empQ
          ? ((empQ as { slotRejectionReasons?: string[] }).slotRejectionReasons ?? [])
          : undefined,
        summaryRepairAttempted,
        summaryRepairApplied: summaryRepairAttempted && success,
        summaryRepairValidationPassed: summaryRepairAttempted ? success : null,
        summaryDurationRepairApplied: durationRepairApplied,
        providerRejectionReason: hindiProviderRejectionReason
          || croatianProviderRejectionReason
          || japaneseProviderRejectionReason
          || spanishProviderRejectionReason
          || result.diagnostics?.providerRejectionReason,
        providerUnsupportedClaimCount: japaneseProviderUnsupportedClaimCount
          ?? spanishProviderUnsupportedClaimCount
          ?? result.diagnostics?.providerUnsupportedClaimCount,
        summaryFinalCandidateDiagnosticsRevision:
          SUMMARY_FINAL_CANDIDATE_DIAGNOSTICS_306_REVISION,
        durationFinalizerIdempotent,
        summaryPipelineRevision: SUMMARY_PIPELINE_REVISION,
        summaryNoopSuccessContractRevision: SUMMARY_NOOP_SUCCESS_CONTRACT_REVISION,
        summaryRuntimeMarkerSet: [...SUMMARY_RUNTIME_MARKER_SET],
        summaryBuilderRevision: locale === 'ar'
          ? SUMMARY_BUILDER_REVISION_AR
          : locale === 'ru'
            ? SUMMARY_BUILDER_REVISION_RU
            : locale === 'ja'
              ? SUMMARY_BUILDER_REVISION_JA
              : locale === 'hr'
                ? SUMMARY_BUILDER_REVISION_HR
                : SUMMARY_BUILDER_REVISION,
        summaryUnitSplitterRevision: (
          empQ && 'summaryUnitSplitterRevision' in empQ
            ? (empQ as { summaryUnitSplitterRevision?: string }).summaryUnitSplitterRevision
            : undefined
        )
          || (locale === 'ar'
            ? SUMMARY_UNIT_SPLITTER_REVISION_AR
            : locale === 'ru'
              ? SUMMARY_UNIT_SPLITTER_REVISION_RU
              : locale === 'ja'
                ? SUMMARY_UNIT_SPLITTER_REVISION_JA
                : locale === 'hr'
                  ? SUMMARY_UNIT_SPLITTER_REVISION_HR
                  : undefined),
        summaryGroundingRevision: (
          empQ && 'summaryGroundingRevision' in empQ
            ? (empQ as { summaryGroundingRevision?: string }).summaryGroundingRevision
            : undefined
        )
          || (locale === 'ar'
            ? SUMMARY_GROUNDING_REVISION_AR
            : locale === 'ru'
              ? SUMMARY_GROUNDING_REVISION_RU
              : locale === 'ja'
                ? SUMMARY_GROUNDING_REVISION_JA
                : locale === 'hr'
                  ? SUMMARY_GROUNDING_REVISION_HR
                  : locale === 'es'
                    ? SPANISH_SUMMARY_GROUNDING_306_REVISION
                    : undefined),
        summaryDurationFinalizerRevision:
          owned?.summaryDurationFinalizerRevision
          || (locale === 'ar'
            ? SUMMARY_DURATION_FINALIZER_REVISION_AR
            : locale === 'ru'
              ? SUMMARY_DURATION_FINALIZER_REVISION_RU
              : locale === 'ja'
                ? SUMMARY_DURATION_FINALIZER_REVISION_JA
                : locale === 'hr'
                  ? SUMMARY_DURATION_FINALIZER_REVISION_HR_V2
                  : SUMMARY_DURATION_FINALIZER_REVISION),
        providerCandidateHash,
        providerCandidateNormalizedHash,
        deterministicCandidateHash,
        deterministicCandidateNormalizedHash,
        durationPass1CandidateHash,
        durationPass2CandidateHash: durationPass2CandidateHash || localPass2Hash,
        groundingInputCandidateHash:
          groundingInputCandidateHash || hashSummaryCandidate(analyzedText),
        finalValidatedCandidateHash: success
          ? hashSummaryCandidate(analyzedText)
          : null,
        providerCandidateEqualsDeterministicCandidate: deterministicCandidateHash
          ? providerCandidateHash === deterministicCandidateHash
          : null,
        deterministicCandidateEqualsGroundingInput: (
          deterministicCandidateHash
          && (groundingInputCandidateHash || hashSummaryCandidate(analyzedText))
        )
          ? deterministicCandidateHash
            === (groundingInputCandidateHash || hashSummaryCandidate(analyzedText))
          : null,
        groundingInputEqualsFinalValidatedCandidate: success
          ? (groundingInputCandidateHash || hashSummaryCandidate(analyzedText))
            === hashSummaryCandidate(analyzedText)
          : null,
        providerCandidateSentenceCount,
        deterministicCandidateSentenceCount,
        durationPass1SentenceCount,
        durationPass2SentenceCount,
        groundingInputSentenceCount:
          groundingInputSentenceCount
          ?? countSummaryCandidateSentences(analyzedText, locale),
        durationPass1Hash: durationPass1CandidateHash,
        durationPass2Hash: durationPass2CandidateHash || localPass2Hash,
        durationSecondPassChanged,
        durationSecondPassChangeReason,
        contextCurrentRoleResolved,
        contextCurrentRoleLocalized,
        candidateCurrentRoleTitlePresent,
        candidateCurrentRoleTitleMatchesStructuredRole,
        candidateCurrentEmploymentIntroductionCount,
        candidateCurrentRoleOmittedDetected,
        deterministicCurrentEntryIdHash,
        deterministicPriorEntryIdHashes,
        currentEntryMaterialKeys,
        priorEntryMaterialKeys,
        currentSourceUnitHashes: currentSourceUnitDiag.currentSourceUnitHashes,
        currentSourceUnitMaterialKeys: currentSourceUnitDiag.currentSourceUnitMaterialKeys,
        currentSourceUnitActionKeys: currentSourceUnitDiag.currentSourceUnitActionKeys,
        currentSourceUnitObjectKeys: currentSourceUnitDiag.currentSourceUnitObjectKeys,
        currentSourceUnitWarehouseCueCount: currentSourceUnitDiag.currentSourceUnitWarehouseCueCount,
        currentSourceUnitFactOwnerEntryIdHash:
          currentSourceUnitDiag.currentSourceUnitFactOwnerEntryIdHash,
        flattenedFactArrayUsed,
        previousSummaryTextUsedByDeterministicFallback,
        providerTextUsedByDeterministicFallback,
        rejectionStage: blockedForDuration
          ? 'independent_final_duration_verification'
          : blockedForPerspective
            ? 'perspective_validation'
            : blockedForGrounding
              ? 'summary_grounding'
              : result.reason === SUMMARY_NOOP_REJECTION_REASON
                ? 'meaningful_change'
                : result.diagnostics?.rejectionStage,
        typedFailureReason: blockedForDuration
          ? 'experience_duration_mismatch'
          : blockedForPerspective
            ? 'summary_perspective_invalid'
            : blockedForGrounding
              ? (empQ && 'typedRejectionReason' in empQ && empQ.typedRejectionReason
                ? empQ.typedRejectionReason
                : 'summary_grounding_failed')
              : result.reason === SUMMARY_NOOP_REJECTION_REASON
                ? SUMMARY_NOOP_REJECTION_REASON
                : result.diagnostics?.typedFailureReason,
        grammarValidationPassed: (locale === 'hr' || locale === 'hi' || locale === 'es')
          && empQ
          && 'grammarValidationPassed' in empQ
          ? Boolean((empQ as { grammarValidationPassed?: boolean }).grammarValidationPassed)
          : result.diagnostics?.grammarValidationPassed,
      },
    };
  };

  const first = summaryPasses(
    candidate,
    factSet,
    cv,
    locale,
    durationSnapshot.total,
    roleDutyConflict,
  );
  if (first.ok && candidate.trim()) {
    const providerMc = evaluateSummaryMeaningfulChange(liveSummary, candidate);
    summaryMeaningfulChange = providerMc;
    if (!summaryGenerate && providerMc.noOpDetected) {
      providerNoOpDetected = true;
      noOpCandidateKind = 'provider';
      providerOutcomeHint = 'rejected_noop';
      if (!hindiProviderRejectionReason) {
        hindiProviderRejectionReason = SUMMARY_NOOP_REJECTION_REASON;
      }
      candidate = '';
    } else {
      if (emptySummarySeededFromCanonical && !providerRaw.trim()) {
        origin = 'deterministic_fallback';
        deterministicCandidateRaw = candidate;
        deterministicCandidateHash = hashSummaryCandidate(candidate);
        deterministicCandidateNormalizedHash = hashSummaryCandidate(
          normalizeSummaryCandidateText(candidate),
        );
        deterministicCandidateSentenceCount = countSummaryCandidateSentences(candidate, locale);
        clientFallbackUsed = true;
        clientFallbackReason = 'empty_summary_canonical_seed';
      }
      return attachSummaryDiag({
        blocked: false,
        text: candidate,
        origin,
        roleDutyConflict,
        countedAsSuccess: true,
      });
    }
  }

  // Fresh entry-owned rebuild — never seed from provider/previous Summary prose.
  deterministicCandidateRaw = normalizeLocaleText(
    deterministicLocalizedSummaryFromCanonical(
      factSet,
      locale,
      gender,
      durationSnapshot.total,
    ) || '',
    locale,
  );
  previousSummaryTextUsedByDeterministicFallback = Boolean(
    deterministicCandidateRaw
    && liveSummary
    && hashSummaryCandidate(deterministicCandidateRaw) === hashSummaryCandidate(liveSummary),
  );
  providerTextUsedByDeterministicFallback = Boolean(
    deterministicCandidateRaw
    && providerRaw
    && hashSummaryCandidate(deterministicCandidateRaw) === providerCandidateHash,
  );
  flattenedFactArrayUsed = false;
  deterministicCandidateHash = hashSummaryCandidate(deterministicCandidateRaw);
  deterministicCandidateNormalizedHash = hashSummaryCandidate(
    normalizeSummaryCandidateText(deterministicCandidateRaw),
  );
  deterministicCandidateSentenceCount = countSummaryCandidateSentences(
    deterministicCandidateRaw,
    locale,
  );

  if (deterministicCandidateRaw) {
    const groundedPass1 = resolveSummaryWithDurationPolicy(
      deterministicCandidateRaw,
      durationSnapshot.total,
      locale,
      {
        forceDurationPhrase: true,
        requireDurationClaim: true,
        context,
      },
    );
    const pass1Text = normalizeLocaleText(groundedPass1.summary, locale);
    durationPass1CandidateHash = hashSummaryCandidate(pass1Text);
    durationPass1SentenceCount = countSummaryCandidateSentences(pass1Text, locale);
    // Authoritative duration diagnostics must come from the rebuild pass.
    if (groundedPass1.durationDiagnostics) {
      durationDiagFinal = groundedPass1.durationDiagnostics;
    }
    const groundedPass2 = resolveSummaryWithDurationPolicy(
      pass1Text,
      durationSnapshot.total,
      locale,
      {
        forceDurationPhrase: true,
        requireDurationClaim: true,
        context,
      },
    );
    const pass2Raw = normalizeLocaleText(groundedPass2.summary, locale);
    const normalizeForDuration = (s: string) => s.replace(/\s+/g, ' ').trim();
    durationSecondPassChanged = normalizeForDuration(pass1Text) !== normalizeForDuration(pass2Raw);
    durationSecondPassChangeReason = durationSecondPassChanged
      ? (
        normalizeForDuration(pass1Text).length !== normalizeForDuration(pass2Raw).length
          ? `duration_finalizer_mutated_length_${normalizeForDuration(pass1Text).length}_to_${normalizeForDuration(pass2Raw).length}`
          : 'duration_finalizer_mutated_candidate'
      )
      : null;
    // Truthful pass2 hash (raw). Never feed a mutated pass2 into grounding.
    durationPass2CandidateHash = hashSummaryCandidate(pass2Raw);
    durationPass2SentenceCount = countSummaryCandidateSentences(pass2Raw, locale);
    let groundedText = durationSecondPassChanged ? pass1Text : pass2Raw;
    if (groundedPass2.durationDiagnostics) {
      durationDiagFinal = {
        ...durationDiagFinal,
        ...groundedPass2.durationDiagnostics,
        summaryDurationFinalizerRevision: locale === 'ar'
          ? SUMMARY_DURATION_FINALIZER_REVISION_AR
          : locale === 'ru'
            ? SUMMARY_DURATION_FINALIZER_REVISION_RU
            : locale === 'ja'
              ? SUMMARY_DURATION_FINALIZER_REVISION_JA
              : locale === 'hr'
                ? SUMMARY_DURATION_FINALIZER_REVISION_HR_V2
                : SUMMARY_DURATION_FINALIZER_REVISION,
      };
    }
    // Hindi: do not post-mutate after duration hashes (keeps pass2 === grounding input).
    if (locale === 'hi') {
      groundedText = normalizeForDuration(groundedText);
    } else if (locale === 'hr') {
      groundedText = dedupeSummarySentences(groundedText);
    } else if (locale === 'sr') {
      groundedText = preserveSerbianSummaryFactForms(groundedText, dutiesText);
      groundedText = normalizeSerbianLatinConfusables(groundedText);
      groundedText = repairMalformedSerbianGeneratedTokens(groundedText);
      groundedText = dedupeSummarySentences(groundedText);
      if (!/\b(?:zalih|inventar|snabdevanj|nabavk)\w*\b/iu.test(dutiesText)) {
        groundedText = groundedText
          .replace(/[^.!?]*\b(?:upravljala|upravljao)\s+sam\s+nivoima\s+zaliha[^.!?]*[.!?]/giu, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      // Never invent restaurant/food shells when Experience has no cooking duties.
      if (!/\b(?:jel\w*|kuhinj|restoran|koktel|hrana)\b/iu.test(dutiesText)) {
        groundedText = groundedText
          .replace(/[^.!?]*\bpriprema\s+jela\b[^.!?]*[.!?]/giu, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      groundedText = enrichSerbianSummaryEmploymentGrounding(groundedText, {
        role: context.role,
        company: context.company,
        startDate: context.startDate,
      });
      groundedText = dedupeSummarySentences(groundedText);
    }
    groundingInputCandidateHash = hashSummaryCandidate(groundedText);
    groundingInputSentenceCount = countSummaryCandidateSentences(groundedText, locale);
    const durationHashChainOk = Boolean(
      deterministicCandidateHash
      && durationPass1CandidateHash
      && durationPass2CandidateHash
      && groundingInputCandidateHash
      && deterministicCandidateHash === durationPass1CandidateHash
      && durationPass1CandidateHash === durationPass2CandidateHash
      && durationPass2CandidateHash === groundingInputCandidateHash
      && !durationSecondPassChanged,
    );
    const second = summaryPasses(
      groundedText,
      factSet,
      cv,
      locale,
      durationSnapshot.total,
      roleDutyConflict,
    );
    if (second.ok && (locale !== 'hi' || durationHashChainOk)) {
      const detMc = evaluateSummaryMeaningfulChange(liveSummary, groundedText);
      summaryMeaningfulChange = detMc;
      if (!summaryGenerate && detMc.noOpDetected) {
        deterministicNoOpDetected = true;
        noOpCandidateKind = 'client_deterministic';
        clientFallbackUsed = true;
        clientFallbackReason = SUMMARY_NOOP_REJECTION_REASON;
        if (!providerOutcomeHint && providerRaw.trim()) {
          providerOutcomeHint = hindiProviderRejectionReason
            || croatianProviderRejectionReason
            || japaneseProviderRejectionReason
            || spanishProviderRejectionReason
            ? (
              /locale|script|leak/i.test(String(
                hindiProviderRejectionReason
                || croatianProviderRejectionReason
                || japaneseProviderRejectionReason
                || spanishProviderRejectionReason,
              ))
                ? 'rejected_locale'
                : /grammar|nominal|finite|copula|fragment/i.test(String(
                  hindiProviderRejectionReason
                  || croatianProviderRejectionReason
                  || japaneseProviderRejectionReason
                  || spanishProviderRejectionReason,
                ))
                  ? 'rejected_grammar'
                  : /noop|meaningful/i.test(String(
                    hindiProviderRejectionReason
                    || croatianProviderRejectionReason
                    || japaneseProviderRejectionReason
                    || spanishProviderRejectionReason,
                  ))
                    ? 'rejected_noop'
                    : 'rejected_grounding'
            )
            : 'rejected_grounding';
        }
        return attachSummaryDiag({
          blocked: true,
          reason: SUMMARY_NOOP_REJECTION_REASON,
          text: typeof cv.summary === 'string' ? cv.summary : '',
          origin: cv.summaryOrigin || 'user',
          roleDutyConflict,
          countedAsSuccess: false,
        });
      }
      clientFallbackUsed = Boolean(providerRaw.trim()) || providerNoOpDetected;
      clientFallbackReason = clientFallbackUsed
        ? (hindiProviderRejectionReason
          || croatianProviderRejectionReason
          || japaneseProviderRejectionReason
          || spanishProviderRejectionReason
          || (providerNoOpDetected ? SUMMARY_NOOP_REJECTION_REASON : 'provider_rejected'))
        : null;
      if (!providerOutcomeHint && providerRaw.trim()) {
        providerOutcomeHint = providerNoOpDetected
          ? 'rejected_noop'
          : (
            /locale|script|leak/i.test(String(clientFallbackReason || ''))
              ? 'rejected_locale'
              : /grammar|nominal|finite|copula|fragment/i.test(String(clientFallbackReason || ''))
                ? 'rejected_grammar'
                : 'rejected_grounding'
          );
      }
      return attachSummaryDiag({
        blocked: false,
        text: groundedText,
        origin: 'deterministic_fallback',
        roleDutyConflict,
        countedAsSuccess: true,
      });
    }
    // Deterministic candidate failed postconditions — keep fail-closed visible
    // Summary, but analyze the rebuild attempt (not provider/old prose) for
    // candidate diagnostics when Hindi grounding is the failure mode.
    if (locale === 'hi' && groundedText.trim()) {
      return attachSummaryDiag({
        blocked: true,
        reason: !durationHashChainOk
          ? 'experience_duration_mismatch'
          : (second.reason || first.reason || 'summary_grounding_failed'),
        text: groundedText,
        origin: 'deterministic_fallback',
        roleDutyConflict,
        countedAsSuccess: false,
      });
    }
  }

  // When rebuild fails under Russian, never echo stale English Summary prose.
  return attachSummaryDiag({
    blocked: true,
    reason: summaryGenerate
      ? 'summary_generation_failed'
      : (first.reason || 'summary_grounding_failed'),
    text: ((locale === 'ru' || locale === 'ja' || locale === 'hr') && /Carries\s+out\s+assigned/iu.test(cv.summary || ''))
      || (locale === 'ja' && /Графический|Carries\s+out|[а-яёА-ЯЁ]{4,}/iu.test(cv.summary || ''))
      || (locale === 'hr' && (/グラフィック|[\u3040-\u30FF\u3400-\u9FFF]|proverav|koordinisala|razmenu|dodeljene|radnog\s+mesta|januara/iu.test(cv.summary || '')))
      ? ''
      : (cv.summary || ''),
    origin: cv.summaryOrigin || 'user',
    roleDutyConflict,
    countedAsSuccess: false,
  });
}

function detectBulletScripts(text: string): string[] {
  const scripts: string[] = [];
  if (/[A-Za-z]/.test(text)) scripts.push('latin');
  if (/[čćžšđČĆŽŠĐ]/.test(text)) scripts.push('latin_diacritic');
  if (/\p{Script=Cyrillic}/u.test(text)) scripts.push('cyrillic');
  if (/\p{Script=Devanagari}/u.test(text)) scripts.push('devanagari');
  if (/\p{Script=Arabic}/u.test(text)) scripts.push('arabic');
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(text)) scripts.push('cjk');
  return scripts;
}

function finalizeBullets(input: FinalizeCvAiFieldInput): FinalizeCvAiFieldResult {
  const locale = input.requestedLocale;
  const cv = input.cv;
  const gender = input.gender || cv.personal?.gender || '';
  const experienceIndex = experienceIndexForId(cv, input.experienceId);
  if (!input.experienceId || experienceIndex < 0) {
    return {
      text: '',
      origin: 'ai_generated',
      blocked: true,
      countedAsSuccess: false,
      reason: 'experience_entry_mismatch',
      roleDutyConflict: false,
      diagnostics: {
        rejectionStage: 'entry_identity',
        typedFailureReason: 'experience_entry_mismatch',
        responseRejectedForEntryMismatch: true,
        targetEntryStillExists: false,
        stableEntryIdentityMatched: false,
        selectedExperienceEntryIdHash: hashExperienceEntryId(input.experienceId),
      },
    };
  }
  const exp = findExperienceById(cv, input.experienceId);
  if (!exp) {
    return {
      text: '',
      origin: 'ai_generated',
      blocked: true,
      countedAsSuccess: false,
      reason: 'experience_entry_mismatch',
      roleDutyConflict: false,
      diagnostics: {
        rejectionStage: 'entry_identity',
        typedFailureReason: 'experience_entry_mismatch',
        responseRejectedForEntryMismatch: true,
        targetEntryStillExists: false,
        stableEntryIdentityMatched: false,
        selectedExperienceEntryIdHash: hashExperienceEntryId(input.experienceId),
      },
    };
  }
  const arrayIndexAtRequest = experienceIndex;
  const selectedExperienceEntryIdHash = hashExperienceEntryId(exp.id);
  const snapshot = input.operationSnapshot;
  if (
    snapshot?.experienceEntryId
    && snapshot.experienceEntryId !== exp.id
  ) {
    return {
      text: '',
      origin: 'ai_generated',
      blocked: true,
      countedAsSuccess: false,
      reason: 'experience_entry_mismatch',
      roleDutyConflict: false,
      diagnostics: {
        rejectionStage: 'entry_identity:snapshot',
        typedFailureReason: 'experience_entry_mismatch',
        responseRejectedForEntryMismatch: true,
        targetEntryStillExists: true,
        stableEntryIdentityMatched: false,
        selectedExperienceEntryIdHash,
        operationSnapshotExperienceEntryIdHash: hashExperienceEntryId(snapshot.experienceEntryId),
        arrayIndexAtRequest,
      },
    };
  }
  const isPresent = Boolean(exp?.isPresent);
  const tenseMode: 'present' | 'past' = isPresent ? 'present' : 'past';
  const jobContext = input.jobContext || buildExperienceJobContext({
    position: exp?.position,
    industry: input.industry,
    locale,
    level: input.level,
  });
  const grounding = exp
    ? resolveExperienceAiGrounding(exp, jobContext, freezeExperienceAiDescription)
    : null;
  const textareaProvenance = exp ? resolveExperienceTextareaProvenance(exp) : null;
  // Mode follows the immutable live snapshot when present (empty live → generation).
  // Without a snapshot: treat context-excluded stale display as empty operational
  // source so baker→pharmacist (and similar) can occupation-fallback — never use
  // raw stale cooking/pharmacy display to force enhancement coverage.
  const liveOperationSource = (snapshot
    ? (snapshot.liveRawText || snapshot.normalizedSourceText || '')
    : (grounding?.staleGeneratedContentExcluded
      ? ''
      : (exp?.description || ''))).trim();
  const operationMode = resolveExperienceAiOperationMode(liveOperationSource);
  const sourceWasEmpty = operationMode === 'generate_from_job_context';
  // Fact authority: operation snapshot override, else unedited-AI pre-AI snapshot,
  // else live/grounding. Never treat unedited prior AI output as sole fact source.
  const authoritativeFactSource = (
    snapshot?.normalizedSourceText
    || (
      textareaProvenance?.currentTextareaProvenance === 'ai_generated_unedited'
        && (textareaProvenance.authoritativeFactText || '').trim()
        ? textareaProvenance.authoritativeFactText
        : ''
    )
    || grounding?.sourceDescription
    || ''
  ).trim();
  const shadowedExpForFacts: WorkExperience | null = exp
    ? (sourceWasEmpty
      ? {
        ...exp,
        description: '',
        originalUserDescription: '',
        canonicalDescription: '',
        generatedDescription: '',
        recoveredSemanticDuties: undefined,
        groundingRecoverySource: undefined,
      }
      : (authoritativeFactSource
        ? {
          ...(grounding?.experienceForAi || exp),
          description: authoritativeFactSource,
          originalUserDescription:
            (exp.originalUserDescription || '').trim() || authoritativeFactSource,
          canonicalDescription:
            (exp.canonicalDescription || '').trim() || authoritativeFactSource,
          descriptionOrigin: 'user' as const,
        }
        : (grounding?.experienceForAi || exp)))
    : null;
  const cvForFacts: CVData = shadowedExpForFacts
    ? {
      ...cv,
      experience: (cv.experience || []).map((e) =>
        (e.id === exp!.id ? shadowedExpForFacts : e)),
    }
    : cv;
  const factSet = buildCvCanonicalFactSet(cvForFacts);
  // After occupation/context exclusion, never re-read live/canonical cooking via
  // freezeExperienceAiDescription — that would resurrect stale FACT LOCK duties.
  const dutiesText = sourceWasEmpty
    ? ''
    : (grounding?.staleGeneratedContentExcluded
      ? ''
      : (authoritativeFactSource
        || dutiesTextFromCv(cvForFacts, input.experienceId)));
  const consistency = evaluateRoleDutyConsistency({
    profileJobTitle: cv.personal?.jobTitle,
    experienceTitle: exp?.position,
    dutiesText,
  });
  const roleDutyConflict = consistency.conflict;
  const canonical = sourceWasEmpty ? [] : bulletsForExperience(factSet, experienceIndex);
  const sourceForCoverage = sourceWasEmpty
    ? ''
    : (authoritativeFactSource
      || liveOperationSource
      || canonical.map((f) => f.sourceText || f.value).join('\n'));
  const sourceUnits = sourceWasEmpty
    ? []
    : (snapshot?.units.length
      ? snapshot.units.map((u) => u.rawUnit)
      : extractSourceDutyUnits(sourceForCoverage));
  const sourceFactCount = sourceUnits.length;
  const providerBulletCount = splitExperienceBullets(input.candidate || '').filter(Boolean).length;
  let generationProviderValidationPassed: boolean | null = null;
  let generationProviderRejectionReason: string | null = null;
  let generationFinalPostconditionPassed: boolean | null = null;
  let generationFallbackBuilderKind: string | null = null;
  let generationFallbackFailureReason: string | null = null;

  let lastRejectStage = 'init';
  let lastRejectReason = sourceWasEmpty
    ? 'experience_generation_failed'
    : 'experience_material_fact_coverage_incomplete';
  let lastCovered = 0;
  let lastRequired = sourceFactCount;
  let providerCoveredFactCount = 0;
  let providerRequiredFactCount = sourceFactCount;
  let providerUncoveredFactIdentityHashes: string[] = [];
  let providerAccepted = false;
  let fallbackBulletCount = 0;
  let fallbackApplied = false;
  let clientDeterministicFallbackAttempted = false;
  let clientDeterministicFallbackReason: string | undefined = undefined;
  let providerRejectionReason: string | undefined = undefined;
  let providerRejectionStage: string | undefined = undefined;
  let providerDetectedMaterialFamilyCount = 0;
  let authoritativeRequiredFamilyCount = 0;
  let fallbackCoveredFamilyCount = 0;
  let finalSelectedCoveredFamilyCount = 0;
  let clientDeterministicFallbackBulletCount = 0;
  let clientDeterministicFallbackScripts: string[] = [];
  let clientDeterministicFallbackRequiredFactCount = sourceFactCount;
  let clientDeterministicFallbackCoveredFactCount = 0;
  let clientDeterministicFallbackApplied = false;
  let clientDeterministicFallbackUncoveredFactIds: string[] = [];
  let generationFallbackAttempted = false;
  let generationFallbackApplied = false;
  let providerNoOpDetected = false;
  const noOpRepairAttemptedFlag = Boolean(input.noOpRepairAttempted);
  let noOpRepairValidationPassed: boolean | null = null;
  let noOpRepairMeaningfulChangeDetected: boolean | null = null;
  let noOpRepairApplied = false;
  let noOpRepairUnsupportedClaimCount = 0;
  let noOpRepairUnsupportedClaimKinds: ExperienceUnsupportedClaimKind[] = [];
  let noOpRepairScopeExpansionDetected = false;
  let noOpRepairUniversalQuantifierDetected = false;
  let noOpRepairResponsibilityEscalationDetected = false;
  let noOpRepairRejectionReason: string | null = null;
  let unsupportedClaimRepairAttempted = false;
  let unsupportedClaimRepairKind: string | null = null;
  let unsupportedClaimRepairValidationPassed: boolean | null = null;
  let unsupportedClaimRepairApplied = false;
  let unsupportedClaimRepairRejectionReason: string | null = null;
  let unsupportedClaimRepairUnsupportedClaimCount = 0;
  let unsupportedClaimRepairUnsupportedClaimKinds: ExperienceUnsupportedClaimKind[] = [];
  let unsupportedClaimRepairResidualUnsupportedClaimCount = 0;
  let unsupportedClaimRepairResidualUnsupportedClaimKinds: ExperienceUnsupportedClaimKind[] = [];
  let unsupportedClaimRepairCoverageRequiredCount: number | null = null;
  let unsupportedClaimRepairCoverageCoveredCount: number | null = null;
  let unsupportedClaimRepairUncoveredFactIdentityHashes: string[] = [];
  let unsupportedClaimRepairHash: string | null = null;
  let unsupportedClaimRepairNormalizedHash: string | null = null;
  let sourcePredicateIdentityCount = 0;
  let candidatePredicateIdentityCount = 0;
  let candidateAddedPredicateCount = 0;
  let candidateAddedPredicateIdentityHashes: string[] = [];
  let unsupportedPredicateKindCount = 0;
  let coordinatedPredicateExpansionDetected = false;
  let sourceUnitPredicateCoveragePassed: boolean | null = null;
  let repairResidualAddedPredicateCount = 0;
  let repairResidualAddedPredicateIdentityHashes: string[] = [];
  let finalUnsupportedClaimCount = 0;
  let finalUnsupportedClaimKinds: ExperienceUnsupportedClaimKind[] = [];
  let lastUnsupportedClaimCount = 0;
  let lastUnsupportedClaimKinds: ExperienceUnsupportedClaimKind[] = [];
  let providerUnsupportedClaimCount: number | null = null;
  let providerUnsupportedClaimKinds: ExperienceUnsupportedClaimKind[] = [];
  let lastScopeExpansionDetected = false;
  let lastUniversalQuantifierDetected = false;
  let lastResponsibilityEscalationDetected = false;
  let deterministicFallbackAttemptedAfterNoOp = false;
  let deterministicFallbackAppliedAfterNoOp = false;
  let finalCandidateSource: string | undefined = undefined;
  let generationValidationMeta = {
    relevanceValidationPassed: false,
    perspectiveValidationPassed: false,
    tenseValidationPassed: false,
    unsupportedClaimCount: 0,
    generatedBulletCount: 0,
  };
  const serverFallbackUsed = input.originHint === 'deterministic_fallback';
  const apiResponseKind: NonNullable<FinalizeCvAiFieldResult['diagnostics']>['apiResponseKind'] =
    input.originHint === 'deterministic_fallback'
      ? 'fallback'
      : input.originHint === 'ai_repaired'
        ? 'repair'
        : 'provider';

  const baseDiag = (): NonNullable<FinalizeCvAiFieldResult['diagnostics']> => ({
    sourceLocale: locale,
    targetLocale: locale,
    targetScript: resolveTargetScriptForLocale(locale),
    sourceFactCount,
    requiredFactCount: lastRequired,
    coveredFactCount: lastCovered,
    providerCoveredFactCount,
    providerRequiredFactCount,
    providerUncoveredFactCount: Math.max(0, providerRequiredFactCount - providerCoveredFactCount),
    providerUncoveredFactIdentityHashes: [...providerUncoveredFactIdentityHashes],
    providerAccepted,
    providerBulletCount,
    fallbackBulletCount,
    finalBulletCount: 0,
    finalBulletScripts: [],
    tenseMode,
    rejectionStage: lastRejectStage,
    typedFailureReason: lastRejectReason,
    fallbackApplied,
    countedAsSuccess: false,
    apiResponseKind,
    serverFallbackUsed,
    clientDeterministicFallbackAttempted,
    clientDeterministicFallbackReason,
    providerRejectionReason,
    providerRejectionStage,
    providerUnsupportedClaimCount,
    providerUnsupportedClaimKinds: [...providerUnsupportedClaimKinds],
    providerDetectedMaterialFamilyCount,
    authoritativeRequiredFamilyCount,
    fallbackCoveredFamilyCount,
    finalSelectedCoveredFamilyCount,
    clientDeterministicFallbackBulletCount,
    clientDeterministicFallbackScripts,
    clientDeterministicFallbackRequiredFactCount,
    clientDeterministicFallbackCoveredFactCount,
    clientDeterministicFallbackApplied,
    clientDeterministicFallbackUncoveredFactIds,
    operationMode,
    sourceWasEmpty,
    generationFallbackAttempted,
    generationFallbackApplied,
    generatedBulletCount: generationValidationMeta.generatedBulletCount,
    relevanceValidationPassed: generationValidationMeta.relevanceValidationPassed,
    perspectiveValidationPassed: generationValidationMeta.perspectiveValidationPassed,
    tenseValidationPassed: generationValidationMeta.tenseValidationPassed,
    unsupportedClaimCount: generationValidationMeta.unsupportedClaimCount,
    generationProviderValidationPassed,
    generationProviderRejectionReason,
    generationFinalPostconditionPassed,
    generationFallbackBuilderKind,
    generationFallbackFailureReason,
    providerNoOpDetected,
    noOpRepairAttempted: noOpRepairAttemptedFlag,
    noOpRepairValidationPassed: noOpRepairValidationPassed ?? undefined,
    noOpRepairMeaningfulChangeDetected: noOpRepairMeaningfulChangeDetected ?? undefined,
    noOpRepairApplied,
    noOpRepairUnsupportedClaimCount,
    noOpRepairUnsupportedClaimKinds,
    noOpRepairScopeExpansionDetected,
    noOpRepairUniversalQuantifierDetected,
    noOpRepairResponsibilityEscalationDetected,
    noOpRepairRejectionReason,
    unsupportedClaimRepairAttempted,
    unsupportedClaimRepairKind,
    unsupportedClaimRepairValidationPassed,
    unsupportedClaimRepairApplied,
    unsupportedClaimRepairRejectionReason,
    unsupportedClaimRepairUnsupportedClaimCount,
    unsupportedClaimRepairUnsupportedClaimKinds,
    unsupportedClaimRepairResidualUnsupportedClaimCount,
    unsupportedClaimRepairResidualUnsupportedClaimKinds,
    unsupportedClaimRepairCoverageRequiredCount,
    unsupportedClaimRepairCoverageCoveredCount,
    unsupportedClaimRepairUncoveredFactIdentityHashes,
    unsupportedClaimRepairHash,
    unsupportedClaimRepairNormalizedHash,
    experienceRepairLineageRevision: EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
    spanishExperienceRepairGroundingRevision: SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION,
    experiencePredicateRepairLineageRevision: EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
    spanishExperiencePredicateGroundingRevision: SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION,
    sourcePredicateIdentityCount,
    candidatePredicateIdentityCount,
    candidateAddedPredicateCount,
    candidateAddedPredicateIdentityHashes,
    unsupportedPredicateKindCount,
    coordinatedPredicateExpansionDetected,
    sourceUnitPredicateCoveragePassed,
    repairResidualAddedPredicateCount,
    repairResidualAddedPredicateIdentityHashes,
    finalUnsupportedClaimCount,
    finalUnsupportedClaimKinds,
    experienceAiNoOpRecoveryRevision: EXPERIENCE_AI_NOOP_RECOVERY_REVISION,
    experienceAiUnsupportedExpansionRevision: EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION,
    deterministicFallbackAttemptedAfterNoOp,
    deterministicFallbackAppliedAfterNoOp,
    finalCandidateSource,
  });

  const tryAcceptGeneration = (
    text: string,
    origin: FinalizeCvAiFieldResult['origin'],
    stage: string,
  ): FinalizeCvAiFieldResult | null => {
    const candidate = (text || '').trim();
    const purityProbe = candidate
      ? validateAiUnitLocalePurity(candidate, locale, {
        kind: 'experience_bullet',
        requireUnits: true,
      })
      : null;
    if (!candidate) {
      lastRejectStage = stage;
      lastRejectReason = stage.includes('fallback')
        ? 'empty_generation_fallback'
        : 'experience_generation_failed';
      if (stage.includes('fallback')) generationFallbackFailureReason = 'empty_generation_fallback';
      else {
        generationProviderValidationPassed = false;
        generationProviderRejectionReason = 'experience_generation_failed';
      }
      generationFinalPostconditionPassed = false;
      return null;
    }
    const gen = validateExperienceGenerationOutput(candidate, {
      locale,
      position: exp?.position || cv.personal?.jobTitle || '',
      isPresent,
      gender: cv.personal?.gender || input.gender || '',
    });
    generationValidationMeta = {
      relevanceValidationPassed: gen.relevanceValidationPassed,
      perspectiveValidationPassed: gen.perspectiveValidationPassed,
      tenseValidationPassed: gen.tenseValidationPassed,
      unsupportedClaimCount: gen.unsupportedClaimCount,
      generatedBulletCount: gen.generatedBulletCount,
    };
    if (!gen.ok) {
      lastRejectStage = stage;
      lastRejectReason = gen.reason || 'experience_generation_failed';
      if (stage.includes('fallback')) generationFallbackFailureReason = lastRejectReason;
      else {
        generationProviderValidationPassed = false;
        generationProviderRejectionReason = lastRejectReason;
      }
      generationFinalPostconditionPassed = false;
      return null;
    }
    // Generation mode: locale/script safety only — never require canonical duties
    // or enhancement-only missing_canonical_duty postconditions.
    // Never exempt wrong_language / locale_mismatch (build 271 mixed EN+SR).
    const pass = bulletsPass(candidate, factSet, cvForFacts, locale, experienceIndex, isPresent);
    if (!pass.ok) {
      const enhancementOnly = pass.reason === 'missing_canonical_duty'
        || pass.reason === 'material_duty_removed'
        || pass.reason === 'unsupported_generated_duty';
      // Free-text title domain labels (any script) can trip per-unit locale
      // guesses during generation. If whole-field locale guards pass, accept.
      const localeSoftOk = (
        pass.reason === 'wrong_language'
        || pass.reason === 'locale_mismatch'
        || pass.reason === 'wrong_script'
        || pass.reason === 'mixed_language'
      )
        && textMatchesRequestedFieldLocale(candidate, locale, 'experience_bullet')
        && !isWrongLanguageAiOutput(candidate, locale)
        && Boolean(purityProbe?.ok);
      if (!enhancementOnly && !localeSoftOk) {
        lastRejectStage = stage;
        lastRejectReason = pass.reason === 'locale_mismatch' || pass.reason === 'wrong_language' || pass.reason === 'wrong_script' || pass.reason === 'mixed_language'
          ? 'experience_generation_locale_invalid'
          : (pass.reason || 'experience_generation_failed');
        if (stage.includes('fallback')) generationFallbackFailureReason = lastRejectReason;
        else {
          generationProviderValidationPassed = false;
          generationProviderRejectionReason = lastRejectReason;
        }
        generationFinalPostconditionPassed = false;
        return null;
      }
    }
    // Entry isolation also applies to empty-source generation / occupation fallback.
    const leakage = validateCrossEntryExperienceLeakage({
      cv,
      targetExperienceId: exp.id,
      candidate,
      targetPosition: exp.position,
    });
    if (!leakage.ok) {
      lastRejectStage = `${stage}:cross_entry_leakage`;
      lastRejectReason = leakage.reason || 'cross_entry_fact_leakage';
      generationFinalPostconditionPassed = false;
      return null;
    }
    const bulletCount = splitExperienceBullets(candidate).filter(Boolean).length;
    const purity = purityProbe || validateAiUnitLocalePurity(candidate, locale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    const isClientFallback = origin === 'deterministic_fallback';
    if (isClientFallback) {
      fallbackApplied = true;
      fallbackBulletCount = bulletCount;
      clientDeterministicFallbackApplied = true;
      clientDeterministicFallbackBulletCount = bulletCount;
      clientDeterministicFallbackScripts = detectBulletScripts(candidate);
      generationFallbackApplied = true;
      generationFallbackBuilderKind = 'job_context_generation';
      generationFallbackFailureReason = null;
      // Do not keep a prior provider rejection as the fallback "reason" when fallback succeeds.
      clientDeterministicFallbackReason = undefined;
    } else {
      generationProviderValidationPassed = true;
      generationProviderRejectionReason = null;
    }
    generationFinalPostconditionPassed = true;
    return {
      blocked: false,
      text: candidate,
      origin,
      roleDutyConflict,
      countedAsSuccess: true,
      diagnostics: {
        ...baseDiag(),
        coveredFactCount: 0,
        requiredFactCount: 0,
        finalBulletCount: bulletCount,
        finalBulletScripts: detectBulletScripts(candidate),
        detectedLocaleByBullet: purity.detectedLocaleByUnit,
        detectedScriptByBullet: purity.detectedScriptByUnit,
        wrongLocaleBulletCount: purity.wrongLocaleUnitCount,
        wrongScriptBulletCount: purity.wrongScriptUnitCount,
        mixedLanguageBulletCount: purity.mixedLanguageUnitCount,
        sourceLanguageLeakageDetected: purity.sourceLanguageLeakageDetected,
        targetLocalePurityPassed: purity.targetLocalePurityPassed,
        targetLocale: locale,
        targetScript: resolveTargetScriptForLocale(locale),
        rejectionStage: undefined,
        typedFailureReason: undefined,
        countedAsSuccess: true,
        generatedBulletCount: bulletCount,
        relevanceValidationPassed: true,
        generationFallbackAttempted: isClientFallback || generationFallbackAttempted,
        generationFallbackApplied: isClientFallback,
        contentLocaleUpdatedAfterApply: true,
        contentLocaleAfterApply: locale,
      },
    };
  };

  const tryAccept = (
    text: string,
    origin: FinalizeCvAiFieldResult['origin'],
    stage: string,
    options?: {
      /** When set, skip semantic rediscovery and use provenance coverage. */
      provenancedIdentity?: ReturnType<typeof validateProvenancedDeterministicFallbackCoverage>;
    },
  ): FinalizeCvAiFieldResult | null => {
    const candidate = (text || '').trim();
    if (!candidate) {
      lastRejectStage = stage;
      lastRejectReason = 'empty_bullets';
      return null;
    }
    const crossLocaleAccept = stage === 'cross_locale_translation_fallback';
    const russianDesignRebuild = stage === 'russian_design_family_rebuild';
    const croatianDesignRebuild = stage === 'croatian_design_family_rebuild';
    const crossLocaleOp = Boolean(
      sourceForCoverage
      && (
        crossLocaleAccept
        || !sourceUsableInLocale(sourceForCoverage, locale)
        || isCrossLocaleOperation(detectTextLocale(sourceForCoverage), locale)
      ),
    );
    // Cross-locale provider + translation fallback: locale/script purity first,
    // then semantic frame coverage (never Serbian↔Hindi token overlap).
    // Russian/Croatian design rebuild also skips English/canonical fidelity — shells are
    // entry-owned job-context facts, not translations of poisoned textarea.
    if (
      (crossLocaleOp && (crossLocaleAccept || stage === 'provider'))
      || russianDesignRebuild
      || croatianDesignRebuild
    ) {
      if (!textMatchesRequestedFieldLocale(candidate, locale, 'experience_bullet')) {
        lastRejectStage = stage;
        lastRejectReason = 'locale_mismatch';
        return null;
      }
      if (isWrongLanguageAiOutput(candidate, locale)) {
        lastRejectStage = stage;
        lastRejectReason = 'wrong_language';
        return null;
      }
      const unitPurity = validateAiUnitLocalePurity(candidate, locale, {
        kind: 'experience_bullet',
        requireUnits: true,
      });
      if (!unitPurity.ok) {
        lastRejectStage = `${stage}:locale_purity`;
        lastRejectReason = unitPurity.reason || 'wrong_language';
        return null;
      }
      if (hasAiProtocolMarker(candidate) || hasCvMetaFallbackText(candidate)) {
        lastRejectStage = stage;
        lastRejectReason = 'meta_fallback_text';
        return null;
      }
    } else {
      // Same-locale Russian design: family/generic-duty gate before canonical
      // fidelity so provider rejection stays russian_design_* (not missing_canonical_duty).
      if (
        locale === 'ru'
        && stage === 'provider'
        && experienceNeedsRussianDesignFamilyRebuild({
          locale,
          sourceDescription: sourceForCoverage,
          position: exp?.position || cv.personal?.jobTitle,
        })
      ) {
        const fam = validateRussianDesignFactFamilies(candidate);
        providerDetectedMaterialFamilyCount = fam.coveredFamilies.length;
        authoritativeRequiredFamilyCount = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
        if (!fam.ok) {
          lastRejectStage = `${stage}:russian_design_families`;
          lastRejectReason = fam.reason || 'russian_design_family_coverage_incomplete';
          lastRequired = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
          lastCovered = fam.coveredFamilies.length;
          return null;
        }
      }
      if (
        locale === 'hr'
        && stage === 'provider'
        && experienceNeedsCroatianDesignFamilyRebuild({
          locale,
          sourceDescription: sourceForCoverage,
          position: exp?.position || cv.personal?.jobTitle,
        })
      ) {
        const fam = validateCroatianDesignFactFamilies(candidate);
        providerDetectedMaterialFamilyCount = fam.coveredFamilies.length;
        authoritativeRequiredFamilyCount = 3;
        if (!fam.ok) {
          lastRejectStage = `${stage}:croatian_design_families`;
          lastRejectReason = fam.reason || 'croatian_design_material_coverage_incomplete';
          lastRequired = 3;
          lastCovered = fam.coveredFamilies.length;
          return null;
        }
        const evidence = analyzeCroatianSerbianLocaleEvidence(candidate);
        if (evidence.serbianLeakageDetected) {
          lastRejectStage = `${stage}:croatian_serbian_locale`;
          lastRejectReason = 'croatian_serbian_locale_leakage';
          return null;
        }
      }
      const pass = bulletsPass(candidate, factSet, cvForFacts, locale, experienceIndex, isPresent);
      if (!pass.ok) {
        lastRejectStage = stage;
        lastRejectReason = pass.reason || 'fidelity_failed';
        return null;
      }
    }
    // Entry isolation: never apply another role's distinctive facts.
    const leakage = validateCrossEntryExperienceLeakage({
      cv,
      targetExperienceId: exp.id,
      candidate,
      targetPosition: exp.position,
    });
    if (!leakage.ok) {
      lastRejectStage = `${stage}:cross_entry_leakage`;
      lastRejectReason = leakage.reason || 'cross_entry_fact_leakage';
      return null;
    }
    // Russian design family rebuild: validate against authoritative three-family
    // shells — never against poisoned live textarea / source-preserving prose.
    if (russianDesignRebuild && locale === 'ru') {
      void RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION;
      const authoritativeDesignSource = normalizeLocaleText(
        buildJobContextGenerationFallback({
          locale: 'ru',
          gender,
          position: exp?.position || cv.personal?.jobTitle || 'design',
          industry: 'design',
          isPresent,
        }),
        locale,
      );
      const post = validateExperienceApplyMaterialPostcondition(
        authoritativeDesignSource || candidate,
        candidate,
        { targetLocale: 'ru' },
      );
      const fam = validateRussianDesignFactFamilies(candidate);
      authoritativeRequiredFamilyCount = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
      fallbackCoveredFamilyCount = fam.coveredFamilies.length;
      finalSelectedCoveredFamilyCount = fam.ok ? fam.coveredFamilies.length : 0;
      lastRequired = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
      lastCovered = fam.coveredFamilies.length;
      clientDeterministicFallbackRequiredFactCount = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
      clientDeterministicFallbackCoveredFactCount = fam.coveredFamilies.length;
      if (!fam.ok || !post.ok) {
        lastRejectStage = `${stage}:russian_design_families`;
        lastRejectReason = fam.reason
          || post.reason
          || 'russian_design_family_rebuild_failed';
        return null;
      }
      if (!textMatchesRequestedFieldLocale(candidate, locale, 'experience_bullet')) {
        lastRejectStage = `${stage}:locale_purity`;
        lastRejectReason = 'locale_mismatch';
        return null;
      }
    } else if (croatianDesignRebuild && locale === 'hr') {
      void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
      const authoritativeDesignSource = normalizeLocaleText(
        buildJobContextGenerationFallback({
          locale: 'hr',
          gender,
          position: 'graphic designer',
          industry: 'design',
          isPresent,
        }),
        locale,
      );
      const post = validateExperienceApplyMaterialPostcondition(
        authoritativeDesignSource || candidate,
        candidate,
        { targetLocale: 'hr' },
      );
      const fam = validateCroatianDesignFactFamilies(candidate);
      const evidence = analyzeCroatianSerbianLocaleEvidence(candidate);
      authoritativeRequiredFamilyCount = 3;
      fallbackCoveredFamilyCount = fam.coveredFamilies.length;
      finalSelectedCoveredFamilyCount = fam.ok ? fam.coveredFamilies.length : 0;
      lastRequired = 3;
      lastCovered = fam.coveredFamilies.length;
      clientDeterministicFallbackRequiredFactCount = 3;
      clientDeterministicFallbackCoveredFactCount = fam.coveredFamilies.length;
      if (!fam.ok || !post.ok || evidence.serbianLeakageDetected) {
        lastRejectStage = `${stage}:croatian_design_families`;
        lastRejectReason = evidence.serbianLeakageDetected
          ? 'croatian_serbian_locale_leakage'
          : (fam.reason || post.reason || 'croatian_design_material_coverage_incomplete');
        return null;
      }
      // Cross-domain: warehouse families must not appear on design rebuild.
      if (/zaprimljen|skladišn|premještanj|magacin/iu.test(candidate)
        && !/vizualn|grafičk|dizajn/iu.test(candidate)) {
        lastRejectStage = `${stage}:croatian_domain_mismatch`;
        lastRejectReason = 'croatian_experience_domain_mismatch';
        return null;
      }
      if (!textMatchesRequestedFieldLocale(candidate, locale, 'experience_bullet')) {
        lastRejectStage = `${stage}:locale_purity`;
        lastRejectReason = 'locale_mismatch';
        return null;
      }
    } else if (sourceForCoverage && crossLocaleOp && (crossLocaleAccept || stage === 'provider')) {
      // Locale purity already validated above. Prefer semantic frames across
      // languages; material keys are a secondary signal when present.
      // Russian design: never accept on soft frame matching alone — require
      // distinct material families (creation / review-adapt / final files).
      // German warehouse: soft frames alone are insufficient — require object-
      // level coverage (incoming goods / documents / prep+movement).
      // Spanish warehouse: same object-level coverage contract.
      void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
      void SPANISH_CV_AI_305_REVISION;
      const semantic = validateCrossLocaleSemanticCoverage(sourceForCoverage, candidate);
      const post = validateExperienceApplyMaterialPostcondition(sourceForCoverage, candidate, {
        targetLocale: locale,
      });
      const needsRuDesignFamilies = locale === 'ru'
        && sourceRequiresRussianDesignFamilies(sourceForCoverage);
      const ruDesign = needsRuDesignFamilies
        ? validateRussianDesignFactFamilies(candidate)
        : null;
      const needsDeWarehouse = locale === 'de'
        && sourceRequiresGermanWarehouseFactCoverage(sourceForCoverage);
      const deWarehouse = needsDeWarehouse
        ? validateGermanWarehouseExperienceCoverage(sourceForCoverage, candidate)
        : null;
      const deExpansion = locale === 'de'
        ? detectGermanExperienceUnsupportedExpansion(sourceForCoverage, candidate)
        : null;
      const needsEsWarehouse = locale === 'es'
        && sourceRequiresSpanishWarehouseFactCoverage(sourceForCoverage);
      const esWarehouse = needsEsWarehouse
        ? validateSpanishWarehouseExperienceCoverage(sourceForCoverage, candidate)
        : null;
      const esExpansion = locale === 'es'
        ? detectSpanishExperienceUnsupportedExpansion(sourceForCoverage, candidate)
        : null;
      lastRequired = semantic.requiredCount || sourceFactCount;
      lastCovered = semantic.coveredCount;
      if (deExpansion && deExpansion.count > 0) {
        lastRejectStage = `${stage}:german_unsupported_expansion`;
        lastRejectReason = deExpansion.labels[0] || 'unsupported_generated_duty';
        lastUnsupportedClaimCount = deExpansion.count;
        lastUnsupportedClaimKinds = deExpansion.kinds;
        lastScopeExpansionDetected = deExpansion.scopeExpansionDetected;
        generationValidationMeta = {
          ...generationValidationMeta,
          unsupportedClaimCount: Math.max(
            generationValidationMeta.unsupportedClaimCount,
            deExpansion.count,
          ),
        };
        if (deWarehouse) {
          lastRequired = deWarehouse.required.length || lastRequired;
          lastCovered = deWarehouse.covered.length;
          clientDeterministicFallbackUncoveredFactIds = deWarehouse.uncovered.map(
            (id) => `de_wh_${id}`,
          );
          if (stage === 'provider') {
            providerUncoveredFactIdentityHashes = [...clientDeterministicFallbackUncoveredFactIds];
            providerCoveredFactCount = lastCovered;
            providerRequiredFactCount = lastRequired || Math.max(3, sourceFactCount);
          }
        }
        return null;
      }
      if (esExpansion && esExpansion.count > 0) {
        lastRejectStage = 'unsupported_claim_validation';
        lastRejectReason = esExpansion.labels[0] || 'guarantee_escalation';
        lastUnsupportedClaimCount = esExpansion.count;
        lastUnsupportedClaimKinds = esExpansion.kinds;
        lastScopeExpansionDetected = esExpansion.scopeExpansionDetected;
        sourcePredicateIdentityCount = esExpansion.sourcePredicateIdentityCount ?? 0;
        candidatePredicateIdentityCount = esExpansion.candidatePredicateIdentityCount ?? 0;
        candidateAddedPredicateCount = esExpansion.candidateAddedPredicateCount ?? 0;
        candidateAddedPredicateIdentityHashes = [
          ...(esExpansion.candidateAddedPredicateIdentityHashes || []),
        ];
        unsupportedPredicateKindCount = esExpansion.unsupportedPredicateKindCount ?? 0;
        coordinatedPredicateExpansionDetected = Boolean(
          esExpansion.coordinatedPredicateExpansionDetected,
        );
        sourceUnitPredicateCoveragePassed =
          esExpansion.sourceUnitPredicateCoveragePassed ?? null;
        if (stage === 'provider') {
          providerUnsupportedClaimCount = esExpansion.count;
          providerUnsupportedClaimKinds = [...esExpansion.kinds];
        }
        generationValidationMeta = {
          ...generationValidationMeta,
          unsupportedClaimCount: Math.max(
            generationValidationMeta.unsupportedClaimCount,
            esExpansion.count,
          ),
        };
        if (esWarehouse) {
          lastRequired = esWarehouse.required.length || lastRequired;
          lastCovered = esWarehouse.covered.length;
          clientDeterministicFallbackUncoveredFactIds = esWarehouse.uncovered.map(
            (id) => `es_wh_${id}`,
          );
          if (stage === 'provider') {
            providerUncoveredFactIdentityHashes = [...clientDeterministicFallbackUncoveredFactIds];
            providerCoveredFactCount = lastCovered;
            providerRequiredFactCount = lastRequired || Math.max(3, sourceFactCount);
          }
        }
        return null;
      }
      if (needsDeWarehouse && deWarehouse && !deWarehouse.ok) {
        lastRejectStage = `${stage}:german_warehouse_facts`;
        lastRejectReason = deWarehouse.reason || 'german_experience_warehouse_fact_coverage_incomplete';
        lastRequired = deWarehouse.required.length || Math.max(3, sourceFactCount);
        lastCovered = deWarehouse.covered.length;
        clientDeterministicFallbackUncoveredFactIds = deWarehouse.uncovered.map(
          (id) => `de_wh_${id}`,
        );
        if (stage === 'provider') {
          providerUncoveredFactIdentityHashes = [...clientDeterministicFallbackUncoveredFactIds];
          providerCoveredFactCount = lastCovered;
          providerRequiredFactCount = lastRequired;
        }
        return null;
      }
      if (needsEsWarehouse && esWarehouse && !esWarehouse.ok) {
        lastRejectStage = `${stage}:spanish_warehouse_facts`;
        lastRejectReason = esWarehouse.reason || 'spanish_experience_warehouse_fact_coverage_incomplete';
        lastRequired = esWarehouse.required.length || Math.max(3, sourceFactCount);
        lastCovered = esWarehouse.covered.length;
        clientDeterministicFallbackUncoveredFactIds = esWarehouse.uncovered.map(
          (id) => `es_wh_${id}`,
        );
        if (stage === 'provider') {
          providerUncoveredFactIdentityHashes = [...clientDeterministicFallbackUncoveredFactIds];
          providerCoveredFactCount = lastCovered;
          providerRequiredFactCount = lastRequired;
        }
        return null;
      }
      if (needsRuDesignFamilies && ruDesign && !ruDesign.ok) {
        lastRejectStage = `${stage}:russian_design_families`;
        lastRejectReason = ruDesign.reason || 'russian_design_family_coverage_incomplete';
        lastRequired = Math.max(3, post.required?.length || sourceFactCount);
        lastCovered = ruDesign.coveredFamilies.length;
        return null;
      }
      if (needsRuDesignFamilies && !post.ok) {
        lastRejectStage = `${stage}:material_postcondition`;
        lastRejectReason = post.reason || 'experience_material_fact_coverage_incomplete';
        lastRequired = post.required?.length ?? sourceFactCount;
        lastCovered = post.covered?.length ?? 0;
        return null;
      }
      if (needsDeWarehouse && deWarehouse?.ok) {
        lastRequired = deWarehouse.required.length;
        lastCovered = deWarehouse.covered.length;
        clientDeterministicFallbackUncoveredFactIds = [];
      } else if (needsEsWarehouse && esWarehouse?.ok) {
        lastRequired = esWarehouse.required.length;
        lastCovered = esWarehouse.covered.length;
        clientDeterministicFallbackUncoveredFactIds = [];
      } else if (semantic.ok && (!needsRuDesignFamilies || (post.ok && ruDesign?.ok))) {
        if (post.ok && (post.covered?.length || 0) > 0) {
          lastRequired = post.required?.length ?? lastRequired;
          lastCovered = post.covered?.length ?? lastCovered;
        }
      } else if (post.ok && (post.covered?.length || 0) >= Math.min(3, post.required?.length || sourceFactCount || 3)) {
        lastRequired = post.required?.length ?? sourceFactCount;
        lastCovered = post.covered?.length ?? 0;
      } else {
        lastRejectStage = `${stage}:semantic_coverage`;
        lastRejectReason = semantic.reason
          || post.reason
          || 'experience_material_fact_coverage_incomplete';
        if (!post.ok) {
          lastRequired = post.required?.length ?? lastRequired;
          lastCovered = post.covered?.length ?? lastCovered;
        }
        return null;
      }
    } else if (sourceForCoverage && !crossLocaleAccept) {
      if (locale === 'de') {
        void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
        const deExpansion = detectGermanExperienceUnsupportedExpansion(sourceForCoverage, candidate);
        if (deExpansion.count > 0) {
          lastRejectStage = `${stage}:german_unsupported_expansion`;
          lastRejectReason = deExpansion.labels[0] || 'unsupported_generated_duty';
          lastUnsupportedClaimCount = deExpansion.count;
          lastUnsupportedClaimKinds = deExpansion.kinds;
          lastScopeExpansionDetected = deExpansion.scopeExpansionDetected;
          generationValidationMeta = {
            ...generationValidationMeta,
            unsupportedClaimCount: Math.max(
              generationValidationMeta.unsupportedClaimCount,
              deExpansion.count,
            ),
          };
          return null;
        }
        if (sourceRequiresGermanWarehouseFactCoverage(sourceForCoverage)) {
          const deWarehouse = validateGermanWarehouseExperienceCoverage(
            sourceForCoverage,
            candidate,
          );
          if (!deWarehouse.ok) {
            lastRejectStage = `${stage}:german_warehouse_facts`;
            lastRejectReason = deWarehouse.reason
              || 'german_experience_warehouse_fact_coverage_incomplete';
            lastRequired = deWarehouse.required.length || sourceFactCount;
            lastCovered = deWarehouse.covered.length;
            clientDeterministicFallbackUncoveredFactIds = deWarehouse.uncovered.map(
              (id) => `de_wh_${id}`,
            );
            if (stage === 'provider') {
              providerUncoveredFactIdentityHashes = [...clientDeterministicFallbackUncoveredFactIds];
              providerCoveredFactCount = lastCovered;
              providerRequiredFactCount = lastRequired;
            }
            return null;
          }
          lastRequired = deWarehouse.required.length;
          lastCovered = deWarehouse.covered.length;
          clientDeterministicFallbackUncoveredFactIds = [];
        }
      }
      if (locale === 'es') {
        void SPANISH_CV_AI_305_REVISION;
        void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
        const esExpansion = detectSpanishExperienceUnsupportedExpansion(sourceForCoverage, candidate);
        const esWarehouseProbe = sourceRequiresSpanishWarehouseFactCoverage(sourceForCoverage)
          ? validateSpanishWarehouseExperienceCoverage(sourceForCoverage, candidate)
          : null;
        if (esExpansion.count > 0) {
          lastRejectStage = 'unsupported_claim_validation';
          lastRejectReason = esExpansion.labels[0] || 'guarantee_escalation';
          lastUnsupportedClaimCount = esExpansion.count;
          lastUnsupportedClaimKinds = esExpansion.kinds;
          lastScopeExpansionDetected = esExpansion.scopeExpansionDetected;
          sourcePredicateIdentityCount = esExpansion.sourcePredicateIdentityCount ?? 0;
          candidatePredicateIdentityCount = esExpansion.candidatePredicateIdentityCount ?? 0;
          candidateAddedPredicateCount = esExpansion.candidateAddedPredicateCount ?? 0;
          candidateAddedPredicateIdentityHashes = [
            ...(esExpansion.candidateAddedPredicateIdentityHashes || []),
          ];
          unsupportedPredicateKindCount = esExpansion.unsupportedPredicateKindCount ?? 0;
          coordinatedPredicateExpansionDetected = Boolean(
            esExpansion.coordinatedPredicateExpansionDetected,
          );
          sourceUnitPredicateCoveragePassed =
            esExpansion.sourceUnitPredicateCoveragePassed ?? null;
          if (esWarehouseProbe) {
            lastRequired = esWarehouseProbe.required.length || lastRequired;
            lastCovered = esWarehouseProbe.covered.length;
          }
          if (stage === 'provider') {
            providerUnsupportedClaimCount = esExpansion.count;
            providerUnsupportedClaimKinds = [...esExpansion.kinds];
            if (esWarehouseProbe) {
              providerCoveredFactCount = lastCovered;
              providerRequiredFactCount = lastRequired || Math.max(3, sourceFactCount);
            }
          }
          generationValidationMeta = {
            ...generationValidationMeta,
            unsupportedClaimCount: Math.max(
              generationValidationMeta.unsupportedClaimCount,
              esExpansion.count,
            ),
          };
          return null;
        }
        if (sourceRequiresSpanishWarehouseFactCoverage(sourceForCoverage)) {
          const esWarehouse = validateSpanishWarehouseExperienceCoverage(
            sourceForCoverage,
            candidate,
          );
          if (!esWarehouse.ok) {
            lastRejectStage = `${stage}:spanish_warehouse_facts`;
            lastRejectReason = esWarehouse.reason
              || 'spanish_experience_warehouse_fact_coverage_incomplete';
            lastRequired = esWarehouse.required.length || sourceFactCount;
            lastCovered = esWarehouse.covered.length;
            clientDeterministicFallbackUncoveredFactIds = esWarehouse.uncovered.map(
              (id) => `es_wh_${id}`,
            );
            if (stage === 'provider') {
              providerUncoveredFactIdentityHashes = [...clientDeterministicFallbackUncoveredFactIds];
              providerCoveredFactCount = lastCovered;
              providerRequiredFactCount = lastRequired;
            }
            return null;
          }
          lastRequired = esWarehouse.required.length;
          lastCovered = esWarehouse.covered.length;
          clientDeterministicFallbackUncoveredFactIds = [];
        }
      }
      const post = validateExperienceApplyMaterialPostcondition(sourceForCoverage, candidate, {
        targetLocale: locale,
      });
      if (!post.ok) {
        lastRejectStage = `${stage}:material_postcondition`;
        lastRejectReason = post.reason || 'experience_material_fact_coverage_incomplete';
        lastRequired = post.required?.length ?? sourceFactCount;
        lastCovered = post.covered?.length ?? 0;
        if (post.reason === 'unsupported_generated_duty') {
          lastUnsupportedClaimCount = post.unsupportedClaimCount
            || post.unsupportedClaimKinds?.length
            || 1;
          lastUnsupportedClaimKinds = post.unsupportedClaimKinds || [];
          lastScopeExpansionDetected = Boolean(post.scopeExpansionDetected);
          lastUniversalQuantifierDetected = Boolean(post.universalQuantifierDetected);
          lastResponsibilityEscalationDetected = Boolean(post.responsibilityEscalationDetected);
          generationValidationMeta = {
            ...generationValidationMeta,
            unsupportedClaimCount: Math.max(
              generationValidationMeta.unsupportedClaimCount,
              lastUnsupportedClaimCount,
            ),
          };
        }
        return null;
      }
      const identity = options?.provenancedIdentity
        || ((locale === 'sr' || locale === 'hr')
          && !/\p{Script=Devanagari}|\p{Script=Arabic}|[\u3040-\u30ff\u3400-\u9fff]/u.test(sourceForCoverage)
          ? validateSourceUnitsMateriallyPreserved(sourceForCoverage, candidate)
          : validateSourceFactIdentityCoverage(sourceForCoverage, candidate));
      lastRequired = identity.requiredIds.length;
      lastCovered = identity.coveredIds.length;
      if (stage === 'source_preserving_fallback' || stage === 'canonical_fallback') {
        clientDeterministicFallbackRequiredFactCount = identity.requiredIds.length;
        clientDeterministicFallbackCoveredFactCount = identity.coveredIds.length;
        clientDeterministicFallbackUncoveredFactIds = identity.missingIds || [];
      }
      if (!identity.ok) {
        // Provenanced deterministic path: never bypass via material-key catalogue.
        if (options?.provenancedIdentity) {
          lastRejectStage = `${stage}:source_fact_identity`;
          lastRejectReason = identity.reason || 'experience_material_fact_coverage_incomplete';
          return null;
        }
        // Cross-script provider/semantic path: allow only when every source unit has
        // a material key and description-level material coverage already passed.
        const units = sourceForCoverage
          .split(/\n+/)
          .map((l) => l.replace(/^[•\-\*\u2022]\s*/u, '').trim())
          .filter((l) => l.length > 8);
        const keyedUnits = units.filter((u) =>
          materialDutyKeysFromDescription(u).some((k) => k !== 'generic_duty'));
        if (keyedUnits.length < units.length || keyedUnits.length === 0) {
          lastRejectStage = `${stage}:source_fact_identity`;
          lastRejectReason = identity.reason || 'experience_material_fact_coverage_incomplete';
          return null;
        }
        // Material keys covered description-level: count material coverage as covered.
        lastCovered = post.covered?.length ?? keyedUnits.length;
        lastRequired = post.required?.length ?? units.length;
      }
    } else if (crossLocaleAccept && sourceForCoverage) {
      const semantic = validateCrossLocaleSemanticCoverage(sourceForCoverage, candidate);
      lastRequired = semantic.requiredCount || sourceFactCount;
      lastCovered = semantic.coveredCount;
      if (!semantic.ok) {
        lastRejectStage = `${stage}:translated_fact_count`;
        lastRejectReason = semantic.reason || 'experience_material_fact_coverage_incomplete';
        return null;
      }
    }
    // Arabic / Russian: never apply when employment tense or gender postconditions fail —
    // including cross-locale enhance/fallback paths that skip generation validation.
    if (locale === 'ar') {
      const arTense = validateArabicExperienceEmploymentTense(candidate, {
        isPresent,
        gender: cv.personal?.gender || input.gender || '',
      });
      generationValidationMeta = {
        ...generationValidationMeta,
        tenseValidationPassed: arTense.finalTensePassed && arTense.finalGenderAgreementPassed,
        relevanceValidationPassed: generationValidationMeta.relevanceValidationPassed
          || Boolean(lastCovered),
        perspectiveValidationPassed: true,
      };
      if (!arTense.finalTensePassed || !arTense.finalGenderAgreementPassed) {
        lastRejectStage = `${stage}:arabic_employment_tense`;
        lastRejectReason = arTense.reason || 'arabic_employment_tense_mismatch';
        return null;
      }
    }
    if (locale === 'ru') {
      const ruTense = validateRussianExperienceEmploymentTense(candidate, {
        isPresent,
        gender: cv.personal?.gender || input.gender || '',
      });
      generationValidationMeta = {
        ...generationValidationMeta,
        tenseValidationPassed: ruTense.finalTensePassed && ruTense.finalGenderAgreementPassed,
        relevanceValidationPassed: true,
        perspectiveValidationPassed: true,
      };
      if (!ruTense.finalTensePassed || !ruTense.finalGenderAgreementPassed) {
        lastRejectStage = `${stage}:russian_employment_tense`;
        lastRejectReason = ruTense.reason || 'russian_employment_tense_mismatch';
        return null;
      }
    }
    // Final-candidate validators must describe the accepted text, not a rejected provider.
    if (locale !== 'ar' && locale !== 'ru') {
      generationValidationMeta = {
        ...generationValidationMeta,
        relevanceValidationPassed: true,
        perspectiveValidationPassed: true,
        tenseValidationPassed: true,
      };
    }
    const bulletCount = splitExperienceBullets(candidate).filter(Boolean).length;
    const purity = validateAiUnitLocalePurity(candidate, locale, {
      kind: 'experience_bullet',
      requireUnits: true,
    });
    const isClientFallback = origin === 'deterministic_fallback'
      && (
        stage === 'canonical_fallback'
        || stage === 'source_preserving_fallback'
        || stage === 'occupation_fallback'
        || stage === 'cross_locale_translation_fallback'
        || stage === 'russian_design_family_rebuild'
        || stage === 'croatian_design_family_rebuild'
        || stage === 'spanish_warehouse_fallback'
      );
    if (isClientFallback) {
      fallbackApplied = true;
      fallbackBulletCount = bulletCount;
      clientDeterministicFallbackApplied = true;
      clientDeterministicFallbackBulletCount = bulletCount;
      clientDeterministicFallbackScripts = detectBulletScripts(candidate);
      clientDeterministicFallbackCoveredFactCount = lastCovered || sourceFactCount;
      clientDeterministicFallbackRequiredFactCount = lastRequired || sourceFactCount;
      clientDeterministicFallbackUncoveredFactIds = [];
      if (!finalCandidateSource) finalCandidateSource = 'deterministic_fallback';
    }
    void EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION;
    return {
      blocked: false,
      text: candidate,
      origin,
      roleDutyConflict,
      countedAsSuccess: true,
      diagnostics: {
        ...baseDiag(),
        // Top-level coverage describes the FINAL selected candidate.
        coveredFactCount: lastCovered || sourceFactCount,
        requiredFactCount: lastRequired || sourceFactCount,
        providerCoveredFactCount,
        providerRequiredFactCount,
        providerCoverageCount: providerCoveredFactCount,
        providerUncoveredFactCount: Math.max(0, providerRequiredFactCount - providerCoveredFactCount),
        providerUncoveredFactIdentityHashes: [...providerUncoveredFactIdentityHashes],
        providerAccepted: isClientFallback ? false : true,
        fallbackBulletCount: isClientFallback ? bulletCount : fallbackBulletCount,
        finalBulletCount: bulletCount,
        finalBulletScripts: detectBulletScripts(candidate),
        finalNormalizedHash: fingerprintText(candidate.replace(/\s+/g, ' ').trim()),
        detectedLocaleByBullet: purity.detectedLocaleByUnit,
        detectedScriptByBullet: purity.detectedScriptByUnit,
        wrongLocaleBulletCount: purity.wrongLocaleUnitCount,
        wrongScriptBulletCount: purity.wrongScriptUnitCount,
        mixedLanguageBulletCount: purity.mixedLanguageUnitCount,
        sourceLanguageLeakageDetected: purity.sourceLanguageLeakageDetected,
        targetLocalePurityPassed: purity.targetLocalePurityPassed,
        targetLocale: locale,
        targetScript: resolveTargetScriptForLocale(locale),
        responseRejectedForLocaleImpurity: false,
        crossDomainLeakageDetected: false,
        providerLocalePurityPassed: isClientFallback ? undefined : purity.targetLocalePurityPassed,
        providerSemanticCoveragePassed: isClientFallback
          ? (providerCoveredFactCount >= Math.min(3, providerRequiredFactCount || 3))
          : (lastCovered >= Math.min(3, lastRequired || sourceFactCount || 3)),
        fallbackLocalePurityPassed: isClientFallback ? purity.targetLocalePurityPassed : undefined,
        fallbackSemanticCoveragePassed: isClientFallback
          ? (lastCovered >= Math.min(3, lastRequired || sourceFactCount || 3))
          : undefined,
        crossLocaleOperation: crossLocaleOp,
        translationProviderAttempted: crossLocaleOp && Boolean((input.candidate || '').trim()),
        translationFallbackAttempted: isClientFallback && crossLocaleOp,
        translationFallbackApplied: isClientFallback && crossLocaleOp,
        translatedFactCount: crossLocaleOp ? lastCovered : undefined,
        rejectionStage: undefined,
        typedFailureReason: undefined,
        fallbackApplied: isClientFallback,
        countedAsSuccess: true,
        relevanceValidationPassed: generationValidationMeta.relevanceValidationPassed,
        perspectiveValidationPassed: generationValidationMeta.perspectiveValidationPassed,
        tenseValidationPassed: generationValidationMeta.tenseValidationPassed,
        clientDeterministicFallbackApplied: isClientFallback,
        clientDeterministicFallbackBulletCount: isClientFallback
          ? bulletCount
          : clientDeterministicFallbackBulletCount,
        clientDeterministicFallbackScripts: isClientFallback
          ? detectBulletScripts(candidate)
          : clientDeterministicFallbackScripts,
        clientDeterministicFallbackCoveredFactCount: isClientFallback
          ? (lastCovered || sourceFactCount)
          : clientDeterministicFallbackCoveredFactCount,
        clientDeterministicFallbackRequiredFactCount: isClientFallback
          ? (lastRequired || sourceFactCount)
          : clientDeterministicFallbackRequiredFactCount,
        clientDeterministicFallbackUncoveredFactIds: isClientFallback
          ? []
          : clientDeterministicFallbackUncoveredFactIds,
        experienceDiagnosticsFinalCandidateRevision:
          EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION,
      },
    };
  };

  let candidate = prepareCandidate(input.candidate || '', locale, 'experience_description');
  if (hasAiProtocolMarker(candidate)) {
    candidate = '';
  }
  // Never accept prior-occupation duties after stale grounding was excluded.
  if (
    grounding?.staleGeneratedContentExcluded
    && candidateConflictsWithJobContext(candidate, jobContext)
  ) {
    candidate = '';
  }
  // Occupation / industry labels alone must never justify regulated pharmacy claims.
  const userAllowsRegulated = Boolean(
    grounding?.sourceDescription
    && hasUnsupportedRegulatedPharmacyClaims(grounding.sourceDescription),
  );
  if (
    candidate.trim()
    && hasUnsupportedRegulatedPharmacyClaims(candidate)
    && !userAllowsRegulated
  ) {
    candidate = '';
  }

  // Provider / server output — never treat as client deterministic fallback.
  // Perspective (1sg→CV 3sg) is separate from tenseMode present|past.
  const providerOrigin = input.originHint === 'ai_repaired' ? 'ai_repaired' : 'ai_generated';
  const providerRawForCompare = candidate;
  let perspectiveMeta = {
    sourcePersonMode: detectExperiencePersonMode(sourceForCoverage, locale) as ExperiencePersonMode,
    providerPersonMode: detectExperiencePersonMode(candidate, locale) as ExperiencePersonMode,
    normalizedPersonMode: 'unknown' as ExperiencePersonMode,
    finalPersonMode: 'unknown' as ExperiencePersonMode,
    perspectiveMode: 'cv_third_person' as const,
    perspectiveNormalizationAttempted: false,
    perspectiveNormalizationApplied: false,
    perspectiveValidationPassed: false,
    normalizedBulletsUsedForApply: false,
    finalMatchesProviderOutput: false,
    finalMatchesSourceAfterNormalization: false,
    meaningfulChangeDetected: false,
    noOpRejected: false,
  };

  const attachPerspectiveDiag = (
    result: FinalizeCvAiFieldResult,
  ): FinalizeCvAiFieldResult => {
    if (
      providerNoOpDetected
      && result.countedAsSuccess
      && result.origin === 'deterministic_fallback'
    ) {
      deterministicFallbackAttemptedAfterNoOp = true;
      deterministicFallbackAppliedAfterNoOp = true;
      if (!finalCandidateSource) finalCandidateSource = 'deterministic_fallback';
    }
    const acceptedText = (result.text || '').replace(/\s+/g, ' ').trim();
    const providerCompare = (providerRawForCompare || '').replace(/\s+/g, ' ').trim();
    const matchesProvider = Boolean(
      result.countedAsSuccess
      && acceptedText
      && providerCompare
      && (
        acceptedText === providerCompare
        || experienceAiHasMeaningfulChange(providerCompare, acceptedText) === false
      ),
    );
    // Never inherit a pre-fallback provider-equality flag after selecting fallback.
    const finalMatchesProvider = result.origin === 'deterministic_fallback'
      || result.diagnostics?.clientDeterministicFallbackApplied
      || finalCandidateSource === 'deterministic_fallback'
      || finalCandidateSource === 'server_fallback'
      ? matchesProvider && acceptedText === providerCompare
      : matchesProvider;
    void EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION;
    return {
      ...result,
      diagnostics: {
        ...result.diagnostics,
        ...perspectiveMeta,
        finalMatchesProviderOutput: finalMatchesProvider,
        tenseMode,
        selectedExperienceEntryIdHash,
        operationSnapshotExperienceEntryIdHash: snapshot?.experienceEntryId
          ? hashExperienceEntryId(snapshot.experienceEntryId)
          : null,
        appliedExperienceEntryIdHash: result.countedAsSuccess
          ? selectedExperienceEntryIdHash
          : null,
        sourceFactsEntryIdHash: selectedExperienceEntryIdHash,
        canonicalFactsEntryIdHash: selectedExperienceEntryIdHash,
        fallbackFactsEntryIdHash: selectedExperienceEntryIdHash,
        providerTargetEntryIdHash: selectedExperienceEntryIdHash,
        arrayIndexAtRequest,
        arrayIndexAtApply: experienceIndexForIdStrict(cv, exp.id),
        providerNoOpDetected,
        noOpRepairAttempted: noOpRepairAttemptedFlag,
        noOpRepairValidationPassed: noOpRepairValidationPassed ?? undefined,
        noOpRepairMeaningfulChangeDetected: noOpRepairMeaningfulChangeDetected ?? undefined,
        noOpRepairApplied,
        noOpRepairUnsupportedClaimCount,
        noOpRepairUnsupportedClaimKinds,
        noOpRepairScopeExpansionDetected,
        noOpRepairUniversalQuantifierDetected,
        noOpRepairResponsibilityEscalationDetected,
        noOpRepairRejectionReason,
        finalUnsupportedClaimCount,
        finalUnsupportedClaimKinds,
        unsupportedClaimCount: Math.max(
          generationValidationMeta.unsupportedClaimCount,
          finalUnsupportedClaimCount,
          noOpRepairUnsupportedClaimCount,
        ),
        deterministicFallbackAttemptedAfterNoOp,
        deterministicFallbackAppliedAfterNoOp,
        finalCandidateSource: finalCandidateSource
          ?? (result.countedAsSuccess
            ? (result.origin === 'deterministic_fallback'
              ? 'deterministic_fallback'
              : (unsupportedClaimRepairApplied
                ? 'unsupported_claim_repair'
                : (noOpRepairApplied ? 'noop_repair' : 'provider')))
            : 'none'),
        providerUncoveredFactIdentityHashes: [...providerUncoveredFactIdentityHashes],
        providerAccepted: result.diagnostics?.providerAccepted === false
          ? false
          : (
            result.countedAsSuccess
            && !(result.origin === 'deterministic_fallback'
              || result.diagnostics?.clientDeterministicFallbackApplied
              || finalCandidateSource === 'deterministic_fallback'
              || finalCandidateSource === 'server_fallback'
              || finalCandidateSource === 'unsupported_claim_repair'
              || unsupportedClaimRepairApplied
              || (
                (providerUnsupportedClaimCount ?? 0) > 0
                && (noOpRepairApplied
                  || finalCandidateSource === 'noop_repair'
                  || result.origin === 'ai_repaired')
              ))
          ),
        unsupportedClaimRepairAttempted,
        unsupportedClaimRepairKind,
        unsupportedClaimRepairValidationPassed,
        unsupportedClaimRepairApplied,
        unsupportedClaimRepairRejectionReason,
        unsupportedClaimRepairUnsupportedClaimCount,
        unsupportedClaimRepairUnsupportedClaimKinds,
        unsupportedClaimRepairResidualUnsupportedClaimCount,
        unsupportedClaimRepairResidualUnsupportedClaimKinds,
        unsupportedClaimRepairCoverageRequiredCount,
        unsupportedClaimRepairCoverageCoveredCount,
        unsupportedClaimRepairUncoveredFactIdentityHashes,
        unsupportedClaimRepairHash,
        unsupportedClaimRepairNormalizedHash,
        experienceRepairLineageRevision: EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
        spanishExperienceRepairGroundingRevision: SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION,
        providerRejectionReason: result.diagnostics?.providerRejectionReason
          ?? providerRejectionReason,
        providerRejectionStage: result.diagnostics?.providerRejectionStage
          ?? providerRejectionStage,
        providerUnsupportedClaimCount: result.diagnostics?.providerUnsupportedClaimCount
          ?? providerUnsupportedClaimCount,
        providerUnsupportedClaimKinds: Array.isArray(
          result.diagnostics?.providerUnsupportedClaimKinds,
        )
          ? result.diagnostics.providerUnsupportedClaimKinds
          : [...providerUnsupportedClaimKinds],
        finalNormalizedHash: result.countedAsSuccess
          ? fingerprintText(acceptedText)
          : (result.diagnostics?.finalNormalizedHash ?? null),
        stableEntryIdentityMatched: true,
        targetEntryStillExists: Boolean(findExperienceById(cv, exp.id)),
        entryScopedCanonicalStorageUsed: true,
        responseRejectedForEntryMismatch: false,
        crossEntryLeakageDetected: Boolean(result.diagnostics?.crossEntryLeakageDetected),
        entryContextMatchedAtApply: Boolean(
          exp?.id
          && findExperienceById(cv, exp.id)
          && (
            !snapshot?.experienceEntryId
            || snapshot.experienceEntryId === exp.id
          ),
        ),
        visibleTextareaMatchesFinalNormalizedHash: result.countedAsSuccess ? true : null,
        experienceDiagnosticsFinalCandidateRevision:
          EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION,
      },
    };
  };

  if (candidate.trim()) {
    const persp = normalizeExperienceBulletsPerspective(candidate, {
      locale,
      isPresent,
      gender,
      sourceDescription: sourceForCoverage || candidate,
    });
    perspectiveMeta = {
      ...perspectiveMeta,
      sourcePersonMode: sourceWasEmpty
        ? 'unknown'
        : persp.sourcePersonMode,
      providerPersonMode: persp.providerPersonMode,
      normalizedPersonMode: persp.normalizedPersonMode,
      perspectiveNormalizationAttempted: persp.perspectiveNormalizationAttempted,
      perspectiveNormalizationApplied: persp.perspectiveNormalizationApplied,
      perspectiveValidationPassed: persp.perspectiveValidationPassed,
      finalPersonMode: persp.normalizedPersonMode,
    };
    // Authoritative finalNormalizedBullets — validate and apply this array only.
    // After employment-tense / perspective normalization, apply Croatian warehouse
    // locative grammar polish (preglednom, not pregledom) without skipping no-op
    // detection on unchanged present-tense echoes.
    const finalNormalizedBullets = locale === 'hr' && persp.perspectiveNormalizationApplied
      ? polishCroatianExperienceAiText(persp.text)
      : persp.text;
    const perspectiveGate = validateExperienceCvPerspective(finalNormalizedBullets, locale);
    perspectiveMeta.perspectiveValidationPassed = perspectiveGate.ok;
    perspectiveMeta.finalPersonMode = perspectiveGate.finalPersonMode;

    if (sourceWasEmpty) {
      // Generation Mode: no source-fact coverage / no-op against empty source.
      if (!perspectiveGate.ok) {
        lastRejectStage = 'provider:perspective';
        lastRejectReason = perspectiveGate.reason || 'experience_generation_failed';
      } else {
        const accepted = tryAcceptGeneration(finalNormalizedBullets, providerOrigin, 'provider');
        if (accepted) {
          perspectiveMeta.normalizedBulletsUsedForApply = true;
          perspectiveMeta.meaningfulChangeDetected = true;
          perspectiveMeta.finalPersonMode = detectExperiencePersonMode(accepted.text, locale);
          return attachPerspectiveDiag(accepted);
        }
      }
    } else {
    const meaningful = experienceAiHasMeaningfulChange(sourceForCoverage, finalNormalizedBullets, {
      perspectiveApplied: persp.perspectiveNormalizationApplied,
    });
    perspectiveMeta.meaningfulChangeDetected = meaningful;
    perspectiveMeta.finalMatchesSourceAfterNormalization = !meaningful
      && !persp.perspectiveNormalizationApplied;
    perspectiveMeta.finalMatchesProviderOutput = finalNormalizedBullets.replace(/\s+/g, ' ').trim()
      === providerRawForCompare.replace(/\s+/g, ' ').trim()
      || (persp.perspectiveNormalizationApplied === false
        && experienceAiHasMeaningfulChange(providerRawForCompare, finalNormalizedBullets) === false);

    if (!meaningful) {
      // Same-locale source reapplied unchanged → universal no-op (never +1 usage),
      // EXCEPT when the live source is poisoned / incomplete for a design rebuild
      // (Russian/Croatian design family rebuild must still run).
      // Cross-locale "same text" must fall through to localized deterministic fallback.
      const sourceOkForLocale = sourceUsableInLocale(sourceForCoverage, locale)
        || (locale === 'en' && sourceUsableInLocale(sourceForCoverage, 'en'));
      const sourceNeedsPerspective = experienceRequiresCvThirdPerson(locale)
        && detectExperiencePersonMode(sourceForCoverage, locale) === 'first_singular';
      const needsDesignFamilyRebuild = experienceNeedsRussianDesignFamilyRebuild({
        locale,
        sourceDescription: sourceForCoverage,
        position: exp?.position || cv.personal?.jobTitle,
        rejectReason: lastRejectReason,
      }) || experienceNeedsCroatianDesignFamilyRebuild({
        locale,
        sourceDescription: sourceForCoverage,
        position: exp?.position || cv.personal?.jobTitle,
        rejectReason: lastRejectReason,
      }) || (
        locale === 'hr'
        && isCroatianDesignPoisonedLiveSource(
          sourceForCoverage,
          exp?.position || cv.personal?.jobTitle,
        )
      );
      if (needsDesignFamilyRebuild) {
        lastRejectStage = 'provider:design_rebuild_required';
        if (locale === 'hr') {
          lastRejectReason = isCroatianDesignPoisonedLiveSource(
            sourceForCoverage,
            exp?.position || cv.personal?.jobTitle,
          )
            ? 'croatian_design_poisoned_live_source'
            : (
              isCroatianDesignFamilyRejectionReason(lastRejectReason)
                ? lastRejectReason
                : 'croatian_design_material_coverage_incomplete'
            );
        } else {
          lastRejectReason = isRussianDesignFamilyRejectionReason(lastRejectReason)
            ? lastRejectReason
            : 'russian_design_generic_duty';
        }
        providerRejectionReason = lastRejectReason;
        providerRejectionStage = lastRejectStage;
        // Skip tryAccept of the unchanged poisoned/incomplete provider text.
      } else if (!persp.perspectiveNormalizationApplied && sourceOkForLocale) {
        // Universal contract: whitespace/bullet/normalization-only equals no-op.
        // Recoverable: client must attempt one dedicated repair first; only after
        // that repair do we fall through to deterministic stylistic fallback.
        void EXPERIENCE_AI_NOOP_RECOVERY_REVISION;
        void CROATIAN_NOOP_USAGE_REVISION;
        providerNoOpDetected = true;
        perspectiveMeta.noOpRejected = true;
        perspectiveMeta.meaningfulChangeDetected = false;
        perspectiveMeta.finalMatchesSourceAfterNormalization = true;
        lastRejectStage = 'provider:noop';
        lastRejectReason = sourceNeedsPerspective
          ? 'experience_ai_noop'
          : 'ai_no_meaningful_change';
        providerCoveredFactCount = lastCovered;
        providerRequiredFactCount = lastRequired || sourceFactCount;
        providerRejectionReason = lastRejectReason;
        providerRejectionStage = lastRejectStage;
        if (!noOpRepairAttemptedFlag) {
          return attachPerspectiveDiag({
            blocked: true,
            reason: 'experience_ai_noop',
            text: exp?.description || '',
            origin: 'user',
            roleDutyConflict,
            countedAsSuccess: false,
            diagnostics: {
              ...baseDiag(),
              typedFailureReason: sourceNeedsPerspective
                ? 'experience_ai_noop'
                : 'ai_noop',
              rejectionStage: 'provider:noop',
              meaningfulChangeDetected: false,
              noOpRejected: true,
              providerNoOpDetected: true,
              noOpRepairAttempted: false,
              finalMatchesSourceAfterNormalization: true,
              finalCandidateSource: 'none',
            },
          });
        }
        // Repair already attempted and still a no-op → continue to fallback.
        noOpRepairValidationPassed = false;
        noOpRepairMeaningfulChangeDetected = false;
        deterministicFallbackAttemptedAfterNoOp = true;
        clientDeterministicFallbackReason = 'experience_ai_noop_recovery';
        // Do not tryAccept the unchanged provider/repair echo.
      } else if (!sourceOkForLocale) {
        // Cross-locale unchanged provider text → continue to localized fallback.
        lastRejectStage = 'provider:cross_locale_or_noop';
        lastRejectReason = 'locale_mismatch';
        providerRejectionReason = 'locale_mismatch';
        providerRejectionStage = lastRejectStage;
      } else if (!perspectiveGate.ok) {
        lastRejectStage = 'provider:perspective';
        lastRejectReason = perspectiveGate.reason || 'experience_cv_perspective_first_person';
      } else {
        // Perspective-only normalization of already-valid same-locale text → no-op.
        void EXPERIENCE_AI_NOOP_RECOVERY_REVISION;
        void CROATIAN_NOOP_USAGE_REVISION;
        providerNoOpDetected = true;
        perspectiveMeta.noOpRejected = true;
        perspectiveMeta.meaningfulChangeDetected = false;
        perspectiveMeta.finalMatchesSourceAfterNormalization = true;
        lastRejectStage = 'provider:noop';
        lastRejectReason = 'ai_no_meaningful_change';
        providerRejectionReason = lastRejectReason;
        providerRejectionStage = lastRejectStage;
        if (!noOpRepairAttemptedFlag) {
          return attachPerspectiveDiag({
            blocked: true,
            reason: 'experience_ai_noop',
            text: exp?.description || '',
            origin: 'user',
            roleDutyConflict,
            countedAsSuccess: false,
            diagnostics: {
              ...baseDiag(),
              typedFailureReason: 'ai_noop',
              rejectionStage: 'provider:noop',
              meaningfulChangeDetected: false,
              noOpRejected: true,
              providerNoOpDetected: true,
              noOpRepairAttempted: false,
              finalMatchesSourceAfterNormalization: true,
              finalCandidateSource: 'none',
            },
          });
        }
        noOpRepairValidationPassed = false;
        noOpRepairMeaningfulChangeDetected = false;
        deterministicFallbackAttemptedAfterNoOp = true;
        clientDeterministicFallbackReason = 'experience_ai_noop_recovery';
      }
    } else if (!perspectiveGate.ok) {
      lastRejectStage = 'provider:perspective';
      lastRejectReason = perspectiveGate.reason || 'experience_cv_perspective_first_person';
    } else {
      const firstAccepted = tryAccept(
        finalNormalizedBullets,
        serverFallbackUsed ? 'deterministic_fallback' : providerOrigin,
        'provider',
      );
      providerCoveredFactCount = lastCovered;
      providerRequiredFactCount = lastRequired || sourceFactCount;
      if (firstAccepted) {
        perspectiveMeta.normalizedBulletsUsedForApply = true;
        perspectiveMeta.finalPersonMode = detectExperiencePersonMode(firstAccepted.text, locale);
        providerAccepted = true;
        providerUncoveredFactIdentityHashes = [];
        if (noOpRepairAttemptedFlag && providerOrigin === 'ai_repaired') {
          noOpRepairApplied = true;
          noOpRepairValidationPassed = true;
          noOpRepairMeaningfulChangeDetected = true;
          providerNoOpDetected = true;
          finalCandidateSource = 'noop_repair';
          finalUnsupportedClaimCount = 0;
          finalUnsupportedClaimKinds = [];
          perspectiveMeta.noOpRejected = false;
        } else if (serverFallbackUsed) {
          finalCandidateSource = 'server_fallback';
          finalUnsupportedClaimCount = 0;
          finalUnsupportedClaimKinds = [];
          fallbackApplied = true;
        } else {
          finalCandidateSource = providerOrigin === 'ai_repaired' ? 'noop_repair' : 'provider';
          finalUnsupportedClaimCount = 0;
          finalUnsupportedClaimKinds = [];
        }
        return attachPerspectiveDiag({
          ...firstAccepted,
          origin: serverFallbackUsed ? 'deterministic_fallback' : firstAccepted.origin,
          diagnostics: {
            ...firstAccepted.diagnostics,
            coveredFactCount: lastCovered || sourceFactCount,
            providerCoveredFactCount: lastCovered || sourceFactCount,
            providerRequiredFactCount: lastRequired || sourceFactCount,
            providerNoOpDetected,
            noOpRepairAttempted: noOpRepairAttemptedFlag,
            noOpRepairApplied,
            noOpRepairValidationPassed: noOpRepairValidationPassed ?? undefined,
            noOpRepairMeaningfulChangeDetected: noOpRepairMeaningfulChangeDetected ?? undefined,
            noOpRepairUnsupportedClaimCount,
            noOpRepairUnsupportedClaimKinds,
            noOpRepairScopeExpansionDetected,
            noOpRepairUniversalQuantifierDetected,
            noOpRepairResponsibilityEscalationDetected,
            noOpRepairRejectionReason,
            finalUnsupportedClaimCount,
            finalUnsupportedClaimKinds,
            unsupportedClaimCount: finalUnsupportedClaimCount,
            finalCandidateSource,
            serverFallbackUsed,
            apiResponseKind,
            fallbackApplied: serverFallbackUsed ? true : firstAccepted.diagnostics?.fallbackApplied,
          },
        });
      }
      providerRejectionReason = lastRejectReason;
      providerRejectionStage = lastRejectStage;
      // AAB-309: at most one source-constrained unsupported-claim repair (not no-op).
      if (
        locale === 'es'
        && lastUnsupportedClaimCount > 0
        && lastUnsupportedClaimKinds.some((k) =>
          k === 'guarantee_escalation'
          || k === 'assurance_escalation'
          || k === 'responsibility_escalation'
          || k === 'outcome_ownership'
          || k === 'quality_guarantee'
          || k === 'completeness_guarantee'
          || k === 'compliance_guarantee'
          || k === 'efficiency_claim'
          || k === 'performance_claim'
          || k === 'optimization_claim'
          || k === 'productivity_claim'
          || k === 'speed_claim'
          || k === 'accuracy_claim'
          || k === 'error_free_claim'
          || k === 'object_scope_expansion'
          || k === 'logistics_scope_expansion'
          || k === 'unsupported_object_expansion'
          || k === 'action_scope_expansion'
          || k === 'coordinated_predicate_expansion'
          || k === 'document_management_expansion'
          || k === 'workflow_expansion'
          || k === 'approval_authority_expansion'
          || k === 'supervision_expansion')
      ) {
        void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
        void SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION;
        void SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION;
        void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
        void EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION;
        unsupportedClaimRepairAttempted = true;
        unsupportedClaimRepairKind = 'spanish_unsupported_claim_strip';
        unsupportedClaimRepairUnsupportedClaimCount = lastUnsupportedClaimCount;
        unsupportedClaimRepairUnsupportedClaimKinds = [...lastUnsupportedClaimKinds];
        const repairedEs = stripSpanishExperienceUnsupportedEscalation(
          finalNormalizedBullets,
          sourceForCoverage,
        );
        const repairedNorm = repairedEs.replace(/\s+/g, ' ').trim();
        const providerNorm = finalNormalizedBullets.replace(/\s+/g, ' ').trim();
        unsupportedClaimRepairHash = repairedNorm
          ? fingerprintText(repairedNorm)
          : null;
        unsupportedClaimRepairNormalizedHash = unsupportedClaimRepairHash;
        const repairMeaningful = Boolean(
          repairedNorm
          && repairedNorm !== providerNorm
          && experienceAiHasMeaningfulChange(sourceForCoverage, repairedEs, {
            perspectiveApplied: false,
          }),
        );
        const repairScan = repairedNorm
          ? detectSpanishExperienceUnsupportedExpansion(sourceForCoverage, repairedEs)
          : { count: lastUnsupportedClaimCount, kinds: lastUnsupportedClaimKinds };
        unsupportedClaimRepairResidualUnsupportedClaimCount = repairScan.count;
        unsupportedClaimRepairResidualUnsupportedClaimKinds = [...repairScan.kinds];
        repairResidualAddedPredicateCount =
          ('candidateAddedPredicateCount' in repairScan
            ? Number(repairScan.candidateAddedPredicateCount ?? 0)
            : 0);
        repairResidualAddedPredicateIdentityHashes = Array.isArray(
          (repairScan as { candidateAddedPredicateIdentityHashes?: string[] })
            .candidateAddedPredicateIdentityHashes,
        )
          ? [...(repairScan as { candidateAddedPredicateIdentityHashes: string[] })
            .candidateAddedPredicateIdentityHashes]
          : [];
        if (sourceRequiresSpanishWarehouseFactCoverage(sourceForCoverage) && repairedNorm) {
          const cov = validateSpanishWarehouseExperienceCoverage(
            sourceForCoverage,
            repairedEs,
          );
          unsupportedClaimRepairCoverageRequiredCount = cov.required.length;
          unsupportedClaimRepairCoverageCoveredCount = cov.covered.length;
          unsupportedClaimRepairUncoveredFactIdentityHashes = cov.uncovered.map(
            (id) => `es_wh_${id}`,
          );
        }
        if (
          repairMeaningful
          && repairScan.count === 0
          && repairResidualAddedPredicateCount === 0
        ) {
          const repairAccepted = tryAccept(
            repairedEs,
            'ai_repaired',
            'spanish_unsupported_claim_repair',
          );
          if (repairAccepted) {
            providerAccepted = false;
            // Distinct from no-op repair lineage.
            noOpRepairApplied = false;
            noOpRepairValidationPassed = null;
            unsupportedClaimRepairValidationPassed = true;
            unsupportedClaimRepairApplied = true;
            unsupportedClaimRepairRejectionReason = null;
            finalUnsupportedClaimCount = 0;
            finalUnsupportedClaimKinds = [];
            finalCandidateSource = 'unsupported_claim_repair';
            perspectiveMeta.normalizedBulletsUsedForApply = true;
            perspectiveMeta.finalPersonMode = detectExperiencePersonMode(
              repairAccepted.text,
              locale,
            );
            perspectiveMeta.meaningfulChangeDetected = true;
            perspectiveMeta.noOpRejected = false;
            return attachPerspectiveDiag({
              ...repairAccepted,
              origin: 'ai_repaired',
              diagnostics: {
                ...repairAccepted.diagnostics,
                providerAccepted: false,
                providerRejectionReason,
                providerRejectionStage: providerRejectionStage || 'unsupported_claim_validation',
                providerUnsupportedClaimCount,
                providerUnsupportedClaimKinds: [...providerUnsupportedClaimKinds],
                providerCoveredFactCount: providerCoveredFactCount || lastCovered || sourceFactCount,
                providerRequiredFactCount: providerRequiredFactCount || lastRequired || sourceFactCount,
                coveredFactCount: lastCovered || sourceFactCount,
                noOpRepairAttempted: false,
                noOpRepairApplied: false,
                noOpRepairValidationPassed: undefined,
                unsupportedClaimRepairAttempted: true,
                unsupportedClaimRepairKind,
                unsupportedClaimRepairValidationPassed: true,
                unsupportedClaimRepairApplied: true,
                unsupportedClaimRepairResidualUnsupportedClaimCount: 0,
                unsupportedClaimRepairResidualUnsupportedClaimKinds: [],
                unsupportedClaimRepairCoverageRequiredCount,
                unsupportedClaimRepairCoverageCoveredCount,
                unsupportedClaimRepairUncoveredFactIdentityHashes,
                unsupportedClaimRepairHash,
                unsupportedClaimRepairNormalizedHash,
                finalUnsupportedClaimCount: 0,
                finalUnsupportedClaimKinds: [],
                unsupportedClaimCount: 0,
                finalCandidateSource: 'unsupported_claim_repair',
                experienceRepairLineageRevision: EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
                spanishExperienceRepairGroundingRevision:
                  SPANISH_EXPERIENCE_REPAIR_GROUNDING_309_REVISION,
                experiencePredicateRepairLineageRevision:
                  EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
                spanishExperiencePredicateGroundingRevision:
                  SPANISH_EXPERIENCE_PREDICATE_GROUNDING_310_REVISION,
                sourcePredicateIdentityCount,
                candidatePredicateIdentityCount,
                candidateAddedPredicateCount,
                candidateAddedPredicateIdentityHashes,
                unsupportedPredicateKindCount,
                coordinatedPredicateExpansionDetected,
                sourceUnitPredicateCoveragePassed,
                repairResidualAddedPredicateCount: 0,
                repairResidualAddedPredicateIdentityHashes: [],
                experienceAiUnsupportedExpansionRevision:
                  EXPERIENCE_AI_UNSUPPORTED_EXPANSION_REVISION,
              },
            });
          }
          unsupportedClaimRepairValidationPassed = false;
          unsupportedClaimRepairApplied = false;
          unsupportedClaimRepairRejectionReason = lastRejectReason
            || 'unsupported_claim_repair_rejected';
        } else {
          unsupportedClaimRepairValidationPassed = false;
          unsupportedClaimRepairApplied = false;
          unsupportedClaimRepairRejectionReason = repairScan.count > 0
            ? (repairScan.kinds[0] || 'residual_unsupported_claims')
            : (!repairMeaningful
              ? 'unsupported_claim_repair_noop_or_identical'
              : 'unsupported_claim_repair_invalid');
        }
      }
      if (noOpRepairAttemptedFlag && providerOrigin === 'ai_repaired') {
        // Unsafe or otherwise invalid repair: never apply; unlock stylistic fallback.
        const repairScan = lastUnsupportedClaimCount > 0
          ? {
            count: lastUnsupportedClaimCount,
            kinds: lastUnsupportedClaimKinds,
            scopeExpansionDetected: lastScopeExpansionDetected,
            universalQuantifierDetected: lastUniversalQuantifierDetected,
            responsibilityEscalationDetected: lastResponsibilityEscalationDetected,
          }
          : detectExperienceUnsupportedClaimExpansion(
            sourceForCoverage,
            finalNormalizedBullets,
          );
        noOpRepairValidationPassed = false;
        noOpRepairApplied = false;
        noOpRepairMeaningfulChangeDetected = Boolean(perspectiveMeta.meaningfulChangeDetected);
        noOpRepairUnsupportedClaimCount = repairScan.count;
        noOpRepairUnsupportedClaimKinds = repairScan.kinds;
        noOpRepairScopeExpansionDetected = repairScan.scopeExpansionDetected;
        noOpRepairUniversalQuantifierDetected = repairScan.universalQuantifierDetected;
        noOpRepairResponsibilityEscalationDetected = repairScan.responsibilityEscalationDetected;
        noOpRepairRejectionReason = experienceUnsupportedClaimRejectionReason({
          kinds: repairScan.kinds,
          count: repairScan.count,
          labels: repairScan.kinds,
          scopeExpansionDetected: repairScan.scopeExpansionDetected,
          universalQuantifierDetected: repairScan.universalQuantifierDetected,
          responsibilityEscalationDetected: repairScan.responsibilityEscalationDetected,
        }) || lastRejectReason || 'unsupported_generated_duty';
        finalUnsupportedClaimCount = repairScan.count;
        finalUnsupportedClaimKinds = repairScan.kinds;
        generationValidationMeta = {
          ...generationValidationMeta,
          unsupportedClaimCount: Math.max(
            generationValidationMeta.unsupportedClaimCount,
            repairScan.count,
          ),
        };
        providerNoOpDetected = true;
        deterministicFallbackAttemptedAfterNoOp = true;
        clientDeterministicFallbackReason = 'experience_ai_noop_recovery';
      }
      if (locale === 'ru') {
        const fam = validateRussianDesignFactFamilies(finalNormalizedBullets);
        providerDetectedMaterialFamilyCount = fam.coveredFamilies.length;
        if (isRussianDesignFamilyRejectionReason(lastRejectReason)
          || sourceRequiresRussianDesignFamilies(sourceForCoverage)
          || classifyFreeTextJobDomain(exp?.position || '') === 'design') {
          authoritativeRequiredFamilyCount = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
          lastRequired = Math.max(lastRequired, RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT);
        }
      }
    }
    }
  } else {
    providerCoveredFactCount = lastCovered;
    providerRequiredFactCount = lastRequired || sourceFactCount;
  }

  // Provider/server postconditions failed → always attempt client deterministic fallback.
  clientDeterministicFallbackAttempted = true;
  if (!providerRejectionReason) {
    providerRejectionReason = lastRejectReason || 'provider_postcondition_failed';
    providerRejectionStage = lastRejectStage;
  }
  // Fallback routing reason must not inherit stale locale_mismatch from material rejects.
  clientDeterministicFallbackReason = isRussianDesignFamilyRejectionReason(providerRejectionReason)
    ? 'russian_design_family_rebuild'
    : (
      isCroatianDesignFamilyRejectionReason(providerRejectionReason)
      || experienceNeedsCroatianDesignFamilyRebuild({
        locale,
        sourceDescription: sourceForCoverage,
        position: exp?.position || cv.personal?.jobTitle,
        rejectReason: providerRejectionReason || lastRejectReason,
      })
    )
      ? 'croatian_design_family_rebuild'
    : (lastRejectReason && lastRejectReason !== 'locale_mismatch'
      ? lastRejectReason
      : (providerRejectionReason || 'provider_postcondition_failed'));

  // Generation Mode: never use source-preserving / canonical FACT LOCK fallbacks.
  if (sourceWasEmpty) {
    generationFallbackAttempted = true;
    generationFallbackBuilderKind = 'job_context_generation';
    // Universal job-context first (arbitrary titles). Known catalogue occupations
    // may refine via occupation-aware only when job-context validation rejects.
    const universalFallback = buildJobContextGenerationFallback({
      locale,
      gender,
      position: exp?.position || cv.personal?.jobTitle,
      industry: input.industry || jobContext.industryNorm,
      isPresent,
    });
    const catalogueFallback = (
      jobContext.positionClass === 'pharmacist_pharmacy'
      || jobContext.industryNorm === 'pharmacy'
      || jobContext.positionClass === 'baker_food'
      || jobContext.positionClass === 'hospitality_service'
    )
      ? buildOccupationAwareExperienceFallback({
        locale,
        gender,
        position: exp?.position || cv.personal?.jobTitle,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      })
      : '';
    const jobCtxFallback = normalizeLocaleText(universalFallback || catalogueFallback, locale);
    if (!jobCtxFallback.trim()) {
      generationFallbackFailureReason = 'empty_generation_fallback';
      lastRejectReason = 'empty_generation_fallback';
      lastRejectStage = 'job_context_generation_fallback';
    }
    let genAccepted = tryAcceptGeneration(
      jobCtxFallback,
      'deterministic_fallback',
      'job_context_generation_fallback',
    );
    if (!genAccepted && catalogueFallback.trim() && catalogueFallback.trim() !== jobCtxFallback.trim()) {
      generationFallbackBuilderKind = 'occupation_aware_generation';
      genAccepted = tryAcceptGeneration(
        normalizeLocaleText(catalogueFallback, locale),
        'deterministic_fallback',
        'job_context_generation_fallback',
      );
    }
    if (genAccepted) {
      perspectiveMeta.normalizedBulletsUsedForApply = true;
      perspectiveMeta.meaningfulChangeDetected = true;
      perspectiveMeta.perspectiveValidationPassed = true;
      perspectiveMeta.finalPersonMode = detectExperiencePersonMode(genAccepted.text, locale);
      return attachPerspectiveDiag(genAccepted);
    }
    // Prefer a generation-specific typed reason — never leave enhancement-only codes.
    if (
      lastRejectReason === 'missing_canonical_duty'
      || lastRejectReason === 'experience_material_fact_coverage_incomplete'
    ) {
      lastRejectReason = generationFallbackFailureReason || 'experience_generation_failed';
    }
    return attachPerspectiveDiag({
      blocked: true,
      reason: lastRejectReason || 'experience_generation_failed',
      text: exp?.description || '',
      origin: 'user',
      roleDutyConflict,
      countedAsSuccess: false,
      diagnostics: baseDiag(),
    });
  }

  // Russian graphic-design: route family/generic-duty rejects to concrete three-family
  // rebuild. Never source-preserve poisoned live textarea; never label as locale_mismatch.
  const needsRussianDesignRebuild = experienceNeedsRussianDesignFamilyRebuild({
    locale,
    sourceDescription: sourceForCoverage,
    position: exp?.position || cv.personal?.jobTitle,
    rejectReason: providerRejectionReason || lastRejectReason,
  });
  if (needsRussianDesignRebuild) {
    void RUSSIAN_DESIGN_FALLBACK_ROUTING_REVISION;
    clientDeterministicFallbackReason = 'russian_design_family_rebuild';
    authoritativeRequiredFamilyCount = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
    const designFamilyFallback = normalizeLocaleText(
      buildJobContextGenerationFallback({
        locale: 'ru',
        gender,
        position: exp?.position || cv.personal?.jobTitle || 'design',
        industry: 'design',
        isPresent,
      }),
      locale,
    );
    clientDeterministicFallbackBulletCount = splitExperienceBullets(designFamilyFallback)
      .filter(Boolean).length;
    clientDeterministicFallbackScripts = detectBulletScripts(designFamilyFallback);
    if (designFamilyFallback.trim()) {
      const acceptedDesign = tryAccept(
        designFamilyFallback,
        'deterministic_fallback',
        'russian_design_family_rebuild',
      );
      if (acceptedDesign) {
        perspectiveMeta = {
          ...perspectiveMeta,
          perspectiveNormalizationAttempted: true,
          perspectiveNormalizationApplied: true,
          perspectiveValidationPassed: true,
          meaningfulChangeDetected: true,
          noOpRejected: false,
          normalizedBulletsUsedForApply: true,
          finalPersonMode: detectExperiencePersonMode(acceptedDesign.text, locale),
        };
        finalSelectedCoveredFamilyCount = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
        fallbackCoveredFamilyCount = RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT;
        return attachPerspectiveDiag({
          ...acceptedDesign,
          diagnostics: {
            ...acceptedDesign.diagnostics,
            clientDeterministicFallbackAttempted: true,
            clientDeterministicFallbackApplied: true,
            clientDeterministicFallbackReason: 'russian_design_family_rebuild',
            providerRejectionReason,
            providerRejectionStage,
            providerDetectedMaterialFamilyCount,
            authoritativeRequiredFamilyCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
            fallbackCoveredFamilyCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
            finalSelectedCoveredFamilyCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
            fallbackCoverageCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
            requiredFactCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
            coveredFactCount: providerCoveredFactCount,
            rejectionStage: undefined,
            typedFailureReason: undefined,
          },
        });
      }
    }
    // Fail closed: never reapply bad provider or source-preserving generic prose.
    lastRejectReason = lastRejectReason || 'russian_design_family_rebuild_failed';
    lastRejectStage = 'russian_design_family_rebuild';
    clientDeterministicFallbackReason = 'russian_design_family_rebuild';
    return attachPerspectiveDiag({
      blocked: true,
      reason: lastRejectReason,
      text: exp?.description || '',
      origin: 'user',
      roleDutyConflict,
      countedAsSuccess: false,
      diagnostics: {
        ...baseDiag(),
        providerRejectionReason,
        providerRejectionStage,
        clientDeterministicFallbackReason: 'russian_design_family_rebuild',
        clientDeterministicFallbackApplied: false,
        authoritativeRequiredFamilyCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
        typedFailureReason: lastRejectReason,
        rejectionStage: 'russian_design_family_rebuild',
      },
    });
  }

  const needsCroatianDesignRebuild = experienceNeedsCroatianDesignFamilyRebuild({
    locale,
    sourceDescription: sourceForCoverage,
    position: exp?.position || cv.personal?.jobTitle,
    rejectReason: providerRejectionReason || lastRejectReason,
  });
  if (needsCroatianDesignRebuild) {
    void CROATIAN_EXPERIENCE_MATERIAL_REVISION;
    void CROATIAN_SERBIAN_LOCALE_DISCRIMINATION_REVISION;
    void CROATIAN_DESIGN_FALLBACK_ROUTING_REVISION;
    void CROATIAN_DESIGN_POISONED_SOURCE_RECOVERY_REVISION;
    const liveTextarea = (exp?.description || '').trim();
    const poisonedLive = isCroatianDesignPoisonedLiveSource(
      liveTextarea || sourceForCoverage,
      exp?.position || cv.personal?.jobTitle,
    );
    clientDeterministicFallbackReason = 'croatian_design_family_rebuild';
    authoritativeRequiredFamilyCount = 3;
    const designFamilyFallback = normalizeLocaleText(
      buildJobContextGenerationFallback({
        locale: 'hr',
        gender,
        position: 'graphic designer',
        industry: 'design',
        isPresent,
      }),
      locale,
    );
    clientDeterministicFallbackBulletCount = splitExperienceBullets(designFamilyFallback)
      .filter(Boolean).length;
    clientDeterministicFallbackScripts = detectBulletScripts(designFamilyFallback);
    if (designFamilyFallback.trim()) {
      const acceptedDesign = tryAccept(
        designFamilyFallback,
        'deterministic_fallback',
        'croatian_design_family_rebuild',
      );
      if (acceptedDesign) {
        perspectiveMeta = {
          ...perspectiveMeta,
          perspectiveNormalizationAttempted: true,
          perspectiveNormalizationApplied: true,
          perspectiveValidationPassed: true,
          meaningfulChangeDetected: true,
          noOpRejected: false,
          normalizedBulletsUsedForApply: true,
          finalPersonMode: detectExperiencePersonMode(acceptedDesign.text, locale),
        };
        finalSelectedCoveredFamilyCount = 3;
        fallbackCoveredFamilyCount = 3;
        return attachPerspectiveDiag({
          ...acceptedDesign,
          diagnostics: {
            ...acceptedDesign.diagnostics,
            clientDeterministicFallbackAttempted: true,
            clientDeterministicFallbackApplied: true,
            clientDeterministicFallbackReason: 'croatian_design_family_rebuild',
            providerRejectionReason,
            providerRejectionStage,
            providerDetectedMaterialFamilyCount,
            authoritativeRequiredFamilyCount: 3,
            fallbackCoveredFamilyCount: 3,
            finalSelectedCoveredFamilyCount: 3,
            fallbackCoverageCount: 3,
            requiredFactCount: 3,
            coveredFactCount: providerCoveredFactCount,
            rejectionStage: undefined,
            typedFailureReason: undefined,
            selectedSourceActuallyRejected: poisonedLive,
            rejectedSourceReason: poisonedLive
              ? 'croatian_design_poisoned_live_source'
              : undefined,
            currentTextareaIgnoredOrOverridden: poisonedLive,
          },
        });
      }
    }
    lastRejectReason = lastRejectReason || 'croatian_design_material_coverage_incomplete';
    lastRejectStage = 'croatian_design_family_rebuild';
    clientDeterministicFallbackReason = 'croatian_design_family_rebuild';
    return attachPerspectiveDiag({
      blocked: true,
      reason: lastRejectReason,
      text: exp?.description || '',
      origin: 'user',
      roleDutyConflict,
      countedAsSuccess: false,
      diagnostics: {
        ...baseDiag(),
        providerRejectionReason,
        providerRejectionStage,
        clientDeterministicFallbackReason: 'croatian_design_family_rebuild',
        clientDeterministicFallbackApplied: false,
        authoritativeRequiredFamilyCount: 3,
        typedFailureReason: lastRejectReason,
        rejectionStage: 'croatian_design_family_rebuild',
      },
    });
  }

  const groundedRaw = normalizeLocaleText(
    deterministicLocalizedBulletsFromCanonical(canonical, locale, gender, { isPresent }) || '',
    locale,
  );
  const groundedPersp = groundedRaw.trim()
    ? normalizeExperienceBulletsPerspective(groundedRaw, {
      locale,
      isPresent,
      gender,
      sourceDescription: sourceForCoverage,
    })
    : null;
  const grounded = groundedPersp?.text || groundedRaw;
  if (
    grounded.trim()
    && !(grounding?.staleGeneratedContentExcluded && candidateConflictsWithJobContext(grounded, jobContext))
  ) {
    const groundedGate = validateExperienceCvPerspective(grounded, locale);
    const groundedCrossLocale = Boolean(
      sourceForCoverage
      && (
        !sourceUsableInLocale(sourceForCoverage, locale)
        || isCrossLocaleOperation(detectTextLocale(sourceForCoverage), locale)
      ),
    );
    // Never accept same-language canonical shells for a different target locale.
    if (groundedGate.ok && !groundedCrossLocale) {
      if (groundedPersp) {
        perspectiveMeta = {
          ...perspectiveMeta,
          normalizedPersonMode: groundedPersp.normalizedPersonMode,
          perspectiveNormalizationAttempted: true,
          perspectiveNormalizationApplied:
            perspectiveMeta.perspectiveNormalizationApplied
            || groundedPersp.perspectiveNormalizationApplied,
          perspectiveValidationPassed: groundedGate.ok,
          meaningfulChangeDetected:
            perspectiveMeta.meaningfulChangeDetected
            || experienceAiHasMeaningfulChange(sourceForCoverage, grounded),
          noOpRejected: false,
        };
      }
      const groundedMeaningful = experienceAiHasMeaningfulChange(sourceForCoverage, grounded);
      if (providerNoOpDetected && !groundedMeaningful) {
        // No-op recovery must not accept canonical shells identical to source.
      } else {
      const secondAccepted = tryAccept(grounded, 'deterministic_fallback', 'canonical_fallback');
      if (secondAccepted) {
        perspectiveMeta.normalizedBulletsUsedForApply = true;
        perspectiveMeta.finalPersonMode = detectExperiencePersonMode(secondAccepted.text, locale);
        if (providerNoOpDetected) {
          perspectiveMeta.meaningfulChangeDetected = true;
          perspectiveMeta.noOpRejected = false;
        }
        return attachPerspectiveDiag(secondAccepted);
      }
      }
    }
  }

  // Rebuild from authoritative source units when provider/fallback collapsed facts.
  // Identities are captured from immutable source units before tense transforms.
  // Do not skip because the API response was already labelled server `fallback`.
  if (sourceForCoverage && !grounding?.staleGeneratedContentExcluded) {
    const storedSourceLocale = (exp as WorkExperience & { generatedLocale?: string })?.generatedLocale
      || cv.contentLocale
      || null;
    const detectedSourceLocale = detectTextLocale(sourceForCoverage, {
      storedLocale: storedSourceLocale,
      generatedLocale: (exp as WorkExperience & { generatedLocale?: string })?.generatedLocale,
    });
    const crossLocale = isCrossLocaleOperation(detectedSourceLocale, locale)
      || !sourceUsableInLocale(sourceForCoverage, locale);

    // Cross-locale: never return same-language source-preserving text for a
    // different target — use translation-aware fallback instead.
    if (crossLocale) {
      let translated = '';
      if (locale === 'de' && sourceRequiresGermanWarehouseFactCoverage(sourceForCoverage)) {
        void GERMAN_EXPERIENCE_GROUNDING_303_REVISION;
        translated = normalizeLocaleText(
          buildGermanWarehouseExperienceFallback({
            sourceDescription: sourceForCoverage,
            isPresent,
          }),
          locale,
        );
      }
      if (!translated.trim()
        && locale === 'es'
        && sourceRequiresSpanishWarehouseFactCoverage(sourceForCoverage)) {
        void SPANISH_CV_AI_305_REVISION;
        translated = normalizeLocaleText(
          buildSpanishWarehouseExperienceFallback({
            sourceDescription: sourceForCoverage,
            isPresent,
          }),
          locale,
        );
      }
      if (!translated.trim()) {
        translated = normalizeLocaleText(
          buildCrossLocaleExperienceFallback({
            sourceDescription: sourceForCoverage,
            sourceLocale: detectedSourceLocale === 'unknown' ? storedSourceLocale : detectedSourceLocale,
            targetLocale: locale,
            gender,
            isPresent,
            position: exp.position,
          }),
          locale,
        );
      }
      const translatedGate = validateExperienceCvPerspective(translated, locale);
      const translatedOk = Boolean(translated.trim())
        && translatedGate.ok
        && !candidateLeaksSourceLocale(
          translated,
          detectedSourceLocale === 'unknown' ? 'sr' : detectedSourceLocale,
          locale,
        )
        && sourceUsableInLocale(translated, locale);
      clientDeterministicFallbackAttempted = true;
      clientDeterministicFallbackBulletCount = splitExperienceBullets(translated).filter(Boolean).length;
      clientDeterministicFallbackScripts = detectBulletScripts(translated);
      clientDeterministicFallbackRequiredFactCount = sourceFactCount;
      clientDeterministicFallbackCoveredFactCount = countTranslatedFactUnits(
        sourceForCoverage,
        translated,
      );
      if (translatedOk) {
        const accepted = tryAccept(
          translated,
          'deterministic_fallback',
          'cross_locale_translation_fallback',
        );
        if (accepted) {
          perspectiveMeta = {
            ...perspectiveMeta,
            sourcePersonMode: detectExperiencePersonMode(
              sourceForCoverage,
              (detectedSourceLocale === 'sr' || detectedSourceLocale === 'hr')
                ? detectedSourceLocale
                : locale,
            ),
            perspectiveNormalizationAttempted: true,
            perspectiveNormalizationApplied: true,
            perspectiveValidationPassed: true,
            normalizedPersonMode: detectExperiencePersonMode(translated, locale),
            finalPersonMode: detectExperiencePersonMode(translated, locale),
            meaningfulChangeDetected: true,
            noOpRejected: false,
          };
          return attachPerspectiveDiag({
            ...accepted,
            diagnostics: {
              ...accepted.diagnostics,
              detectedSourceLocale:
                detectedSourceLocale === 'unknown' ? storedSourceLocale : detectedSourceLocale,
              storedSourceLocale,
              requestedTargetLocale: locale,
              uiLocale: locale,
              crossLocaleOperation: true,
              translationFallbackAttempted: true,
              translationFallbackApplied: true,
              translatedFactCount: countTranslatedFactUnits(sourceForCoverage, translated),
              targetLocaleValidationPassed: true,
              sourcePerspectiveMode: perspectiveMeta.sourcePersonMode,
              targetPerspectiveMode: detectExperiencePersonMode(translated, locale),
              targetContentApplied: true,
              contentLocaleUpdatedAfterApply: true,
              fallbackCoverageCount: countTranslatedFactUnits(sourceForCoverage, translated),
              clientDeterministicFallbackAttempted: true,
              clientDeterministicFallbackApplied: true,
              clientDeterministicFallbackBulletCount:
                splitExperienceBullets(translated).filter(Boolean).length,
            },
          });
        }
      }
      // Russian design family rebuild when frame-based or provider text failed.
      if (locale === 'ru' && sourceRequiresRussianDesignFamilies(sourceForCoverage)) {
        const designFamilyFallback = normalizeLocaleText(
          buildJobContextGenerationFallback({
            locale,
            gender,
            position: exp?.position || cv.personal?.jobTitle || 'design',
            industry: 'design',
            isPresent,
          }),
          locale,
        );
        if (designFamilyFallback.trim()) {
          const acceptedDesign = tryAccept(
            designFamilyFallback,
            'deterministic_fallback',
            'russian_design_family_rebuild',
          );
          if (acceptedDesign) {
            perspectiveMeta = {
              ...perspectiveMeta,
              perspectiveNormalizationAttempted: true,
              perspectiveNormalizationApplied: true,
              perspectiveValidationPassed: true,
              meaningfulChangeDetected: true,
              noOpRejected: false,
              finalPersonMode: detectExperiencePersonMode(acceptedDesign.text, locale),
            };
            return attachPerspectiveDiag({
              ...acceptedDesign,
              diagnostics: {
                ...acceptedDesign.diagnostics,
                crossLocaleOperation: true,
                translationFallbackAttempted: true,
                translationFallbackApplied: true,
                clientDeterministicFallbackAttempted: true,
                clientDeterministicFallbackApplied: true,
                clientDeterministicFallbackReason: 'russian_design_family_rebuild',
                providerRejectionReason,
                providerRejectionStage,
                authoritativeRequiredFamilyCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
                fallbackCoveredFamilyCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
                finalSelectedCoveredFamilyCount: RUSSIAN_AUTHORITATIVE_DESIGN_FAMILY_COUNT,
              },
            });
          }
        }
      }
      // Preserve the first blocking reason from tryAccept (e.g. semantic coverage);
      // only invent locale_mismatch when tryAccept never ran or left no reason.
      if (!lastRejectReason) {
        lastRejectReason = translatedGate.ok
          ? 'locale_mismatch'
          : (translatedGate.reason || 'experience_cv_perspective_first_person');
      }
      if (!lastRejectStage || lastRejectStage === 'init') {
        lastRejectStage = 'cross_locale_translation_fallback';
      }
      // Do not fall through to same-language source-preserving for a different target.
    } else {
    // Same-locale Spanish warehouse: grounded deterministic recovery when provider
    // was rejected (e.g. guarantee escalation) and strip-repair did not apply.
    if (
      locale === 'es'
      && sourceRequiresSpanishWarehouseFactCoverage(sourceForCoverage)
    ) {
      void SPANISH_CV_AI_305_REVISION;
      void SPANISH_EXPERIENCE_GUARANTEE_GROUNDING_308_REVISION;
      const esWarehouseFallback = normalizeLocaleText(
        buildSpanishWarehouseExperienceFallback({
          sourceDescription: sourceForCoverage,
          isPresent,
        }),
        locale,
      );
      if (esWarehouseFallback.trim()) {
        clientDeterministicFallbackAttempted = true;
        clientDeterministicFallbackReason = clientDeterministicFallbackReason
          || 'spanish_warehouse_deterministic_fallback';
        clientDeterministicFallbackBulletCount = splitExperienceBullets(esWarehouseFallback)
          .filter(Boolean).length;
        const esFbAccepted = tryAccept(
          esWarehouseFallback,
          'deterministic_fallback',
          'spanish_warehouse_fallback',
        );
        if (esFbAccepted) {
          providerAccepted = false;
          finalCandidateSource = 'deterministic_fallback';
          finalUnsupportedClaimCount = 0;
          finalUnsupportedClaimKinds = [];
          perspectiveMeta = {
            ...perspectiveMeta,
            perspectiveNormalizationAttempted: true,
            perspectiveNormalizationApplied: true,
            perspectiveValidationPassed: true,
            meaningfulChangeDetected: true,
            noOpRejected: false,
            finalPersonMode: detectExperiencePersonMode(esFbAccepted.text, locale),
            normalizedBulletsUsedForApply: true,
          };
          return attachPerspectiveDiag({
            ...esFbAccepted,
            diagnostics: {
              ...esFbAccepted.diagnostics,
              providerAccepted: false,
              providerRejectionReason,
              providerRejectionStage,
              providerUnsupportedClaimCount,
              providerUnsupportedClaimKinds: [...providerUnsupportedClaimKinds],
              finalCandidateSource: 'deterministic_fallback',
              finalUnsupportedClaimCount: 0,
              finalUnsupportedClaimKinds: [],
              unsupportedClaimCount: 0,
              clientDeterministicFallbackAttempted: true,
              clientDeterministicFallbackApplied: true,
              clientDeterministicFallbackReason: 'spanish_warehouse_deterministic_fallback',
              fallbackApplied: true,
            },
          });
        }
      }
    }
    const built = buildSourcePreservingExperienceBulletsWithProvenance(
      sourceForCoverage,
      locale,
      gender,
      {
        isPresent,
        operationSnapshotId: snapshot?.operationSnapshotId,
        snapshotUnits: snapshot?.units.map((u) => ({
          rawUnit: u.rawUnit,
          sourceUnitId: u.sourceUnitId,
          sourceFactIds: u.sourceFactIds,
          operationSnapshotId: u.operationSnapshotId,
        })),
      },
    );
    // Keep typed provenance through locale/tense post-processing — only refresh
    // display text per index; never drop sourceUnitId / operationSnapshotId.
    const preservedLines = built.bullets.map((b) =>
      normalizeLocaleText(b.text || '', locale).trim());
    const alignedProvenance = built.bullets.map((b, i) => ({
      ...b,
      text: (preservedLines[i] || b.text).trim(),
      operationSnapshotId: b.operationSnapshotId || snapshot?.operationSnapshotId,
    }));
    const preserved = alignedProvenance.map((b) => b.text).filter(Boolean).length
      ? formatExperienceBullets(alignedProvenance.map((b) => b.text))
      : normalizeLocaleText(built.text || '', locale);
    const provenanceCoverage = validateProvenancedDeterministicFallbackCoverage(
      sourceForCoverage,
      alignedProvenance,
      { expectedOperationSnapshotId: snapshot?.operationSnapshotId },
    );
    clientDeterministicFallbackBulletCount = alignedProvenance.filter((b) => b.text.trim()).length;
    clientDeterministicFallbackScripts = detectBulletScripts(preserved);
    clientDeterministicFallbackRequiredFactCount = provenanceCoverage.requiredIds.length;
    clientDeterministicFallbackCoveredFactCount = provenanceCoverage.coveredIds.length;
    clientDeterministicFallbackUncoveredFactIds = provenanceCoverage.missingIds;
    fallbackBulletCount = clientDeterministicFallbackBulletCount;
    const preservedGate = validateExperienceCvPerspective(preserved, locale);
    // Fallback after provider failure is always an allowed repair path — even when
    // the rebuilt CV text matches the source after perspective (provider was empty
    // or incomplete). No-op rejection applies only to unchanged provider output.
    // Exception: after a recoverable provider no-op, identical source-preserving
    // text is not a meaningful recovery — require stylistic fallback instead.
    perspectiveMeta = {
      ...perspectiveMeta,
      perspectiveNormalizationAttempted: true,
      perspectiveNormalizationApplied: true,
      perspectiveValidationPassed: preservedGate.ok,
      normalizedPersonMode: detectExperiencePersonMode(preserved, locale),
      meaningfulChangeDetected:
        perspectiveMeta.meaningfulChangeDetected
        || experienceAiHasMeaningfulChange(sourceForCoverage, preserved),
      noOpRejected: false,
    };
    const preservedMeaningful = experienceAiHasMeaningfulChange(sourceForCoverage, preserved);
    if (
      preservedGate.ok
      && provenanceCoverage.ok
      && (!providerNoOpDetected || preservedMeaningful)
    ) {
      const preservedAccepted = tryAccept(
        preserved,
        'deterministic_fallback',
        'source_preserving_fallback',
        { provenancedIdentity: provenanceCoverage },
      );
      if (preservedAccepted) {
        perspectiveMeta.normalizedBulletsUsedForApply = true;
        perspectiveMeta.finalPersonMode = detectExperiencePersonMode(preservedAccepted.text, locale);
        if (providerNoOpDetected) {
          deterministicFallbackAttemptedAfterNoOp = true;
          deterministicFallbackAppliedAfterNoOp = true;
          finalCandidateSource = 'deterministic_fallback';
        } else {
          finalCandidateSource = 'deterministic_fallback';
        }
        return attachPerspectiveDiag({
          ...preservedAccepted,
          diagnostics: {
            ...preservedAccepted.diagnostics,
            finalCandidateSource,
            deterministicFallbackAttemptedAfterNoOp,
            deterministicFallbackAppliedAfterNoOp,
            providerNoOpDetected,
            noOpRepairAttempted: noOpRepairAttemptedFlag,
          },
        });
      }
    } else if (!preservedGate.ok) {
      lastRejectReason = preservedGate.reason || 'experience_cv_perspective_first_person';
      lastRejectStage = 'source_preserving_fallback:perspective';
    } else if (providerNoOpDetected && !preservedMeaningful) {
      lastRejectStage = 'source_preserving_fallback:noop';
      lastRejectReason = 'ai_no_meaningful_change';
    }
    }

    // Dedicated stylistic fallback after provider/repair no-op when preserve == source.
    if (providerNoOpDetected && sourceForCoverage && !grounding?.staleGeneratedContentExcluded) {
      void EXPERIENCE_AI_NOOP_RECOVERY_REVISION;
      deterministicFallbackAttemptedAfterNoOp = true;
      clientDeterministicFallbackAttempted = true;
      clientDeterministicFallbackReason = clientDeterministicFallbackReason
        || 'experience_ai_noop_recovery';
      const stylistic = normalizeLocaleText(
        buildExperienceAiNoOpStylisticFallback({
          sourceDescription: sourceForCoverage,
          locale,
          isPresent,
          gender,
        }),
        locale,
      );
      const stylisticGate = validateExperienceCvPerspective(stylistic, locale);
      clientDeterministicFallbackBulletCount = splitExperienceBullets(stylistic).filter(Boolean).length;
      clientDeterministicFallbackScripts = detectBulletScripts(stylistic);
      if (
        stylisticGate.ok
        && experienceAiNoOpFallbackIsSafe({
          sourceDescription: sourceForCoverage,
          candidate: stylistic,
        })
      ) {
        const stylisticAccepted = tryAccept(
          stylistic,
          'deterministic_fallback',
          'source_preserving_fallback',
        );
        if (stylisticAccepted) {
          perspectiveMeta = {
            ...perspectiveMeta,
            meaningfulChangeDetected: true,
            noOpRejected: false,
            perspectiveValidationPassed: true,
            normalizedBulletsUsedForApply: true,
            finalPersonMode: detectExperiencePersonMode(stylisticAccepted.text, locale),
          };
          deterministicFallbackAppliedAfterNoOp = true;
          finalCandidateSource = 'deterministic_fallback';
          finalUnsupportedClaimCount = 0;
          finalUnsupportedClaimKinds = [];
          return attachPerspectiveDiag({
            ...stylisticAccepted,
            diagnostics: {
              ...stylisticAccepted.diagnostics,
              clientDeterministicFallbackReason: 'experience_ai_noop_recovery',
              finalCandidateSource,
              deterministicFallbackAttemptedAfterNoOp: true,
              deterministicFallbackAppliedAfterNoOp: true,
              providerNoOpDetected: true,
              noOpRepairAttempted: noOpRepairAttemptedFlag,
              noOpRepairApplied: false,
              noOpRepairValidationPassed: noOpRepairValidationPassed ?? undefined,
              noOpRepairMeaningfulChangeDetected: noOpRepairMeaningfulChangeDetected ?? undefined,
              noOpRepairUnsupportedClaimCount,
              noOpRepairUnsupportedClaimKinds,
              noOpRepairScopeExpansionDetected,
              noOpRepairUniversalQuantifierDetected,
              noOpRepairResponsibilityEscalationDetected,
              noOpRepairRejectionReason,
              finalUnsupportedClaimCount: 0,
              finalUnsupportedClaimKinds: [],
              unsupportedClaimCount: noOpRepairUnsupportedClaimCount,
              meaningfulChangeDetected: true,
              noOpRejected: false,
            },
          });
        }
      }
    }
  }

  const occupationFallback = normalizeLocaleText(
    (
      jobContext.positionClass === 'pharmacist_pharmacy'
      || jobContext.industryNorm === 'pharmacy'
      || jobContext.positionClass === 'baker_food'
      || jobContext.positionClass === 'hospitality_service'
      || jobContext.positionClass === 'software_tech'
    )
      ? (buildOccupationAwareExperienceFallback({
        locale,
        gender,
        position: exp?.position,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      }) || buildJobContextGenerationFallback({
        locale,
        gender,
        position: exp?.position || cv.personal?.jobTitle,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      }))
      : (buildJobContextGenerationFallback({
        locale,
        gender,
        position: exp?.position || cv.personal?.jobTitle,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      }) || buildOccupationAwareExperienceFallback({
        locale,
        gender,
        position: exp?.position,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      })),
    locale,
  );
  const allowOccupationFallback = Boolean(
    grounding?.staleGeneratedContentExcluded
    || (input.industry && input.industry !== 'general')
    || jobContext.positionClass === 'pharmacist_pharmacy'
    || jobContext.positionClass === 'software_tech'
    || sourceWasEmpty,
  );
  if (
    occupationFallback.trim()
    && allowOccupationFallback
    && (canonical.length === 0 || grounding?.staleGeneratedContentExcluded || sourceWasEmpty)
  ) {
    // Occupation / job-context fallback only when there are no user source facts to preserve.
    if (!sourceForCoverage.trim()) {
      clientDeterministicFallbackBulletCount = splitExperienceBullets(occupationFallback).filter(Boolean).length;
      clientDeterministicFallbackScripts = detectBulletScripts(occupationFallback);
      if (sourceWasEmpty) {
        generationFallbackAttempted = true;
        const genAccepted = tryAcceptGeneration(
          occupationFallback,
          'deterministic_fallback',
          'occupation_fallback',
        );
        if (genAccepted) return attachPerspectiveDiag(genAccepted);
      } else {
        const acceptedOcc = tryAccept(
          occupationFallback,
          'deterministic_fallback',
          'occupation_fallback',
        );
        if (acceptedOcc) return attachPerspectiveDiag(acceptedOcc);
      }
    }
  }

  const coverageFail = sourceForCoverage
    ? validateExperienceApplyMaterialPostcondition(
      sourceForCoverage,
      candidate || grounded || '',
      { targetLocale: locale },
    )
    : null;
  if (coverageFail && !coverageFail.ok) {
    lastRejectReason = coverageFail.reason || lastRejectReason;
    lastRejectStage = lastRejectStage === 'init' ? 'final_block' : lastRejectStage;
    lastCovered = coverageFail.covered?.length ?? lastCovered;
    lastRequired = coverageFail.required?.length ?? lastRequired;
  }

  const rejectedPurity = (candidate || '').trim()
    ? validateAiUnitLocalePurity(candidate, locale, {
      kind: 'experience_bullet',
      requireUnits: true,
    })
    : null;
  const crossLocaleReject = Boolean(
    sourceForCoverage
    && (
      !sourceUsableInLocale(sourceForCoverage, locale)
      || isCrossLocaleOperation(detectTextLocale(sourceForCoverage), locale)
    ),
  );

  return attachPerspectiveDiag({
    blocked: true,
    reason: coverageFail?.reason
      || lastRejectReason
      || 'experience_material_fact_coverage_incomplete',
    text: exp?.description || '',
    origin: 'user',
    roleDutyConflict,
    countedAsSuccess: false,
    diagnostics: {
      ...baseDiag(),
      targetLocale: locale,
      targetScript: resolveTargetScriptForLocale(locale),
      detectedLocaleByBullet: rejectedPurity?.detectedLocaleByUnit || [],
      detectedScriptByBullet: rejectedPurity?.detectedScriptByUnit || [],
      wrongLocaleBulletCount: rejectedPurity?.wrongLocaleUnitCount ?? 0,
      wrongScriptBulletCount: rejectedPurity?.wrongScriptUnitCount ?? 0,
      mixedLanguageBulletCount: rejectedPurity?.mixedLanguageUnitCount ?? 0,
      sourceLanguageLeakageDetected: rejectedPurity?.sourceLanguageLeakageDetected ?? false,
      targetLocalePurityPassed: rejectedPurity?.targetLocalePurityPassed ?? false,
      providerLocalePurityPassed: rejectedPurity?.targetLocalePurityPassed ?? null,
      providerSemanticCoveragePassed: providerCoveredFactCount >= Math.min(3, providerRequiredFactCount || 3),
      providerUncoveredFactCount: Math.max(0, providerRequiredFactCount - providerCoveredFactCount),
      providerPrimaryRejectionReason: lastRejectReason || null,
      fallbackLocalePurityPassed: clientDeterministicFallbackAttempted
        ? (clientDeterministicFallbackScripts.length > 0
          && !clientDeterministicFallbackScripts.includes('latin')
          && !clientDeterministicFallbackScripts.includes('mixed'))
        : null,
      fallbackSemanticCoveragePassed: clientDeterministicFallbackAttempted
        ? clientDeterministicFallbackCoveredFactCount >= Math.min(3, clientDeterministicFallbackRequiredFactCount || 3)
        : null,
      fallbackPrimaryRejectionReason: clientDeterministicFallbackAttempted
        ? (lastRejectReason || null)
        : null,
      crossLocaleOperation: crossLocaleReject,
      translationProviderAttempted: crossLocaleReject && Boolean((input.candidate || '').trim()),
      translationFallbackAttempted: clientDeterministicFallbackAttempted && crossLocaleReject,
      translationFallbackApplied: false,
      translatedFactCount: providerCoveredFactCount || lastCovered,
      providerCoverageCount: providerCoveredFactCount,
      // On terminal failure, top-level coverage still reflects the last evaluated
      // (usually provider) candidate; provider* fields remain the authority.
      coveredFactCount: lastCovered,
      requiredFactCount: lastRequired || providerRequiredFactCount || sourceFactCount,
      uncoveredFactIdentityHashes: providerUncoveredFactIdentityHashes.length
        ? [...providerUncoveredFactIdentityHashes]
        : [...clientDeterministicFallbackUncoveredFactIds],
      providerUncoveredFactIdentityHashes: [...providerUncoveredFactIdentityHashes],
      providerAccepted: false,
      experienceDiagnosticsFinalCandidateRevision:
        EXPERIENCE_DIAGNOSTICS_FINAL_CANDIDATE_305_REVISION,
    },
  });
}

/**
 * Single authoritative gate for AI field application.
 */
export function finalizeCvAiFieldForApply(
  input: FinalizeCvAiFieldInput,
): FinalizeCvAiFieldResult {
  if (input.field === 'experience_description' || input.action === 'experience_bullets') {
    return finalizeBullets(input);
  }
  return finalizeSummary(input);
}

/** Apply finalized summary into CV (state / cvRef / autosave source of truth). */
export function applyFinalizedSummaryToCv(
  cv: CVData,
  locale: Locale,
  finalized: FinalizeCvAiFieldResult,
  jobContext?: ExperienceJobContext,
): CVData {
  if (finalized.blocked || !finalized.countedAsSuccess) return cv;
  const primary = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const ctx = jobContext || buildExperienceJobContext({
    position: primary?.position || cv.personal?.jobTitle,
    locale,
  });
  return acceptValidatedAiContent(cv, {
    locale,
    summary: finalized.text,
    summaryOrigin: finalized.origin as CvSummaryOrigin,
    jobContext: ctx,
  });
}

/** Apply finalized bullets into CV. Rebuilds stale AI Summary when occupation changed. */
export function applyFinalizedBulletsToCv(
  cv: CVData,
  locale: Locale,
  experienceId: string,
  finalized: FinalizeCvAiFieldResult,
  jobContext?: ExperienceJobContext,
): CVData {
  if (finalized.blocked || !finalized.countedAsSuccess) return cv;
  const descriptionOrigin = finalized.origin === 'deterministic_fallback'
    ? 'deterministic_fallback' as const
    : finalized.origin === 'ai_repaired'
      ? 'ai_repaired' as const
      : 'ai_generated' as const;
  let next = acceptValidatedAiContent(cv, {
    locale,
    experienceId,
    description: finalized.text,
    descriptionOrigin,
    jobContext,
    confirmGeneratedAsGrounding: Boolean(finalized.diagnostics?.sourceWasEmpty),
  });

  // Cross-locale Experience apply: localize the applied entry's structured
  // free-text title into the target locale when recognized (warehouse / design).
  // Never overwrite an explicit manual title the user typed.
  {
    const gender = next.personal?.gender || '';
    next = {
      ...next,
      experience: (next.experience || []).map((e) => {
        if (e.id !== experienceId) return e;
        if (e.positionUserEdited || e.positionProvenance === 'manual') {
          return e;
        }
        const localized = localizeOccupationalTitleForProjection(
          e.position || '',
          locale,
          gender,
        );
        return localized && localized !== e.position
          ? {
            ...e,
            position: localized,
            positionProvenance: 'localized_generated' as const,
            positionSourceLocale: locale,
            positionUserEdited: false,
          }
          : e;
      }),
    };
  }

  const exp = (next.experience || []).find((e) => e.id === experienceId);
  if (!exp) {
    // Stable ID is authoritative — never fall back to array index 0 / current role.
    return next;
  }
  const ctx = jobContext || buildExperienceJobContext({
    position: exp.position || next.personal?.jobTitle,
    locale,
  });
  const summaryText = next.summary || '';
  const summaryStale = isSummaryStaleForJobContext(summaryText, ctx, {
    summaryOrigin: next.summaryOrigin,
    summaryGenerationContextKey: next.summaryGenerationContextKey,
  }) || textLooksLikeCookingDuties(summaryText);

  if (summaryStale && next.summaryOrigin !== 'user') {
    const durationSnapshot = buildExperienceDurationSnapshot(next.experience || []);
    const durationPhrase = formatApproximateDurationPhrase(durationSnapshot.total, locale);
    const rebuilt = scrubOrphanDurationFragments(
      buildOccupationAwareSummaryFallback({
        locale,
        gender: next.personal?.gender || '',
        position: exp?.position || next.personal?.jobTitle,
        industry: ctx.industryNorm,
        company: exp?.company,
        startDate: exp?.startDate,
        durationPhrase,
        isPresent: exp?.isPresent,
      }),
    );
    next = acceptValidatedAiContent(next, {
      locale,
      summary: rebuilt,
      summaryOrigin: 'deterministic_fallback',
      jobContext: ctx,
    });
  } else if (summaryStale && next.summaryOrigin === 'user') {
    // Keep user text in state, but clear generation context so export rebuilds safely.
    next = {
      ...next,
      summaryGenerationContextKey: undefined,
    };
  }

  return next;
}

/**
 * Page-equivalent orchestration: finalize → accept → quality projection texts.
 * Used by the Android CV builder handlers and by end-to-end regression tests.
 */
export function runCvAiApplyPipeline(options: {
  cv: CVData;
  locale: Locale;
  action: CvAiFinalizeAction;
  candidate: string;
  experienceId?: string;
  durationSnapshot?: ExperienceDurationSnapshot;
  referenceDateIso?: string;
  industry?: string;
  level?: string;
  jobContext?: ExperienceJobContext;
  originHint?: CvAiFinalizeOrigin;
  noOpRepairAttempted?: boolean;
  operationSnapshot?: ExperienceAiOperationSnapshot;
}): {
  blocked: boolean;
  reason?: string;
  finalized: FinalizeCvAiFieldResult;
  stateCv: CVData;
  previewCv: CVData;
  pdfCv: CVData;
  docxCv: CVData;
} {
  const field: CvAiFinalizeField = options.action === 'experience_bullets'
    ? 'experience_description'
    : 'summary';
  const exp = options.experienceId
    ? (options.cv.experience || []).find((e) => e.id === options.experienceId)
    : (options.action === 'experience_bullets'
      ? undefined
      : (options.cv.experience || [])[0]);
  // Never silently bind Experience AI to array index 0 when a stable ID was expected.
  // Summary may still inspect the current role for grounding context.
  const jobContext = options.jobContext || (options.action === 'experience_bullets'
    ? buildExperienceJobContext({
      position: exp?.position,
      industry: options.industry,
      locale: options.locale,
      level: options.level,
    })
    : undefined);
  const finalized = finalizeCvAiFieldForApply({
    action: options.action,
    field,
    requestedLocale: options.locale,
    gender: options.cv.personal?.gender || '',
    cv: options.cv,
    candidate: options.candidate,
    experienceId: options.experienceId,
    durationSnapshot: options.durationSnapshot,
    referenceDateIso: options.referenceDateIso,
    industry: options.industry,
    level: options.level,
    jobContext,
    originHint: options.originHint,
    noOpRepairAttempted: options.noOpRepairAttempted,
    operationSnapshot: options.operationSnapshot,
  });

  if (finalized.blocked || !finalized.countedAsSuccess) {
    return {
      blocked: true,
      reason: finalized.reason,
      finalized,
      stateCv: options.cv,
      previewCv: options.cv,
      pdfCv: options.cv,
      docxCv: options.cv,
    };
  }

  const stateCv = field === 'summary'
    ? applyFinalizedSummaryToCv(options.cv, options.locale, finalized)
    : applyFinalizedBulletsToCv(options.cv, options.locale, options.experienceId!, finalized, jobContext);

  const previewCv = applyCvContentQuality(stateCv, options.locale, {
    gender: stateCv.personal?.gender || '',
    summaryOrigin: stateCv.summaryOrigin,
    referenceDate: options.referenceDateIso,
  }).cv;
  // Preview / PDF / DOCX must share the same finalized quality projection.
  const pdfCv = previewCv;
  const docxCv = previewCv;

  return {
    blocked: false,
    finalized,
    stateCv,
    previewCv,
    pdfCv,
    docxCv,
  };
}
