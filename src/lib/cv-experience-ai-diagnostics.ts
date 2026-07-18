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
  englishSourceStillAuthoritative: boolean;
  currentTextareaIgnoredOrOverridden: boolean;
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
  finalBulletCount: number;
  finalBulletScripts: ExperienceScriptClass[];
  finalTypedFailureReason: string | null;
  rejectionStage: string | null;
  raceGuardResult: 'ok' | 'fail' | 'skipped';
  countedAsSuccess: boolean;
  usageCountBefore: number;
  usageCountAfter: number;
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
    case 'latin': return 'en|latin';
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
    selectedSourceKindHint?: ExperienceSelectedSourceKind;
  },
): Pick<
  ExperienceAiDiagnosticTrace,
  | 'selectedSourceKind'
  | 'selectedSourceLocale'
  | 'selectedSourceHash'
  | 'rejectedStaleSourceKinds'
  | 'englishSourceStillAuthoritative'
  | 'currentTextareaIgnoredOrOverridden'
> {
  const selected = (selectedText || '').trim();
  const selectedHash = fingerprintText(selected);
  const candidates = candidateSources(exp);
  const match = candidates.find((c) => fingerprintText(c.text) === selectedHash);

  let selectedSourceKind: ExperienceSelectedSourceKind =
    options?.selectedSourceKindHint || match?.kind || 'unknown';
  if (!selected) selectedSourceKind = 'none';
  else if (!match && !options?.selectedSourceKindHint) {
    if (groundingSource === 'excluded_stale') selectedSourceKind = 'none';
    else if (groundingSource === 'genuine_user' || groundingSource === 'same_context_generated') {
      selectedSourceKind = 'grounding_resolution';
    }
  }

  const rejectedStaleSourceKinds = [...new Set(
    candidates
      .filter((c) => fingerprintText(c.text) !== selectedHash)
      .map((c) => c.kind),
  )];

  const textarea = (exp.description || '').trim();
  const textareaHash = fingerprintText(textarea);
  const currentTextareaIgnoredOrOverridden = Boolean(
    textarea
    && selected
    && textareaHash !== selectedHash,
  );

  const selectedScript = classifyExperienceScript(selected);
  const textareaScript = classifyExperienceScript(textarea);
  const englishSourceStillAuthoritative = Boolean(
    selected
    && (selectedScript === 'latin')
    && (textareaScript === 'latin_diacritic'
      || textareaScript === 'cyrillic'
      || textareaScript === 'devanagari'
      || textareaScript === 'arabic'
      || textareaScript === 'cjk')
    && currentTextareaIgnoredOrOverridden,
  );

  return {
    selectedSourceKind,
    selectedSourceLocale: inferLocaleHintFromScript(selectedScript, options?.requestedLocale),
    selectedSourceHash: selectedHash,
    rejectedStaleSourceKinds,
    englishSourceStillAuthoritative,
    currentTextareaIgnoredOrOverridden,
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
      englishSourceStillAuthoritative: false,
      currentTextareaIgnoredOrOverridden: false,
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
      finalBulletCount: 0,
      finalBulletScripts: [],
      finalTypedFailureReason: null,
      rejectionStage: null,
      raceGuardResult: 'skipped',
      countedAsSuccess: false,
      usageCountBefore: input.usageCountBefore,
      usageCountAfter: input.usageCountBefore,
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
    },
  ): void {
    const selected = (grounding.sourceDescription || '').trim();
    const units = extractSourceDutyUnits(selected);
    const identities = sourceFactIdentitiesFromDescription(selected);
    const selection = diagnoseExperienceSourceSelection(
      exp,
      selected,
      grounding.groundingSource,
      {
        requestedLocale: options?.requestedLocale || this.draft.requestedLocale,
        selectedSourceKindHint: options?.selectedSourceKindHint,
      },
    );
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
      ...selection,
      factLockEnabled: Boolean(selected),
      payloadSourceDescriptionLength: selected.length,
      payloadSourceDescriptionHash: fingerprintText(selected),
      payloadSourceScript: classifyExperienceScript(selected),
      payloadSourceDutyCount: units.length,
      ...(options?.operationalContentLocale
        ? { contentLocale: options.operationalContentLocale }
        : {}),
    });
    this.stage(
      'source_description_selected',
      selected || grounding.groundingSource === 'excluded_stale' ? 'ok' : 'fail',
      selected
        ? undefined
        : (grounding.groundingSource === 'excluded_stale' ? 'excluded_stale' : 'no_source'),
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

    this.patch({
      requiredFactCount: diag.requiredFactCount ?? this.draft.requiredFactCount ?? 0,
      coveredFactCount: diag.providerCoveredFactCount
        ?? diag.coveredFactCount
        ?? 0,
      apiResponseKind: apiResponseKind as ExperienceAiDiagnosticTrace['apiResponseKind'],
      serverFallbackUsed,
      // Legacy single boolean — client apply only (not server response kind).
      fallbackSelected: clientFallbackApplied,
      fallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'deterministic_fallback')
        : null,
      fallbackBulletCount: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackBulletCount ?? diag.fallbackBulletCount ?? 0)
        : 0,
      fallbackBulletScripts: clientFallbackApplied
        ? scriptsFromBullets(text)
        : (diag.clientDeterministicFallbackScripts as ExperienceScriptClass[] | undefined) || [],
      fallbackRequiredFactCount: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackRequiredFactCount
          ?? diag.requiredFactCount
          ?? this.draft.requiredFactCount
          ?? 0)
        : 0,
      fallbackCoveredFactCount: clientFallbackApplied
        ? (diag.clientDeterministicFallbackCoveredFactCount ?? diag.coveredFactCount ?? 0)
        : 0,
      clientDeterministicFallbackAttempted: clientFallbackAttempted,
      clientDeterministicFallbackReason: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackReason || reason || 'provider_postcondition_failed')
        : null,
      clientDeterministicFallbackBulletCount: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackBulletCount ?? 0)
        : 0,
      clientDeterministicFallbackScripts: clientFallbackApplied
        ? scriptsFromBullets(text)
        : [],
      clientDeterministicFallbackRequiredFactCount: clientFallbackAttempted
        ? (diag.clientDeterministicFallbackRequiredFactCount
          ?? diag.requiredFactCount
          ?? this.draft.requiredFactCount
          ?? 0)
        : 0,
      clientDeterministicFallbackCoveredFactCount: clientFallbackApplied
        ? (diag.clientDeterministicFallbackCoveredFactCount ?? diag.coveredFactCount ?? 0)
        : 0,
      clientDeterministicFallbackApplied: clientFallbackApplied,
      finalBulletCount: diag.finalBulletCount ?? bullets.length,
      finalBulletScripts: scriptsFromBullets(text),
      tenseMode: diag.tenseMode || this.draft.tenseMode || 'unknown',
      countedAsSuccess: Boolean(finalized.countedAsSuccess),
      finalTypedFailureReason: blocked ? reason : null,
      rejectionStage: blocked
        ? (diag.rejectionStage || this.draft.rejectionStage || 'final_apply_postcondition')
        : null,
      providerLocaleValidationReason:
        reason === 'locale_mismatch' || reason === 'wrong_language'
          ? reason
          : this.draft.providerLocaleValidationReason,
      unsupportedClaimCount:
        reason === 'unsupported_claim' || reason === 'unsupported_generated_duty' ? 1 : 0,
    });

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

    this.stage('tense_normalization', 'ok');

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

  recordVisibleApply(applied: boolean, usageAfter: number): void {
    this.patch({
      countedAsSuccess: applied,
      usageCountAfter: usageAfter,
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
