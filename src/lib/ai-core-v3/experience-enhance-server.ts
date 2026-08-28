import { createCandidateEnvelope } from './candidate-envelope';
import type { AiCoreV3CandidateEnvelope, ExperienceFactManifest } from './contracts';
import { createExperienceFactManifest } from './experience-manifest';
import {
  EXPERIENCE_V3_ENHANCE_ACTION,
  EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS,
  hashExperienceV3EnhanceValue,
  type ExperienceV3EnhanceMaterialityEvidence,
  type ExperienceV3EnhanceMaterialityKind,
  type ExperienceV3EnhanceProviderOutput,
  type ExperienceV3EnhanceResponse,
} from './experience-enhance';
import { immutableCopy } from './immutability';
import {
  runAiCoreV3Validation,
  validateStructuralPhase,
  type AggregateValidationResult,
  type AiCoreV3Violation,
  type ValidationPhaseResult,
} from './validators';

export interface ExperienceV3EnhanceTransportSet {
  readonly generate: (prompt: string) => Promise<string>;
  readonly evaluate: (prompt: string) => Promise<string>;
}

type EvaluatedCategory = 'semantic' | 'language_quality';
type EvaluatorPhasePayload = {
  readonly status: 'passed' | 'failed';
  readonly violations: readonly AiCoreV3Violation[];
};
type EvaluatorMaterialityPayload = {
  readonly status: 'material' | 'no_op' | 'degraded';
  readonly kind: ExperienceV3EnhanceMaterialityKind | null;
  readonly sourceEquivalent: boolean;
  readonly degradationDetected: boolean;
};
type EvaluatorPayload = {
  readonly operationId: string;
  readonly entryId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly phases: {
    readonly semantic: EvaluatorPhasePayload;
    readonly language_quality: EvaluatorPhasePayload;
  };
  readonly materiality: EvaluatorMaterialityPayload;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.has(key));
}

function failure(
  typedReason: string,
  validation?: AggregateValidationResult,
): ExperienceV3EnhanceResponse {
  return immutableCopy({
    ok: false as const,
    action: EXPERIENCE_V3_ENHANCE_ACTION,
    typedReason,
    ...(validation ? { validation } : {}),
  }) as ExperienceV3EnhanceResponse;
}

function parseDate(value: unknown): { readonly year: number; readonly month?: number; readonly day?: number } | null {
  if (!isRecord(value) || !exactKeys(value, ['year'], ['month', 'day']) || !Number.isInteger(value.year)) return null;
  if (value.month !== undefined && (!Number.isInteger(value.month) || Number(value.month) < 1 || Number(value.month) > 12)) return null;
  if (value.day !== undefined && (!Number.isInteger(value.day) || Number(value.day) < 1 || Number(value.day) > 31)) return null;
  return {
    year: Number(value.year),
    ...(value.month !== undefined ? { month: Number(value.month) } : {}),
    ...(value.day !== undefined ? { day: Number(value.day) } : {}),
  };
}

