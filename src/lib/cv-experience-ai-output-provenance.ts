/**
 * Per-entry Experience AI output provenance (AAB-304).
 *
 * Unedited prior AI output must never become the sole authoritative fact source
 * on the next Experience AI click. Fact authority prefers pre-AI snapshots /
 * original/canonical user facts; visible AI text is for no-op comparison and
 * display only.
 */
import type { Locale } from './i18n/translations';
import type { WorkExperience } from './types';
import { fingerprintText } from './cv-export-diagnostics';
import {
  experienceAiSourcesEquivalent,
  normalizeExperienceAiSourceText,
} from './cv-experience-ai-operation-snapshot';
import { localesEquivalent } from './cv-content-locale';
import {
  extractSourceDutyUnits,
  sourceFactIdentityId,
  stripDutyListPrefix,
} from './cv-source-fact-identity';

/** Packaging proof — must survive minification in web / Android / AAB assets. */
export const EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION =
  'experience-ai-output-provenance-304-v1' as const;

export type ExperienceTextareaProvenanceKind =
  | 'user_authored'
  | 'structured_canonical'
  | 'ai_generated_unedited'
  | 'ai_generated_user_edited'
  | 'unknown';

export type ExperienceAuthoritativeFactSourceKind =
  | 'pre_ai_snapshot'
  | 'original_user'
  | 'canonical'
  | 'current_textarea'
  | 'generated_from_empty'
  | 'none';

export type ExperienceAiOutputProvenanceRecord = {
  revision: typeof EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
  experienceEntryId: string;
  lastAiOutputNormalizedHash: string;
  lastAiOutputRawHash: string;
  preAiFactSnapshotNormalizedHash: string;
  preAiFactIdentityHashes: string[];
  /** Minimal authoritative fact text for later validation (not emitted in diagnostics). */
  preAiFactSnapshotText: string;
  sourceLocale: string;
  targetLocale: string;
  operationMode: string;
  sourceAuthorityKind: ExperienceAuthoritativeFactSourceKind;
  appliedAt: string;
  requestHash: string | null;
  generatedFromEmpty: boolean;
};

export type ExperienceTextareaProvenanceResolution = {
  revision: typeof EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
  currentTextareaProvenance: ExperienceTextareaProvenanceKind;
  authoritativeFactSourceKind: ExperienceAuthoritativeFactSourceKind;
  authoritativeFactText: string;
  currentTextareaUsedForFactExtraction: boolean;
  currentTextareaIgnoredOrOverridden: boolean;
  generatedDescriptionPreexisted: boolean;
  staleGeneratedDescriptionIgnored: boolean;
  lastAiOutputHashMatched: boolean;
  materialUserEditDetected: boolean;
  formattingOnlyDifference: boolean;
};

/**
 * Resolve the only locale metadata that may override a weaker document-level
 * hint for an unedited visible AI output.  The persisted AI provenance is
 * write-time evidence: it is scoped to the same entry, carries the exact
 * requested target locale, and is usable only while the visible hash still
 * matches the last applied output.  Edited text, a different entry, or a
 * changed target locale deliberately returns null so generic detection and
 * normal validation remain authoritative.
 */
export function resolveTrustedUneditedAiOutputLocale(options: {
  exp: Pick<WorkExperience, 'id' | 'aiOutputProvenance'> | null | undefined;
  provenance: Pick<ExperienceTextareaProvenanceResolution,
    'currentTextareaProvenance' | 'lastAiOutputHashMatched' | 'materialUserEditDetected'>
    | null
    | undefined;
  requestedLocale: string | null | undefined;
}): string | null {
  const exp = options.exp;
  const provenance = options.provenance;
  const requested = String(options.requestedLocale || '').trim();
  const persisted = exp?.aiOutputProvenance;
  if (
    !exp
    || !persisted
    || !persisted.experienceEntryId
    || persisted.experienceEntryId !== exp.id
    || !persisted.targetLocale
    || !requested
    || provenance?.currentTextareaProvenance !== 'ai_generated_unedited'
    || provenance.lastAiOutputHashMatched !== true
    || provenance.materialUserEditDetected === true
    || !localesEquivalent(persisted.targetLocale, requested)
  ) {
    return null;
  }
  return persisted.targetLocale;
}

function normalizedHash(text: string): string {
  return fingerprintText(normalizeExperienceAiSourceText(text || ''));
}

function rawHash(text: string): string {
  return fingerprintText((text || '').normalize('NFKC'));
}

function factIdentityHashes(text: string): string[] {
  return extractSourceDutyUnits(text || '')
    .map((u) => stripDutyListPrefix(u))
    .filter(Boolean)
    .map((u) => sourceFactIdentityId(u));
}

function isAiOrigin(origin?: string | null): boolean {
  return origin === 'ai_generated'
    || origin === 'ai_repaired'
    || origin === 'deterministic_fallback';
}

