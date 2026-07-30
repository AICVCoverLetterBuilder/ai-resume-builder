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
export type { RunSummaryV2Options } from './pipeline';
export { compareSummaryV2AgainstLegacy } from './shadow';
export type { SummaryV2ShadowComparison } from './shadow';
