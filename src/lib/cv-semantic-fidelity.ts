/**
 * Semantic fidelity + summary completeness + CV gender/locale quality for AI localization.
 */
import type { Locale } from './i18n/translations';
import {
  bulletsForExperience,
  buildCvCanonicalFactSet,
  type CvCanonicalFactSet,
  splitExperienceBullets,
} from './cv-canonical-facts';
import { normalizeCoverLetterGender, type CoverLetterGender } from './cover-letter-gender';

export type CvFidelityViolationKind =
  | 'unsupported_duty'
  | 'bullet_count_mismatch'
  | 'material_duty_removed'
  | 'meta_changed'
  | 'summary_incomplete'
  | 'perspective_mix'
  | 'gender_form_mismatch'
  | 'locale_quality'
  | 'language_level_mismatch';

export type CvFidelityViolation = {
  kind: CvFidelityViolationKind;
  matched: string;
  factId?: string;
  section?: string;
  evidence?: string;
};

export type CvFidelityResult = {
  valid: boolean;
  violations: CvFidelityViolation[];
};

/** Duties frequently invented for bartender/hospitality roles across locales. */
const UNSUPPORTED_DUTY_PATTERNS: RegExp[] = [
  /\ballerg(?:y|ies|ie)\b/iu,
  /проверка.{0,20}аллерген/iu,
  /allerg/iu,
  /فتح.?و.?إغلاق|opening and closing|Öffnungs- und Schließ/iu,
  /seasonal (?:or )?signature cocktails?|signature[- ]cocktails?|сезонн\w* коктейл|كوكتيلات موسمية/iu,
  /\bmuddling\b|muddlinga|تقنية muddling|мешаниј/iu,
  /inventory shortage|недостат\w* залих|نقص المخزون/iu,
  /expiry[- ]?date|срок\w* годности|تاريخ الانتهاء|rok trajanja/iu,
  /food[- ]?safety|безбедност хране|سلامة الغذاء|higijene hrane/iu,
  /evening shifts?|вечерн\w* смен|النوبات المسائية|abendschicht/iu,
  /special events?|posebn\w* događaj|فعاليات خاصة|besondere Veranstaltungen/iu,
  /kitchen staff|кухњ\w* особљ|طاقم المطبخ|Küchenpersonal|staff di cucina/iu,
  /synchroniz\w*.{0,40}(?:drink|dish|pić|blud)/iu,
  /wastage|otpad|هدر|Abfall|gaspi/iu,
  /syrups? and garnishes?|сирупа и гарнир|عصائر وشرابات|sirovi i garniture/iu,
  /receiving and storing (?:wines|beers|spirits)|prijem i skladištenje|استلام وتخزين/iu,
];

const SUMMARY_INCOMPLETE_PATTERNS: RegExp[] = [
  /करते\s*हु\s*$/u,
  /करते\s*हुए\s*$/u,
  /और\s*$/u,
  /तथा\s*$/u,
  /with\s*$/iu,
  /and\s*$/iu,
  /und\s*$/iu,
  /et\s*$/iu,
  /и\s*$/u,
  /y\s*$/iu,
  /e\s*$/iu,
  /…\s*$/u,
  /\.\.\.\s*$/u,
  /[\u0600-\u06FF]\s*و\s*$/u,
];

const LOCALE_QUALITY_PATTERNS: Array<{ locale?: Locale; re: RegExp; kind?: CvFidelityViolationKind }> = [
  { locale: 'sr', re: /\bspreman je\b/iu, kind: 'gender_form_mismatch' },
  { locale: 'sr', re: /\bprateći tehnikama\b/iu, kind: 'locale_quality' },
  { locale: 'hr', re: /\bUpravljala sam gostima\b/iu, kind: 'locale_quality' },
  { locale: 'ru', re: /Опытн(?:ый|ого)\s+бартендер[\s\S]{0,80}специализирующ(?:аяся|ейся)/iu, kind: 'gender_form_mismatch' },
  { locale: 'ru', re: /командный игрок,\s*способная/iu, kind: 'locale_quality' },
  { locale: 'pt-BR', re: /perfil de cada mesa/iu, kind: 'locale_quality' },
  { locale: 'es', re: /su manejo del inglés en nivel avanzado/iu, kind: 'locale_quality' },
  { locale: 'de', re: /\bGrundkenntnisse im Italienischen\b/iu, kind: 'language_level_mismatch' },
  { locale: 'de', re: /\bhausgemachte Cocktails\b/iu, kind: 'locale_quality' },
  { locale: 'fr', re: /\bdes notions en italien\b/iu, kind: 'language_level_mismatch' },
  { locale: 'ja', re: /アテンション・トゥ・ディテール/u, kind: 'locale_quality' },
  { locale: 'it', re: /\bPreparò\b|\bGestì\b|\bMantenne\b|\bSupportò\b/u, kind: 'locale_quality' },
];

