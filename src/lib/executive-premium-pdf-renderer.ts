/**
 * Executive Premium — dedicated direct jsPDF renderer (full rebuild).
 *
 * Unicode-first: embeds multilingual Noto families via shared pdf-i18n-text layer.
 * Page-aware layout with continuation headings and hanging-indent bullets.
 */
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import {
  isRtlLocale,
  pdfI18nCtxApplyStyle,
  pdfI18nCtxDraw,
  pdfI18nCtxSplit,
  pdfI18nCtxTextWidth,
  registerPdfI18nFonts,
  shouldApplyLatinPdfSentenceFixes,
  type PdfI18nRegistry,
} from './pdf-i18n-text';
import { drawRectPdfPhoto, preparePdfRectPhotoDataUrl } from './pdf-photo';
import type { CVData } from './types';

const A4_W = 210;
const A4_H = 297;

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

export type ExecutivePremiumDirectPdfContext = {
  pdf: Pdf;
  cv: CVData;
  locale: Locale;
  labels: ReturnType<typeof getExecutivePremiumPdfLabels>;
  i18n: PdfI18nRegistry;
  unicodeReady: boolean;
  lastTextStyle?: Style;
  contentX: number;
  contentW: number;
  marginTop: number;
  marginBottom: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
};

type Style = {
  size: number;
  color: [number, number, number];
  bold?: boolean;
  italic?: boolean;
  lineH: number;
};

type BulletUnit = { lines: string[] };

type BulletLayout = { markerX: number; textX: number; textW: number };

const NAVY: [number, number, number] = [17, 24, 39];
const GOLD: [number, number, number] = [217, 119, 6];
const SOFT_GOLD: [number, number, number] = [252, 211, 77];
const TEXT: [number, number, number] = [17, 24, 39];
const BODY: [number, number, number] = [55, 65, 81];
const MUTED: [number, number, number] = [107, 114, 128];
const HEADING: [number, number, number] = [156, 163, 175];
const RULE: [number, number, number] = [229, 231, 235];
const CONTACT: [number, number, number] = [209, 213, 219];

const MARGIN_X = 16;
const MARGIN_TOP_CONT = 16;
const MARGIN_BOTTOM = 14;
const BODY_AFTER_HEADER = 12;
const BODY_LINE = 3.7;
const BULLET_LH = 3.6;
const BULLET_INDENT = 4.2;
const SECTION_H = 7.5;
/** Portrait photo in header — matches preview ratio 54×72 (3:4), unframed. */
const EP_PHOTO_W = 10.5;
const EP_PHOTO_H = 14;
const EP_PHOTO_PREP_W_PX = 216;
const EP_PHOTO_PREP_H_PX = 288;
const SPARSE_LOWER_THRESHOLD_MM = 52;

export function getExecutivePremiumPdfLabels(locale: Locale) {
  const t = translations[locale] ?? translations.en;
  return {
    summary: t.cv.summary,
    experience: t.cv.experience,
    education: t.cv.education,
    skills: t.cv.skills,
    languages: t.cv.languages,
    certifications: t.cv.certifications,
    present: t.cv.present,
    summaryContinued: `${t.cv.summary} continued`,
  };
}

/** Embed multilingual Noto families into jsPDF. */
export async function epRegisterUnicodeFonts(pdf: Pdf): Promise<boolean> {
  const i18n = await registerPdfI18nFonts(pdf);
  return i18n.latinReady;
}

/**
 * PDF-only text cleanup. Does not mutate saved CV data.
 */
