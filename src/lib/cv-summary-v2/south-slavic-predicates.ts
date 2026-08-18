/**
 * Serbian / Croatian coordinated-predicate realization for Summary V2.
 * Transforms every finite predicate that shares the same grammatical subject —
 * not only the leading verb.
 */
import type { Locale } from '@/lib/i18n/translations';
import type { SummaryV2EmploymentState } from './types';
import { dutyTenseFromEmploymentState } from './tense';
import { fingerprintText } from '@/lib/cv-export-diagnostics';

export const SOUTH_SLAVIC_PREDICATE_CHAIN_386_REVISION =
  'south-slavic-predicate-chain-386-v1' as const;

export type SouthSlavicPredicateChainDiagnostics = {
  coordinatedPredicateCount: number;
  transformedCoordinatedPredicateCount: number;
  untransformedFinitePredicateCount: number;
  mixedPersonPredicateDetected: boolean;
  mixedTensePredicateDetected: boolean;
  predicateChainValidationPassed: boolean;
  predicateChainRejectionReasons: string[];
  sourcePredicateChainHash: string;
  finalPredicateChainHash: string;
};

type GenderMode = 'male' | 'female' | 'unspecified';

type PredSegment = {
  /** Conjunction before this segment (empty for the first). */
  conj: string;
  negation: string;
  verb: string;
  rest: string;
  raw: string;
};

function genderMode(gender?: string | null): GenderMode {
  if (/^(female|f|ženski|zenski|ž|z)$/i.test(String(gender || ''))) return 'female';
  if (/^(male|m|muški|muski)$/i.test(String(gender || ''))) return 'male';
  return 'unspecified';
}

function isLikelyAdjectiveOrNounEnding(token: string): boolean {
  // Prefer multi-char adjectival/nominal endings; avoid bare 2-letter traps.
  return /(?:nim|kim|skim|čkim|ćkim|jim|ovim|evim|ijim|tom|ima|ama|ost|anje|enje|acij[aeu]|encij[aeu]|ниц|ним|ким|ским|ičke|ički|ička|ičko|čne|čni|čna|čno|elemen(?:te|ata)?|materijale|dokument(?:e|aciju)?|robe|robu|prijem|primitak|napomene|evidenciju|prostor(?:u)?|ekrane|formate)$/iu
    .test(token);
}

/** Strong verbal present 3sg endings — safe for coordinated (non-lead) predicates. */
function hasStrongPresent3sgEnding(token: string): boolean {
  // A bare `-ede` ending is ambiguous in a coordinated duty: the plural noun
  // `rasporede` (layouts) is a direct object in `priprema ... i rasporede`,
  // not a second finite predicate.  Treat only unambiguous verbal endings as
  // coordinated predicates; an unknown ambiguous surface must remain intact
  // rather than be fabricated into a first-person verb.
  return /(?:uje|ira|ava|iva|ova|eva|avlja|inja|ује|ира|ава|ива|ова|ева|авља)$/u.test(token);
}

function hasLeadPresent3sgEnding(token: string): boolean {
  if (hasStrongPresent3sgEnding(token)) return true;
  // Lead bullet verbs may be short present 3sg (menja / mijenja / priprema).
  return /(?:ja|је|[aeiаеи])$/u.test(token) && token.length >= 5;
}

/** Finite SC present (3sg/1sg) or past-participle-looking verb token. */
export function isSouthSlavicFiniteVerbToken(
  token: string,
  options?: { allowLeadBareEnding?: boolean },
): boolean {
  const t = (token || '').normalize('NFKC');
  if (t.length < 4) return false;
  if (isLikelyAdjectiveOrNounEnding(t)) return false;
  if (isPresent1sg(t)) return true;
  if (isPastParticiple(t)) return true;
  if (options?.allowLeadBareEnding) return hasLeadPresent3sgEnding(t);
  return hasStrongPresent3sgEnding(t);
}

