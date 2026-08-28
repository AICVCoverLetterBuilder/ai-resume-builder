import type { Locale } from '@/lib/i18n/translations';
import {
  acceptSummaryV2LocalizationResponse,
  buildSameLocaleLocalizedManifest,
  SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
  type SummaryV2LocalizedEntry,
  type SummaryV2LocalizedManifest,
  type SummaryV2LocalizationProviderResponse,
  type SummaryV2LocalizationSource,
  type SummaryV2LocalizationValidation,
} from './localization';
import { hashSummaryV2Text } from './facts';
import type {
  SummaryV2EntryOwned,
  SummaryV2SelectionManifest,
} from './types';

export const SUMMARY_V2_LOCALIZATION_RECOVERY_REVISION =
  'summary-v2-localization-recovery-417-v1' as const;

export type SummaryV2LocalizationTransportInput = {
  targetLocale: Locale;
  gender: string;
  repair: boolean;
  entries: Array<{
    entryId: string;
    sourceLocale: Locale;
    roleTitle: string;
    employer: string;
    employmentState: 'present' | 'completed';
    facts: Array<{ factId: string; sourceText: string; sourceTextHash: string }>;
  }>;
};

export type SummaryV2LocalizationTransport = (
  input: SummaryV2LocalizationTransportInput,
) => Promise<SummaryV2LocalizationProviderResponse>;

export type SummaryV2LocalizationOutcome = {
  manifest: SummaryV2LocalizedManifest | null;
  validation: SummaryV2LocalizationValidation | null;
  localizationAttempted: boolean;
  localizationRepairAttempted: boolean;
  localizationRepairAccepted: boolean;
  localizationRecoveryAttempted: boolean;
  localizationRecoveryAccepted: boolean;
  localizationSource: string | null;
  reason: string | null;
  primaryFailureReason: string | null;
  httpStatus: number | null;
  apiResponseKind: string;
  serverFallbackUsed: boolean;
  clientFallbackUsed: boolean;
  selectedEntryCount: number;
  sameLocaleBypassCount: number;
  validatedCacheHitCount: number;
  providerLocalizedEntryCount: number;
  recoveryLocalizedEntryCount: number;
  sourceByEntryId: Record<string, string>;
};

type TransportFailureEvidence = {
  reason: string;
  httpStatus: number | null;
  apiResponseKind: string;
  serverFallbackUsed: boolean;
  clientFallbackUsed: boolean;
};

type EntryLocalizationResult = {
  entry: SummaryV2LocalizedEntry | null;
  validation: SummaryV2LocalizationValidation | null;
  source: SummaryV2LocalizationSource | null;
  repairAttempted: boolean;
  repairAccepted: boolean;
  recoveryAttempted: boolean;
  recoveryAccepted: boolean;
  primaryFailureReason: string | null;
  failure: TransportFailureEvidence | null;
};

const validatedEntryCache = new Map<string, SummaryV2LocalizedEntry>();

function selectedEntries(manifest: SummaryV2SelectionManifest): SummaryV2EntryOwned[] {
  return [...(manifest.current ? [manifest.current] : []), ...manifest.priors];
}

function requiredFactsForEntry(
  manifest: SummaryV2SelectionManifest,
  entryId: string,
) {
  return [...manifest.requiredCurrentFacts, ...manifest.requiredPriorFacts]
    .filter((fact) => fact.entryId === entryId);
}

function entryManifest(
  manifest: SummaryV2SelectionManifest,
  entry: SummaryV2EntryOwned,
): SummaryV2SelectionManifest {
  const isCurrent = manifest.current?.entryId === entry.entryId;
  return {
    ...manifest,
    current: isCurrent ? entry : null,
    priors: isCurrent ? [] : [entry],
    requiredCurrentFacts: isCurrent
      ? manifest.requiredCurrentFacts.filter((fact) => fact.entryId === entry.entryId)
      : [],
    requiredPriorFacts: isCurrent
      ? []
      : manifest.requiredPriorFacts.filter((fact) => fact.entryId === entry.entryId),
  };
}

function entryCacheKey(
  manifest: SummaryV2SelectionManifest,
  entry: SummaryV2EntryOwned,
): string {
  const facts = requiredFactsForEntry(manifest, entry.entryId);
  return hashSummaryV2Text([
    SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
    manifest.locale,
    manifest.gender,
    entry.entryId,
    entry.sourceLocale,
    entry.role,
    entry.employer,
    entry.employmentState,
    entry.descriptionHash,
    ...facts.flatMap((fact) => [fact.factId, fact.sourceFactHash]),
  ].join('|'));
}

