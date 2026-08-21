import type { CVData, WorkExperience } from '@/lib/types';
import type { Locale } from '@/lib/i18n/translations';
import {
  buildExperienceDurationSnapshot,
  formatApproximateDurationPhrase,
} from '@/lib/cv-experience-duration';
import { SUMMARY_V2_REVISION } from './flag';
import type { SummaryV2EntryOwned, SummaryV2Snapshot } from './types';
import {
  buildEntryOwnedFactsFromLiveDescription,
  hashSummaryV2Text,
  splitLiveDutyBullets,
} from './facts';
import { buildSummaryV2SelectionManifest } from './manifest';
import {
  resolveSourceLocaleForText,
  SUMMARY_V2_SUPPORTED_LOCALES,
} from './locale-authority';
import {
  detectPrintMediumClaim,
  detectSummaryV2MaterialClaimCategories,
  SUMMARY_V2_MATERIAL_CLAIM_DETECTOR_REVISION,
} from './material-claims';
import {
  resolveExperienceTextareaProvenance,
  resolveTrustedUneditedAiOutputLocale,
} from '@/lib/cv-experience-ai-output-provenance';

/**
 * Live description only — never canonicalDescription / generatedDescription /
 * originalUserDescription. Deleted fields and stale caches contribute zero.
 */
export function liveExperienceDescription(exp: WorkExperience): string {
  return (exp.description || '').trim();
}