export function epNormalizePdfText(text: string, locale: Locale = 'en'): string {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');
  if (!shouldApplyLatinPdfSentenceFixes(locale, text)) {
    return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }

  const protect: Array<{ token: string; stub: string }> = [
    { token: 'Node.js', stub: '\u0001NODEJS\u0001' },
    { token: 'node.js', stub: '\u0001nodejs\u0001' },
    { token: 'Express.js', stub: '\u0001EXPRESSJS\u0001' },
    { token: 'Next.js', stub: '\u0001NEXTJS\u0001' },
    { token: 'Vue.js', stub: '\u0001VUEJS\u0001' },
    { token: 'TypeScript', stub: '\u0001TS\u0001' },
    { token: 'JavaScript', stub: '\u0001JS\u0001' },
    { token: 'CI/CD', stub: '\u0001CICD\u0001' },
    { token: 'REST APIs', stub: '\u0001RESTAPIS\u0001' },
    { token: 'REST API', stub: '\u0001RESTAPI\u0001' },
  ];
  for (const p of protect) out = out.split(p.token).join(p.stub);

  const emails: string[] = [];
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (email) => {
    const stub = `\u0001EMAIL${emails.length}\u0001`;
    emails.push(email);
    return stub;
  });

  const latLo = 'a-z\u0161\u0111\u010d\u0107\u017e';
  const latHi = 'A-Z\u0160\u0110\u010c\u0106\u017d';
  out = out.replace(new RegExp(`([${latLo}])\\.([${latHi}])`, 'g'), '$1. $2');
  out = out.replace(new RegExp(`([${latLo}])\\.([${latHi}])`, 'g'), '$1. $2');
  out = out.replace(new RegExp(`\\.([${latLo}]{3,})\\.(\s*)([${latHi}])`, 'g'), '. $1. $3');
  out = out.replace(new RegExp(`([${latLo}]{3,})\\.([${latLo}]{3,})`, 'g'), '$1. $2');
  out = out.replace(
    /\.([ \t]*)(lead|logic|applied|environments|built|designed|assisted)(?=\.?[A-Z\u0160\u0110\u010c\u0106\u017d])/gi,
    '. $2',
  );
  out = out.replace(new RegExp(`([${latLo}])\\.([${latHi}])`, 'g'), '$1. $2');
  out = out.replace(new RegExp(`([${latLo}]{2,})([${latHi}][${latLo}]{2,})`, 'g'), '$1. $2');

  for (const p of protect) out = out.split(p.stub).join(p.token);
  emails.forEach((email, index) => {
    out = out.split(`\u0001EMAIL${index}\u0001`).join(email);
  });

  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

function applyStyle(ctx: ExecutivePremiumDirectPdfContext, s: Style, text?: string): void {
  ctx.lastTextStyle = s;
  pdfI18nCtxApplyStyle(ctx, { size: s.size, color: s.color, bold: s.bold }, text);
}

function drawText(
  ctx: ExecutivePremiumDirectPdfContext,
  text: string,
  x: number,
  y: number,
  style: Style,
  extra: { align?: 'left' | 'center' | 'right' } = {},
): void {
  pdfI18nCtxDraw(ctx, text, x, y, {
    size: style.size,
    color: style.color,
    bold: style.bold,
    rtl: isRtlLocale(ctx.locale),
    align: extra.align ?? 'left',
  });
}

export function epMeasureWrappedLines(
  ctx: ExecutivePremiumDirectPdfContext,
  text: string,
  maxW: number,
  style?: Pick<Style, 'size' | 'bold'>,
): string[] {
  const t = epNormalizePdfText(text, ctx.locale);
  if (!t) return [];
  const wrapStyle = style ?? ctx.lastTextStyle ?? { size: 9, bold: false };
  return pdfI18nCtxSplit(ctx, t, maxW, { size: wrapStyle.size, bold: wrapStyle.bold });
}

export function epMeasureWrappedTextHeight(lineCount: number, lineH: number, pad = 0): number {
  if (lineCount <= 0) return pad;
  return lineCount * lineH + pad;
}

