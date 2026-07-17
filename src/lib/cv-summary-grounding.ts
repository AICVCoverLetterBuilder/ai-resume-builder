/**
 * Professional Summary grounding: authoritative fact use, claim rejection,
 * skill-label handling, length caps, and concise deterministic fallbacks.
 *
 * Previous AI-generated summaries are never treated as factual grounding.
 */
import type { Locale } from './i18n/translations';
import type { CoverLetterGender } from './cover-letter-gender';
import { normalizeCoverLetterGender } from './cover-letter-gender';
import type { CvCanonicalFactSet } from './cv-canonical-facts';
import {
  formatApproximateDurationPhrase,
  type ExperienceDuration,
} from './cv-experience-duration';
import { validateMaterialDutyCoverage } from './cv-material-duty-coverage';
import {
  localizeBaker,
  localizeOccupationalTitleForProjection,
  resolveOccupationalTitleForSummary,
} from './cv-role-title';
import { getLocalizedCvSkillName } from './cv-skill-options';
import type { CvFidelityViolation, CvFidelityViolationKind } from './cv-semantic-fidelity';

export const SUMMARY_MAX_WORDS = 90;

/** Unsupported summary inventions (always reject — hygiene ≠ health/quality claims). */
const UNSUPPORTED_SUMMARY_CLAIM_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bhigh[- ]?quality\s+dishes?\b/iu, label: 'high-quality dishes' },
  { re: /उच्च[- ]?गुणवत्त[ाा]\s*(?:के\s*)?(?:व्यंजन|भोजन|dish)/iu, label: 'high-quality dishes' },
  { re: /\bhealth\s+standards?\b/iu, label: 'health standards' },
  { re: /स्वास्थ्य\s*(?:मानक|मानकों)/iu, label: 'health standards' },
  { re: /\bstrictly\b/iu, label: 'strictly' },
  { re: /कठोरता\s*से|सख्ती\s*से/iu, label: 'strictly' },
  { re: /\bfast[- ]?paced\b/iu, label: 'fast-paced environment' },
  { re: /\bunder\s+pressure\b/iu, label: 'under pressure' },
  { re: /pod\s+pritisk/iu, label: 'under pressure' },
  { re: /\brunning\s+smoothly\b/iu, label: 'running smoothly' },
  { re: /\boperational\s+efficiency\b/iu, label: 'operational efficiency' },
  { re: /\battention\s+to\s+detail\b/iu, label: 'attention to detail' },
  { re: /\bdedication\s+to\s+quality\b/iu, label: 'dedication to quality' },
  { re: /\bgenuine\s+dedication\b/iu, label: 'dedication' },
  { re: /\breliabilit(?:y|ies)\b/iu, label: 'reliability' },
  { re: /\bgreater\s+responsibility\b/iu, label: 'greater responsibility' },
  { re: /\bcareer\s+(?:focus|ambition|goal)/iu, label: 'career ambition' },
  { re: /\binternational\s+workplace/iu, label: 'international workplace' },
  { re: /\bcross[- ]?team\s+communication\b/iu, label: 'cross-team communication' },
  { re: /\bcommunicates?\s+effectively\b/iu, label: 'effective communication' },
  { re: /\bmeeting\s+service\s+expectations\b/iu, label: 'service expectations' },
  { re: /\bpresentation\s+standards?\b/iu, label: 'presentation standards' },
  { re: /prezentacij\w*\s+svakog\s+obrok/iu, label: 'presentation of every meal' },
  { re: /kvalitet\w*\s+i\s+prezentacij/iu, label: 'quality and presentation' },
  { re: /kvalitetu\s+i\s+prezentaciji/iu, label: 'quality and presentation' },
  { re: /dinamičn\w*\s+radn\w*\s+okružen/iu, label: 'dynamic work environment' },
  { re: /\bprofessional\s+kitchen\s+experience\b/iu, label: 'professional kitchen experience' },
  { re: /\buphold\s+quality\b/iu, label: 'uphold quality' },
  { re: /\bconsistent\s+performance\b/iu, label: 'consistent performance' },
  { re: /\btaking\s+on\s+greater\b/iu, label: 'greater responsibility' },
  { re: /\bcommitted\s+to\s+continued\s+growth\b/iu, label: 'career ambition' },
];

