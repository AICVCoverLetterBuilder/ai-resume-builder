import type { Locale } from '@/lib/i18n/translations';
import { fingerprintText } from '@/lib/cv-export-diagnostics';
import { dutyTokenStems } from './facts';
import { analyzeSummaryV2FinalUnitOwnership, splitSummaryV2FinalUnits } from './unit-ownership';
import type { SummaryV2EntryFact, SummaryV2SelectionManifest } from './types';

/** Shared semantic category for evaluative manner/quality additions. */
export type SummaryV2QualityMannerClaimKind =
  | 'rigor'
  | 'precision'
  | 'excellence'
  | 'efficiency'
  | 'carefulness'
  | 'strategy'
  | 'consistency'
  | 'quality_standard'
  | 'reliability';

export type SummaryV2QualityMannerClaim = {
  kind: SummaryV2QualityMannerClaimKind;
  surfaceHash: string;
  /** Internal-only offsets used for safe deterministic removal. */
  start: number;
  end: number;
};

type ClaimPattern = {
  kind: SummaryV2QualityMannerClaimKind;
  re: RegExp;
};

const PATTERNS: Record<Locale, ClaimPattern[]> = {
  en: [
    { kind: 'rigor', re: /\b(?:rigorously|with\s+rigor)\b/giu },
    { kind: 'precision', re: /\b(?:precisely|with\s+precision|accurate(?:ly)?)\b/giu },
    { kind: 'excellence', re: /\b(?:excellently|with\s+excellence)\b/giu },
    { kind: 'efficiency', re: /\b(?:efficiently|with\s+efficiency)\b/giu },
    { kind: 'carefulness', re: /\b(?:carefully|meticulously|thoroughly)\b/giu },
    { kind: 'strategy', re: /\b(?:strategically|in\s+a\s+strategic\s+(?:way|manner))\b/giu },
    { kind: 'consistency', re: /\b(?:consistently|in\s+a\s+consistent\s+(?:way|manner))\b/giu },
    { kind: 'quality_standard', re: /\b(?:with\s+(?:a\s+)?high\s+quality\s+standard|high-quality)\b/giu },
    { kind: 'reliability', re: /\b(?:reliably|dependably|with\s+reliability)\b/giu },
  ],
  de: [
    { kind: 'rigor', re: /\b(?:akribisch|mit\s+großer\s+Sorgfalt)\b/giu },
    { kind: 'precision', re: /\b(?:präzise|präziserweise|mit\s+Präzision)\b/giu },
    { kind: 'excellence', re: /\b(?:hervorragend|mit\s+Exzellenz)\b/giu },
    { kind: 'efficiency', re: /\b(?:effizient|effizienterweise|mit\s+Effizienz)\b/giu },
    { kind: 'carefulness', re: /\b(?:sorgfältig|gewissenhaft|gründlich|akribisch)\b/giu },
    { kind: 'strategy', re: /\b(?:strategisch|auf\s+strategische\s+Weise)\b/giu },
    { kind: 'consistency', re: /\b(?:konsequent|zuverlässig|auf\s+einheitliche\s+Weise)\b/giu },
    { kind: 'quality_standard', re: /\b(?:hohen\s+Qualitätsstandard|hohem\s+Qualitätsstandard)\b/giu },
    { kind: 'reliability', re: /\b(?:zuverlässig|verlässlich)\b/giu },
  ],
  es: [
    { kind: 'rigor', re: /\b(?:con\s+rigor|rigurosamente)\b/giu },
    { kind: 'precision', re: /\b(?:con\s+precisión|precisamente|preciso(?:s|as)?)\b/giu },
    { kind: 'excellence', re: /\b(?:con\s+excelencia|excelentemente)\b/giu },
    { kind: 'efficiency', re: /\b(?:con\s+eficiencia|eficientemente)\b/giu },
    { kind: 'carefulness', re: /\b(?:cuidadosamente|meticulosamente|minuciosamente)\b/giu },
    { kind: 'strategy', re: /\b(?:de\s+forma\s+estratégica|estratégicamente)\b/giu },
    { kind: 'consistency', re: /\b(?:de\s+forma\s+consistente|consistentemente)\b/giu },
    { kind: 'quality_standard', re: /\b(?:alto\s+estándar\s+de\s+calidad|alta\s+calidad)\b/giu },
    { kind: 'reliability', re: /\b(?:de\s+forma\s+fiable|fiablemente|de\s+manera\s+confiable)\b/giu },
  ],
  fr: [
    { kind: 'rigor', re: /\b(?:avec\s+rigueur|rigoureusement)\b/giu },
    { kind: 'precision', re: /\b(?:avec\s+précision|précisément|précis(?:e|es)?)\b/giu },
    { kind: 'excellence', re: /\b(?:avec\s+excellence|excellemment)\b/giu },
    { kind: 'efficiency', re: /\b(?:avec\s+efficacité|efficacement)\b/giu },
    { kind: 'carefulness', re: /\b(?:soigneusement|méticuleusement|avec\s+soin)\b/giu },
    { kind: 'strategy', re: /\b(?:de\s+manière\s+stratégique|stratégiquement)\b/giu },
    { kind: 'consistency', re: /\b(?:de\s+manière\s+cohérente|constamment|de\s+façon\s+cohérente)\b/giu },
    { kind: 'quality_standard', re: /\b(?:standard\s+élevé\s+de\s+qualité|haute\s+qualité)\b/giu },
    { kind: 'reliability', re: /\b(?:fiablement|de\s+manière\s+fiable)\b/giu },
  ],
  it: [
    { kind: 'rigor', re: /\b(?:con\s+rigore|rigorosamente)\b/giu },
    { kind: 'precision', re: /\b(?:con\s+precisione|precisamente|preciso(?:a|i|e)?)\b/giu },
    { kind: 'excellence', re: /\b(?:con\s+eccellenza|eccellentemente)\b/giu },
    { kind: 'efficiency', re: /\b(?:con\s+efficienza|efficientemente)\b/giu },
    { kind: 'carefulness', re: /\b(?:accuratamente|meticolosamente|scrupolosamente)\b/giu },
    { kind: 'strategy', re: /\b(?:in\s+modo\s+strategico|strategicamente)\b/giu },
    { kind: 'consistency', re: /\b(?:in\s+modo\s+coerente|costantemente)\b/giu },
    { kind: 'quality_standard', re: /\b(?:elevato\s+standard\s+di\s+qualità|alta\s+qualità)\b/giu },
    { kind: 'reliability', re: /\b(?:affidabilmente|in\s+modo\s+affidabile)\b/giu },
  ],
  'pt-BR': [
    { kind: 'rigor', re: /\b(?:com\s+rigor|rigorosamente|rigoros(?:o|a|os|as))\b/giu },
    { kind: 'precision', re: /\b(?:com\s+precisão|precisamente|precis(?:o|a|os|as))\b/giu },
    { kind: 'excellence', re: /\b(?:com\s+excelência|excelentemente|excelent(?:e|es))\b/giu },
    { kind: 'efficiency', re: /\b(?:com\s+eficiência|eficientemente|eficient(?:e|es))\b/giu },
    { kind: 'carefulness', re: /\b(?:cuidadosamente|meticulosamente|minuciosamente)\b/giu },
    { kind: 'strategy', re: /\b(?:de\s+forma\s+estratégica|estrategicamente|estratégic(?:o|a|os|as))\b/giu },
    { kind: 'consistency', re: /\b(?:de\s+forma\s+consistente|consistentemente|consistent(?:e|es))\b/giu },
    { kind: 'quality_standard', re: /\b(?:com\s+(?:um\s+)?(?:alto|elevado)\s+padrão\s+de\s+qualidade|alta\s+qualidade)\b/giu },
    { kind: 'reliability', re: /\b(?:de\s+forma\s+confiável|confiavelmente)\b/giu },
  ],
  ru: [
    { kind: 'rigor', re: /(?:тщательно|с\s+особой\s+тщательностью)/giu },
    { kind: 'precision', re: /(?:точно|с\s+точностью|точный|точная|точные)/giu },
    { kind: 'excellence', re: /(?:отлично|с\s+превосходством)/giu },
    { kind: 'efficiency', re: /(?:эффективно|с\s+эффективностью)/giu },
    { kind: 'carefulness', re: /(?:внимательно|скрупулёзно|скрупулезно)/giu },
    { kind: 'strategy', re: /(?:стратегически|стратегическим\s+образом)/giu },
    { kind: 'consistency', re: /(?:последовательно|систематически)/giu },
    { kind: 'quality_standard', re: /(?:высок(?:им|ого)\s+стандарт(?:ом|а)\s+качества)/giu },
    { kind: 'reliability', re: /(?:надёжно|надежно|с\s+надёжностью|с\s+надежностью)/giu },
  ],
  sr: [
    { kind: 'rigor', re: /\b(?:rigorozno|sa\s+rigorom)\b/giu },
    { kind: 'precision', re: /\b(?:precizno|sa\s+preciznošću)\b/giu },
    { kind: 'excellence', re: /\b(?:izvrsno|sa\s+izvrsnošću)\b/giu },
    { kind: 'efficiency', re: /\b(?:efikasno|efikasnošću)\b/giu },
    { kind: 'carefulness', re: /\b(?:pažljivo|pedantno|temeljno)\b/giu },
    { kind: 'strategy', re: /\b(?:strateški|na\s+strateški\s+način)\b/giu },
    { kind: 'consistency', re: /\b(?:dosledno|konzistentno)\b/giu },
    { kind: 'quality_standard', re: /\b(?:visok(?:im|og)\s+standard(?:om|a)\s+kvaliteta)\b/giu },
    { kind: 'reliability', re: /\b(?:pouzdano|sa\s+pouzdanjem)\b/giu },
  ],
  hr: [
    { kind: 'rigor', re: /\b(?:rigorozno|s\s+rigorom)\b/giu },
    { kind: 'precision', re: /\b(?:precizno|s\s+preciznošću)\b/giu },
    { kind: 'excellence', re: /\b(?:izvrsno|s\s+izvrsnošću)\b/giu },
    { kind: 'efficiency', re: /\b(?:učinkovito|efikasno|s\s+učinkovitošću)\b/giu },
    { kind: 'carefulness', re: /\b(?:pažljivo|pedantno|temeljito)\b/giu },
    { kind: 'strategy', re: /\b(?:strateški|na\s+strateški\s+način)\b/giu },
    { kind: 'consistency', re: /\b(?:dosljedno|konzistentno)\b/giu },
    { kind: 'quality_standard', re: /\b(?:visok(?:im|og)\s+standard(?:om|a)\s+kvalitete)\b/giu },
    { kind: 'reliability', re: /\b(?:pouzdano|s\s+pouzdanjem)\b/giu },
  ],
  ar: [
    { kind: 'rigor', re: /(?:بدقة|بصرامة|باجتهاد)/gu },
    { kind: 'precision', re: /(?:بدقة|بشكل\s+دقيق)/gu },
    { kind: 'excellence', re: /(?:بامتياز|بشكل\s+ممتاز)/gu },
    { kind: 'efficiency', re: /(?:بكفاءة|بشكل\s+فعال)/gu },
    { kind: 'carefulness', re: /(?:بعناية|بدقة\s+وعناية)/gu },
    { kind: 'strategy', re: /(?:استراتيجياً|بطريقة\s+استراتيجية)/gu },
    { kind: 'consistency', re: /(?:باستمرار|بشكل\s+متسق)/gu },
    { kind: 'quality_standard', re: /(?:بمعايير\s+جودة\s+عالية)/gu },
    { kind: 'reliability', re: /(?:بموثوقية|بشكل\s+موثوق)/gu },
  ],
  hi: [
    { kind: 'rigor', re: /(?:कठोरता से|पूरी\s+सख्ती\s+से|रigorously)/gu },
    { kind: 'precision', re: /(?:सटीकता से|सटीक\s+रूप\s+से)/gu },
    { kind: 'excellence', re: /(?:उत्कृष्टता से|उत्कृष्ट\s+रूप\s+से)/gu },
    { kind: 'efficiency', re: /(?:दक्षता से|कुशलता से)/gu },
    { kind: 'carefulness', re: /(?:सावधानीपूर्वक|बारीकी से|सूक्ष्मता से)/gu },
    { kind: 'strategy', re: /(?:रणनीतिक\s+रूप\s+से|रणनीतिक\s+तरीके\s+से)/gu },
    { kind: 'consistency', re: /(?:लगातार|सुसंगत\s+रूप\s+से)/gu },
    { kind: 'quality_standard', re: /(?:उच्च\s+गुणवत्ता\s+मानक)/gu },
    { kind: 'reliability', re: /(?:विश्वसनीय\s+रूप\s+से)/gu },
  ],
  ja: [
    { kind: 'rigor', re: /(?:厳密に|厳格に)/gu },
    { kind: 'precision', re: /(?:正確に|精密に)/gu },
    { kind: 'excellence', re: /(?:卓越して|優れた形で)/gu },
    { kind: 'efficiency', re: /(?:効率的に|効率よく)/gu },
    { kind: 'carefulness', re: /(?:注意深く|丁寧に|綿密に)/gu },
    { kind: 'strategy', re: /(?:戦略的に|戦略的な方法で)/gu },
    { kind: 'consistency', re: /(?:一貫して|継続的に)/gu },
    { kind: 'quality_standard', re: /(?:高い品質基準で)/gu },
    { kind: 'reliability', re: /(?:確実に|信頼性をもって)/gu },
  ],
};

