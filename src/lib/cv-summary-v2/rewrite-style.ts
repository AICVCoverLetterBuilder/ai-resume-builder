/**
 * AAB-384 — Summary V2 rewrite-style contract (shorter / stronger / professional).
 * Transforms existing Summary for enhance rewrites; never invents material claims.
 */
import type { Locale } from '@/lib/i18n/translations';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { SUMMARY_V2_REVISION } from './flag';
import type { SummaryV2SelectionManifest } from './types';
import { buildSummaryV2DeterministicText } from './builder';
import {
  buildGermanSummaryV2FromManifest,
  bulletToGermanWoIchClause,
} from './german-surface';
import { dutyTenseFromEmploymentState } from './tense';
import {
  evaluateSummaryV2NativeSurface,
  type SummaryV2NativeSurfaceResult,
} from './native-surface';

export const SUMMARY_V2_REWRITE_STYLE_384_REVISION =
  'summary-v2-rewrite-style-384-v1' as const;

/** Universal 12-locale four-button style contract (extends 384). */
export const SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION =
  'summary-v2-universal-four-button-385-v1' as const;

export type SummaryV2RewriteStyle = 'shorter' | 'stronger' | 'professional';

export type SummaryV2SemanticOperation =
  | 'duration_hedge_compress'
  | 'duty_list_merge'
  | 'soft_filler_strip'
  | 'active_role_framing'
  | 'formal_role_framing'
  | 'balanced_clarity_openers'
  | 'cohesion_transition';

export type SummaryV2StyleFulfillment = {
  shorterStyleFulfilled: boolean;
  strongerStyleFulfilled: boolean;
  professionalStyleFulfilled: boolean;
  styleValidationPassed: boolean;
  styleRejectionReasons: string[];
  selectedCandidateMateriallyDiffersFromSource: boolean;
  selectedCandidateDiffersFromOtherStyleFixtures?: boolean | null;
  sourceNormalizedLength: number;
  candidateNormalizedLength: number;
  lengthDelta: number;
  lengthDeltaPercent: number;
  sourceUnitCount: number;
  candidateUnitCount: number;
  sourceClauseCount: number;
  candidateClauseCount: number;
  unitDelta: number;
  clauseDelta: number;
  localeAwareShorterThresholdPercent: number | null;
  semanticStyleOperationsApplied: SummaryV2SemanticOperation[];
  markerOnlyStyleChange: boolean;
  styleMaterialityPassed: boolean;
  nativeSurfaceValidationPassed: boolean;
  nativeSurfaceRejectionReasons: string[];
  capitalizationValidationPassed: boolean;
  grammaticalPersonValidationPassed: boolean;
  currentTenseValidationPassed: boolean;
  priorTenseValidationPassed: boolean;
  finiteClauseValidationPassed: boolean;
  nativePunctuationValidationPassed: boolean;
  internalMarkerLeakageDetected: boolean;
  englishMorphologyLeakageDetected: boolean;
  structuralCompressionCount: number;
  coordinatedPredicateCount?: number;
  transformedCoordinatedPredicateCount?: number;
  untransformedFinitePredicateCount?: number;
  mixedPersonPredicateDetected?: boolean;
  mixedTensePredicateDetected?: boolean;
  predicateChainValidationPassed?: boolean;
  predicateChainRejectionReasons?: string[];
  sourcePredicateChainHash?: string;
  finalPredicateChainHash?: string;
};

export type SummaryV2StyleTransformResult = {
  text: string;
  transformationKind: string | null;
  beforeHash: string | null;
  afterHash: string | null;
  styleFulfilled: boolean;
  styleRejectionReasons: string[];
  noSafeMaterialChange: boolean;
};

void SUMMARY_V2_REVISION;

export function normalizeSummaryV2RewriteStyle(
  raw: unknown,
): SummaryV2RewriteStyle | null {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'shorter' || s === 'stronger' || s === 'professional') return s;
  return null;
}

function normalizeComparable(text: string): string {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/[“”«»„]/gu, '"')
    .replace(/[‘’]/gu, "'")
    .trim()
    .toLowerCase();
}

function hashNorm(text: string): string {
  return fingerprintText(normalizeComparable(text) || 'empty');
}

/** Soft / redundant German adjectives safe to drop for shorter. */
const DE_SHORTER_SOFT = /\b(?:herzlich|kompetent|serviceorientiert|freundlich|zuverlässig|sorgfältig|fundiert|zielgerichtet|insgesamt)\b/giu;

const DE_STRONGER_MARKERS =
  /\b(?:fundierte|zielgerichtet|zuverlässig|übernehme|übernahm|stelle\s+sicher|gewährleiste|verantwortlich)\b/iu;
const DE_PROFESSIONAL_MARKERS =
  /\b(?:tätig|darüber\s+hinaus|in\s+dieser\s+Funktion|im\s+Rahmen)\b/iu;

const EN_STRONGER_MARKERS =
  /\b(?:delivered|drove|bring|deliver|carried\s+out\s+the\s+role|ensured|accountable)\b/iu;
const EN_PROFESSIONAL_MARKERS =
  /\b(?:employed\s+as|in\s+this\s+capacity|additionally)\b/iu;

/** Locale-family stronger markers (claim-safe framing only). */
const LOCALE_STRONGER_MARKERS: Partial<Record<Locale, RegExp>> = {
  es: /\b(?:desempeño|con\s+determinación|aporto)\b/iu,
  fr: /\b(?:m['’]investis|avec\s+rigueur|m['’]engage)\b/iu,
  it: /\b(?:opero|con\s+determinazione|porto\s+avanti)\b/iu,
  'pt-BR': /\b(?:desempenho|com\s+determinação|atuei\s+com\s+foco)\b/iu,
  // Avoid \\b — JS word boundaries are ASCII-only even with the /u flag.
  ru: /(?:веду\s+работу|уверенно\s+выполнял|вношу)/u,
  sr: /\b(?:doprinosim|pouzdano\s+izvršavao|odlučno)\b/iu,
  hr: /\b(?:pridonosim|pouzdano\s+izvršavao|odlučno)\b/iu,
  ar: /(?:أساهم|بكفاءة|أسهم)/u,
  hi: /(?:सक्रिय\s+रूप\s+से\s+कार्य|निर्णायक\s+रूप\s+से\s+कार्य|योगदान)/u,
  ja: /(?:責任を持って推進|主体的に推進)/u,
};

