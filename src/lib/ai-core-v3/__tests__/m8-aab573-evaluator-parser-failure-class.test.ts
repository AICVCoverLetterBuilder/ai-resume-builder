import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_EVALUATOR_OUTPUT_CONTRACT_FAILURE_CLASSES,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  projectSummaryV3StyleEvaluatorToolForProvider,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3StyleEvaluatorOutputContractFailureClass,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import { executeSummaryV3StyleServer, type SummaryV3StyleEvaluatorInput, type SummaryV3StyleWriterInput } from '../summary-style-m5-server';
import { executeSummaryV3StyleRoute } from '../summary-style-m5-provider';

const SOURCE = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';

function requestFor(): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: 'summary_stronger',
    operationId: 'm8-aab573-parser-failure-class',
    style: 'stronger',
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: SOURCE,
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' },
      { id: 'role', text: 'Product Engineer' },
      { id: 'employer', text: 'Atlas' },
      { id: 'duty-api', text: 'builds reliable APIs' },
      { id: 'duty-mentor', text: 'mentors peers' },
      { id: 'metric', text: 'improved delivery by 20%' },
      { id: 'duration', text: '24 months' },
    ],
    protectedEntities: ['Ava Patel'],
    manifest: {
      manifestId: 'm8-aab573-parser-failure-class-manifest',
      contextId: 'm8-aab573-parser-failure-class-context',
      sourceLocale: 'en',
      currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current',
        role: 'Product Engineer',
        employer: 'Atlas',
        employmentState: 'present',
        durationMonths: 24,
        facts: [
          { id: 'duty-api', text: 'builds reliable APIs' },
          { id: 'duty-mentor', text: 'mentors peers' },
          { id: 'metric', text: 'improved delivery by 20%' },
          { id: 'context-only-tool', text: 'Kubernetes' },
        ],
      }],
    },
    createdAt: 1_757_000_000_000,
  };
}

function writerEnvelope(input: SummaryV3StyleWriterInput): Record<string, unknown> {
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
      units: [{
        unitId: 'unit-0',
        text: input.sourceText,
        factIds: input.requiredFacts.map((fact) => fact.id),
      }],
    },
  };
}

function strongerEvidence(): Record<string, unknown> {
  return {
    style: 'stronger',
    strongerPredicateTransformations: 0,
    structuralStrengtheningCount: 0,
    modifierOnlyTransformationDetected: false,
    repeatedStyleModifierCount: 0,
    stackedModifierDetected: false,
    unsupportedAuthorityDetected: false,
    strongerFulfilled: true,
    noOpDetected: true,
  };
}

function phase(status: 'passed' | 'failed' = 'passed', violations: readonly Record<string, unknown>[] = []): Record<string, unknown> {
  return { status, violations };
}

function validViolation(input: SummaryV3StyleEvaluatorInput): Record<string, unknown> {
  return {
    code: 'unsupported_claim',
    factIdHashes: [input.requiredFacts[0]!.hash],
    unitHashes: [],
    repairable: false,
  };
}

function evaluatorEnvelope(input: SummaryV3StyleEvaluatorInput): Record<string, unknown> {
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
        structural: phase(),
        semantic_grounding: phase(),
        language_native_quality: phase(),
        style_fulfillment: phase(),
      },
      representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash),
      missingFactIdHashes: [],
      roleIdentityResolution: 'not_required',
      styleEvidence: strongerEvidence(),
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function runFullParser(
  mutate: (envelope: Record<string, unknown>, input: SummaryV3StyleEvaluatorInput) => void,
) {
  let evaluatorInput: SummaryV3StyleEvaluatorInput | null = null;
  const result = await executeSummaryV3StyleServer(requestFor(), {
    write: async (input) => writerEnvelope(input),
    evaluate: async (input) => {
      evaluatorInput = input;
      const envelope = evaluatorEnvelope(input);
      mutate(envelope, input);
      return envelope;
    },
  });
  return { result, evaluatorInput };
}

function parserClass(result: Awaited<ReturnType<typeof executeSummaryV3StyleServer>>): SummaryV3StyleEvaluatorOutputContractFailureClass | null {
  return result.kind === 'handled_failure'
    ? result.evidence.evaluatorOutputContractFailureClass
    : null;
}