/** Skill labels converted into demonstrated achievements / personality. */
const SKILL_INFLATION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /demonstrated\s+leadership/iu, label: 'demonstrated leadership' },
  { re: /leadership\s+capabilities/iu, label: 'leadership capabilities' },
  { re: /liderske\s+kvalitet/iu, label: 'demonstrated leadership' },
  { re: /pokazujući\s+lidersk/iu, label: 'demonstrated leadership' },
  { re: /preuzimajući\s+inicijativ/iu, label: 'taking initiative' },
  { re: /\btook\s+initiative\b/iu, label: 'taking initiative' },
  { re: /\btaking\s+initiative\b/iu, label: 'taking initiative' },
  { re: /\bshowed\s+leadership\b/iu, label: 'demonstrated leadership' },
  { re: /razvijala\s+sam\s+veštine/iu, label: 'skill inflation as achievement' },
  { re: /applied\s+daily\s+to\s+uphold/iu, label: 'skills as performance proof' },
  { re: /strong\s+time\s+management.{0,40}applied/iu, label: 'skills as performance proof' },
  { re: /solved\s+complex\s+problems/iu, label: 'problem-solving achievement' },
  { re: /improved\s+efficiency/iu, label: 'efficiency achievement' },
  { re: /ensured\s+customer\s+satisfaction/iu, label: 'customer satisfaction' },
  { re: /led\s+(?:the\s+)?(?:team|kitchen)/iu, label: 'team leadership' },
  { re: /team[- ]?lead(?:er)?\b/iu, label: 'team leadership' },
  { re: /revenue\s+growth/iu, label: 'revenue growth' },
  { re: /route\s+planning/iu, label: 'route planning' },
  { re: /logistics\s+optimization/iu, label: 'logistics optimization' },
  { re: /medication\s+administration/iu, label: 'medication administration' },
];

const OCCUPATION_INFERENCE_PATTERNS: Array<{ re: RegExp; label: string; support?: RegExp }> = [
  { re: /\bmenu\s+development\b/iu, label: 'menu development' },
  {
    re: /\binventory\b/iu,
    label: 'inventory',
    // Warehouse/stock source may legitimately localize to inventory wording.
    support: /\binventory\b|skladišt|warehouse|stock|zalih|magacin|inventur/iu,
  },
  {
    re: /\bingredient\s+storage\b/iu,
    label: 'ingredient storage',
    support: /ingredient|namirnic|skladišt\w*\s+namirnic|भंडारण/iu,
  },
  {
    re: /सामग्री\s*भंडारण|भंडारण\s*प्रक्रिया/iu,
    label: 'ingredient storage',
    support: /ingredient|namirnic|भंडारण|skladišt\w*\s+namirnic/iu,
  },
  {
    re: /skladišt\w*\s+namirnic/iu,
    label: 'ingredient storage',
    support: /namirnic|ingredient|skladišt\w*\s+namirnic/iu,
  },
  {
    re: /\bfood\s+safety\b/iu,
    label: 'food safety',
    support: /food\s+safet|higijen|hygiene|bezbednost\s+hran/iu,
  },
];

export function countSummaryWords(text: string, locale?: string): number {
  const t = (text || '').replace(/\s+/g, ' ').trim();
  if (!t) return 0;
  if (locale === 'ja') {
    // Approximate: CJK characters count ~0.5 “words” for length budgeting.
    return Math.ceil([...t.replace(/\s/g, '')].length / 2);
  }
  return t.split(/\s+/).filter(Boolean).length;
}

function dutiesCorpus(factSet: CvCanonicalFactSet): string {
  // Authoritative grounding only — never previous AI summary text.
  return factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .map((f) => `${f.sourceText || ''} ${f.value || ''}`)
    .join('\n')
    .toLowerCase();
}

function claimSupportedInDuties(label: string, corpus: string): boolean {
  const token = label.toLowerCase().slice(0, 24);
  if (!token) return false;
  return corpus.includes(token);
}