function cloneCachedEntry(entry: SummaryV2LocalizedEntry): SummaryV2LocalizedEntry {
  return {
    ...entry,
    facts: entry.facts.map((fact) => ({
      ...fact,
      localizationSource: 'validated_cache',
    })),
  };
}

function transportInput(
  manifest: SummaryV2SelectionManifest,
  repair: boolean,
): SummaryV2LocalizationTransportInput {
  const entries = selectedEntries(manifest);
  const required = [...manifest.requiredCurrentFacts, ...manifest.requiredPriorFacts];
  return {
    targetLocale: manifest.locale,
    gender: manifest.gender,
    repair,
    entries: entries.map((entry) => ({
      entryId: entry.entryId,
      sourceLocale: entry.sourceLocale,
      roleTitle: entry.role,
      employer: entry.employer,
      employmentState: entry.employmentState,
      facts: required.filter((fact) => fact.entryId === entry.entryId).map((fact) => ({
        factId: fact.factId,
        sourceText: fact.bulletText,
        sourceTextHash: fact.sourceFactHash,
      })),
    })),
  };
}

function transportFailure(error: unknown): TransportFailureEvidence {
  const value = error && typeof error === 'object'
    ? error as Record<string, unknown>
    : {};
  const message = error instanceof Error ? error.message.trim() : '';
  const reason = String(value.reason || message || 'localization_provider_failed');
  const rawStatus = Number(value.httpStatus ?? value.status);
  return {
    reason,
    httpStatus: Number.isFinite(rawStatus) ? rawStatus : null,
    apiResponseKind: String(value.apiResponseKind || 'transport_error'),
    serverFallbackUsed: value.serverFallbackUsed === true,
    clientFallbackUsed: value.clientFallbackUsed === true,
  };
}

function skipEquivalentRepair(reason: string): boolean {
  return /(?:timeout|abort|network|temporarily_unavailable|rate_limit|http_failure)/iu.test(reason);
}

