import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  countSummaryV3StyleClauses,
  countSummaryV3StyleUnits,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  normalizedSummaryV3StyleLength,
  summaryV3StyleCandidateUnitHash,
  summaryV3StyleCandidateRepresentsRequiredFacts,
  summaryV3StyleLocalSemanticDecision,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleServer,
  type SummaryV3StyleEvaluatorInput,
  type SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';

const canonicalSource = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';
const compactCanonical = 'I have about three years of experience and currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems, diagnosing and resolving electrical faults, and supporting electrical component installation.';

function canonicalRequest(overrides: Partial<SummaryV3StyleRequest> = {}): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: 'summary_shorter',
    operationId: 'm8-aab577-shorter-001',
    style: 'shorter',
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: canonicalSource,
    visibleSummaryFacts: undefined,
    protectedEntities: undefined,
    manifest: {
      manifestId: 'm8-aab577-shorter-manifest',
      contextId: 'm8-aab577-shorter-context',
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
    requestIdentity: 'm8-aab577-shorter-request-001',
    createdAt: 1_757_000_000_000,
    ...overrides,
  };
}

type MissingSelector = (input: SummaryV3StyleEvaluatorInput) => readonly SummaryV3StyleEvaluatorInput['requiredFacts'][number][];

function missingByText(token: string): MissingSelector {
  return (input) => {
    const matches = input.requiredFacts.filter((fact) => fact.text.toLocaleLowerCase().includes(token.toLocaleLowerCase()));
    return matches.length > 0 ? matches : input.requiredFacts.slice(-1);
  };
}

function writerEnvelope(input: SummaryV3StyleWriterInput, text: string) {
  return {
    toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
    contentBlockCount: 1,
    textBlockCount: 0,
    toolBlockCount: 1,
    input: {
      operationId: input.operationId,
      snapshotHash: input.snapshotHash,
      manifestHash: input.manifestHash,
      style: input.style,
      locale: input.locale,
      units: [{ unitId: 'shorter-candidate-1', text, factIds: input.requiredFacts.map((fact) => fact.id) }],
    },
  };
}

function evaluatorEnvelope(
  input: SummaryV3StyleEvaluatorInput,
  missingFacts: readonly SummaryV3StyleEvaluatorInput['requiredFacts'][number][] = [],
) {
  const missingHashes = missingFacts.map((fact) => fact.hash);
  const representedHashes = input.requiredFacts.filter((fact) => !missingHashes.includes(fact.hash)).map((fact) => fact.hash);
  const missingViolations = missingHashes.length === 0 ? [] : [{
    code: 'missing_fact',
    factIdHashes: missingHashes,
    unitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
    repairable: false,
  }];
  const sourceLength = normalizedSummaryV3StyleLength(input.sourceText);
  const candidateLength = input.candidate.normalizedLength;
  return {
    toolName: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
    contentBlockCount: 1,
    textBlockCount: 0,
    toolBlockCount: 1,
    input: {
      operationId: input.operationId,
      snapshotHash: input.snapshotHash,
      manifestHash: input.manifestHash,
      style: input.style,
      locale: input.locale,
      candidateHash: input.candidate.hash,
      candidateUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
      phases: {
        structural: { status: 'passed', violations: [] },
        semantic_grounding: { status: missingHashes.length === 0 ? 'passed' : 'failed', violations: missingViolations },
        language_native_quality: { status: 'passed', violations: [] },
        style_fulfillment: { status: 'passed', violations: [] },
      },
      representedFactIdHashes: representedHashes,
      missingFactIdHashes: missingHashes,
      roleIdentityResolution: 'equivalent',
      styleEvidence: {
        style: 'shorter',
        semanticCompressionOperations: 1,
        sourceNormalizedLength: sourceLength,
        candidateNormalizedLength: candidateLength,
        lengthDelta: sourceLength - candidateLength,
        lengthDeltaPercent: sourceLength > 0 ? (sourceLength - candidateLength) / sourceLength : 0,
        sourceUnitCount: countSummaryV3StyleUnits(input.sourceText),
        candidateUnitCount: input.candidate.unitCount,
        sourceClauseCount: countSummaryV3StyleClauses(input.sourceText),
        candidateClauseCount: input.candidate.clauseCount,
        factCoverage: missingHashes.length === 0,
        shorterFulfilled: true,
        noOpDetected: false,
      },
    },
  };
}

