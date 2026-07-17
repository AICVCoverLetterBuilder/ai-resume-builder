/**
 * Occupational title resolver + generic title↔duty consistency.
 * Display localization must never mutate the canonical stored title.
 * Conflict handling is category-based (not Kuvar/logistics-hardcoded).
 */
import type { Locale } from './i18n/translations';
import { normalizeCoverLetterGender } from './cover-letter-gender';

const PLACEHOLDER_TITLE = /^(n\/a|na|tbd|test|xxx|position|role|job|title|none|unknown)$/i;

export type OccupationCategory =
  | 'cooking'
  | 'teaching'
  | 'accounting'
  | 'design'
  | 'sales'
  | 'healthcare'
  | 'software'
  | 'logistics'
  | 'manufacturing'
  | 'driving'
  | 'unknown';

export type DutyFamily =
  | 'cooking'
  | 'teaching'
  | 'accounting'
  | 'design'
  | 'sales'
  | 'healthcare'
  | 'software'
  | 'logistics'
  | 'manufacturing'
  | 'driving'
  | 'office_process'
  | 'generic';

export function isValidOccupationalTitle(title: string): boolean {
  const t = (title || '').trim();
  if (!t) return false;
  if (t.length <= 1) return false;
  if (PLACEHOLDER_TITLE.test(t)) return false;
  if (/^[-_.\sx]+$/i.test(t)) return false;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return false;
  return true;
}

function localizeProductionOperator(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'उत्पादन ऑपरेटर';
  if (locale === 'sr' || locale === 'hr') {
    return g === 'female' ? 'Operaterka u proizvodnji' : 'Operater u proizvodnji';
  }
  if (locale === 'en') return 'Production Operator';
  if (locale === 'de') return g === 'female' ? 'Produktionsmitarbeiterin' : 'Produktionsmitarbeiter';
  return 'Production Operator';
}

function localizeInteriorDesigner(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'इंटीरियर डिज़ाइनर';
  if (locale === 'sr' || locale === 'hr') {
    return g === 'female' ? 'Dizajnerka enterijera' : 'Dizajner enterijera';
  }
  if (locale === 'en') return 'Interior Designer';
  if (locale === 'de') return g === 'female' ? 'Innenarchitektin' : 'Innenarchitekt';
  return 'Interior Designer';
}

function localizeCook(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'रसोइया';
  if (locale === 'sr' || locale === 'hr') {
    return g === 'female' ? 'Kuvarica' : 'Kuvar';
  }
  if (locale === 'en') return 'Cook';
  if (locale === 'de') return g === 'female' ? 'Köchin' : 'Koch';
  if (locale === 'fr') return g === 'female' ? 'Cuisinière' : 'Cuisinier';
  if (locale === 'es') return g === 'female' ? 'Cocinera' : 'Cocinero';
  if (locale === 'it') return g === 'female' ? 'Cuoca' : 'Cuoco';
  if (locale === 'pt-BR') return g === 'female' ? 'Cozinheira' : 'Cozinheiro';
  if (locale === 'ru') return g === 'female' ? 'Повариха' : 'Повар';
  if (locale === 'ar') return 'طباخ';
  if (locale === 'ja') return '料理人';
  return 'Cook';
}

