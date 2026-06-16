/**
 * Cover Letter PDF renderer using @react-pdf/renderer.
 * Produces a proper text-based A4 PDF – no html2canvas, no screenshots.
 *
 * FONT STRATEGY
 * ─────────────
 * @react-pdf/renderer uses its own PDF engine (not the browser). The built-in
 * PDF fonts (Helvetica, Times, Courier) only cover ASCII / basic Latin and
 * will render all extended characters as "?" or broken symbols.
 *
 * We register Noto Sans TTF files (embedded in the PDF) for full Unicode:
 *   NotoSans          – Latin Extended, Cyrillic, Greek (Serbian, Croatian,
 *                       Russian, German, French, Italian, Spanish, Portuguese)
 *   NotoSansArabic    – Arabic script
 *   NotoSansDevanagari– Devanagari script (Hindi)
 *   NotoSansJP        – Japanese (CJK)
 *
 * The locale prop selects which font family to use so every language renders
 * its own script correctly.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';

// ── Font Registration ─────────────────────────────────────────────────────────
// Fonts are served from /public/fonts/ and embedded into the PDF at render time.
// Hyphenation is disabled globally so words never break mid-word.

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/fonts/NotoSans-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/NotoSans-Bold.ttf',    fontWeight: 700 },
  ],
});

Font.register({
  family: 'NotoSansArabic',
  fonts: [
    { src: '/fonts/NotoSansArabic-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/NotoSansArabic-Bold.ttf',    fontWeight: 700 },
  ],
});

Font.register({
  family: 'NotoSansDevanagari',
  fonts: [
    { src: '/fonts/NotoSansDevanagari-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/NotoSansDevanagari-Bold.ttf',    fontWeight: 700 },
  ],
});

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: '/fonts/NotoSansJP-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/NotoSansJP-Bold.ttf',    fontWeight: 700 },
  ],
});

// Disable automatic hyphenation so words are never split across lines
Font.registerHyphenationCallback((word) => [word]);

// ── Font family selector ──────────────────────────────────────────────────────

/**
 * Return the correct Noto Sans family for the given app locale.
 * All Latin-script languages (including those with diacritics like Serbian
 * Latin, Croatian, German, French, etc.) use 'NotoSans' which has full
 * Latin Extended coverage including č ć š đ ž ä ö ü ñ ç ê â etc.
 */
function fontFamilyForLocale(locale: string): string {
  switch (locale) {
    case 'ar':   return 'NotoSansArabic';
    case 'hi':   return 'NotoSansDevanagari';
    case 'ja':   return 'NotoSansJP';
    default:     return 'NotoSans'; // en, de, es, fr, it, pt-BR, ru, sr, hr
  }
}

// ── Locale → date format ──────────────────────────────────────────────────────

/**
 * Format today's date according to the selected locale.
 * Returns a clean UTF-8 string. Serbian Latin stays in Latin script
 * (sr-Latn-RS, NOT sr-Cyrl which would produce Cyrillic month names).
 *
 * For Arabic we force Latin digits and Latin month names since Arabic
 * numeral rendering is unreliable in PDF fonts; result looks like
 * "30 أبريل 2026" (day + Arabic month name + year in Western digits).
 */
function formatDate(locale: string): string {
  const date = new Date();

  const localeMap: Record<string, string> = {
    en:    'en-US',
    de:    'de-DE',
    es:    'es-ES',
    fr:    'fr-FR',
    it:    'it-IT',
    ar:    'ar-EG',
    sr:    'sr-Latn-RS',   // Serbian Latin
    hr:    'hr-HR',
    ru:    'ru-RU',
    'pt-BR': 'pt-BR',
    hi:    'hi-IN',
    ja:    'ja-JP',
  };

  const tag = localeMap[locale] ?? 'en-US';

  try {
    return new Intl.DateTimeFormat(tag, {
      year:  'numeric',
      month: 'long',
      day:   'numeric',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      year:  'numeric',
      month: 'long',
      day:   'numeric',
    }).format(date);
  }
}

// ── RTL locale detection ──────────────────────────────────────────────────────

