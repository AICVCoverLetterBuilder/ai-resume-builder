/**
 * Serbian/Croatian duration noun declension helpers.
 * 1 → godina, 2–4 → godine, 5+ → godina
 */
const YEAR_WORD_AFTER_NUMBER =
  /\b(oko|približno|sa\s+oko)?\s*(jedan|jedna|jedne|dve|dvije|tri|četiri|cetiri|pet|šest|sedam|osam|devet|deset|\d+)\s+(godina|godine|godinu)\b/giu;

function yearNounForCount(n: number): 'godina' | 'godine' | 'godinu' {
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

/** Fix incorrect `četiri godina` → `četiri godine` (and peers). */
export function normalizeSerbianDurationGrammar(text: string): string {
  if (!text) return text;
  return text.replace(YEAR_WORD_AFTER_NUMBER, (full, _prefix, numToken, noun) => {
    const n = countFromToken(String(numToken));
    if (n == null) return full;
    const expected = yearNounForCount(n);
    if (String(noun).toLowerCase() === expected) return full;
    return full.replace(new RegExp(`${noun}\\s*$`, 'iu'), expected);
  });
}

export function hasIncorrectSerbianDurationGrammar(text: string): boolean {
  if (!text) return false;
  let bad = false;
  text.replace(YEAR_WORD_AFTER_NUMBER, (full, _prefix, numToken, noun) => {
    const n = countFromToken(String(numToken));
    if (n != null) {
      const expected = yearNounForCount(n);
      if (String(noun).toLowerCase() !== expected) bad = true;
    }
    return full;
  });
  return bad;
}
