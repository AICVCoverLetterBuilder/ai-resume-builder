/**
 * Shared pre-template export preparation.
 * Every PDF/DOCX path must run this before template-specific branching so
 * Modern Minimal cannot validate Summary against a stale empty fact set.
 */
import type { CVData } from './types';
import type { Locale } from './i18n/translations';
import { normalizeLegacyCvRuntime } from './cv-legacy-runtime-migration';
import {
  recoverLegacyExperienceGrounding,
  type LegacyExperienceGroundingSource,
} from './cv-legacy-grounding-recovery';
import {
  buildCvCanonicalFactSet,
  buildFactSetFromExperienceDescription,
  bulletsForExperience,
} from './cv-canonical-facts';
import { resolveCanonicalExperienceDescription, validateSummaryExportCandidate } from './cv-export-integrity';
import {
  deterministicLocalizedBulletsFromCanonical,
  deterministicLocalizedSummaryFromCanonical,
} from './cv-localized-fallback';
import { buildExperienceDurationSnapshot } from './cv-experience-duration';
import { applyCvContentQuality } from './cv-content-quality';
import { validateFinalLocalizedCvFields } from './cv-field-locale-integrity';
import { CvExportFailure, wrapCvExportFailure } from './cv-export-error-message';
import type { WorkExperience } from './types';

export type LegacyRecoveredExportDiagnostics = {
  recoveryInvoked: boolean;
  experienceSourcesBefore: LegacyExperienceGroundingSource[];
  experienceSourcesAfter: LegacyExperienceGroundingSource[];
  recoveredDutyKeys: string[];
  summaryInitialReason?: string;
  summaryRecoverySource?: 'saved_summary' | 'deterministic_authoritative_facts';
  summaryRecoveryReason?: string;
};

function experienceSourcesSnapshot(cv: CVData): LegacyExperienceGroundingSource[] {
  return (cv.experience || []).map((exp) => {
    if ((exp.originalUserDescription || '').trim()) {
      return exp.groundingRecoverySource === 'legacy_recovered_display_duties'
        ? 'legacy_recovered_display_duties'
        : 'originalUserDescription';
    }
    if ((exp.canonicalDescription || '').trim()) return 'canonicalDescription';
    return 'none';
  });
}

/**
 * Project recovered English shells into locale-safe display bullets so Modern
 * Minimal cannot fail locale integrity when shell count > Hindi display lines.
 */
function projectRecoveredExperienceDisplay(
  exp: WorkExperience,
  experienceIndex: number,
  locale: Locale,
  gender: string,
): WorkExperience {
  const sourceDesc = resolveCanonicalExperienceDescription(exp);
  if (!sourceDesc.trim()) return exp;
  const factSet = buildFactSetFromExperienceDescription(sourceDesc, {
    experienceIndex,
    company: exp.company,
    position: exp.position,
    startDate: exp.startDate,
    endDate: exp.endDate,
    isPresent: exp.isPresent,
  });
  const facts = bulletsForExperience(factSet, experienceIndex);
  const localized = deterministicLocalizedBulletsFromCanonical(
    facts,
    locale,
    gender,
    { isPresent: Boolean(exp.isPresent) },
  );
  if (!localized) return exp;
  return {
    ...exp,
    description: localized,
  };
}

/**
 * Recover missing authoritative duties, then validate/recover Summary.
 * Must run before Modern Minimal / Corporate Navy / Creative Artistic branching.
 */
