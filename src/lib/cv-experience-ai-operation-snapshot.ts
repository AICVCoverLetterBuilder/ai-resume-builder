/**
 * Immutable Experience AI operation snapshot.
 *
 * At AI Improvement press, one authoritative representation is frozen from the
 * latest visible textarea (preferred) and consumed by payload, FACT LOCK,
 * provider coverage, deterministic fallback, and diagnostics.
 *
 * Do not reconstruct required facts from canonical/generated/export text once
 * this snapshot exists.
 */
import type { Locale } from './i18n/translations';
import type { WorkExperience } from './types';
import { fingerprintText } from './cv-export-diagnostics';
import {
  extractSourceDutyUnits,
  normalizeSourceFactText,
  sourceFactIdentityId,
  stripDutyListPrefix,
} from './cv-source-fact-identity';

export type ExperienceAiSnapshotSourceKind =
  | 'currentTextarea'
  | 'liveUserDescription'
  | 'canonicalDescription'
  | 'originalUserDescription'
  | 'none';

export type ExperienceAiSnapshotUnit = {
  unitIndex: number;
  sourceUnitId: string;
  sourceFactIds: string[];
  rawUnit: string;
  normalizedUnit: string;
  normalizedSourceUnitHash: string;
  locale: Locale;
  operationSnapshotId: string;
};

export type ExperienceAiOperationSnapshot = {
  operationSnapshotId: string;
  requestId: string;
  /** Stable WorkExperience.id hashed into diagnostics; never use array index. */
  experienceEntryId: string;
  locale: Locale;
  jobContextHash: string;
  provenanceOrigin: ExperienceAiSnapshotSourceKind;
  /** Raw live textarea at button press (may be empty). */
  liveRawText: string;
  /** Authoritative raw text chosen for this operation (usually live). */
  authoritativeRawText: string;
  /** Shared-normalized multiline text (units joined by \\n). */
  normalizedSourceText: string;
  units: ExperienceAiSnapshotUnit[];
  unitSequenceHash: string;
  sourceUnitCount: number;
  sourceFactIds: string[];
};

export type ExperienceAiSourceStructureDiag = {
  rawSourceLength: number;
  normalizedSourceLength: number;
  listMarkerCount: number;
  newlineCount: number;
  whitespaceNormalizedHash: string;
  bulletStrippedHash: string;
  unitSequenceHash: string;
  unitCount: number;
  unitLengths: number[];
};

const LIST_MARKER_RE = /[•\u2022\u25CF\u25E6\u2013\u2014]|^\s*[-*]\s+|\d+[.)]\s+/gmu;

/**
 * Shared normalization before hashing or identity creation.
 * Strips per-line list markers, CRLF→LF, collapses blank lines / repeated spaces.
 * Does not remove material words or clauses.
 */
export function normalizeExperienceAiSourceText(raw: string): string {
  const lines = (raw || '')
    .normalize('NFKC')
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => {
      let t = line.trim();
      // Strip repeated leading list markers / numbered prefixes.
      for (let i = 0; i < 3; i += 1) {
        const next = stripDutyListPrefix(t)
          .replace(/^[-–—*]\s+/u, '')
          .replace(/^\d+[.)]\s+/u, '')
          .trim();
        if (next === t) break;
        t = next;
      }
      return t.replace(/[ \t\f\v]+/g, ' ').trim();
    })
    .filter(Boolean);
  return lines.join('\n').trim();
}

/** Stable unit sequence after shared normalization (same for plain / bullets / CRLF). */
export function experienceAiSourceUnits(raw: string): string[] {
  const normalized = normalizeExperienceAiSourceText(raw);
  return extractSourceDutyUnits(normalized);
}

export function experienceAiUnitSequenceHash(raw: string): string {
  const units = experienceAiSourceUnits(raw);
  const seq = units.map((u) => normalizeSourceFactText(u)).join('\u0001');
  return fingerprintText(seq);
}

/** True when both texts yield the same ordered normalized units. */
export function experienceAiSourcesEquivalent(a: string, b: string): boolean {
  const ua = experienceAiSourceUnits(a).map((u) => normalizeSourceFactText(u));
  const ub = experienceAiSourceUnits(b).map((u) => normalizeSourceFactText(u));
  if (ua.length !== ub.length) return false;
  if (ua.length === 0) {
    return normalizeSourceFactText(a || '') === normalizeSourceFactText(b || '');
  }
  return ua.every((u, i) => u === ub[i]);
}

export function diagnoseExperienceAiSourceStructure(raw: string): ExperienceAiSourceStructureDiag {
  const text = raw || '';
  const normalized = normalizeExperienceAiSourceText(text);
  const units = experienceAiSourceUnits(text);
  const bulletStripped = normalizeExperienceAiSourceText(text);
  return {
    rawSourceLength: text.length,
    normalizedSourceLength: normalized.length,
    listMarkerCount: (text.match(LIST_MARKER_RE) || []).length,
    newlineCount: (text.match(/\r\n|\n|\r/g) || []).length,
    whitespaceNormalizedHash: fingerprintText(text.replace(/\s+/g, ' ').trim()),
    bulletStrippedHash: fingerprintText(bulletStripped),
    unitSequenceHash: experienceAiUnitSequenceHash(text),
    unitCount: units.length,
    unitLengths: units.map((u) => u.length),
  };
}

