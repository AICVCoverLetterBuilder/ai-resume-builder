import { buildExperienceDurationSnapshot } from '../cv-experience-duration';
import { resolveSummaryCurrentRole } from '../cv-summary-current-role';
import type { CVData, WorkExperience } from '../types';
import { createCandidateEnvelope } from './candidate-envelope';
import type {
  AiCoreV3CandidateEnvelope,
  ExperienceFact,
  StructuredDate,
  StructuredEmploymentDates,
  SummaryEntryFactManifest,
  SummaryFactManifest,
} from './contracts';
import { immutableCopy } from './immutability';
import { createSummaryFactManifest } from './summary-manifest';
import { INTERNAL_AI_RESET_ENABLED } from '../build-channel';
import type { AggregateValidationResult, AiCoreV3Violation } from './validators';

export const SUMMARY_V3_GENERATE_ACTION = 'summary_v3_generate' as const;

export type SummaryV3GenerateRoutingResult =
  | { readonly kind: 'not_applicable' }
  | { readonly kind: 'handled_success' }
  | { readonly kind: 'handled_failure'; readonly typedReason: string };

export type SummaryV3ExperienceSourceKind = 'mounted_textarea' | 'committed_cv_ref';

export interface SummaryV3AuthorityRecord {
  readonly id: string;
  readonly text: string;
  readonly hash: string;
}

export interface SummaryV3SelectedEntry extends SummaryEntryFactManifest {
  readonly exactSourceDescription: string;
  readonly sourceKind: SummaryV3ExperienceSourceKind;
  readonly sourceHash: string;
  readonly sourceUnits: readonly string[];
  readonly sourceFactSetHash: string;
  readonly rawStartDate: string;
  readonly rawEndDate: string;
  readonly indexDiagnostic: number;
}

export interface SummaryV3Manifest extends SummaryFactManifest {
  readonly requestedLocale: string;
  readonly sourceLocale: string;
  readonly jobContextHash: string;
  readonly manifestHash: string;
  readonly gender: string;
  readonly selectedEntries: readonly SummaryV3SelectedEntry[];
  readonly skillAuthorities: readonly SummaryV3AuthorityRecord[];
  readonly educationAuthorities: readonly SummaryV3AuthorityRecord[];
  readonly languageAuthorities: readonly SummaryV3AuthorityRecord[];
}

export interface SummaryV3WriterUnit {
  readonly slot: 'duration' | 'experience';
  readonly entryId: string | null;
  readonly factIds: readonly string[];
  readonly text: string;
}

export interface SummaryV3WriterOutput {
  readonly operationId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly units: readonly SummaryV3WriterUnit[];
}

export interface SummaryV3GenerateSuccessResponse {
  readonly ok: true;
  readonly action: typeof SUMMARY_V3_GENERATE_ACTION;
  readonly providerOutput: SummaryV3WriterOutput;
  readonly candidate: AiCoreV3CandidateEnvelope;
  readonly validation: AggregateValidationResult;
  readonly repairAttempted: boolean;
  readonly transportEvidence?: SummaryV3TransportEvidence;
}

export interface SummaryV3GenerateFailureResponse {
  readonly ok: false;
  readonly action: typeof SUMMARY_V3_GENERATE_ACTION;
  readonly typedReason: string;
  readonly validation?: AggregateValidationResult;
  readonly repairAttempted?: boolean;
  /** Transient internal rejection evidence; never persisted by the client. */
  readonly rejectedCandidate?: AiCoreV3CandidateEnvelope;
  readonly transportEvidence?: SummaryV3TransportEvidence;
}

export type SummaryV3GenerateResponse =
  | SummaryV3GenerateSuccessResponse
  | SummaryV3GenerateFailureResponse;

export interface SummaryV3GenerateOperationSnapshot {
  readonly operationId: string;
  readonly requestId: string;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleSummary: string;
  readonly rawSummarySourceHash: string;
  readonly normalizedSummarySourceHash: string;
  readonly cvSnapshotHash: string;
  readonly cvRefSnapshotHash: string;
  readonly formSnapshotHash: string;
  readonly usageCountBefore: number;
  readonly selectedEntryIds: readonly string[];
  readonly currentRoleEntryId: string;
  readonly currentRoleResolutionEvidence: readonly string[];
  readonly structuredTotalDurationMonths: number;
  readonly referenceDateIso: string;
  readonly jobContextHash: string;
  readonly manifestHash: string;
  readonly manifest: SummaryV3Manifest;
}

export interface SummaryV3GenerateAdapterInput {
  readonly enabled: boolean;
  readonly operationKind: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly cv: CVData;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleSummary: string;
  readonly visibleExperienceSources?: Readonly<Record<string, string>>;
  readonly referenceDateIso: string;
  readonly jobContextHash: string;
  readonly usageCountBefore: number;
}

export interface SummaryV3GenerateLiveState {
  readonly cv: CVData;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleSummary: string;
  readonly visibleExperienceSources?: Readonly<Record<string, string>>;
  readonly referenceDateIso: string;
  readonly jobContextHash: string;
}

