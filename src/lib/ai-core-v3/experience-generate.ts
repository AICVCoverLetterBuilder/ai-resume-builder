import type { CVData, WorkExperience } from '../types';
import { buildExperienceAiOutputProvenance } from '../cv-experience-ai-output-provenance';
import { createCandidateEnvelope } from './candidate-envelope';
import type {
  AiCoreV3CandidateEnvelope,
  StructuredDate,
  StructuredEmploymentDates,
} from './contracts';
import { createExperienceFactManifest } from './experience-manifest';
import { immutableCopy } from './immutability';
import { createSourceAuthoritySnapshot } from './source-authority';
import type { AggregateValidationResult } from './validators';

export const EXPERIENCE_V3_GENERATE_ACTION = 'experience_v3_generate' as const;
export const EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_MARKER = 'EXPERIENCE_V3_TERMINAL_DIAGNOSTIC' as const;
export const EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_REVISION = 'experience-v3-terminal-diagnostic-v1' as const;

export const EXPERIENCE_V3_TERMINAL_REASON_CODES = [
  'none',
  'snapshot_capture_failed',
  'target_entry_missing',
  'role_title_missing',
  'structured_dates_invalid',
  'source_not_empty',
  'invalid_request_contract',
  'v3_feature_disabled',
  'provider_request_failed',
  'provider_output_malformed',
  'structural_validation_failed',
  'evaluator_request_failed',
  'evaluator_max_tokens',
  'evaluator_tool_missing',
  'evaluator_multiple_tools',
  'evaluator_wrong_tool',
  'evaluator_unexpected_text_block',
  'evaluator_tool_input_malformed',
  'evaluator_identity_mismatch',
  'evaluator_output_malformed',
  'validation_rejected',
  'invalid_v3_response',
  'candidate_or_validation_mismatch',
  'stale_snapshot',
  'target_entry_deleted',
  'visible_readback_failed',
  'rollback_failed',
  'persistence_failed',
  'usage_increment_failed',
  'client_verification_exception',
  'transport_or_request_failure',
] as const;

export type ExperienceV3TerminalReasonCode = (typeof EXPERIENCE_V3_TERMINAL_REASON_CODES)[number];
export type ExperienceV3DiagnosticPhaseStatus = 'passed' | 'failed' | 'not_evaluated';
export type ExperienceV3DiagnosticAttempt = {
  readonly attempted: boolean | null;
  readonly result: 'succeeded' | 'failed' | 'malformed' | 'not_attempted' | 'unknown';
};

export interface ExperienceV3TerminalDiagnostic {
  readonly schemaVersion: 1;
  readonly marker: typeof EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_MARKER;
  readonly revision: typeof EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_REVISION;
  readonly capturedAt: string;
  readonly operation: typeof EXPERIENCE_V3_GENERATE_ACTION;
  readonly requestIdHash: string;
  readonly operationIdHash: string;
  readonly stableEntryIdHash: string;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly contentLocale: string;
  readonly sourceWasEmpty: boolean;
  readonly normalizedIndustry: string;
  readonly normalizedLevel: string;
  readonly employmentState: 'present' | 'completed' | 'unknown';
  readonly ownershipResult: 'owned';
  readonly routeHttpStatus: number | null;
  readonly writer: ExperienceV3DiagnosticAttempt;
  readonly evaluator: ExperienceV3DiagnosticAttempt;
  readonly phases: Readonly<Record<'structural' | 'semantic' | 'language_quality', ExperienceV3DiagnosticPhaseStatus>>;
  readonly rejectionReasonCodes: readonly ExperienceV3TerminalReasonCode[];
  readonly finalDecision: 'accept' | 'reject' | 'not_ready' | 'transport_failure' | 'race_failure';
  readonly applyAuthorized: boolean;
  readonly applyAttempted: boolean;
  readonly applyCommitted: boolean;
  readonly v2FallthroughCount: 0;
  readonly usageBefore: number;
  readonly usageAfter: number;
  readonly usageDelta: number;
  readonly raceGuardResult: 'passed' | 'failed' | 'not_evaluated';
  readonly sourceCommitMarker: string | null;
  readonly buildChannel: string | null;
}

export type ExperienceV3RoutingResult =
  | { readonly kind: 'not_applicable' }
  | { readonly kind: 'handled_success' }
  | { readonly kind: 'handled_failure'; readonly typedReason: string };

