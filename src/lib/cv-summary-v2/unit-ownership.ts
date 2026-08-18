import { fingerprintText } from '@/lib/cv-export-diagnostics';
import type {
  SummaryV2CandidateSourceKind,
  SummaryV2EntryOwned,
  SummaryV2FinalUnitOwnershipEvidence,
  SummaryV2SelectionManifest,
} from './types';

export const SUMMARY_V2_ENTRY_OWNED_FINAL_UNITS_REVISION =
  'summary-v2-entry-owned-final-units-420-v1' as const;

export type SummaryV2UnitOwnershipOptions = {
  candidateSource?: SummaryV2CandidateSourceKind;
  /** Deterministic builders preserve current/prior manifest order by construction. */
  preserveConstructionOrder?: boolean;
};

export type SummaryV2UnitOwnershipResult = {
  passed: boolean;
  reason: string | null;
  units: string[];
  evidence: SummaryV2FinalUnitOwnershipEvidence[];
};

function containsExactSurface(unit: string, surface: string): boolean {
  const value = (surface || '').trim();
  if (!value) return true;
  // Some locale builders inflect the final token of a role/employer surface
  // (for example a case suffix on a proper noun). Requiring the complete
  // normalized source surface preserves arbitrary free text while permitting
  // that locale grammar; ambiguity still fails closed below.
  return unit.normalize('NFKC').toLocaleLowerCase()
    .includes(value.normalize('NFKC').toLocaleLowerCase());
}

export function splitSummaryV2FinalUnits(text: string): string[] {
  const split = (text || '')
    .split(/(?<=[.!?。؟।])\s+/u)
    .map((unit) => unit.trim())
    .filter(Boolean);
  // Keep the historical sentence boundaries unchanged except for a date
  // continuation that the base splitter separates at `2023. godine`. It is a
  // modifier of the same Serbian/Croatian role unit, never a second Summary
  // unit. Other locale sentence segmentation retains its established hashes.
  const merged: string[] = [];
  for (const unit of split) {
    const previous = merged[merged.length - 1] || '';
    if (/\b20\d{2}\.$/u.test(previous) && /^(?:godine|godina)\b/iu.test(unit)) {
      merged[merged.length - 1] = `${previous} ${unit}`;
    } else {
      merged.push(unit);
    }
  }
  return merged;
}

function selectedEntries(manifest: SummaryV2SelectionManifest): SummaryV2EntryOwned[] {
  return [...(manifest.current ? [manifest.current] : []), ...manifest.priors];
}

function authorityEntries(manifest: SummaryV2SelectionManifest): SummaryV2EntryOwned[] {
  return manifest.allEntries?.length ? manifest.allEntries : selectedEntries(manifest);
}

function currentMarker(unit: string): boolean {
  return /\b(?:currently|derzeit|actuellement|attualmente|actualmente|atualmente|trenutno)\b/iu
    .test(unit)
    || ['сейчас', 'حاليا', 'حاليًا', 'वर्तमान', '現在', '現職', 'أعمل'].some(
      (marker) => unit.toLocaleLowerCase().includes(marker.toLocaleLowerCase()),
    );
}

function priorMarker(unit: string): boolean {
  return /\b(?:previously|formerly|zuvor|anteriormente|auparavant|in\s+precedenza|prethodno|ranije|before\s+that)\b/iu
    .test(unit)
    || ['ранее', 'سابقا', 'سابقًا', 'इससे पहले', 'पहले', '以前', '前職'].some(
      (marker) => unit.toLocaleLowerCase().includes(marker.toLocaleLowerCase()),
    );
}

function evidenceFor(options: {
  unit: string;
  unitIndex: number;
  entry: SummaryV2EntryOwned | null;
  manifest: SummaryV2SelectionManifest;
}): SummaryV2FinalUnitOwnershipEvidence {
  const priorIndex = options.entry
    ? options.manifest.priors.findIndex((entry) => entry.entryId === options.entry!.entryId)
    : -1;
  return {
    unitIndex: options.unitIndex,
    unitHash: fingerprintText(options.unit),
    roleSlot: options.entry
      ? (options.manifest.current?.entryId === options.entry.entryId ? 'current_role' : 'prior_role')
      : 'duration',
    owningEntryId: options.entry?.entryId || null,
    owningEntryHash: options.entry ? fingerprintText(options.entry.entryId) : null,
    priorOrdinal: priorIndex >= 0 ? priorIndex + 1 : null,
    roleTitleOwnerEntryHash: options.entry ? fingerprintText(options.entry.entryId) : null,
    employerOwnerEntryHash: options.entry ? fingerprintText(options.entry.entryId) : null,
    dateStatusOwnerEntryHash: null,
    dutyFactOwnerEntryHashes: options.entry ? [fingerprintText(options.entry.entryId)] : [],
    relationalOwnershipPassed: true,
    relationalOwnershipFailureReasons: [],
  };
}

