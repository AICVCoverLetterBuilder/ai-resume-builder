/**
 * Universal content-locale detection and cross-locale operation helpers.
 * Distinguishes source vs target locale without treating Serbian Latin as English.
 * Latin script alone must never classify Spanish (incl. accented preterite) as English.
 */
import type { Locale } from './i18n/translations';
import { resolveLocaleCandidate } from './i18n/translations';
import { analyzeCroatianSerbianLocaleEvidence } from './cv-ai-unit-locale-purity';
import {
  ES_EXPERIENCE_LEXICON_RE,
  ES_FUNCTION_WORDS_RE,
  textLooksSpanishExperience,
} from './cv-spanish-experience-morphology';

/** High-signal Serbian/Croatian Latin lexicon (works with or without diacritics). */
const SR_HR_LATIN_LEXICON_RE =
  /\b(?:obavlja|obavljao|obavljala|ažurira|azurira|ažurirao|azurirao|ažurirala|azurirala|koordiniše|koordinise|koordinira|koordinirao|koordinirala|proverava|proveravao|proveravala|provjerava|provjeravala|pregleda|pregledao|pregledala|priprema|pripremao|pripremala|sarađuje|saradjuje|sarađivala|saradjivala|surađuje|surađivala|evidencij\w*|dokumentacij\w*|kolegama|kolege|kolegicama|zadat(?:ak|ke|aka)|skladišt\w*|skladist\w*|robe|robu|radnog\s+mesta|radnom\s+mestu|radnog\s+mjesta|blagovremen\w*|potpunost|tačnost|tacnost|točnost|tocnost|vizueln\w*|vizualn\w*|grafičk\w*|grafick\w*|dizajn\w*|iskustva|godine|godina|poslove|posao|timovima|proizvod|razvoj|zaprimljen\w*|premještanj\w*|prateć\w*|popratn\w*)\b/iu;

const SR_HR_FUNCTION_WORDS_RE =
  /\b(?:sa|za|na|od|do|kod|pri|pre|posle|kako|radi|uz|bez|ili|te|pa|jer|dok|kad|kada|što|sto|koji|koja|koje|svojim|svoje|svakodnevn\w*)\b/iu;

const EN_LEXICON_RE =
  /\b(?:performs?|updates?|coordinates?|reviews?|checks?|maintains?|prepares?|collaborates?|warehouse|records?|colleagues?|duties|experience|according|management|inventory|design|visual|identity)\b/i;

const DE_LEXICON_RE = /\b(?:prüft|aktualisiert|koordiniert|Erfahrung|Tätigkeit|verantwortlich)\b/iu;
/** Present + past Experience forms; ASCII `\b` fails after ó — use morphology lexicon. */
const ES_LEXICON_RE = ES_EXPERIENCE_LEXICON_RE;
/**
 * French Experience lexicon — include warehouse CV verbs so whole-text detection
 * does not lose to Spanish `la` + acute accents (AAB-334 FR→IT).
 * Do NOT use `[eé]paration`-style classes that also match English "preparation".
 */
const FR_LEXICON_RE =
  /(?:contr[oô]le|contr[oô]ler|v[eé]rifie(?![a-z])|v[eé]rifier|coordonne|coordonner|marchandises?|coll[eè]gues?|entrep[oô]t|préparation|déplacement|expérience|met\s+[aà]\s+jour|l['']entrep)/iu;
const FR_EXCLUSIVE_WAREHOUSE_RE =
  /(?:contr[oô]le\s+les\s+marchandises|v[eé]rifie\s+les\s+documents|coordonne\s+avec\s+(?:ses\s+)?coll[eè]gues|marchandises?\s+entrant|documents?\s+associ[eé]s|l['']entrep[oô]t)/iu;
/**
 * Italian Experience lexicon — warehouse-specific exclusive cues for IT target.
 * Do NOT include bare Romance cognates (`coordina`/`verifica`) that also appear
 * in Spanish Experience bullets.
 */
const IT_LEXICON_RE =
  /\b(?:documentazione|magazzino|colleghi|movimentazione|merci)\b/iu;
const IT_EXCLUSIVE_WAREHOUSE_RE =
  /(?:controlla\s+le\s+merci|merci\s+in\s+entrata|documentazione\s+relativa|merci\s+ricevute|si\s+coordina\s+con\s+i\s+colleghi|movimentazione\s+delle\s+merci|nel\s+magazzino)/iu;
/**
 * Brazilian Portuguese Experience lexicon — warehouse-specific exclusive cues.
 * Prefer over shared Romance cognates (`verifica`/`coordena`) that also appear
 * in Italian/Spanish, and over German article `das` colliding with PT `das`.
 */