export type ExperienceV3AdapterResult =
  | { readonly kind: 'not_applicable' }
  | { readonly kind: 'handled_success'; readonly diagnostic: ExperienceV3TerminalDiagnostic }
  | {
    readonly kind: 'handled_failure';
    readonly typedReason: string;
    readonly diagnostic: ExperienceV3TerminalDiagnostic;
  };

export interface ExperienceV3ProviderOutput {
  readonly operationId: string;
  readonly entryId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly bullets: readonly string[];
}

export interface ExperienceV3GenerateSuccessResponse {
  readonly ok: true;
  readonly action: typeof EXPERIENCE_V3_GENERATE_ACTION;
  readonly providerOutput: ExperienceV3ProviderOutput;
  readonly candidate: AiCoreV3CandidateEnvelope;
  readonly validation: AggregateValidationResult;
}

export interface ExperienceV3GenerateFailureResponse {
  readonly ok: false;
  readonly action: typeof EXPERIENCE_V3_GENERATE_ACTION;
  readonly typedReason: string;
  readonly validation?: AggregateValidationResult;
}

export type ExperienceV3GenerateResponse =
  | ExperienceV3GenerateSuccessResponse
  | ExperienceV3GenerateFailureResponse;

export interface ExperienceV3OperationSnapshot {
  readonly operationId: string;
  readonly entryId: string;
  readonly entryIndexDiagnostic: number;
  readonly roleTitle: string;
  readonly company: string;
  readonly employmentState: 'present' | 'completed';
  readonly rawStartDate: string;
  readonly rawEndDate: string;
  readonly dates: StructuredEmploymentDates;
  readonly industry: string;
  readonly level: string;
  readonly gender: string;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleDescription: string;
  readonly normalizedSourceHash: string;
  readonly contextSnapshotHash: string;
  readonly cvSnapshotHash: string;
  readonly usageCountBefore: number;
  readonly sourceAuthority: ReturnType<typeof createSourceAuthoritySnapshot>;
  readonly manifest: ReturnType<typeof createExperienceFactManifest>;
}

export interface ExperienceV3AdapterInput {
  readonly enabled: boolean;
  readonly operationKind: string;
  readonly operationId: string;
  readonly entryId: string;
  readonly entryIndexDiagnostic: number;
  readonly cv: CVData;
  readonly industry: string;
  readonly level: string;
  /** Normalized finite values used only by diagnostics; request authority is unchanged. */
  readonly diagnosticIndustry?: string;
  readonly diagnosticLevel?: string;
  readonly gender: string;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleDescription: string;
  readonly usageCountBefore: number;
}

export interface ExperienceV3LiveState {
  readonly cv: CVData;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleDescription: string;
  readonly industry: string;
  readonly level: string;
}

export interface ExperienceV3AdapterDependencies {
  readonly request: (request: {
    readonly action: typeof EXPERIENCE_V3_GENERATE_ACTION;
    readonly manifest: ExperienceV3OperationSnapshot['manifest'];
  }) => Promise<unknown>;
  readonly getLiveState: () => ExperienceV3LiveState;
  readonly writeCv: (next: CVData) => void;
  readonly persistCv: (next: CVData) => boolean;
  readonly incrementUsage: () => void;
  readonly getUsageCount?: () => number;
  readonly getRouteHttpStatus?: () => number | null;
}

function normalizeLocale(value: string): string {
  return String(value || '').trim().replace(/_/g, '-').toLowerCase();
}