export function validateSummaryUnsupportedClaims(
  summary: string,
  factSet: CvCanonicalFactSet,
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  const corpus = dutiesCorpus(factSet);
  for (const row of UNSUPPORTED_SUMMARY_CLAIM_PATTERNS) {
    const m = summary.match(row.re);
    if (!m?.[0]) continue;
    if (claimSupportedInDuties(row.label, corpus)) continue;
    violations.push({
      kind: 'unsupported_summary_claim' as CvFidelityViolationKind,
      matched: row.label,
      section: 'summary',
      evidence: m[0],
    });
  }
  for (const row of OCCUPATION_INFERENCE_PATTERNS) {
    const m = summary.match(row.re);
    if (!m?.[0]) continue;
    if (row.support?.test(corpus) || claimSupportedInDuties(row.label, corpus) || row.re.test(corpus)) {
      continue;
    }
    violations.push({
      kind: 'occupation_inference' as CvFidelityViolationKind,
      matched: row.label,
      section: 'summary',
      evidence: m[0],
    });
  }
  return violations;
}

export function validateSummarySkillInflation(summary: string): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  for (const row of SKILL_INFLATION_PATTERNS) {
    const m = summary.match(row.re);
    if (!m?.[0]) continue;
    violations.push({
      kind: 'skill_inflation' as CvFidelityViolationKind,
      matched: row.label,
      section: 'summary',
      evidence: m[0],
    });
  }
  return violations;
}

export function validateSummaryLength(
  summary: string,
  locale?: string,
): CvFidelityViolation[] {
  const words = countSummaryWords(summary, locale);
  if (words > SUMMARY_MAX_WORDS) {
    return [{
      kind: 'summary_too_long' as CvFidelityViolationKind,
      matched: `${words} words, maximum ${SUMMARY_MAX_WORDS}`,
      section: 'summary',
      evidence: `wordCount=${words}`,
    }];
  }
  return [];
}

/**
 * Baker + female + sr/hr must use Pekarka, never Pekara (bakery) or male Pekar alone.
 */
export function validateSummaryGenderOccupation(
  summary: string,
  factSet: CvCanonicalFactSet,
  options: { locale?: Locale | string; gender?: CoverLetterGender | string },
): CvFidelityViolation[] {
  const violations: CvFidelityViolation[] = [];
  const locale = (options.locale || 'en') as Locale;
  const gender = normalizeCoverLetterGender(options.gender);
  const titles = factSet.facts
    .filter((f) => f.type === 'job_title' || f.type === 'role')
    .map((f) => f.value || '')
    .join(' ');
  const isBaker = /baker|pekar|bäcker|बेकर|خباز|ベイカー/iu.test(titles);
  if (!isBaker) return violations;

  if ((locale === 'sr' || locale === 'hr') && gender === 'female') {
    if (/\bPekara\b/.test(summary)) {
      violations.push({
        kind: 'summary_gender_mismatch' as CvFidelityViolationKind,
        matched: 'Pekara is not female Baker; use Pekarka',
        section: 'summary',
      });
    } else if (/\bPekar\b/.test(summary) && !/\bPekarka\b/.test(summary)) {
      violations.push({
        kind: 'summary_gender_mismatch' as CvFidelityViolationKind,
        matched: 'Pekar is male form; female Baker is Pekarka',
        section: 'summary',
      });
    }
  }
  if ((locale === 'sr' || locale === 'hr') && gender === 'male' && /\bPekarka\b/.test(summary)) {
    violations.push({
      kind: 'summary_gender_mismatch' as CvFidelityViolationKind,
      matched: 'Pekarka is female form; male Baker is Pekar',
      section: 'summary',
    });
  }
  return violations;
}

const COOKING_SUMMARY_KEYS = new Set([
  'food_prep',
  'hygiene_workplace',
  'kitchen_collaboration',
]);

export function validateSummaryMaterialFacts(
  summary: string,
  factSet: CvCanonicalFactSet,
): CvFidelityViolation[] {
  const source = factSet.facts
    .filter((f) => f.type === 'experience_bullet')
    .map((f) => f.sourceText || f.value)
    .join('\n');
  if (!source.trim()) return [];
  const coverage = validateMaterialDutyCoverage(source, summary);
  if (coverage.valid) return [];
  // Hard-require only cooking material triad (Baker/Cook fixtures). Broader CVs
  // may omit secondary office duties for length without failing activation.
  const requiredCooking = coverage.required.filter((k) => COOKING_SUMMARY_KEYS.has(k));
  if (requiredCooking.length < 2) return [];
  const missingCooking = coverage.missing.filter((k) => COOKING_SUMMARY_KEYS.has(k));
  return missingCooking.map((key) => ({
    kind: 'summary_missing_material_fact' as CvFidelityViolationKind,
    matched: key,
    section: 'summary',
  }));
}

