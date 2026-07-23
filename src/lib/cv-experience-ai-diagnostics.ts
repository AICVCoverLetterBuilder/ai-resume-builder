/**
 * Release-safe, non-PII Experience AI diagnostics for on-device incident traces.
 *
 * Never stores names, companies, emails, phones, titles, or CV/provider prose —
 * only metadata, lengths, one-way hashes, scripts, stages, and typed reasons.
 *
 * Does not change Experience validation, matching, fallback wording, or apply
 * behavior — observation only.
 */
import type { WorkExperience } from './types';
import { fingerprintText, resolveAppVersionInfo, resolveNextBuildId } from './cv-export-diagnostics';
import { extractSourceDutyUnits, sourceFactIdentitiesFromDescription } from './cv-source-fact-identity';
import { splitExperienceBullets } from './cv-canonical-facts';
import { getApiBaseUrl } from './api';
import type { AiGroundingResolution } from './cv-experience-job-context';
import type { FinalizeCvAiFieldResult } from './cv-ai-finalize-apply';
import {
  EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
  EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
} from './cv-ai-finalize-apply';
import {
  experienceAiSourcesEquivalent,
} from './cv-experience-ai-operation-snapshot';
void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
void EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION;
import { detectTextLocale } from './cv-content-locale';
import { resolveTargetScriptForLocale } from './cv-ai-unit-locale-purity';
import { hashExperienceEntryId } from './cv-experience-entry-isolation';
import type { Locale } from './i18n/translations';
import {
  appendCvAiDiagnosticHistory,
  assertCvAiDiagnosticPrivacy,
  buildCvAiDiagnosticBuildIdentity,
  checkExperienceDiagnosticCompleteness,
  checkExperienceDiagnosticInvariants,
  classifyApiHostClass,
  CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
  CV_AI_DIAGNOSTICS_V2_299_REVISION,
  EXPERIENCE_AI_DIAG_MARKER,
  EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION,
  maybeTruncateDiagnosticPayload,
  sanitizeCvAiDiagnosticMarkerPatch,
} from './cv-ai-diagnostics-contract';
import { INTERNAL_AI_RESET_ENABLED } from './build-channel';
import {
  emitCvAiDiagnosticsChanged,
  EXPERIENCE_AI_DIAG_STORAGE_KEY as EXPERIENCE_AI_DIAG_STORAGE_KEY_CANON,
} from './cv-ai-diagnostics-lifecycle';

/** Retain for AAB asset verification (must survive minification). */
void EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION;
void EXPERIENCE_AI_DIAG_MARKER;

export const EXPERIENCE_AI_TRACE_SCHEMA_VERSION = 1 as const;
export const EXPERIENCE_AI_DIAG_STORAGE_KEY = EXPERIENCE_AI_DIAG_STORAGE_KEY_CANON;

/**
 * Marker / UI strings for Experience AI diagnostics live only in
 * `CvExportDiagnosticsControls` behind INTERNAL_AI_RESET_ENABLED so production
 * DCE can omit them. This always-loaded module must not embed those literals.
 */

export type ExperienceAiDiagStageName =
  | 'button_pressed'
  | 'live_experience_read'
  | 'source_description_selected'
  | 'source_units_split'
  | 'job_context_built'
  | 'request_payload_built'
  | 'request_started'
  | 'api_response_received'
  | 'provider_output_parsed'
  | 'locale_validation'
  | 'source_fact_identity_created'
  | 'material_coverage_validation'
  | 'unsupported_claim_validation'
  | 'duplicate_validation'
  | 'tense_normalization'
  | 'perspective_normalization'
  | 'deterministic_fallback_started'
  | 'fallback_output_built'
  | 'fallback_locale_validation'
  | 'fallback_material_coverage'
  | 'final_apply_postcondition'
  | 'race_context_check'
  | 'visible_apply'
  | 'usage_increment';

export type ExperienceAiDiagStageResult = 'ok' | 'fail' | 'skipped';

export type ExperienceAiDiagStage = {
  stage: ExperienceAiDiagStageName;
  result: ExperienceAiDiagStageResult;
  typedReason?: string;
  requestIdHash?: string;
  currentJobContextHash?: string;
  originalRequestJobContextHash?: string;
};

export type ExperienceScriptClass =
  | 'latin'
  | 'latin_diacritic'
  | 'cyrillic'
  | 'devanagari'
  | 'arabic'
  | 'cjk'
  | 'mixed'
  | 'empty'
  | 'other';

export type ExperienceSelectedSourceKind =
  | 'currentTextarea'
  | 'liveUserDescription'
  | 'description'
  | 'originalUserDescription'
  | 'canonicalDescription'
  | 'canonicalSnapshot'
  | 'generatedDescription'
  | 'recovered_semantic_duties'
  | 'legacy_grounding'
  | 'deterministic_fallback_source'
  | 'grounding_resolution'
  | 'jobContext'
  | 'none'
  | 'unknown';

export type ExperienceApiHostClass =
  | 'vercel_production'
  | 'vercel_preview'
  | 'custom_https'
  | 'same_origin'
  | 'unknown';

export type ExperienceAiDiagnosticTrace = {
  schemaVersion: typeof EXPERIENCE_AI_TRACE_SCHEMA_VERSION;
  marker: string;
  capturedAt: string;
  appVersionCode: string | null;
  appVersionName: string | null;
  nextBuildId: string | null;
  responseDiagnosticMetadataVersion: number;
  requestedLocale: string;
  uiLocale: string;
  contentLocale: string | null;
  templateId: string;
  employmentState: 'current' | 'completed';
  selectedGender: string;
  sourceDescriptionPresent: boolean;
  sourceDescriptionLength: number;
  sourceDescriptionHash: string;
  sourceScript: ExperienceScriptClass;
  sourceUnitCount: number;
  sourceUnitLengths: number[];
  sourceUnitHashes: string[];
  sourceFactIdentityCount: number;
  selectedSourceKind: ExperienceSelectedSourceKind;
  selectedSourceLocale: string | null;
  selectedSourceHash: string;
  rejectedStaleSourceKinds: ExperienceSelectedSourceKind[];
  /** True only when the declared selected kind is also listed as rejected (should be rare/false). */
  selectedSourceActuallyRejected: boolean;
  detectedSourceLocale: string | null;
  storedSourceLocale: string | null;
  requestedTargetLocale: string | null;
  crossLocaleOperation: boolean;
  translationProviderAttempted: boolean;
  translationRepairAttempted: boolean;
  translationFallbackAttempted: boolean;
  translationFallbackApplied: boolean;
  translatedFactCount: number | null;
  targetLocaleValidationPassed: boolean | null;
  sourcePerspectiveMode: string | null;
  targetPerspectiveMode: string | null;
  targetContentApplied: boolean;
  contentLocaleUpdatedAfterApply: boolean;
  providerCoverageCount: number | null;
  fallbackCoverageCount: number | null;
  englishSourceStillAuthoritative: boolean;
  /** Explicit replacement for the misnamed englishSourceStillAuthoritative flag. */
  staleForeignLocaleSourceAuthoritative: boolean;
  selectedSourceLanguage: string | null;
  selectedSourceScript: string | null;
  liveTextSelected: boolean;
  selectedSourceMatchesLiveNormalized: boolean;
  selectedSourceDiffReason: string | null;
  canonicalFormattingOnlyDifference: boolean;
  operationSnapshotSourceKind: ExperienceSelectedSourceKind | null;
  currentTextareaIgnoredOrOverridden: boolean;
  liveTextHash: string;
  selectedSourceMatchesLiveText: boolean;
  selectedSourceMateriallyDiffersFromLiveText: boolean;
  selectedSourceEquivalentToLiveText: boolean;
  selectedSourceContextCurrent: boolean;
  payloadLocale: string;
  payloadIndustryNorm: string;
  payloadLevelNorm: string;
  payloadEmploymentState: 'current' | 'completed' | 'unknown';
  payloadSourceDescriptionLength: number;
  payloadSourceDescriptionHash: string;
  payloadSourceScript: ExperienceScriptClass;
  payloadSourceDutyCount: number;
  payloadJobContextHash: string;
  factLockEnabled: boolean;
  factLockReason: string | null;
  generationSourceKind: 'jobContext' | 'liveSource' | 'none' | null;
  generatedDescriptionPreexisted: boolean;
  staleGeneratedDescriptionIgnored: boolean;
  /** AAB-304: live textarea provenance vs last AI output. */
  currentTextareaProvenance?: string | null;
  authoritativeFactSourceKind?: string | null;
  currentTextareaUsedForFactExtraction?: boolean | null;
  lastAiOutputHashMatched?: boolean | null;
  materialUserEditDetected?: boolean | null;
  generationProviderValidationPassed: boolean | null;
  generationProviderRejectionReason: string | null;
  generationFinalPostconditionPassed: boolean | null;
  generationFallbackBuilderKind: string | null;
  generationFallbackFailureReason: string | null;
  apiHostClass: ExperienceApiHostClass;
  providerHttpStatus: number | null;
  providerResponseKind: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown';
  providerBulletCount: number;
  providerBulletScripts: ExperienceScriptClass[];
  providerLocaleValidationReason: string | null;
  requiredFactCount: number;
  coveredFactCount: number;
  uncoveredFactIdentityHashes: string[];
  /** Provider-candidate coverage (retained after fallback; never overwritten by final). */
  providerRequiredFactCount?: number | null;
  providerCoveredFactCount?: number | null;
  providerUncoveredFactIdentityHashes?: string[];
  providerAccepted?: boolean | null;
  providerRejectionStage?: string | null;
  providerRejectionReasons?: string[];
  providerUnsupportedClaimCount?: number | null;
  providerUnsupportedClaimKinds?: string[];
  /** Final-selected candidate hash after successful apply. */
  finalNormalizedHash?: string | null;
  experienceDiagnosticsFinalCandidateRevision?: string | null;
  /** Candidate lineage: provider / fallback / final_selected (hashes only). */
  candidateLineage?: Array<{
    candidateKind: string;
    present: boolean;
    accepted: boolean;
    hash?: string | null;
    normalizedHash?: string | null;
    unitCount?: number;
    unitHashes?: string[];
    coverageRequiredCount?: number | null;
    coverageCoveredCount?: number | null;
    uncoveredFactIdentityHashes?: string[];
    unsupportedClaimCount?: number;
    unsupportedClaimKinds?: string[];
    rejectionStage?: string | null;
    rejectionReasons?: string[];
    localeValidationPassed?: boolean | null;
    tenseValidationPassed?: boolean | null;
    perspectiveValidationPassed?: boolean | null;
    meaningfulChangeDetected?: boolean | null;
  }>;
  unsupportedClaimCount: number;
  duplicateBulletCount: number;
  tenseMode: 'present' | 'past' | 'unknown';
  perspectiveMode: 'cv_third_person' | null;
  sourcePersonMode: string | null;
  providerPersonMode: string | null;
  normalizedPersonMode: string | null;
  finalPersonMode: string | null;
  perspectiveNormalizationAttempted: boolean;
  perspectiveNormalizationApplied: boolean;
  perspectiveValidationPassed: boolean;
  normalizedBulletsUsedForApply: boolean;
  finalMatchesProviderOutput: boolean;
  finalMatchesSourceAfterNormalization: boolean;
  meaningfulChangeDetected: boolean;
  noOpRejected: boolean;
  providerNoOpDetected: boolean;
  noOpRepairAttempted: boolean;
  noOpRepairHttpStatus: number | null;
  noOpRepairValidationPassed: boolean | null;
  noOpRepairMeaningfulChangeDetected: boolean | null;
  noOpRepairApplied: boolean;
  noOpRepairUnsupportedClaimCount: number;
  noOpRepairUnsupportedClaimKinds: string[];
  noOpRepairScopeExpansionDetected: boolean;
  noOpRepairUniversalQuantifierDetected: boolean;
  noOpRepairResponsibilityEscalationDetected: boolean;
  noOpRepairRejectionReason: string | null;
  unsupportedClaimRepairAttempted: boolean;
  unsupportedClaimRepairKind: string | null;
  unsupportedClaimRepairValidationPassed: boolean | null;
  unsupportedClaimRepairApplied: boolean;
  unsupportedClaimRepairRejectionReason: string | null;
  unsupportedClaimRepairUnsupportedClaimCount: number;
  unsupportedClaimRepairUnsupportedClaimKinds: string[];
  unsupportedClaimRepairResidualUnsupportedClaimCount: number;
  unsupportedClaimRepairResidualUnsupportedClaimKinds: string[];
  unsupportedClaimRepairCoverageRequiredCount: number | null;
  unsupportedClaimRepairCoverageCoveredCount: number | null;
  unsupportedClaimRepairUncoveredFactIdentityHashes: string[];
  unsupportedClaimRepairHash: string | null;
  unsupportedClaimRepairNormalizedHash: string | null;
  experienceRepairLineageRevision: string | null;
  spanishExperienceRepairGroundingRevision: string | null;
  experiencePredicateRepairLineageRevision: string | null;
  spanishExperiencePredicateGroundingRevision: string | null;
  sourcePredicateIdentityCount: number;
  candidatePredicateIdentityCount: number;
  candidateAddedPredicateCount: number;
  candidateAddedPredicateIdentityHashes: string[];
  unsupportedPredicateKindCount: number;
  coordinatedPredicateExpansionDetected: boolean;
  sourceUnitPredicateCoveragePassed: boolean | null;
  repairResidualAddedPredicateCount: number;
  repairResidualAddedPredicateIdentityHashes: string[];
  providerSourcePredicateIdentityCount: number;
  providerCandidatePredicateIdentityCount: number;
  providerCandidateAddedPredicateCount: number;
  providerCandidateAddedPredicateIdentityHashes: string[];
  providerCoordinatedPredicateExpansionDetected: boolean;
  providerSourceUnitPredicateCoveragePassed: boolean | null;
  repairCandidatePredicateIdentityCount: number;
  repairCoordinatedPredicateExpansionDetected: boolean;
  repairSourceUnitPredicateCoveragePassed: boolean | null;
  finalCandidatePredicateIdentityCount: number;
  finalAddedPredicateCount: number;
  finalAddedPredicateIdentityHashes: string[];
  finalCoordinatedPredicateExpansionDetected: boolean;
  finalSourceUnitPredicateCoveragePassed: boolean | null;
  providerComplianceScopeExpansionDetected: boolean;
  providerComplianceExpansionKindCount: number;
  repairResidualComplianceScopeExpansionDetected: boolean;
  finalComplianceScopeExpansionDetected: boolean;
  factAuthorityKind: string | null;
  visibleComparisonSourceKind: string | null;
  visibleComparisonHash: string | null;
  visibleComparisonNormalizedHash: string | null;
  visibleComparisonUnitCount: number;
  visibleComparisonProvenance: string | null;
  visibleComparisonMatchedLastAiOutput: boolean;
  visibleComparisonUsedForNoOp: boolean;
  visibleComparisonUsedForDegradationCheck: boolean;
  finalMatchesVisibleComparisonAfterNormalization: boolean;
  finalSemanticallyEquivalentToVisibleComparison: boolean;
  semanticNoOpDetected: boolean;
  semanticNoOpReason: string | null;
  materialImprovementDetected: boolean;
  materialImprovementKinds: string[];
  degradationDetected: boolean;
  degradationKinds: string[];
  experienceVisibleNoopAuthorityRevision: string | null;
  spanishExperienceComplianceGroundingRevision: string | null;
  experiencePredicatePhaseDiagnosticsRevision: string | null;
  deterministicFallbackAttemptedAfterNoOp: boolean;
  deterministicFallbackAppliedAfterNoOp: boolean;
  finalCandidateSource: string | null;
  finalUnsupportedClaimCount: number;
  finalUnsupportedClaimKinds: string[];
  visibleTextareaMatchesFinalNormalizedHash: boolean | null;
  /** @deprecated Prefer apiResponseKind + clientDeterministicFallback* */
  fallbackSelected: boolean;
  fallbackReason: string | null;
  fallbackBulletCount: number;
  fallbackBulletScripts: ExperienceScriptClass[];
  fallbackRequiredFactCount: number;
  fallbackCoveredFactCount: number;
  apiResponseKind: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown';
  serverFallbackUsed: boolean;
  clientDeterministicFallbackAttempted: boolean;
  clientDeterministicFallbackReason: string | null;
  clientDeterministicFallbackBulletCount: number;
  clientDeterministicFallbackScripts: ExperienceScriptClass[];
  clientDeterministicFallbackRequiredFactCount: number;
  clientDeterministicFallbackCoveredFactCount: number;
  clientDeterministicFallbackApplied: boolean;
  clientDeterministicFallbackUncoveredFactIds: string[];
  operationMode: 'generate_from_job_context' | 'enhance_existing_description' | null;
  sourceWasEmpty: boolean;
  sourceFactCount: number;
  generationContextPresent: boolean;
  generationProviderAttempted: boolean;
  generationRepairAttempted: boolean;
  generationFallbackAttempted: boolean;
  generationFallbackApplied: boolean;
  generatedBulletCount: number;
  generatedBulletScripts: ExperienceScriptClass[];
  relevanceValidationPassed: boolean;
  /** Alias kept alongside perspectiveValidationPassed for generation mode. */
  tenseValidationPassed: boolean;
  visibleApplySucceeded: boolean;
  finalBulletCount: number;
  finalBulletScripts: ExperienceScriptClass[];
  finalTypedFailureReason: string | null;
  rejectionStage: string | null;
  raceGuardResult: 'ok' | 'fail' | 'skipped';
  countedAsSuccess: boolean;
  usageCountBefore: number;
  usageCountAfter: number;
  /** Entry / locale purity (build 271/272) — hashed IDs only. */
  clickedExperienceEntryIdHash: string | null;
  snapshotExperienceEntryIdHash: string | null;
  payloadExperienceEntryIdHash: string | null;
  selectedExperienceEntryIdHash: string | null;
  operationSnapshotExperienceEntryIdHash: string | null;
  appliedExperienceEntryIdHash: string | null;
  sourceFactsEntryIdHash: string | null;
  canonicalFactsEntryIdHash: string | null;
  fallbackFactsEntryIdHash: string | null;
  providerTargetEntryIdHash: string | null;
  fallbackTargetEntryIdHash: string | null;
  clickedEmploymentState: 'current' | 'completed' | 'unknown' | null;
  appliedEmploymentState: 'current' | 'completed' | 'unknown' | null;
  arrayIndexAtRequest: number | null;
  arrayIndexAtApply: number | null;
  stableEntryIdentityMatched: boolean | null;
  targetEntryStillExists: boolean | null;
  entryContextMatchedAtApply: boolean | null;
  targetLocale: string | null;
  targetScript: string | null;
  detectedLocaleByBullet: Array<string | null>;
  detectedScriptByBullet: string[];
  wrongLocaleBulletCount: number;
  wrongScriptBulletCount: number;
  mixedLanguageBulletCount: number;
  sourceLanguageLeakageDetected: boolean;
  targetLocalePurityPassed: boolean | null;
  crossEntryCandidateFactCount: number;
  crossEntryLeakageDetected: boolean;
  crossDomainLeakageDetected: boolean;
  leakedFromExperienceEntryIdHashes: string[];
  entryScopedCanonicalStorageUsed: boolean | null;
  responseRejectedForEntryMismatch: boolean;
  responseRejectedForLocaleImpurity: boolean;
  responseRejectedForDomainMismatch: boolean;
  stages: ExperienceAiDiagStage[];
  requestIdHash: string;
  originalRequestJobContextHash: string;
  currentJobContextHash: string | null;
  /** cv-ai-diagnostics-v2 additive */
  diagnosticContractRevision?: string;
  compiledDiagnosticMarker?: string;
  assetRevision?: string;
  internalDiagnosticsEnabled?: boolean;
  internalResetEnabled?: boolean;
  internalBuildContractUsed?: boolean | null;
  serverUrlConfigured?: boolean;
  sourceCommitShort?: string | null;
  operationKind?: 'experience';
  buildChannel?: string | null;
  diagnosticInvariantCheckPassed?: boolean;
  diagnosticInvariantFailureCount?: number;
  diagnosticInvariantFailures?: Array<{
    invariantCode: string;
    observed: Record<string, string | number | boolean | null>;
  }>;
  diagnosticCompletenessPassed?: boolean;
  missingRequiredDiagnosticFields?: string[];
  nullRequiredDiagnosticFields?: string[];
  diagnosticPayloadByteSize?: number;
  diagnosticPayloadTruncated?: boolean;
  privacyCheckPassed?: boolean;
  diagnosticPrivacyViolations?: string[];
  visibleDescriptionMatchesFinalHash?: boolean | null;
};