export function normalizeExperienceV3Source(value: string): string {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

/** Deterministic, client-safe snapshot fingerprint; it is not an authorization token. */
export function hashExperienceV3Value(value: unknown): string {
  const input = typeof value === 'string' ? value : stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v3-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function parseStructuredDate(value: string): StructuredDate | null {
  const raw = String(value || '').trim();
  const yearFirst = raw.match(/^(\d{4})(?:[-/.](\d{1,2}))?(?:[-/.](\d{1,2}))?$/);
  if (yearFirst) {
    const year = Number(yearFirst[1]);
    const month = yearFirst[2] ? Number(yearFirst[2]) : undefined;
    const day = yearFirst[3] ? Number(yearFirst[3]) : undefined;
    if (month !== undefined && (month < 1 || month > 12)) return null;
    if (day !== undefined && (day < 1 || day > 31)) return null;
    return { year, ...(month !== undefined ? { month } : {}), ...(day !== undefined ? { day } : {}) };
  }
  const monthFirst = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (!monthFirst) return null;
  const month = Number(monthFirst[1]);
  if (month < 1 || month > 12) return null;
  return { year: Number(monthFirst[2]), month };
}

export function classifyExperienceV3Routing(
  input: Pick<
    ExperienceV3AdapterInput,
    | 'enabled'
    | 'operationKind'
    | 'requestedLocale'
    | 'uiLocale'
    | 'storedContentLocale'
    | 'exactVisibleDescription'
  >,
): 'not_applicable' | 'owned' {
  if (!input.enabled) return 'not_applicable';
  if (input.operationKind !== 'experience_generate') return 'not_applicable';
  if (normalizeExperienceV3Source(input.exactVisibleDescription).length > 0) return 'not_applicable';
  const requested = normalizeLocale(input.requestedLocale);
  const ui = normalizeLocale(input.uiLocale);
  const stored = normalizeLocale(input.storedContentLocale);
  if (!requested || requested !== ui || requested !== stored) return 'not_applicable';
  return 'owned';
}

function captureContextValue(
  cv: CVData,
  entry: WorkExperience,
  input: ExperienceV3AdapterInput,
  dates: StructuredEmploymentDates,
): unknown {
  return {
    documentId: cv.id,
    entryId: entry.id,
    roleTitle: entry.position,
    company: entry.company,
    employmentState: entry.isPresent ? 'present' : 'completed',
    rawStartDate: entry.startDate,
    rawEndDate: entry.endDate,
    dates,
    industry: input.industry,
    level: input.level,
    gender: input.gender,
    requestedLocale: input.requestedLocale,
    uiLocale: input.uiLocale,
    storedContentLocale: input.storedContentLocale,
    sourceHash: hashExperienceV3Value(normalizeExperienceV3Source(input.exactVisibleDescription)),
  };
}

export function captureExperienceV3OperationSnapshot(
  input: ExperienceV3AdapterInput,
): ExperienceV3OperationSnapshot {
  const entry = input.cv.experience.find((item) => item.id === input.entryId);
  if (!entry) throw new TypeError('target_entry_missing');
  if (!String(entry.position || '').trim()) throw new TypeError('role_title_missing');
  const start = parseStructuredDate(entry.startDate);
  const end = entry.isPresent ? null : parseStructuredDate(entry.endDate);
  if (!start || (!entry.isPresent && !end)) throw new TypeError('structured_dates_invalid');
  const dates: StructuredEmploymentDates = { start, end };
  const normalizedSource = normalizeExperienceV3Source(input.exactVisibleDescription);
  if (normalizedSource.length > 0) throw new TypeError('source_not_empty');

  const normalizedSourceHash = hashExperienceV3Value(normalizedSource);
  const contextSnapshotHash = hashExperienceV3Value(
    captureContextValue(input.cv, entry, input, dates),
  );
  const cvSnapshotHash = hashExperienceV3Value(input.cv);
  const sourceAuthority = createSourceAuthoritySnapshot({
    operationId: input.operationId,
    operationKind: 'experience_generate',
    documentId: input.cv.id,
    targetEntryId: entry.id,
    sourceText: input.exactVisibleDescription,
    sourceLocale: input.storedContentLocale,
    targetLocale: input.requestedLocale,
    provenance: { origin: 'user_input', detail: 'live_visible_experience_description' },
    sourceHash: normalizedSourceHash,
    snapshotHash: contextSnapshotHash,
    employmentState: entry.isPresent ? 'present' : 'completed',
    dates,
    captureToken: hashExperienceV3Value(`${input.operationId}:${entry.id}:${cvSnapshotHash}`),
  });
  const manifest = createExperienceFactManifest({
    operationId: input.operationId,
    mode: 'generate',
    entryId: entry.id,
    locale: input.requestedLocale,
    roleTitle: entry.position,
    company: entry.company,
    employmentState: entry.isPresent ? 'present' : 'completed',
    dates,
    industry: input.industry,
    level: input.level,
    exactSourceText: '',
    facts: [],
    snapshotHash: contextSnapshotHash,
  });

  return immutableCopy({
    operationId: input.operationId,
    entryId: entry.id,
    entryIndexDiagnostic: input.entryIndexDiagnostic,
    roleTitle: entry.position,
    company: entry.company,
    employmentState: entry.isPresent ? 'present' as const : 'completed' as const,
    rawStartDate: entry.startDate,
    rawEndDate: entry.endDate,
    dates,
    industry: input.industry,
    level: input.level,
    gender: input.gender,
    requestedLocale: input.requestedLocale,
    uiLocale: input.uiLocale,
    storedContentLocale: input.storedContentLocale,
    exactVisibleDescription: input.exactVisibleDescription,
    normalizedSourceHash,
    contextSnapshotHash,
    cvSnapshotHash,
    usageCountBefore: input.usageCountBefore,
    sourceAuthority,
    manifest,
  }) as ExperienceV3OperationSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExplicitAccept(validation: AggregateValidationResult): boolean {
  return validation.decision === 'accept'
    && validation.phases.structural?.status === 'passed'
    && validation.phases.semantic?.status === 'passed'
    && validation.phases.language_quality?.status === 'passed'
    && validation.phases.structural.violations.length === 0
    && validation.phases.semantic.violations.length === 0
    && validation.phases.language_quality.violations.length === 0;
}

export function parseExperienceV3SuccessResponse(
  value: unknown,
): ExperienceV3GenerateSuccessResponse | null {
  if (!isRecord(value) || value.ok !== true || value.action !== EXPERIENCE_V3_GENERATE_ACTION) return null;
  const providerOutput = value.providerOutput;
  const candidate = value.candidate;
  const validation = value.validation;
  if (!isRecord(providerOutput) || !isRecord(candidate) || !isRecord(validation)) return null;
  if (!Array.isArray(providerOutput.bullets) || providerOutput.bullets.some((item) => typeof item !== 'string')) return null;
  if (!isRecord(validation.phases)) return null;
  try {
    const envelope = createCandidateEnvelope(candidate as unknown as AiCoreV3CandidateEnvelope);
    return immutableCopy({
      ok: true as const,
      action: EXPERIENCE_V3_GENERATE_ACTION,
      providerOutput: providerOutput as unknown as ExperienceV3ProviderOutput,
      candidate: envelope,
      validation: validation as unknown as AggregateValidationResult,
    }) as ExperienceV3GenerateSuccessResponse;
  } catch {
    return null;
  }
}

function candidateTextFromBullets(bullets: readonly string[]): string {
  return bullets.map((bullet) => `• ${bullet}`).join('\n');
}

export function responseMatchesExperienceV3Snapshot(
  response: ExperienceV3GenerateSuccessResponse,
  snapshot: ExperienceV3OperationSnapshot,
): boolean {
  const output = response.providerOutput;
  const candidate = response.candidate;
  return hasExplicitAccept(response.validation)
    && output.operationId === snapshot.operationId
    && output.entryId === snapshot.entryId
    && output.snapshotHash === snapshot.contextSnapshotHash
    && normalizeLocale(output.locale) === normalizeLocale(snapshot.requestedLocale)
    && output.bullets.length === 3
    && candidate.operationId === snapshot.operationId
    && candidate.operationKind === 'experience_generate'
    && candidate.sourceSnapshotHash === snapshot.contextSnapshotHash
    && normalizeLocale(candidate.targetLocale) === normalizeLocale(snapshot.requestedLocale)
    && candidate.text === candidateTextFromBullets(output.bullets)
    && candidate.units?.length === 3
    && candidate.units.every((unit, index) => (
      unit.entryId === snapshot.entryId
      && unit.text === output.bullets[index]
    ));
}

function liveStateMatchesSnapshot(
  live: ExperienceV3LiveState,
  snapshot: ExperienceV3OperationSnapshot,
): boolean {
  const entry = live.cv.experience.find((item) => item.id === snapshot.entryId);
  if (!entry) return false;
  const liveContextSnapshotHash = hashExperienceV3Value({
    documentId: live.cv.id,
    entryId: entry.id,
    roleTitle: entry.position,
    company: entry.company,
    employmentState: entry.isPresent ? 'present' : 'completed',
    rawStartDate: entry.startDate,
    rawEndDate: entry.endDate,
    dates: snapshot.dates,
    industry: live.industry,
    level: live.level,
    gender: String(live.cv.personal.gender || ''),
    requestedLocale: live.requestedLocale,
    uiLocale: live.uiLocale,
    storedContentLocale: live.storedContentLocale,
    sourceHash: hashExperienceV3Value(normalizeExperienceV3Source(live.exactVisibleDescription)),
  });
  return normalizeExperienceV3Source(live.exactVisibleDescription).length === 0
    && normalizeExperienceV3Source(entry.description).length === 0
    && live.cv.id === snapshot.sourceAuthority.documentId
    && normalizeLocale(live.requestedLocale) === normalizeLocale(snapshot.requestedLocale)
    && normalizeLocale(live.uiLocale) === normalizeLocale(snapshot.uiLocale)
    && normalizeLocale(live.storedContentLocale) === normalizeLocale(snapshot.storedContentLocale)
    && live.industry === snapshot.industry
    && live.level === snapshot.level
    && String(live.cv.personal.gender || '') === snapshot.gender
    && entry.position === snapshot.roleTitle
    && entry.company === snapshot.company
    && entry.startDate === snapshot.rawStartDate
    && entry.endDate === snapshot.rawEndDate
    && (entry.isPresent ? 'present' : 'completed') === snapshot.employmentState
    && liveContextSnapshotHash === snapshot.contextSnapshotHash;
}

function valueWithoutKeys<T extends Record<string, unknown>>(value: T, keys: readonly string[]): Record<string, unknown> {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

const EXPERIENCE_V3_WRITABLE_KEYS = [
  'description',
  'generatedDescription',
  'generatedLocale',
  'descriptionOrigin',
  'aiOutputProvenance',
] as const;

function nonTargetCvState(cv: CVData, entryId: string): unknown {
  return {
    root: valueWithoutKeys(cv as unknown as Record<string, unknown>, ['experience']),
    otherEntries: cv.experience.filter((entry) => entry.id !== entryId),
  };
}

function targetNonWritableState(entry: WorkExperience): unknown {
  return valueWithoutKeys(
    entry as unknown as Record<string, unknown>,
    EXPERIENCE_V3_WRITABLE_KEYS,
  );
}

function localeScriptMatches(text: string, locale: string): boolean {
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length === 0) return false;
  const normalized = normalizeLocale(locale);
  if (normalized === 'ar') return /\p{Script=Arabic}/u.test(text);
  if (normalized === 'hi') return /\p{Script=Devanagari}/u.test(text);
  if (normalized === 'ru') return /\p{Script=Cyrillic}/u.test(text);
  if (normalized === 'ja') return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text);
  if (normalized === 'sr') return /[\p{Script=Latin}\p{Script=Cyrillic}]/u.test(text);
  return /\p{Script=Latin}/u.test(text);
}

function rollbackState(
  before: CVData,
  dependencies: Pick<ExperienceV3AdapterDependencies, 'getLiveState' | 'writeCv'>,
): boolean {
  dependencies.writeCv(before);
  return hashExperienceV3Value(dependencies.getLiveState().cv) === hashExperienceV3Value(before);
}

export function applyExperienceV3Transaction(
  snapshot: ExperienceV3OperationSnapshot,
  response: ExperienceV3GenerateSuccessResponse,
  dependencies: Pick<
    ExperienceV3AdapterDependencies,
    'getLiveState' | 'writeCv' | 'persistCv' | 'incrementUsage'
  >,
): Exclude<ExperienceV3RoutingResult, { kind: 'not_applicable' }> {
  const liveBefore = dependencies.getLiveState();
  if (!liveStateMatchesSnapshot(liveBefore, snapshot)) {
    return { kind: 'handled_failure', typedReason: 'stale_snapshot' };
  }
  const before = liveBefore.cv;
  const beforeEntry = before.experience.find((entry) => entry.id === snapshot.entryId);
  if (!beforeEntry) return { kind: 'handled_failure', typedReason: 'target_entry_deleted' };

  const nextEntry: WorkExperience = {
    ...beforeEntry,
    description: response.candidate.text,
    generatedDescription: response.candidate.text,
    generatedLocale: snapshot.requestedLocale,
    descriptionOrigin: 'ai_generated',
    aiOutputProvenance: buildExperienceAiOutputProvenance({
      experienceEntryId: snapshot.entryId,
      appliedOutput: response.candidate.text,
      preAiFactText: '',
      sourceLocale: snapshot.storedContentLocale,
      targetLocale: snapshot.requestedLocale,
      operationMode: 'generate',
      sourceAuthorityKind: 'generated_from_empty',
      requestHash: snapshot.contextSnapshotHash,
      generatedFromEmpty: true,
    }),
  };
  const next: CVData = {
    ...before,
    experience: before.experience.map((entry) => (
      entry.id === snapshot.entryId ? nextEntry : entry
    )),
  };

  dependencies.writeCv(next);
  const readback = dependencies.getLiveState().cv;
  const readbackEntry = readback.experience.find((entry) => entry.id === snapshot.entryId);
  const exactCandidateHash = hashExperienceV3Value(normalizeExperienceV3Source(response.candidate.text));
  const visibleHash = hashExperienceV3Value(
    normalizeExperienceV3Source(readbackEntry?.description || ''),
  );
  const readbackPassed = Boolean(readbackEntry)
    && readbackEntry?.id === snapshot.entryId
    && readbackEntry.description === response.candidate.text
    && readbackEntry.generatedDescription === response.candidate.text
    && normalizeLocale(readbackEntry.generatedLocale || '') === normalizeLocale(snapshot.requestedLocale)
    && readbackEntry.descriptionOrigin === 'ai_generated'
    && visibleHash === exactCandidateHash
    && response.providerOutput.bullets.length === 3
    && localeScriptMatches(readbackEntry.description, snapshot.requestedLocale)
    && hashExperienceV3Value(nonTargetCvState(readback, snapshot.entryId))
      === hashExperienceV3Value(nonTargetCvState(before, snapshot.entryId))
    && hashExperienceV3Value(targetNonWritableState(readbackEntry))
      === hashExperienceV3Value(targetNonWritableState(beforeEntry));

  if (!readbackPassed) {
    const rolledBack = rollbackState(before, dependencies);
    return {
      kind: 'handled_failure',
      typedReason: rolledBack ? 'visible_readback_failed' : 'rollback_failed',
    };
  }

  let persisted = false;
  try {
    persisted = dependencies.persistCv(readback);
  } catch {
    persisted = false;
  }
  if (!persisted) {
    const rolledBack = rollbackState(before, dependencies);
    return {
      kind: 'handled_failure',
      typedReason: rolledBack ? 'persistence_failed' : 'rollback_failed',
    };
  }

  try {
    dependencies.incrementUsage();
  } catch {
    rollbackState(before, dependencies);
    try {
      dependencies.persistCv(before);
    } catch {
      // The typed failure remains terminal; no second writer or V2 fallback is permitted.
    }
    return { kind: 'handled_failure', typedReason: 'usage_increment_failed' };
  }
  return { kind: 'handled_success' };
}

function failureReasonFromResponse(value: unknown): string {
  return isRecord(value) && typeof value.typedReason === 'string' && value.typedReason.trim()
    ? value.typedReason
    : 'invalid_v3_response';
}

const EXPERIENCE_V3_TERMINAL_REASON_SET = new Set<string>(EXPERIENCE_V3_TERMINAL_REASON_CODES);

function finiteTerminalReason(value: string): ExperienceV3TerminalReasonCode {
  return EXPERIENCE_V3_TERMINAL_REASON_SET.has(value)
    ? value as ExperienceV3TerminalReasonCode
    : 'transport_or_request_failure';
}

function diagnosticContextValue(value: string | undefined): string {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,39}$/u.test(normalized) ? normalized : 'unknown';
}

function diagnosticEnvironmentValue(value: string | undefined): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return ['internal', 'preview', 'production', 'development', 'test'].includes(normalized)
    ? normalized
    : null;
}

