import type { SummaryV2EmploymentState } from './types';

/** Duty clause tense derived only from the owning entry's employmentState. */
export type SummaryV2DutyTense = 'present' | 'past';

export function dutyTenseFromEmploymentState(
  state: SummaryV2EmploymentState | undefined | null,
): SummaryV2DutyTense {
  return state === 'completed' ? 'past' : 'present';
}

const IRREGULAR_PAST: Record<string, string> = {
  be: 'was',
  have: 'had',
  do: 'did',
  make: 'made',
  write: 'wrote',
  lead: 'led',
  read: 'read',
  set: 'set',
  put: 'put',
  cut: 'cut',
  keep: 'kept',
  leave: 'left',
  build: 'built',
  send: 'sent',
  spend: 'spent',
  meet: 'met',
  get: 'got',
  take: 'took',
  give: 'gave',
  sell: 'sold',
  tell: 'told',
  find: 'found',
  hold: 'held',
  bring: 'brought',
  teach: 'taught',
  catch: 'caught',
  think: 'thought',
  feed: 'fed',
  go: 'went',
  see: 'saw',
  run: 'ran',
  come: 'came',
  begin: 'began',
  win: 'won',
  stand: 'stood',
  understand: 'understood',
  draw: 'drew',
  grow: 'grew',
  know: 'knew',
  throw: 'threw',
  drive: 'drove',
  speak: 'spoke',
  break: 'broke',
  choose: 'chose',
  freeze: 'froze',
  rise: 'rose',
  wear: 'wore',
  swear: 'swore',
};

const IRREGULAR_PAST_VALUES = new Set(Object.values(IRREGULAR_PAST));

/**
 * Base lemmas that end in the letters "ed" / look past-like but are present/base.
 * Never treat these as already-past.
 */
const BASE_ENDING_ED = new Set([
  'need',
  'feed',
  'seed',
  'weed',
  'heed',
  'bleed',
  'breed',
  'speed',
  'proceed',
  'succeed',
  'exceed',
  'bed',
  'wed',
  'shed',
  'red',
]);

function normalizeVerbToken(lemma: string): string {
  return (lemma || '').toLowerCase().trim();
}

function stripGerundToLemma(w: string): string {
  if (!(w.endsWith('ing') && w.length > 5)) return w;
  const stem = w.slice(0, -3);
  return /(?:eat|at|et|it)$/iu.test(stem) && !stem.endsWith('e') ? `${stem}e` : stem;
}

/** Pure lemma → simple past. Input must be a base lemma (not already past). */
function inflectLemmaToPast(lemma: string): string {
  const w = normalizeVerbToken(lemma);
  if (!w) return w;
  if (IRREGULAR_PAST[w]) return IRREGULAR_PAST[w];
  if (w.endsWith('e')) return `${w}d`;
  if (/[b-df-hj-np-tv-z]y$/iu.test(w)) return `${w.slice(0, -1)}ied`;
  // Monosyllable CVC doubling only (stop→stopped). Never double on
  // polysyllables like register→registered or offer→offered.
  if (
    w.length <= 4
    && /[^aeiou][aeiou][bdfglmnprst]$/iu.test(w)
    && !/[wxy]$/iu.test(w)
  ) {
    return `${w}${w[w.length - 1]}ed`;
  }
  return `${w}ed`;
}

/**
 * True when `w` is already a regular simple-past form (registered, arranged, helped).
 * Excludes short/base lookalikes (need, feed, proceed).
 */
export function isEnglishRegularPastForm(w: string): boolean {
  const token = normalizeVerbToken(w);
  if (!token || BASE_ENDING_ED.has(token)) return false;
  if (token.length >= 5 && token.endsWith('ied')) return true;
  if (token.length >= 5 && token.endsWith('ed')) return true;
  return false;
}