function freshCap(ctx: ExecutivePremiumDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

export function epCreateContext(
  pdf: Pdf,
  cv: CVData,
  locale: Locale,
  i18n: PdfI18nRegistry,
): ExecutivePremiumDirectPdfContext {
  return {
    pdf,
    cv,
    locale,
    labels: getExecutivePremiumPdfLabels(locale),
    i18n,
    unicodeReady: i18n.latinReady,
    contentX: MARGIN_X,
    contentW: A4_W - MARGIN_X * 2,
    marginTop: MARGIN_TOP_CONT,
    marginBottom: MARGIN_BOTTOM,
    bottomSafeY: A4_H - MARGIN_BOTTOM,
    y: MARGIN_TOP_CONT,
    pageIndex: 0,
  };
}

export function epAddPage(ctx: ExecutivePremiumDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

export function epMoveToNextPage(ctx: ExecutivePremiumDirectPdfContext): void {
  epAddPage(ctx);
}

export function epEnsureSpace(ctx: ExecutivePremiumDirectPdfContext, h: number): void {
  if (ctx.y + h <= ctx.bottomSafeY) return;
  epAddPage(ctx);
}

export function epMoveToFreshPageIfNeeded(ctx: ExecutivePremiumDirectPdfContext, h: number): void {
  if (h > freshCap(ctx)) return;
  if (ctx.y + h > ctx.bottomSafeY) epAddPage(ctx);
}

export function epDrawHeader(
  ctx: ExecutivePremiumDirectPdfContext,
  photoDataUrl: string | null,
): void {
  const headerH = photoDataUrl ? 52 : 42;
  ctx.pdf.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  ctx.pdf.rect(0, 0, A4_W, headerH, 'F');

  const textMaxW = ctx.contentW;
  let ty = 10;

  if (photoDataUrl) {
    const photoX = (A4_W - EP_PHOTO_W) / 2;
    const photoY = 6;
    try {
      drawRectPdfPhoto(ctx.pdf, photoDataUrl, photoX, photoY, EP_PHOTO_W, EP_PHOTO_H, 'JPEG');
    } catch {
      try {
        drawRectPdfPhoto(ctx.pdf, photoDataUrl, photoX, photoY, EP_PHOTO_W, EP_PHOTO_H, 'PNG');
      } catch {
        // Keep export usable if jsPDF rejects an image data URL.
      }
    }
    ty = photoY + EP_PHOTO_H + 2.5;
  }

  const name = (ctx.cv.personal.fullName || 'YOUR NAME').toUpperCase();
  const nameStyle: Style = { size: 18, color: [255, 255, 255], bold: true, lineH: 6.5 };
  applyStyle(ctx, nameStyle, name);
  const nameLines = epMeasureWrappedLines(ctx, name, textMaxW, nameStyle).slice(0, 2);
  for (const ln of nameLines) {
    if (photoDataUrl) {
      drawText(ctx, ln, A4_W / 2, ty + 4.5, nameStyle, { align: 'center' });
    } else {
      drawText(ctx, ln, MARGIN_X, ty + 4.5, nameStyle);
    }
    ty += 6.2;
  }

  ctx.pdf.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  if (photoDataUrl) {
    ctx.pdf.rect((A4_W - 18) / 2, ty + 1, 18, 0.55, 'F');
  } else {
    ctx.pdf.rect(MARGIN_X, ty + 1, 18, 0.55, 'F');
  }
  ty += 5;

  if (ctx.cv.personal.jobTitle) {
    const titleStyle: Style = { size: 10, color: SOFT_GOLD, lineH: 4 };
    applyStyle(ctx, titleStyle, ctx.cv.personal.jobTitle);
    const titleLines = epMeasureWrappedLines(ctx, ctx.cv.personal.jobTitle, textMaxW, titleStyle).slice(0, 2);
    for (const ln of titleLines) {
      if (photoDataUrl) {
        drawText(ctx, ln, A4_W / 2, ty + 3, titleStyle, { align: 'center' });
      } else {
        drawText(ctx, ln, MARGIN_X, ty + 3, titleStyle);
      }
      ty += 4;
    }
  }

  const contacts = [ctx.cv.personal.email, ctx.cv.personal.phone, ctx.cv.personal.address].filter(Boolean) as string[];
  if (contacts.length) {
    ty += 2;
    const contactStyle: Style = { size: 8, color: CONTACT, lineH: 3.4 };
    const contactText = contacts.join('  |  ');
    applyStyle(ctx, contactStyle, contactText);
    const contactLines = epMeasureWrappedLines(ctx, contactText, textMaxW, contactStyle).slice(0, 2);
    for (const ln of contactLines) {
      if (photoDataUrl) {
        drawText(ctx, ln, A4_W / 2, ty + 2.5, contactStyle, { align: 'center' });
      } else {
        drawText(ctx, ln, MARGIN_X, ty + 2.5, contactStyle);
      }
      ty += 3.5;
    }
  }

  ctx.pdf.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  ctx.pdf.rect(0, headerH, A4_W, 0.7, 'F');

  ctx.y = headerH + BODY_AFTER_HEADER;
}

export function epDrawSectionHeading(
  ctx: ExecutivePremiumDirectPdfContext,
  label: string,
  opts: { centered?: boolean; compact?: boolean } = {},
): void {
  epEnsureSpace(ctx, SECTION_H + 1);
  const style: Style = {
    size: opts.compact ? 7.8 : 8.5,
    color: HEADING,
    bold: true,
    lineH: 3.5,
  };
  const text = label.toUpperCase();
  applyStyle(ctx, style, text);
  if (opts.centered) {
    drawText(ctx, text, ctx.contentX + ctx.contentW / 2, ctx.y + 3, style, { align: 'center' });
  } else {
    drawText(ctx, text, ctx.contentX, ctx.y + 3, style);
  }
  ctx.y += 4.2;
  ctx.pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.contentX, ctx.y, ctx.contentX + ctx.contentW, ctx.y);
  ctx.y += 3.2;
}

export function epDrawWrappedParagraph(
  ctx: ExecutivePremiumDirectPdfContext,
  lines: string[],
  style: Style,
  opts: { x?: number; centered?: boolean } = {},
): void {
  const x = opts.x ?? ctx.contentX;
  for (const line of lines) {
    epEnsureSpace(ctx, style.lineH);
    applyStyle(ctx, style, line);
    if (opts.centered) {
      drawText(ctx, line, ctx.contentX + ctx.contentW / 2, ctx.y + style.size * 0.32, style, { align: 'center' });
    } else {
      drawText(ctx, line, x, ctx.y + style.size * 0.32, style);
    }
    ctx.y += style.lineH;
  }
}

export function epDrawSummary(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.summary) return;
  const style: Style = { size: 9.5, color: BODY, italic: true, lineH: BODY_LINE };
  const lines = epMeasureWrappedLines(ctx, ctx.cv.summary, ctx.contentW, style);
  if (!lines.length) return;

  let idx = 0;
  let firstBlock = true;
  while (idx < lines.length) {
    const headingLabel = firstBlock ? ctx.labels.summary : ctx.labels.summaryContinued;
    const headingH = SECTION_H + 1;
    const available = ctx.bottomSafeY - ctx.y - headingH;
    const roomLines = Math.floor(available / style.lineH);
    if (roomLines <= 0) {
      epMoveToNextPage(ctx);
      firstBlock = false;
      continue;
    }

    if (firstBlock) {
      epMoveToFreshPageIfNeeded(ctx, headingH + style.lineH);
    } else {
      epEnsureSpace(ctx, headingH + style.lineH);
    }

    epDrawSectionHeading(ctx, headingLabel, { compact: !firstBlock });
    const take = Math.min(lines.length - idx, Math.max(1, roomLines));
    epDrawWrappedParagraph(ctx, lines.slice(idx, idx + take), style);
    idx += take;
    if (idx < lines.length) {
      epMoveToNextPage(ctx);
      firstBlock = false;
    }
  }
  ctx.y += 4;
}