function makeOperationSnapshotId(requestId: string, unitSequenceHash: string): string {
  return fingerprintText(`op:${requestId || 'anon'}:${unitSequenceHash}`);
}

export type CreateExperienceAiOperationSnapshotInput = {
  liveText: string;
  canonicalText?: string;
  originalText?: string;
  locale: Locale;
  requestId: string;
  jobContextHash: string;
  /** Stable WorkExperience.id — required for entry-scoped apply diagnostics. */
  experienceEntryId?: string;
};

/**
 * Freeze one immutable operation source at Experience AI button press.
 * Non-empty live textarea always wins.
 * Empty live textarea means Generation Mode — do NOT promote canonical/original
 * (those would incorrectly force Enhancement Mode against resurrected duties).
 */
export function createExperienceAiOperationSnapshot(
  input: CreateExperienceAiOperationSnapshotInput,
): ExperienceAiOperationSnapshot {
  const liveRawText = (input.liveText || '').trimEnd();
  const liveTrimmed = liveRawText.trim();

  let authoritativeRawText = '';
  let provenanceOrigin: ExperienceAiSnapshotSourceKind = 'none';

  if (liveTrimmed) {
    authoritativeRawText = liveRawText;
    provenanceOrigin = 'currentTextarea';
  }
  // Intentionally no canonical/original fallback when live is empty:
  // empty description → generate_from_job_context.

  const unitsRaw = experienceAiSourceUnits(authoritativeRawText);
  const operationSnapshotId = makeOperationSnapshotId(
    input.requestId,
    experienceAiUnitSequenceHash(authoritativeRawText),
  );
  const units: ExperienceAiSnapshotUnit[] = unitsRaw.map((rawUnit, unitIndex) => {
    const id = sourceFactIdentityId(rawUnit);
    const normalizedUnit = normalizeSourceFactText(rawUnit);
    return {
      unitIndex,
      sourceUnitId: id,
      sourceFactIds: [id],
      rawUnit,
      normalizedUnit,
      normalizedSourceUnitHash: fingerprintText(normalizedUnit),
      locale: input.locale,
      operationSnapshotId,
    };
  });

  const normalizedSourceText = units.map((u) => u.rawUnit).join('\n');
  const unitSequenceHash = experienceAiUnitSequenceHash(authoritativeRawText);

  return {
    operationSnapshotId,
    requestId: input.requestId,
    experienceEntryId: String(input.experienceEntryId || '').trim(),
    locale: input.locale,
    jobContextHash: input.jobContextHash,
    provenanceOrigin,
    liveRawText,
    authoritativeRawText,
    normalizedSourceText,
    units,
    unitSequenceHash,
    sourceUnitCount: units.length,
    sourceFactIds: units.map((u) => u.sourceUnitId),
  };
}

/** Shadow experience fields to the snapshot's authoritative normalized source. */
export function applyOperationSnapshotToExperience(
  exp: WorkExperience,
  snapshot: ExperienceAiOperationSnapshot,
): WorkExperience {
  const text = snapshot.normalizedSourceText || snapshot.authoritativeRawText;
  if (!text.trim()) return { ...exp };
  return {
    ...exp,
    description: text,
    originalUserDescription: text,
    canonicalDescription: text,
    descriptionOrigin: 'user',
    recoveredSemanticDuties: undefined,
    groundingRecoverySource: undefined,
  };
}

/**
 * Structural delta between live (plain) and bullet-formatted canonical.
 * Build-263: 191 − 183 = 8 = 3×("• ") + 2×("\\n").
 */
export function experienceAiFormattingDelta(
  liveText: string,
  canonicalText: string,
): {
  liveLength: number;
  canonicalLength: number;
  delta: number;
  equivalentAfterSharedNormalization: boolean;
  canonicalFormattingOnlyDifference: boolean;
  expectedBulletSerializationDelta: number;
} {
  const live = liveText || '';
  const canonical = canonicalText || '';
  const units = experienceAiSourceUnits(live.trim() ? live : canonical);
  const expectedBulletSerializationDelta = units.length > 0
    ? units.length * 2 + Math.max(0, units.length - 1) - Math.max(0, (live.match(/\n/g) || []).length)
    : 0;
  // When live has no newlines, bullet form adds 2 chars prefix per unit + (n-1) newlines.
  const plainSum = units.reduce((a, u) => a + u.length, 0);
  const bulletLen = units.length
    ? plainSum + units.length * 2 + Math.max(0, units.length - 1)
    : 0;
  const equivalent = experienceAiSourcesEquivalent(live, canonical);
  const delta = canonical.length - live.length;
  return {
    liveLength: live.length,
    canonicalLength: canonical.length,
    delta,
    equivalentAfterSharedNormalization: equivalent,
    canonicalFormattingOnlyDifference: equivalent && delta !== 0,
    expectedBulletSerializationDelta: bulletLen - live.length,
  };
}
