import { createCandidateEnvelope } from './candidate-envelope';
import type Anthropic from '@anthropic-ai/sdk';
import type { AiCoreV3CandidateEnvelope, ExperienceFactManifest } from './contracts';
import { createExperienceFactManifest } from './experience-manifest';
import {
  EXPERIENCE_V3_GENERATE_ACTION,
  hashExperienceV3Value,
  unavailableExperienceV3DiagnosticEvidence,
  type ExperienceV3DiagnosticEvidence,
  type ExperienceV3EvaluatorDiagnosticMetadata,
  type ExperienceV3GenerateFailureResponse,
  type ExperienceV3GenerateResponse,
  type ExperienceV3InternalRejectionAudit,
  type ExperienceV3ProviderFailureEvidence,
  type ExperienceV3ProviderOutput,
} from './experience-generate';
import { immutableCopy } from './immutability';
import { INTERNAL_AI_RESET_ENABLED } from '../build-channel';
import {
  runAiCoreV3Validation,
  validateStructuralPhase,
  type AiCoreV3Violation,
  type AggregateValidationResult,
  type ValidationPhaseResult,
  type ViolationCategory,
} from './validators';
import {
  classifyExperienceV3EnhanceProviderFailure,
  ExperienceV3EnhanceProviderTransportError,
} from './experience-enhance-server';

export interface ExperienceV3GenerateTransportSet {
  readonly generate: (prompt: string) => Promise<string>;
  readonly evaluate: (prompt: string) => Promise<ExperienceV3EvaluatorResponse>;
}

type EvaluatedCategory = Extract<ViolationCategory, 'semantic' | 'language_quality'>;

export const EXPERIENCE_V3_EVALUATOR_TOOL_NAME = 'submit_experience_validation' as const;

export const EXPERIENCE_V3_EVALUATOR_TOOL: Anthropic.Tool = {
  name: EXPERIENCE_V3_EVALUATOR_TOOL_NAME,
  description: 'Submit non-writing Experience Generate validation evidence only. This tool cannot rewrite candidate prose or authorize apply, persistence, usage, retries, or repair.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['operationId', 'entryId', 'snapshotHash', 'locale', 'phases'],
    properties: {
      operationId: { type: 'string' },
      entryId: { type: 'string' },
      snapshotHash: { type: 'string' },
      locale: { type: 'string' },
      phases: {
        type: 'object',
        additionalProperties: false,
        required: ['semantic', 'language_quality'],
        properties: {
          semantic: evaluatorPhaseSchema('semantic'),
          language_quality: evaluatorPhaseSchema('language_quality'),
        },
      },
    },
  },
};

export type ExperienceV3EvaluatorContentBlock =
  | { readonly type: 'tool_use'; readonly name: string; readonly input: unknown }
  | { readonly type: string };

export interface ExperienceV3EvaluatorResponse {
  readonly stopReason: string | null;
  readonly content: readonly ExperienceV3EvaluatorContentBlock[];
}

function evaluatorPhaseSchema(category: EvaluatedCategory) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['status', 'violations'],
    properties: {
      status: { type: 'string', enum: ['passed', 'failed'] },
      violations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'category', 'detail'],
          properties: {
            code: { type: 'string' },
            category: { type: 'string', const: category },
            detail: { type: 'string' },
            factIds: { type: 'array', items: { type: 'string' } },
            entryIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  } as const;
}

interface EvaluatorPhasePayload {
  readonly status: 'passed' | 'failed';
  readonly violations: readonly AiCoreV3Violation[];
}

interface EvaluatorPayload {
  readonly operationId: string;
  readonly entryId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly phases: Readonly<Record<EvaluatedCategory, EvaluatorPhasePayload>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) && keys.every((key) => allowed.has(key));
}

function parseStrictJson(raw: string): unknown {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    return JSON.parse(raw.trim()) as unknown;
  } catch {
    return null;
  }
}

