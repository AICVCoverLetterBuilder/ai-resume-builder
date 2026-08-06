import type { CanonicalCvSnapshot } from './cv-canonical-snapshot';
import { splitExperienceBullets } from './cv-canonical-facts';
import { detectTextLocale } from './cv-content-locale';
import type { Locale } from './i18n/translations';
import type { WorkExperience } from './types';

export const EXPERIENCE_SOURCE_LOCALES: readonly Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
] as const;

export type ExperienceSourceLocaleResolution =
  | 'current_authoritative_text'
  | 'description_source_locale'
  | 'description_source_locale_legacy_match'
  | 'matching_generated_description'
  | 'matching_canonical_snapshot'
  | 'deterministic_detector'
  | 'ambiguous';

export type ResolvedExperienceSourceLocale = {
  locale: Locale | null;
  resolution: ExperienceSourceLocaleResolution;
};

function exactSupportedLocale(value: string | null | undefined): Locale | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.toLowerCase().replace(/_/g, '-');
  if (normalized === 'pt') return null;
  const match = EXPERIENCE_SOURCE_LOCALES.find((locale) => locale.toLowerCase() === normalized);
  return match || null;
}

function normalized(text: string): string {
  return String(text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/**
 * Locale evidence is bound to canonical duty units rather than editor
 * serialization. The same duties therefore keep one hash whether they are
 * stored as `â€¢ duty` lines, plain newline-separated lines, or CRLF text.
 */
function canonicalSourceLocaleText(text: string): string {
  const units = splitExperienceBullets(text || '')
    .map((unit) => normalized(unit))
    .filter(Boolean);
  return normalized(units.length > 0 ? units.join(' ') : text);
}

export function hashExperienceSourceLocaleText(text: string): string {
  const value = canonicalSourceLocaleText(text);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}_l${value.length}`;
}

function clausesMatch(left: string, right: string): boolean {
  const a = splitExperienceBullets(left || '');
  const b = splitExperienceBullets(right || '');
  return a.length > 0
    && a.length === b.length
    && a.every((clause, index) => normalized(clause) === normalized(b[index] || ''));
}

/**
 * Resolve one Experience entry from evidence tied to its current visible text.
 * Summary/UI/export locale and other Experience entries are intentionally absent.
 */
export function resolveExperienceSourceLocale(
  exp: WorkExperience,
  canonicalSnapshot?: CanonicalCvSnapshot,
): ResolvedExperienceSourceLocale {
  const visibleText = exp.description || '';
  const visibleHash = hashExperienceSourceLocaleText(visibleText);
  const hasExplicitDescriptionLocale = Boolean(String(exp.descriptionSourceLocale || '').trim());
  const explicit = exactSupportedLocale(exp.descriptionSourceLocale);
  const explicitBindingMatches = Boolean(exp.descriptionSourceLocaleTextHash)
    && exp.descriptionSourceLocaleTextHash === visibleHash;

  // A current-text-bound locale is the strongest persisted evidence.
  if (explicit && explicitBindingMatches) {
    return { locale: explicit, resolution: 'description_source_locale' };
  }

  // Current visible content outranks every unbound legacy field.
  const detected = exactSupportedLocale(detectTextLocale(visibleText));
  if (detected) {
    return { locale: detected, resolution: 'current_authoritative_text' };
  }

  // An ambiguous visible AI surface may still use the locale that belongs to
  // that exact generated snapshot. A stale descriptionSourceLocale is never
  // allowed to override conflicting generated-locale provenance.
  const generatedMatches = Boolean((exp.generatedDescription || '').trim())
    && clausesMatch(visibleText, exp.generatedDescription || '');
  if (generatedMatches) {
    const generated = exactSupportedLocale(exp.generatedLocale);
    if (generated) {
      return { locale: generated, resolution: 'matching_generated_description' };
    }
    return { locale: null, resolution: 'ambiguous' };
  }

  // Canonical locale is valid evidence only when the current entry matches the
  // single entry-owned canonical snapshot. This is stronger than an unbound
  // legacy descriptionSourceLocale and therefore wins conflicts.
  if (canonicalSnapshot?.canonicalState === 'valid') {
    const matchingEntries = canonicalSnapshot.canonicalExperiences
      .filter((entry) => entry.experienceId === exp.id);
    const canonicalEntry = matchingEntries[0];
    const canonicalText = canonicalEntry?.bullets
      ? [...canonicalEntry.bullets]
        .sort((a, b) => a.order - b.order)
        .map((bullet) => bullet.sourceText)
        .join('\n')
      : '';
    const canonicalLocale = exactSupportedLocale(canonicalEntry?.sourceLocale);
    const canonicalBindingMatches = Boolean(canonicalEntry?.sourceLocaleTextHash)
      && canonicalEntry?.sourceLocaleTextHash === visibleHash;
    if (
      matchingEntries.length === 1
      && canonicalLocale
      && canonicalBindingMatches
      && clausesMatch(visibleText, canonicalText)
    ) {
      return { locale: canonicalLocale, resolution: 'matching_canonical_snapshot' };
    }
  }

  // Legacy descriptionSourceLocale without a current-text hash is not
  // locale-specific evidence. Text equality with original/canonical fields
  // proves snapshot identity only; it cannot prove which locale owns it.
  if (hasExplicitDescriptionLocale) {
    return { locale: null, resolution: 'ambiguous' };
  }

  return { locale: null, resolution: 'ambiguous' };
}
