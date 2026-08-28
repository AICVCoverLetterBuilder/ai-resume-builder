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
import type { AggregateValidationResult } from './validators';

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
}

export interface SummaryV3GenerateFailureResponse {
  readonly ok: false;
  readonly action: typeof SUMMARY_V3_GENERATE_ACTION;
  readonly typedReason: string;
  readonly validation?: AggregateValidationResult;
  readonly repairAttempted?: boolean;
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

export async function runSummaryV3GenerateAdapter(
  input: SummaryV3GenerateAdapterInput,
  dependencies: SummaryV3GenerateAdapterDependencies,
): Promise<SummaryV3GenerateRoutingResult> {
  if (classifySummaryV3GenerateRouting(input) === 'not_applicable') return { kind: 'not_applicable' };
  let snapshot: SummaryV3GenerateOperationSnapshot;
  try {
    snapshot = captureSummaryV3GenerateOperationSnapshot(input);
  } catch (error) {
    return { kind: 'handled_failure', typedReason: error instanceof Error ? error.message : 'snapshot_capture_failed' };
  }
  let raw: unknown;
  try {
    raw = await dependencies.request({ action: SUMMARY_V3_GENERATE_ACTION, manifest: snapshot.manifest });
  } catch {
    return { kind: 'handled_failure', typedReason: 'provider_request_failed' };
  }
  const response = parseSummaryV3GenerateSuccessResponse(raw);
  if (!response) return { kind: 'handled_failure', typedReason: responseFailureReason(raw) };
  try {
    return applySummaryV3GenerateTransaction(snapshot, response, dependencies);
  } catch {
    return { kind: 'handled_failure', typedReason: 'client_verification_exception' };
  }
}
