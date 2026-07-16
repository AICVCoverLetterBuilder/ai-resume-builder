/**
 * Deduplicate localized skills for preview/export projections without mutating stored CV data.
 */
import { getLocalizedCvSkillName } from './cv-skill-options';
import type { Locale } from './i18n/translations';

function normalizeSkillKey(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function deduplicateSkillsForExport(skills: string[], locale: Locale): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of skills) {
    const localized = getLocalizedCvSkillName(skill, locale) || skill;
    const key = normalizeSkillKey(localized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(localized);
  }
  return out;
}