function isPresent1sg(token: string): boolean {
  // Prefer explicit 1sg verbal endings; bare -am/-em/-im are too noun-prone (prijem).
  return /(?:avam|ivam|ovam|evam|iram|ujem|ijem|šem|ćem|jam|ljam|авам|ивам|овам|евам|ирам|ујем|ијем|шем|ћем|јам|љам)$/iu
    .test(token)
    || (
      /(?:am|em|im|ам|ем|им)$/iu.test(token)
      && token.length >= 6
      && !/(?:jem|tijem|cijem|rijem|prijem|објем)$/iu.test(token)
      && !isLikelyAdjectiveOrNounEnding(token)
    );
}

function isPresent3sg(token: string, options?: { allowLeadBareEnding?: boolean }): boolean {
  if (isPresent1sg(token)) return false;
  if (isPastParticiple(token)) return false;
  if (isLikelyAdjectiveOrNounEnding(token)) return false;
  if (options?.allowLeadBareEnding) return hasLeadPresent3sgEnding(token) && token.length >= 4;
  return hasStrongPresent3sgEnding(token) && token.length >= 4;
}

function isPastParticiple(token: string): boolean {
  return /(?:ala|ao|ela|eo|ila|io|ала|ао|ела|ео|ила|ио)$/u.test(token);
}

function toPresent1sg(verb: string): string | null {
  const lower = verb.toLocaleLowerCase();
  if (isPresent1sg(lower)) return lower;
  if (isPastParticiple(lower)) return null;
  if (isLikelyAdjectiveOrNounEnding(lower)) return null;

  // -uje → -ujem (surađuje / sarađuje / koordinuje)
  if (/uje$/u.test(lower)) return `${lower.slice(0, -3)}ujem`;
  if (/ује$/u.test(lower)) return `${lower.slice(0, -3)}ујем`;
  // -ja → -jam
  if (/ja$/u.test(lower)) return `${lower.slice(0, -2)}jam`;
  if (/ја$/u.test(lower)) return `${lower.slice(0, -2)}јам`;
  // -še / -će (koordinše-like folded forms already handled via uje)
  if (/še$/u.test(lower)) return `${lower.slice(0, -2)}šem`;
  if (/ше$/u.test(lower)) return `${lower.slice(0, -2)}шем`;
  if (/će$/u.test(lower)) return `${lower.slice(0, -2)}ćem`;
  if (/ће$/u.test(lower)) return `${lower.slice(0, -2)}ћем`;
  // -ira / -ava keep stem + am
  if (/ira$/u.test(lower)) return `${lower.slice(0, -1)}am`;
  if (/ира$/u.test(lower)) return `${lower.slice(0, -1)}ам`;
  if (/ava$/u.test(lower)) return `${lower.slice(0, -1)}am`;
  if (/ава$/u.test(lower)) return `${lower.slice(0, -1)}ам`;
  if (/iva$/u.test(lower)) return `${lower.slice(0, -1)}am`;
  if (/ива$/u.test(lower)) return `${lower.slice(0, -1)}ам`;
  if (/a$/u.test(lower)) return `${lower.slice(0, -1)}am`;
  if (/а$/u.test(lower)) return `${lower.slice(0, -1)}ам`;
  if (/e$/u.test(lower)) return `${lower.slice(0, -1)}em`;
  if (/е$/u.test(lower)) return `${lower.slice(0, -1)}ем`;
  if (/i$/u.test(lower)) return `${lower}m`;
  if (/и$/u.test(lower)) return `${lower}м`;
  return null;
}