const TITLE_CATEGORY_RULES: Array<{ category: OccupationCategory; re: RegExp; confidence: 'high' }> = [
  {
    category: 'cooking',
    // Avoid `\b` for Devanagari/Arabic/CJK — JS word boundaries are ASCII-only.
    re: /(?:^|[^a-zA-Z])(kuvar(?:ica|ka)?|cook|chef|kuhar(?:ica)?|koch|köchin|cuisinier|cocinero|cuoco|повар)(?:[^a-zA-Z]|$)|रसोइया|طباخ|料理人/iu,
    confidence: 'high',
  },
  {
    category: 'teaching',
    re: /\b(teacher|nastavnik|nastavnica|učitelj(?:ica)?|profesor(?:ka)?|lehrer(?:in)?|enseignant|profesor| معلم| शिक्षक|教師)\b/iu,
    confidence: 'high',
  },
  {
    category: 'accounting',
    re: /\b(accountant|računovo[dđ](?:a|kinja)?|buchhalter(?:in)?|comptable|contabile|бухгалтер| المحاسب| लेखाकार)\b/iu,
    confidence: 'high',
  },
  {
    category: 'design',
    re: /\b(designer|dizajner(?:ka)?|designer(?:in)?|diseñador|デザイナー| مصمم| डिज़ाइनर)\b/iu,
    confidence: 'high',
  },
  {
    category: 'sales',
    re: /\b(sales|prodavac|prodavačica|verkäufer(?:in)?|vendeur|vendedor|продавец| مندوب مبيعات| विक्रेता)\b/iu,
    confidence: 'high',
  },
  {
    category: 'healthcare',
    re: /\b(nurse|medicinsk|arzt|ärztin|doctor|doktor(?:ka)?|sestra|pfleger(?:in)?|infirmier|enfermeir| врач| медсестр| ممرض| नर्स|医師|看護師)\b/iu,
    confidence: 'high',
  },
  {
    category: 'software',
    re: /\b(software|developer|programer(?:ka)?|entwickler|développeur|desarrollador|разработчик| مطور| डेवलपर|エンジニア)\b/iu,
    confidence: 'high',
  },
  {
    category: 'logistics',
    re: /\b(warehouse|skladišt|logist|forklift|viličar|magazinier|lagerist)\b/iu,
    confidence: 'high',
  },
  {
    category: 'manufacturing',
    re: /\b(production\s+operator|operater(?:ka)?\s+u\s+proizvod|manufactur|fabrika|工場)\b/iu,
    confidence: 'high',
  },
  {
    category: 'driving',
    re: /\b(driver|vozač(?:ica)?|fahrer(?:in)?|chauffeur|conductor|водитель| سائق| चालक|運転手)\b/iu,
    confidence: 'high',
  },
];

const DUTY_FAMILY_RULES: Array<{ family: DutyFamily; re: RegExp; confidence: 'high' }> = [
  {
    family: 'cooking',
    re: /\b(cook(?:ing)?|recipe|kitchen|menu|food\s+prep|kuhinj\w*|jel\w*|namirnic\w*|mediteransk\w*)|priprem\w*.{0,40}(?:hran|jel|namirnic|obrok)|भोजन|पकवान|طبخ/iu,
    confidence: 'high',
  },
  {
    family: 'logistics',
    re: /\b(?:transport|utovar|istovar|load(?:ing)?|unload|deliver|delivery|warehouse|skladišt|viličar|vilicar|forklift|logistics|isporuč|isporuc|prevoz)|परिवहन|गोदाम|डिलीवरी/iu,
    confidence: 'high',
  },
  {
    family: 'office_process',
    re: /\b(?:internal\s+process|process(?:es)?|cross[- ]?functional|collaborat|analy[sz]|report|izveštaj|izvestaj|proces|saradn|sarađ|sarad|koordin)|प्रक्रिया|सहयोग|विश्लेषण|रिपोर्ट/iu,
    confidence: 'high',
  },
  {
    family: 'software',
    re: /\b(?:software|code|coding|api|frontend|backend|deploy|git|react|java|python|programir)\b/iu,
    confidence: 'high',
  },
  {
    family: 'healthcare',
    re: /\b(?:patient|pacijen|nurs|clinic|hospital|bolnic|medicin|therapy|therapy)\b/iu,
    confidence: 'high',
  },
  {
    family: 'teaching',
    re: /\b(?:lesson|učion|classroom|curriculum|nastav|student|đak|pupil|pedagog)\b/iu,
    confidence: 'high',
  },
  {
    family: 'accounting',
    re: /\b(?:ledger|invoice|računovod|bookkeep|bilan|audit|porez|tax\s+return)\b/iu,
    confidence: 'high',
  },
  {
    family: 'design',
    re: /\b(?:figma|wireframe|typography|layout|branding|ui\/ux|prototyp)\b/iu,
    confidence: 'high',
  },
  {
    family: 'sales',
    re: /\b(?:quota|pipeline|crm|upsell|closing\s+deals|prodaj)\b/iu,
    confidence: 'high',
  },
  {
    family: 'manufacturing',
    re: /\b(?:assembly|proizvodn|cnc|machine\s+operat|quality\s+control\s+line)\b/iu,
    confidence: 'high',
  },
  {
    family: 'driving',
    re: /\b(?:driving|vožnj|route|delivery\s+route|truck|kamion)\b/iu,
    confidence: 'high',
  },
];

