import type { CVData, WorkExperience } from '@/lib/types';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import { hashSummarySourceLocaleText } from '@/lib/cv-summary-source-locale';
import { isProjectionFresh } from '@/lib/cv-canonical-snapshot';
import { CV_EXPORT_TITLE_LOCALIZATION_REVISION } from '@/lib/cv-export-title-localization';
import { resolveLocaleCandidate } from '@/lib/i18n/translations';
import {
  canonicalSummaryV3StyleLocale,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  SUMMARY_V3_STYLE_M5_EVALUATOR_OUTPUT_CONTRACT_FAILURE_CLASSES,
  SUMMARY_V3_STYLE_M5_WRITER_OUTPUT_CONTRACT_FAILURE_CLASSES,
  SUMMARY_V3_STYLE_M5_SOURCE_FLOOR_MISMATCH_CLASSES,
  SUMMARY_V3_STYLE_M5_EMPLOYMENT_STATE_CONTRADICTION_CLASSES,
  type SummaryV3Style,
  type SummaryV3StyleRequest,
  type SummaryV3StyleRoleIdentityResolution,
  type SummaryV3StyleSafeNoOpEligibilityReason,
  type SummaryV3StyleSupportedLocale,
  type SummaryV3StyleUnsupportedClaimCategory,
  type SummaryV3StyleSourceFloorMismatchClass,
  type SummaryV3StyleEmploymentStateContradictionClass,
  type SummaryV3StyleEvaluatorOutputContractFailureClass,
  type SummaryV3StyleWriterOutputContractFailureClass,
  type SummaryV3StyleRolePresentationEvidence,
} from './summary-style-m5';
import {
  hashSummaryV3Value,
  parseSummaryV3ProviderFailureEnvelope,
  type SummaryV3CommitReceipt,
  type SummaryV3CommitRequest,
} from './summary-generate';
import {
  classifySummaryV3StyleM5TransportResponse,
  type SummaryV3StyleM5BoundedEvidence,
} from './summary-style-m5-transport';

export const SUMMARY_V3_STYLE_M5_ACTION: Readonly<Record<SummaryV3Style, string>> = {
  shorter: 'summary_shorter', stronger: 'summary_stronger', professional: 'summary_professional',
};

export interface SummaryV3StyleClientInput {
  readonly enabled: boolean;
  readonly style: SummaryV3Style;
  readonly operationId: string;
  readonly requestId: string;
  readonly cv: CVData;
  readonly currentRoleExperienceId: string | null;
  readonly requestedLocale: string;
  readonly sourceLocale: string;
  readonly jobContextKey: string;
  readonly referenceDateIso: string;
  readonly usageCountBefore: number;
  readonly proToken: string;
  readonly createdAt: number;
}

export interface SummaryV3StyleClientDependencies {
  readonly request: (body: Record<string, unknown>) => Promise<{ data: unknown; status: number }>;
  readonly getLiveCv: () => CVData;
  readonly getActiveOperationId: () => string;
  readonly commitCandidate: (request: SummaryV3CommitRequest) => SummaryV3CommitReceipt;
}

export type SummaryV3StyleClientOutcome =
  | Readonly<{ kind: 'committed'; status: number; receipt: Extract<SummaryV3CommitReceipt, { kind: 'committed' }>; evidence: SummaryV3StyleClientEvidence }>
  | Readonly<{ kind: 'safe_no_op'; status: number; reason: string; evidence: SummaryV3StyleClientEvidence }>
  | Readonly<{ kind: 'terminal'; status: number; reason: string; evidence?: SummaryV3StyleClientEvidence }>;

