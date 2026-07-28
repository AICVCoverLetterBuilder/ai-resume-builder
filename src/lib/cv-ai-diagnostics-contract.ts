/**
 * Shared CV AI diagnostics contract (v2) — Experience + Professional Summary.
 * Additive, privacy-safe: hashes/counts/categories only. No raw CV text.
 */
import { fingerprintText } from './cv-export-diagnostics';
import {
  INTERNAL_AI_RESET_ENABLED,
  INTERNAL_AI_DIAGNOSTICS_REVISION,
  INTERNAL_AI_RESET_BUNDLE_MARKER,
} from './build-channel';
import { emitCvAiDiagnosticsChanged } from './cv-ai-diagnostics-lifecycle';
import {
  SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION,
  SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION,
} from './cv-summary-explicit-skill-authority';
import {
  GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION,
  SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION,
  SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION,
} from './cv-german-summary-role-slots';
import {
  SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION,
  SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION,
} from './cv-summary-structured-role-localization';
import {
  SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION,
} from './cv-german-summary-current-duty-coverage';
export { SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION } from './cv-german-summary-current-duty-coverage';
import {
  SUMMARY_CANDIDATE_PROJECTION_INVARIANT_347_REVISION,
} from './cv-english-summary-grounding';
import {
  experienceFactAuthorityKindsEquivalent,
  EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION,
} from './cv-experience-authority-snapshot-327';
import {
  EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION,
  EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION,
  evaluateExperiencePhaseLocaleValidation,
  isExperienceLocaleRejectionReason,
  isExperienceCoverageRejectionReason,
} from './cv-experience-locale-rejection-truth-328';
import { localesEquivalent, normalizeLocaleKey, canonicalizeContentLocale } from './cv-content-locale';
import { resolveLocaleCandidate } from './i18n/translations';
void SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION;
void SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION;
void GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION;
void SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION;
void SUMMARY_REPAIRED_PROVIDER_LINEAGE_321_REVISION;
void SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION;
void SUMMARY_VISIBLE_ROLE_LOCALE_VERIFICATION_322_REVISION;
void SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION;
void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
void EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION;

/** Stable contract revision — must survive minification in internal builds. */
export const CV_AI_DIAGNOSTIC_CONTRACT_REVISION = 'cv-ai-diagnostics-v2' as const;
export const CV_AI_DIAGNOSTIC_BUNDLE_MARKER = 'cv-ai-diagnostics-v2' as const;
/** AAB-299 packaging proof marker for the v2 diagnostics contract. */
export const CV_AI_DIAGNOSTICS_V2_299_REVISION = 'cv-ai-diagnostics-v2-299-v1' as const;
/** Stable per-operation diagnostic schema markers (Copy / persist / completeness). */
export const SUMMARY_AI_DIAG_MARKER = 'SUMMARY_AI_DIAG_V1' as const;
export const EXPERIENCE_AI_DIAG_MARKER = 'EXPERIENCE_AI_DIAG_V1' as const;
/** AAB-302 packaging proof: Experience marker must never be empty or overwritten. */
export const EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION =
  'experience-diagnostic-marker-302-v1' as const;
void CV_AI_DIAGNOSTIC_CONTRACT_REVISION;
void CV_AI_DIAGNOSTIC_BUNDLE_MARKER;
void CV_AI_DIAGNOSTICS_V2_299_REVISION;
void SUMMARY_AI_DIAG_MARKER;
void EXPERIENCE_AI_DIAG_MARKER;
void EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION;

/** Soft byte budget for copied diagnostic JSON (UTF-16 code units ≈ bytes for ASCII). */
export const CV_AI_DIAGNOSTIC_MAX_PAYLOAD_CHARS = 120_000;

export type CvAiDiagnosticOperationKind = 'experience' | 'summary';

export function expectedCvAiDiagnosticMarker(
  operationKind: CvAiDiagnosticOperationKind | string | null | undefined,
): typeof SUMMARY_AI_DIAG_MARKER | typeof EXPERIENCE_AI_DIAG_MARKER | null {
  if (operationKind === 'summary') return SUMMARY_AI_DIAG_MARKER;
  if (operationKind === 'experience') return EXPERIENCE_AI_DIAG_MARKER;
  return null;
}

/**
 * Validate operation-kind-aware diagnostic `marker`.
 * Empty / whitespace / null / wrong-kind markers fail completeness.
 */
export function validateCvAiDiagnosticMarkerField(
  trace: Record<string, unknown>,
): {
  ok: boolean;
  missingRequiredDiagnosticFields: string[];
  nullRequiredDiagnosticFields: string[];
} {
  const missing: string[] = [];
  const nullish: string[] = [];
  if (!('marker' in trace)) {
    missing.push('marker');
    return { ok: false, missingRequiredDiagnosticFields: missing, nullRequiredDiagnosticFields: nullish };
  }
  const raw = trace.marker;
  if (raw === null || raw === undefined) {
    nullish.push('marker');
    return { ok: false, missingRequiredDiagnosticFields: missing, nullRequiredDiagnosticFields: nullish };
  }
  if (typeof raw !== 'string') {
    nullish.push('invalid_marker');
    return { ok: false, missingRequiredDiagnosticFields: missing, nullRequiredDiagnosticFields: nullish };
  }
  if (!raw.trim()) {
    nullish.push('marker_empty');
    return { ok: false, missingRequiredDiagnosticFields: missing, nullRequiredDiagnosticFields: nullish };
  }
  const kind = String(trace.operationKind || '');
  const expected = expectedCvAiDiagnosticMarker(kind);
  if (!expected) {
    nullish.push('invalid_marker');
    return { ok: false, missingRequiredDiagnosticFields: missing, nullRequiredDiagnosticFields: nullish };
  }
  if (raw.trim() !== expected) {
    nullish.push('marker_operation_kind_mismatch');
    return { ok: false, missingRequiredDiagnosticFields: missing, nullRequiredDiagnosticFields: nullish };
  }
  return { ok: true, missingRequiredDiagnosticFields: missing, nullRequiredDiagnosticFields: nullish };
}

/** Reject empty/whitespace/unknown marker overwrites from response metadata merges. */
export function sanitizeCvAiDiagnosticMarkerPatch(
  operationKind: CvAiDiagnosticOperationKind,
  partial: { marker?: unknown },
): { marker?: string } {
  if (!('marker' in partial)) return {};
  const expected = expectedCvAiDiagnosticMarker(operationKind);
  if (!expected) return {};
  const raw = partial.marker;
  if (typeof raw !== 'string') return {};
  if (raw.trim() !== expected) return {};
  return { marker: expected };
}

export type CvAiDiagnosticRejectionCategory =
  | 'wrong_target_locale'
  | 'wrong_target_script'
  | 'mixed_language'
  | 'source_language_leakage'
  | 'unexpected_locale'
  | 'missing_required_fact'
  | 'unsupported_claim'
  | 'unsupported_design_medium'
  | 'unsupported_print_medium'
  | 'unsupported_branding_claim'
  | 'unsupported_marketing_claim'
  | 'unsupported_tool'
  | 'unsupported_metric'
  | 'unsupported_leadership'
  | 'cross_entry_leakage'
  | 'cross_domain_leakage'
  | 'stale_fact_leakage'
  | 'incomplete_sentence'
  | 'missing_finite_copula'
  | 'missing_finite_auxiliary'
  | 'nominal_experience_fragment'
  | 'standalone_relative_fragment'
  | 'invalid_tense'
  | 'invalid_gender_form'
  | 'invalid_perspective'
  | 'wrong_bullet_count'
  | 'wrong_sentence_count'
  | 'missing_current_intro_slot'
  | 'missing_current_duty_slot'
  | 'missing_prior_role_slot'
  | 'duplicate_role_slot'
  | 'duration_missing'
  | 'duration_duplicate'
  | 'duration_hybrid'
  | 'duration_mismatch'
  | 'target_entry_missing'
  | 'stable_entry_mismatch'
  | 'job_context_changed'
  | 'race_guard_failed'
  | 'visible_apply_hash_mismatch'
  | 'visible_apply_failed'
  | 'usage_increment_mismatch'
  | 'diagnostic_invariant_failed'
  | 'provider_noop'
  | 'repair_noop'
  | 'deterministic_noop'
  | 'meaningful_change_missing'
  | 'request_timeout'
  | 'provider_timeout'
  | 'network_failure'
  | 'invalid_api_response'
  | 'server_error'
  | 'hindi_summary_grounding_failed'
  | 'unknown';

export type CvAiCandidateKind =
  | 'provider'
  | 'provider_repair'
  | 'repaired_provider'
  | 'server_fallback'
  | 'client_repair'
  | 'client_deterministic'
  | 'final_selected';

export type CvAiDiagnosticSentenceGrammarRecord = {
  sentenceHash: string;
  roleSlot: string;
  hasFiniteVerb: boolean;
  hasFiniteCopula: boolean;
  hasRequiredAuxiliary: boolean;
  nominalFragmentDetected: boolean;
  standaloneRelativeFragmentDetected: boolean;
  grammarPassed: boolean;
  grammarReasons: string[];
};

export type CvAiCandidateLineageRecord = {
  candidateKind: CvAiCandidateKind;
  present: boolean;
  hash: string | null;
  normalizedHash: string | null;
  /** Optional stage hashes — raw / normalized / duration-finalized. */
  rawHash?: string | null;
  finalizedHash?: string | null;
  unitCount: number;
  unitHashes: string[];
  sentenceCount?: number;
  sentenceHashes?: string[];
  sentenceRoleSlots?: string[];
  /** Per-sentence semantic roles for the exact units represented by this record. */
  sentenceSemanticRolesBySentence?: string[][] | null;
  accepted: boolean;
  rejectionStage: string | null;
  rejectionReasons: string[];
  grammarValidationPassed: boolean | null;
  groundingValidationPassed: boolean | null;
  durationValidationPassed: boolean | null;
  slotValidationPassed: boolean | null;
  localeValidationPassed: boolean | null;
  unsupportedClaimCount: number;
  unsupportedClaimKinds: string[];
  unsupportedDesignMediumCount?: number;
  unsupportedDesignMediumKinds?: string[];
  printClaimDetected?: boolean;
  hindiNominalExperienceFragmentDetected?: boolean | null;
  hindiSentenceHasFiniteCopulaOrVerb?: boolean[] | null;
  hindiIncompleteSentenceCount?: number | null;
  hindiGrammarRejectionReasons?: string[];
  sentenceGrammarRecords?: CvAiDiagnosticSentenceGrammarRecord[];
  meaningfulChangeDetected?: boolean | null;
  finalMatchesSourceAfterNormalization?: boolean | null;
  noOpDetected?: boolean | null;
  noOpRejectionReason?: string | null;
  transformationKinds?: string[];
  selectedSource?: string | null;
};

export type CvAiDiagnosticBuildIdentity = {
  diagnosticContractRevision: typeof CV_AI_DIAGNOSTIC_CONTRACT_REVISION;
  compiledDiagnosticMarker: typeof CV_AI_DIAGNOSTIC_BUNDLE_MARKER;
  assetRevision: string;
  cvAiDiagnosticsV2299Revision?: typeof CV_AI_DIAGNOSTICS_V2_299_REVISION;
  internalDiagnosticsEnabled: boolean;
  internalResetEnabled: boolean;
  internalBuildContractUsed: boolean | null;
  /** @deprecated Prefer apiBaseUrlConfigured — historically aliased API base, not Capacitor server.url. */
  serverUrlConfigured: boolean;
  apiBaseUrlConfigured: boolean;
  capacitorServerUrlConfigured: boolean;
  apiHostClass: 'production' | 'preview' | 'relative' | 'none' | 'unknown';
  sourceCommitShort: string | null;
  sourceCommitStatus: 'embedded' | 'unavailable_by_contract';
};

export type CvAiDiagnosticInvariantFailure = {
  invariantCode: string;
  observed: Record<string, string | number | boolean | null>;
};

export type CvAiDiagnosticHistoryItem = {
  timestamp: string;
  requestIdHash: string;
  operationKind: CvAiDiagnosticOperationKind;
  operationMode: string | null;
  targetLocale: string;
  success: boolean;
  finalCandidateSource: string | null;
  finalTypedFailureReason: string | null;
  invariantPassed: boolean;
  completenessPassed: boolean;
  usageCountBefore: number;
  usageCountAfter: number;
};

export const CV_AI_DIAG_HISTORY_STORAGE_KEY = 'cvpro-cv-ai-diag-history-v1';
const HISTORY_MAX_PER_KIND = 5;

const GRAMMAR_REJECTION_CATEGORY_RE =
  /^(nominal_experience_fragment|standalone_relative_fragment|missing_finite_copula|missing_finite_auxiliary|incomplete_sentence|current_intro_copula_missing|current_duty_auxiliary_missing|invalid_tense|invalid_gender_form|invalid_perspective)$/;
const MEDIUM_OR_GROUNDING_REJECTION_RE =
  /unsupported_(?:print|branding|marketing|design)_|unsupported_claim|cross_entry|cross_domain|stale_fact|hindi_summary_grounding|summary_grounding/;