function isRTLLocale(locale: string): boolean {
  return locale === 'ar';
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(fontFamily: string, rtl: boolean) {
  return StyleSheet.create({
    page: {
      fontFamily,
      fontSize:      11,
      lineHeight:    1.55,
      color:         '#1F2937',
      paddingTop:    56,   // ~20 mm
      paddingBottom: 56,
      paddingLeft:   60,   // ~21 mm
      paddingRight:  60,
    },
    date: {
      fontSize:     11,
      color:        '#4B5563',
      marginBottom: 20,
      textAlign:    rtl ? 'right' : 'left',
    },
    body: {
      fontSize:   11,
      lineHeight: 1.6,
    },
    paragraph: {
      marginBottom: 10,
      textAlign:    rtl ? 'right' : 'left',
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip the candidate name when it appears as a standalone leading line
 * in the API-produced header block. The name must appear only at the bottom
 * as part of the AI closing ("Sincerely,\nJohn Doe"), so we remove any bare
 * leading name line but deliberately leave the trailing signature intact.
 *
 * The full structure the API produces:
 *   {name}              ← header line – strip this
 *   {email / phone}     ← also strip (contact lines in header)
 *   {date}              ← stripped separately by stripLeadingDate
 *   {letter body}
 *   Sincerely,
 *   {name}              ← keep – this is the sole signature
 */
function stripLeadingName(raw: string, candidateName: string): string {
  if (!candidateName.trim()) return raw;

  const nameLower = candidateName.trim().toLowerCase();
  const lines = raw.split('\n');

  // Strip any leading lines that are exactly the candidate name
  while (lines.length > 0 && lines[0].trim().toLowerCase() === nameLower) {
    lines.shift();
  }
  // Strip leading blank lines that follow
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  return lines.join('\n');
}

/**
 * Strip any leading line(s) that look like a date (contain a 4-digit year).
 * The API bakes a date into the content string; the PDF component renders its
 * own localized date, so we must remove the one embedded in the text to
 * prevent it appearing twice.
 *
 * Detection: a line is treated as a date line when it contains a 4-digit
 * year (e.g. "April 30, 2026", "30 أبريل 2026", "30 avril 2026", etc.).
 * Year numbers in letter bodies (e.g. "worked there since 2019") are never
 * the very first non-empty line, so false-positive risk is minimal.
 */
function stripLeadingDate(text: string): string {
  const lines = text.split('\n');

  // Strip leading blank lines first, then check for date
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  if (lines.length > 0 && /\b\d{4}\b/.test(lines[0].trim())) {
    lines.shift();
    // Also strip blank lines that follow the date
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
  }

  return lines.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface CoverLetterPDFProps {
  candidateName: string;
  content: string;
  locale: string;
}

/**
 * React-PDF document for a Cover Letter.
 *
 * Layout (top → bottom):
 *   1. Date        (locale-formatted, rendered once by this component)
 *   2. Letter body (greeting + paragraphs from AI output)
 *   3. Closing + candidate name (part of AI body – e.g. "Sincerely,\nJohn Doe")
 *
 * The candidate name is NOT rendered at the top. It appears only once, at the
 * bottom, as part of the AI-generated closing signature.
 */
export function CoverLetterPDFDocument({
  candidateName,
  content,
  locale,
}: CoverLetterPDFProps) {
  const fontFamily = fontFamilyForLocale(locale);
  const rtl        = isRTLLocale(locale);
  const styles     = makeStyles(fontFamily, rtl);
  const dateStr    = formatDate(locale);

  // Strip any standalone leading name line the API adds as a header block
  const afterName = stripLeadingName(content, candidateName);
  // Strip the date line the API bakes in — the PDF component renders its own
  const cleanedContent = stripLeadingDate(afterName);

  // Split on blank lines or single newlines into individual paragraphs
  const paragraphs = cleanedContent
    .split(/\n{2,}|\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Date (once, at the top) ── */}
        <Text style={styles.date}>{dateStr}</Text>

        {/* ── Letter body (includes closing + signature from AI) ── */}
        <View style={styles.body}>
          {paragraphs.map((para, i) => (
            <Text
              key={i}
              style={[
                styles.paragraph,
                // RTL: tell the text-layout engine to handle bidi correctly
                rtl ? ({ direction: 'rtl' } as Style) : ({} as Style),
              ]}
            >
              {para}
            </Text>
          ))}
        </View>

        {/* NOTE: NO second <Text>{candidateName}</Text> here.
            The AI-generated body already ends with "Sincerely,\n{name}".
            Adding another name block would create a duplicate. */}
      </Page>
    </Document>
  );
}