/** Compatible pairs: occupation may naturally appear with these duty families. */
const COMPATIBLE: Record<OccupationCategory, DutyFamily[]> = {
  cooking: ['cooking'],
  teaching: ['teaching'],
  accounting: ['accounting', 'office_process'],
  design: ['design'],
  sales: ['sales', 'office_process'],
  healthcare: ['healthcare'],
  software: ['software', 'office_process'],
  logistics: ['logistics', 'office_process', 'driving'],
  manufacturing: ['manufacturing', 'office_process', 'logistics'],
  driving: ['driving', 'logistics'],
  unknown: [],
};

export function classifyOccupationCategory(title: string): {
  category: OccupationCategory;
  confidence: 'high' | 'low';
} {
  const t = (title || '').trim();
  if (!t) return { category: 'unknown', confidence: 'low' };
  for (const rule of TITLE_CATEGORY_RULES) {
    if (rule.re.test(t)) return { category: rule.category, confidence: rule.confidence };
  }
  return { category: 'unknown', confidence: 'low' };
}

export function classifyDutyFamilies(dutiesText: string): Array<{
  family: DutyFamily;
  confidence: 'high' | 'low';
}> {
  const duties = (dutiesText || '').trim();
  if (!duties) return [{ family: 'generic', confidence: 'low' }];
  const found: Array<{ family: DutyFamily; confidence: 'high' | 'low' }> = [];
  for (const rule of DUTY_FAMILY_RULES) {
    if (rule.re.test(duties)) found.push({ family: rule.family, confidence: rule.confidence });
  }
  return found.length ? found : [{ family: 'generic', confidence: 'low' }];
}

export type RoleDutyConsistencyResult = {
  conflict: boolean;
  titleCategory: OccupationCategory;
  dutyFamilies: DutyFamily[];
  confidence: 'high' | 'low';
};

/**
 * Strong conflict only when both sides are high-confidence and incompatible.
 * Low confidence → no conflict claim (do not invent occupation).
 */
export function evaluateRoleDutyConsistency(options: {
  profileJobTitle?: string;
  experienceTitle?: string;
  dutiesText?: string;
}): RoleDutyConsistencyResult {
  const title = `${options.profileJobTitle || ''} ${options.experienceTitle || ''}`.trim();
  const duties = (options.dutiesText || '').trim();
  const occ = classifyOccupationCategory(title);
  const dutyHits = classifyDutyFamilies(duties);
  const dutyFamilies = dutyHits.map((d) => d.family);
  if (occ.confidence !== 'high' || occ.category === 'unknown') {
    return { conflict: false, titleCategory: occ.category, dutyFamilies, confidence: 'low' };
  }
  const highDuties = dutyHits.filter((d) => d.confidence === 'high' && d.family !== 'generic');
  if (!highDuties.length) {
    return { conflict: false, titleCategory: occ.category, dutyFamilies, confidence: 'low' };
  }
  const compatible = COMPATIBLE[occ.category] || [];
  const anyCompatible = highDuties.some((d) => compatible.includes(d.family));
  if (anyCompatible) {
    return { conflict: false, titleCategory: occ.category, dutyFamilies, confidence: 'high' };
  }
  return { conflict: true, titleCategory: occ.category, dutyFamilies, confidence: 'high' };
}

export function hasRoleDutyConsistencyConflict(options: {
  profileJobTitle?: string;
  experienceTitle?: string;
  dutiesText?: string;
}): boolean {
  return evaluateRoleDutyConsistency(options).conflict;
}

