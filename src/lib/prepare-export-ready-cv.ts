/**
 * Single authoritative export-ready snapshot for all templates and formats.
 * Semantic duty facts are the grounding identity — not English shell counts.
 */
import type { CVData, TemplateId, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import { normalizeLegacyCvRuntime } from './cv-legacy-runtime-migration';
import { normalizeCvRegion } from './cv-region';
import {
  buildCvCanonicalFactSet,
  formatExperienceBullets,
  type CvCanonicalFactSet,
} from './cv-canonical-facts';
import { validateSummaryExportCandidate } from './cv-export-integrity';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
  localizeCanonicalBulletLine,
  buildSourcePreservingExperienceBullets,
} from './cv-localized-fallback';
import {
  buildCrossLocaleExperienceFallback,
  validateCrossLocaleSemanticCoverage,
} from './cv-cross-locale-experience';
import { extractExperienceSemanticArgumentKinds } from './cv-experience-unsupported-claims';
import { buildSummaryCompositionDiagnostics, countSummaryWords } from './cv-summary-grounding';
import {
  compactSavedSummaryNearWordBudget,
  SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION,
} from './cv-summary-word-budget';
import { buildExperienceDurationSnapshot, formatApproximateDurationPhrase } from './cv-experience-duration';
import { applyCvContentQuality } from './cv-content-quality';
import {
  textMatchesRequestedFieldLocale,
  validateFinalLocalizedCvFields,
} from './cv-field-locale-integrity';
import { validateAiUnitLocalePurity } from './cv-ai-unit-locale-purity';
import { auditCvExportIntegrity } from './cv-export-integrity-audit';
import { detectTextLocale, isCrossLocaleOperation } from './cv-content-locale';
import { CvExportFailure } from './cv-export-error-message';
import { LEGACY_RECOVERED_DISPLAY_DUTIES } from './cv-legacy-grounding-recovery';
import {
  displayTextForSemanticRecovery,
  internalShellsFromSemanticDuties,
  LEGACY_USER_ORIGIN_DUTIES,
  resolveExperienceSemanticGrounding,
  recoveredUserOriginNeedsSourceBoundLocalization,
  semanticDutyKeys,
  type ExperienceSemanticGrounding,
  type SemanticDutyKey,
} from './cv-semantic-duty-facts';
import { splitExperienceBullets } from './cv-canonical-facts';
import {
  buildExperienceJobContext,
  experienceJobContextsMatch,
  buildOccupationAwareExperienceFallback,
  buildOccupationAwareSummaryFallback,
  filterSemanticDutiesForJobContext,
  hasGenuineUserExperienceGrounding,
  hasUnsupportedRegulatedPharmacyClaims,
  isSummaryStaleForJobContext,
  scrubOrphanDurationFragments,
  textLooksLikeCookingDuties,
} from './cv-experience-job-context';
import {
  materialDutyKeysFromDescription,
  validateExperienceApplyMaterialPostcondition,
  validateMaterialDutyCoverage,
} from './cv-material-duty-coverage';
import { validateSourceFactIdentityCoverage } from './cv-source-fact-identity';
import {
  canUseLegacyExperienceDisplayProjection,
  projectExperienceFromLocalizedSurfaces,
  resolveExperiencePresentationSnapshot,
  type ExperiencePresentationRecord,
  type ExperiencePresentationSnapshot,
} from './cv-experience-localized-surfaces';
import {
  resolveSummaryCurrentTextAuthority,
  SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION,
} from './cv-summary-current-text-authority';
import { captureSummaryV2Snapshot } from './cv-summary-v2/snapshot';
import { buildSummaryV2SelectionManifest } from './cv-summary-v2/manifest';
import { dutyTokenStems, hashSummaryV2Text } from './cv-summary-v2/facts';
import { buildSummaryV2DeterministicText } from './cv-summary-v2/builder';
import { validateSummaryV2AgainstManifest } from './cv-summary-v2/validator';
import type {
  SummaryV2EntryOwned,
  SummaryV2SelectionManifest,
  SummaryV2ValidationResult,
} from './cv-summary-v2/types';
import { resolveLocalizedSummaryRole } from './cv-summary-structured-role-localization';

function classifyMaterialBulletScript(bullet: string): 'hi' | 'en' | 'mixed' | 'empty' {
  const t = (bullet || '').trim();
  if (!t) return 'empty';
  const dev = (t.match(/[\u0900-\u097F]/g) || []).length;
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  if (dev > 0 && lat >= 4) return 'mixed';
  if (dev > 0) return 'hi';
  if (lat > 0) return 'en';
  return 'empty';
}

/**
 * Recovery builds target-native prose, so it must not inherit a foreign role
 * label merely because the immutable manifest intentionally retained that
 * source label. This is a presentation-only projection: source role/fact
 * identity, entry binding and the unselected-entry authority set remain
 * untouched for the V2 validator.
 */
type SummaryRecoveryFactPresentationAuthority =
  | 'target_native_immutable_surface'
  | 'validated_current_target_experience'
  | 'deterministic_target_projector'
  | 'unresolved';

type SummaryRecoveryFactPresentationEvidence = {
  owningEntryHash: string;
  factIdHash: string;
  immutableAuthorityHash: string;
  presentationSurfaceHash: string | null;
  presentationSurfaceAuthority: SummaryRecoveryFactPresentationAuthority;
  detectedTargetLocale: string | null;
  detectedTargetScript: string | null;
};

type DeterministicRecoveryProjection = {
  manifest: SummaryV2SelectionManifest;
  factPresentation: SummaryRecoveryFactPresentationEvidence[];
};

/**
 * Binds a target Experience presentation to immutable Summary facts without
 * relying on the editor's bullet order.  Aggregate 3/3 coverage is necessary
 * but insufficient here: a concept/criterion duty must never inherit the
 * material surface of a neighboring fact merely because both are present.
 *
 * Only relation-bearing facts are eligible for this deterministic bridge. A
 * sparse or ambiguous free-text set falls through to the existing provider or
 * fails closed rather than inventing fact lineage.
 */
function bindTargetPresentationFacts(
  facts: SummaryV2EntryOwned['facts'],
  targetBullets: string[],
): Map<number, string> | null {
  const sourceSignatures = facts.map((fact) => (
    [...new Set(extractExperienceSemanticArgumentKinds(fact.bulletText))]
      .sort()
      .join('|')
  ));
  const targetSignatures = targetBullets.map((bullet) => (
    [...new Set(extractExperienceSemanticArgumentKinds(bullet))]
      .sort()
      .join('|')
  ));
  if (
    sourceSignatures.length !== facts.length
    || targetSignatures.length !== targetBullets.length
    || sourceSignatures.some((signature) => !signature)
  ) {
    return null;
  }

  const bound = new Map<number, string>();
  const usedTargets = new Set<number>();
  for (let sourceIndex = 0; sourceIndex < sourceSignatures.length; sourceIndex += 1) {
    const signature = sourceSignatures[sourceIndex]!;
    const candidateIndexes = targetSignatures
      .map((targetSignature, candidateIndex) => ({ targetSignature, candidateIndex }))
      .filter(({ targetSignature, candidateIndex }) => (
        !usedTargets.has(candidateIndex) && targetSignature === signature
      ));
    if (candidateIndexes.length !== 1) return null;
    const candidateIndex = candidateIndexes[0]!.candidateIndex;
    usedTargets.add(candidateIndex);
    bound.set(sourceIndex, targetBullets[candidateIndex]!);
  }
  return bound.size === facts.length && usedTargets.size === targetBullets.length
    ? bound
    : null;
}

/**
 * The V2 manifest deliberately retains immutable source facts for ownership.
 * Recovery prose must instead materialize one target-language surface for each
 * selected immutable fact before it enters the native builder.  Do not pair a
 * visible Experience bullet by index: a current target-language textarea has
 * no per-fact authority unless another source-bound presentation record has
 * already established that binding. The deterministic projector first creates
 * a complete target-language projection from the immutable same-entry fact
 * set, then attaches each resulting surface only through the typed semantic
 * bridge. A validated current target Experience surface takes precedence when
 * the same bridge proves a one-to-one fact binding. Neither route trusts an
 * editor bullet index.
 */
function projectDeterministicRecoveryPresentationSurfaces(
  manifest: SummaryV2SelectionManifest,
): DeterministicRecoveryProjection {
  const factPresentation: SummaryRecoveryFactPresentationEvidence[] = [];
  const projectEntry = (entry: SummaryV2EntryOwned): SummaryV2EntryOwned => {
    const immutableSource = entry.facts.map((fact) => fact.bulletText).join('\n');
    // `textMatchesRequestedFieldLocale` is intentionally permissive for form
    // fields. A recovery fact surface needs the stricter unit-level purity
    // decision: otherwise a Devanagari immutable duty can be mislabeled as a
    // Serbian presentation merely because it is an Experience field.
    const sourceAlreadyTarget = entry.facts.every((fact) => {
      const purity = validateAiUnitLocalePurity(fact.bulletText, manifest.locale, {
        kind: 'experience_bullet',
        requireUnits: true,
      });
      return purity.targetLocalePurityPassed && purity.mixedLanguageUnitCount === 0;
    });
    const currentTargetPresentation = entry.facts
      .map((fact) => fact.presentationText?.trim() || '')
      .filter(Boolean)
      .join('\n');
    const currentPresentationIsTrusted = entry.facts.every((fact) => (
      fact.presentationTrusted === true
      && fact.presentationLocale === manifest.locale
    ));
    const currentPresentationPurity = currentTargetPresentation
      ? validateAiUnitLocalePurity(currentTargetPresentation, manifest.locale, {
        kind: 'experience_bullet',
        requireUnits: true,
      })
      : null;
    const currentPresentationCoverage = currentTargetPresentation
      ? validateCrossLocaleSemanticCoverage(immutableSource, currentTargetPresentation)
      : null;
    const currentPresentationBindings = currentTargetPresentation
      ? bindTargetPresentationFacts(entry.facts, splitExperienceBullets(currentTargetPresentation))
      : null;
    const hasBoundCurrentTargetPresentation = Boolean(
      !sourceAlreadyTarget
      && currentPresentationIsTrusted
      && currentPresentationPurity?.targetLocalePurityPassed
      && currentPresentationPurity.mixedLanguageUnitCount === 0
      && currentPresentationCoverage?.ok
      && currentPresentationBindings?.size === entry.facts.length,
    );
    const projectedDescription = sourceAlreadyTarget
      ? immutableSource
      : (hasBoundCurrentTargetPresentation
        ? currentTargetPresentation
        : buildCrossLocaleExperienceFallback({
          sourceDescription: immutableSource,
          sourceLocale: entry.sourceLocale,
          targetLocale: manifest.locale,
          gender: manifest.gender,
          isPresent: entry.isPresent,
          position: entry.sourceRoleTitle || entry.role,
        }));
    const projectedBullets = splitExperienceBullets(projectedDescription);
    const projectedCoverage = sourceAlreadyTarget
      ? null
      : validateCrossLocaleSemanticCoverage(immutableSource, projectedDescription);
    const boundProjectedByFactIndex = (sourceAlreadyTarget
      ? new Map(entry.facts.map((fact, factIndex) => [factIndex, fact.bulletText]))
      : (hasBoundCurrentTargetPresentation
        ? currentPresentationBindings
        : (projectedCoverage?.ok
          ? bindTargetPresentationFacts(entry.facts, projectedBullets)
          : null))) || new Map<number, string>();
    const completeBoundProjection = boundProjectedByFactIndex.size === entry.facts.length
      && new Set(boundProjectedByFactIndex.values()).size === entry.facts.length;
    const localized = resolveLocalizedSummaryRole({
      role: entry.sourceRoleTitle || entry.role,
      sourceLocale: entry.roleSourceLocale || entry.sourceLocale,
      targetLocale: manifest.locale,
      gender: manifest.gender,
      entryId: entry.entryId,
    });
    const facts = entry.facts.map((fact, factIndex) => {
      const projected = completeBoundProjection
        ? (boundProjectedByFactIndex.get(factIndex) || '')
        : '';
    const purity = projected.trim()
      ? validateAiUnitLocalePurity(projected, manifest.locale, {
        kind: 'experience_bullet',
        requireUnits: true,
      })
      : null;
    const accepted = Boolean(
      projected.trim()
      && purity?.targetLocalePurityPassed
      && purity.mixedLanguageUnitCount === 0,
    );
    factPresentation.push({
      owningEntryHash: hashSummaryV2Text(entry.entryId),
      factIdHash: hashSummaryV2Text(fact.factId),
      immutableAuthorityHash: fact.sourceFactHash,
      presentationSurfaceHash: accepted ? hashSummaryV2Text(projected) : null,
      presentationSurfaceAuthority: accepted
        ? (sourceAlreadyTarget
          ? 'target_native_immutable_surface'
          : (hasBoundCurrentTargetPresentation
            ? 'validated_current_target_experience'
            : 'deterministic_target_projector'))
        : 'unresolved',
      detectedTargetLocale: accepted ? (purity?.detectedLocaleByUnit[0] || manifest.locale) : null,
      detectedTargetScript: accepted ? (purity?.detectedScriptByUnit[0] || null) : null,
    });
    if (!accepted) return fact;
    return {
      ...fact,
      bulletText: projected.trim(),
      tokenStems: dutyTokenStems(projected),
    };
    });
    return {
      ...entry,
      // Unknown free-text titles are not guessed. The shared final locale gate
      // still rejects a genuinely foreign role surface, while known immutable
      // duties can still be independently projected and diagnosed.
      role: localized.localizationValidationPassed && localized.localizedTargetRoleLabel
        ? localized.localizedTargetRoleLabel
        : entry.role,
      sourceRoleTitle: entry.sourceRoleTitle || entry.role,
      roleTitleLocalizationSource: localized.localizationValidationPassed
        ? `deterministic:${localized.localizationSource}`
        : entry.roleTitleLocalizationSource,
      facts,
    };
  };
  const current = manifest.current ? projectEntry(manifest.current) : null;
  const priors = manifest.priors.map(projectEntry);
  const selectedById = new Map(
    [...(current ? [current] : []), ...priors].map((entry) => [entry.entryId, entry]),
  );
  const allEntries = manifest.allEntries?.map((entry) => selectedById.get(entry.entryId) || entry);
  const currentFacts = manifest.requiredCurrentFacts.map((fact) => (
    selectedById.get(fact.entryId)?.facts.find((candidate) => candidate.factId === fact.factId) || fact
  ));
  const priorFacts = manifest.requiredPriorFacts.map((fact) => (
    selectedById.get(fact.entryId)?.facts.find((candidate) => candidate.factId === fact.factId) || fact
  ));
  return {
    factPresentation,
    manifest: {
    ...manifest,
    current,
    priors,
    ...(allEntries ? { allEntries } : {}),
    requiredCurrentFacts: currentFacts,
    requiredPriorFacts: priorFacts,
    },
  };
}

