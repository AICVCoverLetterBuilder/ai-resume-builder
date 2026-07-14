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
import { sanitizeCoverLetterContent } from './cover-letter-generation';
import {
  stripCoverLetterExportHeader,
  formatCoverLetterDocumentDate,
} from './cover-letter-header';
import {
  sanitizeJapanesePdfWrapMarkers,
  wrapJapanesePdfParagraphLines,
} from './cover-letter-japanese-pdf-wrap';

// ── Font Registration ─────────────────────────────────────────────────────────
// Fonts are served from /public/fonts/ and embedded into the PDF at render time.
// Hyphenation is disabled globally so Latin words never break mid-word with a
// discretionary hyphen. Japanese Cover Letter PDFs use explicit pre-wrapped
// lines (wrap={false}) because textkit still inserts U+002D between script-
// itemized kanji/kana syllables when auto-wrapping.

/** Browser: /fonts/... ; Node/tests: absolute public/fonts path (no path import). */
function coverLetterFontSrc(fileName: string): string {
  if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.cwd === 'function') {
    const root = process.cwd().replace(/\\/g, '/');
    return `${root}/public/fonts/${fileName}`;
  }
  return `/fonts/${fileName}`;
}

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: coverLetterFontSrc('NotoSans-Regular.ttf'), fontWeight: 400 },
    { src: coverLetterFontSrc('NotoSans-Bold.ttf'),    fontWeight: 700 },
  ],
});

Font.register({
  family: 'NotoSansArabic',
  fonts: [
    { src: coverLetterFontSrc('NotoSansArabic-Regular.ttf'), fontWeight: 400 },
    { src: coverLetterFontSrc('NotoSansArabic-Bold.ttf'),    fontWeight: 700 },
  ],
});

Font.register({
  family: 'NotoSansDevanagari',
  fonts: [
    { src: coverLetterFontSrc('NotoSansDevanagari-Regular.ttf'), fontWeight: 400 },
    { src: coverLetterFontSrc('NotoSansDevanagari-Bold.ttf'),    fontWeight: 700 },
  ],
});

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: coverLetterFontSrc('NotoSansJP-Regular.ttf'), fontWeight: 400 },
    { src: coverLetterFontSrc('NotoSansJP-Bold.ttf'),    fontWeight: 700 },
  ],
});

// Return each word intact so textkit does not insert discretionary soft hyphens
// for Latin scripts. Japanese lines are pre-wrapped separately (never syllabified).
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

/** Locale-aware document date; shared with preview via cover-letter-header. */
export function formatCoverLetterDate(locale: string): string {
  return formatCoverLetterDocumentDate(locale);
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
    /** Single pre-wrapped Japanese line — no textkit auto-wrap / hyphen insertion. */
    jaLine: {
      marginBottom: 0,
      textAlign: 'left',
    },
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface CoverLetterPDFProps {
  candidateName: string;
  content: string;
  locale: string;
}

/**
 * Pure text-preparation step shared by the PDF component: sanitizes the schema
 * marker, strips the leading name/contact/date header lines the API bakes in,
 * and splits the remainder into paragraph blocks. Exported so tests can assert
 * the exact text that would be rendered without mocking the renderer.
 *
 * Japanese: strips wrap markers only — no ZWSP/soft-hyphen injection. Actual
 * line breaks are computed by wrapJapanesePdfParagraphLines at render time.
 */
export function computeCoverLetterPdfParagraphs(
  content: string,
  candidateName: string,
  locale?: string,
): string[] {
  const sanitizedContent = sanitizeCoverLetterContent(content);
  const cleanedContent = stripCoverLetterExportHeader(sanitizedContent, candidateName);
  return cleanedContent
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (locale === 'ja' ? sanitizeJapanesePdfWrapMarkers(p) : p));
}

/** Explicit Japanese PDF lines per paragraph (layout only — not stored content). */
export function computeJapaneseCoverLetterPdfLines(
  content: string,
  candidateName: string,
): string[][] {
  return computeCoverLetterPdfParagraphs(content, candidateName, 'ja').map((para) =>
    wrapJapanesePdfParagraphLines(para),
  );
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
  const dateStr    = formatCoverLetterDate(locale);

  // Final safety net: never render the diagnostic structured-v4 schema marker,
  // even for a legacy saved draft that still has it embedded. Also strips the
  // leading name/date header lines the API bakes in (the date is re-rendered
  // above via `dateStr`) and splits the remainder into paragraph blocks.
  const paragraphs = computeCoverLetterPdfParagraphs(content, candidateName, locale);
  const japaneseParagraphLines =
    locale === 'ja' ? computeJapaneseCoverLetterPdfLines(content, candidateName) : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Date (once, at the top) ── */}
        <Text style={styles.date}>{dateStr}</Text>

        {/* ── Letter body (includes closing + signature from AI) ──
            @react-pdf/textkit runs the Unicode bidi algorithm and the
            embedded Noto Sans Arabic/Devanagari fonts' shaping tables
            automatically, so plain right-aligned <Text> renders Arabic/Hindi
            correctly without any extra "direction" style (that key isn't
            part of the supported Style API and was a no-op).
            Japanese: each visual line is a wrap={false} Text so textkit cannot
            insert U+002D at kanji/kana script boundaries. */}
        <View style={styles.body}>
          {japaneseParagraphLines
            ? japaneseParagraphLines.map((lines, i) => (
                <View key={i} style={styles.paragraph} wrap>
                  {lines.map((line, j) => (
                    <Text key={j} style={styles.jaLine} wrap={false}>
                      {line}
                    </Text>
                  ))}
                </View>
              ))
            : paragraphs.map((para, i) => (
                <Text key={i} style={styles.paragraph}>
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