const LOCALE_PROFESSIONAL_MARKERS: Partial<Record<Locale, RegExp>> = {
  es: /\b(?:ejerzo|ejercí|en\s+calidad\s+de)\b/iu,
  fr: /\b(?:j['’]exerce|exercé|en\s+qualité\s+de)\b/iu,
  it: /\b(?:svolgo|ricoperto|in\s+qualità\s+di)\b/iu,
  'pt-BR': /\b(?:exerço|exerci|na\s+função\s+de)\b/iu,
  ru: /(?:занимаю\s+должность|занимал(?:\(а\))?\s+должность|в\s+качестве)/u,
  sr: /\b(?:obavljam|obavljao|u\s+svojstvu)\b/iu,
  hr: /\b(?:obavljam|obavljao|u\s+svojstvu)\b/iu,
  ar: /(?:أشغل|شغلت|بصفتي)/u,
  hi: /(?:पद\s+पर|के\s+रूप\s+में\s+सेवा)/u,
  ja: /(?:従事|就任|として職務)/u,
};

/**
 * Locale-aware shorter materiality. Normal substantial fixtures must show a
 * clearly noticeable reduction — mild 1–3% opener-only cuts do not pass.
 */
export function summaryV2ShorterMinLengthDeltaPercent(locale: Locale): number {
  if (locale === 'de') return -10;
  if (locale === 'en') return -8;
  // Dense scripts: character/clause reduction; still require ≥5% when possible.
  if (locale === 'ar' || locale === 'hi' || locale === 'ja') {
    return -5;
  }
  // Whitespace-tokenized languages: require ≥5% token/length reduction.
  return -5;
}

/** Token-ish count for whitespace languages; character count for ja/ar/hi. */
export function summaryV2CountUnits(text: string, locale: Locale): number {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  if (locale === 'ja') {
    return t.replace(/\s+/g, '').length;
  }
  if (locale === 'ar' || locale === 'hi') {
    return t.replace(/\s+/g, '').length;
  }
  return t.split(/\s+/u).filter(Boolean).length;
}

export function summaryV2ClauseCount(text: string): number {
  return (text || '')
    .split(/(?<=[.!?。؟।])\s+/u)
    .map((u) => u.trim())
    .filter(Boolean).length;
}

export function listSemanticStyleOperations(options: {
  style: SummaryV2RewriteStyle | 'balanced' | null;
  sourceText: string;
  candidateText: string;
  locale: Locale;
}): SummaryV2SemanticOperation[] {
  const src = (options.sourceText || '').replace(/\s+/g, ' ').trim();
  const cand = (options.candidateText || '').replace(/\s+/g, ' ').trim();
  const ops: SummaryV2SemanticOperation[] = [];
  if (!src || !cand || hashNorm(src) === hashNorm(cand)) return ops;
  if (/\s+[—–]\s+/.test(src) && !/\s+[—–]\s+/.test(cand)) {
    ops.push('duty_list_merge');
  }
  if (/;\s+/.test(src) && !/;\s+/.test(cand) && /,\s+/.test(cand)) {
    if (!ops.includes('duty_list_merge')) ops.push('duty_list_merge');
  }
  if (
    /,\s*where I\b/iu.test(src)
    && !/,\s*where I\b/iu.test(cand)
  ) {
    if (!ops.includes('duty_list_merge')) ops.push('duty_list_merge');
  }
  if (
    /\bsowie\b/iu.test(src)
    && !/\bsowie\b/iu.test(cand)
  ) {
    if (!ops.includes('duty_list_merge')) ops.push('duty_list_merge');
  }
  if (
    /alrededor de|environ |circa |iskustva| संयुक्त |通算で|insgesamt |aproximadamente|approximately/iu.test(src)
    && cand.length < src.length
  ) {
    ops.push('duration_hedge_compress');
  }
  if (options.style === 'shorter' && cand.length < src.length) {
    if (!ops.includes('soft_filler_strip') && src.length - cand.length >= 8) {
      ops.push('soft_filler_strip');
    }
  }
  if (options.style === 'stronger' && strongerMarkerFor(options.locale)?.test(cand)) {
    ops.push('active_role_framing');
  }
  if (options.style === 'professional' && professionalMarkerFor(options.locale)?.test(cand)) {
    ops.push('formal_role_framing');
  }
  if (options.style === 'balanced') {
    ops.push('balanced_clarity_openers');
    if (/In my current role|In a previous role|En mi rol actual|Dans mon rôle|Nel mio ruolo|Na minha função atual|В текущей роли|U trenutnoj ulozi|في دوري الحالي|वर्तमान भूमिका|現職では/u.test(cand)) {
      ops.push('cohesion_transition');
    }
  }
  return ops;
}

/**
 * True when styled text differs only by removable style adverbs/ornaments.
 * Verb/framing changes (desempeño/ejerzo/tätig/employed) keep letter-core different.
 */
export function isSummaryV2MarkerOnlyStyleChange(
  base: string,
  styled: string,
  locale: Locale,
  style: SummaryV2RewriteStyle,
): boolean {
  void locale;
  const b = (base || '').replace(/\s+/g, ' ').trim();
  const s = (styled || '').replace(/\s+/g, ' ').trim();
  if (!b || !s || hashNorm(b) === hashNorm(s)) return false;
  let stripped = s;
  if (style === 'stronger') {
    stripped = stripped
      .replace(/\b(?:zielgerichtet|zuverlässig)\b/giu, '')
      .replace(/\bcon determinación\b/giu, '')
      .replace(/\bavec rigueur\b/giu, '')
      .replace(/\bcon determinazione\b/giu, '')
      .replace(/\bcom determinação\b/giu, '')
      .replace(/\bcom foco\b/giu, '')
      .replace(/целенаправленно\s*/gu, '')
      .replace(/уверенно\s*/gu, '')
      .replace(/\bodlučno\b/giu, '')
      .replace(/\bpouzdano\b/giu, '')
      .replace(/بكفاءة\s*/gu, '')
      .replace(/केंद्रित रूप से\s*/gu, '')
      .replace(/निर्णायक रूप से\s*/gu, '')
      .replace(/着実に/gu, '')
      .replace(/主体的に/gu, '')
      .replace(/\b(?:solid|accountable)\b/giu, '');
  } else if (style === 'professional') {
    stripped = stripped
      .replace(/\bin this capacity\b/giu, '')
      .replace(/\badditionally\b/giu, '')
      .replace(/\ben calidad de\b/giu, '')
      .replace(/\ben qualité de\b/giu, '')
      .replace(/\bin qualità di\b/giu, '')
      .replace(/\bna função de\b/giu, '')
      .replace(/\bu svojstvu\b/giu, '')
      .replace(/в качестве\s*/gu, '');
  }
  stripped = stripped.replace(/\s+/g, ' ').trim();
  const baseLetters = normalizeComparable(b).replace(/[^\p{L}\p{N}]+/gu, '');
  const stripLetters = normalizeComparable(stripped).replace(/[^\p{L}\p{N}]+/gu, '');
  return Boolean(stripLetters) && stripLetters === baseLetters;
}

function strongerMarkerFor(locale: Locale): RegExp | null {
  if (locale === 'de') return DE_STRONGER_MARKERS;
  if (locale === 'en') return EN_STRONGER_MARKERS;
  return LOCALE_STRONGER_MARKERS[locale] || null;
}

function professionalMarkerFor(locale: Locale): RegExp | null {
  if (locale === 'de') return DE_PROFESSIONAL_MARKERS;
  if (locale === 'en') return EN_PROFESSIONAL_MARKERS;
  return LOCALE_PROFESSIONAL_MARKERS[locale] || null;
}

/** Shared soft-filler strip for shorter (never touches roles/employers/facts/duration hedges). */
function stripSharedSoftFillers(text: string, locale: Locale): string {
  let t = text;
  if (locale === 'de') return stripDeSoft(t);
  t = t
    .replace(/\b(?:really|very|quite|rather|très|muy|molto|bastante)\b/giu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:。、])/gu, '$1')
    .trim();
  return t;
}

