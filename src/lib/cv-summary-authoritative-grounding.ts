/**
 * AAB-356 — One authoritative entry-owned Summary grounding acceptance record.
 *
 * Locale-specific and occupation-key checkers are enrichment only. They must not
 * override a complete entry-owned coverage record with a different fact set.
 */
export const SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION =
  'summary-authoritative-grounding-356-v1' as const;
export const SUMMARY_MATERIAL_FACT_UNIVERSAL_356_REVISION =
  'summary-material-fact-universal-356-v1' as const;
export const GERMAN_SUMMARY_AUTHORITATIVE_ACCEPT_356_REVISION =
  'german-summary-authoritative-accept-356-v1' as const;

void SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION;
void SUMMARY_MATERIAL_FACT_UNIVERSAL_356_REVISION;
void GERMAN_SUMMARY_AUTHORITATIVE_ACCEPT_356_REVISION;

export type AuthoritativeEntryFactRecord = {
  entryId: string | null;
  entryIdHash: string | null;
  employer: string;
  role: string;
  isPresent: boolean;
  /** Structured employment dates from the immutable Experience snapshot. */
  startDate: string;
  endDate: string;
  employmentState: 'present' | 'completed';
  /** Canonical fact IDs when a classifier exists. */
  canonicalFactIds: string[];
  /** Generic normalized duty evidence when no classifier exists. */
  genericDutyEvidence: string[];
  requiredFactIds: string[];
  coveredFactIds: string[];
  missingFactIds: string[];
};

export type AuthoritativeSummaryGroundingRecord = {
  revision: typeof SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION;
  selectedExperienceEntryIds: string[];
  factsByEntry: AuthoritativeEntryFactRecord[];
  requiredFactsByEntry: Record<string, string[]>;
  coveredFactsByEntry: Record<string, string[]>;
  missingFactsByEntry: Record<string, string[]>;
  unsupportedClaims: string[];
  crossEntryLeakageDetected: boolean;
  accepted: boolean;
  typedRejectionReasons: string[];
  /** Occupation-specific material keys are enrichment only — never sole authority. */
  occupationMaterialKeysEnrichmentOnly: true;
  conflictingSecondaryFactIds: string[];
  conflictingSourceEntryHash: string | null;
};

export type GermanAuthoritativeGroundingInput = {
  groundingValidationPassed: boolean;
  slotValidationPassed: boolean;
  requiredCurrentDutyFactIds?: string[];
  coveredCurrentDutyFactCount?: number;
  requiredCurrentDutyFactCount?: number;
  missingCurrentDutyFactCount?: number;
  missingCurrentDutyFactIdHashes?: string[];
  requiredPriorDutyFactCount?: number;
  coveredPriorDutyFactCount?: number;
  missingPriorDutyFactCount?: number;
  unsupportedClaimCount?: number;
  unsupportedClaimKinds?: string[];
  employerCrossEntryLeakageDetected?: boolean;
  typedRejectionReason?: string | null;
  currentEntryId?: string | null;
  priorEntryId?: string | null;
  currentEntryIdHash?: string | null;
  priorEntryIdHash?: string | null;
  currentEmployer?: string;
  priorEmployer?: string;
  currentRole?: string;
  priorRole?: string;
  currentIsPresent?: boolean;
  currentStartDate?: string;
  currentEndDate?: string;
  priorStartDate?: string;
  priorEndDate?: string;
  genericCurrentDutyEvidence?: string[];
  genericPriorDutyEvidence?: string[];
};

/**
 * Build the immutable final grounding record from German empQ (or equivalent).
 * Secondary occupation-key material checkers must consult this record — not
 * invent a parallel mandatory fact set.
 */
