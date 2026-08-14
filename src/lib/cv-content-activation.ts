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
import { stripAiProtocolMarkers } from './cv-ai-protocol-strip';
import { resolveOccupationalTitleForSummary } from './cv-role-title';
import type { ExperienceDuration } from './cv-experience-duration';
import {
  dutyToEnglishGerundFragment,
  sanitizeSummaryListMarkers,
  stripDutyListPrefix,
  summaryContainsListMarkerLeakage,
} from './cv-source-fact-identity';
import { summaryHasMalformedSkillsFragment } from './cv-summary-grounding';
import { normalizeHindiExperiencePerspective } from './cv-experience-perspective';
import { buildCrossLocaleExperienceFallback } from './cv-cross-locale-experience';
import {
  detectTextLocale,
  isCrossLocaleOperation,
} from './cv-content-locale';
import { validateCrossLocaleSemanticCoverage } from './cv-cross-locale-experience';
import {
  validateDistinctExperienceBullets,
  validateNoExtraGeneratedDuties,
} from './cv-material-duty-coverage';
import { validateExperienceCvPerspective } from './cv-experience-perspective';
import {
  scanGenericExperiencePredicates,
  sourceRequiresGenericExperiencePredicates,
} from './cv-generic-experience-predicate-grounding';
import { sourceHasWarehouseDomainApplicability } from './cv-warehouse-domain-applicability';

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
  options?: { isPresent?: boolean; gender?: string },
): string {
  const missingDuties = violations
    .filter((v) => v.kind === 'missing_canonical_duty' || v.kind === 'material_duty_removed')
    .map((v) => v.matched)
    .filter(Boolean);
  const extraDuties = violations
    .filter((v) => v.kind === 'unsupported_generated_duty')
    .map((v) => v.matched)
    .filter(Boolean);
  const metaHits = violations
    .filter((v) => v.kind === 'meta_fallback_text')
    .map((v) => v.matched)
    .filter(Boolean);
  const tenseRequired = options?.isPresent === true
    ? 'present (ongoing current role — not completed past)'
    : options?.isPresent === false
      ? 'past (completed role)'
      : 'match employment status';
  return [
    'CV BULLET FIDELITY REPAIR REQUIRED.',
    `Rewrite the experience bullets in ${locale}.`,
    'Preserve EVERY material canonical duty. Sentence combining is allowed only when no duty is dropped.',
    'Do NOT invent allergy checks, muddling, syrups, wastage, inventory shortages, kitchen staff, evening shifts, cuisine types, ingredient/material storage (unless in SOURCE), or other unsupported duties.',
    'Do NOT include meta/grounding phrases such as "stated in the role duties" or locale equivalents.',
    `Required employment tense: ${tenseRequired}.`,
    options?.gender ? `Gender grammar: ${options.gender}.` : '',
    missingDuties.length
      ? `Missing duty categories that MUST be restored: ${missingDuties.join('; ')}.`
      : '',
    extraDuties.length
      ? `Unsupported generated duties that MUST be removed: ${extraDuties.join('; ')}.`
      : '',
    metaHits.length
      ? `Forbidden meta text detected: ${metaHits.join('; ')}.`
      : '',
    'Output ONLY bullet lines starting with "•".',
    'Never prefix with labels like "CORRECTED BULLETS:", "OUTPUT:", or markdown headings.',
    'Unsupported issues:',
    formatCvFidelityViolationsForPrompt(violations),
    'SOURCE BULLETS:',
    canonicalBullets,
    'Previous invalid output (do not copy invented duties or meta wording):',
    previous.slice(0, 2500),
  ].filter(Boolean).join('\n');
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
    'Maximum 2 short sentences / 90 words. Concise only.',
    'Finish every sentence. Do not truncate mid-word.',
    'Use only SOURCE FACTS below. Do not invent duties, quality, health standards, storage, pressure, efficiency, initiative, demonstrated leadership, career ambitions, or personality traits.',
    'Skills are labels only (e.g. "Key skills include organization and time management"). Never treat skills as achievements.',
    'Localize skill labels into the requested language. Never append raw English skill lists (Critical Thinking, Adaptability, Problem Solving, …) in non-English summaries.',
    'If gender/occupation is wrong (e.g. Pekara for female Baker), use the correct gendered occupation (Pekarka).',
    'Keep one consistent perspective (first person OR third person, not mixed).',
    'Output ONLY the summary prose. Never prefix with labels like "CORRECTED PROFESSIONAL SUMMARY:", "REPAIRED SUMMARY:", "OUTPUT:", or markdown headings.',
    'Do not reuse rejected unsupported claims from the previous invalid summary.',
    'Exact defects:',
    formatCvFidelityViolationsForPrompt(violations),
    'SOURCE FACTS (immutable):',
    sourceFacts.slice(0, 3000),
    'Previous invalid summary (do not copy unsupported claims):',
    previous.slice(0, 1200),
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
    isPresent?: boolean;
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
    isPresent: options.isPresent,
  });
  const sourceLocale = detectTextLocale(options.canonicalJoined);
  const crossLocale = isCrossLocaleOperation(sourceLocale, options.locale);
  if (!check.valid) {
    // A translated provider candidate can be semantically complete even when
    // the legacy material-key validator cannot map localized nouns back to the
    // source language.  Permit only this narrow, independently proven bridge:
    // exact 1:1 semantic coverage, no added duties, no duplicate/merged units,
    // target-language output, and valid CV perspective.  Same-locale output
    // keeps the original strict validator unchanged.
    const onlyLexicalCoverageFailures = check.violations.length > 0
      && check.violations.every((violation) => (
        violation.kind === 'missing_canonical_duty'
        || violation.kind === 'material_duty_removed'
        || violation.kind === 'bullet_count_mismatch'
      ));
    if (!crossLocale || !onlyLexicalCoverageFailures) return false;
    const semantic = validateCrossLocaleSemanticCoverage(options.canonicalJoined, content);
    const extras = validateNoExtraGeneratedDuties(options.canonicalJoined, content);
    const distinct = validateDistinctExperienceBullets(content);
    const perspective = validateExperienceCvPerspective(content, options.locale, {
      isPresent: options.isPresent,
    });
    if (
      !semantic.ok
      || !extras.valid
      || !distinct.ok
      || !perspective.ok
      || !textMatchesRequestedFieldLocale(content, options.locale, 'experience_bullet')
    ) return false;
  }
  if (isEnglishCanonicalDump(content, options.canonicalJoined, options.locale)) return false;
  if (sourceRequiresGenericExperiencePredicates(options.canonicalJoined)) {
    const predicates = scanGenericExperiencePredicates(options.canonicalJoined, content, {
      allowValidatedCrossLocaleBridge: crossLocale && check.valid === false,
    });
    if (predicates.candidateAddedPredicateCount > 0) return false;
    if (!sourceHasWarehouseDomainApplicability(options.canonicalJoined)
      && !predicates.sourceUnitPredicateCoveragePassed) return false;
  }
  return true;
}

