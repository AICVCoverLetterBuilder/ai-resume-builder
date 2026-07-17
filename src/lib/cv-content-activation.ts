/**
 * Fail-closed activation for CV AI text: validate → one repair → deterministic fallback.
 */
import type { Locale } from './i18n/translations';
import type { CoverLetterGender } from './cover-letter-gender';
import {
  bulletsForExperience,
  deterministicBulletsFromCanonical,
  type CvCanonicalFactSet,
} from './cv-canonical-facts';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
  isEnglishCanonicalDump,
} from './cv-localized-fallback';
import {
  formatCvFidelityViolationsForPrompt,
  validateLocalizedExperienceBullets,
  validateLocalizedSummary,
  validateSummaryCompleteness,
  type CvFidelityViolation,
} from './cv-semantic-fidelity';
import { textMatchesRequestedFieldLocale } from './cv-field-locale-integrity';
import { isWrongLanguageAiOutput } from './cv-ai-locale-guard';
import { hasRepairBudget } from './ai-request-timing';
import { normalizeHindiGeneratedWhitespace } from './cv-hindi-normalize';
import { resolveOccupationalTitleForSummary } from './cv-role-title';
import type { ExperienceDuration } from './cv-experience-duration';

export type CvContentActivation = {
  content: string;
  status: 'passed' | 'repaired' | 'fallback' | 'blocked';
  repairAttempted: boolean;
  fallbackUsed: boolean;
  violations: CvFidelityViolation[];
  /** True when non-English locale could not produce valid localized content (never English dump). */
  blocked?: boolean;
};

export function buildBulletRepairPrompt(
  locale: Locale | string,
  violations: CvFidelityViolation[],
  previous: string,
  canonicalBullets: string,
): string {
  return [
    'CV BULLET FIDELITY REPAIR REQUIRED.',
    `Rewrite the experience bullets in ${locale}.`,
    'Keep the SAME bullet count and the SAME duties as SOURCE BULLETS.',
    'Do NOT invent allergy checks, muddling, syrups, wastage, inventory shortages, kitchen staff, evening shifts, or other unsupported duties.',
    'Output ONLY bullet lines starting with "•".',
    'Unsupported issues:',
    formatCvFidelityViolationsForPrompt(violations),
    'SOURCE BULLETS:',
    canonicalBullets,
    'Previous invalid output (do not copy invented duties):',
    previous.slice(0, 2500),
  ].join('\n');
}

export function buildSummaryRepairPrompt(
  locale: Locale | string,
  violations: CvFidelityViolation[],
  previous: string,
  sourceFacts: string,
): string {
  return [
    'CV SUMMARY FIDELITY REPAIR REQUIRED.',
    `Rewrite a COMPLETE professional summary in ${locale}.`,
    'Finish every sentence. Do not truncate mid-word.',
    'Use only SOURCE FACTS. Do not invent new duties, techniques, shifts, or achievements.',
    'Keep one consistent perspective (first person OR third person, not mixed).',
    'Unsupported issues:',
    formatCvFidelityViolationsForPrompt(violations),
    'SOURCE FACTS:',
    sourceFacts.slice(0, 3000),
    'Previous invalid summary:',
    previous.slice(0, 2000),
  ].join('\n');
}

function experiencePasses(
  content: string,
  options: {
    locale: Locale;
    gender?: CoverLetterGender | string;
    experienceIndex: number;
    factSet: CvCanonicalFactSet;
    stage: string;
    canonicalJoined: string;
  },
): boolean {
  if (!content.trim()) return false;
  // The provider (or an earlier repair) may echo the source CV's language instead of
  // the requested one — most commonly Serbian, since existing CV content in
  // production is frequently Serbian regardless of the newly requested target locale.
  // Catch that here, at the server activation stage, so a real repair attempt still
  // gets a chance before we ever fall back to the deterministic template.
  if (isWrongLanguageAiOutput(content, options.locale)) return false;
  const check = validateLocalizedExperienceBullets(content, options.factSet, {
    locale: options.locale,
    gender: options.gender,
    experienceIndex: options.experienceIndex,
    stage: options.stage,
  });
  if (!check.valid) return false;
  if (isEnglishCanonicalDump(content, options.canonicalJoined, options.locale)) return false;
  return true;
}

