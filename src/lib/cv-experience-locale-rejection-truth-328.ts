/**
 * AAB-328 — Experience phase-local locale validation and rejection-reason truth.
 *
 * Locale purity must not be overloaded with fact/predicate coverage failures.
 * Top-level, typed, and candidate-lineage primary reasons must agree.
 */
export const EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION =
  'experience-phase-locale-truth-328-v1' as const;

export const EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION =
  'experience-rejection-lineage-truth-328-v1' as const;

void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
void EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION;

const LOCALE_REASONS = new Set([
  'wrong_language',
  'locale_mismatch',
  'locale_impurity',
  'wrong_script',
  'mixed_language',
  'source_language_leakage',
]);

const COVERAGE_REASONS = new Set([
  'english_experience_warehouse_fact_coverage_incomplete',
  'german_experience_warehouse_fact_coverage_incomplete',
  'spanish_experience_warehouse_fact_coverage_incomplete',
  'experience_material_fact_coverage_incomplete',
  'source_unit_predicate_coverage_failed',
  'russian_design_family_coverage_incomplete',
  'croatian_design_material_coverage_incomplete',
]);

export function isExperienceLocaleRejectionReason(reason: string | null | undefined): boolean {
  void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
  if (!reason) return false;
  return LOCALE_REASONS.has(reason);
}

export function isExperienceCoverageRejectionReason(reason: string | null | undefined): boolean {
  void EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION;
  if (!reason) return false;
  return COVERAGE_REASONS.has(reason) || /fact_coverage_incomplete|predicate_coverage/i.test(reason);
}

export type ExperiencePhaseLocaleEvidence = {
  wrongLocaleBulletCount?: number | null;
  wrongScriptBulletCount?: number | null;
  mixedLanguageBulletCount?: number | null;
  sourceLanguageLeakageDetected?: boolean | null;
  targetLocalePurityPassed?: boolean | null;
  detectedLocaleByBullet?: Array<string | null> | null;
};

/**
 * Locale validation from candidate evidence only — never from coverage reasons.
 */
export function evaluateExperiencePhaseLocaleValidation(
  evidence: ExperiencePhaseLocaleEvidence,
  options?: { explicitReason?: string | null },
): {
  passed: boolean;
  reason: string | null;
  responseRejectedForLocaleImpurity: boolean;
} {
  void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
  const wrong = Number(evidence.wrongLocaleBulletCount ?? 0);
  const wrongScript = Number(evidence.wrongScriptBulletCount ?? 0);
  const mixed = Number(evidence.mixedLanguageBulletCount ?? 0);
  const leakage = Boolean(evidence.sourceLanguageLeakageDetected);
  const purityExplicit = evidence.targetLocalePurityPassed;
  const purityOk = purityExplicit === false
    ? false
    : (purityExplicit === true || (wrong === 0 && wrongScript === 0 && mixed === 0 && !leakage));

  const explicit = options?.explicitReason || null;
  if (explicit && isExperienceLocaleRejectionReason(explicit) && !purityOk) {
    return {
      passed: false,
      reason: explicit,
      responseRejectedForLocaleImpurity: true,
    };
  }

  // Never treat coverage failures as locale failures.
  if (explicit && isExperienceCoverageRejectionReason(explicit)) {
    return {
      passed: purityOk,
      reason: null,
      responseRejectedForLocaleImpurity: false,
    };
  }

  if (!purityOk) {
    const reason = leakage
      ? 'source_language_leakage'
      : (mixed > 0
        ? 'mixed_language'
        : (wrongScript > 0 ? 'wrong_script' : 'wrong_language'));
    return {
      passed: false,
      reason,
      responseRejectedForLocaleImpurity: true,
    };
  }

  // Purity passed — forbid wrong_language even if a stale reason claims otherwise.
  return {
    passed: true,
    reason: null,
    responseRejectedForLocaleImpurity: false,
  };
}

/**
 * Deterministic primary rejection precedence (AAB-328 §10).
 */
