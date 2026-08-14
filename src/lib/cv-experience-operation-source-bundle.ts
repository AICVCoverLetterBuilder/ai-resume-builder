/**
 * AAB-317 — Immutable dual-source Experience operation bundle.
 *
 * Fact authority (user-supplied facts) and visible operation source (what is
 * currently displayed) are captured once at button press and never overwrite
 * each other. Unedited AI reruns short-circuit as no-op when the visible text
 * is already valid for the target contract.
 */
import type { Locale } from './i18n/translations';
import type { WorkExperience } from './types';
import { fingerprintText } from './cv-export-diagnostics';
import {
  experienceAiSourceUnits,
  experienceAiSourcesEquivalent,
  normalizeExperienceAiSourceText,
  type ExperienceAiOperationSnapshot,
} from './cv-experience-ai-operation-snapshot';
import type {
  ExperienceAuthoritativeFactSourceKind,
  ExperienceTextareaProvenanceKind,
  ExperienceTextareaProvenanceResolution,
} from './cv-experience-ai-output-provenance';
import {
  EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION,
  EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION,
  experienceFactAuthorityKindsEquivalent,
  resolveCanonicalFactAuthorityKind,
  captureExperienceRequestVisibleComparisonSnapshot,
  normalizeExperienceFactAuthorityKind,
} from './cv-experience-authority-snapshot-327';
void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
void EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION;
import type { ExperienceVisibleSourceAnalysis } from './cv-experience-visible-source-analysis';

export const EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION =
  'experience-fact-visible-source-separation-317-v1' as const;
export const EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION =
  'experience-unedited-rerun-preflight-317-v1' as const;
export const EXPERIENCE_NOOP_DEGRADATION_ORDER_317_REVISION =
  'experience-noop-degradation-order-317-v1' as const;
export const EXPERIENCE_UNEDITED_RERUN_DIAGNOSTIC_TRUTH_317_REVISION =
  'experience-unedited-rerun-diagnostic-truth-317-v1' as const;

void EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION;
void EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION;
void EXPERIENCE_NOOP_DEGRADATION_ORDER_317_REVISION;
void EXPERIENCE_UNEDITED_RERUN_DIAGNOSTIC_TRUTH_317_REVISION;

export type ExperienceOperationSourceBundle = Readonly<{
  revision: typeof EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION;
  // Fact authority
  factAuthorityKind: string | null;
  factAuthorityText: string;
  factAuthorityHash: string | null;
  factAuthorityNormalizedHash: string | null;
  factAuthorityUnitCount: number;
  authoritativeFactSourceKind: ExperienceAuthoritativeFactSourceKind | string | null;
  factAuthorityMatchesAuthoritativeSourceKind: boolean;
  // Visible source
  visibleSourceKind: 'currentTextarea' | 'none';
  visibleSourceText: string;
  visibleSourceHash: string | null;
  visibleSourceNormalizedHash: string | null;
  visibleSourceUnitCount: number;
  visibleSourceProvenance: ExperienceTextareaProvenanceKind | string | null;
  visibleSourceMatchedLastAiOutput: boolean;
  visibleSourceMateriallyEdited: boolean;
  visibleSourceEmploymentState: 'current' | 'completed' | 'unknown';
  visibleSourceLocale: string;
  visibleSourceContextHash: string;
  // Last AI output
  lastAiOutputPresent: boolean;
  lastAiOutputHash: string | null;
  lastAiOutputNormalizedHash: string | null;
  lastAiOutputEmploymentState: 'current' | 'completed' | 'unknown' | null;
  lastAiOutputLocale: string | null;
  lastAiOutputEntryIdHash: string | null;
  // Pre-AI snapshot
  preAiSnapshotPresent: boolean;
  preAiSnapshotHash: string | null;
  preAiSnapshotNormalizedHash: string | null;
  preAiSnapshotUnitCount: number;
  // Context
  targetEmploymentState: 'current' | 'completed' | 'unknown';
  targetLocale: string;
  targetEntryIdHash: string;
  targetJobContextHash: string;
  // Separation flags
  factAuthoritySeparatedFromVisibleSource: boolean;
  visibleOperationSourceKind: 'currentTextarea' | 'none';
  visibleComparisonSourceKind: 'currentTextarea' | 'none';
  providerRewriteBaseKind: 'currentTextarea' | 'none';
}>;

export type UneditedRerunEarlyNoOpPreflight = Readonly<{
  revision: typeof EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION;
  uneditedRerunDetected: boolean;
  earlyNoOpPreflightEvaluated: boolean;
  earlyNoOpPreflightPassed: boolean;
  earlyNoOpPreflightFailureReasons: string[];
  employmentStateMatchesLastAiOutput: boolean | null;
  localeMatchesLastAiOutput: boolean | null;
  entryIdentityMatchesLastAiOutput: boolean | null;
  jobContextMatchesLastAiOutput: boolean | null;
  visibleHashMatchesLastAiOutput: boolean;
  visibleSourceAlreadyValidForTarget: boolean;
  semanticNoOpReason: 'unedited_ai_output_already_valid' | null;
}>;

