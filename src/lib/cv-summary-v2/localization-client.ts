import type { Locale } from '@/lib/i18n/translations';
import {
  acceptSummaryV2LocalizationResponse,
  buildSameLocaleLocalizedManifest,
  SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
  type SummaryV2LocalizedManifest,
  type SummaryV2LocalizationProviderResponse,
  type SummaryV2LocalizationValidation,
} from './localization';
import type { SummaryV2SelectionManifest } from './types';

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
  localizationSource: string | null;
  reason: string | null;
};

const validatedCache = new Map<string, SummaryV2LocalizedManifest>();

function cacheKey(manifest: SummaryV2SelectionManifest): string {
  return [
    SUMMARY_V2_LOCALIZED_MANIFEST_REVISION,
    manifest.snapshotHash,
    manifest.locale,
    manifest.gender,
  ].join('|');
}

function transportInput(
  manifest: SummaryV2SelectionManifest,
  repair: boolean,
): SummaryV2LocalizationTransportInput {
  const entries = [...(manifest.current ? [manifest.current] : []), ...manifest.priors];
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

export async function localizeSummaryV2Manifest(options: {
  manifest: SummaryV2SelectionManifest;
  transport: SummaryV2LocalizationTransport;
}): Promise<SummaryV2LocalizationOutcome> {
  const sameLocale = buildSameLocaleLocalizedManifest(options.manifest);
  if (sameLocale) {
    return {
      manifest: sameLocale,
      validation: null,
      localizationAttempted: false,
      localizationRepairAttempted: false,
      localizationRepairAccepted: false,
      localizationSource: 'same_locale_authoritative',
      reason: null,
    };
  }
  const key = cacheKey(options.manifest);
  const cached = validatedCache.get(key);
  if (cached) {
    return {
      manifest: { ...cached, localizationSource: 'validated_cache' },
      validation: null,
      localizationAttempted: false,
      localizationRepairAttempted: false,
      localizationRepairAccepted: false,
      localizationSource: 'validated_cache',
      reason: null,
    };
  }
  let lastValidation: SummaryV2LocalizationValidation | null = null;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const response = await options.transport(transportInput(options.manifest, pass === 1));
      const accepted = acceptSummaryV2LocalizationResponse({
        manifest: options.manifest,
        response,
        source: pass === 1 ? 'provider_repair' : 'provider',
      });
      lastValidation = accepted.validation;
      if (accepted.manifest) {
        const acceptedManifest = {
          ...accepted.manifest,
          localizationRepairAttempted: pass === 1,
          localizationRepairAccepted: pass === 1,
        };
        validatedCache.set(key, acceptedManifest);
        return {
          manifest: acceptedManifest,
          validation: accepted.validation,
          localizationAttempted: true,
          localizationRepairAttempted: pass === 1,
          localizationRepairAccepted: pass === 1,
          localizationSource: pass === 1 ? 'provider_repair' : 'provider',
          reason: null,
        };
      }
    } catch {
      lastValidation = null;
    }
  }
  return {
    manifest: null,
    validation: lastValidation,
    localizationAttempted: true,
    localizationRepairAttempted: true,
    localizationRepairAccepted: false,
    localizationSource: null,
    reason: lastValidation?.reason || 'localization_provider_failed',
  };
}

export function clearSummaryV2LocalizationCacheForTests(): void {
  validatedCache.clear();
}