export function resolveExperiencePrimaryRejectionReason(
  reasons: Array<string | null | undefined>,
): string | null {
  void EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION;
  const present = reasons.map((r) => (r || '').trim()).filter(Boolean);
  if (!present.length) return null;
  const order = [
    'experience_entry_mismatch',
    'experience_entry_missing',
    'target_entry_mismatch',
    'wrong_language',
    'locale_mismatch',
    'locale_impurity',
    'wrong_script',
    'mixed_language',
    'source_language_leakage',
    'unsupported_generated_duty',
    'guarantee_escalation',
    'english_experience_warehouse_fact_coverage_incomplete',
    'german_experience_warehouse_fact_coverage_incomplete',
    'spanish_experience_warehouse_fact_coverage_incomplete',
    'experience_material_fact_coverage_incomplete',
    'source_unit_predicate_coverage_failed',
    'russian_design_family_coverage_incomplete',
    'croatian_design_material_coverage_incomplete',
    'arabic_employment_tense_mismatch',
    'russian_employment_tense_mismatch',
    'perspective_invalid',
    'semantic_noop',
    'diagnostic_invariant_failed',
  ];
  for (const key of order) {
    if (present.includes(key)) return key;
  }
  return present[0] || null;
}

/**
 * When purity evidence shows English-clean bullets, never keep wrong_language
 * as the terminal/top-level reason if a coverage reason is also present.
 */
export function reconcileExperienceTerminalRejectionReason(options: {
  terminalReason: string | null | undefined;
  providerRejectionReason?: string | null;
  fallbackRejectionReason?: string | null;
  lineagePrimaryReasons?: Array<string | null | undefined>;
  localeEvidence?: ExperiencePhaseLocaleEvidence;
}): string | null {
  void EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION;
  void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
  const locale = evaluateExperiencePhaseLocaleValidation(options.localeEvidence || {});
  const candidates = [
    options.terminalReason,
    options.providerRejectionReason,
    options.fallbackRejectionReason,
    ...(options.lineagePrimaryReasons || []),
  ];
  const primary = resolveExperiencePrimaryRejectionReason(candidates);
  if (
    primary
    && isExperienceLocaleRejectionReason(primary)
    && locale.passed
  ) {
    // Locale evidence contradicts locale reason — prefer coverage/other.
    const nonLocale = candidates.filter((r) => r && !isExperienceLocaleRejectionReason(r));
    return resolveExperiencePrimaryRejectionReason(nonLocale) || primary;
  }
  return primary;
}

export function computeAuthoritativeSourceAlreadyTargetLocale(options: {
  authoritativeSourceLocale: string | null | undefined;
  requestedTargetLocale: string | null | undefined;
}): boolean {
  void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
  const src = (options.authoritativeSourceLocale || '').toLowerCase().split('|')[0] || '';
  const tgt = (options.requestedTargetLocale || '').toLowerCase().split('|')[0] || '';
  if (!src || !tgt || src === 'unknown') return false;
  if (src === tgt) return true;
  if ((src === 'sr' || src === 'hr') && (tgt === 'sr' || tgt === 'hr')) return true;
  return false;
}

export function computeVisibleTextareaAlreadyTargetLocale(options: {
  visibleTextareaLocale: string | null | undefined;
  requestedTargetLocale: string | null | undefined;
}): boolean {
  void EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION;
  const src = (options.visibleTextareaLocale || '').toLowerCase().split('|')[0] || '';
  const tgt = (options.requestedTargetLocale || '').toLowerCase().split('|')[0] || '';
  if (!src || !tgt || src === 'unknown') return false;
  if (src === tgt) return true;
  if ((src === 'sr' || src === 'hr') && (tgt === 'sr' || tgt === 'hr')) return true;
  return false;
}

/**
 * Legacy `sourceAlreadyValidForTarget` must represent the *visible* textarea
 * contract (historical meaning), never claim Spanish authoritative source is EN.
 */
export function legacySourceAlreadyValidForTargetMeaning():
  'visible_textarea_already_target_locale' {
  return 'visible_textarea_already_target_locale';
}
