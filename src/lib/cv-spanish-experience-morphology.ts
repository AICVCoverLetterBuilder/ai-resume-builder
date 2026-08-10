/**
 * AAB-314 — Spanish Experience morphology: Unicode-safe lemma extraction,
 * tense detection, and minimal tense normalization.
 *
 * JS `\b` does not treat accented letters as word characters, so patterns like
 * `\brevisó\b` fail on "Revisó". All matching here uses Unicode letter bounds.
 */
import { formatExperienceBullets, splitExperienceBullets } from './cv-canonical-facts';
import { fingerprintText } from './cv-export-diagnostics';

export const SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION =
  'spanish-experience-morphology-314-v1' as const;
export const SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION =
  'spanish-experience-tense-evidence-314-v1' as const;
export const EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION =
  'experience-nonvacuous-predicate-gate-314-v1' as const;

void SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION;
void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
void EXPERIENCE_NONVACUOUS_PREDICATE_GATE_314_REVISION;

/** Unicode-safe word boundary (ASCII `\b` fails after ó/í/á…). */
export const ES_WB = '(?<![\\p{L}\\p{N}_])';
export const ES_WE = '(?![\\p{L}\\p{N}_])';

export function esWordRe(body: string, flags = 'giu'): RegExp {
  return new RegExp(`${ES_WB}(?:${body})${ES_WE}`, flags);
}

export type SpanishMorphologyFamily =
  | 'verify'
  | 'check'
  | 'review'
  | 'coordinate'
  | 'manage'
  | 'prepare'
  | 'create'
  | 'adapt'
  | 'receive'
  | 'move'
  | 'guarantee'
  | 'approve'
  | 'supervise'
  | 'other';

export type SpanishDetectedTense = 'present' | 'past' | 'mixed' | 'unknown';

export type SpanishMorphologyLemma = {
  surface: string;
  family: SpanishMorphologyFamily;
  tense: 'present' | 'past' | 'nonfinite' | 'unknown';
  lemma: string;
};

/** Strong Spanish Experience lexical evidence (present + past + function words). */
export const ES_EXPERIENCE_LEXICON_RE = esWordRe(
  [
    'revis(?:a|o|as|an|ó|aba|aron|ar|ando|ado)?',
    'comprueb(?:a|o|as|an)',
    'comprob(?:ó|aba|aron|ar|ando|ado)?',
    'verific(?:a|ó|aba|aron|ar|ando|ado)?',
    'coordin(?:a|o|ó|aba|aron|ar|ando|ado)?',
    'colabor(?:a|ó|aba|aron|ar|ando|ado)?',
    'gestion(?:a|ó|aba|aron|ar|ando|ado)?',
    'prepar(?:a|ó|aba|aron|ar|ando|ado)?',
    'cre(?:a|ó|aba|aron|ar|ando|ado)?',
    'adapt(?:a|ó|aba|aron|ar|ando|ado)?',
    'recib(?:e|ió|ía|ieron|ir|iendo)',
    'muev(?:e|o|en)',
    'mov(?:ió|ía|ieron|er|iendo)',
    'trabaj(?:a|ó|aba|aron|ar|ando|ado)?',
    'actualiz(?:a|o|ó|aba|aron|ar|ando|ado)?',
    'experiencia',
    'clientes?',
    'mercanc[ií]a(?:s)?',
    'documentaci[oó]n',
    'almac[eé]n',
    'compa[nñ]er(?:o|a|os|as)?',
    'preparaci[oó]n',
    'movimiento',
  ].join('|'),
);

export const ES_FUNCTION_WORDS_RE = esWordRe(
  'la|el|los|las|un|una|unos|unas|con|en|del|de|sus|su|para|por|y|e|a|al|se|lo|le|les',
);

/**
 * Finite-verb conjugation table: past surface → present surface (3sg CV).
 * Order matters — longer / more specific first.
 */
