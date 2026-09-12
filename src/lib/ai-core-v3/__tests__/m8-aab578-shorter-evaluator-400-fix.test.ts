import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_SHORTER_SERVER_DERIVED_EVIDENCE_FIELDS,
  SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  projectSummaryV3StyleEvaluatorToolForProvider,
  projectSummaryV3StyleToolForProvider,
  summaryV3StyleCandidateUnitHash,
  summaryV3StyleLocalSemanticDecision,
  type SummaryV3Style,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleRoute,
  type SummaryV3StyleProviderInvocation,
} from '../summary-style-m5-provider';
import type {
  SummaryV3StyleEvaluatorInput,
  SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';

const canonicalSource = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';
const canonicalShorter = 'I have about three years of experience and currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems, diagnosing and resolving electrical faults, and supporting electrical component installation.';
const canonicalStronger = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I reliably maintain electrical systems, diagnose and resolve electrical faults, and support the installation of electrical components.';

function requestFor(style: SummaryV3Style = 'shorter', overrides: Partial<SummaryV3StyleRequest> = {}): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: `summary_${style}`,
    operationId: `m8-aab578-${style}`,
    style,
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: canonicalSource,
    visibleSummaryFacts: undefined,
    protectedEntities: undefined,
    manifest: {
      manifestId: 'm8-aab578-manifest',
      contextId: 'm8-aab578-context',
      sourceLocale: 'en',
      currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current',
        role: 'Servicetechniker Elektrotechnik',
        employer: 'NordWerk Elektroservice Test',
        roleSourceLocale: 'de',
        rolePresentation: {
          text: 'Electrical Service Technician', sourceLocale: 'de', targetLocale: 'en',
          sourceRoleHash: hashSummaryV3StyleValue('Servicetechniker Elektrotechnik'),
          provenance: 'validated_localized_projection',
        },
        employmentState: 'present',
        durationMonths: 36,
        facts: [
          { id: 'maintenance', text: 'Wartung elektrischer Anlagen' },
          { id: 'faults', text: 'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen' },
          { id: 'installation', text: 'Unterstützung bei der Installation elektrischer Komponenten' },
        ],
      }],
    },
    requestIdentity: `m8-aab578-${style}-request`,
    createdAt: 1_789_209_891_121,
    ...overrides,
  };
}

function writerResponse(input: SummaryV3StyleWriterInput, text: string) {
  return {
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
      input: {
        operationId: input.operationId,
        snapshotHash: input.snapshotHash,
        manifestHash: input.manifestHash,
        style: input.style,
        locale: input.locale,
        units: [{ unitId: 'candidate-1', text, factIds: input.requiredFacts.map((fact) => fact.id) }],
      },
    }],
  };
}

function styleEvidence(style: SummaryV3Style): Record<string, unknown> {
  if (style === 'shorter') {
    return { semanticCompressionOperations: 1, shorterFulfilled: true, noOpDetected: false };
  }
  if (style === 'stronger') {
    return {
      strongerPredicateTransformations: 1,
      structuralStrengtheningCount: 1,
      modifierOnlyTransformationDetected: false,
      repeatedStyleModifierCount: 0,
      stackedModifierDetected: false,
      unsupportedAuthorityDetected: false,
      strongerFulfilled: true,
      noOpDetected: false,
    };
  }
  return {
    professionalFramingOperations: 1,
    cohesionClarityOperations: 1,
    markerOnlyChangeDetected: false,
    jargonOrFillerDetected: false,
    professionalFulfilled: true,
    noOpDetected: false,
  };
}

interface EvaluationOptions {
  readonly missingFactIndexes?: readonly number[];
  readonly representedFactHashes?: readonly string[];
  readonly missingFactHashes?: readonly string[];
  readonly roleIdentityResolution?: 'equivalent' | 'contradiction' | 'unresolved' | 'not_required';
  readonly extraShorterEvidence?: Readonly<Record<string, unknown>>;
}

