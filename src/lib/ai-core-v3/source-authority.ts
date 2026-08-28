import {
  AI_CORE_V3_OPERATION_KINDS,
  isExperienceOperationKind,
  type SourceAuthoritySnapshot,
} from './contracts';
import { immutableCopy } from './immutability';
import { assertEmploymentStateAndDates, requireNonBlank } from './invariants';

export type SourceAuthoritySnapshotInput = SourceAuthoritySnapshot;

export function createSourceAuthoritySnapshot(
  input: SourceAuthoritySnapshotInput,
): SourceAuthoritySnapshot {
  requireNonBlank(input.operationId, 'operationId');
  if (!AI_CORE_V3_OPERATION_KINDS.includes(input.operationKind)) {
    throw new TypeError('operationKind is invalid');
  }
  if (isExperienceOperationKind(input.operationKind)) {
    requireNonBlank(input.targetEntryId ?? '', 'targetEntryId');
  }
  if (typeof input.sourceText !== 'string') {
    throw new TypeError('sourceText must be a string');
  }
  requireNonBlank(input.sourceLocale, 'sourceLocale');
  requireNonBlank(input.targetLocale, 'targetLocale');
  requireNonBlank(input.provenance?.origin ?? '', 'provenance.origin');
  requireNonBlank(input.sourceHash, 'sourceHash');
  requireNonBlank(input.snapshotHash, 'snapshotHash');
  requireNonBlank(input.captureToken, 'captureToken');

  if ((input.employmentState === undefined) !== (input.dates === undefined)) {
    throw new TypeError('employmentState and dates must be supplied together');
  }
  if (input.employmentState && input.dates) {
    assertEmploymentStateAndDates(input.employmentState, input.dates);
  }

  return immutableCopy({
    operationId: input.operationId,
    operationKind: input.operationKind,
    ...(input.documentId !== undefined ? { documentId: input.documentId } : {}),
    ...(input.targetEntryId !== undefined ? { targetEntryId: input.targetEntryId } : {}),
    sourceText: input.sourceText,
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    provenance: input.provenance,
    sourceHash: input.sourceHash,
    snapshotHash: input.snapshotHash,
    ...(input.employmentState !== undefined ? { employmentState: input.employmentState } : {}),
    ...(input.dates !== undefined ? { dates: input.dates } : {}),
    captureToken: input.captureToken,
  }) as SourceAuthoritySnapshot;
}
