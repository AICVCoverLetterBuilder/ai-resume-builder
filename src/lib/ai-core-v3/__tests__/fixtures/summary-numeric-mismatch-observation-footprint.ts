// Test-only exact Task075 observation footprint. Never used by production.
// Frozen literals: no runtime Git diff generation or approximate regex restoration.
// Any changed membership/order/other source byte fails the exact old-byte gate.
const footprints: Readonly<Record<string, readonly { before: string; after: string }[]>> = {
  "summary-style-m5-server.ts": [
    {
      "before": "",
      "after": "  type SummaryStyleSourceNumericMismatchEvidence,\n"
    },
    {
      "before": "",
      "after": "interface SourceNumericTokenLocation {\n  readonly source: string;\n  readonly start: number;\n  readonly end: number;\n}\n\n"
    },
    {
      "before": "",
      "after": "  locations?: SourceNumericTokenLocation[],\n"
    },
    {
      "before": "    .map((match) => match[0]);\n",
      "after": "    .map((match) => {\n      locations?.push({ source, start: match.index!, end: match.index! + match[0].length });\n      return match[0];\n    });\n"
    },
    {
      "before": "function sourceFloorFirstPositiveProducer(snapshot: SummaryV3StyleOperationSnapshot): SummaryStyleSourceFloorFirstProducer | null {\n",
      "after": "/** Classify only a captured authoritative token location; never compare numbers again. */\nfunction sourceNumericMismatchEvidence(\n  snapshot: SummaryV3StyleOperationSnapshot,\n  location: SourceNumericTokenLocation,\n): SummaryStyleSourceNumericMismatchEvidence {\n  const { source, start, end } = location;\n  const token = source.slice(start, end);\n  const canonical = normalizeSummaryV3StyleText(source);\n  const prefix = source.slice(0, start);\n  const canonicalStart = normalizeSummaryV3StyleText(prefix).length\n    + (/\\s$/u.test(prefix) && prefix.trim().length > 0 ? 1 : 0);\n  const canonicalToken = normalizeSummaryV3StyleText(token);\n  const canonicalEnd = canonicalStart + canonicalToken.length;\n  if (canonical.slice(canonicalStart, canonicalEnd) !== canonicalToken) {\n    return { sourceNumericMismatchClass: 'unclassified', sourceNumericMismatchComparisonClass: 'unclassified' };\n  }\n  const spans = summaryV3StyleFactAnchorTokens(canonical).filter((span) => span.startsWith('span:'));\n  // The existing semantic-span formatter removes percent/currency spacing.\n  // Project only this captured location through that same formatting surface.\n  const semanticSurface = (text: string): string => text.replace(/\\s*(?:%|٪)/gu, '%')\n    .replace(/(\\p{Sc})\\s+/gu, '$1').replace(/\\s+(\\p{Sc})/gu, '$1');\n  const semanticSource = semanticSurface(canonical);\n  const semanticStart = semanticSurface(canonical.slice(0, canonicalStart)).length;\n  const semanticEnd = semanticSurface(canonical.slice(0, canonicalEnd)).length;\n  const owningSpans = spans.filter((span) => {\n    const surface = span.slice('span:'.length);\n    let offset = 0;\n    while (offset < semanticSource.length) {\n      const index = semanticSource.indexOf(surface, offset);\n      if (index < 0) return false;\n      if (semanticStart >= index && semanticEnd <= index + surface.length) return true;\n      offset = index + surface.length;\n    }\n    return false;\n  });\n  const calendar = summaryV3StyleCalendarDateRanges(canonical)\n    .some(([left, right]) => canonicalStart < right && canonicalEnd > left);\n  const duration = owningSpans.find((span) => summaryV3StyleDurationMonthsFromSemanticSpan(span) !== null);\n  const ambiguous = /[.,٫]\\p{N}{3,}/u.test(token)\n    || /[\\p{Pd}−±+]\\s*$/u.test(source.slice(0, start))\n    || /^\\s*[\\p{Pd}−±+]\\s*\\p{N}/u.test(source.slice(end));\n  // Precedence: existing calendar/duration authority, percent, currency,\n  // letter-bearing technical span, residual numeral script, decimal, integer.\n  const family: SummaryStyleSourceNumericMismatchEvidence['sourceNumericMismatchClass'] = calendar\n    ? /^(?:19|20)\\d{2}$/u.test(token) ? 'year_component' : 'calendar_component'\n    : duration ? 'duration_component'\n      : owningSpans.some((span) => /(?:%|٪)$/u.test(span)) ? 'percentage'\n        : owningSpans.some((span) => /\\p{Sc}/u.test(span)) ? 'currency_amount'\n          : owningSpans.some((span) => /\\p{L}/u.test(span.slice('span:'.length))\n            && /^(?:[\\p{L}\\p{N}]+(?:\\+\\+|#)|[\\p{L}\\p{N}]+(?:\\.[\\p{L}\\p{N}]+)+|\\.[\\p{L}\\p{N}]{2,})$/u.test(span.slice('span:'.length))) ? 'technical_identifier'\n            : /[^0-9.,٫]/u.test(token) ? 'locale_numeric_surface'\n              : ambiguous || /\\p{L}/u.test(source[start - 1] || '') || /\\p{L}/u.test(source[end] || '') ? 'unclassified'\n                : /[.,٫]/u.test(token) ? 'decimal_number'\n                  : 'plain_integer_surface';\n  return {\n    sourceNumericMismatchClass: family,\n    sourceNumericMismatchComparisonClass: duration && isStructuredDurationSemanticSpan(duration, snapshot)\n      ? 'typed_duration_equivalent_not_excluded'\n      : ambiguous ? 'ambiguous_numeric_surface' : 'exact_manifest_token_absent',\n  };\n}\n\nfunction sourceFloorFirstPositiveProducer(\n  snapshot: SummaryV3StyleOperationSnapshot,\n  observeNumericMismatch?: (evidence: SummaryStyleSourceNumericMismatchEvidence) => void,\n): SummaryStyleSourceFloorFirstProducer | null {\n"
    },
    {
      "before": "  const sourceNumbers = numericTokensOutsideValidatedStructuredDurationSurfaces(snapshot, numericComparisonSource, true);\n  if (sourceNumbers.some((number) => !manifestNumbers.has(number))) return 'source_numeric_membership_mismatch';\n",
      "after": "  const sourceNumberLocations: SourceNumericTokenLocation[] = [];\n  const sourceNumbers = numericTokensOutsideValidatedStructuredDurationSurfaces(snapshot, numericComparisonSource, true, sourceNumberLocations);\n  let firstUnmatchedIndex = -1;\n  if (sourceNumbers.some((number, index) => {\n    const unmatched = !manifestNumbers.has(number);\n    if (unmatched) firstUnmatchedIndex = index;\n    return unmatched;\n  })) {\n    if (observeNumericMismatch) observeNumericMismatch(sourceNumericMismatchEvidence(snapshot, sourceNumberLocations[firstUnmatchedIndex]!));\n    return 'source_numeric_membership_mismatch';\n  }\n"
    },
    {
      "before": "",
      "after": "// Bound to this winning decision, not a later source scan or terminal inference.\nconst sourceNumericHardDiagnostics = new WeakMap<LocalHardDecision, SummaryStyleSourceNumericMismatchEvidence>();\n\n"
    },
    {
      "before": "  const sourceFloorFirstProducer = sourceFloorFirstPositiveProducer(snapshot);\n  if (sourceFloorFirstProducer !== null) return { reason: 'unsupported_claim', predicate: 'unsupported_source_inconsistency', sourceFloorFirstProducer };\n",
      "after": "  let numericEvidence: SummaryStyleSourceNumericMismatchEvidence | null = null;\n  const sourceFloorFirstProducer = sourceFloorFirstPositiveProducer(snapshot, (value) => { numericEvidence = value; });\n  if (sourceFloorFirstProducer !== null) {\n    const decision: LocalHardDecision = { reason: 'unsupported_claim', predicate: 'unsupported_source_inconsistency', sourceFloorFirstProducer };\n    if (numericEvidence !== null) sourceNumericHardDiagnostics.set(decision, numericEvidence);\n    return decision;\n  }\n"
    },
    {
      "before": "",
      "after": "    ...sourceNumericHardDiagnostics.get(hardDecision),\n"
    }
  ],
  "summary-style-m5-local-observability.ts": [
    {
      "before": "",
      "after": "// Syntactic/typed source families only, never raw numeric or user surfaces.\nexport const SUMMARY_STYLE_SOURCE_NUMERIC_MISMATCH_CLASSES = [\n  'plain_integer_surface', 'decimal_number', 'percentage', 'duration_component',\n  'calendar_component', 'year_component', 'currency_amount', 'technical_identifier',\n  'locale_numeric_surface', 'unclassified',\n] as const;\nexport const SUMMARY_STYLE_SOURCE_NUMERIC_MISMATCH_COMPARISON_CLASSES = [\n  'exact_manifest_token_absent', 'typed_duration_equivalent_not_excluded',\n  'ambiguous_numeric_surface', 'unclassified',\n] as const;\nexport type SummaryStyleSourceNumericMismatchClass = (typeof SUMMARY_STYLE_SOURCE_NUMERIC_MISMATCH_CLASSES)[number];\nexport type SummaryStyleSourceNumericMismatchComparisonClass = (typeof SUMMARY_STYLE_SOURCE_NUMERIC_MISMATCH_COMPARISON_CLASSES)[number];\nexport interface SummaryStyleSourceNumericMismatchEvidence {\n  readonly sourceNumericMismatchClass: SummaryStyleSourceNumericMismatchClass;\n  readonly sourceNumericMismatchComparisonClass: SummaryStyleSourceNumericMismatchComparisonClass;\n}\n"
    },
    {
      "before": "",
      "after": "  readonly sourceNumericMismatchClass: SummaryStyleSourceNumericMismatchClass | null;\n  readonly sourceNumericMismatchComparisonClass: SummaryStyleSourceNumericMismatchComparisonClass | null;\n"
    },
    {
      "before": "  value: Omit<SummaryStyleLocalDiagnostics, 'sourceFloorFirstProducer'> & {\n",
      "after": "  value: Omit<SummaryStyleLocalDiagnostics, 'sourceFloorFirstProducer' | 'sourceNumericMismatchClass' | 'sourceNumericMismatchComparisonClass'> & {\n    readonly sourceNumericMismatchClass?: SummaryStyleSourceNumericMismatchClass | null;\n    readonly sourceNumericMismatchComparisonClass?: SummaryStyleSourceNumericMismatchComparisonClass | null;\n"
    },
    {
      "before": "",
      "after": "  const numericOwner = owner === 'hard_guard' && value.postEvaluatorHardPredicate === 'unsupported_source_inconsistency'\n    && value.sourceFloorFirstProducer === 'source_numeric_membership_mismatch';\n  const numericClass = numericOwner ? finite(value.sourceNumericMismatchClass, SUMMARY_STYLE_SOURCE_NUMERIC_MISMATCH_CLASSES) : null;\n  const comparisonClass = numericOwner ? finite(value.sourceNumericMismatchComparisonClass, SUMMARY_STYLE_SOURCE_NUMERIC_MISMATCH_COMPARISON_CLASSES) : null;\n"
    },
    {
      "before": "",
      "after": "    sourceNumericMismatchClass: numericClass && comparisonClass ? numericClass : null,\n    sourceNumericMismatchComparisonClass: numericClass && comparisonClass ? comparisonClass : null,\n"
    },
    {
      "before": "",
      "after": "    sourceNumericMismatchClass: null, sourceNumericMismatchComparisonClass: null,\n"
    }
  ]
};

export function removeTask075ObservationFootprint(text: string, moduleName: string): string {
  for (const { before, after } of [...(footprints[moduleName] || [])].reverse()) {
    if (!after || text.split(after).length !== 2) throw new Error('Task075 observation footprint drift: ' + moduleName);
    text = text.replace(after, before);
  }
  return text;
}
