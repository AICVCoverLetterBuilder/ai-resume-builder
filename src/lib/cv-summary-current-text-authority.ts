import type { SummaryExportCandidateValidation } from './cv-export-integrity';
import type { Locale } from './i18n/translations';

export const SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION =
  'summary-current-text-authority-404-v1' as const;

export const SUMMARY_STALE_REBOUND_LOCALE_GUARD_REVISION =
  'summary-stale-rebound-locale-guard-411-v1' as const;

export type SummaryCurrentTextAuthorityDecision = {
  staleMetadataDetected: boolean;
  rebound: boolean;
  reason?: 'validated_current_text_over_stale_context';
  visibleTextValidationReason: string;
  onlyWordBudgetViolation: boolean;
  foreignProfessionalPrefixRejected: boolean;
  blockedReason?:
    | 'foreign_professional_prefix_non_english_target'
    | 'app_owned_canonical_v2_authority';
  localeGuardRevision: typeof SUMMARY_STALE_REBOUND_LOCALE_GUARD_REVISION;
  revision: typeof SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION;
};

/**
 * Stale generation metadata must not override a visible Summary that has already
 * passed the live CV's locale, grounding, role, duration and grammar contract.
 * A bounded word-budget overrun is also safe because AAB-403 revalidates every
 * compacted candidate. Real locale/grounding conflicts remain fail-closed.
 */
export function resolveSummaryCurrentTextAuthority(options: {
  staleMetadataDetected: boolean;
  occupationalContentConflict: boolean;
  validation: SummaryExportCandidateValidation;
  visibleText?: string;
  requestedLocale?: Locale;
  /**
   * A distinct, validated canonical V2 terminal surface exists for an
   * app-owned saved Summary.  Current-text validation is not sufficient to
   * promote the older app surface over that terminal authority.
   */
  canonicalV2AuthorityRequired?: boolean;
}): SummaryCurrentTextAuthorityDecision {
  const violations = options.validation.violations || [];
  const onlyWordBudgetViolation = violations.length > 0
    && violations.every((violation) => violation.startsWith('summary_too_long'));
  const validatedAgainstCurrentCv = options.validation.valid || onlyWordBudgetViolation;

  const foreignProfessionalPrefixRejected = Boolean(
    options.requestedLocale
    && options.requestedLocale !== 'en'
    && /^\s*professional\b/iu.test(String(options.visibleText || ''))
  );

  const rebound = Boolean(
    options.staleMetadataDetected
    && !options.occupationalContentConflict
    && !foreignProfessionalPrefixRejected
    && !options.canonicalV2AuthorityRequired
    && validatedAgainstCurrentCv
  );

  return {
    staleMetadataDetected: options.staleMetadataDetected,
    rebound,
    ...(rebound ? { reason: 'validated_current_text_over_stale_context' as const } : {}),
    ...(foreignProfessionalPrefixRejected
      ? {
          blockedReason:
            'foreign_professional_prefix_non_english_target' as const,
        }
      : options.canonicalV2AuthorityRequired
        ? {
          blockedReason: 'app_owned_canonical_v2_authority' as const,
        }
      : {}),
    visibleTextValidationReason: options.validation.reason,
    onlyWordBudgetViolation,
    foreignProfessionalPrefixRejected,
    localeGuardRevision:
      SUMMARY_STALE_REBOUND_LOCALE_GUARD_REVISION,
    revision: SUMMARY_CURRENT_TEXT_AUTHORITY_REVISION,
  };
}
