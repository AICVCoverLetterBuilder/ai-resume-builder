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
import type { StructuredDate, StructuredEmploymentDates } from './ai-core-v3/contracts';
import { fingerprintText } from './cv-export-diagnostics';
import { buildExperienceJobContext } from './cv-experience-job-context';
import { resolveLocaleCandidate } from './i18n/translations';
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
  exp: Pick<WorkExperience, 'id' | 'aiOutputProvenance' | 'generatedLocale'> | null | undefined;
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
    || !requested
    || provenance?.currentTextareaProvenance !== 'ai_generated_unedited'
    || provenance.lastAiOutputHashMatched !== true
    || provenance.materialUserEditDetected === true
  ) {
    return null;
  }
  // The persisted output record is strongest because it is scoped to the exact
  // entry and write-time request.  Older entries may only retain generatedLocale;
  // that metadata is the next-authority source when the same unedited, hash-
  // matched AI output is still visible.  Never use it for edited/user text.
  if (
    persisted
  ) {
    if (persisted.experienceEntryId !== exp.id) return null;
    if (persisted.targetLocale && !localesEquivalent(persisted.targetLocale, requested)) {
      return null;
    }
    if (persisted.targetLocale) return persisted.targetLocale;
  }
  const generatedLocale = String(exp.generatedLocale || '').trim();
  if (generatedLocale && localesEquivalent(generatedLocale, requested)) {
    return generatedLocale;
  }
  return null;
}

function normalizedHash(text: string): string {
  return fingerprintText(normalizeExperienceAiSourceText(text || ''));
}

function rawHash(text: string): string {
  return fingerprintText((text || '').normalize('NFKC'));
}

export function normalizeExperienceV3Source(value: string): string {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function stableExperienceV3Json(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableExperienceV3Json).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableExperienceV3Json(record[key])}`).join(',')}}`;
}

