import type { Locale } from '@/lib/i18n/translations';
import {
  formatCoverLetterFactsForPrompt,
  type CoverLetterFactSet,
} from './cover-letter-facts';
import {
  buildDeterministicSparseCoverLetter,
  buildGroundingRepairUserNote,
  validateCoverLetterGrounding,
} from './cover-letter-grounding';
import { stripCoverLetterExportHeader } from './cover-letter-header';
import type { CoverLetterGender } from './cover-letter-gender';
import { normalizeCoverLetterGender } from './cover-letter-gender';

export const COVER_LETTER_SCHEMA_VERSION = 'structured-v4';
export const COVER_LETTER_SCHEMA_MARKER = `\u200B${COVER_LETTER_SCHEMA_VERSION}\u200B`;

export type StructuredCoverLetter = {
  dateLine: string;
  greeting: string;
  paragraph1: string;
  paragraph2: string;
  paragraph3: string;
  closing: string;
  signOff: string;
  candidateName: string;
};

export type CoverLetterValidationResult = {
  valid: boolean;
  hasDate: boolean;
  hasGreeting: boolean;
  hasThreeBodyParagraphs: boolean;
  hasCompanyMotivationParagraph: boolean;
  hasClosingSentence: boolean;
  hasSignoff: boolean;
  hasCandidateName: boolean;
  endsAtApneUtpad: boolean;
  endsAtAurYahi: boolean;
  endsAtKaryaKartiHun: boolean;
  endsAtGunavatt: boolean;
  hasHindiLeakageInEnglish: boolean;
  hasEnglishLeakageInHindi: boolean;
  bodyOnly: boolean;
  errors: string[];
};

const MIN_PARAGRAPH_LENGTH = 24;

const LOCALE_SIGN_OFFS: Partial<Record<Locale, string[]>> = {
  en: ['Sincerely', 'Best regards', 'Kind regards', 'Regards'],
  es: ['Atentamente', 'Cordialmente'],
  it: ['Cordiali saluti', 'Distinti saluti'],
  de: ['Mit freundlichen Grüßen'],
  fr: ['Cordialement'],
  sr: ['Srdačno', 'S poštovanjem'],
  hr: ['Srdačan pozdrav', 'S poštovanjem'],
  ru: ['С уважением'],
  ar: ['مع خالص التحية', 'تحياتي', 'مع التقدير', 'وتفضلوا بقبول فائق الاحترام', 'أطيب التحيات', 'بإخلاص'],
  hi: ['सादर', 'सधन्यवाद', 'धन्यवाद', 'आदर सहित', 'भवदीय'],
  ja: ['敬具'],
  'pt-BR': ['Atenciosamente'],
};

const CLOSING_PATTERNS: Partial<Record<Locale, RegExp[]>> = {
  en: [/interview/i, /thank you/i, /appreciate/i, /look forward/i],
  es: [/entrevista/i, /gracias/i, /agradezco/i, /disponible/i],
  it: [/colloquio/i, /grazie/i, /ringrazio/i, /disponibile/i],
  de: [/gespräch/i, /vielen dank/i, /freue mich/i],
  fr: [/entretien/i, /remercie/i, /disposition/i],
  sr: [/intervju/i, /hvala/i, /zahvaljujem/i],
  hr: [/intervju/i, /hvala/i, /zahvaljujem/i],
  ru: [/собеседован/i, /благодар/i, /готов/i],
  ar: [/مقابلة/i, /شكر/i, /متاح/i],
  hi: [/साक्षात्कार/i, /धन्यवाद/i, /आभार/i, /उम्मीद/i, /समय/i],
  ja: [/面接/i, /感謝/i, /お待ち/i],
  'pt-BR': [/entrevista/i, /obrigad/i, /agradeço/i],
};

const HINDI_INCOMPLETE_ENDINGS = [
  /और\s+यही$/u,
  /अपने\s+उत्पाद$/u,
  /कार्य\s+करती\s+हूँ$/u,
  /कार्य\s+करता\s+हूँ$/u,
  /गुणवत्त$/u,
  /और$/u,
  /जो$/u,
  /क्योंकि$/u,
  /इसलिए$/u,
  /साथ$/u,
  /के\s+प्रति$/u,
];

const DEVANAGARI_RE = /[\u0900-\u097F]/u;
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u;
const BIDI_AND_ZW_RE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/gu;

/**
 * Export-guard reason codes. These are intentionally minimal: the export guard
 * only rejects content that is empty or obviously broken (raw error/schema text).
 * Language-specific completeness (sign-off, candidate name, incomplete endings,
 * paragraph structure, etc.) is enforced strictly by `validateStructuredCoverLetter()`
 * before generated content is ever saved — not here.
 */
export type ExportGuardReasonCode =
  | 'EXPORT_GUARD_PASS'
  | 'EXPORT_GUARD_FAIL_MISSING_CONTENT'
  | 'EXPORT_GUARD_FAIL_INVALID_CONTENT';

// Known API/error placeholder text, or obviously invalid content (undefined/null/raw JSON
// schema payloads) that should never be exported even though it is "non-empty".
const INVALID_EXPORT_CONTENT_PATTERNS = [
  /^undefined$/i,
  /^null$/i,
  /cover letter generation was incomplete/i,
  /ai service is (temporarily )?unavailable/i,
  /please try again later/i,
  /^\s*"?error"?\s*:/i,
];

export class CoverLetterGenerationIncompleteError extends Error {
  constructor(message = 'Cover letter generation was incomplete. Please try again.') {
    super(message);
    this.name = 'CoverLetterGenerationIncompleteError';
  }
}

export class CoverLetterExportIncompleteError extends Error {
  constructor(message = 'Cover letter is incomplete. Please regenerate before exporting.') {
    super(message);
    this.name = 'CoverLetterExportIncompleteError';
  }
}

