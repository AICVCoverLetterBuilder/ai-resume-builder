/**
 * Authoritative finalization gate for freshly generated CV AI content.
 *
 * Every Generate / Shorter / Stronger / Professional / Bullets apply path MUST
 * run candidate text through `finalizeCvAiFieldForApply` before writing React
 * state, cvRef, autosave, preview, PDF, or DOCX. Raw provider/repair text must
 * never be applied after this function.
 */
import type { CVData, CvSummaryOrigin } from './types';
import type { Locale } from './i18n/translations';
import type { CoverLetterGender } from './cover-letter-gender';
import {
  buildCvCanonicalFactSet,
  bulletsForExperience,
  freezeCanonicalExperienceDescription,
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
  buildSourcePreservingExperienceBullets,
} from './cv-localized-fallback';
import { validateSourceFactIdentityCoverage, extractSourceDutyUnits } from './cv-source-fact-identity';
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
  materialDutyKeysFromDescription,
  validateExperienceApplyMaterialPostcondition,
} from './cv-material-duty-coverage';

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
    providerBulletCount?: number;
    fallbackBulletCount?: number;
    finalBulletCount?: number;
    finalBulletScripts?: string[];
    tenseMode?: 'present' | 'past' | 'unknown';
    rejectionStage?: string;
    typedFailureReason?: string;
    fallbackApplied?: boolean;
    countedAsSuccess?: boolean;
  };
};

function dutiesTextFromCv(cv: CVData, experienceId?: string): string {
  const exps = cv.experience || [];
  const scoped = experienceId ? exps.filter((e) => e.id === experienceId) : exps;
  // Immutable user/source duties only — never prefer a later AI rewrite in `description`
  // when `canonicalDescription` is already frozen.
  return scoped.map((e) => freezeCanonicalExperienceDescription(e)).join('\n');
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

  let origin: CvAiFinalizeOrigin = input.originHint || 'ai_generated';
  if (durationResolved.status === 'repaired') origin = 'ai_repaired';
  if (durationResolved.status === 'fallback') origin = 'deterministic_fallback';

  const first = summaryPasses(
    candidate,
    factSet,
    cv,
    locale,
    durationSnapshot.total,
    roleDutyConflict,
  );
  if (first.ok) {
    return {
      blocked: false,
      text: candidate,
      origin,
      roleDutyConflict,
      countedAsSuccess: true,
    };
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
    const groundedText = normalizeLocaleText(groundedResolved.summary, locale);
    const second = summaryPasses(
      groundedText,
      factSet,
      cv,
      locale,
      durationSnapshot.total,
      roleDutyConflict,
    );
    if (second.ok) {
      return {
        blocked: false,
        text: groundedText,
        origin: 'deterministic_fallback',
        roleDutyConflict,
        countedAsSuccess: true,
      };
    }
  }

  return {
    blocked: true,
    reason: first.reason || 'summary_finalization_blocked',
    text: cv.summary || '',
    origin: cv.summaryOrigin || 'user',
    roleDutyConflict,
    countedAsSuccess: false,
  };
}

