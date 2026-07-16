/**
 * Semantic fidelity + summary completeness + CV gender/locale quality for AI localization.
 */
import type { Locale } from './i18n/translations';
import {
  bulletsForExperience,
  buildCvCanonicalFactSet,
  classifyDutyCategory,
  DUTY_CATEGORY_PRESENCE,
  GUEST_DUTY_REPLACEMENT,
  RECIPE_INVENTION,
  type CvCanonicalFactSet,
  type CvDutyCategory,
  splitExperienceBullets,
} from './cv-canonical-facts';
import { normalizeCoverLetterGender, type CoverLetterGender } from './cover-letter-gender';
import {
  type ExperienceDuration,
  validateSummaryDuration,
} from './cv-experience-duration';
import { localizeCvLanguageLevel } from './cv-language-levels';
import { isValidOccupationalTitle } from './cv-role-title';

export type CvFidelityViolationKind =
  | 'unsupported_duty'
  | 'bullet_count_mismatch'
  | 'material_duty_removed'
  | 'duty_replaced'
  | 'meta_changed'
  | 'summary_incomplete'
  | 'perspective_mix'
  | 'gender_form_mismatch'
  | 'locale_quality'
  | 'language_level_mismatch'
  | 'experience_duration_mismatch'
  | 'summary_sentence_fragment'
  | 'summary_duration_misplaced'
  | 'generic_summary_template_leak'
  | 'unsupported_summary_fact'
  | 'unsupported_achievement_or_impact'
  | 'current_role_tense_mismatch'
  | 'mixed_locale_proficiency'
  | 'invalid_occupational_title_in_summary';

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
  /customer satisfaction|ग्राहक संतुष्टि सुनिश्चित|obogaćuje kao profesional/iu,
  RECIPE_INVENTION,
];

const SUMMARY_INCOMPLETE_PATTERNS: RegExp[] = [
  /करते\s*हु\s*$/u,
  /करते\s*हुए\s*$/u,
  /मैंअप\s*$/u,
  /आगेचलकर\s*मैंअप\s*$/u,
  /आगे\s*चलकर\s*मैं\s*अप\s*$/u,
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
  /\bi\s+trajno\s*$/iu,
  /\bi\s+kontinuirano\s*$/iu,
  /\bkao\s+i\s*$/iu,
  /\bs\s+ciljem\s+da\s*$/iu,
  /\bkvalitet\s+i\s+trajno\s*$/iu,
  /\borganizacijama\s+koje\s+cene\s+efikasnost,\s+kvalitet\s+i\s+trajno\s*$/iu,
  /\b(trajno|kontinuirano|efikasnost|kvalitet)\s*$/iu,
];

const GENERIC_TEMPLATE_PATTERNS: Array<{ locale?: Locale; re: RegExp }> = [
  { locale: 'hi', re: /पेशेवर के पास प्रासंगिक अनुभव है/u },
  { locale: 'hi', re: /उम्मीदवार के पास आवश्यक कौशल हैं/u },
  { locale: 'en', re: /\bThe candidate has relevant experience\b/iu },
  { locale: 'en', re: /\bThe professional has the necessary skills\b/iu },
  { locale: 'en', re: /\bProfessional with relevant experience\b/iu },
  { locale: 'sr', re: /\bKandidat ima relevantno iskustvo\b/iu },
  { locale: 'sr', re: /\bProfesionalac poseduje potrebne veštine\b/iu },
  { locale: 'sr', re: /\bsa relevantnim iskustvom\b/iu },
  { locale: 'hr', re: /\bs relevantnim iskustvom\b/iu },
];

const UNSUPPORTED_ACHIEVEMENT_PATTERNS: RegExp[] = [
  /stabilnijem\s+funkcionisanju\s+organizacije/iu,
  /samouvereno\s+savladava\s+izazove/iu,
  /poveže\s+različite\s+sektore/iu,
  /partnerima\s+iz\s+različitih\s+zemalja/iu,
  /produktivn\w*\s+saradnj\w*\s+sa\s+partnerima/iu,
  /improved\s+organizational\s+stability/iu,
  /international\s+partners?/iu,
  /exceptional\s+confidence/iu,
  /organizational\s+transformation/iu,
];

