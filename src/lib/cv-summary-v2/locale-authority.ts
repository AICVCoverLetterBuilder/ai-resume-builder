import type { Locale } from '@/lib/i18n/translations';

/**
 * AAB-390 — language-independent locale authority for Summary V2.
 *
 * Summary V2 previously treated the visible Experience text as universal fact
 * authority: `bulletText` captured in the source language was concatenated into
 * a target-language shell, and the V2 diagnostics asserted
 * `targetLocalePurityPassed: true` without ever measuring purity.
 *
 * This module supplies the two missing primitives:
 *   1. per-entry / per-fact source-locale identity (declared + detected), and
 *   2. measured target-locale purity of a finalized candidate.
 *
 * No occupation, employer, duty or language pair is hard-coded: detection uses
 * script ranges plus closed-class function words and diacritic signatures only.
 */
export const SUMMARY_V2_CROSS_LOCALE_AUTHORITY_390_REVISION =
  'summary-v2-cross-locale-authority-390-v1' as const;

export const SUMMARY_V2_SUPPORTED_LOCALES: Locale[] = [
  'en', 'de', 'es', 'fr', 'it', 'ar', 'sr', 'hr', 'ru', 'pt-BR', 'hi', 'ja',
];

export type SummaryV2Script = 'latin' | 'cyrillic' | 'arabic' | 'devanagari' | 'japanese' | 'unknown';

export type SummaryV2LocaleDetection = {
  locale: Locale | null;
  script: SummaryV2Script;
  confidence: 'high' | 'low' | 'none';
  /** Distinctive closed-class markers observed, keyed by locale. */
  markersByLocale: Record<string, string[]>;
};

/** Locales whose written surface is close enough that detection cannot separate them. */
const DETECTION_CLUSTERS: Locale[][] = [['sr', 'hr']];

export function localesAreDetectionCompatible(a: Locale | null, b: Locale | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return DETECTION_CLUSTERS.some((c) => c.includes(a) && c.includes(b));
}

export function scriptForLocale(locale: Locale): SummaryV2Script {
  if (locale === 'ar') return 'arabic';
  if (locale === 'hi') return 'devanagari';
  if (locale === 'ja') return 'japanese';
  if (locale === 'ru') return 'cyrillic';
  return 'latin';
}

const RE_ARABIC = /[\u0600-\u06FF\u0750-\u077F]/u;
const RE_DEVANAGARI = /[\u0900-\u097F]/u;
const RE_JAPANESE = /[\u3040-\u30FF\u3400-\u9FFF\uFF66-\uFF9F]/u;
const RE_CYRILLIC = /[\u0400-\u04FF]/u;
const RE_LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/u;

export function detectScript(text: string): SummaryV2Script {
  const t = text || '';
  if (RE_ARABIC.test(t)) return 'arabic';
  if (RE_DEVANAGARI.test(t)) return 'devanagari';
  if (RE_JAPANESE.test(t)) return 'japanese';
  if (RE_CYRILLIC.test(t)) return 'cyrillic';
  if (RE_LATIN_LETTER.test(t)) return 'latin';
  return 'unknown';
}

/**
 * Closed-class function words only (articles, prepositions, conjunctions,
 * pronouns, auxiliaries, temporal adverbs). Never occupations, employers,
 * duties or domain vocabulary.
 */
const FUNCTION_WORDS: Partial<Record<Locale, string[]>> = {
  en: [
    'the', 'and', 'with', 'for', 'from', 'that', 'this', 'currently', 'previously',
    'where', 'have', 'was', 'were', 'their', 'while', 'also', 'before',
  ],
  de: [
    'und', 'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
    'einer', 'ich', 'bei', 'mit', 'für', 'von', 'zu', 'im', 'am', 'auf', 'aus',
    'durch', 'sowie', 'nicht', 'wird', 'werden', 'war', 'habe', 'derzeit', 'zuvor',
    'wo', 'sich', 'auch', 'über', 'unter', 'zwischen',
  ],
  es: [
    'el', 'los', 'las', 'una', 'del', 'con', 'para', 'por', 'que', 'donde', 'como',
    'actualmente', 'anteriormente', 'además', 'mientras', 'sobre', 'entre', 'desde',
    'también', 'cuando',
  ],
  fr: [
    'les', 'des', 'une', 'avec', 'pour', 'dans', 'chez', 'où', 'ainsi', 'auparavant',
    'actuellement', 'aux', 'cette', 'leur', 'entre', 'depuis', 'également', 'lors',
  ],
  it: [
    'gli', 'degli', 'delle', 'della', 'dello', 'che', 'presso', 'dove', 'attualmente',
    'precedenza', 'inoltre', 'mentre', 'sulla', 'nella', 'anche', 'tra', 'sono',
  ],
  'pt-BR': [
    'dos', 'das', 'uma', 'com', 'para', 'que', 'onde', 'atualmente', 'anteriormente',
    'não', 'também', 'sobre', 'entre', 'desde', 'pela', 'pelo', 'nas', 'nos',
  ],
  sr: [
    'gde', 'kao', 'sam', 'sada', 'trenutno', 'prethodno', 'gdje', 'takođe', 'također',
    'sa', 'za', 'kod', 'nakon', 'pored', 'među',
  ],
  hr: [
    'gdje', 'kao', 'sam', 'trenutno', 'prethodno', 'također', 'sa', 'za', 'kod',
    'nakon', 'pored', 'među',
  ],
  ru: [
    'и', 'в', 'на', 'с', 'по', 'для', 'где', 'сейчас', 'ранее', 'также', 'при',
    'что', 'как', 'из', 'от',
  ],
};