const PAST_TO_PRESENT: Array<{ re: RegExp; present: string; family: SpanishMorphologyFamily }> = [
  { re: esWordRe('revisó|revisaba|revisaron'), present: 'Revisa', family: 'review' },
  { re: esWordRe('comprobó|comprobaba|comprobaron'), present: 'Comprueba', family: 'check' },
  { re: esWordRe('verificó|verificaba|verificaron'), present: 'Verifica', family: 'verify' },
  { re: esWordRe('coordinó|coordinaba|coordinaron'), present: 'Coordina', family: 'coordinate' },
  { re: esWordRe('colaboró|colaboraba|colaboraron'), present: 'Colabora', family: 'coordinate' },
  { re: esWordRe('gestionó|gestionaba|gestionaron'), present: 'Gestiona', family: 'manage' },
  { re: esWordRe('preparó|preparaba|prepararon'), present: 'Prepara', family: 'prepare' },
  { re: esWordRe('creó|creaba|crearon'), present: 'Crea', family: 'create' },
  { re: esWordRe('adaptó|adaptaba|adaptaron'), present: 'Adapta', family: 'adapt' },
  { re: esWordRe('recibió|recibía|recibieron'), present: 'Recibe', family: 'receive' },
  { re: esWordRe('movió|movía|movieron'), present: 'Mueve', family: 'move' },
  { re: esWordRe('garantizó|garantizaba|garantizaron'), present: 'Garantiza', family: 'guarantee' },
  { re: esWordRe('trabajó|trabajaba|trabajaron'), present: 'Trabaja', family: 'other' },
  { re: esWordRe('actualizó|actualizaba|actualizaron'), present: 'Actualiza', family: 'other' },
];

const PRESENT_TO_PAST: Array<{ re: RegExp; past: string; family: SpanishMorphologyFamily }> = [
  { re: esWordRe('revisa(?!r|do|ndo|ba|ron)'), past: 'Revisó', family: 'review' },
  { re: esWordRe('comprueba'), past: 'Comprobó', family: 'check' },
  { re: esWordRe('verifica(?!r|do|ndo|ba|ron)'), past: 'Verificó', family: 'verify' },
  { re: esWordRe('coordina(?!r|do|ndo|ba|ron)'), past: 'Coordinó', family: 'coordinate' },
  { re: esWordRe('colabora(?!r|do|ndo|ba|ron)'), past: 'Colaboró', family: 'coordinate' },
  { re: esWordRe('gestiona(?!r|do|ndo|ba|ron)'), past: 'Gestionó', family: 'manage' },
  { re: esWordRe('prepara(?!r|do|ndo|ba|ron)'), past: 'Preparó', family: 'prepare' },
  { re: esWordRe('crea(?!r|do|ndo|ba|ron)'), past: 'Creó', family: 'create' },
  { re: esWordRe('adapta(?!r|do|ndo|ba|ron)'), past: 'Adaptó', family: 'adapt' },
  { re: esWordRe('recibe'), past: 'Recibió', family: 'receive' },
  { re: esWordRe('mueve'), past: 'Movió', family: 'move' },
  { re: esWordRe('garantiza(?!r|do|ndo|ba|ron)'), past: 'Garantizó', family: 'guarantee' },
];