function textHash(text: string): string | null {
  const t = (text || '').trim();
  return t ? fingerprintText(t) : null;
}

function textNormHash(text: string): string | null {
  const t = (text || '').trim();
  return t ? fingerprintText(normalizeExperienceAiSourceText(t)) : null;
}

function employmentState(isPresent: boolean | undefined): 'current' | 'completed' | 'unknown' {
  if (isPresent === true) return 'current';
  if (isPresent === false) return 'completed';
  return 'unknown';
}

/**
 * Resolve fact-authority text for an Experience AI operation.
 *
 * Prefer the immutable request-time snapshot when it already froze an
 * authoritative override. Otherwise fall back to unedited pre-AI provenance,
 * then grounding. Never treat unedited prior AI output as sole fact source
 * when a distinct pre-AI snapshot exists on the operation snapshot.
 */
export function resolveExperienceFactAuthorityText(options: {
  textareaProvenance: ExperienceTextareaProvenanceResolution | null | undefined;
  snapshot: ExperienceAiOperationSnapshot | null | undefined;
  groundingSourceDescription?: string | null;
}): string {
  void EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION;
  const prov = options.textareaProvenance;
  return (
    options.snapshot?.normalizedSourceText
    || (
      prov?.currentTextareaProvenance === 'ai_generated_unedited'
        && (prov.authoritativeFactText || '').trim()
        ? prov.authoritativeFactText
        : ''
    )
    || options.groundingSourceDescription
    || ''
  ).trim();
}

