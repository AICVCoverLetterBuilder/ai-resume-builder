/**
 * Creative Artistic export gate.
 * Never ships invalid localized content. Never silently dumps English into a
 * non-English export — block instead.
 * PDF and DOCX must consume one identical validated projection per export.
 */
import type { CVData } from './types';
import type { Locale } from './i18n/translations';
import {
  buildCvCanonicalFactSet,
  buildFactSetFromExperienceDescription,
  bulletsForExperience,
  deterministicBulletsFromCanonical,
} from './cv-canonical-facts';
import { deterministicSummaryFromCanonical } from './cv-content-activation';
import {
  applyProjectionToCv,
  buildProjectionFromLocalizedCv,
  buildProjectionId,
  isProjectionFresh,
  storeLocalizedProjection,
  type ValidatedLocalizedCvProjection,
} from './cv-canonical-snapshot';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
  isEnglishCanonicalDump,
} from './cv-localized-fallback';
import {
  validateLocalizedExperienceBullets,
  validateLocalizedSummary,
  validateSummaryCompleteness,
} from './cv-semantic-fidelity';
import { buildExperienceDurationSnapshot } from './cv-experience-duration';
import { applyCvContentQuality } from './cv-content-quality';
import { localizeCvLanguageLevel } from './cv-language-levels';
import { getLocalizedCvLanguageName } from './cv-language-options';
import {
  textMatchesRequestedFieldLocale,
  validateFinalLocalizedCvFields,
} from './cv-field-locale-integrity';
import {
  resolveExperienceGroundingDescription,
  type CvExperienceDescriptionOrigin,
} from './cv-experience-provenance';
import { normalizeLegacyCvRuntime } from './cv-legacy-runtime-migration';

export class CreativeArtisticLocaleExportError extends Error {
  readonly locale: Locale;
  readonly reason: string;

  constructor(locale: Locale, reason: string) {
    super(`Creative Artistic export blocked for locale=${locale}: ${reason}`);
    this.name = 'CreativeArtisticLocaleExportError';
    this.locale = locale;
    this.reason = reason;
  }
}

/**
 * Authoritative export grounding for experience duties.
 * Prefer originalUserDescription / user-confirmed canonical — never AI display text.
 */
export function resolveCanonicalExperienceDescription(exp: {
  description?: string;
  canonicalDescription?: string;
  originalUserDescription?: string;
  descriptionOrigin?: CvExperienceDescriptionOrigin | string;
}): string {
  const grounded = resolveExperienceGroundingDescription({
    description: exp.description || '',
    canonicalDescription: exp.canonicalDescription || '',
    originalUserDescription: exp.originalUserDescription || '',
    descriptionOrigin: exp.descriptionOrigin as CvExperienceDescriptionOrigin | undefined,
  });
  if (grounded) return grounded;
  const canonical = (exp.canonicalDescription || '').trim();
  if (canonical) return canonical;
  // Never fall back to AI-generated display text as export grounding.
  if (
    exp.descriptionOrigin !== 'ai_generated'
    && exp.descriptionOrigin !== 'ai_repaired'
    && exp.descriptionOrigin !== 'deterministic_fallback'
  ) {
    return (exp.description || '').trim();
  }
  return '';
}

function isValidLocalizedExperience(
  candidate: string,
  factSet: ReturnType<typeof buildFactSetFromExperienceDescription>,
  locale: Locale,
  gender: string,
  experienceIndex: number,
  canonicalDescription: string,
  canonicalLocale?: Locale,
  isPresent?: boolean,
): boolean {
  if (!candidate.trim()) return false;
  const check = validateLocalizedExperienceBullets(candidate, factSet, {
    locale,
    gender,
    experienceIndex,
    stage: 'export',
    isPresent,
  });
  if (!check.valid) return false;
  if (isEnglishCanonicalDump(candidate, canonicalDescription, locale, { canonicalLocale })) return false;
  return true;
}

