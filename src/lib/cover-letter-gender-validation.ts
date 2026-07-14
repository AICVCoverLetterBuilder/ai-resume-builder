/**
 * Grammatical-gender and self-correction checks for cover letters.
 * Selected app gender is the only source of truth.
 */
import type { Locale } from './i18n/translations';
import {
  normalizeCoverLetterGender,
  type CoverLetterGender,
} from './cover-letter-gender';
import type { GroundingViolation } from './cover-letter-grounding';

const HINDI_MASCULINE_SPEAKER: RegExp[] = [
  /चाहता\s+हूँ/u,
  /कर\s+रहा\s+हूँ/u,
  /प्रस्तुत\s+कर\s+रहा\s+हूँ/u,
  /करूँगा/u,
  /रहोँगा|रहूँगा/u,
  /उपलब्ध\s+रहना\s+चाहता/u,
  /आवेदन\s+कर\s+रहा\s+हूँ/u,
];

const HINDI_FEMININE_SPEAKER: RegExp[] = [
  /चाहती\s+हूँ/u,
  /कर\s+रही\s+हूँ/u,
  /प्रस्तुत\s+कर\s+रही\s+हूँ/u,
  /करूँगी/u,
  /रहूँगी/u,
  /उपलब्ध\s+रहना\s+चाहती/u,
  /आवेदन\s+कर\s+रही\s+हूँ/u,
];

/** Awkward third-person self-reference workarounds (unspecified Hindi). */
const HINDI_THIRD_PERSON_WORKAROUND: RegExp[] = [
  /आवेदन\s+कर\s+रहे\s+हैं/u,
  /आवेदन\s+कर\s+रही\s+हैं/u,
  /प्रस्तुत\s+कर\s+रहे\s+हैं/u,
];

const ARABIC_MASCULINE_SPEAKER: RegExp[] = [
  /(?:^|[^\u0600-\u06FF])(حريص|متاح|مستعد|مهتم|متحمس|سعيد)(?=[^\u0600-\u06FF]|$)/u,
];

const ARABIC_FEMININE_SPEAKER: RegExp[] = [
  /(?:^|[^\u0600-\u06FF])(حريصة|متاحة|مستعدة|مهتمة|متحمسة|سعيدة)(?=[^\u0600-\u06FF]|$)/u,
];

/**
 * Visible drafting / self-correction leakage. Do not flag ordinary uses of नहीं.
 */
const SELF_CORRECTION_LEAK_PATTERNS: RegExp[] = [
  /[—–\-]\s*नहीं/u,
  /क्षमा\s+करें/u,
  /मेरा\s+मतलब/u,
  /\bI\s+mean\b/i,
  /\bSorry,?\s+let\s+me\s+correct\b/i,
  /\blet\s+me\s+rephrase\b/i,
  /\bactually,?\s+I\s+meant\b/i,
  /\bwait,?\s+I\s+meant\b/i,
  /\bSorry\b.{0,40}\bcorrect\b/i,
  /عذرًا[،,]?\s+أقصد|دعني\s+أصحح|قصدت\s+أن\s+أقول/u,
];

function collectPatternMatches(text: string, patterns: RegExp[]): string[] {
  const out: string[] = [];
  for (const pattern of patterns) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const re = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const value = (match[1] || match[0] || '').trim();
      if (value && !out.includes(value)) out.push(value);
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
  }
  return out;
}

export function findSelfCorrectionLeaks(content: string): string[] {
  return collectPatternMatches(content, SELF_CORRECTION_LEAK_PATTERNS);
}

/**
 * Gendered speaker-form mismatches for the selected app gender.
 * Serbian "Bila bi mi čast" must NOT be treated as female speaker grammar
 * (subject is čast). We deliberately do not scan Serbian for that pattern.
 */
export function findGenderFormMismatches(
  content: string,
  locale: Locale | string,
  genderRaw: unknown,
): string[] {
  const gender = normalizeCoverLetterGender(genderRaw);
  const loc = locale as Locale;
  const matched: string[] = [];

  if (loc === 'hi') {
    const masculine = collectPatternMatches(content, HINDI_MASCULINE_SPEAKER);
    const feminine = collectPatternMatches(content, HINDI_FEMININE_SPEAKER);
    if (gender === 'unspecified') {
      matched.push(...masculine, ...feminine);
      matched.push(...collectPatternMatches(content, HINDI_THIRD_PERSON_WORKAROUND));
    } else if (gender === 'male') {
      matched.push(...feminine);
    } else if (gender === 'female') {
      matched.push(...masculine);
    }
  }

  if (loc === 'ar') {
    const masculine = collectPatternMatches(content, ARABIC_MASCULINE_SPEAKER);
    const feminine = collectPatternMatches(content, ARABIC_FEMININE_SPEAKER);
    if (gender === 'unspecified') {
      matched.push(...masculine, ...feminine);
    } else if (gender === 'male') {
      matched.push(...feminine);
    } else if (gender === 'female') {
      matched.push(...masculine);
    }
  }

  return [...new Set(matched)];
}

export function collectGenderAndSelfCorrectionViolations(
  content: string,
  options?: { locale?: Locale | string; gender?: CoverLetterGender | string },
): GroundingViolation[] {
  const violations: GroundingViolation[] = [];
  for (const matched of findSelfCorrectionLeaks(content)) {
    violations.push({ kind: 'self_correction_leak', matched });
  }
  if (options?.locale != null) {
    for (const matched of findGenderFormMismatches(content, options.locale, options.gender)) {
      violations.push({
        kind: 'gender_form_mismatch',
        matched,
        evidence: `locale=${options.locale};gender=${normalizeCoverLetterGender(options.gender)}`,
      });
    }
  }
  return violations;
}