export type ExportReadyStage =
  | 'normalize_runtime'
  | 'normalize_region'
  | 'resolve_provenance'
  | 'recover_legacy_grounding'
  | 'produce_semantic_duties'
  | 'produce_localized_display'
  | 'construct_summary_fact_set'
  | 'validate_summary'
  | 'recover_summary'
  | 'validate_locale_integrity'
  | 'complete';

export type ExportReadyDiagnostics = {
  selectedTemplateId: TemplateId | string;
  requestedLocale: Locale;
  runtimeMigrationVersion?: number;
  experienceCount: number;
  recoveryInvoked: boolean;
  experienceProvenance: Array<{
    id: string;
    hasOriginalUserDescription: boolean;
    hasCanonicalDescription: boolean;
    hasCanonicalSnapshot: boolean;
    hasGeneratedDescription: boolean;
    descriptionOrigin?: string;
    generatedLocale?: string;
    groundingRecoverySource?: string;
    source: ExperienceSemanticGrounding['source'];
    semanticDutyKeys: SemanticDutyKey[];
    visibleBulletCount: number;
    groundingBulletCount: number;
    exportBulletCount: number;
  }>;
  summaryFactSetSource: 'semantic_duties' | 'modern_provenance' | 'occupation_generic' | 'app_owned_v2_manifest' | 'none';
  summarySemanticDutyKeys: SemanticDutyKey[];
  summaryInitialValid?: boolean;
  summaryInitialReason?: string;
  summaryRecoverySource?: 'saved_summary' | 'bounded_saved_summary' | 'deterministic_semantic_facts' | 'deterministic_v2_manifest' | 'occupation_generic_fallback';
  summaryRecoveryReason?: string;
  summaryWordCountBefore?: number;
  summaryWordCountAfter?: number;
  summaryWordBudgetMax?: number;
  /** Raw deterministic recovery candidate before any advisory compaction. */
  rawRecoveryWordCount?: number | null;
  rawRecoveryWordBudgetPassed?: boolean | null;
  /** `false` means the source only exceeded an advisory legacy target. */
  compactionAttempted?: boolean | null;
  compactedRecoveryWordCount?: number | null;
  /** Final V2 selected surface applies the actual mandatory postconditions. */
  selectedFinalWordCount?: number | null;
  selectedFinalWordBudgetPassed?: boolean | null;
  summaryWordBudgetCompactionRevision?: typeof SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION;
  summaryCurrentTextAuthorityRevision?: typeof SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION;
  summaryStaleMetadataDetected?: boolean;
  summaryVisibleTextAuthorityRebound?: boolean;
  summaryVisibleTextAuthorityReason?: string;
  summaryVisibleTextAuthorityBlockedReason?: string;
  summaryVisibleTextValidationReason?: string;
  summaryForeignProfessionalPrefixRejected?: boolean;
  summaryStaleReboundLocaleGuardRevision?: string;
  /** Non-PII job-context / Summary invalidation diagnostics. */
  experienceGenerationContextKey?: string;
  summaryGenerationContextKey?: string;
  summaryContextMatch?: boolean;
  staleSummaryExcluded?: boolean;
  summaryFactKeysBefore?: string[];
  summaryFactKeysUsed?: string[];
  /** Privacy-safe ownership boundary for the Summary V2 export fact set. */
  summarySelectedEntryHashes?: string[];
  summaryOmittedEntryHashes?: string[];
  summaryRequiredFactHashes?: Array<{ owningEntryHash: string; factHash: string }>;
  /** App-owned summaries are rebound to the current immutable V2 selection manifest. */
  summaryValidationAuthoritySource?: 'manual_saved_summary' | 'app_owned_v2_manifest' | 'app_owned_unstructured_legacy';
  summarySavedProvenance?: string;
  summarySavedSummaryReboundRevalidated?: boolean;
  /** Saved app-owned candidate phase; never inferred from a later recovery. */
  savedSummaryHash?: string;
  savedSummaryOwnershipPassed?: boolean | null;
  savedSummaryOwnershipFailureReasons?: string[];
  savedSummaryJobContextPassed?: boolean | null;
  /** Deterministic recovery phase, evaluated before selected-final acceptance. */
  recoveryCandidateHash?: string;
  recoveryCandidateLocaleValidationPassed?: boolean | null;
  recoveryCandidateNativeSurfacePassed?: boolean | null;
  recoveryCandidateOwnershipPassed?: boolean | null;
  recoveryCandidateRejectionReasons?: string[];
  recoveryDetectedLocaleByUnit?: Array<string | null>;
  recoveryDetectedScriptByUnit?: string[];
  /** Per-fact target presentation lineage for a selected V2 deterministic recovery. */
  recoveryFactPresentation?: SummaryRecoveryFactPresentationEvidence[];
  /** Terminal presentation identity; Preview/PDF/DOCX must agree when unchanged. */
  selectedFinalSummaryHash?: string;
  selectedFinalSource?: string | null;
  /** Actual Summary value supplied to the Preview renderer, never inferred. */
  previewRenderedSummaryHash?: string | null;
  previewRenderAuthority?: 'selected_final' | 'manual_saved' | 'unresolved' | 'render_mismatch' | null;
  /** Required whenever Preview claims it rendered the selected terminal final. */
  previewSelectedFinalParityPassed?: boolean | null;
  /** Deprecated intended-candidate field retained for existing consumers. */
  visiblePreviewSummaryHash?: string | null;
  exportSummaryHash?: string | null;
  summaryRelationalOwnershipPassed?: boolean | null;
  summaryRelationalOwnershipFailureReasons?: string[];
  summaryFinalUnitOwnership?: Array<{
    unitHash: string;
    roleSlot: 'duration' | 'current_role' | 'prior_role';
    owningEntryHash: string | null;
    roleTitleOwnerEntryHash: string | null;
    employerOwnerEntryHash: string | null;
    dateStatusOwnerEntryHash: string | null;
    dutyFactOwnerEntryHashes: string[];
    relationalOwnershipPassed: boolean;
    relationalOwnershipFailureReasons: string[];
  }>;
  /** Same entry-owned presentation snapshot contract consumed by preview/PDF/DOCX. */
  experiencePresentation?: ExperiencePresentationRecord[];
  /** Non-PII identity of the exact terminal Experience presentation snapshot. */
  experiencePresentationSnapshotId?: string;
  occupationGenericFallbackUsed?: boolean;
  unsupportedRoleSpecificClaimReason?: string;
  durationCompositionSource?: string;
  summarySourceFactCount?: number;
  summaryCoveredFactCount?: number;
  summaryBulletMarkersRemoved?: number;
  summarySkillsIncludedCount?: number;
  summarySkillsCompositionMode?: 'grammatical_sentence' | 'omitted' | 'none';
  summaryFallbackReason?: string;
  summaryMaterialCoverageResult?: 'complete' | 'incomplete' | 'empty_source';
  /** Non-mutating export integrity audit (build 271/272). */
  exportIntegrityOk?: boolean;
  exportIntegrityReasons?: string[];
  exportIntegrityMarker?: string;
  stage: ExportReadyStage;
};

export type PrepareExportReadyResult =
  | {
    ok: true;
    cv: CVData;
    diagnostics: ExportReadyDiagnostics;
  }
  | {
    ok: false;
    reason: string;
    stage: ExportReadyStage;
    diagnostics: ExportReadyDiagnostics;
  };

export type PreviewSummaryRenderEvidence = {
  previewRenderedSummaryHash: string;
  previewRenderAuthority: NonNullable<ExportReadyDiagnostics['previewRenderAuthority']>;
  selectedFinalSummaryHash: string | null;
  /** Identity of the visible/raw CV state from which Preview was terminalized. */
  previewSnapshotId?: string;
  /** Hash of the saved/editor Summary before terminal recovery. */
  previewSourceSummaryHash?: string;
  /** Hash of the terminal Summary on the exact object supplied to the template. */
  previewInputSummaryHash?: string;
  /** Hash of the Summary on the exact data object committed to the template. */
  templatePreviewSummaryHash?: string;
  /** Hash witnessed in the committed template DOM; null means it was not found. */
  templateLeafSummaryHash?: string | null;
  previewSelectedFinalParityPassed?: boolean | null;
};

/**
 * Privacy-safe identity for the visible CV state shared by Preview and export.
 * Cached localization metadata is deliberately excluded: acquiring a cache entry
 * must not turn an otherwise unchanged user-visible snapshot into a new snapshot.
 */
export function buildPreviewSummarySnapshotId(
  cv: CVData,
  locale: Locale,
  context?: { industry?: string; level?: string },
): string {
  return hashSummaryV2Text(JSON.stringify({
    id: cv.id,
    locale,
    templateId: cv.templateId,
    summaryHash: hashSummaryV2Text(cv.summary || ''),
    summaryOrigin: cv.summaryOrigin || null,
    summaryGeneratedLocale: cv.summaryGeneratedLocale || null,
    gender: cv.personal?.gender || null,
    jobTitleHash: hashSummaryV2Text(cv.personal?.jobTitle || ''),
    industry: context?.industry || null,
    level: context?.level || null,
    experience: (cv.experience || []).map((entry) => ({
      id: entry.id,
      companyHash: hashSummaryV2Text(entry.company || ''),
      positionHash: hashSummaryV2Text(entry.position || ''),
      startDate: entry.startDate || '',
      endDate: entry.endDate || '',
      isPresent: Boolean(entry.isPresent),
      visibleHash: hashSummaryV2Text(entry.description || ''),
      immutableHash: hashSummaryV2Text(
        entry.originalUserDescription
        || entry.canonicalDescription
        || entry.description
        || '',
      ),
    })),
  }));
}

/**
 * Preview is a synchronous consumer of the export terminalizer.  For an
 * app-owned Summary whose saved surface has failed V2 ownership, there is no
 * safe fallback to the stale textarea: use the selected recovery verbatim, or
 * expose an unresolved (blank) Summary.  The caller deliberately excludes
 * user-authored summaries from this helper.
 */