/** Localized display forms of a conflicting occupation that must not be forced into Summary. */
export function conflictingTitleFormsInSummary(
  titleCategory: OccupationCategory,
  locale: Locale,
  gender?: string,
): RegExp[] {
  const g = normalizeCoverLetterGender(gender);
  if (titleCategory === 'cooking') {
    return [
      /(?:^|[^a-zA-Z])(kuvar(?:ica|ka)?|cook|chef|kuhar(?:ica)?|koch|köchin|cuisinier|cocinero|cuoco|повар)(?:[^a-zA-Z]|$)/iu,
      /रसोइया/u,
      /طباخ/u,
      /料理人/u,
      /\bprofessional\s+cook\b/iu,
      /दक्ष\s+रसोइया/u,
    ];
  }
  if (titleCategory === 'teaching') {
    return [/\b(teacher|nastavnik|nastavnica|učitelj(?:ica)?|profesor(?:ka)?)\b/iu];
  }
  if (titleCategory === 'accounting') {
    return [/\b(accountant|računovo[dđ]\w*)\b/iu];
  }
  if (titleCategory === 'software') {
    return [/\b(software\s+developer|programer(?:ka)?)\b/iu];
  }
  if (titleCategory === 'driving') {
    return [/\b(driver|vozač(?:ica)?)\b/iu];
  }
  if (titleCategory === 'healthcare') {
    return [/\b(nurse|doktor(?:ka)?|medicinsk\w*)\b/iu];
  }
  if (titleCategory === 'design') {
    const localized = localizeInteriorDesigner(locale, g);
    return [new RegExp(localized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu')];
  }
  return [];
}

function localizeKnownTitle(title: string, locale: Locale, gender?: string): string | null {
  const normalized = title.normalize('NFKC');
  if (/operater.*proizvod|production\s+operator|operatore.*produz/i.test(normalized)) {
    return localizeProductionOperator(locale, gender);
  }
  if (/dizajner(?:ka)?\s+enterijera|interior\s+designer|innenarchitekt/i.test(normalized)) {
    return localizeInteriorDesigner(locale, gender);
  }
  if (TITLE_CATEGORY_RULES[0].re.test(normalized)) {
    return localizeCook(locale, gender);
  }
  if (locale === 'sr' || locale === 'hr') return normalized;
  const isAsciiTitle = /^[A-Za-z0-9\s/&'’.-]+$/u.test(normalized) && normalized.length > 2;
  if (locale === 'en') {
    return isAsciiTitle ? normalized : null;
  }
  return null;
}

export function localizeOccupationalTitleForProjection(
  title: string,
  locale: Locale,
  gender?: string,
): string {
  if (!isValidOccupationalTitle(title)) return title;
  return localizeKnownTitle(title.trim(), locale, gender) || title;
}

export function getOccupationalTitleFallback(locale: Locale, gender?: string): string {
  const g = normalizeCoverLetterGender(gender);
  if (locale === 'hi') return 'पेशेवर';
  if (locale === 'sr' || locale === 'hr') return g === 'female' ? 'profesionalka' : 'profesionalac';
  if (locale === 'de') return 'Fachkraft';
  if (locale === 'ar') return 'محترف';
  if (locale === 'ja') return 'プロフェッショナル';
  if (locale === 'ru') return g === 'female' ? 'специалистка' : 'специалист';
  if (locale === 'pt-BR') return 'profissional';
  return 'professional';
}

export function resolveOccupationalTitleForSummary(options: {
  profileJobTitle?: string;
  currentExperienceTitle?: string;
  locale: Locale;
  gender?: string;
  dutiesText?: string;
}): string {
  if (
    hasRoleDutyConsistencyConflict({
      profileJobTitle: options.profileJobTitle,
      experienceTitle: options.currentExperienceTitle,
      dutiesText: options.dutiesText,
    })
  ) {
    return getOccupationalTitleFallback(options.locale, options.gender);
  }
  const candidates = [options.profileJobTitle, options.currentExperienceTitle];
  for (const raw of candidates) {
    if (!isValidOccupationalTitle(raw || '')) continue;
    const localized = localizeKnownTitle(raw!.trim(), options.locale, options.gender);
    if (localized) return localized;
  }
  return getOccupationalTitleFallback(options.locale, options.gender);
}