/** Predicate family patterns with Unicode-safe bounds (shared by grounding). */
export const SPANISH_PREDICATE_FAMILY_RES: Array<{
  family: SpanishMorphologyFamily;
  /** Maps to grounding SpanishPredicateFamily where names differ. */
  groundingFamily: string;
  re: RegExp;
}> = [
  {
    family: 'manage',
    groundingFamily: 'manage_docs',
    re: esWordRe(
      'gestion(?:a|ó|aba|aron|ar|ando|ado)?|administr(?:a|ó|aba|aron|ar|ando|ado)?|tramit(?:a|ó|aba|aron|ar|ando|ado)?|proces(?:a|ó|aba|aron|ar|ando|ado)?|manej(?:a|ó|aba|aron|ar|ando|ado)?',
    ),
  },
  {
    family: 'approve',
    groundingFamily: 'approve',
    re: esWordRe(
      'aprueb(?:a|o|an|as)|aprob(?:ó|aba|aron|ar|ando|ado)|autoriz(?:a|ó|aba|aron|ar|ando|ado)?|certific(?:a|ó|aba|aron|ar|ando|ado)?',
    ),
  },
  {
    family: 'supervise',
    groundingFamily: 'supervise',
    re: esWordRe('supervis(?:a|ó|aba|aron|ar|ando|ado)?|dirig(?:e|ió|ía|ieron|ir|iendo)|lider(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'guarantee',
    groundingFamily: 'guarantee',
    re: esWordRe('garantiz(?:a|ó|aba|aron|ar|ando|ado)?|asegur(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'receive',
    groundingFamily: 'receive',
    re: esWordRe('recib(?:e|ió|ía|ieron|ir|iendo)'),
  },
  {
    family: 'move',
    groundingFamily: 'move',
    re: esWordRe('muev(?:e|o|en)|mov(?:ió|ía|ieron|er|iendo|ido)?|traslad(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'prepare',
    groundingFamily: 'prepare',
    re: esWordRe('prepar(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'create',
    groundingFamily: 'create',
    re: esWordRe('cre(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'adapt',
    groundingFamily: 'adapt',
    re: esWordRe('adapt(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'coordinate',
    groundingFamily: 'coordinate',
    re: esWordRe('coordin(?:a|o|ó|aba|aron|ar|ando|ado)?|colabor(?:a|o|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'check',
    groundingFamily: 'verify',
    re: esWordRe('comprueb(?:a|o|as|an)|comprob(?:ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'review',
    groundingFamily: 'verify',
    re: esWordRe('revis(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
  {
    family: 'verify',
    groundingFamily: 'verify',
    re: esWordRe('verific(?:a|ó|aba|aron|ar|ando|ado)?|inspeccion(?:a|ó|aba|aron|ar|ando|ado)?|control(?:a|ó|aba|aron|ar|ando|ado)?'),
  },
];

function classifySurfaceTense(surface: string): SpanishMorphologyLemma['tense'] {
  const s = (surface || '').toLowerCase();
  if (/(?:ó|ió|ieron|aba|ían|aron)$/u.test(s) || /(?:ó|ió)$/u.test(s)) return 'past';
  if (/(?:ando|iendo|ado|ido|ar|er|ir)$/u.test(s)) return 'nonfinite';
  if (/(?:a|e|o|an|en|as|es)$/u.test(s)) return 'present';
  return 'unknown';
}

export function extractSpanishMorphologyLemmas(unit: string): SpanishMorphologyLemma[] {
  void SPANISH_EXPERIENCE_MORPHOLOGY_314_REVISION;
  const text = unit || '';
  const found: SpanishMorphologyLemma[] = [];
  const seen = new Set<string>();
  for (const entry of SPANISH_PREDICATE_FAMILY_RES) {
    entry.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = entry.re.exec(text)) !== null) {
      const surface = (m[0] || '').trim();
      if (!surface) continue;
      const key = `${entry.family}:${surface.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        surface,
        family: entry.family,
        tense: classifySurfaceTense(surface),
        lemma: entry.family,
      });
    }
  }
  return found;
}

export function textLooksSpanishExperience(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (ES_EXPERIENCE_LEXICON_RE.test(t)) return true;
  if (/[áéíóúñüÁÉÍÓÚÑÜ¿¡]/.test(t) && ES_FUNCTION_WORDS_RE.test(t)) return true;
  const lemmas = extractSpanishMorphologyLemmas(t);
  if (lemmas.length > 0 && ES_FUNCTION_WORDS_RE.test(t)) return true;
  return false;
}

export function analyzeSpanishExperienceUnitTense(unit: string): SpanishDetectedTense {
  const lemmas = extractSpanishMorphologyLemmas(unit).filter(
    (l) => l.tense === 'present' || l.tense === 'past',
  );
  if (lemmas.length === 0) return 'unknown';
  const past = lemmas.filter((l) => l.tense === 'past').length;
  const present = lemmas.filter((l) => l.tense === 'present').length;
  if (past > 0 && present > 0) return 'mixed';
  if (past > 0) return 'past';
  if (present > 0) return 'present';
  return 'unknown';
}

export type SpanishExperienceTenseAnalysis = {
  revision: typeof SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  expectedEmploymentTense: 'present' | 'past';
  sourceDetectedTense: SpanishDetectedTense;
  candidateDetectedTense: SpanishDetectedTense;
  sourcePastUnitCount: number;
  sourcePresentUnitCount: number;
  sourceTenseMismatchCount: number;
  candidatePresentUnitCount: number;
  candidatePastUnitCount: number;
  candidateTenseMismatchCount: number;
  mismatchedSourceUnitHashes: string[];
  wrongTenseFixedUnitCount: number;
  tenseOnlyCorrectionLikely: boolean;
};

export function analyzeSpanishExperienceTenseAlignment(options: {
  sourceText: string;
  candidateText?: string;
  isPresent: boolean;
}): SpanishExperienceTenseAnalysis {
  void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  const expected: 'present' | 'past' = options.isPresent ? 'present' : 'past';
  const sourceUnits = splitExperienceBullets(options.sourceText || '').filter(Boolean);
  const candUnits = splitExperienceBullets(options.candidateText || '').filter(Boolean);
  const mismatched: string[] = [];
  let sourcePast = 0;
  let sourcePresent = 0;
  let sourceMismatch = 0;
  for (const u of sourceUnits) {
    const t = analyzeSpanishExperienceUnitTense(u);
    if (t === 'past') sourcePast += 1;
    if (t === 'present') sourcePresent += 1;
    if (t !== 'unknown' && t !== 'mixed' && t !== expected) {
      sourceMismatch += 1;
      mismatched.push(fingerprintText(u.trim()));
    }
  }
  let candPast = 0;
  let candPresent = 0;
  let candMismatch = 0;
  for (const u of candUnits) {
    const t = analyzeSpanishExperienceUnitTense(u);
    if (t === 'past') candPast += 1;
    if (t === 'present') candPresent += 1;
    if (t !== 'unknown' && t !== 'mixed' && t !== expected) candMismatch += 1;
  }
  const sourceOverall: SpanishDetectedTense = sourcePast > 0 && sourcePresent > 0
    ? 'mixed'
    : (sourcePast > 0 ? 'past' : (sourcePresent > 0 ? 'present' : 'unknown'));
  const candOverall: SpanishDetectedTense = candPast > 0 && candPresent > 0
    ? 'mixed'
    : (candPast > 0 ? 'past' : (candPresent > 0 ? 'present' : 'unknown'));
  const fixed = Math.max(0, sourceMismatch - candMismatch);
  return {
    revision: SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION,
    expectedEmploymentTense: expected,
    sourceDetectedTense: sourceOverall,
    candidateDetectedTense: candOverall,
    sourcePastUnitCount: sourcePast,
    sourcePresentUnitCount: sourcePresent,
    sourceTenseMismatchCount: sourceMismatch,
    candidatePresentUnitCount: candPresent,
    candidatePastUnitCount: candPast,
    candidateTenseMismatchCount: candMismatch,
    mismatchedSourceUnitHashes: mismatched,
    wrongTenseFixedUnitCount: fixed,
    tenseOnlyCorrectionLikely: sourceMismatch > 0 && candMismatch === 0,
  };
}

function normalizeUnitTense(unit: string, toPresent: boolean): string {
  let out = (unit || '').trim();
  if (!out) return out;
  const table = toPresent ? PAST_TO_PRESENT : PRESENT_TO_PAST;
  for (const entry of table) {
    entry.re.lastIndex = 0;
    out = out.replace(entry.re, (match) => {
      const replacement = toPresent
        ? (entry as { present: string }).present
        : (entry as { past: string }).past;
      // Preserve leading case of the match's first letter when mid-sentence.
      if (/^[a-záéíóúñü]/u.test(match) && !/^[.!?…]/.test(out.slice(0, 1))) {
        return replacement.charAt(0).toLowerCase() + replacement.slice(1);
      }
      return replacement;
    });
  }
  // "Revisó y adaptó" → after first replace may still have past on second verb.
  for (const entry of table) {
    entry.re.lastIndex = 0;
    out = out.replace(entry.re, toPresent
      ? (entry as { present: string }).present
      : (entry as { past: string }).past);
  }
  return out;
}

/**
 * Minimal deterministic tense normalizer — preserves wording/facts; only conjugations.
 */
export function normalizeSpanishExperienceTenseOnly(options: {
  sourceText: string;
  isPresent: boolean;
}): {
  text: string;
  changed: boolean;
  analysis: SpanishExperienceTenseAnalysis;
  tenseOnlySourceLength: number;
  tenseOnlyCandidateLength: number;
  tenseOnlyUnexpectedExpansionDetected: boolean;
  tenseOnlyPreservationPassed: boolean;
} {
  void SPANISH_EXPERIENCE_TENSE_EVIDENCE_314_REVISION;
  const source = (options.sourceText || '').trim();
  const units = splitExperienceBullets(source).filter(Boolean);
  const toPresent = options.isPresent !== false;
  const normalized = units.map((u) => normalizeUnitTense(u, toPresent));
  const text = formatExperienceBullets(normalized.map((u) => {
    let row = u.trim();
    if (row && !/[.!?]$/u.test(row)) row = `${row}.`;
    return row;
  }));
  const analysis = analyzeSpanishExperienceTenseAlignment({
    sourceText: source,
    candidateText: text,
    isPresent: options.isPresent,
  });
  const srcLen = source.replace(/\s+/g, ' ').trim().length;
  const candLen = text.replace(/\s+/g, ' ').trim().length;
  const expansion = candLen - srcLen;
  // Allow small punctuation/capitalization delta only.
  const unexpected = expansion > Math.max(24, Math.floor(srcLen * 0.12));
  const sameUnitCount = splitExperienceBullets(text).filter(Boolean).length === units.length;
  const changed = text.replace(/\s+/g, ' ').trim() !== source.replace(/\s+/g, ' ').trim();
  return {
    text,
    changed,
    analysis,
    tenseOnlySourceLength: srcLen,
    tenseOnlyCandidateLength: candLen,
    tenseOnlyUnexpectedExpansionDetected: unexpected,
    tenseOnlyPreservationPassed: sameUnitCount && !unexpected && analysis.candidateTenseMismatchCount === 0,
  };
}

export function unitHasIncompleteSpanishSurface(unit: string): boolean {
  const u = (unit || '').trim();
  if (!u) return true;
  if (/(?:^|\s)(?:el|la|los|las|un|una|cada|de|con|a|para|y)\s*[.,;:!?]?$/iu.test(u)) return true;
  if (/\bcada\s+de\b/iu.test(u)) return true;
  if (!extractSpanishMorphologyLemmas(u).some((l) => l.tense === 'present' || l.tense === 'past')) {
    // Incomplete only when no finite predicate and looks truncated.
    if (u.length < 12 || /[…]$/.test(u)) return true;
  }
  return false;
}

export function countIncompleteSpanishUnits(text: string): number {
  return splitExperienceBullets(text || '').filter(Boolean)
    .filter((u) => unitHasIncompleteSpanishSurface(u)).length;
}