/** Re-gender an existing -ao/-eo/-io ↔ -ala/-ela/-ila participle. */
function regenderPastParticiple(lower: string, gender: GenderMode): string {
  if (gender === 'female') {
    if (/ао$/u.test(lower)) return `${lower.slice(0, -2)}ала`;
    if (/ео$/u.test(lower)) return `${lower.slice(0, -2)}ела`;
    if (/ио$/u.test(lower)) return `${lower.slice(0, -2)}ила`;
    if (/ao$/u.test(lower)) return `${lower.slice(0, -2)}ala`;
    if (/eo$/u.test(lower)) return `${lower.slice(0, -2)}ela`;
    if (/io$/u.test(lower)) return `${lower.slice(0, -2)}ila`;
    return lower;
  }
  // male / unmarked
  if (/ала$/u.test(lower)) return `${lower.slice(0, -3)}ао`;
  if (/ела$/u.test(lower)) return `${lower.slice(0, -3)}ео`;
  if (/ила$/u.test(lower)) return `${lower.slice(0, -3)}ио`;
  if (/ala$/u.test(lower)) return `${lower.slice(0, -3)}ao`;
  if (/ela$/u.test(lower)) return `${lower.slice(0, -3)}eo`;
  if (/ila$/u.test(lower)) return `${lower.slice(0, -3)}io`;
  return lower;
}

function toPastParticipleForm(verb: string, gender: GenderMode): string | null {
  const lower = verb.toLocaleLowerCase();
  if (isPastParticiple(lower)) {
    // Already past — align the participle with the selected gender.
    return regenderPastParticiple(lower, gender);
  }
  const cyr = /\p{Script=Cyrillic}/u.test(lower);
  // Normalize 1sg → 3sg-like stem first.
  let base = lower;
  if (/ujem$/u.test(base)) base = `${base.slice(0, -4)}uje`;
  else if (/ујем$/u.test(base)) base = `${base.slice(0, -4)}ује`;
  else if (/šem$/u.test(base)) base = `${base.slice(0, -3)}še`;
  else if (/шем$/u.test(base)) base = `${base.slice(0, -3)}ше`;
  else if (/ćem$/u.test(base)) base = `${base.slice(0, -3)}će`;
  else if (/ћем$/u.test(base)) base = `${base.slice(0, -3)}ће`;
  else if (/avam$/u.test(base)) base = `${base.slice(0, -2)}a`;
  else if (/авам$/u.test(base)) base = `${base.slice(0, -2)}а`;
  else if (/iram$/u.test(base)) base = `${base.slice(0, -2)}a`;
  else if (/ирам$/u.test(base)) base = `${base.slice(0, -2)}а`;
  else if (/jam$/u.test(base)) base = `${base.slice(0, -3)}ja`;
  else if (/јам$/u.test(base)) base = `${base.slice(0, -3)}ја`;
  else if (/am$/u.test(base)) base = `${base.slice(0, -2)}a`;
  else if (/ам$/u.test(base)) base = `${base.slice(0, -2)}а`;
  else if (/em$/u.test(base)) base = `${base.slice(0, -2)}e`;
  else if (/ем$/u.test(base)) base = `${base.slice(0, -2)}е`;
  else if (/im$/u.test(base) && !/(nim|kim|skim)$/iu.test(base)) base = `${base.slice(0, -1)}`;
  else if (/им$/u.test(base) && !/(ним|ким|ским)$/u.test(base)) base = `${base.slice(0, -1)}`;

  let stem: string;
  let maleEnd: string;
  let femaleEnd: string;
  if (/še$/i.test(base) || /ше$/u.test(base)) {
    stem = base.slice(0, -2);
    maleEnd = cyr ? 'сао' : 'sao';
    femaleEnd = cyr ? 'сала' : 'sala';
  } else if (/će$/i.test(base) || /ће$/u.test(base)) {
    stem = base.slice(0, -2);
    maleEnd = cyr ? 'ћао' : 'ćao';
    femaleEnd = cyr ? 'ћала' : 'ćala';
  } else if (/uje$/u.test(base) || /ује$/u.test(base)) {
    stem = base.slice(0, -3);
    maleEnd = cyr ? 'овао' : 'ovao';
    femaleEnd = cyr ? 'овала' : 'ovala';
  } else if (/[aа]$/u.test(base)) {
    stem = base.slice(0, -1);
    maleEnd = cyr ? 'ао' : 'ao';
    femaleEnd = cyr ? 'ала' : 'ala';
  } else if (/[eе]$/u.test(base)) {
    stem = base.slice(0, -1);
    maleEnd = cyr ? 'ео' : 'eo';
    femaleEnd = cyr ? 'ела' : 'ela';
  } else if (/[iи]$/u.test(base)) {
    stem = base.slice(0, -1);
    maleEnd = cyr ? 'ио' : 'io';
    femaleEnd = cyr ? 'ила' : 'ila';
  } else {
    return null;
  }
  if (gender === 'female') return `${stem}${femaleEnd}`;
  // Unspecified resolves to the unmarked (masculine) form — never `radio/la`.
  return `${stem}${maleEnd}`;
}

