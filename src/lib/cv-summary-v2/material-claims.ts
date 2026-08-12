import { fingerprintText } from '@/lib/cv-export-diagnostics';
import type { Locale } from '@/lib/i18n/translations';
import type {
  SummaryV2EntryFact,
  SummaryV2EntryOwned,
  SummaryV2FinalUnitOwnershipEvidence,
  SummaryV2MaterialAuthorityResult,
  SummaryV2MaterialClaimCategory,
  SummaryV2SelectedEntrySourceContentFingerprint,
  SummaryV2SelectionManifest,
  SummaryV2SourceMaterialAuthorityEvidence,
} from './types';
import { SUMMARY_V2_PRINT_MATERIAL_CATEGORY } from './types';
import { splitSummaryV2FinalUnits } from './unit-ownership';

export const SUMMARY_V2_MATERIAL_CLAIM_DETECTOR_REVISION =
  'summary-v2-material-surface-detector-421-v1' as const;
export const SUMMARY_V2_MATERIAL_CLAIM_CONTRACT_REVISION =
  'summary-v2-fact-owned-material-provenance-421-v1' as const;

/** Locale surfaces all resolve to the same entry-owned semantic category. */
const PRINT_SURFACE_BY_LOCALE: Record<Locale, RegExp> = {
  en: /\b(?:print|printed|printing|printed\s+materials?)\b/iu,
  de: /\b(?:printmedien|drucksachen|druckmedien|gedruckt(?:e|en|er|es)?)\b/iu,
  es: /\b(?:impres(?:o|a|os|as)|imprimir|materiales?\s+impresos?)\b/iu,
  fr: /\b(?:imprim(?:é|ée|és|ées|er)|supports?\s+imprimés?)\b/iu,
  it: /\b(?:stampa|stampat(?:o|a|i|e)|materiali?\s+stampati?)\b/iu,
  ar: /(?:المواد|الوسائط|وسائط|مواد)\s+(?:ال)?مطبوعة|(?:^|[^\p{L}])(?:للطباعة|مطبوعات|مطبوعة|المطبوعة)(?=[^\p{L}]|$)/iu,
  sr: /(?<!\p{L})(?:štamp(?:a|u|anje|ani|ane)|tisk(?:a|u|ani|ane)|штамп(?:а|у|ање|ани|ане))(?!\p{L})/iu,
  hr: /\b(?:tisak|tiska|tiskani|tiskane|štampa|štampu)\b/iu,
  ru: /(?<!\p{L})(?:печатн(?:ая|ые|ых|ой|ую)|полиграфи(?:я|и)|печать)(?!\p{L})/iu,
  'pt-BR': /\b(?:impresso|impressa|impressos|impressas|mídia\s+impressa|materiais?\s+impressos?)\b/iu,
  hi: /(?:मुद्रित|प्रिंट(?:ेड|िंग)?)(?:\s+(?:मीडिया|सामग्री))?/iu,
  ja: /(?:印刷(?:物|媒体|素材)?|プリント(?:媒体|素材)?)/u,
};

export function detectSummaryV2MaterialClaimCategories(
  text: string,
  locale?: Locale,
): SummaryV2MaterialClaimCategory[] {
  const normalized = (text || '').normalize('NFKC');
  const patterns = locale
    ? [PRINT_SURFACE_BY_LOCALE[locale]]
    : Object.values(PRINT_SURFACE_BY_LOCALE);
  return patterns.some((pattern) => pattern.test(normalized))
    ? [SUMMARY_V2_PRINT_MATERIAL_CATEGORY]
    : [];
}

export function detectPrintMediumClaim(text: string, locale?: Locale): boolean {
  return detectSummaryV2MaterialClaimCategories(text, locale)
    .includes(SUMMARY_V2_PRINT_MATERIAL_CATEGORY);
}

function selectedEntries(manifest: SummaryV2SelectionManifest): SummaryV2EntryOwned[] {
  return [...(manifest.current ? [manifest.current] : []), ...manifest.priors];
}

function selectedFacts(manifest: SummaryV2SelectionManifest): SummaryV2EntryFact[] {
  // Preserve the legacy aggregate scope: every immutable fact belonging to a
  // selected Experience entry, not only the bounded required-coverage subset.
  return selectedEntries(manifest).flatMap((entry) => entry.facts);
}

