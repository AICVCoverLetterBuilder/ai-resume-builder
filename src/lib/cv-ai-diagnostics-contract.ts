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

/** Stable contract revision — must survive minification in internal builds. */
export const CV_AI_DIAGNOSTIC_CONTRACT_REVISION = 'cv-ai-diagnostics-v2' as const;
export const CV_AI_DIAGNOSTIC_BUNDLE_MARKER = 'cv-ai-diagnostics-v2' as const;
/** AAB-299 packaging proof marker for the v2 diagnostics contract. */
export const CV_AI_DIAGNOSTICS_V2_299_REVISION = 'cv-ai-diagnostics-v2-299-v1' as const;
void CV_AI_DIAGNOSTIC_CONTRACT_REVISION;
void CV_AI_DIAGNOSTIC_BUNDLE_MARKER;
void CV_AI_DIAGNOSTICS_V2_299_REVISION;

/** Soft byte budget for copied diagnostic JSON (UTF-16 code units ≈ bytes for ASCII). */
export const CV_AI_DIAGNOSTIC_MAX_PAYLOAD_CHARS = 120_000;

export type CvAiDiagnosticOperationKind = 'experience' | 'summary';

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
};

export type CvAiDiagnosticBuildIdentity = {
  diagnosticContractRevision: typeof CV_AI_DIAGNOSTIC_CONTRACT_REVISION;
  compiledDiagnosticMarker: typeof CV_AI_DIAGNOSTIC_BUNDLE_MARKER;
  assetRevision: string;
  internalDiagnosticsEnabled: boolean;
  internalResetEnabled: boolean;
  internalBuildContractUsed: boolean | null;
  serverUrlConfigured: boolean;
  sourceCommitShort: string | null;
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

export function buildCvAiDiagnosticBuildIdentity(options?: {
  assetRevision?: string | null;
  sourceCommitShort?: string | null;
  serverUrlConfigured?: boolean;
  internalBuildContractUsed?: boolean | null;
}): CvAiDiagnosticBuildIdentity {
  return {
    diagnosticContractRevision: CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
    compiledDiagnosticMarker: CV_AI_DIAGNOSTIC_BUNDLE_MARKER,
    assetRevision: options?.assetRevision || INTERNAL_AI_DIAGNOSTICS_REVISION || 'unknown',
    internalDiagnosticsEnabled: Boolean(INTERNAL_AI_RESET_ENABLED),
    internalResetEnabled: Boolean(INTERNAL_AI_RESET_ENABLED),
    internalBuildContractUsed: options?.internalBuildContractUsed
      ?? (INTERNAL_AI_RESET_ENABLED ? true : false),
    serverUrlConfigured: Boolean(options?.serverUrlConfigured),
    sourceCommitShort: options?.sourceCommitShort ?? null,
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
      reasons.push(input.hindiGrammarRejectionReason);
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
      grammarReasons: reasons,
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
  require('marker');
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

  return {
    passed: missing.length === 0 && nullish.length === 0,
    missingRequiredDiagnosticFields: missing,
    nullRequiredDiagnosticFields: nullish,
  };
}

type ExperienceLike = {
  finalCandidateSource?: string | null;
  providerAttempted?: boolean;
  clientDeterministicFallbackAttempted?: boolean;
  clientDeterministicFallbackApplied?: boolean;
  visibleApplySucceeded?: boolean;
  countedAsSuccess?: boolean;
  usageCountBefore?: number;
  usageCountAfter?: number;
  raceGuardResult?: string | null;
  stableEntryIdentityMatched?: boolean | null;
  targetEntryStillExists?: boolean | null;
  visibleDescriptionMatchesFinalHash?: boolean | null;
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
  if (trace.finalCandidateSource === 'deterministic_fallback'
    && trace.clientDeterministicFallbackApplied === false) {
    push('final_source_deterministic_but_not_applied', {
      finalCandidateSource: 'deterministic_fallback',
      clientDeterministicFallbackApplied: false,
    });
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
  return {
    passed: missing.length === 0,
    missingRequiredDiagnosticFields: missing,
    nullRequiredDiagnosticFields: nullish,
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
    return;
  }
  writeHistory(readHistory().filter((h) => h.operationKind !== kind));
}

/** Retain marker strings for asset verification (internal builds). */
export const CV_AI_DIAGNOSTIC_REQUIRED_ASSET_STRINGS = [
  CV_AI_DIAGNOSTIC_CONTRACT_REVISION,
  CV_AI_DIAGNOSTIC_BUNDLE_MARKER,
  CV_AI_DIAGNOSTICS_V2_299_REVISION,
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
