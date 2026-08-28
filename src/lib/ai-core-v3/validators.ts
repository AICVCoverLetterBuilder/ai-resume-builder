import type {
  AiCoreV3CandidateEnvelope,
  AiCoreV3Manifest,
  ExperienceFact,
  ExperienceFactManifest,
  SummaryFactManifest,
} from './contracts';
import { immutableCopy } from './immutability';

export type ViolationCategory = 'structural' | 'semantic' | 'language_quality';
export type ValidationPhaseStatus = 'passed' | 'failed' | 'not_evaluated';
export type AggregateValidationDecision = 'accept' | 'reject' | 'not_ready';

export interface AiCoreV3Violation {
  readonly code: string;
  readonly category: ViolationCategory;
  readonly factIds?: readonly string[];
  readonly entryIds?: readonly string[];
  readonly detail: string;
}

export interface ValidationPhaseResult {
  readonly category: ViolationCategory;
  readonly status: ValidationPhaseStatus;
  readonly violations: readonly AiCoreV3Violation[];
}

export interface ValidationContext {
  readonly manifest: AiCoreV3Manifest;
  readonly candidate: AiCoreV3CandidateEnvelope;
}

export type AiCoreV3Validator = (
  context: ValidationContext,
) => ValidationPhaseResult | null | undefined;

export interface ValidatorSet {
  readonly structural?: AiCoreV3Validator;
  readonly semantic?: AiCoreV3Validator;
  readonly languageQuality?: AiCoreV3Validator;
}

export interface AggregateValidationResult {
  readonly decision: AggregateValidationDecision;
  readonly phases: Readonly<Record<ViolationCategory, ValidationPhaseResult>>;
  readonly violations: readonly AiCoreV3Violation[];
}

function violation(
  code: string,
  category: ViolationCategory,
  detail: string,
  identities: Pick<AiCoreV3Violation, 'factIds' | 'entryIds'> = {},
): AiCoreV3Violation {
  return { code, category, detail, ...identities };
}

function targetLocale(manifest: AiCoreV3Manifest): string {
  return 'mode' in manifest ? manifest.locale : manifest.targetLocale;
}

function snapshotHash(manifest: AiCoreV3Manifest): string {
  return 'mode' in manifest ? manifest.snapshotHash : manifest.sourceSnapshotHash;
}

function inspectFacts(
  facts: readonly ExperienceFact[],
  categoryViolations: AiCoreV3Violation[],
  seenFactIds: Set<string>,
  entryId: string,
): void {
  if (!Array.isArray(facts)) {
    categoryViolations.push(violation('invalid_manifest_shape', 'structural', 'facts must be an array', { entryIds: [entryId] }));
    return;
  }
  for (const fact of facts) {
    if (!fact || typeof fact.factId !== 'string' || fact.factId.trim().length === 0) {
      categoryViolations.push(violation('missing_fact_id', 'structural', 'Every fact requires a stable factId', { entryIds: [entryId] }));
      continue;
    }
    if (seenFactIds.has(fact.factId)) {
      categoryViolations.push(violation('duplicate_fact_id', 'structural', `Duplicate factId: ${fact.factId}`, {
        factIds: [fact.factId],
        entryIds: [entryId],
      }));
    }
    seenFactIds.add(fact.factId);
  }
}

function inspectEmploymentShape(
  employmentState: unknown,
  dates: unknown,
  categoryViolations: AiCoreV3Violation[],
  entryId: string,
): void {
  if (employmentState !== 'present' && employmentState !== 'completed') {
    categoryViolations.push(violation('invalid_employment_state', 'structural', 'Employment state must be present or completed', {
      entryIds: entryId ? [entryId] : undefined,
    }));
    return;
  }
  if (!dates || typeof dates !== 'object' || !('start' in dates)) {
    categoryViolations.push(violation('invalid_dates', 'structural', 'Structured employment dates are required', {
      entryIds: entryId ? [entryId] : undefined,
    }));
    return;
  }
  const structured = dates as { start?: { year?: unknown }; end?: { year?: unknown } | null };
  if (!structured.start || !Number.isInteger(structured.start.year)
    || (employmentState === 'present' && structured.end !== null)
    || (employmentState === 'completed'
      && (!structured.end || !Number.isInteger(structured.end.year)))) {
    categoryViolations.push(violation('invalid_dates', 'structural', 'Employment state and structured dates disagree', {
      entryIds: entryId ? [entryId] : undefined,
    }));
  }
}