function categoriesForSourceFact(fact: SummaryV2EntryFact): SummaryV2MaterialClaimCategory[] {
  const categories = new Set(fact.sourceMaterialClaimCategories || []);
  // Migration-safe compatibility for immutable manifests captured while the
  // legacy aggregate print boolean was the only serialized category authority.
  if (fact.sourcePrintFactPresent === true) {
    categories.add(SUMMARY_V2_PRINT_MATERIAL_CATEGORY);
  }
  return [...categories].sort();
}

function contentFingerprintMaterial(
  value: Omit<SummaryV2SelectedEntrySourceContentFingerprint, 'sourceContentFingerprint'>,
): string {
  return JSON.stringify({
    entryIdHash: value.entryIdHash,
    roleTitleSourceHash: value.roleTitleSourceHash,
    orderedSourceFactHashes: value.orderedSourceFactHashes,
    materialCategoriesBySourceFact: value.materialCategoriesBySourceFact,
  });
}

function buildSelectedEntrySourceContentFingerprints(
  manifest: SummaryV2SelectionManifest,
): SummaryV2SelectedEntrySourceContentFingerprint[] {
  return selectedEntries(manifest).map((entry) => {
    const base = {
      entryIdHash: fingerprintText(entry.entryId),
      roleTitleSourceHash: entry.sourceRoleTitleHash || fingerprintText(entry.role),
      orderedSourceFactHashes: entry.facts.map((fact) => fact.sourceFactHash),
      materialCategoriesBySourceFact: entry.facts.map((fact) => ({
        sourceFactHash: fact.sourceFactHash,
        sourceFactIdHash: fingerprintText(fact.factId),
        canonicalMaterialCategories: categoriesForSourceFact(fact),
      })),
    };
    return {
      ...base,
      sourceContentFingerprint: fingerprintText(contentFingerprintMaterial(base)),
    };
  });
}

function buildSourceAuthorityEvidence(
  manifest: SummaryV2SelectionManifest,
): Array<SummaryV2SourceMaterialAuthorityEvidence & {
  internalOwningEntryId: string;
}> {
  const selectedEntryIds = new Set(selectedEntries(manifest).map((entry) => entry.entryId));
  return selectedFacts(manifest).flatMap((fact) => {
    const categories = categoriesForSourceFact(fact);
    if (categories.length === 0) return [];
    return [{
      owningEntryHash: fingerprintText(fact.entryId),
      sourceFactHash: fact.sourceFactHash,
      sourceFactIdHash: fingerprintText(fact.factId),
      sourceLocale: fact.sourceLocale,
      canonicalMaterialCategories: categories,
      detectorRevision: fact.sourceMaterialAuthorityDetectorRevision
        || SUMMARY_V2_MATERIAL_CLAIM_DETECTOR_REVISION,
      authorityPhase: fact.sourceMaterialAuthorityPhase || 'immutable_source_fact',
      sourceFactEntryOwnershipPassed: selectedEntryIds.has(fact.entryId)
        && selectedEntries(manifest).some((entry) => (
          entry.entryId === fact.entryId
          && entry.facts.some((candidate) => (
            candidate.factId === fact.factId
            && candidate.sourceFactHash === fact.sourceFactHash
          ))
        )),
      internalOwningEntryId: fact.entryId,
    }];
  });
}

function inferUnitOwner(
  unit: string,
  entries: SummaryV2EntryOwned[],
): SummaryV2EntryOwned | undefined {
  const folded = unit.toLocaleLowerCase();
  const employerOwners = entries.filter((entry) => (
    entry.employer && folded.includes(entry.employer.toLocaleLowerCase())
  ));
  const roleOwners = entries.filter((entry) => (
    entry.role && folded.includes(entry.role.toLocaleLowerCase())
  ));
  const inferred = employerOwners.length > 0 ? employerOwners : roleOwners;
  return inferred.length === 1 ? inferred[0] : undefined;
}

/**
 * Pure self-consistency check used by both final acceptance and the diagnostic
 * pre-apply invariant gate. It consumes only privacy-safe canonical evidence.
 */
