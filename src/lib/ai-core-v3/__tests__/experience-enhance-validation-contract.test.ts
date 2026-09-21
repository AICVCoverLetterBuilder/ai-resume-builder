import { describe, expect, it, vi } from 'vitest';
import { createCandidateEnvelope } from '../candidate-envelope';
import type { ExperienceFactManifest } from '../contracts';
import { createExperienceFactManifest } from '../experience-manifest';
import {
  EXPERIENCE_V3_ENHANCE_VALIDATION_CODES,
  EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT,
  experienceV3EnhanceValidationCodesForCategory,
  isExperienceV3EnhanceValidationCode,
  isExperienceV3EnhanceValidationCodeForCategory,
  type ExperienceV3EnhanceValidationCategory,
  type ExperienceV3EnhanceValidationCode,
} from '../experience-enhance-validation-contract';
import {
  EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL,
  EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME,
  EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME,
  buildExperienceV3EnhanceEvaluatorPrompt,
  executeExperienceV3EnhanceServer,
  parseExperienceV3EnhanceEvaluatorToolResponse,
  type ExperienceV3EnhanceEvaluatorResponse,
  type ExperienceV3EnhanceWriterResponse,
} from '../experience-enhance-server';
import type { ExperienceV3EnhanceFailureResponse } from '../experience-enhance';
import { unavailableExperienceV3DiagnosticEvidence } from '../experience-generate';
import {
  createExperienceV3TerminalDiagnostic,
  emitExperienceV3TerminalDiagnostic,
} from '../experience-v3-production-observability';
import {
  runAiCoreV3Validation,
  type AggregateValidationResult,
  type AiCoreV3Violation,
  type ValidationPhaseResult,
} from '../validators';

const PRIVATE_DETAIL = 'PRIVATE VALIDATOR DETAIL MUST NOT REACH THE TERMINAL EVENT';

function manifest(): ExperienceFactManifest {
  return createExperienceFactManifest({
    operationId: 'finite-contract-operation',
    mode: 'enhance',
    entryId: 'finite-contract-entry',
    locale: 'en',
    roleTitle: 'Role',
    company: 'Company',
    employmentState: 'present',
    dates: { start: { year: 2024, month: 1 }, end: null },
    exactSourceText: 'Maintains accurate service records.',
    facts: [{
      factId: 'finite-contract-fact-1',
      text: 'Maintains accurate service records.',
      sourceHash: 'finite-contract-source-hash',
      required: true,
    }],
    snapshotHash: 'finite-contract-snapshot-hash',
    sourceLocale: 'en',
    targetLocale: 'en',
    contextHash: 'finite-contract-context-hash',
  });
}

function writerResponse(input: ExperienceFactManifest): ExperienceV3EnhanceWriterResponse {
  return {
    stopReason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: EXPERIENCE_V3_ENHANCE_WRITER_TOOL_NAME,
      input: {
        operationId: input.operationId,
        entryId: input.entryId,
        snapshotHash: input.snapshotHash,
        locale: input.locale,
        units: [{ factId: input.facts[0].factId, text: 'Maintains precise and accurate service records.' }],
      },
    }],
  };
}

function evaluatorResponse(
  input: ExperienceFactManifest,
  category: ExperienceV3EnhanceValidationCategory,
  code: unknown,
  semanticCodes: readonly unknown[] = category === 'semantic' ? [code] : [],
  languageCodes: readonly unknown[] = category === 'language_quality' ? [code] : [],
): ExperienceV3EnhanceEvaluatorResponse {
  const phase = (
    phaseCategory: ExperienceV3EnhanceValidationCategory,
    codes: readonly unknown[],
  ) => ({
    status: codes.length > 0 ? 'failed' : 'passed',
    violations: codes.map((violationCode) => ({
      code: violationCode,
      category: phaseCategory,
      detail: PRIVATE_DETAIL,
      factIds: [input.facts[0].factId],
      entryIds: [input.entryId],
    })),
  });
  return {
    stopReason: 'tool_use',
    content: [{
      type: 'tool_use',
      name: EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL_NAME,
      input: {
        operationId: input.operationId,
        entryId: input.entryId,
        snapshotHash: input.snapshotHash,
        locale: input.locale,
        phases: {
          semantic: phase('semantic', semanticCodes),
          language_quality: phase('language_quality', languageCodes),
        },
        materiality: {
          status: 'material',
          kind: 'clarity_improvement',
          sourceEquivalent: false,
          degradationDetected: false,
        },
      },
    }],
  };
}

type EvaluatorSchema = {
  readonly properties: {
    readonly phases: {
      readonly properties: Record<ExperienceV3EnhanceValidationCategory, {
        readonly properties: {
          readonly violations: {
            readonly items: {
              readonly properties: { readonly code: { readonly enum: readonly string[] } };
            };
          };
        };
      }>;
    };
  };
};

function schemaCodes(category: ExperienceV3EnhanceValidationCategory): readonly string[] {
  const schema = EXPERIENCE_V3_ENHANCE_EVALUATOR_TOOL.input_schema as unknown as EvaluatorSchema;
  return schema.properties.phases.properties[category].properties.violations.items.properties.code.enum;
}