const MONTH_SURFACES: readonly string[][] = [
  ['january', 'januar', 'januara', 'januar', 'janvier', 'gennaio', 'enero', 'janeiro', 'январ', 'يناير', 'जनवरी', '1'],
  ['february', 'februar', 'februara', 'février', 'fevrier', 'febbraio', 'febrero', 'fevereiro', 'феврал', 'فبراير', 'फरवरी', '2'],
  ['march', 'märz', 'maerz', 'marta', 'ožujak', 'ozujak', 'mars', 'marzo', 'março', 'marco', 'март', 'مارس', 'मार्च', '3'],
  ['april', 'aprila', 'travanj', 'avril', 'aprile', 'abril', 'апрел', 'أبريل', 'अप्रैल', '4'],
  ['may', 'mai', 'maja', 'svibanj', 'maggio', 'mayo', 'maio', 'май', 'مايو', 'मई', '5'],
  ['june', 'juni', 'juna', 'lipanj', 'juin', 'giugno', 'junio', 'junho', 'июн', 'يونيو', 'जून', '6'],
  ['july', 'juli', 'jula', 'srpanj', 'juillet', 'luglio', 'julio', 'julho', 'июл', 'يوليو', 'जुलाई', '7'],
  ['august', 'avgust', 'kolovoz', 'août', 'aout', 'agosto', 'август', 'أغسطس', 'अगस्त', '8'],
  ['september', 'septembar', 'rujan', 'septembre', 'settembre', 'septiembre', 'setembro', 'сентябр', 'سبتمبر', 'सितंबर', '9'],
  ['october', 'oktober', 'listopad', 'octobre', 'ottobre', 'octubre', 'outubro', 'октябр', 'أكتوبر', 'अक्टूबर', '10'],
  ['november', 'novembar', 'studeni', 'novembre', 'noviembre', 'novembro', 'ноябр', 'نوفمبر', 'नवंबर', '11'],
  ['december', 'decembar', 'prosinac', 'décembre', 'decembre', 'dicembre', 'diciembre', 'dezembro', 'декабр', 'ديسمبر', 'दिसंबर', '12'],
];

function explicitStartDatePresent(unit: string, entry: SummaryV2EntryOwned): boolean {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/u.exec((entry.startDate || '').trim());
  if (!match) return false;
  const [, year, monthRaw] = match;
  const month = Number(monthRaw);
  const normalized = unit.normalize('NFKC').toLocaleLowerCase();
  if (new RegExp(`\\b${year}-${monthRaw}\\b|\\b${monthRaw}[./-]${year}\\b`, 'u').test(normalized)) {
    return true;
  }
  const monthSurfaces = MONTH_SURFACES[month - 1] || [];
  return monthSurfaces.some((surface) => {
    if (!surface || surface.length < 2) return false;
    return normalized.includes(surface.toLocaleLowerCase())
      && normalized.includes(year);
  });
}

