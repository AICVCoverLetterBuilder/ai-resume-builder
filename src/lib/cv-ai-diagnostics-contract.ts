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
  unitCount: number;
  unitHashes: string[];
  sentenceCount?: number;
  sentenceHashes?: string[];
  sentenceRoleSlots?: string[];
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
  repairApplied?: boolean;
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
  visibleCandidateHashAfterApply?: string | null;
  finalUnitRoleSlots?: string[] | null;
  currentIntroSlotPresent?: boolean | null;
  currentDutySlotPresent?: boolean | null;
  priorRoleSlotPresent?: boolean | null;
  targetLocalePurityPassed?: boolean;
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
  clientFallbackUsed?: boolean | null;
  candidateLineage?: Array<{
    candidateKind?: string;
    present?: boolean;
    accepted?: boolean;
    unitCount?: number;
    unitHashes?: string[];
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
  if (src.includes('repair') || src === 'ai_repaired') {
    if (trace.repairApplied === false && trace.fallbackApplied !== true) {
      // duration-only ai_repaired is allowed without summary repairApplied
    }
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
    if (!slots.includes('current_intro') || !slots.includes('current_duty')) {
      push('three_slot_incomplete_on_success', {
        finalUnitRoleSlots: slots.join(','),
      });
    }
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
  providerAccepted?: boolean | null;
  clientDeterministicFallbackAttempted?: boolean;
  clientDeterministicFallbackApplied?: boolean;
  fallbackSelected?: boolean;
  visibleApplySucceeded?: boolean;
  countedAsSuccess?: boolean;
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
    && trace.clientDeterministicFallbackApplied === false) {
    push('final_source_deterministic_but_not_applied', {
      finalCandidateSource: 'deterministic_fallback',
      clientDeterministicFallbackApplied: false,
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
    && trace.factAuthorityKind !== 'pre_ai_snapshot'
    && trace.factAuthorityKind !== 'original_user'
  ) {
    push('fact_authority_kind_contradicts_authoritative_source', {
      authoritativeFactSourceKind: trace.authoritativeFactSourceKind,
      factAuthorityKind: trace.factAuthorityKind,
    });
  }
  // AAB-317 — dual-source / unedited-rerun diagnostic truth.
  if (
    trace.factAuthorityMatchesAuthoritativeSourceKind === true
    && trace.factAuthorityKind != null
    && trace.authoritativeFactSourceKind != null
    && String(trace.factAuthorityKind) !== String(trace.authoritativeFactSourceKind)
    // Allow original_user ↔ pre_ai_snapshot only when both represent user facts —
    // but the consistency boolean must not stay true across current_textarea drift.
    && !(
      (trace.factAuthorityKind === 'pre_ai_snapshot'
        && trace.authoritativeFactSourceKind === 'original_user')
      || (trace.factAuthorityKind === 'original_user'
        && trace.authoritativeFactSourceKind === 'pre_ai_snapshot')
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
      ] as const) {
        if (!(key in trace)) missing.push(key);
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
  INTERNAL_AI_RESET_BUNDLE_MARKER || 'CVPRO_INTERNAL_AI_RESET_ENABLED_V1',
] as const;
void CV_AI_DIAGNOSTIC_REQUIRED_ASSET_STRINGS;
