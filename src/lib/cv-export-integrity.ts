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
import { validateFinalLocalizedCvFields } from './cv-field-locale-integrity';
import {
  resolveExperienceGroundingDescription,
  type CvExperienceDescriptionOrigin,
} from './cv-experience-provenance';

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
  return (exp.canonicalDescription || exp.description || '').trim();
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

function isValidLocalizedSummary(
  candidate: string,
  factSet: ReturnType<typeof buildCvCanonicalFactSet>,
  locale: Locale,
  gender: string,
  canonicalSummary: string,
  canonicalLocale?: Locale,
): boolean {
  if (!candidate.trim()) return false;
  const localeCheck = validateFinalLocalizedCvFields({
    summary: candidate,
    personal: { fullName: '', email: '', phone: '', address: '', jobTitle: '' },
    experience: [],
    education: [],
    skills: [],
    languages: [],
  }, locale);
  if (!localeCheck.valid) return false;
  if (!validateSummaryCompleteness(candidate, { locale }).valid) return false;
  if (!validateLocalizedSummary(candidate, factSet, { locale, gender, stage: 'export' }).valid) {
    return false;
  }
  if (isEnglishCanonicalDump(candidate, canonicalSummary, locale, { canonicalLocale })) return false;
  return true;
}

function localizeCvAgainstCanonical(
  cv: CVData,
  locale: Locale,
  gender: string,
): {
  cv: CVData;
  validationStatus: ValidatedLocalizedCvProjection['validationStatus'];
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
    summary: cv.canonicalSummary || cv.summary,
  });

  const canonicalSummary = (cv.canonicalSummary || '').trim();
  let summary = (cv.summary || '').trim();

  if (!isValidLocalizedSummary(summary, factSet, locale, gender, canonicalSummary || summary, canonicalLocale)) {
    validationStatus = 'fallback';
    const durationForShell = buildExperienceDurationSnapshot(cv.experience || []).total;
    const localizedSummary = deterministicLocalizedSummaryFromCanonical(
      factSet,
      locale,
      gender,
      durationForShell,
    );
    if (localizedSummary && isValidLocalizedSummary(
      localizedSummary,
      factSet,
      locale,
      gender,
      canonicalSummary,
      canonicalLocale,
    )) {
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
      throw new CreativeArtisticLocaleExportError(
        locale,
        'summary: no valid localized summary (refusing English dump)',
      );
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
    if (isEnglishCanonicalDump(summary, canonicalSummary || summary, locale, { canonicalLocale })) {
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
): { cv: CVData; projection: ValidatedLocalizedCvProjection } {
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

  const { cv: localizedCv, validationStatus } = localizeCvAgainstCanonical(cv, locale, gender);
  return attachQualityToProjection(
    cv,
    localizedCv,
    locale,
    gender,
    validationStatus,
    options?.referenceDate || durationSnapshot.referenceDateIso,
    durationSnapshot,
  );
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