export async function activateCvExperienceBullets(options: {
  locale: Locale;
  gender?: CoverLetterGender | string;
  experienceIndex: number;
  factSet: CvCanonicalFactSet;
  candidate: string;
  /** Structured employment status — authoritative for tense (not source wording). */
  isPresent?: boolean;
  repair?: (prompt: string) => Promise<string>;
  /** Absolute deadline (ms epoch) the whole request must respond by. When
   * insufficient budget remains for one more provider round-trip, repair is
   * skipped and the local deterministic fallback is used immediately instead
   * — see `ai-request-timing.ts`. */
  deadlineAt?: number | null;
  /** Recovery requests must fail closed when their one bounded provider result
   * is empty/unsafe; ordinary generation retains deterministic fallback. */
  allowDeterministicFallback?: boolean;
}): Promise<CvContentActivation> {
  const canonical = bulletsForExperience(options.factSet, options.experienceIndex);
  const canonicalJoined = canonical.map((b) => b.value).join('\n');
  const englishFallback = deterministicBulletsFromCanonical(canonical);
  const candidate = normalizeHindiGeneratedWhitespace(
    stripAiProtocolMarkers(options.candidate || ''),
    options.locale,
  );
  const first = validateLocalizedExperienceBullets(candidate, options.factSet, {
    locale: options.locale,
    gender: options.gender,
    experienceIndex: options.experienceIndex,
    stage: 'initial',
    isPresent: options.isPresent,
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
          { isPresent: options.isPresent, gender: String(options.gender || '') },
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

  if (options.allowDeterministicFallback === false) {
    return {
      content: '',
      status: 'blocked',
      repairAttempted,
      fallbackUsed: false,
      blocked: true,
      violations: first.violations,
    };
  }

  const localizedFallbackRaw = normalizeHindiGeneratedWhitespace(
    deterministicLocalizedBulletsFromCanonical(
      canonical,
      options.locale,
      options.gender,
      { isPresent: options.isPresent },
    ) || '',
    options.locale,
  );
  // Hindi Experience CV surface: normalize 1sg (हूँ) → honorific/third (हैं).
  const localizedFallback = options.locale === 'hi'
    ? normalizeHindiExperiencePerspective(localizedFallbackRaw)
    : localizedFallbackRaw;
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

  const sourceBoundFallbackRaw = buildCrossLocaleExperienceFallback({
    sourceDescription: canonicalJoined,
    targetLocale: options.locale,
    gender: options.gender,
    isPresent: options.isPresent,
  });
  const sourceBoundFallback = options.locale === 'hi'
    ? normalizeHindiExperiencePerspective(sourceBoundFallbackRaw)
    : sourceBoundFallbackRaw;
  if (
    sourceBoundFallback
    && experiencePasses(sourceBoundFallback, {
      ...options,
      stage: 'source_bound_fallback',
      canonicalJoined,
    })
  ) {
    return {
      content: sourceBoundFallback,
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
  options?: { locale?: Locale; gender?: CoverLetterGender | string; duration?: ExperienceDuration },
): string {
  const locale = options?.locale || 'en';
  const gender = options?.gender || '';
  // Prefer the universal grounded builder (all duties, marker-safe, grammatical skills).
  const grounded = deterministicLocalizedSummaryFromCanonical(
    factSet,
    locale,
    gender,
    options?.duration,
  ).trim();
  if (grounded) return grounded;

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
    .slice(0, 5)
    .map((f) => stripDutyListPrefix(f.sourceText || f.value).replace(/[.。۔।]\s*$/u, ''))
    .filter(Boolean);
  const safeHint = fallbackHint.trim();
  const hintUsable = safeHint
    && validateSummaryCompleteness(safeHint).valid
    && !UNSUPPORTED_HINT_MARKERS.test(safeHint)
    && !summaryContainsListMarkerLeakage(safeHint)
    && !summaryHasMalformedSkillsFragment(safeHint);
  const dutyProse = bullets.length
    ? (locale === 'en'
      ? bullets.map((b) => dutyToEnglishGerundFragment(b)).filter(Boolean)
      : bullets)
    : [];
  let dutyJoin = '';
  if (dutyProse.length === 1) dutyJoin = dutyProse[0];
  else if (dutyProse.length === 2) dutyJoin = `${dutyProse[0]} and ${dutyProse[1]}`;
  else if (dutyProse.length > 2) {
    dutyJoin = `${dutyProse.slice(0, -1).join(', ')}, and ${dutyProse[dutyProse.length - 1]}`;
  }
  const parts = [
    role ? `${role}${dutyJoin ? ` with experience ${dutyJoin}` : ''}.` : (dutyJoin ? `${dutyJoin}.` : ''),
    hintUsable ? safeHint : '',
  ].filter(Boolean);
  let text = parts.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) {
    const rolePart = role ? `${role}.` : '';
    text = rolePart || 'Experienced professional ready to contribute responsibly.';
  }
  text = sanitizeSummaryListMarkers(text);
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
  const candidate = normalizeHindiGeneratedWhitespace(
    stripAiProtocolMarkers(options.candidate || ''),
    options.locale,
  );
  const first = validateLocalizedSummary(candidate, options.factSet, {
    locale: options.locale,
    gender: options.gender,
    stage: 'initial',
    expectedDuration: options.duration,
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
        expectedDuration: options.duration,
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
      expectedDuration: options.duration,
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
      expectedDuration: options.duration,
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
