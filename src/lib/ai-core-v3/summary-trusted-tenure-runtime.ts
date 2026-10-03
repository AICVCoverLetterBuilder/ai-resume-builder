import { findExactDurationMeasurements, type ExactDurationMeasurement } from './exact-duration-measurement';
import { immutableCopy } from './immutability';
import { hashSummaryV3StyleValue, normalizeSummaryV3StyleText, normalizeSummaryV3StyleNumericSurface, summaryV3StyleSourceUnitTexts,
  type SummaryV3StyleOperationSnapshot } from './summary-style-m5';
import type { SummaryEmploymentTenureRelation, SummaryTenureResolution } from './summary-employment-tenure-relation';

type Slot = Readonly<{
  relation: SummaryEmploymentTenureRelation;
  source: ExactDurationMeasurement;
  prefix: string;
  suffix: string;
  sourceUnitIndex: number;
  currentMonths: number;
  stale: boolean;
}>;
export type TrustedEmploymentTenureRuntimeAuthority = Readonly<{
  fingerprint: string;
  sourceSummary: string;
  sourceFacts: SummaryV3StyleOperationSnapshot['requiredFacts'];
  slots: readonly Slot[];
  claimSlotResolved: boolean;
}>;
const authorities = new WeakMap<SummaryV3StyleOperationSnapshot, TrustedEmploymentTenureRuntimeAuthority>();

// Position in the existing NFKC/whitespace-canonical text, without an inferred
// semantic referent. Task082 owns the ORIGINAL UTF-16 measurement coordinates.
function canonicalStart(text: string, start: number): number {
  const prefix = text.slice(0, start);
  return normalizeSummaryV3StyleText(prefix).length + (/\s$/u.test(prefix) && prefix.trim() ? 1 : 0);
}
function occurrences(text: string, literal: string): readonly number[] {
  const hits: number[] = [];
  if (!literal) return hits;
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(literal, from);
    if (at < 0) break;
    hits.push(at);
    from = at + 1;
  }
  return hits;
}

/** ONE authority: exact source unit + exact masked prefix/suffix. No role NLP,
 * candidate fact-ID assertion, proximity, first/nearest duration or formatter.
 * A nonunique or multiply-owned source unit supplies no refresh permission.
 */
export function bindTrustedEmploymentTenureRuntime(
  snapshot: SummaryV3StyleOperationSnapshot,
  resolution: SummaryTenureResolution,
): SummaryV3StyleOperationSnapshot {
  if (resolution.status !== 'valid' || resolution.relations.length === 0
    || snapshot.style !== 'stronger' || snapshot.mode !== 'enhance_existing_content') return snapshot;
  const text = normalizeSummaryV3StyleText(snapshot.sourceSummary);
  const units = summaryV3StyleSourceUnitTexts(snapshot.sourceSummary);
  const measurements = findExactDurationMeasurements(snapshot.sourceSummary);
  const slots: Slot[] = [];
  const used = new Set<string>();
  let resolved = true;
  for (const relation of resolution.relations) {
    const source = measurements.find((m) => m.start === relation.durationSpanStart && m.end === relation.durationSpanEnd);
    const entry = snapshot.selectedEntries.find((e) => e.stableId === `entry-${hashSummaryV3StyleValue(relation.experienceStableId)}`);
    if (!source || !entry) { resolved = false; break; }
    // Closed employment never enters Task084's CURRENT runtime permission.
    // Its existing source, candidate guards and provider contract stay intact.
    if (entry.employmentState !== 'present') continue;
    const start = canonicalStart(snapshot.sourceSummary, source.start);
    const surface = normalizeSummaryV3StyleText(snapshot.sourceSummary.slice(source.start, source.end));
    const matches = units.flatMap((unit) => occurrences(text, unit).map((at) => ({ unit, at })))
      .filter(({ unit, at }) => at <= start && start + surface.length <= at + unit.length);
    if (matches.length !== 1 || used.has(matches[0]!.unit)) { resolved = false; break; }
    const { unit, at } = matches[0]!;
    if (text.slice(start, start + surface.length) !== surface) { resolved = false; break; }
    used.add(unit);
    slots.push({ relation, source, prefix: unit.slice(0, start - at), suffix: unit.slice(start - at + surface.length),
      sourceUnitIndex: units.indexOf(unit),
      currentMonths: entry.durationMonths, stale: source.totalMonths !== entry.durationMonths });
  }
  if (resolved && slots.length === 0) return snapshot;
  const authority = immutableCopy({
    sourceSummary: snapshot.sourceSummary, sourceFacts: snapshot.requiredFacts,
    fingerprint: hashSummaryV3StyleValue(JSON.stringify({
      summaryHash: snapshot.sourceSummaryHash, manifestHash: snapshot.manifestHash, relations: resolution.relations,
    })), slots: resolved ? slots : [], claimSlotResolved: resolved,
  });
  const bound = immutableCopy({ ...snapshot,
    // Non-stale relations have no provider-envelope delta. Their immutable
    // response/apply identity still carries the same local fingerprint.
    snapshotHash: slots.some((slot) => slot.stale)
      ? hashSummaryV3StyleValue(`${snapshot.snapshotHash}:trusted-tenure:${authority.fingerprint}`) : snapshot.snapshotHash,
  });
  authorities.set(bound, authority);
  return bound;
}

