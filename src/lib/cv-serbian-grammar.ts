/**
 * Serbian/Croatian duration noun declension helpers.
 * 1 → godina, 2–4 → godine, 5+ → godina
 * Half-years (N i po / N.5) always use godine.
 *
 * Digits must allow optional decimals (`16.5`) so `\d+` alone cannot match the
 * trailing `5` inside `16.5 godine` and false-flag half-year phrasing.
 */
const YEAR_WORD_AFTER_NUMBER =
  /\b(oko|približno|sa\s+oko)?\s*(jedan|jedna|jedne|dve|dvije|tri|četiri|cetiri|pet|šest|sedam|osam|devet|deset|\d+(?:\.\d+)?)(?:\s+i\s+po)?\s+(godina|godine|godinu)\b/giu;

function yearNounForCount(n: number, isHalf = false): 'godina' | 'godine' | 'godinu' {
  if (isHalf || !Number.isInteger(n)) return 'godine';
  if (n === 1) return 'godina';
  if (n >= 2 && n <= 4) return 'godine';
  return 'godina';
}

function countFromToken(token: string): number | null {
  const t = token.toLowerCase().normalize('NFKC');
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
    sedam: 7,
    osam: 8,
    devet: 9,
    deset: 10,
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

/** Fix incorrect `četiri godina` → `četiri godine` (and peers). */
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
  if (!text) return false;
  let bad = false;
  text.replace(YEAR_WORD_AFTER_NUMBER, (full, _prefix, numToken, noun) => {
    const isHalf = matchIsHalfYear(full, String(numToken));
    const n = countFromToken(String(numToken));
    if (n != null) {
      const expected = yearNounForCount(n, isHalf);
      if (String(noun).toLowerCase() !== expected) bad = true;
    }
    return full;
  });
  return bad;
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

/** Collapse near-duplicate sentences in Summary prose. */
export function dedupeSummarySentences(text: string): string {
  const parts = (text || '')
    .split(/(?<=[.!?…])\s+/)
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
    if (near) continue;
    seen.add(key);
    out.push(part);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

