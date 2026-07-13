import type { Locale } from '@/lib/i18n/translations';

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

function stripSchemaMarker(content: string): string {
  return content.replace(/\u200Bstructured-v4\u200B\n?/gu, '').trim();
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

function isLikelyDateLine(line: string): boolean {
  const normalized = normalizeExportLine(line);
  return /(?:\b\d{4}\b|[٠-٩]{4}|[०-९]{4})/u.test(normalized);
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

export function assembleCoverLetterContent(letter: StructuredCoverLetter): string {
  const signOff = letter.signOff.replace(/[,.،、]\s*$/u, '').trim();
  return [
    letter.greeting,
    letter.paragraph1,
    letter.paragraph2,
    letter.paragraph3,
    letter.closing,
    `${signOff},`,
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
  retryNote?: string;
}): string {
  const company = options.companyName || options.fallbackCompany;
  const role = options.jobTitle || options.fallbackRole;
  const retry = options.retryNote ? `\n${options.retryNote}` : '';

  return `Return ONLY valid JSON for a cover letter in ${options.languageName}.
Candidate: ${options.displayName}
Company: ${company}
Role: ${role}
Tone: ${options.toneDesc}.${options.variantNote}${options.genderNote}
Date line: ${options.dateLine}
Required sign-off: ${options.closing}
The candidateName field MUST be exactly "${options.candidateName || options.displayName}".

JSON schema (all fields required, complete sentences only):
{
  "dateLine": "${options.dateLine}",
  "greeting": "localized greeting to ${company}",
  "paragraph1": "introduction and application for ${role}",
  "paragraph2": "relevant experience and skills",
  "paragraph3": "company motivation for ${company}",
  "closing": "interview availability and thank-you sentence",
  "signOff": "${options.closing}",
  "candidateName": "${options.candidateName || options.displayName}"
}

Rules:
- Write every field entirely in ${options.languageName}.
- Do not stop mid-sentence in any field.
- paragraph3 must fully explain motivation for ${company}.
- closing must mention interview availability or thanks.
- signOff must be "${options.closing}".
- candidateName must be exactly "${options.candidateName || options.displayName}".
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
  const lines = stripSchemaMarker(normalizedContent).split('\n');
  let index = 0;
  while (index < lines.length && lines[index].trim() === '') index++;

  let passedDate = false;
  while (index < lines.length && !passedDate) {
    const line = lines[index].trim();
    if (line === '') {
      index++;
      continue;
    }
    if (isLikelyDateLine(line)) {
      passedDate = true;
      index++;
      while (index < lines.length && lines[index].trim() === '') index++;
      break;
    }
    if (
      candidateName
      && normalizeExportLine(line).toLowerCase() === normalizeExportLine(candidateName).toLowerCase()
    ) {
      index++;
      continue;
    }
    index++;
  }

  if (!passedDate) {
    const fallback = stripSchemaMarker(normalizedContent).split('\n');
    while (fallback.length > 0 && fallback[0].trim() === '') fallback.shift();
    if (
      candidateName
      && normalizeExportLine(fallback[0] ?? '').toLowerCase() === normalizeExportLine(candidateName).toLowerCase()
    ) {
      fallback.shift();
      while (fallback.length > 0 && fallback[0].trim() === '') fallback.shift();
    }
    if (fallback.length > 0 && isLikelyDateLine(fallback[0])) {
      fallback.shift();
      while (fallback.length > 0 && fallback[0].trim() === '') fallback.shift();
    }
    return fallback.join('\n').trim();
  }

  return lines.slice(index).join('\n').trim();
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
  fallbackRole: string;
  fallbackCompany: string;
  generate: (attempt: number, maxTokens: number, userPrompt: string) => Promise<string>;
}): Promise<StructuredCoverLetter> {
  let maxTokens = coverLetterMaxTokensForLocale(options.locale);
  const retryCap = coverLetterRetryMaxTokensForLocale(options.locale);
  const signatureName = options.candidateName || options.displayName;
  const dateLine = localizedDateLine(options.locale);

  for (let attempt = 0; attempt < 3; attempt++) {
    const retryNote = attempt > 0
      ? 'Previous JSON was invalid or incomplete. Return complete JSON with full paragraph3, closing, signOff, and candidateName. Do not stop mid-sentence.'
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
      retryNote,
    });

    const raw = await options.generate(attempt, maxTokens, userPrompt);
    const parsed = parseStructuredCoverLetterJson(raw);
    if (!parsed) {
      if (maxTokens < retryCap) maxTokens = retryCap;
      continue;
    }

    const validation = validateStructuredCoverLetter(
      parsed,
      options.locale,
      signatureName,
      options.companyName,
      options.closing,
    );

    if (validation.valid) {
      return parsed;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('[Cover Letter Structured]', {
        locale: options.locale,
        attempt,
        maxTokens,
        valid: false,
        errors: validation.errors,
      });
    }

    if (maxTokens < retryCap) maxTokens = retryCap;
  }

  throw new CoverLetterGenerationIncompleteError();
}
