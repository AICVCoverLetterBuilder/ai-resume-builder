import type { Locale } from '@/lib/i18n/translations';
import {
  acceptSummaryV2LocalizationResponse,
  buildSummaryV2EntrySurfaceTransportPlan,
  buildSameLocaleLocalizedManifest,
  classifySummaryV2EntrySurfaceAuthority,
  projectSummaryV2AuthoritativeRoleTitle,
  SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
  type SummaryV2LocalizedEntry,
  type SummaryV2LocalizedManifest,
  type SummaryV2LocalizationProviderResponse,
  type SummaryV2LocalizationFailureEvidence,
  type SummaryV2LocalizationSource,
  type SummaryV2LocalizationValidation,
  type SummaryV2EntrySurfaceTransportPlan,
  inspectSummaryV2TranslatableSurface,
} from './localization';
import { hashSummaryV2Text } from './facts';
import type {
  SummaryV2EntryOwned,
  SummaryV2SelectionManifest,
} from './types';

export const SUMMARY_V2_LOCALIZATION_RECOVERY_REVISION =
  'summary-v2-localization-recovery-419-v1' as const;

export type SummaryV2LocalizationLineage =
  | 'same_locale_authoritative'
  | 'validated_cache'
  | 'provider_primary'
  | 'provider_repair'
  | 'summary_context_recovery'
  | 'mixed_authoritative'
  | 'failed';

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
    translateRoleTitle?: boolean;
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
  lineageByEntryId: Record<string, SummaryV2LocalizationLineage>;
  /** Accepted target locale per entry, even when later manifest assembly fails. */
  targetLocaleByEntryId: Record<string, Locale | null>;
  validationFailureEvidence: SummaryV2LocalizationFailureEvidence | null;
  /** Privacy-safe proof that aggregate locale never hides surface decisions. */
  surfaceTransportPlans: Array<{
    entryHash: string;
    aggregateSourceLocale: Locale;
    targetLocale: Locale;
    roleAuthority: string;
    factAuthorityByFactHash: Record<string, string>;
    plannedRoleSurfaceCount: number;
    plannedFactSurfaceCount: number;
    actualRoleSurfaceCount: number;
    actualFactSurfaceCount: number;
    bypassedSurfaceCount: number;
    protectedSurfaceCount: number;
    roleLineage: string | null;
    factLineageByFactHash: Record<string, string>;
    entryIdParityPassed: boolean;
    factIdParityPassed: boolean;
    acceptedLocale: Locale | null;
  }>;
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
  failureEvidence?: SummaryV2LocalizationFailureEvidence | null;
};

type CachedLocalizedSurface = { localizedText: string };
const validatedSurfaceCache = new Map<string, CachedLocalizedSurface>();

function fallbackFailureEvidence(options: {
  manifest: SummaryV2SelectionManifest;
  entry: SummaryV2EntryOwned;
  plan: SummaryV2EntrySurfaceTransportPlan;
  reason: string;
}): SummaryV2LocalizationFailureEvidence {
  const fact = options.entry.facts.find((candidate) => (
    options.plan.facts.some((surface) => (
      surface.factId === candidate.factId
      && surface.authority !== 'target_native_authoritative'
    ))
  ));
  const surfaceKind = fact ? 'localized_fact' : 'localized_role_title';
  const sourceText = fact?.bulletText || options.entry.role;
  const localizedText = fact?.presentationTrusted && fact.presentationText
    ? fact.presentationText
    : sourceText;
  const inspected = inspectSummaryV2TranslatableSurface({
    localizedText,
    sourceText,
    employer: options.entry.employer,
    targetLocale: options.manifest.locale,
    protectSourceProperNouns: Boolean(fact),
  });
  const tokenClass = /incomplete|empty|uncertain/iu.test(options.reason)
    ? 'translatable_surface_incomplete'
    : /script/iu.test(options.reason)
      ? 'translatable_surface_wrong_script'
      : 'translatable_surface_wrong_locale';
  return {
    entryId: options.entry.entryId,
    factId: fact?.factId || null,
    surfaceKind,
    textPreviewHash: hashSummaryV2Text(localizedText || 'empty'),
    detectedLocale: inspected.detectedLocale,
    detectedScript: inspected.detectedScript,
    tokenClass,
    protectedEntityTokenClasses: inspected.protectedClasses,
  };
}

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

