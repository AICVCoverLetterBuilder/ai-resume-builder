/**
 * Experience-description provenance: original user input vs confirmed canonical
 * facts vs AI-generated display text. AI output must never become grounding.
 */
import type { Locale } from './i18n/translations';
import type { WorkExperience } from './types';
import {
  stampExperienceGenerationContext,
  type ExperienceJobContext,
} from './cv-experience-job-context';

export type CvExperienceDescriptionOrigin =
  | 'user'
  | 'ai_generated'
  | 'ai_repaired'
  | 'deterministic_fallback'
  | 'user_confirmed_ai_edit';

export function isAiDescriptionOrigin(
  origin?: string | null,
): origin is 'ai_generated' | 'ai_repaired' | 'deterministic_fallback' {
  return origin === 'ai_generated'
    || origin === 'ai_repaired'
    || origin === 'deterministic_fallback';
}

/** Cuisine-specific claims that must not be invented without user/source support. */
const CUISINE_INVENTION_RE =
  /\b(srpsk\w*\s+i\s+mediteransk\w*|mediteransk\w*\s+kuhinj|serbian\s+and\s+mediterranean|mediterranean\s+dish|сербск\w*\s+и\s+средизем|सर्बियाई\s+और\s+भूमध्य|セルビア料理|地中海料理|serbios?\s+y\s+mediterr|serbes?\s+et\s+méditerr|serbi\w*\s+e\s+mediterr|culinária\s+sérvia)/iu;

export function hasCuisineSpecificClaim(text: string): boolean {
  return CUISINE_INVENTION_RE.test(text || '');
}

export function isUserAuthoredExperienceDescription(exp: Pick<WorkExperience, 'descriptionOrigin'>): boolean {
  const origin = exp.descriptionOrigin;
  return !origin || origin === 'user' || origin === 'user_confirmed_ai_edit';
}

type ScriptBucket = 'latin' | 'devanagari' | 'arabic' | 'cjk' | 'cyrillic' | 'other';