function diagnosticSourceMarker(value: string | undefined): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{7,40}$/u.test(normalized) ? normalized.slice(0, 7) : null;
}

function responseValidation(value: unknown): AggregateValidationResult | null {
  if (!isRecord(value) || !isRecord(value.validation) || !isRecord(value.validation.phases)) return null;
  return value.validation as unknown as AggregateValidationResult;
}

function diagnosticPhaseStatus(
  validation: AggregateValidationResult | null,
  phase: 'structural' | 'semantic' | 'language_quality',
): ExperienceV3DiagnosticPhaseStatus {
  const status = validation?.phases?.[phase]?.status;
  return status === 'passed' || status === 'failed' || status === 'not_evaluated'
    ? status
    : 'not_evaluated';
}

function diagnosticAttempts(
  reason: ExperienceV3TerminalReasonCode,
  serverResponseReceived: boolean,
  acceptedResponse: boolean,
): { writer: ExperienceV3DiagnosticAttempt; evaluator: ExperienceV3DiagnosticAttempt } {
  const notAttempted: ExperienceV3DiagnosticAttempt = { attempted: false, result: 'not_attempted' };
  const succeeded: ExperienceV3DiagnosticAttempt = { attempted: true, result: 'succeeded' };
  if (acceptedResponse || [
    'candidate_or_validation_mismatch',
    'stale_snapshot',
    'target_entry_deleted',
    'visible_readback_failed',
    'rollback_failed',
    'persistence_failed',
    'usage_increment_failed',
    'client_verification_exception',
  ].includes(reason)) {
    return { writer: succeeded, evaluator: succeeded };
  }
  if (reason === 'provider_request_failed') {
    return { writer: { attempted: true, result: 'failed' }, evaluator: notAttempted };
  }
  if (reason === 'provider_output_malformed') {
    return { writer: { attempted: true, result: 'malformed' }, evaluator: notAttempted };
  }
  if (reason === 'structural_validation_failed') {
    return { writer: succeeded, evaluator: notAttempted };
  }
  if (reason === 'evaluator_request_failed') {
    return { writer: succeeded, evaluator: { attempted: true, result: 'failed' } };
  }
  if ([
    'evaluator_max_tokens',
    'evaluator_tool_missing',
    'evaluator_multiple_tools',
    'evaluator_wrong_tool',
    'evaluator_unexpected_text_block',
    'evaluator_tool_input_malformed',
    'evaluator_identity_mismatch',
    'evaluator_output_malformed',
  ].includes(reason)) {
    return { writer: succeeded, evaluator: { attempted: true, result: 'malformed' } };
  }
  if (reason === 'validation_rejected') return { writer: succeeded, evaluator: succeeded };
  if (reason === 'invalid_request_contract' || reason === 'v3_feature_disabled'
    || reason === 'snapshot_capture_failed' || reason === 'target_entry_missing'
    || reason === 'role_title_missing' || reason === 'structured_dates_invalid'
    || reason === 'source_not_empty') {
    return { writer: notAttempted, evaluator: notAttempted };
  }
  if (!serverResponseReceived) {
    return {
      writer: { attempted: null, result: 'unknown' },
      evaluator: { attempted: null, result: 'unknown' },
    };
  }
  return {
    writer: { attempted: null, result: 'unknown' },
    evaluator: { attempted: null, result: 'unknown' },
  };
}