async function run(
  request: SummaryV3StyleRequest,
  candidateText: string,
  selector?: MissingSelector,
) {
  const calls = { writer: 0, evaluator: 0 };
  const evaluatorMissing: string[][] = [];
  const result = await executeSummaryV3StyleServer(request, {
    async write(input) {
      calls.writer += 1;
      return writerEnvelope(input, candidateText);
    },
    async evaluate(input) {
      calls.evaluator += 1;
      const missing = selector ? selector(input) : [];
      evaluatorMissing.push(missing.map((fact) => fact.id));
      return evaluatorEnvelope(input, missing);
    },
  });
  return { result, calls, evaluatorMissing };
}

const localeCases = [
  ['en', 'Mila is an Engineer at Atlas and carefully maintains systems for 12 months.', 'Mila is an Engineer at Atlas and services systems for 12 months.', 'Engineer', 'Atlas', 'Mila is an Engineer at Atlas for 12 months.'],
  ['sr', 'Mila je inženjerka u Atlasu i pažljivo održava sisteme 12 meseci.', 'Mila je inženjerka u Atlasu i čuva sisteme 12 meseci.', 'inženjerka', 'Atlasu', 'Mila je inženjerka u Atlasu 12 meseci.'],
  ['hi', 'मीला एटलस में इंजीनियर हैं और प्रणालियों का सावधानी से रखरखाव 12 महीनों तक करती हैं।', 'मीला एटलस में इंजीनियर हैं और प्रणालियों की देखभाल 12 महीनों तक करती हैं।', 'इंजीनियर', 'एटलस', 'मीला एटलस में इंजीनियर हैं और 12 महीनों तक काम करती हैं।'],
  ['ar', 'ميرا مهندسة في أطلس وتحافظ على الأنظمة بعناية لمدة 12 شهرا.', 'ميرا مهندسة في أطلس وتصون الأنظمة لمدة 12 شهرا.', 'مهندسة', 'أطلس', 'ميرا مهندسة في أطلس لمدة 12 شهرا.'],
  ['ja', 'ミラはアトラスでエンジニアとして12か月間システムを丁寧に保守しています。', 'ミラはアトラスでエンジニアとして12か月間システムを管理します。', 'エンジニア', 'アトラス', 'ミラはアトラスでエンジニアとして12か月間働いています。'],
  ['de', 'Mila ist Ingenieurin bei Atlas und wartet Systeme sorgfältig seit 12 Monaten.', 'Mila ist Ingenieurin bei Atlas und pflegt Systeme seit 12 Monaten.', 'Ingenieurin', 'Atlas', 'Mila ist Ingenieurin bei Atlas seit 12 Monaten.'],
  ['fr', 'Mila est ingénieure chez Atlas et entretient soigneusement des systèmes depuis 12 mois.', 'Mila est ingénieure chez Atlas et maintient des systèmes depuis 12 mois.', 'ingénieure', 'Atlas', 'Mila est ingénieure chez Atlas depuis 12 mois.'],
  ['es', 'Mila es ingeniera en Atlas y mantiene cuidadosamente sistemas desde hace 12 meses.', 'Mila es ingeniera en Atlas y cuida sistemas desde hace 12 meses.', 'ingeniera', 'Atlas', 'Mila es ingeniera en Atlas desde hace 12 meses.'],
  ['it', 'Mila è ingegnera presso Atlas e mantiene attentamente sistemi da 12 mesi.', 'Mila è ingegnera presso Atlas e cura sistemi da 12 mesi.', 'ingegnera', 'Atlas', 'Mila è ingegnera presso Atlas da 12 mesi.'],
  ['hr', 'Mila je inženjerka u Atlasu i pažljivo održava sustave 12 mjeseci.', 'Mila je inženjerka u Atlasu i čuva sustave 12 mjeseci.', 'inženjerka', 'Atlasu', 'Mila je inženjerka u Atlasu 12 mjeseci.'],
  ['pt-BR', 'Mila é engenheira na Atlas e mantém cuidadosamente sistemas há 12 meses.', 'Mila é engenheira na Atlas e cuida sistemas há 12 meses.', 'engenheira', 'Atlas', 'Mila é engenheira na Atlas há 12 meses.'],
  ['ru', 'Мила — инженер в Atlas и тщательно обслуживает системы 12 месяцев.', 'Мила — инженер в Atlas и ведёт системы 12 месяцев.', 'инженер', 'Atlas', 'Мила — инженер в Atlas 12 месяцев.'],
] as const;