export function parseExperienceV3EnhanceRequest(value: unknown): ExperienceFactManifest | null {
  if (!isRecord(value) || !exactKeys(value, ['manifest'])) return null;
  const manifest = value.manifest;
  if (!isRecord(manifest) || !exactKeys(manifest, [
    'operationId', 'operationKind', 'mode', 'entryId', 'locale', 'roleTitle', 'company',
    'employmentState', 'dates', 'exactSourceText', 'facts', 'snapshotHash',
    'sourceLocale', 'targetLocale', 'contextHash',
  ], ['industry', 'level'])) return null;
  if (
    manifest.operationKind !== 'experience_enhance'
    || manifest.mode !== 'enhance'
    || typeof manifest.operationId !== 'string'
    || typeof manifest.entryId !== 'string'
    || typeof manifest.locale !== 'string'
    || typeof manifest.roleTitle !== 'string'
    || typeof manifest.company !== 'string'
    || (manifest.employmentState !== 'present' && manifest.employmentState !== 'completed')
    || typeof manifest.exactSourceText !== 'string'
    || !manifest.exactSourceText.trim()
    || typeof manifest.snapshotHash !== 'string'
    || typeof manifest.sourceLocale !== 'string'
    || typeof manifest.targetLocale !== 'string'
    || typeof manifest.contextHash !== 'string'
    || manifest.sourceLocale !== manifest.locale
    || manifest.targetLocale !== manifest.locale
    || !Array.isArray(manifest.facts)
    || manifest.facts.length === 0
    || !isRecord(manifest.dates)
    || !exactKeys(manifest.dates, ['start', 'end'])
  ) return null;
  const start = parseDate(manifest.dates.start);
  const end = manifest.dates.end === null ? null : parseDate(manifest.dates.end);
  if (!start || (manifest.employmentState === 'present' ? end !== null : !end)) return null;
  const facts = manifest.facts.map((fact) => {
    if (!isRecord(fact) || !exactKeys(fact, ['factId', 'text', 'sourceHash', 'required'])) return null;
    if (typeof fact.factId !== 'string' || !fact.factId.trim()
      || typeof fact.text !== 'string' || !fact.text.trim()
      || typeof fact.sourceHash !== 'string' || !fact.sourceHash.trim()
      || fact.required !== true) return null;
    return { factId: fact.factId, text: fact.text, sourceHash: fact.sourceHash, required: true as const };
  });
  if (facts.some((fact) => fact === null)) return null;
  const factIds = facts.map((fact) => fact!.factId);
  if (new Set(factIds).size !== factIds.length) return null;
  try {
    return createExperienceFactManifest({
      operationId: manifest.operationId,
      mode: 'enhance',
      entryId: manifest.entryId,
      locale: manifest.locale,
      roleTitle: manifest.roleTitle,
      company: manifest.company,
      employmentState: manifest.employmentState,
      dates: { start, end },
      ...(typeof manifest.industry === 'string' ? { industry: manifest.industry } : {}),
      ...(typeof manifest.level === 'string' ? { level: manifest.level } : {}),
      exactSourceText: manifest.exactSourceText,
      facts: facts as NonNullable<(typeof facts)[number]>[],
      snapshotHash: manifest.snapshotHash,
      sourceLocale: manifest.sourceLocale,
      targetLocale: manifest.targetLocale,
      contextHash: manifest.contextHash,
    });
  } catch {
    return null;
  }
}