function parseSegments(text: string): PredSegment[] {
  const raw = (text || '').replace(/[.;。؟।]+$/u, '').trim();
  if (!raw) return [];
  const fragments = raw.split(/\s*;\s*/u).map((f) => f.trim()).filter(Boolean);
  const out: PredSegment[] = [];

  for (let fi = 0; fi < fragments.length; fi += 1) {
    const frag = fragments[fi];
    // Require whitespace around i/te so "dokumente" is never split on trailing "te".
    const parts = frag.split(/(\s*,\s+(?=\p{L})|\s+(?:i|te|и|те)\s+)/iu);
    let pendingConj = fi > 0 ? '; ' : '';
    for (const part of parts) {
      if (!part) continue;
      if (/^\s*,\s+$/u.test(part)) {
        pendingConj = ', ';
        continue;
      }
      if (/^\s+(?:i|и)\s+$/u.test(part)) {
        pendingConj = ' i ';
        continue;
      }
      if (/^\s+(?:te|те)\s+$/u.test(part)) {
        pendingConj = ' te ';
        continue;
      }
      const trimmed = part.trim();
      const m = /^(ne\s+|не\s+)?(\p{L}+)([\s\S]*)$/u.exec(trimmed);
      if (!m) {
        out.push({
          conj: pendingConj,
          negation: '',
          verb: '',
          rest: trimmed,
          raw: trimmed,
        });
        pendingConj = '';
        continue;
      }
      out.push({
        conj: pendingConj,
        negation: m[1] || '',
        verb: m[2],
        rest: m[3] || '',
        raw: trimmed,
      });
      pendingConj = '';
    }
  }
  return out;
}

function hashChain(text: string): string {
  return fingerprintText((text || '').replace(/\s+/g, ' ').trim().toLowerCase() || 'empty');
}

export function emptySouthSlavicPredicateChainDiagnostics(
  sourceText = '',
): SouthSlavicPredicateChainDiagnostics {
  const h = hashChain(sourceText);
  return {
    coordinatedPredicateCount: 0,
    transformedCoordinatedPredicateCount: 0,
    untransformedFinitePredicateCount: 0,
    mixedPersonPredicateDetected: false,
    mixedTensePredicateDetected: false,
    predicateChainValidationPassed: true,
    predicateChainRejectionReasons: [],
    sourcePredicateChainHash: h,
    finalPredicateChainHash: h,
  };
}

/**
 * Realize every coordinated finite predicate into the required Summary person/tense.
 */