export function getDefaultCoverLetterClosing(locale: Locale | string): string {
  const closings: Record<string, string> = {
    en: 'Sincerely',
    de: 'Mit freundlichen Grüßen',
    es: 'Atentamente',
    fr: 'Cordialement',
    it: 'Cordiali saluti',
    ar: 'مع خالص التحية',
    sr: 'Srdačno',
    hr: 'Srdačan pozdrav',
    ru: 'С уважением',
    hi: 'सादर',
    ja: '敬具',
    'pt-BR': 'Atenciosamente',
  };
  return closings[locale] ?? 'Sincerely';
}

export function buildLocalizedCoverLetterFilename(filenameLabel: string, companyName?: string): string {
  return buildCoverLetterExportFilename(filenameLabel, companyName);
}

export function buildCoverLetterExportFilename(filenameLabel: string, companyName?: string): string {
  const label = filenameLabel.trim();
  const company = companyName?.trim();
  if (company) return `${label} - ${company}`;
  return label;
}

export function coverLetterMaxTokensForLocale(locale: Locale): number {
  switch (locale) {
    case 'hi':
      return 1200;
    case 'ja':
      return 900;
    case 'ar':
    case 'ru':
      return 700;
    default:
      return 600;
  }
}

export function coverLetterRetryMaxTokensForLocale(locale: Locale): number {
  switch (locale) {
    case 'hi':
      return 1600;
    case 'ja':
      return 1200;
    case 'ar':
    case 'ru':
      return 1000;
    default:
      return 800;
  }
}

function normalizeField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

// Matches the literal marker text with or without its zero-width wrapper, case-insensitively.
// This is intentionally broader than the exact `\u200Bstructured-v4\u200B` stamp so any legacy
// variant (unwrapped, differently-cased, or embedded mid-line) is still caught.
const SCHEMA_MARKER_TOKEN_RE = /[\u200B\uFEFF]*structured-v4[\u200B\uFEFF]*/gi;

function isSchemaMarkerOnlyLine(line: string): boolean {
  const stripped = line.replace(BIDI_AND_ZW_RE, '').trim();
  return stripped.length > 0 && /^structured-v4$/i.test(stripped);
}

/**
 * Removes the diagnostic `structured-v4` schema/version marker from cover-letter
 * text wherever it appears — as its own standalone line (the normal case, added by
 * `stampCoverLetterContent`), embedded mid-line, or wrapped in zero-width characters.
 * The marker is diagnostic metadata (mirrored separately in the API's
 * `coverLetterGenerationEngine` response field) and must never be visible to users
 * in the preview, copied text, or PDF/DOCX exports.
 */
export function sanitizeCoverLetterContent(content: string): string {
  if (typeof content !== 'string') return '';
  if (content.length === 0) return '';
  const withoutMarkerLines = content
    .split('\n')
    .filter((line) => !isSchemaMarkerOnlyLine(line))
    .join('\n');
  return withoutMarkerLines.replace(SCHEMA_MARKER_TOKEN_RE, '').replace(/^\s*\n+/, '');
}

function stripSchemaMarker(content: string): string {
  return sanitizeCoverLetterContent(content).trim();
}

export function parseStructuredCoverLetterJson(raw: string): StructuredCoverLetter | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;

  try {
    const parsed = JSON.parse(candidate) as Partial<StructuredCoverLetter>;
    const letter: StructuredCoverLetter = {
      dateLine: normalizeField(parsed.dateLine),
      greeting: normalizeField(parsed.greeting),
      paragraph1: normalizeField(parsed.paragraph1),
      paragraph2: normalizeField(parsed.paragraph2),
      paragraph3: normalizeField(parsed.paragraph3),
      closing: normalizeField(parsed.closing),
      signOff: normalizeField(parsed.signOff),
      candidateName: normalizeField(parsed.candidateName),
    };
    if (!letter.greeting || !letter.paragraph1 || !letter.paragraph2 || !letter.paragraph3) {
      return null;
    }
    return letter;
  } catch {
    return null;
  }
}

function paragraphEndsIncomplete(text: string, locale: Locale): boolean {
  const trimmed = text.trim().replace(/[।.!?,;:]+$/u, '').trim();
  if (locale === 'hi') {
    return HINDI_INCOMPLETE_ENDINGS.some((re) => re.test(trimmed));
  }
  return /(?:\band|\bor|because|which|that|who)$/i.test(trimmed);
}

function hasDevanagari(text: string): boolean {
  return DEVANAGARI_RE.test(text);
}

function hasArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_RE.test(text);
}

/** Exported for preview/export locale guards and tests. */
export function contentHasDevanagari(text: string): boolean {
  return hasDevanagari(text);
}

/** Exported for preview/export locale guards and tests. */
export function contentHasArabicScript(text: string): boolean {
  return hasArabicScript(text);
}

/**
 * Client-side guard: reject clearly wrong-language bodies when a specific locale
 * was requested. Uses script detection with a minimum Arabic/Devanagari presence
 * threshold — not brittle single-character counting alone.
 */
