import type { CVData, WorkExperience } from '../types';
import { buildExperienceAiOutputProvenance } from '../cv-experience-ai-output-provenance';
import { createCandidateEnvelope } from './candidate-envelope';
import type {
  AiCoreV3CandidateEnvelope,
  ExperienceFact,
  StructuredDate,
  StructuredEmploymentDates,
} from './contracts';
import { createExperienceFactManifest } from './experience-manifest';
import { immutableCopy } from './immutability';
import { createSourceAuthoritySnapshot } from './source-authority';
import type { AggregateValidationResult } from './validators';
import {
  EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_MARKER,
  EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_REVISION,
  parseExperienceV3DiagnosticEvidence,
  parseExperienceV3InternalRejectionAudit,
  unavailableExperienceV3DiagnosticEvidence,
  type ExperienceV3AdapterResult,
  type ExperienceV3DiagnosticAttempt,
  type ExperienceV3InternalRejectionAudit,
  type ExperienceV3TerminalDiagnostic,
} from './experience-generate';

export const EXPERIENCE_V3_ENHANCE_ACTION = 'experience_v3_enhance' as const;

export const EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS = [
  'grammar_correction',
  'clarity_improvement',
  'safe_concision',
  'professional_phrasing',
  'tense_correction',
  'perspective_correction',
] as const;

export type ExperienceV3EnhanceMaterialityKind =
  (typeof EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS)[number];

export type ExperienceV3EnhanceRoutingResult =
  | { readonly kind: 'not_applicable' }
  | { readonly kind: 'handled_success' }
  | { readonly kind: 'handled_failure'; readonly typedReason: string };

export interface ExperienceV3EnhanceProviderUnit {
  readonly factId: string;
  readonly text: string;
}

export interface ExperienceV3EnhanceProviderOutput {
  readonly operationId: string;
  readonly entryId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly units: readonly ExperienceV3EnhanceProviderUnit[];
}

export interface ExperienceV3EnhanceMaterialityEvidence {
  readonly status: 'material';
  readonly kind: ExperienceV3EnhanceMaterialityKind;
  readonly sourceEquivalent: false;
  readonly degradationDetected: false;
}

export interface ExperienceV3EnhanceSuccessResponse {
  readonly ok: true;
  readonly action: typeof EXPERIENCE_V3_ENHANCE_ACTION;
  readonly providerOutput: ExperienceV3EnhanceProviderOutput;
  readonly candidate: AiCoreV3CandidateEnvelope;
  readonly validation: AggregateValidationResult;
  readonly materiality: ExperienceV3EnhanceMaterialityEvidence;
  readonly diagnosticEvidence?: ReturnType<typeof unavailableExperienceV3DiagnosticEvidence>;
}

export interface ExperienceV3EnhanceFailureResponse {
  readonly ok: false;
  readonly action: typeof EXPERIENCE_V3_ENHANCE_ACTION;
  readonly typedReason: string;
  readonly validation?: AggregateValidationResult;
  readonly diagnosticEvidence?: ReturnType<typeof unavailableExperienceV3DiagnosticEvidence>;
  readonly internalRejectionAudit?: ExperienceV3InternalRejectionAudit;
}

export type ExperienceV3EnhanceResponse =
  | ExperienceV3EnhanceSuccessResponse
  | ExperienceV3EnhanceFailureResponse;

export interface ExperienceV3EnhanceOperationSnapshot {
  readonly operationId: string;
  readonly requestId: string;
  readonly entryId: string;
  readonly entryIndexDiagnostic: number;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactSourceText: string;
  readonly rawSourceHash: string;
  readonly normalizedSourceHash: string;
  readonly sourceUnits: readonly string[];
  readonly sourceUnitHashes: readonly string[];
  readonly requiredFactIds: readonly string[];
  readonly requiredFactSetHash: string;
  readonly roleTitle: string;
  readonly company: string;
  readonly employmentState: 'present' | 'completed';
  readonly rawStartDate: string;
  readonly rawEndDate: string;
  readonly dates: StructuredEmploymentDates;
  readonly industry: string;
  readonly level: string;
  readonly gender: string;
  readonly jobContextHash: string;
  readonly targetEntryContextHash: string;
  readonly cvSnapshotHash: string;
  readonly formSnapshotHash: string;
  readonly usageCountBefore: number;
  readonly sourceAuthority: ReturnType<typeof createSourceAuthoritySnapshot>;
  readonly manifest: ReturnType<typeof createExperienceFactManifest>;
}

