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
} from './types';
export { captureSummaryV2Snapshot, liveExperienceDescription } from './snapshot';
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
  projectLocalizedSummaryV2Manifest,
} from './localization';
export {
  localizeSummaryV2Manifest,
  clearSummaryV2LocalizationCacheForTests,
} from './localization-client';
export type {
  SummaryV2LocalizationTransport,
  SummaryV2LocalizationTransportInput,
  SummaryV2LocalizationOutcome,
} from './localization-client';
export type {
  SummaryV2LocalizedManifest,
  SummaryV2LocalizedEntry,
  SummaryV2LocalizedFact,
  SummaryV2LocalizationProviderResponse,
  SummaryV2LocalizationValidation,
  SummaryV2LocalizationSource,
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