function textsMateriallyDiffer(a: string, b: string): boolean {
  if (!((a || '').trim()) && !((b || '').trim())) return false;
  if (!((a || '').trim()) || !((b || '').trim())) return true;
  if (experienceAiSourcesEquivalent(a, b)) return false;
  const na = normalizeExperienceAiSourceText(a || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const nb = normalizeExperienceAiSourceText(b || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!na && !nb) return false;
  if (!na || !nb) return true;
  return na !== nb;
}

export function hashExperienceAiOutputText(text: string): string {
  void EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
  return normalizedHash(text);
}

/**
 * Build provenance stamped on a successful Experience AI apply.
 * Preserves the pre-AI authoritative snapshot; stores AI output hashes separately.
 */
export function buildExperienceAiOutputProvenance(options: {
  experienceEntryId: string;
  appliedOutput: string;
  preAiFactText: string;
  sourceLocale: string;
  targetLocale: Locale | string;
  operationMode?: string;
  sourceAuthorityKind?: ExperienceAuthoritativeFactSourceKind;
  requestHash?: string | null;
  generatedFromEmpty?: boolean;
  appliedAt?: string;
}): ExperienceAiOutputProvenanceRecord {
  void EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
  const preAi = (options.preAiFactText || '').trim();
  const applied = (options.appliedOutput || '').trim();
  return {
    revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
    experienceEntryId: options.experienceEntryId,
    lastAiOutputNormalizedHash: normalizedHash(applied),
    lastAiOutputRawHash: rawHash(applied),
    preAiFactSnapshotNormalizedHash: normalizedHash(preAi),
    preAiFactIdentityHashes: factIdentityHashes(preAi),
    preAiFactSnapshotText: preAi,
    sourceLocale: options.sourceLocale || '',
    targetLocale: String(options.targetLocale || ''),
    operationMode: options.operationMode || 'enhance',
    sourceAuthorityKind: options.sourceAuthorityKind
      || (options.generatedFromEmpty ? 'generated_from_empty' : 'original_user'),
    appliedAt: options.appliedAt || new Date().toISOString(),
    requestHash: options.requestHash ?? null,
    generatedFromEmpty: Boolean(options.generatedFromEmpty),
  };
}

function resolvePreAiAuthorityText(exp: WorkExperience): {
  text: string;
  kind: ExperienceAuthoritativeFactSourceKind;
} {
  const prov = exp.aiOutputProvenance;
  if (prov?.preAiFactSnapshotText?.trim()) {
    return { text: prov.preAiFactSnapshotText.trim(), kind: 'pre_ai_snapshot' };
  }
  const original = (exp.originalUserDescription || '').trim();
  const canonical = (exp.canonicalDescription || '').trim();
  const live = (exp.description || '').trim();
  if (original && !experienceAiSourcesEquivalent(original, live)) {
    return { text: original, kind: 'original_user' };
  }
  if (canonical && !experienceAiSourcesEquivalent(canonical, live)) {
    return { text: canonical, kind: 'canonical' };
  }
  if (prov?.generatedFromEmpty && original) {
    return { text: original, kind: 'generated_from_empty' };
  }
  if (original) return { text: original, kind: 'original_user' };
  if (canonical) return { text: canonical, kind: 'canonical' };
  return { text: '', kind: 'none' };
}

/**
 * Classify the current visible textarea vs last AI output / pre-AI authority.
 */
export function resolveExperienceTextareaProvenance(
  exp: WorkExperience,
): ExperienceTextareaProvenanceResolution {
  void EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
  const live = (exp.description || '').trim();
  const generated = (exp.generatedDescription || '').trim();
  const prov = exp.aiOutputProvenance;
  const generatedPreexisted = Boolean(generated || prov?.lastAiOutputNormalizedHash);
  const liveNormHash = live ? normalizedHash(live) : 'empty';
  const lastHash = prov?.lastAiOutputNormalizedHash
    || (generated ? normalizedHash(generated) : null);
  const hashMatched = Boolean(
    live
    && lastHash
    && (
      liveNormHash === lastHash
      || (generated && experienceAiSourcesEquivalent(live, generated))
    ),
  );
  const formattingOnly = Boolean(
    live
    && generated
    && experienceAiSourcesEquivalent(live, generated)
    && live !== generated,
  );

  const preAi = resolvePreAiAuthorityText(exp);
  const materialVsPreAi = Boolean(
    live
    && preAi.text
    && textsMateriallyDiffer(live, preAi.text),
  );
  const materialVsGenerated = Boolean(
    live
    && generated
    && textsMateriallyDiffer(live, generated),
  );
  const materialVsStoredAi = Boolean(
    live
    && lastHash
    && liveNormHash !== lastHash
    && !(generated && experienceAiSourcesEquivalent(live, generated)),
  );

  const looksLikeAiOrigin = isAiOrigin(exp.descriptionOrigin)
    || Boolean(prov?.lastAiOutputNormalizedHash)
    || Boolean(generated);

  // Unedited AI: live matches last AI (or formatting-only), AI origin present,
  // and a distinct pre-AI authority exists (or generate-from-empty snapshot).
  if (
    live
    && looksLikeAiOrigin
    && (hashMatched || formattingOnly)
    // The persisted output hash is the durable write-time identity. A
    // harmless generatedDescription reformat/stale shadow must not turn an
    // otherwise exact committed output into a user-edit classification.
    && (!materialVsGenerated || hashMatched)
    && !materialVsStoredAi
    && preAi.text
    && (materialVsPreAi || Boolean(prov?.generatedFromEmpty))
  ) {
    return {
      revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
      currentTextareaProvenance: 'ai_generated_unedited',
      authoritativeFactSourceKind: preAi.kind === 'none' ? 'pre_ai_snapshot' : preAi.kind,
      authoritativeFactText: preAi.text,
      currentTextareaUsedForFactExtraction: false,
      currentTextareaIgnoredOrOverridden: true,
      generatedDescriptionPreexisted: generatedPreexisted,
      staleGeneratedDescriptionIgnored: true,
      lastAiOutputHashMatched: true,
      materialUserEditDetected: false,
      formattingOnlyDifference: formattingOnly,
    };
  }

  // Material edit of prior AI output — textarea becomes authoritative.
  if (
    live
    && looksLikeAiOrigin
    && (!hashMatched || materialVsGenerated || materialVsStoredAi)
    && (materialVsGenerated || materialVsStoredAi || (preAi.text && materialVsPreAi))
  ) {
    return {
      revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
      currentTextareaProvenance: 'ai_generated_user_edited',
      authoritativeFactSourceKind: 'current_textarea',
      authoritativeFactText: live,
      currentTextareaUsedForFactExtraction: true,
      currentTextareaIgnoredOrOverridden: false,
      generatedDescriptionPreexisted: generatedPreexisted,
      staleGeneratedDescriptionIgnored: false,
      lastAiOutputHashMatched: hashMatched,
      materialUserEditDetected: true,
      formattingOnlyDifference: false,
    };
  }

  if (!live) {
    return {
      revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
      currentTextareaProvenance: 'unknown',
      authoritativeFactSourceKind: 'none',
      authoritativeFactText: '',
      currentTextareaUsedForFactExtraction: false,
      currentTextareaIgnoredOrOverridden: false,
      generatedDescriptionPreexisted: generatedPreexisted,
      staleGeneratedDescriptionIgnored: generatedPreexisted,
      lastAiOutputHashMatched: false,
      materialUserEditDetected: false,
      formattingOnlyDifference: false,
    };
  }

  const canonical = (exp.canonicalDescription || '').trim();
  if (
    !looksLikeAiOrigin
    && canonical
    && experienceAiSourcesEquivalent(live, canonical)
  ) {
    return {
      revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
      currentTextareaProvenance: 'structured_canonical',
      authoritativeFactSourceKind: 'canonical',
      authoritativeFactText: live,
      currentTextareaUsedForFactExtraction: true,
      currentTextareaIgnoredOrOverridden: false,
      generatedDescriptionPreexisted: generatedPreexisted,
      staleGeneratedDescriptionIgnored: false,
      lastAiOutputHashMatched: hashMatched,
      materialUserEditDetected: false,
      formattingOnlyDifference: false,
    };
  }

  return {
    revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
    currentTextareaProvenance: 'user_authored',
    authoritativeFactSourceKind: 'current_textarea',
    authoritativeFactText: live,
    currentTextareaUsedForFactExtraction: true,
    currentTextareaIgnoredOrOverridden: false,
    generatedDescriptionPreexisted: generatedPreexisted,
    staleGeneratedDescriptionIgnored: false,
    lastAiOutputHashMatched: hashMatched,
    materialUserEditDetected: false,
    formattingOnlyDifference: false,
  };
}

/**
 * After a material user edit of description, refresh authoritative snapshot and
 * clear last-AI-output match so the edited text becomes fact authority.
 */
export function refreshProvenanceAfterMaterialUserEdit(
  exp: WorkExperience,
  editedText: string,
): WorkExperience {
  void EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
  const text = (editedText || '').trim();
  const prev = exp.aiOutputProvenance;
  if (!prev && !isAiOrigin(exp.descriptionOrigin)) {
    return exp;
  }
  return {
    ...exp,
    aiOutputProvenance: {
      revision: EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION,
      experienceEntryId: exp.id,
      lastAiOutputNormalizedHash: '',
      lastAiOutputRawHash: '',
      preAiFactSnapshotNormalizedHash: normalizedHash(text),
      preAiFactIdentityHashes: factIdentityHashes(text),
      preAiFactSnapshotText: text,
      sourceLocale: prev?.targetLocale || prev?.sourceLocale || '',
      targetLocale: prev?.targetLocale || '',
      operationMode: 'user_material_edit',
      sourceAuthorityKind: 'current_textarea',
      appliedAt: new Date().toISOString(),
      requestHash: null,
      generatedFromEmpty: false,
    },
  };
}
