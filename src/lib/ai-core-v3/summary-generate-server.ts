import { createCandidateEnvelope } from './candidate-envelope';
import type { AiCoreV3CandidateEnvelope } from './contracts';
import { immutableCopy } from './immutability';
import { INTERNAL_AI_RESET_ENABLED } from '../build-channel';
import {
  SUMMARY_V3_GENERATE_ACTION,
  hashSummaryV3Value,
  type SummaryV3GenerateResponse,
  type SummaryV3Manifest,
  type SummaryV3WriterOutput,
  type SummaryV3WriterUnit,
} from './summary-generate';
import {
  runAiCoreV3Validation,
  validateStructuralPhase,
  type AggregateValidationResult,
  type AiCoreV3Violation,
  type ValidationPhaseResult,
} from './validators';

export interface SummaryV3GenerateTransportSet {
  readonly write: (prompt: string) => Promise<string>;
  readonly evaluate: (prompt: string) => Promise<string>;
}

type EvaluatedCategory = 'semantic' | 'language_quality';

interface EvaluatorPayload {
  readonly operationId: string;
  readonly snapshotHash: string;
  readonly locale: string;
  readonly phases: Readonly<Record<EvaluatedCategory, {
    readonly status: 'passed' | 'failed';
    readonly violations: readonly AiCoreV3Violation[];
  }>>;
  readonly checks: Readonly<Record<SummaryEvaluatorCheck, boolean>>;
}