export function validateSummaryEmploymentStatus(
  summary: string,
  factSet: CvCanonicalFactSet,
): CvFidelityViolation[] {
  const dates = factSet.facts.filter((f) => f.type === 'dates').map((f) => f.value.toLowerCase());
  const hasPresent = dates.some((d) => /present|current|danas|сегодня|ปัจจุบัน/.test(d) || d.includes('present'));
  const pastOnly = dates.length > 0 && !hasPresent;
  if (pastOnly && /\bcurrently\b|\bcurrent(?:ly)?\s+contributing\b|\bpresently\b/iu.test(summary)) {
    return [{
      kind: 'summary_employment_status_mismatch' as CvFidelityViolationKind,
      matched: 'currently',
      section: 'summary',
    }];
  }
  return [];
}

export function runSummaryGroundingValidators(
  summary: string,
  factSet: CvCanonicalFactSet,
  options: { locale?: Locale | string; gender?: CoverLetterGender | string },
): CvFidelityViolation[] {
  return [
    ...validateSummaryLength(summary, options.locale),
    ...validateSummaryUnsupportedClaims(summary, factSet),
    ...validateSummarySkillInflation(summary),
    ...validateSummarySkillLocalization(summary, options.locale),
    ...validateSummaryMixedLanguage(summary, options.locale),
    ...validateSummaryGenderOccupation(summary, factSet, options),
    ...validateSummaryMaterialFacts(summary, factSet),
    ...validateSummaryEmploymentStatus(summary, factSet),
  ];
}

type GenderTone = 'male' | 'female' | 'neutral';

function tone(gender?: CoverLetterGender | string): GenderTone {
  const g = normalizeCoverLetterGender(gender);
  if (g === 'male') return 'male';
  if (g === 'female') return 'female';
  return 'neutral';
}

type CookingIntent = 'cuisine_prep' | 'workplace_hygiene' | 'kitchen_collab' | 'other';

function classifySummaryCookingIntent(text: string): CookingIntent {
  const t = text.toLowerCase().normalize('NFKC');
  const kitchenCtx = /(kuhinj|kitchen|jel\w*|cuisine|dish(?:es)?|restaurant|food|व्यंजन|रसोई|namirnic)/iu.test(t);
  // Explicit workplace hygiene (Baker fixture) — not bare "clean code" / quality standards.
  if (
    /(workplace\s+hygiene|higijen\w*\s+radnog|higijenu\s+radnog|održav\w*\s+higijen|कार्यस्थल.{0,12}स्वच्छ)/iu.test(t)
    || (kitchenCtx && /(higijen|hygiene|स्वच्छ)/iu.test(t))
  ) {
    return 'workplace_hygiene';
  }
  // Kitchen collaboration only — never generic "collaborate with other teams".
  if (
    kitchenCtx
    && /(sara[dđ]|collaborat|surađ|सहयोग|kuhinjsk\w*\s+tim|kitchen\s+team)/iu.test(t)
  ) {
    return 'kitchen_collab';
  }
  // Dish prep against restaurant standards — require food/dish/restaurant anchors.
  if (
    /(priprem\w*.{0,40}(jel|hran|obrok|dish)|(?:prepare|prepared|preparing)\s+(?:dishes|food|meals?)|restaurant\s+standards?|prema\s+standardima\s+restorana|व्यंजन|तैयार)/iu.test(t)
  ) {
    return 'cuisine_prep';
  }
  return 'other';
}

