/**
 * Release-safe, non-PII Experience AI diagnostics for on-device incident traces.
 *
 * Never stores names, companies, emails, phones, titles, or CV/provider prose —
 * only metadata, lengths, one-way hashes, scripts, stages, and typed reasons.
 *
 * Does not change Experience validation, matching, fallback wording, or apply
 * behavior — observation only.
 */
import type { WorkExperience } from './types';
import { fingerprintText, resolveAppVersionInfo, resolveNextBuildId } from './cv-export-diagnostics';
import { extractSourceDutyUnits, sourceFactIdentitiesFromDescription } from './cv-source-fact-identity';
import { splitExperienceBullets } from './cv-canonical-facts';
import { getApiBaseUrl } from './api';
import type { AiGroundingResolution } from './cv-experience-job-context';
import type { FinalizeCvAiFieldResult } from './cv-ai-finalize-apply';
import {
  experienceAiSourcesEquivalent,
} from './cv-experience-ai-operation-snapshot';
import { detectTextLocale } from './cv-content-locale';

export const EXPERIENCE_AI_TRACE_SCHEMA_VERSION = 1 as const;
export const EXPERIENCE_AI_DIAG_STORAGE_KEY = 'cvpro-experience-ai-diag-v1';

/**
 * Marker / UI strings for Experience AI diagnostics live only in
 * `CvExportDiagnosticsControls` behind INTERNAL_AI_RESET_ENABLED so production
 * DCE can omit them. This always-loaded module must not embed those literals.
 */

export type ExperienceAiDiagStageName =
  | 'button_pressed'
  | 'live_experience_read'
  | 'source_description_selected'
  | 'source_units_split'
  | 'job_context_built'
  | 'request_payload_built'
  | 'request_started'
  | 'api_response_received'
  | 'provider_output_parsed'
  | 'locale_validation'
  | 'source_fact_identity_created'
  | 'material_coverage_validation'
  | 'unsupported_claim_validation'
  | 'duplicate_validation'
  | 'tense_normalization'
  | 'perspective_normalization'
  | 'deterministic_fallback_started'
  | 'fallback_output_built'
  | 'fallback_locale_validation'
  | 'fallback_material_coverage'
  | 'final_apply_postcondition'
  | 'race_context_check'
  | 'visible_apply'
  | 'usage_increment';

export type ExperienceAiDiagStageResult = 'ok' | 'fail' | 'skipped';

export type ExperienceAiDiagStage = {
  stage: ExperienceAiDiagStageName;
  result: ExperienceAiDiagStageResult;
  typedReason?: string;
  requestIdHash?: string;
  currentJobContextHash?: string;
  originalRequestJobContextHash?: string;
};

export type ExperienceScriptClass =
  | 'latin'
  | 'latin_diacritic'
  | 'cyrillic'
  | 'devanagari'
  | 'arabic'
  | 'cjk'
  | 'mixed'
  | 'empty'
  | 'other';

export type ExperienceSelectedSourceKind =
  | 'currentTextarea'
  | 'liveUserDescription'
  | 'description'
  | 'originalUserDescription'
  | 'canonicalDescription'
  | 'canonicalSnapshot'
  | 'generatedDescription'
  | 'recovered_semantic_duties'
  | 'legacy_grounding'
  | 'deterministic_fallback_source'
  | 'grounding_resolution'
  | 'jobContext'
  | 'none'
  | 'unknown';

export type ExperienceApiHostClass =
  | 'vercel_production'
  | 'vercel_preview'
  | 'custom_https'
  | 'same_origin'
  | 'unknown';

export type ExperienceAiDiagnosticTrace = {
  schemaVersion: typeof EXPERIENCE_AI_TRACE_SCHEMA_VERSION;
  marker: string;
  capturedAt: string;
  appVersionCode: string | null;
  appVersionName: string | null;
  nextBuildId: string | null;
  responseDiagnosticMetadataVersion: number;
  requestedLocale: string;
  uiLocale: string;
  contentLocale: string | null;
  templateId: string;
  employmentState: 'current' | 'completed';
  selectedGender: string;
  sourceDescriptionPresent: boolean;
  sourceDescriptionLength: number;
  sourceDescriptionHash: string;
  sourceScript: ExperienceScriptClass;
  sourceUnitCount: number;
  sourceUnitLengths: number[];
  sourceUnitHashes: string[];
  sourceFactIdentityCount: number;
  selectedSourceKind: ExperienceSelectedSourceKind;
  selectedSourceLocale: string | null;
  selectedSourceHash: string;
  rejectedStaleSourceKinds: ExperienceSelectedSourceKind[];
  /** True only when the declared selected kind is also listed as rejected (should be rare/false). */
  selectedSourceActuallyRejected: boolean;
  detectedSourceLocale: string | null;
  storedSourceLocale: string | null;
  requestedTargetLocale: string | null;
  crossLocaleOperation: boolean;
  translationProviderAttempted: boolean;
  translationRepairAttempted: boolean;
  translationFallbackAttempted: boolean;
  translationFallbackApplied: boolean;
  translatedFactCount: number | null;
  targetLocaleValidationPassed: boolean | null;
  sourcePerspectiveMode: string | null;
  targetPerspectiveMode: string | null;
  targetContentApplied: boolean;
  contentLocaleUpdatedAfterApply: boolean;
  providerCoverageCount: number | null;
  fallbackCoverageCount: number | null;
  englishSourceStillAuthoritative: boolean;
  /** Explicit replacement for the misnamed englishSourceStillAuthoritative flag. */
  staleForeignLocaleSourceAuthoritative: boolean;
  selectedSourceLanguage: string | null;
  selectedSourceScript: string | null;
  liveTextSelected: boolean;
  selectedSourceMatchesLiveNormalized: boolean;
  selectedSourceDiffReason: string | null;
  canonicalFormattingOnlyDifference: boolean;
  operationSnapshotSourceKind: ExperienceSelectedSourceKind | null;
  currentTextareaIgnoredOrOverridden: boolean;
  liveTextHash: string;
  selectedSourceMatchesLiveText: boolean;
  selectedSourceMateriallyDiffersFromLiveText: boolean;
  selectedSourceEquivalentToLiveText: boolean;
  selectedSourceContextCurrent: boolean;
  payloadLocale: string;
  payloadIndustryNorm: string;
  payloadLevelNorm: string;
  payloadEmploymentState: 'current' | 'completed';
  payloadSourceDescriptionLength: number;
  payloadSourceDescriptionHash: string;
  payloadSourceScript: ExperienceScriptClass;
  payloadSourceDutyCount: number;
  payloadJobContextHash: string;
  factLockEnabled: boolean;
  factLockReason: string | null;
  generationSourceKind: 'jobContext' | 'liveSource' | 'none' | null;
  generatedDescriptionPreexisted: boolean;
  staleGeneratedDescriptionIgnored: boolean;
  generationProviderValidationPassed: boolean | null;
  generationProviderRejectionReason: string | null;
  generationFinalPostconditionPassed: boolean | null;
  generationFallbackBuilderKind: string | null;
  generationFallbackFailureReason: string | null;
  apiHostClass: ExperienceApiHostClass;
  providerHttpStatus: number | null;
  providerResponseKind: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown';
  providerBulletCount: number;
  providerBulletScripts: ExperienceScriptClass[];
  providerLocaleValidationReason: string | null;
  requiredFactCount: number;
  coveredFactCount: number;
  uncoveredFactIdentityHashes: string[];
  unsupportedClaimCount: number;
  duplicateBulletCount: number;
  tenseMode: 'present' | 'past' | 'unknown';
  perspectiveMode: 'cv_third_person' | null;
  sourcePersonMode: string | null;
  providerPersonMode: string | null;
  normalizedPersonMode: string | null;
  finalPersonMode: string | null;
  perspectiveNormalizationAttempted: boolean;
  perspectiveNormalizationApplied: boolean;
  perspectiveValidationPassed: boolean;
  normalizedBulletsUsedForApply: boolean;
  finalMatchesProviderOutput: boolean;
  finalMatchesSourceAfterNormalization: boolean;
  meaningfulChangeDetected: boolean;
  noOpRejected: boolean;
  visibleTextareaMatchesFinalNormalizedHash: boolean | null;
  /** @deprecated Prefer apiResponseKind + clientDeterministicFallback* */
  fallbackSelected: boolean;
  fallbackReason: string | null;
  fallbackBulletCount: number;
  fallbackBulletScripts: ExperienceScriptClass[];
  fallbackRequiredFactCount: number;
  fallbackCoveredFactCount: number;
  apiResponseKind: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown';
  serverFallbackUsed: boolean;
  clientDeterministicFallbackAttempted: boolean;
  clientDeterministicFallbackReason: string | null;
  clientDeterministicFallbackBulletCount: number;
  clientDeterministicFallbackScripts: ExperienceScriptClass[];
  clientDeterministicFallbackRequiredFactCount: number;
  clientDeterministicFallbackCoveredFactCount: number;
  clientDeterministicFallbackApplied: boolean;
  clientDeterministicFallbackUncoveredFactIds: string[];
  operationMode: 'generate_from_job_context' | 'enhance_existing_description' | null;
  sourceWasEmpty: boolean;
  sourceFactCount: number;
  generationContextPresent: boolean;
  generationProviderAttempted: boolean;
  generationRepairAttempted: boolean;
  generationFallbackAttempted: boolean;
  generationFallbackApplied: boolean;
  generatedBulletCount: number;
  generatedBulletScripts: ExperienceScriptClass[];
  relevanceValidationPassed: boolean;
  /** Alias kept alongside perspectiveValidationPassed for generation mode. */
  tenseValidationPassed: boolean;
  visibleApplySucceeded: boolean;
  finalBulletCount: number;
  finalBulletScripts: ExperienceScriptClass[];
  finalTypedFailureReason: string | null;
  rejectionStage: string | null;
  raceGuardResult: 'ok' | 'fail' | 'skipped';
  countedAsSuccess: boolean;
  usageCountBefore: number;
  usageCountAfter: number;
  /** Entry / locale purity (build 271/272) — hashed IDs only. */
  selectedExperienceEntryIdHash: string | null;
  operationSnapshotExperienceEntryIdHash: string | null;
  appliedExperienceEntryIdHash: string | null;
  sourceFactsEntryIdHash: string | null;
  canonicalFactsEntryIdHash: string | null;
  fallbackFactsEntryIdHash: string | null;
  providerTargetEntryIdHash: string | null;
  arrayIndexAtRequest: number | null;
  arrayIndexAtApply: number | null;
  stableEntryIdentityMatched: boolean | null;
  targetEntryStillExists: boolean | null;
  entryContextMatchedAtApply: boolean | null;
  targetLocale: string | null;
  targetScript: string | null;
  detectedLocaleByBullet: Array<string | null>;
  detectedScriptByBullet: string[];
  wrongLocaleBulletCount: number;
  wrongScriptBulletCount: number;
  mixedLanguageBulletCount: number;
  sourceLanguageLeakageDetected: boolean;
  targetLocalePurityPassed: boolean | null;
  crossEntryCandidateFactCount: number;
  crossEntryLeakageDetected: boolean;
  crossDomainLeakageDetected: boolean;
  leakedFromExperienceEntryIdHashes: string[];
  entryScopedCanonicalStorageUsed: boolean | null;
  responseRejectedForEntryMismatch: boolean;
  responseRejectedForLocaleImpurity: boolean;
  responseRejectedForDomainMismatch: boolean;
  stages: ExperienceAiDiagStage[];
  requestIdHash: string;
  originalRequestJobContextHash: string;
  currentJobContextHash: string | null;
};