function claimSurfaceHash(surface: string): string {
  return fingerprintText((surface || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase());
}

export function detectSummaryV2QualityMannerClaims(
  text: string,
  locale: Locale,
): SummaryV2QualityMannerClaim[] {
  const normalized = (text || '').normalize('NFKC');
  const claims: SummaryV2QualityMannerClaim[] = [];
  for (const pattern of PATTERNS[locale] || []) {
    pattern.re.lastIndex = 0;
    for (const match of normalized.matchAll(pattern.re)) {
      const surface = match[0] || '';
      const start = match.index ?? -1;
      if (start < 0) continue;
      claims.push({
        kind: pattern.kind,
        surfaceHash: claimSurfaceHash(surface),
        start,
        end: start + surface.length,
      });
    }
  }
  return claims.sort((a, b) => a.start - b.start || a.end - b.end);
}

function normalizedTokens(text: string, claim?: SummaryV2QualityMannerClaim): string[] {
  const raw = (text || '').toLocaleLowerCase();
  const withoutClaim = claim
    ? `${raw.slice(0, claim.start)} ${raw.slice(claim.end)}`
    : raw;
  return dutyTokenStems(withoutClaim).filter((token) => token.length >= 4);
}

function claimKindPresent(text: string, locale: Locale, kind: SummaryV2QualityMannerClaimKind): boolean {
  return detectSummaryV2QualityMannerClaims(text, locale).some((claim) => claim.kind === kind);
}

function factAuthorizesClaim(
  fact: SummaryV2EntryFact,
  claim: SummaryV2QualityMannerClaim,
  clause: string,
  targetLocale: Locale,
): boolean {
  const factSurfaces: Array<{ text: string; locale: Locale }> = [
    { text: fact.bulletText, locale: fact.presentationLocale || targetLocale },
    { text: fact.presentationText || '', locale: fact.presentationLocale || targetLocale },
    { text: fact.bulletText, locale: fact.sourceLocale },
  ].filter((item) => item.text.trim().length > 0);
  return factSurfaces.some(({ text, locale }) => {
    if (!claimKindPresent(text, locale, claim.kind)) return false;
    const factTokens = normalizedTokens(text).filter((token) => token.length >= 4);
    // `claim.start/end` are offsets in the complete candidate, not in this
    // local clause. Keep the claim tokens in the overlap so an explicit
    // source-owned evaluative phrase can authorize its target realization.
    const clauseTokens = normalizedTokens(clause);
    const overlap = clauseTokens.filter((token) => factTokens.includes(token));
    return overlap.length >= (factTokens.length <= 2 ? 1 : 2);
  });
}

function clauseForClaim(unit: string, claim: SummaryV2QualityMannerClaim, unitStart: number): string {
  const localStart = Math.max(0, claim.start - unitStart);
  const localEnd = Math.max(localStart, claim.end - unitStart);
  const left = unit.slice(0, localStart).split(/[,;]|\s+(?:e|y|and|et|und|и|و| तथा |また)\s+/iu).pop() || '';
  const right = unit.slice(localEnd).split(/[,;]|\s+(?:e|y|and|et|und|и|و| तथा |また)\s+/iu)[0] || '';
  return `${left} ${right}`.trim();
}

function sourceFactsForUnit(
  manifest: SummaryV2SelectionManifest,
  entryId: string | null,
): SummaryV2EntryFact[] {
  if (!entryId) return [];
  const entry = [manifest.current, ...manifest.priors].find((candidate) => candidate?.entryId === entryId);
  return entry?.facts || [];
}

export function unsupportedSummaryV2QualityMannerClaims(
  text: string,
  manifest: SummaryV2SelectionManifest,
): SummaryV2QualityMannerClaim[] {
  const claims = detectSummaryV2QualityMannerClaims(text, manifest.locale);
  if (claims.length === 0) return [];
  const ownership = analyzeSummaryV2FinalUnitOwnership(text, manifest, {});
  const units = splitSummaryV2FinalUnits(text);
  const unsupported: SummaryV2QualityMannerClaim[] = [];
  for (const claim of claims) {
    let unit = text;
    let unitIndex = -1;
    let unitStart = 0;
    let cursor = 0;
    for (let index = 0; index < units.length; index += 1) {
      const candidate = units[index] || '';
      const candidateStart = text.indexOf(candidate, cursor);
      const candidateEnd = candidateStart + candidate.length;
      if (candidateStart >= 0 && claim.start >= candidateStart && claim.start < candidateEnd) {
        unit = candidate;
        unitIndex = index;
        unitStart = candidateStart;
        break;
      }
      cursor = candidateEnd + 1;
    }
    const owner = ownership.evidence.find((evidence) => evidence.unitIndex === unitIndex)?.owningEntryId || null;
    const clause = clauseForClaim(unit, claim, unitStart);
    const authorized = sourceFactsForUnit(manifest, owner)
      .some((fact) => factAuthorizesClaim(fact, claim, clause, manifest.locale));
    if (!authorized) unsupported.push(claim);
  }
  return unsupported;
}

/** Remove only unsupported detected surfaces; the shared validator remains authoritative. */
export function removeUnsupportedSummaryV2QualityMannerClaims(
  text: string,
  manifest: SummaryV2SelectionManifest,
): { text: string; removed: SummaryV2QualityMannerClaim[] } {
  const removed = unsupportedSummaryV2QualityMannerClaims(text, manifest);
  if (removed.length === 0) return { text, removed };
  let output = text;
  for (const claim of [...removed].sort((a, b) => b.start - a.start)) {
    output = `${output.slice(0, claim.start)} ${output.slice(claim.end)}`;
  }
  output = output
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/gu, '$1')
    .replace(/,\s*(?:e|y|and|et|und|и|و)\s*([,.!?])/giu, '$1')
    .trim();
  return { text: output, removed };
}