function unavailableEvaluatorDiagnosticMetadata(): ExperienceV3EvaluatorDiagnosticMetadata {
  return immutableCopy({
    evaluatorStopReason: null,
    evaluatorContentBlockCount: null,
    evaluatorTextBlockCount: null,
    evaluatorToolBlockCount: null,
    evaluatorExpectedToolCount: null,
    evaluatorToolNameMatched: null,
    evaluatorToolInputObject: null,
    evaluatorToolInputSchemaPassed: null,
    evaluatorIdentityPassed: null,
  }) as ExperienceV3EvaluatorDiagnosticMetadata;
}

function evaluatorDiagnosticMetadata(
  response: ExperienceV3EvaluatorResponse | null | undefined,
): ExperienceV3EvaluatorDiagnosticMetadata {
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) {
    return unavailableEvaluatorDiagnosticMetadata();
  }
  const toolBlocks = response.content.filter((block): block is Extract<ExperienceV3EvaluatorContentBlock, { type: 'tool_use' }> => (
    block.type === 'tool_use'
  ));
  const expectedTool = toolBlocks.length === 1 ? toolBlocks[0] : null;
  return immutableCopy({
    evaluatorStopReason: typeof response.stopReason === 'string' ? response.stopReason : null,
    evaluatorContentBlockCount: response.content.length,
    evaluatorTextBlockCount: response.content.filter((block) => block.type === 'text').length,
    evaluatorToolBlockCount: toolBlocks.length,
    evaluatorExpectedToolCount: 1,
    evaluatorToolNameMatched: expectedTool
      ? expectedTool.name === EXPERIENCE_V3_EVALUATOR_TOOL_NAME
      : null,
    evaluatorToolInputObject: expectedTool ? isRecord(expectedTool.input) : null,
    evaluatorToolInputSchemaPassed: null,
    evaluatorIdentityPassed: null,
  }) as ExperienceV3EvaluatorDiagnosticMetadata;
}

function withEvaluatorDiagnosticMetadata(
  metadata: ExperienceV3EvaluatorDiagnosticMetadata,
  update: Partial<ExperienceV3EvaluatorDiagnosticMetadata>,
): ExperienceV3EvaluatorDiagnosticMetadata {
  return immutableCopy({ ...metadata, ...update }) as ExperienceV3EvaluatorDiagnosticMetadata;
}

function providerFailureEvidence(error: unknown): ExperienceV3ProviderFailureEvidence {
  return error instanceof ExperienceV3EnhanceProviderTransportError
    ? error.evidence
    : classifyExperienceV3EnhanceProviderFailure(error);
}

function failure(
  typedReason: string,
  validation?: AggregateValidationResult,
  diagnosticEvidence: ExperienceV3DiagnosticEvidence = unavailableExperienceV3DiagnosticEvidence(),
  internalRejectionAudit?: ExperienceV3InternalRejectionAudit,
): ExperienceV3GenerateFailureResponse {
  return immutableCopy({
    ok: false as const,
    action: EXPERIENCE_V3_GENERATE_ACTION,
    typedReason,
    ...(validation ? { validation } : {}),
    diagnosticEvidence,
    ...(internalRejectionAudit ? { internalRejectionAudit } : {}),
  }) as ExperienceV3GenerateFailureResponse;
}

export function parseExperienceV3GenerateRequest(value: unknown): ExperienceFactManifest | null {
  if (!isRecord(value) || !exactKeys(value, ['manifest']) || !isRecord(value.manifest)) return null;
  const manifest = value.manifest;
  if (!exactKeys(
    manifest,
    [
      'operationId',
      'operationKind',
      'mode',
      'entryId',
      'locale',
      'roleTitle',
      'company',
      'employmentState',
      'dates',
      'exactSourceText',
      'facts',
      'snapshotHash',
    ],
    ['industry', 'level'],
  )) return null;
  if (
    manifest.operationKind !== 'experience_generate'
    || manifest.mode !== 'generate'
    || manifest.exactSourceText !== ''
    || !Array.isArray(manifest.facts)
    || manifest.facts.length !== 0
    || typeof manifest.operationId !== 'string'
    || typeof manifest.entryId !== 'string'
    || typeof manifest.locale !== 'string'
    || typeof manifest.roleTitle !== 'string'
    || !manifest.roleTitle.trim()
    || typeof manifest.company !== 'string'
    || typeof manifest.snapshotHash !== 'string'
    || (manifest.industry !== undefined && typeof manifest.industry !== 'string')
    || (manifest.level !== undefined && typeof manifest.level !== 'string')
  ) return null;
  try {
    return createExperienceFactManifest({
      operationId: manifest.operationId as string,
      mode: 'generate',
      entryId: manifest.entryId as string,
      locale: manifest.locale as string,
      roleTitle: manifest.roleTitle,
      company: manifest.company as string,
      employmentState: manifest.employmentState as 'present' | 'completed',
      dates: manifest.dates as ExperienceFactManifest['dates'],
      ...(typeof manifest.industry === 'string' ? { industry: manifest.industry } : {}),
      ...(typeof manifest.level === 'string' ? { level: manifest.level } : {}),
      exactSourceText: '',
      facts: [],
      snapshotHash: manifest.snapshotHash as string,
    });
  } catch {
    return null;
  }
}

