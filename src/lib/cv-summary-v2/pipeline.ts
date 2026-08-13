import type { CVData } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import { hasAiProtocolMarker } from '@/lib/cv-ai-protocol-strip';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { SUMMARY_V2_REVISION, isSummaryV2Enabled } from './flag';
import { captureSummaryV2Snapshot } from './snapshot';
import { buildSummaryV2SelectionManifest } from './manifest';
import { buildSummaryV2DeterministicText } from './builder';
import { validateSummaryV2AgainstManifest } from './validator';
import { bulletToWhereClauseEn, dutyTenseFromEmploymentState } from './tense';
import type { SummaryV2PipelineResult, SummaryV2SelectionManifest } from './types';
import type { SummaryV2LocalizedManifest } from './localization';
import {
  buildSameLocaleLocalizedManifest,
  projectLocalizedSummaryV2Manifest,
  SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
} from './localization';
import {
  normalizeSummaryV2RewriteStyle,
  repairSummaryV2RewriteStyle,
  evaluateSummaryV2StyleFulfillment,
  transformSummaryV2ForRewriteStyle,
  buildSummaryV2StyledDeterministicText,
  buildSummaryV2BalancedEnhanceText,
  buildFrenchStructuredStrongerWithEvidence,
  SUMMARY_V2_REWRITE_STYLE_384_REVISION,
  type SummaryV2RewriteStyle,
  type SummaryV2StyleFulfillment,
} from './rewrite-style';

export type RunSummaryV2Options = {
  cv: CVData;
  locale: Locale;
  gender?: string;
  candidate?: string;
  referenceDateIso: string;
  /** Existing Summary may guide style only; never factual authority. */
  styleHintFromExistingSummary?: boolean;
  /** Enhance rewrite style — shorter / stronger / professional. */
  rewriteStyle?: string | null;
  /** Validated structured localization produced at the provider boundary. */
  localizedManifest?: SummaryV2LocalizedManifest | null;
};

export type SummaryV2PipelineDiagnostics = {
  rewriteStyle: SummaryV2RewriteStyle | null;
  rewriteStylePropagatedToProvider: boolean;
  rewriteStylePropagatedToRepair: boolean;
  rewriteStylePropagatedToDeterministic: boolean;
  providerRejectionReason: string | null;
  providerRejectionReasons: string[];
  repairAttempted: boolean;
  repairApplied: boolean;
  candidateTransformationKind: string | null;
  candidateTransformationBeforeHash: string | null;
  candidateTransformationAfterHash: string | null;
  styleFulfillment: SummaryV2StyleFulfillment | null;
  styleNoSafeMaterialChange: boolean;
  crossLocaleLocalizationRequired: boolean;
  localizationAttempted: boolean;
  localizationRepairAttempted: boolean;
  localizationRepairAccepted: boolean;
  localizationSource: string | null;
  sourceLocalesByEntryHash: Record<string, Locale>;
  sourceLocaleByFactIdHash: Record<string, Locale>;
  targetLocale: Locale | null;
  expectedEntryCount: number;
  localizedEntryCount: number;
  expectedFactCount: number;
  localizedFactCount: number;
  entryIdParityPassed: boolean;
  factIdParityPassed: boolean;
  factOwnershipParityPassed: boolean;
  localizedRoleTitleHashesByEntry: Record<string, string>;
  localizedFactHashesByFactId: Record<string, string>;
  sourceLanguageLeakageDetected: boolean;
  targetLocalePurityPassed: boolean;
  targetScriptPurityPassed: boolean;
  localizationGroundingPassed: boolean;
  localizationTypedFailureReason: string | null;
  localizedManifestHash: string | null;
  localizedManifestRevision: string | null;
  /** Structured ownership carried with the deterministic candidate even when
   * that candidate is rejected later in the pipeline. */
  deterministicCandidateRoleSlots?: string[];
  deterministicCandidateSemanticRolesBySentence?: string[][];
  frenchStrongerSemanticValidationPassed?: boolean | null;
  frenchStrongerSemanticRejectionReasons?: string[];
};