const SUMMARY_CATEGORY_MARKERS: Record<Exclude<CvDutyCategory, 'generic'>, RegExp> = {
  inventory_stock:
    /(stock\s*level|inventory\s*count|supply\s*need|zalih|inventar|skladišt|स्टॉक|इन्वेंटरी|आपूर्ति|مخزون|replenish|dopun)/iu,
  beverage_service:
    /(bartend|cocktail|koktel|bar\s+service|कॉकटेल|पेय\s+तैयार)/iu,
  customer_service_guest_relationship:
    /(guest\s+service|gostima|ग्राहक\s+सेवा|atentive\s+customer)/iu,
  hygiene_safety:
    /(bar\s+area|higijen|hygiene\s+standard|स्वच्छता\s+मानक)/iu,
};

const SR_PAST_CURRENT_ROLE = /\b(Radila\s+sam|Analizirala\s+sam|Učestvovala\s+sam|Kreirala\s+sam|Izrađivala\s+sam|Pratila\s+sam|Radio\s+sam|Analizirao\s+sam|Učestvovao\s+sam|Kreirao\s+sam|Izrađivao\s+sam|Pratio\s+sam)\b/giu;
const SR_PRESENT_CURRENT_ROLE = /\b(Radim|Sarađujem|Analiziram|Učestvujem|Kreiram|Izrađujem|Pratim)\b/giu;

const SR_KNOWN_LEVELS = /\b(Napredni|Tečan|Srednji|Osnovni|Maternji)\b/u;
const EN_KNOWN_LEVELS = /\b(Advanced|Fluent|Intermediate|Basic|Native)\b/i;
const HI_KNOWN_LEVELS = /(उन्नत|प्रवाहपूर्ण|धाराप्रवाह|मध्यम|बुनियादी|मातृभाषा)/u;

const LOCALE_QUALITY_PATTERNS: Array<{ locale?: Locale; re: RegExp; kind?: CvFidelityViolationKind }> = [
  { locale: 'sr', re: /\bspreman je\b/iu, kind: 'gender_form_mismatch' },
  { locale: 'sr', re: /\bprateći tehnikama\b/iu, kind: 'locale_quality' },
  { locale: 'sr', re: /\bkokteile\b/iu, kind: 'locale_quality' },
  { locale: 'sr', re: /\bbartening/iu, kind: 'locale_quality' },
  { locale: 'sr', re: /\bsrednje\s+napredn/iu, kind: 'language_level_mismatch' },
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
  { locale: 'hi', re: /रिक्लेमेशन/u, kind: 'locale_quality' },
  { locale: 'sr', re: /\bobogaćuje\b/iu, kind: 'locale_quality' },
  { locale: 'sr', re: /Izrada izveštaja dodatno/iu, kind: 'locale_quality' },
  { locale: 'hi', re: /ग्राहक संतुष्टि सुनिश्चित/u, kind: 'locale_quality' },
  { locale: 'hi', re: /जिससे ग्राहक संतुष्टि/u, kind: 'locale_quality' },
  { locale: 'hi', re: /शिकायतों\s+और\s+आपत्तियों/u, kind: 'locale_quality' },
  { locale: 'sr', re: /čini\s+(?:je\s+)?vrednim\s+članom/iu, kind: 'gender_form_mismatch' },
  { locale: 'sr', re: /čini\s+(?:je\s+)?pouzdanim\s+članom/iu, kind: 'gender_form_mismatch' },
  { locale: 'sr', re: /čini\s+(?:je\s+)?važnim\s+članom/iu, kind: 'gender_form_mismatch' },
  { locale: 'hr', re: /čini\s+(?:je\s+)?vrednim\s+članom/iu, kind: 'gender_form_mismatch' },
];

/**
 * A "sentence" consisting solely of a dependent duration clause (no finite verb / subject).
 * These are never valid as a standalone sentence — the duration must be woven into a
 * complete clause with a subject and a verb (e.g. "<Role> ... with ~N years of experience.").
 */