const PT_LEXICON_RE =
  /\b(?:mercadorias?|armaz[eé]m|documenta[cç][aã]o|recebidas|colegas|prepara[cç][aã]o|movimenta[cç][aã]o|confere|atualiza|experiência)\b/iu;
const PT_EXCLUSIVE_WAREHOUSE_RE =
  /(?:verifica\s+as\s+mercadorias|mercadorias?\s+que\s+chegam|ao\s+armaz[eé]m|confere\s+a\s+documenta[cç][aã]o|documenta[cç][aã]o\s+relacionada|mercadorias?\s+recebidas|coordena\s+com\s+os\s+colegas|prepara[cç][aã]o\s+e\s+a\s+movimenta[cç][aã]o|movimenta[cç][aã]o\s+das\s+mercadorias)/iu;

/** True when locale string is Brazilian Portuguese (any supported alias). */
export function isPortugueseBrazilLocale(locale: string | null | undefined): boolean {
  const resolved = resolveLocaleCandidate(locale);
  if (resolved === 'pt-BR') return true;
  const key = String(locale || '').trim().toLowerCase().replace(/_/g, '-');
  return key === 'pt-br' || key === 'pt' || key === 'pt-brs';
}

/**
 * Canonical public locale form for diagnostics / persistence.
 * Maps pt / pt-br / pt_BR / pt-BR → `pt-BR`.
 */
export function canonicalizeContentLocale(
  locale: string | null | undefined,
): Locale | string {
  const resolved = resolveLocaleCandidate(locale);
  if (resolved) return resolved;
  const raw = String(locale || '').trim();
  return raw || 'unknown';
}

/**
 * Post-commit public applied locale for Experience diagnostics.
 * Internal comparison keys may stay lowercase (`pt-br`); the public
 * `appliedVisibleContentLocale` must use {@link canonicalizeContentLocale}.
 * Never publish `.toLowerCase()` of a persisted locale as the public value.
 */