export interface ExperienceV3EnhanceAdapterInput {
  readonly enabled: boolean;
  readonly operationKind: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly entryId: string;
  readonly entryIndexDiagnostic: number;
  readonly cv: CVData;
  readonly industry: string;
  readonly level: string;
  readonly gender: string;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleDescription: string;
  readonly jobContextHash: string;
  readonly usageCountBefore: number;
}

export interface ExperienceV3EnhanceLiveState {
  readonly cv: CVData;
  readonly requestedLocale: string;
  readonly uiLocale: string;
  readonly storedContentLocale: string;
  readonly exactVisibleDescription: string;
  readonly industry: string;
  readonly level: string;
  readonly jobContextHash: string;
}

export interface ExperienceV3EnhanceAdapterDependencies {
  readonly request: (request: {
    readonly action: typeof EXPERIENCE_V3_ENHANCE_ACTION;
    readonly manifest: ExperienceV3EnhanceOperationSnapshot['manifest'];
  }) => Promise<unknown>;
  readonly getLiveState: () => ExperienceV3EnhanceLiveState;
  readonly getActiveOperationId: () => string;
  readonly writeCv: (next: CVData) => void;
  readonly persistCv: (next: CVData) => boolean;
  readonly incrementUsage: () => void;
  readonly getUsageCount?: () => number;
  readonly getRouteHttpStatus?: () => number | null;
}

export type ExperienceV3EnhanceAdapterResult = Extract<ExperienceV3AdapterResult, { readonly kind: 'not_applicable' }>
  | { readonly kind: 'handled_success'; readonly diagnostic: ExperienceV3TerminalDiagnostic }
  | {
    readonly kind: 'handled_failure';
    readonly typedReason: string;
    readonly diagnostic: ExperienceV3TerminalDiagnostic;
    readonly internalRejectionAudit?: ExperienceV3InternalRejectionAudit;
  };

function normalizeLocale(value: string): string {
  return String(value || '').trim().replace(/_/g, '-').toLowerCase();
}