const DURATION_ONLY_FRAGMENT_PATTERNS: RegExp[] = [
  /^with\s+(?:around|about|approximately)?\s*[\w.-]+\+?\s+years?\s+of\s+experience\.?$/iu,
  /^mit\s+(?:etwa|ca\.?)?\s*[\wäöüß.-]+\s+jahren?\s+erfahrung\.?$/iu,
  /^con\s+(?:alrededor de|circa)?\s*[\w.-]+\s+años\s+de\s+experiencia\.?$/iu,
  /^avec\s+(?:environ)?\s*[\w.-]+\s+ans\s+d'expérience\.?$/iu,
  /^con\s+(?:circa)?\s*[\w.-]+\s+anni\s+di\s+esperienza\.?$/iu,
  /^com\s+(?:cerca de)?\s*[\w.-]+\s+anos\s+de\s+experiência\.?$/iu,
  /^sa\s+oko\s+[\wčćžšđ.-]+\s+godina\s+iskustva\.?$/iu,
  /^s\s+oko\s+[\wčćžšđ.-]+\s+godina\s+iskustva\.?$/iu,
  /^लगभग\s+\S+\s+वर्षों\s+के\s+अनुभव\s+के\s+साथ।?$/u,
  /^करीब\s+\S+\s+वर्षों\s+के\s+अनुभव\s+के\s+साथ।?$/u,
  /^लगभग\s+\d+\s+महीनों।?$/u,
  /^約\s*[\w0-9]+\s*年の経験。?$/u,
];

/** True when a single sentence is nothing but a dependent duration clause (no subject/verb). */
export function isDurationOnlyFragmentSentence(sentence: string): boolean {
  const s = (sentence || '').trim();
  if (!s) return false;
  return DURATION_ONLY_FRAGMENT_PATTERNS.some((re) => re.test(s));
}

/** Unsupported invented outcome / fluff phrases stripped from summaries. */
export const UNSUPPORTED_SUMMARY_FLUFF: Array<{ locale?: Locale; re: RegExp }> = [
  { locale: 'sr', re: /[^.?!]*\bobogaćuje\b[^.?!]*[.?!]?/giu },
  { locale: 'sr', re: /Izrada izveštaja dodatno[^.?!]*[.?!]?/giu },
  { locale: 'sr', re: /[^.?!]*\bdoprinela\s+stabilnijem\s+funkcionisanju[^.?!]*[.?!]?/giu },
  { locale: 'sr', re: /[^.?!]*\bproduktivn\w*\s+saradnj\w*\s+sa\s+partnerima[^.?!]*[.?!]?/giu },
  { locale: 'sr', re: /[^.?!]*\bsamouvereno\s+savladava\s+izazove[^.?!]*[.?!]?/giu },
  { locale: 'sr', re: /[^.?!]*\bpoveže\s+različite\s+sektore[^.?!]*[.?!]?/giu },
  { locale: 'hi', re: /,?\s*जिससे ग्राहक संतुष्टि सुनिश्चित होती है।?/gu },
  { locale: 'hi', re: /ग्राहक संतुष्टि सुनिश्चित होती है।?/gu },
  { locale: 'hi', re: /पेशेवर के पास प्रासंगिक अनुभव है।?/gu },
  { locale: 'hi', re: /[^।.!?]*(?:स्टॉक\s+स्तर|इन्वेंटरी\s+गणना|आपूर्ति\s+आवश्यक)[^।.!?]*[।.!?]?/gu },
];

