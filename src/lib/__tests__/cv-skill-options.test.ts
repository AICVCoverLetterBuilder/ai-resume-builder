import { describe, expect, test } from 'vitest';
import {
  filterCvSkillOptions,
  getLocalizedCvSkillName,
  resolveStoredCvSkillName,
  getSkillSuggestionsByJobTitles,
} from '../cv-skill-options';

describe('cv skill options', () => {
  test('matches communication from a partial query', () => {
    const results = filterCvSkillOptions('comm', 'en');

    expect(results[0]?.canonicalName).toBe('Communication');
    expect(results[0]?.localizedLabel).toBe('Communication');
  });

  test('returns sales-related suggestions from a sales query', () => {
    const results = filterCvSkillOptions('sale', 'en').map((option) => option.canonicalName);

    expect(results).toContain('Sales');
    expect(results).toContain('Sales Strategy');
    expect(results).toContain('Negotiation');
  });

  test('localizes visible labels while keeping canonical resolution stable', () => {
    const results = filterCvSkillOptions('komm', 'de');

    expect(results[0]?.canonicalName).toBe('Communication');
    expect(results[0]?.localizedLabel).toBe('Kommunikation');
    expect(resolveStoredCvSkillName('Kommunikation')).toBe('Communication');
  });

  test('keeps serbian labels in latin script and supports arabic labels', () => {
    expect(getLocalizedCvSkillName('Communication', 'sr')).toBe('Komunikacija');
    expect(getLocalizedCvSkillName('Communication', 'ar')).toBe('التواصل');
  });

  test('getSkillSuggestionsByJobTitles combines skills from ALL job titles, not just the last', () => {
    // Simulate the user's example: multiple distinct roles across a career
    const jobTitles = ['Driver', 'Sales Associate', 'Warehouse Worker', 'Marketing Expert'];
    const results = getSkillSuggestionsByJobTitles(jobTitles, 'en');
    const names = results.map(r => r.canonicalName);

    console.log('[TEST] Combined suggestions:', names);

    // Must include skills from the SALES category (Sales Associate)
    expect(names).toContain('Sales');

    // Must include skills from the OPERATIONS category (Warehouse Worker)
    expect(names).toContain('Inventory Management');

    // Must include skills from the MARKETING category (Marketing Expert)
    expect(names).toContain('Marketing');
    expect(names).toContain('SEO');

    // Must include universal soft skills (Driver falls through to universal)
    expect(names).toContain('Communication');

    // Should NOT have duplicates — count occurrences of each skill
    const counts: Record<string, number> = {};
    names.forEach(n => { counts[n] = (counts[n] ?? 0) + 1; });
    const dups = Object.entries(counts).filter(([, c]) => c > 1);
    expect(dups).toHaveLength(0);

    // Should return at most 15 results (the default limit)
    expect(results.length).toBeLessThanOrEqual(15);

    // Should return at least enough skills to represent multiple roles
    expect(results.length).toBeGreaterThanOrEqual(8);
  });

  test('getSkillSuggestionsByJobTitles with single job title returns relevant skills', () => {
    const results = getSkillSuggestionsByJobTitles(['Software Engineer'], 'en');
    const names = results.map(r => r.canonicalName);

    expect(names).toContain('JavaScript');
    expect(names).toContain('TypeScript');
    expect(names).toContain('React');
  });

  test('getSkillSuggestionsByJobTitles with empty array returns empty', () => {
    const results = getSkillSuggestionsByJobTitles([], 'en');
    expect(results).toHaveLength(0);
  });

  test('getSkillSuggestionsByJobTitles excluding already-selected skills', () => {
    const jobTitles = ['Sales Associate', 'Marketing Expert'];
    // Pre-select 'Sales' so it should NOT appear in suggestions
    const results = getSkillSuggestionsByJobTitles(jobTitles, 'en', ['Sales']);
    const names = results.map(r => r.canonicalName);

    expect(names).not.toContain('Sales');
    // But other sales skills not in Sales canonical should still appear
    expect(names).toContain('Lead Generation');
    expect(names).toContain('Marketing');
    expect(names).toContain('SEO');
  });
});