async function localizeEntry(options: {
  manifest: SummaryV2SelectionManifest;
  entry: SummaryV2EntryOwned;
  transport: SummaryV2LocalizationTransport;
  recoveryTransport?: SummaryV2LocalizationTransport;
}): Promise<EntryLocalizationResult> {
  const scoped = entryManifest(options.manifest, options.entry);
  if (options.entry.sourceLocale === options.manifest.locale) {
    const sameLocale = buildSameLocaleLocalizedManifest(scoped);
    return {
      entry: sameLocale?.entries[0] || null,
      validation: null,
      source: sameLocale ? 'same_locale_authoritative' : null,
      repairAttempted: false,
      repairAccepted: false,
      recoveryAttempted: false,
      recoveryAccepted: false,
      primaryFailureReason: null,
      failure: sameLocale ? null : {
        reason: 'same_locale_manifest_creation_failed',
        httpStatus: null,
        apiResponseKind: 'validation_rejected',
        serverFallbackUsed: false,
        clientFallbackUsed: false,
      },
    };
  }

  const key = entryCacheKey(options.manifest, options.entry);
  const cached = validatedEntryCache.get(key);
  if (cached) {
    return {
      entry: cloneCachedEntry(cached),
      validation: null,
      source: 'validated_cache',
      repairAttempted: false,
      repairAccepted: false,
      recoveryAttempted: false,
      recoveryAccepted: false,
      primaryFailureReason: null,
      failure: null,
    };
  }

  let lastValidation: SummaryV2LocalizationValidation | null = null;
  let primaryFailure: TransportFailureEvidence | null = null;
  let repairAttempted = false;
  for (let pass = 0; pass < 2; pass += 1) {
    if (pass === 1 && primaryFailure && skipEquivalentRepair(primaryFailure.reason)) break;
    if (pass === 1) repairAttempted = true;
    try {
      const response = await options.transport(transportInput(scoped, pass === 1));
      const source: SummaryV2LocalizationSource = pass === 1 ? 'provider_repair' : 'provider';
      const accepted = acceptSummaryV2LocalizationResponse({
        manifest: scoped,
        response,
        source,
      });
      lastValidation = accepted.validation;
      if (accepted.manifest?.entries[0]) {
        const entry = accepted.manifest.entries[0];
        validatedEntryCache.set(key, entry);
        return {
          entry,
          validation: accepted.validation,
          source,
          repairAttempted,
          repairAccepted: pass === 1,
          recoveryAttempted: false,
          recoveryAccepted: false,
          primaryFailureReason: primaryFailure?.reason || null,
          failure: null,
        };
      }
      primaryFailure ||= {
        reason: accepted.validation.reason || 'localization_validation_failed',
        httpStatus: 200,
        apiResponseKind: 'validation_rejected',
        serverFallbackUsed: false,
        clientFallbackUsed: false,
      };
    } catch (error) {
      primaryFailure ||= transportFailure(error);
    }
  }

  if (options.recoveryTransport) {
    try {
      const response = await options.recoveryTransport(transportInput(scoped, false));
      const accepted = acceptSummaryV2LocalizationResponse({
        manifest: scoped,
        response,
        source: 'summary_provider_recovery',
      });
      lastValidation = accepted.validation;
      if (accepted.manifest?.entries[0]) {
        const entry = accepted.manifest.entries[0];
        validatedEntryCache.set(key, entry);
        return {
          entry,
          validation: accepted.validation,
          source: 'summary_provider_recovery',
          repairAttempted,
          repairAccepted: false,
          recoveryAttempted: true,
          recoveryAccepted: true,
          primaryFailureReason: primaryFailure?.reason || null,
          failure: null,
        };
      }
      return {
        entry: null,
        validation: accepted.validation,
        source: null,
        repairAttempted,
        repairAccepted: false,
        recoveryAttempted: true,
        recoveryAccepted: false,
        primaryFailureReason: primaryFailure?.reason || null,
        failure: {
          reason: accepted.validation.reason || 'localization_recovery_validation_failed',
          httpStatus: 200,
          apiResponseKind: 'validation_rejected',
          serverFallbackUsed: false,
          clientFallbackUsed: false,
        },
      };
    } catch (error) {
      return {
        entry: null,
        validation: lastValidation,
        source: null,
        repairAttempted,
        repairAccepted: false,
        recoveryAttempted: true,
        recoveryAccepted: false,
        primaryFailureReason: primaryFailure?.reason || null,
        failure: transportFailure(error),
      };
    }
  }

  return {
    entry: null,
    validation: lastValidation,
    source: null,
    repairAttempted,
    repairAccepted: false,
    recoveryAttempted: false,
    recoveryAccepted: false,
    primaryFailureReason: primaryFailure?.reason || null,
    failure: primaryFailure || {
      reason: lastValidation?.reason || 'localization_provider_failed',
      httpStatus: null,
      apiResponseKind: lastValidation ? 'validation_rejected' : 'transport_error',
      serverFallbackUsed: false,
      clientFallbackUsed: false,
    },
  };
}

function aggregateSource(results: EntryLocalizationResult[]): SummaryV2LocalizationSource {
  const sources = new Set(results.map((result) => result.source).filter(Boolean));
  if (sources.size === 1) return [...sources][0] as SummaryV2LocalizationSource;
  if (sources.has('summary_provider_recovery')) return 'summary_provider_recovery';
  return 'mixed_authoritative';
}