/** True when a Hindi duration clause is comma-spliced after an unrelated finite verb. */
export function hasMisplacedHindiDuration(summary: string): boolean {
  const sentences = (summary || '').split(/(?<=[।.!?])\s+/u).map((s) => s.trim()).filter(Boolean);
  for (const sent of sentences) {
    if (!sent) continue;
    // Valid: duration integrated at the beginning of the sentence.
    if (/^(?:लगभग|करीब)\s+\S+\s+वर्ष/u.test(sent)) continue;
    if (/^मैं\s+(?:लगभग|करीब)/u.test(sent)) continue;
    if (/^.{0,80}?(?:लगभग|करीब)\s+\S+\s+वर्षों?\s+(?:के\s+अनुभव\s+)?(?:वाला|वाली|का)\b/u.test(sent)) {
      continue;
    }
    // Invalid: trailing duration modifier after a comma following a finite verb.
    if (
      /(?:करती|करता|देती|देता|प्रदान\s+करती|प्रदान\s+करता|किया|रखती|रखता|दर्ज\s+करती|दर्ज\s+करता)\s*(?:हूँ|है|थी|था)/u.test(sent)
      && /,\s*(?:लगभग|करीब)\s+\S+\s+वर्षों?\s*(?:के\s+अनुभव)?\s*के\s+साथ\s*[।.!?]?\s*$/u.test(sent)
    ) {
      return true;
    }
    if (/,\s*(?:लगभग|करीब)\s+\S+\s+वर्ष[^।.!?]{0,40}के\s+अनुभव\s+के\s+साथ/u.test(sent)) {
      return true;
    }
  }
  return false;
}