function detectBulletScripts(text: string): string[] {
  const scripts: string[] = [];
  if (/[A-Za-z]/.test(text)) scripts.push('latin');
  if (/[čćžšđČĆŽŠĐ]/.test(text)) scripts.push('latin-diacritic');
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
  const grounding = exp
    ? resolveExperienceAiGrounding(exp, jobContext, freezeCanonicalExperienceDescription)
    : null;
  const cvForFacts: CVData = exp && grounding
    ? {
      ...cv,
      experience: (cv.experience || []).map((e) =>
        (e.id === exp.id ? grounding.experienceForAi : e)),
    }
    : cv;
  const factSet = buildCvCanonicalFactSet(cvForFacts);
  const dutiesText = grounding?.sourceDescription
    || dutiesTextFromCv(cvForFacts, input.experienceId);
  const consistency = evaluateRoleDutyConsistency({
    profileJobTitle: cv.personal?.jobTitle,
    experienceTitle: exp?.position,
    dutiesText,
  });
  const roleDutyConflict = consistency.conflict;
  const canonical = bulletsForExperience(factSet, experienceIndex);
  const sourceForCoverage = dutiesText.trim()
    || canonical.map((f) => f.sourceText || f.value).join('\n');
  const sourceUnits = extractSourceDutyUnits(sourceForCoverage);
  const sourceFactCount = sourceUnits.length;
  const providerBulletCount = splitExperienceBullets(input.candidate || '').filter(Boolean).length;

  let lastRejectStage = 'init';
  let lastRejectReason = 'experience_material_fact_coverage_incomplete';
  let lastCovered = 0;
  let lastRequired = sourceFactCount;
  let fallbackBulletCount = 0;
  let fallbackApplied = false;

  const baseDiag = (): NonNullable<FinalizeCvAiFieldResult['diagnostics']> => ({
    sourceLocale: locale,
    sourceFactCount,
    requiredFactCount: lastRequired,
    coveredFactCount: lastCovered,
    providerBulletCount,
    fallbackBulletCount,
    finalBulletCount: 0,
    finalBulletScripts: [],
    tenseMode,
    rejectionStage: lastRejectStage,
    typedFailureReason: lastRejectReason,
    fallbackApplied,
    countedAsSuccess: false,
  });

  const tryAccept = (
    text: string,
    origin: FinalizeCvAiFieldResult['origin'],
    stage: string,
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
      const identity = validateSourceFactIdentityCoverage(sourceForCoverage, candidate);
      lastRequired = identity.requiredIds.length;
      lastCovered = identity.coveredIds.length;
      if (!identity.ok) {
        // Cross-script: allow only when every source unit has a material key and
        // description-level material coverage already passed (cooking/logistics/cs).
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
    const isFallback = origin === 'deterministic_fallback';
    if (isFallback) {
      fallbackApplied = true;
      fallbackBulletCount = bulletCount;
    }
    return {
      blocked: false,
      text: candidate,
      origin,
      roleDutyConflict,
      countedAsSuccess: true,
      diagnostics: {
        ...baseDiag(),
        coveredFactCount: lastCovered || sourceFactCount,
        requiredFactCount: lastRequired || sourceFactCount,
        fallbackBulletCount: isFallback ? bulletCount : fallbackBulletCount,
        finalBulletCount: bulletCount,
        finalBulletScripts: detectBulletScripts(candidate),
        rejectionStage: undefined,
        typedFailureReason: undefined,
        fallbackApplied: isFallback,
        countedAsSuccess: true,
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

  const firstAccepted = tryAccept(candidate, input.originHint || 'ai_generated', 'provider');
  if (firstAccepted) return firstAccepted;

  const grounded = normalizeLocaleText(
    deterministicLocalizedBulletsFromCanonical(canonical, locale, gender, { isPresent }) || '',
    locale,
  );
  if (!(grounding?.staleGeneratedContentExcluded && candidateConflictsWithJobContext(grounded, jobContext))) {
    const secondAccepted = tryAccept(grounded, 'deterministic_fallback', 'canonical_fallback');
    if (secondAccepted) return secondAccepted;
  }

  // Rebuild from authoritative source units when provider/fallback collapsed facts.
  // Identities are captured from immutable source units before tense transforms.
  if (sourceForCoverage && !grounding?.staleGeneratedContentExcluded) {
    const preserved = normalizeLocaleText(
      buildSourcePreservingExperienceBullets(sourceForCoverage, locale, gender, { isPresent }) || '',
      locale,
    );
    fallbackBulletCount = splitExperienceBullets(preserved).filter(Boolean).length;
    const preservedAccepted = tryAccept(preserved, 'deterministic_fallback', 'source_preserving_fallback');
    if (preservedAccepted) return preservedAccepted;
  }

  const occupationFallback = normalizeLocaleText(
    buildOccupationAwareExperienceFallback({
      locale,
      gender,
      position: exp?.position,
      industry: input.industry || jobContext.industryNorm,
      isPresent,
    }),
    locale,
  );
  const allowOccupationFallback = Boolean(
    grounding?.staleGeneratedContentExcluded
    || (input.industry && input.industry !== 'general')
    || jobContext.positionClass === 'pharmacist_pharmacy'
    || jobContext.positionClass === 'software_tech',
  );
  if (
    occupationFallback.trim()
    && allowOccupationFallback
    && (canonical.length === 0 || grounding?.staleGeneratedContentExcluded)
  ) {
    // Occupation fallback only when there are no user source facts to preserve.
    if (!sourceForCoverage.trim()) {
      return {
        blocked: false,
        text: occupationFallback,
        origin: 'deterministic_fallback',
        roleDutyConflict,
        countedAsSuccess: true,
        diagnostics: {
          ...baseDiag(),
          fallbackApplied: true,
          fallbackBulletCount: splitExperienceBullets(occupationFallback).filter(Boolean).length,
          finalBulletCount: splitExperienceBullets(occupationFallback).filter(Boolean).length,
          finalBulletScripts: detectBulletScripts(occupationFallback),
          rejectionStage: undefined,
          typedFailureReason: undefined,
          countedAsSuccess: true,
        },
      };
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
  }

  return {
    blocked: true,
    reason: coverageFail?.reason
      || lastRejectReason
      || 'experience_material_fact_coverage_incomplete',
    text: exp?.description || '',
    origin: 'user',
    roleDutyConflict,
    countedAsSuccess: false,
    diagnostics: baseDiag(),
  };
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
