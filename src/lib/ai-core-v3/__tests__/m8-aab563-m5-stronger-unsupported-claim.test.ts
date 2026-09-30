import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  createSummaryV3StyleCandidate,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  summarizeSummaryV3StyleFactCoverage,
  summaryV3StyleCandidatePreservesCalendarDateSurfaces,
  summaryV3StyleCandidatePreservesEntityFactBindings,
  summaryV3StyleCandidatePreservesExactMaterialSurfaces,
  summaryV3StyleCandidatePreservesLocks,
  summaryV3StyleCandidateRepresentsRequiredFacts,
  summaryV3StyleCandidateUnitsRepresentDeclaredFacts,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3StyleRequest,
  type SummaryV3StyleResult,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleServer,
  type SummaryV3StyleEvaluatorInput,
  type SummaryV3StyleWriterInput,
} from '../summary-style-m5-server';
import { createSummaryStrongerTerminalDiagnostic } from '../summary-v3-production-observability';

const source = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';

function request(overrides: Partial<SummaryV3StyleRequest> = {}): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: 'summary_stronger',
    operationId: 'm8-aab563-stronger-001',
    style: 'stronger',
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: source,
    visibleSummaryFacts: undefined,
    protectedEntities: undefined,
    manifest: {
      manifestId: 'm8-aab563-manifest',
      contextId: 'm8-aab563-context',
      sourceLocale: 'en',
      currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current',
        role: 'Electrical Service Technician',
        employer: 'NordWerk Elektroservice Test',
        employmentState: 'present',
        durationMonths: 36,
        facts: [
          { id: 'maintenance', text: 'Wartung elektrischer Anlagen' },
          { id: 'faults', text: 'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen' },
          { id: 'installation', text: 'Unterstützung bei der Installation elektrischer Komponenten' },
        ],
      }],
    },
    requestIdentity: 'm8-aab563-request-001',
    createdAt: 1_757_000_000_000,
    ...overrides,
  };
}

function unresolvedPhysicalRequest(visibleSummary = source): SummaryV3StyleRequest {
  return request({
    visibleSummary,
    manifest: {
      ...request().manifest,
      sourceLocale: 'en',
      entries: [{
        stableId: 'entry-current',
        role: 'Servicetechniker Elektrotechnik',
        employer: 'NordWerk Elektroservice Test',
        roleSourceLocale: 'de',
        employmentState: 'present',
        durationMonths: 37,
        facts: [
          { id: 'maintenance', text: 'Wartung elektrischer Anlagen' },
          { id: 'faults', text: 'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen' },
          { id: 'installation', text: 'Unterstützung bei der Installation elektrischer Komponenten' },
        ],
      }],
    },
  });
}

function writerEnvelope(input: SummaryV3StyleWriterInput, text: string) {
  const units = [{
    unitId: 'candidate-1',
    text,
    factIds: input.requiredFacts.map((fact) => fact.id),
  }];
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
      units,
    },
  };
}

function passingEvaluation(
  input: SummaryV3StyleEvaluatorInput,
  noOpDetected = false,
  roleIdentityResolution: unknown = input.roleIdentity.status === 'unresolved' ? 'equivalent' : 'not_required',
) {
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
        semantic_grounding: { status: 'passed', violations: [] },
        language_native_quality: { status: 'passed', violations: [] },
        style_fulfillment: { status: 'passed', violations: [] },
      },
      representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash),
      missingFactIdHashes: [],
      roleIdentityResolution,
      styleEvidence: {
        style: 'stronger',
        strongerPredicateTransformations: noOpDetected ? 0 : 1,
        structuralStrengtheningCount: noOpDetected ? 0 : 1,
        modifierOnlyTransformationDetected: false,
        repeatedStyleModifierCount: 0,
        stackedModifierDetected: false,
        unsupportedAuthorityDetected: false,
        strongerFulfilled: true,
        noOpDetected,
      },
    },
  };
}