export function applyAppOwnedSummaryPreviewTerminalSnapshot(
  cv: CVData,
  prepared: PrepareExportReadyResult,
  options?: { forceAppOwnedTerminal?: boolean },
): CVData {
  const terminalRequired = options?.forceAppOwnedTerminal === true
    || prepared.diagnostics.summaryValidationAuthoritySource
    === 'app_owned_v2_manifest'
    || prepared.diagnostics.savedSummaryOwnershipPassed === false;
  if (!terminalRequired) return cv;
  if (!prepared.ok) {
    return { ...cv, summary: '' };
  }
  return {
    ...cv,
    summary: prepared.cv.summary,
    summaryOrigin: prepared.cv.summaryOrigin,
    summaryGeneratedLocale: prepared.cv.summaryGeneratedLocale,
  };
}

/**
 * Preview's diagnostic witness is derived only from the exact object passed to
 * the template renderer, after its terminal Summary has been selected.  It is
 * intentionally separate from export preparation, which cannot observe React.
 */
export function describePreviewSummaryRender(
  renderedCv: Pick<CVData, 'summary'>,
  prepared: PrepareExportReadyResult | null,
  appOwnedSummary: boolean,
  options?: {
    previewSnapshotId?: string;
    previewSourceSummaryHash?: string;
    previewInputSummaryHash?: string;
    selectedFinalSummaryHash?: string | null;
  },
): PreviewSummaryRenderEvidence {
  const rendered = hashSummaryV2Text(renderedCv.summary || '');
  const selected = options?.selectedFinalSummaryHash
    || prepared?.diagnostics.selectedFinalSummaryHash
    || null;
  const snapshotFields = options?.previewSnapshotId
    ? {
      previewSnapshotId: options.previewSnapshotId,
      previewSourceSummaryHash: options.previewSourceSummaryHash
        || hashSummaryV2Text(renderedCv.summary || ''),
      previewInputSummaryHash: options.previewInputSummaryHash
        || hashSummaryV2Text(renderedCv.summary || ''),
      templatePreviewSummaryHash: rendered,
      templateLeafSummaryHash: null,
      previewSelectedFinalParityPassed: null,
    }
    : {};
  if (!appOwnedSummary) {
    return {
      previewRenderedSummaryHash: rendered,
      previewRenderAuthority: 'manual_saved',
      selectedFinalSummaryHash: selected,
      ...snapshotFields,
    };
  }
  if ((!prepared?.ok && !options?.selectedFinalSummaryHash)
    || !selected
    || !(renderedCv.summary || '').trim()) {
    return {
      previewRenderedSummaryHash: rendered,
      previewRenderAuthority: 'unresolved',
      selectedFinalSummaryHash: selected,
      ...snapshotFields,
    };
  }
  return {
    previewRenderedSummaryHash: rendered,
    previewRenderAuthority: rendered === selected ? 'selected_final' : 'render_mismatch',
    selectedFinalSummaryHash: selected,
    ...snapshotFields,
  };
}

/**
 * Converts intended Preview evidence into a leaf-render witness only after the
 * selected template has committed. A missing Summary in the actual DOM is a
 * render mismatch, never an inferred successful render.
 */
