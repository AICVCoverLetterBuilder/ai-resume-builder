/**
 * Authoritative finalization gate for freshly generated CV AI content.
 *
 * Every Generate / Shorter / Stronger / Professional / Bullets apply path MUST
 * run candidate text through `finalizeCvAiFieldForApply` before writing React
 * state, cvRef, autosave, preview, PDF, or DOCX. Raw provider/repair text must
 * never be applied after this function.
 */
import type { CVData, CvSummaryOrigin, WorkExperience } from './types';
import type { Locale } from './i18n/translations';
import type { CoverLetterGender } from './cover-letter-gender';
import {
  buildCvCanonicalFactSet,
  bulletsForExperience,
  freezeExperienceAiDescription,
  formatExperienceBullets,
  splitExperienceBullets,
  type CvCanonicalFactSet,
} from './cv-canonical-facts';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
  type ExperienceDuration,
  type ExperienceDurationSnapshot,
} from './cv-experience-duration';
import {
  resolveSummaryWithDurationPolicy,
  stripUnsupportedSummaryFluff,
  type DurationIntegrationContext,
} from './cv-content-quality';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
  buildSourcePreservingExperienceBulletsWithProvenance,
} from './cv-localized-fallback';
import {
  validateSourceFactIdentityCoverage,
  validateProvenancedDeterministicFallbackCoverage,
  validateSourceUnitsMateriallyPreserved,
  extractSourceDutyUnits,
  sourceUsableInLocale,
} from './cv-source-fact-identity';
import {
  materialDutyKeysFromDescription,
  validateExperienceApplyMaterialPostcondition,
} from './cv-material-duty-coverage';
import type { ExperienceAiOperationSnapshot } from './cv-experience-ai-operation-snapshot';
import {
  normalizeExperienceBulletsPerspective,
  validateExperienceCvPerspective,
  experienceAiHasMeaningfulChange,
  detectExperiencePersonMode,
  experienceRequiresCvThirdPerson,
  type ExperiencePersonMode,
} from './cv-experience-perspective';
import {
  evaluateRoleDutyConsistency,
  resolveOccupationalTitleForSummary,
} from './cv-role-title';
import {
  validateLocalizedExperienceBullets,
  validateLocalizedSummary,
  validateSummaryCompleteness,
  validateSerbianDurationGrammar,
  validateSummaryForcedConflictingTitle,
} from './cv-semantic-fidelity';
import { textMatchesRequestedFieldLocale } from './cv-field-locale-integrity';
import { isWrongLanguageAiOutput } from './cv-ai-locale-guard';
import {
  hasSuspiciousHindiMergedTokens,
  normalizeHindiGeneratedWhitespace,
} from './cv-hindi-normalize';
import { normalizeSerbianDurationGrammar } from './cv-serbian-grammar';
import {
  normalizeSerbianLatinConfusables,
  preserveSerbianSummaryFactForms,
  enrichSerbianSummaryEmploymentGrounding,
  hasSerbianLatinMixedScriptToken,
} from './cv-serbian-latin-script';
import {
  countSummaryDurationExpressions,
  summaryDurationPostconditionFailed,
} from './cv-summary-duration-ownership';
import { acceptValidatedAiContent } from './cv-canonical-snapshot';
import { applyCvContentQuality } from './cv-content-quality';
import { hasAiProtocolMarker, stripAiProtocolMarkers } from './cv-ai-protocol-strip';
import { hasCvMetaFallbackText } from './cv-ai-meta-text';
import {
  buildExperienceJobContext,
  buildOccupationAwareExperienceFallback,
  buildOccupationAwareSummaryFallback,
  candidateConflictsWithJobContext,
  hasUnsupportedRegulatedPharmacyClaims,
  isSummaryStaleForJobContext,
  resolveExperienceAiGrounding,
  scrubOrphanDurationFragments,
  textLooksLikeCookingDuties,
  type ExperienceJobContext,
} from './cv-experience-job-context';
import {
  buildJobContextGenerationFallback,
  resolveExperienceAiOperationMode,
  validateExperienceGenerationOutput,
  type ExperienceAiOperationMode,
} from './cv-experience-ai-operation-mode';
import { resolveAiOperationMode } from './cv-ai-operation-contract';

export type CvAiFinalizeAction =
  | 'summary_generate'
  | 'summary_shorter'
  | 'summary_stronger'
  | 'summary_professional'
  | 'experience_bullets';

export type CvAiFinalizeField = 'summary' | 'experience_description';

export type CvAiFinalizeOrigin =
  | 'ai_generated'
  | 'ai_repaired'
  | 'deterministic_fallback';

export type FinalizeCvAiFieldInput = {
  action: CvAiFinalizeAction;
  field: CvAiFinalizeField;
  requestedLocale: Locale;
  sourceLocale?: Locale | string | null;
  gender?: CoverLetterGender | string;
  cv: CVData;
  candidate: string;
  originHint?: CvAiFinalizeOrigin;
  experienceId?: string;
  durationSnapshot?: ExperienceDurationSnapshot;
  referenceDateIso?: string;
  /** Industry selected in the AI Improvements panel (BulletIndustry token). */
  industry?: string;
  /** Level selected in the AI Improvements panel. */
  level?: string;
  /** Precomputed job context; when omitted it is derived from position/industry/locale/level. */
  jobContext?: ExperienceJobContext;
  /**
   * Immutable Experience AI operation snapshot created at button press.
   * When present, source facts / fallback provenance must use this only.
   */
  operationSnapshot?: ExperienceAiOperationSnapshot;
};

export type FinalizeCvAiFieldResult = {
  blocked: boolean;
  reason?: string;
  text: string;
  origin: CvSummaryOrigin | 'ai_generated' | 'ai_repaired' | 'deterministic_fallback' | 'user';
  roleDutyConflict: boolean;
  countedAsSuccess: boolean;
  /** Non-PII Experience AI rejection / apply diagnostics. */
  diagnostics?: {
    sourceLocale?: string;
    sourceFactCount?: number;
    requiredFactCount?: number;
    coveredFactCount?: number;
    providerCoveredFactCount?: number;
    providerRequiredFactCount?: number;
    providerBulletCount?: number;
    /** @deprecated Prefer clientDeterministicFallback* fields. */
    fallbackBulletCount?: number;
    finalBulletCount?: number;
    finalBulletScripts?: string[];
    tenseMode?: 'present' | 'past' | 'unknown';
    perspectiveMode?: 'cv_third_person';
    sourcePersonMode?: ExperiencePersonMode;
    providerPersonMode?: ExperiencePersonMode;
    normalizedPersonMode?: ExperiencePersonMode;
    finalPersonMode?: ExperiencePersonMode;
    perspectiveNormalizationAttempted?: boolean;
    perspectiveNormalizationApplied?: boolean;
    perspectiveValidationPassed?: boolean;
    normalizedBulletsUsedForApply?: boolean;
    finalMatchesProviderOutput?: boolean;
    finalMatchesSourceAfterNormalization?: boolean;
    meaningfulChangeDetected?: boolean;
    noOpRejected?: boolean;
    rejectionStage?: string;
    typedFailureReason?: string;
    /** @deprecated Prefer clientDeterministicFallbackApplied. */
    fallbackApplied?: boolean;
    countedAsSuccess?: boolean;
    apiResponseKind?: 'provider' | 'repair' | 'fallback' | 'error' | 'empty' | 'unknown';
    serverFallbackUsed?: boolean;
    clientDeterministicFallbackAttempted?: boolean;
    clientDeterministicFallbackReason?: string;
    clientDeterministicFallbackBulletCount?: number;
    clientDeterministicFallbackScripts?: string[];
    clientDeterministicFallbackRequiredFactCount?: number;
    clientDeterministicFallbackCoveredFactCount?: number;
    clientDeterministicFallbackApplied?: boolean;
    clientDeterministicFallbackUncoveredFactIds?: string[];
    summaryDurationExpressionCount?: number;
    authoritativeDurationMonths?: number | null;
    authoritativeDurationBucket?: number | null;
    providerDurationDetected?: boolean;
    conflictingDurationDetected?: boolean;
    duplicateDurationRemoved?: boolean;
    finalDurationExpressionCount?: number;
    operationMode?: ExperienceAiOperationMode;
    sourceWasEmpty?: boolean;
    generationFallbackAttempted?: boolean;
    generationFallbackApplied?: boolean;
    generatedBulletCount?: number;
    relevanceValidationPassed?: boolean;
    tenseValidationPassed?: boolean;
    unsupportedClaimCount?: number;
    generationProviderValidationPassed?: boolean | null;
    generationProviderRejectionReason?: string | null;
    generationFinalPostconditionPassed?: boolean | null;
    generationFallbackBuilderKind?: string | null;
    generationFallbackFailureReason?: string | null;
  };
};