function localeRequest(
  locale: typeof localeCases[number][0],
  sourceText: string,
): SummaryV3StyleRequest {
  const role = localeCases.find((item) => item[0] === locale)?.[3] || 'Engineer';
  const employer = localeCases.find((item) => item[0] === locale)?.[4] || 'Atlas';
  return canonicalRequest({
    operationId: `m8-aab577-${locale}-shorter`,
    requestedLocale: locale,
    sourceLocale: locale,
    visibleSummary: sourceText,
    manifest: {
      manifestId: `m8-aab577-${locale}-manifest`,
      contextId: `m8-aab577-${locale}-context`,
      sourceLocale: locale,
      currentRoleEntryId: `${locale}-entry`,
      entries: [{
        stableId: `${locale}-entry`, role, employer,
        employmentState: 'present', durationMonths: 12,
        facts: [{ id: `${locale}-fact`, text: sourceText }],
      }],
    },
  });
}

describe('M8 AAB577 Shorter single-evaluator authority closure', () => {
  it('routes the canonical 303-character rewrite through the existing evaluator', async () => {
    const snapshot = createSummaryV3StyleOperationSnapshot(canonicalRequest());
    expect(summaryV3StyleLocalSemanticDecision(snapshot, compactCanonical)).toBe('unresolved');
    expect(summaryV3StyleCandidateRepresentsRequiredFacts(snapshot, compactCanonical)).toBe(false);
    const { result, calls } = await run(canonicalRequest(), compactCanonical);
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'shorter', mode: 'enhance_existing_content' });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it.each(localeCases)('accepts a genuine material-predicate paraphrase for %s', async (locale, sourceText, candidateText) => {
    const request = localeRequest(locale, sourceText);
    const snapshot = createSummaryV3StyleOperationSnapshot(request);
    expect(candidateText.length).toBeLessThan(sourceText.length);
    expect(summaryV3StyleLocalSemanticDecision(snapshot, candidateText)).toBe('unresolved');
    expect(summaryV3StyleCandidateRepresentsRequiredFacts(snapshot, candidateText)).toBe(false);
    const { result, calls } = await run(request, candidateText);
    expect(result).toMatchObject({ kind: 'candidate_ready', style: 'shorter', mode: 'enhance_existing_content' });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it.each(localeCases)('rejects material-predicate loss for %s through evaluator evidence', async (locale, sourceText, _candidateText, _role, _employer, negativeText) => {
    const request = localeRequest(locale, sourceText);
    const { result, calls, evaluatorMissing } = await run(request, negativeText, (input) => input.requiredFacts);
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true } });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
    expect(evaluatorMissing[0]?.length).toBeGreaterThan(0);
  });

  it.each([
    ['maintenance', 'diagnosing and resolving electrical faults, and supporting electrical component installation.'],
    ['fault resolution', 'maintaining electrical systems and supporting electrical component installation.'],
    ['installation support', 'maintaining electrical systems, diagnosing and resolving electrical faults.'],
  ] as const)('rejects canonical loss of %s after evaluator partition', async (_label, body) => {
    const candidate = `I have about three years of experience and currently work as an Electrical Service Technician at NordWerk Elektroservice Test, ${body}`;
    const selector = _label === 'maintenance' ? missingByText('maintenance') : _label === 'fault resolution' ? missingByText('faults') : missingByText('installation');
    const { result, calls, evaluatorMissing } = await run(canonicalRequest(), candidate, selector);
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true, writerOutputContractFailureClass: null } });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
    expect(evaluatorMissing[0]?.length).toBeGreaterThan(0);
  });

  it('rejects a true two-of-three duty candidate through the single evaluator', async () => {
    const candidate = 'I have about three years of experience and currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems and diagnosing electrical faults.';
    const { result, calls } = await run(canonicalRequest(), candidate, missingByText('installation'));
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true } });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it.each([
    ['installation support -> removing electrical components', 'maintaining electrical systems, diagnosing and resolving electrical faults, and removing electrical components.', 'installation'],
    ['fault resolution -> reporting electrical faults', 'maintaining electrical systems, reporting electrical faults, and supporting electrical component installation.', 'faults'],
    ['maintenance -> replacing electrical systems', 'replacing electrical systems, diagnosing and resolving electrical faults, and supporting electrical component installation.', 'maintenance'],
    ['maintenance -> not maintaining electrical systems', 'not maintaining electrical systems, diagnosing and resolving electrical faults, and supporting electrical component installation.', 'maintenance'],
    ['fault resolution -> observing electrical faults only', 'maintaining electrical systems, observing electrical faults only, and supporting electrical component installation.', 'faults'],
    ['installation support -> inspecting electrical components', 'maintaining electrical systems, diagnosing and resolving electrical faults, and inspecting electrical components.', 'installation'],
  ] as const)('rejects adversarial predicate: %s with evaluator ownership', async (_label, body, missingToken) => {
    const candidate = `I have about three years of experience and currently work as an Electrical Service Technician at NordWerk Elektroservice Test, ${body}`;
    const { result, calls, evaluatorMissing } = await run(canonicalRequest(), candidate, missingByText(missingToken));
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true, writerOutputContractFailureClass: null } });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
    expect(evaluatorMissing[0]?.length).toBeGreaterThan(0);
  });

  it('keeps writer fact IDs as binding metadata rather than semantic authorization', async () => {
    const candidate = 'I have about three years of experience and currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems.';
    const { result, calls, evaluatorMissing } = await run(canonicalRequest(), candidate, missingByText('installation'));
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true } });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
    expect(evaluatorMissing[0]?.length).toBeGreaterThan(0);
  });

  it('keeps employment semantics owned by the existing frame decision', async () => {
    const current = await run(canonicalRequest(), compactCanonical);
    expect(current.result).toMatchObject({ kind: 'candidate_ready' });
    const neutralCandidate = 'I have about three years of experience; Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems, diagnosing and resolving electrical faults, and supporting electrical component installation for 36 months.';
    const neutral = await run(canonicalRequest(), neutralCandidate);
    expect(neutral.result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: { evaluatorReached: true } });
    const former = await run(canonicalRequest(), compactCanonical.replace('currently work', 'formerly worked'));
    expect(former.result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim', evidence: { evaluatorReached: true, sourceFloorMismatchClass: 'employment_state_contradiction' } });
    const contradictoryCandidate = 'I currently work at NordWerk Elektroservice Test and previously worked as an Electrical Service Technician, maintaining systems, diagnosing electrical faults, and supporting component installation for three years.';
    const contradictory = await run(canonicalRequest(), contradictoryCandidate);
    expect(contradictory.result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim', evidence: { evaluatorReached: true, sourceFloorMismatchClass: 'employment_state_contradiction' } });
  });
});
