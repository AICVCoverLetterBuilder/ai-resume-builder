import { AI_ERROR_CODES, type AiErrorCode } from '@/lib/ai-error-codes';
import type { SummaryV3ProviderFailureEnvelope } from './summary-generate';
import type {
  SummaryV3StyleRoleIdentityResolution,
  SummaryV3StyleSafeNoOpEligibilityReason,
  SummaryV3StyleUnsupportedClaimCategory,
  SummaryV3StyleWriterOutputContractFailureClass,
} from './summary-style-m5';
import { SUMMARY_V3_STYLE_M5_SERVER_RESULT_KINDS } from './summary-style-m5';

export { SUMMARY_V3_STYLE_M5_SERVER_RESULT_KINDS } from './summary-style-m5';

export const SUMMARY_V3_STYLE_M5_ROUTE_RESULT_KIND = 'route_failure' as const;

export const SUMMARY_V3_STYLE_M5_ROUTE_TYPED_REASONS = [
  'v3_feature_disabled',
] as const;

export type SummaryV3StyleM5ServerResultKind =
  (typeof SUMMARY_V3_STYLE_M5_SERVER_RESULT_KINDS)[number];
export type SummaryV3StyleM5RouteTypedReason =
  (typeof SUMMARY_V3_STYLE_M5_ROUTE_TYPED_REASONS)[number];
export type SummaryV3StyleM5RouteFailureReason = AiErrorCode | SummaryV3StyleM5RouteTypedReason;

export type SummaryV3StyleM5BoundedEvidence = Readonly<{
  unsupportedClaimCategory: SummaryV3StyleUnsupportedClaimCategory | null;
  writerOutputContractFailureClass: SummaryV3StyleWriterOutputContractFailureClass | null;
  writerCandidateReachedValidation: boolean;
  evaluatorReached: boolean;
  safeNoOpConsidered: boolean;
  safeNoOpSelected: boolean;
  safeNoOpEligibilityReason: SummaryV3StyleSafeNoOpEligibilityReason;
  roleIdentityResolution: SummaryV3StyleRoleIdentityResolution;
  m5ProviderFailure: SummaryV3ProviderFailureEnvelope | null;
}>;

export type SummaryV3StyleM5RouteFailure = Readonly<{
  kind: typeof SUMMARY_V3_STYLE_M5_ROUTE_RESULT_KIND;
  typedReason: SummaryV3StyleM5RouteFailureReason;
  evidence?: SummaryV3StyleM5BoundedEvidence;
}>;

export type SummaryV3StyleM5TransportClassification =
  | Readonly<{ kind: 'server_result'; response: Record<string, unknown> }>
  | Readonly<{
    kind: 'route_failure';
    typedReason: SummaryV3StyleM5RouteFailureReason;
    evidence?: unknown;
  }>
  | Readonly<{ kind: 'unclassified' }>;

const SERVER_RESULT_KIND_SET = new Set<string>(SUMMARY_V3_STYLE_M5_SERVER_RESULT_KINDS);
const ROUTE_FAILURE_REASON_SET = new Set<string>([
  ...AI_ERROR_CODES,
  ...SUMMARY_V3_STYLE_M5_ROUTE_TYPED_REASONS,
]);

function recordOf(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? value as Record<string, unknown>
    : null;
}

function routeFailureReason(value: unknown): SummaryV3StyleM5RouteFailureReason | null {
  return typeof value === 'string' && ROUTE_FAILURE_REASON_SET.has(value)
    ? value as SummaryV3StyleM5RouteFailureReason
    : null;
}

/**
 * The single finite M5 HTTP transport discriminator.
 *
 * `typedReason` without `kind` is accepted only for the one historic M5 route
 * gate emitted by AAB567's target. `code` without `kind` remains compatible
 * with the shared auth/rate-limit boundary, but only for the finite global AI
 * error-code set. Any explicit unknown kind fails closed as unclassified.
 */
export function classifySummaryV3StyleM5TransportResponse(
  value: unknown,
): SummaryV3StyleM5TransportClassification {
  const response = recordOf(value);
  if (!response) return { kind: 'unclassified' };
  const hasResponseKind = Object.prototype.hasOwnProperty.call(response, 'kind');
  if (hasResponseKind && typeof response.kind !== 'string') return { kind: 'unclassified' };
  const responseKind = typeof response.kind === 'string' ? response.kind : null;
  if (responseKind && SERVER_RESULT_KIND_SET.has(responseKind)) {
    return { kind: 'server_result', response };
  }
  if (responseKind !== null && responseKind !== SUMMARY_V3_STYLE_M5_ROUTE_RESULT_KIND) {
    return { kind: 'unclassified' };
  }
  const typedReason = routeFailureReason(response.typedReason);
  const legacyCode = responseKind === null ? routeFailureReason(response.code) : null;
  if (typedReason && legacyCode && typedReason !== legacyCode) return { kind: 'unclassified' };
  const reason = typedReason ?? legacyCode;
  if (!reason) return { kind: 'unclassified' };
  return {
    kind: 'route_failure',
    typedReason: reason,
    ...(recordOf(response.evidence) ? { evidence: response.evidence } : {}),
  };
}

export function createSummaryV3StyleM5RouteFailure(
  typedReason: SummaryV3StyleM5RouteFailureReason,
  evidence?: SummaryV3StyleM5BoundedEvidence,
): SummaryV3StyleM5RouteFailure {
  return {
    kind: SUMMARY_V3_STYLE_M5_ROUTE_RESULT_KIND,
    typedReason,
    ...(recordOf(evidence) ? { evidence } : {}),
  };
}