function dutiesTextFromCv(cv: CVData, experienceId?: string): string {
  const exps = cv.experience || [];
  const scoped = experienceId ? exps.filter((e) => e.id === experienceId) : exps;
  // Immutable user/source duties only — never prefer a later AI rewrite in `description`
  // when `canonicalDescription` is already frozen.
  return scoped.map((e) => freezeExperienceAiDescription(e)).join('\n');
}

function prepareCandidate(raw: string, locale: Locale, field: 'summary' | 'experience_description'): string {
  let out = stripAiProtocolMarkers(raw || '');
  if (field === 'experience_description') {
    // Preserve bullet line structure — never collapse newlines (summary fluff
    // stripper replaces all whitespace with a single space).
    out = out
      .split(/\r?\n/)
      .map((line) => {
        let row = line.replace(/^\s*[•\-\*\u2022]\s*/, '').trim();
        if (!row) return '';
        // Strip invented fluff tokens per line without joining lines.
        for (const fluff of [
          /\bincreased\s+revenue\b/giu,
          /\bcustomer[- ]satisfaction\b/giu,
          /\bawards?\b/giu,
        ]) {
          row = row.replace(fluff, ' ');
        }
        row = row.replace(/[ \t]+/g, ' ').trim();
        return row;
      })
      .filter(Boolean)
      .join('\n');
    out = normalizeLocaleText(out, locale);
    return out.trim();
  }
  out = stripUnsupportedSummaryFluff(out, locale);
  out = normalizeLocaleText(out, locale);
  return out;
}

function buildDurationContext(cv: CVData, locale: Locale): DurationIntegrationContext {
  const primaryExp = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const gender = cv.personal?.gender || '';
  const dutiesText = dutiesTextFromCv(cv);
  return {
    role: resolveOccupationalTitleForSummary({
      profileJobTitle: cv.personal?.jobTitle,
      currentExperienceTitle: primaryExp?.position,
      locale,
      gender,
      dutiesText,
    }),
    company: primaryExp?.company || '',
    startDate: primaryExp?.startDate || '',
    gender,
  };
}

function experienceIndexForId(cv: CVData, experienceId?: string): number {
  if (!experienceId) return 0;
  const idx = (cv.experience || []).findIndex((e) => e.id === experienceId);
  return idx >= 0 ? idx : 0;
}

function normalizeLocaleText(text: string, locale: Locale): string {
  let out = (text || '').trim();
  if (locale === 'hi') {
    out = normalizeHindiGeneratedWhitespace(out, 'hi');
  }
  if (locale === 'sr' || locale === 'hr') {
    out = normalizeSerbianDurationGrammar(out);
    // Serbian Latin Summary must not retain confusable Cyrillic letters (pregledа).
    out = normalizeSerbianLatinConfusables(out);
  }
  return out.trim();
}

function summaryPasses(
  summary: string,
  factSet: CvCanonicalFactSet,
  cv: CVData,
  locale: Locale,
  duration: ExperienceDuration,
  roleDutyConflict: boolean,
): { ok: boolean; reason?: string } {
  if (!summary.trim()) return { ok: false, reason: 'empty_summary' };
  if (!textMatchesRequestedFieldLocale(summary, locale, 'summary')) {
    return { ok: false, reason: 'locale_mismatch' };
  }
  if (isWrongLanguageAiOutput(summary, locale)) {
    return { ok: false, reason: 'wrong_language' };
  }
  if (locale === 'hi' && hasSuspiciousHindiMergedTokens(summary)) {
    return { ok: false, reason: 'hindi_merged_tokens' };
  }
  if (hasAiProtocolMarker(summary)) {
    return { ok: false, reason: 'protocol_marker_residual' };
  }
  if (!validateSummaryCompleteness(summary, { locale }).valid) {
    return { ok: false, reason: 'incomplete_summary' };
  }
  const fidelity = validateLocalizedSummary(summary, factSet, {
    locale,
    gender: cv.personal?.gender || '',
    expectedDuration: duration,
    stage: 'client-final-apply',
  });
  if (!fidelity.valid) {
    return { ok: false, reason: fidelity.violations[0]?.kind || 'fidelity_failed' };
  }
  const grammar = validateSerbianDurationGrammar(summary, locale);
  if (!grammar.valid) {
    return { ok: false, reason: 'serbian_duration_grammar' };
  }
  if (countSummaryDurationExpressions(summary, locale) > 1) {
    return { ok: false, reason: 'summary_duplicate_duration' };
  }
  if (locale === 'sr' && hasSerbianLatinMixedScriptToken(summary)) {
    return { ok: false, reason: 'serbian_mixed_script' };
  }
  const forcedTitle = validateSummaryForcedConflictingTitle(summary, {
    locale,
    profileJobTitle: cv.personal?.jobTitle,
    experienceTitle: (cv.experience || [])[0]?.position,
    dutiesText: dutiesTextFromCv(cv),
    roleDutyConflict,
  });
  if (forcedTitle.length) {
    return { ok: false, reason: 'forced_conflicting_title' };
  }
  return { ok: true };
}

function bulletsPass(
  description: string,
  factSet: CvCanonicalFactSet,
  cv: CVData,
  locale: Locale,
  experienceIndex: number,
  isPresent: boolean,
): { ok: boolean; reason?: string } {
  if (!description.trim()) return { ok: false, reason: 'empty_bullets' };
  if (!textMatchesRequestedFieldLocale(description, locale, 'experience_bullet')) {
    return { ok: false, reason: 'locale_mismatch' };
  }
  if (isWrongLanguageAiOutput(description, locale)) {
    return { ok: false, reason: 'wrong_language' };
  }
  if (locale === 'hi' && hasSuspiciousHindiMergedTokens(description)) {
    return { ok: false, reason: 'hindi_merged_tokens' };
  }
  if (hasAiProtocolMarker(description)) {
    return { ok: false, reason: 'protocol_marker_residual' };
  }
  if (hasCvMetaFallbackText(description)) {
    return { ok: false, reason: 'meta_fallback_text' };
  }
  const fidelity = validateLocalizedExperienceBullets(description, factSet, {
    locale,
    gender: cv.personal?.gender || '',
    experienceIndex,
    stage: 'client-final-apply',
    isPresent,
  });
  if (!fidelity.valid) {
    const preferred = fidelity.violations.find((v) =>
      v.kind === 'unsupported_generated_duty'
      || v.kind === 'meta_fallback_text'
      || v.kind === 'missing_canonical_duty'
      || v.kind === 'employment_tense_mismatch'
      || v.kind === 'wrong_language'
      || v.kind === 'unsupported_claim'
      || v.kind === 'unsupported_duty',
    );
    const reason = preferred?.kind
      || fidelity.violations[0]?.kind
      || 'fidelity_failed';
    // Map legacy unsupported_duty to the external contract name when needed.
    if (reason === 'unsupported_duty') {
      return { ok: false, reason: 'unsupported_claim' };
    }
    return { ok: false, reason };
  }
  return { ok: true };
}

