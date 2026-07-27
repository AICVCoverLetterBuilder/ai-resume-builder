/**
 * Serbian/Croatian duration noun declension helpers.
 *
 * Integer years (and paucal exceptions):
 *   1 → godina, 2–4 → godine, 5+ → godina
 *   11–14 → godina (teen exception), 22–24 → godine, etc.
 *
 * Half-years (`N i po` / `N.5`) follow the whole-number part:
 *   1.5 → godine (established `jedne i po godine`)
 *   2.5–4.5 → godine
 *   5.5+ → godina (including 6.5, 10.5, 11.5, 12.5)
 *
 * Digits must allow optional decimals (`16.5`) so `\d+` alone cannot match the
 * trailing `5` inside `16.5 godine` and false-flag half-year phrasing.
 */

export const SERBIAN_DURATION_NOUN_FORM_349_REVISION =
  'serbian-duration-noun-form-349-v1' as const;

void SERBIAN_DURATION_NOUN_FORM_349_REVISION;

const YEAR_WORD_AFTER_NUMBER =
  /\b(oko|približno|sa\s+oko|s\s+oko)?\s*(jedan|jedna|jedne|dve|dvije|tri|četiri|cetiri|pet|šest|sest|sedam|osam|devet|deset|jedanaest|dvanaest|trinaest|četrnaest|cetrnaest|petnaest|šesnaest|sesnaest|sedamnaest|osamnaest|devetnaest|dvadeset|\d+(?:[.,]\d+)?)(?:\s+i\s+po)?\s+(godina|godine|godinu)\b/giu;

/** Serbian year-noun for an approximate year count (integer or half). */
export function serbianYearNounForApproxYears(
  approxYears: number,
): 'godina' | 'godine' | 'godinu' {
  void SERBIAN_DURATION_NOUN_FORM_349_REVISION;
  if (!Number.isFinite(approxYears) || approxYears <= 0) return 'godina';
  const isHalf = !Number.isInteger(approxYears)
    && Math.abs(approxYears - Math.floor(approxYears) - 0.5) < 0.01;
  const whole = isHalf ? Math.floor(approxYears) : Math.round(approxYears);
  return yearNounForWholeCount(whole, isHalf);
}

function yearNounForWholeCount(
  whole: number,
  isHalf: boolean,
): 'godina' | 'godine' | 'godinu' {
  // Established product form: "jedne i po godine" (not "godina" / "godinu").
  if (isHalf && whole === 1) return 'godine';
  const n = Math.max(0, Math.floor(Math.abs(whole)));
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'godina';
  if (mod10 === 1) return 'godina';
  if (mod10 >= 2 && mod10 <= 4) return 'godine';
  return 'godina';
}

/** @deprecated Prefer serbianYearNounForApproxYears — kept for call-site clarity. */
function yearNounForCount(n: number, isHalf = false): 'godina' | 'godine' | 'godinu' {
  if (isHalf || !Number.isInteger(n)) {
    const whole = Number.isInteger(n) ? n : Math.floor(n);
    return yearNounForWholeCount(whole, true);
  }
  return yearNounForWholeCount(n, false);
}