function inspectExperienceManifest(
  manifest: ExperienceFactManifest,
  categoryViolations: AiCoreV3Violation[],
): void {
  if (typeof manifest.entryId !== 'string' || manifest.entryId.trim().length === 0) {
    categoryViolations.push(violation('missing_entry_id', 'structural', 'Experience operations require a stable entryId'));
  }
  const expectedKind = manifest.mode === 'generate' ? 'experience_generate' : 'experience_enhance';
  if (manifest.operationKind !== expectedKind) {
    categoryViolations.push(violation('invalid_manifest_shape', 'structural', 'Experience mode and operation kind disagree'));
  }
  if (typeof manifest.exactSourceText !== 'string') {
    categoryViolations.push(violation('invalid_manifest_shape', 'structural', 'exactSourceText must be a string', {
      entryIds: manifest.entryId ? [manifest.entryId] : undefined,
    }));
  } else if (manifest.mode === 'enhance' && manifest.exactSourceText.trim().length === 0) {
    categoryViolations.push(violation('empty_enhance_source', 'structural', 'Enhance requires authoritative source text', {
      entryIds: manifest.entryId ? [manifest.entryId] : undefined,
    }));
  }
  inspectEmploymentShape(manifest.employmentState, manifest.dates, categoryViolations, manifest.entryId);
  inspectFacts(manifest.facts, categoryViolations, new Set<string>(), manifest.entryId);
}

function inspectSummaryManifest(
  manifest: SummaryFactManifest,
  categoryViolations: AiCoreV3Violation[],
): void {
  if (!Number.isFinite(manifest.structuredTotalDurationMonths)
    || !Number.isInteger(manifest.structuredTotalDurationMonths)
    || manifest.structuredTotalDurationMonths < 0) {
    categoryViolations.push(violation('invalid_duration', 'structural', 'Duration must be a finite non-negative integer'));
  }
  if (!Array.isArray(manifest.selectedEntries)) {
    categoryViolations.push(violation('invalid_manifest_shape', 'structural', 'selectedEntries must be an array'));
    return;
  }
  const entryIds = new Set<string>();
  const factIds = new Set<string>();
  for (const entry of manifest.selectedEntries) {
    if (!entry || typeof entry.entryId !== 'string' || entry.entryId.trim().length === 0) {
      categoryViolations.push(violation('missing_entry_id', 'structural', 'Every selected entry requires a stable entryId'));
      continue;
    }
    if (entryIds.has(entry.entryId)) {
      categoryViolations.push(violation('duplicate_entry_id', 'structural', `Duplicate entryId: ${entry.entryId}`, {
        entryIds: [entry.entryId],
      }));
    }
    entryIds.add(entry.entryId);
    inspectEmploymentShape(entry.employmentState, entry.dates, categoryViolations, entry.entryId);
    inspectFacts(entry.facts, categoryViolations, factIds, entry.entryId);
  }
  if (manifest.currentRoleEntryId !== null && !entryIds.has(manifest.currentRoleEntryId)) {
    categoryViolations.push(violation('invalid_current_role_reference', 'structural', 'currentRoleEntryId does not reference a selected entry', {
      entryIds: [manifest.currentRoleEntryId],
    }));
  }
}