export async function localizeSummaryV2Manifest(options: {
  manifest: SummaryV2SelectionManifest;
  transport: SummaryV2LocalizationTransport;
  /** Alternate target-Summary context transformation contract. */
  recoveryTransport?: SummaryV2LocalizationTransport;
}): Promise<SummaryV2LocalizationOutcome> {
  void SUMMARY_V2_LOCALIZATION_RECOVERY_REVISION;
  const entries = selectedEntries(options.manifest);
  const results = await Promise.all(entries.map((entry) => localizeEntry({
    ...options,
    entry,
  })));
  const failed = results.find((result) => !result.entry);
  const attempted = entries.some((entry) => entry.sourceLocale !== options.manifest.locale);
  const repairAttempted = results.some((result) => result.repairAttempted);
  const repairAccepted = results.some((result) => result.repairAccepted);
  const recoveryAttempted = results.some((result) => result.recoveryAttempted);
  const recoveryAccepted = results.some((result) => result.recoveryAccepted);
  const sameLocaleBypassCount = results.filter((result) => result.source === 'same_locale_authoritative').length;
  const validatedCacheHitCount = results.filter((result) => result.source === 'validated_cache').length;
  const providerLocalizedEntryCount = results.filter((result) => (
    result.source === 'provider' || result.source === 'provider_repair'
  )).length;
  const recoveryLocalizedEntryCount = results.filter((result) => result.source === 'summary_provider_recovery').length;
  const primaryFailureReason = results.find((result) => result.primaryFailureReason)?.primaryFailureReason || null;
  const sourceByEntryId = Object.fromEntries(results.map((result, index) => [
    entries[index]!.entryId,
    result.source || 'none',
  ]));

  if (failed) {
    const failure = failed.failure || {
      reason: failed.validation?.reason || 'localization_provider_failed',
      httpStatus: null,
      apiResponseKind: 'transport_error',
      serverFallbackUsed: false,
      clientFallbackUsed: false,
    };
    return {
      manifest: null,
      validation: failed.validation,
      localizationAttempted: attempted,
      localizationRepairAttempted: repairAttempted,
      localizationRepairAccepted: repairAccepted,
      localizationRecoveryAttempted: recoveryAttempted,
      localizationRecoveryAccepted: recoveryAccepted,
      localizationSource: null,
      reason: failure.reason,
      primaryFailureReason,
      httpStatus: failure.httpStatus,
      apiResponseKind: failure.apiResponseKind,
      serverFallbackUsed: failure.serverFallbackUsed,
      clientFallbackUsed: failure.clientFallbackUsed,
      selectedEntryCount: entries.length,
      sameLocaleBypassCount,
      validatedCacheHitCount,
      providerLocalizedEntryCount,
      recoveryLocalizedEntryCount,
      sourceByEntryId,
    };
  }

  const combinedSource = aggregateSource(results);
  const combinedResponse: SummaryV2LocalizationProviderResponse = {
    targetLocale: options.manifest.locale,
    entries: results.map((result) => ({
      entryId: result.entry!.entryId,
      localizedRoleTitle: result.entry!.localizedRoleTitle,
      facts: result.entry!.facts.map((fact) => ({
        factId: fact.factId,
        localizedText: fact.localizedText,
      })),
    })),
  };
  const accepted = acceptSummaryV2LocalizationResponse({
    manifest: options.manifest,
    response: combinedResponse,
    source: combinedSource,
  });
  if (!accepted.manifest) {
    return {
      manifest: null,
      validation: accepted.validation,
      localizationAttempted: attempted,
      localizationRepairAttempted: repairAttempted,
      localizationRepairAccepted: repairAccepted,
      localizationRecoveryAttempted: recoveryAttempted,
      localizationRecoveryAccepted: recoveryAccepted,
      localizationSource: null,
      reason: accepted.validation.reason || 'localized_manifest_projection_failed',
      primaryFailureReason,
      httpStatus: attempted ? 200 : null,
      apiResponseKind: 'validation_rejected',
      serverFallbackUsed: false,
      clientFallbackUsed: false,
      selectedEntryCount: entries.length,
      sameLocaleBypassCount,
      validatedCacheHitCount,
      providerLocalizedEntryCount,
      recoveryLocalizedEntryCount,
      sourceByEntryId,
    };
  }
  const manifest: SummaryV2LocalizedManifest = {
    ...accepted.manifest,
    localizationRepairAttempted: repairAttempted,
    localizationRepairAccepted: repairAccepted,
  };
  return {
    manifest,
    validation: accepted.validation,
    localizationAttempted: attempted,
    localizationRepairAttempted: repairAttempted,
    localizationRepairAccepted: repairAccepted,
    localizationRecoveryAttempted: recoveryAttempted,
    localizationRecoveryAccepted: recoveryAccepted,
    localizationSource: combinedSource,
    reason: null,
    primaryFailureReason,
    httpStatus: attempted ? 200 : null,
    apiResponseKind: attempted ? 'localized_manifest' : 'not_attempted',
    serverFallbackUsed: false,
    clientFallbackUsed: false,
    selectedEntryCount: entries.length,
    sameLocaleBypassCount,
    validatedCacheHitCount,
    providerLocalizedEntryCount,
    recoveryLocalizedEntryCount,
    sourceByEntryId,
  };
}

export function clearSummaryV2LocalizationCacheForTests(): void {
  validatedEntryCache.clear();
}
