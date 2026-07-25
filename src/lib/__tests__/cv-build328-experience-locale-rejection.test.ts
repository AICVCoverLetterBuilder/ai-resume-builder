/**
 * @vitest-environment jsdom
 *
 * AAB-328 Phase 2 — Experience phase-local locale truth and rejection lineage.
 */
import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION,
  EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION,
  evaluateExperiencePhaseLocaleValidation,
  reconcileExperienceTerminalRejectionReason,
  computeAuthoritativeSourceAlreadyTargetLocale,
  computeVisibleTextareaAlreadyTargetLocale,
  legacySourceAlreadyValidForTargetMeaning,
  isExperienceLocaleRejectionReason,
} from '@/lib/cv-experience-locale-rejection-truth-328';
import { checkExperienceDiagnosticInvariants } from '@/lib/cv-ai-diagnostics-contract';
import {
  ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION,
  ENGLISH_EXPERIENCE_DETERMINISTIC_THREE_FACT_328_REVISION,
} from '@/lib/cv-english-experience-warehouse-grounding';

describe('Experience locale and rejection lineage truth (AAB-328 Phase 2)', () => {
  it('exposes AAB-328 locale/rejection markers', () => {
    expect(EXPERIENCE_PHASE_LOCALE_TRUTH_328_REVISION)
      .toBe('experience-phase-locale-truth-328-v1');
    expect(EXPERIENCE_REJECTION_LINEAGE_TRUTH_328_REVISION)
      .toBe('experience-rejection-lineage-truth-328-v1');
    expect(ENGLISH_EXPERIENCE_INCOMING_GOODS_MATCHER_328_REVISION)
      .toBe('english-experience-incoming-goods-matcher-328-v1');
    expect(ENGLISH_EXPERIENCE_DETERMINISTIC_THREE_FACT_328_REVISION)
      .toBe('english-experience-deterministic-three-fact-328-v1');
  });

  it('31–36. English purity forbids wrong_language', () => {
    const ok = evaluateExperiencePhaseLocaleValidation({
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      sourceLanguageLeakageDetected: false,
      targetLocalePurityPassed: true,
      detectedLocaleByBullet: ['en', 'en', 'en'],
    }, { explicitReason: 'english_experience_warehouse_fact_coverage_incomplete' });
    expect(ok.passed).toBe(true);
    expect(ok.reason).toBeNull();
    expect(ok.responseRejectedForLocaleImpurity).toBe(false);

    const stale = evaluateExperiencePhaseLocaleValidation({
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      sourceLanguageLeakageDetected: false,
      targetLocalePurityPassed: true,
    }, { explicitReason: 'wrong_language' });
    expect(stale.passed).toBe(true);
    expect(stale.responseRejectedForLocaleImpurity).toBe(false);

    const impure = evaluateExperiencePhaseLocaleValidation({
      wrongLocaleBulletCount: 1,
      targetLocalePurityPassed: false,
    });
    expect(impure.passed).toBe(false);
    expect(isExperienceLocaleRejectionReason(impure.reason)).toBe(true);
  });

  it('37–42. Coverage failure prefers coverage over wrong_language', () => {
    const terminal = reconcileExperienceTerminalRejectionReason({
      terminalReason: 'wrong_language',
      providerRejectionReason: 'english_experience_warehouse_fact_coverage_incomplete',
      localeEvidence: {
        wrongLocaleBulletCount: 0,
        mixedLanguageBulletCount: 0,
        sourceLanguageLeakageDetected: false,
        targetLocalePurityPassed: true,
        detectedLocaleByBullet: ['en', 'en', 'en'],
      },
    });
    expect(terminal).toBe('english_experience_warehouse_fact_coverage_incomplete');
  });

  it('43–45. Authoritative Spanish vs visible English target-locale fields', () => {
    expect(computeAuthoritativeSourceAlreadyTargetLocale({
      authoritativeSourceLocale: 'es',
      requestedTargetLocale: 'en',
    })).toBe(false);
    expect(computeVisibleTextareaAlreadyTargetLocale({
      visibleTextareaLocale: 'en',
      requestedTargetLocale: 'en',
    })).toBe(true);
    expect(legacySourceAlreadyValidForTargetMeaning())
      .toBe('visible_textarea_already_target_locale');
  });

  it('49. Locale contradiction triggers invariant failure', () => {
    const bad = checkExperienceDiagnosticInvariants({
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      targetLocalePurityPassed: true,
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      sourceLanguageLeakageDetected: false,
      providerLocaleValidationReason: 'wrong_language',
      finalTypedFailureReason: 'wrong_language',
      responseRejectedForLocaleImpurity: true,
      providerRejectionReason: 'english_experience_warehouse_fact_coverage_incomplete',
    } as Parameters<typeof checkExperienceDiagnosticInvariants>[0]);
    expect(bad.passed).toBe(false);
    expect(bad.failures.some((f) =>
      f.invariantCode === 'wrong_language_without_locale_evidence'
      || f.invariantCode === 'locale_purity_true_but_wrong_language_reported'
      || f.invariantCode === 'coverage_failure_reported_as_locale_reason')).toBe(true);
  });

  it('clean English purity passes invariants for coverage-only failure', () => {
    const ok = checkExperienceDiagnosticInvariants({
      countedAsSuccess: false,
      visibleApplySucceeded: false,
      targetLocalePurityPassed: true,
      targetLocaleValidationPassed: true,
      wrongLocaleBulletCount: 0,
      mixedLanguageBulletCount: 0,
      sourceLanguageLeakageDetected: false,
      providerLocaleValidationReason: null,
      responseRejectedForLocaleImpurity: false,
      providerRejectionReason: 'english_experience_warehouse_fact_coverage_incomplete',
      finalTypedFailureReason: 'english_experience_warehouse_fact_coverage_incomplete',
      requiredFactCount: 3,
      coveredFactCount: 2,
      uncoveredFactIdentityHashes: ['en_wh_incoming_goods_inspection'],
    } as Parameters<typeof checkExperienceDiagnosticInvariants>[0]);
    expect(ok.failures.some((f) => f.invariantCode.includes('wrong_language')
      || f.invariantCode.includes('locale_purity'))).toBe(false);
  });
});