export function buildExperienceOperationSourceBundle(options: {
  textareaProvenance: ExperienceTextareaProvenanceResolution | null | undefined;
  snapshot: ExperienceAiOperationSnapshot | null | undefined;
  factAuthorityText: string;
  visibleSourceText: string;
  locale: Locale | string;
  isPresent: boolean;
  experienceEntryId: string;
  jobContextHash: string;
  exp?: WorkExperience | null;
}): ExperienceOperationSourceBundle {
  void EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION;
  void EXPERIENCE_FACT_AUTHORITY_TRUTH_327_REVISION;
  void EXPERIENCE_VISIBLE_SNAPSHOT_TRUTH_327_REVISION;
  const prov = options.textareaProvenance;
  const snap = options.snapshot;
  const factText = (options.factAuthorityText || '').trim();
  const visibleText = (
    snap?.visibleComparisonRawText
    || options.visibleSourceText
    || ''
  ).trim();
  // Finalization may receive a shadow experience whose description is the
  // immutable request-time source. In that case its live fields intentionally
  // look user-authored; the snapshot provenance remains authoritative for
  // diagnostics and must not be relabeled as current-textarea authority.
  const snapshotFactKindRaw = normalizeExperienceFactAuthorityKind(
    snap?.provenanceOrigin,
  );
  const snapshotFactKind = snapshotFactKindRaw === 'original_user'
    ? 'pre_ai_snapshot'
    : snapshotFactKindRaw;
  // A shadow entry created by finalization can be reclassified as
  // ai_generated_user_edited even when its authoritative text is byte-for-byte
  // the immutable request snapshot. Preserve the snapshot authority in that
  // case; only a genuinely different fact text indicates a material edit.
  const textareaFactsMatchSnapshot = Boolean(
    snap?.normalizedSourceText
    && prov?.authoritativeFactText
    && experienceAiSourcesEquivalent(
      prov.authoritativeFactText,
      snap.normalizedSourceText,
    ),
  );
  const snapshotLocksFacts = Boolean(
    snapshotFactKind
    && snapshotFactKind !== 'current_textarea'
    && snapshotFactKind !== 'none',
  )
    && (
      prov?.currentTextareaProvenance !== 'ai_generated_user_edited'
      || textareaFactsMatchSnapshot
    )
    && (
      prov?.materialUserEditDetected !== true
      || textareaFactsMatchSnapshot
    );
  const factKind = snapshotLocksFacts
    ? snapshotFactKind
    : resolveCanonicalFactAuthorityKind({
      textareaProvenance: prov,
      authoritativeFactSourceKind: prov?.authoritativeFactSourceKind,
      snapshotProvenanceOrigin: snap?.provenanceOrigin,
    });
  const authKindRaw = (
    (snapshotLocksFacts ? snapshotFactKind : null)
    || normalizeExperienceFactAuthorityKind(prov?.authoritativeFactSourceKind)
    || factKind
  );
  const matches = experienceFactAuthorityKindsEquivalent(factKind, authKindRaw);
  const visibleSnap = captureExperienceRequestVisibleComparisonSnapshot({
    textareaProvenance: snap?.visibleComparisonProvenance
      ? null
      : prov,
    currentTextareaProvenance: snap?.visibleComparisonProvenance,
    lastAiOutputHashMatched: snap?.visibleComparisonMatchedLastAiOutput,
    materialUserEditDetected: snap?.visibleComparisonMaterialUserEditDetected,
  });
  const preAiText = (prov?.authoritativeFactText || '').trim();
  const lastHash = options.exp?.aiOutputProvenance?.lastAiOutputNormalizedHash || null;
  const lastLocale = options.exp?.aiOutputProvenance?.targetLocale || null;
  const lastEmp = options.exp?.aiOutputProvenance
    ? (String(options.exp.aiOutputProvenance.operationMode || '').includes('generate')
      ? null
      : null)
    : null;
  void lastEmp;
  const entryId = String(options.experienceEntryId || snap?.experienceEntryId || '').trim();
  const entryHash = entryId ? fingerprintText(entryId) : '';
  const targetEmp = employmentState(options.isPresent);
  const visibleKind: 'currentTextarea' | 'none' = visibleText ? 'currentTextarea' : 'none';

  return Object.freeze({
    revision: EXPERIENCE_FACT_VISIBLE_SOURCE_SEPARATION_317_REVISION,
    factAuthorityKind: factKind,
    factAuthorityText: factText,
    factAuthorityHash: textHash(factText),
    factAuthorityNormalizedHash: textNormHash(factText),
    factAuthorityUnitCount: factText ? experienceAiSourceUnits(factText).length : 0,
    authoritativeFactSourceKind: authKindRaw,
    factAuthorityMatchesAuthoritativeSourceKind: matches
      && Boolean(factKind)
      && Boolean(authKindRaw),
    visibleSourceKind: visibleKind,
    visibleSourceText: visibleText,
    visibleSourceHash: snap?.visibleComparisonHash ?? textHash(visibleText),
    visibleSourceNormalizedHash:
      snap?.visibleComparisonNormalizedHash ?? textNormHash(visibleText),
    visibleSourceUnitCount:
      snap?.visibleComparisonUnitCount
      ?? (visibleText ? experienceAiSourceUnits(visibleText).length : 0),
    visibleSourceProvenance: visibleSnap.provenance,
    visibleSourceMatchedLastAiOutput: visibleSnap.matchedLastAiOutput,
    visibleSourceMateriallyEdited: visibleSnap.materialUserEditDetected,    visibleSourceEmploymentState: targetEmp,
    visibleSourceLocale: String(options.locale || ''),
    visibleSourceContextHash: String(options.jobContextHash || snap?.jobContextHash || ''),
    lastAiOutputPresent: Boolean(lastHash),
    lastAiOutputHash: options.exp?.aiOutputProvenance?.lastAiOutputRawHash || null,
    lastAiOutputNormalizedHash: lastHash,
    lastAiOutputEmploymentState: null,
    lastAiOutputLocale: lastLocale,
    lastAiOutputEntryIdHash: options.exp?.aiOutputProvenance?.experienceEntryId
      ? fingerprintText(options.exp.aiOutputProvenance.experienceEntryId)
      : null,
    preAiSnapshotPresent: Boolean(preAiText),
    preAiSnapshotHash: textHash(preAiText),
    preAiSnapshotNormalizedHash: textNormHash(preAiText),
    preAiSnapshotUnitCount: preAiText ? experienceAiSourceUnits(preAiText).length : 0,
    targetEmploymentState: targetEmp,
    targetLocale: String(options.locale || ''),
    targetEntryIdHash: entryHash,
    targetJobContextHash: String(options.jobContextHash || snap?.jobContextHash || ''),
    factAuthoritySeparatedFromVisibleSource: Boolean(
      factText
      && visibleText
      && !experienceAiSourcesEquivalent(factText, visibleText),
    ) || (
      Boolean(factKind)
      && factKind !== 'current_textarea'
      && visibleKind === 'currentTextarea'
    ),
    visibleOperationSourceKind: visibleKind,
    visibleComparisonSourceKind: visibleKind,
    providerRewriteBaseKind: visibleKind,
  });
}

/**
 * Safe pre-provider no-op when unedited AI output is already valid for target.
 */