export function realizeSouthSlavicPredicateChain(options: {
  bullet: string;
  locale: 'sr' | 'hr';
  employmentState: SummaryV2EmploymentState;
  gender?: string | null;
  /**
   * A Summary relative-role shell such as `gde sam` already supplies the
   * first-person completed auxiliary.  Standalone presentation bullets may
   * carry it after every coordinated predicate (`izrađivala sam …`); retain
   * the predicate and its arguments, but not that duplicated shell token.
   */
  shellSuppliesCompletedAuxiliary?: boolean;
}): { text: string; diagnostics: SouthSlavicPredicateChainDiagnostics } {
  void SOUTH_SLAVIC_PREDICATE_CHAIN_386_REVISION;
  void options.locale;
  const source = (options.bullet || '').replace(/[.;。؟।]+$/u, '').trim();
  const sourceHash = hashChain(source);
  const tense = dutyTenseFromEmploymentState(options.employmentState);
  const gender = genderMode(options.gender);
  const segments = parseSegments(source);
  if (!segments.length) {
    return {
      text: source,
      diagnostics: emptySouthSlavicPredicateChainDiagnostics(source),
    };
  }

  const finiteIdx = segments
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => {
      const lead = !s.conj || /^;\s*$/u.test(s.conj);
      return s.verb && isSouthSlavicFiniteVerbToken(s.verb, { allowLeadBareEnding: lead });
    });
  const coordinatedPredicateCount = finiteIdx.length;

  let transformed = 0;
  let untransformed = 0;
  const reasons: string[] = [];
  const realized: string[] = [];

  for (const seg of segments) {
    const lead = !seg.conj || /^;\s*$/u.test(seg.conj);
    // Source bullets often use a third-person perfective surface such as
    // `Kreirala je ...`.  The Summary shell supplies the first-person
    // auxiliary (`gde sam ...`), so keeping this immediate `je` would create
    // `sam kreirala je`.  Remove only that auxiliary; all object/modifier
    // material after it remains untouched.
    const normalizedRest = tense === 'past' && isPastParticiple(seg.verb)
      ? seg.rest.replace(
        options.shellSuppliesCompletedAuxiliary
          ? /^\s+(?:je|sam)(?=\s|$)/iu
          : /^\s+je(?=\s|$)/iu,
        '',
      )
      : seg.rest;
    if (!seg.verb || !isSouthSlavicFiniteVerbToken(seg.verb, { allowLeadBareEnding: lead })) {
      realized.push(`${seg.conj}${seg.negation}${seg.verb}${normalizedRest}`);
      continue;
    }
    let nextVerb: string | null = null;
    if (tense === 'present') {
      nextVerb = toPresent1sg(seg.verb);
    } else {
      nextVerb = toPastParticipleForm(seg.verb, gender);
    }
    if (!nextVerb) {
      untransformed += 1;
      reasons.push('unsafe_predicate_transform');
      // Keep original — mixed-person gate below will reject if others transformed.
      realized.push(`${seg.conj}${seg.negation}${seg.verb.toLocaleLowerCase()}${normalizedRest}`);
      continue;
    }
    if (nextVerb.toLocaleLowerCase() !== seg.verb.toLocaleLowerCase()
      || (tense === 'present' && isPresent1sg(nextVerb))
      || (tense === 'past' && isPastParticiple(nextVerb))) {
      transformed += 1;
    } else {
      untransformed += 1;
    }
    realized.push(
      `${seg.conj}${seg.negation}${nextVerb}${normalizedRest}`,
    );
  }

  let text = realized.join('').replace(/\s+/g, ' ').trim();
  // First token lowercased for subordinate "gdje …" bodies.
  text = text.replace(/^\p{Lu}/u, (c) => c.toLocaleLowerCase());

  const diags = analyzeSouthSlavicPredicateChainText({
    sourceText: source,
    finalText: text,
    employmentState: options.employmentState,
    coordinatedPredicateCount,
    transformedCoordinatedPredicateCount: transformed,
    untransformedFinitePredicateCount: untransformed,
    extraReasons: reasons,
    sourceHash,
  });

  // Never return mixed-person text — fall back to rejecting via diagnostics and
  // a neutral coordinated 1sg/past-only rebuild is preferred when possible.
  if (!diags.predicateChainValidationPassed
    && diags.mixedPersonPredicateDetected
    && coordinatedPredicateCount >= 2) {
    // Last-resort: drop unsafe finite tokens that stayed 3sg present while others
    // are 1sg/past — replace with object-preserving gerund-like noun phrase is
    // too meaning-changing; keep text but mark failed so callers reject.
  }

  return { text, diagnostics: diags };
}

