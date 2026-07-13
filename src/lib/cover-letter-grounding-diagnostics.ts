/**
 * Cover-letter grounding diagnostics (no letter body / no personal text).
 */
import type { CoverLetterFactSet } from './cover-letter-facts';
import type { CoverLetterGroundingStatus } from './cover-letter-flow';
import type { GroundingViolation } from './cover-letter-grounding';

export const COVER_LETTER_GROUNDING_BACKEND_REVISION = 'grounding-v1';

export type CoverLetterGroundingDiagnostics = {
  at: number;
  apiBaseUrl: string;
  apiPath: string;
  backendRevision: string | null;
  locale: string | null;
  requestId: string | null;
  contentLocale: string | null;
  requestFactCounts: Record<string, number>;
  leadershipEvidence: boolean;
  serverGroundingStatus: string | null;
  finalGroundingStatus: CoverLetterGroundingStatus;
  groundingValidatorStarted: boolean;
  groundingValidatorCompleted: boolean;
  violationKinds: string[];
  violationCount: number;
  repairAttempted: boolean;
  fallbackUsed: boolean;
  clientFallbackUsed: boolean;
  schemaMismatch: boolean;
};

let latest: CoverLetterGroundingDiagnostics | null = null;

const STORAGE_KEY = 'cl-grounding-diagnostics-v1';

function emptyCounts(): Record<string, number> {
  return {
    work_history: 0,
    skill: 0,
    tool: 0,
    programming_language: 0,
    education: 0,
    certification: 0,
    leadership: 0,
    years_experience: 0,
    numeric_achievement: 0,
    summary: 0,
    job_description_requirement: 0,
    identity: 0,
    target_position: 0,
    target_company: 0,
    responsibility: 0,
    achievement: 0,
    language_proficiency: 0,
  };
}

export function countFactsByCategory(factSet: CoverLetterFactSet): Record<string, number> {
  const counts = emptyCounts();
  for (const fact of factSet.facts) {
    counts[fact.type] = (counts[fact.type] ?? 0) + 1;
  }
  return counts;
}

export function beginCoverLetterGroundingDiagnostics(partial: Partial<CoverLetterGroundingDiagnostics>): void {
  latest = {
    at: Date.now(),
    apiBaseUrl: '',
    apiPath: '/api/generate',
    backendRevision: null,
    locale: null,
    requestId: null,
    contentLocale: null,
    requestFactCounts: emptyCounts(),
    leadershipEvidence: false,
    serverGroundingStatus: null,
    finalGroundingStatus: 'unknown',
    groundingValidatorStarted: false,
    groundingValidatorCompleted: false,
    violationKinds: [],
    violationCount: 0,
    repairAttempted: false,
    fallbackUsed: false,
    clientFallbackUsed: false,
    schemaMismatch: false,
    ...partial,
  };
  persist();
}

export function updateCoverLetterGroundingDiagnostics(
  patch: Partial<CoverLetterGroundingDiagnostics>,
): void {
  if (!latest) {
    beginCoverLetterGroundingDiagnostics(patch);
    return;
  }
  latest = { ...latest, ...patch };
  persist();
}

export function recordGroundingViolations(violations: GroundingViolation[]): void {
  const kinds = [...new Set(violations.map((v) => v.kind))];
  updateCoverLetterGroundingDiagnostics({
    groundingValidatorCompleted: true,
    violationKinds: kinds,
    violationCount: violations.length,
  });
}

function persist(): void {
  if (typeof window === 'undefined' || !latest) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latest));
  } catch {
    // ignore
  }
}

export function getCoverLetterGroundingDiagnostics(): CoverLetterGroundingDiagnostics | null {
  return latest ? { ...latest, requestFactCounts: { ...latest.requestFactCounts } } : null;
}

export function formatCoverLetterGroundingDiagnosticReport(): string {
  const d = getCoverLetterGroundingDiagnostics();
  if (!d) return 'Cover Letter Grounding Diagnostics\n(none)';
  return [
    'Cover Letter Grounding Diagnostics',
    `timestamp: ${new Date(d.at).toISOString()}`,
    `apiBaseUrl: ${d.apiBaseUrl || '(relative)'}`,
    `apiPath: ${d.apiPath}`,
    `backendRevision: ${d.backendRevision ?? 'n/a'}`,
    `locale: ${d.locale ?? 'n/a'}`,
    `requestId: ${d.requestId ?? 'n/a'}`,
    `contentLocale: ${d.contentLocale ?? 'n/a'}`,
    `requestFactCounts: ${JSON.stringify(d.requestFactCounts)}`,
    `leadershipEvidence: ${d.leadershipEvidence}`,
    `serverGroundingStatus: ${d.serverGroundingStatus ?? 'n/a'}`,
    `finalGroundingStatus: ${d.finalGroundingStatus}`,
    `groundingValidatorStarted: ${d.groundingValidatorStarted}`,
    `groundingValidatorCompleted: ${d.groundingValidatorCompleted}`,
    `violationCount: ${d.violationCount}`,
    `violationKinds: ${d.violationKinds.join(',') || 'none'}`,
    `repairAttempted: ${d.repairAttempted}`,
    `fallbackUsed: ${d.fallbackUsed}`,
    `clientFallbackUsed: ${d.clientFallbackUsed}`,
    `schemaMismatch: ${d.schemaMismatch}`,
  ].join('\n');
}

export async function copyCoverLetterGroundingDiagnosticsToClipboard(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return false;
  try {
    await navigator.clipboard.writeText(formatCoverLetterGroundingDiagnosticReport());
    return true;
  } catch {
    return false;
  }
}
