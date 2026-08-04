import type { CanonicalCvSnapshot } from './cv-canonical-snapshot';
import { splitExperienceBullets } from './cv-canonical-facts';
import { detectTextLocale } from './cv-content-locale';
import type { Locale } from './i18n/translations';
import type { WorkExperience } from './types';

export const EXPERIENCE_SOURCE_LOCALES: readonly Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
] as const;

export type ExperienceSourceLocaleResolution =
  | 'description_source_locale'
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
  const hasExplicitDescriptionLocale = Boolean(String(exp.descriptionSourceLocale || '').trim());
  const explicit = exactSupportedLocale(exp.descriptionSourceLocale);
  if (explicit) {
    return { locale: explicit, resolution: 'description_source_locale' };
  }
  // An explicit but unsupported value (notably generic `pt`) is conflicting
  // authority, not permission to silently reinterpret it as another locale.
  if (hasExplicitDescriptionLocale) {
    return { locale: null, resolution: 'ambiguous' };
  }

  const generated = exactSupportedLocale(exp.generatedLocale);
  if (
    generated
    && Boolean((exp.generatedDescription || '').trim())
    && clausesMatch(exp.description || '', exp.generatedDescription || '')
  ) {
    return { locale: generated, resolution: 'matching_generated_description' };
  }
  if (
    Boolean(String(exp.generatedLocale || '').trim())
    && Boolean((exp.generatedDescription || '').trim())
    && clausesMatch(exp.description || '', exp.generatedDescription || '')
  ) {
    return { locale: null, resolution: 'ambiguous' };
  }

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
    const canonicalLocale = exactSupportedLocale(canonicalSnapshot.canonicalLocale);
    if (
      matchingEntries.length === 1
      && canonicalLocale
      && clausesMatch(exp.description || '', canonicalText)
    ) {
      return { locale: canonicalLocale, resolution: 'matching_canonical_snapshot' };
    }
  }

  const detected = exactSupportedLocale(detectTextLocale(exp.description || ''));
  return detected
    ? { locale: detected, resolution: 'deterministic_detector' }
    : { locale: null, resolution: 'ambiguous' };
}
