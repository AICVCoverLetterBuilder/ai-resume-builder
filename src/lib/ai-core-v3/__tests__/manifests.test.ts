import { describe, expect, it } from 'vitest';
import type {
  EmploymentState,
  ExperienceFact,
  SummaryEntryFactManifest,
} from '../contracts';
import {
  createExperienceFactManifest,
  type ExperienceFactManifestInput,
} from '../experience-manifest';
import {
  createSummaryFactManifest,
  type SummaryFactManifestInput,
} from '../summary-manifest';

function fact(factId: string, text = 'Exact source fact'): ExperienceFact {
  return { factId, text, sourceHash: `sha256-${factId}`, required: true };
}

function experienceInput(
  mode: 'generate' | 'enhance',
  exactSourceText: string,
): ExperienceFactManifestInput {
  return {
    operationId: `experience-${mode}-operation`,
    mode,
    entryId: 'experience-entry-1',
    locale: 'de',
    roleTitle: 'Servicetechniker Elektrotechnik',
    company: 'NordWerk Elektroservice Test',
    employmentState: 'present',
    dates: { start: { year: 2024, month: 1 }, end: null },
    exactSourceText,
    facts: [fact('experience-fact-1')],
    snapshotHash: `sha256-${mode}-snapshot`,
  };
}

function entry(
  entryId: string,
  factId: string,
  employmentState: EmploymentState = 'present',
): SummaryEntryFactManifest {
  return {
    entryId,
    roleTitle: entryId === 'current-entry' ? 'Servicetechniker Elektrotechnik' : 'Électricien spécialisé',
    employer: entryId === 'current-entry' ? 'NordWerk Elektroservice Test' : 'RheinMain Anlagenservice Test',
    employmentState,
    dates: employmentState === 'present'
      ? { start: { year: 2024, month: 1 }, end: null }
      : { start: { year: 2019 }, end: { year: 2023, month: 12 } },
    facts: [fact(factId, `Exact fact for ${entryId}`)],
  };
}

function summaryInput(): SummaryFactManifestInput {
  return {
    operationId: 'summary-operation-1',
    operationKind: 'summary_generate',
    targetLocale: 'de',
    currentRoleEntryId: 'current-entry',
    selectedEntries: [
      entry('current-entry', 'current-fact'),
      entry('prior-entry', 'prior-fact', 'completed'),
    ],
    structuredTotalDurationMonths: 66,
    skills: ['Prüftechnik', 'Café systems'],
    education: ['École Technique München'],
    languages: ['Deutsch', 'Français'],
    sourceSnapshotHash: 'sha256-summary-snapshot',
  };
}

describe('ExperienceFactManifest', () => {
  it('accepts generate with an empty source and preserves entry-owned facts', () => {
    const manifest = createExperienceFactManifest(experienceInput('generate', ''));
    expect(manifest.operationKind).toBe('experience_generate');
    expect(manifest.exactSourceText).toBe('');
    expect(manifest.entryId).toBe('experience-entry-1');
    expect(manifest.facts.map((item) => item.factId)).toEqual(['experience-fact-1']);
    expect(Object.isFrozen(manifest.facts)).toBe(true);
  });

  it('accepts enhance only with a non-empty authoritative source', () => {
    const exact = '  Supplied authoritative duty.\n';
    const manifest = createExperienceFactManifest(experienceInput('enhance', exact));
    expect(manifest.operationKind).toBe('experience_enhance');
    expect(manifest.exactSourceText).toBe(exact);
    expect(() => createExperienceFactManifest(experienceInput('enhance', '   \n'))).toThrow(/non-empty/);
  });

  it('rejects duplicate fact IDs and missing stable entry identity', () => {
    const input = experienceInput('generate', '');
    expect(() => createExperienceFactManifest({
      ...input,
      facts: [fact('duplicate'), fact('duplicate')],
    })).toThrow(/duplicate factId/);
    expect(() => createExperienceFactManifest({ ...input, entryId: '' })).toThrow(/entryId/);
  });

  it('rejects invalid dates and invalid employment state', () => {
    const input = experienceInput('generate', '');
    expect(() => createExperienceFactManifest({
      ...input,
      dates: { start: { year: 2024, month: 13 }, end: null },
    })).toThrow(/month/);
    expect(() => createExperienceFactManifest({
      ...input,
      employmentState: 'unknown' as EmploymentState,
    })).toThrow(/employmentState/);
    expect(() => createExperienceFactManifest({
      ...input,
      employmentState: 'completed',
      dates: { start: { year: 2020 }, end: null },
    })).toThrow(/structured end date/);
  });
});

describe('SummaryFactManifest', () => {
  it('preserves entry ownership and exact proper names and source facts', () => {
    const input = summaryInput();
    const manifest = createSummaryFactManifest(input);
    expect(manifest.selectedEntries.map((item) => item.entryId)).toEqual(['current-entry', 'prior-entry']);
    expect(manifest.selectedEntries[0].facts[0].factId).toBe('current-fact');
    expect(manifest.selectedEntries[1].facts[0].factId).toBe('prior-fact');
    expect(manifest.selectedEntries[1].roleTitle).toBe('Électricien spécialisé');
    expect(manifest.education[0]).toBe('École Technique München');
    expect(manifest.skills[1]).toBe('Café systems');
    expect('facts' in manifest).toBe(false);
  });

  it('rejects duplicate entry IDs and duplicate fact IDs across entries', () => {
    const input = summaryInput();
    expect(() => createSummaryFactManifest({
      ...input,
      selectedEntries: [entry('same-entry', 'fact-1'), entry('same-entry', 'fact-2')],
    })).toThrow(/duplicate entryId/);
    expect(() => createSummaryFactManifest({
      ...input,
      selectedEntries: [entry('entry-1', 'same-fact'), entry('entry-2', 'same-fact')],
      currentRoleEntryId: 'entry-1',
    })).toThrow(/duplicate factId/);
  });

  it('rejects an invalid current-role reference', () => {
    expect(() => createSummaryFactManifest({
      ...summaryInput(),
      currentRoleEntryId: 'not-selected',
    })).toThrow(/currentRoleEntryId/);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid structured duration %s',
    (structuredTotalDurationMonths) => {
      expect(() => createSummaryFactManifest({
        ...summaryInput(),
        structuredTotalDurationMonths,
      })).toThrow(/finite non-negative integer/);
    },
  );

  it('defensively isolates nested input from later mutation', () => {
    const input = summaryInput();
    const mutableEntries = input.selectedEntries as SummaryEntryFactManifest[];
    const manifest = createSummaryFactManifest(input);
    mutableEntries[0] = entry('replacement-entry', 'replacement-fact');
    expect(manifest.selectedEntries[0].entryId).toBe('current-entry');
    expect(Object.isFrozen(manifest.selectedEntries[0].facts)).toBe(true);
  });
});