/** Diacritic signatures that are near-exclusive to one Latin-script locale. */
const DIACRITIC_SIGNATURES: Partial<Record<Locale, RegExp>> = {
  de: /[äöüß]/u,
  es: /[ñ¿¡]/u,
  'pt-BR': /[ãõ]/u,
  fr: /[œùû]/u,
  sr: /[čćžšđ]/u,
  hr: /[čćžšđ]/u,
};

function wordsOf(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .split(/[^\p{L}\p{M}']+/u)
    .filter(Boolean);
}

/**
 * Detect the dominant locale of a text run. Script decides first; Latin-script
 * texts are scored by distinctive closed-class markers and diacritics.
 */
export function detectDominantLocale(text: string): SummaryV2LocaleDetection {
  const raw = (text || '').trim();
  const script = detectScript(raw);
  const markersByLocale: Record<string, string[]> = {};
  if (!raw) {
    return { locale: null, script: 'unknown', confidence: 'none', markersByLocale };
  }
  if (script === 'arabic') return { locale: 'ar', script, confidence: 'high', markersByLocale };
  if (script === 'devanagari') return { locale: 'hi', script, confidence: 'high', markersByLocale };
  if (script === 'japanese') return { locale: 'ja', script, confidence: 'high', markersByLocale };

  const words = wordsOf(raw);
  const wordSet = new Set(words);
  const scores = new Map<Locale, number>();

  const candidates: Locale[] = script === 'cyrillic'
    ? ['ru']
    : ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'sr', 'hr'];

  for (const locale of candidates) {
    const hits: string[] = [];
    for (const w of FUNCTION_WORDS[locale] || []) {
      if (wordSet.has(w)) hits.push(w);
    }
    const sig = DIACRITIC_SIGNATURES[locale];
    if (sig && sig.test(raw)) hits.push('diacritic_signature');
    if (hits.length) {
      markersByLocale[locale] = hits;
      // Diacritic signature is worth two plain function-word hits.
      scores.set(locale, hits.length + (sig && sig.test(raw) ? 1 : 0));
    }
  }

  if (script === 'cyrillic') {
    return { locale: 'ru', script, confidence: 'high', markersByLocale };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    return { locale: null, script, confidence: 'none', markersByLocale };
  }
  const [topLocale, topScore] = ranked[0];
  const runnerUp = ranked.find(([l]) => !localesAreDetectionCompatible(l, topLocale));
  const runnerScore = runnerUp ? runnerUp[1] : 0;
  const decisive = topScore >= 2 && topScore > runnerScore;
  return {
    locale: topLocale,
    script,
    confidence: decisive ? 'high' : 'low',
    markersByLocale,
  };
}

/**
 * Authoritative source locale for a text run.
 *
 * Declared metadata wins unless detection is high-confidence and incompatible —
 * that override is what catches stale `contentLocale` after a locale switch.
 */
export function resolveSourceLocaleForText(options: {
  text: string;
  declaredLocale?: Locale | null;
  fallbackLocale: Locale;
}): { sourceLocale: Locale; resolvedFrom: 'detected' | 'declared' | 'fallback' } {
  const detection = detectDominantLocale(options.text);
  const declared = options.declaredLocale || null;
  if (
    detection.confidence === 'high'
    && detection.locale
    && !localesAreDetectionCompatible(detection.locale, declared)
  ) {
    return { sourceLocale: detection.locale, resolvedFrom: 'detected' };
  }
  if (declared) return { sourceLocale: declared, resolvedFrom: 'declared' };
  if (detection.locale) return { sourceLocale: detection.locale, resolvedFrom: 'detected' };
  return { sourceLocale: options.fallbackLocale, resolvedFrom: 'fallback' };
}

export type SummaryV2LocalePurityResult = {
  targetLocalePurityPassed: boolean;
  sourceLanguageLeakageDetected: boolean;
  unexpectedLocaleCodes: Locale[];
  leakageTokens: string[];
  wrongLocaleUnitCount: number;
  wrongScriptUnitCount: number;
  detectedLocaleByUnit: string[];
  detectedScriptByUnit: string[];
};

function splitUnits(text: string): string[] {
  return (text || '')
    .split(/(?<=[.!?。؟।])\s+/u)
    .map((u) => u.trim())
    .filter(Boolean);
}

function stripEntityStrings(text: string, entities: string[]): string {
  let out = text || '';
  for (const raw of entities) {
    const e = (raw || '').trim();
    if (e.length < 2) continue;
    out = out.split(e).join(' ');
  }
  return out;
}

/**
 * Measure whether a finalized candidate is pure in the requested target locale.
 *
 * Entity strings (employer / role labels owned by the snapshot) are removed
 * before measurement: a user-authored proper noun is not language leakage.
 */
export function evaluateTargetLocalePurity(options: {
  text: string;
  targetLocale: Locale;
  entityStrings?: string[];
}): SummaryV2LocalePurityResult {
  const targetScript = scriptForLocale(options.targetLocale);
  const entities = options.entityStrings || [];
  const units = splitUnits(options.text);
  const detectedLocaleByUnit: string[] = [];
  const detectedScriptByUnit: string[] = [];
  const unexpected = new Set<Locale>();
  const leakageTokens = new Set<string>();
  let wrongLocaleUnitCount = 0;
  let wrongScriptUnitCount = 0;

  for (const unit of units) {
    const measurable = stripEntityStrings(unit, entities);
    const detection = detectDominantLocale(measurable);
    const unitLocale = detection.locale || options.targetLocale;
    const unitScript = detection.script === 'unknown' ? targetScript : detection.script;
    detectedLocaleByUnit.push(unitLocale);
    detectedScriptByUnit.push(unitScript === 'latin' ? 'latin' : 'native');

    if (
      detection.confidence === 'high'
      && detection.locale
      && !localesAreDetectionCompatible(detection.locale, options.targetLocale)
    ) {
      wrongLocaleUnitCount += 1;
      unexpected.add(detection.locale);
      for (const m of detection.markersByLocale[detection.locale] || []) leakageTokens.add(m);
    }

    // Script mismatch for non-Latin targets: any substantive Latin run that is
    // not an owned entity is source-language leakage.
    if (targetScript !== 'latin') {
      const latinRun = measurable.match(/[A-Za-z\u00C0-\u024F]{3,}(?:\s+[A-Za-z\u00C0-\u024F]{3,})*/u);
      if (latinRun) {
        wrongScriptUnitCount += 1;
        leakageTokens.add(latinRun[0].toLowerCase());
        const latinDetection = detectDominantLocale(latinRun[0]);
        if (latinDetection.locale && latinDetection.confidence === 'high') {
          unexpected.add(latinDetection.locale);
        }
      }
    } else if (detection.script !== 'latin' && detection.script !== 'unknown') {
      wrongScriptUnitCount += 1;
      if (detection.locale) unexpected.add(detection.locale);
    }

    // Token-level leakage for same-script foreign markers that did not win the
    // unit-level vote (mixed-language sentences).
    for (const [localeKey, markers] of Object.entries(detection.markersByLocale)) {
      const foreign = localeKey as Locale;
      if (localesAreDetectionCompatible(foreign, options.targetLocale)) continue;
      if (markers.length >= 2) {
        unexpected.add(foreign);
        for (const m of markers) leakageTokens.add(m);
      }
    }
  }

  const sourceLanguageLeakageDetected = unexpected.size > 0
    || wrongLocaleUnitCount > 0
    || wrongScriptUnitCount > 0;

  return {
    targetLocalePurityPassed: !sourceLanguageLeakageDetected,
    sourceLanguageLeakageDetected,
    unexpectedLocaleCodes: [...unexpected],
    leakageTokens: [...leakageTokens].slice(0, 24),
    wrongLocaleUnitCount,
    wrongScriptUnitCount,
    detectedLocaleByUnit,
    detectedScriptByUnit,
  };
}