/** Short duty fragments for embedding in a 2-sentence summary. */
function summaryDutyFragment(
  source: string,
  locale: Locale,
  g: GenderTone,
): string {
  const intent = classifySummaryCookingIntent(source);
  if (intent === 'cuisine_prep') {
    if (locale === 'en') return 'preparing dishes according to restaurant standards';
    if (locale === 'sr' || locale === 'hr') return 'pripremi jela prema standardima restorana';
    if (locale === 'hi') {
      return g === 'female'
        ? 'रेस्तरां के मानकों के अनुसार व्यंजन तैयार करती हूँ'
        : 'रेस्तरां के मानकों के अनुसार व्यंजन तैयार करता हूँ';
    }
    if (locale === 'de') return 'Zubereitung von Gerichten gemäß Restaurantstandards';
    if (locale === 'es') return 'preparación de platos según los estándares del restaurante';
    if (locale === 'fr') return 'préparation de plats selon les normes du restaurant';
    if (locale === 'it') return 'preparazione di piatti secondo gli standard del ristorante';
    if (locale === 'pt-BR') return 'preparação de pratos conforme os padrões do restaurante';
    if (locale === 'ru') return 'приготовлении блюд по стандартам ресторана';
    if (locale === 'ar') return 'إعداد الأطباق وفق معايير المطعم';
    if (locale === 'ja') return 'レストラン基準に沿った料理の準備';
  }
  if (intent === 'workplace_hygiene') {
    if (locale === 'en') return 'maintaining workplace hygiene';
    if (locale === 'sr' || locale === 'hr') return 'održavanju higijene radnog prostora';
    if (locale === 'hi') {
      return g === 'female'
        ? 'कार्यस्थल की स्वच्छता बनाए रखती हूँ'
        : 'कार्यस्थल की स्वच्छता बनाए रखता हूँ';
    }
    if (locale === 'de') return 'Einhaltung der Hygiene am Arbeitsplatz';
    if (locale === 'es') return 'mantenimiento de la higiene del puesto de trabajo';
    if (locale === 'fr') return 'maintien de l’hygiène du poste de travail';
    if (locale === 'it') return 'mantenimento dell’igiene della postazione';
    if (locale === 'pt-BR') return 'manutenção da higiene do local de trabalho';
    if (locale === 'ru') return 'поддержании чистоты рабочего места';
    if (locale === 'ar') return 'الحفاظ على نظافة مكان العمل';
    if (locale === 'ja') return '作業場の衛生管理';
  }
  if (intent === 'kitchen_collab') {
    if (locale === 'en') return 'collaborating with the kitchen team';
    if (locale === 'sr' || locale === 'hr') return 'saradnji sa kuhinjskim timom';
    if (locale === 'hi') {
      return g === 'female'
        ? 'रसोई टीम के साथ सहयोग करती हूँ'
        : 'रसोई टीम के साथ सहयोग करता हूँ';
    }
    if (locale === 'de') return 'Zusammenarbeit mit dem Küchenteam';
    if (locale === 'es') return 'colaboración con el equipo de cocina';
    if (locale === 'fr') return 'collaboration avec l’équipe de cuisine';
    if (locale === 'it') return 'collaborazione con il team di cucina';
    if (locale === 'pt-BR') return 'colaboração com a equipe da cozinha';
    if (locale === 'ru') return 'сотрудничестве с кухонной бригадой';
    if (locale === 'ar') return 'التعاون مع فريق المطبخ';
    if (locale === 'ja') return 'キッチンチームとの協力';
  }
  // Generic (non-cooking) duties are localized by the legacy summary shell.
  // Never embed raw source here — ASCII Serbian/Croatian words would otherwise
  // leak into English summaries and fail locale guards.
  return '';
}

function andWord(locale: Locale): string {
  if (locale === 'sr' || locale === 'hr') return 'i';
  if (locale === 'de') return 'und';
  if (locale === 'es') return 'y';
  if (locale === 'pt-BR' || locale === 'it') return 'e';
  if (locale === 'fr') return 'et';
  if (locale === 'ru') return 'и';
  if (locale === 'hi') return 'और';
  if (locale === 'ar') return 'و';
  if (locale === 'ja') return '、';
  return 'and';
}