export function commitPreviewSummaryLeafEvidence(
  evidence: PreviewSummaryRenderEvidence,
  summary: string,
  templateTextContent: string,
): PreviewSummaryRenderEvidence {
  const normalizedSummary = String(summary || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const normalizedDom = String(templateTextContent || '').normalize('NFKC').replace(/\s+/gu, ' ').trim();
  const leafHash = normalizedSummary && normalizedDom.includes(normalizedSummary)
    ? hashSummaryV2Text(summary)
    : null;
  const selected = evidence.selectedFinalSummaryHash;
  const appOwnedSelected = evidence.previewRenderAuthority === 'selected_final'
    || evidence.previewRenderAuthority === 'render_mismatch';
  const parityPassed = appOwnedSelected
    ? Boolean(leafHash && selected && leafHash === selected)
    : null;
  return {
    ...evidence,
    templatePreviewSummaryHash: hashSummaryV2Text(summary || ''),
    templateLeafSummaryHash: leafHash,
    previewRenderedSummaryHash: leafHash || hashSummaryV2Text(''),
    previewRenderAuthority: appOwnedSelected
      ? (parityPassed ? 'selected_final' : 'render_mismatch')
      : evidence.previewRenderAuthority,
    previewSelectedFinalParityPassed: parityPassed,
  };
}

export function sameSnapshotPreviewParityFailure(options: {
  evidence: PreviewSummaryRenderEvidence | null | undefined;
  sourceCv: CVData;
  locale: Locale;
  context?: { industry?: string; level?: string };
  selectedFinalSummaryHash: string | null | undefined;
}): boolean {
  const evidence = options.evidence;
  if (!evidence?.previewSnapshotId) return false;
  if (evidence.previewSnapshotId !== buildPreviewSummarySnapshotId(
    options.sourceCv,
    options.locale,
    options.context,
  )) {
    return false;
  }
  if (evidence.previewRenderAuthority === 'render_mismatch'
    || evidence.previewSelectedFinalParityPassed === false) {
    // A leaf mismatch is authoritative for this exact input snapshot even
    // when the divergent Preview/export paths also selected different hashes.
    return true;
  }
  if (evidence.previewRenderAuthority !== 'selected_final') return false;
  if (!options.selectedFinalSummaryHash) return true;
  // The selected template leaf, Preview terminalizer, and export terminalizer
  // are one contract. A disagreement between their selected hashes is itself
  // a same-snapshot parity failure even when Preview's internal leaf witness
  // matched the Preview-selected value.
  return evidence.selectedFinalSummaryHash !== options.selectedFinalSummaryHash
    || evidence.previewRenderedSummaryHash !== options.selectedFinalSummaryHash;
}

function fail(
  reason: string,
  stage: ExportReadyStage,
  diagnostics: ExportReadyDiagnostics,
): PrepareExportReadyResult {
  return {
    ok: false,
    reason,
    stage,
    diagnostics: { ...diagnostics, stage },
  };
}

const COOKING_TRIAD: SemanticDutyKey[] = [
  'food_preparation_restaurant_standards',
  'workplace_hygiene',
  'kitchen_team_collaboration',
];

/** Unsupported Summary claims for non-food / non-logistics Experience packages. */
function summaryHasUnsupportedDomainClaims(summary: string, experienceBlob: string): boolean {
  const s = (summary || '').normalize('NFKC');
  if (!s.trim()) return false;
  const src = (experienceBlob || '').normalize('NFKC');
  const cookingClaim = /(?:restaurant\s+standard|kitchen\s+standard|إعداد\s*الأطباق|تحضير\s*(?:الأطباق|الطعام)|طبق|أطباق|طعام|مطبخ|مطعم|dish(?:es)?|cuisine|jel\w*|kuhinj)/iu.test(s);
  const cookingSupport = /(?:restaurant|kitchen|dish|cuisine|jel\w*|kuhinj|مطبخ|مطعم|طبق|أطباق|طعام|व्यंजन|रसोई)/iu.test(src);
  if (cookingClaim && !cookingSupport) return true;
  const transportClaim = /(?:transport(?:ing|ed)?|loading|deliver(?:y|ing|ed)?|نقل|تحميل|تسليم|تحميل\s*البضائع|توصيل)/iu.test(s)
    && !/(?:design\s+deliver|deliverable)/iu.test(s);
  const transportSupport = /(?:transport|loading|deliver(?!able)|نقل|تحميل|تسليم|prevoz|isporuč|परिवहन|डिलीवरी)/iu.test(src);
  if (transportClaim && !transportSupport) return true;
  return false;
}

function structuredExemptions(cv: CVData) {
  return {
    fullName: cv.personal?.fullName || '',
    email: cv.personal?.email || '',
    phone: cv.personal?.phone || '',
    companies: (cv.experience || []).map((e) => e.company || '').filter(Boolean),
    jobTitles: [
      cv.personal?.jobTitle || '',
      ...(cv.experience || []).map((e) => e.position || ''),
    ].filter(Boolean),
  };
}

/** Strip structured proper nouns before script classification. */
function stripStructuredProperNouns(text: string, cv: CVData): string {
  let t = text;
  const exemptions = structuredExemptions(cv);
  for (const value of [
    exemptions.fullName,
    exemptions.email,
    exemptions.phone,
    ...exemptions.companies,
    ...exemptions.jobTitles,
  ]) {
    const v = (value || '').trim();
    if (v.length >= 2) {
      t = t.split(v).join(' ');
    }
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Material final Experience bullets must match requested locale.
 * en / mixed / empty after proper-noun strip ⇒ incomplete projection.
 * Per-bullet target-locale purity (build 271/272) — one English bullet fails sr.
 */
function experienceBulletsMatchRequestedLocale(
  description: string,
  requestedLocale: Locale,
  cv: CVData,
): boolean {
  const bullets = splitExperienceBullets(description);
  if (!bullets.length) return false;
  const exemptions = structuredExemptions(cv);
  for (const bullet of bullets) {
    const stripped = stripStructuredProperNouns(bullet, cv);
    if (!stripped) continue;
    if (requestedLocale === 'hi') {
      const script = classifyMaterialBulletScript(stripped);
      if (script === 'en' || script === 'mixed' || script === 'empty') return false;
    }
    if (!textMatchesRequestedFieldLocale(stripped, requestedLocale, 'experience_bullet', exemptions)) {
      return false;
    }
  }
  const purity = validateAiUnitLocalePurity(description, requestedLocale, {
    kind: 'experience_bullet',
    requireUnits: true,
  });
  if (!purity.ok) return false;
  return true;
}

/**
 * Project Experience display into requestedLocale from semantic duties.
 * Does not mutate canonical user facts (originalUserDescription / canonicalSnapshot).
 * Two Hindi lines may cover the cooking triad — never pad with English shells.
 */
function projectExperienceDisplayFromSemanticDuties(
  exp: WorkExperience,
  grounding: ExperienceSemanticGrounding,
  requestedLocale: Locale,
  gender: string,
  cv: CVData,
  exportContext?: { industry?: string; level?: string },
): string {
  const current = (exp.description || '').trim();
  if (grounding.source === 'user_origin_recovered') {
    const sourceBoundProjection = projectExperienceFromLocalizedSurfaces({
      cv,
      exp,
      grounding,
      targetLocale: requestedLocale,
    });
    if (sourceBoundProjection !== null) return sourceBoundProjection;
  }
  const jobCtx = buildExperienceJobContext({
    position: exp.position || cv.personal?.jobTitle,
    locale: requestedLocale,
    industry: exportContext?.industry,
    level: exportContext?.level,
  });
  const authoritativeSourceRaw = (
    exp.originalUserDescription
    || exp.canonicalDescription
    || ''
  ).trim();
  // Do not rebuild from prior-occupation cooking shells under pharmacist/tech roles.
  const authoritativeSource = (
    textLooksLikeCookingDuties(authoritativeSourceRaw)
    && jobCtx.positionClass !== 'baker_food'
    && jobCtx.positionClass !== 'hospitality_service'
    && jobCtx.industryNorm !== 'hospitality'
  ) || (
    hasUnsupportedRegulatedPharmacyClaims(authoritativeSourceRaw)
    && !hasGenuineUserExperienceGrounding(exp)
  )
    ? ''
    : authoritativeSourceRaw;

  // Prefer domain-aware cross-locale shells over line-localizers that can
  // mis-map generic verbs into the wrong occupation domain.
  if (current && !experienceBulletsMatchRequestedLocale(current, requestedLocale, cv)) {
    const sourceLocale = detectTextLocale(authoritativeSource || current, {
      storedLocale: exp.generatedLocale || cv.contentLocale,
      generatedLocale: exp.generatedLocale,
    });
    if (isCrossLocaleOperation(sourceLocale, requestedLocale) || sourceLocale === 'unknown') {
      const translated = buildCrossLocaleExperienceFallback({
        sourceDescription: authoritativeSource || current,
        sourceLocale: sourceLocale === 'unknown' ? (exp.generatedLocale || null) : sourceLocale,
        targetLocale: requestedLocale,
        gender,
        isPresent: Boolean(exp.isPresent),
        position: exp.position || cv.personal?.jobTitle,
      });
      if (
        translated
        && experienceBulletsMatchRequestedLocale(translated, requestedLocale, cv)
      ) {
        return translated;
      }
    }
  }

  if (authoritativeSource) {
    const post = validateExperienceApplyMaterialPostcondition(authoritativeSource, current);
    if (!post.ok || !current) {
      const rebuilt = buildSourcePreservingExperienceBullets(
        authoritativeSource,
        requestedLocale,
        gender,
        { isPresent: Boolean(exp.isPresent) },
      );
      if (
        rebuilt
        && validateExperienceApplyMaterialPostcondition(authoritativeSource, rebuilt).ok
        && validateSourceFactIdentityCoverage(authoritativeSource, rebuilt).ok
      ) {
        // Accept source-preserving rebuild even when locale projection cannot
        // translate unknown occupations — never invent role stereotypes instead.
        return rebuilt;
      }
    }
  } else if (
    textLooksLikeCookingDuties(current)
    && jobCtx.positionClass !== 'baker_food'
    && jobCtx.positionClass !== 'hospitality_service'
    && jobCtx.industryNorm !== 'hospitality'
  ) {
    return buildOccupationAwareExperienceFallback({
      locale: requestedLocale,
      gender,
      position: exp.position,
      industry: jobCtx.industryNorm,
      isPresent: exp.isPresent,
    });
  }

  if (current && experienceBulletsMatchRequestedLocale(current, requestedLocale, cv)) {
    if (
      !authoritativeSource
      || validateExperienceApplyMaterialPostcondition(authoritativeSource, current).ok
    ) {
      return current;
    }
  }

  const keys = semanticDutyKeys(grounding);
  const hasCookingTriad = COOKING_TRIAD.every((k) => keys.includes(k));

  // Compact Hindi cooking triad: 2 display lines, 3 semantic meanings.
  if (requestedLocale === 'hi' && hasCookingTriad) {
    const isPresent = Boolean(exp.isPresent);
    const prep = localizeCanonicalBulletLine(
      'Prepare dishes according to restaurant standards.',
      'hi',
      gender,
      { isPresent },
    );
    const hygieneCollab = localizeCanonicalBulletLine(
      'Maintain workplace hygiene and collaborate with the kitchen team.',
      'hi',
      gender,
      { isPresent },
    );
    const compact = formatExperienceBullets(
      [prep, hygieneCollab].map((l) => l.replace(/^मैं\s+/u, '').trim()).filter(Boolean),
    );
    if (compact && experienceBulletsMatchRequestedLocale(compact, 'hi', cv)) {
      return compact;
    }
  }

  if (grounding.duties.length > 0) {
    const shells = internalShellsFromSemanticDuties(grounding.duties);
    const facts = splitExperienceBullets(shells).map((sourceText, i) => ({
      id: `export-duty-${exp.id}-${i}`,
      type: 'experience_bullet' as const,
      value: sourceText,
      sourceText,
      category: undefined,
      source: 'export_semantic' as const,
    }));
    const projected = deterministicLocalizedBulletsFromCanonical(
      facts,
      requestedLocale,
      gender,
      { isPresent: Boolean(exp.isPresent) },
    );
    if (projected && experienceBulletsMatchRequestedLocale(projected, requestedLocale, cv)) {
      return projected;
    }
  }

  // Last resort: localize each current visible line in place.
  if (current) {
    const localized = formatExperienceBullets(
      splitExperienceBullets(current)
        .map((line) => localizeCanonicalBulletLine(line, requestedLocale, gender, {
          isPresent: Boolean(exp.isPresent),
        }) || '')
        .filter(Boolean),
    );
    if (localized && experienceBulletsMatchRequestedLocale(localized, requestedLocale, cv)) {
      return localized;
    }
  }

  return current;
}

function buildSemanticSummaryFactSet(
  cv: CVData,
  groundingById: Map<string, ExperienceSemanticGrounding>,
  options: { locale: Locale; gender: string; referenceDate: Date | string },
): { factSet: CvCanonicalFactSet; source: ExportReadyDiagnostics['summaryFactSetSource']; keys: SemanticDutyKey[] } {
  const snapshot = captureSummaryV2Snapshot({
    cv,
    locale: options.locale,
    gender: options.gender,
    referenceDateIso: typeof options.referenceDate === 'string'
      ? options.referenceDate
      : options.referenceDate.toISOString().slice(0, 10),
  });
  const manifest = buildSummaryV2SelectionManifest(snapshot);
  const selectedEntries = [manifest.current, ...manifest.priors]
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const selectedIds = new Set(selectedEntries.map((entry) => entry.entryId));
  const keys: SemanticDutyKey[] = [];
  const experience = (cv.experience || []).flatMap((exp) => {
    if (!selectedIds.has(exp.id)) return [];
    const grounding = groundingById.get(exp.id) || { source: 'none' as const, duties: [] };
    const selected = selectedEntries.find((entry) => entry.entryId === exp.id);
    const facts = selected?.facts || [];
    // Summary V2's selected immutable facts, not all historical Experience
    // entries, are authoritative for the export Summary fact set.
    const factText = formatExperienceBullets(facts.map((fact) => fact.bulletText));
    keys.push(...semanticDutyKeys(grounding));
    return [{
      ...exp,
      // Fact-set only: never write these shells into the returned export description.
      description: factText || exp.description,
    }];
  });
  const factSet = buildCvCanonicalFactSet({
    ...cv,
    experience,
    summary: cv.canonicalSummary || (cv.summaryOrigin === 'user' ? cv.summary : ''),
  });
  const bulletCount = factSet.facts.filter((f) => f.type === 'experience_bullet').length;
  const source: ExportReadyDiagnostics['summaryFactSetSource'] = bulletCount > 0
    ? (keys.length > 0 ? 'semantic_duties' : 'modern_provenance')
    : 'none';
  return { factSet, source, keys: [...new Set(keys)] };
}

/**
 * Prepare one immutable export-ready CV for PDF and DOCX.
 * Must run before any template renderer branch.
 */
export function prepareExportReadyCv(
  rawCv: CVData,
  requestedLocale: Locale,
  templateId?: TemplateId | string,
  options?: {
    gender?: string;
    referenceDate?: Date | string;
    /** UI industry token used when Experience AI stamped generationJobContextKey. */
    industry?: string;
    /** UI level token used when Experience AI stamped generationJobContextKey. */
    level?: string;
  },
): PrepareExportReadyResult {
  const selectedTemplateId = templateId || rawCv.templateId;
  const gender = options?.gender || rawCv.personal?.gender || '';
  const exportIndustry = options?.industry;
  const exportLevel = options?.level;
  const jobContextForExport = (position?: string) => buildExperienceJobContext({
    position,
    locale: requestedLocale,
    industry: exportIndustry,
    level: exportLevel,
  });
  let stage: ExportReadyStage = 'normalize_runtime';
  // Once selected, this terminal per-entry decision must survive every later
  // Summary/export failure diagnostic. A later gate may fail the export, but
  // it must not erase the already-evaluated presentation truth.
  let terminalExperiencePresentation: ExperiencePresentationSnapshot | null = null;

  const baseDiagnostics = (): ExportReadyDiagnostics => ({
    selectedTemplateId,
    requestedLocale,
    runtimeMigrationVersion: undefined,
    experienceCount: (rawCv.experience || []).length,
    recoveryInvoked: false,
    experienceProvenance: [],
    summaryFactSetSource: 'none',
    summarySemanticDutyKeys: [],
    summaryWordBudgetCompactionRevision: SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION,
    summaryCurrentTextAuthorityRevision: SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION,
    ...(terminalExperiencePresentation ? {
      experiencePresentation: terminalExperiencePresentation.records,
      experiencePresentationSnapshotId: terminalExperiencePresentation.presentationSnapshotId,
    } : {}),
    stage,
  });

  let cv = normalizeLegacyCvRuntime(rawCv, requestedLocale);
  stage = 'normalize_region';
  cv = { ...cv, region: normalizeCvRegion(cv.region), templateId: selectedTemplateId as TemplateId };

  stage = 'resolve_provenance';
  const groundingById = new Map<string, ExperienceSemanticGrounding>();
  let recoveryInvoked = false;
  let changed = false;

  stage = 'recover_legacy_grounding';
  const summaryFactKeysBefore: string[] = [];
  let occupationGenericFallbackUsed = false;
  let unsupportedRoleSpecificClaimReason: string | undefined;
  let staleSummaryExcluded = false;

  const nextExperience: WorkExperience[] = (cv.experience || []).map((exp) => {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    let grounding = resolveExperienceSemanticGrounding(exp, {
      canonicalSnapshot: cv.canonicalSnapshot,
    });
    summaryFactKeysBefore.push(...semanticDutyKeys(grounding));
    const filteredDuties = filterSemanticDutiesForJobContext(grounding.duties, jobCtx);
    if (filteredDuties.length !== grounding.duties.length) {
      grounding = {
        ...grounding,
        duties: filteredDuties,
        source: filteredDuties.length > 0 ? grounding.source : 'none',
      };
    }
    groundingById.set(exp.id, grounding);
    recoveryInvoked = true;

    let description = exp.description;
    const cookingConflict = textLooksLikeCookingDuties(description || '')
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality';
    const userAllowsRegulated = hasGenuineUserExperienceGrounding(exp)
      && hasUnsupportedRegulatedPharmacyClaims(
        exp.originalUserDescription || exp.canonicalDescription || '',
      );
    const regulatedConflict = hasUnsupportedRegulatedPharmacyClaims(description || '')
      && !userAllowsRegulated
      && (jobCtx.positionClass === 'pharmacist_pharmacy' || jobCtx.industryNorm === 'pharmacy');

    if (cookingConflict || regulatedConflict) {
      description = buildOccupationAwareExperienceFallback({
        locale: requestedLocale,
        gender,
        position: exp.position,
        industry: jobCtx.industryNorm,
        isPresent: exp.isPresent,
      });
      occupationGenericFallbackUsed = true;
      if (cookingConflict) unsupportedRoleSpecificClaimReason = 'stale_cooking_duties_excluded';
      if (regulatedConflict) unsupportedRoleSpecificClaimReason = 'unsupported_regulated_pharmacy_claim';
      changed = true;
    }

    if (grounding.source === 'legacy_recovered_display_duties' && grounding.duties.length > 0) {
      const shells = internalShellsFromSemanticDuties(grounding.duties);
      const prevShells = (exp.originalUserDescription || '').trim();
      const needsWrite = !prevShells
        || exp.groundingRecoverySource !== LEGACY_RECOVERED_DISPLAY_DUTIES
        || splitExperienceBullets(prevShells).length < grounding.duties.length;
      if (needsWrite) {
        changed = true;
        return {
          ...exp,
          originalUserDescription: shells,
          canonicalDescription: shells,
          groundingRecoverySource: LEGACY_RECOVERED_DISPLAY_DUTIES,
          descriptionOrigin: exp.descriptionOrigin || 'ai_generated',
          description,
          recoveredSemanticDuties: grounding.duties,
        } as WorkExperience;
      }
      return {
        ...exp,
        description,
        recoveredSemanticDuties: grounding.duties,
      } as WorkExperience;
    }

    if (grounding.source === 'user_origin_recovered' && grounding.duties.length > 0) {
      return {
        ...exp,
        description,
        groundingRecoverySource: LEGACY_USER_ORIGIN_DUTIES,
        recoveredSemanticDuties: grounding.duties,
      } as WorkExperience;
    }

    return {
      ...exp,
      description,
      recoveredSemanticDuties: grounding.duties,
    } as WorkExperience;
  });

  cv = { ...cv, experience: nextExperience };
  void changed;

  stage = 'produce_semantic_duties';
  const failedUserOriginRecovery = [...groundingById.values()]
    .find((grounding) => Boolean(grounding.recoveryFailureReason));
  if (failedUserOriginRecovery?.recoveryFailureReason) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
    return fail(failedUserOriginRecovery.recoveryFailureReason, stage, diagnostics);
  }
  const hadDisplay = (rawCv.experience || []).some((exp) => Boolean(
    (exp.description || '').trim() || (exp.generatedDescription || '').trim(),
  ));
  const allKeys = [...groundingById.values()].flatMap((g) => semanticDutyKeys(g));
  const hasContextSafeEmptyDutyDisplay = (cv.experience || []).some((exp) => {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    const desc = (exp.description || '').trim();
    if (!desc) return false;
    if (
      textLooksLikeCookingDuties(desc)
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality'
    ) {
      return false;
    }
    if (
      hasUnsupportedRegulatedPharmacyClaims(desc)
      && !hasGenuineUserExperienceGrounding(exp)
    ) {
      return false;
    }
    const contextOk = Boolean(
      exp.generationJobContextKey
      && exp.generationJobContextKey === jobCtx.key,
    );
    const fallbackOrigin = exp.descriptionOrigin === 'deterministic_fallback';
    if (!contextOk && !fallbackOrigin && !occupationGenericFallbackUsed) return false;
    return experienceBulletsMatchRequestedLocale(desc, requestedLocale, cv);
  });
  const hasMaterialSourceFacts = (cv.experience || []).some((exp) => {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    const source = (exp.originalUserDescription || exp.canonicalDescription || '').trim();
    if (!source) return false;
    // Cooking material under a non-food role is not a safe export grounding source.
    if (
      textLooksLikeCookingDuties(source)
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality'
    ) {
      return false;
    }
    return materialDutyKeysFromDescription(source).some((k) => k !== 'generic_duty');
  });
  if (
    hadDisplay
    && allKeys.length === 0
    && !occupationGenericFallbackUsed
    && !hasContextSafeEmptyDutyDisplay
    && !hasMaterialSourceFacts
  ) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
    return fail('legacy_export_recovery_no_safe_duties', stage, diagnostics);
  }

  stage = 'produce_localized_display';
  // Exact recovered manual clauses may be projected cross-locale only from a
  // validated persisted surface whose immutable binding still matches.
  const unboundCrossLocaleUserOrigin = (cv.experience || []).find((exp) => {
    const grounding = groundingById.get(exp.id);
    if (!grounding || !recoveredUserOriginNeedsSourceBoundLocalization(
      grounding,
      requestedLocale,
    )) return false;
    return projectExperienceFromLocalizedSurfaces({
      cv,
      exp,
      grounding,
      targetLocale: requestedLocale,
    }) === null;
  });
  if (unboundCrossLocaleUserOrigin) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summarySemanticDutyKeys = [...new Set(allKeys)];
    return fail(
      'experience_localization_source_binding_missing',
      stage,
      diagnostics,
    );
  }
  // Fail closed on impure AI-managed units before any export rewrite/projection.
  {
    const preIntegrity = auditCvExportIntegrity(cv, requestedLocale, {
      requireSummaryDuration: false,
    });
    const hardEntries = preIntegrity.entries.filter((e) =>
      !e.ok
      && (
        e.mixedLanguageBulletCount > 0
        || e.crossDomainLeakageDetected
        || e.crossEntryLeakageDetected
      ));
    // Do not hard-fail Summary impurity here — Summary recovery may rebuild it.
    if (hardEntries.length) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.exportIntegrityOk = false;
      diagnostics.exportIntegrityReasons = preIntegrity.reasons;
      diagnostics.exportIntegrityMarker = preIntegrity.marker;
      return fail(
        hardEntries[0]?.reasons[0]
          || preIntegrity.reasons[0]
          || 'export_integrity_failed',
        'validate_locale_integrity',
        diagnostics,
      );
    }
  }
  cv = {
    ...cv,
    experience: (cv.experience || []).map((exp) => {
      // Immutable AI/deterministic display surfaces are resolved exclusively
      // by the shared terminal presentation contract below.  The legacy
      // formatter is retained for user/manual paths, but must never synthesize
      // a target-looking value that hides a missing source-bound projection.
      if (!canUseLegacyExperienceDisplayProjection(exp)) {
        return exp;
      }
      const grounding = groundingById.get(exp.id) || { source: 'none' as const, duties: [] };
      const projected = projectExperienceDisplayFromSemanticDuties(
        exp,
        grounding,
        requestedLocale,
        gender,
        cv,
        { industry: exportIndustry, level: exportLevel },
      );
      return { ...exp, description: projected };
    }),
  };

  // Re-run the shared display contract over the completed export projection so
  // preview and both renderers expose the same per-entry authority metadata.
  const presentationSnapshot = resolveExperiencePresentationSnapshot({
    cv,
    targetLocale: requestedLocale,
  });
  terminalExperiencePresentation = presentationSnapshot;
  if (!presentationSnapshot.ok) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.experiencePresentation = presentationSnapshot.records;
    diagnostics.experiencePresentationSnapshotId = presentationSnapshot.presentationSnapshotId;
    diagnostics.summarySemanticDutyKeys = [...new Set(allKeys)];
    return fail('localized_display_projection_incomplete', stage, diagnostics);
  }
  cv = presentationSnapshot.cv;

  // Hard postcondition: never report projection ok with English/mixed bullets.
  for (const exp of cv.experience || []) {
    const grounding = groundingById.get(exp.id);
    if (!grounding || grounding.duties.length === 0) continue;
    if (!experienceBulletsMatchRequestedLocale(exp.description || '', requestedLocale, cv)) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summarySemanticDutyKeys = [...new Set(allKeys)];
      return fail('localized_display_projection_incomplete', stage, diagnostics);
    }
  }

  const preservedDescriptions = new Map(
    (cv.experience || []).map((exp) => [exp.id, exp.description]),
  );

  stage = 'construct_summary_fact_set';
  const summaryReferenceDate = options?.referenceDate ?? new Date();
  const summarySnapshot = captureSummaryV2Snapshot({
    cv,
    locale: requestedLocale,
    gender,
    referenceDateIso: typeof summaryReferenceDate === 'string'
      ? summaryReferenceDate
      : summaryReferenceDate.toISOString().slice(0, 10),
  });
  const summaryManifest = buildSummaryV2SelectionManifest(summarySnapshot);
  // The immutable source manifest remains the ownership authority. A selected
  // recovery may carry a target-native role presentation projection that must
  // be used consistently by recovery, post-write and export validation.
  let finalSummaryManifest = summaryManifest;
  const selectedSummaryEntries = [summaryManifest.current, ...summaryManifest.priors]
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const selectedSummaryIds = new Set(selectedSummaryEntries.map((entry) => entry.entryId));
  const summarySelectedEntryHashes = selectedSummaryEntries.map((entry) => hashSummaryV2Text(entry.entryId));
  const summaryOmittedEntryHashes = (cv.experience || [])
    .filter((entry) => !selectedSummaryIds.has(entry.id))
    .map((entry) => hashSummaryV2Text(entry.id));
  const summaryRequiredFactHashes = [
    ...summaryManifest.requiredCurrentFacts,
    ...summaryManifest.requiredPriorFacts,
  ].map((fact) => ({
    owningEntryHash: hashSummaryV2Text(fact.entryId),
    factHash: fact.sourceFactHash,
  }));
  const savedSummaryHasSelectedStructuredSurface = selectedSummaryEntries.some((entry) => {
    const visible = (cv.summary || '').normalize('NFKC').toLocaleLowerCase();
    const surfaces = [entry.role, entry.employer]
      .map((surface) => (surface || '').normalize('NFKC').toLocaleLowerCase().trim())
      .filter(Boolean);
    return surfaces.some((surface) => visible.includes(surface));
  });
  // Only route stored app-owned Summary prose through the V2 rebuild when the
  // shared relational validator has actually found a role/employer/date/fact
  // owner conflict. Older deterministic summaries legitimately carry the same
  // origin enum but retain their established bounded legacy recovery path.
  const savedAppOwnedStructuredSummary = cv.summaryOrigin !== 'user'
    && selectedSummaryEntries.length > 0
    && savedSummaryHasSelectedStructuredSurface;
  const savedAppOwnedV2Validation = savedAppOwnedStructuredSummary
    ? validateSummaryV2AgainstManifest(cv.summary || '', summaryManifest, {
      candidateSource: 'final_selected',
    })
    : null;
  const appOwnedSummaryRequiresV2Authority = Boolean(
    savedAppOwnedV2Validation
    && savedAppOwnedV2Validation.relationalOwnershipFailureReasons.length > 0,
  );
  const summaryValidationAuthoritySource: NonNullable<ExportReadyDiagnostics['summaryValidationAuthoritySource']> =
    appOwnedSummaryRequiresV2Authority
      ? 'app_owned_v2_manifest'
      : cv.summaryOrigin === 'user'
        ? 'manual_saved_summary'
        : 'app_owned_unstructured_legacy';
  let summaryV2ValidationForDiagnostics: SummaryV2ValidationResult | null =
    appOwnedSummaryRequiresV2Authority ? savedAppOwnedV2Validation : null;
  let recoveryV2ValidationForDiagnostics: SummaryV2ValidationResult | null = null;
  let recoveryLocalePurityForDiagnostics: ReturnType<typeof validateAiUnitLocalePurity> | null = null;
  let recoveryCandidateHashForDiagnostics: string | null = null;
  let recoveryFactPresentationForDiagnostics: SummaryRecoveryFactPresentationEvidence[] = [];
  let selectedFinalSummaryHashForDiagnostics: string | null = null;
  let selectedFinalSourceForDiagnostics: string | null = null;
  const assignSummaryV2Diagnostics = (diagnostics: ExportReadyDiagnostics) => {
    diagnostics.summaryValidationAuthoritySource = summaryValidationAuthoritySource;
    diagnostics.summarySavedProvenance = rawCv.summaryOrigin || 'user';
    diagnostics.summarySavedSummaryReboundRevalidated = appOwnedSummaryRequiresV2Authority;
    diagnostics.savedSummaryHash = hashSummaryV2Text(rawCv.summary || '');
    diagnostics.savedSummaryOwnershipPassed = savedAppOwnedV2Validation
      ? savedAppOwnedV2Validation.relationalOwnershipValidationPassed
      : null;
    diagnostics.savedSummaryOwnershipFailureReasons = savedAppOwnedV2Validation
      ? savedAppOwnedV2Validation.relationalOwnershipFailureReasons
      : [];
    diagnostics.savedSummaryJobContextPassed = rawCv.summaryOrigin === 'user'
      ? null
      : Boolean(rawCv.summaryGenerationContextKey && summaryContextMatch);
    diagnostics.recoveryCandidateHash = recoveryCandidateHashForDiagnostics || undefined;
    diagnostics.recoveryCandidateLocaleValidationPassed = recoveryLocalePurityForDiagnostics
      ? recoveryLocalePurityForDiagnostics.targetLocalePurityPassed
      : null;
    diagnostics.recoveryCandidateNativeSurfacePassed = recoveryV2ValidationForDiagnostics
      ? recoveryV2ValidationForDiagnostics.ok
      : null;
    diagnostics.recoveryCandidateOwnershipPassed = recoveryV2ValidationForDiagnostics
      ? recoveryV2ValidationForDiagnostics.relationalOwnershipValidationPassed
      : null;
    diagnostics.recoveryCandidateRejectionReasons = recoveryV2ValidationForDiagnostics
      ? (recoveryV2ValidationForDiagnostics.ok
        ? []
        : [
          ...(recoveryV2ValidationForDiagnostics.reason
            ? [recoveryV2ValidationForDiagnostics.reason]
            : []),
          ...recoveryV2ValidationForDiagnostics.relationalOwnershipFailureReasons,
        ])
      : [];
    diagnostics.rawRecoveryWordCount = rawRecoveryWordCount;
    diagnostics.rawRecoveryWordBudgetPassed = rawRecoveryWordBudgetPassed;
    diagnostics.compactionAttempted = compactionAttempted;
    diagnostics.compactedRecoveryWordCount = compactedRecoveryWordCount;
    diagnostics.selectedFinalWordCount = selectedFinalWordCount;
    diagnostics.selectedFinalWordBudgetPassed = selectedFinalWordBudgetPassed;
    diagnostics.recoveryDetectedLocaleByUnit = recoveryLocalePurityForDiagnostics
      ? recoveryLocalePurityForDiagnostics.detectedLocaleByUnit
      : [];
    diagnostics.recoveryDetectedScriptByUnit = recoveryLocalePurityForDiagnostics
      ? recoveryLocalePurityForDiagnostics.detectedScriptByUnit
      : [];
    diagnostics.recoveryFactPresentation = recoveryFactPresentationForDiagnostics;
    diagnostics.selectedFinalSummaryHash = selectedFinalSummaryHashForDiagnostics || undefined;
    diagnostics.selectedFinalSource = selectedFinalSourceForDiagnostics;
    // Export preparation has no access to React's rendered Preview value.
    // Preserve this deprecated field as unavailable rather than pretending the
    // intended selected candidate was visibly rendered.
    diagnostics.visiblePreviewSummaryHash = null;
    diagnostics.exportSummaryHash = selectedFinalSummaryHashForDiagnostics;
    // Terminal ownership describes the selected final Summary only. A rejected
    // recovery candidate may have independently passed ownership before it
    // failed locale/native validation; serializing that `true` at top level
    // would falsely suggest an accepted final surface exists.
    const selectedFinalV2Validation = selectedFinalSourceForDiagnostics
      ? summaryV2ValidationForDiagnostics
      : null;
    diagnostics.summaryRelationalOwnershipPassed = selectedFinalV2Validation
      ? selectedFinalV2Validation.relationalOwnershipValidationPassed
      : null;
    diagnostics.summaryRelationalOwnershipFailureReasons = selectedFinalV2Validation
      ? selectedFinalV2Validation.relationalOwnershipFailureReasons
      : [];
    diagnostics.summaryFinalUnitOwnership = selectedFinalV2Validation
      ? selectedFinalV2Validation.finalUnitOwnership.map((evidence) => ({
        unitHash: evidence.unitHash,
        roleSlot: evidence.roleSlot,
        owningEntryHash: evidence.owningEntryHash,
        roleTitleOwnerEntryHash: evidence.roleTitleOwnerEntryHash,
        employerOwnerEntryHash: evidence.employerOwnerEntryHash,
        dateStatusOwnerEntryHash: evidence.dateStatusOwnerEntryHash,
        dutyFactOwnerEntryHashes: evidence.dutyFactOwnerEntryHashes,
        relationalOwnershipPassed: evidence.relationalOwnershipPassed,
        relationalOwnershipFailureReasons: evidence.relationalOwnershipFailureReasons,
      }))
      : [];
  };
  const { factSet, source: factSourceRaw, keys: summaryKeys } = buildSemanticSummaryFactSet(
    cv,
    groundingById,
    { locale: requestedLocale, gender, referenceDate: summaryReferenceDate },
  );
  let factSource: ExportReadyDiagnostics['summaryFactSetSource'] = summaryKeys.length === 0 && (
    occupationGenericFallbackUsed || hasContextSafeEmptyDutyDisplay
  )
    ? 'occupation_generic'
    : factSourceRaw;
  const assignSummaryOwnershipDiagnostics = (diagnostics: ExportReadyDiagnostics) => {
    diagnostics.summarySelectedEntryHashes = summarySelectedEntryHashes;
    diagnostics.summaryOmittedEntryHashes = summaryOmittedEntryHashes;
    diagnostics.summaryRequiredFactHashes = summaryRequiredFactHashes;
    assignSummaryV2Diagnostics(diagnostics);
  };
  if (
    hadDisplay
    && summaryKeys.length === 0
    && !occupationGenericFallbackUsed
    && !hasContextSafeEmptyDutyDisplay
    && !hasMaterialSourceFacts
  ) {
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
    assignSummaryOwnershipDiagnostics(diagnostics);
    return fail('summary_fact_set_missing_recovered_duties', stage, diagnostics);
  }

  const durationSnapshot = buildExperienceDurationSnapshot(
    cv.experience || [],
    options?.referenceDate ?? new Date(),
  );

  // The V2 resolver, not array order, owns every current Summary context
  // field. A second older current job may never lend its employer/date to the
  // selected current role.
  const primaryExp = (summaryManifest.current
    ? (cv.experience || []).find((entry) => entry.id === summaryManifest.current!.entryId)
    : undefined)
    || (cv.experience || []).find((e) => e.isPresent)
    || (cv.experience || [])[0];
  const primaryJobCtx = jobContextForExport(primaryExp?.position || cv.personal?.jobTitle);
  const summaryContextMatch = Boolean(
    cv.summaryGenerationContextKey
    && experienceJobContextsMatch(cv.summaryGenerationContextKey, primaryJobCtx.key),
  );
  const summaryStale = isSummaryStaleForJobContext(cv.summary || '', primaryJobCtx, {
    summaryOrigin: cv.summaryOrigin,
    summaryGenerationContextKey: cv.summaryGenerationContextKey,
  }) || (
    textLooksLikeCookingDuties(cv.summary || '')
    && primaryJobCtx.positionClass !== 'baker_food'
    && primaryJobCtx.positionClass !== 'hospitality_service'
  );
  const summaryStaleMetadataDetected = Boolean(
    cv.summaryGenerationContextKey
    && !summaryContextMatch
    && cv.summaryOrigin !== 'user'
  );
  const summaryOccupationalContentConflict = Boolean(
    textLooksLikeCookingDuties(cv.summary || '')
    && primaryJobCtx.positionClass !== 'baker_food'
    && primaryJobCtx.positionClass !== 'hospitality_service'
  );

  stage = 'validate_summary';
  const experienceBlobForSummary = (cv.experience || [])
    .map((e) => `${e.position || ''}\n${e.description || ''}`)
    .join('\n');
  if (summaryHasUnsupportedDomainClaims(cv.summary || '', experienceBlobForSummary)) {
    return fail(
      'summary_unsupported_domain_claims',
      stage,
      {
        ...baseDiagnostics(),
        summaryFactKeysBefore: [...new Set(summaryFactKeysBefore)],
      },
    );
  }
  const visibleSummaryExportValidation = validateSummaryExportCandidate(
    cv.summary || '',
    factSet,
    requestedLocale,
    gender,
    (cv.canonicalSummary || '').trim(),
    cv.canonicalSnapshot?.canonicalLocale,
    cv,
    durationSnapshot.total,
  );
  summaryV2ValidationForDiagnostics = appOwnedSummaryRequiresV2Authority
    ? savedAppOwnedV2Validation
    : null;
  const visibleSummaryValidation = !visibleSummaryExportValidation.valid
    ? visibleSummaryExportValidation
    : (summaryV2ValidationForDiagnostics && !summaryV2ValidationForDiagnostics.ok
      ? {
        valid: false,
        reason: summaryV2ValidationForDiagnostics.reason
          || 'summary_relational_ownership_failed',
        violations: [
          summaryV2ValidationForDiagnostics.reason
            || 'summary_relational_ownership_failed',
          ...summaryV2ValidationForDiagnostics.relationalOwnershipFailureReasons,
        ],
      }
      : visibleSummaryExportValidation);
  const summaryCurrentTextAuthority = resolveSummaryCurrentTextAuthority({
    staleMetadataDetected: summaryStaleMetadataDetected,
    occupationalContentConflict: summaryOccupationalContentConflict,
    validation: visibleSummaryValidation,
    visibleText: cv.summary || '',
    requestedLocale,
  });
  const effectiveSummaryStale = summaryStale && !summaryCurrentTextAuthority.rebound;
  let initialSummaryValidation = visibleSummaryValidation;
  if (effectiveSummaryStale) {
    staleSummaryExcluded = true;
    initialSummaryValidation = {
      valid: false,
      reason: 'stale_summary_job_context',
      violations: ['stale_summary_job_context'],
    };
  }

  let summaryRecoverySource: ExportReadyDiagnostics['summaryRecoverySource'] = 'saved_summary';
  let summaryRecoveryReason: string | undefined;
  let summaryWordCountBefore: number | undefined;
  let summaryWordCountAfter: number | undefined;
  let summaryWordBudgetMax: number | undefined;
  let rawRecoveryWordCount: number | null = null;
  let rawRecoveryWordBudgetPassed: boolean | null = null;
  let compactionAttempted: boolean | null = null;
  let compactedRecoveryWordCount: number | null = null;
  let selectedFinalWordCount: number | null = null;
  let selectedFinalWordBudgetPassed: boolean | null = null;
  let durationCompositionSource = 'saved_summary';

  const rebuildOccupationSummary = (): string => {
    const durationPhrase = formatApproximateDurationPhrase(durationSnapshot.total, requestedLocale);
    durationCompositionSource = 'occupation_aware_summary_fallback';
    return scrubOrphanDurationFragments(
      buildOccupationAwareSummaryFallback({
        locale: requestedLocale,
        gender,
        position: primaryExp?.position || cv.personal?.jobTitle,
        industry: primaryJobCtx.industryNorm,
        company: primaryExp?.company,
        startDate: primaryExp?.startDate,
        durationPhrase,
        isPresent: primaryExp?.isPresent,
      }),
    );
  };

  if (!initialSummaryValidation.valid) {
    stage = 'recover_summary';
    let recovered = '';
    const bulletCount = factSet.facts.filter((f) => f.type === 'experience_bullet').length;
    const onlyWordBudgetViolation = initialSummaryValidation.violations.length > 0
      && initialSummaryValidation.violations.every((violation) => violation.startsWith('summary_too_long'));
    if (!appOwnedSummaryRequiresV2Authority && !effectiveSummaryStale && onlyWordBudgetViolation) {
      const compacted = compactSavedSummaryNearWordBudget({
        summary: cv.summary || '',
        locale: requestedLocale,
        protectedPhrases: [
          cv.personal?.jobTitle || '',
          ...(cv.experience || []).flatMap((entry) => [entry.position || '', entry.company || '']),
        ],
        validate: (candidate) => validateSummaryExportCandidate(
          candidate,
          factSet,
          requestedLocale,
          gender,
          (cv.canonicalSummary || '').trim(),
          cv.canonicalSnapshot?.canonicalLocale,
          cv,
          durationSnapshot.total,
        ).valid,
      });
      if (compacted) {
        recovered = compacted.text;
        summaryRecoverySource = 'bounded_saved_summary';
        summaryRecoveryReason = 'valid';
        summaryWordCountBefore = compacted.wordCountBefore;
        summaryWordCountAfter = compacted.wordCountAfter;
        summaryWordBudgetMax = compacted.maxWords;
        compactionAttempted = true;
        compactedRecoveryWordCount = compacted.wordCountAfter;
        durationCompositionSource = 'saved_summary_word_budget_compaction';
      }
    }
    // App-owned Summary text is reconstructed from the same selected-entry
    // manifest used for final/visible validation. This retains all selected
    // current/prior units and prevents an older current entry from lending its
    // employer or date to the resolved current role.
    let recoveryManifest = summaryManifest;
    if (appOwnedSummaryRequiresV2Authority) {
      // The immutable manifest intentionally retains source role labels. Build
      // the recovery from the target-native *presentation* labels first, then
      // run the unchanged V2 ownership/locale gate over that projection.
      const projection = projectDeterministicRecoveryPresentationSurfaces(summaryManifest);
      recoveryManifest = projection.manifest;
      recoveryFactPresentationForDiagnostics = projection.factPresentation;
      finalSummaryManifest = recoveryManifest;
      recovered = buildSummaryV2DeterministicText(recoveryManifest);
      summaryRecoverySource = 'deterministic_v2_manifest';
      durationCompositionSource = 'deterministic_v2_manifest';
      factSource = 'app_owned_v2_manifest';
    }
    // Universal manual/legacy recovery from authoritative Experience bullets
    // even when no catalogue SemanticDutyKey matched (unknown free-text titles).
    if (!recovered && !effectiveSummaryStale && (summaryKeys.length > 0 || bulletCount > 0)) {
      recovered = deterministicLocalizedSummaryFromCanonical(
        factSet,
        requestedLocale,
        gender,
        durationSnapshot.total,
      );
      summaryRecoverySource = 'deterministic_semantic_facts';
      durationCompositionSource = 'deterministic_semantic_facts';
    }
    const recoveredLooksCooking = textLooksLikeCookingDuties(recovered);
    const cookingOccupationMismatch = recoveredLooksCooking
      && primaryJobCtx.positionClass !== 'baker_food'
      && primaryJobCtx.positionClass !== 'hospitality_service'
      && primaryJobCtx.industryNorm !== 'hospitality';
    // Occupation-generic only when there are no source duty bullets to preserve,
    // or when cooking shells leaked into a non-food role / stale context.
    if (
      (!appOwnedSummaryRequiresV2Authority && effectiveSummaryStale)
      || (!appOwnedSummaryRequiresV2Authority && cookingOccupationMismatch)
      || (!recovered.trim() && bulletCount === 0)
      || (!recovered.trim() && summaryKeys.length === 0 && bulletCount === 0)
    ) {
      recovered = rebuildOccupationSummary();
      summaryRecoverySource = 'occupation_generic_fallback';
      occupationGenericFallbackUsed = true;
      factSource = 'occupation_generic';
    } else if (!recovered.trim() && bulletCount > 0 && !appOwnedSummaryRequiresV2Authority) {
      // Last resort: still try grounded builder once more (should be rare).
      recovered = deterministicLocalizedSummaryFromCanonical(
        factSet,
        requestedLocale,
        gender,
        durationSnapshot.total,
      );
      summaryRecoverySource = 'deterministic_semantic_facts';
      durationCompositionSource = 'deterministic_semantic_facts';
      if (!recovered.trim()) {
        recovered = rebuildOccupationSummary();
        summaryRecoverySource = 'occupation_generic_fallback';
        occupationGenericFallbackUsed = true;
        factSource = 'occupation_generic';
      }
    }
    const recoveryValidation = validateSummaryExportCandidate(
      recovered,
      // Occupation-generic summaries ground on role/duration, not cooking shells.
      summaryRecoverySource === 'occupation_generic_fallback'
        ? buildCvCanonicalFactSet({
          ...cv,
          experience: (cv.experience || []).map((e) => ({
            ...e,
            description: e.description,
            originalUserDescription: undefined,
            canonicalDescription: undefined,
          })),
          summary: '',
          canonicalSummary: '',
        })
        : factSet,
      requestedLocale,
      gender,
      (cv.canonicalSummary || '').trim(),
      cv.canonicalSnapshot?.canonicalLocale,
      cv,
      durationSnapshot.total,
    );
    const recoveryWordBudgetMax = summaryWordBudgetMax
      ?? (requestedLocale === 'hi' || requestedLocale === 'sr' ? 110 : 90);
    rawRecoveryWordCount = recovered.trim()
      ? countSummaryWords(recovered, requestedLocale)
      : 0;
    rawRecoveryWordBudgetPassed = rawRecoveryWordCount <= recoveryWordBudgetMax;
    summaryWordBudgetMax = recoveryWordBudgetMax;
    recoveryCandidateHashForDiagnostics = recovered.trim()
      ? hashSummaryV2Text(recovered)
      : null;
    recoveryLocalePurityForDiagnostics = recovered.trim()
      ? validateAiUnitLocalePurity(recovered, requestedLocale, {
        kind: 'summary_sentence',
        requireUnits: true,
      })
      : null;
    const recoveryV2Validation = appOwnedSummaryRequiresV2Authority
      ? validateSummaryV2AgainstManifest(recovered, recoveryManifest, {
        candidateSource: 'deterministic',
        preserveConstructionOrder: true,
        trustedConstructionAuthority: true,
      })
      : null;
    recoveryV2ValidationForDiagnostics = recoveryV2Validation;
    summaryV2ValidationForDiagnostics = recoveryV2Validation
      || summaryV2ValidationForDiagnostics;
    if (summaryHasUnsupportedDomainClaims(recovered, experienceBlobForSummary)) {
      return fail(
        'summary_unsupported_domain_claims',
        stage,
        {
          ...baseDiagnostics(),
          summaryRecoverySource,
          summaryRecoveryReason: 'recovered_summary_unsupported_domain_claims',
        },
      );
    }
    summaryRecoveryReason = recoveryV2Validation && !recoveryV2Validation.ok
      ? (recoveryV2Validation.reason || 'summary_relational_ownership_failed')
      : recoveryValidation.reason;
    // The bounded legacy export budget is not a semantic authority. An
    // app-owned V2 rebuild that preserves every required selected fact may be
    // longer than that historic UI target; reject any other legacy violation,
    // but do not discard entry-owned authority solely to shorten it.
    const recoveryOnlyExceedsLegacyWordBudget = !recoveryValidation.valid
      && recoveryValidation.violations.length > 0
      && recoveryValidation.violations.every((violation) => violation.startsWith('summary_too_long'));
    if (appOwnedSummaryRequiresV2Authority && recoveryOnlyExceedsLegacyWordBudget) {
      // This is the historic compact-Summary preference, not a mandatory V2
      // final postcondition.  The selected entry-owned manifest remains the
      // authoritative completeness/ownership contract.
      summaryRecoveryReason = 'legacy_word_budget_advisory_not_final_gate';
      compactionAttempted = false;
    }
    // Occupation-generic rebuild is authoritative after context change even when
    // semantic validator is strict about missing duty shells.
    const acceptOccupationGeneric = summaryRecoverySource === 'occupation_generic_fallback'
      && !appOwnedSummaryRequiresV2Authority
      && Boolean(recovered.trim())
      && !textLooksLikeCookingDuties(recovered)
      && textMatchesRequestedFieldLocale(recovered, requestedLocale, 'summary', structuredExemptions(cv));
    if ((recovered
      && (recoveryValidation.valid
        || (appOwnedSummaryRequiresV2Authority && recoveryOnlyExceedsLegacyWordBudget))
      && (!recoveryV2Validation || recoveryV2Validation.ok)) || acceptOccupationGeneric) {
      cv = {
        ...cv,
        summary: recovered,
        summaryOrigin: summaryRecoverySource === 'bounded_saved_summary'
          ? (cv.summaryOrigin || 'user')
          : 'deterministic_fallback',
        contentLocale: requestedLocale,
        summaryGeneratedLocale: requestedLocale,
        summaryGenerationContextKey: primaryJobCtx.key,
        // Do not keep a cooking canonical Summary as authoritative after occupation change.
        canonicalSummary: textLooksLikeCookingDuties(cv.canonicalSummary || '')
          ? undefined
          : cv.canonicalSummary,
      };
      selectedFinalSummaryHashForDiagnostics = hashSummaryV2Text(recovered);
      selectedFinalSourceForDiagnostics = summaryRecoverySource;
      selectedFinalWordCount = countSummaryWords(recovered, requestedLocale);
      // A selected app-owned V2 Summary has passed its actual mandatory
      // ownership/locale/native checks. The old 110-word target is advisory
      // when preserving all selected facts requires a longer surface.
      selectedFinalWordBudgetPassed = recoveryValidation.valid
        || (appOwnedSummaryRequiresV2Authority && recoveryOnlyExceedsLegacyWordBudget);
    } else {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      diagnostics.summaryInitialValid = false;
      diagnostics.summaryInitialReason = initialSummaryValidation.reason;
      diagnostics.summaryRecoverySource = summaryRecoverySource;
      diagnostics.summaryRecoveryReason = summaryRecoveryReason;
      diagnostics.summaryWordCountBefore = summaryWordCountBefore;
      diagnostics.summaryWordCountAfter = summaryWordCountAfter;
      diagnostics.summaryWordBudgetMax = summaryWordBudgetMax;
      diagnostics.summaryStaleMetadataDetected = summaryCurrentTextAuthority.staleMetadataDetected;
      diagnostics.summaryVisibleTextAuthorityRebound = summaryCurrentTextAuthority.rebound;
      diagnostics.summaryVisibleTextAuthorityReason =
        summaryCurrentTextAuthority.reason;
      diagnostics.summaryVisibleTextAuthorityBlockedReason =
        summaryCurrentTextAuthority.blockedReason;
      diagnostics.summaryVisibleTextValidationReason =
        visibleSummaryValidation.reason;
      diagnostics.summaryForeignProfessionalPrefixRejected =
        summaryCurrentTextAuthority.foreignProfessionalPrefixRejected;
      diagnostics.summaryStaleReboundLocaleGuardRevision =
        summaryCurrentTextAuthority.localeGuardRevision;
      diagnostics.staleSummaryExcluded = staleSummaryExcluded;
      diagnostics.summaryFactKeysBefore = [...new Set(summaryFactKeysBefore)];
      diagnostics.summaryFactKeysUsed = summaryKeys;
      assignSummaryOwnershipDiagnostics(diagnostics);
      return fail('summary_validation_failed_after_recovery', stage, diagnostics);
    }
  } else {
    cv = {
      ...cv,
      contentLocale: requestedLocale,
      summaryGeneratedLocale: requestedLocale,
      summaryGenerationContextKey: summaryCurrentTextAuthority.rebound
        ? primaryJobCtx.key
        : (cv.summaryGenerationContextKey || primaryJobCtx.key),
    };
  }

  // V2 is the app-owned Summary's final semantic and surface authority. The
  // generic quality fallback is allowed to project Experience/title fields,
  // but must not replace a selected-entry V2 Summary with a generic duration
  // shell after it has already passed the shared V2 finalizer.
  const appOwnedSummaryBeforeQuality = cv.summary || '';
  const appOwnedSummaryOriginBeforeQuality = cv.summaryOrigin;
  const quality = applyCvContentQuality(cv, requestedLocale, {
    gender,
    durationSnapshot,
    referenceDate: options?.referenceDate || durationSnapshot.referenceDateIso,
    summaryOrigin: cv.summaryOrigin,
  });
  cv = {
    ...quality.cv,
    summary: appOwnedSummaryRequiresV2Authority
      ? appOwnedSummaryBeforeQuality
      : scrubOrphanDurationFragments(quality.cv.summary || ''),
    ...(appOwnedSummaryRequiresV2Authority
      ? { summaryOrigin: appOwnedSummaryOriginBeforeQuality }
      : {}),
  };

  // Post-quality is the visible/exported Summary authority. Re-read the exact
  // rewritten text instead of inheriting a pre-quality pass value.
  if (appOwnedSummaryRequiresV2Authority) {
    const postQualityV2 = validateSummaryV2AgainstManifest(cv.summary || '', finalSummaryManifest, {
      candidateSource: 'final_selected',
    });
    summaryV2ValidationForDiagnostics = postQualityV2;
    if (!postQualityV2.ok) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      diagnostics.summaryInitialValid = initialSummaryValidation.valid;
      diagnostics.summaryInitialReason = initialSummaryValidation.reason;
      diagnostics.summaryRecoverySource = summaryRecoverySource;
      diagnostics.summaryRecoveryReason = postQualityV2.reason || undefined;
      assignSummaryOwnershipDiagnostics(diagnostics);
      return fail(
        postQualityV2.reason || 'summary_relational_ownership_failed',
        'validate_summary',
        diagnostics,
      );
    }
  }

  // Enforce: quality must not restore English padding over projected display.
  cv = {
    ...cv,
    experience: (cv.experience || []).map((exp) => {
      const preserved = preservedDescriptions.get(exp.id);
      const grounding = groundingById.get(exp.id);
      if (
        grounding?.source === 'legacy_recovered_display_duties'
        && preserved
        && /[A-Za-z]{4,}/.test(exp.description || '')
        && !/[A-Za-z]{4,}/.test(preserved)
      ) {
        return { ...exp, description: preserved };
      }
      if (grounding?.source === 'legacy_recovered_display_duties' && preserved) {
        return { ...exp, description: preserved };
      }
      if (
        preserved
        && experienceBulletsMatchRequestedLocale(preserved, requestedLocale, cv)
      ) {
        return { ...exp, description: preserved };
      }
      return exp;
    }),
    contentLocale: requestedLocale,
    summaryGeneratedLocale: requestedLocale,
  };

  // Guard against stale overwrite of semantic grounding.
  for (const exp of cv.experience || []) {
    const grounding = groundingById.get(exp.id);
    if (
      grounding?.source === 'legacy_recovered_display_duties'
      && grounding.duties.length > 0
      && !(exp.originalUserDescription || '').trim()
    ) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      return fail('legacy_export_recovery_snapshot_overwritten', 'produce_semantic_duties', diagnostics);
    }
  }

  stage = 'validate_locale_integrity';
  for (const exp of cv.experience || []) {
    const grounding = groundingById.get(exp.id);
    if (!grounding || grounding.duties.length === 0) {
      // Occupation-generic Experience still must match requested locale.
      if (
        (exp.description || '').trim()
        && !experienceBulletsMatchRequestedLocale(exp.description || '', requestedLocale, cv)
      ) {
        const diagnostics = baseDiagnostics();
        diagnostics.recoveryInvoked = recoveryInvoked;
        diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
        diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
        return fail('localized_display_projection_incomplete', 'produce_localized_display', diagnostics);
      }
      continue;
    }
    if (!experienceBulletsMatchRequestedLocale(exp.description || '', requestedLocale, cv)) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      assignSummaryOwnershipDiagnostics(diagnostics);
      diagnostics.summaryInitialValid = initialSummaryValidation.valid;
      diagnostics.summaryInitialReason = initialSummaryValidation.reason;
      diagnostics.summaryRecoverySource = summaryRecoverySource;
      diagnostics.summaryRecoveryReason = summaryRecoveryReason;
      return fail('localized_display_projection_incomplete', 'produce_localized_display', diagnostics);
    }
  }

  const localeCheck = validateFinalLocalizedCvFields(cv, requestedLocale);
  if (!localeCheck.valid) {
    const first = localeCheck.violations[0];
    if (first.path.includes('experience') && first.kind === 'mixed_locale_field') {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      assignSummaryOwnershipDiagnostics(diagnostics);
      diagnostics.summaryInitialValid = initialSummaryValidation.valid;
      diagnostics.summaryInitialReason = initialSummaryValidation.reason;
      diagnostics.summaryRecoverySource = summaryRecoverySource;
      diagnostics.summaryRecoveryReason = summaryRecoveryReason;
      return fail('localized_display_projection_incomplete', 'produce_localized_display', diagnostics);
    }
    const diagnostics = baseDiagnostics();
    diagnostics.recoveryInvoked = recoveryInvoked;
    diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
    diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
    diagnostics.summaryFactSetSource = factSource;
    diagnostics.summarySemanticDutyKeys = summaryKeys;
    diagnostics.summaryInitialValid = initialSummaryValidation.valid;
    diagnostics.summaryInitialReason = initialSummaryValidation.reason;
    diagnostics.summaryRecoverySource = summaryRecoverySource;
    diagnostics.summaryRecoveryReason = summaryRecoveryReason;
    return fail(
      `summary_export_contract_mismatch: ${first.kind}: ${first.path}`,
      stage,
      diagnostics,
    );
  }

  if (!recoveryInvoked) {
    return fail('legacy_export_recovery_not_invoked', 'recover_legacy_grounding', baseDiagnostics());
  }

  // Summary↔Experience parity: material facts present in Summary grounding must
  // still survive in finalized Experience (Summary must not be the only copy).
  for (const exp of cv.experience || []) {
    const jobCtx = jobContextForExport(exp.position || cv.personal?.jobTitle);
    const source = (exp.originalUserDescription || exp.canonicalDescription || '').trim();
    if (!source) continue;
    if (
      textLooksLikeCookingDuties(source)
      && jobCtx.positionClass !== 'baker_food'
      && jobCtx.positionClass !== 'hospitality_service'
      && jobCtx.industryNorm !== 'hospitality'
    ) {
      continue;
    }
    // Material-key overlap is same-locale. After a partial locale switch, source
    // facts may still be Serbian while the display is English (or vice versa).
    const sourceLocale = detectTextLocale(source, {
      storedLocale: exp.generatedLocale || cv.contentLocale,
      generatedLocale: exp.generatedLocale,
    });
    const displayLocale = detectTextLocale(exp.description || '', {
      storedLocale: exp.generatedLocale || requestedLocale,
      generatedLocale: exp.generatedLocale,
    });
    if (
      isCrossLocaleOperation(sourceLocale, displayLocale)
      || isCrossLocaleOperation(sourceLocale, requestedLocale)
    ) {
      continue;
    }
    const required = materialDutyKeysFromDescription(source).filter((k) => k !== 'generic_duty');
    if (!required.length) continue;
    const coverage = validateMaterialDutyCoverage(source, exp.description || '');
    if (!coverage.valid) {
      const diagnostics = baseDiagnostics();
      diagnostics.recoveryInvoked = recoveryInvoked;
      diagnostics.runtimeMigrationVersion = cv.runtimeMigrationVersion;
      diagnostics.experienceProvenance = buildProvenanceRows(cv, groundingById);
      diagnostics.summaryFactSetSource = factSource;
      diagnostics.summarySemanticDutyKeys = summaryKeys;
      return fail(
        'experience_material_fact_coverage_incomplete',
        'validate_locale_integrity',
        diagnostics,
      );
    }
  }

  stage = 'complete';
  selectedFinalSummaryHashForDiagnostics ||= hashSummaryV2Text(cv.summary || '');
  selectedFinalSourceForDiagnostics ||= summaryRecoverySource;
  const summaryDiag = buildSummaryCompositionDiagnostics(factSet, cv.summary || '', {
    fallbackReason: summaryRecoverySource === 'saved_summary'
      ? undefined
      : (summaryRecoverySource || summaryRecoveryReason),
  });
  const diagnostics: ExportReadyDiagnostics = {
    selectedTemplateId,
    requestedLocale,
    runtimeMigrationVersion: cv.runtimeMigrationVersion,
    experienceCount: (cv.experience || []).length,
    recoveryInvoked: true,
    experienceProvenance: buildProvenanceRows(cv, groundingById),
    summaryFactSetSource: factSource,
    summarySemanticDutyKeys: summaryKeys,
    summaryInitialValid: initialSummaryValidation.valid,
    summaryInitialReason: initialSummaryValidation.reason,
    summaryRecoverySource,
    summaryRecoveryReason,
    summaryWordCountBefore,
    summaryWordCountAfter,
    summaryWordBudgetMax,
    summaryWordBudgetCompactionRevision: SUMMARY_EXPORT_WORD_BUDGET_COMPACTION_REVISION,
    summaryCurrentTextAuthorityRevision: SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION,
    summaryStaleMetadataDetected: summaryCurrentTextAuthority.staleMetadataDetected,
    summaryVisibleTextAuthorityRebound: summaryCurrentTextAuthority.rebound,
    summaryVisibleTextAuthorityReason:
      summaryCurrentTextAuthority.reason,
    summaryVisibleTextAuthorityBlockedReason:
      summaryCurrentTextAuthority.blockedReason,
    summaryVisibleTextValidationReason:
      visibleSummaryValidation.reason,
    summaryForeignProfessionalPrefixRejected:
      summaryCurrentTextAuthority.foreignProfessionalPrefixRejected,
    summaryStaleReboundLocaleGuardRevision:
      summaryCurrentTextAuthority.localeGuardRevision,
    experienceGenerationContextKey:
      primaryExp?.generationJobContextKey,
    summaryGenerationContextKey: cv.summaryGenerationContextKey || primaryJobCtx.key,
    summaryContextMatch: Boolean(
      experienceJobContextsMatch(
        cv.summaryGenerationContextKey || primaryJobCtx.key,
        primaryJobCtx.key,
      ),
    ) && !staleSummaryExcluded,
    staleSummaryExcluded,
    summaryFactKeysBefore: [...new Set(summaryFactKeysBefore)],
    summaryFactKeysUsed: summaryKeys,
    summarySelectedEntryHashes,
    summaryOmittedEntryHashes,
    summaryRequiredFactHashes,
    summaryValidationAuthoritySource,
    summarySavedProvenance: rawCv.summaryOrigin || 'user',
    summarySavedSummaryReboundRevalidated: appOwnedSummaryRequiresV2Authority,
    summaryRelationalOwnershipPassed: summaryV2ValidationForDiagnostics
      ? summaryV2ValidationForDiagnostics.relationalOwnershipValidationPassed
      : null,
    summaryRelationalOwnershipFailureReasons: summaryV2ValidationForDiagnostics
      ? summaryV2ValidationForDiagnostics.relationalOwnershipFailureReasons
      : [],
    summaryFinalUnitOwnership: summaryV2ValidationForDiagnostics
      ? summaryV2ValidationForDiagnostics.finalUnitOwnership.map((evidence) => ({
        unitHash: evidence.unitHash,
        roleSlot: evidence.roleSlot,
        owningEntryHash: evidence.owningEntryHash,
        roleTitleOwnerEntryHash: evidence.roleTitleOwnerEntryHash,
        employerOwnerEntryHash: evidence.employerOwnerEntryHash,
        dateStatusOwnerEntryHash: evidence.dateStatusOwnerEntryHash,
        dutyFactOwnerEntryHashes: evidence.dutyFactOwnerEntryHashes,
        relationalOwnershipPassed: evidence.relationalOwnershipPassed,
        relationalOwnershipFailureReasons: evidence.relationalOwnershipFailureReasons,
      }))
      : [],
    experiencePresentation: presentationSnapshot.records,
    experiencePresentationSnapshotId: presentationSnapshot.presentationSnapshotId,
    occupationGenericFallbackUsed,
    unsupportedRoleSpecificClaimReason,
    durationCompositionSource,
    ...summaryDiag,
    stage,
  };
  assignSummaryV2Diagnostics(diagnostics);
  void summaryContextMatch;

  // Non-mutating integrity audit — never rewrite; fail closed on mixed/cross-domain AI units.
  const integrity = auditCvExportIntegrity(cv, requestedLocale, {
    requireSummaryDuration: Boolean(cv.summaryOrigin && cv.summaryOrigin !== 'user'),
  });
  diagnostics.exportIntegrityOk = integrity.ok;
  diagnostics.exportIntegrityReasons = integrity.reasons;
  diagnostics.exportIntegrityMarker = integrity.marker;
  const hardEntries = integrity.entries.filter((e) =>
    !e.ok
    && (
      e.mixedLanguageBulletCount > 0
      || e.crossDomainLeakageDetected
      || e.crossEntryLeakageDetected
    ));
  const hardSummary = (!integrity.summaryOk && (
    integrity.reasons.includes('summary_locale_impurity')
    || integrity.reasons.includes('summary_duration_count')
  ));
  if (hardEntries.length || hardSummary) {
    return fail(
      hardEntries[0]?.reasons[0]
        || integrity.reasons[0]
        || 'export_integrity_failed',
      'validate_locale_integrity',
      diagnostics,
    );
  }

  return { ok: true, cv, diagnostics };
}