function splitBullets(ctx: ExecutivePremiumDirectPdfContext, raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => epNormalizePdfText(l.replace(/^(?:[-*]|\u2022|\d+\.)\s*/, ''), ctx.locale))
    .filter(Boolean);
}

function epBulletTextLayout(ctx: ExecutivePremiumDirectPdfContext, maxW: number): BulletLayout {
  const markerX = ctx.contentX;
  const textX = ctx.contentX + BULLET_INDENT;
  return { markerX, textX, textW: maxW - BULLET_INDENT };
}

function buildBulletUnits(ctx: ExecutivePremiumDirectPdfContext, raw: string, maxW: number): BulletUnit[] {
  const layout = epBulletTextLayout(ctx, maxW);
  return splitBullets(ctx, raw).map((text) => ({
    lines: epMeasureWrappedLines(ctx, text, layout.textW, { size: 9, bold: false }),
  }));
}

export function epMeasureBulletHeight(lineCount: number): number {
  return lineCount * BULLET_LH;
}

function bulletUnitHeight(unit: BulletUnit): number {
  return epMeasureBulletHeight(unit.lines.length);
}

export function epDrawWrappedBullet(
  ctx: ExecutivePremiumDirectPdfContext,
  lines: string[],
  layout: BulletLayout,
  opts: { drawMarker?: boolean } = {},
): void {
  const drawMarker = opts.drawMarker ?? true;
  const style: Style = { size: 9, color: BODY, lineH: BULLET_LH };
  const markerStyle: Style = { size: 9, color: GOLD, lineH: BULLET_LH };
  for (let i = 0; i < lines.length; i += 1) {
    epEnsureSpace(ctx, BULLET_LH);
    if (i === 0 && drawMarker) {
      applyStyle(ctx, markerStyle, '-');
      drawText(ctx, '-', layout.markerX, ctx.y + 2.8, markerStyle);
    }
    applyStyle(ctx, style, lines[i]!);
    drawText(ctx, lines[i]!, layout.textX, ctx.y + 2.8, style);
    ctx.y += BULLET_LH;
  }
}