/** Stable first-seen dedupe for typed rejection / kind arrays. */
export function dedupeStableStrings(values: readonly string[] | null | undefined): string[] {
  if (!values || !values.length) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = String(raw || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function isGrammarRejectionCategory(value: string | null | undefined): boolean {
  if (!value) return false;
  return GRAMMAR_REJECTION_CATEGORY_RE.test(String(value));
}

export function isMediumOrGroundingRejectionCategory(value: string | null | undefined): boolean {
  if (!value) return false;
  return MEDIUM_OR_GROUNDING_REJECTION_RE.test(String(value));
}

export function resolveSourceCommitShort(): {
  sourceCommitShort: string | null;
  sourceCommitStatus: 'embedded' | 'unavailable_by_contract';
} {
  const raw = (process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT || '').trim();
  if (/^[0-9a-f]{7,40}$/i.test(raw)) {
    return { sourceCommitShort: raw.slice(0, 7).toLowerCase(), sourceCommitStatus: 'embedded' };
  }
  return { sourceCommitShort: null, sourceCommitStatus: 'unavailable_by_contract' };
}

export function classifyApiHostClass(apiBaseUrl: string): CvAiDiagnosticBuildIdentity['apiHostClass'] {
  const base = (apiBaseUrl || '').trim();
  if (!base) return 'relative';
  try {
    const host = new URL(base).hostname;
    if (!host) return 'unknown';
    if (host.includes('-git-') && host.endsWith('.vercel.app')) return 'preview';
    if (host.endsWith('.vercel.app') || host.includes('ai-resume') || host.includes('cv')) {
      return 'production';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function buildCvAiDiagnosticBuildIdentity(options?: {
  assetRevision?: string | null;
  sourceCommitShort?: string | null;
  sourceCommitStatus?: 'embedded' | 'unavailable_by_contract';
  /** @deprecated Use apiBaseUrlConfigured. */
  serverUrlConfigured?: boolean;
  apiBaseUrlConfigured?: boolean;
  capacitorServerUrlConfigured?: boolean;
  apiHostClass?: CvAiDiagnosticBuildIdentity['apiHostClass'];
  internalBuildContractUsed?: boolean | null;
}): CvAiDiagnosticBuildIdentity {
  const commit = options?.sourceCommitShort != null
    ? {
      sourceCommitShort: options.sourceCommitShort,
      sourceCommitStatus: options.sourceCommitStatus
        || (options.sourceCommitShort ? 'embedded' as const : 'unavailable_by_contract' as const),
    }
    : resolveSourceCommitShort();
  const apiConfigured = options?.apiBaseUrlConfigured
    ?? options?.serverUrlConfigured
    ?? false;
  const capacitorConfigured = options?.capacitorServerUrlConfigured ?? false;
  const assetRevision = options?.assetRevision
    || (INTERNAL_AI_RESET_ENABLED ? CV_AI_DIAGNOSTICS_V2_299_REVISION : '')
    || INTERNAL_AI_DIAGNOSTICS_REVISION
    || 'unknown';
  return {
    diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
    compiledDiagnosticMarker: CV_AI_DIAGNOSTIC_BUNDLE_MARKER,
    assetRevision,
    cvAiDiagnosticsV2299Revision: INTERNAL_AI_RESET_ENABLED
      ? CV_AI_DIAGNOSTICS_V2_299_REVISION
      : undefined,
    internalDiagnosticsEnabled: Boolean(INTERNAL_AI_RESET_ENABLED),
    internalResetEnabled: Boolean(INTERNAL_AI_RESET_ENABLED),
    internalBuildContractUsed: options?.internalBuildContractUsed
      ?? (INTERNAL_AI_RESET_ENABLED ? true : false),
    serverUrlConfigured: Boolean(apiConfigured),
    apiBaseUrlConfigured: Boolean(apiConfigured),
    capacitorServerUrlConfigured: Boolean(capacitorConfigured),
    apiHostClass: options?.apiHostClass
      || (apiConfigured ? 'production' : (capacitorConfigured ? 'unknown' : 'relative')),
    sourceCommitShort: commit.sourceCommitShort,
    sourceCommitStatus: commit.sourceCommitStatus,
  };
}

export function buildHindiSentenceGrammarRecords(input: {
  sentenceHashes?: string[] | null;
  sentenceRoleSlots?: string[] | null;
  hindiSentenceHasFiniteCopulaOrVerb?: boolean[] | null;
  hindiNominalExperienceFragmentDetected?: boolean | null;
  hindiStandaloneJahanFragmentDetected?: boolean | null;
  hindiGrammarRejectionReason?: string | null;
  hindiCurrentIntroFiniteVerbPresent?: boolean | null;
  hindiCurrentDutyAuxiliaryPresent?: boolean | null;
}): CvAiDiagnosticSentenceGrammarRecord[] {
  const hashes = input.sentenceHashes || [];
  const slots = input.sentenceRoleSlots || [];
  const finite = input.hindiSentenceHasFiniteCopulaOrVerb || [];
  const n = Math.max(hashes.length, slots.length, finite.length);
  const records: CvAiDiagnosticSentenceGrammarRecord[] = [];
  for (let i = 0; i < n; i += 1) {
    const roleSlot = slots[i] || 'other';
    const hasFinite = finite[i] ?? false;
    const reasons: string[] = [];
    let nominal = false;
    let jahan = false;
    if (roleSlot === 'current_duty' && input.hindiNominalExperienceFragmentDetected && !hasFinite) {
      nominal = true;
      reasons.push('nominal_experience_fragment');
    }
    if (roleSlot === 'current_duty' && input.hindiStandaloneJahanFragmentDetected) {
      jahan = true;
      reasons.push('standalone_relative_fragment');
    }
    if (roleSlot === 'current_intro' && input.hindiCurrentIntroFiniteVerbPresent === false) {
      reasons.push('missing_finite_copula');
    }
    if (roleSlot === 'current_duty' && input.hindiCurrentDutyAuxiliaryPresent === false && !nominal) {
      reasons.push('missing_finite_auxiliary');
    }
    if (!hasFinite && reasons.length === 0 && input.hindiGrammarRejectionReason) {
      if (isGrammarRejectionCategory(input.hindiGrammarRejectionReason)) {
        reasons.push(input.hindiGrammarRejectionReason);
      }
    }
    records.push({
      sentenceHash: hashes[i] || fingerprintText(`unit:${i}`),
      roleSlot,
      hasFiniteVerb: hasFinite,
      hasFiniteCopula: hasFinite && (roleSlot === 'current_intro' || roleSlot === 'current_duty'),
      hasRequiredAuxiliary: roleSlot === 'current_duty' ? hasFinite : true,
      nominalFragmentDetected: nominal,
      standaloneRelativeFragmentDetected: jahan,
      grammarPassed: hasFinite && reasons.length === 0,
      grammarReasons: dedupeStableStrings(reasons),
    });
  }
  return records;
}

type SummaryLike = {
  finalCandidateSource?: string | null;
  providerCandidatePresent?: boolean;
  deterministicCandidatePresent?: boolean;
  fallbackApplied?: boolean;
  visibleApplySucceeded?: boolean;
  visibleSummaryMatchesFinalHash?: boolean | null;
  countedAsSuccess?: boolean;
  usageCountBefore?: number;
  usageCountAfter?: number;
  grammarValidationPassed?: boolean;
  hindiIncompleteSentenceCount?: number | null;
  hindiNominalExperienceFragmentDetected?: boolean | null;
  hindiGrammarRejectionReason?: string | null;
  hindiGrammarRejectionReasons?: string[] | null;
  groundingValidationPassed?: boolean;
  unsupportedClaimCount?: number;
  finalUnsupportedDesignMediumCount?: number | null;
  finalUnsupportedDesignMediumKinds?: string[] | null;
  durationValidationPassed?: boolean;
  independentFinalDurationClaimCount?: number | null;
  structuredDurationMonths?: number | null;
  raceGuardResult?: string | null;
  finalValidatedCandidateHash?: string | null;
  groundingInputCandidateHash?: string | null;
  deterministicCandidateHash?: string | null;
  deterministicCandidateSentenceCount?: number | null;
  groundingInputEqualsFinalValidatedCandidate?: boolean | null;
  visibleCandidateHashAfterApply?: string | null;
  finalUnitRoleSlots?: string[] | null;
  currentIntroSlotPresent?: boolean | null;
  currentDutySlotPresent?: boolean | null;
  priorRoleSlotPresent?: boolean | null;
  wrongLocaleUnitCount?: number;
  internalDiagnosticsEnabled?: boolean;
  internalResetEnabled?: boolean;
  requestedLocale?: string;
  operationMode?: string | null;
  meaningfulChangeDetected?: boolean | null;
  finalMatchesSourceAfterNormalization?: boolean | null;
  noOpDetected?: boolean | null;
  serverFallbackUsed?: boolean | null;
  providerOutcome?: string | null;
  providerUnsupportedClaimCount?: number | null;
  providerRejectionReason?: string | null;
  providerTypedRejectionReason?: string | null;
  providerSlotRejectionReasons?: string[] | null;
  clientFallbackUsed?: boolean | null;
  clientDeterministicFallbackAttempted?: boolean | null;
  clientRepairAttempted?: boolean | null;
  summaryRepairAttempted?: boolean | null;
  sourceWasEmpty?: boolean | null;
  finalSentenceHashes?: string[] | null;
  unitCount?: number | null;
  finalDurationScopeValidationPassed?: boolean | null;
  finalDurationCurrentRoleAttachmentRisk?: boolean | null;
  finalDurationOwnerExpected?: string | null;
  finalDurationOwnerDetected?: string | null;
  visibleDurationOwnerDetected?: string | null;
  competencyInferenceFromRoleForbidden?: boolean | null;
  finalUnitSemanticRolesByUnit?: string[][] | null;
  finalSentenceSemanticRolesBySentence?: string[][] | null;
  finalCurrentEmployerPresent?: boolean | null;
  finalPriorEmployerPresent?: boolean | null;
  finalCurrentEmploymentStateExpressed?: boolean | null;
  finalPriorEmploymentStateExpressed?: boolean | null;
  finalCurrentRoleIntroValidationPassed?: boolean | null;
  finalPriorRoleIntroValidationPassed?: boolean | null;
  finalSlotValidationPassed?: boolean | null;
  repairAccepted?: boolean | null;
  repairCandidatePresent?: boolean | null;
  repairRawCandidatePresent?: boolean | null;
  repairRawCandidateHash?: string | null;
  repairRawCandidateLength?: number | null;
  repairParseAttempted?: boolean | null;
  repairParseSucceeded?: boolean | null;
  repairParsedUnitCount?: number | null;
  repairParsedSentenceCount?: number | null;
  repairUsableCandidatePresent?: boolean | null;
  repairTypedFailureReason?: string | null;
  repairCandidateHash?: string | null;
  providerAccepted?: boolean | null;
  providerCandidateHash?: string | null;
  repairSelected?: boolean | null;
  repairApplied?: boolean | null;
  repairAcceptedTransformationKinds?: string[] | null;
  repairAppliedTransformationKinds?: string[] | null;
  repairAttemptedTransformationKinds?: string[] | null;
  repairRoleLocalizationTransformationKinds?: string[] | null;
  deterministicAccepted?: boolean | null;
  requiredCurrentDutyFactCount?: number | null;
  coveredCurrentDutyFactCount?: number | null;
  requiredPriorDutyFactCount?: number | null;
  coveredPriorDutyFactCount?: number | null;
  finalPriorDutyCoveragePassed?: boolean | null;
  priorRoleGroundingPassed?: boolean | null;
  currentRoleTitlePresent?: boolean | null;
  currentRoleConcreteFactCoverage?: number | null;
  finalCurrentDutyCoveragePassed?: boolean | null;
  germanControlledCaseGrammarPassed?: boolean | null;
  authoritativeCurrentDutyFactCount?: number | null;
  authoritativeCanonicalCurrentDutyFactCount?: number | null;
  classifiedRequiredCurrentDutyFactCount?: number | null;
  unclassifiedAuthoritativeCurrentDutyFactCount?: number | null;
  requiredFactSetMatchesAuthoritativeFactSet?: boolean | null;
  currentDutyRequiredFactParityPassed?: boolean | null;
  finalPostconditionsPassed?: boolean | null;
  structuredRoleLocaleValidationPassed?: boolean | null;
  currentRoleLocalizationValidationPassed?: boolean | null;
  priorRoleLocalizationValidationPassed?: boolean | null;
  foreignStructuredRoleTitleCount?: number | null;
  foreignPriorRoleTitleCount?: number | null;
  rawSourceRoleLeakageDetected?: boolean | null;
  finalWrongLocaleStructuredRoleCount?: number | null;
  finalStructuredRoleLocaleValidationPassed?: boolean | null;
  providerStructuredRoleLocaleValidationPassed?: boolean | null;
  providerForeignRoleTitleCount?: number | null;
  repairStructuredRoleLocaleValidationPassed?: boolean | null;
  repairForeignRoleTitleCount?: number | null;
  finalForeignRoleTitleCount?: number | null;
  visibleStructuredRoleLocaleValidationPassed?: boolean | null;
  visibleWrongLocaleStructuredRoleCount?: number | null;
  visibleRequiredCurrentDutyFactCount?: number | null;
  visibleCoveredCurrentDutyFactCount?: number | null;
  visibleMissingCurrentDutyFactCount?: number | null;
  visibleCurrentDutyCoveragePassed?: boolean | null;
  visibleCurrentDutyRequiredFactParityPassed?: boolean | null;
  visibleCurrentDutyRequiredFactCountMatchesFinal?: boolean | null;
  visibleCurrentDutyRequiredFactSetHash?: string | null;
  finalCurrentDutyRequiredFactSetHash?: string | null;
  sourceLanguageLeakageDetected?: boolean | null;
  targetLocalePurityPassed?: boolean | null;
  detectedLocaleByUnit?: string[] | null;
  unexpectedLocaleCodes?: string[] | null;
  finalUnsupportedCompetencyCount?: number | null;
  finalCurrentIntroSlotPresent?: boolean | null;
  finalCurrentDutySlotPresent?: boolean | null;
  finalPriorIntroSlotPresent?: boolean | null;
  finalPriorDutySlotPresent?: boolean | null;
  finalTotalDurationSlotPresent?: boolean | null;
  candidateLineage?: Array<{
    candidateKind?: string;
    present?: boolean;
    accepted?: boolean;
    hash?: string | null;
    unitCount?: number;
    unitHashes?: string[];
    sentenceHashes?: string[];
    selectedSource?: string | null;
    rejectionReasons?: string[];
    diagnosticPayloadTruncated?: boolean;
  }> | null;
  sourceCommitShort?: string | null;
  sourceCommitStatus?: string | null;
  capacitorServerUrlConfigured?: boolean | null;
  apiBaseUrlConfigured?: boolean | null;
  diagnosticPayloadTruncated?: boolean | null;
};

export function checkSummaryDiagnosticInvariants(
  trace: SummaryLike,
): { passed: boolean; failures: CvAiDiagnosticInvariantFailure[] } {
  const failures: CvAiDiagnosticInvariantFailure[] = [];
  const push = (code: string, observed: CvAiDiagnosticInvariantFailure['observed']) => {
    failures.push({ invariantCode: code, observed });
  };

  const src = trace.finalCandidateSource || '';
  if (src.includes('provider') || src === 'ai_generated') {
    if (trace.providerCandidatePresent === false) {
      push('final_source_provider_but_provider_absent', {
        finalCandidateSource: src,
        providerCandidatePresent: false,
      });
    }
  }
  if (src.includes('repair') || src === 'ai_repaired' || src === 'repaired_provider') {
    if (trace.repairApplied === false && trace.fallbackApplied !== true) {
      // duration-only ai_repaired is allowed without summary repairApplied
    }
  }
  // AAB-321: material repair forbids finalCandidateSource ai_generated.
  if (
    (trace.repairAccepted === true || src === 'repaired_provider')
    && src === 'ai_generated'
  ) {
    push('material_repair_forbids_ai_generated_final_source', {
      finalCandidateSource: src,
      repairAccepted: true,
    });
  }
  if (
    src === 'repaired_provider'
    && trace.providerAccepted === true
  ) {
    push('repaired_provider_requires_provider_rejected', {
      finalCandidateSource: src,
      providerAccepted: true,
    });
  }
  if (
    src === 'repaired_provider'
    && trace.repairCandidatePresent === false
    && trace.repairAccepted !== true
  ) {
    push('repaired_provider_requires_repair_candidate', {
      finalCandidateSource: src,
      repairCandidatePresent: false,
    });
  }
  if (
    Array.isArray(trace.finalUnitSemanticRolesByUnit)
    && trace.finalUnitSemanticRolesByUnit.length > 0
  ) {
    void SUMMARY_MULTI_ROLE_SLOT_DIAGNOSTICS_321_REVISION;
    const roles = trace.finalUnitSemanticRolesByUnit;
    const hasCurrent = roles.some((r) => r.includes('current_role_intro'));
    const hasDuty = roles.some((r) => r.includes('current_role_duties'));
    const hasPrior = roles.some((r) => (
      r.includes('prior_role_intro') || r.includes('prior_role_duties')
    ));
    if (trace.currentIntroSlotPresent === true && !hasCurrent) {
      push('slot_boolean_not_derivable_from_semantic_roles', {
        currentIntroSlotPresent: true,
        hasCurrentRoleIntroInSemanticRoles: false,
      });
    }
    if (trace.currentDutySlotPresent === true && !hasDuty && !hasCurrent) {
      push('slot_boolean_not_derivable_from_semantic_roles', {
        currentDutySlotPresent: true,
        hasCurrentDutyInSemanticRoles: false,
      });
    }
    if (trace.priorRoleSlotPresent === true && !hasPrior) {
      push('slot_boolean_not_derivable_from_semantic_roles', {
        priorRoleSlotPresent: true,
        hasPriorInSemanticRoles: false,
      });
    }
  }
  if (
    trace.countedAsSuccess
    && String(trace.requestedLocale || '') === 'de'
    && trace.finalSlotValidationPassed === false
  ) {
    push('german_success_requires_final_slot_validation', {
      countedAsSuccess: true,
      finalSlotValidationPassed: false,
    });
  }
  if (
    trace.countedAsSuccess
    && String(trace.requestedLocale || '') === 'de'
    && trace.finalCurrentRoleIntroValidationPassed === false
  ) {
    push('german_success_requires_current_role_intro_validation', {
      countedAsSuccess: true,
      finalCurrentRoleIntroValidationPassed: false,
    });
  }
  if (
    trace.countedAsSuccess
    && String(trace.requestedLocale || '') === 'de'
    && trace.finalPriorRoleIntroValidationPassed === false
  ) {
    push('german_success_requires_prior_role_intro_validation', {
      countedAsSuccess: true,
      finalPriorRoleIntroValidationPassed: false,
    });
  }
  // AAB-322: structured role locale purity.
  void SUMMARY_STRUCTURED_ENTITY_LOCALE_VALIDATION_322_REVISION;
  if (
    String(trace.requestedLocale || '') === 'de'
    && trace.targetLocalePurityPassed === true
    && (trace.foreignStructuredRoleTitleCount ?? 0) > 0
  ) {
    push('target_purity_forbids_foreign_structured_roles', {
      targetLocalePurityPassed: true,
      foreignStructuredRoleTitleCount: trace.foreignStructuredRoleTitleCount ?? 0,
    });
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && trace.sourceLanguageLeakageDetected === false
    && trace.rawSourceRoleLeakageDetected === true
  ) {
    push('source_leakage_false_with_raw_role_alias', {
      sourceLanguageLeakageDetected: false,
      rawSourceRoleLeakageDetected: true,
    });
  }
  if (
    trace.countedAsSuccess
    && String(trace.requestedLocale || '') === 'de'
    && trace.structuredRoleLocaleValidationPassed === false
  ) {
    push('german_success_requires_structured_role_locale', {
      countedAsSuccess: true,
      structuredRoleLocaleValidationPassed: false,
    });
  }
  if (
    trace.countedAsSuccess
    && String(trace.requestedLocale || '') === 'de'
    && (trace.foreignPriorRoleTitleCount ?? 0) > 0
  ) {
    push('german_success_forbids_foreign_prior_role', {
      countedAsSuccess: true,
      foreignPriorRoleTitleCount: trace.foreignPriorRoleTitleCount ?? 0,
    });
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && (trace.wrongLocaleUnitCount ?? 0) === 0
    && (trace.foreignStructuredRoleTitleCount ?? 0) > 0
    && trace.targetLocalePurityPassed === true
  ) {
    push('unit_locale_ok_cannot_hide_foreign_structured_role', {
      wrongLocaleUnitCount: 0,
      foreignStructuredRoleTitleCount: trace.foreignStructuredRoleTitleCount ?? 0,
      targetLocalePurityPassed: true,
    });
  }
  if (
    trace.visibleApplySucceeded
    && String(trace.requestedLocale || '') === 'de'
    && trace.visibleStructuredRoleLocaleValidationPassed === false
  ) {
    push('visible_apply_requires_structured_role_locale', {
      visibleApplySucceeded: true,
      visibleStructuredRoleLocaleValidationPassed: false,
    });
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && Array.isArray(trace.repairRoleLocalizationTransformationKinds)
    && (trace.repairRoleLocalizationTransformationKinds as string[]).some((k) =>
      /role_title_localized|foreign_role_title_replaced/.test(String(k)))
    && (trace.repairCandidateHash || '')
    && (trace.providerCandidateHash || '')
    && trace.repairCandidateHash === trace.providerCandidateHash
  ) {
    push('role_localization_must_change_repair_hash', {
      repairCandidateHash: trace.repairCandidateHash ?? null,
      providerCandidateHash: trace.providerCandidateHash ?? null,
    });
  }
  if (
    typeof trace.requiredCurrentDutyFactCount === 'number'
    && typeof trace.authoritativeCurrentDutyFactCount === 'number'
    && trace.authoritativeCurrentDutyFactCount > 0
    && trace.requiredCurrentDutyFactCount < trace.authoritativeCurrentDutyFactCount
  ) {
    push('required_duty_count_below_authoritative', {
      requiredCurrentDutyFactCount: trace.requiredCurrentDutyFactCount,
      authoritativeCurrentDutyFactCount: trace.authoritativeCurrentDutyFactCount,
    });
  }
  if (
    trace.currentDutyRequiredFactParityPassed === false
    && trace.finalPostconditionsPassed === true
  ) {
    push('parity_failure_forbids_final_postconditions', {
      currentDutyRequiredFactParityPassed: false,
      finalPostconditionsPassed: true,
    });
  }
  if (
    trace.requiredFactSetMatchesAuthoritativeFactSet === false
    && trace.visibleApplySucceeded === true
  ) {
    push('parity_mismatch_forbids_visible_apply', {
      requiredFactSetMatchesAuthoritativeFactSet: false,
      visibleApplySucceeded: true,
    });
  }
  // AAB-323: repair selection / apply truth.
  void SUMMARY_REPAIR_SELECTION_TRUTH_323_REVISION;
  if (trace.repairApplied === true && trace.repairAccepted !== true) {
    push('repair_applied_requires_accepted', {
      repairApplied: true,
      repairAccepted: trace.repairAccepted ?? null,
    });
  }
  if (trace.repairApplied === true && trace.repairSelected !== true
    && trace.finalCandidateSource !== 'repaired_provider') {
    push('repair_applied_requires_selected', {
      repairApplied: true,
      repairSelected: trace.repairSelected ?? null,
      finalCandidateSource: trace.finalCandidateSource || null,
    });
  }
  if (
    trace.finalCandidateSource === 'deterministic_fallback'
    && trace.repairApplied === true
  ) {
    push('deterministic_forbids_repair_applied', {
      finalCandidateSource: 'deterministic_fallback',
      repairApplied: true,
    });
  }
  if (
    trace.finalCandidateSource === 'deterministic_fallback'
    && trace.repairSelected === true
  ) {
    push('deterministic_forbids_repair_selected', {
      finalCandidateSource: 'deterministic_fallback',
      repairSelected: true,
    });
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && trace.finalCurrentDutyCoveragePassed === true
    && typeof trace.requiredCurrentDutyFactCount === 'number'
    && typeof trace.coveredCurrentDutyFactCount === 'number'
    && trace.coveredCurrentDutyFactCount !== trace.requiredCurrentDutyFactCount
  ) {
    push('duty_coverage_pass_requires_full_count', {
      coveredCurrentDutyFactCount: trace.coveredCurrentDutyFactCount,
      requiredCurrentDutyFactCount: trace.requiredCurrentDutyFactCount,
    });
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && typeof trace.currentRoleConcreteFactCoverage === 'number'
    && typeof trace.coveredCurrentDutyFactCount === 'number'
    && trace.currentRoleConcreteFactCoverage !== trace.coveredCurrentDutyFactCount
  ) {
    push('concrete_coverage_must_equal_covered_duty_facts', {
      currentRoleConcreteFactCoverage: trace.currentRoleConcreteFactCoverage,
      coveredCurrentDutyFactCount: trace.coveredCurrentDutyFactCount,
    });
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && trace.finalPostconditionsPassed === true
    && trace.germanControlledCaseGrammarPassed === false
  ) {
    push('postconditions_require_controlled_german_grammar', {
      finalPostconditionsPassed: true,
      germanControlledCaseGrammarPassed: false,
    });
  }
  if (src === 'deterministic_fallback') {
    if (trace.deterministicCandidatePresent === false) {
      push('final_source_deterministic_but_candidate_absent', {
        finalCandidateSource: src,
        deterministicCandidatePresent: false,
      });
    }
  }
  if (trace.visibleApplySucceeded && trace.visibleSummaryMatchesFinalHash === false) {
    push('visible_apply_hash_mismatch', {
      visibleApplySucceeded: true,
      visibleSummaryMatchesFinalHash: false,
    });
  }
  if (trace.countedAsSuccess && !trace.visibleApplySucceeded) {
    push('success_counted_but_apply_failed', {
      countedAsSuccess: true,
      visibleApplySucceeded: false,
    });
  }
  if (trace.countedAsSuccess && trace.visibleApplySucceeded) {
    const before = trace.usageCountBefore ?? 0;
    const after = trace.usageCountAfter ?? 0;
    if (after !== before + 1) {
      push('usage_increment_mismatch_success', {
        usageCountBefore: before,
        usageCountAfter: after,
      });
    }
  }
  if (!trace.countedAsSuccess && !trace.visibleApplySucceeded) {
    const before = trace.usageCountBefore ?? 0;
    const after = trace.usageCountAfter ?? 0;
    if (after !== before) {
      push('usage_changed_after_failed_apply', {
        usageCountBefore: before,
        usageCountAfter: after,
      });
    }
  }
  if (trace.grammarValidationPassed
    && (trace.hindiIncompleteSentenceCount ?? 0) > 0) {
    push('grammar_passed_with_incomplete_sentences', {
      grammarValidationPassed: true,
      hindiIncompleteSentenceCount: trace.hindiIncompleteSentenceCount ?? 0,
    });
  }
  if (trace.grammarValidationPassed && trace.hindiNominalExperienceFragmentDetected) {
    push('grammar_passed_with_nominal_fragment', {
      grammarValidationPassed: true,
      hindiNominalExperienceFragmentDetected: true,
    });
  }
  if (trace.groundingValidationPassed && (trace.unsupportedClaimCount ?? 0) > 0) {
    push('grounding_passed_with_unsupported_claims', {
      groundingValidationPassed: true,
      unsupportedClaimCount: trace.unsupportedClaimCount ?? 0,
    });
  }
  if (trace.groundingValidationPassed
    && (trace.finalUnsupportedDesignMediumCount ?? 0) > 0) {
    push('grounding_passed_with_unsupported_medium', {
      groundingValidationPassed: true,
      finalUnsupportedDesignMediumCount: trace.finalUnsupportedDesignMediumCount ?? 0,
    });
  }
  if (trace.durationValidationPassed
    && (trace.structuredDurationMonths ?? 0) > 0
    && (trace.independentFinalDurationClaimCount ?? 0) !== 1
    && trace.countedAsSuccess) {
    push('duration_passed_but_final_count_not_one', {
      independentFinalDurationClaimCount: trace.independentFinalDurationClaimCount ?? 0,
      structuredDurationMonths: trace.structuredDurationMonths ?? 0,
    });
  }
  if (trace.raceGuardResult === 'fail' && trace.visibleApplySucceeded) {
    push('race_failed_but_apply_succeeded', {
      raceGuardResult: 'fail',
      visibleApplySucceeded: true,
    });
  }
  if (trace.targetLocalePurityPassed && (trace.wrongLocaleUnitCount ?? 0) > 0) {
    push('locale_purity_passed_with_wrong_locale_units', {
      targetLocalePurityPassed: true,
      wrongLocaleUnitCount: trace.wrongLocaleUnitCount ?? 0,
    });
  }
  if (trace.countedAsSuccess && Array.isArray(trace.finalUnitRoleSlots)) {
    const slots = trace.finalUnitRoleSlots;
    const dutyOk = slots.includes('current_duty') || trace.currentDutySlotPresent === true;
    if (!slots.includes('current_intro') || !dutyOk) {
      push('three_slot_incomplete_on_success', {
        finalUnitRoleSlots: slots.join(','),
      });
    }
  }

  // AAB-319 — German Summary competency + duration-scope acceptance invariants.
  if (String(trace.requestedLocale || '') === 'de' && trace.countedAsSuccess) {
    if ((trace.unsupportedClaimCount ?? 0) > 0) {
      push('german_success_with_unsupported_competency', {
        unsupportedClaimCount: trace.unsupportedClaimCount ?? 0,
      });
    }
    if (trace.finalDurationScopeValidationPassed === false) {
      push('german_success_with_duration_scope_fail', {
        finalDurationScopeValidationPassed: false,
      });
    }
    if (trace.finalDurationCurrentRoleAttachmentRisk === true) {
      push('german_success_with_current_role_duration_attachment', {
        finalDurationCurrentRoleAttachmentRisk: true,
      });
    }
    if (
      trace.finalDurationOwnerExpected === 'total_professional_experience'
      && trace.finalDurationOwnerDetected
      && trace.finalDurationOwnerDetected !== 'total_professional_experience'
    ) {
      push('german_duration_owner_mismatch', {
        finalDurationOwnerExpected: String(trace.finalDurationOwnerExpected),
        finalDurationOwnerDetected: String(trace.finalDurationOwnerDetected),
      });
    }
    if (
      trace.visibleDurationOwnerDetected
      && trace.finalDurationOwnerDetected
      && trace.visibleDurationOwnerDetected !== trace.finalDurationOwnerDetected
    ) {
      push('german_visible_duration_owner_mismatch', {
        finalDurationOwnerDetected: String(trace.finalDurationOwnerDetected),
        visibleDurationOwnerDetected: String(trace.visibleDurationOwnerDetected),
      });
    }
    if (trace.competencyInferenceFromRoleForbidden === false) {
      push('german_competency_inference_allowed', {
        competencyInferenceFromRoleForbidden: false,
      });
    }
    if (Array.isArray(trace.finalUnitRoleSlots) && trace.finalUnitRoleSlots.length === 0) {
      push('german_final_role_slots_empty', {
        finalUnitRoleSlots: '',
      });
    }
  }

  // AAB-325 — English Summary shared final-gate invariants.
  if (String(trace.requestedLocale || '') === 'en') {
    const detected = Array.isArray(trace.detectedLocaleByUnit)
      ? (trace.detectedLocaleByUnit as unknown[])
      : [];
    const unexpected = Array.isArray(trace.unexpectedLocaleCodes)
      ? (trace.unexpectedLocaleCodes as unknown[]).map(String)
      : [];
    if (detected.includes('es') || unexpected.includes('es')) {
      if (trace.targetLocalePurityPassed === true) {
        push('english_es_detected_but_locale_purity_passed', {
          targetLocalePurityPassed: true,
          unexpectedLocaleCodes: unexpected.join(','),
        });
      }
      if ((trace.wrongLocaleUnitCount ?? 0) < 1) {
        push('english_es_detected_but_wrong_locale_count_zero', {
          wrongLocaleUnitCount: trace.wrongLocaleUnitCount ?? 0,
        });
      }
      if (trace.sourceLanguageLeakageDetected === false) {
        push('english_es_detected_but_leakage_false', {
          sourceLanguageLeakageDetected: false,
        });
      }
      if (trace.countedAsSuccess) {
        push('english_success_with_spanish_unit', {
          countedAsSuccess: true,
        });
      }
    }
    if (trace.countedAsSuccess) {
      if ((trace.finalUnsupportedCompetencyCount ?? trace.unsupportedClaimCount ?? 0) > 0) {
        push('english_success_with_unsupported_competency', {
          finalUnsupportedCompetencyCount:
            trace.finalUnsupportedCompetencyCount ?? trace.unsupportedClaimCount ?? 0,
        });
      }
      if (trace.finalDurationCurrentRoleAttachmentRisk === true) {
        push('english_success_with_current_role_duration_attachment', {
          finalDurationCurrentRoleAttachmentRisk: true,
        });
      }
      if (trace.finalDurationScopeValidationPassed === false) {
        push('english_success_with_duration_scope_fail', {
          finalDurationScopeValidationPassed: false,
        });
      }
      const slots = Array.isArray(trace.finalUnitRoleSlots)
        ? (trace.finalUnitRoleSlots as string[])
        : [];
      const semantic = Array.isArray(trace.finalUnitSemanticRolesByUnit)
        ? (trace.finalUnitSemanticRolesByUnit as string[][])
        : [];
      const hasSemantic = semantic.some((u) =>
        u.includes('current_role_intro')
        || u.includes('prior_role_intro')
        || u.includes('total_duration'));
      if (
        slots.length > 0
        && slots.every((s) => s === 'summary_unit' || s === 'ambiguous' || s === 'ai_generated')
        && !hasSemantic
      ) {
        push('english_success_with_generic_only_slots', {
          finalUnitRoleSlots: slots.join(','),
        });
      }
      if (!slots.includes('current_intro') && !hasSemantic) {
        push('english_success_missing_current_intro_slot', {
          finalUnitRoleSlots: slots.join(','),
        });
      }
      if (
        Number(trace.requiredPriorDutyFactCount ?? 0) > 0
        && trace.finalPriorDutyCoveragePassed !== true
      ) {
        push('english_success_with_prior_duty_coverage_fail', {
          finalPriorDutyCoveragePassed: trace.finalPriorDutyCoveragePassed ?? null,
        });
      }
      const nullCritical = [
        'currentRoleConcreteFactCoverage',
        'priorRoleGroundingPassed',
        'currentRoleTitlePresent',
        'finalUnitSemanticRolesByUnit',
        'finalCurrentEmployerPresent',
        'finalPriorEmployerPresent',
        'finalCurrentDutyCoveragePassed',
        'finalPriorDutyCoveragePassed',
        'finalSlotValidationPassed',
        'structuredRoleLocaleValidationPassed',
        'finalUnsupportedCompetencyCount',
        'finalDurationOwnerDetected',
        'finalDurationScopeValidationPassed',
      ].filter((k) => (trace as Record<string, unknown>)[k] == null);
      if (nullCritical.length > 0) {
        push('english_success_with_null_decision_fields', {
          nullFields: nullCritical.join(','),
        });
      }
    }
    // AAB-326 — visible current required-fact parity / fail-closed 0/0.
    // Only after a real visible apply recorded a candidate hash (not pre-apply provisional).
    const visibleValidated = trace.visibleCandidateHashAfterApply != null
      && typeof trace.visibleRequiredCurrentDutyFactCount === 'number';
    if (
      visibleValidated
      && (
        Number(trace.authoritativeCurrentDutyFactCount ?? 0) > 0
        || Number(trace.requiredCurrentDutyFactCount ?? 0) > 0
      )
    ) {
      if (
        trace.visibleApplySucceeded === true
        && Number(trace.visibleRequiredCurrentDutyFactCount ?? 0) === 0
      ) {
        push('english_visible_current_required_set_missing', {
          visibleRequiredCurrentDutyFactCount:
            trace.visibleRequiredCurrentDutyFactCount ?? 0,
          requiredCurrentDutyFactCount: trace.requiredCurrentDutyFactCount ?? 0,
          authoritativeCurrentDutyFactCount:
            trace.authoritativeCurrentDutyFactCount ?? 0,
        });
      }
      if (
        typeof trace.visibleRequiredCurrentDutyFactCount === 'number'
        && typeof trace.requiredCurrentDutyFactCount === 'number'
        && trace.visibleRequiredCurrentDutyFactCount !== trace.requiredCurrentDutyFactCount
      ) {
        push('english_visible_current_required_count_mismatch', {
          visibleRequiredCurrentDutyFactCount: trace.visibleRequiredCurrentDutyFactCount,
          requiredCurrentDutyFactCount: trace.requiredCurrentDutyFactCount,
        });
      }
      if (
        trace.visibleCurrentDutyRequiredFactParityPassed === false
        && (trace.countedAsSuccess || trace.visibleApplySucceeded)
      ) {
        push('english_visible_current_required_fact_parity_failed', {
          visibleCurrentDutyRequiredFactParityPassed: false,
        });
      }
      if (
        typeof trace.visibleCurrentDutyRequiredFactSetHash === 'string'
        && typeof trace.finalCurrentDutyRequiredFactSetHash === 'string'
        && trace.visibleCurrentDutyRequiredFactSetHash
          !== trace.finalCurrentDutyRequiredFactSetHash
        && (trace.countedAsSuccess || trace.visibleApplySucceeded)
      ) {
        push('english_visible_current_required_fact_set_hash_mismatch', {
          visibleCurrentDutyRequiredFactSetHash:
            trace.visibleCurrentDutyRequiredFactSetHash,
          finalCurrentDutyRequiredFactSetHash:
            trace.finalCurrentDutyRequiredFactSetHash,
        });
      }
      if (
        trace.visibleCurrentDutyCoveragePassed === true
        && (
          Number(trace.visibleRequiredCurrentDutyFactCount ?? 0) === 0
          || Number(trace.visibleCoveredCurrentDutyFactCount ?? 0)
            !== Number(trace.visibleRequiredCurrentDutyFactCount ?? 0)
          || Number(trace.visibleMissingCurrentDutyFactCount ?? 0) !== 0
          || trace.visibleCurrentDutyRequiredFactParityPassed === false
        )
      ) {
        push('english_visible_current_coverage_pass_without_proof', {
          visibleCurrentDutyCoveragePassed: true,
          visibleRequiredCurrentDutyFactCount:
            trace.visibleRequiredCurrentDutyFactCount ?? 0,
          visibleCoveredCurrentDutyFactCount:
            trace.visibleCoveredCurrentDutyFactCount ?? 0,
          visibleMissingCurrentDutyFactCount:
            trace.visibleMissingCurrentDutyFactCount ?? 0,
          visibleCurrentDutyRequiredFactParityPassed:
            trace.visibleCurrentDutyRequiredFactParityPassed ?? null,
        });
      }
      if (
        Number(trace.visibleCoveredCurrentDutyFactCount ?? 0)
          > Number(trace.visibleRequiredCurrentDutyFactCount ?? 0)
      ) {
        push('english_visible_covered_exceeds_required', {
          visibleCoveredCurrentDutyFactCount:
            trace.visibleCoveredCurrentDutyFactCount ?? 0,
          visibleRequiredCurrentDutyFactCount:
            trace.visibleRequiredCurrentDutyFactCount ?? 0,
        });
      }
      if (
        trace.visibleApplySucceeded === true
        && trace.visibleCurrentDutyCoveragePassed !== true
      ) {
        push('english_visible_apply_without_current_coverage', {
          visibleApplySucceeded: true,
          visibleCurrentDutyCoveragePassed:
            trace.visibleCurrentDutyCoveragePassed ?? null,
        });
      }
      if (
        trace.countedAsSuccess
        && Number(trace.usageCountAfter ?? 0) > Number(trace.usageCountBefore ?? 0)
        && trace.visibleCurrentDutyRequiredFactParityPassed !== true
      ) {
        push('english_usage_without_visible_required_parity', {
          countedAsSuccess: true,
          visibleCurrentDutyRequiredFactParityPassed:
            trace.visibleCurrentDutyRequiredFactParityPassed ?? null,
        });
      }
    }
    // AAB-326 — lineage hash + semantic role truth.
    void 0; // markers referenced via runtime imports elsewhere
    const lineage = Array.isArray(trace.candidateLineage)
      ? (trace.candidateLineage as Array<Record<string, unknown>>)
      : [];
    const detRec = lineage.find((c) => c.candidateKind === 'client_deterministic');
    const finalRec = lineage.find((c) => c.candidateKind === 'final_selected');
    if (
      detRec
      && finalRec
      && detRec.accepted === true
      && finalRec.selectedSource === 'client_deterministic'
      && typeof detRec.hash === 'string'
      && typeof finalRec.hash === 'string'
      && detRec.hash === finalRec.hash
    ) {
      const detUnits = Array.isArray(detRec.unitHashes) ? detRec.unitHashes.map(String) : [];
      const finalUnits = Array.isArray(finalRec.unitHashes) ? finalRec.unitHashes.map(String) : [];
      if (detUnits.join('|') !== finalUnits.join('|')) {
        push('selected_deterministic_unit_hash_mismatch', {
          deterministicHash: String(detRec.hash),
          finalHash: String(finalRec.hash),
          detUnitHashCount: detUnits.length,
          finalUnitHashCount: finalUnits.length,
        });
      }
      const detSent = Array.isArray(detRec.sentenceHashes)
        ? detRec.sentenceHashes.map(String)
        : [];
      const finalSent = Array.isArray(finalRec.sentenceHashes)
        ? finalRec.sentenceHashes.map(String)
        : [];
      if (detSent.join('|') !== finalSent.join('|')) {
        push('selected_deterministic_sentence_hash_mismatch', {
          deterministicHash: String(detRec.hash),
          finalHash: String(finalRec.hash),
        });
      }
    }
    // AAB-347 — selected candidate projection agreement (no 34-char placeholders).
    if (
      String(trace.requestedLocale || '') === 'en'
      && trace.countedAsSuccess === true
      && trace.deterministicAccepted === true
    ) {
      void SUMMARY_CANDIDATE_PROJECTION_INVARIANT_347_REVISION;
      const finalHash = String(trace.finalValidatedCandidateHash || '');
      const groundHash = String(trace.groundingInputCandidateHash || '');
      const detHash = String(trace.deterministicCandidateHash || '');
      if (finalHash && groundHash && finalHash !== groundHash) {
        push('projection_grounding_final_hash_mismatch', {
          groundingInputCandidateHash: groundHash,
          finalValidatedCandidateHash: finalHash,
        });
      }
      if (finalHash && detHash && finalHash !== detHash
        && trace.groundingInputEqualsFinalValidatedCandidate !== true) {
        push('projection_deterministic_final_hash_mismatch', {
          deterministicCandidateHash: detHash,
          finalValidatedCandidateHash: finalHash,
        });
      }
      const sent = Array.isArray(trace.finalSentenceHashes)
        ? trace.finalSentenceHashes.map(String)
        : [];
      const placeholder = sent.some((h) => /_l34_/.test(h) || /:unit:\d/.test(h));
      if (placeholder) {
        push('projection_placeholder_sentence_hashes', {
          finalSentenceHashes: sent.join(','),
        });
      }
      if (
        typeof trace.deterministicCandidateSentenceCount === 'number'
        && trace.deterministicCandidateSentenceCount > 0
        && sent.length > 0
        && sent.length !== trace.deterministicCandidateSentenceCount
      ) {
        push('projection_sentence_count_mismatch', {
          deterministicCandidateSentenceCount: trace.deterministicCandidateSentenceCount,
          finalSentenceHashCount: sent.length,
        });
      }
    }
    if (
      finalRec
      && finalRec.selectedSource === 'client_deterministic'
      && trace.providerAccepted === false
    ) {
      const providerRec = lineage.find((c) => String(c.candidateKind || '').includes('provider'));
      const providerUnits = Array.isArray(providerRec?.unitHashes)
        ? (providerRec!.unitHashes as unknown[]).map(String)
        : [];
      const finalUnits = Array.isArray(finalRec.unitHashes)
        ? finalRec.unitHashes.map(String)
        : [];
      if (
        providerUnits.length > 0
        && finalUnits.length > 0
        && providerUnits.join('|') === finalUnits.join('|')
      ) {
        push('rejected_provider_unit_hashes_in_final_selected', {
          providerAccepted: false,
          selectedSource: 'client_deterministic',
        });
      }
    }
    if (trace.countedAsSuccess) {
      const semantic = Array.isArray(trace.finalUnitSemanticRolesByUnit)
        ? (trace.finalUnitSemanticRolesByUnit as string[][])
        : (Array.isArray(trace.finalSentenceSemanticRolesBySentence)
          ? (trace.finalSentenceSemanticRolesBySentence as string[][])
          : []);
      const slots = Array.isArray(trace.finalUnitRoleSlots)
        ? (trace.finalUnitRoleSlots as string[])
        : [];
      const hasStructured = semantic.some((u) =>
        u.includes('current_role_intro')
        || u.includes('prior_role_intro')
        || u.includes('total_duration'));
      if (
        hasStructured
        && slots.length > 0
        && slots.every((s) => s === 'summary_unit')
      ) {
        push('generic_summary_unit_slots_with_structured_roles', {
          finalUnitRoleSlots: slots.join(','),
        });
      }
      if (
        semantic.length >= 3
        && !(
          semantic[0]?.includes('current_role_intro')
          && semantic[1]?.includes('prior_role_intro')
          && semantic[2]?.includes('total_duration')
        )
      ) {
        // Soft: only when English structured fixture shape is expected.
        if (
          Number(trace.requiredCurrentDutyFactCount ?? 0) >= 3
          && Number(trace.requiredPriorDutyFactCount ?? 0) >= 3
        ) {
          push('english_structured_semantic_role_shape_mismatch', {
            unit0: (semantic[0] || []).join(','),
            unit1: (semantic[1] || []).join(','),
            unit2: (semantic[2] || []).join(','),
          });
        }
      }
    }
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && trace.providerOutcome === 'accepted'
    && (trace.providerUnsupportedClaimCount ?? 0) > 0
  ) {
    push('german_provider_accepted_with_unsupported_competency', {
      providerUnsupportedClaimCount: trace.providerUnsupportedClaimCount ?? 0,
      providerOutcome: 'accepted',
    });
  }

  // AAB-320 — recovery / provenance / phase-separation invariants.
  void SUMMARY_EXPLICIT_SKILL_PROVENANCE_320_REVISION;
  void SUMMARY_CANDIDATE_PHASE_SEPARATION_320_REVISION;
  void GERMAN_SUMMARY_RECOVERY_DISPATCH_320_REVISION;
  if (
    String(trace.requestedLocale || '') === 'de'
    && trace.providerCandidatePresent
    && trace.providerOutcome
    && String(trace.providerOutcome).startsWith('rejected')
    && !trace.providerRejectionReason
    && !(Array.isArray(trace.providerSlotRejectionReasons)
      && trace.providerSlotRejectionReasons.length > 0)
    && !trace.providerTypedRejectionReason
  ) {
    push('german_provider_rejected_without_reason', {
      providerOutcome: String(trace.providerOutcome),
      providerRejectionReason: null,
    });
  }
  if (
    String(trace.requestedLocale || '') === 'de'
    && trace.providerCandidatePresent
    && String(trace.providerOutcome || '').startsWith('rejected')
    && !trace.clientDeterministicFallbackAttempted
    && !trace.summaryRepairAttempted
    && !trace.clientRepairAttempted
    && trace.sourceWasEmpty === true
    && !trace.noOpDetected
  ) {
    push('german_recoverable_rejection_without_recovery', {
      providerOutcome: String(trace.providerOutcome),
      clientDeterministicFallbackAttempted: false,
    });
  }
  if (
    (trace.finalCandidateSource === 'none' || !trace.finalCandidateSource)
    && !trace.countedAsSuccess
    && !trace.noOpDetected
  ) {
    const finalHashes = Array.isArray(trace.finalSentenceHashes)
      ? trace.finalSentenceHashes.filter(Boolean)
      : [];
    if (finalHashes.length > 0) {
      push('final_hashes_populated_without_final_candidate', {
        finalCandidateSource: trace.finalCandidateSource || 'none',
        finalSentenceHashCount: finalHashes.length,
      });
    }
  }
  if (
    trace.countedAsSuccess
    && trace.finalCandidateSource
    && trace.finalCandidateSource !== 'none'
    && Array.isArray(trace.finalSentenceHashes)
    && trace.finalSentenceHashes.filter(Boolean).length === 0
    && (trace.unitCount ?? 0) > 0
    && String(trace.requestedLocale || '') === 'de'
  ) {
    push('final_candidate_missing_sentence_hashes', {
      finalCandidateSource: String(trace.finalCandidateSource),
      unitCount: trace.unitCount ?? 0,
    });
  }

  const enhanceMode = String(trace.operationMode || '').includes('enhance');
  if (enhanceMode && trace.countedAsSuccess && trace.meaningfulChangeDetected === false) {
    push('enhance_success_without_meaningful_change', {
      countedAsSuccess: true,
      meaningfulChangeDetected: false,
    });
  }
  if (enhanceMode
    && trace.visibleApplySucceeded
    && trace.finalMatchesSourceAfterNormalization === true) {
    push('enhance_visible_apply_equals_source', {
      visibleApplySucceeded: true,
      finalMatchesSourceAfterNormalization: true,
    });
  }
  if (trace.noOpDetected && (trace.usageCountAfter ?? 0) !== (trace.usageCountBefore ?? 0)) {
    push('usage_changed_after_noop', {
      usageCountBefore: trace.usageCountBefore ?? 0,
      usageCountAfter: trace.usageCountAfter ?? 0,
    });
  }
  if (trace.providerOutcome === 'server_deterministic_fallback'
    && trace.serverFallbackUsed === false) {
    push('provider_outcome_server_fallback_mismatch', {
      providerOutcome: 'server_deterministic_fallback',
      serverFallbackUsed: false,
    });
  }
  const grammarReason = trace.hindiGrammarRejectionReason;
  if (grammarReason && isMediumOrGroundingRejectionCategory(grammarReason)) {
    push('grammar_reason_category_mismatch', {
      hindiGrammarRejectionReason: grammarReason,
    });
  }
  for (const r of trace.hindiGrammarRejectionReasons || []) {
    if (isMediumOrGroundingRejectionCategory(r)) {
      push('grammar_reason_category_mismatch', { hindiGrammarRejectionReason: r });
      break;
    }
  }
  for (const cand of trace.candidateLineage || []) {
    const reasons = cand.rejectionReasons || [];
    if (reasons.length !== dedupeStableStrings(reasons).length) {
      push('duplicate_rejection_reason', {
        candidateKind: cand.candidateKind || 'unknown',
        rejectionReasonCount: reasons.length,
      });
    }
    const unitCount = cand.unitCount ?? 0;
    const hashes = cand.unitHashes || [];
    if (cand.present && unitCount > 0 && hashes.length !== unitCount
      && !trace.diagnosticPayloadTruncated) {
      push('candidate_unit_hash_count_mismatch', {
        candidateKind: cand.candidateKind || 'unknown',
        unitCount,
        unitHashCount: hashes.length,
      });
    }
    if (cand.candidateKind === 'final_selected' && cand.present && cand.accepted === false) {
      push('final_selected_not_accepted', {
        candidateKind: 'final_selected',
        accepted: false,
      });
    }
    if (enhanceMode
      && cand.candidateKind === 'final_selected'
      && cand.present
      && cand.accepted
      && trace.noOpDetected) {
      push('noop_candidate_selected_as_final', {
        noOpDetected: true,
        accepted: true,
      });
    }
  }
  if (trace.internalDiagnosticsEnabled
    && trace.sourceCommitStatus !== 'unavailable_by_contract'
    && (trace.sourceCommitShort == null || trace.sourceCommitShort === '')) {
    push('required_build_identity_missing', {
      sourceCommitShort: null,
    });
  }
  if (trace.capacitorServerUrlConfigured === true
    && trace.apiBaseUrlConfigured === false
    && trace.serverFallbackUsed === false) {
    // Capacitor remote URL true while API base false is allowed; mismatch is
    // only when packaging claims Capacitor server.url is set but verifier says
    // otherwise — handled by capacitor_server_url_state_mismatch when both set.
  }
  if (trace.countedAsSuccess
    && (!trace.visibleApplySucceeded || !trace.finalCandidateSource)) {
    push('success_without_final_selected_and_apply', {
      countedAsSuccess: true,
      visibleApplySucceeded: Boolean(trace.visibleApplySucceeded),
      finalCandidateSource: trace.finalCandidateSource || null,
    });
  }

  return { passed: failures.length === 0, failures };
}

export function checkSummaryDiagnosticCompleteness(
  trace: Record<string, unknown>,
): {
  passed: boolean;
  missingRequiredDiagnosticFields: string[];
  nullRequiredDiagnosticFields: string[];
} {
  const missing: string[] = [];
  const nullish: string[] = [];
  const require = (key: string) => {
    if (!(key in trace)) missing.push(key);
    else if (trace[key] === null || trace[key] === undefined) nullish.push(key);
  };

  require('diagnosticContractRevision');
  require('schemaVersion');
  require('finalCandidateSource');
  require('providerCandidatePresent');
  require('deterministicCandidatePresent');
  require('grammarValidationPassed');
  require('groundingValidationPassed');
  require('durationValidationPassed');
  require('countedAsSuccess');
  require('visibleApplySucceeded');
  require('usageCountBefore');
  require('usageCountAfter');
  require('meaningfulChangeDetected');
  require('noOpDetected');
  require('apiResponseKind');
  require('serverFallbackUsed');
  require('clientFallbackUsed');
  require('apiBaseUrlConfigured');
  require('capacitorServerUrlConfigured');
  require('sourceCommitStatus');
  const markerCheck = validateCvAiDiagnosticMarkerField({
    ...trace,
    operationKind: trace.operationKind || 'summary',
  });
  missing.push(...markerCheck.missingRequiredDiagnosticFields);
  nullish.push(...markerCheck.nullRequiredDiagnosticFields);
  const locale = String(trace.requestedLocale || '');
  if (locale === 'hi') {
    require('hindiNominalExperienceFragmentDetected');
    require('hindiSentenceHasFiniteCopulaOrVerb');
    require('hindiIncompleteSentenceCount');
    require('finalUnsupportedDesignMediumCount');
    require('providerUnsupportedDesignMediumCount');
    require('providerPrintClaimDetected');
    require('hindiSentenceGrammarRecords');
    require('sourcePrintFactPresent');
  }
  if (locale === 'de' && trace.countedAsSuccess === true) {
    require('finalUnitRoleSlots');
    require('currentIntroSlotPresent');
    require('currentDutySlotPresent');
    require('priorRoleSlotPresent');
    require('unsupportedClaimCount');
    require('finalDurationOwnerExpected');
    require('finalDurationOwnerDetected');
    require('finalDurationScopeValidationPassed');
    require('finalDurationCurrentRoleAttachmentRisk');
    require('finalDurationTotalCareerMarkerPresent');
    require('competencyInferenceFromRoleForbidden');
    require('finalUnitSemanticRolesByUnit');
    require('finalCurrentEmployerPresent');
    require('finalPriorEmployerPresent');
    require('finalCurrentEmploymentStateExpressed');
    require('finalPriorEmploymentStateExpressed');
    require('finalCurrentRoleIntroValidationPassed');
    require('finalPriorRoleIntroValidationPassed');
    require('finalSlotValidationPassed');
    // AAB-322: structured-role locale diagnostic completeness.
    require('structuredRoleLocaleValidationPassed');
    require('currentRoleLocalizationValidationPassed');
    require('priorRoleLocalizationValidationPassed');
    require('foreignStructuredRoleTitleCount');
    require('foreignPriorRoleTitleCount');
    require('rawSourceRoleLeakageDetected');
    require('finalWrongLocaleStructuredRoleCount');
    require('finalStructuredRoleLocaleValidationPassed');
    // AAB-323: current duty + repair selection completeness.
    require('requiredCurrentDutyFactCount');
    require('coveredCurrentDutyFactCount');
    require('finalCurrentDutyCoveragePassed');
    require('germanControlledCaseGrammarPassed');
    require('materialCategoryCoverageUsedForFinalAcceptance');
    require('repairAttempted');
    require('repairAccepted');
    require('repairSelected');
    require('repairApplied');
    // AAB-324: authoritative/required duty parity completeness.
    require('authoritativeCurrentDutyFactCount');
    require('authoritativeCanonicalCurrentDutyFactCount');
    require('classifiedRequiredCurrentDutyFactCount');
    require('unclassifiedAuthoritativeCurrentDutyFactCount');
    require('requiredFactSetMatchesAuthoritativeFactSet');
    require('currentDutyRequiredFactParityPassed');
  }
  if (locale === 'sr') {
    require('serbianStructuredDomainGateEvaluated');
    require('serbianStructuredDomainGatePassed');
    require('serbianStructuredDomainCurrentRequiredFactCount');
    require('serbianStructuredDomainCurrentCoveredFactCount');
    require('serbianStructuredDomainPriorRequiredFactCount');
    require('serbianStructuredDomainPriorCoveredFactCount');
    require('serbianEntryOwnedBuilderAvailable');
    require('serbianEntryOwnedBuilderAttempted');
    require('serbianEntryOwnedBuilderSucceeded');
    if (trace.repairSkipped === true) {
      require('repairSkipReason');
    }
    if (trace.serbianEntryOwnedBuilderAttempted === true) {
      require('serbianEntryOwnedBuilderOutputLength');
      require('serbianEntryOwnedBuilderSentenceCount');
    }
    if (
      trace.serbianEntryOwnedBuilderSucceeded === false
      && trace.serbianEntryOwnedBuilderAttempted === true
    ) {
      require('serbianEntryOwnedBuilderTypedFailureReason');
    }
    if (trace.countedAsSuccess === true) {
      require('deterministicCandidateEqualsGroundingInput');
      require('requiredCurrentDutyFactCount');
      require('coveredCurrentDutyFactCount');
      require('requiredPriorDutyFactCount');
      require('coveredPriorDutyFactCount');
      require('finalCurrentDutyCoveragePassed');
      require('finalPriorDutyCoveragePassed');
    }
    if (trace.countedAsSuccess !== true && trace.rejectionStage != null) {
      // Duration-ok + material-fail must not claim the duration stage.
      if (
        trace.durationValidationPassed === true
        && /missing_material|grounding|slot|coverage|fact/i.test(
          String(trace.finalTypedFailureReason || ''),
        )
      ) {
        if (trace.rejectionStage === 'independent_final_duration_verification') {
          nullish.push('rejectionStage');
        }
      }
    }
  }
  if (locale === 'en' && trace.countedAsSuccess === true) {
    require('finalUnitRoleSlots');
    require('finalUnitSemanticRolesByUnit');
    require('currentIntroSlotPresent');
    require('currentDutySlotPresent');
    require('priorRoleSlotPresent');
    require('currentRoleConcreteFactCoverage');
    require('priorRoleGroundingPassed');
    require('currentRoleTitlePresent');
    require('finalCurrentEmployerPresent');
    require('finalPriorEmployerPresent');
    require('finalCurrentEmploymentStateExpressed');
    require('finalPriorEmploymentStateExpressed');
    require('finalCurrentDutyCoveragePassed');
    require('finalPriorDutyCoveragePassed');
    require('requiredCurrentDutyFactCount');
    require('requiredPriorDutyFactCount');
    require('finalSlotValidationPassed');
    require('structuredRoleLocaleValidationPassed');
    require('finalUnsupportedCompetencyCount');
    require('finalDurationOwnerDetected');
    require('finalDurationScopeValidationPassed');
    require('competencyInferenceFromRoleForbidden');
    // Visible gates are required only after a real visible apply recorded a hash.
    if (trace.visibleApplySucceeded === true && trace.visibleCandidateHashAfterApply != null) {
      require('visibleCurrentDutyCoveragePassed');
      require('visiblePriorDutyCoveragePassed');
      require('visibleStructuredRoleLocaleValidationPassed');
      require('visibleDurationScopeValidationPassed');
      require('visibleRequiredCurrentDutyFactCount');
      require('visibleCoveredCurrentDutyFactCount');
      require('visibleMissingCurrentDutyFactCount');
      require('visibleCurrentDutyRequiredFactParityPassed');
      require('visibleCurrentDutyRequiredFactCountMatchesFinal');
      require('visibleCurrentDutyRequiredFactSetHash');
      require('finalCurrentDutyRequiredFactSetHash');
      require('visiblePriorDutyRequiredFactParityPassed');
      if (Number(trace.requiredCurrentDutyFactCount ?? 0) > 0) {
        require('visibleCurrentDutyFactMatchCountsByFactHash');
        require('visibleCurrentDutyFactMatchedUnitHashesByFactHash');
        require('visibleMissingCurrentDutyFactIdHashes');
        if (Number(trace.visibleRequiredCurrentDutyFactCount ?? 0) === 0) {
          nullish.push('visibleRequiredCurrentDutyFactCount');
        }
      }
    }
  }

  if (trace.finalCandidateSource === 'deterministic_fallback') {
    require('deterministicCandidateHash');
    require('deterministicCandidatePresent');
  }
  if (trace.repairAttempted === true || trace.summaryRepairAttempted === true) {
    require('summaryRepairAttempted');
  }

  // Internal builds must not silently pass a required null commit without status.
  if (trace.internalDiagnosticsEnabled === true) {
    require('sourceCommitStatus');
    if (trace.sourceCommitStatus === 'embedded') {
      require('sourceCommitShort');
    }
    require('cvAiDiagnosticsV2299Revision');
  }

  const lineage = Array.isArray(trace.candidateLineage)
    ? trace.candidateLineage as Array<Record<string, unknown>>
    : [];
  for (const cand of lineage) {
    const unitCount = Number(cand.unitCount ?? 0);
    const hashes = Array.isArray(cand.unitHashes) ? cand.unitHashes : null;
    if (cand.present && unitCount > 0) {
      if (!hashes) {
        nullish.push(`candidateLineage.${String(cand.candidateKind || 'unknown')}.unitHashes`);
      } else if (hashes.length !== unitCount && trace.diagnosticPayloadTruncated !== true) {
        nullish.push(
          `candidateLineage.${String(cand.candidateKind || 'unknown')}.unitHashes.length`,
        );
      }
    }
    if (cand.candidateKind === 'final_selected' || cand.candidateKind === 'client_deterministic') {
      const sentenceCount = Number(cand.sentenceCount ?? unitCount);
      const sentenceHashes = Array.isArray(cand.sentenceHashes) ? cand.sentenceHashes : null;
      const slots = Array.isArray(cand.sentenceRoleSlots) ? cand.sentenceRoleSlots : null;
      if (sentenceCount > 0 && sentenceHashes && sentenceHashes.length !== sentenceCount
        && trace.diagnosticPayloadTruncated !== true) {
        nullish.push(
          `candidateLineage.${String(cand.candidateKind)}.sentenceHashes.length`,
        );
      }
      if (sentenceCount > 0 && slots && slots.length !== sentenceCount
        && trace.diagnosticPayloadTruncated !== true) {
        nullish.push(
          `candidateLineage.${String(cand.candidateKind)}.sentenceRoleSlots.length`,
        );
      }
    }
  }

  return {
    passed: missing.length === 0 && nullish.length === 0,
    missingRequiredDiagnosticFields: dedupeStableStrings(missing),
    nullRequiredDiagnosticFields: dedupeStableStrings(nullish),
  };
}

type ExperienceLike = {
  finalCandidateSource?: string | null;
  providerAttempted?: boolean | null;
  providerHttpStatus?: number | null;
  providerResponseKind?: string | null;
  apiResponseKind?: string | null;
  providerAccepted?: boolean | null;
  finalBulletCount?: number | null;
  finalBulletScripts?: unknown[] | null;
  appVersionCode?: string | null;
  appVersionName?: string | null;
  clientDeterministicFallbackAttempted?: boolean;
  clientDeterministicFallbackApplied?: boolean;
  clientDeterministicFallbackSelected?: boolean;
  clientDeterministicFallbackUsedForFinalCandidate?: boolean;
  fallbackSelected?: boolean;
  visibleApplySucceeded?: boolean;
  countedAsSuccess?: boolean;
  diagnosticInvariantCheckPassed?: boolean | null;
  diagnosticCompletenessPassed?: boolean | null;
  usageCountBefore?: number;
  usageCountAfter?: number;
  raceGuardResult?: string | null;
  stableEntryIdentityMatched?: boolean | null;
  targetEntryStillExists?: boolean | null;
  visibleDescriptionMatchesFinalHash?: boolean | null;
  visibleTextareaMatchesFinalNormalizedHash?: boolean | null;
  finalMatchesProviderOutput?: boolean | null;
  requiredFactCount?: number | null;
  coveredFactCount?: number | null;
  uncoveredFactIdentityHashes?: string[] | null;
  unsupportedClaimCount?: number | null;
  finalUnsupportedClaimCount?: number | null;
  finalUnsupportedClaimKinds?: string[] | null;
  finalNormalizedHash?: string | null;
  providerUncoveredFactIdentityHashes?: string[] | null;
  providerCoveredFactCount?: number | null;
  providerRequiredFactCount?: number | null;
  relevanceValidationPassed?: boolean | null;
  noOpRepairAttempted?: boolean | null;
  noOpRepairApplied?: boolean | null;
  unsupportedClaimRepairAttempted?: boolean | null;
  unsupportedClaimRepairApplied?: boolean | null;
  unsupportedClaimRepairValidationPassed?: boolean | null;
  unsupportedClaimRepairHash?: string | null;
  unsupportedClaimRepairNormalizedHash?: string | null;
  candidateAddedPredicateCount?: number | null;
  repairResidualAddedPredicateCount?: number | null;
  currentTextareaProvenance?: string | null;
  lastAiOutputHashMatched?: boolean | null;
  materialUserEditDetected?: boolean | null;
  entryGeneratedLocaleBeforeApply?: string | null;
  visibleTextareaLocaleBeforeApply?: string | null;
  visibleLocaleMetadataMismatchRecorded?: boolean | null;
  detectedVisibleTextLocale?: string | null;
  persistedGeneratedLocaleForVisibleMismatch?: string | null;
  visibleComparisonUsedForNoOp?: boolean | null;
  visibleComparisonHash?: string | null;
  visibleComparisonNormalizedHash?: string | null;
  visibleComparisonUnitCount?: number | null;
  semanticNoOpDetected?: boolean | null;
  degradationDetected?: boolean | null;
  degradationKinds?: string[] | null;
  materialImprovementDetected?: boolean | null;
  materialImprovementKinds?: string[] | null;
  materialImprovementEvidenceCount?: number | null;
  everyImprovementKindHasEvidence?: boolean | null;
  meaningfulChangeDetected?: boolean | null;
  canonicalAcceptancePassed?: boolean | null;
  expectedEmploymentTense?: string | null;
  sourceDetectedTense?: string | null;
  sourceTenseMismatchCount?: number | null;
  candidateDetectedTense?: string | null;
  candidateTenseMismatchCount?: number | null;
  wrongTenseFixedUnitCount?: number | null;
  tenseOnlyCorrectionDetected?: boolean | null;
  tenseOnlySourceLength?: number | null;
  tenseOnlyCandidateLength?: number | null;
  tenseOnlyUnexpectedExpansionDetected?: boolean | null;
  tenseOnlyPreservationPassed?: boolean | null;
  sourcePredicateIdentityCount?: number | null;
  sourcePredicateExtractionPassed?: boolean | null;
  sourceUnitCount?: number | null;
  sourceUnitPredicateCoveragePassed?: boolean | null;
  sourceIncompleteUnitCount?: number | null;
  finalCandidatePredicateIdentityCount?: number | null;
  candidateSurfaceFormPassed?: boolean | null;
  candidateSurfaceFailureKinds?: string[] | null;
  finalDecisionKind?: string | null;
  finalText?: string | null;
  requestedLocale?: string | null;
  sourceAlreadyValidForTarget?: boolean | null;
  authoritativeSourceAlreadyTargetLocale?: boolean | null;
  visibleTextareaAlreadyTargetLocale?: boolean | null;
  sourceAlreadyValidForTargetMeaning?: string | null;
  targetLocaleValidationPassed?: boolean | null;
  targetLocalePurityPassed?: boolean | null;
  providerLocaleValidationReason?: string | null;
  responseRejectedForLocaleImpurity?: boolean | null;
  wrongLocaleBulletCount?: number | null;
  wrongScriptBulletCount?: number | null;
  mixedLanguageBulletCount?: number | null;
  sourceLanguageLeakageDetected?: boolean | null;
  providerRejectionReason?: string | null;
  detectedLocaleByBullet?: Array<string | null> | null;
  selectedSourceLocale?: string | null;
  detectedSourceLocale?: string | null;
  requestedTargetLocale?: string | null;
  targetLocale?: string | null;
  uiLocale?: string | null;
  applyCommitted?: boolean | null;
  targetContentApplied?: boolean | null;
  appliedVisibleContentLocale?: string | null;
  appliedVisibleContentLocaleRaw?: string | null;
  sourceTenseValidationPassed?: boolean | null;
  providerNoOpDetected?: boolean | null;
  providerNoOpEligibleAsFinal?: boolean | null;
  providerNoOpBlockedBySourceDefect?: boolean | null;
  providerUnresolvedSourceDefectKinds?: string[] | null;
  deterministicTenseNormalizerAttempted?: boolean | null;
  deterministicTenseNormalizerProducedCandidate?: boolean | null;
  deterministicTenseNormalizerValidationPassed?: boolean | null;
  deterministicFixesSourceDefect?: boolean | null;
  shouldApply?: boolean | null;
  shouldIncrementUsage?: boolean | null;
  perspectiveNormalizationApplied?: boolean | null;
  perspectiveValidationPassed?: boolean | null;
  rejectionStage?: string | null;
  typedFailureReason?: string | null;
  unsupportedClaimRepairCandidateProduced?: boolean | null;
  unsupportedClaimRepairCandidateValid?: boolean | null;
  unsupportedClaimRepairSelectedForComparison?: boolean | null;
  unsupportedClaimRepairVisibleApplyPerformed?: boolean | null;
  neutralRestyleDetected?: boolean | null;
  authoritativeFactSourceKind?: string | null;
  authoritativeFactSourceLocale?: string | null;
  currentTextareaUsedForFactExtraction?: boolean | null;
  staleForeignLocaleSourceAuthoritative?: boolean | null;
  englishSourceStillAuthoritative?: boolean | null;
  factAuthorityKind?: string | null;
  factAuthorityMatchesAuthoritativeSourceKind?: boolean | null;
  finalSourceUnitPredicateCoveragePassed?: boolean | null;
  finalComplianceScopeExpansionDetected?: boolean | null;
  operationMode?: string | null;
  field?: string | null;
  earlyNoOpPreflightPassed?: boolean | null;
  earlyNoOpPreflightEvaluated?: boolean | null;
  uneditedRerunDetected?: boolean | null;
  visibleComparisonProvenance?: string | null;
  visibleComparisonMatchedLastAiOutput?: boolean | null;
  finalCandidatePresent?: boolean | null;
  finalCandidatePredicateValidationApplicable?: boolean | null;
  finalFactCoveragePassed?: boolean | null;
  finalRequiredFactCount?: number | null;
  applyAuthorized?: boolean | null;
  finalOutcomeReason?: string | null;
  finalTypedFailureReason?: string | null;
  finalCandidateBulletCount?: number | null;
  finalCandidateBulletScripts?: string[] | null;
  appliedFinalBulletCount?: number | null;
  appliedFinalBulletScripts?: string[] | null;
  providerBulletCount?: number | null;
  providerBulletScripts?: string[] | null;
  candidateLineage?: Array<{
    candidateKind?: string;
    accepted?: boolean | null;
    hash?: string | null;
    normalizedHash?: string | null;
    rejectionReasons?: string[] | null;
  }> | null;
  stages?: Array<{
    stage?: string;
    result?: string;
    typedReason?: string | null;
  }> | null;
  stageLog?: Array<{
    stage?: string;
    result?: string;
    typedReason?: string | null;
  }> | null;
};

export function checkExperienceDiagnosticInvariants(
  trace: ExperienceLike,
): { passed: boolean; failures: CvAiDiagnosticInvariantFailure[] } {
  const failures: CvAiDiagnosticInvariantFailure[] = [];
  const push = (code: string, observed: CvAiDiagnosticInvariantFailure['observed']) => {
    failures.push({ invariantCode: code, observed });
  };
  if (trace.countedAsSuccess && !trace.visibleApplySucceeded) {
    push('success_counted_but_apply_failed', {
      countedAsSuccess: true,
      visibleApplySucceeded: false,
    });
  }
  // AAB-327 — decision-critical invariant/completeness failure forbids success.
  if (
    trace.diagnosticInvariantCheckPassed === false
    && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
  ) {
    push('diagnostic_invariant_failed_but_success_counted', {
      diagnosticInvariantCheckPassed: false,
      countedAsSuccess: trace.countedAsSuccess ?? null,
      visibleApplySucceeded: trace.visibleApplySucceeded ?? null,
    });
  }
  if (
    trace.diagnosticCompletenessPassed === false
    && trace.countedAsSuccess === true
  ) {
    push('diagnostic_completeness_failed_but_success_counted', {
      diagnosticCompletenessPassed: false,
      countedAsSuccess: true,
    });
  }
  if (trace.countedAsSuccess && trace.visibleApplySucceeded) {
    const before = trace.usageCountBefore ?? 0;
    const after = trace.usageCountAfter ?? 0;
    if (after !== before + 1) {
      push('usage_increment_mismatch_success', {
        usageCountBefore: before,
        usageCountAfter: after,
      });
    }
  }
  if (trace.raceGuardResult === 'fail' && trace.visibleApplySucceeded) {
    push('race_failed_but_apply_succeeded', {
      raceGuardResult: 'fail',
      visibleApplySucceeded: true,
    });
  }
  if (trace.stableEntryIdentityMatched === false && trace.visibleApplySucceeded) {
    push('stable_entry_mismatch_but_apply_succeeded', {
      stableEntryIdentityMatched: false,
      visibleApplySucceeded: true,
    });
  }
  if (trace.visibleApplySucceeded && trace.visibleDescriptionMatchesFinalHash === false) {
    push('visible_apply_hash_mismatch', {
      visibleApplySucceeded: true,
      visibleDescriptionMatchesFinalHash: false,
    });
  }
  if (trace.visibleApplySucceeded
    && trace.visibleTextareaMatchesFinalNormalizedHash === false) {
    push('visible_textarea_hash_mismatch', {
      visibleApplySucceeded: true,
      visibleTextareaMatchesFinalNormalizedHash: false,
    });
  }
  if (trace.countedAsSuccess
    && trace.visibleApplySucceeded
    && (
      trace.visibleTextareaMatchesFinalNormalizedHash === false
      || trace.visibleDescriptionMatchesFinalHash === false
    )) {
    push('success_with_failed_visible_hash', {
      countedAsSuccess: true,
      visibleTextareaMatchesFinalNormalizedHash:
        trace.visibleTextareaMatchesFinalNormalizedHash ?? null,
      visibleDescriptionMatchesFinalHash: trace.visibleDescriptionMatchesFinalHash ?? null,
    });
  }
  if (trace.finalCandidateSource === 'deterministic_fallback'
    && trace.clientDeterministicFallbackApplied === false
    && trace.clientDeterministicFallbackSelected !== true
    && (trace as { clientDeterministicFallbackUsedForFinalCandidate?: boolean })
      .clientDeterministicFallbackUsedForFinalCandidate !== true) {
    push('final_source_deterministic_but_not_applied', {
      finalCandidateSource: 'deterministic_fallback',
      clientDeterministicFallbackApplied: false,
      clientDeterministicFallbackSelected: false,
    });
  }
  if (trace.finalCandidateSource === 'deterministic_fallback'
    && trace.fallbackSelected === false) {
    push('final_source_deterministic_but_fallback_not_selected', {
      finalCandidateSource: 'deterministic_fallback',
      fallbackSelected: false,
    });
  }
  const required = trace.requiredFactCount ?? 0;
  const covered = trace.coveredFactCount ?? 0;
  const uncovered = Array.isArray(trace.uncoveredFactIdentityHashes)
    ? trace.uncoveredFactIdentityHashes
    : [];
  if (required > 0 && covered < required && uncovered.length === 0
    && trace.earlyNoOpPreflightPassed !== true
    && !(
      trace.finalDecisionKind === 'exact_noop'
      || trace.finalDecisionKind === 'semantic_noop'
    )) {
    push('incomplete_coverage_with_empty_uncovered_hashes', {
      requiredFactCount: required,
      coveredFactCount: covered,
      uncoveredFactIdentityHashCount: 0,
    });
  }
  const unsupportedKinds = Array.isArray(trace.finalUnsupportedClaimKinds)
    ? trace.finalUnsupportedClaimKinds
    : [];
  if ((trace.unsupportedClaimCount ?? 0) === 0 && unsupportedKinds.length > 0) {
    push('unsupported_count_zero_with_nonempty_kinds', {
      unsupportedClaimCount: 0,
      finalUnsupportedClaimKindCount: unsupportedKinds.length,
    });
  }
  if (
    trace.countedAsSuccess
    && required > 0
    && covered < required
  ) {
    push('final_success_with_incomplete_coverage', {
      countedAsSuccess: true,
      requiredFactCount: required,
      coveredFactCount: covered,
    });
  }
  if (
    trace.countedAsSuccess
    && trace.visibleApplySucceeded
    && !trace.finalNormalizedHash
  ) {
    push('success_apply_missing_final_hash', {
      countedAsSuccess: true,
      finalNormalizedHash: null,
    });
  }
  if (
    (trace.providerCoveredFactCount != null)
    && (trace.providerRequiredFactCount != null)
    && trace.providerCoveredFactCount < trace.providerRequiredFactCount
    && Array.isArray(trace.providerUncoveredFactIdentityHashes)
    && trace.providerUncoveredFactIdentityHashes.length === 0
    && (trace.finalCandidateSource === 'deterministic_fallback'
      || trace.clientDeterministicFallbackApplied)
  ) {
    push('provider_rejection_evidence_overwritten', {
      providerCoveredFactCount: trace.providerCoveredFactCount,
      providerRequiredFactCount: trace.providerRequiredFactCount,
      providerUncoveredFactIdentityHashCount: 0,
    });
  }
  if (
    trace.currentTextareaUsedForFactExtraction === false
    && trace.staleForeignLocaleSourceAuthoritative === true
  ) {
    push('stale_foreign_authoritative_while_textarea_unused_for_facts', {
      currentTextareaUsedForFactExtraction: false,
      staleForeignLocaleSourceAuthoritative: true,
    });
  }
  if (
    Array.isArray(trace.materialImprovementKinds)
    && trace.materialImprovementKinds.includes('wrong_locale_fixed')
    && trace.finalDecisionKind === 'material_improvement'
    && trace.meaningfulChangeDetected === false
  ) {
    push('wrong_locale_fixed_without_meaningful_change', {
      materialImprovementKinds: 'wrong_locale_fixed',
      finalDecisionKind: 'material_improvement',
      meaningfulChangeDetected: false,
    });
  }
  if (
    (
      trace.finalCandidatePredicateValidationApplicable === true
      || (
        typeof trace.requestedTargetLocale === 'string'
        && /^(ja|hi|ru|de|es|fr|it|pt|ar|sr|hr)/i.test(trace.requestedTargetLocale)
        && Number(trace.finalRequiredFactCount ?? 0) >= 3
      )
    )
    && (
      Number(trace.finalCandidatePredicateIdentityCount ?? 0) === 0
      || trace.finalSourceUnitPredicateCoveragePassed == null
    )
    && (
      trace.applyAuthorized === true
      || trace.finalFactCoveragePassed === true
      || trace.finalCandidateSource === 'provider'
      || trace.finalCandidateSource === 'deterministic_fallback'
    )
  ) {
    push('final_predicate_coverage_vacuous_or_null', {
      finalCandidatePredicateIdentityCount:
        trace.finalCandidatePredicateIdentityCount ?? 0,
      finalSourceUnitPredicateCoveragePassed:
        trace.finalSourceUnitPredicateCoveragePassed ?? null,
    });
  }
  if (
    (
      String(trace.factAuthorityKind || trace.authoritativeFactSourceKind || '')
        === 'pre_ai_snapshot'
      || String(trace.authoritativeFactSourceKind || '') === 'pre_ai_snapshot'
    )
    && String(trace.authoritativeFactSourceLocale || '').toLowerCase() === 'en'
    && trace.factAuthorityMatchesAuthoritativeSourceKind === true
    && trace.englishSourceStillAuthoritative === false
  ) {
    push('english_source_authority_flag_contradiction', {
      authoritativeFactSourceKind: trace.authoritativeFactSourceKind ?? null,
      authoritativeFactSourceLocale: trace.authoritativeFactSourceLocale ?? null,
      factAuthorityMatchesAuthoritativeSourceKind:
        trace.factAuthorityMatchesAuthoritativeSourceKind ?? null,
      englishSourceStillAuthoritative: trace.englishSourceStillAuthoritative ?? null,
    });
  }
  // AAB-309 repair lineage invariants.
  if (trace.providerAccepted === false) {
    const stageRows = Array.isArray(trace.stages)
      ? trace.stages
      : (Array.isArray(trace.stageLog) ? trace.stageLog : []);
    const skipStages = stageRows.filter((s) =>
      s?.stage === 'deterministic_fallback_started' && s?.result === 'skipped');
    for (const s of skipStages) {
      if (s?.typedReason === 'provider_accepted') {
        push('provider_rejected_but_fallback_skip_provider_accepted', {
          providerAccepted: false,
          typedReason: 'provider_accepted',
        });
      }
    }
  }
  if (trace.noOpRepairApplied === true && trace.noOpRepairAttempted !== true) {
    push('noop_repair_applied_without_attempt', {
      noOpRepairApplied: true,
      noOpRepairAttempted: trace.noOpRepairAttempted ?? false,
    });
  }
  if (trace.unsupportedClaimRepairApplied === true) {
    if (trace.unsupportedClaimRepairAttempted !== true) {
      push('unsupported_repair_applied_without_attempt', {
        unsupportedClaimRepairApplied: true,
        unsupportedClaimRepairAttempted: trace.unsupportedClaimRepairAttempted ?? false,
      });
    }
    if (trace.unsupportedClaimRepairValidationPassed !== true) {
      push('unsupported_repair_applied_without_validation', {
        unsupportedClaimRepairApplied: true,
        unsupportedClaimRepairValidationPassed:
          trace.unsupportedClaimRepairValidationPassed ?? null,
      });
    }
    if ((trace.finalUnsupportedClaimCount ?? 0) > 0) {
      push('unsupported_repair_applied_with_final_unsupported', {
        unsupportedClaimRepairApplied: true,
        finalUnsupportedClaimCount: trace.finalUnsupportedClaimCount ?? 0,
      });
    }
    if ((trace.repairResidualAddedPredicateCount ?? 0) > 0) {
      push('unsupported_repair_applied_with_residual_predicates', {
        unsupportedClaimRepairApplied: true,
        repairResidualAddedPredicateCount: trace.repairResidualAddedPredicateCount ?? 0,
      });
    }
  }
  if (
    (trace.candidateAddedPredicateCount ?? 0) > 0
    && trace.countedAsSuccess
    && trace.visibleApplySucceeded
    && (trace.finalUnsupportedClaimCount ?? 0) === 0
    && !trace.unsupportedClaimRepairApplied
    && !trace.clientDeterministicFallbackApplied
  ) {
    // Accepted provider with residual added predicates is invalid unless repair/fallback cleaned them.
    push('accepted_with_candidate_added_predicates', {
      candidateAddedPredicateCount: trace.candidateAddedPredicateCount ?? 0,
      countedAsSuccess: true,
    });
  }
  if (trace.finalCandidateSource === 'unsupported_claim_repair') {
    const repairHash = trace.unsupportedClaimRepairNormalizedHash
      || trace.unsupportedClaimRepairHash
      || null;
    if (repairHash && trace.finalNormalizedHash && repairHash !== trace.finalNormalizedHash) {
      push('unsupported_repair_final_hash_mismatch', {
        finalCandidateSource: 'unsupported_claim_repair',
        unsupportedClaimRepairHash: repairHash,
        finalNormalizedHash: trace.finalNormalizedHash,
      });
    }
    if (trace.unsupportedClaimRepairApplied !== true) {
      push('unsupported_repair_final_source_not_applied', {
        finalCandidateSource: 'unsupported_claim_repair',
        unsupportedClaimRepairApplied: false,
      });
    }
  }
  if (
    trace.finalCandidateSource === 'unsupported_claim_repair'
    && Array.isArray(trace.candidateLineage)
  ) {
    const invalidSelected = trace.candidateLineage.find((c) =>
      c?.candidateKind === 'unsupported_claim_repair'
      && c?.accepted === false
      && trace.countedAsSuccess);
    if (invalidSelected) {
      push('invalid_repair_marked_final_selected', {
        finalCandidateSource: 'unsupported_claim_repair',
        repairAccepted: false,
        countedAsSuccess: true,
      });
    }
  }
  // AAB-311 dual-source / predicate-phase / no-op invariants.
  if (
    trace.currentTextareaProvenance === 'ai_generated_unedited'
    && trace.lastAiOutputHashMatched === true
    && trace.materialUserEditDetected === false
    && trace.visibleComparisonUsedForNoOp !== true
    && (trace.operationMode === 'enhance_existing' || trace.field === 'experience_description')
  ) {
    push('ai_unedited_rerun_missing_visible_noop_baseline', {
      currentTextareaProvenance: trace.currentTextareaProvenance,
      visibleComparisonUsedForNoOp: trace.visibleComparisonUsedForNoOp ?? null,
    });
  }
  if (
    trace.semanticNoOpDetected === true
    && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
  ) {
    push('semantic_noop_with_usage_or_apply', {
      semanticNoOpDetected: true,
      countedAsSuccess: trace.countedAsSuccess ?? false,
      visibleApplySucceeded: trace.visibleApplySucceeded ?? false,
    });
  }
  if (
    trace.degradationDetected === true
    && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
  ) {
    push('degradation_with_usage_or_apply', {
      degradationDetected: true,
      countedAsSuccess: trace.countedAsSuccess ?? false,
      visibleApplySucceeded: trace.visibleApplySucceeded ?? false,
    });
  }
  if (
    (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    && trace.finalSourceUnitPredicateCoveragePassed === false
  ) {
    push('accepted_with_final_predicate_coverage_false', {
      finalSourceUnitPredicateCoveragePassed: false,
      countedAsSuccess: trace.countedAsSuccess ?? false,
    });
  }
  if (
    (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    && trace.finalComplianceScopeExpansionDetected === true
  ) {
    push('accepted_with_final_compliance_expansion', {
      finalComplianceScopeExpansionDetected: true,
    });
  }
  if (
    trace.countedAsSuccess === true
    && trace.visibleApplySucceeded === true
    && trace.materialImprovementDetected === false
    && trace.semanticNoOpDetected !== true
    && trace.operationMode === 'enhance_existing'
    && trace.visibleComparisonUsedForNoOp === true
    && (trace.currentTextareaProvenance === 'ai_generated_unedited'
      || trace.lastAiOutputHashMatched === true)
  ) {
    push('usage_without_material_improvement', {
      materialImprovementDetected: false,
      countedAsSuccess: true,
    });
  }
  // AAB-312 — visible snapshot / evidence / authority consistency.
  if (
    (trace.operationMode === 'enhance_existing' || trace.field === 'experience_description')
    && typeof trace.visibleComparisonUnitCount === 'number'
    && Number(trace.visibleComparisonUnitCount) > 0
    && (trace.visibleComparisonHash == null || trace.visibleComparisonNormalizedHash == null)
  ) {
    push('missing_visible_comparison_snapshot_hashes', {
      visibleComparisonUnitCount: trace.visibleComparisonUnitCount,
      visibleComparisonHash: trace.visibleComparisonHash ?? null,
      visibleComparisonNormalizedHash: trace.visibleComparisonNormalizedHash ?? null,
    });
  }
  if (
    trace.materialImprovementDetected === true
    && (!Array.isArray(trace.materialImprovementKinds)
      || (trace.materialImprovementKinds as unknown[]).length === 0)
  ) {
    push('material_improvement_without_kinds', {
      materialImprovementDetected: true,
      materialImprovementKindsCount: Array.isArray(trace.materialImprovementKinds)
        ? trace.materialImprovementKinds.length
        : 0,
    });
  }
  if (
    trace.materialImprovementDetected === true
    && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    && (trace.visibleComparisonHash == null || trace.visibleComparisonUsedForNoOp !== true)
  ) {
    push('material_improvement_apply_without_visible_snapshot', {
      visibleComparisonHash: trace.visibleComparisonHash ?? null,
      visibleComparisonUsedForNoOp: trace.visibleComparisonUsedForNoOp ?? null,
    });
  }
  if (
    trace.authoritativeFactSourceKind === 'pre_ai_snapshot'
    && trace.factAuthorityKind != null
    && !experienceFactAuthorityKindsEquivalent(
      String(trace.factAuthorityKind),
      'pre_ai_snapshot',
    )
  ) {
    push('fact_authority_kind_contradicts_authoritative_source', {
      authoritativeFactSourceKind: trace.authoritativeFactSourceKind,
      factAuthorityKind: trace.factAuthorityKind,
    });
  }
  // AAB-328 — locale purity vs wrong_language consistency.
  {
    void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
    void EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION;
    const localeEval = evaluateExperiencePhaseLocaleValidation({
      wrongLocaleBulletCount: trace.wrongLocaleBulletCount,
      wrongScriptBulletCount: trace.wrongScriptBulletCount,
      mixedLanguageBulletCount: trace.mixedLanguageBulletCount,
      sourceLanguageLeakageDetected: trace.sourceLanguageLeakageDetected,
      targetLocalePurityPassed: trace.targetLocalePurityPassed,
      detectedLocaleByBullet: trace.detectedLocaleByBullet,
    });
    if (
      localeEval.passed
      && (
        trace.providerLocaleValidationReason === 'wrong_language'
        || trace.finalTypedFailureReason === 'wrong_language'
        || trace.responseRejectedForLocaleImpurity === true
      )
      && (
        Number(trace.wrongLocaleBulletCount ?? 0) === 0
        && Number(trace.mixedLanguageBulletCount ?? 0) === 0
        && !trace.sourceLanguageLeakageDetected
        && trace.targetLocalePurityPassed !== false
      )
    ) {
      push('wrong_language_without_locale_evidence', {
        providerLocaleValidationReason: trace.providerLocaleValidationReason ?? null,
        finalTypedFailureReason: trace.finalTypedFailureReason ?? null,
        targetLocalePurityPassed: trace.targetLocalePurityPassed ?? null,
        wrongLocaleBulletCount: trace.wrongLocaleBulletCount ?? 0,
      });
    }
    if (
      trace.targetLocalePurityPassed === true
      && Number(trace.wrongLocaleBulletCount ?? 0) === 0
      && Number(trace.mixedLanguageBulletCount ?? 0) === 0
      && !trace.sourceLanguageLeakageDetected
      && (
        isExperienceLocaleRejectionReason(trace.providerLocaleValidationReason)
        || (trace.responseRejectedForLocaleImpurity === true
          && isExperienceLocaleRejectionReason(trace.finalTypedFailureReason))
      )
    ) {
      push('locale_purity_true_but_wrong_language_reported', {
        targetLocalePurityPassed: true,
        providerLocaleValidationReason: trace.providerLocaleValidationReason ?? null,
        finalTypedFailureReason: trace.finalTypedFailureReason ?? null,
      });
    }
    // AAB-333 — purity-pass forbids explicit foreign bullet locales.
    // AAB-335 — compare via alias-aware keys (pt ≡ pt-BR ≡ pt-br).
    {
      const targetRaw = String(
        trace.requestedTargetLocale
        || trace.targetLocale
        || trace.uiLocale
        || trace.requestedLocale
        || '',
      );
      const target = normalizeLocaleKey(targetRaw);
      const bullets = Array.isArray(trace.detectedLocaleByBullet)
        ? trace.detectedLocaleByBullet
        : [];
      if (
        trace.targetLocalePurityPassed === true
        && Number(trace.wrongLocaleBulletCount ?? 0) === 0
        && Number(trace.mixedLanguageBulletCount ?? 0) === 0
        && target
        && bullets.length > 0
      ) {
        const foreign = bullets
          .map((b, i) => ({ locale: b == null ? null : String(b), index: i }))
          .filter((b) => {
            if (!b.locale || b.locale === 'unknown') return false;
            return !localesEquivalent(b.locale, targetRaw);
          });
        if (foreign.length > 0) {
          push('purity_pass_with_foreign_detected_bullet_locale', {
            targetLocale: targetRaw || target,
            foreignDetectedLocales: foreign.map((f) => f.locale).join(','),
            foreignBulletIndexes: foreign.map((f) => f.index).join(','),
            wrongLocaleBulletCount: 0,
            mixedLanguageBulletCount: 0,
            targetLocalePurityPassed: true,
          });
        }
      }
    }
    // AAB-336 — committed supported-locale apply: public appliedVisibleContentLocale
    // must equal canonicalize(requestedTargetLocale) and itself be canonical.
    if (
      trace.applyCommitted === true
      && trace.targetContentApplied === true
      && trace.requestedTargetLocale
      && trace.appliedVisibleContentLocale
    ) {
      const appliedRaw = String(trace.appliedVisibleContentLocale);
      const requestedRaw = String(trace.requestedTargetLocale);
      const appliedCanon = String(canonicalizeContentLocale(appliedRaw));
      const requestedCanon = String(canonicalizeContentLocale(requestedRaw));
      if (
        resolveLocaleCandidate(requestedRaw)
        && appliedCanon
        && requestedCanon
        && !localesEquivalent(appliedCanon, requestedCanon)
      ) {
        push('applied_visible_locale_mismatch_after_commit', {
          appliedVisibleContentLocale: appliedRaw,
          requestedTargetLocale: requestedRaw,
          canonicalApplied: appliedCanon,
          canonicalRequested: requestedCanon,
        });
      }
      if (
        resolveLocaleCandidate(requestedRaw)
        && appliedRaw
        && appliedRaw !== appliedCanon
      ) {
        push('applied_visible_locale_not_canonical_after_commit', {
          appliedVisibleContentLocale: appliedRaw,
          canonicalAppliedVisibleContentLocale: appliedCanon,
          requestedTargetLocale: requestedRaw,
        });
      }
    }
    // AAB-334 — unedited AI text: visible locale must match persisted generatedLocale
    // unless an explicit metadata mismatch was recorded.
    {
      const entryGen = String(trace.entryGeneratedLocaleBeforeApply || '').toLowerCase();
      const visibleBefore = String(trace.visibleTextareaLocaleBeforeApply || '').toLowerCase();
      const supported = /^(en|de|es|fr|it|pt-br|sr|hr|hi|ar|ja|ru)$/;
      if (
        trace.currentTextareaProvenance === 'ai_generated_unedited'
        && trace.lastAiOutputHashMatched === true
        && supported.test(entryGen)
        && visibleBefore
        && visibleBefore !== 'unknown'
        && visibleBefore !== entryGen
        && trace.visibleLocaleMetadataMismatchRecorded !== true
      ) {
        push('unedited_ai_visible_locale_mismatch', {
          visibleTextareaLocaleBeforeApply: visibleBefore,
          entryGeneratedLocaleBeforeApply: entryGen,
          visibleLocaleMetadataMismatchRecorded:
            trace.visibleLocaleMetadataMismatchRecorded ?? false,
        });
      }
    }
    if (
      isExperienceCoverageRejectionReason(trace.providerRejectionReason)
      && isExperienceLocaleRejectionReason(trace.providerLocaleValidationReason)
    ) {
      push('coverage_failure_reported_as_locale_reason', {
        providerRejectionReason: trace.providerRejectionReason ?? null,
        providerLocaleValidationReason: trace.providerLocaleValidationReason ?? null,
      });
    }
    const lineage = Array.isArray(trace.candidateLineage) ? trace.candidateLineage : [];
    const providerLine = lineage.find((l) => l && (l as { candidateKind?: string }).candidateKind === 'provider') as
      | { rejectionReasons?: string[]; accepted?: boolean | null }
      | undefined;
    if (
      providerLine
      && providerLine.accepted === false
      && trace.providerRejectionReason
      && Array.isArray(providerLine.rejectionReasons)
      && providerLine.rejectionReasons.length > 0
      && providerLine.rejectionReasons[0] !== trace.providerRejectionReason
      && !providerLine.rejectionReasons.includes(String(trace.providerRejectionReason))
    ) {
      push('provider_lineage_primary_reason_mismatch', {
        providerRejectionReason: trace.providerRejectionReason,
        lineagePrimary: providerLine.rejectionReasons[0] ?? null,
      });
    }
    if (
      typeof trace.authoritativeSourceAlreadyTargetLocale === 'boolean'
      && typeof trace.visibleTextareaAlreadyTargetLocale === 'boolean'
      && trace.selectedSourceLocale
      && trace.requestedTargetLocale
    ) {
      const auth = String(trace.selectedSourceLocale).toLowerCase().startsWith('es')
        && String(trace.requestedTargetLocale).toLowerCase().startsWith('en');
      if (auth && trace.authoritativeSourceAlreadyTargetLocale === true) {
        push('authoritative_source_already_target_locale_false_positive', {
          selectedSourceLocale: trace.selectedSourceLocale,
          requestedTargetLocale: trace.requestedTargetLocale,
          authoritativeSourceAlreadyTargetLocale: true,
        });
      }
    }
  }
  // AAB-317 — dual-source / unedited-rerun diagnostic truth.
  if (
    trace.factAuthorityMatchesAuthoritativeSourceKind === true
    && trace.factAuthorityKind != null
    && trace.authoritativeFactSourceKind != null
    && !experienceFactAuthorityKindsEquivalent(
      String(trace.factAuthorityKind),
      String(trace.authoritativeFactSourceKind),
    )
  ) {
    push('fact_authority_match_flag_inconsistent_with_kinds', {
      factAuthorityMatchesAuthoritativeSourceKind: true,
      factAuthorityKind: trace.factAuthorityKind,
      authoritativeFactSourceKind: trace.authoritativeFactSourceKind,
    });
  }
  if (
    trace.currentTextareaProvenance != null
    && trace.visibleComparisonProvenance != null
    && String(trace.currentTextareaProvenance) !== String(trace.visibleComparisonProvenance)
    && (trace.operationMode === 'enhance_existing'
      || trace.operationMode === 'enhance_existing_description'
      || trace.field === 'experience_description')
  ) {
    push('visible_comparison_provenance_mismatch_request_time', {
      currentTextareaProvenance: trace.currentTextareaProvenance,
      visibleComparisonProvenance: trace.visibleComparisonProvenance,
    });
  }
  if (
    typeof trace.lastAiOutputHashMatched === 'boolean'
    && typeof trace.visibleComparisonMatchedLastAiOutput === 'boolean'
    && trace.lastAiOutputHashMatched !== trace.visibleComparisonMatchedLastAiOutput
    && (trace.operationMode === 'enhance_existing'
      || trace.operationMode === 'enhance_existing_description'
      || trace.field === 'experience_description')
  ) {
    push('visible_comparison_hash_match_mismatch_request_time', {
      lastAiOutputHashMatched: trace.lastAiOutputHashMatched,
      visibleComparisonMatchedLastAiOutput: trace.visibleComparisonMatchedLastAiOutput,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && trace.materialUserEditDetected === true
  ) {
    push('early_noop_preflight_passed_after_material_edit', {
      earlyNoOpPreflightPassed: true,
      materialUserEditDetected: true,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && trace.sourceAlreadyValidForTarget !== true
  ) {
    push('early_noop_preflight_passed_without_valid_visible_source', {
      earlyNoOpPreflightPassed: true,
      sourceAlreadyValidForTarget: trace.sourceAlreadyValidForTarget ?? null,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && trace.providerAttempted === true
  ) {
    push('early_noop_preflight_passed_but_provider_attempted', {
      earlyNoOpPreflightPassed: true,
      providerAttempted: true,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && (
      trace.degradationDetected === true
      || (Array.isArray(trace.degradationKinds)
        && (trace.degradationKinds as unknown[]).length > 0)
    )
  ) {
    push('early_noop_preflight_passed_with_degradation', {
      earlyNoOpPreflightPassed: true,
      degradationDetected: trace.degradationDetected ?? null,
      degradationKindsCount: Array.isArray(trace.degradationKinds)
        ? trace.degradationKinds.length
        : 0,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && (
      trace.materialImprovementDetected === true
      || trace.visibleApplySucceeded === true
      || trace.countedAsSuccess === true
      || (
        trace.usageCountAfter != null
        && trace.usageCountBefore != null
        && Number(trace.usageCountAfter) > Number(trace.usageCountBefore)
      )
    )
  ) {
    push('early_noop_preflight_passed_with_apply_or_usage', {
      earlyNoOpPreflightPassed: true,
      materialImprovementDetected: trace.materialImprovementDetected ?? null,
      visibleApplySucceeded: trace.visibleApplySucceeded ?? null,
      countedAsSuccess: trace.countedAsSuccess ?? null,
    });
  }
  if (
    Array.isArray(trace.degradationKinds)
    && (trace.degradationKinds as string[]).includes('tense_regressed')
    && trace.finalCandidatePresent === false
    && trace.earlyNoOpPreflightPassed === true
  ) {
    push('tense_regressed_without_evaluated_candidate', {
      degradationKindsCount: Array.isArray(trace.degradationKinds)
        ? (trace.degradationKinds as string[]).length
        : 0,
      finalCandidatePresent: false,
    });
  }
  if (
    (trace.finalDecisionKind === 'exact_noop' || trace.finalDecisionKind === 'semantic_noop')
    && (trace.rejectionStage === 'provider:visible_noop'
      || trace.rejectionStage === 'provider:noop'
      || trace.finalTypedFailureReason === 'ai_noop')
    && trace.earlyNoOpPreflightPassed === true
  ) {
    push('clean_noop_uses_failure_stage_semantics', {
      finalDecisionKind: trace.finalDecisionKind,
      rejectionStage: trace.rejectionStage ?? null,
      finalTypedFailureReason: trace.finalTypedFailureReason ?? null,
    });
  }
  // AAB-318 — clean no-op / provider-not-attempted / count-script consistency.
  if (
    trace.earlyNoOpPreflightPassed === true
    && (
      trace.finalTypedFailureReason != null
      || trace.rejectionStage != null
    )
  ) {
    push('clean_noop_has_failure_or_rejection_fields', {
      finalTypedFailureReason: trace.finalTypedFailureReason ?? null,
      rejectionStage: trace.rejectionStage ?? null,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && Array.isArray(trace.stages)
    && (trace.stages as Array<{ result?: string }>).some((s) => s?.result === 'fail')
  ) {
    push('clean_noop_has_failed_stages', {
      earlyNoOpPreflightPassed: true,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && trace.providerAttempted !== false
  ) {
    push('clean_noop_provider_attempted_not_false', {
      providerAttempted: trace.providerAttempted ?? null,
    });
  }
  if (
    trace.providerAttempted === false
    && (
      trace.providerHttpStatus != null
      || (
        Array.isArray(trace.candidateLineage)
        && (trace.candidateLineage as Array<{ candidateKind?: string }>).some(
          (c) => c?.candidateKind === 'provider',
        )
      )
    )
  ) {
    push('provider_not_attempted_but_provider_evidence_present', {
      providerHttpStatus: trace.providerHttpStatus ?? null,
      providerLineagePresent: Array.isArray(trace.candidateLineage)
        && (trace.candidateLineage as Array<{ candidateKind?: string }>).some(
          (c) => c?.candidateKind === 'provider',
        ),
    });
  }
  if (
    trace.providerAttempted === false
    && trace.providerResponseKind != null
    && trace.providerResponseKind !== 'not_attempted'
    && (
      trace.earlyNoOpPreflightPassed === true
      || trace.apiResponseKind === 'not_attempted'
    )
  ) {
    push('provider_not_attempted_response_kind_invalid', {
      providerResponseKind: trace.providerResponseKind,
      apiResponseKind: trace.apiResponseKind ?? null,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && trace.providerNoOpDetected === true
  ) {
    push('clean_noop_overloads_provider_noop_detected', {
      providerNoOpDetected: true,
    });
  }
  if (
    typeof trace.finalBulletCount === 'number'
    && Array.isArray(trace.finalBulletScripts)
    && Number(trace.finalBulletCount) !== (trace.finalBulletScripts as unknown[]).length
  ) {
    push('legacy_final_bullet_count_script_mismatch', {
      finalBulletCount: trace.finalBulletCount,
      finalBulletScriptsLength: (trace.finalBulletScripts as unknown[]).length,
    });
  }
  if (
    typeof trace.appliedFinalBulletCount === 'number'
    && Array.isArray(trace.appliedFinalBulletScripts)
    && Number(trace.appliedFinalBulletCount)
      !== (trace.appliedFinalBulletScripts as unknown[]).length
  ) {
    push('applied_final_bullet_count_script_mismatch', {
      appliedFinalBulletCount: trace.appliedFinalBulletCount,
      appliedFinalBulletScriptsLength:
        (trace.appliedFinalBulletScripts as unknown[]).length,
    });
  }
  if (
    trace.earlyNoOpPreflightPassed === true
    && (
      Number(trace.finalBulletCount ?? 0) !== 0
      || (Array.isArray(trace.finalBulletScripts)
        && (trace.finalBulletScripts as unknown[]).length > 0)
      || Number(trace.finalCandidateBulletCount ?? 0) !== 0
      || Number(trace.appliedFinalBulletCount ?? 0) !== 0
    )
  ) {
    push('clean_noop_has_nonzero_final_bullet_fields', {
      finalBulletCount: trace.finalBulletCount ?? null,
      finalCandidateBulletCount: trace.finalCandidateBulletCount ?? null,
      appliedFinalBulletCount: trace.appliedFinalBulletCount ?? null,
    });
  }
  if (
    (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    && 'finalCandidatePresent' in trace
    && trace.finalCandidatePresent === false
  ) {
    push('successful_apply_without_final_candidate', {
      countedAsSuccess: trace.countedAsSuccess ?? null,
      visibleApplySucceeded: trace.visibleApplySucceeded ?? null,
      finalCandidatePresent: false,
    });
  }
  if (
    (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    && 'appliedFinalBulletCount' in trace
    && Number(trace.appliedFinalBulletCount ?? 0) <= 0
    && Number(trace.finalBulletCount ?? 0) <= 0
  ) {
    push('successful_apply_without_applied_bullets', {
      appliedFinalBulletCount: trace.appliedFinalBulletCount ?? null,
      finalBulletCount: trace.finalBulletCount ?? null,
    });
  }
  if (
    typeof trace.appVersionCode === 'string'
    && trace.appVersionCode.length > 0
    && (trace.appVersionName == null || String(trace.appVersionName).length === 0)
  ) {
    push('app_version_code_without_version_name', {
      appVersionCode: trace.appVersionCode,
      appVersionName: trace.appVersionName ?? null,
    });
  }
  if (
    typeof trace.finalCandidateBulletCount === 'number'
    && Array.isArray(trace.finalCandidateBulletScripts)
    && Number(trace.finalCandidateBulletCount)
      !== (trace.finalCandidateBulletScripts as unknown[]).length
  ) {
    push('final_candidate_bullet_count_script_mismatch', {
      finalCandidateBulletCount: trace.finalCandidateBulletCount,
      finalCandidateBulletScriptsLength:
        (trace.finalCandidateBulletScripts as unknown[]).length,
    });
  }
  if (
    typeof trace.providerBulletCount === 'number'
    && Array.isArray(trace.providerBulletScripts)
    && Number(trace.providerBulletCount)
      !== (trace.providerBulletScripts as unknown[]).length
  ) {
    push('provider_bullet_count_script_mismatch', {
      providerBulletCount: trace.providerBulletCount,
      providerBulletScriptsLength: (trace.providerBulletScripts as unknown[]).length,
    });
  }
  if (
    trace.neutralRestyleDetected === true
    && trace.semanticNoOpDetected !== true
  ) {
    push('neutral_restyle_without_semantic_noop', {
      neutralRestyleDetected: true,
      semanticNoOpDetected: trace.semanticNoOpDetected ?? false,
    });
  }
  if (
    (trace.semanticNoOpDetected === true || trace.neutralRestyleDetected === true)
    && (trace.usageCountAfter != null && trace.usageCountBefore != null)
    && Number(trace.usageCountAfter) > Number(trace.usageCountBefore)
  ) {
    push('semantic_noop_usage_increment', {
      usageCountBefore: trace.usageCountBefore,
      usageCountAfter: trace.usageCountAfter,
    });
  }
  // AAB-313 — surface-form / decision / evidence invariants.
  if (
    Array.isArray(trace.candidateSurfaceFailureKinds)
    && (trace.candidateSurfaceFailureKinds as unknown[]).length > 0
    && (
      trace.countedAsSuccess === true
      || trace.visibleApplySucceeded === true
      || trace.materialImprovementDetected === true
    )
  ) {
    push('malformed_surface_form_accepted', {
      candidateSurfaceFailureKindsCount: Array.isArray(trace.candidateSurfaceFailureKinds)
        ? trace.candidateSurfaceFailureKinds.length
        : 0,
      countedAsSuccess: trace.countedAsSuccess ?? null,
    });
  }
  if (
    typeof trace.finalText === 'string'
    && /\bcada\s+de\b/iu.test(trace.finalText)
    && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
  ) {
    push('cada_de_malformed_accepted', {
      finalTextPreview: String(trace.finalText).slice(0, 80),
    });
  }
  if (
    Array.isArray(trace.materialImprovementKinds)
    && (trace.materialImprovementKinds as string[]).length === 1
    && (trace.materialImprovementKinds as string[])[0] === 'grounded_phrasing_enhancement'
    && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    && String(trace.requestedLocale || '').toLowerCase().startsWith('es')
  ) {
    push('grounded_phrasing_alone_cannot_apply', {
      materialImprovementKindsCount: 1,
    });
  }
  if (
    trace.materialImprovementDetected === true
    && typeof trace.materialImprovementEvidenceCount === 'number'
    && Number(trace.materialImprovementEvidenceCount) <= 0
    && Array.isArray(trace.materialImprovementKinds)
    && (trace.materialImprovementKinds as unknown[]).length > 0
  ) {
    push('improvement_without_evidence', {
      materialImprovementEvidenceCount: Number(trace.materialImprovementEvidenceCount),
      materialImprovementKindsCount: Array.isArray(trace.materialImprovementKinds)
        ? trace.materialImprovementKinds.length
        : 0,
    });
  }
  if (
    (trace.semanticNoOpDetected === true || trace.neutralRestyleDetected === true)
    && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
  ) {
    push('noop_visible_apply', {
      semanticNoOpDetected: trace.semanticNoOpDetected ?? null,
      neutralRestyleDetected: trace.neutralRestyleDetected ?? null,
      countedAsSuccess: trace.countedAsSuccess ?? null,
    });
  }
  if (
    trace.candidateSurfaceFormPassed === false
    && (
      trace.finalDecisionKind === 'material_improvement'
      || trace.countedAsSuccess === true
    )
  ) {
    push('surface_form_failure_selected', {
      candidateSurfaceFormPassed: false,
      finalDecisionKind: trace.finalDecisionKind ?? null,
    });
  }
  // AAB-314 — Spanish morphology / tense / non-vacuous predicate invariants.
  const isEsEnhance = String(trace.requestedLocale || '').toLowerCase().startsWith('es')
    && (trace.operationMode === 'enhance_existing' || trace.field === 'experience_description');
  if (isEsEnhance) {
    if (
      Number(trace.sourcePredicateIdentityCount ?? -1) === 0
      && Number(trace.sourceUnitCount ?? 0) > 0
      && (
        trace.sourceUnitPredicateCoveragePassed === true
        || trace.finalSourceUnitPredicateCoveragePassed === true
      )
    ) {
      push('vacuous_predicate_coverage_pass', {
        sourcePredicateIdentityCount: trace.sourcePredicateIdentityCount ?? null,
        sourceUnitPredicateCoveragePassed: trace.sourceUnitPredicateCoveragePassed ?? null,
      });
    }
    if (
      Number(trace.sourcePredicateIdentityCount ?? -1) === 0
      && Number(trace.sourceUnitCount ?? 0) > 0
      && (
        trace.countedAsSuccess === true
        || trace.visibleApplySucceeded === true
        || Number(trace.usageCountAfter) > Number(trace.usageCountBefore)
      )
    ) {
      push('zero_source_predicates_applied', {
        sourcePredicateIdentityCount: 0,
        countedAsSuccess: trace.countedAsSuccess ?? null,
      });
    }
    if (
      (
        trace.finalSourceUnitPredicateCoveragePassed == null
        || Number(trace.finalCandidatePredicateIdentityCount ?? 0) === 0
      )
      && (
        trace.countedAsSuccess === true
        || trace.visibleApplySucceeded === true
      )
    ) {
      push('null_or_zero_final_predicate_apply', {
        finalSourceUnitPredicateCoveragePassed:
          trace.finalSourceUnitPredicateCoveragePassed ?? null,
        finalCandidatePredicateIdentityCount:
          trace.finalCandidatePredicateIdentityCount ?? null,
      });
    }
    if (
      Array.isArray(trace.materialImprovementKinds)
      && (trace.materialImprovementKinds as string[]).includes('incomplete_bullet_completed')
      && Number(trace.sourceIncompleteUnitCount ?? 0) === 0
      && (
        trace.countedAsSuccess === true
        || (trace.materialImprovementKinds as string[]).includes('wrong_tense_fixed')
      )
    ) {
      push('false_incomplete_bullet_completed', {
        materialImprovementKindsCount: Array.isArray(trace.materialImprovementKinds)
          ? trace.materialImprovementKinds.length
          : 0,
      });
    }
    if (
      Array.isArray(trace.materialImprovementKinds)
      && (trace.materialImprovementKinds as string[]).includes('wrong_tense_fixed')
      && Number(trace.sourceTenseMismatchCount ?? 0) <= 0
      && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    ) {
      push('wrong_tense_without_mismatch', {
        sourceTenseMismatchCount: trace.sourceTenseMismatchCount ?? null,
      });
    }
    if (
      trace.tenseOnlyCorrectionDetected === true
      && trace.tenseOnlyUnexpectedExpansionDetected === true
      && (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
    ) {
      push('tense_only_unexpected_expansion_applied', {
        tenseOnlySourceLength: trace.tenseOnlySourceLength ?? null,
        tenseOnlyCandidateLength: trace.tenseOnlyCandidateLength ?? null,
      });
    }
    if (
      (trace.countedAsSuccess === true || Number(trace.usageCountAfter) > Number(trace.usageCountBefore))
      && trace.canonicalAcceptancePassed === false
    ) {
      push('usage_without_canonical_acceptance', {
        canonicalAcceptancePassed: false,
        countedAsSuccess: trace.countedAsSuccess ?? null,
      });
    }
    if (
      trace.materialImprovementDetected === true
      && Array.isArray(trace.materialImprovementKinds)
      && (trace.materialImprovementKinds as unknown[]).length > 0
      && (
        Number(trace.materialImprovementEvidenceCount ?? 0)
          < (trace.materialImprovementKinds as unknown[]).length
        || trace.everyImprovementKindHasEvidence === false
      )
    ) {
      push('improvement_kind_missing_evidence', {
        materialImprovementEvidenceCount: trace.materialImprovementEvidenceCount ?? null,
        materialImprovementKindsCount: (trace.materialImprovementKinds as unknown[]).length,
      });
    }
    // AAB-315 — source-defect-first decision / provider no-op blocking.
    if (
      trace.sourceAlreadyValidForTarget === false
      && (
        trace.finalDecisionKind === 'exact_noop'
        || trace.finalDecisionKind === 'normalized_noop'
        || trace.finalDecisionKind === 'semantic_noop'
      )
      && (
        Number(trace.sourceTenseMismatchCount ?? 0) > 0
        || (Array.isArray(trace.providerUnresolvedSourceDefectKinds)
          && (trace.providerUnresolvedSourceDefectKinds as unknown[]).length > 0)
      )
      && trace.deterministicTenseNormalizerAttempted !== true
    ) {
      push('final_noop_before_source_defect_recovery', {
        sourceAlreadyValidForTarget: false,
        finalDecisionKind: trace.finalDecisionKind ?? null,
        sourceTenseMismatchCount: trace.sourceTenseMismatchCount ?? null,
      });
    }
    if (
      trace.providerNoOpDetected === true
      && trace.sourceAlreadyValidForTarget === false
      && Number(trace.sourceTenseMismatchCount ?? 0) > 0
      && trace.providerNoOpBlockedBySourceDefect !== true
      && (
        trace.finalDecisionKind === 'exact_noop'
        || trace.finalDecisionKind === 'normalized_noop'
        || trace.finalDecisionKind === 'semantic_noop'
        || (
          trace.countedAsSuccess !== true
          && trace.deterministicTenseNormalizerAttempted !== true
        )
      )
    ) {
      push('provider_noop_not_blocked_by_wrong_tense', {
        providerNoOpBlockedBySourceDefect: trace.providerNoOpBlockedBySourceDefect ?? null,
        sourceTenseMismatchCount: trace.sourceTenseMismatchCount ?? null,
      });
    }
    if (
      (trace.countedAsSuccess === true || trace.visibleApplySucceeded === true)
      && Array.isArray(trace.materialImprovementKinds)
      && (trace.materialImprovementKinds as string[]).includes('wrong_tense_fixed')
      && Number(trace.wrongTenseFixedUnitCount ?? 0) <= 0
    ) {
      push('wrong_tense_fixed_missing_unit_count', {
        wrongTenseFixedUnitCount: trace.wrongTenseFixedUnitCount ?? null,
      });
    }
    if (
      (trace.countedAsSuccess === true || Number(trace.usageCountAfter) > Number(trace.usageCountBefore))
      && trace.shouldApply === false
    ) {
      push('usage_without_should_apply', {
        shouldApply: false,
        countedAsSuccess: trace.countedAsSuccess ?? null,
      });
    }
    if (
      Number(trace.usageCountAfter) > Number(trace.usageCountBefore)
      && trace.visibleApplySucceeded !== true
      && trace.countedAsSuccess !== true
    ) {
      push('usage_without_visible_apply', {
        visibleApplySucceeded: trace.visibleApplySucceeded ?? null,
        usageCountBefore: trace.usageCountBefore ?? null,
        usageCountAfter: trace.usageCountAfter ?? null,
      });
    }
    if (
      (
        trace.finalDecisionKind === 'exact_noop'
        || trace.finalDecisionKind === 'normalized_noop'
        || trace.finalDecisionKind === 'semantic_noop'
        || trace.finalDecisionKind === 'neutral_restyle_noop'
      )
      && (
        trace.countedAsSuccess === true
        || Number(trace.usageCountAfter) > Number(trace.usageCountBefore)
      )
    ) {
      push('noop_decision_with_apply_or_usage', {
        finalDecisionKind: trace.finalDecisionKind ?? null,
        countedAsSuccess: trace.countedAsSuccess ?? null,
      });
    }
    if (
      trace.perspectiveNormalizationApplied === false
      && trace.perspectiveValidationPassed === true
      && String(trace.rejectionStage || '') === 'provider:noop'
      && String(trace.typedFailureReason || '').includes('perspective')
    ) {
      push('noop_mislabeled_as_perspective_failure', {
        rejectionStage: trace.rejectionStage ?? null,
        typedFailureReason: trace.typedFailureReason ?? null,
      });
    }
  }
  return { passed: failures.length === 0, failures };
}

export function checkExperienceDiagnosticCompleteness(
  trace: Record<string, unknown>,
): {
  passed: boolean;
  missingRequiredDiagnosticFields: string[];
  nullRequiredDiagnosticFields: string[];
} {
  const missing: string[] = [];
  const nullish: string[] = [];
  const require = (key: string) => {
    if (!(key in trace)) missing.push(key);
    else if (trace[key] === null || trace[key] === undefined) nullish.push(key);
  };
  require('diagnosticContractRevision');
  require('schemaVersion');
  require('requestedLocale');
  require('countedAsSuccess');
  require('visibleApplySucceeded');
  require('usageCountBefore');
  require('usageCountAfter');
  require('selectedSourceKind');
  require('clickedExperienceEntryIdHash');
  if (trace.countedAsSuccess === true && trace.visibleApplySucceeded === true) {
    if (
      !('visibleTextareaMatchesFinalNormalizedHash' in trace)
      || trace.visibleTextareaMatchesFinalNormalizedHash === null
      || trace.visibleTextareaMatchesFinalNormalizedHash === undefined
    ) {
      nullish.push('visibleTextareaMatchesFinalNormalizedHash');
    }
    if (
      !('visibleDescriptionMatchesFinalHash' in trace)
      || trace.visibleDescriptionMatchesFinalHash === null
      || trace.visibleDescriptionMatchesFinalHash === undefined
    ) {
      nullish.push('visibleDescriptionMatchesFinalHash');
    }
    if (
      !('finalNormalizedHash' in trace)
      || trace.finalNormalizedHash === null
      || trace.finalNormalizedHash === undefined
      || trace.finalNormalizedHash === ''
    ) {
      nullish.push('finalNormalizedHash');
    }
  }
  // AAB-313 — decision-object completeness for Spanish Experience outcomes.
  if (
    (trace.operationMode === 'enhance_existing' || trace.field === 'experience_description')
    && String(trace.requestedLocale || '').toLowerCase().startsWith('es')
  ) {
    if (
      trace.finalDecisionKind === 'material_improvement'
      || trace.finalDecisionKind === 'semantic_noop'
      || trace.finalDecisionKind === 'neutral_restyle_noop'
      || trace.finalDecisionKind === 'degradation_rejected'
      || trace.finalDecisionKind === 'invalid_candidate_rejected'
      || trace.finalDecisionKind === 'exact_noop'
      || trace.finalDecisionKind === 'normalized_noop'
      || trace.finalDecisionKind === 'race_rejected'
      || trace.finalDecisionKind === 'terminal_failure'
    ) {
      require('finalDecisionKind');
      if (!('materialImprovementDetected' in trace)) missing.push('materialImprovementDetected');
      if (!('semanticNoOpDetected' in trace)) missing.push('semanticNoOpDetected');
      if (!('degradationDetected' in trace)) missing.push('degradationDetected');
    }
    if (trace.materialImprovementDetected === true) {
      if (!('materialImprovementKinds' in trace)) missing.push('materialImprovementKinds');
      if (!('materialImprovementEvidenceCount' in trace)) {
        missing.push('materialImprovementEvidenceCount');
      }
      if (!('everyImprovementKindHasEvidence' in trace)) {
        missing.push('everyImprovementKindHasEvidence');
      }
    }
    // AAB-314 — decision-critical tense / predicate evidence fields.
    if (
      trace.countedAsSuccess === true
      || trace.visibleApplySucceeded === true
      || trace.finalDecisionKind === 'material_improvement'
    ) {
      for (const key of [
        'sourcePredicateIdentityCount',
        'finalCandidatePredicateIdentityCount',
        'finalSourceUnitPredicateCoveragePassed',
        'canonicalAcceptancePassed',
      ] as const) {
        if (!(key in trace)) missing.push(key);
      }
    }
    if (trace.tenseOnlyCorrectionDetected === true) {
      for (const key of [
        'expectedEmploymentTense',
        'sourceTenseMismatchCount',
        'tenseOnlyPreservationPassed',
        'tenseOnlyUnexpectedExpansionDetected',
      ] as const) {
        if (!(key in trace)) missing.push(key);
      }
    }
    // AAB-315 — source-defect-first / phase tense decision fields.
    for (const key of [
      'sourceAlreadyValidForTarget',
      'expectedEmploymentTense',
      'sourceTenseMismatchCount',
      'sourceTenseValidationPassed',
      'providerNoOpEligibleAsFinal',
      'providerNoOpBlockedBySourceDefect',
    ] as const) {
      if (!(key in trace)) missing.push(key);
    }
    // AAB-317 — early no-op / final-candidate N/A completeness.
    if (trace.earlyNoOpPreflightPassed === true
      || trace.finalDecisionKind === 'exact_noop'
      || trace.finalDecisionKind === 'semantic_noop') {
      for (const key of [
        'factAuthorityKind',
        'authoritativeFactSourceKind',
        'visibleComparisonProvenance',
        'visibleComparisonMatchedLastAiOutput',
        'semanticNoOpDetected',
        'degradationDetected',
        'finalDecisionKind',
        'providerAttempted',
        'finalTypedFailureReason',
        'rejectionStage',
        'finalCandidatePresent',
        'finalBulletCount',
        'finalBulletScripts',
      ] as const) {
        if (!(key in trace)) missing.push(key);
      }
      // AAB-318 — semantic consistency for clean no-op.
      if (trace.earlyNoOpPreflightPassed === true) {
        if (trace.providerAttempted !== false) {
          nullish.push('providerAttempted_must_be_false_on_preflight_noop');
        }
        if (trace.finalTypedFailureReason != null) {
          nullish.push('finalTypedFailureReason_must_be_null_on_clean_noop');
        }
        if (trace.rejectionStage != null) {
          nullish.push('rejectionStage_must_be_null_on_clean_noop');
        }
        if (
          typeof trace.finalBulletCount === 'number'
          && Array.isArray(trace.finalBulletScripts)
          && Number(trace.finalBulletCount)
            !== (trace.finalBulletScripts as unknown[]).length
        ) {
          nullish.push('finalBulletCount_scripts_length_mismatch');
        }
        if (
          Array.isArray(trace.stages)
          && (trace.stages as Array<{ result?: string }>).some((s) => s?.result === 'fail')
        ) {
          nullish.push('clean_noop_stages_must_not_fail');
        }
      }
      // Null final-candidate predicate fields are valid when no candidate present.
      if (trace.finalCandidatePresent === false
        || trace.finalCandidateSource === 'none'
        || !('finalCandidatePresent' in trace)) {
        // Accept null N/A semantics — do not require positive predicate counts.
      } else if (trace.finalCandidatePresent === true) {
        for (const key of [
          'finalCandidatePredicateIdentityCount',
          'finalSourceUnitPredicateCoveragePassed',
        ] as const) {
          if (!(key in trace)) missing.push(key);
        }
      }
    }
    if (
      trace.providerNoOpBlockedBySourceDefect === true
      || Number(trace.sourceTenseMismatchCount ?? 0) > 0
    ) {
      for (const key of [
        'deterministicTenseNormalizerAttempted',
        'providerUnresolvedSourceDefectKinds',
      ] as const) {
        if (!(key in trace)) missing.push(key);
      }
    }
    if (
      trace.countedAsSuccess === true
      || trace.visibleApplySucceeded === true
      || trace.finalDecisionKind === 'material_improvement'
    ) {
      for (const key of [
        'shouldApply',
        'shouldIncrementUsage',
        'wrongTenseFixedUnitCount',
      ] as const) {
        if (!(key in trace) && (
          Array.isArray(trace.materialImprovementKinds)
          && (trace.materialImprovementKinds as string[]).includes('wrong_tense_fixed')
        )) {
          missing.push(key);
        }
      }
      if (!('shouldApply' in trace)) missing.push('shouldApply');
      if (!('shouldIncrementUsage' in trace)) missing.push('shouldIncrementUsage');
    }
    if ('unsupportedClaimRepairAttempted' in trace
      && trace.unsupportedClaimRepairAttempted === true) {
      if (!('unsupportedClaimRepairCandidateProduced' in trace)) {
        missing.push('unsupportedClaimRepairCandidateProduced');
      }
      if (!('unsupportedClaimRepairVisibleApplyPerformed' in trace)) {
        missing.push('unsupportedClaimRepairVisibleApplyPerformed');
      }
    }
  }
  const markerCheck = validateCvAiDiagnosticMarkerField({
    ...trace,
    operationKind: trace.operationKind || 'experience',
  });
  missing.push(...markerCheck.missingRequiredDiagnosticFields);
  nullish.push(...markerCheck.nullRequiredDiagnosticFields);
  return {
    passed: missing.length === 0 && nullish.length === 0,
    missingRequiredDiagnosticFields: dedupeStableStrings(missing),
    nullRequiredDiagnosticFields: dedupeStableStrings(nullish),
  };
}

/** Privacy scan — reject raw PII / long prose in diagnostic JSON. */
export function assertCvAiDiagnosticPrivacy(payload: unknown): string[] {
  const json = JSON.stringify(payload);
  const violations: string[] = [];
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(json)) {
    violations.push('email_like_token');
  }
  if (/\+?\d[\d\s().-]{8,}\d/.test(json)) {
    // Ignore ISO timestamps / date-only tokens embedded in diagnostics.
    const withoutIso = json
      .replace(/\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?/g, '')
      .replace(/fnv1a_[a-f0-9_]+/gi, '');
    if (/\+?\d[\d\s().-]{8,}\d/.test(withoutIso)) {
      violations.push('phone_like_token');
    }
  }
  // Long Devanagari or Latin prose blobs (hashes are short fnv1a_ tokens).
  if (/[\u0900-\u097F]{40,}/.test(json)) {
    violations.push('long_devanagari_prose');
  }
  if (/\b[A-Za-z][a-z]+(?:\s+[A-Za-z][a-z]+){6,}\b/.test(json)) {
    violations.push('long_latin_prose');
  }
  if (/sk-ant-|sk-proj-|Bearer\s+[A-Za-z0-9._-]{20,}/i.test(json)) {
    violations.push('secret_like_token');
  }
  if (/"prompt"\s*:\s*"[^"]{20,}"/i.test(json)) {
    violations.push('prompt_field');
  }
  return violations;
}

export function maybeTruncateDiagnosticPayload<T extends Record<string, unknown>>(
  trace: T,
  maxChars = CV_AI_DIAGNOSTIC_MAX_PAYLOAD_CHARS,
): T & { diagnosticPayloadTruncated?: boolean; diagnosticPayloadByteSize?: number } {
  const json = JSON.stringify(trace);
  const size = json.length;
  if (size <= maxChars) {
    return { ...trace, diagnosticPayloadTruncated: false, diagnosticPayloadByteSize: size };
  }
  const next: Record<string, unknown> = { ...trace };
  // Drop optional bulky stage detail first.
  if (Array.isArray(next.candidateLineage) && (next.candidateLineage as unknown[]).length > 2) {
    next.candidateLineage = (next.candidateLineage as unknown[]).slice(0, 2);
    next.diagnosticTruncatedSection = 'candidateLineage';
  }
  if (Array.isArray(next.stages) && (next.stages as unknown[]).length > 40) {
    next.stages = (next.stages as unknown[]).slice(-40);
    next.diagnosticTruncatedSection = 'stages';
  }
  const resized = JSON.stringify(next).length;
  return {
    ...(next as T),
    diagnosticPayloadTruncated: true,
    diagnosticPayloadByteSize: resized,
  };
}

function readHistory(): CvAiDiagnosticHistoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(CV_AI_DIAG_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}

function writeHistory(items: CvAiDiagnosticHistoryItem[]): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CV_AI_DIAG_HISTORY_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore */
  }
}

export function appendCvAiDiagnosticHistory(item: CvAiDiagnosticHistoryItem): void {
  const all = readHistory();
  const sameKind = all.filter((h) => h.operationKind === item.operationKind);
  const other = all.filter((h) => h.operationKind !== item.operationKind);
  const nextKind = [item, ...sameKind].slice(0, HISTORY_MAX_PER_KIND);
  writeHistory([...nextKind, ...other].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)));
}

export function getCvAiDiagnosticHistory(
  kind?: CvAiDiagnosticOperationKind,
): CvAiDiagnosticHistoryItem[] {
  const all = readHistory();
  if (!kind) return all;
  return all.filter((h) => h.operationKind === kind).slice(0, HISTORY_MAX_PER_KIND);
}

export function clearCvAiDiagnosticHistory(kind?: CvAiDiagnosticOperationKind): void {
  if (!kind) {
    writeHistory([]);
    try {
      emitCvAiDiagnosticsChanged({ kind: 'summary', action: 'clear_history' });
      emitCvAiDiagnosticsChanged({ kind: 'experience', action: 'clear_history' });
    } catch {
      /* ignore */
    }
    return;
  }
  writeHistory(readHistory().filter((h) => h.operationKind !== kind));
  try {
    emitCvAiDiagnosticsChanged({ kind, action: 'clear_history' });
  } catch {
    /* ignore */
  }
}

/** Retain marker strings for asset verification (internal builds). */
export const CV_AI_DIAGNOSTIC_REQUIRED_ASSET_STRINGS = [
  CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
  CV_AI_DIAGNOSTIC_BUNDLE_MARKER,
  CV_AI_DIAGNOSTICS_V2_299_REVISION,
  SUMMARY_AI_DIAG_MARKER,
  EXPERIENCE_AI_DIAG_MARKER,
  EXPERIENCE_DIAGNOSTIC_MARKER_302_REVISION,
  'hindiNominalExperienceFragmentDetected',
  'hindiSentenceHasFiniteCopulaOrVerb',
  'finalUnsupportedDesignMediumCount',
  'deterministicUnsupportedDesignMediumCount',
  'diagnosticInvariantCheckPassed',
  'diagnosticCompletenessPassed',
  'candidateLineage',
  'hindiSentenceGrammarRecords',
  'experience-preflight-build-metadata-318-v1',
  'experience-clean-noop-terminal-outcome-318-v1',
  'experience-provider-not-attempted-truth-318-v1',
  'experience-terminal-diagnostic-consistency-318-v1',
  INTERNAL_AI_RESET_BUNDLE_MARKER || 'CVPRO_INTERNAL_AI_RESET_ENABLED_V1',
] as const;
void CV_AI_DIAGNOSTIC_REQUIRED_ASSET_STRINGS;