function surfaceCacheKey(
  manifest: SummaryV2SelectionManifest,
  entry: SummaryV2EntryOwned,
  surfaceKind: 'role' | 'fact',
  surfaceId: string,
  sourceHash: string,
): string {
  return hashSummaryV2Text([
    SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
    manifest.locale,
    manifest.gender,
    entry.entryId,
    surfaceKind,
    surfaceId,
    sourceHash,
  ].join('|'));
}

type SurfaceCacheMatches = {
  role: CachedLocalizedSurface | null;
  facts: Map<string, CachedLocalizedSurface>;
};

function transportInput(
  manifest: SummaryV2SelectionManifest,
  repair: boolean,
  plans: SummaryV2EntrySurfaceTransportPlan[],
  cacheByEntryId: Map<string, SurfaceCacheMatches> = new Map(),
): SummaryV2LocalizationTransportInput {
  const entries = selectedEntries(manifest);
  const required = [...manifest.requiredCurrentFacts, ...manifest.requiredPriorFacts];
  return {
    targetLocale: manifest.locale,
    gender: manifest.gender,
    repair,
    entries: entries.map((entry) => {
      const plan = plans.find((candidate) => candidate.entryId === entry.entryId)
        || buildSummaryV2EntrySurfaceTransportPlan({ manifest, entry });
      const cached = cacheByEntryId.get(entry.entryId);
      return ({
      entryId: entry.entryId,
      sourceLocale: entry.sourceLocale,
      roleTitle: plan.role.authority === 'foreign_localization_required' && !cached?.role
        ? entry.role
        : '',
      employer: entry.employer,
      employmentState: entry.employmentState,
      translateRoleTitle: plan.role.authority === 'foreign_localization_required' && !cached?.role,
      facts: required.filter((fact) => (
        fact.entryId === entry.entryId
        && plan.facts.some((surface) => (
          surface.factId === fact.factId
          && surface.authority === 'foreign_localization_required'
          && !cached?.facts.has(fact.factId)
        ))
      )).map((fact) => ({
        factId: fact.factId,
        sourceText: fact.bulletText,
        sourceTextHash: fact.sourceFactHash,
      })),
    });}),
  };
}

function mergeAuthoritativeEntrySurfaces(options: {
  manifest: SummaryV2SelectionManifest;
  entry: SummaryV2EntryOwned;
  response: SummaryV2LocalizationProviderResponse;
  plan: SummaryV2EntrySurfaceTransportPlan;
  cached: SurfaceCacheMatches;
  providerSource: SummaryV2LocalizationSource;
}): {
  response: SummaryV2LocalizationProviderResponse;
  roleSource: SummaryV2LocalizationSource;
  factSourceByFactId: Record<string, SummaryV2LocalizationSource>;
} {
  const providerEntry = options.response.entries.find((entry) => entry.entryId === options.entry.entryId);
  const providerFacts = new Map((providerEntry?.facts || []).map((fact) => [fact.factId, fact.localizedText]));
  const required = requiredFactsForEntry(options.manifest, options.entry.entryId);
  const roleSource: SummaryV2LocalizationSource = options.plan.role.authority === 'target_native_authoritative'
    ? 'same_locale_authoritative'
    : options.cached.role ? 'validated_cache' : options.providerSource;
  const factSourceByFactId: Record<string, SummaryV2LocalizationSource> = {};
  const mergedFacts = required.map((fact) => {
    const authoritative = options.plan.facts.some((surface) => (
      surface.factId === fact.factId && surface.authority === 'target_native_authoritative'
    ));
    factSourceByFactId[fact.factId] = authoritative
      ? 'same_locale_authoritative'
      : options.cached.facts.has(fact.factId) ? 'validated_cache' : options.providerSource;
    return {
      factId: fact.factId,
      localizedText: authoritative
        ? (fact.presentationTrusted && fact.presentationText
          ? fact.presentationText
          : fact.bulletText)
        : options.cached.facts.get(fact.factId)?.localizedText
          || String(providerFacts.get(fact.factId) || ''),
    };
  });
  return {
    roleSource,
    factSourceByFactId,
    response: {
      targetLocale: options.manifest.locale,
      entries: [{
        entryId: options.entry.entryId,
        localizedRoleTitle: options.plan.role.authority === 'target_native_authoritative'
          ? projectSummaryV2AuthoritativeRoleTitle({
            manifest: options.manifest,
            entry: options.entry,
          })
          : options.cached.role?.localizedText || String(providerEntry?.localizedRoleTitle || ''),
        facts: mergedFacts,
      }],
    },
  };
}