export function analyzeSouthSlavicPredicateChainText(options: {
  sourceText: string;
  finalText: string;
  employmentState: SummaryV2EmploymentState;
  coordinatedPredicateCount?: number;
  transformedCoordinatedPredicateCount?: number;
  untransformedFinitePredicateCount?: number;
  extraReasons?: string[];
  sourceHash?: string;
  /** Summary `gde/gdje` bodies must realize first-person predicates. */
  expectFirstPerson?: boolean;
}): SouthSlavicPredicateChainDiagnostics {
  const finalText = (options.finalText || '').replace(/\s+/g, ' ').trim();
  const sourceText = (options.sourceText || '').replace(/\s+/g, ' ').trim();
  const tense = dutyTenseFromEmploymentState(options.employmentState);
  const segments = parseSegments(finalText);
  const finite = segments.filter((s) => {
    const lead = !s.conj || /^;\s*$/u.test(s.conj);
    return s.verb && isSouthSlavicFiniteVerbToken(s.verb, { allowLeadBareEnding: lead });
  });
  const coordinatedPredicateCount = options.coordinatedPredicateCount
    ?? Math.max(finite.length, parseSegments(sourceText).filter((s) => {
      const lead = !s.conj || /^;\s*$/u.test(s.conj);
      return s.verb && isSouthSlavicFiniteVerbToken(s.verb, { allowLeadBareEnding: lead });
    }).length);

  let present1 = 0;
  let present3 = 0;
  let past = 0;
  for (const s of finite) {
    const lead = !s.conj || /^;\s*$/u.test(s.conj);
    if (isPresent1sg(s.verb)) present1 += 1;
    else if (isPastParticiple(s.verb)) past += 1;
    else if (isPresent3sg(s.verb, { allowLeadBareEnding: lead })) present3 += 1;
  }

  const firstPersonShellMismatch = Boolean(options.expectFirstPerson && present3 > 0 && present1 === 0);
  const mixedPersonPredicateDetected = (present1 > 0 && present3 > 0) || firstPersonShellMismatch;
  const mixedTensePredicateDetected = (
    (tense === 'present' && past > 0 && present1 + present3 > 0)
    || (tense === 'past' && present3 > 0)
    || (past > 0 && present3 > 0)
  );

  const reasons = [...(options.extraReasons || [])];
  if (mixedPersonPredicateDetected) reasons.push('mixed_person_predicate_chain');
  if (mixedTensePredicateDetected) reasons.push('mixed_tense_predicate_chain');

  const untransformedFinitePredicateCount = options.untransformedFinitePredicateCount
    ?? present3;
  const transformedCoordinatedPredicateCount = options.transformedCoordinatedPredicateCount
    ?? Math.max(0, coordinatedPredicateCount - untransformedFinitePredicateCount);

  if (
    coordinatedPredicateCount >= 2
    && untransformedFinitePredicateCount > 0
    && transformedCoordinatedPredicateCount > 0
  ) {
    if (!reasons.includes('mixed_person_predicate_chain')) {
      reasons.push('partial_predicate_chain_transform');
    }
  }

  if (firstPersonShellMismatch) {
    reasons.push('mixed_person_predicate_chain');
  }
  if (options.expectFirstPerson
    && /\b\p{L}+(?:ala|ela|ila)\s+je(?=\s|[,.!?]|$)/iu.test(finalText)) {
    reasons.push('duplicate_past_auxiliary');
  }

  // English -ed glued onto SC stems (prijemed, primitaked, evidentiraoed, …).
  // Do not flag ordinary English past participles (related/created/prepared) that can
  // appear when live EN duties are temporarily embedded under an SR/HR shell.
  if (/(?:ava|iva|ira|uje|ao|io|ala|ila|am|em|im|tak|jem|авa|ира|ује|ао|ала|ам|ем|им)ed\b/iu.test(finalText)) {
    reasons.push('english_morphology_leakage');
  }

  const predicateChainValidationPassed = !mixedPersonPredicateDetected
    && !mixedTensePredicateDetected
    && untransformedFinitePredicateCount === 0
    && !reasons.includes('english_morphology_leakage')
    && !reasons.includes('duplicate_past_auxiliary')
    && (
      coordinatedPredicateCount <= 1
      || transformedCoordinatedPredicateCount === coordinatedPredicateCount
    );

  if (!predicateChainValidationPassed && reasons.length === 0) {
    reasons.push('predicate_chain_validation_failed');
  }

  return {
    coordinatedPredicateCount,
    transformedCoordinatedPredicateCount,
    untransformedFinitePredicateCount,
    mixedPersonPredicateDetected,
    mixedTensePredicateDetected,
    predicateChainValidationPassed,
    predicateChainRejectionReasons: [...new Set(reasons)],
    sourcePredicateChainHash: options.sourceHash || hashChain(sourceText),
    finalPredicateChainHash: hashChain(finalText),
  };
}