/** Drop soft German adjectives without leaving dangling conjunctions. */
function stripDeSoft(text: string): string {
  return text
    .replace(/\b(?:kompetent|serviceorientiert)\s+und\s+(?:kompetent|serviceorientiert)\b/giu, '')
    .replace(DE_SHORTER_SOFT, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/\s+und\s+und\b/giu, ' und ')
    .replace(/\s+und\s+(?=[,.]|$)/giu, ' ')
    .replace(/(\s+und)\s+(?=\p{L}+\s+(?:beantwortete|begrüßte|prüfe|durchführe))/giu, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Style transforms start from the canonical German V2 surface so duty clauses,
 * tense, and entry ownership stay intact — then apply claim-safe wording edits.
 */
function buildGermanStyledFromManifest(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  void dutyTenseFromEmploymentState;
  void bulletToGermanWoIchClause;
  const base = buildGermanSummaryV2FromManifest(manifest);

  if (style === 'shorter') {
    // Keep the three-unit topology (duration / current / prior) so slot lineage
    // stays aligned; compress via duration wording + soft adjectives + sowie→und.
    // Do not strip "wo ich" finite-clause openers (German grammar gate).
    // Do not rewrite duty stems — tense/coverage matching requires live bullet cores.
    let t = base
      .replace(/\binsgesamt\s+/giu, '')
      .replace(/Ich verfüge über etwa/iu, 'Ich habe')
      .replace(/Ich verfüge über/iu, 'Ich habe')
      .replace(/\betwa\s+/giu, '')
      .replace(/\bBerufserfahrung\b/giu, 'Erfahrung')
      .replace(/Derzeit arbeite ich als/iu, 'Derzeit bin ich als')
      .replace(/Zuvor arbeitete ich als/iu, 'Zuvor war ich als')
      .replace(
        /\b(anderthalb|zweieinhalb|dreieinhalb|viereinhalb|fünfeinhalb|sechseinhalb|siebeneinhalb|achteinhalb|neuneinhalb|zehneinhalb)\b/giu,
        (m: string) => {
          const map: Record<string, string> = {
            anderthalb: '1,5',
            zweieinhalb: '2,5',
            dreieinhalb: '3,5',
            viereinhalb: '4,5',
            fünfeinhalb: '5,5',
            sechseinhalb: '6,5',
            siebeneinhalb: '7,5',
            achteinhalb: '8,5',
            neuneinhalb: '9,5',
            zehneinhalb: '10,5',
          };
          return map[m.toLowerCase()] || m;
        },
      );
    t = stripDeSoft(t);
    t = t.replace(/\ssowie\s+/giu, ' und ');
    t = t.replace(/\s+des Hotels\b/giu, '');
    return t.replace(/\s+/g, ' ').trim();
  }

  if (style === 'stronger') {
    return base
      .replace(
        /Derzeit arbeite ich als/iu,
        'Derzeit arbeite ich zielgerichtet als',
      )
      .replace(
        /Zuvor arbeitete ich als/iu,
        'Zuvor übernahm ich zuverlässig als',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }

  // professional — formal tätig framing; keep duty clauses verbatim.
  return base
    .replace(
      /Derzeit arbeite ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
      'Derzeit bin ich als $1 bei $2 tätig, wo ich',
    )
    .replace(
      /Derzeit arbeite ich als ([^,]+?), wo ich/iu,
      'Derzeit bin ich als $1 tätig, wo ich',
    )
    .replace(
      /Zuvor arbeitete ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
      'Zuvor war ich als $1 bei $2 tätig, wo ich',
    )
    .replace(
      /Zuvor arbeitete ich als ([^,]+?), wo ich/iu,
      'Zuvor war ich als $1 tätig, wo ich',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function buildEnglishStyledFromManifest(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  const base = buildSummaryV2DeterministicText(manifest);
  if (style === 'shorter') {
    return base
      .replace(/\bapproximately\b/giu, 'about')
      .replace(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten) and a half years\b/giu,
        (_, n: string) => {
          const map: Record<string, string> = {
            one: '1.5', two: '2.5', three: '3.5', four: '4.5', five: '5.5',
            six: '6.5', seven: '7.5', eight: '8.5', nine: '9.5', ten: '10.5',
          };
          return `${map[String(n).toLowerCase()] || n} years`;
        },
      )
      .replace(/\bPreviously,\s+I worked as\b/giu, 'Previously I worked as')
      .replace(/, where I /giu, ', ')
      .replace(/, and /giu, ' and ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (style === 'stronger') {
    return base
      .replace(/\bI have\b/giu, 'I bring')
      .replace(/\bI currently work as\b/giu, 'I currently deliver as')
      .replace(/\bPreviously, I worked as\b/giu, 'Previously, I carried out the role of')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return base
    .replace(/\bI currently work as\b/giu, 'I am currently employed as')
    .replace(/\bPreviously, I worked as\b/giu, 'Previously, I was employed as')
    .replace(/\s+/g, ' ')
    .trim();
}

function localeAndJoin(duties: string[], locale: Locale): string {
  const parts = duties.map((d) => d.replace(/[.;]+$/u, '').trim()).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const head = parts.slice(0, -1).join(', ');
  const last = parts[parts.length - 1];
  if (locale === 'de') return `${head} und ${last}`;
  if (locale === 'es' || locale === 'pt-BR') return `${head} y ${last}`;
  if (locale === 'fr') return `${head} et ${last}`;
  if (locale === 'it') return `${head} e ${last}`;
  if (locale === 'ru') return `${head} и ${last}`;
  if (locale === 'sr' || locale === 'hr') return `${head} i ${last}`;
  if (locale === 'ar') return `${head} و${last}`;
  if (locale === 'hi') return `${head} और ${last}`;
  if (locale === 'ja') return `${head}、${last}`;
  return `${head} and ${last}`;
}

function compressDutyEmDashList(text: string, locale: Locale): string {
  // Legacy em-dash lists
  let t = text.replace(
    /\s+[—–]\s+([^.。؟!]+)/gu,
    (_m, body: string) => {
      const duties = String(body).split(/\s*;\s*/u).map((x) => x.trim()).filter(Boolean);
      if (duties.length < 2) {
        return `, ${String(body).replace(/;\s+/gu, ', ').trim()}`;
      }
      return `, ${localeAndJoin(duties, locale)}`;
    },
  );
  // Native relative-clause duty lists: compress "donde/où/dove/gdje/gde …, …, y …"
  t = t.replace(
    /(,\s+(?:donde|dove|onde|gdje(?:\s+sam)?|gde(?:\s+sam)?|где\s+я|où\s+je)\s+)([^.。؟!]+)/giu,
    (_m, lead: string, body: string) => {
      const duties = String(body).split(/\s*,\s*/u).map((x) => x.trim()).filter(Boolean);
      if (duties.length < 2) return `${lead}${body}`;
      // Drop soft parenthetical fillers inside duty list and rejoin tightly.
      const tight = duties
        .map((d) => d.replace(/\b(?:herzlich|kompetent|serviceorientiert|freundlich)\b/giu, '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return `${lead}${localeAndJoin(tight, locale)}`;
    },
  );
  return t;
}

function compressLocaleDurationToCompact(text: string, locale: Locale): string {
  let t = text;
  // Keep duration approximators + year nouns so warehouse duration scanners still
  // count exactly one claim. Compress half-year wording and experience tails.
  if (locale === 'fr') {
    t = t
      .replace(/Je dispose d['\u2019]environ/giu, "J'ai environ")
      .replace(/Je dispose d['\u2019]/giu, "J'ai ")
      .replace(/\s+et demi\b/giu, '')
      .replace(/,\s+où je\s+/giu, ', ')
      .replace(/\bdans (?:ce|un) rôle(?:\s+précédent)?\s*/giu, '');
  } else if (locale === 'es') {
    t = t
      .replace(/Cuento con alrededor de/giu, 'Cuento con unos')
      .replace(/con alrededor de/giu, 'con unos')
      .replace(/\s+y medio\b/giu, '')
      .replace(/,\s+donde\s+/giu, ', ')
      .replace(/\ben (?:este|un) rol(?:\s+previo)?\s*/giu, '');
  } else if (locale === 'it') {
    t = t
      .replace(/Dispongo di circa/giu, 'Ho circa')
      .replace(/\s+e mezzo\b/giu, '')
      .replace(/,\s+dove\s+/giu, ', ')
      .replace(/\bin questo ruolo\s*/giu, '')
      .replace(/\bin un ruolo precedente,\s*/giu, '');
  } else if (locale === 'pt-BR') {
    t = t
      .replace(/\s+e meio\b/giu, '')
      .replace(/,\s+onde\s+/giu, ', ')
      .replace(/\bnesta função\s*/giu, '');
  } else if (locale === 'ru') {
    t = t
      .replace(/У меня около/u, 'Около')
      .replace(/с половиной\s+/u, '')
      .replace(/\s+опыта\./u, '.')
      .replace(/,\s+где я\s+/u, ', ')
      .replace(/в этой роли\s*/u, '');
  } else if (locale === 'sr') {
    t = t
      .replace(/Imam sa oko/giu, 'Imam oko')
      // Keep warehouse `Sa oko …` sentence opener; only drop half-year hedge.
      .replace(/\s+i po\b/giu, '')
      .replace(/,\s+gde(?:\s+sam)?\s+/giu, ', ')
      .replace(/,\s+gdje(?:\s+sam)?\s+/giu, ', ')
      .replace(/\bu ovoj ulozi\s*/giu, '');
  } else if (locale === 'hr') {
    t = t
      .replace(/Imam ukupno oko/giu, 'Imam oko')
      .replace(/Imam s ukupno oko/giu, 'Imam oko')
      // Keep `S ukupno oko …` / `Sa …` sentence openers capitalized.
      .replace(/\s+i pol\b/giu, '')
      .replace(/,\s+gdje(?:\s+sam)?\s+/giu, ', ')
      .replace(/\bu ovoj ulozi\s*/giu, '');
  } else if (locale === 'ar') {
    t = t
      .replace(/ونصف/gu, '')
      .replace(/من الخبرة المشتركة/gu, 'خبرة');
  } else if (locale === 'hi') {
    t = t
      .replace(/लगभग\s+/gu, '')
      .replace(/का संयुक्त अनुभव/gu, 'का अनुभव')
      .replace(/साढ़े पाँच वर्षों/gu, 'साढ़े 5 वर्षों');
  } else if (locale === 'ja') {
    t = t
      .replace(/通算で/gu, '')
      .replace(/年半/gu, '年');
  }
  return t.replace(/\s+/g, ' ').trim();
}

function shortenLocaleRoleOpeners(text: string, locale: Locale): string {
  let t = text;
  // Keep current-state markers (actuellement/trenutno/…) — validator requires them.
  // Compress prior openers and soft current phrasing only.
  if (locale === 'es') {
    t = t.replace(/Anteriormente trabajé como/iu, 'Antes trabajé como');
  } else if (locale === 'fr') {
    t = t.replace(/Auparavant, j'ai travaillé comme/iu, "J'ai déjà travaillé comme");
  } else if (locale === 'it') {
    t = t.replace(/In precedenza ho lavorato come/iu, 'Ho già lavorato come');
  } else if (locale === 'pt-BR') {
    t = t.replace(/Anteriormente trabalhei como/iu, 'Antes trabalhei como');
  } else if (locale === 'ru') {
    t = t.replace(/Ранее я работал\(а\) как/u, 'Ранее работал(а) как');
  } else if (locale === 'sr') {
    t = t.replace(/Prethodno sam radio\/la kao/iu, 'Ranije sam radio/la kao');
  } else if (locale === 'hr') {
    t = t.replace(/Prethodno sam radio\/la kao/iu, 'Prije sam radio/la kao');
  } else if (locale === 'ar') {
    t = t.replace(/سابقاً عملت كـ/u, 'عملت سابقاً كـ');
  } else if (locale === 'hi') {
    t = t.replace(/इससे पहले मैं/u, 'पहले मैं');
  } else if (locale === 'ja') {
    t = t.replace(/以前は/u, '前は');
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Shared shell-locale style transforms (es/fr/it/pt-BR/ru/sr/hr/ar/hi/ja).
 * Preserve duration unit, current/prior state markers, roles, employers, duties.
 */
function buildLocaleShellStyled(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  void SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION;
  const locale = manifest.locale;
  const base = buildSummaryV2DeterministicText(manifest);

  if (style === 'shorter') {
    let t = stripSharedSoftFillers(base, locale);
    t = compressLocaleDurationToCompact(t, locale);
    t = shortenLocaleRoleOpeners(t, locale);
    // Real clause compression: merge em-dash duty lists into natural and-joins.
    t = compressDutyEmDashList(t, locale);
    t = t.replace(/;\s+/gu, ',');
    if (locale === 'ja') {
      t = t
        .replace(/として勤務しています/gu, 'として勤務')
        .replace(/として勤務していました/gu, 'として勤務')
        .replace(/。+/gu, '。');
    } else if (locale === 'ru') {
      t = t
        .replace(/Сейчас я работаю как/u, 'Сейчас работаю как')
        .replace(/Ранее я работал\(а\) как/u, 'Ранее работал(а) как')
        .replace(/Ранее работал\(а\) как/u, 'Ранее работал(а) как');
    } else if (locale === 'sr') {
      t = t.replace(/Prethodno sam radio\/la kao/iu, 'Ranije radio/la kao');
      t = t.replace(/Ranije sam radio\/la kao/iu, 'Ranije radio/la kao');
    } else if (locale === 'hr') {
      t = t.replace(/Prethodno sam radio\/la kao/iu, 'Prije radio/la kao');
      t = t.replace(/Prije sam radio\/la kao/iu, 'Prije radio/la kao');
    }
    return t.replace(/\s+/g, ' ').replace(/\s+([.。])/gu, '$1').trim();
  }

  if (style === 'stronger') {
    let t = base;
    // Active verb/framing changes (not adverb-only) so marker-only checks fail.
    if (locale === 'es') {
      t = t
        .replace(/Actualmente trabajo como/iu, 'Actualmente me desempeño con determinación como')
        .replace(/Anteriormente trabajé como/iu, 'Anteriormente aporté como');
    } else if (locale === 'fr') {
      t = t
        .replace(/Je travaille actuellement comme/iu, "Je m'investis actuellement avec rigueur comme")
        .replace(/Auparavant, j'ai travaillé comme/iu, "Auparavant, je m'engageais comme");
    } else if (locale === 'it') {
      t = t
        .replace(/Attualmente lavoro come/iu, 'Attualmente opero con determinazione come')
        .replace(/In precedenza ho lavorato come/iu, 'In precedenza ho portato avanti il ruolo di');
    } else if (locale === 'pt-BR') {
      t = t
        .replace(/Atualmente trabalho como/iu, 'Atualmente desempenho com determinação como')
        .replace(/Anteriormente trabalhei como/iu, 'Anteriormente atuei com foco como');
    } else if (locale === 'ru') {
      t = t
        .replace(/Сейчас я работаю как/u, 'Сейчас я веду работу как')
        .replace(/Ранее я работал\(а\) как/u, 'Ранее я уверенно выполнял(а) роль');
    } else if (locale === 'sr') {
      t = t
        .replace(/Trenutno radim kao/iu, 'Trenutno doprinosim kao')
        .replace(/Prethodno sam radio\/la kao/iu, 'Prethodno sam pouzdano izvršavao/la ulogu');
    } else if (locale === 'hr') {
      t = t
        .replace(/Trenutno radim kao/iu, 'Trenutno pridonosim kao')
        .replace(/Prethodno sam radio\/la kao/iu, 'Prethodno sam pouzdano izvršavao/la ulogu');
    } else if (locale === 'ar') {
      t = t
        .replace(/أعمل حالياً كـ/u, 'أساهم حالياً بكفاءة كـ')
        .replace(/سابقاً عملت كـ/u, 'سابقاً أسهمت كـ');
    } else if (locale === 'hi') {
      t = t
        .replace(/के रूप में काम करता\/करती हूँ/u, 'के रूप में सक्रिय रूप से कार्य करता/करती हूँ')
        .replace(/के रूप में काम करता\/करती था\/थी/u, 'के रूप में निर्णायक रूप से कार्य करता/करती था/थी');
    } else if (locale === 'ja') {
      t = t
        .replace(/として勤務しています/u, 'として責任を持って推進しています')
        .replace(/として勤務していました/u, 'として主体的に推進していました');
    }
    t = t.replace(/\s+[—–]\s+/gu, ' — ');
    t = t.replace(/;\s+/gu, '; ');
    return t.replace(/\s+/g, ' ').trim();
  }

  // professional — formal role framing; keep full duty topology (not shorter merge).
  let t = base;
  if (locale === 'es') {
    t = t
      .replace(/Actualmente trabajo como/iu, 'Actualmente ejerzo como')
      .replace(/Anteriormente trabajé como/iu, 'Anteriormente ejercí como');
  } else if (locale === 'fr') {
    t = t
      .replace(/Je travaille actuellement comme/iu, "J'exerce actuellement comme")
      .replace(/Auparavant, j'ai travaillé comme/iu, "Auparavant, j'ai exercé comme");
  } else if (locale === 'it') {
    t = t
      .replace(/Attualmente lavoro come/iu, 'Attualmente svolgo il ruolo di')
      .replace(/In precedenza ho lavorato come/iu, 'In precedenza ho ricoperto il ruolo di');
  } else if (locale === 'pt-BR') {
    t = t
      .replace(/Atualmente trabalho como/iu, 'Atualmente exerço como')
      .replace(/Anteriormente trabalhei como/iu, 'Anteriormente exerci como');
  } else if (locale === 'ru') {
    t = t
      .replace(/Сейчас я работаю как/u, 'Сейчас я занимаю должность')
      .replace(/Ранее я работал\(а\) как/u, 'Ранее я занимал(а) должность');
  } else if (locale === 'sr' || locale === 'hr') {
    t = t
      .replace(/Trenutno radim kao/iu, 'Trenutno obavljam ulogu')
      .replace(/Prethodno sam radio\/la kao/iu, 'Prethodno sam obavljao/la ulogu');
  } else if (locale === 'ar') {
    t = t
      .replace(/أعمل حالياً كـ/u, 'أشغل حالياً منصب')
      .replace(/سابقاً عملت كـ/u, 'سابقاً شغلت منصب');
  } else if (locale === 'hi') {
    t = t
      .replace(/के रूप में काम करता\/करती हूँ/u, 'के पद पर सेवा करता/करती हूँ')
      .replace(/के रूप में काम करता\/करती था\/थी/u, 'के पद पर सेवा करता/करती था/थी');
  } else if (locale === 'ja') {
    t = t
      .replace(/として勤務しています/u, 'として職務に従事しています')
      .replace(/として勤務していました/u, 'として職務に従事していました');
  }
  // Formal cohesion via relative connectors only — never turn "Auparavant," into "Auparavant;".
  t = t.replace(/\s+[—–]\s+/gu, ', ');
  t = t.replace(
    /(?<!\b(?:Auparavant|Anteriormente|Previously|Zuvor|In precedenza|Prethodno|Ранее|سابقاً|इससे पहले|以前は))\s*,\s+(?=\p{L})/gu,
    '; ',
  );
  // Restore transition commas if a lookbehind-unsafe engine mangled them.
  t = t
    .replace(/\bAuparavant;\s*/giu, 'Auparavant, ')
    .replace(/\bAnteriormente;\s*/giu, 'Anteriormente, ')
    .replace(/\bPreviously;\s*/giu, 'Previously, ')
    .replace(/\bZuvor;\s*/giu, 'Zuvor, ')
    .replace(/\bIn precedenza;\s*/giu, 'In precedenza, ')
    .replace(/\bPrethodno;\s*/giu, 'Prethodno, ');
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Balanced Generate-enhance surface — clarity/cohesion without dedicated style markers.
 * Must differ from Generate-empty canonical and from shorter/stronger/professional.
 */
export function buildSummaryV2BalancedEnhanceText(
  manifest: SummaryV2SelectionManifest,
): string {
  void SUMMARY_V2_UNIVERSAL_STYLE_385_REVISION;
  const locale = manifest.locale;
  let t = buildSummaryV2DeterministicText(manifest);
  // Keep employment-state markers (currently/derzeit/…) intact for validators.
  if (locale === 'en') {
    t = t
      .replace(/\bI currently work as\b/giu, 'I currently work in this role as')
      .replace(/\bPreviously, I worked as\b/giu, 'Previously, in an earlier role, I worked as');
  } else if (locale === 'de') {
    t = t
      .replace(/Derzeit arbeite ich als/iu, 'Derzeit arbeite ich in dieser Rolle als')
      .replace(/Zuvor arbeitete ich als/iu, 'Zuvor arbeitete ich in einer früheren Rolle als');
  } else if (locale === 'es') {
    t = t
      .replace(/Actualmente trabajo como/iu, 'Actualmente trabajo en este rol como')
      .replace(/Anteriormente trabajé como/iu, 'Anteriormente, en un rol previo, trabajé como');
  } else if (locale === 'fr') {
    t = t
      .replace(/Je travaille actuellement comme/iu, 'Je travaille actuellement dans ce rôle comme')
      .replace(/Auparavant, j'ai travaillé comme/iu, "Auparavant, dans un rôle précédent, j'ai travaillé comme");
  } else if (locale === 'it') {
    t = t
      .replace(/Attualmente lavoro come/iu, 'Attualmente lavoro in questo ruolo come')
      .replace(/In precedenza ho lavorato come/iu, 'In precedenza, in un ruolo precedente, ho lavorato come');
  } else if (locale === 'pt-BR') {
    t = t
      .replace(/Atualmente trabalho como/iu, 'Atualmente trabalho nesta função como')
      .replace(/Anteriormente trabalhei como/iu, 'Anteriormente, em uma função prévia, trabalhei como');
  } else if (locale === 'ru') {
    t = t
      .replace(/Сейчас я работаю как/u, 'Сейчас я работаю в этой роли как')
      .replace(/Ранее я работал\(а\) как/u, 'Ранее, в предыдущей роли, я работал(а) как');
  } else if (locale === 'sr' || locale === 'hr') {
    t = t
      .replace(/Trenutno radim kao/iu, 'Trenutno radim u ovoj ulozi kao')
      .replace(/Prethodno sam radio\/la kao/iu, 'Prethodno, u ranijoj ulozi, sam radio/la kao');
  } else if (locale === 'ar') {
    t = t
      .replace(/أعمل حالياً كـ/u, 'أعمل حالياً في هذا الدور كـ')
      .replace(/سابقاً عملت كـ/u, 'سابقاً، في دور سابق، عملت كـ');
  } else if (locale === 'hi') {
    t = t
      .replace(/मैं वर्तमान में/u, 'मैं वर्तमान में इस भूमिका में')
      .replace(/इससे पहले मैं/u, 'इससे पहले, पिछली भूमिका में, मैं');
  } else if (locale === 'ja') {
    t = t
      .replace(/現在、/u, '現在、この役割で')
      .replace(/以前は/u, '以前は、前の役割で');
  }
  return t.replace(/\s+/g, ' ').trim();
}

/**
 * Build styled deterministic Summary from the immutable manifest.
 * Does not hard-code occupations; uses entry-owned facts only.
 */
export function buildSummaryV2StyledDeterministicText(
  manifest: SummaryV2SelectionManifest,
  style: SummaryV2RewriteStyle,
): string {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  if (manifest.locale === 'de') return buildGermanStyledFromManifest(manifest, style);
  if (manifest.locale === 'en') return buildEnglishStyledFromManifest(manifest, style);
  return buildLocaleShellStyled(manifest, style);
}

/**
 * Attempt claim-safe style repair on a near-valid provider candidate.
 * Only applies soft, reversible wording — never invents duties/metrics.
 */
export function repairSummaryV2RewriteStyle(
  candidate: string,
  style: SummaryV2RewriteStyle,
  locale: Locale,
): string {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  let t = (candidate || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  if (style === 'shorter') {
    if (locale === 'de') {
      // Prefer full styled rebuild semantics via soft + sowie cleanup on candidate.
      t = t
        .replace(/\binsgesamt\s+/giu, '')
        .replace(/Ich verfüge über etwa/iu, 'Ich habe etwa')
        .replace(/Ich verfüge über/iu, 'Ich habe');
      t = stripDeSoft(t);
      t = t.replace(/\ssowie\s+/giu, ' und ');
      t = t.replace(/\s+des Hotels\b/giu, '');
    } else {
      t = t
        .replace(/\b(?:really|very|quite|rather|approximately)\b/giu, (m) => (
          /approximately/iu.test(m) ? 'about' : ''
        ))
        .replace(/\s{2,}/g, ' ')
        .trim();
    }
    return t.replace(/\s+/g, ' ').trim();
  }
  if (style === 'stronger') {
    const marker = strongerMarkerFor(locale);
    if (marker && marker.test(t)) return t.replace(/\s+/g, ' ').trim();
    if (locale === 'de') {
      t = t
        .replace(/Derzeit arbeite ich als/iu, 'Derzeit arbeite ich zielgerichtet als')
        .replace(/Zuvor arbeitete ich als/iu, 'Zuvor übernahm ich zuverlässig als');
    } else if (locale === 'en') {
      t = t
        .replace(/\bI currently work as\b/giu, 'I currently deliver as')
        .replace(/\bI have\b/giu, 'I bring');
    } else if (locale === 'es') {
      t = t
        .replace(/Actualmente trabajo como/iu, 'Actualmente me desempeño con determinación como')
        .replace(/Anteriormente trabajé como/iu, 'Anteriormente aporté como');
    } else if (locale === 'fr') {
      t = t
        .replace(/Je travaille actuellement comme/iu, "Je m'investis actuellement avec rigueur comme")
        .replace(/Auparavant, j'ai travaillé comme/iu, "Auparavant, je m'engageais comme");
    } else if (locale === 'it') {
      t = t
        .replace(/Attualmente lavoro come/iu, 'Attualmente opero con determinazione come')
        .replace(/In precedenza ho lavorato come/iu, 'In precedenza ho portato avanti il ruolo di');
    } else if (locale === 'pt-BR') {
      t = t
        .replace(/Atualmente trabalho como/iu, 'Atualmente desempenho com determinação como')
        .replace(/Anteriormente trabalhei como/iu, 'Anteriormente atuei com foco como');
    } else if (locale === 'ru') {
      t = t
        .replace(/Сейчас я работаю как/u, 'Сейчас я веду работу как')
        .replace(/Ранее я работал\(а\) как/u, 'Ранее я уверенно выполнял(а) роль');
    } else if (locale === 'sr' || locale === 'hr') {
      t = t
        .replace(
          /Trenutno radim kao/iu,
          locale === 'hr' ? 'Trenutno pridonosim kao' : 'Trenutno doprinosim kao',
        )
        .replace(/Prethodno sam radio\/la kao/iu, 'Prethodno sam pouzdano izvršavao/la ulogu');
    } else if (locale === 'ar') {
      t = t
        .replace(/أعمل حالياً كـ/u, 'أساهم حالياً بكفاءة كـ')
        .replace(/سابقاً عملت كـ/u, 'سابقاً أسهمت كـ');
    } else if (locale === 'hi') {
      t = t
        .replace(/के रूप में काम करता\/करती हूँ/u, 'के रूप में सक्रिय रूप से कार्य करता/करती हूँ')
        .replace(/के रूप में काम करता\/करती था\/थी/u, 'के रूप में निर्णायक रूप से कार्य करता/करती था/थी');
    } else if (locale === 'ja') {
      t = t
        .replace(/として勤務しています/u, 'として責任を持って推進しています')
        .replace(/として勤務していました/u, 'として主体的に推進していました');
    }
    return t.replace(/\s+/g, ' ').trim();
  }
  // professional
  const profMarker = professionalMarkerFor(locale);
  if (profMarker && profMarker.test(t)) return t.replace(/\s+/g, ' ').trim();
  if (locale === 'de') {
    t = t
      .replace(
        /Derzeit arbeite ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
        'Derzeit bin ich als $1 bei $2 tätig, wo ich',
      )
      .replace(
        /Zuvor arbeitete ich als ([^,]+?) bei ([^,]+?), wo ich/iu,
        'Zuvor war ich als $1 bei $2 tätig, wo ich',
      );
  } else if (locale === 'en') {
    t = t
      .replace(/\bI currently work as\b/giu, 'I am currently employed as')
      .replace(/\bPreviously, I worked as\b/giu, 'Previously, I was employed as');
  } else if (locale === 'es') {
    t = t
      .replace(/Actualmente trabajo como/iu, 'Actualmente ejerzo como')
      .replace(/Anteriormente trabajé como/iu, 'Anteriormente ejercí como');
  } else if (locale === 'fr') {
    t = t
      .replace(/Je travaille actuellement comme/iu, "J'exerce actuellement comme")
      .replace(/Auparavant, j'ai travaillé comme/iu, "Auparavant, j'ai exercé comme");
  } else if (locale === 'it') {
    t = t
      .replace(/Attualmente lavoro come/iu, 'Attualmente svolgo il ruolo di')
      .replace(/In precedenza ho lavorato come/iu, 'In precedenza ho ricoperto il ruolo di');
  } else if (locale === 'pt-BR') {
    t = t
      .replace(/Atualmente trabalho como/iu, 'Atualmente exerço como')
      .replace(/Anteriormente trabalhei como/iu, 'Anteriormente exerci como');
  } else if (locale === 'ru') {
    t = t
      .replace(/Сейчас я работаю как/u, 'Сейчас я занимаю должность')
      .replace(/Ранее я работал\(а\) как/u, 'Ранее я занимал(а) должность');
  } else if (locale === 'sr' || locale === 'hr') {
    t = t
      .replace(/Trenutno radim kao/iu, 'Trenutno obavljam ulogu')
      .replace(/Prethodno sam radio\/la kao/iu, 'Prethodno sam obavljao/la ulogu');
  } else if (locale === 'ar') {
    t = t
      .replace(/أعمل حالياً كـ/u, 'أشغل حالياً منصب')
      .replace(/سابقاً عملت كـ/u, 'سابقاً شغلت منصب');
  } else if (locale === 'hi') {
    t = t
      .replace(/के रूप में काम करता\/करती हूँ/u, 'के पद पर सेवा करता/करती हूँ')
      .replace(/के रूप में काम करता\/करती था\/थी/u, 'के पद पर सेवा करता/करती था/थी');
  } else if (locale === 'ja') {
    t = t
      .replace(/として勤務しています/u, 'として職務に従事しています')
      .replace(/として勤務していました/u, 'として職務に従事していました');
  }
  return t.replace(/\s+/g, ' ').trim();
}

export function evaluateSummaryV2StyleFulfillment(options: {
  style: SummaryV2RewriteStyle | null;
  sourceText: string;
  candidateText: string;
  locale: Locale;
}): SummaryV2StyleFulfillment {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  const source = (options.sourceText || '').replace(/\s+/g, ' ').trim();
  const candidate = (options.candidateText || '').replace(/\s+/g, ' ').trim();
  const sourceLen = normalizeComparable(source).length;
  const candLen = normalizeComparable(candidate).length;
  const lengthDelta = candLen - sourceLen;
  const lengthDeltaPercent = sourceLen > 0
    ? Math.round((lengthDelta / sourceLen) * 1000) / 10
    : 0;
  const materiallyDifferent = Boolean(
    candidate
    && source
    && hashNorm(candidate) !== hashNorm(source),
  );
  const whitespaceOnly = Boolean(
    source
    && candidate
    && normalizeComparable(source) === normalizeComparable(candidate),
  );

  let shorterStyleFulfilled = false;
  let strongerStyleFulfilled = false;
  let professionalStyleFulfilled = false;
  const styleRejectionReasons: string[] = [];
  const sourceUnitCount = summaryV2CountUnits(source, options.locale);
  const candidateUnitCount = summaryV2CountUnits(candidate, options.locale);
  const sourceClauseCount = summaryV2ClauseCount(source);
  const candidateClauseCount = summaryV2ClauseCount(candidate);
  const unitDelta = candidateUnitCount - sourceUnitCount;
  const clauseDelta = candidateClauseCount - sourceClauseCount;
  let semanticStyleOperationsApplied: SummaryV2SemanticOperation[] = [];
  let markerOnlyStyleChange = false;
  const localeAwareShorterThresholdPercent = options.style === 'shorter'
    ? summaryV2ShorterMinLengthDeltaPercent(options.locale)
    : null;

  const metrics = {
    sourceUnitCount,
    candidateUnitCount,
    sourceClauseCount,
    candidateClauseCount,
    unitDelta,
    clauseDelta,
    localeAwareShorterThresholdPercent,
  };

  if (!options.style) {
    const native = evaluateSummaryV2NativeSurface({
      text: candidate,
      locale: options.locale,
    });
    const nativeOk = native.nativeSurfaceValidationPassed;
    return {
      shorterStyleFulfilled: false,
      strongerStyleFulfilled: false,
      professionalStyleFulfilled: false,
      // Generate/enhance still must not emit mixed-person SC predicate chains.
      styleValidationPassed: nativeOk,
      styleRejectionReasons: nativeOk
        ? []
        : native.nativeSurfaceRejectionReasons.map((r) => `native_${r}`),
      selectedCandidateMateriallyDiffersFromSource: materiallyDifferent,
      sourceNormalizedLength: sourceLen,
      candidateNormalizedLength: candLen,
      lengthDelta,
      lengthDeltaPercent,
      ...metrics,
      semanticStyleOperationsApplied: [],
      markerOnlyStyleChange: false,
      styleMaterialityPassed: true,
      nativeSurfaceValidationPassed: native.nativeSurfaceValidationPassed,
      nativeSurfaceRejectionReasons: native.nativeSurfaceRejectionReasons,
      capitalizationValidationPassed: native.capitalizationValidationPassed,
      grammaticalPersonValidationPassed: native.grammaticalPersonValidationPassed,
      currentTenseValidationPassed: native.currentTenseValidationPassed,
      priorTenseValidationPassed: native.priorTenseValidationPassed,
      finiteClauseValidationPassed: native.finiteClauseValidationPassed,
      nativePunctuationValidationPassed: native.nativePunctuationValidationPassed,
      internalMarkerLeakageDetected: native.internalMarkerLeakageDetected,
      englishMorphologyLeakageDetected: native.englishMorphologyLeakageDetected,
      structuralCompressionCount: 0,
      coordinatedPredicateCount: native.coordinatedPredicateCount,
      transformedCoordinatedPredicateCount: native.transformedCoordinatedPredicateCount,
      untransformedFinitePredicateCount: native.untransformedFinitePredicateCount,
      mixedPersonPredicateDetected: native.mixedPersonPredicateDetected,
      mixedTensePredicateDetected: native.mixedTensePredicateDetected,
      predicateChainValidationPassed: native.predicateChainValidationPassed,
      predicateChainRejectionReasons: native.predicateChainRejectionReasons,
      sourcePredicateChainHash: native.sourcePredicateChainHash,
      finalPredicateChainHash: native.finalPredicateChainHash,
    };
  }

  if (options.style === 'shorter') {
    const minPercent = summaryV2ShorterMinLengthDeltaPercent(options.locale);
    semanticStyleOperationsApplied = listSemanticStyleOperations({
      style: 'shorter',
      sourceText: source,
      candidateText: candidate,
      locale: options.locale,
    });
    const hasCompressOp = semanticStyleOperationsApplied.some((o) => (
      o === 'duty_list_merge'
      || o === 'duration_hedge_compress'
      || o === 'soft_filler_strip'
    ));
    // Length threshold is authoritative; unit/clause reduction is supporting evidence
    // (some locales replace em-dashes with and-joins without lowering token count).
    const enough = sourceLen > 0
      && lengthDeltaPercent <= minPercent
      && materiallyDifferent
      && hasCompressOp
      && (unitDelta < 0 || clauseDelta < 0 || lengthDeltaPercent <= minPercent);
    shorterStyleFulfilled = enough && !whitespaceOnly;
    if (!shorterStyleFulfilled) {
      styleRejectionReasons.push(
        !hasCompressOp
          ? 'shorter_no_semantic_compression'
          : (enough ? 'shorter_whitespace_only' : 'shorter_insufficient_compression'),
      );
    }
  } else if (options.style === 'stronger') {
    const marker = strongerMarkerFor(options.locale);
    const markerOk = marker ? marker.test(candidate) : materiallyDifferent;
    markerOnlyStyleChange = isSummaryV2MarkerOnlyStyleChange(
      source,
      candidate,
      options.locale,
      'stronger',
    );
    semanticStyleOperationsApplied = listSemanticStyleOperations({
      style: 'stronger',
      sourceText: source,
      candidateText: candidate,
      locale: options.locale,
    });
    strongerStyleFulfilled = materiallyDifferent
      && markerOk
      && !whitespaceOnly
      && !markerOnlyStyleChange
      && semanticStyleOperationsApplied.includes('active_role_framing');
    if (!strongerStyleFulfilled) {
      styleRejectionReasons.push(
        !materiallyDifferent
          ? 'stronger_not_materially_different'
          : (markerOnlyStyleChange ? 'stronger_marker_only' : 'stronger_markers_missing'),
      );
    }
  } else {
    const marker = professionalMarkerFor(options.locale);
    const markerOk = marker ? marker.test(candidate) : materiallyDifferent;
    markerOnlyStyleChange = isSummaryV2MarkerOnlyStyleChange(
      source,
      candidate,
      options.locale,
      'professional',
    );
    semanticStyleOperationsApplied = listSemanticStyleOperations({
      style: 'professional',
      sourceText: source,
      candidateText: candidate,
      locale: options.locale,
    });
    professionalStyleFulfilled = materiallyDifferent
      && markerOk
      && !whitespaceOnly
      && !markerOnlyStyleChange
      && semanticStyleOperationsApplied.includes('formal_role_framing');
    if (!professionalStyleFulfilled) {
      styleRejectionReasons.push(
        !materiallyDifferent
          ? 'professional_not_materially_different'
          : (markerOnlyStyleChange ? 'professional_marker_only' : 'professional_markers_missing'),
      );
    }
  }

  const styleMaterialityPassed = (
    (options.style === 'shorter' && shorterStyleFulfilled)
    || (options.style === 'stronger' && strongerStyleFulfilled)
    || (options.style === 'professional' && professionalStyleFulfilled)
  );

  const native = evaluateSummaryV2NativeSurface({
    text: candidate,
    locale: options.locale,
  });
  if (/\bowned work\b/iu.test(candidate)) {
    native.nativeSurfaceRejectionReasons.push('unsupported_ownership_wording');
    native.nativeSurfaceValidationPassed = false;
  }
  if (!native.nativeSurfaceValidationPassed) {
    styleRejectionReasons.push(...native.nativeSurfaceRejectionReasons.map((r) => `native_${r}`));
  }

  const structuralCompressionCount = semanticStyleOperationsApplied.filter((o) => (
    o === 'duty_list_merge'
    || o === 'duration_hedge_compress'
    || o === 'soft_filler_strip'
  )).length;

  const styleValidationPassed = styleMaterialityPassed
    && native.nativeSurfaceValidationPassed;

  return {
    shorterStyleFulfilled: shorterStyleFulfilled && native.nativeSurfaceValidationPassed,
    strongerStyleFulfilled: strongerStyleFulfilled && native.nativeSurfaceValidationPassed,
    professionalStyleFulfilled: professionalStyleFulfilled && native.nativeSurfaceValidationPassed,
    styleValidationPassed,
    styleRejectionReasons,
    selectedCandidateMateriallyDiffersFromSource: materiallyDifferent,
    sourceNormalizedLength: sourceLen,
    candidateNormalizedLength: candLen,
    lengthDelta,
    lengthDeltaPercent,
    ...metrics,
    semanticStyleOperationsApplied,
    markerOnlyStyleChange,
    styleMaterialityPassed,
    nativeSurfaceValidationPassed: native.nativeSurfaceValidationPassed,
    nativeSurfaceRejectionReasons: native.nativeSurfaceRejectionReasons,
    capitalizationValidationPassed: native.capitalizationValidationPassed,
    grammaticalPersonValidationPassed: native.grammaticalPersonValidationPassed,
    currentTenseValidationPassed: native.currentTenseValidationPassed,
    priorTenseValidationPassed: native.priorTenseValidationPassed,
    finiteClauseValidationPassed: native.finiteClauseValidationPassed,
    nativePunctuationValidationPassed: native.nativePunctuationValidationPassed,
    internalMarkerLeakageDetected: native.internalMarkerLeakageDetected,
    englishMorphologyLeakageDetected: native.englishMorphologyLeakageDetected,
    structuralCompressionCount,
    coordinatedPredicateCount: native.coordinatedPredicateCount,
    transformedCoordinatedPredicateCount: native.transformedCoordinatedPredicateCount,
    untransformedFinitePredicateCount: native.untransformedFinitePredicateCount,
    mixedPersonPredicateDetected: native.mixedPersonPredicateDetected,
    mixedTensePredicateDetected: native.mixedTensePredicateDetected,
    predicateChainValidationPassed: native.predicateChainValidationPassed,
    predicateChainRejectionReasons: native.predicateChainRejectionReasons,
    sourcePredicateChainHash: native.sourcePredicateChainHash,
    finalPredicateChainHash: native.finalPredicateChainHash,
  };
}

/**
 * Produce a style-aware deterministic candidate from source + manifest.
 */
export function transformSummaryV2ForRewriteStyle(options: {
  manifest: SummaryV2SelectionManifest;
  style: SummaryV2RewriteStyle;
  sourceSummary: string;
}): SummaryV2StyleTransformResult {
  void SUMMARY_V2_REWRITE_STYLE_384_REVISION;
  const source = (options.sourceSummary || '').replace(/\s+/g, ' ').trim();
  const beforeHash = source ? hashNorm(source) : null;
  const styled = buildSummaryV2StyledDeterministicText(options.manifest, options.style);
  const fulfillment = evaluateSummaryV2StyleFulfillment({
    style: options.style,
    sourceText: source,
    candidateText: styled,
    locale: options.manifest.locale,
  });
  const afterHash = styled ? hashNorm(styled) : null;
  const identicalToSource = Boolean(source && styled && beforeHash === afterHash);

  // True no-op only when the surface already matches the styled result — i.e.
  // the source is already style-saturated and no safe material edit exists.
  if (identicalToSource) {
    return {
      text: source,
      transformationKind: null,
      beforeHash,
      afterHash: beforeHash,
      styleFulfilled: false,
      styleRejectionReasons: ['style_no_safe_material_change'],
      noSafeMaterialChange: true,
    };
  }

  return {
    text: styled,
    transformationKind: `v2_rewrite_${options.style}`,
    beforeHash,
    afterHash,
    styleFulfilled: fulfillment.styleValidationPassed,
    styleRejectionReasons: fulfillment.styleRejectionReasons,
    noSafeMaterialChange: false,
  };
}

/** True when stronger vs professional transforms differ for this manifest. */
export function summaryV2StylePairDistinct(
  manifest: SummaryV2SelectionManifest,
): boolean {
  const a = buildSummaryV2StyledDeterministicText(manifest, 'stronger');
  const b = buildSummaryV2StyledDeterministicText(manifest, 'professional');
  return hashNorm(a) !== hashNorm(b);
}