function responseMatchesRequestedSurfaces(options: {
  response: SummaryV2LocalizationProviderResponse;
  request: SummaryV2LocalizationTransportInput;
}): boolean {
  if (options.response.targetLocale !== options.request.targetLocale) return false;
  if (options.response.entries.length !== options.request.entries.length) return false;
  return options.request.entries.every((requested) => {
    const matches = options.response.entries.filter((entry) => entry.entryId === requested.entryId);
    if (matches.length !== 1) return false;
    const actual = matches[0]!;
    const expectedFactIds = requested.facts.map((fact) => fact.factId);
    const actualFactIds = actual.facts.map((fact) => fact.factId);
    return new Set(actualFactIds).size === actualFactIds.length
      && expectedFactIds.length === actualFactIds.length
      && expectedFactIds.every((id) => actualFactIds.includes(id))
      && (!requested.translateRoleTitle || actual.localizedRoleTitle.trim().length > 0);
  });
}

function aggregateEntrySurfaceSource(options: {
  roleSource: SummaryV2LocalizationSource;
  factSourceByFactId: Record<string, SummaryV2LocalizationSource>;
}): SummaryV2LocalizationSource {
  const sources = new Set([options.roleSource, ...Object.values(options.factSourceByFactId)]);
  return sources.size === 1 ? [...sources][0]! : 'mixed_authoritative';
}