function finalizeSummary(input: FinalizeCvAiFieldInput): FinalizeCvAiFieldResult {
  const locale = input.requestedLocale;
  const cv = input.cv;
  const gender = input.gender || cv.personal?.gender || '';
  const factSet = buildCvCanonicalFactSet(cv);
  const durationSnapshot = input.durationSnapshot
    || buildExperienceDurationSnapshot(
      cv.experience || [],
      input.referenceDateIso || new Date().toISOString().slice(0, 10),
    );
  const dutiesText = dutiesTextFromCv(cv);
  const liveSummary = (cv.summary || '').trim();
  const summaryGenerate = resolveAiOperationMode({
    targetContent: liveSummary,
  }) === 'generate_from_context';
  const consistency = evaluateRoleDutyConsistency({
    profileJobTitle: cv.personal?.jobTitle,
    experienceTitle: (cv.experience || []).find((e) => e.isPresent)?.position
      || (cv.experience || [])[0]?.position,
    dutiesText,
  });
  const roleDutyConflict = consistency.conflict;
  const context = buildDurationContext(cv, locale);

  let candidate = prepareCandidate(input.candidate || '', locale, 'summary');
  if (hasAiProtocolMarker(candidate)) {
    candidate = '';
  }
  const durationResolved = resolveSummaryWithDurationPolicy(
    candidate,
    durationSnapshot.total,
    locale,
    {
      forceDurationPhrase: true,
      requireDurationClaim: true,
      context,
    },
  );
  candidate = normalizeLocaleText(durationResolved.summary, locale);
  if (locale === 'sr' || locale === 'hr') {
    candidate = preserveSerbianSummaryFactForms(candidate, dutiesText);
    candidate = normalizeSerbianLatinConfusables(candidate);
    candidate = enrichSerbianSummaryEmploymentGrounding(candidate, {
      role: context.role,
      company: context.company,
      startDate: context.startDate,
    });
  }

  const durationDiag = durationResolved.durationDiagnostics;
  if (
    summaryDurationPostconditionFailed(candidate, durationSnapshot.total, locale, {
      requireDurationClaim: true,
    })
    || (locale === 'sr' && hasSerbianLatinMixedScriptToken(candidate))
  ) {
    // Force deterministic grounded rebuild when postcondition still fails.
    candidate = '';
  }

  let origin: CvAiFinalizeOrigin = input.originHint || 'ai_generated';
  if (durationResolved.status === 'repaired') origin = 'ai_repaired';
  if (durationResolved.status === 'fallback') origin = 'deterministic_fallback';

  const attachSummaryDiag = (
    result: FinalizeCvAiFieldResult,
  ): FinalizeCvAiFieldResult => ({
    ...result,
    diagnostics: {
      ...result.diagnostics,
      operationMode: summaryGenerate
        ? 'generate_from_job_context'
        : 'enhance_existing_description',
      sourceWasEmpty: summaryGenerate,
      summaryDurationExpressionCount: durationDiag?.summaryDurationExpressionCount,
      authoritativeDurationMonths: durationDiag?.authoritativeDurationMonths ?? undefined,
      authoritativeDurationBucket: durationDiag?.authoritativeDurationBucket ?? undefined,
      providerDurationDetected: durationDiag?.providerDurationDetected,
      conflictingDurationDetected: durationDiag?.conflictingDurationDetected,
      duplicateDurationRemoved: durationDiag?.duplicateDurationRemoved,
      finalDurationExpressionCount: countSummaryDurationExpressions(result.text, locale),
    },
  });

  const first = summaryPasses(
    candidate,
    factSet,
    cv,
    locale,
    durationSnapshot.total,
    roleDutyConflict,
  );
  if (first.ok) {
    return attachSummaryDiag({
      blocked: false,
      text: candidate,
      origin,
      roleDutyConflict,
      countedAsSuccess: true,
    });
  }

  const grounded = normalizeLocaleText(
    deterministicLocalizedSummaryFromCanonical(
      factSet,
      locale,
      gender,
      durationSnapshot.total,
    ) || '',
    locale,
  );
  if (grounded) {
    const groundedResolved = resolveSummaryWithDurationPolicy(
      grounded,
      durationSnapshot.total,
      locale,
      {
        forceDurationPhrase: true,
        requireDurationClaim: true,
        context,
      },
    );
    let groundedText = normalizeLocaleText(groundedResolved.summary, locale);
    if (locale === 'sr' || locale === 'hr') {
      groundedText = preserveSerbianSummaryFactForms(groundedText, dutiesText);
      groundedText = normalizeSerbianLatinConfusables(groundedText);
      groundedText = enrichSerbianSummaryEmploymentGrounding(groundedText, {
        role: context.role,
        company: context.company,
        startDate: context.startDate,
      });
    }
    const second = summaryPasses(
      groundedText,
      factSet,
      cv,
      locale,
      durationSnapshot.total,
      roleDutyConflict,
    );
    if (second.ok) {
      return attachSummaryDiag({
        blocked: false,
        text: groundedText,
        origin: 'deterministic_fallback',
        roleDutyConflict,
        countedAsSuccess: true,
      });
    }
  }

  return attachSummaryDiag({
    blocked: true,
    reason: summaryGenerate
      ? 'summary_generation_failed'
      : (first.reason || 'summary_grounding_failed'),
    text: cv.summary || '',
    origin: cv.summaryOrigin || 'user',
    roleDutyConflict,
    countedAsSuccess: false,
  });
}

function detectBulletScripts(text: string): string[] {
  const scripts: string[] = [];
  if (/[A-Za-z]/.test(text)) scripts.push('latin');
  if (/[čćžšđČĆŽŠĐ]/.test(text)) scripts.push('latin_diacritic');
  if (/\p{Script=Cyrillic}/u.test(text)) scripts.push('cyrillic');
  if (/\p{Script=Devanagari}/u.test(text)) scripts.push('devanagari');
  if (/\p{Script=Arabic}/u.test(text)) scripts.push('arabic');
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(text)) scripts.push('cjk');
  return scripts;
}

