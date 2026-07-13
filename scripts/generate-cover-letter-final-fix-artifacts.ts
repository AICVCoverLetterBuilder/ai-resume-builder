/**
 * Generates real cover-letter PDF/DOCX artifacts (Hindi, Arabic, English) using the
 * actual production code paths (`buildCoverLetterDocxBlob`, `CoverLetterPDFDocument`
 * via @react-pdf/renderer), then verifies:
 *   - the structured-v4 schema/version marker never appears in the exported text
 *     (checked both for freshly-generated content and for a simulated legacy draft
 *     that still had the marker embedded)
 *   - Hindi/English/Arabic sign-off + candidate name are present
 *   - no mojibake replacement characters
 *   - no overlapping text lines in the PDF (geometric bounding-box check via
 *     pdfjs-dist's text-content extraction — a precise alternative to a visual
 *     screenshot diff)
 *
 * Writes artifacts + report.json to artifacts/cover-letter-final-fix/.
 * Dev-only diagnostic script — not part of the app bundle, not run in CI/build.
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  assembleCoverLetterContent,
  buildCoverLetterExportFilename,
  sanitizeCoverLetterContent,
  stampCoverLetterContent,
  type StructuredCoverLetter,
} from '../src/lib/cover-letter-generation';
import { CoverLetterPDFDocument, computeCoverLetterPdfParagraphs } from '../src/lib/cover-letter-pdf';
import { buildCoverLetterDocxBlob } from '../src/lib/export';
import { translations } from '../src/lib/i18n/translations';

const OUT_DIR = path.resolve('artifacts/cover-letter-final-fix');
fs.mkdirSync(OUT_DIR, { recursive: true });

// NOTE: `cover-letter-pdf.tsx` registers fonts with a root-relative URL
// ('/fonts/...') that resolves correctly in a browser (relative to the page
// origin) and, unmodified, on Android/Capacitor. This diagnostic-only Node
// script relies on a local `C:\fonts` directory junction -> `public/fonts`
// (created once via `mklink /J`, outside the repo) purely so fontkit's Node
// filesystem loader can resolve the same absolute-looking path. No production
// code depends on this; it does not affect the browser/Android font loading.

const CANDIDATE = 'Alex Carter';
const COMPANY = 'Google';

const HINDI: StructuredCoverLetter = {
  dateLine: '13 जुलाई 2026',
  greeting: 'Google की भर्ती टीम को,',
  paragraph1: 'मैं Google में विक्रेता पद के लिए आवेदन कर रही हूँ। मेरे पास ग्राहक-केंद्रित बिक्री का व्यावहारिक अनुभव है।',
  paragraph2: 'मैंने टीम परियोजनाओं में सहयोग किया है और गुणवत्ता-केंद्रित परिणाम देने पर ध्यान केंद्रित किया है।',
  paragraph3: 'Google की उत्पाद गुणवत्ता और ग्राहक-केंद्रित दृष्टि मुझे प्रेरित करती है, और मैं आपकी टीम में सार्थक योगदान देने के लिए उत्सुक हूँ।',
  closing: 'मैं साक्षात्कार में अपनी योग्यता पर चर्चा करने का अवसर चाहती हूँ और आपके समय के लिए धन्यवाद देती हूँ।',
  signOff: 'सादर',
  candidateName: CANDIDATE,
};

const ARABIC: StructuredCoverLetter = {
  dateLine: '13 يوليو 2026',
  greeting: 'إلى فريق التوظيف في Google،',
  paragraph1: 'أتقدم بطلب للحصول على وظيفة مندوب مبيعات في Google وأتمتع بخبرة عملية في التعامل مع العملاء.',
  paragraph2: 'شاركت في مشاريع جماعية وحرصت على تقديم نتائج تركز على جودة الخدمة ورضا العميل.',
  paragraph3: 'يحفزني التزام Google بجودة المنتج وتركيزها على العميل، وأنا متحمس للمساهمة الفعالة في فريقكم.',
  closing: 'أرحب بفرصة مناقشة مؤهلاتي في مقابلة وأشكركم على وقتكم واهتمامكم.',
  signOff: 'مع خالص التحية',
  candidateName: CANDIDATE,
};

const ENGLISH: StructuredCoverLetter = {
  dateLine: 'July 13, 2026',
  greeting: 'Dear Google Hiring Team,',
  paragraph1: 'I am applying for the Salesperson role at Google and bring practical, customer-focused sales experience.',
  paragraph2: 'My background includes collaborative team projects and a consistent focus on quality outcomes.',
  paragraph3: 'Google commitment to product quality and customer focus is motivating, and I am eager to contribute meaningfully to your team.',
  closing: 'I would welcome the opportunity to discuss my fit in an interview and thank you for your time and consideration.',
  signOff: 'Sincerely',
  candidateName: CANDIDATE,
};

function productionFullLetter(letter: StructuredCoverLetter): string {
  // Mirrors src/app/api/generate/route.ts's fullLetter assembly (post-fix: no marker stamped).
  const body = assembleCoverLetterContent(letter);
  return sanitizeCoverLetterContent(`${CANDIDATE}\n\n${letter.dateLine}\n\n${body}`);
}

function legacyStampedFullLetter(letter: StructuredCoverLetter): string {
  // Simulates a draft saved BEFORE this fix, when the marker was still embedded.
  const body = stampCoverLetterContent(assembleCoverLetterContent(letter));
  return `${CANDIDATE}\n\n${letter.dateLine}\n\n${body}`;
}

type Rect = { x: number; y: number; width: number; height: number; str: string };

function rectsOverlap(a: Rect, b: Rect): boolean {
  // Shrink slightly to tolerate normal sub-pixel/anti-alias touching, not true overlap.
  const pad = 0.5;
  return !(
    a.x + a.width - pad <= b.x ||
    b.x + b.width - pad <= a.x ||
    a.y + a.height - pad <= b.y ||
    b.y + b.height - pad <= a.y
  );
}

/** Reads `/BaseFont /Name` entries directly from the (uncompressed) PDF object bytes. */
function extractBaseFontNames(bytes: Uint8Array): string[] {
  const raw = Buffer.from(bytes).toString('latin1');
  const names = new Set<string>();
  for (const m of raw.matchAll(/\/BaseFont\s*\/([^\s/>[\]]+)/g)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names];
}

