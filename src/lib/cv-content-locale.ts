/**
 * Universal content-locale detection and cross-locale operation helpers.
 * Distinguishes source vs target locale without treating Serbian Latin as English.
 */
import type { Locale } from './i18n/translations';

/** High-signal Serbian/Croatian Latin lexicon (works with or without diacritics). */
const SR_HR_LATIN_LEXICON_RE =
  /\b(?:obavlja|obavljao|obavljala|ažurira|azurira|ažurirao|azurirao|ažurirala|azurirala|koordiniše|koordinise|koordinira|koordinirao|koordinirala|proverava|proveravao|proveravala|pregleda|pregledao|pregledala|priprema|pripremao|pripremala|sarađuje|saradjuje|sarađivala|saradjivala|evidencij\w*|dokumentacij\w*|kolegama|kolege|zadat(?:ak|ke|aka)|skladišt\w*|skladist\w*|robe|robu|radnog\s+mesta|radnom\s+mestu|blagovremen\w*|potpunost|tačnost|tacnost|vizueln\w*|grafičk\w*|grafick\w*|dizajn\w*|iskustva|godine|godina|poslove|posao|timovima|timovima|proizvod|razvoj)\b/iu;

const SR_HR_FUNCTION_WORDS_RE =
  /\b(?:sa|za|na|od|do|kod|pri|pre|posle|kako|radi|uz|bez|ili|te|pa|jer|dok|kad|kada|što|sto|koji|koja|koje|svojim|svoje|svakodnevn\w*)\b/iu;

const EN_LEXICON_RE =
  /\b(?:performs?|updates?|coordinates?|reviews?|checks?|maintains?|prepares?|collaborates?|warehouse|records?|colleagues?|duties|experience|according|management|inventory|design|visual|identity)\b/i;

const DE_LEXICON_RE = /\b(?:prüft|aktualisiert|koordiniert|Erfahrung|Tätigkeit|verantwortlich)\b/iu;
const ES_LEXICON_RE = /\b(?:revisa|actualiza|coordina|experiencia|clientes)\b/iu;
const FR_LEXICON_RE = /\b(?:examine|met\s+à\s+jour|coordonne|expérience)\b/iu;
const IT_LEXICON_RE = /\b(?:esamina|aggiorna|coordina|esperienza)\b/iu;
const PT_LEXICON_RE = /\b(?:revisa|atualiza|coordena|experiência)\b/iu;

export type DetectedContentLocale = Locale | 'unknown';

export type ContentLocaleSignals = {
  detectedLocale: DetectedContentLocale;
  script: 'latin' | 'latin_diacritic' | 'cyrillic' | 'devanagari' | 'arabic' | 'cjk' | 'mixed' | 'empty' | 'other';
  hasSerbianDiacritics: boolean;
  hasSerbianLexicon: boolean;
  confidence: 'high' | 'medium' | 'low';
};

function classifyScript(text: string): ContentLocaleSignals['script'] {
  const t = (text || '').trim();
  if (!t) return 'empty';
  const hits: ContentLocaleSignals['script'][] = [];
  if (/[A-Za-z]/.test(t)) hits.push('latin');
  if (/[čćžšđČĆŽŠĐ]/.test(t)) hits.push('latin_diacritic');
  if (/\p{Script=Cyrillic}/u.test(t)) hits.push('cyrillic');
  if (/\p{Script=Devanagari}/u.test(t)) hits.push('devanagari');
  if (/\p{Script=Arabic}/u.test(t)) hits.push('arabic');
  if (/[\u3040-\u30ff\u3400-\u9fff]/.test(t)) hits.push('cjk');
  if (!hits.length) return 'other';
  if (hits.length === 1) return hits[0];
  if (hits.includes('latin_diacritic') && hits.every((s) => s === 'latin' || s === 'latin_diacritic')) {
    return 'latin_diacritic';
  }
  return 'mixed';
}

/**
 * Detect the language of authored CV text. Does NOT default plain Latin to English.
 * Undiacritic Serbian with CV verbs/function words → sr.
 */