let latestTrace: ExperienceAiDiagnosticTrace | null = null;

export function hashRequestId(requestId: string): string {
  return fingerprintText(requestId || '');
}

export function classifyExperienceScript(text: string): ExperienceScriptClass {
  const t = (text || '').trim();
  if (!t) return 'empty';
  const scripts: ExperienceScriptClass[] = [];
  if (/[A-Za-z]/.test(t)) scripts.push('latin');
  if (/[čćžšđČĆŽŠĐ]/.test(t)) scripts.push('latin_diacritic');
  if (/\p{Script=Cyrillic}/u.test(t)) scripts.push('cyrillic');
  if (/\p{Script=Devanagari}/u.test(t)) scripts.push('devanagari');
  if (/\p{Script=Arabic}/u.test(t)) scripts.push('arabic');
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) scripts.push('cjk');
  if (scripts.length === 0) return 'other';
  if (scripts.length === 1) return scripts[0];
  if (scripts.includes('latin_diacritic') && scripts.every((s) => s === 'latin' || s === 'latin_diacritic')) {
    return 'latin_diacritic';
  }
  return 'mixed';
}

export function classifyApiHostForDiagnostics(): ExperienceApiHostClass {
  try {
    const base = getApiBaseUrl();
    if (!base) return 'same_origin';
    const u = new URL(base);
    if (u.hostname.endsWith('.vercel.app')) {
      if (u.hostname.includes('-git-')) return 'vercel_preview';
      return 'vercel_production';
    }
    if (u.protocol === 'https:') return 'custom_https';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function inferLocaleHintFromScript(
  script: ExperienceScriptClass,
  requestedLocale?: string | null,
): string | null {
  const loc = (requestedLocale || '').trim();
  const scriptTag = (() => {
    switch (script) {
      case 'devanagari': return 'devanagari';
      case 'arabic': return 'arabic';
      case 'cjk': return 'cjk';
      case 'cyrillic': return 'cyrillic';
      case 'latin_diacritic': return 'latin';
      case 'latin': return 'latin';
      default: return null;
    }
  })();
  if (loc && scriptTag) return `${loc}|${scriptTag}`;
  switch (script) {
    case 'devanagari': return 'hi';
    case 'arabic': return 'ar';
    case 'cjk': return 'ja';
    case 'cyrillic': return 'sr|ru';
    case 'latin_diacritic': return 'sr|latin';
    case 'latin': return loc ? `${loc}|latin` : null;
    default: return null;
  }
}

type SourceCandidate = {
  kind: ExperienceSelectedSourceKind;
  text: string;
};

function candidateSources(exp: WorkExperience): SourceCandidate[] {
  const recovered = (exp.recoveredSemanticDuties || [])
    .map((d) => {
      const row = d as { label?: string; text?: string; key?: string };
      return row.label || row.text || '';
    })
    .filter(Boolean)
    .join('\n');
  const candidates: SourceCandidate[] = [
    { kind: 'currentTextarea', text: (exp.description || '').trim() },
    { kind: 'description', text: (exp.description || '').trim() },
    { kind: 'originalUserDescription', text: (exp.originalUserDescription || '').trim() },
    { kind: 'canonicalDescription', text: (exp.canonicalDescription || '').trim() },
    { kind: 'generatedDescription', text: (exp.generatedDescription || '').trim() },
    { kind: 'recovered_semantic_duties', text: recovered },
    {
      kind: 'legacy_grounding',
      text: exp.groundingRecoverySource
        ? (exp.canonicalDescription || exp.description || '').trim()
        : '',
    },
  ];
  return candidates.filter((c) => c.text.length > 0);
}

/**
 * Observe which grounding source won — does not change selection logic.
 */
export function diagnoseExperienceSourceSelection(
  exp: WorkExperience,
  selectedText: string,
  groundingSource: AiGroundingResolution['groundingSource'],
  options?: {
    requestedLocale?: string | null;
    storedContentLocale?: string | null;
    contentLocale?: string | null;
    generatedLocale?: string | null;
    selectedSourceKindHint?: ExperienceSelectedSourceKind;
  },
): Pick<
  ExperienceAiDiagnosticTrace,
  | 'selectedSourceKind'
  | 'selectedSourceLocale'
  | 'selectedSourceHash'
  | 'rejectedStaleSourceKinds'
  | 'englishSourceStillAuthoritative'
  | 'staleForeignLocaleSourceAuthoritative'
  | 'selectedSourceLanguage'
  | 'selectedSourceScript'
  | 'liveTextSelected'
  | 'selectedSourceMatchesLiveNormalized'
  | 'selectedSourceDiffReason'
  | 'canonicalFormattingOnlyDifference'
  | 'operationSnapshotSourceKind'
  | 'currentTextareaIgnoredOrOverridden'
  | 'liveTextHash'
  | 'selectedSourceMatchesLiveText'
  | 'selectedSourceMateriallyDiffersFromLiveText'
  | 'selectedSourceEquivalentToLiveText'
  | 'selectedSourceContextCurrent'
> {
  const selected = (selectedText || '').trim();
  const selectedHash = fingerprintText(selected);
  const candidates = candidateSources(exp);
  const match = candidates.find((c) => fingerprintText(c.text) === selectedHash);

  let selectedSourceKind: ExperienceSelectedSourceKind =
    options?.selectedSourceKindHint || match?.kind || 'unknown';
  if (!selected) {
    selectedSourceKind = options?.selectedSourceKindHint === 'jobContext'
      ? 'jobContext'
      : 'none';
  } else if (!match && !options?.selectedSourceKindHint) {
    if (groundingSource === 'excluded_stale') selectedSourceKind = 'none';
    else if (groundingSource === 'genuine_user' || groundingSource === 'same_context_generated') {
      selectedSourceKind = 'grounding_resolution';
    }
  }

  const textarea = (exp.description || '').trim();
  const textareaHash = fingerprintText(textarea);
  const equivalentNormalized = Boolean(
    textarea && selected && experienceAiSourcesEquivalent(textarea, selected),
  );
  const selectedSourceMatchesLiveText = Boolean(
    textarea && selected && (textareaHash === selectedHash || equivalentNormalized),
  );

  // Formatting-only differences (bullets / CRLF) are NOT overrides.
  const currentTextareaIgnoredOrOverridden = Boolean(
    textarea
    && selected
    && !equivalentNormalized
    && textareaHash !== selectedHash,
  );

  const selectedScript = classifyExperienceScript(selected);
  const liveScript = classifyExperienceScript(textarea);
  // Serbian Latin must never be reported as "English authoritative".
  const staleForeignLocaleSourceAuthoritative = Boolean(
    currentTextareaIgnoredOrOverridden
    && selected
    && selectedScript === 'latin'
    && liveScript !== 'latin'
    && liveScript !== 'latin_diacritic'
    && liveScript !== 'empty'
    && liveScript !== 'other',
  );
  const englishSourceStillAuthoritative = staleForeignLocaleSourceAuthoritative;

  let selectedSourceLanguage: string | null = null;
  let selectedSourceScript: string | null = null;
  // Detect from actual selected text — never label Serbian Latin as English merely
  // because the UI/requested locale switched to en.
  const detectedFromText = detectTextLocale(selected, {
    storedLocale: options?.storedContentLocale || options?.contentLocale || null,
    generatedLocale: options?.generatedLocale || null,
  });
  const localeForHint =
    detectedFromText !== 'unknown'
      ? detectedFromText
      : (options?.storedContentLocale || options?.contentLocale || options?.requestedLocale || null);
  const localeHint = inferLocaleHintFromScript(selectedScript, localeForHint);
  if (localeHint?.includes('|')) {
    const [lang, script] = localeHint.split('|');
    selectedSourceLanguage = lang || null;
    selectedSourceScript = script || null;
  } else if (localeHint === 'hi') {
    selectedSourceLanguage = 'hi';
    selectedSourceScript = 'devanagari';
  } else if (selectedScript === 'latin_diacritic') {
    selectedSourceLanguage =
      detectedFromText !== 'unknown'
        ? detectedFromText
        : (options?.storedContentLocale || options?.requestedLocale || 'sr');
    selectedSourceScript = 'latin';
  } else if (selectedScript === 'latin') {
    selectedSourceLanguage =
      detectedFromText !== 'unknown'
        ? detectedFromText
        : (options?.storedContentLocale || options?.requestedLocale || null);
    selectedSourceScript = 'latin';
  }

  const canonical = (exp.canonicalDescription || '').trim();
  const canonicalFormattingOnlyDifference = Boolean(
    textarea
    && canonical
    && experienceAiSourcesEquivalent(textarea, canonical)
    && textarea !== canonical,
  );

  let selectedSourceDiffReason: string | null = null;
  if (!textarea) selectedSourceDiffReason = 'live_empty';
  else if (equivalentNormalized && textareaHash !== selectedHash) {
    selectedSourceDiffReason = 'canonical_formatting_only';
  } else if (currentTextareaIgnoredOrOverridden) {
    selectedSourceDiffReason = staleForeignLocaleSourceAuthoritative
      ? 'foreign_locale_override'
      : 'material_content';
  } else {
    selectedSourceDiffReason = 'none';
  }

  // Rejected = material competitors only. Never list the winning kind, and treat
  // currentTextarea/description aliases of the same live text as selected when
  // the live textarea matches the authoritative selection.
  const rejectedStaleSourceKinds = [...new Set(
    candidates
      .filter((c) => {
        if (fingerprintText(c.text) === selectedHash) return false;
        if (experienceAiSourcesEquivalent(c.text, selected)) return false;
        if (
          selectedSourceMatchesLiveText
          && (c.kind === 'currentTextarea' || c.kind === 'description')
        ) {
          return false;
        }
        return true;
      })
      .map((c) => c.kind),
  )].filter((k) => k !== selectedSourceKind);

  return {
    selectedSourceKind,
    selectedSourceLocale: localeHint,
    selectedSourceHash: selectedHash,
    rejectedStaleSourceKinds,
    englishSourceStillAuthoritative,
    staleForeignLocaleSourceAuthoritative,
    selectedSourceLanguage,
    selectedSourceScript,
    liveTextSelected: selectedSourceKind === 'currentTextarea'
      || selectedSourceKind === 'liveUserDescription'
      || (equivalentNormalized && !currentTextareaIgnoredOrOverridden),
    selectedSourceMatchesLiveNormalized: equivalentNormalized,
    selectedSourceDiffReason,
    canonicalFormattingOnlyDifference,
    operationSnapshotSourceKind: selectedSourceKind,
    currentTextareaIgnoredOrOverridden,
    liveTextHash: textarea ? textareaHash : 'empty',
    selectedSourceMatchesLiveText,
    selectedSourceMateriallyDiffersFromLiveText: currentTextareaIgnoredOrOverridden,
    selectedSourceEquivalentToLiveText: equivalentNormalized || selectedSourceMatchesLiveText,
    selectedSourceContextCurrent: groundingSource !== 'excluded_stale',
  };
}

function scriptsFromBullets(text: string): ExperienceScriptClass[] {
  return splitExperienceBullets(text || '')
    .map((b) => classifyExperienceScript(b));
}

function countDuplicateBullets(text: string): number {
  const norms = splitExperienceBullets(text || '')
    .map((b) => b.toLowerCase().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return Math.max(0, norms.length - new Set(norms).size);
}

export type ExperienceAiDiagSessionInput = {
  uiLocale: string;
  requestedLocale: string;
  contentLocale?: string | null;
  templateId: string;
  gender?: string;
  industryNorm?: string;
  levelNorm?: string;
  jobContextHash: string;
  requestId: string;
  usageCountBefore: number;
};

/**
 * Mutable session that records stages for one Experience AI button press.
 * Call `commit()` to persist (survives navigation / restart until next attempt).
 */
export class ExperienceAiDiagnosticSession {
  private stages: ExperienceAiDiagStage[] = [];
  private draft: Partial<ExperienceAiDiagnosticTrace> & {
    schemaVersion: typeof EXPERIENCE_AI_TRACE_SCHEMA_VERSION;
    capturedAt: string;
    requestIdHash: string;
    originalRequestJobContextHash: string;
  };

  constructor(input: ExperienceAiDiagSessionInput) {
    const requestIdHash = hashRequestId(input.requestId);
    this.draft = {
      schemaVersion: EXPERIENCE_AI_TRACE_SCHEMA_VERSION,
      marker: '',
      capturedAt: new Date().toISOString(),
      appVersionCode: null,
      appVersionName: null,
      nextBuildId: resolveNextBuildId(),
      responseDiagnosticMetadataVersion: EXPERIENCE_AI_TRACE_SCHEMA_VERSION,
      requestedLocale: input.requestedLocale,
      uiLocale: input.uiLocale,
      contentLocale: input.contentLocale ?? null,
      templateId: input.templateId || '',
      employmentState: 'current',
      selectedGender: String(input.gender || ''),
      sourceDescriptionPresent: false,
      sourceDescriptionLength: 0,
      sourceDescriptionHash: 'empty',
      sourceScript: 'empty',
      sourceUnitCount: 0,
      sourceUnitLengths: [],
      sourceUnitHashes: [],
      sourceFactIdentityCount: 0,
      selectedSourceKind: 'unknown',
      selectedSourceLocale: null,
      selectedSourceHash: 'empty',
      rejectedStaleSourceKinds: [],
      selectedSourceActuallyRejected: false,
      detectedSourceLocale: null,
      storedSourceLocale: null,
      requestedTargetLocale: null,
      crossLocaleOperation: false,
      translationProviderAttempted: false,
      translationRepairAttempted: false,
      translationFallbackAttempted: false,
      translationFallbackApplied: false,
      translatedFactCount: null,
      targetLocaleValidationPassed: null,
      sourcePerspectiveMode: null,
      targetPerspectiveMode: null,
      targetContentApplied: false,
      contentLocaleUpdatedAfterApply: false,
      providerCoverageCount: null,
      fallbackCoverageCount: null,
      englishSourceStillAuthoritative: false,
      staleForeignLocaleSourceAuthoritative: false,
      selectedSourceLanguage: null,
      selectedSourceScript: null,
      liveTextSelected: false,
      selectedSourceMatchesLiveNormalized: false,
      selectedSourceDiffReason: null,
      canonicalFormattingOnlyDifference: false,
      operationSnapshotSourceKind: null,
      currentTextareaIgnoredOrOverridden: false,
      liveTextHash: 'empty',
      selectedSourceMatchesLiveText: false,
      selectedSourceMateriallyDiffersFromLiveText: false,
      selectedSourceEquivalentToLiveText: false,
      selectedSourceContextCurrent: true,
      payloadLocale: input.requestedLocale,
      payloadIndustryNorm: input.industryNorm || '',
      payloadLevelNorm: input.levelNorm || '',
      payloadEmploymentState: 'current',
      payloadSourceDescriptionLength: 0,
      payloadSourceDescriptionHash: 'empty',
      payloadSourceScript: 'empty',
      payloadSourceDutyCount: 0,
      payloadJobContextHash: input.jobContextHash,
      factLockEnabled: false,
      factLockReason: null,
      generationSourceKind: null,
      generatedDescriptionPreexisted: false,
      staleGeneratedDescriptionIgnored: false,
      generationProviderValidationPassed: null,
      generationProviderRejectionReason: null,
      generationFinalPostconditionPassed: null,
      generationFallbackBuilderKind: null,
      generationFallbackFailureReason: null,
      apiHostClass: classifyApiHostForDiagnostics(),
      providerHttpStatus: null,
      providerResponseKind: 'unknown',
      providerBulletCount: 0,
      providerBulletScripts: [],
      providerLocaleValidationReason: null,
      requiredFactCount: 0,
      coveredFactCount: 0,
      uncoveredFactIdentityHashes: [],
      unsupportedClaimCount: 0,
      duplicateBulletCount: 0,
      tenseMode: 'unknown',
      perspectiveMode: null,
      sourcePersonMode: null,
      providerPersonMode: null,
      normalizedPersonMode: null,
      finalPersonMode: null,
      perspectiveNormalizationAttempted: false,
      perspectiveNormalizationApplied: false,
      perspectiveValidationPassed: false,
      normalizedBulletsUsedForApply: false,
      finalMatchesProviderOutput: false,
      finalMatchesSourceAfterNormalization: false,
      meaningfulChangeDetected: false,
      noOpRejected: false,
      visibleTextareaMatchesFinalNormalizedHash: null,
      fallbackSelected: false,
      fallbackReason: null,
      fallbackBulletCount: 0,
      fallbackBulletScripts: [],
      fallbackRequiredFactCount: 0,
      fallbackCoveredFactCount: 0,
      apiResponseKind: 'unknown',
      serverFallbackUsed: false,
      clientDeterministicFallbackAttempted: false,
      clientDeterministicFallbackReason: null,
      clientDeterministicFallbackBulletCount: 0,
      clientDeterministicFallbackScripts: [],
      clientDeterministicFallbackRequiredFactCount: 0,
      clientDeterministicFallbackCoveredFactCount: 0,
      clientDeterministicFallbackApplied: false,
      clientDeterministicFallbackUncoveredFactIds: [],
      operationMode: null,
      sourceWasEmpty: false,
      sourceFactCount: 0,
      generationContextPresent: false,
      generationProviderAttempted: false,
      generationRepairAttempted: false,
      generationFallbackAttempted: false,
      generationFallbackApplied: false,
      generatedBulletCount: 0,
      generatedBulletScripts: [],
      relevanceValidationPassed: false,
      tenseValidationPassed: false,
      visibleApplySucceeded: false,
      finalBulletCount: 0,
      finalBulletScripts: [],
      finalTypedFailureReason: null,
      rejectionStage: null,
      raceGuardResult: 'skipped',
      countedAsSuccess: false,
      usageCountBefore: input.usageCountBefore,
      usageCountAfter: input.usageCountBefore,
      selectedExperienceEntryIdHash: null,
      operationSnapshotExperienceEntryIdHash: null,
      appliedExperienceEntryIdHash: null,
      sourceFactsEntryIdHash: null,
      canonicalFactsEntryIdHash: null,
      fallbackFactsEntryIdHash: null,
      providerTargetEntryIdHash: null,
      arrayIndexAtRequest: null,
      arrayIndexAtApply: null,
      stableEntryIdentityMatched: null,
      targetEntryStillExists: null,
      entryContextMatchedAtApply: null,
      targetLocale: null,
      targetScript: null,
      detectedLocaleByBullet: [],
      detectedScriptByBullet: [],
      wrongLocaleBulletCount: 0,
      wrongScriptBulletCount: 0,
      mixedLanguageBulletCount: 0,
      sourceLanguageLeakageDetected: false,
      targetLocalePurityPassed: null,
      crossEntryCandidateFactCount: 0,
      crossEntryLeakageDetected: false,
      crossDomainLeakageDetected: false,
      leakedFromExperienceEntryIdHashes: [],
      entryScopedCanonicalStorageUsed: null,
      responseRejectedForEntryMismatch: false,
      responseRejectedForLocaleImpurity: false,
      responseRejectedForDomainMismatch: false,
      requestIdHash,
      originalRequestJobContextHash: input.jobContextHash,
      currentJobContextHash: input.jobContextHash,
    };
  }

  stage(
    name: ExperienceAiDiagStageName,
    result: ExperienceAiDiagStageResult,
    typedReason?: string,
    hashes?: { requestIdHash?: string; currentJobContextHash?: string },
  ): void {
    this.stages.push({
      stage: name,
      result,
      typedReason,
      requestIdHash: hashes?.requestIdHash || this.draft.requestIdHash,
      currentJobContextHash: hashes?.currentJobContextHash
        || this.draft.currentJobContextHash
        || undefined,
      originalRequestJobContextHash: this.draft.originalRequestJobContextHash,
    });
    // Keep the earliest typed rejection (do not overwrite with later not_applied).
    if (result === 'fail' && typedReason && !this.draft.finalTypedFailureReason) {
      this.draft.finalTypedFailureReason = typedReason;
      this.draft.rejectionStage = name;
    } else if (result === 'fail' && typedReason && !this.draft.rejectionStage) {
      this.draft.rejectionStage = name;
    }
  }

  patch(partial: Partial<ExperienceAiDiagnosticTrace>): void {
    Object.assign(this.draft, partial);
  }

  recordLiveExperience(_exp: WorkExperience, isPresent: boolean): void {
    this.patch({
      employmentState: isPresent ? 'current' : 'completed',
      tenseMode: isPresent ? 'present' : 'past',
      payloadEmploymentState: isPresent ? 'current' : 'completed',
    });
    this.stage('live_experience_read', 'ok');
  }

  recordSourceSelection(
    exp: WorkExperience,
    grounding: AiGroundingResolution,
    options?: {
      requestedLocale?: string | null;
      selectedSourceKindHint?: ExperienceSelectedSourceKind;
      operationalContentLocale?: string | null;
      generationSourceKind?: ExperienceAiDiagnosticTrace['generationSourceKind'];
      generatedDescriptionPreexisted?: boolean;
      staleGeneratedDescriptionIgnored?: boolean;
      factLockReason?: string | null;
    },
  ): void {
    const selected = (grounding.sourceDescription || '').trim();
    const units = extractSourceDutyUnits(selected);
    const identities = sourceFactIdentitiesFromDescription(selected);
    const generationMode = options?.selectedSourceKindHint === 'jobContext'
      || options?.generationSourceKind === 'jobContext'
      || !selected;
    const selection = diagnoseExperienceSourceSelection(
      exp,
      selected,
      grounding.groundingSource,
      {
        requestedLocale: options?.requestedLocale || this.draft.requestedLocale,
        storedContentLocale: options?.operationalContentLocale || this.draft.contentLocale,
        contentLocale: this.draft.contentLocale,
        generatedLocale: (exp as WorkExperience & { generatedLocale?: string }).generatedLocale || null,
        selectedSourceKindHint: options?.selectedSourceKindHint,
      },
    );
    const rejectedStale: ExperienceSelectedSourceKind[] = [
      ...(selection.rejectedStaleSourceKinds || []),
    ];
    if (options?.staleGeneratedDescriptionIgnored) {
      if (!rejectedStale.includes('generatedDescription')) rejectedStale.push('generatedDescription');
      if (!rejectedStale.includes('canonicalDescription')) rejectedStale.push('canonicalDescription');
    }
    this.patch({
      sourceDescriptionPresent: Boolean(selected),
      sourceDescriptionLength: selected.length,
      sourceDescriptionHash: fingerprintText(selected),
      sourceScript: classifyExperienceScript(selected),
      sourceUnitCount: units.length,
      sourceUnitLengths: units.map((u) => u.length),
      sourceUnitHashes: units.map((u) => fingerprintText(u)),
      sourceFactIdentityCount: identities.length,
      requiredFactCount: identities.length,
      sourceFactCount: identities.length,
      ...selection,
      operationSnapshotSourceKind: generationMode && !selected
        ? (options?.selectedSourceKindHint === 'jobContext' ? 'jobContext' : 'none')
        : selection.operationSnapshotSourceKind,
      rejectedStaleSourceKinds: rejectedStale,
      selectedSourceActuallyRejected: rejectedStale.includes(selection.selectedSourceKind),
      detectedSourceLocale: selection.selectedSourceLanguage,
      storedSourceLocale: options?.operationalContentLocale || this.draft.contentLocale || null,
      requestedTargetLocale: options?.requestedLocale || this.draft.requestedLocale || null,
      crossLocaleOperation: Boolean(
        selection.selectedSourceLanguage
        && (options?.requestedLocale || this.draft.requestedLocale)
        && selection.selectedSourceLanguage
          !== (options?.requestedLocale || this.draft.requestedLocale),
      ),
      factLockEnabled: Boolean(selected),
      factLockReason: options?.factLockReason
        ?? (selected ? 'non_empty_source' : 'generation_mode_empty_live'),
      generationSourceKind: options?.generationSourceKind
        ?? (selected ? 'liveSource' : 'jobContext'),
      generatedDescriptionPreexisted: Boolean(options?.generatedDescriptionPreexisted),
      staleGeneratedDescriptionIgnored: Boolean(options?.staleGeneratedDescriptionIgnored),
      payloadSourceDescriptionLength: selected.length,
      payloadSourceDescriptionHash: fingerprintText(selected),
      payloadSourceScript: classifyExperienceScript(selected),
      payloadSourceDutyCount: units.length,
      sourceWasEmpty: !selected,
      operationMode: selected ? 'enhance_existing_description' : 'generate_from_job_context',
      generationContextPresent: !selected,
      ...(options?.operationalContentLocale
        ? { contentLocale: options.operationalContentLocale }
        : {}),
    });
    this.stage(
      'source_description_selected',
      selected || generationMode || grounding.groundingSource === 'excluded_stale' ? 'ok' : 'fail',
      selected
        ? undefined
        : (generationMode
          ? 'generation_job_context'
          : (grounding.groundingSource === 'excluded_stale' ? 'excluded_stale' : 'no_source')),
    );
    this.stage(
      'source_units_split',
      units.length > 0 ? 'ok' : (selected ? 'fail' : 'skipped'),
      units.length > 0 ? undefined : 'zero_units',
    );
    this.stage(
      'source_fact_identity_created',
      identities.length > 0 ? 'ok' : (selected ? 'fail' : 'skipped'),
      identities.length > 0 ? undefined : 'zero_identities',
    );
  }

  recordPayloadBuilt(opts: {
    locale: string;
    industryNorm: string;
    levelNorm: string;
    isPresent: boolean;
  }): void {
    this.patch({
      payloadLocale: opts.locale,
      payloadIndustryNorm: opts.industryNorm,
      payloadLevelNorm: opts.levelNorm,
      payloadEmploymentState: opts.isPresent ? 'current' : 'completed',
    });
    this.stage('job_context_built', 'ok');
    this.stage('request_payload_built', 'ok');
    this.stage('request_started', 'ok');
  }

  recordApiResponse(opts: {
    httpStatus: number | null;
    repairAttempted?: boolean;
    fallbackUsed?: boolean;
    resultText?: string;
    errorCode?: string;
  }): void {
    const text = (opts.resultText || '').trim();
    let kind: ExperienceAiDiagnosticTrace['providerResponseKind'] = 'unknown';
    if (opts.errorCode || (opts.httpStatus != null && opts.httpStatus >= 400)) kind = 'error';
    else if (opts.fallbackUsed) kind = 'fallback';
    else if (opts.repairAttempted) kind = 'repair';
    else if (!text) kind = 'empty';
    else kind = 'provider';

    this.patch({
      providerHttpStatus: opts.httpStatus,
      providerResponseKind: kind,
      apiResponseKind: kind,
      serverFallbackUsed: kind === 'fallback',
      providerBulletCount: splitExperienceBullets(text).filter(Boolean).length,
      providerBulletScripts: scriptsFromBullets(text),
      duplicateBulletCount: countDuplicateBullets(text),
    });
    this.stage(
      'api_response_received',
      kind === 'error' ? 'fail' : 'ok',
      opts.errorCode || (kind === 'error' ? 'http_error' : undefined),
    );
    this.stage(
      'provider_output_parsed',
      kind === 'error' ? 'fail' : 'ok',
      text ? undefined : (kind === 'empty' ? 'empty_result' : undefined),
    );
  }

  recordRaceCheck(ok: boolean, reason?: string, currentJobContextHash?: string): void {
    this.patch({
      raceGuardResult: ok ? 'ok' : 'fail',
      currentJobContextHash: currentJobContextHash || this.draft.currentJobContextHash,
    });
    this.stage(
      'race_context_check',
      ok ? 'ok' : 'fail',
      ok ? undefined : (reason || 'stale_request_or_context_mismatch'),
      { currentJobContextHash },
    );
  }

  /**
   * Map finalize result into validation / fallback / apply stages without
   * re-running validators (uses finalize diagnostics + reason only).
   */
  recordFinalizeResult(finalized: FinalizeCvAiFieldResult): void {
    const diag = finalized.diagnostics || {};
    const text = (finalized.text || '').trim();
    const bullets = splitExperienceBullets(text).filter(Boolean);
    const clientFallbackApplied = Boolean(
      diag.clientDeterministicFallbackApplied
      || (finalized.origin === 'deterministic_fallback' && finalized.countedAsSuccess),
    );
    const clientFallbackAttempted = Boolean(
      diag.clientDeterministicFallbackAttempted
      || clientFallbackApplied
      || diag.fallbackApplied,
    );
    const blocked = Boolean(finalized.blocked || !finalized.countedAsSuccess);
    const reason = finalized.reason || diag.typedFailureReason || null;
    const apiResponseKind = diag.apiResponseKind || this.draft.providerResponseKind || 'unknown';
    const serverFallbackUsed = Boolean(
      diag.serverFallbackUsed
      || this.draft.providerResponseKind === 'fallback',
    );

    const clientScripts = (
      (diag.clientDeterministicFallbackScripts as ExperienceScriptClass[] | undefined)?.length
        ? (diag.clientDeterministicFallbackScripts as ExperienceScriptClass[])
        : (clientFallbackApplied ? scriptsFromBullets(text) : [])
    );
    const clientBulletCount = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackBulletCount ?? diag.fallbackBulletCount ?? 0)
      : 0;
    const clientCovered = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackCoveredFactCount ?? 0)
      : 0;
    const clientRequired = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackRequiredFactCount
        ?? diag.requiredFactCount
        ?? this.draft.requiredFactCount
        ?? 0)
      : 0;
    const clientUncovered = clientFallbackAttempted
      ? (diag.clientDeterministicFallbackUncoveredFactIds || [])
      : [];

    this.patch({
      requiredFactCount: diag.requiredFactCount ?? this.draft.requiredFactCount ?? 0,
      coveredFactCount: diag.providerCoveredFactCount
        ?? diag.coveredFactCount
        ?? 0,
      uncoveredFactIdentityHashes: clientUncovered.length
        ? clientUncovered
        : (this.draft.uncoveredFactIdentityHashes || []),
      apiResponseKind: apiResponseKind as ExperienceAiDiagnosticTrace['apiResponseKind'],
      serverFallbackUsed,
      // Legacy fields derived from the same client-fallback result (no contradictions).
      fallbackSelected: clientFallbackApplied,
      fallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'deterministic_fallback')
        : null,
      fallbackBulletCount: clientBulletCount,
      fallbackBulletScripts: clientScripts,
      fallbackRequiredFactCount: clientRequired,
      fallbackCoveredFactCount: clientCovered,
      clientDeterministicFallbackAttempted: clientFallbackAttempted,
      clientDeterministicFallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'provider_postcondition_failed')
        : null,
      clientDeterministicFallbackBulletCount: clientBulletCount,
      clientDeterministicFallbackScripts: clientScripts,
      clientDeterministicFallbackRequiredFactCount: clientRequired,
      clientDeterministicFallbackCoveredFactCount: clientCovered,
      clientDeterministicFallbackApplied: clientFallbackApplied,
      clientDeterministicFallbackUncoveredFactIds: clientUncovered,
      operationMode: (diag.operationMode as ExperienceAiDiagnosticTrace['operationMode']) || null,
      sourceWasEmpty: Boolean(diag.sourceWasEmpty),
      sourceFactCount: diag.sourceFactCount ?? this.draft.sourceFactIdentityCount ?? 0,
      generationContextPresent: Boolean(
        diag.sourceWasEmpty
        || diag.operationMode === 'generate_from_job_context',
      ),
      generationProviderAttempted: Boolean(
        diag.sourceWasEmpty && (apiResponseKind === 'provider' || apiResponseKind === 'repair' || apiResponseKind === 'fallback'),
      ),
      generationRepairAttempted: Boolean(diag.sourceWasEmpty && apiResponseKind === 'repair'),
      generationFallbackAttempted: Boolean(diag.generationFallbackAttempted),
      generationFallbackApplied: Boolean(diag.generationFallbackApplied),
      generatedBulletCount: diag.generatedBulletCount ?? (diag.sourceWasEmpty ? bullets.length : 0),
      generatedBulletScripts: diag.sourceWasEmpty ? scriptsFromBullets(text) : [],
      relevanceValidationPassed: Boolean(diag.relevanceValidationPassed),
      tenseValidationPassed: Boolean(diag.tenseValidationPassed ?? diag.tenseMode),
      unsupportedClaimCount: Math.max(
        diag.unsupportedClaimCount ?? 0,
        reason === 'unsupported_claim' || reason === 'unsupported_generated_duty' ? 1 : 0,
      ),
      visibleApplySucceeded: Boolean(finalized.countedAsSuccess && !blocked),
      finalBulletCount: diag.finalBulletCount ?? bullets.length,
      finalBulletScripts: scriptsFromBullets(text),
      tenseMode: diag.tenseMode || this.draft.tenseMode || 'unknown',
      perspectiveMode: (diag.perspectiveMode as ExperienceAiDiagnosticTrace['perspectiveMode']) || 'cv_third_person',
      sourcePersonMode: (diag.sourcePersonMode as string | undefined) || null,
      providerPersonMode: (diag.providerPersonMode as string | undefined) || null,
      normalizedPersonMode: (diag.normalizedPersonMode as string | undefined) || null,
      finalPersonMode: (diag.finalPersonMode as string | undefined) || null,
      perspectiveNormalizationAttempted: Boolean(diag.perspectiveNormalizationAttempted),
      perspectiveNormalizationApplied: Boolean(diag.perspectiveNormalizationApplied),
      perspectiveValidationPassed: Boolean(diag.perspectiveValidationPassed),
      normalizedBulletsUsedForApply: Boolean(diag.normalizedBulletsUsedForApply),
      finalMatchesProviderOutput: Boolean(diag.finalMatchesProviderOutput),
      finalMatchesSourceAfterNormalization: Boolean(diag.finalMatchesSourceAfterNormalization),
      meaningfulChangeDetected: Boolean(diag.meaningfulChangeDetected),
      noOpRejected: Boolean(diag.noOpRejected),
      countedAsSuccess: Boolean(finalized.countedAsSuccess),
      finalTypedFailureReason: blocked ? reason : null,
      rejectionStage: blocked
        ? (diag.rejectionStage || this.draft.rejectionStage || 'final_apply_postcondition')
        : null,
      providerCoverageCount: diag.providerCoveredFactCount
        ?? diag.coveredFactCount
        ?? this.draft.providerCoverageCount
        ?? null,
      fallbackCoverageCount: clientCovered || (diag.fallbackCoverageCount ?? null),
      detectedSourceLocale: (diag.detectedSourceLocale as string | undefined)
        ?? this.draft.detectedSourceLocale
        ?? null,
      storedSourceLocale: (diag.storedSourceLocale as string | undefined)
        ?? this.draft.storedSourceLocale
        ?? this.draft.contentLocale
        ?? null,
      requestedTargetLocale: (diag.requestedTargetLocale as string | undefined)
        ?? this.draft.requestedLocale
        ?? null,
      crossLocaleOperation: Boolean(
        diag.crossLocaleOperation ?? this.draft.crossLocaleOperation,
      ),
      translationProviderAttempted: Boolean(diag.translationProviderAttempted),
      translationRepairAttempted: Boolean(diag.translationRepairAttempted),
      translationFallbackAttempted: Boolean(
        diag.translationFallbackAttempted
        || diag.clientDeterministicFallbackReason === 'cross_locale_translation_fallback',
      ),
      translationFallbackApplied: Boolean(
        diag.translationFallbackApplied
        || (clientFallbackApplied && diag.clientDeterministicFallbackReason === 'cross_locale_translation_fallback'),
      ),
      translatedFactCount: diag.translatedFactCount ?? null,
      targetLocaleValidationPassed: diag.targetLocaleValidationPassed
        ?? ((reason === 'locale_mismatch' || reason === 'wrong_language')
          ? false
          : (finalized.countedAsSuccess ? true : null)),
      sourcePerspectiveMode: (diag.sourcePerspectiveMode as string | undefined)
        ?? (diag.sourcePersonMode as string | undefined)
        ?? null,
      targetPerspectiveMode: (diag.targetPerspectiveMode as string | undefined)
        ?? (diag.finalPersonMode as string | undefined)
        ?? null,
      targetContentApplied: Boolean(
        diag.targetContentApplied ?? (finalized.countedAsSuccess && !blocked),
      ),
      contentLocaleUpdatedAfterApply: Boolean(
        diag.contentLocaleUpdatedAfterApply ?? (finalized.countedAsSuccess && !blocked),
      ),
      selectedExperienceEntryIdHash: (diag.selectedExperienceEntryIdHash as string | undefined) ?? null,
      operationSnapshotExperienceEntryIdHash:
        (diag.operationSnapshotExperienceEntryIdHash as string | undefined) ?? null,
      appliedExperienceEntryIdHash: (diag.appliedExperienceEntryIdHash as string | undefined)
        ?? (finalized.countedAsSuccess
          ? ((diag.selectedExperienceEntryIdHash as string | undefined) ?? null)
          : null),
      sourceFactsEntryIdHash: (diag.sourceFactsEntryIdHash as string | undefined) ?? null,
      canonicalFactsEntryIdHash: (diag.canonicalFactsEntryIdHash as string | undefined) ?? null,
      fallbackFactsEntryIdHash: (diag.fallbackFactsEntryIdHash as string | undefined) ?? null,
      providerTargetEntryIdHash: (diag.providerTargetEntryIdHash as string | undefined) ?? null,
      arrayIndexAtRequest: (diag.arrayIndexAtRequest as number | undefined) ?? null,
      arrayIndexAtApply: (diag.arrayIndexAtApply as number | undefined) ?? null,
      stableEntryIdentityMatched: diag.stableEntryIdentityMatched ?? null,
      targetEntryStillExists: diag.targetEntryStillExists ?? null,
      entryContextMatchedAtApply: diag.entryContextMatchedAtApply ?? null,
      targetLocale: (diag.targetLocale as string | undefined)
        ?? (diag.requestedTargetLocale as string | undefined)
        ?? this.draft.requestedLocale
        ?? null,
      targetScript: (diag.targetScript as string | undefined) ?? null,
      detectedLocaleByBullet: (diag.detectedLocaleByBullet as Array<string | null> | undefined) || [],
      detectedScriptByBullet: (diag.detectedScriptByBullet as string[] | undefined) || [],
      wrongLocaleBulletCount: diag.wrongLocaleBulletCount ?? 0,
      wrongScriptBulletCount: diag.wrongScriptBulletCount ?? 0,
      mixedLanguageBulletCount: diag.mixedLanguageBulletCount ?? 0,
      sourceLanguageLeakageDetected: Boolean(diag.sourceLanguageLeakageDetected),
      targetLocalePurityPassed: diag.targetLocalePurityPassed
        ?? ((reason === 'locale_mismatch' || reason === 'wrong_language' || reason === 'locale_impurity')
          ? false
          : (finalized.countedAsSuccess ? true : null)),
      crossEntryCandidateFactCount: diag.crossEntryCandidateFactCount ?? 0,
      crossEntryLeakageDetected: Boolean(diag.crossEntryLeakageDetected),
      crossDomainLeakageDetected: Boolean(diag.crossDomainLeakageDetected),
      leakedFromExperienceEntryIdHashes:
        (diag.leakedFromExperienceEntryIdHashes as string[] | undefined) || [],
      entryScopedCanonicalStorageUsed: diag.entryScopedCanonicalStorageUsed ?? null,
      responseRejectedForEntryMismatch: Boolean(
        diag.responseRejectedForEntryMismatch
        || reason === 'experience_entry_mismatch'
        || reason === 'experience_entry_missing',
      ),
      responseRejectedForLocaleImpurity: Boolean(
        diag.responseRejectedForLocaleImpurity
        || reason === 'locale_mismatch'
        || reason === 'wrong_language'
        || reason === 'locale_impurity',
      ),
      responseRejectedForDomainMismatch: Boolean(
        diag.responseRejectedForDomainMismatch
        || reason === 'cross_entry_fact_leakage'
        || reason === 'cross_domain_leakage',
      ),
      providerLocaleValidationReason:
        reason === 'locale_mismatch' || reason === 'wrong_language'
          ? reason
          : this.draft.providerLocaleValidationReason,
      generationProviderValidationPassed: diag.generationProviderValidationPassed
        ?? (diag.sourceWasEmpty && !blocked && !diag.generationFallbackApplied
          ? true
          : diag.generationProviderValidationPassed ?? null),
      generationProviderRejectionReason: blocked && diag.sourceWasEmpty && !diag.generationFallbackApplied
        ? (diag.generationProviderRejectionReason || reason || null)
        : (diag.generationProviderRejectionReason ?? null),
      generationFinalPostconditionPassed: diag.generationFinalPostconditionPassed
        ?? (diag.sourceWasEmpty ? Boolean(finalized.countedAsSuccess && !blocked) : null),
      generationFallbackBuilderKind: diag.generationFallbackBuilderKind
        ?? (diag.generationFallbackApplied ? 'job_context_generation' : null),
      generationFallbackFailureReason: diag.generationFallbackFailureReason
        ?? (diag.generationFallbackAttempted && !diag.generationFallbackApplied
          ? (reason || 'empty_fallback')
          : null),
    });

    // Never report experience_generation_not_relevant when relevance actually passed.
    if (
      this.draft.relevanceValidationPassed
      && this.draft.fallbackReason === 'experience_generation_not_relevant'
    ) {
      this.patch({
        fallbackReason: this.draft.generationFallbackApplied
          ? null
          : (diag.clientDeterministicFallbackReason || this.draft.finalTypedFailureReason),
      });
    }

    const localeFail = reason === 'locale_mismatch' || reason === 'wrong_language';
    this.stage(
      'locale_validation',
      localeFail && !clientFallbackApplied ? 'fail' : 'ok',
      localeFail ? reason || undefined : undefined,
    );

    const coverageFail = reason === 'experience_material_fact_coverage_incomplete'
      || Boolean(
        diag.rejectionStage?.includes('material')
        || diag.rejectionStage?.includes('source_fact'),
      );
    this.stage(
      'material_coverage_validation',
      coverageFail && !finalized.countedAsSuccess && !clientFallbackApplied ? 'fail' : 'ok',
      coverageFail && !clientFallbackApplied ? reason || undefined : undefined,
    );

    const unsupported = reason === 'unsupported_claim' || reason === 'unsupported_generated_duty';
    this.stage(
      'unsupported_claim_validation',
      unsupported && !finalized.countedAsSuccess ? 'fail' : 'ok',
      unsupported ? reason || undefined : undefined,
    );

    const dup = reason === 'exact_duplicate' || reason === 'duplicate_bullets';
    this.stage(
      'duplicate_validation',
      dup && !finalized.countedAsSuccess ? 'fail' : 'ok',
      dup ? reason || undefined : undefined,
    );

    this.stage(
      'tense_normalization',
      'ok',
      undefined,
    );
    // Perspective is a separate stage from present/past tenseMode.
    const perspAttempted = Boolean(
      (finalized.diagnostics as { perspectiveNormalizationAttempted?: boolean } | undefined)
        ?.perspectiveNormalizationAttempted,
    );
    const perspApplied = Boolean(
      (finalized.diagnostics as { perspectiveNormalizationApplied?: boolean } | undefined)
        ?.perspectiveNormalizationApplied,
    );
    const perspPassed = Boolean(
      (finalized.diagnostics as { perspectiveValidationPassed?: boolean } | undefined)
        ?.perspectiveValidationPassed,
    );
    const noOp = Boolean(
      (finalized.diagnostics as { noOpRejected?: boolean } | undefined)?.noOpRejected,
    );
    if (perspAttempted || noOp || reason === 'experience_cv_perspective_first_person' || reason === 'experience_ai_noop') {
      this.stage(
        'perspective_normalization',
        !finalized.countedAsSuccess && (noOp || reason === 'experience_cv_perspective_first_person' || reason === 'experience_ai_noop')
          ? 'fail'
          : (perspPassed || finalized.countedAsSuccess ? 'ok' : 'fail'),
        noOp
          ? 'experience_ai_noop'
          : (!perspPassed && !finalized.countedAsSuccess
            ? (reason || 'experience_cv_perspective_first_person')
            : (perspApplied ? undefined : undefined)),
      );
    }

    if (clientFallbackAttempted) {
      this.stage(
        'deterministic_fallback_started',
        'ok',
        diag.clientDeterministicFallbackReason || diag.rejectionStage || undefined,
      );
      const fbCount = diag.clientDeterministicFallbackBulletCount
        ?? diag.fallbackBulletCount
        ?? (clientFallbackApplied ? bullets.length : 0);
      this.stage(
        'fallback_output_built',
        fbCount > 0 ? 'ok' : 'fail',
        fbCount > 0 ? undefined : 'empty_fallback',
      );
      this.stage(
        'fallback_locale_validation',
        localeFail && blocked ? 'fail' : 'ok',
        localeFail ? reason || undefined : undefined,
      );
      this.stage(
        'fallback_material_coverage',
        clientFallbackApplied
          ? 'ok'
          : (coverageFail ? 'fail' : 'ok'),
        !clientFallbackApplied && coverageFail ? reason || undefined : undefined,
      );
    } else if (blocked) {
      this.stage('deterministic_fallback_started', 'skipped', 'provider_path_rejected_or_fallback_absent');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    } else {
      this.stage('deterministic_fallback_started', 'skipped', 'provider_accepted');
      this.stage('fallback_output_built', 'skipped');
      this.stage('fallback_locale_validation', 'skipped');
      this.stage('fallback_material_coverage', 'skipped');
    }

    this.stage(
      'final_apply_postcondition',
      blocked ? 'fail' : 'ok',
      blocked ? reason || 'blocked' : undefined,
    );
  }

  recordVisibleApply(
    applied: boolean,
    usageAfter: number,
    options?: { visibleDescription?: string; finalNormalizedText?: string },
  ): void {
    let visibleMatch: boolean | null = this.draft.visibleTextareaMatchesFinalNormalizedHash ?? null;
    if (options?.visibleDescription != null && options?.finalNormalizedText != null) {
      visibleMatch = fingerprintText(options.visibleDescription)
        === fingerprintText(options.finalNormalizedText);
    } else if (applied && this.draft.normalizedBulletsUsedForApply) {
      visibleMatch = true;
    }
    this.patch({
      countedAsSuccess: applied,
      usageCountAfter: usageAfter,
      visibleTextareaMatchesFinalNormalizedHash: visibleMatch,
    });
    this.stage('visible_apply', applied ? 'ok' : 'fail', applied ? undefined : 'not_applied');
    this.stage(
      'usage_increment',
      applied ? 'ok' : 'skipped',
      applied ? undefined : 'no_increment_on_reject',
    );
  }

  async resolveVersions(): Promise<void> {
    const info = await resolveAppVersionInfo();
    this.patch({
      appVersionCode: info.versionCode,
      appVersionName: info.versionName,
      nextBuildId: this.draft.nextBuildId || resolveNextBuildId(),
    });
  }

  commit(): ExperienceAiDiagnosticTrace {
    const trace = {
      ...this.draft,
      stages: [...this.stages],
      marker: '',
    } as ExperienceAiDiagnosticTrace;
    persistExperienceAiDiagnostic(trace);
    return trace;
  }
}