export type SummaryV3StyleClientEvidence = SummaryV3StyleM5BoundedEvidence;

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function structuredCandidateIdentity(candidate: Record<string, unknown>): { text: string; hash: string } | null {
  const units = candidate.units;
  if (!Array.isArray(units) || units.length < 1) return null;
  const seenUnitIds = new Set<string>();
  const validUnits = units.every((unit) => {
    if (!isPlainRecord(unit) || !nonBlank(unit.unitId) || !nonBlank(unit.text) || !Array.isArray(unit.factIds)
      || !unit.factIds.every((factId) => typeof factId === 'string') || seenUnitIds.has(unit.unitId)) return false;
    seenUnitIds.add(unit.unitId);
    return true;
  });
  if (!validUnits) return null;
  const text = units.map((unit) => (unit as Record<string, unknown>).text as string).join(' ').trim();
  const hash = hashSummaryV3StyleValue(JSON.stringify(units.map((unit) => {
    const record = unit as Record<string, unknown>;
    return [record.unitId, record.text, record.factIds];
  })));
  return { text, hash };
}

function sourceFacts(entry: WorkExperience): readonly string[] {
  return String(entry.description || '').split(/\r?\n/u).map((value) => value.trim()).filter(Boolean);
}

function exactSurface(haystack: string, needle: string): boolean {
  return haystack.normalize('NFKC').toLocaleLowerCase().includes(needle.normalize('NFKC').toLocaleLowerCase());
}

function surfaceOccurrences(haystack: string, needle: string): number {
  const source = haystack.normalize('NFKC').toLocaleLowerCase();
  const target = needle.normalize('NFKC').toLocaleLowerCase();
  if (!target) return 0;
  let count = 0;
  let offset = 0;
  while (offset >= 0) {
    const found = source.indexOf(target, offset);
    if (found < 0) break;
    count += 1;
    offset = found + target.length;
  }
  return count;
}

function firstPredicateAnchor(value: string): string | null {
  const token = value.match(/^[^\p{N}\p{P}\s]+/u)?.[0] || null;
  return token && !/^\p{N}+$/u.test(token) ? token : null;
}

function entryRoleSourceLocale(input: SummaryV3StyleClientInput, entry: WorkExperience): string | null {
  const canonicalEntry = input.cv.canonicalSnapshot?.canonicalExperiences.find((item) => item.experienceId === entry.id);
  return resolveLocaleCandidate(
    entry.positionSourceLocale
      || entry.descriptionSourceLocale
      || canonicalEntry?.sourceLocale
      || input.cv.canonicalSnapshot?.canonicalLocale
      || input.cv.contentLocale,
  );
}

/**
 * Reuse only a source-bound, independently validated target role surface.
 * A stale projection or title surface is ignored, leaving role equivalence
 * unresolved for the existing bounded evaluator rather than guessed here.
 */
function entryRolePresentation(
  input: SummaryV3StyleClientInput,
  entry: WorkExperience,
  targetLocale: SummaryV3StyleSupportedLocale,
): SummaryV3StyleRolePresentationEvidence | undefined {
  const sourceLocale = entryRoleSourceLocale(input, entry);
  if (!sourceLocale || sourceLocale === targetLocale) return undefined;
  const sourceRoleHash = hashSummaryV3StyleValue(entry.position);
  const projection = input.cv.localizedProjections?.[targetLocale];
  if (projection && isProjectionFresh(projection, input.cv.canonicalSnapshot)) {
    const projected = projection.localizedExperiences.find((item) => item.experienceId === entry.id);
    if (projected?.role?.trim() && projected.company.trim() === entry.company.trim()
      && projected.role.trim().toLocaleLowerCase() !== entry.position.trim().toLocaleLowerCase()) {
      return {
        text: projected.role.trim(),
        sourceLocale,
        targetLocale,
        sourceRoleHash,
        provenance: 'validated_localized_projection',
      };
    }
  }
  const surface = Object.values(input.cv.exportLocalizedTitleSurfaces?.surfaces || {}).find((candidate) => (
    candidate.revision === CV_EXPORT_TITLE_LOCALIZATION_REVISION
    && candidate.sourceTitle === entry.position
    && candidate.sourceLocale === sourceLocale
    && candidate.targetLocale === targetLocale
    && candidate.localizedTitle.trim()
    && candidate.localizedTitle.trim().toLocaleLowerCase() !== entry.position.trim().toLocaleLowerCase()
  ));
  if (surface) {
    return {
      text: surface.localizedTitle.trim(),
      sourceLocale,
      targetLocale,
      sourceRoleHash,
      provenance: 'validated_export_title_surface',
    };
  }
  return undefined;
}