function buildProvenanceRows(
  cv: CVData,
  groundingById: Map<string, ExperienceSemanticGrounding>,
): ExportReadyDiagnostics['experienceProvenance'] {
  return (cv.experience || []).map((exp) => {
    const grounding = groundingById.get(exp.id) || { source: 'none' as const, duties: [] };
    const visible = displayTextForSemanticRecovery(exp);
    return {
      id: exp.id,
      hasOriginalUserDescription: Boolean((exp.originalUserDescription || '').trim()),
      hasCanonicalDescription: Boolean((exp.canonicalDescription || '').trim()),
      hasCanonicalSnapshot: Boolean(cv.canonicalSnapshot),
      hasGeneratedDescription: Boolean((exp.generatedDescription || '').trim()),
      descriptionOrigin: exp.descriptionOrigin,
      generatedLocale: exp.generatedLocale,
      groundingRecoverySource: exp.groundingRecoverySource,
      source: grounding.source,
      semanticDutyKeys: semanticDutyKeys(grounding),
      visibleBulletCount: splitExperienceBullets(visible).length,
      groundingBulletCount: grounding.duties.length,
      exportBulletCount: splitExperienceBullets(exp.description || '').length,
    };
  });
}

/** Throw CvExportFailure when prepareExportReadyCv fails (page/export boundary). */
export function unwrapExportReadyCv(result: PrepareExportReadyResult): CVData {
  if (result.ok) return result.cv;
  throw new CvExportFailure(result.reason, `${result.reason} @ ${result.stage}`);
}