const FEMALE_MISMATCH: Array<{ locale: Locale; re: RegExp }> = [
  { locale: 'sr', re: /\bspreman je\b/iu },
  { locale: 'hr', re: /\bspreman je\b/iu },
  { locale: 'ru', re: /\bОпытный\b/u },
  { locale: 'de', re: /\bBartender\b(?!in)/u },
  { locale: 'fr', re: /\bmotivé\b(?!e)\b/iu },
  { locale: 'it', re: /\bmotivato\b/iu },
];

const MALE_MISMATCH: Array<{ locale: Locale; re: RegExp }> = [
  { locale: 'sr', re: /\bspremna je\b/iu },
  { locale: 'ru', re: /\bОпытная\b/u },
  { locale: 'de', re: /\bBartenderin\b/u },
  { locale: 'fr', re: /\bmotivée\b/iu },
  { locale: 'it', re: /\bmotivata\b/iu },
];

function normalizeLoose(text: string): string {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function collectMatches(text: string, patterns: RegExp[]): string[] {
  const out: string[] = [];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[0]) out.push(m[0]);
  }
  return out;
}

function canonicalDutyCorpus(factSet: CvCanonicalFactSet): string {
  return factSet.facts
    .filter((f) => f.type === 'experience_bullet' || f.type === 'summary')
    .map((f) => f.value.toLowerCase())
    .join('\n');
}

function dutySupportedByCanonical(matched: string, corpus: string): boolean {
  const token = matched.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!token) return true;
  if (corpus.includes(token)) return true;
  // Allow short stem overlap when the source already mentions the concept.
  const stem = token.slice(0, Math.min(6, token.length));
  return stem.length >= 4 && corpus.includes(stem);
}

export function validateSummaryCompleteness(
  summary: string,
  options?: { locale?: Locale | string },
): CvFidelityResult {
  const violations: CvFidelityViolation[] = [];
  const text = summary.trim();
  if (!text) {
    return { valid: true, violations: [] };
  }

  // Mid-word / unfinished Devanagari endings and conjunctions
  for (const matched of collectMatches(text, SUMMARY_INCOMPLETE_PATTERNS)) {
    violations.push({
      kind: 'summary_incomplete',
      matched,
      section: 'summary',
      evidence: options?.locale ? `locale=${options.locale}` : undefined,
    });
  }

  // Ends mid-word (Latin/Cyrillic letter without terminal punctuation and suspiciously short last token)
  const lastToken = text.split(/\s+/).pop() || '';
  if (
    lastToken.length > 0
    && !/[.!?…।۔]\s*$/u.test(text)
    && /^(?:karate|dengan|avec|mit|con|bei|für)$/iu.test(lastToken)
  ) {
    violations.push({ kind: 'summary_incomplete', matched: lastToken, section: 'summary' });
  }

  // Unmatched brackets / quotes
  const pairs: Array<[string, string]> = [['(', ')'], ['[', ']'], ['{', '}'], ['«', '»'], ['„', '“']];
  for (const [open, close] of pairs) {
    const o = (text.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const c = (text.match(new RegExp(`\\${close}`, 'g')) || []).length;
    if (o !== c) {
      violations.push({ kind: 'summary_incomplete', matched: `${open}${close}`, section: 'summary' });
    }
  }

  // Hindi: truncated participle / auxiliary without completion
  if ((options?.locale === 'hi' || /[\u0900-\u097F]/.test(text)) && /(?:करते|रहते|होते)\s*हु\s*$/u.test(text)) {
    violations.push({ kind: 'summary_incomplete', matched: 'करते हु', section: 'summary' });
  }

  // Empty / whitespace-only after trimming control chars
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    violations.push({ kind: 'summary_incomplete', matched: 'control-char', section: 'summary' });
  }

  return { valid: violations.length === 0, violations };
}

