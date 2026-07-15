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

export function resolveCanonicalExperienceDescription(exp: {
  description?: string;
  canonicalDescription?: string;
}): string {
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
): boolean {
  if (!candidate.trim()) return false;
  const check = validateLocalizedExperienceBullets(candidate, factSet, {
    locale,
    gender,
    experienceIndex,
    stage: 'export',
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
): { cv: CVData; validationStatus: ValidatedLocalizedCvProjection['validationStatus'] } {
  let validationStatus: ValidatedLocalizedCvProjection['validationStatus'] = 'passed';
  const canonicalLocale = cv.canonicalSnapshot?.canonicalLocale;

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
    )) {
      return {
        ...exp,
        canonicalDescription: exp.canonicalDescription || canonicalDescription,
        description: candidate,
      };
    }

    validationStatus = 'fallback';
    const localizedFallback = deterministicLocalizedBulletsFromCanonical(facts, locale, gender);
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
    const localizedSummary = deterministicLocalizedSummaryFromCanonical(factSet, locale, gender);
    if (localizedSummary && isValidLocalizedSummary(
      localizedSummary,
      factSet,
      locale,
      gender,
      canonicalSummary,
      canonicalLocale,
    )) {
      summary = localizedSummary;
    } else if (locale === 'en') {
      if (canonicalSummary && validateSummaryCompleteness(canonicalSummary, { locale: 'en' }).valid) {
        summary = canonicalSummary;
      } else {
        summary = deterministicSummaryFromCanonical(factSet, canonicalSummary);
      }
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
  options?: { gender?: string },
): CVData {
  return prepareCreativeArtisticExport(cv, locale, options).cv;
}

/**
 * Single prep used by PDF and DOCX so both consume the identical projection.
 */
export function prepareCreativeArtisticExport(
  cv: CVData,
  locale: Locale,
  options?: { gender?: string },
): { cv: CVData; projection: ValidatedLocalizedCvProjection } {
  const gender = options?.gender || cv.personal?.gender || '';
  const snapshot = cv.canonicalSnapshot;

  if (snapshot?.canonicalState === 'needs_rebuild') {
    throw new CreativeArtisticLocaleExportError(
      locale,
      'canonicalState=needs_rebuild: export blocked until explicit Generate/Improve rebuilds a valid canonical source',
    );
  }

  const freshProjection = cv.localizedProjections?.[locale];
  if (freshProjection && snapshot && isProjectionFresh(freshProjection, snapshot)) {
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
    const applied = applyProjectionToCv(cv, freshProjection);
    return { cv: applied, projection: freshProjection };
  }

  if (freshProjection && snapshot && !isProjectionFresh(freshProjection, snapshot)) {
    // Stale projection: regenerate from current canonical — never export old translation.
  }

  const { cv: localizedCv, validationStatus } = localizeCvAgainstCanonical(cv, locale, gender);
  const projection = buildProjectionFromLocalizedCv(cv, localizedCv, locale, validationStatus);
  const withProjection = storeLocalizedProjection(localizedCv, projection);

  return {
    cv: applyProjectionToCv(withProjection, projection),
    projection,
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