export interface SummaryV3GenerateAdapterDependencies {
  readonly request: (request: {
    readonly action: typeof SUMMARY_V3_GENERATE_ACTION;
    readonly manifest: SummaryV3Manifest;
  }) => Promise<unknown>;
  readonly getLiveState: () => SummaryV3GenerateLiveState;
  readonly getActiveOperationId: () => string;
  readonly writeCv: (next: CVData) => void;
  readonly projectPreviewSummary: (next: CVData) => string;
  readonly persistCv: (next: CVData) => boolean;
  readonly incrementUsage: () => void;
  /** Optional terminal seam. It is observational and cannot affect routing/apply. */
  readonly onTerminal?: (event: SummaryV3GenerateTerminalEvent) => void;
  readonly getUsageCount?: () => number;
  readonly getRouteHttpStatus?: () => number | null;
}

export type SummaryV3DiagnosticPhaseStatus = 'passed' | 'failed' | 'not_evaluated';

export type SummaryV3DiagnosticAttempt = {
  readonly attempted: boolean | null;
  readonly result: 'succeeded' | 'failed' | 'malformed' | 'not_attempted' | 'unknown';
  readonly stopReason: string | null;
  readonly contentBlockCount: number | null;
  readonly textBlockCount: number | null;
  readonly toolBlockCount: number | null;
  readonly expectedToolCount: number | null;
  readonly toolNameMatched: boolean | null;
  readonly toolInputObject: boolean | null;
  readonly toolInputSchemaPassed: boolean | null;
  readonly identityPassed: boolean | null;
};

/** Safe transport metadata projected from a forced-tool provider response. */
export type SummaryV3TransportEvidence = Readonly<{
  readonly writer: SummaryV3DiagnosticAttempt;
  readonly evaluator: SummaryV3DiagnosticAttempt;
}>;

export type SummaryV3TerminalEvidence = {
  readonly candidatePresent: boolean;
  readonly candidateHash: string | null;
  readonly candidateLength: number | null;
  readonly candidateUnitCount: number | null;
  readonly candidateUnitHashes: readonly string[];
  readonly candidateUnitLengths: readonly number[];
  readonly writer: SummaryV3DiagnosticAttempt;
  readonly evaluator: SummaryV3DiagnosticAttempt;
  readonly phases: Readonly<Record<'structural' | 'semantic' | 'language_quality', SummaryV3DiagnosticPhaseStatus>>;
  readonly semanticViolationCount: number | null;
  readonly semanticViolationCodes: readonly string[];
  readonly languageQualityViolationCount: number | null;
  readonly languageQualityViolationCodes: readonly string[];
  readonly violationFactIdHashesByCode: Readonly<Record<string, readonly string[]>>;
  readonly violationEntryIdHashesByCode: Readonly<Record<string, readonly string[]>>;
  readonly primaryValidationRejectionCode: string | null;
  readonly repairAttempted: boolean;
  readonly providerResponseKind: 'provider' | 'repair' | 'none' | 'unknown';
};

/** Exact candidate text is transient internal evidence only. */
export interface SummaryV3InternalRejectionAudit {
  readonly operationId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly candidate: Readonly<{
    readonly candidateId: string;
    readonly text: string;
    readonly units: readonly Readonly<{ readonly unitId: string; readonly text: string }>[];
  }>;
  readonly phases: Readonly<Record<'structural' | 'semantic' | 'language_quality', SummaryV3DiagnosticPhaseStatus>>;
  readonly evaluator: Readonly<{
    readonly semanticViolations: readonly AiCoreV3Violation[];
    readonly languageQualityViolations: readonly AiCoreV3Violation[];
  }>;
  readonly transport: Readonly<{
    readonly writer: SummaryV3DiagnosticAttempt;
    readonly evaluator: SummaryV3DiagnosticAttempt;
  }>;
}

export interface SummaryV3GenerateTerminalEvent {
  readonly input: SummaryV3GenerateAdapterInput;
  readonly snapshot: SummaryV3GenerateOperationSnapshot | null;
  readonly kind: 'handled_success' | 'handled_failure';
  readonly typedReason: string | null;
  readonly evidence: SummaryV3TerminalEvidence;
  readonly internalRejectionAudit?: SummaryV3InternalRejectionAudit;
  readonly applyCommitted: boolean;
  readonly usageAfter: number;
  readonly routeHttpStatus: number | null;
}

function normalizeLocale(value: string): string {
  return String(value || '').trim().replace(/_/g, '-').toLowerCase();
}

