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
import { normalizeSourceFactText } from './cv-source-fact-identity';
import {
  experienceAiSourcesEquivalent,
  experienceAiSourceUnits,
  normalizeExperienceAiSourceText,
} from './cv-experience-ai-operation-snapshot';

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

/**
 * Normalized content compare for source-selection / material-edit detection.
 * Uses shared Experience AI unit-sequence equivalence so bullet prefixes,
 * CRLF, and lost-newline concatenation do not count as material edits.
 */
export function experienceTextsMateriallyDiffer(a: string, b: string): boolean {
  if (!((a || '').trim()) && !((b || '').trim())) return false;
  if (!((a || '').trim()) || !((b || '').trim())) return true;
  if (experienceAiSourcesEquivalent(a, b)) return false;
  const na = normalizeSourceFactText(normalizeExperienceAiSourceText(a || ''));
  const nb = normalizeSourceFactText(normalizeExperienceAiSourceText(b || ''));
  if (!na && !nb) return false;
  if (!na || !nb) return true;
  return na !== nb;
}

export type ExperienceAiAuthoritativeSourceKind =
  | 'currentTextarea'
  | 'description'
  | 'originalUserDescription'
  | 'canonicalDescription'
  | 'generatedDescription'
  | 'recovered_semantic_duties'
  | 'legacy_grounding'
  | 'none';

export type ExperienceAiAuthoritativeSourceResult = {
  text: string;
  kind: ExperienceAiAuthoritativeSourceKind;
  /** True when a non-empty live textarea lost to another source. */
  currentTextareaIgnoredOrOverridden: boolean;
  /**
   * @deprecated Misnamed — was true for any Latin-script override of diacritic
   * live text. Use `staleForeignLocaleSourceAuthoritative` instead.
   * Corrected: only true when selected text is English-locale Latin while live
   * is a different script/language family (never Serbian Latin vs Serbian).
   */
  englishSourceStillAuthoritative: boolean;
  /** True when a foreign-locale (non-requested-language) source beat live text. */
  staleForeignLocaleSourceAuthoritative: boolean;
  selectedSourceLanguage: string | null;
  selectedSourceScript: string | null;
  liveTextSelected: boolean;
  selectedSourceMatchesLiveNormalized: boolean;
  selectedSourceDiffReason:
    | 'none'
    | 'live_empty'
    | 'canonical_formatting_only'
    | 'material_content'
    | 'foreign_locale_override'
    | 'unknown';
  canonicalFormattingOnlyDifference: boolean;
  operationSnapshotSourceKind: ExperienceAiAuthoritativeSourceKind;
  /**
   * Request-scoped copy with grounding fields shadowed to the selected text.
   * Does not mutate persisted historical AI/canonical storage on the live CV.
   */
  experienceForAi: WorkExperience;
};

function scriptLooksEnglishLatin(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (/[čćžšđČĆŽŠĐ]/.test(t) || /\p{Script=Cyrillic}/u.test(t)) return false;
  if (/\p{Script=Devanagari}/u.test(t) || /\p{Script=Arabic}/u.test(t)) return false;
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) return false;
  // Serbian/Croatian CV Latin (with or without diacritics) is not English.
  if (
    /\b(?:obavlja|ažurira|azurira|koordiniše|koordinise|proverava|pregleda|evidencij\w*|kolegama|dokumentacij\w*|skladišt\w*|skladist\w*)\b/iu.test(t)
  ) {
    return false;
  }
  // Serbian/Croatian 1sg verbs without diacritics still count as local Latin.
  if (/\b\p{L}+(?:am|em|šem)\b/u.test(t) && /\b(?:sa|za|na|u|kada|kad|radi|uz)\b/u.test(t)) {
    return false;
  }
  return /[A-Za-z]/.test(t)
    && /\b(?:the|and|with|for|from|performs?|updates?|coordinates?|reviews?)\b/i.test(t);
}