function normalizeProviderBullet(value: string): string {
  return value.trim().replace(/^\s*(?:[-*•])\s+/u, '').trim();
}

function duplicateKey(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(duplicateKey(left).split(' ').filter(Boolean));
  const b = new Set(duplicateKey(right).split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function bulletsHaveNearDuplicate(bullets: readonly string[]): boolean {
  for (let left = 0; left < bullets.length; left += 1) {
    for (let right = left + 1; right < bullets.length; right += 1) {
      if (
        duplicateKey(bullets[left]) === duplicateKey(bullets[right])
        || tokenSimilarity(bullets[left], bullets[right]) >= 0.85
      ) return true;
    }
  }
  return false;
}

export function parseExperienceV3ProviderOutput(
  raw: string,
  manifest: ExperienceFactManifest,
): ExperienceV3ProviderOutput | null {
  const value = parseStrictJson(raw);
  if (!isRecord(value) || !exactKeys(
    value,
    ['operationId', 'entryId', 'snapshotHash', 'locale', 'bullets'],
  )) return null;
  if (
    value.operationId !== manifest.operationId
    || value.entryId !== manifest.entryId
    || value.snapshotHash !== manifest.snapshotHash
    || value.locale !== manifest.locale
    || !Array.isArray(value.bullets)
    || value.bullets.length !== 3
    || value.bullets.some((bullet) => typeof bullet !== 'string')
  ) return null;
  const bullets = (value.bullets as string[]).map(normalizeProviderBullet);
  if (
    bullets.some((bullet) => !bullet || /[\r\n]/u.test(bullet))
    || bullets.some((bullet) => /^#{1,6}\s|^(?:here are|generated bullets?|summary)\b/iu.test(bullet))
    || bulletsHaveNearDuplicate(bullets)
  ) return null;
  return immutableCopy({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    bullets,
  }) as ExperienceV3ProviderOutput;
}

function phaseViolation(
  code: string,
  category: ViolationCategory,
  detail: string,
  entryId?: string,
): AiCoreV3Violation {
  return immutableCopy({
    code,
    category,
    detail,
    ...(entryId ? { entryIds: [entryId] } : {}),
  }) as AiCoreV3Violation;
}

function notEvaluatedPhase(category: ViolationCategory): ValidationPhaseResult {
  return immutableCopy({ category, status: 'not_evaluated' as const, violations: [] }) as ValidationPhaseResult;
}

function mergeStructural(
  base: ValidationPhaseResult,
  violations: readonly AiCoreV3Violation[],
): ValidationPhaseResult {
  const merged = [...base.violations, ...violations];
  return immutableCopy({
    category: 'structural' as const,
    status: merged.length === 0 ? 'passed' as const : 'failed' as const,
    violations: merged,
  }) as ValidationPhaseResult;
}

export function validateExperienceV3CandidateStructure(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
  output: ExperienceV3ProviderOutput,
): ValidationPhaseResult {
  const base = validateStructuralPhase({ manifest, candidate });
  const violations: AiCoreV3Violation[] = [];
  if (output.entryId !== manifest.entryId) {
    violations.push(phaseViolation('entry_id_mismatch', 'structural', 'Provider entryId does not match the manifest', manifest.entryId));
  }
  if (output.bullets.length !== 3 || candidate.units?.length !== 3) {
    violations.push(phaseViolation('invalid_bullet_count', 'structural', 'Exactly three candidate bullets are required', manifest.entryId));
  }
  if (output.bullets.some((bullet) => !bullet.trim())) {
    violations.push(phaseViolation('empty_bullet', 'structural', 'Candidate bullets must be non-empty', manifest.entryId));
  }
  if (bulletsHaveNearDuplicate(output.bullets)) {
    violations.push(phaseViolation('duplicate_bullet', 'structural', 'Duplicate or near-identical bullets are forbidden', manifest.entryId));
  }
  if (candidate.units?.some((unit, index) => (
    unit.entryId !== manifest.entryId || unit.text !== output.bullets[index]
  ))) {
    violations.push(phaseViolation('candidate_unit_mismatch', 'structural', 'Candidate units changed provider bullet identity', manifest.entryId));
  }
  return mergeStructural(base, violations);
}

function parseViolation(value: unknown, category: EvaluatedCategory): AiCoreV3Violation | null {
  if (!isRecord(value) || !exactKeys(value, ['code', 'category', 'detail'], ['factIds', 'entryIds'])) return null;
  if (
    value.category !== category
    || typeof value.code !== 'string'
    || !value.code.trim()
    || typeof value.detail !== 'string'
    || !value.detail.trim()
    || (value.factIds !== undefined && (!Array.isArray(value.factIds) || value.factIds.some((id) => typeof id !== 'string')))
    || (value.entryIds !== undefined && (!Array.isArray(value.entryIds) || value.entryIds.some((id) => typeof id !== 'string')))
  ) return null;
  return immutableCopy({
    code: value.code,
    category,
    detail: value.detail,
    ...(value.factIds !== undefined ? { factIds: value.factIds as string[] } : {}),
    ...(value.entryIds !== undefined ? { entryIds: value.entryIds as string[] } : {}),
  }) as AiCoreV3Violation;
}

function parseEvaluatorPhase(value: unknown, category: EvaluatedCategory): EvaluatorPhasePayload | null {
  if (!isRecord(value) || !exactKeys(value, ['status', 'violations'])) return null;
  if ((value.status !== 'passed' && value.status !== 'failed') || !Array.isArray(value.violations)) return null;
  const violations = value.violations.map((item) => parseViolation(item, category));
  if (violations.some((item) => item === null)) return null;
  if (value.status === 'passed' && violations.length !== 0) return null;
  if (value.status === 'failed' && violations.length === 0) return null;
  return immutableCopy({ status: value.status, violations }) as EvaluatorPhasePayload;
}

type EvaluatorToolRejectionReason =
  | 'evaluator_max_tokens'
  | 'evaluator_tool_missing'
  | 'evaluator_multiple_tools'
  | 'evaluator_wrong_tool'
  | 'evaluator_unexpected_text_block'
  | 'evaluator_tool_input_malformed'
  | 'evaluator_identity_mismatch'
  | 'evaluator_output_malformed';

export type ExperienceV3EvaluatorToolParseResult =
  | {
    readonly ok: true;
    readonly value: EvaluatorPayload;
    readonly diagnosticMetadata: ExperienceV3EvaluatorDiagnosticMetadata;
  }
  | {
    readonly ok: false;
    readonly typedReason: EvaluatorToolRejectionReason;
    readonly diagnosticMetadata: ExperienceV3EvaluatorDiagnosticMetadata;
  };

function rejectEvaluatorTool(
  typedReason: EvaluatorToolRejectionReason,
  diagnosticMetadata: ExperienceV3EvaluatorDiagnosticMetadata,
): ExperienceV3EvaluatorToolParseResult {
  return immutableCopy({ ok: false as const, typedReason, diagnosticMetadata }) as ExperienceV3EvaluatorToolParseResult;
}

function parseExperienceV3EvaluatorToolInput(
  value: unknown,
  manifest: ExperienceFactManifest,
  baseMetadata: ExperienceV3EvaluatorDiagnosticMetadata,
): ExperienceV3EvaluatorToolParseResult {
  const inputObject = isRecord(value);
  const inputMetadata = withEvaluatorDiagnosticMetadata(baseMetadata, {
    evaluatorToolInputObject: inputObject,
  });
  if (!inputObject || !exactKeys(
    value,
    ['operationId', 'entryId', 'snapshotHash', 'locale', 'phases'],
  )) return rejectEvaluatorTool('evaluator_tool_input_malformed', withEvaluatorDiagnosticMetadata(inputMetadata, {
    evaluatorToolInputSchemaPassed: false,
    evaluatorIdentityPassed: null,
  }));
  if (!isRecord(value.phases) || !exactKeys(value.phases, ['semantic', 'language_quality'])) {
    return rejectEvaluatorTool('evaluator_tool_input_malformed', withEvaluatorDiagnosticMetadata(inputMetadata, {
      evaluatorToolInputSchemaPassed: false,
      evaluatorIdentityPassed: null,
    }));
  }
  const semantic = parseEvaluatorPhase(value.phases.semantic, 'semantic');
  const languageQuality = parseEvaluatorPhase(value.phases.language_quality, 'language_quality');
  if (
    typeof value.operationId !== 'string'
    || typeof value.entryId !== 'string'
    || typeof value.snapshotHash !== 'string'
    || typeof value.locale !== 'string'
    || !semantic
    || !languageQuality
  ) return rejectEvaluatorTool('evaluator_tool_input_malformed', withEvaluatorDiagnosticMetadata(inputMetadata, {
    evaluatorToolInputSchemaPassed: false,
    evaluatorIdentityPassed: null,
  }));
  const schemaMetadata = withEvaluatorDiagnosticMetadata(inputMetadata, {
    evaluatorToolInputSchemaPassed: true,
  });
  if (
    value.operationId !== manifest.operationId
    || value.entryId !== manifest.entryId
    || value.snapshotHash !== manifest.snapshotHash
    || value.locale !== manifest.locale
  ) return rejectEvaluatorTool('evaluator_identity_mismatch', withEvaluatorDiagnosticMetadata(schemaMetadata, {
    evaluatorIdentityPassed: false,
  }));
  return immutableCopy({ ok: true as const, value: {
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    phases: { semantic, language_quality: languageQuality },
  }, diagnosticMetadata: withEvaluatorDiagnosticMetadata(schemaMetadata, {
    evaluatorIdentityPassed: true,
  }) }) as ExperienceV3EvaluatorToolParseResult;
}

export function parseExperienceV3EvaluatorToolResponse(
  response: ExperienceV3EvaluatorResponse,
  manifest: ExperienceFactManifest,
): ExperienceV3EvaluatorToolParseResult {
  const diagnosticMetadata = evaluatorDiagnosticMetadata(response);
  if (!response || typeof response !== 'object' || !Array.isArray(response.content)) {
    return rejectEvaluatorTool('evaluator_output_malformed', diagnosticMetadata);
  }
  if (response.stopReason === 'max_tokens') return rejectEvaluatorTool('evaluator_max_tokens', diagnosticMetadata);
  if (response.stopReason !== 'tool_use') return rejectEvaluatorTool('evaluator_output_malformed', diagnosticMetadata);

  const unexpected = response.content.find((block) => block.type !== 'tool_use');
  if (unexpected?.type === 'text') return rejectEvaluatorTool('evaluator_unexpected_text_block', diagnosticMetadata);
  if (unexpected) return rejectEvaluatorTool('evaluator_output_malformed', diagnosticMetadata);

  const toolBlocks = response.content.filter((block): block is Extract<ExperienceV3EvaluatorContentBlock, { type: 'tool_use' }> => (
    block.type === 'tool_use'
  ));
  if (toolBlocks.length === 0) return rejectEvaluatorTool('evaluator_tool_missing', diagnosticMetadata);
  if (toolBlocks.length !== 1) return rejectEvaluatorTool('evaluator_multiple_tools', diagnosticMetadata);
  const [tool] = toolBlocks;
  if (tool.name !== EXPERIENCE_V3_EVALUATOR_TOOL_NAME) return rejectEvaluatorTool('evaluator_wrong_tool', diagnosticMetadata);
  return parseExperienceV3EvaluatorToolInput(tool.input, manifest, diagnosticMetadata);
}

function aggregateWithPhases(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
  structural: ValidationPhaseResult,
  semantic: ValidationPhaseResult,
  languageQuality: ValidationPhaseResult,
): AggregateValidationResult {
  return runAiCoreV3Validation({ manifest, candidate }, {
    structural: () => structural,
    semantic: () => semantic,
    languageQuality: () => languageQuality,
  });
}

function candidateFromOutput(
  manifest: ExperienceFactManifest,
  output: ExperienceV3ProviderOutput,
): AiCoreV3CandidateEnvelope {
  const text = output.bullets.map((bullet) => `• ${bullet}`).join('\n');
  return createCandidateEnvelope({
    operationId: manifest.operationId,
    candidateId: hashExperienceV3Value(`${manifest.operationId}:${manifest.snapshotHash}:${text}`),
    operationKind: 'experience_generate',
    targetLocale: manifest.locale,
    sourceSnapshotHash: manifest.snapshotHash,
    text,
    units: output.bullets.map((bullet, index) => ({
      unitId: `${manifest.entryId}:bullet:${index + 1}`,
      entryId: manifest.entryId,
      text: bullet,
    })),
  });
}

function safeDiagnosticCode(value: string): string | null {
  return /^[a-z][a-z0-9_]{0,63}$/u.test(value) ? value : null;
}

function phaseViolationCodes(
  validation: AggregateValidationResult | undefined,
  category: EvaluatedCategory,
): { count: number | null; codes: readonly string[]; violations: readonly AiCoreV3Violation[] } {
  const phase = validation?.phases[category];
  if (!phase || phase.status === 'not_evaluated') return { count: null, codes: [], violations: [] };
  return {
    count: phase.violations.length,
    codes: phase.violations
      .map((violation) => safeDiagnosticCode(violation.code))
      .filter((code): code is string => code !== null),
    violations: phase.violations,
  };
}

function violationIdentityHashesByCode(
  violations: readonly AiCoreV3Violation[],
  identity: 'factIds' | 'entryIds',
): Readonly<Record<string, readonly string[]>> {
  const result: Record<string, readonly string[]> = {};
  for (const violation of violations) {
    const code = safeDiagnosticCode(violation.code);
    if (!code) continue;
    const rawIds = violation[identity] || [];
    const hashes = rawIds.map((id) => hashExperienceV3Value(id));
    if (hashes.length === 0) continue;
    const prior = result[code] || [];
    result[code] = [...new Set([...prior, ...hashes])];
  }
  return immutableCopy(result) as Readonly<Record<string, readonly string[]>>;
}

function buildExperienceV3DiagnosticEvidence(
  candidate: AiCoreV3CandidateEnvelope | null,
  evaluatorMetadata: ExperienceV3EvaluatorDiagnosticMetadata = unavailableEvaluatorDiagnosticMetadata(),
  validation?: AggregateValidationResult,
  providerFailure?: ReturnType<typeof classifyExperienceV3EnhanceProviderFailure>,
): ExperienceV3DiagnosticEvidence {
  const semantic = phaseViolationCodes(validation, 'semantic');
  const languageQuality = phaseViolationCodes(validation, 'language_quality');
  const violations = [...semantic.violations, ...languageQuality.violations];
  const primaryValidationRejectionCode = validation?.decision === 'reject'
    ? [...semantic.violations, ...languageQuality.violations]
      .map((violation) => safeDiagnosticCode(violation.code))
      .find((code): code is string => code !== null) || null
    : null;
  return immutableCopy({
    candidatePresent: Boolean(candidate),
    candidateHash: candidate ? hashExperienceV3Value(candidate.text) : null,
    candidateUnitCount: candidate ? candidate.units?.length || 0 : null,
    candidateUnitHashes: candidate ? (candidate.units || []).map((unit) => hashExperienceV3Value(unit.text)) : [],
    candidateUnitLengths: candidate ? (candidate.units || []).map((unit) => unit.text.length) : [],
    ...evaluatorMetadata,
    ...(providerFailure ? providerFailure : {}),
    semanticViolationCount: semantic.count,
    semanticViolationCodes: semantic.codes,
    languageQualityViolationCount: languageQuality.count,
    languageQualityViolationCodes: languageQuality.codes,
    violationFactIdHashesByCode: violationIdentityHashesByCode(violations, 'factIds'),
    violationEntryIdHashesByCode: violationIdentityHashesByCode(violations, 'entryIds'),
    primaryValidationRejectionCode,
  }) as ExperienceV3DiagnosticEvidence;
}

function buildExperienceV3InternalRejectionAudit(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
  evaluatorMetadata: ExperienceV3EvaluatorDiagnosticMetadata,
  validation: AggregateValidationResult,
): ExperienceV3InternalRejectionAudit | undefined {
  if (!INTERNAL_AI_RESET_ENABLED || validation.decision !== 'reject') return undefined;
  return immutableCopy({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    candidate: {
      candidateId: candidate.candidateId,
      units: (candidate.units || []).map((unit) => ({
        unitId: unit.unitId,
        entryId: unit.entryId,
        text: unit.text,
      })),
    },
    phases: {
      structural: validation.phases.structural.status,
      semantic: validation.phases.semantic.status,
      language_quality: validation.phases.language_quality.status,
    },
    evaluator: {
      ...evaluatorMetadata,
      semanticViolations: validation.phases.semantic.violations,
      languageQualityViolations: validation.phases.language_quality.violations,
    },
  }) as ExperienceV3InternalRejectionAudit;
}

export function buildExperienceV3WriterPrompt(manifest: ExperienceFactManifest): string {
  const tense = manifest.employmentState === 'present' ? 'present tense' : 'past tense';
  return [
    'Generate exactly three conservative CV duty bullets from the immutable Experience manifest below.',
    `Write only in locale ${manifest.locale}, using ${tense} and a neutral or third-person CV form.`,
    'Structured role/context may guide ordinary duties, but it is not evidence of achievements or concrete facts.',
    'Never invent metrics, quantities, certifications, software, tools, equipment, leadership, team size, achievements, outcomes, clients, locations, regulations, procedures, or employer-specific claims.',
    'Do not write a first-person autobiographical paragraph; return concise CV bullets only.',
    'Do not include headings, commentary, diagnostics, Summary content, apply authorization, or usage authorization.',
    'Return strict JSON only with exactly these keys: operationId, entryId, snapshotHash, locale, bullets.',
    'bullets must be an array of exactly three non-empty, distinct strings. Do not add markdown fences.',
    JSON.stringify(manifest),
  ].join('\n');
}

export function buildExperienceV3EvaluatorPrompt(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
): string {
  return [
    'Act only as an independent non-writing validator. Never rewrite, correct, or replace candidate prose.',
    'Check relevance, unsupported concrete claims, metrics, achievements, certifications, tools, leadership, cross-entry facts, role/company mutation, responsibility escalation, Summary leakage, target locale/script, grammar, CV form, and employment tense.',
    `Invoke only the ${EXPERIENCE_V3_EVALUATOR_TOOL_NAME} tool. Do not emit text, Markdown, code fences, commentary, explanations, headings, or reasoning.`,
    'Its input has exactly operationId, entryId, snapshotHash, locale, and phases. Echo operationId, entryId, snapshotHash, and locale exactly from the immutable manifest.',
    'phases has exactly semantic and language_quality. Each phase has exactly status (passed or failed) and violations.',
    'Each violation contains only code, category, detail, and optional factIds/entryIds. A passed phase has an empty violations array; a failed phase has at least one violation.',
    'Keep each violation detail concise and return no fields other than the required validation schema.',
    'Do not return replacement prose, corrected bullets, apply authorization, or usage authorization.',
    JSON.stringify({ manifest, candidate }),
  ].join('\n');
}

export async function executeExperienceV3GenerateServer(
  rawRequest: unknown,
  transports: ExperienceV3GenerateTransportSet,
): Promise<ExperienceV3GenerateResponse> {
  const manifest = parseExperienceV3GenerateRequest(rawRequest);
  if (!manifest) return failure('invalid_request_contract');

  let writerRaw: string;
  try {
    writerRaw = await transports.generate(buildExperienceV3WriterPrompt(manifest));
  } catch (error) {
    const providerFailure = providerFailureEvidence(error);
    return failure(
      providerFailure.providerErrorType === 'timeout' ? 'writer_timeout' : 'writer_request_failed',
      undefined,
      buildExperienceV3DiagnosticEvidence(
        null,
        unavailableEvaluatorDiagnosticMetadata(),
        undefined,
        providerFailure,
      ),
    );
  }
  const providerOutput = parseExperienceV3ProviderOutput(writerRaw, manifest);
  if (!providerOutput) return failure('provider_output_malformed');

  const candidate = candidateFromOutput(manifest, providerOutput);
  const structural = validateExperienceV3CandidateStructure(manifest, candidate, providerOutput);
  if (structural.status !== 'passed') {
    const validation = aggregateWithPhases(
      manifest,
      candidate,
      structural,
      notEvaluatedPhase('semantic'),
      notEvaluatedPhase('language_quality'),
    );
    return failure(
      'structural_validation_failed',
      validation,
      buildExperienceV3DiagnosticEvidence(candidate, unavailableEvaluatorDiagnosticMetadata(), validation),
    );
  }

  let evaluatorResponse: ExperienceV3EvaluatorResponse;
  try {
    evaluatorResponse = await transports.evaluate(buildExperienceV3EvaluatorPrompt(manifest, candidate));
  } catch (error) {
    const providerFailure = providerFailureEvidence(error);
    const validation = aggregateWithPhases(
      manifest,
      candidate,
      structural,
      notEvaluatedPhase('semantic'),
      notEvaluatedPhase('language_quality'),
    );
    return failure(
      providerFailure.providerErrorType === 'timeout' ? 'evaluator_timeout' : 'evaluator_request_failed',
      validation,
      buildExperienceV3DiagnosticEvidence(
        candidate,
        unavailableEvaluatorDiagnosticMetadata(),
        validation,
        providerFailure,
      ),
    );
  }
  const evaluatorResult = parseExperienceV3EvaluatorToolResponse(evaluatorResponse, manifest);
  if (!evaluatorResult.ok) {
    const validation = aggregateWithPhases(
      manifest,
      candidate,
      structural,
      notEvaluatedPhase('semantic'),
      notEvaluatedPhase('language_quality'),
    );
    return failure(
      evaluatorResult.typedReason,
      validation,
      buildExperienceV3DiagnosticEvidence(candidate, evaluatorResult.diagnosticMetadata, validation),
    );
  }
  const evaluator = evaluatorResult.value;

  const semantic = immutableCopy({
    category: 'semantic' as const,
    status: evaluator.phases.semantic.status,
    violations: evaluator.phases.semantic.violations,
  }) as ValidationPhaseResult;
  const languageQuality = immutableCopy({
    category: 'language_quality' as const,
    status: evaluator.phases.language_quality.status,
    violations: evaluator.phases.language_quality.violations,
  }) as ValidationPhaseResult;
  const validation = aggregateWithPhases(manifest, candidate, structural, semantic, languageQuality);
  const diagnosticEvidence = buildExperienceV3DiagnosticEvidence(
    candidate,
    evaluatorResult.diagnosticMetadata,
    validation,
  );
  if (validation.decision !== 'accept') return failure(
    'validation_rejected',
    validation,
    diagnosticEvidence,
    buildExperienceV3InternalRejectionAudit(
      manifest,
      candidate,
      evaluatorResult.diagnosticMetadata,
      validation,
    ),
  );

  return immutableCopy({
    ok: true as const,
    action: EXPERIENCE_V3_GENERATE_ACTION,
    providerOutput,
    candidate,
    validation,
    diagnosticEvidence,
  }) as ExperienceV3GenerateResponse;
}