function buildExperienceV3TerminalDiagnostic(
  input: ExperienceV3AdapterInput,
  dependencies: ExperienceV3AdapterDependencies,
  result: Exclude<ExperienceV3RoutingResult, { kind: 'not_applicable' }>,
  rawResponse: unknown,
  serverResponseReceived: boolean,
): ExperienceV3TerminalDiagnostic {
  const rawReason = result.kind === 'handled_success' ? 'none' : result.typedReason;
  const reason = finiteTerminalReason(rawReason);
  const acceptedResponse = Boolean(parseExperienceV3SuccessResponse(rawResponse));
  const validation = responseValidation(rawResponse);
  const routeHttpStatus = (() => {
    try {
      const value = dependencies.getRouteHttpStatus?.();
      return Number.isInteger(value) && Number(value) >= 100 && Number(value) <= 599
        ? Number(value)
        : null;
    } catch {
      return null;
    }
  })();
  const usageAfter = (() => {
    try {
      const value = dependencies.getUsageCount?.();
      return Number.isFinite(value) && Number(value) >= 0
        ? Number(value)
        : input.usageCountBefore + (result.kind === 'handled_success' ? 1 : 0);
    } catch {
      return input.usageCountBefore + (result.kind === 'handled_success' ? 1 : 0);
    }
  })();
  const raceFailure = reason === 'stale_snapshot' || reason === 'target_entry_deleted';
  const transportFailure = reason === 'provider_request_failed'
    || reason === 'evaluator_request_failed'
    || reason === 'evaluator_max_tokens'
    || reason === 'evaluator_tool_missing'
    || reason === 'evaluator_multiple_tools'
    || reason === 'evaluator_wrong_tool'
    || reason === 'evaluator_unexpected_text_block'
    || reason === 'evaluator_tool_input_malformed'
    || reason === 'evaluator_identity_mismatch'
    || reason === 'evaluator_output_malformed'
    || reason === 'transport_or_request_failure'
    || (routeHttpStatus !== null && routeHttpStatus >= 500);
  const notReady = reason === 'snapshot_capture_failed'
    || reason === 'target_entry_missing'
    || reason === 'role_title_missing'
    || reason === 'structured_dates_invalid'
    || reason === 'source_not_empty'
    || reason === 'invalid_request_contract'
    || reason === 'v3_feature_disabled';
  const applyAuthorized = acceptedResponse;
  const applyAttempted = applyAuthorized && !raceFailure;
  const entry = input.cv.experience.find((item) => item.id === input.entryId);
  const attempts = diagnosticAttempts(reason, serverResponseReceived, acceptedResponse);

  return immutableCopy({
    schemaVersion: 1 as const,
    marker: EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_MARKER,
    revision: EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_REVISION,
    capturedAt: new Date().toISOString(),
    operation: EXPERIENCE_V3_GENERATE_ACTION,
    requestIdHash: hashExperienceV3Value(input.operationId),
    operationIdHash: hashExperienceV3Value(input.operationId),
    stableEntryIdHash: hashExperienceV3Value(input.entryId),
    requestedLocale: normalizeLocale(input.requestedLocale),
    uiLocale: normalizeLocale(input.uiLocale),
    contentLocale: normalizeLocale(input.storedContentLocale),
    sourceWasEmpty: normalizeExperienceV3Source(input.exactVisibleDescription).length === 0,
    normalizedIndustry: diagnosticContextValue(input.diagnosticIndustry ?? input.industry),
    normalizedLevel: diagnosticContextValue(input.diagnosticLevel ?? input.level),
    employmentState: entry ? (entry.isPresent ? 'present' as const : 'completed' as const) : 'unknown' as const,
    ownershipResult: 'owned' as const,
    routeHttpStatus,
    writer: attempts.writer,
    evaluator: attempts.evaluator,
    phases: {
      structural: diagnosticPhaseStatus(validation, 'structural'),
      semantic: diagnosticPhaseStatus(validation, 'semantic'),
      language_quality: diagnosticPhaseStatus(validation, 'language_quality'),
    },
    rejectionReasonCodes: result.kind === 'handled_success' ? [] : [reason],
    finalDecision: result.kind === 'handled_success'
      ? 'accept' as const
      : raceFailure
        ? 'race_failure' as const
        : transportFailure
          ? 'transport_failure' as const
          : notReady
            ? 'not_ready' as const
            : 'reject' as const,
    applyAuthorized,
    applyAttempted,
    applyCommitted: result.kind === 'handled_success',
    v2FallthroughCount: 0 as const,
    usageBefore: input.usageCountBefore,
    usageAfter,
    usageDelta: usageAfter - input.usageCountBefore,
    raceGuardResult: raceFailure ? 'failed' as const : applyAuthorized ? 'passed' as const : 'not_evaluated' as const,
    sourceCommitMarker: diagnosticSourceMarker(process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT),
    buildChannel: diagnosticEnvironmentValue(process.env.NEXT_PUBLIC_BUILD_CHANNEL),
  }) as ExperienceV3TerminalDiagnostic;
}