function structuredExemptionsFromCv(cv?: Pick<CVData, 'personal' | 'experience'>) {
  return {
    fullName: cv?.personal?.fullName || '',
    email: cv?.personal?.email || '',
    phone: cv?.personal?.phone || '',
    companies: (cv?.experience || []).map((e) => e.company || '').filter(Boolean),
    jobTitles: [
      cv?.personal?.jobTitle || '',
      ...(cv?.experience || []).map((e) => e.position || ''),
    ].filter(Boolean),
  };
}

export type SummaryExportCandidateValidation = {
  valid: boolean;
  reason: string;
  violations: string[];
};

export type CreativeArtisticSummaryDiagnostics = {
  initialValidation: SummaryExportCandidateValidation;
  recoverySource: 'saved_summary' | 'deterministic_authoritative_facts';
  recoveryValidation: SummaryExportCandidateValidation | null;
  factSet: Array<{
    id: string;
    type: string;
    value: string;
    sourceText?: string;
  }>;
};

export function validateSummaryExportCandidate(
  candidate: string,
  factSet: ReturnType<typeof buildCvCanonicalFactSet>,
  locale: Locale,
  gender: string,
  canonicalSummary: string,
  canonicalLocale?: Locale,
  sourceCv?: Pick<CVData, 'personal' | 'experience'>,
): SummaryExportCandidateValidation {
  if (!candidate.trim()) return { valid: false, reason: 'missing_summary', violations: [] };
  // Summary-only locale check with structured proper-noun exemptions from the
  // live CV (name/company/email/phone/titles). Never use an empty personal stub —
  // that dropped exemptions and falsely rejected old Hindi saves with Ztrew/etc.
  if (!textMatchesRequestedFieldLocale(
    candidate,
    locale,
    'summary',
    structuredExemptionsFromCv(sourceCv),
  )) {
    return { valid: false, reason: 'mixed_locale_summary', violations: ['mixed_locale_summary'] };
  }
  if (!validateSummaryCompleteness(candidate, { locale }).valid) {
    return { valid: false, reason: 'incomplete_summary', violations: ['incomplete_summary'] };
  }
  const semantic = validateLocalizedSummary(candidate, factSet, { locale, gender, stage: 'export' });
  if (!semantic.valid) {
    const violations = semantic.violations.map((v) =>
      `${v.kind}${v.matched ? `:${v.matched}` : ''}`);
    return {
      valid: false,
      reason: violations.join('|') || 'summary_semantic_validation_failed',
      violations,
    };
  }
  if (isEnglishCanonicalDump(candidate, canonicalSummary, locale, { canonicalLocale })) {
    return {
      valid: false,
      reason: 'wrong_language_summary: English canonical dump blocked',
      violations: ['wrong_language_summary'],
    };
  }
  return { valid: true, reason: 'valid', violations: [] };
}

