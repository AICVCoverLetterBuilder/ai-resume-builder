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

const EN_CLAUSE_RE =
  /\b(?:the|and|with|for|from|that|this|these|those|was|were|are|is|been|being|have|has|had|will|would|should|could|created|reviewed|updated|coordinated|delivered|developed|prepared|maintained|ensured|supported|managed|worked|using|across|during|within)\b/iu;

/** Strip Latin brand/domain islands so they do not trip SC-diacritic checks under hi/ar/ja/ru. */
function stripLatinDomainIslands(text: string): string {
  return (text || '')
    .replace(/\b[\p{Script=Latin}][\p{Script=Latin}0-9.&'’-]{0,48}\b/gu, (tok) => (
      EN_CLAUSE_RE.test(tok) ? tok : ' '
    ))
    .replace(/\s+/g, ' ')
    .trim();
}

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
    // Strip brand / free-text domain labels (may carry Serbian diacritics like
    // "logističkih") before judging script purity — those are not SC prose.
    const prose = stripLatinDomainIslands(value) || value;
    const scriptCount = (prose.match(scriptRe) || []).length;
    const latinCount = (prose.match(LATIN) || []).length;
    const total = Math.max(1, scriptCount + latinCount);
    // Neutral proper nouns / acronyms may keep some Latin letters, but the
    // requested script must clearly dominate the generated prose.
    if (!(scriptCount >= 4 && scriptCount / total >= 0.35)) return true;
    // A leaked Serbian/Croatian *sentence* (English/Latin clause with SC
    // diacritics) is still wrong under hi/ar/ja/ru. Domain labels already
    // stripped above.
    if (SERBO_CROATIAN_DIACRITICS.test(prose)) return true;
    return false;
  }

  // Serbian/Croatian: reject non-Latin scripts unrelated to SC, and reject
  // English-dominated AI prose (build 271 mixed EN bullets under sr target).
  if (locale === 'sr' || locale === 'hr') {
    // Allow free-text title islands in other scripts; keep Serbian Cyrillic
    // (do NOT strip \u0400-\u04FF — that wrongly emptied Cyrillic Serbian prose).
    const scProse = (value || '')
      .replace(/[\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]{2,}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/[\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]{8,}/u.test(scProse)) return true;
    const hasSc = SERBO_CROATIAN_DIACRITICS.test(scProse)
      || /\p{Script=Cyrillic}/u.test(scProse)
      || /\b(?:je|su|sam|radi|proverav|ažurir|koordin|kreiral|sarađiv|pripremal|isporuč|robu|skladišt|godin|iskustv)\w*\b/iu.test(scProse);
    const enHits = (scProse.match(
      /\b(?:the|and|with|for|from|that|this|created|reviewed|updated|coordinated|delivered|developed|prepared|maintained|visual|materials|graphic|design|platforms?|specifications?)\b/giu,
    ) || []).length;
    if (enHits >= 3 && !hasSc) return true;
    return false;
  }
  // Latin targets may embed free-text title islands in non-Latin scripts.
  const withoutForeignTitles = value
    .replace(/[\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF\u0400-\u04FF]{2,}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/[\u0900-\u097F\u0600-\u06FF\u3040-\u30FF\u3400-\u9FFF]{8,}/u.test(withoutForeignTitles)) {
    return true;
  }

  // Serbian/Croatian *prose* under en/de/es/… — not a single title-domain token
  // like "logističkih" inside otherwise-correct German/English bullets.
  const scTokens = withoutForeignTitles.match(/\b\w*[čćžšđČĆŽŠĐ]\w*\b/gu) || [];
  const scClause = /\b(?:je|su|sam|si|smo|ste|sa|za|od|do|na|radi|proverav\w*|ažurir\w*|azurir\w*|kreiral\w*|sarađiv\w*|saradnja|pripremal\w*|isporuč\w*|skladišt\w*|robu|godin\w*|timovima|projekata)\b/iu
    .test(withoutForeignTitles);
  if (scTokens.length >= 2 || (scTokens.length >= 1 && scClause)) {
    return true;
  }
  return false;
}