export function prepareLegacyRecoveredFinalLocaleSafeCv(
  sourceCv: CVData,
  locale: Locale,
  options?: { gender?: string; referenceDate?: Date | string },
): {
  cv: CVData;
  diagnostics: LegacyRecoveredExportDiagnostics;
} {
  const gender = options?.gender || sourceCv.personal?.gender || '';
  let cv = normalizeLegacyCvRuntime(sourceCv, locale);
  const experienceSourcesBefore = experienceSourcesSnapshot(cv);

  const recovery = recoverLegacyExperienceGrounding(cv);
  if (!recovery.invoked) {
    throw new CvExportFailure(
      'legacy_grounding_recovery_not_invoked',
      'legacy_grounding_recovery_not_invoked: export-boundary recovery was skipped',
    );
  }
  cv = recovery.cv;

  const hadDisplayDuties = (sourceCv.experience || []).some((exp) => Boolean(
    (exp.description || '').trim() || (exp.generatedDescription || '').trim(),
  ));
  const authoritativeEmpty = (cv.experience || []).every(
    (exp) => !resolveCanonicalExperienceDescription(exp).trim(),
  );
  if (hadDisplayDuties && authoritativeEmpty) {
    throw new CvExportFailure(
      'legacy_grounding_recovery_empty',
      'summary_authoritative_fact_set_empty: legacy_grounding_recovery_empty',
    );
  }

  const durationSnapshot = buildExperienceDurationSnapshot(
    cv.experience || [],
    options?.referenceDate ?? new Date(),
  );
  const summaryFactSet = buildCvCanonicalFactSet({
    ...cv,
    experience: (cv.experience || []).map((exp) => ({
      ...exp,
      description: resolveCanonicalExperienceDescription(exp),
    })),
    summary: cv.canonicalSummary || (cv.summaryOrigin === 'user' ? cv.summary : ''),
  });
  const bulletCount = summaryFactSet.facts.filter((f) => f.type === 'experience_bullet').length;
  if (hadDisplayDuties && bulletCount === 0) {
    throw new CvExportFailure(
      'summary_authoritative_fact_set_empty',
      'summary_authoritative_fact_set_empty: Summary fact set ignored recovered experience',
    );
  }

  const initialSummaryValidation = validateSummaryExportCandidate(
    cv.summary || '',
    summaryFactSet,
    locale,
    gender,
    (cv.canonicalSummary || '').trim(),
    cv.canonicalSnapshot?.canonicalLocale,
    cv,
  );
  let summaryRecoverySource: LegacyRecoveredExportDiagnostics['summaryRecoverySource'] = 'saved_summary';
  let summaryRecoveryReason: string | undefined;
  if (!initialSummaryValidation.valid) {
    const recovered = deterministicLocalizedSummaryFromCanonical(
      summaryFactSet,
      locale,
      gender,
      durationSnapshot.total,
    );
    summaryRecoverySource = 'deterministic_authoritative_facts';
    const recoveryValidation = validateSummaryExportCandidate(
      recovered,
      summaryFactSet,
      locale,
      gender,
      (cv.canonicalSummary || '').trim(),
      cv.canonicalSnapshot?.canonicalLocale,
      cv,
    );
    summaryRecoveryReason = recoveryValidation.reason;
    if (recovered && recoveryValidation.valid) {
      cv = {
        ...cv,
        summary: recovered,
        summaryOrigin: 'deterministic_fallback',
      };
    } else {
      throw new CvExportFailure(
        'summary_recovery_projection_failed',
        `summary_recovery_projection_failed: initial=${initialSummaryValidation.reason}; recovery=${recoveryValidation.reason || 'empty'}`,
      );
    }
  }

  // Align display bullets with recovered shells before quality/locale checks.
  // Prevents English shell padding when Hindi had fewer combined lines.
  cv = {
    ...cv,
    experience: (cv.experience || []).map((exp, i) =>
      projectRecoveredExperienceDisplay(exp, i, locale, gender),
    ),
  };

  // Locale-safe projection shared by all templates (including Modern Minimal).
  const quality = applyCvContentQuality(cv, locale, {
    gender,
    durationSnapshot,
    referenceDate: options?.referenceDate || durationSnapshot.referenceDateIso,
    summaryOrigin: cv.summaryOrigin,
  });
  cv = quality.cv;

  // Guard: quality must not wipe recovered grounding shells.
  const afterQualitySources = experienceSourcesSnapshot(cv);
  const lostRecovery = recovery.experienceSources.includes('legacy_recovered_display_duties')
    && afterQualitySources.every((source) => source === 'none');
  if (lostRecovery) {
    throw new CvExportFailure(
      'legacy_grounding_recovery_overwritten',
      'legacy_grounding_recovery_overwritten: post-quality snapshot lost recovered duties',
    );
  }

  const localeCheck = validateFinalLocalizedCvFields(cv, locale);
  if (!localeCheck.valid) {
    const first = localeCheck.violations[0];
    throw wrapCvExportFailure(
      new Error(
        `summary_export_contract_mismatch: ${first.kind}: ${first.path} does not match requested locale ${locale}`,
      ),
      'summary_export_contract_mismatch',
    );
  }

  return {
    cv,
    diagnostics: {
      recoveryInvoked: true,
      experienceSourcesBefore,
      experienceSourcesAfter: recovery.experienceSources,
      recoveredDutyKeys: recovery.recoveredDutyKeys,
      summaryInitialReason: initialSummaryValidation.reason,
      summaryRecoverySource,
      summaryRecoveryReason,
    },
  };
}
