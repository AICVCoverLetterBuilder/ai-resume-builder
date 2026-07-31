/**
 * Summary enhance clean no-op — UI / diagnostic terminal contract.
 * Distinct from validation failure: preserve text + usage, one ai_noop toast.
 */
import type { AiErrorCode } from '@/lib/ai-error-codes';
import { mapExperienceAiFailureToErrorCode } from '@/lib/ai-error-codes';
import { SUMMARY_NOOP_REJECTION_REASON } from '@/lib/cv-ai-finalize-apply';

export type SummaryFinalizeClientKind =
  | 'clean_noop'
  | 'apply_success'
  | 'validation_failure';

export type SummaryFinalizeClientOutcome = {
  kind: SummaryFinalizeClientKind;
  /** Toast code to show; null when no error toast (apply success). */
  toastCode: AiErrorCode | null;
  reason: string | null;
};

type FinalizeLike = {
  blocked?: boolean;
  countedAsSuccess?: boolean;
  reason?: string | null;
  diagnostics?: {
    noOpDetected?: boolean | null;
    noOpRejectionReason?: string | null;
    typedFailureReason?: string | null;
  } | null;
};

/** True when finalize classified a clean enhance no-op (not a validation failure). */
export function isSummaryCleanNoOpFinalizeResult(fin: FinalizeLike): boolean {
  if (fin.countedAsSuccess) return false;
  if (
    fin.reason === SUMMARY_NOOP_REJECTION_REASON
    || fin.reason === 'style_no_safe_material_change'
    || fin.diagnostics?.noOpRejectionReason === SUMMARY_NOOP_REJECTION_REASON
    || fin.diagnostics?.noOpRejectionReason === 'style_no_safe_material_change'
    || fin.diagnostics?.noOpDetected === true
  ) {
    return true;
  }
  return false;
}

/**
 * Page-handler authority for Summary finalize → toast / apply routing.
 * Clean no-op is prioritized before any generic validation-failure branch.
 */
export function resolveSummaryFinalizeClientOutcome(
  fin: FinalizeLike,
  failureFallbackReason?: string | null,
): SummaryFinalizeClientOutcome {
  if (!fin.blocked && fin.countedAsSuccess) {
    return { kind: 'apply_success', toastCode: null, reason: null };
  }
  if (isSummaryCleanNoOpFinalizeResult(fin)) {
    return {
      kind: 'clean_noop',
      toastCode: 'ai_noop',
      reason: SUMMARY_NOOP_REJECTION_REASON,
    };
  }
  const reason = fin.reason
    || fin.diagnostics?.typedFailureReason
    || failureFallbackReason
    || 'generation_validation_failed';
  return {
    kind: 'validation_failure',
    toastCode: mapExperienceAiFailureToErrorCode(reason),
    reason: String(reason),
  };
}