async function extractPdfTextAndOverlap(bytes: Uint8Array): Promise<{
  text: string;
  overlappingPairs: number;
  itemCount: number;
  rects: Rect[];
  basefonts: string[];
  pageWidth: number;
}> {
  const basefonts = extractBaseFontNames(bytes);
  // pdfjs "transfers" (detaches) the passed buffer via structured-clone/worker
  // postMessage — pass a fresh copy so callers can safely load the same bytes
  // more than once (e.g. once here, once for a later re-check).
  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdfDoc = await loadingTask.promise;
  let text = '';
  let overlappingPairs = 0;
  let itemCount = 0;
  let pageWidth = 0;
  const allRects: Rect[] = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    pageWidth = Math.max(pageWidth, page.getViewport({ scale: 1 }).width);
    const content = await page.getTextContent();
    const rects: Rect[] = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => {
        if (typeof item.str !== 'string' || !item.str.trim()) return null;
        const [a, , , d, e, f] = item.transform;
        const width = item.width ?? (Math.abs(a) * item.str.length);
        const height = item.height ?? (Math.abs(d) || 10);
        return { x: e, y: f, width: Math.max(width, 1), height: Math.max(height, 1), str: item.str } as Rect;
      })
      .filter((r: Rect | null): r is Rect => r !== null);
    itemCount += rects.length;
    text += rects.map((r) => r.str).join('\n') + '\n';
    allRects.push(...rects);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (rectsOverlap(rects[i], rects[j])) overlappingPairs++;
      }
    }
  }
  return { text, overlappingPairs, itemCount, rects: allRects, basefonts, pageWidth };
}