export function buildGermanAuthoritativeGroundingRecord(
  input: GermanAuthoritativeGroundingInput,
): AuthoritativeSummaryGroundingRecord {
  void SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION;
  void GERMAN_SUMMARY_AUTHORITATIVE_ACCEPT_356_REVISION;

  const requiredCurrent = [...(input.requiredCurrentDutyFactIds || [])];
  const missingCount = Number(input.missingCurrentDutyFactCount || 0);
  const coveredCount = Number(input.coveredCurrentDutyFactCount || 0);
  const requiredCount = Number(input.requiredCurrentDutyFactCount || requiredCurrent.length || 0);
  const coveredCurrent = missingCount > 0 && requiredCurrent.length
    ? requiredCurrent.slice(0, Math.max(0, coveredCount))
    : (requiredCount > 0 && coveredCount >= requiredCount ? requiredCurrent : requiredCurrent.slice(0, coveredCount));
  const missingCurrent = requiredCurrent.filter((id) => !coveredCurrent.includes(id));
  // Prefer count-derived missing when IDs are incomplete but coverage failed.
  const missingCurrentFinal = missingCurrent.length
    ? missingCurrent
    : (missingCount > 0
      ? (input.missingCurrentDutyFactIdHashes || []).map((h) => `hash:${h}`)
      : []);

  const requiredPrior = Number(input.requiredPriorDutyFactCount || 0);
  const coveredPrior = Number(input.coveredPriorDutyFactCount || 0);
  const missingPriorCount = Number(input.missingPriorDutyFactCount || 0);
  const priorIds = requiredPrior > 0
    ? Array.from({ length: requiredPrior }, (_, i) => `prior_duty_${i + 1}`)
    : [];
  const coveredPriorIds = priorIds.slice(0, coveredPrior);
  const missingPriorIds = missingPriorCount > 0
    ? priorIds.slice(coveredPrior)
    : [];

  const currentId = input.currentEntryId || null;
  const priorId = input.priorEntryId || null;
  const selected = [currentId, priorId].filter(Boolean) as string[];

  const factsByEntry: AuthoritativeEntryFactRecord[] = [];
  if (currentId || requiredCurrent.length || (input.genericCurrentDutyEvidence || []).length) {
    factsByEntry.push({
      entryId: currentId,
      entryIdHash: input.currentEntryIdHash || null,
      employer: input.currentEmployer || '',
      role: input.currentRole || '',
      isPresent: input.currentIsPresent !== false,
      startDate: input.currentStartDate || '',
      endDate: input.currentEndDate || '',
      employmentState: input.currentIsPresent === false ? 'completed' : 'present',
      canonicalFactIds: requiredCurrent,
      genericDutyEvidence: [...(input.genericCurrentDutyEvidence || [])],
      requiredFactIds: requiredCurrent.length
        ? requiredCurrent
        : [...(input.genericCurrentDutyEvidence || [])],
      coveredFactIds: requiredCurrent.length
        ? coveredCurrent
        : [...(input.genericCurrentDutyEvidence || [])],
      missingFactIds: missingCurrentFinal,
    });
  }
  if (priorId || requiredPrior > 0 || (input.genericPriorDutyEvidence || []).length) {
    factsByEntry.push({
      entryId: priorId,
      entryIdHash: input.priorEntryIdHash || null,
      employer: input.priorEmployer || '',
      role: input.priorRole || '',
      isPresent: false,
      startDate: input.priorStartDate || '',
      endDate: input.priorEndDate || '',
      employmentState: 'completed',
      canonicalFactIds: priorIds,
      genericDutyEvidence: [...(input.genericPriorDutyEvidence || [])],
      requiredFactIds: priorIds.length
        ? priorIds
        : [...(input.genericPriorDutyEvidence || [])],
      coveredFactIds: coveredPriorIds.length
        ? coveredPriorIds
        : [...(input.genericPriorDutyEvidence || [])],
      missingFactIds: missingPriorIds,
    });
  }

  const requiredFactsByEntry: Record<string, string[]> = {};
  const coveredFactsByEntry: Record<string, string[]> = {};
  const missingFactsByEntry: Record<string, string[]> = {};
  for (const row of factsByEntry) {
    const key = row.entryIdHash || row.entryId || 'entry';
    requiredFactsByEntry[key] = [...row.requiredFactIds];
    coveredFactsByEntry[key] = [...row.coveredFactIds];
    missingFactsByEntry[key] = [...row.missingFactIds];
  }

  const unsupported = [...(input.unsupportedClaimKinds || [])];
  const typed: string[] = [];
  if (input.typedRejectionReason) typed.push(input.typedRejectionReason);
  for (const id of missingCurrentFinal) {
    typed.push(`missing_entry_fact:${id}`);
  }
  for (const id of missingPriorIds) {
    typed.push(`missing_entry_fact:${id}`);
  }

  const accepted = Boolean(
    input.groundingValidationPassed
    && input.slotValidationPassed
    && missingCurrentFinal.length === 0
    && missingPriorIds.length === 0
    && Number(input.unsupportedClaimCount || 0) === 0
    && !input.employerCrossEntryLeakageDetected,
  );

  return {
    revision: SUMMARY_AUTHORITATIVE_GROUNDING_356_REVISION,
    selectedExperienceEntryIds: selected,
    factsByEntry,
    requiredFactsByEntry,
    coveredFactsByEntry,
    missingFactsByEntry,
    unsupportedClaims: unsupported,
    crossEntryLeakageDetected: Boolean(input.employerCrossEntryLeakageDetected),
    accepted,
    typedRejectionReasons: accepted ? [] : [...new Set(typed.filter(Boolean))],
    occupationMaterialKeysEnrichmentOnly: true,
    conflictingSecondaryFactIds: [],
    conflictingSourceEntryHash: null,
  };
}