export function validateStructuralPhase(context: ValidationContext): ValidationPhaseResult {
  const { manifest, candidate } = context;
  const violations: AiCoreV3Violation[] = [];
  if (manifest.operationId !== candidate.operationId) {
    violations.push(violation('operation_id_mismatch', 'structural', 'Candidate operationId does not match the manifest'));
  }
  if (snapshotHash(manifest) !== candidate.sourceSnapshotHash) {
    violations.push(violation('snapshot_hash_mismatch', 'structural', 'Candidate sourceSnapshotHash does not match the manifest'));
  }
  if (manifest.operationKind !== candidate.operationKind) {
    violations.push(violation('operation_kind_mismatch', 'structural', 'Candidate operation kind does not match the manifest'));
  }
  if (targetLocale(manifest) !== candidate.targetLocale) {
    violations.push(violation('target_locale_mismatch', 'structural', 'Candidate target locale does not match the manifest'));
  }
  if (typeof candidate.text !== 'string' || candidate.text.trim().length === 0) {
    violations.push(violation('empty_candidate_text', 'structural', 'Candidate text must be non-empty'));
  }
  if ('mode' in manifest) {
    inspectExperienceManifest(manifest, violations);
  } else {
    inspectSummaryManifest(manifest, violations);
  }
  return immutableCopy({
    category: 'structural' as const,
    status: violations.length === 0 ? 'passed' as const : 'failed' as const,
    violations,
  }) as ValidationPhaseResult;
}

function notEvaluated(category: ViolationCategory): ValidationPhaseResult {
  return Object.freeze({ category, status: 'not_evaluated', violations: Object.freeze([]) });
}

function failedInternal(category: ViolationCategory, code: string, detail: string): ValidationPhaseResult {
  return immutableCopy({
    category,
    status: 'failed' as const,
    violations: [violation(code, category, detail)],
  }) as ValidationPhaseResult;
}

function evaluate(
  category: ViolationCategory,
  validator: AiCoreV3Validator | undefined,
  context: ValidationContext,
): ValidationPhaseResult {
  if (!validator) {
    return notEvaluated(category);
  }
  try {
    const result = validator(context);
    if (result === null || result === undefined || result.status === 'not_evaluated') {
      return notEvaluated(category);
    }
    if (result.status !== 'passed' && result.status !== 'failed') {
      return failedInternal(category, 'invalid_validator_result', 'Validator returned an invalid phase status');
    }
    const copiedViolations = Array.isArray(result.violations)
      ? result.violations.map((item) => ({
        code: item.code,
        category,
        detail: item.detail,
        ...(item.factIds ? { factIds: [...item.factIds] } : {}),
        ...(item.entryIds ? { entryIds: [...item.entryIds] } : {}),
      }))
      : [];
    if (result.status === 'passed' && copiedViolations.length > 0) {
      return failedInternal(category, 'invalid_validator_result', 'A passed validator returned violations');
    }
    if (result.status === 'failed' && copiedViolations.length === 0) {
      return failedInternal(category, 'validator_reported_failure', 'Validator failed without a violation');
    }
    return immutableCopy({ category, status: result.status, violations: copiedViolations }) as ValidationPhaseResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown validator exception';
    return failedInternal(category, 'validator_exception', `Validator threw: ${message}`);
  }
}

export function runAiCoreV3Validation(
  context: ValidationContext,
  validators: ValidatorSet = {},
): AggregateValidationResult {
  const structural = evaluate('structural', validators.structural ?? validateStructuralPhase, context);
  const semantic = evaluate('semantic', validators.semantic, context);
  const languageQuality = evaluate('language_quality', validators.languageQuality, context);
  const phases = { structural, semantic, language_quality: languageQuality };
  const phaseList = [structural, semantic, languageQuality];
  const decision: AggregateValidationDecision = phaseList.some((phase) => phase.status === 'failed')
    ? 'reject'
    : phaseList.every((phase) => phase.status === 'passed')
      ? 'accept'
      : 'not_ready';
  return immutableCopy({
    decision,
    phases,
    violations: phaseList.flatMap((phase) => [...phase.violations]),
  }) as AggregateValidationResult;
}
