import type { CVData, WorkExperience } from '@/lib/types';
import { buildExperienceDurationSnapshot } from '@/lib/cv-experience-duration';
import {
  canonicalSummaryV3StyleLocale,
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  type SummaryV3Style,
  type SummaryV3StyleRequest,
  type SummaryV3StyleSupportedLocale,
} from './summary-style-m5';
import { hashSummaryV3Value, type SummaryV3CommitReceipt, type SummaryV3CommitRequest } from './summary-generate';

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
  | Readonly<{ kind: 'committed'; status: number; receipt: Extract<SummaryV3CommitReceipt, { kind: 'committed' }> }>
  | Readonly<{ kind: 'safe_no_op'; status: number; reason: string }>
  | Readonly<{ kind: 'terminal'; status: number; reason: string }>;

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

function buildManifest(input: SummaryV3StyleClientInput, locale: SummaryV3StyleSupportedLocale): SummaryV3StyleRequest['manifest'] {
  const duration = buildExperienceDurationSnapshot(input.cv.experience, input.referenceDateIso);
  const entries = input.cv.experience
    .filter((entry) => sourceFacts(entry).length > 0)
    .map((entry) => ({
      stableId: `entry-${hashSummaryV3StyleValue(entry.id)}`,
      role: entry.position,
      employer: entry.company,
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

function resultRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export async function runSummaryV3StyleClientOperation(
  input: SummaryV3StyleClientInput,
  dependencies: SummaryV3StyleClientDependencies,
): Promise<SummaryV3StyleClientOutcome> {
  if (!input.enabled) return { kind: 'terminal', status: 404, reason: 'feature_disabled' };
  const requestedLocale = canonicalSummaryV3StyleLocale(input.requestedLocale);
  const sourceLocale = canonicalSummaryV3StyleLocale(input.sourceLocale);
  if (!requestedLocale || requestedLocale !== sourceLocale) return { kind: 'terminal', status: 422, reason: 'unsupported_or_cross_locale' };
  const manifest = buildManifest(input, requestedLocale);
  const request: SummaryV3StyleRequest = {
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
    return { kind: 'terminal', status: error instanceof Error && error.name === 'AbortError' ? 499 : 502, reason: error instanceof Error && error.name === 'AbortError' ? 'aborted' : 'writer_request_failed' };
  }
  if (dependencies.getActiveOperationId() !== input.operationId) return { kind: 'terminal', status: 409, reason: 'operation_superseded' };
  const result = resultRecord(transport.data);
  if (!result || typeof result.kind !== 'string') return { kind: 'terminal', status: transport.status || 502, reason: 'writer_transport_malformed' };
  if (result.kind === 'safe_no_op') {
    if (transport.status !== 200) return { kind: 'terminal', status: transport.status || 502, reason: 'safe_no_op_non_200' };
    const evidence = result.evidence && typeof result.evidence === 'object' ? result.evidence as Record<string, unknown> : null;
    const expectedMode = input.cv.summary === '' ? 'generate_from_context' : 'enhance_existing_content';
    const validNoOp = result.style === input.style && result.mode === expectedMode
      && evidence && nonBlank(evidence.snapshotHash)
      && evidence.manifestHash === snapshot.manifestHash
      && evidence.noOpDetected === true && evidence.meaningfulChangeDetected === false
      && evidence.retries === 0 && evidence.fallbacks === 0 && evidence.v2Fallthrough === 0;
    return validNoOp ? { kind: 'safe_no_op', status: 200, reason: 'safe_no_op' } : { kind: 'terminal', status: 422, reason: 'safe_no_op_invalid' };
  }
  if (result.kind === 'not_applicable' || result.kind === 'handled_failure') {
    return { kind: 'terminal', status: transport.status, reason: typeof result.typedReason === 'string' ? result.typedReason : typeof result.reason === 'string' ? result.reason : result.kind };
  }
  if (result.kind !== 'candidate_ready') return { kind: 'terminal', status: transport.status || 502, reason: 'writer_transport_malformed' };
  if (transport.status !== 200) return { kind: 'terminal', status: transport.status || 502, reason: 'candidate_non_200' };
  const candidate = result.candidate && typeof result.candidate === 'object' ? result.candidate as Record<string, unknown> : null;
  const evidence = result.evidence && typeof result.evidence === 'object' ? result.evidence as Record<string, unknown> : null;
  const expectedMode = input.cv.summary === '' ? 'generate_from_context' : 'enhance_existing_content';
  const structuredIdentity = candidate ? structuredCandidateIdentity(candidate) : null;
  const valid = candidate && evidence && result.style === input.style && result.mode === expectedMode
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
    && evidence.retries === 0 && evidence.fallbacks === 0 && evidence.v2Fallthrough === 0;
  if (!valid) return { kind: 'terminal', status: transport.status || 422, reason: 'candidate_identity_mismatch' };
  const before = dependencies.getLiveCv();
  if (hashSummaryV3Value(before) !== hashSummaryV3Value(input.cv)) return { kind: 'terminal', status: 409, reason: 'stale_snapshot' };
  const next = { ...before, summary: candidate.text as string, summaryOrigin: 'ai_generated' as const, summaryGeneratedLocale: requestedLocale, summaryGenerationContextKey: input.jobContextKey, contentLocale: requestedLocale };
  let receipt: SummaryV3CommitReceipt;
  try {
    receipt = dependencies.commitCandidate({ operationId: input.operationId, requestId: input.requestId, previousCvHash: hashSummaryV3Value(before), candidateHash: hashSummaryV3Value(candidate.text as string), requestedLocale, usageCountBefore: input.usageCountBefore, previousCv: before, nextCv: next });
  } catch {
    return { kind: 'terminal', status: 500, reason: 'commit_operation_failed' };
  }
  return receipt.kind === 'committed' ? { kind: 'committed', status: transport.status, receipt } : { kind: 'terminal', status: transport.status || 422, reason: receipt.reason };
}
