/**
 * AAB-357 — Immutable per-entry target-locale role authority for Summary.
 *
 * Raw source titles are provenance. Localized target titles are the required
 * visible surface. Deterministic acceptance validates against this record —
 * never against raw foreign lexical equality alone.
 */
import type { Locale } from './i18n/translations';
import { resolveOccupationalTitleForSummary } from './cv-role-title';
import {
  resolveLocalizedSummaryRole,
  type LocalizedSummaryRoleResult,
} from './cv-summary-structured-role-localization';

export const SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION =
  'summary-target-role-authority-357-v1' as const;
export const SUMMARY_ROLE_LOCALE_ACCEPTANCE_357_REVISION =
  'summary-role-locale-acceptance-357-v1' as const;
export const GERMAN_SUMMARY_ROLE_LOCALE_AUTHORITY_357_REVISION =
  'german-summary-role-locale-authority-357-v1' as const;

void SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION;
void SUMMARY_ROLE_LOCALE_ACCEPTANCE_357_REVISION;
void GERMAN_SUMMARY_ROLE_LOCALE_AUTHORITY_357_REVISION;

function hashOpaque(text: string): string {
  let h = 2166136261;
  const s = (text || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

export type SummaryTargetRoleAuthority = {
  revision: typeof SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION;
  entryId: string | null;
  entryIdHash: string | null;
  rawRoleTitle: string;
  rawRoleTitleHash: string;
  sourceRoleLocale: string | null;
  requestedTargetLocale: Locale;
  localizedTargetRoleTitle: string;
  localizedTargetRoleTitleHash: string;
  grammaticalGender: 'female' | 'male' | 'unspecified';
  employmentState: 'present' | 'completed' | 'unknown';
  employer: string;
  localizationSource: LocalizedSummaryRoleResult['localizationSource'] | 'duties_backed_fallback';
  fallbackPreservationUsed: boolean;
  targetRoleValidationPassed: boolean;
  foreignRoleLeakageAllowed: false;
  rejectionReasons: string[];
  canonicalRoleIdentity: string | null;
};

/**
 * Build one immutable target-locale role authority for a selected Experience entry.
 * Occupation dictionary mappings are optional enrichment — not mandatory for
 * unknown free-text titles (those preserve safely when script/locale policy allows).
 */
export function buildSummaryTargetRoleAuthority(options: {
  entryId?: string | null;
  rawRoleTitle: string;
  requestedTargetLocale: Locale;
  gender?: string;
  employmentState?: 'present' | 'completed' | 'unknown';
  employer?: string;
  profileJobTitle?: string;
  dutiesText?: string;
}): SummaryTargetRoleAuthority {
  void SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION;
  void SUMMARY_ROLE_LOCALE_ACCEPTANCE_357_REVISION;
  void GERMAN_SUMMARY_ROLE_LOCALE_AUTHORITY_357_REVISION;

  const raw = (options.rawRoleTitle || '').replace(/\s+/g, ' ').trim();
  const targetLocale = options.requestedTargetLocale;
  const entryId = options.entryId || null;
  const resolved = resolveLocalizedSummaryRole({
    role: raw,
    targetLocale,
    gender: options.gender,
    entryId,
  });

  let localized = resolved.localizedTargetRoleLabel;
  let localizationSource: SummaryTargetRoleAuthority['localizationSource'] =
    resolved.localizationSource;
  let fallbackPreservationUsed = false;
  let targetRoleValidationPassed = resolved.localizationValidationPassed;
  const rejectionReasons = [...resolved.rejectionReasons];

  if (!targetRoleValidationPassed || !localized) {
    const dutiesBacked = resolveOccupationalTitleForSummary({
      profileJobTitle: options.profileJobTitle,
      currentExperienceTitle: raw,
      locale: targetLocale,
      gender: options.gender,
      dutiesText: options.dutiesText,
    }).trim();
    if (
      dutiesBacked
      && dutiesBacked !== raw
      && !/^(?:professional|पेशेवर|fachkraft)$/iu.test(dutiesBacked)
    ) {
      localized = dutiesBacked;
      localizationSource = 'duties_backed_fallback';
      fallbackPreservationUsed = true;
      targetRoleValidationPassed = true;
      rejectionReasons.length = 0;
    } else if (
      dutiesBacked
      && dutiesBacked === raw
      && resolved.localizationValidationPassed
    ) {
      localized = dutiesBacked;
      targetRoleValidationPassed = true;
    }
  }

  return {
    revision: SUMMARY_TARGET_ROLE_AUTHORITY_357_REVISION,
    entryId,
    entryIdHash: entryId ? hashOpaque(entryId) : null,
    rawRoleTitle: raw,
    rawRoleTitleHash: hashOpaque(raw || 'empty'),
    sourceRoleLocale: resolved.sourceRoleLocale,
    requestedTargetLocale: targetLocale,
    localizedTargetRoleTitle: localized,
    localizedTargetRoleTitleHash: hashOpaque(localized || ''),
    grammaticalGender: resolved.grammaticalGender,
    employmentState: options.employmentState || 'unknown',
    employer: (options.employer || '').trim(),
    localizationSource,
    fallbackPreservationUsed,
    targetRoleValidationPassed,
    foreignRoleLeakageAllowed: false,
    rejectionReasons,
    canonicalRoleIdentity: resolved.canonicalRoleIdentity,
  };
}

/**
 * Deterministic Summary role passes when the candidate shows the authority's
 * localized target title (or approved equivalent), not the raw source title.
 */
export function candidateMatchesTargetRoleAuthority(options: {
  summary: string;
  authority: SummaryTargetRoleAuthority;
}): {
  accepted: boolean;
  candidateContainsLocalizedRole: boolean;
  candidateContainsRawRole: boolean;
  rawSourceLeakageDetected: boolean;
  rejectionReason: string | null;
} {
  const text = (options.summary || '').replace(/\s+/g, ' ').trim();
  const auth = options.authority;
  const localized = (auth.localizedTargetRoleTitle || '').trim();
  const raw = (auth.rawRoleTitle || '').trim();
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidateContainsLocalizedRole = Boolean(
    localized && new RegExp(escape(localized), 'iu').test(text),
  );
  const candidateContainsRawRole = Boolean(
    raw && new RegExp(escape(raw), 'iu').test(text),
  );
  const rawIsForeign = Boolean(
    raw
    && raw !== localized
    && auth.sourceRoleLocale
    && auth.sourceRoleLocale !== auth.requestedTargetLocale,
  );
  const rawSourceLeakageDetected = candidateContainsRawRole && rawIsForeign;

  if (!auth.targetRoleValidationPassed || !localized) {
    return {
      accepted: false,
      candidateContainsLocalizedRole,
      candidateContainsRawRole,
      rawSourceLeakageDetected,
      rejectionReason: auth.rejectionReasons[0] || 'current_role_locale_mismatch',
    };
  }
  if (rawSourceLeakageDetected) {
    return {
      accepted: false,
      candidateContainsLocalizedRole,
      candidateContainsRawRole,
      rawSourceLeakageDetected: true,
      rejectionReason: 'raw_source_role_leakage',
    };
  }
  if (!candidateContainsLocalizedRole) {
    return {
      accepted: false,
      candidateContainsLocalizedRole: false,
      candidateContainsRawRole,
      rawSourceLeakageDetected: false,
      rejectionReason: 'current_role_title_missing',
    };
  }
  return {
    accepted: true,
    candidateContainsLocalizedRole: true,
    candidateContainsRawRole,
    rawSourceLeakageDetected: false,
    rejectionReason: null,
  };
}