function buildManifest(input: SummaryV3StyleClientInput, locale: SummaryV3StyleSupportedLocale): SummaryV3StyleRequest['manifest'] {
  const duration = buildExperienceDurationSnapshot(input.cv.experience, input.referenceDateIso);
  const entries = input.cv.experience
    .filter((entry) => sourceFacts(entry).length > 0)
    .map((entry) => ({
      stableId: `entry-${hashSummaryV3StyleValue(entry.id)}`,
      role: entry.position,
      employer: entry.company,
      roleSourceLocale: entryRoleSourceLocale(input, entry) || undefined,
      rolePresentation: entryRolePresentation(input, entry, locale),
      employmentState: entry.isPresent ? 'present' as const : 'completed' as const,
      durationMonths: duration.byExperienceId[entry.id]?.totalMonths || 0,
      facts: sourceFacts(entry).map((text, index) => ({ id: `fact-${hashSummaryV3StyleValue(`${entry.id}:${index}:${text}`)}`, text })),
    }));
  const roleId = input.currentRoleExperienceId;
  const currentRoleEntryId = roleId
    && entries.some((entry) => entry.stableId === `entry-${hashSummaryV3StyleValue(roleId)}`)
    ? `entry-${hashSummaryV3StyleValue(roleId)}`
    : null;
  const identity = hashSummaryV3StyleValue(JSON.stringify({ locale, entries, currentRoleEntryId }));
  return { manifestId: `manifest-${identity}`, contextId: `context-${hashSummaryV3StyleValue(input.jobContextKey)}`, sourceLocale: locale, currentRoleEntryId, entries };
}

function visibleFacts(input: SummaryV3StyleClientInput, manifest: SummaryV3StyleRequest['manifest']): SummaryV3StyleRequest['visibleSummaryFacts'] {
  if (input.cv.summary === '' || input.style !== 'stronger') return undefined;
  const candidates = manifest.entries.flatMap((entry) => entry.facts.map((fact) => fact.text))
    .filter((fact) => exactSurface(input.cv.summary, fact));
  const unique = [...new Set(candidates)];
  if (unique.length !== 1 || candidates.length !== 1 || surfaceOccurrences(input.cv.summary, unique[0]!) !== 1) return undefined;
  const predicateAnchor = firstPredicateAnchor(unique[0]!);
  if (!predicateAnchor) return undefined;
  return [{ id: `duty-${hashSummaryV3StyleValue(unique[0]!)}`, text: unique[0]!, semanticKind: 'duty', transformableDuty: { sourcePredicate: predicateAnchor, predicateAnchor } }];
}

function buildSummaryV3StyleRequest(
  input: SummaryV3StyleClientInput,
  requestedLocale: SummaryV3StyleSupportedLocale,
  sourceLocale: SummaryV3StyleSupportedLocale,
): SummaryV3StyleRequest {
  const manifest = buildManifest(input, requestedLocale);
  return {
    enabled: input.enabled,
    operation: SUMMARY_V3_STYLE_M5_ACTION[input.style],
    operationId: input.operationId,
    style: input.style,
    requestedLocale,
    sourceLocale,
    visibleSummary: input.cv.summary,
    visibleSummaryFacts: visibleFacts(input, manifest),
    protectedEntities: input.cv.personal.fullName && exactSurface(input.cv.summary, input.cv.personal.fullName) ? [input.cv.personal.fullName] : undefined,
    manifest,
    requestIdentity: input.requestId,
    createdAt: input.createdAt,
  };
}

/**
 * M5 owns a Summary transformation, not the complete mutable CV object.
 * Non-empty M5 requests are bound to their exact visible Summary source.
 * Empty M5 requests instead retain the canonical M5 manifest, which contains
 * the selected role, employment state, duration, and grounding facts.
 */
