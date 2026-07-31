/**
 * AAB-387 — transactional Summary visible apply with compare-and-swap ownership.
 *
 * Device defect (AAB 386): after a successful Shorter write, the next Stronger /
 * Professional path called setState then immediately hashed cvRef.current.summary.
 * cvRef is only updated inside the setState updater; when React deferred that
 * updater (pending lane after the prior rewrite), the visible read still saw the
 * Shorter text → visible_summary_hash_mismatch + false race_guard=fail.
 *
 * This module:
 * 1. CAS-applies only when the live source hash still matches the operation source;
 * 2. synchronously establishes cvRef + authoritative hash before React commit;
 * 3. returns the written Summary for post-write validation (never a stale ref read);
 * 4. suppresses stale autosave / context overwrites belonging to older generations.
 */

import type { CVData } from './types';
import type { Locale } from './i18n/translations';
import {
  applyFinalizedSummaryToCv,
  normalizeSummaryCandidateText,
  type FinalizeCvAiFieldResult,
} from './cv-ai-finalize-apply';
import { fingerprintText } from './cv-export-diagnostics';

export const SUMMARY_TRANSACTIONAL_APPLY_387_REVISION =
  'summary-transactional-apply-387-v1' as const;

export type SummaryApplyLifecycleDiagnostics = {
  operationSourceHash: string | null;
  selectedFinalHash: string | null;
  cvRefHashBeforeWrite: string | null;
  cvRefHashImmediatelyAfterWrite: string | null;
  reactStateHashAfterCommit: string | null;
  textareaValueHashAfterCommit: string | null;
  persistedSummaryHashAfterCommit: string | null;
  pendingAutosaveSourceHash: string | null;
  staleAutosaveWriteSuppressed: boolean;
  activeOperationIdHashBeforeWrite: string | null;
  activeOperationIdHashAfterWrite: string | null;
  applyOwnershipPassed: boolean;
  actualRaceDetected: boolean;
  actualRaceReason: string | null;
  postWriteReadSource:
    | 'operation_owned_written_summary'
    | 'cv_ref_after_sync_write'
    | 'rejected_before_write'
    | null;
  visibleApplyFailureStage: string | null;
};

export type SummaryApplyOwnershipState = {
  /** Monotonic generation — bumped on every successful transactional write. */
  generation: number;
  /** Normalized fingerprint of the last successfully committed Summary. */
  authoritativeSummaryHash: string | null;
  /** Privacy-safe hash of the active operation id (requestId). */
  activeOperationIdHash: string | null;
  /** Source hash the active operation snapped at press time. */
  activeOperationSourceHash: string | null;
  /** Pending autosave intended hash (null when idle). */
  pendingAutosaveSourceHash: string | null;
  /** Last suppressed stale autosave hash (diagnostics). */
  lastStaleAutosaveSuppressedHash: string | null;
};

export function createSummaryApplyOwnershipState(): SummaryApplyOwnershipState {
  return {
    generation: 0,
    authoritativeSummaryHash: null,
    activeOperationIdHash: null,
    activeOperationSourceHash: null,
    pendingAutosaveSourceHash: null,
    lastStaleAutosaveSuppressedHash: null,
  };
}

export function hashSummaryTextForApply(text: string | null | undefined): string {
  const normalized = normalizeSummaryCandidateText(String(text || '')) || 'empty';
  return fingerprintText(normalized);
}

export function hashOperationId(operationId: string | null | undefined): string {
  return fingerprintText(String(operationId || 'empty_operation'));
}

function emptyLifecycle(): SummaryApplyLifecycleDiagnostics {
  return {
    operationSourceHash: null,
    selectedFinalHash: null,
    cvRefHashBeforeWrite: null,
    cvRefHashImmediatelyAfterWrite: null,
    reactStateHashAfterCommit: null,
    textareaValueHashAfterCommit: null,
    persistedSummaryHashAfterCommit: null,
    pendingAutosaveSourceHash: null,
    staleAutosaveWriteSuppressed: false,
    activeOperationIdHashBeforeWrite: null,
    activeOperationIdHashAfterWrite: null,
    applyOwnershipPassed: false,
    actualRaceDetected: false,
    actualRaceReason: null,
    postWriteReadSource: null,
    visibleApplyFailureStage: null,
  };
}