export function normalizeExperienceV3EnhanceSource(value: string): string {
  return String(value ?? '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined';
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

export function hashExperienceV3EnhanceValue(value: unknown): string {
  const input = typeof value === 'string' ? value : stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v3e-${(hash >>> 0).toString(16).padStart(8, '0')}`;
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

function scriptMatchesLocale(text: string, locale: string): boolean {
  const letters = text.match(/\p{L}/gu) || [];
  if (letters.length === 0) return false;
  const normalized = normalizeLocale(locale).split('-')[0];
  if (normalized === 'ar') return /\p{Script=Arabic}/u.test(text);
  if (normalized === 'hi') return /\p{Script=Devanagari}/u.test(text);
  if (normalized === 'ru') return /\p{Script=Cyrillic}/u.test(text);
  if (normalized === 'ja') return /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(text);
  if (normalized === 'sr') return /[\p{Script=Latin}\p{Script=Cyrillic}]/u.test(text);
  return /\p{Script=Latin}/u.test(text);
}

export function extractExperienceV3EnhanceSourceUnits(source: string): readonly string[] {
  return Object.freeze(String(source ?? '').split(/\r?\n/u).filter((unit) => unit.trim().length > 0));
}

function entryCanCreateSnapshot(entry: WorkExperience | undefined, jobContextHash: string): boolean {
  if (!entry || !String(entry.position || '').trim() || !String(jobContextHash || '').trim()) return false;
  const start = parseStructuredDate(entry.startDate);
  const end = entry.isPresent ? null : parseStructuredDate(entry.endDate);
  return Boolean(start && (entry.isPresent || end));
}

export function classifyExperienceV3EnhanceRouting(
  input: Pick<ExperienceV3EnhanceAdapterInput,
    | 'enabled' | 'operationKind' | 'entryId' | 'cv' | 'requestedLocale' | 'uiLocale'
    | 'storedContentLocale' | 'exactVisibleDescription' | 'jobContextHash'>,
): 'not_applicable' | 'owned' {
  if (!input.enabled || input.operationKind !== 'experience_enhance') return 'not_applicable';
  const source = normalizeExperienceV3EnhanceSource(input.exactVisibleDescription);
  if (!source) return 'not_applicable';
  const requested = normalizeLocale(input.requestedLocale);
  const ui = normalizeLocale(input.uiLocale);
  const stored = normalizeLocale(input.storedContentLocale);
  if (!requested || requested !== ui || requested !== stored) return 'not_applicable';
  if (!scriptMatchesLocale(source, requested)) return 'not_applicable';
  if (!entryCanCreateSnapshot(input.cv.experience.find((entry) => entry.id === input.entryId), input.jobContextHash)) {
    return 'not_applicable';
  }
  return 'owned';
}

function targetContext(entry: WorkExperience, input: ExperienceV3EnhanceAdapterInput, dates: StructuredEmploymentDates): unknown {
  return {
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
    jobContextHash: input.jobContextHash,
  };
}

export function captureExperienceV3EnhanceOperationSnapshot(
  input: ExperienceV3EnhanceAdapterInput,
): ExperienceV3EnhanceOperationSnapshot {
  const entry = input.cv.experience.find((item) => item.id === input.entryId);
  if (!entry) throw new TypeError('target_entry_missing');
  const start = parseStructuredDate(entry.startDate);
  const end = entry.isPresent ? null : parseStructuredDate(entry.endDate);
  if (!start || (!entry.isPresent && !end)) throw new TypeError('structured_dates_invalid');
  const dates: StructuredEmploymentDates = { start, end };
  const sourceUnits = extractExperienceV3EnhanceSourceUnits(input.exactVisibleDescription);
  if (sourceUnits.length === 0) throw new TypeError('enhance_source_empty');
  const rawSourceHash = hashExperienceV3EnhanceValue(input.exactVisibleDescription);
  const normalizedSourceHash = hashExperienceV3EnhanceValue(
    normalizeExperienceV3EnhanceSource(input.exactVisibleDescription),
  );
  const sourceUnitHashes = sourceUnits.map((unit) => hashExperienceV3EnhanceValue(unit));
  const facts: ExperienceFact[] = sourceUnits.map((unit, index) => ({
    factId: `experience-enhance:${entry.id}:${index + 1}:${sourceUnitHashes[index]}`,
    text: unit,
    sourceHash: sourceUnitHashes[index],
    required: true,
  }));
  const requiredFactIds = facts.map((fact) => fact.factId);
  const requiredFactSetHash = hashExperienceV3EnhanceValue(requiredFactIds);
  const targetEntryContextHash = hashExperienceV3EnhanceValue(targetContext(entry, input, dates));
  const contextSnapshotHash = hashExperienceV3EnhanceValue({
    operationId: input.operationId,
    entryId: entry.id,
    rawSourceHash,
    normalizedSourceHash,
    requiredFactSetHash,
    targetEntryContextHash,
  });
  const sourceAuthority = createSourceAuthoritySnapshot({
    operationId: input.operationId,
    operationKind: 'experience_enhance',
    documentId: input.cv.id,
    targetEntryId: entry.id,
    sourceText: input.exactVisibleDescription,
    sourceLocale: input.storedContentLocale,
    targetLocale: input.requestedLocale,
    provenance: { origin: 'user_input', detail: 'exact_live_experience_textarea' },
    sourceHash: rawSourceHash,
    snapshotHash: contextSnapshotHash,
    employmentState: entry.isPresent ? 'present' : 'completed',
    dates,
    captureToken: hashExperienceV3EnhanceValue(`${input.operationId}:${entry.id}:${rawSourceHash}`),
  });
  const manifest = createExperienceFactManifest({
    operationId: input.operationId,
    mode: 'enhance',
    entryId: entry.id,
    locale: input.requestedLocale,
    roleTitle: entry.position,
    company: entry.company,
    employmentState: entry.isPresent ? 'present' : 'completed',
    dates,
    industry: input.industry,
    level: input.level,
    exactSourceText: input.exactVisibleDescription,
    facts,
    snapshotHash: contextSnapshotHash,
    sourceLocale: input.storedContentLocale,
    targetLocale: input.requestedLocale,
    contextHash: targetEntryContextHash,
  });

  const effectiveCv = {
    ...input.cv,
    experience: input.cv.experience.map((item) => item.id === entry.id
      ? { ...item, description: input.exactVisibleDescription }
      : item),
  };
  return immutableCopy({
    operationId: input.operationId,
    requestId: input.requestId,
    entryId: entry.id,
    entryIndexDiagnostic: input.entryIndexDiagnostic,
    requestedLocale: input.requestedLocale,
    uiLocale: input.uiLocale,
    storedContentLocale: input.storedContentLocale,
    exactSourceText: input.exactVisibleDescription,
    rawSourceHash,
    normalizedSourceHash,
    sourceUnits,
    sourceUnitHashes,
    requiredFactIds,
    requiredFactSetHash,
    roleTitle: entry.position,
    company: entry.company,
    employmentState: entry.isPresent ? 'present' as const : 'completed' as const,
    rawStartDate: entry.startDate,
    rawEndDate: entry.endDate,
    dates,
    industry: input.industry,
    level: input.level,
    gender: input.gender,
    jobContextHash: input.jobContextHash,
    targetEntryContextHash,
    cvSnapshotHash: hashExperienceV3EnhanceValue(effectiveCv),
    formSnapshotHash: hashExperienceV3EnhanceValue({
      entryId: entry.id,
      source: input.exactVisibleDescription,
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
    }),
    usageCountBefore: input.usageCountBefore,
    sourceAuthority,
    manifest,
  }) as ExperienceV3EnhanceOperationSnapshot;
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

export function parseExperienceV3EnhanceSuccessResponse(
  value: unknown,
): ExperienceV3EnhanceSuccessResponse | null {
  if (!isRecord(value) || value.ok !== true || value.action !== EXPERIENCE_V3_ENHANCE_ACTION) return null;
  if (!isRecord(value.providerOutput) || !isRecord(value.candidate)
    || !isRecord(value.validation) || !isRecord(value.materiality)) return null;
  if (!Array.isArray(value.providerOutput.units)) return null;
  if (
    value.materiality.status !== 'material'
    || !EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS.includes(
      value.materiality.kind as ExperienceV3EnhanceMaterialityKind,
    )
    || value.materiality.sourceEquivalent !== false
    || value.materiality.degradationDetected !== false
  ) return null;
  try {
    return immutableCopy({
      ok: true as const,
      action: EXPERIENCE_V3_ENHANCE_ACTION,
      providerOutput: value.providerOutput as unknown as ExperienceV3EnhanceProviderOutput,
      candidate: createCandidateEnvelope(value.candidate as unknown as AiCoreV3CandidateEnvelope),
      validation: value.validation as unknown as AggregateValidationResult,
      materiality: value.materiality as unknown as ExperienceV3EnhanceMaterialityEvidence,
    }) as ExperienceV3EnhanceSuccessResponse;
  } catch {
    return null;
  }
}

function candidateText(units: readonly ExperienceV3EnhanceProviderUnit[]): string {
  return units.map((unit) => `• ${unit.text}`).join('\n');
}

export function responseMatchesExperienceV3EnhanceSnapshot(
  response: ExperienceV3EnhanceSuccessResponse,
  snapshot: ExperienceV3EnhanceOperationSnapshot,
): boolean {
  const output = response.providerOutput;
  const candidate = response.candidate;
  return hasExplicitAccept(response.validation)
    && output.operationId === snapshot.operationId
    && output.entryId === snapshot.entryId
    && output.snapshotHash === snapshot.manifest.snapshotHash
    && normalizeLocale(output.locale) === normalizeLocale(snapshot.requestedLocale)
    && output.units.length === snapshot.requiredFactIds.length
    && output.units.every((unit, index) => unit.factId === snapshot.requiredFactIds[index] && unit.text.length > 0)
    && candidate.operationId === snapshot.operationId
    && candidate.operationKind === 'experience_enhance'
    && candidate.sourceSnapshotHash === snapshot.manifest.snapshotHash
    && normalizeLocale(candidate.targetLocale) === normalizeLocale(snapshot.requestedLocale)
    && candidate.text === candidateText(output.units)
    && candidate.units?.length === snapshot.requiredFactIds.length
    && candidate.units.every((unit, index) => (
      unit.entryId === snapshot.entryId
      && unit.text === output.units[index].text
      && unit.factIds?.length === 1
      && unit.factIds[0] === snapshot.requiredFactIds[index]
    ));
}

function liveStateMatchesSnapshot(
  live: ExperienceV3EnhanceLiveState,
  snapshot: ExperienceV3EnhanceOperationSnapshot,
): boolean {
  const entry = live.cv.experience.find((item) => item.id === snapshot.entryId);
  if (!entry) return false;
  const contextHash = hashExperienceV3EnhanceValue({
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
    jobContextHash: live.jobContextHash,
  });
  return live.exactVisibleDescription === snapshot.exactSourceText
    && hashExperienceV3EnhanceValue(live.exactVisibleDescription) === snapshot.rawSourceHash
    && hashExperienceV3EnhanceValue(normalizeExperienceV3EnhanceSource(live.exactVisibleDescription))
      === snapshot.normalizedSourceHash
    && normalizeLocale(live.requestedLocale) === normalizeLocale(snapshot.requestedLocale)
    && normalizeLocale(live.uiLocale) === normalizeLocale(snapshot.uiLocale)
    && normalizeLocale(live.storedContentLocale) === normalizeLocale(snapshot.storedContentLocale)
    && live.industry === snapshot.industry
    && live.level === snapshot.level
    && live.jobContextHash === snapshot.jobContextHash
    && entry.position === snapshot.roleTitle
    && entry.company === snapshot.company
    && entry.startDate === snapshot.rawStartDate
    && entry.endDate === snapshot.rawEndDate
    && (entry.isPresent ? 'present' : 'completed') === snapshot.employmentState
    && contextHash === snapshot.targetEntryContextHash;
}

function valueWithoutKeys<T extends Record<string, unknown>>(value: T, keys: readonly string[]): Record<string, unknown> {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

const EXPERIENCE_V3_ENHANCE_WRITABLE_KEYS = [
  'description',
  'generatedDescription',
  'generatedLocale',
  'descriptionOrigin',
  'aiOutputProvenance',
] as const;

function nonTargetCvState(cv: CVData, entryId: string): unknown {
  return {
    root: valueWithoutKeys(cv as unknown as Record<string, unknown>, ['experience']),
    otherEntries: [...cv.experience.filter((entry) => entry.id !== entryId)]
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function targetNonWritableState(entry: WorkExperience): unknown {
  return valueWithoutKeys(entry as unknown as Record<string, unknown>, EXPERIENCE_V3_ENHANCE_WRITABLE_KEYS);
}

function rollbackState(
  before: CVData,
  dependencies: Pick<ExperienceV3EnhanceAdapterDependencies, 'getLiveState' | 'writeCv'>,
): boolean {
  try {
    dependencies.writeCv(before);
    return hashExperienceV3EnhanceValue(dependencies.getLiveState().cv) === hashExperienceV3EnhanceValue(before);
  } catch {
    return false;
  }
}

export function applyExperienceV3EnhanceTransaction(
  snapshot: ExperienceV3EnhanceOperationSnapshot,
  response: ExperienceV3EnhanceSuccessResponse,
  dependencies: Pick<ExperienceV3EnhanceAdapterDependencies,
    'getLiveState' | 'getActiveOperationId' | 'writeCv' | 'persistCv' | 'incrementUsage'>,
): Exclude<ExperienceV3EnhanceRoutingResult, { kind: 'not_applicable' }> {
  const liveBefore = dependencies.getLiveState();
  if (dependencies.getActiveOperationId() !== snapshot.operationId) {
    return { kind: 'handled_failure', typedReason: 'operation_superseded' };
  }
  if (!liveStateMatchesSnapshot(liveBefore, snapshot)) {
    return { kind: 'handled_failure', typedReason: 'stale_snapshot' };
  }
  const liveEntry = liveBefore.cv.experience.find((entry) => entry.id === snapshot.entryId);
  if (!liveEntry) return { kind: 'handled_failure', typedReason: 'target_entry_deleted' };
  const beforeEntry = { ...liveEntry, description: snapshot.exactSourceText };
  const before: CVData = {
    ...liveBefore.cv,
    experience: liveBefore.cv.experience.map((entry) => entry.id === snapshot.entryId ? beforeEntry : entry),
  };
  const provenance = buildExperienceAiOutputProvenance({
    experienceEntryId: snapshot.entryId,
    appliedOutput: response.candidate.text,
    preAiFactText: snapshot.exactSourceText,
    sourceLocale: snapshot.storedContentLocale,
    targetLocale: snapshot.requestedLocale,
    operationMode: 'enhance',
    sourceAuthorityKind: 'current_textarea',
    requestHash: `m3:${snapshot.operationId}:${snapshot.rawSourceHash}:${hashExperienceV3EnhanceValue(response.candidate.text)}:${snapshot.requiredFactSetHash}`,
    generatedFromEmpty: false,
  });
  const nextEntry: WorkExperience = {
    ...beforeEntry,
    description: response.candidate.text,
    generatedDescription: response.candidate.text,
    generatedLocale: snapshot.requestedLocale,
    descriptionOrigin: 'ai_generated',
    aiOutputProvenance: provenance,
  };
  const next: CVData = {
    ...before,
    experience: before.experience.map((entry) => entry.id === snapshot.entryId ? nextEntry : entry),
  };

  try {
    dependencies.writeCv(next);
  } catch {
    rollbackState(before, dependencies);
    return { kind: 'handled_failure', typedReason: 'state_write_failed' };
  }
  let readback: CVData;
  try {
    readback = dependencies.getLiveState().cv;
  } catch {
    const rolledBack = rollbackState(before, dependencies);
    return { kind: 'handled_failure', typedReason: rolledBack ? 'visible_readback_failed' : 'rollback_failed' };
  }
  const readbackEntry = readback.experience.find((entry) => entry.id === snapshot.entryId);
  const readbackPassed = Boolean(readbackEntry)
    && readbackEntry?.id === snapshot.entryId
    && readbackEntry.description === response.candidate.text
    && readbackEntry.generatedDescription === response.candidate.text
    && normalizeLocale(readbackEntry.generatedLocale || '') === normalizeLocale(snapshot.requestedLocale)
    && readbackEntry.descriptionOrigin === 'ai_generated'
    && hashExperienceV3EnhanceValue(readbackEntry.description) === hashExperienceV3EnhanceValue(response.candidate.text)
    && response.providerOutput.units.length === snapshot.requiredFactIds.length
    && new Set(response.providerOutput.units.map((unit) => unit.factId)).size === snapshot.requiredFactIds.length
    && response.providerOutput.units.every((unit, index) => unit.factId === snapshot.requiredFactIds[index])
    && scriptMatchesLocale(readbackEntry.description, snapshot.requestedLocale)
    && hashExperienceV3EnhanceValue(readbackEntry.aiOutputProvenance) === hashExperienceV3EnhanceValue(provenance)
    && hashExperienceV3EnhanceValue(nonTargetCvState(readback, snapshot.entryId))
      === hashExperienceV3EnhanceValue(nonTargetCvState(before, snapshot.entryId))
    && hashExperienceV3EnhanceValue(targetNonWritableState(readbackEntry))
      === hashExperienceV3EnhanceValue(targetNonWritableState(beforeEntry));
  if (!readbackPassed) {
    const rolledBack = rollbackState(before, dependencies);
    return { kind: 'handled_failure', typedReason: rolledBack ? 'visible_readback_failed' : 'rollback_failed' };
  }

  let persisted = false;
  try {
    persisted = dependencies.persistCv(readback);
  } catch {
    persisted = false;
  }
  if (!persisted) {
    const rolledBack = rollbackState(before, dependencies);
    return { kind: 'handled_failure', typedReason: rolledBack ? 'persistence_failed' : 'rollback_failed' };
  }
  try {
    dependencies.incrementUsage();
  } catch {
    rollbackState(before, dependencies);
    try {
      dependencies.persistCv(before);
    } catch {
      // The failure remains terminal; V2 is never a recovery path for an owned operation.
    }
    return { kind: 'handled_failure', typedReason: 'usage_increment_failed' };
  }
  return { kind: 'handled_success' };
}

function failureReasonFromResponse(value: unknown): string {
  return isRecord(value) && typeof value.typedReason === 'string' && value.typedReason.trim()
    ? value.typedReason
    : 'invalid_v3_enhance_response';
}

function terminalReason(value: string): string {
  return /^[a-z][a-z0-9_]{0,63}$/u.test(value) ? value : 'invalid_v3_enhance_response';
}

function responseValidation(value: unknown): AggregateValidationResult | null {
  return isRecord(value) && isRecord(value.validation) && isRecord(value.validation.phases)
    ? value.validation as unknown as AggregateValidationResult
    : null;
}

function responseEvidence(value: unknown): ReturnType<typeof unavailableExperienceV3DiagnosticEvidence> {
  return isRecord(value) ? parseExperienceV3DiagnosticEvidence(value.diagnosticEvidence)
    ?? unavailableExperienceV3DiagnosticEvidence()
    : unavailableExperienceV3DiagnosticEvidence();
}

function m3Attempts(reason: string, accepted: boolean): {
  writer: ExperienceV3DiagnosticAttempt; evaluator: ExperienceV3DiagnosticAttempt;
} {
  const none: ExperienceV3DiagnosticAttempt = { attempted: false, result: 'not_attempted' };
  const ok: ExperienceV3DiagnosticAttempt = { attempted: true, result: 'succeeded' };
  if (accepted || ['candidate_or_validation_mismatch', 'operation_superseded', 'stale_snapshot', 'target_entry_deleted', 'state_write_failed', 'visible_readback_failed', 'rollback_failed', 'persistence_failed', 'usage_increment_failed', 'client_verification_exception'].includes(reason)) return { writer: ok, evaluator: ok };
  if (reason === 'provider_request_failed' || reason === 'writer_request_failed') return { writer: { attempted: true, result: 'failed' }, evaluator: none };
  if (reason === 'provider_output_malformed' || [
    'writer_max_tokens',
    'writer_tool_missing',
    'writer_multiple_tools',
    'writer_wrong_tool',
    'writer_unexpected_text_block',
    'writer_tool_input_malformed',
    'writer_identity_mismatch',
  ].includes(reason)) return { writer: { attempted: true, result: 'malformed' }, evaluator: none };
  if (reason === 'structural_validation_failed') return { writer: ok, evaluator: none };
  if (reason === 'validator_exception') return { writer: ok, evaluator: { attempted: true, result: 'failed' } };
  if (['evaluator_max_tokens', 'evaluator_tool_missing', 'evaluator_multiple_tools', 'evaluator_wrong_tool', 'evaluator_unexpected_text_block', 'evaluator_tool_input_malformed', 'evaluator_identity_mismatch', 'evaluator_output_malformed'].includes(reason)) return { writer: ok, evaluator: { attempted: true, result: 'malformed' } };
  if (['validation_rejected', 'materiality_degraded', 'no_material_improvement'].includes(reason)) return { writer: ok, evaluator: ok };
  return { writer: { attempted: null, result: 'unknown' }, evaluator: { attempted: null, result: 'unknown' } };
}

function buildM3TerminalDiagnostic(
  input: ExperienceV3EnhanceAdapterInput,
  dependencies: ExperienceV3EnhanceAdapterDependencies,
  result: Exclude<ExperienceV3EnhanceRoutingResult, { kind: 'not_applicable' }>,
  rawResponse: unknown,
): ExperienceV3TerminalDiagnostic {
  const accepted = result.kind === 'handled_success';
  const reason = terminalReason(accepted ? 'none' : result.typedReason);
  const evidence = responseEvidence(rawResponse);
  const validation = responseValidation(rawResponse);
  const snapshot = (() => { try { return captureExperienceV3EnhanceOperationSnapshot(input); } catch { return null; } })();
  const entry = input.cv.experience.find((item) => item.id === input.entryId);
  const routeHttpStatus = (() => { try { const status = dependencies.getRouteHttpStatus?.(); return typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null; } catch { return null; } })();
  const usageAfter = (() => { try { const count = dependencies.getUsageCount?.(); return Number.isFinite(count) ? Number(count) : input.usageCountBefore + (accepted ? 1 : 0); } catch { return input.usageCountBefore + (accepted ? 1 : 0); } })();
  const transportFailure = reason === 'provider_request_failed' || reason === 'validator_exception'
    || (routeHttpStatus !== null && routeHttpStatus >= 500);
  const materiality = isRecord(rawResponse) && isRecord(rawResponse.materiality) ? rawResponse.materiality : null;
  const attempts = m3Attempts(reason, accepted);
  return immutableCopy({
    schemaVersion: 1 as const,
    marker: EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_MARKER,
    revision: EXPERIENCE_V3_TERMINAL_DIAGNOSTIC_REVISION,
    capturedAt: new Date().toISOString(),
    operation: EXPERIENCE_V3_ENHANCE_ACTION,
    requestIdHash: hashExperienceV3EnhanceValue(input.requestId),
    operationIdHash: hashExperienceV3EnhanceValue(input.operationId),
    stableEntryIdHash: hashExperienceV3EnhanceValue(input.entryId),
    requestedLocale: normalizeLocale(input.requestedLocale),
    uiLocale: normalizeLocale(input.uiLocale),
    contentLocale: normalizeLocale(input.storedContentLocale),
    sourceWasEmpty: false,
    normalizedIndustry: String(input.industry || '').trim().toLowerCase() || 'unknown',
    normalizedLevel: String(input.level || '').trim().toLowerCase() || 'unknown',
    employmentState: entry ? (entry.isPresent ? 'present' as const : 'completed' as const) : 'unknown' as const,
    ownershipResult: 'owned' as const,
    routeHttpStatus,
    writer: attempts.writer,
    evaluator: attempts.evaluator,
    phases: {
      structural: validation?.phases.structural?.status ?? 'not_evaluated',
      semantic: validation?.phases.semantic?.status ?? 'not_evaluated',
      language_quality: validation?.phases.language_quality?.status ?? 'not_evaluated',
    },
    rejectionReasonCodes: accepted ? [] : [reason as ExperienceV3TerminalDiagnostic['rejectionReasonCodes'][number]],
    finalDecision: accepted ? 'accept' as const : transportFailure ? 'transport_failure' as const : 'reject' as const,
    applyAuthorized: accepted,
    applyAttempted: accepted,
    applyCommitted: accepted,
    v2FallthroughCount: 0 as const,
    usageBefore: input.usageCountBefore,
    usageAfter,
    usageDelta: usageAfter - input.usageCountBefore,
    raceGuardResult: ['operation_superseded', 'stale_snapshot', 'target_entry_deleted'].includes(reason) ? 'failed' as const : accepted ? 'passed' as const : 'not_evaluated' as const,
    sourceCommitMarker: /^[0-9a-f]{7,40}$/u.test(String(process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT || '')) ? String(process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT).slice(0, 7) : null,
    buildChannel: String(process.env.NEXT_PUBLIC_BUILD_CHANNEL || '').trim() || null,
    ...evidence,
    sourceHash: snapshot?.rawSourceHash ?? hashExperienceV3EnhanceValue(input.exactVisibleDescription),
    sourceUnitCount: snapshot?.sourceUnits.length ?? extractExperienceV3EnhanceSourceUnits(input.exactVisibleDescription).length,
    sourceUnitHashes: snapshot?.sourceUnitHashes ?? extractExperienceV3EnhanceSourceUnits(input.exactVisibleDescription).map(hashExperienceV3EnhanceValue),
    sourceUnitLengths: snapshot?.sourceUnits.map((unit) => unit.length) ?? extractExperienceV3EnhanceSourceUnits(input.exactVisibleDescription).map((unit) => unit.length),
    materialityStatus: materiality?.status === 'material' || materiality?.status === 'no_op' || materiality?.status === 'degraded' ? materiality.status : 'unknown',
    materialityKind: typeof materiality?.kind === 'string' ? materiality.kind : null,
    degradationResult: typeof materiality?.degradationDetected === 'boolean' ? materiality.degradationDetected : null,
    persistenceResult: accepted ? 'succeeded' as const : 'not_attempted' as const,
  }) as ExperienceV3TerminalDiagnostic;
}

function withM3TerminalDiagnostic(
  input: ExperienceV3EnhanceAdapterInput,
  dependencies: ExperienceV3EnhanceAdapterDependencies,
  result: Exclude<ExperienceV3EnhanceRoutingResult, { kind: 'not_applicable' }>,
  rawResponse: unknown,
): ExperienceV3EnhanceAdapterResult {
  const diagnostic = buildM3TerminalDiagnostic(input, dependencies, result, rawResponse);
  const internalRejectionAudit = result.kind === 'handled_failure' && isRecord(rawResponse)
    ? parseExperienceV3InternalRejectionAudit(rawResponse.internalRejectionAudit)
    : null;
  return result.kind === 'handled_success'
    ? { kind: 'handled_success', diagnostic }
    : { kind: 'handled_failure', typedReason: result.typedReason, diagnostic, ...(internalRejectionAudit ? { internalRejectionAudit } : {}) };
}

export async function runExperienceV3EnhanceAdapter(
  input: ExperienceV3EnhanceAdapterInput,
  dependencies: ExperienceV3EnhanceAdapterDependencies,
): Promise<ExperienceV3EnhanceAdapterResult> {
  if (classifyExperienceV3EnhanceRouting(input) === 'not_applicable') {
    return { kind: 'not_applicable' };
  }
  let snapshot: ExperienceV3EnhanceOperationSnapshot;
  try {
    snapshot = captureExperienceV3EnhanceOperationSnapshot(input);
  } catch (error) {
    return withM3TerminalDiagnostic(input, dependencies, { kind: 'handled_failure', typedReason: error instanceof Error ? error.message : 'snapshot_capture_failed' }, undefined);
  }
  let rawResponse: unknown;
  try {
    rawResponse = await dependencies.request({
      action: EXPERIENCE_V3_ENHANCE_ACTION,
      manifest: snapshot.manifest,
    });
  } catch (error) {
    return withM3TerminalDiagnostic(input, dependencies, {
      kind: 'handled_failure',
      typedReason: error instanceof Error && error.message ? error.message : 'provider_request_failed',
    }, undefined);
  }
  const response = parseExperienceV3EnhanceSuccessResponse(rawResponse);
  if (!response) return withM3TerminalDiagnostic(input, dependencies, { kind: 'handled_failure', typedReason: failureReasonFromResponse(rawResponse) }, rawResponse);
  try {
    if (!responseMatchesExperienceV3EnhanceSnapshot(response, snapshot)) {
      return withM3TerminalDiagnostic(input, dependencies, { kind: 'handled_failure', typedReason: 'candidate_or_validation_mismatch' }, rawResponse);
    }
    return withM3TerminalDiagnostic(input, dependencies, applyExperienceV3EnhanceTransaction(snapshot, response, dependencies), rawResponse);
  } catch {
    return withM3TerminalDiagnostic(input, dependencies, { kind: 'handled_failure', typedReason: 'client_verification_exception' }, rawResponse);
  }
}