/**
 * Back-compat wrapper used by existing call sites/tests.
 * Prefer prepareExportReadyCv for new code.
 */
export function prepareLegacyRecoveredFinalLocaleSafeCv(
  sourceCv: CVData,
  locale: Locale,
  options?: {
    gender?: string;
    referenceDate?: Date | string;
    industry?: string;
    level?: string;
  },
): {
  cv: CVData;
  diagnostics: {
    recoveryInvoked: boolean;
    experienceSourcesBefore: string[];
    experienceSourcesAfter: string[];
    recoveredDutyKeys: string[];
    summaryInitialReason?: string;
    summaryRecoverySource?: 'saved_summary' | 'deterministic_authoritative_facts';
    summaryRecoveryReason?: string;
  };
} {
  const result = prepareExportReadyCv(sourceCv, locale, sourceCv.templateId, options);
  if (!result.ok) {
    throw new CvExportFailure(result.reason, `${result.reason} @ ${result.stage}`);
  }
  return {
    cv: result.cv,
    diagnostics: {
      recoveryInvoked: result.diagnostics.recoveryInvoked,
      experienceSourcesBefore: result.diagnostics.experienceProvenance.map((p) =>
        (p.hasOriginalUserDescription ? (p.groundingRecoverySource || 'originalUserDescription') : 'none')),
      experienceSourcesAfter: result.diagnostics.experienceProvenance.map((p) => p.source),
      recoveredDutyKeys: result.diagnostics.summarySemanticDutyKeys,
      summaryInitialReason: result.diagnostics.summaryInitialReason,
      summaryRecoverySource: result.diagnostics.summaryRecoverySource === 'deterministic_semantic_facts'
        || result.diagnostics.summaryRecoverySource === 'occupation_generic_fallback'
        ? 'deterministic_authoritative_facts'
        : result.diagnostics.summaryRecoverySource === 'saved_summary'
          || result.diagnostics.summaryRecoverySource === 'bounded_saved_summary'
          ? 'saved_summary'
          : undefined,
      summaryRecoveryReason: result.diagnostics.summaryRecoveryReason,
    },
  };
}
