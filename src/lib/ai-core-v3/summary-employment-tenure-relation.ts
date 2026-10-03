import type { CVData } from '../types';
import { findExactDurationMeasurements, type ExactDurationMeasurement } from './exact-duration-measurement';
import { immutableCopy } from './immutability';
import {
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  type SummaryV3StyleExperienceInput,
  type SummaryV3StyleRequest,
} from './summary-style-m5';

/** Ownership of an exact source span, NOT an assertion that its value is current. */
export interface SummaryEmploymentTenureRelation {
  readonly version: 1;
  readonly relationKind: 'employment_tenure';
  readonly cvId: string;
  readonly experienceStableId: string;
  readonly summaryHash: string;
  readonly durationSpanStart: number;
  readonly durationSpanEnd: number;
  readonly durationSpanHash: string;
}

export interface SummaryTenureContext {
  readonly cvId: string;
  readonly summary: string;
  readonly experienceStableIds: readonly string[];
}

export type SummaryTenureInvalidReason =
  | 'invalid_context' | 'invalid_collection' | 'invalid_shape'
  | 'cv_mismatch' | 'summary_mismatch' | 'experience_missing'
  | 'invalid_span' | 'span_hash_mismatch' | 'measurement_missing'
  | 'conflicting_ownership' | 'manifest_identity_mismatch' | 'invalid_snapshot';

export interface SummaryTenureResolution {
  readonly status: 'absent' | 'valid' | 'invalid';
  readonly reason: SummaryTenureInvalidReason | null;
  readonly relations: readonly SummaryEmploymentTenureRelation[];
}

const MAX_RELATIONS = 32;
const MAX_ENTRIES = 64;
const RELATION_KEYS = [
  'version', 'relationKind', 'cvId', 'experienceStableId', 'summaryHash',
  'durationSpanStart', 'durationSpanEnd', 'durationSpanHash',
] as const;
const EMPTY: readonly SummaryEmploymentTenureRelation[] = Object.freeze([]);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function identity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && value.trim() === value && !/[\p{Cc}\p{Cf}]/u.test(value);
}

function invalid(reason: SummaryTenureInvalidReason): SummaryTenureResolution {
  return Object.freeze({ status: 'invalid', reason, relations: EMPTY });
}

/** Single shape/span/ownership/conflict authority for persistence and transport. */
export function resolveSummaryEmploymentTenureRelations(
  value: unknown,
  context: SummaryTenureContext,
): SummaryTenureResolution {
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    return Object.freeze({ status: 'absent', reason: null, relations: EMPTY });
  }
  if (!Array.isArray(value) || value.length > MAX_RELATIONS) return invalid('invalid_collection');
  if (!identity(context.cvId) || typeof context.summary !== 'string' || context.summary.length > 12_000
    || !Array.isArray(context.experienceStableIds) || context.experienceStableIds.length > MAX_ENTRIES
    || !context.experienceStableIds.every(identity)
    || new Set(context.experienceStableIds).size !== context.experienceStableIds.length) {
    return invalid('invalid_context');
  }
  const summaryHash = hashSummaryV3StyleValue(context.summary);
  const measurements = findExactDurationMeasurements(context.summary);
  const unique = new Map<string, SummaryEmploymentTenureRelation>();
  for (const item of value) {
    if (!record(item) || Object.keys(item).length !== RELATION_KEYS.length
      || !RELATION_KEYS.every((key) => Object.hasOwn(item, key))
      || item.version !== 1 || item.relationKind !== 'employment_tenure'
      || !identity(item.cvId) || !identity(item.experienceStableId)
      || typeof item.summaryHash !== 'string' || typeof item.durationSpanHash !== 'string'
      || !/^m5_[0-9a-f]{8}$/u.test(item.summaryHash)
      || !/^m5_[0-9a-f]{8}$/u.test(item.durationSpanHash)) return invalid('invalid_shape');
    if (item.cvId !== context.cvId) return invalid('cv_mismatch');
    if (item.summaryHash !== summaryHash) return invalid('summary_mismatch');
    if (!context.experienceStableIds.includes(item.experienceStableId)) return invalid('experience_missing');
    const start = item.durationSpanStart, end = item.durationSpanEnd;
    if (typeof start !== 'number' || typeof end !== 'number'
      || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start < 0 || start >= end || end > context.summary.length) return invalid('invalid_span');
    if (hashSummaryV3StyleValue(context.summary.slice(start, end)) !== item.durationSpanHash) {
      return invalid('span_hash_mismatch');
    }
    // Scan the ORIGINAL whole Summary: parsing a sliced partial token alone
    // would incorrectly turn a contaminated boundary into a clean measurement.
    if (!measurements.some((measurement) => measurement.start === start && measurement.end === end)) {
      return invalid('measurement_missing');
    }
    const key = `${start}:${end}`;
    const previous = unique.get(key);
    if (previous && previous.experienceStableId !== item.experienceStableId) return invalid('conflicting_ownership');
    unique.set(key, {
      version: 1, relationKind: 'employment_tenure', cvId: item.cvId,
      experienceStableId: item.experienceStableId, summaryHash,
      durationSpanStart: start, durationSpanEnd: end, durationSpanHash: item.durationSpanHash,
    });
  }
  return immutableCopy({ status: 'valid', reason: null,
    relations: [...unique.values()].sort((a, b) => a.durationSpanStart - b.durationSpanStart),
  });
}