function localizeCvAgainstCanonical(
  cv: CVData,
  locale: Locale,
  gender: string,
): {
  cv: CVData;
  validationStatus: ValidatedLocalizedCvProjection['validationStatus'];
  summaryDiagnostics: CreativeArtisticSummaryDiagnostics;
} {
  let validationStatus: ValidatedLocalizedCvProjection['validationStatus'] = 'passed';
  const canonicalLocale = cv.canonicalSnapshot?.canonicalLocale;
  let summaryOrigin = cv.summaryOrigin;

  const experience = (cv.experience ?? []).map((exp, experienceIndex) => {
    const canonicalDescription = resolveCanonicalExperienceDescription(exp);
    const factSet = buildFactSetFromExperienceDescription(canonicalDescription, {
      experienceIndex,
      company: exp.company,
      position: exp.position,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isPresent: exp.isPresent,
    });
    const facts = bulletsForExperience(factSet, experienceIndex);
    const candidate = (exp.description || '').trim();

    if (isValidLocalizedExperience(
      candidate,
      factSet,
      locale,
      gender,
      experienceIndex,
      canonicalDescription,
      canonicalLocale,
      exp.isPresent,
    )) {
      return {
        ...exp,
        canonicalDescription: exp.canonicalDescription || canonicalDescription,
        description: candidate,
      };
    }

    validationStatus = 'fallback';
    const localizedFallback = deterministicLocalizedBulletsFromCanonical(
      facts,
      locale,
      gender,
      { isPresent: Boolean(exp.isPresent) },
    );
    if (
      localizedFallback
      && isValidLocalizedExperience(
        localizedFallback,
        factSet,
        locale,
        gender,
        experienceIndex,
        canonicalDescription,
        canonicalLocale,
        exp.isPresent,
      )
    ) {
      return {
        ...exp,
        canonicalDescription: exp.canonicalDescription || canonicalDescription,
        description: localizedFallback,
      };
    }

    if (locale === 'en') {
      const englishFallback = canonicalDescription
        ? deterministicBulletsFromCanonical(facts) || canonicalDescription
        : candidate;
      return {
        ...exp,
        canonicalDescription: exp.canonicalDescription || canonicalDescription,
        description: englishFallback,
      };
    }

    throw new CreativeArtisticLocaleExportError(
      locale,
      `experience-${experienceIndex}: no valid localized bullets for fact IDs ${facts.map((f) => f.id).join(',') || '(none)'}`,
    );
  });

  const factSet = buildCvCanonicalFactSet({
    ...cv,
    experience: experience.map((exp) => ({
      ...exp,
      description: resolveCanonicalExperienceDescription(exp),
    })),
    // Recovery facts may use a confirmed canonical Summary, but never the
    // rejected AI/display Summary itself. Structured role, dates, duties and
    // skills remain authoritative when a legacy save has no user Summary.
    summary: cv.canonicalSummary
      || (cv.summaryOrigin === 'user' ? cv.summary : ''),
  });

  const canonicalSummary = (cv.canonicalSummary || '').trim();
  let summary = (cv.summary || '').trim();
  const initialSummaryValidation = validateSummaryExportCandidate(
    summary,
    factSet,
    locale,
    gender,
    canonicalSummary,
    canonicalLocale,
    cv,
  );
  let recoveryValidation: SummaryExportCandidateValidation | null = null;
  let recoverySource: CreativeArtisticSummaryDiagnostics['recoverySource'] = 'saved_summary';

  if (!initialSummaryValidation.valid) {
    validationStatus = 'fallback';
    const durationForShell = buildExperienceDurationSnapshot(cv.experience || []).total;
    const localizedSummary = deterministicLocalizedSummaryFromCanonical(
      factSet,
      locale,
      gender,
      durationForShell,
    );
    recoverySource = 'deterministic_authoritative_facts';
    recoveryValidation = validateSummaryExportCandidate(
      localizedSummary,
      factSet,
      locale,
      gender,
      canonicalSummary,
      canonicalLocale,
      cv,
    );
    if (localizedSummary && recoveryValidation.valid) {
      summary = localizedSummary;
      summaryOrigin = 'deterministic_fallback';
    } else if (locale === 'en') {
      if (canonicalSummary && validateSummaryCompleteness(canonicalSummary, { locale: 'en' }).valid) {
        summary = canonicalSummary;
      } else {
        summary = deterministicSummaryFromCanonical(factSet, canonicalSummary);
      }
      summaryOrigin = 'deterministic_fallback';
    } else {
      const rejectedDetail = initialSummaryValidation.reason;
      const titleConflict = /forced-conflicting-title|title_localization|invalid_occupational_title/i.test(
        `${rejectedDetail}|${recoveryValidation?.reason || ''}`,
      );
      const reason = titleConflict
        ? `summary_title_localization_conflict: initial=${rejectedDetail}; recovery=${recoveryValidation?.reason || 'empty'}`
        : `summary_recovery_failure: initial=${rejectedDetail}; recovery=${recoveryValidation?.reason || 'empty'}`;
      throw new CreativeArtisticLocaleExportError(locale, reason);
    }
  }

  if (locale !== 'en') {
    for (const [idx, exp] of experience.entries()) {
      const canonicalDescription = resolveCanonicalExperienceDescription(exp);
      if (isEnglishCanonicalDump(exp.description, canonicalDescription, locale, { canonicalLocale })) {
        throw new CreativeArtisticLocaleExportError(
          locale,
          `experience-${idx}: English canonical dump blocked`,
        );
      }
    }
    if (
      canonicalSummary
      && isEnglishCanonicalDump(summary, canonicalSummary, locale, { canonicalLocale })
    ) {
      throw new CreativeArtisticLocaleExportError(locale, 'summary: English canonical dump blocked');
    }
  }

  return {
    cv: {
      ...cv,
      summary,
      experience,
      ...(summaryOrigin ? { summaryOrigin } : {}),
    },
    validationStatus,
    summaryDiagnostics: {
      initialValidation: initialSummaryValidation,
      recoverySource,
      recoveryValidation,
      factSet: factSet.facts.map((fact) => ({
        id: fact.id,
        type: fact.type,
        value: fact.value,
        sourceText: fact.sourceText,
      })),
    },
  };
}

