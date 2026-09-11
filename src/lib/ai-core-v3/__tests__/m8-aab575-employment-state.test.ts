import { describe, expect, it } from 'vitest';
import {
  createSummaryV3StyleOperationSnapshot,
  hashSummaryV3StyleValue,
  normalizeSummaryV3StyleText,
  type SummaryV3StyleRequest,
  type SummaryV3StyleOperationSnapshot,
} from '../summary-style-m5';
import {
  employmentStateContradictionClass,
  employmentStateContradictionDecision,
  hasEmploymentStateContradiction,
} from '../summary-style-m5-server';

const role = 'Servicetechniker Elektrotechnik';
const rolePresentation = 'Electrical Service Technician';
const employer = 'NordWerk Elektroservice Test';
const currentFrame = `I currently work as an ${rolePresentation} at ${employer}`;
const formerFrame = `I formerly worked as an ${rolePresentation} at ${employer}`;
const currentSource = `${currentFrame}, where I carry out maintenance work on electrical systems, locate and resolve faults in electrical systems, and support the installation of electrical components.`;

const PRIOR_STATE_MARKERS = /(?:former|previous|past|completed|ehemalig(?:e|er|es|en)?|früher|bivš\w*|prethod\w*|पूर्व|सابق|前職|以前)/iu;
const CURRENT_STATE_MARKERS = /(?:current(?:ly)?|present|ongoing|aktuell(?:e|er|es|en)?|trenutn\w*|वर्तमान|حالي(?:ة|ا)?|現在)/iu;

function snapshotFor(
  visibleSummary: string,
  employmentState: 'present' | 'completed' = 'present',
  options: { operation?: string; entries?: SummaryV3StyleRequest['manifest']['entries']; currentRoleEntryId?: string | null } = {},
): SummaryV3StyleOperationSnapshot {
  const entries = options.entries || [{
    stableId: 'entry-current',
    role,
    employer,
    roleSourceLocale: 'de',
    rolePresentation: {
      text: rolePresentation,
      sourceLocale: 'de',
      targetLocale: 'en',
      sourceRoleHash: hashSummaryV3StyleValue(role),
      provenance: 'validated_export_title_surface',
    },
    employmentState,
    durationMonths: 36,
    facts: [
      { id: 'duty-maintenance', text: 'carry out maintenance work on electrical systems' },
      { id: 'duty-faults', text: 'locate and resolve faults in electrical systems' },
      { id: 'duty-installation', text: 'support the installation of electrical components' },
    ],
  }];
  const request: SummaryV3StyleRequest = {
    enabled: true,
    operation: options.operation || 'summary_stronger',
    operationId: `m8-aab575-employment-state-${visibleSummary.length}-${employmentState}`,
    style: 'stronger',
    requestedLocale: 'en',
    sourceLocale: 'en',
    visibleSummary,
    manifest: {
      manifestId: 'm8-aab575-manifest',
      contextId: 'm8-aab575-context',
      sourceLocale: 'en',
      currentRoleEntryId: options.currentRoleEntryId === undefined
        ? (employmentState === 'present' ? 'entry-current' : null)
        : options.currentRoleEntryId,
      entries,
    },
    createdAt: 1_757_590_000_000 + visibleSummary.length,
  };
  return createSummaryV3StyleOperationSnapshot(request);
}

function clauses(value: string): readonly string[] {
  return normalizeSummaryV3StyleText(value)
    .split(/(?<=[.!?。！？।])\s*|(?<=\.)\s+(?=\S)|[,;:，、؛]/u)
    .filter(Boolean);
}

function surfacePresent(surface: string, value: string): boolean {
  return normalizeSummaryV3StyleText(value).toLocaleLowerCase()
    .includes(normalizeSummaryV3StyleText(surface).toLocaleLowerCase());
}