function persistExperienceAiDiagnostic(trace: ExperienceAiDiagnosticTrace): void {
  latestTrace = trace;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(EXPERIENCE_AI_DIAG_STORAGE_KEY, JSON.stringify(trace));
  } catch {
    /* quota — keep in-memory */
  }
}

function readStoredExperienceAiDiagnostic(): ExperienceAiDiagnosticTrace | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ExperienceAiDiagnosticTrace;
  } catch {
    return null;
  }
}

export function getLatestExperienceAiDiagnostic(): ExperienceAiDiagnosticTrace | null {
  return latestTrace || readStoredExperienceAiDiagnostic();
}

export function formatExperienceAiDiagnosticForCopy(trace: ExperienceAiDiagnosticTrace): string {
  return `${JSON.stringify(trace, null, 2)}\n`;
}

export function assertExperienceAiDiagnosticHasNoCvText(
  trace: ExperienceAiDiagnosticTrace,
): string[] {
  const json = JSON.stringify(trace);
  const violations: string[] = [];
  if (/[\u0900-\u097F]{12,}/.test(json)) violations.push('devanagari_prose');
  if (/\p{Script=Cyrillic}{12,}/u.test(json)) violations.push('cyrillic_prose');
  if (/"fullName"|"email"|"phone"|"company"|Atlas|ana@example|Koordinatorka/i.test(json)) {
    violations.push('pii_field');
  }
  if (/Pregledam pristigle|Review incoming field reports/i.test(json)) {
    violations.push('raw_duty_text');
  }
  return violations;
}