/** Exact M2 snapshot fingerprint shared by capture, apply verification, and export recovery. */
export function hashExperienceV3Value(value: unknown): string {
  const input = typeof value === 'string' ? value : stableExperienceV3Json(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v3-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function parseExperienceV3StructuredDate(value: string): StructuredDate | null {
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

export type ExperienceV3EmptySourceContextInput = {
  documentId: string;
  entryId: string;
  roleTitle: string;
  company: string;
  employmentState: 'present' | 'completed';
  rawStartDate: string;
  rawEndDate: string;
  dates: StructuredEmploymentDates;
  industry: string;
  level: string;
  gender: string;
  requestedLocale: string;
  uiLocale: string;
  storedContentLocale: string;
  exactVisibleDescription: string;
};

/** Reconstruct the exact immutable context hash captured by M2 Generate-from-empty. */
export function buildExperienceV3EmptySourceRequestContextHash(
  input: ExperienceV3EmptySourceContextInput,
): string {
  return hashExperienceV3Value({
    documentId: input.documentId,
    entryId: input.entryId,
    roleTitle: input.roleTitle,
    company: input.company,
    employmentState: input.employmentState,
    rawStartDate: input.rawStartDate,
    rawEndDate: input.rawEndDate,
    dates: input.dates,
    industry: input.industry,
    level: input.level,
    gender: input.gender,
    requestedLocale: input.requestedLocale,
    uiLocale: input.uiLocale,
    storedContentLocale: input.storedContentLocale,
    sourceHash: hashExperienceV3Value(normalizeExperienceV3Source(input.exactVisibleDescription)),
  });
}

export type GeneratedFromEmptyAuthorityDecisionReason =
  | 'not_applicable'
  | 'provenance_missing'
  | 'provenance_revision_unsupported'
  | 'entry_identity_mismatch'
  | 'generated_from_empty_flag_mismatch'
  | 'source_authority_kind_mismatch'
  | 'operation_mode_mismatch'
  | 'expected_empty_source_mismatch'
  | 'generated_output_missing'
  | 'visible_output_mismatch'
  | 'normalized_output_hash_mismatch'
  | 'raw_output_hash_mismatch'
  | 'source_locale_mismatch'
  | 'generated_locale_mismatch'
  | 'request_context_not_recomputed'
  | 'request_context_mismatch'
  | 'generation_job_context_mismatch'
  | 'verified';

export type GeneratedFromEmptyAuthoritySource =
  | 'generated_from_empty_ai_output_provenance'
  | 'none';

export type GeneratedFromEmptyAuthorityDiagnostic = {
  applicable: boolean;
  provenancePresent: boolean;
  provenanceRevisionSupported: boolean;
  entryIdentityMatched: boolean;
  generatedFromEmptyFlagMatched: boolean;
  sourceAuthorityKindMatched: boolean;
  operationModeMatched: boolean;
  expectedSourceEmptyMatched: boolean;
  generatedOutputPresent: boolean;
  visibleOutputMatched: boolean;
  normalizedOutputHashMatched: boolean;
  rawOutputHashMatched: boolean;
  sourceLocaleMatched: boolean;
  /** The historical requested/UI generation locale was recovered from persisted provenance. */
  historicalGenerationLocaleRecovered: boolean;
  requestContextRecomputed: boolean;
  requestContextMatched: boolean;
  generatedLocaleMatched: boolean;
  /** Current export locale may use the persisted generated text directly. */
  requestedLocaleCompatible: boolean;
  /** Explicit alias that separates source verification from current display permission. */
  historicalSourceAuthorityVerified: boolean;
  /** Direct source presentation is permitted only for the same historical generation locale. */
  directPresentationAllowed: boolean;
  generationJobContextKeyPresent: boolean;
  generationJobContextKeyMatched: boolean;
  verifierPassed: boolean;
  verifierDecisionReason: GeneratedFromEmptyAuthorityDecisionReason;
  authoritySource: GeneratedFromEmptyAuthoritySource;
};

export type VerifyGeneratedFromEmptyAuthorityInput = {
  documentId: string;
  experience: WorkExperience;
  industry: string;
  level: string;
  gender: string;
  /** Current export/request locale. It never changes the reconstructed historical event. */
  requestedLocale: string;
};

function generatedFromEmptyApplicability(exp: WorkExperience): boolean {
  return Boolean(
    exp.aiOutputProvenance?.generatedFromEmpty
    || exp.aiOutputProvenance?.sourceAuthorityKind === 'generated_from_empty'
    || (
      exp.descriptionOrigin === 'ai_generated'
      && (exp.generatedDescription || '').trim()
      && !(exp.originalUserDescription || '').trim()
      && !(exp.canonicalDescription || '').trim()
    ),
  );
}

/**
 * Pure, fail-closed authority decision for persisted M2 Generate-from-empty rows.
 * It grants presentation authority only; it never creates user/canonical fact authority.
 */
export function verifyGeneratedFromEmptyExperienceAuthority(
  input: VerifyGeneratedFromEmptyAuthorityInput,
): GeneratedFromEmptyAuthorityDiagnostic {
  const exp = input.experience;
  const provenance = exp.aiOutputProvenance;
  const applicable = generatedFromEmptyApplicability(exp);
  const generated = String(exp.generatedDescription || '').trim();
  const visible = String(exp.description || '').trim();
  const provenancePresent = Boolean(provenance);
  const provenanceRevisionSupported = provenance?.revision === EXPERIENCE_AI_OUTPUT_PROVENANCE_304_REVISION;
  const entryIdentityMatched = Boolean(provenance && provenance.experienceEntryId === exp.id);
  const generatedFromEmptyFlagMatched = provenance?.generatedFromEmpty === true;
  const sourceAuthorityKindMatched = provenance?.sourceAuthorityKind === 'generated_from_empty';
  const operationModeMatched = provenance?.operationMode === 'generate';
  const expectedSourceEmptyMatched = Boolean(
    provenance
    && normalizeExperienceV3Source(provenance.preAiFactSnapshotText).length === 0
    && provenance.preAiFactSnapshotNormalizedHash === normalizedHash(''),
  );
  const generatedOutputPresent = generated.length > 0;
  const visibleOutputMatched = Boolean(
    visible
    && generated
    && experienceAiSourcesEquivalent(visible, generated),
  );
  const normalizedOutputHashMatched = Boolean(
    provenance
    && generated
    && provenance.lastAiOutputNormalizedHash === normalizedHash(generated),
  );
  const rawOutputHashMatched = Boolean(
    provenance
    && generated
    && provenance.lastAiOutputRawHash === rawHash(generated),
  );
  // M2 stores the document's then-current content locale as `sourceLocale`,
  // even when Generate starts from an empty visible source. It is historical
  // snapshot data, not a comparison against a later CV-level locale.
  const historicalStoredContentLocale = resolveLocaleCandidate(provenance?.sourceLocale);
  // M2 owns Generate only when requestedLocale and uiLocale match. Therefore
  // the persisted target locale reconstructs both historical request/UI values.
  const historicalGenerationLocale = resolveLocaleCandidate(provenance?.targetLocale);
  const sourceLocaleMatched = Boolean(historicalStoredContentLocale);
  const historicalGenerationLocaleRecovered = Boolean(historicalGenerationLocale);
  const generatedLocaleMatched = Boolean(
    historicalGenerationLocale
    && localesEquivalent(historicalGenerationLocale, exp.generatedLocale),
  );
  // This is deliberately not part of historical authority verification. A
  // different current export target must use the validated surface owner.
  const requestedLocaleCompatible = Boolean(
    historicalGenerationLocale
    && localesEquivalent(historicalGenerationLocale, input.requestedLocale)
    && generatedLocaleMatched,
  );
  const start = parseExperienceV3StructuredDate(exp.startDate);
  const end = exp.isPresent ? null : parseExperienceV3StructuredDate(exp.endDate);
  const requestContextRecomputed = Boolean(start && (exp.isPresent || end));
  const recomputedRequestHash = requestContextRecomputed
    && historicalStoredContentLocale
    && historicalGenerationLocale
    ? buildExperienceV3EmptySourceRequestContextHash({
      documentId: input.documentId,
      entryId: exp.id,
      roleTitle: exp.position,
      company: exp.company,
      employmentState: exp.isPresent ? 'present' : 'completed',
      rawStartDate: exp.startDate,
      rawEndDate: exp.endDate,
      dates: { start: start!, end },
      industry: input.industry,
      level: input.level,
      gender: input.gender,
      requestedLocale: historicalGenerationLocale,
      uiLocale: historicalGenerationLocale,
      storedContentLocale: historicalStoredContentLocale,
      exactVisibleDescription: '',
    })
    : null;
  const requestContextMatched = Boolean(
    provenance?.requestHash
    && recomputedRequestHash
    && provenance.requestHash === recomputedRequestHash,
  );
  const historicalGenerationContext = historicalGenerationLocale
    ? buildExperienceJobContext({
      position: exp.position,
      industry: input.industry,
      locale: historicalGenerationLocale,
      level: input.level,
    })
    : null;
  const generationJobContextKeyPresent = Boolean(exp.generationJobContextKey);
  const generationJobContextKeyMatched = !generationJobContextKeyPresent
    || Boolean(
      historicalGenerationContext
      && exp.generationJobContextKey === historicalGenerationContext.key,
    );

  const checks: Array<[boolean, GeneratedFromEmptyAuthorityDecisionReason]> = [
    [applicable, 'not_applicable'],
    [provenancePresent, 'provenance_missing'],
    [provenanceRevisionSupported, 'provenance_revision_unsupported'],
    [entryIdentityMatched, 'entry_identity_mismatch'],
    [generatedFromEmptyFlagMatched, 'generated_from_empty_flag_mismatch'],
    [sourceAuthorityKindMatched, 'source_authority_kind_mismatch'],
    [operationModeMatched, 'operation_mode_mismatch'],
    [expectedSourceEmptyMatched, 'expected_empty_source_mismatch'],
    [generatedOutputPresent, 'generated_output_missing'],
    [visibleOutputMatched, 'visible_output_mismatch'],
    [normalizedOutputHashMatched, 'normalized_output_hash_mismatch'],
    [rawOutputHashMatched, 'raw_output_hash_mismatch'],
    [sourceLocaleMatched, 'source_locale_mismatch'],
    [historicalGenerationLocaleRecovered, 'generated_locale_mismatch'],
    [generatedLocaleMatched, 'generated_locale_mismatch'],
    [requestContextRecomputed, 'request_context_not_recomputed'],
    [requestContextMatched, 'request_context_mismatch'],
    [generationJobContextKeyMatched, 'generation_job_context_mismatch'],
  ];
  const failure = checks.find(([passed]) => !passed)?.[1];
  const verifierPassed = !failure;
  const historicalSourceAuthorityVerified = verifierPassed;
  const directPresentationAllowed = historicalSourceAuthorityVerified && requestedLocaleCompatible;
  return {
    applicable,
    provenancePresent,
    provenanceRevisionSupported,
    entryIdentityMatched,
    generatedFromEmptyFlagMatched,
    sourceAuthorityKindMatched,
    operationModeMatched,
    expectedSourceEmptyMatched,
    generatedOutputPresent,
    visibleOutputMatched,
    normalizedOutputHashMatched,
    rawOutputHashMatched,
    sourceLocaleMatched,
    historicalGenerationLocaleRecovered,
    requestContextRecomputed,
    requestContextMatched,
    generatedLocaleMatched,
    requestedLocaleCompatible,
    historicalSourceAuthorityVerified,
    directPresentationAllowed,
    generationJobContextKeyPresent,
    generationJobContextKeyMatched,
    verifierPassed,
    verifierDecisionReason: failure || 'verified',
    authoritySource: verifierPassed
      ? 'generated_from_empty_ai_output_provenance'
      : 'none',
  };
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