export type CommitSummaryApplyResult = {
  ok: boolean;
  writtenCv: CVData | null;
  writtenSummary: string;
  generation: number;
  lifecycle: SummaryApplyLifecycleDiagnostics;
};

/**
 * Synchronously CAS-apply a finalized Summary into cvRef, then schedule React state.
 * Post-write validation MUST use `writtenSummary`, not a later cvRef re-read alone.
 */
export function commitSummaryApplyTransactionally(options: {
  cvRef: { current: CVData };
  ownership: SummaryApplyOwnershipState;
  locale: Locale;
  finalized: FinalizeCvAiFieldResult;
  /** Frozen Summary text at button press (operation source). */
  operationSourceText: string;
  operationId: string;
  /** Schedule React CV state to the written CV (must not be the sole cvRef write). */
  scheduleReactCv: (next: CVData) => void;
  /** Optional immediate persist (flush). May be deferred via autosave ownership. */
  persistCv?: (next: CVData) => void;
  /** Optional React/textarea snapshot for lifecycle diagnostics after schedule. */
  readReactSummary?: () => string | null | undefined;
}): CommitSummaryApplyResult {
  void SUMMARY_TRANSACTIONAL_APPLY_387_REVISION;
  const lifecycle = emptyLifecycle();
  const operationSourceHash = hashSummaryTextForApply(options.operationSourceText);
  const selectedFinalHash = hashSummaryTextForApply(options.finalized.text);
  const operationIdHash = hashOperationId(options.operationId);
  const beforeCv = options.cvRef.current;
  const beforeHash = hashSummaryTextForApply(beforeCv.summary);

  lifecycle.operationSourceHash = operationSourceHash;
  lifecycle.selectedFinalHash = selectedFinalHash;
  lifecycle.cvRefHashBeforeWrite = beforeHash;
  lifecycle.activeOperationIdHashBeforeWrite = options.ownership.activeOperationIdHash;
  lifecycle.pendingAutosaveSourceHash = options.ownership.pendingAutosaveSourceHash;

  options.ownership.activeOperationIdHash = operationIdHash;
  options.ownership.activeOperationSourceHash = operationSourceHash;

  // Real source race: live CV no longer matches the operation snapshot.
  if (beforeHash !== operationSourceHash) {
    lifecycle.actualRaceDetected = true;
    lifecycle.actualRaceReason = 'source_hash_changed_before_write';
    lifecycle.applyOwnershipPassed = false;
    lifecycle.visibleApplyFailureStage = 'compare_and_swap_source';
    lifecycle.postWriteReadSource = 'rejected_before_write';
    lifecycle.activeOperationIdHashAfterWrite = options.ownership.activeOperationIdHash;
    return {
      ok: false,
      writtenCv: null,
      writtenSummary: '',
      generation: options.ownership.generation,
      lifecycle,
    };
  }

  if (options.finalized.blocked || !options.finalized.countedAsSuccess) {
    lifecycle.applyOwnershipPassed = false;
    lifecycle.visibleApplyFailureStage = 'finalized_not_applicable';
    lifecycle.postWriteReadSource = 'rejected_before_write';
    lifecycle.activeOperationIdHashAfterWrite = options.ownership.activeOperationIdHash;
    return {
      ok: false,
      writtenCv: null,
      writtenSummary: '',
      generation: options.ownership.generation,
      lifecycle,
    };
  }

  const next = applyFinalizedSummaryToCv(beforeCv, options.locale, options.finalized);
  const writtenSummary = String(next.summary || '');
  const afterHash = hashSummaryTextForApply(writtenSummary);

  // Synchronously establish authoritative ownership BEFORE React commit / validation.
  options.cvRef.current = next;
  options.ownership.generation += 1;
  options.ownership.authoritativeSummaryHash = afterHash;
  options.ownership.pendingAutosaveSourceHash = afterHash;
  options.ownership.lastStaleAutosaveSuppressedHash = null;

  lifecycle.cvRefHashImmediatelyAfterWrite = hashSummaryTextForApply(
    options.cvRef.current.summary,
  );
  lifecycle.applyOwnershipPassed =
    lifecycle.cvRefHashImmediatelyAfterWrite === selectedFinalHash
    && afterHash === selectedFinalHash;
  lifecycle.activeOperationIdHashAfterWrite = operationIdHash;
  lifecycle.postWriteReadSource = 'operation_owned_written_summary';

  if (!lifecycle.applyOwnershipPassed) {
    // Roll back synchronous write — candidate did not stick into CV.
    options.cvRef.current = beforeCv;
    options.ownership.authoritativeSummaryHash = beforeHash;
    options.ownership.pendingAutosaveSourceHash = beforeHash;
    lifecycle.visibleApplyFailureStage = 'write_did_not_materialize_selected_hash';
    lifecycle.cvRefHashImmediatelyAfterWrite = hashSummaryTextForApply(
      options.cvRef.current.summary,
    );
    return {
      ok: false,
      writtenCv: null,
      writtenSummary: '',
      generation: options.ownership.generation,
      lifecycle,
    };
  }

  options.scheduleReactCv(next);
  if (options.persistCv) {
    options.persistCv(next);
    lifecycle.persistedSummaryHashAfterCommit = afterHash;
  }

  const reactSummary = options.readReactSummary?.();
  if (typeof reactSummary === 'string') {
    lifecycle.reactStateHashAfterCommit = hashSummaryTextForApply(reactSummary);
    lifecycle.textareaValueHashAfterCommit = lifecycle.reactStateHashAfterCommit;
  } else {
    // React may still be pending; authoritative truth is the sync write.
    lifecycle.reactStateHashAfterCommit = afterHash;
    lifecycle.textareaValueHashAfterCommit = afterHash;
  }
  if (lifecycle.persistedSummaryHashAfterCommit == null) {
    lifecycle.persistedSummaryHashAfterCommit = afterHash;
  }

  return {
    ok: true,
    writtenCv: next,
    writtenSummary,
    generation: options.ownership.generation,
    lifecycle,
  };
}

