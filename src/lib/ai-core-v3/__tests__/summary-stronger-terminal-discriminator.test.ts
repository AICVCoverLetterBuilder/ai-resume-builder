import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3StyleEvidence,
  type SummaryV3StylePhase,
  type SummaryV3StyleRequest,
  type SummaryV3StyleResult,
  type SummaryV3StyleViolationCode,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleServer,
  type SummaryV3StyleEvaluatorInput,
  type SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';
import { createSummaryStrongerTerminalDiagnostic } from '../summary-v3-production-observability';

const source = 'Ava Patel currently works as a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';
const strengthened = source.replace('builds reliable', 'engineers reliable');
const localSource = 'I currently work as a Product Engineer at Atlas.';
// Preserve every source-floor word but remove the recognized prefix-bound
// employment frame. This reaches the real post-evaluator local guard.
const neutral = 'I as a Product Engineer at Atlas, currently work.';

function request(): SummaryV3StyleRequest {
  return {
    enabled: true, operation: 'summary_stronger', operationId: 'terminal-discriminator-052',
    style: 'stronger', requestedLocale: 'en', sourceLocale: 'en', visibleSummary: source,
    protectedEntities: ['Ava Patel'], createdAt: 1_700_000_000_000,
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' }, { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' }, { id: 'duty-api', text: 'builds reliable APIs' },
      { id: 'duty-mentor', text: 'mentors peers' }, { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' },
    ],
    manifest: {
      manifestId: 'diagnostic-manifest', contextId: 'diagnostic-context', sourceLocale: 'en', currentRoleEntryId: 'current',
      entries: [{
        stableId: 'current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24,
        facts: [{ id: 'api', text: 'builds reliable APIs' }, { id: 'mentor', text: 'mentors peers' },
          { id: 'metric', text: 'improved delivery by 20%' }],
      }],
    },
  };
}

function writer(input: SummaryV3StyleWriterInput, text: string) {
  return {
    toolName: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: {
      operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale,
      units: [{ unitId: 'candidate-1', text, factIds: input.requiredFacts.map((fact) => fact.id) }],
    },
  };
}

type Finding = Readonly<{ phase: SummaryV3StylePhase; code: SummaryV3StyleViolationCode; repairable: boolean }>;

function evaluator(input: SummaryV3StyleEvaluatorInput, findings: readonly Finding[] = [], noOp = false) {
  const phases = Object.fromEntries(([
    'structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment',
  ] as const).map((phase) => {
    const selected = findings.filter((finding) => finding.phase === phase);
    return [phase, {
      status: selected.length ? 'failed' : 'passed',
      violations: selected.map((finding) => ({
        code: finding.code, repairable: finding.repairable,
        factIdHashes: [input.requiredFacts[0]!.hash],
        unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)],
      })),
    }];
  }));
  const missing = findings.some((finding) => finding.phase === 'semantic_grounding' && finding.code === 'missing_fact');
  return {
    toolName: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, contentBlockCount: 1, textBlockCount: 0, toolBlockCount: 1,
    input: {
      operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
      style: input.style, locale: input.locale, candidateHash: input.candidate.hash,
      candidateUnitHashes: input.candidate.units.map(summaryV3StyleCandidateUnitHash), phases,
      representedFactIdHashes: input.requiredFacts.slice(missing ? 1 : 0).map((fact) => fact.hash),
      missingFactIdHashes: missing ? [input.requiredFacts[0]!.hash] : [], roleIdentityResolution: 'not_required',
      styleEvidence: {
        style: 'stronger', strongerPredicateTransformations: 1, structuralStrengtheningCount: 1,
        modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0, stackedModifierDetected: false,
        unsupportedAuthorityDetected: false, strongerFulfilled: true, noOpDetected: noOp,
      },
    },
  };
}

function event(result: SummaryV3StyleResult) {
  return createSummaryStrongerTerminalDiagnostic({
    requestId: 'fra1::synthetic-052', requestedLocale: 'en', mode: 'enhance_existing_content',
    httpStatus: result.kind === 'candidate_ready' || result.kind === 'safe_no_op' ? 200 : 422, result,
  });
}

async function run(options: {
  text?: string; findings?: readonly Finding[]; noOp?: boolean;
  providerFailure?: 'writer' | 'evaluator'; malformedEvaluator?: boolean;
  repair?: 'malformed' | 'evaluator_loss' | 'local_loss';
  localFixture?: boolean;
} = {}) {
  const calls: string[] = [];
  const fixture = request();
  const result = await executeSummaryV3StyleServer(options.localFixture
    ? { ...fixture, visibleSummary: localSource, visibleSummaryFacts: [], protectedEntities: [] } : fixture, {
    async write(input) {
      calls.push('writer');
      if (options.providerFailure === 'writer') throw new Error('synthetic writer error');
      return writer(input, options.text ?? strengthened);
    },
    async evaluate(input) {
      calls.push('evaluator');
      if (options.providerFailure === 'evaluator') throw new Error('synthetic evaluator error');
      return options.malformedEvaluator ? { malformed: true } : evaluator(input, options.findings, options.noOp);
    },
    async repairWrite(input) {
      calls.push('repair_writer');
      if (options.repair === 'malformed') return { malformed: true };
      return writer(input, options.repair === 'local_loss' ? neutral : strengthened);
    },
    async repairEvaluate(input) {
      calls.push('repair_evaluator');
      return evaluator(input, options.repair === 'evaluator_loss'
        ? [{ phase: 'semantic_grounding', code: 'lost_source_fact', repairable: false }] : []);
    },
  });
  return { result, calls, diagnostic: event(result) };
}