/** Scan Summary text clauses after gdje/gde for mixed person/tense. */
export function evaluateSouthSlavicSummaryPredicateChains(options: {
  text: string;
  locale: 'sr' | 'hr';
  hasCurrent?: boolean;
  hasPrior?: boolean;
}): SouthSlavicPredicateChainDiagnostics {
  void options.locale;
  const text = (options.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return emptySouthSlavicPredicateChainDiagnostics('');

  const clauseRe = /(?:gdje|gde)\s+(sam\s+)?([^.]+)/giu;
  let match: RegExpExecArray | null;
  const aggregated: SouthSlavicPredicateChainDiagnostics[] = [];
  while ((match = clauseRe.exec(text)) !== null) {
    const completed = Boolean(match[1]);
    const body = match[2] || '';
    aggregated.push(analyzeSouthSlavicPredicateChainText({
      sourceText: body,
      finalText: body,
      employmentState: completed ? 'completed' : 'present',
      expectFirstPerson: true,
    }));
  }

  // Shorter style may strip relative connectors — still scan duty-bearing sentences.
  if (!aggregated.length) {
    const sentences = text.split(/(?<=[.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
    for (const sentence of sentences) {
      if (!/\s+(?:i|te|и|те)\s+/iu.test(sentence) && !/,\s+\p{L}/u.test(sentence)) {
        continue;
      }
      // Drop duration-only sentences.
      if (!/(?:avam|iram|ujem|ao|ala|eo|ela|io|ila|авам|ирам|ујем|ао|ала)\b/iu.test(sentence)) {
        continue;
      }
      const completed = /\b(?:sam|сам)\b/iu.test(sentence)
        || /\b(?:radio|radila|radio\/la|radio\/la)\b/iu.test(sentence);
      // Prefer the coordinated tail after role/employer framing.
      const dutyStart = sentence.search(
        /\b(?:proverav|provjerav|evidentir|ažurir|obavlj|organiz|pregled|menja|mijenja|belež|biljež)/iu,
      );
      const tail = dutyStart >= 0 ? sentence.slice(dutyStart).trim() : sentence;
      aggregated.push(analyzeSouthSlavicPredicateChainText({
        sourceText: tail,
        finalText: tail,
        employmentState: completed ? 'completed' : 'present',
        expectFirstPerson: true,
      }));
    }
  }

  if (!aggregated.length) {
    return emptySouthSlavicPredicateChainDiagnostics(text);
  }

  const reasons = aggregated.flatMap((d) => d.predicateChainRejectionReasons);
  const mixedPerson = aggregated.some((d) => d.mixedPersonPredicateDetected);
  const mixedTense = aggregated.some((d) => d.mixedTensePredicateDetected);
  const coordinated = aggregated.reduce((n, d) => n + d.coordinatedPredicateCount, 0);
  const untransformed = aggregated.reduce((n, d) => n + d.untransformedFinitePredicateCount, 0);
  const transformed = aggregated.reduce((n, d) => n + d.transformedCoordinatedPredicateCount, 0);
  const passed = aggregated.every((d) => d.predicateChainValidationPassed)
    && !mixedPerson
    && !mixedTense;

  return {
    coordinatedPredicateCount: coordinated,
    transformedCoordinatedPredicateCount: transformed,
    untransformedFinitePredicateCount: untransformed,
    mixedPersonPredicateDetected: mixedPerson,
    mixedTensePredicateDetected: mixedTense,
    predicateChainValidationPassed: passed,
    predicateChainRejectionReasons: [...new Set(reasons)],
    sourcePredicateChainHash: hashChain(text),
    finalPredicateChainHash: hashChain(text),
  };
}
