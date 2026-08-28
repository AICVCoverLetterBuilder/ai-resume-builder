import type {
  ExperienceFact,
  ExperienceFactManifest,
  ExperienceManifestMode,
  EmploymentState,
  StructuredEmploymentDates,
} from './contracts';
import { immutableCopy } from './immutability';
import { assertEmploymentStateAndDates, assertFacts, requireNonBlank } from './invariants';

export interface ExperienceFactManifestInput {
  readonly operationId: string;
  readonly mode: ExperienceManifestMode;
  readonly entryId: string;
  readonly locale: string;
  readonly roleTitle: string;
  readonly company: string;
  readonly employmentState: EmploymentState;
  readonly dates: StructuredEmploymentDates;
  readonly industry?: string;
  readonly level?: string;
  readonly exactSourceText: string;
  readonly facts: readonly ExperienceFact[];
  readonly snapshotHash: string;
}

export function createExperienceFactManifest(
  input: ExperienceFactManifestInput,
): ExperienceFactManifest {
  requireNonBlank(input.operationId, 'operationId');
  requireNonBlank(input.entryId, 'entryId');
  requireNonBlank(input.locale, 'locale');
  requireNonBlank(input.snapshotHash, 'snapshotHash');
  if (input.mode !== 'generate' && input.mode !== 'enhance') {
    throw new TypeError('mode must be generate or enhance');
  }
  if (typeof input.exactSourceText !== 'string') {
    throw new TypeError('exactSourceText must be a string');
  }
  if (input.mode === 'enhance' && input.exactSourceText.trim().length === 0) {
    throw new TypeError('enhance requires a non-empty authoritative source');
  }
  assertEmploymentStateAndDates(input.employmentState, input.dates);
  assertFacts(input.facts);

  return immutableCopy({
    operationId: input.operationId,
    operationKind: input.mode === 'generate' ? 'experience_generate' : 'experience_enhance',
    mode: input.mode,
    entryId: input.entryId,
    locale: input.locale,
    roleTitle: input.roleTitle,
    company: input.company,
    employmentState: input.employmentState,
    dates: input.dates,
    ...(input.industry !== undefined ? { industry: input.industry } : {}),
    ...(input.level !== undefined ? { level: input.level } : {}),
    exactSourceText: input.exactSourceText,
    facts: input.facts,
    snapshotHash: input.snapshotHash,
  }) as ExperienceFactManifest;
}