/** Test-only oracle copied from the committed AAB575 source via git show. */
function aab575BaselineOracle(snapshot: SummaryV3StyleOperationSnapshot, candidateText: string): boolean {
  const states = snapshot.selectedEntries.map((entry) => entry.employmentState);
  if (states.length === 0) return false;
  const candidateClauses = clauses(candidateText);
  for (const entry of snapshot.selectedEntries) {
    const roleSurface = snapshot.manifestFacts.find((fact) => fact.id === `${entry.stableId}:role`)?.text;
    const employerSurface = snapshot.manifestFacts.find((fact) => fact.id === `${entry.stableId}:employer`)?.text;
    const sameClause = candidateClauses.filter((clause) => {
      const identities = [roleSurface, employerSurface, entry.rolePresentation?.text].filter(
        (surface): surface is string => Boolean(surface),
      );
      return identities.some((surface) => surfacePresent(surface, clause));
    });
    if (entry.employmentState === 'present' && sameClause.some((clause) => PRIOR_STATE_MARKERS.test(clause))) return true;
    if (entry.employmentState === 'completed' && sameClause.some((clause) => CURRENT_STATE_MARKERS.test(clause))) return true;
  }
  if (snapshot.mode === 'enhance_existing_content') {
    const sourceHasPrior = PRIOR_STATE_MARKERS.test(snapshot.sourceSummary);
    const sourceHasCurrent = CURRENT_STATE_MARKERS.test(snapshot.sourceSummary);
    if (PRIOR_STATE_MARKERS.test(candidateText) !== sourceHasPrior) return true;
    if (CURRENT_STATE_MARKERS.test(candidateText) !== sourceHasCurrent) return true;
  }
  if (states.every((state) => state === 'present')) return PRIOR_STATE_MARKERS.test(candidateText);
  if (states.every((state) => state === 'completed')) return CURRENT_STATE_MARKERS.test(candidateText);
  return false;
}