function finalizeBullets(input: FinalizeCvAiFieldInput): FinalizeCvAiFieldResult {
  const locale = input.requestedLocale;
  const cv = input.cv;
  const gender = input.gender || cv.personal?.gender || '';
  const experienceIndex = experienceIndexForId(cv, input.experienceId);
  const exp = (cv.experience || [])[experienceIndex];
  const isPresent = Boolean(exp?.isPresent);
  const tenseMode: 'present' | 'past' = isPresent ? 'present' : 'past';
  const jobContext = input.jobContext || buildExperienceJobContext({
    position: exp?.position,
    industry: input.industry,
    locale,
    level: input.level,
  });
  const snapshot = input.operationSnapshot;
  const grounding = exp
    ? resolveExperienceAiGrounding(exp, jobContext, freezeExperienceAiDescription)
    : null;
  // Mode follows the immutable live snapshot when present (empty live → generation).
  // Without a snapshot: treat context-excluded stale display as empty operational
  // source so baker→pharmacist (and similar) can occupation-fallback — never use
  // raw stale cooking/pharmacy display to force enhancement coverage.
  const liveOperationSource = (snapshot
    ? (snapshot.normalizedSourceText || snapshot.liveRawText || '')
    : (grounding?.staleGeneratedContentExcluded
      ? ''
      : (exp?.description || ''))).trim();
  const operationMode = resolveExperienceAiOperationMode(liveOperationSource);
  const sourceWasEmpty = operationMode === 'generate_from_job_context';
  const shadowedExpForFacts: WorkExperience | null = exp
    ? (sourceWasEmpty
      ? {
        ...exp,
        description: '',
        originalUserDescription: '',
        canonicalDescription: '',
        generatedDescription: '',
        recoveredSemanticDuties: undefined,
        groundingRecoverySource: undefined,
      }
      : (grounding?.experienceForAi || exp))
    : null;
  const cvForFacts: CVData = shadowedExpForFacts
    ? {
      ...cv,
      experience: (cv.experience || []).map((e) =>
        (e.id === exp!.id ? shadowedExpForFacts : e)),
    }
    : cv;
  const factSet = buildCvCanonicalFactSet(cvForFacts);
  // After occupation/context exclusion, never re-read live/canonical cooking via
  // freezeExperienceAiDescription — that would resurrect stale FACT LOCK duties.
  const dutiesText = sourceWasEmpty
    ? ''
    : (grounding?.staleGeneratedContentExcluded
      ? ''
      : (snapshot?.normalizedSourceText
        || grounding?.sourceDescription
        || dutiesTextFromCv(cvForFacts, input.experienceId)));
  const consistency = evaluateRoleDutyConsistency({
    profileJobTitle: cv.personal?.jobTitle,
    experienceTitle: exp?.position,
    dutiesText,
  });
  const roleDutyConflict = consistency.conflict;
  const canonical = sourceWasEmpty ? [] : bulletsForExperience(factSet, experienceIndex);
  const sourceForCoverage = sourceWasEmpty
    ? ''
    : (liveOperationSource
      || canonical.map((f) => f.sourceText || f.value).join('\n'));
  const sourceUnits = sourceWasEmpty
    ? []
    : (snapshot?.units.length
      ? snapshot.units.map((u) => u.rawUnit)
      : extractSourceDutyUnits(sourceForCoverage));
  const sourceFactCount = sourceUnits.length;
  const providerBulletCount = splitExperienceBullets(input.candidate || '').filter(Boolean).length;
  let generationProviderValidationPassed: boolean | null = null;
  let generationProviderRejectionReason: string | null = null;
  let generationFinalPostconditionPassed: boolean | null = null;
  let generationFallbackBuilderKind: string | null = null;
  let generationFallbackFailureReason: string | null = null;

  let lastRejectStage = 'init';
  let lastRejectReason = sourceWasEmpty
    ? 'experience_generation_failed'
    : 'experience_material_fact_coverage_incomplete';
  let lastCovered = 0;
  let lastRequired = sourceFactCount;
  let providerCoveredFactCount = 0;
  let providerRequiredFactCount = sourceFactCount;
  let fallbackBulletCount = 0;
  let fallbackApplied = false;
  let clientDeterministicFallbackAttempted = false;
  let clientDeterministicFallbackReason: string | undefined = undefined;
  let clientDeterministicFallbackBulletCount = 0;
  let clientDeterministicFallbackScripts: string[] = [];
  let clientDeterministicFallbackRequiredFactCount = sourceFactCount;
  let clientDeterministicFallbackCoveredFactCount = 0;
  let clientDeterministicFallbackApplied = false;
  let clientDeterministicFallbackUncoveredFactIds: string[] = [];
  let generationFallbackAttempted = false;
  let generationFallbackApplied = false;
  let generationValidationMeta = {
    relevanceValidationPassed: false,
    perspectiveValidationPassed: false,
    tenseValidationPassed: false,
    unsupportedClaimCount: 0,
    generatedBulletCount: 0,
  };
  const serverFallbackUsed = input.originHint === 'deterministic_fallback';
  const apiResponseKind: NonNullable<FinalizeCvAiFieldResult['diagnostics']>['apiResponseKind'] =
    input.originHint === 'deterministic_fallback'
      ? 'fallback'
      : input.originHint === 'ai_repaired'
        ? 'repair'
        : 'provider';

  const baseDiag = (): NonNullable<FinalizeCvAiFieldResult['diagnostics']> => ({
    sourceLocale: locale,
    sourceFactCount,
    requiredFactCount: lastRequired,
    coveredFactCount: providerCoveredFactCount || lastCovered,
    providerCoveredFactCount,
    providerRequiredFactCount,
    providerBulletCount,
    fallbackBulletCount,
    finalBulletCount: 0,
    finalBulletScripts: [],
    tenseMode,
    rejectionStage: lastRejectStage,
    typedFailureReason: lastRejectReason,
    fallbackApplied,
    countedAsSuccess: false,
    apiResponseKind,
    serverFallbackUsed,
    clientDeterministicFallbackAttempted,
    clientDeterministicFallbackReason,
    clientDeterministicFallbackBulletCount,
    clientDeterministicFallbackScripts,
    clientDeterministicFallbackRequiredFactCount,
    clientDeterministicFallbackCoveredFactCount,
    clientDeterministicFallbackApplied,
    clientDeterministicFallbackUncoveredFactIds,
    operationMode,
    sourceWasEmpty,
    generationFallbackAttempted,
    generationFallbackApplied,
    generatedBulletCount: generationValidationMeta.generatedBulletCount,
    relevanceValidationPassed: generationValidationMeta.relevanceValidationPassed,
    perspectiveValidationPassed: generationValidationMeta.perspectiveValidationPassed,
    tenseValidationPassed: generationValidationMeta.tenseValidationPassed,
    unsupportedClaimCount: generationValidationMeta.unsupportedClaimCount,
    generationProviderValidationPassed,
    generationProviderRejectionReason,
    generationFinalPostconditionPassed,
    generationFallbackBuilderKind,
    generationFallbackFailureReason,
  });

  const tryAcceptGeneration = (
    text: string,
    origin: FinalizeCvAiFieldResult['origin'],
    stage: string,
  ): FinalizeCvAiFieldResult | null => {
    const candidate = (text || '').trim();
    if (!candidate) {
      lastRejectStage = stage;
      lastRejectReason = 'experience_generation_failed';
      if (stage.includes('fallback')) generationFallbackFailureReason = 'empty_fallback';
      else {
        generationProviderValidationPassed = false;
        generationProviderRejectionReason = 'experience_generation_failed';
      }
      generationFinalPostconditionPassed = false;
      return null;
    }
    const gen = validateExperienceGenerationOutput(candidate, {
      locale,
      position: exp?.position || cv.personal?.jobTitle || '',
      isPresent,
    });
    generationValidationMeta = {
      relevanceValidationPassed: gen.relevanceValidationPassed,
      perspectiveValidationPassed: gen.perspectiveValidationPassed,
      tenseValidationPassed: gen.tenseValidationPassed,
      unsupportedClaimCount: gen.unsupportedClaimCount,
      generatedBulletCount: gen.generatedBulletCount,
    };
    if (!gen.ok) {
      lastRejectStage = stage;
      lastRejectReason = gen.reason || 'experience_generation_failed';
      if (stage.includes('fallback')) generationFallbackFailureReason = lastRejectReason;
      else {
        generationProviderValidationPassed = false;
        generationProviderRejectionReason = lastRejectReason;
      }
      generationFinalPostconditionPassed = false;
      return null;
    }
    // Generation mode: locale/script safety only — never require canonical duties
    // or enhancement-only missing_canonical_duty postconditions.
    const pass = bulletsPass(candidate, factSet, cvForFacts, locale, experienceIndex, isPresent);
    if (!pass.ok) {
      const enhancementOnly = pass.reason === 'missing_canonical_duty'
        || pass.reason === 'material_duty_removed'
        || pass.reason === 'unsupported_generated_duty';
      const titleScriptExempt = pass.reason === 'locale_mismatch' || pass.reason === 'wrong_language';
      if (!enhancementOnly && !titleScriptExempt) {
        lastRejectStage = stage;
        lastRejectReason = pass.reason === 'locale_mismatch'
          ? 'experience_generation_locale_invalid'
          : (pass.reason || 'experience_generation_failed');
        if (stage.includes('fallback')) generationFallbackFailureReason = lastRejectReason;
        else {
          generationProviderValidationPassed = false;
          generationProviderRejectionReason = lastRejectReason;
        }
        generationFinalPostconditionPassed = false;
        return null;
      }
    }
    const bulletCount = splitExperienceBullets(candidate).filter(Boolean).length;
    const isClientFallback = origin === 'deterministic_fallback';
    if (isClientFallback) {
      fallbackApplied = true;
      fallbackBulletCount = bulletCount;
      clientDeterministicFallbackApplied = true;
      clientDeterministicFallbackBulletCount = bulletCount;
      clientDeterministicFallbackScripts = detectBulletScripts(candidate);
      generationFallbackApplied = true;
      generationFallbackBuilderKind = 'job_context_generation';
      generationFallbackFailureReason = null;
      // Do not keep a prior provider rejection as the fallback "reason" when fallback succeeds.
      clientDeterministicFallbackReason = undefined;
    } else {
      generationProviderValidationPassed = true;
      generationProviderRejectionReason = null;
    }
    generationFinalPostconditionPassed = true;
    return {
      blocked: false,
      text: candidate,
      origin,
      roleDutyConflict,
      countedAsSuccess: true,
      diagnostics: {
        ...baseDiag(),
        coveredFactCount: 0,
        requiredFactCount: 0,
        finalBulletCount: bulletCount,
        finalBulletScripts: detectBulletScripts(candidate),
        rejectionStage: undefined,
        typedFailureReason: undefined,
        countedAsSuccess: true,
        generatedBulletCount: bulletCount,
        relevanceValidationPassed: true,
        generationFallbackAttempted: isClientFallback || generationFallbackAttempted,
        generationFallbackApplied: isClientFallback,
      },
    };
  };

  const tryAccept = (
    text: string,
    origin: FinalizeCvAiFieldResult['origin'],
    stage: string,
    options?: {
      /** When set, skip semantic rediscovery and use provenance coverage. */
      provenancedIdentity?: ReturnType<typeof validateProvenancedDeterministicFallbackCoverage>;
    },
  ): FinalizeCvAiFieldResult | null => {
    const candidate = (text || '').trim();
    if (!candidate) {
      lastRejectStage = stage;
      lastRejectReason = 'empty_bullets';
      return null;
    }
    const pass = bulletsPass(candidate, factSet, cvForFacts, locale, experienceIndex, isPresent);
    if (!pass.ok) {
      lastRejectStage = stage;
      lastRejectReason = pass.reason || 'fidelity_failed';
      return null;
    }
    if (sourceForCoverage) {
      const post = validateExperienceApplyMaterialPostcondition(sourceForCoverage, candidate);
      if (!post.ok) {
        lastRejectStage = `${stage}:material_postcondition`;
        lastRejectReason = post.reason || 'experience_material_fact_coverage_incomplete';
        lastRequired = post.required?.length ?? sourceFactCount;
        lastCovered = post.covered?.length ?? 0;
        return null;
      }
      const identity = options?.provenancedIdentity
        || ((locale === 'sr' || locale === 'hr')
          && !/\p{Script=Devanagari}|\p{Script=Arabic}|[\u3040-\u30ff\u3400-\u9fff]/u.test(sourceForCoverage)
          ? validateSourceUnitsMateriallyPreserved(sourceForCoverage, candidate)
          : validateSourceFactIdentityCoverage(sourceForCoverage, candidate));
      lastRequired = identity.requiredIds.length;
      lastCovered = identity.coveredIds.length;
      if (stage === 'source_preserving_fallback' || stage === 'canonical_fallback') {
        clientDeterministicFallbackRequiredFactCount = identity.requiredIds.length;
        clientDeterministicFallbackCoveredFactCount = identity.coveredIds.length;
        clientDeterministicFallbackUncoveredFactIds = identity.missingIds || [];
      }
      if (!identity.ok) {
        // Provenanced deterministic path: never bypass via material-key catalogue.
        if (options?.provenancedIdentity) {
          lastRejectStage = `${stage}:source_fact_identity`;
          lastRejectReason = identity.reason || 'experience_material_fact_coverage_incomplete';
          return null;
        }
        // Cross-script provider/semantic path: allow only when every source unit has
        // a material key and description-level material coverage already passed.
        const units = sourceForCoverage
          .split(/\n+/)
          .map((l) => l.replace(/^[•\-\*\u2022]\s*/u, '').trim())
          .filter((l) => l.length > 8);
        const keyedUnits = units.filter((u) =>
          materialDutyKeysFromDescription(u).some((k) => k !== 'generic_duty'));
        if (keyedUnits.length < units.length || keyedUnits.length === 0) {
          lastRejectStage = `${stage}:source_fact_identity`;
          lastRejectReason = identity.reason || 'experience_material_fact_coverage_incomplete';
          return null;
        }
      }
    }
    const bulletCount = splitExperienceBullets(candidate).filter(Boolean).length;
    const isClientFallback = origin === 'deterministic_fallback'
      && (stage === 'canonical_fallback' || stage === 'source_preserving_fallback' || stage === 'occupation_fallback');
    if (isClientFallback) {
      fallbackApplied = true;
      fallbackBulletCount = bulletCount;
      clientDeterministicFallbackApplied = true;
      clientDeterministicFallbackBulletCount = bulletCount;
      clientDeterministicFallbackScripts = detectBulletScripts(candidate);
      clientDeterministicFallbackCoveredFactCount = lastCovered || sourceFactCount;
      clientDeterministicFallbackRequiredFactCount = lastRequired || sourceFactCount;
      clientDeterministicFallbackUncoveredFactIds = [];
    }
    return {
      blocked: false,
      text: candidate,
      origin,
      roleDutyConflict,
      countedAsSuccess: true,
      diagnostics: {
        ...baseDiag(),
        // Keep provider coverage distinct from client fallback coverage.
        coveredFactCount: isClientFallback
          ? providerCoveredFactCount
          : (lastCovered || sourceFactCount),
        requiredFactCount: isClientFallback
          ? providerRequiredFactCount
          : (lastRequired || sourceFactCount),
        providerCoveredFactCount,
        providerRequiredFactCount,
        fallbackBulletCount: isClientFallback ? bulletCount : fallbackBulletCount,
        finalBulletCount: bulletCount,
        finalBulletScripts: detectBulletScripts(candidate),
        rejectionStage: undefined,
        typedFailureReason: undefined,
        fallbackApplied: isClientFallback,
        countedAsSuccess: true,
        clientDeterministicFallbackApplied: isClientFallback,
        clientDeterministicFallbackBulletCount: isClientFallback
          ? bulletCount
          : clientDeterministicFallbackBulletCount,
        clientDeterministicFallbackScripts: isClientFallback
          ? detectBulletScripts(candidate)
          : clientDeterministicFallbackScripts,
        clientDeterministicFallbackCoveredFactCount: isClientFallback
          ? (lastCovered || sourceFactCount)
          : clientDeterministicFallbackCoveredFactCount,
        clientDeterministicFallbackRequiredFactCount: isClientFallback
          ? (lastRequired || sourceFactCount)
          : clientDeterministicFallbackRequiredFactCount,
        clientDeterministicFallbackUncoveredFactIds: isClientFallback
          ? []
          : clientDeterministicFallbackUncoveredFactIds,
      },
    };
  };

  let candidate = prepareCandidate(input.candidate || '', locale, 'experience_description');
  if (hasAiProtocolMarker(candidate)) {
    candidate = '';
  }
  // Never accept prior-occupation duties after stale grounding was excluded.
  if (
    grounding?.staleGeneratedContentExcluded
    && candidateConflictsWithJobContext(candidate, jobContext)
  ) {
    candidate = '';
  }
  // Occupation / industry labels alone must never justify regulated pharmacy claims.
  const userAllowsRegulated = Boolean(
    grounding?.sourceDescription
    && hasUnsupportedRegulatedPharmacyClaims(grounding.sourceDescription),
  );
  if (
    candidate.trim()
    && hasUnsupportedRegulatedPharmacyClaims(candidate)
    && !userAllowsRegulated
  ) {
    candidate = '';
  }

  // Provider / server output — never treat as client deterministic fallback.
  // Perspective (1sg→CV 3sg) is separate from tenseMode present|past.
  const providerOrigin = input.originHint === 'ai_repaired' ? 'ai_repaired' : 'ai_generated';
  const providerRawForCompare = candidate;
  let perspectiveMeta = {
    sourcePersonMode: detectExperiencePersonMode(sourceForCoverage, locale) as ExperiencePersonMode,
    providerPersonMode: detectExperiencePersonMode(candidate, locale) as ExperiencePersonMode,
    normalizedPersonMode: 'unknown' as ExperiencePersonMode,
    finalPersonMode: 'unknown' as ExperiencePersonMode,
    perspectiveMode: 'cv_third_person' as const,
    perspectiveNormalizationAttempted: false,
    perspectiveNormalizationApplied: false,
    perspectiveValidationPassed: false,
    normalizedBulletsUsedForApply: false,
    finalMatchesProviderOutput: false,
    finalMatchesSourceAfterNormalization: false,
    meaningfulChangeDetected: false,
    noOpRejected: false,
  };

  const attachPerspectiveDiag = (
    result: FinalizeCvAiFieldResult,
  ): FinalizeCvAiFieldResult => ({
    ...result,
    diagnostics: {
      ...result.diagnostics,
      ...perspectiveMeta,
      tenseMode,
    },
  });

  if (candidate.trim()) {
    const persp = normalizeExperienceBulletsPerspective(candidate, {
      locale,
      isPresent,
      gender,
      sourceDescription: sourceForCoverage || candidate,
    });
    perspectiveMeta = {
      ...perspectiveMeta,
      sourcePersonMode: sourceWasEmpty
        ? 'unknown'
        : persp.sourcePersonMode,
      providerPersonMode: persp.providerPersonMode,
      normalizedPersonMode: persp.normalizedPersonMode,
      perspectiveNormalizationAttempted: persp.perspectiveNormalizationAttempted,
      perspectiveNormalizationApplied: persp.perspectiveNormalizationApplied,
      perspectiveValidationPassed: persp.perspectiveValidationPassed,
      finalPersonMode: persp.normalizedPersonMode,
    };
    // Authoritative finalNormalizedBullets — validate and apply this array only.
    const finalNormalizedBullets = persp.text;
    const perspectiveGate = validateExperienceCvPerspective(finalNormalizedBullets, locale);
    perspectiveMeta.perspectiveValidationPassed = perspectiveGate.ok;
    perspectiveMeta.finalPersonMode = perspectiveGate.finalPersonMode;

    if (sourceWasEmpty) {
      // Generation Mode: no source-fact coverage / no-op against empty source.
      if (!perspectiveGate.ok) {
        lastRejectStage = 'provider:perspective';
        lastRejectReason = perspectiveGate.reason || 'experience_generation_failed';
      } else {
        const accepted = tryAcceptGeneration(finalNormalizedBullets, providerOrigin, 'provider');
        if (accepted) {
          perspectiveMeta.normalizedBulletsUsedForApply = true;
          perspectiveMeta.meaningfulChangeDetected = true;
          perspectiveMeta.finalPersonMode = detectExperiencePersonMode(accepted.text, locale);
          return attachPerspectiveDiag(accepted);
        }
      }
    } else {
    const meaningful = experienceAiHasMeaningfulChange(sourceForCoverage, finalNormalizedBullets, {
      perspectiveApplied: persp.perspectiveNormalizationApplied,
    });
    perspectiveMeta.meaningfulChangeDetected = meaningful;
    perspectiveMeta.finalMatchesSourceAfterNormalization = !meaningful
      && !persp.perspectiveNormalizationApplied;
    perspectiveMeta.finalMatchesProviderOutput = finalNormalizedBullets.replace(/\s+/g, ' ').trim()
      === providerRawForCompare.replace(/\s+/g, ' ').trim()
      || (persp.perspectiveNormalizationApplied === false
        && experienceAiHasMeaningfulChange(providerRawForCompare, finalNormalizedBullets) === false);

    if (!meaningful && !persp.perspectiveNormalizationApplied) {
      // Same-locale first-person (or Serbian) source reapplied unchanged → no-op.
      // Cross-locale "same text" (e.g. Serbian source for an English request) must
      // fall through to localized deterministic fallback — not count as success.
      const sourceOkForLocale = sourceUsableInLocale(sourceForCoverage, locale)
        || (locale === 'en' && sourceUsableInLocale(sourceForCoverage, 'en'));
      const sourceNeedsPerspective = experienceRequiresCvThirdPerson(locale)
        && detectExperiencePersonMode(sourceForCoverage, locale) === 'first_singular';
      if (sourceOkForLocale && (sourceNeedsPerspective || locale === 'sr' || locale === 'hr')) {
        perspectiveMeta.noOpRejected = true;
        lastRejectStage = 'provider:noop';
        lastRejectReason = 'experience_ai_noop';
        providerCoveredFactCount = lastCovered;
        providerRequiredFactCount = lastRequired || sourceFactCount;
        return attachPerspectiveDiag({
          blocked: true,
          reason: 'experience_ai_noop',
          text: exp?.description || '',
          origin: 'user',
          roleDutyConflict,
          countedAsSuccess: false,
          diagnostics: {
            ...baseDiag(),
            typedFailureReason: 'experience_ai_noop',
            rejectionStage: 'provider:noop',
          },
        });
      }
      if (sourceOkForLocale) {
        // Already CV-compatible same-locale source re-sent: allow apply for legacy controls.
        perspectiveMeta.finalMatchesSourceAfterNormalization = true;
        const firstAccepted = tryAccept(finalNormalizedBullets, providerOrigin, 'provider');
        providerCoveredFactCount = lastCovered;
        providerRequiredFactCount = lastRequired || sourceFactCount;
        if (firstAccepted) {
          perspectiveMeta.normalizedBulletsUsedForApply = true;
          perspectiveMeta.meaningfulChangeDetected = false;
          perspectiveMeta.finalPersonMode = detectExperiencePersonMode(firstAccepted.text, locale);
          return attachPerspectiveDiag({
            ...firstAccepted,
            diagnostics: {
              ...firstAccepted.diagnostics,
              coveredFactCount: lastCovered || sourceFactCount,
              providerCoveredFactCount: lastCovered || sourceFactCount,
              providerRequiredFactCount: lastRequired || sourceFactCount,
            },
          });
        }
      }
      // Cross-locale unchanged provider text → continue to localized fallback.
      lastRejectStage = 'provider:cross_locale_or_noop';
      lastRejectReason = 'locale_mismatch';
    } else if (!perspectiveGate.ok) {
      lastRejectStage = 'provider:perspective';
      lastRejectReason = perspectiveGate.reason || 'experience_cv_perspective_first_person';
    } else {
      const firstAccepted = tryAccept(
        finalNormalizedBullets,
        providerOrigin,
        'provider',
      );
      providerCoveredFactCount = lastCovered;
      providerRequiredFactCount = lastRequired || sourceFactCount;
      if (firstAccepted) {
        perspectiveMeta.normalizedBulletsUsedForApply = true;
        perspectiveMeta.finalPersonMode = detectExperiencePersonMode(firstAccepted.text, locale);
        return attachPerspectiveDiag({
          ...firstAccepted,
          diagnostics: {
            ...firstAccepted.diagnostics,
            coveredFactCount: lastCovered || sourceFactCount,
            providerCoveredFactCount: lastCovered || sourceFactCount,
            providerRequiredFactCount: lastRequired || sourceFactCount,
          },
        });
      }
    }
    }
  } else {
    providerCoveredFactCount = lastCovered;
    providerRequiredFactCount = lastRequired || sourceFactCount;
  }

  // Provider/server postconditions failed → always attempt client deterministic fallback.
  clientDeterministicFallbackAttempted = true;
  clientDeterministicFallbackReason = lastRejectReason || 'provider_postcondition_failed';

  // Generation Mode: never use source-preserving / canonical FACT LOCK fallbacks.
  if (sourceWasEmpty) {
    generationFallbackAttempted = true;
    generationFallbackBuilderKind = 'job_context_generation';
    // Universal job-context first (arbitrary titles). Known catalogue occupations
    // may refine via occupation-aware only when job-context validation rejects.
    const universalFallback = buildJobContextGenerationFallback({
      locale,
      gender,
      position: exp?.position || cv.personal?.jobTitle,
      industry: input.industry || jobContext.industryNorm,
      isPresent,
    });
    const catalogueFallback = (
      jobContext.positionClass === 'pharmacist_pharmacy'
      || jobContext.industryNorm === 'pharmacy'
      || jobContext.positionClass === 'baker_food'
      || jobContext.positionClass === 'hospitality_service'
    )
      ? buildOccupationAwareExperienceFallback({
        locale,
        gender,
        position: exp?.position || cv.personal?.jobTitle,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      })
      : '';
    const jobCtxFallback = normalizeLocaleText(universalFallback || catalogueFallback, locale);
    if (!jobCtxFallback.trim()) {
      generationFallbackFailureReason = 'empty_fallback';
      lastRejectReason = 'experience_generation_failed';
      lastRejectStage = 'job_context_generation_fallback';
    }
    let genAccepted = tryAcceptGeneration(
      jobCtxFallback,
      'deterministic_fallback',
      'job_context_generation_fallback',
    );
    if (!genAccepted && catalogueFallback.trim() && catalogueFallback.trim() !== jobCtxFallback.trim()) {
      generationFallbackBuilderKind = 'occupation_aware_generation';
      genAccepted = tryAcceptGeneration(
        normalizeLocaleText(catalogueFallback, locale),
        'deterministic_fallback',
        'job_context_generation_fallback',
      );
    }
    if (genAccepted) {
      perspectiveMeta.normalizedBulletsUsedForApply = true;
      perspectiveMeta.meaningfulChangeDetected = true;
      perspectiveMeta.perspectiveValidationPassed = true;
      perspectiveMeta.finalPersonMode = detectExperiencePersonMode(genAccepted.text, locale);
      return attachPerspectiveDiag(genAccepted);
    }
    // Prefer a generation-specific typed reason — never leave enhancement-only codes.
    if (
      lastRejectReason === 'missing_canonical_duty'
      || lastRejectReason === 'experience_material_fact_coverage_incomplete'
    ) {
      lastRejectReason = generationFallbackFailureReason || 'experience_generation_failed';
    }
    return attachPerspectiveDiag({
      blocked: true,
      reason: lastRejectReason || 'experience_generation_failed',
      text: exp?.description || '',
      origin: 'user',
      roleDutyConflict,
      countedAsSuccess: false,
      diagnostics: baseDiag(),
    });
  }

  const groundedRaw = normalizeLocaleText(
    deterministicLocalizedBulletsFromCanonical(canonical, locale, gender, { isPresent }) || '',
    locale,
  );
  const groundedPersp = groundedRaw.trim()
    ? normalizeExperienceBulletsPerspective(groundedRaw, {
      locale,
      isPresent,
      gender,
      sourceDescription: sourceForCoverage,
    })
    : null;
  const grounded = groundedPersp?.text || groundedRaw;
  if (
    grounded.trim()
    && !(grounding?.staleGeneratedContentExcluded && candidateConflictsWithJobContext(grounded, jobContext))
  ) {
    const groundedGate = validateExperienceCvPerspective(grounded, locale);
    if (groundedGate.ok) {
      if (groundedPersp) {
        perspectiveMeta = {
          ...perspectiveMeta,
          normalizedPersonMode: groundedPersp.normalizedPersonMode,
          perspectiveNormalizationAttempted: true,
          perspectiveNormalizationApplied:
            perspectiveMeta.perspectiveNormalizationApplied
            || groundedPersp.perspectiveNormalizationApplied,
          perspectiveValidationPassed: groundedGate.ok,
          meaningfulChangeDetected:
            perspectiveMeta.meaningfulChangeDetected
            || experienceAiHasMeaningfulChange(sourceForCoverage, grounded),
          noOpRejected: false,
        };
      }
      const secondAccepted = tryAccept(grounded, 'deterministic_fallback', 'canonical_fallback');
      if (secondAccepted) {
        perspectiveMeta.normalizedBulletsUsedForApply = true;
        perspectiveMeta.finalPersonMode = detectExperiencePersonMode(secondAccepted.text, locale);
        return attachPerspectiveDiag(secondAccepted);
      }
    }
  }

  // Rebuild from authoritative source units when provider/fallback collapsed facts.
  // Identities are captured from immutable source units before tense transforms.
  // Do not skip because the API response was already labelled server `fallback`.
  if (sourceForCoverage && !grounding?.staleGeneratedContentExcluded) {
    const built = buildSourcePreservingExperienceBulletsWithProvenance(
      sourceForCoverage,
      locale,
      gender,
      {
        isPresent,
        operationSnapshotId: snapshot?.operationSnapshotId,
        snapshotUnits: snapshot?.units.map((u) => ({
          rawUnit: u.rawUnit,
          sourceUnitId: u.sourceUnitId,
          sourceFactIds: u.sourceFactIds,
          operationSnapshotId: u.operationSnapshotId,
        })),
      },
    );
    // Keep typed provenance through locale/tense post-processing — only refresh
    // display text per index; never drop sourceUnitId / operationSnapshotId.
    const preservedLines = built.bullets.map((b) =>
      normalizeLocaleText(b.text || '', locale).trim());
    const alignedProvenance = built.bullets.map((b, i) => ({
      ...b,
      text: (preservedLines[i] || b.text).trim(),
      operationSnapshotId: b.operationSnapshotId || snapshot?.operationSnapshotId,
    }));
    const preserved = alignedProvenance.map((b) => b.text).filter(Boolean).length
      ? formatExperienceBullets(alignedProvenance.map((b) => b.text))
      : normalizeLocaleText(built.text || '', locale);
    const provenanceCoverage = validateProvenancedDeterministicFallbackCoverage(
      sourceForCoverage,
      alignedProvenance,
      { expectedOperationSnapshotId: snapshot?.operationSnapshotId },
    );
    clientDeterministicFallbackBulletCount = alignedProvenance.filter((b) => b.text.trim()).length;
    clientDeterministicFallbackScripts = detectBulletScripts(preserved);
    clientDeterministicFallbackRequiredFactCount = provenanceCoverage.requiredIds.length;
    clientDeterministicFallbackCoveredFactCount = provenanceCoverage.coveredIds.length;
    clientDeterministicFallbackUncoveredFactIds = provenanceCoverage.missingIds;
    fallbackBulletCount = clientDeterministicFallbackBulletCount;
    const preservedGate = validateExperienceCvPerspective(preserved, locale);
    // Fallback after provider failure is always an allowed repair path — even when
    // the rebuilt CV text matches the source after perspective (provider was empty
    // or incomplete). No-op rejection applies only to unchanged provider output.
    perspectiveMeta = {
      ...perspectiveMeta,
      perspectiveNormalizationAttempted: true,
      perspectiveNormalizationApplied: true,
      perspectiveValidationPassed: preservedGate.ok,
      normalizedPersonMode: detectExperiencePersonMode(preserved, locale),
      meaningfulChangeDetected:
        perspectiveMeta.meaningfulChangeDetected
        || experienceAiHasMeaningfulChange(sourceForCoverage, preserved),
      noOpRejected: false,
    };
    if (preservedGate.ok && provenanceCoverage.ok) {
      const preservedAccepted = tryAccept(
        preserved,
        'deterministic_fallback',
        'source_preserving_fallback',
        { provenancedIdentity: provenanceCoverage },
      );
      if (preservedAccepted) {
        perspectiveMeta.normalizedBulletsUsedForApply = true;
        perspectiveMeta.finalPersonMode = detectExperiencePersonMode(preservedAccepted.text, locale);
        return attachPerspectiveDiag(preservedAccepted);
      }
    } else if (!preservedGate.ok) {
      lastRejectReason = preservedGate.reason || 'experience_cv_perspective_first_person';
      lastRejectStage = 'source_preserving_fallback:perspective';
    }
  }

  const occupationFallback = normalizeLocaleText(
    (
      jobContext.positionClass === 'pharmacist_pharmacy'
      || jobContext.industryNorm === 'pharmacy'
      || jobContext.positionClass === 'baker_food'
      || jobContext.positionClass === 'hospitality_service'
      || jobContext.positionClass === 'software_tech'
    )
      ? (buildOccupationAwareExperienceFallback({
        locale,
        gender,
        position: exp?.position,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      }) || buildJobContextGenerationFallback({
        locale,
        gender,
        position: exp?.position || cv.personal?.jobTitle,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      }))
      : (buildJobContextGenerationFallback({
        locale,
        gender,
        position: exp?.position || cv.personal?.jobTitle,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      }) || buildOccupationAwareExperienceFallback({
        locale,
        gender,
        position: exp?.position,
        industry: input.industry || jobContext.industryNorm,
        isPresent,
      })),
    locale,
  );
  const allowOccupationFallback = Boolean(
    grounding?.staleGeneratedContentExcluded
    || (input.industry && input.industry !== 'general')
    || jobContext.positionClass === 'pharmacist_pharmacy'
    || jobContext.positionClass === 'software_tech'
    || sourceWasEmpty,
  );
  if (
    occupationFallback.trim()
    && allowOccupationFallback
    && (canonical.length === 0 || grounding?.staleGeneratedContentExcluded || sourceWasEmpty)
  ) {
    // Occupation / job-context fallback only when there are no user source facts to preserve.
    if (!sourceForCoverage.trim()) {
      clientDeterministicFallbackBulletCount = splitExperienceBullets(occupationFallback).filter(Boolean).length;
      clientDeterministicFallbackScripts = detectBulletScripts(occupationFallback);
      if (sourceWasEmpty) {
        generationFallbackAttempted = true;
        const genAccepted = tryAcceptGeneration(
          occupationFallback,
          'deterministic_fallback',
          'occupation_fallback',
        );
        if (genAccepted) return attachPerspectiveDiag(genAccepted);
      } else {
        return {
          blocked: false,
          text: occupationFallback,
          origin: 'deterministic_fallback',
          roleDutyConflict,
          countedAsSuccess: true,
          diagnostics: {
            ...baseDiag(),
            fallbackApplied: true,
            fallbackBulletCount: clientDeterministicFallbackBulletCount,
            finalBulletCount: clientDeterministicFallbackBulletCount,
            finalBulletScripts: clientDeterministicFallbackScripts,
            rejectionStage: undefined,
            typedFailureReason: undefined,
            countedAsSuccess: true,
            clientDeterministicFallbackAttempted: true,
            clientDeterministicFallbackApplied: true,
            clientDeterministicFallbackBulletCount,
            clientDeterministicFallbackScripts,
            clientDeterministicFallbackCoveredFactCount: 0,
            clientDeterministicFallbackRequiredFactCount: 0,
          },
        };
      }
    }
  }

  const coverageFail = sourceForCoverage
    ? validateExperienceApplyMaterialPostcondition(
      sourceForCoverage,
      candidate || grounded || '',
    )
    : null;
  if (coverageFail && !coverageFail.ok) {
    lastRejectReason = coverageFail.reason || lastRejectReason;
    lastRejectStage = lastRejectStage === 'init' ? 'final_block' : lastRejectStage;
    lastCovered = coverageFail.covered?.length ?? lastCovered;
    lastRequired = coverageFail.required?.length ?? lastRequired;
  }

  return attachPerspectiveDiag({
    blocked: true,
    reason: coverageFail?.reason
      || lastRejectReason
      || 'experience_material_fact_coverage_incomplete',
    text: exp?.description || '',
    origin: 'user',
    roleDutyConflict,
    countedAsSuccess: false,
    diagnostics: baseDiag(),
  });
}