function countFromToken(token: string): number | null {
  const t = token.toLowerCase().normalize('NFKC').replace(/,/g, '.');
  const map: Record<string, number> = {
    jedan: 1,
    jedna: 1,
    jedne: 1,
    dve: 2,
    dvije: 2,
    tri: 3,
    četiri: 4,
    cetiri: 4,
    pet: 5,
    šest: 6,
    sest: 6,
    sedam: 7,
    osam: 8,
    devet: 9,
    deset: 10,
    jedanaest: 11,
    dvanaest: 12,
    trinaest: 13,
    četrnaest: 14,
    cetrnaest: 14,
    petnaest: 15,
    šesnaest: 16,
    sesnaest: 16,
    sedamnaest: 17,
    osamnaest: 18,
    devetnaest: 19,
    dvadeset: 20,
  };
  if (map[t] != null) return map[t];
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function matchIsHalfYear(full: string, numToken: string): boolean {
  if (/\bi\s+po\b/iu.test(full)) return true;
  const n = Number(String(numToken).replace(',', '.'));
  return Number.isFinite(n) && !Number.isInteger(n);
}

export type SerbianDurationNounFormAnalysis = {
  serbianDurationNounFormPassed: boolean;
  serbianDurationNounFormKind: 'godina' | 'godine' | 'godinu' | 'mixed' | 'none';
  serbianDurationGrammarRejectionReason: string | null;
  incorrectDurationNounForms: string[];
};

/** Analyze Serbian year-noun forms in Summary prose (privacy-safe). */
export function analyzeSerbianDurationNounForms(
  text: string,
): SerbianDurationNounFormAnalysis {
  void SERBIAN_DURATION_NOUN_FORM_349_REVISION;
  const incorrect: string[] = [];
  const kinds = new Set<'godina' | 'godine' | 'godinu'>();
  (text || '').replace(YEAR_WORD_AFTER_NUMBER, (full, _prefix, numToken, noun) => {
    const isHalf = matchIsHalfYear(full, String(numToken));
    const n = countFromToken(String(numToken));
    const nounNorm = String(noun).toLowerCase() as 'godina' | 'godine' | 'godinu';
    if (n != null) {
      kinds.add(nounNorm);
      const expected = yearNounForCount(n, isHalf);
      if (nounNorm !== expected) {
        incorrect.push(`${String(numToken).toLowerCase()}${isHalf ? ' i po' : ''} ${nounNorm}`);
      }
    }
    return full;
  });
  const passed = incorrect.length === 0;
  let kind: SerbianDurationNounFormAnalysis['serbianDurationNounFormKind'] = 'none';
  if (kinds.size === 1) kind = [...kinds][0]!;
  else if (kinds.size > 1) kind = 'mixed';
  return {
    serbianDurationNounFormPassed: passed,
    serbianDurationNounFormKind: kind,
    serbianDurationGrammarRejectionReason: passed
      ? null
      : 'serbian_duration_noun_form_invalid',
    incorrectDurationNounForms: incorrect,
  };
}

/** Fix incorrect `šest i po godine` → `šest i po godina` (and peers). */
export function normalizeSerbianDurationGrammar(text: string): string {
  if (!text) return text;
  return text.replace(YEAR_WORD_AFTER_NUMBER, (full, _prefix, numToken, noun) => {
    const isHalf = matchIsHalfYear(full, String(numToken));
    const n = countFromToken(String(numToken));
    if (n == null) return full;
    const expected = yearNounForCount(n, isHalf);
    if (String(noun).toLowerCase() === expected) return full;
    return full.replace(new RegExp(`${noun}\\s*$`, 'iu'), expected);
  });
}

export function hasIncorrectSerbianDurationGrammar(text: string): boolean {
  return !analyzeSerbianDurationNounForms(text).serbianDurationNounFormPassed;
}

/**
 * Detect malformed Serbian AI tokens produced by over-eager tense morphology
 * (e.g. adjective "razvojnim" → "razvojnila"). Does not rewrite uncommon
 * user-authored words unless they match known broken AI patterns.
 */
const MALFORMED_SR_AI_TOKEN_RE =
  /\b(razvojnila|razvojnilo|produktnila|produktnilo|razvojnimla)\b/giu;

export function hasMalformedSerbianGeneratedToken(text: string): boolean {
  return MALFORMED_SR_AI_TOKEN_RE.test(text || '');
}

/** Repair known malformed AI tokens; leave correct user wording untouched. */
export function repairMalformedSerbianGeneratedTokens(text: string): string {
  if (!text) return text;
  return text
    .replace(/\brazvojnila\b/giu, 'razvojnim')
    .replace(/\brazvojnilo\b/giu, 'razvojnim')
    .replace(/\brazvojnimla\b/giu, 'razvojnim')
    .replace(/\bproduktnila\b/giu, 'produktnim')
    .replace(/\bproduktnilo\b/giu, 'produktnim')
    // Prefer natural reformulation when the broken instrumental pair appears.
    .replace(
      /\bsa\s+produktnim\s+i\s+razvojnim\s+timovima\b/giu,
      'sa timovima za proizvod i razvoj',
    )
    .replace(
      /\bsa\s+produktnim\s+i\s+razvojnila\s+timovima\b/giu,
      'sa timovima za proizvod i razvoj',
    );
}

/**
 * Reject mixed Serbian Summary narration that combines first-person with
 * CV third-person. Present 3sg + past 3sg (current + completed roles) is OK.
 */
export function hasMixedSerbianSummaryPerspective(text: string): boolean {
  const t = text || '';
  const firstPerson = /\b\p{L}+(?:ao|ala|io|ila|eo|ela)\s+sam\b/iu.test(t)
    || /\b(?:upravljala|upravljao|pripremala|pripremao|obavljala|obavljao)\s+sam\b/iu.test(t)
    || /(?:^|[^\p{L}])ja(?=[^\p{L}]|$)/iu.test(t);
  const thirdPerson = /\b(?:koordiniše|koordinise|ažurira|azurira|obavlja|kreira|proverava|pregleda)\b/iu.test(t)
    || /\b\p{L}+(?:ao|ala|io|ila|eo|ela)\s+je\b/iu.test(t);
  return firstPerson && thirdPerson;
}

/** Collapse near-duplicate sentences in Summary prose (Latin `.` and Hindi `।`). */
export function dedupeSummarySentences(text: string): string {
  const parts = (text || '')
    .split(/(?<=[.!?…।])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) return text || '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const key = part
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    if (!key || seen.has(key)) continue;
    // Near-duplicate: one sentence contains the other after fold.
    let near = false;
    for (const prev of seen) {
      if (prev.includes(key) || key.includes(prev)) {
        if (Math.min(prev.length, key.length) >= 24) {
          near = true;
          break;
        }
      }
    }
    // Semantic employment near-dup: same company + year + employed-at clause.
    if (!near) {
      const company = part.match(/\b([A-Z][A-Za-z0-9&.-]{2,})\b/);
      const year = part.match(/\b(20\d{2})\b/);
      if (company && year && /कार्यरत|employed|works?\s+at|radi\s+u/iu.test(part)) {
        for (const prevPart of out) {
          if (
            prevPart.includes(company[1])
            && prevPart.includes(year[1])
            && /कार्यरत|employed|works?\s+at|radi\s+u/iu.test(prevPart)
          ) {
            near = true;
            break;
          }
        }
      }
    }
    if (near) continue;
    seen.add(key);
    out.push(part);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}
