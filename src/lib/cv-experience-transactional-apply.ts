/**
 * Transaction ownership for Experience AI visible writes.
 *
 * The operation-owned CV snapshot is synchronously installed in cvRef before
 * React is scheduled. Post-write validation consumes that exact written
 * snapshot, so deferred rendering cannot manufacture a false rollback.
 */
import type { Locale } from './i18n/translations';
import type { CVData } from './types';
import type { ExperienceJobContext } from './cv-experience-job-context';
import {
  applyFinalizedBulletsToCv,
  type FinalizeCvAiFieldResult,
} from './cv-ai-finalize-apply';
import { fingerprintText } from './cv-export-diagnostics';

export const EXPERIENCE_TRANSACTION_OWNERSHIP_414_REVISION =
  'experience-transaction-ownership-414-v1' as const;

export function hashExperienceTextForApply(text: string | null | undefined): string {
  return fingerprintText(String(text || '').replace(/\s+/g, ' ').trim());
}

type EntryOwnership = {
  generation: number;
  authoritativeDescriptionHash: string;
  operationSourceHash: string;
  operationIdHash: string;
};

export type ExperienceApplyOwnershipState = {
  generation: number;
  entries: Record<string, EntryOwnership>;
};

export function createExperienceApplyOwnershipState(): ExperienceApplyOwnershipState {
  return { generation: 0, entries: {} };
}

export type ExperienceApplyLifecycleDiagnostics = {
  operationSourceHash: string;
  selectedFinalHash: string;
  cvRefHashBeforeWrite: string | null;
  formHashBeforeWrite: string;
  transactionWrittenHash: string | null;
  cvRefHashImmediatelyAfterWrite: string | null;
  transactionEntryIdHash: string;
  operationIdHash: string;
  applyOwnershipPassed: boolean;
  actualRaceDetected: boolean;
  actualRaceReason: 'source_hash_changed_before_write' | null;
  postWriteReadSource:
    | 'operation_owned_written_experience'
    | 'rejected_before_write'
    | 'write_did_not_materialize'
    | null;
  failureKind:
    | 'none'
    | 'source_changed_before_write'
    | 'entry_missing'
    | 'finalized_not_applicable'
    | 'write_did_not_materialize_selected_hash';
};

export type CommitExperienceApplyResult = {
  ok: boolean;
  writtenCv: CVData | null;
  writtenDescription: string;
  previousCv: CVData;
  lifecycle: ExperienceApplyLifecycleDiagnostics;
};

function entryDescription(cv: CVData, experienceId: string): string | null {
  const entry = (cv.experience || []).find((item) => item.id === experienceId);
  return entry ? String(entry.description || '') : null;
}

function reconcileTargetDescription(
  cv: CVData,
  experienceId: string,
  visibleText: string,
): CVData {
  const stored = entryDescription(cv, experienceId);
  if (stored == null || hashExperienceTextForApply(stored) === hashExperienceTextForApply(visibleText)) {
    return cv;
  }
  return {
    ...cv,
    experience: (cv.experience || []).map((entry) => (
      entry.id === experienceId ? { ...entry, description: visibleText } : entry
    )),
  };
}

/**
 * Synchronously CAS-apply a finalized Experience candidate for one stable ID.
 * The live textarea value is compared with the request-time source before any
 * write so a newer user edit can never be overwritten.
 */