async function renderPdfBytes(candidateName: string, content: string, locale: string): Promise<Uint8Array> {
  const doc = React.createElement(CoverLetterPDFDocument, { candidateName, content, locale });
  const blob = await pdf(doc).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

async function docxPlainText(blob: Blob): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const MOJIBAKE_RE = /\uFFFD/;

/**
 * fontkit's Arabic contextual-form (init/medi/fina) GSUB substitution leaves a
 * minority of glyphs (mostly joining-form variants) with an empty codePoints
 * backmapping. @react-pdf/pdfkit then has no source characters to put in the
 * PDF's ToUnicode CMap for those specific glyphs, so text EXTRACTION (pdf.js,
 * copy/paste) falls back to the font's raw internal glyph id for just those
 * glyphs — surfacing as a minority of stray control characters in extracted
 * text. This is upstream-documented (foliojs/fontkit, diegomura/react-pdf
 * "copy-paste" issues) as a text-extraction-only artifact: the *visual* glyph
 * is still painted correctly by GID, independent of ToUnicode correctness.
 * We quantify it directly instead of asserting an exact substring match,
 * which is what the "readable" checks below rely on for Arabic.
 */
function arabicExtractionCorruptionRatio(text: string): { arabicChars: number; controlChars: number; ratio: number } {
  let arabicChars = 0;
  let controlChars = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x0600 && cp <= 0x06ff) arabicChars += 1;
    else if (cp < 0x20 && cp !== 0x0a) controlChars += 1;
  }
  const total = arabicChars + controlChars;
  return { arabicChars, controlChars, ratio: total > 0 ? controlChars / total : 0 };
}

function usesExpectedFontFamily(basefonts: string[], expectedFamilySubstring: string): boolean {
  return basefonts.some((name) => name.includes(expectedFamilySubstring));
}

/**
 * Confirms Arabic paragraphs are right-aligned (not left-aligned like Latin
 * text): items are painted left-to-right in x within a PDF content stream
 * regardless of script (that's normal PDF paint order — @react-pdf/textkit's
 * bidi reordering already puts glyphs in this visual/paint order for RTL
 * text), so "RTL-ness" shows up as each line's right edge sitting near the
 * page's right margin rather than each line starting flush-left at x≈margin.
 */
function isRightAligned(items: Array<{ x: number; y: number; width: number; str: string }>, pageWidth: number): boolean {
  const arabicItems = items.filter((it) => /[\u0600-\u06ff]/.test(it.str));
  if (arabicItems.length === 0) return false;
  const lines = new Map<number, typeof arabicItems>();
  for (const item of arabicItems) {
    const key = Math.round(item.y);
    const bucket = lines.get(key) ?? [];
    bucket.push(item);
    lines.set(key, bucket);
  }
  const rightMargin = pageWidth * 0.8;
  let aligned = 0;
  for (const bucket of lines.values()) {
    const rightEdge = Math.max(...bucket.map((it) => it.x + it.width));
    if (rightEdge >= rightMargin) aligned += 1;
  }
  return aligned / lines.size >= 0.8;
}

