/**
 * Summary V2 — parallel architecture (feature-flagged).
 * Legacy Summary engine remains the default when the flag is off.
 */
export {
  SUMMARY_V2_REVISION,
  isSummaryV2Enabled,
  setSummaryV2EnabledForTests,
  summaryV2BundleMarker,
} from './flag';
export type {
  SummaryV2EntryFact,
  SummaryV2EntryOwned,
  SummaryV2Snapshot,
  SummaryV2SelectionManifest,
  SummaryV2ValidationResult,
  SummaryV2PipelineResult,
  SummaryV2CandidateSourceKind,
  SummaryV2FinalUnitRoleSlot,
  SummaryV2FinalUnitOwnershipEvidence,
  SummaryV2FactUnitCoverageEvidence,
  SummaryV2MaterialClaimCategory,
  SummaryV2MaterialAuthorityPhase,
  SummaryV2SourceMaterialAuthorityEvidence,
  SummaryV2FinalMaterialClaimAuthorityEvidence,
  SummaryV2SourceFactContentFingerprint,
  SummaryV2SelectedEntrySourceContentFingerprint,
  SummaryV2MaterialAuthorityResult,
} from './types';
export { SUMMARY_V2_PRINT_MATERIAL_CATEGORY } from './types';
export {
  captureSummaryV2Snapshot,
  liveExperienceDescription,
  summaryV2SnapshotMatchesCv,
} from './snapshot';
export {
  buildEntryOwnedFactsFromLiveDescription,
  hashSummaryV2Text,
  factCoveredInText,
  splitLiveDutyBullets,
} from './facts';
export {
  buildSummaryV2SelectionManifest,
  SUMMARY_V2_MAX_DUTIES_PER_ENTRY,
  SUMMARY_V2_MAX_PRIOR_ENTRIES,
} from './manifest';
export {
  resolveSummaryCurrentRole,
  resolveSummaryCurrentRoleWithEvidence,
  SUMMARY_CURRENT_ROLE_RESOLVER_REVISION,
} from '@/lib/cv-summary-current-role';
export type {
  SummaryCurrentRoleDateAuthority,
  SummaryCurrentRoleRankingEvidence,
  SummaryCurrentRoleResolution,
} from '@/lib/cv-summary-current-role';
export {
  buildSummaryV2DeterministicText,
  bulletToWhereClauseEn,
  buildGermanSummaryV2FromManifest,
  bulletToGermanWoIchClause,
  GERMAN_SUMMARY_V2_FIRST_PERSON_SURFACE_382_REVISION,
  GERMAN_SUMMARY_V2_SURFACE_FINALIZER_383_REVISION,
  isSupportedSummaryV2Locale,
} from './builder';
export {
  dutyTenseFromEmploymentState,
  toEnglishPastVerb,
  dutyBulletForLocaleShell,
  peelEnglishVerbToLemma,
  isEnglishPastVerbForm,
  isMalformedDoublePastToken,
  summaryHasMalformedDoublePast,
} from './tense';
export type { SummaryV2DutyTense } from './tense';
export {
  validateSummaryV2AgainstManifest,
  entryDutiesMatchEmploymentTense,
} from './validator';
export type { SummaryV2ValidationOptions } from './validator';
export {
  detectSummaryV2QualityMannerClaims,
  unsupportedSummaryV2QualityMannerClaims,
  removeUnsupportedSummaryV2QualityMannerClaims,
} from './semantic-claims';
export type {
  SummaryV2QualityMannerClaim,
  SummaryV2QualityMannerClaimKind,
} from './semantic-claims';
export {
  runSummaryV2,
  buildSummaryV2ManifestForCv,
  summaryV2Active,
  repairSummaryV2DutyTense,
} from './pipeline';
export type { RunSummaryV2Options, SummaryV2PipelineDiagnostics } from './pipeline';
export {
  SUMMARY_V2_REWRITE_STYLE_384_REVISION,
  SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION,
  SUMMARY_V2_STRONGER_DUTY_SURFACE_388_REVISION,
  SUMMARY_V2_STRONGER_SPARSE_MODIFIER_388_REVISION,
  normalizeSummaryV2RewriteStyle,
  buildSummaryV2StyledDeterministicText,
  buildSummaryV2BalancedEnhanceText,
  transformSummaryV2ForRewriteStyle,
  evaluateSummaryV2StyleFulfillment,
  analyzeStrongerNativeSurface,
  repairSummaryV2RewriteStyle,
  summaryV2StylePairDistinct,
  summaryV2ShorterMinLengthDeltaPercent,
  listSemanticStyleOperations,
  isSummaryV2MarkerOnlyStyleChange,
  summaryV2CountUnits,
  summaryV2ClauseCount,
} from './rewrite-style';
export type {
  SummaryV2RewriteStyle,
  SummaryV2StyleFulfillment,
  SummaryV2StyleTransformResult,
  SummaryV2SemanticOperation,
} from './rewrite-style';
export {
  SUMMARY_V2_NATIVE_SURFACE_386_REVISION,
  SUMMARY_V2_NATIVE_SURFACE_389_REVISION,
  SUMMARY_V2_SPANISH_PERSPECTIVE_NATIVE_SURFACE_391_REVISION,
  SUMMARY_V2_SPANISH_SLOT_WIDE_PERSON_393_REVISION,
  formatNativeDurationSentence,
  buildNativeFirstPersonDutyTail,
  realizeFirstPersonDutyClause,
  analyzeSpanishCoordinatedPredicateMorphology,
  evaluateSummaryV2NativeSurface,
  evaluateNativeRealizationContract,
} from './native-surface';
export {
  SUMMARY_V2_CROSS_LOCALE_AUTHORITY_390_REVISION,
  SUMMARY_V2_SUPPORTED_LOCALES,
  detectDominantLocale,
  resolveSourceLocaleForText,
  evaluateTargetLocalePurity,
} from './locale-authority';
export {
  SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
  validateSummaryV2LocalizationResponse,
  parseSummaryV2LocalizationProviderJson,
  acceptSummaryV2LocalizationResponse,
  buildSameLocaleLocalizedManifest,
  projectSummaryV2AuthoritativeRoleTitle,
  projectLocalizedSummaryV2Manifest,
  buildSummaryV2ProviderExperienceEntries,
  classifySummaryV2EntrySurfaceAuthority,
  buildSummaryV2EntrySurfaceTransportPlan,
  inspectSummaryV2TranslatableSurface,
} from './localization';
export { validateLocalizedSummaryRoleTitleGender } from '@/lib/cv-summary-structured-role-localization';
export {
  SUMMARY_V2_MATERIAL_CLAIM_CONTRACT_REVISION,
  SUMMARY_V2_MATERIAL_CLAIM_DETECTOR_REVISION,
  detectSummaryV2MaterialClaimCategories,
  detectPrintMediumClaim,
  auditSummaryV2MaterialClaims,
  auditSummaryV2PrintClaims,
  validateSummaryV2MaterialAuthorityProvenance,
} from './material-claims';
export {
  SUMMARY_V2_ENTRY_OWNED_FINAL_UNITS_REVISION,
  splitSummaryV2FinalUnits,
  analyzeSummaryV2FinalUnitOwnership,
} from './unit-ownership';
export type {
  SummaryV2UnitOwnershipOptions,
  SummaryV2UnitOwnershipResult,
} from './unit-ownership';
export {
  localizeSummaryV2Manifest,
  clearSummaryV2LocalizationCacheForTests,
  SUMMARY_V2_LOCALIZATION_RECOVERY_REVISION,
} from './localization-client';
export type {
  SummaryV2LocalizationTransport,
  SummaryV2LocalizationTransportInput,
  SummaryV2LocalizationOutcome,
  SummaryV2LocalizationLineage,
} from './localization-client';
export type {
  SummaryV2LocalizedManifest,
  SummaryV2LocalizedEntry,
  SummaryV2LocalizedFact,
  SummaryV2LocalizationProviderResponse,
  SummaryV2LocalizationValidation,
  SummaryV2LocalizationSource,
  SummaryV2LocalizationFailureEvidence,
  SummaryV2ProtectedEntityTokenClass,
  SummaryV2ProviderExperienceEntry,
  SummaryV2EntrySurfaceAuthority,
  SummaryV2EntrySurfaceTransportPlan,
  SummaryV2SurfaceAuthorityState,
} from './localization';
export type {
  SummaryV2NativeSurfaceResult,
  SummaryV2NativeRealizationContract,
  SpanishCoordinatedPredicateMorphology,
} from './native-surface';
export {
  SUMMARY_V2_GENDER_SURFACE_389_REVISION,
  resolveSummaryV2GenderMode,
  pickGenderedForm,
  detectUnresolvedGenderPlaceholder,
} from './gender';
export type { SummaryV2GenderMode } from './gender';
export {
  SOUTH_SLAVIC_PREDICATE_CHAIN_386_REVISION,
  realizeSouthSlavicPredicateChain,
  analyzeSouthSlavicPredicateChainText,
  evaluateSouthSlavicSummaryPredicateChains,
  isSouthSlavicFiniteVerbToken,
} from './south-slavic-predicates';
export type { SouthSlavicPredicateChainDiagnostics } from './south-slavic-predicates';
export { compareSummaryV2AgainstLegacy } from './shadow';
export type { SummaryV2ShadowComparison } from './shadow';