export function isEnglishPastVerbForm(w: string): boolean {
  const token = normalizeVerbToken(w);
  if (!token) return false;
  if (IRREGULAR_PAST_VALUES.has(token)) return true;
  return isEnglishRegularPastForm(token);
}

/**
 * Collapse malformed double-past tokens back to a single valid past form.
 * registeredd / registeredded → registered
 */
export function collapseMalformedDoublePast(w: string): string | null {
  const token = normalizeVerbToken(w);
  if (!token || token.length < 6) return null;

  let cur = token;
  for (let i = 0; i < 3; i += 1) {
    if (isEnglishPastVerbForm(cur) && !/(?:edd|edded)$/iu.test(cur)) {
      return cur === token ? null : cur;
    }
    if (cur.endsWith('edded') && cur.length > 7) {
      cur = cur.slice(0, -3); // registeredded → registered
      continue;
    }
    if (cur.endsWith('edd') && cur.length > 5) {
      cur = cur.slice(0, -1); // registeredd → registered
      continue;
    }
    if (cur.endsWith('eded') && cur.length > 6) {
      cur = cur.slice(0, -2); // registereded → registered
      continue;
    }
    break;
  }
  if (cur !== token && isEnglishPastVerbForm(cur)) return cur;

  if (token.endsWith('edd')) {
    const maybePast = token.slice(0, -1);
    if (isEnglishRegularPastForm(maybePast)) return maybePast;
  }
  if (token.endsWith('edded')) {
    const maybePast = token.slice(0, -3);
    if (isEnglishRegularPastForm(maybePast)) return maybePast;
  }
  return null;
}

/** True when token shows illegal double past inflection. */
export function isMalformedDoublePastToken(w: string): boolean {
  const token = normalizeVerbToken(w);
  if (!token) return false;
  if (/(?:edded|edd)$/iu.test(token) && !BASE_ENDING_ED.has(token)) {
    return collapseMalformedDoublePast(token) != null
      || isEnglishRegularPastForm(token.replace(/d$/u, ''))
      || isEnglishRegularPastForm(token.replace(/ded$/u, ''));
  }
  if (/[a-z]{3,}eded$/iu.test(token)) {
    const peeled = token.slice(0, -2);
    return isEnglishRegularPastForm(peeled);
  }
  return false;
}

/**
 * Peel a finite English verb token to its base lemma.
 * Already-past and 3sg present forms both reduce to the lemma.
 */
export function peelEnglishVerbToLemma(raw: string): string {
  let w = normalizeVerbToken(raw);
  if (!w) return w;
  w = stripGerundToLemma(w);

  for (const [lemma, past] of Object.entries(IRREGULAR_PAST)) {
    if (past === w) return lemma;
    if (lemma === w) return lemma;
  }

  if (BASE_ENDING_ED.has(w)) return w;

  // Regular past → lemma via round-trip against pure inflection.
  if (isEnglishRegularPastForm(w)) {
    if (w.endsWith('ied') && w.length > 4) {
      const yLemma = `${w.slice(0, -3)}y`;
      if (inflectLemmaToPast(yLemma) === w) return yLemma;
    }
    if (w.endsWith('ed')) {
      // stopped → stop (doubled consonant)
      if (w.length > 4 && w[w.length - 3] === w[w.length - 4]) {
        const doubled = w.slice(0, -3);
        if (doubled && inflectLemmaToPast(doubled) === w) return doubled;
      }
      const stem2 = w.slice(0, -2); // helped → help; registered → register
      const stem1 = w.slice(0, -1); // arranged → arrange; created → create
      const stem2Ok = Boolean(stem2) && inflectLemmaToPast(stem2) === w;
      const stem1Ok = Boolean(stem1)
        && stem1.endsWith('e')
        && inflectLemmaToPast(stem1) === w;
      if (stem1Ok && stem2Ok) {
        // Both arrang/+ed and arrange/+d make "arranged"; both register/+ed and
        // registere/+d make "registered". Prefer silent-e lemma only for stems
        // that commonly drop e (…c/g/s/z/v or …Vt/Vn/…); otherwise strip "ed".
        if (
          /[cgszv]$/iu.test(stem2)
          || /[aeiou][tnmlpkdf]$/iu.test(stem2)
        ) {
          return stem1;
        }
        return stem2;
      }
      if (stem1Ok) return stem1;
      if (stem2Ok) return stem2;
    }
  }

  // 3sg present → lemma
  if (/ies$/iu.test(w) && w.length > 4) {
    return `${w.slice(0, -3)}y`;
  }
  if (/(?:ches|shes|sses|xes|zes)$/iu.test(w)) {
    return w.replace(/es$/iu, '');
  }
  if (w.endsWith('es') && w.length > 3) {
    const stemE = w.slice(0, -1); // coordinates → coordinate
    if (stemE.endsWith('e')) return stemE;
  }
  if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) {
    return w.slice(0, -1);
  }
  return w;
}

