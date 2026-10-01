import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  SUMMARY_V3_STYLE_MAX_TOTAL_FACTS,
  createSummaryV3StyleCandidate,
  createSummaryV3StyleOperationSnapshot,
  inspectSummaryV3StyleCandidatePreservesLocks,
  summarizeSummaryV3StyleSourceLockDiagnostics,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3StyleEvidence,
  type SummaryV3StyleRequest,
  type SummaryV3StyleResult,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleServer,
  type SummaryV3StyleEvaluatorInput,
  type SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';
import { executeSummaryV3StyleRoute, type SummaryV3StyleProviderInvocation } from '../summary-style-m5-provider';
import { createSummaryStrongerTerminalDiagnostic } from '../summary-v3-production-observability';

// Fictional, local-only fixtures. Never a reconstruction of the physical CV.
const source = 'Ava Patel works as a Product Engineer at Atlas for 24 months. She builds reliable APIs. She mentors peers. She prepares reports. She supports colleagues.';
const serbianSource = 'Mila Petrović radi kao tehničar u firmi Atlas tokom 24 meseca. Održava uređaje. Otklanja kvarove. Priprema dokumentaciju. Pomaže kolegama.';
const fields = ['sourceLockOrigin', 'sourceLockSurfaceMatchClass', 'sourceLockRequiredFactBindingCount', 'sourceLockDeclaredFactBindingCount'] as const;
const nullDiagnostics = Object.fromEntries(fields.map((field) => [field, null]));

function request(sr = false): SummaryV3StyleRequest {
  return {
    enabled: true, operation: 'summary_stronger', operationId: sr ? 'source-lock-055-sr' : 'source-lock-055-en',
    style: 'stronger', requestedLocale: sr ? 'sr' : 'en', sourceLocale: sr ? 'sr' : 'en',
    visibleSummary: sr ? serbianSource : source, protectedEntities: [sr ? 'Mila Petrović' : 'Ava Patel'],
    createdAt: 1_700_000_000_000,
    manifest: {
      manifestId: 'source-lock-manifest', contextId: 'source-lock-context', sourceLocale: sr ? 'sr' : 'en',
      currentRoleEntryId: 'entry', entries: [{
        stableId: 'entry', role: sr ? 'tehničar' : 'Product Engineer', employer: 'Atlas',
        durationMonths: 24, employmentState: 'present',
        facts: [{ id: 'duty', text: sr ? 'Održava uređaje' : 'builds reliable APIs' }],
      }],
    },
  };
}

function writer(input: SummaryV3StyleWriterInput, text: string) {
  return {
    toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: { operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale,
      units: [{ unitId: 'unit', text, factIds: input.requiredFacts.map((fact) => fact.id) }] },
  };
}

function evaluator(input: SummaryV3StyleEvaluatorInput, noOp = true) {
  return {
    toolName: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: {
      operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale, candidateHash: input.candidate.hash,
      candidateUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash),
      phases: Object.fromEntries(['structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment']
        .map((phase) => [phase, { status: 'passed', violations: [] }])),
      representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash), missingFactIdHashes: [],
      roleIdentityResolution: 'not_required',
      styleEvidence: { style: 'stronger', strongerPredicateTransformations: noOp ? 0 : 1, structuralStrengtheningCount: noOp ? 0 : 1,
        modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0, stackedModifierDetected: false,
        unsupportedAuthorityDetected: false, strongerFulfilled: true, noOpDetected: noOp },
    },
  };
}

function event(result: SummaryV3StyleResult) {
  return createSummaryStrongerTerminalDiagnostic({ requestId: 'fra1::synthetic-055', requestedLocale: 'sr',
    mode: 'enhance_existing_content', httpStatus: result.kind === 'handled_failure' ? 422 : 200, result });
}