/**
 * Secondary occupation-key / shared material gate may add a rejection only when
 * it names a concrete fact absent from the authoritative coverage record.
 */
export function secondaryMaterialRejectionAllowed(options: {
  authoritative: AuthoritativeSummaryGroundingRecord | null | undefined;
  secondaryMissingFactIds: string[];
}): { allowed: boolean; exactMissingFactIds: string[]; conflictingSourceEntryHash: string | null } {
  void SUMMARY_MATERIAL_FACT_UNIVERSAL_356_REVISION;
  const auth = options.authoritative;
  if (!auth) {
    return {
      allowed: true,
      exactMissingFactIds: [...options.secondaryMissingFactIds],
      conflictingSourceEntryHash: null,
    };
  }
  if (!auth.accepted) {
    return {
      allowed: true,
      exactMissingFactIds: [...options.secondaryMissingFactIds],
      conflictingSourceEntryHash: auth.factsByEntry[0]?.entryIdHash || null,
    };
  }
  const authoritativeAll = new Set(
    auth.factsByEntry.flatMap((e) => e.requiredFactIds),
  );
  const coveredAll = new Set(
    auth.factsByEntry.flatMap((e) => e.coveredFactIds),
  );
  // Exact missing facts relative to the authoritative required set.
  const exact = options.secondaryMissingFactIds.filter((id) => (
    authoritativeAll.has(id) && !coveredAll.has(id)
  ));
  if (exact.length) {
    return {
      allowed: true,
      exactMissingFactIds: exact,
      conflictingSourceEntryHash: auth.factsByEntry.find((e) => e.missingFactIds.length)?.entryIdHash
        || auth.factsByEntry[0]?.entryIdHash
        || null,
    };
  }
  // Occupation-key-only misses that are not in the authoritative set cannot override.
  return {
    allowed: false,
    exactMissingFactIds: [],
    conflictingSourceEntryHash: auth.factsByEntry[0]?.entryIdHash || null,
  };
}

/** Multilingual warehouse/design domain cue — include candidate text. */
export function isGermanStructuredSummaryDomain(corpus: string): boolean {
  void GERMAN_SUMMARY_AUTHORITATIVE_ACCEPT_356_REVISION;
  return /(?:lager|warehouse|waren|wareneingang|grafik|design|visuell|مستودع|بضائع|وثائق|تصميم|جرافيك|مواد\s*بصرية|गोदाम|माल|magacin|skladišt|товар|склад|倉庫|商品|almac[eé]n|mercanc[ií]a|dise[nñ]o)/iu
    .test(corpus || '');
}
