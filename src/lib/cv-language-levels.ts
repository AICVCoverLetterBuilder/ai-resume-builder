/**
 * Canonical language proficiency enums + display localization.
 *
 * Storage must always use locale-independent keys:
 *   native | fluent | advanced | intermediate | basic
 * Never persist translated UI strings (Napredni / उन्नत / Advanced) as source of truth.
 */
import type { Locale } from './i18n/translations';

export type CanonicalLanguageProficiency =
  | 'native'
  | 'fluent'
  | 'advanced'
  | 'intermediate'
  | 'basic';

const LEVEL_ALIASES: Record<string, CanonicalLanguageProficiency> = {
  native: 'native',
  mother: 'native',
  'mother tongue': 'native',
  fluent: 'fluent',
  advanced: 'advanced',
  intermediate: 'intermediate',
  mid: 'intermediate',
  'mid-level': 'intermediate',
  medium: 'intermediate',
  basic: 'basic',
  beginner: 'basic',
  elementary: 'basic',
  // EN display
  'native speaker': 'native',
  // DE stored UI strings
  muttersprachlich: 'native',
  fließend: 'fluent',
  fortgeschritten: 'advanced',
  mittelstufe: 'intermediate',
  grundkenntnisse: 'basic',
  // ES / PT shared spellings
  nativo: 'native',
  fluido: 'fluent',
  avanzado: 'advanced',
  intermedio: 'intermediate',
  básico: 'basic',
  avançado: 'advanced',
  intermediário: 'intermediate',
  fluente: 'fluent',
  // FR
  maternelle: 'native',
  'langue maternelle': 'native',
  courant: 'fluent',
  avancé: 'advanced',
  intermédiaire: 'intermediate',
  débutant: 'basic',
  'notions de base': 'basic',
  // IT
  madrelingua: 'native',
  avanzato: 'advanced',
  // SR/HR
  maternji: 'native',
  materinski: 'native',
  tečan: 'fluent',
  napredni: 'advanced',
  'napredna razina': 'advanced',
  srednji: 'intermediate',
  'srednja razina': 'intermediate',
  osnovni: 'basic',
  'osnovna razina': 'basic',
  // RU
  родной: 'native',
  свободный: 'fluent',
  продвинутый: 'advanced',
  средний: 'intermediate',
  базовый: 'basic',
  // HI (critical: polluted storage from locale switch)
  मातृभाषा: 'native',
  धाराप्रवाह: 'fluent',
  प्रवाहपूर्ण: 'fluent',
  उन्नत: 'advanced',
  मध्यम: 'intermediate',
  बुनियादी: 'basic',
  मूल: 'basic',
  // AR
  'لغة أم': 'native',
  طلق: 'fluent',
  متقدم: 'advanced',
  متوسط: 'intermediate',
  أساسي: 'basic',
  // JA
  'ネイティブ': 'native',
  '流暢': 'fluent',
  '上級': 'advanced',
  '中級': 'intermediate',
  '初級': 'basic',
};

const LOCALIZED: Record<Locale, Record<CanonicalLanguageProficiency, string>> = {
  en: {
    native: 'Native',
    fluent: 'Fluent',
    advanced: 'Advanced',
    intermediate: 'Intermediate',
    basic: 'Basic',
  },
  de: {
    native: 'Muttersprachlich',
    fluent: 'Fließend',
    advanced: 'Fortgeschritten',
    intermediate: 'Mittelstufe',
    basic: 'Grundkenntnisse',
  },
  es: {
    native: 'Nativo',
    fluent: 'Fluido',
    advanced: 'Avanzado',
    intermediate: 'Intermedio',
    basic: 'Básico',
  },
  fr: {
    native: 'Langue maternelle',
    fluent: 'Courant',
    advanced: 'Avancé',
    intermediate: 'Intermédiaire',
    basic: 'Notions de base',
  },
  it: {
    native: 'Madrelingua',
    fluent: 'Fluente',
    advanced: 'Avanzato',
    intermediate: 'Intermedio',
    basic: 'Base',
  },
  ar: {
    native: 'لغة أم',
    fluent: 'طلق',
    advanced: 'متقدم',
    intermediate: 'متوسط',
    basic: 'أساسي',
  },
  sr: {
    native: 'Maternji',
    fluent: 'Tečan',
    advanced: 'Napredni',
    intermediate: 'Srednji',
    basic: 'Osnovni',
  },
  hr: {
    native: 'Materinski',
    fluent: 'Tečan',
    advanced: 'Napredna razina',
    intermediate: 'Srednja razina',
    basic: 'Osnovna razina',
  },
  ru: {
    native: 'Родной',
    fluent: 'Свободный',
    advanced: 'Продвинутый',
    intermediate: 'Средний',
    basic: 'Базовый',
  },
  'pt-BR': {
    native: 'Nativo',
    fluent: 'Fluente',
    advanced: 'Avançado',
    intermediate: 'Intermediário',
    basic: 'Básico',
  },
  hi: {
    native: 'मातृभाषा',
    fluent: 'धाराप्रवाह',
    advanced: 'उन्नत',
    intermediate: 'मध्यम',
    basic: 'बुनियादी',
  },
  ja: {
    native: 'ネイティブ',
    fluent: '流暢',
    advanced: '上級',
    intermediate: '中級',
    basic: '初級',
  },
};

/** Map any known display/alias string to the stable canonical enum (or null). */
export function canonicalizeLanguageProficiency(
  raw: string,
): CanonicalLanguageProficiency | null {
  const key = (raw ?? '').normalize('NFKC').trim().toLowerCase();
  if (!key) return null;
  if (key in LEVEL_ALIASES) return LEVEL_ALIASES[key];
  // Exact match without lowercasing for scripts that don't case-fold (Hindi/AR/JA/RU)
  const exact = (raw ?? '').normalize('NFKC').trim();
  if (exact in LEVEL_ALIASES) return LEVEL_ALIASES[exact];
  // Case-insensitive Latin / mixed forms already covered; also try each LOCALIZED table value.
  for (const table of Object.values(LOCALIZED)) {
    for (const [canon, label] of Object.entries(table) as Array<[CanonicalLanguageProficiency, string]>) {
      if (label.normalize('NFKC').trim().toLowerCase() === key) return canon;
      if (label.normalize('NFKC').trim() === exact) return canon;
    }
  }
  return null;
}

/**
 * Normalize a stored proficiency to the canonical enum key.
 * Unknown custom free-text is preserved unchanged (never erased).
 */
export function normalizeLanguageProficiencyToCanonical(raw: string): string {
  const canon = canonicalizeLanguageProficiency(raw);
  return canon ?? (raw ?? '').trim();
}

/** Localize a known proficiency enum; unknown custom text is returned unchanged. */
export function localizeCvLanguageLevel(level: string, locale: Locale): string {
  const raw = (level ?? '').trim();
  if (!raw) return raw;
  const canon = canonicalizeLanguageProficiency(raw);
  if (!canon) return raw;
  const table = LOCALIZED[locale] ?? LOCALIZED.en;
  return table[canon] ?? raw;
}

/** Rewrite every known translated level on a CV to the canonical enum (migration). */
export function normalizeCvLanguagesProficiency<
  T extends { languages?: Array<{ name: string; level: string }> },
>(cv: T): T {
  const languages = (cv.languages || []).map((lang) => ({
    ...lang,
    level: normalizeLanguageProficiencyToCanonical(lang.level),
  }));
  return { ...cv, languages };
}