function evaluatorResponse(invocation: SummaryV3StyleProviderInvocation, options: EvaluationOptions = {}) {
  const input = invocation.input as SummaryV3StyleEvaluatorInput;
  const missing = options.missingFactIndexes?.map((index) => input.requiredFacts[index]!).filter(Boolean) ?? [];
  const missingHashes = options.missingFactHashes ?? missing.map((fact) => fact.hash);
  const representedHashes = options.representedFactHashes
    ?? input.requiredFacts.filter((fact) => !missingHashes.includes(fact.hash)).map((fact) => fact.hash);
  const violations = missingHashes.length === 0 ? [] : [{
    code: 'missing_fact',
    factIdHashes: [...missingHashes],
    unitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
    repairable: false,
  }];
  return {
    stop_reason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
      input: {
        structuralStatus: 'passed', structuralViolations: [],
        semantic_groundingStatus: missingHashes.length === 0 ? 'passed' : 'failed',
        semantic_groundingViolations: violations,
        language_native_qualityStatus: 'passed', language_native_qualityViolations: [],
        style_fulfillmentStatus: 'passed', style_fulfillmentViolations: [],
        representedFactIdHashes: [...representedHashes],
        missingFactIdHashes: [...missingHashes],
        roleIdentityResolution: options.roleIdentityResolution
          ?? (input.roleIdentity.status === 'unresolved' ? 'equivalent' : 'not_required'),
        styleEvidence: { ...styleEvidence(input.style), ...options.extraShorterEvidence },
      },
    }],
  };
}

async function run(
  request: SummaryV3StyleRequest,
  candidateText: string,
  evaluation: EvaluationOptions = {},
) {
  const invocations: SummaryV3StyleProviderInvocation[] = [];
  const result = await executeSummaryV3StyleRoute(request, {
    timeoutForPhase: () => 30_000,
    invoke: async (invocation) => {
      invocations.push(invocation);
      return invocation.role === 'writer'
        ? writerResponse(invocation.input as SummaryV3StyleWriterInput, candidateText)
        : evaluatorResponse(invocation, evaluation);
    },
  });
  return { result, invocations };
}

function schemaRecords(value: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const visit = (current: unknown) => {
    if (Array.isArray(current)) { current.forEach(visit); return; }
    if (!current || typeof current !== 'object') return;
    const record = current as Record<string, unknown>;
    records.push(record);
    Object.values(record).forEach(visit);
  };
  visit(value);
  return records;
}

function assertProviderValid(tool: ReturnType<typeof projectSummaryV3StyleEvaluatorToolForProvider>) {
  const records = schemaRecords(tool.input_schema);
  expect(tool.strict).toBe(true);
  expect(records.some((record) => 'oneOf' in record || 'anyOf' in record)).toBe(false);
  const unsupported = new Set([
    'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
    'minLength', 'maxLength', 'maxItems', 'maxContains', 'uniqueItems', 'contains',
    'minProperties', 'maxProperties',
  ]);
  expect(records.flatMap((record) => Object.keys(record)).filter((key) => unsupported.has(key))).toEqual([]);
  for (const record of records) {
    if (record.type !== 'object' || !record.properties || typeof record.properties !== 'object') continue;
    expect(new Set(record.required as string[])).toEqual(new Set(Object.keys(record.properties as Record<string, unknown>)));
  }
}

function providerPropertyCount(value: unknown): number {
  return schemaRecords(value).reduce((count, record) => (
    count + (record.properties && typeof record.properties === 'object'
      ? Object.keys(record.properties as Record<string, unknown>).length
      : 0)
  ), 0);
}

function domainAt(tool: ReturnType<typeof projectSummaryV3StyleEvaluatorToolForProvider>, field: string): readonly string[] {
  const properties = tool.input_schema.properties as Record<string, { items?: { enum?: string[] } }>;
  return properties[field]?.items?.enum ?? [];
}