export async function activateCvExperienceBullets(options: {
  locale: Locale;
  gender?: CoverLetterGender | string;
  experienceIndex: number;
  factSet: CvCanonicalFactSet;
  candidate: string;
  repair?: (prompt: string) => Promise<string>;
  /** Absolute deadline (ms epoch) the whole request must respond by. When
   * insufficient budget remains for one more provider round-trip, repair is
   * skipped and the local deterministic fallback is used immediately instead
   * — see `ai-request-timing.ts`. */
  deadlineAt?: number | null;
}): Promise<CvContentActivation> {
  const canonical = bulletsForExperience(options.factSet, options.experienceIndex);
  const canonicalJoined = canonical.map((b) => b.value).join('\n');
  const englishFallback = deterministicBulletsFromCanonical(canonical);
  const candidate = normalizeHindiGeneratedWhitespace(options.candidate || '', options.locale);
  const first = validateLocalizedExperienceBullets(candidate, options.factSet, {
    locale: options.locale,
    gender: options.gender,
    experienceIndex: options.experienceIndex,
    stage: 'initial',
  });
  if (
    experiencePasses(candidate, {
      ...options,
      stage: 'initial',
      canonicalJoined,
    })
  ) {
    return {
      content: candidate.trim(),
      status: 'passed',
      repairAttempted: false,
      fallbackUsed: false,
      violations: [],
    };
  }

  let repairAttempted = false;
  if (options.repair && canonical.length > 0 && hasRepairBudget(options.deadlineAt)) {
    repairAttempted = true;
    try {
      const repairedRaw = await options.repair(
        buildBulletRepairPrompt(
          options.locale,
          first.violations,
          candidate,
          canonical.map((b) => `- [${b.id}] ${b.value}`).join('\n'),
        ),
      );
      const repaired = normalizeHindiGeneratedWhitespace(repairedRaw || '', options.locale);
      if (
        experiencePasses(repaired, {
          ...options,
          stage: 'repair',
          canonicalJoined,
        })
      ) {
        return {
          content: repaired.trim(),
          status: 'repaired',
          repairAttempted: true,
          fallbackUsed: false,
          violations: first.violations,
        };
      }
    } catch {
      // fall through
    }
  }

  const localizedFallback = normalizeHindiGeneratedWhitespace(
    deterministicLocalizedBulletsFromCanonical(
      canonical,
      options.locale,
      options.gender,
    ) || '',
    options.locale,
  );
  if (
    localizedFallback
    && experiencePasses(localizedFallback, {
      ...options,
      stage: 'fallback',
      canonicalJoined,
    })
  ) {
    return {
      content: localizedFallback,
      status: 'fallback',
      repairAttempted,
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  if (options.locale === 'en' && englishFallback) {
    return {
      content: englishFallback,
      status: 'fallback',
      repairAttempted,
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  // Never return English for a non-English locale.
  return {
    content: '',
    status: 'blocked',
    repairAttempted,
    fallbackUsed: true,
    blocked: true,
    violations: first.violations,
  };
}

/** Deterministic complete summary from canonical facts only (never invents duties). */
export function deterministicSummaryFromCanonical(
  factSet: CvCanonicalFactSet,
  fallbackHint = '',
  options?: { locale?: Locale; gender?: CoverLetterGender | string },
): string {
  const locale = options?.locale || 'en';
  const gender = options?.gender || '';
  const profileTitle = factSet.facts.find((f) => f.type === 'job_title')?.value || '';
  const experienceTitle = factSet.facts.find((f) => f.type === 'role')?.value || '';
  const dutiesText = factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .map((f) => f.sourceText || f.value)
    .join('\n');
  const role = resolveOccupationalTitleForSummary({
    profileJobTitle: profileTitle,
    currentExperienceTitle: experienceTitle,
    locale,
    gender,
    dutiesText,
  });
  const bullets = factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .slice(0, 3)
    .map((f) => f.value.replace(/[.。۔।]\s*$/u, ''));
  const skills = factSet.facts
    .filter((f) => f.type === 'skill')
    .slice(0, 4)
    .map((f) => f.value);
  const safeHint = fallbackHint.trim();
  const hintUsable = safeHint
    && validateSummaryCompleteness(safeHint).valid
    && !UNSUPPORTED_HINT_MARKERS.test(safeHint);
  const parts = [
    role ? `${role}.` : '',
    bullets.length ? `${bullets.join('; ')}.` : '',
    skills.length ? `${skills.join(', ')}.` : '',
    hintUsable ? safeHint : '',
  ].filter(Boolean);
  let text = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    const rolePart = role ? `${role}.` : '';
    text = rolePart || 'Experienced professional ready to contribute responsibly.';
  }
  if (!/[.!?…।۔]\s*$/u.test(text)) text = `${text}.`;
  return text;
}

const UNSUPPORTED_HINT_MARKERS = /करते\s*हु\s*$|allerg|muddling|wastage/iu;

export async function activateCvSummary(options: {
  locale: Locale;
  gender?: CoverLetterGender | string;
  factSet: CvCanonicalFactSet;
  candidate: string;
  sourceFactsText: string;
  repair?: (prompt: string) => Promise<string>;
  fallbackSummary: string;
  /** Optional experience duration for grounded neutral openings. */
  duration?: ExperienceDuration;
  /** Absolute deadline (ms epoch) the whole request must respond by. When
   * insufficient budget remains for one more provider round-trip, repair is
   * skipped and the local deterministic fallback is used immediately instead
   * — see `ai-request-timing.ts`. */
  deadlineAt?: number | null;
}): Promise<CvContentActivation> {
  const candidate = normalizeHindiGeneratedWhitespace(options.candidate || '', options.locale);
  const first = validateLocalizedSummary(candidate, options.factSet, {
    locale: options.locale,
    gender: options.gender,
    stage: 'initial',
  });
  if (
    first.valid
    && candidate.trim()
    && textMatchesRequestedFieldLocale(candidate, options.locale, 'summary')
    && !isWrongLanguageAiOutput(candidate, options.locale)
  ) {
    return {
      content: candidate.trim(),
      status: 'passed',
      repairAttempted: false,
      fallbackUsed: false,
      violations: [],
    };
  }

  let repairAttempted = false;
  if (options.repair && hasRepairBudget(options.deadlineAt)) {
    repairAttempted = true;
    try {
      const repairedRaw = await options.repair(
        buildSummaryRepairPrompt(
          options.locale,
          first.violations,
          candidate,
          options.sourceFactsText,
        ),
      );
      const repaired = normalizeHindiGeneratedWhitespace(repairedRaw || '', options.locale);
      const recheck = validateLocalizedSummary(repaired, options.factSet, {
        locale: options.locale,
        gender: options.gender,
        stage: 'repair',
      });
      if (
        recheck.valid
        && repaired.trim()
        && textMatchesRequestedFieldLocale(repaired, options.locale, 'summary')
        && !isWrongLanguageAiOutput(repaired, options.locale)
      ) {
        return {
          content: repaired.trim(),
          status: 'repaired',
          repairAttempted: true,
          fallbackUsed: false,
          violations: first.violations,
        };
      }
    } catch {
      // fall through
    }
  }

  const sourceCanonical = options.factSet.facts.find((f) => f.type === 'summary')?.value || '';
  const hinted = normalizeHindiGeneratedWhitespace(options.fallbackSummary.trim(), options.locale);
  const hintedOk = hinted
    && textMatchesRequestedFieldLocale(hinted, options.locale, 'summary')
    // The caller-supplied hint is frequently built from frozen canonical source text
    // (e.g. an unlocalized Serbian job title/description), so it can carry the wrong
    // language even when the requested locale is something else entirely.
    && !isWrongLanguageAiOutput(hinted, options.locale)
    && validateSummaryCompleteness(hinted, { locale: options.locale }).valid
    && validateLocalizedSummary(hinted, options.factSet, {
      locale: options.locale,
      gender: options.gender,
      stage: 'fallback',
    }).valid
    && !isEnglishCanonicalDump(hinted, sourceCanonical || hinted, options.locale);

  if (hintedOk) {
    return {
      content: hinted,
      status: 'fallback',
      repairAttempted,
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  const localized = normalizeHindiGeneratedWhitespace(
    deterministicLocalizedSummaryFromCanonical(
      options.factSet,
      options.locale,
      options.gender,
      options.duration,
    ) || '',
    options.locale,
  );
  if (
    localized
    && textMatchesRequestedFieldLocale(localized, options.locale, 'summary')
    && !isWrongLanguageAiOutput(localized, options.locale)
    && validateSummaryCompleteness(localized, { locale: options.locale }).valid
    && validateLocalizedSummary(localized, options.factSet, {
      locale: options.locale,
      gender: options.gender,
      stage: 'fallback',
    }).valid
    && !isEnglishCanonicalDump(localized, sourceCanonical || localized, options.locale)
  ) {
    return {
      content: localized,
      status: 'fallback',
      repairAttempted,
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  if (options.locale === 'en') {
    return {
      content: deterministicSummaryFromCanonical(options.factSet, hinted, {
        locale: options.locale,
        gender: options.gender,
      }),
      status: 'fallback',
      repairAttempted,
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  return {
    content: '',
    status: 'blocked',
    repairAttempted,
    fallbackUsed: true,
    blocked: true,
    violations: first.violations,
  };
}