async function run(fixture: SummaryV3StyleRequest, text: string, failure?: 'writer' | 'evaluator' | 'malformed', noOp = true) {
  const calls: string[] = [];
  const result = await executeSummaryV3StyleServer(fixture, {
    async write(input) { calls.push('writer');
      if (failure === 'writer') throw new Error('synthetic writer failure');
      return failure === 'malformed' ? {} : writer(input, text); },
    async evaluate(input) { calls.push('evaluator');
      if (failure === 'evaluator') throw new Error('synthetic evaluator failure');
      return evaluator(input, noOp); },
    async repairWrite() { calls.push('repair_writer'); throw new Error('unexpected repair'); },
    async repairEvaluate() { calls.push('repair_evaluator'); throw new Error('unexpected repair evaluator'); },
  });
  return { result, calls, diagnostic: event(result) };
}

function inspect(fixture: SummaryV3StyleRequest, text: string, declared = true) {
  const snapshot = createSummaryV3StyleOperationSnapshot(fixture);
  const candidate = createSummaryV3StyleCandidate(snapshot, [{ unitId: 'unit', text,
    factIds: declared ? snapshot.requiredFacts.map((fact) => fact.id) : [] }]);
  const inspection = inspectSummaryV3StyleCandidatePreservesLocks(snapshot, text);
  const diagnostic = summarizeSummaryV3StyleSourceLockDiagnostics(snapshot, candidate, inspection);
  return { snapshot, candidate, inspection, diagnostic };
}

async function providerRun(sr: boolean) {
  const invocations: SummaryV3StyleProviderInvocation[] = [];
  const fixture = request(sr);
  const result = await executeSummaryV3StyleRoute(fixture, {
    timeoutForPhase: () => 20_000,
    async invoke(invocation) {
      invocations.push(invocation);
      const reply = invocation.role === 'writer'
        ? writer(invocation.input as SummaryV3StyleWriterInput, fixture.visibleSummary)
        : evaluator(invocation.input as SummaryV3StyleEvaluatorInput);
      return { content: [{ type: 'tool_use', name: reply.toolName, input: reply.input }] };
    },
  });
  return { result, invocations, snapshot: createSummaryV3StyleOperationSnapshot(fixture) };
}