export function summaryV3StyleSourceStillCurrent(options: Readonly<{
  input: SummaryV3StyleClientInput;
  snapshot: ReturnType<typeof createSummaryV3StyleOperationSnapshot>;
  liveCv: CVData;
}>): boolean {
  const { input, snapshot, liveCv } = options;
  if (snapshot.mode === 'enhance_existing_content') {
    return liveCv.summary === snapshot.sourceSummary;
  }
  try {
    const current = createSummaryV3StyleOperationSnapshot(buildSummaryV3StyleRequest(
      { ...input, cv: liveCv },
      snapshot.requestedLocale,
      snapshot.sourceLocale,
    ));
    return current.mode === 'generate_from_context'
      && current.manifestHash === snapshot.manifestHash
      && current.contextHash === snapshot.contextHash;
  } catch {
    return false;
  }
}

function resultRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

const UNSUPPORTED_CLAIM_CATEGORIES = new Set<SummaryV3StyleUnsupportedClaimCategory>([
  'unsupported_metric',
  'unsupported_result_relation',
  'unsupported_achievement',
  'unsupported_authority',
  'source_floor_mismatch',
  'manifest_ceiling_mismatch',
  'other_typed_category',
]);

const SAFE_NO_OP_ELIGIBILITY_REASONS = new Set<SummaryV3StyleSafeNoOpEligibilityReason>([
  'eligible',
  'wrong_style',
  'wrong_mode',
  'source_empty',
  'source_locale_surface_mismatch',
  'source_locale_content_mismatch',
  'source_inconsistency',
  'role_employer_frame_inconsistency',
  'source_material_result_relation',
  'not_applicable',
]);
const SOURCE_FLOOR_MISMATCH_CLASSES = new Set<SummaryV3StyleSourceFloorMismatchClass>(
  SUMMARY_V3_STYLE_M5_SOURCE_FLOOR_MISMATCH_CLASSES,
);
const EMPLOYMENT_STATE_CONTRADICTION_CLASSES = new Set<SummaryV3StyleEmploymentStateContradictionClass>(
  SUMMARY_V3_STYLE_M5_EMPLOYMENT_STATE_CONTRADICTION_CLASSES,
);

const ROLE_IDENTITY_RESOLUTIONS = new Set<SummaryV3StyleRoleIdentityResolution>([
  'not_required', 'equivalent', 'contradiction', 'unresolved',
]);
const WRITER_OUTPUT_CONTRACT_FAILURE_CLASSES = new Set<SummaryV3StyleWriterOutputContractFailureClass>(
  SUMMARY_V3_STYLE_M5_WRITER_OUTPUT_CONTRACT_FAILURE_CLASSES,
);
const EVALUATOR_OUTPUT_CONTRACT_FAILURE_CLASSES = new Set<SummaryV3StyleEvaluatorOutputContractFailureClass>(
  SUMMARY_V3_STYLE_M5_EVALUATOR_OUTPUT_CONTRACT_FAILURE_CLASSES,
);