function prepareCandidate(raw: string): string {
  let t = (raw || '').trim();
  if (hasAiProtocolMarker(t)) t = '';
  return t.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hashNorm(text: string): string {
  return fingerprintText(
    (text || '').replace(/\s+/g, ' ').trim().toLowerCase() || 'empty',
  );
}

function deterministicManifestRoleMetadata(manifest: SummaryV2SelectionManifest): {
  roleSlots: string[];
  semanticRolesBySentence: string[][];
} {
  const roleSlots: string[] = [];
  const semanticRolesBySentence: string[][] = [];
  if (manifest.durationPhrase) {
    roleSlots.push('duration');
    semanticRolesBySentence.push(['total_duration']);
  }
  if (manifest.current) {
    roleSlots.push('current_role');
    semanticRolesBySentence.push(['current_role_intro', 'current_role_duties']);
  }
  for (const prior of manifest.priors) {
    void prior;
    roleSlots.push('prior_role');
    semanticRolesBySentence.push(['prior_role_intro', 'prior_role_duties']);
  }
  return { roleSlots, semanticRolesBySentence };
}

/**
 * Repair duty tense to match each manifest entry's employmentState.
 * Does not invent facts — only swaps present↔past clause forms already owned
 * by the selection manifest.
 */
export function repairSummaryV2DutyTense(
  candidate: string,
  manifest: SummaryV2SelectionManifest,
): string {
  let t = candidate || '';
  const entries = [
    ...(manifest.current ? [manifest.current] : []),
    ...manifest.priors,
  ];
  for (const entry of entries) {
    const facts = [
      ...manifest.requiredCurrentFacts,
      ...manifest.requiredPriorFacts,
    ].filter((f) => f.entryId === entry.entryId);
    const want = dutyTenseFromEmploymentState(entry.employmentState);
    const other = want === 'past' ? 'present' : 'past';
    for (const f of facts) {
      const correct = bulletToWhereClauseEn(f.bulletText, want);
      const wrong = bulletToWhereClauseEn(f.bulletText, other);
      const live = (f.bulletText || '').replace(/[.;]+$/u, '').trim();
      if (correct && wrong && correct.toLowerCase() !== wrong.toLowerCase()) {
        t = t.replace(new RegExp(escapeRegExp(wrong), 'giu'), correct);
      }
      if (want === 'past' && correct && live && live.toLowerCase() !== correct.toLowerCase()) {
        t = t.replace(new RegExp(escapeRegExp(live), 'giu'), correct);
      }
    }
  }
  return t.replace(/\s+/g, ' ').trim();
}

function emptyPipelineDiag(
  style: SummaryV2RewriteStyle | null,
): SummaryV2PipelineDiagnostics {
  return {
    rewriteStyle: style,
    rewriteStylePropagatedToProvider: false,
    rewriteStylePropagatedToRepair: false,
    rewriteStylePropagatedToDeterministic: false,
    providerRejectionReason: null,
    providerRejectionReasons: [],
    repairAttempted: false,
    repairApplied: false,
    candidateTransformationKind: null,
    candidateTransformationBeforeHash: null,
    candidateTransformationAfterHash: null,
    styleFulfillment: null,
    styleNoSafeMaterialChange: false,
    crossLocaleLocalizationRequired: false,
    localizationAttempted: false,
    localizationRepairAttempted: false,
    localizationRepairAccepted: false,
    localizationSource: null,
    sourceLocalesByEntryHash: {},
    sourceLocaleByFactIdHash: {},
    targetLocale: null,
    expectedEntryCount: 0,
    localizedEntryCount: 0,
    expectedFactCount: 0,
    localizedFactCount: 0,
    entryIdParityPassed: false,
    factIdParityPassed: false,
    factOwnershipParityPassed: false,
    localizedRoleTitleHashesByEntry: {},
    localizedFactHashesByFactId: {},
    sourceLanguageLeakageDetected: false,
    targetLocalePurityPassed: false,
    targetScriptPurityPassed: false,
    localizationGroundingPassed: false,
    localizationTypedFailureReason: null,
    localizedManifestHash: null,
    localizedManifestRevision: null,
    deterministicCandidateRoleSlots: [],
    deterministicCandidateSemanticRolesBySentence: [],
    frenchStrongerSemanticValidationPassed: null,
    frenchStrongerSemanticRejectionReasons: [],
  };
}

/**
 * Full V2 Summary pipeline: snapshot → manifest → provider/repair/deterministic
 * against the same manifest → shared validator (+ optional rewrite style).
 */
export function runSummaryV2(options: RunSummaryV2Options): SummaryV2PipelineResult {
  void SUMMARY_V2_REVISION;
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  const snapshot = captureSummaryV2Snapshot({
    cv: options.cv,
    locale: options.locale,
    gender: options.gender,
    referenceDateIso: options.referenceDateIso,
  });
  const sourceManifest = buildSummaryV2SelectionManifest(snapshot);
  const style = normalizeSummaryV2RewriteStyle(options.rewriteStyle);
  const sourceSummary = (options.cv.summary || '').replace(/\s+/g, ' ').trim();
  const diag = emptyPipelineDiag(style);
  const sameLocale = buildSameLocaleLocalizedManifest(sourceManifest);
  const suppliedLocalization = options.localizedManifest || null;
  const localized = sameLocale || suppliedLocalization;
  const sourceEntries = [...(sourceManifest.current ? [sourceManifest.current] : []), ...sourceManifest.priors];
  const sourceFacts = [...sourceManifest.requiredCurrentFacts, ...sourceManifest.requiredPriorFacts];
  diag.crossLocaleLocalizationRequired = !sameLocale;
  diag.localizationAttempted = Boolean(suppliedLocalization);
  diag.localizationRepairAttempted = Boolean(localized?.localizationRepairAttempted);
  diag.localizationRepairAccepted = Boolean(localized?.localizationRepairAccepted);
  diag.localizationSource = localized?.localizationSource || null;
  diag.targetLocale = options.locale;
  diag.expectedEntryCount = sourceEntries.length;
  diag.localizedEntryCount = localized?.entries.length || 0;
  diag.expectedFactCount = sourceFacts.length;
  diag.localizedFactCount = localized?.entries.reduce((count, entry) => count + entry.facts.length, 0) || 0;
  diag.sourceLocalesByEntryHash = Object.fromEntries(sourceEntries.map((entry) => [hashNorm(entry.entryId), entry.sourceLocale]));
  diag.sourceLocaleByFactIdHash = Object.fromEntries(sourceFacts.map((fact) => [hashNorm(fact.factId), fact.sourceLocale]));
  diag.entryIdParityPassed = Boolean(localized && diag.localizedEntryCount === diag.expectedEntryCount);
  diag.factIdParityPassed = Boolean(localized && diag.localizedFactCount === diag.expectedFactCount);
  diag.factOwnershipParityPassed = Boolean(localized && localized.entries.every((entry) => entry.facts.every((fact) => fact.entryId === entry.entryId)));
  diag.localizedRoleTitleHashesByEntry = Object.fromEntries((localized?.entries || []).map((entry) => [hashNorm(entry.entryId), entry.localizedRoleTitleHash]));
  diag.localizedFactHashesByFactId = Object.fromEntries((localized?.entries || []).flatMap((entry) => entry.facts.map((fact) => [hashNorm(fact.factId), fact.localizedTextHash])));
  diag.sourceLanguageLeakageDetected = false;
  diag.targetLocalePurityPassed = Boolean(localized);
  diag.targetScriptPurityPassed = Boolean(localized);
  diag.localizationGroundingPassed = Boolean(localized && diag.entryIdParityPassed && diag.factIdParityPassed && diag.factOwnershipParityPassed);
  diag.localizedManifestHash = localized?.localizedManifestHash || null;
  diag.localizedManifestRevision = localized?.revision || null;
  const manifest = localized
    ? projectLocalizedSummaryV2Manifest({ manifest: sourceManifest, localized })
    : null;
  if (!manifest) {
    const rawProvider = prepareCandidate(options.candidate || '');
    const validation = validateSummaryV2AgainstManifest(rawProvider, sourceManifest, {
      candidateSource: 'provider',
    });
    diag.localizationTypedFailureReason = validation.reason === 'locale_impurity'
      ? 'locale_impurity'
      : (suppliedLocalization
        ? 'localized_manifest_projection_failed'
        : 'cross_locale_localization_required');
    return {
      blocked: true,
      reason: diag.localizationTypedFailureReason,
      text: sourceSummary,
      origin: 'deterministic_fallback',
      countedAsSuccess: false,
      manifest: sourceManifest,
      validation,
      snapshot,
      pipelineDiagnostics: diag,
    };
  }
  void SUMMARY_V2_LOCALIZED_MANIFEST_REVISION;
  const deterministicRoleMetadata = deterministicManifestRoleMetadata(manifest);
  diag.deterministicCandidateRoleSlots = deterministicRoleMetadata.roleSlots;
  diag.deterministicCandidateSemanticRolesBySentence =
    deterministicRoleMetadata.semanticRolesBySentence;

  // French Stronger is serialized from the owned manifest, never from a
  // provider's prose.  Keep one canonical expected surface so unsafe tense,
  // action, object, or responsibility rewrites cannot be accepted merely
  // because generic lexical coverage happens to pass.
  const frenchStructuredStronger = style === 'stronger' && options.locale === 'fr'
    ? buildFrenchStructuredStrongerWithEvidence(manifest)
    : null;

  const provider = prepareCandidate(options.candidate || '');
  let text = '';
  let origin: SummaryV2PipelineResult['origin'] = 'deterministic_fallback';
  let deterministicConstructionOrder = false;

  const styleOk = (candidate: string): boolean => {
    if (!style) return true;
    const fulfilled = evaluateSummaryV2StyleFulfillment({
      style,
      sourceText: sourceSummary,
      candidateText: candidate,
      locale: options.locale,
    }).styleValidationPassed;
    if (!fulfilled || !frenchStructuredStronger) return fulfilled;
    return hashNorm(candidate) === hashNorm(frenchStructuredStronger.text);
  };

  if (provider) {
    diag.rewriteStylePropagatedToProvider = Boolean(style);
    const providerQ = validateSummaryV2AgainstManifest(provider, manifest, {
      candidateSource: 'provider',
    });
    if (providerQ.ok && styleOk(provider)) {
      text = provider;
      origin = 'ai_generated';
      diag.styleFulfillment = evaluateSummaryV2StyleFulfillment({
        style,
        sourceText: sourceSummary,
        candidateText: provider,
        locale: options.locale,
      });
    } else {
      const reasons: string[] = [];
      if (!providerQ.ok && providerQ.reason) reasons.push(providerQ.reason);
      if (providerQ.ok && style && !styleOk(provider)) {
        const sf = evaluateSummaryV2StyleFulfillment({
          style,
          sourceText: sourceSummary,
          candidateText: provider,
          locale: options.locale,
        });
        reasons.push(...sf.styleRejectionReasons);
        if (reasons.length === 0) reasons.push('style_not_fulfilled');
      }
      diag.providerRejectionReasons = [...new Set(reasons)];
      diag.providerRejectionReason = diag.providerRejectionReasons[0] || null;

      // If the live source is already the styled deterministic surface, no safe
      // material style change exists — do not accept duty-tense-only repairs as
      // a false style success.
      if (style && sourceSummary) {
        const saturated = transformSummaryV2ForRewriteStyle({
          manifest,
          style,
          sourceSummary,
        });
        const frenchCanonicalDiffers = Boolean(
          frenchStructuredStronger
          && hashNorm(sourceSummary) !== hashNorm(frenchStructuredStronger.text),
        );
        if (saturated.noSafeMaterialChange && !frenchCanonicalDiffers) {
          const validation = validateSummaryV2AgainstManifest(sourceSummary, manifest, {
            candidateSource: 'final_selected',
          });
          return {
            blocked: true,
            reason: 'style_no_safe_material_change',
            text: sourceSummary,
            origin: 'deterministic_fallback',
            countedAsSuccess: false,
            manifest,
            validation,
            snapshot,
            pipelineDiagnostics: {
              ...diag,
              rewriteStylePropagatedToDeterministic: true,
              styleNoSafeMaterialChange: true,
              candidateTransformationKind: null,
              candidateTransformationBeforeHash: saturated.beforeHash,
              candidateTransformationAfterHash: saturated.afterHash,
              styleFulfillment: evaluateSummaryV2StyleFulfillment({
                style,
                sourceText: sourceSummary,
                candidateText: sourceSummary,
                locale: options.locale,
              }),
            },
          };
        }
      }

      diag.repairAttempted = false;
      diag.rewriteStylePropagatedToRepair = Boolean(style);
      let repaired = repairSummaryV2DutyTense(provider, manifest);
      if (style) {
        repaired = repairSummaryV2RewriteStyle(repaired, style, options.locale);
      }
      // Only count as a repair attempt when the surface actually changed.
      diag.repairAttempted = hashNorm(repaired) !== hashNorm(provider);
      const repairQ = validateSummaryV2AgainstManifest(repaired, manifest, {
        candidateSource: 'repaired_provider',
      });
      if (diag.repairAttempted && repairQ.ok && styleOk(repaired)) {
        text = repaired;
        origin = 'ai_repaired';
        diag.repairApplied = true;
        diag.candidateTransformationKind = style
          ? `v2_repair_${style}`
          : 'v2_repair_duty_tense';
        diag.candidateTransformationBeforeHash = hashNorm(provider);
        diag.candidateTransformationAfterHash = hashNorm(repaired);
        diag.styleFulfillment = evaluateSummaryV2StyleFulfillment({
          style,
          sourceText: sourceSummary,
          candidateText: repaired,
          locale: options.locale,
        });
      } else if (!diag.providerRejectionReason && repairQ.reason) {
        diag.providerRejectionReason = repairQ.reason;
        diag.providerRejectionReasons = [repairQ.reason];
      }
    }
  }

  if (!text) {
    if (style && sourceSummary) {
      diag.rewriteStylePropagatedToDeterministic = true;
      // AAB436 stored French summaries can contain legacy token/casing defects.
      // Rebuild Stronger directly from immutable structured facts so the old
      // visible surface is never treated as factual authority or as the
      // deterministic candidate's semantic structure.
      if (style === 'stronger' && options.locale === 'fr' && frenchStructuredStronger) {
        if (hashNorm(sourceSummary) === hashNorm(frenchStructuredStronger.text)) {
          const validation = validateSummaryV2AgainstManifest(sourceSummary, manifest, {
            candidateSource: 'final_selected',
          });
          return {
            blocked: true,
            reason: 'style_no_safe_material_change',
            text: sourceSummary,
            origin: 'deterministic_fallback',
            countedAsSuccess: false,
            manifest,
            validation,
            snapshot,
            pipelineDiagnostics: {
              ...diag,
              styleNoSafeMaterialChange: true,
              candidateTransformationKind: null,
              candidateTransformationBeforeHash: hashNorm(sourceSummary),
              candidateTransformationAfterHash: hashNorm(sourceSummary),
              styleFulfillment: evaluateSummaryV2StyleFulfillment({
                style,
                sourceText: sourceSummary,
                candidateText: sourceSummary,
                locale: options.locale,
              }),
            },
          };
        }
        text = frenchStructuredStronger.text;
        origin = 'deterministic_fallback';
        deterministicConstructionOrder = true;
        diag.candidateTransformationKind = `v2_rewrite_${style}`;
        diag.candidateTransformationBeforeHash = hashNorm(sourceSummary);
        diag.candidateTransformationAfterHash = hashNorm(text);
        diag.styleFulfillment = evaluateSummaryV2StyleFulfillment({
          style,
          sourceText: sourceSummary,
          candidateText: text,
          locale: options.locale,
        });
      }
      if (text) {
        // Skip prose reparsing below; the structured French candidate is already
        // the immutable-manifest realization selected for this operation.
      } else {
      const transformed = transformSummaryV2ForRewriteStyle({
        manifest,
        style,
        sourceSummary,
      });
      diag.candidateTransformationKind = transformed.transformationKind;
      diag.candidateTransformationBeforeHash = transformed.beforeHash;
      diag.candidateTransformationAfterHash = transformed.afterHash;
      diag.styleNoSafeMaterialChange = transformed.noSafeMaterialChange;
      if (transformed.noSafeMaterialChange) {
        const validation = validateSummaryV2AgainstManifest(sourceSummary, manifest, {
          candidateSource: 'final_selected',
        });
        return {
          blocked: true,
          reason: 'style_no_safe_material_change',
          text: sourceSummary,
          origin: 'deterministic_fallback',
          countedAsSuccess: false,
          manifest,
          validation,
          snapshot,
          pipelineDiagnostics: {
            ...diag,
            styleFulfillment: evaluateSummaryV2StyleFulfillment({
              style,
              sourceText: sourceSummary,
              candidateText: sourceSummary,
              locale: options.locale,
            }),
          },
        };
      }
      const styledQ = validateSummaryV2AgainstManifest(transformed.text, manifest, {
        candidateSource: 'deterministic',
        // Rewrite styles are built from this immutable manifest.  Preserve its
        // duration/current/prior construction order instead of attempting to
        // infer structured ownership again from rewritten prose.
        preserveConstructionOrder: true,
        trustedConstructionAuthority: true,
      });
      const styleFulfilled = transformed.styleFulfilled || styleOk(transformed.text);
      if (styledQ.ok && styleFulfilled) {
        text = transformed.text;
        origin = 'deterministic_fallback';
        deterministicConstructionOrder = true;
        diag.styleFulfillment = evaluateSummaryV2StyleFulfillment({
          style,
          sourceText: sourceSummary,
          candidateText: text,
          locale: options.locale,
        });
      } else {
        // Never fall back to unstyled Generate-from-context (identical source).
        // Prefer a fresh styled deterministic build; if that also fails, block
        // with the precise validation / style reason.
        const styledFresh = buildSummaryV2StyledDeterministicText(manifest, style);
        const freshQ = validateSummaryV2AgainstManifest(styledFresh, manifest, {
          candidateSource: 'deterministic',
          preserveConstructionOrder: true,
          trustedConstructionAuthority: true,
        });
        if (freshQ.ok && styleOk(styledFresh)) {
          text = styledFresh;
          origin = 'deterministic_fallback';
          deterministicConstructionOrder = true;
          diag.candidateTransformationKind = `v2_rewrite_${style}`;
          diag.candidateTransformationBeforeHash = transformed.beforeHash;
          diag.candidateTransformationAfterHash = hashNorm(styledFresh);
          diag.styleFulfillment = evaluateSummaryV2StyleFulfillment({
            style,
            sourceText: sourceSummary,
            candidateText: text,
            locale: options.locale,
          });
        } else {
          const reasons = [
            ...(styledQ.reason ? [styledQ.reason] : []),
            ...(freshQ.reason ? [freshQ.reason] : []),
            ...evaluateSummaryV2StyleFulfillment({
              style,
              sourceText: sourceSummary,
              candidateText: transformed.text || styledFresh,
              locale: options.locale,
            }).styleRejectionReasons,
          ];
          return {
            blocked: true,
            reason: reasons[0] || 'style_not_fulfilled',
            text: transformed.text || styledFresh || '',
            origin: 'deterministic_fallback',
            countedAsSuccess: false,
            manifest,
            validation: validateSummaryV2AgainstManifest(
              transformed.text || styledFresh || sourceSummary,
              manifest,
              { candidateSource: 'final_selected' },
            ),
            snapshot,
            pipelineDiagnostics: {
              ...diag,
              providerRejectionReasons: [
                ...diag.providerRejectionReasons,
                ...reasons,
              ],
              styleFulfillment: evaluateSummaryV2StyleFulfillment({
                style,
                sourceText: sourceSummary,
                candidateText: transformed.text || styledFresh,
                locale: options.locale,
              }),
            },
          };
        }
      }
      }
    } else {
      // Generate empty → canonical. Generate-with-existing → balanced enhance.
      // Never silently reuse a dedicated rewrite style for enhance-without-style.
      if (style) {
        text = buildSummaryV2StyledDeterministicText(manifest, style);
        deterministicConstructionOrder = true;
      } else if (sourceSummary) {
        text = buildSummaryV2BalancedEnhanceText(manifest);
        deterministicConstructionOrder = true;
        diag.candidateTransformationKind = 'v2_balanced_enhance';
        diag.candidateTransformationBeforeHash = hashNorm(sourceSummary);
        diag.candidateTransformationAfterHash = hashNorm(text);
      } else {
        text = buildSummaryV2DeterministicText(manifest);
        deterministicConstructionOrder = true;
      }
      origin = 'deterministic_fallback';
      if (style) {
        diag.rewriteStylePropagatedToDeterministic = true;
        diag.candidateTransformationKind = `v2_rewrite_${style}`;
        diag.candidateTransformationAfterHash = hashNorm(text);
        diag.styleFulfillment = evaluateSummaryV2StyleFulfillment({
          style,
          sourceText: sourceSummary,
          candidateText: text,
          locale: options.locale,
        });
      }
    }
  }

  const validation = validateSummaryV2AgainstManifest(text, manifest, {
    candidateSource: 'final_selected',
    // Any deterministic rewrite remains manifest-owned through final selection.
    preserveConstructionOrder: deterministicConstructionOrder,
    trustedConstructionAuthority: deterministicConstructionOrder,
  });

  if (frenchStructuredStronger) {
    const candidateHashMatches = hashNorm(text) === hashNorm(frenchStructuredStronger.text);
    const rejectionReasons: string[] = [];
    if (!candidateHashMatches) rejectionReasons.push('final_candidate_hash_mismatch');
    const predicateEvidence = frenchStructuredStronger.predicateEvidence.map((evidence) => {
      const accepted = candidateHashMatches
        && evidence.tenseMatch
        && evidence.actionIdentityPreserved
        && evidence.responsibilityTierPreserved
        && evidence.objectScopePreserved;
      const rejectionReason = accepted
        ? null
        : (!candidateHashMatches
          ? 'final_candidate_hash_mismatch'
          : !evidence.tenseMatch
            ? 'tense_mismatch'
            : !evidence.actionIdentityPreserved
              ? 'action_identity_changed'
              : !evidence.responsibilityTierPreserved
                ? 'responsibility_tier_changed'
                : 'object_scope_changed');
      if (!accepted && rejectionReason && !rejectionReasons.includes(rejectionReason)) {
        rejectionReasons.push(rejectionReason);
      }
      return { ...evidence, accepted, rejectionReason };
    });
    const roleTenseEvidence = frenchStructuredStronger.roleTenseEvidence.map((evidence) => {
      const accepted = candidateHashMatches && evidence.tenseMatch;
      const rejectionReason = accepted
        ? null
        : (!candidateHashMatches ? 'final_candidate_hash_mismatch' : 'role_tense_mismatch');
      if (!accepted && rejectionReason && !rejectionReasons.includes(rejectionReason)) {
        rejectionReasons.push(rejectionReason);
      }
      return { ...evidence, accepted, rejectionReason };
    });
    const evidenceSafe = predicateEvidence.every((evidence) => (
      evidence.tenseMatch
      && evidence.actionIdentityPreserved
      && evidence.responsibilityTierPreserved
      && evidence.objectScopePreserved
      && evidence.accepted !== false
    )) && roleTenseEvidence.every((evidence) => evidence.tenseMatch && evidence.accepted !== false);
    const currentStyle = diag.styleFulfillment || evaluateSummaryV2StyleFulfillment({
      style,
      sourceText: sourceSummary,
      candidateText: text,
      locale: options.locale,
    });
    diag.styleFulfillment = {
      ...currentStyle,
      frenchPredicateEvidence: predicateEvidence,
      frenchRoleTenseEvidence: roleTenseEvidence,
    };
    diag.frenchStrongerSemanticValidationPassed = evidenceSafe && candidateHashMatches;
    diag.frenchStrongerSemanticRejectionReasons = rejectionReasons;
    if (!diag.frenchStrongerSemanticValidationPassed) {
      return {
        blocked: true,
        reason: 'french_stronger_semantic_validation_failed',
        text,
        origin,
        countedAsSuccess: false,
        manifest,
        validation,
        snapshot,
        pipelineDiagnostics: diag,
      };
    }
  }
  if (!validation.ok) {
    return {
      blocked: true,
      reason: validation.reason || 'summary_v2_validation_failed',
      text: '',
      origin,
      countedAsSuccess: false,
      manifest,
      validation,
      snapshot,
      pipelineDiagnostics: diag,
    };
  }

  // Always attach native-surface / predicate-chain diagnostics (including generate).
  if (!diag.styleFulfillment) {
    diag.styleFulfillment = evaluateSummaryV2StyleFulfillment({
      style,
      sourceText: sourceSummary,
      candidateText: text,
      locale: options.locale,
    });
  }
  if (!diag.styleFulfillment.nativeSurfaceValidationPassed) {
    return {
      blocked: true,
      reason: diag.styleFulfillment.nativeSurfaceRejectionReasons[0]
        || diag.styleFulfillment.styleRejectionReasons[0]
        || 'native_surface_validation_failed',
      text,
      origin,
      countedAsSuccess: false,
      manifest,
      validation,
      snapshot,
      pipelineDiagnostics: diag,
    };
  }

  if (style) {
    const sf = diag.styleFulfillment;
    if (!sf.styleValidationPassed && sourceSummary) {
      return {
        blocked: true,
        reason: sf.styleRejectionReasons[0] || 'style_not_fulfilled',
        text,
        origin,
        countedAsSuccess: false,
        manifest,
        validation,
        snapshot,
        pipelineDiagnostics: diag,
      };
    }
  }

  return {
    blocked: false,
    text,
    origin,
    countedAsSuccess: true,
    manifest,
    validation,
    snapshot,
    pipelineDiagnostics: diag,
  };
}

/** Build the selection manifest alone (for shadow / diagnostics). */
export function buildSummaryV2ManifestForCv(options: {
  cv: CVData;
  locale: Locale;
  gender?: string;
  referenceDateIso: string;
}): SummaryV2SelectionManifest {
  const snapshot = captureSummaryV2Snapshot(options);
  return buildSummaryV2SelectionManifest(snapshot);
}

export function summaryV2Active(): boolean {
  return isSummaryV2Enabled();
}
