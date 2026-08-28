import type {
  EmploymentState,
  ExperienceFact,
  StructuredDate,
  StructuredEmploymentDates,
} from './contracts';

export function requireNonBlank(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${field} must be non-empty`);
  }
}

function assertStructuredDate(value: StructuredDate, field: string): void {
  if (!value || !Number.isInteger(value.year)) {
    throw new TypeError(`${field}.year must be an integer`);
  }
  if (value.month !== undefined && (!Number.isInteger(value.month) || value.month < 1 || value.month > 12)) {
    throw new TypeError(`${field}.month must be an integer from 1 through 12`);
  }
  if (value.day !== undefined && (!Number.isInteger(value.day) || value.day < 1 || value.day > 31)) {
    throw new TypeError(`${field}.day must be an integer from 1 through 31`);
  }
}

export function assertEmploymentStateAndDates(
  employmentState: EmploymentState,
  dates: StructuredEmploymentDates,
  field = 'dates',
): void {
  if (employmentState !== 'present' && employmentState !== 'completed') {
    throw new TypeError('employmentState must be present or completed');
  }
  if (!dates || !dates.start) {
    throw new TypeError(`${field}.start is required`);
  }
  assertStructuredDate(dates.start, `${field}.start`);
  if (dates.end !== null) {
    assertStructuredDate(dates.end, `${field}.end`);
  }
  if (employmentState === 'present' && dates.end !== null) {
    throw new TypeError('present employment must have a null end date');
  }
  if (employmentState === 'completed' && dates.end === null) {
    throw new TypeError('completed employment must have a structured end date');
  }
}

export function assertFacts(facts: readonly ExperienceFact[], seenFactIds = new Set<string>()): void {
  if (!Array.isArray(facts)) {
    throw new TypeError('facts must be an array');
  }
  for (const fact of facts) {
    requireNonBlank(fact.factId, 'factId');
    requireNonBlank(fact.sourceHash, 'fact.sourceHash');
    if (typeof fact.text !== 'string') {
      throw new TypeError('fact.text must be a string');
    }
    if (typeof fact.required !== 'boolean') {
      throw new TypeError('fact.required must be a boolean');
    }
    if (seenFactIds.has(fact.factId)) {
      throw new TypeError(`duplicate factId: ${fact.factId}`);
    }
    seenFactIds.add(fact.factId);
  }
}