export function validateSummaryV2MaterialAuthorityProvenance(
  result: SummaryV2MaterialAuthorityResult,
): { passed: boolean; failureReasons: string[] } {
  const failures = new Set<string>();
  const sourceByHash = new Map(result.sourceAuthorityEvidence.map((source) => [
    `${source.owningEntryHash}|${source.sourceFactHash}`,
    source,
  ]));

  for (const source of result.sourceAuthorityEvidence) {
    if (
      !source.owningEntryHash
      || !source.sourceFactHash
      || !source.sourceFactIdHash
      || source.canonicalMaterialCategories.length === 0
      || source.authorityPhase !== 'immutable_source_fact'
      || !source.detectorRevision
    ) failures.add('source_authority_evidence_incomplete');
    if (!source.sourceFactEntryOwnershipPassed) {
      failures.add('source_fact_entry_ownership_mismatch');
    }
  }

  for (const entry of result.selectedEntrySourceContentFingerprints) {
    const base = {
      entryIdHash: entry.entryIdHash,
      roleTitleSourceHash: entry.roleTitleSourceHash,
      orderedSourceFactHashes: entry.orderedSourceFactHashes,
      materialCategoriesBySourceFact: entry.materialCategoriesBySourceFact,
    };
    if (
      !entry.entryIdHash
      || !entry.roleTitleSourceHash
      || !entry.sourceContentFingerprint
      || entry.orderedSourceFactHashes.some((hash) => !hash)
      || entry.materialCategoriesBySourceFact.some((fact) => (
        !fact.sourceFactHash || !fact.sourceFactIdHash
      ))
      || entry.sourceContentFingerprint !== fingerprintText(contentFingerprintMaterial(base))
    ) failures.add('selected_entry_source_content_fingerprint_invalid');
  }

  for (const claim of result.finalClaimAuthorityEvidence) {
    const matchingFacts = claim.authorizingSourceFactHashes.map((sourceFactHash) => (
      sourceByHash.get(`${claim.authorizingSourceEntryHash || ''}|${sourceFactHash}`)
    ));
    const proofComplete = Boolean(
      claim.finalUnitHash
      && claim.finalUnitRoleSlot
      && claim.finalUnitOwningEntryHash
      && claim.authorizingSourceEntryHash
      && claim.authorizingSourceEntryHash === claim.finalUnitOwningEntryHash
      && claim.authorizingSourceFactHashes.length > 0
      && matchingFacts.every((source) => (
        source
        && source.sourceFactEntryOwnershipPassed
        && source.authorityPhase === 'immutable_source_fact'
        && source.canonicalMaterialCategories.includes(claim.canonicalCategory)
      ))
    );
    if (claim.authorityMatchPassed && !proofComplete) {
      failures.add('accepted_material_claim_missing_owner_matching_source_fact');
    }
    if (claim.authorityMatchPassed && claim.unsupportedReason !== null) {
      failures.add('accepted_material_claim_has_unsupported_reason');
    }
    if (!claim.authorityMatchPassed && claim.unsupportedReason === null) {
      failures.add('unsupported_material_claim_missing_reason');
    }
  }

  return { passed: failures.size === 0, failureReasons: [...failures] };
}

/**
 * Canonical generic material-authority audit. Source categories are read only
 * from immutable selected facts; final text is scanned solely to locate claims
 * that must be authorized by a fact owned by the same final unit entry.
 */