async function runWithCandidate(
  candidateText: string,
  options: {
    noOp?: boolean;
    request?: SummaryV3StyleRequest;
    roleIdentityResolution?: unknown;
    omitRoleIdentityResolution?: boolean;
    evaluatorLostSourceFact?: boolean;
    repairWriterMalformed?: boolean;
  } = {},
) {
  const calls = { writer: 0, evaluator: 0 };
  const result = await executeSummaryV3StyleServer(options.request || request(), {
    async write(input) { calls.writer += 1; return writerEnvelope(input, candidateText); },
    async evaluate(input) {
      calls.evaluator += 1;
      const evaluation = passingEvaluation(
        input,
        options.noOp,
        Object.prototype.hasOwnProperty.call(options, 'roleIdentityResolution')
          ? options.roleIdentityResolution
          : input.roleIdentity.status === 'unresolved' ? 'equivalent' : 'not_required',
      );
      if (options.evaluatorLostSourceFact) {
        return {
          ...evaluation,
          input: {
            ...evaluation.input,
            phases: {
              ...evaluation.input.phases,
              semantic_grounding: {
                status: 'failed',
                violations: [{
                  code: 'lost_source_fact',
                  factIdHashes: [input.requiredFacts[0]!.hash],
                  unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)],
                  repairable: false,
                }],
              },
            },
            representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash),
            missingFactIdHashes: [],
          },
        };
      }
      if (options.repairWriterMalformed) {
        return {
          ...evaluation,
          input: {
            ...evaluation.input,
            phases: {
              ...evaluation.input.phases,
              style_fulfillment: {
                status: 'failed',
                violations: [{
                  code: 'style_not_fulfilled',
                  factIdHashes: [input.requiredFacts[0]!.hash],
                  unitHashes: [summaryV3StyleCandidateUnitHash(input.candidate.units[0]!)],
                  repairable: true,
                }],
              },
            },
          },
        };
      }
      if (!options.omitRoleIdentityResolution) return evaluation;
      const { roleIdentityResolution: _omitted, ...boundedInput } = evaluation.input;
      return { ...evaluation, input: boundedInput };
    },
    ...(options.repairWriterMalformed ? {
      async repairWrite() { return { malformed: true }; },
      async repairEvaluate(input: SummaryV3StyleEvaluatorInput) { return passingEvaluation(input); },
    } : {}),
  });
  return { result, calls };
}

type WriterUnitPlan = Readonly<{ readonly text: string; readonly factIndexes: readonly number[] }>;

function assertInitialWriterLostSourceFact(
  result: SummaryV3StyleResult,
  expectedClass: string,
  coveredFactCount: number,
  missingFactCount: number,
) {
  expect(result, JSON.stringify(result)).toMatchObject({
    kind: 'handled_failure',
    typedReason: 'lost_source_fact',
    evidence: {
      writerAttempts: 1,
      evaluatorAttempts: 0,
      writerCandidateReachedValidation: true,
      evaluatorReached: false,
      writerOutputContractFailureClass: expectedClass,
      coveredFactCount,
      missingFactCount,
    },
  });
  const event = createSummaryStrongerTerminalDiagnostic({
    requestId: 'm8-aab563-observability-test',
    requestedLocale: 'en',
    mode: 'enhance_existing_content',
    httpStatus: 422,
    result,
  });
  expect(event).toMatchObject({
    terminalLayer: 'writer_output',
    terminalReason: 'lost_source_fact',
    writerAttempted: true,
    writerResult: 'rejected',
    writerCandidateReachedValidation: true,
    writerFailureClass: expectedClass,
    coveredFactCount,
    missingFactCount,
    evaluatorAttempted: false,
    repairAttempted: false,
    repairProviderRequestAttempted: false,
    finalApplyEligible: false,
    usageDecision: 'no_increment',
  });
  return event;
}

async function runWithWriterUnitPlan(
  plans: readonly WriterUnitPlan[],
  physicalRequest: SummaryV3StyleRequest = unresolvedPhysicalRequest(),
) {
  const calls = { writer: 0, evaluator: 0 };
  const result = await executeSummaryV3StyleServer(physicalRequest, {
    async write(input) {
      calls.writer += 1;
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
          units: plans.map((plan, index) => ({
            unitId: `physical-writer-unit-${index + 1}`,
            text: plan.text,
            factIds: plan.factIndexes.map((factIndex) => input.requiredFacts[factIndex]!.id),
          })),
        },
      };
    },
    async evaluate(input) {
      calls.evaluator += 1;
      return passingEvaluation(input, false, 'equivalent');
    },
  });
  return { result, calls };
}