export function trustedEmploymentTenureAuthority(snapshot: SummaryV3StyleOperationSnapshot) {
  return authorities.get(snapshot) ?? null;
}

/** Candidate text, not provider-supplied coordinates, yields exactly one
 * continuation of each literal masked source unit. Only Task082 equality to
 * the SAME immutable entry's current month count permits replacement.
 */
export function validateTrustedTenureCandidate(snapshot: SummaryV3StyleOperationSnapshot, candidate: string):
  Readonly<{ valid: boolean; continuations: readonly SummaryEmploymentTenureRelation[];
    measurements: readonly ExactDurationMeasurement[] }> {
  const authority = authorities.get(snapshot);
  if (!authority) return { valid: true, continuations: [], measurements: [] };
  if (!authority.claimSlotResolved) return { valid: false, continuations: [], measurements: [] };
  const normalized = normalizeSummaryV3StyleText(candidate);
  const units = summaryV3StyleSourceUnitTexts(candidate);
  const measurements = findExactDurationMeasurements(candidate);
  const chosen: ExactDurationMeasurement[] = [];
  const continuations: SummaryEmploymentTenureRelation[] = [];
  for (const slot of authority.slots) {
    const matches = measurements.filter((m) => {
      if (m.totalMonths !== slot.currentMonths) return false;
      const start = canonicalStart(candidate, m.start);
      const surface = normalizeSummaryV3StyleText(candidate.slice(m.start, m.end));
      const expected = slot.prefix + surface + slot.suffix;
      const hits = units.flatMap((unit) => unit === expected ? occurrences(normalized, unit) : []);
      return hits.length === 1 && hits[0]! + slot.prefix.length === start;
    });
    if (matches.length !== 1 || chosen.some((m) => m.start === matches[0]!.start)) {
      return { valid: false, continuations: [], measurements: [] };
    }
    const m = matches[0]!;
    chosen.push(m);
    continuations.push({ ...slot.relation, summaryHash: hashSummaryV3StyleValue(candidate),
      durationSpanStart: m.start, durationSpanEnd: m.end,
      durationSpanHash: hashSummaryV3StyleValue(candidate.slice(m.start, m.end)) });
  }
  return immutableCopy({ valid: true, continuations, measurements: chosen });
}

/** Comparison-only view. Never persists, formats, rewrites or sends prose.
 * Uses the candidate's already validated complete locale-native measurement;
 * the exact source slot is the only replaceable text. All original fact IDs,
 * identity locks, manifest and operation fingerprints remain authoritative.
 */
export function trustedTenureCandidateComparison(
  snapshot: SummaryV3StyleOperationSnapshot, candidate: string,
): SummaryV3StyleOperationSnapshot | null {
  const authority = authorities.get(snapshot);
  if (!authority) return snapshot;
  const validation = validateTrustedTenureCandidate(snapshot, candidate);
  if (!validation.valid) return null;
  if (!authority.slots.some((slot) => slot.stale)) return snapshot;
  const canonicalSource = normalizeSummaryV3StyleText(authority.sourceSummary);
  const replacements = authority.slots.flatMap((slot, index) => slot.stale ? [{
    start: canonicalStart(authority.sourceSummary, slot.source.start),
    old: normalizeSummaryV3StyleText(authority.sourceSummary.slice(slot.source.start, slot.source.end)),
    value: normalizeSummaryV3StyleText(candidate.slice(validation.measurements[index]!.start, validation.measurements[index]!.end)),
  }] : []);
  const replace = (text: string, offset: number): string => {
    let next = text;
    for (const r of [...replacements].reverse()) {
      if (r.start >= offset && r.start + r.old.length <= offset + text.length) {
        const at = r.start - offset;
        if (text.slice(at, at + r.old.length) !== r.old) throw new Error('Unresolved tenure comparison');
        next = next.slice(0, at) + r.value + next.slice(at + r.old.length);
      }
    }
    return next;
  };
  const facts = authority.sourceFacts.map((fact) => {
    const offsets = occurrences(canonicalSource, fact.text);
    const overlap = offsets.filter((at) => replacements.some((r) => r.start < at + fact.text.length && r.start + r.old.length > at));
    if (overlap.length === 0) return fact;
    // Partial/multiple fact matches cannot grant a numeric or fact waiver.
    if (offsets.length !== 1 || replacements.some((r) => r.start < offsets[0]! + fact.text.length
      && r.start + r.old.length > offsets[0]!
      && !(r.start >= offsets[0]! && r.start + r.old.length <= offsets[0]! + fact.text.length))) return null;
    return { ...fact, text: replace(fact.text, offsets[0]!) };
  });
  if (facts.some((fact) => fact === null)) return null;
  const view = immutableCopy({ ...snapshot, sourceSummary: replace(canonicalSource, 0),
    requiredFacts: facts as SummaryV3StyleOperationSnapshot['requiredFacts'] });
  authorities.set(view, authority);
  return view;
}