const SUMMARY_EVALUATOR_CHECKS = [
  'factRetention', 'entryOwnership', 'currentPriorSeparation', 'unsupportedClaimsAbsent',
  'roleEmployerStateAccurate', 'durationMeaningAndScope', 'optionalAuthorityRespected',
  'targetLanguageAndScript', 'firstPersonPerspective', 'currentRoleTense', 'priorRoleTense',
  'grammarAndClarity', 'duplicationAndDegradationAbsent', 'completeSummaryUsable',
] as const;
type SummaryEvaluatorCheck = (typeof SUMMARY_EVALUATOR_CHECKS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function failure(
  typedReason: string,
  validation?: AggregateValidationResult,
  repairAttempted?: boolean,
  rejectedCandidate?: AiCoreV3CandidateEnvelope,
): SummaryV3GenerateResponse {
  return immutableCopy({
    ok: false as const,
    action: SUMMARY_V3_GENERATE_ACTION,
    typedReason,
    ...(validation ? { validation } : {}),
    ...(repairAttempted !== undefined ? { repairAttempted } : {}),
    ...(INTERNAL_AI_RESET_ENABLED && rejectedCandidate ? { rejectedCandidate } : {}),
  }) as SummaryV3GenerateResponse;
}

function parseStrictJson(raw: string): unknown {
  const text = String(raw || '').trim();
  if (!text || text.startsWith('```') || text.endsWith('```')) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function parseDate(value: unknown): { readonly year: number; readonly month?: number; readonly day?: number } | null {
  if (!isRecord(value) || !exactKeys(value, ['year'], ['month', 'day']) || !Number.isInteger(value.year)) return null;
  if (value.month !== undefined && (!Number.isInteger(value.month) || Number(value.month) < 1 || Number(value.month) > 12)) return null;
  if (value.day !== undefined && (!Number.isInteger(value.day) || Number(value.day) < 1 || Number(value.day) > 31)) return null;
  return { year: Number(value.year), ...(value.month !== undefined ? { month: Number(value.month) } : {}),
    ...(value.day !== undefined ? { day: Number(value.day) } : {}) };
}

function parseAuthorities(value: unknown): readonly { id: string; text: string; hash: string }[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = value.map((item) => {
    if (!isRecord(item) || !exactKeys(item, ['id', 'text', 'hash'])
      || typeof item.id !== 'string' || !item.id.trim() || typeof item.text !== 'string'
      || typeof item.hash !== 'string' || !item.hash.trim()) return null;
    return { id: item.id, text: item.text, hash: item.hash };
  });
  return parsed.some((item) => item === null) ? null : parsed as readonly { id: string; text: string; hash: string }[];
}

export function parseSummaryV3GenerateRequest(value: unknown): SummaryV3Manifest | null {
  if (!isRecord(value) || !exactKeys(value, ['manifest']) || !isRecord(value.manifest)) return null;
  const manifest = value.manifest;
  if (!exactKeys(manifest, [
    'operationId', 'operationKind', 'targetLocale', 'currentRoleEntryId', 'selectedEntries',
    'structuredTotalDurationMonths', 'skills', 'education', 'languages', 'sourceSnapshotHash',
    'requestedLocale', 'sourceLocale', 'jobContextHash', 'manifestHash', 'gender',
    'skillAuthorities', 'educationAuthorities', 'languageAuthorities',
  ])) return null;
  if (manifest.operationKind !== 'summary_generate' || typeof manifest.operationId !== 'string' || !manifest.operationId.trim()
    || typeof manifest.targetLocale !== 'string' || !manifest.targetLocale.trim()
    || manifest.requestedLocale !== manifest.targetLocale || manifest.sourceLocale !== manifest.targetLocale
    || typeof manifest.sourceSnapshotHash !== 'string' || !manifest.sourceSnapshotHash.trim()
    || typeof manifest.jobContextHash !== 'string' || !manifest.jobContextHash.trim()
    || typeof manifest.manifestHash !== 'string' || !manifest.manifestHash.trim()
    || typeof manifest.gender !== 'string' || typeof manifest.currentRoleEntryId !== 'string'
    || !manifest.currentRoleEntryId.trim() || !Number.isInteger(manifest.structuredTotalDurationMonths)
    || Number(manifest.structuredTotalDurationMonths) < 0 || !Array.isArray(manifest.selectedEntries)
    || manifest.selectedEntries.length === 0 || !Array.isArray(manifest.skills)
    || !Array.isArray(manifest.education) || !Array.isArray(manifest.languages)) return null;
  const entries = manifest.selectedEntries.map((entry) => {
    if (!isRecord(entry) || !exactKeys(entry, [
      'entryId', 'roleTitle', 'employer', 'employmentState', 'dates', 'facts',
      'exactSourceDescription', 'sourceKind', 'sourceHash', 'sourceUnits', 'sourceFactSetHash',
      'rawStartDate', 'rawEndDate', 'indexDiagnostic',
    ]) || typeof entry.entryId !== 'string' || !entry.entryId.trim()
      || typeof entry.roleTitle !== 'string' || !entry.roleTitle.trim() || typeof entry.employer !== 'string'
      || (entry.employmentState !== 'present' && entry.employmentState !== 'completed')
      || typeof entry.exactSourceDescription !== 'string' || !entry.exactSourceDescription.trim()
      || (entry.sourceKind !== 'mounted_textarea' && entry.sourceKind !== 'committed_cv_ref')
      || typeof entry.sourceHash !== 'string' || typeof entry.sourceFactSetHash !== 'string'
      || typeof entry.rawStartDate !== 'string' || typeof entry.rawEndDate !== 'string'
      || !Number.isInteger(entry.indexDiagnostic) || !Array.isArray(entry.sourceUnits)
      || entry.sourceUnits.length === 0 || !Array.isArray(entry.facts) || !isRecord(entry.dates)
      || !exactKeys(entry.dates, ['start', 'end'])) return null;
    const start = parseDate(entry.dates.start);
    const end = entry.dates.end === null ? null : parseDate(entry.dates.end);
    if (!start || (entry.employmentState === 'present' ? end !== null : !end)) return null;
    const facts = entry.facts.map((fact) => {
      if (!isRecord(fact) || !exactKeys(fact, ['factId', 'text', 'sourceHash', 'required'])
        || typeof fact.factId !== 'string' || !fact.factId.trim() || typeof fact.text !== 'string'
        || !fact.text.trim() || typeof fact.sourceHash !== 'string' || fact.required !== true) return null;
      return { factId: fact.factId, text: fact.text, sourceHash: fact.sourceHash, required: true as const };
    });
    if (facts.some((fact) => fact === null) || facts.length !== entry.sourceUnits.length) return null;
    return { ...entry, dates: { start, end }, facts };
  });
  if (entries.some((entry) => entry === null)) return null;
  const typedEntries = entries as unknown as SummaryV3Manifest['selectedEntries'];
  const entryIds = typedEntries.map((entry) => entry.entryId);
  const factIds = typedEntries.flatMap((entry) => entry.facts.map((fact) => fact.factId));
  if (new Set(entryIds).size !== entryIds.length || new Set(factIds).size !== factIds.length
    || !entryIds.includes(manifest.currentRoleEntryId)) return null;
  const skillAuthorities = parseAuthorities(manifest.skillAuthorities);
  const educationAuthorities = parseAuthorities(manifest.educationAuthorities);
  const languageAuthorities = parseAuthorities(manifest.languageAuthorities);
  if (!skillAuthorities || !educationAuthorities || !languageAuthorities) return null;
  const candidate = {
    ...manifest,
    selectedEntries: typedEntries,
    skillAuthorities,
    educationAuthorities,
    languageAuthorities,
  } as unknown as SummaryV3Manifest;
  const { manifestHash: _hash, ...withoutHash } = candidate;
  const hashable = {
    ...withoutHash,
    selectedEntries: candidate.selectedEntries.map(({ indexDiagnostic: _indexDiagnostic, ...entry }) => entry),
  };
  if (hashSummaryV3Value(hashable) !== manifest.manifestHash) return null;
  return immutableCopy(candidate) as SummaryV3Manifest;
}

function safeUnitText(text: string): boolean {
  const trimmed = text.trim();
  return Boolean(trimmed) && !/```|^#{1,6}\s|^(?:[-*•▪◦‣⁃]|\d+[.)])\s|^(?:summary|output|explanation|here(?:'s| is))\b/imu.test(trimmed);
}

export function parseSummaryV3WriterOutput(raw: string, manifest: SummaryV3Manifest): SummaryV3WriterOutput | null {
  const value = parseStrictJson(raw);
  if (!isRecord(value) || !exactKeys(value, ['operationId', 'snapshotHash', 'locale', 'units'])
    || value.operationId !== manifest.operationId || value.snapshotHash !== manifest.sourceSnapshotHash
    || value.locale !== manifest.targetLocale || !Array.isArray(value.units)
    || value.units.length !== manifest.selectedEntries.length + 1) return null;
  const units = value.units.map((unit) => {
    if (!isRecord(unit) || !exactKeys(unit, ['slot', 'entryId', 'factIds', 'text'])
      || (unit.slot !== 'duration' && unit.slot !== 'experience') || !Array.isArray(unit.factIds)
      || unit.factIds.some((id) => typeof id !== 'string') || typeof unit.text !== 'string'
      || !safeUnitText(unit.text)) return null;
    return { slot: unit.slot, entryId: unit.entryId, factIds: unit.factIds, text: unit.text } as SummaryV3WriterUnit;
  });
  if (units.some((unit) => unit === null)) return null;
  const typed = units as SummaryV3WriterUnit[];
  if (typed[0]?.slot !== 'duration' || typed.slice(1).some((unit) => unit.slot !== 'experience')) return null;
  const duration = typed.filter((unit) => unit.slot === 'duration');
  const experiences = typed.filter((unit) => unit.slot === 'experience');
  if (duration.length !== 1 || duration[0].entryId !== null || duration[0].factIds.length !== 0
    || experiences.length !== manifest.selectedEntries.length) return null;
  for (let index = 0; index < experiences.length; index += 1) {
    const expected = manifest.selectedEntries[index];
    const actual = experiences[index];
    const expectedFactIds = expected.facts.map((fact) => fact.factId);
    if (actual.entryId !== expected.entryId || actual.factIds.length !== expectedFactIds.length
      || actual.factIds.some((id, factIndex) => id !== expectedFactIds[factIndex])) return null;
  }
  const all = experiences.flatMap((unit) => unit.factIds);
  if (new Set(all).size !== all.length) return null;
  return immutableCopy({ operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash,
    locale: manifest.targetLocale, units: typed }) as SummaryV3WriterOutput;
}

function candidateFromOutput(manifest: SummaryV3Manifest, output: SummaryV3WriterOutput): AiCoreV3CandidateEnvelope {
  const text = output.units.map((unit) => unit.text).join(' ');
  return createCandidateEnvelope({
    operationId: manifest.operationId,
    candidateId: hashSummaryV3Value(`${manifest.operationId}:${manifest.sourceSnapshotHash}:${text}`),
    operationKind: 'summary_generate',
    targetLocale: manifest.targetLocale,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    text,
    units: output.units.map((unit, index) => ({
      unitId: unit.slot === 'duration' ? 'summary:duration' : `summary:${unit.entryId}:${index}`,
      ...(unit.entryId ? { entryId: unit.entryId } : {}),
      factIds: unit.factIds,
      text: unit.text,
    })),
  });
}

function structuralPhase(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope,
  output: SummaryV3WriterOutput): ValidationPhaseResult {
  const base = validateStructuralPhase({ manifest, candidate });
  const violations = [...base.violations];
  if (candidate.text !== output.units.map((unit) => unit.text).join(' ')) {
    violations.push({ code: 'writer_text_mutated', category: 'structural', detail: 'Candidate must be the byte-exact deterministic unit join' });
  }
  return immutableCopy({ category: 'structural' as const,
    status: violations.length ? 'failed' as const : 'passed' as const, violations }) as ValidationPhaseResult;
}

function parseViolation(value: unknown, category: EvaluatedCategory): AiCoreV3Violation | null {
  if (!isRecord(value) || !exactKeys(value, ['code', 'category', 'detail'], ['factIds', 'entryIds'])
    || value.category !== category || typeof value.code !== 'string' || !value.code.trim()
    || typeof value.detail !== 'string' || !value.detail.trim()
    || (value.factIds !== undefined && (!Array.isArray(value.factIds) || value.factIds.some((id) => typeof id !== 'string')))
    || (value.entryIds !== undefined && (!Array.isArray(value.entryIds) || value.entryIds.some((id) => typeof id !== 'string')))) return null;
  return immutableCopy({ code: value.code, category, detail: value.detail,
    ...(value.factIds !== undefined ? { factIds: value.factIds as string[] } : {}),
    ...(value.entryIds !== undefined ? { entryIds: value.entryIds as string[] } : {}) }) as AiCoreV3Violation;
}

export function parseSummaryV3EvaluatorOutput(raw: string, manifest: SummaryV3Manifest): EvaluatorPayload | null {
  const value = parseStrictJson(raw);
  if (!isRecord(value) || !exactKeys(value, ['operationId', 'snapshotHash', 'locale', 'phases', 'checks'])
    || value.operationId !== manifest.operationId || value.snapshotHash !== manifest.sourceSnapshotHash
    || value.locale !== manifest.targetLocale || !isRecord(value.phases) || !isRecord(value.checks)
    || !exactKeys(value.phases, ['semantic', 'language_quality'])) return null;
  const checks = value.checks;
  if (!exactKeys(checks, SUMMARY_EVALUATOR_CHECKS)
    || SUMMARY_EVALUATOR_CHECKS.some((check) => typeof checks[check] !== 'boolean')) return null;
  const parsePhase = (input: unknown, category: EvaluatedCategory) => {
    if (!isRecord(input) || !exactKeys(input, ['status', 'violations']) || !Array.isArray(input.violations)
      || (input.status !== 'passed' && input.status !== 'failed')) return null;
    const violations = input.violations.map((item) => parseViolation(item, category));
    if (violations.some((item) => item === null) || (input.status === 'passed' ? violations.length !== 0 : violations.length === 0)) return null;
    return { status: input.status, violations: violations as AiCoreV3Violation[] };
  };
  const semantic = parsePhase(value.phases.semantic, 'semantic');
  const languageQuality = parsePhase(value.phases.language_quality, 'language_quality');
  if (!semantic || !languageQuality) return null;
  const phasesPassed = semantic.status === 'passed' && languageQuality.status === 'passed';
  const checksPassed = SUMMARY_EVALUATOR_CHECKS.every((check) => checks[check] === true);
  if (phasesPassed !== checksPassed) return null;
  return immutableCopy({ operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash,
    locale: manifest.targetLocale, phases: { semantic, language_quality: languageQuality },
    checks }) as unknown as EvaluatorPayload;
}

function aggregate(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope,
  structural: ValidationPhaseResult, evaluator: EvaluatorPayload): AggregateValidationResult {
  return runAiCoreV3Validation({ manifest, candidate }, {
    structural: () => structural,
    semantic: () => ({ category: 'semantic', ...evaluator.phases.semantic }),
    languageQuality: () => ({ category: 'language_quality', ...evaluator.phases.language_quality }),
  });
}

export function buildSummaryV3WriterPrompt(manifest: SummaryV3Manifest): string {
  return [
    'Write one grounded professional first-person CV Summary in the requested locale and script.',
    'Return strict JSON only with exactly operationId, snapshotHash, locale, and units.',
    'Return exactly one duration unit followed by one experience unit per selected entry in manifest order.',
    'Each unit has exactly slot, entryId, factIds, and text. Preserve owning entry and every factId exactly once.',
    'Use exactly one total-career duration representation. Keep current and prior roles separate and use correct current/past state.',
    'Do not invent facts, metrics, achievements, tools, certifications, leadership, education, skills, languages, employers, roles, or dates.',
    'No headings, bullets, markdown, commentary, diagnostics, authority fields, or mutation instructions.',
    JSON.stringify(manifest),
  ].join('\n');
}

export function buildSummaryV3EvaluatorPrompt(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope): string {
  return [
    'Act only as an independent non-writing evaluator. Never rewrite, repair, suggest prose, or return authority.',
    'Evaluate entry/fact retention and ownership, current/prior separation, role/employer/state accuracy, unsupported claims, and duration meaning/scope.',
    'Evaluate target language/script, first-person perspective, current/past tense, grammar, clarity, duplication, degradation, and complete usability.',
    'Return strict JSON only with operationId, snapshotHash, locale, phases, and checks.',
    'phases has exactly semantic and language_quality. Each has status passed or failed and violations only.',
    `checks has exactly these boolean evidence fields: ${SUMMARY_EVALUATOR_CHECKS.join(', ')}. All must be true only when both phases pass.`,
    'Do not return candidate text, units, replacement prose, apply, persistence, usage, or acceptance authority.',
    JSON.stringify({ manifest, candidate }),
  ].join('\n');
}

export function buildSummaryV3RepairPrompt(manifest: SummaryV3Manifest, candidate: AiCoreV3CandidateEnvelope,
  violations: readonly AiCoreV3Violation[]): string {
  return [
    'Repair the candidate once using only the unchanged manifest and finite violations. Add no facts.',
    'Return the identical strict writer schema and identities. No commentary, diagnostics, authority, or fallback prose.',
    JSON.stringify({ operationId: manifest.operationId, snapshotHash: manifest.sourceSnapshotHash,
      locale: manifest.targetLocale, manifest, candidate, violations }),
  ].join('\n');
}

async function evaluateCandidate(manifest: SummaryV3Manifest, output: SummaryV3WriterOutput,
  transports: SummaryV3GenerateTransportSet): Promise<{ candidate: AiCoreV3CandidateEnvelope; validation: AggregateValidationResult } | string> {
  const candidate = candidateFromOutput(manifest, output);
  const structural = structuralPhase(manifest, candidate, output);
  if (structural.status !== 'passed') return 'structural_validation_failed';
  let raw: string;
  try {
    raw = await transports.evaluate(buildSummaryV3EvaluatorPrompt(manifest, candidate));
  } catch {
    return 'validator_exception';
  }
  const evaluator = parseSummaryV3EvaluatorOutput(raw, manifest);
  if (!evaluator) return 'evaluator_output_malformed';
  return { candidate, validation: aggregate(manifest, candidate, structural, evaluator) };
}

export async function executeSummaryV3GenerateServer(
  rawRequest: unknown,
  transports: SummaryV3GenerateTransportSet,
): Promise<SummaryV3GenerateResponse> {
  const manifest = parseSummaryV3GenerateRequest(rawRequest);
  if (!manifest) return failure('invalid_request_contract', undefined, false);
  let primaryRaw: string;
  try {
    primaryRaw = await transports.write(buildSummaryV3WriterPrompt(manifest));
  } catch {
    return failure('provider_request_failed', undefined, false);
  }
  const primaryOutput = parseSummaryV3WriterOutput(primaryRaw, manifest);
  if (!primaryOutput) return failure('provider_output_malformed', undefined, false);
  const primary = await evaluateCandidate(manifest, primaryOutput, transports);
  if (typeof primary === 'string') return failure(primary, undefined, false);
  if (primary.validation.decision === 'accept') {
    return immutableCopy({ ok: true as const, action: SUMMARY_V3_GENERATE_ACTION,
      providerOutput: primaryOutput, candidate: primary.candidate, validation: primary.validation,
      repairAttempted: false }) as SummaryV3GenerateResponse;
  }
  const violations = primary.validation.violations;
  if (violations.length === 0) return failure('validation_rejected', primary.validation, false, primary.candidate);
  let repairRaw: string;
  try {
    repairRaw = await transports.write(buildSummaryV3RepairPrompt(manifest, primary.candidate, violations));
  } catch {
    return failure('repair_provider_failed', primary.validation, true, primary.candidate);
  }
  const repairOutput = parseSummaryV3WriterOutput(repairRaw, manifest);
  if (!repairOutput) return failure('repair_output_malformed', primary.validation, true, primary.candidate);
  const repair = await evaluateCandidate(manifest, repairOutput, transports);
  if (typeof repair === 'string') return failure(`repair_${repair}`, primary.validation, true, primary.candidate);
  if (repair.validation.decision !== 'accept') return failure('repair_validation_rejected', repair.validation, true, repair.candidate);
  return immutableCopy({ ok: true as const, action: SUMMARY_V3_GENERATE_ACTION,
    providerOutput: repairOutput, candidate: repair.candidate, validation: repair.validation,
    repairAttempted: true }) as SummaryV3GenerateResponse;
}