function parseStrictJson(raw: string): unknown {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.startsWith('```') || trimmed.endsWith('```')) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function unitTextIsStructurallySafe(text: string): boolean {
  const trimmed = text.trim();
  return Boolean(trimmed)
    && !/^#{1,6}\s/u.test(trimmed)
    && !/^(?:here(?:'s| is| are)|enhanced|rewritten|output|explanation|summary)\b/iu.test(trimmed)
    && !/```/u.test(trimmed);
}

function comparableUnit(value: string): string {
  return value.normalize('NFKC')
    .replace(/^\s*(?:[-*•▪◦‣⁃]|\d+[.)])\s*/u, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase();
}

function unitsHaveNearDuplicate(units: readonly string[]): boolean {
  const normalized = units.map(comparableUnit);
  return new Set(normalized).size !== normalized.length;
}

export function parseExperienceV3EnhanceProviderOutput(
  raw: string,
  manifest: ExperienceFactManifest,
): ExperienceV3EnhanceProviderOutput | null {
  const value = parseStrictJson(raw);
  if (!isRecord(value) || !exactKeys(value, ['operationId', 'entryId', 'snapshotHash', 'locale', 'units'])) return null;
  if (
    value.operationId !== manifest.operationId
    || value.entryId !== manifest.entryId
    || value.snapshotHash !== manifest.snapshotHash
    || value.locale !== manifest.locale
    || !Array.isArray(value.units)
    || value.units.length !== manifest.facts.length
  ) return null;
  const units = value.units.map((unit, index) => {
    if (!isRecord(unit) || !exactKeys(unit, ['factId', 'text'])) return null;
    if (unit.factId !== manifest.facts[index].factId || typeof unit.text !== 'string' || !unitTextIsStructurallySafe(unit.text)) return null;
    return { factId: unit.factId as string, text: unit.text };
  });
  if (units.some((unit) => unit === null)) return null;
  const typedUnits = units as ExperienceV3EnhanceProviderOutput['units'];
  if (new Set(typedUnits.map((unit) => unit.factId)).size !== typedUnits.length) return null;
  if (unitsHaveNearDuplicate(typedUnits.map((unit) => unit.text))) return null;
  return immutableCopy({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    units: typedUnits,
  }) as ExperienceV3EnhanceProviderOutput;
}

function candidateFromOutput(
  manifest: ExperienceFactManifest,
  output: ExperienceV3EnhanceProviderOutput,
): AiCoreV3CandidateEnvelope {
  const text = output.units.map((unit) => `• ${unit.text}`).join('\n');
  return createCandidateEnvelope({
    operationId: manifest.operationId,
    candidateId: hashExperienceV3EnhanceValue(`${manifest.operationId}:${manifest.snapshotHash}:${text}`),
    operationKind: 'experience_enhance',
    targetLocale: manifest.locale,
    sourceSnapshotHash: manifest.snapshotHash,
    text,
    units: output.units.map((unit, index) => ({
      unitId: `${manifest.entryId}:enhance:${index + 1}`,
      entryId: manifest.entryId,
      factIds: [unit.factId],
      text: unit.text,
    })),
  });
}

function phaseViolation(code: string, detail: string, manifest: ExperienceFactManifest): AiCoreV3Violation {
  return { code, category: 'structural', detail, entryIds: [manifest.entryId] };
}

function validateEnhanceStructure(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
  output: ExperienceV3EnhanceProviderOutput,
): ValidationPhaseResult {
  const base = validateStructuralPhase({ manifest, candidate });
  const violations: AiCoreV3Violation[] = [...base.violations];
  if (output.units.length !== manifest.facts.length || candidate.units?.length !== manifest.facts.length) {
    violations.push(phaseViolation('fact_unit_count_mismatch', 'Every required fact must own exactly one candidate unit', manifest));
  }
  if (output.units.some((unit, index) => unit.factId !== manifest.facts[index]?.factId)) {
    violations.push(phaseViolation('fact_id_coverage_mismatch', 'Candidate fact IDs must exactly preserve source order', manifest));
  }
  if (candidate.units?.some((unit, index) => (
    unit.entryId !== manifest.entryId
    || unit.text !== output.units[index]?.text
    || unit.factIds?.length !== 1
    || unit.factIds[0] !== manifest.facts[index]?.factId
  ))) {
    violations.push(phaseViolation('candidate_unit_mismatch', 'Candidate units changed writer identity or text', manifest));
  }
  return immutableCopy({
    category: 'structural' as const,
    status: violations.length === 0 ? 'passed' as const : 'failed' as const,
    violations,
  }) as ValidationPhaseResult;
}

function parseViolation(value: unknown, category: EvaluatedCategory): AiCoreV3Violation | null {
  if (!isRecord(value) || !exactKeys(value, ['code', 'category', 'detail'], ['factIds', 'entryIds'])) return null;
  if (value.category !== category || typeof value.code !== 'string' || !value.code.trim()
    || typeof value.detail !== 'string' || !value.detail.trim()
    || (value.factIds !== undefined && (!Array.isArray(value.factIds) || value.factIds.some((id) => typeof id !== 'string')))
    || (value.entryIds !== undefined && (!Array.isArray(value.entryIds) || value.entryIds.some((id) => typeof id !== 'string')))) return null;
  return immutableCopy({
    code: value.code,
    category,
    detail: value.detail,
    ...(value.factIds !== undefined ? { factIds: value.factIds as string[] } : {}),
    ...(value.entryIds !== undefined ? { entryIds: value.entryIds as string[] } : {}),
  }) as AiCoreV3Violation;
}

function parseEvaluatorPhase(value: unknown, category: EvaluatedCategory): EvaluatorPhasePayload | null {
  if (!isRecord(value) || !exactKeys(value, ['status', 'violations']) || !Array.isArray(value.violations)) return null;
  if (value.status !== 'passed' && value.status !== 'failed') return null;
  const violations = value.violations.map((item) => parseViolation(item, category));
  if (violations.some((item) => item === null)) return null;
  if ((value.status === 'passed' && violations.length !== 0) || (value.status === 'failed' && violations.length === 0)) return null;
  return immutableCopy({ status: value.status, violations }) as EvaluatorPhasePayload;
}

export function parseExperienceV3EnhanceEvaluatorOutput(
  raw: string,
  manifest: ExperienceFactManifest,
): EvaluatorPayload | null {
  const value = parseStrictJson(raw);
  if (!isRecord(value) || !exactKeys(value, [
    'operationId', 'entryId', 'snapshotHash', 'locale', 'phases', 'materiality',
  ])) return null;
  if (
    value.operationId !== manifest.operationId
    || value.entryId !== manifest.entryId
    || value.snapshotHash !== manifest.snapshotHash
    || value.locale !== manifest.locale
    || !isRecord(value.phases)
    || !exactKeys(value.phases, ['semantic', 'language_quality'])
    || !isRecord(value.materiality)
    || !exactKeys(value.materiality, ['status', 'kind', 'sourceEquivalent', 'degradationDetected'])
  ) return null;
  const semantic = parseEvaluatorPhase(value.phases.semantic, 'semantic');
  const languageQuality = parseEvaluatorPhase(value.phases.language_quality, 'language_quality');
  if (!semantic || !languageQuality) return null;
  const status = value.materiality.status;
  const kind = value.materiality.kind;
  if ((status !== 'material' && status !== 'no_op' && status !== 'degraded')
    || typeof value.materiality.sourceEquivalent !== 'boolean'
    || typeof value.materiality.degradationDetected !== 'boolean') return null;
  if (status === 'material') {
    if (!EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS.includes(kind as ExperienceV3EnhanceMaterialityKind)
      || value.materiality.sourceEquivalent !== false || value.materiality.degradationDetected !== false) return null;
  } else if (kind !== null) return null;
  if (status === 'degraded' && value.materiality.degradationDetected !== true) return null;
  return immutableCopy({
    operationId: manifest.operationId,
    entryId: manifest.entryId,
    snapshotHash: manifest.snapshotHash,
    locale: manifest.locale,
    phases: { semantic, language_quality: languageQuality },
    materiality: {
      status,
      kind: kind as ExperienceV3EnhanceMaterialityKind | null,
      sourceEquivalent: value.materiality.sourceEquivalent,
      degradationDetected: value.materiality.degradationDetected,
    },
  }) as EvaluatorPayload;
}

function aggregate(
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

function comparableSource(value: string): string {
  return value.normalize('NFKC')
    .split(/\r?\n/u)
    .map((line) => line.replace(/^\s*(?:[-*•▪◦‣⁃]|\d+[.)])\s*/u, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function materialityIsCosmeticOnly(
  manifest: ExperienceFactManifest,
  output: ExperienceV3EnhanceProviderOutput,
  materiality: EvaluatorMaterialityPayload,
): boolean {
  const source = comparableSource(manifest.exactSourceText);
  const candidate = comparableSource(output.units.map((unit) => unit.text).join('\n'));
  if (source === candidate) return true;
  const punctuationFree = (value: string) => value.replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/gu, ' ').trim();
  if (punctuationFree(source) === punctuationFree(candidate)) return true;
  if (source.toLocaleLowerCase() === candidate.toLocaleLowerCase()) {
    return materiality.kind !== 'grammar_correction';
  }
  return false;
}

export function buildExperienceV3EnhanceWriterPrompt(manifest: ExperienceFactManifest): string {
  const tense = manifest.employmentState === 'present' ? 'current/present CV form' : 'completed/past CV form';
  return [
    'Enhance the exact Experience source without adding, deleting, merging, or moving material facts.',
    `Write only in locale ${manifest.locale} using ${tense}. Preserve professional CV perspective.`,
    'Return exactly one unit for every required factId, in the supplied source order.',
    'Improve only grammar, clarity, safe concision, professional phrasing, tense, or CV perspective.',
    'Never invent metrics, achievements, tools, certifications, leadership, ownership, scope, responsibility, domain expertise, or universal claims.',
    'Do not return headings, commentary, markdown, diagnostics, Summary prose, validation, apply authority, usage authority, or mutation instructions.',
    'Return strict JSON only with exactly operationId, entryId, snapshotHash, locale, and units. Each unit has exactly factId and text.',
    JSON.stringify(manifest),
  ].join('\n');
}

export function buildExperienceV3EnhanceEvaluatorPrompt(
  manifest: ExperienceFactManifest,
  candidate: AiCoreV3CandidateEnvelope,
): string {
  return [
    'Act only as an independent non-writing validator. Never rewrite, repair, or suggest replacement prose.',
    'Check complete fact retention, entry ownership, unsupported claims, escalation, quantifiers, cross-entry leakage, role/company/date mutation, target language/script, grammar, clarity, employment tense, CV perspective, degradation, and material improvement.',
    'Return strict JSON only with operationId, entryId, snapshotHash, locale, phases, and materiality.',
    'phases contains exactly semantic and language_quality; each contains status and structured violations.',
    `materiality status is material, no_op, or degraded. A material result requires exactly one kind from: ${EXPERIENCE_V3_ENHANCE_MATERIALITY_KINDS.join(', ')}.`,
    'For no_op or degraded, kind must be null. Include sourceEquivalent and degradationDetected booleans.',
    'Do not return candidate text, corrected units, apply authority, usage authority, persistence authority, or acceptance authority.',
    JSON.stringify({ manifest, candidate }),
  ].join('\n');
}

export async function executeExperienceV3EnhanceServer(
  rawRequest: unknown,
  transports: ExperienceV3EnhanceTransportSet,
): Promise<ExperienceV3EnhanceResponse> {
  const manifest = parseExperienceV3EnhanceRequest(rawRequest);
  if (!manifest) return failure('invalid_request_contract');
  let writerRaw: string;
  try {
    writerRaw = await transports.generate(buildExperienceV3EnhanceWriterPrompt(manifest));
  } catch {
    return failure('provider_request_failed');
  }
  const providerOutput = parseExperienceV3EnhanceProviderOutput(writerRaw, manifest);
  if (!providerOutput) return failure('provider_output_malformed');
  const candidate = candidateFromOutput(manifest, providerOutput);
  const structural = validateEnhanceStructure(manifest, candidate, providerOutput);
  if (structural.status !== 'passed') {
    const notEvaluated = (category: EvaluatedCategory): ValidationPhaseResult => ({
      category,
      status: 'not_evaluated',
      violations: [],
    });
    return failure('structural_validation_failed', aggregate(
      manifest,
      candidate,
      structural,
      notEvaluated('semantic'),
      notEvaluated('language_quality'),
    ));
  }
  let evaluatorRaw: string;
  try {
    evaluatorRaw = await transports.evaluate(buildExperienceV3EnhanceEvaluatorPrompt(manifest, candidate));
  } catch {
    return failure('validator_exception');
  }
  const evaluator = parseExperienceV3EnhanceEvaluatorOutput(evaluatorRaw, manifest);
  if (!evaluator) return failure('evaluator_output_malformed');
  const semantic = immutableCopy({ category: 'semantic' as const, ...evaluator.phases.semantic }) as ValidationPhaseResult;
  const languageQuality = immutableCopy({
    category: 'language_quality' as const,
    ...evaluator.phases.language_quality,
  }) as ValidationPhaseResult;
  const validation = aggregate(manifest, candidate, structural, semantic, languageQuality);
  if (validation.decision !== 'accept') return failure('validation_rejected', validation);
  if (evaluator.materiality.status === 'degraded' || evaluator.materiality.degradationDetected) {
    return failure('materiality_degraded', validation);
  }
  if (evaluator.materiality.status !== 'material'
    || evaluator.materiality.sourceEquivalent
    || materialityIsCosmeticOnly(manifest, providerOutput, evaluator.materiality)) {
    return failure('no_material_improvement', validation);
  }
  const materiality = immutableCopy({
    status: 'material' as const,
    kind: evaluator.materiality.kind,
    sourceEquivalent: false as const,
    degradationDetected: false as const,
  }) as ExperienceV3EnhanceMaterialityEvidence;
  return immutableCopy({
    ok: true as const,
    action: EXPERIENCE_V3_ENHANCE_ACTION,
    providerOutput,
    candidate,
    validation,
    materiality,
  }) as ExperienceV3EnhanceResponse;
}