function cvContext(cv: CVData): SummaryTenureContext {
  return { cvId: cv.id, summary: cv.summary, experienceStableIds: cv.experience.map((entry) => entry.id) };
}

export type SummaryTenureConfirmationResult =
  | { readonly status: 'declined' }
  | { readonly status: 'invalid'; readonly reason: SummaryTenureInvalidReason }
  | { readonly status: 'created'; readonly relation: SummaryEmploymentTenureRelation;
      readonly relations: readonly SummaryEmploymentTenureRelation[] };

/** Future explicit UI action only; no selector default, inference or CV mutation.
 * Semantic authority is the user's assertion about their CV, not signed click attestation.
 */
export function createConfirmedEmploymentTenureRelation(input: {
  readonly confirmation: 'employment_tenure' | 'not_employment_tenure';
  readonly cv: CVData;
  readonly measurement: ExactDurationMeasurement;
  readonly explicitlySelectedExperienceStableId: string;
}): SummaryTenureConfirmationResult {
  if (input.confirmation === 'not_employment_tenure') return Object.freeze({ status: 'declined' });
  if (input.confirmation !== 'employment_tenure') return { status: 'invalid', reason: 'invalid_shape' };
  const { cv, measurement, explicitlySelectedExperienceStableId: selected } = input;
  if (!measurement || !findExactDurationMeasurements(cv.summary).some((found) =>
    found.start === measurement.start && found.end === measurement.end && found.totalMonths === measurement.totalMonths)) {
    return { status: 'invalid', reason: 'measurement_missing' };
  }
  const candidate: SummaryEmploymentTenureRelation = {
    version: 1, relationKind: 'employment_tenure', cvId: cv.id, experienceStableId: selected,
    summaryHash: hashSummaryV3StyleValue(cv.summary), durationSpanStart: measurement.start,
    durationSpanEnd: measurement.end,
    durationSpanHash: hashSummaryV3StyleValue(cv.summary.slice(measurement.start, measurement.end)),
  };
  const existing = cv.summaryEmploymentTenureRelations;
  if (existing !== undefined && !Array.isArray(existing)) return { status: 'invalid', reason: 'invalid_collection' };
  const result = resolveSummaryEmploymentTenureRelations([...(existing || []), candidate], cvContext(cv));
  if (result.status === 'invalid') return { status: 'invalid', reason: result.reason! };
  return immutableCopy({ status: 'created', relation: candidate, relations: result.relations });
}

/** One pruning policy: ignore/prune the entire invalid collection on canonical
 * persistence/use. Absent legacy metadata stays absent; no migration/backfill.
 */
export function pruneSummaryEmploymentTenureRelations(cv: CVData): CVData {
  if (cv.summaryEmploymentTenureRelations === undefined) return cv;
  const resolved = resolveSummaryEmploymentTenureRelations(cv.summaryEmploymentTenureRelations, cvContext(cv));
  const relations = resolved.relations;
  if (JSON.stringify(relations) === JSON.stringify(cv.summaryEmploymentTenureRelations)) return cv;
  return { ...cv, summaryEmploymentTenureRelations: relations };
}