const localeCases: ReadonlyArray<readonly [
  SummaryV3StyleRequest['requestedLocale'],
  string,
  string,
  string,
  string,
]> = [
  ['sr', 'Mila je inženjerka u Atlasu i pažljivo održava sisteme 12 meseci.', 'Mila je inženjerka u Atlasu i čuva sisteme 12 meseci.', 'inženjerka', 'Atlasu'],
  ['en', 'Mila is an Engineer at Atlas and carefully maintains systems for 12 months.', 'Mila is an Engineer at Atlas and services systems for 12 months.', 'Engineer', 'Atlas'],
  ['hi', 'मीला एटलस में इंजीनियर हैं और प्रणालियों का सावधानी से रखरखाव 12 महीनों तक करती हैं।', 'मीला एटलस में इंजीनियर हैं और प्रणालियों की देखभाल 12 महीनों तक करती हैं।', 'इंजीनियर', 'एटलस'],
  ['ar', 'ميرا مهندسة في أطلس وتحافظ على الأنظمة بعناية لمدة 12 شهرا.', 'ميرا مهندسة في أطلس وتصون الأنظمة لمدة 12 شهرا.', 'مهندسة', 'أطلس'],
  ['ja', 'ミラはアトラスでエンジニアとして12か月間システムを丁寧に保守しています。', 'ミラはアトラスでエンジニアとして12か月間システムを管理します。', 'エンジニア', 'アトラス'],
  ['de', 'Mila ist Ingenieurin bei Atlas und wartet Systeme sorgfältig seit 12 Monaten.', 'Mila ist Ingenieurin bei Atlas und pflegt Systeme seit 12 Monaten.', 'Ingenieurin', 'Atlas'],
  ['fr', 'Mila est ingénieure chez Atlas et entretient soigneusement des systèmes depuis 12 mois.', 'Mila est ingénieure chez Atlas et maintient des systèmes depuis 12 mois.', 'ingénieure', 'Atlas'],
  ['es', 'Mila es ingeniera en Atlas y mantiene cuidadosamente sistemas desde hace 12 meses.', 'Mila es ingeniera en Atlas y cuida sistemas desde hace 12 meses.', 'ingeniera', 'Atlas'],
  ['it', 'Mila è ingegnera presso Atlas e mantiene attentamente sistemi da 12 mesi.', 'Mila è ingegnera presso Atlas e cura sistemi da 12 mesi.', 'ingegnera', 'Atlas'],
  ['hr', 'Mila je inženjerka u Atlasu i pažljivo održava sustave 12 mjeseci.', 'Mila je inženjerka u Atlasu i čuva sustave 12 mjeseci.', 'inženjerka', 'Atlasu'],
  ['pt-BR', 'Mila é engenheira na Atlas e mantém cuidadosamente sistemas há 12 meses.', 'Mila é engenheira na Atlas e cuida sistemas há 12 meses.', 'engenheira', 'Atlas'],
  ['ru', 'Мила — инженер в Atlas и тщательно обслуживает системы 12 месяцев.', 'Мила — инженер в Atlas и ведёт системы 12 месяцев.', 'инженер', 'Atlas'],
];

function localeRequest(localeCase: typeof localeCases[number]): SummaryV3StyleRequest {
  const [locale, source, _candidate, role, employer] = localeCase;
  return requestFor('shorter', {
    operationId: `m8-aab578-${locale}-shorter`,
    requestedLocale: locale,
    sourceLocale: locale,
    visibleSummary: source,
    manifest: {
      manifestId: `m8-aab578-${locale}-manifest`,
      contextId: `m8-aab578-${locale}-context`,
      sourceLocale: locale,
      currentRoleEntryId: `${locale}-entry`,
      entries: [{
        stableId: `${locale}-entry`, role, employer,
        employmentState: 'present', durationMonths: 12,
        facts: [{ id: `${locale}-fact`, text: source }],
      }],
    },
  });
}