export function auditSummaryV2MaterialClaims(
  text: string,
  manifest: SummaryV2SelectionManifest,
  finalUnitOwnership: SummaryV2FinalUnitOwnershipEvidence[] = [],
): SummaryV2MaterialAuthorityResult {
  const units = splitSummaryV2FinalUnits(text);
  const entries = selectedEntries(manifest);
  const entriesById = new Map(entries.map((entry) => [entry.entryId, entry]));
  const evidenceByIndex = new Map(finalUnitOwnership.map((evidence) => [
    evidence.unitIndex,
    evidence,
  ]));
  const internalSource = buildSourceAuthorityEvidence(manifest);
  const publicSource = internalSource.map(({ internalOwningEntryId: _, ...evidence }) => evidence);
  const finalClaimAuthorityEvidence = units.flatMap((unit, unitIndex) => (
    detectSummaryV2MaterialClaimCategories(unit, manifest.locale).map((canonicalCategory) => {
      const unitOwnership = evidenceByIndex.get(unitIndex);
      const inferredOwner = finalUnitOwnership.length === 0
        ? inferUnitOwner(unit, entries)
        : undefined;
      const owner = unitOwnership?.owningEntryId
        ? entriesById.get(unitOwnership.owningEntryId)
        : inferredOwner;
      const ownerHash = owner ? fingerprintText(owner.entryId) : null;
      const sameOwnerSources = owner ? internalSource.filter((source) => (
        source.internalOwningEntryId === owner.entryId
        && source.canonicalMaterialCategories.includes(canonicalCategory)
      )) : [];
      const validSources = sameOwnerSources.filter((source) => (
        source.sourceFactEntryOwnershipPassed
        && Boolean(source.sourceFactHash)
        && Boolean(source.sourceFactIdHash)
        && source.authorityPhase === 'immutable_source_fact'
      ));
      const authorityMatchPassed = validSources.length > 0;
      const unsupportedReason = authorityMatchPassed
        ? null
        : !owner
          ? 'final_unit_owner_missing' as const
          : sameOwnerSources.length > 0
            ? 'source_authority_provenance_missing_or_contradictory' as const
            : 'owner_matching_source_authority_missing' as const;
      return {
        canonicalCategory,
        finalUnitHash: unitOwnership?.unitHash || fingerprintText(unit),
        finalUnitRoleSlot: unitOwnership?.roleSlot
          || (owner ? (owner.isPresent ? 'current_role' : 'prior_role') : null),
        finalUnitOwningEntryHash: unitOwnership?.owningEntryHash || ownerHash,
        detectedTargetLocale: manifest.locale,
        detectionResult: 'detected' as const,
        authorizingSourceEntryHash: authorityMatchPassed ? ownerHash : null,
        authorizingSourceFactHashes: validSources.map((source) => source.sourceFactHash),
        authorityMatchPassed,
        unsupportedReason,
      };
    })
  ));
  const unsupportedMaterialClaimCount = finalClaimAuthorityEvidence.filter(
    (claim) => !claim.authorityMatchPassed,
  ).length;
  const unsupportedPrintClaimCount = finalClaimAuthorityEvidence.filter((claim) => (
    claim.canonicalCategory === SUMMARY_V2_PRINT_MATERIAL_CATEGORY
    && !claim.authorityMatchPassed
  )).length;
  const result: SummaryV2MaterialAuthorityResult = {
    revision: SUMMARY_V2_MATERIAL_CLAIM_CONTRACT_REVISION,
    detectorRevision: SUMMARY_V2_MATERIAL_CLAIM_DETECTOR_REVISION,
    sourcePrintFactPresent: internalSource.some((source) => (
      source.canonicalMaterialCategories.includes(SUMMARY_V2_PRINT_MATERIAL_CATEGORY)
    )),
    sourcePrintFactPresentScope: 'aggregate_selected_manifest_authority',
    sourceAuthorityEvidence: publicSource,
    finalClaimAuthorityEvidence,
    selectedEntrySourceContentFingerprints:
      buildSelectedEntrySourceContentFingerprints(manifest),
    printClaimDetected: finalClaimAuthorityEvidence.some((claim) => (
      claim.canonicalCategory === SUMMARY_V2_PRINT_MATERIAL_CATEGORY
    )),
    unsupportedPrintClaimCount,
    unsupportedMaterialClaimCount,
    invariantPassed: true,
    invariantFailureReasons: [],
  };
  const invariant = validateSummaryV2MaterialAuthorityProvenance(result);
  return {
    ...result,
    invariantPassed: invariant.passed,
    invariantFailureReasons: invariant.failureReasons,
  };
}

export type SummaryV2PrintClaimAudit = SummaryV2MaterialAuthorityResult & {
  claimCategory: typeof SUMMARY_V2_PRINT_MATERIAL_CATEGORY;
  unsupportedOwningEntryIds: string[];
};

/** Migration-safe wrapper; the aggregate legacy fields are derived from the canonical audit. */
export function auditSummaryV2PrintClaims(
  text: string,
  manifest: SummaryV2SelectionManifest,
  finalUnitOwnership: SummaryV2FinalUnitOwnershipEvidence[] = [],
): SummaryV2PrintClaimAudit {
  const result = auditSummaryV2MaterialClaims(text, manifest, finalUnitOwnership);
  return {
    ...result,
    claimCategory: SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
    unsupportedOwningEntryIds: result.finalClaimAuthorityEvidence
      .filter((claim) => (
        claim.canonicalCategory === SUMMARY_V2_PRINT_MATERIAL_CATEGORY
        && !claim.authorityMatchPassed
      ))
      .map((claim) => claim.finalUnitOwningEntryHash || 'unowned'),
  };
}