function epMeasureExperienceLeadHeight(ctx: ExecutivePremiumDirectPdfContext, entry: CVData['experience'][number]): number {
  const posLines = epMeasureWrappedLines(ctx, entry.position || '', ctx.contentW - 42, { size: 10.5, bold: true });
  let h = Math.max(4.2, posLines.length * 4.2) + 3.6;
  if (entry.company) h += 3.8;
  return h + 1.5;
}

export function epDrawExperienceEntryContinuation(
  ctx: ExecutivePremiumDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  epEnsureSpace(ctx, 5);
  const role = epNormalizePdfText(entry.position || entry.company || 'Experience', ctx.locale);
  const contStyle: Style = { size: 8.2, color: MUTED, bold: true, lineH: 3.4 };
  const contText = `${role} (continued)`;
  applyStyle(ctx, contStyle, contText);
  drawText(ctx, contText, ctx.contentX, ctx.y + 2.5, contStyle);
  ctx.y += 5;
}

function epDrawExperienceLead(ctx: ExecutivePremiumDirectPdfContext, entry: CVData['experience'][number]): void {
  const date = [entry.startDate, entry.isPresent ? ctx.labels.present : entry.endDate].filter(Boolean).join(' - ');
  const posStyle: Style = { size: 10.5, color: TEXT, bold: true, lineH: 4.2 };
  applyStyle(ctx, posStyle, entry.position || '');
  const posLines = epMeasureWrappedLines(ctx, entry.position || '', ctx.contentW - 42, posStyle);
  const startY = ctx.y;
  let ty = startY;
  for (const ln of posLines) {
    drawText(ctx, ln, ctx.contentX, ty + 3.2, posStyle);
    ty += 4.2;
  }

  if (date) {
    const dateStyle: Style = { size: 8.2, color: HEADING, italic: true, lineH: 3.2 };
    applyStyle(ctx, dateStyle, date);
    drawText(ctx, date, ctx.contentX + ctx.contentW, startY + 3, dateStyle, { align: 'right' });
  }

  if (entry.company) {
    const companyStyle: Style = { size: 9.5, color: GOLD, bold: true, lineH: 3.6 };
    const company = epNormalizePdfText(entry.company, ctx.locale);
    applyStyle(ctx, companyStyle, company);
    drawText(ctx, company, ctx.contentX, ty + 2.8, companyStyle);
    ty += 3.8;
  }

  ctx.pdf.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  ctx.pdf.setLineWidth(0.35);
  ctx.pdf.line(ctx.contentX, ty + 0.4, ctx.contentX + Math.min(22, ctx.contentW * 0.12), ty + 0.4);
  ctx.y = ty + 1.5;
}