/**
 * Single authoritative gate for AI field application.
 */
export function finalizeCvAiFieldForApply(
  input: FinalizeCvAiFieldInput,
): FinalizeCvAiFieldResult {
  if (input.field === 'experience_description' || input.action === 'experience_bullets') {
    return finalizeBullets(input);
  }
  return finalizeSummary(input);
}

/** Apply finalized summary into CV (state / cvRef / autosave source of truth). */
export function applyFinalizedSummaryToCv(
  cv: CVData,
  locale: Locale,
  finalized: FinalizeCvAiFieldResult,
  jobContext?: ExperienceJobContext,
): CVData {
  if (finalized.blocked || !finalized.countedAsSuccess) return cv;
  const primary = (cv.experience || []).find((e) => e.isPresent) || (cv.experience || [])[0];
  const ctx = jobContext || buildExperienceJobContext({
    position: primary?.position || cv.personal?.jobTitle,
    locale,
  });
  return acceptValidatedAiContent(cv, {
    locale,
    summary: finalized.text,
    summaryOrigin: finalized.origin as CvSummaryOrigin,
    jobContext: ctx,
  });
}

/** Apply finalized bullets into CV. Rebuilds stale AI Summary when occupation changed. */
export function applyFinalizedBulletsToCv(
  cv: CVData,
  locale: Locale,
  experienceId: string,
  finalized: FinalizeCvAiFieldResult,
  jobContext?: ExperienceJobContext,
): CVData {
  if (finalized.blocked || !finalized.countedAsSuccess) return cv;
  const descriptionOrigin = finalized.origin === 'deterministic_fallback'
    ? 'deterministic_fallback' as const
    : finalized.origin === 'ai_repaired'
      ? 'ai_repaired' as const
      : 'ai_generated' as const;
  let next = acceptValidatedAiContent(cv, {
    locale,
    experienceId,
    description: finalized.text,
    descriptionOrigin,
    jobContext,
    confirmGeneratedAsGrounding: Boolean(finalized.diagnostics?.sourceWasEmpty),
  });

  const exp = (next.experience || []).find((e) => e.id === experienceId)
    || (next.experience || [])[0];
  const ctx = jobContext || buildExperienceJobContext({
    position: exp?.position || next.personal?.jobTitle,
    locale,
  });
  const summaryText = next.summary || '';
  const summaryStale = isSummaryStaleForJobContext(summaryText, ctx, {
    summaryOrigin: next.summaryOrigin,
    summaryGenerationContextKey: next.summaryGenerationContextKey,
  }) || textLooksLikeCookingDuties(summaryText);

  if (summaryStale && next.summaryOrigin !== 'user') {
    const durationSnapshot = buildExperienceDurationSnapshot(next.experience || []);
    const durationPhrase = formatApproximateDurationPhrase(durationSnapshot.total, locale);
    const rebuilt = scrubOrphanDurationFragments(
      buildOccupationAwareSummaryFallback({
        locale,
        gender: next.personal?.gender || '',
        position: exp?.position || next.personal?.jobTitle,
        industry: ctx.industryNorm,
        company: exp?.company,
        startDate: exp?.startDate,
        durationPhrase,
        isPresent: exp?.isPresent,
      }),
    );
    next = acceptValidatedAiContent(next, {
      locale,
      summary: rebuilt,
      summaryOrigin: 'deterministic_fallback',
      jobContext: ctx,
    });
  } else if (summaryStale && next.summaryOrigin === 'user') {
    // Keep user text in state, but clear generation context so export rebuilds safely.
    next = {
      ...next,
      summaryGenerationContextKey: undefined,
    };
  }

  return next;
}