export function resolveCommittedAppliedVisibleContentLocale(options: {
  persistedGeneratedLocale?: string | null;
  requestedTargetLocale?: string | null;
}): {
  appliedVisibleContentLocale: string;
  appliedVisibleContentLocaleRaw: string;
} {
  const raw = String(
    options.persistedGeneratedLocale
    || options.requestedTargetLocale
    || '',
  ).trim().split('|')[0]?.trim()
    || String(options.requestedTargetLocale || '').trim();
  return {
    appliedVisibleContentLocaleRaw: raw,
    appliedVisibleContentLocale: String(canonicalizeContentLocale(raw)),
  };
}

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
    // Serbian-specific Cyrillic letters are decisive. Shared CV stems alone must
    // not classify complete Russian warehouse/design bullets as Serbian.
    const hasSrCyrLetters = /[јљњћђџЈЉЊЋЂЏ]/u.test(raw);
    const hasRuLetters = /[ёыэъщЁЫЭЪЩ]/u.test(raw);
    const hasRuCv =
      /(?:проверя|обновл|поддержива|координир|согласов|созда[её]|адаптир|подготавли|подготов|поступающ|сопроводительн|складск|товар(?:ов|ы|а)?|документ|запис|файл|экран|визуальн|графическ|дизайн|работал|работала|выполнял|имеет\s+опыт|общим\s+опытом|лет\s+(?:общего\s+)?опыта|кладовщ|обеспечивая|размещен|перемещен)/iu.test(raw);
    const hasSrCvDistinct =
      /(?:преглед|ажурир|извешта|одељен|евиденц|пристигл|означав|непотпун|заједнич|сарађ|припремал|креирал|искуств)/iu.test(raw);
    let loc: Locale = 'ru';
    if (hasSrCyrLetters && !hasRuLetters) {
      loc = 'sr';
    } else if (hasRuLetters || hasRuCv) {
      loc = 'ru';
    } else if (hasSrCvDistinct && !hasRuCv) {
      loc = 'sr';
    } else {
      // Ambiguous shared Cyrillic — prefer Russian over Serbian (Russian is the
      // primary Cyrillic CV package; SC Latin is the default Serbian mode).
      loc = 'ru';
    }
    return {
      detectedLocale: loc,
      script,
      hasSerbianDiacritics,
      hasSerbianLexicon: hasSrCyrLetters || hasSrCvDistinct,
      confidence: hasSrCyrLetters || hasRuLetters || hasRuCv || hasSrCvDistinct ? 'high' : 'medium',
    };
  }

  if (hasSerbianDiacritics || (hasSerbianLexicon && hasSrFunction) || hasSerbianLexicon) {
    // Discriminate Croatian vs Serbian — shared SC Latin must not default to sr
    // when exclusive Croatian forms dominate (Provjerava / točnost / zaprimljene…).
    const hrEvidence = analyzeCroatianSerbianLocaleEvidence(raw);
    const storedHint = (hints?.storedLocale || hints?.generatedLocale || '').trim();
    let loc: Locale = 'sr';
    if (hrEvidence.serbianLeakageDetected) {
      loc = 'sr';
    } else if (
      hrEvidence.croatianExclusiveCueCount > 0
      && hrEvidence.croatianExclusiveCueCount >= hrEvidence.serbianExclusiveCueCount
    ) {
      loc = 'hr';
    } else if (
      storedHint === 'hr'
      && hrEvidence.serbianExclusiveCueCount === 0
      && hrEvidence.croatianLocaleEvidencePassed
    ) {
      loc = 'hr';
    } else if (
      storedHint === 'sr'
      && hrEvidence.croatianExclusiveCueCount === 0
    ) {
      loc = 'sr';
    } else if (
      hrEvidence.croatianExclusiveCueCount > hrEvidence.serbianExclusiveCueCount
    ) {
      loc = 'hr';
    }
    return {
      detectedLocale: loc,
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
  // AAB-334 — French / Italian exclusive warehouse cues BEFORE Spanish.
  // Shared Romance article `la` + French acute `é` previously matched
  // textLooksSpanishExperience and mislabeled the FR triad as `es`.
  if (FR_EXCLUSIVE_WAREHOUSE_RE.test(raw) || FR_LEXICON_RE.test(raw)) {
    return {
      detectedLocale: 'fr',
      script: /[àâçéèêëïîôùûüÿœÀÂÇÉÈÊËÏÎÔÙÛÜŸŒ]/.test(raw) ? 'latin_diacritic' : 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'high',
    };
  }
  if (IT_EXCLUSIVE_WAREHOUSE_RE.test(raw) || IT_LEXICON_RE.test(raw)) {
    return {
      detectedLocale: 'it',
      script: /[àèéìòùÀÈÉÌÒÙ]/.test(raw) ? 'latin_diacritic' : 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'high',
    };
  }
  // AAB-335 — Brazilian Portuguese warehouse exclusive cues before Spanish /
  // English. Soft shells and hard triad share mercadorias/armazém/documentação.
  if (PT_EXCLUSIVE_WAREHOUSE_RE.test(raw) || PT_LEXICON_RE.test(raw)) {
    return {
      detectedLocale: 'pt-BR',
      script: /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(raw) ? 'latin_diacritic' : 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'high',
    };
  }
  // Spanish before English/stored fallback: accented preterite + Experience lexicon
  // must not classify as en merely because both use Latin script.
  if (
    ES_LEXICON_RE.test(raw)
    || textLooksSpanishExperience(raw)
    || (
      /[áéíóúñüÁÉÍÓÚÑÜ¿¡]/.test(raw)
      && ES_FUNCTION_WORDS_RE.test(raw)
      && !EN_LEXICON_RE.test(raw)
    )
  ) {
    return {
      detectedLocale: 'es',
      script: /[áéíóúñüÁÉÍÓÚÑÜ]/.test(raw) ? 'latin_diacritic' : 'latin',
      hasSerbianDiacritics,
      hasSerbianLexicon,
      confidence: 'high',
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

/**
 * Comparison key for locale equality. Aliases `pt`, `pt-br`, `pt_BR`, `pt-BR`
 * all normalize to `pt-br` so casing/separator differences cannot bypass
 * cross-locale / purity / persistence checks.
 */
export function normalizeLocaleKey(locale: string | null | undefined): string {
  const resolved = resolveLocaleCandidate(locale);
  if (resolved) return resolved.toLowerCase();
  return String(locale || '').trim().toLowerCase().replace(/_/g, '-');
}

/** Alias-aware locale equality (pt ≡ pt-BR ≡ pt-br ≡ pt_BR). */
export function localesEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const ka = normalizeLocaleKey(a);
  const kb = normalizeLocaleKey(b);
  if (!ka || !kb || ka === 'unknown' || kb === 'unknown') return false;
  if (ka === kb) return true;
  // Serbian and Croatian share a Latin script family but are not interchangeable
  // locales for Experience AI (SR↔HR is a real cross-locale conversion).
  return false;
}

/** True when source language differs from requested target (cross-locale AI). */
export function isCrossLocaleOperation(
  sourceLocale: string | null | undefined,
  targetLocale: string | null | undefined,
): boolean {
  const src = normalizeLocaleKey(sourceLocale);
  const tgt = normalizeLocaleKey(targetLocale);
  if (!src || !tgt || src === 'unknown') return false;
  if (localesEquivalent(sourceLocale, targetLocale)) return false;
  return true;
}

export function localeFamily(locale: string | null | undefined): string {
  const loc = normalizeLocaleKey(locale);
  if (loc === 'sr' || loc === 'hr') return 'sr_hr';
  if (loc === 'pt-br' || loc === 'pt') return 'pt_br';
  return loc || 'unknown';
}