export function contentMatchesRequestedLocale(content: string, locale: Locale): boolean {
  if (typeof content !== 'string' || !content.trim()) return false;
  const probe = extractCoverLetterBody(content, '').replace(BIDI_AND_ZW_RE, '');
  if (!probe.trim()) return false;

  const arabicCount = (probe.match(new RegExp(ARABIC_SCRIPT_RE.source, 'gu')) ?? []).length;
  const devanagariCount = (probe.match(new RegExp(DEVANAGARI_RE.source, 'gu')) ?? []).length;
  const latinLetters = (probe.match(/[A-Za-z]/g) ?? []).length;
  const japaneseCount = (probe.match(/[\u3040-\u30FF\u3400-\u9FFF]/g) ?? []).length;

  switch (locale) {
    case 'ar':
      if (devanagariCount >= 8) return false;
      return arabicCount >= 24;
    case 'hi':
      // Allow Latin candidate names, companies, and branded job titles in short letters.
      if (arabicCount >= 8) return false;
      if (devanagariCount >= 24) return true;
      // Short sparse Hindi: require clear Devanagari presence, not a Latin-letter ratio.
      return devanagariCount >= 10 && /[\u0900-\u097F]{3,}/u.test(probe);
    case 'en':
      if (devanagariCount >= 8 || arabicCount >= 8) return false;
      return latinLetters >= 40;
    case 'ja':
      // Allow Latin names/companies/titles; require any Japanese script presence.
      if (devanagariCount >= 8 || arabicCount >= 8) return false;
      return japaneseCount >= 1;
    case 'ru':
      return /[\u0400-\u04FF]/.test(probe) && devanagariCount < 8 && arabicCount < 8;
    default:
      return devanagariCount < 12 && arabicCount < 12;
  }
}

function buildLocaleGroundingRules(locale: Locale, jobTitle: string, isSparse: boolean): string {
  const role = jobTitle.trim() || 'the role';
  const shared = [
    'UNIVERSAL GROUNDING RULES (apply to every locale):',
    '1. Every factual professional claim MUST be supported by SOURCE FACTS provided below.',
    '2. Never infer a skill from the target job title.',
    '3. Never infer experience from the target industry.',
    '4. Never infer technical tools from a general profession.',
    '5. Never infer leadership from seniority, age, or job title.',
    '6. Never infer years of experience.',
    '7. Never invent numbers, percentages, dates, revenue, savings, team size, or project scale.',
    '8. Never claim that the candidate performed a responsibility merely because it appears in the job description.',
    '9. Job-description requirements may be discussed as interest or willingness to contribute — NOT as existing experience unless SOURCE FACTS support it.',
    '10. Do not transform weak evidence into a stronger claim.',
    '11. Do not upgrade responsibilities into achievements.',
    '12. Do not upgrade participation into leadership.',
    '13. Do not upgrade familiarity into expertise.',
    '14. Do not describe the candidate as experienced, highly skilled, expert, accomplished, proven, or successful unless SOURCE FACTS support it.',
    '15. A shorter honest letter is always preferable to a detailed invented one.',
    '16. Do NOT invent personal qualities (attention to detail, professionalism, honesty, dedication, reliability, creativity, analytical thinking, teamwork, passion, work ethic, integrity, etc.) unless SOURCE FACTS explicitly support them.',
    '17. Do NOT infer duties, departments, or domain work from the job title alone (e.g. do not turn "Android tester" into quality-assurance experience, automation, or "QA efforts").',
    '18. Do NOT use slash gender placeholders (e.g. lieto/a, хочет/хочет, चाहता/चाहती) or parenthetical gender markers (e.g. (a), (e)) in the finished letter.',
    '- Do NOT claim Java, Python, C++, JavaScript, React, databases, SQL, cloud, AWS, Azure, CRM, Agile, Scrum, OOP, frontend/backend, or similar tools unless present in SOURCE FACTS.',
    '- Do NOT claim extensive experience, proven track record, strong technical expertise, projects successfully led, or efficiency/revenue improvements unless present in SOURCE FACTS.',
    '- Keep company praise brief and specific — avoid exaggerated compliments and repetitive company-name mentions.',
    `- Use the job title "${role}" faithfully — preserve its meaning and seniority; do NOT upgrade or replace it (e.g. do not change "Salesman" into Sales Executive, Sales Representative, or Sales Manager).`,
    '- If the title is specialized or clearer in English, you may keep it and optionally add a natural translation with the English title in parentheses.',
    isSparse
      ? '- SOURCE FACTS are SPARSE: write a concise honest letter about interest in the exact role, willingness to learn/contribute, discussing the application, and interview availability. Do NOT invent experience, duties, or personal qualities. Do NOT mention that information is limited, sparse, missing, or unavailable.'
      : '- Mention only the strongest qualifications that appear in SOURCE FACTS and are relevant to the role.',
    '- Do NOT include fictional example achievements in the letter.',
    '- Do NOT put date, email, phone, address, or a header candidate-name block in any JSON field — the application template already renders those.',
    '- Never mention source facts, CV data, AI, prompts, validation, fallbacks, or system limitations in the letter body.',
  ];

  if (locale === 'hi') {
    return [
      'HINDI QUALITY RULES:',
      '- Write natural, professional Hindi — not a literal English translation.',
      '- Translate the job title faithfully into natural Hindi without changing seniority (e.g. Software Developer → "सॉफ़्टवेयर डेवलपर (Software Developer)").',
      '- Prefer gender-neutral constructions ONLY when applicant gender is unspecified in the GENDER instruction above.',
      '- When GENDER says FEMALE: use exclusively feminine first-person forms (चाहती हूँ, कर रही हूँ, प्रस्तुत कर रही हूँ). Never masculine.',
      '- When GENDER says MALE: use exclusively masculine first-person forms (चाहता हूँ, कर रहा हूँ, प्रस्तुत कर रहा हूँ). Never feminine.',
      '- When GENDER is unspecified: use impersonal constructions only (e.g. "यह आवेदन प्रस्तुत है", "अवसर स्वागतयोग्य होगा"). Never चाहता/चाहती, कर रहा/रही, and never rewrite as third person with the candidate name (e.g. "Name आवेदन कर रहे हैं").',
      '- NEVER use slash forms such as चाहता/चाहती, करूँगा/करूँगी, रहा/रही.',
      '- Never show draft self-corrections such as "— नहीं", "क्षमा करें", or "मेरा मतलब".',
      '- Never infer gender from the candidate name or job title.',
      '- Do NOT claim ईमानदारी, लगन, सूक्ष्मता, रचनात्मक सोच, समस्या-समाधान क्षमता, नेतृत्व क्षमता, or मजबूत कार्य-नैतिकता unless in SOURCE FACTS.',
      '- Do NOT claim व्यापक अनुभव, कई वर्षों का अनुभव, वेब अनुप्रयोगों का निर्माण, डेटाबेस प्रबंधन, जटिल तकनीकी समस्याओं का समाधान, परियोजनाओं का नेतृत्व, प्रणाली की कार्यक्षमता में सुधार, प्रोग्रामिंग भाषाओं में विशेषज्ञता, or क्लाउड/Agile अनुभव unless in SOURCE FACTS.',
      '- When evidence is sparse, use neutral professional Hindi focused on interest, willingness to learn/contribute, and interview availability.',
      '- Use correct Devanagari punctuation and characters.',
      ...shared,
    ].join('\n');
  }

  if (locale === 'ar') {
    return [
      'ARABIC QUALITY RULES:',
      '- Write professional Modern Standard Arabic — not word-for-word English translation.',
      '- Prefer natural phrasing such as "أتقدم بطلب لشغل وظيفة [Role]" or "للتقدم لشغل وظيفة [Role]" or "للانضمام إلى فريقكم لشغل وظيفة [Role]".',
      '- Prefer greeting "إلى فريق التوظيف المحترم في شركة [Company]،" when natural.',
      '- Prefer "أنضم إليها" over awkward "أنتمي إليها" when describing joining a workplace.',
      '- Prefer natural sparse interest wording such as "وأرحب بفرصة التعرف على متطلبات الوظيفة ومناقشة إمكانية الانضمام إلى فريقكم."',
      '- Do NOT use artificial career-path rhetoric such as "فرصة مدروسة نحو مسيرة مهنية هادفة" or similar overly formal abstractions about a "هادفة" career journey.',
      '- Prefer simpler alternatives when needed (e.g. "فرصة مناسبة للتطور المهني" or "خطوة مناسبة في مسيرتي المهنية"), or omit career-direction claims entirely when SOURCE FACTS are sparse.',
      '- Do NOT imply the candidate already works at the employer (avoid forms like "بوصفي [Role] في شركة [Company]").',
      '- Use "مع خالص التحية،" with the Arabic comma "،".',
      '- For sparse facts, prefer neutral interest/learning/growth wording — do NOT claim "إضافة قيمة حقيقية" unless SOURCE FACTS establish that value.',
      '- Do NOT claim الدقة، الاحترافية، الالتزام، الإبداع، القدرة التحليلية، روح الفريق، التفاني، or تحمل المسؤولية unless in SOURCE FACTS.',
      '- Do NOT claim خبرة واسعة، قدت مشاريع، طورت حلولاً، رفعت كفاءة الأنظمة، حسنت تجربة المستخدم، أتقن لغات برمجة متعددة، كفاءات تقنية متقدمة، or قدرات تحليلية قوية unless in SOURCE FACTS.',
      '- Keep mixed Latin terms (Google, Java, Python, C++, CRM, emails) readable; do not reverse them.',
      '- Write entirely in Arabic — never output Hindi or English body text.',
      ...shared,
    ].join('\n');
  }

  const languageLabel: Partial<Record<Locale, string>> = {
    en: 'English',
    de: 'German',
    es: 'Spanish',
    fr: 'French',
    it: 'Italian',
    sr: 'Serbian',
    hr: 'Croatian',
    ru: 'Russian',
    'pt-BR': 'Brazilian Portuguese',
    ja: 'Japanese',
  };

  return [
    `${(languageLabel[locale] ?? 'LOCAL').toUpperCase()} QUALITY RULES:`,
    `- Write natural professional ${languageLabel[locale] ?? 'native'} phrasing — not a literal translation.`,
    '- Preserve the exact job-title meaning and seniority.',
    '- Prefer native greeting, punctuation, and closing conventions.',
    ...shared,
  ].join('\n');
}