const FEMALE_MISMATCH: Array<{ locale: Locale; re: RegExp }> = [
  { locale: 'sr', re: /čini\s+(?:je\s+)?vrednim\s+članom/iu },
  { locale: 'sr', re: /čini\s+(?:je\s+)?pouzdanim\s+članom/iu },
  { locale: 'sr', re: /čini\s+(?:je\s+)?važnim\s+članom/iu },
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

function canonicalDutyCategories(factSet: CvCanonicalFactSet): Set<CvDutyCategory> {
  const cats = new Set<CvDutyCategory>();
  for (const fact of factSet.facts) {
    if (fact.type !== 'experience_bullet') continue;
    cats.add(fact.category || classifyDutyCategory(fact.sourceText || fact.value));
  }
  return cats;
}

function validateGenericTemplateLeak(
  text: string,
  locale?: Locale | string,
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  for (const row of GENERIC_TEMPLATE_PATTERNS) {
    if (row.locale && locale && row.locale !== locale) continue;
    const m = text.match(row.re);
    if (m?.[0]) {
      violations.push({
        kind: 'generic_summary_template_leak',
        matched: m[0],
        section: 'summary',
      });
    }
  }
  return violations;
}

function validateSummaryFactGrounding(
  summary: string,
  factSet: CvCanonicalFactSet,
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  const cats = canonicalDutyCategories(factSet);
  const joined = normalizeLoose(summary);
  const categories = Object.keys(SUMMARY_CATEGORY_MARKERS) as Array<Exclude<CvDutyCategory, 'generic'>>;
  for (const category of categories) {
    if (cats.has(category)) continue;
    const m = joined.match(SUMMARY_CATEGORY_MARKERS[category]);
    if (m?.[0]) {
      violations.push({
        kind: 'unsupported_summary_fact',
        matched: `${category}:${m[0]}`,
        section: 'summary',
        evidence: 'category-drift',
      });
    }
  }
  return violations;
}

function validateUnsupportedAchievements(
  summary: string,
  factSet: CvCanonicalFactSet,
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  const corpus = canonicalDutyCorpus(factSet);
  for (const re of UNSUPPORTED_ACHIEVEMENT_PATTERNS) {
    const m = summary.match(re);
    if (!m?.[0]) continue;
    if (corpus.includes(m[0].toLowerCase().slice(0, Math.min(12, m[0].length)))) continue;
    violations.push({
      kind: 'unsupported_achievement_or_impact',
      matched: m[0],
      section: 'summary',
    });
  }
  return violations;
}

export function validateSummaryOccupationalTitle(
  summary: string,
  options: { locale?: Locale | string; resolvedRole?: string; experienceTitle?: string },
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  const locale = options.locale;
  const expTitle = (options.experienceTitle || '').trim();
  if (expTitle && !isValidOccupationalTitle(expTitle)) {
    const escaped = expTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (locale === 'hi' && new RegExp(`मैं\\s+[^।]{0,120}?\\b${escaped}\\b\\s+हूँ`, 'u').test(summary)) {
      violations.push({
        kind: 'invalid_occupational_title_in_summary',
        matched: expTitle,
        section: 'summary',
      });
    }
    if ((locale === 'sr' || locale === 'hr') && new RegExp(`\\b${escaped}\\b`, 'iu').test(summary)) {
      violations.push({
        kind: 'invalid_occupational_title_in_summary',
        matched: expTitle,
        section: 'summary',
      });
    }
  }
  if (locale === 'hi' && /\bV\b/u.test(summary) && /मैं\s+[^।]{0,80}?\bV\b\s+हूँ/u.test(summary)) {
    violations.push({
      kind: 'invalid_occupational_title_in_summary',
      matched: 'V',
      section: 'summary',
    });
  }
  return violations;
}

export function validateCurrentRoleTenseMix(
  text: string,
  locale: Locale | string,
  isPresent: boolean,
): CvFidelityViolation[] {
  if (!isPresent) return [];
  const violations: CvFidelityViolation[] = [];
  if (locale === 'sr' || locale === 'hr') {
    const hasPast = SR_PAST_CURRENT_ROLE.test(text);
    const hasPresent = SR_PRESENT_CURRENT_ROLE.test(text);
    SR_PAST_CURRENT_ROLE.lastIndex = 0;
    SR_PRESENT_CURRENT_ROLE.lastIndex = 0;
    if (hasPast && hasPresent) {
      violations.push({
        kind: 'current_role_tense_mismatch',
        matched: 'mixed-sr-past-present',
        section: 'experience',
      });
    } else if (hasPast && !hasPresent) {
      const m = text.match(SR_PAST_CURRENT_ROLE);
      if (m?.[0]) {
        violations.push({
          kind: 'current_role_tense_mismatch',
          matched: m[0],
          section: 'experience',
        });
      }
    }
  }
  if (locale === 'hi' && isPresent) {
    const pastHabitual = /(करती\s+थी|करता\s+था)/u.test(text);
    const presentProg = /(कर\s+रही\s+हूँ|कर\s+रहा\s+हूँ)/u.test(text);
    const presentSimple = /(करती\s+हूँ|करता\s+हूँ)/u.test(text);
    if (pastHabitual && (presentProg || presentSimple)) {
      violations.push({
        kind: 'current_role_tense_mismatch',
        matched: 'mixed-hi-past-present',
        section: 'experience',
      });
    }
  }
  return violations;
}

export function validateMixedLocaleProficiency(
  languages: Array<{ name?: string; level?: string }>,
  locale: Locale | string,
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  for (const lang of languages) {
    const level = (lang.level || '').trim();
    if (!level) continue;
    const localized = localizeCvLanguageLevel(level, locale as Locale);
    if (locale === 'hi') {
      if (SR_KNOWN_LEVELS.test(level) || SR_KNOWN_LEVELS.test(localized)) {
        violations.push({
          kind: 'mixed_locale_proficiency',
          matched: localized || level,
          section: 'languages',
        });
      } else if (EN_KNOWN_LEVELS.test(level) && !HI_KNOWN_LEVELS.test(localized)) {
        violations.push({
          kind: 'mixed_locale_proficiency',
          matched: level,
          section: 'languages',
        });
      }
    }
    if (locale === 'sr' || locale === 'hr') {
      if (HI_KNOWN_LEVELS.test(level) || EN_KNOWN_LEVELS.test(level)) {
        violations.push({
          kind: 'mixed_locale_proficiency',
          matched: level,
          section: 'languages',
        });
      }
    }
  }
  return violations;
}

function dutySupportedByCanonical(matched: string, corpus: string): boolean {
  const token = matched.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!token) return true;
  if (corpus.includes(token)) return true;
  // Allow short stem overlap when the source already mentions the concept.
  const stem = token.slice(0, Math.min(6, token.length));
  return stem.length >= 4 && corpus.includes(stem);
}

