export const AI_CORE_V3_OPERATION_KINDS = [
  'experience_generate',
  'experience_enhance',
  'summary_generate',
  'summary_stronger',
  'summary_professional',
  'summary_shorter',
] as const;

export type AiCoreV3OperationKind = (typeof AI_CORE_V3_OPERATION_KINDS)[number];
export type ExperienceOperationKind = Extract<
  AiCoreV3OperationKind,
  'experience_generate' | 'experience_enhance'
>;
export type SummaryOperationKind = Exclude<AiCoreV3OperationKind, ExperienceOperationKind>;

export type ExperienceManifestMode = 'generate' | 'enhance';
export type EmploymentState = 'present' | 'completed';
export type SourceOrigin =
  | 'user_input'
  | 'persisted_user_source'
  | 'structured_cv_state'
  | 'explicit_caller_input';

export interface StructuredDate {
  readonly year: number;
  readonly month?: number;
  readonly day?: number;
}

export interface StructuredEmploymentDates {
  readonly start: StructuredDate;
  readonly end: StructuredDate | null;
}

export interface SourceProvenance {
  readonly origin: SourceOrigin;
  readonly detail?: string;
}

export interface SourceAuthoritySnapshot {
  readonly operationId: string;
  readonly operationKind: AiCoreV3OperationKind;
  readonly documentId?: string;
  readonly targetEntryId?: string;
  readonly sourceText: string;
  readonly sourceLocale: string;
  readonly targetLocale: string;
  readonly provenance: SourceProvenance;
  readonly sourceHash: string;
  readonly snapshotHash: string;
  readonly employmentState?: EmploymentState;
  readonly dates?: StructuredEmploymentDates;
  readonly captureToken: string;
}

export interface ExperienceFact {
  readonly factId: string;
  readonly text: string;
  readonly sourceHash: string;
  readonly required: boolean;
}

export interface ExperienceFactManifest {
  readonly operationId: string;
  readonly operationKind: ExperienceOperationKind;
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
  readonly sourceLocale?: string;
  readonly targetLocale?: string;
  readonly contextHash?: string;
}

export interface SummaryEntryFactManifest {
  readonly entryId: string;
  readonly roleTitle: string;
  readonly employer: string;
  readonly employmentState: EmploymentState;
  readonly dates: StructuredEmploymentDates;
  readonly facts: readonly ExperienceFact[];
}

export interface SummaryFactManifest {
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

export interface CandidateUnit {
  readonly unitId: string;
  readonly text: string;
  readonly entryId?: string;
  readonly factIds?: readonly string[];
}

export type ProviderMetadataValue = string | number | boolean | null;

export interface AiCoreV3CandidateEnvelope {
  readonly operationId: string;
  readonly candidateId: string;
  readonly operationKind: AiCoreV3OperationKind;
  readonly targetLocale: string;
  readonly sourceSnapshotHash: string;
  readonly text: string;
  readonly units?: readonly CandidateUnit[];
  readonly providerMetadata?: Readonly<Record<string, ProviderMetadataValue>>;
}

export type AiCoreV3Manifest = ExperienceFactManifest | SummaryFactManifest;

export function isExperienceOperationKind(
  value: AiCoreV3OperationKind,
): value is ExperienceOperationKind {
  return value === 'experience_generate' || value === 'experience_enhance';
}

export function isSummaryOperationKind(
  value: AiCoreV3OperationKind,
): value is SummaryOperationKind {
  return !isExperienceOperationKind(value);
}