/**
 * Inflect a bare English verb to simple past — idempotent.
 * Already-past regular/irregular forms are preserved.
 * Malformed double-past tokens collapse to a single valid past when recoverable.
 */
export function toEnglishPastVerb(lemma: string): string {
  let w = normalizeVerbToken(lemma);
  if (!w) return w;
  w = stripGerundToLemma(w);

  const collapsed = collapseMalformedDoublePast(w);
  if (collapsed) return collapsed;

  if (isEnglishPastVerbForm(w)) return w;

  const base = peelEnglishVerbToLemma(w);
  return inflectLemmaToPast(base);
}

/**
 * Convert a live Experience bullet into a finite "where I …" clause.
 * Tense comes from employmentState — never from occupation labels.
 * Already-past live duties stay past under completed; present under current.
 */
export function bulletToWhereClauseEn(
  bullet: string,
  tense: SummaryV2DutyTense = 'present',
): string {
  const s = (bullet || '').replace(/[.;]+$/u, '').trim();
  if (!s) return '';

  // Coordinated leading verbs: "Positions and secures X" / "Positioned and secured X"
  const coord = /^(\p{L}+)\s+and\s+(\p{L}+)(\b[\s\S]*)?$/u.exec(s);
  if (coord) {
    const left = peelEnglishVerbToLemma(coord[1]);
    const right = peelEnglishVerbToLemma(coord[2]);
    const rest = coord[3] || '';
    if (tense === 'present') {
      return `${left} and ${right}${rest}`;
    }
    return `${toEnglishPastVerb(left)} and ${toEnglishPastVerb(right)}${rest}`;
  }

  const first = /^(\p{L}+)(\b[\s\S]*)?$/u.exec(s);
  if (!first) {
    return s.replace(/^\p{Lu}/u, (c) => c.toLowerCase());
  }
  const lemma = peelEnglishVerbToLemma(first[1]);
  const rest = first[2] || '';
  if (tense === 'present') {
    return `${lemma}${rest}`;
  }
  return `${toEnglishPastVerb(lemma)}${rest}`;
}

/**
 * Duty text embedded in non-EN shells: keep live locale wording.
 * Never apply English past morphology (`*ed`) — that produced
 * `accoglievaed` / `dočekivaoed` on Latin-script IT/SR/HR/ES duties.
 * First-person realization happens in native-surface duty tails.
 */
export function dutyBulletForLocaleShell(
  bullet: string,
  _employmentState: SummaryV2EmploymentState,
): string {
  const raw = (bullet || '').replace(/[.;]+$/u, '').trim();
  return raw;
}

/** Scan summary text for malformed double-past duty heads (grammar reject). */
export function summaryHasMalformedDoublePast(text: string): boolean {
  const tokens = (text || '').toLowerCase().match(/\p{L}+/gu) || [];
  return tokens.some((tok) => isMalformedDoublePastToken(tok));
}
