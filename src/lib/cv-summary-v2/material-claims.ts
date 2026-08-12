import type { Locale } from '@/lib/i18n/translations';
import type {
  SummaryV2EntryOwned,
  SummaryV2FinalUnitOwnershipEvidence,
  SummaryV2MaterialClaimCategory,
  SummaryV2SelectionManifest,
} from './types';
import { SUMMARY_V2_PRINT_MATERIAL_CATEGORY } from './types';
import { splitSummaryV2FinalUnits } from './unit-ownership';

export const SUMMARY_V2_MATERIAL_CLAIM_CONTRACT_REVISION =
  'summary-v2-entry-owned-material-claims-420-v1' as const;

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

function entryOwnsCategory(
  entry: SummaryV2EntryOwned,
  category: SummaryV2MaterialClaimCategory,
): boolean {
  return entry.facts.some((fact) => (
    fact.sourceMaterialClaimCategories?.includes(category)
    || (category === SUMMARY_V2_PRINT_MATERIAL_CATEGORY && fact.sourcePrintFactPresent === true)
  ));
}

export type SummaryV2PrintClaimAudit = {
  claimCategory: typeof SUMMARY_V2_PRINT_MATERIAL_CATEGORY;
  printClaimDetected: boolean;
  sourcePrintFactPresent: boolean;
  unsupportedPrintClaimCount: number;
  unsupportedOwningEntryIds: string[];
};

/**
 * A print-medium claim is authorized only by the source fact authority of the
 * Experience entry assigned to that final unit. The validator always supplies
 * pre-computed unit ownership; the fallback exists for direct audit callers.
 */
export function auditSummaryV2PrintClaims(
  text: string,
  manifest: SummaryV2SelectionManifest,
  finalUnitOwnership: SummaryV2FinalUnitOwnershipEvidence[] = [],
): SummaryV2PrintClaimAudit {
  void SUMMARY_V2_MATERIAL_CLAIM_CONTRACT_REVISION;
  const units = splitSummaryV2FinalUnits(text);
  const entries = selectedEntries(manifest);
  const byId = new Map(entries.map((entry) => [entry.entryId, entry]));
  const evidenceByIndex = new Map(finalUnitOwnership.map((evidence) => [
    evidence.unitIndex,
    evidence,
  ]));
  const unsupported = new Set<string>();
  let claimUnitCount = 0;
  const sourcePrintFactPresent = entries.some((entry) => (
    entryOwnsCategory(entry, SUMMARY_V2_PRINT_MATERIAL_CATEGORY)
  ));

  units.forEach((unit, unitIndex) => {
    if (!detectPrintMediumClaim(unit, manifest.locale)) return;
    claimUnitCount += 1;
    const evidence = evidenceByIndex.get(unitIndex);
    let owner = evidence?.owningEntryId ? byId.get(evidence.owningEntryId) : undefined;
    if (!owner && finalUnitOwnership.length === 0) {
      const folded = unit.toLocaleLowerCase();
      const employerOwners = entries.filter((entry) => (
        entry.employer && folded.includes(entry.employer.toLocaleLowerCase())
      ));
      const roleOwners = entries.filter((entry) => (
        entry.role && folded.includes(entry.role.toLocaleLowerCase())
      ));
      const inferred = employerOwners.length > 0 ? employerOwners : roleOwners;
      owner = inferred.length === 1 ? inferred[0] : undefined;
    }
    if (!owner) {
      unsupported.add('unowned');
      return;
    }
    if (!entryOwnsCategory(owner, SUMMARY_V2_PRINT_MATERIAL_CATEGORY)) {
      unsupported.add(owner.entryId);
      return;
    }
  });

  return {
    claimCategory: SUMMARY_V2_PRINT_MATERIAL_CATEGORY,
    printClaimDetected: claimUnitCount > 0,
    sourcePrintFactPresent,
    unsupportedPrintClaimCount: unsupported.size > 0 ? claimUnitCount : 0,
    unsupportedOwningEntryIds: [...unsupported],
  };
}