export function commitExperienceApplyTransactionally(options: {
  cvRef: { current: CVData };
  ownership: ExperienceApplyOwnershipState;
  locale: Locale;
  experienceId: string;
  finalized: FinalizeCvAiFieldResult;
  operationSourceText: string;
  currentVisibleText: string;
  operationId: string;
  jobContext?: ExperienceJobContext;
  scheduleReactCv: (next: CVData) => void;
  applyToCv?: typeof applyFinalizedBulletsToCv;
}): CommitExperienceApplyResult {
  void EXPERIENCE_TRANSACTION_OWNERSHIP_414_REVISION;
  const previousCv = options.cvRef.current;
  const operationSourceHash = hashExperienceTextForApply(options.operationSourceText);
  const formHashBeforeWrite = hashExperienceTextForApply(options.currentVisibleText);
  const selectedFinalHash = hashExperienceTextForApply(options.finalized.text);
  const transactionEntryIdHash = fingerprintText(options.experienceId || 'missing_entry');
  const operationIdHash = fingerprintText(options.operationId || 'missing_operation');
  const storedBefore = entryDescription(previousCv, options.experienceId);
  const lifecycle: ExperienceApplyLifecycleDiagnostics = {
    operationSourceHash,
    selectedFinalHash,
    cvRefHashBeforeWrite: storedBefore == null
      ? null
      : hashExperienceTextForApply(storedBefore),
    formHashBeforeWrite,
    transactionWrittenHash: null,
    cvRefHashImmediatelyAfterWrite: null,
    transactionEntryIdHash,
    operationIdHash,
    applyOwnershipPassed: false,
    actualRaceDetected: false,
    actualRaceReason: null,
    postWriteReadSource: null,
    failureKind: 'none',
  };

  if (storedBefore == null) {
    lifecycle.failureKind = 'entry_missing';
    lifecycle.postWriteReadSource = 'rejected_before_write';
    return { ok: false, writtenCv: null, writtenDescription: '', previousCv, lifecycle };
  }

  if (formHashBeforeWrite !== operationSourceHash) {
    lifecycle.actualRaceDetected = true;
    lifecycle.actualRaceReason = 'source_hash_changed_before_write';
    lifecycle.failureKind = 'source_changed_before_write';
    lifecycle.postWriteReadSource = 'rejected_before_write';
    return { ok: false, writtenCv: null, writtenDescription: '', previousCv, lifecycle };
  }

  if (options.finalized.blocked || !options.finalized.countedAsSuccess) {
    lifecycle.failureKind = 'finalized_not_applicable';
    lifecycle.postWriteReadSource = 'rejected_before_write';
    return { ok: false, writtenCv: null, writtenDescription: '', previousCv, lifecycle };
  }

  // The form is authoritative when React/cvRef has not yet absorbed the same
  // request-time textarea value. Reconcile only the stable target entry.
  const writeBase = reconcileTargetDescription(
    previousCv,
    options.experienceId,
    options.currentVisibleText,
  );
  const applyToCv = options.applyToCv || applyFinalizedBulletsToCv;
  let next: CVData;
  try {
    next = applyToCv(
      writeBase,
      options.locale,
      options.experienceId,
      options.finalized,
      options.jobContext,
    );
  } catch {
    lifecycle.failureKind = 'write_did_not_materialize_selected_hash';
    lifecycle.postWriteReadSource = 'write_did_not_materialize';
    return { ok: false, writtenCv: null, writtenDescription: '', previousCv, lifecycle };
  }

  const writtenDescription = entryDescription(next, options.experienceId);
  const writtenHash = writtenDescription == null
    ? null
    : hashExperienceTextForApply(writtenDescription);
  lifecycle.transactionWrittenHash = writtenHash;

  if (writtenDescription == null || writtenHash !== selectedFinalHash) {
    lifecycle.failureKind = 'write_did_not_materialize_selected_hash';
    lifecycle.postWriteReadSource = 'write_did_not_materialize';
    return { ok: false, writtenCv: null, writtenDescription: '', previousCv, lifecycle };
  }

  // Establish the single authoritative written snapshot synchronously.
  options.cvRef.current = next;
  lifecycle.cvRefHashImmediatelyAfterWrite = hashExperienceTextForApply(
    entryDescription(options.cvRef.current, options.experienceId),
  );
  lifecycle.applyOwnershipPassed =
    lifecycle.cvRefHashImmediatelyAfterWrite === selectedFinalHash;

  if (!lifecycle.applyOwnershipPassed) {
    options.cvRef.current = previousCv;
    lifecycle.failureKind = 'write_did_not_materialize_selected_hash';
    lifecycle.postWriteReadSource = 'write_did_not_materialize';
    return { ok: false, writtenCv: null, writtenDescription: '', previousCv, lifecycle };
  }

  options.ownership.generation += 1;
  options.ownership.entries[options.experienceId] = {
    generation: options.ownership.generation,
    authoritativeDescriptionHash: selectedFinalHash,
    operationSourceHash,
    operationIdHash,
  };
  lifecycle.postWriteReadSource = 'operation_owned_written_experience';
  options.scheduleReactCv(next);

  return { ok: true, writtenCv: next, writtenDescription, previousCv, lifecycle };
}

export function rollbackExperienceApplyTransactionally(options: {
  cvRef: { current: CVData };
  ownership: ExperienceApplyOwnershipState;
  experienceId: string;
  previousCv: CVData;
  scheduleReactCv: (next: CVData) => void;
}): boolean {
  options.cvRef.current = options.previousCv;
  delete options.ownership.entries[options.experienceId];
  options.ownership.generation += 1;
  options.scheduleReactCv(options.previousCv);
  return entryDescription(options.cvRef.current, options.experienceId)
    === entryDescription(options.previousCv, options.experienceId);
}

/** A material/manual edit supersedes an earlier AI transaction. */
export function releaseExperienceApplyOwnership(
  ownership: ExperienceApplyOwnershipState,
  experienceId: string,
): void {
  if (!(experienceId in ownership.entries)) return;
  delete ownership.entries[experienceId];
  ownership.generation += 1;
}

/** Prevent stale React/context snapshots from replacing an owned entry. */
export function shouldAcceptIncomingExperienceCv(options: {
  ownership: ExperienceApplyOwnershipState;
  incomingCv: CVData;
  localCvRef: CVData;
}): boolean {
  for (const [experienceId, owned] of Object.entries(options.ownership.entries)) {
    const local = entryDescription(options.localCvRef, experienceId);
    const incoming = entryDescription(options.incomingCv, experienceId);
    if (
      local != null
      && hashExperienceTextForApply(local) === owned.authoritativeDescriptionHash
      && (incoming == null
        || hashExperienceTextForApply(incoming) !== owned.authoritativeDescriptionHash)
    ) {
      return false;
    }
  }
  return true;
}
