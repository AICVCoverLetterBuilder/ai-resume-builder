import { describe, expect, it } from 'vitest';
import {
  SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME,
  SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME,
  type SummaryV3StyleRequest,
} from '../summary-style-m5';
import { executeSummaryV3StyleRoute, type SummaryV3StyleProviderInvocation } from '../summary-style-m5-provider';

const SOURCE = 'Ava Patel is a Product Engineer at Atlas. She builds reliable APIs, mentors peers, and improved delivery by 20% over 24 months.';

function requestFor(): SummaryV3StyleRequest {
  return {
    enabled: true, operation: 'summary_stronger', operationId: 'm8-aab573-transport-regression', style: 'stronger',
    requestedLocale: 'en', sourceLocale: 'en', visibleSummary: SOURCE,
    visibleSummaryFacts: [
      { id: 'name', text: 'Ava Patel' }, { id: 'role', text: 'Product Engineer' }, { id: 'employer', text: 'Atlas' },
      { id: 'duty-api', text: 'builds reliable APIs' }, { id: 'duty-mentor', text: 'mentors peers' },
      { id: 'metric', text: 'improved delivery by 20%' }, { id: 'duration', text: '24 months' },
    ],
    protectedEntities: ['Ava Patel'],
    manifest: {
      manifestId: 'm8-aab573-transport-manifest', contextId: 'm8-aab573-transport-context', sourceLocale: 'en', currentRoleEntryId: 'entry-current',
      entries: [{ stableId: 'entry-current', role: 'Product Engineer', employer: 'Atlas', employmentState: 'present', durationMonths: 24,
        facts: [{ id: 'duty-api', text: 'builds reliable APIs' }, { id: 'duty-mentor', text: 'mentors peers' }, { id: 'metric', text: 'improved delivery by 20%' }, { id: 'context-only-tool', text: 'Kubernetes' }] }],
    },
    createdAt: 1_757_000_000_000,
  };
}

function writerResponse(invocation: SummaryV3StyleProviderInvocation): unknown {
  const input = invocation.input;
  if (!('sourceText' in input)) throw new Error('writer input missing');
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_WRITER_TOOL_NAME, input: {
    operationId: input.operationId, snapshotHash: input.snapshotHash, manifestHash: input.manifestHash,
    style: input.style, locale: input.locale,
    units: [{ unitId: 'unit-0', text: input.sourceText, factIds: input.requiredFacts.map((fact) => fact.id) }],
  } }] };
}

function evaluatorResponse(invocation: SummaryV3StyleProviderInvocation): unknown {
  const input = invocation.input;
  if (!('candidate' in input)) throw new Error('evaluator input missing');
  return { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: SUMMARY_V3_STYLE_M5_EVALUATOR_TOOL_NAME, input: {
    structuralStatus: 'passed', structuralViolations: [],
    semantic_groundingStatus: 'passed', semantic_groundingViolations: [],
    language_native_qualityStatus: 'passed', language_native_qualityViolations: [],
    style_fulfillmentStatus: 'passed',
    // This is the exact privacy-safe shape observed in the AAB573 replay.
    // The field is implied empty by the passed status and normalized once.
    representedFactIdHashes: input.requiredFacts.map((fact) => fact.hash),
    missingFactIdHashes: [], roleIdentityResolution: 'equivalent',
    styleEvidence: {
      strongerPredicateTransformations: 0, structuralStrengtheningCount: 0,
      modifierOnlyTransformationDetected: false, repeatedStyleModifierCount: 0,
      stackedModifierDetected: false, unsupportedAuthorityDetected: false,
      strongerFulfilled: true, noOpDetected: true,
    },
  } }] };
}

function exactProviderKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort();
}

describe('M8 AAB573 evaluator transport malformed regression', () => {
  it('accepts the live strict-tool omission only when passed style fulfillment implies an empty violation list', async () => {
    let preFixKeys: string[] = [];
    const result = await executeSummaryV3StyleRoute(requestFor(), {
      timeoutForPhase: () => 30_000,
      invoke: async (invocation) => {
        if (invocation.role === 'writer') return writerResponse(invocation);
        const response = evaluatorResponse(invocation) as { content: Array<{ input: Record<string, unknown> }> };
        preFixKeys = exactProviderKeys(response.content[0]!.input);
        return response;
      },
    });
    expect(preFixKeys).not.toContain('style_fulfillmentViolations');
    expect(preFixKeys).toHaveLength(11);
    expect(result).not.toMatchObject({ kind: 'handled_failure', typedReason: 'evaluator_transport_malformed' });
    expect(result.kind).toBe('safe_no_op');
  });
});