function epDrawExperienceEntry(ctx: ExecutivePremiumDirectPdfContext, entry: CVData['experience'][number]): void {
  const layout = epBulletTextLayout(ctx, ctx.contentW - 4);
  const units = buildBulletUnits(ctx, entry.description || '', ctx.contentW - 4);
  const leadH = epMeasureExperienceLeadHeight(ctx, entry);
  const firstBulletH = units[0] ? bulletUnitHeight(units[0]) : 0;
  const keepH = leadH + Math.min(firstBulletH, BULLET_LH * 2);

  if (ctx.y + keepH > ctx.bottomSafeY && keepH <= freshCap(ctx)) epMoveToNextPage(ctx);

  epDrawExperienceLead(ctx, entry);
  const continuation = { shown: false };

  for (const unit of units) {
    const h = bulletUnitHeight(unit);
    if (ctx.y + h > ctx.bottomSafeY && h <= freshCap(ctx)) {
      epMoveToNextPage(ctx);
      if (!continuation.shown) {
        epDrawExperienceEntryContinuation(ctx, entry);
        continuation.shown = true;
      }
    }

    let lineIndex = 0;
    while (lineIndex < unit.lines.length) {
      const remaining = unit.lines.length - lineIndex;
      const room = Math.floor((ctx.bottomSafeY - ctx.y) / BULLET_LH);
      if (room <= 0) {
        epMoveToNextPage(ctx);
        if (!continuation.shown) {
          epDrawExperienceEntryContinuation(ctx, entry);
          continuation.shown = true;
        }
        continue;
      }
      const take = Math.min(remaining, room);
      epDrawWrappedBullet(ctx, unit.lines.slice(lineIndex, lineIndex + take), layout, {
        drawMarker: lineIndex === 0,
      });
      lineIndex += take;
      if (lineIndex < unit.lines.length) {
        epMoveToNextPage(ctx);
        if (!continuation.shown) {
          epDrawExperienceEntryContinuation(ctx, entry);
          continuation.shown = true;
        }
      }
    }
  }
  ctx.y += 3.5;
}

export function epDrawExperienceSection(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.experience.length) return;
  const first = ctx.cv.experience[0]!;
  const leadH = epMeasureExperienceLeadHeight(ctx, first);
  const units = buildBulletUnits(ctx, first.description || '', ctx.contentW - 4);
  const firstBh = units[0] ? bulletUnitHeight(units[0]) : 0;
  epMoveToFreshPageIfNeeded(ctx, SECTION_H + leadH + Math.min(firstBh, BULLET_LH * 2));
  epDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of ctx.cv.experience) epDrawExperienceEntry(ctx, entry);
}

export function epDrawEducationSection(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.education.length) return;
  epMoveToFreshPageIfNeeded(ctx, SECTION_H + 10);
  epDrawSectionHeading(ctx, ctx.labels.education, { centered: true });

  for (const edu of ctx.cv.education) {
    epMoveToFreshPageIfNeeded(ctx, 10);
    const degreeStyle: Style = { size: 10, color: TEXT, bold: true, lineH: 4 };
    const degree = epNormalizePdfText(edu.degree || '', ctx.locale);
    applyStyle(ctx, degreeStyle, degree);
    drawText(ctx, degree, ctx.contentX + ctx.contentW / 2, ctx.y + 3, degreeStyle, { align: 'center' });
    ctx.y += 4.2;

    const meta = [edu.school, [edu.startDate, edu.endDate].filter(Boolean).join(' - ')].filter(Boolean).join(' | ');
    if (meta) {
      const metaStyle: Style = { size: 8.5, color: MUTED, lineH: 3.4 };
      const metaText = epNormalizePdfText(meta, ctx.locale);
      applyStyle(ctx, metaStyle, metaText);
      drawText(ctx, metaText, ctx.contentX + ctx.contentW / 2, ctx.y + 2.5, metaStyle, { align: 'center' });
      ctx.y += 4;
    }
    if (edu.description) {
      epDrawWrappedParagraph(
        ctx,
        epMeasureWrappedLines(ctx, edu.description, ctx.contentW),
        { size: 8.5, color: BODY, lineH: 3.4 },
        { centered: true },
      );
    }
    ctx.y += 2;
  }
}

export function epLayoutSkillChips(ctx: ExecutivePremiumDirectPdfContext, skills: string[]): string[] {
  return skills.map((s) => getLocalizedCvSkillName(s, ctx.locale) || s);
}

function measureSkillsBlockH(ctx: ExecutivePremiumDirectPdfContext): number {
  if (!ctx.cv.skills.length) return 0;
  const labels = epLayoutSkillChips(ctx, ctx.cv.skills);
  const style: Style = { size: 9, color: BODY, lineH: 3.6 };
  applyStyle(ctx, style);
  const text = labels.join('  |  ');
  const lines = epMeasureWrappedLines(ctx, text, ctx.contentW, style);
  return SECTION_H + epMeasureWrappedTextHeight(lines.length, 3.6) + 2;
}

function measureLangsBlockH(ctx: ExecutivePremiumDirectPdfContext): number {
  if (!ctx.cv.languages.length) return 0;
  return SECTION_H + ctx.cv.languages.length * 4.2 + 2;
}