export function detectPerspectiveMix(
  text: string,
  options?: { locale?: Locale | string },
): string | null {
  const locale = (options?.locale || 'en') as string;
  // Avoid bare "je" (French 1st person AND South-Slavic copula) — keep checks locale-aware.
  const firstByLocale: Record<string, RegExp> = {
    en: /\b(I|my|me|we|our)\b/,
    de: /\b(ich|mein|meine|wir|unser)\b/i,
    es: /\b(yo|mi|mis|nosotros)\b/i,
    fr: /\b(je|j'|mon|ma|mes|nous)\b/i,
    it: /\b(io|mio|mia|miei|mie|noi)\b/i,
    sr: /\b(ja sam|moj|moja|moje)\b/i,
    hr: /\b(ja sam|moj|moja|moje)\b/i,
    ru: /\b(я|мой|моя|моё|мне)\b/i,
    'pt-BR': /\b(eu|meu|minha|nós)\b/i,
    hi: /\b(मैं|मेरा|मेरी|हम)\b/u,
    ar: /\b(أنا|لي|نحن)\b/u,
    ja: /私[はがをの]|わたし/,
  };
  const thirdByLocale: Record<string, RegExp> = {
    en: /\b(she|he|her|his|they|their)\b/i,
    de: /\b(sie ist|er ist|ihre|sein)\b/i,
    es: /\b(ella|él|su experiencia)\b/i,
    fr: /\b(elle|il)\b/i,
    it: /\b(lei|lui)\b/i,
    sr: /\b(ona je|on je)\b/i,
    hr: /\b(ona je|on je)\b/i,
    ru: /\b(она|он)\b/u,
    'pt-BR': /\b(ela|ele)\b/i,
    hi: /\b(वह|उसे)\b/u,
    ar: /\b(هي|هو)\b/u,
    ja: /彼女|彼は/,
  };
  const first = (firstByLocale[locale] || firstByLocale.en).test(text);
  const third = (thirdByLocale[locale] || thirdByLocale.en).test(text);
  if (first && third) return 'first+third';
  return null;
}

export function validateCvGenderForms(
  text: string,
  options: { locale?: Locale | string; gender?: CoverLetterGender | string },
): CvFidelityViolation[] {
  const gender = normalizeCoverLetterGender(options.gender);
  const locale = (options.locale || 'en') as Locale;
  const violations: CvFidelityViolation[] = [];
  if (gender === 'female') {
    for (const row of FEMALE_MISMATCH) {
      if (row.locale !== locale) continue;
      const m = text.match(row.re);
      if (m?.[0]) {
        violations.push({
          kind: 'gender_form_mismatch',
          matched: m[0],
          section: 'gender',
          evidence: `locale=${locale} stage=gender`,
        });
      }
    }
  }
  if (gender === 'male') {
    for (const row of MALE_MISMATCH) {
      if (row.locale !== locale) continue;
      const m = text.match(row.re);
      if (m?.[0]) {
        violations.push({
          kind: 'gender_form_mismatch',
          matched: m[0],
          section: 'gender',
          evidence: `locale=${locale}`,
        });
      }
    }
  }
  return violations;
}

export function validateLocalizedExperienceBullets(
  localizedDescription: string,
  factSet: CvCanonicalFactSet,
  options: {
    locale?: Locale | string;
    gender?: CoverLetterGender | string;
    experienceIndex?: number;
    stage?: string;
  },
): CvFidelityResult {
  const violations: CvFidelityViolation[] = [];
  const experienceIndex = options.experienceIndex ?? 0;
  const canonical = bulletsForExperience(factSet, experienceIndex);
  const localized = splitExperienceBullets(localizedDescription);
  const diag = [
    options.locale ? `locale=${options.locale}` : '',
    options.stage ? `stage=${options.stage}` : '',
    `section=experience-${experienceIndex}`,
  ]
    .filter(Boolean)
    .join(' ');

  if (canonical.length > 0 && localized.length !== canonical.length) {
    violations.push({
      kind: 'bullet_count_mismatch',
      matched: `${localized.length}!=${canonical.length}`,
      section: `experience-${experienceIndex}`,
      evidence: diag,
    });
  }

  const corpus = canonicalDutyCorpus(factSet);
  const joined = normalizeLoose(localizedDescription);
  for (const matched of collectMatches(joined, UNSUPPORTED_DUTY_PATTERNS)) {
    if (dutySupportedByCanonical(matched, corpus)) continue;
    violations.push({
      kind: 'unsupported_duty',
      matched,
      section: `experience-${experienceIndex}`,
      evidence: diag,
    });
  }

  for (const row of LOCALE_QUALITY_PATTERNS) {
    if (row.locale && options.locale && row.locale !== options.locale) continue;
    const m = joined.match(row.re);
    if (m?.[0]) {
      violations.push({
        kind: row.kind || 'locale_quality',
        matched: m[0],
        section: `experience-${experienceIndex}`,
        evidence: diag,
      });
    }
  }

  violations.push(...validateCvGenderForms(joined, options));
  return { valid: violations.length === 0, violations };
}

export function validateLocalizedSummary(
  localizedSummary: string,
  factSet: CvCanonicalFactSet,
  options: {
    locale?: Locale | string;
    gender?: CoverLetterGender | string;
    stage?: string;
  },
): CvFidelityResult {
  const violations: CvFidelityViolation[] = [];
  const completeness = validateSummaryCompleteness(localizedSummary, options);
  violations.push(...completeness.violations);

  const corpus = canonicalDutyCorpus(factSet);
  const joined = normalizeLoose(localizedSummary);
  for (const matched of collectMatches(joined, UNSUPPORTED_DUTY_PATTERNS)) {
    if (dutySupportedByCanonical(matched, corpus)) continue;
    violations.push({
      kind: 'unsupported_duty',
      matched,
      section: 'summary',
      factId: 'summary-0',
      evidence: [options.locale && `locale=${options.locale}`, options.stage && `stage=${options.stage}`]
        .filter(Boolean)
        .join(' '),
    });
  }

  const mix = detectPerspectiveMix(joined, { locale: options.locale });
  if (mix) {
    violations.push({ kind: 'perspective_mix', matched: mix, section: 'summary' });
  }

  for (const row of LOCALE_QUALITY_PATTERNS) {
    if (row.locale && options.locale && row.locale !== options.locale) continue;
    const m = joined.match(row.re);
    if (m?.[0]) {
      violations.push({
        kind: row.kind || 'locale_quality',
        matched: m[0],
        section: 'summary',
        factId: 'summary-0',
      });
    }
  }

  violations.push(...validateCvGenderForms(joined, options));
  return { valid: violations.length === 0, violations };
}

export function validateLocalizedCvPayload(
  localized: { summary?: string; experienceDescriptions?: string[] },
  sourceCv: Parameters<typeof buildCvCanonicalFactSet>[0],
  options: { locale?: Locale | string; gender?: CoverLetterGender | string; stage?: string },
): CvFidelityResult {
  const factSet = buildCvCanonicalFactSet(sourceCv, { localeHint: options.locale });
  const violations: CvFidelityViolation[] = [];
  if (typeof localized.summary === 'string') {
    violations.push(...validateLocalizedSummary(localized.summary, factSet, options).violations);
  }
  (localized.experienceDescriptions ?? []).forEach((desc, experienceIndex) => {
    violations.push(
      ...validateLocalizedExperienceBullets(desc, factSet, { ...options, experienceIndex }).violations,
    );
  });
  return { valid: violations.length === 0, violations };
}

export function formatCvFidelityViolationsForPrompt(violations: CvFidelityViolation[]): string {
  if (!violations.length) return '(none)';
  return violations
    .slice(0, 20)
    .map((v) => `- ${v.kind}${v.factId ? ` id=${v.factId}` : ''}${v.section ? ` section=${v.section}` : ''}: ${v.matched}`)
    .join('\n');
}