/**
 * Roll back a failed visible apply to the operation source, preserving CAS ownership.
 */
export function rollbackSummaryApplyTransactionally(options: {
  cvRef: { current: CVData };
  ownership: SummaryApplyOwnershipState;
  operationSourceText: string;
  scheduleReactCv: (next: CVData) => void;
  persistCv?: (next: CVData) => void;
}): void {
  const rolled: CVData = {
    ...options.cvRef.current,
    summary: options.operationSourceText,
  };
  const hash = hashSummaryTextForApply(options.operationSourceText);
  options.cvRef.current = rolled;
  options.ownership.generation += 1;
  options.ownership.authoritativeSummaryHash = hash;
  options.ownership.pendingAutosaveSourceHash = hash;
  options.scheduleReactCv(rolled);
  options.persistCv?.(rolled);
}

/**
 * Whether an incoming context/persisted CV should overwrite local authoritative state.
 * Returns false when local AI apply is newer than the incoming Summary hash.
 */
export function shouldAcceptIncomingSummaryCv(options: {
  ownership: SummaryApplyOwnershipState;
  incomingCv: CVData;
  localCvRef: CVData;
}): boolean {
  const authoritative = options.ownership.authoritativeSummaryHash;
  if (!authoritative) return true;
  const incomingHash = hashSummaryTextForApply(options.incomingCv.summary);
  const localHash = hashSummaryTextForApply(options.localCvRef.summary);
  if (localHash === authoritative && incomingHash !== authoritative) {
    return false;
  }
  return true;
}

