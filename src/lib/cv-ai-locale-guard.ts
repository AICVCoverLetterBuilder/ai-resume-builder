/**
 * Wrong-language rejection for text that was *just generated* by the AI provider
 * for a specific requested locale (Generate Summary / Bullets / Rewrite).
 *
 * This is intentionally separate from `textMatchesRequestedFieldLocale`
 * (`cv-field-locale-integrity.ts`), which validates an entire, possibly long-standing
 * CV export and has always been permissive for every locale except Hindi (a CV may
 * legitimately contain content nobody has translated yet). Here we know the text is
 * a fresh AI response/repair/fallback for exactly one field and one requested
 * locale, so a much stronger check is safe: if the requested locale is not Serbian
 * or Croatian and the text is dominated by Serbian/Croatian, or the requested
 * locale's own script is essentially absent for a scripted language, the response
 * is in the wrong language and must never be applied — regardless of whether the
 * existing/source CV content happens to be Serbian (the most common real-world
 * case, since the source CV is often Serbian while the requested output locale is
 * not).
 */
import type { Locale } from './i18n/translations';

const DEVANAGARI = /[\u0900-\u097F]/g;
const ARABIC_SCRIPT = /[\u0600-\u06FF]/g;
const CJK_SCRIPT = /[\u3040-\u30FF\u3400-\u9FFF]/g;
const CYRILLIC_SCRIPT = /[\u0400-\u04FF]/g;
const NON_LATIN_SCRIPT_ANY = /[\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF\u0400-\u04FF]/u;
const LATIN = /[A-Za-zÀ-ÖØ-öø-ÿŠšŽžĆćČčĐđ]/g;

/** Distinctive to Serbian/Croatian/Bosnian; never used by de/es/fr/it/en/pt-BR. */
const SERBO_CROATIAN_DIACRITICS = /[čćžšđČĆŽŠĐ]/u;

/** Scripted locales that require their own script to dominate prose output. */
const SCRIPT_LOCALE_PATTERN: Partial<Record<Locale, RegExp>> = {
  hi: DEVANAGARI,
  ar: ARABIC_SCRIPT,
  ja: CJK_SCRIPT,
  ru: CYRILLIC_SCRIPT,
};

/**
 * True when freshly-generated `text` is clearly NOT written in `locale`.
 * Conservative by design (only rejects strong, unambiguous signals) so it never
 * blocks a correctly-translated response — it only catches genuine cross-locale
 * leaks such as the provider echoing the Serbian source when German was requested.
 */
export function isWrongLanguageAiOutput(text: string, locale: Locale): boolean {
  const value = (text || '').normalize('NFKC').trim();
  if (!value) return false;

  const scriptRe = SCRIPT_LOCALE_PATTERN[locale];
  if (scriptRe) {
    const scriptCount = (value.match(scriptRe) || []).length;
    const latinCount = (value.match(LATIN) || []).length;
    const total = Math.max(1, scriptCount + latinCount);
    // Neutral proper nouns / acronyms may keep some Latin letters, but the
    // requested script must clearly dominate the generated prose.
    if (!(scriptCount >= 4 && scriptCount / total >= 0.35)) return true;
    // A leaked Serbian/Croatian sentence (e.g. spliced in by duration-repair
    // logic that only strips known duration fragments, not whole foreign
    // sentences) counts toward `latinCount` above, so it can be diluted by a
    // long-enough requested-script opening and slip past the ratio check.
    // These diacritics never legitimately occur in hi/ar/ja/ru prose, so any
    // occurrence — regardless of overall script ratio — is still a reliable,
    // unambiguous wrong-language signal.
    if (SERBO_CROATIAN_DIACRITICS.test(value)) return true;
    return false;
  }

  // Latin-script requested locale (en, de, es, fr, it, sr, hr, pt-BR): a non-Latin
  // script appearing at all means the wrong provider language leaked through.
  if (NON_LATIN_SCRIPT_ANY.test(value)) return true;

  // The most common real-world cross-locale regression: Serbian/Croatian source
  // content echoed back when a *different* target locale was requested. These
  // diacritics never occur in en/de/es/fr/it/pt-BR, so any occurrence is reliable.
  if (locale !== 'sr' && locale !== 'hr' && SERBO_CROATIAN_DIACRITICS.test(value)) {
    return true;
  }
  return false;
}