function fullInput(envelope: Record<string, unknown>): Record<string, unknown> {
  return envelope.input as Record<string, unknown>;
}

function phases(envelope: Record<string, unknown>): Record<string, Record<string, unknown>> {
  return fullInput(envelope).phases as Record<string, Record<string, unknown>>;
}

describe('M8 AAB573 full evaluator parser failure classes', () => {
  it('keeps the accepted strict C2 normalizer path parser-valid with a null class', async () => {
    const result = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => 30_000,
      invoke: async (invocation) => {
        if (invocation.role === 'writer') {
          const input = invocation.input as SummaryV3StyleWriterInput;
          return {
            content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: writerEnvelope(input).input }],
          };
        }
        const input = invocation.input as SummaryV3StyleEvaluatorInput;
        const full = fullInput(evaluatorEnvelope(input));
        const c2 = {
          structuralStatus: 'passed', structuralViolations: [],
          semantic_groundingStatus: 'passed', semantic_groundingViolations: [],
          language_native_qualityStatus: 'passed', language_native_qualityViolations: [],
          style_fulfillmentStatus: 'passed', style_fulfillmentViolations: [],
          representedFactIdHashes: full.representedFactIdHashes,
          missingFactIdHashes: full.missingFactIdHashes,
          roleIdentityResolution: full.roleIdentityResolution,
          styleEvidence: (() => {
            const evidence = clone(full.styleEvidence as Record<string, unknown>);
            delete evidence.style;
            return evidence;
          })(),
        };
        return { content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, input: c2 }] };
      },
    });
    expect(result.kind).toBe('safe_no_op');
    if (result.kind === 'safe_no_op') expect(result.evidence.evaluatorOutputContractFailureClass).toBeNull();
  });

  it('binds every evaluator fact/unit reference to the immutable invocation domain', async () => {
    let evaluatorInvocation: { tool: { input_schema: unknown }; prompt: string } | null = null;
    let capturedInput: SummaryV3StyleEvaluatorInput | null = null;
    const result = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => 30_000,
      invoke: async (invocation) => {
        if (invocation.role === 'writer') {
          const input = invocation.input as SummaryV3StyleWriterInput;
          return { content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: writerEnvelope(input).input }] };
        }
        const currentInput = invocation.input as SummaryV3StyleEvaluatorInput;
        capturedInput = currentInput;
        const before = JSON.stringify(currentInput);
        const full = fullInput(evaluatorEnvelope(currentInput));
        const c2 = {
          structuralStatus: 'passed', structuralViolations: [],
          semantic_groundingStatus: 'passed', semantic_groundingViolations: [],
          language_native_qualityStatus: 'passed', language_native_qualityViolations: [],
          style_fulfillmentStatus: 'passed', style_fulfillmentViolations: [],
          representedFactIdHashes: full.representedFactIdHashes,
          missingFactIdHashes: full.missingFactIdHashes,
          roleIdentityResolution: full.roleIdentityResolution,
          styleEvidence: (() => {
            const evidence = clone(full.styleEvidence as Record<string, unknown>);
            delete evidence.style;
            return evidence;
          })(),
        };
        evaluatorInvocation = invocation;
        const after = JSON.stringify(currentInput);
        if (before !== after) throw new Error('provider schema projection mutated evaluator input');
        return { content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, input: c2 }] };
      },
    });
    expect(result.kind).toBe('safe_no_op');
    expect(evaluatorInvocation).not.toBeNull();
    expect(capturedInput).not.toBeNull();
    const currentInput = capturedInput as unknown as SummaryV3StyleEvaluatorInput;
    const invocation = evaluatorInvocation as unknown as { tool: { input_schema: unknown }; prompt: string };
    const allowedFacts = currentInput.requiredFacts.map((fact) => fact.hash);
    const allowedUnits = currentInput.candidate.units.map(summaryV3StyleCandidateUnitHash);
    expect(allowedFacts.length).toBeGreaterThan(0);
    expect(allowedUnits.length).toBeGreaterThan(0);
    const schema = invocation.tool.input_schema as Record<string, unknown>;
    const properties = schema.properties as Record<string, unknown>;
    const enumFor = (field: string): readonly unknown[] => {
      const property = properties[field] as Record<string, unknown>;
      const items = property.items as Record<string, unknown>;
      return items.enum as readonly unknown[];
    };
    expect(enumFor('representedFactIdHashes')).toEqual(allowedFacts);
    expect(enumFor('missingFactIdHashes')).toEqual(allowedFacts);
    for (const phase of ['structural', 'semantic_grounding', 'language_native_quality', 'style_fulfillment']) {
      const violations = properties[`${phase}Violations`] as Record<string, unknown>;
      const violationItems = violations.items as Record<string, unknown>;
      const violationProperties = violationItems.properties as Record<string, unknown>;
      const factItems = (violationProperties.factIdHashes as Record<string, unknown>).items as Record<string, unknown>;
      const unitItems = (violationProperties.unitHashes as Record<string, unknown>).items as Record<string, unknown>;
      expect(factItems.enum).toEqual(allowedFacts);
      expect(unitItems.enum).toEqual(allowedUnits);
    }
    for (const hash of [...allowedFacts, ...allowedUnits]) expect(invocation.prompt).toContain(hash);
    const first = JSON.stringify(projectSummaryV3StyleEvaluatorToolForProvider('stronger', {
      allowedFactHashes: allowedFacts, allowedUnitHashes: allowedUnits,
    }));
    const second = JSON.stringify(projectSummaryV3StyleEvaluatorToolForProvider('stronger', {
      allowedFactHashes: allowedFacts, allowedUnitHashes: allowedUnits,
    }));
    expect(first).toBe(second);
    expect(() => projectSummaryV3StyleEvaluatorToolForProvider('stronger', {
      allowedFactHashes: [allowedFacts[0]!, allowedFacts[0]!], allowedUnitHashes: allowedUnits,
    })).toThrow();
    expect(() => projectSummaryV3StyleEvaluatorToolForProvider('stronger', {
      allowedFactHashes: [], allowedUnitHashes: allowedUnits,
    })).toThrow();
    expect(() => projectSummaryV3StyleEvaluatorToolForProvider('stronger', {
      allowedFactHashes: allowedFacts, allowedUnitHashes: [allowedUnits[0]!, allowedUnits[0]!],
    })).toThrow();
  });

  const classCases: readonly Readonly<{
    readonly failureClass: SummaryV3StyleEvaluatorOutputContractFailureClass;
    readonly mutate: (envelope: Record<string, unknown>, input: SummaryV3StyleEvaluatorInput) => void;
  }>[] = [
    { failureClass: 'envelope_keyset', mutate: (envelope) => { delete envelope.textBlockCount; } },
    { failureClass: 'envelope_metadata', mutate: (envelope) => { envelope.toolName = 'wrong_tool'; } },
    { failureClass: 'payload_keyset', mutate: (envelope) => { delete fullInput(envelope).locale; } },
    { failureClass: 'immutable_identity', mutate: (envelope) => { fullInput(envelope).operationId = 'spoofed'; } },
    { failureClass: 'candidate_identity', mutate: (envelope) => { fullInput(envelope).candidateHash = 'spoofed'; } },
    { failureClass: 'fact_reference_shape', mutate: (envelope) => { fullInput(envelope).representedFactIdHashes = ['']; } },
    { failureClass: 'fact_reference_duplicates', mutate: (envelope) => {
      const input = fullInput(envelope);
      const fact = (input.representedFactIdHashes as string[])[0]!;
      input.representedFactIdHashes = [fact, fact];
    } },
    { failureClass: 'role_identity', mutate: (envelope) => { fullInput(envelope).roleIdentityResolution = 'unknown'; } },
    { failureClass: 'fact_reference_membership', mutate: (envelope) => {
      const input = fullInput(envelope);
      (input.representedFactIdHashes as string[])[0] = 'unknown-reference';
    } },
    { failureClass: 'fact_reference_overlap', mutate: (envelope) => {
      const input = fullInput(envelope);
      input.missingFactIdHashes = [(input.representedFactIdHashes as string[])[0]!];
    } },
    { failureClass: 'fact_reference_partition', mutate: (envelope) => {
      const input = fullInput(envelope);
      input.representedFactIdHashes = (input.representedFactIdHashes as string[]).slice(1);
    } },
    { failureClass: 'phase_keyset', mutate: (envelope) => { delete phases(envelope).structural; } },
    { failureClass: 'phase_shape', mutate: (envelope) => { phases(envelope).structural = null as unknown as Record<string, unknown>; } },
    { failureClass: 'phase_violation_shape', mutate: (envelope) => { phases(envelope).structural = phase('failed', [{}]); } },
    { failureClass: 'phase_violation_duplicates', mutate: (envelope, input) => {
      const violation = validViolation(input);
      violation.factIdHashes = [input.requiredFacts[0]!.hash, input.requiredFacts[0]!.hash];
      phases(envelope).structural = phase('failed', [violation]);
    } },
    { failureClass: 'phase_violation_reference_membership', mutate: (envelope, input) => {
      const violation = validViolation(input);
      violation.factIdHashes = ['unknown-reference'];
      phases(envelope).structural = phase('failed', [violation]);
    } },
    { failureClass: 'phase_status_consistency', mutate: (envelope, input) => {
      phases(envelope).structural = phase('passed', [validViolation(input)]);
    } },
    { failureClass: 'style_evidence_shape', mutate: (envelope) => { delete (fullInput(envelope).styleEvidence as Record<string, unknown>).noOpDetected; } },
    { failureClass: 'semantic_missing_fact_partition', mutate: (envelope, input) => {
      const payload = fullInput(envelope);
      const missing = (payload.representedFactIdHashes as string[])[0]!;
      payload.representedFactIdHashes = (payload.representedFactIdHashes as string[]).slice(1);
      payload.missingFactIdHashes = [missing];
      phases(envelope).semantic_grounding = phase('failed', [validViolation(input)]);
    } },
  ];

  it('keeps the complete finite class set covered by one deterministic mutation each', () => {
    expect(classCases.map((entry) => entry.failureClass)).toEqual(
      SUMMARY_V3_STYLE_M5_EVALUATOR_OUTPUT_CONTRACT_FAILURE_CLASSES,
    );
  });

  it.each(classCases)('returns $failureClass at the first authoritative parser predicate', async ({ failureClass, mutate }) => {
    const { result } = await runFullParser(mutate);
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    expect(parserClass(result)).toBe(failureClass);
  });

  it('keeps incomplete passed semantic coverage under its preceding partition class', async () => {
    const { result } = await runFullParser((envelope) => {
      const payload = fullInput(envelope);
      const missing = (payload.representedFactIdHashes as string[])[0]!;
      payload.representedFactIdHashes = (payload.representedFactIdHashes as string[]).slice(1);
      payload.missingFactIdHashes = [missing];
    });
    expect(result).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    expect(parserClass(result)).toBe('semantic_missing_fact_partition');
  });

  it('keeps semantic evaluator outcomes and evaluator request failures class-null', async () => {
    const semantic = await runFullParser((envelope, input) => {
      phases(envelope).semantic_grounding = phase('failed', [validViolation(input)]);
    });
    expect(semantic.result).toMatchObject({ kind: 'handled_failure', typedReason: 'unsupported_claim' });
    expect(parserClass(semantic.result)).toBeNull();

    for (const roleIdentityResolution of ['contradiction', 'unresolved']) {
      const role = await runFullParser((envelope) => { fullInput(envelope).roleIdentityResolution = roleIdentityResolution; });
      expect(parserClass(role.result)).toBeNull();
      expect(role.result).not.toMatchObject({ typedReason: 'evaluator_transport_malformed' });
    }

    const sdkFailure = await executeSummaryV3StyleServer(requestFor(), {
      write: async (input) => writerEnvelope(input),
      evaluate: async () => { throw new Error('synthetic evaluator sdk failure'); },
    });
    expect(sdkFailure).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_request_failed' });
    expect(parserClass(sdkFailure)).toBeNull();

    const timeoutFailure = await executeSummaryV3StyleServer(requestFor(), {
      write: async (input) => writerEnvelope(input),
      evaluate: async () => {
        const error = new Error('synthetic timeout');
        error.name = 'AbortError';
        throw error;
      },
    });
    expect(timeoutFailure).toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_request_failed' });
    expect(parserClass(timeoutFailure)).toBeNull();
  });
});