export function analyzeContentLocale(
  text: string,
  hints?: { storedLocale?: string | null; generatedLocale?: string | null },
): ContentLocaleSignals {
  const raw = (text || '').trim();
  if (!raw) {
    return {
      detectedLocale: 'unknown',
      script: 'empty',
      hasSerbianDiacritics: false,
      hasSerbianLexicon: false,
      confidence: 'low',
    };
  }

  const script = classifyScript(raw);
  const hasSerbianDiacritics = /[čćžšđČĆŽŠĐ]/.test(raw);
  const hasSerbianLexicon = SR_HR_LATIN_LEXICON_RE.test(raw);
  const hasSrFunction = SR_HR_FUNCTION_WORDS_RE.test(raw);

  if (script === 'devanagari') {
    return {
      detectedLocale: 'hi',
      script,
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'high',
    };
  }
  if (script === 'arabic') {
    return {
      detectedLocale: 'ar',
      script,
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'high',
    };
  }
  if (script === 'cjk') {
    return {
      detectedLocale: 'ja',
      script,
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'high',
    };
  }
  if (script === 'cyrillic') {
    const loc: Locale = /\b(?:опыт|бармен|коктейл|работал|работала)\b/iu.test(raw) ? 'ru' : 'sr';
    return {
      detectedLocale: loc,
      script,
      hasSerbianDiacritics,
      hasSerbianLexicon: true,
      confidence: 'high',
    };
  }

  if (hasSerbianDiacritics || (hasSerbianLexicon && hasSrFunction) || hasSerbianLexicon) {
    return {
      detectedLocale: 'sr',
      script: hasSerbianDiacritics ? 'latin_diacritic' : 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon: true,
      confidence: hasSerbianDiacritics || (hasSerbianLexicon && hasSrFunction) ? 'high' : 'medium',
    };
  }

  if (DE_LEXICON_RE.test(raw) || /[äöüßÄÖÜ]/.test(raw)) {
    return {
      detectedLocale: 'de',
      script: 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'medium',
    };
  }
  if (ES_LEXICON_RE.test(raw)) {
    return {
      detectedLocale: 'es',
      script: 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'medium',
    };
  }
  if (FR_LEXICON_RE.test(raw)) {
    return {
      detectedLocale: 'fr',
      script: 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'medium',
    };
  }
  if (IT_LEXICON_RE.test(raw)) {
    return {
      detectedLocale: 'it',
      script: 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'medium',
    };
  }
  if (PT_LEXICON_RE.test(raw)) {
    return {
      detectedLocale: 'pt-BR',
      script: 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'medium',
    };
  }

  const stored = (hints?.storedLocale || hints?.generatedLocale || '').trim();
  if (stored === 'sr' || stored === 'hr') {
    // Plain Latin under Serbian provenance stays Serbian until proven otherwise.
    if (!EN_LEXICON_RE.test(raw) || hasSrFunction) {
      return {
        detectedLocale: stored as Locale,
        script: 'latin',
        hasSerbianDiacritics,
        hasSerbianLexicon: hasSerbianLexicon || hasSrFunction,
        confidence: 'medium',
      };
    }
  }

  if (EN_LEXICON_RE.test(raw) && /[A-Za-z]/.test(raw)) {
    return {
      detectedLocale: 'en',
      script: 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'medium',
    };
  }

  // Ambiguous Latin — do not invent English.
  if (stored && stored !== 'en') {
    return {
      detectedLocale: stored as Locale,
      script: 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'low',
    };
  }

  return {
    detectedLocale: 'unknown',
    script,
    hasSerbianDiacritics,
    hasSerbianLexicon,
    confidence: 'low',
  };
}

export function detectTextLocale(
  text: string,
  hints?: { storedLocale?: string | null; generatedLocale?: string | null },
): DetectedContentLocale {
  return analyzeContentLocale(text, hints).detectedLocale;
}

export function normalizeLocaleKey(locale: string | null | undefined): string {
  return String(locale || '').trim().toLowerCase();
}

/** True when source language differs from requested target (cross-locale AI). */
export function isCrossLocaleOperation(
  sourceLocale: string | null | undefined,
  targetLocale: string | null | undefined,
): boolean {
  const src = normalizeLocaleKey(sourceLocale);
  const tgt = normalizeLocaleKey(targetLocale);
  if (!src || !tgt || src === 'unknown') return false;
  if (src === tgt) return false;
  // sr/hr treated as same family for same-language preserve.
  if ((src === 'sr' || src === 'hr') && (tgt === 'sr' || tgt === 'hr')) return false;
  return true;
}

export function localeFamily(locale: string | null | undefined): string {
  const loc = normalizeLocaleKey(locale);
  if (loc === 'sr' || loc === 'hr') return 'sr_hr';
  return loc || 'unknown';
}