export function evaluateUneditedRerunEarlyNoOpPreflight(options: {
  bundle: ExperienceOperationSourceBundle;
  visibleSourceAnalysis: ExperienceVisibleSourceAnalysis;
  sourceWasEmpty: boolean;
  raceOrStaleDetected?: boolean;
  /** True only after the caller ran the target locale's complete safety gates. */
  independentVisibleValidationPassed?: boolean;
}): UneditedRerunEarlyNoOpPreflight {
  void EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION;
  void EXPERIENCE_NOOP_DEGRADATION_ORDER_317_REVISION;
  const { bundle, visibleSourceAnalysis } = options;
  const failures: string[] = [];
  const unedited = bundle.visibleSourceProvenance === 'ai_generated_unedited'
    && bundle.visibleSourceMatchedLastAiOutput
    && !bundle.visibleSourceMateriallyEdited;

  const isSpanishTarget = String(options.bundle.targetLocale || '')
    .toLowerCase()
    .startsWith('es');
  // Spanish owns its full morphological proof in visibleSourceAnalysis. Other
  // locales may enter only after the caller independently proves fact,
  // predicate, locale/script, tense, perspective, claim, and entry safety.
  if (!isSpanishTarget && options.independentVisibleValidationPassed !== true) {
    failures.push('early_noop_preflight_independent_validation_required');
  }
  if (bundle.visibleSourceProvenance !== 'ai_generated_unedited') {
    failures.push('provenance_not_ai_generated_unedited');
  }
  if (!bundle.visibleSourceMatchedLastAiOutput) {
    failures.push('visible_hash_mismatch_last_ai_output');
  }
  if (bundle.visibleSourceMateriallyEdited) {
    failures.push('material_user_edit_detected');
  }
  if (!bundle.visibleSourceText.trim()) {
    failures.push('visible_source_empty');
  }
  const independentlyValidatedVisible = !isSpanishTarget
    && options.independentVisibleValidationPassed === true;
  // For non-Spanish locales the caller's complete independent visible gate is
  // authoritative. Do not let a heuristic source-language/correctable-defect
  // classifier veto an already validated unedited AI surface.
  if (!independentlyValidatedVisible && visibleSourceAnalysis.sourceAlreadyValidForTarget !== true) {
    failures.push('visible_source_not_already_valid');
  }
  if (!independentlyValidatedVisible && (visibleSourceAnalysis.correctableDefectCount || 0) > 0) {
    failures.push('visible_correctable_defects_present');
  }
  if (options.raceOrStaleDetected) {
    failures.push('race_or_stale_response');
  }

  const lastLocale = (bundle.lastAiOutputLocale || '').trim().toLowerCase();
  const targetLocale = (bundle.targetLocale || '').trim().toLowerCase();
  const localeMatches = lastLocale
    ? lastLocale === targetLocale
      || (lastLocale.startsWith('es') && targetLocale.startsWith('es'))
    : null;
  if (localeMatches === false) failures.push('locale_changed_since_last_ai_output');

  const entryMatches = bundle.lastAiOutputEntryIdHash
    ? bundle.lastAiOutputEntryIdHash === bundle.targetEntryIdHash
    : null;
  if (entryMatches === false) failures.push('entry_identity_changed');

  // Job context: when last AI recorded a request hash via provenance.requestHash,
  // compare against target; missing → treat as match (same entry/session).
  const jobContextMatches: boolean | null = null;

  const employmentMatches: boolean | null = null;

  const visibleHashMatches = Boolean(bundle.visibleSourceMatchedLastAiOutput)
    || (
      Boolean(bundle.lastAiOutputNormalizedHash)
      && bundle.visibleSourceNormalizedHash === bundle.lastAiOutputNormalizedHash
    );
  if (!visibleHashMatches) failures.push('visible_normalized_hash_mismatch');

  const passed = unedited
    && !options.sourceWasEmpty
    && failures.length === 0
    && (isSpanishTarget || options.independentVisibleValidationPassed === true)
    && (independentlyValidatedVisible || visibleSourceAnalysis.sourceAlreadyValidForTarget === true);

  return Object.freeze({
    revision: EXPERIENCE_UNEDITED_RERUN_PREFLIGHT_317_REVISION,
    uneditedRerunDetected: unedited,
    earlyNoOpPreflightEvaluated: true,
    earlyNoOpPreflightPassed: passed,
    earlyNoOpPreflightFailureReasons: passed ? [] : [...new Set(failures)],
    employmentStateMatchesLastAiOutput: employmentMatches,
    localeMatchesLastAiOutput: localeMatches,
    entryIdentityMatchesLastAiOutput: entryMatches,
    jobContextMatchesLastAiOutput: jobContextMatches,
    visibleHashMatchesLastAiOutput: visibleHashMatches,
    visibleSourceAlreadyValidForTarget:
      independentlyValidatedVisible || visibleSourceAnalysis.sourceAlreadyValidForTarget === true,
    semanticNoOpReason: passed ? 'unedited_ai_output_already_valid' : null,
  });
}