/**
 * Hard locale invariant for Creative Artistic exports.
 * requestedLocale !== 'en' => exported summary and bullets must match requestedLocale
 * (validated + not an English canonical dump). On failure: throw (block export).
 *
 * Also enforces locale-aware canonical snapshot + stale projection rejection.
 * Does not increment canonicalRevision.
 */
export function applyCreativeArtisticExportIntegrity(
  cv: CVData,
  locale: Locale,
  options?: { gender?: string; referenceDate?: Date | string },
): CVData {
  return prepareCreativeArtisticExport(cv, locale, options).cv;
}

function attachQualityToProjection(
  sourceCv: CVData,
  localizedCv: CVData,
  locale: Locale,
  gender: string,
  validationStatus: ValidatedLocalizedCvProjection['validationStatus'],
  referenceDate?: Date | string,
  priorSnapshot?: ValidatedLocalizedCvProjection['experienceDurationSnapshot'],
): { cv: CVData; projection: ValidatedLocalizedCvProjection } {
  const quality = applyCvContentQuality(localizedCv, locale, {
    gender,
    referenceDate,
    durationSnapshot: priorSnapshot,
    summaryOrigin: localizedCv.summaryOrigin,
  });
  const finalLocaleCheck = validateFinalLocalizedCvFields(quality.cv, locale);
  if (!finalLocaleCheck.valid) {
    const first = finalLocaleCheck.violations[0];
    throw new CreativeArtisticLocaleExportError(
      locale,
      `${first.kind}: ${first.path} does not match requested locale ${locale}`,
    );
  }
  const status: ValidatedLocalizedCvProjection['validationStatus'] = quality.repaired
    ? (validationStatus === 'fallback' ? 'fallback' : 'repaired')
    : validationStatus;

  const base = buildProjectionFromLocalizedCv(sourceCv, quality.cv, locale, status);
  const withoutId = {
    requestedLocale: base.requestedLocale,
    canonicalLocale: base.canonicalLocale,
    canonicalRevision: base.canonicalRevision,
    canonicalSourceHash: base.canonicalSourceHash,
    localizedSummary: quality.cv.summary || '',
    localizedSummaryProvenance: base.localizedSummaryProvenance,
    localizedExperiences: base.localizedExperiences.map((exp) => {
      const qExp = quality.cv.experience.find((e) => e.id === exp.experienceId);
      if (!qExp) return exp;
      const bullets = (qExp.description || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^[•\-\*\u2022]\s*/, '').trim())
        .filter(Boolean);
      return {
        ...exp,
        bullets: exp.bullets.map((b, i) => ({
          ...b,
          localizedText: bullets[i] || b.localizedText,
        })),
      };
    }),
    localizedEducation: quality.cv.education || [],
    localizedSkills: quality.cv.skills || [],
    localizedLanguageLevels: (quality.cv.languages || []).map((lang) => ({
      name: getLocalizedCvLanguageName(lang.name, locale) || lang.name,
      level: localizeCvLanguageLevel(lang.level, locale),
    })),
    validationStatus: status,
    experienceDurationSnapshot: quality.durationSnapshot,
    gender,
  };
  const projection: ValidatedLocalizedCvProjection = {
    ...withoutId,
    projectionId: buildProjectionId(withoutId),
  };
  const withProjection = storeLocalizedProjection(quality.cv, projection);
  return {
    cv: applyProjectionToCv(withProjection, projection),
    projection,
  };
}