describe('M8 AAB563 physical-equivalent M5 Stronger boundary', () => {
  it('binds the physical mixed-locale request to the English visible Summary source floor', () => {
    const snapshot = createSummaryV3StyleOperationSnapshot(request());
    expect(snapshot.mode).toBe('enhance_existing_content');
    expect(snapshot.requestedLocale).toBe('en');
    expect(snapshot.sourceLocale).toBe('en');
    expect(snapshot.currentRoleEntryId).toBe('entry-current');
    expect(snapshot.transformableDuty).toBeNull();
    expect(snapshot.requiredFacts).toHaveLength(5);
    expect(snapshot.requiredFacts.every((fact) => fact.origin === 'visible_summary')).toBe(true);
    expect(snapshot.manifestFacts.some((fact) => fact.text === 'Wartung elektrischer Anlagen')).toBe(true);
  });

  it('accepts the exact physical source as a safe stylistic strengthening', async () => {
    const candidate = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems, diagnosing and resolving electrical faults, and supporting the installation of electrical components.';
    const snapshot = createSummaryV3StyleOperationSnapshot(request());
    const candidateRecord = createSummaryV3StyleCandidate(snapshot, [{
      unitId: 'candidate-1', text: candidate, factIds: snapshot.requiredFacts.map((fact) => fact.id),
    }]);
    expect({
      missingFactCount: summarizeSummaryV3StyleFactCoverage(snapshot, candidateRecord).missingFactCount,
      locks: summaryV3StyleCandidatePreservesLocks(snapshot, candidate),
      calendar: summaryV3StyleCandidatePreservesCalendarDateSurfaces(snapshot, candidate),
      material: summaryV3StyleCandidatePreservesExactMaterialSurfaces(snapshot, candidate),
      bindings: summaryV3StyleCandidatePreservesEntityFactBindings(snapshot, candidate),
      facts: summaryV3StyleCandidateRepresentsRequiredFacts(snapshot, candidate),
      units: summaryV3StyleCandidateUnitsRepresentDeclaredFacts(snapshot, candidateRecord),
    }).toEqual({ missingFactCount: 0, locks: true, calendar: true, material: true, bindings: true, facts: true, units: true });
    const { result, calls } = await runWithCandidate(candidate);
    expect(result, JSON.stringify(result)).toMatchObject({ kind: 'candidate_ready' });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('accepts stronger emphasis without adding any fact, result, or metric', async () => {
    const candidate = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I perform maintenance work on electrical systems, diagnose and resolve faults in electrical systems, as well as actively support the installation of electrical components.';
    const { result, calls } = await runWithCandidate(candidate);
    expect(result, JSON.stringify(result)).toMatchObject({ kind: 'candidate_ready' });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('keeps evaluator-origin lost_source_fact distinct from initial writer parser loss', async () => {
    const candidate = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems, diagnosing and resolving electrical faults, and supporting the installation of electrical components.';
    const { result, calls } = await runWithCandidate(candidate, { evaluatorLostSourceFact: true });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'lost_source_fact',
      evidence: {
        writerAttempts: 1,
        evaluatorAttempts: 1,
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        writerOutputContractFailureClass: null,
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('does not attach an initial writer class to a repair-writer parse terminal', async () => {
    const candidate = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems, diagnosing and resolving electrical faults, and supporting the installation of electrical components.';
    const { result, calls } = await runWithCandidate(candidate, { repairWriterMalformed: true });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'repair_transport_malformed',
      evidence: {
        writerOutputContractFailureClass: null,
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('accepts a stronger no-op as a safe no-op without a commit candidate', async () => {
    const { result, calls } = await runWithCandidate(source, { noOp: true });
    expect(result).toMatchObject({
      kind: 'safe_no_op',
      evidence: {
        unsupportedClaimCategory: null,
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        safeNoOpConsidered: true,
        safeNoOpSelected: true,
        retries: 0,
        fallbacks: 0,
        v2Fallthrough: 0,
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('rejects an invented 30% result but retains the valid source as the same-operation safe terminal', async () => {
    const candidate = `${source} This work reduced downtime by 30%.`;
    const { result, calls } = await runWithCandidate(candidate);
    expect(result).toMatchObject({
      kind: 'safe_no_op',
      evidence: {
        unsupportedClaimCategory: 'unsupported_metric',
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        safeNoOpConsidered: true,
        safeNoOpSelected: true,
        noOpDetected: true,
        meaningfulChangeDetected: false,
        retries: 0,
        fallbacks: 0,
        v2Fallthrough: 0,
      },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('rejects invented business impact before evaluator authority and never exposes the candidate', async () => {
    const candidate = `${source} This improves operational efficiency and saves the company money.`;
    const { result, calls } = await runWithCandidate(candidate);
    expect(result).toMatchObject({
      kind: 'safe_no_op',
      evidence: {
        unsupportedClaimCategory: 'unsupported_result_relation',
        writerCandidateReachedValidation: true,
        evaluatorReached: false,
        safeNoOpConsidered: true,
        safeNoOpSelected: true,
      },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ writer: 1, evaluator: 0 });
  });

  it('converts two independent unsafe writer attempts into two independent safe terminals without retry', async () => {
    const unsafeCandidate = `${source} This work delivers measurable impact and improves operational efficiency.`;
    const first = await runWithCandidate(unsafeCandidate, {
      request: request({ operationId: 'm8-aab563-physical-reproduction-1', requestIdentity: 'physical-1' }),
    });
    const second = await runWithCandidate(unsafeCandidate, {
      request: request({ operationId: 'm8-aab563-physical-reproduction-2', requestIdentity: 'physical-2' }),
    });
    for (const attempt of [first, second]) {
      expect(attempt.result).toMatchObject({
        kind: 'safe_no_op',
        evidence: {
          unsupportedClaimCategory: 'unsupported_result_relation',
          writerAttempts: 1,
          evaluatorAttempts: 0,
          repairWriterAttempts: 0,
          repairEvaluatorAttempts: 0,
          retries: 0,
          fallbacks: 0,
          v2Fallthrough: 0,
          safeNoOpSelected: true,
        },
      });
      expect(attempt.result).not.toHaveProperty('candidate');
      expect(attempt.calls).toEqual({ writer: 1, evaluator: 0 });
    }
  });

  it('produces the same safety terminal with an equivalent all-English manifest', async () => {
    const englishManifest = request({
      manifest: {
        manifestId: 'm8-aab563-english-manifest',
        contextId: 'm8-aab563-english-context',
        sourceLocale: 'en',
        currentRoleEntryId: 'entry-current',
        entries: [{
          stableId: 'entry-current',
          role: 'Electrical Service Technician',
          employer: 'NordWerk Elektroservice Test',
          employmentState: 'present',
          durationMonths: 36,
          facts: [
            { id: 'maintenance', text: 'maintenance work on electrical systems' },
            { id: 'faults', text: 'locate and resolve faults in electrical systems' },
            { id: 'installation', text: 'support the installation of electrical components' },
          ],
        }],
      },
    });
    const candidate = `${source} This work delivers measurable impact.`;
    const { result, calls } = await runWithCandidate(candidate, { request: englishManifest });
    expect(result).toMatchObject({
      kind: 'safe_no_op',
      evidence: { unsupportedClaimCategory: 'unsupported_result_relation', safeNoOpSelected: true },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 0 });
  });

  it('does not let an invented source metric hide behind safe-no-op', async () => {
    const invalidSource = `${source} I reduced downtime by 30%.`;
    const { result, calls } = await runWithCandidate(invalidSource, {
      request: request({ visibleSummary: invalidSource }),
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'unsupported_claim',
      evidence: {
        safeNoOpConsidered: false,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'source_inconsistency',
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('rejects a source role/employer contradiction before the writer and records the bounded blocker', async () => {
    const contradicted = source.replace('NordWerk Elektroservice Test', 'Other Electrical Works');
    const { result, calls } = await runWithCandidate(contradicted, {
      request: request({ visibleSummary: contradicted }),
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'unsupported_claim',
      evidence: {
        unsupportedClaimCategory: 'source_floor_mismatch',
        writerCandidateReachedValidation: false,
        evaluatorReached: false,
        safeNoOpConsidered: false,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'role_employer_frame_inconsistency',
      },
    });
    expect(calls).toEqual({ writer: 0, evaluator: 0 });
  });

  it('fails closed for a wrong-target-language visible source without selecting safe-no-op', async () => {
    const { result, calls } = await runWithCandidate('私は電気設備を保守します。', {
      request: request({ visibleSummary: '私は電気設備を保守します。' }),
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'malformed_request',
      evidence: {
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'not_applicable',
      },
    });
    expect(calls).toEqual({ writer: 0, evaluator: 0 });
  });

  it('post-fix physical German structured role with English Summary remains evaluator-owned', async () => {
    const physical = request({
      manifest: {
        ...request().manifest,
        sourceLocale: 'en',
        entries: [{
          stableId: 'entry-current',
          role: 'Servicetechniker Elektrotechnik',
          employer: 'NordWerk Elektroservice Test',
          roleSourceLocale: 'de',
          employmentState: 'present',
          durationMonths: 37,
          facts: [
            { id: 'maintenance', text: 'Wartung elektrischer Anlagen' },
            { id: 'faults', text: 'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen' },
            { id: 'installation', text: 'Unterstützung bei der Installation elektrischer Komponenten' },
          ],
        }],
      },
    });
    const snapshot = createSummaryV3StyleOperationSnapshot(physical);
    const { result, calls } = await runWithCandidate(
      'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I reliably maintain electrical systems, diagnose and resolve electrical faults, and support the installation of electrical components.',
      { request: physical },
    );
    expect(result).toMatchObject({
      kind: 'candidate_ready',
      evidence: {
        unsupportedClaimCategory: null,
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        evaluatorNoOpClaimed: false,
        sourceFloorMismatchClass: null,
        roleIdentityResolution: 'equivalent',
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'source_inconsistency',
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('reproduces the physical cross-locale stronger no-op source-floor terminal', async () => {
    const { result, calls } = await runWithCandidate(source, {
      request: unresolvedPhysicalRequest(),
      noOp: true,
    });
    expect(result).toMatchObject({
      kind: 'safe_no_op',
      typedReason: 'safe_no_op',
      evidence: {
        unsupportedClaimCategory: null,
        sourceFloorMismatchClass: null,
        evaluatorNoOpClaimed: true,
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        roleIdentityResolution: 'equivalent',
        safeNoOpSelected: true,
        safeNoOpConsidered: true,
        safeNoOpEligibilityReason: 'eligible',
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('rejects an unrelated English role at the same employer through explicit evaluator contradiction', async () => {
    const wrongRoleSource = source.replace('Electrical Service Technician', 'Software Engineer');
    const candidate = wrongRoleSource.replace('where I carry out', 'where I reliably carry out');
    const { result, calls } = await runWithCandidate(candidate, {
      request: unresolvedPhysicalRequest(wrongRoleSource),
      roleIdentityResolution: 'contradiction',
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'unsupported_claim',
      evidence: {
        phaseStatuses: { semantic_grounding: 'failed' },
        unsupportedClaimCategory: 'source_floor_mismatch',
        sourceFloorMismatchClass: 'role_identity_rejection',
        roleIdentityResolution: 'contradiction',
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'source_inconsistency',
      },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('fails closed when the bounded evaluator cannot resolve the cross-locale role', async () => {
    const candidate = source.replace('where I carry out', 'where I reliably carry out');
    const { result, calls } = await runWithCandidate(candidate, {
      request: unresolvedPhysicalRequest(),
      roleIdentityResolution: 'unresolved',
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'unsupported_claim',
      evidence: {
        phaseStatuses: { semantic_grounding: 'failed' },
        roleIdentityResolution: 'unresolved',
        safeNoOpSelected: false,
      },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('does not accept a generic all-phases pass with role identity marked not_required', async () => {
    const candidate = source.replace('where I carry out', 'where I reliably carry out');
    const { result, calls } = await runWithCandidate(candidate, {
      request: unresolvedPhysicalRequest(),
      roleIdentityResolution: 'not_required',
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'unsupported_claim',
      evidence: {
        phaseStatuses: { semantic_grounding: 'failed' },
        roleIdentityResolution: 'not_required',
        safeNoOpSelected: false,
      },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it.each([
    ['missing', undefined, true],
    ['unknown string', 'plausible', false],
    ['null', null, false],
    ['wrong type', { equivalent: true }, false],
  ])('fails closed for %s unresolved-role evaluator evidence', async (_label, resolution, omit) => {
    const candidate = source.replace('where I carry out', 'where I reliably carry out');
    const { result, calls } = await runWithCandidate(candidate, {
      request: unresolvedPhysicalRequest(),
      roleIdentityResolution: resolution,
      omitRoleIdentityResolution: omit,
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'evaluator_transport_malformed',
      evidence: {
        roleIdentityResolution: 'unresolved',
        safeNoOpSelected: false,
      },
    });
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('accepts only a current-entry validated English role presentation as equivalent', async () => {
    const physical = request({
      manifest: {
        ...request().manifest,
        entries: [{
          ...request().manifest.entries[0]!,
          role: 'Servicetechniker Elektrotechnik',
          roleSourceLocale: 'de',
          rolePresentation: {
            text: 'Electrical Service Technician',
            sourceLocale: 'de',
            targetLocale: 'en',
            sourceRoleHash: hashSummaryV3StyleValue('Servicetechniker Elektrotechnik'),
            provenance: 'validated_export_title_surface',
          },
        }],
      },
    });
    const { result, calls } = await runWithCandidate(source, { request: physical, noOp: true });
    expect(result).toMatchObject({ kind: 'safe_no_op', typedReason: 'safe_no_op' });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it('rejects a translated role owned by another Experience entry even when the employer is shared', async () => {
    const multiEntry = request({
      manifest: {
        ...request().manifest,
        entries: [
          {
            ...request().manifest.entries[0]!,
            role: 'Servicetechniker Elektrotechnik',
            roleSourceLocale: 'de',
          },
          {
            stableId: 'entry-prior',
            role: 'Electrical Service Technician',
            employer: 'NordWerk Elektroservice Test',
            employmentState: 'completed',
            durationMonths: 12,
            facts: [{ id: 'prior-duty', text: 'maintenance work on electrical systems' }],
          },
        ],
      },
    });
    const { result, calls } = await runWithCandidate(source, { request: multiEntry, noOp: true });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'unsupported_claim',
      evidence: {
        writerCandidateReachedValidation: false,
        evaluatorReached: false,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'role_employer_frame_inconsistency',
      },
    });
    expect(calls).toEqual({ writer: 0, evaluator: 0 });
  });

  it('invalidates stale role-presentation evidence after the structured role changes', async () => {
    const stale = request({
      manifest: {
        ...request().manifest,
        entries: [{
          ...request().manifest.entries[0]!,
          role: 'Servicetechniker Elektrotechnik',
          roleSourceLocale: 'de',
          rolePresentation: {
            text: 'Electrical Service Technician',
            sourceLocale: 'de',
            targetLocale: 'en',
            sourceRoleHash: hashSummaryV3StyleValue('Old German Role'),
            provenance: 'validated_localized_projection',
          },
        }],
      },
    });
    const snapshot = createSummaryV3StyleOperationSnapshot(stale);
    expect(snapshot.selectedEntries[0]?.rolePresentation).toBeNull();
    const { result, calls } = await runWithCandidate(source, {
      request: stale,
      noOp: true,
      roleIdentityResolution: 'unresolved',
    });
    expect(result).toMatchObject({
      kind: 'handled_failure',
      typedReason: 'unsupported_claim',
      evidence: {
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        safeNoOpSelected: false,
        safeNoOpEligibilityReason: 'source_inconsistency',
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });
});

describe('M8 AAB571 multi-unit writer source-floor regression', () => {
  const durationUnit = 'I bring approximately three years of experience.';
  const validBody = 'I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I reliably maintain electrical systems, diagnose and resolve electrical faults, and support the installation of electrical components.';

  it('admits a grounded multi-unit Stronger candidate to evaluator-owned mixed-locale role resolution', async () => {
    const { result, calls } = await runWithWriterUnitPlan([
      { text: durationUnit, factIndexes: [0] },
      { text: validBody, factIndexes: [1, 2, 3, 4] },
    ]);

    expect(result, JSON.stringify(result)).toMatchObject({
      kind: 'candidate_ready',
      evidence: {
        writerAttempts: 1,
        evaluatorAttempts: 1,
        writerCandidateReachedValidation: true,
        evaluatorReached: true,
        roleIdentityResolution: 'equivalent',
        writerOutputContractFailureClass: null,
      },
    });
    expect(calls).toEqual({ writer: 1, evaluator: 1 });
  });

  it.each([
    ['duration meaning', [{ text: validBody, factIndexes: [0, 1, 2, 3, 4] }], 'candidate_source_floor'],
    ['employer', [
      { text: durationUnit, factIndexes: [0] },
      { text: validBody.replace(' at NordWerk Elektroservice Test', ''), factIndexes: [1, 2, 3, 4] },
    ], 'source_lock_preservation'],
    ['installation-support duty', [
      { text: durationUnit, factIndexes: [0] },
      { text: validBody.replace(', and support the installation of electrical components', ''), factIndexes: [1, 2, 3, 4] },
    ], 'candidate_source_floor'],
    ['employer identity', [
      { text: durationUnit, factIndexes: [0] },
      { text: validBody.replace('NordWerk Elektroservice Test', 'Other Electrical Works'), factIndexes: [1, 2, 3, 4] },
    ], 'source_lock_preservation'],
    ['current role meaning', [
      { text: durationUnit, factIndexes: [0] },
      { text: validBody.replace('Electrical Service Technician', 'Software Engineer'), factIndexes: [1, 2, 3, 4] },
    ], 'exact_material_source_floor'],
    ['complete source-fact reference coverage', [
      { text: durationUnit, factIndexes: [0] },
      { text: validBody, factIndexes: [1, 2, 3] },
    ], 'required_fact_coverage'],
  ] as const)('rejects loss of %s before evaluator execution', async (_label, plans, expectedClass) => {
    const { result, calls } = await runWithWriterUnitPlan(plans);
    const coveredFactCount = new Set(plans.flatMap((plan) => plan.factIndexes)).size;
    assertInitialWriterLostSourceFact(result, expectedClass, coveredFactCount, 5 - coveredFactCount);
    expect(result).not.toHaveProperty('candidate');
    expect(calls).toEqual({ writer: 1, evaluator: 0 });
  });

  it('classifies a unit-declared fact binding failure after whole-candidate preservation', async () => {
    const { result, calls } = await runWithWriterUnitPlan([
      { text: durationUnit, factIndexes: [1] },
      { text: validBody, factIndexes: [0, 2, 3, 4] },
    ]);
    assertInitialWriterLostSourceFact(result, 'unit_declared_fact_binding', 5, 0);
    expect(calls).toEqual({ writer: 1, evaluator: 0 });
  });

  it('classifies a calendar date source-floor failure with authoritative counts', async () => {
    const calendarRequest = request({
      visibleSummary: 'I worked as an Electrical Service Technician at NordWerk Elektroservice Test from 2020 to 2023, maintaining electrical systems.',
    });
    const snapshot = createSummaryV3StyleOperationSnapshot(calendarRequest);
    const { result, calls } = await runWithWriterUnitPlan([{
      text: 'I worked as an Electrical Service Technician at NordWerk Elektroservice Test, maintaining electrical systems.',
      factIndexes: snapshot.requiredFacts.map((_fact, index) => index),
    }], calendarRequest);
    assertInitialWriterLostSourceFact(result, 'calendar_date_source_floor', snapshot.requiredFacts.length, 0);
    expect(calls).toEqual({ writer: 1, evaluator: 0 });
  });

  it('classifies an entity fact-binding failure with authoritative counts', async () => {
    const entityRequest = request({
      visibleSummary: 'Ava builds APIs at Atlas. Ben mentors peers at Nova.',
      protectedEntities: ['Ava', 'Ben'],
      manifest: {
        manifestId: 'm8-aab563-entity-manifest',
        contextId: 'm8-aab563-entity-context',
        sourceLocale: 'en',
        currentRoleEntryId: 'ava-entry',
        entries: [
          { stableId: 'ava-entry', role: 'Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24, facts: [{ id: 'ava-duty', text: 'builds APIs' }] },
          { stableId: 'ben-entry', role: 'Mentor', employer: 'Nova', employmentState: 'completed', durationMonths: 12, facts: [{ id: 'ben-duty', text: 'mentors peers' }] },
        ],
      },
    });
    const snapshot = createSummaryV3StyleOperationSnapshot(entityRequest);
    const { result, calls } = await runWithWriterUnitPlan([{
      text: 'Ava mentors peers at Nova. Ben builds APIs at Atlas.',
      factIndexes: snapshot.requiredFacts.map((_fact, index) => index),
    }], entityRequest);
    assertInitialWriterLostSourceFact(result, 'entity_fact_binding_preservation', snapshot.requiredFacts.length, 0);
    expect(calls).toEqual({ writer: 1, evaluator: 0 });
  });
});