function phase(
  category: ExperienceV3EnhanceValidationCategory | 'structural',
  status: 'passed' | 'failed',
  violations: readonly AiCoreV3Violation[],
): ValidationPhaseResult {
  return { category, status, violations };
}

function aggregateWithCode(
  input: ExperienceFactManifest,
  category: ExperienceV3EnhanceValidationCategory,
  code: string,
): AggregateValidationResult {
  const candidate = createCandidateEnvelope({
    operationId: input.operationId,
    candidateId: 'finite-contract-candidate',
    operationKind: 'experience_enhance',
    targetLocale: input.locale,
    sourceSnapshotHash: input.snapshotHash,
    text: 'Maintains precise and accurate service records.',
  });
  const violation: AiCoreV3Violation = { code, category, detail: 'synthetic non-interference evidence' };
  const semantic = phase('semantic', category === 'semantic' ? 'failed' : 'passed', category === 'semantic' ? [violation] : []);
  const language = phase('language_quality', category === 'language_quality' ? 'failed' : 'passed', category === 'language_quality' ? [violation] : []);
  return runAiCoreV3Validation({ manifest: input, candidate }, {
    structural: () => phase('structural', 'passed', []),
    semantic: () => semantic,
    languageQuality: () => language,
  });
}

function failureWithValidation(
  validation: AggregateValidationResult,
): ExperienceV3EnhanceFailureResponse {
  const semantic = validation.phases.semantic.violations;
  const language = validation.phases.language_quality.violations;
  return {
    ok: false,
    action: 'experience_v3_enhance',
    typedReason: 'validation_rejected',
    validation,
    diagnosticEvidence: {
      ...unavailableExperienceV3DiagnosticEvidence(),
      primaryValidationRejectionCode: semantic[0]?.code ?? language[0]?.code ?? null,
    },
  };
}