/**
 * Autosave flush gate: suppress writes scheduled against an older generation /
 * older Summary hash once a newer transactional apply has committed.
 */
export function shouldFlushSummaryAutosave(options: {
  ownership: SummaryApplyOwnershipState;
  scheduledGeneration: number;
  scheduledSummaryHash: string;
  liveCvRef: CVData;
}): { flush: boolean; suppressed: boolean; cvToPersist: CVData | null; reason: string | null } {
  const liveHash = hashSummaryTextForApply(options.liveCvRef.summary);
  const authoritative = options.ownership.authoritativeSummaryHash;

  if (options.scheduledGeneration !== options.ownership.generation) {
    options.ownership.lastStaleAutosaveSuppressedHash = options.scheduledSummaryHash;
    return {
      flush: false,
      suppressed: true,
      cvToPersist: null,
      reason: 'stale_generation',
    };
  }

  if (authoritative && liveHash === authoritative && options.scheduledSummaryHash !== authoritative) {
    // React state lagged; persist authoritative cvRef instead of stale scheduled snapshot.
    options.ownership.pendingAutosaveSourceHash = null;
    return {
      flush: true,
      suppressed: true,
      cvToPersist: options.liveCvRef,
      reason: 'react_lag_flush_authoritative',
    };
  }

  if (authoritative && liveHash !== authoritative) {
    options.ownership.lastStaleAutosaveSuppressedHash = options.scheduledSummaryHash;
    return {
      flush: false,
      suppressed: true,
      cvToPersist: null,
      reason: 'live_diverged_from_authoritative',
    };
  }

  options.ownership.pendingAutosaveSourceHash = null;
  return {
    flush: true,
    suppressed: false,
    cvToPersist: options.liveCvRef,
    reason: null,
  };
}

export function classifySummaryVisibleApplyFailure(options: {
  lifecycle: SummaryApplyLifecycleDiagnostics;
  visibleHash: string | null;
  selectedFinalHash: string | null;
}): {
  actualRaceDetected: boolean;
  actualRaceReason: string | null;
  raceGuardResult: 'ok' | 'fail' | 'skipped';
  finalTypedFailureReason: string | null;
  visibleApplyFailureStage: string | null;
  toastFailureClass:
    | 'candidate_validation'
    | 'style_noop'
    | 'source_race'
    | 'state_write_failure'
    | 'visible_persisted_hash_mismatch';
} {
  if (options.lifecycle.actualRaceDetected) {
    return {
      actualRaceDetected: true,
      actualRaceReason: options.lifecycle.actualRaceReason,
      raceGuardResult: 'fail',
      finalTypedFailureReason: 'stale_summary_edited_in_flight',
      visibleApplyFailureStage: options.lifecycle.visibleApplyFailureStage
        || 'compare_and_swap_source',
      toastFailureClass: 'source_race',
    };
  }

  const hashMismatch = Boolean(
    options.visibleHash
    && options.selectedFinalHash
    && options.visibleHash !== options.selectedFinalHash,
  );

  if (hashMismatch || options.lifecycle.visibleApplyFailureStage) {
    return {
      actualRaceDetected: false,
      actualRaceReason: null,
      // Not a source race — candidate was valid; commit/read failed.
      raceGuardResult: 'ok',
      finalTypedFailureReason: 'summary_state_write_failed',
      visibleApplyFailureStage:
        options.lifecycle.visibleApplyFailureStage
        || 'post_write_visible_hash_mismatch',
      toastFailureClass: hashMismatch
        ? 'visible_persisted_hash_mismatch'
        : 'state_write_failure',
    };
  }

  return {
    actualRaceDetected: false,
    actualRaceReason: null,
    raceGuardResult: 'ok',
    finalTypedFailureReason: null,
    visibleApplyFailureStage: null,
    toastFailureClass: 'candidate_validation',
  };
}
