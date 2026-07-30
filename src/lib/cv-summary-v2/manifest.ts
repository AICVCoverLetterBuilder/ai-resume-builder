import { SUMMARY_V2_REVISION } from './flag';
import { hashSummaryV2Text } from './facts';
import type {
  SummaryV2EntryFact,
  SummaryV2EntryOwned,
  SummaryV2SelectionManifest,
  SummaryV2Snapshot,
} from './types';

/** Max duties required per selected entry (3/3 for the acceptance fixture). */
export const SUMMARY_V2_MAX_DUTIES_PER_ENTRY = 3;

/** Max prior completed roles selected into the Summary (current always preferred). */
export const SUMMARY_V2_MAX_PRIOR_ENTRIES = 2;

function selectRequiredFacts(entry: SummaryV2EntryOwned): SummaryV2EntryFact[] {
  return entry.facts
    .slice(0, SUMMARY_V2_MAX_DUTIES_PER_ENTRY)
    .map((f) => ({ ...f }));
}

/**
 * Deterministic selection manifest — single source of truth for provider,
 * repair, deterministic fallback, and validators.
 */
export function buildSummaryV2SelectionManifest(
  snapshot: SummaryV2Snapshot,
): SummaryV2SelectionManifest {
  const entries = snapshot.entries.filter((e) => e.entryId || e.role || e.employer || e.facts.length);
  const current = entries.find((e) => e.isPresent) || entries[0] || null;
  const priors = entries
    .filter((e) => current && e.entryId !== current.entryId)
    .filter((e) => !e.isPresent || entries.filter((x) => x.isPresent).length > 1)
    .slice(0, SUMMARY_V2_MAX_PRIOR_ENTRIES);

  // Prefer completed priors; if only present leftovers remain, skip them.
  const completedPriors = priors.filter((e) => !e.isPresent);
  const selectedPriors = (completedPriors.length ? completedPriors : priors)
    .slice(0, SUMMARY_V2_MAX_PRIOR_ENTRIES);

  const requiredCurrentFacts = current ? selectRequiredFacts(current) : [];
  const requiredPriorFacts = selectedPriors.flatMap((e) => selectRequiredFacts(e));

  const snapshotHash = hashSummaryV2Text(
    [
      snapshot.referenceDateIso,
      snapshot.locale,
      snapshot.totalDurationMonths,
      ...entries.map((e) => [
        e.entryId,
        e.role,
        e.employer,
        e.startDate,
        e.endDate,
        e.employmentState,
        e.descriptionHash,
        ...e.facts.map((f) => f.sourceFactHash),
      ].join('|')),
    ].join('||'),
  );

  return {
    revision: SUMMARY_V2_REVISION,
    snapshotHash,
    locale: snapshot.locale,
    gender: snapshot.gender,
    totalDurationMonths: snapshot.totalDurationMonths,
    durationPhrase: snapshot.durationPhrase,
    styleHintUsed: Boolean(snapshot.styleHintSummary),
    current,
    priors: selectedPriors,
    requiredCurrentFacts,
    requiredPriorFacts,
    maxDutiesPerEntry: SUMMARY_V2_MAX_DUTIES_PER_ENTRY,
  };
}