/**
 * Single prep used by PDF and DOCX so both consume the identical projection.
 * Both exporters must receive the same precomputed experienceDurationSnapshot.
 */
export function prepareCreativeArtisticExport(
  cv: CVData,
  locale: Locale,
  options?: { gender?: string; referenceDate?: Date | string; durationSnapshot?: import('./cv-experience-duration').ExperienceDurationSnapshot },
): {
  cv: CVData;
  projection: ValidatedLocalizedCvProjection;
  summaryDiagnostics?: CreativeArtisticSummaryDiagnostics;
} {
  cv = normalizeLegacyCvRuntime(cv, locale);
  const gender = options?.gender || cv.personal?.gender || '';
  const snapshot = cv.canonicalSnapshot;
  const durationSnapshot = options?.durationSnapshot
    || buildExperienceDurationSnapshot(cv.experience || [], options?.referenceDate ?? new Date());

  if (snapshot?.canonicalState === 'needs_rebuild') {
    throw new CreativeArtisticLocaleExportError(
      locale,
      'canonicalState=needs_rebuild: export blocked until explicit Generate/Improve rebuilds a valid canonical source',
    );
  }

  const freshProjection = cv.localizedProjections?.[locale];
  if (freshProjection && snapshot && isProjectionFresh(freshProjection, snapshot)) {
    const freshApplied = applyProjectionToCv(cv, freshProjection);
    const freshFieldCheck = validateFinalLocalizedCvFields(freshApplied, locale);
    if (freshFieldCheck.valid) {
      if (locale !== 'en' && (
        isEnglishCanonicalDump(freshProjection.localizedSummary, snapshot.canonicalSummary, locale)
        || freshProjection.localizedExperiences.some((exp) => {
          const canon = snapshot.canonicalExperiences.find((e) => e.experienceId === exp.experienceId);
          const joined = exp.bullets.map((b) => b.localizedText).join('\n');
          const canonJoined = (canon?.bullets || []).map((b) => b.sourceText).join('\n');
          return isEnglishCanonicalDump(joined, canonJoined, locale);
        })
      )) {
        throw new CreativeArtisticLocaleExportError(locale, 'stale/fresh projection failed English-dump invariant');
      }
      // Re-run content quality with the shared duration snapshot (never recalculate from localized text).
      return attachQualityToProjection(
        cv,
        freshApplied,
        locale,
        gender,
        freshProjection.validationStatus,
        options?.referenceDate || durationSnapshot.referenceDateIso,
        options?.durationSnapshot || freshProjection.experienceDurationSnapshot || durationSnapshot,
      );
    }
    // Fresh metadata with invalid field text is not reusable. Regenerate below
    // from the current canonical snapshot; never trust locale metadata alone.
  }

  if (freshProjection && snapshot && !isProjectionFresh(freshProjection, snapshot)) {
    // Stale projection: regenerate from current canonical — never export old translation.
  }

  const {
    cv: localizedCv,
    validationStatus,
    summaryDiagnostics,
  } = localizeCvAgainstCanonical(cv, locale, gender);
  return {
    ...attachQualityToProjection(
      cv,
      localizedCv,
      locale,
      gender,
      validationStatus,
      options?.referenceDate || durationSnapshot.referenceDateIso,
      durationSnapshot,
    ),
    summaryDiagnostics,
  };
}

/** Safe wrapper used by preview helpers that prefer empty section over a crash. */
export function tryCreativeArtisticExportIntegrity(
  cv: CVData,
  locale: Locale,
  options?: { gender?: string },
): { ok: true; cv: CVData } | { ok: false; error: CreativeArtisticLocaleExportError } {
  try {
    return { ok: true, cv: applyCreativeArtisticExportIntegrity(cv, locale, options) };
  } catch (err) {
    if (err instanceof CreativeArtisticLocaleExportError) {
      return { ok: false, error: err };
    }
    throw err;
  }
}