function storeAcceptedRequestedSurfaces(options: {
  manifest: SummaryV2SelectionManifest;
  sourceEntry: SummaryV2EntryOwned;
  acceptedEntry: SummaryV2LocalizedEntry;
  request: SummaryV2LocalizationTransportInput;
}): void {
  const requested = options.request.entries.find((entry) => entry.entryId === options.sourceEntry.entryId);
  if (!requested) return;
  if (requested.translateRoleTitle) {
    validatedSurfaceCache.set(surfaceCacheKey(
      options.manifest,
      options.sourceEntry,
      'role',
      options.sourceEntry.entryId,
      hashSummaryV2Text(options.sourceEntry.role),
    ), { localizedText: options.acceptedEntry.localizedRoleTitle });
  }
  const acceptedFacts = new Map(options.acceptedEntry.facts.map((fact) => [fact.factId, fact]));
  for (const requestedFact of requested.facts) {
    const accepted = acceptedFacts.get(requestedFact.factId);
    if (!accepted) continue;
    validatedSurfaceCache.set(surfaceCacheKey(
      options.manifest,
      options.sourceEntry,
      'fact',
      requestedFact.factId,
      requestedFact.sourceTextHash,
    ), { localizedText: accepted.localizedText });
  }
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
  const surfaceAuthority = classifySummaryV2EntrySurfaceAuthority({
    manifest: scoped,
    entry: options.entry,
  });
  const plan = buildSummaryV2EntrySurfaceTransportPlan({ manifest: scoped, entry: options.entry });
  if (
    plan.role.authority === 'uncertain_rejected'
    || plan.facts.some((surface) => surface.authority === 'uncertain_rejected')
  ) {
    return {
      entry: null,
      validation: null,
      source: null,
      repairAttempted: false,
      repairAccepted: false,
      recoveryAttempted: false,
      recoveryAccepted: false,
      primaryFailureReason: 'localization_surface_authority_uncertain',
      failure: {
        reason: 'localization_surface_authority_uncertain',
        httpStatus: null,
        apiResponseKind: 'classification_rejected',
        serverFallbackUsed: false,
        clientFallbackUsed: false,
      },
    };
  }
  if (surfaceAuthority.allTranslatableSurfacesTargetNative) {
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

  const cached: SurfaceCacheMatches = {
    role: plan.role.authority === 'foreign_localization_required'
      ? validatedSurfaceCache.get(surfaceCacheKey(
        scoped, options.entry, 'role', options.entry.entryId, plan.role.sourceHash,
      )) || null
      : null,
    facts: new Map(plan.facts.flatMap((surface) => {
      if (surface.authority !== 'foreign_localization_required') return [];
      const hit = validatedSurfaceCache.get(surfaceCacheKey(
        scoped, options.entry, 'fact', surface.factId, surface.sourceHash,
      ));
      return hit ? [[surface.factId, hit] as const] : [];
    })),
  };
  const cacheByEntryId = new Map([[options.entry.entryId, cached]]);
  const hasPendingRole = plan.role.authority === 'foreign_localization_required' && !cached.role;
  const pendingFactCount = plan.facts.filter((surface) => (
    surface.authority === 'foreign_localization_required' && !cached.facts.has(surface.factId)
  )).length;

  if (!hasPendingRole && pendingFactCount === 0) {
    const partial = mergeAuthoritativeEntrySurfaces({
      manifest: scoped,
      entry: options.entry,
      response: { targetLocale: scoped.locale, entries: [] },
      plan,
      cached,
      providerSource: 'validated_cache',
    });
    const source = aggregateEntrySurfaceSource(partial);
    const accepted = acceptSummaryV2LocalizationResponse({
      manifest: scoped,
      response: partial.response,
      source,
      roleSourceByEntryId: { [options.entry.entryId]: partial.roleSource },
      factSourceByFactId: partial.factSourceByFactId,
    });
    return {
      entry: accepted.manifest?.entries[0] || null,
      validation: accepted.validation,
      source: accepted.manifest ? source : null,
      repairAttempted: false,
      repairAccepted: false,
      recoveryAttempted: false,
      recoveryAccepted: false,
      primaryFailureReason: null,
      failure: accepted.manifest ? null : {
        reason: accepted.validation.reason || 'surface_cache_validation_failed',
        httpStatus: null,
        apiResponseKind: 'validation_rejected',
        serverFallbackUsed: false,
        clientFallbackUsed: false,
      },
    };
  }

  let lastValidation: SummaryV2LocalizationValidation | null = null;
  let primaryFailure: TransportFailureEvidence | null = null;
  let repairAttempted = false;
  for (let pass = 0; pass < 2; pass += 1) {
    if (pass === 1 && primaryFailure && skipEquivalentRepair(primaryFailure.reason)) break;
    if (pass === 1) repairAttempted = true;
    try {
      const request = transportInput(scoped, pass === 1, [plan], cacheByEntryId);
      const rawResponse = await options.transport(request);
      if (!responseMatchesRequestedSurfaces({ response: rawResponse, request })) {
        throw Object.assign(new Error('localization_surface_id_parity_failed'), {
          reason: 'localization_surface_id_parity_failed',
          httpStatus: 200,
          apiResponseKind: 'validation_rejected',
        });
      }
      const source: SummaryV2LocalizationSource = pass === 1 ? 'provider_repair' : 'provider';
      const partial = mergeAuthoritativeEntrySurfaces({
        manifest: scoped, entry: options.entry, response: rawResponse, plan, cached,
        providerSource: source,
      });
      const entrySource = aggregateEntrySurfaceSource(partial);
      const accepted = acceptSummaryV2LocalizationResponse({
        manifest: scoped,
        response: partial.response,
        source: entrySource,
        roleSourceByEntryId: { [options.entry.entryId]: partial.roleSource },
        factSourceByFactId: partial.factSourceByFactId,
      });
      lastValidation = accepted.validation;
      if (accepted.manifest?.entries[0]) {
        const entry = accepted.manifest.entries[0];
        storeAcceptedRequestedSurfaces({
          manifest: scoped, sourceEntry: options.entry, acceptedEntry: entry, request,
        });
        return {
          entry,
          validation: accepted.validation,
          source: entrySource,
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
      const request = transportInput(scoped, false, [plan], cacheByEntryId);
      const rawResponse = await options.recoveryTransport(request);
      if (!responseMatchesRequestedSurfaces({ response: rawResponse, request })) {
        throw Object.assign(new Error('localization_surface_id_parity_failed'), {
          reason: 'localization_surface_id_parity_failed',
          httpStatus: 200,
          apiResponseKind: 'validation_rejected',
        });
      }
      const partial = mergeAuthoritativeEntrySurfaces({
        manifest: scoped, entry: options.entry, response: rawResponse, plan, cached,
        providerSource: 'summary_provider_recovery',
      });
      const entrySource = aggregateEntrySurfaceSource(partial);
      const accepted = acceptSummaryV2LocalizationResponse({
        manifest: scoped,
        response: partial.response,
        source: entrySource,
        roleSourceByEntryId: { [options.entry.entryId]: partial.roleSource },
        factSourceByFactId: partial.factSourceByFactId,
      });
      lastValidation = accepted.validation;
      if (accepted.manifest?.entries[0]) {
        const entry = accepted.manifest.entries[0];
        storeAcceptedRequestedSurfaces({
          manifest: scoped, sourceEntry: options.entry, acceptedEntry: entry, request,
        });
        return {
          entry,
          validation: accepted.validation,
          source: entrySource,
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

function diagnosticLineage(source: SummaryV2LocalizationSource | null): SummaryV2LocalizationLineage {
  if (source === 'provider') return 'provider_primary';
  if (source === 'summary_provider_recovery') return 'summary_context_recovery';
  if (source === 'mixed_authoritative') return 'mixed_authoritative';
  if (source === 'same_locale_authoritative'
    || source === 'validated_cache'
    || source === 'provider_repair') return source;
  return 'failed';
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
  const failedIndex = results.findIndex((result) => !result.entry);
  const attempted = entries.some((entry) => {
    const plan = buildSummaryV2EntrySurfaceTransportPlan({ manifest: options.manifest, entry });
    return plan.roleSurfaceCount + plan.factSurfaceCount > 0;
  });
  const repairAttempted = results.some((result) => result.repairAttempted);
  const repairAccepted = results.some((result) => result.repairAccepted);
  const recoveryAttempted = results.some((result) => result.recoveryAttempted);
  const recoveryAccepted = results.some((result) => result.recoveryAccepted);
  const sameLocaleBypassCount = results.filter((result) => result.source === 'same_locale_authoritative').length;
  const validatedCacheHitCount = results.filter((result) => result.source === 'validated_cache').length;
  const providerLocalizedEntryCount = results.filter((result) => (
    result.source === 'provider' || result.source === 'provider_repair'
    || result.source === 'mixed_authoritative'
  )).length;
  const recoveryLocalizedEntryCount = results.filter((result) => result.source === 'summary_provider_recovery').length;
  const primaryFailureReason = results.find((result) => result.primaryFailureReason)?.primaryFailureReason || null;
  const sourceByEntryId = Object.fromEntries(results.map((result, index) => [
    entries[index]!.entryId,
    result.source || 'none',
  ]));
  const lineageByEntryId = Object.fromEntries(results.map((result, index) => [
    entries[index]!.entryId,
    diagnosticLineage(result.source),
  ]));
  const targetLocaleByEntryId = Object.fromEntries(results.map((result, index) => [
    entries[index]!.entryId,
    result.entry ? options.manifest.locale : null,
  ]));
  const surfaceTransportPlans = entries.map((entry, index) => {
    const plan = buildSummaryV2EntrySurfaceTransportPlan({ manifest: options.manifest, entry });
    const localized = results[index]?.entry || null;
    const roleLineage = localized?.localizedRoleTitleLocalizationSource || null;
    const sentLineages = new Set<SummaryV2LocalizationSource>([
      'provider', 'provider_repair', 'summary_provider_recovery',
    ]);
    return {
      entryHash: plan.entryHash,
      aggregateSourceLocale: plan.aggregateSourceLocale,
      targetLocale: plan.targetLocale,
      roleAuthority: plan.role.authority,
      factAuthorityByFactHash: Object.fromEntries(plan.facts.map((surface) => [
        hashSummaryV2Text(surface.factId), surface.authority,
      ])),
      plannedRoleSurfaceCount: plan.roleSurfaceCount,
      plannedFactSurfaceCount: plan.factSurfaceCount,
      actualRoleSurfaceCount: roleLineage && sentLineages.has(roleLineage) ? 1 : 0,
      actualFactSurfaceCount: localized?.facts.filter((fact) => (
        sentLineages.has(fact.localizationSource)
      )).length || 0,
      bypassedSurfaceCount: plan.bypassedSurfaceCount,
      protectedSurfaceCount: plan.protectedSurfaceCount,
      roleLineage,
      factLineageByFactHash: Object.fromEntries((localized?.facts || []).map((fact) => [
        hashSummaryV2Text(fact.factId), fact.localizationSource,
      ])),
      entryIdParityPassed: results[index]?.validation?.entryIdParityPassed ?? Boolean(localized),
      factIdParityPassed: results[index]?.validation?.factIdParityPassed ?? Boolean(localized),
      acceptedLocale: localized ? options.manifest.locale : null,
    };
  });

  if (failed) {
    const failure = failed.failure || {
      reason: failed.validation?.reason || 'localization_provider_failed',
      httpStatus: null,
      apiResponseKind: 'transport_error',
      serverFallbackUsed: false,
      clientFallbackUsed: false,
    };
    const failureEvidence = failed.validation?.failureEvidence
      || failed.failureEvidence
      || (failedIndex >= 0 && entries[failedIndex]
        ? fallbackFailureEvidence({
          manifest: options.manifest,
          entry: entries[failedIndex]!,
          plan: buildSummaryV2EntrySurfaceTransportPlan({
            manifest: options.manifest,
            entry: entries[failedIndex]!,
          }),
          reason: failure.reason,
        })
        : null);
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
      lineageByEntryId,
      targetLocaleByEntryId,
      validationFailureEvidence: failureEvidence,
      surfaceTransportPlans,
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
    sourceByEntryId: Object.fromEntries(results.map((result, index) => [
      entries[index]!.entryId,
      result.source!,
    ])),
    roleSourceByEntryId: Object.fromEntries(results.map((result, index) => [
      entries[index]!.entryId,
      result.entry!.localizedRoleTitleLocalizationSource,
    ])),
    factSourceByFactId: Object.fromEntries(results.flatMap((result) => (
      result.entry!.facts.map((fact) => [fact.factId, fact.localizationSource] as const)
    ))),
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
      lineageByEntryId,
      targetLocaleByEntryId,
      validationFailureEvidence: accepted.validation.failureEvidence,
      surfaceTransportPlans,
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
    lineageByEntryId,
    targetLocaleByEntryId,
    validationFailureEvidence: null,
    surfaceTransportPlans,
  };
}

export function clearSummaryV2LocalizationCacheForTests(): void {
  validatedSurfaceCache.clear();
}
