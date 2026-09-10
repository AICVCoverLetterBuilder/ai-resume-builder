import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  hashSummaryV3StyleValue,
  summaryV3StyleCandidateUnitHash,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import {
  executeSummaryV3StyleRoute,
  type SummaryV3StyleProviderInvocation,
} from '../summary-style-m5-provider';

const AAB572_SUMMARY = 'I bring approximately three years of experience. I currently work as an Electrical Service Technician at NordWerk Elektroservice Test, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, as well as support the installation of electrical components.';

function physicalMixedLocaleRequest(): SummaryV3StyleRequest {
  return {
    enabled: true,
    operation: 'summary_stronger',
    operationId: 'm8-aab572-c2-physical',
    style: 'stronger',
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary: AAB572_SUMMARY,
    manifest: {
      manifestId: 'm8-aab572-manifest',
      contextId: 'm8-aab572-context',
      sourceLocale: 'en',
      currentRoleEntryId: 'entry-current',
      entries: [{
        stableId: 'entry-current',
        role: 'Servicetechniker Elektrotechnik',
        employer: 'NordWerk Elektroservice Test',
        roleSourceLocale: 'de',
        rolePresentation: {
          text: 'Electrical Service Technician',
          sourceLocale: 'de',
          targetLocale: 'en',
          sourceRoleHash: hashSummaryV3StyleValue('Servicetechniker Elektrotechnik'),
          provenance: 'validated_localized_projection',
        },
        employmentState: 'present',
        durationMonths: 36,
        facts: [
          { id: 'duty-maintenance', text: 'Wartung elektrischer Anlagen' },
          { id: 'duty-faults', text: 'Lokalisierung und Behebung von Fehlern in elektrischen Anlagen' },
          { id: 'duty-installation', text: 'Unterstützung bei der Installation elektrischer Komponenten' },
        ],
      }],
    },
    createdAt: 1_757_000_000_000,
  };
}

function c2ProviderMessage(
  invocation: SummaryV3StyleProviderInvocation,
  mutate?: (input: Record<string, unknown>) => void,
): unknown {
  if (invocation.role === 'writer') {
    const input = invocation.input;
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
          units: [{ unitId: 'aab572-unit-0', text: input.sourceText, factIds: input.requiredFacts.map((fact) => fact.id) }],
        },
      }],
    };
  }
  const providerInput: Record<string, unknown> = {
    structuralStatus: 'passed',
    structuralViolations: [],
    semantic_groundingStatus: 'passed',
    semantic_groundingViolations: [],
    language_native_qualityStatus: 'passed',
    language_native_qualityViolations: [],
    style_fulfillmentStatus: 'passed',
    style_fulfillmentViolations: [],
    representedFactIdHashes: invocation.input.requiredFacts.map((fact) => fact.hash),
    missingFactIdHashes: [],
    roleIdentityResolution: 'equivalent',
    styleEvidence: {
      strongerPredicateTransformations: 0,
      structuralStrengtheningCount: 0,
      modifierOnlyTransformationDetected: false,
      repeatedStyleModifierCount: 0,
      stackedModifierDetected: false,
      unsupportedAuthorityDetected: false,
      strongerFulfilled: true,
      noOpDetected: true,
    },
  };
  mutate?.(providerInput);
  return {
    stop_reason: 'tool_use',
    content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, input: providerInput }],
  };
}

async function runPhysical(
  mutate?: (input: Record<string, unknown>) => void,
) {
  return executeSummaryV3StyleRoute(physicalMixedLocaleRequest(), {
    timeoutForPhase: () => 30_000,
    invoke: async (invocation) => c2ProviderMessage(invocation, mutate),
  });
}

describe('M8 AAB573 evaluator strict-schema minimization', () => {
  it('runs the AAB572 mixed-locale fixture through C2, rehydration, and the full local parser', async () => {
    const result = await runPhysical();
    expect(result.kind).toBe('safe_no_op');
  });

  it.each([
    ['A role contradiction', (input: Record<string, unknown>) => { input.roleIdentityResolution = 'contradiction'; }],
    ['B unresolved role', (input: Record<string, unknown>) => { input.roleIdentityResolution = 'unresolved'; }],
    ['C missing represented fact', (input: Record<string, unknown>) => { input.representedFactIdHashes = []; }],
    ['D explicit missing fact', (input: Record<string, unknown>) => { input.missingFactIdHashes = ['unknown-fact-hash']; }],
    ['E structural phase failure', (input: Record<string, unknown>) => { input.structuralStatus = 'failed'; input.structuralViolations = [{ code: 'unsupported_claim', factIdHashes: [], unitHashes: [], repairable: false }]; }],
    ['F semantic grounding phase failure', (input: Record<string, unknown>) => { input.semantic_groundingStatus = 'failed'; input.semantic_groundingViolations = [{ code: 'lost_source_fact', factIdHashes: [], unitHashes: [], repairable: false }]; }],
    ['G language phase failure', (input: Record<string, unknown>) => { input.language_native_qualityStatus = 'failed'; input.language_native_qualityViolations = [{ code: 'invalid_language', factIdHashes: [], unitHashes: [], repairable: false }]; }],
    ['H style phase failure', (input: Record<string, unknown>) => { input.style_fulfillmentStatus = 'failed'; input.style_fulfillmentViolations = [{ code: 'style_not_fulfilled', factIdHashes: [], unitHashes: [], repairable: false }]; }],
    ['I unsupported Stronger authority', (input: Record<string, unknown>) => { (input.styleEvidence as Record<string, unknown>).unsupportedAuthorityDetected = true; (input.styleEvidence as Record<string, unknown>).strongerFulfilled = false; }],
    ['J malformed provider output', (input: Record<string, unknown>) => { delete input.styleEvidence; }],
    ['K extra unexpected property', (input: Record<string, unknown>) => { input.extra = true; }],
    ['L stale/wrong context spoof', (input: Record<string, unknown>) => { input.operationId = 'spoofed-operation'; }],
  ] as const)('%s is rejected fail closed', async (_name, mutate) => {
    const result = await runPhysical(mutate);
    expect(result.kind).toBe('handled_failure');
  });

  it('keeps candidate unit identity available only from immutable evaluator input', async () => {
    let seen: SummaryV3StyleProviderInvocation | null = null;
    await executeSummaryV3StyleRoute(physicalMixedLocaleRequest(), {
      timeoutForPhase: () => 30_000,
      invoke: async (invocation) => {
        if (invocation.role === 'evaluator') seen = invocation;
        return c2ProviderMessage(invocation);
      },
    });
    expect(seen).not.toBeNull();
    const evaluator = seen!.input as import('../summary-style-m5-server').SummaryV3StyleEvaluatorInput;
    expect(evaluator.candidate.units.map(summaryV3StyleCandidateUnitHash)).toEqual(
      evaluator.candidate.units.map(summaryV3StyleCandidateUnitHash),
    );
  });
});