function readClientEvidence(value: unknown): SummaryV3StyleClientEvidence | null {
  const evidence = resultRecord(value);
  if (!evidence) return null;
  const hasSourceFloorMismatchClass = Object.prototype.hasOwnProperty.call(evidence, 'sourceFloorMismatchClass');
  const category = evidence.unsupportedClaimCategory;
  const sourceFloorMismatchClass = evidence.sourceFloorMismatchClass === null
    || evidence.sourceFloorMismatchClass === undefined
    ? null
    : evidence.sourceFloorMismatchClass;
  const employmentStateContradictionClass = evidence.employmentStateContradictionClass === null
    || evidence.employmentStateContradictionClass === undefined
    ? null
    : evidence.employmentStateContradictionClass;
  const writerOutputContractFailureClass = evidence.writerOutputContractFailureClass === null
    || evidence.writerOutputContractFailureClass === undefined
    ? null
    : evidence.writerOutputContractFailureClass;
  const evaluatorOutputContractFailureClass = evidence.evaluatorOutputContractFailureClass === null
    || evidence.evaluatorOutputContractFailureClass === undefined
    ? null
    : evidence.evaluatorOutputContractFailureClass;
  const m5ProviderFailure = evidence.m5ProviderFailure === null || evidence.m5ProviderFailure === undefined
    ? null
    : parseSummaryV3ProviderFailureEnvelope(evidence.m5ProviderFailure);
  if (evidence.m5ProviderFailure !== null && evidence.m5ProviderFailure !== undefined
    && m5ProviderFailure === null) return null;
  if (category !== null && (typeof category !== 'string'
    || !UNSUPPORTED_CLAIM_CATEGORIES.has(category as SummaryV3StyleUnsupportedClaimCategory))) return null;
  if (sourceFloorMismatchClass !== null && (typeof sourceFloorMismatchClass !== 'string'
    || !SOURCE_FLOOR_MISMATCH_CLASSES.has(sourceFloorMismatchClass as SummaryV3StyleSourceFloorMismatchClass))) return null;
  if (hasSourceFloorMismatchClass && category === 'source_floor_mismatch' && sourceFloorMismatchClass === null) return null;
  if (hasSourceFloorMismatchClass && category !== 'source_floor_mismatch' && sourceFloorMismatchClass !== null) return null;
  if (employmentStateContradictionClass !== null && (typeof employmentStateContradictionClass !== 'string'
    || !EMPLOYMENT_STATE_CONTRADICTION_CLASSES.has(
      employmentStateContradictionClass as SummaryV3StyleEmploymentStateContradictionClass,
    ))) return null;
  if (employmentStateContradictionClass !== null && sourceFloorMismatchClass !== 'employment_state_contradiction') return null;
  if (evidence.employmentOppositeFrameDetected !== undefined
    && typeof evidence.employmentOppositeFrameDetected !== 'boolean') return null;
  if (writerOutputContractFailureClass !== null && (typeof writerOutputContractFailureClass !== 'string'
    || !WRITER_OUTPUT_CONTRACT_FAILURE_CLASSES.has(
      writerOutputContractFailureClass as SummaryV3StyleWriterOutputContractFailureClass,
    ))) return null;
  if (evaluatorOutputContractFailureClass !== null && (typeof evaluatorOutputContractFailureClass !== 'string'
    || !EVALUATOR_OUTPUT_CONTRACT_FAILURE_CLASSES.has(
      evaluatorOutputContractFailureClass as SummaryV3StyleEvaluatorOutputContractFailureClass,
    ))) return null;
  if (typeof evidence.writerCandidateReachedValidation !== 'boolean'
    || typeof evidence.evaluatorReached !== 'boolean'
    || typeof evidence.safeNoOpConsidered !== 'boolean'
    || typeof evidence.safeNoOpSelected !== 'boolean'
    || (evidence.evaluatorNoOpClaimed !== undefined && typeof evidence.evaluatorNoOpClaimed !== 'boolean')
    || typeof evidence.safeNoOpEligibilityReason !== 'string'
    || !SAFE_NO_OP_ELIGIBILITY_REASONS.has(
      evidence.safeNoOpEligibilityReason as SummaryV3StyleSafeNoOpEligibilityReason,
    )
    || typeof evidence.roleIdentityResolution !== 'string'
    || !ROLE_IDENTITY_RESOLUTIONS.has(
      evidence.roleIdentityResolution as SummaryV3StyleRoleIdentityResolution,
    )) return null;
  return {
    unsupportedClaimCategory: category as SummaryV3StyleUnsupportedClaimCategory | null,
    sourceFloorMismatchClass: sourceFloorMismatchClass as SummaryV3StyleSourceFloorMismatchClass | null,
    employmentStateContradictionClass: employmentStateContradictionClass as SummaryV3StyleEmploymentStateContradictionClass | null,
    // Older bounded envelopes predate the shadow employment-frame bit.
    employmentOppositeFrameDetected: evidence.employmentOppositeFrameDetected === true,
    // Older bounded envelopes predate this additive diagnostic bit. Missing
    // is equivalent to false; only an explicit non-boolean is rejected.
    evaluatorNoOpClaimed: evidence.evaluatorNoOpClaimed === true,
    writerOutputContractFailureClass: writerOutputContractFailureClass as SummaryV3StyleWriterOutputContractFailureClass | null,
    evaluatorOutputContractFailureClass: evaluatorOutputContractFailureClass as SummaryV3StyleEvaluatorOutputContractFailureClass | null,
    writerCandidateReachedValidation: evidence.writerCandidateReachedValidation,
    evaluatorReached: evidence.evaluatorReached,
    safeNoOpConsidered: evidence.safeNoOpConsidered,
    safeNoOpSelected: evidence.safeNoOpSelected,
    safeNoOpEligibilityReason: evidence.safeNoOpEligibilityReason as SummaryV3StyleSafeNoOpEligibilityReason,
    roleIdentityResolution: evidence.roleIdentityResolution as SummaryV3StyleRoleIdentityResolution,
    m5ProviderFailure,
  };
}