function dominantScriptBucket(text: string): ScriptBucket {
  const value = (text || '').normalize('NFKC');
  const counts: Array<[ScriptBucket, number]> = [
    ['devanagari', (value.match(/[\u0900-\u097F]/g) || []).length],
    ['arabic', (value.match(/[\u0600-\u06FF]/g) || []).length],
    ['cjk', (value.match(/[\u3040-\u30FF\u3400-\u9FFF]/g) || []).length],
    ['cyrillic', (value.match(/[\u0400-\u04FF]/g) || []).length],
    ['latin', (value.match(/[A-Za-zÀ-ÖØ-öø-ÿŠšŽžĆćČčĐđ]/g) || []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  if (!counts[0] || counts[0][1] < 4) return 'other';
  return counts[0][0];
}

/**
 * True when canonical looks like AI display text promoted over user grounding
 * (script mismatch vs original, or canonical equals AI-visible description).
 */
export function isAiPollutedCanonicalDescription(
  exp: Pick<
    WorkExperience,
    'description' | 'canonicalDescription' | 'originalUserDescription' | 'descriptionOrigin'
  >,
): boolean {
  const original = (exp.originalUserDescription || '').trim();
  const canonical = (exp.canonicalDescription || '').trim();
  const visible = (exp.description || '').trim();
  if (!original || !canonical || original === canonical) return false;
  if (
    hasCuisineSpecificClaim(canonical)
    && !hasCuisineSpecificClaim(original)
  ) {
    return true;
  }
  if (isAiDescriptionOrigin(exp.descriptionOrigin) && canonical === visible) {
    return true;
  }
  const originalScript = dominantScriptBucket(original);
  const canonicalScript = dominantScriptBucket(canonical);
  if (
    originalScript !== 'other'
    && canonicalScript !== 'other'
    && originalScript !== canonicalScript
  ) {
    return true;
  }
  return false;
}

/**
 * Resolve immutable grounding text for AI / fallback / validation.
 * Never returns AI-generated description when safer user sources exist.
 */
export function resolveExperienceGroundingDescription(
  exp: Pick<
    WorkExperience,
    'description' | 'canonicalDescription' | 'originalUserDescription' | 'descriptionOrigin'
  >,
): string {
  const original = (exp.originalUserDescription || '').trim();
  const canonical = (exp.canonicalDescription || '').trim();
  const visible = (exp.description || '').trim();

  // Prefer confirmed canonical only when it does not invent claims absent from original
  // and was not polluted by AI-localized display text.
  if (canonical) {
    if (original && isAiPollutedCanonicalDescription(exp)) {
      return original;
    }
    return canonical;
  }
  if (original) return original;

  // Legacy entries: visible text is grounding only when not marked AI.
  if (visible && isUserAuthoredExperienceDescription(exp)) return visible;
  return '';
}

/**
 * Capture user-authored duties before the first AI rewrite.
 * Never copies AI-generated description into original/canonical storage.
 */
export function captureUserGroundingBeforeAi(exp: WorkExperience): WorkExperience {
  const grounding = resolveExperienceGroundingDescription(exp);
  const visible = (exp.description || '').trim();
  const next: WorkExperience = { ...exp };

  if (!(next.originalUserDescription || '').trim()) {
    if (grounding) {
      next.originalUserDescription = grounding;
    } else if (visible && isUserAuthoredExperienceDescription(exp)) {
      next.originalUserDescription = visible;
    }
  }

  // Seed canonical from user grounding only — never from AI-visible text.
  if (!(next.canonicalDescription || '').trim()) {
    const seed = (next.originalUserDescription || '').trim()
      || (isUserAuthoredExperienceDescription(exp) ? visible : '');
    if (seed) next.canonicalDescription = seed;
  } else if (
    (next.originalUserDescription || '').trim()
    && isAiPollutedCanonicalDescription(next)
  ) {
    // Repair polluted canonical that was promoted from AI inventions / localized display.
    next.canonicalDescription = next.originalUserDescription;
  }

  if (!next.descriptionOrigin) {
    next.descriptionOrigin = isAiDescriptionOrigin(exp.descriptionOrigin) ? exp.descriptionOrigin : 'user';
  }
  return next;
}

/** Apply AI/fallback bullets to display fields only. */
export function applyGeneratedExperienceDescription(
  exp: WorkExperience,
  generated: string,
  options: {
    locale: Locale;
    origin: CvExperienceDescriptionOrigin;
    jobContext?: ExperienceJobContext;
  },
): WorkExperience {
  const preserved = captureUserGroundingBeforeAi(exp);
  let next: WorkExperience = {
    ...preserved,
    description: generated,
    generatedDescription: generated,
    generatedLocale: options.locale,
    descriptionOrigin: options.origin,
    // Explicitly keep grounding fields unchanged from capture result
    originalUserDescription: preserved.originalUserDescription,
    canonicalDescription: preserved.canonicalDescription,
  };
  if (options.jobContext) {
    next = stampExperienceGenerationContext(next, options.jobContext);
  }
  return next;
}

/**
 * True when hydrate/migration must rewrite provenance fields.
 * Only hard repairs (AI-polluted canonical) — soft seeding of
 * `originalUserDescription` happens on the next AI capture path.
 */
export function experienceProvenanceNeedsRepair(exp: WorkExperience): boolean {
  return Boolean(
    (exp.canonicalDescription || '').trim()
    && (exp.originalUserDescription || '').trim()
    && hasCuisineSpecificClaim(exp.canonicalDescription!)
    && !hasCuisineSpecificClaim(exp.originalUserDescription!),
  );
}

/**
 * Normalize legacy experience rows on hydrate/autosave load.
 * Does not invent duties; repairs AI-polluted canonical when original is safer.
 */
export function normalizeExperienceProvenance(exp: WorkExperience): WorkExperience {
  if (!experienceProvenanceNeedsRepair(exp)) return exp;
  return {
    ...exp,
    canonicalDescription: exp.originalUserDescription,
  };
}