let latestTrace: ExperienceAiDiagnosticTrace | null = null;

export function hashRequestId(requestId: string): string {
  return fingerprintText(requestId || '');
}

export function classifyExperienceScript(text: string): ExperienceScriptClass {
  const t = (text || '').trim();
  if (!t) return 'empty';
  const scripts: ExperienceScriptClass[] = [];
  if (/[A-Za-z]/.test(t)) scripts.push('latin');
  if (/[čćžšđČĆŽŠĐ]/.test(t)) scripts.push('latin_diacritic');
  if (/\p{Script=Cyrillic}/u.test(t)) scripts.push('cyrillic');
  if (/\p{Script=Devanagari}/u.test(t)) scripts.push('devanagari');
  if (/\p{Script=Arabic}/u.test(t)) scripts.push('arabic');
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) scripts.push('cjk');
  if (scripts.length === 0) return 'other';
  if (scripts.length === 1) return scripts[0];
  if (scripts.includes('latin_diacritic') && scripts.every((s) => s === 'latin' || s === 'latin_diacritic')) {
    return 'latin_diacritic';
  }
  return 'mixed';
}

export function classifyApiHostForDiagnostics(): ExperienceApiHostClass {
  try {
    const base = getApiBaseUrl();
    if (!base) return 'same_origin';
    const u = new URL(base);
    if (u.hostname.endsWith('.vercel.app')) {
      if (u.hostname.includes('-git-')) return 'vercel_preview';
      return 'vercel_production';
    }
    if (u.protocol === 'https:') return 'custom_https';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function inferLocaleHintFromScript(
  script: ExperienceScriptClass,
  requestedLocale?: string | null,
): string | null {
  const loc = (requestedLocale || '').trim();
  const scriptTag = (() => {
    switch (script) {
      case 'devanagari': return 'devanagari';
      case 'arabic': return 'arabic';
      case 'cjk': return 'cjk';
      case 'cyrillic': return 'cyrillic';
      case 'latin_diacritic': return 'latin';
      case 'latin': return 'latin';
      default: return null;
    }
  })();
  if (loc && scriptTag) return `${loc}|${scriptTag}`;
  switch (script) {
    case 'devanagari': return 'hi';
    case 'arabic': return 'ar';
    case 'cjk': return 'ja';
    case 'cyrillic': return 'sr|ru';
    case 'latin_diacritic': return 'sr|latin';
    case 'latin': return loc ? `${loc}|latin` : null;
    default: return null;
  }
}

type SourceCandidate = {
  kind: ExperienceSelectedSourceKind;
  text: string;
};

function candidateSources(exp: WorkExperience): SourceCandidate[] {
  const recovered = (exp.recoveredSemanticDuties || [])
    .map((d) => {
      const row = d as { label?: string; text?: string; key?: string };
      return row.label || row.text || '';
    })
    .filter(Boolean)
    .join('\n');
  const candidates: SourceCandidate[] = [
    { kind: 'currentTextarea', text: (exp.description || '').trim() },
    { kind: 'description', text: (exp.description || '').trim() },
    { kind: 'originalUserDescription', text: (exp.originalUserDescription || '').trim() },
    { kind: 'canonicalDescription', text: (exp.canonicalDescription || '').trim() },
    { kind: 'generatedDescription', text: (exp.generatedDescription || '').trim() },
    { kind: 'recovered_semantic_duties', text: recovered },
    {
      kind: 'legacy_grounding',
      text: exp.groundingRecoverySource
        ? (exp.canonicalDescription || exp.description || '').trim()
        : '',
    },
  ];
  return candidates.filter((c) => c.text.length > 0);
}

/**
 * Observe which grounding source won — does not change selection logic.
 */
export function diagnoseExperienceSourceSelection(
  exp: WorkExperience,
  selectedText: string,
  groundingSource: AiGroundingResolution['groundingSource'],
  options?: {
    requestedLocale?: string | null;
    storedContentLocale?: string | null;
    contentLocale?: string | null;
    generatedLocale?: string | null;
    selectedSourceKindHint?: ExperienceSelectedSourceKind;
  },
): Pick<
  ExperienceAiDiagnosticTrace,
  | 'selectedSourceKind'
  | 'selectedSourceLocale'
  | 'selectedSourceHash'
  | 'rejectedStaleSourceKinds'
  | 'englishSourceStillAuthoritative'
  | 'staleForeignLocaleSourceAuthoritative'
  | 'selectedSourceLanguage'
  | 'selectedSourceScript'
  | 'liveTextSelected'
  | 'selectedSourceMatchesLiveNormalized'
  | 'selectedSourceDiffReason'
  | 'canonicalFormattingOnlyDifference'
  | 'operationSnapshotSourceKind'
  | 'currentTextareaIgnoredOrOverridden'
  | 'liveTextHash'
  | 'selectedSourceMatchesLiveText'
  | 'selectedSourceMateriallyDiffersFromLiveText'
  | 'selectedSourceEquivalentToLiveText'
  | 'selectedSourceContextCurrent'
> {
  const selected = (selectedText || '').trim();
  const selectedHash = fingerprintText(selected);
  const candidates = candidateSources(exp);
  const match = candidates.find((c) => fingerprintText(c.text) === selectedHash);

  let selectedSourceKind: ExperienceSelectedSourceKind =
    options?.selectedSourceKindHint || match?.kind || 'unknown';
  if (!selected) {
    selectedSourceKind = options?.selectedSourceKindHint === 'jobContext'
      ? 'jobContext'
      : 'none';
  } else if (!match && !options?.selectedSourceKindHint) {
    if (groundingSource === 'excluded_stale') selectedSourceKind = 'none';
    else if (groundingSource === 'genuine_user' || groundingSource === 'same_context_generated') {
      selectedSourceKind = 'grounding_resolution';
    }
  }

  const textarea = (exp.description || '').trim();
  const textareaHash = fingerprintText(textarea);
  const equivalentNormalized = Boolean(
    textarea && selected && experienceAiSourcesEquivalent(textarea, selected),
  );
  const selectedSourceMatchesLiveText = Boolean(
    textarea && selected && (textareaHash === selectedHash || equivalentNormalized),
  );

  // Formatting-only differences (bullets / CRLF) are NOT overrides.
  const currentTextareaIgnoredOrOverridden = Boolean(
    textarea
    && selected
    && !equivalentNormalized
    && textareaHash !== selectedHash,
  );

  const selectedScript = classifyExperienceScript(selected);
  const liveScript = classifyExperienceScript(textarea);
  // Serbian Latin must never be reported as "English authoritative".
  const staleForeignLocaleSourceAuthoritative = Boolean(
    currentTextareaIgnoredOrOverridden
    && selected
    && selectedScript === 'latin'
    && liveScript !== 'latin'
    && liveScript !== 'latin_diacritic'
    && liveScript !== 'empty'
    && liveScript !== 'other',
  );
  const englishSourceStillAuthoritative = staleForeignLocaleSourceAuthoritative;

  let selectedSourceLanguage: string | null = null;
  let selectedSourceScript: string | null = null;
  // Detect from actual selected text — never label Serbian Latin as English merely
  // because the UI/requested locale switched to en.
  const detectedFromText = detectTextLocale(selected, {
    storedLocale: options?.storedContentLocale || options?.contentLocale || null,
    generatedLocale: options?.generatedLocale || null,
  });
  const localeForHint =
    detectedFromText !== 'unknown'
      ? detectedFromText
      : (options?.storedContentLocale || options?.contentLocale || options?.requestedLocale || null);
  const localeHint = inferLocaleHintFromScript(selectedScript, localeForHint);
  if (localeHint?.includes('|')) {
    const [lang, script] = localeHint.split('|');
    selectedSourceLanguage = lang || null;
    selectedSourceScript = script || null;
  } else if (localeHint === 'hi') {
    selectedSourceLanguage = 'hi';
    selectedSourceScript = 'devanagari';
  } else if (selectedScript === 'latin_diacritic') {
    selectedSourceLanguage =
      detectedFromText !== 'unknown'
        ? detectedFromText
        : (options?.storedContentLocale || options?.requestedLocale || 'sr');
    selectedSourceScript = 'latin';
  } else if (selectedScript === 'latin') {
    selectedSourceLanguage =
      detectedFromText !== 'unknown'
        ? detectedFromText
        : (options?.storedContentLocale || options?.requestedLocale || null);
    selectedSourceScript = 'latin';
  }

  const canonical = (exp.canonicalDescription || '').trim();
  const canonicalFormattingOnlyDifference = Boolean(
    textarea
    && canonical
    && experienceAiSourcesEquivalent(textarea, canonical)
    && textarea !== canonical,
  );

  let selectedSourceDiffReason: string | null = null;
  if (!textarea) selectedSourceDiffReason = 'live_empty';
  else if (equivalentNormalized && textareaHash !== selectedHash) {
    selectedSourceDiffReason = 'canonical_formatting_only';
  } else if (currentTextareaIgnoredOrOverridden) {
    selectedSourceDiffReason = staleForeignLocaleSourceAuthoritative
      ? 'foreign_locale_override'
      : 'material_content';
  } else {
    selectedSourceDiffReason = 'none';
  }

  // Rejected = material competitors only. Never list the winning kind, and treat
  // currentTextarea/description aliases of the same live text as selected when
  // the live textarea matches the authoritative selection.
  const rejectedStaleSourceKinds = [...new Set(
    candidates
      .filter((c) => {
        if (fingerprintText(c.text) === selectedHash) return false;
        if (experienceAiSourcesEquivalent(c.text, selected)) return false;
        if (
          selectedSourceMatchesLiveText
          && (c.kind === 'currentTextarea' || c.kind === 'description')
        ) {
          return false;
        }
        return true;
      })
      .map((c) => c.kind),
  )].filter((k) => k !== selectedSourceKind);

  return {
    selectedSourceKind,
    selectedSourceLocale: localeHint,
    selectedSourceHash: selectedHash,
    rejectedStaleSourceKinds,
    englishSourceStillAuthoritative,
    staleForeignLocaleSourceAuthoritative,
    selectedSourceLanguage,
    selectedSourceScript,
    liveTextSelected: selectedSourceKind === 'currentTextarea'
      || selectedSourceKind === 'liveUserDescription'
      || (equivalentNormalized && !currentTextareaIgnoredOrOverridden),
    selectedSourceMatchesLiveNormalized: equivalentNormalized,
    selectedSourceDiffReason,
    canonicalFormattingOnlyDifference,
    operationSnapshotSourceKind: selectedSourceKind,
    currentTextareaIgnoredOrOverridden,
    liveTextHash: textarea ? textareaHash : 'empty',
    selectedSourceMatchesLiveText,
    selectedSourceMateriallyDiffersFromLiveText: currentTextareaIgnoredOrOverridden,
    selectedSourceEquivalentToLiveText: equivalentNormalized || selectedSourceMatchesLiveText,
    selectedSourceContextCurrent: groundingSource !== 'excluded_stale',
  };
}

function scriptsFromBullets(text: string): ExperienceScriptClass[] {
  return splitExperienceBullets(text || '')
    .map((b) => classifyExperienceScript(b));
}

function countDuplicateBullets(text: string): number {
  const norms = splitExperienceBullets(text || '')
    .map((b) => b.toLowerCase().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return Math.max(0, norms.length - new Set(norms).size);
}

export type ExperienceAiDiagSessionInput = {
  uiLocale: string;
  requestedLocale: string;
  contentLocale?: string | null;
  templateId: string;
  gender?: string;
  industryNorm?: string;
  levelNorm?: string;
  jobContextHash: string;
  requestId: string;
  usageCountBefore: number;
};

/**
 * Mutable session that records stages for one Experience AI button press.
 * Call `commit()` to persist (survives navigation / restart until next attempt).
 */
export class ExperienceAiDiagnosticSession {
  private stages: ExperienceAiDiagStage[] = [];
  private committedTrace: ExperienceAiDiagnosticTrace | null = null;
  private draft: Partial<ExperienceAiDiagnosticTrace> & {
    schemaVersion: typeof EXPERIENCE_AI_TRACE_SCHEMA_VERSION;
    capturedAt: string;
    requestIdHash: string;
    originalRequestJobContextHash: string;
  };

  constructor(input: ExperienceAiDiagSessionInput) {
    const requestIdHash = hashRequestId(input.requestId);
    this.draft = {
      schemaVersion: EXPERIENCE_AI_TRACE_SCHEMA_VERSION,
      marker: EXPERIENCE_AI_DIAG_MARKER,
      capturedAt: new Date().toISOString(),
      appVersionCode: null,
      appVersionName: null,
      nextBuildId: resolveNextBuildId(),
      responseDiagnosticMetadataVersion: EXPERIENCE_AI_TRACE_SCHEMA_VERSION,
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
      contentLocale: input.contentLocale ?? null,
      templateId: input.templateId || '',
      employmentState: 'current',
      selectedGender: String(input.gender || ''),
      sourceDescriptionPresent: false,
      sourceDescriptionLength: 0,
      sourceDescriptionHash: 'empty',
      sourceScript: 'empty',
      sourceUnitCount: 0,
      sourceUnitLengths: [],
      sourceUnitHashes: [],
      sourceFactIdentityCount: 0,
      selectedSourceKind: 'unknown',
      selectedSourceLocale: null,
      selectedSourceHash: 'empty',
      rejectedStaleSourceKinds: [],
      selectedSourceActuallyRejected: false,
      detectedSourceLocale: null,
      storedSourceLocale: null,
      requestedTargetLocale: null,
      crossLocaleOperation: false,
      translationProviderAttempted: false,
      translationRepairAttempted: false,
      translationFallbackAttempted: false,
      translationFallbackApplied: false,
      translatedFactCount: null,
      targetLocaleValidationPassed: null,
      sourcePerspectiveMode: null,
      targetPerspectiveMode: null,
      targetContentApplied: false,
      contentLocaleUpdatedAfterApply: false,
      providerCoverageCount: null,
      fallbackCoverageCount: null,
      englishSourceStillAuthoritative: false,
      staleForeignLocaleSourceAuthoritative: false,
      selectedSourceLanguage: null,
      selectedSourceScript: null,
      liveTextSelected: false,
      selectedSourceMatchesLiveNormalized: false,
      selectedSourceDiffReason: null,
      canonicalFormattingOnlyDifference: false,
      operationSnapshotSourceKind: null,
      currentTextareaIgnoredOrOverridden: false,
      liveTextHash: 'empty',
      selectedSourceMatchesLiveText: false,
      selectedSourceMateriallyDiffersFromLiveText: false,
      selectedSourceEquivalentToLiveText: false,
      selectedSourceContextCurrent: true,
      payloadLocale: input.requestedLocale,
      payloadIndustryNorm: input.industryNorm || '',
      payloadLevelNorm: input.levelNorm || '',
      payloadEmploymentState: 'current',
      payloadSourceDescriptionLength: 0,
      payloadSourceDescriptionHash: 'empty',
      payloadSourceScript: 'empty',
      payloadSourceDutyCount: 0,
      payloadJobContextHash: input.jobContextHash,
      factLockEnabled: false,
      factLockReason: null,
      generationSourceKind: null,
      generatedDescriptionPreexisted: false,
      staleGeneratedDescriptionIgnored: false,
      currentTextareaProvenance: null,
      authoritativeFactSourceKind: null,
      currentTextareaUsedForFactExtraction: null,
      lastAiOutputHashMatched: null,
      materialUserEditDetected: null,
      generationProviderValidationPassed: null,
      generationProviderRejectionReason: null,
      generationFinalPostconditionPassed: null,
      generationFallbackBuilderKind: null,
      generationFallbackFailureReason: null,
      apiHostClass: classifyApiHostForDiagnostics(),
      providerHttpStatus: null,
      providerResponseKind: 'unknown',
      providerBulletCount: 0,
      providerBulletScripts: [],
      providerLocaleValidationReason: null,
      requiredFactCount: 0,
      coveredFactCount: 0,
      uncoveredFactIdentityHashes: [],
      unsupportedClaimCount: 0,
      duplicateBulletCount: 0,
      tenseMode: 'unknown',
      perspectiveMode: null,
      sourcePersonMode: null,
      providerPersonMode: null,
      normalizedPersonMode: null,
      finalPersonMode: null,
      perspectiveNormalizationAttempted: false,
      perspectiveNormalizationApplied: false,
      perspectiveValidationPassed: false,
      normalizedBulletsUsedForApply: false,
      finalMatchesProviderOutput: false,
      finalMatchesSourceAfterNormalization: false,
      meaningfulChangeDetected: false,
      noOpRejected: false,
      providerNoOpDetected: false,
      noOpRepairAttempted: false,
      noOpRepairHttpStatus: null,
      noOpRepairValidationPassed: null,
      noOpRepairMeaningfulChangeDetected: null,
      noOpRepairApplied: false,
      noOpRepairUnsupportedClaimCount: 0,
      noOpRepairUnsupportedClaimKinds: [],
      noOpRepairScopeExpansionDetected: false,
      noOpRepairUniversalQuantifierDetected: false,
      noOpRepairResponsibilityEscalationDetected: false,
      noOpRepairRejectionReason: null,
      unsupportedClaimRepairAttempted: false,
      unsupportedClaimRepairKind: null,
      unsupportedClaimRepairValidationPassed: null,
      unsupportedClaimRepairApplied: false,
      unsupportedClaimRepairRejectionReason: null,
      unsupportedClaimRepairUnsupportedClaimCount: 0,
      unsupportedClaimRepairUnsupportedClaimKinds: [],
      unsupportedClaimRepairResidualUnsupportedClaimCount: 0,
      unsupportedClaimRepairResidualUnsupportedClaimKinds: [],
      unsupportedClaimRepairCoverageRequiredCount: null,
      unsupportedClaimRepairCoverageCoveredCount: null,
      unsupportedClaimRepairUncoveredFactIdentityHashes: [],
      unsupportedClaimRepairHash: null,
      unsupportedClaimRepairNormalizedHash: null,
      experienceRepairLineageRevision: null,
      spanishExperienceRepairGroundingRevision: null,
      experiencePredicateRepairLineageRevision: null,
      spanishExperiencePredicateGroundingRevision: null,
      sourcePredicateIdentityCount: 0,
      candidatePredicateIdentityCount: 0,
      candidateAddedPredicateCount: 0,
      candidateAddedPredicateIdentityHashes: [],
      unsupportedPredicateKindCount: 0,
      coordinatedPredicateExpansionDetected: false,
      sourceUnitPredicateCoveragePassed: null,
      repairResidualAddedPredicateCount: 0,
      repairResidualAddedPredicateIdentityHashes: [],
      providerSourcePredicateIdentityCount: 0,
      providerCandidatePredicateIdentityCount: 0,
      providerCandidateAddedPredicateCount: 0,
      providerCandidateAddedPredicateIdentityHashes: [],
      providerCoordinatedPredicateExpansionDetected: false,
      providerSourceUnitPredicateCoveragePassed: null,
      repairCandidatePredicateIdentityCount: 0,
      repairCoordinatedPredicateExpansionDetected: false,
      repairSourceUnitPredicateCoveragePassed: null,
      finalCandidatePredicateIdentityCount: 0,
      finalAddedPredicateCount: 0,
      finalAddedPredicateIdentityHashes: [],
      finalCoordinatedPredicateExpansionDetected: false,
      finalSourceUnitPredicateCoveragePassed: null,
      providerComplianceScopeExpansionDetected: false,
      providerComplianceExpansionKindCount: 0,
      repairResidualComplianceScopeExpansionDetected: false,
      finalComplianceScopeExpansionDetected: false,
      factAuthorityKind: null,
      visibleComparisonSourceKind: null,
      visibleComparisonHash: null,
      visibleComparisonNormalizedHash: null,
      visibleComparisonUnitCount: 0,
      visibleComparisonProvenance: null,
      visibleComparisonMatchedLastAiOutput: false,
      visibleComparisonUsedForNoOp: false,
      visibleComparisonUsedForDegradationCheck: false,
      finalMatchesVisibleComparisonAfterNormalization: false,
      finalSemanticallyEquivalentToVisibleComparison: false,
      semanticNoOpDetected: false,
      semanticNoOpReason: null,
      materialImprovementDetected: false,
      materialImprovementKinds: [],
      degradationDetected: false,
      degradationKinds: [],
      experienceVisibleNoopAuthorityRevision: null,
      spanishExperienceComplianceGroundingRevision: null,
      experiencePredicatePhaseDiagnosticsRevision: null,
      deterministicFallbackAttemptedAfterNoOp: false,
      deterministicFallbackAppliedAfterNoOp: false,
      finalCandidateSource: null,
      finalUnsupportedClaimCount: 0,
      finalUnsupportedClaimKinds: [],
      visibleTextareaMatchesFinalNormalizedHash: null,
      fallbackSelected: false,
      fallbackReason: null,
      fallbackBulletCount: 0,
      fallbackBulletScripts: [],
      fallbackRequiredFactCount: 0,
      fallbackCoveredFactCount: 0,
      apiResponseKind: 'unknown',
      serverFallbackUsed: false,
      clientDeterministicFallbackAttempted: false,
      clientDeterministicFallbackReason: null,
      clientDeterministicFallbackBulletCount: 0,
      clientDeterministicFallbackScripts: [],
      clientDeterministicFallbackRequiredFactCount: 0,
      clientDeterministicFallbackCoveredFactCount: 0,
      clientDeterministicFallbackApplied: false,
      clientDeterministicFallbackUncoveredFactIds: [],
      operationMode: null,
      sourceWasEmpty: false,
      sourceFactCount: 0,
      generationContextPresent: false,
      generationProviderAttempted: false,
      generationRepairAttempted: false,
      generationFallbackAttempted: false,
      generationFallbackApplied: false,
      generatedBulletCount: 0,
      generatedBulletScripts: [],
      relevanceValidationPassed: false,
      tenseValidationPassed: false,
      visibleApplySucceeded: false,
      finalBulletCount: 0,
      finalBulletScripts: [],
      finalTypedFailureReason: null,
      rejectionStage: null,
      raceGuardResult: 'skipped',
      countedAsSuccess: false,
      usageCountBefore: input.usageCountBefore,
      usageCountAfter: input.usageCountBefore,
      clickedExperienceEntryIdHash: null,
      snapshotExperienceEntryIdHash: null,
      payloadExperienceEntryIdHash: null,
      selectedExperienceEntryIdHash: null,
      operationSnapshotExperienceEntryIdHash: null,
      appliedExperienceEntryIdHash: null,
      sourceFactsEntryIdHash: null,
      canonicalFactsEntryIdHash: null,
      fallbackFactsEntryIdHash: null,
      providerTargetEntryIdHash: null,
      fallbackTargetEntryIdHash: null,
      clickedEmploymentState: null,
      appliedEmploymentState: null,
      arrayIndexAtRequest: null,
      arrayIndexAtApply: null,
      stableEntryIdentityMatched: null,
      targetEntryStillExists: null,
      entryContextMatchedAtApply: null,
      targetLocale: null,
      targetScript: null,
      detectedLocaleByBullet: [],
      detectedScriptByBullet: [],
      wrongLocaleBulletCount: 0,
      wrongScriptBulletCount: 0,
      mixedLanguageBulletCount: 0,
      sourceLanguageLeakageDetected: false,
      targetLocalePurityPassed: null,
      crossEntryCandidateFactCount: 0,
      crossEntryLeakageDetected: false,
      crossDomainLeakageDetected: false,
      leakedFromExperienceEntryIdHashes: [],
      entryScopedCanonicalStorageUsed: null,
      responseRejectedForEntryMismatch: false,
      responseRejectedForLocaleImpurity: false,
      responseRejectedForDomainMismatch: false,
      requestIdHash,
      originalRequestJobContextHash: input.jobContextHash,
      currentJobContextHash: input.jobContextHash,
    };
  }

  stage(
    name: ExperienceAiDiagStageName,
    result: ExperienceAiDiagStageResult,
    typedReason?: string,
    hashes?: { requestIdHash?: string; currentJobContextHash?: string },
  ): void {
    this.stages.push({
      stage: name,
      result,
      typedReason,
      requestIdHash: hashes?.requestIdHash || this.draft.requestIdHash,
      currentJobContextHash: hashes?.currentJobContextHash
        || this.draft.currentJobContextHash
        || undefined,
      originalRequestJobContextHash: this.draft.originalRequestJobContextHash,
    });
    // Keep the earliest typed rejection (do not overwrite with later not_applied).
    if (result === 'fail' && typedReason && !this.draft.finalTypedFailureReason) {
      this.draft.finalTypedFailureReason = typedReason;
      this.draft.rejectionStage = name;
    } else if (result === 'fail' && typedReason && !this.draft.rejectionStage) {
      this.draft.rejectionStage = name;
    }
  }

  patch(partial: Partial<ExperienceAiDiagnosticTrace>): void {
    const { marker: _ignoredMarker, ...safe } = partial;
    Object.assign(this.draft, safe);
    const markerPatch = sanitizeCvAiDiagnosticMarkerPatch('experience', partial);
    if (markerPatch.marker) this.draft.marker = markerPatch.marker;
    // Stable Experience marker is local-owned; never accept empty/foreign markers.
    if (!this.draft.marker || this.draft.marker !== EXPERIENCE_AI_DIAG_MARKER) {
      this.draft.marker = EXPERIENCE_AI_DIAG_MARKER;
    }
  }

  recordLiveExperience(_exp: WorkExperience, isPresent: boolean): void {
    const entryHash = hashExperienceEntryId(_exp?.id);
    const employmentState = isPresent ? 'current' as const : 'completed' as const;
    this.patch({
      employmentState,
      tenseMode: isPresent ? 'present' : 'past',
      payloadEmploymentState: employmentState,
      clickedEmploymentState: employmentState,
      clickedExperienceEntryIdHash: entryHash,
      snapshotExperienceEntryIdHash: entryHash,
      payloadExperienceEntryIdHash: entryHash,
      selectedExperienceEntryIdHash: entryHash,
      sourceFactsEntryIdHash: entryHash,
      providerTargetEntryIdHash: entryHash,
      fallbackTargetEntryIdHash: entryHash,
    });
    this.stage('live_experience_read', 'ok');
  }

  recordExperienceEntryTarget(opts: {
    experienceEntryId: string;
    isPresent: boolean;
    arrayIndexAtRequest?: number | null;
  }): void {
    const entryHash = hashExperienceEntryId(opts.experienceEntryId);
    const employmentState = opts.isPresent ? 'current' as const : 'completed' as const;
    this.patch({
      clickedExperienceEntryIdHash: entryHash,
      snapshotExperienceEntryIdHash: entryHash,
      payloadExperienceEntryIdHash: entryHash,
      selectedExperienceEntryIdHash: entryHash,
      sourceFactsEntryIdHash: entryHash,
      canonicalFactsEntryIdHash: entryHash,
      fallbackFactsEntryIdHash: entryHash,
      providerTargetEntryIdHash: entryHash,
      fallbackTargetEntryIdHash: entryHash,
      operationSnapshotExperienceEntryIdHash: entryHash,
      clickedEmploymentState: employmentState,
      payloadEmploymentState: employmentState,
      employmentState,
      tenseMode: opts.isPresent ? 'present' : 'past',
      arrayIndexAtRequest: opts.arrayIndexAtRequest ?? this.draft.arrayIndexAtRequest,
    });
  }

  recordSourceSelection(
    exp: WorkExperience,
    grounding: AiGroundingResolution,
    options?: {
      requestedLocale?: string | null;
      selectedSourceKindHint?: ExperienceSelectedSourceKind;
      operationalContentLocale?: string | null;
      generationSourceKind?: ExperienceAiDiagnosticTrace['generationSourceKind'];
      generatedDescriptionPreexisted?: boolean;
      staleGeneratedDescriptionIgnored?: boolean;
      factLockReason?: string | null;
      currentTextareaProvenance?: string | null;
      authoritativeFactSourceKind?: string | null;
      currentTextareaUsedForFactExtraction?: boolean | null;
      lastAiOutputHashMatched?: boolean | null;
      materialUserEditDetected?: boolean | null;
    },
  ): void {
    const selected = (grounding.sourceDescription || '').trim();
    const units = extractSourceDutyUnits(selected);
    const identities = sourceFactIdentitiesFromDescription(selected);
    const generationMode = options?.selectedSourceKindHint === 'jobContext'
      || options?.generationSourceKind === 'jobContext'
      || !selected;
    const selection = diagnoseExperienceSourceSelection(
      exp,
      selected,
      grounding.groundingSource,
      {
        requestedLocale: options?.requestedLocale || this.draft.requestedLocale,
        storedContentLocale: options?.operationalContentLocale || this.draft.contentLocale,
        contentLocale: this.draft.contentLocale,
        generatedLocale: (exp as WorkExperience & { generatedLocale?: string }).generatedLocale || null,
        selectedSourceKindHint: options?.selectedSourceKindHint,
      },
    );
    const rejectedStale: ExperienceSelectedSourceKind[] = [
      ...(selection.rejectedStaleSourceKinds || []),
    ];
    if (options?.staleGeneratedDescriptionIgnored) {
      if (!rejectedStale.includes('generatedDescription')) rejectedStale.push('generatedDescription');
      if (!rejectedStale.includes('canonicalDescription')) rejectedStale.push('canonicalDescription');
    }
    this.patch({
      sourceDescriptionPresent: Boolean(selected),
      sourceDescriptionLength: selected.length,
      sourceDescriptionHash: fingerprintText(selected),
      sourceScript: classifyExperienceScript(selected),
      sourceUnitCount: units.length,
      sourceUnitLengths: units.map((u) => u.length),
      sourceUnitHashes: units.map((u) => fingerprintText(u)),
      sourceFactIdentityCount: identities.length,
      requiredFactCount: identities.length,
      sourceFactCount: identities.length,
      ...selection,
      operationSnapshotSourceKind: generationMode && !selected
        ? (options?.selectedSourceKindHint === 'jobContext' ? 'jobContext' : 'none')
        : selection.operationSnapshotSourceKind,
      rejectedStaleSourceKinds: rejectedStale,
      selectedSourceActuallyRejected: rejectedStale.includes(selection.selectedSourceKind),
      detectedSourceLocale: selection.selectedSourceLanguage,
      storedSourceLocale: options?.operationalContentLocale || this.draft.contentLocale || null,
      requestedTargetLocale: options?.requestedLocale || this.draft.requestedLocale || null,
      crossLocaleOperation: Boolean(
        selection.selectedSourceLanguage
        && (options?.requestedLocale || this.draft.requestedLocale)
        && selection.selectedSourceLanguage
          !== (options?.requestedLocale || this.draft.requestedLocale),
      ),
      factLockEnabled: Boolean(selected),
      factLockReason: options?.factLockReason
        ?? (selected ? 'non_empty_source' : 'generation_mode_empty_live'),
      generationSourceKind: options?.generationSourceKind
        ?? (selected ? 'liveSource' : 'jobContext'),
      generatedDescriptionPreexisted: Boolean(options?.generatedDescriptionPreexisted),
      staleGeneratedDescriptionIgnored: Boolean(options?.staleGeneratedDescriptionIgnored),
      currentTextareaProvenance: options?.currentTextareaProvenance ?? null,
      authoritativeFactSourceKind: options?.authoritativeFactSourceKind ?? null,
      currentTextareaUsedForFactExtraction:
        options?.currentTextareaUsedForFactExtraction ?? null,
      lastAiOutputHashMatched: options?.lastAiOutputHashMatched ?? null,
      materialUserEditDetected: options?.materialUserEditDetected ?? null,
      payloadSourceDescriptionLength: selected.length,
      payloadSourceDescriptionHash: fingerprintText(selected),
      payloadSourceScript: classifyExperienceScript(selected),
      payloadSourceDutyCount: units.length,
      sourceWasEmpty: !selected,
      operationMode: selected ? 'enhance_existing_description' : 'generate_from_job_context',
      generationContextPresent: !selected,
      ...(options?.operationalContentLocale
        ? { contentLocale: options.operationalContentLocale }
        : {}),
    });
    this.stage(
      'source_description_selected',
      selected || generationMode || grounding.groundingSource === 'excluded_stale' ? 'ok' : 'fail',
      selected
        ? undefined
        : (generationMode
          ? 'generation_job_context'
          : (grounding.groundingSource === 'excluded_stale' ? 'excluded_stale' : 'no_source')),
    );
    this.stage(
      'source_units_split',
      units.length > 0 ? 'ok' : (selected ? 'fail' : 'skipped'),
      units.length > 0 ? undefined : 'zero_units',
    );
    this.stage(
      'source_fact_identity_created',
      identities.length > 0 ? 'ok' : (selected ? 'fail' : 'skipped'),
      identities.length > 0 ? undefined : 'zero_identities',
    );
  }

  recordPayloadBuilt(opts: {
    locale: string;
    industryNorm: string;
    levelNorm: string;
    isPresent: boolean;
  }): void {
    this.patch({
      payloadLocale: opts.locale,
      payloadIndustryNorm: opts.industryNorm,
      payloadLevelNorm: opts.levelNorm,
      payloadEmploymentState: opts.isPresent ? 'current' : 'completed',
    });
    this.stage('job_context_built', 'ok');
    this.stage('request_payload_built', 'ok');
    this.stage('request_started', 'ok');
  }

  recordApiResponse(opts: {
    httpStatus: number | null;
    repairAttempted?: boolean;
    fallbackUsed?: boolean;
    resultText?: string;
    errorCode?: string;
  }): void {
    const text = (opts.resultText || '').trim();
    let kind: ExperienceAiDiagnosticTrace['providerResponseKind'] = 'unknown';
    if (opts.errorCode || (opts.httpStatus != null && opts.httpStatus >= 400)) kind = 'error';
    else if (opts.fallbackUsed) kind = 'fallback';
    else if (opts.repairAttempted) kind = 'repair';
    else if (!text) kind = 'empty';
    else kind = 'provider';

    this.patch({
      providerHttpStatus: opts.httpStatus,
      providerResponseKind: kind,
      apiResponseKind: kind,
      serverFallbackUsed: kind === 'fallback',
      providerBulletCount: splitExperienceBullets(text).filter(Boolean).length,
      providerBulletScripts: scriptsFromBullets(text),
      duplicateBulletCount: countDuplicateBullets(text),
    });
    this.stage(
      'api_response_received',
      kind === 'error' ? 'fail' : 'ok',
      opts.errorCode || (kind === 'error' ? 'http_error' : undefined),
    );
    this.stage(
      'provider_output_parsed',
      kind === 'error' ? 'fail' : 'ok',
      text ? undefined : (kind === 'empty' ? 'empty_result' : undefined),
    );
  }

  recordRaceCheck(ok: boolean, reason?: string, currentJobContextHash?: string): void {
    this.patch({
      raceGuardResult: ok ? 'ok' : 'fail',
      currentJobContextHash: currentJobContextHash || this.draft.currentJobContextHash,
    });
    this.stage(
      'race_context_check',
      ok ? 'ok' : 'fail',
      ok ? undefined : (reason || 'stale_request_or_context_mismatch'),
      { currentJobContextHash },
    );
  }

  /**
   * Map finalize result into validation / fallback / apply stages without
   * re-running validators (uses finalize diagnostics + reason only).
   */
  recordFinalizeResult(finalized: FinalizeCvAiFieldResult): void {
    const diag = finalized.diagnostics || {};
    const text = (finalized.text || '').trim();
    const bullets = splitExperienceBullets(text).filter(Boolean);
    const clientFallbackApplied = Boolean(
      diag.clientDeterministicFallbackApplied
      || (finalized.origin === 'deterministic_fallback' && finalized.countedAsSuccess),
    );
    const clientFallbackAttempted = Boolean(
      diag.clientDeterministicFallbackAttempted
      || clientFallbackApplied
      || diag.fallbackApplied,
    );
    const blocked = Boolean(finalized.blocked || !finalized.countedAsSuccess);
    const reason = finalized.reason || diag.typedFailureReason || null;
    const apiResponseKind = diag.apiResponseKind || this.draft.providerResponseKind || 'unknown';
    const serverFallbackUsed = Boolean(
      diag.serverFallbackUsed
      || this.draft.providerResponseKind === 'fallback',
    );

    const clientScripts = (
      (diag.clientDeterministicFallbackScripts as ExperienceScriptClass[] | undefined)?.length
        ? (diag.clientDeterministicFallbackScripts as ExperienceScriptClass[])
        : (clientFallbackApplied ? scriptsFromBullets(text) : [])
    );
    const clientBulletCount = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackBulletCount ?? diag.fallbackBulletCount ?? 0)
      : 0;
    const clientCovered = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackCoveredFactCount ?? 0)
      : 0;
    const clientRequired = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackRequiredFactCount
        ?? diag.requiredFactCount
        ?? this.draft.requiredFactCount
        ?? 0)
      : 0;
    const clientUncovered = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackUncoveredFactIds || [])
      : [];

    const providerUncovered = Array.isArray(diag.providerUncoveredFactIdentityHashes)
      ? diag.providerUncoveredFactIdentityHashes.map(String)
      : (this.draft.providerUncoveredFactIdentityHashes || []);
    const finalRequired = clientFallbackApplied
      ? (clientRequired || diag.requiredFactCount || this.draft.requiredFactCount || 0)
      : (diag.requiredFactCount ?? this.draft.requiredFactCount ?? 0);
    const finalCovered = clientFallbackApplied
      ? (clientCovered || diag.coveredFactCount || 0)
      : (diag.coveredFactCount ?? 0);
    const finalUncovered = clientFallbackApplied
      ? (clientUncovered.length ? clientUncovered : [])
      : (
        Array.isArray(diag.uncoveredFactIdentityHashes)
          ? diag.uncoveredFactIdentityHashes.map(String)
          : (providerUncovered.length && finalCovered < finalRequired
            ? [...providerUncovered]
            : (this.draft.uncoveredFactIdentityHashes || []))
      );
    // Top-level coverage always describes the FINAL selected candidate.
    // Provider evidence stays in provider* fields (never overwrite with final).
    this.patch({
      requiredFactCount: finalRequired,
      coveredFactCount: finalCovered,
      uncoveredFactIdentityHashes: finalUncovered,
      providerRequiredFactCount: diag.providerRequiredFactCount
        ?? this.draft.providerRequiredFactCount
        ?? null,
      providerCoveredFactCount: diag.providerCoveredFactCount
        ?? this.draft.providerCoveredFactCount
        ?? null,
      providerUncoveredFactIdentityHashes: providerUncovered,
      providerAccepted: diag.providerAccepted
        ?? (finalized.countedAsSuccess && !clientFallbackApplied && !diag.noOpRepairApplied),
      providerRejectionStage: (typeof diag.providerRejectionStage === 'string'
        && diag.providerRejectionStage)
        || (!diag.providerAccepted && (diag.rejectionStage || providerUncovered.length)
          ? (diag.rejectionStage || this.draft.providerRejectionStage || null)
          : (this.draft.providerRejectionStage ?? null)),
      providerRejectionReasons: !diag.providerAccepted && (
        reason
        || providerUncovered.length
        || (typeof diag.providerRejectionReason === 'string' && diag.providerRejectionReason)
        || (Array.isArray(diag.providerUnsupportedClaimKinds)
          && diag.providerUnsupportedClaimKinds.length > 0)
      )
        ? ([
          reason
          || diag.providerRejectionReason
          || diag.clientDeterministicFallbackReason
          || 'provider_rejected',
        ].filter(Boolean) as string[])
        : (this.draft.providerRejectionReasons || []),
      providerUnsupportedClaimCount: typeof diag.providerUnsupportedClaimCount === 'number'
        ? diag.providerUnsupportedClaimCount
        : (this.draft.providerUnsupportedClaimCount ?? null),
      providerUnsupportedClaimKinds: Array.isArray(diag.providerUnsupportedClaimKinds)
        ? diag.providerUnsupportedClaimKinds.map(String)
        : (this.draft.providerUnsupportedClaimKinds || []),
      finalNormalizedHash: (diag.finalNormalizedHash as string | undefined)
        ?? (finalized.countedAsSuccess ? fingerprintText(text) : null),
      visibleTextareaMatchesFinalNormalizedHash:
        typeof diag.visibleTextareaMatchesFinalNormalizedHash === 'boolean'
          ? diag.visibleTextareaMatchesFinalNormalizedHash
          : (this.draft.visibleTextareaMatchesFinalNormalizedHash ?? null),
      experienceDiagnosticsFinalCandidateRevision:
        (diag.experienceDiagnosticsFinalCandidateRevision as string | undefined)
        || this.draft.experienceDiagnosticsFinalCandidateRevision
        || null,
      apiResponseKind: apiResponseKind as ExperienceAiDiagnosticTrace['apiResponseKind'],
      serverFallbackUsed,
      // Legacy fields derived from the same client-fallback result (no contradictions).
      fallbackSelected: clientFallbackApplied,
      fallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'deterministic_fallback')
        : null,
      fallbackBulletCount: clientBulletCount,
      fallbackBulletScripts: clientScripts,
      fallbackRequiredFactCount: clientRequired,
      fallbackCoveredFactCount: clientCovered,
      clientDeterministicFallbackAttempted: clientFallbackAttempted,
      clientDeterministicFallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'provider_postcondition_failed')
        : null,
      clientDeterministicFallbackBulletCount: clientBulletCount,
      clientDeterministicFallbackScripts: clientScripts,
      clientDeterministicFallbackRequiredFactCount: clientRequired,
      clientDeterministicFallbackCoveredFactCount: clientCovered,
      clientDeterministicFallbackApplied: clientFallbackApplied,
      clientDeterministicFallbackUncoveredFactIds: clientUncovered,
      operationMode: (diag.operationMode as ExperienceAiDiagnosticTrace['operationMode']) || null,
      sourceWasEmpty: Boolean(diag.sourceWasEmpty),
      sourceFactCount: diag.sourceFactCount ?? this.draft.sourceFactIdentityCount ?? 0,
      generationContextPresent: Boolean(
        diag.sourceWasEmpty
        || diag.operationMode === 'generate_from_job_context',
      ),
      generationProviderAttempted: Boolean(
        diag.sourceWasEmpty && (apiResponseKind === 'provider' || apiResponseKind === 'repair' || apiResponseKind === 'fallback'),
      ),
      generationRepairAttempted: Boolean(diag.sourceWasEmpty && apiResponseKind === 'repair'),
      generationFallbackAttempted: Boolean(diag.generationFallbackAttempted),
      generationFallbackApplied: Boolean(diag.generationFallbackApplied),
      generatedBulletCount: diag.generatedBulletCount ?? (diag.sourceWasEmpty ? bullets.length : 0),
      generatedBulletScripts: diag.sourceWasEmpty ? scriptsFromBullets(text) : [],
      relevanceValidationPassed: Boolean(diag.relevanceValidationPassed),
      tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
      unsupportedClaimCount: Math.max(
        diag.unsupportedClaimCount ?? 0,
        reason === 'unsupported_claim' || reason === 'unsupported_generated_duty' ? 1 : 0,
      ),
      visibleApplySucceeded: Boolean(finalized.countedAsSuccess && !blocked),
      finalBulletCount: diag.finalBulletCount ?? bullets.length,
      finalBulletScripts: scriptsFromBullets(text),
      tenseMode: diag.tenseMode || this.draft.tenseMode || 'unknown',
      perspectiveMode: (diag.perspectiveMode as ExperienceAiDiagnosticTrace['perspectiveMode']) || 'cv_third_person',
      sourcePersonMode: (diag.sourcePersonMode as string | undefined) || null,
      providerPersonMode: (diag.providerPersonMode as string | undefined) || null,
      normalizedPersonMode: (diag.normalizedPersonMode as string | undefined) || null,
      finalPersonMode: (diag.finalPersonMode as string | undefined) || null,
      perspectiveNormalizationAttempted: Boolean(diag.perspectiveNormalizationAttempted),
      perspectiveNormalizationApplied: Boolean(diag.perspectiveNormalizationApplied),
      perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
      normalizedBulletsUsedForApply: Boolean(diag.normalizedBulletsUsedForApply),
      finalMatchesProviderOutput: Boolean(diag.finalMatchesProviderOutput),
      finalMatchesSourceAfterNormalization: Boolean(diag.finalMatchesSourceAfterNormalization),
      meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      noOpRejected: Boolean(diag.noOpRejected),
      providerNoOpDetected: Boolean(
        diag.providerNoOpDetected
        || diag.noOpRejected
        || reason === 'ai_no_meaningful_change'
        || reason === 'experience_ai_noop',
      ),
      noOpRepairAttempted: Boolean(diag.noOpRepairAttempted),
      noOpRepairValidationPassed: diag.noOpRepairValidationPassed ?? null,
      noOpRepairMeaningfulChangeDetected: diag.noOpRepairMeaningfulChangeDetected ?? null,
      noOpRepairApplied: Boolean(diag.noOpRepairApplied),
      noOpRepairUnsupportedClaimCount: Math.max(
        Number(diag.noOpRepairUnsupportedClaimCount ?? 0),
        Array.isArray(diag.noOpRepairUnsupportedClaimKinds)
          ? diag.noOpRepairUnsupportedClaimKinds.length
          : 0,
      ),
      noOpRepairUnsupportedClaimKinds: Array.isArray(diag.noOpRepairUnsupportedClaimKinds)
        ? diag.noOpRepairUnsupportedClaimKinds.map(String)
        : [],
      noOpRepairScopeExpansionDetected: Boolean(diag.noOpRepairScopeExpansionDetected),
      noOpRepairUniversalQuantifierDetected: Boolean(diag.noOpRepairUniversalQuantifierDetected),
      noOpRepairResponsibilityEscalationDetected: Boolean(
        diag.noOpRepairResponsibilityEscalationDetected,
      ),
      noOpRepairRejectionReason: (diag.noOpRepairRejectionReason as string | null | undefined) ?? null,
      unsupportedClaimRepairAttempted: Boolean(diag.unsupportedClaimRepairAttempted),
      unsupportedClaimRepairKind: (diag.unsupportedClaimRepairKind as string | null | undefined) ?? null,
      unsupportedClaimRepairValidationPassed: diag.unsupportedClaimRepairValidationPassed ?? null,
      unsupportedClaimRepairApplied: Boolean(diag.unsupportedClaimRepairApplied),
      unsupportedClaimRepairRejectionReason:
        (diag.unsupportedClaimRepairRejectionReason as string | null | undefined) ?? null,
      unsupportedClaimRepairUnsupportedClaimCount: Math.max(
        Number(diag.unsupportedClaimRepairUnsupportedClaimCount ?? 0),
        Array.isArray(diag.unsupportedClaimRepairUnsupportedClaimKinds)
          ? diag.unsupportedClaimRepairUnsupportedClaimKinds.length
          : 0,
      ),
      unsupportedClaimRepairUnsupportedClaimKinds: Array.isArray(
        diag.unsupportedClaimRepairUnsupportedClaimKinds,
      )
        ? diag.unsupportedClaimRepairUnsupportedClaimKinds.map(String)
        : [],
      unsupportedClaimRepairResidualUnsupportedClaimCount: Math.max(
        Number(diag.unsupportedClaimRepairResidualUnsupportedClaimCount ?? 0),
        Array.isArray(diag.unsupportedClaimRepairResidualUnsupportedClaimKinds)
          ? diag.unsupportedClaimRepairResidualUnsupportedClaimKinds.length
          : 0,
      ),
      unsupportedClaimRepairResidualUnsupportedClaimKinds: Array.isArray(
        diag.unsupportedClaimRepairResidualUnsupportedClaimKinds,
      )
        ? diag.unsupportedClaimRepairResidualUnsupportedClaimKinds.map(String)
        : [],
      unsupportedClaimRepairCoverageRequiredCount:
        diag.unsupportedClaimRepairCoverageRequiredCount ?? null,
      unsupportedClaimRepairCoverageCoveredCount:
        diag.unsupportedClaimRepairCoverageCoveredCount ?? null,
      unsupportedClaimRepairUncoveredFactIdentityHashes: Array.isArray(
        diag.unsupportedClaimRepairUncoveredFactIdentityHashes,
      )
        ? diag.unsupportedClaimRepairUncoveredFactIdentityHashes.map(String)
        : [],
      unsupportedClaimRepairHash: (diag.unsupportedClaimRepairHash as string | null | undefined) ?? null,
      unsupportedClaimRepairNormalizedHash:
        (diag.unsupportedClaimRepairNormalizedHash as string | null | undefined) ?? null,
      experienceRepairLineageRevision:
        (diag.experienceRepairLineageRevision as string | null | undefined)
        ?? EXPERIENCE_REPAIR_LINEAGE_309_REVISION,
      spanishExperienceRepairGroundingRevision:
        (diag.spanishExperienceRepairGroundingRevision as string | null | undefined) ?? null,
      experiencePredicateRepairLineageRevision:
        (diag.experiencePredicateRepairLineageRevision as string | null | undefined)
        ?? EXPERIENCE_PREDICATE_REPAIR_LINEAGE_310_REVISION,
      spanishExperiencePredicateGroundingRevision:
        (diag.spanishExperiencePredicateGroundingRevision as string | null | undefined) ?? null,
      sourcePredicateIdentityCount: Number(diag.sourcePredicateIdentityCount ?? 0),
      candidatePredicateIdentityCount: Number(diag.candidatePredicateIdentityCount ?? 0),
      candidateAddedPredicateCount: Number(diag.candidateAddedPredicateCount ?? 0),
      candidateAddedPredicateIdentityHashes: Array.isArray(
        diag.candidateAddedPredicateIdentityHashes,
      )
        ? diag.candidateAddedPredicateIdentityHashes.map(String)
        : [],
      unsupportedPredicateKindCount: Number(diag.unsupportedPredicateKindCount ?? 0),
      coordinatedPredicateExpansionDetected: Boolean(
        diag.coordinatedPredicateExpansionDetected,
      ),
      sourceUnitPredicateCoveragePassed: diag.sourceUnitPredicateCoveragePassed ?? null,
      repairResidualAddedPredicateCount: Number(diag.repairResidualAddedPredicateCount ?? 0),
      repairResidualAddedPredicateIdentityHashes: Array.isArray(
        diag.repairResidualAddedPredicateIdentityHashes,
      )
        ? diag.repairResidualAddedPredicateIdentityHashes.map(String)
        : [],
      providerSourcePredicateIdentityCount: Number(
        diag.providerSourcePredicateIdentityCount ?? diag.sourcePredicateIdentityCount ?? 0,
      ),
      providerCandidatePredicateIdentityCount: Number(
        diag.providerCandidatePredicateIdentityCount
        ?? diag.candidatePredicateIdentityCount
        ?? 0,
      ),
      providerCandidateAddedPredicateCount: Number(
        diag.providerCandidateAddedPredicateCount ?? diag.candidateAddedPredicateCount ?? 0,
      ),
      providerCandidateAddedPredicateIdentityHashes: Array.isArray(
        diag.providerCandidateAddedPredicateIdentityHashes,
      )
        ? diag.providerCandidateAddedPredicateIdentityHashes.map(String)
        : (Array.isArray(diag.candidateAddedPredicateIdentityHashes)
          ? diag.candidateAddedPredicateIdentityHashes.map(String)
          : []),
      providerCoordinatedPredicateExpansionDetected: Boolean(
        diag.providerCoordinatedPredicateExpansionDetected
        ?? diag.coordinatedPredicateExpansionDetected,
      ),
      providerSourceUnitPredicateCoveragePassed:
        diag.providerSourceUnitPredicateCoveragePassed
        ?? diag.sourceUnitPredicateCoveragePassed
        ?? null,
      repairCandidatePredicateIdentityCount: Number(
        diag.repairCandidatePredicateIdentityCount ?? 0,
      ),
      repairCoordinatedPredicateExpansionDetected: Boolean(
        diag.repairCoordinatedPredicateExpansionDetected,
      ),
      repairSourceUnitPredicateCoveragePassed:
        diag.repairSourceUnitPredicateCoveragePassed ?? null,
      finalCandidatePredicateIdentityCount: Number(
        diag.finalCandidatePredicateIdentityCount ?? 0,
      ),
      finalAddedPredicateCount: Number(diag.finalAddedPredicateCount ?? 0),
      finalAddedPredicateIdentityHashes: Array.isArray(diag.finalAddedPredicateIdentityHashes)
        ? diag.finalAddedPredicateIdentityHashes.map(String)
        : [],
      finalCoordinatedPredicateExpansionDetected: Boolean(
        diag.finalCoordinatedPredicateExpansionDetected,
      ),
      finalSourceUnitPredicateCoveragePassed:
        diag.finalSourceUnitPredicateCoveragePassed ?? null,
      providerComplianceScopeExpansionDetected: Boolean(
        diag.providerComplianceScopeExpansionDetected,
      ),
      providerComplianceExpansionKindCount: Number(
        diag.providerComplianceExpansionKindCount ?? 0,
      ),
      repairResidualComplianceScopeExpansionDetected: Boolean(
        diag.repairResidualComplianceScopeExpansionDetected,
      ),
      finalComplianceScopeExpansionDetected: Boolean(
        diag.finalComplianceScopeExpansionDetected,
      ),
      factAuthorityKind: (diag.factAuthorityKind as string | null | undefined) ?? null,
      visibleComparisonSourceKind:
        (diag.visibleComparisonSourceKind as string | null | undefined) ?? null,
      visibleComparisonHash: (diag.visibleComparisonHash as string | null | undefined) ?? null,
      visibleComparisonNormalizedHash:
        (diag.visibleComparisonNormalizedHash as string | null | undefined) ?? null,
      visibleComparisonUnitCount: Number(diag.visibleComparisonUnitCount ?? 0),
      visibleComparisonProvenance:
        (diag.visibleComparisonProvenance as string | null | undefined) ?? null,
      visibleComparisonMatchedLastAiOutput: Boolean(
        diag.visibleComparisonMatchedLastAiOutput,
      ),
      visibleComparisonUsedForNoOp: Boolean(diag.visibleComparisonUsedForNoOp),
      visibleComparisonUsedForDegradationCheck: Boolean(
        diag.visibleComparisonUsedForDegradationCheck,
      ),
      finalMatchesVisibleComparisonAfterNormalization: Boolean(
        diag.finalMatchesVisibleComparisonAfterNormalization,
      ),
      finalSemanticallyEquivalentToVisibleComparison: Boolean(
        diag.finalSemanticallyEquivalentToVisibleComparison,
      ),
      semanticNoOpDetected: Boolean(diag.semanticNoOpDetected),
      semanticNoOpReason: (diag.semanticNoOpReason as string | null | undefined) ?? null,
      materialImprovementDetected: Boolean(diag.materialImprovementDetected),
      materialImprovementKinds: Array.isArray(diag.materialImprovementKinds)
        ? diag.materialImprovementKinds.map(String)
        : [],
      degradationDetected: Boolean(diag.degradationDetected),
      degradationKinds: Array.isArray(diag.degradationKinds)
        ? diag.degradationKinds.map(String)
        : [],
      experienceVisibleNoopAuthorityRevision:
        (diag.experienceVisibleNoopAuthorityRevision as string | null | undefined) ?? null,
      spanishExperienceComplianceGroundingRevision:
        (diag.spanishExperienceComplianceGroundingRevision as string | null | undefined) ?? null,
      experiencePredicatePhaseDiagnosticsRevision:
        (diag.experiencePredicatePhaseDiagnosticsRevision as string | null | undefined) ?? null,
      deterministicFallbackAttemptedAfterNoOp: Boolean(
        diag.deterministicFallbackAttemptedAfterNoOp
        || (
          (diag.providerNoOpDetected || diag.noOpRejected)
          && clientFallbackAttempted
        ),
      ),
      deterministicFallbackAppliedAfterNoOp: Boolean(
        diag.deterministicFallbackAppliedAfterNoOp
        || (
          (diag.providerNoOpDetected || diag.noOpRejected)
          && clientFallbackApplied
        ),
      ),
      finalCandidateSource: (diag.finalCandidateSource as string | undefined)
        ?? (finalized.countedAsSuccess
          ? (clientFallbackApplied
            ? 'deterministic_fallback'
            : (diag.unsupportedClaimRepairApplied
              ? 'unsupported_claim_repair'
              : (diag.noOpRepairApplied ? 'noop_repair' : 'provider')))
          : 'none'),
      finalUnsupportedClaimCount: Math.max(
        Number(diag.finalUnsupportedClaimCount ?? 0),
        Array.isArray(diag.finalUnsupportedClaimKinds)
          ? diag.finalUnsupportedClaimKinds.length
          : 0,
        reason === 'unsupported_claim' || reason === 'unsupported_generated_duty' ? 1 : 0,
      ),
      finalUnsupportedClaimKinds: Array.isArray(diag.finalUnsupportedClaimKinds)
        ? diag.finalUnsupportedClaimKinds.map(String)
        : [],
      countedAsSuccess: Boolean(finalized.countedAsSuccess),
      finalTypedFailureReason: blocked ? reason : null,
      rejectionStage: blocked
        ? (diag.rejectionStage || this.draft.rejectionStage || 'final_apply_postcondition')
        : null,
      providerCoverageCount: diag.providerCoveredFactCount
        ?? this.draft.providerCoveredFactCount
        ?? this.draft.providerCoverageCount
        ?? null,
      fallbackCoverageCount: clientCovered || (diag.fallbackCoverageCount ?? null),
      detectedSourceLocale: (diag.detectedSourceLocale as string | undefined)
        ?? this.draft.detectedSourceLocale
        ?? null,
      storedSourceLocale: (diag.storedSourceLocale as string | undefined)
        ?? this.draft.storedSourceLocale
        ?? this.draft.contentLocale
        ?? null,
      requestedTargetLocale: (diag.requestedTargetLocale as string | undefined)
        ?? this.draft.requestedLocale
        ?? null,
      crossLocaleOperation: Boolean(
        diag.crossLocaleOperation ?? this.draft.crossLocaleOperation,
      ),
      translationProviderAttempted: Boolean(diag.translationProviderAttempted),
      translationRepairAttempted: Boolean(diag.translationRepairAttempted),
      translationFallbackAttempted: Boolean(
        diag.translationFallbackAttempted
        || diag.clientDeterministicFallbackReason === 'cross_locale_translation_fallback',
      ),
      translationFallbackApplied: Boolean(
        diag.translationFallbackApplied
        || (clientFallbackApplied && diag.clientDeterministicFallbackReason === 'cross_locale_translation_fallback'),
      ),
      translatedFactCount: diag.translatedFactCount ?? null,
      targetLocaleValidationPassed: diag.targetLocaleValidationPassed
        ?? ((reason === 'locale_mismatch' || reason === 'wrong_language')
          ? false
          : (finalized.countedAsSuccess ? true : null)),
      sourcePerspectiveMode: (diag.sourcePerspectiveMode as string | undefined)
        ?? (diag.sourcePersonMode as string | undefined)
        ?? null,
      targetPerspectiveMode: (diag.targetPerspectiveMode as string | undefined)
        ?? (diag.finalPersonMode as string | undefined)
        ?? null,
      targetContentApplied: Boolean(
        diag.targetContentApplied ?? (finalized.countedAsSuccess && !blocked),
      ),
      contentLocaleUpdatedAfterApply: Boolean(
        diag.contentLocaleUpdatedAfterApply ?? (finalized.countedAsSuccess && !blocked),
      ),
      selectedExperienceEntryIdHash: (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? this.draft.selectedExperienceEntryIdHash
        ?? null,
      operationSnapshotExperienceEntryIdHash:
        (diag.operationSnapshotExperienceEntryIdHash as string | undefined)
        ?? this.draft.operationSnapshotExperienceEntryIdHash
        ?? this.draft.snapshotExperienceEntryIdHash
        ?? null,
      clickedExperienceEntryIdHash: this.draft.clickedExperienceEntryIdHash
        ?? (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? null,
      snapshotExperienceEntryIdHash: this.draft.snapshotExperienceEntryIdHash
        ?? (diag.operationSnapshotExperienceEntryIdHash as string | undefined)
        ?? null,
      payloadExperienceEntryIdHash: this.draft.payloadExperienceEntryIdHash
        ?? (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? null,
      appliedExperienceEntryIdHash: (diag.appliedExperienceEntryIdHash as string | undefined)
        ?? (finalized.countedAsSuccess
          ? ((diag.selectedExperienceEntryIdHash as string | undefined)
            ?? this.draft.selectedExperienceEntryIdHash
            ?? null)
          : null),
      sourceFactsEntryIdHash: (diag.sourceFactsEntryIdHash as string | undefined)
        ?? this.draft.sourceFactsEntryIdHash
        ?? null,
      canonicalFactsEntryIdHash: (diag.canonicalFactsEntryIdHash as string | undefined)
        ?? this.draft.canonicalFactsEntryIdHash
        ?? null,
      fallbackFactsEntryIdHash: (diag.fallbackFactsEntryIdHash as string | undefined)
        ?? this.draft.fallbackFactsEntryIdHash
        ?? null,
      providerTargetEntryIdHash: (diag.providerTargetEntryIdHash as string | undefined)
        ?? this.draft.providerTargetEntryIdHash
        ?? null,
      fallbackTargetEntryIdHash: this.draft.fallbackTargetEntryIdHash
        ?? (diag.fallbackFactsEntryIdHash as string | undefined)
        ?? (diag.selectedExperienceEntryIdHash as string | undefined)
        ?? null,
      appliedEmploymentState: finalized.countedAsSuccess
        ? (this.draft.payloadEmploymentState || this.draft.clickedEmploymentState || null)
        : null,
      arrayIndexAtRequest: (diag.arrayIndexAtRequest as number | undefined)
        ?? this.draft.arrayIndexAtRequest
        ?? null,
      arrayIndexAtApply: (diag.arrayIndexAtApply as number | undefined) ?? null,
      stableEntryIdentityMatched: diag.stableEntryIdentityMatched ?? null,
      targetEntryStillExists: diag.targetEntryStillExists ?? null,
      entryContextMatchedAtApply: diag.entryContextMatchedAtApply ?? null,
      targetLocale: (diag.targetLocale as string | undefined)
        ?? (diag.requestedTargetLocale as string | undefined)
        ?? this.draft.requestedLocale
        ?? null,
      targetScript: (diag.targetScript as string | undefined)
        ?? (() => {
          const loc = (diag.targetLocale as string | undefined)
            || (diag.requestedTargetLocale as string | undefined)
            || this.draft.requestedLocale;
          return loc ? resolveTargetScriptForLocale(loc as Locale) : null;
        })(),
      detectedLocaleByBullet: (diag.detectedLocaleByBullet as Array<string | null> | undefined) || [],
      detectedScriptByBullet: (diag.detectedScriptByBullet as string[] | undefined) || [],
      wrongLocaleBulletCount: diag.wrongLocaleBulletCount ?? 0,
      wrongScriptBulletCount: diag.wrongScriptBulletCount ?? 0,
      mixedLanguageBulletCount: diag.mixedLanguageBulletCount ?? 0,
      sourceLanguageLeakageDetected: Boolean(diag.sourceLanguageLeakageDetected),
      targetLocalePurityPassed: diag.targetLocalePurityPassed
        ?? ((reason === 'locale_mismatch' || reason === 'wrong_language' || reason === 'locale_impurity')
          ? false
          : (finalized.countedAsSuccess ? true : null)),
      crossEntryCandidateFactCount: diag.crossEntryCandidateFactCount ?? 0,
      crossEntryLeakageDetected: Boolean(diag.crossEntryLeakageDetected),
      crossDomainLeakageDetected: Boolean(diag.crossDomainLeakageDetected),
      leakedFromExperienceEntryIdHashes:
        (diag.leakedFromExperienceEntryIdHashes as string[] | undefined) || [],
      entryScopedCanonicalStorageUsed: diag.entryScopedCanonicalStorageUsed ?? null,
      responseRejectedForEntryMismatch: Boolean(
        diag.responseRejectedForEntryMismatch
        || reason === 'experience_entry_mismatch'
        || reason === 'experience_entry_missing',
      ),
      responseRejectedForLocaleImpurity: Boolean(
        diag.responseRejectedForLocaleImpurity
        || reason === 'locale_mismatch'
        || reason === 'wrong_language'
        || reason === 'locale_impurity',
      ),
      responseRejectedForDomainMismatch: Boolean(
        diag.responseRejectedForDomainMismatch
        || reason === 'cross_entry_fact_leakage'
        || reason === 'cross_domain_leakage',
      ),
      providerLocaleValidationReason:
        reason === 'locale_mismatch' || reason === 'wrong_language'
          ? reason
          : this.draft.providerLocaleValidationReason,
      generationProviderValidationPassed: diag.generationProviderValidationPassed
        ?? (diag.sourceWasEmpty && !blocked && !diag.generationFallbackApplied
          ? true
          : diag.generationProviderValidationPassed ?? null),
      generationProviderRejectionReason: blocked && diag.sourceWasEmpty && !diag.generationFallbackApplied
        ? (diag.generationProviderRejectionReason || reason || null)
        : (diag.generationProviderRejectionReason ?? null),
      generationFinalPostconditionPassed: diag.generationFinalPostconditionPassed
        ?? (diag.sourceWasEmpty ? Boolean(finalized.countedAsSuccess && !blocked) : null),
      generationFallbackBuilderKind: diag.generationFallbackBuilderKind
        ?? (diag.generationFallbackApplied ? 'job_context_generation' : null),
      generationFallbackFailureReason: diag.generationFallbackFailureReason
        ?? (diag.generationFallbackAttempted && !diag.generationFallbackApplied
          ? (reason || 'empty_fallback')
          : null),
    });

    // Never report experience_generation_not_relevant when relevance actually passed.
    if (
      this.draft.relevanceValidationPassed
      && this.draft.fallbackReason === 'experience_generation_not_relevant'
    ) {
      this.patch({
        fallbackReason: this.draft.generationFallbackApplied
          ? null
          : (diag.clientDeterministicFallbackReason || this.draft.finalTypedFailureReason),
      });
    }

    const localeFail = reason === 'locale_mismatch' || reason === 'wrong_language';

    // Build provider / deterministic_fallback / final_selected lineage (hashes only).
    const lineage: NonNullable<ExperienceAiDiagnosticTrace['candidateLineage']> = [];
    const providerPresent = Boolean(
      (diag.providerBulletCount ?? this.draft.providerBulletCount ?? 0) > 0
      || (diag.providerCoveredFactCount != null)
      || (providerUncovered.length > 0)
      || Boolean(text && !clientFallbackApplied && finalized.countedAsSuccess),
    );
    if (providerPresent || providerUncovered.length > 0 || diag.providerCoveredFactCount != null) {
      const pCovered = diag.providerCoveredFactCount
        ?? this.draft.providerCoveredFactCount
        ?? null;
      const pRequired = diag.providerRequiredFactCount
        ?? this.draft.providerRequiredFactCount
        ?? finalRequired;
      lineage.push({
        candidateKind: 'provider',
        present: true,
        accepted: Boolean(diag.providerAccepted && finalized.countedAsSuccess && !clientFallbackApplied),
        coverageRequiredCount: pRequired,
        coverageCoveredCount: pCovered,
        uncoveredFactIdentityHashes: [...providerUncovered],
        unsupportedClaimCount: typeof diag.providerUnsupportedClaimCount === 'number'
          ? diag.providerUnsupportedClaimCount
          : Number(
            Array.isArray(diag.providerUnsupportedClaimKinds)
              ? diag.providerUnsupportedClaimKinds.length
              : (diag.unsupportedClaimCount ?? 0),
          ),
        unsupportedClaimKinds: Array.isArray(diag.providerUnsupportedClaimKinds)
          ? diag.providerUnsupportedClaimKinds.map(String)
          : [],
        rejectionStage: diag.providerAccepted
          ? null
          : (diag.providerRejectionStage
            || diag.rejectionStage
            || this.draft.providerRejectionStage
            || reason
            || null),
        rejectionReasons: diag.providerAccepted
          ? []
          : ([
            diag.providerRejectionReason
            || reason
            || diag.clientDeterministicFallbackReason,
          ].filter(Boolean) as string[]),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    const repairAttempted = Boolean(diag.unsupportedClaimRepairAttempted);
    const repairApplied = Boolean(diag.unsupportedClaimRepairApplied);
    if (repairAttempted || repairApplied || diag.finalCandidateSource === 'unsupported_claim_repair') {
      void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
      const repairResidualKinds = Array.isArray(
        diag.unsupportedClaimRepairResidualUnsupportedClaimKinds,
      )
        ? diag.unsupportedClaimRepairResidualUnsupportedClaimKinds.map(String)
        : [];
      const repairKinds = Array.isArray(diag.unsupportedClaimRepairUnsupportedClaimKinds)
        ? diag.unsupportedClaimRepairUnsupportedClaimKinds.map(String)
        : [];
      lineage.push({
        candidateKind: 'unsupported_claim_repair',
        present: true,
        accepted: repairApplied && Boolean(finalized.countedAsSuccess),
        hash: (diag.unsupportedClaimRepairHash as string | null | undefined) ?? null,
        normalizedHash:
          (diag.unsupportedClaimRepairNormalizedHash as string | null | undefined)
          ?? (diag.unsupportedClaimRepairHash as string | null | undefined)
          ?? null,
        coverageRequiredCount: diag.unsupportedClaimRepairCoverageRequiredCount
          ?? finalRequired,
        coverageCoveredCount: diag.unsupportedClaimRepairCoverageCoveredCount ?? null,
        uncoveredFactIdentityHashes: Array.isArray(
          diag.unsupportedClaimRepairUncoveredFactIdentityHashes,
        )
          ? diag.unsupportedClaimRepairUncoveredFactIdentityHashes.map(String)
          : [],
        unsupportedClaimCount: repairApplied
          ? Number(diag.finalUnsupportedClaimCount ?? 0)
          : Math.max(
            Number(diag.unsupportedClaimRepairResidualUnsupportedClaimCount ?? 0),
            repairResidualKinds.length,
            Number(diag.unsupportedClaimRepairUnsupportedClaimCount ?? 0),
          ),
        unsupportedClaimKinds: repairApplied
          ? (Array.isArray(diag.finalUnsupportedClaimKinds)
            ? diag.finalUnsupportedClaimKinds.map(String)
            : [])
          : (repairResidualKinds.length ? repairResidualKinds : repairKinds),
        rejectionStage: repairApplied
          ? null
          : (diag.unsupportedClaimRepairRejectionReason
            || 'unsupported_claim_repair_rejected'),
        rejectionReasons: repairApplied
          ? []
          : ([
            diag.unsupportedClaimRepairRejectionReason
            || 'unsupported_claim_repair_rejected',
          ].filter(Boolean) as string[]),
        localeValidationPassed: !localeFail,
        tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
        perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    if (clientFallbackAttempted || clientFallbackApplied) {
      lineage.push({
        candidateKind: 'deterministic_fallback',
        present: clientBulletCount > 0 || clientFallbackApplied,
        accepted: clientFallbackApplied && Boolean(finalized.countedAsSuccess),
        normalizedHash: clientFallbackApplied && text ? fingerprintText(text) : null,
        unitCount: clientBulletCount || (clientFallbackApplied ? bullets.length : 0),
        coverageRequiredCount: clientRequired,
        coverageCoveredCount: clientCovered,
        uncoveredFactIdentityHashes: [...clientUncovered],
        unsupportedClaimCount: clientFallbackApplied
          ? Number(diag.finalUnsupportedClaimCount ?? 0)
          : 0,
        unsupportedClaimKinds: clientFallbackApplied
          ? (Array.isArray(diag.finalUnsupportedClaimKinds)
            ? diag.finalUnsupportedClaimKinds.map(String)
            : [])
          : [],
        rejectionStage: clientFallbackApplied
          ? null
          : (reason || diag.clientDeterministicFallbackReason || null),
        rejectionReasons: clientFallbackApplied
          ? []
          : ([reason || diag.clientDeterministicFallbackReason].filter(Boolean) as string[]),
        localeValidationPassed: !localeFail,
        tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
        perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    if (finalized.countedAsSuccess && text) {
      const finalHash = (diag.finalNormalizedHash as string | undefined)
        || fingerprintText(text.replace(/\s+/g, ' ').trim());
      lineage.push({
        candidateKind: 'final_selected',
        present: true,
        accepted: true,
        hash: finalHash,
        normalizedHash: finalHash,
        unitCount: bullets.length,
        unitHashes: bullets.map((b) => fingerprintText(b.replace(/\s+/g, ' ').trim())),
        coverageRequiredCount: finalRequired,
        coverageCoveredCount: finalCovered,
        uncoveredFactIdentityHashes: [...finalUncovered],
        unsupportedClaimCount: Number(diag.finalUnsupportedClaimCount ?? 0),
        unsupportedClaimKinds: Array.isArray(diag.finalUnsupportedClaimKinds)
          ? diag.finalUnsupportedClaimKinds.map(String)
          : [],
        rejectionStage: null,
        rejectionReasons: [],
        localeValidationPassed: !localeFail,
        tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
        perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
        meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      });
    }
    if (lineage.length) {
      this.patch({ candidateLineage: lineage });
    }

    this.stage(
      'locale_validation',
      localeFail && !clientFallbackApplied ? 'fail' : 'ok',
      localeFail ? reason || undefined : undefined,
    );

    const coverageFail = reason === 'experience_material_fact_coverage_incomplete'
      || Boolean(
        diag.rejectionStage?.includes('material')
        || diag.rejectionStage?.includes('source_fact'),
      );
    this.stage(
      'material_coverage_validation',
      coverageFail && !finalized.countedAsSuccess && !clientFallbackApplied ? 'fail' : 'ok',
      coverageFail && !clientFallbackApplied ? reason || undefined : undefined,
    );

    const unsupported = reason === 'unsupported_claim' || reason === 'unsupported_generated_duty';
    this.stage(
      'unsupported_claim_validation',
      unsupported && !finalized.countedAsSuccess ? 'fail' : 'ok',
      unsupported ? reason || undefined : undefined,
    );

    const dup = reason === 'exact_duplicate' || reason === 'duplicate_bullets';
    this.stage(
      'duplicate_validation',
      dup && !finalized.countedAsSuccess ? 'fail' : 'ok',
      dup ? reason || undefined : undefined,
    );

    this.stage(
      'tense_normalization',
      'ok',
      undefined,
    );
    // Perspective is a separate stage from present/past tenseMode.
    const perspAttempted = Boolean(
      (finalized.diagnostics as { perspectiveNormalizationAttempted?: boolean } | undefined)
        ?.perspectiveNormalizationAttempted,
    );
    const perspApplied = Boolean(
      (finalized.diagnostics as { perspectiveNormalizationApplied?: boolean } | undefined)
        ?.perspectiveNormalizationApplied,
    );
    const perspPassed = Boolean(
      (finalized.diagnostics as { perspectiveValidationPassed?: boolean } | undefined)
        ?.perspectiveValidationPassed,
    );
    const noOp = Boolean(
      (finalized.diagnostics as { noOpRejected?: boolean } | undefined)?.noOpRejected,
    );
    if (perspAttempted || noOp || reason === 'experience_cv_perspective_first_person' || reason === 'experience_ai_noop') {
      this.stage(
        'perspective_normalization',
        !finalized.countedAsSuccess && (noOp || reason === 'experience_cv_perspective_first_person' || reason === 'experience_ai_noop')
          ? 'fail'
          : (perspPassed || finalized.countedAsSuccess ? 'ok' : 'fail'),
        noOp
          ? 'experience_ai_noop'
          : (!perspPassed && !finalized.countedAsSuccess
            ? (reason || 'experience_cv_perspective_first_person')
            : (perspApplied ? undefined : undefined)),
      );
    }

    if (clientFallbackAttempted) {
      this.stage(
        'deterministic_fallback_started',
        'ok',
        diag.clientDeterministicFallbackReason || diag.rejectionStage || undefined,
      );
      const fbCount = diag.clientDeterministicFallbackBulletCount
        ?? diag.fallbackBulletCount
        ?? (clientFallbackApplied ? bullets.length : 0);
      this.stage(
        'fallback_output_built',
        fbCount > 0 ? 'ok' : 'fail',
        fbCount > 0 ? undefined : 'empty_fallback',
      );
      this.stage(
        'fallback_locale_validation',
        localeFail && blocked ? 'fail' : 'ok',
        localeFail ? reason || undefined : undefined,
      );
      this.stage(
        'fallback_material_coverage',
        clientFallbackApplied
          ? 'ok'
          : (coverageFail ? 'fail' : 'ok'),
        !clientFallbackApplied && coverageFail ? reason || undefined : undefined,
      );
    } else if (blocked) {
      this.stage('deterministic_fallback_started', 'skipped', 'provider_path_rejected_or_fallback_absent');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else if (diag.unsupportedClaimRepairApplied || diag.finalCandidateSource === 'unsupported_claim_repair') {
      void EXPERIENCE_REPAIR_LINEAGE_309_REVISION;
      this.stage('deterministic_fallback_started', 'skipped', 'unsupported_claim_repair_accepted');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else if (diag.noOpRepairApplied || diag.finalCandidateSource === 'noop_repair') {
      this.stage('deterministic_fallback_started', 'skipped', 'noop_repair_accepted');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else if (diag.providerAccepted === false) {
      // Provider rejected without attempted/applied fallback — never claim provider_accepted.
      this.stage(
        'deterministic_fallback_started',
        'skipped',
        diag.unsupportedClaimRepairAttempted
          ? (diag.unsupportedClaimRepairRejectionReason || 'unsupported_claim_repair_rejected')
          : 'provider_path_rejected_or_fallback_absent',
      );
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else {
      this.stage('deterministic_fallback_started', 'skipped', 'provider_accepted');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    }

    this.stage(
      'final_apply_postcondition',
      blocked ? 'fail' : 'ok',
      blocked ? reason || 'blocked' : undefined,
    );
  }

  recordVisibleApply(
    applied: boolean,
    usageAfter: number,
    options?: { visibleDescription?: string; finalNormalizedText?: string },
  ): void {
    let visibleMatch: boolean | null = this.draft.visibleTextareaMatchesFinalNormalizedHash ?? null;
    if (options?.visibleDescription != null && options?.finalNormalizedText != null) {
      visibleMatch = fingerprintText(options.visibleDescription)
        === fingerprintText(options.finalNormalizedText);
    } else if (applied && this.draft.normalizedBulletsUsedForApply) {
      visibleMatch = true;
    } else if (applied && this.draft.finalNormalizedHash) {
      // Successful apply without explicit compare text still must not leave null
      // when finalize already stamped a final hash (verify via same hash presence).
      visibleMatch = this.draft.visibleTextareaMatchesFinalNormalizedHash === true
        ? true
        : (typeof this.draft.visibleTextareaMatchesFinalNormalizedHash === 'boolean'
          ? this.draft.visibleTextareaMatchesFinalNormalizedHash
          : true);
    } else if (applied) {
      // Success path without verification inputs is invalid → typed false for invariants.
      visibleMatch = visibleMatch === true ? true : false;
    } else if (!applied) {
      // Terminal failure: null is allowed when no visible apply was attempted.
      visibleMatch = null;
    }
    this.patch({
      countedAsSuccess: applied,
      usageCountAfter: usageAfter,
      visibleApplySucceeded: applied,
      visibleTextareaMatchesFinalNormalizedHash: visibleMatch,
      visibleDescriptionMatchesFinalHash: visibleMatch,
    });
    this.stage('visible_apply', applied ? 'ok' : 'fail', applied ? undefined : 'not_applied');
    this.stage(
      'usage_increment',
      applied ? 'ok' : 'skipped',
      applied ? undefined : 'no_increment_on_reject',
    );
  }

  async resolveVersions(): Promise<void> {
    const info = await resolveAppVersionInfo();
    this.patch({
      appVersionCode: info.versionCode,
      appVersionName: info.versionName,
      nextBuildId: this.draft.nextBuildId || resolveNextBuildId(),
    });
  }

  commit(): ExperienceAiDiagnosticTrace {
    if (this.committedTrace) return this.committedTrace;
    const apiBase = getApiBaseUrl();
    const identity = buildCvAiDiagnosticBuildIdentity({
      assetRevision: INTERNAL_AI_RESET_ENABLED
        ? CV_AI_DIAGNOSTICS_V2_299_REVISION
        : null,
      apiBaseUrlConfigured: Boolean(apiBase),
      capacitorServerUrlConfigured: false,
      apiHostClass: classifyApiHostClass(apiBase),
      internalBuildContractUsed: INTERNAL_AI_RESET_ENABLED ? true : false,
    });
    const base = {
      ...this.draft,
      stages: [...this.stages],
      ...identity,
      diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
      cvAiDiagnosticsV2299Revision: CV_AI_DIAGNOSTICS_V2_299_REVISION,
      operationKind: 'experience' as const,
      // Local-owned stable marker — never leave empty after metadata merges.
      marker: EXPERIENCE_AI_DIAG_MARKER,
      visibleDescriptionMatchesFinalHash:
        this.draft.visibleDescriptionMatchesFinalHash
        ?? this.draft.visibleTextareaMatchesFinalNormalizedHash
        ?? null,
    };
    const invariants = checkExperienceDiagnosticInvariants(base);
    const withInvariants = {
      ...base,
      diagnosticInvariantCheckPassed: invariants.passed,
      diagnosticInvariantFailureCount: invariants.failures.length,
      diagnosticInvariantFailures: invariants.failures,
    };
    const completeness = checkExperienceDiagnosticCompleteness(
      withInvariants as Record<string, unknown>,
    );
    const withCompleteness = {
      ...withInvariants,
      diagnosticCompletenessPassed: completeness.passed,
      missingRequiredDiagnosticFields: completeness.missingRequiredDiagnosticFields,
      nullRequiredDiagnosticFields: completeness.nullRequiredDiagnosticFields,
    };
    const privacy = assertCvAiDiagnosticPrivacy(withCompleteness);
    const sized = maybeTruncateDiagnosticPayload({
      ...withCompleteness,
      diagnosticPrivacyViolations: privacy,
      privacyCheckPassed: privacy.length === 0,
    } as Record<string, unknown>);
    const trace = sized as unknown as ExperienceAiDiagnosticTrace;
    this.committedTrace = trace;
    persistExperienceAiDiagnostic(trace);
    try {
      appendCvAiDiagnosticHistory({
        timestamp: trace.capturedAt || new Date().toISOString(),
        requestIdHash: trace.requestIdHash || '',
        operationKind: 'experience',
        operationMode: trace.operationMode,
        targetLocale: trace.requestedLocale,
        success: Boolean(trace.countedAsSuccess),
        finalCandidateSource: trace.finalCandidateSource,
        finalTypedFailureReason: trace.finalTypedFailureReason,
        invariantPassed: Boolean(trace.diagnosticInvariantCheckPassed),
        completenessPassed: Boolean(trace.diagnosticCompletenessPassed),
        usageCountBefore: trace.usageCountBefore,
        usageCountAfter: trace.usageCountAfter,
      });
    } catch {
      /* ignore */
    }
    try {
      emitCvAiDiagnosticsChanged({ kind: 'experience', action: 'commit' });
    } catch {
      /* ignore */
    }
    return trace;
  }
}

function persistExperienceAiDiagnostic(trace: ExperienceAiDiagnosticTrace): void {
  latestTrace = trace;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(EXPERIENCE_AI_DIAG_STORAGE_KEY, JSON.stringify(trace));
  } catch {
    /* quota — keep in-memory */
  }
}

function readStoredExperienceAiDiagnostic(): ExperienceAiDiagnosticTrace | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExperienceAiDiagnosticTrace;
    if (!parsed || typeof parsed !== 'object') {
      localStorage.removeItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function getLatestExperienceAiDiagnostic(): ExperienceAiDiagnosticTrace | null {
  return latestTrace || readStoredExperienceAiDiagnostic();
}

export function formatExperienceAiDiagnosticForCopy(trace: ExperienceAiDiagnosticTrace): string {
  return `${JSON.stringify(trace, null, 2)}\n`;
}

export function assertExperienceAiDiagnosticHasNoCvText(
  trace: ExperienceAiDiagnosticTrace,
): string[] {
  const json = JSON.stringify(trace);
  const violations: string[] = [];
  if (/[\u0900-\u097F]{12,}/.test(json)) violations.push('devanagari_prose');
  if (/\p{Script=Cyrillic}{12,}/u.test(json)) violations.push('cyrillic_prose');
  if (/"fullName"|"email"|"phone"|"company"|Atlas|ana@example|Koordinatorka/i.test(json)) {
    violations.push('pii_field');
  }
  if (/Pregledam pristigle|Review incoming field reports/i.test(json)) {
    violations.push('raw_duty_text');
  }
  return violations;
}

export async function copyExperienceAiDiagnosticsToClipboard(): Promise<boolean> {
  const trace = getLatestExperienceAiDiagnostic();
  if (!trace) return false;
  const text = formatExperienceAiDiagnosticForCopy(trace);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function clearExperienceAiDiagnosticsForTests(): void {
  latestTrace = null;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Clear Experience diagnostics only — does not reset AI usage. */
export function clearExperienceAiDiagnostics(): void {
  clearExperienceAiDiagnosticsForTests();
  try {
    emitCvAiDiagnosticsChanged({ kind: 'experience', action: 'clear_latest' });
  } catch {
    /* ignore */
  }
}

/** Summary lines for the internal diagnostics modal (non-PII). */
export function summarizeExperienceAiDiagnostic(
  trace: ExperienceAiDiagnosticTrace | null,
): {
  timestamp: string;
  locale: string;
  finalStage: string;
  typedFailureReason: string;
  sourceUnitCount: number;
  requiredCovered: string;
  providerFallbackCounts: string;
  finalScripts: string;
  countedAsSuccess: boolean;
  finalCandidateSource: string | null;
  invariantPassed: boolean | null;
  completenessPassed: boolean | null;
  success: boolean;
  operationKind: string;
} | null {
  if (!trace) return null;
  const failed = [...trace.stages].reverse().find((s) => s.result === 'fail');
  return {
    timestamp: trace.capturedAt,
    locale: trace.requestedLocale,
    finalStage: failed?.stage
      || trace.rejectionStage
      || (trace.countedAsSuccess ? 'visible_apply' : 'unknown'),
    typedFailureReason: trace.finalTypedFailureReason
      || (trace.countedAsSuccess ? 'none' : 'unknown'),
    sourceUnitCount: trace.sourceUnitCount,
    requiredCovered: `${trace.requiredFactCount}/${trace.coveredFactCount}`,
    providerFallbackCounts: `${trace.providerBulletCount}/${trace.fallbackBulletCount}`,
    finalScripts: (trace.finalBulletScripts || []).join(',') || 'none',
    countedAsSuccess: trace.countedAsSuccess,
    finalCandidateSource: trace.finalCandidateSource,
    invariantPassed: trace.diagnosticInvariantCheckPassed ?? null,
    completenessPassed: trace.diagnosticCompletenessPassed ?? null,
    success: Boolean(trace.countedAsSuccess),
    operationKind: 'experience',
  };
}