describe('M8 AAB575 employment-state observability parity', () => {
  it('preserves the AAB575 boolean while exposing a bounded shadow opposite-frame verdict', () => {
    const snapshot = snapshotFor(currentSource);
    const cases = [
      { label: 'A current frame', candidate: currentFrame, expected: false, opposite: false, expectedClass: null },
      { label: 'B current frame plus simple-past duty', candidate: `${currentFrame}, where I resolved faults.`, expected: false, opposite: false, expectedClass: null },
      { label: 'C current frame plus present-perfect duty', candidate: `${currentFrame}, where I have completed installations and supported projects.`, expected: true, opposite: false, expectedClass: 'enhance_prior_marker_parity_mismatch' },
      { label: 'D neutral frame', candidate: `${rolePresentation} at ${employer}, where I resolved faults.`, expected: true, opposite: false, expectedClass: 'enhance_current_marker_parity_mismatch' },
      { label: 'E explicit former frame', candidate: `${formerFrame}.`, expected: true, opposite: true, expectedClass: 'present_entry_prior_marker' },
      { label: 'F completed source plus explicit current frame', candidate: currentFrame, snapshot: snapshotFor(formerFrame, 'completed'), expected: true, opposite: true, expectedClass: 'completed_entry_current_marker' },
      { label: 'G completed source plus completed frame', candidate: formerFrame, snapshot: snapshotFor(formerFrame, 'completed'), expected: false, opposite: false, expectedClass: null },
      { label: 'H unrelated past duty', candidate: 'I resolved unrelated faults before joining another team.', expected: true, opposite: false, expectedClass: 'enhance_current_marker_parity_mismatch' },
      { label: 'I current frame plus completed individual task', candidate: `${currentFrame}, where I completed installations.`, expected: true, opposite: false, expectedClass: 'enhance_prior_marker_parity_mismatch' },
    ];
    for (const item of cases) {
      const activeSnapshot = item.snapshot || snapshot;
      const decision = employmentStateContradictionDecision(activeSnapshot, item.candidate);
      expect(decision.contradicted, item.label).toBe(item.expected);
      expect(hasEmploymentStateContradiction(activeSnapshot, item.candidate), item.label).toBe(item.expected);
      expect(decision.explicitOppositeFrameDetected, item.label).toBe(item.opposite);
      expect(employmentStateContradictionClass(activeSnapshot, item.candidate), item.label).toBe(item.expectedClass);
    }
  });

  it('matches the committed AAB575 oracle across a deterministic matrix of at least 50 cases', () => {
    const presentSnapshot = snapshotFor(currentSource, 'present');
    const completedSnapshot = snapshotFor(formerFrame, 'completed');
    const candidates = [
      currentFrame,
      `${currentFrame}, where I resolved faults.`,
      `${currentFrame}, where I have completed installations.`,
      `${rolePresentation} at ${employer}, where I resolved faults.`,
      formerFrame,
      `I previously worked as an ${rolePresentation} at ${employer}.`,
      `I worked as an ${rolePresentation} at ${employer}.`,
      `I was an ${rolePresentation} at ${employer}.`,
      `I am an ${rolePresentation} at ${employer}.`,
      'I resolved unrelated faults before joining another team.',
      'I completed installations for a separate team.',
      'The team discussed a previous project.',
      `${currentFrame}, where I maintained systems and completed installations.`,
      `${formerFrame}, where I maintained systems and completed installations.`,
      `At ${employer}, I improved processes.`,
      `Currently, the ${rolePresentation} works at ${employer}.`,
      `Previously, the ${rolePresentation} worked at ${employer}.`,
      `${rolePresentation} with ${employer} completed installations.`,
      `The ${rolePresentation} at ${employer} is currently assigned.`,
      `The ${rolePresentation} at ${employer} was formerly assigned.`,
    ];
    const modes: Array<{ snapshot: SummaryV3StyleOperationSnapshot; label: string }> = [
      { snapshot: presentSnapshot, label: 'present-enhance' },
      { snapshot: completedSnapshot, label: 'completed-enhance' },
      { snapshot: snapshotFor('', 'present'), label: 'present-generate' },
    ];
    const matrix = modes.flatMap(({ snapshot, label }) => candidates.map((candidate, index) => ({ snapshot, candidate, label: `${label}-${index}` })));
    expect(matrix.length).toBeGreaterThanOrEqual(50);
    let mismatches = 0;
    for (const item of matrix) {
      const baseline = aab575BaselineOracle(item.snapshot, item.candidate);
      const observed = employmentStateContradictionDecision(item.snapshot, item.candidate).contradicted;
      if (baseline !== observed) mismatches += 1;
      expect(observed, item.label).toBe(baseline);
    }
    expect(mismatches).toBe(0);
  });

  it('covers identity-clause absence, both marker groups, mixed states, and multiple entries', () => {
    const secondEntry = {
      stableId: 'entry-second',
      role: 'Warehouse Coordinator',
      employer: 'Other Employer',
      roleSourceLocale: 'en',
      employmentState: 'completed' as const,
      durationMonths: 24,
      facts: [{ id: 'second-duty', text: 'coordinate warehouse operations' }],
    };
    const mixed = snapshotFor(currentSource, 'present', {
      entries: [
        {
          stableId: 'entry-current',
          role,
          employer,
          roleSourceLocale: 'de',
          rolePresentation: {
            text: rolePresentation,
            sourceLocale: 'de',
            targetLocale: 'en',
            sourceRoleHash: hashSummaryV3StyleValue(role),
            provenance: 'validated_export_title_surface',
          },
          employmentState: 'present',
          durationMonths: 36,
          facts: [
            { id: 'duty-maintenance', text: 'carry out maintenance work on electrical systems' },
            { id: 'duty-faults', text: 'locate and resolve faults in electrical systems' },
            { id: 'duty-installation', text: 'support the installation of electrical components' },
          ],
        },
        secondEntry,
      ],
      currentRoleEntryId: 'entry-current',
    });
    const cases = [
      'The team discussed a previous project.',
      `${currentFrame} and I was previously assigned to a project.`,
      `${currentFrame} and I am currently supporting the team.`,
      `${formerFrame} and I am currently supporting the team.`,
      'I worked on a previous project and currently coordinate unrelated work.',
    ];
    for (const candidate of cases) {
      expect(employmentStateContradictionDecision(mixed, candidate).contradicted)
        .toBe(aab575BaselineOracle(mixed, candidate));
    }
  });
});