export function epMeasureLowerSectionsHeight(ctx: ExecutivePremiumDirectPdfContext): number {
  let h = 0;
  if (ctx.cv.education.length) h += SECTION_H + ctx.cv.education.length * 10 + 4;
  h += measureSkillsBlockH(ctx) + measureLangsBlockH(ctx);
  if (ctx.cv.certifications.length) h += SECTION_H + ctx.cv.certifications.length * 3.6;
  return h;
}

function drawSkillsPipeList(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.skills.length) return;
  epDrawSectionHeading(ctx, ctx.labels.skills);
  const labels = epLayoutSkillChips(ctx, ctx.cv.skills);
  epDrawWrappedParagraph(
    ctx,
    epMeasureWrappedLines(ctx, labels.join('  |  '), ctx.contentW),
    { size: 9, color: BODY, lineH: 3.6 },
    { centered: true },
  );
  ctx.y += 1;
}

function drawLanguages(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.languages.length) return;
  epDrawSectionHeading(ctx, ctx.labels.languages);
  for (const lang of ctx.cv.languages) {
    epEnsureSpace(ctx, 4.2);
    const name = getLocalizedCvLanguageName(lang.name, ctx.locale) || lang.name;
    const nameStyle: Style = { size: 9, color: TEXT, bold: true, lineH: 3.6 };
    applyStyle(ctx, nameStyle, name);
    drawText(ctx, name, ctx.contentX, ctx.y + 2.8, nameStyle);
    if (lang.level) {
      const levelStyle: Style = { size: 8.5, color: MUTED, lineH: 3.6 };
      applyStyle(ctx, levelStyle, lang.level);
      drawText(ctx, lang.level, ctx.contentX + ctx.contentW, ctx.y + 2.8, levelStyle, { align: 'right' });
    }
    ctx.y += 4.2;
  }
  ctx.y += 1.5;
}

export function epDrawSkillsLanguagesGroup(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.skills.length && !ctx.cv.languages.length) return;

  const skillsH = measureSkillsBlockH(ctx);
  const langsH = measureLangsBlockH(ctx);
  const combined = skillsH + langsH;
  const remaining = ctx.bottomSafeY - ctx.y;

  if (combined > 0 && combined <= freshCap(ctx) && remaining < combined && remaining < SPARSE_LOWER_THRESHOLD_MM) {
    epMoveToNextPage(ctx);
  }

  if (ctx.cv.skills.length) {
    if (ctx.y + skillsH > ctx.bottomSafeY && skillsH <= freshCap(ctx)) epMoveToNextPage(ctx);
    drawSkillsPipeList(ctx);
  }
  if (ctx.cv.languages.length) {
    if (ctx.y + langsH > ctx.bottomSafeY && langsH <= freshCap(ctx)) epMoveToNextPage(ctx);
    drawLanguages(ctx);
  }
}

function epDrawCertifications(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.certifications.length) return;
  epMoveToFreshPageIfNeeded(ctx, SECTION_H + 6);
  epDrawSectionHeading(ctx, ctx.labels.certifications, { centered: true });
  for (const cert of ctx.cv.certifications) {
    epDrawWrappedParagraph(
      ctx,
      epMeasureWrappedLines(ctx, cert, ctx.contentW),
      { size: 9, color: BODY, lineH: 3.6 },
      { centered: true },
    );
  }
}

export async function buildExecutivePremiumPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const i18n = await registerPdfI18nFonts(pdf);
  const ctx = epCreateContext(pdf, cv, locale, i18n);

  const preparedPhoto = options.photoDataUrl
    ? await preparePdfRectPhotoDataUrl(options.photoDataUrl, {
      widthPx: EP_PHOTO_PREP_W_PX,
      heightPx: EP_PHOTO_PREP_H_PX,
      mimeType: 'image/jpeg',
    })
    : null;
  epDrawHeader(ctx, preparedPhoto);
  epDrawSummary(ctx);
  epDrawExperienceSection(ctx);
  epDrawEducationSection(ctx);
  epDrawSkillsLanguagesGroup(ctx);
  epDrawCertifications(ctx);

  const out = pdf.output('blob');
  return out instanceof Blob ? out : new Blob([out], { type: 'application/pdf' });
}