// Exact baseline 2f7edcc captures: complete snapshots and outbound invocations
// (including prompt, tool schema, input, model-independent transport settings).
const baselineParity = {
  en: { snapshot: 'b0e3d33cc4ddd21707bb05edb5bfbb26940966bec752fa5069cceb59d754744e',
    writer: 'f8fb3210c7c76d16ada8052ef42d900f2b49a93dcffa4e496500480a691924a5',
    evaluator: '15c17010ab92073a009f4b381b400b276fa9f67f5005203c757c1e5e1bd32ce7' },
  sr: { snapshot: '4730c36d9b0cf00fa638e6a2f62eaf0d9b6afe159a436cf60e69b3598fc3e2af',
    writer: 'e6cad85c3c5391ef26ea3330e83dc23f664fdd54dcbbffd17c161f999094cb3b',
    evaluator: '86733faacae39a15fcaae5bbad736dc80356ae4443c79467747d4c013f721d33' },
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

describe('Task 055 diagnostics-only source-lock origin and match topology', () => {
  it('A/G/H. reports a protected lock and one declared binding at the 5/5 writer-only rejection', async () => {
    const { result, calls, diagnostic } = await run(request(), source.replace('Ava Patel', 'she'));
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact', evidence: {
      writerOutputContractFailureClass: 'source_lock_preservation', coveredFactCount: 5, missingFactCount: 0,
      sourceLockOrigin: 'protected_entity', sourceLockSurfaceMatchClass: 'absent_exact_surface',
      sourceLockRequiredFactBindingCount: 1, sourceLockDeclaredFactBindingCount: 1,
    } });
    expect(diagnostic).toMatchObject({ sourceLockOrigin: 'protected_entity', sourceLockFailedIndex: 3,
      sourceLockFailureKind: 'entity', sourceLockFailureReason: 'identity_surface_missing',
      sourceLockSurfaceMatchClass: 'absent_exact_surface', sourceLockRequiredFactBindingCount: 1,
      sourceLockDeclaredFactBindingCount: 1, terminalLayer: 'writer_output', evaluatorAttempted: false,
      repairAttempted: false, usageDecision: 'no_increment', finalApplyEligible: false,
      evaluatorTerminalPhase: null, evaluatorViolationCode: null,
      evaluatorViolationRepairable: null, postEvaluatorLocalFailureClass: null });
    expect(calls).toEqual(['writer']);
  });

  it('B. records automatic origin at construction rather than guessing from an identity value', async () => {
    const fixture = { ...request(), protectedEntities: [],
      visibleSummary: source.replace('Ava Patel', 'Mira').replace('She mentors peers.', 'Nora mentors peers.') };
    const { diagnostic, calls } = await run(fixture, fixture.visibleSummary.replace('Nora', 'she'));
    expect(diagnostic).toMatchObject({ sourceLockOrigin: 'automatic_relation_subject',
      sourceLockFailureKind: 'entity', sourceLockSurfaceMatchClass: 'absent_exact_surface' });
    expect(calls).toEqual(['writer']);
  });

  it('C. preserves the Serbian automatic-capitalized-verb rejection without policy repair', async () => {
    const fixture = request(true);
    expect(inspect(fixture, serbianSource).inspection.preserved).toBe(true);
    const { diagnostic, calls } = await run(fixture, serbianSource.replace('. Održava', '. održava'));
    expect(diagnostic).toMatchObject({ sourceLockOrigin: 'automatic_relation_subject', sourceLockFailedIndex: 4,
      sourceLockFailureKind: 'entity', sourceLockFailureReason: 'identity_surface_missing',
      sourceLockSurfaceMatchClass: 'case_variant_only', sourceLockRequiredFactBindingCount: 1,
      sourceLockDeclaredFactBindingCount: 1, coveredFactCount: 5, missingFactCount: 0 });
    expect(calls).toEqual(['writer']);
  });

  it.each([
    ['case-only', 'ava patel', 'case_variant_only'],
    ['longer token', 'Ava Patelson', 'exact_surface_nonstandalone_only'],
    ['missing', 'she', 'absent_exact_surface'],
    ['internal punctuation', 'Ava-Patel', 'absent_exact_surface'],
  ] as const)('D/E. diagnoses %s without changing literal rejection', (_name, replacement, matchClass) => {
    const value = inspect(request(), source.replace('Ava Patel', replacement));
    expect(value.inspection).toMatchObject({ preserved: false, failureKind: 'entity', failureReason: 'identity_surface_missing' });
    expect(value.diagnostic).toMatchObject({ sourceLockOrigin: 'protected_entity', sourceLockSurfaceMatchClass: matchClass });
  });

  it('F. preserves context-specific rejection despite a present normalized standalone surface', async () => {
    const { diagnostic, calls } = await run(request(), source.replace('Ava Patel', 'Priya Ava Patel'));
    expect(diagnostic).toMatchObject({ sourceLockFailureReason: 'identity_unattested_prefix',
      sourceLockOrigin: 'protected_entity', sourceLockSurfaceMatchClass: 'normalized_standalone_present' });
    expect(calls).toEqual(['writer']);
  });

  it('H. counts only declared IDs belonging to the literal required-fact binding', () => {
    const value = inspect(request(), source.replace('Ava Patel', 'she'), false);
    expect(value.diagnostic).toMatchObject({ sourceLockRequiredFactBindingCount: 1, sourceLockDeclaredFactBindingCount: 0 });
  });

  it('I. returns zero binding when a protected identity crosses existing fact delimiters', () => {
    const fixture = { ...request(), visibleSummary: source.replace('Ava Patel', 'Patel, Ava'), protectedEntities: ['Patel, Ava'] };
    const value = inspect(fixture, fixture.visibleSummary.replace('Patel, Ava', 'she'));
    expect(value.inspection).toMatchObject({ preserved: false, failureKind: 'entity' });
    expect(value.diagnostic).toMatchObject({ sourceLockOrigin: 'protected_entity',
      sourceLockRequiredFactBindingCount: 0, sourceLockDeclaredFactBindingCount: 0 });
  });

  it.each([
    ['role', 'Product Engineer', 'Product Developer', 'manifest_role'],
    ['employer', 'Atlas', 'Beacon', 'manifest_employer'],
    ['duration', '24', '36', 'manifest_duration'],
  ] as const)('records filtered manifest %s origin without changing its lock shape', (_kind, before, after, origin) => {
    const value = inspect(request(), source.replace(before, after));
    expect(value.diagnostic.sourceLockOrigin).toBe(origin);
    for (const lock of value.snapshot.entityLocks) expect(Object.keys(lock).sort()).toEqual(['hash', 'kind', 'value']);
    if (origin === 'manifest_duration') expect(value.diagnostic.sourceLockSurfaceMatchClass).toBe('not_applicable');
  });

  it('uses unknown when a detached snapshot lacks construction provenance; never guesses from text', () => {
    const value = inspect(request(), source.replace('Ava Patel', 'she'));
    const detached = { ...value.snapshot };
    expect(summarizeSummaryV3StyleSourceLockDiagnostics(detached, value.candidate, value.inspection))
      .toMatchObject({ sourceLockOrigin: 'unknown', sourceLockRequiredFactBindingCount: 1 });
  });

  it('keeps construction origins aligned after manifest filtering and shorter-role subsumption', () => {
    const base = request();
    const fixture = { ...base, manifest: { ...base.manifest, entries: [...base.manifest.entries, {
      stableId: 'prior', role: 'Engineer', employer: 'Beacon', durationMonths: 12,
      employmentState: 'completed' as const, facts: [{ id: 'prior-duty', text: 'reviews reports' }],
    }] } };
    const value = inspect(fixture, source.replace('Ava Patel', 'she'));
    expect(value.inspection).toMatchObject({ failedIndex: 3, failureKind: 'entity' });
    expect(value.snapshot.entityLocks).toHaveLength(4);
    expect(value.diagnostic.sourceLockOrigin).toBe('protected_entity');
  });

  it('uses bounded nullable fallbacks for unavailable inspection or an invalid fact collection', () => {
    const value = inspect(request(), source.replace('Ava Patel', 'she'));
    const oversized = { ...value.snapshot, requiredFacts: Array.from({ length: SUMMARY_V3_STYLE_MAX_TOTAL_FACTS + 1 }, () => value.snapshot.requiredFacts[0]!) };
    for (const diagnostic of [
      summarizeSummaryV3StyleSourceLockDiagnostics(oversized, value.candidate, value.inspection),
      summarizeSummaryV3StyleSourceLockDiagnostics(value.snapshot, value.candidate, { ...value.inspection, failedIndex: null }),
    ]) expect(diagnostic).toEqual({ sourceLockOrigin: 'unknown', sourceLockSurfaceMatchClass: 'not_applicable',
      sourceLockRequiredFactBindingCount: null, sourceLockDeclaredFactBindingCount: null });
  });

  it.each(['writer', 'evaluator', 'malformed'] as const)('J. emits four nulls for the unrelated %s terminal', async (failure) => {
    expect((await run(request(), source, failure)).diagnostic).toMatchObject(nullDiagnostics);
  });

  it('J. emits four nulls for success, no-op, not-applicable and malformed request terminals', async () => {
    const { result, diagnostic } = await run(request(), source);
    expect(diagnostic).toMatchObject(nullDiagnostics);
    if (result.kind === 'handled_failure') throw new Error('Expected accepted no-op');
    expect(event({ kind: 'not_applicable', reason: 'feature_not_enabled' })).toMatchObject(nullDiagnostics);
    expect((await run({ ...request(), visibleSummary: '' }, source, 'writer')).diagnostic).toMatchObject(nullDiagnostics);
    expect((await run({ ...request(), manifest: null as unknown as SummaryV3StyleRequest['manifest'] }, source)).diagnostic)
      .toMatchObject(nullDiagnostics);
  });

  it('J. retains an accepted Stronger candidate and emits four nulls without changing usage eligibility', async () => {
    const acceptedSource = 'Ava Patel currently works as a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
    const base = request();
    const fixture = { ...base, visibleSummary: acceptedSource, manifest: { ...base.manifest,
      entries: [{ ...base.manifest.entries[0]!, facts: [
        { id: 'api', text: 'builds reliable APIs' }, { id: 'mentor', text: 'mentors peers' },
        { id: 'metric', text: 'improved delivery by 20%' },
      ] }] }, visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' }, { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' }, { id: 'api', text: 'builds reliable APIs' },
      { id: 'mentor', text: 'mentors peers' }, { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' },
    ] };
    const { result, calls, diagnostic } = await run(fixture, acceptedSource.replace('builds reliable', 'engineers reliable'), undefined, false);
    expect(result.kind).toBe('candidate_ready');
    expect(diagnostic).toMatchObject({ ...nullDiagnostics, finalApplyEligible: true, usageDecision: 'increment' });
    expect(calls).toEqual(['writer', 'evaluator']);
  });

  it('K. allowlists finite fields and bounds counts without leaking private strings or arrays', async () => {
    const { result } = await run(request(), source.replace('Ava Patel', 'she'));
    if (result.kind !== 'handled_failure') throw new Error('Expected writer rejection');
    const canary = 'PRIVATE_SOURCE_CANDIDATE_PROMPT_CREDENTIAL_055';
    const unsafe = { ...result, evidence: { ...result.evidence,
      sourceLockOrigin: canary, sourceLockSurfaceMatchClass: canary,
      sourceLockRequiredFactBindingCount: 257, sourceLockDeclaredFactBindingCount: -1,
      sourceText: canary, candidateText: canary, prompt: canary, factIds: [canary], headers: { token: canary },
    } as unknown as SummaryV3StyleEvidence };
    const before = JSON.stringify(unsafe);
    const projected = event(unsafe);
    expect(projected).toMatchObject({ sourceLockOrigin: 'unknown', sourceLockSurfaceMatchClass: 'not_applicable',
      sourceLockRequiredFactBindingCount: null, sourceLockDeclaredFactBindingCount: null });
    expect(JSON.stringify(projected)).not.toMatch(/PRIVATE_SOURCE|Ava Patel|Atlas|Product Engineer|factIds|sourceText|candidateText|prompt|headers/);
    expect(JSON.stringify(unsafe)).toBe(before);
    expect(event({ ...result, evidence: { ...result.evidence, sourceLockRequiredFactBindingCount: 1,
      sourceLockDeclaredFactBindingCount: 2 } })).toMatchObject({ sourceLockRequiredFactBindingCount: 1, sourceLockDeclaredFactBindingCount: null });
    expect(event({ ...result, evidence: { ...result.evidence, writerOutputContractFailureClass: 'required_fact_coverage' } }))
      .toMatchObject(nullDiagnostics);
  });

  it.each([false, true])('L. preserves exact baseline outbound prompt/request and snapshot identity for sr=%s', async (sr) => {
    const value = await providerRun(sr);
    expect(value.invocations.map((invocation) => invocation.phase)).toEqual(['initial_writer', 'initial_evaluator']);
    const expected = baselineParity[sr ? 'sr' : 'en'];
    expect(digest(value.snapshot)).toBe(expected.snapshot);
    expect(digest(value.invocations[0])).toBe(expected.writer);
    expect(digest(value.invocations[1])).toBe(expected.evaluator);
    for (const invocation of value.invocations) {
      for (const field of fields) expect(JSON.stringify(invocation)).not.toContain(field);
    }
  });
});