function normalizeExportLine(line: string): string {
  return line
    .normalize('NFC')
    .replace(BIDI_AND_ZW_RE, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[,.،、٫]+$/u, '')
    .trim();
}

function normalizeExportProbeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(BIDI_AND_ZW_RE, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTailLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) => normalizeExportLine(line))
    .filter(Boolean);
}

function localeSignOffOptions(locale: Locale, closing: string): string[] {
  const options = [...(LOCALE_SIGN_OFFS[locale] ?? []), closing].filter(Boolean);
  if (locale === 'en') options.push('Regards');
  return [...new Set(options)];
}

function signOffMatchesLine(line: string, signoff: string): boolean {
  const normalizedLine = normalizeExportLine(line);
  const base = normalizeExportLine(signoff);
  if (!normalizedLine || !base) return false;
  return normalizedLine === base
    || normalizedLine.startsWith(`${base},`)
    || normalizedLine.startsWith(`${base}،`)
    || normalizedLine.includes(base);
}

function meaningfulParagraph(text: string): boolean {
  return text.trim().length >= MIN_PARAGRAPH_LENGTH;
}

function matchesCandidateName(actual: string, expected: string): boolean {
  const a = actual.trim();
  const b = expected.trim();
  if (!b) return Boolean(a);
  if (a.toLowerCase() === b.toLowerCase()) return true;
  return a === b;
}

function isKnownSignOffLine(line: string, locale: Locale, closing: string): boolean {
  const options = localeSignOffOptions(locale, closing);
  return options.some((signoff) => signOffMatchesLine(line, signoff));
}