describe('M8 AAB578 Shorter evaluator HTTP 400 closure', () => {
  it('projects one strict provider-valid Shorter grammar with exact dynamic domains', () => {
    const facts = ['fact-a', 'fact-b', 'fact-c', 'fact-d', 'fact-e'];
    const units = ['unit-a'];
    const tool = projectSummaryV3StyleEvaluatorToolForProvider('shorter', {
      allowedFactHashes: facts,
      allowedUnitHashes: units,
    });
    assertProviderValid(tool);
    expect(providerPropertyCount(tool.input_schema)).toBe(31);
    const properties = tool.input_schema.properties as Record<string, Record<string, unknown>>;
    expect(Object.keys(properties.styleEvidence.properties as Record<string, unknown>).sort()).toEqual([
      'noOpDetected', 'semanticCompressionOperations', 'shorterFulfilled',
    ]);
    expect(properties.styleEvidence.required).toEqual([
      'semanticCompressionOperations', 'shorterFulfilled', 'noOpDetected',
    ]);
    for (const field of SUMMARY_V3_STYLE_M5_SHORTER_SERVER_DERIVED_EVIDENCE_FIELDS) {
      expect(properties.styleEvidence.properties).not.toHaveProperty(field);
    }
    expect(JSON.stringify(tool.input_schema)).not.toMatch(/strongerPredicateTransformations|professionalFramingOperations/u);
    expect(domainAt(tool, 'representedFactIdHashes')).toEqual(facts);
    expect(domainAt(tool, 'missingFactIdHashes')).toEqual(facts);
    for (const phase of ['structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment']) {
      const violations = properties[`${phase}Violations`] as { items: { properties: Record<string, { items: { enum: string[] } }> } };
      expect(violations.items.properties.factIdHashes.items.enum).toEqual(facts);
      expect(violations.items.properties.unitHashes.items.enum).toEqual(units);
    }
  });

  it('rehydrates deterministic Shorter measurements before the full local parser', async () => {
    const { result, invocations } = await run(requestFor(), canonicalShorter);
    expect(result).toMatchObject({
      kind: 'candidate_ready',
      style: 'shorter',
      mode: 'enhance_existing_content',
      evidence: { evaluatorReached: true, evaluatorOutputContractFailureClass: null },
    });
    expect(invocations.map((invocation) => invocation.role)).toEqual(['writer', 'evaluator']);
  });

  it('rejects provider attempts to populate server-derived Shorter evidence', async () => {
    const { result } = await run(requestFor(), canonicalShorter, { extraShorterEvidence: { sourceNormalizedLength: 1 } });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'evaluator_transport_malformed',
      evidence: { evaluatorOutputContractFailureClass: 'payload_keyset' },
    });
  });

  it('keeps unknown fact references impossible on wire and rejected locally', async () => {
    const tool = projectSummaryV3StyleEvaluatorToolForProvider('shorter', {
      allowedFactHashes: ['fact-a'], allowedUnitHashes: ['unit-a'],
    });
    expect(domainAt(tool, 'representedFactIdHashes')).not.toContain('unknown-fact');
    const { result } = await run(requestFor(), canonicalShorter, {
      representedFactHashes: ['unknown-fact'], missingFactHashes: [],
    });
    expect(result).toMatchObject({
      kind: 'handled_failure', typedReason: 'evaluator_transport_malformed',
      evidence: { evaluatorOutputContractFailureClass: 'fact_reference_membership' },
    });
  });

  it('keeps true missing-duty and two-of-three-duty candidates rejected by the evaluator', async () => {
    const missing = await run(requestFor(), canonicalShorter, { missingFactIndexes: [4] });
    expect(missing.result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    const twoOfThree = 'I have about three years of experience and currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems and diagnosing electrical faults.';
    const reduced = await run(requestFor(), twoOfThree, { missingFactIndexes: [4] });
    expect(reduced.result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(reduced.invocations.map((invocation) => invocation.role)).toEqual(['writer', 'evaluator']);
  });

  it('keeps cross-locale role equivalence provider-owned and fail-closed', async () => {
    const accepted = await run(requestFor(), canonicalShorter, { roleIdentityResolution: 'equivalent' });
    expect(accepted.result).toMatchObject({ kind: 'candidate_ready' });
    const unresolved = await run(requestFor(), canonicalShorter, { roleIdentityResolution: 'unresolved' });
    expect(unresolved.result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    const contradiction = await run(requestFor(), canonicalShorter, { roleIdentityResolution: 'contradiction' });
    expect(contradiction.result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
  });

  it('does not change Stronger, Professional, or writer provider contracts', async () => {
    const strongerTool = projectSummaryV3StyleEvaluatorToolForProvider('stronger', {
      allowedFactHashes: ['fact-a'], allowedUnitHashes: ['unit-a'],
    });
    const professionalTool = projectSummaryV3StyleEvaluatorToolForProvider('professional', {
      allowedFactHashes: ['fact-a'], allowedUnitHashes: ['unit-a'],
    });
    assertProviderValid(strongerTool);
    assertProviderValid(professionalTool);
    expect(providerPropertyCount(strongerTool.input_schema)).toBe(36);
    expect(providerPropertyCount(professionalTool.input_schema)).toBe(34);
    expect(SUMMARY_V3_STYLE_M5_WRITER_PROVIDER_TOOL).toEqual(
      projectSummaryV3StyleToolForProvider(SUMMARY_V3_STYLE_M5_WRITER_TOOL),
    );
    const stronger = await run(requestFor('stronger'), canonicalStronger);
    expect(stronger.result).toMatchObject({ kind: 'candidate_ready', style: 'stronger' });
  });

  it.each(localeCases)('uses the same provider-valid Shorter architecture for %s', async (...localeCase) => {
    const request = localeRequest(localeCase);
    const candidate = localeCase[2];
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    expect(summaryV3StyleLocalSemanticDecision(snapshot, candidate)).toBe('unresolved');
    const { result, invocations } = await run(request, candidate);
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'shorter' });
    const evaluator = invocations.find((invocation) => invocation.role === 'evaluator');
    expect(evaluator).toBeDefined();
    assertProviderValid(evaluator!.tool);
    expect(providerPropertyCount(evaluator!.tool.input_schema)).toBe(31);
  });
});