export function normalizeSummaryV3Source(value: string): string {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function hashSummaryV3Value(value: unknown): string {
  const input = typeof value === 'string' ? value : stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v3s-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function parseStructuredDate(value: string): StructuredDate | null {
  const match = String(value || '').trim().match(/^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?$/u);
  if (!match) return null;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : undefined;
  const day = match[3] ? Number(match[3]) : undefined;
  if (year < 1900 || year > 2200 || (month !== undefined && (month < 1 || month > 12))
    || (day !== undefined && (day < 1 || day > 31))) return null;
  return { year, ...(month !== undefined ? { month } : {}), ...(day !== undefined ? { day } : {}) };
}

export function extractSummaryV3SourceUnits(source: string): readonly string[] {
  return Object.freeze(String(source ?? '').split(/\r?\n/u).map((unit) => unit.trim()).filter(Boolean));
}

function explicitAuthorities(prefix: string, values: readonly string[]): readonly SummaryV3AuthorityRecord[] {
  return values.map((text, index) => ({
    id: `${prefix}:${index + 1}:${hashSummaryV3Value(text)}`,
    text,
    hash: hashSummaryV3Value(text),
  }));
}

function educationText(cv: CVData): readonly string[] {
  return cv.education.map((item) => [item.degree, item.school].filter(Boolean).join(' — ')).filter(Boolean);
}

function languageText(cv: CVData): readonly string[] {
  return cv.languages.map((item) => [item.name, item.level].filter(Boolean).join(' — ')).filter(Boolean);
}

function sourceForEntry(
  entry: WorkExperience,
  visible: Readonly<Record<string, string>> | undefined,
): { text: string; kind: SummaryV3ExperienceSourceKind } {
  if (visible && Object.prototype.hasOwnProperty.call(visible, entry.id)) {
    return { text: String(visible[entry.id] ?? ''), kind: 'mounted_textarea' };
  }
  return { text: String(entry.description ?? ''), kind: 'committed_cv_ref' };
}

function resolveM4CurrentRole(entries: readonly WorkExperience[]): WorkExperience | null {
  const present = entries.filter((entry) => entry.isPresent);
  if (present.length === 0) return null;
  const resolved = resolveSummaryCurrentRole(present);
  if (!resolved) return null;
  if (present.length > 1) {
    const resolvedStart = parseStructuredDate(resolved.startDate);
    if (!resolvedStart) return null;
    const resolvedMonth = resolvedStart.year * 12 + (resolvedStart.month ?? 1);
    const tied = present.filter((entry) => {
      const start = parseStructuredDate(entry.startDate);
      return start && start.year * 12 + (start.month ?? 1) === resolvedMonth;
    });
    if (tied.length !== 1) return null;
  }
  return resolved;
}

function canCapture(input: Pick<SummaryV3GenerateAdapterInput,
  'cv' | 'exactVisibleSummary' | 'visibleExperienceSources' | 'referenceDateIso' | 'jobContextHash'>): boolean {
  if (normalizeSummaryV3Source(input.exactVisibleSummary) !== '' || !String(input.jobContextHash || '').trim()) return false;
  const current = resolveM4CurrentRole(input.cv.experience);
  if (!current) return false;
  const selected = input.cv.experience.filter((entry) => normalizeSummaryV3Source(
    sourceForEntry(entry, input.visibleExperienceSources).text,
  ));
  if (selected.length === 0 || !selected.some((entry) => entry.id === current.id)) return false;
  return selected.every((entry) => {
    if (!String(entry.id || '').trim() || !String(entry.position || '').trim()) return false;
    const start = parseStructuredDate(entry.startDate);
    const end = entry.isPresent ? null : parseStructuredDate(entry.endDate);
    return Boolean(start && (entry.isPresent || end));
  }) && /^\d{4}-\d{2}-\d{2}$/u.test(input.referenceDateIso);
}

export function classifySummaryV3GenerateRouting(
  input: Pick<SummaryV3GenerateAdapterInput,
    'enabled' | 'operationKind' | 'cv' | 'requestedLocale' | 'uiLocale' | 'storedContentLocale'
    | 'exactVisibleSummary' | 'visibleExperienceSources' | 'referenceDateIso' | 'jobContextHash'>,
): 'not_applicable' | 'owned' {
  if (!input.enabled || input.operationKind !== 'summary_generate') return 'not_applicable';
  if (normalizeSummaryV3Source(input.exactVisibleSummary) !== '') return 'not_applicable';
  const requested = normalizeLocale(input.requestedLocale);
  if (!requested || requested !== normalizeLocale(input.uiLocale)
    || requested !== normalizeLocale(input.storedContentLocale)) return 'not_applicable';
  return canCapture(input) ? 'owned' : 'not_applicable';
}

function effectiveCv(input: SummaryV3GenerateAdapterInput): CVData {
  return {
    ...input.cv,
    summary: input.exactVisibleSummary,
    experience: input.cv.experience.map((entry) => ({
      ...entry,
      description: sourceForEntry(entry, input.visibleExperienceSources).text,
    })).sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function captureSummaryV3GenerateOperationSnapshot(
  input: SummaryV3GenerateAdapterInput,
): SummaryV3GenerateOperationSnapshot {
  if (!canCapture(input)) throw new TypeError('summary_manifest_incomplete');
  const selected = input.cv.experience
    .map((entry, index) => ({ entry, index, source: sourceForEntry(entry, input.visibleExperienceSources) }))
    .filter(({ source }) => normalizeSummaryV3Source(source.text))
    .sort((left, right) => left.entry.id.localeCompare(right.entry.id));
  const current = resolveM4CurrentRole(input.cv.experience);
  if (!current) throw new TypeError(input.cv.experience.some((entry) => entry.isPresent)
    ? 'current_role_ambiguous' : 'current_role_missing');
  if (!selected.some(({ entry }) => entry.id === current.id)) throw new TypeError('current_role_not_selected');

  const entries: SummaryV3SelectedEntry[] = selected.map(({ entry, index, source }) => {
    const start = parseStructuredDate(entry.startDate);
    const end = entry.isPresent ? null : parseStructuredDate(entry.endDate);
    if (!start || (!entry.isPresent && !end)) throw new TypeError('structured_dates_invalid');
    const dates: StructuredEmploymentDates = { start, end };
    const sourceUnits = extractSummaryV3SourceUnits(source.text);
    const sourceHash = hashSummaryV3Value(source.text);
    const facts: ExperienceFact[] = sourceUnits.map((unit, unitIndex) => ({
      factId: `summary:${entry.id}:${unitIndex + 1}:${hashSummaryV3Value(unit)}`,
      text: unit,
      sourceHash: hashSummaryV3Value(unit),
      required: true,
    }));
    return {
      entryId: entry.id,
      roleTitle: entry.position,
      employer: entry.company,
      employmentState: entry.isPresent ? 'present' : 'completed',
      dates,
      facts,
      exactSourceDescription: source.text,
      sourceKind: source.kind,
      sourceHash,
      sourceUnits,
      sourceFactSetHash: hashSummaryV3Value(facts.map((fact) => fact.factId)),
      rawStartDate: entry.startDate,
      rawEndDate: entry.endDate,
      indexDiagnostic: index,
    };
  });
  const duration = buildExperienceDurationSnapshot(
    selected.map(({ entry }) => entry),
    input.referenceDateIso,
  ).total;
  if (!duration.hasValidDates) throw new TypeError('structured_duration_unavailable');
  const skillAuthorities = explicitAuthorities('skill', input.cv.skills.filter(Boolean));
  const educationAuthorities = explicitAuthorities('education', educationText(input.cv));
  const languageAuthorities = explicitAuthorities('language', languageText(input.cv));
  const authorityEntries = entries.map(({ indexDiagnostic: _indexDiagnostic, ...entry }) => entry);
  const effective = effectiveCv(input);
  const rawSummarySourceHash = hashSummaryV3Value(input.exactVisibleSummary);
  const normalizedSummarySourceHash = hashSummaryV3Value(normalizeSummaryV3Source(input.exactVisibleSummary));
  const sourceSnapshotHash = hashSummaryV3Value({
    operationId: input.operationId,
    requestedLocale: input.requestedLocale,
    uiLocale: input.uiLocale,
    storedContentLocale: input.storedContentLocale,
    rawSummarySourceHash,
    entries: authorityEntries,
    structuredTotalDurationMonths: duration.totalMonths,
    skillAuthorities,
    educationAuthorities,
    languageAuthorities,
    gender: input.cv.personal.gender || '',
    jobContextHash: input.jobContextHash,
  });
  const base = createSummaryFactManifest({
    operationId: input.operationId,
    operationKind: 'summary_generate',
    targetLocale: input.requestedLocale,
    currentRoleEntryId: current.id,
    selectedEntries: entries,
    structuredTotalDurationMonths: duration.totalMonths,
    skills: skillAuthorities.map((item) => item.text),
    education: educationAuthorities.map((item) => item.text),
    languages: languageAuthorities.map((item) => item.text),
    sourceSnapshotHash,
  });
  const manifestWithoutHash = {
    ...base,
    requestedLocale: input.requestedLocale,
    sourceLocale: input.storedContentLocale,
    jobContextHash: input.jobContextHash,
    gender: input.cv.personal.gender || '',
    selectedEntries: entries,
    skillAuthorities,
    educationAuthorities,
    languageAuthorities,
  };
  const manifestHash = hashSummaryV3Value({
    ...manifestWithoutHash,
    selectedEntries: authorityEntries,
  });
  const manifest = immutableCopy({ ...manifestWithoutHash, manifestHash }) as SummaryV3Manifest;
  return immutableCopy({
    operationId: input.operationId,
    requestId: input.requestId,
    requestedLocale: input.requestedLocale,
    uiLocale: input.uiLocale,
    storedContentLocale: input.storedContentLocale,
    exactVisibleSummary: input.exactVisibleSummary,
    rawSummarySourceHash,
    normalizedSummarySourceHash,
    cvSnapshotHash: hashSummaryV3Value(effective),
    cvRefSnapshotHash: hashSummaryV3Value({
      ...input.cv,
      experience: [...input.cv.experience].sort((left, right) => left.id.localeCompare(right.id)),
    }),
    formSnapshotHash: hashSummaryV3Value({
      summary: input.exactVisibleSummary,
      entries: entries.map((entry) => ({ id: entry.entryId, source: entry.exactSourceDescription })),
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
    }),
    usageCountBefore: input.usageCountBefore,
    selectedEntryIds: entries.map((entry) => entry.entryId),
    currentRoleEntryId: current.id,
    currentRoleResolutionEvidence: [`resolver:structured_current_role`, `present:${current.id}`, `selected:${current.id}`],
    structuredTotalDurationMonths: duration.totalMonths,
    referenceDateIso: input.referenceDateIso,
    jobContextHash: input.jobContextHash,
    manifestHash,
    manifest,
  }) as SummaryV3GenerateOperationSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function explicitAccept(validation: AggregateValidationResult): boolean {
  return validation.decision === 'accept'
    && (['structural', 'semantic', 'language_quality'] as const).every(
      (phase) => validation.phases[phase]?.status === 'passed'
        && validation.phases[phase].violations.length === 0,
    );
}

export function parseSummaryV3GenerateSuccessResponse(value: unknown): SummaryV3GenerateSuccessResponse | null {
  if (!isRecord(value) || value.ok !== true || value.action !== SUMMARY_V3_GENERATE_ACTION
    || !isRecord(value.providerOutput) || !isRecord(value.candidate) || !isRecord(value.validation)
    || typeof value.repairAttempted !== 'boolean') return null;
  try {
    const response = immutableCopy({
      ok: true as const,
      action: SUMMARY_V3_GENERATE_ACTION,
      providerOutput: value.providerOutput as unknown as SummaryV3WriterOutput,
      candidate: createCandidateEnvelope(value.candidate as unknown as AiCoreV3CandidateEnvelope),
      validation: value.validation as unknown as AggregateValidationResult,
      repairAttempted: value.repairAttempted,
    }) as SummaryV3GenerateSuccessResponse;
    return explicitAccept(response.validation) ? response : null;
  } catch {
    return null;
  }
}

function unitDerivedText(output: SummaryV3WriterOutput): string {
  return output.units.map((unit) => unit.text).join(' ');
}

export function responseMatchesSummaryV3GenerateSnapshot(
  response: SummaryV3GenerateSuccessResponse,
  snapshot: SummaryV3GenerateOperationSnapshot,
): boolean {
  return response.providerOutput.operationId === snapshot.operationId
    && response.providerOutput.snapshotHash === snapshot.manifest.sourceSnapshotHash
    && normalizeLocale(response.providerOutput.locale) === normalizeLocale(snapshot.requestedLocale)
    && response.candidate.operationId === snapshot.operationId
    && response.candidate.operationKind === 'summary_generate'
    && response.candidate.sourceSnapshotHash === snapshot.manifest.sourceSnapshotHash
    && response.candidate.targetLocale === snapshot.requestedLocale
    && response.candidate.text === unitDerivedText(response.providerOutput)
    && response.candidate.units?.every((unit, index) => unit.text === response.providerOutput.units[index]?.text) === true
    && explicitAccept(response.validation);
}

function liveInput(
  snapshot: SummaryV3GenerateOperationSnapshot,
  live: SummaryV3GenerateLiveState,
): SummaryV3GenerateAdapterInput {
  return {
    enabled: true,
    operationKind: 'summary_generate',
    operationId: snapshot.operationId,
    requestId: snapshot.requestId,
    cv: live.cv,
    requestedLocale: live.requestedLocale,
    uiLocale: live.uiLocale,
    storedContentLocale: live.storedContentLocale,
    exactVisibleSummary: live.exactVisibleSummary,
    visibleExperienceSources: live.visibleExperienceSources,
    referenceDateIso: live.referenceDateIso,
    jobContextHash: live.jobContextHash,
    usageCountBefore: snapshot.usageCountBefore,
  };
}

function snapshotStillCurrent(
  snapshot: SummaryV3GenerateOperationSnapshot,
  live: SummaryV3GenerateLiveState,
): boolean {
  try {
    const recaptured = captureSummaryV3GenerateOperationSnapshot(liveInput(snapshot, live));
    return recaptured.manifestHash === snapshot.manifestHash
      && recaptured.rawSummarySourceHash === snapshot.rawSummarySourceHash
      && recaptured.normalizedSummarySourceHash === snapshot.normalizedSummarySourceHash
      && recaptured.cvSnapshotHash === snapshot.cvSnapshotHash
      && recaptured.cvRefSnapshotHash === snapshot.cvRefSnapshotHash
      && recaptured.formSnapshotHash === snapshot.formSnapshotHash
      && recaptured.currentRoleEntryId === snapshot.currentRoleEntryId
      && recaptured.structuredTotalDurationMonths === snapshot.structuredTotalDurationMonths;
  } catch {
    return false;
  }
}

function nonSummaryState(cv: CVData): unknown {
  const { summary: _summary, summaryOrigin: _origin, summaryGeneratedLocale: _locale,
    summaryGenerationContextKey: _context, ...rest } = cv;
  return rest;
}

function rollback(
  before: CVData,
  dependencies: Pick<SummaryV3GenerateAdapterDependencies, 'writeCv' | 'getLiveState' | 'persistCv'>,
): boolean {
  try {
    dependencies.writeCv(before);
    const restored = dependencies.getLiveState().cv;
    const verified = hashSummaryV3Value(restored) === hashSummaryV3Value(before);
    if (verified) dependencies.persistCv(before);
    return verified;
  } catch {
    return false;
  }
}

export function projectSummaryV3ImmediatePreviewModel(cv: CVData): CVData {
  return cv;
}

export function applySummaryV3GenerateTransaction(
  snapshot: SummaryV3GenerateOperationSnapshot,
  response: SummaryV3GenerateSuccessResponse,
  dependencies: Pick<SummaryV3GenerateAdapterDependencies,
    'getLiveState' | 'getActiveOperationId' | 'writeCv' | 'projectPreviewSummary' | 'persistCv' | 'incrementUsage'>,
): SummaryV3GenerateRoutingResult {
  if (dependencies.getActiveOperationId() !== snapshot.operationId) {
    return { kind: 'handled_failure', typedReason: 'operation_superseded' };
  }
  const live = dependencies.getLiveState();
  if (!snapshotStillCurrent(snapshot, live)) return { kind: 'handled_failure', typedReason: 'stale_snapshot' };
  if (!responseMatchesSummaryV3GenerateSnapshot(response, snapshot)) {
    return { kind: 'handled_failure', typedReason: 'candidate_or_validation_mismatch' };
  }
  const before = live.cv;
  const next: CVData = {
    ...before,
    summary: response.candidate.text,
    summaryOrigin: 'ai_generated',
    summaryGeneratedLocale: snapshot.requestedLocale,
    summaryGenerationContextKey: snapshot.jobContextHash,
  };
  try {
    dependencies.writeCv(next);
  } catch {
    rollback(before, dependencies);
    return { kind: 'handled_failure', typedReason: 'state_write_failed' };
  }
  let readback: CVData;
  try {
    readback = dependencies.getLiveState().cv;
  } catch {
    return { kind: 'handled_failure', typedReason: rollback(before, dependencies) ? 'visible_readback_failed' : 'rollback_failed' };
  }
  let previewSummary = '';
  try {
    previewSummary = dependencies.projectPreviewSummary(readback);
  } catch {
    return { kind: 'handled_failure', typedReason: rollback(before, dependencies) ? 'preview_projection_failed' : 'rollback_failed' };
  }
  const readbackPassed = readback.summary === response.candidate.text
    && hashSummaryV3Value(readback.summary) === hashSummaryV3Value(response.candidate.text)
    && readback.summaryOrigin === 'ai_generated'
    && normalizeLocale(readback.summaryGeneratedLocale || '') === normalizeLocale(snapshot.requestedLocale)
    && readback.summaryGenerationContextKey === snapshot.jobContextHash
    && previewSummary === response.candidate.text
    && hashSummaryV3Value(nonSummaryState(readback)) === hashSummaryV3Value(nonSummaryState(before));
  if (!readbackPassed) {
    return { kind: 'handled_failure', typedReason: rollback(before, dependencies) ? 'visible_readback_failed' : 'rollback_failed' };
  }
  let persisted = false;
  try {
    persisted = dependencies.persistCv(readback);
  } catch {
    persisted = false;
  }
  if (!persisted) {
    return { kind: 'handled_failure', typedReason: rollback(before, dependencies) ? 'persistence_failed' : 'rollback_failed' };
  }
  try {
    dependencies.incrementUsage();
  } catch {
    return { kind: 'handled_failure', typedReason: rollback(before, dependencies) ? 'usage_increment_failed' : 'rollback_failed' };
  }
  return { kind: 'handled_success' };
}

function responseFailureReason(value: unknown): string {
  return isRecord(value) && typeof value.typedReason === 'string' && value.typedReason.trim()
    ? value.typedReason
    : 'invalid_v3_summary_response';
}

function safeDiagnosticCode(value: unknown): string | null {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/u.test(value) ? value : null;
}

function safeReason(value: string | null): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{0,63}$/u.test(normalized) ? normalized : null;
}

function diagnosticPhaseStatus(
  validation: AggregateValidationResult | null,
  phase: 'structural' | 'semantic' | 'language_quality',
): SummaryV3DiagnosticPhaseStatus {
  const status = validation?.phases?.[phase]?.status;
  return status === 'passed' || status === 'failed' || status === 'not_evaluated' ? status : 'not_evaluated';
}

function unavailableAttempt(): SummaryV3DiagnosticAttempt {
  return {
    attempted: null, result: 'unknown', stopReason: null,
    contentBlockCount: null, textBlockCount: null, toolBlockCount: null,
    expectedToolCount: null, toolNameMatched: null, toolInputObject: null,
    toolInputSchemaPassed: null, identityPassed: null,
  };
}

function notAttemptedAttempt(): SummaryV3DiagnosticAttempt {
  return { ...unavailableAttempt(), attempted: false, result: 'not_attempted' };
}

function projectedTransportAttempt(value: unknown): SummaryV3DiagnosticAttempt | null {
  if (!isRecord(value)) return null;
  const results = new Set<SummaryV3DiagnosticAttempt['result']>([
    'succeeded', 'failed', 'malformed', 'not_attempted', 'unknown',
  ]);
  const boolOrNull = (item: unknown): item is boolean | null => item === null || typeof item === 'boolean';
  const countOrNull = (item: unknown): item is number | null => item === null
    || (typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 100);
  if ((value.attempted !== null && typeof value.attempted !== 'boolean')
    || typeof value.result !== 'string' || !results.has(value.result as SummaryV3DiagnosticAttempt['result'])
    || (value.stopReason !== null && typeof value.stopReason !== 'string')
    || !countOrNull(value.contentBlockCount) || !countOrNull(value.textBlockCount)
    || !countOrNull(value.toolBlockCount) || !countOrNull(value.expectedToolCount)
    || !boolOrNull(value.toolNameMatched) || !boolOrNull(value.toolInputObject)
    || !boolOrNull(value.toolInputSchemaPassed) || !boolOrNull(value.identityPassed)) return null;
  return {
    attempted: value.attempted,
    result: value.result as SummaryV3DiagnosticAttempt['result'],
    stopReason: value.stopReason === null ? null : safeReason(value.stopReason),
    contentBlockCount: value.contentBlockCount,
    textBlockCount: value.textBlockCount,
    toolBlockCount: value.toolBlockCount,
    expectedToolCount: value.expectedToolCount,
    toolNameMatched: value.toolNameMatched,
    toolInputObject: value.toolInputObject,
    toolInputSchemaPassed: value.toolInputSchemaPassed,
    identityPassed: value.identityPassed,
  };
}

function responseTransportEvidence(value: unknown): SummaryV3TransportEvidence | null {
  if (!isRecord(value) || !isRecord(value.transportEvidence)) return null;
  const writer = projectedTransportAttempt(value.transportEvidence.writer);
  const evaluator = projectedTransportAttempt(value.transportEvidence.evaluator);
  return writer && evaluator ? { writer, evaluator } : null;
}

function attemptedAttempt(result: SummaryV3DiagnosticAttempt['result'], reason: string | null): SummaryV3DiagnosticAttempt {
  return { ...unavailableAttempt(), attempted: true, result, stopReason: safeReason(reason) };
}

function diagnosticAttempts(
  reason: string | null,
  serverResponseReceived: boolean,
  acceptedResponse: boolean,
): { writer: SummaryV3DiagnosticAttempt; evaluator: SummaryV3DiagnosticAttempt } {
  const none = notAttemptedAttempt();
  const succeeded = attemptedAttempt('succeeded', null);
  if (acceptedResponse || [
    'candidate_or_validation_mismatch', 'stale_snapshot', 'visible_readback_failed',
    'rollback_failed', 'persistence_failed', 'usage_increment_failed',
    'client_verification_exception', 'state_write_failed', 'preview_projection_failed',
  ].includes(String(reason))) return { writer: succeeded, evaluator: succeeded };
  if (reason === 'provider_request_failed') return { writer: attemptedAttempt('failed', reason), evaluator: none };
  if (reason === 'provider_output_malformed') return { writer: attemptedAttempt('malformed', reason), evaluator: none };
  if (reason === 'structural_validation_failed') return { writer: succeeded, evaluator: none };
  if (reason === 'validator_exception') return { writer: succeeded, evaluator: attemptedAttempt('failed', reason) };
  if (reason === 'evaluator_output_malformed') return { writer: succeeded, evaluator: attemptedAttempt('malformed', reason) };
  if (reason === 'validation_rejected' || reason === 'repair_provider_failed'
    || reason === 'repair_output_malformed' || reason === 'repair_validation_rejected') {
    return { writer: succeeded, evaluator: succeeded };
  }
  if (reason === 'invalid_request_contract' || reason === 'snapshot_capture_failed') return { writer: none, evaluator: none };
  if (!serverResponseReceived) return { writer: unavailableAttempt(), evaluator: unavailableAttempt() };
  return { writer: unavailableAttempt(), evaluator: unavailableAttempt() };
}

function validationViolations(
  validation: AggregateValidationResult | null,
  category: 'semantic' | 'language_quality',
): readonly AiCoreV3Violation[] {
  const phase = validation?.phases?.[category];
  return phase && Array.isArray(phase.violations) ? phase.violations : [];
}

function violationCodes(violations: readonly AiCoreV3Violation[]): readonly string[] {
  return violations.map((item) => safeDiagnosticCode(item.code)).filter((item): item is string => Boolean(item));
}

function violationHashMap(
  violations: readonly AiCoreV3Violation[],
  field: 'factIds' | 'entryIds',
): Readonly<Record<string, readonly string[]>> {
  const map: Record<string, readonly string[]> = {};
  for (const violation of violations) {
    const code = safeDiagnosticCode(violation.code);
    if (!code) continue;
    const ids = Array.isArray(violation[field]) ? violation[field] as readonly string[] : [];
    map[code] = ids.map((id) => hashSummaryV3Value(id));
  }
  return map;
}

function responseCandidate(value: unknown): AiCoreV3CandidateEnvelope | null {
  if (!isRecord(value)) return null;
  const candidate = isRecord(value.candidate) ? value.candidate : value.rejectedCandidate;
  if (!isRecord(candidate) || typeof candidate.text !== 'string' || !Array.isArray(candidate.units)) return null;
  try {
    return createCandidateEnvelope(candidate as unknown as AiCoreV3CandidateEnvelope);
  } catch {
    return null;
  }
}

function responseValidation(value: unknown): AggregateValidationResult | null {
  if (!isRecord(value) || !isRecord(value.validation) || !isRecord(value.validation.phases)) return null;
  return value.validation as unknown as AggregateValidationResult;
}

function responseEvidence(value: unknown, reason: string | null): SummaryV3TerminalEvidence {
  const validation = responseValidation(value);
  const candidate = responseCandidate(value);
  const semantic = validationViolations(validation, 'semantic');
  const language = validationViolations(validation, 'language_quality');
  const accepted = isRecord(value) && value.ok === true;
  const repairAttempted = isRecord(value) && value.repairAttempted === true;
  const attempts = diagnosticAttempts(reason, value !== undefined && value !== null, accepted);
  const transport = responseTransportEvidence(value);
  return immutableCopy({
    candidatePresent: Boolean(candidate),
    candidateHash: candidate ? hashSummaryV3Value(candidate.text) : null,
    candidateLength: candidate ? candidate.text.length : null,
    candidateUnitCount: candidate ? (candidate.units || []).length : null,
    candidateUnitHashes: candidate ? (candidate.units || []).map((unit) => hashSummaryV3Value(unit.text)) : [],
    candidateUnitLengths: candidate ? (candidate.units || []).map((unit) => unit.text.length) : [],
    writer: transport?.writer ?? attempts.writer,
    evaluator: transport?.evaluator ?? attempts.evaluator,
    phases: {
      structural: diagnosticPhaseStatus(validation, 'structural'),
      semantic: diagnosticPhaseStatus(validation, 'semantic'),
      language_quality: diagnosticPhaseStatus(validation, 'language_quality'),
    },
    semanticViolationCount: validation?.phases?.semantic ? semantic.length : null,
    semanticViolationCodes: violationCodes(semantic),
    languageQualityViolationCount: validation?.phases?.language_quality ? language.length : null,
    languageQualityViolationCodes: violationCodes(language),
    violationFactIdHashesByCode: violationHashMap([...semantic, ...language], 'factIds'),
    violationEntryIdHashesByCode: violationHashMap([...semantic, ...language], 'entryIds'),
    primaryValidationRejectionCode: safeDiagnosticCode(
      [...semantic, ...language].map((item) => item.code).find((code) => safeDiagnosticCode(code)) || null,
    ),
    repairAttempted,
    providerResponseKind: repairAttempted ? 'repair' : candidate ? 'provider' : 'none',
  }) as SummaryV3TerminalEvidence;
}

function internalRejectionAudit(
  value: unknown,
  snapshot: SummaryV3GenerateOperationSnapshot | null,
): SummaryV3InternalRejectionAudit | undefined {
  if (!INTERNAL_AI_RESET_ENABLED || !snapshot || !isRecord(value) || value.ok === true) return undefined;
  const candidate = responseCandidate(value);
  const validation = responseValidation(value);
  if (!candidate || !validation) return undefined;
  const semantic = validationViolations(validation, 'semantic');
  const language = validationViolations(validation, 'language_quality');
  const evidence = responseEvidence(value, responseFailureReason(value));
  return immutableCopy({
    operationId: snapshot.operationId,
    snapshotHash: snapshot.manifest.sourceSnapshotHash,
    locale: snapshot.requestedLocale,
    candidate: {
      candidateId: candidate.candidateId,
      text: candidate.text,
      units: (candidate.units || []).map((unit) => ({ unitId: unit.unitId, text: unit.text })),
    },
    phases: {
      structural: diagnosticPhaseStatus(validation, 'structural'),
      semantic: diagnosticPhaseStatus(validation, 'semantic'),
      language_quality: diagnosticPhaseStatus(validation, 'language_quality'),
    },
    evaluator: { semanticViolations: semantic, languageQualityViolations: language },
    transport: {
      writer: evidence.writer,
      evaluator: evidence.evaluator,
    },
  }) as SummaryV3InternalRejectionAudit;
}

function routeHttpStatus(dependencies: SummaryV3GenerateAdapterDependencies): number | null {
  try {
    const status = dependencies.getRouteHttpStatus?.();
    return Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599 ? Number(status) : null;
  } catch {
    return null;
  }
}

function usageAfter(
  input: SummaryV3GenerateAdapterInput,
  dependencies: SummaryV3GenerateAdapterDependencies,
  kind: 'handled_success' | 'handled_failure',
): number {
  try {
    const count = dependencies.getUsageCount?.();
    if (Number.isFinite(count) && Number(count) >= 0) return Number(count);
  } catch { /* diagnostics only */ }
  return input.usageCountBefore + (kind === 'handled_success' ? 1 : 0);
}

function emitTerminal(
  input: SummaryV3GenerateAdapterInput,
  dependencies: SummaryV3GenerateAdapterDependencies,
  snapshot: SummaryV3GenerateOperationSnapshot | null,
  result: { kind: 'handled_success' | 'handled_failure'; typedReason?: string },
  rawResponse: unknown,
): void {
  try {
    dependencies.onTerminal?.({
      input,
      snapshot,
      kind: result.kind,
      typedReason: result.kind === 'handled_failure' ? result.typedReason || 'unknown' : null,
      evidence: responseEvidence(rawResponse, result.kind === 'handled_failure' ? result.typedReason || null : null),
      ...(result.kind === 'handled_failure'
        ? (() => {
          const audit = internalRejectionAudit(rawResponse, snapshot);
          return audit ? { internalRejectionAudit: audit } : {};
        })()
        : {}),
      applyCommitted: result.kind === 'handled_success',
      usageAfter: usageAfter(input, dependencies, result.kind),
      routeHttpStatus: routeHttpStatus(dependencies),
    });
  } catch {
    /* Terminal diagnostics are strictly observational. */
  }
}

export async function runSummaryV3GenerateAdapter(
  input: SummaryV3GenerateAdapterInput,
  dependencies: SummaryV3GenerateAdapterDependencies,
): Promise<SummaryV3GenerateRoutingResult> {
  if (classifySummaryV3GenerateRouting(input) === 'not_applicable') return { kind: 'not_applicable' };
  let snapshot: SummaryV3GenerateOperationSnapshot;
  try {
    snapshot = captureSummaryV3GenerateOperationSnapshot(input);
  } catch (error) {
    const result = { kind: 'handled_failure' as const, typedReason: error instanceof Error ? error.message : 'snapshot_capture_failed' };
    emitTerminal(input, dependencies, null, result, undefined);
    return result;
  }
  let raw: unknown;
  try {
    raw = await dependencies.request({ action: SUMMARY_V3_GENERATE_ACTION, manifest: snapshot.manifest });
  } catch {
    const result = { kind: 'handled_failure' as const, typedReason: 'provider_request_failed' };
    emitTerminal(input, dependencies, snapshot, result, undefined);
    return result;
  }
  const response = parseSummaryV3GenerateSuccessResponse(raw);
  if (!response) {
    const result = { kind: 'handled_failure' as const, typedReason: responseFailureReason(raw) };
    emitTerminal(input, dependencies, snapshot, result, raw);
    return result;
  }
  try {
    const result = applySummaryV3GenerateTransaction(snapshot, response, dependencies);
    if (result.kind === 'not_applicable') return result;
    emitTerminal(input, dependencies, snapshot, result, raw);
    return result;
  } catch {
    const result = { kind: 'handled_failure' as const, typedReason: 'client_verification_exception' };
    emitTerminal(input, dependencies, snapshot, result, raw);
    return result;
  }
}