function scriptLooksNonEnglish(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  return (
    /[čćžšđČĆŽŠĐ]/.test(t)
    || /\p{Script=Cyrillic}/u.test(t)
    || /\p{Script=Devanagari}/u.test(t)
    || /\p{Script=Arabic}/u.test(t)
    || /[\u3040-\u30ff\u3400-\u9fff]/.test(t)
  );
}

function inferSelectedLanguageScript(text: string): {
  language: string | null;
  script: string | null;
} {
  const t = (text || '').trim();
  if (!t) return { language: null, script: null };
  if (/\p{Script=Devanagari}/u.test(t)) return { language: 'hi', script: 'devanagari' };
  if (/\p{Script=Arabic}/u.test(t)) return { language: 'ar', script: 'arabic' };
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) return { language: 'ja', script: 'cjk' };
  if (/\p{Script=Cyrillic}/u.test(t)) return { language: 'sr', script: 'cyrillic' };
  if (/[čćžšđČĆŽŠĐ]/.test(t)) return { language: 'sr', script: 'latin' };
  if (
    /\b(?:obavlja|ažurira|azurira|koordiniše|koordinise|proverava|pregleda|evidencij\w*|kolegama|dokumentacij\w*)\b/iu.test(t)
  ) {
    return { language: 'sr', script: 'latin' };
  }
  if (
    /\b\p{L}+(?:am|em|šem)\b/u.test(t)
    && /\b(?:sa|za|na|u|kada|kad|radi|uz)\b/u.test(t)
  ) {
    return { language: 'sr', script: 'latin' };
  }
  if (/[äöüßÄÖÜ]/.test(t)) return { language: 'de', script: 'latin' };
  if (scriptLooksEnglishLatin(t)) return { language: 'en', script: 'latin' };
  if (/[A-Za-z]/.test(t)) return { language: null, script: 'latin' };
  return { language: null, script: null };
}

/**
 * Experience AI authoritative source policy (request-time only).
 *
 * Priority for Experience AI Improvement:
 * 1. Non-empty latest visible textarea (always) — even when equivalent to canonical
 * 2. Empty live textarea → Generation Mode with NO source promotion
 *    (never resurrect generatedDescription / canonical / original / recovered)
 *
 * Historical generated/canonical fields may remain stored for other CV entries
 * or diagnostics, but must not become the source of an empty-field generation.
 * Export grounding continues to use `resolveExperienceGroundingDescription`.
 */