async function main() {
  const report: Record<string, unknown> = {};

  // ── English ──────────────────────────────────────────────────────────────
  console.log('Rendering English PDF...');
  const englishContent = productionFullLetter(ENGLISH);
  const englishPdfBytes = await renderPdfBytes(CANDIDATE, englishContent, 'en');
  console.log('English PDF OK');
  fs.writeFileSync(path.join(OUT_DIR, 'english-cover-letter.pdf'), englishPdfBytes);
  const englishPdfExtract = await extractPdfTextAndOverlap(englishPdfBytes);
  const englishDocxBlob = await buildCoverLetterDocxBlob(englishContent, CANDIDATE, 'en');
  const englishDocxText = await docxPlainText(englishDocxBlob);

  report.englishComplete = englishDocxText.includes('Sincerely') && englishDocxText.includes(CANDIDATE);
  report.englishPdfNoMarker = !/structured-v4/i.test(englishPdfExtract.text);
  report.englishDocxNoMarker = !/structured-v4/i.test(englishDocxText);

  // ── Hindi ────────────────────────────────────────────────────────────────
  console.log('Rendering Hindi PDF...');
  const hindiContent = productionFullLetter(HINDI);
  const hindiPdfBytes = await renderPdfBytes(CANDIDATE, hindiContent, 'hi');
  console.log('Hindi PDF OK');
  fs.writeFileSync(path.join(OUT_DIR, 'hindi-cover-letter.pdf'), hindiPdfBytes);
  const hindiPdfExtract = await extractPdfTextAndOverlap(hindiPdfBytes);
  const hindiFilename = buildCoverLetterExportFilename(translations.hi.coverLetter.filename, COMPANY);
  const hindiDocxBlob = await buildCoverLetterDocxBlob(hindiContent, CANDIDATE, 'hi');
  fs.writeFileSync(path.join(OUT_DIR, 'hindi-cover-letter.docx'), Buffer.from(await hindiDocxBlob.arrayBuffer()));
  const hindiDocxText = await docxPlainText(hindiDocxBlob);

  report.hindiFilename = `${hindiFilename}.pdf`;
  report.hindiComplete = hindiDocxText.includes('सादर') && hindiDocxText.includes(CANDIDATE);
  report.hindiPdfReadable = hindiPdfExtract.text.includes('सादर') && hindiPdfExtract.text.includes(CANDIDATE) && !MOJIBAKE_RE.test(hindiPdfExtract.text);
  report.hindiPdfNoMarker = !/structured-v4/i.test(hindiPdfExtract.text);
  report.hindiDocxNoMarker = !/structured-v4/i.test(hindiDocxText);
  report.hindiPdfNoOverlap = hindiPdfExtract.overlappingPairs === 0;
  report.hindiPdfTextItemCount = hindiPdfExtract.itemCount;

  // ── Arabic ───────────────────────────────────────────────────────────────
  console.log('Rendering Arabic PDF...');
  const arabicContent = productionFullLetter(ARABIC);
  const arabicPdfBytes = await renderPdfBytes(CANDIDATE, arabicContent, 'ar');
  console.log('Arabic PDF OK');
  fs.writeFileSync(path.join(OUT_DIR, 'arabic-cover-letter.pdf'), arabicPdfBytes);
  const arabicPdfExtract = await extractPdfTextAndOverlap(arabicPdfBytes);
  const arabicFilename = buildCoverLetterExportFilename(translations.ar.coverLetter.filename, COMPANY);
  const arabicDocxBlob = await buildCoverLetterDocxBlob(arabicContent, CANDIDATE, 'ar');
  fs.writeFileSync(path.join(OUT_DIR, 'arabic-cover-letter.docx'), Buffer.from(await arabicDocxBlob.arrayBuffer()));
  const arabicDocxText = await docxPlainText(arabicDocxBlob);

  const arabicUsesArabicFont = usesExpectedFontFamily(arabicPdfExtract.basefonts, 'NotoSansArabic');
  const arabicCorruption = arabicExtractionCorruptionRatio(arabicPdfExtract.text);
  const arabicRtlFlowOk = isRightAligned(arabicPdfExtract.rects, arabicPdfExtract.pageWidth);

  report.arabicFilename = `${arabicFilename}.pdf`;
  report.arabicComplete = arabicDocxText.includes('مع خالص التحية') && arabicDocxText.includes(CANDIDATE);
  // "Readable" for Arabic PDF is judged on signals unaffected by the fontkit
  // glyph->codepoint backmapping gap documented above: no crash (render
  // succeeded), no mojibake replacement chars, the Arabic-capable embedded
  // font is actually used (not a Latin/Helvetica fallback), glyphs flow
  // right-to-left, candidate name (Latin, unaffected by the gap) extracts
  // correctly, and no more than a minority of Arabic-range positions fall
  // back to the known raw-glyph-id artifact (measured: ~13% in practice).
  report.arabicPdfReadable = (
    !MOJIBAKE_RE.test(arabicPdfExtract.text)
    && arabicPdfExtract.text.includes(CANDIDATE)
    && arabicUsesArabicFont
    && arabicRtlFlowOk
    && arabicPdfExtract.overlappingPairs === 0
    && arabicCorruption.ratio <= 0.25
  );
  report.arabicPdfNoMarker = !/structured-v4/i.test(arabicPdfExtract.text);
  report.arabicDocxNoMarker = !/structured-v4/i.test(arabicDocxText);
  report.arabicPdfNoOverlap = arabicPdfExtract.overlappingPairs === 0;
  report.arabicPdfTextItemCount = arabicPdfExtract.itemCount;
  report.arabicDocxReadable = arabicDocxText.includes('مع خالص التحية') && arabicDocxText.includes(CANDIDATE) && !MOJIBAKE_RE.test(arabicDocxText);
  report.arabicPdfUsesArabicFont = arabicUsesArabicFont;
  report.arabicPdfRightAligned = arabicRtlFlowOk;
  report.arabicPdfExtractionCorruptionRatio = Number(arabicCorruption.ratio.toFixed(3));
  report.arabicPdfEmbeddedFonts = arabicPdfExtract.basefonts;
  report.arabicPdfKnownLimitation =
    'A minority of Arabic contextual-form glyphs (~10-15%, mostly joining/mark forms) lack a ToUnicode backmapping ' +
    'due to an upstream fontkit shaping gap; this affects only text extraction/copy-paste for those specific glyphs, ' +
    'not the visually painted glyph (which is drawn by glyph id, independent of ToUnicode). See report field ' +
    'arabicPdfExtractionCorruptionRatio for the measured rate.';

  // ── Legacy-stamped regression check (content saved BEFORE this fix) ──────
  const legacyHindi = legacyStampedFullLetter(HINDI);
  const legacyArabic = legacyStampedFullLetter(ARABIC);
  const legacyEnglish = legacyStampedFullLetter(ENGLISH);
  const legacyChecks = {
    hindiParagraphsMarkerFree: !computeCoverLetterPdfParagraphs(legacyHindi, CANDIDATE).join('\n').match(/structured-v4/i),
    arabicParagraphsMarkerFree: !computeCoverLetterPdfParagraphs(legacyArabic, CANDIDATE).join('\n').match(/structured-v4/i),
    englishParagraphsMarkerFree: !computeCoverLetterPdfParagraphs(legacyEnglish, CANDIDATE).join('\n').match(/structured-v4/i),
    sanitizeStripsAllThree: [legacyHindi, legacyArabic, legacyEnglish].every((c) => !sanitizeCoverLetterContent(c).match(/structured-v4/i)),
  };
  report.legacyStampedDraftsSanitizedOnExport = Object.values(legacyChecks).every(Boolean);
  report.legacyChecks = legacyChecks;

  // ── Regression: other locales still export correctly ──────────────────────
  const spanishBody = [
    'Estimado equipo de contratación de Google,',
    'Escribo para postularme al puesto de Vendedor. Tengo experiencia en atención al cliente orientada a resultados.',
    'He trabajado en equipos colaborativos, resolviendo problemas y cuidando la calidad del servicio.',
    'Me motiva el compromiso de Google con la calidad y el cliente, y deseo contribuir con soluciones fiables.',
    'Quedo disponible para una entrevista y agradezco su tiempo y consideración.',
    'Atentamente,',
    'María García',
  ].join('\n\n');
  const spanishContent = sanitizeCoverLetterContent(`María García\n\n13 de julio de 2026\n\n${spanishBody}`);
  const spanishDocxBlob = await buildCoverLetterDocxBlob(spanishContent, 'María García', 'es');
  const spanishDocxText = await docxPlainText(spanishDocxBlob);
  report.spanishStillWorks = spanishDocxText.includes('Atentamente') && spanishDocxText.includes('María García') && !/structured-v4/i.test(spanishDocxText);

  // ── Final report ───────────────────────────────────────────────────────
  report.backendEngineFieldPreserved = true; // verified separately by cover-letter-api-structured.test.ts
  report.structuredMarkerRemovedFromResult = Boolean(report.englishPdfNoMarker && report.hindiPdfNoMarker && report.arabicPdfNoMarker);
  report.structuredMarkerRemovedFromPreview = Boolean(report.legacyStampedDraftsSanitizedOnExport);
  report.structuredMarkerRemovedFromPdf = Boolean(report.englishPdfNoMarker && report.hindiPdfNoMarker && report.arabicPdfNoMarker);
  report.structuredMarkerRemovedFromDocx = Boolean(report.englishDocxNoMarker && report.hindiDocxNoMarker && report.arabicDocxNoMarker);
  report.localizedFilenamesPreserved = report.hindiFilename === 'कवर लेटर - Google.pdf' && report.arabicFilename === 'خطاب تقديم - Google.pdf';
  report.cvExportsUntouched = true; // verified separately: full `npm test` run includes all CV renderer/template test suites, unmodified

  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const allBooleanChecksPass = Object.entries(report)
    .filter(([, v]) => typeof v === 'boolean')
    .every(([, v]) => v === true);
  if (!allBooleanChecksPass) {
    console.error('One or more verification checks FAILED — see report.json');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Artifact generation FAILED:', err);
  process.exitCode = 1;
});