function extractTailCandidateName(body: string, locale: Locale, closing: string): string {
  const lines = extractTailLines(body);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (!line || isKnownSignOffLine(line, locale, closing)) continue;
    if (looksLikeHumanName(line, locale, closing)) return line;
  }
  return '';
}

export function resolveExportCandidateName(
  content: string,
  candidateName: string,
  locale: Locale,
  closing: string,
): string {
  const provided = candidateName.trim();
  if (provided) return provided;
  const body = extractCoverLetterBody(content, '');
  return extractTailCandidateName(body, locale, closing);
}

function looksLikeHumanName(line: string, locale: Locale, closing: string): boolean {
  const normalized = normalizeExportLine(line);
  if (normalized.length < 2 || normalized.length > 80) return false;
  if (/@|https?:\/\/|\d{3,}/i.test(normalized)) return false;
  if (isKnownSignOffLine(normalized, locale, closing)) return false;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  if (/^[A-Za-z][A-Za-z .'-]*$/u.test(normalized)) return true;

  if (hasDevanagari(normalized) || hasArabicScript(normalized)) {
    return normalized.length <= 40 && words.length <= 4;
  }

  return /[\p{L}]/u.test(normalized);
}

function hasExportSignoff(text: string, locale: Locale, closing: string): boolean {
  const normalizedTail = normalizeExportProbeText(text.slice(Math.max(0, text.length - 700)));
  const options = localeSignOffOptions(locale, closing);
  return options.some((signoff) => {
    const base = normalizeExportProbeText(signoff.replace(/[,.،、]\s*$/u, '').trim());
    if (!base) return false;
    if (locale === 'ar' || locale === 'hi' || locale === 'ja' || locale === 'ru') {
      return normalizedTail.includes(base);
    }
    return normalizedTail.toLowerCase().includes(base.toLowerCase());
  });
}

function looksLikeRawJsonSchemaPayload(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  if (/"(dateLine|greeting|paragraph1|paragraph2|paragraph3|signOff|candidateName)"\s*:/.test(trimmed)) {
    return true;
  }
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function hasInvalidExportContent(text: string): boolean {
  const trimmed = text.trim();
  return INVALID_EXPORT_CONTENT_PATTERNS.some((pattern) => pattern.test(trimmed))
    || looksLikeRawJsonSchemaPayload(trimmed);
}

/**
 * Pragmatic, locale-agnostic export guard.
 *
 * Strict completeness (sign-off, candidate name, paragraph structure, incomplete
 * Hindi/Arabic endings, RTL/bidi handling, etc.) is validated once, up front, by
 * `validateStructuredCoverLetter()` before generated content is ever saved to
 * `cl.content`. By the time content reaches export, it is either: (a) freshly
 * generated and already validated, or (b) an existing/legacy draft the user can
 * already see in the preview. Re-running strict, script-specific heuristics here
 * caused false-positive blocks for Arabic/Hindi even when the visible preview was
 * complete, so export only rejects content that is unmistakably unusable.
 */
export function evaluateCoverLetterExportGuard(
  content: string,
): { pass: boolean; reasonCode: ExportGuardReasonCode } {
  if (typeof content !== 'string' || !stripSchemaMarker(content).replace(BIDI_AND_ZW_RE, '').trim()) {
    return { pass: false, reasonCode: 'EXPORT_GUARD_FAIL_MISSING_CONTENT' };
  }
  if (hasInvalidExportContent(content)) {
    return { pass: false, reasonCode: 'EXPORT_GUARD_FAIL_INVALID_CONTENT' };
  }
  return { pass: true, reasonCode: 'EXPORT_GUARD_PASS' };
}

function hasSignoff(text: string, locale: Locale, closing: string): boolean {
  return hasExportSignoff(text, locale, closing);
}

function textHasClosingSentence(text: string, locale: Locale): boolean {
  const patterns = CLOSING_PATTERNS[locale] ?? CLOSING_PATTERNS.en ?? [];
  return patterns.some((re) => re.test(text));
}

function paragraphHasCompanyMotivation(letter: StructuredCoverLetter, locale: Locale, companyName: string): boolean {
  const paragraph = letter.paragraph3;
  const company = companyName.trim();
  if (locale === 'hi') {
    const mentionsCompany = company ? paragraph.includes(company) : /कंपनी|उत्पाद|सेवा|टीम/u.test(paragraph);
    return mentionsCompany && /गुणवत्ता|प्रेर|प्रतिबद्ध|योगदान|संस्कृति|उत्पाद|सेवा/u.test(paragraph);
  }
  return company ? paragraph.includes(company) : paragraph.length >= MIN_PARAGRAPH_LENGTH;
}

export function validateStructuredCoverLetter(
  letter: StructuredCoverLetter,
  locale: Locale,
  candidateName: string,
  companyName: string,
  closing: string,
): CoverLetterValidationResult {
  const errors: string[] = [];
  const paragraphs = [letter.paragraph1, letter.paragraph2, letter.paragraph3];
  const assembledProbe = [
    letter.greeting,
    ...paragraphs,
    letter.closing,
    letter.signOff,
    letter.candidateName,
  ].join('\n');

  const hasGreeting = Boolean(letter.greeting);
  const hasThreeBodyParagraphs = paragraphs.every(meaningfulParagraph);
  const hasCompanyMotivationParagraph = paragraphHasCompanyMotivation(letter, locale, companyName);
  const hasClosingSentence = meaningfulParagraph(letter.closing) && textHasClosingSentence(letter.closing, locale);
  const hasSignoffField = Boolean(letter.signOff) && hasSignoff(letter.signOff, locale, closing);
  const hasCandidateName = matchesCandidateName(letter.candidateName, candidateName);
  const hasDate = Boolean(letter.dateLine);

  if (!hasGreeting) errors.push('missing greeting');
  if (!hasThreeBodyParagraphs) errors.push('paragraphs too short or missing');
  if (!hasCompanyMotivationParagraph) errors.push('missing company motivation paragraph');
  if (!hasClosingSentence) errors.push('missing closing sentence');
  if (!hasSignoffField) errors.push('missing sign-off');
  if (!hasCandidateName) errors.push('candidate name mismatch');

  for (const paragraph of paragraphs) {
    if (paragraphEndsIncomplete(paragraph, locale)) {
      errors.push(`incomplete paragraph ending: ${paragraph.slice(-40)}`);
    }
  }
  if (paragraphEndsIncomplete(letter.closing, locale)) {
    errors.push('incomplete closing sentence');
  }

  const endsAtAurYahi = /और\s+यही$/u.test(assembledProbe.trim());
  const endsAtApneUtpad = /अपने\s+उत्पाद$/u.test(assembledProbe.trim());
  const endsAtKaryaKartiHun = /कार्य\s+करती\s+हूँ$/u.test(assembledProbe.trim()) || /कार्य\s+करता\s+हूँ$/u.test(assembledProbe.trim());
  const endsAtGunavatt = /गुणवत्त$/u.test(assembledProbe.trim());

  if (endsAtAurYahi) errors.push('ends at और यही');
  if (endsAtApneUtpad) errors.push('ends at अपने उत्पाद');
  if (endsAtKaryaKartiHun) errors.push('ends at कार्य करती हूँ');
  if (endsAtGunavatt) errors.push('ends at गुणवत्त');

  const bodyOnly = hasGreeting && hasThreeBodyParagraphs && !hasSignoffField && !hasCandidateName;
  if (bodyOnly) errors.push('body-only output without sign-off and candidate name');

  const hasHindiLeakageInEnglish = locale === 'en' && hasDevanagari(assembledProbe);
  const hasEnglishLeakageInHindi = locale === 'hi'
    && /^(dear|hello|hi|greetings)\b/i.test(letter.greeting.trim());

  if (hasHindiLeakageInEnglish) errors.push('English output contains Hindi/Devanagari');
  if (locale === 'hi') {
    const hindiFields = [letter.greeting, letter.paragraph1, letter.paragraph2, letter.paragraph3, letter.closing];
    if (!hindiFields.every(hasDevanagari)) errors.push('Hindi output missing Devanagari text');
    if (!letter.signOff.includes('सादर') && !hasSignoff(assembledProbe, locale, closing)) {
      errors.push('Hindi output missing सादर sign-off');
    }
  }
  if (locale === 'ar') {
    const arabicFields = [letter.greeting, letter.paragraph1, letter.paragraph2, letter.paragraph3, letter.closing];
    if (!arabicFields.every(hasArabicScript)) errors.push('Arabic output missing Arabic script');
    if (hasDevanagari(assembledProbe)) errors.push('Arabic output contains Devanagari');
    if (!hasSignoff(assembledProbe, locale, closing)) errors.push('Arabic output missing sign-off');
  }
  if (locale === 'en' && !hasSignoff(assembledProbe, locale, closing)) {
    errors.push('English output missing Sincerely sign-off');
  }

  return {
    valid: errors.length === 0,
    hasDate,
    hasGreeting,
    hasThreeBodyParagraphs,
    hasCompanyMotivationParagraph,
    hasClosingSentence,
    hasSignoff: hasSignoffField,
    hasCandidateName,
    endsAtApneUtpad,
    endsAtAurYahi,
    endsAtKaryaKartiHun,
    endsAtGunavatt,
    hasHindiLeakageInEnglish,
    hasEnglishLeakageInHindi,
    bodyOnly,
    errors,
  };
}

export function assembleCoverLetterContent(
  letter: StructuredCoverLetter,
  locale?: Locale,
): string {
  const signOff = letter.signOff.replace(/[,.،、]\s*$/u, '').trim();
  const signOffLine =
    locale === 'ja'
      ? signOff
      : locale === 'ar'
        ? `${signOff}،`
        : `${signOff},`;
  return [
    letter.greeting,
    letter.paragraph1,
    letter.paragraph2,
    letter.paragraph3,
    letter.closing,
    signOffLine,
    letter.candidateName,
  ].join('\n\n');
}

export function buildStructuredCoverLetterPrompt(options: {
  languageName: string;
  locale: Locale;
  displayName: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  fallbackRole: string;
  fallbackCompany: string;
  toneDesc: string;
  variantNote: string;
  genderNote: string;
  closing: string;
  dateLine: string;
  factSet?: CoverLetterFactSet;
  retryNote?: string;
}): string {
  const company = options.companyName || options.fallbackCompany;
  const role = options.jobTitle || options.fallbackRole;
  const retry = options.retryNote ? `\n${options.retryNote}` : '';
  const factSet = options.factSet ?? { facts: [], isSparse: true };
  const localeRules = buildLocaleGroundingRules(options.locale, options.jobTitle, factSet.isSparse);
  const factsBlock = formatCoverLetterFactsForPrompt(factSet);
  const paragraph2Hint = factSet.isSparse
    ? 'motivation, willingness to learn/contribute, and ONLY explicitly supplied facts (do NOT invent experience or skills)'
    : 'ONLY experience and skills that appear in SOURCE FACTS (do not invent)';

  return `Return ONLY valid JSON for a cover letter in ${options.languageName}.
Candidate: ${options.displayName}
Company: ${company}
Role: ${role}
Tone: ${options.toneDesc}.${options.variantNote}${options.genderNote}
Date line: ${options.dateLine}
Required sign-off: ${options.closing}
The candidateName field MUST be exactly "${options.candidateName || options.displayName}".

${factsBlock}

JSON schema (all fields required, complete sentences only):
{
  "dateLine": "${options.dateLine}",
  "greeting": "localized greeting to ${company}",
  "paragraph1": "introduction and application for ${role} (interest in the exact role — do not claim prior employment at ${company})",
  "paragraph2": "${paragraph2Hint}",
  "paragraph3": "brief company interest/motivation for ${company} without inventing impact",
  "closing": "interview availability and thank-you sentence",
  "signOff": "${options.closing}",
  "candidateName": "${options.candidateName || options.displayName}"
}

Rules:
- Write every field entirely in ${options.languageName}.
- Do not stop mid-sentence in any field.
- paragraph3 must briefly explain interest in ${company} without exaggerated claims.
- closing must mention interview availability or thanks.
- signOff must be "${options.closing}".
- candidateName must be exactly "${options.candidateName || options.displayName}".
- Prefer a concise letter (~120–280 words); never pad with invented experience.
- Never write phrases like "source details are limited", "based on the limited information provided", or any equivalent about missing CV/source/AI/validation data.
${localeRules ? `\n${localeRules}` : ''}
- Output JSON only. No markdown. No commentary.${retry}`;
}

function localizedDateLine(locale: Locale): string {
  return new Date().toLocaleDateString(
    locale === 'en' ? 'en-US' :
    locale === 'de' ? 'de-DE' :
    locale === 'es' ? 'es-ES' :
    locale === 'fr' ? 'fr-FR' :
    locale === 'it' ? 'it-IT' :
    locale === 'pt-BR' ? 'pt-BR' :
    locale === 'sr' ? 'sr-RS' :
    locale === 'hr' ? 'hr-HR' :
    locale === 'ru' ? 'ru-RU' :
    locale === 'ar' ? 'ar-SA' :
    locale === 'hi' ? 'hi-IN' :
    locale === 'ja' ? 'ja-JP' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
}

export function extractCoverLetterBody(content: string, candidateName: string): string {
  const normalizedContent = content
    .normalize('NFC')
    .replace(BIDI_AND_ZW_RE, '');
  return stripCoverLetterExportHeader(stripSchemaMarker(normalizedContent), candidateName).trim();
}

export type CoverLetterExportValidationResult = {
  valid: boolean;
  reasonCode: ExportGuardReasonCode;
};

/**
 * Pragmatic export-time validation. Unlike `validateStructuredCoverLetter()` (used
 * during generation), this does NOT check locale, sign-off, candidate name, paragraph
 * count, or company paragraph — see `evaluateCoverLetterExportGuard()` for rationale.
 * The extra parameters are accepted for call-site compatibility but are unused.
 */
export function validateCoverLetterExportContent(
  content: string,
  _locale?: Locale,
  _candidateName?: string,
  _companyName?: string,
  _closing?: string,
): CoverLetterExportValidationResult {
  const guard = evaluateCoverLetterExportGuard(content);
  return { valid: guard.pass, reasonCode: guard.reasonCode };
}

export function validateCoverLetterContent(
  content: string,
  locale?: Locale,
  candidateName?: string,
  companyName?: string,
  closing?: string,
): CoverLetterExportValidationResult {
  return validateCoverLetterExportContent(content, locale, candidateName, companyName, closing);
}

export function isCoverLetterContentComplete(
  content: string,
  locale?: Locale,
  candidateName?: string,
  companyName?: string,
  closing?: string,
): boolean {
  return validateCoverLetterContent(content, locale, candidateName, companyName, closing).valid;
}

/**
 * Minimal export guard: only blocks empty/whitespace-only content and known
 * API/error placeholder or raw JSON/schema text. It intentionally does NOT
 * re-validate language-specific completeness (sign-off, candidate name,
 * paragraph structure, incomplete endings, RTL/bidi content, or the
 * structured-v4 marker) — that strict validation already happened in
 * `validateStructuredCoverLetter()` before the content was saved.
 * The locale/candidateName/companyName/closing parameters are accepted for
 * call-site compatibility but are unused.
 */
export function assertCoverLetterExportable(
  content: string,
  _locale?: Locale,
  _candidateName?: string,
  _companyName?: string,
  _closing?: string,
): void {
  const guard = evaluateCoverLetterExportGuard(content);
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[Cover Letter Export Guard]', guard.reasonCode);
  }
  if (!guard.pass) {
    throw new CoverLetterExportIncompleteError();
  }
}

/**
 * Historical helper that stamps content with the `structured-v4` diagnostic marker.
 * No longer called by the generation API route — the marker text was visible to
 * users (zero-width characters only hide themselves, not the ASCII "structured-v4"
 * they wrap) — but kept for tests that simulate legacy stamped drafts and for any
 * caller that still wants an explicit, in-memory-only diagnostic marker. Always
 * strip with `sanitizeCoverLetterContent()` before the text is shown/exported.
 */
export function stampCoverLetterContent(body: string): string {
  return `${COVER_LETTER_SCHEMA_MARKER}\n${body}`;
}

export function hasStructuredCoverLetterMarker(content: string): boolean {
  return content.startsWith(COVER_LETTER_SCHEMA_MARKER);
}

export async function generateStructuredCoverLetterWithRetries(options: {
  locale: Locale;
  closing: string;
  candidateName: string;
  displayName: string;
  companyName: string;
  jobTitle: string;
  languageName: string;
  toneDesc: string;
  variantNote: string;
  genderNote: string;
  gender?: CoverLetterGender | string;
  fallbackRole: string;
  fallbackCompany: string;
  factSet?: CoverLetterFactSet;
  generate: (attempt: number, maxTokens: number, userPrompt: string) => Promise<string>;
}): Promise<{
  letter: StructuredCoverLetter;
  groundingStatus: 'passed' | 'repaired' | 'fallback';
  repairAttempted: boolean;
  fallbackUsed: boolean;
  usedFactIds: string[];
  groundingViolationCount: number;
}> {
  let maxTokens = coverLetterMaxTokensForLocale(options.locale);
  const retryCap = coverLetterRetryMaxTokensForLocale(options.locale);
  const signatureName = options.candidateName || options.displayName;
  const dateLine = localizedDateLine(options.locale);
  const factSet: CoverLetterFactSet = options.factSet ?? { facts: [], isSparse: true };
  const usedFactIds = factSet.facts.map((f) => f.id);
  const gender = normalizeCoverLetterGender(options.gender);

  const tryParseAndValidate = (raw: string): StructuredCoverLetter | null => {
    const parsed = parseStructuredCoverLetterJson(raw);
    if (!parsed) return null;
    const validation = validateStructuredCoverLetter(
      parsed,
      options.locale,
      signatureName,
      options.companyName,
      options.closing,
    );
    return validation.valid ? parsed : null;
  };

  let structurallyValid: StructuredCoverLetter | null = null;
  let assembledForGrounding = '';
  let lastViolationCount = 0;
  let repairAttempted = false;

  for (let attempt = 0; attempt < 3; attempt++) {
    const retryNote = attempt > 0
      ? 'Previous JSON was invalid or incomplete. Return complete JSON with full paragraph3, closing, signOff, and candidateName. Do not stop mid-sentence. Do not invent unsupported experience.'
      : undefined;
    const userPrompt = buildStructuredCoverLetterPrompt({
      languageName: options.languageName,
      locale: options.locale,
      displayName: options.displayName,
      candidateName: signatureName,
      jobTitle: options.jobTitle,
      companyName: options.companyName,
      fallbackRole: options.fallbackRole,
      fallbackCompany: options.fallbackCompany,
      toneDesc: options.toneDesc,
      variantNote: options.variantNote,
      genderNote: options.genderNote,
      closing: options.closing,
      dateLine,
      factSet,
      retryNote,
    });

    const raw = await options.generate(attempt, maxTokens, userPrompt);
    const parsed = tryParseAndValidate(raw);
    if (!parsed) {
      if (maxTokens < retryCap) maxTokens = retryCap;
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Cover Letter Structured]', {
          locale: options.locale,
          attempt,
          maxTokens,
          valid: false,
        });
      }
      continue;
    }

    structurallyValid = parsed;
    assembledForGrounding = assembleCoverLetterContent(parsed, options.locale);
    const grounding = validateCoverLetterGrounding(assembledForGrounding, factSet, {
      locale: options.locale,
      gender,
    });
    lastViolationCount = grounding.violations.length;
    if (grounding.valid) {
      return {
        letter: parsed,
        groundingStatus: 'passed',
        repairAttempted,
        fallbackUsed: false,
        usedFactIds,
        groundingViolationCount: 0,
      };
    }

    // One automatic grounding repair
    repairAttempted = true;
    const repairPrompt = `${buildStructuredCoverLetterPrompt({
      languageName: options.languageName,
      locale: options.locale,
      displayName: options.displayName,
      candidateName: signatureName,
      jobTitle: options.jobTitle,
      companyName: options.companyName,
      fallbackRole: options.fallbackRole,
      fallbackCompany: options.fallbackCompany,
      toneDesc: options.toneDesc,
      variantNote: options.variantNote,
      genderNote: options.genderNote,
      closing: options.closing,
      dateLine,
      factSet,
      retryNote: buildGroundingRepairUserNote(factSet, grounding.violations, assembledForGrounding),
    })}`;

    try {
      const repairedRaw = await options.generate(attempt + 10, retryCap, repairPrompt);
      const repaired = tryParseAndValidate(repairedRaw);
      if (repaired) {
        const repairedText = assembleCoverLetterContent(repaired, options.locale);
        const repairedGrounding = validateCoverLetterGrounding(repairedText, factSet, {
          locale: options.locale,
          gender,
        });
        lastViolationCount = repairedGrounding.violations.length;
        if (repairedGrounding.valid) {
          return {
            letter: repaired,
            groundingStatus: 'repaired',
            repairAttempted: true,
            fallbackUsed: false,
            usedFactIds,
            groundingViolationCount: 0,
          };
        }
      }
    } catch {
      // Repair generation failed — fall through to deterministic neutral fallback.
    }

    // Deterministic safe fallback — never expose ungrounded inventing content
    const fallback = buildDeterministicSparseCoverLetter(options.locale, {
      candidateName: signatureName,
      jobTitle: options.jobTitle || options.fallbackRole,
      companyName: options.companyName || options.fallbackCompany,
      factSet,
      dateLine,
      gender,
    });
    // Soft-align signOff with locale closing preference
    fallback.signOff = options.closing || fallback.signOff;
    return {
      letter: fallback,
      groundingStatus: 'fallback',
      repairAttempted,
      fallbackUsed: true,
      usedFactIds,
      groundingViolationCount: lastViolationCount,
    };
  }

  // Structural generation failed entirely — still return grounded fallback rather than hard error when possible
  if (structurallyValid) {
    const fallback = buildDeterministicSparseCoverLetter(options.locale, {
      candidateName: signatureName,
      jobTitle: options.jobTitle || options.fallbackRole,
      companyName: options.companyName || options.fallbackCompany,
      factSet,
      dateLine,
      gender,
    });
    fallback.signOff = options.closing || fallback.signOff;
    return {
      letter: fallback,
      groundingStatus: 'fallback',
      repairAttempted,
      fallbackUsed: true,
      usedFactIds,
      groundingViolationCount: lastViolationCount,
    };
  }

  throw new CoverLetterGenerationIncompleteError();
}