function withTerminalDiagnostic(
  input: ExperienceV3AdapterInput,
  dependencies: ExperienceV3AdapterDependencies,
  result: Exclude<ExperienceV3RoutingResult, { kind: 'not_applicable' }>,
  rawResponse: unknown,
  serverResponseReceived: boolean,
): ExperienceV3AdapterResult {
  const diagnostic = buildExperienceV3TerminalDiagnostic(
    input,
    dependencies,
    result,
    rawResponse,
    serverResponseReceived,
  );
  return result.kind === 'handled_success'
    ? { kind: 'handled_success', diagnostic }
    : { kind: 'handled_failure', typedReason: result.typedReason, diagnostic };
}

export async function runExperienceV3GenerateAdapter(
  input: ExperienceV3AdapterInput,
  dependencies: ExperienceV3AdapterDependencies,
): Promise<ExperienceV3AdapterResult> {
  if (classifyExperienceV3Routing(input) === 'not_applicable') {
    return { kind: 'not_applicable' };
  }

  let snapshot: ExperienceV3OperationSnapshot;
  try {
    snapshot = captureExperienceV3OperationSnapshot(input);
  } catch (error) {
    return withTerminalDiagnostic(input, dependencies, {
      kind: 'handled_failure',
      typedReason: error instanceof Error ? error.message : 'snapshot_capture_failed',
    }, undefined, false);
  }

  let rawResponse: unknown;
  try {
    rawResponse = await dependencies.request({
      action: EXPERIENCE_V3_GENERATE_ACTION,
      manifest: snapshot.manifest,
    });
  } catch (error) {
    return withTerminalDiagnostic(input, dependencies, {
      kind: 'handled_failure',
      typedReason: error instanceof Error && error.message ? error.message : 'provider_request_failed',
    }, undefined, false);
  }

  const response = parseExperienceV3SuccessResponse(rawResponse);
  if (!response) {
    return withTerminalDiagnostic(input, dependencies, {
      kind: 'handled_failure',
      typedReason: failureReasonFromResponse(rawResponse),
    }, rawResponse, true);
  }
  try {
    if (!responseMatchesExperienceV3Snapshot(response, snapshot)) {
      return withTerminalDiagnostic(input, dependencies, {
        kind: 'handled_failure',
        typedReason: 'candidate_or_validation_mismatch',
      }, rawResponse, true);
    }
    return withTerminalDiagnostic(
      input,
      dependencies,
      applyExperienceV3Transaction(snapshot, response, dependencies),
      rawResponse,
      true,
    );
  } catch {
    return withTerminalDiagnostic(input, dependencies, {
      kind: 'handled_failure',
      typedReason: 'client_verification_exception',
    }, rawResponse, true);
  }
}