describe('Summary Stronger terminal evaluator/local discriminator', () => {
  it.each([false, true])('preserves unrepairable evaluator lost_source_fact despite repairable=%s', async (repairable) => {
    const { result, diagnostic, calls } = await run({
      findings: [{ phase: 'semantic_grounding', code: 'lost_source_fact', repairable }],
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(diagnostic).toMatchObject({
      writerResult: 'accepted', writerFailureClass: null, coveredFactCount: 11, missingFactCount: 0,
      terminalLayer: 'evaluator_validation', terminalReason: 'lost_source_fact',
      evaluatorTerminalPhase: 'semantic_grounding', evaluatorViolationCode: 'lost_source_fact',
      evaluatorViolationRepairable: repairable, postEvaluatorLocalFailureClass: null,
      finalApplyEligible: false, usageDecision: 'no_increment', repairAttempted: false,
    });
    expect(calls).toEqual(['writer', 'evaluator']);
  });

  it('identifies the local employment-state guard after an otherwise passed evaluator', async () => {
    const { result, diagnostic, calls } = await run({ text: neutral, localFixture: true });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(diagnostic).toMatchObject({
      terminalLayer: 'evaluator_validation', writerResult: 'accepted', writerFailureClass: null,
      evaluatorAttempted: true, evaluatorTerminalPhase: null, evaluatorViolationCode: null,
      evaluatorViolationRepairable: null, postEvaluatorLocalFailureClass: 'employment_source_state_preservation',
      finalApplyEligible: false, usageDecision: 'no_increment', repairAttempted: false,
    });
    expect(calls).toEqual(['writer', 'evaluator']);
  });

  it('does not claim an evaluator terminal when a higher-priority local guard wins', async () => {
    const { result, diagnostic } = await run({ text: neutral, localFixture: true,
      findings: [{ phase: 'semantic_grounding', code: 'unsupported_claim', repairable: false }],
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(diagnostic).toMatchObject({ evaluatorTerminalPhase: null, evaluatorViolationCode: null,
      evaluatorViolationRepairable: null, postEvaluatorLocalFailureClass: 'employment_source_state_preservation' });
  });

  it('records a rejected evaluator no-op without changing the existing terminal or calls', async () => {
    const { result, diagnostic, calls } = await run({ noOp: true,
      findings: [{ phase: 'semantic_grounding', code: 'lost_source_fact', repairable: false }],
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(diagnostic).toMatchObject({ evaluatorViolationCode: 'lost_source_fact', postEvaluatorLocalFailureClass: null });
    expect(calls).toEqual(['writer', 'evaluator']);
  });

  it('retains the Task 050 initial source-lock classification and bounded details', async () => {
    const { result, diagnostic, calls } = await run({ text: strengthened.replace('Atlas', 'Beacon') });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'lost_source_fact' });
    expect(diagnostic).toMatchObject({ terminalLayer: 'writer_output', writerResult: 'rejected',
      writerFailureClass: 'source_lock_preservation', sourceLockFailureKind: 'employer',
      sourceLockFailureReason: 'identity_surface_missing', evaluatorAttempted: false,
      evaluatorTerminalPhase: null, evaluatorViolationCode: null, evaluatorViolationRepairable: null,
      postEvaluatorLocalFailureClass: null });
    expect(calls).toEqual(['writer']);
  });

  it.each(['writer', 'evaluator'] as const)('keeps %s provider failures above validation topology', async (providerFailure) => {
    const { result, diagnostic, calls } = await run({ providerFailure });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: `${providerFailure}_request_failed` });
    expect(diagnostic).toMatchObject({ terminalLayer: 'provider_transport', evaluatorTerminalPhase: null,
      evaluatorViolationCode: null, evaluatorViolationRepairable: null, postEvaluatorLocalFailureClass: null });
    expect(calls).toEqual(providerFailure === 'writer' ? ['writer'] : ['writer', 'evaluator']);
  });

  it('classifies malformed evaluator output at evaluator topology without inventing a semantic code', async () => {
    const { result, diagnostic } = await run({ malformedEvaluator: true });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    expect(diagnostic).toMatchObject({ terminalLayer: 'evaluator_validation', evaluatorViolationCode: null,
      evaluatorTerminalPhase: null, evaluatorViolationRepairable: null, postEvaluatorLocalFailureClass: null });
  });

  it.each(['malformed', 'evaluator_loss', 'local_loss'] as const)('uses repair topology for %s terminals', async (repair) => {
    const { result, diagnostic, calls } = await run({ text: repair === 'local_loss' ? localSource : source,
      repair, localFixture: repair === 'local_loss',
      findings: [{ phase: 'style_fulfillment', code: 'style_not_fulfilled', repairable: true }],
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: repair === 'malformed'
      ? 'repair_transport_malformed' : repair === 'local_loss' ? 'lost_source_fact' : 'repair_rejected' });
    expect(diagnostic).toMatchObject({ terminalLayer: 'repair_validation', repairAttempted: true,
      finalApplyEligible: false, usageDecision: 'no_increment' });
    expect(calls).toEqual(repair === 'malformed' ? ['writer', 'evaluator', 'repair_writer']
      : ['writer', 'evaluator', 'repair_writer', 'repair_evaluator']);
    if (repair === 'evaluator_loss') expect(diagnostic).toMatchObject({ evaluatorViolationCode: 'lost_source_fact',
      evaluatorTerminalPhase: 'semantic_grounding', evaluatorViolationRepairable: false, postEvaluatorLocalFailureClass: null });
    if (repair === 'local_loss') expect(diagnostic).toMatchObject({ evaluatorViolationCode: null,
      postEvaluatorLocalFailureClass: 'employment_source_state_preservation' });
  });

  it.each([
    ['unsupported_claim', 'unsupported_metric', 'semantic_grounding', 'lost_source_fact'],
    ['lost_source_fact', 'missing_fact', 'semantic_grounding', 'stale_identity'],
    ['stale_identity', 'stale_identity', 'structural', 'invalid_language'],
    ['invalid_language_or_native_surface', 'invalid_native_surface', 'language_native_quality', 'style_not_fulfilled'],
    ['style_not_fulfilled', 'modifier_only_change', 'style_fulfillment', 'malformed_candidate'],
    ['evaluator_rejected', 'malformed_candidate', 'structural', 'safe_no_op'],
  ] as const)('shares existing %s precedence with the diagnostic selector', async (reason, code, phase, lowerPriorityCode) => {
    const { result, diagnostic } = await run({ findings: [
      { phase: 'structural', code: lowerPriorityCode, repairable: false },
      { phase, code, repairable: false },
    ] });
    // Stronger may retain the original source for unsupported claims; its
    // success diagnostic must not claim a terminal evaluator rejection.
    if (reason === 'unsupported_claim') {
      expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
      expect(diagnostic).toMatchObject({ terminalLayer: 'terminal_success', evaluatorViolationCode: null });
    } else {
      expect(result).toMatchObject({ kind: 'handled_failure', typedReason: reason });
      expect(diagnostic).toMatchObject({ evaluatorTerminalPhase: phase,
        evaluatorViolationCode: reason === 'evaluator_rejected' ? lowerPriorityCode : code,
        evaluatorViolationRepairable: false, postEvaluatorLocalFailureClass: null });
    }
  });

  it('leaves candidate success evidence and the size-gated path unchanged', async () => {
    const { result, diagnostic, calls } = await run();
    expect(result.kind).toBe('candidate_ready');
    expect(diagnostic).toMatchObject({ terminalLayer: 'terminal_success', finalApplyEligible: true,
      usageDecision: 'increment', evaluatorTerminalPhase: null, evaluatorViolationCode: null,
      evaluatorViolationRepairable: null, postEvaluatorLocalFailureClass: null });
    if (result.kind === 'candidate_ready') {
      expect(result.evidence).not.toHaveProperty('evaluatorTerminalPhase');
      expect(result.evidence).not.toHaveProperty('postEvaluatorLocalFailureClass');
      expect(JSON.stringify(result.evidence).length).toBeLessThan(8_192);
    }
    expect(calls).toEqual(['writer', 'evaluator']);
  });

  it('keeps the new event fields finite and suppresses arbitrary raw strings', async () => {
    const { result, diagnostic } = await run({ findings: [{ phase: 'semantic_grounding', code: 'lost_source_fact', repairable: false }] });
    expect(JSON.stringify(diagnostic)).not.toMatch(/Ava Patel|Atlas|Product Engineer|reliable APIs|factIdHashes|unitHashes|sourceText|prompt|providerOutput/);
    expect(JSON.stringify(diagnostic).length).toBeLessThan(1_500);
    if (result.kind !== 'handled_failure') throw new Error('Expected synthetic validation rejection');
    const canary = 'PRIVATE_RAW_CONTENT_052'.repeat(1_000);
    const unsafe = { ...result, evidence: { ...result.evidence,
      evaluatorTerminalPhase: canary, evaluatorViolationCode: canary,
      evaluatorViolationRepairable: canary, postEvaluatorLocalFailureClass: canary,
    } as unknown as SummaryV3StyleEvidence };
    const before = JSON.stringify(unsafe);
    expect(event(unsafe)).toMatchObject({ evaluatorTerminalPhase: null, evaluatorViolationCode: null,
      evaluatorViolationRepairable: null, postEvaluatorLocalFailureClass: null });
    expect(JSON.stringify(event(unsafe))).not.toContain('PRIVATE_RAW_CONTENT_052');
    expect(JSON.stringify(unsafe)).toBe(before);
  });
});
