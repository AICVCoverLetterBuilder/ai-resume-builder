import {
  isSummaryOperationKind,
  type ExperienceFact,
  type SummaryEntryFactManifest,
  type SummaryFactManifest,
  type SummaryOperationKind,
} from './contracts';
import { immutableCopy } from './immutability';
import { assertEmploymentStateAndDates, assertFacts, requireNonBlank } from './invariants';

export interface SummaryFactManifestInput {
  readonly operationId: string;
  readonly operationKind: SummaryOperationKind;
  readonly targetLocale: string;
  readonly currentRoleEntryId: string | null;
  readonly selectedEntries: readonly SummaryEntryFactManifest[];
  readonly structuredTotalDurationMonths: number;
  readonly skills: readonly string[];
  readonly education: readonly string[];
  readonly languages: readonly string[];
  readonly sourceSnapshotHash: string;
}

function validateExactStrings(values: readonly string[], field: string): void {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string')) {
    throw new TypeError(`${field} must contain only strings`);
  }
}

export function createSummaryFactManifest(input: SummaryFactManifestInput): SummaryFactManifest {
  requireNonBlank(input.operationId, 'operationId');
  if (!isSummaryOperationKind(input.operationKind)) {
    throw new TypeError('operationKind must be a Summary operation');
  }
  requireNonBlank(input.targetLocale, 'targetLocale');
  requireNonBlank(input.sourceSnapshotHash, 'sourceSnapshotHash');
  if (!Number.isFinite(input.structuredTotalDurationMonths)
    || !Number.isInteger(input.structuredTotalDurationMonths)
    || input.structuredTotalDurationMonths < 0) {
    throw new TypeError('structuredTotalDurationMonths must be a finite non-negative integer');
  }
  if (!Array.isArray(input.selectedEntries)) {
    throw new TypeError('selectedEntries must be an array');
  }

  const entryIds = new Set<string>();
  const factIds = new Set<string>();
  for (const entry of input.selectedEntries) {
    requireNonBlank(entry.entryId, 'entryId');
    if (entryIds.has(entry.entryId)) {
      throw new TypeError(`duplicate entryId: ${entry.entryId}`);
    }
    entryIds.add(entry.entryId);
    assertEmploymentStateAndDates(entry.employmentState, entry.dates, `dates for ${entry.entryId}`);
    assertFacts(entry.facts as readonly ExperienceFact[], factIds);
  }
  if (input.currentRoleEntryId !== null && !entryIds.has(input.currentRoleEntryId)) {
    throw new TypeError('currentRoleEntryId must reference a selected entry');
  }
  validateExactStrings(input.skills, 'skills');
  validateExactStrings(input.education, 'education');
  validateExactStrings(input.languages, 'languages');

  return immutableCopy({
    operationId: input.operationId,
    operationKind: input.operationKind,
    targetLocale: input.targetLocale,
    currentRoleEntryId: input.currentRoleEntryId,
    selectedEntries: input.selectedEntries,
    structuredTotalDurationMonths: input.structuredTotalDurationMonths,
    skills: input.skills,
    education: input.education,
    languages: input.languages,
    sourceSnapshotHash: input.sourceSnapshotHash,
  }) as SummaryFactManifest;
}