export async function copyExperienceAiDiagnosticsToClipboard(): Promise<boolean> {
  const trace = getLatestExperienceAiDiagnostic();
  if (!trace) return false;
  const text = formatExperienceAiDiagnosticForCopy(trace);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function clearExperienceAiDiagnosticsForTests(): void {
  latestTrace = null;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(EXPERIENCE_AI_DIAG_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Summary lines for the internal diagnostics modal (non-PII). */
export function summarizeExperienceAiDiagnostic(
  trace: ExperienceAiDiagnosticTrace | null,
): {
  timestamp: string;
  locale: string;
  finalStage: string;
  typedFailureReason: string;
  sourceUnitCount: number;
  requiredCovered: string;
  providerFallbackCounts: string;
  finalScripts: string;
  countedAsSuccess: boolean;
} | null {
  if (!trace) return null;
  const failed = [...trace.stages].reverse().find((s) => s.result === 'fail');
  return {
    timestamp: trace.capturedAt,
    locale: trace.requestedLocale,
    finalStage: failed?.stage
      || trace.rejectionStage
      || (trace.countedAsSuccess ? 'visible_apply' : 'unknown'),
    typedFailureReason: trace.finalTypedFailureReason
      || (trace.countedAsSuccess ? 'none' : 'unknown'),
    sourceUnitCount: trace.sourceUnitCount,
    requiredCovered: `${trace.requiredFactCount}/${trace.coveredFactCount}`,
    providerFallbackCounts: `${trace.providerBulletCount}/${trace.fallbackBulletCount}`,
    finalScripts: (trace.finalBulletScripts || []).join(',') || 'none',
    countedAsSuccess: trace.countedAsSuccess,
  };
}
