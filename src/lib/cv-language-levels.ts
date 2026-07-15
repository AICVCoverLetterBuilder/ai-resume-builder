/**
 * Localize known CV language proficiency enums at export time.
 * Custom unknown values are preserved exactly.
 */
import type { Locale } from './i18n/translations';

const LEVEL_ALIASES: Record<string, 'native' | 'fluent' | 'advanced' | 'intermediate' | 'basic'> = {
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
  // FR
  maternelle: 'native',
  courant: 'fluent',
  avancé: 'advanced',
  intermédiaire: 'intermediate',
  débutant: 'basic',
  // IT
  madrelingua: 'native',
  fluente: 'fluent',
  avanzato: 'advanced',
  // SR/HR
  maternji: 'native',
  tečan: 'fluent',
  napredni: 'advanced',
  srednji: 'intermediate',
  osnovni: 'basic',
  // RU
  родной: 'native',
  свободный: 'fluent',
  продвинутый: 'advanced',
  средний: 'intermediate',
  базовый: 'basic',
};

const LOCALIZED: Record<Locale, Record<'native' | 'fluent' | 'advanced' | 'intermediate' | 'basic', string>> = {
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
    fluent: 'प्रवाहपूर्ण',
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

function canonicalizeLevelKey(raw: string): keyof typeof LOCALIZED.en | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (key in LEVEL_ALIASES) return LEVEL_ALIASES[key];
  // Exact EN display forms
  for (const [alias, canon] of Object.entries(LEVEL_ALIASES)) {
    if (alias === key) return canon;
  }
  return null;
}

/** Localize a known proficiency enum; unknown custom text is returned unchanged. */
export function localizeCvLanguageLevel(level: string, locale: Locale): string {
  const raw = (level ?? '').trim();
  if (!raw) return raw;
  const canon = canonicalizeLevelKey(raw);
  if (!canon) return raw;
  const table = LOCALIZED[locale] ?? LOCALIZED.en;
  return table[canon] ?? raw;
}