function normalizedSurface(value: string): string {
  return (value || '').normalize('NFKC').toLocaleLowerCase().trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function standaloneSurfaceOccurrenceCount(text: string, surface: string): number {
  const haystack = normalizedSurface(text);
  const needle = normalizedSurface(surface);
  if (!needle) return 0;
  // Employer ownership needs a lexical entity surface, not a substring of an
  // unrelated title (for example "RadWerk" inside "Fahrradwerkstatt").
  // Keep punctuation and multi-word employers intact while requiring that the
  // surrounding characters are not letters or digits.
  const matcher = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(needle)}(?=$|[^\\p{L}\\p{N}])`, 'giu');
  return [...haystack.matchAll(matcher)].length;
}

function foreignEmployerAttached(unit: string, ownerEmployer: string, foreignEmployer: string): boolean {
  if (standaloneSurfaceOccurrenceCount(unit, foreignEmployer) === 0) return false;
  const owner = normalizedSurface(ownerEmployer);
  const foreign = normalizedSurface(foreignEmployer);
  // A distinct historic employer can be a lexical prefix of the selected
  // employer (for example “Rewitu” / “Rewitu Current Test”). One embedded
  // occurrence is then owned by the selected employer; a second is a splice.
  return !owner.includes(foreign)
    || standaloneSurfaceOccurrenceCount(unit, foreignEmployer)
      > standaloneSurfaceOccurrenceCount(ownerEmployer, foreignEmployer);
}

function sameFactSurface(a: string, b: string): boolean {
  return normalizedSurface(a).replace(/[.!?。؟।]+$/u, '')
    === normalizedSurface(b).replace(/[.!?。؟।]+$/u, '');
}

function foreignFactSurfaceAttached(
  unit: string,
  foreignFact: SummaryV2EntryOwned['facts'][number],
  ownerFacts: SummaryV2EntryOwned['facts'],
): boolean {
  // Identical responsibilities at two employers are semantically equivalent,
  // not a cross-entry claim. A unique foreign fact must have actual surface
  // evidence; the broad aggregate coverage matcher is deliberately too loose
  // for this relational assertion.
  if (ownerFacts.some((ownFact) => (
    ownFact.sourceFactHash === foreignFact.sourceFactHash
    || sameFactSurface(ownFact.bulletText, foreignFact.bulletText)
  ))) return false;
  const raw = normalizedSurface(foreignFact.presentationText || foreignFact.bulletText)
    .replace(/[.!?。؟।]+$/u, '');
  if (raw.length >= 8 && normalizedSurface(unit).includes(raw)) return true;
  // Do not use the generic fact-coverage matcher here: its intentional
  // predicate/paraphrase tolerance can confuse shared verbs across different
  // entries. Relational rejection requires an explicit immutable fact clause
  // from the other entry (or its validated target presentation) in this unit.
  return false;
}

/**
 * A role unit is valid only when every expressed employer/date/duty relation
 * has the same entry owner as its role slot.  Aggregate fact coverage is not
 * sufficient: two valid entries may otherwise be grammatically spliced.
 */
function relationalEvidenceFor(options: {
  evidence: SummaryV2FinalUnitOwnershipEvidence;
  unit: string;
  entry: SummaryV2EntryOwned | null;
  manifest: SummaryV2SelectionManifest;
}): SummaryV2FinalUnitOwnershipEvidence {
  const { evidence, unit, entry, manifest } = options;
  if (!entry) return evidence;
  const ownerHash = fingerprintText(entry.entryId);
  const entries = authorityEntries(manifest);
  const failures: string[] = [];
  const ownDatePresent = explicitStartDatePresent(unit, entry);

  for (const other of entries) {
    if (other.entryId === entry.entryId) continue;
    if (other.employer && foreignEmployerAttached(unit, entry.employer, other.employer)) {
      failures.push('foreign_employer_attached_to_role_unit');
    }
    // A different role title is evidence of an entry splice. Identical titles
    // remain intentionally ambiguous and are disambiguated by employer/date.
    if (
      other.role
      && other.role.normalize('NFKC').toLocaleLowerCase()
        !== entry.role.normalize('NFKC').toLocaleLowerCase()
      && standaloneSurfaceOccurrenceCount(unit, other.role) > 0
    ) {
      failures.push('foreign_role_title_attached_to_role_unit');
    }
    // A role unit may contain its own date only.  A second, foreign date is
    // still a splice even if the owner date was also retained.
    if (other.startDate !== entry.startDate && explicitStartDatePresent(unit, other)) {
      failures.push('foreign_start_date_attached_to_role_unit');
    }
    for (const foreignFact of other.facts) {
      if (foreignFactSurfaceAttached(
        unit,
        foreignFact,
        entry.facts,
      )) {
        failures.push('foreign_duty_fact_attached_to_role_unit');
      }
    }
  }

  return {
    ...evidence,
    roleTitleOwnerEntryHash: ownerHash,
    employerOwnerEntryHash: ownerHash,
    dateStatusOwnerEntryHash: ownDatePresent ? ownerHash : null,
    dutyFactOwnerEntryHashes: [ownerHash],
    relationalOwnershipPassed: failures.length === 0,
    relationalOwnershipFailureReasons: [...new Set(failures)],
  };
}

function withRelationalOwnership(
  result: SummaryV2UnitOwnershipResult,
  manifest: SummaryV2SelectionManifest,
): SummaryV2UnitOwnershipResult {
  const evidence = result.evidence.map((item) => relationalEvidenceFor({
    evidence: item,
    unit: result.units[item.unitIndex] || '',
    entry: item.owningEntryId
      ? selectedEntries(manifest).find((entry) => entry.entryId === item.owningEntryId) || null
      : null,
    manifest,
  }));
  const failed = evidence.find((item) => !item.relationalOwnershipPassed);
  return failed
    ? {
      passed: false,
      reason: failed.relationalOwnershipFailureReasons[0] || 'relational_ownership_failed',
      units: result.units,
      evidence,
    }
    : { ...result, evidence };
}

function unitCandidateScore(
  unit: string,
  entry: SummaryV2EntryOwned,
  manifest: SummaryV2SelectionManifest,
): number | null {
  if (!containsExactSurface(unit, entry.role)) return null;
  if (entry.employer && !containsExactSurface(unit, entry.employer)) return null;
  let score = entry.role.trim().length + entry.employer.trim().length;
  const isCurrent = manifest.current?.entryId === entry.entryId;
  if (isCurrent && currentMarker(unit)) score += 10_000;
  if (!isCurrent && priorMarker(unit)) score += 10_000;
  if (isCurrent && priorMarker(unit) && !currentMarker(unit)) score -= 10_000;
  if (!isCurrent && currentMarker(unit) && !priorMarker(unit)) score -= 10_000;
  return score;
}

/**
 * Assign final role units before coverage. Provider candidates require unique
 * source-bound role/employer/slot evidence. Deterministic builders may use the
 * immutable manifest order, but must still contain the corresponding surfaces.
 */
export function analyzeSummaryV2FinalUnitOwnership(
  text: string,
  manifest: SummaryV2SelectionManifest,
  options: SummaryV2UnitOwnershipOptions = {},
): SummaryV2UnitOwnershipResult {
  void SUMMARY_V2_ENTRY_OWNED_FINAL_UNITS_REVISION;
  const units = splitSummaryV2FinalUnits(text);
  const entries = selectedEntries(manifest);
  const durationRequired = manifest.totalDurationMonths > 0;
  const standaloneDurationCount = durationRequired && units.length === entries.length + 1 ? 1 : 0;
  const durationIntegratedIntoRoleUnit = durationRequired && units.length === entries.length;
  if (units.length !== entries.length + standaloneDurationCount
    || (durationRequired && !standaloneDurationCount && !durationIntegratedIntoRoleUnit)) {
    return { passed: false, reason: 'final_unit_count_mismatch', units, evidence: [] };
  }

  const deterministicOrder = options.preserveConstructionOrder === true
    || options.candidateSource === 'deterministic';
  if (deterministicOrder) {
    const evidence: SummaryV2FinalUnitOwnershipEvidence[] = [];
    let roleOffset = 0;
    if (standaloneDurationCount === 1) {
      evidence.push(evidenceFor({ unit: units[0]!, unitIndex: 0, entry: null, manifest }));
      roleOffset = 1;
    }
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]!;
      const unitIndex = index + roleOffset;
      const unit = units[unitIndex]!;
      if (unitCandidateScore(unit, entry, manifest) === null) {
        return {
          passed: false,
          reason: 'deterministic_unit_entry_surface_mismatch',
          units,
          evidence,
        };
      }
      evidence.push(evidenceFor({ unit, unitIndex, entry, manifest }));
    }
    return withRelationalOwnership({ passed: true, reason: null, units, evidence }, manifest);
  }

  const assignedEntryIds = new Set<string>();
  const evidence: SummaryV2FinalUnitOwnershipEvidence[] = [];
  const unassignedUnitIndexes: number[] = [];
  for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
    const unit = units[unitIndex]!;
    const scored = entries
      .map((entry) => ({ entry, score: unitCandidateScore(unit, entry, manifest) }))
      .filter((candidate): candidate is { entry: SummaryV2EntryOwned; score: number } => (
        candidate.score !== null
      ))
      .sort((a, b) => b.score - a.score);
    if (scored.length === 0) {
      unassignedUnitIndexes.push(unitIndex);
      continue;
    }
    const best = scored[0]!;
    if (scored[1]?.score === best.score) {
      return { passed: false, reason: 'final_unit_entry_ownership_ambiguous', units, evidence };
    }
    if (assignedEntryIds.has(best.entry.entryId)) {
      return { passed: false, reason: 'duplicate_final_unit_for_entry', units, evidence };
    }
    assignedEntryIds.add(best.entry.entryId);
    evidence.push(evidenceFor({ unit, unitIndex, entry: best.entry, manifest }));
  }

  if (unassignedUnitIndexes.length !== standaloneDurationCount) {
    return { passed: false, reason: 'unowned_final_role_unit', units, evidence };
  }
  if (standaloneDurationCount === 1) {
    const durationIndex = unassignedUnitIndexes[0]!;
    evidence.push(evidenceFor({
      unit: units[durationIndex]!, unitIndex: durationIndex, entry: null, manifest,
    }));
  }
  if (assignedEntryIds.size !== entries.length) {
    return { passed: false, reason: 'selected_entry_final_unit_missing', units, evidence };
  }
  evidence.sort((a, b) => a.unitIndex - b.unitIndex);
  return withRelationalOwnership({ passed: true, reason: null, units, evidence }, manifest);
}