describe('Experience V3 Enhance finite evaluator validation-code contract', () => {
  it('keeps the canonical owner, provider schema, and prompt exactly aligned', () => {
    const input = manifest();
    const prompt = buildExperienceV3EnhanceEvaluatorPrompt(input, createCandidateEnvelope({
      operationId: input.operationId,
      candidateId: 'finite-contract-prompt-candidate',
      operationKind: 'experience_enhance',
      targetLocale: input.locale,
      sourceSnapshotHash: input.snapshotHash,
      text: 'Maintains precise and accurate service records.',
    }));
    const promptCodes = EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT
      .filter((entry) => prompt.includes(`${entry.category}.${entry.code}: ${entry.meaning}`))
      .map((entry) => entry.code);
    const allSchemaCodes = [...schemaCodes('semantic'), ...schemaCodes('language_quality')];

    expect(new Set(EXPERIENCE_V3_ENHANCE_VALIDATION_CODES).size).toBe(EXPERIENCE_V3_ENHANCE_VALIDATION_CODES.length);
    expect(allSchemaCodes).toEqual(EXPERIENCE_V3_ENHANCE_VALIDATION_CODES);
    expect(promptCodes).toEqual(EXPERIENCE_V3_ENHANCE_VALIDATION_CODES);
  });

  it.each(EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT.map(
    (entry) => [entry.category, entry.code, entry.meaning] as const,
  ))(
    'accepts and safely projects canonical %s.%s without changing rejection semantics',
    async (category, code, meaning) => {
      const input = manifest();
      expect(meaning.length).toBeGreaterThan(0);
      expect(isExperienceV3EnhanceValidationCode(code)).toBe(true);
      expect(isExperienceV3EnhanceValidationCodeForCategory(code, category)).toBe(true);
      expect(schemaCodes(category)).toContain(code);

      const parsed = parseExperienceV3EnhanceEvaluatorToolResponse(
        evaluatorResponse(input, category, code),
        input,
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      const parsedViolation = parsed.value.phases[category].violations[0];
      expect(parsedViolation).toMatchObject({ code, category });

      const openStringResult = aggregateWithCode(input, category, 'pre_contract_open_string');
      const canonicalResult = aggregateWithCode(input, category, code);
      expect({
        decision: canonicalResult.decision,
        structural: canonicalResult.phases.structural.status,
        semantic: canonicalResult.phases.semantic.status,
        language: canonicalResult.phases.language_quality.status,
        violationCount: canonicalResult.violations.length,
      }).toEqual({
        decision: openStringResult.decision,
        structural: openStringResult.phases.structural.status,
        semantic: openStringResult.phases.semantic.status,
        language: openStringResult.phases.language_quality.status,
        violationCount: openStringResult.violations.length,
      });

      let writerCalls = 0;
      let evaluatorCalls = 0;
      const result = await executeExperienceV3EnhanceServer({ manifest: input }, {
        generate: async () => { writerCalls += 1; return writerResponse(input); },
        evaluate: async () => { evaluatorCalls += 1; return evaluatorResponse(input, category, code); },
      });
      expect(result).toMatchObject({ ok: false, typedReason: 'validation_rejected' });
      expect([writerCalls, evaluatorCalls]).toEqual([1, 1]);
      if (result.ok) return;

      const event = createExperienceV3TerminalDiagnostic({
        requestId: 'finite-contract-request',
        httpStatus: 422,
        elapsedMs: 1,
        result,
      });
      expect(event).toMatchObject({
        httpStatus: 422,
        validationStage: category === 'semantic' ? 'SEMANTIC_GROUNDING_VALIDATION' : 'LANGUAGE_VALIDATION',
        primaryValidationCode: code,
        validationCodes: [code],
        providerAttemptCount: 2,
        usageCommitted: false,
      });
      expect(JSON.stringify(event)).not.toContain(PRIVATE_DETAIL);
    },
  );

  it.each([
    'unknown_future_code',
    'PRIVATE_DESCRIPTION',
    'user@example.com',
    'unsupported_but_not_contract_code',
  ])('fails unknown evaluator code closed as output-contract evidence: %s', async (unknownCode) => {
    const input = manifest();
    expect(schemaCodes('semantic')).not.toContain(unknownCode);
    expect(schemaCodes('language_quality')).not.toContain(unknownCode);
    expect(isExperienceV3EnhanceValidationCode(unknownCode)).toBe(false);

    const response = evaluatorResponse(input, 'semantic', unknownCode);
    expect(parseExperienceV3EnhanceEvaluatorToolResponse(response, input)).toMatchObject({
      ok: false,
      typedReason: 'evaluator_tool_input_malformed',
    });

    const result = await executeExperienceV3EnhanceServer({ manifest: input }, {
      generate: async () => writerResponse(input),
      evaluate: async () => response,
    });
    expect(result).toMatchObject({ ok: false, typedReason: 'evaluator_tool_input_malformed' });
    if (result.ok) return;
    const event = createExperienceV3TerminalDiagnostic({
      requestId: 'unknown-contract-code',
      httpStatus: 502,
      elapsedMs: 1,
      result,
    });
    expect(event).toMatchObject({
      failureFamily: 'output_contract',
      primaryValidationCode: null,
      validationCodes: [],
      validationRejected: false,
      usageCommitted: false,
    });
    expect(JSON.stringify(event)).not.toContain(unknownCode);
  });

  it('rejects a canonical code placed in the wrong typed category', () => {
    for (const entry of EXPERIENCE_V3_ENHANCE_VALIDATION_CONTRACT) {
      const wrongCategory = entry.category === 'semantic' ? 'language_quality' : 'semantic';
      expect(isExperienceV3EnhanceValidationCodeForCategory(entry.code, wrongCategory)).toBe(false);
      expect(parseExperienceV3EnhanceEvaluatorToolResponse(
        evaluatorResponse(manifest(), wrongCategory, entry.code),
        manifest(),
      )).toMatchObject({ ok: false, typedReason: 'evaluator_tool_input_malformed' });
    }
  });

  it('projects the physical rejection shape with one event and closed non-null codes', () => {
    const input = manifest();
    const semanticCodes = ['source_fact_loss', 'unsupported_claim'] as const satisfies readonly ExperienceV3EnhanceValidationCode[];
    const languageCodes = ['grammar_defect'] as const satisfies readonly ExperienceV3EnhanceValidationCode[];
    const parsed = parseExperienceV3EnhanceEvaluatorToolResponse(
      evaluatorResponse(input, 'semantic', semanticCodes[0], semanticCodes, languageCodes),
      input,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validation = runAiCoreV3Validation({
      manifest: input,
      candidate: createCandidateEnvelope({
        operationId: input.operationId,
        candidateId: 'physical-shape-candidate',
        operationKind: 'experience_enhance',
        targetLocale: input.locale,
        sourceSnapshotHash: input.snapshotHash,
        text: 'Synthetic candidate identity only.',
      }),
    }, {
      structural: () => phase('structural', 'passed', []),
      semantic: () => ({ category: 'semantic', ...parsed.value.phases.semantic }),
      languageQuality: () => ({ category: 'language_quality', ...parsed.value.phases.language_quality }),
    });
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const event = emitExperienceV3TerminalDiagnostic({
      requestId: 'physical-shape-request',
      httpStatus: 422,
      elapsedMs: 1,
      result: failureWithValidation(validation),
    });
    expect(info).toHaveBeenCalledTimes(1);
    expect(event).toMatchObject({
      validationStage: 'SEMANTIC_GROUNDING_VALIDATION',
      primaryValidationCode: 'source_fact_loss',
      validationCodes: ['source_fact_loss', 'unsupported_claim', 'grammar_defect'],
      structuralViolationCount: 0,
      semanticViolationCount: 2,
      languageViolationCount: 1,
      usageCommitted: false,
    });
    expect(JSON.stringify(event)).not.toContain(PRIVATE_DETAIL);
    info.mockRestore();
  });

  it('derives each category enum from the one canonical owner', () => {
    expect(schemaCodes('semantic')).toEqual(experienceV3EnhanceValidationCodesForCategory('semantic'));
    expect(schemaCodes('language_quality')).toEqual(experienceV3EnhanceValidationCodesForCategory('language_quality'));
  });
});
