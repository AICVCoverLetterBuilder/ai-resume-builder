/**
 * Detect internal/meta fallback language that must never appear in user-facing CV text.
 */
const META_FALLBACK_PATTERNS: RegExp[] = [
  /\bstated in the role duties\b/iu,
  /\bmentioned in the source\b/iu,
  /\bas described in the responsibilit/iu,
  /\baccording to the provided dut/iu,
  /\bbased on the canonical facts?\b/iu,
  /\bas listed above\b/iu,
  /\bwhich are stated in the role dut/iu,
  /\bin the (?:source|canonical) (?:bullets?|duties|facts?)\b/iu,
  /\bgemäß den Aufgaben\b/iu,
  /\bindicados? en las funciones\b/iu,
  /\bprévues dans les missions\b/iu,
  /\bpreviste nei compiti\b/iu,
  /\bالواردة في المهام\b/u,
  /\bindicados nas funções\b/iu,
  /\b職務に示された\b/u,
  /जो भूमिका के कर्तव्यों में बताई गई हैं/u,
  /जैसा कि जिम्मेदारियों में उल्लेख/u,
  /दिए गए विवरण के अनुसार/u,
  /भूमिका के कर्तव्यों/u,
  /canonical\s+fact/iu,
  /grounding\s+(?:note|fact|duty)/iu,
  /fallback\s+(?:template|duty|bullet)/iu,
  /validator\b/iu,
  /SOURCE BULLETS/iu,
  /FACT LOCK/iu,
];

export function hasCvMetaFallbackText(text: string): boolean {
  const t = (text || '').normalize('NFKC');
  if (!t.trim()) return false;
  return META_FALLBACK_PATTERNS.some((re) => re.test(t));
}

export function findCvMetaFallbackMatch(text: string): string | null {
  const t = (text || '').normalize('NFKC');
  for (const re of META_FALLBACK_PATTERNS) {
    const m = t.match(re);
    if (m?.[0]) return m[0];
  }
  return null;
}