export function resolveExperienceAiAuthoritativeSource(
  exp: WorkExperience,
): ExperienceAiAuthoritativeSourceResult {
  const live = (exp.description || '').trim();
  const canonical = (exp.canonicalDescription || '').trim();

  const liveEqualsCanonical = Boolean(
    live && canonical && experienceAiSourcesEquivalent(live, canonical),
  );
  const formattingOnly = Boolean(
    live
    && canonical
    && liveEqualsCanonical
    && live !== canonical,
  );

  const build = (
    text: string,
    kind: ExperienceAiAuthoritativeSourceKind,
  ): ExperienceAiAuthoritativeSourceResult => {
    const selected = (text || '').trim();
    // Always snapshot from live wording when live is the chosen source so
    // bullet serialization cannot alter fact identities.
    const authoritativeText = kind === 'currentTextarea' || kind === 'description'
      ? (exp.description || '').trim() || selected
      : selected;
    const normalizedSelected = normalizeExperienceAiSourceText(authoritativeText);
    const unitText = experienceAiSourceUnits(authoritativeText).join('\n') || normalizedSelected;
    // Empty selection (Generation Mode): shadow request Experience so historical
    // generated/canonical/original duties cannot re-enter FACT LOCK / factSet.
    const experienceForAi: WorkExperience = unitText
      ? {
        ...exp,
        description: unitText,
        originalUserDescription: unitText,
        canonicalDescription: unitText,
        descriptionOrigin: 'user',
        recoveredSemanticDuties: undefined,
        groundingRecoverySource: undefined,
      }
      : {
        ...exp,
        description: '',
        originalUserDescription: '',
        canonicalDescription: '',
        generatedDescription: '',
        recoveredSemanticDuties: undefined,
        groundingRecoverySource: undefined,
        descriptionOrigin: 'user',
      };

    const liveSelected = Boolean(
      live
      && (
        kind === 'currentTextarea'
        || kind === 'description'
        || experienceAiSourcesEquivalent(live, selected)
      ),
    );
    const ignored = Boolean(
      live
      && selected
      && !experienceAiSourcesEquivalent(live, selected),
    );
    const lang = inferSelectedLanguageScript(selected);
    const staleForeign = Boolean(
      ignored
      && selected
      && scriptLooksEnglishLatin(selected)
      && scriptLooksNonEnglish(live),
    );
    let diffReason: ExperienceAiAuthoritativeSourceResult['selectedSourceDiffReason'] = 'none';
    if (!live) diffReason = 'live_empty';
    else if (formattingOnly && experienceAiSourcesEquivalent(live, selected)) {
      diffReason = 'canonical_formatting_only';
    } else if (staleForeign) diffReason = 'foreign_locale_override';
    else if (ignored) diffReason = 'material_content';
    else if (live && selected && live !== selected && experienceAiSourcesEquivalent(live, selected)) {
      diffReason = 'canonical_formatting_only';
    }

    return {
      text: unitText || selected,
      kind: selected || unitText ? kind : 'none',
      currentTextareaIgnoredOrOverridden: ignored,
      englishSourceStillAuthoritative: staleForeign,
      staleForeignLocaleSourceAuthoritative: staleForeign,
      selectedSourceLanguage: lang.language,
      selectedSourceScript: lang.script,
      liveTextSelected: liveSelected && !ignored,
      selectedSourceMatchesLiveNormalized: Boolean(
        live && selected && experienceAiSourcesEquivalent(live, selected || unitText),
      ),
      selectedSourceDiffReason: diffReason,
      canonicalFormattingOnlyDifference: formattingOnly,
      operationSnapshotSourceKind: kind,
      experienceForAi,
    };
  };

  // 1. Non-empty live textarea is always the Experience AI operation source.
  if (live) {
    return build(live, 'currentTextarea');
  }

  // 2. Empty live textarea → Generation Mode. Do NOT promote historical
  // generated/canonical/original/recovered text into the request source.
  // Those fields stay on the persisted Experience for other consumers, but
  // experienceForAi must carry an empty description so FACT LOCK stays off.
  return build('', 'none');
}

/** Text resolver for Experience AI FACT LOCK / finalize — never prefer stale canonical over live user edits. */
export function freezeExperienceAiAuthoritativeDescription(exp: WorkExperience): string {
  return resolveExperienceAiAuthoritativeSource(exp).text;
}

/** Shadow experience grounding to the AI-authoritative source for one request. */
export function ensureExperienceAiAuthoritativeSource(exp: WorkExperience): WorkExperience {
  return resolveExperienceAiAuthoritativeSource(exp).experienceForAi;
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
    /**
     * When true (Generation Mode from empty description), confirm applied
     * bullets as grounding so Summary/export treat them as Experience facts.
     */
    confirmGeneratedAsGrounding?: boolean;
  },
): WorkExperience {
  const preserved = captureUserGroundingBeforeAi(exp);
  const hadNoGrounding = !(preserved.originalUserDescription || '').trim()
    && !(preserved.canonicalDescription || '').trim()
    && !(resolveExperienceGroundingDescription(preserved) || '').trim();
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
  if (options.confirmGeneratedAsGrounding && hadNoGrounding && (generated || '').trim()) {
    const confirmed = generated.trim();
    next = {
      ...next,
      originalUserDescription: confirmed,
      canonicalDescription: confirmed,
    };
  }
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