function joinDutyFragments(fragments: string[], locale: Locale): string {
  const clean = fragments.filter(Boolean);
  if (!clean.length) return '';
  if (locale === 'ja') return clean.join('、');
  if (locale === 'ar') return clean.join('، ');
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${andWord(locale)} ${clean[1]}`;
  const head = clean.slice(0, -1).join(', ');
  const last = clean[clean.length - 1];
  return `${head} ${andWord(locale)} ${last}`;
}

const SCRIPT_LOCALES: Locale[] = ['hi', 'ar', 'ja', 'ru'];

/** True when a skill label still looks like unlocalized English in a non-English locale. */
function isUnlocalizedEnglishSkillLabel(label: string, locale: Locale): boolean {
  if (locale === 'en') return false;
  const s = (label || '').trim();
  if (!s) return false;
  // Multi-word Title Case English skill phrases (e.g. Critical Thinking).
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(s)) return true;
  if (SCRIPT_LOCALES.includes(locale) && /^[A-Za-z][A-Za-z0-9\s/&'’.-]{1,40}$/.test(s)) {
    return true;
  }
  return false;
}

/**
 * Localize skill labels for summary prose. Omit skills that cannot be safely
 * localized into script locales — never append raw English lists.
 */
export function localizeSummarySkillLabels(skills: string[], locale: Locale): string[] {
  const out: string[] = [];
  for (const raw of skills) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    if (locale === 'en') {
      if (/[čćžšđČĆŽŠĐ]/.test(trimmed) || /[^\u0000-\u007F]/.test(trimmed)) continue;
      out.push(trimmed);
      continue;
    }
    const localized = getLocalizedCvSkillName(trimmed, locale);
    if (!localized.trim()) continue;
    if (isUnlocalizedEnglishSkillLabel(localized, locale)) continue;
    // If localization returned the same English string for a script locale, omit.
    if (
      SCRIPT_LOCALES.includes(locale)
      && localized === trimmed
      && /^[A-Za-z]/.test(trimmed)
    ) {
      continue;
    }
    out.push(localized);
    if (out.length >= 6) break;
  }
  return out;
}

/** Known English skill labels that must not appear raw in non-English summaries. */
const ENGLISH_SKILL_LABEL_RE =
  /\b(?:Critical Thinking|Problem Solving|Time Management|Presentation Skills|Adaptability|Organization|Leadership|Communication|Teamwork|Creativity|Attention to Detail)\b/g;

export function findUnlocalizedSkillLabelsInSummary(
  summary: string,
  locale: Locale,
): string[] {
  if (locale === 'en' || !summary.trim()) return [];
  const found = new Set<string>();
  for (const m of summary.matchAll(ENGLISH_SKILL_LABEL_RE)) {
    found.add(m[0]);
  }
  // Raw English Title-Case lists after an English/Hindi skills opener only.
  // Do not scan German/French/etc. localized skill sentences for Title Case —
  // words like "Organisation"/"Anpassungsfähigkeit" are valid locale labels.
  const skillsClause = summary.match(
    /(?:Key skills include|मुख्य कौशल(?:ों)? में|मेरे प्रमुख कौशलों में)\s+((?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:,\s*(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))+(?:\s+and\s+(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?))?)/u,
  );
  if (skillsClause?.[1] && /^[\x00-\x7F]+$/.test(skillsClause[1])) {
    found.add(skillsClause[1].trim());
  }
  return [...found];
}

export function validateSummarySkillLocalization(
  summary: string,
  locale?: Locale | string,
): CvFidelityViolation[] {
  const loc = (locale || 'en') as Locale;
  if (loc === 'en') return [];
  const labels = findUnlocalizedSkillLabelsInSummary(summary, loc);
  if (!labels.length) return [];
  return [{
    kind: 'unlocalized_skill_labels' as CvFidelityViolationKind,
    matched: labels.join('; '),
    section: 'summary',
    evidence: labels[0],
  }];
}

export function validateSummaryMixedLanguage(
  summary: string,
  locale?: Locale | string,
): CvFidelityViolation[] {
  const loc = (locale || 'en') as Locale;
  if (!SCRIPT_LOCALES.includes(loc)) return [];
  const value = (summary || '').normalize('NFKC').trim();
  if (!value) return [];
  // Substantial English prose clause (not a single proper noun).
  if (
    /\b(?:with approximately|years of experience|Key skills include|responsible for|currently contributing)\b/i.test(value)
  ) {
    return [{
      kind: 'mixed_language_summary' as CvFidelityViolationKind,
      matched: 'english_prose_in_script_locale',
      section: 'summary',
    }];
  }
  const unlocalized = findUnlocalizedSkillLabelsInSummary(value, loc);
  if (unlocalized.length >= 2) {
    return [{
      kind: 'mixed_language_summary' as CvFidelityViolationKind,
      matched: unlocalized.slice(0, 4).join(', '),
      section: 'summary',
    }];
  }
  return [];
}

function skillsLabelSentence(skills: string[], locale: Locale): string {
  const list = localizeSummarySkillLabels(skills, locale);
  if (!list.length) return '';
  const and = andWord(locale);
  let cleanJoined = list[0];
  if (list.length === 2) cleanJoined = `${list[0]} ${and} ${list[1]}`;
  else if (list.length > 2) {
    cleanJoined = `${list.slice(0, -1).join(', ')} ${and} ${list[list.length - 1]}`;
  }
  cleanJoined = cleanJoined.replace(/\s+/g, ' ').trim();
  if (locale === 'en') return `Key skills include ${cleanJoined.toLowerCase()}.`;
  if (locale === 'sr' || locale === 'hr') return `Ključne veštine uključuju ${cleanJoined.toLowerCase()}.`;
  if (locale === 'de') return `Wichtige Fähigkeiten umfassen ${cleanJoined}.`;
  if (locale === 'es') return `Las habilidades clave incluyen ${cleanJoined.toLowerCase()}.`;
  if (locale === 'fr') return `Les compétences clés incluent ${cleanJoined.toLowerCase()}.`;
  if (locale === 'it') return `Le competenze chiave includono ${cleanJoined.toLowerCase()}.`;
  if (locale === 'pt-BR') return `As competências principais incluem ${cleanJoined.toLowerCase()}.`;
  if (locale === 'ru') return `Ключевые навыки включают ${cleanJoined.toLowerCase()}.`;
  if (locale === 'hi') return `मेरे प्रमुख कौशलों में ${cleanJoined} शामिल हैं।`;
  if (locale === 'ar') return `تشمل المهارات الرئيسية ${cleanJoined}.`;
  if (locale === 'ja') return `主なスキルは${cleanJoined}です。`;
  return `Key skills include ${cleanJoined}.`;
}

function formatDurationForSummary(duration: ExperienceDuration | undefined, locale: Locale): string {
  if (!duration?.hasValidDates) return '';
  if (locale === 'en') {
    if (duration.unit === 'years' && duration.approxYears > 0) {
      const n = duration.approxYears;
      const word = n === 1 ? 'one' : n === 2 ? 'two' : n === 3 ? 'three' : n === 4 ? 'four' : n === 5 ? 'five' : String(n);
      return `with approximately ${word} years of experience`;
    }
  }
  if (locale === 'hi' && duration.unit === 'years' && duration.approxYears > 0) {
    const word = duration.approxYears === 2 ? 'दो' : String(duration.approxYears);
    return `लगभग ${word} वर्षों के अनुभव`;
  }
  if ((locale === 'sr' || locale === 'hr') && duration.unit === 'years' && duration.approxYears > 0) {
    return formatApproximateDurationPhrase(duration, locale); // "sa oko dve godine iskustva"
  }
  return formatApproximateDurationPhrase(duration, locale);
}

/**
 * Concise deterministic summary from allowed fact set only.
 * Skills appear only as a short label list — never as achievements.
 */
export function buildConciseGroundedSummary(
  factSet: CvCanonicalFactSet,
  locale: Locale,
  gender?: CoverLetterGender | string,
  duration?: ExperienceDuration,
  options?: { includeSkills?: boolean },
): string {
  const g = tone(gender);
  const genderNorm = normalizeCoverLetterGender(gender);
  const profileTitle = factSet.facts.find((f) => f.type === 'job_title')?.value || '';
  const experienceTitle = factSet.facts.find((f) => f.type === 'role')?.value || '';
  const dutyFacts = factSet.facts.filter((f) => f.type === 'experience_bullet').slice(0, 4);
  const sourceDuties = dutyFacts.map((f) => f.sourceText || f.value).join('\n');
  let role = resolveOccupationalTitleForSummary({
    profileJobTitle: profileTitle,
    currentExperienceTitle: experienceTitle,
    locale,
    gender: genderNorm || '',
    dutiesText: sourceDuties,
  });
  // Prefer explicit baker localization when title is baker.
  if (/baker|pekar/i.test(`${profileTitle} ${experienceTitle}`)) {
    role = localizeBaker(locale, genderNorm || '');
  } else if (profileTitle || experienceTitle) {
    const projected = localizeOccupationalTitleForProjection(
      experienceTitle || profileTitle,
      locale,
      genderNorm || '',
    );
    if (projected && projected !== (experienceTitle || profileTitle)) {
      role = projected;
    }
  }

  const fragments = dutyFacts
    .map((f) => summaryDutyFragment(f.sourceText || f.value, locale, g))
    .filter(Boolean);
  // When duties exist but none could be safely localized into concise fragments,
  // defer to the legacy localized shell (handles SR→EN warehouse titles, etc.).
  if (dutyFacts.length > 0 && fragments.length === 0) {
    return '';
  }
  const durationPhrase = formatDurationForSummary(duration, locale);
  const skills = (options?.includeSkills !== false)
    ? factSet.facts.filter((f) => f.type === 'skill').map((f) => f.value).filter(Boolean)
    : [];
  const skillSentence = skillsLabelSentence(skills, locale);

  let text = '';
  if (locale === 'hi') {
    const rolePart = role || 'पेशेवर';
    const open = durationPhrase
      ? (g === 'female'
        ? `मैं ${durationPhrase} वाली ${rolePart} हूँ।`
        : `मैं ${durationPhrase} वाला ${rolePart} हूँ।`)
      : `मैं ${rolePart} हूँ।`;
    const cookingFrags = dutyFacts.map((f) => summaryDutyFragment(f.sourceText || f.value, locale, g));
    let dutySentence = '';
    if (cookingFrags.length >= 3) {
      dutySentence = `मैं ${cookingFrags[0]}, ${cookingFrags[1]} और ${cookingFrags[2]}।`;
    } else if (cookingFrags.length === 2) {
      dutySentence = `मैं ${cookingFrags[0]} और ${cookingFrags[1]}।`;
    } else if (cookingFrags.length === 1) {
      dutySentence = `मैं ${cookingFrags[0]}।`;
    }
    text = [open, dutySentence, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  } else if (locale === 'sr' || locale === 'hr') {
    const dutyJoin = joinDutyFragments(fragments, locale);
    const open = dutyJoin
      ? (durationPhrase
        ? `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')} ${durationPhrase} u ${dutyJoin}`
        : `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')} sa iskustvom u ${dutyJoin}`)
      : (durationPhrase
        ? `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')} ${durationPhrase}`
        : `${role || (g === 'female' ? 'Profesionalka' : 'Profesionalac')}`);
    text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  } else if (locale === 'en') {
    const dutyJoin = joinDutyFragments(fragments, locale);
    const open = dutyJoin
      ? (durationPhrase
        ? `${role || 'Professional'} ${durationPhrase} ${dutyJoin}`
        : `${role || 'Professional'} with experience ${dutyJoin}`)
      : (durationPhrase
        ? `${role || 'Professional'} ${durationPhrase}`
        : `${role || 'Professional'}`);
    text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  } else if (locale === 'ja') {
    const dutyJoin = joinDutyFragments(fragments, locale);
    text = [
      durationPhrase
        ? `${role || 'プロフェッショナル'}${durationPhrase}${dutyJoin ? `。${dutyJoin}` : ''}。`
        : `${role || 'プロフェッショナル'}${dutyJoin ? `。${dutyJoin}` : ''}。`,
      skillSentence,
    ].filter(Boolean).join('').replace(/\s+/g, '').trim();
  } else {
    const dutyJoin = joinDutyFragments(fragments, locale);
    const open = dutyJoin
      ? (durationPhrase
        ? `${role || 'Professional'} ${durationPhrase}. ${dutyJoin}`
        : `${role || 'Professional'}. ${dutyJoin}`)
      : (durationPhrase
        ? `${role || 'Professional'} ${durationPhrase}`
        : `${role || 'Professional'}`);
    text = [open.endsWith('.') ? open : `${open}.`, skillSentence].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  if (!text.trim()) return '';
  if (locale === 'hi' && !/[।.!?…]\s*$/u.test(text)) text = `${text}।`;
  else if (locale !== 'ja' && !/[.!?…।۔]\s*$/u.test(text)) text = `${text}.`;

  // Hard length guard: drop optional skills sentence if over budget.
  if (countSummaryWords(text, locale) > SUMMARY_MAX_WORDS && skillSentence) {
    text = text.replace(skillSentence, '').replace(/\s+/g, ' ').trim();
  }
  return text.replace(/\s+/g, ' ').trim();
}