/** Optional additive request foundation; live M5 page/route wiring waits for Task084.
 * Raw durable IDs supplement (not replace) M5's existing hashed manifest IDs.
 */
export type SummaryTenureM5Request = Omit<SummaryV3StyleRequest, 'manifest'> & {
  readonly summaryEmploymentTenure?: {
    readonly cvId: string;
    readonly relations: readonly SummaryEmploymentTenureRelation[];
  };
  readonly manifest: Omit<SummaryV3StyleRequest['manifest'], 'entries'> & {
    readonly entries: readonly (SummaryV3StyleExperienceInput & { readonly experienceStableId?: string })[];
  };
};

export function projectSummaryEmploymentTenureRequest(
  request: SummaryV3StyleRequest,
  cv: CVData,
): SummaryTenureM5Request {
  const resolved = resolveSummaryEmploymentTenureRelations(cv.summaryEmploymentTenureRelations, cvContext(cv));
  if (resolved.status !== 'valid' || request.visibleSummary !== cv.summary) return request;
  const entries = request.manifest.entries.map((entry) => {
    const matches = cv.experience.filter((experience) => entry.stableId === `entry-${hashSummaryV3StyleValue(experience.id)}`);
    return matches.length === 1 ? { ...entry, experienceStableId: matches[0]!.id } : entry;
  });
  const projected = { ...request, manifest: { ...request.manifest, entries },
    summaryEmploymentTenure: { cvId: cv.id, relations: resolved.relations } };
  // Projection cannot send invalid metadata as trusted; server revalidates independently.
  return prepareSummaryEmploymentTenureServerRequest(projected).resolution.status === 'valid'
    ? immutableCopy(projected) : request;
}

/** Independent SERVER boundary API for the additive foundation. The immutable
 * content request is returned separately: relation metadata never enters the
 * existing writer/evaluator/locks/usage path. POLICY 2: invalid metadata discarded.
 * Existing live route already drops unknown metadata; no live decision is altered.
 */
export function prepareSummaryEmploymentTenureServerRequest(request: SummaryTenureM5Request): {
  readonly contentRequest: SummaryV3StyleRequest;
  readonly resolution: SummaryTenureResolution;
} {
  const { summaryEmploymentTenure: metadata, ...content } = request;
  // Copy only content before validation; never recursively copy an unbounded
  // or unknown client metadata object. The shared authority copies eight
  // whitelisted fields only after its finite collection/shape checks pass.
  const ids = content.manifest.entries.map((entry) => entry.experienceStableId);
  const contentRequest: SummaryV3StyleRequest = immutableCopy({
    ...content, manifest: { ...content.manifest, entries: content.manifest.entries.map((entry) => {
      const { experienceStableId: _identity, ...base } = entry;
      return base;
    }) },
  });
  if (metadata === undefined) return { contentRequest, resolution: { status: 'absent', reason: null, relations: EMPTY } };
  if (!record(metadata) || Object.keys(metadata).length !== 2
    || !Object.hasOwn(metadata, 'cvId') || !Object.hasOwn(metadata, 'relations') || !identity(metadata.cvId)) {
    return { contentRequest, resolution: invalid('invalid_shape') };
  }
  try {
    const snapshot = createSummaryV3StyleOperationSnapshot(contentRequest);
    if (!Array.isArray(metadata.relations) || metadata.relations.length > MAX_RELATIONS) {
      return { contentRequest, resolution: invalid('invalid_collection') };
    }
    if (metadata.relations.length !== 0 && (ids.length > MAX_ENTRIES || !ids.every(identity)
      || new Set(ids).size !== ids.length || contentRequest.manifest.entries.some((entry, index) =>
        entry.stableId !== `entry-${hashSummaryV3StyleValue(ids[index]!)}`))) {
      return { contentRequest, resolution: invalid('manifest_identity_mismatch') };
    }
    return { contentRequest, resolution: resolveSummaryEmploymentTenureRelations(
      metadata.relations, { cvId: metadata.cvId, summary: snapshot.sourceSummary, experienceStableIds: ids as string[] },
    ) };
  } catch {
    return { contentRequest, resolution: invalid('invalid_snapshot') };
  }
}
