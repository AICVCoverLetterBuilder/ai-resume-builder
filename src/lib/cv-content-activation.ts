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
}): Promise<CvContentActivation> {
  const canonical = bulletsForExperience(options.factSet, options.experienceIndex);
  const canonicalJoined = canonical.map((b) => b.value).join('\n');
  const englishFallback = deterministicBulletsFromCanonical(canonical);
  const first = validateLocalizedExperienceBullets(options.candidate, options.factSet, {
    locale: options.locale,
    gender: options.gender,
    experienceIndex: options.experienceIndex,
    stage: 'initial',
  });
  if (
    experiencePasses(options.candidate, {
      ...options,
      stage: 'initial',
      canonicalJoined,
    })
  ) {
    return {
      content: options.candidate.trim(),
      status: 'passed',
      repairAttempted: false,
      fallbackUsed: false,
      violations: [],
    };
  }

  if (options.repair && canonical.length > 0) {
    try {
      const repaired = await options.repair(
        buildBulletRepairPrompt(
          options.locale,
          first.violations,
          options.candidate,
          canonical.map((b) => `- [${b.id}] ${b.value}`).join('\n'),
        ),
      );
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

  const localizedFallback = deterministicLocalizedBulletsFromCanonical(
    canonical,
    options.locale,
    options.gender,
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
      repairAttempted: Boolean(options.repair),
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  if (options.locale === 'en' && englishFallback) {
    return {
      content: englishFallback,
      status: 'fallback',
      repairAttempted: Boolean(options.repair),
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  // Never return English for a non-English locale.
  return {
    content: '',
    status: 'blocked',
    repairAttempted: Boolean(options.repair),
    fallbackUsed: true,
    blocked: true,
    violations: first.violations,
  };
}

/** Deterministic complete summary from canonical facts only (never invents duties). */
export function deterministicSummaryFromCanonical(
  factSet: CvCanonicalFactSet,
  fallbackHint = '',
): string {
  const role = factSet.facts.find((f) => f.type === 'job_title')?.value
    || factSet.facts.find((f) => f.type === 'role')?.value
    || '';
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
}): Promise<CvContentActivation> {
  const first = validateLocalizedSummary(options.candidate, options.factSet, {
    locale: options.locale,
    gender: options.gender,
    stage: 'initial',
  });
  if (first.valid && options.candidate.trim()) {
    return {
      content: options.candidate.trim(),
      status: 'passed',
      repairAttempted: false,
      fallbackUsed: false,
      violations: [],
    };
  }

  if (options.repair) {
    try {
      const repaired = await options.repair(
        buildSummaryRepairPrompt(
          options.locale,
          first.violations,
          options.candidate,
          options.sourceFactsText,
        ),
      );
      const recheck = validateLocalizedSummary(repaired, options.factSet, {
        locale: options.locale,
        gender: options.gender,
        stage: 'repair',
      });
      if (recheck.valid && repaired.trim()) {
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
  const hinted = options.fallbackSummary.trim();
  const hintedOk = hinted
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
      repairAttempted: Boolean(options.repair),
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  const localized = deterministicLocalizedSummaryFromCanonical(
    options.factSet,
    options.locale,
    options.gender,
  );
  if (
    localized
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
      repairAttempted: Boolean(options.repair),
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  if (options.locale === 'en') {
    return {
      content: deterministicSummaryFromCanonical(options.factSet, hinted),
      status: 'fallback',
      repairAttempted: Boolean(options.repair),
      fallbackUsed: true,
      violations: first.violations,
    };
  }

  return {
    content: '',
    status: 'blocked',
    repairAttempted: Boolean(options.repair),
    fallbackUsed: true,
    blocked: true,
    violations: first.violations,
  };
}
