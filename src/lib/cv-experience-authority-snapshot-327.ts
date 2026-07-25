/**
 * AAB-327 — Experience fact-authority / visible-snapshot / pre-apply truth.
 *
 * Fact authority (what must be preserved) is separate from visible comparison
 * (no-op / degradation baseline). Request-time visible comparison fields must
 * never be recomputed after provider response or apply.
 */
import type { ExperienceTextareaProvenanceResolution } from './cv-experience-ai-output-provenance';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION =
  'experience-fact-authority-truth-327-v1' as const;
export const EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION =
  'experience-visible-snapshot-truth-327-v1' as const;
export const EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION =
  'experience-invariant-preapply-gate-327-v1' as const;

void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
void EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION;
void EXPERIENCE_INVARIANT_PREAPPLY_GATE_327_REVISION;

/** Canonical diagnostic enum for fact authority (snake_case). */
export type CanonicalExperienceFactAuthorityKind =
  | 'pre_ai_snapshot'
  | 'original_user'
  | 'canonical'
  | 'current_textarea'
  | 'generated_from_empty'
  | 'none';

/**
 * Normalize legacy / snapshot camelCase kinds into the diagnostic enum.
 * `originalUserDescription` → `original_user` (legacy AAB-312). Equivalent to
 * `pre_ai_snapshot` via experienceFactAuthorityKindsEquivalent.
 */
export function normalizeExperienceFactAuthorityKind(
  kind: string | null | undefined,
): CanonicalExperienceFactAuthorityKind | null {
  void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
  const k = (kind || '').trim();
  if (!k) return null;
  if (k === 'pre_ai_snapshot' || k === 'original_user' || k === 'canonical'
    || k === 'current_textarea' || k === 'generated_from_empty' || k === 'none') {
    return k;
  }
  if (k === 'originalUserDescription' || k === 'original_user_description') {
    return 'original_user';
  }
  if (k === 'canonicalDescription') return 'canonical';
  if (k === 'currentTextarea' || k === 'liveUserDescription') return 'current_textarea';
  return k as CanonicalExperienceFactAuthorityKind;
}

/** True when both kinds represent the same authoritative fact source family. */
export function experienceFactAuthorityKindsEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
  const na = normalizeExperienceFactAuthorityKind(a);
  const nb = normalizeExperienceFactAuthorityKind(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // pre_ai_snapshot ↔ original_user are equivalent user-fact locks.
  if (
    (na === 'pre_ai_snapshot' && nb === 'original_user')
    || (na === 'original_user' && nb === 'pre_ai_snapshot')
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve the diagnostic factAuthorityKind from request-time provenance.
 * Never reports `current_textarea` when the current textarea was not used for
 * fact extraction.
 */
export function resolveCanonicalFactAuthorityKind(options: {
  textareaProvenance?: ExperienceTextareaProvenanceResolution | null;
  authoritativeFactSourceKind?: string | null;
  snapshotProvenanceOrigin?: string | null;
}): CanonicalExperienceFactAuthorityKind | null {
  void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
  const prov = options.textareaProvenance;
  if (prov && prov.currentTextareaUsedForFactExtraction === false) {
    const locked = normalizeExperienceFactAuthorityKind(
      prov.authoritativeFactSourceKind || options.authoritativeFactSourceKind,
    );
    if (locked && locked !== 'current_textarea') return locked;
    // Prefer pre_ai_snapshot when unedited AI ignored the textarea for facts.
    if (prov.currentTextareaProvenance === 'ai_generated_unedited') {
      return 'pre_ai_snapshot';
    }
  }
  const fromProv = normalizeExperienceFactAuthorityKind(
    prov?.authoritativeFactSourceKind || options.authoritativeFactSourceKind,
  );
  if (fromProv) return fromProv;
  return normalizeExperienceFactAuthorityKind(options.snapshotProvenanceOrigin);
}

export type ExperienceRequestVisibleComparisonSnapshot = {
  revision: typeof EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION;
  provenance: string | null;
  matchedLastAiOutput: boolean;
  materialUserEditDetected: boolean;
  capturedAtRequest: true;
};

/**
 * Immutable request-time visible comparison provenance / hash-match pair.
 * Do not recalculate after provider response or apply.
 */
export function captureExperienceRequestVisibleComparisonSnapshot(options: {
  textareaProvenance?: ExperienceTextareaProvenanceResolution | null;
  currentTextareaProvenance?: string | null;
  lastAiOutputHashMatched?: boolean | null;
  materialUserEditDetected?: boolean | null;
}): ExperienceRequestVisibleComparisonSnapshot {
  void EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION;
  const prov = options.textareaProvenance;
  const provenance = (
    prov?.currentTextareaProvenance
    || options.currentTextareaProvenance
    || null
  );
  const matched = Boolean(
    prov?.lastAiOutputHashMatched
    ?? options.lastAiOutputHashMatched,
  );
  const materialEdit = Boolean(
    prov?.materialUserEditDetected
    ?? options.materialUserEditDetected,
  );
  // Enforce provenance ↔ hash-match consistency at capture time.
  let safeProvenance = provenance;
  if (safeProvenance === 'ai_generated_unedited' && (!matched || materialEdit)) {
    safeProvenance = materialEdit ? 'ai_generated_user_edited' : safeProvenance;
  }
  if (
    safeProvenance === 'ai_generated_user_edited'
    && matched
    && !materialEdit
  ) {
    safeProvenance = 'ai_generated_unedited';
  }
  return Object.freeze({
    revision: EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION,
    provenance: safeProvenance,
    matchedLastAiOutput: matched,
    materialUserEditDetected: materialEdit,
    capturedAtRequest: true as const,
  });
}