function isDevanagariHeavy(text: string): boolean {
  const letters = text.replace(/\s+/g, '');
  if (!letters) return false;
  const dev = (letters.match(/[\u0900-\u097F]/g) || []).length;
  return dev / letters.length >= 0.35;
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
  const locale = options?.locale;

  // Mid-word / unfinished Devanagari endings and conjunctions
  for (const matched of collectMatches(text, SUMMARY_INCOMPLETE_PATTERNS)) {
    violations.push({
      kind: 'summary_incomplete',
      matched,
      section: 'summary',
      evidence: locale ? `locale=${locale}` : undefined,
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

  // Hindi / Devanagari: reject build-214 style mid-token stubs (`आगेचलकर मैंअप`)
  const hindiLocale = locale === 'hi' || isDevanagariHeavy(text);
  if (hindiLocale) {
    if (
      /(?:करते|रहते|होते)\s*हु\s*$/u.test(text)
      || /मैंअप/u.test(text)
      || (/आगेचलकर/u.test(text) && text.length < 80)
    ) {
      violations.push({
        kind: 'summary_incomplete',
        matched: text.slice(-24),
        section: 'summary',
        evidence: 'hindi-mid-token',
      });
    }
    // Devanagari-heavy text must finish a sentence. Locale=hi with Latin fallback
    // (export recovery) still needs terminal punctuation.
    if (!/[।.!?…]\s*$/u.test(text)) {
      violations.push({
        kind: 'summary_incomplete',
        matched: 'missing-sentence-end',
        section: 'summary',
        evidence: 'hindi-no-terminal-punct',
      });
    }
    if (
      isDevanagariHeavy(text)
      && lastToken
      && /^[\u0900-\u097F]{1,8}$/u.test(lastToken)
      && !/[।.!?…]\s*$/u.test(text)
    ) {
      violations.push({ kind: 'summary_incomplete', matched: lastToken, section: 'summary' });
    }
    // Duration clause comma-spliced after an unrelated finite verb (not at sentence start).
    if (hasMisplacedHindiDuration(text)) {
      violations.push({
        kind: 'summary_duration_misplaced',
        matched: text.match(
          /,\s*(?:लगभग|करीब)\s+\S+\s+वर्ष[^।.!?]{0,60}के\s+अनुभव\s+के\s+साथ[^।.!?]*[।.!?]?/u,
        )?.[0] || 'misplaced-hindi-duration',
        section: 'summary',
        evidence: 'hindi-trailing-duration',
      });
    }
  }

  // Empty / whitespace-only after trimming control chars
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) {
    violations.push({ kind: 'summary_incomplete', matched: 'control-char', section: 'summary' });
  }

  const srLocale = locale === 'sr' || locale === 'hr';
  if (srLocale) {
    if (!/[.!?…]\s*$/u.test(text)) {
      violations.push({
        kind: 'summary_incomplete',
        matched: 'missing-sentence-end',
        section: 'summary',
        evidence: 'sr-no-terminal-punct',
      });
    }
    const lastWord = (text.split(/\s+/).pop() || '').replace(/[.,;:!?…]+$/u, '');
    if (
      lastWord
      && !/[.!?…]\s*$/u.test(text)
      && /^(trajno|kontinuirano|efikasnost|kvalitet|kao|i)$/iu.test(lastWord)
    ) {
      violations.push({
        kind: 'summary_incomplete',
        matched: lastWord,
        section: 'summary',
        evidence: 'sr-dangling-ending',
      });
    }
  }

  // Reject summaries that begin or end with a bare duration clause (no subject/verb) —
  // e.g. "With approximately five years of experience." / "लगभग पाँच वर्षों के अनुभव के साथ।"
  const fragmentSentences = text
    .split(/(?<=[।.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (fragmentSentences.length) {
    const first = fragmentSentences[0];
    if (isDurationOnlyFragmentSentence(first)) {
      violations.push({
        kind: 'summary_sentence_fragment',
        matched: first,
        section: 'summary',
        evidence: 'leading-duration-fragment',
      });
    }
    if (fragmentSentences.length > 1) {
      const last = fragmentSentences[fragmentSentences.length - 1];
      if (isDurationOnlyFragmentSentence(last)) {
        violations.push({
          kind: 'summary_sentence_fragment',
          matched: last,
          section: 'summary',
          evidence: 'trailing-duration-fragment',
        });
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

function localizedPreservesCategory(localized: string, category: CvDutyCategory): boolean {
  if (category === 'generic') return true;
  return DUTY_CATEGORY_PRESENCE[category].test(localized);
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
    isPresent?: boolean;
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

  // Per-bullet semantic lock: category + guest/inventory anchors must survive localization.
  const pairCount = Math.min(canonical.length, localized.length);
  for (let i = 0; i < pairCount; i += 1) {
    const fact = canonical[i];
    const category = fact.category || classifyDutyCategory(fact.sourceText || fact.value);
    const loc = localized[i];
    if (!localizedPreservesCategory(loc, category)) {
      violations.push({
        kind: 'material_duty_removed',
        matched: category,
        factId: fact.id,
        section: `experience-${experienceIndex}`,
        evidence: diag,
      });
    }
    if (
      category === 'customer_service_guest_relationship'
      && GUEST_DUTY_REPLACEMENT.test(loc)
      && !DUTY_CATEGORY_PRESENCE.customer_service_guest_relationship.test(loc)
    ) {
      violations.push({
        kind: 'duty_replaced',
        matched: 'guest→colleague',
        factId: fact.id,
        section: `experience-${experienceIndex}`,
        evidence: diag,
      });
    }
    if (
      category === 'inventory_stock'
      && /\b(dopunjav|replenish|nadopun)/iu.test(loc)
      && !/\b(inventory|inventar|conteggio|count|zalih|manag|uprav|communic|javlja|management)\b/iu.test(loc)
    ) {
      violations.push({
        kind: 'material_duty_removed',
        matched: 'inventory-communication-weakened',
        factId: fact.id,
        section: `experience-${experienceIndex}`,
        evidence: diag,
      });
    }
  }

  for (const matched of collectMatches(joined, UNSUPPORTED_DUTY_PATTERNS)) {
    if (dutySupportedByCanonical(matched, corpus)) continue;
    violations.push({
      kind: 'unsupported_duty',
      matched,
      section: `experience-${experienceIndex}`,
      evidence: diag,
    });
  }

  // Recipe inventions when canonical corpus has no recipe claim.
  if (RECIPE_INVENTION.test(joined) && !/recip|recept/iu.test(corpus)) {
    violations.push({
      kind: 'unsupported_duty',
      matched: 'recipe-invention',
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
  if (options.isPresent) {
    violations.push(...validateCurrentRoleTenseMix(joined, options.locale || 'en', true));
  }
  return { valid: violations.length === 0, violations };
}

export function validateLocalizedSummary(
  localizedSummary: string,
  factSet: CvCanonicalFactSet,
  options: {
    locale?: Locale | string;
    gender?: CoverLetterGender | string;
    stage?: string;
    /** When provided, duration year claims must match this shared snapshot. */
    expectedDuration?: ExperienceDuration;
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

  if (options.expectedDuration) {
    const durationCheck = validateSummaryDuration(localizedSummary, options.expectedDuration);
    if (!durationCheck.valid) {
      violations.push({
        kind: 'experience_duration_mismatch',
        matched: durationCheck.claims.join(',') || 'duration',
        section: 'summary',
        factId: 'summary-0',
        evidence: `expectedApproxYears=${options.expectedDuration.approxYears}`,
      });
    }
  }

  violations.push(...validateCvGenderForms(joined, options));
  violations.push(...validateGenericTemplateLeak(joined, options.locale));
  violations.push(...validateSummaryFactGrounding(joined, factSet));
  violations.push(...validateUnsupportedAchievements(joined, factSet));
  violations.push(...validateSummaryOccupationalTitle(joined, {
    locale: options.locale,
    experienceTitle: factSet.facts.find((f) => f.type === 'role')?.value,
  }));
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