export function captureSummaryV2Snapshot(options: {
  cv: CVData;
  locale: Locale;
  gender?: string;
  referenceDateIso: string;
}): SummaryV2Snapshot {
  const { cv, locale, referenceDateIso } = options;
  const gender = options.gender || cv.personal?.gender || '';
  const experiences = [...(cv.experience || [])];
  const durationSnapshot = buildExperienceDurationSnapshot(experiences, referenceDateIso);
  const duration = durationSnapshot.total;
  const durationPhrase = duration.hasValidDates
    ? formatApproximateDurationPhrase(duration, locale)
    : '';

  const entries: SummaryV2EntryOwned[] = experiences.map((exp) => {
    const live = liveExperienceDescription(exp);
    const textareaProvenance = resolveExperienceTextareaProvenance(exp);
    const trustedPresentationLocaleRaw = resolveTrustedUneditedAiOutputLocale({
      exp,
      provenance: textareaProvenance,
      requestedLocale: locale,
    });
    const trustedPresentationLocale = SUMMARY_V2_SUPPORTED_LOCALES.includes(
      trustedPresentationLocaleRaw as Locale,
    ) ? trustedPresentationLocaleRaw as Locale : null;
    const immutableSourceText = (
      trustedPresentationLocale
      && textareaProvenance.currentTextareaProvenance === 'ai_generated_unedited'
      && textareaProvenance.authoritativeFactText.trim()
    )
      ? textareaProvenance.authoritativeFactText.trim()
      : live;
    const trustedPresentationBullets = trustedPresentationLocale
      ? splitLiveDutyBullets(live)
      : [];
    const canTrustPresentation = Boolean(
      trustedPresentationLocale
      && immutableSourceText
      && trustedPresentationBullets.length > 0
      && trustedPresentationBullets.length === splitLiveDutyBullets(immutableSourceText).length,
    );
    const isPresent = Boolean(exp.isPresent);
    const declaredRaw = (
      canTrustPresentation
        ? (exp.aiOutputProvenance?.sourceLocale || exp.descriptionSourceLocale)
        : null
    ) || exp.generatedLocale
      || exp.positionSourceLocale
      || cv.contentLocale
      || null;
    const declaredLocale = SUMMARY_V2_SUPPORTED_LOCALES.includes(declaredRaw as Locale)
      ? declaredRaw as Locale
      : null;
    const entryLocale = resolveSourceLocaleForText({
      text: [immutableSourceText, exp.position || ''].join('\n'),
      declaredLocale,
      fallbackLocale: locale,
    }).sourceLocale;
    const roleDeclaredRaw = exp.positionSourceLocale || exp.generatedLocale || cv.contentLocale || null;
    const roleDeclaredLocale = SUMMARY_V2_SUPPORTED_LOCALES.includes(roleDeclaredRaw as Locale)
      ? roleDeclaredRaw as Locale
      : null;
    const resolvedRoleLocale = resolveSourceLocaleForText({
      text: exp.position || '',
      declaredLocale: roleDeclaredLocale,
      fallbackLocale: locale,
    });
    const factDeclaredRaw = (
      canTrustPresentation
        ? (exp.aiOutputProvenance?.sourceLocale || exp.descriptionSourceLocale)
        : null
    ) || exp.descriptionSourceLocale || exp.generatedLocale || cv.contentLocale || null;
    const factDeclaredLocale = SUMMARY_V2_SUPPORTED_LOCALES.includes(factDeclaredRaw as Locale)
      ? factDeclaredRaw as Locale
      : null;
    const facts = buildEntryOwnedFactsFromLiveDescription({
      entryId: String(exp.id || ''),
      liveDescription: immutableSourceText,
      sourceLocale: entryLocale,
    }).map((fact, factIndex) => {
      const resolved = resolveSourceLocaleForText({
        text: fact.bulletText,
        declaredLocale: factDeclaredLocale,
        fallbackLocale: locale,
      });
      return {
        ...fact,
        sourceLocale: resolved.sourceLocale,
        sourceLocaleResolvedFrom: resolved.resolvedFrom,
        // Per-fact locale is the last immutable-source decision point. Capture
        // semantic authority here, before localization or candidate creation.
        sourcePrintFactPresent: detectPrintMediumClaim(
          fact.bulletText,
          resolved.sourceLocale,
        ),
        sourceMaterialClaimCategories: detectSummaryV2MaterialClaimCategories(
          fact.bulletText,
          resolved.sourceLocale,
        ),
        sourceMaterialAuthorityDetectorRevision:
          SUMMARY_V2_MATERIAL_CLAIM_DETECTOR_REVISION,
        sourceMaterialAuthorityPhase: 'immutable_source_fact' as const,
        ...(canTrustPresentation
          ? {
            presentationText: trustedPresentationBullets[factIndex] || '',
            presentationLocale: trustedPresentationLocale || undefined,
            presentationTrusted: true,
            presentationSource: 'validated_unedited_ai_output' as const,
          }
          : {}),
      };
    });
    // Short free-text titles can be linguistically ambiguous. Only use the
    // independently resolved entry context when every fact surface agrees on
    // one foreign locale; a mixed fact set can never overwrite title authority.
    const roleLocale = resolvedRoleLocale.resolvedFrom !== 'detected'
      && entryLocale !== locale
      && facts.length > 0
      && facts.every((fact) => fact.sourceLocale === entryLocale)
      ? { sourceLocale: entryLocale, resolvedFrom: 'fallback' as const }
      : resolvedRoleLocale;
    return {
      entryId: String(exp.id || ''),
      role: (exp.position || '').trim(),
      sourceRoleTitle: (exp.position || '').trim(),
      employer: (exp.company || '').trim(),
      startDate: (exp.startDate || '').trim(),
      endDate: (exp.endDate || '').trim(),
      isPresent,
      employmentState: isPresent ? 'present' : 'completed',
      sourceRoleTitleHash: hashSummaryV2Text((exp.position || '').trim()),
      roleSourceLocale: roleLocale.sourceLocale,
      roleSourceLocaleResolvedFrom: roleLocale.resolvedFrom,
      rolePresentationIsUserAuthoritative: Boolean(
        exp.positionUserEdited || exp.positionProvenance === 'manual',
      ),
      sourceLocale: entryLocale,
      descriptionHash: hashSummaryV2Text(live),
      facts,
    };
  });

  return {
    revision: SUMMARY_V2_REVISION,
    capturedAtIso: new Date().toISOString(),
    referenceDateIso,
    locale,
    gender,
    styleHintSummary: (cv.summary || '').trim(),
    entries,
    totalDurationMonths: duration.hasValidDates ? duration.totalMonths : 0,
    durationApproxYears: duration.hasValidDates && duration.unit === 'years'
      ? duration.approxYears
      : null,
    durationPhrase,
  };
}

/** Immutable Experience race guard shared by Generate and every rewrite path. */
export function summaryV2SnapshotMatchesCv(options: {
  cv: CVData;
  locale: Locale;
  gender?: string;
  referenceDateIso: string;
  expectedSnapshotHash: string;
}): boolean {
  const snapshot = captureSummaryV2Snapshot(options);
  return buildSummaryV2SelectionManifest(snapshot).snapshotHash === options.expectedSnapshotHash;
}