export async function runSummaryV3StyleClientOperation(
  input: SummaryV3StyleClientInput,
  dependencies: SummaryV3StyleClientDependencies,
): Promise<SummaryV3StyleClientOutcome> {
  if (!input.enabled) return { kind: 'terminal', status: 404, reason: 'feature_disabled' };
  const requestedLocale = canonicalSummaryV3StyleLocale(input.requestedLocale);
  const sourceLocale = canonicalSummaryV3StyleLocale(input.sourceLocale);
  if (!requestedLocale || requestedLocale !== sourceLocale) return { kind: 'terminal', status: 422, reason: 'unsupported_or_cross_locale' };
  const request = buildSummaryV3StyleRequest(input, requestedLocale, sourceLocale);
  let snapshot;
  try {
    snapshot = createSummaryV3StyleOperationSnapshot(request);
  } catch (error) {
    return { kind: 'terminal', status: 422, reason: error instanceof Error ? error.message : 'malformed_request' };
  }
  let transport: { data: unknown; status: number };
  try {
    transport = await dependencies.request({ action: SUMMARY_V3_STYLE_M5_ACTION[input.style], proToken: input.proToken, requestId: input.requestId, ...request });
  } catch (error) {
    return {
      kind: 'terminal',
      status: error instanceof Error && error.name === 'AbortError' ? 499 : 502,
      // This boundary is the app-to-API transport, not the provider writer.
      // Do not fabricate provider ownership for a client network failure.
      reason: error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'network_error',
    };
  }
  if (dependencies.getActiveOperationId() !== input.operationId) return { kind: 'terminal', status: 409, reason: 'operation_superseded' };
  const transportResult = classifySummaryV3StyleM5TransportResponse(transport.data);
  if (transportResult.kind === 'unclassified') {
    return { kind: 'terminal', status: transport.status || 502, reason: 'unclassified_transport_response' };
  }
  if (transportResult.kind === 'route_failure') {
    const evidence = readClientEvidence(transportResult.evidence);
    return {
      kind: 'terminal',
      status: transport.status || 502,
      reason: transportResult.typedReason,
      ...(evidence ? { evidence } : {}),
    };
  }
  const result = transportResult.response;
  if (result.kind === 'safe_no_op') {
    if (transport.status !== 200) return { kind: 'terminal', status: transport.status || 502, reason: 'safe_no_op_non_200' };
    const evidence = result.evidence && typeof result.evidence === 'object' ? result.evidence as Record<string, unknown> : null;
    const clientEvidence = readClientEvidence(evidence);
    const expectedMode = input.cv.summary === '' ? 'generate_from_context' : 'enhance_existing_content';
    const validNoOp = result.style === input.style && result.mode === expectedMode
      && evidence && nonBlank(evidence.snapshotHash)
      && evidence.manifestHash === snapshot.manifestHash
      && evidence.noOpDetected === true && evidence.meaningfulChangeDetected === false
      && clientEvidence?.safeNoOpConsidered === true && clientEvidence.safeNoOpSelected === true
      && evidence.retries === 0 && evidence.fallbacks === 0 && evidence.v2Fallthrough === 0;
    return validNoOp && clientEvidence
      ? { kind: 'safe_no_op', status: 200, reason: 'safe_no_op', evidence: clientEvidence }
      : { kind: 'terminal', status: 422, reason: 'safe_no_op_invalid' };
  }
  if (result.kind === 'not_applicable' || result.kind === 'handled_failure') {
    const evidence = readClientEvidence(result.evidence);
    return {
      kind: 'terminal',
      status: transport.status,
      reason: typeof result.typedReason === 'string' ? result.typedReason : typeof result.reason === 'string' ? result.reason : result.kind,
      ...(evidence ? { evidence } : {}),
    };
  }
  if (result.kind !== 'candidate_ready') return { kind: 'terminal', status: transport.status || 502, reason: 'unclassified_transport_response' };
  if (transport.status !== 200) return { kind: 'terminal', status: transport.status || 502, reason: 'candidate_non_200' };
  const candidate = result.candidate && typeof result.candidate === 'object' ? result.candidate as Record<string, unknown> : null;
  const evidence = result.evidence && typeof result.evidence === 'object' ? result.evidence as Record<string, unknown> : null;
  const clientEvidence = readClientEvidence(evidence);
  const expectedMode = input.cv.summary === '' ? 'generate_from_context' : 'enhance_existing_content';
  const structuredIdentity = candidate ? structuredCandidateIdentity(candidate) : null;
  const valid = candidate && evidence && clientEvidence && result.style === input.style && result.mode === expectedMode
    && candidate.operationId === input.operationId && candidate.style === input.style
    && canonicalSummaryV3StyleLocale(candidate.locale) === requestedLocale && structuredIdentity
    && nonBlank(candidate.text) && candidate.text === structuredIdentity.text
    && nonBlank(candidate.snapshotHash) && nonBlank(candidate.manifestHash)
    && candidate.snapshotHash === evidence.snapshotHash && candidate.manifestHash === evidence.manifestHash
    && evidence.manifestHash === snapshot.manifestHash
    && nonBlank(candidate.hash)
    && candidate.hash === structuredIdentity.hash
    && nonBlank(evidence.candidateHash)
    && evidence.candidateHash === candidate.hash
    && clientEvidence.writerCandidateReachedValidation === true
    && clientEvidence.safeNoOpSelected === false
    && evidence.retries === 0 && evidence.fallbacks === 0 && evidence.v2Fallthrough === 0;
  if (!valid) return { kind: 'terminal', status: transport.status || 422, reason: 'candidate_identity_mismatch' };
  const before = dependencies.getLiveCv();
  if (!summaryV3StyleSourceStillCurrent({ input, snapshot, liveCv: before })) {
    return { kind: 'terminal', status: 409, reason: 'stale_snapshot' };
  }
  const next = {
    ...before,
    summary: candidate.text as string,
    summaryOrigin: 'ai_generated' as const,
    summaryGeneratedLocale: requestedLocale,
    summarySourceLocale: requestedLocale,
    summarySourceLocaleTextHash: hashSummarySourceLocaleText(candidate.text as string),
    summaryGenerationContextKey: input.jobContextKey,
    // M5 styles remain same-locale; preserve the document/default fallback so
    // a future mixed-locale Summary cannot relabel untouched Experience text.
    contentLocale: before.contentLocale,
  };
  let receipt: SummaryV3CommitReceipt;
  try {
    receipt = dependencies.commitCandidate({ operationId: input.operationId, requestId: input.requestId, previousCvHash: hashSummaryV3Value(before), candidateHash: hashSummaryV3Value(candidate.text as string), requestedLocale, usageCountBefore: input.usageCountBefore, previousCv: before, nextCv: next });
  } catch {
    return { kind: 'terminal', status: 500, reason: 'commit_operation_failed' };
  }
  if (receipt.kind !== 'committed') {
    return { kind: 'terminal', status: transport.status || 422, reason: receipt.reason };
  }
  if (!clientEvidence) {
    return { kind: 'terminal', status: transport.status || 422, reason: 'candidate_identity_mismatch' };
  }
  return { kind: 'committed', status: transport.status, receipt, evidence: clientEvidence };
}