/**
 * Page-equivalent orchestration: finalize → accept → quality projection texts.
 * Used by the Android CV builder handlers and by end-to-end regression tests.
 */
export function runCvAiApplyPipeline(options: {
  cv: CVData;
  locale: Locale;
  action: CvAiFinalizeAction;
  candidate: string;
  experienceId?: string;
  durationSnapshot?: ExperienceDurationSnapshot;
  referenceDateIso?: string;
  industry?: string;
  level?: string;
  jobContext?: ExperienceJobContext;
}): {
  blocked: boolean;
  reason?: string;
  finalized: FinalizeCvAiFieldResult;
  stateCv: CVData;
  previewCv: CVData;
  pdfCv: CVData;
  docxCv: CVData;
} {
  const field: CvAiFinalizeField = options.action === 'experience_bullets'
    ? 'experience_description'
    : 'summary';
  const exp = options.experienceId
    ? (options.cv.experience || []).find((e) => e.id === options.experienceId)
    : (options.cv.experience || [])[0];
  const jobContext = options.jobContext || (options.action === 'experience_bullets'
    ? buildExperienceJobContext({
      position: exp?.position,
      industry: options.industry,
      locale: options.locale,
      level: options.level,
    })
    : undefined);
  const finalized = finalizeCvAiFieldForApply({
    action: options.action,
    field,
    requestedLocale: options.locale,
    gender: options.cv.personal?.gender || '',
    cv: options.cv,
    candidate: options.candidate,
    experienceId: options.experienceId,
    durationSnapshot: options.durationSnapshot,
    referenceDateIso: options.referenceDateIso,
    industry: options.industry,
    level: options.level,
    jobContext,
  });

  if (finalized.blocked || !finalized.countedAsSuccess) {
    return {
      blocked: true,
      reason: finalized.reason,
      finalized,
      stateCv: options.cv,
      previewCv: options.cv,
      pdfCv: options.cv,
      docxCv: options.cv,
    };
  }

  const stateCv = field === 'summary'
    ? applyFinalizedSummaryToCv(options.cv, options.locale, finalized)
    : applyFinalizedBulletsToCv(options.cv, options.locale, options.experienceId!, finalized, jobContext);

  const previewCv = applyCvContentQuality(stateCv, options.locale, {
    gender: stateCv.personal?.gender || '',
    summaryOrigin: stateCv.summaryOrigin,
    referenceDate: options.referenceDateIso,
  }).cv;
  // Preview / PDF / DOCX must share the same finalized quality projection.
  const pdfCv = previewCv;
  const docxCv = previewCv;

  return {
    blocked: false,
    finalized,
    stateCv,
    previewCv,
    pdfCv,
    docxCv,
  };
}