export function trustedTenureSourceComparison(snapshot: SummaryV3StyleOperationSnapshot): SummaryV3StyleOperationSnapshot {
  const authority = authorities.get(snapshot);
  if (!authority?.claimSlotResolved || !authority.slots.some((slot) => slot.stale)) return snapshot;
  let text = authority.sourceSummary;
  for (const slot of [...authority.slots].reverse()) {
    if (slot.stale) text = text.slice(0, slot.source.start) + ' ' + text.slice(slot.source.end);
  }
  // Only numeric/role-duration source predicates use this view. The original
  // source/required facts are retained for writer, evaluator and candidate locks.
  return immutableCopy({ ...snapshot, sourceSummary: text });
}

export type SummaryTenureRemediation = Readonly<{
  type: 'employment_tenure_binding_required'; summaryHash: string;
  durationSpanStart: number; durationSpanEnd: number; durationSpanHash: string;
}>;

export function resolveSummaryTenureRemediation(value: unknown, summary: string):
  Readonly<{ remediation: SummaryTenureRemediation; measurement: ExactDurationMeasurement }> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const keys = ['type', 'summaryHash', 'durationSpanStart', 'durationSpanEnd', 'durationSpanHash'];
  if (Object.keys(r).length !== keys.length || !keys.every((k) => Object.hasOwn(r, k))
    || r.type !== 'employment_tenure_binding_required'
    || r.summaryHash !== hashSummaryV3StyleValue(summary)
    || !Number.isSafeInteger(r.durationSpanStart) || !Number.isSafeInteger(r.durationSpanEnd)) return null;
  const measurement = findExactDurationMeasurements(summary).find((m) =>
    m.start === r.durationSpanStart && m.end === r.durationSpanEnd);
  if (!measurement || r.durationSpanHash !== hashSummaryV3StyleValue(summary.slice(measurement.start, measurement.end))) return null;
  return immutableCopy({ remediation: r as SummaryTenureRemediation, measurement });
}

/** Only the captured first unmatched location may select a remediation.
 * No second numeric-membership scan; reject altered comparison-coordinate
 * topology (e.g. preceding decimal-percent substitutions) rather than guess.
 */
export function createSummaryTenureRemediation(snapshot: SummaryV3StyleOperationSnapshot,
  location: Readonly<{ source: string; start: number; end: number }>): SummaryTenureRemediation | null {
  // The winning legacy numeric scanner uses the existing lower-case numeric
  // comparison surface. Map both sides through that SAME canonical surface.
  const normalize = (text: string) => normalizeSummaryV3StyleText(normalizeSummaryV3StyleNumericSurface(text)).toLocaleLowerCase();
  if (normalize(location.source) !== normalize(snapshot.sourceSummary)) return null;
  const left = canonicalStart(location.source, location.start);
  const right = left + normalize(location.source.slice(location.start, location.end)).length;
  const matches = findExactDurationMeasurements(snapshot.sourceSummary).filter((m) => {
    const start = normalize(snapshot.sourceSummary.slice(0, m.start)).length
      + (/\s$/u.test(snapshot.sourceSummary.slice(0, m.start)) && m.start > 0 ? 1 : 0);
    return start <= left && start + normalize(snapshot.sourceSummary.slice(m.start, m.end)).length >= right;
  });
  if (matches.length !== 1 || authorities.get(snapshot)?.slots.some((slot) => slot.source.start === matches[0]!.start)) return null;
  const m = matches[0]!;
  return { type: 'employment_tenure_binding_required', summaryHash: snapshot.sourceSummaryHash,
    durationSpanStart: m.start, durationSpanEnd: m.end,
    durationSpanHash: hashSummaryV3StyleValue(snapshot.sourceSummary.slice(m.start, m.end)) };
}

/** Sanitized provider guidance, never durable CV/Experience IDs or relation hashes. */
export function trustedTenureProviderGuidance(snapshot: SummaryV3StyleOperationSnapshot) {
  const authority = authorities.get(snapshot);
  if (!authority?.claimSlotResolved) return [];
  return authority.slots.flatMap((slot) => slot.stale
    ? [{ sourceUnitIndex: slot.sourceUnitIndex, sourceUnitHash: hashSummaryV3StyleValue(slot.prefix
      + normalizeSummaryV3StyleText(authority.sourceSummary.slice(slot.source.start, slot.source.end)) + slot.suffix),
      currentDurationMonths: slot.currentMonths }]
    : []);
}
